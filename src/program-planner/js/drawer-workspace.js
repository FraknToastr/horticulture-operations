(function (global) {
  "use strict";
  var UOS = global.UOS = global.UOS || {};
  var KEYS = ["planner", "map", "costing", "scheduler", "quotes"];
  var roots = {};
  var depot;
  var queued = false;
  var pendingWorkspace = null;
  var pendingNavigation = false;
  var mountedContext = "";
  var pendingRegisterContext = "";

  function moduleKey(value) { return value === "location" ? "map" : String(value || ""); }
  function isModule(value) { return KEYS.indexOf(moduleKey(value)) >= 0; }
  function ensureDepot() {
    if (depot) return depot;
    depot = document.createElement("div");
    depot.hidden = true;
    depot.setAttribute("data-program-module-depot", "");
    document.body.appendChild(depot);
    return depot;
  }
  function collect() {
    KEYS.forEach(function (key) {
      var root = document.querySelector('[data-program-view="' + key + '"]');
      if (root) { roots[key] = root; root.classList.add("program-drawer-module"); }
    });
    ensureDepot();
  }
  function contextRecord(workspace) {
    var id = String(workspace && workspace.workspace && workspace.workspace.selectedEntityId || "");
    var app = UOS.ProgramApp;
    if (app && typeof app.resolveWorkingContext === "function") {
      var context = app.resolveWorkingContext(workspace, id);
      if (context && context.registerId) id = context.registerId;
    }
    return id;
  }
  function park(active) {
    KEYS.forEach(function (key) {
      var root = roots[key];
      if (!root || key === active) return;
      root.hidden = true;
      if (root.parentNode !== ensureDepot()) ensureDepot().appendChild(root);
    });
  }
  function sync(workspace, navigationRequested) {
    workspace = workspace || (UOS.ProgramApp && UOS.ProgramApp.workspace());
    if (!workspace || !workspace.workspace) return;
    var key = moduleKey(workspace.workspace.destination);
    if (!isModule(key)) { mountedContext = ""; pendingRegisterContext = ""; document.body.removeAttribute("data-drawer-module"); document.body.removeAttribute("data-drawer-context-pending"); park(""); return; }
    var recordId = contextRecord(workspace);
    if (pendingRegisterContext) {
      if (recordId !== pendingRegisterContext) {
        park("");
        return;
      }
      pendingRegisterContext = "";
      document.body.removeAttribute("data-drawer-context-pending");
    }
    var drawer = recordId && document.querySelector('[data-register-drawer-record="' + CSS.escape(recordId) + '"]');
    var host = drawer && drawer.querySelector("[data-register-module-host]");
    var root = roots[key];
    if (!host || !root) return;
    var nextContext = key + ":" + recordId;
    var contextChanged = mountedContext !== nextContext;
    mountedContext = nextContext;
    var moduleChanged = document.body.getAttribute("data-drawer-module") !== key || root.parentNode !== host;
    park(key);
    document.querySelectorAll("[data-register-drawer-record]").forEach(function (item) {
      var detail = item.querySelector("[data-register-detail-content]");
      var itemHost = item.querySelector("[data-register-module-host]");
      var active = item === drawer;
      item.classList.toggle("is-module-workspace", active);
      if (detail) detail.hidden = active;
      if (itemHost) itemHost.hidden = !active;
    });
    root.hidden = false;
    if (root.parentNode !== host) host.appendChild(root);
    host.setAttribute("data-register-active-module", key);
    document.body.setAttribute("data-drawer-module", key);
    if (moduleChanged && key === "scheduler" && UOS.ProgramSchedulerUI && typeof UOS.ProgramSchedulerUI.render === "function") UOS.ProgramSchedulerUI.render();
    if (moduleChanged && key === "map" && UOS.ProgramMapController && typeof UOS.ProgramMapController.render === "function") UOS.ProgramMapController.render();
    var disclosure = UOS.ProgramDisclosureRows;
    var disclosureKey = "register:" + recordId;
    // Passive DOM synchronisation must not undo a user's explicit collapse.
    var openRequested = (contextChanged || navigationRequested === true) && disclosure && !disclosure.isOpen(disclosureKey);
    if (openRequested) disclosure.open(disclosureKey);
    if ((moduleChanged || openRequested) && key === "map") setTimeout(function () { global.dispatchEvent(new Event("resize")); }, 0);
  }
  function requestSync(workspace, navigationRequested) {
    if (workspace) pendingWorkspace = workspace;
    if (navigationRequested === true) pendingNavigation = true;
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      var latest = pendingWorkspace;
      var navigation = pendingNavigation;
      pendingWorkspace = null;
      pendingNavigation = false;
      queued = false;
      sync(latest, navigation); queueViewportFloor(false);
    });
  }
function applyViewportFloor(target, force) {
 var drawers = target ? [target] : Array.prototype.slice.call(document.querySelectorAll("[data-register-drawer-record]"));
 drawers.forEach(function (drawer) {
    var row = drawer.closest("tr");
    if (!row || row.hidden) return;
    /* Apply the visible floor before measurement. A just-opened table row can
       report zero height for one animation frame, but its floor must not blink
       out while its content is mounting. */
      drawer.classList.add("has-viewport-floor");
      if (!force && drawer.style.getPropertyValue("--program-drawer-max-height")) {
        drawer.setAttribute("data-program-drawer-floor", "stable");
        return;
      }
    var bounds = drawer.getBoundingClientRect();
    if (bounds.height === 0) return;
      var available = Math.max(180, Math.floor(global.innerHeight - bounds.top - 12));
      drawer.style.setProperty("--program-drawer-max-height", available + "px");
      drawer.setAttribute("data-program-drawer-floor", "stable");
  });
}
function queueViewportFloor(force) {
  /* The first frame clears the disclosure's hidden table-row state; the
     second measures the actual rendered drawer. */
  global.requestAnimationFrame(function () {
      global.requestAnimationFrame(function () { applyViewportFloor(null, force === true); });
  });
}
function init() {
 collect();
    document.addEventListener("uos:disclosure-open", function () { queueViewportFloor(true); });
 document.addEventListener("uos:disclosure-motion-end", function (event) {
      if (event.detail && event.detail.expanded) queueViewportFloor(true);
 });
    global.addEventListener("resize", function () { queueViewportFloor(true); });
    var body = document.querySelector("[data-register-table-body]");
    if (body && global.MutationObserver) new MutationObserver(function () { requestSync(); }).observe(body, { childList: true, subtree: true });
 document.addEventListener("uos:program-ready", function (event) { requestSync(event.detail && event.detail.workspace, event.detail && event.detail.navigation); }); document.addEventListener("uos:disclosure-before-open", function (event) { var key = String(event.detail && event.detail.key || ""); if (key.indexOf("register:") !== 0) return; var nextRecordId = key.slice("register:".length); if (!mountedContext || mountedContext.slice(mountedContext.indexOf(":") + 1) === nextRecordId) return; /* Park the singleton module while selection rebases so stale Register content cannot leak into the opening row. */ pendingRegisterContext = nextRecordId; mountedContext = ""; document.body.removeAttribute("data-drawer-module"); park(""); });
  }
  /* The module is hidden in the depot during a Register handoff, but remains
     logically drawer-bound. Preserve that mode until the new Register state
     arrives so map reconciliation cannot fall back to global browsing. */
  document.addEventListener("uos:disclosure-before-open", function (event) {
    var key = String(event.detail && event.detail.key || "");
    var workspace = UOS.ProgramApp && UOS.ProgramApp.workspace && UOS.ProgramApp.workspace();
    var active = moduleKey(workspace && workspace.workspace && workspace.workspace.destination);
    if (key.indexOf("register:") === 0 && isModule(active)) {
      document.body.setAttribute("data-drawer-context-pending", key.slice("register:".length));
      document.body.setAttribute("data-drawer-module", active);
    }
  });
UOS.ProgramDrawerWorkspace = { modules: KEYS.slice(), isModule: isModule, moduleKey: moduleKey, sync: sync, requestSync: requestSync, applyViewportFloor: applyViewportFloor };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
}(window));
