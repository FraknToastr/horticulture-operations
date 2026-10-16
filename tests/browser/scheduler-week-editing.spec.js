const {test,expect}=require('@playwright/test');
const {suppressBackupModalForFunctionalTest}=require('./test-helper.cjs');
async function setup(page,owner='NSA'){
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({width:1600,height:1000});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`/src/program-planner/${owner==='NSA'?'nsa':'events'}.html`);
  const frame=page.frames().find(f=>f!==page.mainFrame());
  await frame.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');
  const ids=await frame.evaluate(async owner=>{
    const ids={};await UOS.ProgramApp.updateWorkspace(w=>{
      for(const suffix of ['active','foreign']){
        const record={id:`${owner}-${owner==='NSA'?'APP':'EVENT'}-WEEK-${suffix}`,owner,type:owner==='NSA'?'application':'event',title:`Week ${suffix}`,status:'received',dateReceived:'2026-10-01'};
        w.entities[owner==='NSA'?'applications':'events'].push(record);
        const promoted=UOS.ProgramModel.promoteRegisterRecord(w,record.id);w=UOS.ProgramStatus.migrate(promoted.workspace);
        if(suffix==='active'){ids.record=record.id;ids.project=promoted.project.id;}
        for(const [name,schedule] of Object.entries(suffix==='active'?{
          morning:{startTime:'09:00',endTime:'10:30',priority:'high'},
          overlap:{startTime:'09:30',endTime:'11:00',priority:'medium'},
          short:{startTime:'14:00',endTime:'14:05',priority:'low'},
          multi:{startTime:'23:00',endTime:'01:00',endDate:'2026-10-06'},
          allDay:{allDay:true},unscheduled:null,second:null
        }:{foreign:null,foreignTimed:{startTime:'09:00',endTime:'09:30'}})){
          const task=UOS.ProgramPlannerModel.saveTask(w,promoted.project.id,null,{title:name,description:'Calendar editing',operational:true,section:'Planning and Approval',status:'Not Started'});
          const draft=UOS.ProgramPlannerModel.createDraftJob(task.workspace,promoted.project.id,task.task.id);w=draft.workspace;ids[name]=draft.job.id;
          w.entities.jobs.find(j=>j.id===draft.job.id).workTypeKey=['morning','unscheduled','foreignTimed'].includes(name)?'Turfing':name==='overlap'?'Irrigation':name;
          if(schedule)w=UOS.ProgramSchedulerModel.scheduleJob(w,draft.job.id,{startDate:'2026-10-05',endDate:'2026-10-05',allDay:false,crewId:name,...schedule});
        }
      }
      w.workspace.calendarCursor='2026-10-05';return w;
    });await UOS.ProgramApp.navigateWithContext('scheduler',ids.record);return ids;
  },owner);
  return {frame,ids,errors};
}

async function dragRows(page,f,kind,rows,dx=0){
 await f.locator('.scheduler-week-job.is-selected').first().scrollIntoViewIfNeeded();await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const b=await handle(f,kind).boundingBox();
 const target=await f.evaluate(({y,rows})=>{const day=document.querySelector('.scheduler-week-day:has(.is-selected)');const cells=[...day.querySelectorAll('.scheduler-week-slot')];const index=cells.findIndex(c=>{const b=c.getBoundingClientRect();return y>=b.top&&y<b.bottom;});const rect=cells[Math.max(0,Math.min(47,index+rows))].getBoundingClientRect();return rect.top+Math.min(rect.height/2,12);},{y:b.y+b.height/2,rows});
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,target,{steps:8});await page.mouse.up();
}
test('edge and move handles edit drafts without changing the day; Escape cancels a gesture',async({page})=>{
 const {frame:f,ids,errors}=await setup(page);await focus(f,ids.morning);const original=await f.evaluate(()=>UOS.ProgramApp.workspace().entities.jobs);
 const moveBox=await handle(f,'move').boundingBox(),pillBox=await f.locator('.scheduler-week-job.is-selected .scheduler-priority-pill').first().boundingBox();
 expect(moveBox.x+moveBox.width).toBeLessThanOrEqual(pillBox.x-3);
 await dragRows(page,f,'start',1);await expect(form(f).locator('[name=startTime]')).toHaveValue('09:30');
 await dragRows(page,f,'end',1);await expect(form(f).locator('[name=endTime]')).toHaveValue('11:00');
 await dragRows(page,f,'move',1);await expect(form(f).locator('[name=startTime]')).toHaveValue('10:00');await expect(form(f).locator('[name=endTime]')).toHaveValue('11:30');await expect(form(f).locator('[name=startDate]')).toHaveValue('2026-10-05');
 await handle(f,'move').focus();await page.keyboard.press('ArrowDown');await expect(form(f).locator('[name=startTime]')).toHaveValue('10:30');
 await handle(f,'move').scrollIntoViewIfNeeded();const b=await handle(f,'move').boundingBox();await page.mouse.move(b.x+22,b.y+22);await page.mouse.down();await page.mouse.move(b.x+22,b.y+100,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();await expect(form(f).locator('[name=startTime]')).toHaveValue('10:30');await expect(form(f)).toBeVisible();
 expect(await f.evaluate(()=>UOS.ProgramApp.workspace().entities.jobs)).toEqual(original);
 await focus(f,ids.multi);await expect(handle(f,'start')).toHaveCount(0);await expect(handle(f,'move')).toHaveCount(1);await focus(f,ids.allDay);await expect(handle(f,'start')).toHaveCount(0);await expect(handle(f,'move')).toHaveCount(1);expect(errors).toEqual([]);
});
test('month headings, midnight placement, priority pills and docked Outlook export',async({page})=>{
 const {frame:f,ids,errors}=await setup(page);const exportButton=f.locator('[data-scheduler-outlook]');await expect(exportButton).toBeDisabled();await focus(f,ids.unscheduled);await expect(exportButton).toHaveText('Create Outlook Calendar file');await expect(exportButton).toBeEnabled();
 expect(await exportButton.locator('img').evaluate(n=>n.complete&&n.naturalWidth>0)).toBe(true);expect(await exportButton.evaluate(n=>!n.closest('form,.program-scheduler-detail__body'))).toBe(true);
 await expect(f.locator('.scheduler-week-month')).toHaveCount(7);
 await expect(f.locator('.scheduler-week-day [data-scheduler-job="'+ids.morning+'"] .scheduler-priority-pill')).toHaveText('H');await expect(f.locator('.scheduler-week-day [data-scheduler-job="'+ids.overlap+'"] .scheduler-priority-pill')).toHaveText('M');
 await place(f,'2026-10-05',1410);await expect(form(f).locator('[name=startTime]')).toHaveValue('23:30');await expect(form(f).locator('[name=endTime]')).toHaveValue('00:00');await expect(form(f).locator('[name=endDate]')).toHaveValue('2026-10-06');
 await form(f).getByRole('button',{name:'Save schedule',exact:true}).click();await expect.poll(()=>f.evaluate(id=>UOS.ProgramApp.workspace().entities.jobs.find(j=>j.id===id).endTime,ids.unscheduled)).toBe('00:00');
 await page.setViewportSize({width:390,height:1000});await form(f).getByRole('button',{name:'Save schedule',exact:true}).click({trial:true});expect(errors).toEqual([]);
});

const form=f=>f.locator('[data-scheduler-form]');

test('three-hour and two-hour overlapping jobs use continuous side-by-side cards',async({page})=>{
 const {frame:f,ids,errors}=await setup(page);
 await f.evaluate(ids=>UOS.ProgramApp.updateWorkspace(w=>{
  const a=w.entities.jobs.find(j=>j.id===ids.morning),b=w.entities.jobs.find(j=>j.id===ids.overlap);
  a.endTime='12:00';b.startTime='10:00';b.endTime='12:00';return w;
 }),ids);
 await focus(f,ids.morning);
 const day=f.locator('[data-scheduler-date="2026-10-05"]');
 const a=day.locator('[data-scheduler-job="'+ids.morning+'"]'),b=day.locator('[data-scheduler-job="'+ids.overlap+'"]');
 await expect(a).toHaveCount(1);await expect(b).toHaveCount(1);
 await expect(a.locator('.program-calendar-job__time')).toHaveText('09:00 – 12:00');await expect(b.locator('.program-calendar-job__time')).toHaveText('10:00 – 12:00');
 const ab=await a.boundingBox(),bb=await b.boundingBox();expect(bb.x).toBeGreaterThanOrEqual(ab.x+ab.width);expect(bb.y-ab.y).toBe(96);expect(bb.width).toBeCloseTo(ab.width,0);expect(bb.y+bb.height).toBe(ab.y+ab.height);
 await expect(day.locator('.scheduler-week-overlap-band')).toHaveCount(0);
 expect(await a.evaluate(n=>getComputedStyle(n.querySelector('.scheduler-selection-overlay')).animationName)).toBe('scheduler-selection-pulse');
 expect(await a.evaluate(n=>getComputedStyle(n).color)).not.toBe('rgb(255, 255, 255)');
 await a.scrollIntoViewIfNeeded();
 await f.locator('.program-calendar-scroll').evaluate(el=>{const day=el.querySelector('.scheduler-week-day'),card=day.querySelector('.scheduler-week-job');el.scrollTop=card.getBoundingClientRect().top-day.getBoundingClientRect().top-80;});
 expect(errors).toEqual([]);
});


test('touch keeps short durations; failed and stale saves retain drafts',async({page})=>{
 const {frame:f,ids,errors}=await setup(page);await focus(f,ids.short);await handle(f,'move').scrollIntoViewIfNeeded();
 const b=await handle(f,'move').boundingBox();const y=await cell(f,'2026-10-05',870).evaluate(n=>{const r=n.getBoundingClientRect();return r.top+12});
 const client=await page.context().newCDPSession(page);await client.send('Emulation.setTouchEmulationEnabled',{enabled:true});
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+22,y:b.y+22}]});
 for(let i=1;i<=6;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+22,y:b.y+22+(y-b.y-22)*i/6}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(form(f).locator('[name=startTime]')).toHaveValue('14:30');await expect(form(f).locator('[name=endTime]')).toHaveValue('14:35');
 await f.evaluate(()=>{window.realScheduleUpdate=UOS.ProgramApp.updateWorkspace;UOS.ProgramApp.updateWorkspace=()=>Promise.reject(new Error('Test schedule failure'));});
 await form(f).getByRole('button',{name:'Save schedule',exact:true}).click();await expect(f.locator('[data-scheduler-form-error]')).toHaveText('Test schedule failure');await expect(form(f).locator('[name=startTime]')).toHaveValue('14:30');
 await f.evaluate(()=>UOS.ProgramApp.updateWorkspace=window.realScheduleUpdate);
 await form(f).locator('[name=location]').fill('Local change');
 await f.evaluate(id=>UOS.ProgramApp.updateWorkspace(w=>{w.entities.jobs.find(j=>j.id===id).location='External change';return w;}),ids.short);
 await form(f).getByRole('button',{name:'Save schedule',exact:true}).click();await expect(f.locator('[data-scheduler-form-error]')).toHaveText(/changed while editing/);
 await expect(form(f).locator('[name=location]')).toHaveValue('Local change');
 await f.locator('[data-scheduler-discard]').click();await expect(form(f).locator('[name=location]')).toHaveValue('External change');expect(errors).toEqual([]);
});

const handle=(f,k)=>f.locator('[data-week-handle="'+k+'"]');
const cell=(f,date,minute)=>f.locator('[data-scheduler-date="'+date+'"] [data-scheduler-minute="'+minute+'"]');
async function focus(f,id){await f.evaluate(id=>UOS.ProgramSchedulerUI.focusCalendarJob(id),id);await expect(form(f)).toBeVisible();const card=f.locator('.program-calendar-job.is-selected').first();if(await card.count())await card.scrollIntoViewIfNeeded();await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function place(f,date,minute){await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await f.evaluate(({date,minute})=>{const n=document.querySelector('[data-scheduler-date="'+date+'"] [data-scheduler-minute="'+minute+'"]');const s=n.closest('.program-calendar-scroll');s.scrollTop+=n.getBoundingClientRect().top-s.getBoundingClientRect().top-s.querySelector('.scheduler-week-head').getBoundingClientRect().height-60;},{date,minute});const b=await cell(f,date,minute).boundingBox();await f.page().mouse.click(b.x+100,b.y+12);await expect(f.locator('dialog[open],.uos-modal-backdrop')).toHaveCount(0);}
for(const owner of ['NSA','EVT']){
test(owner+': direct placement, side-by-side overlaps and retained drafts',async({page})=>{
const {frame:f,ids,errors}=await setup(page,owner);const jobs=()=>f.evaluate(()=>UOS.ProgramApp.workspace().entities.jobs);const before=await jobs();
await f.locator('[data-scheduler-calendar-scope="all"]').click();
await f.locator('[data-scheduler-unscheduled] [data-scheduler-job="'+ids.unscheduled+'"]').click();
await place(f,'2026-10-05',540);
await expect(form(f).locator('[name=startTime]')).toHaveValue('09:00');await expect(form(f).locator('[name=endTime]')).toHaveValue('09:30');
const monday=f.locator('[data-scheduler-date="2026-10-05"]'),tuesday=f.locator('[data-scheduler-date="2026-10-06"]');
await expect(monday.locator('.scheduler-week-job[data-scheduler-lanes="3"]')).toHaveCount(4);
const boxes=await monday.locator('.scheduler-week-job[data-scheduler-lanes="3"]').evaluateAll(ns=>ns.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,bottom:b.bottom};}));
expect(new Set(boxes.map(b=>b.x)).size).toBe(3);expect(Math.max(...boxes.map(b=>b.width))-Math.min(...boxes.map(b=>b.width))).toBeLessThan(1);
expect((await cell(f,'2026-10-05',540).boundingBox()).height).toBe(48);expect((await cell(f,'2026-10-06',540).boundingBox()).height).toBe(48);
expect((await cell(f,'2026-10-05',570).boundingBox()).y).toBe((await cell(f,'2026-10-06',570).boundingBox()).y);
await expect(monday.locator('.scheduler-type-warning')).toHaveCount(3);
for(const k of ['start','end','move'])await expect(handle(f,k)).toHaveCount(1);
expect(await jobs()).toEqual(before);

await form(f).locator('[name=crewId]').fill('Team two');await form(f).locator('[name=priority]').selectOption('low');
await f.locator('[data-scheduler-back]').click();await focus(f,ids.second);await place(f,'2026-10-06',600);
await f.locator('[data-scheduler-back]').click();await f.locator('.scheduler-week-job[data-scheduler-job="'+ids.unscheduled+'"]').first().click();
await expect(form(f).locator('[name=crewId]')).toHaveValue('Team two');await expect(form(f).locator('[name=startTime]')).toHaveValue('09:00');
await form(f).getByRole('button',{name:'Save schedule',exact:true}).click();
await expect.poll(async()=> (await jobs()).find(j=>j.id===ids.unscheduled).startTime).toBe('09:00');
const saved=await jobs();expect(saved.find(j=>j.id===ids.unscheduled).priority).toBe('low');expect(saved.find(j=>j.id===ids.second).startTime||'').toBe('');expect(saved.length).toBe(before.length);expect(errors).toEqual([]);
});
}
