const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Status = require('../src/program-planner/js/status.js');
const copy = value => JSON.parse(JSON.stringify(value));

function workspace(owner = 'NSA', sourceKind = 'planner') {
  const register = { id: owner + '-REGISTER-1', owner, type: owner === 'NSA' ? 'application' : 'event', status: 'received' };
  return { schemaVersion: 5, workspaceRevision: 1, statusControl: { automationEnabled: true }, entities: {
    applications: owner === 'NSA' ? [register] : [], events: owner === 'EVT' ? [register] : [],
    projects: [{ id: owner + '-PROJ-1', type: 'project', owner, status: 'planning', [owner === 'NSA' ? 'applicationId' : 'eventId']: register.id }],
    jobs: [{ id: owner + '-JOB-1', type: 'job', owner, projectId: owner + '-PROJ-1', sourceKind, status: 'draft', startDate: '2026-10-05', endDate: '2026-10-05', allDay: true, updatesApplicationStatus: false }],
    tasks: [], quotes: [], statusEvents: [], statusRecommendations: []
  } };
}
const register = ws => ws.entities.applications[0] || ws.entities.events[0];
function mutate(before, fn) { const next = copy(before); fn(next); return Status.runAutomatic(next, { before, at: '2026-10-02T01:00:00Z', initiatingOperator: 'A. Officer' }); }

for (const owner of ['NSA', 'EVT']) for (const source of ['planner', 'calculator', 'space-map']) {
  test(`${owner} ${source}: incidental scheduling and starting do not advance the application`, () => {
    let ws = workspace(owner, source);
    ws = mutate(ws, w => { w.entities.jobs[0].status = 'scheduled'; });
    assert.equal(register(ws).status, 'received');
    ws = mutate(ws, w => { w.entities.jobs[0].status = 'in_progress'; });
    assert.equal(register(ws).status, 'received');
    assert.equal(ws.entities.statusEvents.length, 0);
  });
  test(`${owner} ${source}: nomination advances on schedule or an already saved Scheduled job`, () => {
    const before = workspace(owner, source);
    const ws = mutate(before, w => { Object.assign(w.entities.jobs[0], { status: 'scheduled', updatesApplicationStatus: true }); });
    assert.equal(register(ws).status, 'scheduled');
    const event = ws.entities.statusEvents[0];
    assert.equal(event.source, 'automatic');
    assert.equal(event.actor, 'Status engine');
    assert.equal(event.initiatingOperator, 'A. Officer');
    assert.ok(event.action.includes(ws.entities.jobs[0].id));
    assert.equal(Status.runAutomatic(ws, { before: ws }).entities.statusEvents.length, 1);
    const scheduled = mutate(before, w => { w.entities.jobs[0].status = 'scheduled'; });
    const nominated = mutate(scheduled, w => { w.entities.jobs[0].updatesApplicationStatus = true; });
    assert.equal(register(nominated).status, 'scheduled');
    const started = mutate(nominated, w => { w.entities.jobs[0].status = 'in_progress'; });
    assert.equal(register(started).status, owner === 'NSA' ? 'in_progress' : 'scheduled');
  });
}

test('NSA already In Progress nomination advances, other job states do not', () => {
  for (const status of ['draft', 'in_progress', 'completed', 'cancelled', 'review_required']) {
    const before = workspace(); before.entities.jobs[0].status = status;
    const next = mutate(before, w => { w.entities.jobs[0].updatesApplicationStatus = true; });
    assert.equal(register(next).status, status === 'in_progress' ? 'in_progress' : 'received', status);
  }
});

test('later and terminal application statuses are preserved', () => {
  for (const owner of ['NSA', 'EVT']) for (const status of owner === 'NSA' ? ['scheduled', 'in_progress', 'complete', 'cancelled', 'review_required'] : ['scheduled', 'completed', 'cancelled', 'review_required']) {
    const before = workspace(owner); register(before).status = status;
    const next = mutate(before, w => { Object.assign(w.entities.jobs[0], { status: 'scheduled', updatesApplicationStatus: true }); });
    assert.equal(register(next).status, status);
    assert.deepEqual(next.entities.statusEvents, []);
  }
});

test('multiple nominations, unticking, cancellation and deletion never reverse application status', () => {
  let ws = workspace();
  ws.entities.jobs.push({ ...ws.entities.jobs[0], id: 'NSA-JOB-2' });
  ws = mutate(ws, w => { w.entities.jobs.forEach(j => { j.status = 'scheduled'; j.updatesApplicationStatus = true; }); });
  assert.equal(register(ws).status, 'scheduled');
  assert.equal(ws.entities.statusEvents.length, 1);
  ws = mutate(ws, w => { w.entities.jobs[0].updatesApplicationStatus = false; });
  ws = mutate(ws, w => { w.entities.jobs[1].status = 'cancelled'; });
  ws = mutate(ws, w => { w.entities.jobs = []; });
  assert.equal(register(ws).status, 'scheduled');
  assert.equal(ws.entities.statusEvents.length, 1);
});

test('pause guards stop nomination signals and resumption does not replay them', () => {
  for (const pause of ['workspace', 'application', 'job']) {
    let ws = workspace();
    if (pause === 'workspace') ws.statusControl.automationEnabled = false;
    else (pause === 'application' ? register(ws) : ws.entities.jobs[0]).statusAutomationPaused = true;
    ws = mutate(ws, w => { Object.assign(w.entities.jobs[0], { status: 'scheduled', updatesApplicationStatus: true }); });
    assert.equal(register(ws).status, 'received');
    ws = mutate(ws, w => { w.statusControl.automationEnabled = true; register(w).statusAutomationPaused = false; w.entities.jobs[0].statusAutomationPaused = false; });
    assert.equal(register(ws).status, 'received');
    ws = mutate(ws, w => { w.entities.jobs[0].status = 'in_progress'; });
    assert.equal(register(ws).status, 'in_progress');
  }
});

test('missing linkage, conflicting ownership and invalid saved schedules cannot advance applications', () => {
  for (const change of [
    w => { w.entities.jobs[0].projectId = 'missing'; },
    w => { w.entities.projects[0].applicationId = 'missing'; },
    w => { w.entities.jobs[0].owner = 'EVT'; },
    w => { w.entities.jobs[0].startDate = ''; },
    w => { w.entities.jobs[0].endDate = ''; },
    w => { w.entities.jobs[0].startDate = '2026-02-30'; },
    w => { w.entities.jobs[0].endDate = '2026-10-04'; },
    w => { Object.assign(w.entities.jobs[0], { allDay: false, startTime: '10:00', endTime: '09:00' }); },
    w => { Object.assign(w.entities.jobs[0], { allDay: false, startTime: '25:00', endTime: '26:00' }); }
  ]) {
    const ws = mutate(workspace(), w => { Object.assign(w.entities.jobs[0], { status: 'scheduled', updatesApplicationStatus: true }); change(w); });
    assert.equal(register(ws).status, 'received');
    assert.equal(ws.entities.statusEvents.length, 0);
  }
  const timed = mutate(workspace(), w => { Object.assign(w.entities.jobs[0], { status: 'scheduled', updatesApplicationStatus: true, allDay: false, startTime: '09:00', endTime: '10:00' }); });
  assert.equal(register(timed).status, 'scheduled');
});

test('legacy jobs remain unchecked and load or migration never replays nominated historical jobs', () => {
  const legacy = workspace(); legacy.entities.jobs[0].status = 'scheduled'; delete legacy.entities.jobs[0].updatesApplicationStatus;
  legacy.entities.statusEvents.push({ id: 'existing-history', action: 'Prior history' });
  const loaded = Status.migrate(legacy);
  assert.equal(loaded.entities.jobs[0].updatesApplicationStatus, false);
  assert.equal(register(loaded).status, 'received');
  assert.deepEqual(loaded.entities.statusEvents, legacy.entities.statusEvents);
  loaded.entities.jobs[0].updatesApplicationStatus = true;
  assert.equal(register(Status.runAutomatic(loaded)).status, 'received');
  assert.equal(register(Status.migrate(loaded)).status, 'received');
});

function fixture(owner, source) {
  const context = { console, structuredClone, TextEncoder, TextDecoder, URLSearchParams, crypto, setTimeout, clearTimeout };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: 'uos.horticulture.' + owner.toLowerCase(), workspaceKind: owner, owner }) } };
  vm.createContext(context);
  for (const file of ['src/shared/js/rate-library.js', 'src/shared/js/map-costing.js', ...['status.js', 'default-rate-catalog.js', 'model.js', 'status-model.js', 'costing-model.js', 'product-contracts.js', 'planner-model.js', 'scheduler-model.js', 'work-area-service.js'].map(f => 'src/program-planner/js/' + f)]) vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  const UOS = context.UOS, model = UOS.ProgramModel;
  const registerId = owner === 'NSA' ? 'NSA-APP-NOMINATION' : 'EVT-EVENT-NOMINATION';
  let ws = model.blank('2026-10-02T00:00:00Z');
  ws.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id: registerId, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Main works', status: 'received', dateReceived: '2026-10-02' });
  const promoted = model.promoteRegisterRecord(ws, registerId);
  ws = UOS.ProgramStatus.migrate(promoted.workspace);
  ws.statusControl.automationEnabled = true;
  if (source === 'planner') {
    const saved = UOS.ProgramPlannerModel.saveTask(ws, promoted.project.id, null, { title: 'Main works', description: 'Deliver main works', section: 'Planning and Approval', operational: true, status: 'Not Started' });
    ws = UOS.ProgramPlannerModel.createDraftJob(saved.workspace, promoted.project.id, saved.task.id).workspace;
  } else {
    const rate = { id: 'RATE-NOMINATION', description: 'Main works', kind: 'Labour', category: 'Labour', unit: source === 'space-map' ? 'm²' : 'unit', unitRate: 10, quantityMode: source === 'space-map' ? 'm2' : 'direct', schedulerEnabled: true };
    ws = source === 'space-map' ? UOS.ProgramCosting.upsertRateItemWithWorkType(ws, rate, { enabled: true, workTypeKey: 'turfing' }) : UOS.ProgramCosting.upsertRateItem(ws, rate);
    if (source === 'calculator') ws = UOS.ProgramCosting.createWork(ws, promoted.project.id, 'RATE-NOMINATION', { quantity: 1 }, { operationId: 'nomination-test' });
    else {
      ws = UOS.WorkAreaService.createGeometry(ws, promoted.project.id, { id: owner + '-GEO-NOMINATION', workTypeKey: 'turfing', rateItemId: 'RATE-NOMINATION', geometryKind: 'polygon', geometry: { type: 'Polygon', coordinates: [[[138.6,-34.92],[138.6,-34.9201],[138.6001,-34.9201],[138.6001,-34.92],[138.6,-34.92]]] }, payload: { valid: true, workTypeKey: 'turfing', rateItemId: 'RATE-NOMINATION' } });
      ws = UOS.WorkAreaService.syncGeometry(ws, owner + '-GEO-NOMINATION');
    }
  }
  return { UOS, model, ws };
}

for (const owner of ['NSA', 'EVT']) for (const source of ['planner', 'calculator', 'space-map']) test(`${owner} actual ${source} creation, scheduling command validation and save/reload`, () => {
  const { UOS, model, ws } = fixture(owner, source);
  assert.equal(ws.entities.jobs.length, 1);
  const id = ws.entities.jobs[0].id;
  assert.equal(ws.entities.jobs[0].updatesApplicationStatus, false);
  assert.equal(ws.entities.jobs[0].sourceKind, source);
  const scheduled = UOS.ProgramSchedulerModel.scheduleJob(ws, id, { startDate: '2026-10-05', endDate: '2026-10-05', allDay: true });
  const incidental = UOS.ProgramStatus.runAutomatic(scheduled, { before: ws });
  assert.equal(register(incidental).status, 'received');
  const nominated = UOS.ProgramSchedulerModel.scheduleJob(incidental, id, { updatesApplicationStatus: true });
  const saved = UOS.ProgramStatus.runAutomatic(nominated, { before: incidental });
  assert.equal(register(saved).status, 'scheduled');
  const loaded = model.normalize(copy(saved));
  assert.equal(loaded.entities.jobs[0].updatesApplicationStatus, true);
  assert.deepEqual(copy(loaded.entities.statusEvents), copy(model.normalize(saved).entities.statusEvents));
  assert.equal(ws.entities.jobs[0].updatesApplicationStatus, false, 'command leaves its input untouched');
  assert.throws(() => UOS.ProgramSchedulerModel.scheduleJob(incidental, id, { updatesApplicationStatus: 'true' }), /boolean/);
  assert.throws(() => UOS.ProgramSchedulerModel.scheduleJob(incidental, id, { startDate: '', updatesApplicationStatus: true }), /startDate/);
  const unchecked = UOS.ProgramSchedulerModel.scheduleJob(saved, id, { updatesApplicationStatus: false });
  assert.equal(register(UOS.ProgramStatus.runAutomatic(unchecked, { before: saved })).status, 'scheduled');
});
