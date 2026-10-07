const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(owner) {
  const context = { console, structuredClone, TextEncoder, TextDecoder, Uint8Array, DataView, ArrayBuffer, DecompressionStream, crypto, URL, URLSearchParams, setTimeout, clearTimeout, document: { currentScript: { src: 'https://example.test/src/shared/js/imports.js' } } };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: `uos.horticulture.${owner === 'NSA' ? 'nsa' : 'events'}`, workspaceKind: owner, owner }) } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('src/shared/js/imports.js', 'utf8'), context, { filename: 'imports.js' });
  for (const file of ['status.js', 'default-rate-catalog.js', 'model.js', 'status-model.js', 'planner-model.js', 'data-workspace.js']) {
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, 'utf8'), context, { filename: file });
  }
  const { ProgramModel: model, ProgramPlannerModel: planner, ProgramStatus: status } = context.UOS;
  const initial = model.blank('2026-10-02T00:00:00.000Z');
  const record = { id: `${owner === 'NSA' ? 'NSA-APP' : 'EVT'}-RESET`, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Reset test', status: 'received' };
  initial.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
  const promoted = model.promoteRegisterRecord(initial, record.id);
  const workspace = status.migrate(promoted.workspace);
  return { model, planner, status, data: context.UOS.ProgramData, workspace, projectId: promoted.project.id, task: workspace.entities.tasks.find(task => task.projectId === promoted.project.id) };
}

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: backward reasons and reset history survive round trip and do not count as work`, () => {
    const { model, planner, status, data, workspace, projectId, task } = fixture(owner);
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
    assert.equal(restored.plannerResetEvents[0].taskTitle, 'Edited');
    assert.equal(restored.plannerResetEvents[0].restoredTaskTitle, task.title);
    for (const backup of [model.normalize(JSON.parse(data.exportJson(saved, owner))), data.importBundle(data.exportBundle(saved, owner), null, { expectedApp: owner })]) {
      assert.deepEqual(JSON.parse(JSON.stringify(backup.entities.tasks.find(item => item.id === task.id).plannerResetEvents)), JSON.parse(JSON.stringify(restored.plannerResetEvents)));
    }
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

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: title snapshots are immutable metadata, round-trip through backups and preserve legacy history`, () => {
    const { model, planner, status, data, workspace, projectId, task } = fixture(owner);
    const legacy = JSON.stringify(workspace.entities.statusEvents);
    const created = planner.saveTask(workspace, projectId, null, { title: 'Original <task> & work', description: 'Named audit test', section: task.section, operational: false, status: 'Not Started' });
    const established = status.reconcileMutation(workspace, created.workspace, { actor: 'Officer', at: '2026-10-05T01:00:00Z' });
    const initial = established.entities.statusEvents.find(event => event.entityId === created.task.id);
    assert.equal(initial.taskTitle, 'Original <task> & work');
    const changed = planner.saveTask(established, projectId, created.task.id, { ...created.task, title: 'Renamed during transition', status: 'In Progress' });
    const advanced = status.reconcileMutation(established, changed.workspace, { actor: 'Officer', at: '2026-10-05T02:00:00Z' });
    const event = advanced.entities.statusEvents.find(event => event.entityId === created.task.id && event.toStatus === 'in_progress');
    assert.equal(event.taskTitle, 'Renamed during transition');
    const count = advanced.entities.statusEvents.length;
    const renamed = planner.saveTask(advanced, projectId, created.task.id, { ...changed.task, status: 'In Progress', title: 'Current task name' });
    const saved = status.reconcileMutation(advanced, renamed.workspace, { actor: 'Officer', at: '2026-10-05T03:00:00Z' });
    assert.equal(saved.entities.statusEvents.length, count, 'rename alone adds no status event');
    assert.equal(saved.entities.statusEvents.find(item => item.id === event.id).taskTitle, 'Renamed during transition');
    assert.equal(JSON.stringify(saved.entities.statusEvents.filter(event => event.entityId !== created.task.id)), legacy);
    const noOp = status.transition(saved, { entityId: created.task.id, entityType: 'task', to: 'in_progress', actor: 'Officer', at: '2026-10-05T02:00:00Z' });
    assert.equal(noOp.entities.statusEvents.length, count);
    for (const restored of [model.normalize(JSON.parse(JSON.stringify(saved))), model.normalize(JSON.parse(data.exportJson(saved, owner))), data.importBundle(data.exportBundle(saved, owner), null, { expectedApp: owner })]) {
      const ordered = events => JSON.parse(JSON.stringify(events)).sort((a, b) => a.id.localeCompare(b.id));
      assert.deepEqual(ordered(restored.entities.statusEvents), ordered(saved.entities.statusEvents));
      assert.equal(restored.schemaVersion, saved.schemaVersion);
    }
    const duplicate = planner.duplicateTasks(saved, projectId, [created.task.id]);
    const copied = status.reconcileMutation(saved, duplicate.workspace, { actor: 'Officer', at: '2026-10-05T04:00:00Z' });
    const ownEvents = copied.entities.statusEvents.filter(event => event.entityId === duplicate.tasks[0].id);
    assert.equal(ownEvents.length, 1);
    assert.equal(ownEvents[0].taskTitle, duplicate.tasks[0].title);
    assert.equal(duplicate.tasks[0].plannerResetEvents, undefined);
    const historical = JSON.parse(JSON.stringify(saved));
    historical.entities.statusEvents.forEach(entry => { delete entry.taskTitle; });
    const before = JSON.stringify(historical.entities.statusEvents);
    assert.equal(JSON.stringify(status.migrate(model.normalize(historical)).entities.statusEvents), before, 'load/migration does not invent historical names');
  });
}
