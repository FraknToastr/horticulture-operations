(function (root, factory) {
  "use strict";
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.UOS = root.UOS || {}; root.UOS.ProgramReportsModel = api; }
}(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  var UOS = root.UOS = root.UOS || {};
var OWNER_LABELS = { NSA: "Nature Strip", EVT: "Remediation" };
  var COMMITTED_STATUSES = { draft: true, scheduled: true, "in progress": true };

  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function amount(value) { var parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0; }
  function signedAmount(value) { var parsed = Number(value); return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0; }
  function entities(workspace, name) { return object(workspace) && object(workspace.entities) && Array.isArray(workspace.entities[name]) ? workspace.entities[name] : []; }
  function statusKey(value) { return text(value).toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " "); }
  function label(value) { return text(value).replace(/\b\w/g, function (character) { return character.toUpperCase(); }); }
  function title(job) {
    var payload = object(job && job.payload) ? job.payload : {};
    return text(job && (job.title || job.name)) || text(payload.title || payload.name || payload.jobName) || "Untitled job";
  }
  function emptyMoney() { return { approvedBudget: 0, committedBudget: 0, actualSpend: 0, spareFunds: 0 }; }
  function addMoney(target, field, value) { target[field] = amount(target[field] + amount(value)); }
  function canonical(workspace) {
    var app = text(workspace && workspace.app);
    var version = Number(workspace && workspace.schemaVersion);
    var legacy = app === "uos.horticulture" && (version === 2 || version === 3);
    var isolated = (app === "uos.horticulture.nsa" || app === "uos.horticulture.events") && (version === 4 || version === 5);
    if (!object(workspace) || (!legacy && !isolated) || !object(workspace.entities)) {
      throw new Error("Reports require a supported canonical Horticulture workspace.");
    }
    return workspace;
  }
  function budgetComposition(finances) {
    finances = object(finances) ? finances : {};
    var approved = amount(finances.approvedBudget), actual = amount(finances.actualSpend), committed = amount(finances.committedBudget);
    var used = signedAmount(actual + committed), spare = Math.max(0, signedAmount(finances.spareFunds));
    var denominator = Math.max(1, approved, used);
    var actualEnd = Math.min(100, actual / denominator * 100);
    var committedEnd = Math.min(100, actualEnd + committed / denominator * 100);
    return {
      approved: approved, actual: actual, committed: committed, used: used, spare: spare,
      overrun: Math.max(0, signedAmount(used - approved)), actualEnd: actualEnd,
      committedEnd: committedEnd, spareEnd: Math.min(100, committedEnd + spare / denominator * 100)
    };
  }

  function summarize(workspace) {
    workspace = canonical(workspace);
    var owners = {
      NSA: Object.assign({ owner: "NSA", label: OWNER_LABELS.NSA, jobs: 0 }, emptyMoney()),
      EVT: Object.assign({ owner: "EVT", label: OWNER_LABELS.EVT, jobs: 0 }, emptyMoney())
    };
    var linesByJob = {};
    entities(workspace, "costingLines").forEach(function (line) {
      if (!line || !text(line.jobId)) return;
      linesByJob[text(line.jobId)] = amount((linesByJob[text(line.jobId)] || 0) + amount(line.estimatedTotal));
    });

    var statuses = {};
    var jobs = entities(workspace, "jobs").map(function (job) {
      var owner = owners[job && job.owner] ? job.owner : null;
      var key = statusKey(job && job.status) || "unspecified";
      var estimate = amount((job && job.estimate) || linesByJob[text(job && job.id)]);
      var actual = key === "completed" ? amount(job && job.actualCost == null ? estimate : job.actualCost) : 0;
      var committed = COMMITTED_STATUSES[key] ? estimate : 0;
      var row = {
        id: text(job && job.id), owner: owner || "", ownerLabel: owner ? owners[owner].label : "Unspecified",
        title: title(job), status: key, statusLabel: label(key), estimate: estimate,
        committed: committed, actual: actual, variance: key === "completed" ? signedAmount(estimate - actual) : 0
      };
      if (!statuses[key]) statuses[key] = { status: key, label: label(key), jobs: 0, estimate: 0, committed: 0, actual: 0 };
      statuses[key].jobs += 1;
      addMoney(statuses[key], "estimate", estimate);
      addMoney(statuses[key], "committed", committed);
      addMoney(statuses[key], "actual", actual);
      if (owner) {
        owners[owner].jobs += 1;
        addMoney(owners[owner], "committedBudget", committed);
        addMoney(owners[owner], "actualSpend", actual);
      }
      return row;
    }).sort(function (left, right) { return left.owner.localeCompare(right.owner) || left.statusLabel.localeCompare(right.statusLabel) || left.title.localeCompare(right.title); });
    if (UOS.ProgramBudget && entities(workspace, "annualBudgets").length) {
      Object.keys(owners).forEach(function (owner) { owners[owner].committedBudget = 0; owners[owner].actualSpend = 0; });
      entities(workspace, "annualBudgets").forEach(function (budget) { if (owners[budget.owner]) addMoney(owners[budget.owner], "approvedBudget", UOS.ProgramBudget.budgetBalance(workspace, budget.id).approved); });
      entities(workspace, "budgetCharges").forEach(function (charge) {
        if (!owners[charge.owner]) return;
        if (charge.kind === "actual") addMoney(owners[charge.owner], "actualSpend", charge.amount);
        if (charge.kind === "commitment") addMoney(owners[charge.owner], "committedBudget", charge.amount);
        if (charge.kind === "release") addMoney(owners[charge.owner], "committedBudget", -charge.amount);
      });
    }

    Object.keys(owners).forEach(function (owner) {
      owners[owner].spareFunds = signedAmount(owners[owner].approvedBudget - owners[owner].committedBudget - owners[owner].actualSpend);
    });
    var finances = Object.keys(owners).reduce(function (total, owner) {
      ["approvedBudget", "committedBudget", "actualSpend"].forEach(function (field) { addMoney(total, field, owners[owner][field]); });
      total.spareFunds = signedAmount(total.approvedBudget - total.committedBudget - total.actualSpend);
      return total;
    }, emptyMoney());
    if (UOS.ProjectFunding && typeof UOS.ProjectFunding.finances === "function") finances = UOS.ProjectFunding.finances(workspace);
    else if (UOS.ProgramModel && typeof UOS.ProgramModel.finances === "function") finances = UOS.ProgramModel.finances(workspace);
    return {
      finances: finances,
      fundingPositions: UOS.ProjectFunding && UOS.ProgramQuotes ? entities(workspace, "projects").map(function (project) {
        var quote = UOS.ProjectFunding.applicableQuote(workspace, project.id);
        if (!quote) quote = entities(workspace, "quotes").filter(function (item) { return item.projectId === project.id && item.status === "Draft"; }).sort(function (a, b) { return Number(b.revision || 1) - Number(a.revision || 1); })[0];
        return Object.assign({ title: project.title || project.id, owner: project.owner }, UOS.ProjectFunding.position(workspace, project.id, quote ? { quote: quote } : {}));
      }) : [],
      owners: [owners.NSA, owners.EVT],
      statuses: Object.keys(statuses).map(function (key) { return statuses[key]; }).sort(function (left, right) { return right.jobs - left.jobs || left.label.localeCompare(right.label); }),
      jobs: jobs,
      jobCount: jobs.length,
      hasData: jobs.length > 0 || finances.approvedBudget !== 0 || entities(workspace, "costingLines").length > 0 || entities(workspace, "quotes").length > 0
    };
  }

  var api = { summarize: summarize, statusKey: statusKey, budgetComposition: budgetComposition };
  UOS.ProgramReportsModel = api;
  return api;
}));
