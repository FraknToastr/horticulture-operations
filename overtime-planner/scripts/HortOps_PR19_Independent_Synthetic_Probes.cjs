'use strict';
// Independent full-repository review, synthetic data only; does not alter the submitted source.
const path=require('path');
const root=process.env.HORTOPS_REVIEW_SOURCE || path.resolve(__dirname,'..');
class MockStorage { constructor(){this.map={};this.failWrites=false;} getItem(k){return Object.prototype.hasOwnProperty.call(this.map,k)?this.map[k]:null;} setItem(k,v){if(this.failWrites)throw Error('SIMULATED_STORAGE_FAILURE');this.map[k]=String(v);} removeItem(k){delete this.map[k];} clear(){this.map={};}}
let alerts=[];
global.window={localStorage:new MockStorage(), HortOpsData:{HISTORICAL_OCCURRENCES:[],INITIAL_JOBS:[],STAFF_ROSTER:[]},HortOpsHeader:{updateStorageHealth:()=>{}, updateStorageHealthIndicator:()=>{}}};
global.localStorage=window.localStorage;global.alert=(m)=>alerts.push(m);global.document={getElementById:()=>null,addEventListener:()=>{}};
function req(p){require(path.join(root,p));}
req('js/utils/storage/schemaValidator.js');req('js/utils/storage/migrationEngine.js');req('js/utils/storage/storageDriver.js');req('js/utils/storage.js');req('js/app.js');
const app=window.HortOpsApp, storage=window.HortOpsStorage, validator=window.HortOpsSchemaValidator;
app.recomputeDigest=()=>{}; app.renderCurrentView=()=>{};
const clone=v=>JSON.parse(JSON.stringify(v));
const job=(id='JOB-REVIEW')=>({id,name:'Synthetic Review Job',frequencyType:'one_off',targetDate:'2025-06-07',status:'inactive',crewSize:1,startTime:'08:00',durationHours:4});
const person={id:'EMP-REVIEW',name:'Synthetic Staff',team:'Parks',status:'active'};
const key='JOB-REVIEW@2025-06-07';
const snapshot={shiftId:key,jobId:'JOB-REVIEW',date:'2025-06-07',startTime:'08:00',durationHours:4,assignedStaffIds:['EMP-REVIEW'],recordType:'scheduled_commitment'};
const payload=(over={})=>Object.assign({schemaVersion:2,jobs:[job()],roster:[person],assignments:{},rostering:{instructions:{},provenance:{}},historicalSnapshots:{[key]:snapshot},permits:{},budgetSettings:{annualBudgetCap:500},uiState:{currentYear:2026,activeView:'forward_planner'}},over);
function reset(p=payload()) {window.localStorage.clear(); const s=storage.saveWorkspace(p); if(!s.ok)throw Error('Invalid synthetic fixture '+s.error); app.state={schemaVersion:2,jobs:clone(p.jobs),staffList:clone(p.roster),customAssignments:clone(p.assignments),historicalSnapshots:clone(p.historicalSnapshots),rostering:clone(p.rostering),customPermits:clone(p.permits||{}),budgetSettings:clone(p.budgetSettings||{}),activeView:'forward_planner',currentYear:2026,recoveryRequired:false,storageStatus:'saved'};app._authoritativeSnapshotCount=Object.keys(p.historicalSnapshots).length;app._allowHistoryReset=false;alerts=[];}
let failures=0;
function check(title,found,details){if(found)failures++;console.log(`${found?'REPRODUCED':'NOT_REPRODUCED'} ${title}: ${JSON.stringify(details)}`);}
// P1: orphan a history-only snapshot by hard-deleting its parent Job.
reset();const deps=app.getJobDependencies('JOB-REVIEW',app.state);const priorRaw=localStorage.getItem(storage.WORKSPACE_STORAGE_KEY);app.deleteJob('JOB-REVIEW');const after=JSON.parse(localStorage.getItem(storage.WORKSPACE_STORAGE_KEY));check('History-only job can be hard deleted while retained snapshot references missing job',after.jobs.length===0&&!!after.historicalSnapshots[key],{deps,jobCount:after.jobs.length,orphanSnapshot:!!after.historicalSnapshots[key],persistedBytesChanged:priorRaw!==localStorage.getItem(storage.WORKSPACE_STORAGE_KEY)});
// P1: non-calendar-valid job one-off accepted by canonical validator and saved.
let impossible=payload({jobs:[Object.assign(job(),{targetDate:'2026-02-30',status:'active'})],historicalSnapshots:{}});let impossibleValidation=validator.validateCurrentV2ForBoundary(impossible);let impossibleSave=storage.saveWorkspace(impossible);check('Impossible one-off date accepted',impossibleValidation.valid&&impossibleSave.ok,{targetDate:'2026-02-30',validated:impossibleValidation.valid,saved:impossibleSave.ok});
// P2: noninteger interval accepted by validator despite scheduler recurrence inconsistent with date predicate.
let fractionalJob={id:'JOB-INTERVAL',name:'Synthetic Fractional Interval',frequencyType:'recurring_weeks',intervalWeeks:1.5,anchorDate:'2026-06-06',preferredDay:'saturday',startTime:'08:00',durationHours:4,crewSize:1,status:'active'};
let fracValid=validator.validateCurrentV2ForBoundary(payload({jobs:[fractionalJob],historicalSnapshots:{}}));check('Fractional recurrence interval accepted',fracValid.valid,{intervalWeeks:1.5,validated:fracValid.valid});
// P2: valid restore missing optional budget / UI fields preserves stale live budget/selected year.
reset(payload({historicalSnapshots:{},jobs:[],roster:[]}));app.state.budgetSettings={annualBudgetCap:7654321};app.state.currentYear=2030;let restoreInput=payload({historicalSnapshots:{},jobs:[],roster:[]});delete restoreInput.budgetSettings;delete restoreInput.uiState;let verified=validator.validateCurrentV2ForBoundary(restoreInput);let restored=app.restoreWorkspaceJson(restoreInput);let stored=JSON.parse(localStorage.getItem(storage.WORKSPACE_STORAGE_KEY));check('Optional omitted restore fields leave live/persisted budget or UI divergent',verified.valid&&restored&&app.state.budgetSettings.annualBudgetCap===7654321&&!Object.prototype.hasOwnProperty.call(stored,'budgetSettings'),{validated:verified.valid,restored,liveCap:app.state.budgetSettings.annualBudgetCap,liveYear:app.state.currentYear,storedHasBudget:Object.prototype.hasOwnProperty.call(stored,'budgetSettings'),storedHasUiState:Object.prototype.hasOwnProperty.call(stored,'uiState')});
// Accepted baseline: legitimate complete historic snapshot retained on normal save.
reset();let baselineNormal=app.saveCurrentWorkspace();let baselineAfter=JSON.parse(localStorage.getItem(storage.WORKSPACE_STORAGE_KEY));console.log(`CONTROL normal-save snapshot retained: ${baselineNormal&&!!baselineAfter.historicalSnapshots[key]}`);
// Deferred B3: original updatePermit mutates live before failed commit.
reset();const priorPermit=JSON.stringify(app.state.customPermits),beforeBytes=localStorage.getItem(storage.WORKSPACE_STORAGE_KEY);localStorage.failWrites=true;app.updatePermit(key,{wztmStatus:'approved'});localStorage.failWrites=false;check('Known B3 permit rollback gap',JSON.stringify(app.state.customPermits)!==priorPermit&&localStorage.getItem(storage.WORKSPACE_STORAGE_KEY)===beforeBytes,{liveChanged:JSON.stringify(app.state.customPermits)!==priorPermit,storedUnchanged:localStorage.getItem(storage.WORKSPACE_STORAGE_KEY)===beforeBytes});
console.log('Independent source-boundary probes complete. Findings reproduced:',failures);
