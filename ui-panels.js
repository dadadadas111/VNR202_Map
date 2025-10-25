// ui-panels.js
// Simple global helpers to manage left (timeline) and right (info) panels.

(function () {
  function byId(id) { return document.getElementById(id); }

  window.panels = {
    openLeft: function (htmlContent) {
      const p = byId('leftPanel');
      const c = byId('leftContent');
      if (c) c.innerHTML = htmlContent || '';
      if (p) p.classList.add('open');
    },
    closeLeft: function () {
      const p = byId('leftPanel'); if (p) p.classList.remove('open');
    },
    openRight: function (htmlContent) {
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
