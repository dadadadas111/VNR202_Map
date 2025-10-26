// ui-panels.js
// Simple global helpers to manage left (timeline) and right (info) panels.

(function () {
  function byId(id) { return document.getElementById(id); }
  
  // UI-only state: track selected event for visual highlight ONLY
  // This variable is NEVER reset, only updated when user clicks a different event
  let uiSelectedEvent = null;

  window.panels = {
    openLeft: function (htmlContent) {
      if (isMobile()) return showMobileOverlay();
      const p = byId('leftPanel');
      const c = byId('leftContent');
      if (c) c.innerHTML = htmlContent || '';
      if (p) p.classList.add('open');
    },
    closeLeft: function () {
      const p = byId('leftPanel'); if (p) p.classList.remove('open');
    },
    openRight: function (htmlContent) {
      if (isMobile()) return showMobileOverlay();
      const p = byId('rightPanel');
      const c = byId('rightContent');
      if (c) c.innerHTML = htmlContent || '';
      if (p) p.classList.add('open');
    },
    closeRight: function () { const p = byId('rightPanel'); if (p) p.classList.remove('open'); }
  };

  // wire close buttons
  document.addEventListener('DOMContentLoaded', () => {
    const closeLeft = byId('closeLeft');
    const closeRight = byId('closeRight');
    if (closeLeft) closeLeft.addEventListener('click', () => panels.closeLeft());
    if (closeRight) closeRight.addEventListener('click', () => panels.closeRight());
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
    const sorted = eventsArray.slice().sort((a,b) => a.year - b.year);
    sorted.forEach((ev, idx) => {
      const imgs = ev.image_urls || [];
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
      // images row placed below description, show up to 3
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

    // wire thumbnail clicks to open gallery and event item selection
    setTimeout(() => {
      const container = document.getElementById('leftContent');
      if (!container) return;
      container.querySelectorAll('.event-thumb').forEach(img => {
        img.addEventListener('click', (e) => {
          e.stopPropagation(); // Don't trigger parent timeline-item click
          const idx = Number(img.getAttribute('data-idx')) || 0;
          const imgIndex = Number(img.getAttribute('data-img-index')) || 0;
          const items = sorted; // use the locally sorted array
          const event = items[idx];
          if (!event || !event.image_urls || !event.image_urls.length) return;
          showImageGallery(event.image_urls, imgIndex);
        });
      });
      
      // wire event item clicks for selection highlight + province highlighting
      container.querySelectorAll('.timeline-clickable').forEach((item, idx) => {
        item.addEventListener('click', (e) => {
          // Remove previous selection highlight
          container.querySelectorAll('.timeline-item').forEach(el => el.classList.remove('selected'));
          // Mark current item as selected
          item.classList.add('selected');
          
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
      
      // Restore selection state from uiSelectedEvent
      if (uiSelectedEvent) {
        container.querySelectorAll('.timeline-clickable').forEach((item, idx) => {
          const event = sorted[idx];
          if (event && event.name === uiSelectedEvent.name && event.year === uiSelectedEvent.year) {
            item.classList.add('selected');
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
    const sorted = eventsArray.slice().sort((a,b) => a.year - b.year);
    sorted.forEach((ev, idx) => {
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
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = Number(img.getAttribute('data-idx')) || 0;
          const imgIndex = Number(img.getAttribute('data-img-index')) || 0;
          const event = sorted[idx];
          if (!event || !event.image_urls || !event.image_urls.length) return;
          showImageGallery(event.image_urls, imgIndex);
        });
      });
      // wire event item clicks to select provinces
      container.querySelectorAll('.timeline-clickable').forEach((item, idx) => {
        item.addEventListener('click', (e) => {
          // Remove previous selection highlight
          container.querySelectorAll('.timeline-item').forEach(el => el.classList.remove('selected'));
          // Mark current item as selected
          item.classList.add('selected');
          
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
      
      // Restore selection state from uiSelectedEvent
      if (uiSelectedEvent) {
        container.querySelectorAll('.timeline-clickable').forEach((item, idx) => {
          const event = sorted[idx];
          if (event && event.name === uiSelectedEvent.name && event.year === uiSelectedEvent.year) {
            item.classList.add('selected');
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
  };

  // NEW: Render info for multiple provinces (when event is selected)
  window.renderMultiProvinceInfo = function (features, event) {
    if (!features || features.length === 0) {
      panels.openRight('<div class="empty">Không có thông tin.</div>');
      return;
    }
    let html = `<div class="info-title">Các tỉnh liên quan</div>`;
    if (event && event.name) html += `<div class="info-event-ref"><strong>Sự kiện:</strong> ${event.name} (${event.year})</div>`;
    html += `<div class="info-meta"><strong>Số tỉnh:</strong> ${features.length}</div>`;
    html += '<ul class="province-list">';
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
    }, 10);
  };
  
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
    galleryIndex = Math.max(0, Math.min((startIndex||0), galleryImages.length-1));
    const m = document.getElementById('imageGalleryModal');
    const frame = document.getElementById('imgFrame');
    if (!m || !frame) return;
    frame.innerHTML = `<img src="${galleryImages[galleryIndex]}" class="gallery-img" />`;
    m.style.display = 'flex';
  }

  function galleryPrev() { if (galleryImages.length === 0) return; galleryIndex = (galleryIndex - 1 + galleryImages.length) % galleryImages.length; document.getElementById('imgFrame').innerHTML = `<img src="${galleryImages[galleryIndex]}" class="gallery-img" />`; }
  function galleryNext() { if (galleryImages.length === 0) return; galleryIndex = (galleryIndex + 1) % galleryImages.length; document.getElementById('imgFrame').innerHTML = `<img src="${galleryImages[galleryIndex]}" class="gallery-img" />`; }
})();
