// Prototype script for the interactive historical map

document.addEventListener('DOMContentLoaded', () => {
  // Guard: ensure Leaflet loaded
  if (typeof L === 'undefined') {
    console.error('Leaflet (L) is not defined — check that leaflet.js loaded correctly.');
    const loader = document.getElementById('loader');
    if (loader) loader.textContent = 'Lỗi: không tải được thư viện bản đồ (Leaflet).';
    return;
  }

  const map = L.map('map', { preferCanvas: true }).setView([16.0, 108.0], 6.2);
  // ensure tooltip pane is above vector/canvas layers
  try { const tp = map.getPane && map.getPane('tooltipPane'); if (tp) tp.style.zIndex = 4600; } catch (err) { /* ignore */ }
  // expose map globally so other small helper scripts can access it (map-actions.js)
  try { window.map = map; } catch (err) { /* ignore if cannot attach */ }

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
  let selectedLayer = null;
  let selectedFeature = null;
  let suppressStyleUpdateDuringAnimation = false;
  let selectedLayers = []; // for multi-province selection when event is clicked
  let selectionMode = null; // 'event' or 'province' to track selection mode
  let selectedEvent = null; // track currently selected event for UI highlighting

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
      // Do not show popup any more — open panels instead
      const items = eventsForFeatureAndPeriod(feature, currentPeriod);
      // select/highlight clicked feature immediately
      try { selectFeature(layer, feature); } catch (err) { /* ignore */ }
      // focus/zoom to clicked feature (use smoother flyToBounds if available)
      try {
        if (typeof window.map !== 'undefined' && typeof window.map.flyToBounds === 'function') {
          // suppress style updates during animation to avoid popping
          suppressStyleUpdateDuringAnimation = true;
          const bounds = layer.getBounds ? layer.getBounds() : null;
          if (bounds) window.map.flyToBounds(bounds, { padding: [40,40], maxZoom: 9, duration: 0.8 });
        } else if (typeof focusOnLayer === 'function') {
          suppressStyleUpdateDuringAnimation = true;
          focusOnLayer(layer);
        }
      } catch (err) { /* ignore */ }

      // render left timeline and right info panels
      try { window.renderTimeline(displayName, items); } catch (err) { /* ignore */ }
      try { window.renderProvinceInfo(feature, items.length); } catch (err) { /* ignore */ }
      // when movement/zoom finishes, re-enable style updates and reapply styles
      try {
        if (window.map) {
          window.map.once('moveend', () => {
            suppressStyleUpdateDuringAnimation = false;
            updateGeoStyle();
            // reapply selection style so it's not overwritten
            if (selectedLayer && selectedFeature) {
              applySelectedStyle(selectedLayer);
            }
          });
        }
      } catch (err) { /* ignore */ }
    },
    mouseover: (e) => {
      // don't apply hover effect while animating or if this layer is already selected
      if (suppressStyleUpdateDuringAnimation) return;
      // skip hover if in event-mode and this layer is in selectedLayers
      if (selectionMode === 'event' && selectedLayers.indexOf(layer) !== -1) return;
      // skip hover if in province-mode and this is the selected layer
      if (selectionMode === 'province' && selectedLayer === layer) return;
      try {
        layer.setStyle({ fillColor: '#ffe082', fillOpacity: 0.95, color: '#b8860b' });
        // do not bring hovered layer to front (avoid covering selected outline)
        // ensure selected layer(s) stay on top if present
        if (selectionMode === 'province' && selectedLayer && selectedLayer !== layer && selectedLayer.bringToFront) selectedLayer.bringToFront();
        if (selectionMode === 'event') selectedLayers.forEach(l => { if (l !== layer && l.bringToFront) l.bringToFront(); });
        if (layer.openTooltip) layer.openTooltip();
      } catch (err) { /* ignore */ }
    },
    mouseout: (e) => {
      // if this layer is selected in either mode, keep its selected styling
      if (selectionMode === 'province' && selectedLayer === layer) return;
      if (selectionMode === 'event' && selectedLayers.indexOf(layer) !== -1) return;
      try {
        if (geojsonLayer && typeof geojsonLayer.resetStyle === 'function') geojsonLayer.resetStyle(layer);
        if (layer.closeTooltip) layer.closeTooltip();
        // reassert selected layer(s) on top so outline remains visible
        if (selectionMode === 'province' && selectedLayer && selectedLayer.bringToFront) selectedLayer.bringToFront();
        if (selectionMode === 'event') selectedLayers.forEach(l => { if (l.bringToFront) l.bringToFront(); });
      } catch (err) { /* ignore */ }
    }
  });
  // bind a tooltip showing the display name (appears on hover)
  try { layer.bindTooltip(displayName, { direction: 'auto', sticky: true, className: 'province-tooltip' }); } catch (err) { /* ignore */ }
}

  // Apply selected style to a layer
  function applySelectedStyle(layer) {
    try {
      if (!layer) return;
      layer.setStyle({
        fillColor: '#fff2cc',
        color: '#ff6f00',
        weight: 3,
        fillOpacity: 0.95
      });
      if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge && layer.bringToFront) layer.bringToFront();
    } catch (err) { /* ignore */ }
  }

  // Clear previously selected layer and restore style
  function deselectFeature() {
    try {
      if (selectedLayer && geojsonLayer && typeof geojsonLayer.resetStyle === 'function') {
        geojsonLayer.resetStyle(selectedLayer);
      }
    } catch (err) { /* ignore */ }
    selectedLayer = null; selectedFeature = null;
  }

  function selectFeature(layer, feature) {
    try {
      deselectAllFeatures(); // clear any previous selection (event or province)
      selectionMode = 'province';
      selectedLayer = layer;
      selectedFeature = feature;
      applySelectedStyle(layer);
    } catch (err) { /* ignore */ }
  }

  // Multi-province selection for event-based highlighting
  function deselectAllFeatures() {
    try {
      // clear province mode
      if (selectedLayer && geojsonLayer && typeof geojsonLayer.resetStyle === 'function') {
        geojsonLayer.resetStyle(selectedLayer);
      }
      selectedLayer = null;
      selectedFeature = null;
      // clear event mode
      selectedLayers.forEach(l => {
        if (geojsonLayer && typeof geojsonLayer.resetStyle === 'function') geojsonLayer.resetStyle(l);
      });
      selectedLayers = [];
      selectionMode = null;
      selectedEvent = null; // clear selected event tracking
      // NOTE: UI selection state is managed separately in ui-panels.js and is never cleared
    } catch (err) { /* ignore */ }
  }

  function selectMultipleFeatures(layersArray) {
    try {
      deselectAllFeatures();
      selectionMode = 'event';
      selectedLayers = layersArray.slice();
      layersArray.forEach(l => applySelectedStyle(l));
    } catch (err) { /* ignore */ }
  }

  // Helper to find layers by province name
  function findLayersByProvinceNames(provinceNames) {
    const normNames = provinceNames.map(n => normalizeString(n));
    const layers = [];
    if (!geojsonLayer) return layers;
    geojsonLayer.eachLayer(l => {
      const f = l.feature;
      if (!f || !f.properties) return;
      const fNorm = f.properties._normName;
      if (normNames.indexOf(fNorm) !== -1) layers.push(l);
    });
    return layers;
  }

  // Refresh timeline to show all events for the given period
  function refreshTimelineForPeriod(periodKey) {
    try {
      const [start, end] = getPeriodRange(periodKey);
      const periodEvents = events.filter(e => e.year >= start && e.year <= end);
      if (typeof window.renderAllEventsTimeline === 'function') {
        window.renderAllEventsTimeline(periodEvents, periodKey);
      }
    } catch (err) { console.warn('refreshTimelineForPeriod error', err); }
  }

  // Expose selectedEvent getter
  window.getSelectedEvent = function() {
    return selectedEvent;
  };

  // Expose helpers globally for ui-panels
  window.selectEventProvinces = function(event) {
    try {
      if (!event) return;
      selectedEvent = event; // track selected event
      const provinceNames = event._normProvinces || [];
      if (event._isNational) {
        // select all provinces
        const allLayers = [];
        if (geojsonLayer) geojsonLayer.eachLayer(l => allLayers.push(l));
        selectMultipleFeatures(allLayers);
        // zoom to full extent
        if (window.map && geojsonLayer) {
          suppressStyleUpdateDuringAnimation = true;
          window.map.flyToBounds(geojsonLayer.getBounds(), { padding: [20,20], maxZoom: 6, duration: 0.8 });
          window.map.once('moveend', () => {
            suppressStyleUpdateDuringAnimation = false;
            updateGeoStyle();
            selectedLayers.forEach(l => applySelectedStyle(l));
          });
        }
        // render multi-province info
        if (typeof window.renderMultiProvinceInfo === 'function') {
          const allFeatures = allLayers.map(l => l.feature).filter(Boolean);
          window.renderMultiProvinceInfo(allFeatures, event);
        }
      } else {
        const layers = findLayersByProvinceNames(provinceNames);
        selectMultipleFeatures(layers);
        // zoom to combined bounds of selected
        if (layers.length && window.map) {
          const group = L.featureGroup(layers);
          suppressStyleUpdateDuringAnimation = true;
          window.map.flyToBounds(group.getBounds(), { padding: [40,40], maxZoom: 8, duration: 0.8 });
          window.map.once('moveend', () => {
            suppressStyleUpdateDuringAnimation = false;
            updateGeoStyle();
            selectedLayers.forEach(l => applySelectedStyle(l));
          });
        }
        // render multi-province info
        if (typeof window.renderMultiProvinceInfo === 'function') {
          const features = layers.map(l => l.feature).filter(Boolean);
          window.renderMultiProvinceInfo(features, event);
        }
      }
    } catch (err) { console.warn('selectEventProvinces error', err); }
  };

  // Select a single province (called from province link in right panel or map click)
  window.selectSingleProvince = function(provinceName) {
    try {
      const normName = normalizeString(provinceName);
      let targetLayer = null;
      if (geojsonLayer) {
        geojsonLayer.eachLayer(l => {
          const f = l.feature;
          if (!f || !f.properties) return;
          if (f.properties._normName === normName) targetLayer = l;
        });
      }
      if (!targetLayer) return;
      // deselect event mode, enter province mode
      deselectAllFeatures();
      selectFeature(targetLayer, targetLayer.feature);
      // focus/zoom
      try {
        if (typeof window.map !== 'undefined' && typeof window.map.flyToBounds === 'function') {
          suppressStyleUpdateDuringAnimation = true;
          const bounds = targetLayer.getBounds ? targetLayer.getBounds() : null;
          if (bounds) window.map.flyToBounds(bounds, { padding: [40,40], maxZoom: 9, duration: 0.8 });
        } else if (typeof focusOnLayer === 'function') {
          suppressStyleUpdateDuringAnimation = true;
          focusOnLayer(targetLayer);
        }
      } catch (err) { /* ignore */ }
      // render panels
      const displayName = getFeatureDisplayName(targetLayer.feature);
      const items = eventsForFeatureAndPeriod(targetLayer.feature, currentPeriod);
      try { window.renderTimeline(displayName, items); } catch (err) { /* ignore */ }
      try { window.renderProvinceInfo(targetLayer.feature, items.length); } catch (err) { /* ignore */ }
      // handle moveend
      try {
        if (window.map) {
          window.map.once('moveend', () => {
            suppressStyleUpdateDuringAnimation = false;
            updateGeoStyle();
            if (selectedLayer && selectedFeature) applySelectedStyle(selectedLayer);
          });
        }
      } catch (err) { /* ignore */ }
    } catch (err) { console.warn('selectSingleProvince error', err); }
  };

  window.getEventsForPeriod = function(periodKey) {
    const [start, end] = getPeriodRange(periodKey);
    return events.filter(e => e.year >= start && e.year <= end);
  };

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
  return events.filter(e => {
    if (!e) return false;
    const inTime = e.year >= start && e.year <= end;
    if (!inTime) return false;
    if (e._isNational) return true; // applies to whole country
    return Array.isArray(e._normProvinces) && e._normProvinces.indexOf(probe) !== -1;
  });
}

function countEventsForProvince(provinceName, periodKey) {
  return eventsForProvinceAndPeriod(provinceName, periodKey).length;
}

// New helpers to match GeoJSON features directly
function eventsForFeatureAndPeriod(feature, periodKey) {
  const [start, end] = getPeriodRange(periodKey);
  const probe = feature && feature.properties && feature.properties._normName;
  if (!probe) return [];
  return events.filter(e => {
    if (!e) return false;
    const inTime = e.year >= start && e.year <= end;
    if (!inTime) return false;
    if (e._isNational) return true;
    return Array.isArray(e._normProvinces) && e._normProvinces.indexOf(probe) !== -1;
  });
}

function countEventsForFeature(feature, periodKey) {
  return eventsForFeatureAndPeriod(feature, periodKey).length;
}

    function updateGeoStyle() {
      if (!geojsonLayer) return;
      if (suppressStyleUpdateDuringAnimation) return; // avoid resetting while animating
      geojsonLayer.setStyle(styleFeature);
      // reapply selected layer style after default styles applied
      if (selectedLayer && selectedFeature) applySelectedStyle(selectedLayer);
    }

    // Load data and initialize
    Promise.all([
      fetch('events.json').then(r => r.json()),
      fetch('vietnam.geojson').then(r => r.json())
    ]).then(([ev, vg]) => {
      events = ev;
      geo = vg;

      // normalize event province names for fast matching
      // support multiple provinces separated by comma/semicolon, and the special term 'cả nước'
      events.forEach(e => {
        const raw = e.province || e.province_name || e.provinceName || '';
        if (!raw) {
          e._normProvinces = [];
          e._isNational = false;
          // ensure there is at least an empty support_label for UI code
          if (!e.support_label) e.support_label = '';
          return;
        }
        // split by comma or semicolon
        const parts = String(raw).split(/[;,]/).map(s => s.trim()).filter(Boolean);
        const norms = parts.map(p => normalizeString(p)).filter(Boolean);
        e._normProvinces = norms;
        e._isNational = norms.indexOf(normalizeString('cả nước')) !== -1 || norms.indexOf('ca nuoc') !== -1;
        // set a support_label for UI display if not explicitly provided in the JSON
        if (!e.support_label) {
          // join the original parts for display (keeps country markers like 'Hồng Kông (Trung Quốc)')
          e.support_label = parts.join(', ');
        }
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

      // Use an SVG renderer for geojson layer so HTML tooltips appear above it reliably
      const svgRenderer = L.svg({ pane: 'geojsonPane' });
      geojsonLayer = L.geoJSON(geo, {
        pane: 'geojsonPane',
        renderer: svgRenderer,
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

      // initialize timeline to show all events for the initial period
      refreshTimelineForPeriod(currentPeriod);
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
      // refresh timeline to show all events in new period
      refreshTimelineForPeriod(currentPeriod);
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