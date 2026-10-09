const {startSpaceCreation}=require('./test-helper.cjs');
const {test,expect}=require('@playwright/test');
const {suppressBackupModalForFunctionalTest}=require('./test-helper.cjs');

async function setup(page,owner='NSA',project=true){
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({width:1600,height:1000});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.text().startsWith('ProgramMapController render issue:'))errors.push(message.text());});
  await page.goto('/src/program-planner/'+(owner==='NSA'?'nsa':'events')+'.html');
  const frame=page.frames().find(f=>f!==page.mainFrame());
  await frame.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');
  const ids=await frame.evaluate(async({owner,project})=>{
    let ids;
    await UOS.ProgramApp.updateWorkspace(w=>{
      const id=owner+'-'+(owner==='NSA'?'APP':'EVENT')+'-RADIAL';
      w.entities[owner==='NSA'?'applications':'events'].push({id,owner,type:owner==='NSA'?'application':'event',title:'Radial creation',status:'received',dateReceived:'2026-10-09'});
      let projectId='';
      if(project){const promoted=UOS.ProgramModel.promoteRegisterRecord(w,id);w=UOS.ProgramStatus.migrate(promoted.workspace);projectId=promoted.project.id;}
      w=UOS.ProgramModel.addLocationToRegister(w,id,{id:owner+'-RADIAL-PIN',coordinate:[138.6,-34.92]});
      w.workspace.selectedEntityId=id;w.workspace.selectedProjectId=projectId;
      ids={recordId:id,projectId};return w;
    });
    await UOS.ProgramApp.navigate('map');return ids;
  },{owner,project});
  await frame.waitForFunction(()=>UOS.ProgramMapController.getMapController()?.ready());
  await expect(frame.locator('#spaceRadialToggle')).toBeVisible();
  return {frame,ids,errors};
}
async function point(frame,x=.5,y=.7){
  const canvas=frame.locator('.maplibregl-canvas'),rect=await canvas.boundingBox();
  await canvas.click({position:{x:rect.width*x,y:rect.height*y}});
}
async function nodesDisabled(frame,disabled){
  for(const kind of ['location','polygon','line','square']){
    const node=frame.locator('[data-space-create="'+kind+'"]');
    if(disabled)await expect(node).toBeDisabled();else await expect(node).toBeEnabled();
  }
}

for(const owner of ['NSA','EVT']){
  test(owner+': radial Location uses staged pin placement without a Project',async({page})=>{
    const {frame,ids,errors}=await setup(page,owner,false);
    const hub=frame.locator('#spaceRadialToggle');
    await expect(frame.locator('#spaceRadialActions')).toBeHidden();await hub.click();
    const location=frame.locator('[data-space-create="location"]');await expect(location).toBeEnabled();
    for(const kind of ['polygon','line','square']){
      const node=frame.locator('[data-space-create="'+kind+'"]');await expect(node).toBeDisabled();
      await expect(node).toHaveAccessibleDescription(/Create a Project/);
    }
    await location.click();await nodesDisabled(frame,true);
    await expect(frame.locator('#eventMap')).toBeFocused();await expect(hub).toHaveAttribute('aria-expanded','true');
    await point(frame);await expect(frame.locator('[data-space-pin]')).toHaveCount(2);
    expect(await frame.evaluate(id=>UOS.ProgramModel.registerLocations(UOS.ProgramApp.workspace(),id).length,ids.recordId)).toBe(1);
    await frame.locator('#undoLocationButton').click();await expect(frame.locator('[data-space-pin]')).toHaveCount(1);
    await frame.locator("#spaceCancelDraft").click();await startSpaceCreation(frame,"location");await point(frame,.6,.75);
    await frame.locator('#spaceAcceptDraft').click();
    await expect.poll(()=>frame.evaluate(id=>UOS.ProgramModel.registerLocations(UOS.ProgramApp.workspace(),id).length,ids.recordId)).toBe(2);
    await expect(location).toBeEnabled();await expect(hub).toHaveAttribute('aria-expanded','true');
    await location.click();await point(frame,.4,.75);await page.keyboard.press('Escape');
    await expect(frame.locator('[data-space-pin]')).toHaveCount(2);await expect(location).toBeEnabled();
    await expect(hub).toHaveAttribute('aria-expanded','true');
    await page.keyboard.press('Escape');await expect(hub).toHaveAttribute('aria-expanded','false');await expect(hub).toBeFocused();
    expect(errors).toEqual([]);
  });

  test(owner+': radial geometries share sidebar modes, completion, Undo and Cancel',async({page})=>{
    const {frame,ids,errors}=await setup(page,owner);
    const hub=frame.locator('#spaceRadialToggle');await hub.click();
    for(const mode of ['polygon','line','square']){
      await nodesDisabled(frame,false);
      await frame.locator('[data-space-create="'+mode+'"]').click();
      await expect(hub).toHaveAttribute('aria-expanded','true');await nodesDisabled(frame,true);
      await expect(frame.locator('[data-space-create="'+mode+'"]')).toHaveAttribute('aria-current','true');
      expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing().coordinates)).toEqual([]);
      await frame.locator('[data-space-create="location"]').evaluate(button=>button.click());
      expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing().mode)).toBe(mode);
      await point(frame,.35,.6);
      await frame.locator('#undoDrawingButton').click();
      expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing().coordinates)).toEqual([]);
      await hub.click();await expect(frame.locator('#spaceRadialActions')).toBeHidden();
      expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing().mode)).toBe(mode);
      await hub.click();await point(frame,.35,.6);await point(frame,.65,.6);
      if(mode==='polygon')await point(frame,.65,.85);
      await frame.locator('#spaceAcceptDraft').click();
      await expect.poll(()=>frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries.length)).toBe(['polygon','line','square'].indexOf(mode)+1);
      await nodesDisabled(frame,false);
    }
    const geometries=await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries);
    expect(geometries.map(g=>g.geometry.type)).toEqual(['Polygon','LineString','Polygon']);
    expect(geometries.every(g=>g.projectId===ids.projectId && g.owner===owner)).toBe(true);
    await frame.locator('[data-space-create="polygon"]').click();await point(frame);
    await frame.locator('#spaceCancelDraft').click();await nodesDisabled(frame,false);
    expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries.length)).toBe(3);
    await expect(hub).toHaveAttribute('aria-expanded','true');expect(errors).toEqual([]);
  });

  test(owner+': radial icons, keyboard access, drawer placement and responsive themes',async({page})=>{
    const {frame,errors}=await setup(page,owner);
    const hub=frame.locator('#spaceRadialToggle');await hub.focus();await page.keyboard.press('Enter');
    await expect(hub).toHaveAttribute('aria-expanded','true');
    for(const name of ['Location','Polygon','Line','Line-to-Square']){
      await page.keyboard.press('Tab');await expect(frame.getByRole('button',{name,exact:true}).filter({has:frame.locator('svg')}).and(frame.locator('[data-space-create]'))).toBeFocused();
    }
    await page.keyboard.press('Space');
    expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing().mode)).toBe('square');
    await page.keyboard.press('Escape');await expect(hub).toHaveAttribute('aria-expanded','true');
    await page.keyboard.press('Escape');await expect(hub).toHaveAttribute('aria-expanded','false');await expect(hub).toBeFocused();
    await hub.click();
    for(const width of [1600,600,390,320]){
      await page.setViewportSize({width,height:1000});
      for(const theme of ['light','dark']){
        await frame.evaluate(theme=>document.documentElement.dataset.suiteTheme=theme,theme);
        const layout=await frame.locator('#spaceRadialMenu').evaluate(menu=>{
          const canvas=menu.parentElement.getBoundingClientRect(),hub=menu.querySelector('#spaceRadialToggle').getBoundingClientRect();
          return {centerError:Math.abs((hub.left+hub.right-canvas.left-canvas.right)/2),top:hub.top-canvas.top,hubWidth:hub.width,
            nodes:Array.from(menu.querySelectorAll('[data-space-create]')).map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,inside:r.left>=canvas.left && r.right<=canvas.right && r.top>=canvas.top && r.bottom<=canvas.bottom,text:b.textContent.trim(),icons:b.querySelectorAll('svg').length};}),
            transparent:getComputedStyle(menu).pointerEvents,overflow:menu.parentElement.scrollWidth>menu.parentElement.clientWidth+1};
        });
        expect(layout.centerError).toBeLessThan(1);expect(layout.top).toBe(16);expect(layout.hubWidth).toBe(64);
        expect(layout.transparent).toBe('none');expect(layout.overflow).toBe(false);
        for(const node of layout.nodes){
          expect(node.width).toBeCloseTo(48,1);expect(node.height).toBeCloseTo(48,1);
          expect(node.inside).toBe(true);expect(node.text).toBe('');expect(node.icons).toBe(1);
        }
      }
    }
    await page.setViewportSize({width:1600,height:1000});
    const canvas=frame.locator('.maplibregl-canvas'),rect=await canvas.boundingBox();
    await canvas.dragTo(canvas,{sourcePosition:{x:rect.width*.3,y:rect.height*.65},targetPosition:{x:rect.width*.4,y:rect.height*.7}});
    await expect(hub).toHaveAttribute('aria-expanded','true');
    await page.emulateMedia({reducedMotion:'reduce'});
    expect(await frame.locator('#spaceRadialActions').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
    await frame.evaluate(()=>UOS.ProgramApp.navigate('planner'));await frame.evaluate(()=>UOS.ProgramApp.navigate('map'));
    await expect(hub).toHaveAttribute('aria-expanded','false');
    expect(errors).toEqual([]);
  });
}

test('radial guards vertex edits, placement, unavailable maps and changed record context',async({page})=>{
  const {frame,errors}=await setup(page);
  const hub=frame.locator('#spaceRadialToggle');await hub.click();
  await frame.locator('[data-space-create="polygon"]').click();
  await point(frame,.35,.6);await point(frame,.65,.6);await point(frame,.65,.85);
  await frame.locator('#spaceAcceptDraft').click();
  await expect(frame.locator('[data-shape-card-id]')).toHaveCount(1);
  const before=await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities));
  await frame.locator('[data-shape-action="edit"]').click();await nodesDisabled(frame,true);
  await expect(frame.locator('[data-space-create="location"]')).toHaveAccessibleDescription(/Accept or cancel/);
  await frame.locator('#spaceCancelDraft').click();await nodesDisabled(frame,false);
  await frame.locator('[data-polygon-placement]').click();await nodesDisabled(frame,true);
  await page.keyboard.press('Escape');await nodesDisabled(frame,false);
  await expect(hub).toHaveAttribute('aria-expanded','true');
  expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(before);
  await frame.evaluate(()=>{const controller=UOS.ProgramMapController.getMapController();window.radialOriginalReady=controller.ready;controller.ready=()=>false;});
  await hub.click();await hub.click();await nodesDisabled(frame,true);
  await expect(frame.locator('[data-space-create="location"]')).toHaveAccessibleDescription(/unavailable or still loading/);
  await frame.evaluate(()=>{UOS.ProgramMapController.getMapController().ready=window.radialOriginalReady;delete window.radialOriginalReady;});
  await hub.click();await hub.click();await nodesDisabled(frame,false);
  await frame.evaluate(async()=>{
    await UOS.ProgramApp.updateWorkspace(w=>{
      const id='NSA-APP-RADIAL-SECOND';w.entities.applications.push({id,owner:'NSA',type:'application',title:'Second radial context',status:'received',dateReceived:'2026-10-09'});
      w.workspace.map.selectedRegisterId=id;w.workspace.map.selectedProjectId='';w.workspace.map.selectedGeometryId='';w.workspace.map.selectedLocationId='';
      w.workspace.selectedEntityId=id;w.workspace.selectedProjectId='';return w;
    });
  });
  await expect(hub).toHaveAttribute('aria-expanded','false');await hub.click();
  await expect(frame.locator('[data-space-create="location"]')).toBeEnabled();
  await expect(frame.locator('[data-space-create="polygon"]')).toBeDisabled();
  // The owning Register drawer restores its record context on workspace writes.
  // Supply a read-only empty selection to exercise the menu's no-record guard.
  await frame.evaluate(()=>{
    window.radialOriginalWorkspace=UOS.ProgramApp.workspace;
    const empty=structuredClone(UOS.ProgramApp.workspace());
    empty.workspace.map.selectedRegisterId='';empty.workspace.map.selectedProjectId='';empty.workspace.map.selectedGeometryId='';empty.workspace.map.selectedLocationId='';
    empty.workspace.selectedEntityId='';empty.workspace.selectedProjectId='';
    UOS.ProgramApp.workspace=()=>empty;
  });
  await hub.click();await hub.click();await nodesDisabled(frame,true);
  await expect(frame.locator('[data-space-create="location"]')).toHaveAccessibleDescription(/Open a Register record/);
  await frame.evaluate(()=>{UOS.ProgramApp.workspace=window.radialOriginalWorkspace;delete window.radialOriginalWorkspace;});
  expect(errors).toEqual([]);
});
