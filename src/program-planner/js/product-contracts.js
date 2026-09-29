(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var CONTRACT_SET_VERSION = "1.5.0";

  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function list(workspace, name) {
    return object(workspace && workspace.entities) && Array.isArray(workspace.entities[name]) ? workspace.entities[name] : [];
  }
  function frozen(value) {
    if (!value || typeof value !== "object") return value;
    Object.keys(value).forEach(function (key) { frozen(value[key]); });
    return Object.freeze(value);
  }

  var CONTRACTS = frozen([
    {
      id: "PC-001",
      key: "REGISTER_ROOT",
      title: "Register is the business root",
      version: 1,
      criticality: "critical",
      state: "enforced",
      promise: "Every delivery chain begins with exactly one Nature Strip Application or Event Register record.",
      invariants: [
        "NSA and Event records remain in their own workspace.",
        "A delivery record must remain traceable to its originating Register matter."
      ],
      enforcement: ["ProgramModel.validate", "ProgramDataHealth"]
    },
    {
      id: "PC-002",
      key: "PROJECT_PARENTAGE",
      title: "One active Delivery Project per Register matter",
      version: 1,
      criticality: "critical",
      state: "enforced",
      promise: "A Delivery Project belongs to exactly one Application or Event, and a Register matter has at most one active Delivery Project.",
      invariants: [
        "A Project has exactly one existing Register parent.",
        "Project and parent use the same NSA/EVT owner.",
        "A Register matter has zero or one active Project, never multiple active Projects."
      ],
      enforcement: ["ProgramModel.validate", "ProductContracts.validateHard", "ProgramDataHealth"]
    },
    {
      id: "PC-003",
      key: "PLANNER_TASK_CANON",
      title: "Planner Tasks are canonical Project records",
      version: 1,
      criticality: "critical",
      state: "enforced",
      promise: "Planner edits update the canonical Project Task and never a second editable checklist copy.",
      invariants: [
        "Every Task belongs to exactly one existing Project.",
        "Task owner matches Project owner.",
        "workspace.projectChecklists is not an active business-data store.",
        "A Planner-created Job remains linked to exactly one source Task."
      ],
      enforcement: ["PlannerModel", "ProductContracts.validateHard", "ProgramDataHealth"]
    },
    {
      id: "PC-004",
      key: "SPATIAL_OWNERSHIP",
      title: "Register Locations and Project Work Geometry are different objects",
      version: 1,
      criticality: "high",
      state: "enforced",
      promise: "Register pins describe where the originating matter is; polygons and lines describe where Project work may occur.",
      invariants: [
        "Location pins belong to Applications or Events.",
        "Work Geometry belongs to a Delivery Project.",
        "A Project does not own Register Location pins.",
        "A Point/Location is not stored as Project Work Geometry."
      ],
      enforcement: ["ProgramModel.spatialInvariantViolations", "ProductContracts.validateHard", "ProgramDataHealth"]
    },
    {
      id: "PC-005",
      key: "GEOMETRY_JOB_PROMOTION",
      title: "Work Geometry becomes a Job only by explicit promotion",
      version: 1,
      criticality: "critical",
      state: "enforced",
      promise: "A polygon or line may exist as planning-only Project geometry. It enters the Job and Costing system only when the user deliberately creates/promotes the Job.",
      invariants: [
        "Planning-only geometry may have zero mapped Jobs and zero mapped Costing Lines.",
        "Drawing, importing or editing geometry does not by itself create a Job.",
        "Once promoted, one Work Geometry has exactly one canonical space-map Job and exactly one mapped Costing Line.",
        "A promoted geometry may never have only half of that lineage.",
        "Subsequent geometry changes update the existing mapped lineage rather than creating a duplicate Job."
      ],
      enforcement: ["WorkAreaService.syncGeometry", "WorkAreaService.canonicalLineage", "ProductContracts.validateHard", "ProgramDataHealth"]
    },
    {
      id: "PC-006",
      key: "JOB_PARENTAGE",
      title: "Jobs are Project-owned delivery records",
      version: 1,
      criticality: "critical",
      state: "enforced",
      promise: "Every Job belongs to one Delivery Project and carries enough source lineage to explain where it came from.",
      invariants: [
        "Every Job references an existing Project of the same owner.",
        "Planner, Calculator and Space Map Jobs retain canonical sourceKind/sourceEntityId lineage.",
        "Scheduler schedules canonical Jobs; it does not maintain a second Job database."
      ],
      enforcement: ["ProgramModel.validate", "SchedulerModel", "PlannerModel", "WorkAreaService", "ProductContracts.validateHard", "ProgramDataHealth"]
    },
    {
      id: "PC-007",
      key: "COST_SNAPSHOT",
      title: "Costing Lines are explainable snapshots",
      version: 1,
      criticality: "high",
      state: "enforced",
      promise: "A Costing Line belongs to a Job and preserves the rate and description used for that estimate until an explicit refresh/change occurs.",
      invariants: [
        "Every Costing Line belongs to one Job and the same Project.",
        "Costing values do not silently track later catalogue changes.",
        "Mapped costing remains linked to its promoted Work Geometry."
      ],
      enforcement: ["ProgramCosting", "ProgramModel.validate", "ProgramDataHealth"]
    },
    {
      id: "PC-008",
      key: "QUOTE_REVISION",
      title: "Issued Quotes are immutable commercial snapshots",
      version: 1,
      criticality: "critical",
      state: "enforced",
      promise: "Draft Quotes can change; issued or resolved commercial history is preserved and later change occurs through a new revision.",
      invariants: [
        "Issued/resolved Quote content has a verifiable commercial snapshot.",
        "A replacement revision preserves and supersedes its predecessor rather than rewriting it.",
        "Quote lineage stays inside one Delivery Project."
      ],
      enforcement: ["QuoteModel", "ProgramDataHealth"]
    },
    {
      id: "PC-009",
      key: "PAYMENT_TRACEABILITY",
      title: "Payments remain attached to an exact Quote revision",
      version: 1,
      criticality: "critical",
      state: "enforced",
      promise: "Money received remains traceable to the exact Quote revision and Project, and reversal preserves history instead of erasing it.",
      invariants: [
        "Every Payment references an existing Quote and the same Project.",
        "Payment allocations remain within that Quote/Project lineage.",
        "Reversed payments retain reversal evidence."
      ],
      enforcement: ["QuoteModel", "ProgramModel.validate", "ProgramDataHealth"]
    },
    {
      id: "PC-010",
      key: "DEPENDENCY_PROTECTION",
      title: "Destructive actions preserve a possible business story",
      version: 1,
      criticality: "critical",
      state: "enforced",
      promise: "Records with downstream operational or commercial dependencies cannot be casually removed and leave impossible history behind.",
      invariants: [
        "Register deletion exposes and removes its complete dependency chain only after confirmation.",
        "Mapped work with scheduling, Planner or Quote dependencies is protected.",
        "Jobs referenced by issued/resolved Quote history cannot be deleted."
      ],
      enforcement: ["ProgramModel.deleteRegisterRecord", "ProgramModel.deleteJob", "WorkAreaService.removeGeometryWork"]
    },
    {
      id: "PC-011",
      key: "WORKSPACE_RECOVERY",
      title: "Save, export and import preserve the complete business graph",
      version: 1,
      criticality: "critical",
      state: "enforced",
      promise: "A workspace round-trip preserves canonical records and relationships rather than reconstructing module-specific copies.",
      invariants: [
        "Workspace import is validated before commit.",
        "Export/import preserves IDs and parent/source relationships.",
        "Ambiguous migration data is preserved for review rather than guessed."
      ],
      enforcement: ["ProgramStorage", "ProgramData", "ProgramMigration", "ProgramModel.assertValid"]
    },
    {
      id: "PC-012",
      key: "DOMAIN_LIFECYCLES",
      title: "Each business object owns one governed lifecycle",
      version: 1,
      criticality: "critical",
    state: "enforced",
      promise: "Register, Project, Task, Job, Quote and payment/receivable states each have one authoritative vocabulary and explicitly defined cross-object consequences.",
      invariants: [
        "Do not create one universal status list for unrelated business objects.",
        "Current state and milestone history must not tell contradictory stories.",
        "Cross-object status automation must represent concrete facts rather than inferred business judgement."
      ],
    enforcement: ["ProgramStatus", "ProgramModel.assertValid", "ProgramApp.executeStatusCommand", "ProgramStorage"],
    note: "Enforced by schema-v5 domain registries, guarded mutations, canonical audit events, recommendations and revision-aware persistence."
 },
 {
      id: "PC-013",
      key: "QUOTE_READINESS",
      title: "Quote issuance is governed by evidence",
      version: 1,
      criticality: "critical",
      state: "pending-proof",
      promise: "Draft Quote creation remains permissive; issuing requires canonical scope, cost-basis and funding evidence.",
      invariants: ["Module visitation is not Quote Readiness evidence.", "The readiness result and evidence basis are snapshotted at Issue."],
      enforcement: ["ProgramQuotes", "ProgramDataHealth", "Release Gate C"]
    },
    {
      id: "PC-014",
      key: "SIDEBAR_SURFACE_CONTRACT",
      title: "Retired sidebar mechanics are absent",
      version: 1,
      criticality: "critical",
      state: "enforced",
      promise: "Operational sidebars use sanctioned surfaces only; compact, floating and undocked sidebar states cannot be activated.",
      invariants: ["No loaded production source can create compact, floating or undocked sidebar state.", "No persisted preference can restore a retired sidebar mode.", "Normal full-size Planner, Costing and Quote Builder sidebars remain available."],
      enforcement: ["sidebar-architecture.spec.js", "Release Gate I"]
    },
    {
      id: "PC-015",
      key: "LOCATION_POLYGON_SIDEBAR",
      title: "Location and Polygon sidebars remain full-size",
      version: 1,
      criticality: "critical",
      state: "enforced",
      promise: "Location Register view always shows one full-size Location Card; Project view always shows one full-size Polygon Summary Card and Inspector entry path.",
      invariants: ["An empty Register Location state retains its Add pin entry surface.", "An empty Project polygon state retains its Polygon Inspector entry surface.", "Location, Polygon Summary and Polygon Inspector surfaces do not use compact-card disclosure modes."],
      enforcement: ["location-active-register.spec.js", "location-polygon-sidebar.spec.js", "Release Gate J"]
    },
    {
      id: "PC-016",
      key: "SCHEDULER_INTERACTION_SCOPE",
      title: "Scheduler separates global visibility from active-project editing",
      version: 1,
      criticality: "critical",
      state: "pending-proof",
      promise: "A non-active Project Job may be inspected without entering the active Project Scheduler Editor or changing business context.",
      invariants: ["Active-Project Job activation opens Scheduler Editor.", "Other-Project calendar Job activation opens read-only summary only.", "Summary inspection never mutates active Register or Project."],
      enforcement: ["SchedulerUI.routeCalendarJob", "scheduler-routing.spec.js", "Release Gate K"]
    },
    {
      id: "PC-017",
      key: "SCHEDULER_ACTIVE_PROJECT_SIGNAL",
      title: "Scheduler derives active-project calendar signal",
      version: 1,
      criticality: "high",
      state: "pending-proof",
      promise: "Calendar days with Draft or Scheduled Jobs owned by the active Project are visibly and canonically derived.",
      invariants: ["The signal is derived from Job ownership and status.", "Other-Project Jobs alone do not signal active work.", "No calendar-local shadow state persists."],
      enforcement: ["SchedulerUI.renderCalendar", "scheduler-calendar-signal.spec.js", "Release Gate L"]
    },
    {
      id: "PC-018",
      key: "DRAWER_VIEWPORT_FLOOR",
      title: "Expanded drawers retain visible viewport floor",
      version: 1,
      criticality: "critical",
      state: "pending-proof",
      promise: "Expanded drawer content is bounded beneath its row header, internally scrollable, and retains a visible bottom floor.",
      invariants: ["Drawer floor remains visible within usable viewport.", "Overflow belongs to the drawer content region."],
      enforcement: ["DrawerWorkspace.viewport", "drawer-viewport.spec.js", "Release Gate M"]
    },
    {
      id: "PC-019",
      key: "REGISTER_DRAWER_GROWTH",
      title: "Register drawers grow until the usable viewport boundary",
      version: 1,
      criticality: "critical",
      state: "pending-proof",
      promise: "Register drawers retain intrinsic height until their visible floor reaches the viewport boundary, then scroll internally.",
      invariants: ["Short records do not fill empty viewport.", "Long content remains reachable above a visible floor."],
      enforcement: ["DrawerWorkspace.viewport", "drawer-viewport.spec.js", "Release Gate N"]
    },
    { id: "PC-020", key: "PLANNER_TASK_MANAGEMENT", title: "Planner Task and Job lineage", version: 1, criticality: "critical", state: "pending-proof", promise: "Operational Planner Tasks create one canonical Draft Job before scheduling.", invariants: ["Inert Tasks have no delivery Job.", "Scheduling reuses the Planner Job."], enforcement: ["ProgramPlannerModel", "planner-draft-job.test.cjs", "Release Gate P"] },
    { id: "PC-021", key: "FINANCIAL_YEAR_CANON", title: "Financial year authority", version: 1, criticality: "critical", state: "pending-proof", promise: "Annual budgets are partitioned by owner and July–June financial year.", invariants: ["Years are consecutive YYYY-YY values.", "Owners never share a budget."], enforcement: ["ProgramBudget", "budget-model.test.cjs", "Release Gate O"] },
    { id: "PC-022", key: "ANNUAL_BUDGET_AUTHORITY", title: "Annual budget approval", version: 1, criticality: "critical", state: "pending-proof", promise: "One budget per owner and year has recorded approval and auditable changes.", invariants: ["Approved base is immutable.", "Adjustments are signed."], enforcement: ["ProgramBudget", "budget-model.test.cjs", "Release Gate O"] },
    { id: "PC-023", key: "BUDGET_ALLOCATION_LINEAGE", title: "Register allocation lineage", version: 1, criticality: "critical", state: "pending-proof", promise: "Register allocations retain their budget, owner, and year without requiring a Project.", invariants: ["Allocated totals cannot exceed approved funds.", "Projects project Register allocations."], enforcement: ["ProgramBudget", "budget-model.test.cjs", "Release Gate O"] },
    { id: "PC-024", key: "BUDGET_ADJUSTMENT_IMMUTABILITY", title: "Immutable budget history", version: 1, criticality: "critical", state: "pending-proof", promise: "Financial adjustments and charges are append-only with recorded actor and reason.", invariants: ["Past entries cannot be edited or deleted."], enforcement: ["ProgramBudget.assertTransition", "budget-model.test.cjs", "Release Gate O"] },
    { id: "PC-025", key: "FINANCIAL_PERIOD_CLOSURE", title: "Closed financial years", version: 1, criticality: "critical", state: "pending-proof", promise: "Closed years freeze writes and carry-forward requires review of verified unused funds.", invariants: ["Reopen is recorded.", "Carry-forward cannot exceed source balance."], enforcement: ["ProgramBudget", "budget-model.test.cjs", "Release Gate O"] },
    { id: "PC-026", key: "JOB_ORIGIN_LINEAGE", title: "Three canonical Job origins", version: 1, criticality: "critical", state: "pending-proof", promise: "Calculator, Space Map, and Planner create traceable Jobs.", invariants: ["Planner and Map Jobs retain their source identities."], enforcement: ["ProgramPlannerModel", "ProgramCosting", "Release Gate P"] },
    { id: "PC-027", key: "OPERATIONAL_TASK_PROMOTION", title: "Operational Planner Tasks", version: 1, criticality: "critical", state: "pending-proof", promise: "Explicit operational classification permits a Draft Planner Job.", invariants: ["Custom checklist Tasks stay inert until classified.", "Promotion is idempotent."], enforcement: ["ProgramPlannerModel", "planner-draft-job.test.cjs", "Release Gate P"] },
    { id: "PC-028", key: "COSTING_AND_QUOTE_LINEAGE", title: "Deliberate costing and Quote inclusion", version: 1, criticality: "critical", state: "pending-proof", promise: "Planner Jobs are costed and quoted through explicit canonical actions.", invariants: ["Draft Job creation does not silently create costing or Quote Lines.", "Issued Quote snapshots stay immutable."], enforcement: ["ProgramCosting", "ProgramQuotes", "Release Gate Q"] }
  ]);

  var ISSUE_CONTRACTS = frozen({
    ENTITY_INVALID: "PC-001", ID_DUPLICATE: "PC-001",
    PROJECT_PARENT_INVALID: "PC-002", PROJECT_DUPLICATE_ACTIVE_FOR_REGISTER: "PC-002",
    PLANNER_TASK_PROJECT_MISSING: "PC-003", PLANNER_TASK_OWNER_MISMATCH: "PC-003", PLANNER_JOB_TASK_MISSING: "PC-003",
    PLANNER_JOB_TASK_MISMATCH: "PC-003", PLANNER_JOB_DUPLICATE_LINEAGE: "PC-003", PLANNER_TASK_JOB_MISSING: "PC-003",
    PLANNER_TASK_JOB_MISMATCH: "PC-003", PLANNER_TASK_JOB_SOURCE_MISMATCH: "PC-003", PLANNER_SHADOW_STATE_ACTIVE: "PC-003",
    PLANNER_SHADOW_RECONCILIATION_UNRESOLVED: "PC-003",
    PROJECT_PIN_PROHIBITED: "PC-004", REGISTER_LOCATION_OBJECT_PROHIBITED: "PC-004", LOCATION_GEOMETRY_PROHIBITED: "PC-004",
    GEOMETRY_PROJECT_MISSING: "PC-004", GEOMETRY_PROJECT_OWNER_MISMATCH: "PC-004", GEOMETRY_REGISTER_PROJECT_MISMATCH: "PC-004",
    LOCATION_PIN_INVALID: "PC-004", LOCATION_PIN_ID_MISSING: "PC-004", LOCATION_PIN_ID_DUPLICATE: "PC-004", LOCATION_PIN_COORDINATE_INVALID: "PC-004",
    WORK_GEOMETRY_ID_DUPLICATE: "PC-005", WORK_GEOMETRY_KIND_INVALID: "PC-005", WORK_GEOMETRY_MEASUREMENT_MISMATCH: "PC-005",
    WORK_GEOMETRY_COORDINATES_INVALID: "PC-005", WORK_LINEAGE_JOB_MISSING: "PC-005", WORK_LINEAGE_JOB_DUPLICATE: "PC-005",
    WORK_LINEAGE_COSTING_MISSING: "PC-005", WORK_LINEAGE_COSTING_DUPLICATE: "PC-005", WORK_LINEAGE_JOB_PROJECT_MISMATCH: "PC-005",
    WORK_LINEAGE_COSTING_PROJECT_MISMATCH: "PC-005", WORK_LINEAGE_INCOMPLETE: "PC-005", WORK_LINEAGE_INCONSISTENT: "PC-005",
    JOB_PROJECT_MISSING: "PC-006", SCHEDULER_SOURCE_MISSING: "PC-006", SCHEDULER_SOURCE_DUPLICATE: "PC-006",
    COSTING_JOB_MISSING: "PC-007", COSTING_PROJECT_MISMATCH: "PC-007",
    QUOTE_PROJECT_MISSING: "PC-008", QUOTE_SNAPSHOT_INCOMPLETE: "PC-008", QUOTE_TRANSITION_INVALID: "PC-008",
    QUOTE_SUPERSESSION_CHAIN_BROKEN: "PC-008", QUOTE_SUPERSESSION_RECIPROCAL_MISSING: "PC-008", QUOTE_SUPERSESSION_DUPLICATE_REPLACEMENT: "PC-008",
    QUOTE_LINE_QUOTE_MISSING: "PC-008", QUOTE_LINE_AUDIT_MISMATCH: "PC-008", QUOTE_LINE_COST_MISSING: "PC-008", QUOTE_LINE_LINEAGE_MISMATCH: "PC-008", QUOTE_LINE_DUPLICATE: "PC-008",
    PAYMENT_QUOTE_MISSING: "PC-009", PAYMENT_AUDIT_MISMATCH: "PC-009", PAYMENT_AMOUNT_INVALID: "PC-009", PAYMENT_DATE_INVALID: "PC-009",
    PAYMENT_METHOD_INVALID: "PC-009", PAYMENT_STATUS_INVALID: "PC-009", PAYMENT_REVERSAL_DATE_MISSING: "PC-009", PAYMENT_REVERSAL_REASON_MISSING: "PC-009",
    MIGRATION_LINK_UNRESOLVED: "PC-011", FUNDING_MIGRATION_UNRESOLVED: "PC-011", QUOTE_MIGRATION_UNRESOLVED: "PC-011", SPATIAL_MIGRATION_UNRESOLVED: "PC-011"
  });

  function byId(id) {
    return CONTRACTS.find(function (item) { return item.id === id; }) || null;
  }

  function contractForIssueCode(code) {
    return byId(ISSUE_CONTRACTS[text(code)] || "");
  }

  function violation(contractId, code, collection, entityId, field, relatedIds, message) {
    return {
      contractId: contractId,
      code: code,
      severity: "error",
      collection: collection || "",
      entityId: text(entityId),
      field: field || "",
      relatedIds: (relatedIds || []).map(text).filter(Boolean).sort(),
      message: message
    };
  }

  function validateHard(workspace) {
    var violations = [];
    if (!object(workspace) || !object(workspace.entities)) return violations;

    var applications = list(workspace, "applications"), events = list(workspace, "events"), projects = list(workspace, "projects");
    var tasks = list(workspace, "tasks"), jobs = list(workspace, "jobs"), geometries = list(workspace, "geometries"), lines = list(workspace, "costingLines");
    var ids = {};
    [applications, events, projects, tasks, jobs, geometries, lines].forEach(function (values) {
      values.forEach(function (item) { if (text(item && item.id)) ids[text(item.id)] = item; });
    });

    var activeByRegister = {};
    projects.forEach(function (project) {
      var applicationId = text(project.applicationId), eventId = text(project.eventId);
      var parents = [applicationId, eventId].filter(Boolean);
      if (parents.length !== 1 || !ids[parents[0]]) {
        violations.push(violation("PC-002", "CONTRACT_PROJECT_PARENTAGE", "projects", project.id, "applicationId/eventId", parents, "Delivery Project must have exactly one existing Register parent."));
        return;
      }
      if (ids[parents[0]].owner !== project.owner) {
        violations.push(violation("PC-002", "CONTRACT_PROJECT_OWNER", "projects", project.id, "owner", parents, "Delivery Project owner must match its Register parent."));
      }
      if (["archived", "superseded"].indexOf(text(project.status).toLowerCase()) < 0) {
        activeByRegister[parents[0]] = activeByRegister[parents[0]] || [];
        activeByRegister[parents[0]].push(project.id);
      }
    });
    Object.keys(activeByRegister).sort().forEach(function (registerId) {
      if (activeByRegister[registerId].length > 1) violations.push(violation("PC-002", "CONTRACT_MULTIPLE_ACTIVE_PROJECTS", "projects", activeByRegister[registerId][0], "applicationId/eventId", activeByRegister[registerId], "Register matter has multiple active Delivery Projects."));
    });

    if (object(workspace.workspace && workspace.workspace.projectChecklists) && Object.keys(workspace.workspace.projectChecklists).length) {
      violations.push(violation("PC-003", "CONTRACT_PLANNER_SHADOW_STATE", "tasks", "workspace.projectChecklists", "workspace.projectChecklists", [], "Planner business data must exist only on canonical Task records."));
    }
    tasks.forEach(function (task) {
      var project = ids[text(task.projectId)];
      if (!project || project.type !== "project") violations.push(violation("PC-003", "CONTRACT_TASK_PROJECT", "tasks", task.id, "projectId", [task.projectId], "Planner Task must belong to one existing Delivery Project."));
      else if (project.owner !== task.owner) violations.push(violation("PC-003", "CONTRACT_TASK_OWNER", "tasks", task.id, "owner", [project.id], "Planner Task owner must match its Delivery Project."));
    });
    var plannerJobs = {};
    jobs.forEach(function (job) {
      if (text(job.sourceKind) !== "planner") return;
      var taskId = text(job.sourceEntityId);
      if (!taskId) violations.push(violation("PC-003", "CONTRACT_PLANNER_JOB_SOURCE", "jobs", job.id, "sourceEntityId", [], "Planner Job requires one canonical source Task."));
      else {
        plannerJobs[taskId] = plannerJobs[taskId] || [];
        plannerJobs[taskId].push(job.id);
        var task = ids[taskId];
        if (!task || task.type !== "task" || task.projectId !== job.projectId || task.owner !== job.owner) violations.push(violation("PC-003", "CONTRACT_PLANNER_JOB_LINEAGE", "jobs", job.id, "sourceEntityId", [taskId], "Planner Job must remain in the same Project and owner as its source Task."));
      }
    });
    Object.keys(plannerJobs).forEach(function (taskId) {
      if (plannerJobs[taskId].length > 1) violations.push(violation("PC-003", "CONTRACT_PLANNER_JOB_CARDINALITY", "tasks", taskId, "jobId/schedulerJobId", plannerJobs[taskId], "A Planner Task may have at most one canonical Planner Job."));
    });

    projects.forEach(function (project) {
      if (Array.isArray(project.locations) && project.locations.length) violations.push(violation("PC-004", "CONTRACT_PROJECT_LOCATION_PIN", "projects", project.id, "locations", [], "Register Location pins must not be stored on a Delivery Project."));
    });
    geometries.forEach(function (geometry) {
      var project = ids[text(geometry.projectId)];
      if (!project || project.type !== "project") violations.push(violation("PC-004", "CONTRACT_GEOMETRY_PROJECT", "geometries", geometry.id, "projectId", [geometry.projectId], "Work Geometry must belong to one existing Delivery Project."));
      else if (project.owner !== geometry.owner) violations.push(violation("PC-004", "CONTRACT_GEOMETRY_OWNER", "geometries", geometry.id, "owner", [project.id], "Work Geometry owner must match its Delivery Project."));
      var geometryType = text(geometry.geometry && geometry.geometry.type).toLowerCase(), kind = text(geometry.geometryKind).toLowerCase();
      if (kind === "location" || geometryType === "point" || geometryType === "multipoint") violations.push(violation("PC-004", "CONTRACT_LOCATION_AS_WORK_GEOMETRY", "geometries", geometry.id, "geometryKind", [], "Register Location pins and Project Work Geometry must remain separate objects."));
    });

    geometries.forEach(function (geometry) {
      var mappedJobs = jobs.filter(function (job) {
        return text(job.sourceKind) === "space-map" && text(job.sourceEntityId) === text(geometry.id) && text(job.sourceGeometryId) === text(geometry.id);
      });
      var relatedJobs = jobs.filter(function (job) {
        return text(job.sourceEntityId) === text(geometry.id) || text(job.sourceGeometryId) === text(geometry.id);
      });
      var mappedLines = lines.filter(function (line) { return text(line.sourceGeometryId) === text(geometry.id); });
      var operational = relatedJobs.length > 0 || mappedLines.length > 0 || text(geometry.syncState && geometry.syncState.code) === "synced";
      if (!operational) return; // Planning-only geometry is explicitly valid.
      if (mappedJobs.length !== 1 || relatedJobs.length !== 1) violations.push(violation("PC-005", "CONTRACT_GEOMETRY_JOB_CARDINALITY", "geometries", geometry.id, "id", relatedJobs.map(function (item) { return item.id; }), "Promoted Work Geometry must have exactly one canonical space-map Job."));
      if (mappedLines.length !== 1) violations.push(violation("PC-005", "CONTRACT_GEOMETRY_COST_CARDINALITY", "geometries", geometry.id, "id", mappedLines.map(function (item) { return item.id; }), "Promoted Work Geometry must have exactly one mapped Costing Line."));
      if (mappedJobs.length === 1 && mappedLines.length === 1) {
        var job = mappedJobs[0], line = mappedLines[0];
        if (job.projectId !== geometry.projectId || job.owner !== geometry.owner || line.projectId !== geometry.projectId || line.owner !== geometry.owner || line.jobId !== job.id) {
          violations.push(violation("PC-005", "CONTRACT_GEOMETRY_LINEAGE_OWNER", "geometries", geometry.id, "projectId/owner", [job.id, line.id], "Promoted Work Geometry, Job and Costing Line must remain in one Project and owner lineage."));
        }
      }
    });

    jobs.forEach(function (job) {
      var project = ids[text(job.projectId)];
      if (!project || project.type !== "project") violations.push(violation("PC-006", "CONTRACT_JOB_PROJECT", "jobs", job.id, "projectId", [job.projectId], "Every Job must belong to one existing Delivery Project."));
      else if (project.owner !== job.owner) violations.push(violation("PC-006", "CONTRACT_JOB_OWNER", "jobs", job.id, "owner", [project.id], "Job owner must match its Delivery Project."));
      var kind = text(job.sourceKind);
      if (["space-map", "planner"].indexOf(kind) >= 0 && !text(job.sourceEntityId)) violations.push(violation("PC-006", "CONTRACT_JOB_SOURCE", "jobs", job.id, "sourceEntityId", [], "Space Map and Planner Jobs require exact source lineage; Calculator lineage remains governed by its module contract and legacy migration rules."));
    });

    return violations;
  }

  function assertHard(workspace) {
    var violations = validateHard(workspace);
    if (violations.length) {
      var error = new Error("Product contract violation:\n- " + violations.map(function (item) { return item.contractId + " " + item.code + (item.entityId ? " · " + item.entityId : "") + " — " + item.message; }).join("\n- "));
      error.name = "ProductContractError";
      error.violations = clone(violations);
      throw error;
    }
    return workspace;
  }

  function summary() {
    return CONTRACTS.reduce(function (result, item) {
      result.total += 1;
      result[item.state] = (result[item.state] || 0) + 1;
      return result;
    }, { total: 0, enforced: 0, deferred: 0 });
  }

  UOS.ProductContracts = {
    version: CONTRACT_SET_VERSION,
    catalog: CONTRACTS,
    byId: byId,
    contractForIssueCode: contractForIssueCode,
    validateHard: validateHard,
    assertHard: assertHard,
    summary: summary
  };
}());
