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
      // show find-images button BELOW the static image row (or right after description if no static images)
      html += `<div class="t-actions"><button class="find-images-btn" data-evt-idx="${idx}">Hình ảnh liên quan</button><div class="auto-image-warning">Lưu ý: ảnh tìm tự động, có thể không chính xác.</div></div>`;
      // auto-found images (kept separate so we don't mix with original JSON images)
      if (autoImgs && autoImgs.length) {
        html += `<div class="event-auto-header">Ảnh tìm tự động (${autoImgs.length})</div>`;
        html += `<div class="event-image-row auto-row">`;
        autoImgs.slice(0,3).forEach((url, ai) => {
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
          try { img.classList.add('thumb-broken'); img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="100%" height="100%" fill="%23eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23888" font-size="12">Không tải được</text></svg>'; } catch (e) {}
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

      // wire find-images button
      container.querySelectorAll('.find-images-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const idx = Number(btn.getAttribute('data-evt-idx')) || 0;
          const event = sorted[idx];
          if (!event) return;
          // If auto images already exist for this event, do not fetch again
          if (event._auto_images && event._auto_images.length) {
            btn.textContent = 'Đã tìm sẵn';
            btn.disabled = true;
            setTimeout(() => { btn.textContent = 'Tìm ảnh tự động'; btn.disabled = false; }, 1100);
            return;
          }
          // show lightweight loading state on button
          const orig = btn.textContent;
          btn.disabled = true; btn.textContent = 'Đang tìm...';
          try {
            if (typeof window.fetchImagesForEvent === 'function') {
              // request 4 images per click
              const found = await window.fetchImagesForEvent(event, 4);
              if (found && found.length) {
                // ensure auto_images array exists and avoid duplicates vs original images
                event._auto_images = event._auto_images || [];
                const baseSet = new Set((event.image_urls || []).map(u => String(u)));
                found.forEach(it => {
                  const addUrl = (it && it.safe_url) ? it.safe_url : (it && it.url) ? it.url : null;
                  if (!addUrl) return;
                  if (baseSet.has(addUrl)) return; // skip if present in original
                  if (event._auto_images.indexOf(addUrl) === -1) event._auto_images.push(addUrl);
                });
                // append thumbnails in a dedicated auto-row under this item
                const li = btn.closest('.timeline-item');
                if (li) {
                  let autoHeader = li.querySelector('.event-auto-header');
                  let autoRow = li.querySelector('.event-image-row.auto-row');
                  if (!autoHeader) {
                    autoHeader = document.createElement('div'); autoHeader.className = 'event-auto-header'; autoHeader.textContent = `Ảnh tìm tự động (${event._auto_images.length})`;
                    li.appendChild(autoHeader);
                  } else {
                    autoHeader.textContent = `Ảnh tìm tự động (${event._auto_images.length})`;
                  }
                  if (!autoRow) { autoRow = document.createElement('div'); autoRow.className = 'event-image-row auto-row'; li.appendChild(autoRow); }
                  // Clear and add up to 3 thumbnails
                  autoRow.innerHTML = '';
                  event._auto_images.slice(0,3).forEach((u, ai) => {
                    const extraAuto = (ai === 2 && event._auto_images.length > 3) ? event._auto_images.length - 3 : 0;
                    const wrap = document.createElement('div'); wrap.className = 'event-image-wrap';
                    const img = document.createElement('img'); img.className = 'event-thumb'; img.src = u; img.setAttribute('data-idx', idx); img.setAttribute('data-img-index', ai); img.setAttribute('data-source', 'auto');
                    // error fallback
                    img.onerror = () => { try { img.classList.add('thumb-broken'); img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="100%" height="100%" fill="%23eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23888" font-size="12">Không tải được</text></svg>'; } catch(e){} };
                    wrap.appendChild(img);
                    if (extraAuto) {
                      const ov = document.createElement('div'); ov.className = 'image-overlay'; ov.textContent = `+${extraAuto}`; wrap.appendChild(ov);
                    }
                    autoRow.appendChild(wrap);
                    img.addEventListener('click', (ev) => { ev.stopPropagation(); const imgs = (event.image_urls || []).concat(event._auto_images || []); const i = imgs.indexOf(u); showImageGallery(imgs, i >= 0 ? i : 0); });
                  });
                }
              } else {
                btn.textContent = 'Không tìm thấy';
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1200);
                return;
              }
            }
          } catch (err) {
            console.warn('Find images failed', err);
            btn.textContent = 'Lỗi';
            setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1200);
            return;
          }
          btn.textContent = 'Hoàn tất';
          setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 900);
        });
      });
      
      // Restore selection state from uiSelectedEvent
      if (uiSelectedEvent) {
        container.querySelectorAll('.timeline-clickable').forEach((item, idx) => {
          const event = sorted[idx];
          if (event && event.name === uiSelectedEvent.name && event.year === uiSelectedEvent.year) {
            item.classList.add('selected');
            try { item.scrollIntoView({ behavior: 'auto', block: 'start' }); } catch (err) {}
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
      // place find-images button below static images (or after description if none)
      html += `<div class="t-actions"><button class="find-images-btn" data-evt-idx="${idx}">Tìm ảnh tự động</button><div class="auto-image-warning">Lưu ý: ảnh tìm tự động có thể không chính xác.</div></div>`;
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
          try { img.classList.add('thumb-broken'); img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="100%" height="100%" fill="%23eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23888" font-size="12">Không tải được</text></svg>'; } catch (e) {}
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
          try { item.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (err) {}
          
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
      // wire find-images buttons (same behavior as in renderTimeline)
      container.querySelectorAll('.find-images-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const idx = Number(btn.getAttribute('data-evt-idx')) || 0;
          const event = sorted[idx];
          if (!event) return;
          // If auto images already exist for this event, do not fetch again
          if (event._auto_images && event._auto_images.length) {
            btn.textContent = 'Đã tìm sẵn';
            btn.disabled = true;
            setTimeout(() => { btn.textContent = 'Tìm ảnh tự động'; btn.disabled = false; }, 1100);
            return;
          }
          const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Đang tìm...';
          try {
            if (typeof window.fetchImagesForEvent === 'function') {
              const found = await window.fetchImagesForEvent(event, 4);
              if (found && found.length) {
                event._auto_images = event._auto_images || [];
                const baseSet = new Set((event.image_urls || []).map(u => String(u)));
                found.forEach(it => {
                  const addUrl = (it && it.safe_url) ? it.safe_url : (it && it.url) ? it.url : null;
                  if (!addUrl) return;
                  if (baseSet.has(addUrl)) return;
                  if (event._auto_images.indexOf(addUrl) === -1) event._auto_images.push(addUrl);
                });
                const li = btn.closest('.timeline-item');
                if (li) {
                  let autoHeader = li.querySelector('.event-auto-header');
                  let autoRow = li.querySelector('.event-image-row.auto-row');
                  if (!autoHeader) {
                    autoHeader = document.createElement('div'); autoHeader.className = 'event-auto-header'; autoHeader.textContent = `Ảnh tìm tự động (${event._auto_images.length})`;
                    li.appendChild(autoHeader);
                  } else { autoHeader.textContent = `Ảnh tìm tự động (${event._auto_images.length})`; }
                  if (!autoRow) { autoRow = document.createElement('div'); autoRow.className = 'event-image-row auto-row'; li.appendChild(autoRow); }
                  autoRow.innerHTML = '';
                  event._auto_images.slice(0,3).forEach((u, ai) => {
                    const extraAuto = (ai === 2 && event._auto_images.length > 3) ? event._auto_images.length - 3 : 0;
                    const wrap = document.createElement('div'); wrap.className = 'event-image-wrap';
                    const img = document.createElement('img'); img.className = 'event-thumb'; img.src = u; img.setAttribute('data-idx', idx); img.setAttribute('data-img-index', ai); img.setAttribute('data-source', 'auto');
                    img.onerror = () => { try { img.classList.add('thumb-broken'); img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="100%" height="100%" fill="%23eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23888" font-size="12">Không tải được</text></svg>'; } catch(e){} };
                    wrap.appendChild(img);
                    if (extraAuto) {
                      const ov = document.createElement('div'); ov.className = 'image-overlay'; ov.textContent = `+${extraAuto}`; wrap.appendChild(ov);
                    }
                    autoRow.appendChild(wrap);
                    img.addEventListener('click', (ev) => { ev.stopPropagation(); const imgs = (event.image_urls || []).concat(event._auto_images || []); const i = imgs.indexOf(u); showImageGallery(imgs, i >= 0 ? i : 0); });
                  });
                }
              } else {
                btn.textContent = 'Không tìm thấy';
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1200);
                return;
              }
            }
          } catch (err) { console.warn('Find images failed', err); btn.textContent = 'Lỗi'; setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1200); return; }
          btn.textContent = 'Hoàn tất';
          setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 900);
        });
      });
      
      // Restore selection state from uiSelectedEvent
      if (uiSelectedEvent) {
        container.querySelectorAll('.timeline-clickable').forEach((item, idx) => {
          const event = sorted[idx];
          if (event && event.name === uiSelectedEvent.name && event.year === uiSelectedEvent.year) {
            item.classList.add('selected');
            try { item.scrollIntoView({ behavior: 'auto', block: 'start' }); } catch (err) {}
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
    galleryIndex = Math.max(0, Math.min((startIndex||0), galleryImages.length-1));
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
      img.onerror = function() {
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
        img.onerror = function() { frame.innerHTML = `<div class="img-error">Không thể tải ảnh. <a href="${url}" target="_blank" rel="noopener">Mở liên kết</a></div>`; };
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
