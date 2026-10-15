const {test,expect}=require('@playwright/test');
const {suppressBackupModalForFunctionalTest}=require('./test-helper.cjs');
test.use({launchOptions:{args:['--enable-unsafe-webgpu','--use-angle=swiftshader','--use-vulkan=swiftshader','--enable-features=Vulkan']}});
async function open(page,owner){
  await suppressBackupModalForFunctionalTest(page);await page.setViewportSize({width:1600,height:1000});
  await page.goto('/src/program-planner/'+(owner==='NSA'?'nsa':'events')+'.html');
  const f=page.frames().find(f=>f!==page.mainFrame());await f.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==='ready');return f;
}
for(const owner of ['NSA','EVT'])test(owner+': Calculator selects quote snapshots, excludes and restores Draft items and adds into the Draft',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));const f=await open(page,owner);
  const ids=await f.evaluate(async owner=>{
    const ids={record:owner+(owner==='NSA'?'-APP-':'-EVENT-')+'DEMO',line:owner+'-COST-DEMO',rate:owner+'-RATE-DEMO'};
    await UOS.ProgramApp.updateWorkspace(w=>{
      w.entities[owner==='NSA'?'applications':'events'].push({id:ids.record,owner,type:owner==='NSA'?'application':'event',title:'Client demo',status:'received',dateReceived:'2026-10-15'});
      const p=UOS.ProgramModel.promoteRegisterRecord(w,ids.record);w=p.workspace;ids.project=p.project.id;
      w.entities.costingLines.push({id:ids.line,owner,type:'costingLine',projectId:ids.project,kind:'Material',description:'Original item',quantity:2,unit:'item',unitRate:50,estimatedTotal:100});
      w.entities.rateItems.push({id:ids.rate,owner,type:'rateItem',kind:'Material',kindSource:'user',description:'New demo material',category:'Material',active:true,unit:'item',unitRate:25,schedulerEnabled:false});
      w.entities.rateItems.push({id:owner+'-RATE-DEMO-AREA',owner,type:'rateItem',kind:'Material',kindSource:'user',description:'Demo area material',category:'Material',active:true,unit:'m²',quantityMode:'m2',unitRate:2,schedulerEnabled:false});
      w=UOS.ProgramQuotes.saveDraft(w,{projectId:ids.project,quoteDate:'2026-10-15',fundingMode:'customer'});ids.old=w.entities.quotes.at(-1).id;
      w=UOS.ProgramQuotes.issue(w,ids.old);w=UOS.ProgramQuotes.createRevision(w,ids.old);ids.draft=w.entities.quotes.at(-1).id;
      w.workspace.selectedProjectId=ids.project;w.workspace.selectedEntityId=ids.record;return w;
    });ids.rate=UOS.ProgramApp.workspace().entities.rateItems.find(r=>r.description==='New demo material').id;ids.areaRate=UOS.ProgramApp.workspace().entities.rateItems.find(r=>r.description==='Demo area material').id;await UOS.ProgramApp.navigateWithContext('costing',ids.record);return ids;
  },owner);
  const picker=f.locator('[data-calculator-quote]');await expect(picker).toHaveValue(ids.draft);
  await f.locator('[data-costing-remove="'+ids.line+'"]').click();
  await expect(f.locator('[data-costing-line-quantity="'+ids.line+'"]')).toHaveCount(0);
  expect(await f.evaluate(id=>UOS.ProgramApp.workspace().entities.costingLines.some(l=>l.id===id),ids.line)).toBe(true);
  await picker.selectOption(ids.old);
  await expect(f.locator('[data-costing-line-quantity="'+ids.line+'"]')).toHaveValue('2');
  await expect(f.locator('[data-costing-line-quantity="'+ids.line+'"]')).toBeDisabled();
  await expect(f.locator('[data-costing-total="grand"]')).toHaveText('$110.00');
  await picker.selectOption(ids.draft);await f.locator('[data-costing-section="Material"]').click();
  await f.locator('[data-costing-add-rate="'+ids.rate+'"]').click();
  await expect(f.locator('[data-costing-lines]')).toContainText('New demo material');
  await expect(f.locator('[data-costing-total="grand"]')).toHaveText('$27.50');
  await f.locator('[data-calculator-tools-toggle]').click();await f.locator('[data-calculator-restore="'+ids.line+'"]').click();
  await expect(f.locator('[data-costing-total="grand"]')).toHaveText('$137.50');
  await f.locator('[data-costing-add-rate="'+ids.areaRate+'"]').click();
  const area=f.locator('[data-costing-area-form]');await area.locator('[name="area"]').fill('10');await area.locator('[type="submit"]').click();
  await expect(f.locator('[data-costing-area-dialog]')).not.toBeVisible();
  await expect(f.locator('[data-costing-total="grand"]')).toHaveText('$159.50');
  await picker.selectOption(ids.old);await expect(f.locator('[data-costing-total="grand"]')).toHaveText('$110.00');
  await expect(f.locator('[data-costing-lines]')).not.toContainText('New demo material');
  expect(errors).toEqual([]);
});

test.describe('Tree details and Polygon Inspector',()=>{
  for(const [owner,backend] of [['NSA','webgpu'],['EVT','webgl'],['NSA','maplibre']])test(owner+' '+backend+': reference details highlight GPU geometry and stay clear of editing',async({page})=>{
    const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await page.addInitScript(value=>window.UOS_SPACE_MAP_BACKEND=value,backend);
    await page.route('**/FeatureServer/**',route=>{
      const url=new URL(route.request().url()),index=Number(url.pathname.match(/FeatureServer\/(\d)/)?.[1]);
      const props={OBJECTID:1,asset_id:77,tpz:index===0?null:8.764,srz:index===0?null:3.025,risk:'High'};
      const geometry=index===0?{type:'Point',coordinates:[138.6014,-34.9214]}:{type:'Polygon',coordinates:[[[138.6010,-34.922],[138.602,-34.922],[138.602,-34.921],[138.601,-34.921],[138.601,-34.922]]]};
      if(url.pathname.endsWith('/query'))expect(url.searchParams.get('outFields')).toBe('OBJECTID,asset_id,tpz,srz,risk');
      return route.fulfill({json:url.pathname.endsWith('/query')?{type:'FeatureCollection',features:[{type:'Feature',properties:props,geometry}]}:{drawingInfo:{renderer:{uniqueValueInfos:[{value:'High',symbol:{color:[202,0,32]}}]}}}});
    });
    const f=await open(page,owner);
    expect(requests.filter(s=>/tree-loader|tree-worker|FeatureServer/.test(s))).toHaveLength(0);
    await f.evaluate(async owner=>{
      UOS_REMEDIATION_MAP_CONFIG.defaultProvider='offline';
      await UOS.ProgramApp.updateWorkspace(w=>{
        const id=owner+(owner==='NSA'?'-APP-':'-EVENT-')+'TREE-DEMO';w.entities[owner==='NSA'?'applications':'events'].push({id,owner,type:owner==='NSA'?'application':'event',title:'Tree demo',status:'received'});
        const p=UOS.ProgramModel.promoteRegisterRecord(w,id);w=p.workspace;w.workspace.selectedProjectId=p.project.id;w.workspace.selectedEntityId=id;return w;
      });await UOS.ProgramApp.navigate('map');
    },owner);
    await f.waitForFunction(()=>UOS.ProgramMapController.getMapController()?.ready());
    await f.locator('#treeLayerHub').click();expect(requests.filter(s=>/tree-loader|tree-worker|FeatureServer/.test(s))).toHaveLength(0);
    await f.evaluate(()=>UOS.ProgramMapController.getMapController().getRendererAdapter().easeTo({center:[138.6014,-34.9214],zoom:17}));
    const panel=f.locator('#treeDetailsPanel');
    await f.locator('[data-tree-layer="trees"]').click();
    await f.waitForFunction(()=>UOS.ProgramMapController.getMapController().getRendererAdapter().reference.get('trees')?.payload.count===1);
    await f.evaluate(()=>{const map=UOS.ProgramMapController.getMapController().getRendererAdapter();map.fire('click',{point:map.project([138.6014,-34.9214]),lngLat:{lng:138.6014,lat:-34.9214}});});
    await expect(panel.locator('[data-tree-detail="tpz"]')).toHaveText('Not recorded');
    for(const layer of ['srz','tpz'])await f.locator('[data-tree-layer="'+layer+'"]').click();
    await f.waitForFunction(()=>['trees','srz','tpz'].every(id=>UOS.ProgramMapController.getMapController().getRendererAdapter().reference.get(id)?.payload.count===1));
    const actualBackend=await f.evaluate(()=>UOS.ProgramMapController.getMapController().getRendererMetrics().backend);
    expect(actualBackend).toBe(backend==='webgl'?'webgl2':backend);
    await f.evaluate(()=>{const map=UOS.ProgramMapController.getMapController().getRendererAdapter();map.fire('click',{point:map.project([138.6014,-34.9214]),lngLat:{lng:138.6014,lat:-34.9214}});});
    await expect(panel).toHaveAttribute('aria-hidden','false');
    await expect(panel.locator('[data-tree-detail="tpz"]')).toHaveText('8.76 m');await expect(panel.locator('[data-tree-detail="srz"]')).toHaveText('3.02 m');await expect(panel.locator('[data-tree-detail="risk"]')).toHaveText('High');
    await f.waitForFunction(()=>UOS.ProgramMapController.getMapController().getRendererAdapter().reference.get('selection')?.payload.count===3);
    await expect.poll(()=>f.evaluate(()=>UOS.ProgramMapController.getMapController().getRendererAdapter().objects.get('reference-selection')?.length||Boolean(UOS.ProgramMapController.getMapController().getRendererAdapter().legacy?.getLayer('reference-selection-points')))).toBeTruthy();
    await panel.locator('[data-tree-details-close]').click();await expect(panel).toHaveAttribute('aria-hidden','true');
    expect(await f.evaluate(()=>UOS.ProgramMapController.getMapController().getRendererAdapter().reference.has('selection'))).toBe(false);
    await f.locator('[data-tree-layer="trees"]').click();
    await f.evaluate(()=>{const map=UOS.ProgramMapController.getMapController().getRendererAdapter();map.fire('click',{point:map.project([138.6018,-34.9218]),lngLat:{lng:138.6018,lat:-34.9218}});});
    await expect(panel).toHaveAttribute('aria-hidden','false');await page.keyboard.press('Escape');await expect(panel).toHaveAttribute('aria-hidden','true');
    await f.evaluate(()=>UOS.ProgramMapController.getMapController().startDrawing('polygon'));
    await f.evaluate(()=>{const map=UOS.ProgramMapController.getMapController().getRendererAdapter();map.fire('click',{point:map.project([138.6014,-34.9214]),lngLat:{lng:138.6014,lat:-34.9214}});});
    await expect(panel).toHaveAttribute('aria-hidden','true');
    expect(errors).toEqual([]);
  });
});

for(const owner of ['NSA','EVT'])test(owner+': Polygon Inspector cycles three sizes without remounting or saving Moasure placement',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));const f=await open(page,owner);
  await f.evaluate(async owner=>{
    UOS_REMEDIATION_MAP_CONFIG.defaultProvider='offline';
    await UOS.ProgramApp.updateWorkspace(w=>{
      const id=owner+(owner==='NSA'?'-APP-':'-EVENT-')+'CARDS';w.entities[owner==='NSA'?'applications':'events'].push({id,owner,type:owner==='NSA'?'application':'event',title:'Polygon sizes',status:'received'});
      const p=UOS.ProgramModel.promoteRegisterRecord(w,id);w=p.workspace;
      w=UOS.WorkAreaService.createGeometry(w,p.project.id,{geometry:{type:'Polygon',coordinates:[[[138.600,-34.922],[138.601,-34.922],[138.601,-34.923],[138.600,-34.922]]]},payload:{visible:true,workTypeKey:'turfing'}});
      const csv='Layer,Path,Point,X:m,Y:m\n1,1,1,0,0\n1,1,2,10,0\n1,1,3,0,10';
      const groups=UOS.MoasureGeometry.parse(csv,'sizes.csv').groups.map(g=>g.key);
      w=UOS.WorkAreaService.importMoasure(w,p.project.id,csv,'sizes.csv',groups,[138.602,-34.922],'sizes');
      w.workspace.selectedProjectId=p.project.id;w.workspace.selectedEntityId=id;return w;
    });await UOS.ProgramApp.navigate('map');
  },owner);
  await f.waitForFunction(()=>UOS.ProgramMapController.getMapController()?.ready());
  await f.locator('[data-space-mode="projects"]').click();
  const card=f.locator('.space-editor__geometry-card').filter({hasText:'Moasure'}).first(),toggle=card.locator('[data-space-expand]');
  const other=f.locator('.space-editor__geometry-card').filter({hasText:'Event Space'}).first();
  await other.locator('[data-space-expand]').click();await other.locator('[data-space-expand]').click();
  await expect(other).toHaveAttribute('data-card-size','full');
  await expect(card).toHaveAttribute('data-card-size','summary');
  await toggle.click();await toggle.click();
  await expect(card).toHaveAttribute('data-card-size','full');await expect(other).toHaveAttribute('data-card-size','full');
  await toggle.click();
  await f.locator('[data-space-collapse-all]').click();
  await expect(other).toHaveAttribute('data-card-size','summary');await expect(card).toHaveAttribute('data-card-size','summary');
  await f.locator('[data-space-collapse-all]').click();
  await expect(other).toHaveAttribute('data-card-size','minimal');await expect(card).toHaveAttribute('data-card-size','minimal');
  await expect(f.locator('[data-space-collapse-all]')).toBeDisabled();
  await toggle.click();await expect(card).toHaveAttribute('data-card-size','full');
  await expect(other).toHaveAttribute('data-card-size','minimal');
  await toggle.click();
  await expect(card).toHaveAttribute('data-card-size','summary');
  await toggle.click();await expect(card).toHaveAttribute('data-card-size','minimal');
  await expect(card.locator('.program-shape-actions')).toBeHidden();await expect(card.locator('.space-editor__fields tr').nth(1)).toBeHidden();await expect(card.locator('.space-editor__fields tr').first().locator('th')).toBeHidden();
  await expect(card.locator('.space-editor__fields tr').first().locator('td')).toContainText('Turfing');
  await toggle.click();await expect(card).toHaveAttribute('data-card-size','full');await expect(card.locator('.space-editor__drawer')).toBeVisible();
  await card.locator('[data-polygon-placement]').click();
  await expect(f.locator('#spaceDraftActions')).toBeVisible();
  await page.waitForTimeout(100);
  await card.evaluate(card=>{
    window.cardSizeProof={card,changes:0,workspace:JSON.stringify(UOS.ProgramApp.workspace().entities)};
    window.cardSizeProof.observer=new MutationObserver(records=>window.cardSizeProof.changes+=records.length);
    window.cardSizeProof.observer.observe(card,{childList:true,subtree:true});
  });
  for(const level of ['summary','minimal','full']){await toggle.click();await expect(card).toHaveAttribute('data-card-size',level);await expect(toggle).toBeFocused();}
  expect(await f.evaluate(()=>({same:document.contains(cardSizeProof.card),changes:cardSizeProof.changes,unchanged:cardSizeProof.workspace===JSON.stringify(UOS.ProgramApp.workspace().entities)}))).toEqual({same:true,changes:0,unchanged:true});
  await expect(f.locator('#spaceDraftActions')).toBeVisible();expect(errors).toEqual([]);
});
