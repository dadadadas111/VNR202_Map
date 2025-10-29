// ui-panels.js
// Simple global helpers to manage left (timeline) and right (info) panels.

(function () {
  function byId(id) { return document.getElementById(id); }

  // UI-only state: track selected event for visual highlight ONLY
  // This variable is NEVER reset, only updated when user clicks a different event
  let uiSelectedEvent = null;

  // Small localStorage-backed cache for auto-found images (events/provinces)
  // Keyed by 'evt:<name>|<year>' and 'prov:<ma_tinh or displayName>'
  const CACHE_KEY = 'vnr_auto_images_v1';
  window._autoImageCache = window._autoImageCache || {};

  function _loadAutoImageCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') window._autoImageCache = parsed;
    } catch (err) { console.warn('Failed to load auto image cache', err); }
  }
  function _saveAutoImageCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(window._autoImageCache || {})); } catch (err) { console.warn('Failed to save auto image cache', err); }
  }
  function _eventCacheKey(ev) {
    if (!ev) return null;
    const n = (ev.name || '').trim();
    const y = (ev.year || '').toString();
    return `evt:${n}|${y}`;
  }
  function _featureCacheKey(feature) {
    if (!feature || !feature.properties) return null;
    const p = feature.properties;
    const id = p.ma_tinh || p._displayName || p.ten_tinh || p.name || '';
    return `prov:${String(id).trim()}`;
  }
  function _getCacheForEvent(ev) { try { const k = _eventCacheKey(ev); return k && window._autoImageCache && window._autoImageCache[k] ? window._autoImageCache[k].slice() : null; } catch (e) { return null; } }
  function _setCacheForEvent(ev, arr) { try { const k = _eventCacheKey(ev); if (!k) return; window._autoImageCache = window._autoImageCache || {}; window._autoImageCache[k] = (arr || []).slice(); _saveAutoImageCache(); } catch (e) { } }
  function _getCacheForFeature(feature) { try { const k = _featureCacheKey(feature); return k && window._autoImageCache && window._autoImageCache[k] ? window._autoImageCache[k].slice() : null; } catch (e) { return null; } }
  function _setCacheForFeature(feature, arr) { try { const k = _featureCacheKey(feature); if (!k) return; window._autoImageCache = window._autoImageCache || {}; window._autoImageCache[k] = (arr || []).slice(); _saveAutoImageCache(); } catch (e) { } }

  // Load cache on startup
  try { _loadAutoImageCache(); } catch (e) { /* ignore */ }

  // Bubble management functions
  function showLeftBubble() {
    const bubble = byId('leftBubble');
    if (bubble) bubble.classList.add('visible');
  }
  function hideLeftBubble() {
    const bubble = byId('leftBubble');
    if (bubble) bubble.classList.remove('visible');
  }
  function showRightBubble() {
    const bubble = byId('rightBubble');
    if (bubble) bubble.classList.add('visible');
  }
  function hideRightBubble() {
    const bubble = byId('rightBubble');
    if (bubble) bubble.classList.remove('visible');
  }

  window.panels = {
    openLeft: function (htmlContent) {
      if (isMobile()) return showMobileOverlay();
      const p = byId('leftPanel');
      const c = byId('leftContent');
      if (c) c.innerHTML = htmlContent || '';
      if (p) p.classList.add('open');
      hideLeftBubble(); // Hide bubble when panel opens
    },
    closeLeft: function () {
      const p = byId('leftPanel');
      if (p) p.classList.remove('open');
      showLeftBubble(); // Show bubble when panel closes
    },
    openRight: function (htmlContent) {
      if (isMobile()) return showMobileOverlay();
      const p = byId('rightPanel');
      const c = byId('rightContent');
      if (c) c.innerHTML = htmlContent || '';
      if (p) p.classList.add('open');
      hideRightBubble(); // Hide bubble when panel opens
    },
    closeRight: function () {
      const p = byId('rightPanel');
      if (p) p.classList.remove('open');
      showRightBubble(); // Show bubble when panel closes
    }
  };

  // wire close buttons and bubble buttons
  document.addEventListener('DOMContentLoaded', () => {
    const closeLeft = byId('closeLeft');
    const closeRight = byId('closeRight');
    const leftBubble = byId('leftBubble');
    const rightBubble = byId('rightBubble');

    if (closeLeft) closeLeft.addEventListener('click', () => panels.closeLeft());
    if (closeRight) closeRight.addEventListener('click', () => panels.closeRight());

    // Wire bubble clicks to reopen panels
    if (leftBubble) {
      leftBubble.addEventListener('click', () => {
        // Reopen the left panel with last content
        const p = byId('leftPanel');
        if (p) {
          p.classList.add('open');
          hideLeftBubble();
        }
      });
    }

    if (rightBubble) {
      rightBubble.addEventListener('click', () => {
        // Reopen the right panel with last content
        const p = byId('rightPanel');
        if (p) {
          p.classList.add('open');
          hideRightBubble();
        }
      });
    }

    // Show bubbles initially (panels are closed by default)
    showLeftBubble();
    showRightBubble();
  });

  // Mobile overlay helpers
  function isMobile() {
    try { return window.matchMedia && window.matchMedia('(max-width: 800px)').matches; } catch (err) { return (window.innerWidth || 0) <= 800; }
  }

  function createMobileOverlay() {
    if (byId('mobileOverlay')) return;
    const o = document.createElement('div');
    o.id = 'mobileOverlay';
    o.className = 'mobile-overlay';
    o.innerHTML = `
      <div class="mobile-overlay-inner">
        <h2>Phiên bản di động chưa hỗ trợ</h2>
        <p>Hiện tại giao diện phân tích chi tiết (tabs trái/phải) chưa hỗ trợ trên màn hình nhỏ. Vui lòng dùng màn hình lớn hơn (máy tính hoặc tablet ở chế độ ngang).</p>
        <div class="mobile-actions"><button id="mobileDismiss">Đóng và tiếp tục (không hỗ trợ)</button></div>
      </div>`;
    document.body.appendChild(o);
    const btn = byId('mobileDismiss');
    if (btn) btn.addEventListener('click', () => { o.style.display = 'none'; });
  }

  function showMobileOverlay() {
    createMobileOverlay();
    const o = byId('mobileOverlay');
    if (o) o.style.display = 'flex';
    return true;
  }

  // show overlay automatically on mobile load
  document.addEventListener('DOMContentLoaded', () => {
    if (isMobile()) showMobileOverlay();
  });

  // helpers to render timeline items and province info
  window.renderTimeline = function (provinceDisplayName, eventsArray) {
    if (!eventsArray || eventsArray.length === 0) {
      panels.openLeft('<div class="empty">Không có sự kiện trong giai đoạn này.</div>');
      return;
    }
    let html = `<div class="timeline-title">Sự kiện tại <strong>${provinceDisplayName}</strong> (${eventsArray.length})</div>`;
    html += '<ol class="timeline-list">';
    const sorted = eventsArray.slice().sort((a, b) => a.year - b.year);
    sorted.forEach((ev, idx) => {
      // Restore cached auto images for this event if present
      try {
        if ((!ev._auto_images || !ev._auto_images.length) && typeof _getCacheForEvent === 'function') {
          const cached = _getCacheForEvent(ev);
          if (cached && cached.length) ev._auto_images = cached.slice();
        }
      } catch (e) { /* ignore */ }
      const imgs = ev.image_urls || [];
      const autoImgs = ev._auto_images || [];
      // Add timeline-clickable class for hover + selection
      html += `<li class="timeline-item timeline-clickable" data-evt-idx="${idx}">`;
      html += `<div class="timeline-main"><span class="t-year">${ev.year}</span> <strong>${ev.name}</strong></div>`;
      html += `<div class="t-desc">${ev.description}</div>`;
      // scope / phạm vi: prefer support_label if present, otherwise fall back to province
      let scopeLabel = '';
      if (ev.support_label) {
        const s = String(ev.support_label).trim();
        if (s.toLowerCase().includes('cả nước') || s.toLowerCase().includes('ca nuoc')) scopeLabel = 'Cả nước';
        else scopeLabel = s;
      } else if (ev.province) {
        const raw = String(ev.province).trim();
        if (raw.toLowerCase().includes('cả nước') || raw.toLowerCase().includes('ca nuoc')) scopeLabel = 'Cả nước';
        else scopeLabel = raw;
      }
      if (scopeLabel) html += `<div class="t-scope"><strong>Phạm vi:</strong> ${scopeLabel}</div>`;
      // images row (original images from JSON) placed below description, show up to 3
      if (imgs && imgs.length) {
        html += `<div class="event-image-row">`;
        const show = Math.min(3, imgs.length);
        for (let i = 0; i < show; i++) {
          const url = imgs[i];
          const extra = (i === 2 && imgs.length > 3) ? imgs.length - 3 : 0;
          html += `<div class="event-image-wrap">`;
          html += `<img src="${url}" class="event-thumb" data-idx="${idx}" data-img-index="${i}" data-source="original" />`;
          if (extra) html += `<div class="image-overlay">+${extra}</div>`;
          html += `</div>`;
        }
        html += `</div>`;
      }
      // note: 'find images' control moved to the right panel; keep a subtle hint for selected items
      // no left-panel image controls or warnings here (moved to right panel)
      // auto-found images (kept separate so we don't mix with original JSON images)
      if (autoImgs && autoImgs.length) {
        html += `<div class="event-auto-header">Ảnh tìm tự động (${autoImgs.length})</div>`;
        html += `<div class="event-image-row auto-row">`;
        autoImgs.slice(0, 3).forEach((url, ai) => {
          const extraAuto = (ai === 2 && autoImgs.length > 3) ? autoImgs.length - 3 : 0;
          html += `<div class="event-image-wrap">`;
          html += `<img src="${url}" class="event-thumb" data-idx="${idx}" data-img-index="${ai}" data-source="auto" />`;
          if (extraAuto) html += `<div class="image-overlay">+${extraAuto}</div>`;
          html += `</div>`;
        });
        html += `</div>`;
      }
      html += `</li>`;
    });
    html += '</ol>';
    panels.openLeft(html);

    // wire thumbnail clicks to open gallery and event item selection
    setTimeout(() => {
      const container = document.getElementById('leftContent');
      if (!container) return;
      container.querySelectorAll('.event-thumb').forEach(img => {
        // thumbnail error handling: replace broken thumb with placeholder and mark as broken
        img.addEventListener('error', () => {
          try { img.classList.add('thumb-broken'); img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="100%" height="100%" fill="%23eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23888" font-size="12">Không tải được</text></svg>'; } catch (e) { }
        });
        img.addEventListener('click', (e) => {
          e.stopPropagation(); // Don't trigger parent timeline-item click
          const idx = Number(img.getAttribute('data-idx')) || 0;
          const imgIndex = Number(img.getAttribute('data-img-index')) || 0;
          const source = img.getAttribute('data-source') || 'original';
          const items = sorted; // use the locally sorted array
          const event = items[idx];
          if (!event) return;
          // build gallery list: original images first, then auto images
          const base = (event.image_urls && event.image_urls.slice()) || [];
          const auto = (event._auto_images && event._auto_images.slice()) || [];
          const imgsList = base.concat(auto);
          if (!imgsList || !imgsList.length) return;
          // determine index in imgsList for clicked thumbnail
          let indexInList = 0;
          if (source === 'original') {
            indexInList = Math.min(imgIndex, base.length - 1);
          } else {
            indexInList = base.length + imgIndex;
          }
          showImageGallery(imgsList, indexInList);
        });
      });

      // wire event item clicks for selection highlight + province highlighting
      container.querySelectorAll('.timeline-clickable').forEach((item, idx) => {
        item.addEventListener('click', (e) => {
          // Remove previous selection highlight
          container.querySelectorAll('.timeline-item').forEach(el => el.classList.remove('selected'));
          // Mark current item as selected
          item.classList.add('selected');

          // Scroll the selected timeline item to the top of the scroll container
          try { item.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (err) { /* ignore */ }

          // Get event and trigger province highlighting on map
          const event = sorted[idx];
          if (event) {
            // Update UI-only selection state (never reset)
            uiSelectedEvent = event;
            // Trigger map highlighting
            if (typeof window.selectEventProvinces === 'function') {
              window.selectEventProvinces(event);
            }
          }
        });
      });

      // Note: image lookup moved to right panel (auto-search on event selection)

      // Restore selection state from uiSelectedEvent
      if (uiSelectedEvent) {
        container.querySelectorAll('.timeline-clickable').forEach((item, idx) => {
          const event = sorted[idx];
          if (event && event.name === uiSelectedEvent.name && event.year === uiSelectedEvent.year) {
            item.classList.add('selected');
            try { item.scrollIntoView({ behavior: 'auto', block: 'start' }); } catch (err) { }
          }
        });
      }
    }, 10);
  };

  // NEW: Render timeline for all events in a period (not tied to a single province)
  window.renderAllEventsTimeline = function (eventsArray, periodKey) {
    if (!eventsArray || eventsArray.length === 0) {
      panels.openLeft('<div class="empty">Không có sự kiện trong giai đoạn này.</div>');
      return;
    }
    let html = `<div class="timeline-title">Tất cả sự kiện giai đoạn hiện tại (${eventsArray.length})</div>`;
    html += '<ol class="timeline-list timeline-all">';
    const sorted = eventsArray.slice().sort((a, b) => a.year - b.year);
    sorted.forEach((ev, idx) => {
      // Restore cached auto images for this event if present
      try {
        if ((!ev._auto_images || !ev._auto_images.length) && typeof _getCacheForEvent === 'function') {
          const cached = _getCacheForEvent(ev);
          if (cached && cached.length) ev._auto_images = cached.slice();
        }
      } catch (e) { /* ignore */ }
      const imgs = ev.image_urls || [];
      html += `<li class="timeline-item timeline-clickable" data-evt-idx="${idx}">`;
      html += `<div class="timeline-main"><span class="t-year">${ev.year}</span> <strong>${ev.name}</strong></div>`;
      html += `<div class="t-desc">${ev.description}</div>`;
      // scope: prefer support_label if present, otherwise fall back to province
      let scopeLabel = '';
      if (ev.support_label) {
        const s = String(ev.support_label).trim();
        if (s.toLowerCase().includes('cả nước') || s.toLowerCase().includes('ca nuoc')) scopeLabel = 'Cả nước';
        else scopeLabel = s;
      } else if (ev.province) {
        const raw = String(ev.province).trim();
        if (raw.toLowerCase().includes('cả nước') || raw.toLowerCase().includes('ca nuoc')) scopeLabel = 'Cả nước';
        else scopeLabel = raw;
      }
      if (scopeLabel) html += `<div class="t-scope"><strong>Phạm vi:</strong> ${scopeLabel}</div>`;
      // images
      if (imgs && imgs.length) {
        html += `<div class="event-image-row">`;
        const show = Math.min(3, imgs.length);
        for (let i = 0; i < show; i++) {
          const url = imgs[i];
          const extra = (i === 2 && imgs.length > 3) ? imgs.length - 3 : 0;
          html += `<div class="event-image-wrap">`;
          html += `<img src="${url}" class="event-thumb" data-idx="${idx}" data-img-index="${i}" />`;
          if (extra) html += `<div class="image-overlay">+${extra}</div>`;
          html += `</div>`;
        }
        html += `</div>`;
      }
      html += `</li>`;
    });
    html += '</ol>';
    panels.openLeft(html);

    // wire thumbnail clicks
    setTimeout(() => {
      const container = document.getElementById('leftContent');
      if (!container) return;
      container.querySelectorAll('.event-thumb').forEach(img => {
        img.addEventListener('error', () => {
          try { img.classList.add('thumb-broken'); img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="100%" height="100%" fill="%23eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23888" font-size="12">Không tải được</text></svg>'; } catch (e) { }
        });
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = Number(img.getAttribute('data-idx')) || 0;
          const imgIndex = Number(img.getAttribute('data-img-index')) || 0;
          const source = img.getAttribute('data-source') || 'original';
          const event = sorted[idx];
          if (!event) return;
          const base = (event.image_urls && event.image_urls.slice()) || [];
          const auto = (event._auto_images && event._auto_images.slice()) || [];
          const imgsList = base.concat(auto);
          if (!imgsList || !imgsList.length) return;
          let indexInList = 0;
          if (source === 'original') indexInList = Math.min(imgIndex, base.length - 1);
          else indexInList = base.length + imgIndex;
          showImageGallery(imgsList, indexInList);
        });
      });
      // wire event item clicks to select provinces
      container.querySelectorAll('.timeline-clickable').forEach((item, idx) => {
        item.addEventListener('click', (e) => {
          // Remove previous selection highlight
          container.querySelectorAll('.timeline-item').forEach(el => el.classList.remove('selected'));
          // Mark current item as selected
          item.classList.add('selected');

          // Scroll selected item so it's aligned to the top of the scroll container
          try { item.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (err) { }

          const event = sorted[idx];
          if (event) {
            // Update UI-only selection state (never reset)
            uiSelectedEvent = event;
            // Trigger map highlighting
            if (typeof window.selectEventProvinces === 'function') {
              window.selectEventProvinces(event);
            }
          }
        });
      });
      // (no find-images button here; images are fetched/displayed in the right panel)

      // Restore selection state from uiSelectedEvent
      if (uiSelectedEvent) {
        container.querySelectorAll('.timeline-clickable').forEach((item, idx) => {
          const event = sorted[idx];
          if (event && event.name === uiSelectedEvent.name && event.year === uiSelectedEvent.year) {
            item.classList.add('selected');
            try { item.scrollIntoView({ behavior: 'auto', block: 'start' }); } catch (err) { }
          }
        });
      }
    }, 10);
  };

  window.renderProvinceInfo = function (feature, eventsCount) {
    const p = feature && feature.properties;
    const displayName = (p && (p._displayName || p.ten_tinh || p.name)) || 'Không rõ';
    let html = `<div class="info-title">${displayName}</div>`;
    html += '<div class="info-meta">';
    if (p && p.ma_tinh) html += `<div><strong>Mã tỉnh:</strong> ${p.ma_tinh}</div>`;
    if (p && p.loai) html += `<div><strong>Loại:</strong> ${p.loai}</div>`;
    html += `<div><strong>Số sự kiện (giai đoạn):</strong> ${eventsCount}</div>`;
    html += '</div>';
    html += `<div class="info-desc">${p && p.ghichu ? p.ghichu : ''}</div>`;
    panels.openRight(html);

    // Automatically fetch and display images related to this province when showing province info.
    // Reuse existing global helpers: window.fetchImagesFromWikimedia / window.fetchImagesFromGoogle
    // Cache results on feature._auto_images to avoid refetching.
    setTimeout(async () => {
      try {
        const rightContent = document.getElementById('rightContent');
        if (!rightContent) return;
        // If already fetched, render thumbnails immediately
        if (feature._auto_images && feature._auto_images.length) {
          renderProvinceImages(feature, rightContent);
          return;
        }

        // Insert a lightweight loading placeholder
        const loadId = 'prov_img_load_' + Date.now();
        const loadNode = document.createElement('div');
        loadNode.id = loadId;
        loadNode.className = 'province-image-loading';
        loadNode.textContent = 'Đang tìm hình ảnh liên quan...';
        rightContent.appendChild(loadNode);

        let found = [];
        // Improve query quality: try a few prioritized queries that bias toward
        // landscape / place / landmark images in Vietnamese. This helps return
        // photos of the province (scenery, city, monument) rather than unrelated items.
        const queryVariants = [
          `${displayName} danh lam thắng cảnh`,
          `${displayName} di tích lịch sử`,
          `${displayName} phong cảnh`,
          `${displayName} địa danh`,
          `${displayName}`
        ];

        // Prefer Google (if configured) because you requested Google as primary source.
        if (window._googleConfig && typeof window.fetchImagesFromGoogle === 'function') {
          for (let q of queryVariants) {
            try {
              const r = await window.fetchImagesFromGoogle(q, 6);
              if (r && r.length) { found = r; break; }
            } catch (err) { /* ignore and try next */ }
          }
        }

        // If Google didn't return results, fall back to Wikimedia Commons
        if ((!found || found.length === 0) && typeof window.fetchImagesFromWikimedia === 'function') {
          for (let q of queryVariants) {
            try {
              const r = await window.fetchImagesFromWikimedia(q, 6);
              if (r && r.length) { found = r; break; }
            } catch (err) { /* ignore and try next */ }
          }
        }

        // Remove loading node
        try { const n = document.getElementById(loadId); if (n) n.remove(); } catch (e) { }

        if (found && found.length) {
          // Normalize to URL array (prefer safe_url then url)
          feature._auto_images = feature._auto_images || [];
          const baseSet = new Set((feature._auto_images || []).map(u => String(u)));
          found.forEach(it => {
            const u = (it && it.safe_url) ? it.safe_url : (it && it.url) ? it.url : null;
            if (!u) return;
            if (!baseSet.has(u) && feature._auto_images.indexOf(u) === -1) feature._auto_images.push(u);
            // Save metadata cache for gallery
            try { if (window._imageMeta && u) window._imageMeta[u] = Object.assign({}, it, { safe_url: u }); } catch (e) { }
          });
          try { if (typeof _setCacheForFeature === 'function') _setCacheForFeature(feature, feature._auto_images); } catch (e) { }
          renderProvinceImages(feature, rightContent);
        } else {
          // show a subtle note when no images found
          const note = document.createElement('div');
          note.className = 'no-prov-images';
          note.textContent = 'Không tìm thấy hình ảnh liên quan.';
          rightContent.appendChild(note);
        }
      } catch (err) {
        console.warn('Auto fetch province images failed', err);
      }
    }, 20);
  };

  // Helper to render province images block into the right panel
  function renderProvinceImages(feature, rightContent) {
    try {
      if (!feature || !feature._auto_images || !feature._auto_images.length) return;
      // Remove existing province-image-row if present
      const existing = rightContent.querySelector('.province-image-row');
      if (existing) existing.remove();

      const imgs = feature._auto_images.slice(0, 6);
      // reuse existing horizontal image row styles by including 'event-image-row'
      const container = document.createElement('div'); container.className = 'event-image-row province-image-row';
      const header = document.createElement('div'); header.className = 'province-image-header'; header.textContent = `Ảnh liên quan (${feature._auto_images.length})`;
      rightContent.appendChild(header);
      rightContent.appendChild(container);

      // show up to 3 thumbnails and overlay +n if more
      imgs.slice(0, 3).forEach((u, i) => {
        const wrap = document.createElement('div'); wrap.className = 'event-image-wrap';
        const img = document.createElement('img'); img.className = 'event-thumb'; img.src = u; img.setAttribute('data-prov-img-index', i);
        img.onerror = () => { try { img.classList.add('thumb-broken'); img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="100%" height="100%" fill="%23eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23888" font-size="12">Không tải được</text></svg>'; } catch (e) { } };
        wrap.appendChild(img);
        const extra = (i === 2 && feature._auto_images.length > 3) ? feature._auto_images.length - 3 : 0;
        if (extra) {
          const ov = document.createElement('div'); ov.className = 'image-overlay'; ov.textContent = `+${extra}`; wrap.appendChild(ov);
        }
        container.appendChild(wrap);
        img.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const imgsList = feature._auto_images.slice();
          // open gallery at the clicked index
          const idx = i;
          if (typeof showImageGallery === 'function') showImageGallery(imgsList, idx);
        });
      });
      // Ensure right panel is visible when images are rendered
      try {
        const rp = document.getElementById('rightPanel');
        if (rp && !rp.classList.contains('open')) { rp.classList.add('open'); hideRightBubble(); }
      } catch (e) { /* ignore */ }
    } catch (err) { /* ignore render errors */ }
  }

  // NEW: Render info for multiple provinces (when event is selected)
  window.renderMultiProvinceInfo = function (features, event) {
    if (!features || features.length === 0) {
      panels.openRight('<div class="empty">Không có thông tin.</div>');
      return;
    }
    let html = '';
    if (event && event.name) html += `<div class="info-title"><strong>Sự kiện:</strong> ${event.name} (${event.year})</div>`;
        html += `<div class="info-separator"></div>`;
    html += '<div class="event-image-block"></div>';
    html += '<ul class="province-list">';
    // horizontal line separator
    html += `<div class="info-separator"></div>`;
    html += `<div class="info-title">Các tỉnh liên quan</div> <br>`;
    html += `<div class="info-meta"><strong>Số tỉnh:</strong> ${features.length}</div>`;
    // placeholder for event images (will be rendered above the province list)

    features.forEach(f => {
      const p = f.properties;
      const dName = (p && (p._displayName || p.ten_tinh || p.name)) || 'Không rõ';
      const code = p && p.ma_tinh ? ` (${p.ma_tinh})` : '';
      html += `<li><a href="#" class="province-link" data-province="${dName}">${dName}${code}</a></li>`;
    });
    html += '</ul>';
    panels.openRight(html);

    // Wire up province links after rendering
    setTimeout(() => {
      const rightContent = document.getElementById('rightContent');
      if (!rightContent) return;
      rightContent.querySelectorAll('.province-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const prov = link.getAttribute('data-province');
          if (prov && typeof window.selectSingleProvince === 'function') {
            window.selectSingleProvince(prov);
          }
        });
      });

      // Automatically fetch images related to the selected event and render them
      (async () => {
        try {
          if (!event) return;
          // If already present, render immediately into the image block
          if (event._auto_images && event._auto_images.length) {
            const imgBlock = rightContent.querySelector('.event-image-block') || rightContent;
            renderEventImages(event, imgBlock);
            return;
          }
          // Insert loading placeholder
          const loadId = 'event_img_load_' + Date.now();
          const loadNode = document.createElement('div');
          loadNode.id = loadId; loadNode.className = 'province-image-loading'; loadNode.textContent = 'Đang tìm hình ảnh liên quan...';
          rightContent.appendChild(loadNode);

          let found = [];
          // Use existing helper which prefers Google when configured
          if (typeof window.fetchImagesForEvent === 'function') {
            try { found = await window.fetchImagesForEvent(event, 6); } catch (err) { found = []; }
          }
          // remove loader
          try { const n = document.getElementById(loadId); if (n) n.remove(); } catch (e) { }

          if (found && found.length) {
            event._auto_images = event._auto_images || [];
            const baseSet = new Set((event.image_urls || []).map(u => String(u)));
            found.forEach(it => {
              const u = (it && it.safe_url) ? it.safe_url : (it && it.url) ? it.url : null;
              if (!u) return;
              if (!baseSet.has(u) && event._auto_images.indexOf(u) === -1) event._auto_images.push(u);
              try { if (window._imageMeta && u) window._imageMeta[u] = Object.assign({}, it, { safe_url: u }); } catch (e) { }
            });
            try { if (typeof _setCacheForEvent === 'function') _setCacheForEvent(event, event._auto_images); } catch (e) { }
            // render into the dedicated image block above provinces
            const imgBlock = rightContent.querySelector('.event-image-block') || rightContent;
            renderEventImages(event, imgBlock);
          } else {
            const note = document.createElement('div'); note.className = 'no-prov-images'; note.textContent = 'Không tìm thấy hình ảnh liên quan.'; const imgBlock = rightContent.querySelector('.event-image-block') || rightContent; imgBlock.appendChild(note);
          }
        } catch (err) { console.warn('Auto fetch event images failed', err); }
      })();
    }, 10);
  };

  // Render images for a selected event into the right panel
  function renderEventImages(event, rightContent) {
    try {
      if (!event || !rightContent) return;
      // If rightContent is the whole panel, try to find the block
      const block = (rightContent.classList && rightContent.classList.contains('event-image-block')) ? rightContent : (rightContent.querySelector ? rightContent.querySelector('.event-image-block') : null) || rightContent;
      // clear previous contents
      try { block.innerHTML = ''; } catch (e) { }

      // header (style similar to 'Các tỉnh liên quan')
      const header = document.createElement('div'); header.className = 'info-title'; header.textContent = `Ảnh liên quan (${(event._auto_images || []).length})`;
      block.appendChild(header);

      const imgs = (event._auto_images || []).slice(0, 6);
      const container = document.createElement('div'); container.className = 'event-image-row province-image-row';
      block.appendChild(container);
      imgs.slice(0, 3).forEach((u, i) => {
        const wrap = document.createElement('div'); wrap.className = 'event-image-wrap';
        const img = document.createElement('img'); img.className = 'event-thumb'; img.src = u;
        img.onerror = () => { try { img.classList.add('thumb-broken'); img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="100%" height="100%" fill="%23eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23888" font-size="12">Không tải được</text></svg>'; } catch (e) { } };
        wrap.appendChild(img);
        const extra = (i === 2 && (event._auto_images || []).length > 3) ? (event._auto_images.length - 3) : 0;
        if (extra) { const ov = document.createElement('div'); ov.className = 'image-overlay'; ov.textContent = `+${extra}`; wrap.appendChild(ov); }
        container.appendChild(wrap);
        img.addEventListener('click', (ev) => { ev.stopPropagation(); const imgsList = (event.image_urls || []).concat(event._auto_images || []); const idx = imgsList.indexOf(u); if (typeof showImageGallery === 'function') showImageGallery(imgsList, idx >= 0 ? idx : 0); });
      });

      // warning note goes below the images
      const warn = document.createElement('div'); warn.className = 'auto-image-warning'; warn.style.marginTop = '8px'; warn.textContent = 'Lưu ý: ảnh tìm tự động, có thể không chính xác.';
      block.appendChild(warn);

      // Auto-open right panel so user sees the images
      try { const rp = document.getElementById('rightPanel'); if (rp && !rp.classList.contains('open')) { rp.classList.add('open'); hideRightBubble(); } } catch (e) { }
    } catch (err) { /* ignore */ }
  }

  // Image gallery modal
  function createGalleryModal() {
    if (document.getElementById('imageGalleryModal')) return;
    const m = document.createElement('div');
    m.id = 'imageGalleryModal';
    m.className = 'image-modal';
    m.innerHTML = `
      <div class="image-modal-inner">
        <button id="imgClose" class="img-close">✕</button>
        <button id="imgPrev" class="img-prev">◀</button>
        <div id="imgFrame" class="img-frame"></div>
        <div id="imgMeta" class="img-meta"></div>
        <button id="imgNext" class="img-next">▶</button>
      </div>`;
    document.body.appendChild(m);
    document.getElementById('imgClose').addEventListener('click', () => m.style.display = 'none');
    document.getElementById('imgPrev').addEventListener('click', () => galleryPrev());
    document.getElementById('imgNext').addEventListener('click', () => galleryNext());
    document.addEventListener('keydown', (e) => {
      if (m.style.display !== 'flex') return;
      if (e.key === 'Escape') m.style.display = 'none';
      if (e.key === 'ArrowLeft') galleryPrev();
      if (e.key === 'ArrowRight') galleryNext();
    });
  }

  let galleryImages = [];
  let galleryIndex = 0;

  function showImageGallery(images, startIndex) {
    createGalleryModal();
    galleryImages = images || [];
    galleryIndex = Math.max(0, Math.min((startIndex || 0), galleryImages.length - 1));
    const m = document.getElementById('imageGalleryModal');
    const frame = document.getElementById('imgFrame');
    const meta = document.getElementById('imgMeta');
    if (!m || !frame) return;
    const url = galleryImages[galleryIndex];
    // If the URL looks like a PDF, embed as object with fallback link; otherwise show an image
    if (typeof url === 'string' && /\.pdf(\?.*)?$/i.test(url)) {
      frame.innerHTML = `<div class="pdf-preview"><object data="${url}" type="application/pdf" width="100%" height="480">Không thể hiển thị PDF. <a href="${url}" target="_blank" rel="noopener">Mở tệp</a></object></div>`;
    } else {
      const img = document.createElement('img'); img.className = 'gallery-img'; img.src = url;
      img.onerror = function () {
        // show fallback link if image fails to load
        frame.innerHTML = `<div class="img-error">Không thể tải ảnh. <a href="${url}" target="_blank" rel="noopener">Mở liên kết</a></div>`;
      };
      frame.innerHTML = '';
      frame.appendChild(img);
    }
    // render metadata (if available)
    if (meta) {
      meta.innerHTML = '';
      try {
        const mm = (window._imageMeta && window._imageMeta[url]) || null;
        if (mm) {
          const title = mm.title || '';
          const license = mm.license || '';
          const credit = mm.credit || '';
          const context = mm.contextLink || mm.url || '';
          const source = mm.source || '';
          let seg = `<div class="meta-title">${title}</div>`;
          seg += `<div class="meta-source">Nguồn: ${source} ${context ? ` - <a href="${context}" target="_blank" rel="noopener">Trang nguồn</a>` : ''}</div>`;
          if (credit) seg += `<div class="meta-credit">Tác giả: ${credit}</div>`;
          if (license) seg += `<div class="meta-license">Bản quyền: ${license}</div>`;
          // visit site button
          if (context) seg += `<div class="meta-actions"><a class="visit-site" href="${context}" target="_blank" rel="noopener">Visit site</a></div>`;
          meta.innerHTML = seg;
        }
      } catch (err) { /* ignore metadata errors */ }
    }
    m.style.display = 'flex';
  }

  function galleryPrev() { if (galleryImages.length === 0) return; galleryIndex = (galleryIndex - 1 + galleryImages.length) % galleryImages.length; document.getElementById('imgFrame').innerHTML = `<img src="${galleryImages[galleryIndex]}" class="gallery-img" />`; }
  function galleryNext() { if (galleryImages.length === 0) return; galleryIndex = (galleryIndex + 1) % galleryImages.length; document.getElementById('imgFrame').innerHTML = `<img src="${galleryImages[galleryIndex]}" class="gallery-img" />`; }
  // Update prev/next to refresh metadata as well
  const _oldPrev = galleryPrev;
  const _oldNext = galleryNext;
  function _refreshGalleryMeta() {
    try {
      const url = galleryImages[galleryIndex];
      const meta = document.getElementById('imgMeta');
      const frame = document.getElementById('imgFrame');
      if (!frame) return;
      // reuse showImageGallery logic for display: set frame content and meta
      if (typeof url === 'string' && /\.pdf(\?.*)?$/i.test(url)) {
        frame.innerHTML = `<div class="pdf-preview"><object data="${url}" type="application/pdf" width="100%" height="480">Không thể hiển thị PDF. <a href="${url}" target="_blank" rel="noopener">Mở tệp</a></object></div>`;
      } else {
        const img = document.createElement('img'); img.className = 'gallery-img'; img.src = url;
        img.onerror = function () { frame.innerHTML = `<div class="img-error">Không thể tải ảnh. <a href="${url}" target="_blank" rel="noopener">Mở liên kết</a></div>`; };
        frame.innerHTML = ''; frame.appendChild(img);
      }
      if (meta) {
        meta.innerHTML = '';
        const mm = (window._imageMeta && window._imageMeta[url]) || null;
        if (mm) {
          const title = mm.title || '';
          const license = mm.license || '';
          const credit = mm.credit || '';
          const context = mm.contextLink || mm.url || '';
          const source = mm.source || '';
          let seg = `<div class="meta-title">${title}</div>`;
          seg += `<div class="meta-source">Nguồn: ${source} ${context ? ` - <a href="${context}" target="_blank" rel="noopener">Trang nguồn</a>` : ''}</div>`;
          if (credit) seg += `<div class="meta-credit">Tác giả: ${credit}</div>`;
          if (license) seg += `<div class="meta-license">Bản quyền: ${license}</div>`;
          if (context) seg += `<div class="meta-actions"><a class="visit-site" href="${context}" target="_blank" rel="noopener">Visit site</a></div>`;
          meta.innerHTML = seg;
        }
      }
    } catch (err) { /* ignore */ }
  }
  function galleryPrev() { if (galleryImages.length === 0) return; galleryIndex = (galleryIndex - 1 + galleryImages.length) % galleryImages.length; _refreshGalleryMeta(); }
  function galleryNext() { if (galleryImages.length === 0) return; galleryIndex = (galleryIndex + 1) % galleryImages.length; _refreshGalleryMeta(); }
})();
