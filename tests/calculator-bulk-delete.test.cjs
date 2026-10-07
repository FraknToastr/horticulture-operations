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
  for (const historical of [false, true]) test(`${owner}: mapped bulk deletion preserves existing geometry semantics, historical=${historical}`, () => {
    const { UOS, api, model, workspace, projectId } = fixture(owner);
    const geometryId = owner + '-GEO-BULK';
    let ws = api.upsertRateItemWithWorkType(workspace, { id: 'RATE-BULK-AREA', description: 'Area work', kind: 'Material', kindSource: 'user', category: 'Material', unit: 'm²', unitRate: 2, quantityMode: 'm2', schedulerEnabled: true }, { enabled: true, workTypeKey: 'turfing' });
    ws = UOS.WorkAreaService.createGeometry(ws, projectId, { id: geometryId, workTypeKey: 'turfing', rateItemId: 'RATE-BULK-AREA', geometryKind: 'polygon', geometry: { type: 'Polygon', coordinates: [[[138.6,-34.92],[138.6,-34.9201],[138.6001,-34.9201],[138.6001,-34.92],[138.6,-34.92]]] }, payload: { valid: true, workTypeKey: 'turfing', rateItemId: 'RATE-BULK-AREA' } });
    ws = UOS.WorkAreaService.syncGeometry(ws, geometryId);
    const jobId = ws.entities.jobs[0].id;
    if (historical) {
      for (const item of [ws.entities.jobs[0], ws.entities.costingLines[0]]) { delete item.workCommandVersion; delete item.sourceIdentity; }
      delete ws.entities.jobs[0].sourceCostingLineId;
    }
    const result = api.removeLines(ws, projectId, 'All');
    assert.equal(result.deletedIds.length, 1);
    assert.equal(result.retained.length, 0);
    assert.equal(result.affectedJobIds[0], jobId);
    assert.equal(result.affectedGeometryIds[0], geometryId);
    assert.equal(result.workspace.entities.geometries.length, historical ? 0 : 1);
    if (!historical) {
      assert.equal(result.workspace.entities.geometries[0].workRemoved, true);
      const refreshed = UOS.WorkAreaService.syncGeometry(result.workspace, geometryId);
      assert.equal(refreshed.entities.costingLines.length, 0);
      assert.equal(refreshed.entities.jobs.length, 0);
    }
    model.assertValid(result.workspace);
  });
  test(`${owner}: bulk kinds, shared classification and project isolation`, () => {
    const { UOS, api, model, workspace, projectId } = fixture(owner);
    let ws = workspace;
    for (const kind of api.categories) {
      ws = api.upsertRateItem(ws, { id: `RATE-BULK-${kind}`, kind, kindSource: 'user', category: 'Preparation', description: kind + ' work', unit: 'each', unitRate: 10, active: true, schedulerEnabled: false });
      ws = api.createWork(ws, projectId, `RATE-BULK-${kind}`, { quantity: 1 }, { operationId: kind });
    }
    const otherRecord = { id: `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-OTHER-BULK`, owner, title: 'Other project', status: 'received' };
    ws.entities[owner === 'NSA' ? 'applications' : 'events'].push(otherRecord);
    const promoted = model.promoteRegisterRecord(ws, otherRecord.id);
    ws = api.createWork(UOS.ProgramStatus.migrate(promoted.workspace), promoted.project.id, 'RATE-BULK-Material', { quantity: 1 }, { operationId: 'other-project' });
    const original = JSON.stringify(ws);
    for (const kind of api.categories) {
      const result = api.removeLines(ws, projectId, kind);
      assert.equal(result.deletedIds.length, 1);
      assert.equal(result.retained.length, 0);
      assert.equal(result.workspace.entities.costingLines.filter(l => l.projectId === promoted.project.id).length, 1);
      assert.equal(result.workspace.entities.rateItems.length, ws.entities.rateItems.length);
      model.assertValid(result.workspace);
    }
    const all = api.removeLines(ws, projectId, 'All');
    assert.equal(all.deletedIds.length, 5);
    assert.equal(all.workspace.entities.costingLines.length, 1);
    assert.equal(api.removeLines(all.workspace, projectId, 'All').deletedIds.length, 0);
    assert.equal(JSON.stringify(ws), original);
    assert.throws(function () { api.removeLines(ws, projectId, 'Unknown'); }, /supported/);
  });

  test(`${owner}: partial deletion retains actuals and recalculates editable Drafts`, () => {
    const { UOS, api, model, workspace, projectId } = fixture(owner);
    let ws = api.createWork(workspace, projectId, 'RATE-COMMAND-MATERIAL', { quantity: 2 }, { operationId: 'protected-actual' });
    ws.entities.costingLines[0].actualCost = 5;
    ws = api.createWork(ws, projectId, 'RATE-COMMAND-MATERIAL', { quantity: 3 }, { operationId: 'eligible-draft' });
    ws = UOS.ProgramQuotes.saveDraft(ws, { projectId, quoteDate: '2026-10-02', fundingMode: 'mixed', proposedCustomerContribution: 90 });
    const result = api.removeLines(ws, projectId, 'All');
    assert.equal(result.deletedIds.length, 1);
    assert.equal(result.retained.length, 1);
    assert.match(result.retained[0].reason, /actual financial history/);
    assert.equal(result.workspace.entities.quoteLines.length, 1);
    assert.equal(result.workspace.entities.quotes[0].subtotal, 20);
    assert.equal(result.workspace.entities.quotes[0].proposedCustomerContribution, 90);
    model.assertValid(result.workspace);
  });

  for (const protection of ['Issued', 'Accepted', 'Declined', 'Superseded', 'payment', 'allocation', 'budget', 'planner']) {
    test(`${owner}: bulk deletion retains ${protection} protections`, () => {
      const { UOS, api, model, workspace, projectId } = fixture(owner);
      let ws = api.createWork(workspace, projectId, protection === 'planner' ? 'RATE-COMMAND-LABOUR' : 'RATE-COMMAND-MATERIAL', { quantity: 1 }, { operationId: 'protected' });
      const protectedLine = ws.entities.costingLines[0];
      if (['Issued', 'Accepted', 'Declined', 'Superseded', 'payment', 'allocation'].includes(protection)) {
        ws = UOS.ProgramQuotes.saveDraft(ws, { projectId, quoteDate: '2026-10-02' });
        const quoteId = ws.entities.quotes[0].id;
        if (['Issued', 'Accepted', 'Declined', 'Superseded'].includes(protection)) {
          ws = UOS.ProgramQuotes.issue(ws, quoteId);
          if (protection === 'Accepted') ws = UOS.ProgramQuotes.accept(ws, quoteId);
          if (protection === 'Declined') ws = UOS.ProgramQuotes.decline(ws, quoteId);
          if (protection === 'Superseded') ws = UOS.ProgramQuotes.createRevision(ws, quoteId);
        } else {
          ws = UOS.ProgramQuotes.recordPayment(ws, { quoteId, method: 'Bank transfer', amount: 1, reference: 'Bulk payment', paymentDate: '2026-10-02' });
          if (protection === 'allocation') ws.entities.paymentAllocations.push({ id: `${owner}-PALLOC-BULK`, owner, type: 'paymentAllocation', projectId, paymentId: ws.entities.payments[0].id, quoteId, quoteLineId: ws.entities.quoteLines[0].id, amount: 1 });
        }
      }
      if (protection === 'budget') ws.entities.budgetCharges.push({ id: `${owner}-BCHARGE-BULK`, owner, type: 'budgetCharge', projectId, costingLineId: protectedLine.id, amount: 1 });
      if (protection === 'planner') ws.entities.tasks[0].jobId = protectedLine.jobId;
      ws = api.createWork(ws, projectId, 'RATE-COMMAND-MATERIAL', { quantity: 1 }, { operationId: 'eligible' });
      const result = api.removeLines(ws, projectId, 'All');
      assert.equal(result.deletedIds.length, 1);
      assert.equal(result.retained.length, 1);
      assert.equal(result.retained[0].id, protectedLine.id);
      assert(result.workspace.entities.costingLines.some(l => l.id === protectedLine.id));
      model.assertValid(result.workspace);
    });
  }
}
