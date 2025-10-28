// Prototype script for the interactive historical map

document.addEventListener('DOMContentLoaded', () => {
  // About popup logic
  const aboutBtn = document.getElementById('aboutBtn');
  const aboutPopup = document.getElementById('aboutPopup');
  const closeAbout = document.getElementById('closeAbout');
  if (aboutBtn && aboutPopup && closeAbout) {
    aboutBtn.addEventListener('click', () => {
      aboutPopup.style.display = 'flex';
    });
    closeAbout.addEventListener('click', () => {
      aboutPopup.style.display = 'none';
    });
    // Đóng popup khi click ra ngoài vùng nội dung
    aboutPopup.addEventListener('click', (e) => {
      if (e.target === aboutPopup) aboutPopup.style.display = 'none';
    });
  }
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
  // Performance/config
  const MAP_ANIMATION_DURATION = 0.6; // seconds (used for flyTo/flyToBounds)
  window._isMapMoving = false; // flag used to debounce map interactions
  window._pendingEventSelection = null; // store last clicked event while flying

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
  // softer color scale (avoid overwhelmingly dark red for moderate counts)
  // thresholds: 5+ (dark), 3-4 (medium), 1-2 (light)
  return c >= 5 ? '#7f0000' :
         c >= 3 ? '#c0452b' :
         c >= 1 ? '#ffc4a3' :
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
    color: '#b8860b', // stroke (kept warm) — contrast with softer fills
    fillOpacity: count > 0 ? 0.6 : 0.14
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
          if (bounds) {
            window._isMapMoving = true;
            window.map.flyToBounds(bounds, { padding: [40,40], maxZoom: 9, duration: MAP_ANIMATION_DURATION });
            window.map.once('moveend', () => {
              window._isMapMoving = false;
            });
          }
        } else if (typeof focusOnLayer === 'function') {
          suppressStyleUpdateDuringAnimation = true;
          focusOnLayer(layer);
        }
      } catch (err) { /* ignore */ }

      // render left timeline and right info panels
      try { window.renderTimeline(displayName, items); } catch (err) { /* ignore */ }
      try { window.renderProvinceInfo(feature, items.length); } catch (err) { /* ignore */ }
      // Asynchronously fetch a short Wikipedia summary for this province and append a source link
      try {
        const rightContent = document.getElementById('rightContent');
        if (rightContent && typeof window.fetchWikiSummary === 'function') {
          const loadId = 'wiki_load_' + Date.now();
          rightContent.insertAdjacentHTML('beforeend', `<div id="${loadId}" class="wiki-loading">Đang tải tóm tắt từ Wikipedia...</div>`);
          window.fetchWikiSummary(displayName).then(w => {
            const node = document.getElementById(loadId);
            if (!w) {
              if (node) node.textContent = 'Không tìm thấy tóm tắt trên Wikipedia.';
              return;
            }
            const extract = w.extract ? (w.extract.length > 600 ? escapeHtml(w.extract.slice(0,600)) + '...' : escapeHtml(w.extract)) : '';
            const html = `<div class="wiki-summary"><h3>Tóm tắt Wikipedia</h3><div class="wiki-extract">${extract}</div><div class="meta-actions"><a class="visit-site" href="${w.url}" target="_blank" rel="noopener">Xem nguồn</a></div></div>`;
            if (node) node.outerHTML = html; else rightContent.insertAdjacentHTML('beforeend', html);
          }).catch(err => { const node = document.getElementById(loadId); if (node) node.textContent = 'Lỗi khi tải Wikipedia.'; });
        }
      } catch (err) { /* ignore */ }
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
      // If the map is currently moving/animating, queue the last-clicked event and
      // process it after movement completes. This avoids back-to-back flyTo calls
      // which cause jank on some devices.
      if (window._isMapMoving) {
        window._pendingEventSelection = event;
        // also update selectedEvent so UI shows immediate selection feedback
        selectedEvent = event;
        return;
      }
      selectedEvent = event; // track selected event
      const provinceNames = event._normProvinces || [];
      // clear any existing foreign marker when selecting a new event
      try {
        if (window._foreignMarker) {
          try { map.removeLayer(window._foreignMarker); } catch (e) {}
          window._foreignMarker = null;
        }
        if (window._foreignCircle) {
          try { map.removeLayer(window._foreignCircle); } catch (e) {}
          window._foreignCircle = null;
        }
      } catch (err) { /* ignore */ }
      if (event._isNational) {
        // select all provinces
        const allLayers = [];
        if (geojsonLayer) geojsonLayer.eachLayer(l => allLayers.push(l));
        selectMultipleFeatures(allLayers);
        // zoom to full extent
        if (window.map && geojsonLayer) {
          // use cached bounds if available to avoid recomputing
          const b = (event && event._cachedBounds) ? event._cachedBounds : (geojsonLayer.getBounds && geojsonLayer.getBounds());
          if (b) {
            suppressStyleUpdateDuringAnimation = true;
            window._isMapMoving = true;
            window.map.flyToBounds(b, { padding: [20,20], maxZoom: 6, duration: MAP_ANIMATION_DURATION });
            window.map.once('moveend', () => {
              suppressStyleUpdateDuringAnimation = false;
              window._isMapMoving = false;
              updateGeoStyle();
              selectedLayers.forEach(l => applySelectedStyle(l));
              // if user clicked another event while we were moving, process it now
              if (window._pendingEventSelection) {
                const p = window._pendingEventSelection;
                window._pendingEventSelection = null;
                window.selectEventProvinces(p);
              }
            });
          }
        }
        // render multi-province info
        if (typeof window.renderMultiProvinceInfo === 'function') {
          const allFeatures = allLayers.map(l => l.feature).filter(Boolean);
          window.renderMultiProvinceInfo(allFeatures, event);
        }
      } else {
        const layers = findLayersByProvinceNames(provinceNames);
        // If no matching province layers found, and the event appears to reference a
        // foreign location (contains parentheses like "(Trung Quốc)") or otherwise
        // cannot be mapped to provinces, try geocoding the support_label or province
        // and show a pin on the map instead of province highlighting.
        const isLikelyForeign = (() => {
          const probe = String(event.support_label || event.province || '').toLowerCase();
          return probe.includes('(') || probe.includes('thụy') || probe.includes('paris') || probe.includes('hong kong') || probe.includes('ma cao') || probe.includes('geneva') || probe.includes('brunei') || /\([^)]*\)/.test(String(event.province || ''));
        })();
        if ((!layers || layers.length === 0) && isLikelyForeign) {
          // ensure map clears any province selection
          deselectAllFeatures();
          // render right panel with foreign info
          if (typeof window.renderMultiProvinceInfo === 'function') {
            window.renderMultiProvinceInfo([], event);
          }
          // geocode and focus the foreign place (use support_label first)
          const label = event.support_label || event.province || '';
          if (label && typeof window.geocodeAndFocus === 'function') {
            window.geocodeAndFocus(label);
          }
          return;
        }
        selectMultipleFeatures(layers);
        // zoom to combined bounds of selected
        if (layers.length && window.map) {
          // use cached bounds when available
          const b = event && event._cachedBounds ? event._cachedBounds : (L.featureGroup(layers).getBounds());
          if (b) {
            suppressStyleUpdateDuringAnimation = true;
            window._isMapMoving = true;
            window.map.flyToBounds(b, { padding: [40,40], maxZoom: 8, duration: MAP_ANIMATION_DURATION });
            window.map.once('moveend', () => {
              suppressStyleUpdateDuringAnimation = false;
              window._isMapMoving = false;
              updateGeoStyle();
              selectedLayers.forEach(l => applySelectedStyle(l));
              if (window._pendingEventSelection) {
                const p = window._pendingEventSelection;
                window._pendingEventSelection = null;
                window.selectEventProvinces(p);
              }
            });
          }
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
          if (bounds) {
            window._isMapMoving = true;
            window.map.flyToBounds(bounds, { padding: [40,40], maxZoom: 9, duration: MAP_ANIMATION_DURATION });
            window.map.once('moveend', () => { window._isMapMoving = false; });
          }
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
          // Fetch a short Wikipedia summary (vi.wikipedia) and append a "Xem nguồn" link
          try {
            const rightContent = document.getElementById('rightContent');
            if (rightContent && typeof window.fetchWikiSummary === 'function') {
              const loadId = 'wiki_load_' + Date.now();
              rightContent.insertAdjacentHTML('beforeend', `<div id="${loadId}" class="wiki-loading">Đang tải tóm tắt từ Wikipedia...</div>`);
              window.fetchWikiSummary(displayName).then(w => {
                const node = document.getElementById(loadId);
                if (!w) {
                  if (node) node.textContent = 'Không tìm thấy tóm tắt trên Wikipedia.';
                  return;
                }
                const extract = w.extract ? (w.extract.length > 600 ? escapeHtml(w.extract.slice(0,600)) + '...' : escapeHtml(w.extract)) : '';
                const html = `<div class="wiki-summary"><h3>Tóm tắt Wikipedia</h3><div class="wiki-extract">${extract}</div><div class="meta-actions"><a class="visit-site" href="${w.url}" target="_blank" rel="noopener">Xem nguồn</a></div></div>`;
                if (node) node.outerHTML = html; else rightContent.insertAdjacentHTML('beforeend', html);
              }).catch(err => { const node = document.getElementById(loadId); if (node) node.textContent = 'Lỗi khi tải Wikipedia.'; });
            }
          } catch (err) { /* ignore */ }
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

  // Simple geocode + focus for foreign locations (uses Nominatim). Caches results.
  window._geocodeCache = window._geocodeCache || {};
  window.geocodeAndFocus = async function(query) {
    try {
      if (!query || !window.map) return;
      const key = String(query).trim();
      // use cache
      if (window._geocodeCache[key]) {
        const r = window._geocodeCache[key];
        showForeignPin(r.lat, r.lon, key);
        return r;
      }
      // call Nominatim
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(key);
      const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const json = await resp.json();
      if (!json || !json.length) return null;
      const top = json[0];
      window._geocodeCache[key] = { lat: parseFloat(top.lat), lon: parseFloat(top.lon), display: top.display_name };
      showForeignPin(parseFloat(top.lat), parseFloat(top.lon), key);
      return window._geocodeCache[key];
    } catch (err) { console.warn('geocodeAndFocus error', err); return null; }
  };

  // Wikipedia fetch (Vietnamese). Cache simple page summaries to enrich province info.
  window._wikiCache = window._wikiCache || {};
  window.fetchWikiSummary = async function(title) {
    try {
      if (!title) return null;
      const key = String(title).trim();
      if (window._wikiCache[key]) return window._wikiCache[key];
      // Try REST summary endpoint first
      const restUrl = 'https://vi.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(key);
      try {
        const r = await fetch(restUrl);
        if (r.ok) {
          const j = await r.json();
          const pageUrl = (j && j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) ? j.content_urls.desktop.page : ('https://vi.wikipedia.org/wiki/' + encodeURIComponent(j.title || key));
          const out = { title: j.title || key, extract: j.extract || '', url: pageUrl };
          window._wikiCache[key] = out;
          return out;
        }
      } catch (err) {
        // ignore and fall back to search
      }
      // fallback: use MediaWiki search API to find the best match, then request its summary
      const searchUrl = 'https://vi.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=' + encodeURIComponent(key) + '&srlimit=1';
      try {
        const s = await fetch(searchUrl);
        const js = await s.json();
        if (js && js.query && Array.isArray(js.query.search) && js.query.search.length) {
          const first = js.query.search[0];
          if (first && first.title) {
            return await window.fetchWikiSummary(first.title);
          }
        }
      } catch (err) { /* ignore */ }
      return null;
    } catch (err) { console.warn('fetchWikiSummary error', err); return null; }
  };

  // Image discovery using Wikimedia Commons (safe, attribution-friendly, no API key)
  // Cache results in window._imageCache to avoid repeated network calls
  window._imageCache = window._imageCache || {};
  // image metadata cache keyed by resolved safe_url
  window._imageMeta = window._imageMeta || {};
  // Optional Google Custom Search config (set these in console or a secure proxy)
  // Example: window._googleConfig = { key: 'YOUR_API_KEY', cx: 'YOUR_SEARCH_ENGINE_ID' };
  // WARNING: The API key and CX are embedded for demo purposes only.
  // Do NOT commit production keys to source control. Use a server-side proxy for real deployments.
  window._googleConfig = window._googleConfig || { key: 'AIzaSyCH-sk3CruotRQDJZMnHdQ_NnvAxVLBi_k', cx: 'b0a1adb011c72481d' };
  window.fetchImagesFromWikimedia = async function(query, limit = 8) {
    try {
      if (!query) return [];
      const key = String(query).trim();
      if (window._imageCache[key]) return window._imageCache[key];
      // Use MediaWiki API on Commons: search in file namespace (6) for images
      const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
        + '&generator=search&gsrsearch=' + encodeURIComponent(key)
        + '&gsrnamespace=6&gsrlimit=' + encodeURIComponent(limit)
        + '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640';
      const resp = await fetch(url);
      const json = await resp.json();
      const out = [];
      if (json && json.query && json.query.pages) {
        const pages = Object.values(json.query.pages);
        pages.forEach(p => {
          try {
            const info = (p.imageinfo && p.imageinfo[0]) || null;
            if (!info) return;
            const thumb = info.thumburl || null;
            const origUrl = info.url || null;
            // detect mime if present
            const mime = info.mime || info.mimetype || (info.extmetadata && info.extmetadata.MimeType && info.extmetadata.MimeType.value) || '';
            const isImageMime = typeof mime === 'string' && mime.toLowerCase().startsWith('image');
            // function to test image extension
            const hasImageExt = (u) => typeof u === 'string' && /\.(jpe?g|png|gif|webp|svg|avif|apng|bmp)(\?.*)?$/i.test(u);
            // avoid PDFs as main full-size URLs; prefer thumbnail if original is PDF
            const origIsPdf = typeof origUrl === 'string' && /\.pdf(\?.*)?$/i.test(origUrl);
            // choose a safe url for opening: prefer original if it's an image, otherwise thumb if available
            let safe = null;
            if (origUrl && (isImageMime || hasImageExt(origUrl)) && !origIsPdf) safe = origUrl;
            else if (thumb) safe = thumb;
            else if (origUrl && !origIsPdf) safe = origUrl;
            if (!safe) return; // skip items that cannot provide a displayable image
            const license = info.extmetadata && info.extmetadata.LicenseShortName && info.extmetadata.LicenseShortName.value || '';
            const artist = info.extmetadata && info.extmetadata.Artist && info.extmetadata.Artist.value || '';
            const credit = artist || (info.extmetadata && info.extmetadata.Credit && info.extmetadata.Credit.value) || '';
            const item = { title: p.title || '', url: origUrl, thumb: thumb || safe, safe_url: safe, license: license, credit: credit, source: 'commons' };
            // cache metadata by safe_url for gallery use
            if (item.safe_url) window._imageMeta[item.safe_url] = Object.assign({}, item);
            out.push(item);
          } catch (err) { /* ignore per-item */ }
        });
      }
      window._imageCache[key] = out;
      return out;
    } catch (err) { console.warn('fetchImagesFromWikimedia error', err); return []; }
  };

  // Fetch images using Google Custom Search API (image search). This requires
  // a valid API key and a Search Engine ID (cx). For security, do not embed
  // production keys in public sites; use a proxy. This function will return
  // items with safe_url/thumb/contextLink metadata when available.
  window.fetchImagesFromGoogle = async function(query, limit = 8) {
    try {
      const cfg = window._googleConfig || {};
      if (!cfg.key || !cfg.cx) return [];
      const key = cfg.key; const cx = cfg.cx;
      const num = Math.min(10, limit);
      const url = 'https://www.googleapis.com/customsearch/v1?key=' + encodeURIComponent(key)
        + '&cx=' + encodeURIComponent(cx)
        + '&q=' + encodeURIComponent(query)
        + '&searchType=image&num=' + encodeURIComponent(num);
      const resp = await fetch(url);
      const json = await resp.json();
      const out = [];
      if (json && Array.isArray(json.items)) {
        json.items.forEach(it => {
          try {
            // it.link is the image URL, it.image.thumbnailLink is thumbnail, it.image.contextLink is page
            const imgUrl = it.link || null;
            const thumb = (it.image && it.image.thumbnailLink) ? it.image.thumbnailLink : null;
            const context = (it.image && it.image.contextLink) ? it.image.contextLink : (it.link || null);
            // prefer direct image URLs; basic check to skip non-image links
            const hasImageExt = (u) => typeof u === 'string' && /\.(jpe?g|png|gif|webp|svg|avif|apng|bmp)(\?.*)?$/i.test(u);
            const safe = (imgUrl && hasImageExt(imgUrl)) ? imgUrl : (thumb || imgUrl);
            if (!safe) return;
            const item = { title: it.title || '', url: imgUrl, thumb: thumb || safe, safe_url: safe, contextLink: context, license: null, credit: null, source: 'google' };
            if (item.safe_url) window._imageMeta[item.safe_url] = Object.assign({}, item);
            out.push(item);
          } catch (err) { /* ignore item */ }
        });
      }
      return out;
    } catch (err) { console.warn('fetchImagesFromGoogle error', err); return []; }
  };

  // Convenience: fetch images for an event and append them to event.image_urls at runtime
  window.fetchImagesForEvent = async function(event, limit = 8) {
    try {
      if (!event) return [];
      const parts = [event.name || '', event.year ];
      const query = parts.filter(Boolean).join(' ');
      // Prefer Google if configured, otherwise fall back to Wikimedia Commons
      let imgs = [];
      try {
        const cfg = window._googleConfig || {};
        if (cfg.key && cfg.cx && typeof window.fetchImagesFromGoogle === 'function') {
          imgs = await window.fetchImagesFromGoogle(query, limit);
        }
      } catch (err) { imgs = []; }
      if ((!imgs || imgs.length === 0) && typeof window.fetchImagesFromWikimedia === 'function') {
        // imgs = await window.fetchImagesFromWikimedia(query, limit);
      }
      if (!imgs || !imgs.length) return [];
      // Return found image items; the caller will decide whether to append them
      // to event._auto_images (keeps original JSON images separate).
      return imgs;
    } catch (err) { console.warn('fetchImagesForEvent error', err); return []; }
  };

  function showForeignPin(lat, lon, label) {
    try {
      if (!window.map) return;
      const latlng = L.latLng(lat, lon);
      // remove previous
      // reuse existing marker/circle if present to avoid create/destroy overhead
      if (window._foreignMarker) {
        try { window._foreignMarker.setLatLng(latlng); } catch (e) {}
      } else {
        window._foreignMarker = L.marker(latlng, { riseOnHover: true }).addTo(map);
      }
      if (window._foreignCircle) {
        try { window._foreignCircle.setLatLng(latlng); } catch (e) {}
      } else {
        window._foreignCircle = L.circle(latlng, { radius: 30000, color: '#ff6b00', weight: 2, fill: false, interactive: false }).addTo(map);
      }
      window._foreignMarker.bindPopup(`<div style="min-width:140px"><strong>${escapeHtml(label)}</strong></div>`).openPopup();
      // center map so pin appears nicely centered with a little offset for panels (if any)
      try {
        const targetZoom = 6;
        window._isMapMoving = true;
        map.flyTo(latlng, targetZoom, { duration: MAP_ANIMATION_DURATION });
        map.once('moveend', () => {
          window._isMapMoving = false;
          if (window._pendingEventSelection) {
            const p = window._pendingEventSelection;
            window._pendingEventSelection = null;
            window.selectEventProvinces(p);
          }
        });
      } catch (err) {
        map.setView(latlng, 6);
      }
    } catch (err) { console.warn('showForeignPin error', err); }
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

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

      // Performance optimization: precompute and cache bounds for each geojson layer
      // and for each event (combined bounds). This avoids repeated expensive
      // getBounds() calculations on each click.
      try {
        if (geojsonLayer) {
          geojsonLayer.eachLayer(l => {
            try { l._cachedBounds = (l.getBounds && l.getBounds()) || null; } catch (e) { l._cachedBounds = null; }
          });
        }
        // compute event-level cached bounds (for multi-province events)
        if (Array.isArray(events)) {
          events.forEach(e => {
            try {
              if (e._isNational) {
                e._cachedBounds = geojsonLayer ? geojsonLayer.getBounds() : null;
                return;
              }
              const layers = findLayersByProvinceNames(e._normProvinces || []);
              if (layers && layers.length) {
                e._cachedBounds = L.featureGroup(layers).getBounds();
              } else {
                e._cachedBounds = null;
              }
            } catch (err) { e._cachedBounds = null; }
          });
        }
      } catch (err) { /* ignore */ }

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
          `<div><span class="box" style="background:${getColorForCount(1)}"></span> 1-2 sự kiện</div>` +
          `<div><span class="box" style="background:${getColorForCount(3)}"></span> 3-4 sự kiện</div>` +
          `<div><span class="box" style="background:${getColorForCount(5)}"></span> 5+ sự kiện</div>`;
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