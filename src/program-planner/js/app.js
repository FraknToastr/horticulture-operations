(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var DESTINATIONS = ["dashboard", "register", "budget", "planner", "map", "scheduler", "costing", "quotes", "reports", "data"];
 var state = { phase: "loading", workspace: null, staged: null, error: null, busy: false, deepLinkApplied: false, entryOwnerApplied: false, isSessionCleared: false, startupRecovery: false, canEdit: true };

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function one(selector) { return document.querySelector(selector); }
  function all(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }
  function setText(selector, value) { var node = one(selector); if (node) node.textContent = String(value == null ? "" : value); }
  function setHidden(selector, hidden) { all(selector).forEach(function (node) { node.hidden = Boolean(hidden); }); }
  function destination(value) { return DESTINATIONS.indexOf(value) >= 0 ? value : "dashboard"; }
  function returnDestinationFromData(workspace) {
    var value = workspace && workspace.workspace && workspace.workspace.dataReturnDestination;
    return DESTINATIONS.indexOf(value) >= 0 && value !== "data" ? value : "register";
  }
  function appConfig() {
    return UOS.ProgramAppConfig && typeof UOS.ProgramAppConfig.current === "function" ? UOS.ProgramAppConfig.current() : null;
  }
  function entryOwner() {
    var configured = appConfig();
    if (configured && (configured.owner === "NSA" || configured.owner === "EVT")) return configured.owner;
    try {
      var value = new URLSearchParams(window.location.search || "").get("owner");
      return value === "EVT" ? "EVT" : value === "NSA" ? "NSA" : "";
    } catch (error) { return ""; }
  }
  function workingOwner(workspace) {
    var configured = appConfig();
    if (configured && (configured.owner === "NSA" || configured.owner === "EVT")) return configured.owner;
    var value = workspace && workspace.workspace && workspace.workspace.ownerMode;
    return value === "EVT" ? "EVT" : "NSA";
  }
  function programStatus(label, kind) {
    setText("[data-program-status]", label);
    setText("[data-program-persistence]", label);
    var status = one("[data-program-persistence-state]");
    if (status) status.setAttribute("data-program-persistence-state", kind || "ready");
  }
  function collection(name) {
    return state.workspace && state.workspace.entities && Array.isArray(state.workspace.entities[name]) ? state.workspace.entities[name] : [];
  }
  var entityIndexMap = null;
  function invalidateEntityIndex() {
    entityIndexMap = null;
  }
  function buildEntityIndex() {
    var map = new Map();
    if (state.workspace && state.workspace.entities) {
      var keys = Object.keys(state.workspace.entities);
      for (var k = 0; k < keys.length; k++) {
        var list = state.workspace.entities[keys[k]];
        if (Array.isArray(list)) {
          for (var i = 0; i < list.length; i++) {
            var item = list[i];
            if (item && item.id) map.set(String(item.id).trim(), item);
          }
        }
      }
    }
    entityIndexMap = map;
  }
  function entityById(id) {
    var wanted = String(id == null ? "" : id).trim();
    if (!wanted || !state.workspace || !state.workspace.entities) return null;
    if (!entityIndexMap) buildEntityIndex();
    return entityIndexMap.get(wanted) || null;
  }
  function money(value) {
    try { return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(Number(value) || 0); }
    catch (e) { return "$" + (Number(value) || 0).toFixed(0); }
  }
  function updatedLabel(value) {
    if (!value) return "";
    try {
      var date = new Date(value);
      if (Number.isNaN(date.valueOf())) return "";
      return "Workspace updated " + new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
    } catch (error) { return ""; }
  }
  function fail(error) {
    state.phase = "error";
    state.error = error instanceof Error ? error : new Error(String(error || "The workspace could not be opened."));
    state.busy = false;
    render();
  }

  function recoverableStartupError(error) {
    var message = String(error && error.message || error || "");
    return /Invalid unified workspace|requires exactly one Register parent|requires projectId|Project must have exactly one existing Register parent|Work Geometry has no existing Project/.test(message);
  }

  function removeStartupRecoveryNotice() {
    var notice = one("[data-program-startup-recovery]");
    if (notice && notice.parentNode) notice.parentNode.removeChild(notice);
  }

  function showStartupRecoveryNotice() {
    removeStartupRecoveryNotice();
    var dataView = one('[data-program-view="data"]');
    var dataMain = dataView && dataView.querySelector(".program-data__main");
    if (!dataView || !dataMain) return;

    var notice = document.createElement("section");
    notice.className = "program-state program-state--error program-island";
    notice.setAttribute("data-program-startup-recovery", "");
    notice.setAttribute("role", "status");

    var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    var iconPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    iconPath.setAttribute("d", "M12 3v12m0 0 4-4m-4 4-4-4M5 20h14");
    icon.appendChild(iconPath);

    var copy = document.createElement("div");
    var heading = document.createElement("h3");
    heading.textContent = "Import a workspace to continue";
    var description = document.createElement("p");
    description.textContent = "The previous workspace could not be opened. Select a valid Horticulture workspace ZIP or JSON file. The stored workspace will not be replaced unless the selected file passes validation and you confirm Apply import.";
    copy.appendChild(heading);
    copy.appendChild(description);

    var choose = document.createElement("button");
    choose.className = "uos-button uos-button--primary";
    choose.type = "button";
    choose.textContent = "Choose workspace file";
    choose.addEventListener("click", function () {
      var input = one("[data-program-import-input]");
      if (input) input.click();
    });

    notice.appendChild(icon);
    notice.appendChild(copy);
    notice.appendChild(choose);
    dataView.insertBefore(notice, dataMain);
  }

  function openStartupImportRecovery(error) {
    var workspace = UOS.ProgramModel.blank();
    workspace.workspace = workspace.workspace || {};
    workspace.workspace.destination = "data";
    workspace.migration = workspace.migration || {};
    workspace.migration.status = "recovery-required";
    workspace.migration.warnings = ["A stored workspace failed canonical validation. Import a valid workspace to replace it."];

    /* Do not let the owner query-string redirect recovery away from Data & Settings. */
    state.entryOwnerApplied = true;
    state.startupRecovery = true;
    activate(workspace);

    /* Keep this blank recovery workspace in memory only. The unreadable stored
       record remains untouched until a validated import is committed. */
    state.isSessionCleared = true;
    state.error = error instanceof Error ? error : new Error(String(error || "The stored workspace could not be opened."));
    showStartupRecoveryNotice();
    setText("[data-program-data-status]", "Workspace import required. Choose a valid v3 workspace ZIP or JSON file.");
    programStatus("Import required", "warning");
    return state.workspace;
  }

  function saveFailed(error) {
    state.busy = false;
    state.error = error instanceof Error ? error : new Error(String(error || "The workspace could not be saved."));
    programStatus("Save failed — changes not stored", "error");
    if (UOS.toast) UOS.toast("Save failed — changes were not stored.", "error");
    document.dispatchEvent(new CustomEvent("uos:program-save-error", { detail: { error: state.error } }));
    throw state.error;
  }

  function renderMigration() {
    var preview = state.staged && state.staged.preview;
    var counts = preview && preview.counts || { total: 0, byCollection: {}, byOwner: {} };
    setText("[data-program-migration-total]", counts.total || 0);
    setText("[data-program-migration-nature]", counts.byOwner && counts.byOwner.NSA || 0);
    setText("[data-program-migration-remediation]", counts.byOwner && counts.byOwner.EVT || 0);
    var summary = one("[data-program-migration-counts]");
    if (summary && !one("[data-program-migration-total]")) {
      while (summary.firstChild) summary.removeChild(summary.firstChild);
      [["Records", counts.total || 0], ["Nature Strip", counts.byOwner && counts.byOwner.NSA || 0], ["Remediation", counts.byOwner && counts.byOwner.EVT || 0]].forEach(function (entry) {
        var card = document.createElement("div");
        var label = document.createElement("span");
        var value = document.createElement("strong");
        label.textContent = entry[0];
        value.textContent = String(entry[1]);
        card.appendChild(label);
        card.appendChild(value);
        summary.appendChild(card);
      });
    }
    all("[data-program-migration-count]").forEach(function (node) {
      node.textContent = String(counts.byCollection && counts.byCollection[node.getAttribute("data-program-migration-count")] || 0);
    });
    var warnings = one("[data-program-migration-warnings]");
    if (warnings) {
      while (warnings.firstChild) warnings.removeChild(warnings.firstChild);
      (preview && preview.warnings || []).forEach(function (warning) {
        var item = document.createElement("li");
        item.textContent = String(warning);
        warnings.appendChild(item);
      });
      warnings.hidden = !(preview && preview.warnings && preview.warnings.length);
    }
  }

  function renderWorkspace() {
    if (!state.workspace) return;
    var active = destination(state.workspace.workspace && state.workspace.workspace.destination);
    var finances = UOS.ProjectFunding && typeof UOS.ProjectFunding.finances === "function" ? UOS.ProjectFunding.finances(state.workspace) : UOS.ProgramModel.finances(state.workspace);
    setText("[data-program-kpi='applications']", collection("applications").length);
    setText("[data-program-kpi='projects']", collection("projects").length);
    setText("[data-program-kpi='events']", collection("events").length);
    setText("[data-program-kpi='jobs']", collection("jobs").length);
    setText("[data-program-kpi='approved']", money(finances.approvedBudget));
    setText("[data-program-kpi='committed']", money(finances.committedBudget));
    setText("[data-program-kpi='actual']", money(finances.actualSpend));
    setText("[data-program-kpi='spare']", money(finances.spareFunds));
    setText("#dashboard-period", updatedLabel(state.workspace.updatedAt));
    setText("#scheduler-title", collection("jobs").length ? collection("jobs").length + " jobs in the unified program" : "No scheduled jobs");
    // setText("[data-program-module-summary='scheduler']", ...);
    setText("#costing-title", collection("costingLines").length || collection("rateItems").length ? "Unified costing data is ready" : "No job selected for costing");
    setText("[data-program-module-summary='costing']", collection("rateItems").length + " catalogue items and " + collection("costingLines").length + " costing lines are available.");
    setText("[data-program-module-summary='register']", collection("applications").length + " applications and " + collection("events").length + " events are available.");
    setText("#reports-title", collection("jobs").length || finances.approvedBudget ? "Unified financial position" : "No reportable activity");
    setText("[data-program-module-summary='reports']", "Operational Amount " + money(finances.approvedBudget) + ", committed " + money(finances.committedBudget) + ", actual " + money(finances.actualSpend) + " and spare " + money(finances.spareFunds) + ".");
    renderWorkingContext();
    all("[data-program-destination]").forEach(function (button) {
      var selected = button.getAttribute("data-program-destination") === active;
      button.classList.toggle("is-active", selected);
      if (selected) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    var drawerModules = ["planner", "map", "costing", "scheduler", "quotes"];
    var drawerModule = drawerModules.indexOf(active) >= 0;
    all("[data-program-view]").forEach(function (view) {
      var key = view.getAttribute("data-program-view");
      view.hidden = drawerModule ? (key !== "register" && key !== active) : key !== active;
    });
    setHidden("#workspace-empty", collection("applications").length + collection("events").length + collection("projects").length + collection("jobs").length > 0 || active !== "dashboard");
    var owner = state.workspace ? workingOwner(state.workspace) : "NSA";
    var labels = { dashboard: "Dashboard", register: "Register", planner: "Project Planner", scheduler: "Job Scheduler", costing: "Cost Calculator", map: "Space Map", quotes: "Quote Builder", reports: "Reports & Financials", data: "Data & Settings" };
    setText("#program-header-title", owner === "EVT" ? "Event Space Remediation" : "Nature Strip Applications");
    setText("#program-header-module", labels[active] || "Dashboard");
    var ctxTitle = one("#context-title");
    if (ctxTitle) ctxTitle.textContent = labels[active] || "Dashboard";
    all("[data-module-controls]").forEach(function (controls) {
      var ctrlMode = controls.getAttribute("data-module-controls");
      controls.hidden = (ctrlMode !== active);
    });
    var headerNavigation = one(".program-header-nav");
    if (headerNavigation) syncToolbarPrerequisites(headerNavigation, shortcutContextForWorkspace(active));
    /* Module content rendering is owned by the active module's uos:program-ready
       listener. The shell only switches visibility and shared chrome here. Calling
       module renderers here as well causes the active module to render twice for
       every activation/navigation/save. */
    updateRailTheme();
  }

  function renderWorkingContext() {
    if (!state.workspace) return;
    var owner = workingOwner(state.workspace);
    var entities = state.workspace.entities || {};
    var nsaCount = (entities.applications || []).filter(function (item) { return !item.legacyProjectLink && (!item.status || item.status !== "legacy-project-link"); }).length;
    var evtCount = (entities.events || []).length;
    var registerCount = owner === "EVT" ? evtCount : nsaCount;
    var plannerCount = (entities.projects || []).filter(function (item) { return item.owner === owner; }).length;

    all("[data-program-owner]").forEach(function (button) {
      var active = button.getAttribute("data-program-owner") === owner;
      var configured = appConfig();
      button.hidden = Boolean(configured && button.getAttribute("data-program-owner") !== configured.owner);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    var configuredApp = appConfig();
    if (configuredApp) {
      all('[data-dashboard-kpi="' + (configuredApp.owner === "NSA" ? "events" : "applications") + '"]').forEach(function (node) { node.hidden = true; });
      all('[data-program-clear="' + (configuredApp.owner === "NSA" ? "evt" : "nsa") + '"]').forEach(function (node) { node.hidden = true; });
    }

    all('[data-program-owner-count="NSA"]').forEach(function (el) { el.textContent = String(nsaCount); });
    all('[data-program-owner-count="EVT"]').forEach(function (el) { el.textContent = String(evtCount); });
    setText('[data-program-header-count="register"]', registerCount);
    setText('[data-program-header-count="planner"]', plannerCount);
    setText("#program-header-title", owner === "EVT" ? "Event Space Remediation" : "Nature Strip Applications");

    if (typeof document !== "undefined" && document.body) {
      document.body.setAttribute("data-owner-mode", owner);
      document.body.classList.toggle("is-nsa-mode", owner === "NSA");
      document.body.classList.toggle("is-nature-mode", owner === "NSA");
      document.body.classList.toggle("is-evt-mode", owner === "EVT");
      document.body.classList.toggle("is-events-mode", owner === "EVT");
    }

    var active = destination();
    if (active === "register") {
      var regTitle = owner === "EVT" ? "Event Register" : "Nature Strip Application Register";
      setText("#program-header-module", "Register");
      var ctxTitle = one("#context-title");
      if (ctxTitle) ctxTitle.textContent = regTitle;
    }
  }

  function setWorkingContext(owner, projectId, selectFirstCard) {
    owner = owner === "EVT" ? "EVT" : "NSA";
    var configured = appConfig();
    if (configured && owner !== configured.owner) return Promise.reject(new Error("The " + owner + " workspace is outside this application."));
    projectId = String(projectId || "");
    return updateWorkspace(function (candidate) {
      candidate.workspace = candidate.workspace || {};
      var projectsForOwner = (candidate.entities.projects || []).filter(function (item) { return item.owner === owner; });
      var project = (candidate.entities.projects || []).find(function (item) { return item.id === projectId; });
      var sourceRecord = null;
      if (!project && selectFirstCard) {
        var activeDestination = destination(candidate.workspace.destination);
        if (activeDestination === "map" || activeDestination === "register") {
          var ownerRecords = owner === "EVT" ? (candidate.entities.events || []) : (candidate.entities.applications || []);
          sourceRecord = ownerRecords[0] || null;
          if (sourceRecord && UOS.ProgramModel && typeof UOS.ProgramModel.activeProjectForRegister === "function") {
            project = UOS.ProgramModel.activeProjectForRegister(candidate, sourceRecord);
          }
        } else {
          if (activeDestination === "costing") projectsForOwner.sort(function (left, right) { return String(left.title || left.name || left.id).localeCompare(String(right.title || right.name || right.id)); });
          project = projectsForOwner[0] || null;
        }
      }
      if (project) owner = project.owner;
      var sourceEntityId = sourceRecord ? String(sourceRecord.id || "") : (project ? String(project.applicationId || project.eventId || project.id || "") : "");
      candidate.workspace.ownerMode = owner;
      candidate.workspace.selectedProjectId = project ? project.id : "";
      candidate.workspace.selectedEntityId = sourceEntityId;
      candidate.workspace.register = candidate.workspace.register || {};
      candidate.workspace.register.filters = candidate.workspace.register.filters || {};
      candidate.workspace.register.filters.ownership = owner;
      candidate.workspace.register.filters.statuses = [];
      candidate.workspace.costing = candidate.workspace.costing || {};
      candidate.workspace.costing.mode = owner === "EVT" ? "events" : "applications";
      candidate.workspace.costing.selectedProjectId = project ? project.id : "";
      candidate.workspace.costing.jobId = "";
      candidate.workspace.planner = candidate.workspace.planner || {};
      candidate.workspace.planner.selectedProjectId = project ? project.id : "";
      candidate.workspace.scheduler = candidate.workspace.scheduler || {};
      candidate.workspace.scheduler.filters = candidate.workspace.scheduler.filters || {};
      candidate.workspace.scheduler.filters.ownership = [owner];
      candidate.workspace.scheduler.selectedProjectId = project ? project.id : "";
      candidate.workspace.scheduler.panelMode = "projects";
      return candidate;
    });
  }

  function resolveWorkingContext(workspace, entityId) {
    var entities = workspace && workspace.entities || {};
    var id = String(entityId || "");
    var projects = entities.projects || [];
    var applications = entities.applications || [];
    var events = entities.events || [];
    var jobs = entities.jobs || [];
    var geometries = entities.geometries || [];
    var project = projects.find(function (item) { return item.id === id; }) || null;
    var job = jobs.find(function (item) { return item.id === id; }) || null;
    var geometry = geometries.find(function (item) { return item.id === id; }) || null;
    var register = applications.concat(events).find(function (item) { return item.id === id; }) || null;
    var sourceKind = geometry ? "geometry" : (job ? "job" : (project ? "project" : (register ? "register" : "")));

    if (!project && job && job.projectId) project = projects.find(function (item) { return item.id === job.projectId; }) || null;
    if (!project && geometry) {
      var geometryProjectId = geometry.projectId || geometry.payload && geometry.payload.projectId;
      project = projects.find(function (item) { return item.id === geometryProjectId; }) || null;
    }
    if (!project && register && UOS.ProgramModel && typeof UOS.ProgramModel.activeProjectForRegister === "function") {
      project = UOS.ProgramModel.activeProjectForRegister(workspace, register);
    }
    if (!register && project) {
      register = applications.concat(events).find(function (item) {
        return item.id === project.applicationId || item.id === project.eventId || item.projectId === project.id;
      }) || null;
    }
    return {
      owner: project && project.owner || register && register.owner || job && job.owner || "",
      sourceKind: sourceKind,
      registerId: register && register.id || "",
      projectId: project && project.id || "",
      jobId: job && job.id || "",
      geometryId: geometry && geometry.id || ""
    };
  }

  function applyWorkingContext(candidate, entityId) {
    candidate.workspace = candidate.workspace || {};
    var ui = candidate.workspace;
    var context = resolveWorkingContext(candidate, entityId);
    if (!context.owner && !context.registerId && !context.projectId) return context;
    if (context.owner === "NSA" || context.owner === "EVT") ui.ownerMode = context.owner;
    ui.selectedEntityId = context.registerId || context.projectId || String(entityId || "");
    ui.selectedProjectId = context.projectId;
    ui.selectedJobId = context.jobId;
    ui.planner = ui.planner || {};
    ui.planner.selectedProjectId = context.projectId;
    ui.costing = ui.costing || {};
    ui.costing.mode = context.owner === "EVT" ? "events" : "applications";
    ui.costing.selectedProjectId = context.projectId;
    ui.costing.jobId = context.jobId || "";
    ui.scheduler = ui.scheduler || {};
    ui.scheduler.filters = ui.scheduler.filters || {};
    if (context.owner) ui.scheduler.filters.ownership = [context.owner];
  ui.scheduler.selectedProjectId = context.projectId;
  ui.scheduler.selectedId = context.jobId || "";
  ui.map = ui.map || {};
  ui.map.ownerMode = context.owner || ui.ownerMode || "";
  ui.map.selectedRegisterId = context.registerId || "";
  ui.map.selectedProjectId = context.projectId || "";
  ui.map.selectedLocationId = "";
  ui.map.selectedGeometryId = "";
  ui.map.scopeMode = context.sourceKind === "project" || context.sourceKind === "job" || context.sourceKind === "geometry" ? "projects" : "register";
  ui.map.inspectorMode = context.sourceKind === "geometry" ? "polygon" : (ui.map.scopeMode === "projects" ? "project" : "register");
  return context;
  }

  function projectHasPolygon(workspace, projectId) {
    var geometries = workspace && workspace.entities && workspace.entities.geometries || [];
    return Boolean(projectId && geometries.some(function (geometry) {
      var ownerProjectId = geometry.projectId || geometry.payload && geometry.payload.projectId;
      var kind = String(geometry.geometryKind || geometry.geometry && geometry.geometry.type || "").toLowerCase();
      return ownerProjectId === projectId && (kind === "polygon" || kind === "multipolygon");
    }));
  }

  function prepareWorkingContextForDestination(candidate, next) {
    var ui = candidate.workspace = candidate.workspace || {};
  /* The outer Register selection is the ownership boundary. */
  var sourceId = ui.selectedEntityId || ui.selectedJobId || ui.selectedProjectId;
    var context = applyWorkingContext(candidate, sourceId);
    if (next === "scheduler") {
      ui.scheduler = ui.scheduler || {};
      ui.scheduler.panelMode = "projects";
      ui.scheduler.detail = false;
      ui.scheduler.inspectorMode = "list";
    }
    if (next === "map") {
      ui.map = ui.map || {};
      ui.map.ownerMode = context.owner || ui.ownerMode || ui.map.ownerMode || "";
    ui.map.selectedRegisterId = context.registerId || "";
    ui.map.selectedProjectId = context.projectId || "";
      if (context.sourceKind === "geometry") {
        ui.map.scopeMode = "projects";
        ui.map.selectedGeometryId = context.geometryId || "";
        ui.map.selectedLocationId = "";
        ui.map.inspectorMode = "polygon";
      } else if (context.sourceKind === "project" || context.sourceKind === "job") {
        ui.map.scopeMode = "projects";
        ui.map.selectedGeometryId = "";
        ui.map.selectedLocationId = "";
        ui.map.inspectorMode = "project";
      } else {
        ui.map.scopeMode = "register";
        ui.map.selectedGeometryId = "";
        ui.map.selectedLocationId = "";
        ui.map.inspectorMode = "register";
      }
    }
    return context;
  }

  function selectWorkingItem(entityId) {
    return updateWorkspace(function (candidate) {
      applyWorkingContext(candidate, entityId);
      return candidate;
    });
  }

  function navigateWithContext(next, entityId) {
    if (state.phase !== "ready" || !state.workspace) return Promise.resolve(null);
    if (DESTINATIONS.indexOf(next) < 0) return Promise.resolve(state.workspace);

    var sourceId = String(entityId || "");
    if (!sourceId) {
      var ui = state.workspace.workspace || {};
      sourceId = String(ui.selectedJobId || ui.selectedProjectId || ui.selectedEntityId || "");
    }

    var before = {
      applications: collection("applications").length,
      events: collection("events").length,
      projects: collection("projects").length,
      jobs: collection("jobs").length,
      costingLines: collection("costingLines").length,
      quotes: collection("quotes").length
    };

    return updateWorkspace(function (candidate) {
      if (sourceId) applyWorkingContext(candidate, sourceId);
      prepareWorkingContextForDestination(candidate, next);
      candidate.workspace.destination = next;

      var after = candidate.entities || {};
      var counts = {
        applications: (after.applications || []).length,
        events: (after.events || []).length,
        projects: (after.projects || []).length,
        jobs: (after.jobs || []).length,
        costingLines: (after.costingLines || []).length,
        quotes: (after.quotes || []).length
      };
      Object.keys(before).forEach(function (key) {
        if (counts[key] !== before[key]) throw new Error("Navigation must not create, remove or repair " + key + ".");
      });
      return candidate;
    }).then(function (workspace) {
      if (workspace) focusDestination(next);
      return workspace;
    });
  }

  var isUpdatingRailTheme = false;
  function updateRailTheme() {
    if (isUpdatingRailTheme || typeof document === "undefined" || !document) return;
    isUpdatingRailTheme = true;
    try {
      var rail = document.querySelector(".program-rail") || document.querySelector(".uos-rail") || document.body;

      var activeNav = document.querySelector("[data-program-destination][aria-current='page']") ||
                      document.querySelector("[data-program-destination].is-active");
      var activeModule = activeNav ? activeNav.getAttribute("data-program-destination") : "";
      if (!activeModule && state.workspace && state.workspace.workspace) {
        activeModule = state.workspace.workspace.destination || "";
      }

      var isNsa = workingOwner(state.workspace) === "NSA";
      var isEvt = !isNsa;

      if (rail && rail.classList && typeof rail.classList.toggle === "function") {
        rail.classList.toggle("is-nsa-mode", isNsa);
        rail.classList.toggle("is-evt-mode", isEvt);
      }
      if (document.body && document.body.classList && typeof document.body.classList.toggle === "function") {
        document.body.classList.toggle("is-nsa-mode", isNsa);
        document.body.classList.toggle("is-evt-mode", isEvt);
      }
    } finally {
      isUpdatingRailTheme = false;
    }
  }

  function observeHeaderControls() {
    if (typeof MutationObserver === "undefined" || typeof document === "undefined" || !document) return;
    var controls = document.querySelectorAll("[data-module-controls]");
    if (!controls.length) return;
    var observer = new MutationObserver(function () {
      updateRailTheme();
    });
    Array.prototype.forEach.call(controls, function (ctrl) {
      observer.observe(ctrl, { attributes: true, subtree: true, attributeFilter: ["class", "aria-pressed", "hidden"] });
    });
  }

  
  function syncPrivacyButton() {
    var priv = UOS.ProgramPrivacy;
    var isPriv = priv && typeof priv.isEnabled === "function" ? priv.isEnabled() : false;
    all('[data-action="toggle-privacy"],.program-header-privacy-btn').forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(isPriv));
      btn.setAttribute("aria-label", isPriv ? "Disable Privacy Mode" : "Enable Privacy Mode");
      btn.classList.toggle("is-active", isPriv);
      var offIcon = btn.querySelector(".privacy-icon--off");
      var onIcon = btn.querySelector(".privacy-icon--on");
      if (offIcon) offIcon.style.display = isPriv ? "none" : "block";
      if (onIcon) onIcon.style.display = isPriv ? "block" : "none";
      btn.setAttribute("data-uos-tooltip", isPriv ? "Disable Privacy Mode  -  Displays applicant contact details" : "Enable Privacy Mode  -  Masks applicant contact details");
    });
  }

  function render() {
    var phase = state.phase;
    setHidden("[data-program-loading],#workspace-loading", phase !== "loading");
    setHidden("[data-program-migration]", phase !== "migration");
    setHidden("[data-program-error]", phase !== "error");
    setHidden("[data-program-workspace]", phase !== "ready");
    programStatus(phase === "loading" ? "Loading workspace" : phase === "migration" ? "Migration review required" : phase === "ready" ? "Saved" : "Workspace unavailable", phase === "loading" ? "loading" : phase === "migration" ? "warning" : phase === "ready" ? "ready" : "error");
    setText("[data-program-error-message],#workspace-error-message", state.error ? state.error.message : "");
    all("[data-program-apply],[data-program-start-empty]").forEach(function (button) { button.disabled = state.busy || (button.matches("[data-program-apply]") && state.staged && state.staged.preview && state.staged.preview.blocked); });
    if (phase === "migration") renderMigration();
    if (phase === "ready") renderWorkspace();
  }

  function activateValidated(workspace, options) {
    invalidateEntityIndex();
    state.workspace = workspace;
    var launchOwner = state.entryOwnerApplied ? "" : entryOwner();
    var isFirstLaunchEntry = !state.entryOwnerApplied;
    state.entryOwnerApplied = true;
    if (isFirstLaunchEntry && (launchOwner || new URLSearchParams(window.location.search || "").has("owner"))) {
      state.workspace.workspace = state.workspace.workspace || {};
      var launchUi = state.workspace.workspace;
      if (launchOwner) launchUi.ownerMode = launchOwner;
      launchUi.destination = "register";
      launchUi.inspector = launchUi.inspector || {};
      launchUi.inspector.mode = (launchOwner || launchUi.ownerMode) === "EVT" ? "events" : "applications";
      launchUi.costing = launchUi.costing || {};
      launchUi.costing.mode = (launchOwner || launchUi.ownerMode) === "EVT" ? "events" : "applications";
      launchUi.scheduler = launchUi.scheduler || {};
      launchUi.scheduler.filters = launchUi.scheduler.filters || {};
      launchUi.scheduler.filters.ownership = [launchOwner || launchUi.ownerMode || "NSA"];
      launchUi.map = launchUi.map || {};
      if (launchOwner) launchUi.map.ownerMode = launchOwner;
      var selectedProject = collection("projects").find(function (item) { return item.id === launchUi.selectedProjectId; });
      if (selectedProject && selectedProject.owner !== (launchOwner || launchUi.ownerMode)) {
        launchUi.selectedProjectId = "";
        launchUi.selectedEntityId = "";
        launchUi.costing.selectedProjectId = "";
        launchUi.costing.jobId = "";
        launchUi.scheduler.selectedProjectId = "";
        launchUi.map.selectedProjectId = "";
      }
    }
    UOS.ProgramModel.assertValid(state.workspace);
    state.staged = null;
    state.error = null;
    state.busy = false;
    state.phase = "ready";
    render();
    document.dispatchEvent(new CustomEvent("uos:program-ready", { detail: { workspace: clone(state.workspace) } }));
    applyInitialDeepLink();
    if (!options || options.focus !== false) {
      var initialDest = destination(state.workspace.workspace && state.workspace.workspace.destination);
      focusDestination(initialDest);
    }
    return state.workspace;
  }
  function activate(workspace, options) { return activateValidated(UOS.ProgramModel.normalize(workspace), options); }

  var mutationQueue = Promise.resolve();
  var pendingWorkspaceMutations = 0;

  function updateWorkspace(mutator, mutationOptions) {
    if (state.phase !== "ready" || !state.workspace || typeof mutator !== "function") return Promise.resolve(null);

    pendingWorkspaceMutations += 1;
    mutationQueue = mutationQueue.catch(function () { /* one failed mutation must not block later edits */ }).then(function () {
      if (state.phase !== "ready" || !state.workspace) return null;
      var beforeMutation = clone(state.workspace);
      var mutationStarted = window.performance && typeof window.performance.now === "function" ? window.performance.now() : Date.now();
      var mutationCommand = mutationOptions && mutationOptions.command || mutator.commandName || mutator.name || "ProgramApp.updateWorkspace";
      var candidate = clone(state.workspace);
      try {
        var replacement = mutator(candidate);
        if (replacement) candidate = replacement;
        candidate.updatedAt = new Date().toISOString();
        if (!UOS.ProgramModel.isNormalized || !UOS.ProgramModel.isNormalized(candidate)) candidate = UOS.ProgramModel.normalize(candidate);
        if (UOS.ProgramBudget && typeof UOS.ProgramBudget.assertTransition === "function") UOS.ProgramBudget.assertTransition(beforeMutation, candidate);
      } catch (error) {
        return Promise.reject(error);
      }
      if (state.isSessionCleared) {
        state.workspace = candidate;
        render();
        document.dispatchEvent(new CustomEvent("uos:program-ready", { detail: { workspace: clone(state.workspace) } }));
        publishWorkspaceChange(beforeMutation, state.workspace, mutationCommand, mutationStarted);
        return candidate;
      }
      state.busy = true;
      programStatus("Saving…", "loading");
   return UOS.ProgramStorage.saveValidated(candidate).then(function (saved) {
        var activated = activateValidated(saved, { focus: false });
        publishWorkspaceChange(beforeMutation, activated, mutationCommand, mutationStarted);
        return activated;
      }, saveFailed);
    });

    return mutationQueue.then(function (result) {
      pendingWorkspaceMutations = Math.max(0, pendingWorkspaceMutations - 1);
      return result;
    }, function (error) {
      pendingWorkspaceMutations = Math.max(0, pendingWorkspaceMutations - 1);
      throw error;
    });
  }

  function publishWorkspaceChange(before, after, command, started) {
    var ended = window.performance && typeof window.performance.now === "function" ? window.performance.now() : Date.now();
    var duration = Math.max(0, ended - started);
    var record = null;
    if (UOS.ProgramObservability && typeof UOS.ProgramObservability.recordMutation === "function") {
      record = UOS.ProgramObservability.recordMutation({
        before: before,
        after: after,
        command: command,
        durationMs: duration
      });
    }
    var detail = {
      workspace: clone(after),
      after: clone(after),
      before: clone(before),
      mutation: record,
      revision: record ? record.revision : (after && after.workspaceRevision) || 0,
      command: command || (record ? record.command : "ProgramApp.updateWorkspace"),
      changed: record ? record.changed : {},
      operations: record ? record.operations : {},
      durationMs: record ? record.durationMs : duration
    };
    document.dispatchEvent(new CustomEvent("uos:workspace-changed", { detail: detail }));
    return record;
  }

  function resolveDeepLink(search) {
    if (!UOS.ProgramMigration || typeof UOS.ProgramMigration.mapLegacyDeepLink !== "function") return null;
    return UOS.ProgramMigration.mapLegacyDeepLink(search, function (link) {
      if (typeof UOS.ProgramModel.resolveLegacyEntity === "function") return UOS.ProgramModel.resolveLegacyEntity(state.workspace, link);
      return "";
    });
  }

  function applyInitialDeepLink() {
    if (state.deepLinkApplied) return;
    state.deepLinkApplied = true;
    var search = typeof window !== "undefined" && window.location && window.location.search ? window.location.search : "";
    var targetId = resolveDeepLink(search);
    if (targetId && UOS.ProgramApp) {
      UOS.ProgramApp.navigate("register", { recordId: targetId });
    }
  }

  function countEntities(workspace) {
    if (!workspace || !workspace.entities) return 0;
    var total = 0;
    ["applications", "events", "projects", "jobs", "costingLines"].forEach(function (key) {
      if (Array.isArray(workspace.entities[key])) total += workspace.entities[key].length;
    });
    return total;
  }

  function stageLegacy() {
    return UOS.ProgramStorage.stageLegacySources().then(function (sources) {
      state.staged = UOS.ProgramMigration.stage(sources);
      state.phase = "migration";
      render();
      return state.staged;
    });
  }

  function restoreStoredData() {
    state.isSessionCleared = false;
    return UOS.ProgramStorage.get().then(function (ws) {
      if (ws && (countEntities(ws) > 0 || ws.migration && ws.migration.recovery)) {
        return repairStoredWorkspace(ws);
      }
      return activate(UOS.ProgramModel.blank());
    }).then(function (restored) {
      if (UOS.ProgramPrivacy && typeof UOS.ProgramPrivacy.resetForWorkspaceActivation === "function") {
        UOS.ProgramPrivacy.resetForWorkspaceActivation("restore");
      }
      return restored;
    });
  }

  function repairStoredWorkspace(workspace) {
    if (!workspace || !UOS.ProgramModel) return activate(workspace);
    var nature = typeof UOS.ProgramModel.repairNatureProjectScope === "function" ? UOS.ProgramModel.repairNatureProjectScope(workspace) : { workspace: workspace, changed: false, removed: {} };
 var geometryRepair = typeof UOS.ProgramModel.repairLegacyGeometryDuplicates === "function" ? UOS.ProgramModel.repairLegacyGeometryDuplicates(nature.workspace) : { workspace: nature.workspace, changed: false, removed: {} };
 var placeholderRepair = typeof UOS.ProgramModel.repairGeneratedPlaceholderJobs === "function" ? UOS.ProgramModel.repairGeneratedPlaceholderJobs(geometryRepair.workspace) : { workspace: geometryRepair.workspace, changed: false, removed: {} };
 if (!nature.changed && !geometryRepair.changed && !placeholderRepair.changed) return activate(placeholderRepair.workspace);
 var removedTotal = 0;
 [nature, geometryRepair, placeholderRepair].forEach(function (repair) {
   Object.keys(repair.removed || {}).forEach(function (key) { removedTotal += Math.max(0, Number(repair.removed[key]) || 0); });
 });
 /* Repair metadata alone is not authority to revise operational data at startup. */
 if (!removedTotal) return activate(workspace);
 var validatedRepair = UOS.ProgramModel.normalize(placeholderRepair.workspace);
   return UOS.ProgramStorage.saveValidated(validatedRepair).then(function (saved) {
      var activated = activate(saved);
      var removed = nature.removed && nature.removed.projects || 0;
      if (removed && UOS.toast) UOS.toast("Removed " + removed + " synthetic NSA Project" + (removed === 1 ? "" : "s") + " and their related records.", "success");
      var polygons = geometryRepair.removed && geometryRepair.removed.geometries || 0;
      if (polygons && UOS.toast) UOS.toast("Removed " + polygons + " duplicate mapped polygons and their duplicate work records.", "success");
      var placeholderJobs = placeholderRepair.removed && placeholderRepair.removed.jobs || 0;
      if (placeholderJobs && UOS.toast) UOS.toast("Removed " + placeholderJobs + " obsolete numbered placeholder jobs.", "success");
      return activated;
    });
  }
function resetStartupWorkspace(workspace) {
  if (!workspace || !UOS.ProgramModel || typeof UOS.ProgramModel.resetOperationalBaseline !== "function") return repairStoredWorkspace(workspace);
  var result = UOS.ProgramModel.resetOperationalBaseline(workspace);
  if (!result.changed) return repairStoredWorkspace(result.workspace);
   return UOS.ProgramStorage.saveValidated(result.workspace, null, { baseRevision: Math.max(0, Number(workspace.workspaceRevision) || 0), mutationKind: "business" }).then(function (saved) {
    if (UOS.toast) UOS.toast("Operational workspace reset. The default Rate Catalog is ready.", "success");
    return activate(saved);
  });
}

  


  function updateFilterDrawerBadge(moduleKey, activeFilterCount) {
    var badge = document.querySelector('[data-filter-drawer-badge="' + moduleKey + '"]');
    var reset = document.querySelector('[data-filter-drawer-reset="' + moduleKey + '"]');
    if (reset) reset.hidden = activeFilterCount <= 0;
    if (!badge) return;
    if (activeFilterCount > 0) {
      badge.textContent = String(activeFilterCount);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function resetFilterDrawer(moduleKey) {
    var drawer = document.querySelector('[data-filter-drawer="' + moduleKey + '"]');
    var toggle = drawer && drawer.querySelector("[data-filter-drawer-toggle]");
    var controlsId = toggle && toggle.getAttribute("aria-controls");
    var body = (controlsId && document.getElementById(controlsId)) || document.querySelector('[data-filter-drawer-body="' + moduleKey + '"]');
    if (!body) return;

    Array.prototype.forEach.call(body.querySelectorAll('input[type="search"]'), function (input) {
      if (!input.value) return;
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    Array.prototype.forEach.call(body.querySelectorAll("select[data-scheduler-filter]"), function (select) {
      if (select.value === "all") return;
      select.value = "all";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    var allJobSelectors = {
      costing: '[data-costing-job-filter="all"]',
      "scheduler-sidebar": '[data-scheduler-sidebar-job-filter="all"]',
      quotes: '[data-quote-job-filter="all"]'
    };
    var allJob = allJobSelectors[moduleKey] && body.querySelector(allJobSelectors[moduleKey]);
    if (allJob && allJob.getAttribute("aria-pressed") !== "true") allJob.click();

    var activeSelector = [
      "[data-register-status-filter].is-active",
      "[data-map-status-filter].is-active",
      "[data-map-spatial-filter].is-active",
      "[data-planner-status-filter].is-active",
      "[data-costing-status-filter].is-active",
      "[data-scheduler-sidebar-status-filter].is-active",
      "[data-quote-status-filter].is-active"
    ].join(",");
    var remaining = body.querySelector(activeSelector);
    var guard = 0;
    while (remaining && guard < 100) {
      remaining.click();
      remaining = body.querySelector(activeSelector);
      guard += 1;
    }
  }

  function init() {
    state.phase = "loading";
    state.error = null;
    state.isSessionCleared = false;
    render();
   return (typeof UOS.ProgramStorage.getRaw === "function" ? UOS.ProgramStorage.getRaw() : UOS.ProgramStorage.get()).then(function (workspace) {
      /* A stored workspace may legitimately lack a rollout marker after an
         import. Startup is never authority to delete operational records. */
      if (workspace) return repairStoredWorkspace(workspace);
      return activate(UOS.ProgramModel.blank());
    }).catch(function (error) {
      if (recoverableStartupError(error)) return openStartupImportRecovery(error);
      return fail(error);
    });
  }

  function applyMigration() {
    if (state.phase !== "migration" || !state.staged || state.busy) return Promise.resolve(null);
    state.busy = true;
    render();
    var summary = clone(state.staged.preview || {});
   return UOS.ProgramMigration.apply(state.staged, { commit: function (workspace) { return UOS.ProgramStorage.save(workspace); } }).then(function (workspace) {
      var activated = activate(workspace);
      UOS.ProgramStorage.markMigrationComplete(summary).catch(function (error) { if (window.console && console.warn) console.warn("Migration marker could not be saved:", error); });
      return activated;
    }).catch(fail);
  }

  function startEmpty() {
    if (state.phase !== "migration" || state.busy) return Promise.resolve(null);
    state.busy = true;
    render();
    var workspace = UOS.ProgramModel.blank();
    workspace.migration.status = "complete";
    workspace.migration.migratedAt = new Date().toISOString();
    workspace.migration.sources = [];
    workspace.migration.warnings = [];
   var validatedBlank = UOS.ProgramModel.normalize(workspace);
   return UOS.ProgramStorage.saveValidated(validatedBlank).then(function (saved) {
      var activated = activate(saved);
      UOS.ProgramStorage.markMigrationComplete({ decision: "start-empty", counts: UOS.ProgramMigration.countPreview(saved) }).catch(function (error) { if (window.console && console.warn) console.warn("Migration marker could not be saved:", error); });
      return activated;
    }).catch(fail);
  }

  function confirmStartEmpty() {
    if (!UOS.dialogs || typeof UOS.dialogs.confirm !== "function") return startEmpty();
    return UOS.dialogs.confirm({
      title: "Start with an empty workspace?",
      message: "The staged records will not be migrated. Your legacy Nature Strip and Remediation workspaces will remain unchanged and can be imported later.",
      confirmLabel: "Start empty",
      cancelLabel: "Return to migration",
      danger: true
    }).then(function (confirmed) { return confirmed ? startEmpty() : null; });
  }

  function navigate(next, options) {
    if (state.phase !== "ready" || !state.workspace) return Promise.resolve(null);
    if (DESTINATIONS.indexOf(next) < 0) return Promise.resolve(state.workspace);
    var currentDestination = destination(state.workspace.workspace && state.workspace.workspace.destination);
    var recordModules = ["planner", "map", "costing", "scheduler", "quotes"];
    var requestedRecordId = options && options.recordId || "";
    if (recordModules.indexOf(next) >= 0 && !requestedRecordId) {
      var currentContext = resolveWorkingContext(state.workspace, state.workspace.workspace && state.workspace.workspace.selectedEntityId);
      requestedRecordId = currentContext.registerId || "";
      if (!requestedRecordId) {
        var owner = workingOwner(state.workspace);
        var records = owner === "EVT" ? collection("events") : collection("applications");
        requestedRecordId = records.length ? records[0].id : "";
      }
      if (!requestedRecordId) next = "register";
    }
    if (currentDestination === next && !requestedRecordId) return Promise.resolve(state.workspace);

    /* Destination is UI state. Paint it immediately, but persist it through the
       same mutation queue as business edits. This prevents a delayed UI-only save
       from overwriting a newer Project/Job/Quote mutation with an older snapshot. */
    var candidate = clone(state.workspace);
    candidate.workspace = candidate.workspace || {};
    if (requestedRecordId) {
      applyWorkingContext(candidate, requestedRecordId);
      candidate.workspace.selectedEntityId = requestedRecordId;
      candidate.workspace.register = candidate.workspace.register || {};
      candidate.workspace.register.filters = candidate.workspace.register.filters || {};
      candidate.workspace.register.filters.query = "";
      candidate.workspace.register.filters.statuses = [];
    }
    if (next === "data" && currentDestination !== "data") candidate.workspace.dataReturnDestination = currentDestination;
    prepareWorkingContextForDestination(candidate, next);
    candidate.workspace.destination = next;
    state.workspace = candidate;
    invalidateEntityIndex();
    render();
    document.dispatchEvent(new CustomEvent("uos:program-ready", { detail: { workspace: clone(state.workspace), navigation: true } }));
    focusDestination(next);

   if (state.isSessionCleared) return Promise.resolve(state.workspace);

    pendingWorkspaceMutations += 1;
    mutationQueue = mutationQueue.catch(function () { /* keep later saves usable */ }).then(function () {
      /* Yield once so the newly selected module can paint before normalize/validate. */
      return new Promise(function (resolve) { setTimeout(resolve, 0); });
    }).then(function () {
      if (state.phase !== "ready" || !state.workspace) return null;
      /* Clone the latest workspace only when this queued persistence step runs.
         Do not reuse the earlier navigation snapshot: business edits may have
         happened while this operation was waiting. */
      var latest = clone(state.workspace);
      latest.workspace = latest.workspace || {};
      if (requestedRecordId) {
        applyWorkingContext(latest, requestedRecordId);
        latest.workspace.selectedEntityId = requestedRecordId;
      }
      if (next === "data" && currentDestination !== "data") latest.workspace.dataReturnDestination = currentDestination;
      prepareWorkingContextForDestination(latest, next);
      latest.workspace.destination = next;
      latest = UOS.ProgramModel.normalize(latest);
   return UOS.ProgramStorage.saveValidated(latest).then(function () {
        programStatus("Saved", "ready");
        return state.workspace;
      }).catch(saveFailed);
    });

    return mutationQueue.then(function (result) {
      pendingWorkspaceMutations = Math.max(0, pendingWorkspaceMutations - 1);
      return result;
    }, function (error) {
      pendingWorkspaceMutations = Math.max(0, pendingWorkspaceMutations - 1);
      throw error;
    });
  }

  var navigationFocusCard = null;
  function emphasizeNavigationCard(card) {
    if (!card || !card.classList) return;
    if (navigationFocusCard && navigationFocusCard !== card && navigationFocusCard.classList) {
      navigationFocusCard.classList.remove("is-navigation-focus");
    }
    navigationFocusCard = card;
    card.classList.remove("is-navigation-focus");
    void card.offsetWidth;
    card.classList.add("is-navigation-focus");
  }

  function clearNavigationFocusOnNewCard(target) {
    if (!navigationFocusCard || !target || !target.closest) return;
    var card = target.closest([
      "tr[data-register-record]",
      "[data-event-card-id]",
      "[data-shape-card-id]",
      "[data-planner-project-id]",
      "[data-costing-project-id]",
      "[data-scheduler-project]",
      "[data-scheduler-job]",
      "[data-quote-project-id]"
    ].join(","));
    if (!card || card === navigationFocusCard) return;
    if (navigationFocusCard.classList) navigationFocusCard.classList.remove("is-navigation-focus");
    navigationFocusCard = null;
  }

  function focusDestination(next) {
    var view = one('[data-program-view="' + next + '"]');
    if (!view) return;
    var selectedCardSelectors = {
      register: ".program-table-wrap tr[data-register-record].is-selected, .program-table-wrap tr.is-selected, [data-register-record].is-selected",
      map: '[data-sidebar-pane="shapes"]:not([hidden]) [data-shape-card-id].is-selected, [data-sidebar-pane="list"]:not([hidden]) [data-event-card-id].is-selected',
      planner: "[data-planner-project-id].is-selected",
      costing: "[data-costing-project-id].is-selected",
      scheduler: "[data-scheduler-project].is-selected, [data-scheduler-job].is-selected",
      quotes: "[data-quote-project-id].is-selected"
    };
    var selectedCard = selectedCardSelectors[next] ? view.querySelector(selectedCardSelectors[next]) : null;
    if (selectedCard) {
      if (typeof selectedCard.focus === "function") selectedCard.focus({ preventScroll: true });
      emphasizeNavigationCard(selectedCard);
      if (UOS.ProgramCardVisibility && typeof UOS.ProgramCardVisibility.schedule === "function") UOS.ProgramCardVisibility.schedule(selectedCard);
      return;
    }
    var heading = view.querySelector("h2[id],h3[id]");
    var target = heading || view;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    if (typeof target.focus === "function") target.focus({ preventScroll: true });
  }

  function bind() {
    document.addEventListener("pointerdown", function (event) {
      clearNavigationFocusOnNewCard(event.target);
    }, true);
    document.addEventListener("focusin", function (event) {
      clearNavigationFocusOnNewCard(event.target);
    });
    document.addEventListener("click", function (event) {
     var resetBtn = event.target.closest("[data-filter-drawer-reset]");
      if (resetBtn) {
        event.preventDefault();
        event.stopPropagation();
        resetFilterDrawer(resetBtn.getAttribute("data-filter-drawer-reset"));
        return;
      }
      var toggleBtn = event.target.closest("[data-filter-drawer-toggle]");
      if (!toggleBtn) return;
      var drawer = toggleBtn.closest("[data-filter-drawer]");
      var drawerKey = drawer ? drawer.getAttribute("data-filter-drawer") : "";
      var controlsId = toggleBtn.getAttribute("aria-controls");
      var body = (controlsId ? document.getElementById(controlsId) : null)
        || (drawerKey === "register" ? document.getElementById("registerFilterDrawerBody") : null)
        || (drawerKey === "scheduler" ? document.getElementById("schedulerFilterDrawerBody") : null)
        || (drawerKey ? document.querySelector('[data-filter-drawer-body="' + drawerKey + '"]') : null)
        || (drawer ? drawer.querySelector("[data-filter-drawer-body]") : null);
      if (!body) return;
      var isExpanded = toggleBtn.getAttribute("aria-expanded") === "true";
      toggleBtn.setAttribute("aria-expanded", String(!isExpanded));
      body.hidden = isExpanded;
      if (!isExpanded) {
        var input = body.querySelector('input[type="search"]');
        if (input) {
          setTimeout(function () { input.focus(); }, 50);
        }
      }
    });
    document.addEventListener("keydown", function (event) {
      var resetBtn = event.target.closest && event.target.closest("[data-filter-drawer-reset]");
      if (!resetBtn || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      event.stopPropagation();
      resetFilterDrawer(resetBtn.getAttribute("data-filter-drawer-reset"));
    });
    document.addEventListener("uos:filter-drawer-count", function (event) {
      var detail = event.detail || {};
      updateFilterDrawerBadge(detail.key, Number(detail.count) || 0);
    });
    if (typeof MutationObserver === "function") {
      var filterBadgeObserver = new MutationObserver(function () {
        Array.prototype.forEach.call(document.querySelectorAll("[data-filter-drawer-badge]"), function (badge) {
          var key = badge.getAttribute("data-filter-drawer-badge");
          var reset = document.querySelector('[data-filter-drawer-reset="' + key + '"]');
          if (reset) reset.hidden = badge.hidden || !(Number(badge.textContent) > 0);
        });
      });
      Array.prototype.forEach.call(document.querySelectorAll("[data-filter-drawer-badge]"), function (badge) {
        filterBadgeObserver.observe(badge, { attributes: true, childList: true, characterData: true, subtree: true });
      });
    }
    syncPrivacyButton();
    observeHeaderControls();
    document.addEventListener("click", function (event) {
      var privBtn = event.target.closest('[data-action="toggle-privacy"],.program-header-privacy-btn');
      if (privBtn) {
        if (UOS.ProgramPrivacy && typeof UOS.ProgramPrivacy.toggle === "function") {
          UOS.ProgramPrivacy.toggle();
        }
        return;
      }
    });
    document.addEventListener("uos:privacy-changed", function () {
      syncPrivacyButton();
    });

    document.addEventListener("keydown", function (event) {
      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        var keyNum = parseInt(event.key, 10);
        if (keyNum >= 1 && keyNum <= 9) {
          var targetTag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
          if (targetTag !== "input" && targetTag !== "textarea" && targetTag !== "select" && !(event.target && event.target.isContentEditable)) {
            var shortcutDestinations = [
              "dashboard",
              "register",
              "planner",
              "map",
              "costing",
              "scheduler",
              "quotes",
              "reports",
              "data"
            ];
            var dest = shortcutDestinations[keyNum - 1];
            if (dest) {
              event.preventDefault();
              navigate(dest);
              return;
            }
          }
        }
      }

      var customButton = event.target && event.target.closest ? event.target.closest('[role="button"][tabindex]') : null;
      if (!customButton || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      customButton.click();
    });
    document.addEventListener("click", function (event) {
      var apply = event.target.closest("[data-program-apply]");
      var empty = event.target.closest("[data-program-start-empty]");
      var nav = event.target.closest("[data-program-destination]");
      var open = event.target.closest("[data-open-destination]");
      var retry = event.target.closest("[data-program-retry],#workspace-retry");
      var reviewLegacy = event.target.closest("[data-program-review-legacy]");
      var ownerContext = event.target.closest("button[data-program-owner]");
      var collapse = event.target.closest(".uos-rail__collapse, [data-rail-collapse], [data-rail-toggle], .program-rail");
      var modeSlider = event.target.closest("[data-pane-mode], [data-scheduler-pane-mode], [data-costing-pane-mode], [data-quotes-pane-mode], .program-register-pane-picker button");

      if (ownerContext) { event.preventDefault(); setWorkingContext(ownerContext.getAttribute("data-program-owner"), "", true).then(function () { if (state.workspace) focusDestination(destination(state.workspace.workspace && state.workspace.workspace.destination)); }); }
      else if (reviewLegacy) { event.preventDefault(); stageLegacy().catch(fail); }
      else if (apply) { event.preventDefault(); applyMigration(); }
      else if (empty) { event.preventDefault(); confirmStartEmpty(); }
      else if (nav) {
        event.preventDefault();
        var navDestination = nav.getAttribute("data-program-destination");
        var activeDestination = state.workspace && destination(state.workspace.workspace && state.workspace.workspace.destination);
        if (navDestination === "data" && activeDestination === "data") navigate(returnDestinationFromData(state.workspace));
        else navigate(navDestination);
      }
      else if (open) { event.preventDefault(); navigate(open.getAttribute("data-open-destination")); }
      else if (retry) { event.preventDefault(); init(); }

      if (modeSlider || collapse || nav || open) {
        setTimeout(updateRailTheme, 0);
      }
    });
  }

  function adoptWorkspace(candidate, commitOptions) {
    if (state.phase !== "ready" || !state.workspace) return Promise.reject(new Error("The program application is not ready."));
   var normalized;
    try {
      normalized = UOS.ProgramModel.normalize(candidate);
    var localMigration = state.workspace && state.workspace.migration || {};
    normalized.migration = normalized.migration || {};
    if (localMigration.registerBaselineSanitation && localMigration.registerBaselineSanitation.id === UOS.ProgramModel.registerBaselineSanitationId) {
      normalized.migration.registerBaselineSanitation = clone(localMigration.registerBaselineSanitation);
    }
    if (localMigration.emptyOperationalBaseline && localMigration.emptyOperationalBaseline.id === UOS.ProgramModel.emptyOperationalBaselineId) {
      normalized.migration.emptyOperationalBaseline = clone(localMigration.emptyOperationalBaseline);
    }
      UOS.ProgramModel.assertValid(normalized);
    } catch (error) {
      return Promise.reject(error);
    }

    commitOptions = commitOptions || {};
    var baseRevision = commitOptions.baseRevision == null
      ? Math.max(0, Number(state.workspace && state.workspace.workspaceRevision) || 0)
      : Math.max(0, Number(commitOptions.baseRevision) || 0);
    state.busy = true;
    programStatus("Saving - ", "loading");

    pendingWorkspaceMutations += 1;
    mutationQueue = mutationQueue.catch(function () {}).then(function () {
      var currentRevision = Math.max(0, Number(state.workspace && state.workspace.workspaceRevision) || 0);
      if (currentRevision !== baseRevision) {
        return Promise.reject(new Error("Workspace changed after import staging; inspect the file again.")).catch(saveFailed);
      }
     return UOS.ProgramStorage.saveValidated(normalized, null, {
        baseRevision: baseRevision,
        mutationKind: commitOptions.mutationKind || "import"
      }).then(function (saved) {
        state.isSessionCleared = false;
        state.startupRecovery = false;
        removeStartupRecoveryNotice();
      state.workspace = saved;
      state.busy = false;
      invalidateEntityIndex();
      if (UOS.ProgramPrivacy && typeof UOS.ProgramPrivacy.resetForWorkspaceActivation === "function") {
        UOS.ProgramPrivacy.resetForWorkspaceActivation("import");
      }
      render();
        document.dispatchEvent(new CustomEvent("uos:program-ready", { detail: { workspace: clone(state.workspace) } }));
        programStatus("Ready", "ready");
        return clone(state.workspace);
      }).catch(function (err) {
        state.busy = false;
        saveFailed(err);
        throw err;
      });
    });

    return mutationQueue.then(function (result) {
      pendingWorkspaceMutations = Math.max(0, pendingWorkspaceMutations - 1);
      return result;
    }, function (error) {
      pendingWorkspaceMutations = Math.max(0, pendingWorkspaceMutations - 1);
      throw error;
    });
  }

 function deleteStoredWorkspace(expectedRevision) {
 if (state.phase !== "ready") return Promise.reject(new Error("The program application is not ready."));
 if (!Number.isInteger(Number(expectedRevision)) || Number(expectedRevision) < 0) return Promise.reject(new TypeError("A current workspace revision is required before deletion."));
 state.busy = true;
 programStatus("Deleting stored workspace - ", "loading");
 return UOS.ProgramStorage.deleteStoredWorkspace(Number(expectedRevision)).then(function () {
      /* The durable canonical and last-verified records are now absent. Keep
         subsequent navigation/view-state edits in memory until a validated
         import (or another explicit save path) establishes revision 1. If
         this is false, a background UI save recreates a blank revision 1
         while the in-memory workspace remains revision 0, permanently
         conflicting with every staged recovery import. */
      state.isSessionCleared = true;
      var blank = UOS.ProgramModel.blank();
      blank.migration.status = "complete";
      blank.migration.migratedAt = new Date().toISOString();
      state.workspace = blank;
      state.busy = false;
      invalidateEntityIndex();
      render();
      document.dispatchEvent(new CustomEvent("uos:program-ready", { detail: { workspace: clone(state.workspace) } }));
      programStatus("Ready", "ready");
      return blank;
 }).catch(function (err) {
 state.busy = false;
 if (err && err.name === "WorkspaceRevisionConflictError") {
   return UOS.ProgramStorage.get().then(function (latest) {
     if (latest) activate(latest);
     programStatus("Workspace changed. Create a new backup before deleting.", "warning");
     throw err;
   });
 }
 fail(err);
 throw err;
 });
  }

  function clearInMemory(type) {
    if (state.phase !== "ready" || !state.workspace) return;
    state.isSessionCleared = true;
    var ws = clone(state.workspace);
    ws.entities = ws.entities || {};

    if (type === "all") {
      ws.entities = {
        applications: [],
        events: [],
        projects: [],
        jobs: [],
        tasks: [],
        costingLines: [],
        rateItems: [],
        geometries: [],
        quotes: [],
        quoteLines: [],
        payments: []
      };
      if (ws.workspace) {
        delete ws.workspace.projectChecklists;
        ws.workspace.quoteState = null;
      }
      if (ws.rateLibrary && Array.isArray(ws.rateLibrary.items)) {
        ws.rateLibrary.items = [];
      }
    } else if (type === "users") {
      ["applications", "events", "projects", "jobs", "tasks", "costingLines"].forEach(function (coll) {
        if (Array.isArray(ws.entities[coll])) {
          ws.entities[coll].forEach(function (rec) {
            rec.customerName = ""; rec.customerEmail = ""; rec.customerPhone = ""; rec.customerNumber = "";
            rec.applicantName = ""; rec.contactName = ""; rec.name = ""; rec.contact = ""; rec.client = ""; rec.actionedBy = "";
            if (rec.raw) {
              rec.raw.customerName = ""; rec.raw.customerEmail = ""; rec.raw.customerPhone = ""; rec.raw.customerNumber = "";
              rec.raw.applicantName = ""; rec.raw.contactName = ""; rec.raw.name = ""; rec.raw.title = ""; rec.raw.contact = ""; rec.raw.client = ""; rec.raw.actionedBy = "";
              if (rec.raw.payload && typeof rec.raw.payload === "object") {
                rec.raw.payload.customerName = ""; rec.raw.payload.customerEmail = ""; rec.raw.payload.customerPhone = "";
                rec.raw.payload.customerNumber = ""; rec.raw.payload.applicantName = ""; rec.raw.payload.contactName = ""; rec.raw.payload.name = ""; rec.raw.payload.contact = ""; rec.raw.payload.client = ""; rec.raw.payload.actionedBy = "";
              }
            }
          });
        }
      });
    } else if (type === "rates") {
      ws.entities.rateItems = [];
      ws.entities.quoteLines = [];
      if (ws.rateLibrary && Array.isArray(ws.rateLibrary.items)) {
        ws.rateLibrary.items = [];
      }
    } else if (type === "nsa") {
      ["applications", "events", "projects", "jobs", "tasks", "costingLines", "geometries"].forEach(function (coll) {
        if (Array.isArray(ws.entities[coll])) {
          ws.entities[coll] = ws.entities[coll].filter(function (rec) { return rec.owner !== "NSA"; });
        }
      });
    } else if (type === "evt") {
      ["applications", "events", "projects", "jobs", "tasks", "costingLines", "geometries"].forEach(function (coll) {
        if (Array.isArray(ws.entities[coll])) {
          ws.entities[coll] = ws.entities[coll].filter(function (rec) { return rec.owner !== "EVT"; });
        }
      });
    } else if (type === "payments") {
      ws.entities.payments = [];
    }

    state.workspace = UOS.ProgramModel.normalize(ws);
    render();
    document.dispatchEvent(new CustomEvent("uos:program-ready", { detail: { workspace: clone(state.workspace) } }));
  }


  function shortcutContextForWorkspace(currentModule, sourceWorkspace) {
    var workspace = sourceWorkspace || state.workspace || {};
    var entities = workspace.entities || {};
    var ui = workspace.workspace || {};
    var context = resolveWorkingContext(workspace, ui.selectedEntityId || ui.selectedProjectId || "");
    var project = (entities.projects || []).find(function (item) { return item.id === context.projectId; }) || null;
    var jobs = (entities.jobs || []).filter(function (job) {
      return project && (job.projectId === project.id || job.applicationId === project.applicationId || job.eventId === project.eventId);
    });
    var jobIds = {};
    jobs.forEach(function (job) { jobIds[job.id] = true; });
    return {
      currentModule: currentModule,
      linkedProject: project,
      hasRegister: Boolean(context.registerId),
      hasProject: Boolean(project),
      hasMap: Boolean((entities.geometries || []).some(function (geometry) {
        return geometry.projectId === context.projectId || geometry.applicationId === context.registerId || geometry.eventId === context.registerId;
      })),
      hasJobs: jobs.length > 0,
      hasCostedJobs: Boolean((entities.costingLines || []).some(function (line) { return line.projectId === context.projectId || jobIds[line.jobId]; }))
    };
  }

  function evaluateShortcutRule(actionKey, context) {
    context = context || {};
    var currentModule = context.currentModule || "";
    var hasProject = Boolean(context.hasProject);
    var hasMap = Boolean(context.hasMap);
    var hasJobs = Boolean(context.hasJobs);
    var hasCostedJobs = Boolean(context.hasCostedJobs);
    var linkedProject = context.linkedProject || null;
    var hasRegister = context.hasRegister === true || Boolean(linkedProject && (linkedProject.applicationId || linkedProject.eventId));

    var isCurrent = (actionKey === currentModule);
    var isDisabled = false;
    var isLinked = false;
    var tooltip = "";
    var ariaLabel = "";

    if (actionKey === "register") {
      isLinked = !isCurrent && hasRegister;
      tooltip = isCurrent ? "Currently in Register" : "View in Register";
      ariaLabel = tooltip;
    } else if (actionKey === "map") {
      if (isCurrent) {
        tooltip = "Currently in Space Map";
      } else if (hasMap) {
        isLinked = true;
        tooltip = "View on Space Map";
      } else {
        tooltip = "Open Space Map to add a location or polygons";
      }
      ariaLabel = tooltip;
    } else if (actionKey === "planner") {
      if (isCurrent) {
        tooltip = "Currently in Project Planner";
      } else if (!hasProject) {
        isDisabled = true;
        tooltip = "Create a linked project first to open in Project Planner";
      } else {
        isLinked = true;
        isDisabled = false;
        tooltip = linkedProject ? ("Open linked Project: " + (linkedProject.title || linkedProject.name || linkedProject.id)) : "Open in Project Planner";
      }
      ariaLabel = tooltip;
    } else if (actionKey === "costing") {
      if (isCurrent) {
        tooltip = "Currently in Cost Calculator";
      } else if (!hasProject) {
        isDisabled = true;
        tooltip = "Create a linked delivery project first to open in Cost Calculator";
      } else if (hasJobs) {
        isLinked = true;
        tooltip = "Open in Cost Calculator";
      } else {
        tooltip = "Open Cost Calculator — this Project has no Jobs yet";
      }
      ariaLabel = tooltip;
    } else if (actionKey === "scheduler") {
      if (isCurrent) {
        tooltip = "Currently in Job Scheduler";
      } else if (!hasJobs) {
        isDisabled = true;
        tooltip = "Create at least one Job before opening in Scheduler";
      } else {
        isLinked = true;
        tooltip = "Schedule in Job Scheduler";
      }
      ariaLabel = tooltip;
    } else if (actionKey === "quotes") {
      if (isCurrent) {
        tooltip = "Currently in Quote Builder";
      } else if (!hasProject) {
        isDisabled = true;
        tooltip = "Create a linked delivery project first to open in Quote Builder";
      } else {
        isLinked = true;
        tooltip = "Create or open Quote in Quote Builder";
      }
      ariaLabel = tooltip;
    }

    return {
      actionKey: actionKey,
      isCurrent: isCurrent,
      isDisabled: isDisabled,
      isLinked: isLinked,
      tooltip: tooltip,
      ariaLabel: ariaLabel
    };
  }

  function syncToolbarPrerequisites(container, context) {
    if (!container || typeof container.querySelectorAll !== "function") return;
    var buttons = container.querySelectorAll("button[data-register-action], button[data-planner-toolbar-jump], button[data-map-toolbar-jump], button[data-costing-toolbar-jump], button[data-scheduler-toolbar-jump], button[data-quotes-toolbar-jump]");

    Array.prototype.forEach.call(buttons, function (btn) {
      var actionKey = btn.getAttribute("data-register-action") ||
                      btn.getAttribute("data-planner-toolbar-jump") ||
                      btn.getAttribute("data-map-toolbar-jump") ||
                      btn.getAttribute("data-costing-toolbar-jump") ||
                      btn.getAttribute("data-scheduler-toolbar-jump") ||
                      btn.getAttribute("data-quotes-toolbar-jump");

      if (!actionKey) return;
      var rule = evaluateShortcutRule(actionKey, context);

 if (rule.isCurrent) {
 btn.classList.add("is-current-module");
 btn.classList.remove("is-available-module");
        btn.classList.remove("program-register-action--linked");
        btn.removeAttribute("data-linked-entity");
        btn.setAttribute("aria-current", "page");
        btn.disabled = true;
        btn.removeAttribute("aria-disabled");
      } else {
        btn.classList.remove("is-current-module");
        btn.removeAttribute("aria-current");
 if (rule.isDisabled) {
 btn.classList.remove("is-available-module");
          btn.disabled = true;
          btn.setAttribute("aria-disabled", "true");
          btn.classList.remove("program-register-action--linked");
          btn.removeAttribute("data-linked-entity");
 } else {
 btn.classList.add("is-available-module");
          btn.disabled = false;
          btn.removeAttribute("aria-disabled");
          if (rule.isLinked) {
            btn.classList.add("program-register-action--linked");
            btn.setAttribute("data-linked-entity", "true");
          } else {
            btn.classList.remove("program-register-action--linked");
            btn.removeAttribute("data-linked-entity");
          }
        }
      }

      if (rule.tooltip) {
        btn.setAttribute("data-uos-tooltip", rule.tooltip);
        btn.setAttribute("title", rule.tooltip);
      }
      if (rule.ariaLabel) {
        btn.setAttribute("aria-label", rule.ariaLabel);
      }
    });
  }

  UOS.ProgramApp = {
    evaluateShortcutRule: evaluateShortcutRule,
    syncToolbarPrerequisites: syncToolbarPrerequisites,
    destinations: DESTINATIONS.slice(), init: init, render: render, applyMigration: applyMigration,
    startEmpty: startEmpty, confirmStartEmpty: confirmStartEmpty, navigate: navigate,
    updateWorkspace: updateWorkspace, adoptWorkspace: adoptWorkspace, deleteStoredWorkspace: deleteStoredWorkspace, clearInMemory: clearInMemory, restoreStoredData: restoreStoredData, reviewLegacyData: stageLegacy, entityById: entityById, resolveDeepLink: resolveDeepLink,
    updateRailTheme: updateRailTheme, setWorkingContext: setWorkingContext,
 canEdit: function () { return true; },
    resolveWorkingContext: resolveWorkingContext, projectHasPolygon: projectHasPolygon,
    selectWorkingItem: selectWorkingItem, navigateWithContext: navigateWithContext, prepareWorkingContextForDestination: prepareWorkingContextForDestination,
    returnDestinationFromData: returnDestinationFromData,
    isSessionCleared: function () { return state.isSessionCleared === true; },
    snapshot: function () { return clone(state); }, workspace: function () { return clone(state.workspace); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { bind(); init(); }, { once: true });
  else { bind(); init(); }
}());
