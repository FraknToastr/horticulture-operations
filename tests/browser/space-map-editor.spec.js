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
for(const owner of ['NSA','EVT']){
  test(owner+': compact panels and temporary drawing row',async({page})=>{
    const {frame,errors}=await setup(page,owner);
    await expect(frame.locator('#floatingDrawToolbar,#providerSelect,#selectToolButton,.program-map-canvas-header')).toHaveCount(0);
    const sizes=await frame.locator('[data-space-panel]').evaluateAll(p=>p.map(x=>x.getBoundingClientRect().height));
    expect(sizes[1]/sizes[0]).toBeCloseTo(3,0);
    await startSpaceCreation(frame,"polygon");
    await expect(frame.locator('[data-space-draft]')).toBeVisible();
    await point(frame,.3,.5);await point(frame,.65,.5);await point(frame,.65,.8);
    await expect(frame.locator('[data-space-draft]')).toContainText('3 points');
    await frame.locator('#spaceAcceptDraft').click();
    await expect(frame.locator('[data-shape-card-id]')).toHaveCount(1);
    await expect(frame.locator('[data-space-draft]')).toHaveCount(0);
    await expect(frame.locator('[data-shape-action="edit"]')).toBeVisible();
    await frame.locator('[data-space-expand]').click();
    await frame.locator('[data-shape-visible]').uncheck();
    await expect.poll(()=>frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries[0].payload.visible)).toBe(false);
    await frame.locator('[data-space-collapse="location"]').click();
    await expect(frame.locator('#spaceLocationBody')).toBeHidden();
    const expanded=await frame.locator('[data-space-panel="space"]').evaluate(x=>x.getBoundingClientRect().height);
    expect(expanded).toBeGreaterThan(sizes[1]);
    expect(errors).toEqual([]);
  });
  test(owner+': pin Add/Move/Remove, Undo, Cancel and atomic Finish',async({page})=>{
    const {frame,ids,errors}=await setup(page,owner);
    const pins=()=>frame.evaluate(id=>UOS.ProgramModel.registerLocations(UOS.ProgramApp.workspace(),id),ids.recordId);
    const original=await pins();
    await startSpaceCreation(frame,"location");await point(frame);
    await expect(frame.locator('[data-space-pin]')).toHaveCount(2);expect(await pins()).toEqual(original);
    await frame.locator('#undoLocationButton').click();await expect(frame.locator('[data-space-pin]')).toHaveCount(1);
    await frame.locator("#spaceCancelDraft").click();await startSpaceCreation(frame,"location");await point(frame,.6,.65);
    await frame.locator('#spaceCancelDraft').click();await expect(frame.locator('[data-space-pin]')).toHaveCount(1);expect(await pins()).toEqual(original);
    await startSpaceCreation(frame,"location");await point(frame,.65,.7);
    await frame.locator('#spaceAcceptDraft').click();await expect.poll(async()=>(await pins()).length).toBe(2);
    await frame.locator('[data-space-pin]').first().click();
    await frame.locator('#moveLocationButton').click();await point(frame,.45,.6);
    expect((await pins()).find(p=>p.id===original[0].id).coordinate).toEqual(original[0].coordinate);
    await frame.locator('#spaceCancelDraft').click();
    await frame.locator('#removeLocationButton').click();
    await frame.getByRole('dialog').filter({has:frame.getByRole('button',{name:'Remove pin',exact:true})}).getByRole('button',{name:'Remove pin',exact:true}).click();
    await expect(frame.locator('[data-space-pin]')).toHaveCount(1);expect((await pins()).length).toBe(2);
    await frame.locator('#spaceAcceptDraft').click();await expect.poll(async()=>(await pins()).length).toBe(1);
    await expect(frame.locator('[data-space-pin] svg text')).toHaveText('1');
    await frame.locator('#labelLocationsButton').click();await expect(frame.locator('[data-space-pin] svg text')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('sidebar stacks above map at narrow width without horizontal overflow',async({page})=>{
  const {frame,errors}=await setup(page);
  await page.setViewportSize({width:600,height:900});
  const layout=await frame.evaluate(()=>{const sidebar=document.querySelector('.space-editor__sidebar').getBoundingClientRect(),map=document.querySelector('#eventMap').getBoundingClientRect();return {sidebar:{x:sidebar.x,bottom:sidebar.bottom,width:sidebar.width},map:{x:map.x,top:map.top,width:map.width},overflow:document.querySelector('.space-editor').scrollWidth>document.querySelector('.space-editor').clientWidth};});
  expect(layout.map.top).toBeGreaterThanOrEqual(layout.sidebar.bottom-1);expect(layout.overflow).toBe(false);expect(errors).toEqual([]);
});

test('pin numbering follows stored order, wraps at six and supports dark theme',async({page})=>{
  const {frame,ids,errors}=await setup(page);
  await frame.evaluate(async id=>UOS.ProgramApp.updateWorkspace(w=>{
    const r=w.entities.applications.find(r=>r.id===id);
    r.locations=Array.from({length:8},(_,i)=>({id:'NSA-LOC-'+(8-i),coordinate:[138.6+i*.0001,-34.92],name:'Pin '+(i+1)}));
    return w;
  }),ids.recordId);
  const pins=frame.locator('[data-space-pin]');
  await expect(pins).toHaveCount(8);
  expect(await pins.evaluateAll(p=>p.map(b=>b.getAttribute('data-space-pin')))).toEqual(Array.from({length:8},(_,i)=>'NSA-LOC-'+(8-i)));
  expect(await pins.evaluateAll(p=>p.map(b=>b.querySelector('text').textContent))).toEqual(['1','2','3','4','5','6','7','8']);
  const positions=await pins.evaluateAll(p=>p.map(b=>({x:b.offsetLeft,y:b.offsetTop})));
  expect(positions[5].y).toBe(positions[0].y);expect(positions[6].y).toBeGreaterThan(positions[0].y);
  await frame.evaluate(()=>document.documentElement.dataset.suiteTheme='dark');
  expect(await frame.locator('.space-editor__sidebar').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(36, 43, 49)');
  const before=await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities));
  await startSpaceCreation(frame,"location");await point(frame,.7,.7);
  await expect(pins).toHaveCount(9);
  await page.keyboard.press('Escape');await expect(pins).toHaveCount(8);
  expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(before);
  await expect(frame.locator('.uos-numbered-location-pin')).toHaveCount(8);
  expect(errors).toEqual([]);
});

test('360px sidebar, unoutlined white pin numbers and labelled control icons',async({page})=>{
  const {frame,errors}=await setup(page);
  expect(await frame.locator('.space-editor__sidebar').evaluate(e=>e.getBoundingClientRect().width)).toBe(360);
  const missing=await frame.locator('.space-editor button.uos-button,.space-editor summary.uos-button').evaluateAll(buttons=>buttons.filter(b=>!b.querySelector('svg')).map(b=>b.textContent));
  expect(missing).toEqual([]);
  expect(await frame.locator('.space-editor__tools button').evaluateAll(buttons=>buttons.filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.textContent))).toEqual([]);
  for(const theme of ['light','dark']){
    await frame.evaluate(theme=>document.documentElement.dataset.suiteTheme=theme,theme);
    const styles=await frame.locator('.space-editor__pin text,.uos-numbered-location-pin text').evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n);return {fill:s.fill,stroke:s.stroke,shadow:s.textShadow};}));
    expect(styles.length).toBeGreaterThan(1);
    for(const style of styles)expect(style).toEqual({fill:'rgb(255, 255, 255)',stroke:'none',shadow:'none'});
  }
  await frame.locator('#labelLocationsButton').focus();
  await page.keyboard.press('Enter');
  await expect(frame.locator('#labelLocationsButton')).toHaveAttribute('aria-pressed','false');
  expect(errors).toEqual([]);
});
test('master geometry visibility handles empty, mixed, all and none without affecting unrelated projects',async({page})=>{
  const {frame,errors}=await setup(page);
  await expect(frame.locator('[data-space-visible-all]')).toBeDisabled();
  await startSpaceCreation(frame,"polygon");
  await expect(frame.locator('[data-space-visible-all]')).toBeDisabled();
  await point(frame,.4,.45);await point(frame,.6,.45);await point(frame,.5,.65);
  await frame.locator('#spaceAcceptDraft').click();
  await frame.locator('[data-shape-action="duplicate"]').click();
  await expect(frame.locator('[data-shape-visible]')).toHaveCount(2);
  await expect(frame.locator('[data-space-visible-all]')).toBeChecked();
  const unrelated=await frame.evaluate(async()=>{
    let original;
    await UOS.ProgramApp.updateWorkspace(w=>{
      const id='NSA-APP-VISIBILITY-OTHER';
      w.entities.applications.push({id,owner:'NSA',type:'application',title:'Other visibility',status:'received',dateReceived:'2026-10-09'});
      const result=UOS.ProgramModel.promoteRegisterRecord(w,id);w=result.workspace;
      const geometry=JSON.parse(JSON.stringify(w.entities.geometries[0]));
      geometry.id='NSA-GEO-VISIBILITY-OTHER';geometry.projectId=result.project.id;
      geometry.payload.visible=true;
      w.entities.geometries.push(geometry);original=JSON.stringify(geometry);return w;
    });return original;
  });
  await expect(frame.locator('[data-shape-visible]')).toHaveCount(2);
  await frame.locator('[data-shape-visible]').first().uncheck();
  await expect.poll(()=>frame.locator('[data-space-visible-all]').evaluate(e=>e.indeterminate)).toBe(true);
  await frame.locator('[data-space-visible-all]').click();
  await expect.poll(()=>frame.locator('[data-shape-visible]').evaluateAll(nodes=>nodes.every(n=>n.checked))).toBe(true);
  await frame.locator('[data-space-visible-all]').click();
  await expect.poll(()=>frame.locator('[data-shape-visible]').evaluateAll(nodes=>nodes.every(n=>!n.checked))).toBe(true);
  await expect(frame.locator('[data-space-visible-all]')).not.toBeChecked();
  expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities.geometries.find(g=>g.id==='NSA-GEO-VISIBILITY-OTHER')))).toBe(unrelated);
  expect(errors).toEqual([]);
});

for (const owner of ['NSA','EVT']) {
  test(owner+': Moasure panel layout and import keyboard access in both themes and viewport sizes',async({page})=>{
    const {frame,errors}=await setup(page,owner);
    const toolbar=frame.locator('#spaceDrawingTools');
    await expect(frame.locator('#startDrawingButton')).toHaveCount(0);
    await expect(toolbar.getByRole('button',{name:'Import Moasure CSV',exact:true})).toBeVisible();
    const logo=toolbar.locator('.space-editor__moasure-logo img');
    await expect.poll(()=>logo.evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
    for(const width of [1600,600,390]) {
      await page.setViewportSize({width,height:1000});
      for(const theme of ['light','dark']) {
        await frame.evaluate(theme=>document.documentElement.dataset.suiteTheme=theme,theme);
        const layout=await toolbar.evaluate(tools=>{
          const panel=tools.querySelector('.space-editor__moasure-panel'),area=panel.querySelector('.space-editor__moasure-logo'),image=area.querySelector('img');
          const p=panel.getBoundingClientRect(),a=area.getBoundingClientRect(),i=image.getBoundingClientRect(),style=getComputedStyle(panel);
          const rows=Array.from(tools.querySelectorAll('.space-editor__tool-row'));
          return {padding:style.padding,gap:style.gap,logoHeight:a.height,centerError:Math.abs((i.left+i.right-a.left-a.right)/2),aspect:i.width/i.height,naturalAspect:image.naturalWidth/image.naturalHeight,
            panelTabIndex:panel.tabIndex,panelRole:panel.getAttribute('role'),panelWidth:p.width,buttonWidth:panel.querySelector('button').getBoundingClientRect().width,
            rowButtons:rows.map(row=>Array.from(row.querySelectorAll(':scope > button,:scope > details > summary')).map(b=>b.textContent.trim())),
            modeWidths:Array.from(tools.querySelectorAll('[data-space-create]')).map(b=>b.getBoundingClientRect().width),
            overflow:Array.from(tools.querySelectorAll('button,summary')).filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.textContent),toolsOverflow:tools.scrollWidth>tools.clientWidth+1};
        });
        expect(layout.padding).toBe('8px');expect(layout.gap).toBe('8px');expect(layout.logoHeight).toBe(56);
        expect(layout.centerError).toBeLessThan(1);expect(layout.aspect).toBeCloseTo(layout.naturalAspect,2);
        expect(layout.panelTabIndex).toBe(-1);expect(layout.panelRole).toBeNull();
        expect(layout.buttonWidth).toBeCloseTo(layout.panelWidth-18,0);
        expect(layout.rowButtons).toEqual([['Fit','Home','Labels'],['Undo']]);
        expect(layout.modeWidths).toEqual([]);
        expect(layout.overflow).toEqual([]);expect(layout.toolsOverflow).toBe(false);
      }
    }
    await page.setViewportSize({width:1600,height:1000});
    const before=await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities));
    // The panel and logo do not open the import; the native button does.
    await logo.click();await expect(frame.locator('#moasureImportDialog')).not.toBeVisible();
    const importButton=toolbar.locator('#moasureImportButton');await importButton.focus();await page.keyboard.press('Enter');
    await expect(frame.locator('#moasureImportDialog')).toBeVisible();await frame.locator('[data-moasure-cancel]').first().click();
    await importButton.focus();await page.keyboard.press('Tab');await expect(toolbar.locator('#zoomShapesButton')).toBeFocused();
    expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(before);
    expect(errors).toEqual([]);
  });
}

for(const owner of ['NSA','EVT']) for(const mode of ['polygon','line','square']) {
  test(owner+': keyboard starts '+mode+' drawing and Escape discards its draft',async({page})=>{
    const {frame,errors}=await setup(page,owner);
    const before=await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities));
    if(await frame.locator('#spaceRadialToggle').getAttribute('aria-expanded')==='false')await frame.locator('#spaceRadialToggle').click();
      const button=frame.locator('[data-space-create="'+mode+'"]');await button.focus();await expect(button).toBeFocused();
    await page.keyboard.press(mode==='line'?'Space':'Enter');
    await expect(button).toHaveAttribute('aria-current','true');await expect(button).toHaveClass(/is-active/);
    await expect(frame.locator('[data-space-create][aria-current="true"]')).toHaveCount(1);
    await expect(frame.locator('#spaceCancelDraft')).toBeEnabled();
    expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing().mode)).toBe(mode);
    await expect(frame.locator('[data-space-draft]')).toBeVisible();
    await page.keyboard.press('Escape');await expect(frame.locator('[data-space-draft]')).toHaveCount(0);
    expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(before);
    expect(errors).toEqual([]);
  });
}
