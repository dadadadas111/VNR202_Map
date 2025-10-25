// ui-panels.js
// Simple global helpers to manage left (timeline) and right (info) panels.

(function () {
  function byId(id) { return document.getElementById(id); }

  window.panels = {
    openLeft: function (htmlContent) {
      // On mobile, open bottom panel with Events tab
      if (window.innerWidth && window.innerWidth <= 700) {
        panels.openBottom('events', htmlContent);
        return;
      }
      const p = byId('leftPanel');
      const c = byId('leftContent');
      // On small screens, close right panel to avoid overlap
      try { if (window.innerWidth && window.innerWidth <= 700) panels.closeRight(); } catch (err) {}
      if (c) c.innerHTML = htmlContent || '';
      if (p) p.classList.add('open');
    },
    closeLeft: function () {
      const p = byId('leftPanel'); if (p) p.classList.remove('open');
    },
    openRight: function (htmlContent) {
      // On mobile, open bottom panel with Info tab
      if (window.innerWidth && window.innerWidth <= 700) {
        panels.openBottom('info', htmlContent);
        return;
      }
      const p = byId('rightPanel');
      const c = byId('rightContent');
      // On small screens, close left panel to avoid overlap
      try { if (window.innerWidth && window.innerWidth <= 700) panels.closeLeft(); } catch (err) {}
      if (c) c.innerHTML = htmlContent || '';
      if (p) p.classList.add('open');
    },
    closeRight: function () { const p = byId('rightPanel'); if (p) p.classList.remove('open'); }
  };

  // bottom panel control (mobile)
  panels.openBottom = function (tab, htmlContent) {
    const bp = byId('bottomPanel');
    const bc = byId('bottomContent');
    const tabEvents = byId('tabEvents');
    const tabInfo = byId('tabInfo');
    try { panels.closeLeft(); panels.closeRight(); } catch (err) {}
    if (!bp) return;
    // store contents so switching tabs works client-side
    if (tab === 'events') bp._eventsHtml = htmlContent || '<div class="empty">Không có sự kiện trong giai đoạn này.</div>';
    if (tab === 'info') bp._infoHtml = htmlContent || '<div class="empty">Không có thông tin.</div>';
    // set current content
    if (bc) bc.innerHTML = (tab === 'events' ? bp._eventsHtml : bp._infoHtml) || '';
    bp.classList.add('open');
    if (tabEvents && tabInfo) {
      tabEvents.classList.toggle('active', tab === 'events');
      tabInfo.classList.toggle('active', tab === 'info');
    }
  };
  panels.closeBottom = function () { const p = byId('bottomPanel'); if (p) p.classList.remove('open'); };

  // wire close buttons
  document.addEventListener('DOMContentLoaded', () => {
    const closeLeft = byId('closeLeft');
    const closeRight = byId('closeRight');
    if (closeLeft) closeLeft.addEventListener('click', () => panels.closeLeft());
    if (closeRight) closeRight.addEventListener('click', () => panels.closeRight());
    // bottom panel buttons
    const closeBottom = byId('closeBottom');
    const tabEvents = byId('tabEvents');
    const tabInfo = byId('tabInfo');
    if (closeBottom) closeBottom.addEventListener('click', () => panels.closeBottom());
    if (tabEvents) tabEvents.addEventListener('click', () => {
      const bp = byId('bottomPanel'); const bc = byId('bottomContent');
      tabEvents.classList.add('active'); tabInfo && tabInfo.classList.remove('active');
      if (bp && bc) bc.innerHTML = bp._eventsHtml || '<div class="empty">Không có sự kiện trong giai đoạn này.</div>';
    });
    if (tabInfo) tabInfo.addEventListener('click', () => {
      const bp = byId('bottomPanel'); const bc = byId('bottomContent');
      tabInfo.classList.add('active'); tabEvents && tabEvents.classList.remove('active');
      if (bp && bc) bc.innerHTML = bp._infoHtml || '<div class="empty">Không có thông tin.</div>';
    });
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
