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
          await frame.locator('#spaceRadialToggle').click();await expect(orbs).toBeHidden();await frame.locator('#spaceRadialToggle').click();await expect(orbs).toBeVisible();
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
        await frame.locator('#undoDrawingButton').click();await expect(accept).toBeDisabled();
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
      await frame.locator('#undoLocationButton').click();await expect(accept).toBeDisabled();
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
      await frame.evaluate(()=>{UOS.ProgramApp.updateWorkspace=window.draftOriginalUpdate;window.releaseDraftSave();delete window.draftOriginalUpdate;delete window.releaseDraftSave;});
      await expect(orbs).toBeHidden();await expect(frame.locator('[data-space-pin]')).toHaveCount(2);
      await frame.locator('[data-space-pin]').last().click();await frame.locator('#removeLocationButton').click();
      await frame.getByRole('dialog').filter({has:frame.getByRole('button',{name:'Remove pin',exact:true})}).getByRole('button',{name:'Remove pin',exact:true}).click();
      await expect(orbs).toBeVisible();await expect(accept).toBeEnabled();await frame.locator('#spaceAcceptDraft').click();await expect(orbs).toBeHidden();
      await expect.poll(()=>frame.evaluate(id=>UOS.ProgramModel.registerLocations(UOS.ProgramApp.workspace(),id).length,ids.recordId)).toBe(1);
    }
    expect(errors).toEqual([]);
  });

}

test('third tier follows each parent, fits narrow layouts and supports keyboard and collapse',async({page})=>{
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
        const layout=await orbs.evaluate(e=>{
          const menu=e.closest('#spaceRadialMenu'),map=document.querySelector('#eventMap').getBoundingClientRect(),m=menu.getBoundingClientRect();
          return {inside:!!e.closest('#spaceRadialActions'),path:e.querySelector('path').getAttribute('d'),mapHeight:map.height,
            parent:(()=>{const r=menu.querySelector('[data-space-create="'+menu.dataset.activeParent+'"]').getBoundingClientRect();return {x:r.left+r.width/2-m.left,y:r.top+r.height/2-m.top};})(),
            hub:{x:m.width/2,y:32},
            connectors:e.querySelector('path').getAttribute('d').split('M').slice(1).map(segment=>segment.split(/[ L]+/).map(Number)),
            firstTier:menu.querySelector('.space-radial__connections path').getAttribute('d').split('M').slice(1).map(segment=>segment.split(/[ L]+/).map(Number)),
            nodes:Array.from(menu.querySelectorAll('[data-space-create]')).map(b=>{const r=b.getBoundingClientRect();return {x:r.left+r.width/2-m.left,y:r.top+r.height/2-m.top};}),
            buttons:Array.from(e.querySelectorAll('button')).map(b=>{const r=b.getBoundingClientRect();return {x:r.left+r.width/2-m.left,y:r.top+r.height/2-m.top,width:r.width,height:r.height,text:b.textContent.trim(),icons:b.querySelectorAll('svg').length,within:r.left>=map.left&&r.right<=map.right&&r.bottom<=map.bottom};})};
        });
        expect(layout.inside).toBe(true);expect(layout.path).toMatch(/^M/);expect(layout.mapHeight).toBeGreaterThanOrEqual(264);
        for(const b of layout.buttons){expect(b.width).toBe(48);expect(b.height).toBe(48);expect(b.text).toBe('');expect(b.icons).toBe(1);expect(b.within).toBe(true);}
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
        }else for(const b of layout.buttons)expect(b.y).toBeCloseTo(194,0);
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
  await frame.locator('[data-space-pin]').click();await expect(orbs).toBeHidden();
  await frame.locator('#moveLocationButton').click();await expect(orbs).toBeVisible();
  await expect(frame.locator('[data-space-create="location"]')).toHaveAttribute('aria-current','true');
  await frame.locator('#spaceCancelDraft').click();await expect(orbs).toBeHidden();
  await start(frame,'polygon');await point(frame,.35,.6);await point(frame,.65,.6);await point(frame,.65,.85);
  await frame.locator('#spaceAcceptDraft').click();await expect(orbs).toBeHidden();
  await frame.locator('[data-shape-action="edit"]').click();await expect(orbs).toBeVisible();
  await expect(frame.locator('[data-space-create="polygon"]')).toHaveAttribute('aria-current','true');
  await frame.locator('#spaceCancelDraft').click();await expect(orbs).toBeHidden();
  await frame.locator('[data-polygon-placement]').click();await expect(orbs).toBeHidden();await page.keyboard.press('Escape');
  await frame.locator('#moasureImportButton').click();await expect(orbs).toBeHidden();
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
  await frame.locator('#undoDrawingButton').scrollIntoViewIfNeeded();await frame.locator('#undoDrawingButton').click();
  await expect(frame.locator('#spaceAcceptDraft')).toBeDisabled();
  expect(await frame.locator('#eventMap').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(264);
  await frame.locator('#spaceCancelDraft').click();expect(errors).toEqual([]);
});

test('other map consumers retain automatic square completion by default',async({page})=>{
  const {frame,errors}=await setup(page);
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
