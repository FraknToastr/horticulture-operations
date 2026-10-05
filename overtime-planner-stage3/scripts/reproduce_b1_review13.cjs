/* Independent Gate B1 Review 13. Copy into <project>/scripts/. No external packages.
 * EXPECTED against PR12 submission: three findings fail (builder, schema, trust semantics).
 * EXPECTED after corrective closure: 0 failures.
 * This is a focused reproduction, not a replacement for the existing regression suite.
 */
'use strict';
const assert = require('assert');
const path = require('path');
const root = path.resolve(__dirname, '..');
class Store {
  constructor() { this.items = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.items,k) ? this.items[k] : null; }
  setItem(k,v) { this.items[k] = String(v); }
  removeItem(k) { delete this.items[k]; }
}
global.window={localStorage:new Store()}; global.localStorage=global.window.localStorage; global.alert=function(){};
[
  'js/data/holidays.js','js/data/initialJobs.js','js/data/staffRoster.js','js/data/historicalOccurrences.js',
  'js/utils/icons.js','js/utils/securityUtils.js','js/utils/dateUtils.js',
  'js/utils/storage/schemaValidator.js','js/utils/storage/migrationEngine.js',
  'js/utils/storage/storageDriver.js','js/utils/storage.js',
  'js/utils/eligibilityEngine.js','js/utils/rostering/engine.js',
  'js/utils/scheduler/costCalculator.js','js/utils/scheduler/engine.js',
  'js/utils/scheduler.js','js/app.js','js/components/exportModal.js'
].forEach(function(p){ require(path.join(root,p)); });
const s=window.HortOpsStorage, v=window.HortOpsSchemaValidator, app=window.HortOpsApp;
const shift='job-one@2026-09-26';
function workspace(){return {
  schemaVersion:2,lastSaved:'2026-09-25T11:00:00.000Z',
  jobs:[{id:'job-one',name:'Test job',category:'Parks',frequencyType:'one_off',targetDate:'2026-09-26',preferredDay:'saturday',startTime:'08:00 PM',durationHours:8,crewSize:1,status:'active'}],
  roster:[],assignments:{},rostering:{instructions:{},provenance:{}},historicalSnapshots:{},
  permits:{},budgetSettings:{annualBudgetCap:10000,contingencyPercent:10},
  uiState:{activeView:'forward_planner',currentYear:2026}
};}
function snap(){return {shiftId:shift,jobId:'job-one',date:'2026-09-26',startTime:'08:00 PM',durationHours:8,crewSize:1,assignedStaffIds:['person-one'],recordType:'scheduled_commitment'};}
const results=[];
function check(name, fn){try {fn();results.push({name:name,ok:true});console.log('PASS',name);} catch(e){results.push({name:name,ok:false,error:e.message});console.log('FAIL',name,'—',e.message);}}
assert.strictEqual(s.saveWorkspace(workspace()).ok,true,'valid fixture did not save; stop rather than claim success');
const before=window.localStorage.getItem(s.WORKSPACE_STORAGE_KEY);
check('B1-01 public constructor must reject jobs:null instead of synthesizing []',function(){
  const bad=workspace();bad.jobs=null;
  assert.throws(function(){s.createWorkspaceEnvelope(bad);}, /invalid|jobs|schema/i);
  assert.strictEqual(window.localStorage.getItem(s.WORKSPACE_STORAGE_KEY),before);
});
check('B1-01 actual application save must not erase existing jobs on jobs:null',function(){
  app.init();const prior=window.localStorage.getItem(s.WORKSPACE_STORAGE_KEY);app.state.jobs=null;
  assert.strictEqual(app.saveCurrentWorkspace(),false,'invalid app state was saved');
  assert.strictEqual(window.localStorage.getItem(s.WORKSPACE_STORAGE_KEY),prior,'existing jobs were erased');
});
window.localStorage.setItem(s.WORKSPACE_STORAGE_KEY,before);
check('B1-02 explicit assignedStaffIds:null is invalid, not optional',function(){
  const w=workspace();w.historicalSnapshots[shift]=Object.assign(snap(),{assignedStaffIds:null});
  assert.strictEqual(v.validateCurrentV2ForBoundary(w).valid,false);
  const prior=window.localStorage.getItem(s.WORKSPACE_STORAGE_KEY);
  assert.strictEqual(s.saveWorkspace(w).ok,false);
  assert.strictEqual(window.localStorage.getItem(s.WORKSPACE_STORAGE_KEY),prior);
});
check('B1-02 explicit crewSize:null is invalid on authoritative record',function(){
  const w=workspace();w.historicalSnapshots[shift]=Object.assign(snap(),{crewSize:null});
  assert.strictEqual(v.validateCurrentV2ForBoundary(w).valid,false);
});
check('B1-02 unknown recordType must not authenticate a scheduled commitment',function(){
  const w=workspace();w.historicalSnapshots[shift]=Object.assign(snap(),{recordType:'banana'});
  assert.strictEqual(v.validateCurrentV2ForBoundary(w).valid,false);
});
check('B1-03 unverifiedSchedule:true must never be accepted and then treated as verified',function(){
  const w=workspace();w.historicalSnapshots[shift]=Object.assign(snap(),{unverifiedSchedule:true});
  const validation=v.validateCurrentV2ForBoundary(w);
  if(!validation.valid)return; // explicit rejection is safe until B2 defines durable unverified records
  const consumed=window.HortOpsSchedulerEngine.resolveShiftHistoricalTiming(shift,'job-one','2026-09-26',validation.data.historicalSnapshots);
  assert.strictEqual(consumed.found,false,'scheduler silently verified a persisted explicitly-unverified record');
});
const failed=results.filter(function(r){return !r.ok;});
console.log('REVIEW13: '+(results.length-failed.length)+'/'+results.length+' passed; '+failed.length+' demonstrated gaps.');
if(failed.length)process.exitCode=1;
