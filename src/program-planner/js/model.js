(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var ACTIVE_CONFIG = UOS.ProgramAppConfig && typeof UOS.ProgramAppConfig.current === "function" ? UOS.ProgramAppConfig.current() : null;
  var APP_ID = ACTIVE_CONFIG && ACTIVE_CONFIG.appId || "uos.horticulture";
  var WORKSPACE_KIND = ACTIVE_CONFIG && ACTIVE_CONFIG.workspaceKind || "";
  var ACTIVE_OWNER = ACTIVE_CONFIG && ACTIVE_CONFIG.owner || "";
  var SCHEMA_VERSION = 5;
  var normalizedWorkspaces = typeof WeakSet === "function" ? new WeakSet() : null;
  var OWNERS = ACTIVE_OWNER ? [ACTIVE_OWNER] : ["NSA", "EVT"];
  var PAYMENT_METHODS = ["Bank transfer", "Card", "Cash", "EFT", "Purchase order", "Council Operational Budget", "Paid with Deposit", "Other"];
  var PAYMENT_STATUSES = ["Recorded", "Reversed"];
  var COLLECTIONS = ["applications", "events", "projects", "jobs", "tasks", "catalogs", "costingLines", "rateItems", "geometries", "quotes", "quoteLines", "payments", "paymentAllocations", "quoteEvents", "statusEvents", "statusRecommendations", "annualBudgets", "budgetEntries", "registerAllocations", "allocationEntries", "budgetCharges", "budgetChangeRequests", "budgetDecisions", "budgetCarryReviews"];
  var TYPES = {
    applications: "application", events: "event", projects: "project", jobs: "job", tasks: "task",
    catalogs: "catalog", costingLines: "costingLine", rateItems: "rateItem", geometries: "geometry", quotes: "quote", quoteLines: "quoteLine", payments: "payment", paymentAllocations: "paymentAllocation", quoteEvents: "quoteEvent", statusEvents: "statusEvent", statusRecommendations: "statusRecommendation", annualBudgets: "annualBudget", budgetEntries: "budgetEntry", registerAllocations: "registerAllocation", allocationEntries: "allocationEntry", budgetCharges: "budgetCharge", budgetChangeRequests: "budgetChangeRequest", budgetDecisions: "budgetDecision", budgetCarryReviews: "budgetCarryReview"
  };
  var PREFIXES = {
    application: "APP", event: "EVENT", project: "PROJ", job: "JOB", task: "TASK",
    catalog: "CAT", costingLine: "COST", rateItem: "RATE", geometry: "GEO", quote: "QUOTE", quoteLine: "QLINE", payment: "PAY", paymentAllocation: "PALLOC", quoteEvent: "QEVT", statusEvent: "SEVT", statusRecommendation: "SREC", annualBudget: "BUDGET", budgetEntry: "BENTRY", registerAllocation: "ALLOC", allocationEntry: "AENTRY", budgetCharge: "BCHARGE", budgetChangeRequest: "BREQ", budgetDecision: "BDEC", budgetCarryReview: "BCARRY"
  };
  var CHECKLIST_TEMPLATES = {
    NSA: [
      [1, "Planning and Approval", "Pre-project photos", "Baseline site condition photographic record prior to works"],
      [2, "Planning and Approval", "Application received", "Customer / applicant request submission record"],
      [3, "Planning and Approval", "Application approved", "Council horticultural authorization & permit approval"],
      [4, "Planning and Approval", "Resident contacted", "Resident / landholder notification & alignment"],
      [5, "Planning and Approval", "Site assessment", "On-site physical inspection (soil condition, hazards, boundaries)"],
      [6, "Planning and Approval", "WZTM needed?", "Work Zone Traffic Management determination & plan requirement"],
      [7, "Planning and Approval", "TPC's needed?", "Tree Protection Zone / Tree Protection Permit controls evaluation"],
      [8, "Planning and Approval", "DBYB plans", "Dial Before You Dig utility & underground infrastructure location plans"],
      [9, "Planning and Approval", "Service checks", "On-site verification of underground utilities & irrigation lines"],
      [10, "Planning and Approval", "SWIMS completed", "Safe Work Method Statements / Risk Assessment sign-off"],
      [11, "Planning and Approval", "Material estimates", "Soil, mulch, turf, plants, fertilizer, and edging quantity estimates"],
      [12, "Planning and Approval", "Labour estimates", "Internal staff crew hours, plant operator, and supervisor estimates"],
      [13, "Planning and Approval", "Plants / turf ordered", "Purchase order for nursery stock & turf supply"],
      [14, "Planning and Approval", "Other materials ordered", "Purchase order for topsoil, mulch, irrigation, and timber/stone"],
      [15, "Planning and Approval", "Check SRZ / TPZ with Arboriculture", "Structural Root Zone & Tree Protection Zone clearance with Arborist"],
      [16, "Planning and Approval", "Design", "Nature strip landscape / garden bed design & plant selection"],
      [17, "Contractors", "Contractors engaged", "Engagement of external civil / landscape contractors"],
      [18, "Contractors", "Contractor induction completed", "Site safety, environmental, and council induction completion"],
      [19, "Contractors", "Contractor name recorded", "Vendor / subcontractor company name & contact details logged"],
      [20, "Contractors", "Contractor safety sign-off", "Contractor WHS documentation & risk assessment sign-off"],
      [21, "Contractors", "Quote received", "Formal contractor quotation verification & approval"],
      [22, "Contractors", "RP completed", "Remediation / Reinstatement Plan verification"],
      [23, "Handover", "After photos", "Completed project photographic record"],
      [24, "Handover", "Copies of timesheets", "Internal staff labor timesheets & work order logs"],
      [25, "Handover", "Copies of invoices", "Contractor & material supplier invoices lodged for payment"]
    ],
    EVT: [
      [101, "Pre-Delivery Items", "Irrigation mark out", "Mark out irrigation infrastructure on site prior to remediation works"],
      [102, "Pre-Delivery Items", "Customer Consultation", "Consultation with customer / landholder regarding event remediation"],
      [111, "Pre-Delivery Items", "Request Raising PO", "Request approval and supporting details before raising the purchase order"],
      [103, "Pre-Delivery Items", "Raise PO", "Raise purchase order for remediation materials and contractor services"],
      [104, "Pre-Delivery Items", "City Works Permit", "Obtain required City Works Permit and site access authorization"],
      [105, "Pre-Delivery Items", "Notification relevant leading hand", "Notify leading hand and operational supervisor of scheduled works"],
      [106, "Pre-Delivery Items", "Post Events Report", "Prepare initial post-events damage assessment and remediation report"],
      [107, "Post Delivery", "Finalising reports for facilitator", "Finalise remediation completion reports for event facilitator / council"],
      [108, "Post Delivery", "Quote", "Final quote reconciliation and billing lodged"],
      [109, "Post Delivery", "Communicate with contractor for remediation", "Communicate completion sign-off with remediation contractor"],
      [110, "Post Delivery", "Communicate with internal for remediation", "Internal debrief and handover to horticulture maintenance team"],
      [112, "Post Delivery", "Turf Maintenance", "Schedule post-delivery turf maintenance and establishment care"]
    ]
  };

  Object.keys(CHECKLIST_TEMPLATES).forEach(function (owner) {
    CHECKLIST_TEMPLATES[owner] = CHECKLIST_TEMPLATES[owner].map(function (item, index) {
      return { id: item[0], owner: owner, section: item[1], category: item[1], title: item[2], description: item[3], desc: item[3], sortOrder: index };
    });
  });

  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === "function") { try { return structuredClone(value); } catch (e) {} }
    return JSON.parse(JSON.stringify(value));
  }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function checklistTemplates(owner) { return clone(CHECKLIST_TEMPLATES[owner === "EVT" ? "EVT" : "NSA"]); }
  function legacyChecklistTemplate(owner, key) {
    var templates = CHECKLIST_TEMPLATES[owner === "EVT" ? "EVT" : "NSA"], wanted = text(key);
    var direct = templates.find(function (template) { return text(template.id) === wanted; });
    if (direct) return direct;
    var ordinal = Number(wanted);
    return owner === "EVT" && Number.isInteger(ordinal) && ordinal > 0 ? templates[ordinal - 1] || null : null;
  }
  function canonicalizeChecklistLabels(result) {
    var projects = result.entities.projects || [];
    (result.entities.tasks || []).forEach(function (task) {
      var key = text(task.templateKey || task.legacyChecklistId);
      if (!key) return;
      var project = projects.find(function (item) { return item.id === task.projectId; });
      var owner = text(task.owner || project && project.owner) === "EVT" ? "EVT" : "NSA";
      var template = legacyChecklistTemplate(owner, key);
      if (!template) return;
      var title = text(task.title);
      if (!title || title.toLowerCase() === ("Task " + key).toLowerCase()) task.title = template.title;
      if (!text(task.section)) task.section = template.section;
      if (!text(task.description)) task.description = template.description;
    });
  }
  function canonicalizePlannerTasks(result) {
    var entities = result.entities || {};
    var projects = Array.isArray(entities.projects) ? entities.projects : [];
    var tasks = Array.isArray(entities.tasks) ? entities.tasks : [];
    var checklistState = object(result.workspace && result.workspace.projectChecklists) ? result.workspace.projectChecklists : {};
    var checklistSourceIds = Object.keys(checklistState);
    var consumedSources = {}, unresolved = [], reconciledCount = 0, createdCount = 0;
    var at = text(result.updatedAt) || timestamp();

    function assignment(value) {
      var next = text(value);
      return !next || next.toLowerCase() === "not assigned" ? null : next;
    }
    function applySaved(task, saved) {
      if (!object(saved)) return false;
      var changed = false;
      function set(field, value) {
        if (task[field] === value) return;
        task[field] = value;
        changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(saved, "status")) set("status", text(saved.status) || "Not Started");
      if (Object.prototype.hasOwnProperty.call(saved, "owner")) set("assigneeId", assignment(saved.owner));
      if (Object.prototype.hasOwnProperty.call(saved, "assigneeId")) set("assigneeId", assignment(saved.assigneeId));
      if (Object.prototype.hasOwnProperty.call(saved, "due")) set("dueDate", text(saved.due));
      if (Object.prototype.hasOwnProperty.call(saved, "dueDate")) set("dueDate", text(saved.dueDate));
      if (Object.prototype.hasOwnProperty.call(saved, "notes")) set("notes", text(saved.notes));
      if (Object.prototype.hasOwnProperty.call(saved, "deleted")) set("suppressed", saved.deleted === true);
      if (Object.prototype.hasOwnProperty.call(saved, "suppressed")) set("suppressed", saved.suppressed === true);
      if (changed) { task.updatedAt = at; reconciledCount += 1; }
      return changed;
    }

    projects.forEach(function (project) {
      var owner = project.owner === "EVT" ? "EVT" : "NSA";
      var projectTasks = tasks.filter(function (task) { return task.projectId === project.id; });
      var sourceIds = [text(project.id), text(project.applicationId), text(project.eventId)].filter(Boolean);
      var sourceId = sourceIds.find(function (id) { return object(checklistState[id]); }) || "";
      var savedState = sourceId ? checklistState[sourceId] : {};
      var usedKeys = {};
      if (sourceId) consumedSources[sourceId] = true;

      CHECKLIST_TEMPLATES[owner].forEach(function (template) {
        var templateKey = text(template.id);
        var expectedId = stableId(owner, "task", project.id + ":" + templateKey);
        var task = projectTasks.find(function (item) {
          return item.id === expectedId || text(item.templateKey || item.legacyChecklistId) === templateKey;
        });
        if (!task) {
          task = {
            id: expectedId, owner: owner, type: "task", projectId: project.id, templateKey: templateKey,
            title: template.title, section: template.section, description: template.description, sortOrder: template.sortOrder,
            status: "Not Started", assigneeId: null, dueDate: "", notes: "", jobId: null, schedulerJobId: null,
            paymentAllocationId: null, suppressed: false, createdAt: at, updatedAt: at,
            provenance: provenance({ sourceApp: APP_ID, sourceVersion: SCHEMA_VERSION, sourceId: project.id + ":" + templateKey, importedAt: at }, owner)
          };
          tasks.push(task);
          projectTasks.push(task);
          createdCount += 1;
        }
        var savedKey = object(savedState[task.id]) ? task.id : (object(savedState[templateKey]) ? templateKey : "");
        if (savedKey) { usedKeys[savedKey] = true; applySaved(task, savedState[savedKey]); }
      });

      projectTasks.forEach(function (task) {
        if (usedKeys[task.id] || !object(savedState[task.id])) return;
        usedKeys[task.id] = true;
        applySaved(task, savedState[task.id]);
      });

      Object.keys(savedState).forEach(function (key) {
        if (usedKeys[key]) return;
        unresolved.push({
          projectId: project.id, sourceRecordId: sourceId || project.id, legacyKey: key,
          reason: "Planner shadow state did not match an exact canonical Task ID or checklist template key; it was preserved for review.",
          preservedValue: clone(savedState[key])
        });
      });
    });

    checklistSourceIds.forEach(function (sourceId) {
      if (consumedSources[sourceId]) return;
      unresolved.push({
        projectId: null, sourceRecordId: sourceId, legacyKey: null,
        reason: "Planner shadow state was not linked to an existing Delivery Project and was preserved for review.",
        preservedValue: clone(checklistState[sourceId])
      });
    });

    entities.tasks = tasks;
    if (result.workspace && Object.prototype.hasOwnProperty.call(result.workspace, "projectChecklists")) delete result.workspace.projectChecklists;
    result.migration = object(result.migration) ? result.migration : {};
    if (checklistSourceIds.length) {
      var previous = Array.isArray(result.migration.unresolvedPlannerChecklistAssignments) ? result.migration.unresolvedPlannerChecklistAssignments : [];
      result.migration.unresolvedPlannerChecklistAssignments = previous.concat(unresolved);
      result.migration.plannerChecklistReconciliation = {
        status: unresolved.length ? "review-required" : "reconciled",
        reconciledTaskCount: reconciledCount, createdCanonicalTaskCount: createdCount, unresolvedCount: unresolved.length, reconciledAt: at
      };
    }
    return result;
  }
  function amount(value) { var parsed = Number(value); return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0; }
  function timestamp(value) { return text(value) || new Date().toISOString(); }
  function financialYearForReceivedDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
    if (!match) return "";
    var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    var parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return "";
    var start = month >= 7 ? year : year - 1;
    return String(start) + "-" + String((start + 1) % 100).padStart(2, "0");
  }
  function hash(value) {
    var result = 2166136261;
    String(value).split("").forEach(function (character) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); });
    return (result >>> 0).toString(36).toUpperCase().padStart(7, "0");
  }
  function stableId(owner, type, sourceId, discriminator) {
    if (type !== "rateItem" && OWNERS.indexOf(owner) < 0) throw new Error("owner must be NSA or EVT.");
    if (!PREFIXES[type]) throw new Error('Unsupported entity type "' + type + '".');
    var seed = text(sourceId) || text(discriminator);
    if (!seed) throw new Error("A source identifier or discriminator is required to create a stable ID.");
    if (type === "rateItem") return "RATE-" + hash("GLOBAL:rateItem:" + seed);
    return owner + "-" + PREFIXES[type] + "-" + hash(owner + ":" + type + ":" + seed);
  }
  function emptyEntities() {
    var result = {};
    COLLECTIONS.forEach(function (name) { result[name] = []; });
    return result;
  }
 function classifyRateKind(category, description, value) {
   var explicit = text(value), categoryText = text(category), source = categoryText + " " + text(description);
    if (/^material$/i.test(explicit)) return "Material";
    if (/^contractors?$/i.test(explicit)) return "Contractors";
    if (/^sundry$/i.test(explicit)) return "Sundry";
    if (/^(job|labour)$/i.test(explicit)) return "Labour";
    if (/contractor|subcontractor|plant hire|equipment hire|excavator|machinery|truck|tipper|bobcat/i.test(categoryText)) return "Contractors";
    if (/materials?|soil|turf|mulch|plant|tree|shrub|seed|lawn|top[ -]?dress|fertili[sz]|aggregate|gravel|sand|compost|irrigation|timber|pipe|hardware|supply/i.test(categoryText)) return "Material";
    if (/^(material|contractors?)$/i.test(explicit)) return explicit.toLowerCase() === "material" ? "Material" : "Contractors";
    if (/^equipment$/i.test(explicit)) return "Equipment";
    if ((!explicit || /^(equipment|equip)$/i.test(explicit)) && /contractor|subcontractor|plant hire|equipment hire|excavator|machinery|truck|tipper|bobcat/i.test(source)) return "Contractors";
    if ((!explicit || /^(equipment|equip)$/i.test(explicit)) && /materials?|soil|turf|mulch|plant|tree|shrub|seed|lawn|top[ -]?dress|fertili[sz]|aggregate|gravel|sand|compost|irrigation|timber|pipe|hardware|supply/i.test(source)) return "Material";
   if (/sundry|misc|fee|admin|permit|traffic/i.test(source)) return "Sundry";
   if (/labou?r|crew|staff|worker|supervisor|operator|hours|mowing|pruning|weeding|slashing|clearing|aerate|rolling/i.test(source)) return "Labour";
   return "Equipment";
 }
 var SUPPORTED_POLYGON_WORK_TYPES = Object.freeze([
 Object.freeze({ key: "turfing", label: "Turfing area" }),
 Object.freeze({ key: "aerate", label: "Aeration area" }),
 Object.freeze({ key: "fertilise", label: "Fertilising area" }),
 Object.freeze({ key: "topdressing", label: "Topdressing area" }),
 Object.freeze({ key: "rolling", label: "Rolling area" })
 ]);
 function freezeWorkTypeRateMapping(eligibleRateItemIds, defaultRateItemId) {
 var ids = Object.freeze((eligibleRateItemIds || []).slice());
 return Object.freeze({ eligibleRateItemIds: ids, defaultRateItemId: defaultRateItemId || null });
 }
 var CANONICAL_WORK_TYPE_RATE_ITEMS = Object.freeze({
 turfing: freezeWorkTypeRateMapping(["RATE-TURFING", "RATE-TURFING-HA"], "RATE-TURFING"),
 aerate: freezeWorkTypeRateMapping(["RATE-AERATION", "RATE-AERATION-HA"], "RATE-AERATION")
 });

 function normalizeWorkTypeRateMappingEntry(value) {
 var source = value;
 if (typeof source === "string") {
 var legacyId = text(source);
 return { eligibleRateItemIds: legacyId ? [legacyId] : [], defaultRateItemId: legacyId || null };
 }
 if (Array.isArray(source)) source = { eligibleRateItemIds: source, defaultRateItemId: null };
 source = object(source) ? source : {};
 var seen = {};
 var ids = (Array.isArray(source.eligibleRateItemIds) ? source.eligibleRateItemIds : []).map(text).filter(function (id) {
 if (!id || seen[id]) return false;
 seen[id] = true;
 return true;
 });
 var defaultId = text(source.defaultRateItemId) || null;
 return { eligibleRateItemIds: ids, defaultRateItemId: defaultId };
 }

 function workTypeRateMapping(workspace, key) {
 var normalizedKey = text(key).toLowerCase();
 var shared = workspace && workspace.referenceData && workspace.referenceData.shared;
 var configured = shared && object(shared.workTypeRateItems) ? shared.workTypeRateItems : {};
 var source = Object.prototype.hasOwnProperty.call(configured, normalizedKey)
 ? configured[normalizedKey]
 : CANONICAL_WORK_TYPE_RATE_ITEMS[normalizedKey];
 return normalizeWorkTypeRateMappingEntry(source);
 }

 function isSpatiallyCompatibleRate(rate) {
 if (!object(rate) || rate.active === false || text(rate.status).toLowerCase() === "inactive") return false;
 var unit = text(rate.unit).toLowerCase();
 var mode = text(rate.quantityMode || rate.quantityKind || rate.payload && (rate.payload.quantityMode || rate.payload.quantityKind)).toLowerCase();
 return ["m²", "m2", "sqm", "ha", "hectare", "hectares", "km²", "km2"].indexOf(unit) >= 0
 && ["m2", "area"].indexOf(mode) >= 0;
 }

 function spatialQuantityForRate(rate, areaSqM) {
 if (!isSpatiallyCompatibleRate(rate)) throw new Error("Rate Item is not spatially area-compatible.");
 var area = Number(areaSqM);
 if (!Number.isFinite(area) || area < 0) throw new Error("Canonical polygon areaSqM must be a non-negative number.");
 var unit = text(rate.unit).toLowerCase();
 if (["ha", "hectare", "hectares"].indexOf(unit) >= 0) return area / 10000;
 if (["km²", "km2"].indexOf(unit) >= 0) return area / 1000000;
 return area;
 }

 function eligibleSpatialRatesForWorkType(workspace, key) {
 var normalizedKey = text(key).toLowerCase();
 var supported = SUPPORTED_POLYGON_WORK_TYPES.some(function (item) { return item.key === normalizedKey; });
 if (!supported || !workspace || !workspace.entities || !Array.isArray(workspace.entities.rateItems)) return [];
 var mapping = workTypeRateMapping(workspace, normalizedKey);
 var byId = {};
 workspace.entities.rateItems.forEach(function (rate) { if (rate && rate.id) byId[rate.id] = rate; });
 return mapping.eligibleRateItemIds.map(function (id) { return byId[id]; }).filter(isSpatiallyCompatibleRate);
 }

  function blank(at) {
    var referenceData = {
      shared: {
 workTypeRateItems: clone(CANONICAL_WORK_TYPE_RATE_ITEMS)
      }
    };
  var entities = emptyEntities();
  if (UOS.ProgramDefaultRateCatalog && typeof UOS.ProgramDefaultRateCatalog.items === "function") {
    entities.rateItems = UOS.ProgramDefaultRateCatalog.items().map(function (item) {
      item.kind = classifyRateKind(item.category, item.description || item.title, item.kind);
      item.catalogSection = item.kind;
      item.libraryCategory = item.kind;
      return item;
    });
  }
  if (ACTIVE_OWNER) referenceData[ACTIVE_OWNER] = {};
    else { referenceData.NSA = {}; referenceData.EVT = {}; }
    var result = {
    app: APP_ID,
    workspaceKind: WORKSPACE_KIND || undefined,
    schemaVersion: SCHEMA_VERSION,
    workspaceRevision: 0,
    updatedAt: timestamp(at),
    entities: entities,
      context: { financialYear: "", selectedOwner: "", locale: "en-AU", timeZone: "Australia/Adelaide" },
      referenceData: referenceData,
      workspace: {
        destination: "register", selectedEntityId: null, activeRecordTab: "overview", calendarCursor: "",
        scheduler: { mode: "week", calendarScope: "application", sort: "date", filters: { ownership: [], status: [], crew: [] } },
        map: {
          scopeMode: "register", ownerMode: "", selectedRegisterId: "", selectedProjectId: "",
          selectedLocationId: "", selectedGeometryId: "", inspectorMode: "register"
        },
        inspector: { mode: "list", scrollTop: 0 }
      },
      migration: { status: "not-started", migratedAt: "", sources: [], warnings: [] }
    };
    return recoverAreaPricing(result);
  }
  
  function coordinateValid(value) {
    return Array.isArray(value) && value.length >= 2 &&
           Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])) &&
           Number(value[0]) >= -180 && Number(value[0]) <= 180 &&
           Number(value[1]) >= -90 && Number(value[1]) <= 90;
  }

  function spatialError(code, message, details) {
    var error = new Error(message);
    error.name = "SpatialIntegrityError";
    error.code = code;
    Object.keys(details || {}).forEach(function (key) { error[key] = clone(details[key]); });
    return error;
  }

  function normalizeLocationPin(raw, owner, index) {
    if (!object(raw)) return null;
    var coord = null;
    if (coordinateValid(raw.coordinate)) coord = [Number(raw.coordinate[0]), Number(raw.coordinate[1])];
    else if (coordinateValid(raw.coordinates)) coord = [Number(raw.coordinates[0]), Number(raw.coordinates[1])];
    else if (raw.lng != null && raw.lat != null && Number.isFinite(Number(raw.lng)) && Number.isFinite(Number(raw.lat))) coord = [Number(raw.lng), Number(raw.lat)];
    if (!coord) return null;
    var pinId = text(raw.id) || ((owner === "NSA" ? "NSA-LOC-" : "EVT-LOC-") + (index + 1));
    var pin = clone(raw);
    pin.id = pinId;
    pin.coordinate = coord;
    pin.name = text(raw.name || raw.title || raw.address || "Location Pin " + (index + 1));
    pin.address = text(raw.address || raw.name || "");
    pin.visible = raw.visible !== false;
    delete pin.coordinates;
    delete pin.lng;
    delete pin.lat;
    return pin;
  }

  function provenance(value, owner) {
    var source = object(value) ? clone(value) : {};
    source.owner = owner;
    source.sourceApp = text(source.sourceApp);
    source.sourceVersion = source.sourceVersion == null ? null : Number(source.sourceVersion);
    source.sourceId = text(source.sourceId || source.legacyId);
    source.importedAt = text(source.importedAt);
    return source;
  }
  function normalizeEntity(raw, collection, index) {
    if (!object(raw)) throw new Error(collection + " record " + (index + 1) + " must be an object.");
    var item = clone(raw);
    var type = TYPES[collection];
    var inferredOwner = text(item.owner) || (/^NSA-/.test(text(item.id)) ? "NSA" : /^EVT-/.test(text(item.id)) ? "EVT" : "");
    if (collection !== "rateItems" && OWNERS.indexOf(inferredOwner) < 0) throw new Error(collection + " record " + (index + 1) + " owner must be NSA or EVT.");
    item.owner = collection === "rateItems" ? "" : inferredOwner;
    item.type = type;
    item.provenance = provenance(item.provenance, collection === "rateItems" ? "GLOBAL" : inferredOwner);
    if (!text(item.id)) item.id = stableId(item.owner, type, item.provenance.sourceId, collection + ":" + index);
    item.id = text(item.id);
    if (collection === "rateItems") {
      item._legacyRateId = item.id;
      item.id = item.id.replace(/^(?:NSA|EVT)-RATE-/, "RATE-");
      if (item.id.indexOf("RATE-") !== 0) item.id = stableId("", type, item.provenance.sourceId, [item.category, item.description || item.title, item.unit].join("|"));
    } else if (item.id.indexOf(inferredOwner + "-") !== 0 && !(inferredOwner === "EVT" && item.id.indexOf("event-") === 0)) throw new Error(item.id + " does not match owner " + inferredOwner + ".");
    
    if (collection === "events" || collection === "applications") {
      var payload = object(item.payload) ? item.payload : {};
      item.receivedDate = text(item.receivedDate || item.dateReceived || item.lodgedDate || payload.receivedDate || payload.dateReceived || payload.lodgedDate || item.startDate);
      item.address = text(item.address || (typeof item.location === "string" ? item.location : "") || item.locationName || item.siteAddress);
      var rawLocs = Array.isArray(item.locations) ? item.locations : [];
      var pins = [];
      rawLocs.forEach(function (loc, idx) {
        var normalizedPin = normalizeLocationPin(loc, item.owner, idx);
        if (normalizedPin) pins.push(normalizedPin);
      });
      if (item.location && typeof item.location === "object") {
        var legacyObjPin = normalizeLocationPin(item.location, item.owner, pins.length);
        if (legacyObjPin) pins.push(legacyObjPin);
      }
      item.locations = pins;
      delete item.location;
    }
    if (collection === "projects") {
      item.location = text(typeof item.location === "string" ? item.location : (item.address || ""));
      delete item.locations;
    }
    if (collection === "geometries") {
      item.projectId = text(item.projectId) || null;
      var isLine = item.geometryKind === "line" || (item.geometry && (item.geometry.type === "LineString" || item.geometry.type === "MultiLineString"));
      item.geometryKind = isLine ? "line" : "polygon";
    }

    if (collection === "jobs") {
        item.updatesApplicationStatus = item.updatesApplicationStatus === true;
      var sourceKind = text(item.sourceKind).toLowerCase().replace(/[\s_]+/g, "-");
      item.sourceKind = ["calculator", "space-map", "planner", "manual"].indexOf(sourceKind) >= 0 ? sourceKind : (item.sourceGeometryId || item.geometryId ? "space-map" : "manual");
      item.sourceEntityId = text(item.sourceEntityId || item.sourceGeometryId || item.geometryId) || null;
      item.sourceGeometryId = text(item.sourceGeometryId || item.geometryId) || null;
      delete item.geometryId;
      item.startDate = text(item.startDate);
      item.endDate = text(item.endDate || item.startDate);
      item.startTime = text(item.startTime);
      item.endTime = text(item.endTime);
      item.allDay = item.allDay !== false && (!item.startTime && !item.endTime) ? true : Boolean(item.allDay);
      item.durationMinutes = Math.max(0, Number(item.durationMinutes) || 0);
      item.crewId = text(item.crewId) || null;
      item.locationId = text(item.locationId) || null;
      item.location = text(item.location);
      item.estimate = Math.max(0, amount(item.estimate));
      item.actualCost = item.actualCost == null || item.actualCost === "" ? null : Math.max(0, amount(item.actualCost));
    }
    if (collection === "projects" && object(item.funding)) {
      item.funding.operationalAmount = Math.max(0, amount(item.funding.operationalAmount));
    }
    if (collection === "annualBudgets") {
      item.financialYear = text(item.financialYear);
      item.status = text(item.status) || "draft";
      item.approvedAmount = Math.max(0, amount(item.approvedAmount));
      item.approvedBy = text(item.approvedBy);
      item.approvedAt = text(item.approvedAt);
      item.createdAt = text(item.createdAt);
    }
    if (collection === "budgetEntries" || collection === "allocationEntries") {
      item.kind = text(item.kind);
      item.amount = amount(item.amount);
      item.actor = text(item.actor);
      item.reason = text(item.reason);
      item.effectiveDate = text(item.effectiveDate);
      item.createdAt = text(item.createdAt);
      item.budgetId = text(item.budgetId);
      item.allocationId = text(item.allocationId);
      item.sourceAllocationId = text(item.sourceAllocationId);
    }
    if (collection === "registerAllocations") {
      item.budgetId = text(item.budgetId);
      item.registerId = text(item.registerId);
      item.createdAt = text(item.createdAt);
    }
    if (collection === "budgetCharges") {
      item.allocationId = text(item.allocationId);
      item.jobId = text(item.jobId);
      item.kind = text(item.kind);
      item.amount = Math.max(0, amount(item.amount));
      item.actor = text(item.actor);
      item.reason = text(item.reason);
      item.effectiveDate = text(item.effectiveDate);
      item.createdAt = text(item.createdAt);
    }
    if (collection === "catalogs") {
      item.financialYear = text(item.financialYear);
      item.status = text(item.status) || "Active";
      item.clonedFromCatalogId = text(item.clonedFromCatalogId) || null;
      item.createdAt = timestamp(item.createdAt || item.provenance && item.provenance.importedAt);
    }
    if (collection === "rateItems") {
      item.catalogId = text(item.catalogId) || null;
      var rateKind = text(item.kind);
        item.kind = item.kindSource === "user" && ["Labour", "Equipment", "Material", "Contractors", "Sundry"].indexOf(rateKind) >= 0
          ? rateKind : classifyRateKind(item.category || item.catalogSection, item.description || item.title || item.name, rateKind);
   item.catalogSection = item.kind;
   item.libraryCategory = item.kind;
      item.category = text(item.category || item.catalogSection) || "Sundry";
      item.description = text(item.description || item.title || item.name);
      item.title = text(item.title || item.description);
      item.unit = text(item.unit) || "item";
      item.unitRate = Math.max(0, amount(item.unitRate == null ? item.rate : item.unitRate));
      item.active = item.active !== false && text(item.status).toLowerCase() !== "inactive";
      item.status = item.active ? "Active" : "Inactive";
    }
    if (collection === "costingLines") {
      item.catalogId = text(item.catalogId) || null;
      item.jobId = text(item.jobId) || null;
      item.sourceGeometryId = text(item.sourceGeometryId || item.sourcePolygonId || item.geometryId) || null;
      delete item.sourcePolygonId;
      delete item.geometryId;
      item.assignmentState = item.jobId ? "Assigned" : "Unassigned";
      item.sourcePolygonId = text(item.sourcePolygonId) || null;
      item.quantity = Math.max(0, Number(item.quantity) || 0);
      item.unitRate = Math.max(0, amount(item.unitRate));
      item.estimatedTotal = Math.max(0, amount(item.estimatedTotal == null ? item.quantity * item.unitRate : item.estimatedTotal));
      item.actualCost = item.actualCost == null || item.actualCost === "" ? null : Math.max(0, amount(item.actualCost));
    }
    if (collection === "quotes") {
      item.quoteNumber = text(item.quoteNumber) || item.id;
      item.auditNumber = text(item.auditNumber);
      item.auditRootNumber = text(item.auditRootNumber);
      item.rootQuoteId = text(item.rootQuoteId) || null;
      item.previousQuoteId = text(item.previousQuoteId) || null;
      item.supersedesQuoteId = text(item.supersedesQuoteId) || null;
      item.supersededByQuoteId = text(item.supersededByQuoteId) || null;
      item.clientName = text(item.clientName);
      item.preparedBy = text(item.preparedBy);
      item.poNumber = text(item.poNumber);
      item.quoteDate = text(item.quoteDate) || new Date().toISOString().split("T")[0];
      item.expiryDate = text(item.expiryDate);
      item.discountRate = Math.max(0, Number(item.discountRate) || 0);
      item.contingencyRate = Math.max(0, Number(item.contingencyRate) || 0);
      item.scopeNotes = text(item.scopeNotes);
      item.terms = text(item.terms);
      item.status = text(item.status) || "Draft";
      item.subtotal = amount(item.subtotal);
      item.gst = amount(item.gst);
      item.grandTotal = amount(item.grandTotal);
    }
    if (collection === "quoteEvents") {
      item.quoteId = text(item.quoteId);
      item.eventType = text(item.eventType);
      item.actor = text(item.actor) || "Officer";
      item.timestamp = text(item.timestamp) || new Date().toISOString();
      item.reason = text(item.reason);
      item.payload = object(item.payload) ? item.payload : {};
    }
    if (collection === "quoteLines") {
      item.catalogId = text(item.catalogId) || null;
      if (/^(?:NSA|EVT)-QUOTE-/.test(item.id)) item.id = item.id.replace("-QUOTE-", "-QLINE-");
      item.quoteId = text(item.quoteId) || null;
      item.quoteAuditNumber = text(item.quoteAuditNumber);
      item.rateItemId = text(item.rateItemId) || null;
      item.sourceGeometryId = text(item.sourceGeometryId || item.sourcePolygonId || item.geometryId) || null;
      delete item.sourcePolygonId;
      delete item.geometryId;
      item.category = text(item.category);
      item.description = text(item.description);
      item.unit = text(item.unit) || "item";
      item.quantity = Math.max(0, Number(item.quantity) || 0);
      item.unitRate = Math.max(0, amount(item.unitRate));
      item.total = amount(item.total == null ? item.quantity * item.unitRate : item.total);
      item.sourceKind = text(item.sourceKind) || (item.costingLineId ? "costingLine" : "custom");
      delete item.paid;
    }
    if (collection === "payments") {
      item.quoteId = text(item.quoteId) || null;
      item.quoteAuditNumber = text(item.quoteAuditNumber);
      item.projectId = text(item.projectId) || null;
      item.amount = Math.max(0, amount(item.amount));
      item.paymentDate = text(item.paymentDate) || new Date().toISOString().split("T")[0];
      item.method = text(item.method) || "Other";
      item.reference = text(item.reference);
      item.notes = text(item.notes);
      item.status = text(item.status) || "Recorded";
      item.reversedAt = text(item.reversedAt);
      item.reversalReason = text(item.reversalReason);
    }
    if (collection === "tasks") {
      item.projectId = text(item.projectId) || null;
      item.templateKey = text(item.templateKey || item.legacyTemplateId) || null;
      item.section = text(item.section || item.category);
      item.assigneeId = text(item.assigneeId || item.assignee || item.ownerName) || null;
      item.dueDate = text(item.dueDate || item.due);
      item.notes = text(item.notes);
      item.sortOrder = Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index;
      item.jobId = text(item.jobId) || null;
      item.schedulerJobId = text(item.schedulerJobId) || null;
      item.suppressed = item.suppressed === true || item.deleted === true;
      delete item.deleted;
 item.paymentAllocationId = text(item.paymentAllocationId) || null;
 if (!object(item.plannerResetBaseline)) {
 item.plannerResetBaseline = {};
 ["title", "description", "section", "status", "operational", "assigneeId", "dueDate", "notes", "sortOrder", "suppressed"].forEach(function (field) {
 if (item[field] !== undefined) item.plannerResetBaseline[field] = clone(item[field]);
 });
 }
    }
    if (collection === "paymentAllocations") {
      item.projectId = text(item.projectId) || null;
      item.quoteId = text(item.quoteId) || null;
      item.quoteLineId = text(item.quoteLineId) || null;
      item.paymentId = text(item.paymentId) || null;
      item.taskId = text(item.taskId) || null;
      item.amount = Math.max(0, amount(item.amount));
      item.status = text(item.status) || "Active";
      item.createdAt = timestamp(item.createdAt);
      item.reversedAt = text(item.reversedAt);
      item.reversalReason = text(item.reversalReason);
    }
    return item;
  }
function mergeDefaults(target, defaults) {
    Object.keys(defaults).forEach(function (key) {
      if (target[key] === undefined) target[key] = clone(defaults[key]);
      else if (object(target[key]) && object(defaults[key])) mergeDefaults(target[key], defaults[key]);
    });
return target;
}

 function canonicalizeWorkTypeRateItems(result) {
 result.referenceData = object(result.referenceData) ? result.referenceData : {};
 result.referenceData.shared = object(result.referenceData.shared) ? result.referenceData.shared : {};
 var mappings = object(result.referenceData.shared.workTypeRateItems) ? result.referenceData.shared.workTypeRateItems : {};
 Object.keys(mappings).forEach(function (key) {
 mappings[key] = normalizeWorkTypeRateMappingEntry(mappings[key]);
 });
 result.referenceData.shared.workTypeRateItems = mappings;
 }
  function recoverAreaPricing(result) {
    var rates = result.entities.rateItems;
    var mappings = result.referenceData.shared.workTypeRateItems;
    var legacyTypes = { "RATE-TURFING": "turfing", "RATE-AERATION": "aerate", "RATE-1C7Q6H6": "fertilise", "RATE-1HLJI7U": "topdressing", "RATE-0DLVIOB": "rolling" };
    var recovery = result.migration.areaPricingRecovery || { version: 1, seededRateIds: [], repairedRateIds: [], warnings: [] };
    result.migration.areaPricingRecovery = recovery;
    function warn(message) { if (recovery.warnings.indexOf(message) < 0) recovery.warnings.push(message); }
    function referenced(id) { return ["jobs", "costingLines", "quoteLines"].some(function (name) { return result.entities[name].some(function (line) { return line.rateItemId === id || line.sourceRateItemId === id; }); }); }
    function typeFor(rate) {
      var sourceId = text(rate.provenance && rate.provenance.sourceId).replace(/-ESTIMATED$/, "");
      return rate.provenance && rate.provenance.migrationKind === "catalog-rate-clone" ? legacyTypes[sourceId] : legacyTypes[rate.id];
    }
    function areaUnit(rate) { return ["m²", "m2", "sqm", "ha", "hectare", "hectares", "km²", "km2"].indexOf(text(rate.unit).toLowerCase()) >= 0; }
    rates.forEach(function (rate) {
      if (!typeFor(rate) || !areaUnit(rate) || isSpatiallyCompatibleRate(rate) || rate.active === false || text(rate.status).toLowerCase() === "inactive") return;
      if (referenced(rate.id)) { warn('Rate "' + rate.id + '" needs a new area-compatible version; historical references were preserved.'); return; }
      rate.quantityMode = "m2"; rate.quantityKind = "area";
      rate.payload = object(rate.payload) ? rate.payload : {};
      rate.payload.quantityMode = "m2"; rate.payload.quantityKind = "area";
      if (recovery.repairedRateIds.indexOf(rate.id) < 0) recovery.repairedRateIds.push(rate.id);
    });
    Object.keys(mappings).forEach(function (key) {
      var entry = normalizeWorkTypeRateMappingEntry(mappings[key]);
      function resolve(id) {
        if (rates.some(function (rate) { return rate.id === id; })) return id;
        var matches = rates.filter(function (rate) { return rate.provenance && rate.provenance.migrationKind === "catalog-rate-clone" && rate.provenance.sourceId === id; });
        if (matches.length === 1) return matches[0].id;
        if (/-HA$/.test(id)) {
          var sources = rates.filter(function (rate) { return rate.provenance && rate.provenance.migrationKind === "catalog-rate-clone" && rate.provenance.sourceId === id.slice(0, -3); });
          if (sources.length === 1) return sources[0].id + "-HA";
        }
        if (matches.length > 1) warn('Ambiguous legacy pricing rate "' + id + '" was not remapped.');
        return id;
      }
      entry.eligibleRateItemIds = entry.eligibleRateItemIds.map(resolve).filter(function (id, index, ids) { return ids.indexOf(id) === index; });
      entry.defaultRateItemId = entry.defaultRateItemId ? resolve(entry.defaultRateItemId) : null;
      mappings[key] = entry;
    });
    rates.slice().forEach(function (rate) {
      var key = typeFor(rate);
      if (!key || !isSpatiallyCompatibleRate(rate)) return;
      var estimated = text(rate.measurementSource) === "estimated";
      if (!estimated && !Object.prototype.hasOwnProperty.call(mappings, key)) mappings[key] = { eligibleRateItemIds: [rate.id], defaultRateItemId: rate.id };
      var entry = mappings[key];
      var mapped = !estimated && entry && entry.eligibleRateItemIds.indexOf(rate.id) >= 0;
      if (!mapped && !estimated) return;
      if (["m²", "m2", "sqm"].indexOf(text(rate.unit).toLowerCase()) < 0) return;
      var id = rate.id + "-HA";
      var counterpart = rates.find(function (item) { return item.id === id; });
      if (!counterpart && mapped) counterpart = rates.find(function (item) {
        return entry.eligibleRateItemIds.indexOf(item.id) >= 0 && isSpatiallyCompatibleRate(item)
          && ["ha", "hectare", "hectares"].indexOf(text(item.unit).toLowerCase()) >= 0
          && text(item.measurementSource) === text(rate.measurementSource);
      });
      if (!counterpart) {
        if (recovery.seededRateIds.indexOf(id) >= 0) return;
        counterpart = clone(rate); counterpart.id = id; counterpart.unit = "ha";
        counterpart.unitRate = Math.round(Number(rate.unitRate) * 2500 * 100) / 100;
        counterpart.quantityMode = "m2"; counterpart.quantityKind = "area";
        counterpart.payload = Object.assign({}, counterpart.payload, { unit: "ha", unitRate: counterpart.unitRate, quantityMode: "m2", quantityKind: "area" });
        counterpart.provenance = Object.assign({}, counterpart.provenance, { sourceApp: "uos.area-pricing", sourceId: rate.id, migrationKind: "hectare-price-seed" });
        counterpart.pricingSeed = { sourceRateItemId: rate.id, multiplier: 2500 };
        rates.push(counterpart); recovery.seededRateIds.push(id);
      }
      if (counterpart.id === id && recovery.seededRateIds.indexOf(id) < 0) recovery.seededRateIds.push(id);
      if (mapped && isSpatiallyCompatibleRate(counterpart) && entry.eligibleRateItemIds.indexOf(counterpart.id) < 0) entry.eligibleRateItemIds.push(counterpart.id);
    });
    return result;
  }

  function canonicalizeRates(result) {
    var aliases = {}, canonical = {}, items = [];
    result.entities.rateItems.forEach(function (item) {
      if (typeof item.schedulerEnabled !== "boolean") item.schedulerEnabled = ["Labour", "Contractors"].indexOf(item.kind || item.category) >= 0;
      var oldId = text(item._legacyRateId || item.id);
      var baseId = text(item.id);
      var signature = JSON.stringify([text(item.category), text(item.description || item.title), text(item.unit), amount(item.unitRate), item.active !== false]);
      var id = baseId;
      if (canonical[id] && canonical[id].signature !== signature) {
        id = baseId + "-" + hash(oldId + ":" + signature);
        result.migration = object(result.migration) ? result.migration : {};
        result.migration.warnings = Array.isArray(result.migration.warnings) ? result.migration.warnings : [];
        result.migration.warnings.push('Legacy rate collision for "' + baseId + '"; migrated "' + oldId + '" as "' + id + '".');
      }
      aliases[oldId] = id;
      aliases[baseId] = aliases[baseId] || id;
      if (!canonical[id]) {
        delete item._legacyRateId;
        item.id = id;
        canonical[id] = { signature: signature, item: item };
        items.push(item);
      }
    });
    result.entities.rateItems = items;
    ["costingLines", "quoteLines"].forEach(function (collection) {
      result.entities[collection].forEach(function (item) {
        var oldId = text(item.rateItemId);
        if (oldId && aliases[oldId]) item.rateItemId = aliases[oldId];
      });
    });
  }
  function canonicalizeLegacyGlobalRates(input) {
    var workspace = clone(input);
    workspace.entities = object(workspace.entities) ? workspace.entities : {};
    workspace.entities.catalogs = Array.isArray(workspace.entities.catalogs) ? workspace.entities.catalogs : [];
    workspace.entities.rateItems = Array.isArray(workspace.entities.rateItems) ? workspace.entities.rateItems : [];
    workspace.migration = object(workspace.migration) ? workspace.migration : {};

    var legacyCatalogs = workspace.entities.catalogs;
    var legacyRates = workspace.entities.rateItems.filter(function (item) { return item && (text(item.catalogId) || text(item.owner)); });
    if (!legacyCatalogs.length && !legacyRates.length) {
      return { workspace: workspace, unresolved: Array.isArray(workspace.migration.unresolvedRateMigration) ? clone(workspace.migration.unresolvedRateMigration) : [] };
    }

    if (!object(workspace.migration.legacyRateMigrationArchive)) {
      workspace.migration.legacyRateMigrationArchive = { catalogs: clone(legacyCatalogs), rateItems: clone(legacyRates) };
    }
    var catalogById = {};
    legacyCatalogs.forEach(function (catalog) {
      var id = text(catalog && catalog.id);
      if (id) (catalogById[id] = catalogById[id] || []).push(catalog);
    });
    var previous = Array.isArray(workspace.migration.unresolvedRateMigration) ? workspace.migration.unresolvedRateMigration.map(clone) : [];
    var unresolvedByKey = {};
    previous.forEach(function (entry) { if (entry && entry.key) unresolvedByKey[entry.key] = entry; });
    function preserve(source, reason, index) {
      var id = text(source && source.id);
      var key = "rateItems:" + (id || "missing") + ":" + hash(JSON.stringify(source) + ":" + index);
      if (!unresolvedByKey[key]) unresolvedByKey[key] = { key: key, sourceCollection: "rateItems", sourceId: id || null, reason: reason, source: clone(source) };
    }
    function contentSignature(item) {
      var value = clone(item);
      delete value.owner; delete value.catalogId; delete value.provenance; delete value.migrationProvenance;
      return JSON.stringify(value);
    }

    var groups = {}, retained = [];
    workspace.entities.rateItems.forEach(function (item, index) {
      if (!item || !text(item.id)) { preserve(item, "Rate Item has no stable ID", index); return; }
      if (!text(item.catalogId) && !text(item.owner)) { retained.push(item); return; }
      var catalogId = text(item.catalogId), catalogs = catalogById[catalogId] || [];
      if (!catalogId || catalogs.length !== 1) {
        preserve(item, catalogId ? "Rate Item catalog link is missing or ambiguous" : "Legacy Rate Item has no catalog link", index);
        return;
      }
      (groups[text(item.id)] = groups[text(item.id)] || []).push({ item: item, catalog: catalogs[0], index: index });
    });
    Object.keys(groups).sort().forEach(function (id) {
      var sources = groups[id], signatures = {};
      sources.forEach(function (entry) { signatures[contentSignature(entry.item)] = true; });
      if (Object.keys(signatures).length !== 1) {
        sources.forEach(function (entry) { preserve(entry.item, "Duplicate Rate Item ID has divergent content", entry.index); });
        return;
      }
      var canonical = clone(sources[0].item);
      canonical.owner = "";
      canonical.catalogId = null;
      canonical.migrationProvenance = {
        legacyCatalogs: sources.map(function (entry) {
          return { catalogId: text(entry.catalog.id), owner: text(entry.catalog.owner), financialYear: text(entry.catalog.financialYear) };
        }).sort(function (a, b) { return JSON.stringify(a).localeCompare(JSON.stringify(b)); })
      };
      retained.push(canonical);
    });
    workspace.entities.catalogs = [];
    workspace.entities.rateItems = retained;
    var unresolved = Object.keys(unresolvedByKey).sort().map(function (key) { return unresolvedByKey[key]; });
    if (unresolved.length) workspace.migration.unresolvedRateMigration = unresolved; else delete workspace.migration.unresolvedRateMigration;
    return { workspace: workspace, unresolved: unresolved };
  }
  function canonicalizeQuoteAudit(result) {
    var groups = {};
    var usedRoots = {};
    var counters = {};
    result.entities.quotes.forEach(function (quote) {
      var existingRoot = text(quote.auditRootNumber);
      var match = /^(NSA|EVT)-Q-(\d{4})-(\d{4})$/.exec(existingRoot);
      if (match) {
        usedRoots[existingRoot] = true;
        counters[match[1] + ":" + match[2]] = Math.max(counters[match[1] + ":" + match[2]] || 0, Number(match[3]));
      }
      var key = existingRoot || [quote.owner, quote.projectId, quote.quoteNumber].join("|");
      if (!groups[key]) groups[key] = [];
      groups[key].push(quote);
    });
    Object.keys(groups).sort().forEach(function (key) {
      var quotes = groups[key].sort(function (a, b) { return Number(a.revision || 1) - Number(b.revision || 1) || a.id.localeCompare(b.id); });
      var first = quotes[0];
      var yearMatch = /^(\d{4})-/.exec(text(first.quoteDate));
      var year = yearMatch ? yearMatch[1] : "0000";
      var counterKey = first.owner + ":" + year;
      var rootNumber = text(first.auditRootNumber);
      if (!/^(?:NSA|EVT)-Q-\d{4}-\d{4}$/.test(rootNumber)) {
        do {
          counters[counterKey] = (counters[counterKey] || 0) + 1;
          rootNumber = first.owner + "-Q-" + year + "-" + String(counters[counterKey]).padStart(4, "0");
        } while (usedRoots[rootNumber]);
      }
      usedRoots[rootNumber] = true;
      var rootQuoteId = text(first.rootQuoteId) || first.id;
      quotes.forEach(function (quote, index) {
        quote.auditRootNumber = rootNumber;
        quote.rootQuoteId = text(quote.rootQuoteId) || rootQuoteId;
        quote.previousQuoteId = text(quote.previousQuoteId) || (index ? quotes[index - 1].id : null);
        quote.auditNumber = rootNumber + "-R" + String(Math.max(1, Number(quote.revision) || index + 1)).padStart(2, "0");
      });
    });
    var quoteIndex = {};
    result.entities.quotes.forEach(function (quote) { quoteIndex[quote.id] = quote; });
    result.entities.quoteLines.forEach(function (line) {
      var quote = quoteIndex[line.quoteId];
      if (quote) line.quoteAuditNumber = quote.auditNumber;
    });
    result.entities.payments.forEach(function (payment) {
      var quote = quoteIndex[payment.quoteId];
      if (quote) {
        payment.quoteAuditNumber = quote.auditNumber;
        payment.projectId = quote.projectId;
      }
    });
  }
  function canonicalizeLegacyQuoteLifecycle(input) {
    var workspace = clone(input);
    workspace.entities = object(workspace.entities) ? workspace.entities : {};
    workspace.entities.quotes = Array.isArray(workspace.entities.quotes) ? workspace.entities.quotes : [];
    workspace.migration = object(workspace.migration) ? workspace.migration : {};
    var existing = Array.isArray(workspace.migration.unresolvedQuoteLifecycle) ? workspace.migration.unresolvedQuoteLifecycle : [];
    var unresolvedByKey = {};
    existing.forEach(function (entry) {
      if (object(entry) && text(entry.key)) unresolvedByKey[text(entry.key)] = clone(entry);
    });
    var quotesById = {}, replacementsByPredecessor = {};
    workspace.entities.quotes.forEach(function (quote) {
      var id = text(quote && quote.id);
      if (id) quotesById[id] = quote;
      var predecessorId = text(quote && quote.supersedesQuoteId);
      if (predecessorId) (replacementsByPredecessor[predecessorId] = replacementsByPredecessor[predecessorId] || []).push(id);
    });
    function preserve(kind, quote, relatedIds, reason) {
      var sourceId = text(quote && quote.id);
      var related = (relatedIds || []).map(text).filter(Boolean).sort();
      var key = ["quote-lifecycle", kind, sourceId || "missing", related.join("|")].join(":");
      if (!unresolvedByKey[key]) {
        unresolvedByKey[key] = {
          key: key,
          kind: kind,
          sourceCollection: "quotes",
          sourceId: sourceId || null,
          relatedIds: related,
          reason: reason,
          source: clone(quote)
        };
      }
    }
    workspace.entities.quotes.slice().sort(function (left, right) { return text(left && left.id).localeCompare(text(right && right.id)); }).forEach(function (quote) {
      var id = text(quote && quote.id);
      var supersedesId = text(quote && quote.supersedesQuoteId);
      var supersededById = text(quote && quote.supersededByQuoteId);
      var descendants = workspace.entities.quotes.filter(function (candidate) {
        return text(candidate && candidate.previousQuoteId) === id;
      }).map(function (candidate) { return text(candidate.id); }).filter(Boolean).sort();
      if (text(quote && quote.status).toLowerCase() === "superseded" && !supersededById) {
        preserve("premature-or-ambiguous-supersession", quote, descendants, "Superseded Quote has no authoritative replacement link; legacy state was preserved without guessing.");
      }
      if (supersedesId) {
        var predecessor = quotesById[supersedesId];
        if (!predecessor || text(predecessor.supersededByQuoteId) !== id) preserve("broken-reciprocal-link", quote, [supersedesId], "Replacement supersedesQuoteId is missing its exact reciprocal predecessor link.");
      }
      if (supersededById) {
        var replacement = quotesById[supersededById];
        if (!replacement || text(replacement.supersedesQuoteId) !== id) preserve("broken-reciprocal-link", quote, [supersededById], "Predecessor supersededByQuoteId is missing its exact reciprocal replacement link.");
      }
    });
    Object.keys(replacementsByPredecessor).sort().forEach(function (predecessorId) {
      var replacementIds = replacementsByPredecessor[predecessorId].filter(Boolean).sort();
      if (replacementIds.length > 1) preserve("duplicate-replacement", quotesById[predecessorId], replacementIds, "Multiple Quotes claim the same predecessor; the legacy records were preserved without choosing a replacement.");
    });
    var unresolved = Object.keys(unresolvedByKey).sort().map(function (key) { return unresolvedByKey[key]; });
    if (unresolved.length) workspace.migration.unresolvedQuoteLifecycle = unresolved;
    else delete workspace.migration.unresolvedQuoteLifecycle;
    return { workspace: workspace, unresolved: unresolved };
  }
  function migrateV3ToV4(input) {
    if (!object(input) || Number(input.schemaVersion) !== 3) throw new Error("Expected a schemaVersion 3 workspace.");
    var result = clone(input), entities = object(result.entities) ? result.entities : {};
    result.entities = entities;
    COLLECTIONS.forEach(function (name) { if (!Array.isArray(entities[name])) entities[name] = []; });
    var registers = {}, projects = {}, financialYears = {};
    entities.applications.concat(entities.events).forEach(function (record) {
      var payload = object(record.payload) ? record.payload : {};
      record.receivedDate = text(record.receivedDate || record.dateReceived || record.lodgedDate || payload.receivedDate || payload.dateReceived || payload.lodgedDate || record.startDate);
      record.financialYear = financialYearForReceivedDate(record.receivedDate);
      registers[record.id] = record;
      if (record.financialYear) financialYears[record.owner + ":" + record.financialYear] = { owner: record.owner, financialYear: record.financialYear };
    });
    entities.projects.forEach(function (project) { projects[project.id] = project; });
    var originalRates = clone(entities.rateItems), catalogByFy = {}, rateByFy = {};
    entities.catalogs = [];
    entities.rateItems = [];
    Object.keys(financialYears).sort().forEach(function (financialYearKey) {
      var descriptor = financialYears[financialYearKey], owner = descriptor.owner, fy = descriptor.financialYear;
      var catalogId = owner + "-CAT-" + fy.slice(0, 4);
      catalogByFy[financialYearKey] = catalogId; rateByFy[financialYearKey] = {};
      entities.catalogs.push({ id: catalogId, owner: owner, type: "catalog", financialYear: fy, status: "Active", clonedFromCatalogId: null, createdAt: text(result.updatedAt) || "1970-01-01T00:00:00.000Z", provenance: { owner: owner, sourceApp: text(input.app), sourceVersion: 3, sourceId: "v3-rate-catalogue", importedAt: text(result.updatedAt), kind: "legacy-v3-snapshot" } });
      originalRates.forEach(function (rate, index) {
        var oldId = text(rate.id) || "rate:" + index;
        var copy = clone(rate);
        copy.id = "RATE-" + hash(owner + ":" + fy + ":" + oldId);
        copy.catalogId = catalogId;
        copy.kind = /^(material|sundry|resource|equipment)$/i.test(text(copy.category || copy.kind)) ? "Equipment" : "Labour";
        copy.provenance = provenance({ sourceApp: text(input.app), sourceVersion: 3, sourceId: oldId, importedAt: text(result.updatedAt) }, "GLOBAL");
        copy.provenance.migrationKind = "catalog-rate-clone";
        entities.rateItems.push(copy);
        rateByFy[financialYearKey][oldId] = copy.id;
      });
    });
    var unresolved = [];
    entities.projects.forEach(function (project) {
      var register = registers[text(project.applicationId || project.eventId)], fy = register && register.financialYear;
      project.financialYear = fy || "";
      project.catalogId = fy ? catalogByFy[project.owner + ":" + fy] : null;
      if (!fy) unresolved.push({ collection: "projects", id: project.id, reason: "Register Received date is missing or invalid." });
    });
    ["costingLines", "quoteLines"].forEach(function (name) {
      entities[name].forEach(function (line) {
        var project = projects[line.projectId], fy = project && project.financialYear;
        var fyKey = project && project.owner + ":" + fy;
        var legacyRateItemId = text(line.rateItemId);
        var migratedRateItemId = fy && legacyRateItemId && rateByFy[fyKey] && rateByFy[fyKey][legacyRateItemId];
        line.catalogId = fy ? catalogByFy[fyKey] : null;
        if (migratedRateItemId) line.rateItemId = migratedRateItemId;
        else if (legacyRateItemId) {
          line.legacyRateItemId = legacyRateItemId;
          line.rateItemId = null;
          unresolved.push({ collection: name, id: line.id, reason: fy ? "Legacy rate item was not found in the financial-year catalogue." : "Project financial year unresolved; legacy rate retained on the line for review." });
        }
      });
    });
    var lifted = [], existingTaskKeys = {};
    entities.tasks.forEach(function (task) {
      var job = entities.jobs.find(function (item) { return item.id === task.jobId; });
      task.projectId = text(task.projectId || job && job.projectId) || null;
      existingTaskKeys[task.projectId + ":" + text(task.templateKey || task.id)] = true;
    });
    var checklistState = object(result.workspace && result.workspace.projectChecklists) ? result.workspace.projectChecklists : {};
    var consumedChecklistSources = {}, unresolvedChecklistAssignments = [];
    entities.projects.forEach(function (project) {
      var definitions = Array.isArray(project.checklist) ? project.checklist : [];
      var sourceIds = [text(project.id), text(project.applicationId), text(project.eventId)].filter(Boolean);
      var sourceId = sourceIds.find(function (id) { return object(checklistState[id]); }) || "";
      var state = sourceId ? checklistState[sourceId] : {};
      if (sourceId) consumedChecklistSources[sourceId] = true;
      var keys = {};
      definitions.forEach(function (definition, index) { keys[text(definition.id || index + 1)] = definition; });
      Object.keys(state).forEach(function (key) { if (!keys[key]) keys[key] = {}; });
      Object.keys(keys).forEach(function (key, index) {
        if (existingTaskKeys[project.id + ":" + key]) return;
        var definition = keys[key], saved = object(state[key]) ? state[key] : {}, template = legacyChecklistTemplate(project.owner, key);
        var title = text(definition.title) || text(template && template.title) || "Task " + key;
        var section = text(definition.category || definition.section) || text(template && template.section);
        var description = text(definition.description || definition.desc) || text(template && template.description);
        if (!text(definition.title) && !template) {
          unresolvedChecklistAssignments.push({ projectId: project.id, sourceRecordId: sourceId || project.id, legacyKey: key, reason: "Legacy checklist key has no canonical NSA or Events definition; the task was preserved for review." });
        }
        lifted.push({ id: stableId(project.owner, "task", project.id + ":" + key), owner: project.owner, type: "task", projectId: project.id, templateKey: key, title: title, section: section, description: description, status: text(saved.status || definition.status) || "Not Started", assigneeId: text(saved.owner || definition.owner) || null, dueDate: text(saved.due || definition.dueDate || definition.due), notes: text(saved.notes || definition.notes), sortOrder: definition.sortOrder == null ? (template ? template.sortOrder : index) : Number(definition.sortOrder), jobId: null, paymentAllocationId: null, provenance: provenance({ sourceApp: text(input.app), sourceVersion: 3, sourceId: (sourceId || project.id) + ":" + key, importedAt: text(result.updatedAt) }, project.owner) });
      });
      delete project.checklist;
    });
    Object.keys(checklistState).forEach(function (sourceId) {
      if (consumedChecklistSources[sourceId]) return;
      unresolvedChecklistAssignments.push({ projectId: null, sourceRecordId: sourceId, legacyKey: null, reason: "Legacy checklist state was not linked to an imported Project and was not converted." });
    });
    entities.tasks = entities.tasks.concat(lifted);
    if (result.workspace) delete result.workspace.projectChecklists;
    entities.jobs.forEach(function (job) {
      var kind = text(job.sourceKind).toLowerCase().replace(/[\s_]+/g, "-");
      job.sourceKind = ["calculator", "space-map", "planner", "manual"].indexOf(kind) >= 0 ? kind : (text(job.sourceGeometryId || job.geometryId) ? "space-map" : "manual");
      job.sourceEntityId = text(job.sourceEntityId || job.sourceGeometryId || job.geometryId) || null;
    });
    entities.paymentAllocations = Array.isArray(entities.paymentAllocations) ? entities.paymentAllocations : [];
    result.schemaVersion = 4;
    result.migration = object(result.migration) ? result.migration : {};
    result.migration.status = "migrated";
    result.migration.migratedAt = text(result.migration.migratedAt || result.updatedAt) || "1970-01-01T00:00:00.000Z";
    result.migration.sources = (Array.isArray(result.migration.sources) ? result.migration.sources : []).concat([{ app: text(input.app), schemaVersion: 3 }]);
    result.migration.unresolvedCatalogAssignments = unresolved;
    result.migration.unresolvedChecklistAssignments = unresolvedChecklistAssignments;
    var legacyPaidLines = entities.quoteLines.filter(function (line) { return line.paid === true; }).map(function (line) { return line.id; });
    if (legacyPaidLines.length) {
      result.migration.paymentAllocationReview = { status: "review-required", quoteLineIds: legacyPaidLines, reason: "Legacy paid flags have no defensible payment allocation amount." };
    }
    return result;
  }
  function normalize(input) {
    if (!object(input)) throw new Error("Workspace must be an object.");
    if (input.app !== APP_ID) throw new Error('Workspace app must be "' + APP_ID + '".');
    if (WORKSPACE_KIND && input.workspaceKind && input.workspaceKind !== WORKSPACE_KIND) throw new Error("Workspace kind must be " + WORKSPACE_KIND + ".");
    if (ACTIVE_OWNER && object(input.referenceData)) {
      var foreignReference = ACTIVE_OWNER === "NSA" ? "EVT" : "NSA";
      if (Object.prototype.hasOwnProperty.call(input.referenceData, foreignReference)) throw new Error("referenceData." + foreignReference + " is outside the " + WORKSPACE_KIND + " workspace.");
    }
    if (Number(input.schemaVersion) === 1) return fromV1(input);
    if (Number(input.schemaVersion) === 2) return fromV2(input);
    if (Number(input.schemaVersion) === 3) return normalize(migrateV3ToV4(input)); if (Number(input.schemaVersion) === 4 && UOS.ProgramStatus) return normalize(UOS.ProgramStatus.migrate(input));
    if (Number(input.schemaVersion) !== SCHEMA_VERSION) throw new Error("Unsupported Horticulture Program Planner schemaVersion.");
    var result = clone(input);
    var defaults = blank(input.updatedAt);
    result.app = APP_ID;
    if (WORKSPACE_KIND) result.workspaceKind = WORKSPACE_KIND;
  result.schemaVersion = SCHEMA_VERSION;
  if (input.workspaceRevision != null && (!Number.isInteger(Number(input.workspaceRevision)) || Number(input.workspaceRevision) < 0)) {
    throw new Error("workspaceRevision must be a non-negative integer.");
  }
  result.workspaceRevision = input.workspaceRevision == null ? 0 : Number(input.workspaceRevision);
  result.updatedAt = timestamp(input.updatedAt);
    result.entities = object(input.entities) ? clone(input.entities) : {};
    COLLECTIONS.forEach(function (collection) {
      var values = result.entities[collection];
      if (values === undefined) values = [];
      if (!Array.isArray(values)) throw new Error("entities." + collection + " must be an array.");
      result.entities[collection] = values.map(function (item, index) { return normalizeEntity(item, collection, index); });
    });
    result.entities.annualBudgets.forEach(function (budget) {
      var first = Number(text(budget.financialYear).slice(0, 4));
      if (Number.isInteger(first) && first > 1900) {
        budget.yearStart = first + "-07-01";
        budget.yearEnd = (first + 1) + "-06-30";
      }
      budget.approvalState = budget.status === "draft" ? "draft" : "approved";
      budget.yearState = budget.status === "closed" ? "closed" : "open";
      if (budget.status !== "draft" && !budget.approvalDecisionId && !budget.reconciliationDecisionId) budget.reviewRequired = true;
      else if (budget.approvalDecisionId || budget.reconciliationDecisionId) budget.reviewRequired = false;
      if (budget.approvedAmountCents == null) budget.approvedAmountCents = Math.round(Number(budget.approvedAmount || 0) * 100);
    });
    ["budgetEntries", "allocationEntries", "budgetCharges"].forEach(function (name) {
      result.entities[name].forEach(function (entry) {
        if (!entry.governanceVersion) {
          var allocation = result.entities.registerAllocations.find(function (row) { return row.id === (entry.allocationId || entry.sourceAllocationId); });
          if (allocation && !entry.registerId) entry.registerId = allocation.registerId;
          if (!entry.referenceNumberStatus) entry.referenceNumberStatus = entry.registerId ? "unverified legacy" : "not applicable";
        }
      });
    });
    result.context = mergeDefaults(object(result.context) ? result.context : {}, defaults.context);
result.referenceData = mergeDefaults(object(result.referenceData) ? result.referenceData : {}, defaults.referenceData);
 canonicalizeWorkTypeRateItems(result);
    if (ACTIVE_OWNER) {
      delete result.referenceData[ACTIVE_OWNER === "NSA" ? "EVT" : "NSA"];
      delete result.context.majorEvents;
      delete result.context.roadClosures;
    }
    result.workspace = mergeDefaults(object(result.workspace) ? result.workspace : {}, defaults.workspace);
    result.workspace.scheduler.calendarScope = result.workspace.scheduler.calendarScope === "all" ? "all" : "application";
    result.migration = mergeDefaults(object(result.migration) ? result.migration : {}, defaults.migration);
    if (!Array.isArray(result.migration.legacyBudgetEntryIds)) {
      if (result.migration.budgetGovernanceVersion === 1) throw new Error("Governed budget legacy-entry baseline is missing.");
      if (["budgetEntries", "allocationEntries", "budgetCharges"].some(function (name) { return result.entities[name].some(function (entry) { return entry.governanceVersion; }); }) ||
          result.entities.annualBudgets.some(function (budget) { return budget.approvalDecisionId || budget.reconciliationDecisionId; })) throw new Error("Governed budget baseline is missing.");
      result.migration.legacyBudgetEntryIds = ["budgetEntries", "allocationEntries", "budgetCharges"].reduce(function (ids, name) {
        return ids.concat(result.entities[name].filter(function (entry) { return !entry.governanceVersion; }).map(function (entry) { return entry.id; }));
      }, []);
    }
    canonicalizePlannerTasks(result);
    canonicalizeChecklistLabels(result);
    canonicalizeRates(result);
    recoverAreaPricing(result);
    canonicalizeQuoteAudit(result);
    var errors = validate(result);
    if (errors.length) throw new Error("Invalid unified workspace:\n- " + errors.join("\n- "));
    if (normalizedWorkspaces) normalizedWorkspaces.add(result);
    return result;
  }
  function isNormalized(value) { return Boolean(normalizedWorkspaces && object(value) && normalizedWorkspaces.has(value)); }
  
  function fromV2(input) {
    var result = clone(input);
    result.schemaVersion = 3;
    result.entities = object(result.entities) ? result.entities : {};
    COLLECTIONS.forEach(function (name) { if (!Array.isArray(result.entities[name])) result.entities[name] = []; });
    result = canonicalizeSpatialV3(result);
    result.migration = object(result.migration) ? result.migration : {};
    result.migration.status = "migrated";
    result.migration.migratedAt = text(result.migration.migratedAt) || timestamp();
    result.migration.sources = Array.isArray(result.migration.sources) ? result.migration.sources : [{ app: APP_ID, schemaVersion: 2 }];
    result.migration.warnings = Array.isArray(result.migration.warnings) ? result.migration.warnings : [];
    return normalize(result);
  }

  function canonicalizeSpatialV3(result) {
    result = clone(result);
    var entities = result.entities;
    var events = entities.events || [];
    var apps = entities.applications || [];
    var projects = entities.projects || [];
    var geometries = entities.geometries || [];
    result.migration = object(result.migration) ? result.migration : {};
    var unresolved = Array.isArray(result.migration.unresolvedSpatial) ? result.migration.unresolvedSpatial : [];
    function preserveUnresolved(kind, source, reason, candidates) {
      var sourceId = text(source && source.id);
      var key = [kind, sourceId, reason, (candidates || []).join("|")].join(":");
      if (!unresolved.some(function (item) { return item.key === key; })) {
        unresolved.push({ key: key, kind: kind, sourceId: sourceId || null, reason: reason, candidateIds: (candidates || []).slice().sort(), source: clone(source) });
      }
    }
    function exactRegisterForProject(project) {
      var parentIds = [text(project && project.applicationId), text(project && project.eventId)].filter(Boolean);
      if (parentIds.length !== 1) return null;
      var matches = events.concat(apps).filter(function (register) { return text(register.id) === parentIds[0] && register.owner === project.owner; });
      return matches.length === 1 ? matches[0] : null;
    }
    function registersOwningPinId(pinId) {
      return events.concat(apps).filter(function (register) {
        return (Array.isArray(register.locations) ? register.locations : []).some(function (pin) { return text(pin && pin.id) === text(pinId); });
      });
    }

    // 1. Migrate project.locations[] to linked Register records
    projects.forEach(function (project) {
      if (Array.isArray(project.locations) && project.locations.length > 0) {
        var parentReg = exactRegisterForProject(project);
        if (parentReg) {
          parentReg.locations = Array.isArray(parentReg.locations) ? parentReg.locations : [];
          project.locations.forEach(function (loc, idx) {
            var pin = normalizeLocationPin(loc, parentReg.owner, parentReg.locations.length);
            if (pin && !parentReg.locations.some(function (p) { return text(p.id) === pin.id; })) parentReg.locations.push(pin);
            else if (!pin) preserveUnresolved("project-location", loc, "invalid-coordinate", [project.id]);
            else preserveUnresolved("project-location", loc, "location-id-collision", [parentReg.id, pin.id]);
          });
        } else project.locations.forEach(function (loc) { preserveUnresolved("project-location", loc, "register-parent-not-unambiguous", [project.id]); });
        delete project.locations;
      }
      if (project.location && typeof project.location === "object") {
        var parentRegLoc = exactRegisterForProject(project);
        if (parentRegLoc) {
          var pinObj = normalizeLocationPin(project.location, parentRegLoc.owner, (parentRegLoc.locations || []).length);
          if (pinObj) {
            parentRegLoc.locations = Array.isArray(parentRegLoc.locations) ? parentRegLoc.locations : [];
            if (!parentRegLoc.locations.some(function (p) { return text(p.id) === pinObj.id; })) parentRegLoc.locations.push(pinObj);
            else preserveUnresolved("project-location", project.location, "location-id-collision", [parentRegLoc.id, pinObj.id]);
          }
          else preserveUnresolved("project-location", project.location, "invalid-coordinate", [project.id]);
          project.location = text(parentRegLoc.address || parentRegLoc.title || "");
        } else {
          preserveUnresolved("project-location", project.location, "register-parent-not-unambiguous", [project.id]);
          project.location = text(project.location.address || project.location.name || "");
        }
      }
    });

    // 2. Convert geometryKind: "location" to register pins and remove from geometries
    var workGeometries = [];
    geometries.forEach(function (geom) {
      var isLocationKind = text(geom.geometryKind).toLowerCase() === "location" || (geom.geometry && geom.geometry.type === "Point");
      if (isLocationKind) {
        var registerIds = [text(geom.eventId), text(geom.applicationId)].filter(Boolean);
        var linkedProjects = projects.filter(function (project) { return text(project.id) === text(geom.projectId); });
        if (!registerIds.length && linkedProjects.length === 1) {
          var linkedRegister = exactRegisterForProject(linkedProjects[0]);
          if (linkedRegister) registerIds.push(linkedRegister.id);
        }
        registerIds = registerIds.filter(function (id, index, list) { return list.indexOf(id) === index; });
        var registerMatches = events.concat(apps).filter(function (register) { return registerIds.indexOf(text(register.id)) >= 0 && register.owner === geom.owner; });
        var targetReg = registerMatches.length === 1 && registerIds.length === 1 ? registerMatches[0] : null;
        if (targetReg) {
          var coord = geom.geometry && Array.isArray(geom.geometry.coordinates) ? geom.geometry.coordinates : (geom.payload && geom.payload.coordinate);
          if (coordinateValid(coord)) {
            var pin = {
              id: text(geom.id).replace("-GEO-", "-LOC-"),
              coordinate: [Number(coord[0]), Number(coord[1])],
              name: text(geom.payload && (geom.payload.name || geom.payload.title || geom.payload.address)) || text(targetReg.title || targetReg.eventName || "Location Pin"),
              address: text(geom.payload && (geom.payload.address || geom.payload.name)) || text(targetReg.address || ""),
              visible: geom.payload ? geom.payload.visible !== false : true
            };
            targetReg.locations = Array.isArray(targetReg.locations) ? targetReg.locations : [];
            var pinOwners = registersOwningPinId(pin.id);
            if (!pinOwners.length) targetReg.locations.push(pin);
            else preserveUnresolved("location-geometry", geom, "location-id-collision", pinOwners.map(function (register) { return register.id; }).concat(pin.id));
          } else preserveUnresolved("location-geometry", geom, "invalid-coordinate", [targetReg.id]);
        } else preserveUnresolved("location-geometry", geom, "register-parent-not-unambiguous", registerIds);
        return; // Exclude location geometry from canonical geometries collection
      }

      // 3. Resolve projectId for legacy register-owned Work Geometry
      if (!text(geom.projectId)) {
        var regId = text(geom.eventId || geom.applicationId || (geom.payload && (geom.payload.eventId || geom.payload.applicationId)));
        if (regId) {
          var projectMatches = projects.filter(function (p) { return p.owner === geom.owner && text(p.status).toLowerCase() !== "archived" && (text(p.applicationId) === regId || text(p.eventId) === regId); });
          if (projectMatches.length === 1) {
            var linkedProject = projectMatches[0];
            geom.projectId = linkedProject.id;
            geom.provenance = provenance(geom.provenance || { sourceApp: APP_ID, sourceVersion: 2, sourceId: geom.id }, geom.owner);
            geom.provenance.createdByMigration = true;
            geom.provenance.migrationSource = "v2-register-owned-geometry";
          } else preserveUnresolved("work-geometry", geom, projectMatches.length ? "multiple-active-projects" : "project-parent-not-found", projectMatches.map(function (p) { return p.id; }));
        } else preserveUnresolved("work-geometry", geom, "register-parent-not-found", []);
      }
      if (!text(geom.projectId)) return;
      var canonicalProjects = projects.filter(function (project) { return text(project.id) === text(geom.projectId); });
      if (canonicalProjects.length !== 1) {
        preserveUnresolved("work-geometry", geom, canonicalProjects.length ? "project-id-ambiguous" : "project-parent-not-found", canonicalProjects.map(function (project) { return project.id; }));
        return;
      }
      if (canonicalProjects[0].owner !== geom.owner) {
        preserveUnresolved("work-geometry", geom, "project-owner-mismatch", [canonicalProjects[0].id]);
        return;
      }
      delete geom.eventId;
      delete geom.applicationId;
      workGeometries.push(geom);
    });
    entities.geometries = workGeometries;
    result.migration.unresolvedSpatial = unresolved.sort(function (left, right) { return left.key.localeCompare(right.key); });
    return result;
  }

  function fromV1(input) {
    var result = clone(input);
    result.schemaVersion = 3;
    result.entities = object(result.entities) ? result.entities : {};
    COLLECTIONS.forEach(function (name) { if (!Array.isArray(result.entities[name])) result.entities[name] = []; });
    liftV1Entities(result);
    result = canonicalizeSpatialV3(result);
    result.migration = object(result.migration) ? result.migration : {};
    result.migration.status = "migrated";
    result.migration.migratedAt = text(result.migration.migratedAt) || timestamp();
    result.migration.sources = Array.isArray(result.migration.sources) ? result.migration.sources : [{ app: APP_ID, schemaVersion: 1 }];
    result.migration.warnings = Array.isArray(result.migration.warnings) ? result.migration.warnings : [];
    return normalize(result);
  }
  function liftV1Entities(result) {
    var entities = result.entities;
    var polygonIds = {};
    var liftedTasks = [];
    var retainedJobs = [];
    entities.jobs.forEach(function (job, index) {
      if (!object(job) || !text(job.parentJobId)) { retainedJobs.push(job); return; }
      var owner = text(job.owner) || (/^EVT-/.test(text(job.id)) ? "EVT" : "NSA");
      liftedTasks.push({
        id: stableId(owner, "task", text(job.id) || "v1-child-job:" + index), owner: owner, type: "task",
        title: text(job.title), status: text(job.status), jobId: text(job.parentJobId), startDate: text(job.startDate), endDate: text(job.endDate),
        payload: clone(job.payload || {}), provenance: provenance(job.provenance || { sourceApp: APP_ID, sourceVersion: 1, sourceId: job.id }, owner)
      });
    });
    entities.jobs = retainedJobs;
    entities.tasks = entities.tasks.concat(liftedTasks);
    entities.events.forEach(function (event, eventIndex) {
      if (!object(event)) return;
      var owner = text(event.owner) || "EVT";
      var payload = object(event.payload) ? event.payload : {};
      var polygons = Array.isArray(payload.polygons) ? payload.polygons : [];
      polygons.forEach(function (polygon, polygonIndex) {
        if (!object(polygon)) return;
        var legacyId = text(polygon.id) || "event:" + eventIndex + ":polygon:" + polygonIndex;
        var id = stableId(owner, "geometry", legacyId);
        polygonIds[owner + ":" + legacyId] = id;
        entities.geometries.push({
          id: id, owner: owner, type: "geometry", eventId: event.id, geometryKind: "polygon",
          geometry: clone(polygon.geometry || { type: polygon.type || "Polygon", coordinates: polygon.coordinates || [] }),
          payload: clone(polygon), provenance: provenance({ sourceApp: APP_ID, sourceVersion: 1, sourceId: legacyId }, owner)
        });
      });
      var location = payload.locationPin || payload.locationGeometry || (object(payload.location) && (payload.location.coordinates || payload.location.lng != null) ? payload.location : null);
      if (location) {
        var locationId = text(location.id) || text(event.id) + ":location";
        entities.geometries.push({
          id: stableId(owner, "geometry", locationId), owner: owner, type: "geometry", eventId: event.id, geometryKind: "location",
          geometry: clone(location.geometry || (location.coordinates ? { type: "Point", coordinates: location.coordinates } : { type: "Point", coordinates: [Number(location.lng), Number(location.lat)] })),
          payload: clone(location), provenance: provenance({ sourceApp: APP_ID, sourceVersion: 1, sourceId: locationId }, owner)
        });
      }
      var quote = object(payload.quote) ? payload.quote : {};
      var quoteLines = Array.isArray(quote.lines) ? quote.lines : (Array.isArray(payload.quoteLines) ? payload.quoteLines : []);
      quoteLines.forEach(function (line, lineIndex) {
        if (!object(line)) return;
        var legacyLineId = text(line.id) || text(event.id) + ":quote:" + lineIndex;
        var lifted = clone(line);
        lifted.id = stableId(owner, "quoteLine", legacyLineId);
        lifted.owner = owner;
        lifted.type = "quoteLine";
        lifted.eventId = event.id;
        lifted.payload = clone(line.payload || line);
        lifted.provenance = provenance(line.provenance || { sourceApp: APP_ID, sourceVersion: 1, sourceId: legacyLineId }, owner);
        entities.quoteLines.push(lifted);
      });
    });
    entities.costingLines.forEach(function (line) {
      if (!object(line) || !text(line.sourcePolygonId)) return;
      var owner = text(line.owner) || (/^EVT-/.test(text(line.id)) ? "EVT" : "NSA");
      line.sourcePolygonId = polygonIds[owner + ":" + text(line.sourcePolygonId)] || line.sourcePolygonId;
    });
  }
  function validateDate(value) { return !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z")); }
  function validateTime(value) { return !value || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }
  function spatialInvariantViolations(workspace) {
    var violations = [];
    var entities = object(workspace && workspace.entities) ? workspace.entities : {};
    var projects = Array.isArray(entities.projects) ? entities.projects : [];
    var geometries = Array.isArray(entities.geometries) ? entities.geometries : [];
    var registers = (Array.isArray(entities.applications) ? entities.applications : []).concat(Array.isArray(entities.events) ? entities.events : []);
    var projectById = {}, registerById = {};
    projects.forEach(function (item) { if (text(item && item.id)) projectById[text(item.id)] = item; });
    registers.forEach(function (item) { if (text(item && item.id)) registerById[text(item.id)] = item; });
    projects.forEach(function (item) {
      if (Array.isArray(item.locations) && item.locations.length) violations.push({ code: "PROJECT_PIN_PROHIBITED", collection: "projects", entityId: text(item.id), field: "locations", severity: "error", message: "Project must not contain mapped Location Pins in schema v3." });
      var parents = [text(item.applicationId), text(item.eventId)].filter(Boolean);
      if (parents.length !== 1 || !registerById[parents[0]]) violations.push({ code: "PROJECT_PARENT_INVALID", collection: "projects", entityId: text(item.id), field: "applicationId/eventId", severity: "error", message: "Project must have exactly one existing Register parent." });
    });
    registers.forEach(function (item) {
      if (object(item.location)) violations.push({ code: "REGISTER_LOCATION_OBJECT_PROHIBITED", collection: item.type === "event" ? "events" : "applications", entityId: text(item.id), field: "location", severity: "error", message: "Register location must not be a spatial object in schema v3; use locations[]." });
    });
    geometries.forEach(function (item) {
      var project = projectById[text(item.projectId)];
      if (!project) violations.push({ code: "GEOMETRY_PROJECT_MISSING", collection: "geometries", entityId: text(item.id), field: "projectId", severity: "error", message: "Work Geometry has no existing Project." });
      else if (project.owner !== item.owner) violations.push({ code: "GEOMETRY_PROJECT_OWNER_MISMATCH", collection: "geometries", entityId: text(item.id), field: "projectId", severity: "error", message: "Work Geometry ownership must match its Project." });
      var registerId = text(item.applicationId || item.eventId);
      var projectRegisterId = project && text(project.applicationId || project.eventId);
      if (registerId && projectRegisterId && registerId !== projectRegisterId) violations.push({ code: "GEOMETRY_REGISTER_PROJECT_MISMATCH", collection: "geometries", entityId: text(item.id), field: "eventId/applicationId", severity: "warning", message: "Geometry Register reference does not match its Project parent." });
      if (text(item.geometryKind).toLowerCase() === "location" || item.geometry && item.geometry.type === "Point") violations.push({ code: "LOCATION_GEOMETRY_PROHIBITED", collection: "geometries", entityId: text(item.id), field: "geometryKind", severity: "error", message: "Location geometry is prohibited in schema v3; use Register locations[]." });
    });
    return violations;
  }
  function validate(workspace) {
    var errors = [];
    if (!object(workspace) || workspace.app !== APP_ID || Number(workspace.schemaVersion) !== SCHEMA_VERSION) return ["Expected a " + APP_ID + " schemaVersion " + SCHEMA_VERSION + " workspace."];
  if (WORKSPACE_KIND && workspace.workspaceKind !== WORKSPACE_KIND) errors.push("workspaceKind must be " + WORKSPACE_KIND + ".");
  if (!Number.isInteger(Number(workspace.workspaceRevision)) || Number(workspace.workspaceRevision) < 0) errors.push("workspaceRevision must be a non-negative integer.");
  if (!object(workspace.entities)) return ["entities must be an object."];
    var ids = {};
    COLLECTIONS.forEach(function (collection) {
      if (!Array.isArray(workspace.entities[collection])) { errors.push("entities." + collection + " must be an array."); return; }
      workspace.entities[collection].forEach(function (item, index) {
        var label = "entities." + collection + "[" + index + "]";
        if (!object(item)) { errors.push(label + " must be an object."); return; }
        if (!text(item.id)) errors.push(label + " requires an id.");
        else if (ids[item.id]) errors.push('Duplicate entity id "' + item.id + '".');
        else ids[item.id] = { item: item, collection: collection };
        if (collection === "rateItems") {
          if (text(item.owner)) errors.push(label + " Rate items must not have an owner.");
        } else if (OWNERS.indexOf(item.owner) < 0) errors.push(label + " owner must be NSA or EVT.");
        if (item.type !== TYPES[collection]) errors.push(label + " has the wrong type.");
        var expectedPrefix = PREFIXES[TYPES[collection]];
        var matchesPrefix = text(item.id) && (
          (collection === "rateItems" && item.id.indexOf("RATE-") === 0) ||
          item.id.indexOf(item.owner + "-" + expectedPrefix + "-") === 0 ||
          (collection === "events" && (item.id.indexOf("event-") === 0 || item.id.indexOf(item.owner + "-") === 0)) ||
          (collection === "quoteLines" && item.id.indexOf(item.owner + "-QLINE-") === 0) ||
          (collection === "quotes" && (item.id.indexOf(item.owner + "-QUOTE-") === 0 || item.id.indexOf(item.owner + "-QLINE-") === 0))
        );
        if (text(item.id) && !matchesPrefix) errors.push(label + " id must use the " + item.owner + "-" + expectedPrefix + "- prefix.");
      });
    });
    if (ACTIVE_OWNER) {
      var forbiddenCollection = ACTIVE_OWNER === "NSA" ? "events" : "applications";
      if ((workspace.entities[forbiddenCollection] || []).length) errors.push("entities." + forbiddenCollection + " is not allowed in the " + WORKSPACE_KIND + " workspace.");
      var forbiddenReference = ACTIVE_OWNER === "NSA" ? "EVT" : "NSA";
      if (object(workspace.referenceData) && Object.prototype.hasOwnProperty.call(workspace.referenceData, forbiddenReference)) errors.push("referenceData." + forbiddenReference + " is not allowed in the " + WORKSPACE_KIND + " workspace.");
    }
    function reference(item, field, collections, requiredOwner) {
      var id = text(item[field]);
      if (!id) return;
      if (!ids[id]) errors.push(item.id + "." + field + ' references missing entity "' + id + '".');
      else {
        if (collections.indexOf(ids[id].collection) < 0) errors.push(item.id + "." + field + " references the wrong entity type.");
        if (requiredOwner && ids[id].item.owner !== item.owner) errors.push(item.id + "." + field + " cannot cross owners.");
      }
    }
    var catalogYears = {};
    (workspace.entities.catalogs || []).forEach(function (item) {
      if (!/^\d{4}-\d{2}$/.test(text(item.financialYear))) errors.push(item.id + " requires financialYear YYYY-YY.");
      var yearStart = Number(text(item.financialYear).slice(0, 4)), yearEnd = Number(text(item.financialYear).slice(5));
      if (Number.isFinite(yearStart) && yearEnd !== (yearStart + 1) % 100) errors.push(item.id + " has a non-consecutive financialYear.");
      var key = item.owner + ":" + item.financialYear;
      if (catalogYears[key]) errors.push(item.owner + " has multiple Catalogs for " + item.financialYear + ".");
      catalogYears[key] = item.id;
      reference(item, "clonedFromCatalogId", ["catalogs"], true);
    });
    (workspace.entities.rateItems || []).forEach(function (item) {
      reference(item, "catalogId", ["catalogs"], false);
      if (!text(item.kind)) errors.push(item.id + " kind is required.");
    });
    var activeProjectParents = {};
    (workspace.entities.projects || []).forEach(function (item) {
      var hasApplication = Boolean(text(item.applicationId));
      var hasEvent = Boolean(text(item.eventId));
      if (hasApplication === hasEvent) errors.push(item.id + " requires exactly one Register parent (applicationId or eventId).");
      reference(item, "applicationId", ["applications"], true);
      reference(item, "eventId", ["events"], true);
      reference(item, "catalogId", ["catalogs"], true);
      if (hasApplication && item.owner !== "NSA") errors.push(item.id + " applicationId requires NSA ownership.");
      if (hasEvent && item.owner !== "EVT") errors.push(item.id + " eventId requires EVT ownership.");
      var parentId = text(item.applicationId || item.eventId);
      var inactive = ["archived", "superseded"].indexOf(text(item.status).toLowerCase()) >= 0;
      if (parentId && !inactive) {
        if (activeProjectParents[parentId]) errors.push(parentId + " has multiple active Projects.");
        else activeProjectParents[parentId] = item.id;
      }
    });
    (workspace.entities.jobs || []).forEach(function (item) {
      reference(item, "applicationId", ["applications"], true); reference(item, "eventId", ["events"], true);
      reference(item, "projectId", ["projects"], true); reference(item, "parentJobId", ["jobs"], true);
      reference(item, "sourceGeometryId", ["geometries"], true);
      if (!text(item.projectId)) errors.push(item.id + " requires projectId.");
      if (["calculator", "space-map", "planner", "manual"].indexOf(text(item.sourceKind)) < 0) errors.push(item.id + " has an invalid sourceKind.");
      if (!validateDate(text(item.startDate)) || !validateDate(text(item.endDate))) errors.push(item.id + " has an invalid job date.");
      if (!validateTime(text(item.startTime)) || !validateTime(text(item.endTime))) errors.push(item.id + " has an invalid job time.");
      if (!item.allDay && (!item.startDate || !item.startTime || !item.endDate || !item.endTime)) errors.push(item.id + " timed jobs require start/end dates and times.");
      if (!item.allDay && item.startDate + "T" + item.startTime >= item.endDate + "T" + item.endTime) errors.push(item.id + " end must be after start.");
    });
    (workspace.entities.jobs || []).forEach(function (job) {
      var seen = {};
      var cursor = job;
      while (cursor && text(cursor.parentJobId)) {
        if (seen[cursor.id]) { errors.push(job.id + " parentJobId forms a cycle."); break; }
        seen[cursor.id] = true;
        cursor = ids[cursor.parentJobId] && ids[cursor.parentJobId].collection === "jobs" ? ids[cursor.parentJobId].item : null;
      }
    });
    (workspace.entities.tasks || []).forEach(function (item) {
      reference(item, "projectId", ["projects"], true); reference(item, "jobId", ["jobs"], true); reference(item, "schedulerJobId", ["jobs"], true);
      reference(item, "paymentAllocationId", ["paymentAllocations"], true);
      if (!text(item.projectId)) errors.push(item.id + " requires projectId.");
      var taskProject = text(item.projectId) && ids[item.projectId] && ids[item.projectId].collection === "projects" ? ids[item.projectId].item : null;
      if (taskProject && item.owner !== taskProject.owner) errors.push(item.id + " owner must match its Project owner.");
      if (text(item.jobId) && ids[item.jobId] && ids[item.jobId].item.projectId !== item.projectId) errors.push(item.id + " jobId must remain in its Project.");
      if (text(item.schedulerJobId) && ids[item.schedulerJobId] && ids[item.schedulerJobId].item.projectId !== item.projectId) errors.push(item.id + " schedulerJobId must remain in its Project.");
    });
    (workspace.entities.costingLines || []).forEach(function (item) {
      reference(item, "jobId", ["jobs"], true); reference(item, "projectId", ["projects"], true); reference(item, "eventId", ["events"], true);
      reference(item, "rateItemId", ["rateItems"], false); reference(item, "sourceGeometryId", ["geometries"], true);
      reference(item, "catalogId", ["catalogs"], false);
      if (!text(item.projectId)) errors.push(item.id + " requires projectId.");
      if (text(item.jobId) && ids[item.jobId] && text(item.projectId) && ids[item.jobId].item.projectId !== item.projectId) {
        errors.push(item.id + " projectId must match its Job projectId.");
      }
      if (Boolean(item.jobId) !== (item.assignmentState === "Assigned")) errors.push(item.id + " assignmentState must match jobId.");
    });
    (workspace.entities.geometries || []).forEach(function (item) {
      reference(item, "applicationId", ["applications"], true); reference(item, "eventId", ["events"], true); reference(item, "projectId", ["projects"], true);
      if (text(item.geometryKind).toLowerCase() === "location") errors.push(item.id + " location geometry is prohibited in schema v3.");
      if (!text(item.projectId)) errors.push(item.id + " requires projectId.");
    });
    var quoteAuditNumbers = {};
    (workspace.entities.quotes || []).forEach(function (item) {
      reference(item, "projectId", ["projects"], true);
      reference(item, "rootQuoteId", ["quotes"], true);
      reference(item, "previousQuoteId", ["quotes"], true);
      if (!text(item.projectId)) errors.push(item.id + " requires projectId.");
      if (!/^(?:NSA|EVT)-Q-\d{4}-\d{4}-R\d{2,}$/.test(text(item.auditNumber))) errors.push(item.id + " requires a valid auditNumber.");
      else if (quoteAuditNumbers[item.auditNumber]) errors.push(item.id + " duplicates Quote auditNumber " + item.auditNumber + ".");
      else quoteAuditNumbers[item.auditNumber] = item.id;
      if (!/^(?:NSA|EVT)-Q-\d{4}-\d{4}$/.test(text(item.auditRootNumber))) errors.push(item.id + " requires a valid auditRootNumber.");
      if (!text(item.rootQuoteId)) errors.push(item.id + " requires rootQuoteId.");
      if (text(item.rootQuoteId) && ids[item.rootQuoteId] && ids[item.rootQuoteId].item.projectId !== item.projectId) errors.push(item.id + " rootQuoteId must remain in its Project.");
      if (text(item.previousQuoteId) && ids[item.previousQuoteId] && ids[item.previousQuoteId].item.projectId !== item.projectId) errors.push(item.id + " previousQuoteId must remain in its Project.");
      if (text(item.previousQuoteId) && ids[item.previousQuoteId] && Number(ids[item.previousQuoteId].item.revision || 1) >= Number(item.revision || 1)) errors.push(item.id + " previousQuoteId must reference an earlier revision.");
    });
    (workspace.entities.quoteLines || []).forEach(function (item) {
      reference(item, "quoteId", ["quotes"], true); reference(item, "applicationId", ["applications"], true); reference(item, "eventId", ["events"], true);
      reference(item, "projectId", ["projects"], true); reference(item, "jobId", ["jobs"], true); reference(item, "costingLineId", ["costingLines"], true);
      reference(item, "rateItemId", ["rateItems"], false); reference(item, "sourceGeometryId", ["geometries"], true);
      if (!text(item.quoteId)) errors.push(item.id + " requires quoteId.");
      if (!text(item.projectId)) errors.push(item.id + " requires projectId.");
      if (text(item.quoteId) && ids[item.quoteId] && item.projectId !== ids[item.quoteId].item.projectId) errors.push(item.id + " projectId must match its Quote projectId.");
      if (text(item.quoteId) && ids[item.quoteId] && item.quoteAuditNumber !== ids[item.quoteId].item.auditNumber) errors.push(item.id + " quoteAuditNumber must match its Quote.");
      if (item.sourceKind === "costingLine") {
        if (!text(item.costingLineId)) errors.push(item.id + " inherited lines require costingLineId.");
        if (text(item.costingLineId) && ids[item.costingLineId] && item.jobId !== ids[item.costingLineId].item.jobId) errors.push(item.id + " jobId must match its Costing Line jobId.");
      }
    });
    (workspace.entities.payments || []).forEach(function (item) {
      reference(item, "quoteId", ["quotes"], true);
      reference(item, "projectId", ["projects"], true);
      if (!text(item.quoteId)) errors.push(item.id + " requires quoteId.");
      if (!text(item.projectId)) errors.push(item.id + " requires projectId.");
      if (text(item.quoteId) && ids[item.quoteId] && item.projectId !== ids[item.quoteId].item.projectId) errors.push(item.id + " projectId must match its Quote projectId.");
      if (text(item.quoteId) && ids[item.quoteId] && item.quoteAuditNumber !== ids[item.quoteId].item.auditNumber) errors.push(item.id + " quoteAuditNumber must match its Quote.");
      if (!(Number(item.amount) > 0)) errors.push(item.id + " amount must be greater than zero.");
      var paymentDate = text(item.paymentDate);
      var parsedPaymentDate = new Date(paymentDate + "T00:00:00Z");
      if (!validateDate(paymentDate) || Number.isNaN(parsedPaymentDate.getTime()) || parsedPaymentDate.toISOString().slice(0, 10) !== paymentDate) errors.push(item.id + " has an invalid payment date.");
      if (!text(item.reference)) errors.push(item.id + " requires a payment reference.");
      if (PAYMENT_METHODS.indexOf(text(item.method)) < 0) errors.push(item.id + " has an invalid payment method.");
      if (PAYMENT_STATUSES.indexOf(text(item.status)) < 0) errors.push(item.id + " has an invalid payment status.");
      if (item.status === "Reversed" && !text(item.reversedAt)) errors.push(item.id + " reversed payments require reversedAt.");
    });
    (workspace.entities.paymentAllocations || []).forEach(function (item) {
      reference(item, "projectId", ["projects"], true); reference(item, "quoteId", ["quotes"], true);
      reference(item, "quoteLineId", ["quoteLines"], true); reference(item, "paymentId", ["payments"], true);
      reference(item, "taskId", ["tasks"], true);
      if (!text(item.projectId) || !text(item.quoteId) || !text(item.quoteLineId)) errors.push(item.id + " requires projectId, quoteId, and quoteLineId.");
      if (!(Number(item.amount) > 0)) errors.push(item.id + " amount must be greater than zero.");
      if (["Active", "Reversed"].indexOf(item.status) < 0) errors.push(item.id + " has an invalid allocation status.");
      if (item.status === "Reversed" && !text(item.reversedAt)) errors.push(item.id + " reversed allocations require reversedAt.");
      if (ids[item.quoteLineId] && ids[item.quoteLineId].item.quoteId !== item.quoteId) errors.push(item.id + " quoteLineId must belong to its Quote.");
      var payment = ids[item.paymentId] && ids[item.paymentId].item;
      var task = ids[item.taskId] && ids[item.taskId].item;
      if (payment && (payment.quoteId !== item.quoteId || payment.projectId !== item.projectId)) errors.push(item.id + " paymentId must remain within its Quote and Project.");
      if (payment && payment.status === "Reversed" && item.status === "Active") errors.push(item.id + " cannot remain active after its Payment is reversed.");
      if (task && task.projectId !== item.projectId) errors.push(item.id + " taskId must remain within its Project.");
    });
    var allocationByPayment = {}, allocationByLine = {};
    (workspace.entities.paymentAllocations || []).forEach(function (item) {
      if (item.status !== "Active") return;
      if (text(item.paymentId)) allocationByPayment[item.paymentId] = amount((allocationByPayment[item.paymentId] || 0) + Number(item.amount || 0));
      if (text(item.quoteLineId)) allocationByLine[item.quoteLineId] = amount((allocationByLine[item.quoteLineId] || 0) + Number(item.amount || 0));
    });
    Object.keys(allocationByPayment).forEach(function (paymentId) {
      var payment = ids[paymentId] && ids[paymentId].item;
      if (payment && allocationByPayment[paymentId] > amount(payment.amount)) errors.push(paymentId + " active allocations exceed the Payment amount.");
    });
    Object.keys(allocationByLine).forEach(function (lineId) {
      var line = ids[lineId] && ids[lineId].item;
      if (line && allocationByLine[lineId] > amount(line.total)) errors.push(lineId + " active allocations exceed the Quote Line total.");
    });
    spatialInvariantViolations(workspace).forEach(function (violation) {
      if (violation.severity === "error" && errors.indexOf(violation.entityId + " " + violation.message) < 0) errors.push(violation.entityId + " " + violation.message);
    });
    if (UOS.ProgramBudget && typeof UOS.ProgramBudget.validationErrors === "function") {
      UOS.ProgramBudget.validationErrors(workspace).forEach(function (error) { errors.push(error); });
    }
    var workIdentities = {};
    workspace.entities.costingLines.forEach(function (line) {
      if (line.workCommandVersion !== 1) return;
      var key = line.owner + ":" + line.projectId + ":" + line.sourceIdentity;
      if (!text(line.sourceIdentity) || workIdentities[key]) errors.push(line.id + " requires a unique stable work identity.");
      workIdentities[key] = true;
      if (["calculator", "space-map"].indexOf(line.sourceKind) < 0) errors.push(line.id + " canonical costing commands cannot own Planner work.");
      if (line.sourceKind === "calculator" && (line.sourceGeometryId || !text(line.operationId) || line.sourceIdentity !== "operation:" + line.operationId)) errors.push(line.id + " requires its exact Calculator operation identity.");
      if (line.sourceKind === "space-map") {
        var geometryRef = ids[line.sourceGeometryId], geometry = geometryRef && geometryRef.collection === "geometries" && geometryRef.item;
        if (!geometry || geometry.owner !== line.owner || geometry.projectId !== line.projectId || geometry.workRemoved || line.sourceIdentity !== "geometry:" + geometry.id + ":" + (Number(geometry.workLineageRevision) || 0)) errors.push(line.id + " requires its exact active geometry lineage in the same Project and owner.");
      }
      var projectRef = ids[line.projectId];
      if (projectRef && projectRef.item.owner !== line.owner) errors.push(line.id + " owner must match its Project.");
      if (line.jobId) {
        var jobRef = ids[line.jobId], job = jobRef && jobRef.item;
        if (!job || job.workCommandVersion !== 1 || job.sourceCostingLineId !== line.id || job.sourceIdentity !== line.sourceIdentity || job.owner !== line.owner || job.projectId !== line.projectId || job.sourceKind !== line.sourceKind || text(job.sourceGeometryId) !== text(line.sourceGeometryId) || job.sourceEntityId !== (line.sourceGeometryId || line.id)) errors.push(line.id + " requires exact reciprocal work Job links.");
        if (line.jobCreationSuspended) errors.push(line.id + " cannot link a suspended Job.");
      }
    });
    workspace.entities.jobs.forEach(function (job) {
      if (job.workCommandVersion !== 1) return;
      var source = ids[job.sourceCostingLineId], line = source && source.collection === "costingLines" && source.item;
      if (!line || line.jobId !== job.id || line.workCommandVersion !== 1 || line.sourceIdentity !== job.sourceIdentity || line.owner !== job.owner || line.projectId !== job.projectId) errors.push(job.id + " requires exactly one reciprocal source Costing Line.");
      if (text(job.status).toLowerCase() === "draft" && (text(job.startDate) || text(job.endDate))) errors.push(job.id + " Draft work Jobs must be unscheduled.");
    });
    return errors;
  }
  function assertValid(workspace) {
    var errors = validate(workspace);
    if (errors.length) throw new Error("Invalid unified workspace:\n- " + errors.join("\n- "));
    if (UOS.ProductContracts && typeof UOS.ProductContracts.assertHard === "function") UOS.ProductContracts.assertHard(workspace);
    return workspace;
  }
  function finances(workspace, approvedBudget) {
    var checked = object(workspace) && workspace.app === APP_ID && Number(workspace.schemaVersion) === SCHEMA_VERSION && object(workspace.entities)
      ? workspace
      : normalize(workspace);
    var approved = (checked.entities.annualBudgets || []).reduce(function (sum, budget) {
      return sum + (UOS.ProgramBudget && typeof UOS.ProgramBudget.budgetBalance === "function"
        ? UOS.ProgramBudget.budgetBalance(checked, budget.id).approved : 0);
    }, 0);
    var linesByJob = {};
    checked.entities.costingLines.forEach(function (line) {
      if (!line.jobId) return;
      linesByJob[line.jobId] = (linesByJob[line.jobId] || 0) + Math.max(0, amount(line.estimatedTotal));
    });
    var committed = 0;
    var actual = 0;
    checked.entities.jobs.forEach(function (job) {
      var status = text(job.status).toLowerCase().replace(/[-_]+/g, " ");
      var estimate = Math.max(0, amount(job.estimate || linesByJob[job.id]));
      if (["draft", "scheduled", "in progress"].indexOf(status) >= 0) committed += estimate;
      if (status === "completed") actual += Math.max(0, amount(job.actualCost == null ? estimate : job.actualCost));
    });
    approved = amount(approved); committed = amount(committed); actual = amount(actual);
    return { approvedBudget: approved, committedBudget: committed, actualSpend: actual, spareFunds: amount(approved - committed - actual) };
  }
  function allocatedAmount(input, quoteLineId) {
    var workspace = normalize(input), wanted = text(quoteLineId);
    return amount((workspace.entities.paymentAllocations || []).reduce(function (sum, allocation) {
      return sum + (allocation.quoteLineId === wanted && allocation.status === "Active" ? Number(allocation.amount) || 0 : 0);
    }, 0));
  }
  function quoteLinePaid(input, quoteLineId) {
    var workspace = normalize(input), line = workspace.entities.quoteLines.find(function (item) { return item.id === text(quoteLineId); });
    if (!line) throw new Error('Quote Line "' + text(quoteLineId) + '" was not found.');
    return allocatedAmount(workspace, line.id) >= amount(line.total);
  }
  function allocatePayment(input, values, at) {
    var workspace = normalize(input), raw = object(values) ? values : {}, line = workspace.entities.quoteLines.find(function (item) { return item.id === text(raw.quoteLineId); });
    if (!line) throw new Error("A valid quoteLineId is required.");
    var quote = workspace.entities.quotes.find(function (item) { return item.id === line.quoteId; });
    var allocation = { id: text(raw.id) || stableId(line.owner, "paymentAllocation", [line.id, raw.paymentId, raw.taskId, at || timestamp()].join(":")), owner: line.owner, type: "paymentAllocation", projectId: line.projectId, quoteId: line.quoteId, quoteLineId: line.id, paymentId: text(raw.paymentId) || null, taskId: text(raw.taskId) || null, amount: amount(raw.amount), status: "Active", createdAt: timestamp(at), reversedAt: "", reversalReason: "", provenance: provenance(raw.provenance || { sourceApp: APP_ID, sourceVersion: SCHEMA_VERSION, sourceId: text(raw.id) }, line.owner) };
    if (!(allocation.amount > 0)) throw new Error("Allocation amount must be greater than zero.");
    if (!quote || quote.projectId !== line.projectId) throw new Error("Quote Line has no valid Quote lineage.");
    var payment = allocation.paymentId && workspace.entities.payments.find(function (item) { return item.id === allocation.paymentId; });
    var task = allocation.taskId && workspace.entities.tasks.find(function (item) { return item.id === allocation.taskId; });
    if (allocation.paymentId && (!payment || payment.quoteId !== quote.id || payment.projectId !== line.projectId || payment.owner !== line.owner)) throw new Error("Payment Allocation must remain within its Payment Quote and Project.");
    if (allocation.taskId && (!task || task.projectId !== line.projectId || task.owner !== line.owner)) throw new Error("Payment Allocation Task must remain within its Project.");
    var existingLineAmount = workspace.entities.paymentAllocations.reduce(function (sum, item) { return sum + (item.status === "Active" && item.quoteLineId === line.id ? Number(item.amount) || 0 : 0); }, 0);
    if (amount(existingLineAmount + allocation.amount) > amount(line.total)) throw new Error("Active allocations cannot exceed the Quote Line total.");
    if (payment) {
      var existingPaymentAmount = workspace.entities.paymentAllocations.reduce(function (sum, item) { return sum + (item.status === "Active" && item.paymentId === payment.id ? Number(item.amount) || 0 : 0); }, 0);
      if (amount(existingPaymentAmount + allocation.amount) > amount(payment.amount)) throw new Error("Active allocations cannot exceed the Payment amount.");
    }
    workspace.entities.paymentAllocations.push(allocation);
    workspace.updatedAt = timestamp(at);
    return { workspace: normalize(workspace), allocation: clone(allocation) };
  }
  function reversePaymentAllocation(input, allocationId, reason, at) {
    var workspace = normalize(input), allocation = workspace.entities.paymentAllocations.find(function (item) { return item.id === text(allocationId); });
    if (!allocation) throw new Error('Payment Allocation "' + text(allocationId) + '" was not found.');
    if (allocation.status === "Reversed") throw new Error("Payment Allocation is already reversed.");
    if (!text(reason)) throw new Error("A reversal reason is required.");
    allocation.status = "Reversed"; allocation.reversedAt = timestamp(at); allocation.reversalReason = text(reason);
    workspace.updatedAt = timestamp(at);
    return normalize(workspace);
  }
  function exportJson(workspace) { return JSON.stringify(normalize(workspace), null, 2); }
  function importJson(value) {
    var parsed;
    try { parsed = typeof value === "string" ? JSON.parse(value) : clone(value); }
    catch (error) { throw new Error("Unified workspace JSON is malformed."); }
    return normalize(parsed);
  }
  function migrateToV3(input) {
    var warnings = [], errors = [], migrations = [];
    var sourceVersion = Number(input && input.schemaVersion);
    try {
      var workspace = normalize(clone(input));
      if (sourceVersion !== SCHEMA_VERSION) migrations.push({ from: sourceVersion || null, to: SCHEMA_VERSION, kind: "canonical-schema" });
      warnings = clone(workspace.migration && workspace.migration.warnings || []);
      return { workspace: workspace, warnings: warnings, errors: errors, migrations: migrations };
    } catch (error) {
      errors.push(error && error.message ? error.message : String(error));
      return { workspace: null, warnings: warnings, errors: errors, migrations: migrations };
    }
  }

  var RECORD_COLLECTIONS = ["applications", "events"];
  var RECORD_EDITABLE_FIELDS = ["title", "category", "priority", "startDate", "endDate", "crewId"];
  function recordCollectionForType(type) {
    return type === "application" ? "applications" : type === "event" ? "events" : "";
  }
  function recordFallback(item, fields) {
    var payload = object(item.payload) ? item.payload : {};
    for (var index = 0; index < fields.length; index += 1) {
      var value = text(item[fields[index]]);
      if (value) return value;
      value = text(payload[fields[index]]);
      if (value) return value;
    }
    return "";
  }
  function recordSummary(item) {
    if (!object(item) || RECORD_COLLECTIONS.indexOf(recordCollectionForType(item.type)) < 0) return null;
    var startDate = recordFallback(item, ["startDate", "date", "dateReceived", "eventDate"]);
    return {
      id: text(item.id),
      owner: text(item.owner),
      type: text(item.type),
      title: recordFallback(item, ["title", "name", "address", "receipt"]) || (item.type === "application" ? "Untitled application" : "Untitled event"),
      status: recordFallback(item, ["status"]) || "Unspecified",
      category: recordFallback(item, ["category", "applicationType", "eventType"]) || (item.owner === "NSA" ? "Nature Strip" : "Remediation"),
      priority: recordFallback(item, ["priority"]) || "Unspecified",
      startDate: startDate,
      endDate: recordFallback(item, ["endDate", "completionDate", "targetEndDate"]) || startDate,
      crewId: recordFallback(item, ["crewId", "crew"]),
      ownershipLabel: item.owner === "NSA" ? "Nature Strip" : "Remediation"
    };
  }
  function findRecord(input, id) {
    var workspace = normalize(input);
    var wanted = text(id);
    if (!wanted) return null;
    for (var index = 0; index < RECORD_COLLECTIONS.length; index += 1) {
      var found = workspace.entities[RECORD_COLLECTIONS[index]].find(function (item) { return item.id === wanted; });
      if (found) return clone(found);
    }
    return null;
  }
  function resolveLegacyEntity(input, link) {
    if (!object(link)) return null;
    var workspace = normalize(input);
    var collection = recordCollectionForType(text(link.type));
    if (!collection && link.type === "project") collection = "projects";
    if (!collection && link.type === "job") collection = "jobs";
    if (!collection) return null;
    var legacyId = text(link.legacyId);
    var owner = text(link.owner);
    var found = workspace.entities[collection].find(function (item) {
      if (owner && item.owner !== owner) return false;
      var source = object(item.provenance) ? item.provenance : {};
      return item.id === legacyId || text(source.sourceId) === legacyId || text(source.legacyId) === legacyId;
    });
    return found ? found.id : null;
  }
  function updateRecord(input, id, changes, at) {
    if (!object(changes)) throw new Error("Record changes must be an object.");
    var output = normalize(input);
    var wanted = text(id);
    var match = null;
    RECORD_COLLECTIONS.some(function (collection) {
      match = output.entities[collection].find(function (item) { return item.id === wanted; }) || null;
      return Boolean(match);
    });
    if (!match) throw new Error('Application or event "' + wanted + '" was not found.');
    Object.keys(changes).forEach(function (field) {
      if (RECORD_EDITABLE_FIELDS.indexOf(field) < 0) throw new Error('Record field "' + field + '" is not editable.');
      match[field] = field === "crewId" ? text(changes[field]) || null : text(changes[field]);
    });
    output.updatedAt = timestamp(at);
    output = normalize(output);
    return { workspace: output, record: findRecord(output, wanted) };
  }

  function promoteRegisterRecord(input, registerId) {
    var targetId = text(registerId);
    if (!targetId) throw new Error("A registerId is required to promote a record.");
    var inputExisting = activeProjectForRegister(input, targetId);
    var workspace = normalize(input);

    var application = (workspace.entities.applications || []).find(function (item) { return item.id === targetId; });
    var event = application ? null : (workspace.entities.events || []).find(function (item) { return item.id === targetId; });
    var record = application || event;
    if (!record) throw new Error('Register record "' + targetId + '" not found.');

    var owner = application ? "NSA" : "EVT";
    var parentField = application ? "applicationId" : "eventId";
    var existing = inputExisting || activeProjectForRegister(workspace, targetId);
    if (existing) return { workspace: workspace, project: existing, created: false };

    var projectId = stableId(owner, "project", targetId);
    if ((workspace.entities.projects || []).some(function (item) { return item && item.id === projectId; })) {
      var idError = new Error('Delivery Project ID "' + projectId + '" is already used by another relationship.');
      idError.name = "ProjectIntegrityError";
      idError.code = "PROJECT_ID_CONFLICT";
      idError.registerId = targetId;
      idError.projectIds = [projectId];
      throw idError;
    }
    var project = {
      id: projectId,
      owner: owner,
      type: "project",
      title: text(record.title || record.eventName || record.name || record.address) || targetId,
      name: text(record.name || record.eventName || record.title || record.address) || targetId,
      status: "Draft",
      location: text(record.location || record.address),
      provenance: provenance({ sourceApp: APP_ID, sourceVersion: SCHEMA_VERSION, sourceId: targetId }, owner)
    };
    project[parentField] = targetId;
    workspace.entities.projects.push(project);
    record.projectId = project.id;
    workspace.updatedAt = timestamp();
    workspace = normalize(workspace);
    return {
      workspace: workspace,
      project: workspace.entities.projects.find(function (item) { return item.id === project.id; }),
      created: true
    };
  }

  function registerDeletionImpact(input, registerId) {
    var workspace = normalize(input);
    var targetId = text(registerId);
    var application = (workspace.entities.applications || []).find(function (item) { return item.id === targetId; });
    var event = application ? null : (workspace.entities.events || []).find(function (item) { return item.id === targetId; });
    if (!application && !event) throw new Error('Register record "' + targetId + '" not found.');
    var ids = { projects: {}, jobs: {}, tasks: {}, costingLines: {}, geometries: {}, quotes: {}, quoteLines: {}, payments: {}, paymentAllocations: {} };
    function mark(bucket, id) { if (text(id)) bucket[text(id)] = true; }
    function marked(bucket, id) { return Boolean(bucket[text(id)]); }

    (workspace.entities.projects || []).forEach(function (project) {
      if (project.applicationId === targetId || project.eventId === targetId || project.id === (application || event).projectId) mark(ids.projects, project.id);
    });
    var changed = true;
    while (changed) {
      changed = false;
      (workspace.entities.jobs || []).forEach(function (job) {
        if (marked(ids.jobs, job.id)) return;
        if (marked(ids.projects, job.projectId) || marked(ids.jobs, job.parentJobId) || job.applicationId === targetId || job.eventId === targetId || job.sourceEntityId === targetId) {
          mark(ids.jobs, job.id); changed = true;
        }
      });
    }
    (workspace.entities.tasks || []).forEach(function (task) { if (marked(ids.projects, task.projectId) || marked(ids.jobs, task.jobId)) mark(ids.tasks, task.id); });
    (workspace.entities.costingLines || []).forEach(function (line) {
      if (marked(ids.projects, line.projectId) || marked(ids.jobs, line.jobId) || line.applicationId === targetId || line.eventId === targetId) mark(ids.costingLines, line.id);
    });
    (workspace.entities.geometries || []).forEach(function (geometry) {
      if (marked(ids.projects, geometry.projectId) || marked(ids.jobs, geometry.jobId) || geometry.applicationId === targetId || geometry.eventId === targetId || geometry.sourceEntityId === targetId) mark(ids.geometries, geometry.id);
    });
    (workspace.entities.quotes || []).forEach(function (quote) {
      if (marked(ids.projects, quote.projectId) || quote.applicationId === targetId || quote.eventId === targetId) mark(ids.quotes, quote.id);
    });
    (workspace.entities.quoteLines || []).forEach(function (line) {
      if (marked(ids.quotes, line.quoteId) || marked(ids.projects, line.projectId) || marked(ids.jobs, line.jobId) || marked(ids.costingLines, line.costingLineId)) mark(ids.quoteLines, line.id);
    });
    (workspace.entities.payments || []).forEach(function (payment) { if (marked(ids.quotes, payment.quoteId)) mark(ids.payments, payment.id); });
    (workspace.entities.paymentAllocations || []).forEach(function (allocation) {
      if (marked(ids.quotes, allocation.quoteId) || marked(ids.quoteLines, allocation.quoteLineId) || marked(ids.payments, allocation.paymentId) || marked(ids.tasks, allocation.taskId)) mark(ids.paymentAllocations, allocation.id);
    });
    var counts = { registerRecords: 1 };
    Object.keys(ids).forEach(function (name) { counts[name] = Object.keys(ids[name]).length; });
    return { registerId: targetId, collection: application ? "applications" : "events", record: clone(application || event), ids: ids, counts: counts };
  }

  function deleteRegisterRecord(input, registerId) {
    var workspace = normalize(input);
    var impact = registerDeletionImpact(workspace, registerId);
    if ((workspace.entities.registerAllocations || []).some(function (item) { return item.registerId === impact.registerId; })) throw new Error("Register records with annual Budget allocation history cannot be deleted.");
    workspace.entities[impact.collection] = workspace.entities[impact.collection].filter(function (item) { return item.id !== impact.registerId; });
    ["projects", "jobs", "tasks", "costingLines", "geometries", "quotes", "quoteLines", "payments", "paymentAllocations"].forEach(function (name) {
      workspace.entities[name] = workspace.entities[name].filter(function (item) { return !impact.ids[name][item.id]; });
    });
    if (Array.isArray(workspace.entities.quoteEvents)) {
      workspace.entities.quoteEvents = workspace.entities.quoteEvents.filter(function (event) { return !impact.ids.quotes[event.quoteId]; });
    }
    (workspace.entities.applications || []).forEach(function (application) {
      if (impact.ids.projects && impact.ids.projects[text(application.projectId)]) delete application.projectId;
    });
    (workspace.entities.events || []).forEach(function (event) {
      if (impact.ids.projects && impact.ids.projects[text(event.projectId)]) delete event.projectId;
    });
    workspace.workspace = workspace.workspace || {};
    var removed = {};
    removed[impact.registerId] = true;
    Object.keys(impact.ids).forEach(function (name) { Object.keys(impact.ids[name]).forEach(function (id) { removed[id] = true; }); });
    ["selectedEntityId", "selectedProjectId", "selectedJobId", "selectedApplicationId", "selectedCostingId"].forEach(function (field) {
      if (removed[text(workspace.workspace[field])]) workspace.workspace[field] = "";
    });
    ["map", "costing", "planner", "scheduler"].forEach(function (mod) {
      if (workspace.workspace[mod] && typeof workspace.workspace[mod] === "object") {
        if (removed[text(workspace.workspace[mod].selectedProjectId)]) workspace.workspace[mod].selectedProjectId = "";
        if (removed[text(workspace.workspace[mod].jobId)]) workspace.workspace[mod].jobId = null;
        if (removed[text(workspace.workspace[mod].selectedId)]) workspace.workspace[mod].selectedId = "";
      }
    });
    workspace.updatedAt = timestamp();
    return { workspace: normalize(workspace), impact: impact };
  }

  function deleteJob(input, jobId, options) {
    options = options || {};
    var workspace = normalize(input);
    var id = text(jobId);
    var job = workspace.entities.jobs.find(function (item) { return item.id === id; });
    if (!job) throw new Error('Job "' + id + '" was not found.');
    if (job.workCommandVersion === 1) return UOS.ProgramCosting.deleteWorkJob(input, jobId, options);
    if ((workspace.entities.budgetCharges || []).some(function (item) { return item.jobId === id; })) throw new Error("Jobs with recorded Budget charges cannot be deleted.");
    var costingIds = {};
    workspace.entities.costingLines.forEach(function (line) { if (line.jobId === id) costingIds[line.id] = true; });
    if (job.actualCost != null || workspace.entities.costingLines.some(function (line) { return costingIds[line.id] && line.actualCost != null; })) throw new Error("Recorded actual financial history protects this work.");
    var immutableQuotes = {};
    (workspace.entities.quotes || []).forEach(function (q) {
      if (["Issued", "Accepted", "Declined", "Superseded"].indexOf(text(q.status)) >= 0) {
        immutableQuotes[q.id] = true;
      }
    });
    var immutableReference = workspace.entities.quoteLines.find(function (line) { return immutableQuotes[line.quoteId] && (line.jobId === id || costingIds[line.costingLineId]); });
    if (immutableReference) throw new Error("Jobs referenced by issued or resolved Quote history cannot be deleted.");
    var relatedQuoteIds = {};
    workspace.entities.quoteLines.forEach(function (line) { if (line.jobId === id || costingIds[line.costingLineId]) relatedQuoteIds[line.id] = true; });
    if (workspace.entities.paymentAllocations.some(function (allocation) { return relatedQuoteIds[allocation.quoteLineId]; })) throw new Error("Payment allocations protect this work.");
    workspace.entities.jobs = workspace.entities.jobs.filter(function (item) { return item.id !== id; });
    workspace.entities.tasks.forEach(function (item) { if (item.jobId === id || item.schedulerJobId === id) { item.jobId = null; item.schedulerJobId = null; } });
if (!options.deletePlannerTask && job.sourceKind === "planner") {
var retainedPlannerTask = workspace.entities.tasks.find(function (item) { return item.id === job.sourceEntityId; });
if (retainedPlannerTask) {
retainedPlannerTask.operational = true;
retainedPlannerTask.updatedAt = timestamp();
}
}
if (options.deletePlannerTask && job.sourceKind === "planner") {
      var task = workspace.entities.tasks.find(function (item) { return item.id === job.sourceEntityId; });
      if (task && task.templateKey) task.suppressed = true;
      else if (task) {
        workspace.entities.tasks = workspace.entities.tasks.filter(function (item) { return item.id !== task.id; });
        ["statusEvents", "statusRecommendations"].forEach(function (collection) {
          workspace.entities[collection] = (workspace.entities[collection] || []).filter(function (item) { return item.entityId !== task.id; });
        });
      }
    }
    workspace.entities.costingLines = workspace.entities.costingLines.filter(function (item) {
      if (!costingIds[item.id]) return true;
      if (options.deleteCostingLine) {
        var geometry = workspace.entities.geometries.find(function (geometry) { return geometry.id === item.sourceGeometryId; });
        if (geometry) geometry.workRemoved = true;
        return false;
      }
      item.jobId = null;
      item.jobCreationSuspended = true;
      item.assignmentState = "Unassigned";
      return true;
    });
    if (options.deleteCostingLine) ["statusEvents", "statusRecommendations"].forEach(function (collection) {
      workspace.entities[collection] = (workspace.entities[collection] || []).filter(function (item) { return !costingIds[item.entityId]; });
    });
    var removedQuoteLines = {};
    workspace.entities.quoteLines = workspace.entities.quoteLines.filter(function (item) {
      if (immutableQuotes[item.quoteId]) return true;
      var remove = options.deleteCostingLine && (item.jobId === id || costingIds[item.costingLineId]);
      if (!remove && item.jobId === id) item.jobId = null;
      if (remove) removedQuoteLines[item.id] = true;
      return !remove;
    });
    workspace.entities.paymentAllocations = workspace.entities.paymentAllocations.filter(function (item) { return !removedQuoteLines[item.quoteLineId]; });
    if (text(job.sourceGeometryId)) {
      var geometry = workspace.entities.geometries.find(function (item) { return item.id === job.sourceGeometryId; });
      if (geometry) geometry.syncState = { code: "job-required", message: "Use Create Job to send this polygon back to the Job Calculator." };
    }
    workspace.workspace = object(workspace.workspace) ? workspace.workspace : {};
    if (workspace.workspace.selectedEntityId === id) workspace.workspace.selectedEntityId = "";
    if (workspace.workspace.selectedJobId === id) workspace.workspace.selectedJobId = "";
    if (object(workspace.workspace.costing) && workspace.workspace.costing.jobId === id) workspace.workspace.costing.jobId = null;
    if (object(workspace.workspace.scheduler) && workspace.workspace.scheduler.selectedId === id) {
      workspace.workspace.scheduler.selectedId = "";
      workspace.workspace.scheduler.detail = false;
      workspace.workspace.scheduler.inspectorMode = "list";
    }
    workspace.updatedAt = timestamp();
    return normalize(workspace);
  }

  function repairNatureProjectScope(input) {
    var workspace = normalize(input);
    if (ACTIVE_OWNER && ACTIVE_OWNER !== "NSA") return { workspace: workspace, changed: false, removed: {} };
    workspace.migration = object(workspace.migration) ? workspace.migration : {};
    workspace.migration.repairs = object(workspace.migration.repairs) ? workspace.migration.repairs : {};
    if (workspace.migration.repairs.nsaAuthoritativeProjectsV1) return { workspace: workspace, changed: false, removed: {} };
    var sourceIds = [
      "project-grenfell",
      "project-97981ee3-5753-44bb-ac59-5d3cfb9ad29f",
      "project-ecbc70bd-79fc-43ee-927a-7ad0dd03f36e"
    ];
    var canonicalIds = {};
    sourceIds.forEach(function (sourceId) { canonicalIds[stableId("NSA", "project", sourceId)] = true; });
    var applicationIds = {};
    (workspace.entities.applications || []).forEach(function (application) {
      applicationIds[text(application && application.id)] = true;
    });
    function authoritative(project) {
      var provenanceSource = project && project.provenance && text(project.provenance.sourceId);
      return project && project.owner === "NSA" && (
        sourceIds.indexOf(provenanceSource) >= 0 ||
        canonicalIds[project.id] ||
        applicationIds[text(project.applicationId)]
      );
    }
    var removed = { projects: {}, jobs: {}, tasks: {}, costingLines: {}, geometries: {}, quotes: {}, quoteLines: {}, payments: {} };
    (workspace.entities.projects || []).forEach(function (project) {
      if (project.owner === "NSA" && !authoritative(project)) removed.projects[project.id] = true;
    });
    var changed = true;
    while (changed) {
      changed = false;
      (workspace.entities.jobs || []).forEach(function (job) {
        if (!removed.jobs[job.id] && (removed.projects[job.projectId] || removed.jobs[job.parentJobId])) { removed.jobs[job.id] = true; changed = true; }
      });
    }
    (workspace.entities.tasks || []).forEach(function (task) {
      if (removed.projects[task.projectId] || removed.jobs[task.jobId]) removed.tasks[task.id] = true;
    });
    (workspace.entities.costingLines || []).forEach(function (line) { if (removed.projects[line.projectId] || removed.jobs[line.jobId]) removed.costingLines[line.id] = true; });
    (workspace.entities.geometries || []).forEach(function (geometry) { if (removed.projects[geometry.projectId] || removed.jobs[geometry.jobId]) removed.geometries[geometry.id] = true; });
    (workspace.entities.quotes || []).forEach(function (quote) { if (removed.projects[quote.projectId]) removed.quotes[quote.id] = true; });
    (workspace.entities.quoteLines || []).forEach(function (line) {
      if (removed.quotes[line.quoteId] || removed.projects[line.projectId] || removed.jobs[line.jobId] || removed.costingLines[line.costingLineId]) removed.quoteLines[line.id] = true;
    });
    (workspace.entities.payments || []).forEach(function (payment) { if (removed.quotes[payment.quoteId]) removed.payments[payment.id] = true; });
    Object.keys(removed).forEach(function (name) { workspace.entities[name] = workspace.entities[name].filter(function (item) { return !removed[name][item.id]; }); });
    if (Array.isArray(workspace.entities.quoteEvents)) {
      workspace.entities.quoteEvents = workspace.entities.quoteEvents.filter(function (event) { return !removed.quotes[event.quoteId]; });
    }
    (workspace.entities.applications || []).forEach(function (application) { if (removed.projects[text(application.projectId)]) delete application.projectId; });
    (workspace.entities.events || []).forEach(function (event) { if (removed.projects[text(event.projectId)]) delete event.projectId; });
    workspace.workspace = object(workspace.workspace) ? workspace.workspace : {};
    var allRemoved = {};
    Object.keys(removed).forEach(function (name) { Object.keys(removed[name]).forEach(function (id) { allRemoved[id] = true; }); });
    ["selectedEntityId", "selectedProjectId", "selectedJobId", "selectedCostingId"].forEach(function (field) { if (allRemoved[text(workspace.workspace[field])]) workspace.workspace[field] = ""; });
    ["map", "costing", "planner", "scheduler"].forEach(function (mod) {
      if (workspace.workspace[mod] && typeof workspace.workspace[mod] === "object") {
        if (allRemoved[text(workspace.workspace[mod].selectedProjectId)]) workspace.workspace[mod].selectedProjectId = "";
        if (allRemoved[text(workspace.workspace[mod].jobId)]) workspace.workspace[mod].jobId = null;
        if (allRemoved[text(workspace.workspace[mod].selectedId)]) workspace.workspace[mod].selectedId = "";
      }
    });
    var counts = {};
    Object.keys(removed).forEach(function (name) { counts[name] = Object.keys(removed[name]).length; });
    workspace.migration.repairs.nsaAuthoritativeProjectsV1 = { appliedAt: timestamp(), removed: counts };
    workspace.updatedAt = timestamp();
    return { workspace: normalize(workspace), changed: true, removed: counts };
  }

  function repairLegacyGeometryDuplicates(input) {
    var workspace = normalize(input);
    workspace.migration = object(workspace.migration) ? workspace.migration : {};
    workspace.migration.repairs = object(workspace.migration.repairs) ? workspace.migration.repairs : {};
    if (workspace.migration.repairs.legacyGeometryIdentityDeduplicationV1) return { workspace: workspace, changed: false, removed: {} };

    var canonicalBySource = {};
    (workspace.entities.geometries || []).forEach(function (geometry) {
      var sourceId = geometry && geometry.provenance && text(geometry.provenance.sourceId);
      if (geometry && geometry.projectId && sourceId) canonicalBySource[geometry.projectId + ":" + sourceId] = geometry.id;
    });
    var duplicateGeometryIds = {};
    (workspace.entities.geometries || []).forEach(function (geometry) {
      if (!geometry || !geometry.projectId) return;
      var prefix = geometry.owner + "-GEO-";
      var sourceId = geometry.id.indexOf(prefix) === 0 ? geometry.id.slice(prefix.length) : "";
      var canonicalId = canonicalBySource[geometry.projectId + ":" + sourceId];
      if (sourceId && canonicalId && canonicalId !== geometry.id) duplicateGeometryIds[geometry.id] = true;
    });
    if (!Object.keys(duplicateGeometryIds).length) return { workspace: workspace, changed: false, removed: {} };

    var affectedProjects = {};
    (workspace.entities.geometries || []).forEach(function (geometry) { if (duplicateGeometryIds[geometry.id]) affectedProjects[geometry.projectId] = true; });
    var projectsById = {};
    (workspace.entities.projects || []).forEach(function (project) { projectsById[project.id] = project; });
    var removedJobIds = {};
    (workspace.entities.jobs || []).forEach(function (job) {
      if (!job || !affectedProjects[job.projectId]) return;
      var project = projectsById[job.projectId];
      var generatedPlaceholder = !text(job.sourceGeometryId) && job.provenance && job.provenance.sourceApp === APP_ID &&
        new RegExp("^" + text(project.name || project.title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " - Job \\d+$", "i").test(text(job.name || job.title));
      if (duplicateGeometryIds[text(job.sourceGeometryId)] || generatedPlaceholder) removedJobIds[job.id] = true;
    });
    var removedCostingIds = {};
    (workspace.entities.costingLines || []).forEach(function (line) {
      if (line && (duplicateGeometryIds[text(line.sourceGeometryId)] || removedJobIds[text(line.jobId)])) removedCostingIds[line.id] = true;
    });
    var removedQuoteLineIds = {};
    (workspace.entities.quoteLines || []).forEach(function (line) {
      if (line && (duplicateGeometryIds[text(line.sourceGeometryId)] || removedJobIds[text(line.jobId)] || removedCostingIds[text(line.costingLineId)])) removedQuoteLineIds[line.id] = true;
    });

    workspace.entities.geometries = workspace.entities.geometries.filter(function (item) { return !duplicateGeometryIds[item.id]; });
    workspace.entities.jobs = workspace.entities.jobs.filter(function (item) { return !removedJobIds[item.id]; });
    workspace.entities.tasks = workspace.entities.tasks.filter(function (item) { return !removedJobIds[text(item.jobId)]; });
    workspace.entities.costingLines = workspace.entities.costingLines.filter(function (item) { return !removedCostingIds[item.id]; });
    workspace.entities.quoteLines = workspace.entities.quoteLines.filter(function (item) { return !removedQuoteLineIds[item.id]; });
    var removed = {
      geometries: Object.keys(duplicateGeometryIds).length,
      jobs: Object.keys(removedJobIds).length,
      costingLines: Object.keys(removedCostingIds).length,
      quoteLines: Object.keys(removedQuoteLineIds).length
    };
    workspace.migration.repairs.legacyGeometryIdentityDeduplicationV1 = {
      appliedAt: timestamp(), projectIds: Object.keys(affectedProjects),
      removed: clone(removed)
    };
    workspace.updatedAt = timestamp();
    return { workspace: normalize(workspace), changed: true, removed: removed };
  }

  function repairGeneratedPlaceholderJobs(input) {
    var workspace = normalize(input);
    workspace.migration = object(workspace.migration) ? workspace.migration : {};
    workspace.migration.repairs = object(workspace.migration.repairs) ? workspace.migration.repairs : {};
    if (workspace.migration.repairs.generatedPlaceholderJobsV2) return { workspace: workspace, changed: false, removed: {} };
    var projectsById = {};
    (workspace.entities.projects || []).forEach(function (project) { projectsById[project.id] = project; });
    var projectsWithMappedJobs = {};
    (workspace.entities.jobs || []).forEach(function (job) { if (text(job.sourceGeometryId)) projectsWithMappedJobs[job.projectId] = true; });
    var removedJobIds = {};
    (workspace.entities.jobs || []).forEach(function (job) {
      var project = job && projectsById[job.projectId];
      if (!project || !projectsWithMappedJobs[job.projectId] || text(job.sourceGeometryId)) return;
      var projectTitle = text(project.name || project.title);
      var generatedName = new RegExp("^" + projectTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " - Job \\d+$", "i");
      if (generatedName.test(text(job.name || job.title))) removedJobIds[job.id] = true;
    });
    var removedCostingIds = {};
    (workspace.entities.costingLines || []).forEach(function (line) { if (removedJobIds[text(line.jobId)]) removedCostingIds[line.id] = true; });
    var removedQuoteLineIds = {};
    (workspace.entities.quoteLines || []).forEach(function (line) {
      if (removedJobIds[text(line.jobId)] || removedCostingIds[text(line.costingLineId)]) removedQuoteLineIds[line.id] = true;
    });
    workspace.entities.jobs = workspace.entities.jobs.filter(function (item) { return !removedJobIds[item.id]; });
    workspace.entities.tasks = workspace.entities.tasks.filter(function (item) { return !removedJobIds[text(item.jobId)]; });
    workspace.entities.costingLines = workspace.entities.costingLines.filter(function (item) { return !removedCostingIds[item.id]; });
    workspace.entities.quoteLines = workspace.entities.quoteLines.filter(function (item) { return !removedQuoteLineIds[item.id]; });
    var removed = { jobs: Object.keys(removedJobIds).length, costingLines: Object.keys(removedCostingIds).length, quoteLines: Object.keys(removedQuoteLineIds).length };
    workspace.migration.repairs.generatedPlaceholderJobsV2 = { appliedAt: timestamp(), removed: clone(removed) };
    if (removed.jobs) workspace.updatedAt = timestamp();
    return { workspace: normalize(workspace), changed: true, removed: removed };
  }

  function getRegisterEntities(workspace, ownerOrDomain) {
    if (!object(workspace) || !object(workspace.entities)) return [];
    var isEvt = ownerOrDomain === "EVT" || ownerOrDomain === "events" || ownerOrDomain === "remediation";
    var list = isEvt ? workspace.entities.events : workspace.entities.applications;
    return Array.isArray(list) ? list : [];
  }

  function getProjects(workspace, ownerOrDomain) {
    if (!object(workspace) || !object(workspace.entities)) return [];
    var owner = (ownerOrDomain === "EVT" || ownerOrDomain === "events" || ownerOrDomain === "remediation") ? "EVT" : "NSA";
    var projects = Array.isArray(workspace.entities.projects) ? workspace.entities.projects : [];
    return projects.filter(function (p) {
      if (!p) return false;
      var pOwner = p.owner || (p.id && text(p.id).indexOf("EVT") === 0 ? "EVT" : (p.id && text(p.id).indexOf("NSA") === 0 ? "NSA" : ""));
      return pOwner === owner;
    });
  }

  
  function registerForProject(workspace, projectOrId) {
    if (!object(workspace) || !object(workspace.entities)) return null;
    var project = typeof projectOrId === "object" ? projectOrId : (workspace.entities.projects || []).find(function (p) { return p.id === projectOrId; });
    if (!project) return null;
    var targetId = project.applicationId || project.eventId;
    if (!targetId) return null;
    return (workspace.entities.events || []).find(function (e) { return e.id === targetId; }) ||
           (workspace.entities.applications || []).find(function (a) { return a.id === targetId; }) || null;
  }

  function activeProjectsForRegister(workspace, registerOrId) {
    if (!object(workspace) || !object(workspace.entities)) return [];
    var regId = text(typeof registerOrId === "object" ? registerOrId.id : registerOrId);
    if (!regId) return [];
    return (workspace.entities.projects || []).filter(function (project) {
      return project && text(project.status).toLowerCase() !== "archived" &&
        (text(project.applicationId) === regId || text(project.eventId) === regId);
    }).slice().sort(function (left, right) {
      return text(left.id).localeCompare(text(right.id));
    }).map(clone);
  }

  function duplicateActiveProjectError(registerId, projects) {
    var projectIds = projects.map(function (project) { return text(project.id); }).sort();
    var error = new Error('Register record "' + registerId + '" has multiple active Delivery Projects: ' + projectIds.join(", ") + ".");
    error.name = "ProjectIntegrityError";
    error.code = "PROJECT_DUPLICATE_ACTIVE_FOR_REGISTER";
    error.registerId = registerId;
    error.projectIds = projectIds;
    return error;
  }

  function activeProjectForRegister(workspace, registerOrId) {
    var regId = text(typeof registerOrId === "object" ? registerOrId.id : registerOrId);
    var projects = activeProjectsForRegister(workspace, regId);
    if (projects.length > 1) throw duplicateActiveProjectError(regId, projects);
    return projects[0] || null;
  }

  function projectForRegister(workspace, registerOrId) {
    return activeProjectForRegister(workspace, registerOrId);
  }

  function registerLocations(workspace, registerOrId) {
    if (!object(workspace) || !object(workspace.entities)) return [];
    var registerId = text(typeof registerOrId === "object" ? registerOrId.id : registerOrId);
    var reg = (workspace.entities.events || []).concat(workspace.entities.applications || []).find(function (item) { return text(item && item.id) === registerId; });
    if (!reg) return [];
    return (Array.isArray(reg.locations) ? reg.locations : []).filter(function (loc) {
      return loc && text(loc.id) && coordinateValid(loc.coordinate);
    }).slice().sort(function (left, right) { return text(left.id).localeCompare(text(right.id)); }).map(clone);
  }

  function projectWorkGeometry(workspace, projectId) {
    if (!object(workspace) || !object(workspace.entities) || !projectId) return [];
    var project = (workspace.entities.projects || []).find(function (item) { return item && text(item.id) === text(projectId); });
    if (!project) return [];
    return (workspace.entities.geometries || []).filter(function (g) {
      var kind = text(g && g.geometryKind).toLowerCase();
      return g && text(g.projectId) === text(projectId) && g.owner === project.owner && (kind === "polygon" || kind === "line");
    }).slice().sort(function (left, right) { return text(left.id).localeCompare(text(right.id)); }).map(clone);
  }

  function workGeometryById(workspace, geometryId) {
    if (!object(workspace) || !object(workspace.entities)) return null;
    var geometry = (workspace.entities.geometries || []).find(function (item) { return item && text(item.id) === text(geometryId); });
    if (!geometry) return null;
    var matches = projectWorkGeometry(workspace, geometry.projectId);
    return matches.find(function (item) { return item.id === geometry.id; }) || null;
  }

  function displayAddressForProject(workspace, projectOrId) {
    if (!object(workspace)) return "";
    var reg = registerForProject(workspace, projectOrId);
    if (reg) {
      if (text(reg.address)) return text(reg.address);
      if (typeof reg.location === "string" && text(reg.location)) return text(reg.location);
      if (reg.locations && reg.locations.length && text(reg.locations[0].address)) return text(reg.locations[0].address);
      if (text(reg.eventName || reg.title || reg.name)) return text(reg.eventName || reg.title || reg.name);
    }
    var project = typeof projectOrId === "object" ? projectOrId : ((workspace.entities && workspace.entities.projects) ? workspace.entities.projects.find(function (p) { return p.id === projectOrId; }) : null);
    if (project) {
      if (typeof project.location === "string" && text(project.location)) return text(project.location);
      if (text(project.title || project.name)) return text(project.title || project.name);
    }
    return "";
  }

  function spatialContextForProject(workspace, projectId) {
    var workGeom = projectWorkGeometry(workspace, projectId);
    var reg = registerForProject(workspace, projectId);
    var pins = reg ? registerLocations(workspace, reg.id) : [];
    return {
      projectId: projectId,
      registerId: reg ? reg.id : null,
      register: reg,
      workGeometry: workGeom,
      locations: pins,
      displayAddress: displayAddressForProject(workspace, projectId)
    };
  }

  function addLocationToRegister(input, registerId, location) {
    var inputEntities = object(input && input.entities) ? input.entities : {};
    var rawRegisters = (Array.isArray(inputEntities.events) ? inputEntities.events : []).concat(Array.isArray(inputEntities.applications) ? inputEntities.applications : []);
    var rawTarget = rawRegisters.find(function (item) { return text(item && item.id) === text(registerId); });
    if (!rawTarget) throw spatialError("LOCATION_REGISTER_NOT_FOUND", 'Register record "' + registerId + '" was not found.', { registerId: text(registerId) });
    if (!object(location) || !coordinateValid(location.coordinate)) throw spatialError("LOCATION_COORDINATE_INVALID", "Location Pin requires finite longitude/latitude coordinates within range.", { registerId: text(registerId) });
    var locId = text(location.id) || (rawTarget.owner + "-LOC-" + hash(rawTarget.owner + ":location:" + text(registerId) + ":" + Number(location.coordinate[0]) + ":" + Number(location.coordinate[1])));
    var duplicateOwner = rawRegisters.find(function (register) { return (Array.isArray(register.locations) ? register.locations : []).some(function (pin) { return text(pin && pin.id) === locId; }); });
    if (duplicateOwner) throw spatialError("LOCATION_ID_CONFLICT", 'Location Pin "' + locId + '" already exists.', { registerId: text(registerId), locationId: locId, existingRegisterId: text(duplicateOwner.id) });
    var workspace = normalize(input);
    var target = (workspace.entities.events || []).concat(workspace.entities.applications || []).find(function (item) { return text(item.id) === text(registerId); });
    target.locations = Array.isArray(target.locations) ? target.locations : [];
    var newPin = {
      id: locId,
      coordinate: [Number(location.coordinate[0]), Number(location.coordinate[1])],
      name: text(location.name || target.eventName || target.title || target.name || "Mapped Location"),
      address: text(location.address || target.address || "Mapped Location"),
      visible: location.visible !== false
    };
    target.locations.push(newPin);
    workspace.updatedAt = timestamp();
    return normalize(workspace);
  }

  function updateLocationInRegister(input, registerId, locationId, patch) {
    patch = object(patch) ? patch : {};
    var entities = object(input && input.entities) ? input.entities : {};
    var registers = (Array.isArray(entities.events) ? entities.events : []).concat(Array.isArray(entities.applications) ? entities.applications : []);
    var rawTarget = registers.find(function (item) { return text(item && item.id) === text(registerId); });
    if (!rawTarget) throw spatialError("LOCATION_REGISTER_NOT_FOUND", 'Register record "' + registerId + '" was not found.', { registerId: text(registerId) });
    var rawPin = (Array.isArray(rawTarget.locations) ? rawTarget.locations : []).find(function (pin) { return text(pin && pin.id) === text(locationId); });
    if (!rawPin) {
      var other = registers.find(function (register) { return text(register.id) !== text(registerId) && (Array.isArray(register.locations) ? register.locations : []).some(function (pin) { return text(pin && pin.id) === text(locationId); }); });
      throw spatialError(other ? "LOCATION_OWNER_MISMATCH" : "LOCATION_NOT_FOUND", 'Location Pin "' + locationId + '" was not found on Register "' + registerId + '".', { registerId: text(registerId), locationId: text(locationId), existingRegisterId: other ? text(other.id) : null });
    }
    if (patch && patch.coordinate !== undefined && !coordinateValid(patch.coordinate)) throw spatialError("LOCATION_COORDINATE_INVALID", "Location Pin requires finite longitude/latitude coordinates within range.", { registerId: text(registerId), locationId: text(locationId) });
    var workspace = normalize(input);
    var target = (workspace.entities.events || []).concat(workspace.entities.applications || []).find(function (item) { return text(item.id) === text(registerId); });
    var pin = (target.locations || []).find(function (l) { return text(l.id) === text(locationId); });
    if (patch.coordinate && Array.isArray(patch.coordinate)) pin.coordinate = [Number(patch.coordinate[0]), Number(patch.coordinate[1])];
    if (patch.name !== undefined) pin.name = text(patch.name);
    if (patch.address !== undefined) pin.address = text(patch.address);
    if (patch.visible !== undefined) pin.visible = Boolean(patch.visible);
    workspace.updatedAt = timestamp();
    return normalize(workspace);
  }

  function removeLocationFromRegister(input, registerId, locationId) {
    var entities = object(input && input.entities) ? input.entities : {};
    var registers = (Array.isArray(entities.events) ? entities.events : []).concat(Array.isArray(entities.applications) ? entities.applications : []);
    var rawTarget = registers.find(function (item) { return text(item && item.id) === text(registerId); });
    if (!rawTarget) throw spatialError("LOCATION_REGISTER_NOT_FOUND", 'Register record "' + registerId + '" was not found.', { registerId: text(registerId) });
    if (!(Array.isArray(rawTarget.locations) ? rawTarget.locations : []).some(function (pin) { return text(pin && pin.id) === text(locationId); })) {
      var other = registers.find(function (register) { return text(register.id) !== text(registerId) && (Array.isArray(register.locations) ? register.locations : []).some(function (pin) { return text(pin && pin.id) === text(locationId); }); });
      throw spatialError(other ? "LOCATION_OWNER_MISMATCH" : "LOCATION_NOT_FOUND", 'Location Pin "' + locationId + '" was not found on Register "' + registerId + '".', { registerId: text(registerId), locationId: text(locationId), existingRegisterId: other ? text(other.id) : null });
    }
    var workspace = normalize(input);
    var target = (workspace.entities.events || []).concat(workspace.entities.applications || []).find(function (item) { return text(item.id) === text(registerId); });
    target.locations = (target.locations || []).filter(function (l) { return text(l.id) !== text(locationId); });
    workspace.updatedAt = timestamp();
    return normalize(workspace);
  }

  function addWorkGeometry(input, projectId, geomData) {
    var workspace = normalize(input);
    var project = (workspace.entities.projects || []).find(function (p) { return p.id === projectId; });
    if (!project) throw new Error('Delivery Project "' + projectId + '" was not found.');
    var geomId = geomData.id || ((project.owner === "NSA" ? "NSA-GEO-" : "EVT-GEO-") + Date.now().toString(36) + Math.random().toString(36).substr(2, 4));
    var isLine = geomData.geometryType === "line" || (geomData.geometry && (geomData.geometry.type === "LineString" || geomData.geometry.type === "MultiLineString"));
    var newGeom = {
      id: geomId,
      owner: project.owner,
      type: "geometry",
      projectId: project.id,
      geometryKind: isLine ? "line" : "polygon",
      geometry: clone(geomData.geometry),
      payload: clone(geomData.payload || {
        id: geomId,
        type: isLine ? "line" : "polygon",
        visible: true,
        valid: true,
        areaSqM: geomData.areaSqM || 0,
        lengthM: geomData.lengthM || 0
      }),
      provenance: provenance(geomData.provenance || { sourceApp: APP_ID, sourceVersion: SCHEMA_VERSION, sourceId: geomId }, project.owner)
    };
    workspace.entities.geometries.push(newGeom);
    workspace.updatedAt = timestamp();
    return normalize(workspace);
  }

  function canonicalizeWorkLineageV4(input) {
    var workspace = clone(input);
    workspace.entities = object(workspace.entities) ? workspace.entities : {};
    ["geometries", "jobs", "costingLines"].forEach(function (name) { workspace.entities[name] = Array.isArray(workspace.entities[name]) ? workspace.entities[name] : []; });
    workspace.migration = object(workspace.migration) ? workspace.migration : {};
    var previous = Array.isArray(workspace.migration.unresolvedWorkLineage) ? workspace.migration.unresolvedWorkLineage.map(clone) : [], unresolvedByKey = {};
    previous.forEach(function (entry) { if (entry && entry.key) unresolvedByKey[entry.key] = entry; });
    function preserve(collection, source, reason) {
      var id = text(source && source.id), key = collection + ":" + id;
      if (!unresolvedByKey[key]) unresolvedByKey[key] = { key: key, sourceCollection: collection, sourceId: id, reason: reason, source: clone(source) };
    }
    var geometries = {};
    workspace.entities.geometries.forEach(function (geometry) { if (text(geometry && geometry.id)) geometries[text(geometry.id)] = geometry; });
    var legacyGroups = {};
    workspace.entities.jobs.forEach(function (job) {
      var legacyId = text(job && (job.geometryId || job.sourceGeometryId));
      if (legacyId) (legacyGroups[legacyId] = legacyGroups[legacyId] || []).push(job);
    });
    var acceptedJobs = {}, nextJobs = [];
    workspace.entities.jobs.forEach(function (job) {
      var legacyId = text(job && (job.geometryId || job.sourceGeometryId));
      if (!legacyId) {
        var fuzzy = Object.keys(geometries).find(function (id) { return text(job && job.title).indexOf(id) >= 0; });
        if (fuzzy) preserve("jobs", job, "fuzzy-only Geometry association is not canonical"); else nextJobs.push(job);
        return;
      }
      var geometry = geometries[legacyId], group = legacyGroups[legacyId] || [];
      if (!geometry) { preserve("jobs", job, "referenced Work Geometry is missing"); return; }
      if (group.length !== 1) { preserve("jobs", job, "multiple Jobs claim the same Work Geometry"); return; }
      if (job.owner !== geometry.owner || job.projectId !== geometry.projectId) { preserve("jobs", job, "Job owner or Project conflicts with Work Geometry"); return; }
      var canonical = clone(job);
      canonical.sourceKind = "space-map"; canonical.sourceEntityId = legacyId; canonical.sourceGeometryId = legacyId;
      delete canonical.geometryId;
      acceptedJobs[canonical.id] = canonical;
      nextJobs.push(canonical);
    });
    var nextLines = [];
    workspace.entities.costingLines.forEach(function (line) {
      var legacyId = text(line && (line.sourceGeometryId || line.sourcePolygonId || line.geometryId));
      if (!legacyId) { nextLines.push(line); return; }
      var geometry = geometries[legacyId], job = acceptedJobs[text(line.jobId)];
      if (!geometry) { preserve("costingLines", line, "referenced Work Geometry is missing"); return; }
      if (!job || job.sourceGeometryId !== legacyId) { preserve("costingLines", line, "CostingLine does not have one exact canonical map Job"); return; }
      if (line.owner !== geometry.owner || line.projectId !== geometry.projectId) { preserve("costingLines", line, "CostingLine owner or Project conflicts with Work Geometry"); return; }
      var canonical = clone(line);
      canonical.sourceGeometryId = legacyId;
      delete canonical.sourcePolygonId; delete canonical.geometryId;
      nextLines.push(canonical);
    });
    workspace.entities.jobs = nextJobs;
    workspace.entities.costingLines = nextLines;
    var unresolved = Object.keys(unresolvedByKey).sort().map(function (key) { return unresolvedByKey[key]; });
    if (unresolved.length) workspace.migration.unresolvedWorkLineage = unresolved; else delete workspace.migration.unresolvedWorkLineage;
    return { workspace: workspace, unresolved: unresolved };
  }

  function getQuotes(workspace, ownerOrDomain) {
    if (!object(workspace) || !object(workspace.entities)) return [];
    var owner = (ownerOrDomain === "EVT" || ownerOrDomain === "events" || ownerOrDomain === "remediation") ? "EVT" : "NSA";
    var list = Array.isArray(workspace.entities.quotes) ? workspace.entities.quotes : [];
    return list.filter(function (q) { return q && q.owner === owner; });
  }

  function getQuoteLines(workspace, quoteId) {
    if (!object(workspace) || !object(workspace.entities)) return [];
    var list = Array.isArray(workspace.entities.quoteLines) ? workspace.entities.quoteLines : [];
    if (!quoteId) return list;
    return list.filter(function (ql) { return ql && (ql.quoteId === quoteId || ql.id === quoteId); });
  }

  UOS.ProgramModel = UOS.programModel = {
    appId: APP_ID, workspaceKind: WORKSPACE_KIND, owner: ACTIVE_OWNER, schemaVersion: SCHEMA_VERSION, collections: COLLECTIONS.slice(), blank: blank,
    classifyRateKind: classifyRateKind,
canonicalWorkTypeRateItems: CANONICAL_WORK_TYPE_RATE_ITEMS,
supportedPolygonWorkTypes: SUPPORTED_POLYGON_WORK_TYPES,
 normalizeWorkTypeRateMappingEntry: normalizeWorkTypeRateMappingEntry,
 workTypeRateMapping: workTypeRateMapping,
 isSpatiallyCompatibleRate: isSpatiallyCompatibleRate,
 spatialQuantityForRate: spatialQuantityForRate,
 eligibleSpatialRatesForWorkType: eligibleSpatialRatesForWorkType,
    checklistTemplates: checklistTemplates,
    stableId: stableId, normalize: normalize, isNormalized: isNormalized, validate: validate, assertValid: assertValid, fromV1: fromV1,
    finances: finances, exportJson: exportJson, importJson: importJson,
    recordSummary: recordSummary, findRecord: findRecord, resolveLegacyEntity: resolveLegacyEntity,
    updateRecord: updateRecord, recordEditableFields: RECORD_EDITABLE_FIELDS.slice(),
    getRegisterEntities: getRegisterEntities, getProjects: getProjects, promoteRegisterRecord: promoteRegisterRecord,
    registerDeletionImpact: registerDeletionImpact, deleteRegisterRecord: deleteRegisterRecord, deleteJob: deleteJob,
    repairNatureProjectScope: repairNatureProjectScope, repairLegacyGeometryDuplicates: repairLegacyGeometryDuplicates, repairGeneratedPlaceholderJobs: repairGeneratedPlaceholderJobs,
    getQuotes: getQuotes, getQuoteLines: getQuoteLines,
    registerForProject: registerForProject,
    activeProjectsForRegister: activeProjectsForRegister, activeProjectForRegister: activeProjectForRegister,
    projectForRegister: projectForRegister,
    registerLocations: registerLocations, projectWorkGeometry: projectWorkGeometry, workGeometriesForProject: projectWorkGeometry,
    workGeometryById: workGeometryById,
    displayAddressForProject: displayAddressForProject, spatialContextForProject: spatialContextForProject,
    addLocationToRegister: addLocationToRegister, addRegisterLocation: addLocationToRegister,
    updateLocationInRegister: updateLocationInRegister, updateRegisterLocation: updateLocationInRegister,
    removeLocationFromRegister: removeLocationFromRegister, removeRegisterLocation: removeLocationFromRegister, addWorkGeometry: addWorkGeometry,
    coordinateValid: coordinateValid, canonicalizeSpatialV3: canonicalizeSpatialV3, canonicalizeWorkLineageV4: canonicalizeWorkLineageV4, canonicalizeLegacyGlobalRates: canonicalizeLegacyGlobalRates, canonicalizeLegacyQuoteLifecycle: canonicalizeLegacyQuoteLifecycle, fromV2: fromV2, fromV3: migrateV3ToV4, migrateToV3: migrateToV3,
    financialYearForReceivedDate: financialYearForReceivedDate, allocatedAmount: allocatedAmount, quoteLinePaid: quoteLinePaid,
    allocatePayment: allocatePayment, reversePaymentAllocation: reversePaymentAllocation,
    spatialInvariantViolations: spatialInvariantViolations
  };
}());
