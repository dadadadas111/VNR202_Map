// ui-panels.js
// Simple global helpers to manage left (timeline) and right (info) panels.

(function () {
  function byId(id) { return document.getElementById(id); }

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
      html += `<li class="timeline-item" data-evt-idx="${idx}">`;
      html += `<div class="timeline-main"><span class="t-year">${ev.year}</span> <strong>${ev.name}</strong></div>`;
      html += `<div class="t-desc">${ev.description}</div>`;
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

    // wire thumbnail clicks to open gallery
    setTimeout(() => {
      const container = document.getElementById('leftContent');
      if (!container) return;
      container.querySelectorAll('.event-thumb').forEach(img => {
        img.addEventListener('click', (e) => {
          const idx = Number(img.getAttribute('data-idx')) || 0;
          const imgIndex = Number(img.getAttribute('data-img-index')) || 0;
          const items = sorted; // use the locally sorted array
          const event = items[idx];
          if (!event || !event.image_urls || !event.image_urls.length) return;
          showImageGallery(event.image_urls, imgIndex);
        });
      });
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
