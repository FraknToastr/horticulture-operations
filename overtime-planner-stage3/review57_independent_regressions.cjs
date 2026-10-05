/**
 * Independent Review 57 corrective probes (not production code).
 * RUN: from the Overtime Planner repository root:
 *   node /path/to/review57_independent_regressions.cjs
 * Optionally: HORTOPS_ROOT=/path/to/repository node review57_independent_regressions.cjs
 * Exits 1 when any required safety / durability assertion fails.
 * Does not mutate application files or browser storage.
 */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.env.HORTOPS_ROOT || process.cwd();
global.window = global;
require(path.join(root, 'js/utils/eligibilityEngine.js'));
require(path.join(root, 'js/utils/absences.js'));
const engine=global.HortOpsEligibilityEngine;
const absenceEngine=global.HortOpsAbsences;
const employee={id:'person1',name:'Probe Officer',status:'active',team:'Parks'};
const occurrence={shiftId:'probe-shift',date:'2026-10-10',startTime:'08:00',durationHours:4};
const params={employee,occurrence,allAssignments:[],absences:[]};
let pass=0, fail=0;
function probe(name,fn) {try {fn(); pass++; console.log('PASS',name);} catch (e) {fail++; console.error('FAIL',name,'=>',e.message);} }
global.HortOpsQualifications={evaluateStaffQualifications:()=>({compliant:true})};
function eligible(absenceResult,fatigueResult){
  global.HortOpsAbsences={isStaffAbsentOnDate:()=>absenceResult};
  global.HortOpsFatigueEngine={simulateAssignmentFatigue:()=>fatigueResult};
  return engine.validateEmployeeForOccurrence(params);
}
probe('Baseline: valid healthy dependency responses allow employee',()=>{
  assert.equal(eligible({absent:false},{tier:'LOW',isHardBlocked:false}).eligible,true);
});
probe('R57-P0-01a: malformed absence object must fail closed',()=>{
  const r=eligible({},{tier:'LOW',isHardBlocked:false});
  assert.equal(r.eligible,false, JSON.stringify(r));
  assert.equal(r.hardBlock,true);
  assert.ok(r.reasons.includes('ABSENCE_ENGINE_UNAVAILABLE'));
});
probe('R57-P0-01b: malformed fatigue object must fail closed',()=>{
  const r=eligible({absent:false},{});
  assert.equal(r.eligible,false,JSON.stringify(r));
  assert.equal(r.hardBlock,true);
  assert.ok(r.reasons.includes('FATIGUE_ENGINE_UNAVAILABLE'));
});
probe('R57-P1-04: future refusal excluded from as-of-date fair share',()=>{
  const value=absenceEngine.calculateFairShareScore({id:'person1',ytdOvertimeHours:0},{asOfDate:'2026-10-10',refusalHistory:[{id:'future',staffId:'person1',date:'2027-03-10'}]});
  assert.equal(value,1000,`future refusal inflated priority: ${value}`);
});
// Independent in-memory persistence harness: never contacts real browser or user data.
require(path.join(root,'js/app.js'));
let stored={schemaVersion:2,jobs:[],roster:[],assignments:{},rostering:{instructions:{},provenance:{}},historicalSnapshots:{},permits:{},budgetSettings:{annualTarget:0},uiState:{activeView:'forward_planner',currentYear:2026},absences:[{id:'absence-1',staffId:'person1',type:'rdo',startDate:'2026-10-11',endDate:'2026-10-11'}],refusalHistory:[{id:'refusal-1',staffId:'person1',date:'2026-10-09'}]};
const copy = x => JSON.parse(JSON.stringify(x));
global.HortOpsSchemaValidator={validateCurrentV2Presence:()=>({valid:true})};
global.HortOpsStorage={readVerifiedCommittedV2:()=>({ok:true,exists:true,data:copy(stored)}),createWorkspaceEnvelope:copy,saveWorkspace:e=>{stored=copy(e);return {ok:true,storageMode:'local'};}};
const app=global.HortOpsApp;
app._authoritativeSnapshotCount=0;app._allowHistoryReset=false;
function fresh(){
 stored.absences=[{id:'absence-1',staffId:'person1',type:'rdo',startDate:'2026-10-11',endDate:'2026-10-11'}];
 stored.refusalHistory=[{id:'refusal-1',staffId:'person1',date:'2026-10-09'}];
 app.state={schemaVersion:2,jobs:[],staffList:[],customAssignments:{},rostering:{instructions:{},provenance:{}},historicalSnapshots:{},customPermits:{},budgetSettings:{annualTarget:0},activeView:'forward_planner',currentYear:2026,absences:copy(stored.absences),refusalHistory:copy(stored.refusalHistory)};
}
probe('R57-P1-02: explicit normal removal of final absence is supported',()=>{
 fresh();app.recomputeDigest=()=>{};app.renderCurrentView=()=>{};const r=app.saveAbsenceAndRefusalData([], stored.refusalHistory, { deletedAbsenceIds: ['absence-1'], deletedRefusalIds: [] });
 assert.equal(r.success,true,`authorised last-item deletion blocked: ${r.error}`);
 assert.equal(stored.absences.length,0);
});
probe('R57-P0-03a: unsolicited replacement of all known absence identities blocked',()=>{
 fresh();const r=app._commitCanonicalProposal({absences:[{id:'replacement',staffId:'person1',type:'rdo',startDate:'2026-10-12',endDate:'2026-10-12'}]});
 assert.equal(r.success,false,'committed historical absence disappeared without explicit authorised deletion');
 assert.equal(stored.absences[0].id,'absence-1');
});
probe('R57-P0-03b: unsolicited elimination of all refusal identities blocked',()=>{
 fresh();const r=app._commitCanonicalProposal({refusalHistory:[]});
 assert.equal(r.success,false,'committed refusal ledger disappeared without explicit authorised deletion');
 assert.equal(stored.refusalHistory[0].id,'refusal-1');
});
console.log(`Independent Review 57: ${pass} passed, ${fail} failed, ${pass+fail} assertions.`);
process.exitCode=fail>0?1:0;
