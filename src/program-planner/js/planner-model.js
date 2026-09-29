(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var SCHEDULABLE_TEMPLATE_KEYS = ["irrigation-markout", "turf-maintenance"];
  var EVENT_TEMPLATES = [
    { templateKey: "request-raising-po", section: "Pre-delivery", title: "Request Raising PO", schedulable: false },
    { templateKey: "raise-po", section: "Pre-delivery", title: "Raise PO", schedulable: false },
    { templateKey: "irrigation-markout", section: "Pre-delivery", title: "Irrigation Markout", schedulable: true },
    { templateKey: "turf-maintenance", section: "Post-delivery", title: "Turf Maintenance", schedulable: true }
  ];

  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function model() {
    if (!UOS.ProgramModel) throw new Error("ProgramModel must load before PlannerModel.");
    return UOS.ProgramModel;
  }
  function workspace(input) {
    var candidate = model().normalize(clone(input));
    model().assertValid(candidate);
    return candidate;
  }
  function findProject(candidate, projectId) {
    var project = candidate.entities.projects.find(function (item) { return item.id === text(projectId); });
    if (!project) throw new Error('Project "' + text(projectId) + '" was not found.');
    return project;
  }
  function findTask(candidate, project, taskId) {
    var task = candidate.entities.tasks.find(function (item) { return item.id === text(taskId); });
    if (!task) throw new Error('Task "' + text(taskId) + '" was not found.');
    if (task.projectId !== project.id || task.owner !== project.owner) throw new Error("Task must belong to the selected Project and owner.");
    return task;
  }
  function taskTemplateKey(task) {
    return text(task.templateKey).toLowerCase().replace(/[\s_]+/g, "-");
  }
  function schedulable(task) {
    return task.operational === true || task.schedulable === true ||
      SCHEDULABLE_TEMPLATE_KEYS.indexOf(taskTemplateKey(task)) >= 0;
  }
  function nextDuplicateId(candidate, project, source) {
    var ordinal = 1, id;
    do {
      id = model().stableId(project.owner, "task", project.id + ":" + source.id + ":duplicate:" + ordinal);
      ordinal += 1;
    } while (candidate.entities.tasks.some(function (item) { return item.id === id; }));
    return id;
  }

  var TASK_STATUSES = ["Not Started", "In Progress", "Complete", "On Hold", "N/A"];

  function normalizeAssignment(value) {
    var next = text(value);
    return !next || next.toLowerCase() === "not assigned" ? null : next;
  }
  function validDate(value) {
    var next = text(value);
    if (!next) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return false;
    var parsed = new Date(next + "T00:00:00Z");
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === next;
  }
  function updateTask(input, projectId, taskId, patch, options) {
    var candidate = workspace(input), project = findProject(candidate, projectId), task = findTask(candidate, project, taskId);
    if (!object(patch)) throw new Error("A Planner task patch is required.");
    var allowed = { assigneeId: true, dueDate: true, notes: true, suppressed: true, operational: true };
    Object.keys(patch).forEach(function (field) {
      if (!allowed[field]) throw new Error('Planner task field "' + field + '" cannot be changed through the Planner.');
    });
    if (Object.prototype.hasOwnProperty.call(patch, "assigneeId")) task.assigneeId = normalizeAssignment(patch.assigneeId);
    if (Object.prototype.hasOwnProperty.call(patch, "dueDate")) {
      var dueDate = text(patch.dueDate);
      if (!validDate(dueDate)) throw new Error("Planner task due date must be a valid YYYY-MM-DD date.");
      task.dueDate = dueDate;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "notes")) task.notes = text(patch.notes);
    if (Object.prototype.hasOwnProperty.call(patch, "suppressed")) task.suppressed = patch.suppressed === true;
    if (Object.prototype.hasOwnProperty.call(patch, "operational")) {
      if (typeof patch.operational !== "boolean") throw new Error("Planner task operational must be a boolean.");
      if (patch.operational === false && (task.jobId || task.schedulerJobId)) throw new Error("A task with a linked Job cannot be unmarked operational.");
      task.operational = patch.operational;
    }
    var at = text(options && options.at) || new Date().toISOString();
    task.updatedAt = at;
    candidate.updatedAt = at;
    candidate = model().normalize(candidate);
    return { workspace: candidate, task: clone(candidate.entities.tasks.find(function (item) { return item.id === task.id; })) };
  }
  function createTask(input, projectId, values, options) {
    var candidate = workspace(input), project = findProject(candidate, projectId), at = text(options && options.at) || new Date().toISOString();
    values = object(values) ? values : {};
    var projectTasks = candidate.entities.tasks.filter(function (item) { return item.projectId === project.id; });
    var sortOrder = projectTasks.reduce(function (highest, item) { return Math.max(highest, Number(item.sortOrder) || 0); }, -1) + 1;
    var ordinal = 1, id;
    do {
      id = model().stableId(project.owner, "task", project.id + ":custom:" + at + ":" + ordinal);
      ordinal += 1;
    } while (candidate.entities.tasks.some(function (item) { return item.id === id; }));
    var task = {
      id: id, owner: project.owner, type: "task", projectId: project.id, templateKey: null,
      title: text(values.title) || "New task", section: text(values.section) || "Planning and Approval",
      description: text(values.description) || "Custom checklist task", status: "not_started", assigneeId: null, dueDate: "", notes: "",
      sortOrder: sortOrder, jobId: null, schedulerJobId: null, paymentAllocationId: null, suppressed: false,
      operational: values.operational === true,
      createdAt: at, updatedAt: at, provenance: { owner: project.owner, sourceApp: model().appId, sourceVersion: model().schemaVersion, sourceId: id, importedAt: at }
    };
    candidate.entities.tasks.push(task);
    candidate.updatedAt = at;
    candidate = model().normalize(candidate);
    return { workspace: candidate, task: clone(candidate.entities.tasks.find(function (item) { return item.id === id; })) };
  }

  function duplicateTasks(input, projectId, taskIds, options) {
    var candidate = workspace(input), project = findProject(candidate, projectId), selected = Array.isArray(taskIds) ? taskIds.map(text).filter(Boolean) : [text(taskIds)].filter(Boolean);
    if (!selected.length) throw new Error("Select at least one checklist task to duplicate.");
    var selectedSet = {}, duplicated = [], at = text(options && options.at) || new Date().toISOString();
    selected.forEach(function (id) {
      if (selectedSet[id]) throw new Error('Task "' + id + '" was selected more than once.');
      selectedSet[id] = true;
      findTask(candidate, project, id);
    });
    var output = [];
    candidate.entities.tasks.forEach(function (task) {
      output.push(task);
      if (!selectedSet[task.id]) return;
      var copy = clone(task);
      copy.id = nextDuplicateId(candidate, project, task);
      copy.jobId = null;
      copy.schedulerJobId = null;
      copy.paymentAllocationId = null;
      copy.suppressed = false;
      copy.createdAt = at;
      copy.updatedAt = at;
      copy.provenance = object(copy.provenance) ? clone(copy.provenance) : {};
      copy.provenance.owner = project.owner;
      copy.provenance.duplicatedFromTaskId = task.id;
      copy.provenance.duplicatedAt = at;
      output.push(copy);
      candidate.entities.tasks.push(copy); // Reserve the ID for later duplicates in this transaction.
      duplicated.push(clone(copy));
    });
    candidate.entities.tasks = output;
    candidate.updatedAt = at;
    candidate = model().normalize(candidate);
    return { workspace: candidate, tasks: duplicated.map(function (task) { return clone(candidate.entities.tasks.find(function (item) { return item.id === task.id; })); }) };
  }

  function linkedPlannerJob(candidate, task) {
    var linkedIds = [text(task.schedulerJobId), text(task.jobId)].filter(Boolean);
    var matches = candidate.entities.jobs.filter(function (job) {
      return linkedIds.indexOf(job.id) >= 0 || (job.sourceKind === "planner" && job.sourceEntityId === task.id);
    });
    if (matches.length > 1) throw new Error("Task has multiple Planner jobs; review Data Health before continuing.");
    return matches[0] || null;
  }
  function assertPlannerJob(job, project, task) {
    if (job.projectId !== project.id || job.owner !== project.owner || job.sourceKind !== "planner" || job.sourceEntityId !== task.id) {
      throw new Error("Task has an invalid Planner job link.");
    }
  }
  function createDraftJob(input, projectId, taskId, options) {
    var candidate = workspace(input), project = findProject(candidate, projectId), task = findTask(candidate, project, taskId);
    if (!schedulable(task)) throw new Error('Task "' + task.title + '" is not marked operational.');
    var existing = linkedPlannerJob(candidate, task);
    if (existing) {
      assertPlannerJob(existing, project, task);
      if (task.jobId !== existing.id || (existing.startDate && (task.schedulerJobId !== existing.id || existing.status === "draft"))) {
        task.jobId = existing.id;
        if (existing.startDate) {
          task.schedulerJobId = existing.id;
          if (existing.status === "draft") existing.status = "scheduled";
        }
        task.updatedAt = text(options && options.at) || new Date().toISOString();
        candidate.updatedAt = task.updatedAt;
      }
      candidate = model().normalize(candidate);
      return { workspace: candidate, task: clone(candidate.entities.tasks.find(function (item) { return item.id === task.id; })), job: clone(existing), created: false };
    }
    var at = text(options && options.at) || new Date().toISOString();
    var jobId = model().stableId(project.owner, "job", "planner:" + task.id);
    if (candidate.entities.jobs.some(function (job) { return job.id === jobId; })) throw new Error("The deterministic Planner job identity is already used by another job.");
    var job = {
      id: jobId, owner: project.owner, type: "job", projectId: project.id,
      applicationId: text(project.applicationId) || null, eventId: text(project.eventId) || null,
      title: text(task.title) || "Planner task", name: text(task.title) || "Planner task", status: "draft",
      startDate: "", endDate: "", startTime: "", endTime: "", allDay: true, durationMinutes: 0,
      sourceKind: "planner", sourceEntityId: task.id, sourceGeometryId: null,
      provenance: { owner: project.owner, sourceApp: model().appId, sourceVersion: model().schemaVersion, sourceId: task.id, importedAt: at }
    };
    candidate.entities.jobs.push(job);
    task.jobId = job.id;
    task.schedulerJobId = null;
    task.updatedAt = at;
    candidate.updatedAt = at;
    candidate = model().normalize(candidate);
    return { workspace: candidate, task: clone(candidate.entities.tasks.find(function (item) { return item.id === task.id; })), job: clone(candidate.entities.jobs.find(function (item) { return item.id === job.id; })), created: true };
  }
  function scheduleTask(input, projectId, taskId, options) {
    options = options || {};
    var at = text(options.at) || new Date().toISOString();
    var draft = createDraftJob(input, projectId, taskId, options);
    var candidate = draft.workspace, task = candidate.entities.tasks.find(function (item) { return item.id === text(taskId); });
    var job = candidate.entities.jobs.find(function (item) { return item.id === draft.job.id; });
    if (task.schedulerJobId === job.id || job.startDate) return { workspace: candidate, task: clone(task), job: clone(job), created: false };
    var date = text(options.date || task.dueDate || at.slice(0, 10));
    if (!validDate(date) || !date) throw new Error("A valid scheduling date is required.");
    job.startDate = date; job.endDate = date; job.status = "scheduled";
    task.schedulerJobId = job.id; task.updatedAt = at;
    candidate.updatedAt = at;
    candidate = model().normalize(candidate);
    return { workspace: candidate, task: clone(candidate.entities.tasks.find(function (item) { return item.id === task.id; })), job: clone(candidate.entities.jobs.find(function (item) { return item.id === job.id; })), created: draft.created };
  }

  UOS.ProgramPlannerModel = {
    eventTemplates: function () { return clone(EVENT_TEMPLATES); },
    schedulableTemplateKeys: SCHEDULABLE_TEMPLATE_KEYS.slice(),
    taskStatuses: TASK_STATUSES.slice(),
    isOperationalTask: schedulable,
    updateTask: updateTask,
    createTask: createTask,
    duplicateTasks: duplicateTasks,
    createDraftJob: createDraftJob,
    scheduleTask: scheduleTask
  };
}());
