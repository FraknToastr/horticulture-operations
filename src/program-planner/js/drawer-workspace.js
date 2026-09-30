(function (global) {
  "use strict";

  var UOS = global.UOS = global.UOS || {};
  var KEYS = ["planner", "map", "costing", "scheduler", "quotes"];
  var roots = {};
  var depot;
  var mountedContext = "";
  var pendingRegisterContext = "";
  var queued = false;
  var pendingWorkspace = null;
  var pendingNavigation = false;
  var tableScrollOrigin = null;
  var lockedScrollTop = null;
  var positioningTable = false;
  var positionedRow = null;
  var positionedKey = "";
  var lockedFloorHeight = null;

  function moduleKey(value) { return value === "location" ? "map" : String(value || ""); }
  function isModule(value) { return KEYS.indexOf(moduleKey(value)) >= 0; }
  function tableFrame() { return document.querySelector(".program-register-main-pane > .program-table-wrap"); }

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
      if (root) {
        roots[key] = root;
        root.classList.add("program-drawer-module");
      }
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

  function showRegisterDetails() {
    document.querySelectorAll("[data-register-drawer-record]").forEach(function (drawer) {
      drawer.classList.remove("is-module-workspace");
      var detail = drawer.querySelector("[data-register-detail-content]");
      var host = drawer.querySelector("[data-register-module-host]");
      if (detail) detail.hidden = false;
      if (host) host.hidden = true;
    });
  }

  function sync(workspace, navigationRequested) {
    workspace = workspace || (UOS.ProgramApp && UOS.ProgramApp.workspace());
    if (!workspace || !workspace.workspace) return;
    var key = moduleKey(workspace.workspace.destination);
    if (!isModule(key)) {
      mountedContext = "";
      pendingRegisterContext = "";
      document.body.removeAttribute("data-drawer-module");
      document.body.removeAttribute("data-drawer-context-pending");
      document.body.removeAttribute("data-register-module-navigation-pending");
      park("");
      showRegisterDetails();
      queueViewportFloor();
      return;
    }

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
    var contextChanged = mountedContext !== key + ":" + recordId;
    var moduleChanged = document.body.getAttribute("data-drawer-module") !== key || root.parentNode !== host;
    mountedContext = key + ":" + recordId;
    park(key);
    document.querySelectorAll("[data-register-drawer-record]").forEach(function (item) {
      var active = item === drawer;
      var detail = item.querySelector("[data-register-detail-content]");
      var itemHost = item.querySelector("[data-register-module-host]");
      item.classList.toggle("is-module-workspace", active);
      if (detail) detail.hidden = active;
      if (itemHost) itemHost.hidden = !active;
    });
    root.hidden = false;
    if (root.parentNode !== host) host.appendChild(root);
    host.setAttribute("data-register-active-module", key);
    document.body.setAttribute("data-drawer-module", key);
    document.body.removeAttribute("data-register-module-navigation-pending");

    if (moduleChanged && key === "scheduler" && UOS.ProgramSchedulerUI && typeof UOS.ProgramSchedulerUI.render === "function") UOS.ProgramSchedulerUI.render();
    if (moduleChanged && key === "map" && UOS.ProgramMapController && typeof UOS.ProgramMapController.render === "function") UOS.ProgramMapController.render();
    var disclosure = UOS.ProgramDisclosureRows;
    if ((contextChanged || navigationRequested === true) && disclosure && !disclosure.isOpen("register:" + recordId)) disclosure.open("register:" + recordId);
    if (moduleChanged && key === "map") global.setTimeout(function () { global.dispatchEvent(new Event("resize")); }, 0);
    queueViewportFloor();
  }

  function requestSync(workspace, navigationRequested) {
    if (workspace) pendingWorkspace = workspace;
    if (navigationRequested === true) pendingNavigation = true;
    if (queued) return;
    queued = true;
    global.requestAnimationFrame(function () {
      var latest = pendingWorkspace;
      var navigation = pendingNavigation;
      pendingWorkspace = null;
      pendingNavigation = false;
      queued = false;
      sync(latest, navigation);
      syncOpenDrawer();
      fitBudgetFloor();
    });
  }

  // One viewport floor applies to native Register details and every mounted module.
  function applyViewportFloor(target) {
    var drawers = target ? [target] : Array.prototype.slice.call(document.querySelectorAll("[data-register-drawer-record]"));
    drawers.forEach(function (drawer) {
      var row = drawer.closest("tr");
      if (!row || row.hidden) return;
      drawer.classList.add("has-viewport-floor");
      var available = Math.max(180, Math.floor(global.innerHeight - drawer.getBoundingClientRect().top - 4));
      drawer.style.setProperty("--program-drawer-max-height", available + "px");
      drawer.setAttribute("data-program-drawer-floor", "stable");
    });
  }

  function queueViewportFloor() {
    if (lockedScrollTop !== null) return;
    global.requestAnimationFrame(function () {
      if (lockedScrollTop === null) applyViewportFloor();
    });
  }

  function fitBudgetFloor() {
    var budget = document.querySelector('[data-program-view="budget"]:not([hidden])');
    if (!budget) return;
    var available = Math.max(180, Math.floor(global.innerHeight - budget.getBoundingClientRect().top - 4));
    budget.style.setProperty("--program-budget-viewport-height", available + "px");
  }

  function activeRegisterRow() {
    var disclosure = UOS.ProgramDisclosureRows;
    var key = disclosure && disclosure.activeKey("register");
    if (!key) return null;
    return Array.prototype.find.call(document.querySelectorAll(".program-register-summary-row"), function (row) {
      return row.getAttribute("data-disclosure-key") === key;
    }) || null;
  }

  function positionOpenRow(remeasureFloor) {
    var frame = tableFrame();
    var row = activeRegisterRow();
    var header = frame && frame.querySelector(".program-register-table thead th");
    if (!frame || !row || !header) return;
    positioningTable = true;
    // Give the last row enough real drawer height to reach the headings.
    // This is the drawer itself, not an artificial table runway.
    var drawer = row.nextElementSibling && row.nextElementSibling.querySelector("[data-register-drawer-record]");
    if (drawer) {
      var rowRect = row.getBoundingClientRect();
      var gap = Math.max(0, drawer.getBoundingClientRect().top - rowRect.bottom);
      var targetHeight = remeasureFloor === false && lockedFloorHeight !== null
        ? lockedFloorHeight
        : Math.max(180, Math.floor(global.innerHeight - header.getBoundingClientRect().bottom - rowRect.height - gap - 4));
      drawer.classList.add("has-viewport-floor");
      drawer.style.setProperty("--program-drawer-max-height", targetHeight + "px");
      drawer.setAttribute("data-program-drawer-floor", "stable");
    }
    var offset = row.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
    frame.scrollTop = Math.max(0, frame.scrollTop + offset);
    if (remeasureFloor !== false) applyViewportFloor();
    if (drawer) lockedFloorHeight = parseFloat(drawer.style.getPropertyValue("--program-drawer-max-height"));
    lockedScrollTop = frame.scrollTop;
    positioningTable = false;
  }

  function syncOpenDrawer() {
    var frame = tableFrame();
    if (!frame) return;
    var row = activeRegisterRow();
    if (row) {
      if (tableScrollOrigin === null) tableScrollOrigin = frame.scrollTop;
      document.body.setAttribute("data-register-drawer-open", "");
      var key = row.getAttribute("data-disclosure-key") || "";
      if (key !== positionedKey || row !== positionedRow) {
        positionOpenRow(key !== positionedKey);
        positionedKey = key;
        positionedRow = row;
      }
      return;
    }
    // A Register redraw can temporarily remove the active row. Keep the lock
    // until disclosure state actually closes, so redraws cannot jump the table.
    var disclosure = UOS.ProgramDisclosureRows;
    if (disclosure && disclosure.activeKey("register")) return;
    if (tableScrollOrigin !== null) {
      var previous = tableScrollOrigin;
      tableScrollOrigin = null;
      lockedScrollTop = null;
      positionedKey = "";
      positionedRow = null;
      lockedFloorHeight = null;
      document.body.removeAttribute("data-register-drawer-open");
      frame.scrollTop = previous;
    }
  }

  function onDisclosureChange(event) {
    if (String(event && event.detail && event.detail.key || "").indexOf("register:") !== 0) return;
    syncOpenDrawer();
    global.requestAnimationFrame(function () {
      positionedRow = null;
      syncOpenDrawer();
    });
  }

  function init() {
    collect();
    var frame = tableFrame();
    if (frame) frame.addEventListener("scroll", function () {
      if (lockedScrollTop === null || positioningTable) return;
      if (Math.abs(frame.scrollTop - lockedScrollTop) > 1) frame.scrollTop = lockedScrollTop;
    }, { passive: true });
    document.addEventListener("uos:disclosure-open", onDisclosureChange);
    document.addEventListener("uos:disclosure-close", onDisclosureChange);
    global.addEventListener("resize", function () { positionOpenRow(true); fitBudgetFloor(); });
    document.addEventListener("uos:workspace-changed", function (event) { requestSync(event.detail && event.detail.workspace, false); });
    var body = document.querySelector("[data-register-table-body]");
    if (body && global.MutationObserver) new MutationObserver(function () {
      requestSync();
      syncOpenDrawer();
    }).observe(body, { childList: true, subtree: true });
    document.addEventListener("uos:program-ready", function (event) {
      requestSync(event.detail && event.detail.workspace, event.detail && event.detail.navigation);
    });
    document.addEventListener("uos:disclosure-before-open", function (event) {
      var key = String(event.detail && event.detail.key || "");
      if (key.indexOf("register:") !== 0) return;
      if (tableScrollOrigin === null && frame) tableScrollOrigin = frame.scrollTop;
      var nextRecordId = key.slice("register:".length);
      var workspace = UOS.ProgramApp && UOS.ProgramApp.workspace && UOS.ProgramApp.workspace();
      var active = moduleKey(workspace && workspace.workspace && workspace.workspace.destination);
      if (isModule(active)) {
        document.body.setAttribute("data-drawer-context-pending", nextRecordId);
        document.body.setAttribute("data-drawer-module", active);
      }
      if (mountedContext && mountedContext.slice(mountedContext.indexOf(":") + 1) !== nextRecordId) {
        pendingRegisterContext = nextRecordId;
        mountedContext = "";
        park("");
      }
    });
    syncOpenDrawer();
    fitBudgetFloor();
  }

  UOS.ProgramDrawerWorkspace = {
    modules: KEYS.slice(), isModule: isModule, moduleKey: moduleKey,
    sync: sync, requestSync: requestSync, applyViewportFloor: applyViewportFloor
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
}(window));
