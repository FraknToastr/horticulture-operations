(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {}, base = UOS.ProgramDataHealth;
  if (!base || !UOS.ProgramStatus) return;
  var original = base.check;
  base.check = function (workspace) {
    var result = original(workspace), entities = workspace && workspace.entities || {};
    ["applications", "events", "projects", "jobs", "tasks"].forEach(function (collection) {
      (entities[collection] || []).forEach(function (record) {
        var domain = UOS.ProgramStatus.domainFor(record, collection);
        if (UOS.ProgramStatus.codeFor(domain, record.status) !== UOS.ProgramStatus.reviewCode) return;
        result.issues.push({ code: "STATUS_REVIEW_REQUIRED", contractId: "PC-012", severity: "warning", collection: collection, entityId: record.id, field: "status", relatedIds: [], message: "Imported status ‘" + (record.legacyStatus || record.status) + "’ requires officer resolution.", repair: null });
      });
    });
    var readiness = workspace && workspace.migration && workspace.migration.statusReadiness;
    if (readiness && readiness.status === "review-required") result.issues.push({ code: "STATUS_MIGRATION_READINESS", contractId: "PC-012", severity: "warning", collection: "migration", entityId: "status-readiness", field: "migration.statusReadiness", relatedIds: [], message: "Status migration readiness review is pending; automation remains paused until an attributed officer enables it.", repair: null });
    result.issues.sort(function (a, b) { return (a.contractId || "ZZZ").localeCompare(b.contractId || "ZZZ") || a.code.localeCompare(b.code) || a.entityId.localeCompare(b.entityId); });
    result.counts = result.issues.reduce(function (counts, item) { counts[item.severity] = (counts[item.severity] || 0) + 1; counts.total += 1; return counts; }, { error: 0, warning: 0, total: 0 });
    result.status = result.counts.error ? "error" : result.counts.warning ? "warning" : "healthy";
    return result;
  };
}());
