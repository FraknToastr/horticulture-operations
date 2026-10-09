(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
 var CATEGORIES = ["Labour", "Equipment", "Material", "Contractors", "Sundry"];
  var QUANTITY_MODES = ["direct", "m2", "m3", "kg", "hours"];
  var MODE_TO_KIND = { direct: "direct", m2: "area", m3: "volume", kg: "mass", hours: "hours" };

  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function money(value) { var number = Number(value); return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0; }
  function nonNegative(value, label) {
    var number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new Error(label + " must be a non-negative number.");
    return number;
  }
  function dependencies() {
    if (!UOS.ProgramModel || !UOS.rateLibrary) throw new Error("ProgramModel and UOS.rateLibrary must load before ProgramCosting.");
    return { model: UOS.ProgramModel, rates: UOS.rateLibrary };
  }
  function workspace(input) { return dependencies().model.normalize(input); }
  function finalisedStatus(value) { return ["completed", "closed", "cancelled", "finalised", "finalized"].indexOf(text(value).toLowerCase()) >= 0; }
  function find(values, id, label) {
    var result = values.find(function (item) { return item.id === id; });
    if (!result) throw new Error(label + ' "' + id + '" was not found.');
    return result;
  }
 function catalogSection(value, description, kind) {
 var candidate = text(value), lower = candidate.toLowerCase();
 if (!lower || lower === "all") return "All";
 if (CATEGORIES.indexOf(text(kind)) >= 0) return text(kind);
 if (/^(labour|labor|equipment|material|contractors?|sundry)$/.test(lower)) {
 return lower === "labor" ? "Labour" : lower === "contractor" ? "Contractors" : CATEGORIES.find(function (name) { return name.toLowerCase() === lower; });
 }
 var classifier = dependencies().model.classifyRateKind;
 return typeof classifier === "function" ? classifier(candidate, description, kind) : "Equipment";
 }
  function category(value) {
    var candidate = text(value);
    if (!candidate) throw new Error("Rate category is required.");
    return candidate;
  }
  function quantityMode(value, unit) {
    var candidate = text(value).toLowerCase();
    candidate = ({ area: "m2", volume: "m3", mass: "kg", length: "direct" })[candidate] || candidate;
    if (!candidate) {
      candidate = ({ m2: "m2", "m²": "m2", m3: "m3", "m³": "m3", kg: "kg", hour: "hours", hours: "hours", hr: "hours" })[text(unit).toLowerCase()] || "direct";
    }
    if (QUANTITY_MODES.indexOf(candidate) < 0) throw new Error("Quantity mode must be direct, m2, m3, kg, or hours.");
    return candidate;
  }
  function rateEntity(input) {
    if (!object(input)) throw new Error("Rate item must be an object.");
    var deps = dependencies();
    var mode = quantityMode(input.quantityMode || input.quantityKind, input.unit);
    var normalized = deps.rates.normalizeItem({
      id: input.id,
      category: category(input.category),
      description: input.description || input.title,
      unit: input.unit,
      unitRate: input.unitRate,
      active: input.active !== false,
      schedulerEnabled: input.schedulerEnabled,
      quantityKind: MODE_TO_KIND[mode],
      source: input.source || (input.payload && input.payload.source)
    });
    var entity = deps.rates.toUnifiedRateItem(normalized);
 entity.category = category(normalized.category);
    entity.kind = input.kindSource === "user" && CATEGORIES.indexOf(text(input.kind)) >= 0
      ? text(input.kind) : deps.model.classifyRateKind(entity.category, entity.description, input.kind);
 entity.catalogSection = entity.kind;
    entity.schedulerEnabled = typeof input.schedulerEnabled === "boolean" ? input.schedulerEnabled : ["Labour", "Contractors"].indexOf(entity.kind) >= 0;
 entity.libraryCategory = entity.kind;
    entity.owner = "";
    entity.quantityMode = mode;
    entity.payload.quantityMode = mode;
    entity.provenance = clone(input.provenance || entity.provenance);
    entity.provenance.owner = "GLOBAL";
    Object.keys(input).forEach(function (key) {
      if (entity[key] === undefined && ["payload", "owner", "catalogId", "catalogOwner", "financialYear"].indexOf(key) < 0) entity[key] = clone(input[key]);
    });
    return entity;
  }
  function syncJobEstimate(result, jobId) {
    if (!jobId) return;
    var job = find(result.entities.jobs, jobId, "Job");
    var lines = result.entities.costingLines.filter(function (line) { return line.jobId === jobId; });
    var adjustments = object(job.costing) ? job.costing : {};
    job.estimate = totals(lines, adjustments).grandTotal;
  }
  function commit(result) { result.updatedAt = new Date().toISOString(); return dependencies().model.normalize(result); }

 function upsertRateItem(inputWorkspace, input) {
 var result = workspace(inputWorkspace);
 var entity = rateEntity(input);
 var index = result.entities.rateItems.findIndex(function (item) { return item.id === entity.id; });
 if (index >= 0) assertRateStructuralEditAllowed(result, result.entities.rateItems[index], entity);
 if (index >= 0) result.entities.rateItems[index] = entity;
 else result.entities.rateItems.push(entity);
 return commit(result);
 }

 function supportedPolygonWorkTypeKeys() {
 var values = dependencies().model.supportedPolygonWorkTypes;
 return (Array.isArray(values) ? values : []).map(function (item) { return text(item && item.key); }).filter(Boolean);
 }

function areaCompatibleRate(rate) {
 return dependencies().model.isSpatiallyCompatibleRate(rate);
}

 function rateHasCommercialLineage(result, rateId) {
  var hasReference = function (items) {
   return (items || []).some(function (item) {
    return text(item.rateItemId) === rateId || text(item.sourceRateItemId) === rateId;
   });
  };
  return hasReference(result.entities.jobs) || hasReference(result.entities.costingLines) || hasReference(result.entities.quoteLines);
 }

function rateStructureChanged(existing, next) {
  return text(existing.unit).toLowerCase() !== text(next.unit).toLowerCase() ||
   quantityMode(existing.quantityMode || existing.quantityKind, existing.unit) !== quantityMode(next.quantityMode || next.quantityKind, next.unit);
 }

 function assertRateStructuralEditAllowed(result, existing, next) {
  if (!rateStructureChanged(existing, next) || !rateHasCommercialLineage(result, next.id)) return;
  throw new Error("Rate Item unit or quantity mode cannot be changed after it has commercial lineage. Create a new Rate Item instead.");
 }

 function upsertRateItemWithWorkType(inputWorkspace, input, mappingInput) {
 var result = workspace(inputWorkspace);
 var entity = rateEntity(input);
 var mapping = object(mappingInput) ? mappingInput : {};
 var enabled = mapping.enabled === true;
 var workTypeKey = text(mapping.workTypeKey).toLowerCase();
 var supportedKeys = supportedPolygonWorkTypeKeys();
 if (enabled && supportedKeys.indexOf(workTypeKey) < 0) throw new Error("Select a supported polygon work type.");
 if (enabled && entity.active === false) throw new Error("A polygon work type requires an active Rate Item.");
 if (enabled && !areaCompatibleRate(entity)) throw new Error("A polygon work type requires an area quantity mode and an m², ha, or km² unit.");

 var index = result.entities.rateItems.findIndex(function (item) { return item.id === entity.id; });
 if (index >= 0) assertRateStructuralEditAllowed(result, result.entities.rateItems[index], entity);
 if (index >= 0) result.entities.rateItems[index] = entity;
 else result.entities.rateItems.push(entity);

 result.referenceData = object(result.referenceData) ? result.referenceData : {};
 result.referenceData.shared = object(result.referenceData.shared) ? result.referenceData.shared : {};
 var workTypeRateItems = object(result.referenceData.shared.workTypeRateItems) ? result.referenceData.shared.workTypeRateItems : {};
 result.referenceData.shared.workTypeRateItems = workTypeRateItems;
 var previousWorkTypeRateItems = clone(workTypeRateItems);
 var programModel = dependencies().model;
 var allKeys = supportedKeys.slice();
 Object.keys(previousWorkTypeRateItems).forEach(function (key) { if (allKeys.indexOf(key) < 0) allKeys.push(key); });
 allKeys.forEach(function (key) {
 var sourceEntry = Object.prototype.hasOwnProperty.call(previousWorkTypeRateItems, key)
 ? previousWorkTypeRateItems[key]
 : programModel.canonicalWorkTypeRateItems[key];
 var entry = programModel.normalizeWorkTypeRateMappingEntry(sourceEntry);
 var ids = entry.eligibleRateItemIds.filter(function (id) { return id !== entity.id; });
 var defaultId = entry.defaultRateItemId === entity.id ? null : entry.defaultRateItemId;
 if (enabled && key === workTypeKey && ids.indexOf(entity.id) < 0) ids.push(entity.id);
 if (enabled && key === workTypeKey && ids.length === 1) defaultId = entity.id;
 if (enabled && key === workTypeKey && ids.length > 1 && entry.eligibleRateItemIds.length === 1) {
 var canonicalEntry = programModel.normalizeWorkTypeRateMappingEntry(programModel.canonicalWorkTypeRateItems[key]);
 if (!canonicalEntry.defaultRateItemId || canonicalEntry.defaultRateItemId !== defaultId) defaultId = null;
 }
 if (defaultId && ids.indexOf(defaultId) < 0) defaultId = null;
 workTypeRateItems[key] = { eligibleRateItemIds: ids, defaultRateItemId: defaultId };
 });
 return commit(result);
 }
  function removeRateItem(inputWorkspace, rateItemId) {
    var result = workspace(inputWorkspace);
    var rate = find(result.entities.rateItems, text(rateItemId), "Rate item");
    if (result.entities.costingLines.some(function (line) { return line.rateItemId === rate.id; })) {
      throw new Error("Rate items referenced by costing lines cannot be deleted.");
    }
    if (result.entities.quoteLines.some(function (line) { return line.rateItemId === rate.id || line.sourceRateItemId === rate.id; })) {
      throw new Error("Rate items referenced by quote lines cannot be deleted.");
    }
    var mappings = result.referenceData && result.referenceData.shared && result.referenceData.shared.workTypeRateItems;
 if (object(mappings) && Object.keys(mappings).some(function (key) {
 return dependencies().model.normalizeWorkTypeRateMappingEntry(mappings[key]).eligibleRateItemIds.indexOf(rate.id) >= 0;
 })) {
      throw new Error("Rate items referenced by work type mappings cannot be deleted.");
    }
    result.entities.rateItems = result.entities.rateItems.filter(function (item) { return item.id !== rate.id; });
    return commit(result);
  }
  function createJob(inputWorkspace, projectId, input) {
    var result = workspace(inputWorkspace);
    var project = find(result.entities.projects, text(projectId), "Project");
    input = object(input) ? input : {};
    var sequence = result.entities.jobs.filter(function (job) { return job.projectId === project.id; }).length + 1;
    var id = text(input.id);
    if (!id) {
      do { id = dependencies().model.stableId(project.owner, "job", project.id + ":manual:" + sequence); sequence += 1; }
      while (result.entities.jobs.some(function (job) { return job.id === id; }));
    }
    var today = new Date().toISOString().slice(0, 10);
    result.entities.jobs.push({
      id: id, owner: project.owner, type: "job", projectId: project.id,
      applicationId: project.applicationId || undefined, eventId: project.eventId || undefined,
      title: text(input.title || input.name) || (text(project.title || project.name || project.id) + " - Job " + (sequence - 1)),
      name: text(input.name || input.title), status: text(input.status) || "Draft", priority: text(input.priority || project.priority) || "Normal",
      startDate: text(input.startDate) || today, endDate: text(input.endDate || input.startDate) || today,
      startTime: text(input.startTime), endTime: text(input.endTime), allDay: input.allDay !== false,
      location: text(input.location || (dependencies().model.displayAddressForProject && dependencies().model.displayAddressForProject(result, project)) || project.location),
      provenance: clone(input.provenance || { owner: project.owner, sourceApp: "uos.job-calculator", sourceVersion: 1, sourceId: id })
    });
    return commit(result);
  }
  function depsAreaRate(rate) { return dependencies().model.isSpatiallyCompatibleRate(rate); }
  function areaQuantity(rate, measurements) {
    if (dependencies().model.isSpatiallyCompatibleRate(rate)) return dependencies().model.spatialQuantityForRate(rate, measurements && measurements.areaSqM);
    return dependencies().rates.deriveQuantity(rate.quantityKind || MODE_TO_KIND[quantityMode(rate.quantityMode, rate.unit)], measurements);
  }

  function createLine(inputWorkspace, rateItemId, measurements, options) {
    options = options || {};
    var result = workspace(inputWorkspace);
    var replaceLineId = text(options.replaceLineId);
    if (replaceLineId) {
      var replacedLine = find(result.entities.costingLines, replaceLineId, "Costing line");
      if (text(options.id) && text(options.id) !== replacedLine.id) throw new Error("Replacement Costing line ID must remain stable.");
      result.entities.costingLines = result.entities.costingLines.filter(function (item) { return item.id !== replacedLine.id; });
    }
    var rate = find(result.entities.rateItems, text(rateItemId), "Rate item");
    var job = text(options.jobId) ? find(result.entities.jobs, text(options.jobId), "Job") : null;
    if (job && text(options.projectId) && options.projectId !== job.projectId) throw new Error("Costing line Project must match its Job Project.");
    var project = find(result.entities.projects, text(options.projectId || job && job.projectId), "Project");
    var parentId = project.applicationId || project.eventId;
    var parent = result.entities.applications.concat(result.entities.events).find(function (item) { return item.id === parentId; });
    if (parent && finalisedStatus(parent.status)) throw new Error("Costs cannot be applied to a finalised Register record.");
    if (job && (job.projectId !== project.id || job.owner !== project.owner)) throw new Error("Costing line Project and owner must match its Job.");
    if (rate.active === false || text(rate.status).toLowerCase() === "inactive") throw new Error("Inactive rate items cannot be added to costings.");
    var mode = quantityMode(rate.quantityMode || (rate.payload && (rate.payload.quantityMode || rate.payload.quantityKind)), rate.unit);
    var sourceMeasurements = clone(measurements || {});
    if (text(rate.quantityKind).toLowerCase() === "length" && sourceMeasurements.lengthM != null) sourceMeasurements.quantity = sourceMeasurements.lengthM;
    else if (mode === "direct" && sourceMeasurements.quantity == null && sourceMeasurements.lengthM != null) sourceMeasurements.quantity = sourceMeasurements.lengthM;
    var discriminator = text(options.discriminator);
    var sourceGeometryId = text(options.sourceGeometryId || sourceMeasurements.sourceGeometryId) || null;
    var sequence = result.entities.costingLines.length + 1;
    function calculate(candidate) {
      var targetOwner = project.owner;
      return dependencies().rates.calculateLine({
        id: rate.id, owner: targetOwner, category: rate.category, description: rate.description || rate.title,
        unit: rate.unit, unitRate: rate.unitRate, active: true, quantityKind: MODE_TO_KIND[mode]
 }, sourceMeasurements, { id: options.id, owner: targetOwner, discriminator: candidate, sourceGeometryId: sourceGeometryId, quantityOverride: options.quantityOverride == null && depsAreaRate(rate) ? areaQuantity(rate, sourceMeasurements) : options.quantityOverride });
    }
    var line = calculate(discriminator || "line-" + sequence);
    while (!options.id && result.entities.costingLines.some(function (item) { return item.id === line.id; })) {
      sequence += 1;
      line = calculate(discriminator ? discriminator + "-" + sequence : "line-" + sequence);
    }
    if (result.entities.costingLines.some(function (item) { return item.id === line.id; })) throw new Error('Costing line id "' + line.id + '" already exists.');
    line.jobId = job ? job.id : null;
    line.assignmentState = job ? "Assigned" : "Unassigned";
    line.estimatedTotal = money(line.quantity * line.unitRate);
    line.projectId = project.id;
    if (depsAreaRate(rate) && sourceMeasurements.areaSqM != null) line.sourceAreaSqM = nonNegative(sourceMeasurements.areaSqM, "Area");
 line.kind = CATEGORIES.indexOf(rate.kind) >= 0 ? rate.kind : "Equipment";
    line.applicationId = project.applicationId || null;
    line.eventId = project.eventId || null;
    line.description = text(rate.description || rate.title);
    line.title = line.description;
    line.category = rate.category;
    line.sourceKind = sourceGeometryId ? "space-map" : job && job.sourceKind === "planner" ? "planner" : "manual";
    if (job && job.sourceKind === "planner") line.sourceEntityId = job.sourceEntityId;
    line.sourceGeometryId = sourceGeometryId;
    delete line.sourcePolygonId;
    line.provenance = clone(options.provenance || rate.provenance);
    line.provenance.owner = line.owner;
    if (options.canonicalFields) Object.assign(line, options.canonicalFields);
    result.entities.costingLines.push(line);
    syncJobEstimate(result, job && job.id);
    return commit(result);
  }
  // These commands own all new Calculator/Map line and Scheduler relationships.
  // They work on a copy; the application stores the validated result in one transaction.
  function schedulerEnabled(rate) {
    return typeof rate.schedulerEnabled === "boolean" ? rate.schedulerEnabled :
      ["Labour", "Contractors"].indexOf(rate.kind || rate.category) >= 0;
  }
  function validateWorkLinks(result) {
    dependencies().model.assertValid(result);
    return result;
  }
  function ensureWorkJob(result, line) {
    if (line.jobId) {
      var existing = find(result.entities.jobs, line.jobId, "Job");
      if (existing.sourceCostingLineId !== line.id || existing.sourceIdentity !== line.sourceIdentity ||
          existing.projectId !== line.projectId || existing.owner !== line.owner) throw new Error("Work Job links must be exact and reciprocal.");
      return existing;
    }
    var project = find(result.entities.projects, line.projectId, "Project");
    var id = dependencies().model.stableId(line.owner, "job", line.id + ":scheduler");
    if (result.entities.jobs.some(function (item) { return item.id === id || item.sourceCostingLineId === line.id; })) throw new Error("Work Job identity is already occupied.");
    var job = {
      id: id, type: "job", owner: line.owner, projectId: project.id,
      applicationId: project.applicationId || null, eventId: project.eventId || null,
      title: line.description || line.title, category: line.category, status: "draft",
      startDate: "", endDate: "", startTime: "", endTime: "", allDay: true,
      location: text(project.location), sourceKind: line.sourceKind,
      sourceEntityId: line.sourceGeometryId || line.id, sourceGeometryId: line.sourceGeometryId || null,
      sourceCostingLineId: line.id, sourceIdentity: line.sourceIdentity, workCommandVersion: 1,
      provenance: { owner: line.owner, sourceApp: "uos.costing-commands", sourceVersion: 1, sourceId: line.sourceIdentity }
    };
    result.entities.jobs.push(job);
    line.jobId = job.id;
    line.assignmentState = "Assigned";
    line.jobCreationSuspended = false;
    syncJobEstimate(result, job.id);
    return job;
  }
  function createWork(inputWorkspace, projectId, rateItemId, measurements, options) {
    options = options || {};
    // Validate before normalization can conceal malformed relationship fields.
    var result = workspace(inputWorkspace);
    validateWorkLinks(result);
    var project = find(result.entities.projects, text(projectId), "Project");
    var rate = find(result.entities.rateItems, text(rateItemId), "Rate item");
    var geometry = options.geometryId ? find(result.entities.geometries, text(options.geometryId), "Geometry") : null;
    if (geometry && (geometry.projectId !== project.id || geometry.owner !== project.owner)) throw new Error("Geometry, Project and owner must agree.");
    if (geometry && geometry.workRemoved && !options.explicit) return result;
    if (geometry && geometry.workRemoved) {
      geometry.workLineageRevision = (Number(geometry.workLineageRevision) || 0) + 1;
      geometry.workRemoved = false;
    }
    var identity = geometry ? "geometry:" + geometry.id + ":" + (Number(geometry.workLineageRevision) || 0) : "operation:" + text(options.operationId);
    if (!geometry && !text(options.operationId)) throw new Error("An intentional Calculator addition requires a stable operationId.");
    var line = result.entities.costingLines.find(function (item) { return item.sourceIdentity === identity && item.projectId === project.id && item.owner === project.owner; });
    if (line) {
      if (line.rateItemId !== rate.id && !geometry) throw new Error("Operation identity cannot be reused for a different Rate Item.");
      if (geometry && line.rateItemId !== rate.id) {
        var lineageFields = { sourceIdentity: line.sourceIdentity, workCommandVersion: line.workCommandVersion,
          schedulerEnabledAtCreation: line.schedulerEnabledAtCreation, jobCreationSuspended: line.jobCreationSuspended,
          sourceKind: line.sourceKind, operationId: line.operationId };
        result = createLine(result, rate.id, measurements, { id: line.id, replaceLineId: line.id,
          jobId: line.jobId, projectId: project.id, sourceGeometryId: geometry.id, quantityOverride: options.quantityOverride, canonicalFields: lineageFields });
        line = find(result.entities.costingLines, line.id, "Costing line");
        Object.assign(line, lineageFields);
      }
      if (geometry) {
        var quantity = options.quantityOverride == null ? areaQuantity(rate, measurements) : options.quantityOverride;
        line.quantity = Math.round(nonNegative(quantity, "Quantity") * 1000000) / 1000000;
        line.estimatedTotal = money(line.quantity * line.unitRate);
        if (options.sourceAreaSqM !== undefined) line.sourceAreaSqM = options.sourceAreaSqM;
        syncJobEstimate(result, line.jobId);
        if (line.jobId) {
          var mappedJob = find(result.entities.jobs, line.jobId, "Job");
          mappedJob.title = line.description || line.title;
          mappedJob.category = line.category;
        }
      }
      if (options.explicit) ensureWorkJob(result, line);
      return validateWorkLinks(commit(result));
    }
    var id = dependencies().model.stableId(project.owner, "costingLine", project.id + ":" + identity);
    result = createLine(result, rate.id, measurements, { id: id, projectId: project.id,
      sourceGeometryId: geometry && geometry.id, quantityOverride: options.quantityOverride });
    line = find(result.entities.costingLines, id, "Costing line");
    line.sourceKind = geometry ? "space-map" : "calculator";
    line.sourceIdentity = identity;
    line.operationId = geometry ? null : text(options.operationId);
    line.workCommandVersion = 1;
    line.schedulerEnabledAtCreation = schedulerEnabled(rate);
    line.jobCreationSuspended = false;
    if (options.sourceAreaSqM !== undefined) line.sourceAreaSqM = options.sourceAreaSqM;
    if (options.sourceWorkTypeKey) line.sourceWorkTypeKey = options.sourceWorkTypeKey;
    if (options.explicit || schedulerEnabled(rate)) ensureWorkJob(result, line);
    return validateWorkLinks(commit(result));
  }
  function recreateWorkJob(inputWorkspace, lineId) {
    var result = workspace(inputWorkspace);
    validateWorkLinks(result);
    var line = find(result.entities.costingLines, text(lineId), "Costing line");
    if (line.workCommandVersion === 1) ensureWorkJob(result, line);
    else {
      // Deliberate recreation preserves historical lines without converting aggregate work.
      if (line.jobId) return validateWorkLinks(result);
      if (!line.jobCreationSuspended) throw new Error("Only deliberately suspended work can recreate a Job.");
      var project = find(result.entities.projects, line.projectId, "Project");
      var id = dependencies().model.stableId(line.owner, "job", line.id + ":scheduler");
      if (result.entities.jobs.some(function (job) { return job.id === id; })) throw new Error("Work Job identity is already occupied.");
      result.entities.jobs.push({ id: id, type: "job", owner: line.owner, projectId: project.id,
        applicationId: project.applicationId || null, eventId: project.eventId || null,
        title: line.description || line.title, category: line.category, status: "draft",
        startDate: "", endDate: "", allDay: true,
        sourceKind: line.sourceGeometryId ? "space-map" : "calculator",
        sourceEntityId: line.sourceGeometryId || line.id, sourceGeometryId: line.sourceGeometryId || null,
        provenance: { owner: line.owner, sourceApp: "uos.costing-commands", sourceVersion: 1, sourceId: line.id }
      });
      line.jobId = id;
      line.jobCreationSuspended = false;
      line.assignmentState = "Assigned";
      syncJobEstimate(result, id);
    }
    return validateWorkLinks(commit(result));
  }
  function deleteWorkJob(inputWorkspace, jobId, options) {
    options = options || {};
    var result = workspace(inputWorkspace);
    validateWorkLinks(result);
    var job = find(result.entities.jobs, text(jobId), "Job");
    var line = find(result.entities.costingLines, job.sourceCostingLineId, "Costing line");
    if (job.actualCost != null || line.actualCost != null || ["completed", "closed"].indexOf(text(job.status).toLowerCase()) >= 0) throw new Error("Recorded delivery or actual financial history protects this work.");
    if ((result.entities.budgetCharges || []).some(function (item) { return item.jobId === job.id; })) throw new Error("Jobs with recorded Budget charges cannot be deleted.");
    var protectedQuotes = result.entities.quotes.filter(function (item) { return ["Issued", "Accepted", "Declined", "Superseded"].indexOf(item.status) >= 0; }).map(function (item) { return item.id; });
    if (result.entities.quoteLines.some(function (item) { return (item.jobId === job.id || item.costingLineId === line.id) && protectedQuotes.indexOf(item.quoteId) >= 0; })) throw new Error("Issued or resolved Quotes protect this work.");
    var quoteLines = result.entities.quoteLines.filter(function (item) { return item.jobId === job.id || item.costingLineId === line.id; });
    if ((result.entities.paymentAllocations || []).some(function (item) { return quoteLines.some(function (ql) { return ql.id === item.quoteLineId; }); })) throw new Error("Payment allocations protect this work.");
    if ((result.entities.tasks || []).some(function (item) { return item.jobId === job.id || item.schedulerJobId === job.id; })) throw new Error("Planner task ownership prevents deletion through Calculator commands.");
    result.entities.jobs = result.entities.jobs.filter(function (item) { return item.id !== job.id; });
    ["statusEvents", "statusRecommendations"].forEach(function (collection) {
      result.entities[collection] = (result.entities[collection] || []).filter(function (item) { return item.entityId !== job.id && (!options.deleteCostingLine || item.entityId !== line.id); });
    });
    if (options.deleteCostingLine) {
      result.entities.costingLines = result.entities.costingLines.filter(function (item) { return item.id !== line.id; });
      result.entities.quoteLines = result.entities.quoteLines.filter(function (item) { return quoteLines.indexOf(item) < 0; });
      if (line.sourceGeometryId) find(result.entities.geometries, line.sourceGeometryId, "Geometry").workRemoved = true;
    } else {
      line.jobId = null;
      line.assignmentState = "Unassigned";
      line.jobCreationSuspended = true;
      quoteLines.forEach(function (item) { item.jobId = null; });
    }
    if (result.workspace && result.workspace.costing && result.workspace.costing.jobId === job.id) result.workspace.costing.jobId = null;
    if (result.workspace && result.workspace.scheduler && result.workspace.scheduler.selectedId === job.id) {
      result.workspace.scheduler.selectedId = "";
      result.workspace.scheduler.detail = false;
    }
    return validateWorkLinks(commit(result));
  }
  function updateLine(inputWorkspace, lineId, changes) {
    var result = workspace(inputWorkspace);
    var line = find(result.entities.costingLines, text(lineId), "Costing line");
    changes = object(changes) ? changes : {};
    var previousJobId = line.jobId;
    var canonicalArea = line.sourceAreaSqM;
    if (canonicalArea != null && changes.quantity !== undefined) {
      var divisor = dependencies().model.spatialQuantityForRate({ unit: line.unit, quantityMode: "m2", active: true }, 1);
      canonicalArea = nonNegative(changes.quantity, "Quantity") / divisor;
    }
    if (changes.quantity !== undefined) line.quantity = nonNegative(changes.quantity, "Quantity");
    if (changes.unitRate !== undefined) line.unitRate = money(nonNegative(changes.unitRate, "Unit rate"));
    if (changes.unit !== undefined) line.unit = text(changes.unit);
    if (canonicalArea != null) {
      line.sourceAreaSqM = canonicalArea;
      line.quantity = dependencies().model.spatialQuantityForRate({ unit: line.unit, quantityMode: "m2", active: true }, canonicalArea);
      line.calculation = line.calculation || {}; line.calculation.inputs = Object.assign({}, line.calculation.inputs, { areaSqM: canonicalArea });
    }
    if (changes.title !== undefined) line.title = text(changes.title);
    line.estimatedTotal = money(line.quantity * line.unitRate);
    syncJobEstimate(result, previousJobId);
    return commit(result);
  }
  function refreshLineFromRate(inputWorkspace, lineId, options) {
    options = object(options) ? options : {};
    if (options.confirmed !== true) throw new Error("Refreshing a costing snapshot requires explicit confirmation.");
    var result = workspace(inputWorkspace);
    var line = find(result.entities.costingLines, text(lineId), "Costing line");
    var rate = find(result.entities.rateItems, text(options.rateItemId || line.rateItemId), "Rate item");
    if (rate.active === false || text(rate.status).toLowerCase() === "inactive") throw new Error("Inactive rate items cannot refresh costing snapshots.");
    find(result.entities.projects, text(line.projectId), "Project");
    line.rateItemId = rate.id;
 line.kind = CATEGORIES.indexOf(rate.kind) >= 0 ? rate.kind : "Equipment";
    line.title = text(rate.description || rate.title);
    line.description = line.title;
    line.category = rate.category;
    line.unit = rate.unit;
    line.unitRate = money(nonNegative(rate.unitRate, "Unit rate"));
    if (line.sourceAreaSqM != null && depsAreaRate(rate)) line.quantity = areaQuantity(rate, { areaSqM: line.sourceAreaSqM });
    line.estimatedTotal = money(line.quantity * line.unitRate);
    line.snapshotRefreshedAt = new Date().toISOString();
    syncJobEstimate(result, line.jobId);
    return commit(result);
  }
  function assignLine(inputWorkspace, lineId, jobId) {
    var result = workspace(inputWorkspace);
    var line = find(result.entities.costingLines, text(lineId), "Costing line");
    var previousJobId = line.jobId;
    if (line.workCommandVersion === 1) throw new Error("Canonical work Job links belong to the costing command layer.");
    var target = text(jobId);
    if (!target) throw new Error("Costing Lines must remain assigned to a Job.");
    var job = find(result.entities.jobs, target, "Job");
    var project = find(result.entities.projects, job.projectId, "Project");
    line.owner = project.owner;
    line.jobId = job.id;
    line.projectId = project.id;
    line.applicationId = project.applicationId || null;
    line.eventId = project.eventId || null;
    line.assignmentState = "Assigned";
    if (!line.sourceGeometryId) {
      line.sourceKind = job.sourceKind === "planner" ? "planner" : "manual";
      line.sourceEntityId = job.sourceKind === "planner" ? job.sourceEntityId : null;
    }
    syncJobEstimate(result, previousJobId);
    syncJobEstimate(result, target);
    return commit(result);
  }
  function removeLine(inputWorkspace, lineId) {
    var result = workspace(inputWorkspace);
    var line = find(result.entities.costingLines, text(lineId), "Costing line");
    var job = result.entities.jobs.find(function (item) { return item.id === line.jobId; });
    var references = result.entities.quoteLines.filter(function (item) { return item.costingLineId === line.id || job && item.jobId === job.id; });
    var quoteIds = references.map(function (item) { return item.quoteId; }).filter(function (id, index, ids) { return ids.indexOf(id) === index; });
    if (line.actualCost != null || job && (job.actualCost != null || ["completed", "closed"].indexOf(text(job.status).toLowerCase()) >= 0)) throw new Error("Recorded delivery or actual financial history protects this work.");
    if ((result.entities.budgetCharges || []).some(function (item) { return item.costingLineId === line.id || job && item.jobId === job.id; })) throw new Error("Recorded Budget charges protect this work.");
    if (job && (result.entities.tasks || []).some(function (item) { return item.jobId === job.id || item.schedulerJobId === job.id; })) throw new Error("Planner task ownership prevents deletion through Calculator commands.");
    quoteIds.forEach(function (id) {
      var quote = find(result.entities.quotes, id, "Quote");
      if (text(quote.status) !== "Draft") throw new Error("Issued or resolved Quotes protect this work.");
      if (!UOS.ProgramQuotes) throw new Error("ProgramQuotes must load before removing Draft-quoted work.");
      if (UOS.ProgramQuotes.commerciallyLocked(result, id)) throw new Error("Reverse active payments or payment allocations before removing Draft-quoted work.");
    });
    if ((result.entities.paymentAllocations || []).some(function (item) { return references.some(function (reference) { return reference.id === item.quoteLineId; }); })) throw new Error("Payment allocation history protects quoted Costing lines from deletion.");
    if (line.workCommandVersion === 1 && line.jobId) result = deleteWorkJob(result, line.jobId, { deleteCostingLine: true });
    else {
      if (line.workCommandVersion === 1 && line.sourceGeometryId) find(result.entities.geometries, line.sourceGeometryId, "Geometry").workRemoved = true;
      result.entities.costingLines = result.entities.costingLines.filter(function (item) { return item.id !== line.id; });
      result.entities.quoteLines = result.entities.quoteLines.filter(function (item) { return item.costingLineId !== line.id; });
      syncJobEstimate(result, line.jobId);
    }
    quoteIds.forEach(function (id) {
      var quote = find(result.entities.quotes, id, "Quote");
      result = UOS.ProgramQuotes.saveDraft(result, { id: id, projectId: quote.projectId });
    });
    return commit(result);
  }
  function totals(lines, options) {
    options = options || {};
    var subtotal = money((lines || []).reduce(function (sum, line) { return sum + Math.max(0, Number(line.estimatedTotal) || 0); }, 0));
    var preliminariesPercent = nonNegative(options.preliminariesPercent == null ? 0 : options.preliminariesPercent, "Preliminaries percent");
    var marginPercent = nonNegative(options.marginPercent == null ? 0 : options.marginPercent, "Margin percent");
    var preliminaries = money(subtotal * preliminariesPercent / 100);
    var margin = money((subtotal + preliminaries) * marginPercent / 100);
    var beforeGst = money(subtotal + preliminaries + margin);
    var gst = money(beforeGst * 0.10);
    return { subtotal: subtotal, preliminariesPercent: preliminariesPercent, preliminaries: preliminaries, marginPercent: marginPercent, margin: margin, gstRate: 0.10, gst: gst, grandTotal: money(beforeGst + gst), currency: "AUD" };
  }
  function jobCalculator(inputWorkspace, jobId, options) {
    var result = workspace(inputWorkspace);
    var job = find(result.entities.jobs, text(jobId), "Job");
    var lines = result.entities.costingLines.filter(function (line) { return line.jobId === job.id; });
    return { job: clone(job), lines: clone(lines), groups: groupLinesByKind(result, lines), totals: totals(lines, options || (object(job.costing) ? job.costing : {})) };
  }
  function updateJobAdjustments(inputWorkspace, jobId, changes) {
    var result = workspace(inputWorkspace);
    var job = find(result.entities.jobs, text(jobId), "Job");
    changes = object(changes) ? changes : {};
    var existing = object(job.costing) ? job.costing : {};
    job.costing = {
      preliminariesPercent: nonNegative(changes.preliminariesPercent === undefined ? existing.preliminariesPercent || 0 : changes.preliminariesPercent, "Preliminaries percent"),
      marginPercent: nonNegative(changes.marginPercent === undefined ? existing.marginPercent || 0 : changes.marginPercent, "Margin percent")
    };
    syncJobEstimate(result, job.id);
    return commit(result);
  }
 function exportRateCsv(inputWorkspace, options) {
 var result = workspace(inputWorkspace), programModel = dependencies().model;
 return dependencies().rates.exportCsv(result.entities.rateItems.map(function (item) {
 var source = object(item.source) ? item.source : {}, provenance = object(item.provenance) ? item.provenance : {};
 var mapped = (programModel.supportedPolygonWorkTypes || []).some(function (workType) {
 var mapping = programModel.workTypeRateMapping(result, workType.key);
 return mapping && Array.isArray(mapping.eligibleRateItemIds) && mapping.eligibleRateItemIds.indexOf(item.id) >= 0;
 });
 var kind = catalogSection(item.category, item.description || item.title, item.kind);
 return {
 id: item.id, owner: "", category: item.category, kind: kind, libraryCategory: kind, catalogSection: kind,
 description: item.description || item.title, unit: item.unit, unitRate: item.unitRate, schedulerEnabled: schedulerEnabled(item),
 active: item.active !== false && text(item.status).toLowerCase() !== "inactive",
 quantityKind: MODE_TO_KIND[quantityMode(item.quantityMode || (item.payload && item.payload.quantityMode), item.unit)],
 addPath: mapped ? "Manual + Map" : "Manual", sourceFileName: source.fileName || "",
 sourceImportedAt: source.importedAt || "", sourceRow: source.sourceRow || "",
      sourceId: source.id || provenance.sourceId || "", sourceApp: item.sourceApp || provenance.sourceApp || "",
 sourceVersion: provenance.sourceVersion == null ? "" : provenance.sourceVersion,
      legacyId: item.legacyId || provenance.legacyId || ""
 };
 }));
 }
  function catalogItems(inputWorkspace, options) {
    var result = workspace(inputWorkspace);
    options = options || {};
    var selectedSection = text(options.section);
    var query = text(options.search || options.query).toLowerCase();
    var selectedCategory = text(options.category);
    var selectedKind = text(options.kind);
    return clone(result.entities.rateItems.filter(function (item) {
      if (selectedKind && selectedKind !== "All" && item.kind !== selectedKind) return false;
      if (!options.includeInactive && (item.active === false || text(item.status).toLowerCase() === "inactive")) return false;
 if (selectedSection && selectedSection !== "All" && selectedSection !== "all" && catalogSection(item.category, item.description || item.title, item.kind) !== selectedSection) return false;
      if (selectedCategory && selectedCategory !== "All" && selectedCategory !== "all" && text(item.category) !== selectedCategory) return false;
      return !query || [item.description, item.title, item.category, item.unit].some(function (value) { return text(value).toLowerCase().indexOf(query) >= 0; });
    }).sort(function (a, b) {
 return catalogSection(a.category, a.description || a.title, a.kind).localeCompare(catalogSection(b.category, b.description || b.title, b.kind)) || text(a.description || a.title).localeCompare(text(b.description || b.title)) || a.id.localeCompare(b.id);
    }));
  }
  function rateKind(rate) {
    if (rate && rate.kindSource === "user" && CATEGORIES.indexOf(text(rate.kind)) >= 0) return text(rate.kind);
    var classifier = dependencies().model.classifyRateKind;
    return typeof classifier === "function" ? classifier(rate && rate.category, rate && (rate.description || rate.title), rate && rate.kind) : CATEGORIES.indexOf(text(rate && rate.kind)) >= 0 ? text(rate.kind) : "Equipment";
  }
  function lineKind(inputWorkspace, line) {
    var rate = inputWorkspace.entities.rateItems.find(function (item) { return item.id === line.rateItemId; });
    return rateKind(rate || line);
  }
  function removeCalculatorLine(inputWorkspace, lineId) {
    var line = find(inputWorkspace.entities.costingLines, text(lineId), "Costing line");
    var guarded = removeLine(inputWorkspace, lineId);
    if (line.workCommandVersion !== 1 && line.sourceGeometryId) {
      if (!UOS.WorkAreaService || !UOS.WorkAreaService.removeGeometry) throw new Error("WorkAreaService is unavailable.");
      var mapped = UOS.WorkAreaService.removeGeometry(inputWorkspace, line.sourceGeometryId);
      if (mapped.entities.costingLines.some(function (item) { return item.id === lineId; })) throw new Error("Incomplete mapped work must be repaired before deletion.");
      return commit(mapped);
    }
    return guarded;
  }
  function removeLines(inputWorkspace, projectId, kind) {
    var result = workspace(inputWorkspace);
    find(result.entities.projects, text(projectId), "Project");
    if (kind !== "All" && CATEGORIES.indexOf(kind) < 0) throw new Error("Choose a supported Costing kind.");
    var matches = result.entities.costingLines.filter(function (line) { return line.projectId === projectId && (kind === "All" || lineKind(result, line) === kind); });
    var deletedIds = [], retained = [], affectedJobs = [], affectedGeometries = [];
    matches.forEach(function (line) {
      try {
        var next = removeCalculatorLine(result, line.id);
        if (line.jobId && !next.entities.jobs.some(function (item) { return item.id === line.jobId; })) affectedJobs.push(line.jobId);
        if (line.sourceGeometryId) affectedGeometries.push(line.sourceGeometryId);
        result = next;
        deletedIds.push(line.id);
      } catch (error) { retained.push({ id: line.id, description: text(line.description || line.title || line.id), reason: error.message }); }
    });
    return { workspace: result, matchedIds: matches.map(function (line) { return line.id; }), deletedIds: deletedIds, retained: retained, affectedJobIds: Array.from(new Set(affectedJobs)), affectedGeometryIds: Array.from(new Set(affectedGeometries)) };
  }
  function groupLinesByKind(inputWorkspace, linesOrJobId) {
    var result = workspace(inputWorkspace), lines = Array.isArray(linesOrJobId) ? linesOrJobId : result.entities.costingLines.filter(function (line) { return line.jobId === text(linesOrJobId); });
 var groups = { Labour: [], Equipment: [], Material: [], Contractors: [], Sundry: [] };
 lines.forEach(function (line) {
      var kind = lineKind(result, line);
 groups[kind] = groups[kind] || [];
 groups[kind].push(clone(line));
 });
    return groups;
  }

 UOS.ProgramCosting = UOS.programCosting = {
 createWork: createWork, recreateWorkJob: recreateWorkJob, deleteWorkJob: deleteWorkJob, schedulerEnabled: schedulerEnabled,
    categories: CATEGORIES.slice(), quantityModes: QUANTITY_MODES.slice(), catalogSection: catalogSection, normalizeRateItem: rateEntity,
 upsertRateItem: upsertRateItem, upsertRateItemWithWorkType: upsertRateItemWithWorkType,
 removeRateItem: removeRateItem, createJob: createJob,
    createLine: createLine, updateLine: updateLine, refreshLineFromRate: refreshLineFromRate,
    assignLine: assignLine, removeLine: removeLine, removeCalculatorLine: removeCalculatorLine, removeLines: removeLines, lineKind: lineKind, rateKind: rateKind, totals: totals,
    jobCalculator: jobCalculator, updateJobAdjustments: updateJobAdjustments,
    catalogItems: catalogItems,
    groupLinesByKind: groupLinesByKind, exportRateCsv: exportRateCsv
  };
})();
