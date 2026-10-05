'use strict';
// Review 64: synthetic interleaving of two independently running tabs (A verified read, B writes, A writes).
const assert=require('node:assert/strict');const path=require('node:path'),root=process.env.HORTOPS_ROOT || __dirname;
global.window=global;
const disk=new Map();let writes=0;
global.localStorage={getItem:k=>disk.has(k)?disk.get(k):null,setItem:(k,v)=>{disk.set(k,String(v));writes++},removeItem:k=>disk.delete(k),clear:()=>disk.clear()};
for(const f of ['js/utils/storage/schemaValidator.js','js/utils/storage/migrationEngine.js','js/utils/storage/storageDriver.js','js/utils/storage.js','js/app.js'])require(path.join(root,f));
const app=global.HortOpsApp,store=global.HortOpsStorage,key=store.WORKSPACE_STORAGE_KEY;
const base=()=>({schemaVersion:2,jobs:[],roster:[{id:'S1',name:'Alex',status:'active',qualifications:[{code:'WHITE_CARD',status:'active',issuedDate:'2025-01-01'}]}],assignments:{},rostering:{instructions:{},provenance:{}},historicalSnapshots:{},permits:{},budgetSettings:{annualTarget:1200},uiState:{currentYear:2026},absences:[{id:'A1',staffId:'S1',type:'rdo',startDate:'2026-10-10',endDate:'2026-10-10',notes:'original'}],refusalHistory:[]});
function init(){disk.clear();const fx=base();assert.equal(global.HortOpsSchemaValidator.validateCurrentV2ForBoundary(fx).valid,true);disk.set(key,JSON.stringify(fx));global.HortOpsScheduler={DEFAULT_BUDGET_SETTINGS:{}};app.recomputeDigest=()=>{};app.renderCurrentView=()=>{};app.state={schemaVersion:2};app._autosaveBlocked=false;app._domainBaselines=undefined;app.init();return fx;}
function persisted(){return JSON.parse(disk.get(key));}
function save(editBase){const a=structuredClone(editBase.absences);a[0].notes='first tab edited leave';return app.saveAbsenceAndRefusalData(a,undefined,{baseAbsences:editBase.absences});}
const origRead=store.readVerifiedCommittedV2;
function run(label,remoteMutator){const fx=init();let injected=0;store.readVerifiedCommittedV2=function(){const r=origRead.call(this);if(injected===0){injected++;const ext=persisted();remoteMutator(ext);disk.set(key,JSON.stringify(ext));}return r;};let result;try{result=save(fx)}finally{store.readVerifiedCommittedV2=origRead};const ws=persisted();console.log(label,'A_success=',result.success,'injected_B_write=',injected,'final_staff_qual=',ws.roster[0].qualifications[0].status,'final_leave=',ws.absences[0].notes,'final_budget=',ws.budgetSettings.annualTarget);return ws;}
const a=run('R64_RACE_SAFETY',x=>{x.roster[0].qualifications[0].status='suspended';});
const b=run('R64_RACE_SAME_RECORD',x=>{x.absences[0].notes='second tab changed same record';});
const c=run('R64_RACE_BUDGET',x=>{x.budgetSettings.annualTarget=15000;});
let departed=0;
if(a.roster[0].qualifications[0].status!=='suspended'){departed++;console.log('FAIL R64-RACE-01 qualifying suspension overwritten');}
if(b.absences[0].notes!=='second tab changed same record'){departed++;console.log('FAIL R64-RACE-02 simultaneous edit overwritten');}
if(c.budgetSettings.annualTarget!==15000){departed++;console.log('FAIL R64-RACE-03 budget overwritten');}
console.log('R64 WRITE WINDOW:',departed,'reproduced lost-write scenarios');
process.exitCode=departed===3?0:1;
