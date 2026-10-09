const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function openDrawing(page, owner) {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(item => item !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const ids = await frame.evaluate(async owner => {
    let ids;
    await UOS.ProgramApp.updateWorkspace(workspace => {
      const collection = owner === 'NSA' ? 'applications' : 'events';
      const id = `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-DRAWING`;
      workspace.entities[collection].push({ id, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Drawing lifecycle', status: 'received', dateReceived: '2026-10-09' });
      const result = UOS.ProgramModel.promoteRegisterRecord(workspace, id);
      const next = UOS.ProgramStatus.migrate(result.workspace);
      next.workspace.selectedEntityId = id;
      next.workspace.selectedProjectId = result.project.id;
      ids = { recordId: id, projectId: result.project.id };
      return next;
    });
    await UOS.ProgramApp.navigate('map');
    return ids;
  }, owner);
  await frame.locator('[data-map-scope="projects"]').click();
  await frame.locator('[data-edit-event-id]').filter({ hasText: 'Add Polygons' }).first().click();
  return { frame, ids, errors };
}

async function point(frame, x, y) {
  const canvas = frame.locator('.maplibregl-canvas');
  const rect = await canvas.boundingBox();
  await canvas.click({ position: { x: rect.width * x, y: rect.height * y } });
}


for (const owner of ['NSA','EVT']) {
 test(owner+': inspector hectare choice and manual area use canonical m²', async ({page})=>{
  const {frame,errors}=await openDrawing(page,owner);
  await frame.locator('#startDrawingButton').click();
  await point(frame,.35,.55);await point(frame,.65,.55);await point(frame,.5,.8);
  await frame.locator('#finishDrawingButton').click();
  const card=frame.locator('[data-shape-card-id]').first();
  await expect(card.locator('[data-shape-rate]')).toBeEnabled();
  await card.locator('[data-shape-pricing-unit]').selectOption('ha');
  await expect(card.locator('[data-shape-rate]')).toHaveValue('RATE-TURFING-HA');
  await card.locator('[data-create-shape-job]').click();
  await expect(card.locator('[data-create-shape-job]')).toHaveClass(/is-created/);
  const mapped=await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.costingLines[0]);
  expect(mapped.unit).toBe('ha');expect(mapped.unitRate).toBe(112500);
  expect(Math.abs(mapped.quantity-mapped.sourceAreaSqM/10000)).toBeLessThan(.000001);
  await frame.evaluate(async()=>{await UOS.ProgramApp.navigate('costing');});
  await frame.locator('[data-costing-section="Material"]').click();
  const add=frame.locator('[data-costing-add-rate="RATE-TURFING-HA"]');
  await expect(add).toBeVisible();await add.click();
  const form=frame.locator('[data-costing-area-form]');
  await expect(form).toBeVisible();
  await form.locator('[name="area"]').fill('1');
  await form.locator('[name="areaUnit"]').selectOption('ha');
  await form.locator('[type="submit"]').click();
  await expect(form).not.toBeVisible();
  const manual=await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.costingLines.find(l=>l.sourceKind==='calculator'));
  expect(manual.quantity).toBe(1);expect(manual.sourceAreaSqM).toBe(10000);expect(manual.estimatedTotal).toBe(112500);
  await page.reload();
  const restored=page.frames().find(f=>f!==page.mainFrame());await restored.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');
  expect(await restored.evaluate(id=>UOS.ProgramApp.workspace().entities.costingLines.find(l=>l.id===id).sourceAreaSqM,manual.id)).toBe(10000);
  expect(errors).toEqual([]);
 });
}

for (const owner of ['NSA','EVT']) {
 test(owner+': legacy rate IDs recover in the Inspector and edited ha prices survive reload',async({page})=>{
  const {frame,errors}=await openDrawing(page,owner);
  await frame.evaluate(async()=>UOS.ProgramApp.updateWorkspace(w=>{
   const rate=w.entities.rateItems.find(r=>r.id==='RATE-TURFING');
   w.entities.rateItems=w.entities.rateItems.filter(r=>!r.id.startsWith('RATE-TURFING'));
   rate.id='RATE-RECOVERED-TURF';rate.measurementSource='mapped';
   rate.provenance={migrationKind:'catalog-rate-clone',sourceId:'RATE-TURFING'};w.entities.rateItems.push(rate);
   w.referenceData.shared.workTypeRateItems.turfing={eligibleRateItemIds:['RATE-TURFING'],defaultRateItemId:'RATE-TURFING'};
   return w;
  }));
  await frame.locator('#startDrawingButton').click();
  await point(frame,.35,.55);await point(frame,.65,.55);await point(frame,.5,.8);
  await frame.locator('#finishDrawingButton').click();
  const card=frame.locator('[data-shape-card-id]').first();
  await expect(card.locator('[data-shape-rate]')).toHaveValue('RATE-RECOVERED-TURF');
  await card.locator('[data-shape-pricing-unit]').selectOption('ha');
  await expect(card.locator('[data-shape-rate]')).toHaveValue('RATE-RECOVERED-TURF-HA');
  await frame.evaluate(async()=>UOS.ProgramApp.updateWorkspace(w=>{
   const r=w.entities.rateItems.find(r=>r.id==='RATE-RECOVERED-TURF-HA');
   return UOS.ProgramCosting.upsertRateItemWithWorkType(w,{...r,unitRate:1234},{enabled:true,workTypeKey:'turfing'});
  }));
  await page.reload();const restored=page.frames().find(f=>f!==page.mainFrame());await restored.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');
  expect(await restored.evaluate(()=>UOS.ProgramApp.workspace().entities.rateItems.find(r=>r.id==='RATE-RECOVERED-TURF-HA').unitRate)).toBe(1234);
  expect(errors).toEqual([]);
 });
}
