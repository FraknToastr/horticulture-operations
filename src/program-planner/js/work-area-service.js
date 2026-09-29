(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};

  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  var EARTH_RADIUS_M = 6371008.8;
  function commandError(code, message, details) {
    var error = new Error(message);
    error.name = "WorkAreaIntegrityError";
    error.code = code;
    Object.keys(details || {}).forEach(function (key) { error[key] = clone(details[key]); });
    return error;
  }
  function radians(value) { return Number(value) * Math.PI / 180; }
  function coordinate(value) {
    return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])) &&
      Number(value[0]) >= -180 && Number(value[0]) <= 180 && Number(value[1]) >= -90 && Number(value[1]) <= 90;
  }
  function distance(first, second) {
    var latitudeDelta = radians(Number(second[1]) - Number(first[1]));
    var longitudeDelta = radians(Number(second[0]) - Number(first[0]));
    var latitudeOne = radians(first[1]), latitudeTwo = radians(second[1]);
    var half = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeOne) * Math.cos(latitudeTwo) * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(half), Math.sqrt(1 - half));
  }
  function lineLength(points, close) {
    var total = 0;
    for (var index = 1; index < points.length; index += 1) total += distance(points[index - 1], points[index]);
    if (close && (points[0][0] !== points[points.length - 1][0] || points[0][1] !== points[points.length - 1][1])) total += distance(points[points.length - 1], points[0]);
    return total;
  }
  function ringArea(points) {
    var latitude = points.reduce(function (sum, point) { return sum + Number(point[1]); }, 0) / points.length;
    var scaleX = Math.cos(radians(latitude)) * Math.PI * EARTH_RADIUS_M / 180;
    var scaleY = Math.PI * EARTH_RADIUS_M / 180, sum = 0;
    for (var index = 0; index < points.length; index += 1) {
      var next = points[(index + 1) % points.length];
      sum += Number(points[index][0]) * scaleX * Number(next[1]) * scaleY - Number(next[0]) * scaleX * Number(points[index][1]) * scaleY;
    }
    return Math.abs(sum / 2);
  }
  function geometryValue(input) {
    if (object(input && input.geometry)) return clone(input.geometry);
    var kind = text(input && (input.geometryKind || input.geometryType || input.kind)).toLowerCase();
    if (Array.isArray(input && input.coordinates)) return { type: kind === "line" ? "LineString" : "Polygon", coordinates: clone(input.coordinates) };
    return null;
  }
  function authoritativeMeasurement(input) {
    var geometry = geometryValue(input), type = text(geometry && geometry.type);
    var areaSqM = 0, lengthM = 0, valid = true;
    function validLine(points, minimum) { return Array.isArray(points) && points.length >= minimum && points.every(coordinate); }
    function polygon(rings) {
      if (!Array.isArray(rings) || !rings.length || !validLine(rings[0], 3)) { valid = false; return; }
      areaSqM += ringArea(rings[0]); lengthM += lineLength(rings[0], true);
      rings.slice(1).forEach(function (ring) {
        if (!validLine(ring, 3)) { valid = false; return; }
        areaSqM -= ringArea(ring); lengthM += lineLength(ring, true);
      });
    }
    if (type === "Polygon") polygon(geometry.coordinates);
    else if (type === "MultiPolygon" && Array.isArray(geometry.coordinates) && geometry.coordinates.length) geometry.coordinates.forEach(polygon);
    else if (type === "LineString" && validLine(geometry.coordinates, 2)) lengthM = lineLength(geometry.coordinates, false);
    else if (type === "MultiLineString" && Array.isArray(geometry.coordinates) && geometry.coordinates.length) geometry.coordinates.forEach(function (line) {
      if (!validLine(line, 2)) valid = false; else lengthM += lineLength(line, false);
    });
    else valid = false;
    areaSqM = Math.max(0, areaSqM);
    var kind = type === "LineString" || type === "MultiLineString" ? "line" : "polygon";
    if (!valid || kind === "polygon" && !(areaSqM > 0) || kind === "line" && !(lengthM > 0)) {
      throw commandError("WORK_GEOMETRY_MEASUREMENT_INVALID", "Work Geometry coordinates must form a measurable polygon or line.", { geometryKind: kind });
    }
    return { geometry: geometry, geometryKind: kind, areaSqM: areaSqM, lengthM: lengthM };
  }
  function dependencies() {
    if (!UOS.ProgramModel || !UOS.ProgramCosting || !UOS.rateLibrary || !UOS.mapCosting) throw new Error("ProgramModel, ProgramCosting, rateLibrary, and mapCosting must load before WorkAreaService.");
    return { model: UOS.ProgramModel, costing: UOS.ProgramCosting, rates: UOS.rateLibrary, map: UOS.mapCosting };
  }
 function modelDependency() {
  var model = UOS.ProgramModel;
  if (!model || typeof model.normalize !== "function" || typeof model.stableId !== "function" ||
      typeof model.workTypeRateMapping !== "function" || typeof model.isSpatiallyCompatibleRate !== "function" ||
      typeof model.spatialQuantityForRate !== "function" || typeof model.eligibleSpatialRatesForWorkType !== "function") {
   throw new Error("ProgramModel spatial pricing authority must load before WorkAreaService commands.");
  }
  return model;
 }
  function find(values, id, label) {
    var result = values.find(function (item) { return item.id === id; });
    if (!result) throw new Error(label + ' "' + id + '" was not found.');
    return result;
  }
  function workType(geometry) {
    var payload = object(geometry.payload) ? geometry.payload : {};
    return text(geometry.workTypeKey || geometry.workType || payload.workTypeKey || payload.workType || payload.type).toLowerCase();
  }
  function canonicalWorkTypeRateItems() {
    var model = UOS.ProgramModel;
    if (model && model.canonicalWorkTypeRateItems && typeof model.canonicalWorkTypeRateItems === "object") {
      return model.canonicalWorkTypeRateItems;
    }
    return {};
  }
  function supportedWorkTypeKeys() {
    var model = UOS.ProgramModel;
    var values = model && Array.isArray(model.supportedPolygonWorkTypes) ? model.supportedPolygonWorkTypes : [];
    return values.map(function (item) { return text(item && item.key).toLowerCase(); }).filter(Boolean);
  }
  function supportedWorkType(key) { return supportedWorkTypeKeys().indexOf(text(key).toLowerCase()) >= 0; }

 function workTypeRateMapping(workspace, key) { return modelDependency().workTypeRateMapping(workspace, key); }
  function activeRateById(workspace, rateId) {
    if (!text(rateId)) return null;
    return (workspace.entities && workspace.entities.rateItems || []).find(function (item) {
      return item.id === rateId && item.active !== false && text(item.status).toLowerCase() !== "inactive";
    }) || null;
  }
 function spatiallyCompatibleRate(rate) { return modelDependency().isSpatiallyCompatibleRate(rate); }
 function spatialQuantityForRate(rate, areaSqM) { return modelDependency().spatialQuantityForRate(rate, areaSqM); }
 function eligibleSpatialRatesForWorkType(workspace, key) { return modelDependency().eligibleSpatialRatesForWorkType(workspace, key); }
 function resolveGeometryRate(workspace, geometry) {
  var payload = object(geometry && geometry.payload) ? geometry.payload : {};
  var key = workType(geometry || {});
  if (!supportedWorkType(key)) return null;
  var explicitId = text(geometry && geometry.rateItemId || payload.rateItemId);
  var eligible = eligibleSpatialRatesForWorkType(workspace, key);
  if (explicitId) return eligible.find(function (rate) { return rate.id === explicitId; }) || null;
  if (eligible.length === 1) return eligible[0];
  var defaultId = text(workTypeRateMapping(workspace, key).defaultRateItemId);
  return defaultId ? eligible.find(function (rate) { return rate.id === defaultId; }) || null : null;
 }
  function sortedIds(values) { return values.map(function (item) { return text(item && item.id); }).filter(Boolean).sort(); }
  function canonicalLineage(workspace, geometry) {
    var entities = workspace && workspace.entities || {};
    var jobs = (entities.jobs || []).filter(function (item) {
      return text(item.sourceKind) === "space-map" && text(item.sourceEntityId) === geometry.id && text(item.sourceGeometryId) === geometry.id;
    });
    var relatedJobs = (entities.jobs || []).filter(function (item) {
      return text(item.sourceEntityId) === geometry.id || text(item.sourceGeometryId) === geometry.id;
    });
    if (jobs.length > 1) throw commandError("WORK_LINEAGE_JOB_CARDINALITY", "Work Geometry must have exactly one canonical map Job.", { geometryId: geometry.id, jobIds: sortedIds(jobs) });
    if (relatedJobs.length !== jobs.length) throw commandError("WORK_LINEAGE_INCONSISTENT", "Work Geometry Job lineage contains non-canonical aliases or mismatches.", { geometryId: geometry.id, jobIds: sortedIds(relatedJobs), relatedIds: sortedIds(relatedJobs) });
    var job = jobs[0] || null;
    var lines = (entities.costingLines || []).filter(function (item) { return text(item.sourceGeometryId) === geometry.id; });
    var relatedLines = (entities.costingLines || []).filter(function (item) {
      return text(item.sourceGeometryId) === geometry.id || job && text(item.jobId) === job.id;
    });
    if (lines.length > 1) throw commandError("WORK_LINEAGE_COSTING_CARDINALITY", "Work Geometry must have exactly one canonical CostingLine.", { geometryId: geometry.id, jobIds: sortedIds(relatedJobs), costingLineIds: sortedIds(lines) });
    if (relatedLines.length !== lines.length || lines.length && (!job || text(lines[0].jobId) !== job.id)) throw commandError("WORK_LINEAGE_INCONSISTENT", "Work Geometry CostingLine lineage is inconsistent.", { geometryId: geometry.id, jobIds: sortedIds(relatedJobs), costingLineIds: sortedIds(relatedLines), relatedIds: sortedIds(relatedLines) });
    if (Boolean(job) !== Boolean(lines.length)) throw commandError("WORK_LINEAGE_INCOMPLETE", "Work Geometry lineage is incomplete.", { geometryId: geometry.id, jobIds: sortedIds(jobs), costingLineIds: sortedIds(lines) });
    if (job && (job.owner !== geometry.owner || job.projectId !== geometry.projectId)) throw commandError("WORK_LINEAGE_OWNER_MISMATCH", "Geometry and Job ownership must agree.", { geometryId: geometry.id, jobIds: sortedIds(jobs), costingLineIds: sortedIds(lines) });
    if (job && (lines[0].owner !== geometry.owner || lines[0].projectId !== geometry.projectId)) throw commandError("WORK_LINEAGE_INCONSISTENT", "Geometry and CostingLine ownership must agree.", { geometryId: geometry.id, jobIds: sortedIds(jobs), costingLineIds: sortedIds(lines), relatedIds: sortedIds(lines) });
    return { job: job, line: lines[0] || null };
  }
  function state(geometry, code, message) {
    geometry.syncState = { code: code, message: message };
  }
  function positiveQuantity(rate, measured) {
    return dependencies().rates.deriveQuantity(rate.quantityKind || "direct", measured);
  }
 function applyMappedSpatialQuantity(rate, measured) {
  measured.quantity = spatialQuantityForRate(rate, measured.areaSqM);
  return measured;
 }
  function projectForCommand(workspace, projectId) {
    var id = text(projectId);
    var project = workspace && workspace.entities && (workspace.entities.projects || []).find(function (item) { return item && item.id === id; });
    if (!project) throw commandError("WORK_GEOMETRY_PROJECT_REQUIRED", 'Delivery Project "' + id + '" was not found.', { projectId: id });
    return project;
  }
  function geometryForCommand(workspace, geometryId) {
    var id = text(geometryId);
    var geometry = workspace && workspace.entities && (workspace.entities.geometries || []).find(function (item) { return item && item.id === id; });
    if (!geometry) throw commandError("WORK_GEOMETRY_NOT_FOUND", 'Work Geometry "' + id + '" was not found.', { geometryId: id });
    return geometry;
  }
  function measuredGeometry(project, raw, existing) {
    if (!object(raw)) throw commandError("WORK_GEOMETRY_INPUT_INVALID", "Work Geometry input must be an object.");
    if (text(raw.projectId) && text(raw.projectId) !== project.id) throw commandError("WORK_GEOMETRY_RELINK_PROHIBITED", "Work Geometry cannot be relinked to another Project by create or update.", { projectId: project.id, requestedProjectId: text(raw.projectId) });
    if (text(raw.owner) && text(raw.owner) !== project.owner) throw commandError("WORK_GEOMETRY_OWNER_MISMATCH", "Work Geometry owner must match its Project.", { projectId: project.id });
    var source = existing ? clone(existing) : {};
    var patch = clone(raw), payload = Object.assign({}, object(source.payload) ? source.payload : {}, object(patch.payload) ? patch.payload : {});
    var measurement = authoritativeMeasurement({
      geometry: patch.geometry || source.geometry,
      coordinates: patch.coordinates,
      geometryKind: patch.geometryKind || patch.geometryType || source.geometryKind
    });
    Object.keys(patch).forEach(function (key) {
      if (["id", "owner", "projectId", "type", "geometry", "coordinates", "geometryKind", "geometryType", "payload", "areaSqM", "lengthM"].indexOf(key) < 0) source[key] = patch[key];
    });
    source.owner = project.owner; source.type = "geometry"; source.projectId = project.id;
    source.geometry = measurement.geometry; source.geometryKind = measurement.geometryKind;
    payload.areaSqM = measurement.areaSqM; payload.lengthM = measurement.lengthM;
    payload.valid = true; payload.type = measurement.geometryKind;
    source.payload = payload;
    return source;
  }
  function createGeometry(inputWorkspace, projectId, geometryInput) {
    var model = modelDependency(), workspace = clone(inputWorkspace), project = projectForCommand(workspace, projectId), raw = object(geometryInput) ? geometryInput : {};
    var id = text(raw.id) || model.stableId(project.owner, "geometry", text(raw.provenance && raw.provenance.sourceId) || JSON.stringify(geometryValue(raw)));
    var duplicateCollection = Object.keys(workspace.entities || {}).sort().find(function (collection) {
      return Array.isArray(workspace.entities[collection]) && workspace.entities[collection].some(function (item) { return item && item.id === id; });
    });
    if (duplicateCollection) throw commandError("WORK_GEOMETRY_ID_DUPLICATE", 'Entity ID "' + id + '" is already in use.', { geometryId: id, existingCollection: duplicateCollection });
    var geometry = measuredGeometry(project, raw, null); geometry.id = id;
    geometry.provenance = object(raw.provenance) ? clone(raw.provenance) : { owner: project.owner, sourceApp: "uos.work-area-service", sourceVersion: 1, sourceId: id };
    workspace.entities.geometries.push(geometry);
    return model.normalize(workspace);
  }
  function updateGeometry(inputWorkspace, geometryId, geometryInput) {
    var model = modelDependency(), workspace = clone(inputWorkspace), current = geometryForCommand(workspace, geometryId), project = projectForCommand(workspace, current.projectId);
    if (project.owner !== current.owner) throw commandError("WORK_GEOMETRY_OWNER_MISMATCH", "Work Geometry owner must match its Project.", { geometryId: current.id, projectId: project.id });
    if (object(geometryInput) && text(geometryInput.id) && text(geometryInput.id) !== current.id) throw commandError("WORK_GEOMETRY_ID_IMMUTABLE", "Work Geometry ID cannot be changed.", { geometryId: current.id });
    var replacement = measuredGeometry(project, geometryInput, current); replacement.id = current.id;
    workspace.entities.geometries = workspace.entities.geometries.map(function (item) { return item.id === current.id ? replacement : item; });
    return model.normalize(workspace);
  }
  function geometryDependencies(workspace, geometryId) {
    var entities = workspace && workspace.entities || {}, id = text(geometryId), jobIds = [], costingIds = [];
    (entities.jobs || []).forEach(function (item) { if (text(item.sourceGeometryId || item.geometryId) === id) jobIds.push(text(item.id)); });
    var dependencyIds = jobIds.slice();
    (entities.costingLines || []).forEach(function (item) {
      if (text(item.sourceGeometryId || item.sourcePolygonId || item.geometryId) === id || jobIds.indexOf(text(item.jobId)) >= 0) {
        costingIds.push(text(item.id)); dependencyIds.push(text(item.id));
      }
    });
    (entities.quoteLines || []).forEach(function (item) {
      if (text(item.sourceGeometryId || item.sourcePolygonId || item.geometryId) === id || jobIds.indexOf(text(item.jobId)) >= 0 || costingIds.indexOf(text(item.costingLineId)) >= 0) dependencyIds.push(text(item.id));
    });
    (entities.tasks || []).forEach(function (item) {
      if (text(item.sourceGeometryId || item.geometryId) === id || jobIds.indexOf(text(item.jobId)) >= 0) dependencyIds.push(text(item.id));
    });
    return dependencyIds.filter(Boolean).sort().filter(function (value, index, values) { return !index || value !== values[index - 1]; });
  }
  function removeGeometry(inputWorkspace, geometryId) {
    var model = modelDependency(), workspace = clone(inputWorkspace), geometry = geometryForCommand(workspace, geometryId), lineage = canonicalLineage(workspace, geometry);
    if (lineage.job && lineage.line) return removeGeometryWork(inputWorkspace, geometryId);
    workspace.entities.geometries = workspace.entities.geometries.filter(function (item) { return item.id !== geometry.id; });
    return workspace;
  }
  function syncGeometry(inputWorkspace, geometryId) {
    var deps = dependencies();
    var workspace = clone(inputWorkspace);
    var geometry = find(workspace.entities.geometries, text(geometryId), "Geometry");
    var payload = object(geometry.payload) ? geometry.payload : (geometry.payload = {});

    if (payload.valid === false) {
      throw commandError("WORK_GEOMETRY_INVALID", "Invalid Work Geometry cannot generate mapped work.", { geometryId: geometry.id });
    }
    if (!text(geometry.projectId)) {
      throw commandError("WORK_GEOMETRY_PROJECT_REQUIRED", "Work Geometry requires an exact Delivery Project.", { geometryId: geometry.id });
    }
    var project = find(workspace.entities.projects, geometry.projectId, "Project");
    if (project.owner !== geometry.owner) throw commandError("WORK_LINEAGE_OWNER_MISMATCH", "Geometry and Project owners must match.", { geometryId: geometry.id, projectId: project.id });
 var lineage = canonicalLineage(workspace, geometry);
 var key = workType(geometry);
 var rate = resolveGeometryRate(workspace, geometry);
 if (!rate || rate.active === false) {
   var selectedRateId = text(geometry.rateItemId || payload.rateItemId);
   var eligibleRates = supportedWorkType(key) ? eligibleSpatialRatesForWorkType(workspace, key) : [];
   var mapping = supportedWorkType(key) ? workTypeRateMapping(workspace, key) : { defaultRateItemId: null };
   if (selectedRateId && eligibleRates.every(function (item) { return item.id !== selectedRateId; })) {
    throw commandError("WORK_LINEAGE_RATE_NOT_ELIGIBLE", 'Selected Rate Item "' + selectedRateId + '" is not eligible for work type "' + key + '".', { geometryId: geometry.id, rateItemId: selectedRateId, workTypeKey: key });
   }
   if (!selectedRateId && eligibleRates.length > 1 && !text(mapping.defaultRateItemId)) {
    throw commandError("WORK_LINEAGE_RATE_SELECTION_REQUIRED", 'Work type "' + key + '" has multiple eligible Rate Items; select a pricing basis.', { geometryId: geometry.id, workTypeKey: key, eligibleRateItemIds: eligibleRates.map(function (item) { return item.id; }) });
   }
   throw commandError("WORK_LINEAGE_RATE_NOT_FOUND", 'Work type "' + (key || "unassigned") + '" requires an exact active eligible Rate Item or governed default.', { geometryId: geometry.id, rateItemId: selectedRateId, workTypeKey: key });
 }

    var measured;
    try {
      var authoritative = authoritativeMeasurement(geometry);
      payload.areaSqM = authoritative.areaSqM;
      payload.lengthM = authoritative.lengthM;
      measured = deps.map.measurements(geometry, { areaSqM: authoritative.areaSqM, lengthM: authoritative.lengthM });
    }
    catch (error) { throw commandError("WORK_GEOMETRY_MEASUREMENT_INVALID", error.message, { geometryId: geometry.id }); }
    measured = applyMappedSpatialQuantity(rate, measured);
 var quantity = Number(measured.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      var kind = text(rate.quantityKind) || "required";
      throw commandError("WORK_QUANTITY_INVALID", "Mapped work requires a positive " + kind + " measurement.", { geometryId: geometry.id, rateItemId: rate.id });
    }

    var oldJob = lineage.job;
    var jobId = oldJob ? oldJob.id : deps.model.stableId(project.owner, "job", geometry.id);
    if (!oldJob && Object.keys(workspace.entities).some(function (collection) { return Array.isArray(workspace.entities[collection]) && workspace.entities[collection].some(function (item) { return item && item.id === jobId; }); })) throw commandError("WORK_LINEAGE_ID_CONFLICT", "Deterministic mapped Job ID is already occupied.", { geometryId: geometry.id, jobIds: [jobId] });
    var job = oldJob ? clone(oldJob) : {
      id: jobId, owner: project.owner, type: "job", projectId: project.id,
      applicationId: project.applicationId || undefined, eventId: project.eventId || undefined,
      sourceGeometryId: geometry.id, title: text(rate.description || rate.title) + " - " + text(project.title || project.name || project.id),
      status: "Planned", category: rate.category, location: text(deps.model.displayAddressForProject && deps.model.displayAddressForProject(workspace, project)) || text(project.location), allDay: true,
      provenance: { owner: project.owner, sourceApp: "uos.work-area-service", sourceVersion: 4, sourceId: geometry.id }
    };
    job.sourceKind = "space-map"; job.sourceEntityId = geometry.id; job.sourceGeometryId = geometry.id;
    if (oldJob) workspace.entities.jobs = workspace.entities.jobs.map(function (item) { return item.id === job.id ? job : item; });
    else workspace.entities.jobs.push(job);

    var oldLine = lineage.line;
    /* A preserved commercial snapshot must also retain its original spatial
     * conversion basis. This is defensive against imported or otherwise
     * malformed workspaces that changed a referenced Rate Item structurally. */
    if (oldLine && text(oldLine.rateItemId) === rate.id) {
     quantity = deps.model.spatialQuantityForRate({ unit: oldLine.unit, quantityMode: "m2", quantityKind: "area", active: true }, authoritative.areaSqM);
     if (!Number.isFinite(quantity) || quantity < 0) throw commandError("WORK_QUANTITY_INVALID", "The preserved CostingLine unit cannot derive a valid spatial quantity.", { geometryId: geometry.id, rateItemId: rate.id });
    }
    var lineId = oldLine ? oldLine.id : deps.model.stableId(project.owner, "costingLine", geometry.id);
    if (!oldLine && Object.keys(workspace.entities).some(function (collection) { return Array.isArray(workspace.entities[collection]) && workspace.entities[collection].some(function (item) { return item && item.id === lineId; }); })) throw commandError("WORK_LINEAGE_ID_CONFLICT", "Deterministic mapped CostingLine ID is already occupied.", { geometryId: geometry.id, costingLineIds: [lineId] });
    workspace = deps.costing.createLine(workspace, rate.id, measured, {
      id: lineId, jobId: job.id, sourceGeometryId: geometry.id, quantityOverride: quantity,
      replaceLineId: oldLine ? oldLine.id : null,
      provenance: { owner: project.owner, sourceApp: "uos.work-area-service", sourceVersion: 1, sourceId: geometry.id }
 });
 var snapshotLine = workspace.entities.costingLines.find(function (item) { return item.id === lineId; });
 if (oldLine && text(oldLine.rateItemId) === rate.id) {
      ["rateItemId", "catalogId", "category", "description", "unit", "kind"].forEach(function (field) {
        if (oldLine[field] !== undefined) snapshotLine[field] = clone(oldLine[field]);
      });
      snapshotLine.unitRate = oldLine.unitRate;
  snapshotLine.estimatedTotal = Math.round(Number(snapshotLine.quantity || 0) * Number(snapshotLine.unitRate || 0) * 100) / 100;
 }
 snapshotLine.sourceAreaSqM = authoritative.areaSqM;
 snapshotLine.sourceWorkTypeKey = key;
    geometry = find(workspace.entities.geometries, geometry.id, "Geometry");
    payload = object(geometry.payload) ? geometry.payload : (geometry.payload = {});
    geometry.rateItemId = rate.id;
    payload.rateItemId = rate.id;
    payload.areaSqM = measured.areaSqM;
    payload.lengthM = measured.lengthM;
    state(geometry, "synced", "Mapped work is synchronized.");
    var normalized = deps.model.normalize(workspace), generatedUpdatedAt = normalized.updatedAt;
    normalized.updatedAt = inputWorkspace.updatedAt;
    if (JSON.stringify(normalized) === JSON.stringify(inputWorkspace)) return clone(inputWorkspace);
    normalized.updatedAt = generatedUpdatedAt;
    return normalized;
  }
  function removeGeometryWork(inputWorkspace, geometryId) {
    var model = modelDependency(), workspace = clone(inputWorkspace), geometry = geometryForCommand(workspace, geometryId), lineage = canonicalLineage(workspace, geometry);
    if (!lineage.job || !lineage.line) throw commandError("WORK_LINEAGE_INCOMPLETE", "Work Geometry requires one complete canonical lineage before removal.", { geometryId: geometry.id, jobIds: sortedIds(lineage.job ? [lineage.job] : []), costingLineIds: sortedIds(lineage.line ? [lineage.line] : []) });
    var job = lineage.job, line = lineage.line, entities = workspace.entities;
    var schedulerFields = ["startDate", "endDate", "startTime", "endTime", "crewId", "locationId"];
    var hasSchedulerState = schedulerFields.some(function (field) { return Boolean(text(job[field])); }) ||
      Number(job.durationMinutes) > 0 || job.allDay === false;
    var jobStatus = text(job.status).toLowerCase();
    var disposableStatuses = ["draft", "planned"];
    var hasProtectedDeliveryState = disposableStatuses.indexOf(jobStatus) < 0;
    var protectedStatusEventIds = (entities.statusEvents || []).filter(function (item) {
      if (text(item.entityId) !== job.id) return false;
      var fromStatus = text(item.fromStatus).toLowerCase();
      var toStatus = text(item.toStatus).toLowerCase();
      /* A newly established Draft/Planned event is disposable lineage. Any
       * later transition, or an imported protected state, is lifecycle proof. */
      return Boolean(fromStatus) || disposableStatuses.indexOf(toStatus) < 0;
    }).map(function (item) { return item.id; });
    var protectedOperationalState = hasSchedulerState || hasProtectedDeliveryState || protectedStatusEventIds.length > 0;
    var taskIds = (entities.tasks || []).filter(function (item) { return text(item.jobId) === job.id || text(item.schedulerJobId) === job.id; }).map(function (item) { return item.id; });
    var quoteLineIds = (entities.quoteLines || []).filter(function (item) { return text(item.sourceGeometryId || item.sourcePolygonId || item.geometryId) === geometry.id || text(item.jobId) === job.id || text(item.costingLineId) === line.id; }).map(function (item) { return item.id; });
    if (protectedOperationalState) throw commandError("WORK_LINEAGE_SCHEDULE_DEPENDENCY", "Scheduler, delivery or lifecycle state prevents mapped-work removal.", { geometryId: geometry.id, jobId: job.id, costingLineId: line.id, relatedIds: [job.id].concat(protectedStatusEventIds).sort() });
    if (taskIds.length) throw commandError("WORK_LINEAGE_TASK_DEPENDENCY", "Task dependencies prevent mapped-work removal.", { geometryId: geometry.id, jobId: job.id, costingLineId: line.id, relatedIds: taskIds.sort() });
    if (quoteLineIds.length) throw commandError("WORK_LINEAGE_QUOTE_DEPENDENCY", "QuoteLine dependencies prevent mapped-work removal.", { geometryId: geometry.id, jobId: job.id, costingLineId: line.id, relatedIds: quoteLineIds.sort() });
    entities.geometries = entities.geometries.filter(function (item) { return item.id !== geometry.id; });
    entities.jobs = entities.jobs.filter(function (item) { return item.id !== job.id; });
    entities.costingLines = entities.costingLines.filter(function (item) { return item.id !== line.id; });
    /* Status records are canonical children of the Job. Removing the complete
     * mapped-work lineage must remove those children too; otherwise status
     * validation correctly rejects a dangling entityId. */
    var removedTargetIds = {};
    [geometry.id, job.id, line.id].forEach(function (id) { removedTargetIds[id] = true; });
    ["statusEvents", "statusRecommendations"].forEach(function (collection) {
      if (Array.isArray(entities[collection])) {
        entities[collection] = entities[collection].filter(function (item) {
          return !removedTargetIds[text(item && item.entityId)];
        });
      }
    });
    return workspace;
  }

function resolveWorkTypeRate(workspace, key) {
 if (!supportedWorkType(key)) return null;
 var eligible = eligibleSpatialRatesForWorkType(workspace, key);
 if (eligible.length === 1) return eligible[0];
 var defaultId = text(workTypeRateMapping(workspace, key).defaultRateItemId);
 return defaultId ? eligible.find(function (rate) { return rate.id === defaultId; }) || null : null;
}

  function mappedRateIds(workspace) {
    if (!workspace || !workspace.entities || !Array.isArray(workspace.entities.rateItems)) return [];
 var keys = supportedWorkTypeKeys();
 var ids = [];
 keys.forEach(function (key) {
  eligibleSpatialRatesForWorkType(workspace, key).forEach(function (rate) {
   if (rate && rate.id && ids.indexOf(rate.id) < 0) ids.push(rate.id);
  });
 });
    return ids;
  }

  function isMappedRate(workspace, rateId) {
    if (!rateId) return false;
    var ids = mappedRateIds(workspace);
    return ids.indexOf(rateId) >= 0;
  }

  UOS.WorkAreaService = {
    measureGeometry: authoritativeMeasurement,
    createGeometry: createGeometry,
    updateGeometry: updateGeometry,
    removeGeometry: removeGeometry,
    geometryDependencies: geometryDependencies,
    syncGeometry: syncGeometry,
    removeGeometryWork: removeGeometryWork,
 resolveWorkTypeRate: resolveWorkTypeRate,
 resolveGeometryRate: resolveGeometryRate,
 workTypeRateMapping: workTypeRateMapping,
 isSpatiallyCompatibleRate: spatiallyCompatibleRate,
 spatialQuantityForRate: spatialQuantityForRate,
 eligibleSpatialRatesForWorkType: eligibleSpatialRatesForWorkType,
    mappedRateIds: mappedRateIds,
    isMappedRate: isMappedRate,
    canonicalWorkTypeRateItems: canonicalWorkTypeRateItems
  };
}());
