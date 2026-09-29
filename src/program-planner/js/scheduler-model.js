(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var DAY_MS = 86400000;
  var GENERIC_LOCATIONS = { "": true, "tbd": true, "various": true, "unassigned": true, "unassigned location": true };

  function text(value) { return String(value == null ? "" : value).trim(); }
  function isoDate(value) {
    var result = text(value);
    var parsed = Date.parse(result + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== result) return "";
    return result;
  }
  function dateAt(value) { return new Date(isoDate(value) + "T00:00:00Z"); }
  function dateString(value) { return value.toISOString().slice(0, 10); }
  function addDays(value, count) {
    var date = dateAt(value);
    if (Number.isNaN(date.getTime())) return "";
    date.setUTCDate(date.getUTCDate() + Number(count || 0));
    return dateString(date);
  }
  function mondayOfWeek(value) {
    var date = dateAt(value);
    if (Number.isNaN(date.getTime())) return "";
    var offset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - offset);
    return dateString(date);
  }
  function weekDays(value) {
    var monday = mondayOfWeek(value);
    if (!monday) return [];
    return Array.from({ length: 7 }, function (_, index) { return addDays(monday, index); });
  }
  function monthGrid(value) {
    var supplied = text(value);
    var date = isoDate(/^\d{4}-\d{2}$/.test(supplied) ? supplied + "-01" : supplied);
    if (!date) return [];
    var month = date.slice(0, 7);
    var start = mondayOfWeek(month + "-01");
    var last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
    var end = addDays(mondayOfWeek(dateString(last)), 6);
    var days = [];
    for (var cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      days.push({ date: cursor, inMonth: cursor.slice(0, 7) === month });
    }
    return days;
  }
  function validTime(value) { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }
  function minutes(value) { return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)); }
  function ownerLabel(owner) { return owner === "NSA" ? "Nature Strip" : owner === "EVT" ? "Remediation" : text(owner) || "Unassigned"; }
  var SOURCE_LABELS = { calculator: "Calculator", "space-map": "Space Map", planner: "Planner", legacy: "Legacy" };
  function canonicalSourceKind(raw) {
    raw = raw && typeof raw === "object" ? raw : { sourceKind: raw };
    var explicit = text(raw.sourceKind).toLowerCase().replace(/[\s_]+/g, "-");
    if (explicit === "spacemap") explicit = "space-map";
    if (["calculator", "space-map", "planner", "legacy"].indexOf(explicit) >= 0) return explicit;
    var app = text(raw.provenance && raw.provenance.sourceApp).toLowerCase();
    if (app.indexOf("job-calculator") >= 0 || app.indexOf("costing") >= 0) return "calculator";
    if (app.indexOf("work-area") >= 0 || raw.sourceGeometryId || raw.geometryId) return "space-map";
    if (app.indexOf("planner") >= 0 || raw.taskId) return "planner";
    return "legacy";
  }
  function sourceLabel(value) { return SOURCE_LABELS[canonicalSourceKind(value)] || SOURCE_LABELS.legacy; }
  function sourceKind(raw) { var kind = canonicalSourceKind(raw); return kind === "space-map" ? "SpaceMap" : SOURCE_LABELS[kind]; }
  function normalizeJob(raw, index) {
    raw = raw && typeof raw === "object" ? raw : {};
    var startDate = isoDate(raw.startDate || raw.date);
    var endDate = isoDate(raw.endDate || startDate) || startDate;
    var startTime = text(raw.startTime);
    var endTime = text(raw.endTime);
    var allDay = raw.allDay === true || (!startTime && !endTime);
    if (!startDate) throw new Error("Job " + (index + 1) + " requires a valid startDate.");
    if (endDate < startDate) throw new Error("Job " + (index + 1) + " endDate must not precede startDate.");
    if (!allDay && (!validTime(startTime) || !validTime(endTime))) throw new Error("Job " + (index + 1) + " requires valid start and end times.");
    var startMs = Date.parse(startDate + "T" + (allDay ? "00:00" : startTime) + ":00Z");
    var endMs = allDay ? Date.parse(addDays(endDate, 1) + "T00:00:00Z") : Date.parse(endDate + "T" + endTime + ":00Z");
    if (endMs <= startMs) throw new Error("Job " + (index + 1) + " end must be after start.");
    var owner = text(raw.owner);
    return Object.assign({}, raw, {
      id: text(raw.id) || "scheduler-job-" + (index + 1), owner: owner,
      ownerLabel: ownerLabel(owner), categoryLabel: ownerLabel(owner),
      title: text(raw.title || raw.name) || "Untitled job", startDate: startDate, endDate: endDate,
      startTime: allDay ? "" : startTime, endTime: allDay ? "" : endTime, allDay: allDay,
      durationMinutes: Math.round((endMs - startMs) / 60000), crewId: text(raw.crewId || raw.crew),
      locationId: text(raw.locationId), location: text(raw.location), sourceKind: sourceKind(raw), canonicalSourceKind: canonicalSourceKind(raw), sourceLabel: sourceLabel(raw), sourceEntityId: text(raw.sourceEntityId || raw.taskId || raw.sourceGeometryId || raw.geometryId || raw.provenance && raw.provenance.sourceId) || null, _startMs: startMs, _endMs: endMs
    });
  }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function programModel() {
    var api = UOS.ProgramModel || UOS.programModel;
    if (!api || typeof api.normalize !== "function") throw new Error("ProgramModel is required for Scheduler intake.");
    return api;
  }
  function sourceCollections(kind) {
    return kind === "planner" ? ["tasks"] : kind === "space-map" ? ["geometries"] : kind === "calculator" ? ["costingLines", "rateItems"] : [];
  }
  function resolveSourceRecord(workspace, jobOrKind, sourceEntityId) {
    var raw = jobOrKind && typeof jobOrKind === "object" ? jobOrKind : { sourceKind: jobOrKind, sourceEntityId: sourceEntityId };
    var kind = canonicalSourceKind(raw), id = text(raw.sourceEntityId || sourceEntityId);
    if (kind === "legacy") return { kind: kind, label: sourceLabel(kind), sourceEntityId: id || null, state: "legacy", record: null, collection: null };
    if (!id) return { kind: kind, label: sourceLabel(kind), sourceEntityId: null, state: "missing-source-id", record: null, collection: null };
    var entities = workspace && workspace.entities || {}, found = null, collection = null;
    sourceCollections(kind).some(function (name) {
      found = (Array.isArray(entities[name]) ? entities[name] : []).find(function (item) { return item && item.id === id; }) || null;
      if (found) collection = name;
      return Boolean(found);
    });
    /* Calculator creates one canonical Labour job per Project and gives it a
       stable project-level source identity. Costing lines keep their own IDs,
       so resolve that identity through the linked Project/Job relationship. */
    if (!found && kind === "calculator" && raw && typeof raw === "object") {
      var projectId = text(raw.projectId), jobId = text(raw.id);
      found = (Array.isArray(entities.costingLines) ? entities.costingLines : []).find(function (item) {
        return item && (jobId && item.jobId === jobId || projectId && item.projectId === projectId);
      }) || null;
      if (found) collection = "costingLines";
    }
    return { kind: kind, label: sourceLabel(kind), sourceEntityId: id, state: found ? "linked" : "orphaned", record: found ? clone(found) : null, collection: collection };
  }
  function sourceTrace(workspace, job) {
    var trace = resolveSourceRecord(workspace, job);
    if (trace.state !== "linked") return trace;
    var project = (workspace.entities.projects || []).find(function (item) { return item.id === job.projectId; });
    if (!project) trace.state = "missing-project";
    else if (job.owner !== project.owner) trace.state = "owner-mismatch";
    else if (trace.record.owner && trace.record.owner !== job.owner) trace.state = "source-owner-mismatch";
    else if (trace.record.projectId && trace.record.projectId !== job.projectId) trace.state = "source-project-mismatch";
    return trace;
  }
  function duplicateSources(workspace, kind, sourceEntityId) {
    var wantedKind = canonicalSourceKind(kind), wantedId = text(sourceEntityId);
    return (workspace.entities.jobs || []).filter(function (job) {
      return canonicalSourceKind(job) === wantedKind && text(job.sourceEntityId) === wantedId;
    });
  }
  function upsertIntake(input, values, options) {
    var api = programModel(), workspace = api.normalize(clone(input)), raw = values && typeof values === "object" ? clone(values) : {}, kind = canonicalSourceKind(raw);
    if (["calculator", "space-map", "planner"].indexOf(kind) < 0) throw new Error("Scheduler intake sourceKind must be calculator, space-map, or planner.");
    var sourceEntityId = text(raw.sourceEntityId || raw.taskId || raw.sourceGeometryId || raw.geometryId);
    if (!sourceEntityId) throw new Error("Scheduler intake requires sourceEntityId.");
    var project = workspace.entities.projects.find(function (item) { return item.id === text(raw.projectId); });
    if (!project) throw new Error("Scheduler intake requires an existing Project.");
    var owner = text(raw.owner || project.owner);
    if (owner !== project.owner) throw new Error("Scheduler intake owner must match its Project.");
    var trace = resolveSourceRecord(workspace, kind, sourceEntityId);
    if (trace.state !== "linked") throw new Error(sourceLabel(kind) + ' source "' + sourceEntityId + '" was not found.');
    if (trace.record.owner && trace.record.owner !== owner) throw new Error("Scheduler intake source owner must match its Project.");
    if (trace.record.projectId && trace.record.projectId !== project.id) throw new Error("Scheduler intake source must belong to its Project.");
    var duplicates = duplicateSources(workspace, kind, sourceEntityId);
    if (duplicates.length > 1) throw new Error("Multiple Scheduler jobs use the same source identity.");
    if (duplicates.length === 1) {
      var existingTrace = sourceTrace(workspace, duplicates[0]);
      if (duplicates[0].projectId !== project.id || duplicates[0].owner !== owner || existingTrace.state !== "linked") throw new Error("Existing Scheduler source link is inconsistent.");
      return { workspace: workspace, job: clone(duplicates[0]), source: trace, created: false };
    }
    options = options || {};
    var at = text(options.at) || new Date().toISOString(), date = isoDate(raw.startDate || raw.date || at.slice(0, 10));
    if (!date) throw new Error("Scheduler intake requires a valid startDate.");
    var id = text(raw.id) || api.stableId(owner, "job", "scheduler:" + kind + ":" + sourceEntityId);
    if (workspace.entities.jobs.some(function (job) { return job.id === id; })) throw new Error("Scheduler intake job identity is already in use.");
    var job = Object.assign({}, raw, { id: id, owner: owner, type: "job", projectId: project.id, title: text(raw.title || raw.name) || sourceLabel(kind) + " job", status: text(raw.status) || "Unscheduled", startDate: date, endDate: isoDate(raw.endDate) || date, allDay: raw.allDay !== false, sourceKind: kind, sourceEntityId: sourceEntityId, provenance: Object.assign({}, raw.provenance || {}, { owner: owner, sourceApp: api.appId, sourceVersion: api.schemaVersion, sourceId: sourceEntityId, importedAt: at }) });
    workspace.entities.jobs.push(job); workspace.updatedAt = at; workspace = api.normalize(workspace);
    job = workspace.entities.jobs.find(function (item) { return item.id === id; });
    return { workspace: workspace, job: clone(job), source: sourceTrace(workspace, job), created: true };
  }
  function isGenericLocation(value) { return Boolean(GENERIC_LOCATIONS[text(value).toLowerCase()]); }
  function locationKey(job) {
    var location = text(job.location);
    var locationId = text(job.locationId).toLowerCase();
    if (location && isGenericLocation(location)) return "";
    return locationId || (isGenericLocation(location) ? "" : location.toLowerCase());
  }
  function overlaps(a, b) { return a._startMs < b._endMs && a._endMs > b._startMs; }
  function detectConflicts(values) {
    var jobs = (Array.isArray(values) ? values : []).map(normalizeJob);
    jobs.sort(function (a, b) { return a._startMs - b._startMs; });
    var conflicts = [];
    for (var left = 0; left < jobs.length; left += 1) {
      var a = jobs[left];
      var aCrew = a.crewId ? a.crewId.toLowerCase() : "";
      var aLoc = locationKey(a);
      if (!aCrew && !aLoc) continue;
      for (var right = left + 1; right < jobs.length; right += 1) {
        var b = jobs[right];
        if (b._startMs >= a._endMs) break;
        if (!overlaps(a, b)) continue;
        var bCrew = b.crewId ? b.crewId.toLowerCase() : "";
        var bLoc = locationKey(b);
        var sameCrew = Boolean(aCrew && aCrew === bCrew);
        var sameLocation = Boolean(aLoc && aLoc === bLoc);
        if (!sameCrew && !sameLocation) continue;
        var labels = [];
        if (sameCrew) labels.push(a.allDay || b.allDay ? "Crew Double-Booked (All-Day Job)" : "Crew Double-Booked");
        if (sameLocation) labels.push("Location Double-Booked");
        conflicts.push({ jobIds: [a.id, b.id], crew: sameCrew, location: sameLocation, allDay: a.allDay || b.allDay, labels: labels });
      }
    }
    return conflicts;
  }
  function scheduleJob(workspace, id, changes, at) {
    var programModel = UOS.ProgramModel || UOS.programModel;
    if (!programModel || typeof programModel.normalize !== "function") throw new Error("ProgramModel is required to schedule a job.");
    var next = programModel.normalize(workspace);
    var jobs = next.entities.jobs;
    var jobIndex = jobs.findIndex(function (job) { return job.id === text(id); });
    if (jobIndex < 0) throw new Error('Job "' + text(id) + '" was not found.');
    var allowed = ["title", "category", "priority", "startDate", "endDate", "startTime", "endTime", "allDay", "durationMinutes", "crewId", "locationId", "location"];
    var patch = changes && typeof changes === "object" && !Array.isArray(changes) ? changes : {};
    var unknown = Object.keys(patch).filter(function (field) { return allowed.indexOf(field) < 0; });
    if (unknown.length) throw new Error("Unsupported scheduling field" + (unknown.length === 1 ? "" : "s") + ": " + unknown.join(", ") + ".");
    var updated = Object.assign({}, jobs[jobIndex]);
    allowed.forEach(function (field) { if (Object.prototype.hasOwnProperty.call(patch, field)) updated[field] = patch[field]; });
    if (updated.allDay === true) {
      updated.startTime = "";
      updated.endTime = "";
    }
    var scheduled = normalizeJob(updated, jobIndex);
    ["title", "status", "category", "priority", "startDate", "endDate", "startTime", "endTime", "allDay", "durationMinutes", "crewId", "locationId", "location"].forEach(function (field) {
      updated[field] = scheduled[field];
    });
    jobs[jobIndex] = updated;
    if (at != null && text(at)) next.updatedAt = text(at);
    return programModel.normalize(next);
  }

  var api = {
    addDays: addDays, mondayOfWeek: mondayOfWeek, weekDays: weekDays, monthGrid: monthGrid,
    normalizeJob: normalizeJob, sourceKind: sourceKind, canonicalSourceKind: canonicalSourceKind, sourceLabel: sourceLabel,
    resolveSourceRecord: resolveSourceRecord, sourceTrace: sourceTrace, duplicateSources: duplicateSources, upsertIntake: upsertIntake,
    isGenericLocation: isGenericLocation, overlaps: overlaps, detectConflicts: detectConflicts, ownerLabel: ownerLabel, scheduleJob: scheduleJob
  };
  UOS.ProgramSchedulerModel = UOS.programSchedulerModel = api;
}());
