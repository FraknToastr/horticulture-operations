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
  await frame.waitForFunction(()=>UOS.ProgramMapController.getMapController()?.ready());
  return { frame, ids, errors };
}

async function point(frame, x, y) {
  const canvas = frame.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  const rect = await canvas.boundingBox();
  await canvas.click({ position: { x: rect.width * x, y: rect.height * y } });
}


const path=require('node:path');
for(const owner of ['NSA','EVT']){
 test(owner+': Moasure import, rigid drag, rotation, confirmation, job creation and reload',async({page})=>{
  const {frame,errors}=await openDrawing(page,owner);
  await frame.locator('#moasureImportButton').click();
  await frame.locator('#moasureCsvFile').setInputFiles(path.resolve('tests/fixtures/moasure/north-terrace-6.csv'));
  await expect(frame.locator('[data-moasure-group]')).toHaveCount(1);
  await frame.locator('#moasureAnchorButton').click();await point(frame,.5,.5);
  const card=frame.locator('[data-shape-card-id]').first();
  await expect(card).toContainText('Moasure Polygon Inspector');
  await expect(card).toContainText('Placement unconfirmed');
  await expect(card.locator('[data-create-shape-job]')).toBeDisabled();
  await expect(frame.locator('[data-placement-controls]')).toBeVisible();
  const before=await frame.evaluate(()=>structuredClone(UOS.ProgramApp.workspace().entities.geometries[0]));
  await expect.poll(()=>frame.evaluate(()=>UOS.ProgramMapController.getMapController().getLocationSnapshot().moving)).toBe(false);
  const pixel=await frame.evaluate(()=>{
   const g=UOS.ProgramApp.workspace().entities.geometries[0],b=g.localPlacement;
   return UOS.ProgramMapController.getMapController().projectCoordinate(UOS.MoasureGeometry.place(UOS.MoasureGeometry.centroid(b.type,b.coordinates),b.anchor,b.bearing));
  });
  const rect=await frame.locator('.maplibregl-canvas').boundingBox();
  await page.mouse.move(rect.x+pixel.x,rect.y+pixel.y);await page.mouse.down();
  await page.mouse.move(rect.x+pixel.x+35,rect.y+pixel.y+20,{steps:8});await page.mouse.up();
    expect(Number(await frame.locator("[data-placement-angle]").inputValue())).toBe(0);
    const preview=await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getOperationalSnapshot().features.features);
    expect(preview[0].geometry.coordinates).not.toEqual(before.geometry.coordinates);
  await expect.poll(()=>frame.evaluate(()=>UOS.ProgramMapController.getMapController().getLocationSnapshot().moving)).toBe(false);
    const rotation=await frame.locator('.program-map-rotation-handle').boundingBox();
    await page.mouse.move(rotation.x+rotation.width/2,rotation.y+rotation.height/2);
    await page.mouse.down();
    await page.mouse.move(rotation.x+rotation.width/2+25,rotation.y+rotation.height/2+15,{steps:8});
    await page.mouse.up();
    expect(Number(await frame.locator('[data-placement-angle]').inputValue())).not.toBe(0);
    await frame.locator('[data-placement-angle]').fill('45');
  await frame.locator('[data-save-placement]').click();
  await expect(card).toContainText('Placement confirmed');
  const placed=await frame.evaluate(()=>structuredClone(UOS.ProgramApp.workspace().entities.geometries[0]));
  expect(placed.localPlacement.anchor).not.toEqual(before.localPlacement.anchor);
  expect(placed.localPlacement.bearing).toBe(45);expect(placed.payload.areaSqM).toBe(before.payload.areaSqM);
  await card.locator('[data-shape-pricing-unit]').selectOption('ha');
  await card.locator('[data-create-shape-job]').click();
  await expect(card.locator('[data-create-shape-job]')).toHaveClass(/is-created/);
  const line=await frame.evaluate(()=>structuredClone(UOS.ProgramApp.workspace().entities.costingLines[0]));
  expect(line.unit).toBe('ha');
  await card.locator('[data-polygon-placement]').click();
  await frame.locator('[data-placement-angle]').fill('90');
  await frame.locator('[data-cancel-placement]').click();
  expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries[0].localPlacement.bearing)).toBe(45);
  await card.locator('[data-polygon-placement]').click();await frame.locator('[data-placement-angle]').fill('120');
  await frame.locator('[data-save-placement]').click();
  expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.costingLines[0])).toEqual(line);
  await card.locator('[data-shape-action="edit"]').click();
  const vertex=card.locator('[data-coord-lng="1"]');const longitude=Number(await vertex.inputValue());
  await vertex.fill(String(longitude+.000001));await vertex.dispatchEvent('change');
  await frame.locator('#spaceAcceptDraft').click();
  await expect(card).toContainText('Edited survey outline');
  const edited=await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries[0].payload.areaSqM);
  expect(edited).not.toBe(before.payload.areaSqM);
  await page.reload();const restored=page.frames().find(f=>f!==page.mainFrame());await restored.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');
  expect(await restored.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries[0].payload.areaSqM)).toBe(edited);
  expect(errors).toEqual([]);
 });
 test(owner+': invalid Moasure CSV is rejected without creating polygons',async({page})=>{
  const {frame,errors}=await openDrawing(page,owner);
  await frame.locator('#moasureImportButton').click();
  await frame.locator('#moasureCsvFile').setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('Layer,Path,Point,X:m,Y:m\n1,1,1,,0')});
  await expect(frame.locator('#moasureImportError')).toBeVisible();await expect(frame.locator('#moasureAnchorButton')).toBeDisabled();
  expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries.length)).toBe(0);expect(errors).toEqual([]);
 });
}


test('Moasure import uses only selected groups and fits a narrow viewport',async({page})=>{
  const {frame,errors}=await openDrawing(page,'NSA');
  await page.setViewportSize({width:480,height:900});
  await frame.locator('#moasureImportButton').click();
  const dialog=frame.locator('#moasureImportDialog');
  const rect=await dialog.boundingBox();
  expect(rect.width).toBeLessThanOrEqual(480);
  await frame.locator('#moasureCsvFile').setInputFiles({
    name:'layers.csv',mimeType:'text/csv',buffer:Buffer.from(
      'Layer,Layer-Name,Path,Point,X:cm,Y:cm\n'+
      '1,First,1,1,0,0\n1,First,1,2,100,0\n1,First,1,3,0,100\n'+
      '2,Second,1,1,0,0\n2,Second,1,2,200,0\n2,Second,1,3,0,200')
  });
  const groups=frame.locator('[data-moasure-group]');
  await expect(groups).toHaveCount(2);
  await groups.first().uncheck();
  await frame.locator('#moasureAnchorButton').click();await point(frame,.6,.6);
  await expect(frame.locator('[data-shape-card-id]')).toHaveCount(1);
  await expect(frame.locator('[data-placement-controls]')).toBeVisible();
  await frame.locator('[data-save-placement]').scrollIntoViewIfNeeded();
  await expect(frame.locator('[data-save-placement]')).toBeInViewport();
  await frame.locator('[data-save-placement]').click();
  const geometry=await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries[0]);
  expect(geometry.moasureSurvey.layer).toBe('2');
  expect(geometry.payload.areaSqM).toBe(2);
  expect(errors).toEqual([]);
});
