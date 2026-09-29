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
      quantityKind: MODE_TO_KIND[mode],
      source: input.source || (input.payload && input.payload.source)
    });
    var entity = deps.rates.toUnifiedRateItem(normalized);
 entity.category = category(normalized.category);
    entity.kind = input.kindSource === "user" && CATEGORIES.indexOf(text(input.kind)) >= 0
      ? text(input.kind) : deps.model.classifyRateKind(entity.category, entity.description, input.kind);
 entity.catalogSection = entity.kind;
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
    var job = find(result.entities.jobs, text(options.jobId), "Job");
    if (text(options.projectId) && options.projectId !== job.projectId) throw new Error("Costing line Project must match its Job Project.");
    var project = find(result.entities.projects, text(job.projectId), "Project");
    var parentId = project.applicationId || project.eventId;
    var parent = result.entities.applications.concat(result.entities.events).find(function (item) { return item.id === parentId; });
    if (parent && finalisedStatus(parent.status)) throw new Error("Costs cannot be applied to a finalised Register record.");
    if (job.projectId !== project.id) throw new Error("Costing line Project must match its Job Project.");
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
 }, sourceMeasurements, { id: options.id, owner: targetOwner, discriminator: candidate, sourceGeometryId: sourceGeometryId, quantityOverride: options.quantityOverride });
    }
    var line = calculate(discriminator || "line-" + sequence);
    while (!options.id && result.entities.costingLines.some(function (item) { return item.id === line.id; })) {
      sequence += 1;
      line = calculate(discriminator ? discriminator + "-" + sequence : "line-" + sequence);
    }
    if (result.entities.costingLines.some(function (item) { return item.id === line.id; })) throw new Error('Costing line id "' + line.id + '" already exists.');
    line.jobId = job.id;
    line.assignmentState = "Assigned";
    line.projectId = project.id;
 line.kind = CATEGORIES.indexOf(rate.kind) >= 0 ? rate.kind : "Equipment";
    line.applicationId = project.applicationId || null;
    line.eventId = project.eventId || null;
    line.description = text(rate.description || rate.title);
    line.title = line.description;
    line.category = rate.category;
    line.sourceKind = sourceGeometryId ? "space-map" : job.sourceKind === "planner" ? "planner" : "manual";
    if (job.sourceKind === "planner") line.sourceEntityId = job.sourceEntityId;
    line.sourceGeometryId = sourceGeometryId;
    delete line.sourcePolygonId;
    line.provenance = clone(options.provenance || rate.provenance);
    line.provenance.owner = line.owner;
    result.entities.costingLines.push(line);
    syncJobEstimate(result, job.id);
    return commit(result);
  }
  function updateLine(inputWorkspace, lineId, changes) {
    var result = workspace(inputWorkspace);
    var line = find(result.entities.costingLines, text(lineId), "Costing line");
    changes = object(changes) ? changes : {};
    var previousJobId = line.jobId;
    if (changes.quantity !== undefined) line.quantity = nonNegative(changes.quantity, "Quantity");
    if (changes.unitRate !== undefined) line.unitRate = money(nonNegative(changes.unitRate, "Unit rate"));
    if (changes.unit !== undefined) line.unit = text(changes.unit);
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
    line.estimatedTotal = money(line.quantity * line.unitRate);
    line.snapshotRefreshedAt = new Date().toISOString();
    syncJobEstimate(result, line.jobId);
    return commit(result);
  }
  function assignLine(inputWorkspace, lineId, jobId) {
    var result = workspace(inputWorkspace);
    var line = find(result.entities.costingLines, text(lineId), "Costing line");
    var previousJobId = line.jobId;
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
    result.entities.costingLines = result.entities.costingLines.filter(function (item) { return item.id !== line.id; });
    syncJobEstimate(result, line.jobId);
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
 description: item.description || item.title, unit: item.unit, unitRate: item.unitRate,
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
  function groupLinesByKind(inputWorkspace, linesOrJobId) {
    var result = workspace(inputWorkspace), lines = Array.isArray(linesOrJobId) ? linesOrJobId : result.entities.costingLines.filter(function (line) { return line.jobId === text(linesOrJobId); });
    var rates = {}; result.entities.rateItems.forEach(function (rate) { rates[rate.id] = rate; });
 var groups = { Labour: [], Equipment: [], Material: [], Contractors: [], Sundry: [] };
 lines.forEach(function (line) {
 var rate = rates[line.rateItemId], sourceKind = text(line.kind || rate && rate.kind);
 var kind = CATEGORIES.indexOf(sourceKind) >= 0 ? sourceKind : catalogSection(rate && rate.category || line.category, rate && (rate.description || rate.title), sourceKind);
 groups[kind] = groups[kind] || [];
 groups[kind].push(clone(line));
 });
    return groups;
  }

  UOS.ProgramCosting = UOS.programCosting = {
    categories: CATEGORIES.slice(), quantityModes: QUANTITY_MODES.slice(), catalogSection: catalogSection, normalizeRateItem: rateEntity,
 upsertRateItem: upsertRateItem, upsertRateItemWithWorkType: upsertRateItemWithWorkType,
 removeRateItem: removeRateItem, createJob: createJob,
    createLine: createLine, updateLine: updateLine, refreshLineFromRate: refreshLineFromRate,
    assignLine: assignLine, removeLine: removeLine, totals: totals,
    jobCalculator: jobCalculator, updateJobAdjustments: updateJobAdjustments,
    catalogItems: catalogItems,
    groupLinesByKind: groupLinesByKind, exportRateCsv: exportRateCsv
  };
})();
