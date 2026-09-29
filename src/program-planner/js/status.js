(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.UOS = root.UOS || {}; root.UOS.ProgramStatus = api; }
}(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function () {
  "use strict";

  var SCHEMA_VERSION = 5;
  var ENGINE_ACTOR = "Status engine";
  var REVIEW = "review_required";
  var DEFINITIONS = {
    register_nsa: {
      labels: { received: "Received", quoted: "Quoted", scheduled: "Scheduled", in_progress: "In Progress", complete: "Complete", cancelled: "Cancelled", review_required: "Review required" },
      order: ["received", "quoted", "scheduled", "in_progress", "complete"], terminal: ["complete", "cancelled"]
    },
    register_evt: {
      labels: { received: "Received", report_sent: "Report Completed and Sent", quoted: "Quoted", planning: "Planning", scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled", review_required: "Review required" },
      order: ["received", "report_sent", "quoted", "planning", "scheduled", "completed"], terminal: ["completed", "cancelled"]
    },
    project: {
      labels: { draft: "Draft", planning: "Planning", in_delivery: "In Delivery", on_hold: "On Hold", complete: "Complete", cancelled: "Cancelled", review_required: "Review required" },
      order: ["draft", "planning", "in_delivery", "complete"], terminal: ["complete", "cancelled"]
    },
    task: {
      labels: { not_started: "Not Started", in_progress: "In Progress", complete: "Complete", on_hold: "On Hold", not_applicable: "N/A", review_required: "Review required" },
      order: ["not_started", "in_progress", "complete"], terminal: ["complete", "not_applicable"]
    },
    job: {
      labels: { draft: "Draft", scheduled: "Scheduled", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled", review_required: "Review required" },
      order: ["draft", "scheduled", "in_progress", "completed"], terminal: ["completed", "cancelled"]
    }
  };
  var COLLECTION_DOMAIN = { applications: "register_nsa", events: "register_evt", projects: "project", tasks: "task", jobs: "job" };
  var TYPE_COLLECTION = { application: "applications", event: "events", project: "projects", task: "tasks", job: "jobs" };

  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function token(value) { return text(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
  function timestamp(value) { return text(value) || new Date().toISOString(); }
  function hash(value) { var result = 2166136261; String(value).split("").forEach(function (character) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); }); return (result >>> 0).toString(36).toUpperCase().padStart(7, "0"); }
  function domainFor(record, collection) {
    if (COLLECTION_DOMAIN[collection]) return COLLECTION_DOMAIN[collection];
    var type = text(record && record.type).toLowerCase();
    if (type === "application") return "register_nsa";
    if (type === "event") return "register_evt";
    return DEFINITIONS[type] ? type : "";
  }
  function aliases(domain) {
    var map = {};
    var definition = DEFINITIONS[domain];
    if (!definition) return map;
    Object.keys(definition.labels).forEach(function (code) { map[token(code)] = code; map[token(definition.labels[code])] = code; });
    if (domain === "register_evt") map.planned = "planning";
    if (domain === "job") { map.complete = "completed"; map.planned = "scheduled"; map.unscheduled = "draft"; }
    if (domain === "task") { map.na = "not_applicable"; map.n_a = "not_applicable"; }
    return map;
  }
  function codeFor(domain, value, options) {
    var raw = text(value), code = aliases(domain)[token(raw)];
    if (code) return code;
    if (!raw && options && options.defaultCode) return options.defaultCode;
    return REVIEW;
  }
  function labelFor(domain, value) {
    var code = codeFor(domain, value);
    return DEFINITIONS[domain] && DEFINITIONS[domain].labels[code] || "Review required";
  }
  function vocabulary(domain) {
    var definition = DEFINITIONS[domain];
    return definition ? Object.keys(definition.labels).map(function (code) { return { code: code, label: definition.labels[code] }; }) : [];
  }
  function rank(domain, code) { return DEFINITIONS[domain] ? DEFINITIONS[domain].order.indexOf(code) : -1; }
  function reasonRequired(domain, from, to) {
    if (to === "on_hold" || to === "cancelled") return true;
    if (DEFINITIONS[domain] && DEFINITIONS[domain].terminal.indexOf(from) >= 0 && to !== from) return true;
    var fromRank = rank(domain, from), toRank = rank(domain, to);
    return fromRank >= 0 && toRank >= 0 && toRank < fromRank;
  }
  function canTransition(domain, fromValue, toValue) {
    var from = codeFor(domain, fromValue), to = codeFor(domain, toValue);
    if (!DEFINITIONS[domain] || from === REVIEW || to === REVIEW || from === to) return from === to;
    if (to === "cancelled") return DEFINITIONS[domain].terminal.indexOf(from) < 0;
    if (to === "on_hold") return domain === "project" || domain === "task";
    if (from === "on_hold") return domain === "project" ? ["planning", "in_delivery", "cancelled"].indexOf(to) >= 0 : ["not_started", "in_progress", "complete", "not_applicable"].indexOf(to) >= 0;
    var a = rank(domain, from), b = rank(domain, to);
    return a >= 0 && b >= 0 && (b === a + 1 || b < a || DEFINITIONS[domain].terminal.indexOf(from) >= 0);
  }
  function canHumanTransition(domain, fromValue, toValue) {
    var to = codeFor(domain, toValue);
    if ((domain === "register_nsa" || domain === "register_evt") && to === "quoted") return false;
    return canTransition(domain, fromValue, toValue);
  }
  function collectionAndRecord(workspace, entityId, entityType) {
    var entities = workspace.entities || {}, preferred = TYPE_COLLECTION[text(entityType).toLowerCase()];
    var names = preferred ? [preferred] : Object.keys(COLLECTION_DOMAIN);
    for (var index = 0; index < names.length; index += 1) {
      var collection = names[index], record = (entities[collection] || []).find(function (item) { return item.id === entityId; });
      if (record) return { collection: collection, record: record, domain: domainFor(record, collection) };
    }
    return null;
  }
  function eventId(owner, recordId, from, to, at, source) { return owner + "-SEVT-" + hash([recordId, from, to, at, source].join(":")); }
  function recommendationId(owner, kind, entityId, to) { return owner + "-SREC-" + hash([kind, entityId, to].join(":")); }
  function transition(input, command) {
    var workspace = clone(input), found = collectionAndRecord(workspace, text(command && command.entityId), command && command.entityType);
    if (!found) throw new Error("Status target was not found.");
    var source = text(command.source) || "human", automatic = source === "automatic";
    var actor = automatic ? ENGINE_ACTOR : text(command.actor || workspace.statusControl && workspace.statusControl.operatorName);
    var to = codeFor(found.domain, command.to);
    var from = codeFor(found.domain, found.record.status, { defaultCode: found.collection === "applications" || found.collection === "events" ? "received" : found.collection === "projects" || found.collection === "jobs" ? "draft" : "not_started" });
    if (command.expectedRevision != null && Number(command.expectedRevision) !== Number(workspace.workspaceRevision)) throw new Error("Workspace changed before the status action was applied.");
    if (!automatic && !actor) throw new Error("Enter a session operator name before changing status.");
    if (from === REVIEW) throw new Error("This imported status requires officer resolution before automation or transition.");
    if (to === REVIEW) throw new Error("Review required is reserved for unrecognised imported values.");
    if (from === to) return workspace;
    if ((found.domain === "register_nsa" || found.domain === "register_evt") && to === "quoted") {
      if (!automatic) throw new Error("Quoted is established automatically when the current linked Quote is issued.");
      if (!quoteSignalEligible(workspace, found.record, command.signalQuoteId)) throw new Error("Quoted requires an issued current Quote linked through this Register's Project.");
    }
    var automaticForward = automatic && rank(found.domain, from) >= 0 && rank(found.domain, to) > rank(found.domain, from);
    var eligibleCompletion = found.domain === "project" && to === "complete" && projectEligible(workspace, found.record.id);
    var approvedRegisterCompletion = (found.domain === "register_nsa" || found.domain === "register_evt") && text(command.action) === "Approved status recommendation" && (to === "complete" || to === "completed");
    if (!canTransition(found.domain, from, to) && !automaticForward && !eligibleCompletion && !approvedRegisterCompletion) throw new Error("The requested status transition is not allowed.");
    if (reasonRequired(found.domain, from, to) && !text(command.reason)) throw new Error("A reason is required for this status transition.");
    var at = timestamp(command.at), id = eventId(found.record.owner, found.record.id, from, to, at, source);
    workspace.entities.statusEvents = Array.isArray(workspace.entities.statusEvents) ? workspace.entities.statusEvents : [];
    if (workspace.entities.statusEvents.some(function (item) { return item.id === id; })) return workspace;
    found.record.status = to;
    found.record.updatedAt = at;
    workspace.entities.statusEvents.push({ id: id, owner: found.record.owner, type: "statusEvent", entityId: found.record.id, entityType: found.record.type, domain: found.domain, fromStatus: from, toStatus: to, action: text(command.action) || (labelFor(found.domain, from) + " to " + labelFor(found.domain, to)), reason: text(command.reason), actor: actor, timestamp: at, source: source, initiatingOperator: automatic ? text(command.initiatingOperator || workspace.statusControl && workspace.statusControl.operatorName) : "" });
    return workspace;
  }
  function addRecommendation(workspace, values) {
    workspace.entities.statusRecommendations = Array.isArray(workspace.entities.statusRecommendations) ? workspace.entities.statusRecommendations : [];
    var id = recommendationId(values.owner, values.kind, values.entityId, values.toStatus);
    if (workspace.entities.statusRecommendations.some(function (item) { return item.id === id && item.status === "open"; })) return false;
    workspace.entities.statusRecommendations.push({ id: id, owner: values.owner, type: "statusRecommendation", kind: values.kind, entityId: values.entityId, entityType: values.entityType, fromStatus: values.fromStatus, toStatus: values.toStatus, message: values.message, status: "open", createdAt: timestamp(values.at), retrospective: values.retrospective === true });
    return true;
  }
  function projectEligible(workspace, projectId) {
    var jobs = (workspace.entities.jobs || []).filter(function (item) { return item.projectId === projectId; });
    var tasks = (workspace.entities.tasks || []).filter(function (item) { return item.projectId === projectId && item.suppressed !== true; });
    return jobs.length > 0 && jobs.filter(function (job) { return codeFor("job", job.status) !== "cancelled"; }).every(function (job) { return codeFor("job", job.status) === "completed"; }) && tasks.every(function (task) { return ["complete", "not_applicable"].indexOf(codeFor("task", task.status)) >= 0; });
  }
  function linkedRegister(workspace, project) { var id = text(project.applicationId || project.eventId); return id ? collectionAndRecord(workspace, id) : null; }
  function currentQuote(workspace, projectId) {
    var quotes = (workspace.entities.quotes || []).filter(function (quote) { return quote.projectId === projectId; });
    quotes.sort(function (left, right) { return Number(right.revision || 1) - Number(left.revision || 1) || text(right.auditNumber).localeCompare(text(left.auditNumber)) || text(right.id).localeCompare(text(left.id)); });
    return quotes[0] || null;
  }
  function quoteSignalEligible(workspace, register, quoteId) {
    var quote = (workspace.entities.quotes || []).find(function (item) { return item.id === text(quoteId); });
    if (!quote || text(quote.status).toLowerCase() !== "issued" || text(quote.supersededByQuoteId)) return false;
    var project = (workspace.entities.projects || []).find(function (item) { return item.id === quote.projectId; });
    if (!project || project.owner !== register.owner || text(project.applicationId || project.eventId) !== register.id) return false;
    var current = currentQuote(workspace, project.id);
    return Boolean(current && current.id === quote.id);
  }
  function evaluate(input, options) {
    var workspace = clone(input), settings = options || {}, retrospective = settings.retrospective === true;
    (workspace.entities.projects || []).forEach(function (project) {
      var projectCode = codeFor("project", project.status, { defaultCode: "draft" });
      if (projectCode === REVIEW) return;
      var jobs = (workspace.entities.jobs || []).filter(function (job) { return job.projectId === project.id; });
      if (jobs.some(function (job) { return codeFor("job", job.status) === "in_progress"; }) && ["draft", "planning"].indexOf(projectCode) >= 0) addRecommendation(workspace, { kind: "project_in_delivery", entityId: project.id, entityType: "project", owner: project.owner, fromStatus: projectCode, toStatus: "in_delivery", message: "A Job has started. Review Project delivery status.", retrospective: retrospective });
      if (projectEligible(workspace, project.id) && projectCode !== "complete") addRecommendation(workspace, { kind: "project_completion", entityId: project.id, entityType: "project", owner: project.owner, fromStatus: projectCode, toStatus: "complete", message: "All active Jobs and required Tasks satisfy the completion gate.", retrospective: retrospective });
      if (projectCode === "complete") {
        var register = linkedRegister(workspace, project);
        if (register && codeFor(register.domain, register.record.status) !== REVIEW) addRecommendation(workspace, { kind: "register_completion", entityId: register.record.id, entityType: register.record.type, owner: register.record.owner, fromStatus: codeFor(register.domain, register.record.status), toStatus: register.domain === "register_evt" ? "completed" : "complete", message: "The linked Project is complete. Review Register completion.", retrospective: retrospective });
      }
    });
    return workspace;
  }
  function automationEnabled(workspace, record) { return Boolean(workspace.statusControl && workspace.statusControl.automationEnabled && !(record && record.statusAutomationPaused)); }
  function runAutomatic(input, options) {
    var workspace = clone(input), before = options && options.before || null, at = options && options.at;
    if (!workspace.statusControl || !workspace.statusControl.automationEnabled) return evaluate(workspace, options);
    var priorQuotes = {}, priorJobs = {};
    if (before && before.entities) { (before.entities.quotes || []).forEach(function (item) { priorQuotes[item.id] = item.status; }); (before.entities.jobs || []).forEach(function (item) { priorJobs[item.id] = item.status; }); }
    (workspace.entities.quotes || []).forEach(function (quote) {
      if (text(quote.status).toLowerCase() !== "issued" || text(priorQuotes[quote.id]).toLowerCase() === "issued") return;
      var project = (workspace.entities.projects || []).find(function (item) { return item.id === quote.projectId; }), register = project && linkedRegister(workspace, project);
      if (register && quoteSignalEligible(workspace, register.record, quote.id) && automationEnabled(workspace, register.record) && codeFor(register.domain, register.record.status) !== "quoted") workspace = transition(workspace, { entityId: register.record.id, entityType: register.record.type, to: "quoted", source: "automatic", signalQuoteId: quote.id, at: at, action: "Quote issued", initiatingOperator: options && options.initiatingOperator });
    });
    (workspace.entities.jobs || []).forEach(function (job) {
      var current = codeFor("job", job.status), prior = codeFor("job", priorJobs[job.id]);
      if (current === prior) return;
      var project = (workspace.entities.projects || []).find(function (item) { return item.id === job.projectId; }), register = project && linkedRegister(workspace, project);
      if (!register || !automationEnabled(workspace, register.record)) return;
      var target = current === "scheduled" ? "scheduled" : (current === "in_progress" && register.domain === "register_nsa" ? "in_progress" : "");
      if (target && codeFor(register.domain, register.record.status) !== target) workspace = transition(workspace, { entityId: register.record.id, entityType: register.record.type, to: target, source: "automatic", at: at, action: current === "scheduled" ? "First active Job scheduled" : "NSA Job started", initiatingOperator: options && options.initiatingOperator });
    });
    return evaluate(workspace, options);
  }
  function reconcileMutation(beforeInput, afterInput, options) {
    var before = beforeInput || { entities: {} }, workspace = clone(afterInput), settings = options || {};
    workspace.entities = workspace.entities || {};
    Object.keys(COLLECTION_DOMAIN).forEach(function (collection) {
      var prior = {};
      ((before.entities && before.entities[collection]) || []).forEach(function (item) { prior[item.id] = item; });
      (workspace.entities[collection] || []).forEach(function (record) {
        var domain = COLLECTION_DOMAIN[collection], existing = prior[record.id];
        if (!existing) {
          record.status = collection === "applications" || collection === "events" ? "received" : collection === "projects" || collection === "jobs" ? "draft" : "not_started";
          delete record.statusHistory; if (record.payload && typeof record.payload === "object") delete record.payload.statusHistory;
          workspace.entities.statusEvents = Array.isArray(workspace.entities.statusEvents) ? workspace.entities.statusEvents : [];
          var establishedAt = timestamp(settings.at || record.createdAt || record.updatedAt), establishedId = eventId(record.owner, record.id, "", record.status, establishedAt, "automatic");
          if (!workspace.entities.statusEvents.some(function (item) { return item.id === establishedId; })) workspace.entities.statusEvents.push({ id: establishedId, owner: record.owner, type: "statusEvent", entityId: record.id, entityType: record.type, domain: domain, fromStatus: "", toStatus: record.status, action: collection === "applications" || collection === "events" ? "Register received" : "Initial status established", reason: "", actor: ENGINE_ACTOR, timestamp: establishedAt, source: "automatic", initiatingOperator: text(settings.actor) });
          return;
        }
        var from = codeFor(domain, existing.status), to = codeFor(domain, record.status);
        if (from === to) { record.status = from; return; }
        record.status = from;
        workspace = transition(workspace, { entityId: record.id, entityType: record.type, to: to, actor: settings.actor, reason: settings.reason, source: settings.source || "human", at: settings.at, action: settings.action, expectedRevision: settings.expectedRevision });
      });
    });
    return runAutomatic(workspace, { before: before, at: settings.at, initiatingOperator: settings.actor });
  }
  function migrate(input, options) {
    var workspace = clone(input), sourceVersion = Number(workspace.schemaVersion), at = text(workspace.updatedAt) || "1970-01-01T00:00:00.000Z";
    workspace.entities = object(workspace.entities) ? workspace.entities : {};
    workspace.entities.statusEvents = Array.isArray(workspace.entities.statusEvents) ? workspace.entities.statusEvents : [];
    workspace.entities.statusRecommendations = Array.isArray(workspace.entities.statusRecommendations) ? workspace.entities.statusRecommendations : [];
    Object.keys(COLLECTION_DOMAIN).forEach(function (collection) {
      (workspace.entities[collection] || []).forEach(function (record) {
        var domain = COLLECTION_DOMAIN[collection], raw = text(record.status), fallback = collection === "applications" || collection === "events" ? "received" : collection === "projects" || collection === "jobs" ? "draft" : "not_started", code = codeFor(domain, raw, { defaultCode: fallback });
        if (code === REVIEW && raw) { record.legacyStatus = raw; record.statusReviewRequired = true; }
        record.status = code;
        var history = Array.isArray(record.statusHistory) ? record.statusHistory : [];
        history.forEach(function (entry, index) {
          var historyRaw = text(entry && entry.status), historyCode = codeFor(domain, historyRaw, { defaultCode: fallback });
          var eventAt = text(entry && (entry.timestamp || entry.date)) || at;
          var id = record.owner + "-SEVT-" + hash(["legacy", record.id, index, historyRaw, eventAt].join(":"));
          if (!workspace.entities.statusEvents.some(function (item) { return item.id === id; })) workspace.entities.statusEvents.push({ id: id, owner: record.owner, type: "statusEvent", entityId: record.id, entityType: record.type, domain: domain, fromStatus: "", toStatus: historyCode, action: "Legacy status history", reason: text(entry && entry.reason), actor: text(entry && entry.actor), timestamp: eventAt, source: "migration", legacyNarrative: text(entry && entry.notes), legacyStatus: historyCode === REVIEW ? historyRaw : "" });
        });
        delete record.statusHistory;
      });
    });
    var migrated = sourceVersion < SCHEMA_VERSION;
    workspace.statusControl = object(workspace.statusControl) ? workspace.statusControl : {};
    if (workspace.statusControl.automationEnabled == null) workspace.statusControl.automationEnabled = migrated ? false : !(options && options.migrated);
    workspace.statusControl.operatorName = text(workspace.statusControl.operatorName);
    workspace.statusControl.enabledBy = text(workspace.statusControl.enabledBy);
    workspace.statusControl.enabledAt = text(workspace.statusControl.enabledAt);
    workspace.schemaVersion = SCHEMA_VERSION;
    workspace.migration = object(workspace.migration) ? workspace.migration : {};
    if (migrated) {
      workspace.migration.statusReadiness = { status: "review-required", sourceSchemaVersion: sourceVersion, targetSchemaVersion: SCHEMA_VERSION, automationPaused: true, unknownStatusCount: Object.keys(COLLECTION_DOMAIN).reduce(function (sum, collection) { return sum + (workspace.entities[collection] || []).filter(function (record) { return record.status === REVIEW; }).length; }, 0), generatedAt: at };
      workspace = evaluate(workspace, { retrospective: true, at: at });
    }
    return workspace;
  }
  function resolveRecommendation(input, id, decision, command) {
    var workspace = clone(input), recommendation = (workspace.entities.statusRecommendations || []).find(function (item) { return item.id === id; });
    if (!recommendation || recommendation.status !== "open") return workspace;
    if (decision === "approve") workspace = transition(workspace, { entityId: recommendation.entityId, entityType: recommendation.entityType, to: recommendation.toStatus, actor: command && command.actor, reason: command && command.reason, source: "human", at: command && command.at, action: "Approved status recommendation" });
    recommendation = (workspace.entities.statusRecommendations || []).find(function (item) { return item.id === id; });
    recommendation.status = decision === "approve" ? "approved" : "dismissed";
    recommendation.resolvedAt = timestamp(command && command.at);
    recommendation.resolvedBy = text(command && command.actor || workspace.statusControl && workspace.statusControl.operatorName);
    return workspace;
  }

  return { schemaVersion: SCHEMA_VERSION, engineActor: ENGINE_ACTOR, reviewCode: REVIEW, definitions: clone(DEFINITIONS), domainFor: domainFor, vocabulary: vocabulary, codeFor: codeFor, labelFor: labelFor, canTransition: canTransition, canHumanTransition: canHumanTransition, reasonRequired: reasonRequired, transition: transition, evaluate: evaluate, runAutomatic: runAutomatic, reconcileMutation: reconcileMutation, completionEligible: projectEligible, migrate: migrate, resolveRecommendation: resolveRecommendation };
}));
