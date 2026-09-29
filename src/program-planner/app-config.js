(function defineProgramAppConfig(global) {
  "use strict";

  var routePath = global.location.pathname;
  var workspaceParam = "";
  try { workspaceParam = new URLSearchParams(global.location.search || "").get("workspace") || ""; } catch (_queryError) { /* older embedded browsers use route fallback */ }
  if (!workspaceParam && global.parent && global.parent !== global) {
    try { routePath = global.parent.location.pathname; } catch (_error) { /* same-origin route is expected */ }
  }

  var isEvents = String(workspaceParam).toUpperCase() === "EVT" || (!workspaceParam && /(?:^|\/)events\.html$/.test(routePath));
  var config = Object.freeze({
    appId: isEvents ? "uos.horticulture.events" : "uos.horticulture.nsa",
    workspaceKind: isEvents ? "EVT" : "NSA",
    owner: isEvents ? "EVT" : "NSA",
    storageDatabase: isEvents ? "uos-horticulture-events-v16" : "uos-horticulture-nsa-v16",
    route: isEvents ? "events.html" : "nsa.html",
    labels: Object.freeze({
      application: isEvents ? "Event" : "Application",
      applicationPlural: isEvents ? "Events" : "Applications",
      title: isEvents ? "Event Space Remediation" : "Nature Strip Applications"
    }),
    allowedLegacyImports: Object.freeze(isEvents ? ["EVT"] : ["NSA"])
  });

  var uos = global.UOS || {};
  var programAppConfig = Object.freeze({ current: function current() { return config; } });
  Object.defineProperty(uos, "ProgramAppConfig", {
    value: programAppConfig,
    enumerable: true,
    configurable: false,
    writable: false
  });
  if (!global.UOS) {
    global.UOS = uos;
  }

  global.document.documentElement.dataset.appId = config.appId;
  global.document.documentElement.dataset.workspaceKind = config.workspaceKind;
  global.document.documentElement.dataset.owner = config.owner;
}(window));
