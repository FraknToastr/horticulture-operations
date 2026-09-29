const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function fixture() {
  const context = { console, structuredClone, TextEncoder, TextDecoder, URLSearchParams, setTimeout, clearTimeout };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: "uos.horticulture.nsa", workspaceKind: "NSA", owner: "NSA" }) } };
  vm.createContext(context);
  for (const file of ["status.js", "default-rate-catalog.js", "model.js", "status-model.js", "planner-model.js"]) {
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file });
  }
  const model = context.UOS.ProgramModel;
  const planner = context.UOS.ProgramPlannerModel;
  const workspace = model.blank("2026-09-28T00:00:00.000Z");
  const record = { id: "NSA-APP-PLANNER-DRAFT", owner: "NSA", type: "application", title: "Draft job test", dateReceived: "2026-09-28", status: "received" };
  workspace.entities.applications.push(record);
  const promoted = model.promoteRegisterRecord(workspace, record.id);
  const canonical = context.UOS.ProgramStatus.migrate(promoted.workspace);
  const seeded = planner.createTask(canonical, promoted.project.id, { title: "Irrigation Markout" }, { at: "2026-09-28T00:30:00.000Z" });
  const template = seeded.workspace.entities.tasks.find((item) => item.id === seeded.task.id);
  template.templateKey = "irrigation-markout";
  template.operational = false;
  return { model, planner, workspace: seeded.workspace, project: promoted.project };
}

function templateTask(workspace, project) {
  const task = workspace.entities.tasks.find((item) => item.projectId === project.id && item.templateKey === "irrigation-markout");
  assert.ok(task, "fixture should include the grandfathered operational template");
  return task;
}

test("custom checklist tasks require an explicit operational mark", () => {
  const { planner, workspace, project } = fixture();
  const custom = planner.createTask(workspace, project.id, { title: "Irrigation Markout" }, { at: "2026-09-28T01:00:00.000Z" });
  assert.equal(custom.task.operational, false);
  assert.equal(custom.task.status, "not_started");
  assert.throws(() => planner.createDraftJob(custom.workspace, project.id, custom.task.id), /not marked operational/);
  assert.throws(() => planner.updateTask(custom.workspace, project.id, custom.task.id, { operational: "true" }), /must be a boolean/);
  const marked = planner.updateTask(custom.workspace, project.id, custom.task.id, { operational: true });
  assert.equal(marked.task.operational, true);
  const draft = planner.createDraftJob(marked.workspace, project.id, custom.task.id, { at: "2026-09-28T02:00:00.000Z" });
  assert.equal(draft.created, true);
  assert.throws(() => planner.updateTask(draft.workspace, project.id, custom.task.id, { operational: false }), /linked Job/);
});

test("Create Draft Job links only jobId and is idempotent", () => {
  const { model, planner, workspace, project } = fixture();
  const task = templateTask(workspace, project);
  const first = planner.createDraftJob(workspace, project.id, task.id, { at: "2026-09-28T01:00:00.000Z" });
  assert.equal(first.created, true);
  assert.equal(first.job.sourceKind, "planner");
  assert.equal(first.job.status, "draft");
  assert.equal(first.job.sourceEntityId, task.id);
  assert.equal(first.job.projectId, project.id);
  assert.equal(first.job.startDate, "");
  assert.equal(first.task.jobId, first.job.id);
  assert.equal(first.task.schedulerJobId, null);
  assert.doesNotThrow(() => model.assertValid(first.workspace));
  const second = planner.createDraftJob(first.workspace, project.id, task.id);
  assert.equal(second.created, false);
  assert.equal(second.job.id, first.job.id);
  assert.equal(second.workspace.entities.jobs.length, first.workspace.entities.jobs.length);
  assert.equal(second.task.schedulerJobId, null);
});

test("scheduling reuses the draft and only then links schedulerJobId", () => {
  const { planner, workspace, project } = fixture();
  const task = templateTask(workspace, project);
  const draft = planner.createDraftJob(workspace, project.id, task.id);
  const scheduled = planner.scheduleTask(draft.workspace, project.id, task.id, { date: "2026-10-05" });
  assert.equal(scheduled.created, false);
  assert.equal(scheduled.job.id, draft.job.id);
  assert.equal(scheduled.job.startDate, "2026-10-05");
  assert.equal(scheduled.job.status, "scheduled");
  assert.equal(scheduled.task.jobId, draft.job.id);
  assert.equal(scheduled.task.schedulerJobId, draft.job.id);
  assert.equal(scheduled.workspace.entities.jobs.length, draft.workspace.entities.jobs.length);
  const reopened = planner.createDraftJob(scheduled.workspace, project.id, task.id);
  assert.equal(reopened.created, false);
  assert.equal(reopened.job.id, draft.job.id);
  assert.equal(reopened.task.schedulerJobId, draft.job.id);
  assert.equal(reopened.workspace.entities.jobs.length, draft.workspace.entities.jobs.length);
});

test("existing scheduled Planner jobs are reused even when the task link is missing", () => {
  const { planner, workspace, project } = fixture();
  const task = templateTask(workspace, project);
  const scheduled = planner.scheduleTask(workspace, project.id, task.id, { date: "2026-10-05" });
  const unlinked = structuredClone(scheduled.workspace);
  const unlinkedTask = unlinked.entities.tasks.find((item) => item.id === task.id);
  unlinkedTask.jobId = null;
  unlinkedTask.schedulerJobId = null;
  const reused = planner.createDraftJob(unlinked, project.id, task.id);
  assert.equal(reused.created, false);
  assert.equal(reused.job.id, scheduled.job.id);
  assert.equal(reused.workspace.entities.jobs.length, scheduled.workspace.entities.jobs.length);
  assert.equal(reused.task.jobId, scheduled.job.id);
  assert.equal(reused.task.schedulerJobId, scheduled.job.id);
  const again = planner.scheduleTask(reused.workspace, project.id, task.id, { date: "2026-10-06" });
  assert.equal(again.job.id, scheduled.job.id);
  assert.equal(again.workspace.entities.jobs.length, scheduled.workspace.entities.jobs.length);
});

test("reopening a draft dated in Scheduler backfills the scheduled task link", () => {
  const { planner, workspace, project } = fixture();
  const task = templateTask(workspace, project);
  const draft = planner.createDraftJob(workspace, project.id, task.id);
  const edited = structuredClone(draft.workspace);
  const job = edited.entities.jobs.find((item) => item.id === draft.job.id);
  job.startDate = "2026-10-07";
  job.endDate = "2026-10-07";
  const reopened = planner.createDraftJob(edited, project.id, task.id);
  assert.equal(reopened.created, false);
  assert.equal(reopened.task.schedulerJobId, draft.job.id);
  assert.equal(reopened.job.status, "scheduled");
  assert.equal(reopened.workspace.entities.jobs.length, draft.workspace.entities.jobs.length);
});

test("duplicated operational tasks do not inherit job links", () => {
  const { planner, workspace, project } = fixture();
  const task = templateTask(workspace, project);
  const draft = planner.createDraftJob(workspace, project.id, task.id);
  const duplicated = planner.duplicateTasks(draft.workspace, project.id, [task.id]);
  assert.equal(duplicated.tasks[0].jobId, null);
  assert.equal(duplicated.tasks[0].schedulerJobId, null);
  const second = planner.createDraftJob(duplicated.workspace, project.id, duplicated.tasks[0].id);
  assert.notEqual(second.job.id, draft.job.id);
  assert.equal(second.workspace.entities.jobs.length, draft.workspace.entities.jobs.length + 1);
});
