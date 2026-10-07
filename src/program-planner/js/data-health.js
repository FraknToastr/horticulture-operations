(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {};
  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function list(workspace, name) { return object(workspace && workspace.entities) && Array.isArray(workspace.entities[name]) ? workspace.entities[name] : []; }
  function coordinate(value) {
    return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])) &&
      Number(value[0]) >= -180 && Number(value[0]) <= 180 && Number(value[1]) >= -90 && Number(value[1]) <= 90;
  }
  function check(workspace) {
    var issues = [], ids = {}, byCollection = {};
    function issue(code, severity, collection, entity, field, related, message) {
      var contract = UOS.ProductContracts && typeof UOS.ProductContracts.contractForIssueCode === "function" ? UOS.ProductContracts.contractForIssueCode(code) : null;
      issues.push({ code: code, contractId: contract && contract.id || "", severity: severity, collection: collection, entityId: text(entity && entity.id), field: field || "", relatedIds: related || [], message: message, repair: null });
    }
    ["applications", "events", "projects", "jobs", "tasks", "costingLines", "rateItems", "geometries", "quotes", "quoteEvents", "quoteLines", "payments", "paymentAllocations"].forEach(function (name) {
      byCollection[name] = list(workspace, name);
      byCollection[name].forEach(function (item) {
        if (!object(item)) return issue("ENTITY_INVALID", "error", name, item, "", [], "Record is not an object.");
        if (text(item.id)) {
          if (ids[item.id]) issue("ID_DUPLICATE", "error", name, item, "id", [item.id], "Entity ID is duplicated.");
          else ids[item.id] = { item: item, collection: name };
        }
      });
    });
    if (UOS.ProgramModel && typeof UOS.ProgramModel.spatialInvariantViolations === "function") {
      UOS.ProgramModel.spatialInvariantViolations(workspace).forEach(function (item) {
        issue(item.code, item.severity, item.collection, { id: item.entityId }, item.field, item.relatedIds || [], item.message);
      });
    }
    var pinIds = {};
    ["applications", "events"].forEach(function (collection) {
      byCollection[collection].slice().sort(function (left, right) { return text(left && left.id).localeCompare(text(right && right.id)); }).forEach(function (register) {
        var locations = Array.isArray(register && register.locations) ? register.locations : [];
        locations.forEach(function (pin, index) {
          var pinId = text(pin && pin.id), entity = { id: text(register && register.id) + (pinId ? ":" + pinId : ":location:" + index) };
          if (!object(pin)) return issue("LOCATION_PIN_INVALID", "error", collection, entity, "locations", [], "Location Pin must be an object.");
          if (!pinId) issue("LOCATION_PIN_ID_MISSING", "error", collection, entity, "locations[].id", [], "Location Pin requires a stable ID.");
          else if (pinIds[pinId]) issue("LOCATION_PIN_ID_DUPLICATE", "error", collection, entity, "locations[].id", [pinIds[pinId], text(register.id)].sort(), "Location Pin ID is duplicated across Register records.");
          else pinIds[pinId] = text(register.id);
          if (!coordinate(pin.coordinate)) issue("LOCATION_PIN_COORDINATE_INVALID", "error", collection, entity, "locations[].coordinate", [], "Location Pin coordinate must contain valid longitude and latitude values.");
        });
      });
    });
    var geometryIds = {};
    byCollection.geometries.slice().sort(function (left, right) { return text(left && left.id).localeCompare(text(right && right.id)); }).forEach(function (geometry) {
      var id = text(geometry && geometry.id), kind = text(geometry && geometry.geometryKind).toLowerCase();
      if (geometryIds[id]) issue("WORK_GEOMETRY_ID_DUPLICATE", "error", "geometries", geometry, "id", [id], "Work Geometry ID is duplicated.");
      else if (id) geometryIds[id] = true;
      if (["polygon", "line"].indexOf(kind) < 0) issue("WORK_GEOMETRY_KIND_INVALID", "error", "geometries", geometry, "geometryKind", [], "Work Geometry kind must be polygon or line.");
      if (!UOS.WorkAreaService || typeof UOS.WorkAreaService.measureGeometry !== "function") return;
      try {
        var measured = UOS.WorkAreaService.measureGeometry(geometry), payload = object(geometry.payload) ? geometry.payload : {};
        var storedArea = Number(payload.areaSqM), storedLength = Number(payload.lengthM);
        if (!Number.isFinite(storedArea) || !Number.isFinite(storedLength) || Math.abs(storedArea - measured.areaSqM) > 0.001 || Math.abs(storedLength - measured.lengthM) > 0.001) {
          issue("WORK_GEOMETRY_MEASUREMENT_MISMATCH", "error", "geometries", geometry, "payload.areaSqM/payload.lengthM", [], "Stored Work Geometry measurement does not match its coordinates.");
        }
      } catch (error) {
        issue("WORK_GEOMETRY_COORDINATES_INVALID", "error", "geometries", geometry, "geometry.coordinates", [], "Work Geometry coordinates do not form a measurable polygon or line.");
      }
    });
    var activeProjectsByRegister = {};
    byCollection.projects.forEach(function (project) {
      if (UOS.ProgramBudget && list(workspace, "annualBudgets").length && object(project.funding) && Number(project.funding.operationalAmount) > 0 && !list(workspace, "registerAllocations").some(function (allocation) { return allocation.registerId === text(project.applicationId || project.eventId); })) {
        issue("FUNDING_LEGACY_UNRECONCILED", "warning", "projects", project, "funding.operationalAmount", [], "Historical City Operational Amount has no approved annual Budget allocation. Reconcile it before new funding-dependent work.");
      }
      if (!project || text(project.status).toLowerCase() === "archived") return;
      [["applicationId", text(project.applicationId)], ["eventId", text(project.eventId)]].forEach(function (relationship) {
        var field = relationship[0], registerId = relationship[1];
        if (!registerId) return;
        var key = field + ":" + registerId;
        if (!activeProjectsByRegister[key]) activeProjectsByRegister[key] = { field: field, registerId: registerId, projects: [] };
        activeProjectsByRegister[key].projects.push(project);
      });
    });
    Object.keys(activeProjectsByRegister).sort().forEach(function (key) {
      var group = activeProjectsByRegister[key];
      if (group.projects.length < 2) return;
      group.projects.sort(function (left, right) { return text(left.id).localeCompare(text(right.id)); });
      var projectIds = group.projects.map(function (project) { return text(project.id); });
      issue("PROJECT_DUPLICATE_ACTIVE_FOR_REGISTER", "error", "projects", group.projects[0], group.field, projectIds,
        'Register record "' + group.registerId + '" has multiple active Delivery Projects: ' + projectIds.join(", ") + ".");
    });
    byCollection.jobs.forEach(function (item) {
      if (!ids[text(item.projectId)] || ids[text(item.projectId)].collection !== "projects") issue("JOB_PROJECT_MISSING", "error", "jobs", item, "projectId", [text(item.projectId)], "Job has no existing Project.");
    });
    var plannerJobsByTask = {};
    byCollection.jobs.forEach(function (job) {
      if (text(job.sourceKind) !== "planner") return;
      var taskId = text(job.sourceEntityId);
      if (!taskId) {
        issue("PLANNER_JOB_TASK_MISSING", "error", "jobs", job, "sourceEntityId", [], "Planner Job has no source Task.");
        return;
      }
      plannerJobsByTask[taskId] = plannerJobsByTask[taskId] || [];
      plannerJobsByTask[taskId].push(job.id);
      var taskRef = ids[taskId];
      if (!taskRef || taskRef.collection !== "tasks") issue("PLANNER_JOB_TASK_MISSING", "error", "jobs", job, "sourceEntityId", [taskId], "Planner Job references a Task that does not exist.");
      else if (taskRef.item.projectId !== job.projectId || taskRef.item.owner !== job.owner) issue("PLANNER_JOB_TASK_MISMATCH", "error", "jobs", job, "sourceEntityId", [taskId], "Planner Job must remain in the same Project and owner as its source Task.");
    });
    Object.keys(plannerJobsByTask).sort().forEach(function (taskId) {
      var jobIds = plannerJobsByTask[taskId].slice().sort();
      if (jobIds.length > 1) issue("PLANNER_JOB_DUPLICATE_LINEAGE", "error", "tasks", ids[taskId] && ids[taskId].item || { id: taskId }, "jobId/schedulerJobId", jobIds, "More than one Planner Job claims the same source Task.");
    });
    byCollection.tasks.forEach(function (task) {
      var projectRef = ids[text(task.projectId)];
      if (!projectRef || projectRef.collection !== "projects") {
        issue("PLANNER_TASK_PROJECT_MISSING", "error", "tasks", task, "projectId", [text(task.projectId)].filter(Boolean), "Planner Task has no existing Project.");
        return;
      }
      if (task.owner !== projectRef.item.owner) issue("PLANNER_TASK_OWNER_MISMATCH", "error", "tasks", task, "owner", [projectRef.item.id], "Planner Task owner differs from its Project owner.");
      ["jobId", "schedulerJobId"].forEach(function (field) {
        var jobId = text(task[field]);
        if (!jobId) return;
        var jobRef = ids[jobId];
        if (!jobRef || jobRef.collection !== "jobs") issue("PLANNER_TASK_JOB_MISSING", "error", "tasks", task, field, [jobId], "Planner Task references a Job that does not exist.");
        else if (jobRef.item.projectId !== task.projectId || jobRef.item.owner !== task.owner) issue("PLANNER_TASK_JOB_MISMATCH", "error", "tasks", task, field, [jobId], "Planner Task Job link must remain in the same Project and owner.");
        else if (text(jobRef.item.sourceKind) === "planner" && text(jobRef.item.sourceEntityId) !== text(task.id)) issue("PLANNER_TASK_JOB_SOURCE_MISMATCH", "error", "tasks", task, field, [jobId], "Planner Task is linked to a Planner Job sourced from a different Task.");
      });
    });
    if (object(workspace && workspace.workspace && workspace.workspace.projectChecklists) && Object.keys(workspace.workspace.projectChecklists).length) {
      issue("PLANNER_SHADOW_STATE_ACTIVE", "error", "tasks", { id: "workspace.projectChecklists" }, "workspace.projectChecklists", [], "Legacy Planner shadow business data is active; Planner fields must be stored only on canonical Task records.");
    }
    var plannerMigration = object(workspace && workspace.migration) && Array.isArray(workspace.migration.unresolvedPlannerChecklistAssignments) ? workspace.migration.unresolvedPlannerChecklistAssignments : [];
    plannerMigration.forEach(function (entry, index) {
      issue("PLANNER_SHADOW_RECONCILIATION_UNRESOLVED", "warning", "tasks", { id: text(entry && entry.projectId) || text(entry && entry.sourceRecordId) || "planner-shadow-" + index }, "migration.unresolvedPlannerChecklistAssignments", [text(entry && entry.legacyKey)].filter(Boolean), text(entry && entry.reason) || "Legacy Planner shadow state could not be reconciled without guessing.");
    });
    byCollection.rateItems.forEach(function (item) {
      if (text(item.owner)) issue("RATE_OWNER_NOT_GLOBAL", "error", "rateItems", item, "owner", [text(item.owner)], "Rate Item must be global and ownerless.");
      if (text(item.catalogId || item.catalogOwner || item.financialYear)) issue("RATE_LEGACY_CATALOG_ACTIVE", "warning", "rateItems", item, "catalogId/catalogOwner/financialYear", [text(item.catalogId), text(item.catalogOwner), text(item.financialYear)].filter(Boolean).sort(), "Rate Item still carries legacy catalog eligibility metadata; run explicit global-rate migration.");
    });
    var mappings = object(workspace && workspace.referenceData) && object(workspace.referenceData.shared) && object(workspace.referenceData.shared.workTypeRateItems) ? workspace.referenceData.shared.workTypeRateItems : {};
    var supportedMappingKeys = UOS.ProgramModel && Array.isArray(UOS.ProgramModel.supportedPolygonWorkTypes) ? UOS.ProgramModel.supportedPolygonWorkTypes.map(function (item) { return text(item && item.key); }) : [];
    Object.keys(mappings).sort().forEach(function (key) {
      var rawMapping = mappings[key];
      if (object(rawMapping)) {
        var mappingPath = "referenceData.shared.workTypeRateItems." + key;
        var eligibleIds = Array.isArray(rawMapping.eligibleRateItemIds) ? rawMapping.eligibleRateItemIds.map(text).filter(Boolean) : [];
        var defaultRateItemId = text(rawMapping.defaultRateItemId);
        var mappingEntity = { id: defaultRateItemId || eligibleIds[0] || key };
        if (supportedMappingKeys.indexOf(key) < 0) {
          issue("RATE_MAPPING_WORK_TYPE_UNKNOWN", "error", "rateItems", mappingEntity, mappingPath, [key].concat(eligibleIds), "Work-type mapping uses an unsupported polygon work type.");
          return;
        }
        if (!Array.isArray(rawMapping.eligibleRateItemIds)) {
          issue("RATE_MAPPING_SHAPE_INVALID", "error", "rateItems", mappingEntity, mappingPath + ".eligibleRateItemIds", [], "Work-type eligibility must be an explicit Rate Item ID array.");
        }
        if (defaultRateItemId && eligibleIds.indexOf(defaultRateItemId) < 0) {
          issue("RATE_MAPPING_DEFAULT_INELIGIBLE", "error", "rateItems", mappingEntity, mappingPath + ".defaultRateItemId", [defaultRateItemId], "Default spatial Rate Item must also be eligible for the work type.");
        }
        eligibleIds.forEach(function (eligibleRateId) {
          var eligibleRef = ids[eligibleRateId];
          var fieldPath = mappingPath + ".eligibleRateItemIds";
          if (!eligibleRef || eligibleRef.collection !== "rateItems") {
            issue("RATE_MAPPING_UNKNOWN", "error", "rateItems", { id: eligibleRateId }, fieldPath, [eligibleRateId], "Work-type mapping references an unknown Rate Item.");
          } else if (eligibleRef.item.active === false || text(eligibleRef.item.status).toLowerCase() === "inactive") {
            issue("RATE_MAPPING_INACTIVE", "error", "rateItems", eligibleRef.item, fieldPath, [eligibleRateId], "Work-type mapping references an inactive Rate Item.");
          } else if (!UOS.ProgramModel || typeof UOS.ProgramModel.isSpatiallyCompatibleRate !== "function" || !UOS.ProgramModel.isSpatiallyCompatibleRate(eligibleRef.item)) {
            issue("RATE_MAPPING_INCOMPATIBLE", "error", "rateItems", eligibleRef.item, fieldPath, [eligibleRateId], "Work-type Rate Item must use an area-compatible unit and quantity mode.");
          }
        });
        return;
      }
      var rateId = text(mappings[key]), rateRef = ids[rateId];
      if (!rateId) return;
      if (supportedMappingKeys.indexOf(key) < 0) { issue("RATE_MAPPING_WORK_TYPE_UNKNOWN", "error", "rateItems", { id: rateId }, "referenceData.shared.workTypeRateItems." + key, [key, rateId], "Work-type mapping uses an unsupported polygon work type."); return; }
      if (!rateRef || rateRef.collection !== "rateItems") issue("RATE_MAPPING_UNKNOWN", "error", "rateItems", { id: rateId }, "referenceData.shared.workTypeRateItems." + key, [rateId].filter(Boolean), "Work-type mapping references an unknown Rate Item.");
      else if (rateRef.item.active === false || text(rateRef.item.status).toLowerCase() === "inactive") issue("RATE_MAPPING_INACTIVE", "error", "rateItems", rateRef.item, "referenceData.shared.workTypeRateItems." + key, [rateId], "Work-type mapping references an inactive Rate Item.");
      else if (["m²", "m2", "sqm", "ha", "hectare", "hectares", "km²", "km2"].indexOf(text(rateRef.item.unit).toLowerCase()) < 0) issue("RATE_MAPPING_INCOMPATIBLE", "error", "rateItems", rateRef.item, "referenceData.shared.workTypeRateItems." + key, [rateId], "Polygon work-type mapping requires an area-compatible Rate Item unit.");
    });
    byCollection.costingLines.forEach(function (item) {
      var job = ids[text(item.jobId)], project = ids[text(item.projectId)];
      if (item.jobId && (!job || job.collection !== "jobs")) issue("COST_JOB_MISSING", "error", "costingLines", item, "jobId", [text(item.jobId)], "Costing Line has no existing Job.");
      if (!project || project.collection !== "projects" || job && job.item.projectId !== item.projectId) issue("COST_PROJECT_MISMATCH", "error", "costingLines", item, "projectId", [text(item.projectId)], "Costing Line Project does not match its Job.");
      if (text(item.rateItemId) && (!ids[item.rateItemId] || ids[item.rateItemId].collection !== "rateItems")) issue("RATE_UNKNOWN", "error", "costingLines", item, "rateItemId", [text(item.rateItemId)], "Costing Line references an unknown Rate Item.");
      if (!text(item.description || item.title) || !text(item.category) || !text(item.unit) || !Number.isFinite(Number(item.unitRate)) || !Number.isFinite(Number(item.quantity)) || !Number.isFinite(Number(item.estimatedTotal))) issue("COST_SNAPSHOT_INCOMPLETE", "error", "costingLines", item, "description/category/unit/unitRate/quantity/estimatedTotal", [], "Costing Line commercial snapshot is incomplete.");
    });
    var unresolvedRates = object(workspace && workspace.migration) && Array.isArray(workspace.migration.unresolvedRateMigration) ? workspace.migration.unresolvedRateMigration : [];
    unresolvedRates.forEach(function (entry, index) {
      issue("RATE_MIGRATION_UNRESOLVED", "error", "rateItems", { id: text(entry && entry.id) || "unresolved-rate-" + index }, "migration.unresolvedRateMigration", [text(entry && entry.id)].filter(Boolean), "Legacy Rate Item migration remains unresolved and was preserved without guessing.");
    });
    var geometryJobs = {}, geometryLines = {};
    byCollection.jobs.forEach(function (item) {
      var geometryId = text(item.sourceGeometryId);
      if (geometryId && text(item.sourceKind) === "space-map" && text(item.sourceEntityId) === geometryId) (geometryJobs[geometryId] = geometryJobs[geometryId] || []).push(item);
    });
    byCollection.costingLines.forEach(function (item) {
      var geometryId = text(item.sourceGeometryId);
      if (geometryId) (geometryLines[geometryId] = geometryLines[geometryId] || []).push(item);
    });
    byCollection.geometries.slice().sort(function (left, right) { return text(left.id).localeCompare(text(right.id)); }).forEach(function (geometry) {
      var geometryPayload = object(geometry.payload) ? geometry.payload : {};
      var geometryWorkType = text(geometry.workTypeKey || geometry.workType || geometryPayload.workTypeKey || geometryPayload.workType || geometryPayload.type).toLowerCase();
      var selectedSpatialRateId = text(geometry.rateItemId || geometryPayload.rateItemId);
      if (selectedSpatialRateId && supportedMappingKeys.indexOf(geometryWorkType) >= 0 && UOS.ProgramModel && typeof UOS.ProgramModel.eligibleSpatialRatesForWorkType === "function") {
        var eligibleGeometryRateIds = UOS.ProgramModel.eligibleSpatialRatesForWorkType(workspace, geometryWorkType).map(function (rate) { return text(rate && rate.id); });
        if (eligibleGeometryRateIds.indexOf(selectedSpatialRateId) < 0) {
          issue("WORK_GEOMETRY_RATE_NOT_ELIGIBLE", "error", "geometries", geometry, "rateItemId", [selectedSpatialRateId], "Selected polygon pricing basis is not an active compatible Rate Item eligible for its work type.");
        }
      }
      var jobs = (geometryJobs[geometry.id] || []).slice().sort(function (left, right) { return text(left.id).localeCompare(text(right.id)); });
      var lines = (geometryLines[geometry.id] || []).slice().sort(function (left, right) { return text(left.id).localeCompare(text(right.id)); });
      var operational = text(geometry.syncState && geometry.syncState.code) === "synced" || jobs.length || lines.length;
      if (jobs.length > 1) issue("WORK_LINEAGE_JOB_DUPLICATE", "error", "jobs", jobs[0], "sourceGeometryId", jobs.map(function (item) { return text(item.id); }), "Work Geometry has multiple canonical map Jobs.");
      if (operational && !jobs.length && !geometry.workRemoved && !(lines.length === 1 && lines[0].workCommandVersion === 1)) issue("WORK_LINEAGE_JOB_MISSING", "error", "geometries", geometry, "id", [], "Operational Work Geometry has no canonical map Job or canonical costing-only line.");
      if (lines.length > 1) issue("WORK_LINEAGE_COSTING_DUPLICATE", "error", "costingLines", lines[0], "sourceGeometryId", lines.map(function (item) { return text(item.id); }), "Work Geometry has multiple canonical CostingLines.");
      if (operational && jobs.length === 1 && !lines.length) issue("WORK_LINEAGE_COSTING_MISSING", "error", "jobs", jobs[0], "sourceGeometryId", [], "Canonical map Job has no canonical CostingLine.");
      lines.forEach(function (line) {
        var job = jobs.find(function (item) { return item.id === line.jobId; });
      if (line.jobId && !job || line.projectId !== geometry.projectId || line.owner !== geometry.owner) issue("WORK_LINEAGE_COSTING_PROJECT_MISMATCH", "error", "costingLines", line, "projectId/jobId", [text(line.jobId), text(geometry.projectId)].filter(Boolean).sort(), "CostingLine ownership or Project does not match its Work Geometry and Job.");
      if (Number.isFinite(Number(line.sourceAreaSqM)) && UOS.ProgramModel && typeof UOS.ProgramModel.spatialQuantityForRate === "function") {
       var expectedQuantity = null;
       try { expectedQuantity = UOS.ProgramModel.spatialQuantityForRate({ unit: line.unit, quantityMode: "m2", quantityKind: "area", active: true }, Number(line.sourceAreaSqM)); } catch (error) { expectedQuantity = null; }
       var actualQuantity = Number(line.quantity);
       var tolerance = Math.max(0.000001, Math.abs(expectedQuantity) * 0.000001);
       if (!Number.isFinite(expectedQuantity) || !Number.isFinite(actualQuantity) || Math.abs(actualQuantity - expectedQuantity) > tolerance) issue("SPATIAL_COST_QUANTITY_MISMATCH", "error", "costingLines", line, "quantity/unit/sourceAreaSqM", [text(geometry.id)].filter(Boolean), "Spatial CostingLine quantity does not match its source area and commercial unit snapshot.");
      }
      });
    });
    var quoteCosts = {};
    var quoteAuditNumbers = {};
    var replacementsByPredecessor = {};
    byCollection.quotes.forEach(function (item) {
      var root = ids[text(item.rootQuoteId)], previous = ids[text(item.previousQuoteId)];
      if (!/^(?:NSA|EVT)-Q-\d{4}-\d{4}-R\d{2,}$/.test(text(item.auditNumber))) issue("QUOTE_AUDIT_ID_INVALID", "error", "quotes", item, "auditNumber", [], "Quote has no valid audit ID.");
      else if (quoteAuditNumbers[item.auditNumber]) issue("QUOTE_AUDIT_ID_DUPLICATE", "error", "quotes", item, "auditNumber", [quoteAuditNumbers[item.auditNumber]], "Quote audit ID is duplicated.");
      else quoteAuditNumbers[item.auditNumber] = item.id;
      if (!root || root.collection !== "quotes" || root.item.projectId !== item.projectId) issue("QUOTE_AUDIT_ROOT_INVALID", "error", "quotes", item, "rootQuoteId", [text(item.rootQuoteId)], "Quote audit root is missing or belongs to another Project.");
      if (text(item.previousQuoteId) && (!previous || previous.collection !== "quotes" || previous.item.projectId !== item.projectId)) issue("QUOTE_AUDIT_PREVIOUS_INVALID", "error", "quotes", item, "previousQuoteId", [text(item.previousQuoteId)], "Previous Quote revision is missing or belongs to another Project.");
      var status = text(item.status);
      if (["Draft", "Issued", "Accepted", "Declined", "Superseded"].indexOf(status) < 0) issue("QUOTE_TRANSITION_INVALID", "error", "quotes", item, "status", [], "Quote has an invalid lifecycle state.");
      var supersedesId = text(item.supersedesQuoteId), supersededById = text(item.supersededByQuoteId);
      if (supersedesId) (replacementsByPredecessor[supersedesId] = replacementsByPredecessor[supersedesId] || []).push(item.id);
      if (supersedesId) {
        var predecessor = ids[supersedesId];
        if (!predecessor || predecessor.collection !== "quotes" || predecessor.item.projectId !== item.projectId) issue("QUOTE_SUPERSESSION_CHAIN_BROKEN", "error", "quotes", item, "supersedesQuoteId", [supersedesId], "Replacement Quote has no valid predecessor in the same Project.");
        else if (text(predecessor.item.supersededByQuoteId) !== text(item.id)) issue("QUOTE_SUPERSESSION_RECIPROCAL_MISSING", "error", "quotes", item, "supersedesQuoteId", [supersedesId], "Replacement Quote link is not reciprocal on its predecessor.");
      }
      if (supersededById) {
        var replacement = ids[supersededById];
        if (!replacement || replacement.collection !== "quotes" || replacement.item.projectId !== item.projectId) issue("QUOTE_SUPERSESSION_CHAIN_BROKEN", "error", "quotes", item, "supersededByQuoteId", [supersededById], "Superseded Quote has no valid replacement in the same Project.");
        else if (text(replacement.item.supersedesQuoteId) !== text(item.id)) issue("QUOTE_SUPERSESSION_RECIPROCAL_MISSING", "error", "quotes", item, "supersededByQuoteId", [supersededById], "Predecessor Quote link is not reciprocal on its replacement.");
      }
      if (status === "Superseded" && !supersededById) issue("QUOTE_SUPERSESSION_CHAIN_BROKEN", "error", "quotes", item, "supersededByQuoteId", [], "Superseded Quote has no exact replacement link.");
      if (status !== "Superseded" && supersededById) issue("QUOTE_TRANSITION_INVALID", "error", "quotes", item, "status/supersededByQuoteId", [supersededById], "Only a Superseded Quote may record a replacement link.");
      if (supersedesId && status === "Draft") issue("QUOTE_TRANSITION_INVALID", "error", "quotes", item, "status/supersedesQuoteId", [supersedesId], "A Draft revision cannot supersede its predecessor before successful issue.");
      if (["Issued", "Accepted", "Declined", "Superseded"].indexOf(status) >= 0) {
        var snapshotLines = byCollection.quoteLines.filter(function (line) { return text(line.quoteId) === text(item.id); });
        var snapshotIncomplete = !text(item.quoteDate) || !text(item.commercialFingerprint) || !snapshotLines.length || snapshotLines.some(function (line) {
          return !text(line.description) || !text(line.category) || !text(line.unit) || !Number.isFinite(Number(line.quantity)) || !Number.isFinite(Number(line.unitRate)) || !Number.isFinite(Number(line.total));
        });
        if (snapshotIncomplete) issue("QUOTE_SNAPSHOT_INCOMPLETE", "error", "quotes", item, "quoteDate/commercialFingerprint/quoteLines", snapshotLines.map(function (line) { return text(line.id); }).filter(Boolean).sort(), "Issued Quote commercial snapshot is incomplete or has no verifiable fingerprint.");
      }
    });
    Object.keys(replacementsByPredecessor).sort().forEach(function (predecessorId) {
      var replacementIds = replacementsByPredecessor[predecessorId].map(text).filter(Boolean).sort();
      if (replacementIds.length > 1) issue("QUOTE_SUPERSESSION_DUPLICATE_REPLACEMENT", "error", "quotes", ids[predecessorId] && ids[predecessorId].item || { id: predecessorId }, "supersededByQuoteId", replacementIds, "Multiple replacement Quotes claim the same predecessor.");
    });
    byCollection.quoteEvents.forEach(function (event) {
      if (text(event.eventType) !== "status_changed") return;
      var payload = object(event.payload) ? event.payload : {}, oldStatus = text(payload.oldStatus), newStatus = text(payload.newStatus);
      var allowed = { Draft: ["Issued"], Issued: ["Accepted", "Declined"], Accepted: [], Declined: [], Superseded: [] };
      var linkedQuote = ids[text(event.quoteId)], linked = linkedQuote && linkedQuote.collection === "quotes" ? linkedQuote.item : null;
      var validSupersession = newStatus === "Superseded" && linked && text(linked.supersededByQuoteId);
      if (!allowed[oldStatus] || allowed[oldStatus].indexOf(newStatus) < 0 && !validSupersession) issue("QUOTE_TRANSITION_INVALID", "error", "quoteEvents", event, "payload.oldStatus/payload.newStatus", [text(event.quoteId)].filter(Boolean), "Quote audit event records an invalid lifecycle transition.");
    });
    byCollection.quoteLines.forEach(function (item) {
      var linkedQuote = ids[text(item.quoteId)];
      if (!linkedQuote || linkedQuote.collection !== "quotes") issue("QUOTE_LINE_QUOTE_MISSING", "error", "quoteLines", item, "quoteId", [text(item.quoteId)], "Quote Line has no existing Quote.");
      else if (item.quoteAuditNumber !== linkedQuote.item.auditNumber) issue("QUOTE_LINE_AUDIT_MISMATCH", "error", "quoteLines", item, "quoteAuditNumber", [linkedQuote.item.id], "Quote Line audit ID differs from its Quote.");
      if (item.sourceKind === "costingLine") {
        var cost = ids[text(item.costingLineId)];
        if (!cost || cost.collection !== "costingLines") issue("QUOTE_LINE_COST_MISSING", "error", "quoteLines", item, "costingLineId", [text(item.costingLineId)], "Inherited Quote Line has no source Costing Line.");
        else if (cost.item.jobId !== item.jobId || cost.item.projectId !== item.projectId) issue("QUOTE_LINE_LINEAGE_MISMATCH", "error", "quoteLines", item, "costingLineId", [cost.item.id], "Inherited Quote Line lineage differs from its Costing Line.");
        var key = text(item.quoteId) + "|" + text(item.costingLineId);
        if (quoteCosts[key]) issue("QUOTE_LINE_DUPLICATE", "error", "quoteLines", item, "costingLineId", [quoteCosts[key], item.id], "Quote contains the same Costing Line more than once."); else quoteCosts[key] = item.id;
      }
    });
    byCollection.payments.forEach(function (item) {
      var quote = ids[text(item.quoteId)];
      if (!quote || quote.collection !== "quotes") issue("PAYMENT_QUOTE_MISSING", "error", "payments", item, "quoteId", [text(item.quoteId)], "Payment has no existing Quote.");
      else if (item.projectId !== quote.item.projectId || item.quoteAuditNumber !== quote.item.auditNumber) issue("PAYMENT_AUDIT_MISMATCH", "error", "payments", item, "quoteAuditNumber/projectId", [quote.item.id], "Payment audit references differ from its Quote.");
      if (!(Number(item.amount) > 0)) issue("PAYMENT_AMOUNT_INVALID", "error", "payments", item, "amount", [], "Payment amount must be greater than zero.");
      var paymentDate = text(item.paymentDate), parsedPaymentDate = new Date(paymentDate + "T00:00:00Z");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) || Number.isNaN(parsedPaymentDate.getTime()) || parsedPaymentDate.toISOString().slice(0, 10) !== paymentDate) issue("PAYMENT_DATE_INVALID", "error", "payments", item, "paymentDate", [], "Payment date is invalid.");
      if (["Bank transfer", "Card", "Cash", "EFT", "Purchase order", "Council Operational Budget", "Other"].indexOf(text(item.method)) < 0) issue("PAYMENT_METHOD_INVALID", "error", "payments", item, "method", [], "Payment method is not supported.");
      if (["Recorded", "Reversed"].indexOf(text(item.status)) < 0) issue("PAYMENT_STATUS_INVALID", "error", "payments", item, "status", [], "Payment status is invalid.");
      if (item.status === "Reversed" && !text(item.reversedAt)) issue("PAYMENT_REVERSAL_DATE_MISSING", "error", "payments", item, "reversedAt", [], "Reversed payment has no reversal timestamp.");
      if (item.status === "Reversed" && !text(item.reversalReason)) issue("PAYMENT_REVERSAL_REASON_MISSING", "warning", "payments", item, "reversalReason", [], "Reversed payment has no recorded reason.");
    });
    byCollection.projects.forEach(function (project) {
      if (Object.prototype.hasOwnProperty.call(project, "approvedBudget")) issue("FUNDING_LEGACY_INPUT_PRESENT", "warning", "projects", project, "approvedBudget", [], "Legacy approvedBudget remains preserved for migration review and is not a runtime funding input.");
      if (!object(project.funding) || project.funding.operationalAmount === null || project.funding.operationalAmount === undefined || project.funding.operationalAmount === "") issue("FUNDING_OPERATIONAL_AMOUNT_MISSING", "warning", "projects", project, "funding.operationalAmount", [], "Project has no explicit Council Operational Amount.");
      else if (!Number.isFinite(Number(project.funding.operationalAmount)) || Number(project.funding.operationalAmount) < 0) issue("FUNDING_OPERATIONAL_AMOUNT_INVALID", "error", "projects", project, "funding.operationalAmount", [], "Council Operational Amount must be a non-negative number.");
    });
    byCollection.applications.concat(byCollection.events).forEach(function (record) {
      if (Object.prototype.hasOwnProperty.call(record, "approvedBudget")) issue("FUNDING_LEGACY_INPUT_PRESENT", "warning", record.type === "event" ? "events" : "applications", record, "approvedBudget", [], "Legacy Register approvedBudget remains preserved for migration review and is not a runtime funding input.");
    });
    (object(workspace && workspace.migration) && Array.isArray(workspace.migration.unresolvedLinks) ? workspace.migration.unresolvedLinks : []).forEach(function (link) {
      if (text(link.status).toLowerCase() !== "resolved") issue("MIGRATION_LINK_UNRESOLVED", "warning", text(link.sourceCollection), { id: link.sourceId }, text(link.field), link.candidates || [], text(link.reason) || "Migration relationship remains unresolved.");
    });
    var migration = object(workspace && workspace.migration) ? workspace.migration : {};
    (Array.isArray(migration.unresolvedFunding) ? migration.unresolvedFunding : []).forEach(function (entry, index) {
      issue("FUNDING_MIGRATION_UNRESOLVED", "error", "projects", { id: text(entry && entry.projectId) || "unresolved-funding-" + index }, "migration.unresolvedFunding", Array.isArray(entry && entry.candidates) ? entry.candidates.map(function (candidate) { return text(candidate && candidate.source); }).filter(Boolean).sort() : [], text(entry && entry.reason) || "Legacy funding ambiguity remains preserved without guessing.");
    });
    (Array.isArray(migration.unresolvedQuoteLifecycle) ? migration.unresolvedQuoteLifecycle : []).forEach(function (entry, index) {
      issue("QUOTE_MIGRATION_UNRESOLVED", "error", "quotes", { id: text(entry && entry.sourceId) || "unresolved-quote-" + index }, "migration.unresolvedQuoteLifecycle", Array.isArray(entry && entry.relatedIds) ? entry.relatedIds.map(text).filter(Boolean).sort() : [], text(entry && entry.reason) || "Legacy Quote lifecycle ambiguity remains preserved without guessing.");
    });
    ["unresolvedSpatial", "unresolvedSpatialRecords", "unresolvedLocations", "unresolvedGeometries"].forEach(function (name) {
      (Array.isArray(migration[name]) ? migration[name] : []).forEach(function (entry, index) {
        if (text(entry && entry.status).toLowerCase() === "resolved") return;
        var candidates = Array.isArray(entry && entry.candidates) ? entry.candidates.slice().map(text).sort() : [];
        issue("SPATIAL_MIGRATION_UNRESOLVED", "warning", text(entry && (entry.sourceCollection || entry.collection)) || "migration", { id: text(entry && (entry.sourceId || entry.id)) || name + ":" + index }, text(entry && entry.field), candidates, text(entry && entry.reason) || "Spatial migration source remains preserved for review.");
      });
    });
    if (UOS.ProductContracts && typeof UOS.ProductContracts.validateHard === "function") {
      var existing = {};
      issues.forEach(function (item) { existing[[item.contractId, item.code, item.entityId, item.field].join("|")] = true; });
      UOS.ProductContracts.validateHard(workspace).forEach(function (item) {
        var key = [item.contractId, item.code, item.entityId, item.field].join("|");
        if (existing[key]) return;
        existing[key] = true;
        issues.push({ code: item.code, contractId: item.contractId, severity: item.severity || "error", collection: item.collection || "", entityId: item.entityId || "", field: item.field || "", relatedIds: item.relatedIds || [], message: item.message, repair: null });
      });
    }
    issues.sort(function (a, b) { return (a.contractId || "ZZZ").localeCompare(b.contractId || "ZZZ") || a.code.localeCompare(b.code) || a.entityId.localeCompare(b.entityId); });
    var counts = issues.reduce(function (result, item) { result[item.severity] += 1; result.total += 1; return result; }, { error: 0, warning: 0, total: 0 });
    var contractSummary = UOS.ProductContracts && typeof UOS.ProductContracts.summary === "function" ? UOS.ProductContracts.summary() : { total: 0, enforced: 0, deferred: 0 };
    return { status: counts.error ? "error" : counts.warning ? "warning" : "healthy", counts: counts, contracts: contractSummary, issues: issues };
  }
  UOS.ProgramDataHealth = { check: check };
}());
