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
    eventsArray.sort((a,b) => a.year - b.year).forEach(ev => {
      html += `<li class="timeline-item"><span class="t-year">${ev.year}</span> <strong>${ev.name}</strong><div class="t-desc">${ev.description}</div></li>`;
    });
    html += '</ol>';
    panels.openLeft(html);
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
})();
