/**
 * Stage 1 Gate B2 — Targeted Linked Lifecycle Acceptance Suite
 * File: scripts/test_gate_b2.cjs
 *
 * Exercises the 6 linked lifecycle scenarios specified in Review 17 Prompt Section 6:
 * Scenario 1: Source and descendants (Manual, Fixed, Rotation cross-year, vacancy handling)
 * Scenario 2: Reconciliation (Repeat reduction, Fixed->Manual, staff replacement, idempotency)
 * Scenario 3: Date and parent mutation (Year rollover, parent timing change, archive suppression, rest-gap rule)
 * Scenario 4: Unverified historical data and forbidden deletion (fail-closed unverified, unauthorised deletion blocked)
 * Scenario 5: Authorised future unassignment and failure atomicity (Explicit cancellation, validation & write failure rollback)
 * Scenario 6: Complete round trip (Save, verified reload, checked JSON backup and restore, zero leakage)
 */

const assert = require('assert');
const path = require('path');

// ============================================================================
// 1. Mock Browser Environment
// ============================================================================
class MockLocalStorage {
  constructor() {
    this.store = {};
    this.throwOnSet = false;
  }
  getItem(key) {
    return this.store.hasOwnProperty(key) ? this.store[key] : null;
  }
  setItem(key, value) {
    if (this.throwOnSet) {
      throw new Error('QuotaExceededError: simulated localStorage write failure');
    }
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(i) {
    return Object.keys(this.store)[i] || null;
  }
}

let lastAlertMessage = null;
global.window = {
  localStorage: new MockLocalStorage(),
  alert: function(msg) { lastAlertMessage = msg; },
  HortOpsHeader: { render: function() { return ''; } },
  HortOpsForwardPlanner: { render: function() { return ''; } }
};
global.localStorage = global.window.localStorage;
global.alert = function(msg) { lastAlertMessage = msg; };
global.document = {
  getElementById: function() { return null; },
  addEventListener: function() {}
};

// ============================================================================
// 2. Load Modular Dependencies in Canonical Order
// ============================================================================
require('../js/data/holidays.js');
require('../js/data/initialJobs.js');
require('../js/data/staffRoster.js');
require('../js/data/historicalOccurrences.js');
require('../js/utils/dateUtils.js');
require('../js/utils/securityUtils.js');
require('../js/utils/storage/schemaValidator.js');
require('../js/utils/storage/migrationEngine.js');
require('../js/utils/storage/storageDriver.js');
require('../js/utils/storage.js');
require('../js/utils/eligibilityEngine.js');
require('../js/utils/rostering/engine.js');
require('../js/utils/rostering/commitmentPlanner.js');
require('../js/utils/scheduler/costCalculator.js');
require('../js/utils/scheduler/engine.js');
require('../js/utils/scheduler.js');
require('../js/components/staffAssignModal/candidateModel.js');
require('../js/components/staffAssignModal.js');
require('../js/app.js');
require('../js/components/exportModal.js');
require('../js/components/importModal.js');

console.log('=== RUNNING GATE B2 AUTHORITATIVE COMMITMENT LIFECYCLE ACCEPTANCE SUITE ===\n');

// Standard test jobs and roster compliant with Schema v2
const testJobs = [
  {
    id: 'JOB-MANUAL-1',
    name: 'Manual Test Job',
    frequencyType: 'one_off',
    targetDate: '2026-06-06',
    status: 'active',
    primaryTeam: 'Parks',
    crewSize: 1,
    requiredStaff: 1,
    startTime: '08:00',
    durationHours: 8,
    plantOperatorRequired: false
  },
  {
    id: 'JOB-FIXED-CROSS',
    name: 'Fixed Cross-Year Job',
    frequencyType: 'annual',
    targetMonth: 6,
    status: 'active',
    primaryTeam: 'Parks',
    crewSize: 1,
    requiredStaff: 1,
    startTime: '07:00',
    durationHours: 8,
    plantOperatorRequired: false,
    anchorWeek: 23,
    preferredDay: 'saturday'
  },
  {
    id: 'JOB-ROT-CROSS',
    name: 'Rotation Cross-Year Job',
    frequencyType: 'recurring_weeks',
    intervalWeeks: 13, // quarterly
    anchorDate: '2026-06-27',
    anchorWeek: 26,
    status: 'active',
    primaryTeam: 'Parks',
    crewSize: 1,
    requiredStaff: 1,
    startTime: '07:00',
    durationHours: 8,
    plantOperatorRequired: false,
    preferredDay: 'saturday'
  }
];

const testRoster = [
  { id: 'EMP-001', name: 'Alice Smith', team: 'Parks', status: 'active', isPlantOperator: true },
  { id: 'EMP-002', name: 'Bob Jones', team: 'Parks', status: 'active', isPlantOperator: false },
  { id: 'EMP-003', name: 'Charlie Brown', team: 'Parks', status: 'active', isPlantOperator: false }
];

// Injected test date: start of 2026 so all June+ occurrences are future
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-01-01'; };

function resetWorkspaceState() {
  window.localStorage.clear();
  window.localStorage.throwOnSet = false;
  lastAlertMessage = null;
  window.HortOpsApp.state = {
    jobs: JSON.parse(JSON.stringify(testJobs)),
    staffList: JSON.parse(JSON.stringify(testRoster)),
    customAssignments: {},
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: {},
    customPermits: {},
    budgetSettings: {},
    activeView: 'forward_planner',
    currentYear: 2026,
    allShifts: []
  };
  window.HortOpsApp._authoritativeSnapshotCount = 0;
  window.HortOpsApp.recomputeDigest();

  // Save clean initial envelope
  const env = window.HortOpsStorage.createWorkspaceEnvelope({
    schemaVersion: 2,
    jobs: window.HortOpsApp.state.jobs,
    roster: window.HortOpsApp.state.staffList,
    assignments: {},
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: {},
    permits: {},
    budgetSettings: {},
    uiState: { activeView: 'forward_planner', currentYear: 2026 }
  });
  window.HortOpsStorage.saveWorkspace(env);
  window.HortOpsApp._authoritativeSnapshotCount = 0;
}

// INDEPENDENT REVIEW 18 BOUNDED DISCRIMINATORS (reviewer-only, no production changes)
function copy(x){return JSON.parse(JSON.stringify(x));}
function runModal(shiftId, staff) {
  window.HortOpsStaffAssignModal.activeShiftId=shiftId;
  window.HortOpsStaffAssignModal.stagedAssignedStaffIds=staff.slice();
  window.HortOpsStaffAssignModal.stagedSlots=[];
  window.HortOpsStaffAssignModal.stagedSlotStrategies={};
  staff.forEach(function(id){window.HortOpsStaffAssignModal.stagedSlotStrategies[id]={mode:'manual',repeatCount:1};});
  lastAlertMessage=null;
  window.HortOpsStaffAssignModal.saveAllocation();
}
function result(label, condition, detail){ console.log((condition?'PASS':'FAIL')+' '+label+': '+JSON.stringify(detail)); return condition; }
var gaps=0, total=0;
function verify(name,predicate,detail){total++;if(!result(name,predicate,detail))gaps++;}
// Baseline reader absent: modal must fail closed and must not erase established evidence.
resetWorkspaceState();
var man=window.HortOpsApp.state.allShifts.find(function(s){return s.jobId==='JOB-MANUAL-1';});
var fixed=window.HortOpsApp.state.allShifts.find(function(s){return s.jobId==='JOB-FIXED-CROSS';});
runModal(man.shiftId,['EMP-001']);
var rawBefore=window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY);
verify('Setup: baseline persisted actual manual commitment',!!JSON.parse(rawBefore).historicalSnapshots[man.shiftId],{shiftId:man.shiftId});
var reader=window.HortOpsStorage.readVerifiedCommittedV2;
delete window.HortOpsApp.state.historicalSnapshots[man.shiftId];
window.HortOpsStorage.readVerifiedCommittedV2=undefined;
runModal(fixed.shiftId,['EMP-002']);
var rawAfter=window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY);
verify('Missing verified baseline reader must prevent modal overwrite',rawAfter===rawBefore,{changed:rawAfter!==rawBefore,retained:!!JSON.parse(rawAfter).historicalSnapshots[man.shiftId],alert:lastAlertMessage});
window.HortOpsStorage.readVerifiedCommittedV2=reader;
// A corrupt committed baseline must stop the modal rather than be replaced by a newly valid envelope.
resetWorkspaceState();
man=window.HortOpsApp.state.allShifts.find(function(s){return s.jobId==='JOB-MANUAL-1';});
fixed=window.HortOpsApp.state.allShifts.find(function(s){return s.jobId==='JOB-FIXED-CROSS';});
runModal(man.shiftId,['EMP-001']);
window.localStorage.setItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY,'{ CORRUPTED COMMITTED V2');
runModal(fixed.shiftId,['EMP-002']);
var corruptAfter=window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY);
verify('Unreadable committed bytes must remain quarantined in modal save',corruptAfter==='{ CORRUPTED COMMITTED V2',{overwritten:corruptAfter!=='{ CORRUPTED COMMITTED V2',alert:lastAlertMessage});
// Mandatory engine absent: modal must not fall back to app.updateShiftStaff without a snapshot.
resetWorkspaceState();
man=window.HortOpsApp.state.allShifts.find(function(s){return s.jobId==='JOB-MANUAL-1';});
var engine=window.HortOpsRosteringEngine;
window.HortOpsRosteringEngine=undefined;
runModal(man.shiftId,['EMP-001']);
window.HortOpsRosteringEngine=engine;
var fallbackRaw=JSON.parse(window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY));
verify('Absent rostering engine must not persist unsnapshotted assignment',!(fallbackRaw.assignments[man.shiftId]||[]).length,{assigned:fallbackRaw.assignments[man.shiftId],snapshot:fallbackRaw.historicalSnapshots[man.shiftId],alert:lastAlertMessage});
// Public live direct writer is a second assignment path; it must not persist unsnapshotted new commitments.
resetWorkspaceState();
man=window.HortOpsApp.state.allShifts.find(function(s){return s.jobId==='JOB-MANUAL-1';});
window.HortOpsApp.updateShiftStaff(man.shiftId,['EMP-001']);
var directRaw=JSON.parse(window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY));
verify('Public updateShiftStaff must not persist unsnapshotted new commitment',!(directRaw.assignments[man.shiftId]||[]).length || !!directRaw.historicalSnapshots[man.shiftId],{assigned:directRaw.assignments[man.shiftId],snapshot:directRaw.historicalSnapshots[man.shiftId]});
// Pure planner can currently approve deletion of a different source's manual commitment
// merely because the caller presents an occurrence with its key. No provenance is checked.
resetWorkspaceState();
man=window.HortOpsApp.state.allShifts.find(function(s){return s.jobId==='JOB-MANUAL-1';});
fixed=window.HortOpsApp.state.allShifts.find(function(s){return s.jobId==='JOB-FIXED-CROSS';});
var existingSnap={shiftId:man.shiftId,jobId:man.jobId,date:man.date,startTime:man.startTime,
  durationHours:man.durationHours,assignedStaffIds:['EMP-001'],recordType:'scheduled_commitment',recordedAt:'2026-01-01T00:00:00.000Z'};
var beforeA={}; beforeA[man.shiftId]=['EMP-001'];
var afterA={}; afterA[man.shiftId]=[];
var beforeS={}; beforeS[man.shiftId]=existingSnap;
var forgedJournal={}; forgedJournal[man.shiftId]=man;
var deletion=window.HortOpsCommitmentPlanner.plan({beforeAssignments:beforeA,afterAssignments:afterA,
  beforeSnapshots:beforeS, authoritativeOccurrences:forgedJournal,todayKey:'2026-01-01',
  operation:{type:'allocation_reconciliation',sourceShiftId:fixed.shiftId}});
verify('Planner must require source/provenance proof for unrelated descendant deletion',!deletion.ok,{ok:deletion.ok,removed:deletion.permittedSnapshotRemovals,sourceShiftId:fixed.shiftId,target:man.shiftId});
// Existing snapshot without recordedAt must not acquire an invented historic recording time
// just because its future assigned membership was updated.
var legacySnap=copy(existingSnap);delete legacySnap.recordedAt;
var updBefore={};updBefore[man.shiftId]=['EMP-001'];
var updAfter={};updAfter[man.shiftId]=['EMP-002'];
var originalLegacy={};originalLegacy[man.shiftId]=legacySnap;
var update=window.HortOpsCommitmentPlanner.plan({beforeAssignments:updBefore,afterAssignments:updAfter,
  beforeSnapshots:originalLegacy,authoritativeOccurrences:forgedJournal,todayKey:'2026-01-01',
  operation:{type:'allocation_reconciliation',sourceShiftId:man.shiftId}});
verify('Existing record lacking recordedAt must not acquire fabricated audit time', update.ok && !Object.prototype.hasOwnProperty.call(update.snapshots[man.shiftId],'recordedAt'),
  {ok:update.ok,recordedAt:update.ok&&update.snapshots[man.shiftId].recordedAt});
console.log('INDEPENDENT GATE B2 GAPS '+gaps+'/'+total);
