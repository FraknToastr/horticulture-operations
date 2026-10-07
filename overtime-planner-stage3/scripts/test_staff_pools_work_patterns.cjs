'use strict';
// Independent Stage 4B proof. Uses only this project's runtime and browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { repoRoot, loadPlaywright } = require('./local-test-environment.cjs');
const root = repoRoot();
const checks = [], errors = [], dialogs = [];
const report = { passed:false, checks, errors, dialogs };
function checked(name) { checks.push(name); console.log('PASS: ' + name); }

function contracts() {
  global.window = global;
  global.HortOpsData = {};
  require(path.join(root, 'js/data/holidays.js'));
  require(path.join(root, 'js/utils/planningRules.js'));
  const rules = global.HortOpsPlanningRules;
  const weekly = { id:'JOB-CONTRACT', frequencyType:'work_pattern', workPattern:{mode:'weekly',startDate:'2026-01-01',days:[6,0],includePublicHolidays:true,excludedDates:[]} };
  assert.equal(rules.validatePattern(weekly).valid,true);
  const dates = rules.dates(weekly,2026);
  assert.deepEqual(dates.filter(d=>d>='2026-04-03'&&d<='2026-04-06'),['2026-04-03','2026-04-04','2026-04-05','2026-04-06']);
  assert.equal(dates.length,new Set(dates).size);
  checked('Saturday/Sunday plus holidays generates four unique Easter dates');
  weekly.workPattern.excludedDates=['2026-04-05'];
  assert.equal(rules.dates(weekly,2026).includes('2026-04-05'),false);
  assert.equal(rules.dates(weekly,2027).includes('2027-01-26'),true);
  checked('Date exclusions and Tuesday public holiday are canonical');
  const run = {...weekly,workPattern:{mode:'run',startDate:'2026-12-30',runLength:4,includePublicHolidays:false,excludedDates:[]}};
  assert.equal(rules.validatePattern(run).valid,true);
  assert.deepEqual(rules.dates(run,2026),['2026-12-30','2026-12-31']);
  assert.deepEqual(rules.dates(run,2027),['2027-01-01','2027-01-02']);
  checked('Four-day run spans the year boundary without duplication');
  const badPatterns = [
    {...run.workPattern,runLength:5}, {...run.workPattern,runLength:0},
    {...weekly.workPattern,days:[0,2]}, {...weekly.workPattern,days:[6,6]},
    {...weekly.workPattern,startDate:'2026-02-30'}, {...weekly.workPattern,endDate:'2025-12-31'},
    {...weekly.workPattern,excludedDates:['2026-04-05','2026-04-05']},
    {...weekly.workPattern,includePublicHolidays:'true'}
  ];
  for (const p of badPatterns) assert.equal(rules.validatePattern({...weekly,workPattern:p}).valid,false,JSON.stringify(p));
  checked('Invalid dates, duplicate days, nonconsecutive runs and fifth days fail closed');
  const catalogue=[{id:'POOL-RANGER',label:'ParkRanger',active:true},{id:'POOL-WEEKEND',label:'Weekend',active:true}];
  assert.equal(rules.matches({poolTagIds:['POOL-WEEKEND']},['POOL-RANGER','POOL-WEEKEND'],catalogue),true);
  assert.equal(rules.matches({poolTagIds:['POOL-RANGER']},['POOL-RANGER'],catalogue.map(t=>({...t,active:false}))),false);
  assert.equal(rules.validateWorkspace({jobs:[],roster:[]}).valid,true);
  for (const poolTags of [null, {}, [...catalogue,{id:'POOL-DUP',label:'parkranger',active:true}], [...catalogue,catalogue[0]]]) {
    assert.equal(rules.validateWorkspace({poolTags,jobs:[],roster:[]}).valid,false);
  }
  assert.equal(rules.validateWorkspace({poolTags:catalogue,jobs:[],roster:[{poolTagIds:['POOL-UNKNOWN']}]}).valid,false);
  assert.equal(rules.validateWorkspace({poolTags:catalogue,jobs:[{exclusivePoolSource:'tags',isExclusiveTeams:true}],roster:[]}).valid,false);
  checked('Tag union, retired tags, legacy omission, unique labels and unknown references');
}

async function ready(page) { await page.waitForFunction(()=>window.HortOpsWriterSession&&HortOpsWriterSession.canWrite()); }
async function source(page) { return page.evaluate(()=>localStorage.getItem(HortOpsClientStorage.workspaceKey)); }
async function main() {
  contracts();
  const playwright=loadPlaywright();
  const browser=await playwright.chromium.launch({headless:true});
  report.browserVersion=browser.version();
  const context=await browser.newContext();
  try {
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push('After '+checks.at(-1)+': '+e.stack));
    page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
    await page.goto(pathToFileURL(path.join(root,'index.html')).href); await ready(page);
    assert.equal(await page.evaluate(()=>!!window.HortOpsPlanningRules),true,'Build standalone before running Stage 4B proof');
    const legacyEnvelope=await page.evaluate(()=>{
      const envelope=HortOpsStorage.createWorkspaceEnvelope({schemaVersion:2,jobs:[],roster:[],assignments:{},rostering:HortOpsApp.state.rostering,historicalSnapshots:{},permits:{}});
      delete envelope.poolTags;
      if(!HortOpsSchemaValidator.validateCurrentV2ForBoundary(envelope).valid)throw new Error('Legacy optional-field compatibility rejected');
      return envelope;
    });
    checked('Current Schema v2 workspace without pool fields remains valid');
    const isolated={window:{}};
    vm.runInNewContext(fs.readFileSync(path.join(root,'js/utils/storage/schemaValidator.js'),'utf8'),isolated,{filename:'independent-schema-validator.js'});
    const isolatedValidator=isolated.window.HortOpsSchemaValidator;
    assert.equal(isolatedValidator.validateWorkspaceSchema(JSON.parse(JSON.stringify(legacyEnvelope))).valid,true);
    for(const poolTags of [[],null]) assert.equal(isolatedValidator.validateWorkspaceSchema({...JSON.parse(JSON.stringify(legacyEnvelope)),poolTags}).valid,false);
    assert.equal(isolatedValidator.validateWorkspaceSchema({...JSON.parse(JSON.stringify(legacyEnvelope)),jobs:[{id:'JOB-MISSING-RULES',name:'Missing rules',frequencyType:'work_pattern'}]}).valid,false);
    checked('Missing planning module permits old v2 only and rejects even empty/null extensions');
    const setup=await page.evaluate(()=>{
      const csv='ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\n'+[
        ['1','Alpha Home','Parks','active'],['2','Bravo Cross','Roads','active'],
        ['3','Charlie Other','Libraries','active'],['4','Delta Inactive','Roads','inactive']
      ].map(([id,name,team,status])=>`EMP-POOL-${id},${name},pool${id}@example.test,Operations,${team},Worker,FALSE,${status}`).join('\n')+'\n';
      const parsed=HortOpsUserCsvParser.parseUserCsv(csv,[]);
      const imported=HortOpsApp.importStaffMembers(parsed.staff);
      const pools=HortOpsApp._commitCanonicalProposal({poolTags:[{id:'POOL-RANGER',label:'ParkRanger',active:true},{id:'POOL-WEEKEND',label:'Weekend',active:true}]});
      const members=[['2',['POOL-RANGER']],['3',['POOL-WEEKEND']],['4',['POOL-RANGER']]].map(([id,poolTagIds])=>HortOpsApp.updateStaffMember({id:'EMP-POOL-'+id,poolTagIds}).success);
      return {parsed:parsed.success,imported:imported.success,pools:pools.success,members};
    });
    assert.deepEqual(setup,{parsed:true,imported:true,pools:true,members:[true,true,true]});
    checked('Canonical pool catalogue and cross-team memberships persist');
    await page.evaluate(()=>HortOpsStaffPoolModal.open('EMP-POOL-2'));
    await page.locator('#pool-new-label').fill('#EventCover');
    await page.locator('[data-pool-create]').click();
    const uiTag=await page.evaluate(()=>HortOpsStaffPoolModal.model.tags.find(t=>t.label==='EventCover').id);
    await page.locator('[data-membership="'+uiTag+'"]').check();
    await page.locator('[data-pool-save]').click();
    assert.equal(await page.evaluate(id=>HortOpsApp.state.staffList.find(s=>s.id==='EMP-POOL-2').poolTagIds.includes(id),uiTag),true);
    checked('Workforce real modal creates catalogue tag and saves membership');
    const bytes=await source(page);
    const invalid=await page.evaluate(()=>{
      const before=localStorage.getItem(HortOpsClientStorage.workspaceKey);
      const duplicate=HortOpsApp._commitCanonicalProposal({poolTags:[...HortOpsApp.state.poolTags,{id:'POOL-DUP',label:'parkranger',active:true}]});
      const unknown=HortOpsApp.updateStaffMember({id:'EMP-POOL-1',poolTagIds:['POOL-UNKNOWN']});
      const bad=HortOpsApp._commitCanonicalProposal({poolTags:null});
      return {duplicate:duplicate.success,unknown:unknown.success,bad:bad.success,same:localStorage.getItem(HortOpsClientStorage.workspaceKey)===before};
    });
    assert.deepEqual(invalid,{duplicate:false,unknown:false,bad:false,same:true}); assert.equal(await source(page),bytes);
    checked('Invalid catalogue and membership commands preserve exact saved source bytes');
    const imported=await page.evaluate(()=>{
      const csv='ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\n'+HortOpsApp.state.staffList.map(s=>[s.id,s.name,s.email,s.department,s.team,s.role,'FALSE',s.status].join(',')).join('\n')+'\n';
      const parsed=HortOpsUserCsvParser.parseUserCsv(csv,HortOpsApp.state.staffList);
      const result=HortOpsApp.importStaffMembers(parsed.staff);
      return {success:result.success,members:HortOpsApp.state.staffList.map(s=>[s.id,s.poolTagIds||[]])};
    });
    assert.equal(imported.success,true);
    assert.deepEqual(imported.members.find(s=>s[0]==='EMP-POOL-2')[1],['POOL-RANGER',uiTag]);
    assert.deepEqual(imported.members.find(s=>s[0]==='EMP-POOL-3')[1],['POOL-WEEKEND']);
    checked('Actual User Table CSV parse/import preserves local pool memberships');
    const ambiguity=await page.evaluate(()=>{
      const seeded=HortOpsApp.updateStaffMember({id:'EMP-POOL-3',email:'pool2@example.test'});
      const before=localStorage.getItem(HortOpsClientStorage.workspaceKey);
      const parsed=HortOpsUserCsvParser.parseUserCsv('ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\n,Unresolved identity,pool2@example.test,Operations,Roads,Worker,FALSE,active\n',HortOpsApp.state.staffList);
      const same=localStorage.getItem(HortOpsClientStorage.workspaceKey)===before;
      const restored=HortOpsApp.updateStaffMember({id:'EMP-POOL-3',email:'pool3@example.test'});
      return {seeded:seeded.success,success:parsed.success,errors:parsed.errors,same,restored:restored.success};
    });
    assert.equal(ambiguity.seeded,true);assert.equal(ambiguity.success,false);assert.equal(ambiguity.same,true);assert.equal(ambiguity.restored,true);
    assert.match(JSON.stringify(ambiguity.errors),/Ambiguous workforce identity/);
    checked('Ambiguous User Table identity is rejected before any membership transfer');
    const jobResult=await page.evaluate(()=>HortOpsApp.saveJob({
      id:'JOB-PATTERN',name:'Rangers multi-day holiday service',category:'Parks',frequencyType:'work_pattern',
      workPattern:{mode:'weekly',startDate:'2026-01-01',days:[6,0],includePublicHolidays:true,excludedDates:['2026-04-05']},
      preferredPoolTagIds:['POOL-RANGER'],exclusivePoolSource:'tags',exclusivePoolTagIds:['POOL-RANGER','POOL-WEEKEND'],
      startTime:'06:00 AM',durationHours:6,crewSize:2,status:'active',color:'#047857'
    }));
    assert.equal(jobResult.success,true,jobResult.error);
    await page.evaluate(()=>HortOpsJobEditModal.open('JOB-PATTERN'));
    await page.locator('[data-pattern="includePublicHolidays"]').uncheck();
    await page.locator('[data-pattern="includePublicHolidays"]').check();
    await page.locator('[data-pattern="excludedDates"]').fill('2026-04-05');
    await page.locator('[data-pattern="excludedDates"]').dispatchEvent('change');
  await page.locator('#job-edit-modal-root button[type="submit"]').click();
  await page.waitForTimeout(250);
  await page.waitForFunction(()=>!HortOpsJobEditModal.formData);
    checked('Real Job Registry form edits and saves recurring weekdays, holidays and exclusions');
    const occurrences=await page.evaluate(()=>HortOpsApp.state.allShifts.filter(s=>s.jobId==='JOB-PATTERN').map(s=>s.shiftId));
    assert.deepEqual(occurrences.filter(s=>s>='JOB-PATTERN@2026-04-03'&&s<='JOB-PATTERN@2026-04-06'),['JOB-PATTERN@2026-04-03','JOB-PATTERN@2026-04-04','JOB-PATTERN@2026-04-06']);
    assert.equal(occurrences.length,new Set(occurrences).size);
    checked('Scheduler creates weekly/holiday occurrences once and respects excluded dates');
    const eligibility=await page.evaluate(()=>{
      const shift=HortOpsApp.state.allShifts.find(s=>s.shiftId==='JOB-PATTERN@2026-04-03');
      const job=HortOpsApp.state.jobs.find(j=>j.id==='JOB-PATTERN');
      const evaluations=HortOpsApp.state.staffList.map(s=>({id:s.id,...HortOpsEligibilityEngine.validateStaffEligibility(s,shift,job,HortOpsApp.state.allShifts,[])}));
      const ordered=HortOpsStaffAssignCandidateModel.sortCandidates(HortOpsApp.state.staffList.filter(s=>s.status==='active').map(s=>({...s})),{matchingJob:job,prefs:{primaryTeam:'Parks'},assignedIdsSet:new Set(),asOfDate:'2026-04-03'}).map(s=>s.id);
      return {evaluations,ordered};
    });
    assert.equal(eligibility.evaluations.find(s=>s.id==='EMP-POOL-1').eligible,false);
    assert.equal(eligibility.evaluations.find(s=>s.id==='EMP-POOL-2').eligible,true);
    assert.equal(eligibility.evaluations.find(s=>s.id==='EMP-POOL-3').eligible,true);
    assert.equal(eligibility.evaluations.find(s=>s.id==='EMP-POOL-4').eligible,false);
    assert.equal(eligibility.ordered[0],'EMP-POOL-2');
    checked('Exclusive any-tag union admits cross-team staff while preference ranks tagged staff first');
    checked('Tags do not bypass inactive employment eligibility');
    const exempt=await page.evaluate(()=>{
      const staff={...HortOpsApp.state.staffList.find(s=>s.id==='EMP-POOL-2'),isOvertimeExempt:true};
      const shift=HortOpsApp.state.allShifts.find(s=>s.shiftId==='JOB-PATTERN@2026-04-03');
      const job=HortOpsApp.state.jobs.find(j=>j.id==='JOB-PATTERN');
      return HortOpsEligibilityEngine.validateStaffEligibility(staff,shift,job,[],[]);
    });
    assert.equal(exempt.eligible,false);assert.equal(exempt.reasons.includes('OVERTIME_EXEMPT'),true);
    checked('Pool membership does not bypass overtime exemption');
    const safety=await page.evaluate(()=>{
      const staff=HortOpsApp.state.staffList.find(s=>s.id==='EMP-POOL-2'),shift=HortOpsApp.state.allShifts.find(s=>s.shiftId==='JOB-PATTERN@2026-04-03'),job=HortOpsApp.state.jobs.find(j=>j.id==='JOB-PATTERN');
      const qualification=HortOpsEligibilityEngine.validateStaffEligibility(staff,shift,{...job,requiredQualifications:['WHITE_CARD']},[],[]);
      const other={...shift,shiftId:'JOB-OTHER@2026-04-03',jobId:'JOB-OTHER',assignedStaffIds:[staff.id]};
      const overlap=HortOpsEligibilityEngine.validateStaffEligibility(staff,shift,job,[other],[]);
      return {qualification,overlap};
    });
    assert.equal(safety.qualification.eligible,false);assert.equal(safety.qualification.reasons.includes('LACKS_REQUIRED_QUALIFICATION'),true);
    assert.equal(safety.overlap.eligible,false);assert.equal(safety.overlap.reasons.includes('OVERLAPPING_SHIFT'),true);
    checked('Tagged cross-team candidates still fail mandatory qualification and overlap checks');
    assert.equal(await page.evaluate(()=>HortOpsApp.saveJob({...HortOpsApp.state.jobs.find(j=>j.id==='JOB-PATTERN'),id:'JOB-INACTIVE-PATTERN',name:'Inactive pattern',status:'inactive'}).success),true);
    assert.equal(await page.evaluate(()=>HortOpsApp.state.allShifts.some(s=>s.jobId==='JOB-INACTIVE-PATTERN')),false);
    checked('Inactive work pattern generates no future vacancies');
    await page.evaluate(()=>HortOpsJobEditModal.open());
    await page.locator('input[oninput*="updateField"][oninput*="name"]').fill('Four-day year-boundary service');
    await page.locator('input[oninput*="updateField"][oninput*="crewSize"]').fill('1');
    await page.locator('select[onchange*="frequencyType"]').selectOption('work_pattern');
    assert.equal(await page.evaluate(()=>{
      const pattern=document.querySelector('.work-pattern-editor');
      const children=Array.from(document.querySelector('#job-edit-modal-root .modal-body').children);
      const patternIndex=children.findIndex(node=>node.contains(pattern));
      const plantIndex=children.findIndex(node=>node.textContent.includes('Requires Certified Plant Operator'));
      return patternIndex > -1 && plantIndex > patternIndex;
    }),true,'Schedule controls must appear before the plant-operator requirement');
    await page.locator('[data-consecutive-start]').selectOption('6');
    await page.locator('[data-consecutive-length]').selectOption('3');
    assert.deepEqual(await page.evaluate(()=>HortOpsJobEditModal.formData.workPattern.days),[6,0,1]);
    await page.locator('[data-pattern="mode"]').selectOption('run');
    await page.locator('[data-pattern="startDate"]').fill('2026-12-30');
    await page.locator('[data-pattern="startDate"]').dispatchEvent('change');
    await page.locator('[data-pattern="runLength"]').fill('4');
    await page.locator('[data-pattern="runLength"]').dispatchEvent('change');
    await page.locator('[data-pool-source]').selectOption('tags');
    await page.locator('[data-exclusive-pool="POOL-RANGER"]').check();
    const runId=await page.evaluate(()=>HortOpsJobEditModal.formData.id);
    await page.locator('#job-edit-modal-root button[type="submit"]').click();
    await page.waitForTimeout(250);
    await page.waitForFunction(()=>!HortOpsJobEditModal.formData);
    assert.deepEqual(await page.evaluate(id=>HortOpsApp.state.allShifts.filter(s=>s.jobId===id).map(s=>s.shiftId.split('@')[1]),runId),['2026-12-30','2026-12-31']);
    checked('Real Job Creator creates a four-day run with arbitrary weekdays');
    await page.evaluate(id=>HortOpsStaffAssignModal.open(id+'@2026-12-30'),runId);
    await page.locator('button[onclick*="addStaff"][onclick*="EMP-POOL-2"]').click();
    await page.locator('select.assignment-mode-select[onchange*="EMP-POOL-2"]').selectOption('fixed');
    assert.equal(await page.locator('.assignment-continuity-guide').count(),1,'Assignment recurrence control has an explanatory label');
    assert.equal(await page.locator('select.repeat-count-select[onchange*="EMP-POOL-2"] option[value="4"]').count(),1,'Cross-year run must offer all four occurrences');
    await page.locator('select.repeat-count-select[onchange*="EMP-POOL-2"]').selectOption('4');
    await page.locator('button[onclick*="saveAllocation"]').click();
    await page.waitForFunction(()=>!HortOpsStaffAssignModal.activeShiftId);
    assert.deepEqual(await page.evaluate(id=>HortOpsApp.state.allShifts.filter(s=>s.jobId===id).map(s=>s.assignedStaffIds),runId),[['EMP-POOL-2'],['EMP-POOL-2']]);
    checked('Fixed assignment offers four repeats and fills current-year consecutive dates');
    await page.evaluate(()=>{HortOpsApp.setYear(2027);HortOpsForwardPlanner.startWeekInitialized=true;HortOpsForwardPlanner.startWeek=4;HortOpsForwardPlanner.windowSize=6;HortOpsApp.setActiveView('forward_planner');});
    assert.deepEqual(await page.evaluate(id=>HortOpsApp.state.allShifts.filter(s=>s.jobId===id).map(s=>s.shiftId.split('@')[1]),runId),['2027-01-01','2027-01-02']);
    assert.deepEqual(await page.evaluate(id=>HortOpsApp.state.allShifts.filter(s=>s.jobId===id).map(s=>s.assignedStaffIds),runId),[['EMP-POOL-2'],['EMP-POOL-2']]);
    checked('Saved four-day run regenerates remaining dates in next year');
    const vacancy=page.locator('button.vacancy-add-btn[onclick*="JOB-PATTERN@2027-01-26"]');
    assert.equal(await vacancy.count(),2,'Tuesday public holiday must appear in Forward Planner');
    await vacancy.first().click();
    assert.equal(await page.locator('button[onclick*="addStaff"][onclick*="EMP-POOL-1"]').count(),0,'Nonmember must not be assignable');
    for (const id of ['2','3']) await page.locator('button[onclick*="addStaff"][onclick*="EMP-POOL-'+id+'"]').click();
    await page.locator('button[onclick*="saveAllocation"]').click();
    await page.waitForFunction(()=>!HortOpsStaffAssignModal.activeShiftId);
    const assigned=page.locator('button.shift-card-btn[onclick*="JOB-PATTERN@2027-01-26"]');
    assert.equal(await assigned.count(),2);
    const rotationJob=await page.evaluate(()=>HortOpsApp.saveJob({id:'JOB-ROTATION-PATTERN',name:'Tagged rotation service',category:'Parks',frequencyType:'work_pattern',workPattern:{mode:'weekly',startDate:'2027-02-13',endDate:'2027-02-20',days:[6,0],includePublicHolidays:false,excludedDates:[]},exclusivePoolSource:'tags',exclusivePoolTagIds:['POOL-RANGER','POOL-WEEKEND'],startTime:'06:00 AM',durationHours:6,crewSize:1,status:'active',color:'#047857'}));
    assert.equal(rotationJob.success,true,rotationJob.error);
    await page.evaluate(()=>HortOpsStaffAssignModal.open('JOB-ROTATION-PATTERN@2027-02-13'));
    await page.locator('button[onclick*="addStaff"][onclick*="EMP-POOL-2"]').click();
    await page.locator('select.assignment-mode-select[onchange*="EMP-POOL-2"]').selectOption('rotation');
    await page.locator('select.repeat-count-select[onchange*="EMP-POOL-2"]').selectOption('3');
    await page.locator('button[onclick*="saveAllocation"]').click();
    await page.waitForFunction(()=>!HortOpsStaffAssignModal.activeShiftId);
    assert.deepEqual(await page.evaluate(()=>HortOpsApp.state.allShifts.filter(s=>s.jobId==='JOB-ROTATION-PATTERN').map(s=>({date:s.date,staff:s.assignedStaffIds}))),[
      {date:'2027-02-13',staff:['EMP-POOL-2']},{date:'2027-02-14',staff:['EMP-POOL-3']},{date:'2027-02-20',staff:['EMP-POOL-2']}
    ]);
    checked('Actual Rotation strategy respects cross-team exclusive union on consecutive dates');
    await page.evaluate(()=>{HortOpsApp.setYear(2029);HortOpsForwardPlanner.startWeekInitialized=true;HortOpsForwardPlanner.startWeek=13;HortOpsForwardPlanner.windowSize=6;HortOpsApp.setActiveView('forward_planner');});
    const monthBoundaryVacancy=page.locator('button.vacancy-add-btn[onclick*="JOB-PATTERN@2029-04-01"]');
    assert.equal(await monthBoundaryVacancy.count(),2,'Easter Sunday crossing March/April must be visible');
    await monthBoundaryVacancy.first().click();
    for(const id of ['2','3']) await page.locator('button[onclick*="addStaff"][onclick*="EMP-POOL-'+id+'"]').click();
    await page.locator('button[onclick*="saveAllocation"]').click();
    await page.waitForFunction(()=>!HortOpsStaffAssignModal.activeShiftId);
    assert.equal(await page.locator('button.shift-card-btn[onclick*="JOB-PATTERN@2029-04-01"]').count(),2);
    checked('Assigned Easter occurrence stays visible across March/April month boundary');
    await page.evaluate(()=>{HortOpsApp.setYear(2027);HortOpsForwardPlanner.startWeekInitialized=true;HortOpsForwardPlanner.startWeek=4;HortOpsForwardPlanner.windowSize=6;HortOpsApp.setActiveView('forward_planner');});
    assert.equal(await assigned.count(),2,'Prior-year assigned cards survive another year allocation');
    const committed=await source(page);
    assert.deepEqual(JSON.parse(committed).poolTags.map(t=>t.label),['ParkRanger','Weekend','EventCover']);
    checked('Tuesday holiday accepts valid crew via real controls and shows assigned cards');
    await page.reload(); await ready(page);
    await page.evaluate(()=>{HortOpsForwardPlanner.startWeekInitialized=true;HortOpsForwardPlanner.startWeek=4;HortOpsForwardPlanner.windowSize=6;HortOpsApp.setActiveView('forward_planner');});
    assert.equal(await assigned.count(),2,JSON.stringify(await page.evaluate(()=>({year:HortOpsApp.state.currentYear,ui:HortOpsApp.state.uiState,shift:HortOpsApp.state.allShifts.find(s=>s.shiftId==='JOB-PATTERN@2027-01-26'),text:document.getElementById('content-mount').innerText.slice(0,300)}))));
    const reloaded=JSON.parse(await source(page)), prior=JSON.parse(committed);
    for (const field of ['poolTags','roster','jobs','assignments','historicalSnapshots','rostering']) assert.deepEqual(reloaded[field],prior[field],field+' survives allocation and reload');
    checked('Assignment save/reload preserves tags, patterns, snapshots and visible holiday crew');
    const protectedResult=await page.evaluate(()=>{
      const before=localStorage.getItem(HortOpsClientStorage.workspaceKey);
      const job=JSON.parse(JSON.stringify(HortOpsApp.state.jobs.find(j=>j.id==='JOB-PATTERN')));
      job.workPattern.excludedDates.push('2027-01-26');
      const result=HortOpsApp.saveJob(job);
      return {success:result.success,error:result.error,same:localStorage.getItem(HortOpsClientStorage.workspaceKey)===before,retainedShift:HortOpsApp.state.allShifts.find(s=>s.shiftId==='JOB-PATTERN@2027-01-26')};
    });
    assert.equal(protectedResult.success,false,protectedResult.error);
    assert.equal(protectedResult.same,true);
    checked('Excluded assigned date is blocked without deleting saved commitments');
    const protectedDomains=await page.evaluate(()=>JSON.stringify({assignments:HortOpsApp.state.customAssignments,snapshots:HortOpsApp.state.historicalSnapshots,rostering:HortOpsApp.state.rostering}));
    await page.evaluate(()=>HortOpsStaffPoolModal.open());
    await page.locator('[data-pool-active="POOL-RANGER"]').click();
    assert.match(await page.locator('#pool-modal-root').innerText(),/impact review/i);
    await page.locator('[data-pool-save]').click();
    assert.equal(await page.evaluate(()=>HortOpsApp.state.poolTags.find(t=>t.id==='POOL-RANGER').active),false);
    assert.equal(await page.evaluate(()=>JSON.stringify({assignments:HortOpsApp.state.customAssignments,snapshots:HortOpsApp.state.historicalSnapshots,rostering:HortOpsApp.state.rostering})),protectedDomains);
    assert.equal(await assigned.count(),2);
    checked('Real tag retirement previews impacts and retains existing assigned cards/history');
    const deniedWrite=await page.evaluate(()=>{
      const key=HortOpsClientStorage.workspaceKey,before=localStorage.getItem(key),live=JSON.stringify(HortOpsApp.state.poolTags),original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Synthetic pool quota failure','QuotaExceededError');return original.call(this,k,v);};
      let result;
      try {result=HortOpsApp._commitCanonicalProposal({poolTags:HortOpsApp.state.poolTags.map(t=>t.id==='POOL-RANGER'?{...t,label:'RangerRenamed'}:t)});} finally {Storage.prototype.setItem=original;}
      return {success:result.success,same:localStorage.getItem(key)===before,live:JSON.stringify(HortOpsApp.state.poolTags)===live};
    });
    assert.deepEqual(deniedWrite,{success:false,same:true,live:true});
    checked('Pool persistence failure preserves source bytes and live catalogue');
    const peer=await context.newPage(); peer.on('pageerror',e=>errors.push(e.message));
    await peer.goto(pathToFileURL(path.join(root,'index.html')).href);
    await peer.waitForFunction(()=>HortOpsWriterSession.status().mode==='read-only');
    const finalBytes=await source(page);
    assert.equal(await peer.evaluate(()=>HortOpsApp._commitCanonicalProposal({poolTags:[]}).success),false);
    assert.equal(await source(page),finalBytes);
    await page.evaluate(()=>HortOpsStaffPoolModal.open('EMP-POOL-2'));
    await page.locator('[data-membership="POOL-RANGER"]').uncheck();
    await page.evaluate(()=>HortOpsWriterSession.release());
    assert.equal(await page.evaluate(()=>HortOpsStaffPoolModal.model),null,'Release must discard pool editor buffer');
    await peer.evaluate(()=>HortOpsWriterSession.acquire()); await ready(peer);
    assert.equal(await peer.evaluate(()=>HortOpsApp.updateStaffMember({id:'EMP-POOL-2',poolTagIds:['POOL-RANGER']}).success),true);
    const newerBytes=await source(peer);
    await peer.evaluate(()=>HortOpsWriterSession.release());
    await page.evaluate(()=>HortOpsWriterSession.acquire()); await ready(page);
    await page.evaluate(()=>HortOpsStaffPoolModal.save());
    assert.equal(await source(page),newerBytes);
    checked('Readonly peer cannot write pools; owner transfer discards stale membership form');
    await peer.close();
    assert.deepEqual(errors,[]); report.passed=true;
    console.log('STAFF POOLS / WORK PATTERNS CHECKS PASSED: '+checks.length);
  } finally {
    await context.close(); await browser.close();
    const folder=path.join(root,'test_reports/staff-pools-work-patterns');fs.mkdirSync(folder,{recursive:true});
    fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(report,null,2)+'\n');
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
