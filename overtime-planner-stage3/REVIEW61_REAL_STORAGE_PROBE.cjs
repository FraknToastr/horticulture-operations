'use strict';
// Independent Review61: check actual storage facade rather than mock saveWorkspace
const assert=require('node:assert/strict'), path=require('node:path');
const root=process.env.HORTOPS_ROOT;if(!root){console.error('HORTOPS_ROOT required');process.exit(2)}
global.window=global;
const records=new Map(); let writes=0;
global.localStorage={ getItem:k=>records.has(k)?records.get(k):null, setItem:(k,v)=>{records.set(k,String(v));writes++}, removeItem:k=>records.delete(k),clear:()=>records.clear(),key:i=>[...records.keys()][i]||null,get length(){return records.size} };
require(path.join(root,'js/utils/storage/schemaValidator.js'));
require(path.join(root,'js/utils/storage/migrationEngine.js'));
require(path.join(root,'js/utils/storage/storageDriver.js'));
require(path.join(root,'js/utils/storage.js'));
require(path.join(root,'js/app.js'));
const app=global.HortOpsApp, storage=global.HortOpsStorage;
const initWS={schemaVersion:2,jobs:[],roster:[],assignments:{},rostering:{instructions:{},provenance:{}},historicalSnapshots:{},permits:{},budgetSettings:{},uiState:{},absences:[{id:'A1',staffId:'S',type:'rdo',startDate:'2026-10-10',endDate:'2026-10-10',notes:'ORIGINAL'}],refusalHistory:[{id:'R1',staffId:'S',date:'2026-10-01',reason:'ORIGINAL'}]};
let passed=0,failed=0;
function run(id,desc,cb){try{cb();passed++;console.log('PASS',id,desc)}catch(e){failed++;console.log('FAIL',id,desc,':',e.message)}}
function setup(){records.clear();writes=0;const baseline=structuredClone(initWS);records.set(storage.WORKSPACE_STORAGE_KEY,JSON.stringify(baseline));global.HortOpsScheduler={DEFAULT_BUDGET_SETTINGS:{}};app.recomputeDigest=()=>{};app.renderCurrentView=()=>{};app.state={schemaVersion:2};app.init();return {absences:structuredClone(initWS.absences),refusalHistory:structuredClone(initWS.refusalHistory)};}
function persisted(){return JSON.parse(records.get(storage.WORKSPACE_STORAGE_KEY))}
run('R61-STORAGE-A','No resurrection after concurrent absence deletion at actual localStorage facade',()=>{
 const base=setup(),v=persisted();v.absences=[]; records.set(storage.WORKSPACE_STORAGE_KEY,JSON.stringify(v));
 const out=app.saveAbsenceAndRefusalData(base.absences,base.refusalHistory,{baseAbsences:base.absences,baseRefusals:base.refusalHistory});
 assert.equal(out.success,false,'save returned success on stale modal');assert.equal(writes,0);assert.deepEqual(persisted().absences,[]);
});
run('R61-STORAGE-R','No resurrection after concurrent refusal deletion at actual localStorage facade',()=>{
 const base=setup(),v=persisted();v.refusalHistory=[];records.set(storage.WORKSPACE_STORAGE_KEY,JSON.stringify(v));
 const out=app.saveAbsenceAndRefusalData(base.absences,base.refusalHistory,{baseAbsences:base.absences,baseRefusals:base.refusalHistory});
 assert.equal(out.success,false,'save returned success on stale modal');assert.equal(writes,0);assert.deepEqual(persisted().refusalHistory,[]);
});
run('R61-STORAGE-NULL','Real saveWorkspace rejects explicit null ledger without writes',()=>{
 setup();const v=persisted();v.absences=null;const out=storage.saveWorkspace(v);assert.equal(out.ok,false);assert.equal(writes,0);
});
run('R61-STORAGE-BASE','Real saveWorkspace accepts well-formed unmodified canonical workspace',()=>{
 setup();const out=storage.saveWorkspace(persisted());assert.equal(out.ok,true);assert.equal(writes,1);
});
console.log(`REVIEW61 REAL STORAGE: ${passed} PASS, ${failed} FAIL, ${passed+failed} TOTAL`);process.exitCode=failed?1:0;
