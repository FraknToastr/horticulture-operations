'use strict';
// Review 61 independent negative tests: transaction boundaries for records removed/added by a different session.
// No application source modifications. Usage: HORTOPS_ROOT=/path/to/PR26_04 node REVIEW61_INDEPENDENT_CONCURRENCY_PROBES.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.env.HORTOPS_ROOT;
if (!root) { console.error('HORTOPS_ROOT must be supplied'); process.exit(2); }
global.window = global;
require(path.join(root,'js/utils/storage/schemaValidator.js'));
require(path.join(root,'js/utils/storage/migrationEngine.js'));
require(path.join(root,'js/app.js'));
const app = global.HortOpsApp;
const validator = global.HortOpsSchemaValidator;
const migration = global.HortOpsMigrationEngine;
const A = {id:'A1',staffId:'S',type:'rdo',startDate:'2026-10-10',endDate:'2026-10-10',notes:'ORIGINAL'};
const R = {id:'R1',staffId:'S',date:'2026-10-01',reason:'ORIGINAL'};
const fixture = ()=>({schemaVersion:2,jobs:[],roster:[],assignments:{},rostering:{instructions:{},provenance:{}},historicalSnapshots:{},permits:{},budgetSettings:{},uiState:{},absences:[structuredClone(A)],refusalHistory:[structuredClone(R)]});
let committed,writes,passes=0,failures=0;
function setup() {
 committed=fixture(); writes=0;
 global.HortOpsScheduler={DEFAULT_BUDGET_SETTINGS:{}};
 global.HortOpsStorage={
  loadWorkspace:()=>structuredClone(committed),
  readVerifiedCommittedV2:()=>({ok:true,exists:true,data:structuredClone(committed)}),
  createWorkspaceEnvelope:(v)=>migration.createWorkspaceEnvelope(v),
  saveWorkspace:(value)=>{ const verdict=validator.validateCurrentV2ForBoundary(value); if (!verdict.valid) return {ok:false,error:verdict.error}; committed=structuredClone(value);writes++;return {ok:true,storageMode:'persistent'};}
 };
 app.recomputeDigest=()=>{};app.renderCurrentView=()=>{};
 app.state={schemaVersion:2};app.init();
}
function test(id,statement,fn) { try{fn();passes++;console.log('PASS',id,statement);}catch(e){failures++;console.log('FAIL',id,statement,'|',e.message);} }
function snapshot(){return {a:structuredClone(committed.absences),r:structuredClone(committed.refusalHistory)};}
// When modal was opened with A1 then second session removed A1,
// saving unchanged older modal MUST NOT restore the other user's intentional deletion.
test('R61-01','Absent committed absence must not be resurrected by stale modal',()=>{
 setup();const base=snapshot(); committed.absences=[];
 const out=app.saveAbsenceAndRefusalData(base.a,base.r,{baseAbsences:base.a,baseRefusals:base.r});
 assert.equal(out.success,false,'stale modal resurrected externally deleted absence');
 assert.equal(writes,0,'unexpected storage write');assert.deepEqual(committed.absences,[]);
});
test('R61-02','Absent committed refusal must not be resurrected by stale modal',()=>{
 setup();const base=snapshot();committed.refusalHistory=[];
 const out=app.saveAbsenceAndRefusalData(base.a,base.r,{baseAbsences:base.a,baseRefusals:base.r});
 assert.equal(out.success,false,'stale modal resurrected externally deleted refusal');
 assert.equal(writes,0);assert.deepEqual(committed.refusalHistory,[]);
});
// A new colliding identity originating elsewhere should not be overwritten by a proposed new record
// absent from caller's baseline; this may occur with imported ledger IDs, even if generated IDs rarely collide.
test('R61-03','Concurrent new absence with same ID must not be overwritten without baseline',()=>{
 setup();const base=snapshot();const theirs={...A,id:'A2',notes:'SECOND SESSION'};
 committed.absences.push(structuredClone(theirs));
 const ours={...A,id:'A2',notes:'OLDER SESSION'};
 const out=app.saveAbsenceAndRefusalData([...base.a,ours],base.r,{baseAbsences:base.a,baseRefusals:base.r});
 assert.equal(out.success,false,'unseen colliding absence ID overwritten');assert.equal(writes,0);assert.deepEqual(committed.absences[1],theirs);
});
test('R61-04','Concurrent new refusal with same ID must not be overwritten without baseline',()=>{
 setup();const base=snapshot();const theirs={...R,id:'R2',reason:'SECOND SESSION'};
 committed.refusalHistory.push(structuredClone(theirs));
 const ours={...R,id:'R2',reason:'OLDER SESSION'};
 const out=app.saveAbsenceAndRefusalData(base.a,[...base.r,ours],{baseAbsences:base.a,baseRefusals:base.r});
 assert.equal(out.success,false,'unseen colliding refusal ID overwritten');assert.equal(writes,0);assert.deepEqual(committed.refusalHistory[1],theirs);
});
// Safe controls: unmodified record and normal addition from fresh baseline remain savable.
test('R61-C1','No concurrent change permits unmodified ledger save',()=>{
 setup();const base=snapshot();const out=app.saveAbsenceAndRefusalData(base.a,base.r,{baseAbsences:base.a,baseRefusals:base.r});assert.equal(out.success,true);assert.equal(writes,1);
});
test('R61-C2','Fresh non-colliding absence addition remains valid',()=>{
 setup();const base=snapshot();const newA={...A,id:'A2',notes:'NEW'};
 const out=app.saveAbsenceAndRefusalData([...base.a,newA],base.r,{baseAbsences:base.a,baseRefusals:base.r});assert.equal(out.success,true);assert.equal(writes,1);assert.equal(committed.absences.length,2);
});
console.log(`REVIEW61 RESULTS: ${passes} PASS, ${failures} FAIL; ${passes+failures} TOTAL`);
process.exitCode=failures?1:0;
