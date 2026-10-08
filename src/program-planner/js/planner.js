(function (root, factory) {
  "use strict";
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.UOS = root.UOS || {};
    root.UOS.ProgramPlanner = api;
  }
}(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  var CHECKLIST_ITEMS = [
    // 1. Planning and Approval (Items 1-16)
    { id: 1, category: "Planning and Approval", title: "Pre-project photos", desc: "Baseline site condition photographic record prior to works" },
    { id: 2, category: "Planning and Approval", title: "Application received", desc: "Customer / applicant request submission record" },
    { id: 3, category: "Planning and Approval", title: "Application approved", desc: "Council horticultural authorization & permit approval" },
    { id: 4, category: "Planning and Approval", title: "Resident contacted", desc: "Resident / landholder notification & alignment" },
    { id: 5, category: "Planning and Approval", title: "Site assessment", desc: "On-site physical inspection (soil condition, hazards, boundaries)" },
    { id: 6, category: "Planning and Approval", title: "WZTM needed?", desc: "Work Zone Traffic Management determination & plan requirement" },
    { id: 7, category: "Planning and Approval", title: "TPC's needed?", desc: "Tree Protection Zone / Tree Protection Permit controls evaluation" },
    { id: 8, category: "Planning and Approval", title: "DBYB plans", desc: "Dial Before You Dig utility & underground infrastructure location plans" },
    { id: 9, category: "Planning and Approval", title: "Service checks", desc: "On-site verification of underground utilities & irrigation lines" },
    { id: 10, category: "Planning and Approval", title: "SWIMS completed", desc: "Safe Work Method Statements / Risk Assessment sign-off" },
    { id: 11, category: "Planning and Approval", title: "Material estimates", desc: "Soil, mulch, turf, plants, fertilizer, and edging quantity estimates" },
    { id: 12, category: "Planning and Approval", title: "Labour estimates", desc: "Internal staff crew hours, plant operator, and supervisor estimates" },
    { id: 13, category: "Planning and Approval", title: "Plants / turf ordered", desc: "Purchase order for nursery stock & turf supply" },
    { id: 14, category: "Planning and Approval", title: "Other materials ordered", desc: "Purchase order for topsoil, mulch, irrigation, and timber/stone" },
    { id: 15, category: "Planning and Approval", title: "Check SRZ / TPZ with Arboriculture", desc: "Structural Root Zone & Tree Protection Zone clearance with Arborist" },
    { id: 16, category: "Planning and Approval", title: "Design", desc: "Nature strip landscape / garden bed design & plant selection" },

    // 2. Contractors (Items 17-22)
    { id: 17, category: "Contractors", title: "Contractors engaged", desc: "Engagement of external civil / landscape contractors" },
    { id: 18, category: "Contractors", title: "Contractor induction completed", desc: "Site safety, environmental, and council induction completion" },
    { id: 19, category: "Contractors", title: "Contractor name recorded", desc: "Vendor / subcontractor company name & contact details logged" },
    { id: 20, category: "Contractors", title: "Contractor safety sign-off", desc: "Contractor WHS documentation & risk assessment sign-off" },
    { id: 21, category: "Contractors", title: "Quote received", desc: "Formal contractor quotation verification & approval" },
    { id: 22, category: "Contractors", title: "RP completed", desc: "Remediation / Reinstatement Plan verification" },

    // 3. Handover (Items 23-25)
    { id: 23, category: "Handover", title: "After photos", desc: "Completed project photographic record" },
    { id: 24, category: "Handover", title: "Copies of timesheets", desc: "Internal staff labor timesheets & work order logs" },
    { id: 25, category: "Handover", title: "Copies of invoices", desc: "Contractor & material supplier invoices lodged for payment" }
  ];

  var REMEDIATION_CHECKLIST_ITEMS = [
    // 1. Pre-Delivery Items (Items 101-106)
    { id: 101, category: "Pre-Delivery Items", title: "Irrigation mark out", desc: "Mark out irrigation infrastructure on site prior to remediation works" },
    { id: 102, category: "Pre-Delivery Items", title: "Customer Consultation", desc: "Consultation with customer / landholder regarding event remediation" },
    { id: 111, category: "Pre-Delivery Items", title: "Request Raising PO", desc: "Request approval and supporting details before raising the purchase order" },
    { id: 103, category: "Pre-Delivery Items", title: "Raise PO", desc: "Raise purchase order for remediation materials and contractor services" },
    { id: 104, category: "Pre-Delivery Items", title: "City Works Permit", desc: "Obtain required City Works Permit and site access authorization" },
    { id: 105, category: "Pre-Delivery Items", title: "Notification relevant leading hand", desc: "Notify leading hand and operational supervisor of scheduled works" },
    { id: 106, category: "Pre-Delivery Items", title: "Post Events Report", desc: "Prepare initial post-events damage assessment and remediation report" },

    // 2. Post Delivery (Items 107-110)
    { id: 107, category: "Post Delivery", title: "Finalising reports for facilitator", desc: "Finalise remediation completion reports for event facilitator / council" },
    { id: 108, category: "Post Delivery", title: "Quote", desc: "Final quote reconciliation and billing lodged" },
    { id: 109, category: "Post Delivery", title: "Communicate with contractor for remediation", desc: "Communicate completion sign-off with remediation contractor" },
    { id: 110, category: "Post Delivery", title: "Communicate with internal for remediation", desc: "Internal debrief and handover to horticulture maintenance team" },
    { id: 112, category: "Post Delivery", title: "Turf Maintenance", desc: "Schedule post-delivery turf maintenance and establishment care" }
  ];

  var STATUS_OPTIONS = ["Not Started", "In Progress", "Complete", "On Hold", "N/A"];
  var NSA_OWNER_OPTIONS = ["Not assigned", "Admin", "Technical Officer", "Horticulture Crew", "Contractor", "Arb Team"];
  var REMEDIATION_OWNER_OPTIONS = ["Not assigned", "Admin", "Technical Officer", "Horticulture Crew", "Contractor", "Arb Team", "Irrigation Team"];
  var OWNER_OPTIONS = NSA_OWNER_OPTIONS;

  function getChecklistItems(projectId) {
    var project = findProject(projectId);
    var isRemediation = state.sidebarMode === "events" || (project && (project.owner === "EVT" || (project.id && text(project.id).indexOf("EVT") === 0)));
    var model = typeof window !== "undefined" && window.UOS && window.UOS.ProgramModel;
    if (model && typeof model.checklistTemplates === "function") {
      return model.checklistTemplates(isRemediation ? "EVT" : "NSA").map(function (template) {
        return { id: template.id, category: template.section, title: template.title, desc: template.description, sortOrder: template.sortOrder };
      });
    }
    return isRemediation ? REMEDIATION_CHECKLIST_ITEMS : CHECKLIST_ITEMS;
  }

  function getOwnerOptions(projectId) {
    var project = findProject(projectId);
    var isRemediation = state.sidebarMode === "events" || (project && (project.owner === "EVT" || (project.id && text(project.id).indexOf("EVT") === 0)));
    return isRemediation ? REMEDIATION_OWNER_OPTIONS : NSA_OWNER_OPTIONS;
  }

  var state = {
    workspace: null,
    sidebarMode: "applications",
    searchQuery: "",
    selectedProjectId: "",
    activeTab: "planner", // "details", "planner", "costs"
    expandedItems: {},
    bound: false,
    selectedChecklistItemId: ""
  };

function text(value) { return value == null ? "" : String(value).trim(); }
function displayDate(value) {
  var formatter = typeof window !== "undefined" && window.UOS && window.UOS.imports && window.UOS.imports.formatDate;
  return formatter ? formatter(value) : (text(value) || "—");
}
  function sessionOperator() { try { return text(sessionStorage.getItem("uos.program.statusOperator")); } catch (error) { return ""; } }
  function rememberSessionOperator(value) { try { sessionStorage.setItem("uos.program.statusOperator", text(value)); } catch (error) {} }
  function esc(value) { return text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var plannerRoot = null;
  // Register rerenders briefly detach the mounted module before remounting it.
  // Keep rendering the same Planner root while it is outside the document.
  function one(selector) { return typeof document === "undefined" ? null : document.querySelector(selector) || plannerRoot && plannerRoot.querySelector(selector); }
  function all(selector) {
    if (typeof document === "undefined") return [];
    var nodes = Array.prototype.slice.call(document.querySelectorAll(selector));
    if (plannerRoot && !plannerRoot.isConnected) nodes = nodes.concat(Array.prototype.slice.call(plannerRoot.querySelectorAll(selector)));
    return nodes;
  }

  function getWorkspace() {
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    if (app) {
      if (typeof app.getWorkspace === "function") return app.getWorkspace();
      if (typeof app.workspace === "function") return app.workspace();
    }
    return state.workspace || null;
  }

  function getProjectsFromWorkspace() {
    var ws = getWorkspace();
    if (!ws) return [];
    var projects = (ws.entities && Array.isArray(ws.entities.projects)) ? ws.entities.projects : [];
    if (!projects.length && ws.workspace && ws.workspace.projects && Array.isArray(ws.workspace.projects)) {
      projects = ws.workspace.projects;
    }
    return projects;
  }

  function isSessionCleared() {
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    return app && typeof app.isSessionCleared === "function" ? app.isSessionCleared() : false;
  }

  function getRemediationEvents() {
    var ws = getWorkspace();
    var model = typeof window !== "undefined" && window.UOS && window.UOS.ProgramModel;
    if (model && typeof model.getProjects === "function") {
      var canonical = model.getProjects(ws, "EVT");
      if (canonical.length > 0) return canonical;
    }
    return [];
  }

  function getApplications() {
    var ws = getWorkspace();
    var model = typeof window !== "undefined" && window.UOS && window.UOS.ProgramModel;
    if (model && typeof model.getProjects === "function") {
      var canonical = model.getProjects(ws, "NSA");
      if (canonical.length > 0) return canonical;
    }
    return [];
  }

  function getProjectList() {
    return state.sidebarMode === "events" ? getRemediationEvents() : getApplications();
  }

  function findProject(id) {
    var projects = getProjectsFromWorkspace();
    var exact = projects.find(function (project) { return project && project.id === id; }) || null;
    if (exact) return exact;
    var workspace = getWorkspace();
    var entities = workspace && workspace.entities || {};
    var register = (entities.applications || []).concat(entities.events || []).find(function (item) { return item && item.id === id; });
    var model = typeof window !== "undefined" && window.UOS && window.UOS.ProgramModel;
    return register && model && typeof model.activeProjectForRegister === "function"
      ? model.activeProjectForRegister(workspace, register)
      : null;
  }

  function getProjectChecklistData(projectId) {
    if (!projectId) return {};
    var ws = getWorkspace();
    var canonicalTasks = ws && ws.entities && Array.isArray(ws.entities.tasks)
      ? ws.entities.tasks.filter(function (task) { return task.projectId === projectId; })
      : [];
    var canonical = {};
    canonicalTasks.slice().sort(function (a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); }).forEach(function (task) {
      var taskState = window.UOS.ProgramPlannerModel.taskState(ws, task);
      canonical[task.id] = {
        id: task.id, templateKey: task.templateKey || task.legacyChecklistId || "", title: task.title || "",
        section: task.section || task.category || "", description: task.description || "", sortOrder: task.sortOrder,
 status: window.UOS && window.UOS.ProgramStatus ? window.UOS.ProgramStatus.labelFor("task", task.status) : (task.status || "Not Started"), owner: task.assigneeId || "Not assigned", due: displayDate(task.dueDate),
 notes: task.notes || "", jobId: taskState.job ? taskState.job.id : null,
        schedulerJobId: taskState.scheduled ? taskState.job.id : null, operational: task.operational === true,
        schedulable: task.schedulable === true, deleted: task.suppressed === true
      };
    });
    return canonical;
  }

  var plannerStatusFilters = [];

  function renderPlannerStatusFilterPills() {
    var container = one("#plannerStatusFilterPills");
    if (!container) return;

    var rawItems = getProjectList();
    var possibleStatuses = window.UOS && window.UOS.ProgramStatus ? window.UOS.ProgramStatus.vocabulary("project").map(function (item) { return item.label; }) : ["Draft", "Planning", "In Delivery", "On Hold", "Complete", "Cancelled"];

    rawItems.forEach(function (it) {
      var s = text(it.status || "").trim();
      if (s && possibleStatuses.indexOf(s) < 0) possibleStatuses.push(s);
    });

    var pillsHtml = possibleStatuses.map(function (statusVal) {
      var slug = statusVal.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      var isActive = plannerStatusFilters.indexOf(statusVal) >= 0;
      var count = rawItems.filter(function (it) {
        var s = text(it.status || "").trim();
        return s.toLowerCase() === statusVal.toLowerCase();
      }).length;
      return '<button type="button" class="program-status-pill-filter status--' + esc(slug) + (isActive ? ' is-active' : '') + '" data-planner-status-filter="' + esc(statusVal) + '" aria-pressed="' + String(isActive) + '">' +
        '<span>' + esc(statusVal) + '</span>' +
        '<span class="program-status-pill-count">' + count + '</span>' +
      '</button>';
    }).join("");

    container.innerHTML = pillsHtml;
    var badge = document.querySelector('[data-filter-drawer-badge="planner"]');
    if (badge) {
      var actCount = (state.searchQuery ? 1 : 0) + plannerStatusFilters.length;
      badge.textContent = String(actCount);
      badge.hidden = (actCount === 0);
    }
  }

  function getActiveChecklistItems(projectId) {
    var chkData = getProjectChecklistData(projectId);
    var ws = getWorkspace();
    var tasks = ws && ws.entities && Array.isArray(ws.entities.tasks) ? ws.entities.tasks.filter(function (task) { return task.projectId === projectId; }) : [];
    if (tasks.length) return tasks.slice().sort(function (a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); }).filter(function (task) { return !chkData[task.id] || !chkData[task.id].deleted; }).map(function (task) {
      var templateKey = String(task.templateKey || task.legacyChecklistId || "");
      var definition = getChecklistItems(projectId).find(function (item) { return String(item.id) === templateKey || text(item.title).toLowerCase().replace(/[^a-z0-9]+/g, "-") === templateKey; });
      return { id: task.id, canonicalId: task.id, templateKey: templateKey, category: task.section || task.category || definition && definition.category || "Other", title: task.title || definition && definition.title || "Untitled task", desc: task.description || definition && definition.desc || "" };
    });
    var items = getChecklistItems(projectId).slice();
    return items.filter(function (it) {
      return !chkData[it.id] || !chkData[it.id].deleted;
    });
  }

  function buildAsciiGraphHtml(projectId) {
    var activeItems = getActiveChecklistItems(projectId);
    var chkData = getProjectChecklistData(projectId);

    var squaresHtml = activeItems.map(function (it, idx) {
      var itemSaved = chkData[it.id] || { status: "Not Started" };
      var status = itemSaved.status || "Not Started";
      var symbol = "□"; // blank square default
      var cls = "ascii-square--blank";

      if (status === "Complete") {
        symbol = "■";
        cls = "ascii-square--complete";
      } else if (status === "In Progress") {
        symbol = "▣";
        cls = "ascii-square--inprogress";
      } else if (status === "On Hold") {
        symbol = "▧";
        cls = "ascii-square--onhold";
      } else if (status === "N/A") {
        symbol = "☒";
        cls = "ascii-square--na";
      }

      var tooltip = "#" + (idx + 1) + ": " + it.title + " (" + status + ")";
      return '<span class="ascii-square ' + cls + '" title="' + esc(tooltip) + '" aria-label="' + esc(tooltip) + '">' + symbol + '</span>';
    }).join("");

    return '<div class="planner-card-ascii-bar" role="img" aria-label="Checklist progress ascii graph">' +
      squaresHtml +
    '</div>';
  }

  function extractLoc(rec) {
    if (!rec) return "";
    var c = [rec.address, rec.vergeAddress, rec.siteLocation];
    for (var i = 0; i < c.length; i++) {
      var s = text(c[i]);
      if (s && s.toLowerCase() !== "mapped location" && s.toLowerCase() !== "mapped site") return s;
    }
    if (rec.location) {
      if (typeof rec.location === "string") {
        var locStr = text(rec.location);
        if (locStr && locStr.toLowerCase() !== "mapped location" && locStr.toLowerCase() !== "mapped site") return locStr;
      } else if (typeof rec.location === "object") {
        var locAddr = text(rec.location.address || rec.location.name);
        if (locAddr && locAddr.toLowerCase() !== "mapped location" && locAddr.toLowerCase() !== "mapped site") return locAddr;
      }
    }
    if (Array.isArray(rec.locations) && rec.locations.length > 0) {
      for (var j = 0; j < rec.locations.length; j++) {
        var locItem = rec.locations[j];
        if (locItem) {
          var itemAddr = typeof locItem === "string" ? text(locItem) : text(locItem.address || locItem.name);
          if (itemAddr && itemAddr.toLowerCase() !== "mapped location" && itemAddr.toLowerCase() !== "mapped site") return itemAddr;
        }
      }
    }
    return "";
  }

  function renderSidebarList() {
    var container = one("#plannerPickerList");
    if (!container) return;

    renderPlannerStatusFilterPills();

    var items = getProjectList();

    if (plannerStatusFilters.length > 0) {
      items = items.filter(function (item) {
      var statusStr = window.UOS && window.UOS.ProgramStatus ? window.UOS.ProgramStatus.labelFor("project", item.status) : text(item.status || "Active").trim();
        return plannerStatusFilters.indexOf(statusStr) >= 0;
      });
    }

    if (state.searchQuery) {
      var q = state.searchQuery.toLowerCase();
      items = items.filter(function (item) {
        var id = text(item.id || item.eventId || item.applicationId).toLowerCase();
        var name = text(item.eventName || item.title || item.name).toLowerCase();
        var loc = text(item.location || item.address).toLowerCase();
        var status = text(item.status).toLowerCase();
        return id.indexOf(q) >= 0 || name.indexOf(q) >= 0 || loc.indexOf(q) >= 0 || status.indexOf(q) >= 0;
      });
    }

    if (!items.length) {
      container.innerHTML = '<div class="program-map-notice" role="listitem">No ' + (state.sidebarMode === "events" ? "Remediation events" : "Nature Strip applications") + ' match your search.</div>';
      return;
    }

    container.innerHTML = items.map(function (item) {
      var id = item.id || item.eventId || item.applicationId;
      var name = item.eventName || item.title || item.name || id;
      var owner = item.owner || (state.sidebarMode === "events" ? "EVT" : "NSA");

      var directLoc = extractLoc(item);
      var regIdForLoc = item.applicationId || item.eventId;
      if (regIdForLoc) {
        var uos = typeof window !== "undefined" ? window.UOS : (typeof root !== "undefined" && root ? root.UOS : null);
        if (uos) {
          var regRec = null;
          if (uos.ProgramApp && typeof uos.ProgramApp.entityById === "function") regRec = uos.ProgramApp.entityById(regIdForLoc);
          if (!regRec && uos.ProgramModel && typeof uos.ProgramModel.getRegisterRecord === "function") regRec = uos.ProgramModel.getRegisterRecord(regIdForLoc);
          if (regRec) {
            var regLoc = extractLoc(regRec);
            if (regLoc) directLoc = regLoc;
          }
        }
      }
      var locDisplay = directLoc || "No location address specified";
      var locationHtml = '<div class="program-event-card__loc-row" title="' + esc(locDisplay) + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>' +
        '<span>' + esc(locDisplay) + '</span>' +
      '</div>';
      var statusStr = window.UOS && window.UOS.ProgramStatus ? window.UOS.ProgramStatus.labelFor("project", item.status) : (item.status || "Active");
      var statusSlug = text(statusStr).toLowerCase().replace(/[^a-z0-9]+/g, "-");
      var isSelected = state.selectedProjectId === id;

      var chkData = getProjectChecklistData(id);
      var activeItems = getActiveChecklistItems(id);
      var totalActive = activeItems.length;
      var completedCount = activeItems.filter(function (it) {
        return chkData[it.id] && chkData[it.id].status === "Complete";
      }).length;
      var progressPct = totalActive > 0 ? Math.round((completedCount / totalActive) * 100) : 0;

      var regId = item.applicationId || item.eventId || (id.indexOf("PROJ") >= 0 ? "" : id);
      var projId = item.projectId || (id.indexOf("PROJ") >= 0 ? id : "");
      var idRowsHtml = '<div class="program-event-card__id-row" style="font-size: 11px; font-weight: 700; color: #475569; margin-top: 2px; margin-bottom: 2px; display: flex; flex-direction: column; gap: 2px;">' +
        (regId ? '<div>Register ID: ' + esc(regId) + '</div>' : '') +
        (projId ? '<div>Project ID: ' + esc(projId) + '</div>' : (!regId ? '<div>ID: ' + esc(id) + '</div>' : '')) +
      '</div>';

      var iconSvg = owner === "EVT"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m12 13 1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2-1.5-1.5 2-.3Z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>';

      return '<div class="program-event-card' + (isSelected ? " is-selected" : "") + '" data-planner-project-id="' + esc(id) + '" data-owner="' + esc(owner) + '" role="button" tabindex="0">' +
        '<div class="program-event-card__head">' +
          '<div class="program-event-card__head-left">' +
            '<div class="program-event-card__icon-badge program-event-card__icon-badge--' + esc(owner.toLowerCase()) + '">' + iconSvg + '</div>' +
            '<h5>' + esc(name) + '</h5>' +
          '</div>' +
          '<span class="program-status-pill status--' + esc(statusSlug) + '">' +
            '<span>' + esc(statusStr) + '</span>' +
          '</span>' +
        '</div>' +
        '<div class="program-event-card__divider"></div>' +
        '<div class="program-event-card__id-section">' +
          (regId ?
            '<div class="program-event-card__id-row">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true" class="program-event-card__id-icon"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>' +
              '<span class="program-event-card__id-label">Register ID:</span>' +
              '<span class="program-event-card__id-value">' + esc(regId) + '</span>' +
            '</div>' : '') +
          (projId ?
            '<div class="program-event-card__id-row">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true" class="program-event-card__id-icon"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
              '<span class="program-event-card__id-label">Project ID:</span>' +
              '<span class="program-event-card__id-value">' + esc(projId) + '</span>' +
            '</div>' : (!regId ?
            '<div class="program-event-card__id-row">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true" class="program-event-card__id-icon"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>' +
              '<span class="program-event-card__id-label">ID:</span>' +
              '<span class="program-event-card__id-value">' + esc(id) + '</span>' +
            '</div>' : '')) +
        '</div>' +
        '<div class="program-event-card__divider"></div>' +
        '<div class="program-event-card__loc-section">' +
          '<div class="program-event-card__loc-row">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true" class="program-event-card__loc-pin"><path d="M12 21.7C17.3 17 20 13 20 9a8 8 0 1 0-16 0c0 4 2.7 8 8 12.7z"/><circle cx="12" cy="9" r="3"/></svg>' +
            '<span class="program-event-card__loc-text">' + esc(locDisplay) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="planner-card-progress" style="margin-top:6px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;font-size:10px;font-weight:700;color:var(--uos-text-muted);">' +
            '<span>Checklist</span><span>' + completedCount + '/' + totalActive + ' (' + progressPct + '%)</span>' +
          '</div>' +
          '<div class="planner-card-progress__bar"><div class="planner-card-progress__fill" style="width:' + progressPct + '%;"></div></div>' +
        '</div>' +
      '</div>';
    }).join("");
  }

  function renderChecklistTable() {
    var container = one("#plannerChecklistContent");
    if (!container) return;

    var projects = getProjectList();
    if (!projects.length) {
      container.removeAttribute("data-owner");
      container.innerHTML = '<div class="program-map-notice" style="padding: 40px; text-align: center; color: var(--uos-text-muted, #64748b);">No delivery project selected or available. Import or stage workspace data to view delivery checklist.</div>';
      return;
    }

    var project = findProject(state.selectedProjectId);
    if (!project) {
      project = projects[0];
      state.selectedProjectId = project.id || project.applicationId || project.eventId;
    }
    var pId = project.id || project.applicationId || project.eventId;
    var checklistOwner = state.sidebarMode === "events" ? "EVT" : "NSA";
    container.setAttribute("data-owner", checklistOwner);
    var chkData = getProjectChecklistData(pId);

    var activeItemsForProject = getActiveChecklistItems(pId);
    if (!activeItemsForProject.some(function (item) { return String(item.id) === String(state.selectedChecklistItemId); })) state.selectedChecklistItemId = "";
    var categories = [];
    activeItemsForProject.forEach(function (it) {
      if (categories.indexOf(it.category) < 0) categories.push(it.category);
    });
    var ownerOptions = getOwnerOptions(pId);

    var topNavHtml = '<div class="planner-nav-header">' +
      '<div class="planner-nav-title" style="display:flex;align-items:center;gap:10px;">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:20px;height:20px;color:var(--program-owner-strong);stroke-width:2;flex:0 0 auto;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
        '<h3 style="margin:0;font-size:16px;font-weight:800;color:var(--uos-text);">Project Checklist</h3>' +
      '</div>' +
      '<div class="planner-nav-actions">' +
        '<span class="planner-duplicate-action" data-uos-tooltip="' + (state.selectedChecklistItemId ? 'Duplicate selected checklist row' : 'Select a checklist row to enable Duplicate') + '" title="' + (state.selectedChecklistItemId ? 'Duplicate selected checklist row' : 'Select a checklist row to enable Duplicate') + '"' + (state.selectedChecklistItemId ? '' : ' tabindex="0"') + '>' +
          '<button type="button" class="uos-button uos-button--secondary uos-button--sm planner-btn-duplicate" data-planner-duplicate aria-describedby="planner-duplicate-help"' + (state.selectedChecklistItemId ? '' : ' disabled aria-disabled="true"') + '><span>Duplicate</span></button>' +
        '</span>' +
        '<span class="uos-sr-only" id="planner-duplicate-help">Select a checklist row, then choose Duplicate. The copy is inserted immediately below the selected row.</span>' +
        '<button type="button" class="uos-button uos-button--primary uos-button--sm planner-btn-add-item"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Add item</span></button>' +
      '</div>' +
    '</div>';

    var tableHeadHtml = '<thead>' +
      '<tr>' +
        '<th class="planner-col-task">Task</th>' +
        '<th class="planner-col-status">Progress</th>' +
        '<th class="planner-col-owner">Owner</th>' +
        '<th class="planner-col-due">Due</th>' +
        '<th class="planner-col-notes">Notes</th>' +
        '<th class="planner-col-action"></th>' +
      '</tr>' +
    '</thead>';

    var tableBodyHtml = '<tbody>' + categories.map(function (catName) {
      var catItems = activeItemsForProject.filter(function (it) { return it.category === catName; });
      var catHeaderRow = '<tr class="planner-cat-header-row"><td colspan="6"><strong>' + esc(catName.toUpperCase()) + '</strong></td></tr>';

      var rowsHtml = catItems.map(function (it) {
        var itemSaved = chkData[it.id] || { status: "Not Started", owner: "Not assigned", due: "", notes: "" };
        var isDone = itemSaved.status === "Complete";
        var statusSlug = text(itemSaved.status).toLowerCase().replace(/[^a-z0-9]+/g, "-");
        var taskEntityId = itemSaved.id || it.canonicalId || "";
        var plannerModel = window.UOS && window.UOS.ProgramPlannerModel;
        var schedulable = Boolean(plannerModel && plannerModel.isOperationalTask && plannerModel.isOperationalTask(itemSaved));
        var scheduled = Boolean(itemSaved.schedulerJobId);
        var linkedJob = Boolean(itemSaved.jobId);
        var customTask = Boolean(taskEntityId && !itemSaved.templateKey && !itemSaved.schedulable);
        var duplicateSelected = String(state.selectedChecklistItemId) === String(it.id);

        return '<tr class="planner-item-row commercial-frame-row' + (isDone ? " is-complete" : "") + (duplicateSelected ? " is-duplicate-selected" : "") + '" data-status-slug="' + esc(statusSlug) + '" data-checklist-item-id="' + it.id + '" data-task-entity-id="' + esc(taskEntityId) + '" data-planner-selectable tabindex="0" aria-selected="' + String(duplicateSelected) + '">' +
          '<td class="planner-col-task"><span class="commercial-value-frame planner-value-frame planner-value-frame--task">' + esc(it.title) + '</span></td>' +
          '<td class="planner-col-status"><span class="commercial-value-frame planner-progress-frame planner-progress-frame--' + esc(statusSlug) + '">' + esc(itemSaved.status) + '</span></td>' +
          '<td class="planner-col-owner"><span class="commercial-value-frame planner-value-frame">' + esc(itemSaved.owner || "Not assigned") + '</span></td>' +
          '<td class="planner-col-due"><span class="commercial-value-frame planner-value-frame">' + esc(itemSaved.due || "—") + '</span></td>' +
          '<td class="planner-col-notes"><span class="commercial-value-frame planner-value-frame planner-value-frame--notes">' + esc(itemSaved.notes || "") + '</span></td>' +
          '<td class="planner-col-action"><div class="planner-action-rail">' +
            '<button type="button" class="planner-info-button" data-planner-task-info="' + esc(it.id) + '" aria-label="View task information" title="View task information"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6m0-10v.1"></path></svg></button>' +
          (schedulable ? (scheduled
            ? '<button type="button" class="planner-task-path is-scheduled" data-planner-open-scheduled-job="' + esc(itemSaved.schedulerJobId) + '" data-planner-scheduled-project="' + esc(pId) + '">Scheduled Job</button>'
: (linkedJob ? '<button type="button" class="planner-task-path is-linked-job" data-planner-open-scheduled-job="' + esc(itemSaved.jobId) + '" data-planner-scheduled-project="' + esc(pId) + '">Draft Planner Job</button>' : '<button type="button" class="planner-task-path" data-planner-draft-job="' + esc(taskEntityId) + '" data-planner-scheduled-project="' + esc(pId) + '">Operational</button>')) : '<span class="planner-task-path">Inert</span>') +
            (taskEntityId ? '<button type="button" class="planner-schedule-btn" data-planner-edit-task="' + esc(taskEntityId) + '">Edit</button>' : '') +
            '<button type="button" class="planner-delete-btn" data-delete-item="' + it.id + '" title="Delete item">×</button>' +
          '</div></td>' +
        '</tr>';
      }).join("");

      return catHeaderRow + rowsHtml;
    }).join("") + '</tbody>';

    container.innerHTML = topNavHtml + '<div class="planner-table-wrap"><table class="planner-table commercial-table-shell">' + tableHeadHtml + tableBodyHtml + '</table></div>';
    measurePlannerColumns(container);
  }

  function measurePlannerColumns(container) {
    var table = container && container.querySelector(".planner-table");
    if (!table || !window.getComputedStyle) return;
    function widest(selector, minimum, maximum) {
      var width = minimum;
      Array.prototype.forEach.call(table.querySelectorAll(selector), function (node) {
        var probe = node.cloneNode(true);
        probe.removeAttribute("id");
        probe.style.position = "fixed";
        probe.style.left = "-10000px";
        probe.style.top = "0";
        probe.style.display = "inline-flex";
        probe.style.width = "max-content";
        probe.style.minWidth = "0";
        probe.style.maxWidth = "none";
        probe.style.visibility = "hidden";
        container.appendChild(probe);
        width = Math.max(width, Math.ceil(probe.getBoundingClientRect().width));
        probe.remove();
      });
      return Math.min(width, maximum);
    }
    var task = widest(".planner-value-frame--task", 180, Number.POSITIVE_INFINITY);
    var status = widest(".planner-progress-frame", 96, 170);
    var owner = widest(".planner-col-owner .planner-value-frame", 96, 220);
    var due = widest(".planner-col-due .planner-value-frame", 54, 150);
    var actionCount = 3;
    Array.prototype.forEach.call(table.querySelectorAll(".planner-action-rail"), function (rail) {
      actionCount = Math.max(actionCount, rail.querySelectorAll("button,.planner-task-path").length);
    });
    var actionWidth = "calc(" + actionCount + " * var(--commercial-frame-height) + " + (actionCount - 1) + " * var(--commercial-frame-gap))";
    var notes = widest(".planner-value-frame--notes", 34, 360);
    table.style.setProperty("--planner-task-width", task + "px");
    table.style.setProperty("--planner-status-width", status + "px");
    table.style.setProperty("--planner-owner-width", owner + "px");
    table.style.setProperty("--planner-due-width", due + "px");
    table.style.setProperty("--planner-action-width", actionWidth);
    Array.prototype.forEach.call(table.querySelectorAll(".planner-value-frame--task"), function (node) {
      task = Math.max(task, node.scrollWidth + 2);
    });
    table.style.setProperty("--planner-task-width", task + "px");
    table.style.setProperty("--planner-notes-min-width", notes + "px");
 table.style.setProperty("--planner-table-min-width", "calc(" + (task + status + owner + due + notes + 56) + "px + var(--planner-action-width))");
    window.requestAnimationFrame(function () {
      if (!table.isConnected) return;
      var currentTask = parseFloat(table.style.getPropertyValue("--planner-task-width")) || task;
      var renderedTask = currentTask;
      Array.prototype.forEach.call(table.querySelectorAll(".planner-value-frame--task"), function (node) {
        renderedTask = Math.max(renderedTask, node.scrollWidth + 2);
      });
      if (renderedTask <= currentTask) return;
      table.style.setProperty("--planner-task-width", renderedTask + "px");
 table.style.setProperty("--planner-table-min-width", "calc(" + (renderedTask + status + owner + due + notes + 56) + "px + var(--planner-action-width))");
    });
  }

  function renderUI() {

    // Sync Project Planner mini toolbar prerequisites
    var plannerSidebar = one(".program-planner-sidebar");
    var selectedPrjObj = findProject(state.selectedProjectId);
    if (plannerSidebar && selectedPrjObj) {
      plannerSidebar.setAttribute("data-owner", selectedPrjObj.owner || (selectedPrjObj.id && selectedPrjObj.id.indexOf("NSA") === 0 ? "NSA" : "EVT"));
    }
    var plannerToolbar = one("[data-planner-mini-toolbar]");
    if (plannerToolbar && window.UOS && window.UOS.ProgramApp && typeof window.UOS.ProgramApp.syncToolbarPrerequisites === "function") {
      var selectedPrj = findProject(state.selectedProjectId);
      var ws = getWorkspace();
      var hasGeom = false;
      var hasJb = false;
      if (selectedPrj && ws && ws.entities) {
        var projId = selectedPrj.id;
        hasGeom = (ws.entities.geometries || []).some(function (g) { return g.projectId === projId || (g.payload && g.payload.projectId === projId); });
        hasJb = (ws.entities.jobs || []).some(function (j) { return j.projectId === projId; });
      }
      var hasCosted = false;
      if (selectedPrj && ws && ws.entities) {
        var prjJobs = (ws.entities.jobs || []).filter(function (j) { return j.projectId === selectedPrj.id; });
        if (prjJobs.length) {
          var jIds = {};
          prjJobs.forEach(function (j) { jIds[j.id] = true; });
          hasCosted = (ws.entities.costingLines || []).some(function (cl) {
            return cl.projectId === selectedPrj.id || jIds[cl.jobId];
          });
        }
      }
      window.UOS.ProgramApp.syncToolbarPrerequisites(plannerToolbar, {
        currentModule: "planner",
        hasProject: Boolean(selectedPrj),
        hasMap: hasGeom,
        hasJobs: hasJb,
        hasCostedJobs: hasCosted,
        linkedProject: selectedPrj
      });
    }

    all("[data-planner-pane-mode]").forEach(function (btn) {
      var active = btn.getAttribute("data-planner-pane-mode") === state.sidebarMode;
      btn.setAttribute("aria-pressed", String(active));
      btn.classList.toggle("is-active", active);
    });

    renderSidebarList();
    renderChecklistTable();
  }

  function plannerFieldPatch(field, value) {
    if (field === "status") return { status: value };
    if (field === "owner") return { assigneeId: value };
    if (field === "due") return { dueDate: value };
    if (field === "notes") return { notes: value };
    if (field === "operational") return { operational: value };
    throw new Error('Unsupported Planner field "' + field + '".');
  }

  function setProjectField(projectId, itemId, field, value) {
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    var plannerModel = typeof window !== "undefined" && window.UOS && window.UOS.ProgramPlannerModel;
    if (!app || typeof app.updateWorkspace !== "function" || !plannerModel || typeof plannerModel.updateTask !== "function") return Promise.resolve(null);
    return app.updateWorkspace(function (candidate) {
      var outcome = plannerModel.updateTask(candidate, projectId, itemId, plannerFieldPatch(field, value), {});
      return outcome.workspace;
    }, { command: "Planner.updateTask" }).then(function (saved) {
      if (saved && typeof app.workspace === "function") state.workspace = app.workspace();
      return saved;
    }).catch(function (error) {
      if (window.UOS && typeof window.UOS.toast === "function") window.UOS.toast(error.message || "Planner task update failed.", "error");
      return null;
    });
  }

  function persist() {
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    if (!app || typeof app.updateWorkspace !== "function") return Promise.resolve(null);

    return app.updateWorkspace(function (candidate) {
      candidate.workspace = candidate.workspace || {};
      delete candidate.workspace.projectChecklists;
      var project = (candidate.entities.projects || []).find(function (item) { return item.id === state.selectedProjectId; });
      candidate.workspace.selectedProjectId = project ? project.id : "";
      candidate.workspace.selectedEntityId = project ? (project.applicationId || project.eventId || project.id) : "";
      if (project) candidate.workspace.ownerMode = project.owner;
      candidate.workspace.planner = candidate.workspace.planner || {};
      candidate.workspace.planner.selectedProjectId = project ? project.id : "";
      candidate.workspace.costing = candidate.workspace.costing || {};
      candidate.workspace.costing.selectedProjectId = project ? project.id : "";
      return candidate;
    }, { command: "Planner.persistViewState" }).catch(function () { return null; });
  }

  function openPlannerJob(jobId, projectId) {
    var app = window.UOS.ProgramApp;
    return app.navigate("scheduler").then(function () {
      return app.updateWorkspace(function (candidate) {
        candidate.workspace.destination = "scheduler";
        candidate.workspace.selectedProjectId = projectId;
        candidate.workspace.selectedEntityId = jobId;
        candidate.workspace.scheduler = candidate.workspace.scheduler || {};
        candidate.workspace.scheduler.selectedProjectId = projectId;
        candidate.workspace.scheduler.selectedId = jobId;
        candidate.workspace.scheduler.detail = true;
        candidate.workspace.scheduler.inspectorMode = "detail";
        return candidate;
      }, { command: "Planner.openScheduler" });
    }).then(function () { return window.UOS.ProgramSchedulerUI.selectJob(jobId); });
  }

  function applyPlannerModel(action, taskId) {
    var app = window.UOS && window.UOS.ProgramApp;
    var plannerModel = window.UOS && window.UOS.ProgramPlannerModel;
    if (!app || !plannerModel || typeof plannerModel[action] !== "function" || !taskId) return Promise.resolve(null);
    var outcome = null;
    return app.updateWorkspace(function (candidate) {
      outcome = action === "duplicateTasks"
        ? plannerModel.duplicateTasks(candidate, state.selectedProjectId, [taskId], {})
        : plannerModel[action](candidate, state.selectedProjectId, taskId, {});
      return outcome && outcome.workspace ? outcome.workspace : outcome;
    }).then(function (saved) {
      if (action === "createDraftJob" && saved && outcome && outcome.job) {
        return openPlannerJob(outcome.job.id, state.selectedProjectId).then(function () { return saved; });
      }
      return saved;
    }).catch(function (error) {
      if (window.UOS && typeof window.UOS.toast === "function") window.UOS.toast(error.message || "Planner action failed.", "error");
      return null;
    });
  }

  function plannerTask(taskId) {
    var ws = getWorkspace();
    return ws && ws.entities && (ws.entities.tasks || []).find(function (task) {
      return task.id === taskId && task.projectId === state.selectedProjectId;
    }) || null;
  }

  function calendarGuide() {
    function icon(tick) {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4M16 3v4M3 10h18' + (tick ? 'M8 16l2.5 2.5L16.5 13' : '') + '"></path></svg>';
    }
    var edit = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"></path><path d="m13.5 6.5 4 4"></path></svg>';
    var reminder = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="1"></circle><circle cx="6" cy="12" r="1"></circle><circle cx="6" cy="17" r="1"></circle><path d="M10 7h8M10 12h8M10 17h8"></path></svg>';
    return '<div class="planner-guide-column"><h3>Edit task</h3>' +
      '<div class="planner-calendar-guide__row"><span class="planner-calendar-guide__icon planner-guide-edit" aria-hidden="true">' + edit + '</span><span>Edit task details, purpose and status.</span></div>' +
      '<div class="planner-calendar-guide__row"><span class="planner-calendar-guide__icon" aria-hidden="true">' + reminder + '</span><span>Reminder task</span></div>' +
      '<div class="planner-calendar-guide__row planner-guide-conversion"><span class="planner-guide-symbols" aria-hidden="true"><span class="planner-calendar-guide__icon">' + reminder + '</span><span class="planner-guide-arrow">→</span><span class="planner-calendar-guide__icon is-scheduler-ready">' + reminder + '</span></span><span>Changing a Reminder task to “Add to Scheduler” adds a dark green frame. The icon and background stay unchanged until you use the button to create a draft Job.</span></div></div>' +
      '<div class="planner-guide-column"><h3>Scheduler</h3>' +
      '<div class="planner-calendar-guide__row"><span class="planner-calendar-guide__icon" aria-hidden="true">' + icon(false) + '</span><span>Click to schedule a job</span></div>' +
      '<div class="planner-calendar-guide__row"><span class="planner-calendar-guide__icon is-linked-job" aria-hidden="true">' + icon(false) + '</span><span>Job Schedule not finalised</span></div>' +
      '<div class="planner-calendar-guide__row"><span class="planner-calendar-guide__icon is-linked-job" aria-hidden="true">' + icon(true) + '</span><span>Job Schedule finalised</span></div></div>';
  }

 function syncTaskReason(form) {
 var task = plannerTask(form.getAttribute("data-task-id")), status = window.UOS.ProgramStatus;
 var required = Boolean(task && status.reasonRequired("task", status.codeFor("task", task.status), status.codeFor("task", form.elements.status.value)));
 form.querySelector("[data-planner-task-reason]").hidden = !required;
 form.elements.reason.disabled = !required;
 form.elements.reason.required = required;
 return required;
 }
 function renderTaskHistory(form, task) {
 var history = form.querySelector("[data-planner-task-history]");
 var events = task ? (getWorkspace().entities.statusEvents || []).filter(function (event) { return event.entityId === task.id; }) : [];
 var entries = events.filter(function (event) { return event.action !== "Planner.resetTask"; }).concat(task && task.plannerResetEvents || []);
 entries.sort(function (a, b) { return text(b.timestamp).localeCompare(text(a.timestamp)); });
 history.hidden = !task || !entries.length;
 history.innerHTML = '<summary>Task history</summary><ol>' + entries.map(function (entry) {
 var transition = entry.fromStatus ? window.UOS.ProgramStatus.labelFor("task", entry.fromStatus) + ' → ' + window.UOS.ProgramStatus.labelFor("task", entry.toStatus) : window.UOS.ProgramStatus.labelFor("task", entry.toStatus);
 var heading = entry.action === "Task reset" ? "Task reset" + (entry.fromStatus !== entry.toStatus ? " — " + transition : "") : transition;
 var date = new Date(entry.timestamp), displayTime = Number.isNaN(date.getTime()) ? entry.timestamp : date.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
 var name = text(entry.taskTitle);
 var nameLabel = name ? 'Task name: ' + name : 'Current task name: ' + text(task && task.title);
 var restoredName = text(entry.restoredTaskTitle);
 return '<li><p class="planner-task-history__name"><strong>' + esc(nameLabel) + '</strong></p>' + (restoredName ? '<p>Restored task name: ' + esc(restoredName) + '</p>' : '') + '<strong>' + esc(heading) + '</strong><p>' + esc(entry.actor || "Status engine") + ' · <time datetime="' + esc(entry.timestamp) + '">' + esc(displayTime) + '</time></p>' + (entry.reason ? '<p>' + esc(entry.reason) + '</p>' : '') + '</li>';
 }).join('') + '</ol>';
 }
 function stageTaskReset(form) {
 var task = plannerTask(form.getAttribute("data-task-id"));
 if (!task) return;
 var values = window.UOS.ProgramPlannerModel.resetValues(task);
 form.dataset.resetTask = "true";
 delete form.dataset.deleteLinkedJob;
 ["title", "description", "section", "assigneeId", "dueDate", "notes"].forEach(function (field) {
 var value = values[field] || (field === "assigneeId" ? "Not assigned" : "");
 if (field === "section" && !Array.from(form.elements.section.options).some(function (option) { return option.value === value; })) form.elements.section.add(new Option(value, value));
 form.elements[field].value = value;
 });
 form.elements.classification.value = values.operational ? "operational" : "inert";
 form.elements.status.value = window.UOS.ProgramStatus.labelFor("task", values.status);
 form.elements.reason.value = "";
 form.querySelector("[data-planner-task-reset-notice]").hidden = false;
 form.querySelector("[data-planner-task-error]").hidden = true;
 syncTaskReason(form);
 if (form.elements.reason.required) form.elements.reason.focus();
 }
 function confirmTaskJobDeletion(form, resetting) {
 var panel = form.querySelector("[data-planner-task-delete-confirm]"), dialog = form.closest("dialog");
 var submit = form.querySelector('button[value="save"]'), reset = form.querySelector("[data-planner-task-reset]");
 panel.querySelector("h3").textContent = resetting ? "Reset task and delete Job?" : "Change to reminder item?";
 panel.querySelector("p").textContent = "This deletes the linked Planner Job and its related draft work. Task history will be retained. Protected delivery or financial history will block the change.";
 panel.hidden = false;
 submit.disabled = true;
 reset.disabled = true;
 var remove = panel.querySelector("[data-planner-task-confirm-delete]"), keep = panel.querySelector("[data-planner-task-keep-job]");
 panel.scrollIntoView({ block: "nearest" });
 keep.focus();
 return new Promise(function (resolve) {
 function finish(confirmed) {
 panel.hidden = true;
 submit.disabled = false;
 reset.disabled = false;
 remove.removeEventListener("click", yes);
 keep.removeEventListener("click", no);
 dialog.removeEventListener("close", no);
 resolve(confirmed);
 }
 function yes() { finish(true); }
 function no() { finish(false); }
 remove.addEventListener("click", yes);
 keep.addEventListener("click", no);
 dialog.addEventListener("close", no);
 });
 }
  function ensureTaskInfoDialog() {
    var dialog = one("[data-planner-task-info-dialog]");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "program-dialog planner-task-dialog planner-task-info-dialog";
    dialog.setAttribute("data-planner-task-info-dialog", "");
    dialog.innerHTML = '<div class="planner-task-editor planner-task-info-editor">' +
      '<header class="planner-task-editor__head"><div><p class="uos-eyebrow">Planner task</p><h2 data-planner-task-info-dialog-title>Task information</h2></div>' +
      '<div class="planner-task-editor__head-actions"><button type="button" class="program-dialog__close" data-planner-task-info-close aria-label="Close task information">×</button></div></header>' +
      '<div class="planner-task-editor__body">' +
      '<section class="planner-task-editor__job planner-task-info-content planner-task-editor__wide" aria-labelledby="planner-task-info-summary-title"><h3 id="planner-task-info-summary-title">Task information</h3><h4 data-planner-task-info-title></h4><p data-planner-task-info-description></p></section>' +
      '<section class="planner-task-editor__job planner-task-editor__wide" aria-label="Scheduler calendar guide">' + calendarGuide() + '</section>' +
      '</div><footer class="planner-task-editor__actions"><button type="button" class="uos-button uos-button--secondary" data-planner-task-info-close>Close</button></footer>' +
      '</div>';
    document.body.appendChild(dialog);
    dialog.addEventListener("cancel", function (event) { event.preventDefault(); dialog.close(); });
    dialog.addEventListener("close", function () {
      var opener = dialog._plannerInfoOpener;
      dialog._plannerInfoOpener = null;
      if (opener && opener.isConnected && opener.focus) opener.focus();
    });
    return dialog;
  }

  function openTaskInfo(checklistItemId, opener) {
    var item = getActiveChecklistItems(state.selectedProjectId).find(function (candidate) {
      return String(candidate.id) === String(checklistItemId);
    });
    if (!item) return;
    var dialog = ensureTaskInfoDialog();
    dialog._plannerInfoOpener = opener || null;
    dialog.querySelector("[data-planner-task-info-title]").textContent = item.title || "Untitled task";
    dialog.querySelector("[data-planner-task-info-description]").textContent = item.desc || "No task information has been recorded.";
    if (!dialog.open) dialog.showModal();
    window.requestAnimationFrame(function () {
      var close = dialog.querySelector("[data-planner-task-info-close]");
      if (close) close.focus();
    });
  }

  function ensureTaskEditor() {
    var dialog = one("[data-planner-task-dialog]");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "program-dialog planner-task-dialog";
    dialog.setAttribute("data-planner-task-dialog", "");
    dialog.innerHTML = '<form method="dialog" class="planner-task-editor" data-planner-task-form>' +
      '<header class="planner-task-editor__head"><div><p class="uos-eyebrow">Governed Planner task</p><h2 data-planner-task-dialog-title>Task editor</h2></div>' +
 '<p class="planner-task-reset-pill" data-planner-task-reset-notice role="status" hidden>Original values restored for review. Save task to apply the reset.</p>' +
 '<div class="planner-task-editor__head-actions"><button type="button" class="uos-button uos-button--secondary" data-planner-task-reset>Reset</button><button type="button" class="program-dialog__close" data-planner-task-cancel aria-label="Close task editor">×</button></div></header>' +
      '<div class="planner-task-editor__body">' +
      '<label class="uos-field planner-task-editor__wide"><span>Title</span><input class="uos-input" name="title" required></label>' +
      '<label class="uos-field planner-task-editor__wide"><span>Description</span><textarea class="uos-input" name="description" rows="3" required></textarea></label>' +
      '<label class="uos-field"><span id="planner-task-section-label">Section</span><select class="uos-select" name="section" aria-labelledby="planner-task-section-label" required></select></label>' +
      '<label class="uos-field"><span id="planner-task-purpose-label">Task Purpose</span><select class="uos-select" name="classification" aria-labelledby="planner-task-purpose-label"><option value="inert">Reminder Task</option><option value="operational">Add to Scheduler</option></select></label>' +
      '<label class="uos-field"><span>Status</span><select class="uos-select" name="status"></select></label>' +
      '<label class="uos-field"><span>Session operator</span><input class="uos-input" name="operator" autocomplete="name" placeholder="Required when status changes"></label>' +
      '<label class="uos-field"><span>Assignee</span><select class="uos-select" name="assigneeId"></select></label>' +
      '<label class="uos-field"><span>Due date</span><input class="uos-input" type="date" name="dueDate"></label>' +
 '<label class="uos-field planner-task-editor__wide" data-planner-task-reason hidden><span>Reason for status change</span><textarea class="uos-input" name="reason" rows="2" disabled></textarea></label>' +
      '<label class="uos-field planner-task-editor__wide"><span>Notes</span><textarea class="uos-input" name="notes" rows="3"></textarea></label>' +
      '<section class="planner-task-editor__job planner-task-editor__wide" data-planner-task-job aria-label="Scheduler calendar guide">' + calendarGuide() + '</section>' +
 '<details class="planner-task-history planner-task-editor__wide" data-planner-task-history hidden aria-label="Task history"></details>' +
  '<section class="planner-task-delete-confirm planner-task-editor__wide" data-planner-task-delete-confirm hidden aria-label="Confirm linked Job deletion"><h3></h3><p></p><div><button type="button" class="uos-button uos-button--secondary" data-planner-task-keep-job>Keep Job</button><button type="button" class="uos-button uos-button--danger" data-planner-task-confirm-delete>Delete Job and continue</button></div></section>' +
 '</div><p class="program-form-error" data-planner-task-error hidden></p>' +
      '<footer class="planner-task-editor__actions"><button type="button" class="uos-button uos-button--secondary" data-planner-task-cancel>Cancel</button>' +
      '<button type="submit" class="uos-button uos-button--primary" value="save">Save task</button></footer></form>';
 document.body.appendChild(dialog);
 dialog.addEventListener("change", function (event) { if (event.target.name === "status") syncTaskReason(event.target.form); });
 dialog.querySelector("[data-planner-task-reset]").addEventListener("click", function () { stageTaskReset(dialog.querySelector("form")); });
    dialog.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
    });
    dialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
    });
    dialog.addEventListener("close", function () {
      var opener = dialog._plannerOpener;
      var editedRow = dialog._plannerEditedRow;
      dialog._plannerOpener = null;
      dialog._plannerEditedRow = null;
      if (editedRow && editedRow.isConnected) editedRow.classList.remove("is-being-edited");
      if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus();
    });
    return dialog;
  }

  function openTaskEditor(taskId) {
    var dialog = ensureTaskEditor();
    var form = dialog.querySelector("[data-planner-task-form]");
    var task = taskId ? plannerTask(taskId) : null;
    var project = findProject(state.selectedProjectId);
    var defaultSection = project && project.owner === "EVT" ? "Pre-Delivery Items" : "Planning and Approval";
    var view = task && getProjectChecklistData(state.selectedProjectId)[task.id] || {};
    var sections = [];
    getChecklistItems(state.selectedProjectId).map(function (item) { return item.category; })
      .concat(getActiveChecklistItems(state.selectedProjectId).map(function (item) { return item.category; }), task ? [task.section] : [])
      .forEach(function (section) { if (text(section) && sections.indexOf(text(section)) < 0) sections.push(text(section)); });

    form.reset();
 delete form.dataset.deleteLinkedJob;
 delete form.dataset.resetTask;
 form.querySelector("[data-planner-task-delete-confirm]").hidden = true;
 form.querySelector("[data-planner-task-reset-notice]").hidden = true;
 dialog.querySelector("[data-planner-task-reset]").disabled = !task;
 form.setAttribute("data-task-id", task ? task.id : "");
    form.elements.title.value = task ? task.title : "";
    form.elements.description.value = task ? task.description : "";
    form.elements.section.innerHTML = sections.map(function (section) { return '<option value="' + esc(section) + '">' + esc(section) + '</option>'; }).join("");
    form.elements.section.value = task ? task.section : defaultSection;
    form.elements.classification.value = task && task.operational ? "operational" : "inert";
    form.elements.classification.disabled = false;
    form.elements.status.innerHTML = STATUS_OPTIONS.map(function (status) { return '<option value="' + esc(status) + '">' + esc(status) + '</option>'; }).join("");
    form.elements.status.value = view.status || "Not Started";
    form.elements.operator.value = sessionOperator();
    form.elements.assigneeId.innerHTML = getOwnerOptions(state.selectedProjectId).map(function (owner) { return '<option value="' + esc(owner) + '">' + esc(owner) + '</option>'; }).join("");
    form.elements.assigneeId.value = view.owner || "Not assigned";
    form.elements.dueDate.value = task ? task.dueDate || "" : "";
 syncTaskReason(form);
 form.querySelector("[data-planner-task-history]").open = false;
 renderTaskHistory(form, task);
    form.elements.notes.value = task ? task.notes || "" : "";
    dialog.querySelector("[data-planner-task-dialog-title]").textContent = task ? "Edit task" : "Add task";
    dialog.querySelector("[data-planner-task-error]").hidden = true;
    document.querySelectorAll(".planner-item-row.is-being-edited").forEach(function (row) { row.classList.remove("is-being-edited"); });
    dialog._plannerEditedRow = taskId ? Array.prototype.find.call(document.querySelectorAll(".planner-item-row[data-task-entity-id]"), function (row) {
      return row.getAttribute("data-task-entity-id") === String(taskId);
    }) : null;
    if (dialog._plannerEditedRow) dialog._plannerEditedRow.classList.add("is-being-edited");
    dialog._plannerOpener = document.activeElement;
    dialog.showModal();
    form.elements.title.focus();
  }

  function savePlannerTask(form) {
    var app = window.UOS && window.UOS.ProgramApp;
    var plannerModel = window.UOS && window.UOS.ProgramPlannerModel;
    var dialog = form.closest("[data-planner-task-dialog]");
    var error = dialog.querySelector("[data-planner-task-error]");
    var outcome = null;
    var taskId = form.getAttribute("data-task-id") || null;
    var existingTask = taskId ? plannerTask(taskId) : null;
    var values = {
      title: form.elements.title.value,
      description: form.elements.description.value,
      section: form.elements.section.value,
      operational: form.elements.classification.value === "operational" || form.elements.classification.disabled,
      status: form.elements.status.value,
      assigneeId: form.elements.assigneeId.value,
      dueDate: form.elements.dueDate.value,
 sortOrder: existingTask ? (form.dataset.resetTask === "true" ? plannerModel.resetValues(existingTask).sortOrder : existingTask.sortOrder) : undefined,
      notes: form.elements.notes.value
    };
    var currentStatus = existingTask && window.UOS && window.UOS.ProgramStatus && typeof window.UOS.ProgramStatus.labelFor === "function"
      ? window.UOS.ProgramStatus.labelFor("task", existingTask.status) : (existingTask && existingTask.status || "Not Started");
    var statusChanged = Boolean(existingTask && values.status !== currentStatus);
    var actor = text(form.elements.operator.value);
    error.hidden = true;
 var resetting = form.dataset.resetTask === "true";
 var needsReason = syncTaskReason(form);
 var reason = needsReason ? text(form.elements.reason.value) : "";
 if ((statusChanged || resetting) && !actor) {
      error.textContent = "Enter a session operator name before changing status.";
      error.hidden = false;
      form.elements.operator.focus();
      return Promise.resolve(null);
    }
 if (needsReason && !reason) {
 error.textContent = "Enter a reason for this status change.";
 error.hidden = false;
 form.elements.reason.focus();
 return Promise.resolve(null);
 }
 if (actor) rememberSessionOperator(actor);
 var linkedJob = existingTask && plannerModel.taskState(app.workspace(), existingTask).job;
 var requiresJobDeletion = Boolean(linkedJob && (resetting || existingTask.operational && values.operational === false));
    if (requiresJobDeletion && form.dataset.deleteLinkedJob !== "true") {
      var confirmation = confirmTaskJobDeletion(form, resetting);
      return confirmation.then(function (confirmed) {
        if (!confirmed) return null;
        form.dataset.deleteLinkedJob = "true";
        return savePlannerTask(form);
      });
    }
    return app.updateWorkspace(function (candidate) {
 var options = { deleteLinkedJob: form.dataset.deleteLinkedJob === "true", actor: actor, reason: reason };
 outcome = resetting ? plannerModel.resetTask(candidate, state.selectedProjectId, taskId, values, options) : plannerModel.saveTask(candidate, state.selectedProjectId, taskId, values, options);
      return outcome.workspace;
 }, { command: resetting ? "Planner.resetTask" : "Planner.saveTask", actor: actor, reason: reason }).then(function (saved) {
    dialog.close();
    state.workspace = saved || (typeof app.workspace === "function" ? app.workspace() : state.workspace);
    renderUI();
    if (window.UOS && window.UOS.ProgramPlanner && typeof window.UOS.ProgramPlanner.renderUI === "function") {
      window.requestAnimationFrame(function () { window.UOS.ProgramPlanner.renderUI(); });
    }
    return outcome;
    }).catch(function (failure) {
      error.textContent = failure.message || "Planner task could not be saved.";
      error.hidden = false;
      return null;
    });
  }

  function bind() {
    if (state.bound || typeof document === "undefined") return;
    plannerRoot = document.querySelector('[data-program-view="planner"]');
    state.bound = true;

    document.addEventListener("click", function (event) {
      var plannerJumpBtn = event.target.closest("[data-planner-toolbar-jump],[data-planner-jump]");
      var paneBtn = event.target.closest("[data-planner-pane-mode]");
      var card = event.target.closest("[data-planner-project-id]");
      var tabBtn = event.target.closest("[data-planner-tab]");
      var taskInfoBtn = event.target.closest("[data-planner-task-info]");
      var taskInfoCloseBtn = event.target.closest("[data-planner-task-info-close]");
      var deleteBtn = event.target.closest("[data-delete-item]");
      var addBtn = event.target.closest(".planner-btn-add-item");
      var duplicateBtn = event.target.closest("[data-planner-duplicate]");
      var selectableRow = event.target.closest("[data-planner-selectable]");
      var draftJobBtn = event.target.closest("[data-planner-draft-job]");
      var operationalBtn = event.target.closest("[data-planner-operational]");
      var scheduledJobBtn = event.target.closest("[data-planner-open-scheduled-job]");
      var editTaskBtn = event.target.closest("[data-planner-edit-task]");
      var cancelTaskBtn = event.target.closest("[data-planner-task-cancel]");

      // Shared mini-drawer contract: defer the list-rebuilding selection render
      // and persistence until the single opening motion has completed.
      if (card && event.target.closest("[data-disclosure-toggle]")) {
        var plannerDisclosureToggle = event.target.closest("[data-disclosure-toggle]");
        var plannerDisclosureKey = plannerDisclosureToggle.getAttribute("data-disclosure-key");
        if (plannerDisclosureToggle.getAttribute("aria-expanded") !== "true") return;
        var plannerProjectId = card.getAttribute("data-planner-project-id");
        if (!findProject(plannerProjectId)) return;
        state.selectedProjectId = plannerProjectId;
        var disclosureApi = window.UOS && window.UOS.ProgramDisclosureRows;
        var finishPlannerSelection = function () { renderUI(); persist(); };
        if (!disclosureApi || typeof disclosureApi.afterOpen !== "function" || !disclosureApi.afterOpen(plannerDisclosureKey, finishPlannerSelection)) finishPlannerSelection();
        return;
      }

      if (taskInfoCloseBtn) {
        taskInfoCloseBtn.closest("[data-planner-task-info-dialog]").close();
      } else if (taskInfoBtn) {
        event.preventDefault();
        event.stopPropagation();
        openTaskInfo(taskInfoBtn.getAttribute("data-planner-task-info"), taskInfoBtn);
      } else if (cancelTaskBtn) {
        cancelTaskBtn.closest("[data-planner-task-dialog]").close();
      } else if (scheduledJobBtn) {
        event.preventDefault();
        event.stopPropagation();
        var scheduledJobId = scheduledJobBtn.getAttribute("data-planner-open-scheduled-job");
        var scheduledProjectId = scheduledJobBtn.getAttribute("data-planner-scheduled-project") || state.selectedProjectId;
        openPlannerJob(scheduledJobId, scheduledProjectId).catch(function (error) {
          if (window.UOS.toast) window.UOS.toast(error.message || "Could not open Scheduler Job.", "error");
        });
      } else if (editTaskBtn) {
        event.preventDefault();
        event.stopPropagation();
        openTaskEditor(editTaskBtn.getAttribute("data-planner-edit-task"));
      } else if (draftJobBtn) {
        event.preventDefault(); event.stopPropagation();
        applyPlannerModel("createDraftJob", draftJobBtn.getAttribute("data-planner-draft-job"));
      } else if (operationalBtn) {
        event.preventDefault(); event.stopPropagation();
        var operationalTaskId = operationalBtn.getAttribute("data-planner-operational");
        var currentTask = getProjectChecklistData(state.selectedProjectId)[operationalTaskId];
        if (!currentTask) return;
        setProjectField(state.selectedProjectId, operationalTaskId, "operational", !currentTask.operational).then(function () {
          setTimeout(renderUI, 0);
        });
      } else if (duplicateBtn) {
        if (!state.selectedChecklistItemId) return;
        var saved = getProjectChecklistData(state.selectedProjectId)[state.selectedChecklistItemId] || {};
        if (!saved.id) return;
        applyPlannerModel("duplicateTasks", saved.id).then(function () { renderUI(); });
      } else if (selectableRow && !event.target.closest("button,input,select")) {
        state.selectedChecklistItemId = selectableRow.getAttribute("data-checklist-item-id"); renderUI();
    } else if (plannerJumpBtn) {
      var jumpDest = plannerJumpBtn.getAttribute("data-planner-toolbar-jump") || plannerJumpBtn.getAttribute("data-planner-jump");
      var prj = findProject(state.selectedProjectId);
      if (prj && window.UOS && window.UOS.ProgramApp && typeof window.UOS.ProgramApp.navigateWithContext === "function") {
        window.UOS.ProgramApp.navigateWithContext(jumpDest, prj.id);
        return;
      }
      if (prj && window.UOS && window.UOS.ProgramApp) {
          window.UOS.ProgramApp.updateWorkspace(function (candidate) {
            candidate.workspace = candidate.workspace || {};
            candidate.workspace.selectedProjectId = prj.id;
            candidate.workspace.selectedEntityId = prj.applicationId || prj.eventId || prj.id;
            if (prj.owner === "NSA" || prj.owner === "EVT") candidate.workspace.ownerMode = prj.owner;
            if (jumpDest === "costing") {
              candidate.workspace.costing = candidate.workspace.costing || {};
              candidate.workspace.costing.selectedProjectId = prj.id;
              candidate.workspace.costing.mode = prj.owner === "EVT" ? "events" : "applications";
            } else if (jumpDest === "scheduler") {
              candidate.workspace.scheduler = candidate.workspace.scheduler || {};
              candidate.workspace.scheduler.selectedProjectId = prj.id;
            }
            return candidate;
          }).then(function () {
            window.UOS.ProgramApp.navigate(jumpDest);
          });
        }
      } else if (paneBtn) {
        state.sidebarMode = paneBtn.getAttribute("data-planner-pane-mode");
        plannerStatusFilters = [];
        var list = getProjectList();
        if (list.length) {
          var firstInList = list[0];
          state.selectedProjectId = firstInList.id || firstInList.applicationId || firstInList.eventId;
        }
        renderUI();
      } else if (event.target.closest("[data-planner-status-filter]")) {
        var statusPillBtn = event.target.closest("[data-planner-status-filter]");
        var filterVal = statusPillBtn.getAttribute("data-planner-status-filter");
        var idx = plannerStatusFilters.indexOf(filterVal);
        if (idx >= 0) {
          plannerStatusFilters.splice(idx, 1);
        } else {
          plannerStatusFilters.push(filterVal);
        }
        renderSidebarList();
      } else if (card) {
        state.selectedProjectId = card.getAttribute("data-planner-project-id");
        renderUI();
        persist();
      } else if (tabBtn) {
        state.activeTab = tabBtn.getAttribute("data-planner-tab");
        renderUI();
      } else if (deleteBtn) {
        var itemId = deleteBtn.getAttribute("data-delete-item");
        var app = window.UOS && window.UOS.ProgramApp;
        var plannerModel = window.UOS && window.UOS.ProgramPlannerModel;
      if (app && plannerModel && typeof plannerModel.updateTask === "function") {
        var projectId = state.selectedProjectId;
        var taskTitle = deleteBtn.closest("tr").querySelector(".planner-value-frame--task").textContent;
        window.UOS.ProgramDeleteSafety.confirm({
          title: "Remove Planner task?", confirmLabel: "Remove task",
          message: 'Remove "' + taskTitle + '" from the Planner checklist? The task is retained as a suppressed record. Any linked Job and its financial history remain unchanged.',
          apply: function (guard) {
            return app.updateWorkspace(function (candidate) {
              guard(candidate);
              return plannerModel.updateTask(candidate, projectId, itemId, { suppressed: true }, {}).workspace;
            }, { command: "Planner.suppressTask" });
          }
        });
        }
      } else if (addBtn) {
        openTaskEditor(null);
      }
    });

    document.addEventListener("submit", function (event) {
      var form = event.target.closest && event.target.closest("[data-planner-task-form]");
      if (!form) return;
      event.preventDefault();
      savePlannerTask(form);
    });

    document.addEventListener("input", function (event) {
      var searchInput = event.target.closest("#plannerSearchInput");
      var notesInput = event.target.closest("[data-checklist-notes]");
      var dueInput = event.target.closest("[data-checklist-due]");

      if (searchInput) {
        state.searchQuery = text(searchInput.value).toLowerCase();
        renderSidebarList();
      } else if (notesInput) {
        var itemId = notesInput.getAttribute("data-checklist-notes");
        setProjectField(state.selectedProjectId, itemId, "notes", notesInput.value);
      } else if (dueInput) {
        var itemId = dueInput.getAttribute("data-checklist-due");
        setProjectField(state.selectedProjectId, itemId, "due", dueInput.value);
      }
    });

    document.addEventListener("change", function (event) {
      var statusSel = event.target.closest("[data-checklist-status]");
      var ownerSel = event.target.closest("[data-checklist-owner]");

      if (statusSel) {
        var itemId = statusSel.getAttribute("data-checklist-status");
        setProjectField(state.selectedProjectId, itemId, "status", statusSel.value);
      } else if (ownerSel) {
        var itemId = ownerSel.getAttribute("data-checklist-owner");
        setProjectField(state.selectedProjectId, itemId, "owner", ownerSel.value);
      }
    });

    document.addEventListener("keydown", function (event) {
      var row = event.target.closest && event.target.closest("[data-planner-selectable]");
      if (row && (event.key === "Enter" || event.key === " ") && !event.target.closest("button,input,select")) { event.preventDefault(); state.selectedChecklistItemId = row.getAttribute("data-checklist-item-id"); renderUI(); }
    });

    document.addEventListener("uos:program-ready", function (event) {
      var ws = event.detail && event.detail.workspace;
      if (!ws || !ws.workspace || ws.workspace.destination !== "planner") return;
      if (ws) {
        state.workspace = ws;
        var subWs = ws.workspace || {};
        if (subWs.ownerMode === "EVT" || subWs.ownerMode === "NSA") {
          var nextSidebarMode = subWs.ownerMode === "EVT" ? "events" : "applications";
          if (nextSidebarMode !== state.sidebarMode) { plannerStatusFilters = []; state.searchQuery = ""; }
          state.sidebarMode = nextSidebarMode;
        }
        var currentList = getProjectList();
        if (!currentList.length) {
          state.selectedProjectId = null;
        } else {
          var selId = subWs.selectedProjectId || subWs.selectedEntityId;
          if (selId) {
            if (selId !== state.selectedProjectId) {
              plannerStatusFilters = [];
              state.searchQuery = "";
              var plannerSearch = one("#plannerSearchInput");
              if (plannerSearch) plannerSearch.value = "";
            }
            state.selectedProjectId = selId;
            var matched = findProject(selId);
            if (matched) {
              var owner = matched.owner || (matched.id && text(matched.id).indexOf("EVT") === 0 ? "EVT" : "NSA");
              state.sidebarMode = owner === "EVT" ? "events" : "applications";
            } else if (selId.indexOf("EVT") >= 0) {
              state.sidebarMode = "events";
            }
          }
        }
      }
      renderUI();
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
    else bind();
  }

  return {
    CHECKLIST_ITEMS: CHECKLIST_ITEMS,
    REMEDIATION_CHECKLIST_ITEMS: REMEDIATION_CHECKLIST_ITEMS,
    renderUI: renderUI,
    bind: bind,
    state: state
  };
}));
