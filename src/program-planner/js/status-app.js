(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {}, app = UOS.ProgramApp, status = UOS.ProgramStatus;
  if (!app || !status) throw new Error("ProgramApp and ProgramStatus must load before status-app.");
  var originalUpdate = app.updateWorkspace;
  function operator() { try { return String(sessionStorage.getItem("uos.program.statusOperator") || "").trim(); } catch (error) { return ""; } }
  function update(mutator, options) {
    options = options || {};
    return originalUpdate(function (candidate) {
      var before = app.workspace(), next = mutator(candidate) || candidate;
      return status.reconcileMutation(before, next, { actor: options.actor || operator(), reason: options.reason, action: options.command, source: options.source, at: options.at, expectedRevision: before.workspaceRevision });
    }, options);
  }
  function executeStatusCommand(command) {
    command = command || {};
    var actor = String(command.actor || operator()).trim();
    return originalUpdate(function (candidate) {
      var next = status.transition(candidate, Object.assign({}, command, { actor: actor, expectedRevision: candidate.workspaceRevision }));
      if (command.entityType === "project" && command.to === "planning") {
        var project = (next.entities.projects || []).find(function (item) { return item.id === command.entityId; });
        var register = project && project.owner === "EVT" && (next.entities.events || []).find(function (item) { return item.id === project.eventId; });
        var registerCode = register ? status.codeFor("register_evt", register.status) : status.reviewCode;
        if (register && registerCode !== status.reviewCode && !register.statusAutomationPaused && next.statusControl && next.statusControl.automationEnabled && status.definitions.register_evt.order.indexOf(registerCode) < status.definitions.register_evt.order.indexOf("planning")) next = status.transition(next, { entityId: register.id, entityType: "event", to: "planning", source: "automatic", initiatingOperator: actor, at: command.at, action: "Project planning started" });
      }
      return status.runAutomatic(next, { before: candidate, initiatingOperator: actor, at: command.at });
    }, { command: command.command || "ProgramStatus.transition" });
  }
  function resolveRecommendation(id, decision, values) {
    values = values || {}; var actor = String(values.actor || operator()).trim();
    return originalUpdate(function (candidate) { return status.resolveRecommendation(candidate, id, decision, { actor: actor, reason: values.reason, at: values.at }); }, { command: "ProgramStatus.resolveRecommendation" });
  }
  function setAutomation(enabled, actor) {
    actor = String(actor || operator()).trim();
    if (enabled && !actor) return Promise.reject(new Error("Enter a session operator name before enabling automation."));
    return originalUpdate(function (candidate) {
      candidate.statusControl = candidate.statusControl || {};
      candidate.statusControl.automationEnabled = Boolean(enabled);
      if (enabled) { candidate.statusControl.enabledBy = actor; candidate.statusControl.enabledAt = new Date().toISOString(); if (candidate.migration && candidate.migration.statusReadiness) { candidate.migration.statusReadiness.status = "ready"; candidate.migration.statusReadiness.reviewedBy = actor; candidate.migration.statusReadiness.reviewedAt = candidate.statusControl.enabledAt; } }
      return candidate;
    }, { command: "ProgramStatus.setAutomation" });
  }
  function setRecordPause(entityId, paused) {
    return originalUpdate(function (candidate) {
      var found;
      ["applications", "events", "projects", "jobs", "tasks"].some(function (collection) { found = (candidate.entities[collection] || []).find(function (item) { return item.id === entityId; }); return Boolean(found); });
      if (!found) throw new Error("Status target was not found.");
      found.statusAutomationPaused = Boolean(paused); found.statusAutomationPausedAt = paused ? new Date().toISOString() : "";
      return candidate;
    }, { command: "ProgramStatus.setRecordPause" });
  }
  app.updateWorkspace = update;
  app.executeStatusCommand = executeStatusCommand;
  app.resolveStatusRecommendation = resolveRecommendation;
  app.setStatusAutomation = setAutomation;
  app.setRecordStatusPause = setRecordPause;
}());
