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
  function esc(value) { return text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function one(selector) { return typeof document === "undefined" ? null : document.querySelector(selector); }
  function all(selector) { return typeof document === "undefined" ? [] : Array.prototype.slice.call(document.querySelectorAll(selector)); }

  function getWorkspace() {
    if (state.workspace) return state.workspace;
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    if (app) {
      if (typeof app.getWorkspace === "function") return app.getWorkspace();
      if (typeof app.workspace === "function") return app.workspace();
    }
    return null;
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
      canonical[task.id] = {
        id: task.id, templateKey: task.templateKey || task.legacyChecklistId || "", title: task.title || "",
        section: task.section || task.category || "", description: task.description || "", sortOrder: task.sortOrder,
        status: window.UOS && window.UOS.ProgramStatus ? window.UOS.ProgramStatus.labelFor("task", task.status) : (task.status || "Not Started"), owner: task.assigneeId || "Not assigned", due: task.dueDate || "",
        notes: task.notes || "", jobId: task.jobId || task.schedulerJobId || null,
        schedulerJobId: task.schedulerJobId || null, operational: task.operational === true,
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
        '<h3 style="margin:0;font-size:16px;font-weight:800;color:var(--uos-text);">Project Checklists</h3>' +
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
        '<th class="planner-col-task"></th>' +
        '<th class="planner-col-status">Status</th>' +
        '<th class="planner-col-owner">Owner</th>' +
        '<th class="planner-col-due">Due</th>' +
        '<th class="planner-col-notes">Notes</th>' +
        '<th class="planner-col-action"></th>' +
      '</tr>' +
    '</thead>';

    var tableBodyHtml = '<tbody>' + categories.map(function (catName) {
      var catItems = activeItemsForProject.filter(function (it) { return it.category === catName; });
      var catHeaderRow = '<tr class="planner-cat-header-row"><td colspan="6"><strong>' + esc(catName.toUpperCase()) + ' · ' + catItems.length + ' ITEMS</strong></td></tr>';

      var rowsHtml = catItems.map(function (it) {
        var itemSaved = chkData[it.id] || { status: "Not Started", owner: "Not assigned", due: "", notes: "" };
        var isDone = itemSaved.status === "Complete";
        var isExpanded = Boolean(state.expandedItems[it.id]);
        var statusSlug = text(itemSaved.status).toLowerCase().replace(/[^a-z0-9]+/g, "-");
        var taskEntityId = itemSaved.id || it.canonicalId || "";
        var plannerModel = window.UOS && window.UOS.ProgramPlannerModel;
        var schedulable = Boolean(plannerModel && plannerModel.isOperationalTask && plannerModel.isOperationalTask(itemSaved));
        var scheduled = Boolean(itemSaved.schedulerJobId);
        var linkedJob = Boolean(itemSaved.jobId);
        var customTask = Boolean(taskEntityId && !itemSaved.templateKey && !itemSaved.schedulable);
        var duplicateSelected = String(state.selectedChecklistItemId) === String(it.id);

        var dotColorClass = itemSaved.status === "Complete" ? "dot--complete" : itemSaved.status === "In Progress" ? "dot--inprogress" : itemSaved.status === "On Hold" ? "dot--onhold" : "dot--notstarted";

        var statusOptionsHtml = STATUS_OPTIONS.map(function (opt) {
          return '<option value="' + esc(opt) + '"' + (itemSaved.status === opt ? " selected" : "") + '>' + esc(opt) + '</option>';
        }).join("");

        var ownerOptionsHtml = ownerOptions.map(function (opt) {
          return '<option value="' + esc(opt) + '"' + (itemSaved.owner === opt ? " selected" : "") + '>' + esc(opt) + '</option>';
        }).join("");

        var descRowHtml = isExpanded ? '<tr class="planner-desc-row" data-status-slug="' + esc(statusSlug) + '"><td colspan="6"><div class="planner-desc-content" role="note"><svg class="planner-desc-info-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></svg><span>' + esc(it.desc) + '</span></div></td></tr>' : '';

        return '<tr class="planner-item-row' + (isDone ? " is-complete" : "") + (duplicateSelected ? " is-duplicate-selected" : "") + '" data-status-slug="' + esc(statusSlug) + '" data-checklist-item-id="' + it.id + '" data-task-entity-id="' + esc(taskEntityId) + '" data-planner-selectable tabindex="0" aria-selected="' + String(duplicateSelected) + '">' +
          '<td class="planner-col-task">' +
            '<div class="planner-task-cell">' +
              '<span>' + esc(it.title) + '</span>' +
              '<button type="button" class="planner-chevron-btn" data-toggle-expand="' + it.id + '" title="Toggle description"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' +
            '</div>' +
          '</td>' +
          '<td class="planner-col-status">' +
            '<div class="planner-status-wrapper">' +
              '<span class="planner-status-dot ' + dotColorClass + '"></span>' +
              '<select class="planner-table-select" data-checklist-status="' + it.id + '">' + statusOptionsHtml + '</select>' +
            '</div>' +
          '</td>' +
          '<td class="planner-col-owner">' +
            '<select class="planner-table-select" data-checklist-owner="' + it.id + '">' + ownerOptionsHtml + '</select>' +
          '</td>' +
          '<td class="planner-col-due">' +
            '<input type="date" class="planner-date-input" data-checklist-due="' + it.id + '" value="' + esc(itemSaved.due || "") + '" placeholder="dd/mm/yyyy">' +
          '</td>' +
          '<td class="planner-col-notes">' +
            '<input type="text" class="planner-notes-input" data-checklist-notes="' + it.id + '" value="' + esc(itemSaved.notes || "") + '" placeholder="">' +
          '</td>' +
          '<td class="planner-col-action">' +
            (customTask && !linkedJob ? '<button type="button" class="planner-schedule-btn" data-planner-operational="' + esc(taskEntityId) + '" aria-pressed="' + String(itemSaved.operational) + '" title="' + (itemSaved.operational ? 'Unmark operational task' : 'Mark as an operational task') + '">' + (itemSaved.operational ? 'Operational' : 'Mark operational') + '</button>' : '') +
            (schedulable ? '<button type="button" class="planner-schedule-btn' + (scheduled ? ' is-scheduled' : '') + '" data-planner-draft-job="' + esc(taskEntityId) + '" aria-label="' + (linkedJob ? 'Open Planner job for ' : 'Create draft job for ') + esc(it.title) + '" title="' + (linkedJob ? 'Open Planner job' : 'Create Draft Job') + '">' + (scheduled ? 'Scheduled' : linkedJob ? 'Open draft job' : 'Create Draft Job') + '</button>' : '') +
            '<button type="button" class="planner-delete-btn" data-delete-item="' + it.id + '" title="Delete item">×</button>' +
          '</td>' +
        '</tr>' + descRowHtml;
      }).join("");

      return catHeaderRow + rowsHtml;
    }).join("") + '</tbody>';

    container.innerHTML = topNavHtml + '<div class="planner-table-wrap"><table class="planner-table">' + tableHeadHtml + tableBodyHtml + '</table></div>';
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
      if (action === "createDraftJob" && saved) {
        var jobId = outcome && outcome.job && outcome.job.id;
        if (jobId) {
          return app.updateWorkspace(function (candidate) { candidate.workspace = candidate.workspace || {}; candidate.workspace.destination = "scheduler"; candidate.workspace.selectedEntityId = jobId; candidate.workspace.scheduler = candidate.workspace.scheduler || {}; candidate.workspace.scheduler.selectedId = jobId; return candidate; }).then(function () { app.navigate("scheduler"); return saved; });
        }
      }
      return saved;
    }).catch(function (error) {
      if (window.UOS && typeof window.UOS.toast === "function") window.UOS.toast(error.message || "Planner action failed.", "error");
      return null;
    });
  }

  function createPlannerTask() {
    var app = window.UOS && window.UOS.ProgramApp;
    var plannerModel = window.UOS && window.UOS.ProgramPlannerModel;
    if (!app || !plannerModel || typeof plannerModel.createTask !== "function" || !state.selectedProjectId) return Promise.resolve(null);
    return app.updateWorkspace(function (candidate) {
      var suppressed = (candidate.entities.tasks || []).filter(function (task) { return task.projectId === state.selectedProjectId && task.suppressed === true; }).sort(function (a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); })[0];
      if (suppressed) return plannerModel.updateTask(candidate, state.selectedProjectId, suppressed.id, { suppressed: false }, {}).workspace;
      var project = (candidate.entities.projects || []).find(function (item) { return item.id === state.selectedProjectId; });
      var section = project && project.owner === "EVT" ? "Pre-Delivery Items" : "Planning and Approval";
      return plannerModel.createTask(candidate, state.selectedProjectId, { section: section, title: "New task", description: "Custom checklist task" }, {}).workspace;
    }, { command: "Planner.createTask" }).catch(function (error) {
      if (window.UOS && typeof window.UOS.toast === "function") window.UOS.toast(error.message || "Planner task creation failed.", "error");
      return null;
    });
  }

  function bind() {
    if (state.bound || typeof document === "undefined") return;
    state.bound = true;

    document.addEventListener("click", function (event) {
      var plannerJumpBtn = event.target.closest("[data-planner-toolbar-jump],[data-planner-jump]");
      var paneBtn = event.target.closest("[data-planner-pane-mode]");
      var card = event.target.closest("[data-planner-project-id]");
      var tabBtn = event.target.closest("[data-planner-tab]");
      var expandBtn = event.target.closest("[data-toggle-expand]");
      var deleteBtn = event.target.closest("[data-delete-item]");
      var addBtn = event.target.closest(".planner-btn-add-item");
      var duplicateBtn = event.target.closest("[data-planner-duplicate]");
      var selectableRow = event.target.closest("[data-planner-selectable]");
      var draftJobBtn = event.target.closest("[data-planner-draft-job]");
      var operationalBtn = event.target.closest("[data-planner-operational]");

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

      if (draftJobBtn) {
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
      } else if (expandBtn) {
        var itemId = expandBtn.getAttribute("data-toggle-expand");
        state.expandedItems[itemId] = !state.expandedItems[itemId];
        renderUI();
      } else if (deleteBtn) {
        var itemId = deleteBtn.getAttribute("data-delete-item");
        var app = window.UOS && window.UOS.ProgramApp;
        var plannerModel = window.UOS && window.UOS.ProgramPlannerModel;
        if (app && plannerModel && typeof plannerModel.updateTask === "function") {
          app.updateWorkspace(function (candidate) {
            return plannerModel.updateTask(candidate, state.selectedProjectId, itemId, { suppressed: true }, {}).workspace;
          }, { command: "Planner.suppressTask" }).catch(function (error) {
            if (window.UOS && typeof window.UOS.toast === "function") window.UOS.toast(error.message || "Planner task deletion failed.", "error");
          });
        }
      } else if (addBtn) {
        createPlannerTask();
      }
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
