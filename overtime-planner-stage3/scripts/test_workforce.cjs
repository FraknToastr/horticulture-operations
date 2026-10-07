process.env.TZ = 'Australia/Adelaide';
const assert = require('assert');

global.window = global;
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
require('../js/utils/userCsvParser.js');
require('../js/utils/reconciliationEngine.js');
require('../js/utils/scheduler.js');

console.log('=== RUNNING WORKFORCE REGRESSION SUITE ===');

// 1. CSV Parsing & Quoting Invariants (Mandate Section 1.4, 26)
const sampleCsv = `ID,Name,Email,Department,Team,Role,IsPlantOperator,Status
EMP-TEST-1,"Smith, John",john.smith@council.sa.gov.au,Parks & Gardens,Parks,Horticulturist,TRUE,active
EMP-TEST-2,"Line 1
Line 2",multiline@council.sa.gov.au,Biodiversity,Wetlands,Team Leader,FALSE,active
EMP-TEST-3,"He said ""Hello""",quote@council.sa.gov.au,Civil Infrastructure,Irrigation,Irrigation Tech,TRUE,active
EMP-TEST-4,=cmd|' /C calc'!A0,formula@council.sa.gov.au,Urban Services,Squares,Horticulturist,FALSE,active
`;

const currentRoster = JSON.parse(JSON.stringify(window.HortOpsData.STAFF_ROSTER.slice(0, 10)));
const parseResult = window.HortOpsUserCsvParser.parseUserCsv(sampleCsv, currentRoster);

assert(parseResult.success, 'CSV parsing must succeed');
assert.strictEqual(parseResult.staff.length, 4, 'Expected 4 parsed employees');

// Verify quoted comma
const john = parseResult.staff.find(s => s.id === 'EMP-TEST-1');
assert.strictEqual(john.name, 'Smith, John', 'Quoted comma must be preserved');
assert.strictEqual(john.isPlantOperator, true, 'Plant operator boolean correctly parsed');

// Verify multiline
const multiline = parseResult.staff.find(s => s.id === 'EMP-TEST-2');
assert(multiline.name.includes('\n') || multiline.name.includes('\r'), 'Multiline name preserved');

// Verify escaped quotes
const quoteStaff = parseResult.staff.find(s => s.id === 'EMP-TEST-3');
assert.strictEqual(quoteStaff.name, 'He said "Hello"', 'Escaped quotes parsed correctly');

// Verify duplicate ID rejection
const duplicateIdCsv = `ID,Name,Email,Department,Team,Role,IsPlantOperator,Status
EMP-001,Alice,alice@example.com,Horticulture,Parks,Worker,FALSE,active
EMP-001,Bob,bob@example.com,Horticulture,Parks,Worker,FALSE,active
`;
const dupResult = window.HortOpsUserCsvParser.parseUserCsv(duplicateIdCsv, currentRoster);
assert.strictEqual(dupResult.success, false, 'Duplicate ID in CSV must be rejected');
assert(dupResult.errors.some(e => e.toLowerCase().includes('duplicate employee id')), 'Error must mention duplicate ID');
console.log('[PASS] CSV quoting, multiline, escaped quotes, and duplicate ID rejection verified.');

// 2. CSV Serializer & Formula Hardening (Mandate Section 17, 26)
const rawRows = [
  ['=1+1', '+2+2', '-3-3', '@SUM(A1:A10)', 'Safe text']
];
const serialized = window.HortOpsSecurityUtils.serializeCsv(['C1', 'C2', 'C3', 'C4', 'C5'], rawRows);
assert(serialized.includes("''=1+1") || serialized.includes("'=1+1"), 'Formula injection = must be prefixed');
assert(serialized.includes("'+2+2"), 'Formula injection + must be prefixed');
assert(serialized.includes("'-3-3"), 'Formula injection - must be prefixed');
assert(serialized.includes("'@SUM"), 'Formula injection @ must be prefixed');
console.log('[PASS] CSV serializer formula-injection hardening verified.');

// 3. Workforce Departure Lifecycle Across All Assignment Sources (Mandate Section 6, 26)
const testRoster = [
  { id: 'EMP-068', name: 'Frank Edwards', team: 'Parks', status: 'active', isPlantOperator: true },
  { id: 'EMP-004', name: 'Sarah Connor', team: 'Parks', status: 'active', isPlantOperator: false },
  { id: 'EMP-005', name: 'Kyle Reese', team: 'Parks', status: 'active', isPlantOperator: true }
];

const pastExplicitDate = '2026-02-08';
const futureExplicitDate = '2026-10-10';
const futureCustomDate = '2026-11-15';

const testShifts = [
  {
    shiftId: 'job-1@' + pastExplicitDate,
    jobId: 'job-1',
    date: pastExplicitDate,
    assignedStaffIds: ['EMP-068', 'EMP-004'],
    isHistorical: true
  },
  {
    shiftId: 'job-1@' + futureExplicitDate,
    jobId: 'job-1',
    date: futureExplicitDate,
    assignedStaffIds: ['EMP-068', 'EMP-005'],
    isHistorical: true
  },
  {
    shiftId: 'job-2@' + futureCustomDate,
    jobId: 'job-2',
    date: futureCustomDate,
    assignedStaffIds: ['EMP-068', 'EMP-004'],
    isHistorical: false
  }
];

const testCustomAssignments = {
  ['job-2@' + futureCustomDate]: ['EMP-068', 'EMP-004']
};

const incomingSnapshot = [
  { id: 'EMP-004', name: 'Sarah Connor', team: 'Parks', status: 'active' },
  { id: 'EMP-005', name: 'Kyle Reese', team: 'Parks', status: 'active' }
];

const diff = window.HortOpsReconciliationEngine.computeWorkforceReconciliation(
  testRoster,
  incomingSnapshot,
  testCustomAssignments,
  testShifts
);

assert(diff.departed.some(d => d.id === 'EMP-068'), 'EMP-068 must be identified as departed');

const reconcileResult = window.HortOpsReconciliationEngine.applyWorkforceReconciliation(
  testRoster,
  diff,
  testCustomAssignments,
  testShifts
);

const reconciledAssignments = reconcileResult.reconciledAssignments;

// Check future explicit shift: EMP-068 must be REMOVED from future assignments!
const futureExplicitAssigned = reconciledAssignments['job-1@' + futureExplicitDate];
assert(futureExplicitAssigned, 'Future explicit assignment override must be recorded');
assert(!futureExplicitAssigned.includes('EMP-068'), 'Departed staff must be removed from future explicit occurrence');
assert(futureExplicitAssigned.includes('EMP-005'), 'Other active staff must remain assigned');

// Check future custom shift: EMP-068 must be REMOVED from future custom assignments!
const futureCustomAssigned = reconciledAssignments['job-2@' + futureCustomDate];
assert(!futureCustomAssigned.includes('EMP-068'), 'Departed staff must be removed from future custom assignment');
assert(futureCustomAssigned.includes('EMP-004'), 'Active staff must remain assigned');

// Check past explicit shift: past assignments must remain intact!
const pastShiftAssigned = reconciledAssignments['job-1@' + pastExplicitDate] || testShifts[0].assignedStaffIds;
assert(pastShiftAssigned.includes('EMP-068'), 'Historical past explicit assignments must remain strictly preserved');

console.log(`[PASS] Departed workforce assignment lifecycle verified: past actuals preserved, future explicit and custom assignments vacated (vacatedCount: ${reconcileResult.vacatedCount}).`);

// 4. Canonical Validator Invariants (Mandate Section 7, 26)
const validator = window.HortOpsEligibilityEngine;

// Inactive employee check
const inactStaff = { id: 'EMP-INACT', name: 'Inactive Bob', team: 'Parks', status: 'inactive' };
const inactRes = validator.validateEmployeeForOccurrence({ employee: inactStaff, occurrence: testShifts[1] });
assert.strictEqual(inactRes.eligible, false, 'Inactive employee must be ineligible');
assert.strictEqual(inactRes.hardBlock, true, 'Inactive employee must trigger hardBlock');

// On leave employee check
const leaveStaff = { id: 'EMP-LEAVE', name: 'Leave Linda', team: 'Parks', status: 'on_leave' };
const leaveRes = validator.validateEmployeeForOccurrence({ employee: leaveStaff, occurrence: testShifts[1] });
assert.strictEqual(leaveRes.eligible, false, 'On-leave employee must be ineligible');
assert.strictEqual(leaveRes.hardBlock, true, 'On-leave employee must trigger hardBlock');

// Temporarily unavailable check
const unavailStaff = { id: 'EMP-UNAVAIL', name: 'Unavail Dave', team: 'Parks', status: 'temporarily_unavailable' };
const unavailRes = validator.validateEmployeeForOccurrence({ employee: unavailStaff, occurrence: testShifts[1] });
assert.strictEqual(unavailRes.eligible, false, 'Temporarily unavailable employee must be ineligible');
assert.strictEqual(unavailRes.hardBlock, true, 'Temporarily unavailable employee must trigger hardBlock');

// Overtime Exemption window check
const exemptStaff = {
  id: 'EMP-EXEMPT',
  name: 'Exempt Eric',
  team: 'Parks',
  status: 'active',
  isOvertimeExempt: true,
  exemptionStartDate: '2026-04-01',
  exemptionEndDate: '2026-04-30'
};
const exemptRes = validator.validateEmployeeForOccurrence({
  employee: exemptStaff,
  occurrence: { date: '2026-04-15', startTime: '06:00 AM', durationHours: 6 }
});
assert.strictEqual(exemptRes.eligible, false, 'Employee within exemption window must be ineligible');
assert.strictEqual(exemptRes.hardBlock, true, 'Overtime exemption must be a hardBlock');

const nonExemptRes = validator.validateEmployeeForOccurrence({
  employee: exemptStaff,
  occurrence: { date: '2026-05-15', startTime: '06:00 AM', durationHours: 6 }
});
assert.strictEqual(nonExemptRes.eligible, true, 'Employee outside exemption window must be eligible');

// Exclusive Team hard rule
const exclusiveShift = {
  shiftId: 'excl-1',
  date: '2026-06-01',
  isExclusiveTeams: true,
  exclusiveTeams: ['Irrigation']
};
const parksStaff = { id: 'EMP-P', name: 'Parks Pete', team: 'Parks', status: 'active' };
const exclRes = validator.validateEmployeeForOccurrence({ employee: parksStaff, occurrence: exclusiveShift });
assert.strictEqual(exclRes.eligible, false, 'Parks employee must violate Irrigation-only exclusive shift');
assert.strictEqual(exclRes.hardBlock, true, 'Exclusive team violation must be a hardBlock');

// Time interval overlap detection
const shiftA = { shiftId: 'sA', date: '2026-06-01', startTime: '06:00 AM', durationHours: 4 };
const shiftB = { shiftId: 'sB', date: '2026-06-01', startTime: '09:00 AM', durationHours: 4, assignedStaffIds: ['EMP-O'] };
const shiftC = { shiftId: 'sC', date: '2026-06-01', startTime: '10:00 AM', durationHours: 4, assignedStaffIds: ['EMP-O'] };

const overlapStaff = { id: 'EMP-O', name: 'Overlap Owen', team: 'Parks', status: 'active' };
const overlapRes = validator.validateEmployeeForOccurrence({
  employee: overlapStaff,
  occurrence: shiftA,
  allAssignments: [shiftB]
});
assert.strictEqual(overlapRes.eligible, false, 'Concurrent overlapping shift must trigger conflict');
assert.strictEqual(overlapRes.hardBlock, true, 'Time overlap must trigger hardBlock');

// Stage 1 update: adjacent shifts (shiftA 06:00-10:00, shiftC 10:00-14:00) have 0 min gap.
// The original assertion only checked for overlap absence. Now that the 10-hour rest rule
// is enforced, consecutive same-day shifts with zero gap correctly trigger INSUFFICIENT_REST.
// This test is updated per Stage 1 brief § 3: "Update existing tests that incorrectly consider
// consecutive shifts eligible solely because they do not overlap."
const adjacentRes = validator.validateEmployeeForOccurrence({
  employee: overlapStaff,
  occurrence: shiftA,
  allAssignments: [shiftC]
});
assert.strictEqual(adjacentRes.eligible, false, 'Adjacent back-to-back shifts (0 min gap) must be blocked by INSUFFICIENT_REST');
assert(adjacentRes.reasons.includes('INSUFFICIENT_REST'), 'Adjacent shifts with 0 min gap must report INSUFFICIENT_REST');
assert(!adjacentRes.reasons.includes('OVERLAPPING_SHIFT'), 'Adjacent non-overlapping shifts must NOT report OVERLAPPING_SHIFT');

console.log('[PASS] Canonical eligibility validator invariants verified.');


// 5. NEW: Preserve Incoming Status for Net-New Imported Employees (Mandate Section 6, 18)
const statusesToTest = ['active', 'departed', 'inactive', 'on_leave', 'temporarily_unavailable'];
statusesToTest.forEach(st => {
  const newStaffSnapshot = [{
    id: `NEW-EMP-${st.toUpperCase()}`,
    name: `New Staff ${st}`,
    status: st,
    team: 'Parks',
    role: 'Worker'
  }];

  const newDiff = window.HortOpsReconciliationEngine.computeWorkforceReconciliation([], newStaffSnapshot);
  assert.strictEqual(newDiff.added.length, 1, `Net-new employee with status ${st} must be added`);
  assert.strictEqual(newDiff.added[0].status, st, `Net-new employee status must be preserved as "${st}", not forced to "active"`);
});
console.log('[PASS] Incoming employment status preserved across all non-active states (active, departed, inactive, on_leave, temporarily_unavailable).');

// 6. NEW: Non-Active Lifecycle Transitions Vacate Future Assignments (Mandate Section 5, 18)
const nonActiveStates = ['inactive', 'on_leave', 'temporarily_unavailable', 'departed'];
nonActiveStates.forEach(st => {
  const currentStaff = [{ id: 'STAFF-LIFECYCLE', name: 'Lifecycle Worker', status: 'active', team: 'Parks' }];
  const updatedSnapshot = [{ id: 'STAFF-LIFECYCLE', name: 'Lifecycle Worker', status: st, team: 'Parks' }];

  const shifts = [
    { shiftId: 'shift-past', date: '2026-01-10', assignedStaffIds: ['STAFF-LIFECYCLE'], isHistorical: true },
    { shiftId: 'shift-future', date: '2026-11-20', assignedStaffIds: ['STAFF-LIFECYCLE'], isHistorical: false }
  ];
  const custom = { 'shift-future': ['STAFF-LIFECYCLE'] };

  const lifecycleDiff = window.HortOpsReconciliationEngine.computeWorkforceReconciliation(currentStaff, updatedSnapshot, custom, shifts);
  const applied = window.HortOpsReconciliationEngine.applyWorkforceReconciliation(currentStaff, lifecycleDiff, custom, shifts);

  // Future assignment must be vacated
  const futureAssigned = applied.reconciledAssignments['shift-future'] || [];
  assert(!futureAssigned.includes('STAFF-LIFECYCLE'), `Transitioning to ${st} must vacate future assignments`);

  // Past assignment remains preserved
  const pastAssigned = applied.reconciledAssignments['shift-past'] || shifts[0].assignedStaffIds;
  assert(pastAssigned.includes('STAFF-LIFECYCLE'), `Transitioning to ${st} must strictly preserve past completed historical actuals`);
});
console.log('[PASS] All non-active workforce lifecycle transitions vacate future assignments while preserving past actuals.');


// 7. Fail-Closed Runtime Handling for Unknown Employment Status (Mandate Section 12, 29)
const unknownStaff = { id: 'EMP-BANANA', name: 'Banana Bob', status: 'banana', team: 'Parks' };
const unknownRes = validator.validateEmployeeForOccurrence({
  employee: unknownStaff,
  occurrence: { date: '2026-07-01', startTime: '06:00 AM', durationHours: 6 }
});
assert.strictEqual(unknownRes.eligible, false, 'Unknown status must fail closed');
assert.strictEqual(unknownRes.hardBlock, true, 'Unknown status must trigger hardBlock');
assert.strictEqual(unknownRes.code, 'UNKNOWN_EMPLOYMENT_STATUS', 'Unknown status must return UNKNOWN_EMPLOYMENT_STATUS code');
console.log('[PASS] Runtime eligibility validator fails closed for unknown employment status (banana).');

// 8. Plant Operator Lifecycle Status Invalidation for Crews (Mandate Section 7, 26)
const opLifecycleStaff = { id: 'OP-LC', name: 'Operator Ollie', isPlantOperator: true, status: 'active', team: 'Arbor' };
const helperStaff = { id: 'HELP-1', name: 'Helper Henry', isPlantOperator: false, status: 'active', team: 'Arbor' };
const testOpShift = { shiftId: 'op-shift-future', date: '2026-10-15', plantOperatorRequired: true, assignedStaffIds: ['OP-LC', 'HELP-1'] };

const statusesThatInvalidateCrew = ['departed', 'inactive', 'on_leave', 'temporarily_unavailable', 'banana'];
statusesThatInvalidateCrew.forEach(st => {
  const modOp = Object.assign({}, opLifecycleStaff, { status: st });
  const crewRes = validator.validateCrewForOccurrence({
    occurrence: testOpShift,
    job: { plantOperatorRequired: true },
    assignedStaffIds: ['OP-LC', 'HELP-1'],
    roster: [modOp, helperStaff]
  });
  assert.strictEqual(crewRes.valid, false, `Crew must become invalid when Plant Operator status becomes ${st}`);
  assert.strictEqual(crewRes.hardBlock, true, `Hard block must trigger when Plant Operator status becomes ${st}`);
  assert(crewRes.issues.some(i => i.code === 'PLANT_OPERATOR_REQUIRED'), `PLANT_OPERATOR_REQUIRED issue must be reported for status ${st}`);
});
console.log('[PASS] Plant Operator lifecycle transitions (departed, inactive, on_leave, unavailable, unknown) invalidate required crews.');

// 9. Fail-Closed CSV Workforce Status Validation (Mandate Section 4, 11)
const invalidStatuses = ['departedd', 'banana', 'actve'];
invalidStatuses.forEach(st => {
  const badCsv = `ID,Name,Email,Department,Team,Role,IsPlantOperator,Status
EMP-BAD-1,Bad Status User,bad@council.sa.gov.au,Parks,Parks,Horticulturist,FALSE,${st}
`;
  const badRes = window.HortOpsUserCsvParser.parseUserCsv(badCsv, []);
  assert.strictEqual(badRes.success, false, `CSV with status "${st}" must fail closed`);
  assert(badRes.errors.length > 0, `CSV with status "${st}" must report errors`);
  assert(badRes.errors.some(e => e.includes(st) && e.toLowerCase().includes('unsupported')), `Error must cite unsupported status "${st}"`);
});
console.log('[PASS] Fail-closed CSV rejection verified for "departedd", "banana", "actve".');

// Departed worker typo reactivation protection
const departedRoster = [
  { id: 'EMP-DEP-1', name: 'Departed Dan', status: 'departed', team: 'Parks', role: 'Horticulturist' }
];
const typoDepartedCsv = `ID,Name,Email,Department,Team,Role,IsPlantOperator,Status
EMP-DEP-1,Departed Dan,dan@council.sa.gov.au,Parks,Parks,Horticulturist,FALSE,departedd
`;
const typoRes = window.HortOpsUserCsvParser.parseUserCsv(typoDepartedCsv, departedRoster);
assert.strictEqual(typoRes.success, false, 'Typo "departedd" must NOT reactivate departed staff as active');
console.log('[PASS] Departed staff reactivation protection verified against typo status.');

// 10. Unsafe Employee ID Rejection in CSV (Mandate Section 6, 15)
const unsafeIdCsv = `ID,Name,Email,Department,Team,Role,IsPlantOperator,Status
x');alert(1);//,Unsafe User,unsafe@council.sa.gov.au,Parks,Parks,Horticulturist,FALSE,active
`;
const unsafeIdRes = window.HortOpsUserCsvParser.parseUserCsv(unsafeIdCsv, []);
assert.strictEqual(unsafeIdRes.success, false, 'Unsafe employee ID must be rejected by CSV parser');
assert(unsafeIdRes.errors.some(e => e.toLowerCase().includes('invalid characters')), 'Error must cite invalid characters in ID');
console.log('[PASS] Unsafe Employee ID rejected by CSV parser.');

// 11. Seeded Staff ID Legitimacy Verification (Mandate Section 15)
const fullRoster = window.HortOpsData.STAFF_ROSTER;
const idRegex = /^[A-Za-z0-9_-]+$/;
let invalidSeededStaffCount = 0;
fullRoster.forEach(s => {
  if (!idRegex.test(s.id)) invalidSeededStaffCount++;
});
assert.strictEqual(invalidSeededStaffCount, 0, 'All seeded staff IDs must pass canonical ID regex');
console.log(`[PASS] All ${fullRoster.length} seeded staff IDs verified valid against canonical regex.`);

// 12. P0: Shift ID Identity & Time-Overlap Regression Matrix (Mandate Section 1, 10; Constitution Art. 7)
const testEmp = { id: 'EMP-OVERLAP-TEST', name: 'Overlap Tester', status: 'active', team: 'Parks' };
const baseDate = '2026-06-01';

// Case A: target has no shiftId, other has no shiftId, times overlap, same employee => OVERLAPPING_SHIFT / ineligible
const targetNoId = { date: baseDate, startTime: '06:00 AM', durationHours: 4 }; // 06:00 - 10:00
const otherNoIdOverlap = { date: baseDate, startTime: '07:00 AM', durationHours: 4, assignedStaffIds: [testEmp.id] }; // 07:00 - 11:00
const resCaseA = validator.validateEmployeeForOccurrence({
  employee: testEmp,
  occurrence: targetNoId,
  allAssignments: [otherNoIdOverlap]
});
assert.strictEqual(resCaseA.eligible, false, 'Case A: Missing shiftId on both occurrences must NOT suppress overlap detection');
assert.strictEqual(resCaseA.hardBlock, true, 'Case A: Time overlap must trigger hardBlock');
assert(resCaseA.reasons.includes('OVERLAPPING_SHIFT'), 'Case A: Must report OVERLAPPING_SHIFT reason');

// Case B: target has no shiftId, other has no shiftId, shifts adjacent but not overlapping.
// Stage 1 update: adjacent shifts (06:00-10:00 then 10:00-14:00) have 0 minutes of rest between
// them, which violates the mandatory 10-hour minimum. Now correctly blocked by INSUFFICIENT_REST.
// Updated per Stage 1 brief § 3: "Update existing tests that incorrectly consider consecutive
// shifts eligible solely because they do not overlap."
const otherNoIdAdjacent = { date: baseDate, startTime: '10:00 AM', durationHours: 4, assignedStaffIds: [testEmp.id] }; // 10:00 - 14:00
const resCaseB = validator.validateEmployeeForOccurrence({
  employee: testEmp,
  occurrence: targetNoId,
  allAssignments: [otherNoIdAdjacent]
});
assert.strictEqual(resCaseB.eligible, false, 'Case B: Adjacent back-to-back shifts (0 min gap) must be blocked by INSUFFICIENT_REST');
assert(resCaseB.reasons.includes('INSUFFICIENT_REST'), 'Case B: 0-min gap must report INSUFFICIENT_REST');
assert(!resCaseB.reasons.includes('OVERLAPPING_SHIFT'), 'Case B: Non-overlapping shifts must NOT report OVERLAPPING_SHIFT');

// Case C: both have the same VALID shiftId => correctly treated as self and skipped
const targetValidId = { shiftId: 'shift-self-1', date: baseDate, startTime: '06:00 AM', durationHours: 4 };
const otherSameId = { shiftId: 'shift-self-1', date: baseDate, startTime: '06:00 AM', durationHours: 4, assignedStaffIds: [testEmp.id] };
const resCaseC = validator.validateEmployeeForOccurrence({
  employee: testEmp,
  occurrence: targetValidId,
  allAssignments: [otherSameId]
});
assert.strictEqual(resCaseC.eligible, true, 'Case C: Same valid shiftId must be recognized as self-shift and skipped');

// Case D: valid different shiftIds, overlapping times => blocked
const targetDiffId = { shiftId: 'shift-target-1', date: baseDate, startTime: '06:00 AM', durationHours: 4 };
const otherDiffId = { shiftId: 'shift-other-1', date: baseDate, startTime: '07:00 AM', durationHours: 4, assignedStaffIds: [testEmp.id] };
const resCaseD = validator.validateEmployeeForOccurrence({
  employee: testEmp,
  occurrence: targetDiffId,
  allAssignments: [otherDiffId]
});
assert.strictEqual(resCaseD.eligible, false, 'Case D: Different valid shiftIds with overlapping times must be blocked');
assert.strictEqual(resCaseD.hardBlock, true, 'Case D: Different shiftIds overlap must trigger hardBlock');
assert(resCaseD.reasons.includes('OVERLAPPING_SHIFT'), 'Case D: Must report OVERLAPPING_SHIFT');

// Case E: target ID missing, other ID valid, overlapping times => blocked
const resCaseE = validator.validateEmployeeForOccurrence({
  employee: testEmp,
  occurrence: targetNoId,
  allAssignments: [otherDiffId]
});
assert.strictEqual(resCaseE.eligible, false, 'Case E: Missing target ID with valid other ID must detect overlap');
assert.strictEqual(resCaseE.hardBlock, true, 'Case E: Must trigger hardBlock');
assert(resCaseE.reasons.includes('OVERLAPPING_SHIFT'), 'Case E: Must report OVERLAPPING_SHIFT');

// Case F: target ID valid, other ID missing, overlapping times => blocked
const resCaseF = validator.validateEmployeeForOccurrence({
  employee: testEmp,
  occurrence: targetValidId,
  allAssignments: [otherNoIdOverlap]
});
assert.strictEqual(resCaseF.eligible, false, 'Case F: Valid target ID with missing other ID must detect overlap');
assert.strictEqual(resCaseF.hardBlock, true, 'Case F: Must trigger hardBlock');
assert(resCaseF.reasons.includes('OVERLAPPING_SHIFT'), 'Case F: Must report OVERLAPPING_SHIFT');

console.log('[PASS] Mandatory P0 Shift ID identity & time-overlap regression matrix verified (Cases A through F).');
// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1 INTEGRITY — Cases G through M
// Cross-date overlap, 10-hour rest-gap enforcement, year boundaries,
// look-back conflicts and self-shift identity.
// ─────────────────────────────────────────────────────────────────────────────

// Case G: shift ends 23:00 day N, new shift starts 01:00 day N+1 — true cross-date overlap
const caseG_existing = {
  shiftId: 'sG-existing',
  date: '2026-10-01',
  startTime: '09:00 PM',  // 21:00
  durationHours: 4,        // ends 01:00 Oct 2
  assignedStaffIds: ['EMP-G']
};
const caseG_target = {
  shiftId: 'sG-target',
  date: '2026-10-02',
  startTime: '01:00 AM',  // 01:00 — overlaps with caseG_existing end at 01:00... actually starts exactly at 01:00 = adjacent, not overlap
  durationHours: 4
};
// 21:00 Oct 1 to 01:00 Oct 2 = ends at 01:00. New shift starts 01:00 — adjacent, NOT overlap.
// Change target to 00:30 Oct 2 for a true 30-min overlap.
const caseG_target_overlap = {
  shiftId: 'sG-target-overlap',
  date: '2026-10-02',
  startTime: '12:30 AM',  // 00:30 — overlaps by 30 min with caseG_existing which ends 01:00
  durationHours: 2
};
const resCaseG = validator.validateEmployeeForOccurrence({
  employee: { id: 'EMP-G', name: 'Georgie Cross', team: 'Parks', status: 'active' },
  occurrence: caseG_target_overlap,
  allAssignments: [caseG_existing]
});
assert.strictEqual(resCaseG.eligible, false, 'Case G: Cross-midnight overlap (shift ending next day) must trigger conflict');
assert.strictEqual(resCaseG.hardBlock, true, 'Case G: Cross-midnight overlap must be a hardBlock');
assert(resCaseG.reasons.includes('OVERLAPPING_SHIFT'), 'Case G: Must report OVERLAPPING_SHIFT');
assert(!resCaseG.reasons.includes('INSUFFICIENT_REST'), 'Case G: Overlap takes precedence; must NOT also report INSUFFICIENT_REST');

// Case H: shift crosses midnight, new shift starts with <10h rest gap on the next day
const caseH_existing = {
  shiftId: 'sH-existing',
  date: '2026-10-05',
  startTime: '10:00 PM',  // 22:00 Oct 5
  durationHours: 6,        // ends 04:00 Oct 6
  assignedStaffIds: ['EMP-H']
};
const caseH_target = {
  shiftId: 'sH-target',
  date: '2026-10-06',
  startTime: '09:00 AM',  // 09:00 Oct 6 — gap = 5 h from 04:00
  durationHours: 4
};
const resCaseH = validator.validateEmployeeForOccurrence({
  employee: { id: 'EMP-H', name: 'Harriet Rest', team: 'Parks', status: 'active' },
  occurrence: caseH_target,
  allAssignments: [caseH_existing]
});
assert.strictEqual(resCaseH.eligible, false, 'Case H: 5-hour rest after cross-midnight shift must be blocked');
assert.strictEqual(resCaseH.hardBlock, true, 'Case H: Insufficient rest must be hardBlock');
assert(resCaseH.reasons.includes('INSUFFICIENT_REST'), 'Case H: Must report INSUFFICIENT_REST');
assert(!resCaseH.reasons.includes('OVERLAPPING_SHIFT'), 'Case H: Non-overlapping shifts must NOT report OVERLAPPING_SHIFT');

// Case I: exactly 10 hours of rest — must be permitted
const caseI_existing = {
  shiftId: 'sI-existing',
  date: '2026-10-10',
  startTime: '08:00 AM',  // 08:00
  durationHours: 8,        // ends 16:00
  assignedStaffIds: ['EMP-I']
};
const caseI_target = {
  shiftId: 'sI-target',
  date: '2026-10-11',
  startTime: '02:00 AM',  // 02:00 Oct 11 — gap = exactly 10 h from 16:00 Oct 10
  durationHours: 4
};
const resCaseI = validator.validateEmployeeForOccurrence({
  employee: { id: 'EMP-I', name: 'Iggy Exact', team: 'Parks', status: 'active' },
  occurrence: caseI_target,
  allAssignments: [caseI_existing]
});
assert.strictEqual(resCaseI.eligible, true, 'Case I: Exactly 10 hours of rest must be permitted (not blocked)');
assert(!resCaseI.reasons.includes('INSUFFICIENT_REST'), 'Case I: Exactly 10 h gap must NOT report INSUFFICIENT_REST');

// Case J: 9 hours 59 minutes of rest — must be blocked
const caseJ_existing = {
  shiftId: 'sJ-existing',
  date: '2026-10-10',
  startTime: '08:00 AM',
  durationHours: 8,        // ends 16:00
  assignedStaffIds: ['EMP-J']
};
const caseJ_target = {
  shiftId: 'sJ-target',
  date: '2026-10-11',
  startTime: '01:59 AM',  // 01:59 Oct 11 — gap = 599 min (9 h 59 m) < 600
  durationHours: 4
};
const resCaseJ = validator.validateEmployeeForOccurrence({
  employee: { id: 'EMP-J', name: 'Jay Narrow', team: 'Parks', status: 'active' },
  occurrence: caseJ_target,
  allAssignments: [caseJ_existing]
});
assert.strictEqual(resCaseJ.eligible, false, 'Case J: 9h59m rest must be blocked (below 10-hour minimum)');
assert(resCaseJ.reasons.includes('INSUFFICIENT_REST'), 'Case J: Must report INSUFFICIENT_REST');

// Case K: look-back conflict — new shift is BEFORE existing, still <10h gap
const caseK_existing = {
  shiftId: 'sK-existing',
  date: '2026-10-15',
  startTime: '06:00 AM',  // 06:00 Oct 15
  durationHours: 8,        // ends 14:00 Oct 15
  assignedStaffIds: ['EMP-K']
};
const caseK_target = {
  shiftId: 'sK-target',
  date: '2026-10-14',
  startTime: '10:00 PM',  // 22:00 Oct 14 — gap = 8 h to 06:00 Oct 15
  durationHours: 6
};
const resCaseK = validator.validateEmployeeForOccurrence({
  employee: { id: 'EMP-K', name: 'Kylie Lookback', team: 'Parks', status: 'active' },
  occurrence: caseK_target,
  allAssignments: [caseK_existing]
});
assert.strictEqual(resCaseK.eligible, false, 'Case K: Look-back 8h gap (new shift before existing) must be blocked');
assert(resCaseK.reasons.includes('INSUFFICIENT_REST'), 'Case K: Must report INSUFFICIENT_REST for look-back conflict');

// Case L: year boundary — shift Dec 31 22:00 for 6h ends Jan 1 04:00; new shift Jan 1 09:00 (5h gap)
const caseL_existing = {
  shiftId: 'sL-existing',
  date: '2025-12-31',
  startTime: '10:00 PM',  // 22:00 Dec 31
  durationHours: 6,        // ends 04:00 Jan 1 2026
  assignedStaffIds: ['EMP-L']
};
const caseL_target = {
  shiftId: 'sL-target',
  date: '2026-01-01',
  startTime: '09:00 AM',  // 09:00 Jan 1 — gap = 5 h from 04:00 Jan 1
  durationHours: 4
};
const resCaseL = validator.validateEmployeeForOccurrence({
  employee: { id: 'EMP-L', name: 'Lena Yearwrap', team: 'Parks', status: 'active' },
  occurrence: caseL_target,
  allAssignments: [caseL_existing]
});
assert.strictEqual(resCaseL.eligible, false, 'Case L: Calendar-year boundary rest gap (5h) must be blocked');
assert(resCaseL.reasons.includes('INSUFFICIENT_REST'), 'Case L: Must report INSUFFICIENT_REST across year boundary');

// Case M: self-shift identity preserved — same shiftId must not trigger OVERLAPPING_SHIFT or INSUFFICIENT_REST
const caseM_shift = {
  shiftId: 'sM-self',
  date: '2026-10-20',
  startTime: '07:00 AM',
  durationHours: 8,
  assignedStaffIds: ['EMP-M']
};
const resCaseM = validator.validateEmployeeForOccurrence({
  employee: { id: 'EMP-M', name: 'Max Self', team: 'Parks', status: 'active' },
  occurrence: caseM_shift,
  allAssignments: [caseM_shift]  // same shift object in allAssignments
});
assert.strictEqual(resCaseM.eligible, true, 'Case M: Self-shift identity must not trigger conflict');
assert(!resCaseM.reasons.includes('OVERLAPPING_SHIFT'), 'Case M: Self-shift must not report OVERLAPPING_SHIFT');
assert(!resCaseM.reasons.includes('INSUFFICIENT_REST'), 'Case M: Self-shift must not report INSUFFICIENT_REST');

// Case N: Daylight-Saving (DST) transition — 10 wall-clock hours represents 9 elapsed hours
// Across Spring Forward (e.g. 2026-10-03 22:00 to 2026-10-04 08:00 in Australia/Adelaide),
// wall-clock difference is 10 hours (22:00 to 08:00), but elapsed time is 9 hours (540 min).
// Under physical elapsed-time enforcement, this must be blocked as INSUFFICIENT_REST.
const caseN_existing = {
  shiftId: 'sN-existing',
  date: '2026-10-03',
  startTime: '04:00 PM',
  durationHours: 6,        // ends 22:00 Oct 3
  assignedStaffIds: ['EMP-N']
};
const caseN_target = {
  shiftId: 'sN-target',
  date: '2026-10-04',
  startTime: '08:00 AM',  // 08:00 Oct 4 — clock gap = 10 h, but elapsed gap = 9 h in Adelaide/DST
  durationHours: 4
};
// Test elapsed interval calculation directly
const intervalN1 = validator.shiftToAbsoluteInterval(caseN_existing);
const intervalN2 = validator.shiftToAbsoluteInterval(caseN_target);
assert(intervalN1 && intervalN2, 'Case N: Intervals must be successfully calculated');

const dN1 = new Date(2026, 9, 3, 22, 0).getTime();
const dN2 = new Date(2026, 9, 4, 8, 0).getTime();
const actualElapsedMin = Math.round((dN2 - dN1) / 60000);
assert.strictEqual(actualElapsedMin, 540, 'Case N: Under Australia/Adelaide, 22:00 Oct 3 to 08:00 Oct 4 must be exactly 540 elapsed minutes');

const resCaseN = validator.validateEmployeeForOccurrence({
  employee: { id: 'EMP-N', name: 'Ned DST', team: 'Parks', status: 'active' },
  occurrence: caseN_target,
  allAssignments: [caseN_existing]
});
assert.strictEqual(resCaseN.eligible, false, 'Case N: 9 elapsed hours across DST spring-forward must trigger INSUFFICIENT_REST');
assert(resCaseN.reasons.includes('INSUFFICIENT_REST'), 'Case N: Must report INSUFFICIENT_REST');

// Case O: Daylight-Saving transition with 10 actual elapsed hours — must be permitted
// Same employee (EMP-N), same prior shift (ends 22:00 Oct 3), but target shift starts at 09:00 Oct 4 (600 min)
const caseO_target = {
  shiftId: 'sO-target',
  date: '2026-10-04',
  startTime: '09:00 AM',  // 09:00 Oct 4 — 10 elapsed hours (600 min) across DST
  durationHours: 4
};
const dO2 = new Date(2026, 9, 4, 9, 0).getTime();
const actualElapsedMinO = Math.round((dO2 - dN1) / 60000);
assert.strictEqual(actualElapsedMinO, 600, 'Case O: Under Australia/Adelaide, 22:00 Oct 3 to 09:00 Oct 4 must be exactly 600 elapsed minutes');

const resCaseO = validator.validateEmployeeForOccurrence({
  employee: { id: 'EMP-N', name: 'Ned DST', team: 'Parks', status: 'active' },
  occurrence: caseO_target,
  allAssignments: [caseN_existing]
});
assert.strictEqual(resCaseO.eligible, true, 'Case O: 10 elapsed hours across DST must be permitted for same employee');
assert(!resCaseO.reasons.includes('INSUFFICIENT_REST'), 'Case O: Must NOT report INSUFFICIENT_REST');

// Case P: Year-boundary cross-year conflict in actual assignment workflow
// Shift A: 2025-12-31 22:00, 6 hours duration (ends 2026-01-01 04:00)
// Shift B: 2026-01-01 05:00, 4 hours duration (gap = 1 hour)
const caseP_2025_shift = {
  shiftId: 'job_p_2025@2025-12-31',
  date: '2025-12-31',
  startTime: '10:00 PM',
  durationHours: 6,
  assignedStaffIds: ['EMP-P']
};
const caseP_2026_shift = {
  shiftId: 'job_p_2026@2026-01-01',
  date: '2026-01-01',
  startTime: '05:00 AM',
  durationHours: 4
};
const resCaseP = validator.validateEmployeeForOccurrence({
  employee: { id: 'EMP-P', name: 'Paul YearBoundary', team: 'Parks', status: 'active' },
  occurrence: caseP_2026_shift,
  allAssignments: [caseP_2025_shift]
});
assert.strictEqual(resCaseP.eligible, false, 'Case P: Cross-year shift with 1 hour rest gap must be blocked');
assert.strictEqual(resCaseP.hardBlock, true, 'Case P: Cross-year insufficient rest must be hardBlock');
assert(resCaseP.reasons.includes('INSUFFICIENT_REST'), 'Case P: Must report INSUFFICIENT_REST across year boundary');

console.log('[PASS] Stage 1 cross-date overlap, 10-hour rest-gap & DST/cross-year matrix verified (Cases G through P).');



// 13. P0: Canonical Workforce Employment Status Fail-Closed Invariants (Mandate Section 3, 10; Constitution Art. 11)
const statusTestMatrix = [
  { label: 'missing status (undefined)', status: undefined, expectEligible: false, expectReason: 'UNKNOWN_EMPLOYMENT_STATUS' },
  { label: 'null status', status: null, expectEligible: false, expectReason: 'UNKNOWN_EMPLOYMENT_STATUS' },
  { label: 'empty string status ("")', status: '', expectEligible: false, expectReason: 'UNKNOWN_EMPLOYMENT_STATUS' },
  { label: 'whitespace status ("   ")', status: '   ', expectEligible: false, expectReason: 'UNKNOWN_EMPLOYMENT_STATUS' },
  { label: 'unsupported status ("banana")', status: 'banana', expectEligible: false, expectReason: 'UNKNOWN_EMPLOYMENT_STATUS' },
  { label: 'typo status ("actve")', status: 'actve', expectEligible: false, expectReason: 'UNKNOWN_EMPLOYMENT_STATUS' },
  { label: 'case-normalised ACTIVE ("ACTIVE")', status: 'ACTIVE', expectEligible: true, expectReason: null },
  { label: 'canonical active ("active")', status: 'active', expectEligible: true, expectReason: null }
];

const sampleOcc = { shiftId: 'status-test-shift', date: '2026-06-01', startTime: '06:00 AM', durationHours: 4 };

statusTestMatrix.forEach(item => {
  const staffRecord = {
    id: 'EMP-STATUS-TEST',
    name: 'Status Test User',
    team: 'Parks'
  };
  if (item.status !== undefined) {
    staffRecord.status = item.status;
  }

  const res = validator.validateEmployeeForOccurrence({
    employee: staffRecord,
    occurrence: sampleOcc
  });

  if (item.expectEligible) {
    assert.strictEqual(res.eligible, true, `Staff with ${item.label} must be eligible`);
    assert.strictEqual(res.hardBlock, false, `Staff with ${item.label} must not trigger hardBlock`);
  } else {
    assert.strictEqual(res.eligible, false, `Staff with ${item.label} must fail closed and be ineligible`);
    assert.strictEqual(res.hardBlock, true, `Staff with ${item.label} must trigger hardBlock`);
    assert(res.reasons.includes(item.expectReason), `Staff with ${item.label} must include reason ${item.expectReason}`);
    assert.strictEqual(res.code, item.expectReason, `Staff with ${item.label} must have primary code ${item.expectReason}`);
  }
});
console.log('[PASS] Canonical workforce employment status fail-closed invariants verified across 8 matrix states.');

// Candidate Ordering Equivalence Regression (Mandate Offline15.1a)
const { execSync } = require('child_process');
const orderingScript = require('path').join(__dirname, 'test_candidate_ordering.cjs');
execSync(`node "${orderingScript}"`, { stdio: 'inherit' });
console.log('[PASS] Candidate Ordering Equivalence Suite verified (100% byte-for-byte identical).\n');

console.log('ALL WORKFORCE REGRESSION TESTS PASSED (100%)\n');
