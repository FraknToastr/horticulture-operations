const path = require('path');
const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test('A3330 focuses its reimported location after the map was panned away', async ({page}) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({width:1600,height:1000});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/src/program-planner/nsa.html');
  const frame=page.frames().find(f=>f!==page.mainFrame());
  await frame.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');
  async function importPDF(){
    await frame.locator('[data-register-pdf-input]').setInputFiles(path.resolve('src/sample/nature-strip-dashboard-source.sample.pdf'));
    const dialog=frame.locator('[data-program-import-modal]');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-program-import-apply]').click();
    await expect(dialog).toBeHidden();
    return frame.evaluate(()=>UOS.ProgramApp.workspace().entities.applications.find(r=>r.receipt==='A3330').id);
  }
  async function focus(id){
    await frame.locator('[data-register-action="map"][data-register-record="'+id+'"]').click();
    const coordinate=await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.applications.find(r=>r.receipt==='A3330').locations[0].coordinate);
    expect(coordinate).toEqual([138.597426,-34.90296120000001]);
    await expect.poll(async()=>{
      const center=await frame.evaluate(()=>UOS.ProgramMapController.getMapController()?.getLocationSnapshot().center);
      return center ? Math.hypot(center[0]-coordinate[0],center[1]-coordinate[1]) : 1;
    }).toBeLessThan(.00001);
    return coordinate;
  }
  let id=await importPDF();
  for(let cycle=0;cycle<2;cycle++){
    const coordinate=await focus(id);
    const rect=await frame.locator('.maplibregl-canvas').boundingBox();
    await page.mouse.move(rect.x+rect.width*.6,rect.y+rect.height*.6);
    await page.mouse.down();
    await page.mouse.move(rect.x+rect.width*.6+200,rect.y+rect.height*.6+100,{steps:10});
    await page.mouse.up();
    await expect.poll(async()=>{
      const center=await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getLocationSnapshot().center);
      return Math.hypot(center[0]-coordinate[0],center[1]-coordinate[1]);
    }).toBeGreaterThan(.00001);
    await frame.evaluate(()=>UOS.ProgramApp.navigate('register'));
    await frame.locator('[data-register-delete-id="'+id+'"]').first().click();
    const deletion=frame.locator('#deleteRegisterDialog');
    await expect(deletion).toBeVisible();
    await deletion.locator('[data-register-delete-confirm]').click();
    await expect(deletion).toBeHidden();
    expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.applications.length)).toBe(0);
    id=await importPDF();
  }
  await focus(id);
  expect(errors).toEqual([]);
});
