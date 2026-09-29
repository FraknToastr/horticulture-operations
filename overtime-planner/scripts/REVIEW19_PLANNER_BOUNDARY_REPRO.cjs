/** Independent Review 19: pure scheduled-commitment planner negative input contracts.
 * Copy to the application's scripts/ directory and run:
 *   node scripts/REVIEW19_PLANNER_BOUNDARY_REPRO.cjs
 * No application source is modified. Node's global window is set ONLY to load the
 * production Schema v2 validator; DateUtils is intentionally absent to exercise
 * the publicly exported planner's missing-clock failure contract.
 */
'use strict';
const assert = require('assert');
const path = require('path');
global.window = {};
require(path.join(__dirname, '../js/utils/storage/schemaValidator.js'));
const planner = require(path.join(__dirname, '../js/utils/rostering/commitmentPlanner.js'));
const source = 'JOB-R19@2027-12-25';
const target = 'JOB-R19@2028-01-01';
const historical = 'JOB-R19@2020-01-04';
const emp = 'EMP-R19';
const pKey = target + ':' + emp;
function snapshot(shiftId) {
  return {shiftId,jobId:'JOB-R19',date:shiftId.split('@')[1],startTime:'07:00',durationHours:8,assignedStaffIds:[emp],recordType:'scheduled_commitment'};
}
function sourceRemoval(overrides) {
  let args = {beforeAssignments:{[historical]:[emp]},afterAssignments:{[historical]:[]},beforeSnapshots:{[historical]:snapshot(historical)},operation:{type:'future_unassignment',sourceShiftId:historical,targetShiftId:historical}};
  return Object.assign(args,overrides || {});
}
function descendant(overrides) {
  let args = {
    beforeAssignments:{[target]:[emp]}, afterAssignments:{[target]:[]},beforeSnapshots:{[target]:snapshot(target)},
    authoritativeOccurrences:{[target]:{shiftId:target,jobId:'JOB-R19',date:'2028-01-01',startTime:'07:00',durationHours:8}},
    beforeRostering:{instructions:{'INST-R19':{id:'INST-R19',sourceShiftId:source}},
                     provenance:{[pKey]:{source:'rostering-rule',sourceShiftId:source,instructionId:'INST-R19'}}},
    afterRostering:{instructions:{},provenance:{}},prunedProvenance:[pKey],
    todayKey:'2026-01-01',operation:{type:'allocation_reconciliation',sourceShiftId:source,targetShiftId:source}
  };
  return Object.assign(args, overrides || {});
}
let pass=0,fail=0;
function check(label, fn) {try {fn();pass++;console.log('PASS '+label);}catch(e){fail++;console.log('FAIL '+label+': '+e.message);}}
check('B19-01 missing injected local todayKey must fail closed, not remove past snapshot', () => {
  const inp=sourceRemoval();
  const r=planner.plan(inp);
  assert.strictEqual(r.ok,false,JSON.stringify({ok:r.ok,removed:r.permittedSnapshotRemovals}));
  assert(inp.beforeSnapshots[historical]);
});
check('B19-02 malformed todayKey must fail closed even for otherwise permitted future removal', () => {
  const r=planner.plan(descendant({todayKey:'2026-99-99'}));
  assert.strictEqual(r.ok,false,JSON.stringify({ok:r.ok,removed:r.permittedSnapshotRemovals}));
});
check('B19-03 descendant removal requires afterRostering provenance proof', () => {
  const r=planner.plan(descendant({afterRostering:undefined}));
  assert.strictEqual(r.ok,false,JSON.stringify({ok:r.ok,removed:r.permittedSnapshotRemovals}));
});
check('B19-04 descendant removal requires actual engine-pruned provenance proof', () => {
  const r=planner.plan(descendant({prunedProvenance:undefined}));
  assert.strictEqual(r.ok,false,JSON.stringify({ok:r.ok,removed:r.permittedSnapshotRemovals}));
});
check('B19-05 genuine future descendant removal with complete ownership proof remains allowed', () => {
  const r=planner.plan(descendant());
  assert.strictEqual(r.ok,true,r.error);
  assert.deepStrictEqual(r.permittedSnapshotRemovals,[target]);
  assert.strictEqual(Object.hasOwn(r.snapshots,target),false);
});
check('B19-06 unrelated manual/another source provenance cannot authorize deletion', () => {
  const before=descendant().beforeRostering;
  before.provenance[pKey].sourceShiftId='OTHER-JOB@2027-12-25';
  const r=planner.plan(descendant({beforeRostering:before}));
  assert.strictEqual(r.ok,false);
});
check('B19-07 valid explicit current/future source unassignment remains allowed', () => {
  const future='JOB-R19@2028-06-06';
  const snap=snapshot(future);
  const r=planner.plan({beforeAssignments:{[future]:[emp]},afterAssignments:{[future]:[]},beforeSnapshots:{[future]:snap},todayKey:'2026-01-01',operation:{type:'future_unassignment',sourceShiftId:future,targetShiftId:future}});
  assert.strictEqual(r.ok,true,r.error);
  assert.deepStrictEqual(r.permittedSnapshotRemovals,[future]);
});
check('B19-08 pure planner does not mutate caller-owned operation metadata', () => {
  const args=descendant();const prior=JSON.stringify(args.operation);
  const r=planner.plan(args);
  assert.strictEqual(r.ok,true,r.error);
  assert.strictEqual(JSON.stringify(args.operation),prior,'input.operation acquired hidden todayKey');
});
console.log('REVIEW19 CONTRACT GAPS '+fail+'/8 ('+pass+' passed)');
if(fail)process.exitCode=1;
