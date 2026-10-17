const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest, startSpaceCreation } = require('./test-helper.cjs');

async function open(page, owner='EVT', width=1920) {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({width,height:1000});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`/src/program-planner/${owner==='NSA'?'nsa':'events'}.html`);
  const frame=page.frames().find(frame=>frame!==page.mainFrame());
  await frame.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==='ready');
  return {frame,errors};
}
async function seed(frame,owner='EVT') {
  return frame.evaluate(async owner=>{
    const ids={records:[],projects:[],jobs:[]};
    await UOS.ProgramApp.updateWorkspace(ws=>{
      for(let n=0;n<3;n++){
        const id=`${owner}-${owner==='NSA'?'APP':'EVENT'}-ADAPT-${n}`;ids.records.push(id);
        ws.entities[owner==='NSA'?'applications':'events'].push({id,owner,type:owner==='NSA'?'application':'event',title:'Adaptive fixture '+n,status:'received',dateReceived:'2026-10-01',...(owner==='EVT'?{bumpInDate:n===0?'2026-10-08':'',bumpOutDate:n===0?'2026-10-09':''}:{})});
        if(n===2)continue;
        const promoted=UOS.ProgramModel.promoteRegisterRecord(ws,id);ws=UOS.ProgramStatus.migrate(promoted.workspace);ids.projects.push(promoted.project.id);
        ids.jobs[n]=[];
        for(let j=0;j<4;j++){
          const task=UOS.ProgramPlannerModel.saveTask(ws,promoted.project.id,null,{title:`Fixture ${n} ${j}`,description:'Adaptive calendar fixture',section:'Planning and Approval',operational:true,status:'Not Started'});
          const draft=UOS.ProgramPlannerModel.createDraftJob(task.workspace,promoted.project.id,task.task.id);ws=draft.workspace;ids.jobs[n].push(draft.job.id);
          if(j<3)ws=UOS.ProgramSchedulerModel.scheduleJob(ws,draft.job.id,{startDate:'2026-10-05',endDate:'2026-10-05',startTime:'09:00',endTime:'12:00',allDay:false});
        }
      }
      ws.workspace.calendarCursor='2026-10-05';return ws;
    });return ids;
  },owner);
}
async function navigate(frame,destination,id){await frame.evaluate(({destination,id})=>UOS.ProgramApp.navigateWithContext(destination,id),{destination,id});}

test('MetroMap credentials stay outside workspace exports and preserve the editing session',async({page})=>{
  const {frame,errors}=await open(page,'NSA');const ids=await seed(frame,'NSA');
  // Keep the basemap deterministic and offline from the credential account.
  const png=Buffer.from(await frame.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=16;canvas.getContext('2d').fillRect(0,0,16,16);return canvas.toDataURL().split(',')[1];}),'base64');
  await page.route('**/api.metromap.com.au/**',route=>route.fulfill({contentType:'image/png',body:png}));
  await navigate(frame,'map',ids.records[0]);await frame.waitForFunction(()=>UOS.ProgramMapController.getMapController()?.ready());
  await frame.locator('[data-space-mode="projects"]').click();
  await startSpaceCreation(frame,'polygon');
  const canvas=frame.locator('.maplibregl-canvas');const box=await canvas.boundingBox();
  for(const [x,y] of [[.3,.4],[.5,.4],[.5,.6]])await canvas.click({position:{x:box.width*x,y:box.height*y}});
  await expect(frame.locator('#spaceMapOnboarding')).toBeVisible();
  await expect(frame.locator('#spaceMapOnboarding')).toContainText('Polygon');
  await frame.evaluate(()=>{window.__activationMap=UOS.ProgramMapController.getMapController();window.__activationDraft=JSON.stringify(__activationMap.getDrawing());window.__activationCamera=JSON.stringify(__activationMap.getLocationSnapshot());});
  const footer=frame.locator('.space-editor__moasure-section');
  const sizes=await footer.evaluate(node=>{const [a,b]=node.querySelectorAll('button');return {left:a.getBoundingClientRect().width,right:b.getBoundingClientRect().width,height:node.getBoundingClientRect().height};});
  expect(sizes.left).toBeCloseTo(sizes.right,0);expect(sizes.height).toBeLessThanOrEqual(120);
  await expect(frame.locator('#moasureImportButton')).toContainText('Drop Moasure CSV or click to add');
  await expect(frame.locator('[data-metro-label]')).toHaveText('Activate Metromap');
  await frame.locator('#activateMetroMap').click();const modal=frame.locator('#metroMapActivation');
  await expect(modal.locator('#metroMapKey')).toHaveAttribute('type','password');
  await modal.locator('#metroMapKey').fill('test-browser-key');
  await expect(modal.getByRole('button',{name:'Paste',exact:true})).toHaveCount(0);
  await expect(modal.locator('#metroMapKey')).toHaveValue('test-browser-key');
  await modal.locator('[data-metro-save]').check();await modal.getByRole('button',{name:'Activate',exact:true}).click();
  await expect(frame.locator('[data-metro-label]')).toHaveText('Metromap Active');
  await expect.poll(()=>frame.evaluate(()=>UOS.ProgramMapController.getMapController().getRendererAdapter().getSource('uos-basemap')?.tiles?.[0]?.includes('api.metromap.com.au'))).toBe(true);
  expect(await frame.evaluate(()=>({same:__activationMap===UOS.ProgramMapController.getMapController(),draft:__activationDraft===JSON.stringify(__activationMap.getDrawing()),camera:__activationCamera===JSON.stringify(__activationMap.getLocationSnapshot())}))).toEqual({same:true,draft:true,camera:true});
  expect(await frame.evaluate(()=>JSON.stringify({workspace:UOS.ProgramApp.workspace(),json:UOS.ProgramData.exportJson(UOS.ProgramApp.workspace()),bundle:new TextDecoder().decode(UOS.ProgramData.exportBundle(UOS.ProgramApp.workspace())),metrics:__activationMap.getRendererMetrics(),operational:__activationMap.getOperationalSnapshot()}))).not.toContain('test-browser-key');
  await page.reload();const next=page.frames().find(f=>f!==page.mainFrame());await next.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==='ready');
  expect(await next.evaluate(()=>UOS.MetroMapCredentials.status().active)).toBe(true);
  await navigate(next,'map',ids.records[0]);await next.locator('#activateMetroMap').click();
  await next.locator('[data-metro-forget]').click();
  await expect(next.locator('[data-metro-label]')).toHaveText('Activate Metromap');
  expect(await next.evaluate(()=>UOS.MetroMapCredentials.status())).toMatchObject({active:true,saved:false});
  await next.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.reload();const last=page.frames().find(f=>f!==page.mainFrame());await last.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==='ready');
  expect(await last.evaluate(()=>({active:UOS.MetroMapCredentials.status().active,provider:UOS_REMEDIATION_MAP_CONFIG.defaultProvider}))).toEqual({active:false,provider:'esri-world-imagery'});
  expect(errors).toEqual([]);
});

test('MetroMap manual activation survives storage failures without retry loops',async({page})=>{
  await page.addInitScript(()=>{
    for(const method of ['getItem','setItem','removeItem']){
      const original=Storage.prototype[method];Storage.prototype[method]=function(key,...args){if(key==='uos.metromap.user-key')throw Error('Storage blocked');return original.call(this,key,...args);};
    }
  });
  let requests=0;await page.route('**/api.metromap.com.au/**',route=>{requests++;return route.fulfill({status:403,body:'Unavailable'});});
  const {frame,errors}=await open(page,'NSA');const ids=await seed(frame,'NSA');await navigate(frame,'map',ids.records[0]);
  await frame.waitForFunction(()=>UOS.ProgramMapController.getMapController()?.ready());
  await frame.locator('#activateMetroMap').click();const modal=frame.locator('#metroMapActivation');
  await expect(modal.locator('[data-metro-status]')).toContainText('storage is unavailable');
  await expect(modal.getByRole('button',{name:'Paste',exact:true})).toHaveCount(0);
  await modal.locator('#metroMapKey').fill('test-storage-failure-key');
  await modal.getByRole('button',{name:'Cancel',exact:true}).click();expect(await frame.evaluate(()=>UOS.MetroMapCredentials.status().active)).toBe(false);
  await frame.locator('#activateMetroMap').click();await expect(modal.locator('#metroMapKey')).toHaveValue('');
  await modal.locator('#metroMapKey').fill('test-storage-failure-key');await modal.locator('[data-metro-save]').check();await modal.getByRole('button',{name:'Activate',exact:true}).click();
  expect(await frame.evaluate(()=>UOS.MetroMapCredentials.status())).toMatchObject({active:true,saved:false,storageUnavailable:true});
  await expect(frame.locator('#mapNotice')).toContainText('offline grid');
  const count=requests;await page.waitForTimeout(350);expect(requests).toBe(count);expect(count).toBeGreaterThan(0);
  expect(await frame.locator('#mapNotice').textContent()).not.toContain('test-storage-failure-key');expect(errors).toEqual([]);
});

for(const owner of ['NSA','EVT'])test(`${owner}: adaptive Week columns align, filter and resize without disturbing drafts`,async({page})=>{
  const {frame,errors}=await open(page,owner);const ids=await seed(frame,owner);await navigate(frame,'scheduler',ids.records[0]);
  const scroller=frame.locator('.program-calendar-scroll');
  async function layout(){return frame.evaluate(()=>{const scroller=document.querySelector('.program-calendar-scroll'),calendar=document.querySelector('[data-scheduler-calendar]');return {requirements:UOS.ProgramSchedulerUI.snapshot().weekLayout.dayRequirements,widths:[...document.querySelectorAll('.scheduler-week-day')].map(n=>n.getBoundingClientRect().width),scroll:scroller.scrollWidth-scroller.clientWidth,top:scroller.scrollTop,available:scroller.clientWidth,calendar:calendar.getBoundingClientRect().width};});}
  let size=await layout();expect(size.requirements[0]).toBe(348);expect(size.scroll).toBeLessThanOrEqual(1);
  expect(new Set(size.widths.slice(owner==='EVT'?5:1).map(w=>Math.round(w*100)) ).size).toBe(1);
  await frame.locator('[data-scheduler-calendar-scope="all"]').click();
  await expect.poll(async()=> (await layout()).requirements[0]).toBe(684);
  await frame.locator('[data-scheduler-calendar-scope="application"]').click();
  await expect.poll(async()=> (await layout()).requirements[0]).toBe(348);
  await frame.evaluate(id=>UOS.ProgramSchedulerUI.focusCalendarJob(id),ids.jobs[0][3]);
  const form=frame.locator('[data-scheduler-form]');await form.locator('[name="location"]').fill('Retained draft location');
  await form.locator('[name="allDay"]').uncheck();await form.locator('[name="startDate"]').fill('2026-10-06');await form.locator('[name="startTime"]').fill('09:00');await form.locator('[name="endTime"]').fill('10:00');await form.locator('[name="endTime"]').press('Tab');
  await expect.poll(async()=> (await layout()).requirements[1]).toBe(140);
  const top=await scroller.evaluate(n=>n.scrollTop);await page.setViewportSize({width:1800,height:1000});
  await expect(form.locator('[name="location"]')).toHaveValue('Retained draft location');expect(await scroller.evaluate(n=>n.scrollTop)).toBe(top);
  await expect.poll(()=>frame.evaluate(id=>{const card=document.querySelector('.scheduler-week-job[data-scheduler-job="'+id+'"]')?.getBoundingClientRect(),handle=document.querySelector('[data-week-handle="start"]')?.getBoundingClientRect();return card&&handle?Math.abs(card.left+card.width/2-handle.left-handle.width/2):999;},ids.jobs[0][3])).toBeLessThan(1);
  const aligned=await frame.evaluate(()=>{const days=[...document.querySelectorAll('.scheduler-week-day')],headers=[...document.querySelectorAll('.scheduler-week-head>.program-calendar__weekday')],hits=[...document.querySelectorAll('.scheduler-all-day-hit')];return days.every((day,i)=>Math.abs(day.getBoundingClientRect().left-headers[i].getBoundingClientRect().left)<1&&Math.abs(day.getBoundingClientRect().left-hits[i].getBoundingClientRect().left)<1&&Math.abs(day.getBoundingClientRect().width-hits[i].getBoundingClientRect().width)<1);});expect(aligned).toBe(true);
  await navigate(frame,'scheduler',ids.records[1]);await expect(frame.locator('[data-scheduler-detail]')).toBeHidden();await expect(frame.locator('[data-week-handle]')).toHaveCount(0);await expect(frame.locator('.program-calendar-job.is-selected')).toHaveCount(0);
  expect(await frame.evaluate(()=>UOS.ProgramSchedulerUI.snapshot().selectedProjectId)).toBe(ids.projects[1]);
  await navigate(frame,'scheduler',ids.records[2]);await frame.evaluate(ids=>UOS.ProgramApp.updateWorkspace(ws=>{ws.workspace.selectedProjectId=ids.projects[0];ws.workspace.scheduler.selectedProjectId=ids.projects[0];return ws;}),ids);expect(await frame.evaluate(()=>UOS.ProgramSchedulerUI.snapshot().selectedProjectId)).toBe('');
  await frame.locator('[data-scheduler-calendar-scope="all"]').click();
  await frame.locator(`.program-calendar-job[data-scheduler-job="${ids.jobs[0][0]}"]`).click();await expect(frame.locator('[data-scheduler-other-project-summary]')).toBeVisible();await frame.locator('[data-scheduler-other-project-summary]').press('Escape');
  await navigate(frame,'scheduler',ids.records[0]);await frame.evaluate(id=>UOS.ProgramSchedulerUI.focusCalendarJob(id),ids.jobs[0][3]);await expect(form.locator('[name="location"]')).toHaveValue('Retained draft location');
  // Saved unscheduled jobs and preview dates cannot mark the Register action used.
  await frame.evaluate(ids=>UOS.ProgramApp.updateWorkspace(ws=>{for(const id of ids.jobs[0].slice(0,3))ws=UOS.ProgramModel.deleteJob(ws,id,{deletePlannerTask:true});const record=ws.entities.applications.concat(ws.entities.events).find(r=>r.id===ids.records[0]);record.bumpInDate='';record.bumpOutDate='';return ws;}),ids);
  expect(await frame.evaluate(id=>UOS.ProgramApp.evaluateShortcutRule('scheduler',UOS.ProgramApp.shortcutContextForWorkspace('register',UOS.ProgramApp.workspace(),id)).usage,ids.records[0])).toBe('unused');
  // Fill every day with three overlaps: only the combined minimum now scrolls.
  await frame.evaluate(ids=>UOS.ProgramApp.updateWorkspace(ws=>{
    for(let day=6;day<=11;day++)for(let lane=0;lane<3;lane++){
      const task=UOS.ProgramPlannerModel.saveTask(ws,ids.projects[0],null,{title:`Full week ${day} ${lane}`,description:'Concurrent full-week fixture',section:'Planning and Approval',operational:true,status:'Not Started'});
      const draft=UOS.ProgramPlannerModel.createDraftJob(task.workspace,ids.projects[0],task.task.id);ws=draft.workspace;
      const date=`2026-10-${String(day).padStart(2,'0')}`;
      ws=UOS.ProgramSchedulerModel.scheduleJob(ws,draft.job.id,{startDate:date,endDate:date,startTime:'09:00',endTime:'12:00',allDay:false});
    }return ws;
  }),ids);
  await frame.locator('[data-scheduler-calendar-scope="all"]').click();await expect.poll(async()=>(await layout()).requirements.every(w=>w>=348)).toBe(true);size=await layout();expect(size.scroll).toBeGreaterThan(500);expect(size.widths.every(w=>w>=347.9),JSON.stringify(size)).toBe(true);
  expect(errors).toEqual([]);
});

test('EVT dates take only Title width and retain owner blue; NSA keeps its columns',async({page})=>{
  const {frame,errors}=await open(page,'EVT',2600);const ids=await seed(frame);await navigate(frame,'register',ids.records[0]);
  const row=frame.locator(`tr[data-register-record="${ids.records[0]}"]`);
  await expect(row.locator('[data-register-event-date-cell="bumpInDate"]')).toHaveText('08/10/2026');await expect(row.locator('[data-register-event-date-cell="bumpOutDate"]')).toHaveText('09/10/2026');
  const widths=await row.evaluate(row=>{const table=row.closest('table'),css=getComputedStyle(table),rect=selector=>row.querySelector(selector).getBoundingClientRect().width;return {title:rect('.program-register-table__title-cell'),location:rect('.program-register-table__location-cell'),received:rect('.program-register-table__received-cell'),dates:[...row.querySelectorAll('[data-register-event-date-cell]')].map(n=>n.getBoundingClientRect().width),baseFlex:parseFloat(css.getPropertyValue('--register-flex-width')),frame:getComputedStyle(row.querySelector('.commercial-value-frame')).borderColor,owner:getComputedStyle(row).getPropertyValue('--register-shortcut-owner').trim()};});
  expect(widths.dates.every(w=>Math.abs(w-widths.received)<1)).toBe(true);expect(widths.location).toBeCloseTo(widths.baseFlex+8,0);expect(widths.title+2*widths.received).toBeCloseTo(widths.location,0);
  expect(widths.frame).toBe('rgb(29, 78, 216)');
  await expect(frame.locator(`tr[data-register-record="${ids.records[1]}"] [data-register-event-date-cell="bumpInDate"]`)).toHaveText('—');
  await frame.locator('[data-register-table-sort="bumpInDate"]').click();await expect(frame.locator('[data-register-sort-header="bumpInDate"]')).toHaveAttribute('aria-sort','ascending');
  await page.setViewportSize({width:1280,height:1000});await expect.poll(()=>row.locator('.program-register-table__title-cell').evaluate(n=>n.getBoundingClientRect().width)).toBeCloseTo(104,0);
  const table=frame.locator('.program-register-table');expect(await table.evaluate(n=>n.getBoundingClientRect().width>n.parentElement.clientWidth)).toBe(true);
  await frame.locator('[data-filter-drawer="register"] [data-filter-drawer-toggle]').click();await frame.locator('[data-register-search]').fill('no matching adaptive fixture');await expect(frame.locator('[data-register-table-body] td[colspan]')).toHaveAttribute('colspan','12');
  expect(errors).toEqual([]);
  const nsa=await open(page,'NSA');const nsaIds=await seed(nsa.frame,'NSA');await navigate(nsa.frame,'register',nsaIds.records[0]);
  await expect(nsa.frame.locator('.program-register-table thead th:visible')).toHaveCount(10);await expect(nsa.frame.locator('[data-register-event-date-cell]')).toHaveCount(0);
});
