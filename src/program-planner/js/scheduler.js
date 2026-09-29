(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var root;
  var state = { workspace: null, jobs: [], visible: [], mode: "week", cursor: "", selectedId: "", selectedProjectId: "", panelMode: "projects", detail: false, scrollTop: 0, focusList: false, sourceFilter: "all" };
  var schedulerAppConfig = UOS.ProgramAppConfig && typeof UOS.ProgramAppConfig.current === "function" ? UOS.ProgramAppConfig.current() : null;
  var SESSION_SCROLL_KEY = "uos.scheduler." + (schedulerAppConfig && schedulerAppConfig.appId || "legacy") + ".scrollTop";
  function readSessionScroll() { try { return Number(window.sessionStorage.getItem(SESSION_SCROLL_KEY)) || 0; } catch (error) { return 0; } }
  function writeSessionScroll(value) { try { window.sessionStorage.setItem(SESSION_SCROLL_KEY, String(Number(value) || 0)); } catch (error) { /* optional session state */ } }
  var weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function one(selector) { return root && root.querySelector(selector); }
  function all(selector) { return root ? Array.prototype.slice.call(root.querySelectorAll(selector)) : []; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function model() { return UOS.ProgramSchedulerModel; }
  function dateAt(iso) { return new Date(iso + "T00:00:00Z"); }
  function dateString(date) { return date.toISOString().slice(0, 10); }
  function addMonths(iso, count) { var date = dateAt(iso); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + count); return dateString(date); }
  function category(job) { return text(job.category || job.workType || job.payload && (job.payload.category || job.payload.workType)) || job.categoryLabel; }
  function status(job) { var api = UOS.ProgramStatus; return api ? api.labelFor("job", job.status) : (text(job.status) || "Not set"); }
  function crew(job) { return text(job.crewName || job.crewId || job.crew) || "Unassigned"; }
  function location(job) { return text(job.location || job.locationId) || "Unassigned"; }
  function title(job) { return text(job.title || job.name) || "Untitled job"; }
  function sourceLabel(job) { var api = model(); if (api && typeof api.sourceLabel === "function") return api.sourceLabel(job); var value = text(job.sourceKind).toLowerCase(); return value === "calculator" ? "Calculator" : value === "spacemap" || value === "space map" ? "Space Map" : value === "planner" ? "Planner" : "Legacy"; }
  function workLabel(job) { return sourceLabel(job) === "Calculator" ? "Labour" : "Job"; }
  function statusSlug(value) { return text(value || "Draft").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "draft"; }
  function statusPill(value) { var node = document.createElement("span"); node.className = "program-status-pill status--" + statusSlug(value); node.textContent = text(value || "Draft"); return node; }
  function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function extractLocationAddress(rec) {
    if (!rec) return "";
    var candidates = [rec.address, rec.vergeAddress, rec.siteLocation];
    for (var i = 0; i < candidates.length; i++) {
      var s = text(candidates[i]);
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
  function getRecordById(id) {
    if (!id) return null;
    if (root && root.UOS && root.UOS.ProgramApp && typeof root.UOS.ProgramApp.entityById === "function") {
      var ent = root.UOS.ProgramApp.entityById(id);
      if (ent) return ent;
    }
    if (root && root.UOS && root.UOS.ProgramModel && typeof root.UOS.ProgramModel.getRegisterRecord === "function") {
      var reg = root.UOS.ProgramModel.getRegisterRecord(id);
      if (reg) return reg;
    }
    var workspace = state.workspace || {};
    var entities = workspace.entities || {};
    var collections = [entities.applications, entities.events, entities.projects, entities.jobs];
    for (var i = 0; i < collections.length; i++) {
      var list = collections[i];
      if (Array.isArray(list)) {
        var found = list.find(function (item) { return item && item.id === id; });
        if (found) return found;
      }
    }
    return null;
  }
  function resolveLocationText(item) {
    if (!item) return "No location address specified";
    var directLoc = extractLocationAddress(item);

    var regId = item.applicationId || item.eventId;
    if (!regId && item.projectId) {
      var parentProj = getRecordById(item.projectId);
      if (parentProj) {
        regId = parentProj.applicationId || parentProj.eventId;
        if (!directLoc) directLoc = extractLocationAddress(parentProj);
      }
    }

    if (regId) {
      var regRec = getRecordById(regId);
      var regLoc = extractLocationAddress(regRec);
      if (regLoc) return regLoc;
    }

    if (directLoc) return directLoc;
    return "No location address specified";
  }
  function renderLocationRow(locDisplay) {
    var div = document.createElement("div");
    div.className = "program-event-card__loc-row";
    div.setAttribute("title", locDisplay);
    div.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>' +
      '<span>' + esc(locDisplay) + '</span>';
    return div;
  }
  function normalizedJob(raw, index) {
    if (text(raw && raw.startDate)) return model().normalizeJob(raw, index);
    return Object.assign({}, raw, { id: text(raw && raw.id), owner: text(raw && raw.owner), ownerLabel: model().ownerLabel(raw && raw.owner), categoryLabel: model().ownerLabel(raw && raw.owner), title: title(raw || {}), startDate: "", endDate: "", startTime: "", endTime: "", allDay: true, durationMinutes: 0, crewId: text(raw && (raw.crewId || raw.crew)), location: text(raw && raw.location), _startMs: Number.POSITIVE_INFINITY, _endMs: Number.POSITIVE_INFINITY, _unscheduled: true });
  }
  function filterValue(name) {
    var values = state.workspace && state.workspace.workspace && state.workspace.workspace.scheduler && state.workspace.workspace.scheduler.filters && state.workspace.workspace.scheduler.filters[name];
    if (Array.isArray(values)) return text(values[0]) || "all";
    return text(values) || "all";
  }
  function periodDays() { return state.mode === "month" ? model().monthGrid(state.cursor) : model().weekDays(state.cursor).map(function (date) { return { date: date, inMonth: true }; }); }
  function periodLabel(days) {
    if (!days.length) return "";
    var formatter = new Intl.DateTimeFormat("en-AU", state.mode === "month" ? { month: "long", year: "numeric", timeZone: "UTC" } : { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
    return state.mode === "month" ? formatter.format(dateAt(state.cursor)) : formatter.format(dateAt(days[0].date)) + " – " + formatter.format(dateAt(days[6].date));
  }
  function optionValues(accessor) {
    var seen = {};
    return state.jobs.map(accessor).filter(function (value) { value = text(value); if (!value || value === "Unassigned" || seen[value]) return false; seen[value] = true; return true; }).sort(function (a, b) { return a.localeCompare(b); });
  }
  function fillSelect(name, label, values) {
    var select = one('[data-scheduler-filter="' + name + '"]');
    if (!select) return;
    var current = filterValue(name);
    while (select.firstChild) select.removeChild(select.firstChild);
    var base = document.createElement("option"); base.value = "all"; base.textContent = label; select.appendChild(base);
    values.forEach(function (value) { var option = document.createElement("option"); option.value = value; option.textContent = value; select.appendChild(option); });
    select.value = values.indexOf(current) >= 0 ? current : "all";
  }
  function conflictMap() {
    var result = {};
    var owner = activeOwner();
    model().detectConflicts(state.jobs.filter(function (job) { return !job._unscheduled && job.owner === owner; })).forEach(function (conflict) {
      conflict.jobIds.forEach(function (id) { result[id] = (result[id] || []).concat(conflict.labels.filter(function (label) { return (result[id] || []).indexOf(label) < 0; })); });
    });
    return result;
  }
  function getAllProjects() {
    if (!state.workspace || !UOS.ProgramModel || typeof UOS.ProgramModel.getProjects !== "function") return [];
    var evt = UOS.ProgramModel.getProjects(state.workspace, "EVT");
    var nsa = UOS.ProgramModel.getProjects(state.workspace, "NSA");
    var combined = evt.concat(nsa);
    var seen = {};
    return combined.filter(function (p) {
      if (!p || !p.id || seen[p.id]) return false;
      seen[p.id] = true;
      return true;
    });
  }

  function activeOwner() {
    var ownerMode = state.workspace && state.workspace.workspace && state.workspace.workspace.ownerMode;
    return ownerMode === "EVT" ? "EVT" : "NSA";
  }

  function getProjectsForActiveOwner() {
    var owner = activeOwner();
    return getAllProjects().filter(function (project) { return project.owner === owner; });
  }

  function isJobInProject(job, proj) {
    if (!job || !proj) return false;
    if (job.projectId && job.projectId === proj.id) return true;
    if (proj.eventId && job.eventId === proj.eventId) return true;
    if (proj.applicationId && job.applicationId === proj.applicationId) return true;
    return false;
  }

  function jobsForDay(date) {
    return state.visible.filter(function (job) { return !job._unscheduled && job.startDate <= date && job.endDate >= date; });
  }

  function timeLabel(job) {
    if (job._unscheduled || !job.startDate) return "Unscheduled";
    if (job.startTime && job.endTime && !job.allDay) return job.startTime + " – " + job.endTime;
    if (job.startTime && !job.endTime && !job.allDay) return "From " + job.startTime;
    if (job.allDay) return "All day";
    return job.startTime && job.endTime ? job.startTime + " – " + job.endTime : "All day";
  }
  function priorityRank(value) { var ranks = { critical: 0, urgent: 0, high: 1, medium: 2, normal: 2, low: 3 }; var key = text(value).toLowerCase(); return Object.prototype.hasOwnProperty.call(ranks, key) ? ranks[key] : 4; }
  function ownerBadge(job) {
    return document.createDocumentFragment();
  }

  function calendarJob(job, conflicts) {
    var button = document.createElement("button"); button.type = "button";
    var selected = job.id === state.selectedId;
    var activeProject = getProjectsForActiveOwner().find(function (project) { return project.id === state.selectedProjectId; }) || null;
    var linked = Boolean(activeProject && isJobInProject(job, activeProject));
    var jobProject = getProjectsForActiveOwner().find(function (project) { return isJobInProject(job, project); }) || null;
    var register = jobProject && getRecordById(jobProject.applicationId || jobProject.eventId);
    var contextLabel = [title(job), register && (register.title || register.name), jobProject && (jobProject.title || jobProject.name), timeLabel(job)].filter(Boolean).join(", ");
    button.className = "program-calendar-job " + (linked ? "is-linked-project" : "is-other-project") + (conflicts[job.id] ? " is-conflict" : "") + (selected ? " is-selected" : "");
    button.setAttribute("data-scheduler-job", job.id); button.setAttribute("aria-label", contextLabel + (conflicts[job.id] ? ", Conflict: " + conflicts[job.id].join(", ") : ""));
    button.title = contextLabel;
    if (selected) button.setAttribute("aria-current", "true");
    var name = document.createElement("span"); name.className = "program-calendar-job__title"; name.textContent = title(job);
    button.appendChild(name);
    return button;
  }
  function renderCalendar(conflicts) {
    var calendar = one("[data-scheduler-calendar]"); if (!calendar) return;
    var days = periodDays(); while (calendar.firstChild) calendar.removeChild(calendar.firstChild);
    calendar.className = "program-calendar program-calendar--" + state.mode;
    weekdays.forEach(function (label) { var node = document.createElement("div"); node.className = "program-calendar__weekday"; node.textContent = label; calendar.appendChild(node); });
 var activeProject = getProjectsForActiveOwner().find(function (project) { return project.id === state.selectedProjectId; });
 days.forEach(function (entry) {
 var activeDelivery = Boolean(activeProject && jobsForDay(entry.date).some(function (job) { return isJobInProject(job, activeProject) && ["draft", "scheduled"].indexOf(text(job.status).toLowerCase()) >= 0; }));
 var day = document.createElement("section"); day.className = "program-calendar__day" + (!entry.inMonth ? " is-outside" : "") + (entry.date === today() ? " is-today" : "") + (activeDelivery ? " is-active-project-day" : ""); if (activeDelivery) day.setAttribute("data-active-project-day", "true");
      day.setAttribute("aria-label", new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(dateAt(entry.date)));
      var date = document.createElement("time"); date.className = "program-calendar__date"; date.dateTime = entry.date; date.textContent = String(Number(entry.date.slice(8))); day.appendChild(date);
      jobsForDay(entry.date).forEach(function (job) { day.appendChild(calendarJob(job, conflicts)); }); calendar.appendChild(day);
    });
    var label = one("[data-scheduler-period]"); if (label) label.textContent = periodLabel(days);
  }
  function renderUnscheduled(conflicts) {
    var calendar = one("[data-scheduler-calendar]");
    if (!calendar || !calendar.parentNode) return;
    var strip = one("[data-scheduler-unscheduled]");
    if (!strip) {
      strip = document.createElement("section");
      strip.className = "program-scheduler-unscheduled";
      strip.setAttribute("data-scheduler-unscheduled", "");
      strip.setAttribute("aria-label", "Unscheduled jobs");
      calendar.parentNode.insertBefore(strip, calendar);
    }
    strip.replaceChildren();
    var jobs = state.visible.filter(function (job) { return job._unscheduled; });
    strip.hidden = jobs.length === 0;
    if (!jobs.length) return;
    var label = document.createElement("strong"); label.className = "program-scheduler-unscheduled__label"; label.textContent = "Unscheduled"; strip.appendChild(label);
    jobs.forEach(function (job) { strip.appendChild(calendarJob(job, conflicts)); });
  }
  function renderList(conflicts) {
    // Sync Job Scheduler mini toolbar prerequisites
    var schedToolbar = one("[data-scheduler-mini-toolbar]");
    if (schedToolbar && window.UOS && window.UOS.ProgramApp && typeof window.UOS.ProgramApp.syncToolbarPrerequisites === "function") {
      var selectedPrj = (getProjectsForActiveOwner() || []).find(function (p) { return p.id === state.selectedProjectId; });
      var ws = state.workspace;
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
      window.UOS.ProgramApp.syncToolbarPrerequisites(schedToolbar, {
        currentModule: "scheduler",
        hasProject: Boolean(selectedPrj),
        hasMap: hasGeom,
        hasJobs: hasJb,
        hasCostedJobs: hasCosted,
        linkedProject: selectedPrj
      });
    }
    var list = one("[data-scheduler-list]"); if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    var drawerMode = document.body.hasAttribute("data-drawer-module");

    var projects = getProjectsForActiveOwner();
    var selectedProject = state.selectedProjectId ? projects.find(function (p) { return p.id === state.selectedProjectId; }) : null;
    if (state.selectedProjectId && !selectedProject) state.selectedProjectId = "";

    var headerContainer = one("[data-scheduler-list-mode] .program-scheduler-inspector__head");
    var empty = one("[data-scheduler-empty]");

    if (!drawerMode && (state.panelMode !== "jobs" || !selectedProject)) {
      if (headerContainer) {
        while (headerContainer.firstChild) headerContainer.removeChild(headerContainer.firstChild);
        var headTitle = document.createElement("div");
        headTitle.innerHTML = '<p class="uos-eyebrow">Schedule</p><h3>Delivery Projects</h3>';
        headerContainer.appendChild(headTitle);
      }

      var jobsByProject = Object.create(null);
      state.jobs.forEach(function (j) {
        var pId = j.projectId || (j.payload && j.payload.projectId);
        if (pId) {
          if (!jobsByProject[pId]) jobsByProject[pId] = [];
          jobsByProject[pId].push(j);
        }
      });

      // Render filter pills in [data-status-filter-pills="scheduler-sidebar"]
      var pillsContainer = one('[data-status-filter-pills="scheduler-sidebar"]');
      if (pillsContainer) {
        var allCount = projects.length;
        var withJobsCount = projects.filter(function (p) {
          var pJobs = jobsByProject[p.id] || state.jobs.filter(function (j) { return isJobInProject(j, p); });
          return pJobs.length > 0;
        }).length;
        var noJobsCount = projects.filter(function (p) {
          var pJobs = jobsByProject[p.id] || state.jobs.filter(function (j) { return isJobInProject(j, p); });
          return pJobs.length === 0;
        }).length;

    var possibleStatuses = UOS.ProgramStatus ? UOS.ProgramStatus.vocabulary("job").map(function (item) { return item.label; }) : ["Draft", "Scheduled", "In Progress", "Completed", "Cancelled"];
        projects.forEach(function (p) {
          var s = text(p.status || "").trim();
          if (s && possibleStatuses.indexOf(s) < 0) possibleStatuses.push(s);
        });

        var pillsHtml = '';
        pillsHtml += '<button type="button" class="program-status-pill-filter' + (state.sidebarJobFilter === "all" || !state.sidebarJobFilter ? ' is-active' : '') + '" data-scheduler-sidebar-job-filter="all" aria-pressed="' + String(state.sidebarJobFilter === "all" || !state.sidebarJobFilter) + '">' +
          '<span>All</span><span class="program-status-pill-count">' + allCount + '</span></button>';
        pillsHtml += '<button type="button" class="program-status-pill-filter status--planned' + (state.sidebarJobFilter === "with-jobs" ? ' is-active' : '') + '" data-scheduler-sidebar-job-filter="with-jobs" aria-pressed="' + String(state.sidebarJobFilter === "with-jobs") + '">' +
          '<span>With Jobs</span><span class="program-status-pill-count">' + withJobsCount + '</span></button>';
        pillsHtml += '<button type="button" class="program-status-pill-filter status--draft' + (state.sidebarJobFilter === "no-jobs" ? ' is-active' : '') + '" data-scheduler-sidebar-job-filter="no-jobs" aria-pressed="' + String(state.sidebarJobFilter === "no-jobs") + '">' +
          '<span>No Jobs</span><span class="program-status-pill-count">' + noJobsCount + '</span></button>';

        possibleStatuses.forEach(function (statusVal) {
          var slug = statusVal.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          var isActive = (state.sidebarStatusFilters || []).indexOf(statusVal.toLowerCase()) >= 0;
          var count = projects.filter(function (p) {
            var s = text(p.status || "").trim();
            return s.toLowerCase() === statusVal.toLowerCase();
          }).length;
          if (count > 0 || isActive) {
            pillsHtml += '<button type="button" class="program-status-pill-filter status--' + esc(slug) + (isActive ? ' is-active' : '') + '" data-scheduler-sidebar-status-filter="' + esc(statusVal) + '" aria-pressed="' + String(isActive) + '">' +
              '<span>' + esc(statusVal) + '</span><span class="program-status-pill-count">' + count + '</span></button>';
          }
        });

        pillsContainer.innerHTML = pillsHtml;

        var badge = one('[data-filter-drawer-badge="scheduler-sidebar"]');
        if (badge) {
          var actCount = (state.sidebarSearchQuery ? 1 : 0) + (state.sidebarJobFilter && state.sidebarJobFilter !== "all" ? 1 : 0) + (state.sidebarStatusFilters ? state.sidebarStatusFilters.length : 0);
          badge.textContent = String(actCount);
          badge.hidden = (actCount === 0);
        }
      }

      var visibleProjects = projects.filter(function (proj) {
        var projJobs = jobsByProject[proj.id] || state.jobs.filter(function (j) { return isJobInProject(j, proj); });
        if (state.sidebarJobFilter === "with-jobs" && projJobs.length === 0) return false;
        if (state.sidebarJobFilter === "no-jobs" && projJobs.length > 0) return false;
        if (state.sidebarStatusFilters && state.sidebarStatusFilters.length > 0) {
          var s = (proj.status || "Draft").toLowerCase();
          if (state.sidebarStatusFilters.indexOf(s) < 0) return false;
        }
        if (state.sidebarSearchQuery) {
          var q = state.sidebarSearchQuery;
          var t = (proj.title || proj.name || "").toLowerCase();
          var id = (proj.id || "").toLowerCase();
          var aid = (proj.applicationId || "").toLowerCase();
          var eid = (proj.eventId || "").toLowerCase();
          var loc = resolveLocationText(proj).toLowerCase();
          if (t.indexOf(q) < 0 && id.indexOf(q) < 0 && aid.indexOf(q) < 0 && eid.indexOf(q) < 0 && loc.indexOf(q) < 0) return false;
        }
        return true;
      });

      visibleProjects.forEach(function (proj) {
        var projJobs = jobsByProject[proj.id] || state.jobs.filter(function (j) { return isJobInProject(j, proj); });
        var owner = proj.owner === "EVT" ? "EVT" : "NSA";
        var isSelected = state.selectedProjectId === proj.id;
        var row = document.createElement("div");
        row.className = "program-scheduler-row program-scheduler-project-card" + (isSelected ? " is-selected" : "");
        row.setAttribute("data-scheduler-project", proj.id);
        row.setAttribute("data-owner", owner);
        row.setAttribute("role", "option");
        row.setAttribute("tabindex", "0");
        row.setAttribute("aria-selected", String(isSelected));

        var head = document.createElement("div");
        head.className = "program-scheduler-project-card__head";

        var headLeft = document.createElement("div");
        headLeft.className = "program-scheduler-project-card__head-left";

        var badge = document.createElement("div");
        badge.className = "program-scheduler-project-card__icon-badge program-scheduler-project-card__icon-badge--" + owner.toLowerCase();
        badge.innerHTML = owner === "EVT"
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m12 13 1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2-1.5-1.5 2-.3Z"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>';

        var titleEl = document.createElement("strong");
        titleEl.className = "program-scheduler-project-card__title";
        titleEl.textContent = proj.title || proj.name || proj.id;

        headLeft.appendChild(badge);
        headLeft.appendChild(titleEl);

        /* This is a Project card, not a Job row. Make its lifecycle domain
           explicit so a Draft Project cannot be mistaken for a draft Job. */
        var statusNode = statusPill(proj.status || "Active");
        statusNode.classList.add("program-scheduler-project-card__status");
        statusNode.setAttribute("data-scheduler-project-status", proj.id);
        statusNode.textContent = "Project status: " + status(proj.status || "Active");
        head.appendChild(headLeft);
        head.appendChild(statusNode);

        var regIdVal = proj.applicationId || proj.eventId || "";
        var div1 = document.createElement("div");
        div1.className = "program-scheduler-project-card__divider";

        var idsEl = document.createElement("div");
        idsEl.className = "program-scheduler-project-card__ids";
        idsEl.innerHTML = (regIdVal ?
          '<div class="program-scheduler-project-card__id-row"><svg viewBox="0 0 24 24" aria-hidden="true" class="program-scheduler-project-card__id-icon"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg><span class="program-scheduler-project-card__id-label">Register ID:</span><span class="program-scheduler-project-card__id-value">' + esc(regIdVal) + '</span></div>' : '') +
          '<div class="program-scheduler-project-card__id-row"><svg viewBox="0 0 24 24" aria-hidden="true" class="program-scheduler-project-card__id-icon"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span class="program-scheduler-project-card__id-label">Project ID:</span><span class="program-scheduler-project-card__id-value">' + esc(proj.id) + '</span></div>';

        var div2 = document.createElement("div");
        div2.className = "program-scheduler-project-card__divider";

        var locSec = document.createElement("div");
        locSec.className = "program-scheduler-project-card__loc-section";
        locSec.innerHTML = '<div class="program-scheduler-project-card__loc-row"><svg viewBox="0 0 24 24" aria-hidden="true" class="program-scheduler-project-card__loc-pin"><path d="M12 21.7C17.3 17 20 13 20 9a8 8 0 1 0-16 0c0 4 2.7 8 8 12.7z"/><circle cx="12" cy="9" r="3"/></svg><span class="program-scheduler-project-card__loc-text">' + esc(resolveLocationText(proj)) + '</span></div>';

        var div3 = document.createElement("div");
        div3.className = "program-scheduler-project-card__divider";

        var actions = document.createElement("span");
        actions.className = "program-scheduler-project-card__actions";
        var showJobs = document.createElement("button");
        showJobs.type = "button";
        showJobs.className = "uos-button uos-button--secondary uos-button--sm program-scheduler-project-card__action";
        showJobs.setAttribute("data-scheduler-show-jobs", proj.id);
        showJobs.textContent = projJobs.length ? "Show " + projJobs.length + (projJobs.length === 1 ? " Job" : " Jobs") : "No Jobs Assigned";
        actions.appendChild(showJobs);

        row.appendChild(head);
        row.appendChild(div1);
        row.appendChild(idsEl);
        row.appendChild(div2);
        row.appendChild(locSec);
        row.appendChild(div3);
        row.appendChild(actions);

        list.appendChild(row);
      });

      if (empty) {
        empty.hidden = visibleProjects.length > 0;
        if (visibleProjects.length === 0 && projects.length > 0) {
          var pEmpty = empty.querySelector("p");
          if (pEmpty) pEmpty.textContent = "No delivery projects match your search or filter set.";
        }
      }
    } else {
      /* "Show Jobs" is a Project relationship view, so it must use the same
         complete Job collection as the count shown on the Project card. The
         calendar's date/status/crew filters remain scoped to the calendar. */
      var projectJobs = state.jobs.filter(function (j) {
        var inScope = drawerMode ? j.owner === activeOwner() : isJobInProject(j, selectedProject);
        if (!inScope || (state.sourceFilter !== "all" && sourceLabel(j) !== state.sourceFilter)) return false;
        if (!drawerMode || !state.sidebarSearchQuery) return true;
        var query = state.sidebarSearchQuery;
        return [title(j), j.id, j.applicationId, j.eventId, status(j), resolveLocationText(j)]
          .some(function (value) { return text(value).toLowerCase().indexOf(query) >= 0; });
      });

      if (headerContainer) {
        while (headerContainer.firstChild) headerContainer.removeChild(headerContainer.firstChild);
        if (drawerMode) {
          var jobsTitle = document.createElement("div");
          jobsTitle.innerHTML = '<p class="uos-eyebrow">Schedule</p><h3>Jobs</h3>';
          headerContainer.appendChild(jobsTitle);
        } else {
          var backButton = document.createElement("button");
          backButton.type = "button";
          backButton.className = "program-scheduler-back";
          backButton.setAttribute("data-scheduler-back-projects", "");
          backButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>Back to Projects</span>';
          headerContainer.appendChild(backButton);
        }
      }

      if (drawerMode) {
        var jobListHeader = document.createElement("div");
        jobListHeader.className = "program-scheduler-job-register__header";
        jobListHeader.setAttribute("aria-hidden", "true");
        jobListHeader.innerHTML = "<span>Job</span><span>Schedule</span><span>Status</span>";
        list.appendChild(jobListHeader);
      }

      projectJobs.forEach(function (job) {
        var owner = job.owner === "EVT" ? "EVT" : "NSA";
        var isSelected = state.selectedId === job.id;
        var hasConflict = Boolean(conflicts[job.id]);
        if (drawerMode) {
          var compactRow = document.createElement("button");
          compactRow.type = "button";
          compactRow.className = "program-scheduler-job-register__row" + (hasConflict ? " is-conflict" : "") + (isSelected ? " is-selected" : "");
          compactRow.setAttribute("data-scheduler-job", job.id);
          compactRow.setAttribute("data-owner", owner);
          compactRow.setAttribute("data-disclosure-skip", "");
          compactRow.setAttribute("role", "option");
          compactRow.setAttribute("aria-selected", String(isSelected));
          compactRow.setAttribute("aria-label", title(job) + ", " + timeLabel(job) + ", " + status(job));
          var compactTitle = document.createElement("strong");
          compactTitle.textContent = title(job);
          var compactSchedule = document.createElement("span");
          compactSchedule.textContent = job.startDate ? job.startDate + " · " + timeLabel(job) : "—";
          compactRow.appendChild(compactTitle);
          compactRow.appendChild(compactSchedule);
          compactRow.appendChild(statusPill(status(job)));
          list.appendChild(compactRow);
          return;
        }
        var row = document.createElement("button");
        row.type = "button";
        row.className = "program-scheduler-row program-scheduler-job-card" + (hasConflict ? " is-conflict" : "") + (isSelected ? " is-selected" : "");
        row.setAttribute("role", "option");
        row.setAttribute("data-scheduler-job", job.id);
        row.setAttribute("data-owner", owner);
        row.setAttribute("aria-selected", String(isSelected));
        if (drawerMode) row.setAttribute("data-disclosure-skip", "");

        var head = document.createElement("div");
        head.className = "program-scheduler-job-card__head";

        var headLeft = document.createElement("div");
        headLeft.className = "program-scheduler-job-card__head-left";

        var badge = document.createElement("div");
        badge.className = "program-scheduler-job-card__icon-badge program-scheduler-job-card__icon-badge--" + owner.toLowerCase();
        badge.innerHTML = owner === "EVT"
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m12 13 1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2-1.5-1.5 2-.3Z"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>';

        var titleEl = document.createElement("strong");
        titleEl.className = "program-scheduler-job-card__title";
        titleEl.textContent = title(job);

        headLeft.appendChild(badge);
        headLeft.appendChild(titleEl);

        var statusNode = statusPill(status(job));
        head.appendChild(headLeft);
        head.appendChild(statusNode);

        var regId = job.applicationId || job.eventId || "";
        var div1 = document.createElement("div");
        div1.className = "program-scheduler-job-card__divider";

        var idsEl = document.createElement("div");
        idsEl.className = "program-scheduler-job-card__ids";
        idsEl.innerHTML = (regId ?
          '<div class="program-scheduler-job-card__id-row"><svg viewBox="0 0 24 24" aria-hidden="true" class="program-scheduler-job-card__id-icon"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg><span class="program-scheduler-job-card__id-label">Register ID:</span><span class="program-scheduler-job-card__id-value">' + esc(regId) + '</span></div>' : '') +
          '<div class="program-scheduler-job-card__id-row"><svg viewBox="0 0 24 24" aria-hidden="true" class="program-scheduler-job-card__id-icon"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg><span class="program-scheduler-job-card__id-label">Job ID:</span><span class="program-scheduler-job-card__id-value">' + esc(job.id) + '</span></div>';

        var div2 = document.createElement("div");
        div2.className = "program-scheduler-job-card__divider";

        var formattedJobDate = (window.UOS && window.UOS.imports && window.UOS.imports.formatDate) ? window.UOS.imports.formatDate(job.startDate) : (job.startDate || "Unscheduled");
        var timeText = (job.startDate ? formattedJobDate : "Unscheduled") + " · " + timeLabel(job);

        var locSec = document.createElement("div");
        locSec.className = "program-scheduler-job-card__loc-section";
        locSec.innerHTML = '<div class="program-scheduler-job-card__time-row"><svg viewBox="0 0 24 24" aria-hidden="true" class="program-scheduler-job-card__time-icon"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span class="program-scheduler-job-card__time-text">' + esc(timeText) + '</span></div>' +
          '<div class="program-scheduler-job-card__loc-row"><svg viewBox="0 0 24 24" aria-hidden="true" class="program-scheduler-job-card__loc-pin"><path d="M12 21.7C17.3 17 20 13 20 9a8 8 0 1 0-16 0c0 4 2.7 8 8 12.7z"/><circle cx="12" cy="9" r="3"/></svg><span class="program-scheduler-job-card__loc-text">' + esc(resolveLocationText(job)) + '</span></div>';

        var footer = document.createElement("div");
        footer.className = "program-scheduler-job-card__footer";
        footer.innerHTML = '<span class="program-card-pill program-card-pill--loc"><svg viewBox="0 0 24 24" class="program-card-pill-icon"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><span>' + esc(crew(job)) + '</span></span>' +
          '<span class="program-card-pill program-card-pill--poly"><svg viewBox="0 0 24 24" class="program-card-pill-icon"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/></svg><span>' + esc(category(job)) + '</span></span>' +
          '<span class="program-scheduler-source" data-scheduler-source="' + esc(sourceLabel(job)) + '" aria-label="Job source: ' + esc(sourceLabel(job)) + '">Source: ' + esc(sourceLabel(job)) + '</span>' +
          (hasConflict ? '<span class="program-conflict-badge">' + esc(conflicts[job.id].join(" · ")) + '</span>' : '');

        row.appendChild(head);
        row.appendChild(div1);
        row.appendChild(idsEl);
        row.appendChild(div2);
        row.appendChild(locSec);
        row.appendChild(footer);

        list.appendChild(row);
      });

      if (empty) empty.hidden = projectJobs.length > 0;
    }

    list.scrollTop = state.scrollTop;
    if (state.focusList && state.selectedId) { var selected = Array.prototype.find.call(list.querySelectorAll("[data-scheduler-job]"), function (node) { return node.getAttribute("data-scheduler-job") === state.selectedId; }); if (selected) selected.focus(); state.focusList = false; }
  }
  function field(list, label, value) { var row = document.createElement("div"); var dt = document.createElement("dt"); var dd = document.createElement("dd"); dt.textContent = label; dd.textContent = text(value) || "Not set"; row.appendChild(dt); row.appendChild(dd); list.appendChild(row); }
  function renderDetail(conflicts) {
    var job = state.jobs.find(function (item) { return item.id === state.selectedId; });
    var listMode = one("[data-scheduler-list-mode]"); var detail = one("[data-scheduler-detail]");
    state.detail = Boolean(state.detail && job); if (listMode) listMode.hidden = state.detail; if (detail) detail.hidden = !state.detail; if (!state.detail) return;
    var badge = one("[data-scheduler-detail-badge]"); if (badge) { while (badge.firstChild) badge.removeChild(badge.firstChild); }
    one("[data-scheduler-detail-owner]").textContent = workLabel(job) + " · " + job.id;
    one("[data-scheduler-detail-title]").textContent = title(job);
    var notices = one("[data-scheduler-conflicts]"); while (notices.firstChild) notices.removeChild(notices.firstChild);
    (conflicts[job.id] || []).forEach(function (label) { var notice = document.createElement("p"); notice.className = "program-conflict-notice"; notice.textContent = label; notices.appendChild(notice); });
    var form = one("[data-scheduler-form]");
    if (form) {
      ["startDate", "endDate", "startTime", "endTime", "crewId", "location", "status", "priority"].forEach(function (name) {
        if (form.elements[name]) form.elements[name].value = text(job[name]);
      });
      var hasExplicitTimes = Boolean(job.startTime && job.endTime);
      var isAllDay = job.allDay && !hasExplicitTimes;
      if (form.elements.allDay) form.elements.allDay.checked = isAllDay;
      all("[data-scheduler-timed]").forEach(function (node) { node.hidden = isAllDay; });
      var formError = one("[data-scheduler-form-error]"); if (formError) { formError.hidden = true; formError.textContent = ""; }
    }
    var fmt = window.UOS && window.UOS.imports && window.UOS.imports.formatDate;
    var startDateStr = fmt ? fmt(job.startDate) : job.startDate;
    var endDateStr = fmt ? fmt(job.endDate) : job.endDate;
    var dateRangeStr = job.startDate === job.endDate ? startDateStr : startDateStr + " – " + endDateStr;
    var fields = one("[data-scheduler-detail-fields]"); while (fields.firstChild) fields.removeChild(fields.firstChild);
    field(fields, "Ownership", job.ownerLabel); field(fields, "Source", sourceLabel(job)); field(fields, "Category", category(job)); field(fields, "Status", status(job)); field(fields, "Date", dateRangeStr); field(fields, "Time", timeLabel(job)); field(fields, "Duration", job.allDay ? "All day" : Math.floor(job.durationMinutes / 60) + "h " + job.durationMinutes % 60 + "m"); field(fields, "Crew", crew(job)); field(fields, "Location", location(job));
  }
  function updatePillPicker() {
    var activeMode = activeOwner() === "EVT" ? "events" : "applications";
    Array.prototype.slice.call(document.querySelectorAll("[data-scheduler-pane-mode]")).forEach(function (btn) {
      var active = btn.getAttribute("data-scheduler-pane-mode") === activeMode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (window.UOS && window.UOS.ProgramApp && typeof window.UOS.ProgramApp.updateRailTheme === "function") window.UOS.ProgramApp.updateRailTheme();
  }

  function render() {
    if (!root || !state.workspace || !model()) return;
    var scheduler = state.workspace.workspace && state.workspace.workspace.scheduler || {};
    state.mode = scheduler.mode === "month" ? "month" : "week";
    state.cursor = text(state.workspace.workspace.calendarCursor || scheduler.cursor) || today();
    state.selectedId = text(scheduler.selectedId || state.workspace.workspace.selectedEntityId);
    state.detail = scheduler.detail === true || scheduler.modeDetail === "detail" || scheduler.inspectorMode === "detail";
    var sort = ["date", "priority", "id"].indexOf(scheduler.sort) >= 0 ? scheduler.sort : "date";
    state.jobs = (state.workspace.entities.jobs || []).map(normalizedJob).sort(function (a, b) { return a._startMs - b._startMs || title(a).localeCompare(title(b)); });
    fillSelect("category", "All categories", optionValues(category)); fillSelect("status", "All statuses", optionValues(status)); fillSelect("crew", "All crews", optionValues(crew));
    var owner = activeOwner(), categoryValue = filterValue("category"), statusValue = filterValue("status"), crewValue = filterValue("crew");
    var schedulerFilterCount = [categoryValue, statusValue, crewValue].filter(function (value) { return value !== "all"; }).length;
    var schedulerFilterBadge = one('[data-filter-drawer-badge="scheduler"]');
    if (schedulerFilterBadge) {
      schedulerFilterBadge.textContent = String(schedulerFilterCount);
      schedulerFilterBadge.hidden = schedulerFilterCount === 0;
    }
    var days = periodDays(), first = days.length && days[0].date, last = days.length && days[days.length - 1].date;
    var drawerMode = document.body.hasAttribute("data-drawer-module");
    state.visible = state.jobs.filter(function (job) { return (job._unscheduled || job.startDate <= last && job.endDate >= first) && job.owner === owner && (drawerMode || ((categoryValue === "all" || category(job) === categoryValue) && (statusValue === "all" || status(job) === statusValue) && (crewValue === "all" || crew(job) === crewValue) && (state.sourceFilter === "all" || sourceLabel(job) === state.sourceFilter))); }).sort(function (a, b) { if (sort === "priority") return priorityRank(a.priority) - priorityRank(b.priority) || a._startMs - b._startMs; if (sort === "id") return a.id.localeCompare(b.id); return a._startMs - b._startMs || title(a).localeCompare(title(b)); });
    all("[data-scheduler-mode]").forEach(function (button) { button.setAttribute("aria-pressed", String(button.getAttribute("data-scheduler-mode") === state.mode)); });
    var sortSelect = one("[data-scheduler-sort]"); if (sortSelect) sortSelect.value = sort;
    updatePillPicker();
    var conflicts = conflictMap(); renderCalendar(conflicts); renderUnscheduled(conflicts); renderList(conflicts); renderDetail(conflicts);
  }
  function persist(changes) {
    if (!UOS.ProgramApp || typeof UOS.ProgramApp.updateWorkspace !== "function") return Promise.resolve(null);
    return UOS.ProgramApp.updateWorkspace(function (workspace) {
      workspace.workspace = workspace.workspace || {}; workspace.workspace.scheduler = workspace.workspace.scheduler || {};
      changes(workspace.workspace.scheduler, workspace.workspace); return workspace;
    });
  }
  function selectJob(id) {
    var list = one("[data-scheduler-list]"); state.scrollTop = list ? list.scrollTop : state.scrollTop;
    writeSessionScroll(state.scrollTop);
    return persist(function (scheduler, workspace) {
      scheduler.selectedId = id;
      scheduler.detail = true;
      scheduler.inspectorMode = "detail";
      if (!document.body.hasAttribute("data-drawer-module")) workspace.selectedEntityId = id;
    });
  }
  function focusCalendarJob(id) {
    var job = state.jobs.find(function (item) { return item.id === id; });
    if (!job) return Promise.resolve(null);
    state.selectedId = id;
    state.panelMode = "jobs";
    state.detail = true;
    render();
    return persist(function (scheduler) {
      scheduler.selectedId = id;
      scheduler.panelMode = "jobs";
      scheduler.detail = true;
      scheduler.inspectorMode = "detail";
    });
  }
  function showOtherProjectJobSummary(job, trigger) {
    var project = getProjectsForActiveOwner().find(function (item) { return isJobInProject(job, item); });
    var register = project && getRecordById(project.applicationId || project.eventId);
    var dialog = document.querySelector("[data-scheduler-other-project-summary]");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "program-data-dialog program-scheduler-summary-dialog";
      dialog.setAttribute("data-scheduler-other-project-summary", "");
      dialog.innerHTML = '<div class="program-data-dialog__frame"><header><h2>Job summary</h2><button type="button" class="uos-button uos-button--subtle uos-button--sm" data-scheduler-summary-close aria-label="Close Job summary">Close</button></header><div class="program-data-dialog__body" data-scheduler-summary-body></div><footer><button type="button" class="uos-button uos-button--secondary" data-scheduler-summary-close>Return to calendar</button></footer></div>';
      document.body.appendChild(dialog);
    }
    var body = dialog.querySelector("[data-scheduler-summary-body]");
    body.innerHTML = "";
    [["Job", title(job)], ["Project", project && title(project)], ["Register", register && title(register)], ["Status", text(job.status) || "Draft"], ["Schedule", timeLabel(job) || "Not scheduled"]].forEach(function (entry) {
      var row = document.createElement("section"), heading = document.createElement("strong"), value = document.createElement("p");
      heading.textContent = entry[0]; value.textContent = entry[1] || "Not recorded"; row.appendChild(heading); row.appendChild(value); body.appendChild(row);
    });
    var close = function () { if (dialog.open) dialog.close(); if (trigger && typeof trigger.focus === "function") trigger.focus(); };
    dialog.querySelectorAll("[data-scheduler-summary-close]").forEach(function (button) { button.onclick = close; });
    dialog.oncancel = function (event) { event.preventDefault(); close(); };
    dialog.showModal();
  }
  function routeCalendarJob(id, trigger) {
    var job = state.jobs.find(function (item) { return item.id === id; });
    var activeProject = getProjectsForActiveOwner().find(function (item) { return item.id === state.selectedProjectId; });
    if (job && activeProject && !isJobInProject(job, activeProject)) { showOtherProjectJobSummary(job, trigger); return Promise.resolve(null); }
    return focusCalendarJob(id);
  }
  function selectProject(id, showJobs) {
    var project = getProjectsForActiveOwner().find(function (item) { return item.id === id; });
    if (!project) return Promise.resolve(null);
    state.selectedProjectId = project.id;
    state.panelMode = showJobs ? "jobs" : "projects";
    state.detail = false;
    render();
    return persist(function (scheduler, workspace) {
      scheduler.selectedProjectId = project.id;
      scheduler.panelMode = state.panelMode;
      scheduler.detail = false;
      scheduler.inspectorMode = "list";
      workspace.ownerMode = project.owner;
      workspace.selectedProjectId = project.id;
      workspace.selectedEntityId = project.applicationId || project.eventId || project.id;
      workspace.costing = workspace.costing || {};
      workspace.costing.selectedProjectId = project.id;
      workspace.planner = workspace.planner || {};
      workspace.planner.selectedProjectId = project.id;
    });
  }
  function backToList() { state.focusList = true; state.detail = false; render(); return persist(function (scheduler) { scheduler.detail = false; scheduler.inspectorMode = "list"; }); }
  function changeMode(mode) { if (mode !== "week" && mode !== "month") return; return persist(function (scheduler) { scheduler.mode = mode; }); }
  function movePeriod(direction) { var cursor = state.cursor || today(); var next = state.mode === "month" ? addMonths(cursor, direction) : model().addDays(cursor, direction * 7); return persist(function (scheduler, workspace) { scheduler.cursor = next; workspace.calendarCursor = next; }); }
  function setFilter(name, value) { return persist(function (scheduler) { scheduler.filters = scheduler.filters || {}; scheduler.filters[name] = value === "all" ? [] : [value]; }); }
  function setSort(value) { return persist(function (scheduler) { scheduler.sort = ["priority", "id"].indexOf(value) >= 0 ? value : "date"; }); }
  function saveSchedule(form) {
    var values = new FormData(form);
    var startTimeVal = text(values.get("startTime"));
    var endTimeVal = text(values.get("endTime"));
    var hasTimes = Boolean(startTimeVal && endTimeVal);
    var allDayChecked = Boolean(form.elements.allDay && form.elements.allDay.checked);
    var allDay = allDayChecked && !hasTimes;
    var changes = {
      startDate: text(values.get("startDate")),
      endDate: text(values.get("endDate") || values.get("startDate")),
      allDay: allDay,
      startTime: allDay ? "" : startTimeVal,
      endTime: allDay ? "" : endTimeVal,
      crewId: text(values.get("crewId")),
      location: text(values.get("location")),
      priority: text(values.get("priority"))
    };
    var errorNode = one("[data-scheduler-form-error]");
    return UOS.ProgramApp.updateWorkspace(function (workspace) {
      var next = model().scheduleJob(workspace, state.selectedId, changes);
      var plannerJob = next.entities.jobs.find(function (item) { return item.id === state.selectedId && item.sourceKind === "planner"; });
      if (plannerJob) {
        var plannerTask = next.entities.tasks.find(function (item) { return item.id === plannerJob.sourceEntityId; });
        if (plannerTask) {
          plannerTask.jobId = plannerJob.id;
          plannerTask.schedulerJobId = plannerJob.startDate ? plannerJob.id : null;
          plannerTask.updatedAt = new Date().toISOString();
        }
      }
      next.workspace = next.workspace || {};
      next.workspace.scheduler = next.workspace.scheduler || {};
      next.workspace.scheduler.selectedId = state.selectedId;
      next.workspace.scheduler.detail = true;
      next.workspace.scheduler.inspectorMode = "detail";
      return next;
    }).then(function () {
      if (UOS.toast) UOS.toast("Schedule updated successfully.", "success");
    }).catch(function (error) {
      if (errorNode) {
        errorNode.textContent = error.message;
        errorNode.hidden = false;
      }
      return null;
    });
  }
  function deleteSelectedJob() {
    var job = state.jobs.find(function (item) { return item.id === state.selectedId; });
    if (!job || !UOS.ProgramApp || !UOS.ProgramModel || typeof UOS.ProgramModel.deleteJob !== "function") return Promise.resolve(null);
    function apply() {
      return UOS.ProgramApp.updateWorkspace(function (workspace) { return UOS.ProgramModel.deleteJob(workspace, job.id); }).then(function (saved) {
        state.selectedId = ""; state.detail = false; state.focusList = true; render();
        if (UOS.toast) UOS.toast("Job deleted. Its polygon remains available to create another job.", "success");
        return saved;
      });
    }
    if (!UOS.dialogs || typeof UOS.dialogs.confirm !== "function") return apply();
    return UOS.dialogs.confirm({ title: "Delete job?", message: "This deletes the Job and its related costing, task and inherited quote records. Its source polygon will remain mapped.", confirmLabel: "Delete job", cancelLabel: "Keep job", danger: true }).then(function (confirmed) { return confirmed ? apply() : null; });
  }
  function onClick(event) {
    /* Shared mini-drawer contract: selection may rebuild the list, so run it
       after the single opening motion and inherit the settled open state. */
    var schedulerDisclosureToggle = event.target.closest("[data-disclosure-toggle]");
    if (schedulerDisclosureToggle) {
      var schedulerDisclosureRow = schedulerDisclosureToggle.closest("[data-scheduler-project]");
      if (schedulerDisclosureRow) {
        var schedulerProjectId = schedulerDisclosureRow.getAttribute("data-scheduler-project");
        var schedulerProjectExists = getProjectsForActiveOwner().some(function (project) { return project.id === schedulerProjectId; });
        if (!schedulerProjectExists) return;
        var schedulerDisclosureKey = schedulerDisclosureToggle.getAttribute("data-disclosure-key");
        if (schedulerDisclosureToggle.getAttribute("aria-expanded") !== "true") return;
        var disclosureApi = window.UOS && window.UOS.ProgramDisclosureRows;
        var finishSchedulerSelection = function () { selectProject(schedulerProjectId, false); };
        if (!disclosureApi || typeof disclosureApi.afterOpen !== "function" || !disclosureApi.afterOpen(schedulerDisclosureKey, finishSchedulerSelection)) finishSchedulerSelection();
      }
      return;
    }
    var jobFilterBtn = event.target.closest("[data-scheduler-sidebar-job-filter]");
    if (jobFilterBtn) {
      var jf = jobFilterBtn.getAttribute("data-scheduler-sidebar-job-filter");
      if (jf === "all") {
        state.sidebarJobFilter = "all";
        state.sidebarStatusFilters = [];
      } else {
        state.sidebarJobFilter = state.sidebarJobFilter === jf ? "all" : jf;
      }
      renderList(conflictMap());
      return;
    }
    var statusFilterBtn = event.target.closest("[data-scheduler-sidebar-status-filter]");
    if (statusFilterBtn) {
      var sf = (statusFilterBtn.getAttribute("data-scheduler-sidebar-status-filter") || "").toLowerCase();
      state.sidebarStatusFilters = state.sidebarStatusFilters || [];
      var idx = state.sidebarStatusFilters.indexOf(sf);
      if (idx >= 0) state.sidebarStatusFilters.splice(idx, 1);
      else state.sidebarStatusFilters.push(sf);
      renderList(conflictMap());
      return;
    }
    var schedulerJump = event.target.closest("[data-scheduler-toolbar-jump],[data-scheduler-jump]");
    if (schedulerJump && window.UOS && window.UOS.ProgramApp) {
      var jumpDest = schedulerJump.getAttribute("data-scheduler-toolbar-jump") || schedulerJump.getAttribute("data-scheduler-jump");
      var currentJob = state.jobs.find(function (item) { return item.id === state.selectedId; });
      var currentProject = getProjectsForActiveOwner().find(function (item) { return item.id === state.selectedProjectId; });
      var contextId = state.panelMode === "jobs" && currentJob ? currentJob.id : currentProject && currentProject.id;
      if (typeof window.UOS.ProgramApp.navigateWithContext === "function") {
        window.UOS.ProgramApp.navigateWithContext(jumpDest, contextId);
      }
      return;
    }
    var showJobsBtn = event.target.closest("[data-scheduler-show-jobs]");
    var projBtn = event.target.closest("[data-scheduler-project]");
    var backProjectsBtn = event.target.closest("[data-scheduler-back-projects]");
    var jobBtn = event.target.closest("[data-scheduler-job]");
    var calendarJobBtn = event.target.closest(".program-calendar-job[data-scheduler-job]");
    var openJobDetailBtn = event.target.closest("[data-scheduler-open-job-detail]");
    var modeButton = event.target.closest("[data-scheduler-mode]");
    var paneModeBtn = event.target.closest("[data-scheduler-pane-mode]");

    if (calendarJobBtn) {
      routeCalendarJob(calendarJobBtn.getAttribute("data-scheduler-job"), calendarJobBtn);
    } else if (backProjectsBtn) {
      state.panelMode = "projects";
      state.detail = false;
      render();
      persist(function (scheduler) { scheduler.panelMode = "projects"; scheduler.detail = false; scheduler.inspectorMode = "list"; });
    } else if (showJobsBtn) {
      selectProject(showJobsBtn.getAttribute("data-scheduler-show-jobs"), true);
    } else if (projBtn) {
      selectProject(projBtn.getAttribute("data-scheduler-project"), false);
    } else if (paneModeBtn) {
      setFilter("ownership", paneModeBtn.getAttribute("data-scheduler-pane-mode") === "events" ? "EVT" : "NSA");
    } else if (openJobDetailBtn) {
      selectJob(openJobDetailBtn.getAttribute("data-scheduler-open-job-detail"));
    } else if (jobBtn && !jobBtn.hasAttribute("data-disclosure-enhanced")) {
      selectJob(jobBtn.getAttribute("data-scheduler-job"));
    } else if (event.target.closest("[data-scheduler-back]")) {
      backToList();
    } else if (event.target.closest("[data-scheduler-delete-job]")) {
      deleteSelectedJob();
    } else if (modeButton) {
      changeMode(modeButton.getAttribute("data-scheduler-mode"));
    } else if (event.target.closest("[data-scheduler-previous]")) {
      movePeriod(-1);
    } else if (event.target.closest("[data-scheduler-next]")) {
      movePeriod(1);
    } else if (event.target.closest("[data-scheduler-today]")) {
      persist(function (scheduler, workspace) { scheduler.cursor = today(); workspace.calendarCursor = today(); });
    }
  }
  function onKeydown(event) {
    if (event.key === "Escape" && state.detail) { event.preventDefault(); backToList(); return; }
    if ((event.key !== "ArrowDown" && event.key !== "ArrowUp") || state.detail || !event.target.closest("[data-scheduler-list]")) return;
    var ids = state.visible.map(function (job) { return job.id; }); if (!ids.length) return;
    var index = ids.indexOf(state.selectedId); index = event.key === "ArrowDown" ? Math.min(ids.length - 1, index + 1) : Math.max(0, index < 0 ? 0 : index - 1);
    event.preventDefault(); state.selectedId = ids[index]; renderList(conflictMap()); var node = one('[data-scheduler-job="' + CSS.escape(ids[index]) + '"]'); if (node) node.focus();
  }
  function init() {
    root = document.querySelector("[data-program-scheduler]"); if (!root) return;
    var sourceFilterHost = one(".program-scheduler-list-tools") || one(".program-scheduler-filters");
    if (sourceFilterHost && !sourceFilterHost.querySelector("[data-scheduler-source-filter]")) { var sourceControl = document.createElement("label"); sourceControl.innerHTML = '<span>Source</span><select data-scheduler-source-filter aria-label="Filter jobs by source"><option value="all">All sources</option><option>Calculator</option><option>Space Map</option><option>Planner</option><option>Legacy</option></select>'; sourceFilterHost.appendChild(sourceControl); }
    document.addEventListener("input", function (event) {
      if (event.target.matches("[data-scheduler-project-search]")) {
        state.sidebarSearchQuery = (event.target.value || "").trim().toLowerCase();
        renderList(conflictMap());
      }
    });
    document.addEventListener("click", onClick); document.addEventListener("change", function (event) { var source = event.target.closest("[data-scheduler-source-filter]"); if (source) { state.sourceFilter = source.value || "all"; render(); return; } var input = event.target.closest("[data-scheduler-filter]"); if (input) setFilter(input.getAttribute("data-scheduler-filter"), input.value); var sort = event.target.closest("[data-scheduler-sort]"); if (sort) setSort(sort.value); var allDay = event.target.closest('[name="allDay"]'); if (allDay) all("[data-scheduler-timed]").forEach(function (node) { node.hidden = allDay.checked; }); }); root.addEventListener("keydown", onKeydown);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.detail && !event.defaultPrevented) { event.preventDefault(); backToList(); }
    });
    var list = one("[data-scheduler-list]"); if (list) list.addEventListener("scroll", function () {
      var nextScrollTop = list.scrollTop;
      if (nextScrollTop === state.scrollTop) return;
      state.scrollTop = nextScrollTop;
      writeSessionScroll(state.scrollTop);
    }, { passive: true });
    root.addEventListener("submit", function (event) { if (event.target.matches("[data-scheduler-form]")) { event.preventDefault(); saveSchedule(event.target); } });
    document.addEventListener("uos:program-ready", function (event) {
      var workspace = event.detail && event.detail.workspace;
      if (!workspace || !workspace.workspace || workspace.workspace.destination !== "scheduler") return;
      state.workspace = clone(workspace);
      var ui = state.workspace.workspace || {}, scheduler = ui.scheduler || {};
      state.scrollTop = readSessionScroll() || state.scrollTop;
      var incomingProjectId = text(ui.selectedProjectId || scheduler.selectedProjectId);
      if (incomingProjectId && incomingProjectId !== state.selectedProjectId) {
        state.sidebarSearchQuery = "";
        state.sidebarJobFilter = "all";
        state.sidebarStatusFilters = [];
        var schedulerSearch = one("[data-scheduler-project-search]");
        if (schedulerSearch) schedulerSearch.value = "";
      }
      state.selectedProjectId = incomingProjectId;
      state.panelMode = scheduler.panelMode === "jobs" ? "jobs" : "projects";
      render();
    });
  }
  UOS.ProgramSchedulerUI = { init: init, render: render, selectJob: selectJob, focusCalendarJob: focusCalendarJob, routeCalendarJob: routeCalendarJob, backToList: backToList, snapshot: function () { return clone(state); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
}());
