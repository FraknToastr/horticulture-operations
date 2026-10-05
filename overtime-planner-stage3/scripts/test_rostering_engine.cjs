process.env.TZ = 'Australia/Adelaide';
// Automated Test Suite for HortOpsRosteringEngine (Offline17 Mandate Sections 46-54)
const assert = require('assert');

// Bootstrap simulated browser globals
global.window = global;
class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(k) { return this.store[k] !== undefined ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}
global.window.localStorage = new MockLocalStorage();
require('../js/data/staffRoster.js');
require('../js/data/initialJobs.js');
require('../js/utils/dateUtils.js');
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-03-01'; };
require('../js/utils/eligibilityEngine.js');
require('../js/components/staffAssignModal/candidateModel.js');
require('../js/utils/rostering/engine.js');
require('../js/utils/storage/schemaValidator.js');
require('../js/utils/storage/migrationEngine.js');
require('../js/utils/storage/storageDriver.js');
require('../js/utils/storage.js');

const rostering = window.HortOpsRosteringEngine;
assert(rostering, 'HortOpsRosteringEngine must be defined');

console.log('=== RUNNING OFFLINE17 ROSTERING ENGINE TEST SUITE ===');

// Mock data fixtures
const mockJob = {
  id: 'JOB-TEST-ROSTER',
  name: 'Playford Reserve Turf Maintenance',
  status: 'active',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-03-07',
  intervalWeeks: 1,
  preferredDay: 'saturday',
  primaryTeam: 'Parks',
  secondaryTeam: 'Horticulture',
  plantOperatorRequired: false,
  crewSize: 2
};

const mockRoster = [
  { id: 'EMP-001', name: 'Alice Smith', team: 'Parks', role: 'Team Leader', status: 'active', isPlantOperator: false },
  { id: 'EMP-002', name: 'Bob Jones', team: 'Parks', role: 'Worker', status: 'active', isPlantOperator: true },
  { id: 'EMP-003', name: 'Charlie Brown', team: 'Parks', role: 'Worker', status: 'active', isPlantOperator: false },
  { id: 'EMP-004', name: 'David Lee', team: 'Horticulture', role: 'Worker', status: 'active', isPlantOperator: false },
  { id: 'EMP-005', name: 'Emma Watson', team: 'Arboriculture', role: 'Worker', status: 'active', isPlantOperator: false }
];

const mockShifts = [
  { shiftId: 'JOB-TEST-ROSTER@2026-03-07', jobId: 'JOB-TEST-ROSTER', date: '2026-03-07', startTime: '06:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] },
  { shiftId: 'JOB-TEST-ROSTER@2026-03-14', jobId: 'JOB-TEST-ROSTER', date: '2026-03-14', startTime: '06:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] },
  { shiftId: 'JOB-TEST-ROSTER@2026-03-21', jobId: 'JOB-TEST-ROSTER', date: '2026-03-21', startTime: '06:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] },
  { shiftId: 'JOB-TEST-ROSTER@2026-03-28', jobId: 'JOB-TEST-ROSTER', date: '2026-03-28', startTime: '06:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] },
  { shiftId: 'JOB-TEST-ROSTER@2026-04-04', jobId: 'JOB-TEST-ROSTER', date: '2026-04-04', startTime: '06:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] },
  { shiftId: 'JOB-TEST-ROSTER@2026-04-11', jobId: 'JOB-TEST-ROSTER', date: '2026-04-11', startTime: '06:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] }
];

// -------------------------------------------------------------
// Test 1: Series Resolution & Repeat Max Calculation (Section 4, 49)
// -------------------------------------------------------------
console.log('\n[1] Testing Series Resolution & Repeat Bounds...');
const series = rostering.resolveSeries(mockJob, mockShifts);
assert.strictEqual(series.length, 6, 'Series must have 6 occurrences');
assert.strictEqual(series[0].shiftId, 'JOB-TEST-ROSTER@2026-03-07');
assert.strictEqual(series[5].shiftId, 'JOB-TEST-ROSTER@2026-04-11');

assert.strictEqual(rostering.resolveRepeatMax('JOB-TEST-ROSTER@2026-03-07', mockShifts, mockJob), 6);
assert.strictEqual(rostering.resolveRepeatMax('JOB-TEST-ROSTER@2026-03-14', mockShifts, mockJob), 5);
assert.strictEqual(rostering.resolveRepeatMax('JOB-TEST-ROSTER@2026-03-28', mockShifts, mockJob), 3);
assert.strictEqual(rostering.resolveRepeatMax('JOB-TEST-ROSTER@2026-04-11', mockShifts, mockJob), 1);
console.log('  ✔ Series resolution and remaining occurrence counts verified.');

// -------------------------------------------------------------
// Test 2: Fixed Basic Propagation (Section 6, 47)
// -------------------------------------------------------------
console.log('\n[2] Testing Fixed Basic Propagation (Repeat 3 of 6)...');
let resFixed = rostering.applyRostering({
  job: mockJob,
  currentShift: mockShifts[0],
  stagedStaffIds: ['EMP-001'],
  stagedStrategies: { 'EMP-001': { mode: 'fixed', repeatCount: 3 } },
  allShifts: mockShifts,
  roster: mockRoster,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} }
});

assert(resFixed.success, 'applyRostering must succeed');
assert.deepStrictEqual(resFixed.customAssignments['JOB-TEST-ROSTER@2026-03-07'], ['EMP-001']);
assert.deepStrictEqual(resFixed.customAssignments['JOB-TEST-ROSTER@2026-03-14'], ['EMP-001']);
assert.deepStrictEqual(resFixed.customAssignments['JOB-TEST-ROSTER@2026-03-21'], ['EMP-001']);
assert(!resFixed.customAssignments['JOB-TEST-ROSTER@2026-03-28'], 'Shift 4 must remain vacant');
assert(!resFixed.customAssignments['JOB-TEST-ROSTER@2026-04-04'], 'Shift 5 must remain vacant');
assert(!resFixed.customAssignments['JOB-TEST-ROSTER@2026-04-11'], 'Shift 6 must remain vacant');

// Verify provenance
const pKey0 = 'JOB-TEST-ROSTER@2026-03-07:EMP-001';
const pKey1 = 'JOB-TEST-ROSTER@2026-03-14:EMP-001';
const pKey2 = 'JOB-TEST-ROSTER@2026-03-21:EMP-001';
assert(resFixed.rosteringState.provenance[pKey0], 'Shift 0 provenance must exist');
assert.strictEqual(resFixed.rosteringState.provenance[pKey0].strategy, 'fixed');
assert.strictEqual(resFixed.rosteringState.provenance[pKey1].sequenceIndex, 1);
assert.strictEqual(resFixed.rosteringState.provenance[pKey2].sequenceIndex, 2);
console.log('  ✔ Fixed basic propagation (1-3 assigned, 4-6 vacant) verified with provenance.');

// -------------------------------------------------------------
// Test 3: Fixed Middle Occurrence (Section 47)
// -------------------------------------------------------------
console.log('\n[3] Testing Fixed from Middle Occurrence (Start at 4, Repeat 2)...');
let resFixedMiddle = rostering.applyRostering({
  job: mockJob,
  currentShift: mockShifts[3], // 2026-03-28
  stagedStaffIds: ['EMP-001'],
  stagedStrategies: { 'EMP-001': { mode: 'fixed', repeatCount: 2 } },
  allShifts: mockShifts,
  roster: mockRoster,
  customAssignments: Object.assign({}, resFixed.customAssignments),
  rosteringState: resFixed.rosteringState
});

assert.deepStrictEqual(resFixedMiddle.customAssignments['JOB-TEST-ROSTER@2026-03-28'], ['EMP-001']);
assert.deepStrictEqual(resFixedMiddle.customAssignments['JOB-TEST-ROSTER@2026-04-04'], ['EMP-001']);
assert(!resFixedMiddle.customAssignments['JOB-TEST-ROSTER@2026-04-11'], 'Shift 6 must remain vacant');
console.log('  ✔ Fixed from middle occurrence verified.');

// -------------------------------------------------------------
// Test 4: Fixed Temporary Ineligibility (Section 7, 47)
// -------------------------------------------------------------
console.log('\n[4] Testing Fixed Temporary Ineligibility (No silent replacement)...');
// Employee 001 is exempt on 2026-03-21 (Shift 2)
const rosterWithExemption = mockRoster.map(s => {
  if (s.id === 'EMP-001') {
    return Object.assign({}, s, {
      isOvertimeExempt: true,
      exemptionStartDate: '2026-03-20',
      exemptionEndDate: '2026-03-22'
    });
  }
  return s;
});

let resFixedInelig = rostering.applyRostering({
  job: mockJob,
  currentShift: mockShifts[0],
  stagedStaffIds: ['EMP-001'],
  stagedStrategies: { 'EMP-001': { mode: 'fixed', repeatCount: 5 } },
  allShifts: mockShifts,
  roster: rosterWithExemption,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} }
});

assert.deepStrictEqual(resFixedInelig.customAssignments['JOB-TEST-ROSTER@2026-03-07'], ['EMP-001'], 'Shift 0 assigned');
assert.deepStrictEqual(resFixedInelig.customAssignments['JOB-TEST-ROSTER@2026-03-14'], ['EMP-001'], 'Shift 1 assigned');
assert.deepStrictEqual(resFixedInelig.customAssignments['JOB-TEST-ROSTER@2026-03-21'], [], 'Shift 2 MUST BE VACANT/CONFLICT (no silent substitution)');
assert.deepStrictEqual(resFixedInelig.customAssignments['JOB-TEST-ROSTER@2026-03-28'], ['EMP-001'], 'Shift 3 resumes Fixed assignment');
assert.deepStrictEqual(resFixedInelig.customAssignments['JOB-TEST-ROSTER@2026-04-04'], ['EMP-001'], 'Shift 4 resumes Fixed assignment');

const ineligLog = resFixedInelig.auditLog.find(l => l.action === 'fixed_ineligible_vacancy');
assert(ineligLog, 'Ineligible vacancy must be recorded in audit log');
assert.strictEqual(ineligLog.shiftId, 'JOB-TEST-ROSTER@2026-03-21');
console.log('  ✔ Fixed temporary ineligibility verified: vacancy left, resumes when eligible.');

// -------------------------------------------------------------
// Test 5: Manual Precedence Over Propagation (Section 16, 50)
// -------------------------------------------------------------
console.log('\n[5] Testing Manual Assignment Precedence Over Earlier Propagation...');
// Preset an explicit manual assignment of Bob (EMP-002) on Shift 1 (2026-03-14)
const existingAssignments = {
  'JOB-TEST-ROSTER@2026-03-14': ['EMP-002']
};
const existingProv = {
  'JOB-TEST-ROSTER@2026-03-14:EMP-002': { source: 'manual', slotIndex: 0 }
};

let resManualBlock = rostering.applyRostering({
  job: mockJob,
  currentShift: mockShifts[0],
  stagedStaffIds: ['EMP-001'],
  stagedStrategies: { 'EMP-001': { mode: 'fixed', repeatCount: 4 } },
  allShifts: mockShifts,
  roster: mockRoster,
  customAssignments: existingAssignments,
  rosteringState: { instructions: {}, provenance: existingProv }
});

// Shift 1 must strictly preserve Bob Jones (EMP-002)!
assert.deepStrictEqual(resManualBlock.customAssignments['JOB-TEST-ROSTER@2026-03-14'], ['EMP-002'], 'Manual assignment MUST NOT be overwritten!');
assert(resManualBlock.auditLog.some(l => l.action === 'manual_assignment_preserved' || l.action === 'blocked_by_manual_assignment'), 'Collision must be logged');
console.log('  ✔ Manual precedence contract verified: explicit assignment preserved.');

// -------------------------------------------------------------
// Test 6: Rotation Basic Propagation (Section 8, 48)
// -------------------------------------------------------------
console.log('\n[6] Testing Rotation Basic Propagation (Avoiding immediate repeat)...');
let resRot = rostering.applyRostering({
  job: mockJob,
  currentShift: mockShifts[0],
  stagedStaffIds: ['EMP-001'],
  stagedStrategies: { 'EMP-001': { mode: 'rotation', repeatCount: 4 } },
  allShifts: mockShifts,
  roster: mockRoster,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} }
});

const s0Assigned = resRot.customAssignments['JOB-TEST-ROSTER@2026-03-07'][0];
const s1Assigned = resRot.customAssignments['JOB-TEST-ROSTER@2026-03-14'][0];
const s2Assigned = resRot.customAssignments['JOB-TEST-ROSTER@2026-03-21'][0];
const s3Assigned = resRot.customAssignments['JOB-TEST-ROSTER@2026-03-28'][0];

assert.strictEqual(s0Assigned, 'EMP-001', 'Occurrence 0 starts with Alice (EMP-001)');
assert.notStrictEqual(s1Assigned, 'EMP-001', 'Occurrence 1 must NOT immediately repeat Alice (EMP-001)');
assert.notStrictEqual(s2Assigned, s1Assigned, 'Occurrence 2 must NOT immediately repeat Occurrence 1 officer');
assert.notStrictEqual(s3Assigned, s2Assigned, 'Occurrence 3 must NOT immediately repeat Occurrence 2 officer');
console.log(`  ✔ Rotation sequence: ${s0Assigned} -> ${s1Assigned} -> ${s2Assigned} -> ${s3Assigned} (no immediate repeats).`);

// -------------------------------------------------------------
// Test 7: Rotation Single Eligible Candidate Fallback (Section 9, 48)
// -------------------------------------------------------------
console.log('\n[7] Testing Rotation Single Eligible Candidate Fallback (No artificial vacancy)...');
// Only Alice is eligible in the entire roster
const singleRoster = [
  { id: 'EMP-001', name: 'Alice Smith', team: 'Parks', role: 'Worker', status: 'active', isPlantOperator: false }
];

let resSingleRot = rostering.applyRostering({
  job: mockJob,
  currentShift: mockShifts[0],
  stagedStaffIds: ['EMP-001'],
  stagedStrategies: { 'EMP-001': { mode: 'rotation', repeatCount: 3 } },
  allShifts: mockShifts,
  roster: singleRoster,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} }
});

assert.deepStrictEqual(resSingleRot.customAssignments['JOB-TEST-ROSTER@2026-03-07'], ['EMP-001']);
assert.deepStrictEqual(resSingleRot.customAssignments['JOB-TEST-ROSTER@2026-03-14'], ['EMP-001'], 'Reuses sole eligible candidate');
assert.deepStrictEqual(resSingleRot.customAssignments['JOB-TEST-ROSTER@2026-03-21'], ['EMP-001'], 'Reuses sole eligible candidate');

const reuseLog = resSingleRot.auditLog.find(l => l.reusedPrevious === true);
assert(reuseLog, 'Audit log must record reusedPrevious: true');
assert.strictEqual(reuseLog.reason, 'No alternative eligible employee available');
console.log('  ✔ Single candidate fallback verified: reuses candidate with explanatory note, no artificial vacancy.');

// -------------------------------------------------------------
// Test 8: Rotation Plant Operator Crew Contract (Section 40, 52)
// -------------------------------------------------------------
console.log('\n[8] Testing Rotation Plant Operator Crew Requirement...');
const plantJob = Object.assign({}, mockJob, { plantOperatorRequired: true });

let resPlantRot = rostering.applyRostering({
  job: plantJob,
  currentShift: Object.assign({}, mockShifts[0], { plantOperatorRequired: true }),
  stagedStaffIds: ['EMP-002'], // Bob is certified Plant Op
  stagedStrategies: { 'EMP-002': { mode: 'rotation', repeatCount: 3 } },
  allShifts: mockShifts.map(s => Object.assign({}, s, { plantOperatorRequired: true })),
  roster: mockRoster,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} }
});

// For Shift 1 and 2, since only Bob is a certified Plant Operator among eligible candidates,
// Rotation must satisfy the Plant Operator requirement rather than picking non-operators!
assert.deepStrictEqual(resPlantRot.customAssignments['JOB-TEST-ROSTER@2026-03-14'], ['EMP-002'], 'Shift 1 must choose certified operator');
assert.deepStrictEqual(resPlantRot.customAssignments['JOB-TEST-ROSTER@2026-03-21'], ['EMP-002'], 'Shift 2 must choose certified operator');
console.log('  ✔ Plant operator crew contract satisfied under rotation.');

// -------------------------------------------------------------
// Test 9: Provenance Pruning on Instruction Change (Section 36, 51)
// -------------------------------------------------------------
console.log('\n[9] Testing Provenance-Aware Pruning on Instruction Modification...');
// Suppose Fixed Repeat 4 was created
let resInit = rostering.applyRostering({
  job: mockJob,
  currentShift: mockShifts[0],
  stagedStaffIds: ['EMP-001'],
  stagedStrategies: { 'EMP-001': { mode: 'fixed', repeatCount: 4 } },
  allShifts: mockShifts,
  roster: mockRoster,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} }
});

const instId = Object.keys(resInit.rosteringState.instructions)[0];
assert(instId, 'Instruction ID must exist');

// Add a manual assignment of EMP-004 on Shift 3
resInit.customAssignments['JOB-TEST-ROSTER@2026-03-28'].push('EMP-004');
resInit.rosteringState.provenance['JOB-TEST-ROSTER@2026-03-28:EMP-004'] = { source: 'manual', slotIndex: 1 };

// Now prune/reduce repeat count to 2
const prunedAssignments = rostering.pruneInstructionAssignments(
  instId,
  2,
  resInit.customAssignments,
  resInit.rosteringState,
  series
);

// Shifts 0 and 1 remain assigned to EMP-001
assert.deepStrictEqual(prunedAssignments['JOB-TEST-ROSTER@2026-03-07'], ['EMP-001']);
assert.deepStrictEqual(prunedAssignments['JOB-TEST-ROSTER@2026-03-14'], ['EMP-001']);
// Shift 2 EMP-001 was pruned!
assert.deepStrictEqual(prunedAssignments['JOB-TEST-ROSTER@2026-03-21'], []);
// Shift 3 EMP-001 was pruned, BUT manual EMP-004 was strictly preserved!
assert.deepStrictEqual(prunedAssignments['JOB-TEST-ROSTER@2026-03-28'], ['EMP-004'], 'Unrelated manual assignment strictly preserved!');
console.log('  ✔ Provenance-aware pruning verified: only generated assignments pruned, manual assignments preserved.');

// -------------------------------------------------------------
// Test 10: Persistence Round-Trip & Envelope Schema Integrity (Section 20, 53)
// -------------------------------------------------------------
console.log('\n[10] Testing Schema v2 Envelope Persistence with Rostering State...');
const testEnvelope = window.HortOpsStorage.createWorkspaceEnvelope({
  schemaVersion: 2,
  jobs: [mockJob],
  roster: mockRoster,
  assignments: { 'JOB-TEST-ROSTER@2026-03-07': ['EMP-001'] },
  historicalSnapshots: {},
  rostering: {
    instructions: {
      'ROSTER-JOB-TEST-ROSTER-2026-03-07-SLOT-1': {
        id: 'ROSTER-JOB-TEST-ROSTER-2026-03-07-SLOT-1',
        instructionId: 'ROSTER-JOB-TEST-ROSTER-2026-03-07-SLOT-1',
        jobId: mockJob.id,
        sourceShiftId: 'JOB-TEST-ROSTER@2026-03-07',
        mode: 'fixed',
        employeeId: 'EMP-001',
        repeatCount: 3,
        slotId: 'SLOT-1'
      }
    },
    provenance: {
      'JOB-TEST-ROSTER@2026-03-07:EMP-001': {
        source: 'rostering-rule',
        strategy: 'fixed',
        instructionId: 'ROSTER-JOB-TEST-ROSTER-2026-03-07-SLOT-1',
        sourceShiftId: 'JOB-TEST-ROSTER@2026-03-07',
        sequenceIndex: 0,
        slotId: 'SLOT-1'
      }
    }
  }
});

assert.strictEqual(testEnvelope.schemaVersion, 2, 'Must be integer Schema v2');
assert(testEnvelope.rostering.instructions['ROSTER-JOB-TEST-ROSTER-2026-03-07-SLOT-1'], 'Rostering instructions must be preserved in envelope');
assert(testEnvelope.rostering.provenance['JOB-TEST-ROSTER@2026-03-07:EMP-001'], 'Rostering provenance must be preserved in envelope');

const saveResult = window.HortOpsStorage.saveWorkspace(testEnvelope);
assert(saveResult.ok, 'saveWorkspace must succeed with rostering envelope');

const loadedWs = window.HortOpsStorage.loadWorkspace();
assert(loadedWs.rostering, 'Loaded workspace must contain rostering');
assert(loadedWs.rostering.instructions['ROSTER-JOB-TEST-ROSTER-2026-03-07-SLOT-1'], 'Loaded instructions must match');
console.log('  ✔ Persistence round-trip with Schema v2 envelope verified.');


// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1 INTEGRITY — Test 11: Eligibility engine correctly enforces 10-hour
// rest gap, blocking the affected candidate while permitting an eligible
// alternative. This is the path consumed by Rotation auto-fill via
// recommendRotationCandidate → validateStaffEligibility.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[11] Stage 1: Eligibility engine rejects candidate with insufficient rest...');

// Prior shift: EMP-REST-TEST works 14:00–22:00 on 2026-05-13.
// Proposed shift: 05:00 on 2026-05-14 — only 7 hours rest (< 10 h minimum).
const priorRestShift = {
  shiftId: 'PRIOR-REST-SHIFT',
  date: '2026-05-13',
  startTime: '02:00 PM',   // 14:00 — ends 22:00 (8 h duration)
  durationHours: 8,
  assignedStaffIds: ['EMP-REST-TEST']
};
const proposedRestShift = {
  shiftId: 'PROPOSED-REST-SHIFT',
  date: '2026-05-14',
  startTime: '05:00 AM',   // 05:00 — only 7 h after 22:00
  durationHours: 6
};

const restCandidateBlocked = { id: 'EMP-REST-TEST',  name: 'Rest Tester',  team: 'Parks', status: 'active', isPlantOperator: false };
const restCandidateClear   = { id: 'EMP-REST-OTHER', name: 'Other Worker', team: 'Parks', status: 'active', isPlantOperator: false };

// Direct eligibility check — same engine path as recommendRotationCandidate.
const eligEngine = window.HortOpsEligibilityEngine;

const resBlocked = eligEngine.validateEmployeeForOccurrence({
  employee: restCandidateBlocked,
  occurrence: proposedRestShift,
  allAssignments: [priorRestShift]
});
assert.strictEqual(resBlocked.eligible, false,
  'Test 11a: EMP-REST-TEST must be ineligible (7 h rest < 10 h minimum)');
assert.strictEqual(resBlocked.hardBlock, true,
  'Test 11a: INSUFFICIENT_REST must produce a hardBlock');
assert(resBlocked.reasons.includes('INSUFFICIENT_REST'),
  'Test 11a: Must report INSUFFICIENT_REST code');
assert(!resBlocked.reasons.includes('OVERLAPPING_SHIFT'),
  'Test 11a: Non-overlapping shifts must NOT also report OVERLAPPING_SHIFT');

// EMP-REST-OTHER has no prior shift — must be eligible for the same proposed shift.
const resClear = eligEngine.validateEmployeeForOccurrence({
  employee: restCandidateClear,
  occurrence: proposedRestShift,
  allAssignments: [priorRestShift]   // prior shift not assigned to EMP-REST-OTHER
});
assert.strictEqual(resClear.eligible, true,
  'Test 11b: EMP-REST-OTHER (no prior conflicting shift) must be eligible');

// Confirm via validateStaffEligibility (the bridge used by recommendRotationCandidate).
const resViaLegacy = eligEngine.validateStaffEligibility(
  restCandidateBlocked,
  proposedRestShift,
  null,                              // no job object
  [priorRestShift]                   // allShifts (allAssignments)
);
assert.strictEqual(resViaLegacy.eligible, false,
  'Test 11c: validateStaffEligibility bridge must also block EMP-REST-TEST');
assert(resViaLegacy.reasons.includes('INSUFFICIENT_REST'),
  'Test 11c: validateStaffEligibility bridge must propagate INSUFFICIENT_REST');

console.log('  ✔ Stage 1: Eligibility engine correctly blocks rest-gap violator and permits eligible alternative.');
console.log('  ✔ Stage 1: INSUFFICIENT_REST propagates through validateStaffEligibility (rotation auto-fill path).');

// Load staffAssignModal for Test 13
require('../js/data/holidays.js');
require('../js/utils/scheduler/costCalculator.js');
require('../js/utils/scheduler/engine.js');
require('../js/utils/scheduler.js');
require('../js/components/staffAssignModal.js');

// [12] Testing Rotation Recommendation Excludes Insufficient-Rest Candidate Via Adjacent Boundary Lookup
console.log('\n[12] Testing Rotation Recommendation Excludes Insufficient-Rest Candidate Via Real Boundary Lookup...');
const rotOccurrence = {
  shiftId: 'ROT-OCC-2028-JAN1',
  jobId: 'job-rot-2028',
  date: '2028-01-01',
  startTime: '05:00 AM',
  durationHours: 6,
  plantOperatorRequired: false
};
const prevJob2027 = {
  id: 'job-nye-2027',
  name: 'NYE Event 2027',
  frequencyType: 'one_off',
  status: 'active',
  targetDate: '2027-12-31',
  startTime: '10:00 PM', // ends 04:00 AM Jan 1 (1 hr gap before 05:00)
  durationHours: 6,
  requiredStaff: 1,
  plantOperatorRequired: false
};
const testJobs = [
  { id: 'job-rot-2028', name: 'Job 2028', primaryTeam: 'Parks', status: 'active' },
  prevJob2027
];
const rotRoster = [
  { id: 'EMP-001', name: 'Candidate One', team: 'Parks', status: 'active', isPlantOperator: false },
  { id: 'EMP-002', name: 'Candidate Two', team: 'Parks', status: 'active', isPlantOperator: false }
];
const customAssignments = {
  'job-nye-2027@2027-12-31': ['EMP-001']
};

window.HortOpsScheduler.clearBoundaryCache();

// Call recommendRotationCandidate with allShifts: [] (empty!) - it must discover 2027-12-31 via scheduler boundary lookup!
const rotResult = window.HortOpsRosteringEngine.recommendRotationCandidate({
  job: testJobs[0],
  occurrence: rotOccurrence,
  allShifts: [], // Empty! Must discover adjacent commitment via getAdjacentBoundaryShifts
  roster: rotRoster,
  currentAssignedIds: [],
  previousHolderId: 'EMP-001',
  jobs: testJobs,
  customAssignments: customAssignments
});

assert(rotResult.candidate, 'Test 12: An eligible candidate must be recommended');
assert.strictEqual(rotResult.candidate.id, 'EMP-002',
  'Test 12: EMP-001 must be excluded due to insufficient rest discovered via adjacent boundary lookup; EMP-002 recommended');
console.log('  ✔ Rotation recommendation successfully excluded candidate with insufficient rest via real adjacent boundary lookup.');

// [13] Testing saveAllocation() Hard Rejection Flow With Mocked window.alert
console.log('\n[13] Testing saveAllocation() Hard Rejection Flow With Mocked window.alert...');
let modalAlertCalled = false;
let modalAlertMsg = '';
window.alert = function(msg) {
  modalAlertCalled = true;
  modalAlertMsg = msg;
};

assert(typeof window.HortOpsStaffAssignModal.getHumanIneligibleReason === 'function',
  'Test 13a: HortOpsStaffAssignModal.getHumanIneligibleReason must be a function');
assert(typeof window.HortOpsEligibilityEngine.getHumanIneligibleReason === 'function',
  'Test 13b: HortOpsEligibilityEngine.getHumanIneligibleReason must be a function');

const modalTargetShift = {
  shiftId: 'MODAL-TARGET-SHIFT',
  jobId: 'job-modal-test',
  jobName: 'Modal Test Job',
  date: '2026-06-15',
  startTime: '08:00 AM',
  durationHours: 4,
  plantOperatorRequired: false
};
const modalPriorShift = {
  shiftId: 'MODAL-PRIOR-SHIFT',
  jobId: 'job-modal-test',
  jobName: 'Modal Test Job',
  date: '2026-06-14',
  startTime: '10:00 PM', // ends 02:00 AM June 15 (6 hr gap < 10h)
  durationHours: 4,
  assignedStaffIds: ['EMP-REST-FAIL']
};
const modalJob = {
  id: 'job-modal-test',
  name: 'Modal Test Job',
  frequency: 'one-off',
  status: 'active',
  primaryTeam: 'Parks',
  requiredStaff: 1,
  plantOperatorRequired: false
};
const modalRoster = [
  { id: 'EMP-REST-FAIL', name: 'Rest Failing Staff', team: 'Parks', status: 'active', isPlantOperator: false }
];

const initialAssignments = {
  'MODAL-PRIOR-SHIFT': ['EMP-REST-FAIL']
};

window.HortOpsApp = {
  state: {
    allShifts: [modalPriorShift, modalTargetShift],
    jobs: [modalJob],
    staffList: modalRoster,
    customAssignments: JSON.parse(JSON.stringify(initialAssignments)),
    rostering: { instructions: {}, provenance: {} }
  },
  saveCurrentWorkspace: function() {
    throw new Error('saveCurrentWorkspace must not be called when validation fails!');
  }
};

window.HortOpsStaffAssignModal.activeShiftId = 'MODAL-TARGET-SHIFT';
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-REST-FAIL'];

// Invoke saveAllocation() directly
window.HortOpsStaffAssignModal.saveAllocation();

assert.strictEqual(modalAlertCalled, true, 'Test 13c: saveAllocation() must trigger alert on hard violation');
assert(modalAlertMsg.indexOf('Insufficient Rest (< 10h)') !== -1,
  'Test 13d: alert message must mention Insufficient Rest (< 10h)');
assert(modalAlertMsg.indexOf('Rest Failing Staff') !== -1,
  'Test 13e: alert message must mention Rest Failing Staff');
assert.deepStrictEqual(window.HortOpsApp.state.customAssignments, initialAssignments,
  'Test 13f: customAssignments must not be mutated when saveAllocation is rejected');
console.log('  ✔ saveAllocation() hard rejection verified: alert called with Insufficient Rest (< 10h) without ReferenceError, state unmutated.');

// [14] Testing Boundary Cache Dynamic State Invalidation
console.log('\n[14] Testing Boundary Cache Dynamic State Invalidation...');
const cacheTestJob = {
  id: 'job-cache-nye',
  name: 'NYE Cache Test',
  frequencyType: 'one_off',
  status: 'active',
  targetDate: '2027-12-31',
  startTime: '08:00 PM',
  durationHours: 6,
  requiredStaff: 1,
  plantOperatorRequired: false
};
const cacheJobs = [cacheTestJob];
const cacheStaff = [
  { id: 'EMP-A', name: 'Worker Alpha', team: 'Parks', status: 'active', isPlantOperator: false },
  { id: 'EMP-B', name: 'Worker Beta', team: 'Parks', status: 'active', isPlantOperator: false }
];

const assignState1 = { 'job-cache-nye@2027-12-31': ['EMP-A'] };
const res1 = window.HortOpsScheduler.getAdjacentBoundaryShifts('2028-01-01', cacheJobs, assignState1, cacheStaff);
assert(res1.length > 0, 'Test 14a: Must find 2027-12-31 shift');
assert.deepStrictEqual(res1[0].assignedStaffIds, ['EMP-A'], 'Test 14a: Initial assignment must be EMP-A');

// Mutate assignments without manually calling clearBoundaryCache()
const assignState2 = { 'job-cache-nye@2027-12-31': ['EMP-B'] };
const res2 = window.HortOpsScheduler.getAdjacentBoundaryShifts('2028-01-01', cacheJobs, assignState2, cacheStaff);
assert(res2.length > 0, 'Test 14b: Must find 2027-12-31 shift');
assert.deepStrictEqual(res2[0].assignedStaffIds, ['EMP-B'],
  'Test 14b: Mutated assignment to EMP-B must be immediately reflected (signature-aware cache invalidation)');

// Verify explicit clearBoundaryCache() works
window.HortOpsScheduler.clearBoundaryCache();
const res3 = window.HortOpsScheduler.getAdjacentBoundaryShifts('2028-01-01', cacheJobs, assignState2, cacheStaff);
assert.deepStrictEqual(res3[0].assignedStaffIds, ['EMP-B'], 'Test 14c: clearBoundaryCache() resets cache cleanly');
console.log('  ✔ Boundary cache signature-aware invalidation verified: mutations immediately reflected.');

// [15] Testing Friday, 31 December 2027 Boundary Materialisation & Cross-Year Rest Block
console.log('\n[15] Testing Friday, 31 December 2027 Materialisation & Cross-Year Rest Block...');
const nye2027Job = {
  id: 'nye-2027-event',
  name: 'NYE 2027 Major Event',
  frequencyType: 'one_off',
  status: 'active',
  targetDate: '2027-12-31',
  startTime: '08:00 PM',
  durationHours: 6, // ends 02:00 AM on 2028-01-01
  requiredStaff: 1,
  plantOperatorRequired: false
};

// Generate 2027 operational digest
const digest2027 = window.HortOpsScheduler.generateOperationalDigest([nye2027Job], 2027);
const nye2027Shift = digest2027.allShifts.find(function(s) { return s.date === '2027-12-31'; });
assert(nye2027Shift, 'Test 15a: Friday, 31 December 2027 must be materialized in 2027 operational digest');
assert.strictEqual(nye2027Shift.date, '2027-12-31', 'Test 15a: Shift date must be 2027-12-31');

// Verify that adjacent boundary lookup from 2028-01-01 finds this shift
window.HortOpsScheduler.clearBoundaryCache();
const custom2027 = { 'nye-2027-event@2027-12-31': ['EMP-NYE-2027'] };
const adjFrom2028 = window.HortOpsScheduler.getAdjacentBoundaryShifts('2028-01-01', [nye2027Job], custom2027, [
  { id: 'EMP-NYE-2027', name: 'NYE Worker', team: 'Parks', status: 'active', isPlantOperator: false }
]);
const found2027Nye = adjFrom2028.find(function(s) { return s.date === '2027-12-31'; });
assert(found2027Nye, 'Test 15b: getAdjacentBoundaryShifts(2028-01-01) must discover 2027-12-31 commitment');
assert.deepStrictEqual(found2027Nye.assignedStaffIds, ['EMP-NYE-2027'], 'Test 15b: Assigned staff must match');

// Verify eligibility check on 2028-01-01 morning shift (e.g. 06:00 AM - 4h gap after 02:00 AM)
const jan1_2028Shift = {
  shiftId: 'jan1-2028-morning',
  date: '2028-01-01',
  startTime: '06:00 AM',
  durationHours: 4
};
const valJan1 = window.HortOpsEligibilityEngine.validateEmployeeForOccurrence({
  employee: { id: 'EMP-NYE-2027', name: 'NYE Worker', team: 'Parks', status: 'active' },
  occurrence: jan1_2028Shift,
  allAssignments: [found2027Nye]
});
assert.strictEqual(valJan1.eligible, false, 'Test 15c: Worker finishing at 02:00 on Jan 1 must be blocked from 06:00 shift (4h < 10h)');
assert.strictEqual(valJan1.hardBlock, true, 'Test 15c: Rest violation must be a hardBlock');
assert(valJan1.reasons.includes('INSUFFICIENT_REST'), 'Test 15c: Must report INSUFFICIENT_REST');
console.log('  ✔ Friday 31 Dec 2027 materialized and successfully blocks insufficient-rest allocation on 1 Jan 2028.');

// [16] Testing Fail-Closed Handling on Adjacent Boundary Lookup Failure
console.log('\n[16] Testing Fail-Closed Handling on Adjacent Boundary Lookup Failure...');
// 1. Simulate scheduler engine digest generation error
const realEngineDigest = window.HortOpsSchedulerEngine.generateOperationalDigest;
window.HortOpsSchedulerEngine.generateOperationalDigest = function() {
  throw new Error('Database/Digest generation fatal error');
};
window.HortOpsSchedulerEngine.clearBoundaryCache();

const failedBoundaryResult = window.HortOpsScheduler.getAdjacentBoundaryShifts('2026-01-01', [], {}, []);
assert.strictEqual(failedBoundaryResult.lookupFailed, true, 'Test 16a: Boundary lookup must flag lookupFailed: true on exception');
assert.strictEqual(failedBoundaryResult.code, 'ADJACENT_SCHEDULE_UNAVAILABLE', 'Test 16a: Code must be ADJACENT_SCHEDULE_UNAVAILABLE');
assert(failedBoundaryResult.errorMessage.indexOf('Database/Digest generation fatal error') !== -1,
  'Test 16a: Error message must capture root cause');

// 2. Eligibility engine must hard block when allAssignments has lookupFailed
const failEligResult = window.HortOpsEligibilityEngine.validateEmployeeForOccurrence({
  employee: { id: 'EMP-ANY', name: 'Any Worker', team: 'Parks', status: 'active' },
  occurrence: { shiftId: 's-fail', date: '2026-01-01', startTime: '08:00 AM', durationHours: 4 },
  allAssignments: failedBoundaryResult
});
assert.strictEqual(failEligResult.eligible, false, 'Test 16b: Eligibility validation must fail closed on lookup failure');
assert.strictEqual(failEligResult.hardBlock, true, 'Test 16b: Lookup failure must produce hardBlock');
assert(failEligResult.reasons.includes('ADJACENT_SCHEDULE_UNAVAILABLE'),
  'Test 16b: Must report ADJACENT_SCHEDULE_UNAVAILABLE reason code');

// 3. recommendRotationCandidate must fail closed
const failRotResult = window.HortOpsRosteringEngine.recommendRotationCandidate({
  job: { id: 'job-fail', primaryTeam: 'Parks' },
  occurrence: { shiftId: 's-fail', date: '2026-01-01', startTime: '08:00 AM', durationHours: 4 },
  allShifts: [],
  roster: [{ id: 'EMP-ANY', name: 'Any Worker', team: 'Parks', status: 'active' }]
});
assert.strictEqual(failRotResult.candidate, null, 'Test 16c: recommendRotationCandidate must return null candidate on lookup failure');
assert(failRotResult.reason.indexOf('ADJACENT_SCHEDULE_UNAVAILABLE') !== -1,
  'Test 16c: recommendRotationCandidate reason must indicate ADJACENT_SCHEDULE_UNAVAILABLE');

// 4. saveAllocation must fail closed and alert operator
let failAlertMsg = null;
window.alert = function(msg) { failAlertMsg = msg; };
window.HortOpsApp.state.allShifts = [{
  shiftId: 's-fail',
  jobId: 'job-fail',
  jobName: 'Job Fail',
  date: '2026-01-01',
  startTime: '08:00 AM',
  durationHours: 4
}];
window.HortOpsStaffAssignModal.activeShiftId = 's-fail';
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-ANY'];

window.HortOpsStaffAssignModal.saveAllocation();
assert(failAlertMsg !== null, 'Test 16d: saveAllocation must alert when boundary lookup fails');
assert(failAlertMsg.indexOf('Allocation blocked fail-closed') !== -1,
  'Test 16d: Alert must explicitly inform operator that allocation is blocked fail-closed');

// Restore engine
window.HortOpsSchedulerEngine.generateOperationalDigest = realEngineDigest;
window.HortOpsSchedulerEngine.clearBoundaryCache();
console.log('  ✔ Fail-closed handling verified across scheduler, eligibility engine, rotation recommender, and saveAllocation modal.');

// [17] Testing Job Duration Change Dynamic Boundary Cache Invalidation (Peer Review 03 Finding 1)
console.log('\n[17] Testing Job Duration Change Dynamic Boundary Cache Invalidation...');
const pr3JobNYE = {
  id: 'job-pr3-nye-2027',
  name: 'NYE 2027 Event',
  frequencyType: 'one_off',
  status: 'active',
  targetDate: '2027-12-31',
  startTime: '10:00 PM', // 22:00
  durationHours: 2,      // 2h -> ends 00:00 (midnight Jan 1). Gap to 11:00 AM is 11h (>= 10h -> ELIGIBLE!).
  requiredStaff: 1,
  plantOperatorRequired: false
};
const pr3TargetOccurrence = {
  shiftId: 'jan1-pr3-target',
  jobId: 'job-pr3-target-2028',
  date: '2028-01-01',
  startTime: '11:00 AM',
  durationHours: 4,
  plantOperatorRequired: false
};
const pr3TargetJob2028 = {
  id: 'job-pr3-target-2028',
  name: 'Target Job 2028',
  primaryTeam: 'Parks',
  status: 'active'
};
const pr3Roster = [
  { id: 'EMP-001', name: 'Candidate One', team: 'Parks', status: 'active', isPlantOperator: false },
  { id: 'EMP-002', name: 'Candidate Two', team: 'Parks', status: 'active', isPlantOperator: false }
];
const pr3Assignments = {
  'job-pr3-nye-2027@2027-12-31': ['EMP-001']
};

window.HortOpsScheduler.clearBoundaryCache();

// 1. Initial evaluation with 2h duration: EMP-001 has 11h rest gap (>= 10h)
// When previousHolder is EMP-002, rotation seeks EMP-001. Since EMP-001 is eligible, EMP-001 is selected.
const rotLookup1 = window.HortOpsRosteringEngine.recommendRotationCandidate({
  job: pr3TargetJob2028,
  occurrence: pr3TargetOccurrence,
  allShifts: [],
  roster: pr3Roster,
  currentAssignedIds: [],
  previousHolderId: 'EMP-002',
  jobs: [pr3TargetJob2028, pr3JobNYE],
  customAssignments: pr3Assignments
});
assert.strictEqual(rotLookup1.candidate.id, 'EMP-001',
  'Test 17a: With 2h prior shift (ends 00:00), EMP-001 has 11h rest and must be recommended');

// 2. Extend job duration from 2h to 7h in jobs array WITHOUT calling clearBoundaryCache()
// 22:00 + 7h = ends 05:00 AM on Jan 1. Gap to 11:00 AM is 6h (< 10h).
const pr3JobNYE_extended = Object.assign({}, pr3JobNYE, { durationHours: 7 });
const rotLookup2 = window.HortOpsRosteringEngine.recommendRotationCandidate({
  job: pr3TargetJob2028,
  occurrence: pr3TargetOccurrence,
  allShifts: [],
  roster: pr3Roster,
  currentAssignedIds: [],
  previousHolderId: 'EMP-002',
  jobs: [pr3TargetJob2028, pr3JobNYE_extended], // Updated job duration!
  customAssignments: pr3Assignments
});
assert.strictEqual(rotLookup2.candidate.id, 'EMP-002',
  'Test 17b: Job duration change to 7h must immediately invalidate boundary cache without manual cache clear and exclude EMP-001');
console.log('  ✔ Job duration change dynamically invalidates boundary cache without manual cache clearing.');

// [18] Testing Historical Timing Integrity & Inactive/Archived Job Preservation (Peer Review 04 Findings 1 & 2)
console.log('\n[18] Testing Historical Timing Integrity & Inactive/Archived Job Preservation...');
const origDateFn = window.HortOpsDateUtils.getLocalDateKey;
// Mock date context to 2028-01-01 for boundary evaluation: 2027-12-31 is historical past, 2028+ is future
window.HortOpsDateUtils.getLocalDateKey = function() { return '2028-01-01'; };

window.HortOpsScheduler.clearBoundaryCache();
window.HortOpsData.HISTORICAL_OCCURRENCES = window.HortOpsData.HISTORICAL_OCCURRENCES || [];

// Authoritative historical occurrence snapshot with recorded historical timing (22:00 to 05:00 AM)
const archivedSnapshot = {
  shiftId: 'job-pr3-nye-2027@2027-12-31',
  jobId: 'job-pr3-nye-2027',
  date: '2027-12-31',
  dayOfWeek: 'Friday',
  startTime: '10:00 PM', // 22:00
  durationHours: 7,      // 7h -> ends 05:00 AM on Jan 1
  crewSize: 1,
  assignedStaffIds: ['EMP-001']
};
window.HortOpsData.HISTORICAL_OCCURRENCES.push(archivedSnapshot);
window.HortOpsApp = window.HortOpsApp || { state: {} };
window.HortOpsApp.state = window.HortOpsApp.state || {};
window.HortOpsApp.state.historicalSnapshots = window.HortOpsApp.state.historicalSnapshots || {};
window.HortOpsApp.state.historicalSnapshots[archivedSnapshot.shiftId] = archivedSnapshot;

// Parent job is archived AND its mutable definition has been subsequently changed to daytime 8am, 2h duration
const pr3JobNYE_archived_mutated = Object.assign({}, pr3JobNYE, {
  status: 'archived',
  startTime: '08:00 AM', // Mutated to daytime 8am!
  durationHours: 2       // Mutated to 2h (ends 10:00 AM)!
});

const pr3AssignmentsWithFuture = {
  'job-pr3-nye-2027@2027-12-31': ['EMP-001'],
  'job-pr3-nye-2027@2028-06-15': ['EMP-001'] // Future assignment on archived job!
};

// 18a: Historical preservation must use authoritative snapshot timing, not mutated job definition
const digestArchived2027 = window.HortOpsScheduler.generateOperationalDigest([pr3JobNYE_archived_mutated], 2027, true, pr3AssignmentsWithFuture, pr3Roster);
const preservedShift = digestArchived2027.allShifts.find(function(s) { return s.date === '2027-12-31'; });
assert(preservedShift, 'Test 18a: Assigned 31 Dec 2027 past shift must be preserved in allShifts despite archived parent job');
assert.strictEqual(preservedShift.startTime, '10:00 PM',
  'Test 18a: Must preserve authoritative snapshot startTime (10:00 PM), not mutated job (08:00 AM)');
assert.strictEqual(preservedShift.durationHours, 7,
  'Test 18a: Must preserve authoritative snapshot duration (7h), not mutated job (2h)');
assert.strictEqual(preservedShift.unverifiedSchedule, false,
  'Test 18a: Authoritative snapshot is verified, not unverified');
console.log('  ✔ Historical shift on archived job preserved with authoritative snapshot timing verbatim.');

// 18b: Automatic rotation evaluates against authoritative historical snapshot (22:00-05:00) and excludes EMP-001
const rotLookup3 = window.HortOpsRosteringEngine.recommendRotationCandidate({
  job: pr3TargetJob2028,
  occurrence: pr3TargetOccurrence,
  allShifts: [],
  roster: pr3Roster,
  currentAssignedIds: [],
  previousHolderId: 'EMP-002',
  jobs: [pr3TargetJob2028, pr3JobNYE_archived_mutated], // Archived parent with mutated timing!
  customAssignments: pr3AssignmentsWithFuture
});
assert.strictEqual(rotLookup3.candidate.id, 'EMP-002',
  'Test 18b: Inactive/archived parent job must evaluate against authoritative historical snapshot and exclude rest-gap violator');
console.log('  ✔ Rotation evaluates against authoritative historical occurrence snapshot and excludes rest-gap violator.');

// 18c: Future assignments on inactive/archived jobs must be suppressed (Peer Review 04 Finding 2)
const digest2028 = window.HortOpsScheduler.generateOperationalDigest([pr3TargetJob2028, pr3JobNYE_archived_mutated], 2028, true, pr3AssignmentsWithFuture, pr3Roster);
const futureArchivedShift = digest2028.allShifts.find(function(s) { return s.jobId === 'job-pr3-nye-2027' && s.date === '2028-06-15'; });
assert.strictEqual(futureArchivedShift, undefined,
  'Test 18c: Future assignment on inactive/archived job must be suppressed from allShifts');
const futureSuppressedIssue = digest2028.integrityIssues.find(function(i) { return i.code === 'SUPPRESSED_FUTURE_INACTIVE_JOB_ASSIGNMENT'; });
assert(futureSuppressedIssue,
  'Test 18c: Integrity issue must be logged for suppressed future assignment on inactive job');
console.log('  ✔ Future assignment on inactive/archived job is properly suppressed.');

// Clean up mock historical occurrence fixture
window.HortOpsData.HISTORICAL_OCCURRENCES.pop();
delete window.HortOpsApp.state.historicalSnapshots[archivedSnapshot.shiftId];

// [19] Testing Missing Parent Job & Unknown Historical Calculations (Peer Review 04 Finding 4)
console.log('\n[19] Testing Missing Parent Job & Unknown Historical Calculations...');
// 19a: Cost calculator produces 0 cost, 0 meals, and no NaN for unverified schedules
const unverifiedShiftObj = {
  shiftId: 'ghost-job@2027-12-31',
  unverifiedSchedule: true,
  startTime: null,
  durationHours: null,
  crewSize: 2
};
const costRes = window.HortOpsCostCalculator.calculateShiftCost(unverifiedShiftObj);
assert.strictEqual(costRes.totalCost, 0, 'Test 19a: Total cost must be 0 for unverified schedule');
assert.strictEqual(costRes.laborCost, 0, 'Test 19a: Labor cost must be 0 for unverified schedule');
assert.strictEqual(costRes.mealCost, 0, 'Test 19a: Meal cost must be 0 for unverified schedule');
assert(!isNaN(costRes.averageRatePerHour), 'Test 19a: Average rate per hour must not be NaN');
console.log('  ✔ Cost calculator produces 0 cost, 0 meals, and no NaN for unverified schedule.');

// 19b: Digest preserves unverified commitment with integrity issue and slot.totalCrewHours treats as 0 without NaN
const ghostAssignments = { 'ghost-job-2027@2027-12-31': ['EMP-001'] };
const digestGhost = window.HortOpsScheduler.generateOperationalDigest([], 2027, true, ghostAssignments, pr3Roster);
const ghostShift = digestGhost.allShifts.find(function(s) { return s.jobId === 'ghost-job-2027' && s.date === '2027-12-31'; });
assert(ghostShift, 'Test 19b: Ghost shift must be preserved in allShifts');
assert.strictEqual(ghostShift.unverifiedSchedule, true, 'Test 19b: Ghost shift must have unverifiedSchedule: true');
assert.strictEqual(ghostShift.startTime, null, 'Test 19b: Ghost shift startTime must be null');
assert.strictEqual(ghostShift.durationHours, null, 'Test 19b: Ghost shift durationHours must be null');
assert(ghostShift.integrityIssue && ghostShift.integrityIssue.code === 'UNVERIFIED_HISTORICAL_SCHEDULE',
  'Test 19b: Ghost shift must have UNVERIFIED_HISTORICAL_SCHEDULE integrity issue');

const ghostSlot = digestGhost.slots.find(function(s) { return s.fridayDate === '2027-12-31'; });
assert(ghostSlot, 'Test 19b: Ghost slot must exist');
assert.strictEqual(ghostSlot.totalCrewHours, 0, 'Test 19b: Slot totalCrewHours must treat unverified shift as 0 crew hours');
assert(!isNaN(ghostSlot.totalCrewHours), 'Test 19b: Slot totalCrewHours must not be NaN');
console.log('  ✔ Slot totalCrewHours treats unverified shifts as 0 crew hours without NaN.');

// 19c: Worker with unverified schedule commitment must be excluded; fallback candidate selected
const rotLookup4 = window.HortOpsRosteringEngine.recommendRotationCandidate({
  job: pr3TargetJob2028,
  occurrence: pr3TargetOccurrence,
  allShifts: [],
  roster: pr3Roster,
  currentAssignedIds: [],
  previousHolderId: 'EMP-002',
  jobs: [pr3TargetJob2028], // ghost-job-2027 is missing!
  customAssignments: ghostAssignments
});
assert.strictEqual(rotLookup4.candidate.id, 'EMP-002',
  'Test 19c: Worker with unverified schedule commitment must be excluded; fallback candidate selected');

// 19d: Direct eligibility validation with unverified schedule fails closed
const valUnverified = window.HortOpsEligibilityEngine.validateEmployeeForOccurrence({
  employee: { id: 'EMP-001', name: 'Candidate One', team: 'Parks', status: 'active' },
  occurrence: pr3TargetOccurrence,
  allAssignments: [ghostShift]
});
assert.strictEqual(valUnverified.eligible, false, 'Test 19d: Unverified schedule commitment must fail closed');
assert.strictEqual(valUnverified.hardBlock, true, 'Test 19d: Unverified schedule must produce hardBlock');
assert(valUnverified.reasons.includes('ADJACENT_SCHEDULE_UNAVAILABLE'),
  'Test 19d: Must report ADJACENT_SCHEDULE_UNAVAILABLE');
console.log('  ✔ Missing parent job with unverified schedule fails closed without assuming free availability.');

// [20] Testing Unavailable Scheduler Facade on Boundary Date Fails Closed (Peer Review 03 Finding 3)
console.log('\n[20] Testing Unavailable Scheduler Facade on Boundary Date Fails Closed...');
const savedScheduler = window.HortOpsScheduler;
window.HortOpsScheduler = undefined;

const rotLookup5 = window.HortOpsRosteringEngine.recommendRotationCandidate({
  job: pr3TargetJob2028,
  occurrence: pr3TargetOccurrence, // 2028-01-01 is a boundary date
  allShifts: [],
  roster: pr3Roster,
  currentAssignedIds: [],
  previousHolderId: 'EMP-002'
});
assert.strictEqual(rotLookup5.candidate, null,
  'Test 20a: recommendRotationCandidate must return null candidate when scheduler is missing on boundary date');
assert(rotLookup5.reason.indexOf('ADJACENT_SCHEDULE_UNAVAILABLE') !== -1,
  'Test 20a: Reason must report ADJACENT_SCHEDULE_UNAVAILABLE');

// Restore scheduler facade
window.HortOpsScheduler = savedScheduler;
console.log('  ✔ Unavailable scheduler facade on boundary date fails closed immediately.');

// [21] Testing Boundary Cache Dynamic Invalidation on Anchor-Week Parity Change (Peer Review 04 Finding 3)
console.log('\n[21] Testing Boundary Cache Dynamic Invalidation on Anchor-Week Parity Change...');
window.HortOpsScheduler.clearBoundaryCache();
const fortnightlyJobW1 = {
  id: 'job-fortnightly-boundary',
  name: 'Fortnightly Boundary Job',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 2,
  anchorWeek: 1,
  preferredDay: 'friday',
  startTime: '10:00 PM',
  durationHours: 6,
  status: 'active'
};

// Friday 31 Dec 2027 falls in slot weekNumber 53.
// With anchorWeek: 1 (odd weeks), (53 - 1) % 2 === 0 -> occurrence IS generated on week 53!
const boundaryShifts1 = window.HortOpsScheduler.getAdjacentBoundaryShifts('2028-01-01', [fortnightlyJobW1], {}, pr3Roster);
const shiftW1 = boundaryShifts1.find(function(s) { return s.jobId === 'job-fortnightly-boundary' && s.date === '2027-12-31'; });
assert(shiftW1, 'Test 21a: anchorWeek 1 must generate occurrence on week 53 (2027-12-31)');

// Change anchorWeek to 2 (even weeks) WITHOUT calling clearBoundaryCache()
// With anchorWeek: 2, (53 - 2) % 2 === 1 -> occurrence must NOT be generated on week 53!
const fortnightlyJobW2 = Object.assign({}, fortnightlyJobW1, { anchorWeek: 2 });
const boundaryShifts2 = window.HortOpsScheduler.getAdjacentBoundaryShifts('2028-01-01', [fortnightlyJobW2], {}, pr3Roster);
const shiftW2 = boundaryShifts2.find(function(s) { return s.jobId === 'job-fortnightly-boundary' && s.date === '2027-12-31'; });
assert.strictEqual(shiftW2, undefined, 'Test 21b: Changing anchorWeek to 2 must dynamically invalidate boundary cache and suppress occurrence on 2027-12-31');
console.log('  ✔ Boundary cache dynamically invalidated on anchorWeek parity change without manual cache clearing.');

// Restore date function
window.HortOpsDateUtils.getLocalDateKey = origDateFn;

// [22] Testing Active Job Mutation & Historical Timing Protection (Peer Review 05 Finding 1)
console.log('\n[22] Testing Active Job Mutation & Historical Timing Protection...');
window.HortOpsScheduler.clearBoundaryCache();
var pr5OrigDateFn = window.HortOpsDateUtils.getLocalDateKey;
window.HortOpsDateUtils.getLocalDateKey = function() { return '2028-01-01'; };

// Initial active job scheduled 22:00 to 06:00 (8h overnight)
var activeJobOvernight = {
  id: 'job-active-overnight',
  name: 'Active Overnight Arterial',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  preferredDay: 'friday',
  startTime: '22:00',
  durationHours: 8,
  crewSize: 1,
  status: 'active'
};

// EMP-001 worked this shift on 2027-12-31 and snapshot was recorded in workspace
var pr5Snapshots = {
  'job-active-overnight@2027-12-31': {
    shiftId: 'job-active-overnight@2027-12-31',
    jobId: 'job-active-overnight',
    date: '2027-12-31',
    startTime: '22:00',
    durationHours: 8,
    crewSize: 1,
    assignedStaffIds: ['EMP-001'],
    recordedAt: '2027-12-30T10:00:00Z',
    recordType: 'scheduled_commitment'
  }
};
var pr5Assignments = {
  'job-active-overnight@2027-12-31': ['EMP-001']
};

// Now active job is MUTATED in the job registry: startTime changed to '08:00', durationHours to 2 (still active!)
var activeJobMutated = Object.assign({}, activeJobOvernight, {
  startTime: '08:00',
  durationHours: 2
});

// Target morning shift on 2028-01-01 at 07:00 (requires 10h rest gap: overnight shift ending 06:00 gives only 1h rest gap!)
// Note: If the past shift had used mutated timing (08:00-10:00 on Dec 31), EMP-001 would have had 21h rest and been eligible!
// But under authoritative snapshot protection, the original 22:00-06:00 is enforced, so EMP-001 has only 1h rest.
var pr5MorningJob = {
  id: 'job-morning-2028',
  name: 'Morning Maintenance 2028',
  frequencyType: 'one_off',
  targetDate: '2028-01-01',
  startTime: '07:00',
  durationHours: 4,
  crewSize: 1,
  status: 'active'
};
var pr5MorningOccurrence = {
  shiftId: 'job-morning-2028@2028-01-01',
  jobId: 'job-morning-2028',
  date: '2028-01-01',
  startTime: '07:00',
  durationHours: 4,
  crewSize: 1
};

// Generate adjacent boundary shifts for 2028-01-01 with mutated job and snapshots
var boundaryShiftsPr5 = window.HortOpsScheduler.getAdjacentBoundaryShifts(
  '2028-01-01',
  [activeJobMutated, pr5MorningJob],
  pr5Assignments,
  pr3Roster,
  pr5Snapshots
);
var boundaryPastShift = boundaryShiftsPr5.find(function(s) {
  return s.jobId === 'job-active-overnight' && s.date === '2027-12-31';
});
assert(boundaryPastShift, 'Test 22a: Past boundary shift on active job must be found');
assert.strictEqual(boundaryPastShift.startTime, '22:00', 'Test 22a: Past shift must enforce recorded snapshot startTime (22:00), not mutated job startTime (08:00)');
assert.strictEqual(boundaryPastShift.durationHours, 8, 'Test 22a: Past shift must enforce recorded snapshot durationHours (8), not mutated job durationHours (2)');
assert.strictEqual(boundaryPastShift.unverifiedSchedule, false, 'Test 22a: Verified snapshot must not be unverified');
console.log('  ✔ Active job past occurrence retains authoritative snapshot timing despite parent job mutation.');

// Evaluate rotation candidate: EMP-001 must be excluded due to INSUFFICIENT_REST (< 10h), EMP-002 selected
var rotLookupPr5 = window.HortOpsRosteringEngine.recommendRotationCandidate({
  job: pr5MorningJob,
  occurrence: pr5MorningOccurrence,
  allShifts: [],
  roster: pr3Roster,
  currentAssignedIds: [],
  previousHolderId: 'EMP-002',
  jobs: [activeJobMutated, pr5MorningJob],
  customAssignments: pr5Assignments,
  historicalSnapshots: pr5Snapshots
});
assert(rotLookupPr5 && rotLookupPr5.candidate, 'Test 22b: Rotation recommendation must return an eligible candidate');
assert.strictEqual(rotLookupPr5.candidate.id, 'EMP-002', 'Test 22b: EMP-001 must be excluded due to rest-gap violation against snapshot timing; EMP-002 selected');
console.log('  ✔ Rotation recommendation excludes rest-gap violator on active mutated job using authoritative snapshot.');

// [23] Testing Archive Parent Job Historical Protection & Suppression (Peer Review 05 Finding 1)
console.log('\n[23] Testing Archive Parent Job Historical Protection & Suppression...');
window.HortOpsScheduler.clearBoundaryCache();

// Parent job is now archived
var archivedJob = Object.assign({}, activeJobOvernight, {
  status: 'archived'
});

// A future assignment on the archived job
var archivedAssignments = Object.assign({}, pr5Assignments, {
  'job-active-overnight@2028-01-07': ['EMP-001']
});

var digestArchived = window.HortOpsScheduler.generateOperationalDigest(
  [archivedJob, pr5MorningJob],
  2027,
  true,
  archivedAssignments,
  pr3Roster,
  null,
  pr5Snapshots
);
var pastArchivedShift = digestArchived.allShifts.find(function(s) {
  return s.jobId === 'job-active-overnight' && s.date === '2027-12-31';
});
assert(pastArchivedShift, 'Test 23a: Past shift on archived job must be preserved');
assert.strictEqual(pastArchivedShift.startTime, '22:00', 'Test 23a: Past shift on archived job must retain snapshot startTime');
assert.strictEqual(pastArchivedShift.durationHours, 8, 'Test 23a: Past shift on archived job must retain snapshot durationHours');

// Future 2028 digest: unworked future assignment on archived job must be suppressed
var digestArchived2028 = window.HortOpsScheduler.generateOperationalDigest(
  [archivedJob, pr5MorningJob],
  2028,
  true,
  archivedAssignments,
  pr3Roster,
  null,
  pr5Snapshots
);
var futureArchivedShift23 = digestArchived2028.allShifts.find(function(s) {
  return s.jobId === 'job-active-overnight' && s.date === '2028-01-07';
});
assert.strictEqual(futureArchivedShift23, undefined, 'Test 23b: Future assignment on archived job must be suppressed from operational schedule');
console.log('  ✔ Historical snapshot preserved on archived job and future unworked occurrences suppressed.');

// [24] Testing Past Assignment on Active Job Without Authoritative Snapshot Fails Closed (Peer Review 05 Finding 1)
console.log('\n[24] Testing Past Assignment on Active Job Without Authoritative Snapshot Fails Closed...');
window.HortOpsScheduler.clearBoundaryCache();

// Active job with past assignment, but NO snapshot provided and NO entry in HISTORICAL_OCCURRENCES
var boundaryShiftsNoSnap = window.HortOpsScheduler.getAdjacentBoundaryShifts(
  '2028-01-01',
  [activeJobOvernight, pr5MorningJob],
  pr5Assignments,
  pr3Roster,
  {}
);
var unverifiedShift = boundaryShiftsNoSnap.find(function(s) {
  return s.jobId === 'job-active-overnight' && s.date === '2027-12-31';
});
assert(unverifiedShift, 'Test 24a: Shift must exist in boundary shifts');
assert.strictEqual(unverifiedShift.unverifiedSchedule, true, 'Test 24a: Active job past assignment without snapshot must be unverifiedSchedule: true');
assert.strictEqual(unverifiedShift.startTime, null, 'Test 24a: unverifiedShift startTime must be null');
assert.strictEqual(unverifiedShift.durationHours, null, 'Test 24a: unverifiedShift durationHours must be null');

// Direct employee eligibility check must fail closed with ADJACENT_SCHEDULE_UNAVAILABLE
var valUnverifiedActive = window.HortOpsEligibilityEngine.validateEmployeeForOccurrence({
  employee: { id: 'EMP-001', name: 'Candidate One', team: 'Parks', status: 'active' },
  occurrence: pr5MorningOccurrence,
  allAssignments: [unverifiedShift]
});
assert.strictEqual(valUnverifiedActive.eligible, false, 'Test 24b: Eligibility must fail closed for unverified schedule on active job');
assert.strictEqual(valUnverifiedActive.hardBlock, true, 'Test 24b: Must produce hardBlock');
assert(valUnverifiedActive.reasons.includes('ADJACENT_SCHEDULE_UNAVAILABLE'), 'Test 24b: Must include ADJACENT_SCHEDULE_UNAVAILABLE');
console.log('  ✔ Past assignment on active job without snapshot marks unverifiedSchedule and fails closed.');

// [25] Testing Boundary Cache Dynamic Invalidation on Historical Snapshot and Midnight Rollover (Peer Review 05 Finding 2)
console.log('\n[25] Testing Boundary Cache Dynamic Invalidation on Historical Snapshot and Midnight Rollover...');
window.HortOpsScheduler.clearBoundaryCache();
window.HortOpsDateUtils.getLocalDateKey = function() { return '2027-12-31'; };

var cacheTestSnapshots = {};
// 1. Initial call without snapshot
var cacheRes1 = window.HortOpsScheduler.getAdjacentBoundaryShifts(
  '2028-01-01',
  [activeJobOvernight],
  pr5Assignments,
  pr3Roster,
  cacheTestSnapshots
);
var cShift1 = cacheRes1.find(function(s) { return s.date === '2027-12-31'; });
assert.strictEqual(!!cShift1.unverifiedSchedule, false, 'Test 25a: Today shift is not past unverified');

// 2. Midnight Rollover to 2028-01-01 WITHOUT calling clearBoundaryCache()
// Now 2027-12-31 is in the past! Because cacheTestSnapshots is empty, it must dynamically recalculate (cache miss due to todayStr in cacheKey)
// and now mark unverifiedSchedule: true!
window.HortOpsDateUtils.getLocalDateKey = function() { return '2028-01-01'; };
var cacheRes2 = window.HortOpsScheduler.getAdjacentBoundaryShifts(
  '2028-01-01',
  [activeJobOvernight],
  pr5Assignments,
  pr3Roster,
  cacheTestSnapshots
);
var cShift2 = cacheRes2.find(function(s) { return s.date === '2027-12-31'; });
assert.strictEqual(cShift2.unverifiedSchedule, true, 'Test 25b: Midnight rollover to 2028-01-01 dynamically invalidates cache; shift is now past unverified');

// 3. Add snapshot to cacheTestSnapshots WITHOUT calling clearBoundaryCache()
// Next call must dynamically recalculate (cache miss due to histSig in cacheKey) and use snapshot timing!
cacheTestSnapshots['job-active-overnight@2027-12-31'] = {
  shiftId: 'job-active-overnight@2027-12-31',
  jobId: 'job-active-overnight',
  date: '2027-12-31',
  startTime: '23:00',
  durationHours: 7,
  crewSize: 1,
  assignedStaffIds: ['EMP-001'],
  recordedAt: '2027-12-31T20:00:00Z',
  recordType: 'scheduled_commitment'
};
var cacheRes3 = window.HortOpsScheduler.getAdjacentBoundaryShifts(
  '2028-01-01',
  [activeJobOvernight],
  pr5Assignments,
  pr3Roster,
  cacheTestSnapshots
);
var cShift3 = cacheRes3.find(function(s) { return s.date === '2027-12-31'; });
assert.strictEqual(cShift3.unverifiedSchedule, false, 'Test 25c: Adding snapshot dynamically invalidates cache; shift is now verified');
assert.strictEqual(cShift3.startTime, '23:00', 'Test 25c: Shift reflects new snapshot startTime');
assert.strictEqual(cShift3.durationHours, 7, 'Test 25c: Shift reflects new snapshot durationHours');
console.log('  ✔ Boundary cache dynamically invalidates on midnight date rollover and historical snapshot addition.');

// [26] Testing Historical Snapshots Schema v2 Persistence Round-Trip & Rejection...
console.log('\n[26] Testing Historical Snapshots Schema v2 Persistence Round-Trip & Rejection...');

var validEnvelope = {
  schemaVersion: 2,
  savedAt: '2028-01-01T00:00:00Z',
  currentYear: 2028,
  jobs: [
    Object.assign({}, activeJobOvernight, { anchorDate: '2027-01-01' })
  ],
  roster: pr3Roster,
  assignments: pr5Assignments,
  customPermits: {},
  historicalSnapshots: {
    'job-active-overnight@2027-12-31': {
      shiftId: 'job-active-overnight@2027-12-31',
      jobId: 'job-active-overnight',
      date: '2027-12-31',
      startTime: '22:00',
      durationHours: 8,
      crewSize: 1,
      assignedStaffIds: ['EMP-001'],
      recordedAt: '2027-12-30T10:00:00Z',
      recordType: 'scheduled_commitment'
    }
  },
  rostering: { instructions: {}, provenance: {} },
  activeFilters: {}
};

// 1. Validate envelope directly
var valEnv = window.HortOpsSchemaValidator.validate(validEnvelope);
assert.strictEqual(valEnv.valid, true, 'Test 26a: Valid envelope with historicalSnapshots must pass schema validation');

// 2. Corrupt durationHours (string instead of finite positive number)
var corruptDurationEnv = JSON.parse(JSON.stringify(validEnvelope));
corruptDurationEnv.historicalSnapshots['job-active-overnight@2027-12-31'].durationHours = 'invalid_hours';
var valCorruptDuration = window.HortOpsSchemaValidator.validate(corruptDurationEnv);
assert.strictEqual(valCorruptDuration.valid, false, 'Test 26b: Corrupted durationHours in snapshot must fail validation');

// 3. Corrupt assignedStaffIds (non-array)
var corruptStaffEnv = JSON.parse(JSON.stringify(validEnvelope));
corruptStaffEnv.historicalSnapshots['job-active-overnight@2027-12-31'].assignedStaffIds = 'EMP-001';
var valCorruptStaff = window.HortOpsSchemaValidator.validate(corruptStaffEnv);
assert.strictEqual(valCorruptStaff.valid, false, 'Test 26c: Corrupted assignedStaffIds in snapshot must fail validation');

// 4. Corrupt historicalSnapshots root (array instead of map)
var corruptRootEnv = JSON.parse(JSON.stringify(validEnvelope));
corruptRootEnv.historicalSnapshots = [1, 2, 3];
var valCorruptRoot = window.HortOpsSchemaValidator.validate(corruptRootEnv);
assert.strictEqual(valCorruptRoot.valid, false, 'Test 26d: Non-object historicalSnapshots root must fail validation');

// 5. Persistence save/reload round-trip
var saveRes = window.HortOpsStorage.saveWorkspace(validEnvelope);
assert.strictEqual(saveRes.ok, true, 'Test 26e: Storage saveWorkspace must succeed for valid historicalSnapshots envelope');
var loadedEnv = window.HortOpsStorage.loadWorkspace();
assert(loadedEnv && loadedEnv.historicalSnapshots, 'Test 26e: Loaded workspace must contain historicalSnapshots');
assert(loadedEnv.historicalSnapshots['job-active-overnight@2027-12-31'], 'Test 26e: Snapshot must survive save/load round-trip');
assert.strictEqual(loadedEnv.historicalSnapshots['job-active-overnight@2027-12-31'].startTime, '22:00', 'Test 26e: Snapshot startTime must match');
assert.strictEqual(loadedEnv.historicalSnapshots['job-active-overnight@2027-12-31'].durationHours, 8, 'Test 26e: Snapshot durationHours must match');
assert.deepStrictEqual(loadedEnv.historicalSnapshots['job-active-overnight@2027-12-31'].assignedStaffIds, ['EMP-001'], 'Test 26e: Snapshot assignedStaffIds must match');

// 6. Saving corrupted payload must fail and keep previous valid storage intact
var saveCorruptedRes = window.HortOpsStorage.saveWorkspace(corruptDurationEnv);
assert.strictEqual(saveCorruptedRes.ok, false, 'Test 26f: Saving corrupted snapshot payload must return ok: false and fail closed');
var reloadedAfterCorrupt = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(reloadedAfterCorrupt.historicalSnapshots['job-active-overnight@2027-12-31'].durationHours, 8, 'Test 26f: Valid stored workspace must remain untouched after rejected corrupt save');

// Restore date function
window.HortOpsDateUtils.getLocalDateKey = pr5OrigDateFn;
console.log('  ✔ Historical snapshots Schema v2 persistence round-trip and validation rejection verified.');

console.log('\n=============================================================');
console.log('ALL 26 OFFLINE17 ROSTERING TEST SUITES PASSED (100% COMPLIANT)');
console.log('=============================================================\n');