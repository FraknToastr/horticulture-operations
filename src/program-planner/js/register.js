(function (root, factory) {
  "use strict";
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.UOS = root.UOS || {};
    root.UOS.ProgramRegister = api;
  }
}(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function (root) {
  "use strict";

  var state = {
    workspace: null, records: [], filtered: [], mode: "list", selectedId: null,
    focusedIndex: 0, scrollTop: 0, sort: "date", sortDirection: "asc",
    filters: { ownership: "all", status: "all", crew: "all", query: "" }, bound: false, scrollTimer: null,
    pendingDeleteId: null, deleteTrigger: null, pendingLocalPatches: []
  };

  function text(value) { return value == null ? "" : String(value).trim(); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function first(item, names) {
    var payload = item && item.payload && typeof item.payload === "object" ? item.payload : {};
    for (var index = 0; index < names.length; index += 1) {
      if (text(item && item[names[index]])) return text(item[names[index]]);
      if (text(payload[names[index]])) return text(payload[names[index]]);
    }
    return "";
  }
  function getFinancialYearOptions(referenceDate) {
    var now = referenceDate ? new Date(referenceDate) : new Date();
    if (isNaN(now.getTime())) now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var currentFyStart = month >= 6 ? year : (year - 1);
    var startFrom = currentFyStart - 1;

    var options = [];
    for (var i = 0; i < 10; i += 1) {
      var fyStart = startFrom + i;
      var fyEnd = fyStart + 1;
      var label = "FY " + fyStart + "/" + String(fyEnd % 100).padStart(2, "0");
      options.push({ label: label, value: label });
    }
    return options;
  }

  function getFinancialYearForDate(dateStr) {
    if (!dateStr) return getFinancialYearOptions()[1].value;
    var parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      var m = String(dateStr).match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (m) parsed = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      else return getFinancialYearOptions()[1].value;
    }
    var year = parsed.getFullYear();
    var month = parsed.getMonth();
    var fyStart = month >= 6 ? year : (year - 1);
    var fyEnd = fyStart + 1;
    return "FY " + fyStart + "/" + String(fyEnd % 100).padStart(2, "0");
  }

  var REMEDIATION_STATUSES = [
    "Received",
    "Report Completed and Sent",
    "Quoted",
    "Planning",
    "Scheduled",
    "Completed"
  ];

  var NSA_STATUSES = [
    "Received",
    "Quoted",
    "Scheduled",
    "In Progress",
    "Complete",
    "Cancelled"
  ];

  function getAuthoritativeStatuses(owner) {
    return owner === "EVT" ? REMEDIATION_STATUSES : NSA_STATUSES;
  }

  function normalizeStatus(st, owner) { var statusApi = root && root.UOS && root.UOS.ProgramStatus; if (statusApi) return statusApi.labelFor(owner === "EVT" ? "register_evt" : "register_nsa", st);
    var raw = text(st).trim();
    if (!raw || raw.toLowerCase() === "unspecified") return "Received";
    if (raw.toLowerCase() === "completed" || raw.toLowerCase() === "complete") {
      return owner === "EVT" ? "Completed" : "Complete";
    }
    var list = getAuthoritativeStatuses(owner);
    var match = list.find(function (item) { return item.toLowerCase() === raw.toLowerCase(); });
    if (match) return match;
    return "Received";
  }

  function recordFrom(item, collection) {
    var owner = item.owner === "EVT" ? "EVT" : "NSA";
    var model = typeof window !== "undefined" && window.UOS && window.UOS.ProgramModel;
    var summary = model && typeof model.recordSummary === "function" ? model.recordSummary(item) : null;
    var rawStatus = summary && summary.status || first(item, ["status", "applicationStatus", "state"]) || (item && item.details && text(item.details.status)) || (item && item.payload && item.payload.details && text(item.payload.details.status));
    var normStatus = normalizeStatus(rawStatus, owner);
    var appDate = first(item, ["dateReceived", "receivedDate", "endDate", "end_date", "applicationDate", "date", "eventDate", "startDate", "submittedDate", "createdAt"]);
    var defaultFy = getFinancialYearForDate(appDate);
    var rawHist = Array.isArray(item.statusHistory) ? item.statusHistory :
                  (item.payload && Array.isArray(item.payload.statusHistory) ? item.payload.statusHistory : []);
    return {
      id: text(item.id), owner: owner, ownerLabel: summary && summary.ownershipLabel || (owner === "EVT" ? "Remediation" : "Nature Strip"),
      kind: collection === "events" ? "Event" : "Application",
      name: summary && summary.title || first(item, ["name", "title", "eventName", "applicantName"]) || text(item.id) || "Untitled record",
      namePrivacyField: (function () {
        var displayed = summary && summary.title || first(item, ["name", "title", "eventName", "applicantName"]);
        var applicant = first(item, ["customerName", "applicantName", "contactName", "clientName", "contactPerson"]);
        return displayed && applicant && text(displayed) === text(applicant) ? "applicantName" : "";
      }()),
      date: summary && summary.startDate || first(item, ["dateReceived", "receivedDate", "date", "eventDate", "startDate", "submittedDate", "createdAt"]),
      priority: summary && summary.priority || first(item, ["priority"]) || "Normal",
      status: normStatus,
      crew: summary && summary.crewId || first(item, ["crew", "crewName", "crewId"]) || "Unassigned",
      location: first(item, ["location", "site", "address"]) || "Unassigned",
      financialYear: first(item, ["financialYear", "financialyear", "financial_year", "fy", "season"]) || defaultFy,
      statusHistory: clone(rawHist),
      raw: clone(item)
    };
  }
  function recordsFrom(workspace) {
    var entities = workspace && workspace.entities || {};
    return (Array.isArray(entities.applications) ? entities.applications : []).map(function (item) {
      return recordFrom(item, "applications");
    }).concat((Array.isArray(entities.events) ? entities.events : []).map(function (item) {
      return recordFrom(item, "events");
    }));
  }

  function privacyDisplay(value, semanticField) {
    var privacy = typeof window !== "undefined" && window.UOS && window.UOS.ProgramPrivacy;
    return privacy && typeof privacy.privacyDisplay === "function" ? privacy.privacyDisplay(value, semanticField) : value;
  }

  function registerDisplayName(record) {
    if (!record) return "";
    var source = record.raw || record;
    var applicant = first(source, ["customerName", "applicantName", "contactName", "clientName", "contactPerson"]);
    var semanticField = record.namePrivacyField || (applicant && text(record.name) === text(applicant) ? "applicantName" : "");
    return privacyDisplay(record.name, semanticField);
  }
  function unique(records, field) {
    return records.map(function (record) { return record[field]; }).filter(function (value, index, values) {
      return value && value !== "Unspecified" && value !== "Unassigned" && values.indexOf(value) === index;
    }).sort(function (left, right) { return left.localeCompare(right, "en-AU", { sensitivity: "base" }); });
  }
  function priorityRank(value) {
    var ranks = { urgent: 0, critical: 0, high: 1, medium: 2, normal: 2, low: 3, unspecified: 4 };
    return Object.prototype.hasOwnProperty.call(ranks, text(value).toLowerCase()) ? ranks[text(value).toLowerCase()] : 3;
  }

  function selectRecords(records, options) {
    var settings = options || {};
    var filters = settings.filters || {};
    var result = records.filter(function (record) {
      var recStatus = normalizeStatus(record.status, record.owner);
      var matchOwnership = (!filters.ownership || filters.ownership === "all" || record.owner === filters.ownership);
      var matchDropdownStatus = (!filters.status || filters.status === "all" || recStatus.toLowerCase() === filters.status.toLowerCase());
      var matchStatusPills = (!filters.statuses || !Array.isArray(filters.statuses) || filters.statuses.length === 0 || filters.statuses.some(function (st) {
        return text(st).toLowerCase() === recStatus.toLowerCase();
      }));
      var matchCrew = (!filters.crew || filters.crew === "all" || record.crew === filters.crew);
      var queryTokens = text(filters.query).toLocaleLowerCase("en-AU").split(/\s+/).filter(Boolean);
      var searchable = [
        record.id, record.owner, record.ownerLabel, record.kind, record.name, record.location,
        record.date, record.priority, record.status, record.crew, record.financialYear,
        first(record.raw, ["jobId", "job_id", "jobNumber", "job_number", "eventNumber"]),
        first(record.raw, ["receipt", "receiptNumber"]),
        record.raw && JSON.stringify(record.raw)
      ].map(function (value) { return text(value).toLocaleLowerCase("en-AU"); }).join(" ");
      var matchQuery = !queryTokens.length || queryTokens.every(function (token) { return searchable.indexOf(token) >= 0; });
      return matchOwnership && matchDropdownStatus && matchStatusPills && matchCrew && matchQuery;
    });
    var sort = settings.sort || "date";
    var direction = settings.sortDirection === "desc" ? -1 : 1;
    function reference(record) {
      return record.owner === "EVT"
        ? first(record.raw, ["jobId", "job_id", "jobNumber", "job_number", "job", "eventNumber"])
        : first(record.raw, ["receipt", "receiptNumber"]);
    }
    function compareText(left, right) {
      if (!left && !right) return 0;
      if (!left) return 1;
      if (!right) return -1;
      return left.localeCompare(right, "en-AU", { sensitivity: "base", numeric: true }) * direction;
    }
    return result.slice().sort(function (left, right) {
      if (sort === "priority") return (priorityRank(left.priority) - priorityRank(right.priority)) * direction || left.name.localeCompare(right.name);
      if (sort === "name") return compareText(left.name, right.name);
      if (sort === "id") return compareText(left.id, right.id);
      if (sort === "receipt") return compareText(reference(left), reference(right)) || compareText(left.name, right.name);
      return compareText(left.date, right.date) || compareText(left.name, right.name);
    });
  }
  function stateFromWorkspace(workspace) {
    var saved = workspace && workspace.workspace || {};
    var register = saved.register && typeof saved.register === "object" ? saved.register : {};
    var filters = register.filters && typeof register.filters === "object" ? register.filters : {};
    var inspector = saved.inspector && typeof saved.inspector === "object" ? saved.inspector : {};
    return {
      selectedId: text(saved.selectedEntityId) || null,
      mode: inspector.mode === "detail" ? "detail" : "list",
      scrollTop: Math.max(0, Number(inspector.scrollTop) || 0),
      sort: ["date", "receipt", "priority", "name", "id"].indexOf(register.sort) >= 0 ? register.sort : "date",
      sortDirection: register.sortDirection === "desc" ? "desc" : "asc",
      filters: {
        ownership: ["NSA", "EVT"].indexOf(filters.ownership) >= 0 ? filters.ownership : "all",
        status: text(filters.status) || "all",
        crew: text(filters.crew) || "all",
        query: text(filters.query),
        statuses: Array.isArray(filters.statuses) ? filters.statuses : []
      }
    };
  }
  function one(selector, scope) {
    if (typeof document === "undefined") return null;
    return (scope && scope.querySelector ? scope : document).querySelector(selector);
  }
  function setText(selector, value, scope) { var node = one(selector, scope); if (node) node.textContent = text(value); }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function badge(record) {
    var node = document.createElement("span");
    node.className = "program-owner-badge program-owner-badge--" + record.owner.toLowerCase();
    node.textContent = "[" + record.ownerLabel + "]";
    return node;
  }
  function option(select, value) {
    var node = document.createElement("option"); node.value = value; node.textContent = value; select.appendChild(node);
  }
  function populateFilter(selector, values, retained) {
    var select = one(selector); if (!select) return;
    while (select.options.length > 1) select.remove(1);
    values.forEach(function (value) { option(select, value); });
    select.value = values.indexOf(retained) >= 0 ? retained : "all";
  }
  function esc(value) {
    return text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var MODULE_ACTION_TOKENS = [
    {
      key: "register",
      label: "Register",
      tooltip: "Currently in Register",
      dest: "register",
      isCurrent: true,
      iconSvg: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>'
    },
    {
      key: "planner",
      label: "Project Planner",
      tooltip: "Send to Project Planner",
      dest: "planner",
      iconSvg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
    },
    {
      key: "map",
      label: "Space Map",
      tooltip: "Send to Space Map",
      dest: "map",
      iconSvg: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>'
    },
    {
      key: "costing",
      label: "Cost Calculator",
      tooltip: "Send to Cost Calculator",
      dest: "costing",
      iconSvg: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/></svg>'
    },
    {
      key: "scheduler",
      label: "Job Scheduler",
      tooltip: "Send to Job Scheduler",
      dest: "scheduler",
      iconSvg: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>'
    },
    {
      key: "quotes",
      label: "Quote Builder",
      tooltip: "Send to Quote Builder",
      dest: "quotes",
      iconSvg: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>'
    }
  ];

  function hasMapLocationsOrPolygons(rec, workspace) {
    if (!rec) return false;
    var id = rec.id;
    var sourceRecord = rec.raw || rec;
    var linkedProj = buildLinkedProject(workspace, rec);
    var projId = sourceRecord.projectId || rec.projectId || (linkedProj ? linkedProj.id : "");

    function hasCoordinate(item) {
      if (!item) return false;
      if (Array.isArray(item.locations) && item.locations.some(function (location) {
        return location && Array.isArray(location.coordinate) && location.coordinate.length >= 2 && typeof location.coordinate[0] === "number" && typeof location.coordinate[1] === "number";
      })) return true;
      var coord = item.location && Array.isArray(item.location.coordinate) && item.location.coordinate.length >= 2
        ? item.location.coordinate
        : (Array.isArray(item.coordinate) ? item.coordinate : null);
      if (coord && typeof coord[0] === "number" && typeof coord[1] === "number") return true;
      return false;
    }

    if (hasCoordinate(sourceRecord) || (linkedProj && hasCoordinate(linkedProj))) {
      return true;
    }

    if (Array.isArray(sourceRecord.polygons) && sourceRecord.polygons.length > 0) return true;
    if (linkedProj && Array.isArray(linkedProj.polygons) && linkedProj.polygons.length > 0) return true;

    var geometries = workspace && workspace.entities && Array.isArray(workspace.entities.geometries) ? workspace.entities.geometries : [];
    var shapeCount = geometries.filter(function (g) {
      if (!g) return false;
      var matchesId = g.eventId === id || g.applicationId === id || (projId && g.projectId === projId);
      var payload = g.payload || {};
      var matchesPayload = payload.eventId === id || payload.applicationId === id || (projId && payload.projectId === projId);
      return matchesId || matchesPayload;
    }).length;

    return shapeCount > 0;
  }

  function hasRelatedJobs(rec, workspace) {
    if (!rec || !workspace || !workspace.entities) return false;
    var project = buildLinkedProject(workspace, rec);
    return (workspace.entities.jobs || []).some(function (job) {
      return job.projectId === (project && project.id) || job.applicationId === rec.id || job.eventId === rec.id || job.sourceEntityId === rec.id;
    });
  }

  function hasCostedJobs(rec, workspace) {
    if (!rec || !workspace || !workspace.entities) return false;
    var project = buildLinkedProject(workspace, rec);
    var projId = project ? project.id : (rec.projectId || "");
    var jobs = (workspace.entities.jobs || []).filter(function (job) {
      return (projId && job.projectId === projId) || job.applicationId === rec.id || job.eventId === rec.id || job.sourceEntityId === rec.id;
    });
    if (!jobs.length) return false;
    var jobIds = {};
    jobs.forEach(function (j) { jobIds[j.id] = true; });
    return (workspace.entities.costingLines || []).some(function (cl) {
      return (projId && cl.projectId === projId) || jobIds[cl.jobId];
    });
  }

  function actionLinkState(token, hasProject, hasMap, hasJobs, hasCosted) {
    if (token.key === "planner") return hasProject;
    if (token.key === "costing") return hasProject && hasJobs;
    if (token.key === "map") return hasMap;
    if (token.key === "scheduler") return hasJobs;
    if (token.key === "quotes") return hasProject;
    return false;
  }

  function budgetAmountForRecord(record) {
    var api = window.UOS && window.UOS.ProgramBudget;
    var entities = state.workspace && state.workspace.entities || {};
    if (!record || !api || typeof api.allocationBalance !== "function") return 0;
    var budgets = {};
    (entities.annualBudgets || []).forEach(function (budget) { budgets[budget.id] = budget; });
    return (entities.registerAllocations || []).filter(function (allocation) {
      var budget = budgets[allocation.budgetId];
      return allocation.registerId === record.id && budget && budget.owner === record.owner;
    }).reduce(function (total, allocation) {
      var balance = api.allocationBalance(state.workspace, allocation.id);
      return total + Number(balance && balance.allocated || 0);
    }, 0);
  }
  function budgetAmountLabel(record) {
    return Number(budgetAmountForRecord(record)).toLocaleString("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function buildMiniToolbarHtml(recordId, recordObj) {
    var recordAttr = recordId ? ' data-register-record="' + esc(recordId) + '"' : '';
    var rec = recordObj || (recordId ? state.records.find(function (r) { return r.id === recordId; }) : null);
    var hasProject = rec ? Boolean(buildLinkedProject(state.workspace, rec)) : false;
    var hasLocationOrPoly = rec ? hasMapLocationsOrPolygons(rec, state.workspace) : false;
    var hasJobs = rec ? hasRelatedJobs(rec, state.workspace) : false;
    var hasCosted = rec ? hasCostedJobs(rec, state.workspace) : false;
    var linkedProject = rec ? buildLinkedProject(state.workspace, rec) : null;

 var html = '<nav class="program-register-mini-toolbar" data-owner="' + esc(rec && rec.owner === "EVT" ? "EVT" : "NSA") + '" aria-label="Send to module">';
    MODULE_ACTION_TOKENS.forEach(function (tok) {
      var isDisabled = false;
      var tooltip = tok.tooltip;
      var ariaLabel = tok.label;
      var isLinked = actionLinkState(tok, hasProject, hasLocationOrPoly, hasJobs, hasCosted);

      if ((tok.key === "planner" || tok.key === "quotes") && !hasProject) {
        isDisabled = true;
        tooltip = tok.key === "quotes"
          ? "Create a linked delivery project first to open in Quote Builder"
          : "Create a linked project first to open in Project Planner";
        ariaLabel = tooltip;
      } else if (tok.key === "scheduler" && !hasJobs) {
        isDisabled = true;
        tooltip = "Create at least one Job before opening this record in Scheduler";
        ariaLabel = "Scheduler (Disabled: This record has no Jobs)";
      } else if (tok.key === "map" && !hasLocationOrPoly) {
        tooltip = "Open Space Map to add a location or polygons";
        ariaLabel = "Space Map (No mapped location or polygons yet)";
      } else if (tok.key === "costing") {
        if (!hasProject) {
          isDisabled = true;
          tooltip = "Create a linked delivery project first to open in Cost Calculator";
        } else if (hasJobs) {
          isLinked = true;
          tooltip = "Open in Cost Calculator";
        } else {
          tooltip = "Open Cost Calculator — this Project has no Jobs yet";
        }
        ariaLabel = tooltip;
      }

      if (tok.key === "planner" && linkedProject) {
        isLinked = true;
        isDisabled = false;
        tooltip = "Open linked Project: " + (linkedProject.title || linkedProject.name || linkedProject.id);
        ariaLabel = tooltip;
      }
      if (isLinked) {
        isDisabled = false;
      }

    var activeDestination = text(state.workspace && state.workspace.workspace && state.workspace.workspace.destination) || "register";
    var isCurrent = tok.key === activeDestination;
    if (tok.key === "register") {
      tooltip = isCurrent ? "Currently in Register" : "Open owning Register";
      ariaLabel = tooltip;
    }
 var currentClass = isCurrent ? ' is-current-module' : '';
 var availableClass = !isCurrent && !isDisabled ? ' is-available-module' : '';
      var disabledAttr = isCurrent ? ' disabled aria-current="page"' : (isDisabled ? ' disabled aria-disabled="true"' : '');
      var linkedClass = isLinked && !isDisabled && !isCurrent ? ' program-register-action--linked' : '';
 html += '<button class="uos-button uos-button--secondary uos-button--sm' + currentClass + availableClass + linkedClass + '" type="button" data-register-action="' + tok.key + '"' + recordAttr +
        (isLinked && !isDisabled && !isCurrent ? ' data-linked-entity="true"' : '') +
        disabledAttr +
        ' data-uos-tooltip="' + esc(tooltip) + '" title="' + esc(tooltip) + '" aria-label="' + esc(ariaLabel) + '">' +
        tok.iconSvg +
        '</button>';
    });
    html += '<button class="uos-button uos-button--secondary uos-button--sm program-register-delete-btn" type="button" data-register-delete-id="' + esc(recordId) + '" data-uos-tooltip="Delete record" title="Delete record" aria-label="Delete record">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
      '</button>';
    html += '</nav>';
    return html;
  }

  function statusPillHtml(status) {
    var raw = text(status).trim();
    if (!raw || raw.toLowerCase() === "unspecified") {
      raw = "Received";
    }
    var slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return '<span class="program-status-pill status--' + esc(slug) + '" data-status="' + esc(raw) + '">' + esc(raw) + '</span>';
  }

  function registerSummaryRow(recordId) {
    return Array.prototype.find.call(document.querySelectorAll("tr.program-register-summary-row[data-register-record]"), function (row) {
      return row.getAttribute("data-register-record") === recordId;
    }) || null;
  }

  function patchRegisterSummary(record) {
    var row = record && registerSummaryRow(record.id);
    if (!row) return;
    var title = row.querySelector(".program-register-table__title-cell strong");
    var location = row.querySelector(".program-register-table__location-cell");
    var reference = row.querySelector(".program-register-table__reference-cell");
    var status = row.querySelector(".program-register-table__status-cell");
    var received = row.querySelector(".program-register-table__received-cell");
    var toggle = row.querySelector("[data-disclosure-toggle]");
    var formattedDate = (window.UOS && window.UOS.imports && window.UOS.imports.formatDate) ? window.UOS.imports.formatDate(record.date) : (record.date || "—");
    var refVal = record.owner === "EVT"
      ? record.jobId || first(record.raw, ["jobId", "job_id", "jobNumber", "job_number", "job", "eventNumber"]) || "—"
      : record.receipt || first(record.raw, ["receipt", "receiptNumber"]) || "—";
    var displayName = registerDisplayName(record);
    if (title) title.textContent = displayName;
    if (location) location.textContent = record.location;
    if (reference) reference.textContent = refVal;
    if (status) status.innerHTML = statusPillHtml(record.status);
    if (received) received.textContent = formattedDate;
    if (toggle) toggle.setAttribute("aria-label", "Toggle details for " + displayName);
  }

  function patchRegisterSelection(recordId) {
    if (typeof document === "undefined") return;
    Array.prototype.forEach.call(document.querySelectorAll("tr.program-register-summary-row[data-register-record]"), function (row) {
      var selected = row.getAttribute("data-register-record") === recordId;
      row.classList.toggle("is-selected", selected);
      row.setAttribute("aria-selected", String(selected));
    });
  }

  function localEditRequiresRender(key) {
    var normalized = text(key).toLowerCase();
    if (text(state.filters.query)) return true;
    if ((state.filters.statuses || []).length && normalized === "status") return true;
    if (state.sort === "name" && /^(applicantname|name|title)$/.test(normalized)) return true;
    if (state.sort === "priority" && normalized === "priority") return true;
    if (state.sort === "receipt" && /^(receipt|receiptnumber|jobid|job_id|jobnumber|eventnumber)$/.test(normalized)) return true;
    return state.sort === "date" && /^(date|datereceived|statusdate)$/.test(normalized);
  }

  var renderTableDebounceTimer = null;
  function scheduleRenderTable() {
    if (renderTableDebounceTimer) clearTimeout(renderTableDebounceTimer);
    renderTableDebounceTimer = setTimeout(function () {
      renderTableDebounceTimer = null;
      renderTable();
    }, 60);
  }

  var virtualScrollCleanup = null;


  function renderTable() {
  /* A direct redraw supersedes the deferred list redraw.  Leaving that timer
   * alive rebuilds the table after its disclosure has been opened, which
   * closes a newly added Register's drawer before its actions can be used. */
  if (renderTableDebounceTimer) {
   clearTimeout(renderTableDebounceTimer);
   renderTableDebounceTimer = null;
  }
    var tbody = one("[data-register-table-body]"); if (!tbody) return;
    var tableScroller = tbody.closest(".program-table-wrap");
  var preserveTableScroll = Boolean(tableScroller && (document.body.hasAttribute("data-register-drawer-open") || Array.prototype.some.call(tbody.querySelectorAll(".program-register-drawer-row"), function (drawerRow) { return !drawerRow.hidden; })));
    var priorTableScrollTop = preserveTableScroll ? tableScroller.scrollTop : 0;
    var priorTableScrollLeft = preserveTableScroll ? tableScroller.scrollLeft : 0;
    /* Preserve the shared measured floor while Register rows are rebuilt. */
    var priorDrawerFloors = Object.create(null);
    tbody.querySelectorAll("[data-register-drawer-record].has-viewport-floor").forEach(function (existingDrawer) {
      var existingId = existingDrawer.getAttribute("data-register-drawer-record");
      var existingMax = existingDrawer.style.getPropertyValue("--program-drawer-max-height");
      if (existingId && existingMax) priorDrawerFloors[existingId] = existingMax;
    });

    var refHeaderNode = document.querySelector('[data-register-sort-label="receipt"]');
    if (refHeaderNode) {
      if (state.filters.ownership === "EVT") {
        refHeaderNode.textContent = "Event Number";
      } else if (state.filters.ownership === "NSA") {
        refHeaderNode.textContent = "Receipt";
      } else {
        refHeaderNode.textContent = "Ref / Receipt";
      }
    }
    document.querySelectorAll("[data-register-sort-header]").forEach(function (header) {
      var key = header.getAttribute("data-register-sort-header");
      var active = state.sort === key;
      header.setAttribute("aria-sort", active ? (state.sortDirection === "desc" ? "descending" : "ascending") : "none");
      var icon = header.querySelector(".program-register-table__sort-icon");
      if (icon) icon.textContent = active ? (state.sortDirection === "desc" ? "↓" : "↑") : "↕";
    });

    if (!state.filtered.length) {
      if (virtualScrollCleanup) { virtualScrollCleanup(); virtualScrollCleanup = null; }
      clear(tbody);
      var emptyRow = document.createElement("tr");
      emptyRow.innerHTML = '<td colspan="9" class="program-map-empty">No applications or events match current filters.</td>';
      tbody.appendChild(emptyRow);
      return;
    }

    if (virtualScrollCleanup) { virtualScrollCleanup(); virtualScrollCleanup = null; }
    clear(tbody);
    var fragment = document.createDocumentFragment();
    var disclosureApi = window.UOS && window.UOS.ProgramDisclosureRows;

    state.filtered.forEach(function (record) {
      var key = "register:" + record.id;
      var drawerId = "register-drawer-" + record.id.replace(/[^a-zA-Z0-9_-]+/g, "-");
      var summaryRow = document.createElement("tr");
      summaryRow.className = "program-register-summary-row" + (record.id === state.selectedId ? " is-selected" : "");
      summaryRow.setAttribute("data-register-record", record.id);
      summaryRow.setAttribute("data-owner", record.owner || (state.filters.ownership === "EVT" ? "EVT" : "NSA"));
      summaryRow.setAttribute("data-disclosure-row", "");
      summaryRow.setAttribute("data-disclosure-click-row", "");
      summaryRow.setAttribute("data-disclosure-key", key);
      summaryRow.setAttribute("data-disclosure-scope", "register");
      summaryRow.setAttribute("aria-selected", String(record.id === state.selectedId));

      var formattedDate = (window.UOS && window.UOS.imports && window.UOS.imports.formatDate) ? window.UOS.imports.formatDate(record.date) : (record.date || "—");
      var refVal = record.owner === "EVT"
        ? record.jobId || first(record.raw, ["jobId", "job_id", "jobNumber", "job_number", "job", "eventNumber"]) || "—"
        : record.receipt || first(record.raw, ["receipt", "receiptNumber"]) || "—";

      var displayName = registerDisplayName(record);
      var linkedProject = buildLinkedProject(state.workspace, record);
      var projectState = linkedProject ? "Created" : "Not Created";
      summaryRow.innerHTML = '<td class="program-register-table__toggle-cell">' +
        '<button type="button" class="program-register-row-toggle" data-disclosure-toggle data-disclosure-key="' + esc(key) + '" data-disclosure-scope="register" aria-controls="' + esc(drawerId) + '" aria-label="Toggle details for ' + esc(displayName) + '">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>' +
          '</button>' +
        '</td>' +
      '<td class="program-register-table__title-cell"><strong>' + esc(displayName) + '</strong><span>' + esc(record.id) + '</span></td>' +
      '<td class="program-register-table__location-cell">' + esc(record.location) + '</td>' +
      '<td class="program-register-table__status-cell">' + statusPillHtml(record.status) + '</td>' +
      '<td class="program-register-table__received-cell">' + esc(formattedDate) + '</td>' +
      '<td class="program-register-table__reference-cell">' + esc(refVal) + '</td>' +
      '<td class="program-register-table__project-cell"><span class="program-register-project-state ' + (linkedProject ? 'is-created' : 'is-not-created') + '">' + projectState + '</span></td>' +
      '<td class="program-register-table__budget-cell">' + esc(budgetAmountLabel(record)) + '</td>' +
        '<td class="program-register-table__actions-cell">' + buildMiniToolbarHtml(record.id, record) + '</td>';

      var drawerRow = document.createElement("tr");
      drawerRow.className = "program-register-drawer-row";
      /* The Register floor is drawn by the table cell, so give that ancestor
         the canonical owner rather than asking it to inherit from its child. */
      drawerRow.setAttribute("data-owner", record.owner === "EVT" ? "EVT" : "NSA");
      drawerRow.id = drawerId;
      drawerRow.setAttribute("data-disclosure-drawer", "");
      drawerRow.setAttribute("data-disclosure-key", key);
      drawerRow.setAttribute("data-disclosure-scope", "register");
      drawerRow.setAttribute("data-disclosure-motion", "register");
      drawerRow.setAttribute("aria-hidden", "true");
      drawerRow.hidden = true;

      var drawerCell = document.createElement("td");
      drawerCell.colSpan = 9;
      var drawerHost = document.createElement("div");
      drawerHost.className = "program-register-drawer";
      drawerHost.setAttribute("data-register-drawer-record", record.id);
      if (priorDrawerFloors[record.id]) {
        drawerHost.classList.add("has-viewport-floor");
        drawerHost.style.setProperty("--program-drawer-max-height", priorDrawerFloors[record.id]);
      }
      drawerHost.setAttribute("role", "region");
      drawerHost.setAttribute("aria-label", displayName + " details");
      drawerHost.innerHTML = '<div class="program-register-detail__layout" data-register-detail-content>' +
          '<div class="program-register-drawer__columns">' +
            '<div class="program-register-drawer__column program-register-drawer__column--primary" data-register-detail-primary></div>' +
            '<div class="program-register-drawer__column program-register-drawer__column--status-stack">' +
              '<div data-register-detail-status></div>' +
              '<section class="program-register-section program-register-section--history program-register-status-history" data-register-status-history-panel>' +
                '<h4 class="program-register-section-title program-register-history-title">Status History</h4>' +
                '<div class="program-register-history-list" data-register-status-history-list><p class="program-register-history-empty">No status history recorded yet.</p></div>' +
              '</section>' +
            '</div>' +
            '<div class="program-register-drawer__column program-register-drawer__column--quotes" data-register-detail-quotes></div>' +
          '</div>' +
        '</div>' +
        '<div class="program-register-module-host" data-register-module-host hidden></div>';
      drawerCell.appendChild(drawerHost);
      drawerRow.appendChild(drawerCell);

      fragment.appendChild(summaryRow);
      fragment.appendChild(drawerRow);
      if (disclosureApi && disclosureApi.isOpen(key)) renderDetail(record, drawerHost);
    });

  tbody.appendChild(fragment);
  if (preserveTableScroll) {
    tableScroller.scrollTop = priorTableScrollTop;
    tableScroller.scrollLeft = priorTableScrollLeft;
  }
    if (disclosureApi) disclosureApi.sync();
    var drawerWorkspace = window.UOS && window.UOS.ProgramDrawerWorkspace;
    if (drawerWorkspace && typeof drawerWorkspace.requestSync === "function") {
      drawerWorkspace.requestSync(state.workspace);
    }
  }

  function renderRegisterStatusFilterPills() {
    var container = one("#registerStatusFilterPills");
    if (!container) return;

    var isApps = state.filters.ownership === "NSA";
    var isEvts = state.filters.ownership === "EVT";
    var possibleStatuses = isApps ? NSA_STATUSES.slice() : (isEvts ? REMEDIATION_STATUSES.slice() : NSA_STATUSES.concat(REMEDIATION_STATUSES.filter(function (s) { return NSA_STATUSES.indexOf(s) < 0; })));

    state.filters.statuses = Array.isArray(state.filters.statuses) ? state.filters.statuses : [];

    var pillsHtml = possibleStatuses.map(function (statusVal) {
      var slug = statusVal.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      var isActive = state.filters.statuses.some(function (st) { return text(st).toLowerCase() === statusVal.toLowerCase(); });

      var count = state.records.filter(function (rec) {
        if (state.filters.ownership !== "all" && rec.owner !== state.filters.ownership) return false;
        if (state.filters.crew !== "all" && rec.crew !== state.filters.crew) return false;
        var normStatus = normalizeStatus(rec.status, rec.owner);
        return normStatus.toLowerCase() === statusVal.toLowerCase();
      }).length;

      return '<button type="button" class="program-status-pill-filter status--' + esc(slug) + (isActive ? ' is-active' : '') + '" data-register-status-filter="' + esc(statusVal) + '" aria-pressed="' + String(isActive) + '">' +
        '<span>' + esc(statusVal) + '</span>' +
        '<span class="program-status-pill-count">' + count + '</span>' +
      '</button>';
    }).join("");

    container.innerHTML = pillsHtml;
    var badge = document.querySelector('[data-filter-drawer-badge="register"]');
    if (badge) {
      var actCount = (state.filters.statuses || []).length + (text(state.filters.query) ? 1 : 0);
      badge.textContent = String(actCount);
      badge.hidden = (actCount === 0);
    }
  }

  function renderList() {
    renderRegisterStatusFilterPills();
    state.filtered = selectRecords(state.records, state);
    var list = one("[data-register-list]");
    if (list) {
      clear(list);
      state.filtered.forEach(function (record, index) {
        var card = document.createElement("div");
        card.className = "program-register-row" + (record.id === state.selectedId ? " is-selected" : "");
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", index === state.focusedIndex ? "0" : "-1");
        card.setAttribute("data-register-record", record.id);
        card.setAttribute("aria-selected", String(record.id === state.selectedId));

        var top = document.createElement("span"); top.className = "program-register-row__top";
        top.appendChild(badge(record));
        var status = document.createElement("span"); status.className = "program-register-row__status"; status.textContent = record.status; top.appendChild(status);

        var titleNode = document.createElement("strong");
        titleNode.className = "program-register-row__title";
        titleNode.textContent = registerDisplayName(record);

        var linkedProj = buildLinkedProject(state.workspace, record);
        var projId = record.projectId || (linkedProj ? linkedProj.id : "");
        var regIdMeta = document.createElement("span"); regIdMeta.className = "program-register-row__meta"; regIdMeta.style.fontWeight = "700"; regIdMeta.style.color = "#334155";
        regIdMeta.textContent = "Register ID: " + record.id;

        var projIdMeta = null;
        if (projId) {
          projIdMeta = document.createElement("span"); projIdMeta.className = "program-register-row__meta"; projIdMeta.style.fontWeight = "700"; projIdMeta.style.color = "#334155";
          projIdMeta.textContent = "Project ID: " + projId;
        }

        var compactDate = window.UOS && window.UOS.imports && window.UOS.imports.formatDate;
        var meta = document.createElement("span"); meta.className = "program-register-row__meta"; meta.textContent = compactDate ? compactDate(record.date) : (record.date || "No date");

        var actionsRow = document.createElement("div");
        actionsRow.className = "program-register-row__actions";
        actionsRow.style.display = "flex";
        actionsRow.style.alignItems = "center";
        actionsRow.style.justifyContent = "flex-end";
        actionsRow.style.marginTop = "6px";

        var delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "uos-button uos-button--secondary uos-button--sm program-register-delete-btn";
        delBtn.setAttribute("data-register-delete-id", record.id);
        delBtn.title = "Delete record " + record.id;
        delBtn.setAttribute("aria-label", "Delete record " + record.id);
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span style="font-size:11px;margin-left:4px;">Delete</span>';

        actionsRow.appendChild(delBtn);

        card.appendChild(top); card.appendChild(titleNode); card.appendChild(regIdMeta);
        if (projIdMeta) card.appendChild(projIdMeta);
        card.appendChild(meta);
        card.appendChild(actionsRow);
        list.appendChild(card);
      });
      setText("[data-register-result-count]", state.filtered.length + (state.filtered.length === 1 ? " record" : " records"));
      var empty = one("[data-register-empty]"); if (empty) empty.hidden = state.filtered.length !== 0;
      list.hidden = state.filtered.length === 0;
      list.scrollTop = state.scrollTop;
    }
    renderTable();
  }
  function appendEditableField(list, label, keyName, value, record, type) {
    var row = document.createElement("div"), term = document.createElement("dt"), detail = document.createElement("dd");
    term.textContent = label;
    var inputNode;
    var currentVal = value == null ? "" : String(value);

    var globalRoot = root || (typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : {}));
    var priv = globalRoot.UOS && globalRoot.UOS.ProgramPrivacy;
    var isSensitive = priv && priv.isSensitiveApplicantContactField(keyName, label);
    if (isSensitive && priv.isEnabled()) {
      inputNode = document.createElement("input");
      inputNode.className = "uos-input uos-input--sm";
      if (typeof priv.applyToInput === "function") {
        priv.applyToInput(inputNode, currentVal, keyName || label, {
          type: "text",
          maskedTitle: "Privacy Mode active - Disable Privacy Mode in header to view or edit applicant contact details."
        });
      } else {
        inputNode.type = "text";
        inputNode.value = priv.MASK;
        inputNode.readOnly = true;
        inputNode.classList.add("is-privacy-masked");
      }
      inputNode.setAttribute("aria-label", label + " masked by Privacy Mode");
      detail.appendChild(inputNode);
      detail.title = "Privacy Mode active  -  Disable Privacy Mode in header to view or edit applicant contact details.";
      row.appendChild(term);
      row.appendChild(detail);
      list.appendChild(row);
      return;
    }

    if (type === "readonly" || type === "text-readonly") {
      detail.textContent = currentVal;
      detail.className = "program-register-readonly-value";
      row.appendChild(term);
      row.appendChild(detail);
      list.appendChild(row);
      return;
    }

    if (type === "select-status") {
      inputNode = document.createElement("select");
      inputNode.className = "uos-select uos-select--sm";
      var statuses = getAuthoritativeStatuses(record ? record.owner : "NSA");
      var normCurrent = normalizeStatus(currentVal, record ? record.owner : "NSA");
      statuses.forEach(function (st) {
        var opt = document.createElement("option"); opt.value = st; opt.textContent = st;
        if (st.toLowerCase() === normCurrent.toLowerCase()) opt.selected = true;
        inputNode.appendChild(opt);
      });
    } else if (type === "select-priority") {
      inputNode = document.createElement("select");
      inputNode.className = "uos-select uos-select--sm";
      var priorities = ["Low", "Normal", "High", "Urgent"];
      if (currentVal && priorities.indexOf(currentVal) < 0) priorities.push(currentVal);
      priorities.forEach(function (pr) {
        var opt = document.createElement("option"); opt.value = pr; opt.textContent = pr;
        if (pr === currentVal) opt.selected = true;
        inputNode.appendChild(opt);
      });
    } else if (type === "select-crew") {
      inputNode = document.createElement("select");
      inputNode.className = "uos-select uos-select--sm";
      var crews = ["Unassigned", "North Crew", "South Crew", "East Crew", "West Crew", "Central Crew"];
      if (currentVal && crews.indexOf(currentVal) < 0) crews.push(currentVal);
      crews.forEach(function (cr) {
        var opt = document.createElement("option"); opt.value = cr; opt.textContent = cr;
        if (cr === currentVal) opt.selected = true;
        inputNode.appendChild(opt);
      });
    } else if (type === "select-financial-year") {
      inputNode = document.createElement("select");
      inputNode.className = "uos-select uos-select--sm";
      var fyOpts = getFinancialYearOptions();
      var foundCurrent = false;
      fyOpts.forEach(function (opt) {
        var optionEl = document.createElement("option");
        optionEl.value = opt.value;
        optionEl.textContent = opt.label;
        if (opt.value === currentVal || opt.label === currentVal) {
          optionEl.selected = true;
          foundCurrent = true;
        }
        inputNode.appendChild(optionEl);
      });
      if (currentVal && !foundCurrent) {
        var customOpt = document.createElement("option");
        customOpt.value = currentVal;
        customOpt.textContent = currentVal;
        customOpt.selected = true;
        inputNode.appendChild(customOpt);
      }
    } else if (type === "date") {
      inputNode = document.createElement("input");
      inputNode.type = "date";
      inputNode.className = "uos-input uos-input--sm";
      var isoDate = currentVal;
      if (currentVal) {
        var match = currentVal.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) {
          isoDate = match[1];
        } else {
          var parsed = new Date(currentVal);
          if (!isNaN(parsed.getTime())) {
            isoDate = parsed.toISOString().slice(0, 10);
          }
        }
      }
      inputNode.value = isoDate;
    } else if (keyName === "area" || type === "area-with-unit") {
      var wrapper = document.createElement("div");
      wrapper.className = "program-register-area-wrap";
      wrapper.style.display = "flex";
      wrapper.style.gap = "6px";
      wrapper.style.alignItems = "center";
      wrapper.style.width = "100%";

      var strVal = String(currentVal || "");
      var numPart = strVal.replace(/[^0-9\.]/g, "").trim();
      var matchedUnit = strVal.match(/ha|m²|m2|km²|km2|acres|acre|sq\s*ft/i);
      var currentUnit = matchedUnit ? matchedUnit[0].toLowerCase() : "ha";
      if (currentUnit === "m2") currentUnit = "m²";
      if (currentUnit === "km2") currentUnit = "km²";

      var numInput = document.createElement("input");
      numInput.type = "text";
      numInput.className = "uos-input uos-input--sm";
      numInput.value = numPart || (strVal !== "—" ? strVal : "");
      numInput.placeholder = "0";
      numInput.style.flex = "1";
      numInput.style.minWidth = "0";
      numInput.setAttribute("data-register-edit-key", "area");
      numInput.setAttribute("data-register-edit-id", record.id);

      var unitSelect = document.createElement("select");
      unitSelect.className = "uos-select uos-select--sm";
      unitSelect.style.width = "auto";
      unitSelect.style.minWidth = "75px";
      unitSelect.style.flexShrink = "0";
      unitSelect.setAttribute("data-register-edit-key", "areaUnit");
      unitSelect.setAttribute("data-register-edit-id", record.id);
      unitSelect.setAttribute("aria-label", "Area unit");

      var units = [
        { label: "ha", value: "ha" },
        { label: "m²", value: "m²" },
        { label: "km²", value: "km²" },
        { label: "acres", value: "acres" },
        { label: "sq ft", value: "sq ft" }
      ];

      units.forEach(function (u) {
        var opt = document.createElement("option");
        opt.value = u.value;
        opt.textContent = u.label;
        if (u.value.toLowerCase() === currentUnit.toLowerCase()) opt.selected = true;
        unitSelect.appendChild(opt);
      });

      wrapper.appendChild(numInput);
      wrapper.appendChild(unitSelect);
      detail.appendChild(wrapper);
      row.appendChild(term);
      row.appendChild(detail);
      list.appendChild(row);
      return;
    } else if (type === "pill-slider" || type === "boolean-pill") {
      var isYes = Boolean(value && value !== "false" && value !== "0" && value !== "no" && value !== "undefined");

      var sliderWrap = document.createElement("div");
      sliderWrap.className = "program-register-pill-slider";

      var btnNo = document.createElement("button");
      btnNo.type = "button";
      btnNo.className = "program-register-pill-btn" + (!isYes ? " is-active" : "");
      btnNo.setAttribute("aria-pressed", String(!isYes));
      btnNo.setAttribute("data-register-edit-key", keyName);
      btnNo.setAttribute("data-register-edit-id", record.id);
      btnNo.setAttribute("data-register-value", "false");
      btnNo.textContent = "No";

      var btnYes = document.createElement("button");
      btnYes.type = "button";
      btnYes.className = "program-register-pill-btn" + (isYes ? " is-active" : "");
      btnYes.setAttribute("aria-pressed", String(isYes));
      btnYes.setAttribute("data-register-edit-key", keyName);
      btnYes.setAttribute("data-register-edit-id", record.id);
      btnYes.setAttribute("data-register-value", "true");
      btnYes.textContent = "Yes";

      sliderWrap.appendChild(btnNo);
      sliderWrap.appendChild(btnYes);
      detail.appendChild(sliderWrap);
      row.appendChild(term);
      row.appendChild(detail);
      list.appendChild(row);
      return;
    } else if (type === "checkbox") {
      inputNode = document.createElement("input");
      inputNode.type = "checkbox";
      inputNode.className = "row-select";
      inputNode.checked = Boolean(value && value !== "false" && value !== "0" && value !== "undefined");
    } else if (type === "textarea" || (currentVal && currentVal.length > 50)) {
      inputNode = document.createElement("textarea");
      inputNode.className = "uos-textarea uos-textarea--sm";
      inputNode.rows = 4;
      inputNode.value = currentVal;
    } else {
      inputNode = document.createElement("input");
      inputNode.type = "text";
      inputNode.className = "uos-input uos-input--sm";
      inputNode.value = currentVal;
    }

    inputNode.setAttribute("data-register-edit-key", keyName);
    inputNode.setAttribute("data-register-edit-id", record.id);
    var isProtectedNumber = inputNode.tagName === "INPUT" && inputNode.type === "text" && (
      (record.owner === "NSA" && (keyName === "receipt" || keyName === "receiptNumber")) ||
      (record.owner === "EVT" && (keyName === "jobId" || keyName === "job_id" || keyName === "jobNumber" || keyName === "eventNumber"))
    );
    if (isProtectedNumber) {
      var protectedWrap = document.createElement("div");
      protectedWrap.className = "program-register-protected-edit";
      inputNode.readOnly = true;
      inputNode.setAttribute("aria-readonly", "true");
      inputNode.setAttribute("data-register-original-value", currentVal);
      inputNode.classList.add("is-edit-locked");

      var editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "program-register-protected-edit__button";
      editButton.setAttribute("data-register-unlock-edit", "");
      editButton.setAttribute("aria-label", "Edit " + label);
      editButton.textContent = "Edit";

      var saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "program-register-protected-edit__button program-register-protected-edit__button--save";
      saveButton.setAttribute("data-register-save-edit", "");
      saveButton.textContent = "Save";
      saveButton.hidden = true;

      var cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "program-register-protected-edit__button program-register-protected-edit__button--cancel";
      cancelButton.setAttribute("data-register-cancel-edit", "");
      cancelButton.textContent = "Cancel";
      cancelButton.hidden = true;

      protectedWrap.appendChild(inputNode);
      protectedWrap.appendChild(editButton);
      protectedWrap.appendChild(saveButton);
      protectedWrap.appendChild(cancelButton);
      detail.appendChild(protectedWrap);
    } else {
      detail.appendChild(inputNode);
    }
    row.appendChild(term);
    row.appendChild(detail);
    list.appendChild(row);
  }

  function appendField(list, label, value) {
    var row = document.createElement("div"), term = document.createElement("dt"), detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value == null ? "" : String(value);
    row.appendChild(term);
    row.appendChild(detail);
    list.appendChild(row);
  }
  function fieldLabel(value) {
    return text(value).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, function (letter) { return letter.toUpperCase(); });
  }
  function displayValue(value) {
    if (value == null || value === "") return "";
    if (typeof value === "object") {
      try { return JSON.stringify(value); } catch (error) { return ""; }
    }
    return String(value);
  }
  function fieldWeight(key) {
    var lower = text(key).toLowerCase();
    if (/eventname|^name$|^title$/.test(lower)) return 0.9;
    if (/location|address|site/.test(lower)) return 0.95;
    if (/applicant|customername|customer_name/.test(lower)) return 1.0;
    if (/email/.test(lower)) return 1.2;
    if (/phone|tel|mobile/.test(lower)) return 1.3;
    if (/^id$|recordid|applicationid|eventid/.test(lower)) return 1.31;
    if (/jobid|job_id|jobnumber|job_number|^job$/.test(lower)) return 1.32;
    if (/notes|description|comment|request|reason/.test(lower)) return 1.4;
    if (/application.*date|end.*date/.test(lower)) return 2.1;
    if (/financial.*year|fy|season/.test(lower)) return 2.2;
    if (/priority/.test(lower)) return 2.3;
    if (/crew/.test(lower)) return 2.4;
    if (/status/.test(lower)) return 3.0;
    return 2.5;
  }
  // ── Project-promotion helpers ────────────────────────────────────────────
  var ATTENTION_STATUSES = { NSA: ["Approved", "Scheduled"], EVT: ["Quoted", "In Progress"] };

  function buildLinkedProjects(workspace, record) {
    if (!record) return [];
    var model = typeof window !== "undefined" && window.UOS && window.UOS.ProgramModel;
    return model && typeof model.activeProjectsForRegister === "function"
      ? model.activeProjectsForRegister(workspace, record.id)
      : [];
  }

  function buildLinkedProject(workspace, record) {
    var projects = buildLinkedProjects(workspace, record);
    return projects.length === 1 ? projects[0] : null;
  }

  function isAttentionStatus(record) {
    var list = ATTENTION_STATUSES[record && record.owner] || [];
    return list.indexOf(record && record.status) >= 0;
  }

  function handleOpenProject(projectId) {
    if (!projectId) return;
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    if (!app || typeof app.updateWorkspace !== "function") return;
    /* Establish the new Register context before queuing the durable mutation.
       A pending table-state save must never restore a previously opened
       Project's Register while this new record is being committed. */
    state.selectedId = uid;
    state.mode = "detail";
    app.updateWorkspace(function (candidate) {
      candidate.workspace = candidate.workspace || {};
      candidate.workspace.selectedEntityId = projectId;
      candidate.workspace.selectedProjectId = projectId;
      candidate.workspace.planner = candidate.workspace.planner || {};
      candidate.workspace.planner.selectedProjectId = projectId;
      candidate.workspace.destination = "planner";
      return candidate;
    }).then(function () {
      if (app && typeof app.navigate === "function") {
        app.navigate("planner");
      }
    });
  }

  function handleCreateProject(record) {
    if (!record) return;
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    var model = typeof window !== "undefined" && window.UOS && window.UOS.ProgramModel;
    if (!model || typeof model.promoteRegisterRecord !== "function") return;
    if (!app || typeof app.updateWorkspace !== "function") return;
    app.updateWorkspace(function (candidate) {
      var result = model.promoteRegisterRecord(candidate, record.id);
      var next = result.workspace;
      next.workspace = next.workspace || {};
    /* Drawer routing is Register-scoped. Keep its originating Register as the
       active entity; the Delivery Project remains the active Project context. */
    next.workspace.selectedEntityId = record.id;
    next.workspace.selectedProjectId = result.project.id;
    next.workspace.planner = next.workspace.planner || {};
    next.workspace.planner.selectedProjectId = result.project.id;
    next.workspace.destination = "planner";
      return next;
    }).then(function () {
      if (app && typeof app.navigate === "function") {
        app.navigate("planner");
      }
    });
  }

  function closeDeleteDialog() {
    var dialog = one("#deleteRegisterDialog");
    state.pendingDeleteId = null;
    if (dialog && dialog.open && typeof dialog.close === "function") dialog.close();
    if (state.deleteTrigger && typeof state.deleteTrigger.focus === "function") state.deleteTrigger.focus();
    state.deleteTrigger = null;
  }

  function deleteRegisterRecord(recordId, trigger) {
    var model = typeof window !== "undefined" && window.UOS && window.UOS.ProgramModel;
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    if (!model || typeof model.registerDeletionImpact !== "function" || !app || typeof app.workspace !== "function") return;
    var impact;
    try { impact = model.registerDeletionImpact(app.workspace(), recordId); }
    catch (error) { if (window.UOS.toast) window.UOS.toast(error.message, "error"); return; }
    state.pendingDeleteId = recordId;
    state.deleteTrigger = trigger || null;
    var deleteName = impact.record.title || impact.record.name || impact.record.eventName || impact.record.address || impact.record.id;
    setText("[data-register-delete-name]", registerDisplayName({ name: deleteName, raw: impact.record }));
    var list = one("[data-register-delete-impact]");
    var labels = { projects: "Delivery Projects", jobs: "Jobs", tasks: "Tasks", costingLines: "Costing Lines", geometries: "Geometry records", quotes: "Quotes", quoteLines: "Quote Lines", statusEvents: "Status audit entries", statusRecommendations: "Status recommendations" };
    var related = 0;
    clear(list);
    Object.keys(labels).forEach(function (name) {
      var count = Number(impact.counts[name]) || 0;
      if (!count || !list) return;
      related += count;
      var item = document.createElement("li");
      item.textContent = labels[name] + ": " + count;
      list.appendChild(item);
    });
    if (list) list.hidden = related === 0;
    var none = one("[data-register-delete-no-dependencies]");
    if (none) none.hidden = related !== 0;
    var dialog = one("#deleteRegisterDialog");
    if (dialog && typeof dialog.showModal === "function") dialog.showModal();
  }

  function confirmDeleteRegisterRecord() {
    var recordId = state.pendingDeleteId;
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    var model = typeof window !== "undefined" && window.UOS && window.UOS.ProgramModel;
    if (!recordId || !app || !model || typeof model.deleteRegisterRecord !== "function") return;
    var impact = null;
    app.updateWorkspace(function (candidate) {
    var result = model.deleteRegisterRecord(candidate, recordId, { confirmed: true });
      impact = result.impact;
      return result.workspace;
    }).then(function (saved) {
      if (!saved) return;
      state.pendingDeleteId = null;
      var dialog = one("#deleteRegisterDialog");
      if (dialog && dialog.open && typeof dialog.close === "function") dialog.close();
      state.deleteTrigger = null;
      var related = impact ? Object.keys(impact.counts).reduce(function (sum, name) { return name === "registerRecords" ? sum : sum + (Number(impact.counts[name]) || 0); }, 0) : 0;
      if (window.UOS.toast) window.UOS.toast("Register record deleted with " + related + " related record" + (related === 1 ? "" : "s") + ".", "success");
    });
  }

  function getInspectorScrollContainer(scope) {
    if (scope && scope.querySelector) {
      return scope.querySelector(".program-register-detail__body") || scope;
    }
    return document.querySelector(".program-register-detail__body") ||
           document.querySelector(".program-scroll-region") ||
           document.querySelector(".program-register-pane") ||
           document.querySelector("[data-register-detail]");
  }

  function captureInspectorState(scope) {
    var container = getInspectorScrollContainer(scope);
    var scrollTop = container ? container.scrollTop : 0;
    var active = document.activeElement;
    var activeInfo = null;

    if (active && container && container.contains(active)) {
      activeInfo = {
        key: active.getAttribute("data-register-edit-key"),
        val: active.getAttribute("data-register-value"),
        action: active.getAttribute("data-register-action"),
        forId: active.getAttribute("data-register-for"),
        id: active.id,
        tagName: active.tagName,
        selectionStart: typeof active.selectionStart === "number" ? active.selectionStart : null,
        selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null
      };
    }
    return { scrollTop: scrollTop, activeInfo: activeInfo };
  }

  function restoreInspectorState(savedState, scope) {
    if (!savedState) return;
    var container = getInspectorScrollContainer(scope);
    if (container) {
      container.scrollTop = savedState.scrollTop;
    }

    var activeInfo = savedState.activeInfo;
    if (activeInfo && container) {
      var targetEl = null;
      if (activeInfo.key) {
        var sel = '[data-register-edit-key="' + esc(activeInfo.key) + '"]';
        if (activeInfo.val != null) {
          sel += '[data-register-value="' + esc(activeInfo.val) + '"]';
        }
        targetEl = container.querySelector(sel);
      } else if (activeInfo.action) {
        var selAction = '[data-register-action="' + esc(activeInfo.action) + '"]';
        if (activeInfo.forId) {
          selAction += '[data-register-for="' + esc(activeInfo.forId) + '"]';
        }
        targetEl = container.querySelector(selAction);
      } else if (activeInfo.id) {
        targetEl = document.getElementById(activeInfo.id);
      }

      if (targetEl && typeof targetEl.focus === "function") {
        try {
          targetEl.focus({ preventScroll: true });
          if (activeInfo.selectionStart !== null && typeof targetEl.setSelectionRange === "function") {
            targetEl.setSelectionRange(activeInfo.selectionStart, activeInfo.selectionEnd);
          }
        } catch (e) {}
      }

      if (container) {
        container.scrollTop = savedState.scrollTop;
      }
    }
  }

  function renderNsaDrawer(record, renderScope, entries) {
    var content = one("[data-register-detail-content]", renderScope);
    if (!content) return;
    clear(content);
    content.className = "program-register-detail__layout program-register-nsa-detail";
    var renderAnchors = document.createElement("div");
    renderAnchors.hidden = true;
    renderAnchors.innerHTML = '<div data-register-detail-primary></div><div data-register-detail-status></div><div data-register-detail-quotes></div>';
    content.appendChild(renderAnchors);

    var used = Object.create(null);
    function entryFor(key) { return entries.find(function (entry) { return text(entry.key).toLowerCase() === key.toLowerCase(); }); }
    function fieldInto(list, key) { var entry = entryFor(key); if (!entry || used[entry.key]) return; used[entry.key] = true; appendEditableField(list, entry.label, entry.key, entry.value, record, entry.type); }
    function section(title, className, hook) { var node = document.createElement("section"); node.className = "program-register-nsa-section " + className; if (hook) node.setAttribute(hook, ""); node.innerHTML = '<h4 class="program-register-nsa-section__title">' + esc(title) + '</h4>'; var list = document.createElement("dl"); node.appendChild(list); return { node: node, list: list }; }

    var summary = document.createElement("section");
    summary.className = "program-register-nsa-summary program-register-nsa-main-grid";
    summary.setAttribute("data-register-nsa-summary", "");
    summary.setAttribute("data-register-nsa-body", "");
    var intakeGroup = document.createElement("div");
    intakeGroup.className = "program-register-nsa-summary-group program-register-nsa-summary-group--intake";
    intakeGroup.innerHTML = '<h4 class="program-register-nsa-summary__title">Application</h4>';
    var intakeList = document.createElement("dl");
    intakeGroup.appendChild(intakeList);
    summary.appendChild(intakeGroup);
    ["dateReceived", "receipt", "address", "customerName", "customerEmail", "customerPhone"].forEach(function (key) { fieldInto(intakeList, key); });
    entries.forEach(function (entry) {
      var key = text(entry.key).toLowerCase();
      if (!used[entry.key] && /notes?|comments?/.test(key)) {
        used[entry.key] = true;
        appendEditableField(intakeList, "Notes", entry.key, entry.value, record, entry.type);
        if (intakeList.lastElementChild) intakeList.lastElementChild.setAttribute("data-register-nsa-notes", "");
      }
    });

    var linkedProjects = buildLinkedProjects(state.workspace, record), linkedProject = linkedProjects.length === 1 ? linkedProjects[0] : null;
    var projectFact = document.createElement("div");
    projectFact.className = "program-register-nsa-project-fact";
    projectFact.setAttribute("data-register-linked-project", linkedProject ? linkedProject.id : "");
    if (linkedProject) projectFact.innerHTML = '<span>Linked Project</span><button type="button" class="uos-button uos-button--secondary uos-button--sm" data-register-action="open-project" data-register-project-id="' + esc(linkedProject.id) + '">Show Project Plan</button>';
    else if (linkedProjects.length > 1) projectFact.innerHTML = '<span role="alert">Project relationship conflict — review Data Health</span>';
    else projectFact.innerHTML = '<span>No Linked Project</span><button type="button" class="uos-button uos-button--secondary uos-button--sm" data-register-action="create-project" data-register-for="' + esc(record.id) + '" data-register-owner="NSA">Create Delivery Project</button>';
    var deliveryGroup = document.createElement("div");
    deliveryGroup.className = "program-register-nsa-summary-group program-register-nsa-summary-group--project";
    var financialYearEntry = entryFor("financialYear");
    var deliveryFinancialYear = getFinancialYearForDate(first(record.raw, ["dateReceived", "receivedDate", "date", "createdAt"]) || record.date);
    if (financialYearEntry) used[financialYearEntry.key] = true;
    deliveryGroup.insertAdjacentHTML("afterbegin", '<h4 class="program-register-nsa-summary__title program-register-nsa-summary__title--project">Delivery Project <span class="program-register-fy-pill">' + esc(deliveryFinancialYear) + '</span></h4>');
    deliveryGroup.appendChild(projectFact);
    var summaryTrailingList = document.createElement("dl");
    deliveryGroup.appendChild(summaryTrailingList);
    var carryForwardEntry = entryFor("carryForward");
    if (carryForwardEntry && !used[carryForwardEntry.key]) {
      used[carryForwardEntry.key] = true;
      appendEditableField(summaryTrailingList, "Carry forward from previous FY", carryForwardEntry.key, carryForwardEntry.value, record, carryForwardEntry.type);
    }
    summary.appendChild(deliveryGroup);

    var scope = section("Customer Information", "program-register-nsa-section--scope");
    var scopeHeading = scope.node.querySelector(".program-register-nsa-section__title");
    if (scopeHeading) scopeHeading.remove();
    ["sketchOrDiagram", "scope"].forEach(function (key) { fieldInto(scope.list, key); });
    deliveryGroup.appendChild(scope.node);
    var delivery = section("Delivery Details", "program-register-nsa-section--delivery");
    ["actionedBy", "commencementDate", "completionDate", "deliveryDetails", "completionDetails"].forEach(function (key) { fieldInto(delivery.list, key); });

    var timeline = document.createElement("section");
    timeline.className = "program-register-nsa-section program-register-nsa-section--timeline program-register-status-history";
    timeline.setAttribute("data-register-status-history-panel", "");
    timeline.innerHTML = '<div class="program-register-nsa-section__heading"><h4 class="program-register-nsa-section__title">Status History</h4></div>';
    var statusLayout = document.createElement("div");
    statusLayout.className = "program-register-status-layout";
        var historyList = document.createElement("div");
    historyList.className = "program-register-history-list";
    historyList.setAttribute("data-register-status-history-list", "");
    historyList.innerHTML = '<p class="program-register-history-empty">No status history recorded yet.</p>';
        statusLayout.appendChild(historyList);
    timeline.appendChild(statusLayout);

    var actions = document.createElement("aside");
    actions.className = "program-register-nsa-actions";
    actions.setAttribute("data-register-nsa-actions", "");
    actions.innerHTML = '<h4 class="program-register-nsa-section__title">Application Actions</h4>' +
      '<button type="button" class="register-cta-btn" data-register-action="costing" data-register-record="' + esc(record.id) + '"' + (!linkedProject ? ' disabled aria-disabled="true"' : '') + '>Go to Cost Calculator <span aria-hidden="true">→</span></button>' +
      '<button type="button" class="register-cta-btn" data-register-action="quotes" data-register-record="' + esc(record.id) + '"' + (!linkedProject ? ' disabled aria-disabled="true"' : '') + '>Open in Quote Builder <span aria-hidden="true">→</span></button>';
    var linkedIds = linkedProjects.map(function (project) { return project.id; });
    var relatedQuotes = state.workspace && state.workspace.entities && Array.isArray(state.workspace.entities.quotes) ? state.workspace.entities.quotes.filter(function (quote) { return linkedIds.indexOf(quote.projectId) >= 0; }) : [];
    var quoteSummary = document.createElement("p");
    quoteSummary.className = "program-register-section-empty";
    quoteSummary.textContent = relatedQuotes.length ? relatedQuotes.length + (relatedQuotes.length === 1 ? " quote revision recorded." : " quote revisions recorded.") : "No quote revisions recorded.";
    actions.appendChild(quoteSummary);

    summary.appendChild(delivery.node); summary.appendChild(timeline);
    content.appendChild(summary);

    renderStatusHistory(record, renderScope);
  }

  function renderEventDrawer(record, renderScope, entries) {
    var content = one("[data-register-detail-content]", renderScope);
    if (!content) return;
    clear(content);
    content.className = "program-register-detail__layout program-register-nsa-detail program-register-event-detail";
    var renderAnchors = document.createElement("div");
    renderAnchors.hidden = true;
    renderAnchors.innerHTML = '<div data-register-detail-primary></div><div data-register-detail-status></div><div data-register-detail-quotes></div>';
    content.appendChild(renderAnchors);

    var used = Object.create(null);
    function entryFor(key) { return entries.find(function (entry) { return text(entry.key).toLowerCase() === key.toLowerCase(); }); }
    function fieldInto(list, key, label) {
      var entry = entryFor(key);
      if (!entry || used[entry.key]) return;
      used[entry.key] = true;
      appendEditableField(list, label || entry.label, entry.key, entry.value, record, entry.type);
    }
    function section(title, className) {
      var node = document.createElement("section");
      node.className = "program-register-nsa-section " + className;
      node.innerHTML = '<h4 class="program-register-nsa-section__title">' + esc(title) + '</h4>';
      var list = document.createElement("dl");
      node.appendChild(list);
      return { node: node, list: list };
    }

    var summary = document.createElement("section");
    summary.className = "program-register-nsa-summary program-register-nsa-main-grid program-register-event-main-grid";
    summary.setAttribute("data-register-event-summary", "");
    summary.setAttribute("data-register-event-body", "");

    var eventGroup = document.createElement("div");
    eventGroup.className = "program-register-nsa-summary-group program-register-nsa-summary-group--intake program-register-event-summary-group--event";
    eventGroup.innerHTML = '<h4 class="program-register-nsa-summary__title">Event</h4>';
    var eventList = document.createElement("dl");
    eventGroup.appendChild(eventList);
    ["name", "jobId", "id", "applicationDate", "address", "applicantName", "email", "phone"].forEach(function (key) { fieldInto(eventList, key); });
    fieldInto(eventList, "notes", "Notes");
    if (eventList.lastElementChild) eventList.lastElementChild.setAttribute("data-register-event-notes", "");
    summary.appendChild(eventGroup);

    var linkedProjects = buildLinkedProjects(state.workspace, record);
    var linkedProject = linkedProjects.length === 1 ? linkedProjects[0] : null;
    var projectFact = document.createElement("div");
    projectFact.className = "program-register-nsa-project-fact";
    projectFact.setAttribute("data-register-linked-project", linkedProject ? linkedProject.id : "");
    if (linkedProject) projectFact.innerHTML = '<span>Linked Project</span><button type="button" class="uos-button uos-button--secondary uos-button--sm" data-register-action="open-project" data-register-project-id="' + esc(linkedProject.id) + '">Show Project Plan</button>';
    else if (linkedProjects.length > 1) projectFact.innerHTML = '<span role="alert">Project relationship conflict — review Data Health</span>';
    else projectFact.innerHTML = '<span>No Linked Project</span><button type="button" class="uos-button uos-button--secondary uos-button--sm" data-register-action="create-project" data-register-for="' + esc(record.id) + '" data-register-owner="EVT">Create Delivery Project</button>';

    var projectGroup = document.createElement("div");
    projectGroup.className = "program-register-nsa-summary-group program-register-nsa-summary-group--project";
    var financialYearEntry = entryFor("financialYear");
    var deliveryFinancialYear = financialYearEntry && financialYearEntry.value || getFinancialYearForDate(first(record.raw, ["endDate", "applicationDate", "date", "eventDate", "startDate", "submittedDate"]) || record.date);
    if (financialYearEntry) used[financialYearEntry.key] = true;
    projectGroup.insertAdjacentHTML("afterbegin", '<h4 class="program-register-nsa-summary__title program-register-nsa-summary__title--project">Delivery Project <span class="program-register-fy-pill">' + esc(deliveryFinancialYear) + '</span></h4>');
    projectGroup.appendChild(projectFact);
    var projectList = document.createElement("dl");
    projectGroup.appendChild(projectList);
    fieldInto(projectList, "carryForward", "Carry forward from previous FY");
    var scope = section("Scope", "program-register-nsa-section--scope");
    var scopeHeading = scope.node.querySelector(".program-register-nsa-section__title");
    if (scopeHeading) scopeHeading.remove();
    fieldInto(scope.list, "sketchOrDiagram", "Site diagram");
    fieldInto(scope.list, "scope", "Scope");
    projectGroup.appendChild(scope.node);
    summary.appendChild(projectGroup);

    var delivery = section("Delivery Details", "program-register-nsa-section--delivery");
    ["actionedBy", "commencementDate", "completionDate", "deliveryDetails", "completionDetails"].forEach(function (key) { fieldInto(delivery.list, key); });
    summary.appendChild(delivery.node);

    var timeline = document.createElement("section");
    timeline.className = "program-register-nsa-section program-register-nsa-section--timeline program-register-status-history";
    timeline.setAttribute("data-register-status-history-panel", "");
    timeline.innerHTML = '<div class="program-register-nsa-section__heading"><h4 class="program-register-nsa-section__title">Status History</h4></div>';
    var statusLayout = document.createElement("div");
    statusLayout.className = "program-register-status-layout";
    var statusControls = document.createElement("div");
    statusControls.className = "program-register-status-controls";
    var statusList = document.createElement("dl");
    statusControls.appendChild(statusList);
        fieldInto(statusList, "priority");
    var historyList = document.createElement("div");
    historyList.className = "program-register-history-list";
    historyList.setAttribute("data-register-status-history-list", "");
    historyList.innerHTML = '<p class="program-register-history-empty">No status history recorded yet.</p>';
    statusLayout.appendChild(statusControls);
    statusLayout.appendChild(historyList);
    timeline.appendChild(statusLayout);
    summary.appendChild(timeline);

    content.appendChild(summary);
    renderStatusHistory(record, renderScope);
  }

  function renderRegisterBudgetRows(record, scope) {
    var projectGroup = one(".program-register-nsa-summary-group--project", scope);
    var projectFact = projectGroup && one(".program-register-nsa-project-fact", projectGroup);
    if (!projectGroup || !projectFact || !state.workspace || !state.workspace.entities) return;
    var api = window.UOS && window.UOS.ProgramBudget;
    var entities = state.workspace.entities;
    var budgetsById = Object.create(null);
    (entities.annualBudgets || []).forEach(function (budget) { budgetsById[budget.id] = budget; });
    var allocations = (entities.registerAllocations || []).filter(function (allocation) {
      var budget = budgetsById[allocation.budgetId];
      return allocation.registerId === record.id && budget && budget.owner === record.owner;
    }).sort(function (left, right) {
      return budgetsById[right.budgetId].financialYear.localeCompare(budgetsById[left.budgetId].financialYear)
        || text(left.id).localeCompare(text(right.id));
    });
    var now = new Date();
    var start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    var currentYear = start + "-" + String((start + 1) % 100).padStart(2, "0");
    var actionRow = document.createElement("div");
    actionRow.className = "program-register-nsa-project-fact program-register-budget-action-row";
    actionRow.setAttribute("data-register-budget-row", "action");
 actionRow.innerHTML = '<span>Budget</span><button type="button" class="uos-button uos-button--' + (allocations.length ? "primary" : "secondary") + ' uos-button--sm" data-register-action="allocate-budget" data-register-record="' + esc(record.id) + '">Allocate/Adjust</button>';
    projectFact.insertAdjacentElement("afterend", actionRow);
    var allocationTableRow = document.createElement("div");
    allocationTableRow.className = "program-register-nsa-project-fact program-register-budget-allocation-table-row";
    allocationTableRow.setAttribute("data-register-budget-row", "allocation-table");
      allocationTableRow.innerHTML = '<span>Council Operations Allocated</span><div class="program-register-allocation-table" data-register-allocation-table><div class="program-register-allocation-table__header" data-register-allocation-header><span>Financial Year</span><span>Allocated</span></div></div>';
    actionRow.insertAdjacentElement("afterend", allocationTableRow);
    var allocationTable = one("[data-register-allocation-table]", allocationTableRow);
    var rows = allocations.length ? allocations : [{ id: "", budgetId: "" }];
    rows.forEach(function (allocation) {
      var budget = allocation.budgetId ? budgetsById[allocation.budgetId] : null;
      var financialYear = budget ? budget.financialYear : currentYear;
      var balance = allocation.id && api ? api.allocationBalance(state.workspace, allocation.id) : null;
      var hasApprovedCarryForward = Boolean(allocation.id && (entities.allocationEntries || []).some(function (entry) {
        return entry.allocationId === allocation.id && entry.kind === "carryForward";
      }));
      var row = document.createElement("div");
      row.className = "program-register-allocation-table__row";
      row.setAttribute("data-register-budget-row", "allocation");
      row.setAttribute("data-register-budget-fy", financialYear);
      if (hasApprovedCarryForward) row.setAttribute("data-register-carry-forward", "approved");
      row.innerHTML = '<span data-register-allocation-fy>FY ' + esc(financialYear.replace("-", "/")) + '</span>'
        + '<strong data-register-allocation-amount>' + Number(balance ? balance.allocated : 0).toLocaleString("en-AU", { style: "currency", currency: "AUD" }) + '</strong>';
      allocationTable.appendChild(row);
    });
  }

  function renderDetail(record, scope) {
    var renderScope = scope && scope.querySelector ? scope : document;
    var savedState = captureInspectorState(renderScope);
    if (!record) {
      var placeholder = one("[data-register-empty-detail]", renderScope);
      var content = one("[data-register-detail-content]", renderScope);
      if (placeholder) placeholder.hidden = false;
      if (content) content.hidden = true;
      return;
    }
    var placeholderNode = one("[data-register-empty-detail]", renderScope);
    var contentNode = one("[data-register-detail-content]", renderScope);
    if (placeholderNode) placeholderNode.hidden = true;
    if (contentNode) contentNode.hidden = false;
    renderStatusHistory(record, renderScope);
    var primaryFields = one("[data-register-detail-primary]", renderScope);
    var quoteFields = one("[data-register-detail-quotes]", renderScope);
    var statusFields = one("[data-register-detail-status]", renderScope);
    clear(primaryFields);
    clear(quoteFields);
    clear(statusFields);
    if (primaryFields && quoteFields && statusFields) {
      var detailContainer = primaryFields.closest(".program-register-detail, .program-register-drawer");
      if (detailContainer && record) detailContainer.setAttribute("data-owner", record.owner || "NSA");
      var entries = [];
      var seen = {};

      function addField(label, value, keyName, fieldType) {
        var cleanLabel = text(label);
        var cleanVal = value == null ? "" : String(value);
        var keyKey = keyName ? text(keyName).toLowerCase() : cleanLabel.toLowerCase();
        if (!cleanLabel || seen[cleanLabel.toLowerCase()] || seen[keyKey]) return;
        seen[cleanLabel.toLowerCase()] = true;
        seen[keyKey] = true;
        var type = fieldType;
        if (!type) {
          var lowerKey = keyName ? keyName.toLowerCase() : cleanLabel.toLowerCase();
          if (lowerKey === "status") type = "select-status";
          else if (lowerKey === "priority") type = "select-priority";
          else if (lowerKey === "crew" || lowerKey === "crewid" || lowerKey === "crewname") type = "select-crew";
          else if (/date|time|at$|on$/i.test(lowerKey) || /^\d{4}-\d{2}-\d{2}/.test(cleanVal) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(cleanVal)) type = "date";
          else if (/notes|description|details|comments|reason/.test(lowerKey)) type = "textarea";
          else type = "text";
        }
        entries.push({
          label: cleanLabel,
          key: keyName || cleanLabel,
          value: cleanVal,
          type: type,
          weight: fieldWeight(keyName || cleanLabel)
        });
      }

      if (record.owner === "NSA") {
        var appTypeVal = first(record.raw, ["applicationType", "type"]) || record.kind || "Nature Strip Application";
        addField("Application type", appTypeVal, "applicationType", "text");

        var receiptVal = first(record.raw, ["receipt", "receiptNumber"]);
        addField("Receipt", receiptVal, "receipt", "text");

        var addrVal = record.location || record.address || first(record.raw, ["address", "propertyAddress", "site", "location"]);
        addField("Address / location", addrVal, "address", "text");

        var dateRecVal = first(record.raw, ["dateReceived", "receivedDate", "date", "createdAt"]) || record.date;
        addField("Date received", dateRecVal, "dateReceived", "date");


        var defaultFy = getFinancialYearForDate(dateRecVal);
        var fyVal = record.financialYear || record.season || first(record.raw, ["financialYear", "financialyear", "fy"]) || defaultFy;
        addField("Financial year", fyVal, "financialYear", "select-financial-year");

        var carryFwdVal = first(record.raw, ["carryForward"]);
        addField("Carry forward from previous financial year", carryFwdVal, "carryForward", "pill-slider");

        var custNameVal = record.applicantName || first(record.raw, ["customerName", "applicantName", "contactName", "name"]) || record.name;
        addField("Customer name", custNameVal, "customerName", "text");

        var custEmailVal = first(record.raw, ["customerEmail", "email", "emailAddress", "contactEmail"]);
        addField("Email", custEmailVal, "customerEmail", "text");

        var custPhoneVal = first(record.raw, ["customerPhone", "phone", "phoneNumber", "telephone", "mobile", "contactPhone"]);
        addField("Phone", custPhoneVal, "customerPhone", "text");

        var sketchOrDiagramVal = first(record.raw, ["sketchOrDiagram", "hasSketchOrDiagram", "sketch", "diagram"]);
        addField("Customer has Sketch or Diagram", sketchOrDiagramVal, "sketchOrDiagram", "pill-slider");

        var scopeVal = first(record.raw, ["scope", "details"]);
        addField("Scope", scopeVal, "scope", "textarea");

        var delDetailsVal = first(record.raw, ["deliveryDetails"]);
        addField("CoA / contractor delivery details", delDetailsVal, "deliveryDetails", "textarea");

        var actionedByVal = first(record.raw, ["actionedBy", "actionedByAndDate"]);
        addField("Actioned by", actionedByVal, "actionedBy", "text");

        var commDateVal = first(record.raw, ["commencementDate"]);
        addField("Commenced", commDateVal, "commencementDate", "date");

        var compDateVal = first(record.raw, ["completionDate"]);
        addField("Completed", compDateVal, "completionDate", "date");

        var compDetailsVal = first(record.raw, ["completionDetails"]);
        addField("Completion details", compDetailsVal, "completionDetails", "textarea");

        var commentsVal = first(record.raw, ["comments", "notes"]);
        addField("Notes", commentsVal, "comments", "textarea");
      } else {
        var eventNameVal = record.name || first(record.raw, ["eventName", "title", "name"]);
        addField("Event Name", eventNameVal, "name", "text");

        var addrValEvt = record.location || first(record.raw, ["address", "propertyAddress", "site", "location"]);
        addField("Location", addrValEvt, "address", "text");

        var nameVal = record.applicantName || first(record.raw, ["applicantName", "contactName", "customerName"]);
        addField("Applicant", nameVal, "applicantName", "text");

        var emailVal = first(record.raw, ["email", "emailAddress", "contactEmail"]);
        addField("Email Address", emailVal, "email", "text");

        var phoneVal = first(record.raw, ["phone", "phoneNumber", "telephone", "mobile", "contactPhone"]);
        addField("Phone Number", phoneVal, "phone", "text");

        addField("ID", record.id, "id", "readonly");

        var linkedProjForJob = buildLinkedProject(state.workspace, record);
        var jobNumVal = record.jobId || first(record.raw, ["jobId", "job_id", "jobNumber", "job_number", "job", "eventNumber"]) || (linkedProjForJob && linkedProjForJob.id) || "—";
        var jobNumLabel = record.owner === "EVT" ? "Event Number" : "Job Number";
        addField(jobNumLabel, jobNumVal === "—" ? "" : jobNumVal, "jobId", "text");

        var eventNotesVal = first(record.raw, ["notes", "comments", "description", "requestReason", "details"]);
        addField("Notes / comments", eventNotesVal, "notes", "textarea");

        addField("Carry forward from previous FY", first(record.raw, ["carryForward"]), "carryForward", "pill-slider");
        addField("Site diagram", first(record.raw, ["sketchOrDiagram", "hasSketchOrDiagram", "siteDiagram", "diagram"]), "sketchOrDiagram", "pill-slider");
        addField("Scope", first(record.raw, ["scope", "remediationScope"]), "scope", "textarea");
        addField("Actioned by", first(record.raw, ["actionedBy", "actionedByAndDate"]), "actionedBy", "text");
        addField("Commenced", first(record.raw, ["commencementDate"]), "commencementDate", "date");
        addField("Completed", first(record.raw, ["completionDate"]), "completionDate", "date");
        addField("CoA / contractor delivery details", first(record.raw, ["deliveryDetails"]), "deliveryDetails", "textarea");
        addField("Completion details", first(record.raw, ["completionDetails"]), "completionDetails", "textarea");

        var appDateVal = first(record.raw, ["endDate", "end_date", "applicationDate", "date", "eventDate", "startDate", "submittedDate"]);
        addField("Application Date", appDateVal, "applicationDate", "date");
        var defaultFyForRecord = getFinancialYearForDate(appDateVal);
        var budgetVal = first(record.raw, ["approvedBudget", "approved_budget", "approvedbudget", "budget", "approvedBudgetAmount"]) || "—";
        var rawArea = first(record.raw, ["area", "hectares", "hectare", "areaHectares", "area_hectares", "ha", "areaSize", "areasize"]);
        var areaVal = rawArea ? (rawArea + (typeof rawArea === "number" || !/ha|m²/i.test(String(rawArea)) ? " ha" : "")) : "—";

        addField("Priority", record.priority, "priority", "select-priority");

        addField("Approved Budget", budgetVal, "approvedBudget", "text");
        addField("Financial Year", record.financialYear || record.season || defaultFyForRecord, "financialYear", "select-financial-year");

        var ignoredKeys = [
          "status", "priority", "date", "statusdate", "eventdate", "startdate", "submitteddate",
          "crew", "crewname", "crewid", "location", "locations", "locations_array", "site", "address", "propertyaddress", "property_address", "payload",
          "provenance", "source", "sourcerecord", "sourceapp", "sourcefile", "sourcetype", "importsource", "datasetsource",
          "allocations", "allocation", "costallocations", "joballocations", "costingallocations",
          "polygons", "polygon", "geometry", "geometries", "shapes", "spatialpolygons",
          "quote", "quotes", "quoted", "quotetotal", "quoteamount", "estimate", "estimatedquote", "statushistory",
          "season", "financialyear", "financial_year", "fy", "id", "jobid", "job_id", "jobnumber", "job_number",
          "notes", "description", "details", "comments", "requestreason",
          "sketchordiagram", "hassketchordiagram", "sketch", "diagram",
          "applicantname", "contactname", "customername", "name",
          "email", "emailaddress", "contactemail",
          "phone", "phonenumber", "telephone", "mobile", "contactphone",
          "completion", "completionpercent", "completion_percent", "completionstatus", "completion_status", "percentcomplete", "percent_complete", "percent",
          "state", "applicationstate", "eventstate", "statusstate",
          "applicationstatus", "application_status", "appstatus", "app_status",
          "approvedbudget", "approved_budget", "budget", "approvedbudgetamount",
          "hectares", "hectare", "areahectares", "ha", "areasize", "area_size", "area",
          "jobs", "job", "labour", "labor", "materials", "material", "park", "parkname",
          "pendinghours", "pending_hours", "title", "eventtitle", "tracking", "trackingid",
          "type", "eventtype", "dimensionsource", "dimension_source", "category", "eventcategory",
          "owner", "eventowner", "crew", "crewname", "crewid",
          "statusrecords", "status_records", "statusrecord",
          "contingencypercent", "contingency_percent", "contingency", "contingencypct"
        ];

        var rawObj = Object.assign({}, record.raw && record.raw.payload || {}, record.raw || {});
        Object.keys(rawObj).filter(function (key) {
          var lower = key.toLowerCase();
          var label = fieldLabel(key).toLowerCase().trim();
          return ignoredKeys.indexOf(lower) < 0 &&
                 !/area|hectare|^ha$/i.test(lower) &&
                 !/^completion|^state$|^application status$|^area|^ha$|hectare/i.test(label) &&
                 !/^provenance|^source/.test(lower) &&
                 !/allocations?|polygons?|quotes?|geometr(y|ies)|locations?/.test(lower);
        }).forEach(function (key) {
          var label = fieldLabel(key);
          if (record.owner === "EVT" && /^end\s*date$/i.test(label.trim())) {
            label = "Application Date";
          }
          addField(label, rawObj[key], key);
        });

        entries.sort(function (left, right) {
          if (left.weight !== right.weight) return left.weight - right.weight;
          return left.label.localeCompare(right.label, "en-AU", { sensitivity: "base" });
        });
      }

      if (record.owner === "NSA") {
        renderNsaDrawer(record, renderScope, entries);
        renderRegisterBudgetRows(record, renderScope);
        restoreInspectorState(savedState, renderScope);
        return;
      }

      if (record.owner === "EVT") {
        renderEventDrawer(record, renderScope, entries);
        renderRegisterBudgetRows(record, renderScope);
        restoreInspectorState(savedState, renderScope);
        return;
      }

      var detailsSection = document.createElement("div");
      detailsSection.className = "program-register-section program-register-section--details";
      detailsSection.innerHTML = '<h4 class="program-register-section-title">Details</h4>';
      var detailsDl = document.createElement("dl");
      var detailsSecondaryDl = null;
      if (record.owner === "NSA") {
        var detailsGrid = document.createElement("div");
        detailsGrid.className = "program-register-details-grid";
        detailsDl.className = "program-register-details-grid__column program-register-details-grid__column--primary";
        detailsSecondaryDl = document.createElement("dl");
        detailsSecondaryDl.className = "program-register-details-grid__column program-register-details-grid__column--secondary";
        detailsGrid.appendChild(detailsDl);
        detailsGrid.appendChild(detailsSecondaryDl);
        detailsSection.appendChild(detailsGrid);
      } else {
        detailsSection.appendChild(detailsDl);
      }

      var notesSection = document.createElement("div");
      notesSection.className = "program-register-section program-register-section--notes";
      notesSection.innerHTML = '<h4 class="program-register-section-title">Notes / Comments</h4>';
      var notesDl = document.createElement("dl");
      notesSection.appendChild(notesDl);

      var statusSection = document.createElement("div");
      statusSection.className = "program-register-section program-register-section--status";
      statusSection.innerHTML = '<h4 class="program-register-section-title">Status</h4>';
      var statusDl = document.createElement("dl");
      statusSection.appendChild(statusDl);

      var budgetSection = document.createElement("div");
      budgetSection.className = "program-register-section program-register-section--budget";
      budgetSection.innerHTML = '<h4 class="program-register-section-title">Quotes</h4>';
      var budgetDl = document.createElement("dl");
      budgetSection.appendChild(budgetDl);

      var nsaDetailsAfterScope = false;
      entries.forEach(function (entry) {
        if (String(entry.key || "").toLowerCase() === "approvedbudget") return;
        if (entry.key === "status" || entry.key === "statusDate") return;
        var isStatusField = entry.key === "priority" || entry.key === "crew";
        var isBudgetField = entry.key === "approvedBudget" || entry.key === "financialYear" || entry.key === "costingTotal" || entry.key === "carryForward";
        var noteKey = (text(entry.key) + " " + text(entry.label)).toLowerCase();
        var isNotesField = /(^|[^a-z])(notes?|comments?)([^a-z]|$)/.test(noteKey);
        var targetDl = isStatusField ? statusDl : (isBudgetField ? budgetDl : (isNotesField ? notesDl : detailsDl));
        if (record.owner === "NSA" && targetDl === detailsDl && nsaDetailsAfterScope && detailsSecondaryDl) targetDl = detailsSecondaryDl;
        appendEditableField(targetDl, entry.label, entry.key, entry.value, record, entry.type);
      if (record.owner === "NSA" && targetDl === detailsDl && entry.key === "scope") nsaDetailsAfterScope = true;
    });

      if (!notesDl.children.length) {
        notesDl.innerHTML = '<p class="program-register-section-empty">No notes or comments recorded.</p>';
      }

      var linkedProjects = buildLinkedProjects(state.workspace, record);
      var linkedProject = linkedProjects.length === 1 ? linkedProjects[0] : null;
      var linkedSection = document.createElement("div");
      linkedSection.className = "program-register-section program-register-section--linked register-linked-section";
      linkedSection.setAttribute("data-register-project-section", "");
      linkedSection.innerHTML = '<h4 class="program-register-section-title register-linked-section__heading">Linked Applications</h4>';
      if (linkedProjects.length) {
        if (linkedProjects.length > 1) linkedSection.innerHTML += '<p class="program-register-section-empty" role="alert">Multiple active Delivery Projects are linked. Review Data Health before continuing.</p>';
        linkedProjects.forEach(function (project) {
          var linkedRow = document.createElement("div");
          linkedRow.className = "register-linked-entity-row";
          linkedRow.innerHTML = '<span class="register-linked-entity-row__title">' + esc(project.title || project.name || "Untitled Project") + '</span>' +
            statusPillHtml(project.status || "Draft");
          linkedSection.appendChild(linkedRow);
        });
      } else {
        linkedSection.innerHTML += '<p class="program-register-section-empty">No delivery projects are linked to this Register record.</p>' +
          '<div class="program-register-cta-wrap program-register-cta-wrap--linked"><button type="button" class="register-cta-btn" data-register-action="create-project" data-register-for="' + esc(record.id) + '" data-register-owner="' + esc(record.owner) + '">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Create Delivery Project</span>' +
          '</button></div>';
      }

      // Add inline Go to Cost Calculator button inside Budget section
      var budgetCtaWrap = document.createElement("div");
      budgetCtaWrap.className = "program-register-cta-wrap program-register-cta-wrap--budget";
      var budgetBtnDisabled = !linkedProject;
      var budgetBtnTooltip = budgetBtnDisabled
        ? "Create or link a delivery project first to open in Cost Calculator"
        : "Go to Cost Calculator";
      var budgetBtnAriaLabel = budgetBtnDisabled
        ? "Go to Cost Calculator (Disabled: Create a delivery project first)"
        : "Go to Cost Calculator";
      var budgetDisabledAttr = budgetBtnDisabled ? ' disabled aria-disabled="true"' : '';

      budgetCtaWrap.innerHTML = '<button type="button" class="register-cta-btn register-cta-btn--budget" data-register-action="costing" data-register-record="' + esc(record.id) + '"' +
        budgetDisabledAttr +
        ' data-uos-tooltip="' + esc(budgetBtnTooltip) + '" title="' + esc(budgetBtnTooltip) + '" aria-label="' + esc(budgetBtnAriaLabel) + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/></svg>' +
        '<span>Go to Cost Calculator &rarr;</span>' +
      '</button>';
    budgetDl.appendChild(budgetCtaWrap);

      var linkedProjectIds = linkedProjects.map(function (project) { return project.id; });
      var relatedQuotes = state.workspace && state.workspace.entities && Array.isArray(state.workspace.entities.quotes)
        ? state.workspace.entities.quotes.filter(function (quote) { return linkedProjectIds.indexOf(quote.projectId) >= 0; }).sort(function (left, right) {
          return Number(right.revision || 1) - Number(left.revision || 1);
        }) : [];
      var quoteList = document.createElement("div");
      quoteList.className = "program-register-quote-list";
      if (!relatedQuotes.length) {
        quoteList.innerHTML = '<p class="program-register-section-empty">No quote revisions recorded.</p>';
      } else {
        relatedQuotes.forEach(function (quote) {
          var quoteRow = document.createElement("div");
          quoteRow.className = "program-register-quote-row";
          var quoteTotal = Number(quote.grandTotal || 0);
          quoteRow.innerHTML = '<div><strong>' + esc(quote.quoteNumber || quote.auditNumber || quote.id) + '</strong><span>Revision ' + esc(quote.revision || 1) + '</span></div>' +
            statusPillHtml(quote.status || "Draft") +
            '<strong>' + (quoteTotal ? quoteTotal.toLocaleString("en-AU", { style: "currency", currency: "AUD" }) : "—") + '</strong>';
          quoteList.appendChild(quoteRow);
        });
      }
      budgetSection.appendChild(quoteList);
      var quoteCta = document.createElement("div");
      quoteCta.className = "program-register-cta-wrap program-register-cta-wrap--quotes";
      quoteCta.innerHTML = '<button type="button" class="register-cta-btn" data-register-action="quotes" data-register-record="' + esc(record.id) + '"' + (!linkedProject ? ' disabled aria-disabled="true"' : '') + '><span>Open in Quote Builder &rarr;</span></button>';
      budgetSection.appendChild(quoteCta);

      primaryFields.appendChild(detailsSection);
      primaryFields.appendChild(notesSection);
      statusFields.appendChild(linkedSection);
      statusFields.appendChild(statusSection);
      quoteFields.appendChild(budgetSection);
    }
    restoreInspectorState(savedState, renderScope);
  }

  function renderStatusHistory(record, scope) {
    var renderScope = scope && scope.querySelector ? scope : document;
    var historyList = one("[data-register-status-history-list]", renderScope);
    if (!historyList) return;
    var savedState = captureInspectorState(renderScope);
    clear(historyList);
    if (!record) {
      historyList.innerHTML = '<p class="program-register-history-empty">No status history recorded yet.</p>';
      restoreInspectorState(savedState, renderScope);
      return;
    }

    var history = Array.isArray(record.statusHistory) ? record.statusHistory :
                  (record.raw && Array.isArray(record.raw.statusHistory) ? record.raw.statusHistory : []);

    if (!history.length) {
      historyList.innerHTML = '<p class="program-register-history-empty">No status history recorded yet.</p>';
      restoreInspectorState(savedState, renderScope);
      return;
    }

    var indexed = history.map(function (entry, sourceIndex) { return { entry: entry, sourceIndex: sourceIndex }; });
    var sorted = indexed.sort(function (left, right) {
      var a = left.entry, b = right.entry;
      var timeA = new Date(a.timestamp || a.date || 0).getTime();
      var timeB = new Date(b.timestamp || b.date || 0).getTime();
      return timeB - timeA;
    });

    sorted.forEach(function (timelineEntry) {
      var entry = timelineEntry.entry;
      var item = document.createElement("div");
      item.className = "program-register-history-item";
      item.setAttribute("data-register-timeline-status", normalizeStatus(entry.status, record.owner));
      var statusBadge = statusPillHtml(entry.status);
      var historyDate = entry.date || entry.timestamp;
      var formattedDate = window.UOS && window.UOS.imports && window.UOS.imports.formatDate
        ? window.UOS.imports.formatDate(historyDate)
        : (historyDate || "—");
        item.innerHTML = '<div class="program-register-history-left">' + statusBadge + '<span class="program-register-history-date">' + esc(formattedDate) + '</span></div>';
      historyList.appendChild(item);
    });
    restoreInspectorState(savedState, renderScope);
  }

  function openRegisterDrawerScope(recordId) {
    var drawers = document.querySelectorAll("[data-register-drawer-record]");
    for (var index = 0; index < drawers.length; index += 1) {
      if (drawers[index].getAttribute("data-register-drawer-record") === recordId) return drawers[index];
    }
    return null;
  }

  function updatePillPicker() {
    var buttons = document.querySelectorAll("[data-register-pane-mode]");
    Array.prototype.forEach.call(buttons, function (button) {
      var mode = button.getAttribute("data-register-pane-mode");
      var isActive = (mode === "applications" && state.filters.ownership === "NSA") ||
                     (mode === "events" && state.filters.ownership === "EVT");
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    var pdfDropzone = one("[data-register-pdf-dropzone]");
    if (pdfDropzone) {
      var isAppsActive = (state.filters.ownership !== "EVT");
      pdfDropzone.hidden = !isAppsActive;
      pdfDropzone.style.display = isAppsActive ? "" : "none";
    }
    var addBtnLabel = one("[data-register-add-label]");
    if (addBtnLabel) {
      addBtnLabel.textContent = (state.filters.ownership === "EVT") ? "Add Event" : "Add Application";
    }
  }

  function addRegisterRecord() {
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    if (!app || typeof app.updateWorkspace !== "function") return;

    var isEvent = (state.filters.ownership === "EVT");
    var collection = isEvent ? "events" : "applications";
    var timestampStr = new Date().toISOString();
    var uid = (isEvent ? "EVT-EVENT-" : "NSA-APP-") + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6);

    var newRecord;
    if (isEvent) {
      newRecord = {
        id: uid,
        owner: "EVT",
        type: "event",
        eventName: "New Remediation Event",
        park: "Unassigned Site",
        status: "received",
        season: "26-27",
        jobNumber: "",
        date: timestampStr.substring(0, 10),
        dateReceived: timestampStr.substring(0, 10),
        allocations: [],
        polygons: [],
        createdAt: timestampStr,
        updatedAt: timestampStr
      };
    } else {
      newRecord = {
        id: uid,
        owner: "NSA",
        type: "application",
        applicationType: "Nature Strip Application",
        address: "New Nature Strip Application",
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        dateReceived: timestampStr.substring(0, 10),
        status: "received",
        financialYear: "",
        comments: "",
        createdAt: timestampStr,
        updatedAt: timestampStr
      };
    }

    app.updateWorkspace(function (candidate) {
      candidate.entities = candidate.entities || {};
      candidate.entities[collection] = Array.isArray(candidate.entities[collection]) ? candidate.entities[collection] : [];
    candidate.entities[collection].unshift(newRecord);
    candidate.workspace = candidate.workspace || {};
    candidate.workspace.selectedEntityId = uid;
    candidate.workspace.selectedProjectId = "";
    candidate.workspace.selectedJobId = "";
    candidate.workspace.ownerMode = newRecord.owner;
    candidate.workspace.destination = "register";
    candidate.workspace.planner = candidate.workspace.planner || {};
    candidate.workspace.planner.selectedProjectId = "";
    candidate.workspace.costing = candidate.workspace.costing || {};
    candidate.workspace.costing.selectedProjectId = "";
    candidate.workspace.costing.jobId = "";
    candidate.workspace.scheduler = candidate.workspace.scheduler || {};
    candidate.workspace.scheduler.selectedProjectId = "";
    candidate.workspace.scheduler.selectedId = "";
      candidate.workspace.map = candidate.workspace.map || {};
      candidate.workspace.map.ownerMode = newRecord.owner;
      candidate.workspace.map.scopeMode = "register";
      candidate.workspace.map.selectedRegisterId = uid;
      candidate.workspace.map.selectedProjectId = "";
      candidate.workspace.map.selectedLocationId = "";
      candidate.workspace.map.selectedGeometryId = "";
      candidate.workspace.map.inspectorMode = "register";
      candidate.workspace.inspector = candidate.workspace.inspector || {};
      candidate.workspace.inspector.mode = "detail";
      return candidate;
    }).then(function () {
      renderTable();
      renderMode();
      if (window.UOS && window.UOS.ProgramDisclosureRows) {
        window.UOS.ProgramDisclosureRows.open("register:" + uid);
      }
    });
  }
  function syncSelectedWithFiltered() {
    state.filtered = selectRecords(state.records, state);
    var isSelectedInFiltered = state.filtered.some(function (item) { return item.id === state.selectedId; });
    if (!isSelectedInFiltered && state.filtered.length) {
      state.selectedId = state.filtered[0].id;
    } else if (!state.filtered.length) {
      state.selectedId = null;
    }
  }
  function renderMode() {
    syncSelectedWithFiltered();
    if (state.filtered.length) {
      state.mode = "detail";
    }
    updatePillPicker();
  }
  function showDetail(id) {
    var record = state.filtered.find(function (item) { return item.id === id; });
    if (!record) record = state.records.find(function (item) { return item.id === id; });
    if (!record) return;
    state.selectedId = record.id; state.mode = "detail"; renderMode();
    /* The before-open hook has already populated the live drawer. Keep that
       exact node in place after motion instead of rebuilding the entire table. */
    patchRegisterSelection(record.id);
    persist(true);
  }
  function backToList() {
    state.mode = "list"; state.selectedId = null; renderMode(); renderTable();
    persist();
  }
  function moveFocus(delta) {
    if (!state.filtered.length) return;
    state.focusedIndex = Math.max(0, Math.min(state.filtered.length - 1, state.focusedIndex + delta));
    var rows = typeof document === "undefined" ? [] : document.querySelectorAll("[data-register-record]");
    Array.prototype.forEach.call(rows, function (row, index) { row.tabIndex = index === state.focusedIndex ? 0 : -1; });
    if (rows[state.focusedIndex]) rows[state.focusedIndex].focus();
  }
  function readControls() {
    state.sort = one("[data-register-sort]") ? one("[data-register-sort]").value : "date";
    state.filters.ownership = one("[data-register-ownership]") ? one("[data-register-ownership]").value : "all";
    state.filters.status = "all";
    state.filters.crew = "all";
    state.focusedIndex = 0; state.scrollTop = 0;
    syncSelectedWithFiltered();
    renderList();
    renderMode();
    persist();
  }
  function update(workspace) {
    var localPatch = state.pendingLocalPatches.length ? state.pendingLocalPatches.shift() : null;
    var restored = stateFromWorkspace(workspace);
    state.workspace = clone(workspace); state.records = recordsFrom(workspace);
    state.selectedId = restored.selectedId; state.mode = restored.mode; state.scrollTop = restored.scrollTop;
    state.sort = restored.sort; state.sortDirection = restored.sortDirection;
    var currentStatuses = Array.isArray(state.filters.statuses) ? state.filters.statuses : [];
    state.filters = restored.filters;
    var sharedOwner = workspace && workspace.workspace && workspace.workspace.ownerMode;
    if (sharedOwner === "NSA" || sharedOwner === "EVT") state.filters.ownership = sharedOwner;
    if (currentStatuses.length && (!state.filters.statuses || !state.filters.statuses.length)) {
      state.filters.statuses = currentStatuses;
    }
    // Status dropdown & crew dropdown removed in favor of direct pill filtering
    var sort = one("[data-register-sort]"), ownership = one("[data-register-ownership]");
    var search = one("[data-register-search]");
    if (sort) sort.value = state.sort;
    if (ownership) ownership.value = state.filters.ownership;
    if (search && search.value !== state.filters.query) search.value = state.filters.query;
    setText('[data-program-owner-count="NSA"]', state.records.filter(function (record) { return record.owner === "NSA"; }).length);
    setText('[data-program-owner-count="EVT"]', state.records.filter(function (record) { return record.owner === "EVT"; }).length);
    syncSelectedWithFiltered();
    if (localPatch && !localPatch.requiresRender) {
      var patchedRecord = state.records.find(function (record) { return record.id === localPatch.recordId; });
      if (patchedRecord) patchRegisterSummary(patchedRecord);
      return;
    }
    renderList();
    renderMode();
  if (state.selectedId && state.selectedId !== restored.selectedId) {
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    if (app && typeof app.selectWorkingItem === "function") app.selectWorkingItem(state.selectedId);
    if (window.UOS.ProgramCardVisibility && typeof window.UOS.ProgramCardVisibility.scheduleSyncActiveViewSelection === "function") {
      window.UOS.ProgramCardVisibility.scheduleSyncActiveViewSelection();
    }
  }
}
  function persist(preserveTable) {
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    if (!app || typeof app.updateWorkspace !== "function") return Promise.resolve(null);
    var selectionPatch = preserveTable ? { recordId: state.selectedId, requiresRender: false } : null;
    if (selectionPatch) state.pendingLocalPatches.push(selectionPatch);
    var savedState = { selectedId: state.selectedId, mode: state.mode, scrollTop: state.scrollTop, sort: state.sort, sortDirection: state.sortDirection, filters: clone(state.filters) };
    return app.updateWorkspace(function (candidate) {
      candidate.workspace = candidate.workspace || {};
      candidate.workspace.selectedEntityId = savedState.selectedId;
      if (savedState.selectedId && typeof app.resolveWorkingContext === "function") {
        var context = app.resolveWorkingContext(candidate, savedState.selectedId);
        candidate.workspace.selectedProjectId = context.projectId || "";
        candidate.workspace.selectedJobId = "";
        candidate.workspace.planner = candidate.workspace.planner || {};
        candidate.workspace.planner.selectedProjectId = context.projectId || "";
        candidate.workspace.costing = candidate.workspace.costing || {};
        candidate.workspace.costing.selectedProjectId = context.projectId || "";
      candidate.workspace.scheduler = candidate.workspace.scheduler || {};
      candidate.workspace.scheduler.selectedProjectId = context.projectId || "";
      candidate.workspace.map = candidate.workspace.map || {};
      candidate.workspace.map.ownerMode = context.owner || candidate.workspace.ownerMode || "";
      candidate.workspace.map.selectedRegisterId = context.registerId || "";
      candidate.workspace.map.selectedProjectId = context.projectId || "";
      candidate.workspace.map.selectedLocationId = "";
      candidate.workspace.map.selectedGeometryId = "";
      candidate.workspace.map.scopeMode = "register";
      candidate.workspace.map.inspectorMode = "register";
    }
      candidate.workspace.inspector = candidate.workspace.inspector || {};
      candidate.workspace.inspector.mode = savedState.mode;
      candidate.workspace.inspector.scrollTop = savedState.scrollTop;
      candidate.workspace.register = { sort: savedState.sort, sortDirection: savedState.sortDirection, filters: savedState.filters };
      return candidate;
    }).catch(function () {
      if (selectionPatch) {
        var patchIndex = state.pendingLocalPatches.indexOf(selectionPatch);
        if (patchIndex >= 0) state.pendingLocalPatches.splice(patchIndex, 1);
      }
      return null;
    });
  }
  function handleFieldEdit(editInput) {
    var key = editInput.getAttribute("data-register-edit-key");
    if (key === "status" || key === "statusDate") return;
    var id = editInput.getAttribute("data-register-edit-id") || state.selectedId;
    var val;
    if (editInput.hasAttribute("data-register-value")) {
      val = editInput.getAttribute("data-register-value") === "true";
    } else if (editInput.type === "checkbox") {
      val = editInput.checked;
    } else {
      val = editInput.value;
    }
    var record = state.records.find(function (r) { return r.id === id; });
    if (!record || !key) return;

    record[key] = val;
    if (record.raw) {
      record.raw[key] = val;
      if (record.raw.payload && typeof record.raw.payload === "object") {
        record.raw.payload[key] = val;
      }
    }

    if (key === "applicantName" || key === "name" || key === "title") {
      record.name = val;
      record.applicantName = val;
      if (record.raw) { record.raw.name = val; record.raw.applicantName = val; record.raw.title = val; }
      setText("[data-register-detail-title]", val, openRegisterDrawerScope(record.id));
    } else if (key === "address" || key === "location" || key === "site") {
      record.location = val;
      record.address = val;
      if (record.raw) { record.raw.location = val; record.raw.address = val; record.raw.site = val; }
    } else if (key === "date") {
      record.date = val;
      if (record.raw) { record.raw.date = val; record.raw.startDate = val; }
    } else if (key === "crew") {
      record.crew = val;
      if (record.raw) { record.raw.crew = val; record.raw.crewName = val; record.raw.crewId = val; }
    } else if (key === "priority") {
      record.priority = val;
      if (record.raw) { record.raw.priority = val; }
    } else if (key === "financialYear" || key === "season") {
      record.financialYear = val;
      record.season = val;
      if (record.raw) { record.raw.financialYear = val; record.raw.season = val; }
    } else if (key === "area" || key === "areaUnit") {
      var container = editInput.closest("dd") || editInput.closest(".program-register-area-wrap");
      var numInput = container ? container.querySelector('[data-register-edit-key="area"]') : null;
      var unitSelect = container ? container.querySelector('[data-register-edit-key="areaUnit"]') : null;
      var numVal = numInput ? numInput.value.trim() : "";
      var unitVal = unitSelect ? unitSelect.value : "ha";
      var combinedVal = numVal ? (numVal + " " + unitVal) : "";

      record.area = combinedVal;
      if (record.raw) {
        record.raw.area = combinedVal;
        record.raw.ha = combinedVal;
        record.raw.hectares = combinedVal;
        record.raw.areaSize = combinedVal;
        if (record.raw.payload && typeof record.raw.payload === "object") {
          record.raw.payload.area = combinedVal;
          record.raw.payload.ha = combinedVal;
          record.raw.payload.hectares = combinedVal;
          record.raw.payload.areaSize = combinedVal;
        }
      }
      patchRegisterSummary(record);
      persistWorkspaceEntity(record, "area", combinedVal);
      return;
    }

    patchRegisterSummary(record);
    persistWorkspaceEntity(record, key, val);
  }

  function persistWorkspaceEntity(record, key, val) {
    var app = typeof window !== "undefined" && window.UOS && window.UOS.ProgramApp;
    if (!app || typeof app.updateWorkspace !== "function") return;
    var patch = { recordId: record.id, key: key, requiresRender: localEditRequiresRender(key) };
    state.pendingLocalPatches.push(patch);
    app.updateWorkspace(function (candidate) {
      var entities = candidate.entities || {};
      var listName = record.owner === "EVT" ? "events" : "applications";
      var list = Array.isArray(entities[listName]) ? entities[listName] : [];
      var target = list.find(function (item) { return item.id === record.id; });
      if (target) {
        target[key] = val;
        if (target.payload && typeof target.payload === "object") {
          target.payload[key] = val;
        }

        if (key === "applicantName" || key === "name" || key === "title") {
          ["name", "title", "applicantName", "contactName", "customerName", "eventName"].forEach(function (k) {
            target[k] = val;
            if (target.payload && typeof target.payload === "object") target.payload[k] = val;
          });
        } else if (key === "address" || key === "location" || key === "site") {
          ["location", "address", "site", "propertyAddress"].forEach(function (k) {
            target[k] = val;
            if (target.payload && typeof target.payload === "object") target.payload[k] = val;
          });
        } else if (key === "date") {
          ["date", "eventDate", "startDate", "submittedDate", "createdAt"].forEach(function (k) {
            target[k] = val;
            if (target.payload && typeof target.payload === "object") target.payload[k] = val;
          });
        } else if (key === "crew") {
          ["crew", "crewName", "crewId"].forEach(function (k) {
            target[k] = val;
            if (target.payload && typeof target.payload === "object") target.payload[k] = val;
          });
        } else if (key === "financialYear" || key === "season") {
          ["financialYear", "financialyear", "financial_year", "fy", "season"].forEach(function (k) {
            target[k] = val;
            if (target.payload && typeof target.payload === "object") target.payload[k] = val;
          });
        } else if (key === "jobId" || key === "job_id" || key === "jobNumber" || key === "eventNumber") {
          ["jobId", "job_id", "jobNumber", "job_number", "eventNumber"].forEach(function (k) {
            target[k] = val;
            if (target.payload && typeof target.payload === "object") target.payload[k] = val;
          });
        } else if (key === "receipt" || key === "receiptNumber") {
          ["receipt", "receiptNumber"].forEach(function (k) {
            target[k] = val;
            if (target.payload && typeof target.payload === "object") target.payload[k] = val;
          });
        }
      }
      return candidate;
    }).catch(function () {
      var index = state.pendingLocalPatches.indexOf(patch);
      if (index >= 0) state.pendingLocalPatches.splice(index, 1);
    });
  }

  function bind() {
    if (state.bound || typeof document === "undefined") return; state.bound = true;
    var deleteDialog = one("#deleteRegisterDialog");
    if (deleteDialog) deleteDialog.addEventListener("cancel", function (event) { event.preventDefault(); closeDeleteDialog(); });
    document.addEventListener("uos:disclosure-before-open", function (event) {
      var key = event.detail && event.detail.key || "";
      if (key.indexOf("register:") !== 0) return;
      var recordId = key.slice("register:".length);
      var record = state.records.find(function (item) { return item.id === recordId; });
      var drawer = event.detail && event.detail.drawer;
      var host = drawer && drawer.querySelector ? drawer.querySelector("[data-register-drawer-record]") : openRegisterDrawerScope(recordId);
      if (record && host) renderDetail(record, host);
    });
    document.addEventListener("change", function (event) {
      if (event.target.matches("[data-register-sort],[data-register-ownership]")) {
        readControls();
        return;
      }
      var editInput = event.target.closest("[data-register-edit-key]");
      if (editInput) {
        if (editInput.closest(".program-register-protected-edit")) return;
        handleFieldEdit(editInput);
      }
    });

    document.addEventListener("input", function (event) {
      if (event.target.matches("[data-register-search]")) {
        state.filters.query = event.target.value;
        state.focusedIndex = 0;
        state.scrollTop = 0;
        syncSelectedWithFiltered();
        renderList();
        renderMode();
        persist();
        return;
      }
      var editInput = event.target.closest("[data-register-edit-key]");
      if (editInput && editInput.closest(".program-register-protected-edit")) return;
      if (editInput && editInput.tagName === "INPUT" && editInput.type === "text") {
        var key = editInput.getAttribute("data-register-edit-key");
        var id = editInput.getAttribute("data-register-edit-id") || state.selectedId;
        var record = state.records.find(function (r) { return r.id === id; });
        if (record && key) {
          var val = editInput.value;
          record[key] = val;
          if (record.raw) {
            record.raw[key] = val;
            if (record.raw.payload && typeof record.raw.payload === "object") {
              record.raw.payload[key] = val;
            }
          }
          if (key === "applicantName" || key === "name" || key === "title") {
            record.name = val;
            record.applicantName = val;
            if (record.raw) { record.raw.name = val; record.raw.applicantName = val; record.raw.title = val; }
            setText("[data-register-detail-title]", val, openRegisterDrawerScope(record.id));
          } else if (key === "address" || key === "location" || key === "site") {
            record.location = val;
            record.address = val;
            if (record.raw) { record.raw.location = val; record.raw.address = val; record.raw.site = val; }
          } else if (key === "jobId" || key === "job_id" || key === "jobNumber" || key === "eventNumber") {
            record.jobId = val;
            if (record.raw) {
              record.raw.jobId = val; record.raw.job_id = val; record.raw.jobNumber = val; record.raw.eventNumber = val;
              if (record.raw.payload && typeof record.raw.payload === "object") {
                record.raw.payload.jobId = val; record.raw.payload.eventNumber = val;
              }
            }
          } else if (key === "receipt" || key === "receiptNumber") {
            record.receipt = val;
            if (record.raw) {
              record.raw.receipt = val; record.raw.receiptNumber = val;
              if (record.raw.payload && typeof record.raw.payload === "object") {
                record.raw.payload.receipt = val;
              }
            }
          }
        }
      }
    });
    document.addEventListener("click", function (event) {
      var tableSortButton = event.target.closest("[data-register-table-sort]");
      if (tableSortButton) {
        event.preventDefault();
        var nextSort = tableSortButton.getAttribute("data-register-table-sort");
        state.sortDirection = state.sort === nextSort && state.sortDirection === "asc" ? "desc" : "asc";
        state.sort = nextSort;
        var sortInput = one("[data-register-sort]");
        if (sortInput) sortInput.value = nextSort;
        state.focusedIndex = 0;
        state.scrollTop = 0;
        state.filtered = selectRecords(state.records, state);
        renderList();
        persist();
        return;
      }
      var saveEditButton = event.target.closest("[data-register-save-edit]");
      var cancelEditButton = event.target.closest("[data-register-cancel-edit]");
      if (saveEditButton || cancelEditButton) {
        event.preventDefault();
        event.stopPropagation();
        var actionButton = saveEditButton || cancelEditButton;
        var actionWrap = actionButton.closest(".program-register-protected-edit");
        var actionInput = actionWrap ? actionWrap.querySelector("[data-register-edit-key]") : null;
        var actionEditButton = actionWrap ? actionWrap.querySelector("[data-register-unlock-edit]") : null;
        var actionSaveButton = actionWrap ? actionWrap.querySelector("[data-register-save-edit]") : null;
        var actionCancelButton = actionWrap ? actionWrap.querySelector("[data-register-cancel-edit]") : null;
        if (actionInput) {
          if (saveEditButton) {
            handleFieldEdit(actionInput);
            actionInput.setAttribute("data-register-original-value", actionInput.value);
          } else {
            actionInput.value = actionInput.getAttribute("data-register-original-value") || "";
          }
          actionInput.readOnly = true;
          actionInput.setAttribute("aria-readonly", "true");
          actionInput.classList.add("is-edit-locked");
        }
        if (actionEditButton) actionEditButton.hidden = false;
        if (actionSaveButton) actionSaveButton.hidden = true;
        if (actionCancelButton) actionCancelButton.hidden = true;
        return;
      }
      var unlockEditButton = event.target.closest("[data-register-unlock-edit]");
      if (unlockEditButton) {
        event.preventDefault();
        event.stopPropagation();
        var protectedWrap = unlockEditButton.closest(".program-register-protected-edit");
        var protectedInput = protectedWrap ? protectedWrap.querySelector("[data-register-edit-key]") : null;
        if (protectedInput) {
          protectedInput.readOnly = false;
          protectedInput.removeAttribute("aria-readonly");
          protectedInput.classList.remove("is-edit-locked");
          unlockEditButton.hidden = true;
          var saveButton = protectedWrap.querySelector("[data-register-save-edit]");
          var cancelButton = protectedWrap.querySelector("[data-register-cancel-edit]");
          if (saveButton) saveButton.hidden = false;
          if (cancelButton) cancelButton.hidden = false;
          protectedInput.focus();
          protectedInput.select();
        }
        return;
      }
      var addRecordBtn = event.target.closest("[data-register-add-record]");
      if (addRecordBtn) {
        addRegisterRecord();
        return;
      }
      var pillBtn = event.target.closest(".program-register-pill-btn[data-register-edit-key]");
      if (pillBtn) {
        if (pillBtn.getAttribute("data-register-edit-key") === "carryForward") {
          event.preventDefault();
          var budgetUi = window.UOS && window.UOS.ProgramBudgetUI;
          var carryRecordId = pillBtn.getAttribute("data-register-edit-id") || state.selectedId;
          if (pillBtn.getAttribute("data-register-value") === "true") {
            if (budgetUi && typeof budgetUi.openCarryForward === "function") budgetUi.openCarryForward(carryRecordId);
            return;
          }
          if (budgetUi && typeof budgetUi.hasConfirmedCarryForward === "function" && budgetUi.hasConfirmedCarryForward(carryRecordId)) {
            if (window.UOS.toast) window.UOS.toast("Confirmed carry-forward is recorded in the budget ledger and cannot be cleared here.", "info");
            return;
          }
        }
        handleFieldEdit(pillBtn);
        var wrap = pillBtn.closest(".program-register-pill-slider");
        if (wrap) {
          wrap.querySelectorAll(".program-register-pill-btn").forEach(function (btn) {
            var active = (btn === pillBtn);
            btn.classList.toggle("is-active", active);
            btn.setAttribute("aria-pressed", String(active));
          });
        }
        return;
      }
      var delRecordBtn = event.target.closest("[data-register-delete-id]");
      if (delRecordBtn) {
        event.preventDefault();
        event.stopPropagation();
        var recordId = delRecordBtn.getAttribute("data-register-delete-id");
        deleteRegisterRecord(recordId, delRecordBtn);
        return;
      }
      var cancelDelete = event.target.closest("[data-register-delete-cancel]");
      if (cancelDelete) { event.preventDefault(); closeDeleteDialog(); return; }
      var confirmDelete = event.target.closest("[data-register-delete-confirm]");
      if (confirmDelete) { event.preventDefault(); confirmDeleteRegisterRecord(); return; }
      var actionBtn = event.target.closest("[data-register-action]");
      if (actionBtn) {
        if (actionBtn.disabled || actionBtn.getAttribute("aria-disabled") === "true") {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
    var actionKey = actionBtn.getAttribute("data-register-action");
    if (actionKey === "allocate-budget") {
      event.preventDefault();
      event.stopPropagation();
      if (window.UOS && window.UOS.ProgramBudgetUI) window.UOS.ProgramBudgetUI.openAllocation(actionBtn.getAttribute("data-register-record") || state.selectedId);
      return;
    }
        if (actionKey === "open-project") {
          var projId = actionBtn.getAttribute("data-register-project-id");
          if (projId) handleOpenProject(projId);
          return;
        }
        if (actionKey === "create-project") {
          var forId = actionBtn.getAttribute("data-register-for") || state.selectedId;
          var forRecord = state.records.find(function (r) { return r.id === forId; });
          if (forRecord) handleCreateProject(forRecord);
          return;
        }
        var recordId = actionBtn.getAttribute("data-register-record") || state.selectedId;
        if (!recordId) return;
        var token = MODULE_ACTION_TOKENS.find(function (tok) { return tok.key === actionKey; });
    var targetDest = token ? token.dest : actionKey;
    var recordObj = state.records.find(function (r) { return r.id === recordId; });
    var linkedProject = buildLinkedProject(state.workspace, recordObj);
    var contextEntityId = recordId;
    if (targetDest && targetDest !== "register") {
      document.body.setAttribute("data-register-module-navigation-pending", targetDest);
    }
    state.selectedId = recordId;
        state.mode = "detail";
        renderMode();
        renderTable();
        if (targetDest && window.UOS && window.UOS.ProgramApp) {
          if (targetDest === "map" && window.UOS.ProgramMapController && typeof window.UOS.ProgramMapController.setCameraFocusIntent === "function") {
            window.UOS.ProgramMapController.setCameraFocusIntent(contextEntityId);
          }
          window.UOS.ProgramApp.updateWorkspace(function (candidate) {
            candidate.workspace = candidate.workspace || {};
            candidate.workspace.selectedEntityId = contextEntityId;
            candidate.workspace.selectedProjectId = linkedProject ? linkedProject.id : "";
            candidate.workspace.selectedJobId = "";
            candidate.workspace.selectedApplicationId = recordObj && recordObj.owner === "NSA" ? recordId : "";
            candidate.workspace.selectedCostingId = targetDest === "costing" ? contextEntityId : "";
            if (recordObj && (recordObj.owner === "NSA" || recordObj.owner === "EVT")) candidate.workspace.ownerMode = recordObj.owner;
            candidate.workspace.costing = candidate.workspace.costing || {};
            candidate.workspace.costing.mode = recordObj && recordObj.owner === "EVT" ? "events" : "applications";
            candidate.workspace.costing.selectedProjectId = linkedProject ? linkedProject.id : "";
            candidate.workspace.planner = candidate.workspace.planner || {};
            candidate.workspace.planner.selectedProjectId = linkedProject ? linkedProject.id : "";
            candidate.workspace.map = candidate.workspace.map || {};
            candidate.workspace.map.selectedRegisterId = contextEntityId;
            candidate.workspace.map.selectedProjectId = linkedProject ? linkedProject.id : "";
            if (targetDest === "map") {
              // Register row actions always enter Space Map in Register context.
              // Existing Project geometry must not silently hijack the user's intent.
              candidate.workspace.map.scopeMode = "register";
              candidate.workspace.map.selectedLocationId = "";
              candidate.workspace.map.selectedGeometryId = "";
              candidate.workspace.map.inspectorMode = "register";
            }

            // Navigation never promotes a Register record. Project creation is
            // reserved for the explicit Create Delivery Project action.
            return candidate;
          }).then(function () {
            if (typeof window.UOS.ProgramApp.navigate === "function") {
              window.UOS.ProgramApp.navigate(targetDest);
            }
          });
        }
        return;
      }
      var pill = event.target.closest("[data-register-pane-mode]");
      if (pill) {
        var mode = pill.getAttribute("data-register-pane-mode");
        state.filters.ownership = mode === "events" ? "EVT" : "NSA";
        state.filters.statuses = [];
        var ownershipSelect = one("[data-register-ownership]");
        if (ownershipSelect) ownershipSelect.value = state.filters.ownership;
        state.selectedId = null;
        updatePillPicker();
        readControls();
        return;
      }
      var statusFilterBtn = event.target.closest("[data-register-status-filter]");
      if (statusFilterBtn) {
        var statusVal = statusFilterBtn.getAttribute("data-register-status-filter");
        state.filters.statuses = Array.isArray(state.filters.statuses) ? state.filters.statuses : [];
        var existingIndex = -1;
        for (var i = 0; i < state.filters.statuses.length; i++) {
          if (text(state.filters.statuses[i]).toLowerCase() === statusVal.toLowerCase()) {
            existingIndex = i;
            break;
          }
        }
        if (existingIndex >= 0) {
          state.filters.statuses.splice(existingIndex, 1);
        } else {
          state.filters.statuses.push(statusVal);
        }
        readControls();
        return;
      }
      var row = event.target.closest("[data-register-record]");
      if (row) {
        var registerKey = row.getAttribute("data-disclosure-key") || "register:" + row.getAttribute("data-register-record");
        var disclosureApi = window.UOS && window.UOS.ProgramDisclosureRows;
        if (disclosureApi && typeof disclosureApi.isOpen === "function" && disclosureApi.isOpen(registerKey)) {
          var finishRegisterSelection = function () { showDetail(row.getAttribute("data-register-record")); };
          if (typeof disclosureApi.afterOpen !== "function" || !disclosureApi.afterOpen(registerKey, finishRegisterSelection)) finishRegisterSelection();
        }
      }
      else if (event.target.closest("[data-register-back]")) backToList();
    });

    function handlePdfFile(file) {
      if (!file) return;
      var dataSettings = typeof window !== "undefined" && window.UOS && window.UOS.ProgramDataSettings;
      var controller = dataSettings && typeof dataSettings.mount === "function" ? dataSettings.mount() : null;
      if (controller && typeof controller.inspectFile === "function") {
        controller.inspectFile(file).catch(function (err) {
          console.warn("PDF inspection failed:", err);
          if (window.UOS && window.UOS.toast) window.UOS.toast(err.message || "The Nature Strip PDF could not be inspected.", "error");
        });
      } else if (window.UOS && window.UOS.toast) {
        window.UOS.toast("The Nature Strip PDF importer is unavailable.", "error");
      }
    }

    var pdfDropzone = one("[data-register-pdf-dropzone]");
    var pdfInput = one("[data-register-pdf-input]");

    if (pdfDropzone) {
      pdfDropzone.addEventListener("click", function () {
        if (pdfInput) pdfInput.click();
      });

      pdfDropzone.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (pdfInput) pdfInput.click();
        }
      });

      ["dragenter", "dragover"].forEach(function (eventName) {
        pdfDropzone.addEventListener(eventName, function (e) {
          e.preventDefault();
          e.stopPropagation();
          pdfDropzone.classList.add("is-dragover");
        });
      });

      ["dragleave", "dragend"].forEach(function (eventName) {
        pdfDropzone.addEventListener(eventName, function (e) {
          e.preventDefault();
          e.stopPropagation();
          pdfDropzone.classList.remove("is-dragover");
        });
      });

      pdfDropzone.addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
        pdfDropzone.classList.remove("is-dragover");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          var droppedFile = e.dataTransfer.files[0];
          var lowerName = (droppedFile.name || "").toLowerCase();
          if (lowerName.lastIndexOf(".pdf") === lowerName.length - 4) {
            handlePdfFile(droppedFile);
          } else if (typeof window !== "undefined" && window.UOS && window.UOS.ProgramDataSettings && typeof window.UOS.ProgramDataSettings.inspectFile === "function") {
            window.UOS.ProgramDataSettings.inspectFile(droppedFile).catch(function () {});
          }
        }
      });
    }

    if (pdfInput) {
      pdfInput.addEventListener("change", function () {
        if (pdfInput.files && pdfInput.files[0]) {
          var selectedFile = pdfInput.files[0];
          var lowerName = (selectedFile.name || "").toLowerCase();
          if (lowerName.lastIndexOf(".pdf") === lowerName.length - 4) {
            handlePdfFile(selectedFile);
          } else if (typeof window !== "undefined" && window.UOS && window.UOS.ProgramDataSettings && typeof window.UOS.ProgramDataSettings.inspectFile === "function") {
            window.UOS.ProgramDataSettings.inspectFile(selectedFile).catch(function () {});
          }
        }
        pdfInput.value = "";
      });
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !event.defaultPrevented && window.UOS && window.UOS.ProgramDisclosureRows &&
          window.UOS.ProgramDisclosureRows.activeKey("register").indexOf("register:") === 0) {
        event.preventDefault();
        if (typeof window.UOS.ProgramDisclosureRows.closeScope === "function") window.UOS.ProgramDisclosureRows.closeScope("register");
        else window.UOS.ProgramDisclosureRows.closeAll();
        return;
      }
      if (state.mode === "list" && (event.key === "ArrowDown" || event.key === "ArrowUp") && event.target.closest('[data-program-view="register"]')) {
        event.preventDefault(); moveFocus(event.key === "ArrowDown" ? 1 : -1);
      }
    });
    document.addEventListener("scroll", function (event) {
      if (!event.target.matches || !event.target.matches("[data-register-list]")) return;
      state.scrollTop = event.target.scrollTop;
      if (state.scrollTimer) clearTimeout(state.scrollTimer);
      state.scrollTimer = setTimeout(function () { state.scrollTimer = null; persist(); }, 200);
    }, true);
    document.addEventListener("uos:program-ready", function (event) {
      var workspace = event.detail && event.detail.workspace;
      if (!workspace || !workspace.workspace || ["register", "budget", "planner", "map", "costing", "scheduler", "quotes"].indexOf(workspace.workspace.destination) < 0) return;
      update(workspace);
    });
  }

  
  function handlePrivacyChanged() {
    renderTable();
    renderMode();
  }
  if (typeof document !== "undefined") document.addEventListener("uos:privacy-changed", handlePrivacyChanged);

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true }); else bind();
  }
  return { recordsFrom: recordsFrom, selectRecords: selectRecords, stateFromWorkspace: stateFromWorkspace, update: update, showDetail: showDetail, backToList: backToList, snapshot: function () { return clone(state); }, buildLinkedProject: buildLinkedProject, buildLinkedProjects: buildLinkedProjects, isAttentionStatus: isAttentionStatus };
}));
