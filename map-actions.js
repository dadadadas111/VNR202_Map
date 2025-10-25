// map-actions.js
// small helpers that operate on the global `map` and layers

(function () {
  // Expose focusOnLayer globally. script.js will call this when a feature is clicked.
  window.focusOnLayer = function (layer) {
    try {
      if (!layer) return;
      // resolve map reference from window to avoid scope issues
      const m = (typeof window !== 'undefined' && window.map) ? window.map : (typeof map !== 'undefined' ? map : null);
      if (!m) {
        console.warn('focusOnLayer: map instance not found on window.map');
        return;
      }

      // If layer provides getBounds (polygons), fit to bounds with a max zoom
      if (typeof layer.getBounds === 'function') {
        const bounds = layer.getBounds();
        const isValid = bounds && (typeof bounds.isValid === 'function' ? bounds.isValid() : true);
        if (isValid && typeof m.fitBounds === 'function') {
          // prefer not to zoom too far; use maxZoom to limit
          m.fitBounds(bounds, { padding: [40,40], maxZoom: 9 });
          return;
        }
      }

      // fallback: pan to centroid/latlng if available
      if (typeof layer.getLatLng === 'function' && typeof m.setView === 'function') {
        m.setView(layer.getLatLng(), 9);
      }
    } catch (err) {
      console.warn('focusOnLayer error', err);
    }
  };
})();
