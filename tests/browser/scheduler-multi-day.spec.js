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


const form=f=>f.locator('[data-scheduler-form]'),handle=(f,k)=>f.locator('[data-week-handle="'+k+'"]');

test('holding a date handle at the week edge pages once and Cancel restores the original period',async({page})=>{
 const {frame:f,ids,errors}=await setup(page);await select(f,ids.morning);await reveal(f);
 const b=await handle(f,'date-end').boundingBox(),view=await f.locator('.program-calendar-scroll').boundingBox();
 await page.mouse.move(b.x+22,b.y+22);await page.mouse.down();await page.mouse.move(view.x+view.width-5,b.y+22,{steps:8});
 await expect(f.locator('.scheduler-week-day').first()).toHaveAttribute('data-scheduler-date','2026-10-12',{timeout:2500});
 await page.mouse.up();const modal=f.locator('.scheduler-all-day-confirm');await expect(modal).toBeVisible();await expect(modal).toContainText('2026-10-18');
 await modal.getByRole('button',{name:'Cancel',exact:true}).click();await expect(f.locator('.scheduler-week-day').first()).toHaveAttribute('data-scheduler-date','2026-10-05');
 await expect(form(f).locator('[name=startDate]')).toHaveValue('2026-10-05');await expect(form(f).locator('[name=endDate]')).toHaveValue('2026-10-05');expect(errors).toEqual([]);
});
test('Month timed extension confirms conversion; keyboard cancellation leaves hours intact',async({page})=>{
 const {frame:f,ids,errors}=await setup(page);await select(f,ids.short);await f.getByRole('button',{name:'Month',exact:true}).click();await reveal(f);
 await handle(f,'date-end').focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');await noModal(f);await expect(form(f).locator('[name=endTime]')).toHaveValue('14:05');
 await dragTo(page,f,'date-end','2026-10-07');const modal=f.locator('.scheduler-all-day-confirm');await expect(modal).toBeVisible();await page.keyboard.press('Escape');await noModal(f);await expect(form(f).locator('[name=allDay]')).not.toBeChecked();
 await dragTo(page,f,'date-end','2026-10-07');await modal.getByRole('button',{name:'Convert to all day',exact:true}).click();await expect(form(f).locator('[name=endDate]')).toHaveValue('2026-10-07');await expect(form(f).locator('[name=allDay]')).toBeChecked();await expect(f.locator('.scheduler-month-card[data-scheduler-job="'+ids.short+'"]')).toHaveCount(1);expect(errors).toEqual([]);
});

async function select(f,id){await f.evaluate(id=>UOS.ProgramSchedulerUI.focusCalendarJob(id),id);await expect(form(f)).toBeVisible();await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function reveal(f){await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const selected=f.locator('.program-calendar-job.is-selected').first();await selected.scrollIntoViewIfNeeded();await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function dragTo(page,f,kind,date,hold=0){
 await reveal(f);const b=await handle(f,kind).boundingBox();expect(b).not.toBeNull();
 const cell=f.locator('.scheduler-week-day[data-scheduler-date="'+date+'"],.scheduler-month-day[data-scheduler-date="'+date+'"]');
 const d=await cell.boundingBox();expect(d).not.toBeNull();
 let y=b.y+b.height/2;if(await f.locator('.program-calendar--month').count())y=d.y+50;
 await page.mouse.move(b.x+22,b.y+22);await page.mouse.down();await page.mouse.move(d.x+d.width/2,y,{steps:8});
 if(hold)await page.waitForTimeout(hold);await page.mouse.up();
}
async function noModal(f){await expect(f.locator('.uos-modal-backdrop,dialog[open]')).toHaveCount(0);}
for(const owner of ['NSA','EVT']){
test(owner+': move preserves hours; side handles convert only after confirmation and Save',async({page})=>{
 const {frame:f,ids,errors}=await setup(page,owner);await select(f,ids.morning);
 const original=await f.evaluate(()=>UOS.ProgramApp.workspace().entities.jobs);
 await dragTo(page,f,'move','2026-10-06');await noModal(f);
 await expect(form(f).locator('[name=startDate]')).toHaveValue('2026-10-06');await expect(form(f).locator('[name=startTime]')).toHaveValue('09:00');await expect(form(f).locator('[name=endTime]')).toHaveValue('10:30');
 await dragTo(page,f,'date-end','2026-10-08');
 let modal=f.locator('.scheduler-all-day-confirm');await expect(modal).toBeVisible();await expect(modal.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();await expect(form(f).locator('[name=allDay]')).not.toBeChecked();
 await modal.getByRole('button',{name:'Cancel',exact:true}).click();await noModal(f);await expect(form(f).locator('[name=endDate]')).toHaveValue('2026-10-06');await expect(form(f).locator('[name=startTime]')).toHaveValue('09:00');
 await dragTo(page,f,'date-end','2026-10-08');await modal.getByRole('button',{name:'Convert to all day',exact:true}).click();await noModal(f);
 await expect(form(f).locator('[name=allDay]')).toBeChecked();await expect(form(f).locator('[name=startDate]')).toHaveValue('2026-10-06');await expect(form(f).locator('[name=endDate]')).toHaveValue('2026-10-08');
 await expect(f.locator('.scheduler-all-day-card[data-scheduler-job="'+ids.morning+'"]')).toHaveCount(1);await expect(f.locator('.scheduler-week-job[data-scheduler-job="'+ids.morning+'"]')).toHaveCount(0);
 expect(await f.evaluate(()=>UOS.ProgramApp.workspace().entities.jobs)).toEqual(original);
 const span=await f.locator('.scheduler-all-day-card[data-scheduler-job="'+ids.morning+'"]').evaluate(n=>({start:n.style.gridColumnStart,end:n.style.gridColumnEnd}));expect(span).toEqual({start:'2',end:'5'});
 await dragTo(page,f,'date-start','2026-10-05');await noModal(f);await expect(form(f).locator('[name=startDate]')).toHaveValue('2026-10-05');
 await form(f).getByRole('button',{name:'Save schedule',exact:true}).click();await expect.poll(()=>f.evaluate(id=>UOS.ProgramApp.workspace().entities.jobs.find(j=>j.id===id).allDay,ids.morning)).toBe(true);
 const saved=await f.evaluate(id=>UOS.ProgramApp.workspace().entities.jobs.find(j=>j.id===id),ids.morning);expect(saved.endDate).toBe('2026-10-08');expect(saved.startTime).toBe('');expect(saved.endTime).toBe('');expect(errors).toEqual([]);
});
}
test('Month single-row spans, cross-row linked cards, date resizing and keyboard movement',async({page})=>{
 const {frame:f,ids,errors}=await setup(page);await f.evaluate(id=>UOS.ProgramApp.updateWorkspace(w=>{const j=w.entities.jobs.find(j=>j.id===id);Object.assign(j,{allDay:true,startTime:'',endTime:'',startDate:'2026-10-06',endDate:'2026-10-08'});return w;}),ids.morning);
 await select(f,ids.morning);await f.getByRole('button',{name:'Month',exact:true}).click();
 let cards=f.locator('.scheduler-month-card[data-scheduler-job="'+ids.morning+'"]');await expect(cards).toHaveCount(1);expect(await cards.evaluate(n=>n.style.gridColumn)).toBe('2 / 5');
 await dragTo(page,f,'date-end','2026-10-13');await noModal(f);await expect(form(f).locator('[name=endDate]')).toHaveValue('2026-10-13');await expect(cards).toHaveCount(8);
 expect(await cards.evaluateAll(ns=>ns.every(n=>n.classList.contains('is-selected')&&getComputedStyle(n,'::after').animationName==='scheduler-selection-ants'))).toBe(true);
 await reveal(f);await handle(f,'move').focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await expect(form(f).locator('[name=startDate]')).toHaveValue('2026-10-07');await expect(form(f).locator('[name=endDate]')).toHaveValue('2026-10-14');
 await form(f).getByRole('button',{name:'Save schedule',exact:true}).click();await expect.poll(()=>f.evaluate(id=>UOS.ProgramApp.workspace().entities.jobs.find(j=>j.id===id).endDate,ids.morning)).toBe('2026-10-14');await f.locator('[data-program-destination="register"]').click();await expect(handle(f,'move')).toHaveCount(0);expect(errors).toEqual([]);
});
