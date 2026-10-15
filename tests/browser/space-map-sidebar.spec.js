const {test,expect}=require('@playwright/test');
const {suppressBackupModalForFunctionalTest,startSpaceCreation}=require('./test-helper.cjs');
const csv='Layer,Path,Point,X:m,Y:m\n1,1,1,0,0\n1,1,2,10,0\n1,1,3,0,10';
async function setup(page,owner='NSA',project=true){
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({width:1600,height:1000});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.text().startsWith('ProgramMapController render issue:'))errors.push(m.text());});
  await page.goto(`/src/program-planner/${owner==='NSA'?'nsa':'events'}.html`);
  const frame=page.frames().find(f=>f!==page.mainFrame());
  await frame.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');
  const ids=await frame.evaluate(async({owner,project})=>{
    let ids;await UOS.ProgramApp.updateWorkspace(w=>{
      const id=owner+'-'+(owner==='NSA'?'APP':'EVENT')+'-SIDEBAR';
      w.entities[owner==='NSA'?'applications':'events'].push({id,owner,type:owner==='NSA'?'application':'event',title:'Sidebar test',status:'received',dateReceived:'2026-10-09'});
      let projectId='';if(project){const r=UOS.ProgramModel.promoteRegisterRecord(w,id);w=UOS.ProgramStatus.migrate(r.workspace);projectId=r.project.id;}
      w=UOS.ProgramModel.addLocationToRegister(w,id,{id:owner+'-PIN-SIDEBAR',coordinate:[138.6,-34.92]});
      w.workspace.selectedEntityId=id;w.workspace.selectedProjectId=projectId;
      ids={recordId:id,projectId};return w;
    });await UOS.ProgramApp.navigate('map');return ids;
  },{owner,project});
  await frame.waitForFunction(()=>UOS.ProgramMapController.getMapController()?.ready());
  return {frame,ids,errors};
}
async function point(frame,x=.6,y=.7){const canvas=frame.locator('.maplibregl-canvas'),r=await canvas.boundingBox();await canvas.click({position:{x:r.width*x,y:r.height*y}});}
async function mode(frame,value){await frame.locator(`[data-space-mode="${value}"]`).click();await expect(frame.locator(`[data-space-mode="${value}"]`)).toHaveAttribute('aria-pressed','true');await expect(frame.locator(`[data-space-mode="${value}"]`)).toBeEnabled();await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function drop(frame,files){await frame.locator('#moasureImportButton').evaluate((box,files)=>{const dt=new DataTransfer();for(const f of files)dt.items.add(new File([f.text||''],f.name,{type:f.type||'text/csv'}));box.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));},files);}
for(const owner of ['NSA','EVT']){

  test(owner+': Location Move stays active across clicks and Undo, Approve and Cancel retain the draft contract',async({page})=>{
    const {frame,ids,errors}=await setup(page,owner);
    const move=frame.locator('#moveLocationButton'),accept=frame.locator('#spaceAcceptDraft'),undo=frame.locator('#spaceUndoDraft'),cancel=frame.locator('#spaceCancelDraft');
    const saved=()=>frame.evaluate(id=>UOS.ProgramModel.registerLocations(UOS.ProgramApp.workspace(),id),ids.recordId);
    const preview=()=>frame.evaluate(()=>UOS.ProgramMapController.getMapController().getLocationSnapshot().features.features[0].geometry.coordinates);
    await frame.locator('[data-space-pin]').click();const original=await saved();
    await expect(move).toHaveAttribute('aria-pressed','false');const normal=await move.evaluate(n=>getComputedStyle(n).backgroundColor);
    await move.click();await expect(move).toHaveAttribute('aria-pressed','true');expect(await move.evaluate(n=>getComputedStyle(n).backgroundColor)).not.toBe(normal);
    await point(frame,.40,.65);const first=await preview();await expect(move).toHaveAttribute('aria-pressed','true');await expect(undo).toBeEnabled();
    await point(frame,.65,.72);const second=await preview();expect(second).not.toEqual(first);expect(await saved()).toEqual(original);
    await undo.click();expect(await preview()).toEqual(first);await expect(move).toHaveAttribute('aria-pressed','true');
    await undo.click();expect(await preview()).toEqual(original[0].coordinate);await expect(undo).toBeHidden();await expect(move).toHaveAttribute('aria-pressed','true');
    await point(frame,.55,.62);await move.click();await expect(move).toHaveAttribute('aria-pressed','false');await expect(frame.locator('#spaceDraftActions')).toBeHidden();expect(await saved()).toEqual(original);expect(await preview()).toEqual(original[0].coordinate);
    await move.click();await point(frame,.42,.68);await point(frame,.62,.76);const final=await preview();await accept.click();
    await expect(move).toHaveAttribute('aria-pressed','false');await expect.poll(async()=>(await saved())[0].coordinate).toEqual(final);
    await move.click();await point(frame,.38,.64);await cancel.click();await expect(move).toHaveAttribute('aria-pressed','false');expect((await saved())[0].coordinate).toEqual(final);expect(await preview()).toEqual(final);
    await page.reload();const restored=page.frames().find(f=>f!==page.mainFrame());await restored.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');expect((await restored.evaluate(id=>UOS.ProgramModel.registerLocations(UOS.ProgramApp.workspace(),id),ids.recordId))[0].coordinate).toEqual(final);expect(errors).toEqual([]);
  });


  test(`${owner}: Location removal uses permanent confirmation and resolves unfinished edits`,async({page})=>{
    const {frame,ids,errors}=await setup(page,owner);
    await mode(frame,'register');await frame.locator('[data-space-pin]').click();
    const move=frame.locator('#moveLocationButton'),remove=frame.locator('#removeLocationButton'),orbs=frame.locator('#spaceDraftActions'),undo=frame.locator('#spaceUndoDraft');
    const pins=()=>frame.evaluate(id=>UOS.ProgramModel.registerLocations(UOS.ProgramApp.workspace(),id),ids.recordId),original=await pins();
    await expect(move).toBeVisible();
    await expect.poll(()=>frame.evaluate(()=>{
      const view=document.querySelector('#fitLocationsButton').getBoundingClientRect(),edit=document.querySelector('#moveLocationButton').getBoundingClientRect();
      return view.height>0 && edit.height>0 && view.bottom<=edit.top;
    })).toBe(true);
    await expect(move.locator('svg path')).toHaveAttribute('d','M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3');
    const colour=await frame.evaluate(()=>getComputedStyle(document.querySelector('#removeLocationButton svg')).color.match(/\d+/g).map(Number));
    expect(colour[0]).toBeGreaterThan(colour[1]*1.3);expect(colour[0]).toBeGreaterThan(colour[2]*1.3);
    const dialog=frame.getByRole('dialog').filter({has:frame.getByRole('button',{name:'Remove pin',exact:true})});

    // Merely entering Move is not unfinished work.
    await move.click();await remove.click();await expect(dialog).toBeVisible();await expect(orbs).toBeHidden();
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(remove).toBeEnabled();expect(await pins()).toEqual(original);

    await move.click();await point(frame,.65,.75);await expect(undo).toBeVisible();
    await remove.click();await expect(frame.locator('#spaceSwitchDialog')).toBeVisible();
    await expect(frame.locator('#spaceDiscardSwitch')).toHaveText('Discard edits');
    await frame.locator('#spaceKeepEditing').click();await expect(remove).toBeEnabled();
    await expect(orbs).toBeVisible();await expect(undo).toBeVisible();expect(await pins()).toEqual(original);
    await remove.click();await frame.locator('#spaceDiscardSwitch').click();
    await expect(dialog).toBeVisible();await expect(orbs).toBeHidden();
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(remove).toBeEnabled();expect(await pins()).toEqual(original);

    // Discarding an unsaved new pin must not delete a saved pin.
    await startSpaceCreation(frame,'location');await point(frame,.6,.75);await remove.click();await frame.locator('#spaceDiscardSwitch').click();
    await expect(orbs).toBeHidden();await expect(dialog).toBeHidden();expect(await pins()).toEqual(original);
    await frame.locator('[data-space-pin]').click();await remove.click();await expect(dialog).toBeVisible();
    await frame.evaluate(async id=>UOS.ProgramApp.updateWorkspace(w=>{
      const record=w.entities.applications.concat(w.entities.events).find(r=>r.id===id);record.title+=' changed';return w;
    }),ids.recordId);
    await dialog.getByRole('button',{name:'Remove pin',exact:true}).click();
    await expect(frame.locator('.uos-toast').filter({hasText:'changed'})).toBeVisible();
    await expect(remove).toBeEnabled();expect(await pins()).toEqual(original);await expect(orbs).toBeHidden();

    await remove.click();await dialog.getByRole('button',{name:'Remove pin',exact:true}).click();
    await expect.poll(pins).toEqual([]);await expect(orbs).toBeHidden();await expect(undo).toBeHidden();
    await page.reload();const restored=page.frames().find(f=>f!==page.mainFrame());
    await restored.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');
    expect(await restored.evaluate(id=>UOS.ProgramModel.registerLocations(UOS.ProgramApp.workspace(),id),ids.recordId)).toEqual([]);
    expect(errors).toEqual([]);
  });
  test(`${owner}: combined sidebar order, themes, saved mode and map payload filtering`,async({page})=>{
    const {frame,ids,errors}=await setup(page,owner);
    await expect(frame.locator('[data-space-panel]')).toHaveCount(1);
    await expect(frame.locator('[data-space-collapse]')).toHaveCount(0);
    await expect(frame.locator('#spaceLocationBody')).toBeVisible();
    await expect(frame.locator('#spaceManagementBody')).toBeHidden();await expect(frame.locator('#coordinateShapeButton')).toBeHidden();
    await frame.evaluate(async ids=>UOS.ProgramApp.updateWorkspace(w=>{
      for(const [i,type] of ['Polygon','LineString','Polygon'].entries()){
        const coordinates=type==='Polygon'?[[[138.6,-34.92],[138.601,-34.92],[138.601,-34.921],[138.6,-34.92]]]:[[138.6,-34.92],[138.602,-34.922]];
        w=UOS.WorkAreaService.createGeometry(w,ids.projectId,{id:ids.recordId.split('-')[0]+'-GEO-SIDEBAR-'+i,geometry:{type,coordinates},payload:{visible:i!==2}});
      }return w;
    }),ids);
    const before=await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities));
    const features=()=>frame.evaluate(()=>UOS.ProgramMapController.getMapController().getOperationalSnapshot().features.features);
    expect(await features()).toHaveLength(0);await expect(frame.locator('.uos-numbered-location-pin')).toHaveCount(1);
    await mode(frame,'projects');await expect(frame.locator('.uos-numbered-location-pin')).toHaveCount(0);expect(await features()).toHaveLength(2);
    await expect(frame.locator('#shapeList [data-shape-card-id]')).toHaveCount(3);
    await expect(frame.locator('.space-editor__geometry-card h3')).toHaveText(['1. Event Space','2. Event Space','3. Event Space']);
    await expect(frame.locator('.space-editor__geometry-card').first().locator('.space-editor__fields tbody th')).toHaveText(['Job Type','Cost Type','Measure']);
    await expect(frame.locator('.space-editor__geometry-card').first().locator('.program-shape-actions button')).toHaveCount(6);
    const card=frame.locator('.space-editor__geometry-card').first();
    await expect(card.locator('.space-editor__fields thead')).toHaveCount(0);
    await expect(card.locator('.program-shape-actions')).toBeVisible();
    await expect(card.locator('.space-editor__drawer')).toBeHidden();
    await card.locator('[data-space-expand]').click();await expect(card).toHaveAttribute('data-card-size','minimal');
    await card.locator('[data-space-expand]').click();await expect(card.locator('.program-shape-actions')).toBeVisible();
    await expect.poll(()=>frame.evaluate(()=>{
      const card=document.querySelector('.space-editor__geometry-card');
      const controls=[...card.querySelectorAll('.program-shape-actions .uos-button,.uos-select,.uos-input')].map(node=>getComputedStyle(node));
      return {consistent:controls.length>6 && controls.every(style=>style.borderTopWidth==='1px' && style.borderTopStyle==='solid' && style.borderTopColor===controls[0].borderTopColor && style.borderRadius==='2px'),seam:getComputedStyle(card.querySelector('.space-editor__fields tr:last-child td')).borderBottomWidth,shadow:getComputedStyle(card).boxShadow};
    })).toEqual({consistent:true,seam:'0px',shadow:'none'});
    await expect.poll(()=>card.locator('.space-editor__fields tr').first().evaluate(row=>{const label=row.cells[0].getBoundingClientRect().width,value=row.cells[1].getBoundingClientRect().width;return {compact:label>0 && label<value/2,wrap:getComputedStyle(row.cells[0]).whiteSpace};})).toEqual({compact:true,wrap:'nowrap'});
    await card.locator('[data-space-expand]').click();await expect(card.locator('.program-shape-actions')).toBeVisible();
    await expect(card.locator('.space-editor__drawer')).toBeHidden();
    await expect(card.locator('.space-editor__fields')).toBeVisible();
    await card.locator('[data-shape-action="edit"]').click();
    const edit=card.locator('[data-shape-action="edit"]');await expect(edit).toHaveAttribute('aria-pressed','true');
    await page.mouse.move(0,0);
    for(const theme of ['light','dark']){
      await frame.evaluate(t=>document.documentElement.dataset.suiteTheme=t,theme);
      await expect(edit).toHaveCSS('color','rgb(255, 255, 255)');
      await expect(edit.locator('svg')).toHaveCSS('stroke','rgb(255, 255, 255)');
      await edit.hover();
      expect(await edit.evaluate(button=>{const style=getComputedStyle(button);return getComputedStyle(button.querySelector('svg')).stroke===style.color && style.color!==style.backgroundColor;})).toBe(true);
      await page.mouse.move(0,0);
    }
    await frame.locator('#spaceCancelDraft').click();await frame.evaluate(()=>document.documentElement.dataset.suiteTheme='light');
    await expect(frame.locator('#coordinateShapeButton')).toBeEnabled();await frame.locator('#coordinateShapeButton').click();await expect(frame.locator('#coordinateShapeDialog')).toBeVisible();await frame.locator('#cancelCoordinateShapeButton').click();
    await frame.locator('.program-map-menu--display summary').click();await expect(frame.locator('#toggleMapArea')).toBeVisible();await frame.locator('#toggleMapArea').click();
    await frame.locator('.program-map-menu--display summary').click();
    for(const theme of ['light','dark']){
      await frame.evaluate(t=>document.documentElement.dataset.suiteTheme=t,theme);
      const layout=await frame.locator('.space-editor').evaluate(editor=>{
        const sidebar=editor.querySelector('.space-editor__sidebar');
        const nodes=['.space-editor__mode','#moveLocationButton','#fitLocationsButton','#coordinateShapeButton','#shapeList','#moasureImportButton'].map(s=>editor.querySelector(s).getBoundingClientRect()).filter(r=>r.width && r.height);
        return {width:sidebar.getBoundingClientRect().width,background:getComputedStyle(sidebar).backgroundColor,tops:nodes.map(r=>r.top),rows:[...editor.querySelectorAll('.space-editor__tool-row')].map(r=>[...r.children].map(b=>b.getBoundingClientRect().width))};
      });expect(layout.width).toBe(360);expect(layout.background).toBe(theme==='dark'?'rgb(36, 43, 49)':'rgb(241, 243, 245)');
      expect(layout.tops).toEqual([...layout.tops].sort((a,b)=>a-b));for(const row of layout.rows)expect(Math.max(...row)-Math.min(...row)).toBeLessThan(1);
    }
    expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(before);
    await page.reload();const restored=page.frames().find(f=>f!==page.mainFrame());await restored.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');await restored.evaluate(()=>UOS.ProgramApp.navigate('map'));
    await expect(restored.locator('[data-space-mode="projects"]')).toHaveAttribute('aria-pressed','true');
    await mode(restored,'register');await restored.locator('#labelLocationsButton').click();await expect(restored.locator('#labelLocationsButton')).toHaveAttribute('aria-pressed','false');await expect(restored.locator('.space-editor__pin text')).toHaveText('1');await expect(restored.locator('.uos-numbered-location-pin text')).toHaveCount(0);expect(errors).toEqual([]);
  });
  test(`${owner}: draft switching, radial guard, pin targeting and supported undo`,async({page})=>{
    const {frame,ids,errors}=await setup(page,owner);
    const original=await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities));
    for(const kind of ['location','polygon','line','square','location','line']){
      await startSpaceCreation(frame,kind);
      await expect(frame.locator('#spaceSwitchDialog')).toBeHidden();
    }
    await mode(frame,'register');await expect(frame.locator('#spaceSwitchDialog')).toBeHidden();
    await expect(frame.locator('#spaceDraftActions')).toBeHidden();
    expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(original);
    await frame.locator('[data-space-pin]').click();await frame.locator('#moveLocationButton').click();await point(frame);
    await expect(frame.locator('#spaceUndoDraft')).toBeEnabled();await frame.locator('#spaceUndoDraft').click();
    await expect(frame.locator('#spaceUndoDraft')).toBeDisabled();
    await mode(frame,'projects');await expect(frame.locator('#spaceSwitchDialog')).toBeHidden();
    await mode(frame,'register');await frame.locator('[data-space-pin]').click();await frame.locator('#moveLocationButton').click();await point(frame,.65,.75);
    await frame.locator('[data-space-mode="projects"]').click();await expect(frame.locator('#spaceSwitchDialog')).toBeVisible();await frame.locator('#spaceKeepEditing').click();await expect(frame.locator('[data-space-mode="register"]')).toHaveAttribute('aria-pressed','true');
    await expect(frame.locator('#spaceDraftActions')).toBeVisible();
    await frame.locator('[data-space-create="line"]').click();await expect(frame.locator('#spaceSwitchDialog')).toBeVisible();await frame.locator('#spaceDiscardSwitch').click();await expect(frame.locator('[data-space-mode="projects"]')).toHaveAttribute('aria-pressed','true');
    await point(frame);await expect(frame.locator('#spaceUndoDraft')).toBeEnabled();
    await frame.locator('[data-space-create="polygon"]').click();await expect(frame.locator('#spaceSwitchDialog')).toBeVisible();await frame.locator('#spaceKeepEditing').click();
    expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing().coordinates.length)).toBe(1);
    await frame.locator('#spaceUndoDraft').click();expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getDrawing().coordinates)).toEqual([]);
    await frame.locator('[data-space-mode="register"]').click();await expect(frame.locator('#spaceSwitchDialog')).toBeHidden();await expect(frame.locator('#spaceDraftActions')).toBeHidden();
    expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(original);
    await frame.locator('[data-space-pin]').click();await frame.locator('#removeLocationButton').click();await frame.getByRole('button',{name:'Remove pin',exact:true}).click();await expect(frame.locator('[data-space-pin]')).toHaveCount(0);await expect(frame.locator('#spaceDraftActions')).toBeHidden();
    await startSpaceCreation(frame,'location');await point(frame);await frame.locator('#spaceAcceptDraft').click();await expect.poll(()=>frame.evaluate(id=>UOS.ProgramModel.registerLocations(UOS.ProgramApp.workspace(),id).length,ids.recordId)).toBe(1);expect(errors).toEqual([]);
  });
  test(`${owner}: keyboard Moasure chooser, cancelled browsing, validation and drop preview`,async({page})=>{
    const {frame,errors}=await setup(page,owner);
    for(const key of ['Enter','Space']){
      await expect(frame.locator('#moasureImportButton')).toBeEnabled();const chooser=page.waitForEvent('filechooser');await frame.locator('#moasureImportButton').press(key);await (await chooser).setFiles([]);
      await expect(frame.locator('[data-space-mode="register"]')).toHaveAttribute('aria-pressed','true');await expect(frame.locator('#moasureImportDialog')).toBeHidden();
    }
    await drop(frame,[{name:'bad.txt',text:csv}]);await expect(frame.locator('#moasureDropStatus')).toContainText('.csv');
    await drop(frame,[{name:'a.csv',text:csv},{name:'b.csv',text:csv}]);await expect(frame.locator('#moasureDropStatus')).toContainText('one');
    await frame.locator('#moasureCsvFile').setInputFiles({name:'big.csv',mimeType:'text/csv',buffer:Buffer.alloc(5000001)});await expect(frame.locator('#moasureDropStatus')).toContainText('5 MB');
    await drop(frame,[{name:'valid.csv',text:csv}]);await expect(frame.locator('[data-moasure-group]')).toHaveCount(1);await expect(frame.locator('#moasureAnchorButton')).toBeEnabled();
    await expect(frame.locator('[data-space-mode="projects"]')).toHaveAttribute('aria-pressed','true');expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries.length)).toBe(0);
    expect(await frame.locator('#moasureCsvFile').getAttribute('tabindex')).toBe('-1');await expect(frame.locator('#moasureCsvFile')).toBeHidden();
    const chooser=page.waitForEvent('filechooser');await frame.locator('#moasureReplaceFile').click();await (await chooser).setFiles([]);await expect(frame.locator('[data-moasure-group]')).toHaveCount(1);
    await frame.locator('#moasureCsvFile').setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('bad data')});await expect(frame.locator('[data-moasure-group]')).toHaveCount(0);await expect(frame.locator('#moasureImportError')).toBeVisible();await expect(frame.locator('#moasureAnchorButton')).toBeDisabled();
    await frame.locator('#moasureCsvFile').setInputFiles({name:'valid.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await expect(frame.locator('[data-moasure-group]')).toHaveCount(1);await expect(frame.locator('#moasureImportError')).toBeHidden();await frame.locator('[data-moasure-cancel]').first().click();expect(errors).toEqual([]);
  });
  test(`${owner}: Moasure protects drafts, stale reads and save locks`,async({page})=>{
    const {frame,errors}=await setup(page,owner);
    await startSpaceCreation(frame,'location');await point(frame);
    await drop(frame,[{name:'valid.csv',text:csv}]);await expect(frame.locator('#spaceSwitchDialog')).toBeVisible();await frame.locator('#spaceKeepEditing').click();await expect(frame.locator('#spaceDraftActions')).toBeVisible();await expect(frame.locator('#moasureImportDialog')).toBeHidden();
    await drop(frame,[{name:'valid.csv',text:csv}]);await frame.locator('#spaceDiscardSwitch').click();await expect(frame.locator('[data-moasure-group]')).toHaveCount(1);
    await frame.evaluate(()=>{const original=File.prototype.text;File.prototype.text=function(){if(this.name==='slow.csv')return new Promise((resolve,reject)=>{window.rejectSlowCsv=reject;});return original.call(this);};});
    await frame.locator('#moasureCsvFile').setInputFiles({name:'slow.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await expect(frame.locator('[data-moasure-group]')).toHaveCount(0);
    await frame.locator('#moasureCsvFile').setInputFiles({name:'new.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await expect(frame.locator('[data-moasure-group]')).toHaveCount(1);await frame.evaluate(()=>window.rejectSlowCsv(new Error('Old file failed')));await expect(frame.locator('#moasureImportError')).toBeHidden();
    await frame.locator('[data-moasure-cancel]').first().click();await startSpaceCreation(frame,'location');await point(frame);
    await frame.evaluate(()=>{const original=UOS.ProgramApp.updateWorkspace;UOS.ProgramApp.updateWorkspace=change=>new Promise((resolve,reject)=>{window.releaseSidebarSave=()=>{UOS.ProgramApp.updateWorkspace=original;original(change).then(resolve,reject);};});});
    await frame.locator('#spaceAcceptDraft').click();await expect(frame.locator('[data-space-mode="projects"]')).toBeDisabled();await expect(frame.locator('#moasureImportButton')).toBeDisabled();await expect(frame.locator('#moasureDropStatus')).toBeHidden();await frame.evaluate(()=>window.releaseSidebarSave());await expect(frame.locator('#moasureImportButton')).toBeEnabled();expect(errors).toEqual([]);
  });
  test(`${owner}: missing Project disables Data and Moasure while Location remains usable`,async({page})=>{
    const {frame,errors}=await setup(page,owner,false);await expect(frame.locator('#moasureImportButton')).toBeDisabled();await expect(frame.locator('#moasureDropStatus')).toContainText('Project');await mode(frame,'projects');await expect(frame.locator('#coordinateShapeButton')).toBeDisabled();
    const create=frame.locator('#spaceProjectEmpty button');await expect(create).toBeVisible();await expect(frame.locator('#shapeList')).toBeEmpty();await expect(frame.locator('#shapeList')).toBeHidden();
    await expect.poll(()=>frame.evaluate(()=>{
      const button=document.querySelector('#spaceProjectEmpty button').getBoundingClientRect(),tools=document.querySelector('.space-editor__tools').getBoundingClientRect(),moasure=document.querySelector('.space-editor__moasure-section').getBoundingClientRect();
      return {large:button.height>=64,centered:Math.abs(button.x+button.width/2-(tools.x+tools.width/2))<2 && Math.abs(button.y+button.height/2-(tools.bottom+moasure.top)/2)<8};
    })).toEqual({large:true,centered:true});
    await drop(frame,[{name:'valid.csv',text:csv}]);await expect(frame.locator('#moasureImportDialog')).toBeHidden();await startSpaceCreation(frame,'location');await expect(frame.locator('[data-space-mode="register"]')).toHaveAttribute('aria-pressed','true');await frame.locator('#spaceCancelDraft').click();
    await mode(frame,'projects');await create.click();await expect(create).toHaveCount(0);await expect(frame.locator('#coordinateShapeButton')).toBeEnabled();await expect(frame.locator('#moasureImportButton')).toBeEnabled();await expect(frame.locator('#shapeList')).toBeEmpty();await expect(frame.locator('[data-space-visible-all]')).toHaveCount(0);expect(errors).toEqual([]);
  });
  test(`${owner}: Inspector Move and Remove target the selected outline`,async({page})=>{
    const {frame,errors}=await setup(page,owner);
    for(let i=0;i<2;i++){
      await startSpaceCreation(frame,'polygon');await point(frame,.35+i*.1,.55);await point(frame,.6+i*.1,.55);await point(frame,.6+i*.1,.8);await frame.locator('#spaceAcceptDraft').click();await expect(frame.locator('[data-shape-card-id]')).toHaveCount(i+1);
    }
    const originals=await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries);
    const row=frame.locator('[data-space-geometry]').first(),selectedId=await row.getAttribute('data-space-geometry'),other=originals.find(g=>g.id!==selectedId);
    await row.click();await expect.poll(()=>frame.evaluate(()=>UOS.ProgramMapController.canonicalMapState(UOS.ProgramApp.workspace()).selectedGeometryId)).toBe(selectedId);
    await row.locator('[data-polygon-placement]').click();await expect(frame.locator(`[data-placement-controls="${selectedId}"]`)).toBeVisible();
    await frame.locator('[data-placement-angle]').fill('45');await frame.locator('[data-cancel-placement]').click();expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries)).toEqual(originals);
    await row.locator('[data-polygon-placement]').click();await frame.locator('[data-placement-angle]').fill('45');await frame.locator('[data-save-placement]').click();await expect.poll(()=>frame.evaluate(id=>UOS.ProgramApp.workspace().entities.geometries.find(g=>g.id===id).localPlacement?.bearing,selectedId)).toBe(45);
    expect(await frame.evaluate(id=>UOS.ProgramApp.workspace().entities.geometries.find(g=>g.id===id),other.id)).toEqual(other);
    await row.locator('[data-shape-action="delete"]').click();await expect(frame.locator('#deleteShapeDialog')).toBeVisible();await frame.locator('#cancelDeleteShapeButton').click();await expect(frame.locator('[data-shape-card-id]')).toHaveCount(2);
    await row.locator('[data-shape-action="delete"]').click();await frame.locator('#confirmDeleteShapeButton').click();await expect.poll(()=>frame.evaluate(()=>UOS.ProgramApp.workspace().entities.geometries.map(g=>g.id))).toEqual([other.id]);
    await expect(frame.locator('#spaceUndoDraft')).toBeDisabled();
    await frame.evaluate(()=>{const map=UOS.ProgramMapController.getMapController();window.sidebarReady=map.ready;map.ready=()=>false;UOS.ProgramMapController.render();});await expect(frame.locator('#moasureImportButton')).toBeDisabled();await expect(frame.locator('#moasureDropStatus')).toContainText('unavailable');
    await frame.evaluate(()=>{UOS.ProgramMapController.getMapController().ready=window.sidebarReady;UOS.ProgramMapController.render();});await expect(frame.locator('#moasureImportButton')).toBeEnabled();expect(errors).toEqual([]);
  });
}

for(const owner of ['NSA','EVT']){
  test(`${owner}: silent immediate mode changes preserve toolbar positions and recover from failed saves`,async({page})=>{
    const {frame,ids,errors}=await setup(page,owner);
    await frame.evaluate(async ids=>UOS.ProgramApp.updateWorkspace(w=>UOS.WorkAreaService.createGeometry(w,ids.projectId,{geometry:{type:'Polygon',coordinates:[[[138.6,-34.92],[138.601,-34.92],[138.601,-34.921],[138.6,-34.92]]]},payload:{visible:true}})),ids);
    const positions=()=>frame.locator('.space-editor').evaluate(editor=>['.space-editor__mode','.space-editor__tool-row','.space-editor__moasure-section'].map(s=>{const r=editor.querySelector(s).getBoundingClientRect();return [r.top,r.height];}));
    const before=await positions();
    const delay=()=>frame.evaluate(()=>{
      const original=UOS.ProgramApp.updateWorkspace;
      UOS.ProgramApp.updateWorkspace=change=>new Promise((resolve,reject)=>{window.releaseModeSave=success=>{UOS.ProgramApp.updateWorkspace=original;if(success)original(change).then(resolve,reject);else reject(new Error('Mode save failed'));};});
    });
    await delay();
    const projects=frame.locator('[data-space-mode="projects"]');await projects.focus();await projects.press('Enter');
    await expect(projects).toHaveAttribute('aria-pressed','true');await expect(projects).toBeDisabled();await expect(projects).toBeFocused();
    await expect(frame.locator('#spaceManagementBody')).toBeVisible();await expect(frame.locator('#moasureDropStatus')).toBeHidden();
    expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().workspace.map.scopeMode)).toBe('register');
    expect(await frame.evaluate(()=>UOS.ProgramMapController.getMapController().getOperationalSnapshot().features.features.length)).toBe(1);
    expect(await positions()).toEqual(before);
    await frame.evaluate(()=>window.releaseModeSave(true));await expect(projects).toBeEnabled();
    expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().workspace.map.scopeMode)).toBe('projects');
    await delay();await frame.locator('[data-space-mode="register"]').click();await expect(frame.locator('#spaceLocationBody')).toBeVisible();
    await frame.evaluate(()=>window.releaseModeSave(false));await expect(projects).toHaveAttribute('aria-pressed','true');await expect(projects).toBeEnabled();
    await expect(frame.locator('#spaceManagementBody')).toBeVisible();await expect(frame.locator('#mapToolStatus')).toContainText('Mode save failed');
    expect(await positions()).toEqual(before);expect(errors).toEqual([]);
  });

  test(`${owner}: both lists scroll behind the fixed Moasure section and restore their own positions`,async({page})=>{
    const {frame,ids,errors}=await setup(page,owner);await page.setViewportSize({width:1600,height:850});
    await frame.evaluate(async ids=>UOS.ProgramApp.updateWorkspace(w=>{
      for(let i=0;i<90;i++)w=UOS.ProgramModel.addLocationToRegister(w,ids.recordId,{id:ids.recordId+'-SCROLL-'+i,coordinate:[138.6+i*.0001,-34.92]});
      for(let i=0;i<18;i++)w=UOS.WorkAreaService.createGeometry(w,ids.projectId,{id:ids.recordId.split('-')[0]+'-GEO-SCROLL-'+i,geometry:{type:'Polygon',coordinates:[[[138.6,-34.92],[138.601,-34.92],[138.601,-34.921],[138.6,-34.92]]]},payload:{visible:true}});
      return w;
    }),ids);
    const metrics=()=>frame.locator('.space-editor').evaluate(editor=>{
      const body=editor.querySelector('.space-editor__body'),footer=editor.querySelector('.space-editor__moasure-section'),sidebar=editor.querySelector('.space-editor__sidebar');
      return {footerTop:footer.getBoundingClientRect().top,footerBottom:footer.getBoundingClientRect().bottom,sidebarBottom:sidebar.getBoundingClientRect().bottom,bodyBottom:body.getBoundingClientRect().bottom,scroll:body.scrollTop};
    });
    const bottom=()=>frame.locator('.space-editor__body').evaluate(body=>body.scrollTop=body.scrollHeight);
    const lastPin=frame.locator('[data-space-pin]').last();await bottom();const location=await metrics();
    expect(location.scroll).toBeGreaterThan(0);expect(location.footerBottom).toBeCloseTo(location.sidebarBottom,0);expect(location.bodyBottom).toBeGreaterThan(location.footerTop);
    expect((await lastPin.boundingBox()).y+(await lastPin.boundingBox()).height).toBeLessThanOrEqual(location.footerTop);
    await mode(frame,'projects');await bottom();const geometry=await metrics();expect(geometry.footerTop).toBe(location.footerTop);
    const last=frame.locator('.space-editor__geometry-card').last();const rect=await last.boundingBox();expect(rect.y+rect.height).toBeLessThanOrEqual(geometry.footerTop);
    await frame.locator('.space-editor__body').evaluate(body=>body.scrollTop=0);await last.locator('[data-shape-action="delete"]').focus();
    const focused=await last.locator('[data-shape-action="delete"]').boundingBox();expect(focused.y+focused.height).toBeLessThanOrEqual(geometry.footerTop-7);
    await bottom();await mode(frame,'register');await expect.poll(async()=>Math.abs((await metrics()).scroll-location.scroll)).toBeLessThan(1);
    await mode(frame,'projects');await expect.poll(async()=>Math.abs((await metrics()).scroll-geometry.scroll)).toBeLessThan(1);
    await frame.locator('[data-space-expand]').last().click();await frame.locator('[data-space-expand]').last().click();await expect(last.locator('.space-editor__drawer')).toBeVisible();expect((await metrics()).footerTop).toBe(location.footerTop);
    await page.setViewportSize({width:480,height:900});await expect.poll(()=>last.locator('.program-shape-actions button').evaluateAll(buttons=>Math.min(...buttons.map(b=>b.getBoundingClientRect().width)))).toBeGreaterThanOrEqual(44);
    await expect.poll(()=>last.locator('.program-shape-actions button').evaluateAll(buttons=>new Set(buttons.map(b=>b.getBoundingClientRect().top)).size)).toBe(1);
    expect(errors).toEqual([]);
  });
}
