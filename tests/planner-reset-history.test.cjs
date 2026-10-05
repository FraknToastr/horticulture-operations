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
  const { ProgramModel: model, ProgramPlannerModel: planner, ProgramStatus: status } = context.UOS;
  const initial = model.blank('2026-10-02T00:00:00.000Z');
  const record = { id: `${owner === 'NSA' ? 'NSA-APP' : 'EVT'}-RESET`, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Reset test', status: 'received' };
  initial.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
  const promoted = model.promoteRegisterRecord(initial, record.id);
  const workspace = status.migrate(promoted.workspace);
  return { model, planner, status, workspace, projectId: promoted.project.id, task: workspace.entities.tasks.find(task => task.projectId === promoted.project.id) };
}

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: backward reasons and reset history survive round trip and do not count as work`, () => {
    const { model, planner, status, workspace, projectId, task } = fixture(owner);
    const changed = status.reconcileMutation(workspace, planner.saveTask(workspace, projectId, task.id, { ...task, status: 'In Progress', notes: 'Changed', title: 'Edited' }).workspace, { actor: 'Officer' });
    assert.throws(() => planner.resetTask(changed, projectId, task.id, {}, { actor: 'Officer' }), /reason/);
    const before = JSON.stringify(changed);
    const outcome = planner.resetTask(changed, projectId, task.id, {}, { actor: 'Officer', reason: 'Work did not start' });
    assert.equal(JSON.stringify(changed), before, 'command must not mutate input');
    const saved = status.reconcileMutation(changed, outcome.workspace, { actor: 'Officer', reason: 'Work did not start', action: 'Planner.resetTask' });
    const reloaded = model.normalize(JSON.parse(JSON.stringify(saved)));
    const restored = reloaded.entities.tasks.find(item => item.id === task.id);
    assert.equal(restored.title, task.title);
    assert.equal(restored.status, 'not_started');
    assert.equal(restored.notes, '');
    assert.equal(restored.sortOrder, task.sortOrder);
    assert.equal(restored.plannerHistoryVisible, true);
    assert.equal(restored.plannerResetEvents[0].reason, 'Work did not start');
    assert.equal(restored.plannerResetEvents[0].actor, 'Officer');
    assert.equal(planner.taskState(reloaded, restored).hasWork, false);
    assert.ok(reloaded.entities.statusEvents.some(event => event.entityId === task.id && event.fromStatus === 'in_progress' && event.toStatus === 'not_started' && event.reason === 'Work did not start'));
    const resetAgain = planner.resetTask(reloaded, projectId, task.id, {}, { actor: 'Officer' });
    assert.equal(resetAgain.task.plannerHistoryVisible, true);
    assert.equal(resetAgain.task.plannerResetEvents.length, 2);
  });

  test(`${owner}: custom and duplicate baselines are independent; order remains automatic`, () => {
    const { planner, workspace, projectId, task } = fixture(owner);
    const created = planner.saveTask(workspace, projectId, null, { title: 'Custom', description: 'Original description', section: task.section, operational: true, status: 'Not Started', notes: 'Original notes' });
    assert.ok(Number.isInteger(created.task.sortOrder));
    const edited = planner.saveTask(created.workspace, projectId, created.task.id, { ...created.task, status: 'Not Started', notes: 'New notes' });
    const reset = planner.resetTask(edited.workspace, projectId, created.task.id, {}, { actor: 'Officer' });
    assert.equal(reset.task.notes, 'Original notes');
    assert.equal(reset.task.operational, true);
    const duplicated = planner.duplicateTasks(reset.workspace, projectId, [created.task.id]);
    const copy = duplicated.tasks[0];
    assert.equal(copy.plannerResetEvents, undefined);
    assert.equal(copy.plannerHistoryVisible, undefined);
    const changedCopy = planner.saveTask(duplicated.workspace, projectId, copy.id, { ...copy, status: 'Not Started', title: 'Changed duplicate' });
    const restoredCopy = planner.resetTask(changedCopy.workspace, projectId, copy.id, {}, { actor: 'Officer' });
    assert.equal(restoredCopy.task.title, 'Custom');
    assert.equal(restoredCopy.task.id, copy.id);
    assert.equal(restoredCopy.workspace.entities.tasks.find(item => item.id === created.task.id).plannerResetEvents.length, 1);
    const legacy = JSON.parse(JSON.stringify(created.workspace));
    delete legacy.entities.tasks.find(item => item.id === created.task.id).plannerResetBaseline;
    const legacyEdit = planner.saveTask(legacy, projectId, created.task.id, { ...created.task, status: 'Not Started', notes: 'Edited legacy' });
    assert.equal(planner.resetTask(legacyEdit.workspace, projectId, created.task.id, {}, { actor: 'Officer' }).task.notes, 'Original notes');
  });

  test(`${owner}: reset deletes safe job only after confirmation and protected failures are atomic`, () => {
    const { planner, workspace, projectId, task } = fixture(owner);
    const marked = planner.updateTask(workspace, projectId, task.id, { operational: true });
    const draft = planner.createDraftJob(marked.workspace, projectId, task.id);
    assert.throws(() => planner.resetTask(draft.workspace, projectId, task.id, {}, { actor: 'Officer' }), /Confirm deletion/);
    const reset = planner.resetTask(draft.workspace, projectId, task.id, {}, { actor: 'Officer', deleteLinkedJob: true });
    assert.equal(reset.workspace.entities.jobs.length, 0);
    assert.equal(reset.task.jobId, null);
    const protectedWorkspace = JSON.parse(JSON.stringify(draft.workspace));
    protectedWorkspace.entities.jobs.find(item => item.id === draft.job.id).actualCost = 100;
    const before = JSON.stringify(protectedWorkspace);
    assert.throws(() => planner.resetTask(protectedWorkspace, projectId, task.id, {}, { actor: 'Officer', deleteLinkedJob: true }), /actual financial history/);
    assert.equal(JSON.stringify(protectedWorkspace), before);
    for (const status of ['in_progress', 'completed']) {
      const delivery = JSON.parse(JSON.stringify(draft.workspace));
      delivery.entities.jobs.find(item => item.id === draft.job.id).status = status;
      assert.throws(() => planner.resetTask(delivery, projectId, task.id, {}, { actor: 'Officer', deleteLinkedJob: true }), /delivery history/);
    }
  });
}
