(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {}, base = UOS.ProgramModel, status = UOS.ProgramStatus;
  if (!base || !status) throw new Error("ProgramStatus and ProgramModel must load before status-model.");
  var EXTRA = ["statusEvents", "statusRecommendations"], original = {
    blank: base.blank, normalize: base.normalize, assertValid: base.assertValid,
    exportJson: base.exportJson, importJson: base.importJson,
    registerDeletionImpact: base.registerDeletionImpact,
    deleteRegisterRecord: base.deleteRegisterRecord
  };
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function normalize(input) {
    var migrated = original.normalize(input);
    var output = migrated;
    output.statusControl = clone(migrated.statusControl || { automationEnabled: true, operatorName: "", enabledBy: "", enabledAt: "" });
    return output;
  }
function blank(at) {
  var result = original.blank(at); result.schemaVersion = 5;
    result.entities.statusEvents = []; result.entities.statusRecommendations = [];
    result.statusControl = { automationEnabled: true, operatorName: "", enabledBy: "", enabledAt: "" };
    result.migration = result.migration && typeof result.migration === "object" ? result.migration : {};
  result.migration.registerBaselineSanitation = { id: "register-baseline-2026-07-01", version: 1, cutoffDate: "2026-07-01", appliedAt: text(at) || new Date().toISOString(), retainedRegisterIds: [], purgedRegisterIds: [], purgedArtifacts: {} };
  result.migration.emptyOperationalBaseline = { id: "empty-operational-baseline-2026-09-12", version: 1, appliedAt: text(at) || new Date().toISOString(), purgedEntities: {}, rateCatalogVersion: 1, rateItemCount: result.entities.rateItems.length };
  return normalize(result);
}
  function validateStatus(workspace) {
    var errors = [], entities = workspace.entities || {}, seen = {}, records = {};
    ["applications", "events", "projects", "jobs", "tasks"].forEach(function (collection) {
      (entities[collection] || []).forEach(function (record) {
        records[record.id] = record;
        var domain = status.domainFor(record, collection), code = status.codeFor(domain, record.status);
        if (code !== record.status) errors.push(record.id + " status must be a canonical " + domain + " code.");
      });
    });
    ["statusEvents", "statusRecommendations"].forEach(function (collection) {
      (entities[collection] || []).forEach(function (item) {
        if (seen[item.id]) errors.push("Duplicate status audit id " + item.id + ".");
        seen[item.id] = true;
        if (!records[item.entityId]) errors.push(item.id + " references a missing status target.");
        else if (records[item.entityId].owner !== item.owner) errors.push(item.id + " owner must match its target.");
      });
    });
    (entities.statusRecommendations || []).forEach(function (item) { if (["open", "approved", "dismissed"].indexOf(item.status) < 0) errors.push(item.id + " has an invalid recommendation state."); });
    if (!workspace.statusControl || typeof workspace.statusControl.automationEnabled !== "boolean") errors.push("statusControl.automationEnabled must be boolean.");
    if (errors.length) throw new Error("Invalid status control plane:\n- " + errors.join("\n- "));
  }
  function assertValid(input) { var normalized = normalize(input); original.assertValid(normalized); validateStatus(normalized); return input; }
  function registerDeletionImpact(input, registerId) {
    var workspace = normalize(input);
    var impact = original.registerDeletionImpact(workspace, registerId);
    var removedTargets = {};
    removedTargets[impact.registerId] = true;
    ["projects", "jobs", "tasks"].forEach(function (collection) {
      Object.keys(impact.ids[collection] || {}).forEach(function (id) { removedTargets[id] = true; });
    });
    ["statusEvents", "statusRecommendations"].forEach(function (collection) {
      var removedIds = {};
      (workspace.entities[collection] || []).forEach(function (item) {
        if (removedTargets[item.entityId]) removedIds[item.id] = true;
      });
      impact.ids[collection] = removedIds;
      impact.counts[collection] = Object.keys(removedIds).length;
    });
    return impact;
  }
function protectedCommercialDeletionImpact(workspace, impact) {
var protectedQuotes = (workspace.entities.quotes || []).filter(function (quote) {
return impact.ids.quotes && impact.ids.quotes[quote.id] && ["Issued", "Accepted", "Declined", "Superseded"].indexOf(text(quote.status)) >= 0;
});
var protectedPayments = (workspace.entities.payments || []).filter(function (payment) {
return impact.ids.payments && impact.ids.payments[payment.id];
});
return { quotes: protectedQuotes, payments: protectedPayments };
}
function deleteRegisterRecord(input, registerId, options) {
options = options || {};
var impact = registerDeletionImpact(input, registerId);
if (options.confirmed !== true) throw new Error("Register deletion requires explicit confirmation after dependency impact review.");
var protectedImpact = protectedCommercialDeletionImpact(normalize(input), impact);
if (protectedImpact.quotes.length || protectedImpact.payments.length) throw new Error("Register deletion is blocked because issued commercial history or payments must be preserved.");
var result = original.deleteRegisterRecord(input, registerId);
    var workspace = result.workspace;
    ["statusEvents", "statusRecommendations"].forEach(function (collection) {
      workspace.entities[collection] = (workspace.entities[collection] || []).filter(function (item) {
        return !impact.ids[collection][item.id];
      });
    });
    result.impact = impact;
    result.workspace = normalize(workspace);
    return result;
  }
var REGISTER_BASELINE_ID = "register-baseline-2026-07-01";
var REGISTER_BASELINE_CUTOFF = "2026-07-01";
var EMPTY_OPERATIONAL_BASELINE_ID = "empty-operational-baseline-2026-09-12";
  var PURGED_OPERATIONAL_COLLECTIONS = ["projects", "jobs", "tasks", "costingLines", "geometries", "quotes", "quoteLines", "payments", "paymentAllocations", "quoteEvents", "statusEvents", "statusRecommendations"];
  function canonicalDate(value) {
    var raw = text(value), match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
    if (!match) match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (!match) return "";
    var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    if (raw.charAt(4) !== "-") { year = Number(match[3]); month = Number(match[2]); day = Number(match[1]); }
    var checked = new Date(Date.UTC(year, month - 1, day));
    if (checked.getUTCFullYear() !== year || checked.getUTCMonth() !== month - 1 || checked.getUTCDate() !== day) return "";
    return String(year).padStart(4, "0") + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  }
  function receivedDate(record) {
    var payload = record && record.payload && typeof record.payload === "object" ? record.payload : {};
    return canonicalDate(record && (record.receivedDate || record.dateReceived || record.lodgedDate || payload.receivedDate || payload.dateReceived || payload.lodgedDate || record.startDate));
  }
  function baselineMarker(workspace) {
    return workspace && workspace.migration && workspace.migration.registerBaselineSanitation;
  }
function sanitizeRegisterBaseline(input, options) {
    options = options || {};
    var normalized = normalize(input), existingMarker = baselineMarker(normalized);
    if (existingMarker && existingMarker.id === REGISTER_BASELINE_ID) return { workspace: normalized, changed: false, report: clone(existingMarker) };
    var at = text(options.at) || new Date().toISOString(), output = clone(normalized), purgedIds = [], retainedIds = [];
    ["applications", "events"].forEach(function (collection) {
      output.entities[collection] = (output.entities[collection] || []).filter(function (record) {
        var date = receivedDate(record), keep = Boolean(date && date >= REGISTER_BASELINE_CUTOFF);
        if (!keep) { purgedIds.push(record.id); return false; }
        retainedIds.push(record.id);
        record.receivedDate = date;
        record.dateReceived = date;
        record.financialYear = typeof base.financialYearForReceivedDate === "function" ? base.financialYearForReceivedDate(date) : record.financialYear;
        record.status = "received";
        delete record.projectId;
        delete record.statusHistory;
        delete record.legacyStatus;
        delete record.statusReviewRequired;
        delete record.statusAutomationPaused;
        delete record.statusAutomationPausedAt;
        if (record.payload && typeof record.payload === "object") {
          record.payload.dateReceived = date;
          record.payload.receivedDate = date;
          record.payload.status = "received";
          delete record.payload.statusHistory;
          delete record.payload.projectId;
}

        return true;
      });
    });
    var purgedArtifacts = {};
    PURGED_OPERATIONAL_COLLECTIONS.forEach(function (collection) {
      purgedArtifacts[collection] = (output.entities[collection] || []).length;
      output.entities[collection] = [];
    });
    var blankWorkspace = original.blank(at);
    output.workspace = clone(blankWorkspace.workspace || {});
    output.statusControl = { automationEnabled: true, operatorName: "", enabledBy: "Status engine", enabledAt: at };
    output.migration = output.migration && typeof output.migration === "object" ? output.migration : {};
    delete output.migration.unresolvedWorkLineage;
    delete output.migration.unresolvedQuoteLifecycle;
    delete output.migration.statusReadiness;
    var report = {
      id: REGISTER_BASELINE_ID,
      version: 1,
      cutoffDate: REGISTER_BASELINE_CUTOFF,
      appliedAt: at,
      retainedRegisterIds: retainedIds.sort(),
      purgedRegisterIds: purgedIds.sort(),
      purgedArtifacts: purgedArtifacts
    };
    output.migration.registerBaselineSanitation = clone(report);
    output.updatedAt = at;
    output = normalize(output);
    var before = clone(output);
    before.entities.applications = [];
    before.entities.events = [];
    before.entities.statusEvents = [];
    before.entities.statusRecommendations = [];
    output = status.reconcileMutation(before, output, { source: "automatic", action: "Register baseline sanitation", at: at });
    output.migration.registerBaselineSanitation = clone(report);
    output = normalize(output);
    original.assertValid(output);
  validateStatus(output);
  return { workspace: output, changed: true, report: report };
}

function resetOperationalBaseline(input, options) {
  options = options || {};
  var source = input && typeof input === "object" ? input : {};
  var existingMarker = source.migration && source.migration.emptyOperationalBaseline;
  if (existingMarker && existingMarker.id === EMPTY_OPERATIONAL_BASELINE_ID) {
    var normalized = normalize(source);
    return { workspace: normalized, changed: false, report: clone(existingMarker) };
  }

  var at = text(options.at) || new Date().toISOString();
  var output = blank(at);
  var purgedEntities = {};
  Object.keys(source.entities || {}).sort().forEach(function (collection) {
    if (collection !== "rateItems") purgedEntities[collection] = Array.isArray(source.entities[collection]) ? source.entities[collection].length : 0;
  });

  output.workspaceRevision = Math.max(0, Number(source.workspaceRevision) || 0);
  output.updatedAt = at;
  output.migration.status = "complete";
  output.migration.migratedAt = at;
  output.migration.sources = [];
  output.migration.warnings = [];
  var report = {
    id: EMPTY_OPERATIONAL_BASELINE_ID,
    version: 1,
    appliedAt: at,
    purgedEntities: purgedEntities,
    rateCatalogVersion: UOS.ProgramDefaultRateCatalog && UOS.ProgramDefaultRateCatalog.version || 1,
    rateItemCount: output.entities.rateItems.length
  };
  output.migration.emptyOperationalBaseline = clone(report);
  output = normalize(output);
  original.assertValid(output);
  validateStatus(output);
  return { workspace: output, changed: true, report: report };
}
  base.schemaVersion = 5;
  base.collections = base.collections.concat(EXTRA.filter(function (name) { return base.collections.indexOf(name) < 0; }));
  base.blank = blank; base.normalize = normalize; base.assertValid = assertValid;
  base.isNormalized = function (value) { try { return JSON.stringify(normalize(value)) === JSON.stringify(value); } catch (error) { return false; } };
  base.exportJson = function (workspace) { return JSON.stringify(normalize(workspace), null, 2); };
  base.importJson = function (value) { var parsed = typeof value === "string" ? JSON.parse(value) : clone(value); return normalize(parsed); };
  base.registerDeletionImpact = registerDeletionImpact;
  base.deleteRegisterRecord = deleteRegisterRecord;
base.registerBaselineSanitationId = REGISTER_BASELINE_ID;
base.registerBaselineCutoff = REGISTER_BASELINE_CUTOFF;
base.sanitizeRegisterBaseline = sanitizeRegisterBaseline;
base.emptyOperationalBaselineId = EMPTY_OPERATIONAL_BASELINE_ID;
base.resetOperationalBaseline = resetOperationalBaseline;
  UOS.ProgramModel = UOS.programModel = base;
}());
