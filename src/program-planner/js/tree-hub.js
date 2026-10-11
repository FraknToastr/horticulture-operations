(function () {
  'use strict';
  var UOS = window.UOS = window.UOS || {};
  var enabled = { trees: false, srz: false, tpz: false }, thresholds = { trees: 16, srz: 17, tpz: 17 };
  var manager = null, adapter = null, loading = null, visible = false, loadError = false;
  function status(id, message) {
    var el = document.querySelector('[data-tree-status="' + id + '"]');
    var button = document.querySelector('[data-tree-layer="' + id + '"]');
    // Keep implementation detail available to diagnostics without presenting
    // load, viewport, or service failures in the radial control itself.
    if (el) { el.textContent = message; el.setAttribute('aria-hidden', 'true'); }
    if (button) button.setAttribute('aria-label', ({ trees: 'Trees', srz: 'SRZ', tpz: 'TPZ' })[id] + ': ' + (enabled[id] ? 'On' : 'Off'));
  }
  function update() {
    var workspace = UOS.ProgramApp && UOS.ProgramApp.workspace();
    visible = !!(workspace && workspace.workspace.destination === 'map');
    var controller = UOS.ProgramMapController && UOS.ProgramMapController.getMapController();
    var next = controller && controller.getRendererAdapter && controller.getRendererAdapter();
    if (next && next !== adapter) {
      manager && manager.destroy(); manager = null; adapter = next;
      if (adapter.on) { adapter.on('move', update); adapter.on('moveend', update); adapter.on('resize', update); adapter.on('rendererchange', update); adapter.on('load', update); }
    }
    Object.keys(enabled).forEach(function (id) {
      var button = document.querySelector('[data-tree-layer="' + id + '"]');
      if (button) button.setAttribute('aria-pressed', String(enabled[id]));
      if (!enabled[id]) status(id, 'Off');
      else if (!visible) status(id, 'Map hidden');
      else if (!adapter || adapter.getZoom() < thresholds[id]) status(id, 'Zoom in to view');
    });
    if (manager) { manager.update(enabled, visible); return; }
    if (loadError || loading || !visible || !adapter || !Object.keys(enabled).some(function (id) { return enabled[id] && adapter.getZoom() >= thresholds[id]; })) return;
    loading = UOS.ProgramRuntime.ensureTrees().then(function (module) {
      loading = null;
      manager = new module.TreeLayers(adapter, { workerUrl: UOS.ProgramRuntime.treeWorkerUrl, createWorker: UOS.ProgramRuntime.createTreeWorker, onStatus: status });
      manager.update(enabled, visible);
    }).catch(function () { loading = null; loadError = true; Object.keys(enabled).forEach(function (id) { if (enabled[id]) status(id, 'Tree layers unavailable. Toggle to retry.'); }); });
  }
  function init() {
    var hub = document.getElementById('treeLayerHub'), actions = document.getElementById('treeLayerActions');
    if (!hub || !actions) return;
    hub.addEventListener('click', function () { var expanded = hub.getAttribute('aria-expanded') !== 'true'; hub.setAttribute('aria-expanded', String(expanded)); hub.setAttribute('aria-label', expanded ? 'Collapse tree layers' : 'Expand tree layers'); actions.hidden = !expanded; });
    document.querySelectorAll('[data-tree-layer]').forEach(function (button) { button.addEventListener('click', function () { var id = button.getAttribute('data-tree-layer'); enabled[id] = !enabled[id]; loadError = false; update(); }); });
    document.addEventListener('uos:program-ready', function () { requestAnimationFrame(update); });
    UOS.TreeHub = { update: update, getState: function () { return { enabled: Object.assign({}, enabled), visible: visible, metrics: manager ? manager.getMetrics() : { worker: false, requests: 0 } }; } };
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
