'use strict';
// Independent Review 60 exploratory tests. Run with HORTOPS_ROOT=/path/to/extracted/repo node this_file
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.env.HORTOPS_ROOT;
if (!root) { console.error('HORTOPS_ROOT required'); process.exit(2); }
global.window = global;
require(path.join(root, 'js/utils/storage/schemaValidator.js'));
require(path.join(root, 'js/utils/storage/migrationEngine.js'));
require(path.join(root, 'js/app.js'));
const validator = global.HortOpsSchemaValidator;
const migration = global.HortOpsMigrationEngine;
const app = global.HortOpsApp;
const A = { id:'A1', staffId:'S', type:'rdo', startDate:'2026-10-10', endDate:'2026-10-11', notes:'EARLIER' };
const R = { id:'R1', staffId:'S', date:'2026-10-01', reason:'EARLIER' };
const fixture = () => ({schemaVersion:2, jobs:[], roster:[], assignments:{}, rostering:{instructions:{}, provenance:{}}, historicalSnapshots:{}, permits:{},budgetSettings:{},uiState:{},absences:[structuredClone(A)],refusalHistory:[structuredClone(R)]});
let committed, writes;
function setup() {
  committed = fixture(); writes = 0;
  global.HortOpsScheduler = { DEFAULT_BUDGET_SETTINGS:{} };
  global.HortOpsStorage = {
    loadWorkspace:()=>structuredClone(committed),
    readVerifiedCommittedV2:()=>({ok:true,exists:true,data:structuredClone(committed)}),
    createWorkspaceEnvelope: (value)=>migration.createWorkspaceEnvelope(value),
    saveWorkspace:(value)=>{
      const verdict=validator.validateCurrentV2ForBoundary(value);
      if (!verdict.valid) return {ok:false,error:verdict.error};
      committed=structuredClone(value);writes++;return {ok:true,storageMode:'persistent'};
    }
  };
  app.recomputeDigest=()=>{}; app.renderCurrentView=()=>{};
  app.state={schemaVersion:2}; app.init();
}
let pass=0, fail=0;
function test(id, description, callback) {
  try { callback(); console.log('PASS',id,description); ++pass; }
  catch(e) {console.log('FAIL',id,description,'|',e.message); ++fail; }
}
// Expected safe behavior: stale deletion of a record edited by another session rejects before write.
test('R60-01','Explicit deletion of concurrently modified absence is rejected',()=>{
 setup(); const baseline=structuredClone(committed.absences), baseRef=structuredClone(committed.refusalHistory);
 committed.absences[0].notes='CONCURRENT NEW CHANGE';
 const out=app.saveAbsenceAndRefusalData([], baseRef,{baseAbsences:baseline,baseRefusals:baseRef,deletedAbsenceIds:['A1'],deletedRefusalIds:[]});
 assert.equal(out.success,false,'stale removal was permitted');
 assert.equal(committed.absences[0].notes,'CONCURRENT NEW CHANGE'); assert.equal(writes,0);
});
test('R60-02','Explicit deletion of concurrently modified refusal is rejected',()=>{
 setup(); const baseline=structuredClone(committed.absences), baseRef=structuredClone(committed.refusalHistory);
 committed.refusalHistory[0].reason='CONCURRENT NEW CHANGE';
 const out=app.saveAbsenceAndRefusalData(baseline, [],{baseAbsences:baseline,baseRefusals:baseRef,deletedAbsenceIds:[],deletedRefusalIds:['R1']});
 assert.equal(out.success,false,'stale refusal removal was permitted');
 assert.equal(committed.refusalHistory[0].reason,'CONCURRENT NEW CHANGE'); assert.equal(writes,0);
});
test('R60-03','Null absences rejected at canonical schema boundary',()=>{
 const w=fixture(); w.absences=null; const v=validator.validateCurrentV2ForBoundary(w);
 assert.equal(v.valid,false,'canonical boundary accepted null absences');
});
test('R60-04','Null refusalHistory rejected at canonical schema boundary',()=>{
 const w=fixture(); w.refusalHistory=null; const v=validator.validateCurrentV2ForBoundary(w);
 assert.equal(v.valid,false,'canonical boundary accepted null refusals');
});
test('R60-05','Null absences cannot replace protected committed ledger',()=>{
 setup(); const out=app.saveAbsenceAndRefusalData(null,undefined);
 assert.equal(out.success,false,'application accepted null ledger');
 assert.ok(Array.isArray(committed.absences) && committed.absences.length===1);assert.equal(writes,0);
});
test('R60-06','Null refusalHistory cannot replace protected committed ledger',()=>{
 setup(); const out=app.saveAbsenceAndRefusalData(undefined,null);
 assert.equal(out.success,false,'application accepted null refusal ledger');
 assert.ok(Array.isArray(committed.refusalHistory) && committed.refusalHistory.length===1);assert.equal(writes,0);
});
test('R60-07','Duplicate absence IDs rejected at canonical boundary',()=>{
 const w=fixture(); w.absences.push({...w.absences[0],notes:'DUPLICATE'});
 const v=validator.validateCurrentV2ForBoundary(w);assert.equal(v.valid,false,'canonical accepted duplicate absence IDs');
});
test('R60-CONTROL','Explicit deletion of unchanged absence remains operational',()=>{
 setup();const baseAbs=structuredClone(committed.absences),baseRef=structuredClone(committed.refusalHistory);
 const out=app.saveAbsenceAndRefusalData([],baseRef,{baseAbsences:baseAbs,baseRefusals:baseRef,deletedAbsenceIds:['A1'],deletedRefusalIds:[]});
 assert.equal(out.success,true);assert.equal(committed.absences.length,0);assert.equal(writes,1);
});
console.log(`REVIEW60 RESULTS: ${pass} PASS, ${fail} FAIL; ${pass+fail} TOTAL`);
process.exitCode = fail ? 1 : 0;
