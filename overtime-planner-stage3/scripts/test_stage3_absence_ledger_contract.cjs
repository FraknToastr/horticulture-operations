/**
 * Stage 3 Gate 3E Acceptance Contract:
 * Multi-Period Planned & Unplanned Absence Ledger, RDOs, Training & Fair-Share Refusal Tracking
 *
 * Verifies:
 * 1. Absence record structure, types, and Gregorian date boundary validation
 * 2. Multi-period interval queries (isStaffAbsentOnDate) across start, end, and middle dates
 * 3. Operational shift conflict detection for assigned personnel
 * 4. Fair-share priority score calculation incorporating refusal weight and fatigue penalty
 * 5. Canonical eligibility engine integration (STAFF_ABSENT hard block)
 * 6. Additive Schema v2 envelope validation with absences & refusalHistory
 * 7. Fail-closed rejection of corrupt absence records and transient UI property purity (_qualEval / _fatigueEval)
 */

const assert = require('assert');

// 1. Load Absence Ledger Engine
global.window = global;
require('../js/utils/absences.js');
const absences = window.HortOpsAbsences;
assert(absences, 'HortOpsAbsences must be exported to window');

// 2. Load Eligibility Engine
require('../js/utils/qualifications.js');
require('../js/utils/fatigueEngine.js');
require('../js/utils/eligibilityEngine.js');
const eligibility = window.HortOpsEligibilityEngine;
assert(eligibility, 'HortOpsEligibilityEngine must be exported');

// 3. Load Schema Validator
require('../js/utils/storage/schemaValidator.js');
const validator = window.HortOpsSchemaValidator;
assert(validator, 'HortOpsSchemaValidator must be exported');

console.log('=== STAGE 3 GATE 3E VERIFICATION CONTRACT ===\n');

// -------------------------------------------------------------
// Test Group 1: Absence Record Validation
// -------------------------------------------------------------
console.log('--- Test Group 1: Absence Record Validation ---');
const validLeave = {
  id: 'abs-001',
  staffId: 'staff-1',
  type: 'annual_leave',
  startDate: '2026-06-01',
  endDate: '2026-06-14',
  notes: 'Approved family holiday'
};
assert.strictEqual(absences.validateAbsenceRecord(validLeave).valid, true, 'Valid annual leave must pass');

const validRdo = {
  id: 'abs-002',
  staffId: 'staff-2',
  type: 'rdo',
  startDate: '2026-06-05',
  endDate: '2026-06-05'
};
assert.strictEqual(absences.validateAbsenceRecord(validRdo).valid, true, 'Single-day RDO must pass');

// Negative: Missing id
assert.strictEqual(absences.validateAbsenceRecord({ ...validLeave, id: '' }).valid, false, 'Missing id must fail');
// Negative: Missing staffId
assert.strictEqual(absences.validateAbsenceRecord({ ...validLeave, staffId: '' }).valid, false, 'Missing staffId must fail');
// Negative: Unsupported type
assert.strictEqual(absences.validateAbsenceRecord({ ...validLeave, type: 'golf_day' }).valid, false, 'Invalid type must fail');
// Negative: Inverted dates
assert.strictEqual(absences.validateAbsenceRecord({ ...validLeave, startDate: '2026-06-15', endDate: '2026-06-10' }).valid, false, 'Inverted dates must fail');
// Negative: Invalid Gregorian date
assert.strictEqual(absences.validateAbsenceRecord({ ...validLeave, startDate: '2026-02-30' }).valid, false, 'Invalid date must fail');

console.log('✔ Absence record validator strictly enforces required fields, allowed types, and Gregorian boundaries');

// -------------------------------------------------------------
// Test Group 2: Multi-Period Interval Queries
// -------------------------------------------------------------
console.log('\n--- Test Group 2: Multi-Period Interval Queries ---');
const ledger = [
  validLeave, // staff-1 absent 2026-06-01 to 2026-06-14
  validRdo    // staff-2 absent 2026-06-05
];

assert.strictEqual(absences.isStaffAbsentOnDate('staff-1', '2026-05-31', ledger).absent, false, 'Before start date must be false');
assert.strictEqual(absences.isStaffAbsentOnDate('staff-1', '2026-06-01', ledger).absent, true, 'Start date must be true');
assert.strictEqual(absences.isStaffAbsentOnDate('staff-1', '2026-06-07', ledger).absent, true, 'Mid date must be true');
assert.strictEqual(absences.isStaffAbsentOnDate('staff-1', '2026-06-14', ledger).absent, true, 'End date must be true');
assert.strictEqual(absences.isStaffAbsentOnDate('staff-1', '2026-06-15', ledger).absent, false, 'After end date must be false');
assert.strictEqual(absences.isStaffAbsentOnDate('staff-2', '2026-06-05', ledger).absent, true, 'RDO date must be true');
assert.strictEqual(absences.isStaffAbsentOnDate('staff-2', '2026-06-06', ledger).absent, false, 'Non-RDO date must be false');
console.log('✔ Multi-period absence queries accurately evaluate calendar intervals');

// -------------------------------------------------------------
// Test Group 3: Shift Conflict Detection
// -------------------------------------------------------------
console.log('\n--- Test Group 3: Shift Conflict Detection ---');
const mockShifts = [
  { shiftId: 'sh-safe', date: '2026-05-20', assignedStaffIds: ['staff-1'] },
  { shiftId: 'sh-conflict-1', date: '2026-06-06', assignedStaffIds: ['staff-1', 'staff-safe'] },
  { shiftId: 'sh-conflict-2', date: '2026-06-05', assignedStaffIds: ['staff-2'] }
];

const conflicts = absences.findShiftConflicts(ledger, mockShifts);
assert.strictEqual(conflicts.length, 2, 'Must detect exactly 2 roster conflicts');
assert.strictEqual(conflicts[0].shiftId, 'sh-conflict-1');
assert.strictEqual(conflicts[0].staffId, 'staff-1');
assert.strictEqual(conflicts[1].shiftId, 'sh-conflict-2');
assert.strictEqual(conflicts[1].staffId, 'staff-2');
console.log('✔ Shift conflict detection accurately flags scheduled assignments overlapping absences');

// -------------------------------------------------------------
// Test Group 4: Fair-Share Priority Scoring & Refusal History
// -------------------------------------------------------------
console.log('\n--- Test Group 4: Fair-Share Priority & Refusal Tracking ---');
const workerA = { id: 'w-a', name: 'Worker A', ytdOvertimeHours: 20 };
const workerB = { id: 'w-b', name: 'Worker B', ytdOvertimeHours: 40 };

const refusalHistory = [
  { id: 'ref-1', staffId: 'w-b', shiftId: 'sh-past', date: '2026-05-01' },
  { id: 'ref-2', staffId: 'w-b', shiftId: 'sh-past2', date: '2026-05-08' }
];

const refCountA = absences.getStaffRefusalCount('w-a', refusalHistory, '2026-06-01');
const refCountB = absences.getStaffRefusalCount('w-b', refusalHistory, '2026-06-01');
assert.strictEqual(refCountA, 0);
assert.strictEqual(refCountB, 2);
assert.strictEqual(absences.getStaffRefusalCount('w-b', refusalHistory, undefined), 0, 'Missing asOfDate must fail closed to 0');

const scoreA = absences.calculateFairShareScore(workerA, { refusalCount: refCountA, fatiguePenalty: 0 });
const scoreB = absences.calculateFairShareScore(workerB, { refusalCount: refCountB, fatiguePenalty: 0 });
// worker A: 1000 - 40 = 960
// worker B: 1000 - 80 + 10 = 930
assert.strictEqual(scoreA, 960);
assert.strictEqual(scoreB, 930);
console.log('✔ Fair-share priority score correctly balances YTD overtime and logged refusal history');

// -------------------------------------------------------------
// Test Group 5: Canonical Eligibility Engine Absence Integration
// -------------------------------------------------------------
console.log('\n--- Test Group 5: Canonical Eligibility Absence Integration ---');
const staffOnLeave = { id: 'staff-1', name: 'Alex OnLeave', status: 'active' };
const targetShift = { shiftId: 'sh-target', date: '2026-06-06', assignedStaffIds: [] };

const evalRes = eligibility.validateStaffEligibility(staffOnLeave, targetShift, null, [], [], { absences: ledger });
assert.strictEqual(evalRes.eligible, false, 'Staff on leave must be ineligible on shift date');
assert.strictEqual(evalRes.hardBlock, true, 'Staff on leave must trigger hard block');
assert(evalRes.reasons.includes('STAFF_ABSENT'), 'Must include STAFF_ABSENT reason');
console.log('✔ Canonical eligibility engine hard-blocks candidates on scheduled leave');

// -------------------------------------------------------------
// Test Group 6: Schema v2 Additive Persistence & Corrupt Rejection
// -------------------------------------------------------------
console.log('\n--- Test Group 6: Schema v2 Additive Persistence ---');
const validV2WithAbsences = {
  schemaVersion: 2,
  lastSaved: new Date().toISOString(),
  jobs: [{
    id: 'j1',
    name: 'Mowing',
    status: 'active',
    category: 'General',
    frequencyType: 'recurring_weeks',
    intervalWeeks: 2,
    anchorDate: '2026-01-03',
    applicableDays: ['saturday'],
    crewSize: 1,
    durationHours: 4,
    startTime: '07:00'
  }],
  roster: [{ id: 'staff-1', name: 'Alex Vance', status: 'active', department: 'Horticulture', team: 'Parks', role: 'Worker' }],
  assignments: {},
  rostering: { instructions: {}, provenance: {} },
  historicalSnapshots: {},
  absences: [validLeave, validRdo],
  refusalHistory: refusalHistory
};

const validResult = validator.validateWorkspaceSchema(validV2WithAbsences);
assert.strictEqual(validResult.valid, true, 'Valid Schema v2 with absences must pass: ' + validResult.error);

// Corrupt absence record
const corruptV2 = {
  ...validV2WithAbsences,
  absences: [{ id: 'bad-abs', staffId: 'staff-1', type: 'invalid_type', startDate: '2026-01-01', endDate: '2026-01-02' }]
};
const corruptResult = validator.validateWorkspaceSchema(corruptV2);
assert.strictEqual(corruptResult.valid, false, 'Corrupt absence record must fail schema validation');
console.log('✔ Schema v2 additive absence validation accepts clean ledger and rejects corrupt records');

// -------------------------------------------------------------
// Test Group 7: Persisted Schema Purity Assertion (R55-P1-06)
// -------------------------------------------------------------
console.log('\n--- Test Group 7: Persisted Schema Purity (R55-P1-06) ---');
const staffWithTransient = {
  ...validV2WithAbsences,
  roster: [{
    id: 'staff-1',
    name: 'Alex Vance',
    status: 'active',
    department: 'Horticulture',
    team: 'Parks',
    role: 'Worker',
    _qualEval: { compliant: true },
    _fatigueEval: { tier: 'LOW' }
  }]
};
const transientResult = validator.validateWorkspaceSchema(staffWithTransient);
assert.strictEqual(transientResult.valid, false, 'Staff with transient properties must fail validation');
assert(transientResult.error.includes('transient UI property'), 'Error must specify transient UI property violation');
console.log('✔ Schema validator strictly rejects persisted envelopes containing transient UI properties');

console.log('\n======================================================');
console.log(' [PASS] GATE 3E CONTRACT VERIFICATION COMPLETE: 100% OK');
console.log('======================================================\n');
