'use strict';
// Independent PR26_05 negative tests: ledger modal saves must not overwrite other authoritative domains
const assert=require('node:assert/strict');
const path=require('node:path');
const root=process.env.HORTOPS_ROOT;
if (!root) { console.error('HORTOPS_ROOT is required'); process.exit(2); }
global.window=global;
const disk=new Map();let writes=0;
global.localStorage={getItem:k=>disk.has(k)?disk.get(k):null,setItem:(k,v)=>{disk.set(k,String(v));writes++;},removeItem:k=>disk.delete(k),clear:()=>disk.clear(),key:i=>[...disk.keys()][i]||null,get length(){return disk.size}};
require(path.join(root,'js/utils/storage/schemaValidator.js'));
require(path.join(root,'js/utils/storage/migrationEngine.js'));
require(path.join(root,'js/utils/storage/storageDriver.js'));
require(path.join(root,'js/utils/storage.js'));
require(path.join(root,'js/app.js'));
const app=global.HortOpsApp,storage=global.HortOpsStorage;
const baseFixture=()=>({schemaVersion:2,jobs:[],roster:[{id:'S1',name:'Alex',status:'active',team:'Parks',qualifications:[{code:'WHITE_CARD',status:'active',issuedDate:'2025-01-01'}]}],assignments:{},rostering:{instructions:{},provenance:{}},historicalSnapshots:{},permits:{},budgetSettings:{annualTarget:1200,defaultStandardHoursPerShift:8},uiState:{currentYear:2026},absences:[{id:'A1',staffId:'S1',type:'rdo',startDate:'2026-10-10',endDate:'2026-10-10',notes:'original'}],refusalHistory:[{id:'R1',staffId:'S1',date:'2026-10-01',reason:'original'}]});
const deep = x=>JSON.parse(JSON.stringify(x));
function current(){return JSON.parse(disk.get(storage.WORKSPACE_STORAGE_KEY));}
function baseline(){
 disk.clear();writes=0;
 const fx=baseFixture();
 assert.equal(global.HortOpsSchemaValidator.validateCurrentV2ForBoundary(fx).valid,true,'fixture schema invalid');
 disk.set(storage.WORKSPACE_STORAGE_KEY,JSON.stringify(fx));
 global.HortOpsScheduler={DEFAULT_BUDGET_SETTINGS:{}};
 app.recomputeDigest=()=>{};app.renderCurrentView=()=>{};
 app.state={schemaVersion:2};app._autosaveBlocked=false;
 app.init();
 return {a:deep(app.state.absences),r:deep(app.state.refusalHistory)};
}
function save(base){
 const changeA=deep(base.a);changeA[0].notes='new absence note';
 return app.saveAbsenceAndRefusalData(changeA,base.r,{baseAbsences:base.a,baseRefusals:base.r});
}
let passes=0, failures=0;
function test(id, desc, f){try{f();passes++;console.log('PASS',id,desc);}catch(e){failures++;console.log('FAIL',id,desc,'|',e.message);}}
test('R62-C1','Uncontested modal absence edit still saves to actual storage',()=>{
 const b=baseline();const r=save(b);assert.equal(r.success,true);assert.equal(current().absences[0].notes,'new absence note');assert.equal(writes,1);
});
test('R62-XD-01','Concurrent staff departure may not be silently reverted by absence modal',()=>{
 const b=baseline();const concurrent=current();concurrent.roster[0].status='departed';disk.set(storage.WORKSPACE_STORAGE_KEY,JSON.stringify(concurrent));
 const r=save(b);assert.equal(current().roster[0].status,'departed',`concurrent departure overwritten; modal result ${JSON.stringify(r)}`);
});
test('R62-XD-02','Concurrent staff qualification suspension may not be silently reverted',()=>{
 const b=baseline();const concurrent=current();concurrent.roster[0].qualifications[0].status='suspended';disk.set(storage.WORKSPACE_STORAGE_KEY,JSON.stringify(concurrent));
 const r=save(b);assert.equal(current().roster[0].qualifications[0].status,'suspended',`concurrent suspension overwritten; modal result ${JSON.stringify(r)}`);
});
test('R62-XD-03','Concurrent roster additions may not be silently lost by absence modal',()=>{
 const b=baseline();const concurrent=current();concurrent.roster.push({id:'S2',name:'Jade',status:'active'});disk.set(storage.WORKSPACE_STORAGE_KEY,JSON.stringify(concurrent));
 const r=save(b);assert.equal(current().roster.some(x=>x.id==='S2'),true,`concurrent new staff lost; modal result ${JSON.stringify(r)}`);
});
test('R62-XD-04','Concurrent budget update may not be silently reverted by absence modal',()=>{
 const b=baseline();const concurrent=current();concurrent.budgetSettings.annualTarget=9500;disk.set(storage.WORKSPACE_STORAGE_KEY,JSON.stringify(concurrent));
 const r=save(b);assert.equal(current().budgetSettings.annualTarget,9500,`concurrent budget lost; modal result ${JSON.stringify(r)}`);
});
console.log(`REVIEW62 CROSS-DOMAIN RESULTS: ${passes} PASS, ${failures} FAIL; ${passes+failures} TOTAL`);
process.exitCode=failures?1:0;
