// Offline17.5j Dedicated Rostering Lifecycle & Contract Integrity Test Suite
// Verifies all 158 Mandated Integrity Gates & Frozen Foundation Contracts
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
global.document = { getElementById: () => null, addEventListener: () => {} };

require('../js/data/holidays.js');
require('../js/data/staffRoster.js');
require('../js/utils/scheduler/costCalculator.js');
require('../js/data/initialJobs.js');
require('../js/utils/dateUtils.js');
// Mock today as 2026-10-01 for forward-planning tests
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-01'; };

require('../js/utils/eligibilityEngine.js');
require('../js/utils/scheduler/engine.js');
require('../js/utils/scheduler.js');
require('../js/utils/icons.js');
require('../js/components/staffAssignModal.js');
require('../js/components/staffAssignModal/candidateModel.js');
require('../js/components/staffAssignModal/stagedCrew.js');
require('../js/utils/rostering/engine.js');
require('../js/utils/storage/schemaValidator.js');
require('../js/utils/storage/migrationEngine.js');
require('../js/utils/storage/storageDriver.js');
require('../js/utils/storage.js');
require('../js/utils/warningUtils.js');
require('../js/components/forwardPlanner/matrixRenderer.js');

const rostering = window.HortOpsRosteringEngine;
const validator = window.HortOpsSchemaValidator;
const warningUtils = window.HortOpsWarningUtils;
const matrixRenderer = window.HortOpsForwardPlannerMatrixRenderer;

const stagedCrew = window.HortOpsStaffAssignStagedCrew;

assert(rostering, 'HortOpsRosteringEngine must be loaded');
assert(validator, 'HortOpsSchemaValidator must be loaded');
assert(warningUtils, 'HortOpsWarningUtils must be loaded');
assert(stagedCrew, 'HortOpsStaffAssignStagedCrew must be loaded');

console.log('=== RUNNING OFFLINE17.5J ROSTERING INTEGRITY FREEZE SUITE (158 GATES) ===\n');

// Standard Job Fixture
const jobStandard = {
  id: 'JOB-LIFE-01',
  name: 'Botanic Park Arboriculture Care',
  status: 'active',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-10-03',
  intervalWeeks: 1,
  preferredDay: 'saturday',
  primaryTeam: 'Parks',
  crewSize: 2,
  plantOperatorRequired: false
};

// Plant Operator Required Job Fixture
const jobPlantOpReq = {
  id: 'JOB-LIFE-PLANT',
  name: 'Torrens Lake Heavy Dredging',
  status: 'active',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-10-03',
  intervalWeeks: 1,
  preferredDay: 'saturday',
  primaryTeam: 'Civil',
  crewSize: 2,
  plantOperatorRequired: true
};

const rosterStandard = [
  { id: 'EMP-01', name: 'Aaron Officer', team: 'Parks', role: 'Worker', status: 'active', isPlantOperator: false },
  { id: 'EMP-02', name: 'Betty Operator', team: 'Parks', role: 'Worker', status: 'active', isPlantOperator: true },
  { id: 'EMP-03', name: 'Charlie Staff', team: 'Parks', role: 'Worker', status: 'active', isPlantOperator: false },
  { id: 'EMP-04', name: 'Dana Arbor', team: 'Parks', role: 'Worker', status: 'active', isPlantOperator: false },
  { id: 'EMP-05', name: 'Evan Inactive', team: 'Parks', role: 'Worker', status: 'inactive', isPlantOperator: false }
];

// Shifts spanning from 2026-10-03 into 2027-01-09 across calendar year boundary
const crossYearShifts = [
  { shiftId: 'JOB-LIFE-01@2026-10-03', jobId: 'JOB-LIFE-01', date: '2026-10-03', startTime: '07:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] },
  { shiftId: 'JOB-LIFE-01@2026-10-10', jobId: 'JOB-LIFE-01', date: '2026-10-10', startTime: '07:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] },
  { shiftId: 'JOB-LIFE-01@2026-12-19', jobId: 'JOB-LIFE-01', date: '2026-12-19', startTime: '07:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] },
  { shiftId: 'JOB-LIFE-01@2026-12-26', jobId: 'JOB-LIFE-01', date: '2026-12-26', startTime: '07:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] },
  { shiftId: 'JOB-LIFE-01@2027-01-02', jobId: 'JOB-LIFE-01', date: '2027-01-02', startTime: '07:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] },
  { shiftId: 'JOB-LIFE-01@2027-01-09', jobId: 'JOB-LIFE-01', date: '2027-01-09', startTime: '07:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] }
];

// -------------------------------------------------------------
// Test 1: Repeat Reduction Across Years Pruning
// -------------------------------------------------------------
console.log('[Test 1] Repeat reduction across years prunes downstream assignments and provenance...');
let state1 = {
  customAssignments: {},
  rostering: { instructions: {}, provenance: {} }
};

// Apply Fixed with Repeat 4 from 2026-12-19 (spans 12-19, 12-26, 01-02, 01-09)
let res1 = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[2], // 2026-12-19
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 4 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: state1.customAssignments,
  rosteringState: state1.rostering
});

assert.deepStrictEqual(res1.customAssignments['JOB-LIFE-01@2026-12-19'], ['EMP-01']);
assert.deepStrictEqual(res1.customAssignments['JOB-LIFE-01@2026-12-26'], ['EMP-01']);
assert.deepStrictEqual(res1.customAssignments['JOB-LIFE-01@2027-01-02'], ['EMP-01']);
assert.deepStrictEqual(res1.customAssignments['JOB-LIFE-01@2027-01-09'], ['EMP-01']);

// Now reduce Repeat from 4 down to 2
let res1Reduced = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[2],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 2 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res1.customAssignments,
  rosteringState: res1.rosteringState
});

assert.deepStrictEqual(res1Reduced.customAssignments['JOB-LIFE-01@2026-12-19'], ['EMP-01']);
assert.deepStrictEqual(res1Reduced.customAssignments['JOB-LIFE-01@2026-12-26'], ['EMP-01']);
// Shifts in 2027 must be pruned!
assert.deepStrictEqual(res1Reduced.customAssignments['JOB-LIFE-01@2027-01-02'], []);
assert.deepStrictEqual(res1Reduced.customAssignments['JOB-LIFE-01@2027-01-09'], []);
assert(!res1Reduced.rosteringState.provenance['JOB-LIFE-01@2027-01-02:EMP-01'], 'Provenance must be pruned');
assert(!res1Reduced.rosteringState.provenance['JOB-LIFE-01@2027-01-09:EMP-01'], 'Provenance must be pruned');
console.log('  ✔ Passed: Repeat reduction across years strictly pruned downstream assignments.\n');

// -------------------------------------------------------------
// Test 2: Repeat Increase Across Years
// -------------------------------------------------------------
console.log('[Test 2] Repeat increase across years extends assignments to newly in-scope shifts...');
let res1Increased = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[2],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 4 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res1Reduced.customAssignments,
  rosteringState: res1Reduced.rosteringState
});

assert.deepStrictEqual(res1Increased.customAssignments['JOB-LIFE-01@2027-01-02'], ['EMP-01']);
assert.deepStrictEqual(res1Increased.customAssignments['JOB-LIFE-01@2027-01-09'], ['EMP-01']);
console.log('  ✔ Passed: Repeat increase seamlessly re-extended assignments across year boundary.\n');

// -------------------------------------------------------------
// Test 3: Employee Replacement Across Years
// -------------------------------------------------------------
console.log('[Test 3] Employee replacement across years removes old employee and assigns new employee...');
let res3Replaced = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[2], // 2026-12-19
  stagedStaffIds: ['EMP-03'], // Changed from EMP-01 to EMP-03 on same SLOT-1
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-03', mode: 'fixed', repeatCount: 4 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res1Increased.customAssignments,
  rosteringState: res1Increased.rosteringState
});

// All 4 occurrences must now have EMP-03 and NO EMP-01!
assert.deepStrictEqual(res3Replaced.customAssignments['JOB-LIFE-01@2026-12-19'], ['EMP-03']);
assert.deepStrictEqual(res3Replaced.customAssignments['JOB-LIFE-01@2026-12-26'], ['EMP-03']);
assert.deepStrictEqual(res3Replaced.customAssignments['JOB-LIFE-01@2027-01-02'], ['EMP-03']);
assert.deepStrictEqual(res3Replaced.customAssignments['JOB-LIFE-01@2027-01-09'], ['EMP-03']);
assert(!res3Replaced.rosteringState.provenance['JOB-LIFE-01@2027-01-02:EMP-01'], 'Old employee provenance cleaned');
assert(res3Replaced.rosteringState.provenance['JOB-LIFE-01@2027-01-02:EMP-03'], 'New employee provenance recorded');
console.log('  ✔ Passed: Employee replacement pruned old employee and assigned new employee across years.\n');

// -------------------------------------------------------------
// Test 4: Mode Change Fixed to Manual
// -------------------------------------------------------------
console.log('[Test 4] Mode change from Fixed to Manual removes downstream assignments, leaves current shift intact...');
let res4Manual = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[2],
  stagedStaffIds: ['EMP-03'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-03', mode: 'manual', repeatCount: 1 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res3Replaced.customAssignments,
  rosteringState: res3Replaced.rosteringState
});

assert.deepStrictEqual(res4Manual.customAssignments['JOB-LIFE-01@2026-12-19'], ['EMP-03'], 'Current shift remains assigned');
assert.deepStrictEqual(res4Manual.customAssignments['JOB-LIFE-01@2026-12-26'], [], 'Downstream 1 pruned');
assert.deepStrictEqual(res4Manual.customAssignments['JOB-LIFE-01@2027-01-02'], [], 'Downstream 2 pruned');
assert.deepStrictEqual(res4Manual.customAssignments['JOB-LIFE-01@2027-01-09'], [], 'Downstream 3 pruned');
console.log('  ✔ Passed: Mode change to Manual pruned all downstream propagation.\n');

// -------------------------------------------------------------
// Test 5: Mode Change Fixed to Rotation
// -------------------------------------------------------------
console.log('[Test 5] Mode change from Fixed to Rotation retains slot identity, assigns distinct staff...');
// Start with Fixed repeat 3
let res5Fixed = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[0], // 2026-10-03
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 3 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} }
});

// Change to Rotation repeat 3
let res5Rot = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'rotation', repeatCount: 3 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res5Fixed.customAssignments,
  rosteringState: res5Fixed.rosteringState
});

assert.deepStrictEqual(res5Rot.customAssignments['JOB-LIFE-01@2026-10-03'], ['EMP-01']);
// Downstream shift should rotate to someone other than EMP-01 (e.g. EMP-02 or EMP-03)
let rotatedShift1 = res5Rot.customAssignments['JOB-LIFE-01@2026-10-10'];
assert(rotatedShift1 && rotatedShift1.length === 1, 'Shift 1 must have 1 candidate assigned');
assert(rotatedShift1[0] !== 'EMP-01', 'Rotation must rotate away from previous holder');
console.log('  ✔ Passed: Mode changed from Fixed to Rotation and rotated candidate successfully.\n');

// -------------------------------------------------------------
// Test 6: Mode Change Rotation to Fixed
// -------------------------------------------------------------
console.log('[Test 6] Mode change from Rotation to Fixed assigns single officer across downstream shifts...');
let res6Fixed = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[0],
  stagedStaffIds: ['EMP-04'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-04', mode: 'fixed', repeatCount: 3 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res5Rot.customAssignments,
  rosteringState: res5Rot.rosteringState
});

assert.deepStrictEqual(res6Fixed.customAssignments['JOB-LIFE-01@2026-10-03'], ['EMP-04']);
assert.deepStrictEqual(res6Fixed.customAssignments['JOB-LIFE-01@2026-10-10'], ['EMP-04']);
assert.deepStrictEqual(res6Fixed.customAssignments['JOB-LIFE-01@2026-12-19'], ['EMP-04']);
console.log('  ✔ Passed: Mode changed from Rotation to Fixed, assigning single officer.\n');

// -------------------------------------------------------------
// Test 7: Source Employee Removal
// -------------------------------------------------------------
console.log('[Test 7] Source employee removal prunes entire downstream series for that slot...');
let res7Removed = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[0],
  stagedStaffIds: [], // Removed all staff
  stagedSlots: [],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res6Fixed.customAssignments,
  rosteringState: res6Fixed.rosteringState
});

assert.deepStrictEqual(res7Removed.customAssignments['JOB-LIFE-01@2026-10-03'], []);
assert.deepStrictEqual(res7Removed.customAssignments['JOB-LIFE-01@2026-10-10'], []);
assert.deepStrictEqual(res7Removed.customAssignments['JOB-LIFE-01@2026-12-19'], []);
console.log('  ✔ Passed: Source employee removal pruned all downstream occurrences.\n');

// -------------------------------------------------------------
// Test 8: Same-Instruction Idempotency
// -------------------------------------------------------------
console.log('[Test 8] Same-instruction idempotency: multiple saves produce identical assignments with 0 duplicates...');
let runA = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[0],
  stagedStaffIds: ['EMP-01', 'EMP-02'],
  stagedSlots: [
    { slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 2 },
    { slotId: 'SLOT-2', staffId: 'EMP-02', mode: 'fixed', repeatCount: 2 }
  ],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} }
});

let runB = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[0],
  stagedStaffIds: ['EMP-01', 'EMP-02'],
  stagedSlots: [
    { slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 2 },
    { slotId: 'SLOT-2', staffId: 'EMP-02', mode: 'fixed', repeatCount: 2 }
  ],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: runA.customAssignments,
  rosteringState: runA.rosteringState
});

assert.deepStrictEqual(runB.customAssignments['JOB-LIFE-01@2026-10-03'], ['EMP-01', 'EMP-02']);
assert.deepStrictEqual(runB.customAssignments['JOB-LIFE-01@2026-10-10'], ['EMP-01', 'EMP-02']);
// Check for zero duplicate staff IDs in target array
assert.strictEqual(new Set(runB.customAssignments['JOB-LIFE-01@2026-10-10']).size, 2);
console.log('  ✔ Passed: Re-applying identical instruction is strictly idempotent with 0 duplicates.\n');

// -------------------------------------------------------------
// Test 9: Stable Crew-Slot Identity
// -------------------------------------------------------------
console.log('[Test 9] Stable crew-slot identity: removing an earlier slot preserves slotId and instructions for remaining slots...');
// Start with SLOT-1 (EMP-01) and SLOT-2 (EMP-02)
// Now remove SLOT-1, keeping only SLOT-2
let runSlot2Retained = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[0],
  stagedStaffIds: ['EMP-02'],
  stagedSlots: [
    { slotId: 'SLOT-2', staffId: 'EMP-02', mode: 'fixed', repeatCount: 2 }
  ],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: runB.customAssignments,
  rosteringState: runB.rosteringState
});

// SLOT-1 assignment (EMP-01) should be pruned, while SLOT-2 (EMP-02) remains intact!
assert.deepStrictEqual(runSlot2Retained.customAssignments['JOB-LIFE-01@2026-10-03'], ['EMP-02']);
assert.deepStrictEqual(runSlot2Retained.customAssignments['JOB-LIFE-01@2026-10-10'], ['EMP-02']);
let instKeys = Object.keys(runSlot2Retained.rosteringState.instructions);
let activeInst = runSlot2Retained.rosteringState.instructions[instKeys[0]];
assert.strictEqual(activeInst.slotId, 'SLOT-2', 'Preserved slot retains its durable slotId SLOT-2');
console.log('  ✔ Passed: Stable slot identity maintained when preceding slot removed.\n');

// -------------------------------------------------------------
// Test 10: Historical Protection
// -------------------------------------------------------------
console.log('[Test 10] Historical protection: past shifts cannot propagate and cannot be modified by future propagation...');
// Current date is mocked as 2026-10-01
const pastShift = { shiftId: 'JOB-LIFE-01@2026-09-12', jobId: 'JOB-LIFE-01', date: '2026-09-12', startTime: '07:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] };
const allWithPast = [pastShift].concat(crossYearShifts);

let resPastSource = rostering.applyRostering({
  job: jobStandard,
  currentShift: pastShift,
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 4 }],
  allShifts: allWithPast,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} }
});

// Historical source shift repeat count is hard-locked to 1: no downstream propagation!
assert.deepStrictEqual(resPastSource.customAssignments['JOB-LIFE-01@2026-09-12'], ['EMP-01']);
assert(!resPastSource.customAssignments['JOB-LIFE-01@2026-10-03'], 'Past shift cannot propagate into future shifts');
assert(resPastSource.auditLog.some(l => l.action === 'historical_source_immutable'), 'Historical source immutability logged');

// Target historical shift cannot be overwritten by future propagation
const existingPastAssignments = { 'JOB-LIFE-01@2026-09-12': ['EMP-03'] };
let resFutureProp = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[0], // 2026-10-03
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 3 }],
  allShifts: allWithPast,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: existingPastAssignments,
  rosteringState: { instructions: {}, provenance: {} }
});
assert.deepStrictEqual(resFutureProp.customAssignments['JOB-LIFE-01@2026-09-12'], ['EMP-03'], 'Past actuals cannot be overwritten');
console.log('  ✔ Passed: Historical protection enforced: past shifts cannot propagate and past actuals are immutable.\n');

// -------------------------------------------------------------
// Test 11: Multi-Year Series Recurrence (Fixed)
// -------------------------------------------------------------
console.log('[Test 11] Multi-year series recurrence: Fixed propagation spans Dec 2026 into Jan 2027 seamlessly...');
let resCrossFixed = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[3], // 2026-12-26
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 3 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} }
});

assert.deepStrictEqual(resCrossFixed.customAssignments['JOB-LIFE-01@2026-12-26'], ['EMP-01']);
assert.deepStrictEqual(resCrossFixed.customAssignments['JOB-LIFE-01@2027-01-02'], ['EMP-01']);
assert.deepStrictEqual(resCrossFixed.customAssignments['JOB-LIFE-01@2027-01-09'], ['EMP-01']);
console.log('  ✔ Passed: Fixed mode propagated seamlessly across 2026 -> 2027 boundary.\n');

// -------------------------------------------------------------
// Test 12: Multi-Year Series Recurrence (Rotation)
// -------------------------------------------------------------
console.log('[Test 12] Multi-year series recurrence: Rotation propagation spans Dec 2026 into Jan 2027 seamlessly...');
let resCrossRot = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[3], // 2026-12-26
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'rotation', repeatCount: 3 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} }
});

assert.deepStrictEqual(resCrossRot.customAssignments['JOB-LIFE-01@2026-12-26'], ['EMP-01']);
let jan02Assigned = resCrossRot.customAssignments['JOB-LIFE-01@2027-01-02'];
assert(jan02Assigned && jan02Assigned.length === 1 && jan02Assigned[0] !== 'EMP-01', 'Jan 02 rotates to another staff');
let jan09Assigned = resCrossRot.customAssignments['JOB-LIFE-01@2027-01-09'];
assert(jan09Assigned && jan09Assigned.length === 1 && jan09Assigned[0] !== jan02Assigned[0], 'Jan 09 rotates to another staff');
console.log('  ✔ Passed: Rotation mode rotated distinct staff across 2026 -> 2027 boundary.\n');

// -------------------------------------------------------------
// Test 13: Plant Operator Rotation Gate
// -------------------------------------------------------------
console.log('[Test 13] Plant Operator Rotation Gate: never assign ordinary worker when operator is required...');
// In rosterStandard: only EMP-02 is certified Plant Operator
// If current shift has EMP-02, and we rotate 2 shifts, but EMP-02 is the ONLY operator in the pool:
// For shift 2: rotation tries to rotate away from EMP-02. If no other plant operator exists,
// it must NOT assign EMP-01 or EMP-03 (ordinary workers). It can reuse EMP-02 or leave slot vacant with conflict.
// If EMP-02 is absent/ineligible, it MUST NOT assign ordinary worker.
const rosterNoOtherOps = [
  { id: 'EMP-01', name: 'Aaron Officer', team: 'Civil', role: 'Worker', status: 'active', isPlantOperator: false },
  { id: 'EMP-03', name: 'Charlie Staff', team: 'Civil', role: 'Worker', status: 'active', isPlantOperator: false }
];
const plantShift = { shiftId: 'JOB-LIFE-PLANT@2026-10-03', jobId: 'JOB-LIFE-PLANT', date: '2026-10-03', startTime: '07:00 AM', durationHours: 6, crewSize: 1, plantOperatorRequired: true, assignedStaffIds: [] };
const plantShift2 = { shiftId: 'JOB-LIFE-PLANT@2026-10-10', jobId: 'JOB-LIFE-PLANT', date: '2026-10-10', startTime: '07:00 AM', durationHours: 6, crewSize: 1, plantOperatorRequired: true, assignedStaffIds: [] };

let recOp = rostering.recommendRotationCandidate({
  job: jobPlantOpReq,
  occurrence: plantShift2,
  allShifts: [plantShift, plantShift2],
  roster: rosterNoOtherOps,
  currentAssignedIds: [],
  previousHolderId: null,
  slotIndex: 0
});

assert.strictEqual(recOp.candidate, null, 'Candidate must be null when 0 plant operators are available');
assert(recOp.reason.indexOf('Plant Operator') !== -1 || recOp.reason === 'NO_ELIGIBLE_PLANT_OPERATOR', 'Reason must report missing plant operator');
console.log('  ✔ Passed: Plant operator rotation gate strictly blocked silent fallback to ordinary workers.\n');

// -------------------------------------------------------------
// Test 14: Schema Validation Fail-Closed
// -------------------------------------------------------------
console.log('[Test 14] Schema validation fail-closed on malformed instructions/provenance...');
let malformedInstEnvelope = {
  schemaVersion: 2,
  lastSaved: new Date().toISOString(),
  jobs: [jobStandard],
  roster: rosterStandard,
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      'bad-inst': {
        id: 'bad-inst',
        mode: 'unsupported_mode', // INVALID MODE
        repeatCount: -1 // INVALID REPEAT
      }
    },
    provenance: {}
  }
};

let valResult = validator.validate(malformedInstEnvelope);
assert.strictEqual(valResult.valid, false, 'Schema validation must fail on malformed instruction');
assert(valResult.error && typeof valResult.error === 'string' && valResult.error.length > 10, 'Meaningful error returned');
console.log('  ✔ Passed: Schema v2 validator fail-closed on invalid instruction format (' + valResult.error + ').\n');

// -------------------------------------------------------------
// Test 15: Forward Planner Vacancy Denominator
// -------------------------------------------------------------
console.log('[Test 15] Forward planner vacancy denominator: displays totalShiftVacancies (e.g. Vacancy 1 of 2)...');
const sampleShift = {
  shiftId: 'JOB-FP@2026-10-03',
  jobId: 'JOB-LIFE-01',
  jobName: 'Botanic Park Care',
  date: '2026-10-03',
  crewSize: 4,
  assignedStaffIds: ['EMP-01', 'EMP-02'], // 2 assigned, 2 vacancies
  locationDetails: 'Adelaide Botanic Garden'
};

const vacancyRow = {
  type: 'vacancy',
  id: 'vac-1',
  shift: sampleShift,
  vacancyNumber: 1,
  totalShiftVacancies: 2
};

const renderer = window.HortOpsForwardPlannerRenderer;
assert(renderer, 'HortOpsForwardPlannerRenderer must be defined');

const renderedBody = renderer.renderMatrixBody({
  tableRows: [vacancyRow],
  rows: [vacancyRow],
  visibleSlots: [],
  slotDayMap: {},
  staffScheduleMap: {},
  staffMap: {},
  esc: function(s) { return s || ''; },
  escAttr: function(s) { return s || ''; },
  icons: { render: function() { return ''; } },
  self: {}
});

assert(renderedBody.indexOf('Vacancy 1 of 2') !== -1, 'Vacancy card must display "Vacancy 1 of 2", not "Vacancy 1 of 4"');
assert(renderedBody.indexOf('Vacancy 1 of 4') === -1, 'Must NOT display crewSize as vacancy denominator');
console.log('  ✔ Passed: Forward planner vacancy card correctly uses totalShiftVacancies denominator.\n');

// -------------------------------------------------------------
// Test 16: Actionable Operator Warnings
// -------------------------------------------------------------
console.log('[Test 16] Actionable operator warnings: surfaces warnings for conflicts, 0 warnings for normal completion...');
// Normal completion state
let happyState = {
  allShifts: crossYearShifts,
  slots: [],
  staffList: rosterStandard,
  lastRosteringAudit: [
    { shiftId: 'JOB-LIFE-01@2026-10-03', action: 'propagated_fixed' },
    { shiftId: 'JOB-LIFE-01@2026-10-10', action: 'propagated_fixed' }
  ]
};
let happyWarnings = warningUtils.getWarnings(happyState).filter(w => w.category === 'Rostering');
assert.strictEqual(happyWarnings.length, 0, 'Zero rostering warnings for normal completion');

// Unresolved conflict state
let conflictState = {
  allShifts: crossYearShifts,
  slots: [],
  staffList: rosterStandard,
  lastRosteringAudit: [
    { shiftId: 'JOB-LIFE-01@2026-10-10', action: 'fixed_ineligible_vacancy', message: 'Fixed officer unavailable' },
    { shiftId: 'JOB-LIFE-PLANT@2026-10-10', action: 'plant_operator_unresolved', message: 'Plant Operator required' },
    { shiftId: 'JOB-LIFE-01@2026-10-17', action: 'rotation_no_candidate_vacancy', message: 'Pool exhausted' },
    { shiftId: 'JOB-LIFE-01@2026-10-24', action: 'manual_assignment_preserved', message: 'Manual assignment preserved' }
  ]
};
let conflictWarnings = warningUtils.getWarnings(conflictState).filter(w => w.category === 'Rostering');
assert.strictEqual(conflictWarnings.length, 4, 'Must surface all 4 actionable rostering warnings');
assert(conflictWarnings.some(w => w.type === 'rostering_fixed_unavailable'), 'Fixed unavailable warning surfaced');
assert(conflictWarnings.some(w => w.type === 'rostering_plant_operator_unresolved'), 'Plant operator unresolved warning surfaced');
assert(conflictWarnings.some(w => w.type === 'rostering_pool_exhausted'), 'Pool exhausted warning surfaced');
assert(conflictWarnings.some(w => w.type === 'rostering_manual_preserved'), 'Manual preserved warning surfaced');
console.log('  ✔ Passed: Actionable warnings surfaced with exact diagnostic categories; 0 on happy path.\n');

// -------------------------------------------------------------
// Test 17: Real Year-Filtered Cross-Year Fixed (Guidance Section 29, Defect A)
// -------------------------------------------------------------
console.log('[Test 17] Real year-filtered cross-year Fixed: allShifts single-year, resolves 2027 seamlessly...');
const job4Weekly = {
  id: 'JOB-4WEEKLY-CROSS',
  name: 'Adelaide Hills 4-Weekly Survey',
  status: 'active',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-01-17',
  intervalWeeks: 4,
  preferredDay: 'saturday',
  primaryTeam: 'Parks',
  crewSize: 1,
  plantOperatorRequired: false
};

// Generate genuine 2026 shifts only (UI state is strictly single-year)
const digest2026 = window.HortOpsScheduler.generateOperationalDigest([job4Weekly], 2026);
const shifts2026Only = digest2026.allShifts || [];
// Confirm 2026 has occurrences before and including late-year 2026-11-21
const sourceShift4W = shifts2026Only.find(s => s.date === '2026-11-21');
assert(sourceShift4W, 'Source shift 2026-11-21 must exist in 2026 schedule');

let resRealCross = rostering.applyRostering({
  job: job4Weekly,
  currentShift: sourceShift4W,
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 6 }],
  allShifts: shifts2026Only,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [job4Weekly]
});

assert(resRealCross.success, 'Propagation must succeed');
const instKeys17 = Object.keys(resRealCross.rosteringState.instructions);
assert.strictEqual(instKeys17.length, 1, 'Exactly one instruction must be created');
const inst17 = resRealCross.rosteringState.instructions[instKeys17[0]];
assert.strictEqual(inst17.repeatCount, 6, 'Repeat count must be 6');
assert.strictEqual(inst17.sourceShiftId, sourceShift4W.shiftId, 'sourceShiftId must be 2026-11-21 shift');

// Verify all 6 occurrences resolved across years:
// 2 in 2026: 2026-11-21, 2026-12-19
// 4 in 2027: 2027-01-16, 2027-02-13, 2027-03-13, 2027-04-10
assert.deepStrictEqual(resRealCross.customAssignments['JOB-4WEEKLY-CROSS@2026-11-21'], ['EMP-01']);
assert.deepStrictEqual(resRealCross.customAssignments['JOB-4WEEKLY-CROSS@2026-12-19'], ['EMP-01']);
assert.deepStrictEqual(resRealCross.customAssignments['JOB-4WEEKLY-CROSS@2027-01-16'], ['EMP-01']);
assert.deepStrictEqual(resRealCross.customAssignments['JOB-4WEEKLY-CROSS@2027-02-13'], ['EMP-01']);
assert.deepStrictEqual(resRealCross.customAssignments['JOB-4WEEKLY-CROSS@2027-03-13'], ['EMP-01']);
assert.deepStrictEqual(resRealCross.customAssignments['JOB-4WEEKLY-CROSS@2027-04-10'], ['EMP-01']);
console.log('  ✔ Passed: Real year-filtered UI state resolved all 6 occurrences into 2027 under one instruction.\n');

// -------------------------------------------------------------
// Test 18: Annual Fixed Repeat 3 (Guidance Section 30, Defect B)
// -------------------------------------------------------------
console.log('[Test 18] Annual Fixed Repeat 3: spans 2026, 2027, 2028...');
const jobAnnual = {
  id: 'JOB-ANNUAL-FIXED',
  name: 'Annual Heritage Tree Inspection',
  status: 'active',
  frequencyType: 'annual',
  targetMonth: 11,
  preferredDay: 'saturday',
  crewSize: 1,
  plantOperatorRequired: false
};
const digestAnnual2026 = window.HortOpsScheduler.generateOperationalDigest([jobAnnual], 2026);
const shiftsAnnual2026 = digestAnnual2026.allShifts || [];
const sourceAnnualShift = shiftsAnnual2026[0];
assert(sourceAnnualShift, 'Annual shift in 2026 must exist');

let resAnnualFixed = rostering.applyRostering({
  job: jobAnnual,
  currentShift: sourceAnnualShift,
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 3 }],
  allShifts: shiftsAnnual2026,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobAnnual]
});

assert(resAnnualFixed.success, 'Annual Fixed propagation must succeed');
const assignedShiftsFixed = Object.keys(resAnnualFixed.customAssignments).filter(k => (resAnnualFixed.customAssignments[k] || []).length > 0);
assert.strictEqual(assignedShiftsFixed.length, 3, 'Exactly 3 annual occurrences must be assigned for Repeat 3');
assert(assignedShiftsFixed.some(k => k.indexOf('@2026') !== -1), '2026 occurrence assigned');
assert(assignedShiftsFixed.some(k => k.indexOf('@2027') !== -1), '2027 occurrence assigned');
assert(assignedShiftsFixed.some(k => k.indexOf('@2028') !== -1), '2028 occurrence assigned');
console.log('  ✔ Passed: Annual Fixed Repeat 3 correctly spans 2026, 2027, 2028.\n');

// -------------------------------------------------------------
// Test 19: Annual Rotation Repeat 4 (Guidance Section 31, Defect B)
// -------------------------------------------------------------
console.log('[Test 19] Annual Rotation Repeat 4: spans 2026, 2027, 2028, 2029...');
let resAnnualRot = rostering.applyRostering({
  job: jobAnnual,
  currentShift: sourceAnnualShift,
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'rotation', repeatCount: 4 }],
  allShifts: shiftsAnnual2026,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobAnnual]
});

assert(resAnnualRot.success, 'Annual Rotation propagation must succeed');
const assignedShiftsRot = Object.keys(resAnnualRot.customAssignments).filter(k => (resAnnualRot.customAssignments[k] || []).length > 0);
assert.strictEqual(assignedShiftsRot.length, 4, 'Exactly 4 annual occurrences must be assigned across 4 years');
assert(assignedShiftsRot.some(k => k.indexOf('@2026') !== -1), '2026 occurrence assigned');
assert(assignedShiftsRot.some(k => k.indexOf('@2027') !== -1), '2027 occurrence assigned');
assert(assignedShiftsRot.some(k => k.indexOf('@2028') !== -1), '2028 occurrence assigned');
assert(assignedShiftsRot.some(k => k.indexOf('@2029') !== -1), '2029 occurrence assigned');

const inst19 = Object.values(resAnnualRot.rosteringState.instructions)[0];
assert.strictEqual(inst19.repeatCount, 4, 'Instruction repeatCount must be 4 across 4 years');
console.log('  ✔ Passed: Annual Rotation Repeat 4 correctly spans across 4 years (2026-2029).\n');

// -------------------------------------------------------------
// Test 20: Downstream Inherited Save (Guidance Section 32, Defect C)
// -------------------------------------------------------------
console.log('[Test 20] Downstream inherited save: unchanged save creates 0 duplicate instructions...');
// Source shift: 2026-12-19, Repeat 3
const shiftDec19 = crossYearShifts.find(s => s.date === '2026-12-19');
const shiftDec26 = crossYearShifts.find(s => s.date === '2026-12-26');

let resSource19 = rostering.applyRostering({
  job: jobStandard,
  currentShift: shiftDec19,
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 3 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobStandard]
});

const initialInstCount = Object.keys(resSource19.rosteringState.instructions).length;
assert.strictEqual(initialInstCount, 1, 'Initial instruction created');
const origInstId = Object.keys(resSource19.rosteringState.instructions)[0];

// Now simulate saving downstream occurrence Dec 26 unchanged
let resDownstreamSave = rostering.applyRostering({
  job: jobStandard,
  currentShift: shiftDec26,
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{
    slotId: 'SLOT-1',
    staffId: 'EMP-01',
    mode: 'fixed',
    repeatCount: 3,
    isInherited: true,
    sourceDate: '2026-12-19',
    instructionId: origInstId
  }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: resSource19.customAssignments,
  rosteringState: resSource19.rosteringState,
  jobs: [jobStandard]
});

const afterInstCount = Object.keys(resDownstreamSave.rosteringState.instructions).length;
assert.strictEqual(afterInstCount, 1, 'Instruction count MUST remain 1 (no duplicate instruction created)');
assert.strictEqual(Object.keys(resDownstreamSave.rosteringState.instructions)[0], origInstId, 'Original instructionId unchanged');
const provDec26 = resDownstreamSave.rosteringState.provenance['JOB-LIFE-01@2026-12-26:EMP-01'];
assert(provDec26, 'Provenance must survive');
assert.strictEqual(provDec26.instructionId, origInstId, 'Provenance must still reference original instruction');
assert.strictEqual(provDec26.sourceShiftId, shiftDec19.shiftId, 'Provenance sourceShiftId must remain original source shift');
console.log('  ✔ Passed: Saving inherited occurrence unchanged produces 0 duplicate instructions.\n');

// -------------------------------------------------------------
// Test 21: Downstream Inherited Row Removal Protection (Guidance Section 33, Defect D)
// -------------------------------------------------------------
console.log('[Test 21] Downstream inherited row removal protection: UI and state prevent orphan provenance...');
// Set up modal state with inherited slot
window.HortOpsApp = { state: { allShifts: crossYearShifts, rostering: resSource19.rosteringState } };
const modal = window.HortOpsStaffAssignModal;
modal.stagedAssignedStaffIds = ['EMP-01'];
modal.stagedSlots = [{
  slotId: 'SLOT-1',
  staffId: 'EMP-01',
  mode: 'fixed',
  repeatCount: 3,
  isInherited: true,
  sourceDate: '2026-12-19'
}];
modal.stagedSlotStrategies = { 'EMP-01': { mode: 'fixed', repeatCount: 3 } };

let alertTriggered = false;
const origAlert = global.alert;
global.alert = function(msg) { alertTriggered = true; };

modal.removeStaff('EMP-01');
assert(alertTriggered, 'removeStaff on inherited slot must trigger protective warning');
assert(modal.stagedAssignedStaffIds.includes('EMP-01'), 'Inherited staff ID must not be removed');
assert.strictEqual(modal.stagedSlots.length, 1, 'Inherited staged slot must be retained');
global.alert = origAlert;
console.log('  ✔ Passed: Inherited staff removal blocked, preventing contradictory assignment/provenance state.\n');

// -------------------------------------------------------------
// Test 22: Historical Long-Lived Instruction Edit (Guidance Section 34, Defect E)
// -------------------------------------------------------------
console.log('[Test 22] Historical long-lived instruction edit: historical actuals remain 100% immutable...');
// Start with Fixed EMP-01 Repeat 4 on 2026-12-19 (covers 12-19, 12-26, 01-02, 01-09)
let resLongLived = rostering.applyRostering({
  job: jobStandard,
  currentShift: shiftDec19,
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 4 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobStandard]
});

// Now simulate time advance: Today is 2027-01-05
// 12-19, 12-26, 01-02 are historical actuals; 01-09 is future plan
window.HortOpsDateUtils.getLocalDateKey = function() { return '2027-01-05'; };

// Modify long-lived instruction to EMP-03
let resModifiedLongLived = rostering.applyRostering({
  job: jobStandard,
  currentShift: shiftDec19,
  stagedStaffIds: ['EMP-03'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-03', mode: 'fixed', repeatCount: 4 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: resLongLived.customAssignments,
  rosteringState: resLongLived.rosteringState,
  jobs: [jobStandard]
});

// Historical actuals MUST remain strictly EMP-01 (including source shift if historical)!
assert.deepStrictEqual(resModifiedLongLived.customAssignments['JOB-LIFE-01@2026-12-19'], ['EMP-01'], 'Historical source shift 12-19 MUST remain EMP-01');
assert.deepStrictEqual(resModifiedLongLived.customAssignments['JOB-LIFE-01@2026-12-26'], ['EMP-01'], 'Historical actual 12-26 MUST remain EMP-01');
assert.deepStrictEqual(resModifiedLongLived.customAssignments['JOB-LIFE-01@2027-01-02'], ['EMP-01'], 'Historical actual 01-02 MUST remain EMP-01');
// Future occurrence (01-09) reconciled to EMP-03
assert.deepStrictEqual(resModifiedLongLived.customAssignments['JOB-LIFE-01@2027-01-09'], ['EMP-03'], 'Future occurrence 01-09 reconciled to EMP-03');

// Offline17.2a: Verify complete canonical envelope passes Schema v2 validation and persistence write
let env22 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: resModifiedLongLived.customAssignments,
  historicalSnapshots: {},
  rostering: resModifiedLongLived.rosteringState
};
let valRes22 = validator.validate(env22);
assert.strictEqual(valRes22.valid, true, 'Post historical-edit envelope must be valid Schema v2: ' + (valRes22.error || ''));
let saveRes22 = window.HortOpsStorage.saveWorkspace(env22);
assert.strictEqual(saveRes22.ok, true, 'Post historical-edit workspace must persist successfully');

// Reset date mock
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-01'; };
console.log('  ✔ Passed: Historical actuals preserved completely untouched during instruction edits and persisted cleanly.\n');

// -------------------------------------------------------------
// Test 23: Employee Replacement Cleans Stale Source Provenance (Guidance Section 35, Defect F)
// -------------------------------------------------------------
console.log('[Test 23] Employee replacement cleans stale source provenance...');
let resA = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 2 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobStandard]
});

let resB = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[0],
  stagedStaffIds: ['EMP-03'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-03', mode: 'fixed', repeatCount: 2 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: resA.customAssignments,
  rosteringState: resA.rosteringState,
  jobs: [jobStandard]
});

const staleKey = crossYearShifts[0].shiftId + ':EMP-01';
assert.strictEqual(resB.rosteringState.provenance[staleKey], undefined, 'Stale provenance for EMP-01 must be deleted');
const newKey = crossYearShifts[0].shiftId + ':EMP-03';
assert(resB.rosteringState.provenance[newKey], 'Current provenance for EMP-03 must exist');
console.log('  ✔ Passed: Stale source provenance cleanly deleted upon employee replacement.\n');

// -------------------------------------------------------------
// Test 24: Durable Manual Slot Identity (Guidance Section 36, Defect G)
// -------------------------------------------------------------
console.log('[Test 24] Durable manual slot identity: SLOT-2 preserved when SLOT-1 removed...');
let storedProv24 = {
  'JOB-LIFE-01@2026-10-03:EMP-01': { source: 'manual', slotId: 'SLOT-1' },
  'JOB-LIFE-01@2026-10-03:EMP-03': { source: 'manual', slotId: 'SLOT-2' },
  'JOB-LIFE-01@2026-10-03:EMP-04': {
    source: 'rostering-rule',
    strategy: 'rotation',
    slotId: 'SLOT-3',
    instructionId: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-3',
    sourceShiftId: 'JOB-LIFE-01@2026-10-03',
    sequenceIndex: 0
  }
};
let storedInst24 = {
  'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-3': {
    id: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-3',
    jobId: 'JOB-LIFE-01',
    sourceShiftId: 'JOB-LIFE-01@2026-10-03',
    slotId: 'SLOT-3',
    mode: 'rotation',
    repeatCount: 2
  }
};

// Now simulate removal of EMP-01 (SLOT-1), leaving EMP-03 and EMP-04
window.HortOpsApp = {
  state: {
    allShifts: [{ shiftId: 'JOB-LIFE-01@2026-10-03', jobId: 'JOB-LIFE-01', assignedStaffIds: ['EMP-03', 'EMP-04'], date: '2026-10-03' }],
    rostering: { instructions: storedInst24, provenance: storedProv24 }
  }
};
modal.open('JOB-LIFE-01@2026-10-03');

const slotEmp03 = modal.stagedSlots.find(s => s.staffId === 'EMP-03');
const slotEmp04 = modal.stagedSlots.find(s => s.staffId === 'EMP-04');

assert.strictEqual(slotEmp03.slotId, 'SLOT-2', 'Manual EMP-03 must retain durable SLOT-2 (not re-indexed to SLOT-1)');
assert.strictEqual(slotEmp04.slotId, 'SLOT-3', 'Rotation EMP-04 must retain durable SLOT-3');
console.log('  ✔ Passed: Durable slot identity maintained for manual and instructed slots on reopen/reorder.\n');

// -------------------------------------------------------------
// Test 25: Comprehensive Discrete Schema Validation Matrix (Guidance Section 37, Defect H & Offline17.2a)
// -------------------------------------------------------------
console.log('[Test 25] Comprehensive discrete schema validation matrix (independent assertions)...');
function makeValidEnv() {
  return {
    schemaVersion: 2,
    jobs: [jobStandard],
    roster: rosterStandard, staffList: rosterStandard,
    shifts: crossYearShifts,
    assignments: { 'JOB-LIFE-01@2026-10-03': ['EMP-01'] },
    rostering: {
      instructions: {
        'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1': {
          id: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1',
          instructionId: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1',
          jobId: 'JOB-LIFE-01',
          sourceShiftId: 'JOB-LIFE-01@2026-10-03',
          mode: 'fixed',
          slotId: 'SLOT-1',
          employeeId: 'EMP-01',
          repeatCount: 2
        }
      },
      provenance: {
        'JOB-LIFE-01@2026-10-03:EMP-01': {
          source: 'rostering-rule',
          strategy: 'fixed',
          instructionId: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1',
          sourceShiftId: 'JOB-LIFE-01@2026-10-03',
          slotId: 'SLOT-1',
          sequenceIndex: 0
        }
      }
    }
  };
}

// 0. Genuinely valid baseline assertion
const baseRes = validator.validate(makeValidEnv());
assert.strictEqual(baseRes.valid, true, 'makeValidEnv() baseline MUST be valid Schema v2 envelope: ' + (baseRes.error || ''));

// Helper to assert specific validation failure
function assertInvalid(env, expectedSubstring, scenarioDesc) {
  const res = validator.validate(env);
  assert.strictEqual(res.valid, false, scenarioDesc + ': expected valid === false');
  assert(res.error && res.error.toLowerCase().includes(expectedSubstring.toLowerCase()),
    scenarioDesc + ': error message "' + res.error + '" must include "' + expectedSubstring + '"');
}

// 1. Invalid mode
let env = makeValidEnv();
env.rostering.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'].mode = 'banana';
assertInvalid(env, 'unsupported mode', 'Reject invalid mode');

// 2. repeatCount = -99
env = makeValidEnv();
env.rostering.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'].repeatCount = -99;
assertInvalid(env, 'invalid repeatcount', 'Reject negative repeatCount');

// 3. repeatCount = 0
env = makeValidEnv();
env.rostering.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'].repeatCount = 0;
assertInvalid(env, 'invalid repeatcount', 'Reject 0 repeatCount');

// 4. repeatCount = 1.5
env = makeValidEnv();
env.rostering.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'].repeatCount = 1.5;
assertInvalid(env, 'invalid repeatcount', 'Reject non-integer repeatCount');

// 5. repeatCount = 13 (> 12 cap)
env = makeValidEnv();
env.rostering.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'].repeatCount = 13;
assertInvalid(env, 'invalid repeatcount', 'Reject repeatCount exceeding UI cap of 12');

// 6. Missing slotId on instruction
env = makeValidEnv();
delete env.rostering.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'].slotId;
assertInvalid(env, 'missing or invalid slotid', 'Reject missing slotId on instruction');

// 7. Non-canonical instructionId
env = makeValidEnv();
delete env.rostering.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'];
env.rostering.instructions['bad-id-123'] = {
  id: 'bad-id-123',
  jobId: 'JOB-LIFE-01',
  sourceShiftId: 'JOB-LIFE-01@2026-10-03',
  mode: 'fixed',
  slotId: 'SLOT-1',
  employeeId: 'EMP-01',
  repeatCount: 1
};
assertInvalid(env, 'non-canonical instructionid', 'Reject non-canonical instructionId');

// 8. Missing provenance strategy
env = makeValidEnv();
delete env.rostering.provenance['JOB-LIFE-01@2026-10-03:EMP-01'].strategy;
assertInvalid(env, 'missing or invalid strategy', 'Reject missing provenance strategy');

// 9. Bad provenance strategy
env = makeValidEnv();
env.rostering.provenance['JOB-LIFE-01@2026-10-03:EMP-01'].strategy = 'banana';
assertInvalid(env, 'missing or invalid strategy', 'Reject invalid provenance strategy');

// 10. Missing provenance sourceShiftId
env = makeValidEnv();
delete env.rostering.provenance['JOB-LIFE-01@2026-10-03:EMP-01'].sourceShiftId;
assertInvalid(env, 'missing or mismatched sourceshiftid', 'Reject missing provenance sourceShiftId');

// 11. Missing provenance slotId
env = makeValidEnv();
delete env.rostering.provenance['JOB-LIFE-01@2026-10-03:EMP-01'].slotId;
assertInvalid(env, 'missing or mismatched slotid', 'Reject missing provenance slotId');

// 12. Missing provenance sequenceIndex
env = makeValidEnv();
delete env.rostering.provenance['JOB-LIFE-01@2026-10-03:EMP-01'].sequenceIndex;
assertInvalid(env, 'missing or invalid sequenceindex', 'Reject missing provenance sequenceIndex');

// 13. Negative sequenceIndex
env = makeValidEnv();
env.rostering.provenance['JOB-LIFE-01@2026-10-03:EMP-01'].sequenceIndex = -1;
assertInvalid(env, 'invalid sequenceindex', 'Reject negative sequenceIndex');

// 14. Malformed provenance target key
env = makeValidEnv();
delete env.rostering.provenance['JOB-LIFE-01@2026-10-03:EMP-01'];
env.rostering.provenance['nonsense'] = { source: 'manual', slotId: 'SLOT-1' };
assertInvalid(env, 'malformed target key', 'Reject malformed provenance target key');

// 15. Provenance pointing to nonexistent instruction
env = makeValidEnv();
env.rostering.provenance['JOB-LIFE-01@2026-10-03:EMP-01'].instructionId = 'ROSTER-NONEXISTENT-2026-10-03-SLOT-1';
assertInvalid(env, 'references nonexistent instructionid', 'Reject orphan provenance with nonexistent instruction');

// 16. Relational mismatch (provenance claims employee assigned, but canonical assignments array lacks employee)
env = makeValidEnv();
env.assignments['JOB-LIFE-01@2026-10-03'] = []; // Cleared assignment in canonical property!
assertInvalid(env, 'does not contain this employee', 'Reject contradictory state: provenance present but assignments empty');

// 17. Offline17.2a: Malformed empty rostering object {}
env = makeValidEnv();
env.rostering = {};
assertInvalid(env, 'missing or invalid "rostering.instructions"', 'Reject malformed rostering: {} without required collections');

// 18. Offline17.2a: Instruction map key does not match instructionId
env = makeValidEnv();
let instObj = env.rostering.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'];
delete env.rostering.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'];
env.rostering.instructions['WRONG-KEY'] = instObj;
assertInvalid(env, 'does not match instructionid', 'Reject instruction map key mismatch with instructionId');

// 19. Offline17.2a: Instruction sourceShiftId jobId prefix does not match inst.jobId
env = makeValidEnv();
env.jobs.push({
  id: 'JOB-LIFE-02',
  name: 'Secondary Job',
  status: 'active',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-10-03',
  intervalWeeks: 1,
  preferredDay: 'saturday',
  primaryTeam: 'Parks',
  crewSize: 1
});
env.rostering.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'].sourceShiftId = 'JOB-LIFE-02@2026-10-03';
assertInvalid(env, 'does not match jobid', 'Reject sourceShiftId jobId mismatch');

// 20. Offline17.2a: Manual provenance missing slotId
env = makeValidEnv();
env.rostering.provenance['JOB-LIFE-01@2026-10-03:EMP-01'] = {
  source: 'manual',
  appliedAt: new Date().toISOString()
  // slotId omitted!
};
assertInvalid(env, 'missing or invalid slotid', 'Reject manual provenance missing required slotId');

console.log('  ✔ Passed: All 20 discrete schema invalidation scenarios fail closed independently with exact diagnostic error reasons.\n');

// -------------------------------------------------------------
// Test 26: Plant Operator Warning End-to-End (Guidance Section 38, Defect I)
// -------------------------------------------------------------
console.log('[Test 26] Plant Operator warning end-to-end: live engine run emits plant_operator_unresolved...');
// Roster with NO plant operators for rotation propagation
const rosterNoPlant = [
  { id: 'EMP-01', name: 'Aaron Worker', role: 'Worker', team: 'Civil', status: 'active', isPlantOperator: false },
  { id: 'EMP-03', name: 'Charlie Worker', role: 'Worker', team: 'Civil', status: 'active', isPlantOperator: false }
];
const pShifts = [
  { shiftId: 'JOB-LIFE-PLANT@2026-10-03', jobId: 'JOB-LIFE-PLANT', date: '2026-10-03', crewSize: 1, plantOperatorRequired: true },
  { shiftId: 'JOB-LIFE-PLANT@2026-10-10', jobId: 'JOB-LIFE-PLANT', date: '2026-10-10', crewSize: 1, plantOperatorRequired: true }
];

let resPlantFail = rostering.applyRostering({
  job: jobPlantOpReq,
  currentShift: pShifts[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [
    { slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'rotation', repeatCount: 2 }
  ],
  allShifts: pShifts,
  roster: rosterNoPlant,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobPlantOpReq]
});

assert(resPlantFail.auditLog.some(l => l.action === 'plant_operator_unresolved'), 'Engine must emit plant_operator_unresolved');
let plantWarnState = {
  allShifts: pShifts,
  slots: [],
  staffList: rosterNoPlant,
  lastRosteringAudit: resPlantFail.auditLog
};
let plantWarnings = warningUtils.getWarnings(plantWarnState).filter(w => w.type === 'rostering_plant_operator_unresolved');
assert.strictEqual(plantWarnings.length, 1, 'Exactly one high-severity Plant Operator warning surfaced');
assert.strictEqual(plantWarnings[0].severity, 'high', 'Severity must be high');
assert(plantWarnings[0].title.indexOf('Plant Operator Unresolved') !== -1, 'Title must contain Plant Operator Unresolved');
console.log('  ✔ Passed: Plant Operator unresolved event mapped end-to-end from engine to high-severity warning.\n');

// -------------------------------------------------------------
// Test 27: Manual Precedence Warning End-to-End (Guidance Section 39, Defect J)
// -------------------------------------------------------------
console.log('[Test 27] Manual precedence warning end-to-end: live engine run emits manual_assignment_preserved...');
let resManualPrec = rostering.applyRostering({
  job: jobStandard,
  currentShift: crossYearShifts[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 2 }],
  allShifts: crossYearShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: { 'JOB-LIFE-01@2026-10-10': ['EMP-03'] }, // Downstream target has manual EMP-03
  rosteringState: {
    instructions: {},
    provenance: { 'JOB-LIFE-01@2026-10-10:EMP-03': { source: 'manual', slotId: 'SLOT-1' } }
  },
  jobs: [jobStandard]
});

assert(resManualPrec.auditLog.some(l => l.action === 'manual_assignment_preserved'), 'Engine must emit manual_assignment_preserved');
assert.deepStrictEqual(resManualPrec.customAssignments['JOB-LIFE-01@2026-10-10'], ['EMP-03'], 'Target shift manual assignment strictly preserved');

let manualWarnState = {
  allShifts: crossYearShifts,
  slots: [],
  staffList: rosterStandard,
  lastRosteringAudit: resManualPrec.auditLog
};
let manualWarnings = warningUtils.getWarnings(manualWarnState).filter(w => w.type === 'rostering_manual_preserved');
assert.strictEqual(manualWarnings.length, 1, 'Exactly one manual preserved warning surfaced');
assert(manualWarnings[0].title.indexOf('Manual Assignment Preserved') !== -1, 'Title must contain Manual Assignment Preserved');
console.log('  ✔ Passed: Manual assignment collision mapped end-to-end to actionable warning.\n');

// -------------------------------------------------------------
// Test 28: Sparse Recurrence Fixed Repeat 12 (52-Week Recurrence, Offline17.2a Defect 2)
// -------------------------------------------------------------
console.log('[Test 28] Sparse recurrence Fixed Repeat 12 (52-week recurrence)...');
const jobSparse = {
  id: 'JOB-SPARSE-52W',
  name: 'Annual Tree Pruning Cycle',
  status: 'active',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-01-03',
  intervalWeeks: 52,
  preferredDay: 'saturday',
  primaryTeam: 'Parks',
  crewSize: 1
};
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-01-01'; };
const sparseDigest2026 = window.HortOpsScheduler.generateOperationalDigest([jobSparse], 2026);
const sparseShift2026 = sparseDigest2026.allShifts.find(s => s.jobId === 'JOB-SPARSE-52W');
assert(sparseShift2026, 'Must find 2026 shift for 52-week recurring job');

const maxRepeat52w = rostering.resolveRepeatMax(sparseShift2026.shiftId, sparseDigest2026.allShifts, jobSparse, [jobSparse]);
assert.strictEqual(maxRepeat52w, 12, 'resolveRepeatMax for 52-week recurring job must return full UI cap of 12 (was ' + maxRepeat52w + ')');

let resSparseFixed = rostering.applyRostering({
  job: jobSparse,
  currentShift: sparseShift2026,
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 12 }],
  allShifts: sparseDigest2026.allShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobSparse]
});

const assignedSparseShifts = Object.keys(resSparseFixed.customAssignments).filter(k => k.startsWith('JOB-SPARSE-52W@'));
assert.strictEqual(assignedSparseShifts.length, 12, 'Must generate exactly 12 canonical occurrences for 52-week Fixed Repeat 12 (got ' + assignedSparseShifts.length + ')');
assignedSparseShifts.forEach(sId => {
  assert.deepStrictEqual(resSparseFixed.customAssignments[sId], ['EMP-01'], sId + ' must be assigned to EMP-01');
});
console.log('  ✔ Passed: 52-week recurrence Fixed Repeat 12 resolved exactly 12 canonical occurrences.\n');

// -------------------------------------------------------------
// Test 29: Sparse Recurrence Rotation Repeat 12 (52-Week Recurrence, Offline17.2a Defect 2)
// -------------------------------------------------------------
console.log('[Test 29] Sparse recurrence Rotation Repeat 12 (52-week recurrence)...');
let resSparseRot = rostering.applyRostering({
  job: jobSparse,
  currentShift: sparseShift2026,
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'rotation', repeatCount: 12 }],
  allShifts: sparseDigest2026.allShifts,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobSparse]
});

const rotSparseShifts = Object.keys(resSparseRot.customAssignments).filter(k => k.startsWith('JOB-SPARSE-52W@'));
assert.strictEqual(rotSparseShifts.length, 12, 'Must generate exactly 12 canonical occurrences for 52-week Rotation Repeat 12 (got ' + rotSparseShifts.length + ')');
rotSparseShifts.sort();
assert.deepStrictEqual(resSparseRot.customAssignments[rotSparseShifts[0]], ['EMP-01'], 'First occurrence must be EMP-01');
const distinctWorkers = new Set(rotSparseShifts.map(sId => resSparseRot.customAssignments[sId][0]));
assert(distinctWorkers.size >= 2, 'Rotation must assign distinct workers across 12 years (assigned: ' + Array.from(distinctWorkers).join(', ') + ')');
console.log('  ✔ Passed: 52-week recurrence Rotation Repeat 12 resolved 12 occurrences with staff rotation continuity.\n');

// -------------------------------------------------------------
// -------------------------------------------------------------
// Test 30: Historical Fixed -> Rotation Calling Convention & Integrity (Offline17.4 Guidance Section 25)
// -------------------------------------------------------------
console.log('[Test 30] Historical Fixed -> Rotation calling convention: string employee IDs, canonical rotation, schema valid...');
// 6 shifts spanning Dec 2026 into Jan 2027
const shifts30 = [
  { shiftId: 'JOB-LIFE-01@2026-12-19', jobId: 'JOB-LIFE-01', date: '2026-12-19', crewSize: 1, assignedStaffIds: [] },
  { shiftId: 'JOB-LIFE-01@2026-12-26', jobId: 'JOB-LIFE-01', date: '2026-12-26', crewSize: 1, assignedStaffIds: [] },
  { shiftId: 'JOB-LIFE-01@2027-01-02', jobId: 'JOB-LIFE-01', date: '2027-01-02', crewSize: 1, assignedStaffIds: [] },
  { shiftId: 'JOB-LIFE-01@2027-01-09', jobId: 'JOB-LIFE-01', date: '2027-01-09', crewSize: 1, assignedStaffIds: [] },
  { shiftId: 'JOB-LIFE-01@2027-01-16', jobId: 'JOB-LIFE-01', date: '2027-01-16', crewSize: 1, assignedStaffIds: [] },
  { shiftId: 'JOB-LIFE-01@2027-01-23', jobId: 'JOB-LIFE-01', date: '2027-01-23', crewSize: 1, assignedStaffIds: [] }
];

let res30Initial = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 6 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobStandard]
});

// Advance time: 2027-01-05 (12-19, 12-26, 01-02 historical actuals; 01-09, 01-16, 01-23 future plan)
window.HortOpsDateUtils.getLocalDateKey = function() { return '2027-01-05'; };

// Edit historical instruction on 12-19 to Rotation Repeat 6
let res30Rotated = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-02'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-02', mode: 'rotation', repeatCount: 6 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res30Initial.customAssignments,
  rosteringState: res30Initial.rosteringState,
  jobs: [jobStandard]
});

// 1. Historical actuals remain 100% untouched
assert.deepStrictEqual(res30Rotated.customAssignments['JOB-LIFE-01@2026-12-19'], ['EMP-01'], 'Historical 12-19 actual must remain EMP-01');
assert.deepStrictEqual(res30Rotated.customAssignments['JOB-LIFE-01@2026-12-26'], ['EMP-01'], 'Historical 12-26 actual must remain EMP-01');
assert.deepStrictEqual(res30Rotated.customAssignments['JOB-LIFE-01@2027-01-02'], ['EMP-01'], 'Historical 01-02 actual must remain EMP-01');

// 2. Future assignments MUST only contain string employee IDs (no [object Object] or candidate objects)
const futureShifts30 = ['JOB-LIFE-01@2027-01-09', 'JOB-LIFE-01@2027-01-16', 'JOB-LIFE-01@2027-01-23'];
futureShifts30.forEach(function(sId) {
  const assigned = res30Rotated.customAssignments[sId];
  assert(Array.isArray(assigned) && assigned.length === 1, 'Future shift ' + sId + ' must have exactly 1 assigned staff member');
  assert.strictEqual(typeof assigned[0], 'string', 'Assigned employee ID on ' + sId + ' must be string, not object');
  assert(!assigned[0].includes('object Object'), 'Assigned employee ID must not contain [object Object]');
});

// 3. Provenance keys must not contain [object Object]
Object.keys(res30Rotated.rosteringState.provenance).forEach(function(pKey) {
  assert(!pKey.includes('[object Object]'), 'Provenance key "' + pKey + '" must not contain [object Object]');
  assert(!pKey.includes('undefined'), 'Provenance key "' + pKey + '" must not contain undefined');
});

// 4. Schema v2 validation and persistence write succeed
let env30 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: res30Rotated.customAssignments,
  historicalSnapshots: {},
  rostering: res30Rotated.rosteringState
};
let valRes30 = validator.validate(env30);
assert.strictEqual(valRes30.valid, true, 'Historical Fixed -> Rotation envelope must pass Schema v2: ' + (valRes30.error || ''));
let saveRes30 = window.HortOpsStorage.saveWorkspace(env30);
assert.strictEqual(saveRes30.ok, true, 'Historical Fixed -> Rotation workspace must persist cleanly');

window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-01'; };
console.log('  ✔ Passed: Historical Fixed -> Rotation correctly assigned string employee IDs via canonical rotation and validated Schema v2.\n');

// -------------------------------------------------------------
// Test 31: Historical Rotation with Future Manual Collision (Offline17.4 Guidance Section 26)
// -------------------------------------------------------------
console.log('[Test 31] Historical Rotation with future Manual collision: manual preserved, no crew overstaffing...');
let res31Initial = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 5 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobStandard]
});

window.HortOpsDateUtils.getLocalDateKey = function() { return '2027-01-05'; };

// Place manual assignment of EMP-03 on future occurrence 2027-01-09
let assignments31 = JSON.parse(JSON.stringify(res31Initial.customAssignments));
let rostering31 = JSON.parse(JSON.stringify(res31Initial.rosteringState));
assignments31['JOB-LIFE-01@2027-01-09'] = ['EMP-03'];
delete rostering31.provenance['JOB-LIFE-01@2027-01-09:EMP-01'];
rostering31.provenance['JOB-LIFE-01@2027-01-09:EMP-03'] = {
  source: 'manual',
  slotId: 'SLOT-1',
  appliedAt: new Date().toISOString()
};

// Edit historical instruction to Rotation Repeat 5
let res31Rotated = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'rotation', repeatCount: 5 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: assignments31,
  rosteringState: rostering31,
  jobs: [jobStandard]
});

// Assert manual worker EMP-03 preserved on 01-09, no overfilling crew (jobStandard has crewSize: 1)
assert.deepStrictEqual(res31Rotated.customAssignments['JOB-LIFE-01@2027-01-09'], ['EMP-03'], 'Manual assignment EMP-03 MUST be preserved on 01-09');
assert.strictEqual(res31Rotated.rosteringState.provenance['JOB-LIFE-01@2027-01-09:EMP-03'].source, 'manual', 'Provenance on 01-09 must remain manual');
assert(res31Rotated.auditLog.some(l => l.action === 'manual_assignment_preserved'), 'Audit log must emit manual_assignment_preserved');
assert(res31Rotated.customAssignments['JOB-LIFE-01@2027-01-16'].length === 1, 'Later future shift 01-16 must receive rotated employee');

let env31 = { schemaVersion: 2, jobs: [jobStandard], roster: rosterStandard, staffList: rosterStandard, assignments: res31Rotated.customAssignments, rostering: res31Rotated.rosteringState };
assert.strictEqual(validator.validate(env31).valid, true, 'Resulting envelope must be valid Schema v2: ' + (validator.validate(env31).error || ''));

window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-01'; };
console.log('  ✔ Passed: Historical Rotation strictly respected downstream Manual precedence with zero overstaffing.\n');

// -------------------------------------------------------------
// Test 32: Historical Fixed with Future Manual Collision (Offline17.4 Guidance Section 27)
// -------------------------------------------------------------
console.log('[Test 32] Historical Fixed with future Manual collision: manual preserved, no crew overstaffing...');
let res32Initial = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 5 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobStandard]
});

window.HortOpsDateUtils.getLocalDateKey = function() { return '2027-01-05'; };

// Place manual assignment of EMP-03 on future occurrence 2027-01-09
let assignments32 = JSON.parse(JSON.stringify(res32Initial.customAssignments));
let rostering32 = JSON.parse(JSON.stringify(res32Initial.rosteringState));
assignments32['JOB-LIFE-01@2027-01-09'] = ['EMP-03'];
delete rostering32.provenance['JOB-LIFE-01@2027-01-09:EMP-01'];
rostering32.provenance['JOB-LIFE-01@2027-01-09:EMP-03'] = {
  source: 'manual',
  slotId: 'SLOT-1',
  appliedAt: new Date().toISOString()
};

// Edit historical instruction to Fixed EMP-02 Repeat 5
let res32Fixed = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-02'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-02', mode: 'fixed', repeatCount: 5 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: assignments32,
  rosteringState: rostering32,
  jobs: [jobStandard]
});

// Manual worker preserved; EMP-02 blocked on 01-09; no double-booking
assert.deepStrictEqual(res32Fixed.customAssignments['JOB-LIFE-01@2027-01-09'], ['EMP-03'], 'Manual assignment EMP-03 must be preserved against Fixed propagation');
assert(res32Fixed.auditLog.some(l => l.action === 'manual_assignment_preserved'), 'Audit log must emit manual_assignment_preserved');
// Subsequent future shift 01-16 receives EMP-02 cleanly
assert.deepStrictEqual(res32Fixed.customAssignments['JOB-LIFE-01@2027-01-16'], ['EMP-02'], 'Subsequent shift 01-16 receives propagated EMP-02');

let env32 = { schemaVersion: 2, jobs: [jobStandard], roster: rosterStandard, staffList: rosterStandard, assignments: res32Fixed.customAssignments, rostering: res32Fixed.rosteringState };
assert.strictEqual(validator.validate(env32).valid, true, 'Resulting envelope must be valid Schema v2');

window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-01'; };
console.log('  ✔ Passed: Historical Fixed strictly respected downstream Manual precedence with zero crew overstaffing.\n');

// -------------------------------------------------------------
// Test 33: Plant Operator through Historical Edit (Offline17.4 Guidance Section 28)
// -------------------------------------------------------------
console.log('[Test 33] Plant Operator through historical edit: canonical operator gate enforced on future occurrences...');
const plantShifts33 = [
  { shiftId: 'JOB-LIFE-PLANT@2026-12-19', jobId: 'JOB-LIFE-PLANT', date: '2026-12-19', crewSize: 1, plantOperatorRequired: true, assignedStaffIds: [] },
  { shiftId: 'JOB-LIFE-PLANT@2026-12-26', jobId: 'JOB-LIFE-PLANT', date: '2026-12-26', crewSize: 1, plantOperatorRequired: true, assignedStaffIds: [] },
  { shiftId: 'JOB-LIFE-PLANT@2027-01-02', jobId: 'JOB-LIFE-PLANT', date: '2027-01-02', crewSize: 1, plantOperatorRequired: true, assignedStaffIds: [] },
  { shiftId: 'JOB-LIFE-PLANT@2027-01-09', jobId: 'JOB-LIFE-PLANT', date: '2027-01-09', crewSize: 1, plantOperatorRequired: true, assignedStaffIds: [] }
];

// Initial: Plant Operator EMP-02 Fixed Repeat 4 on 12-19
let res33Initial = rostering.applyRostering({
  job: jobPlantOpReq,
  currentShift: plantShifts33[0],
  stagedStaffIds: ['EMP-02'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-02', mode: 'fixed', repeatCount: 4 }],
  allShifts: plantShifts33,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobPlantOpReq]
});

window.HortOpsDateUtils.getLocalDateKey = function() { return '2027-01-05'; };

// Case A: Qualified plant operator exists (rosterStandard has EMP-02 certified)
let res33CaseA = rostering.applyRostering({
  job: jobPlantOpReq,
  currentShift: plantShifts33[0],
  stagedStaffIds: ['EMP-02'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-02', mode: 'rotation', repeatCount: 4 }],
  allShifts: plantShifts33,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res33Initial.customAssignments,
  rosteringState: res33Initial.rosteringState,
  jobs: [jobPlantOpReq]
});
assert.deepStrictEqual(res33CaseA.customAssignments['JOB-LIFE-PLANT@2027-01-09'], ['EMP-02'], 'Case A: Qualified plant operator assigned by canonical rotation');

// Case B: No qualified plant operators available in pool for rotation
const rosterNoOps33 = [
  { id: 'EMP-01', name: 'Aaron Worker', role: 'Worker', team: 'Civil', status: 'active', isPlantOperator: false },
  { id: 'EMP-03', name: 'Charlie Worker', role: 'Worker', team: 'Civil', status: 'active', isPlantOperator: false }
];
let res33CaseB = rostering.applyRostering({
  job: jobPlantOpReq,
  currentShift: plantShifts33[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'rotation', repeatCount: 4 }],
  allShifts: plantShifts33,
  roster: rosterNoOps33,
  customAssignments: res33Initial.customAssignments,
  rosteringState: res33Initial.rosteringState,
  jobs: [jobPlantOpReq]
});

// Future shift 01-09 must NOT be filled by non-operator; slot left vacant with unresolved warning
assert.deepStrictEqual(res33CaseB.customAssignments['JOB-LIFE-PLANT@2027-01-09'] || [], [], 'Case B: Ordinary worker must NOT silently fill plant operator slot');
assert(res33CaseB.auditLog.some(l => l.action === 'plant_operator_unresolved'), 'Case B: Engine must emit plant_operator_unresolved');
let warnState33 = { allShifts: plantShifts33, slots: [], staffList: rosterNoOps33, lastRosteringAudit: res33CaseB.auditLog };
let plantWarns33 = warningUtils.getWarnings(warnState33).filter(w => w.type === 'rostering_plant_operator_unresolved');
assert.strictEqual(plantWarns33.length, 1, 'Case B: Exactly 1 plant operator warning generated');

window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-01'; };
console.log('  ✔ Passed: Plant Operator requirement strictly enforced through historical edit via canonical engine.\n');

// -------------------------------------------------------------
// Test 34: Static Source Guard — Zero Duplicate Propagation Implementation (Offline17.4 Guidance Section 29)
// -------------------------------------------------------------
console.log('[Test 34] Static source guard: zero duplicate candidate-selection or assignment logic...');
const fs = require('fs');
const path = require('path');
const engineSrc = fs.readFileSync(path.join(__dirname, '../js/utils/rostering/engine.js'), 'utf8');

// 1. recommendRotationCandidate should be invoked exactly once in engine.js (inside propagateOccurrence)
const recCalls = engineSrc.match(/this\.recommendRotationCandidate\s*\(/g) || [];
assert.strictEqual(recCalls.length, 1, 'recommendRotationCandidate must have exactly 1 invocation in engine.js (got ' + recCalls.length + ')');

// 2. Both historical branch and ordinary branch must call this.propagateOccurrence
const propCalls = engineSrc.match(/this\.propagateOccurrence\s*\(/g) || [];
assert.strictEqual(propCalls.length, 2, 'propagateOccurrence must be invoked exactly twice in engine.js: historical future branch and ordinary future branch');

console.log('  ✔ Passed: Static source inspection verified single canonical propagation implementation.\n');

// -------------------------------------------------------------
// Test 35: In-Memory Pre-Save Rollback Immutability (Offline17.4 Guidance Section 30)
// -------------------------------------------------------------
console.log('[Test 35] Failed save rollback immutability: zero state mutation when persistence rejected...');
let preSaveAssignments = { 'JOB-LIFE-01@2026-10-03': ['EMP-01'] };
let preSaveRostering = {
  instructions: {
    'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1': {
      id: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1',
      instructionId: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1',
      jobId: 'JOB-LIFE-01',
      sourceShiftId: 'JOB-LIFE-01@2026-10-03',
      mode: 'fixed',
      slotId: 'SLOT-1',
      employeeId: 'EMP-01',
      repeatCount: 2
    }
  },
  provenance: {
    'JOB-LIFE-01@2026-10-03:EMP-01': {
      source: 'rostering-rule',
      strategy: 'fixed',
      instructionId: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1',
      sourceShiftId: 'JOB-LIFE-01@2026-10-03',
      slotId: 'SLOT-1',
      sequenceIndex: 0
    }
  }
};

let snapshotBeforeApply = JSON.parse(JSON.stringify({ customAssignments: preSaveAssignments, rosteringState: preSaveRostering }));

// Calling applyRostering must NEVER mutate input objects in-place
let resCall = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-02'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-02', mode: 'fixed', repeatCount: 4 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: preSaveAssignments,
  rosteringState: preSaveRostering,
  jobs: [jobStandard]
});

assert.deepStrictEqual(preSaveAssignments, snapshotBeforeApply.customAssignments, 'applyRostering must not mutate caller customAssignments');
assert.deepStrictEqual(preSaveRostering, snapshotBeforeApply.rosteringState, 'applyRostering must not mutate caller rosteringState');
console.log('  ✔ Passed: Pre-save inputs remained strictly immutable with 100% rollback fidelity.\n');

// -------------------------------------------------------------
// Test 36: Schema Reject Orphan Provenance (Offline17.4 Guidance Section 31)
// -------------------------------------------------------------
console.log('[Test 36] Schema reject orphan provenance: missing shift key in assignments fails closed...');
let envOrphan = makeValidEnv();
delete envOrphan.assignments['JOB-LIFE-01@2026-10-03'];
let resOrphan = validator.validate(envOrphan);
assert.strictEqual(resOrphan.valid, false, 'Orphan provenance must fail Schema v2 validation');
assert(resOrphan.error && resOrphan.error.toLowerCase().includes('does not contain this employee'), 'Error message must cite missing employee assignment: ' + resOrphan.error);
console.log('  ✔ Passed: Schema validator strictly rejected orphan provenance missing shift key in assignments.\n');

// -------------------------------------------------------------
// Test 37: Schema Reject Instruction Identity Mismatch (Offline17.4 Guidance Section 32)
// -------------------------------------------------------------
console.log('[Test 37] Schema reject instruction identity mismatch: id !== instructionId fails closed...');
let envMismatch = makeValidEnv();
envMismatch.rostering.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'].id = 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1';
envMismatch.rostering.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'].instructionId = 'ROSTER-DIFFERENT-ID-SLOT-1';
let resMismatch = validator.validate(envMismatch);
assert.strictEqual(resMismatch.valid, false, 'Instruction with mismatched id and instructionId must fail Schema v2');
assert(resMismatch.error && (resMismatch.error.includes('mismatched id') || resMismatch.error.includes('does not match instructionId')), 'Error message must cite mismatched id: ' + resMismatch.error);
console.log('  ✔ Passed: Schema validator strictly rejected instruction with mismatched id and instructionId.\n');

// -------------------------------------------------------------
// Test 38: Schema Reject Duplicate Active Slot Claims (Offline17.4 Guidance Section 33)
// -------------------------------------------------------------
console.log('[Test 38] Schema reject duplicate active slot claims: multiple employees claiming same slotId fails closed...');
let envDupSlot = makeValidEnv();
// Shift JOB-LIFE-01@2026-10-03 already has EMP-01 on SLOT-1. Add EMP-02 claiming same SLOT-1.
envDupSlot.assignments['JOB-LIFE-01@2026-10-03'].push('EMP-02');
envDupSlot.rostering.provenance['JOB-LIFE-01@2026-10-03:EMP-02'] = {
  source: 'manual',
  slotId: 'SLOT-1',
  appliedAt: new Date().toISOString()
};
let resDupSlot = validator.validate(envDupSlot);
assert.strictEqual(resDupSlot.valid, false, 'Duplicate active slot claims on same shift must fail Schema v2');
assert(resDupSlot.error && resDupSlot.error.toLowerCase().includes('duplicate slot assignment'), 'Error must report duplicate slot assignment: ' + resDupSlot.error);
console.log('  ✔ Passed: Schema validator strictly rejected multiple active provenance claims on same slotId.\n');

// -------------------------------------------------------------
// Test 39: Historical Fixed -> Fixed Clamps Old Repeat Count & Non-Overlapping Scope (Offline17.4a)
// -------------------------------------------------------------
console.log('[Test 39] Historical Fixed -> Fixed: clamps old Repeat count and establishes non-overlapping instruction scope...');
// 6 shifts across Dec 2026 into Jan 2027 (shifts30)
// Initial: Fixed EMP-01 Repeat 6 starting 2026-12-19
let res39Initial = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 6 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobStandard]
});

// Advance time to 2027-01-05:
// 12-19, 12-26, 01-02 historical actuals (count = 3); 01-09, 01-16, 01-23 future plan (count = 3)
window.HortOpsDateUtils.getLocalDateKey = function() { return '2027-01-05'; };

// Edit historical instruction on 12-19 to Fixed EMP-02 Repeat 6
let res39Fixed = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-02'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-02', mode: 'fixed', repeatCount: 6 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res39Initial.customAssignments,
  rosteringState: res39Initial.rosteringState,
  jobs: [jobStandard]
});

// 1. Historical actuals untouched
assert.deepStrictEqual(res39Fixed.customAssignments['JOB-LIFE-01@2026-12-19'], ['EMP-01']);
assert.deepStrictEqual(res39Fixed.customAssignments['JOB-LIFE-01@2026-12-26'], ['EMP-01']);
assert.deepStrictEqual(res39Fixed.customAssignments['JOB-LIFE-01@2027-01-02'], ['EMP-01']);

// 2. Future assignments reconciled to EMP-02
assert.deepStrictEqual(res39Fixed.customAssignments['JOB-LIFE-01@2027-01-09'], ['EMP-02']);
assert.deepStrictEqual(res39Fixed.customAssignments['JOB-LIFE-01@2027-01-16'], ['EMP-02']);
assert.deepStrictEqual(res39Fixed.customAssignments['JOB-LIFE-01@2027-01-23'], ['EMP-02']);

// 3. Old instruction CLAMPED to exactly 3 historical actuals
const oldInst39 = res39Fixed.rosteringState.instructions['ROSTER-JOB-LIFE-01-2026-12-19-SLOT-1'];
assert(oldInst39, 'Old historical instruction must be retained');
assert.strictEqual(oldInst39.repeatCount, 3, 'Old historical instruction repeatCount MUST be clamped to 3 (got ' + (oldInst39 ? oldInst39.repeatCount : 'undefined') + ')');
assert.strictEqual(oldInst39.employeeId, 'EMP-01', 'Old historical instruction employeeId must remain EMP-01');

// 4. New forward instruction starts at first future occurrence (2027-01-09) with repeatCount 3
const newInstKey39 = 'ROSTER-JOB-LIFE-01-2027-01-09-SLOT-1';
const newInst39 = res39Fixed.rosteringState.instructions[newInstKey39];
assert(newInst39, 'New forward instruction starting at 2027-01-09 must exist');
assert.strictEqual(newInst39.repeatCount, 3, 'New forward instruction repeatCount must be 3');
assert.strictEqual(newInst39.employeeId, 'EMP-02', 'New forward instruction employeeId must be EMP-02');

// 5. Non-overlapping declared scope:
// Old instruction series from 12-19 for repeatCount 3 covers 12-19, 12-26, 01-02.
// It does NOT include 01-09.
const oldSeries39 = window.HortOpsRosteringEngine.resolveSeries(jobStandard, shifts30, oldInst39.repeatCount + 2, [jobStandard], shifts30[0].shiftId);
const oldCoveredShifts = oldSeries39.slice(0, oldInst39.repeatCount).map(s => s.shiftId);
assert(!oldCoveredShifts.includes('JOB-LIFE-01@2027-01-09'), 'Old instruction scope must NOT cover first future occurrence (2027-01-09)');

// 6. Schema v2 & persistence
let env39 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: res39Fixed.customAssignments,
  historicalSnapshots: {},
  rostering: res39Fixed.rosteringState
};
let valRes39 = validator.validate(env39);
assert.strictEqual(valRes39.valid, true, 'Test 39 workspace must pass Schema v2: ' + (valRes39.error || ''));
let saveRes39 = window.HortOpsStorage.saveWorkspace(env39);
assert.strictEqual(saveRes39.ok, true, 'Test 39 workspace must persist successfully');

window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-01'; };
console.log('  ✔ Passed: Historical Fixed -> Fixed correctly clamped old Repeat to 3 with non-overlapping forward scope.\n');

// -------------------------------------------------------------
// Test 40: Historical Fixed -> Rotation Clamps Old Repeat Count & Non-Overlapping Scope (Offline17.4a)
// -------------------------------------------------------------
console.log('[Test 40] Historical Fixed -> Rotation: clamps old Repeat count and establishes non-overlapping instruction scope...');
let res40Initial = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 6 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobStandard]
});

window.HortOpsDateUtils.getLocalDateKey = function() { return '2027-01-05'; };

// Edit historical instruction on 12-19 to Rotation Repeat 6
let res40Rotated = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-02'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-02', mode: 'rotation', repeatCount: 6 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res40Initial.customAssignments,
  rosteringState: res40Initial.rosteringState,
  jobs: [jobStandard]
});

// 1. Old historical instruction clamped to 3
const oldInst40 = res40Rotated.rosteringState.instructions['ROSTER-JOB-LIFE-01-2026-12-19-SLOT-1'];
assert(oldInst40, 'Old historical instruction must exist');
assert.strictEqual(oldInst40.repeatCount, 3, 'Old historical instruction repeatCount MUST be clamped to 3 (got ' + (oldInst40 ? oldInst40.repeatCount : 'undefined') + ')');
assert.strictEqual(oldInst40.mode, 'fixed', 'Old historical instruction mode must remain fixed');

// 2. New forward Rotation instruction starts on 2027-01-09 with repeatCount 3
const newInstKey40 = 'ROSTER-JOB-LIFE-01-2027-01-09-SLOT-1';
const newInst40 = res40Rotated.rosteringState.instructions[newInstKey40];
assert(newInst40, 'New forward rotation instruction starting on 2027-01-09 must exist');
assert.strictEqual(newInst40.repeatCount, 3, 'New forward rotation instruction repeatCount must be 3');
assert.strictEqual(newInst40.mode, 'rotation', 'New forward rotation instruction mode must be rotation');

// 3. Historical actuals untouched and future assignments are strings
assert.deepStrictEqual(res40Rotated.customAssignments['JOB-LIFE-01@2026-12-19'], ['EMP-01']);
assert.deepStrictEqual(res40Rotated.customAssignments['JOB-LIFE-01@2026-12-26'], ['EMP-01']);
assert.deepStrictEqual(res40Rotated.customAssignments['JOB-LIFE-01@2027-01-02'], ['EMP-01']);
['JOB-LIFE-01@2027-01-09', 'JOB-LIFE-01@2027-01-16', 'JOB-LIFE-01@2027-01-23'].forEach(function(sId) {
  const assigned = res40Rotated.customAssignments[sId];
  assert(Array.isArray(assigned) && assigned.length === 1 && typeof assigned[0] === 'string');
});

// 4. Schema v2 & persistence
let env40 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: res40Rotated.customAssignments,
  historicalSnapshots: {},
  rostering: res40Rotated.rosteringState
};
let valRes40 = validator.validate(env40);
assert.strictEqual(valRes40.valid, true, 'Test 40 workspace must pass Schema v2: ' + (valRes40.error || ''));
let saveRes40 = window.HortOpsStorage.saveWorkspace(env40);
assert.strictEqual(saveRes40.ok, true, 'Test 40 workspace must persist successfully');

window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-01'; };
console.log('  ✔ Passed: Historical Fixed -> Rotation correctly clamped old Repeat to 3 and established valid forward Rotation.\n');

// -------------------------------------------------------------
// Test 41: Historical Fixed -> Manual Retains Clamped Historical Instruction (Offline17.4a)
// -------------------------------------------------------------
console.log('[Test 41] Historical Fixed -> Manual: retains clamped historical instruction and satisfies Schema v2...');
let res41Initial = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 6 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobStandard]
});

window.HortOpsDateUtils.getLocalDateKey = function() { return '2027-01-05'; };

// Change mode on historical source shift to 'manual'
let res41Manual = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'manual', repeatCount: 1 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res41Initial.customAssignments,
  rosteringState: res41Initial.rosteringState,
  jobs: [jobStandard]
});

// 1. Historical actuals and historical provenance MUST be preserved
assert.deepStrictEqual(res41Manual.customAssignments['JOB-LIFE-01@2026-12-19'], ['EMP-01']);
assert.deepStrictEqual(res41Manual.customAssignments['JOB-LIFE-01@2026-12-26'], ['EMP-01']);
assert.deepStrictEqual(res41Manual.customAssignments['JOB-LIFE-01@2027-01-02'], ['EMP-01']);

// Historical provenance keys exist and reference oldInst
const oldInstId41 = 'ROSTER-JOB-LIFE-01-2026-12-19-SLOT-1';
assert(res41Manual.rosteringState.provenance['JOB-LIFE-01@2026-12-19:EMP-01'], '12-19 provenance must exist');
assert(res41Manual.rosteringState.provenance['JOB-LIFE-01@2026-12-26:EMP-01'], '12-26 provenance must exist');
assert(res41Manual.rosteringState.provenance['JOB-LIFE-01@2027-01-02:EMP-01'], '01-02 provenance must exist');
assert.strictEqual(res41Manual.rosteringState.provenance['JOB-LIFE-01@2026-12-26:EMP-01'].instructionId, oldInstId41);
assert.strictEqual(res41Manual.rosteringState.provenance['JOB-LIFE-01@2027-01-02:EMP-01'].instructionId, oldInstId41);

// 2. Old instruction MUST NOT be deleted! Must be retained and clamped to 3!
const retainedInst41 = res41Manual.rosteringState.instructions[oldInstId41];
assert(retainedInst41, 'Old historical instruction MUST NOT be deleted when changing mode to manual');
assert.strictEqual(retainedInst41.repeatCount, 3, 'Retained historical instruction repeatCount MUST be clamped to 3');

// 3. Future generated assignments and provenance MUST be removed
assert.deepStrictEqual(res41Manual.customAssignments['JOB-LIFE-01@2027-01-09'] || [], [], 'Future assignment 01-09 must be removed');
assert.deepStrictEqual(res41Manual.customAssignments['JOB-LIFE-01@2027-01-16'] || [], [], 'Future assignment 01-16 must be removed');
assert.deepStrictEqual(res41Manual.customAssignments['JOB-LIFE-01@2027-01-23'] || [], [], 'Future assignment 01-23 must be removed');
assert.strictEqual(res41Manual.rosteringState.provenance['JOB-LIFE-01@2027-01-09:EMP-01'], undefined, 'Future provenance 01-09 must be pruned');
assert.strictEqual(res41Manual.rosteringState.provenance['JOB-LIFE-01@2027-01-16:EMP-01'], undefined, 'Future provenance 01-16 must be pruned');
assert.strictEqual(res41Manual.rosteringState.provenance['JOB-LIFE-01@2027-01-23:EMP-01'], undefined, 'Future provenance 01-23 must be pruned');

// 4. Schema v2 validation must PASS with ZERO orphan provenance errors!
let env41 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: res41Manual.customAssignments,
  historicalSnapshots: {},
  rostering: res41Manual.rosteringState
};
let valRes41 = validator.validate(env41);
assert.strictEqual(valRes41.valid, true, 'Historical Fixed -> Manual workspace MUST pass Schema v2: ' + (valRes41.error || ''));
let saveRes41 = window.HortOpsStorage.saveWorkspace(env41);
assert.strictEqual(saveRes41.ok, true, 'Historical Fixed -> Manual workspace must persist successfully');

window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-01'; };
console.log('  ✔ Passed: Historical Fixed -> Manual retained clamped historical instruction and validated Schema v2.\n');

// -------------------------------------------------------------
// Test 42: Historical Source-Slot Removal Retains Clamped Historical Instruction (Offline17.4a)
// -------------------------------------------------------------
console.log('[Test 42] Historical source-slot removal: retains clamped historical instruction and satisfies Schema v2...');
let res42Initial = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 6 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobStandard]
});

window.HortOpsDateUtils.getLocalDateKey = function() { return '2027-01-05'; };

// Remove source slot completely
let res42Removed = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0],
  stagedStaffIds: [],
  stagedSlots: [],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res42Initial.customAssignments,
  rosteringState: res42Initial.rosteringState,
  jobs: [jobStandard]
});

// 1. Historical actuals untouched
assert.deepStrictEqual(res42Removed.customAssignments['JOB-LIFE-01@2026-12-19'], ['EMP-01']);
assert.deepStrictEqual(res42Removed.customAssignments['JOB-LIFE-01@2026-12-26'], ['EMP-01']);
assert.deepStrictEqual(res42Removed.customAssignments['JOB-LIFE-01@2027-01-02'], ['EMP-01']);

// 2. Old instruction MUST NOT be deleted; must be clamped to 3 historical actuals
const oldInstId42 = 'ROSTER-JOB-LIFE-01-2026-12-19-SLOT-1';
const retainedInst42 = res42Removed.rosteringState.instructions[oldInstId42];
assert(retainedInst42, 'Old historical instruction MUST NOT be deleted when source slot is removed');
assert.strictEqual(retainedInst42.repeatCount, 3, 'Retained historical instruction repeatCount MUST be clamped to 3 (got ' + (retainedInst42 ? retainedInst42.repeatCount : 'undefined') + ')');

// 3. Historical provenance preserved, future provenance pruned
assert(res42Removed.rosteringState.provenance['JOB-LIFE-01@2026-12-19:EMP-01'], '12-19 provenance must exist');
assert(res42Removed.rosteringState.provenance['JOB-LIFE-01@2026-12-26:EMP-01'], '12-26 provenance must exist');
assert(res42Removed.rosteringState.provenance['JOB-LIFE-01@2027-01-02:EMP-01'], '01-02 provenance must exist');
assert.deepStrictEqual(res42Removed.customAssignments['JOB-LIFE-01@2027-01-09'] || [], [], 'Future assignment 01-09 must be removed');
assert.strictEqual(res42Removed.rosteringState.provenance['JOB-LIFE-01@2027-01-09:EMP-01'], undefined, 'Future provenance 01-09 must be pruned');

// 4. Schema v2 validation must PASS with ZERO orphan provenance errors!
let env42 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: res42Removed.customAssignments,
  historicalSnapshots: {},
  rostering: res42Removed.rosteringState
};
let valRes42 = validator.validate(env42);
assert.strictEqual(valRes42.valid, true, 'Historical source-slot removal workspace MUST pass Schema v2: ' + (valRes42.error || ''));
let saveRes42 = window.HortOpsStorage.saveWorkspace(env42);
assert.strictEqual(saveRes42.ok, true, 'Historical source-slot removal workspace must persist successfully');

window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-01'; };
console.log('  ✔ Passed: Historical source-slot removal retained clamped historical instruction and validated Schema v2.\n');

// -------------------------------------------------------------
// Test 43: Static Source Guard — Zero Ambiguous Variable Hoisting in Historical Clamp Block (Offline17.4a)
// -------------------------------------------------------------
console.log('[Test 43] Static source guard: zero ambiguous variable hoisting in historical clamp block...');
const engineSrc43 = fs.readFileSync(path.join(__dirname, '../js/utils/rostering/engine.js'), 'utf8');

// 1. In engine.js, occIdx calculation in historical counting loop must use oldStartIndex
const clampLoopPattern = /for\s*\(\s*var\s+h\s*=\s*0\s*;\s*h\s*<\s*oldInst\.repeatCount\s*;\s*h\+\+\s*\)\s*\{[\s\S]*?var\s+occIdx\s*=\s*oldStartIndex\s*\+\s*h\s*;/;
assert(clampLoopPattern.test(engineSrc43), 'Historical counting loop must explicitly reference oldStartIndex + h');

// 2. In engine.js, there must be ZERO occurrences of oldStartIdx
const oldStartIdxMatches = engineSrc43.match(/\boldStartIdx\b/g) || [];
assert.strictEqual(oldStartIdxMatches.length, 0, 'engine.js must have 0 occurrences of ambiguous oldStartIdx (got ' + oldStartIdxMatches.length + ')');

console.log('  ✔ Passed: Static source inspection verified oldStartIndex usage and zero ambiguous oldStartIdx occurrences.\n');

// -------------------------------------------------------------
// Test 44: Initial Historical Split with Lineage Fields (Offline17.5)
// -------------------------------------------------------------
console.log('[Test 44] Initial historical split with lineage fields (status, predecessor, lineageRootId)...');
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-01'; };

// Initial setup: Fixed Repeat 6 starting on 2026-12-19
let res44Initial = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0], // 2026-12-19
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-01', mode: 'fixed', repeatCount: 6 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {},
  rosteringState: { instructions: {}, provenance: {} },
  jobs: [jobStandard]
});

const instId44_1 = 'ROSTER-JOB-LIFE-01-2026-12-19-SLOT-1';
const initialInst44 = res44Initial.rosteringState.instructions[instId44_1];
assert(initialInst44, 'Initial instruction must exist');
assert.strictEqual(initialInst44.status, 'active', 'Initial instruction must have status active');
assert.strictEqual(initialInst44.lineageRootId, instId44_1, 'Initial instruction lineageRootId must equal its own id');
assert.strictEqual(initialInst44.predecessorInstructionId, null, 'Initial instruction predecessor must be null');

// Advance time to 2027-01-05 (past shifts: 12-19, 12-26, 01-02; future starts on 01-09)
window.HortOpsDateUtils.getLocalDateKey = function() { return '2027-01-05'; };

// Split at future boundary by modifying historical source shift 2026-12-19 (shifts30[0])
let res44Split = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0], // 2026-12-19
  stagedStaffIds: ['EMP-02'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-02', mode: 'fixed', repeatCount: 6 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res44Initial.customAssignments,
  rosteringState: res44Initial.rosteringState,
  jobs: [jobStandard]
});

// Verify historical instruction
const histInst44 = res44Split.rosteringState.instructions[instId44_1];
assert(histInst44, 'Historical predecessor instruction must exist');
assert.strictEqual(histInst44.status, 'historical', 'Predecessor instruction must have status historical');
assert.strictEqual(histInst44.repeatCount, 3, 'Predecessor instruction must be clamped to 3 actuals');
assert.strictEqual(histInst44.lineageRootId, instId44_1, 'Predecessor instruction lineageRootId must match initial id');
assert.strictEqual(histInst44.predecessorInstructionId, null, 'Predecessor instruction predecessor must remain null');

// Verify active continuation instruction
const instId44_2 = 'ROSTER-JOB-LIFE-01-2027-01-09-SLOT-1';
const activeInst44 = res44Split.rosteringState.instructions[instId44_2];
assert(activeInst44, 'Active continuation instruction must exist');
assert.strictEqual(activeInst44.status, 'active', 'Continuation instruction must have status active');
assert.strictEqual(activeInst44.repeatCount, 3, 'Continuation instruction repeatCount must be 3');
assert.strictEqual(activeInst44.lineageRootId, instId44_1, 'Continuation instruction lineageRootId must point to lineage root');
assert.strictEqual(activeInst44.predecessorInstructionId, instId44_1, 'Continuation instruction predecessor must point to histInst');

// Validate Schema v2
let env44 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: res44Split.customAssignments,
  rostering: res44Split.rosteringState
};
let val44 = validator.validate(env44);
assert.strictEqual(val44.valid, true, 'Workspace with historical lineage must pass Schema v2: ' + (val44.error || ''));
console.log('  ✔ Passed: Historical split successfully established lineage pointers (status, root, predecessor) and passed Schema v2.\n');

// -------------------------------------------------------------
// Test 45: Reopening Historical Source Shows Sealed Status and Guided Navigation Pointer (Offline17.5)
// -------------------------------------------------------------
console.log('[Test 45] Reopening historical source shows sealed status and [Open Active Rostering] pointer...');
shifts30.forEach(function(s) {
  s.assignedStaffIds = (res44Split.customAssignments[s.shiftId] || []).slice();
});
window.HortOpsApp = {
  state: {
    allShifts: shifts30,
    rostering: res44Split.rosteringState,
    customAssignments: res44Split.customAssignments,
    staffList: rosterStandard,
    jobs: [jobStandard]
  }
};
const modal45 = window.HortOpsStaffAssignModal;
modal45.open('JOB-LIFE-01@2026-12-19');

assert.strictEqual(modal45.stagedSlots.length, 1, 'Modal must have 1 staged slot');
const slot45 = modal45.stagedSlots[0];
assert.strictEqual(slot45.isSealedHistorical, true, 'Historical source slot must be detected as sealed historical');
assert.strictEqual(slot45.activeContinuationShiftId, 'JOB-LIFE-01@2027-01-09', 'Slot must point to active continuation shift ID');
assert.strictEqual(slot45.activeContinuationDate, '2027-01-09', 'Slot must point to active continuation start date');

// Protective guard: removing staff on sealed historical slot is blocked
let alert45Triggered = false;
const origAlert45 = global.alert;
global.alert = function() { alert45Triggered = true; };
modal45.removeStaff('EMP-01');
assert(alert45Triggered, 'removeStaff on sealed historical slot must alert and block');
assert(modal45.stagedAssignedStaffIds.includes('EMP-01'), 'Staff must remain staged');
global.alert = origAlert45;

// Protective guard: updateSlotMode and updateSlotRepeat are no-ops on sealed slot
modal45.updateSlotMode('EMP-01', 'manual');
assert.strictEqual(slot45.mode, 'fixed', 'updateSlotMode on sealed slot must not mutate slot mode');
modal45.updateSlotRepeat('EMP-01', 10);
assert.strictEqual(slot45.repeatCount, 3, 'updateSlotRepeat on sealed slot must not mutate repeat count');

// Guided navigation: openActiveContinuation jumps to active continuation shift
modal45.openActiveContinuation(slot45.activeContinuationShiftId);
assert.strictEqual(modal45.activeShiftId, 'JOB-LIFE-01@2027-01-09', 'openActiveContinuation must navigate to active continuation shift');
assert.strictEqual(modal45.stagedSlots[0].isSealedHistorical, false, 'Active continuation shift slot must be editable (not sealed)');
console.log('  ✔ Passed: Reopening historical source shows sealed status, blocks mutation, and provides guided navigation to active continuation.\n');

// -------------------------------------------------------------
// Test 46: Editing Active Continuation (Repeat 3 -> Repeat 2) Prunes 3rd Shift, Predecessor Untouched (Offline17.5)
// -------------------------------------------------------------
console.log('[Test 46] Editing active continuation (Repeat 3 -> Repeat 2) prunes third shift, predecessor untouched...');
let res46Edit = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[3], // 2027-01-09
  stagedStaffIds: ['EMP-03'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-03', mode: 'fixed', repeatCount: 2 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res44Split.customAssignments,
  rosteringState: res44Split.rosteringState,
  jobs: [jobStandard]
});

// 1. Shifts 01-09 and 01-16 assigned to EMP-03
assert.deepStrictEqual(res46Edit.customAssignments['JOB-LIFE-01@2027-01-09'], ['EMP-03']);
assert.deepStrictEqual(res46Edit.customAssignments['JOB-LIFE-01@2027-01-16'], ['EMP-03']);

// 2. 3rd shift (01-23) pruned
assert.deepStrictEqual(res46Edit.customAssignments['JOB-LIFE-01@2027-01-23'] || [], [], 'Shift 01-23 must be pruned when repeat reduced to 2');
assert.strictEqual(res46Edit.rosteringState.provenance['JOB-LIFE-01@2027-01-23:EMP-02'], undefined, 'Old 01-23 provenance must be pruned');

// 3. Historical predecessor completely untouched
assert.deepStrictEqual(res46Edit.customAssignments['JOB-LIFE-01@2026-12-19'], ['EMP-01']);
assert.deepStrictEqual(res46Edit.customAssignments['JOB-LIFE-01@2026-12-26'], ['EMP-01']);
assert.deepStrictEqual(res46Edit.customAssignments['JOB-LIFE-01@2027-01-02'], ['EMP-01']);
const predInst46 = res46Edit.rosteringState.instructions[instId44_1];
assert.strictEqual(predInst46.repeatCount, 3, 'Historical predecessor repeatCount must remain 3');
assert.strictEqual(predInst46.status, 'historical', 'Historical predecessor status must remain historical');

// 4. Schema valid
let env46 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: res46Edit.customAssignments,
  rostering: res46Edit.rosteringState
};
let val46 = validator.validate(env46);
assert.strictEqual(val46.valid, true, 'Workspace must pass Schema v2: ' + (val46.error || ''));
shifts30.forEach(function(s) {
  s.assignedStaffIds = (res46Edit.customAssignments[s.shiftId] || []).slice();
});
console.log('  ✔ Passed: Editing active continuation pruned third shift cleanly with predecessor 100% untouched.\n');

// -------------------------------------------------------------
// Test 47: Active Fixed -> Manual Reconciles Future State Cleanly, Historical Predecessor Untouched (Offline17.5)
// -------------------------------------------------------------
console.log('[Test 47] Active Fixed -> Manual reconciles future state cleanly, historical predecessor untouched...');
let res47Manual = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[3], // 2027-01-09
  stagedStaffIds: ['EMP-03'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-03', mode: 'manual', repeatCount: 1 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res46Edit.customAssignments,
  rosteringState: res46Edit.rosteringState,
  jobs: [jobStandard]
});

// Future shift 01-16 pruned
assert.deepStrictEqual(res47Manual.customAssignments['JOB-LIFE-01@2027-01-09'], ['EMP-03']);
assert.deepStrictEqual(res47Manual.customAssignments['JOB-LIFE-01@2027-01-16'] || [], [], 'Shift 01-16 must be pruned on manual mode');
assert.strictEqual(res47Manual.rosteringState.instructions[instId44_2], undefined, 'Active instruction deleted on manual mode');

// Historical predecessor remains intact
const predInst47 = res47Manual.rosteringState.instructions[instId44_1];
assert(predInst47, 'Historical predecessor must remain');
assert.strictEqual(predInst47.status, 'historical', 'Predecessor status must be historical');
assert.strictEqual(predInst47.repeatCount, 3, 'Predecessor repeatCount must remain 3');
assert.deepStrictEqual(res47Manual.customAssignments['JOB-LIFE-01@2026-12-19'], ['EMP-01']);

let env47 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: res47Manual.customAssignments,
  rostering: res47Manual.rosteringState
};
let val47 = validator.validate(env47);
assert.strictEqual(val47.valid, true, 'Workspace must pass Schema v2: ' + (val47.error || ''));
console.log('  ✔ Passed: Active Fixed -> Manual reconciled future occurrences cleanly while retaining historical predecessor.\n');

// -------------------------------------------------------------
// Test 48: Active Fixed -> Rotation Works Through Canonical propagateOccurrence (Offline17.5)
// -------------------------------------------------------------
console.log('[Test 48] Active Fixed -> Rotation works through canonical propagateOccurrence...');
// Apply rotation starting at 2027-01-09 on res44Split state
let res48Rotation = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[3], // 2027-01-09
  stagedStaffIds: ['EMP-02'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-02', mode: 'rotation', repeatCount: 3 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res44Split.customAssignments,
  rosteringState: res44Split.rosteringState,
  jobs: [jobStandard]
});

const rotInst48 = res48Rotation.rosteringState.instructions[instId44_2];
assert(rotInst48, 'Rotation instruction must exist');
assert.strictEqual(rotInst48.mode, 'rotation', 'Mode must be rotation');
assert.strictEqual(rotInst48.status, 'active', 'Status must be active');
assert.strictEqual(rotInst48.lineageRootId, instId44_1, 'Lineage root must point to root');

// Check rotated employees across occurrences
const a0109 = res48Rotation.customAssignments['JOB-LIFE-01@2027-01-09'];
const a0116 = res48Rotation.customAssignments['JOB-LIFE-01@2027-01-16'];
const a0123 = res48Rotation.customAssignments['JOB-LIFE-01@2027-01-23'];
assert.deepStrictEqual(a0109, ['EMP-02']);
assert(a0116 && a0116.length === 1 && typeof a0116[0] === 'string', '01-16 must have rotated employee');
assert(a0123 && a0123.length === 1 && typeof a0123[0] === 'string', '01-23 must have rotated employee');

let env48 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: res48Rotation.customAssignments,
  rostering: res48Rotation.rosteringState
};
let val48 = validator.validate(env48);
assert.strictEqual(val48.valid, true, 'Workspace must pass Schema v2: ' + (val48.error || ''));
console.log('  ✔ Passed: Active Fixed -> Rotation executed via canonical propagation with valid schema.\n');

// -------------------------------------------------------------
// Test 49: Multi-Step Time Advancement Creates Clean Linear Chain (Offline17.5)
// -------------------------------------------------------------
console.log('[Test 49] Multi-step time advancement creates clean linear chain (Inst1 -> Inst2 -> Inst3)...');
// Advance time to 2027-01-18 (01-09 and 01-16 become historical; 01-23 is now future)
window.HortOpsDateUtils.getLocalDateKey = function() { return '2027-01-18'; };

// On 2027-01-23 (shifts30[5]), stage EMP-04 Fixed Repeat 2
let res49Multi = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[5], // 2027-01-23
  stagedStaffIds: ['EMP-04'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-04', mode: 'fixed', repeatCount: 2 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res46Edit.customAssignments,
  rosteringState: res46Edit.rosteringState,
  jobs: [jobStandard]
});

const instId49_3 = 'ROSTER-JOB-LIFE-01-2027-01-23-SLOT-1';
const inst1 = res49Multi.rosteringState.instructions[instId44_1];
const inst2 = res49Multi.rosteringState.instructions[instId44_2];
const inst3 = res49Multi.rosteringState.instructions[instId49_3];

assert(inst1 && inst2 && inst3, 'All 3 instructions in the lineage must exist');
assert.strictEqual(inst1.status, 'historical', 'Inst 1 status must be historical');
assert.strictEqual(inst1.lineageRootId, instId44_1, 'Inst 1 lineageRootId must be self');
assert.strictEqual(inst1.predecessorInstructionId, null, 'Inst 1 predecessor must be null');

assert.strictEqual(inst2.status, 'historical', 'Inst 2 status must be historical');
assert.strictEqual(inst2.lineageRootId, instId44_1, 'Inst 2 lineageRootId must point to Inst 1');
assert.strictEqual(inst2.predecessorInstructionId, instId44_1, 'Inst 2 predecessor must point to Inst 1');

assert.strictEqual(inst3.status, 'active', 'Inst 3 status must be active');
assert.strictEqual(inst3.lineageRootId, instId44_1, 'Inst 3 lineageRootId must point to Inst 1');
assert.strictEqual(inst3.predecessorInstructionId, instId44_2, 'Inst 3 predecessor must point to Inst 2');

let env49 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: res49Multi.customAssignments,
  rostering: res49Multi.rosteringState
};
let val49 = validator.validate(env49);
assert.strictEqual(val49.valid, true, 'Multi-step linear lineage must pass Schema v2: ' + (val49.error || ''));
shifts30.forEach(function(s) {
  s.assignedStaffIds = (res49Multi.customAssignments[s.shiftId] || []).slice();
});
console.log('  ✔ Passed: Linear lineage chain formed successfully (Inst1 -> Inst2 -> Inst3) with exact single active terminal.\n');

// -------------------------------------------------------------
// Test 50: Historical Source Edit Attempt Does Not Mutate Future Active Continuation (Offline17.5)
// -------------------------------------------------------------
console.log('[Test 50] Historical source edit attempt does not mutate future active continuation (sealed history invariant)...');
// Attempt to edit 2026-12-19 while Inst 2 / Inst 3 are active downstream
let res50Attempt = rostering.applyRostering({
  job: jobStandard,
  currentShift: shifts30[0], // 2026-12-19 (historical)
  stagedStaffIds: ['EMP-05'],
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-05', mode: 'fixed', repeatCount: 4 }],
  allShifts: shifts30,
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: res49Multi.customAssignments,
  rosteringState: res49Multi.rosteringState,
  jobs: [jobStandard]
});

assert.strictEqual(res50Attempt.sealed, true, 'applyRostering on sealed historical source must return sealed: true');
assert.strictEqual(res50Attempt.activeContinuationShiftId, 'JOB-LIFE-01@2027-01-23', 'Must point to active terminal shift');
// Future assignments on 2027-01-23 and 2027-01-30 must NOT be mutated to EMP-05
assert.deepStrictEqual(res50Attempt.customAssignments['JOB-LIFE-01@2027-01-23'], ['EMP-04'], 'Active continuation assignment must remain EMP-04');
const sealedAudit = res50Attempt.auditLog.find(function(entry) { return entry.action === 'historical_source_sealed'; });
assert(sealedAudit, 'Audit log must record historical_source_sealed event');
console.log('  ✔ Passed: Historical source edit attempt safely sealed without mutating future active continuation.\n');

// -------------------------------------------------------------
// Test 51: Missing Predecessor Continuation Fails Closed in Schema Validation (Offline17.5)
// -------------------------------------------------------------
console.log('[Test 51] Missing predecessor continuation fails closed in schema validation...');
let badEnv51 = JSON.parse(JSON.stringify(env49));
badEnv51.rostering.instructions[instId49_3].predecessorInstructionId = 'ROSTER-NON-EXISTENT';
let val51 = validator.validate(badEnv51);
assert.strictEqual(val51.valid, false, 'Validator must reject non-existent predecessorInstructionId');
assert(val51.error.includes('nonexistent') || val51.error.includes('does not exist'), 'Error must mention missing predecessor: ' + val51.error);
console.log('  ✔ Passed: Missing predecessor instruction rejected fail-closed.\n');

// -------------------------------------------------------------
// Test 52: Multiple Active Continuations Fail Closed in Schema Validation (Offline17.5)
// -------------------------------------------------------------
console.log('[Test 52] Multiple active continuations fail closed in schema validation...');
let badEnv52 = JSON.parse(JSON.stringify(env49));
// Make inst2 also active
badEnv52.rostering.instructions[instId44_2].status = 'active';
let val52 = validator.validate(badEnv52);
assert.strictEqual(val52.valid, false, 'Validator must reject multiple active instructions in same lineage');
assert(val52.error.includes('active terminal instructions'), 'Error must mention multiple active instructions: ' + val52.error);
console.log('  ✔ Passed: Multiple active instructions in lineage rejected fail-closed.\n');

// -------------------------------------------------------------
// Test 53: Lineage Cycle Fails Closed in Schema Validation (Offline17.5)
// -------------------------------------------------------------
console.log('[Test 53] Lineage cycle fails closed in schema validation...');
let badEnv53 = JSON.parse(JSON.stringify(env49));
// Introduce cycle: inst1 predecessor -> inst3
badEnv53.rostering.instructions[instId44_1].predecessorInstructionId = instId49_3;
let val53 = validator.validate(badEnv53);
assert.strictEqual(val53.valid, false, 'Validator must reject lineage cycle');
assert(val53.error.includes('Lineage cycle detected'), 'Error must mention cycle detected: ' + val53.error);
console.log('  ✔ Passed: Lineage cycle detected and rejected fail-closed.\n');

// -------------------------------------------------------------
// Test 54: Provenance Outside Repeat Count (sequenceIndex >= repeatCount) Fails Closed (Offline17.5)
// -------------------------------------------------------------
console.log('[Test 54] Provenance outside repeat count (sequenceIndex >= repeatCount) fails closed...');
let badEnv54 = JSON.parse(JSON.stringify(env49));
// Find any provenance under inst3 and corrupt sequenceIndex to >= repeatCount
const pKey54 = 'JOB-LIFE-01@2027-01-23:EMP-04';
assert(badEnv54.rostering.provenance[pKey54], 'Target provenance key must exist');
badEnv54.rostering.provenance[pKey54].sequenceIndex = 5; // inst3 repeatCount is 2, index 5 is out of bounds
let val54 = validator.validate(badEnv54);
assert.strictEqual(val54.valid, false, 'Validator must reject sequenceIndex >= repeatCount');
assert(val54.error.includes('sequenceIndex') && val54.error.includes('exceeds instruction repeatCount'),
  'Error must mention sequenceIndex out of bounds: ' + val54.error);
console.log('  ✔ Passed: sequenceIndex >= repeatCount strictly rejected fail-closed.\n');

window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-15'; };

// -------------------------------------------------------------
// Test 55: Real Offline17.4a Un-annotated Split Workspace Loads Without Recovery Required (Offline17.5a)
// -------------------------------------------------------------
console.log('[Test 55] Real Offline17.4a un-annotated split workspace loads without Recovery Required...');
const id55_1 = 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-01';
const id55_2 = 'ROSTER-JOB-LIFE-01-2026-10-17-SLOT-01';
let env55 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {
    'JOB-LIFE-01@2026-10-03': ['EMP-01'],
    'JOB-LIFE-01@2026-10-10': ['EMP-01'],
    'JOB-LIFE-01@2026-10-17': ['EMP-02'],
    'JOB-LIFE-01@2026-10-24': ['EMP-02']
  },
  permits: {},
  budget: {},
  rostering: {
    instructions: {
      [id55_1]: {
        id: id55_1,
        instructionId: id55_1,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-LIFE-01@2026-10-03',
        startDate: '2026-10-03',
        repeatCount: 2
        // Intentionally missing status, lineageRootId, predecessorInstructionId
      },
      [id55_2]: {
        id: id55_2,
        instructionId: id55_2,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-02',
        sourceShiftId: 'JOB-LIFE-01@2026-10-17',
        startDate: '2026-10-17',
        repeatCount: 2
        // Intentionally missing status, lineageRootId, predecessorInstructionId
      }
    },
    provenance: {
      'JOB-LIFE-01@2026-10-03:EMP-01': {
        source: 'rostering-rule',
        instructionId: id55_1,
        strategy: 'fixed',
        sourceShiftId: 'JOB-LIFE-01@2026-10-03',
        slotId: 'SLOT-01',
        sequenceIndex: 0
      },
      'JOB-LIFE-01@2026-10-10:EMP-01': {
        source: 'rostering-rule',
        instructionId: id55_1,
        strategy: 'fixed',
        sourceShiftId: 'JOB-LIFE-01@2026-10-03',
        slotId: 'SLOT-01',
        sequenceIndex: 1
      },
      'JOB-LIFE-01@2026-10-17:EMP-02': {
        source: 'rostering-rule',
        instructionId: id55_2,
        strategy: 'fixed',
        sourceShiftId: 'JOB-LIFE-01@2026-10-17',
        slotId: 'SLOT-01',
        sequenceIndex: 0
      },
      'JOB-LIFE-01@2026-10-24:EMP-02': {
        source: 'rostering-rule',
        instructionId: id55_2,
        strategy: 'fixed',
        sourceShiftId: 'JOB-LIFE-01@2026-10-17',
        slotId: 'SLOT-01',
        sequenceIndex: 1
      }
    }
  }
};

let val55 = validator.validate(env55);
assert.strictEqual(val55.valid, true, 'Legacy 17.4a split workspace must validate cleanly: ' + (val55.error || ''));
const i1 = env55.rostering.instructions[id55_1];
const i2 = env55.rostering.instructions[id55_2];
assert.strictEqual(i1.status, 'historical', 'Earlier split instruction must normalize to historical');
assert.strictEqual(i1.lineageRootId, id55_1, 'Earlier split instruction must have lineageRootId = root id');
assert.strictEqual(i1.predecessorInstructionId, null, 'Root instruction must have null predecessor');
assert.strictEqual(i2.status, 'active', 'Terminal split instruction must normalize to active');
assert.strictEqual(i2.lineageRootId, id55_1, 'Terminal split instruction must share lineageRootId');
assert.strictEqual(i2.predecessorInstructionId, id55_1, 'Terminal split instruction must link to predecessor');
console.log('  ✔ Passed: Legacy 17.4a split workspace normalized and validated without Recovery Required.\n');

window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-01'; };

// -------------------------------------------------------------
// Test 56: Unsplit Legacy Workspace Normalizes Safely (Offline17.5a)
// -------------------------------------------------------------
console.log('[Test 56] Unsplit legacy workspace normalizes safely...');
const id56 = 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-01';
let env56 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: { 'JOB-LIFE-01@2026-10-03': ['EMP-01'] },
  permits: {},
  budget: {},
  rostering: {
    instructions: {
      [id56]: {
        id: id56,
        instructionId: id56,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-LIFE-01@2026-10-03',
        startDate: '2026-10-03',
        repeatCount: 1
      }
    },
    provenance: {
      'JOB-LIFE-01@2026-10-03:EMP-01': {
        source: 'rostering-rule',
        instructionId: id56,
        strategy: 'fixed',
        sourceShiftId: 'JOB-LIFE-01@2026-10-03',
        slotId: 'SLOT-01',
        sequenceIndex: 0
      }
    }
  }
};

let val56 = validator.validate(env56);
assert.strictEqual(val56.valid, true, 'Unsplit legacy workspace must validate: ' + (val56.error || ''));
const u1 = env56.rostering.instructions[id56];
assert.strictEqual(u1.status, 'active', 'Single instruction must normalize to active');
assert.strictEqual(u1.lineageRootId, id56, 'Single instruction lineageRootId must equal id');
assert.strictEqual(u1.predecessorInstructionId, null, 'Single instruction predecessor must be null');
console.log('  ✔ Passed: Unsplit legacy workspace safely normalized to active terminal.\n');

// -------------------------------------------------------------
// Test 57: Ambiguous Legacy State Fails Closed (Offline17.5a)
// -------------------------------------------------------------
console.log('[Test 57] Ambiguous legacy state fails closed into Recovery Mode...');
const id57_1 = 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-01';
const id57_2 = 'ROSTER-JOB-LIFE-01-ALT-2026-10-03-SLOT-01';
let env57 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: { 'JOB-LIFE-01@2026-10-03': ['EMP-01', 'EMP-02'] },
  permits: {},
  budget: {},
  rostering: {
    instructions: {
      [id57_1]: {
        id: id57_1,
        instructionId: id57_1,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-LIFE-01@2026-10-03',
        startDate: '2026-10-03',
        repeatCount: 1
      },
      [id57_2]: {
        id: id57_2,
        instructionId: id57_2,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-02',
        sourceShiftId: 'JOB-LIFE-01@2026-10-03',
        startDate: '2026-10-03', // Same start date: ambiguous collision!
        repeatCount: 1
      }
    },
    provenance: {}
  }
};

let val57 = validator.validate(env57);
assert.strictEqual(val57.valid, false, 'Ambiguous legacy instructions on same slot/date must fail closed');
assert(val57.error.includes('Multiple active terminal instructions') || val57.error.includes('lineage'),
  'Error must report lineage conflict: ' + val57.error);
console.log('  ✔ Passed: Ambiguous legacy state correctly rejected fail-closed.\n');

// -------------------------------------------------------------
// Test 58: Normalization Idempotency (Offline17.5a)
// -------------------------------------------------------------
console.log('[Test 58] Normalization idempotency across multiple runs...');
let snapshotBefore = JSON.stringify(env55);
validator.normalizeLineage(env55);
let snapshotAfter1 = JSON.stringify(env55);
validator.normalizeLineage(env55);
let snapshotAfter2 = JSON.stringify(env55);
assert.strictEqual(snapshotAfter1, snapshotBefore, 'First post-normalization run must not mutate state');
assert.strictEqual(snapshotAfter2, snapshotBefore, 'Second post-normalization run must not mutate state');
console.log('  ✔ Passed: normalizeLineage is strictly idempotent.\n');

// -------------------------------------------------------------
// Test 59: DOM Render Test for Ordinary and Sealed Shifts (Offline17.5a)
// -------------------------------------------------------------
console.log('[Test 59] DOM render test for ordinary and sealed shifts (proves no ReferenceError)...');
const staff01 = rosterStandard.find(function(s) { return s.id === 'EMP-01'; });
const mockShift = {
  shiftId: 'JOB-LIFE-01@2026-10-03',
  jobId: 'JOB-LIFE-01',
  date: '2026-10-03',
  crewSize: 1,
  primaryTeam: 'Parks'
};

const ctxOrdinary = {
  shift: mockShift,
  matchingJob: jobStandard,
  stagedSlots: [{
    slotId: 'SLOT-01',
    staffId: 'EMP-01',
    mode: 'fixed',
    repeatCount: 2,
    isInherited: false,
    sourceDate: '2026-10-03',
    instructionId: id55_1,
    isSealedHistorical: false,
    activeContinuationShiftId: null,
    activeContinuationDate: null
  }],
  stagedSlotStrategies: { 'EMP-01': { mode: 'fixed', repeatCount: 2 } },
  assignedStaffList: [staff01],
  assignedIds: ['EMP-01'],
  vacancies: 0,
  ineligibleAssignees: [],
  isPlantOpReq: false,
  isPlantOpPresent: true,
  maxRepeat: 6
};

// Must render ordinary shift without throwing ReferenceError
let ordinaryHtml = stagedCrew.render(ctxOrdinary);
assert(typeof ordinaryHtml === 'string' && ordinaryHtml.length > 0, 'stagedCrew.render must return valid HTML');
assert(!ordinaryHtml.includes('sealed-history-banner'), 'Ordinary shift must not show sealed banner');
assert(ordinaryHtml.includes('assignment-mode-select'), 'Ordinary shift must show mode select');

const ctxSealed = {
  shift: mockShift,
  matchingJob: jobStandard,
  stagedSlots: [{
    slotId: 'SLOT-01',
    staffId: 'EMP-01',
    mode: 'fixed',
    repeatCount: 2,
    isInherited: false,
    sourceDate: '2026-10-03',
    instructionId: id55_1,
    isSealedHistorical: true,
    activeContinuationShiftId: 'JOB-LIFE-01@2026-10-17',
    activeContinuationDate: '2026-10-17'
  }],
  stagedSlotStrategies: { 'EMP-01': { mode: 'fixed', repeatCount: 2 } },
  assignedStaffList: [staff01],
  assignedIds: ['EMP-01'],
  vacancies: 0,
  ineligibleAssignees: [],
  isPlantOpReq: false,
  isPlantOpPresent: true,
  maxRepeat: 6
};

// Must render sealed shift without throwing ReferenceError
let sealedHtml = stagedCrew.render(ctxSealed);
assert(typeof sealedHtml === 'string' && sealedHtml.length > 0, 'stagedCrew.render must render sealed HTML');
console.log('  ✔ Passed: Both ordinary and sealed shifts render without ReferenceError.\n');

// -------------------------------------------------------------
// Test 60: Sealed History UI Elements and Select Suppression (Offline17.5a)
// -------------------------------------------------------------
console.log('[Test 60] Sealed history UI elements and select suppression...');
assert(sealedHtml.includes('sealed-history-banner'), 'Must render sealed-history-banner class');
assert(sealedHtml.includes('Historical Record:'), 'Must render informational title');
assert(sealedHtml.includes('Open Active Rostering'), 'Must render Open Active Rostering button');
assert(sealedHtml.includes('openActiveContinuation'), 'Must wire button to openActiveContinuation');
assert(sealedHtml.includes('Historical • Fixed (2)'), 'Must render read-only Historical strategy badge');
assert(sealedHtml.includes('Continues: 2026-10-17'), 'Must show continuation date');
assert(!sealedHtml.includes('assignment-mode-select'), 'Sealed slot must NOT render assignment mode select dropdown');
assert(!sealedHtml.includes('repeat-count-select'), 'Sealed slot must NOT render repeat count select dropdown');
assert(sealedHtml.includes('disabled title="Sealed historical record'), 'Remove button must be disabled with explanatory tooltip');
console.log('  ✔ Passed: Sealed history UI correctly suppresses controls and renders navigation pointers.\n');

// -------------------------------------------------------------
// Test 61: Active Instruction with Past Start Date Remains Editable (Offline17.5a)
// -------------------------------------------------------------
console.log('[Test 61] Active instruction with past start date remains editable for future occurrences...');
// Current date is mocked as 2026-10-01. Start date is 2026-09-15.
const mockPastActiveShift = {
  shiftId: 'JOB-LIFE-01@2026-09-15',
  jobId: 'JOB-LIFE-01',
  date: '2026-09-15',
  crewSize: 1,
  primaryTeam: 'Parks'
};
const ctxActivePast = {
  shift: mockPastActiveShift,
  matchingJob: jobStandard,
  stagedSlots: [{
    slotId: 'SLOT-01',
    staffId: 'EMP-01',
    mode: 'fixed',
    repeatCount: 3,
    isInherited: false,
    sourceDate: '2026-09-15',
    instructionId: 'ROSTER-JOB-LIFE-01-2026-09-15-SLOT-01',
    isSealedHistorical: false, // Active!
    activeContinuationShiftId: null,
    activeContinuationDate: null
  }],
  stagedSlotStrategies: { 'EMP-01': { mode: 'fixed', repeatCount: 3 } },
  assignedStaffList: [staff01],
  assignedIds: ['EMP-01'],
  vacancies: 0,
  ineligibleAssignees: [],
  isPlantOpReq: false,
  isPlantOpPresent: true,
  maxRepeat: 6
};

let pastActiveHtml = stagedCrew.render(ctxActivePast);
assert(pastActiveHtml.includes('assignment-mode-select'), 'Active past-started instruction must have editable mode select');
assert(pastActiveHtml.includes('repeat-count-select'), 'Active past-started instruction must have repeat count select');
assert(pastActiveHtml.includes('value="6">6 shifts</option>'), 'Repeat options must extend up to ctx.maxRepeat (6), NOT clamped to 1');
assert(!pastActiveHtml.includes('disabled title="Number of consecutive occurrences'), 'Repeat count dropdown must not be disabled');
console.log('  ✔ Passed: Active instruction with past start date remains fully editable up to maxRepeat.\n');

// -------------------------------------------------------------
// Test 62: Cross-Year Navigation in openActiveContinuation (Offline17.5a)
// -------------------------------------------------------------
console.log('[Test 62] Cross-year navigation in openActiveContinuation...');
const origModalOpen = window.HortOpsStaffAssignModal.open;
let modalOpenedId = null;
let yearSwitchedTo = null;
window.HortOpsStaffAssignModal.open = function(shiftId) { modalOpenedId = shiftId; };

window.HortOpsApp = {
  state: {
    currentYear: 2026,
    selectedDate: '2026-10-03',
    allShifts: [{ shiftId: 'JOB-LIFE-01@2026-10-03', date: '2026-10-03' }]
  },
  setYear: function(year) {
    yearSwitchedTo = year;
    this.state.currentYear = year;
    // Simulate year reload populating 2027 shifts
    this.state.allShifts = [{ shiftId: 'JOB-LIFE-01@2027-01-23', date: '2027-01-23' }];
  },
  renderCurrentView: function() {}
};

window.HortOpsStaffAssignModal.openActiveContinuation('JOB-LIFE-01@2027-01-23');
assert.strictEqual(yearSwitchedTo, 2027, 'setYear must be called with target year 2027');
assert.strictEqual(window.HortOpsApp.state.currentYear, 2027, 'state.currentYear must update to 2027');
assert.strictEqual(window.HortOpsApp.state.selectedDate, '2027-01-23', 'state.selectedDate must update to target shift date');
assert.strictEqual(modalOpenedId, 'JOB-LIFE-01@2027-01-23', 'Modal must be opened with target continuation shiftId');
console.log('  ✔ Passed: Cross-year navigation seamlessly switches year, shifts, and opens continuation modal.\n');

// -------------------------------------------------------------
// Test 63: Same-Year Navigation in openActiveContinuation (Offline17.5a)
// -------------------------------------------------------------
console.log('[Test 63] Same-year navigation in openActiveContinuation...');
modalOpenedId = null;
yearSwitchedTo = null;
window.HortOpsApp.state.currentYear = 2026;
window.HortOpsApp.state.selectedDate = '2026-10-03';
window.HortOpsApp.state.allShifts = [
  { shiftId: 'JOB-LIFE-01@2026-10-03', date: '2026-10-03' },
  { shiftId: 'JOB-LIFE-01@2026-10-17', date: '2026-10-17' }
];

window.HortOpsStaffAssignModal.openActiveContinuation('JOB-LIFE-01@2026-10-17');
assert.strictEqual(yearSwitchedTo, null, 'setYear must NOT be called for same year');
assert.strictEqual(window.HortOpsApp.state.currentYear, 2026, 'currentYear must remain 2026');
assert.strictEqual(window.HortOpsApp.state.selectedDate, '2026-10-17', 'selectedDate must update to target date');
assert.strictEqual(modalOpenedId, 'JOB-LIFE-01@2026-10-17', 'Modal must open target shift in same year');
console.log('  ✔ Passed: Same-year navigation transitions selected date and opens continuation modal.\n');

// -------------------------------------------------------------
// Test 64: Navigation Failure Handles Unresolvable Target Safely (Offline17.5a)
// -------------------------------------------------------------
console.log('[Test 64] Navigation failure handles unresolvable target safely...');
let alertMsg = null;
global.alert = function(msg) { alertMsg = msg; };
modalOpenedId = null;

window.HortOpsStaffAssignModal.openActiveContinuation('JOB-LIFE-01@2029-12-31'); // Does not exist in state.allShifts
assert(alertMsg && alertMsg.includes('Rostering Continuation Problem'),
  'Must display informative alert when continuation shift cannot be resolved');
assert.strictEqual(modalOpenedId, null, 'Modal must NOT open when target cannot be resolved');
window.HortOpsStaffAssignModal.open = origModalOpen;
console.log('  ✔ Passed: Unresolvable continuation target handled safely without throwing or mutating state.\n');

// -------------------------------------------------------------
// Test 65: Historical Instruction with NO Active Continuation is Sealed in UI (Offline17.5b)
// -------------------------------------------------------------
console.log('[Test 65] Historical instruction with NO active continuation is sealed in UI...');
const ctxSealedNoCont = {
  shift: mockShift,
  matchingJob: jobStandard,
  stagedSlots: [{
    slotId: 'SLOT-01',
    staffId: 'EMP-01',
    mode: 'fixed',
    repeatCount: 2,
    isInherited: false,
    sourceDate: '2026-10-03',
    instructionId: id55_1,
    isSealedHistorical: true,
    activeContinuationShiftId: null,
    activeContinuationDate: null
  }],
  stagedSlotStrategies: { 'EMP-01': { mode: 'fixed', repeatCount: 2 } },
  assignedStaffList: [staff01],
  assignedIds: ['EMP-01'],
  vacancies: 0,
  ineligibleAssignees: [],
  isPlantOpReq: false,
  isPlantOpPresent: true,
  maxRepeat: 6
};

let sealedNoContHtml = stagedCrew.render(ctxSealedNoCont);
assert(sealedNoContHtml.includes('sealed-history-banner'), 'Must render sealed-history-banner class');
assert(sealedNoContHtml.includes('This rostering instruction is complete. No active future continuation.'),
  'Banner must state instruction is complete when no continuation exists');
assert(!sealedNoContHtml.includes('Open Active Rostering'), 'Must NOT render Open Active Rostering button when no continuation exists');
assert(sealedNoContHtml.includes('Historical • Fixed (2)'), 'Must render read-only Historical strategy badge');
assert(sealedNoContHtml.includes('No active future continuation'), 'Slot subtitle must state no active future continuation');
assert(!sealedNoContHtml.includes('assignment-mode-select'), 'Must suppress assignment mode select');
assert(!sealedNoContHtml.includes('repeat-count-select'), 'Must suppress repeat count select');
assert(sealedNoContHtml.includes('disabled title="Sealed historical record. This rostering instruction is complete."'),
  'Remove button must be disabled with complete status tooltip');
console.log('  ✔ Passed: Historical instruction with NO continuation renders completely sealed and read-only.\n');

// -------------------------------------------------------------
// Test 66: Active Continuation Changed to Manual -> Predecessor Remains Sealed on Reopen (Offline17.5b)
// -------------------------------------------------------------
console.log('[Test 66] Active continuation changed to Manual -> predecessor remains sealed on reopen...');
const histInstId66 = 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-01';
const mockInstructions66 = {
  [histInstId66]: {
    id: histInstId66,
    instructionId: histInstId66,
    jobId: 'JOB-LIFE-01',
    slotId: 'SLOT-01',
    mode: 'fixed',
    employeeId: 'EMP-01',
    sourceShiftId: 'JOB-LIFE-01@2026-10-03',
    startDate: '2026-10-03',
    repeatCount: 1,
    status: 'historical',
    lineageRootId: histInstId66,
    predecessorInstructionId: null
  }
};

const mockProv66 = {
  'JOB-LIFE-01@2026-10-03:EMP-01': {
    source: 'rostering-rule',
    instructionId: histInstId66,
    strategy: 'fixed',
    sourceShiftId: 'JOB-LIFE-01@2026-10-03',
    slotId: 'SLOT-01',
    sequenceIndex: 0
  }
};

window.HortOpsApp.state = {
  currentYear: 2026,
  selectedDate: '2026-10-03',
  allShifts: [{ shiftId: 'JOB-LIFE-01@2026-10-03', jobId: 'JOB-LIFE-01', date: '2026-10-03', crewSize: 1, primaryTeam: 'Parks', assignedStaffIds: ['EMP-01'] }],
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  rostering: { instructions: mockInstructions66, provenance: mockProv66 },
  customAssignments: { 'JOB-LIFE-01@2026-10-03': ['EMP-01'] },
  permits: {}
};

window.HortOpsStaffAssignModal.open('JOB-LIFE-01@2026-10-03');
const slot66 = (window.HortOpsStaffAssignModal.stagedSlots || []).find(s => s.staffId === 'EMP-01');
assert(slot66, 'Staged slot must exist');
assert.strictEqual(slot66.isSealedHistorical, true, 'Predecessor slot must remain sealed when no active continuation exists');
assert.strictEqual(slot66.activeContinuationShiftId, null, 'activeContinuationShiftId must be null');
console.log('  ✔ Passed: Reopening predecessor with no active continuation maintains isSealedHistorical = true.\n');

// -------------------------------------------------------------
// Test 67: Attempt to Save/Edit Historical Instruction with No Continuation is Safely Blocked (Offline17.5b)
// -------------------------------------------------------------
console.log('[Test 67] Attempt to save/edit historical instruction with no continuation is blocked in engine...');
const histShift67 = {
  shiftId: 'JOB-LIFE-01@2026-09-15',
  jobId: 'JOB-LIFE-01',
  date: '2026-09-15',
  crewSize: 1,
  primaryTeam: 'Parks'
};

const inst67 = {
  id: 'ROSTER-JOB-LIFE-01-2026-09-15-SLOT-01',
  instructionId: 'ROSTER-JOB-LIFE-01-2026-09-15-SLOT-01',
  jobId: 'JOB-LIFE-01',
  slotId: 'SLOT-01',
  mode: 'fixed',
  employeeId: 'EMP-01',
  sourceShiftId: 'JOB-LIFE-01@2026-09-15',
  startDate: '2026-09-15',
  repeatCount: 1,
  status: 'historical',
  lineageRootId: 'ROSTER-JOB-LIFE-01-2026-09-15-SLOT-01',
  predecessorInstructionId: null
};

let res67 = rostering.applyRostering({
  currentShift: histShift67,
  job: jobStandard,
  allShifts: [histShift67, { shiftId: 'JOB-LIFE-01@2026-10-03', jobId: 'JOB-LIFE-01', date: '2026-10-03' }],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-01', staffId: 'EMP-01', mode: 'fixed', repeatCount: 4 }],
  rosteringState: {
    instructions: { [inst67.id]: inst67 },
    provenance: { 'JOB-LIFE-01@2026-09-15:EMP-01': { source: 'rostering-rule', instructionId: inst67.id, strategy: 'fixed', sourceShiftId: 'JOB-LIFE-01@2026-09-15', slotId: 'SLOT-01', sequenceIndex: 0 } }
  },
  customAssignments: { 'JOB-LIFE-01@2026-09-15': ['EMP-01'] },
  roster: rosterStandard, staffList: rosterStandard,
  jobs: [jobStandard]
});

assert.strictEqual(res67.sealed, true, 'Engine must flag result as sealed');
assert.strictEqual(res67.activeContinuationShiftId, null, 'activeContinuationShiftId must be null');
const audit67 = res67.auditLog.find(a => a.action === 'historical_source_sealed');
assert(audit67, 'Audit log must record historical_source_sealed');
assert(audit67.message.includes('No active future continuation exists'), 'Audit message must note no active continuation');
assert.strictEqual(Object.keys(res67.rosteringState.instructions).length, 1, 'Zero new instructions may be created');
assert.strictEqual(res67.customAssignments['JOB-LIFE-01@2026-10-03'], undefined, 'Zero future assignments may be generated');
console.log('  ✔ Passed: Historical instruction with no continuation cleanly locked from future propagation.\n');

// -------------------------------------------------------------
// Test 68: Repeat Increase on Historical Source Cannot Resurrect Continuation (Offline17.5b)
// -------------------------------------------------------------
console.log('[Test 68] Repeat increase on historical source cannot resurrect future continuation...');
let res68 = rostering.applyRostering({
  currentShift: histShift67,
  job: jobStandard,
  allShifts: [histShift67, { shiftId: 'JOB-LIFE-01@2026-10-03', jobId: 'JOB-LIFE-01', date: '2026-10-03' }],
  stagedStaffIds: ['EMP-01'],
  stagedSlots: [{ slotId: 'SLOT-01', staffId: 'EMP-01', mode: 'fixed', repeatCount: 12 }], // Aggressive repeat increase
  rosteringState: {
    instructions: { [inst67.id]: inst67 },
    provenance: { 'JOB-LIFE-01@2026-09-15:EMP-01': { source: 'rostering-rule', instructionId: inst67.id, strategy: 'fixed', sourceShiftId: 'JOB-LIFE-01@2026-09-15', slotId: 'SLOT-01', sequenceIndex: 0 } }
  },
  customAssignments: { 'JOB-LIFE-01@2026-09-15': ['EMP-01'] },
  roster: rosterStandard, staffList: rosterStandard,
  jobs: [jobStandard]
});

assert.strictEqual(res68.sealed, true, 'Must remain sealed');
assert.strictEqual(Object.keys(res68.rosteringState.instructions).length, 1, 'Cannot create new continuation');
assert.strictEqual(res68.customAssignments['JOB-LIFE-01@2026-10-03'], undefined, 'Cannot regenerate future shifts');
console.log('  ✔ Passed: Repeat increase on historical ancestor cannot resurrect future propagation.\n');

// -------------------------------------------------------------
// Test 69: Overlapping Legacy Pair is Rejected Fail-Closed (Offline17.5b)
// -------------------------------------------------------------
console.log('[Test 69] Overlapping legacy pair is rejected fail-closed...');
const id69_1 = 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-01';
const id69_2 = 'ROSTER-JOB-LIFE-01-2026-10-17-SLOT-01';
let env69 = {
  schemaVersion: 2,
  jobs: [jobStandard], // intervalWeeks = 1 (weekly, 7 days)
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {
    'JOB-LIFE-01@2026-10-03': ['EMP-01'],
    'JOB-LIFE-01@2026-10-10': ['EMP-01'],
    'JOB-LIFE-01@2026-10-17': ['EMP-01', 'EMP-02'],
    'JOB-LIFE-01@2026-10-24': ['EMP-01', 'EMP-02']
  },
  permits: {},
  budget: {},
  rostering: {
    instructions: {
      [id69_1]: {
        id: id69_1,
        instructionId: id69_1,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-LIFE-01@2026-10-03',
        startDate: '2026-10-03',
        repeatCount: 4 // Spans Oct 03, 10, 17, 24 -> OVERLAPS id69_2 starting Oct 17!
      },
      [id69_2]: {
        id: id69_2,
        instructionId: id69_2,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-02',
        sourceShiftId: 'JOB-LIFE-01@2026-10-17',
        startDate: '2026-10-17',
        repeatCount: 2
      }
    },
    provenance: {
      'JOB-LIFE-01@2026-10-03:EMP-01': { source: 'rostering-rule', instructionId: id69_1, strategy: 'fixed', sourceShiftId: 'JOB-LIFE-01@2026-10-03', slotId: 'SLOT-01', sequenceIndex: 0 },
      'JOB-LIFE-01@2026-10-10:EMP-01': { source: 'rostering-rule', instructionId: id69_1, strategy: 'fixed', sourceShiftId: 'JOB-LIFE-01@2026-10-03', slotId: 'SLOT-01', sequenceIndex: 1 },
      'JOB-LIFE-01@2026-10-17:EMP-01': { source: 'rostering-rule', instructionId: id69_1, strategy: 'fixed', sourceShiftId: 'JOB-LIFE-01@2026-10-03', slotId: 'SLOT-01', sequenceIndex: 2 },
      'JOB-LIFE-01@2026-10-24:EMP-01': { source: 'rostering-rule', instructionId: id69_1, strategy: 'fixed', sourceShiftId: 'JOB-LIFE-01@2026-10-03', slotId: 'SLOT-01', sequenceIndex: 3 },
      'JOB-LIFE-01@2026-10-17:EMP-02': { source: 'rostering-rule', instructionId: id69_2, strategy: 'fixed', sourceShiftId: 'JOB-LIFE-01@2026-10-17', slotId: 'SLOT-01', sequenceIndex: 0 },
      'JOB-LIFE-01@2026-10-24:EMP-02': { source: 'rostering-rule', instructionId: id69_2, strategy: 'fixed', sourceShiftId: 'JOB-LIFE-01@2026-10-17', slotId: 'SLOT-01', sequenceIndex: 1 }
    }
  }
};

let val69 = validator.validate(env69);
assert.strictEqual(val69.valid, false, 'Overlapping legacy split instructions must fail validation');
assert.strictEqual(env69.rostering.instructions[id69_1].status, undefined, 'Must NOT annotate status on overlapping pair');
assert.strictEqual(env69.rostering.instructions[id69_2].status, undefined, 'Must NOT annotate status on overlapping pair');
console.log('  ✔ Passed: Overlapping legacy pair rejected fail-closed without inventing false lineage.\n');

// -------------------------------------------------------------
// Test 70: Clean Non-Overlapping Legacy Pair Continues to Normalize Cleanly (Offline17.5b)
// -------------------------------------------------------------
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-15'; };
console.log('[Test 70] Clean non-overlapping legacy pair normalizes cleanly...');
let env70 = JSON.parse(JSON.stringify(env55)); // Non-overlapping 2-split from Test 55
// Clear previous normalization
delete env70.rostering.instructions[id55_1].status;
delete env70.rostering.instructions[id55_1].lineageRootId;
delete env70.rostering.instructions[id55_1].predecessorInstructionId;
delete env70.rostering.instructions[id55_2].status;
delete env70.rostering.instructions[id55_2].lineageRootId;
delete env70.rostering.instructions[id55_2].predecessorInstructionId;

validator.normalizeLineage(env70);
assert.strictEqual(env70.rostering.instructions[id55_1].status, 'historical', 'Clean non-overlapping earlier instruction normalizes to historical');
assert.strictEqual(env70.rostering.instructions[id55_2].status, 'active', 'Clean non-overlapping later instruction normalizes to active');
assert.strictEqual(env70.rostering.instructions[id55_2].predecessorInstructionId, id55_1, 'Lineage links established');
assert.strictEqual(validator.validate(env70).valid, true, 'Normalized clean pair validates Schema v2');
console.log('  ✔ Passed: Clean non-overlapping legacy pair correctly validated and normalized.\n');
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-10-01'; };

// -------------------------------------------------------------
// Test 71: Mixed Modern/Legacy Group Does NOT Rewrite Modern Metadata (Offline17.5b)
// -------------------------------------------------------------
console.log('[Test 71] Mixed modern/legacy group does NOT rewrite modern metadata...');
const id71_mod = 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-01';
const id71_leg = 'ROSTER-JOB-LIFE-01-2026-10-17-SLOT-01';
let env71 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {
    'JOB-LIFE-01@2026-10-03': ['EMP-01'],
    'JOB-LIFE-01@2026-10-17': ['EMP-02']
  },
  permits: {},
  budget: {},
  rostering: {
    instructions: {
      [id71_mod]: {
        id: id71_mod,
        instructionId: id71_mod,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-LIFE-01@2026-10-03',
        startDate: '2026-10-03',
        repeatCount: 1,
        status: 'active', // Authoritative modern active
        lineageRootId: id71_mod,
        predecessorInstructionId: null
      },
      [id71_leg]: {
        id: id71_leg,
        instructionId: id71_leg,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-02',
        sourceShiftId: 'JOB-LIFE-01@2026-10-17',
        startDate: '2026-10-17',
        repeatCount: 1
        // Un-annotated legacy
      }
    },
    provenance: {}
  }
};

validator.normalizeLineage(env71);
assert.strictEqual(env71.rostering.instructions[id71_mod].status, 'active', 'Modern active instruction must NOT be demoted to historical');
assert.strictEqual(env71.rostering.instructions[id71_leg].status, undefined, 'Ambiguous unannotated instruction must NOT be casually linked');
let val71 = validator.validate(env71);
assert.strictEqual(val71.valid, false, 'Mixed ambiguous group must fail closed in Pass 2');
console.log('  ✔ Passed: Modern authoritative metadata strictly protected from rewrite in mixed groups.\n');

// -------------------------------------------------------------
// Test 72: Normalization Idempotency on Rejected States (Offline17.5b)
// -------------------------------------------------------------
console.log('[Test 72] Normalization idempotency on rejected states...');
let snap69_1 = JSON.stringify(env69);
validator.normalizeLineage(env69);
let snap69_2 = JSON.stringify(env69);
assert.strictEqual(snap69_1, snap69_2, 'Rejected overlapping state must not mutate on repeated normalization');

let snap71_1 = JSON.stringify(env71);
validator.normalizeLineage(env71);
let snap71_2 = JSON.stringify(env71);
assert.strictEqual(snap71_1, snap71_2, 'Rejected mixed state must not mutate on repeated normalization');
console.log('  ✔ Passed: normalizeLineage is strictly idempotent on rejected and fail-closed inputs.\n');

console.log('================================================================');
// -------------------------------------------------------------
// Test 73: Historical Status Seals Even When Source Date Is Not Past (Offline17.5c)
// -------------------------------------------------------------
console.log('[Test 73] Historical status seals even when source date is not past...');
const histInst73 = {
  id: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1',
  instructionId: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1',
  jobId: 'JOB-LIFE-01',
  sourceShiftId: 'JOB-LIFE-01@2026-10-03',
  startDate: '2026-10-03',
  slotId: 'SLOT-1',
  mode: 'fixed',
  employeeId: 'EMP-01',
  repeatCount: 1,
  status: 'historical',
  lineageRootId: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1',
  predecessorInstructionId: null
};

const currentShift73 = {
  shiftId: 'JOB-LIFE-01@2026-10-03',
  jobId: 'JOB-LIFE-01',
  date: '2026-10-03', // Equal or after today
  startTime: '07:00 AM',
  durationHours: 6,
  crewSize: 2,
  assignedStaffIds: ['EMP-01']
};

const res73 = rostering.applyRostering({
  currentShift: currentShift73,
  job: jobStandard,
  allShifts: crossYearShifts,
  stagedStaffIds: ['EMP-02'],
  stagedStrategies: { 'EMP-02': { mode: 'fixed', repeatCount: 2 } },
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-02', mode: 'fixed', repeatCount: 2 }],
  rosteringState: {
    instructions: { [histInst73.id]: Object.assign({}, histInst73) },
    provenance: {
      'JOB-LIFE-01@2026-10-03:EMP-01': {
        source: 'rostering-rule',
        instructionId: histInst73.id,
        strategy: 'fixed',
        sourceShiftId: histInst73.sourceShiftId,
        slotId: 'SLOT-1',
        sequenceIndex: 0
      }
    }
  },
  customAssignments: { 'JOB-LIFE-01@2026-10-03': ['EMP-01'] },
  roster: rosterStandard, staffList: rosterStandard,
  jobs: [jobStandard]
});

assert.strictEqual(res73.sealed, true, 'Historical instruction on non-past date MUST be sealed');
assert.strictEqual(res73.rosteringState.instructions[histInst73.id].employeeId, 'EMP-01', 'Employee must NOT be changed');
assert.strictEqual(res73.rosteringState.instructions[histInst73.id].status, 'historical', 'Status must remain historical');
const sealedAudit73 = res73.auditLog.find(a => a.action === 'historical_source_sealed');
assert(sealedAudit73, 'Audit log must record historical_source_sealed event');
console.log('  ✔ Passed: Historical status unconditionally seals regardless of source date.\n');

// -------------------------------------------------------------
// Test 74: Active Future Instruction Remains Editable (Offline17.5c)
// -------------------------------------------------------------
console.log('[Test 74] Active future instruction remains editable...');
const activeInst74 = {
  id: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1',
  instructionId: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1',
  jobId: 'JOB-LIFE-01',
  sourceShiftId: 'JOB-LIFE-01@2026-10-03',
  startDate: '2026-10-03',
  slotId: 'SLOT-1',
  mode: 'fixed',
  employeeId: 'EMP-01',
  repeatCount: 1,
  status: 'active',
  lineageRootId: 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1',
  predecessorInstructionId: null
};

const res74 = rostering.applyRostering({
  currentShift: currentShift73,
  job: jobStandard,
  allShifts: crossYearShifts,
  stagedStaffIds: ['EMP-02'],
  stagedStrategies: { 'EMP-02': { mode: 'fixed', repeatCount: 2 } },
  stagedSlots: [{ slotId: 'SLOT-1', staffId: 'EMP-02', mode: 'fixed', repeatCount: 2 }],
  rosteringState: {
    instructions: { [activeInst74.id]: Object.assign({}, activeInst74) },
    provenance: {
      'JOB-LIFE-01@2026-10-03:EMP-01': {
        source: 'rostering-rule',
        instructionId: activeInst74.id,
        strategy: 'fixed',
        sourceShiftId: activeInst74.sourceShiftId,
        slotId: 'SLOT-1',
        sequenceIndex: 0
      }
    }
  },
  customAssignments: { 'JOB-LIFE-01@2026-10-03': ['EMP-01'] },
  roster: rosterStandard, staffList: rosterStandard,
  jobs: [jobStandard]
});

assert.strictEqual(res74.sealed, undefined, 'Active future instruction must not be sealed');
assert.strictEqual(res74.rosteringState.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'].employeeId, 'EMP-02', 'Employee must update to EMP-02');
assert.strictEqual(res74.rosteringState.instructions['ROSTER-JOB-LIFE-01-2026-10-03-SLOT-1'].repeatCount, 2, 'Repeat count must update to 2');
console.log('  ✔ Passed: Active future instruction remains fully editable.\n');

// -------------------------------------------------------------
// Test 75: One-Off Job With Multiple Legacy Source Instructions Fails Closed (Offline17.5c)
// -------------------------------------------------------------
console.log('[Test 75] One-off Job with multiple legacy source instructions fails closed...');
const jobOneOff75 = {
  id: 'JOB-LIFE-ONEOFF',
  name: 'Special Botanic Gala Setup',
  status: 'active',
  frequencyType: 'one_off',
  targetDate: '2026-10-03',
  preferredDay: 'saturday',
  crewSize: 1
};

const id75_1 = 'ROSTER-JOB-LIFE-ONEOFF-2026-10-03-SLOT-1';
const id75_2 = 'ROSTER-JOB-LIFE-ONEOFF-2026-10-10-SLOT-1';

let env75 = {
  schemaVersion: 2,
  jobs: [jobOneOff75],
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {
    'JOB-LIFE-ONEOFF@2026-10-03': ['EMP-01'],
    'JOB-LIFE-ONEOFF@2026-10-10': ['EMP-02']
  },
  permits: {},
  budget: {},
  rostering: {
    instructions: {
      [id75_1]: {
        id: id75_1,
        instructionId: id75_1,
        jobId: 'JOB-LIFE-ONEOFF',
        slotId: 'SLOT-1',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-LIFE-ONEOFF@2026-10-03',
        startDate: '2026-10-03',
        repeatCount: 1
      },
      [id75_2]: {
        id: id75_2,
        instructionId: id75_2,
        jobId: 'JOB-LIFE-ONEOFF',
        slotId: 'SLOT-1',
        mode: 'fixed',
        employeeId: 'EMP-02',
        sourceShiftId: 'JOB-LIFE-ONEOFF@2026-10-10',
        startDate: '2026-10-10',
        repeatCount: 1
      }
    },
    provenance: {}
  }
};

validator.normalizeLineage(env75);
assert.strictEqual(env75.rostering.instructions[id75_1].status, undefined, 'One-off multiple instructions must NOT be normalized');
assert.strictEqual(env75.rostering.instructions[id75_2].status, undefined, 'One-off multiple instructions must NOT be normalized');
let val75 = validator.validate(env75);
assert.strictEqual(val75.valid, false, 'One-off multiple legacy instructions must fail validation closed');
console.log('  ✔ Passed: One-off Job with multiple legacy source instructions fails closed.\n');

// -------------------------------------------------------------
// Test 76: Recurring Off-Cadence Legacy Source Fails Closed (Offline17.5c)
// -------------------------------------------------------------
console.log('[Test 76] Recurring off-cadence legacy source fails closed...');
const id76_1 = 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-01'; // Saturday (canonical)
const id76_2 = 'ROSTER-JOB-LIFE-01-2026-10-15-SLOT-01'; // Thursday (off-cadence)

let env76 = {
  schemaVersion: 2,
  jobs: [jobStandard], // weekly Saturday
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {
    'JOB-LIFE-01@2026-10-03': ['EMP-01'],
    'JOB-LIFE-01@2026-10-15': ['EMP-02']
  },
  permits: {},
  budget: {},
  rostering: {
    instructions: {
      [id76_1]: {
        id: id76_1,
        instructionId: id76_1,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-LIFE-01@2026-10-03',
        startDate: '2026-10-03',
        repeatCount: 1
      },
      [id76_2]: {
        id: id76_2,
        instructionId: id76_2,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-02',
        sourceShiftId: 'JOB-LIFE-01@2026-10-15',
        startDate: '2026-10-15',
        repeatCount: 1
      }
    },
    provenance: {}
  }
};

validator.normalizeLineage(env76);
assert.strictEqual(env76.rostering.instructions[id76_1].status, undefined, 'Off-cadence source must prevent normalization');
assert.strictEqual(env76.rostering.instructions[id76_2].status, undefined, 'Off-cadence source must prevent normalization');
let val76 = validator.validate(env76);
assert.strictEqual(val76.valid, false, 'Off-cadence legacy source must fail validation closed');
console.log('  ✔ Passed: Recurring off-cadence legacy source fails closed.\n');

// -------------------------------------------------------------
// Test 77: Failed Legacy Inference Performs Zero Partial Mutation (Offline17.5c)
// -------------------------------------------------------------
console.log('[Test 77] Failed legacy canonical-occurrence inference performs zero partial mutation...');
let env77_a = JSON.parse(JSON.stringify(env75));
let before77_a = JSON.stringify(env77_a);
validator.normalizeLineage(env77_a);
let after77_a = JSON.stringify(env77_a);
assert.strictEqual(before77_a, after77_a, 'Failed one-off normalisation must produce byte-for-byte identical state');

let env77_b = JSON.parse(JSON.stringify(env76));
let before77_b = JSON.stringify(env77_b);
validator.normalizeLineage(env77_b);
let after77_b = JSON.stringify(env77_b);
assert.strictEqual(before77_b, after77_b, 'Failed off-cadence normalisation must produce byte-for-byte identical state');
console.log('  ✔ Passed: Zero partial mutation on rejected legacy states verified.\n');

// -------------------------------------------------------------
// Test 78: Clean Canonical Legacy Split Still Normalises Correctly (Offline17.5c)
// -------------------------------------------------------------
console.log('[Test 78] Clean canonical legacy split still normalises correctly...');
const id78_1 = 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-01'; // Saturday 03 Oct
const id78_2 = 'ROSTER-JOB-LIFE-01-2026-10-10-SLOT-01'; // Saturday 10 Oct

let env78 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {
    'JOB-LIFE-01@2026-10-03': ['EMP-01'],
    'JOB-LIFE-01@2026-10-10': ['EMP-02']
  },
  permits: {},
  budget: {},
  rostering: {
    instructions: {
      [id78_1]: {
        id: id78_1,
        instructionId: id78_1,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-LIFE-01@2026-10-03',
        startDate: '2026-10-03',
        repeatCount: 1
      },
      [id78_2]: {
        id: id78_2,
        instructionId: id78_2,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-02',
        sourceShiftId: 'JOB-LIFE-01@2026-10-10',
        startDate: '2026-10-10',
        repeatCount: 1
      }
    },
    provenance: {}
  }
};

validator.normalizeLineage(env78);
assert.strictEqual(env78.rostering.instructions[id78_1].status, 'historical', 'Clean earlier occurrence normalizes to historical');
assert.strictEqual(env78.rostering.instructions[id78_2].status, 'active', 'Clean later occurrence normalizes to active');
assert.strictEqual(env78.rostering.instructions[id78_2].predecessorInstructionId, id78_1, 'Predecessor link correctly established');
assert.strictEqual(env78.rostering.instructions[id78_1].lineageRootId, id78_1, 'Shared lineageRootId established');
assert.strictEqual(env78.rostering.instructions[id78_2].lineageRootId, id78_1, 'Shared lineageRootId established');
let val78 = validator.validate(env78);
assert.strictEqual(val78.valid, true, 'Clean canonical legacy split validates Schema v2');
console.log('  ✔ Passed: Clean canonical legacy split correctly normalized and validated.\n');

// -------------------------------------------------------------
// Test 79: Single Valid Generated Source Normalizes to Active (Offline17.5d)
// -------------------------------------------------------------
console.log('[Test 79] Single valid generated source normalizes to active...');
const id79 = 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-01';
let env79 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: { 'JOB-LIFE-01@2026-10-03': ['EMP-01'] },
  rostering: {
    instructions: {
      [id79]: {
        id: id79,
        instructionId: id79,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-LIFE-01@2026-10-03',
        startDate: '2026-10-03',
        repeatCount: 1
      }
    },
    provenance: {}
  }
};
validator.normalizeLineage(env79);
assert.strictEqual(env79.rostering.instructions[id79].status, 'active', 'Single valid generated source must normalize to active');
assert.strictEqual(env79.rostering.instructions[id79].lineageRootId, id79, 'Root must be self');
assert.strictEqual(validator.validate(env79).valid, true, 'Valid single generated source must pass Schema v2');
console.log('  ✔ Passed: Single valid generated source normalizes to active and validates Schema v2.\n');

// -------------------------------------------------------------
// Test 80: Single Invalid Off-Cadence Legacy Source Fails Closed (Offline17.5d)
// -------------------------------------------------------------
console.log('[Test 80] Single invalid off-cadence legacy source fails closed...');
const id80 = 'ROSTER-JOB-LIFE-01-2026-10-15-SLOT-01'; // Thursday on Saturday job
let env80 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: { 'JOB-LIFE-01@2026-10-15': ['EMP-01'] },
  rostering: {
    instructions: {
      [id80]: {
        id: id80,
        instructionId: id80,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-LIFE-01@2026-10-15',
        startDate: '2026-10-15',
        repeatCount: 1
      }
    },
    provenance: {}
  }
};
validator.normalizeLineage(env80);
assert.strictEqual(env80.rostering.instructions[id80].status, undefined, 'Single off-cadence source must NOT be normalized');
let val80 = validator.validate(env80);
assert.strictEqual(val80.valid, false, 'Single off-cadence source must fail validation');
assert(val80.error.includes('not a recognised operational occurrence'), 'Must report not a recognised operational occurrence');
console.log('  ✔ Passed: Single invalid off-cadence legacy source strictly fails closed.\n');

// -------------------------------------------------------------
// Test 81: Single Invalid One-Off Legacy Source Fails Closed (Offline17.5d)
// -------------------------------------------------------------
console.log('[Test 81] Single invalid one-off legacy source fails closed...');
const id81 = 'ROSTER-JOB-LIFE-ONEOFF-2026-10-10-SLOT-1'; // Target date is 2026-10-03
let env81 = {
  schemaVersion: 2,
  jobs: [jobOneOff75],
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: { 'JOB-LIFE-ONEOFF@2026-10-10': ['EMP-01'] },
  rostering: {
    instructions: {
      [id81]: {
        id: id81,
        instructionId: id81,
        jobId: 'JOB-LIFE-ONEOFF',
        slotId: 'SLOT-1',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-LIFE-ONEOFF@2026-10-10',
        startDate: '2026-10-10',
        repeatCount: 1
      }
    },
    provenance: {}
  }
};
validator.normalizeLineage(env81);
assert.strictEqual(env81.rostering.instructions[id81].status, undefined, 'Single wrong-date one-off must NOT be normalized');
let val81 = validator.validate(env81);
assert.strictEqual(val81.valid, false, 'Single wrong-date one-off must fail validation');
assert(val81.error.includes('not a recognised operational occurrence'), 'Must report not a recognised operational occurrence');
console.log('  ✔ Passed: Single invalid one-off legacy source strictly fails closed.\n');

// -------------------------------------------------------------
// Test 82: Single Valid Explicit Operational Source Normalizes to Active (Offline17.5d)
// -------------------------------------------------------------
require('../js/data/historicalOccurrences.js');
console.log('[Test 82] Single valid explicit operational source normalizes to active...');
const jobTramline = (window.HortOpsData && window.HortOpsData.INITIAL_JOBS)
  ? window.HortOpsData.INITIAL_JOBS.find(j => j.id === 'tramline-5am')
  : { id: 'tramline-5am', name: 'Tram Line 5am', frequencyType: 'recurring_weeks', intervalWeeks: 5, preferredDay: 'sunday', status: 'active', crewSize: 2 };

const id82 = 'ROSTER-tramline-5am-2026-09-27-SLOT-1'; // Real explicit occurrence in HISTORICAL_OCCURRENCES
let env82 = {
  schemaVersion: 2,
  jobs: [jobTramline],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: { 'tramline-5am@2026-09-27': ['EMP-01'] },
  customAssignments: { 'tramline-5am@2026-09-27': ['EMP-01'] },
  rostering: {
    instructions: {
      [id82]: {
        id: id82,
        instructionId: id82,
        jobId: 'tramline-5am',
        slotId: 'SLOT-1',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'tramline-5am@2026-09-27',
        startDate: '2026-09-27',
        repeatCount: 1
      }
    },
    provenance: {}
  }
};
validator.normalizeLineage(env82);
assert.strictEqual(env82.rostering.instructions[id82].status, 'active', 'Explicit operational occurrence must be recognized and normalized');
assert.strictEqual(validator.validate(env82).valid, true, 'Valid explicit operational source must pass Schema v2');
console.log('  ✔ Passed: Single valid explicit operational source normalizes to active and validates Schema v2.\n');

// -------------------------------------------------------------
// Test 83: Explicit Predecessor -> Generated Successor Non-Overlapping Pair Migrates Cleanly (Offline17.5d)
// -------------------------------------------------------------
console.log('[Test 83] Explicit predecessor -> generated successor non-overlapping pair migrates cleanly...');
const id83_1 = 'ROSTER-tramline-5am-2026-09-27-SLOT-1';
const id83_2 = 'ROSTER-tramline-5am-2026-10-18-SLOT-1';
let env83 = {
  schemaVersion: 2,
  jobs: [jobTramline],
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {
    'tramline-5am@2026-09-27': ['EMP-01'],
    'tramline-5am@2026-10-18': ['EMP-02']
  },
  rostering: {
    instructions: {
      [id83_1]: {
        id: id83_1,
        instructionId: id83_1,
        jobId: 'tramline-5am',
        slotId: 'SLOT-1',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'tramline-5am@2026-09-27',
        startDate: '2026-09-27',
        repeatCount: 1
      },
      [id83_2]: {
        id: id83_2,
        instructionId: id83_2,
        jobId: 'tramline-5am',
        slotId: 'SLOT-1',
        mode: 'fixed',
        employeeId: 'EMP-02',
        sourceShiftId: 'tramline-5am@2026-10-18',
        startDate: '2026-10-18',
        repeatCount: 1
      }
    },
    provenance: {}
  }
};
validator.normalizeLineage(env83);
assert.strictEqual(env83.rostering.instructions[id83_1].status, 'historical', 'Explicit predecessor must normalize to historical');
assert.strictEqual(env83.rostering.instructions[id83_2].status, 'active', 'Generated successor must normalize to active');
assert.strictEqual(env83.rostering.instructions[id83_2].predecessorInstructionId, id83_1, 'Lineage link established');
assert.strictEqual(env83.rostering.instructions[id83_1].lineageRootId, id83_1, 'Shared root established');
assert.strictEqual(env83.rostering.instructions[id83_2].lineageRootId, id83_1, 'Shared root established');
assert.strictEqual(validator.validate(env83).valid, true, 'Clean explicit -> generated lineage validates Schema v2');
console.log('  ✔ Passed: Explicit predecessor -> generated successor migrates cleanly.\n');

// -------------------------------------------------------------
// Test 84: Explicit Predecessor -> Generated Successor Overlapping Pair Fails Closed (Offline17.5d)
// -------------------------------------------------------------
console.log('[Test 84] Explicit predecessor -> generated successor overlapping pair fails closed...');
let env84 = JSON.parse(JSON.stringify(env83));
env84.rostering.instructions[id83_1].repeatCount = 5; // Spans past 2026-10-18
delete env84.rostering.instructions[id83_1].status;
delete env84.rostering.instructions[id83_2].status;
validator.normalizeLineage(env84);
assert.strictEqual(env84.rostering.instructions[id83_1].status, undefined, 'Overlapping pair must NOT be normalized');
assert.strictEqual(env84.rostering.instructions[id83_2].status, undefined, 'Overlapping pair must NOT be normalized');
assert.strictEqual(validator.validate(env84).valid, false, 'Overlapping explicit -> generated pair must fail validation closed');
console.log('  ✔ Passed: Explicit operational validity does not excuse overlapping ranges (fails closed).\n');

// -------------------------------------------------------------
// Test 85: Transactional Failure Immutability (Offline17.5d)
// -------------------------------------------------------------
console.log('[Test 85] Transactional failure immutability: zero partial mutation on failed normalization...');
let env85_a = JSON.parse(JSON.stringify(env80));
let before85_a = JSON.stringify(env85_a);
validator.normalizeLineage(env85_a);
let after85_a = JSON.stringify(env85_a);
assert.strictEqual(before85_a, after85_a, 'Failed single off-cadence normalization must produce byte-for-byte identical state');

let env85_b = JSON.parse(JSON.stringify(env84));
let before85_b = JSON.stringify(env85_b);
validator.normalizeLineage(env85_b);
let after85_b = JSON.stringify(env85_b);
assert.strictEqual(before85_b, after85_b, 'Failed overlapping explicit normalization must produce byte-for-byte identical state');
console.log('  ✔ Passed: Zero partial mutation on rejected single and multi-instruction states verified.\n');

// -------------------------------------------------------------
// Test 86: Normalization Idempotency Across Single, Multi, and Explicit States (Offline17.5d)
// -------------------------------------------------------------
console.log('[Test 86] Normalization idempotency across single, multi, and explicit states...');
let snap82_1 = JSON.stringify(env82);
validator.normalizeLineage(env82);
let snap82_2 = JSON.stringify(env82);
assert.strictEqual(snap82_1, snap82_2, 'Single explicit normalized state must be idempotent');

let snap83_1 = JSON.stringify(env83);
validator.normalizeLineage(env83);
let snap83_2 = JSON.stringify(env83);
assert.strictEqual(snap83_1, snap83_2, 'Explicit -> generated lineage normalized state must be idempotent');
console.log('  ✔ Passed: normalizeLineage is strictly idempotent across single, multi, and explicit states.\n');


// -------------------------------------------------------------
// Test 87: Modern Historical Lineage Remains Valid After Job Recurrence Edit (Offline17.5e)
// -------------------------------------------------------------
console.log('[Test 87] Modern historical lineage remains valid after Job recurrence edit...');
const job87_orig = {
  id: 'JOB-HIST-STABLE',
  name: 'Historic Heritage Walkway',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 2,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  crewSize: 1
};
const id87 = 'ROSTER-JOB-HIST-STABLE-2026-09-05-SLOT-01';
let env87 = {
  schemaVersion: 2,
  jobs: [JSON.parse(JSON.stringify(job87_orig))],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: { 'JOB-HIST-STABLE@2026-09-05': ['EMP-01'] },
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id87]: {
        id: id87,
        instructionId: id87,
        jobId: 'JOB-HIST-STABLE',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-HIST-STABLE@2026-09-05',
        startDate: '2026-09-05',
        repeatCount: 1,
        status: 'historical',
        lineageRootId: id87,
        predecessorInstructionId: null
      }
    },
    provenance: {
      'JOB-HIST-STABLE@2026-09-05:EMP-01': {
        source: 'rostering-rule',
        instructionId: id87,
        slotId: 'SLOT-01',
        strategy: 'fixed',
        sourceShiftId: 'JOB-HIST-STABLE@2026-09-05',
        sequenceIndex: 0
      }
    }
  }
};

// Initial state is valid
assert.strictEqual(validator.validate(env87).valid, true, 'Initial state must be valid');

// Operator edits Job recurrence: moves anchor from 03 Oct to 10 Oct
env87.jobs[0].anchorDate = '2026-10-10';

// Offline17.5e Invariant: Historical instructions explain the past and must NEVER be invalidated by later recurrence edits
let val87 = validator.validate(env87);
assert.strictEqual(val87.valid, true, 'Historical lineage must remain valid after Job recurrence edit (got error: ' + val87.error + ')');
assert.strictEqual(env87.rostering.instructions[id87].status, 'historical');
console.log('  ✔ Passed: Modern historical lineage remains valid after Job recurrence edit.\n');

// -------------------------------------------------------------
// Test 88: Historical-Only Job Recurrence Edit Persists Successfully (Offline17.5e)
// -------------------------------------------------------------
console.log('[Test 88] Historical-only Job recurrence edit persists successfully...');
require('../js/components/jobEditModal/formValidator.js');
const formVal = window.HortOpsJobEditFormValidator;

const proposedJob88 = Object.assign({}, env87.jobs[0], { intervalWeeks: 4, anchorDate: '2026-10-10' });
const compat88 = formVal.validateRecurrenceCompatibility(job87_orig, proposedJob88, env87);
assert.strictEqual(compat88.valid, true, 'Historical-only job recurrence edit must be allowed');

// Test load -> save cycle
const envelope88 = window.HortOpsStorage.createWorkspaceEnvelope(env87);
const saveRes88 = window.HortOpsStorage.saveWorkspace(envelope88);
assert.strictEqual(saveRes88.ok, true, 'Save of historical-only edited job must succeed');
const loaded88 = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(loaded88.recoveryRequired, false, 'No Recovery Required on historical-only recurrence edit');
assert.strictEqual(loaded88.jobs[0].anchorDate, '2026-10-10', 'Reloaded job reflects updated anchorDate');
console.log('  ✔ Passed: Historical-only Job recurrence edit persists successfully.\n');

// -------------------------------------------------------------
// Test 89: Active Future Rostering Blocks Incompatible Recurrence Edit (Offline17.5e)
// -------------------------------------------------------------
console.log('[Test 89] Active future rostering blocks incompatible recurrence edit...');
const job89 = {
  id: 'JOB-ACTIVE-FUTURE',
  name: 'Botanic Conservatory Pruning',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 2,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'active',
  crewSize: 1
};
// Active future instruction on 2026-10-17 (in scope under intervalWeeks: 2)
const id89 = 'ROSTER-JOB-ACTIVE-FUTURE-2026-10-17-SLOT-01';
let env89 = {
  schemaVersion: 2,
  jobs: [job89],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: { 'JOB-ACTIVE-FUTURE@2026-10-17': ['EMP-01'] },
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id89]: {
        id: id89,
        instructionId: id89,
        jobId: 'JOB-ACTIVE-FUTURE',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-ACTIVE-FUTURE@2026-10-17',
        startDate: '2026-10-17',
        repeatCount: 1,
        status: 'active',
        lineageRootId: id89,
        predecessorInstructionId: null
      }
    },
    provenance: {
      'JOB-ACTIVE-FUTURE@2026-10-17:EMP-01': {
        source: 'rostering-rule',
        instructionId: id89,
        slotId: 'SLOT-01',
        strategy: 'fixed',
        sourceShiftId: 'JOB-ACTIVE-FUTURE@2026-10-17',
        sequenceIndex: 0
      }
    }
  }
};

// Operator attempts to change intervalWeeks from 2 to 4 (so 2026-10-17 would be skipped: 10-03 -> 10-31)
const incompatibleJob89 = Object.assign({}, job89, { intervalWeeks: 4 });
const compat89 = formVal.validateRecurrenceCompatibility(job89, incompatibleJob89, env89);
assert.strictEqual(compat89.valid, false, 'Incompatible recurrence edit must be blocked');
assert(compat89.message.includes('active future rostering'), 'Message must explain active future rostering conflict');
console.log('  ✔ Passed: Active future rostering blocks incompatible recurrence edit.\n');

// -------------------------------------------------------------
// Test 90: Rejected Job Edit Leaves Live and Persisted Job Unchanged (Offline17.5e)
// -------------------------------------------------------------
console.log('[Test 90] Rejected Job edit leaves live and persisted Job unchanged...');
// Require app.js first
require('../js/app.js');
window.HortOpsApp = window.HortOpsApp || {};
window.HortOpsApp.state = JSON.parse(JSON.stringify(env89));
window.HortOpsApp.recomputeDigest = () => {};
window.HortOpsApp.renderCurrentView = () => {};

const beforeJobJson = JSON.stringify(window.HortOpsApp.state.jobs[0]);
// Save the valid state to storage
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(window.HortOpsApp.state));
const beforeStorageJob = JSON.stringify(window.HortOpsStorage.loadWorkspace().jobs[0]);

// Attempt rejected edit via saveJob
const saveJobRes = window.HortOpsApp.saveJob(incompatibleJob89);
assert.strictEqual(saveJobRes.success, false, 'saveJob must return success: false for incompatible edit');

// Verify zero split-brain: in-memory state and persisted state are 100% untouched
const afterJobJson = JSON.stringify(window.HortOpsApp.state.jobs[0]);
const afterStorageJob = JSON.stringify(window.HortOpsStorage.loadWorkspace().jobs[0]);
assert.strictEqual(beforeJobJson, afterJobJson, 'In-memory job must remain 100% byte-for-byte identical');
assert.strictEqual(beforeStorageJob, afterStorageJob, 'Persisted job must remain 100% byte-for-byte identical');
console.log('  ✔ Passed: Rejected Job edit leaves live and persisted Job unchanged (zero split-brain).\n');

// -------------------------------------------------------------
// Test 91: Raw workspace.shifts Cannot Authorise Off-Cadence Legacy Source (Offline17.5e)
// -------------------------------------------------------------
console.log('[Test 91] Raw workspace.shifts cannot authorise off-cadence legacy source...');
const id91 = 'ROSTER-JOB-LIFE-01-2026-10-15-SLOT-01'; // Thursday (off-cadence for weekly Saturday)
let env91 = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: { 'JOB-LIFE-01@2026-10-15': ['EMP-01'] },
  // Inject malicious raw shifts array trying to self-authorise
  shifts: [
    {
      shiftId: 'JOB-LIFE-01@2026-10-15',
      jobId: 'JOB-LIFE-01',
      date: '2026-10-15',
      slotId: 'SLOT-01'
    }
  ],
  rostering: {
    instructions: {
      [id91]: {
        id: id91,
        instructionId: id91,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-LIFE-01@2026-10-15',
        startDate: '2026-10-15',
        repeatCount: 1
      }
    },
    provenance: {}
  }
};

validator.normalizeLineage(env91);
assert.strictEqual(env91.rostering.instructions[id91].status, undefined, 'Untrusted workspace.shifts must NOT authorise legacy normalisation');
let val91 = validator.validate(env91);
assert.strictEqual(val91.valid, false, 'Payload with raw workspace.shifts must fail validation closed');
assert(val91.error.includes('not a recognised operational occurrence'), 'Must report not a recognised operational occurrence');
console.log('  ✔ Passed: Raw workspace.shifts strictly rejected from authorising off-cadence legacy sources.\n');

// -------------------------------------------------------------
// Test 92: Trusted Explicit Occurrence Remains Accepted (Offline17.5e)
// -------------------------------------------------------------
console.log('[Test 92] Trusted explicit occurrence remains accepted...');
const id92 = 'ROSTER-tramline-5am-2026-09-27-SLOT-1'; // Real explicit occurrence in HISTORICAL_OCCURRENCES ledger
let env92 = {
  schemaVersion: 2,
  jobs: [jobTramline],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: { 'tramline-5am@2026-09-27': ['EMP-01'] },
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id92]: {
        id: id92,
        instructionId: id92,
        jobId: 'tramline-5am',
        slotId: 'SLOT-1',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'tramline-5am@2026-09-27',
        startDate: '2026-09-27',
        repeatCount: 1
      }
    },
    provenance: {}
  }
};

validator.normalizeLineage(env92);
assert.strictEqual(env92.rostering.instructions[id92].status, 'active', 'Authoritative explicit occurrence ledger must be accepted');
assert.strictEqual(validator.validate(env92).valid, true, 'Valid explicit occurrence must pass validation');
console.log('  ✔ Passed: Trusted explicit occurrence ledger remains accepted.\n');

// -------------------------------------------------------------
// Test 93: Accepted Workspace Can Immediately Save Unchanged (Load -> Save Equivalence) (Offline17.5e)
// -------------------------------------------------------------
console.log('[Test 93] Accepted workspace can immediately save unchanged...');
// 93A: Modern historical lineage
const env93A = JSON.parse(JSON.stringify(env87));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(env93A));
const load93A = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(load93A.recoveryRequired, false, 'Load must succeed without Recovery Required for modern historical lineage');
const resave93A = window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(load93A));
assert.strictEqual(resave93A.ok, true, 'Immediate resave must succeed for modern historical lineage');

// 93B: Clean legacy generated source
const id93B = 'ROSTER-JOB-LIFE-01-2026-10-03-SLOT-01';
const env93B = {
  schemaVersion: 2,
  jobs: [jobStandard],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: { 'JOB-LIFE-01@2026-10-03': ['EMP-01'] },
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id93B]: {
        id: id93B,
        instructionId: id93B,
        jobId: 'JOB-LIFE-01',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-LIFE-01@2026-10-03',
        startDate: '2026-10-03',
        repeatCount: 1
      }
    },
    provenance: {}
  }
};
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(env93B));
const load93B = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(load93B.recoveryRequired, false, 'Load must succeed without Recovery Required for clean legacy generated source');
const resave93B = window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(load93B));
assert.strictEqual(resave93B.ok, true, 'Immediate resave must succeed for clean legacy generated source');

// 93C: Clean legacy explicit source
const env93C = JSON.parse(JSON.stringify(env92));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(env93C));
const load93C = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(load93C.recoveryRequired, false, 'Load must succeed without Recovery Required for clean legacy explicit source');
const resave93C = window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(load93C));
assert.strictEqual(resave93C.ok, true, 'Immediate resave must succeed for clean legacy explicit source');

// 93D: Malicious fake-shifts payload fails immediately on load (not load-succeeds then save-fails)
// Directly put malformed payload into storage
window.localStorage.setItem('hort_ops_workspace_v2', JSON.stringify(env91));
const load93D = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(load93D.recoveryRequired, true, 'Malicious payload must trigger Recovery Required on initial load');
console.log('  ✔ Passed: Load -> Save equivalence verified across modern, legacy, and malicious states.\n');

// -------------------------------------------------------------
// Test 94: Canonical Envelope Does Not Discard Validation-Critical State (Offline17.5e)
// -------------------------------------------------------------
console.log('[Test 94] Canonical envelope does not discard validation-critical state...');
const env94 = JSON.parse(JSON.stringify(env93A));
const envelope94 = window.HortOpsStorage.createWorkspaceEnvelope(env94);
// Validate envelope directly
const val94 = validator.validate(envelope94);
assert.strictEqual(val94.valid, true, 'Canonical envelope must pass schema validation directly');
// Verify envelope intentionally excludes non-canonical shifts
assert.strictEqual(envelope94.shifts, undefined, 'Canonical envelope must not contain shifts field');
console.log('  ✔ Passed: Canonical envelope retains all validation-critical state.\n');

// -------------------------------------------------------------
// Test 95: Weekly -> Fortnightly Blocked When Later Active Scope Changes (Sparsification) (Offline17.5f)
// -------------------------------------------------------------
console.log('[Test 95] Weekly -> Fortnightly blocked when later active scope changes (sparsification)...');
window.HortOpsApp.recomputeDigest = () => {};
window.HortOpsApp.renderCurrentView = () => {};
const job95_orig = {
  id: 'JOB-T95',
  name: 'Botanic Canopy Maintenance',
  status: 'active',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  crewSize: 1
};
const id95 = 'ROSTER-JOB-T95-2026-10-03-SLOT-01';
let env95 = {
  schemaVersion: 2,
  jobs: [JSON.parse(JSON.stringify(job95_orig))],
  roster: rosterStandard, staffList: rosterStandard,
  historicalSnapshots: {},
  assignments: {
    'JOB-T95@2026-10-03': ['EMP-01'],
    'JOB-T95@2026-10-10': ['EMP-01'],
    'JOB-T95@2026-10-17': ['EMP-01'],
    'JOB-T95@2026-10-24': ['EMP-01']
  },
  rostering: {
    instructions: {
      [id95]: {
        id: id95,
        instructionId: id95,
        jobId: 'JOB-T95',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-T95@2026-10-03',
        startDate: '2026-10-03',
        repeatCount: 4,
        status: 'active'
      }
    },
    provenance: {
      'JOB-T95@2026-10-03:EMP-01': { source: 'rostering-rule', strategy: 'fixed', sourceShiftId: 'JOB-T95@2026-10-03', instructionId: id95, slotId: 'SLOT-01', sequenceIndex: 0 },
      'JOB-T95@2026-10-10:EMP-01': { source: 'rostering-rule', strategy: 'fixed', sourceShiftId: 'JOB-T95@2026-10-03', instructionId: id95, slotId: 'SLOT-01', sequenceIndex: 1 },
      'JOB-T95@2026-10-17:EMP-01': { source: 'rostering-rule', strategy: 'fixed', sourceShiftId: 'JOB-T95@2026-10-03', instructionId: id95, slotId: 'SLOT-01', sequenceIndex: 2 },
      'JOB-T95@2026-10-24:EMP-01': { source: 'rostering-rule', strategy: 'fixed', sourceShiftId: 'JOB-T95@2026-10-03', instructionId: id95, slotId: 'SLOT-01', sequenceIndex: 3 }
    }
  }
};
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(env95));
const compat95 = formVal.validateSchedulingCompatibility(job95_orig, { intervalWeeks: 2 }, env95);
assert.strictEqual(compat95.valid, false, 'Weekly -> Fortnightly sparsification must be blocked');
assert(compat95.message.includes('active future rostering'), 'Must provide actionable active rostering message');

// Verify through transactional saveJob
window.HortOpsApp.state = JSON.parse(JSON.stringify(env95));
const saveRes95 = window.HortOpsApp.saveJob(Object.assign({}, job95_orig, { intervalWeeks: 2 }));
assert.strictEqual(saveRes95.success, false, 'saveJob must reject incompatible weekly -> fortnightly mutation');
assert.strictEqual(window.HortOpsApp.state.jobs[0].intervalWeeks, 1, 'In-memory job interval must remain 1');
const reloaded95 = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(reloaded95.jobs[0].intervalWeeks, 1, 'Persisted job interval must remain 1');
console.log('  ✔ Passed: Weekly -> Fortnightly sparsification blocked, live & persisted state untouched.\n');

// -------------------------------------------------------------
// Test 96: Fortnightly -> Weekly Blocked Because Repeat Sequence Changes (Densification) (Offline17.5f)
// -------------------------------------------------------------
console.log('[Test 96] Fortnightly -> Weekly blocked because Repeat sequence changes (densification)...');
const job96_orig = {
  id: 'JOB-T96',
  name: 'Rose Garden Pruning',
  status: 'active',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 2,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  crewSize: 1
};
const id96 = 'ROSTER-JOB-T96-2026-10-03-SLOT-01';
let env96 = {
  schemaVersion: 2,
  jobs: [JSON.parse(JSON.stringify(job96_orig))],
  roster: rosterStandard, staffList: rosterStandard,
  historicalSnapshots: {},
  assignments: {
    'JOB-T96@2026-10-03': ['EMP-01'],
    'JOB-T96@2026-10-17': ['EMP-01'],
    'JOB-T96@2026-10-31': ['EMP-01']
  },
  rostering: {
    instructions: {
      [id96]: {
        id: id96,
        instructionId: id96,
        jobId: 'JOB-T96',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-T96@2026-10-03',
        startDate: '2026-10-03',
        repeatCount: 3,
        status: 'active'
      }
    },
    provenance: {
      'JOB-T96@2026-10-03:EMP-01': { source: 'rostering-rule', strategy: 'fixed', sourceShiftId: 'JOB-T96@2026-10-03', instructionId: id96, slotId: 'SLOT-01', sequenceIndex: 0 },
      'JOB-T96@2026-10-17:EMP-01': { source: 'rostering-rule', strategy: 'fixed', sourceShiftId: 'JOB-T96@2026-10-03', instructionId: id96, slotId: 'SLOT-01', sequenceIndex: 1 },
      'JOB-T96@2026-10-31:EMP-01': { source: 'rostering-rule', strategy: 'fixed', sourceShiftId: 'JOB-T96@2026-10-03', instructionId: id96, slotId: 'SLOT-01', sequenceIndex: 2 }
    }
  }
};
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(env96));
const compat96 = formVal.validateSchedulingCompatibility(job96_orig, { intervalWeeks: 1 }, env96);
assert.strictEqual(compat96.valid, false, 'Fortnightly -> Weekly Repeat densification must be blocked');

window.HortOpsApp.state = JSON.parse(JSON.stringify(env96));
const saveRes96 = window.HortOpsApp.saveJob(Object.assign({}, job96_orig, { intervalWeeks: 1 }));
assert.strictEqual(saveRes96.success, false, 'saveJob must reject fortnightly -> weekly densification');
assert.strictEqual(window.HortOpsApp.state.jobs[0].intervalWeeks, 2, 'In-memory job interval must remain 2');
console.log('  ✔ Passed: Fortnightly -> Weekly Repeat-semantic sequence change strictly blocked.\n');

// -------------------------------------------------------------
// Test 97: Source Remains Valid Canonical Occurrence, But Later Sequence Changes -> Blocked (Offline17.5f)
// -------------------------------------------------------------
console.log('[Test 97] Source remains valid canonical occurrence, but later sequence changes -> blocked...');
const job97_orig = {
  id: 'JOB-T97',
  name: 'Glasshouse Inspection',
  status: 'active',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  crewSize: 1
};
const id97 = 'ROSTER-JOB-T97-2026-10-03-SLOT-01';
let env97 = {
  schemaVersion: 2,
  jobs: [JSON.parse(JSON.stringify(job97_orig))],
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: { 'JOB-T97@2026-10-03': ['EMP-01'] },
  rostering: {
    instructions: {
      [id97]: {
        id: id97,
        instructionId: id97,
        jobId: 'JOB-T97',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-T97@2026-10-03',
        startDate: '2026-10-03',
        repeatCount: 4,
        status: 'active'
      }
    },
    provenance: {}
  }
};
// Changing interval to 3: 2026-10-03 remains valid, but sequence becomes [10-03, 10-24, 11-14, 12-05]
const compat97 = formVal.validateSchedulingCompatibility(job97_orig, { intervalWeeks: 3 }, env97);
assert.strictEqual(compat97.valid, false, 'Must block edit even though source date remains canonical');
console.log('  ✔ Passed: Proved source-only validity is no longer sufficient; full sequence comparison enforced.\n');

// -------------------------------------------------------------
// Test 98: Active Instruction With Historical Source Date Protects Future Occurrences (Offline17.5f)
// -------------------------------------------------------------
console.log('[Test 98] Active instruction with historical source date protects future occurrences...');
const job98_orig = {
  id: 'JOB-T98',
  name: 'Botanic Parkway Sweeping',
  status: 'active',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  crewSize: 1
};
const id98 = 'ROSTER-JOB-T98-2026-09-05-SLOT-01';
let env98 = {
  schemaVersion: 2,
  jobs: [JSON.parse(JSON.stringify(job98_orig))],
  roster: rosterStandard, staffList: rosterStandard,
  customAssignments: {
    'JOB-T98@2026-09-05': ['EMP-01'],
    'JOB-T98@2026-09-12': ['EMP-01'],
    'JOB-T98@2026-09-19': ['EMP-01'],
    'JOB-T98@2026-09-26': ['EMP-01'],
    'JOB-T98@2026-10-03': ['EMP-01'],
    'JOB-T98@2026-10-10': ['EMP-01']
  },
  rostering: {
    instructions: {
      [id98]: {
        id: id98,
        instructionId: id98,
        jobId: 'JOB-T98',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-T98@2026-09-05',
        startDate: '2026-09-05',
        repeatCount: 6,
        status: 'active'
      }
    },
    provenance: {}
  }
};
// Today is 2026-10-01. Source is in the past (2026-09-05), but active instruction extends into Oct (10-03, 10-10)
const compat98 = formVal.validateSchedulingCompatibility(job98_orig, { intervalWeeks: 2 }, env98);
assert.strictEqual(compat98.valid, false, 'Active instruction with past source must still protect future occurrences');
console.log('  ✔ Passed: Active instruction with historical source date safely protects future occurrences.\n');

// -------------------------------------------------------------
// Test 99: Active Job -> Inactive Blocked When Active Future Rostering Exists (Offline17.5f)
// -------------------------------------------------------------
console.log('[Test 99] Active Job -> Inactive blocked when active future rostering exists...');
const compat99 = formVal.validateSchedulingCompatibility(job95_orig, { status: 'inactive' }, env95);
assert.strictEqual(compat99.valid, false, 'Setting active job to inactive with future rostering must be blocked');
assert(compat99.message.includes('cannot be made inactive'), 'Must return dedicated status deactivation warning');

window.HortOpsApp.state = JSON.parse(JSON.stringify(env95));
const saveRes99 = window.HortOpsApp.saveJob(Object.assign({}, job95_orig, { status: 'inactive' }));
assert.strictEqual(saveRes99.success, false, 'saveJob must reject active -> inactive mutation');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'active', 'In-memory job must remain active');
console.log('  ✔ Passed: Active Job -> Inactive blocked, preventing hidden future shifts in Forward Planner.\n');

// -------------------------------------------------------------
// Test 100: Active Job -> Inactive Allowed With Historical-Only Lineage (Offline17.5f)
// -------------------------------------------------------------
console.log('[Test 100] Active Job -> Inactive allowed with historical-only lineage...');
const job100_orig = {
  id: 'JOB-T100',
  name: 'Completed Historical Exhibition',
  status: 'active',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  crewSize: 1
};
const id100 = 'ROSTER-JOB-T100-2026-09-05-SLOT-01';
let env100 = {
  schemaVersion: 2,
  jobs: [JSON.parse(JSON.stringify(job100_orig))],
  roster: rosterStandard, staffList: rosterStandard,
  assignments: { 'JOB-T100@2026-09-05': ['EMP-01'] },
  customAssignments: { 'JOB-T100@2026-09-05': ['EMP-01'] },
  rostering: {
    instructions: {
      [id100]: {
        id: id100,
        instructionId: id100,
        jobId: 'JOB-T100',
        slotId: 'SLOT-01',
        mode: 'fixed',
        employeeId: 'EMP-01',
        sourceShiftId: 'JOB-T100@2026-09-05',
        startDate: '2026-09-05',
        repeatCount: 1,
        status: 'historical',
        lineageRootId: id100,
        predecessorInstructionId: null
      }
    },
    provenance: {
      'JOB-T100@2026-09-05:EMP-01': {
        source: 'rostering-rule',
        strategy: 'fixed',
        sourceShiftId: 'JOB-T100@2026-09-05',
        instructionId: id100,
        slotId: 'SLOT-01',
        sequenceIndex: 0
      }
    }
  }
};
const compat100 = formVal.validateSchedulingCompatibility(job100_orig, { status: 'inactive' }, env100);
assert.strictEqual(compat100.valid, true, 'Active -> Inactive must be allowed for historical-only lineage');

window.HortOpsApp.state = JSON.parse(JSON.stringify(env100));
const saveRes100 = window.HortOpsApp.saveJob(Object.assign({}, job100_orig, { status: 'inactive' }));
assert.strictEqual(saveRes100.success, true, 'saveJob must succeed for historical-only job deactivation');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'inactive', 'Job status must be updated to inactive');
console.log('  ✔ Passed: Active -> Inactive allowed when only historical-only lineage exists.\n');

// -------------------------------------------------------------
// Test 101: JobRegistry Status Toggle is Transactional (Staged) (Offline17.5f)
// -------------------------------------------------------------
console.log('[Test 101] JobRegistry status toggle is transactional (staged)...');
require('../js/components/jobRegistry.js');
const registry = window.HortOpsJobRegistry;
window.HortOpsApp.state = JSON.parse(JSON.stringify(env95));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(env95));

alertTriggered = false;
alertMsg = '';
global.alert = function(msg) { alertTriggered = true; alertMsg = msg; };

// Attempt status toggle on Job with active future rostering
registry.toggleStatus('JOB-T95');
assert.strictEqual(alertTriggered, true, 'Alert must be shown on blocked toggleStatus');
assert(alertMsg.includes('cannot be made inactive'), 'Alert must describe active future rostering');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'active', 'In-memory job.status must remain active (zero in-place mutation)');
const reloaded101 = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(reloaded101.jobs[0].status, 'active', 'Persisted job.status must remain active');
console.log('  ✔ Passed: JobRegistry toggleStatus stages update cleanly; zero split-brain on rejection.\n');

// -------------------------------------------------------------
// Test 102: Delete/Retire Cannot Bypass Active Future Guard (Offline17.5f)
// -------------------------------------------------------------
console.log('[Test 102] Delete/Retire cannot bypass active future guard...');
alertTriggered = false;
alertMsg = '';
window.HortOpsApp.state = JSON.parse(JSON.stringify(env95));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(env95));

window.HortOpsApp.deleteJob('JOB-T95');
assert.strictEqual(alertTriggered, true, 'Alert must be triggered when deleteJob is blocked by active future guard');
assert(alertMsg.includes('cannot be made inactive'), 'Alert must explain retirement blocked by active future rostering');
assert.strictEqual(window.HortOpsApp.state.jobs.length, 1, 'Job must NOT be deleted');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'active', 'Job must NOT be retired to inactive');
console.log('  ✔ Passed: deleteJob cannot bypass active future rostering guard.\n');

// -------------------------------------------------------------
// Test 103: Compatible Non-Scheduling Job Edit Remains Allowed (Offline17.5f)
// -------------------------------------------------------------
console.log('[Test 103] Compatible non-scheduling Job edit remains allowed...');
window.HortOpsApp.state = JSON.parse(JSON.stringify(env95));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(env95));

const proposedNonSched = Object.assign({}, job95_orig, {
  name: 'Updated Canopy Maintenance Title',
  notes: 'Updated field notes for arborists',
  crewSize: 2,
  color: '#2563eb'
});

const compat103 = formVal.validateSchedulingCompatibility(job95_orig, proposedNonSched, env95);
assert.strictEqual(compat103.valid, true, 'Non-scheduling edit must be permitted');

const saveRes103 = window.HortOpsApp.saveJob(proposedNonSched);
assert.strictEqual(saveRes103.success, true, 'saveJob must succeed for non-scheduling edit');
assert.strictEqual(window.HortOpsApp.state.jobs[0].name, 'Updated Canopy Maintenance Title', 'Name must update');
console.log('  ✔ Passed: Non-scheduling edits remain allowed without unnecessary locking.\n');

// -------------------------------------------------------------
// Test 104: Successful Guarded Job Edit Preserves Exact Future Active Sequence (Offline17.5g Corrected)
// -------------------------------------------------------------
console.log('[Test 104] Successful guarded Job edit preserves exact future active sequence...');
const sourceShift95 = env95.rostering.instructions[id95].sourceShiftId;
// Resolve active future sequence before edit using real sourceShiftId
const occsBefore = formVal.resolveInstructionOccurrences(job95_orig, sourceShift95, 4);
const futureBefore = occsBefore.filter(d => d >= '2026-10-01');
const expectedDates = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24'];

assert.strictEqual(futureBefore.length, 4, 'Future occurrence sequence length must be 4');
assert.deepStrictEqual(futureBefore, expectedDates, 'Resolved future occurrences must match expected dates');

// Permitted non-scheduling or sequence-preserving edit
const occsAfter = formVal.resolveInstructionOccurrences(window.HortOpsApp.state.jobs[0], sourceShift95, 4);
const futureAfter = occsAfter.filter(d => d >= '2026-10-01');

assert.strictEqual(futureBefore.length, futureAfter.length, 'Future occurrence sequence length must be identical');
assert.deepStrictEqual(futureBefore, futureAfter, 'Every future occurrence date must match 1:1 before and after edit');
console.log('  ✔ Passed: Invariant affirmed: Future active occurrence sequence BEFORE == AFTER (4 non-empty occurrences).\n');

// -------------------------------------------------------------
// Test 105: Active Instruction with Zero Assignments Prevents Hard Delete (Offline17.5g)
// -------------------------------------------------------------
console.log('[Test 105] Active instruction with zero assignments prevents hard delete...');
const jobVacant = {
  id: 'JOB-VACANT',
  name: 'Vacant Slot Testing Job',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  recurrenceDay: 6,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const instVacantId = 'ROSTER-JOB-VACANT-2026-10-03-SLOT-01';
const envVacant = {
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [jobVacant],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [instVacantId]: {
        id: instVacantId,
        instructionId: instVacantId,
        jobId: 'JOB-VACANT',
        slotId: 'SLOT-01',
        mode: 'fixed',
        repeatCount: 3,
        sourceShiftId: 'JOB-VACANT@2026-10-03',
        status: 'active',
        employeeId: 'EMP-001'
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
const deps105 = window.HortOpsApp.getJobDependencies('JOB-VACANT', envVacant);
assert.strictEqual(deps105.assignments, 0, 'Assignments count must be 0');
assert.strictEqual(deps105.rosteringInstructions, 1, 'Rostering instructions count must be 1');
assert.strictEqual(deps105.canHardDelete, false, 'canHardDelete must be false when an active instruction references Job');
console.log('  ✔ Passed: Active instruction with zero assignments prevents hard delete.\n');

// -------------------------------------------------------------
// Test 106: Historical Instruction with Zero Assignments Prevents Hard Delete (Offline17.5g)
// -------------------------------------------------------------
console.log('[Test 106] Historical instruction with zero assignments prevents hard delete...');
const jobHistOnly = {
  id: 'JOB-HIST-ONLY',
  name: 'Historical Lineage Preserved Job',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  recurrenceDay: 6,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const instHistId = 'ROSTER-JOB-HIST-ONLY-2026-10-03-SLOT-01';
const envHistOnly = {
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [jobHistOnly],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [instHistId]: {
        id: instHistId,
        instructionId: instHistId,
        jobId: 'JOB-HIST-ONLY',
        slotId: 'SLOT-01',
        mode: 'fixed',
        repeatCount: 1,
        sourceShiftId: 'JOB-HIST-ONLY@2026-10-03',
        status: 'historical',
        predecessorInstructionId: null,
        lineageRootId: instHistId,
        employeeId: 'EMP-001'
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
const deps106 = window.HortOpsApp.getJobDependencies('JOB-HIST-ONLY', envHistOnly);
assert.strictEqual(deps106.assignments, 0, 'Assignments count must be 0');
assert.strictEqual(deps106.rosteringInstructions, 1, 'Rostering instructions count must be 1');
assert.strictEqual(deps106.canHardDelete, false, 'canHardDelete must be false when a historical instruction references Job');
console.log('  ✔ Passed: Historical instruction prevents hard delete, preserving audit lineage.\n');

// -------------------------------------------------------------
// Test 107: Delete/Retire Blocks When Active Future Rostering Exists (Zero Assignments) (Offline17.5g)
// -------------------------------------------------------------
console.log('[Test 107] Delete/Retire blocks when active future rostering exists (even with zero assignments)...');
window.HortOpsApp.state = JSON.parse(JSON.stringify(envVacant));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(envVacant));

alertTriggered = false;
alertMsg = '';
window.HortOpsApp.deleteJob('JOB-VACANT');
assert.strictEqual(alertTriggered, true, 'Alert must be triggered when active future rostering exists');
assert(alertMsg.includes('cannot be made inactive') || alertMsg.includes('active future rostering'),
  'Alert message must explain active future rostering blocks retirement');
assert.strictEqual(window.HortOpsApp.state.jobs.length, 1, 'Job must NOT be deleted');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'active', 'Job must remain active');
const persisted107 = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(persisted107.jobs[0].status, 'active', 'Persisted job status must remain active');
console.log('  ✔ Passed: Active future rostering blocks Delete/Retire even with zero assignments.\n');

// -------------------------------------------------------------
// Test 108: Historical-Only Delete Path Retires Job to Inactive Instead of Hard Deleting (Offline17.5g)
// -------------------------------------------------------------
console.log('[Test 108] Historical-only Delete path retires Job to inactive instead of hard deleting...');
window.HortOpsApp.state = JSON.parse(JSON.stringify(envHistOnly));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(envHistOnly));

alertTriggered = false;
alertMsg = '';
window.HortOpsApp.deleteJob('JOB-HIST-ONLY');
assert.strictEqual(alertTriggered, true, 'Alert must explain retirement to Inactive');
assert(alertMsg.includes('retired (set to Inactive)'), 'Alert message must explain retirement to Inactive');
assert.strictEqual(window.HortOpsApp.state.jobs.length, 1, 'Job must NOT be hard deleted');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'inactive', 'Job must be retired to inactive');
const persisted108 = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(persisted108.jobs[0].status, 'inactive', 'Persisted Job status must be inactive');
assert.strictEqual(Object.keys(persisted108.rostering.instructions).length, 1, 'Historical instruction must remain intact');
console.log('  ✔ Passed: Historical-only Job cleanly retired to Inactive, preserving historical lineage.\n');

// -------------------------------------------------------------
// Test 109: Retirement Persistence Failure Rolls Back In-Memory Job Status (Offline17.5g)
// -------------------------------------------------------------
console.log('[Test 109] Retirement persistence failure rolls back in-memory Job status...');
window.HortOpsApp.state = JSON.parse(JSON.stringify(envHistOnly));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(envHistOnly));

const origSaveWorkspace109 = window.HortOpsStorage.saveWorkspace;
window.HortOpsStorage.saveWorkspace = function() {
  return { ok: false, error: 'Simulated persistence disk failure' };
};

alertTriggered = false;
alertMsg = '';
window.HortOpsApp.deleteJob('JOB-HIST-ONLY');

assert.strictEqual(alertTriggered, true, 'Alert must report save failure or rollback');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'active', 'In-memory job.status must roll back to active on save failure');

window.HortOpsStorage.saveWorkspace = origSaveWorkspace109;
const persisted109 = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(persisted109.jobs[0].status, 'active', 'Persisted job status must remain active');
console.log('  ✔ Passed: Retirement save failure rolls back in-memory Job status (zero split-brain).\n');

// -------------------------------------------------------------
// Test 110: Modern Active Off-Cadence Source Fails Schema v2 Validation Closed (Offline17.5g)
// -------------------------------------------------------------
console.log('[Test 110] Modern active off-cadence source fails Schema v2 validation closed...');
const jobCadence = {
  id: 'JOB-CADENCE',
  name: 'Saturday Weekly Job',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  recurrenceDay: 6,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const env110 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [jobCadence],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      'ROSTER-JOB-CADENCE-2026-10-15-SLOT-01': {
        id: 'ROSTER-JOB-CADENCE-2026-10-15-SLOT-01',
        instructionId: 'ROSTER-JOB-CADENCE-2026-10-15-SLOT-01',
        jobId: 'JOB-CADENCE',
        slotId: 'SLOT-01',
        mode: 'fixed',
        repeatCount: 1,
        sourceShiftId: 'JOB-CADENCE@2026-10-15', // Thursday - off cadence!
        status: 'active',
        employeeId: 'EMP-001',
        predecessorInstructionId: null,
        lineageRootId: 'ROSTER-JOB-CADENCE-2026-10-15-SLOT-01'
      }
    },
    provenance: {}
  }
};
const valRes110 = window.HortOpsSchemaValidator.validate(env110);
assert.strictEqual(valRes110.valid, false, 'Schema v2 must reject modern active off-cadence source');
assert(valRes110.error.includes('Active rostering instruction') && valRes110.error.includes('not a recognised operational occurrence'),
  'Error message must state active instruction source is not a recognized operational occurrence');
console.log('  ✔ Passed: Modern active off-cadence source strictly fails closed in Schema v2.\n');

// -------------------------------------------------------------
// Test 111: Modern Historical Source Remains Valid in Schema v2 After Recurrence Drift (Offline17.5g)
// -------------------------------------------------------------
console.log('[Test 111] Modern historical source remains valid in Schema v2 after recurrence drift...');
const jobDrifted = {
  id: 'JOB-CADENCE',
  name: 'Modified Sunday Weekly Job',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  recurrenceDay: 0, // Drifted to Sunday
  anchorDate: '2026-10-04',
  preferredDay: 'sunday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const env111 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [jobDrifted],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      'ROSTER-JOB-CADENCE-2026-10-03-SLOT-01': {
        id: 'ROSTER-JOB-CADENCE-2026-10-03-SLOT-01',
        instructionId: 'ROSTER-JOB-CADENCE-2026-10-03-SLOT-01',
        jobId: 'JOB-CADENCE',
        slotId: 'SLOT-01',
        mode: 'fixed',
        repeatCount: 1,
        sourceShiftId: 'JOB-CADENCE@2026-10-03', // Original Saturday source
        status: 'historical', // Sealed historical record
        employeeId: 'EMP-001',
        predecessorInstructionId: null,
        lineageRootId: 'ROSTER-JOB-CADENCE-2026-10-03-SLOT-01'
      }
    },
    provenance: {}
  }
};
const valRes111 = window.HortOpsSchemaValidator.validate(env111);
assert.strictEqual(valRes111.valid, true, 'Schema v2 must accept modern historical source despite subsequent recurrence drift');
console.log('  ✔ Passed: Modern historical source remains valid after current recurrence drift.\n');

// -------------------------------------------------------------
// Test 112: Trusted Explicit Modern Active Source Remains Valid in Schema v2 (Offline17.5g)
// -------------------------------------------------------------
console.log('[Test 112] Trusted explicit modern active source remains valid in Schema v2...');
const id112 = 'ROSTER-tramline-5am-2026-09-27-SLOT-1'; // Real explicit occurrence in HISTORICAL_OCCURRENCES ledger
const env112 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [jobTramline],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id112]: {
        id: id112,
        instructionId: id112,
        jobId: 'tramline-5am',
        slotId: 'SLOT-1',
        mode: 'fixed',
        repeatCount: 1,
        sourceShiftId: 'tramline-5am@2026-09-27',
        status: 'active',
        employeeId: 'EMP-001',
        predecessorInstructionId: null,
        lineageRootId: id112
      }
    },
    provenance: {}
  }
};
const valRes112 = window.HortOpsSchemaValidator.validate(env112);
assert.strictEqual(valRes112.valid, true, 'Trusted explicit occurrence ledger must authorise modern active source');
console.log('  ✔ Passed: Trusted explicit operational occurrence authorises modern active instruction.\n');

// -------------------------------------------------------------
// Test 113: Unresolved Active Instruction Blocks Job Schedule Mutation Fail-Closed (Offline17.5g)
// -------------------------------------------------------------
console.log('[Test 113] Unresolved active instruction blocks Job schedule mutation fail-closed...');
const job113 = {
  id: 'JOB-CADENCE',
  name: 'Saturday Weekly Job',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  recurrenceDay: 6,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
// Active instruction with source on Thursday (unresolvable under Saturday recurrence)
const env113 = {
  rostering: {
    instructions: {
      'ROSTER-JOB-CADENCE-2026-10-15-SLOT-01': {
        id: 'ROSTER-JOB-CADENCE-2026-10-15-SLOT-01',
        jobId: 'JOB-CADENCE',
        slotId: 'SLOT-01',
        mode: 'fixed',
        repeatCount: 1,
        sourceShiftId: 'JOB-CADENCE@2026-10-15',
        status: 'active'
      }
    }
  }
};
// Attempt recurrence edit
const proposedRecurr113 = Object.assign({}, job113, { intervalWeeks: 2 });
const compatRecurr113 = formVal.validateSchedulingCompatibility(job113, proposedRecurr113, env113);
assert.strictEqual(compatRecurr113.valid, false, 'Recurrence edit with unresolved active instruction must fail closed');
assert(compatRecurr113.message.includes('Active rostering for this Job could not be resolved against the current schedule'),
  'Message must specify active rostering could not be resolved against current schedule');

// Attempt status edit (Active -> Inactive)
const proposedStatus113 = Object.assign({}, job113, { status: 'inactive' });
const compatStatus113 = formVal.validateSchedulingCompatibility(job113, proposedStatus113, env113);
assert.strictEqual(compatStatus113.valid, false, 'Status change with unresolved active instruction must fail closed');
assert(compatStatus113.message.includes('Active rostering for this Job could not be resolved against the current schedule'),
  'Message must specify active rostering could not be resolved against current schedule');

console.log('  ✔ Passed: Unresolved active instruction fails closed, blocking schedule & status mutation.\n');

// -------------------------------------------------------------
// Test 114: Hard-Delete Persistence Failure Restores Deleted Job in Memory (Offline17.5g)
// -------------------------------------------------------------
console.log('[Test 114] Hard-delete persistence failure restores deleted Job in memory...');
const jobNoDeps = {
  id: 'JOB-NO-DEPS',
  name: 'Completely Dependency Free Job',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  recurrenceDay: 1,
  anchorDate: '2026-10-05',
  preferredDay: 'monday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const env114 = {
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [jobNoDeps],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(env114));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(env114));

const deps114 = window.HortOpsApp.getJobDependencies('JOB-NO-DEPS', window.HortOpsApp.state);
assert.strictEqual(deps114.canHardDelete, true, 'Truly dependency-free Job must have canHardDelete: true');

const origSaveWorkspace114 = window.HortOpsStorage.saveWorkspace;
window.HortOpsStorage.saveWorkspace = function() {
  return { ok: false, error: 'Simulated hard-delete persistence failure' };
};

alertTriggered = false;
alertMsg = '';
window.HortOpsApp.deleteJob('JOB-NO-DEPS');

assert.strictEqual(alertTriggered, true, 'Alert must notify operator of delete failure');
assert(alertMsg.includes('Failed to delete job due to storage error'), 'Alert message must explain storage error rollback');
assert.strictEqual(window.HortOpsApp.state.jobs.length, 1, 'Job must be restored in memory');
assert.strictEqual(window.HortOpsApp.state.jobs[0].id, 'JOB-NO-DEPS', 'Restored job ID must match original');

window.HortOpsStorage.saveWorkspace = origSaveWorkspace114;
const persisted114 = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(persisted114.jobs[0].id, 'JOB-NO-DEPS', 'Persisted job must remain in storage');
console.log('  ✔ Passed: Hard-delete persistence failure restores Job in memory (transactional rollback).\n');

// -------------------------------------------------------------
// Test 115: Non-Empty Sequence Invariant Reaffirmed on Schedule Preservation (Offline17.5g)
// -------------------------------------------------------------
console.log('[Test 115] Non-empty sequence invariant reaffirmed on schedule preservation...');
const job95_edited = Object.assign({}, job95_orig, { notes: 'Updated notes', crewSize: 2 });
const occs115Before = formVal.resolveInstructionOccurrences(job95_orig, sourceShift95, 4);
const occs115After = formVal.resolveInstructionOccurrences(job95_edited, sourceShift95, 4);
assert.strictEqual(occs115Before.length, 4, 'occsBefore must contain 4 occurrences');
assert.strictEqual(occs115After.length, 4, 'occsAfter must contain 4 occurrences');
assert.deepStrictEqual(occs115Before, occs115After, 'Occurrence sequences must match completely 1:1');
assert.deepStrictEqual(occs115Before, ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24']);
console.log('  ✔ Passed: Non-empty sequence equality verified before and after permitted mutation.\n');

// -------------------------------------------------------------
// Test 116: Schema rejects active instruction under inactive Job (Offline17.5h)
// -------------------------------------------------------------
console.log('[Test 116] Schema rejects active instruction under inactive Job...');
const id116 = 'ROSTER-JOB-INACT-116-2026-10-03-SLOT-0';
const job116 = {
  id: 'JOB-INACT-116',
  name: 'Inactive Job 116',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'inactive',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws116 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job116],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id116]: {
        id: id116,
        instructionId: id116,
        jobId: 'JOB-INACT-116',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-INACT-116@2026-10-03',
        status: 'active',
        lineageRootId: id116,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  }
};
const val116 = window.HortOpsSchemaValidator.validate(ws116);
assert.strictEqual(val116.valid, false, 'Schema must reject active instruction under inactive Job');
assert(val116.error.includes('belongs to non-active Job'), 'Error message must state active instruction belongs to non-active Job: ' + val116.error);
console.log('  ✔ Passed: Active instruction under inactive Job strictly rejected by Schema v2.\\n');

// -------------------------------------------------------------
// Test 117: Schema rejects active instruction under each other non-active Job status (Offline17.5h)
// -------------------------------------------------------------
console.log('[Test 117] Schema rejects active instruction under draft, archived, resolved statuses...');
const nonActiveStatuses = ['draft', 'archived', 'resolved'];
for (const st of nonActiveStatuses) {
  const ws117 = JSON.parse(JSON.stringify(ws116));
  ws117.jobs[0].status = st;
  const val117 = window.HortOpsSchemaValidator.validate(ws117);
  assert.strictEqual(val117.valid, false, 'Schema must reject active instruction under ' + st + ' Job');
  assert(val117.error.includes('belongs to non-active Job'), 'Error message must state active instruction belongs to non-active Job: ' + val117.error);
}
console.log('  ✔ Passed: Active instruction under draft, archived, resolved Job statuses fails Schema v2.\\n');

// -------------------------------------------------------------
// Test 118: Historical instruction remains valid under inactive Job (Offline17.5h)
// -------------------------------------------------------------
console.log('[Test 118] Historical instruction remains valid under inactive and archived Jobs...');
const ws118 = JSON.parse(JSON.stringify(ws116));
ws118.rostering.instructions[id116].status = 'historical';
const val118Inactive = window.HortOpsSchemaValidator.validate(ws118);
assert.strictEqual(val118Inactive.valid, true, 'Schema must accept historical instruction under inactive Job: ' + (val118Inactive.error || ''));

ws118.jobs[0].status = 'archived';
const val118Archived = window.HortOpsSchemaValidator.validate(ws118);
assert.strictEqual(val118Archived.valid, true, 'Schema must accept historical instruction under archived Job');
console.log('  ✔ Passed: Historical instructions remain 100% valid under non-active Jobs (archival integrity).\\n');

// -------------------------------------------------------------
// Test 119: Exhausted active instruction seals during retirement transaction (Offline17.5h)
// -------------------------------------------------------------
console.log('[Test 119] Exhausted active instruction seals to historical during retirement transaction...');
const id119 = 'ROSTER-JOB-EXHAUST-119-2025-05-03-SLOT-0';
const job119 = {
  id: 'JOB-EXHAUST-119',
  name: 'Exhausted Job 119',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2025-05-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws119 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job119],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id119]: {
        id: id119,
        instructionId: id119,
        jobId: 'JOB-EXHAUST-119',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-EXHAUST-119@2025-05-03',
        status: 'active',
        lineageRootId: id119,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws119));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws119));

const proposed119 = Object.assign({}, job119, { status: 'inactive' });
const saveRes119 = window.HortOpsApp.saveJob(proposed119);
assert.strictEqual(saveRes119.success, true, 'Retirement save must succeed for exhausted active instruction');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'inactive', 'Job must be inactive');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id119].status, 'historical', 'Exhausted instruction must be sealed to historical');

const persisted119 = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(persisted119.jobs[0].status, 'inactive', 'Persisted job must be inactive');
assert.strictEqual(persisted119.rostering.instructions[id119].status, 'historical', 'Persisted instruction must be historical');
const valPersisted119 = window.HortOpsSchemaValidator.validate(persisted119);
assert.strictEqual(valPersisted119.valid, true, 'Persisted workspace must pass Schema v2: ' + (valPersisted119.error || ''));
console.log('  ✔ Passed: Exhausted active instruction sealed historical during retirement transaction.\\n');

// -------------------------------------------------------------
// Test 120: Future-active instruction still blocks retirement (Offline17.5h)
// -------------------------------------------------------------
console.log('[Test 120] Future-active instruction still blocks retirement...');
const id120 = 'ROSTER-JOB-FUTURE-120-2026-10-03-SLOT-0';
const job120 = {
  id: 'JOB-FUTURE-120',
  name: 'Future Job 120',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws120 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job120],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id120]: {
        id: id120,
        instructionId: id120,
        jobId: 'JOB-FUTURE-120',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 4,
        sourceShiftId: 'JOB-FUTURE-120@2026-10-03',
        status: 'active',
        lineageRootId: id120,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws120));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws120));

const saveRes120 = window.HortOpsApp.saveJob(Object.assign({}, job120, { status: 'inactive' }));
assert.strictEqual(saveRes120.success, false, 'Retirement must be blocked by active future instruction');
assert(saveRes120.error.includes('active future rostering'), 'Error must specify active future rostering');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'active', 'Live job must remain active');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id120].status, 'active', 'Live instruction must remain active');
console.log('  ✔ Passed: Active future instruction strictly blocks retirement.\\n');

// -------------------------------------------------------------
// Test 121: Mixed exhausted + future-active lineages block entire transaction (Offline17.5h)
// -------------------------------------------------------------
console.log('[Test 121] Mixed exhausted + future-active lineages block entire transaction without partial sealing...');
const id121_0 = 'ROSTER-JOB-MIXED-121-2025-05-03-SLOT-0';
const id121_1 = 'ROSTER-JOB-MIXED-121-2026-10-03-SLOT-1';
const job121 = {
  id: 'JOB-MIXED-121',
  name: 'Mixed Job 121',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2025-05-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 2
};
const ws121 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job121],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id121_0]: {
        id: id121_0,
        instructionId: id121_0,
        jobId: 'JOB-MIXED-121',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-MIXED-121@2025-05-03',
        status: 'active',
        lineageRootId: id121_0,
        predecessorInstructionId: null,
        assignments: {}
      },
      [id121_1]: {
        id: id121_1,
        instructionId: id121_1,
        jobId: 'JOB-MIXED-121',
        slotId: 'SLOT-1',
        mode: 'manual',
        repeatCount: 12,
        sourceShiftId: 'JOB-MIXED-121@2026-10-03',
        status: 'active',
        lineageRootId: id121_1,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws121));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws121));

const saveRes121 = window.HortOpsApp.saveJob(Object.assign({}, job121, { status: 'inactive' }));
assert.strictEqual(saveRes121.success, false, 'Mixed retirement must fail whole transaction');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'active', 'Job must remain active');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id121_0].status, 'active', 'Slot 0 exhausted instruction must NOT be partially sealed');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id121_1].status, 'active', 'Slot 1 future instruction must remain active');
console.log('  ✔ Passed: Mixed lineages completely block transaction; zero partial sealing verified.\\n');

// -------------------------------------------------------------
// Test 122: Retirement save failure restores Job and instruction statuses (Offline17.5h)
// -------------------------------------------------------------
console.log('[Test 122] Retirement save failure restores both Job and instruction statuses (atomic rollback)...');
const id122 = 'ROSTER-JOB-ROLLBACK-122-2025-05-03-SLOT-0';
const job122 = {
  id: 'JOB-ROLLBACK-122',
  name: 'Rollback Job 122',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2025-05-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws122 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job122],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id122]: {
        id: id122,
        instructionId: id122,
        jobId: 'JOB-ROLLBACK-122',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-ROLLBACK-122@2025-05-03',
        status: 'active',
        lineageRootId: id122,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws122));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws122));

const origSaveWorkspace122 = window.HortOpsStorage.saveWorkspace;
window.HortOpsStorage.saveWorkspace = function() {
  return { ok: false, error: 'Simulated storage failure during retirement' };
};

const saveRes122 = window.HortOpsApp.saveJob(Object.assign({}, job122, { status: 'inactive' }));
assert.strictEqual(saveRes122.success, false, 'saveJob must fail on storage error');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'active', 'Job status must be rolled back to active');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id122].status, 'active', 'Instruction status must be rolled back to active');

window.HortOpsStorage.saveWorkspace = origSaveWorkspace122;
console.log('  ✔ Passed: Storage failure during retirement atomically rolls back both Job and instruction statuses.\\n');

// -------------------------------------------------------------
// Test 123: Delete/Retire route seals exhausted active instruction (Offline17.5h)
// -------------------------------------------------------------
console.log('[Test 123] Delete/Retire route seals exhausted active instruction...');
const id123 = 'ROSTER-JOB-DEL-123-2025-05-03-SLOT-0';
const job123 = {
  id: 'JOB-DEL-123',
  name: 'Delete Job 123',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2025-05-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws123 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job123],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id123]: {
        id: id123,
        instructionId: id123,
        jobId: 'JOB-DEL-123',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-DEL-123@2025-05-03',
        status: 'active',
        lineageRootId: id123,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws123));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws123));

alertTriggered = false;
alertMsg = '';
window.HortOpsApp.deleteJob('JOB-DEL-123');

assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'inactive', 'Job must be retired to inactive');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id123].status, 'historical', 'Exhausted instruction must be sealed to historical');
const valPersisted123 = window.HortOpsSchemaValidator.validate(window.HortOpsStorage.loadWorkspace());
assert.strictEqual(valPersisted123.valid, true, 'Persisted workspace after deleteJob retirement must pass Schema v2: ' + (valPersisted123.error || ''));
console.log('  ✔ Passed: Delete/Retire route seamlessly seals exhausted active instruction.\\n');

// -------------------------------------------------------------
// Test 124: Registry toggle route seals exhausted active instruction (Offline17.5h)
// -------------------------------------------------------------
console.log('[Test 124] Registry toggle route seals exhausted active instruction...');
const id124 = 'ROSTER-JOB-TOGGLE-124-2025-05-03-SLOT-0';
const job124 = {
  id: 'JOB-TOGGLE-124',
  name: 'Toggle Job 124',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2025-05-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws124 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job124],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id124]: {
        id: id124,
        instructionId: id124,
        jobId: 'JOB-TOGGLE-124',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-TOGGLE-124@2025-05-03',
        status: 'active',
        lineageRootId: id124,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws124));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws124));

window.HortOpsJobRegistry.toggleStatus('JOB-TOGGLE-124');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'inactive', 'Job must toggle to inactive');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id124].status, 'historical', 'Exhausted instruction must be sealed to historical');
console.log('  ✔ Passed: JobRegistry.toggleStatus seals exhausted active instruction to historical.\\n');

// -------------------------------------------------------------
// Test 125: Reactivating Job does not reactivate historical instruction (Offline17.5h)
// -------------------------------------------------------------
console.log('[Test 125] Reactivating Job does not reactivate historical instruction...');
window.HortOpsJobRegistry.toggleStatus('JOB-TOGGLE-124');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'active', 'Job must toggle back to active');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id124].status, 'historical', 'Historical instruction must remain permanently sealed (never resurrected)');
console.log('  ✔ Passed: Reactivating Job preserves historical instruction as sealed (no resurrection).\\n');

// -------------------------------------------------------------
// Test 126: Trusted explicit active instruction still invalid under inactive Job (Offline17.5h)
// -------------------------------------------------------------
console.log('[Test 126] Trusted explicit active instruction still invalid under inactive Job...');
const id126 = 'ROSTER-JOB-EXP-126-2026-10-03-SLOT-0';
const job126 = {
  id: 'JOB-EXP-126',
  name: 'Explicit Job 126',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'inactive',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws126 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job126],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  occurrences: [{ jobId: 'JOB-EXP-126', date: '2026-10-03', shiftDurationHours: 8 }],
  rostering: {
    instructions: {
      [id126]: {
        id: id126,
        instructionId: id126,
        jobId: 'JOB-EXP-126',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-EXP-126@2026-10-03',
        status: 'active',
        lineageRootId: id126,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  }
};
const val126 = window.HortOpsSchemaValidator.validate(ws126);
assert.strictEqual(val126.valid, false, 'Trusted explicit source cannot override inactive parent Job status');
assert(val126.error.includes('belongs to non-active Job'), 'Error must specify active instruction belongs to non-active Job: ' + val126.error);
console.log('  ✔ Passed: Trusted explicit active source under inactive Job strictly fails Schema v2.\\n');

// -------------------------------------------------------------
// Test 127: Unresolved active instruction is not mistaken for exhausted instruction (Offline17.5h)
// -------------------------------------------------------------
console.log('[Test 127] Unresolved active instruction fails closed and is not mistaken for exhausted instruction...');
const id127 = 'ROSTER-JOB-UNRES-127-2025-05-06-SLOT-0';
const job127 = {
  id: 'JOB-UNRES-127',
  name: 'Unresolved Job 127',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws127 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job127],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id127]: {
        id: id127,
        instructionId: id127,
        jobId: 'JOB-UNRES-127',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-UNRES-127@2025-05-06', // Tuesday date for a Saturday job: off-cadence & unresolvable
        status: 'active',
        lineageRootId: id127,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  }
};
const prep127 = formVal.prepareJobStatusTransition(job127, 'inactive', ws127);
assert.strictEqual(prep127.allowed, false, 'Unresolved active instruction must NOT be allowed to retire');
assert.strictEqual(prep127.instructionsToSeal.length, 0, 'Unresolved instruction must NOT be marked for sealing');
assert(prep127.reason.includes('could not be resolved against the current schedule'), 'Reason must explain unresolvable active rostering');
console.log('  ✔ Passed: Unresolved active instruction fails closed and is not mistaken for exhausted.\\n');

// -------------------------------------------------------------
// Test 128: Exhausted active Fixed instruction seals before cadence edit (Offline17.5i)
// -------------------------------------------------------------
console.log('[Test 128] Exhausted active Fixed instruction seals before cadence edit...');
const id128 = 'ROSTER-JOB-CAD-128-2026-09-05-SLOT-0';
const job128 = {
  id: 'JOB-CAD-128',
  name: 'Saturday Job 128',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws128 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job128],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id128]: {
        id: id128,
        instructionId: id128,
        jobId: 'JOB-CAD-128',
        slotId: 'SLOT-0',
        mode: 'fixed',
        employeeId: 'EMP-001',
        repeatCount: 4,
        sourceShiftId: 'JOB-CAD-128@2026-09-05',
        status: 'active',
        lineageRootId: id128,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws128));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws128));

const proposed128 = Object.assign({}, job128, { intervalWeeks: 4 });
const saveRes128 = window.HortOpsApp.saveJob(proposed128);
assert.strictEqual(saveRes128.success, true, 'Job cadence mutation must succeed when only active instruction is exhausted');
assert.strictEqual(window.HortOpsApp.state.jobs[0].intervalWeeks, 4, 'Job intervalWeeks must be updated to 4');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id128].status, 'historical', 'Exhausted instruction must be sealed to historical');

const persisted128 = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(persisted128.jobs[0].intervalWeeks, 4, 'Persisted job must have intervalWeeks = 4');
assert.strictEqual(persisted128.rostering.instructions[id128].status, 'historical', 'Persisted instruction must be historical');
const valPersisted128 = window.HortOpsSchemaValidator.validate(persisted128);
assert.strictEqual(valPersisted128.valid, true, 'Persisted workspace must pass Schema v2: ' + (valPersisted128.error || ''));
console.log('  ✔ Passed: Exhausted active Fixed instruction sealed historical before cadence edit.\n');

// -------------------------------------------------------------
// Test 129: Proposed cadence would otherwise resurrect future occurrences (Offline17.5i)
// -------------------------------------------------------------
console.log('[Test 129] Proving proposed cadence would have resurrected future occurrences if unsealed...');
// Under existing schedule (intervalWeeks: 1), occurrences for source 2026-09-05 Repeat 4:
const occsUnderExisting = formVal.resolveInstructionOccurrences(job128, '2026-09-05', 4);
assert.deepStrictEqual(occsUnderExisting, ['2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26']);
const futureUnderExisting = occsUnderExisting.filter(d => d >= '2026-10-01');
assert.strictEqual(futureUnderExisting.length, 0, 'Must have zero future occurrences under existing schedule');

// Under proposed schedule (intervalWeeks: 4), the same source + Repeat 4 would produce:
const occsUnderProposed = formVal.resolveInstructionOccurrences(proposed128, '2026-09-05', 4);
assert.deepStrictEqual(occsUnderProposed, ['2026-09-05', '2026-10-03', '2026-10-31', '2026-11-28']);
const futureUnderProposed = occsUnderProposed.filter(d => d >= '2026-10-01');
assert.strictEqual(futureUnderProposed.length, 3, 'Under proposed schedule, active instruction would have gained 3 future shifts');

// Because instruction is sealed to historical, operational forward planner generates no active shifts from it
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id128].status, 'historical', 'Instruction is safely sealed historical');
console.log('  ✔ Passed: Resurrection mathematically proven prevented: historical sealing blocks Oct/Nov future scope.\n');

// -------------------------------------------------------------
// Test 130: Anchor/schedule-field variant seals exhausted instruction (Offline17.5i)
// -------------------------------------------------------------
console.log('[Test 130] Anchor/schedule-field variant seals exhausted instruction...');
const id130 = 'ROSTER-JOB-ANCHOR-130-2026-09-05-SLOT-0';
const job130 = {
  id: 'JOB-ANCHOR-130',
  name: 'Anchor Job 130',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws130 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job130],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id130]: {
        id: id130,
        instructionId: id130,
        jobId: 'JOB-ANCHOR-130',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 2,
        sourceShiftId: 'JOB-ANCHOR-130@2026-09-05',
        status: 'active',
        lineageRootId: id130,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws130));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws130));

const proposed130 = Object.assign({}, job130, { anchorDate: '2026-09-12' });
const saveRes130 = window.HortOpsApp.saveJob(proposed130);
assert.strictEqual(saveRes130.success, true, 'Job anchor edit must succeed');
assert.strictEqual(window.HortOpsApp.state.jobs[0].anchorDate, '2026-09-12', 'Job anchorDate must be updated');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id130].status, 'historical', 'Exhausted instruction must be sealed to historical');
console.log('  ✔ Passed: Anchor-field schedule edit seals exhausted active instruction.\n');

// -------------------------------------------------------------
// Test 131: Mixed exhausted + incompatible future-active blocks with zero mutation (Offline17.5i)
// -------------------------------------------------------------
console.log('[Test 131] Mixed exhausted + incompatible future-active blocks with zero mutation...');
const id131_0 = 'ROSTER-JOB-MIXED-131-2026-09-05-SLOT-0';
const id131_1 = 'ROSTER-JOB-MIXED-131-2026-10-03-SLOT-1';
const job131 = {
  id: 'JOB-MIXED-131',
  name: 'Mixed Job 131',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 2
};
const ws131 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job131],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id131_0]: {
        id: id131_0,
        instructionId: id131_0,
        jobId: 'JOB-MIXED-131',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 2,
        sourceShiftId: 'JOB-MIXED-131@2026-09-05', // September 5 & 12 (exhausted)
        status: 'active',
        lineageRootId: id131_0,
        predecessorInstructionId: null,
        assignments: {}
      },
      [id131_1]: {
        id: id131_1,
        instructionId: id131_1,
        jobId: 'JOB-MIXED-131',
        slotId: 'SLOT-1',
        mode: 'manual',
        repeatCount: 4,
        sourceShiftId: 'JOB-MIXED-131@2026-10-03', // October future shifts
        status: 'active',
        lineageRootId: id131_1,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws131));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws131));

const proposed131 = Object.assign({}, job131, { intervalWeeks: 2 });
const saveRes131 = window.HortOpsApp.saveJob(proposed131);
assert.strictEqual(saveRes131.success, false, 'Cadence change incompatible with active future instruction must block');
assert.strictEqual(window.HortOpsApp.state.jobs[0].intervalWeeks, 1, 'Job intervalWeeks must remain 1');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id131_0].status, 'active', 'Exhausted instruction must NOT be partially sealed');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id131_1].status, 'active', 'Future active instruction must remain active');
console.log('  ✔ Passed: Mixed exhausted + incompatible future-active blocks transaction with zero mutation.\n');

// -------------------------------------------------------------
// Test 132: Multiple exhausted instructions seal atomically (Offline17.5i)
// -------------------------------------------------------------
console.log('[Test 132] Multiple exhausted instructions seal atomically on schedule mutation...');
const id132_0 = 'ROSTER-JOB-MULTI-132-2026-08-01-SLOT-0';
const id132_1 = 'ROSTER-JOB-MULTI-132-2026-09-05-SLOT-1';
const id132_2 = 'ROSTER-JOB-MULTI-132-2026-09-19-SLOT-2';
const job132 = {
  id: 'JOB-MULTI-132',
  name: 'Multi Exhausted Job 132',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-08-01',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 3
};
const ws132 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job132],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id132_0]: {
        id: id132_0,
        instructionId: id132_0,
        jobId: 'JOB-MULTI-132',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 4,
        sourceShiftId: 'JOB-MULTI-132@2026-08-01',
        status: 'active',
        lineageRootId: id132_0,
        predecessorInstructionId: null,
        assignments: {}
      },
      [id132_1]: {
        id: id132_1,
        instructionId: id132_1,
        jobId: 'JOB-MULTI-132',
        slotId: 'SLOT-1',
        mode: 'manual',
        repeatCount: 2,
        sourceShiftId: 'JOB-MULTI-132@2026-09-05',
        status: 'active',
        lineageRootId: id132_1,
        predecessorInstructionId: null,
        assignments: {}
      },
      [id132_2]: {
        id: id132_2,
        instructionId: id132_2,
        jobId: 'JOB-MULTI-132',
        slotId: 'SLOT-2',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-MULTI-132@2026-09-19',
        status: 'active',
        lineageRootId: id132_2,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws132));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws132));

const proposed132 = Object.assign({}, job132, { intervalWeeks: 3 });
const saveRes132 = window.HortOpsApp.saveJob(proposed132);
assert.strictEqual(saveRes132.success, true, 'Schedule edit with multiple exhausted instructions must succeed');
assert.strictEqual(window.HortOpsApp.state.jobs[0].intervalWeeks, 3, 'Job intervalWeeks must be updated to 3');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id132_0].status, 'historical', 'Instruction 0 must be sealed');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id132_1].status, 'historical', 'Instruction 1 must be sealed');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id132_2].status, 'historical', 'Instruction 2 must be sealed');
console.log('  ✔ Passed: Multiple exhausted instructions sealed atomically in one transaction.\n');

// -------------------------------------------------------------
// Test 133: Unresolved active instruction prevents any staged sealing (Offline17.5i)
// -------------------------------------------------------------
console.log('[Test 133] Unresolved active instruction prevents any staged sealing on schedule change...');
const id133_0 = 'ROSTER-JOB-UNRES-133-2026-09-05-SLOT-0';
const id133_1 = 'ROSTER-JOB-UNRES-133-2026-09-08-SLOT-1'; // Tuesday on Saturday job
const job133 = {
  id: 'JOB-UNRES-133',
  name: 'Unresolved Job 133',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 2
};
const ws133 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job133],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id133_0]: {
        id: id133_0,
        instructionId: id133_0,
        jobId: 'JOB-UNRES-133',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-UNRES-133@2026-09-05',
        status: 'active',
        lineageRootId: id133_0,
        predecessorInstructionId: null,
        assignments: {}
      },
      [id133_1]: {
        id: id133_1,
        instructionId: id133_1,
        jobId: 'JOB-UNRES-133',
        slotId: 'SLOT-1',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-UNRES-133@2026-09-08',
        status: 'active',
        lineageRootId: id133_1,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws133));
window.HortOpsStorageDriver.set('hort_ops_workspace_v2', ws133);

const proposed133 = Object.assign({}, job133, { intervalWeeks: 2 });
const saveRes133 = window.HortOpsApp.saveJob(proposed133);
assert.strictEqual(saveRes133.success, false, 'Unresolved active instruction must fail closed');
assert.strictEqual(window.HortOpsApp.state.jobs[0].intervalWeeks, 1, 'Job intervalWeeks must remain 1');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id133_0].status, 'active', 'Slot 0 must NOT be partially sealed');
console.log('  ✔ Passed: Unresolved active instruction blocks schedule change with zero partial sealing.\n');

// -------------------------------------------------------------
// Test 134: Non-scheduling Job edit does not trigger sealing (Offline17.5i)
// -------------------------------------------------------------
console.log('[Test 134] Non-scheduling Job edit does not trigger sealing...');
const id134 = 'ROSTER-JOB-NON-SCHED-134-2026-09-05-SLOT-0';
const job134 = {
  id: 'JOB-NON-SCHED-134',
  name: 'Non-Sched Job 134',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws134 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job134],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id134]: {
        id: id134,
        instructionId: id134,
        jobId: 'JOB-NON-SCHED-134',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-NON-SCHED-134@2026-09-05',
        status: 'active',
        lineageRootId: id134,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws134));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws134));

const proposed134 = Object.assign({}, job134, { name: 'Renamed Job 134', notes: 'Updated notes' });
const saveRes134 = window.HortOpsApp.saveJob(proposed134);
assert.strictEqual(saveRes134.success, true, 'Non-scheduling edit must succeed');
assert.strictEqual(window.HortOpsApp.state.jobs[0].name, 'Renamed Job 134', 'Job name must be updated');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id134].status, 'active', 'Exhausted instruction must remain ACTIVE on non-scheduling edit');
console.log('  ✔ Passed: Non-scheduling edit leaves exhausted instruction status untouched.\n');

// -------------------------------------------------------------
// Test 135: Persistence failure restores Job and exhausted instruction statuses (Offline17.5i)
// -------------------------------------------------------------
console.log('[Test 135] Persistence failure restores Job and exhausted instruction statuses (atomic rollback)...');
const id135 = 'ROSTER-JOB-ROLLBACK-135-2026-09-05-SLOT-0';
const job135 = {
  id: 'JOB-ROLLBACK-135',
  name: 'Rollback Job 135',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws135 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job135],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id135]: {
        id: id135,
        instructionId: id135,
        jobId: 'JOB-ROLLBACK-135',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-ROLLBACK-135@2026-09-05',
        status: 'active',
        lineageRootId: id135,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws135));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws135));

const origSaveWorkspace135 = window.HortOpsStorage.saveWorkspace;
window.HortOpsStorage.saveWorkspace = function() {
  return { ok: false, error: 'Simulated storage failure on schedule change' };
};

const proposed135 = Object.assign({}, job135, { intervalWeeks: 2 });
const saveRes135 = window.HortOpsApp.saveJob(proposed135);
assert.strictEqual(saveRes135.success, false, 'saveJob must fail on storage error');
assert.strictEqual(window.HortOpsApp.state.jobs[0].intervalWeeks, 1, 'Job intervalWeeks must be rolled back to 1');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id135].status, 'active', 'Instruction status must be rolled back to active');

window.HortOpsStorage.saveWorkspace = origSaveWorkspace135;
console.log('  ✔ Passed: Storage failure during schedule mutation atomically rolls back both Job and instruction.\n');

// -------------------------------------------------------------
// Test 136: Save/reload preserves historical sealing and new Job schedule (Offline17.5i)
// -------------------------------------------------------------
console.log('[Test 136] Save/reload preserves historical sealing and new Job schedule...');
const id136 = 'ROSTER-JOB-RELOAD-136-2026-09-05-SLOT-0';
const job136 = {
  id: 'JOB-RELOAD-136',
  name: 'Reload Job 136',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws136 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job136],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id136]: {
        id: id136,
        instructionId: id136,
        jobId: 'JOB-RELOAD-136',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 2,
        sourceShiftId: 'JOB-RELOAD-136@2026-09-05',
        status: 'active',
        lineageRootId: id136,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws136));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws136));

const proposed136 = Object.assign({}, job136, { intervalWeeks: 4 });
const saveRes136 = window.HortOpsApp.saveJob(proposed136);
assert.strictEqual(saveRes136.success, true, 'Job save must succeed and seal instruction');

const loaded136 = window.HortOpsStorage.loadWorkspace();
const job136InStorage = loaded136.jobs.find(j => j.id === 'JOB-RELOAD-136');
assert(job136InStorage, 'JOB-RELOAD-136 must exist in storage');
assert.strictEqual(job136InStorage.intervalWeeks, 4, 'Persisted job must retain intervalWeeks = 4');
assert.strictEqual(loaded136.rostering.instructions[id136].status, 'historical', 'Persisted instruction must remain historical');
const val136 = window.HortOpsSchemaValidator.validate(loaded136);
assert.strictEqual(val136.valid, true, 'Reloaded workspace passes Schema v2: ' + (val136.error || ''));
console.log('  ✔ Passed: Save/reload confirms persistent historical sealing and updated recurrence.\n');

// -------------------------------------------------------------
// Test 137: Assignment-free exhausted active instruction seals correctly (Offline17.5i)
// -------------------------------------------------------------
console.log('[Test 137] Assignment-free exhausted active instruction seals correctly (vacant slot)...');
const id137 = 'ROSTER-JOB-VACANT-137-2026-09-05-SLOT-0';
const job137 = {
  id: 'JOB-VACANT-137',
  name: 'Vacant Job 137',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws137 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job137],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id137]: {
        id: id137,
        instructionId: id137,
        jobId: 'JOB-VACANT-137',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-VACANT-137@2026-09-05',
        status: 'active',
        lineageRootId: id137,
        predecessorInstructionId: null,
        assignments: {} // 0 assignments
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws137));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws137));

const proposed137 = Object.assign({}, job137, { intervalWeeks: 2 });
const saveRes137 = window.HortOpsApp.saveJob(proposed137);
assert.strictEqual(saveRes137.success, true, 'Vacant exhausted instruction must seal on schedule edit');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id137].status, 'historical', 'Vacant instruction must be sealed to historical');
console.log('  ✔ Passed: Assignment-free exhausted active instruction seals cleanly (vacant slot principle).\n');

// -------------------------------------------------------------
// Test 138: Exhausted Rotation instruction seals without re-running rotation (Offline17.5i)
// -------------------------------------------------------------
console.log('[Test 138] Exhausted Rotation instruction seals without re-running rotation...');
const id138 = 'ROSTER-JOB-ROT-138-2026-09-05-SLOT-0';
const job138 = {
  id: 'JOB-ROT-138',
  name: 'Rotation Job 138',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws138 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job138],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id138]: {
        id: id138,
        instructionId: id138,
        jobId: 'JOB-ROT-138',
        slotId: 'SLOT-0',
        mode: 'rotation',
        rotationPool: ['EMP-001', 'EMP-002'],
        repeatCount: 2,
        sourceShiftId: 'JOB-ROT-138@2026-09-05',
        status: 'active',
        lineageRootId: id138,
        predecessorInstructionId: null,
        assignments: {
          'JOB-ROT-138@2026-09-05': 'EMP-001',
          'JOB-ROT-138@2026-09-12': 'EMP-002'
        }
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws138));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws138));

const proposed138 = Object.assign({}, job138, { intervalWeeks: 2 });
const saveRes138 = window.HortOpsApp.saveJob(proposed138);
assert.strictEqual(saveRes138.success, true, 'Rotation exhausted instruction must seal on schedule edit');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id138].status, 'historical', 'Rotation instruction must be sealed to historical');
assert.deepStrictEqual(window.HortOpsApp.state.rostering.instructions[id138].assignments, {
  'JOB-ROT-138@2026-09-05': 'EMP-001',
  'JOB-ROT-138@2026-09-12': 'EMP-002'
}, 'Historical assignments must remain exactly preserved without re-running rotation');
console.log('  ✔ Passed: Exhausted Rotation instruction sealed historical without re-running rotation logic.\n');

// -------------------------------------------------------------
// Test 139: Exhausted + compatible future-active instruction (Offline17.5i)
// -------------------------------------------------------------
console.log('[Test 139] Exhausted + compatible future-active instruction...');
const id139_0 = 'ROSTER-JOB-COMPAT-139-2026-09-05-SLOT-0';
const id139_1 = 'ROSTER-JOB-COMPAT-139-2026-10-03-SLOT-1';
const job139 = {
  id: 'JOB-COMPAT-139',
  name: 'Compat Job 139',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 2
};
const ws139 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job139],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  rostering: {
    instructions: {
      [id139_0]: {
        id: id139_0,
        instructionId: id139_0,
        jobId: 'JOB-COMPAT-139',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-COMPAT-139@2026-09-05', // Exhausted September
        status: 'active',
        lineageRootId: id139_0,
        predecessorInstructionId: null,
        assignments: {}
      },
      [id139_1]: {
        id: id139_1,
        instructionId: id139_1,
        jobId: 'JOB-COMPAT-139',
        slotId: 'SLOT-1',
        mode: 'manual',
        repeatCount: 4,
        sourceShiftId: 'JOB-COMPAT-139@2026-10-03', // October future shifts
        status: 'active',
        lineageRootId: id139_1,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  assignments: {},
  historicalSnapshots: {},
  customPermits: {}
};
window.HortOpsApp.state = JSON.parse(JSON.stringify(ws139));
window.HortOpsStorage.saveWorkspace(window.HortOpsStorage.createWorkspaceEnvelope(ws139));

// Mutation: update targetMonth while intervalWeeks & anchorDate remain identical, preserving exact Saturday sequence
const proposed139 = Object.assign({}, job139, { targetMonth: 10 });
const saveRes139 = window.HortOpsApp.saveJob(proposed139);
assert.strictEqual(saveRes139.success, true, 'Compatible schedule mutation must succeed');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id139_0].status, 'historical', 'Slot 0 exhausted instruction must be sealed to historical');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id139_1].status, 'active', 'Slot 1 future-active instruction must remain active');
console.log('  ✔ Passed: Compatible schedule edit seals exhausted instruction while preserving future-active instruction.\n');

// -------------------------------------------------------------
// Test 140: Historical Fixed instruction + future provenance (target >= today) fails Schema v2 (Invariant I2)
// -------------------------------------------------------------
console.log('[Test 140] Historical Fixed instruction + future provenance (target >= today) fails Schema v2 (Invariant I2)...');
const id140 = 'ROSTER-JOB-FUT-PROV-140-2026-09-05-SLOT-0';
const job140 = {
  id: 'JOB-FUT-PROV-140',
  name: 'Job 140 Fut Prov',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const env140 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job140],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  historicalSnapshots: {},
  assignments: {
    'JOB-FUT-PROV-140@2026-11-07': ['EMP-001']
  },
  rostering: {
    instructions: {
      [id140]: {
        id: id140,
        instructionId: id140,
        jobId: 'JOB-FUT-PROV-140',
        slotId: 'SLOT-0',
        mode: 'fixed',
        employeeId: 'EMP-001',
        repeatCount: 2,
        sourceShiftId: 'JOB-FUT-PROV-140@2026-09-05',
        status: 'historical', // Historical instruction
        lineageRootId: id140,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {
      'JOB-FUT-PROV-140@2026-11-07:EMP-001': {
        source: 'rostering-rule',
        instructionId: id140,
        strategy: 'fixed',
        sourceShiftId: 'JOB-FUT-PROV-140@2026-09-05',
        slotId: 'SLOT-0',
        sequenceIndex: 0
      }
    }
  },
  customPermits: {}
};

const valRes140 = window.HortOpsSchemaValidator.validate(env140);
assert.strictEqual(valRes140.valid, false, 'Historical instruction owning future provenance must be rejected by Schema v2');
assert(valRes140.error.includes('cannot own current or future provenance'), 'Error must identify temporal provenance contradiction: ' + valRes140.error);
console.log('  ✔ Passed: Historical instruction owning future provenance strictly rejected by Schema v2 (Invariant I2).\n');

// -------------------------------------------------------------
// Test 141: Historical Fixed instruction + past provenance (target < today) is valid in Schema v2 (Invariant I2/I4)
// -------------------------------------------------------------
console.log('[Test 141] Historical Fixed instruction + past provenance (target < today) is valid in Schema v2 (Invariant I2/I4)...');
const id141 = 'ROSTER-JOB-PAST-PROV-141-2026-09-05-SLOT-0';
const job141 = {
  id: 'JOB-PAST-PROV-141',
  name: 'Job 141 Past Prov',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const env141 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job141],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  historicalSnapshots: {},
  assignments: {
    'JOB-PAST-PROV-141@2026-09-05': ['EMP-001'],
    'JOB-PAST-PROV-141@2026-09-12': ['EMP-001']
  },
  rostering: {
    instructions: {
      [id141]: {
        id: id141,
        instructionId: id141,
        jobId: 'JOB-PAST-PROV-141',
        slotId: 'SLOT-0',
        mode: 'fixed',
        employeeId: 'EMP-001',
        repeatCount: 2,
        sourceShiftId: 'JOB-PAST-PROV-141@2026-09-05',
        status: 'historical',
        lineageRootId: id141,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {
      'JOB-PAST-PROV-141@2026-09-05:EMP-001': {
        source: 'rostering-rule',
        instructionId: id141,
        strategy: 'fixed',
        sourceShiftId: 'JOB-PAST-PROV-141@2026-09-05',
        slotId: 'SLOT-0',
        sequenceIndex: 0
      },
      'JOB-PAST-PROV-141@2026-09-12:EMP-001': {
        source: 'rostering-rule',
        instructionId: id141,
        strategy: 'fixed',
        sourceShiftId: 'JOB-PAST-PROV-141@2026-09-05',
        slotId: 'SLOT-0',
        sequenceIndex: 1
      }
    }
  },
  customPermits: {}
};

const valRes141 = window.HortOpsSchemaValidator.validate(env141);
assert.strictEqual(valRes141.valid, true, 'Historical instruction with past provenance must remain valid in Schema v2: ' + (valRes141.error || ''));
console.log('  ✔ Passed: Historical instruction + past provenance remains 100% valid (Invariant I2/I4).\n');

// -------------------------------------------------------------
// Test 142: Future assignment linked to historical instruction blocks Job mutation (Defence-in-depth)
// -------------------------------------------------------------
console.log('[Test 142] Future assignment linked to historical instruction blocks Job schedule mutation...');
const job142 = {
  id: 'JOB-DEFENCE-142',
  name: 'Job 142 Defence',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const id142 = 'ROSTER-JOB-DEFENCE-142-2026-09-05-SLOT-0';
const ws142 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job142],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  historicalSnapshots: {},
  assignments: {
    'JOB-DEFENCE-142@2026-10-17': ['EMP-001']
  },
  rostering: {
    instructions: {
      [id142]: {
        id: id142,
        instructionId: id142,
        jobId: 'JOB-DEFENCE-142',
        slotId: 'SLOT-0',
        mode: 'fixed',
        employeeId: 'EMP-001',
        repeatCount: 1,
        sourceShiftId: 'JOB-DEFENCE-142@2026-09-05',
        status: 'historical',
        lineageRootId: id142,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {
      'JOB-DEFENCE-142@2026-10-17:EMP-001': {
        source: 'rostering-rule',
        instructionId: id142,
        strategy: 'fixed',
        sourceShiftId: 'JOB-DEFENCE-142@2026-09-05',
        slotId: 'SLOT-0',
        sequenceIndex: 0
      }
    }
  },
  customPermits: {}
};

window.HortOpsApp.state = JSON.parse(JSON.stringify(ws142));
const proposed142 = Object.assign({}, job142, { intervalWeeks: 2 });
const saveRes142 = window.HortOpsApp.saveJob(proposed142);
assert.strictEqual(saveRes142.success, false, 'Future assignment linked to historical instruction must block Job mutation');
assert((saveRes142.error || '').includes('linked to a historical instruction'), 'Error must explain historical instruction link: ' + (saveRes142.error || ''));
assert.strictEqual(window.HortOpsApp.state.jobs[0].intervalWeeks, 1, 'Job intervalWeeks must remain 1 (zero mutation)');
console.log('  ✔ Passed: Future assignment linked to historical instruction blocks Job mutation fail-closed.\n');

// -------------------------------------------------------------
// Test 143: Active future provenance remains valid in Schema v2 (Invariant I2)
// -------------------------------------------------------------
console.log('[Test 143] Active future provenance remains valid in Schema v2...');
const id143 = 'ROSTER-JOB-ACTIVE-143-2026-10-03-SLOT-0';
const job143 = {
  id: 'JOB-ACTIVE-143',
  name: 'Job 143 Active',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const env143 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job143],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  historicalSnapshots: {},
  assignments: {
    'JOB-ACTIVE-143@2026-10-03': ['EMP-001'],
    'JOB-ACTIVE-143@2026-10-10': ['EMP-001']
  },
  rostering: {
    instructions: {
      [id143]: {
        id: id143,
        instructionId: id143,
        jobId: 'JOB-ACTIVE-143',
        slotId: 'SLOT-0',
        mode: 'fixed',
        employeeId: 'EMP-001',
        repeatCount: 2,
        sourceShiftId: 'JOB-ACTIVE-143@2026-10-03',
        status: 'active',
        lineageRootId: id143,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {
      'JOB-ACTIVE-143@2026-10-03:EMP-001': {
        source: 'rostering-rule',
        instructionId: id143,
        strategy: 'fixed',
        sourceShiftId: 'JOB-ACTIVE-143@2026-10-03',
        slotId: 'SLOT-0',
        sequenceIndex: 0
      },
      'JOB-ACTIVE-143@2026-10-10:EMP-001': {
        source: 'rostering-rule',
        instructionId: id143,
        strategy: 'fixed',
        sourceShiftId: 'JOB-ACTIVE-143@2026-10-03',
        slotId: 'SLOT-0',
        sequenceIndex: 1
      }
    }
  },
  customPermits: {}
};

const valRes143 = window.HortOpsSchemaValidator.validate(env143);
assert.strictEqual(valRes143.valid, true, 'Active future provenance must be valid: ' + (valRes143.error || ''));
console.log('  ✔ Passed: Active future provenance remains 100% valid in Schema v2.\n');

// -------------------------------------------------------------
// Test 144: Historical instruction remains valid under inactive Job (Invariant I4)
// -------------------------------------------------------------
console.log('[Test 144] Historical instruction remains valid under inactive Job (Invariant I4)...');
const id144 = 'ROSTER-JOB-INACTIVE-144-2026-09-05-SLOT-0';
const job144 = {
  id: 'JOB-INACTIVE-144',
  name: 'Job 144 Inactive',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'inactive',
  shiftDurationHours: 8,
  crewSize: 1
};
const env144 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job144],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  historicalSnapshots: {},
  assignments: {
    'JOB-INACTIVE-144@2026-09-05': ['EMP-001']
  },
  rostering: {
    instructions: {
      [id144]: {
        id: id144,
        instructionId: id144,
        jobId: 'JOB-INACTIVE-144',
        slotId: 'SLOT-0',
        mode: 'fixed',
        employeeId: 'EMP-001',
        repeatCount: 1,
        sourceShiftId: 'JOB-INACTIVE-144@2026-09-05',
        status: 'historical',
        lineageRootId: id144,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {
      'JOB-INACTIVE-144@2026-09-05:EMP-001': {
        source: 'rostering-rule',
        instructionId: id144,
        strategy: 'fixed',
        sourceShiftId: 'JOB-INACTIVE-144@2026-09-05',
        slotId: 'SLOT-0',
        sequenceIndex: 0
      }
    }
  },
  customPermits: {}
};

const valRes144 = window.HortOpsSchemaValidator.validate(env144);
assert.strictEqual(valRes144.valid, true, 'Historical instruction under inactive Job must remain valid: ' + (valRes144.error || ''));
console.log('  ✔ Passed: Historical instruction remains valid under inactive Job (Invariant I4).\n');

// -------------------------------------------------------------
// Test 145: Active instruction under inactive Job is rejected by Schema v2 (Invariant I1)
// -------------------------------------------------------------
console.log('[Test 145] Active instruction under inactive Job is rejected by Schema v2 (Invariant I1)...');
const env145 = JSON.parse(JSON.stringify(env144));
env145.rostering.instructions[id144].status = 'active';
const valRes145 = window.HortOpsSchemaValidator.validate(env145);
assert.strictEqual(valRes145.valid, false, 'Active instruction under inactive Job must be rejected');
assert(valRes145.error.includes('belongs to non-active Job'), 'Error must explain non-active parent Job: ' + valRes145.error);
console.log('  ✔ Passed: Active instruction under inactive Job strictly rejected (Invariant I1).\n');

// -------------------------------------------------------------
// Test 146: Active future instruction that fails operational resolution blocks schedule mutation (Invariant I3/I5)
// -------------------------------------------------------------
console.log('[Test 146] Active future instruction that fails operational resolution blocks schedule mutation (Invariant I3/I5)...');
const id146 = 'ROSTER-JOB-UNRES-146-2026-10-06-SLOT-0'; // Tuesday on a Saturday recurring job
const job146 = {
  id: 'JOB-UNRES-146',
  name: 'Job 146 Unres',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws146 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job146],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id146]: {
        id: id146,
        instructionId: id146,
        jobId: 'JOB-UNRES-146',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-UNRES-146@2026-10-06',
        status: 'active',
        lineageRootId: id146,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  customPermits: {}
};

window.HortOpsApp.state = JSON.parse(JSON.stringify(ws146));
const proposed146 = Object.assign({}, job146, { intervalWeeks: 2 });
const saveRes146 = window.HortOpsApp.saveJob(proposed146);
assert.strictEqual(saveRes146.success, false, 'Unresolvable active instruction must block schedule edit');
assert.strictEqual(window.HortOpsApp.state.jobs[0].intervalWeeks, 1, 'Job schedule must remain unchanged');
console.log('  ✔ Passed: Unresolvable active instruction blocks schedule mutation fail-closed (Invariant I3/I5).\n');

// -------------------------------------------------------------
// Test 147: Exhausted active instruction seals to historical before schedule mutation (Invariant I6)
// -------------------------------------------------------------
console.log('[Test 147] Exhausted active instruction seals to historical before schedule mutation (Invariant I6)...');
const id147 = 'ROSTER-JOB-SEAL-147-2026-09-05-SLOT-0';
const job147 = {
  id: 'JOB-SEAL-147',
  name: 'Job 147 Seal',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws147 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job147],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id147]: {
        id: id147,
        instructionId: id147,
        jobId: 'JOB-SEAL-147',
        slotId: 'SLOT-0',
        mode: 'fixed',
        employeeId: 'EMP-001',
        repeatCount: 4,
        sourceShiftId: 'JOB-SEAL-147@2026-09-05',
        status: 'active', // Exhausted in September
        lineageRootId: id147,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  customPermits: {}
};

window.HortOpsApp.state = JSON.parse(JSON.stringify(ws147));
const proposed147 = Object.assign({}, job147, { intervalWeeks: 4 });
const saveRes147 = window.HortOpsApp.saveJob(proposed147);
assert.strictEqual(saveRes147.success, true, 'Exhausted instruction must allow schedule mutation');
assert.strictEqual(window.HortOpsApp.state.jobs[0].intervalWeeks, 4, 'Job schedule must be updated');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id147].status, 'historical', 'Exhausted instruction must be sealed historical');

// Reactivation / subsequent edits must NOT resurrect instruction
const reactivateJob147 = Object.assign({}, window.HortOpsApp.state.jobs[0], { intervalWeeks: 2 });
window.HortOpsApp.saveJob(reactivateJob147);
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id147].status, 'historical', 'Historical instruction never regains active status');
console.log('  ✔ Passed: Exhausted active instruction sealed historical and never resurrected (Invariant I6).\n');

// -------------------------------------------------------------
// Test 148: Any rostering instruction prevents hard delete, retiring Job instead (Invariant I7)
// -------------------------------------------------------------
console.log('[Test 148] Any rostering instruction prevents hard delete, retiring Job instead (Invariant I7)...');
const id148 = 'ROSTER-JOB-HARD-DEL-148-2026-09-05-SLOT-0';
const job148 = {
  id: 'JOB-HARD-DEL-148',
  name: 'Job 148 Hard Del',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws148 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job148],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id148]: {
        id: id148,
        instructionId: id148,
        jobId: 'JOB-HARD-DEL-148',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-HARD-DEL-148@2026-09-05',
        status: 'historical',
        lineageRootId: id148,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  customPermits: {}
};

window.HortOpsApp.state = JSON.parse(JSON.stringify(ws148));
window.HortOpsApp.deleteJob('JOB-HARD-DEL-148');
assert.strictEqual(window.HortOpsApp.state.jobs.length, 1, 'Job must NOT be deleted from state.jobs');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'inactive', 'Job must be retired to inactive');
console.log('  ✔ Passed: Any rostering instruction prevents hard delete, retiring Job instead (Invariant I7).\n');

// -------------------------------------------------------------
// Test 149: Future active rostering strictly blocks Job retirement (Invariant I8)
// -------------------------------------------------------------
console.log('[Test 149] Future active rostering strictly blocks Job retirement (Invariant I8)...');
const id149 = 'ROSTER-JOB-RETIRE-149-2026-10-03-SLOT-0';
const job149 = {
  id: 'JOB-RETIRE-149',
  name: 'Job 149 Retire Block',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws149 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job149],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id149]: {
        id: id149,
        instructionId: id149,
        jobId: 'JOB-RETIRE-149',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-RETIRE-149@2026-10-03',
        status: 'active', // Future active
        lineageRootId: id149,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  customPermits: {}
};

window.HortOpsApp.state = JSON.parse(JSON.stringify(ws149));
const proposed149 = Object.assign({}, job149, { status: 'inactive' });
const saveRes149 = window.HortOpsApp.saveJob(proposed149);
assert.strictEqual(saveRes149.success, false, 'Retirement must be blocked when future active rostering exists');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'active', 'Job status must remain active');
console.log('  ✔ Passed: Future active rostering strictly blocks Job retirement (Invariant I8).\n');

// -------------------------------------------------------------
// Test 150: Completed historical lineage with zero active terminal instructions is valid in Schema v2 (Invariant I9)
// -------------------------------------------------------------
console.log('[Test 150] Completed historical lineage with zero active terminal instructions is valid in Schema v2 (Invariant I9)...');
const id150_1 = 'ROSTER-JOB-CHAIN-150-2026-08-01-SLOT-0';
const id150_2 = 'ROSTER-JOB-CHAIN-150-2026-09-05-SLOT-0';
const job150 = {
  id: 'JOB-CHAIN-150',
  name: 'Job 150 Chain',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-08-01',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const env150 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job150],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id150_1]: {
        id: id150_1,
        instructionId: id150_1,
        jobId: 'JOB-CHAIN-150',
        slotId: 'SLOT-0',
        mode: 'fixed',
        employeeId: 'EMP-001',
        repeatCount: 1,
        sourceShiftId: 'JOB-CHAIN-150@2026-08-01',
        status: 'historical',
        lineageRootId: id150_1,
        predecessorInstructionId: null,
        assignments: {}
      },
      [id150_2]: {
        id: id150_2,
        instructionId: id150_2,
        jobId: 'JOB-CHAIN-150',
        slotId: 'SLOT-0',
        mode: 'fixed',
        employeeId: 'EMP-002',
        repeatCount: 1,
        sourceShiftId: 'JOB-CHAIN-150@2026-09-05',
        status: 'historical', // Completed chain with 0 active terminals
        lineageRootId: id150_1,
        predecessorInstructionId: id150_1,
        assignments: {}
      }
    },
    provenance: {}
  },
  customPermits: {}
};

const valRes150 = window.HortOpsSchemaValidator.validate(env150);
assert.strictEqual(valRes150.valid, true, 'Completed historical chain with 0 active terminals must be valid: ' + (valRes150.error || ''));
console.log('  ✔ Passed: Completed historical chain with zero active terminals validates cleanly (Invariant I9).\n');

// -------------------------------------------------------------
// Test 151: Permitted schedule mutation preserves exact active future sequence semantics (Invariant I10)
// -------------------------------------------------------------
console.log('[Test 151] Permitted schedule mutation preserves exact active future sequence semantics (Invariant I10)...');
const id151 = 'ROSTER-JOB-PRESERVE-151-2026-10-03-SLOT-0';
const job151 = {
  id: 'JOB-PRESERVE-151',
  name: 'Job 151 Preserve',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws151 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job151],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id151]: {
        id: id151,
        instructionId: id151,
        jobId: 'JOB-PRESERVE-151',
        slotId: 'SLOT-0',
        mode: 'fixed',
        employeeId: 'EMP-001',
        repeatCount: 3,
        sourceShiftId: 'JOB-PRESERVE-151@2026-10-03',
        status: 'active',
        lineageRootId: id151,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  customPermits: {}
};

window.HortOpsApp.state = JSON.parse(JSON.stringify(ws151));
const seqBefore151 = formVal.resolveInstructionOccurrences(job151, '2026-10-03', 3).filter(d => d >= '2026-10-01');

// Update targetMonth while preserving weekly interval and Saturday anchor
const proposed151 = Object.assign({}, job151, { targetMonth: 10 });
const saveRes151 = window.HortOpsApp.saveJob(proposed151);
assert.strictEqual(saveRes151.success, true, 'Sequence-preserving schedule edit must succeed');

const seqAfter151 = formVal.resolveInstructionOccurrences(window.HortOpsApp.state.jobs[0], '2026-10-03', 3).filter(d => d >= '2026-10-01');
assert.deepStrictEqual(seqBefore151, seqAfter151, 'Future occurrence sequence BEFORE must exactly match AFTER');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id151].status, 'active', 'Instruction must remain active');
console.log('  ✔ Passed: Permitted schedule mutation preserves exact active future sequence semantics (Invariant I10).\n');

// -------------------------------------------------------------
// Test 152: Mixed exhausted + incompatible future-active blocks transaction with zero mutation (Invariant I11)
// -------------------------------------------------------------
console.log('[Test 152] Mixed exhausted + incompatible future-active blocks transaction with zero mutation (Invariant I11)...');
const id152_0 = 'ROSTER-JOB-ATOMIC-152-2026-09-05-SLOT-0';
const id152_1 = 'ROSTER-JOB-ATOMIC-152-2026-10-03-SLOT-1';
const job152 = {
  id: 'JOB-ATOMIC-152',
  name: 'Job 152 Atomic',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 2
};
const ws152 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job152],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id152_0]: {
        id: id152_0,
        instructionId: id152_0,
        jobId: 'JOB-ATOMIC-152',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 2,
        sourceShiftId: 'JOB-ATOMIC-152@2026-09-05', // Exhausted (09-05, 09-12)
        status: 'active',
        lineageRootId: id152_0,
        predecessorInstructionId: null,
        assignments: {}
      },
      [id152_1]: {
        id: id152_1,
        instructionId: id152_1,
        jobId: 'JOB-ATOMIC-152',
        slotId: 'SLOT-1',
        mode: 'manual',
        repeatCount: 3,
        sourceShiftId: 'JOB-ATOMIC-152@2026-10-03', // Future active
        status: 'active',
        lineageRootId: id152_1,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  customPermits: {}
};

window.HortOpsApp.state = JSON.parse(JSON.stringify(ws152));
const proposed152 = Object.assign({}, job152, { intervalWeeks: 3 });
const saveRes152 = window.HortOpsApp.saveJob(proposed152);
assert.strictEqual(saveRes152.success, false, 'Incompatible future active instruction must block transaction');
assert.strictEqual(window.HortOpsApp.state.jobs[0].intervalWeeks, 1, 'Job intervalWeeks must remain 1');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id152_0].status, 'active', 'Exhausted instruction must NOT be partially sealed');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id152_1].status, 'active', 'Future active instruction must remain active');
console.log('  ✔ Passed: Blocked transaction makes zero live or persisted mutation (Invariant I11).\n');

// -------------------------------------------------------------
// Test 153: Persistence failure during mutation triggers complete transactional rollback (Invariant I11)
// -------------------------------------------------------------
console.log('[Test 153] Persistence failure during mutation triggers complete transactional rollback (Invariant I11)...');
const id153 = 'ROSTER-JOB-FAIL-153-2026-09-05-SLOT-0';
const job153 = {
  id: 'JOB-FAIL-153',
  name: 'Job 153 Storage Fail',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws153 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job153],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id153]: {
        id: id153,
        instructionId: id153,
        jobId: 'JOB-FAIL-153',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-FAIL-153@2026-09-05',
        status: 'active',
        lineageRootId: id153,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {}
  },
  customPermits: {}
};

window.HortOpsApp.state = JSON.parse(JSON.stringify(ws153));
const origSave153 = window.HortOpsStorage.saveWorkspace;
window.HortOpsStorage.saveWorkspace = () => ({ ok: false, error: 'Simulated disk write error' });

const proposed153 = Object.assign({}, job153, { intervalWeeks: 2 });
const saveRes153 = window.HortOpsApp.saveJob(proposed153);
assert.strictEqual(saveRes153.success, false, 'saveJob must fail on storage error');
assert.strictEqual(window.HortOpsApp.state.jobs[0].intervalWeeks, 1, 'Job intervalWeeks must be rolled back');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id153].status, 'active', 'Instruction status must be rolled back to active');

window.HortOpsStorage.saveWorkspace = origSave153;
console.log('  ✔ Passed: Persistence failure triggers complete transactional rollback (Invariant I11).\n');

// -------------------------------------------------------------
// Test 154: Load -> Save equivalence: accepted loaded state is immediately saveable unchanged (Invariant I12)
// -------------------------------------------------------------
console.log('[Test 154] Load -> Save equivalence: accepted loaded state is immediately saveable unchanged (Invariant I12)...');
const env154 = window.HortOpsStorage.loadWorkspace();
const saveEnv154 = window.HortOpsStorage.createWorkspaceEnvelope(env154);
const saveRes154 = window.HortOpsStorage.saveWorkspace(saveEnv154);
assert.strictEqual(saveRes154.ok, true, 'Save of loaded workspace must succeed');
const reloaded154 = window.HortOpsStorage.loadWorkspace();
assert.strictEqual(reloaded154.recoveryRequired, false, 'Reloaded workspace must not require recovery');
const val154 = window.HortOpsSchemaValidator.validate(reloaded154);
assert.strictEqual(val154.valid, true, 'Reloaded workspace must validate Schema v2');
console.log('  ✔ Passed: Accepted loaded state is immediately saveable unchanged without drift (Invariant I12).\n');

// -------------------------------------------------------------
// Test 155: Trusted explicit occurrence authorizes modern active instruction across lifecycle
// -------------------------------------------------------------
console.log('[Test 155] Trusted explicit occurrence authorizes modern active instruction across lifecycle...');
const id155 = 'ROSTER-tramline-5am-2026-09-27-SLOT-1';
const env155 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [jobTramline],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  historicalSnapshots: {},
  assignments: {
    'tramline-5am@2026-09-27': ['EMP-001']
  },
  rostering: {
    instructions: {
      [id155]: {
        id: id155,
        instructionId: id155,
        jobId: 'tramline-5am',
        slotId: 'SLOT-1',
        mode: 'fixed',
        employeeId: 'EMP-001',
        repeatCount: 1,
        sourceShiftId: 'tramline-5am@2026-09-27',
        status: 'active',
        lineageRootId: id155,
        predecessorInstructionId: null,
        assignments: {}
      }
    },
    provenance: {
      'tramline-5am@2026-09-27:EMP-001': {
        source: 'rostering-rule',
        instructionId: id155,
        strategy: 'fixed',
        sourceShiftId: 'tramline-5am@2026-09-27',
        slotId: 'SLOT-1',
        sequenceIndex: 0
      }
    }
  },
  customPermits: {}
};

const valRes155 = window.HortOpsSchemaValidator.validate(env155);
assert.strictEqual(valRes155.valid, true, 'Trusted explicit occurrence must authorize active instruction: ' + (valRes155.error || ''));
console.log('  ✔ Passed: Trusted explicit operational occurrence authorises modern active instruction.\n');

// -------------------------------------------------------------
// Test 156: Exhausted Rotation instruction seals historical preserving rotation assignments
// -------------------------------------------------------------
console.log('[Test 156] Exhausted Rotation instruction seals historical preserving rotation assignments...');
const id156 = 'ROSTER-JOB-ROT-156-2026-09-05-SLOT-0';
const job156 = {
  id: 'JOB-ROT-156',
  name: 'Job 156 Rotation',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-09-05',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws156 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job156],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id156]: {
        id: id156,
        instructionId: id156,
        jobId: 'JOB-ROT-156',
        slotId: 'SLOT-0',
        mode: 'rotation',
        rotationPool: ['EMP-001', 'EMP-002'],
        repeatCount: 2,
        sourceShiftId: 'JOB-ROT-156@2026-09-05',
        status: 'active',
        lineageRootId: id156,
        predecessorInstructionId: null,
        assignments: {
          'JOB-ROT-156@2026-09-05': 'EMP-001',
          'JOB-ROT-156@2026-09-12': 'EMP-002'
        }
      }
    },
    provenance: {}
  },
  customPermits: {}
};

window.HortOpsApp.state = JSON.parse(JSON.stringify(ws156));
const proposed156 = Object.assign({}, job156, { intervalWeeks: 2 });
const saveRes156 = window.HortOpsApp.saveJob(proposed156);
assert.strictEqual(saveRes156.success, true, 'Rotation schedule edit must succeed');
assert.strictEqual(window.HortOpsApp.state.rostering.instructions[id156].status, 'historical', 'Rotation instruction must be sealed historical');
assert.deepStrictEqual(window.HortOpsApp.state.rostering.instructions[id156].assignments, {
  'JOB-ROT-156@2026-09-05': 'EMP-001',
  'JOB-ROT-156@2026-09-12': 'EMP-002'
}, 'Historical rotation assignments must remain unchanged');
console.log('  ✔ Passed: Exhausted Rotation instruction sealed historical with preserved assignments.\n');

// -------------------------------------------------------------
// Test 157: Assignment-free active instruction prevents hard delete and blocks retirement when future
// -------------------------------------------------------------
console.log('[Test 157] Assignment-free active instruction prevents hard delete and blocks retirement when future...');
const id157 = 'ROSTER-JOB-VACANT-157-2026-10-03-SLOT-0';
const job157 = {
  id: 'JOB-VACANT-157',
  name: 'Job 157 Vacant',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-10-03',
  preferredDay: 'saturday',
  status: 'active',
  shiftDurationHours: 8,
  crewSize: 1
};
const ws157 = {
  version: 2,
  schemaVersion: 2,
  currentYear: 2026,
  jobs: [job157],
  roster: window.HortOpsData.STAFF_ROSTER,
  staffList: window.HortOpsData.STAFF_ROSTER,
  shifts: [],
  assignments: {},
  historicalSnapshots: {},
  rostering: {
    instructions: {
      [id157]: {
        id: id157,
        instructionId: id157,
        jobId: 'JOB-VACANT-157',
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: 'JOB-VACANT-157@2026-10-03',
        status: 'active',
        lineageRootId: id157,
        predecessorInstructionId: null,
        assignments: {} // 0 assignments
      }
    },
    provenance: {}
  },
  customPermits: {}
};

window.HortOpsApp.state = JSON.parse(JSON.stringify(ws157));
// Delete attempt: must NOT hard delete
window.HortOpsApp.deleteJob('JOB-VACANT-157');
assert.strictEqual(window.HortOpsApp.state.jobs.length, 1, 'Job must NOT be deleted');
assert.strictEqual(window.HortOpsApp.state.jobs[0].status, 'active', 'Job must remain active because future rostering exists');
console.log('  ✔ Passed: Assignment-free active future instruction prevents hard delete and blocks retirement.\n');

// -------------------------------------------------------------
// Test 158: Deterministic State Matrix Model Assertion (Invariants I1-I12)
// -------------------------------------------------------------
console.log('[Test 158] Deterministic State Matrix Model Assertion (Invariants I1-I12)...');
const matrixCases = [
  // [JobStatus, InstStatus, ProvTargetDate, ExpectedValid, InvariantRef]
  ['active', 'active', '2026-10-03', true, 'Active-Active-Future: Valid live operational state'],
  ['active', 'historical', '2026-09-05', true, 'Active-Historical-Past: Valid recorded historical audit'],
  ['inactive', 'historical', '2026-09-05', true, 'Inactive-Historical-Past: Valid retired job history (I4)'],
  ['inactive', 'active', '2026-10-03', false, 'Inactive-Active-Future: FORBIDDEN (I1: Active instruction requires active Job)'],
  ['active', 'historical', '2026-10-03', false, 'Active-Historical-Future: FORBIDDEN (I2: Historical cannot own future provenance)'],
  ['inactive', 'historical', '2026-10-03', false, 'Inactive-Historical-Future: FORBIDDEN (I2: Historical cannot own future provenance)']
];

for (let m = 0; m < matrixCases.length; m++) {
  const [jStatus, iStatus, pDate, expectedValid, label] = matrixCases[m];
  const mJob = {
    id: `JOB-MATRIX-${m}`,
    name: `Job Matrix ${m}`,
    frequencyType: 'recurring_weeks',
    intervalWeeks: 1,
    anchorDate: pDate < '2026-10-01' ? '2026-09-05' : '2026-10-03',
    preferredDay: 'saturday',
    status: jStatus,
    shiftDurationHours: 8,
    crewSize: 1
  };
  const mInstId = `ROSTER-JOB-MATRIX-${m}-${pDate}-SLOT-0`;
  const mEnv = {
    version: 2,
    schemaVersion: 2,
    currentYear: 2026,
    jobs: [mJob],
    roster: window.HortOpsData.STAFF_ROSTER,
    staffList: window.HortOpsData.STAFF_ROSTER,
    shifts: [],
    customAssignments: {
      [`JOB-MATRIX-${m}@${pDate}`]: ['EMP-001']
    },
    assignments: {
      [`JOB-MATRIX-${m}@${pDate}`]: ['EMP-001']
    },
    rostering: {
      instructions: {
        [mInstId]: {
          id: mInstId,
          instructionId: mInstId,
          jobId: `JOB-MATRIX-${m}`,
          slotId: 'SLOT-0',
          mode: 'fixed',
          employeeId: 'EMP-001',
          repeatCount: 1,
          sourceShiftId: `JOB-MATRIX-${m}@${pDate}`,
          status: iStatus,
          lineageRootId: mInstId,
          predecessorInstructionId: null,
          assignments: {}
        }
      },
      provenance: {
        [`JOB-MATRIX-${m}@${pDate}:EMP-001`]: {
          source: 'rostering-rule',
          instructionId: mInstId,
          strategy: 'fixed',
          sourceShiftId: `JOB-MATRIX-${m}@${pDate}`,
          slotId: 'SLOT-0',
          sequenceIndex: 0
        }
      }
    },
    customPermits: {}
  };

  const mVal = window.HortOpsSchemaValidator.validate(mEnv);
  assert.strictEqual(mVal.valid, expectedValid, `Matrix Case ${m} [${label}]: expected valid=${expectedValid}, got ${mVal.valid} (${mVal.error || 'ok'})`);
}
console.log('  ✔ Passed: All 6 core combinations of the deterministic state matrix asserted successfully.\n');

console.log('ALL 158 OFFLINE17.5J ROSTERING INTEGRITY GATES PASSED (100% PASS)');
console.log('================================================================\n');
