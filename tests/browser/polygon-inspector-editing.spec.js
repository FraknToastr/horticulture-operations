const {test,expect}=require('@playwright/test');
const {suppressBackupModalForFunctionalTest}=require('./test-helper.cjs');
const path=require('path');

for(const owner of ['NSA','EVT']){
  test(owner+': map vertex drag and confirmed removal remain temporary until Finish',async({page})=>{
    const {frame,card,ids,errors}=await setup(page,owner);
    await card.locator('[data-shape-action="zoom"]').click();
    await expect.poll(()=>frame.evaluate(()=>UOS.ProgramMapController.getMapController().getLocationSnapshot().moving)).toBe(false);
    await card.locator('[data-shape-action="edit"]').click();
    const before=await entities(frame);
    const pixel=await frame.evaluate(id=>{
      const g=UOS.ProgramApp.workspace().entities.geometries.find(g=>g.id===id);
      return UOS.ProgramMapController.getMapController().projectCoordinate(g.geometry.coordinates[0][0]);
    },ids.geometryId);
    const rect=await frame.locator('.maplibregl-canvas').boundingBox();
    await page.mouse.move(rect.x+pixel.x,rect.y+pixel.y);await page.mouse.down();
    await page.mouse.move(rect.x+pixel.x+25,rect.y+pixel.y+15,{steps:8});await page.mouse.up();
    const preview=await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getOperationalSnapshot().features.features[0].geometry.coordinates);
    const stored=await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries[0].geometry.coordinates);
    expect(preview).not.toEqual(stored);expect(await entities(frame)).toBe(before);
    await frame.locator('#cancelDrawingButton').click();expect(await entities(frame)).toBe(before);
    await card.locator('[data-shape-action="edit"]').click();
    await card.locator('[data-delete-vertex="0"]').click();
    const warning=frame.getByRole('dialog').filter({has:frame.locator('.uos-modal__foot .uos-button--danger')});
    await expect(warning).toBeVisible();
    await warning.getByRole('button',{name:'Remove vertex',exact:true}).click();
    await expect(card.locator('[data-coord-lng]')).toHaveCount(3);
    expect(await entities(frame)).toBe(before);
    await frame.locator('#finishDrawingButton').click();
    await expect(card.locator('[data-coord-lng]')).toHaveCount(0);
    expect(await entities(frame)).not.toBe(before);
    expect(errors).toEqual([]);
  });
}
test.describe('touch-sized polygon controls',()=>{
  test.use({hasTouch:true});
  test('all Inspector buttons retain the coarse-pointer minimum',async({page})=>{
    const {frame,card}=await setup(page,'NSA');
    await card.locator('[data-polygon-placement]').click();
    const heights=await card.locator('button.uos-button').evaluateAll(b=>b.map(x=>x.getBoundingClientRect().height));
    expect(new Set(heights).size).toBe(1);expect(heights[0]).toBe(44);
  });
});


async function setup(page,owner){
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({width:1600,height:1000});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/src/program-planner/'+(owner==='NSA'?'nsa':'events')+'.html');
  const frame=page.frames().find(f=>f!==page.mainFrame());
  await frame.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');
  const ids=await frame.evaluate(async owner=>{
    let ids;
    await UOS.ProgramApp.updateWorkspace(w=>{
      const id=owner+'-'+(owner==='NSA'?'APP':'EVENT')+'-VERTEX';
      w.entities[owner==='NSA'?'applications':'events'].push({id,owner,type:owner==='NSA'?'application':'event',title:'Vertex session',status:'received',dateReceived:'2026-10-09'});
      const p=UOS.ProgramModel.promoteRegisterRecord(w,id);
      w=UOS.ProgramStatus.migrate(p.workspace);
      w=UOS.WorkAreaService.createGeometry(w,p.project.id,{
        id:owner+'-GEO-VERTEX',workTypeKey:'turfing',geometryKind:'polygon',
        geometry:{type:'Polygon',coordinates:[[[138.6,-34.92],[138.6003,-34.92],[138.6003,-34.9203],[138.6,-34.9203],[138.6,-34.92]]]},
        payload:{type:'turfing',visible:true}
      });
      w=UOS.WorkAreaService.syncGeometry(w,owner+'-GEO-VERTEX',{explicit:true});
      w.workspace.selectedEntityId=id;w.workspace.selectedProjectId=p.project.id;
      ids={recordId:id,projectId:p.project.id,geometryId:owner+'-GEO-VERTEX'};return w;
    });
    await UOS.ProgramApp.navigate('map');return ids;
  },owner);
  await frame.locator('[data-map-scope="projects"]').click();
  await frame.locator('[data-edit-event-id="'+ids.projectId+'"]').first().click();
  await frame.waitForFunction(()=>UOS.ProgramMapController.getMapController()?.ready());
  expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.jobs.length)).toBe(1);
  expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(1);
  return {frame,ids,errors,card:frame.locator('[data-shape-card-id="'+ids.geometryId+'"]')};
}
async function reopenInspector(frame,ids){
  await frame.evaluate(()=>UOS.ProgramApp.navigate('map'));
  const back=frame.locator('#backToListButton');
  if(await back.isVisible())await back.click();
  await frame.locator('[data-map-scope="projects"]').click();
  await frame.locator('[data-edit-event-id="'+ids.projectId+'"]').first().click();
}
const entities=frame=>frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities));
async function editCoordinate(card){
  const input=card.locator('[data-coord-lng="1"]');
  await input.fill(String(Number(await input.inputValue())+.00005));
  await input.dispatchEvent('change');
}

for(const owner of ['NSA','EVT']){
  test(owner+': vertex edits are staged; Cancel, Escape and navigation preserve saved work',async({page})=>{
    const {frame,card,errors}=await setup(page,owner),before=await entities(frame);
    await card.locator('[data-shape-action="edit"]').click();
    await expect(frame.locator('#finishDrawingButton')).toBeEnabled();
    await expect(frame.locator('#cancelDrawingButton')).toBeEnabled();
    await expect(frame.locator('#startDrawingButton')).toBeDisabled();
    await expect(frame.locator('#undoDrawingButton')).toBeDisabled();
    await expect(card.locator('[data-shape-action="edit"]')).toHaveText('Edit Vertices');
    await editCoordinate(card);
    expect(await entities(frame)).toBe(before);
    await frame.locator('#cancelDrawingButton').click();
    await expect(card.locator('[data-coord-lng]')).toHaveCount(0);
    expect(await entities(frame)).toBe(before);
    await card.locator('[data-shape-action="edit"]').click();await editCoordinate(card);
    await page.keyboard.press('Escape');
    expect(await entities(frame)).toBe(before);
    await card.locator('[data-shape-action="edit"]').click();await editCoordinate(card);
    await frame.evaluate(()=>UOS.ProgramApp.navigate('register'));
    expect(await entities(frame)).toBe(before);
    expect(errors).toEqual([]);
  });

  test(owner+': Finish commits geometry and costing once, rejects invalid or stale drafts',async({page})=>{
    const {frame,card,ids,errors}=await setup(page,owner),before=await entities(frame);
    await card.locator('[data-shape-action="edit"]').click();
    const input=card.locator('[data-coord-lng="1"]');
    await input.fill('');await input.dispatchEvent('change');
    await expect(frame.locator('#finishDrawingButton')).toBeDisabled();
    expect(await entities(frame)).toBe(before);
    await input.fill('138.60035');await input.dispatchEvent('change');
    await expect(frame.locator('#finishDrawingButton')).toBeEnabled();
    await frame.locator('#finishDrawingButton').click();
    await expect(card.locator('[data-coord-lng]')).toHaveCount(0);
    const saved=await entities(frame);expect(saved).not.toBe(before);
    await page.reload();
    const restored=page.frames().find(f=>f!==page.mainFrame());
    await restored.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');
    expect(await entities(restored)).toBe(saved);
    await reopenInspector(restored,ids);
    const current=restored.locator('[data-shape-card-id="'+ids.geometryId+'"]');
    await current.locator('[data-shape-action="edit"]').click();await editCoordinate(current);
    await restored.evaluate(async id=>UOS.ProgramApp.updateWorkspace(w=>{
      const g=w.entities.geometries.find(g=>g.id===id);g.payload.visible=false;return w;
    }),ids.geometryId);
    const stale=await entities(restored);
    await restored.locator('#finishDrawingButton').click();
    await expect(restored.locator('.uos-toast').filter({hasText:'changed during editing'})).toBeVisible();
    expect(await entities(restored)).toBe(stale);
    await expect(restored.locator('#cancelDrawingButton')).toBeEnabled();
    await restored.locator('#cancelDrawingButton').click();
    expect(errors).toEqual([]);
  });

  test(owner+': Inspector action rows, shared heights and thin outlines',async({page})=>{
    const {frame,card,errors}=await setup(page,owner);
    const labelled=card.locator('.program-shape-actions--labelled');
    await expect(labelled.locator('button')).toHaveText(['Edit Vertices','Move / Rotate']);
    await expect(card.locator('.program-shape-actions--icons button')).toHaveCount(4);
    const heights=await card.locator('button.uos-button').evaluateAll(b=>b.map(x=>x.getBoundingClientRect().height));
    expect(new Set(heights).size).toBe(1);expect(heights[0]).toBe(34);
    await expect.poll(()=>frame.evaluate(()=>UOS.ProgramMapController.getMapController().getOperationalSnapshot().layers.length)).toBeGreaterThanOrEqual(5);
    const layers=await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getOperationalSnapshot().layers);
    expect(layers.find(l=>l.id==='uos-shape-edges').paint['line-width']).toBe(2);
    expect(layers.find(l=>l.id==='uos-shape-line').paint['line-width']).toBe(2);
    expect(layers.find(l=>l.id==='uos-shape-selection-outline').paint['line-width']).toBe(4);
    await page.setViewportSize({width:480,height:900});
    const rows=await labelled.locator('button').evaluateAll(b=>b.map(x=>x.getBoundingClientRect().top));
    expect(rows[0]).toBe(rows[1]);
    await card.locator('[data-polygon-placement]').click();
    await expect(card.locator('[data-placement-controls]')).toBeVisible();
    await expect(frame.locator('#polygonPlacementToolbar')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('Moasure confirmation controls survive Escape and reload, and target their own polygon',async({page})=>{
  const {frame,ids,errors}=await setup(page,'NSA');
  await frame.locator('#moasureImportButton').click();
  await frame.locator('#moasureCsvFile').setInputFiles(path.resolve('tests/fixtures/moasure/north-terrace-6.csv'));
  await frame.locator('#moasureAnchorButton').click();
  await frame.locator('.maplibregl-canvas').click({position:{x:500,y:400}});
  const moasure=frame.locator('[data-shape-card-id]').filter({hasText:'Moasure Polygon Inspector'});
  await expect(moasure.locator('[data-placement-controls]')).toBeVisible();
  const id=await moasure.getAttribute('data-shape-card-id');
  const normal=frame.locator('[data-shape-card-id="'+ids.geometryId+'"]');
  await normal.locator('[data-polygon-placement]').click();
  await normal.locator('[data-placement-angle]').fill('20');
  await moasure.locator('[data-placement-angle]').fill('10');
  await expect(normal.locator('[data-placement-controls]')).toHaveCount(0);
  const normalPreview=await frame.evaluate(id=>UOS.ProgramMapController.getMapController().getOperationalSnapshot().features.features.find(f=>f.properties.id===id).geometry.coordinates,ids.geometryId);
  const normalStored=await frame.evaluate(id=>UOS.ProgramApp.workspace().entities.geometries.find(g=>g.id===id).geometry.coordinates,ids.geometryId);
  expect(normalPreview).toEqual(normalStored);
  await page.keyboard.press('Escape');
  await expect(moasure.locator('[data-save-placement]')).toBeVisible();
  await expect(moasure.locator('[data-create-shape-job]')).toBeDisabled();
  await page.reload();
  const restored=page.frames().find(f=>f!==page.mainFrame());
  await restored.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');
  await reopenInspector(restored,ids);
  const card=restored.locator('[data-shape-card-id="'+id+'"]');
  await expect(card.locator('[data-save-placement]')).toBeVisible();
  await card.locator('[data-save-placement]').click();
  await expect(card.locator('[data-placement-controls]')).toHaveCount(0);
  await expect(card.locator('[data-create-shape-job]')).toBeEnabled();
  expect(await restored.evaluate(id=>UOS.ProgramApp.workspace().entities.geometries.find(g=>g.id===id).localPlacement.confirmed,id)).toBe(true);
  expect(errors).toEqual([]);
});
