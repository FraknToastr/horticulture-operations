const {startSpaceCreation}=require('./test-helper.cjs');
const {test,expect}=require('@playwright/test');
const {suppressBackupModalForFunctionalTest}=require('./test-helper.cjs');

async function setup(page,owner='NSA'){
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({width:1600,height:1000});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.text().startsWith('ProgramMapController render issue:'))errors.push(m.text());});
  await page.goto('/src/program-planner/'+(owner==='NSA'?'nsa':'events')+'.html');
  const frame=page.frames().find(f=>f!==page.mainFrame());
  await frame.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');
  const ids=await frame.evaluate(async owner=>{
    let ids;
    await UOS.ProgramApp.updateWorkspace(w=>{
      const id=owner+'-'+(owner==='NSA'?'APP':'EVENT')+'-EDITOR';
      w.entities[owner==='NSA'?'applications':'events'].push({id,owner,type:owner==='NSA'?'application':'event',title:'Editor test',status:'received',dateReceived:'2026-10-09'});
      const result=UOS.ProgramModel.promoteRegisterRecord(w,id);
      w=UOS.ProgramStatus.migrate(result.workspace);
      w=UOS.ProgramModel.addLocationToRegister(w,id,{id:owner+'-PIN-1',coordinate:[138.6,-34.92]});
      w.workspace.selectedEntityId=id;w.workspace.selectedProjectId=result.project.id;
      ids={recordId:id,projectId:result.project.id};return w;
    });
    await UOS.ProgramApp.navigate('map');return ids;
  },owner);
  await frame.waitForFunction(()=>UOS.ProgramMapController.getMapController()?.ready());
  expect(await frame.evaluate(() => UOS.ProgramMapController.canonicalMapState(UOS.ProgramApp.workspace()).selectedRegisterId)).toBe(ids.recordId);
  await expect(frame.locator('#spaceProjectSelect,#spaceRegisterSelect,[data-filter-drawer="map"],#toggleMapActiveOnly,#toggleMapSelectedOnly')).toHaveCount(0);
  return {frame,ids,errors};
}
async function point(frame,x=.5,y=.6){
  const canvas=frame.locator('.maplibregl-canvas');const rect=await canvas.boundingBox();
  await canvas.click({position:{x:rect.width*x,y:rect.height*y}});
}

test('Space Map isolates the open record, ignores old filters, and has no workspace fallback',async({page})=>{
  const {frame,ids,errors}=await setup(page);
  await startSpaceCreation(frame,"polygon");
  await point(frame,.4,.45);await point(frame,.6,.45);await point(frame,.5,.65);
  await frame.locator('#spaceAcceptDraft').click();
  const firstGeometry=await frame.locator('[data-shape-card-id]').getAttribute('data-shape-card-id');
  const other=await frame.evaluate(async()=>{
    let projectId;
    await UOS.ProgramApp.updateWorkspace(w=>{
      const id='NSA-APP-OTHER';
      w.entities.applications.push({id,owner:'NSA',type:'application',title:'Unrelated',status:'received',dateReceived:'2026-10-09'});
      const result=UOS.ProgramModel.promoteRegisterRecord(w,id);w=result.workspace;projectId=result.project.id;
      w=UOS.ProgramModel.addLocationToRegister(w,id,{id:'OTHER-PIN',coordinate:[138.65,-34.94]});
      return w;
    });return {recordId:'NSA-APP-OTHER',projectId};
  });
  async function context(recordId,projectId){
    await frame.evaluate(async({recordId,projectId})=>{
      await UOS.ProgramApp.updateWorkspace(w=>{
        if(!recordId){window.__scopeEntities=structuredClone(w.entities);Object.keys(w.entities).forEach(key=>{if(Array.isArray(w.entities[key]))w.entities[key]=[];});}
        else if(window.__scopeEntities){w.entities=window.__scopeEntities;delete window.__scopeEntities;}
        w.workspace.selectedEntityId=recordId;w.workspace.selectedProjectId=projectId;
        w.workspace.map={...w.workspace.map,scopeMode:'register',selectedRegisterId:recordId,selectedProjectId:projectId,selectedGeometryId:'',selectedLocationId:'',showSelectedOnly:true,selectedOnly:true,activeOnly:true};
        return w;
      });
    },{recordId,projectId});
  }
  await context(ids.recordId,ids.projectId);
  await expect(frame.locator('[data-space-pin]')).toHaveCount(1);
  await expect(frame.locator('[data-shape-card-id]')).toHaveCount(1);
  await context(other.recordId,other.projectId);
  await expect(frame.locator('[data-space-pin="OTHER-PIN"]')).toHaveCount(1);
  await expect(frame.locator('[data-shape-card-id]')).toHaveCount(0);
  expect(await frame.evaluate(id=>UOS.ProgramMapController.getMapController().getOperationalSnapshot().features.features.some(f=>f.id===id || f.properties.id===id),firstGeometry)).toBe(false);
  await context('','');
  await expect(frame.locator('[data-space-pin],[data-shape-card-id]')).toHaveCount(0);
  await expect.poll(()=>frame.evaluate(()=>UOS.ProgramMapController.canonicalMapState(UOS.ProgramApp.workspace()).selectedProjectId)).toBe('');
  expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getLocationSnapshot().features.features)).toEqual([]);
  await context(ids.recordId,ids.projectId);
  await expect(frame.locator('[data-shape-card-id]')).toHaveCount(1);
  await page.reload();
  const restored=page.frames().find(f=>f!==page.mainFrame());
  await restored.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==='ready');
  await restored.evaluate(()=>UOS.ProgramApp.navigate('map'));
  await expect(restored.locator('[data-space-pin="'+ids.recordId.replace('-APP-EDITOR','-PIN-1')+'"]')).toHaveCount(1);
  await expect(restored.locator('[data-shape-card-id]')).toHaveCount(1);
  expect(errors).toEqual([]);
});
