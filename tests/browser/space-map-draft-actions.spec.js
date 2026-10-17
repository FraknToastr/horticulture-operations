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

async function start(frame,kind){await startSpaceCreation(frame,kind);}

async function draftCoordinates(frame){return frame.evaluate(()=>{const g=UOS.ProgramMapController.getMapController().getOperationalSnapshot().features.features[0].geometry;return g.type==='Polygon'?g.coordinates[0].slice(0,-1):g.coordinates;});}
for(const owner of ['NSA','EVT']){
  test(owner+': closing either radial hub cancels active map drafts',async({page})=>{
    const {frame,errors}=await setup(page,owner);
    const hub=frame.locator('#spaceRadialToggle'),orbs=frame.locator('#spaceDraftActions');
    const guideHub=frame.locator('[data-space-onboarding-add]');
    const saved=await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities));
    async function assertClosed(){
      await expect(hub).toHaveAttribute('aria-expanded','false');
      await expect(orbs).toBeHidden();
      await expect(frame.locator('#mapToolStatus')).toBeHidden();
      expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing())).toBeNull();
      expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(saved);
    }
    for(const kind of ['polygon','line','square']){
      await start(frame,kind);
      await expect(guideHub).toBeVisible();
      await hub.click();await assertClosed();
      await hub.click();await point(frame,.55,.7);
      expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing())).toBeNull();
      await start(frame,kind);await point(frame,.35,.6);await point(frame,.65,.6);
      await guideHub.click();await assertClosed();
    }
    await frame.locator('[data-space-mode="register"]').click();
    await frame.locator('[data-space-pin]').click();
    await frame.locator('#moveLocationButton').click();await point(frame,.55,.7);
    await hub.click();await assertClosed();
    await expect(frame.locator('#moveLocationButton')).toHaveAttribute('aria-pressed','false');
    await start(frame,'polygon');await point(frame,.35,.6);await point(frame,.65,.6);await point(frame,.65,.85);
    await frame.locator('#spaceAcceptDraft').click();
    await expect(frame.locator('[data-shape-card-id]')).toHaveCount(1);
    const geometry=await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities.geometries));
    await frame.locator('[data-shape-action="edit"]').click();
    const lat=frame.locator('[data-coord-lat="0"]');
    await lat.fill(String(Number(await lat.inputValue())+.00003));await lat.press('Tab');
    await hub.click();await expect(orbs).toBeHidden();
    expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities.geometries))).toBe(geometry);
    await frame.locator('[data-polygon-placement]').click();
    await hub.click();await expect(orbs).toBeHidden();
    await expect(frame.locator('.program-map-canvas-container')).not.toHaveAttribute('data-placement-active','true');
    expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities.geometries))).toBe(geometry);
    expect(errors).toEqual([]);
  });
}

async function dragCoordinate(page,frame,coordinate,dx=24,dy=16){
  const pixel=await frame.evaluate(c=>UOS.ProgramMapController.getMapController().projectCoordinate(c),coordinate);
  const canvas=await frame.locator('.maplibregl-canvas').boundingBox();
  await page.mouse.move(canvas.x+pixel.x,canvas.y+pixel.y);await page.mouse.down();
  await page.mouse.move(canvas.x+pixel.x+dx,canvas.y+pixel.y+dy,{steps:8});await page.mouse.up();
}
test('radial Undo appears on its parent spoke and smoothly separates the original approval orbs',async({page})=>{
  const {frame,errors}=await setup(page);
  for(const width of [1600,448,390]){
    await page.setViewportSize({width,height:1000});
    for(const kind of ['location','polygon','line','square']){
      await start(frame,kind);const undo=frame.locator('#spaceUndoDraft');await expect(undo).toBeHidden();
      const initial=await frame.locator('#spaceAcceptDraft').evaluate(b=>({x:parseFloat(b.style.left),y:parseFloat(b.style.top)}));
      await point(frame,.5,.65);await expect(undo).toBeVisible();
      const samples=await frame.evaluate(()=>new Promise(resolve=>{
        const values=[],start=performance.now();function sample(){const b=document.querySelector('#spaceAcceptDraft');values.push([parseFloat(b.style.left),parseFloat(b.style.top)]);if(performance.now()-start<260)requestAnimationFrame(sample);else resolve(values);}requestAnimationFrame(sample);
      }));
      expect(new Set(samples.map(p=>p.map(n=>n.toFixed(2)).join(','))).size).toBeGreaterThan(2);
      const geometry=await frame.evaluate(kind=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
        const parent=rect(document.querySelector(`[data-space-create="${kind}"]`)),hub=rect(document.querySelector('#spaceRadialToggle'));
        const orbs=['#spaceAcceptDraft','#spaceCancelDraft','#spaceUndoDraft'].map(s=>rect(document.querySelector(s))),menu=rect(document.querySelector('#spaceRadialMenu'));
        const dx=parent.x-hub.x,dy=parent.y-hub.y,length=Math.hypot(dx,dy),axis={x:dx/length,y:dy/length};
        return {fan:orbs.map(o=>({depth:(o.x-parent.x)*axis.x+(o.y-parent.y)*axis.y,side:(o.x-parent.x)*axis.y-(o.y-parent.y)*axis.x})),cross:Math.abs((parent.x-hub.x)*(orbs[2].y-parent.y)-(parent.y-hub.y)*(orbs[2].x-parent.x))/Math.hypot(parent.x-hub.x,parent.y-hub.y),fits:orbs.every(o=>o.left>=menu.left-1 && o.right<=menu.right+1 && o.bottom<=menu.bottom+1 && o.w>=44 && o.h>=44),separated:orbs.every((o,i)=>orbs.every((p,j)=>i===j || Math.hypot(o.x-p.x,o.y-p.y)>=48)),connections:document.querySelector('#spaceDraftConnections').getAttribute('d').split('M').length-1,behind:parseInt(getComputedStyle(document.querySelector('.space-radial__draft-connections')).zIndex)<parseInt(getComputedStyle(document.querySelector('#spaceUndoDraft')).zIndex)};
      },kind);
      const overlap=await frame.evaluate(()=>{
        const nodes=[...document.querySelectorAll('#spaceRadialToggle,[data-space-create],#spaceDraftActions button')].filter(b=>!b.hidden).map(b=>b.getBoundingClientRect());
        return nodes.some((a,i)=>nodes.some((b,j)=>i<j && Math.hypot(a.x+a.width/2-b.x-b.width/2,a.y+a.height/2-b.y-b.height/2)<(a.width+b.width)/2-.1));
      });
      expect(overlap).toBe(false);
      for(const [i,side] of [-56,56,0].entries()){expect(geometry.fan[i].side).toBeCloseTo(side,1);expect(geometry.fan[i].depth).toBeCloseTo(i===2?100:65,1);}
      expect(geometry.cross).toBeLessThan(.1);expect(geometry).toMatchObject({fits:true,separated:true,connections:3,behind:true});
      await undo.focus();await undo.press('Enter');await expect(undo).toBeHidden();
      await expect.poll(()=>frame.locator('#spaceAcceptDraft').evaluate((b,p)=>Math.hypot(parseFloat(b.style.left)-p.x,parseFloat(b.style.top)-p.y),initial)).toBeLessThan(.5);
      await frame.locator('#spaceCancelDraft').click();
    }
  }
  expect(errors).toEqual([]);
});
for(const owner of ['NSA','EVT']){
  test(`${owner}: radial Undo restores completed vertex edits without saving or remounting cards`,async({page})=>{
    const {frame,errors}=await setup(page,owner);
    await frame.locator('[data-space-mode="register"]').click();
    await expect(frame.locator('#moveLocationButton')).toBeVisible();await expect(frame.locator('#removeLocationButton')).toBeVisible();
    await expect(frame.locator('#undoLocationButton')).toHaveCount(0);
    await expect(frame.locator('[data-space-mode="projects"]')).toHaveText('Space Manager');
    await start(frame,'polygon');await point(frame,.35,.5);await point(frame,.6,.5);await point(frame,.6,.8);await point(frame,.35,.8);await frame.locator('#spaceAcceptDraft').click();
    await expect(frame.locator('[data-shape-card-id]')).toHaveCount(1);
    await expect(frame.locator('#moveLocationButton')).toBeHidden();await expect(frame.locator('#removeLocationButton')).toBeHidden();
    const persisted=await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities.geometries));
    await frame.locator('[data-shape-action="edit"]').click();
    const undo=frame.locator('#spaceUndoDraft'),card=frame.locator('[data-shape-card-id]');
    await expect(undo).toBeHidden();const original=await draftCoordinates(frame);
    const initial=await frame.locator('#spaceAcceptDraft').evaluate(b=>({x:parseFloat(b.style.left),y:parseFloat(b.style.top)}));
    await dragCoordinate(page,frame,original[0]);await expect(undo).toBeEnabled();await expect(undo).toBeVisible();
    expect(await draftCoordinates(frame)).not.toEqual(original);
    await expect.poll(()=>frame.evaluate(()=>{
      const center=e=>{const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};};
      const hub=center(document.querySelector('#spaceRadialToggle')),parent=center(document.querySelector('[data-space-create="polygon"]')),undo=center(document.querySelector('#spaceUndoDraft'));
      return Math.abs((parent.x-hub.x)*(undo.y-parent.y)-(parent.y-hub.y)*(undo.x-parent.x))/Math.hypot(parent.x-hub.x,parent.y-hub.y);
    })).toBeLessThan(.1);
    await undo.focus();await undo.press('Enter');await expect(undo).toBeHidden();expect(await draftCoordinates(frame)).toEqual(original);
    await expect.poll(()=>frame.locator('#spaceAcceptDraft').evaluate((b,p)=>Math.hypot(parseFloat(b.style.left)-p.x,parseFloat(b.style.top)-p.y),initial)).toBeLessThan(.5);
    const lat=card.locator('[data-coord-lat="0"]'),lng=card.locator('[data-coord-lng="0"]');
    await lat.fill(String(Number(await lat.inputValue())+.00003));await lat.press('Tab');const latitudeEdit=await draftCoordinates(frame);
    await lng.fill(String(Number(await lng.inputValue())+.00003));await lng.press('Tab');
    await frame.evaluate(()=>window.undoCard=document.querySelector('[data-shape-card-id]'));
    await expect(card).toHaveAttribute('data-card-size','full');
    await expect(card.locator('.space-editor__fields tr:visible')).toHaveCount(3);
    await expect(card.locator('.program-shape-actions button:visible')).toHaveCount(6);
    await expect(card.locator('.space-editor__drawer')).toBeVisible();
    await card.locator('[data-space-expand]').click();
    await expect(card).toHaveAttribute('data-card-size','summary');
    await expect(card.locator('.space-editor__fields tr:visible')).toHaveCount(3);
    await expect(card.locator('.program-shape-actions button:visible')).toHaveCount(6);
    await expect(card.locator('.space-editor__drawer')).toBeHidden();
    await undo.click();expect(await draftCoordinates(frame)).toEqual(latitudeEdit);
    expect(await frame.evaluate(()=>window.undoCard===document.querySelector('[data-shape-card-id]'))).toBe(true);
    await undo.click();await expect(undo).toBeHidden();expect(await draftCoordinates(frame)).toEqual(original);
    await card.locator('[data-space-expand]').click();
    await expect(card).toHaveAttribute('data-card-size','minimal');
    await expect(card.locator('.space-editor__geometry-summary')).toBeVisible();
    await expect(card.locator('.space-editor__fields tr:visible')).toHaveCount(1);
    await expect(card.locator('.space-editor__fields th:visible')).toHaveCount(0);
    await expect(card.locator('.space-editor__fields td').first()).toHaveText(/\S/);
    await expect(card.locator('.program-shape-actions button:visible')).toHaveCount(0);
    await expect(card.locator('.space-editor__drawer')).toBeHidden();
    await card.locator('[data-space-expand]').click();
    await expect(card).toHaveAttribute('data-card-size','full');
    await expect(card.locator('.space-editor__fields tr:visible')).toHaveCount(3);
    await expect(card.locator('.program-shape-actions button:visible')).toHaveCount(6);
    await expect(card.locator('.space-editor__drawer')).toBeVisible();
    expect(await frame.evaluate(()=>window.undoCard===document.querySelector('[data-shape-card-id]'))).toBe(true);
    await card.locator('[data-delete-vertex="1"]').click();
    await frame.getByRole('dialog').getByRole('button',{name:'Remove vertex',exact:true}).click();await expect(card.locator('.rem-vertex-item')).toHaveCount(3);
    await undo.click();await expect(card.locator('.rem-vertex-item')).toHaveCount(4);expect(await draftCoordinates(frame)).toEqual(original);
    if(owner==='NSA'){
      await frame.evaluate(original=>{const map=UOS.ProgramMapController.getMapController(),id=map.getEditingShapeId();for(let i=1;i<=51;i++)map.updateVertex(id,0,[original[0][0]+i*.0000001,original[0][1]],{commit:true});for(let i=0;i<50;i++)document.querySelector('#spaceUndoDraft').click();},original);
      await expect(undo).toBeHidden();expect((await draftCoordinates(frame))[0][0]).toBe(original[0][0]+.0000001);
      await frame.locator('#spaceCancelDraft').click();await card.locator('[data-shape-action="edit"]').click();
    }
    expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities.geometries))).toBe(persisted);
    await lat.fill(String(original[0][1]+.00003));await lat.press('Tab');await frame.locator('#spaceAcceptDraft').click();
    await expect.poll(()=>frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries[0].geometry.coordinates[0][0][1])).toBe(original[0][1]+.00003);
    const saved=await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities.geometries));
    await card.locator('[data-shape-action="edit"]').click();await lat.fill(String(original[0][1]+.00006));await lat.press('Tab');await frame.locator('#spaceCancelDraft').click();
    expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities.geometries))).toBe(saved);expect(errors).toEqual([]);
  });

  test(`${owner}: radial Undo reverses Moasure movement and rotation with gesture-sized history`,async({page})=>{
    const {frame,errors}=await setup(page,owner);
    await frame.locator('#moasureCsvFile').setInputFiles({name:'undo.csv',mimeType:'text/csv',buffer:Buffer.from('Layer,Path,Point,X:m,Y:m\n1,1,1,0,0\n1,1,2,10,0\n1,1,3,0,10')});
    await expect(frame.locator('[data-moasure-group]')).toHaveCount(1);await frame.locator('#moasureAnchorButton').click();await point(frame,.5,.5);
    await expect(frame.locator('[data-placement-controls]')).toBeVisible();
    const undo=frame.locator('#spaceUndoDraft'),angle=frame.locator('[data-placement-angle]');await expect(undo).toBeHidden();
    const original=await draftCoordinates(frame),persisted=await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities.geometries));
    const center=await frame.evaluate(()=>{const b=UOS.ProgramApp.workspace().entities.geometries[0].localPlacement;return UOS.MoasureGeometry.place(UOS.MoasureGeometry.centroid(b.type,b.coordinates),b.anchor,b.bearing);});
    await dragCoordinate(page,frame,center);await expect(undo).toBeEnabled();expect(await draftCoordinates(frame)).not.toEqual(original);
    await undo.click();await expect(undo).toBeHidden();expect(await draftCoordinates(frame)).toEqual(original);
    const handle=await frame.locator('.program-map-rotation-handle').boundingBox();
    await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+25,handle.y+handle.height/2+20,{steps:8});await page.mouse.up();
    await expect(undo).toBeEnabled();await undo.click();await expect(undo).toBeHidden();expect(await draftCoordinates(frame)).toEqual(original);
    await angle.fill('30');await angle.press('Tab');await angle.fill('60');await angle.press('Tab');await undo.click();await expect(angle).toHaveValue('30');await undo.click();await expect(angle).toHaveValue('0');await expect(undo).toBeHidden();
    expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities.geometries))).toBe(persisted);
    // A new session is independent of previous movement and rotation history.
    await frame.locator('#spaceCancelDraft').click();await frame.locator('[data-polygon-placement]').click();await expect(undo).toBeHidden();
    await angle.fill('45');await angle.press('Tab');await frame.locator('#spaceAcceptDraft').click();
    await expect.poll(()=>frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries[0].localPlacement.bearing)).toBe(45);
    await expect(frame.locator('#spaceDraftActions')).toBeHidden();expect(errors).toEqual([]);
  });
}

for(const owner of ['NSA','EVT']){
  for(const entry of ['radial']){
    test(owner+': '+entry+' geometry creation uses third-tier Accept and Cancel',async({page})=>{
      const {frame,ids,errors}=await setup(page,owner);
      const orbs=frame.locator('#spaceDraftActions'),accept=frame.locator('#spaceAcceptDraft'),cancel=frame.locator('#spaceCancelDraft');
      await expect(orbs).toBeHidden();
      for(const [index,kind] of ['polygon','line','square'].entries()){
        await start(frame,kind,entry);await expect(orbs).toBeVisible();await expect(accept).toBeDisabled();await expect(cancel).toBeEnabled();
        await accept.evaluate(button=>button.click());
        expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing().coordinates.length)).toBe(0);
        if(entry==='radial'){
        await frame.locator('#spaceRadialToggle').click();await expect(orbs).toBeHidden();await frame.locator('#spaceRadialToggle').click();await expect(orbs).toBeHidden();
        expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing())).toBeNull();
        await start(frame,kind);
          expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing().coordinates.length)).toBe(0);
        }
        await point(frame,.35,.6);await expect(accept).toBeDisabled();
        await point(frame,.65,.6);
        if(kind==='polygon'){await expect(accept).toBeDisabled();await point(frame,.65,.85);}
        await expect(accept).toBeEnabled();
        expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries.length)).toBe(index);
        if(kind==='square'){
          await point(frame,.4,.85);
          expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing().coordinates.length)).toBe(2);
        }
        await frame.locator('#spaceUndoDraft').click();await expect(accept).toBeDisabled();
        await point(frame,.65,kind==='polygon'?.85:.6);await expect(accept).toBeEnabled();
        await accept.click();
        await expect.poll(()=>frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries.length)).toBe(index+1);
        await expect(orbs).toBeHidden();
      }
      const geometries=await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries);
      expect(geometries.map(g=>g.geometry.type)).toEqual(['Polygon','LineString','Polygon']);
      expect(geometries.every(g=>g.owner===owner && g.projectId===ids.projectId)).toBe(true);
      for(const kind of ['polygon','line','square']){
        await start(frame,kind,entry);await point(frame,.35,.6);await point(frame,.65,.6);
        if(kind==='polygon')await point(frame,.65,.85);
        await cancel.click();await expect(orbs).toBeHidden();
        expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries.length)).toBe(3);
      }
      expect(errors).toEqual([]);
    });
  }

  test(owner+': Location actions stage pins and mirror saving states',async({page})=>{
    const {frame,ids,errors}=await setup(page,owner,false);
    const orbs=frame.locator('#spaceDraftActions'),accept=frame.locator('#spaceAcceptDraft'),cancel=frame.locator('#spaceCancelDraft');
    for(const entry of ['radial']){
      await start(frame,'location',entry);await expect(orbs).toBeVisible();await expect(accept).toBeDisabled();
      await point(frame);await expect(accept).toBeEnabled();
      await frame.locator('#spaceUndoDraft').click();await expect(accept).toBeDisabled();
      await cancel.click();await startSpaceCreation(frame,"location");await point(frame,.6,.75);await expect(accept).toBeEnabled();
      expect(await frame.evaluate(id=>UOS.ProgramModel.registerLocations(UOS.ProgramApp.workspace(),id).length,ids.recordId)).toBe(1);
      await cancel.click();await expect(orbs).toBeHidden();await expect(frame.locator('[data-space-pin]')).toHaveCount(1);
      await start(frame,'location',entry);await point(frame,.6,.75);
      // Hold persistence briefly so the native busy/disabled state is observable.
      await frame.evaluate(()=>{
        window.draftOriginalUpdate=UOS.ProgramApp.updateWorkspace;
        UOS.ProgramApp.updateWorkspace=mutation=>new Promise((resolve,reject)=>{window.releaseDraftSave=()=>window.draftOriginalUpdate(mutation).then(resolve,reject);});
      });
      await accept.click();await expect(orbs).toBeVisible();await expect(accept).toBeDisabled();await expect(cancel).toBeDisabled();
      await frame.locator('#spaceRadialToggle').click();
      await expect(frame.locator('#spaceRadialToggle')).toHaveAttribute('aria-expanded','true');
      await expect(orbs).toBeVisible();
      await frame.evaluate(()=>{UOS.ProgramApp.updateWorkspace=window.draftOriginalUpdate;window.releaseDraftSave();delete window.draftOriginalUpdate;delete window.releaseDraftSave;});
      await expect(orbs).toBeHidden();await expect(frame.locator('[data-space-pin]')).toHaveCount(2);
      await frame.locator('[data-space-pin]').last().click();await frame.locator('#removeLocationButton').click();
      await frame.getByRole('dialog').filter({has:frame.getByRole('button',{name:'Remove pin',exact:true})}).getByRole('button',{name:'Remove pin',exact:true}).click();
      await expect(orbs).toBeHidden();
      await expect.poll(()=>frame.evaluate(id=>UOS.ProgramModel.registerLocations(UOS.ProgramApp.workspace(),id).length,ids.recordId)).toBe(1);
    }
    expect(errors).toEqual([]);
  });

}

test('third tier follows each parent, fits narrow layouts and supports keyboard and collapse',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const {frame,errors}=await setup(page);
  const orbs=frame.locator('#spaceDraftActions'),accept=frame.locator('#spaceAcceptDraft'),cancel=frame.locator('#spaceCancelDraft');
  await expect(frame.locator('#addLocationButton,#finishLocationButton,#cancelLocationButton,#finishDrawingButton,#cancelDrawingButton,[data-draw-mode]')).toHaveCount(0);
  for(const width of [1600,600,390,320]){
    await page.setViewportSize({width,height:1000});
    for(const theme of ['light','dark']){
      await frame.evaluate(theme=>document.documentElement.dataset.suiteTheme=theme,theme);
      for(const kind of ['location','polygon','line','square']){
        await start(frame,kind);await expect(orbs).toBeVisible();
        await expect(frame.locator('[data-space-create="'+kind+'"]')).toHaveAttribute('aria-current','true');
    await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const layout=await orbs.evaluate(e=>{
          const menu=e.closest('#spaceRadialMenu'),map=document.querySelector('#eventMap').getBoundingClientRect(),m=menu.getBoundingClientRect();
          return {inside:!!e.closest('#spaceRadialActions'),path:e.querySelector('path').getAttribute('d'),mapHeight:map.height,
            parent:(()=>{const r=menu.querySelector('[data-space-create="'+menu.dataset.activeParent+'"]').getBoundingClientRect();return {x:r.left+r.width/2-m.left,y:r.top+r.height/2-m.top};})(),
            hub:(()=>{const r=menu.querySelector('#spaceRadialToggle').getBoundingClientRect();return {x:r.left+r.width/2-m.left,y:r.top+r.height/2-m.top};})(),
            connectors:e.querySelector('path').getAttribute('d').split('M').slice(1).map(segment=>segment.split(/[ L]+/).map(Number)),
            firstTier:menu.querySelector('.space-radial__connections path').getAttribute('d').split('M').slice(1).map(segment=>segment.split(/[ L]+/).map(Number)),
            nodes:Array.from(menu.querySelectorAll('[data-space-create]')).map(b=>{const r=b.getBoundingClientRect();return {x:r.left+r.width/2-m.left,y:r.top+r.height/2-m.top};}),
            menuWidth:m.width,buttons:Array.from(e.querySelectorAll('button')).filter(b=>!b.hidden).map(b=>{const r=b.getBoundingClientRect();return {x:r.left+r.width/2-m.left,y:r.top+r.height/2-m.top,width:r.width,height:r.height,text:b.textContent.trim(),icons:b.querySelectorAll('svg').length,within:r.left>=map.left&&r.right<=map.right&&r.bottom<=map.bottom};})};
        });
        expect(layout.inside).toBe(true);expect(layout.path).toMatch(/^M/);expect(layout.mapHeight).toBeGreaterThanOrEqual(264);
    for(const b of layout.buttons){expect(b.width).toBeCloseTo(48,2);expect(b.height).toBeCloseTo(48,2);expect(b.text).toBe('');expect(b.icons).toBe(1);expect(b.within).toBe(true);}
        for(const [index,c] of layout.connectors.entries()){
          expect(Math.hypot(c[0]-layout.parent.x,c[1]-layout.parent.y)).toBeCloseTo(24,1);
          expect(Math.hypot(c[2]-layout.buttons[index].x,c[3]-layout.buttons[index].y)).toBeCloseTo(24,1);
        }
        for(const [index,c] of layout.firstTier.entries()){
          expect(Math.hypot(c[0]-layout.hub.x,c[1]-layout.hub.y)).toBeCloseTo(32,1);
          expect(Math.hypot(c[2]-layout.nodes[index].x,c[3]-layout.nodes[index].y)).toBeCloseTo(24,1);
        }
        if(kind==='location'||kind==='square'){
          const dx=layout.parent.x-layout.hub.x,dy=layout.parent.y-layout.hub.y,length=Math.hypot(dx,dy);
          const rays=layout.buttons.map(b=>{const x=b.x-layout.parent.x,y=b.y-layout.parent.y,l=Math.hypot(x,y);return {x:x/l,y:y/l};});
          const x=rays[0].x+rays[1].x,y=rays[0].y+rays[1].y;
          expect((x*dx+y*dy)/(Math.hypot(x,y)*length)).toBeCloseTo(1,3);
        }else if(kind==='polygon'||kind==='line')for(const b of layout.buttons)expect(b.y).toBeCloseTo(194,0);
        const centres=layout.nodes.concat(layout.buttons);
        for(let i=0;i<centres.length;i++)for(let j=i+1;j<centres.length;j++)expect(Math.hypot(centres[i].x-centres[j].x,centres[i].y-centres[j].y)).toBeGreaterThanOrEqual(47.9);
        await frame.locator('#spaceRadialToggle').click();await expect(orbs).toBeHidden();
        await frame.locator('#spaceRadialToggle').click();await expect(orbs).toBeVisible();
        await cancel.focus();await page.keyboard.press('Enter');await expect(orbs).toBeHidden();
        await expect(frame.locator('#spaceRadialToggle')).toHaveAttribute('aria-expanded','true');
      }
    }
  }
  await page.setViewportSize({width:1600,height:1000});await start(frame,'line');await point(frame,.35,.6);await point(frame,.65,.6);
  await accept.focus();await page.keyboard.press('Space');await expect.poll(()=>frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries.length)).toBe(1);
  expect(errors).toEqual([]);
});

test('pin Move and Remove and vertex editing use third-tier actions; Moasure keeps its own workflow',async({page})=>{
  const {frame,errors}=await setup(page);const orbs=frame.locator('#spaceDraftActions');
  await frame.locator('[data-space-mode="register"]').click();await expect(frame.locator('[data-space-mode="register"]')).toHaveAttribute('aria-pressed','true');
  await frame.locator('[data-space-pin]').click();await expect(orbs).toBeHidden();
  await frame.locator('#moveLocationButton').click();await expect(orbs).toBeVisible();
  await expect(frame.locator('[data-space-create="location"]')).toHaveAttribute('aria-current','true');
  await frame.locator('#spaceCancelDraft').click();await expect(orbs).toBeHidden();
  await start(frame,'polygon');await point(frame,.35,.6);await point(frame,.65,.6);await point(frame,.65,.85);
  await frame.locator('#spaceAcceptDraft').click();await expect(orbs).toBeHidden();
  await frame.locator('[data-shape-action="edit"]').click();await expect(orbs).toBeVisible();
  await expect(frame.locator('[data-space-create="polygon"]')).toHaveAttribute('aria-current','true');
  await frame.locator('#spaceCancelDraft').click();await expect(orbs).toBeHidden();
  await frame.locator('[data-polygon-placement]').click();await expect(orbs).toBeVisible();await expect(frame.locator('#spaceUndoDraft')).toBeHidden();await page.keyboard.press('Escape');
  await frame.locator('#moasureCsvFile').setInputFiles({name:'draft.csv',mimeType:'text/csv',buffer:Buffer.from('Layer,Path,Point,X:m,Y:m\n1,1,1,0,0\n1,1,2,10,0\n1,1,3,0,10')});await expect(orbs).toBeHidden();
  await frame.locator('[data-moasure-cancel]').first().click();expect(errors).toEqual([]);
});

test('line vertices branch from Line and saved square vertices branch from Polygon',async({page})=>{
  const {frame,errors}=await setup(page);
  for(const kind of ['line','square']){
    await start(frame,kind);await point(frame,.35,.6);await point(frame,.65,.6);
    await frame.locator('#spaceAcceptDraft').click();
    await expect.poll(()=>frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries.length)).toBe(kind==='line'?1:2);
    const id=await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries.at(-1).id);
    await frame.locator('[data-shape-card-id="'+id+'"] [data-shape-action="edit"]').click();
    await expect(frame.locator('#spaceDraftActions')).toBeVisible();
    await expect(frame.locator('[data-space-create="'+(kind==='line'?'line':'polygon')+'"]').first()).toHaveAttribute('aria-current','true');
    await frame.locator('#spaceRadialToggle').click();await expect(frame.locator('#spaceDraftActions')).toBeHidden();
    await frame.locator('#spaceRadialToggle').click();await expect(frame.locator('#spaceDraftActions')).toBeVisible();
    await page.keyboard.press('Escape');await expect(frame.locator('#spaceDraftActions')).toBeHidden();
    await expect(frame.locator('#spaceRadialToggle')).toHaveAttribute('aria-expanded','true');
  }
  expect(errors).toEqual([]);
});

test('a short narrow viewport keeps Undo reachable while preserving map space',async({page})=>{
  const {frame,errors}=await setup(page);await page.setViewportSize({width:390,height:700});
  await start(frame,'line');await point(frame,.1,.75);await point(frame,.9,.75);
  await frame.locator('#spaceUndoDraft').scrollIntoViewIfNeeded();await frame.locator('#spaceUndoDraft').click();
  await expect(frame.locator('#spaceAcceptDraft')).toBeDisabled();
  expect(await frame.locator('#eventMap').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(264);
  await frame.locator('#spaceCancelDraft').click();expect(errors).toEqual([]);
});

test('other map consumers retain automatic square completion by default',async({page})=>{
  const {frame,errors}=await setup(page);
  await frame.evaluate(() => UOS.ProgramRuntime.ensureLegacyMap());
  await frame.evaluate(()=>{
    const element=document.createElement('div');element.id='defaultSquareMap';element.style.cssText='position:fixed;inset:0;z-index:80';document.body.appendChild(element);
    window.defaultSquareShapes=[];
    window.defaultSquareController=UOS.RemediationMap.create({container:element,maplibregl, getWorkspaceMap:()=>({center:[138.6,-34.92],zoom:16,provider:'offline'}),onShapeCreated:shape=>window.defaultSquareShapes.push(shape)});
  });
  await frame.waitForFunction(()=>window.defaultSquareController.ready());
  await frame.evaluate(()=>window.defaultSquareController.startDrawing('square'));
  const canvas=frame.locator('#defaultSquareMap .maplibregl-canvas'),rect=await canvas.boundingBox();
  await canvas.click({position:{x:rect.width*.35,y:rect.height*.6}});await canvas.click({position:{x:rect.width*.65,y:rect.height*.6}});
  expect(await frame.evaluate(()=>window.defaultSquareShapes.length)).toBe(1);
  expect(await frame.evaluate(()=>window.defaultSquareController.getDrawing())).toBeNull();
  await frame.evaluate(()=>{window.defaultSquareController.destroy();document.querySelector('#defaultSquareMap').remove();delete window.defaultSquareController;delete window.defaultSquareShapes;});
  expect(errors).toEqual([]);
});
