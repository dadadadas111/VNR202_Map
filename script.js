// Prototype script for the interactive historical map

document.addEventListener('DOMContentLoaded', () => {
  // Guard: ensure Leaflet loaded
  if (typeof L === 'undefined') {
    console.error('Leaflet (L) is not defined — check that leaflet.js loaded correctly.');
    const loader = document.getElementById('loader');
    if (loader) loader.textContent = 'Lỗi: không tải được thư viện bản đồ (Leaflet).';
    return;
  }

  const map = L.map('map', { preferCanvas: true }).setView([16.0, 108.0], 5.5);

  // Basemap: CartoDB Positron for a clean, light background
  const base = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors & CartoDB',
    detectRetina: true
  }).addTo(map);

  // track tile loading to reduce flicker
  let tilesLoaded = false;
  base.on('load', () => { tilesLoaded = true; hideLoaderIfReady(); });

  let geojsonLayer;
  let events = [];
  let geo = null;
  let currentPeriod = 'p1';

// Period definitions (ASSUMPTION: to avoid double-counting boundary years we use these ranges)
// p1: 1930-1944, p2: 1945-1974, p3: 1975-present
// Note: Original prompt lists overlapping boundaries (e.g., 1945 appears in two ranges).
// I choose the convention above and include 1945 in period 2 and 1975 in period 3.
function getPeriodRange(key) {
  if (key === 'p1') return [1930, 1944];
  if (key === 'p2') return [1945, 1974];
  return [1975, 9999];
}

// Simple color scale by count
function getColorForCount(c) {
  // red scale: light -> dark
  return c >= 3 ? '#7f0000' :
         c === 2 ? '#c00000' :
         c === 1 ? '#ff6b6b' :
                    '#f0f0f0';
}

// normalize strings for robust matching (case-insensitive, remove diacritics)
function normalizeString(s) {
  if (!s && s !== 0) return '';
  try {
    return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  } catch (err) {
    // Fallback if RegExp property escapes not supported
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
}

// return a readable display name for a feature
function getFeatureDisplayName(feature) {
  const p = feature && feature.properties;
  return p && (p.ten_tinh || p.TEN_TINH || p.name || p.NAME || p.ten || p.TEN) || 'Không rõ';
}

// return a normalized name used for matching
function getFeatureNormName(feature) {
  const display = getFeatureDisplayName(feature);
  return normalizeString(display);
}

function styleFeature(feature) {
  const count = countEventsForFeature(feature, currentPeriod);
  return {
    fillColor: getColorForCount(count),
    weight: 1.6,
    opacity: 1,
    color: '#b8860b', // dark golden/yellow stroke to avoid glare
    fillOpacity: count > 0 ? 0.82 : 0.28
  };
}

function onEachFeature(feature, layer) {
  const displayName = getFeatureDisplayName(feature);
  layer.on({
    click: () => {
      const items = eventsForFeatureAndPeriod(feature, currentPeriod);
      const html = popupHtml(displayName, items);
      layer.bindPopup(html, { maxWidth: 350 }).openPopup();
    },
    mouseover: (e) => {
      try {
        e.target.setStyle({ fillColor: '#ffe082', fillOpacity: 0.95, color: '#b8860b' });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) e.target.bringToFront();
      } catch (err) { /* ignore */ }
    },
    mouseout: (e) => {
      try { if (geojsonLayer) geojsonLayer.resetStyle(e.target); } catch (err) { /* ignore */ }
    }
  });
}

function popupHtml(provinceName, items) {
  let html = `<div><strong>${provinceName}</strong></div>`;
  if (!items || items.length === 0) {
    html += '<div>Không có sự kiện trong giai đoạn này.</div>';
    return html;
  }
  html += '<ul class="event-list">';
  items.forEach(it => {
    html += `<li class="event-item"><span class="event-year">${it.year}</span><strong>${it.name}</strong><div>${it.description}</div></li>`;
  });
  html += '</ul>';
  return html;
}

function eventsForProvinceAndPeriod(provinceName, periodKey) {
  const [start, end] = getPeriodRange(periodKey);
  const probe = normalizeString(provinceName);
  return events.filter(e => e._normProvince === probe && e.year >= start && e.year <= end);
}

function countEventsForProvince(provinceName, periodKey) {
  return eventsForProvinceAndPeriod(provinceName, periodKey).length;
}

// New helpers to match GeoJSON features directly
function eventsForFeatureAndPeriod(feature, periodKey) {
  const [start, end] = getPeriodRange(periodKey);
  const probe = feature && feature.properties && feature.properties._normName;
  if (!probe) return [];
  return events.filter(e => e._normProvince === probe && e.year >= start && e.year <= end);
}

function countEventsForFeature(feature, periodKey) {
  return eventsForFeatureAndPeriod(feature, periodKey).length;
}

    function updateGeoStyle() {
      if (!geojsonLayer) return;
      geojsonLayer.setStyle(styleFeature);
    }

    // Load data and initialize
    Promise.all([
      fetch('events.json').then(r => r.json()),
      fetch('vietnam.geojson').then(r => r.json())
    ]).then(([ev, vg]) => {
      events = ev;
      geo = vg;

      // normalize event province names for fast matching
      events.forEach(e => {
        e._normProvince = normalizeString(e.province || e.province_name || e.provinceName || '');
      });

      // create a dedicated pane for the geojson so it renders above tiles
      try { map.createPane('geojsonPane'); map.getPane('geojsonPane').style.zIndex = 650; } catch (e) { /* ignore if exists */ }

      // add normalized names to each feature for matching
      (geo.features || []).forEach(f => {
        try {
          f.properties = f.properties || {};
          f.properties._displayName = getFeatureDisplayName(f);
          f.properties._normName = getFeatureNormName(f);
        } catch (err) { /* ignore */ }
      });

      geojsonLayer = L.geoJSON(geo, {
        pane: 'geojsonPane',
        style: styleFeature,
        onEachFeature: onEachFeature
      }).addTo(map);

      // make geojson pane fade in to reduce visual popping when layer loads late
      try {
        const p = map.getPane('geojsonPane');
        if (p) {
          p.style.opacity = 0;
          // ensure reflow then transition
          setTimeout(() => {
            p.style.transition = 'opacity 300ms ease-in-out';
            p.style.opacity = 1;
          }, 80);
        }
      } catch (err) { /* ignore */ }

      // geojson loaded — hide loader if tiles ready
      hideLoaderIfReady();

      // Fit map to geojson bounds
      try {
        map.fitBounds(geojsonLayer.getBounds(), { padding: [20,20] });
      } catch (err) {
        console.warn('Could not fit bounds:', err);
      }

      addLegend();
    }).catch(err => {
      console.error('Error loading data:', err);
      const loader = document.getElementById('loader');
      if (loader) loader.textContent = 'Lỗi khi tải dữ liệu.';
    });

    // Period selection handling
    const periodSelect = document.getElementById('periodSelect');
    periodSelect.addEventListener('change', (e) => {
      currentPeriod = e.target.value;
      updateGeoStyle();
    });

    // Add a simple legend control
    function addLegend() {
      const legend = L.control({ position: 'bottomright' });
      legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'legend');
        div.innerHTML = '<div><strong>Ghi chú</strong></div>' +
          `<div><span class="box" style="background:${getColorForCount(0)}"></span> 0 sự kiện</div>` +
          `<div><span class="box" style="background:${getColorForCount(1)}"></span> 1 sự kiện</div>` +
          `<div><span class="box" style="background:${getColorForCount(2)}"></span> 2 sự kiện</div>` +
          `<div><span class="box" style="background:${getColorForCount(3)}"></span> 3+ sự kiện</div>`;
        return div;
      };
      legend.addTo(map);
    }

    // hide loader only when both tiles and geojson are ready
    function hideLoaderIfReady() {
      const loader = document.getElementById('loader');
      // tilesLoaded is tracked by base tile 'load' event; geojson presence indicates it's been added
      const tilesReady = typeof tilesLoaded !== 'undefined' ? tilesLoaded : true;
      const geoReady = !!geojsonLayer;
      if (tilesReady && geoReady && loader) loader.style.display = 'none';
    }

    // Expose small helper for debugging in console
    window._histMap = {
      eventsArray: () => events,
      countsForPeriod: (p) => {
        const out = {};
        (geo && geo.features || []).forEach(f => {
          const n = f.properties && f.properties.name;
          out[n] = countEventsForProvince(n, p || currentPeriod);
        });
        return out;
      }
    };
  });