(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {};
  var source = document.currentScript.src;
  var spaceMapBuild = "20261015-tree-details-v1";
  var rendererBuild = "20261016-performance-v1";
  var pending = {};

  function load(name, path, globalName, type) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (pending[name]) return pending[name];
    pending[name] = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = new URL(path, source).href;
      if (type) script.type = type;
      var timer;
      function fail() {
        if (timer) clearTimeout(timer);
        script.remove();
        reject(new Error("Unable to load the local " + name + " runtime. Check that the app files are available, then try again."));
      }
      script.onerror = fail;
      script.onload = function () {
        if (timer) clearTimeout(timer);
        if (window[globalName]) resolve(window[globalName]);
        else fail();
      };
      document.head.appendChild(script);
      if (typeof setTimeout === "function") timer = setTimeout(fail, 8000);
    }).catch(function (error) {
      delete pending[name];
      throw error;
    });
    return pending[name];
  }

  UOS.ProgramRuntime = {
    ensureMap: function () {
      if (!pending.spaceMap) {
        pending.spaceMap = load("Space Map", "../vendor/space-map/renderer.js?v=" + rendererBuild, "UOSSpaceGPU").catch(function () {
          return load("MapLibre", "../vendor/maplibre/maplibre-gl.js", "maplibregl");
        }).catch(function (error) { delete pending.spaceMap; throw error; });
      }
      return pending.spaceMap;
    },
    ensureLegacyMap: function () { return load("MapLibre", "../vendor/maplibre/maplibre-gl.js", "maplibregl"); },
    ensureTrees: function () {
      if (window.location.protocol === 'file:') return load('Tree layers', '../vendor/space-map/tree-loader-file.js?v=' + spaceMapBuild, 'UOSSpaceTreeLayers');
      if (!pending.trees) {
        // A failed module URL must change to permit a genuine import retry.
        var attempt = UOS.ProgramRuntime.treeLoadAttempt = (UOS.ProgramRuntime.treeLoadAttempt || 0) + 1;
        pending.trees = import(new URL("../vendor/space-map/tree-loader.js?v=" + spaceMapBuild + "&attempt=" + attempt, source).href).catch(function (error) { delete pending.trees; throw error; });
      }
      return pending.trees;
    },
    treeWorkerUrl: new URL("../vendor/space-map/tree-worker.js?v=" + spaceMapBuild, source).href,
    createTreeWorker: function () {
      if (window.location.protocol !== 'file:') return Promise.resolve(new Worker(UOS.ProgramRuntime.treeWorkerUrl, { type: 'module', name: 'space-map-tree-geometry' }));
      return load('Tree geometry', '../vendor/space-map/tree-worker-source.js?v=' + spaceMapBuild, 'UOSSpaceTreeWorkerSource').then(function (workerSource) {
        var url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
        try { return new Worker(url, { name: 'space-map-tree-geometry' }); }
        finally { URL.revokeObjectURL(url); }
      });
    },
    ensurePdf: function () {
      if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
      if (pending["PDF import"]) return pending["PDF import"];
      var attempt = UOS.ProgramRuntime.pdfLoadAttempt = (UOS.ProgramRuntime.pdfLoadAttempt || 0) + 1;
      return load("PDF import", "../vendor/pdfjs/pdf.min.mjs?attempt=" + attempt, "pdfjsLib", "module");
    }
  };
})();
