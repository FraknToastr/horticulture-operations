const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(owner = 'NSA') {
  const context = { console, structuredClone, TextEncoder, TextDecoder, URLSearchParams, crypto, setTimeout, clearTimeout };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: 'uos.horticulture.' + owner.toLowerCase(), workspaceKind: owner, owner }) } };
  vm.createContext(context);
  for (const file of ['src/shared/js/rate-library.js', 'src/shared/js/map-costing.js', ...['status.js', 'default-rate-catalog.js', 'model.js', 'status-model.js', 'funding-model.js', 'costing-model.js', 'quote-model.js', 'product-contracts.js', 'scheduler-model.js', 'work-area-service.js', 'data-health.js'].map(f => `src/program-planner/js/${f}`)]) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  const UOS = context.UOS, model = UOS.ProgramModel, api = UOS.ProgramCosting;
  let workspace = model.blank('2026-10-01T00:00:00Z');
  const record = { id: `${owner}-${owner === 'NSA' ? 'APP' : 'EVT'}-COMMAND`, owner, title: 'Command fixture', status: 'received', dateReceived: '2026-10-01' };
  workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
  const promoted = model.promoteRegisterRecord(workspace, record.id);
  workspace = UOS.ProgramStatus.migrate(promoted.workspace);
  for (const [id, kind, enabled] of [['RATE-COMMAND-LABOUR', 'Labour', undefined], ['RATE-COMMAND-MATERIAL', 'Material', undefined], ['RATE-COMMAND-OVERRIDE', 'Labour', false]]) {
    workspace = api.upsertRateItem(workspace, { id, description: kind + id, kind, category: kind, unit: 'unit', unitRate: 10, quantityMode: 'direct', schedulerEnabled: enabled });
  }
  return { UOS, model, api, workspace, projectId: promoted.project.id, context };
}

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: retries reuse work; intentional additions stay individual; costing-only Quotes include all lines`, () => {
    const { api, model, UOS, workspace, projectId } = fixture(owner);
    let first = api.createWork(workspace, projectId, 'RATE-COMMAND-LABOUR', { quantity: 2 }, { operationId: 'addition-a' });
    assert.equal(first.entities.jobs.length, workspace.entities.jobs.length + 1);
    let line = first.entities.costingLines.find(l => l.operationId === 'addition-a');
    const jobId = line.jobId;
    assert.equal(first.entities.jobs.find(j => j.id === jobId).startDate, '');
    first = api.createWork(first, projectId, line.rateItemId, { quantity: 2 }, { operationId: 'addition-a' });
    assert.equal(first.entities.costingLines.filter(l => l.operationId === 'addition-a').length, 1);
    first = api.createWork(first, projectId, line.rateItemId, { quantity: 1 }, { operationId: 'addition-b' });
    first = api.createWork(first, projectId, 'RATE-COMMAND-MATERIAL', { quantity: 3 }, { operationId: 'addition-c' });
    first = api.createWork(first, projectId, 'RATE-COMMAND-OVERRIDE', { quantity: 4 }, { operationId: 'addition-d' });
    assert.equal(first.entities.costingLines.filter(l => l.jobId).length, 2);
    assert.equal(api.totals(first.entities.costingLines).subtotal, 100);
    assert.equal(UOS.ProgramDataHealth.check(first).counts.error, 0, JSON.stringify(UOS.ProgramDataHealth.check(first).issues));
    const quoted = UOS.ProgramQuotes.saveDraft(first, { projectId, quoteDate: '2026-10-01', scopeNotes: 'All work', refreshCosts: true });
    assert.equal(quoted.entities.quoteLines.length, 4);
    model.assertValid(quoted);
    const reopened = model.normalize(JSON.parse(JSON.stringify(first)));
    assert.equal(reopened.entities.costingLines.find(l => l.id === line.id).jobId, jobId);
    const scheduled = UOS.ProgramSchedulerModel.scheduleJob(reopened, jobId, { startDate: '2026-10-02', endDate: '2026-10-02' });
    assert.equal(scheduled.entities.jobs.find(j => j.id === jobId).status, 'scheduled');
    model.assertValid(scheduled);
    assert.equal(workspace.entities.costingLines.length, 0, 'command does not mutate its input');
  });
}

test('job-only deletion suspends automation; explicit recreation is idempotent', () => {
  const { api, model, workspace, projectId } = fixture();
  let next = api.createWork(workspace, projectId, 'RATE-COMMAND-LABOUR', { quantity: 1 }, { operationId: 'delete-recreate' });
  const line = next.entities.costingLines[0];
  next = model.deleteJob(next, line.jobId);
  assert.equal(next.entities.costingLines[0].jobId, null);
  assert.equal(next.entities.costingLines[0].jobCreationSuspended, true);
  next = api.createWork(next, projectId, line.rateItemId, { quantity: 1 }, { operationId: 'delete-recreate' });
  assert.equal(next.entities.jobs.length, 0);
  next = api.recreateWorkJob(next, line.id);
  next = api.recreateWorkJob(next, line.id);
  assert.equal(next.entities.jobs.length, 1);
  assert.equal(next.entities.costingLines.length, 1);
  assert.equal(next.entities.jobs[0].status.toLowerCase(), 'draft');
});

test('malformed reciprocal, owner, Project and duplicate identities are rejected', () => {
  const { api, model, workspace, projectId } = fixture();
  const next = api.createWork(workspace, projectId, 'RATE-COMMAND-LABOUR', { quantity: 1 }, { operationId: 'bad-links' });
  for (const mutate of [w => w.entities.jobs[0].sourceCostingLineId = 'NSA-COST-MISSING', w => w.entities.jobs[0].sourceIdentity = 'wrong', w => w.entities.costingLines[0].owner = 'EVT', w => w.entities.jobs[0].projectId = 'NSA-PROJ-MISSING', w => w.entities.costingLines.push({ ...w.entities.costingLines[0], id: 'NSA-COST-DUPLICATE' })]) {
    const bad = JSON.parse(JSON.stringify(next)); mutate(bad);
    assert.throws(() => model.assertValid(bad));
    assert.throws(() => api.createWork(bad, projectId, 'RATE-COMMAND-LABOUR', { quantity: 1 }, { operationId: 'retry' }));
  }
});

test('category defaults and overrides persist; flag edits affect future additions only', () => {
  const { api, model, UOS, workspace, projectId } = fixture();
  assert.equal(api.schedulerEnabled(workspace.entities.rateItems.find(r => r.id === 'RATE-COMMAND-LABOUR')), true);
  assert.equal(api.schedulerEnabled(workspace.entities.rateItems.find(r => r.id === 'RATE-COMMAND-MATERIAL')), false);
  assert.equal(api.schedulerEnabled({ kind: 'Contractors' }), true);
  assert.equal(api.schedulerEnabled({ kind: 'Equipment' }), false);
  assert.equal(api.schedulerEnabled({ kind: 'Sundry', schedulerEnabled: true }), true);
  let next = api.createWork(workspace, projectId, 'RATE-COMMAND-LABOUR', { quantity: 1 }, { operationId: 'before-flag' });
  const jobId = next.entities.costingLines[0].jobId;
  next = api.upsertRateItem(next, { ...next.entities.rateItems.find(r => r.id === 'RATE-COMMAND-LABOUR'), schedulerEnabled: false });
  next = model.normalize(JSON.parse(JSON.stringify(next)));
  next = api.createWork(next, projectId, 'RATE-COMMAND-LABOUR', { quantity: 1 }, { operationId: 'before-flag' });
  next = api.createWork(next, projectId, 'RATE-COMMAND-LABOUR', { quantity: 1 }, { operationId: 'after-flag' });
  assert.equal(next.entities.costingLines.find(l => l.operationId === 'before-flag').jobId, jobId);
  assert.equal(next.entities.costingLines.find(l => l.operationId === 'after-flag').jobId, null);
  const library = UOS.rateLibrary.importCsv(api.exportRateCsv(next));
  assert.equal(library.items.find(r => r.id === 'RATE-COMMAND-LABOUR').schedulerEnabled, false);
});

test('recorded actual financial history and Budget charges protect job and line deletion', () => {
  const { api, model, workspace, projectId } = fixture();
  const next = api.createWork(workspace, projectId, 'RATE-COMMAND-LABOUR', { quantity: 1 }, { operationId: 'protected' });
  next.entities.jobs[0].actualCost = 10;
  const before = JSON.stringify(next);
  assert.throws(() => model.deleteJob(next, next.entities.jobs[0].id, { deleteCostingLine: true }), /financial history/);
  assert.throws(() => api.removeLine(next, next.entities.costingLines[0].id), /financial history/);
  assert.equal(JSON.stringify(next), before);
});

for (const owner of ['NSA', 'EVT']) {
 test(`${owner}: mapped costing respects flags, updates quantity, explicit Job creation and removal tombstones`, () => {
  const { UOS, api, model, workspace, projectId } = fixture(owner);
  const geometryId = owner + '-GEO-COMMAND';
  let next = api.upsertRateItemWithWorkType(workspace, { id: 'RATE-COMMAND-AREA', description: 'Area work', kind: 'Material', category: 'Material', unit: 'm²', unitRate: 2, quantityMode: 'm2', schedulerEnabled: false }, { enabled: true, workTypeKey: 'turfing' });
  next = UOS.WorkAreaService.createGeometry(next, projectId, { id: geometryId, workTypeKey: 'turfing', rateItemId: 'RATE-COMMAND-AREA', geometryKind: 'polygon', geometry: { type: 'Polygon', coordinates: [[[138.6,-34.92],[138.6,-34.9201],[138.6001,-34.9201],[138.6001,-34.92],[138.6,-34.92]]] }, payload: { valid: true, workTypeKey: 'turfing', rateItemId: 'RATE-COMMAND-AREA' } });
  next = UOS.WorkAreaService.syncGeometry(next, geometryId);
  next = UOS.WorkAreaService.syncGeometry(next, geometryId);
  assert.equal(next.entities.costingLines.length, 1);
  const firstQuantity = next.entities.costingLines[0].quantity;
  const firstLineId = next.entities.costingLines[0].id;
  next = UOS.WorkAreaService.updateGeometry(next, geometryId, { geometry: { type: 'Polygon', coordinates: [[[138.6,-34.92],[138.6,-34.9202],[138.6002,-34.9202],[138.6002,-34.92],[138.6,-34.92]]] } });
  next = UOS.WorkAreaService.syncGeometry(next, geometryId);
  assert.equal(next.entities.costingLines[0].id, firstLineId);
  assert.ok(next.entities.costingLines[0].quantity > firstQuantity * 3);
  next = api.upsertRateItem(next, { ...next.entities.rateItems.find(r => r.id === 'RATE-COMMAND-AREA'), schedulerEnabled: true });
  next = UOS.WorkAreaService.syncGeometry(next, geometryId);
  assert.equal(next.entities.jobs.length, 0, 'changing flags affects future additions only');

  assert.equal(next.entities.jobs.length, 0);
  assert.equal(UOS.ProgramDataHealth.check(next).counts.error, 0, JSON.stringify(UOS.ProgramDataHealth.check(next).issues));
  next = UOS.WorkAreaService.syncGeometry(next, geometryId, { explicit: true });
  assert.equal(next.entities.jobs.length, 1);
  const sourceLineId = next.entities.costingLines[0].id;
  assert.equal(next.entities.costingLines[0].sourceGeometryId, geometryId);
  next = model.deleteJob(next, next.entities.jobs[0].id);
  next = UOS.WorkAreaService.syncGeometry(next, geometryId);
  assert.equal(next.entities.jobs.length, 0);
  next = api.recreateWorkJob(next, sourceLineId);
  next = model.deleteJob(next, next.entities.jobs[0].id, { deleteCostingLine: true });
  assert.equal(next.entities.geometries[0].workRemoved, true, 'removal marker persists through normalization');
  next = UOS.WorkAreaService.syncGeometry(next, geometryId);
  assert.equal(next.entities.costingLines.length, 0);
  assert.equal(next.entities.geometries.length, 1);
  next = UOS.WorkAreaService.syncGeometry(next, geometryId, { explicit: true });
  assert.equal(next.entities.jobs.length, 1);
  assert.notEqual(next.entities.costingLines[0].id, sourceLineId);
  model.assertValid(next);
});

}


function historicalWork() {
  const f = fixture();
  let next = f.api.createWork(f.workspace, f.projectId, 'RATE-COMMAND-LABOUR', { quantity: 2 }, { operationId: 'historical' });
  const line = next.entities.costingLines[0], job = next.entities.jobs[0];
  for (const item of [line, job]) {
    delete item.workCommandVersion;
    delete item.sourceIdentity;
  }
  delete job.sourceCostingLineId;
  next.entities.costingLines.push({ ...line, id: line.id + '-SECOND', quantity: 1, estimatedTotal: 10 });
  next = f.model.normalize(next);
  f.model.assertValid(next);
  return { ...f, next, jobId: job.id, lineId: line.id };
}

test('historical aggregate deletion retains all lines by default and explicitly removes all on request', () => {
  const { model, api, next, jobId, lineId } = historicalWork();
  const before = JSON.stringify(next);
  const kept = model.deleteJob(next, jobId);
  assert.equal(kept.entities.jobs.length, 0);
  assert.equal(kept.entities.costingLines.length, 2);
  for (const line of kept.entities.costingLines) {
    assert.equal(line.jobId, null);
    assert.equal(line.assignmentState, 'Unassigned');
    assert.equal(line.jobCreationSuspended, true);
    assert.equal(line.workCommandVersion, undefined, 'historical records are not converted');
  }
  model.assertValid(kept);
  const recreated = api.recreateWorkJob(api.recreateWorkJob(kept, lineId), lineId);
  assert.equal(recreated.entities.jobs.length, 1);
  assert.equal(recreated.entities.jobs[0].status, 'draft');
  assert.equal(recreated.entities.jobs[0].startDate, '');
  assert.equal(recreated.entities.costingLines[1].jobId, null, 'other historical lines keep their independent suspension');
  const removed = model.deleteJob(next, jobId, { deleteCostingLine: true });
  assert.equal(removed.entities.jobs.length, 0);
  assert.equal(removed.entities.costingLines.length, 0);
  assert.equal(JSON.stringify(next), before);
  model.assertValid(removed);
});

test('historical linked work protects actuals, Budget charges, issued Quotes and payments for both choices', () => {
  const { model, next, jobId, lineId } = historicalWork();
  for (const deleteCostingLine of [false, true]) {
    for (const protection of ['actual', 'budget', 'issued', 'payment']) {
      const ws = JSON.parse(JSON.stringify(next));
      if (protection === 'actual') ws.entities.costingLines[1].actualCost = 5;
      if (protection === 'budget') ws.entities.budgetCharges.push({ id: model.stableId('NSA', 'budgetCharge', 'protected'), owner: 'NSA', jobId, amount: 5 });
      if (['issued', 'payment'].includes(protection)) {
        ws.entities.quotes.push({ id: 'NSA-QUOTE-PROTECTED', owner: 'NSA', projectId: ws.entities.jobs[0].projectId, status: protection === 'issued' ? 'Issued' : 'Draft' });
        ws.entities.quoteLines.push({ id: model.stableId('NSA', 'quoteLine', 'protected'), owner: 'NSA', quoteId: 'NSA-QUOTE-PROTECTED', projectId: ws.entities.jobs[0].projectId, total: 20, jobId, costingLineId: lineId });
      }
      if (protection === 'payment') ws.entities.paymentAllocations.push({ id: model.stableId('NSA', 'paymentAllocation', 'protected'), owner: 'NSA', projectId: ws.entities.jobs[0].projectId, quoteId: 'NSA-QUOTE-PROTECTED', amount: 5, quoteLineId: model.stableId('NSA', 'quoteLine', 'protected') });
      const before = JSON.stringify(ws);
      assert.throws(() => model.deleteJob(ws, jobId, { deleteCostingLine }), /protect|cannot be deleted/i, protection);
      assert.equal(JSON.stringify(ws), before);
    }
  }
});


for (const historical of [false, true]) {
  test(`geometry updates respect retained suspension and deliberate removal: historical=${historical}`, () => {
    const { UOS, api, model, workspace, projectId } = fixture();
    let next = api.upsertRateItemWithWorkType(workspace, { id: 'RATE-GEOMETRY-DELETE', description: 'Area deletion', kind: 'Labour', category: 'Labour', unit: 'm²', unitRate: 2, quantityMode: 'm2', schedulerEnabled: true }, { enabled: true, workTypeKey: 'turfing' });
    const geometryId = 'NSA-GEO-DELETE-UPDATE';
    const polygon = size => ({ type: 'Polygon', coordinates: [[[138.6,-34.92],[138.6,-34.92-size],[138.6+size,-34.92-size],[138.6+size,-34.92],[138.6,-34.92]]] });
    next = UOS.WorkAreaService.createGeometry(next, projectId, { id: geometryId, workTypeKey: 'turfing', rateItemId: 'RATE-GEOMETRY-DELETE', geometryKind: 'polygon', geometry: polygon(0.0001), payload: { valid: true, workTypeKey: 'turfing', rateItemId: 'RATE-GEOMETRY-DELETE' } });
    next = UOS.WorkAreaService.syncGeometry(next, geometryId);
    if (historical) {
      for (const item of [next.entities.jobs[0], next.entities.costingLines[0]]) { delete item.workCommandVersion; delete item.sourceIdentity; }
      delete next.entities.jobs[0].sourceCostingLineId;
      next = model.normalize(next);
    }
    const lineId = next.entities.costingLines[0].id, quantity = next.entities.costingLines[0].quantity;
    next = model.deleteJob(next, next.entities.jobs[0].id);
    next = UOS.WorkAreaService.updateGeometry(next, geometryId, { geometry: polygon(0.0002) });
    next = UOS.WorkAreaService.syncGeometry(next, geometryId);
    assert.equal(next.entities.jobs.length, 0);
    assert.equal(next.entities.costingLines.length, 1);
    assert.equal(next.entities.costingLines[0].jobCreationSuspended, true);
    assert.ok(next.entities.costingLines[0].quantity > quantity * 3);
    next = api.recreateWorkJob(next, lineId);
    next = model.deleteJob(next, next.entities.jobs[0].id, { deleteCostingLine: true });
    next = UOS.WorkAreaService.updateGeometry(next, geometryId, { geometry: polygon(0.0003) });
    next = UOS.WorkAreaService.syncGeometry(next, geometryId);
    assert.equal(next.entities.geometries.length, 1);
    assert.equal(next.entities.geometries[0].workRemoved, true);
    assert.equal(next.entities.jobs.length, 0);
    assert.equal(next.entities.costingLines.length, 0);
    model.assertValid(next);
  });
}


test('schedule edits preserve recorded delivery completion independently of confirmation', () => {
  const { api, model, UOS, workspace, projectId } = fixture();
  let next = api.createWork(workspace, projectId, 'RATE-COMMAND-LABOUR', { quantity: 1 }, { operationId: 'delivery-status' });
  const jobId = next.entities.jobs[0].id;
  next = UOS.ProgramSchedulerModel.scheduleJob(next, jobId, { startDate: '2026-10-02', endDate: '2026-10-02' });
  next.entities.jobs[0].status = 'completed';
  next.entities.jobs[0].actualCost = 10;
  next = UOS.ProgramSchedulerModel.scheduleJob(next, jobId, { startDate: '2026-10-03', endDate: '2026-10-03' });
  assert.equal(next.entities.jobs[0].status, 'completed');
  model.assertValid(next);
});
