(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var OPERATIONAL_COLLECTIONS = ["applications", "events", "projects", "jobs"];
  var CLOSED_STATUSES = ["complete", "completed", "closed", "cancelled", "canceled"];

  function text(value) { return String(value == null ? "" : value).trim(); }
  function entities(workspace, name) {
    return workspace && workspace.entities && Array.isArray(workspace.entities[name]) ? workspace.entities[name] : [];
  }
  function statusKey(value) { return text(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " "); }
  function statusLabel(value) {
    return statusKey(value).replace(/\b\w/g, function (character) { return character.toUpperCase(); });
  }
  function currentDate(options) {
    if (options && /^\d{4}-\d{2}-\d{2}$/.test(text(options.today))) return options.today;
    var now = options && options.now instanceof Date ? options.now : new Date();
    var offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  function summarize(workspace, options) {
    var summary = {
      counts: { applications: 0, events: 0, projects: 0, jobs: 0 },
      owners: { NSA: 0, EVT: 0 },
      statuses: [],
      attention: { overdueJobs: 0, unscheduledJobs: 0, unassignedCostingLines: 0, missingStatus: 0 },
      finances: { approvedBudget: 0, committedBudget: 0, actualSpend: 0, spareFunds: 0 },
      totalOperational: 0
    };
    var statuses = {};
    var today = currentDate(options);

    OPERATIONAL_COLLECTIONS.forEach(function (collection) {
      var records = entities(workspace, collection);
      summary.counts[collection] = records.length;
      summary.totalOperational += records.length;
      records.forEach(function (record) {
        if (record && (record.owner === "NSA" || record.owner === "EVT")) summary.owners[record.owner] += 1;
        var key = statusKey(record && record.status);
        if (!key) summary.attention.missingStatus += 1;
        else statuses[key] = (statuses[key] || 0) + 1;
      });
    });

    entities(workspace, "jobs").forEach(function (job) {
      if (!text(job && job.startDate)) summary.attention.unscheduledJobs += 1;
      var endDate = text(job && (job.endDate || job.startDate));
      if (endDate && endDate < today && CLOSED_STATUSES.indexOf(statusKey(job.status)) < 0) summary.attention.overdueJobs += 1;
    });
    entities(workspace, "costingLines").forEach(function (line) {
      if (!line || !text(line.jobId)) summary.attention.unassignedCostingLines += 1;
    });
    summary.statuses = Object.keys(statuses).map(function (key) {
      return { key: key, label: statusLabel(key), count: statuses[key] };
    }).sort(function (left, right) { return right.count - left.count || left.label.localeCompare(right.label); });
    if (UOS.ProjectFunding && typeof UOS.ProjectFunding.finances === "function") summary.finances = UOS.ProjectFunding.finances(workspace);
    else if (UOS.ProgramModel && typeof UOS.ProgramModel.finances === "function") summary.finances = UOS.ProgramModel.finances(workspace);
    return summary;
  }

  function setText(selector, value, root) {
    var node = (root || document).querySelector(selector);
    if (node) node.textContent = String(value);
  }
  function renderStatusList(summary, root) {
    var list = root.querySelector("[data-program-dashboard-status-list]");
    var empty = root.querySelector("[data-program-dashboard-status-empty]");
    if (!list || !empty) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    summary.statuses.forEach(function (status) {
      var row = document.createElement("div");
      var label = document.createElement("dt");
      var value = document.createElement("dd");
      label.textContent = status.label;
      value.textContent = String(status.count);
      row.appendChild(label);
      row.appendChild(value);
      list.appendChild(row);
    });
    list.hidden = summary.statuses.length === 0;
    empty.hidden = summary.statuses.length !== 0;
  }
  function render(workspace, root) {
    root = root || document;
    var summary = summarize(workspace);
    var detail = root.querySelector("[data-program-dashboard-detail]");
    if (detail) detail.hidden = summary.totalOperational === 0 && entities(workspace, "costingLines").length === 0;
    setText('[data-program-dashboard-owner="NSA"]', summary.owners.NSA, root);
    setText('[data-program-dashboard-owner="EVT"]', summary.owners.EVT, root);
    Object.keys(summary.attention).forEach(function (name) {
      setText('[data-program-dashboard-attention="' + name + '"]', summary.attention[name], root);
    });
    var attentionTotal = Object.keys(summary.attention).reduce(function (total, name) { return total + summary.attention[name]; }, 0);
    var attentionList = root.querySelector(".program-dashboard-breakdown--attention");
    var attentionEmpty = root.querySelector("[data-program-dashboard-attention-empty]");
    if (attentionList) attentionList.hidden = attentionTotal === 0;
    if (attentionEmpty) attentionEmpty.hidden = attentionTotal !== 0;
    renderStatusList(summary, root);
    return summary;
  }

  function handleDashboardInteraction(target) {
    if (!window.UOS || !window.UOS.ProgramApp || typeof window.UOS.ProgramApp.navigate !== "function") return;
    var app = window.UOS.ProgramApp;
    var kpiBtn = target.closest("[data-dashboard-kpi]");
    var ownerBtn = target.closest("[data-dashboard-owner-jump]");
    var attentionBtn = target.closest("[data-dashboard-attention-jump]");

    if (kpiBtn) {
      var kpiKey = kpiBtn.getAttribute("data-dashboard-kpi");
      if (kpiKey === "applications") {
        app.updateWorkspace(function (candidate) {
          candidate.workspace = candidate.workspace || {};
          candidate.workspace.ownerMode = "NSA";
          return candidate;
        }).then(function () { app.navigate("register"); });
      } else if (kpiKey === "events") {
        app.updateWorkspace(function (candidate) {
          candidate.workspace = candidate.workspace || {};
          candidate.workspace.ownerMode = "EVT";
          return candidate;
        }).then(function () { app.navigate("register"); });
      } else if (kpiKey === "projects") {
        app.navigate("planner");
      } else if (kpiKey === "jobs") {
        app.navigate("scheduler");
      } else if (kpiKey === "approved" || kpiKey === "committed" || kpiKey === "actual" || kpiKey === "spare") {
        app.navigate("reports");
      }
    } else if (ownerBtn) {
      var owner = ownerBtn.getAttribute("data-dashboard-owner-jump");
      app.updateWorkspace(function (candidate) {
        candidate.workspace = candidate.workspace || {};
        candidate.workspace.ownerMode = owner;
        return candidate;
      }).then(function () { app.navigate("register"); });
    } else if (attentionBtn) {
      var attentionKey = attentionBtn.getAttribute("data-dashboard-attention-jump");
      if (attentionKey === "overdueJobs" || attentionKey === "unscheduledJobs") {
        app.navigate("scheduler");
      } else if (attentionKey === "unassignedCostingLines") {
        app.navigate("costing");
      } else if (attentionKey === "missingStatus") {
        app.navigate("register");
      }
    }
  }

  function bindDashboardInteractivity() {
    var dashboardView = document.querySelector('[data-program-view="dashboard"]');
    if (!dashboardView) return;
    dashboardView.addEventListener("click", function (event) {
      var interactive = event.target.closest("[data-dashboard-kpi], [data-dashboard-owner-jump], [data-dashboard-attention-jump]");
      if (interactive) {
        event.preventDefault();
        handleDashboardInteraction(interactive);
      }
    });
    dashboardView.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        var interactive = event.target.closest("[data-dashboard-kpi], [data-dashboard-owner-jump], [data-dashboard-attention-jump]");
        if (interactive) {
          event.preventDefault();
          handleDashboardInteraction(interactive);
        }
      }
    });
  }

  UOS.ProgramDashboard = { summarize: summarize, render: render };
  document.addEventListener("uos:program-ready", function (event) {
    var workspace = event.detail && event.detail.workspace;
    if (!workspace || !workspace.workspace || workspace.workspace.destination !== "dashboard") return;
    render(workspace);
  });
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindDashboardInteractivity, { once: true });
    else bindDashboardInteractivity();
  }
}());
