const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(owner) {
  const context = { console, structuredClone, TextEncoder, TextDecoder, URLSearchParams, setTimeout, clearTimeout };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: `uos.horticulture.${owner.toLowerCase()}`, workspaceKind: owner, owner }) } };
  vm.createContext(context);
  for (const file of ['status.js', 'default-rate-catalog.js', 'model.js', 'status-model.js', 'planner-model.js']) {
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, 'utf8'), context, { filename: file });
  }
  const { ProgramModel: model, ProgramPlannerModel: planner } = context.UOS;
  const workspace = model.blank('2026-10-01T00:00:00.000Z');
  const record = { id: `${owner === 'NSA' ? 'NSA-APP' : 'EVT'}-CURRENT-STATE`, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Current state', status: 'received' };
  workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
  const promoted = model.promoteRegisterRecord(workspace, record.id);
  const canonical = context.UOS.ProgramStatus.migrate(promoted.workspace);
  return { model, planner, workspace: canonical, projectId: promoted.project.id, task: canonical.entities.tasks.find(item => item.projectId === promoted.project.id) };
}

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: Operational classification and deleted Job history do not count as task work`, () => {
    const { model, planner, workspace, projectId, task } = fixture(owner);
    assert.equal(planner.taskState(workspace, task).hasWork, false);
    const marked = planner.updateTask(workspace, projectId, task.id, { operational: true });
    assert.notEqual(marked.task.updatedAt, marked.task.createdAt);
    assert.equal(planner.taskState(marked.workspace, marked.task).hasWork, false);
    const draft = planner.createDraftJob(marked.workspace, projectId, task.id);
    assert.equal(planner.taskState(draft.workspace, draft.task).hasWork, true);
    assert.equal(planner.taskState(draft.workspace, draft.task).scheduled, false);
    const scheduled = planner.scheduleTask(draft.workspace, projectId, task.id, { date: '2026-10-05' });
    assert.equal(planner.taskState(scheduled.workspace, scheduled.task).scheduled, true);
    const deleted = model.deleteJob(scheduled.workspace, scheduled.job.id);
    const kept = deleted.entities.tasks.find(item => item.id === task.id);
    assert.equal(kept.operational, true);
    assert.equal(planner.taskState(deleted, kept).job, null);
    assert.equal(planner.taskState(deleted, kept).hasWork, false);
    const noted = planner.saveTask(deleted, projectId, kept.id, { ...kept, status: 'Not Started', notes: 'Delivery note' });
    assert.equal(noted.job, null);
    assert.equal(noted.workspace.entities.jobs.length, 0);
    assert.equal(planner.taskState(noted.workspace, noted.task).hasWork, true);
    const reverted = planner.saveTask(noted.workspace, projectId, kept.id, { ...kept, status: 'Not Started', notes: '' });
    assert.equal(reverted.job, null);
    assert.equal(planner.taskState(reverted.workspace, reverted.task).hasWork, false);
    assert.throws(() => planner.saveTask(deleted, projectId, kept.id, { ...kept, status: 'Not Started', sortOrder: 0.5 }), /whole number/);
    // Stale identifiers are not evidence that a Job still exists.
    kept.jobId = kept.schedulerJobId = scheduled.job.id;
    assert.equal(planner.taskState(deleted, kept).hasWork, false);
    const before = JSON.stringify(deleted);
    planner.taskState(deleted, kept);
    assert.equal(JSON.stringify(deleted), before);
  });

  test(`${owner}: current substantive changes count, reverted values and timestamps do not`, () => {
    const { planner, workspace, task } = fixture(owner);
    const changes = { title: 'Changed title', description: 'Changed description', section: 'Other', sortOrder: 99,
      status: 'in_progress', assigneeId: 'Hort staff', dueDate: '2026-10-05', notes: 'Changed notes', suppressed: true,
      templateKey: 'unknown-template', provenance: { duplicatedFromTaskId: 'original' } };
    for (const [field, value] of Object.entries(changes)) {
      const changed = { ...task, [field]: value };
      assert.equal(planner.taskState(workspace, changed).hasWork, true, field);
      changed[field] = task[field];
      changed.updatedAt = '2026-10-02T00:00:00.000Z';
      assert.equal(planner.taskState(workspace, changed).hasWork, false, `${field} reverted`);
    }
    assert.equal(planner.taskState(workspace, { ...task, templateKey: null }).hasWork, true);
    assert.equal(planner.taskState(workspace, { ...task, assigneeId: 'Not assigned' }).hasWork, false);
  });

  test(`${owner}: existing Jobs remain evidence of work and protected deletion cannot reset it`, () => {
    const { model, planner, workspace, projectId, task } = fixture(owner);
    const marked = planner.updateTask(workspace, projectId, task.id, { operational: true });
    const draft = planner.createDraftJob(marked.workspace, projectId, task.id);
    const unlinkedTask = { ...draft.task, jobId: null, schedulerJobId: null };
    assert.equal(planner.taskState(draft.workspace, unlinkedTask).job.id, draft.job.id);
    draft.workspace.entities.jobs.find(item => item.id === draft.job.id).actualCost = 100;
    assert.throws(() => model.deleteJob(draft.workspace, draft.job.id), /actual financial history/);
    assert.equal(planner.taskState(draft.workspace, draft.task).hasWork, true);
    const otherOwner = { ...draft.job, owner: owner === 'NSA' ? 'EVT' : 'NSA' };
    assert.equal(planner.taskState({ entities: { jobs: [otherOwner] } }, draft.task).job, null);
  });
}
