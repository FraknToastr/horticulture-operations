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
require('../js/utils/scheduler/costCalculator.js');
require('../js/utils/scheduler/engine.js');
require('../js/utils/scheduler.js');

console.log('=== RUNNING SCHEDULER REGRESSION SUITE ===');

const jobs = JSON.parse(JSON.stringify(window.HortOpsData.INITIAL_JOBS));
const digest2026 = window.HortOpsScheduler.generateOperationalDigest(jobs, 2026);

// 1. Contractual Schedule Invariants: Zero duplicates, identity canonicality, row-to-ID parity (Constitution Art. 4, 7, 29)
const totalRows = digest2026.allShifts.length;
const shiftIds = digest2026.allShifts.map(s => s.shiftId);
const uniqueIds = new Set(shiftIds).size;
const dupes = totalRows - uniqueIds;

console.log(`[DIAGNOSTIC] 2026 seeded schedule rows:       ${totalRows} (seeded output under current Whitmore interpretation)`);
console.log(`[DIAGNOSTIC] 2026 unique shift IDs:          ${uniqueIds}`);
console.log(`[DIAGNOSTIC] 2026 duplicate shift IDs:       ${dupes}`);

// Contractual invariants:
assert.strictEqual(dupes, 0, 'Schedule digest must have strictly zero duplicate shift IDs');
assert.strictEqual(totalRows, uniqueIds, 'Total schedule occurrences must equal unique shift IDs');
assert(totalRows > 0, 'Operational schedule must generate occurrences');

// Canonical shift identity contract: every operational occurrence has valid canonical format jobId@YYYY-MM-DD
digest2026.allShifts.forEach(s => {
  assert(s.shiftId && typeof s.shiftId === 'string' && s.shiftId.length > 0, 'Every shift must have a non-empty string shiftId');
  assert(s.date && /^\d{4}-\d{2}-\d{2}$/.test(s.date), `Shift ${s.shiftId} must have valid YYYY-MM-DD date format`);
  assert(s.jobId && typeof s.jobId === 'string', `Shift ${s.shiftId} must reference a jobId`);
  assert.strictEqual(s.shiftId, `${s.jobId}@${s.date}`, `Shift identity must follow canonical format jobId@YYYY-MM-DD (got ${s.shiftId})`);
});
console.log('[PASS] Contractual schedule invariants verified: 0 duplicates, row-to-ID parity, canonical shift IDs.');

// 2. Cost Calculation Contract & Seeded Diagnostic Cost (Constitution Art. 4, 29)
let totalCost = 0;
digest2026.allShifts.forEach(s => {
  totalCost += window.HortOpsScheduler.calculateShiftCost(s).totalCost;
});
console.log(`[DIAGNOSTIC] 2026 calculated projected cost: $${totalCost.toFixed(2)} (seeded result, not permanent business canon)`);

// Contractual verification: cost must be finite positive, and costing engine obeys Enterprise Agreement multipliers
assert(Number.isFinite(totalCost) && totalCost > 0, 'Projected schedule cost must be a positive finite number');

// Deterministic cost calculation test on a controlled Saturday shift fixture
const costFixtureShift = {
  date: '2026-06-06', // Saturday
  dayOfWeek: 'Saturday',
  startTime: '06:00 AM',
  durationHours: 6,
  crewSize: 2
};
// Saturday EA rule ($44.50/h base, 1.5x first 2h, 2.0x next 4h, meal allowance $24.80 for >=5h shifts):
// Per staff: labor = 2 * (44.50 * 1.5) + 4 * (44.50 * 2.0) = 133.50 + 356.00 = $489.50; meal = $24.80.
// Crew of 2: labor = 2 * 489.50 = $979.00; meal = 2 * 24.80 = $49.60; total = $1,028.60.
const fixtureCost = window.HortOpsScheduler.calculateShiftCost(costFixtureShift);
assert.strictEqual(fixtureCost.laborCost, 979.00, 'Fixture labor cost must be $979.00 (2h@1.5x + 4h@2.0x for crew of 2)');
assert.strictEqual(fixtureCost.mealCost, 49.60, 'Fixture meal cost must be $49.60 (2 * $24.80)');
assert.strictEqual(fixtureCost.totalCost, 1028.60, 'Fixture shift Saturday costing must equal exactly $1,028.60 under EA rules');
console.log('[PASS] Cost calculation contract verified on deterministic EA penalty fixture ($1,028.60).');

// 3. Inactive job produces 0 occurrences (Mandate Section 1, 11)
const inactiveJobs = JSON.parse(JSON.stringify(jobs));
inactiveJobs.forEach(j => j.status = 'inactive');
const inactiveDigest = window.HortOpsScheduler.generateOperationalDigest(inactiveJobs, 2026, false);
const generatedInactive = inactiveDigest.allShifts.filter(s => !s.isHistorical);
assert.strictEqual(generatedInactive.length, 0, 'Inactive jobs must produce 0 generated occurrences');
console.log('[PASS] Inactive jobs produce 0 generated occurrences.');

// 4. Recurrence across year boundary & 2028 Week 53 (Mandate Section 1)
const slots2028 = window.HortOpsScheduler.generateWeekendSlots(2028);
const w53 = slots2028.find(s => s.weekNumber === 53);
assert(w53, '2028 must support 53 Saturday weeks');
assert.strictEqual(w53.saturdayDate, '2028-12-30', 'Week 53 Saturday in 2028 must be 2028-12-30');
console.log('[PASS] 2028 Week 53 correctly maps to 2028-12-30.');

// 5. Friday & Monday Overtime scheduling (Mandate Section 1)
const friJob = {
  id: 'test-fri-job',
  name: 'Friday Corridor Sweep',
  category: 'CBD Corridor',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 2,
  anchorDate: '2026-01-09',
  preferredDay: 'friday',
  startTime: '06:00 AM',
  durationHours: 6,
  crewSize: 2,
  status: 'active'
};
const monJob = {
  id: 'test-mon-job',
  name: 'Monday Post-Holiday Clean',
  category: 'Parklands',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 2,
  anchorDate: '2026-01-12',
  preferredDay: 'monday',
  startTime: '06:00 AM',
  durationHours: 6,
  crewSize: 2,
  status: 'active'
};
const customJobs = [friJob, monJob];
const friMonDigest = window.HortOpsScheduler.generateOperationalDigest(customJobs, 2026);
const friShifts = friMonDigest.allShifts.filter(s => s.jobId === 'test-fri-job');
const monShifts = friMonDigest.allShifts.filter(s => s.jobId === 'test-mon-job');
assert(friShifts.length > 0, 'Friday recurring job must generate shifts');
assert(friShifts.every(s => s.dayOfWeek === 'Friday'), 'Friday job shifts must have dayOfWeek === Friday');
assert(monShifts.length > 0, 'Monday recurring job must generate shifts');
assert(monShifts.every(s => s.dayOfWeek === 'Monday'), 'Monday job shifts must have dayOfWeek === Monday');
console.log('[PASS] Friday and Monday overtime recurrence verified.');

// 6. Explicit occurrence suppresses generated duplicate (Mandate Section 1)
const explicitShift = digest2026.allShifts.find(s => s.shiftId === 'bundys-road@2026-02-08');
assert(explicitShift, 'Explicit shift bundys-road@2026-02-08 must exist');
assert.strictEqual(explicitShift.isHistorical, true, 'Explicit shift must be flagged isHistorical');
const duplicateExplicit = digest2026.allShifts.filter(s => s.shiftId === 'bundys-road@2026-02-08');
assert.strictEqual(duplicateExplicit.length, 1, 'Explicit occurrence must suppress generated duplicate');
console.log('[PASS] Explicit occurrence suppresses generated duplicate.');

// 7. Permit override on explicit occurrence (Mandate Section 1)
const customPermits = {
  'bundys-road@2026-02-08': {
    wztmStatus: 'in_progress',
    wztmNotes: 'Override Permit #999',
    tpoStatus: 'finalized',
    tpoNotes: 'TPO Approved Override'
  }
};
const permitOverrideDigest = window.HortOpsScheduler.generateOperationalDigest(
  jobs, 2026, true, {}, window.HortOpsData.STAFF_ROSTER, customPermits
);
const overriddenShift = permitOverrideDigest.allShifts.find(s => s.shiftId === 'bundys-road@2026-02-08');
assert(overriddenShift, 'Shift must exist');
assert.strictEqual(overriddenShift.wztmStatus, 'in_progress', 'Explicit occurrence must adopt custom permit status');
assert.strictEqual(overriddenShift.wztmNotes, 'Override Permit #999', 'Explicit occurrence must adopt custom permit notes');
assert.strictEqual(overriddenShift.tpoStatus, 'finalized', 'Explicit occurrence must adopt custom TPO status');
console.log('[PASS] Permit overrides on explicit occurrences resolved correctly.');

// 8. Assignment override on explicit occurrence (Mandate Section 1)
const customAssignments = {
  'bundys-road@2026-02-08': ['EMP-001', 'EMP-002']
};
const assignOverrideDigest = window.HortOpsScheduler.generateOperationalDigest(
  jobs, 2026, true, customAssignments, window.HortOpsData.STAFF_ROSTER, {}
);
const overriddenAssignShift = assignOverrideDigest.allShifts.find(s => s.shiftId === 'bundys-road@2026-02-08');
assert(overriddenAssignShift, 'Shift must exist');
assert.deepStrictEqual(overriddenAssignShift.assignedStaffIds, ['EMP-001', 'EMP-002'], 'Explicit occurrence must adopt custom assignment overrides');
console.log('[PASS] Assignment overrides on explicit occurrences resolved correctly.');

// 9. NEW: One-Off Year Isolation (Mandate Section 2, 17)
const oneOff2027Dates = [
  { day: 'Friday', date: '2027-07-09' },
  { day: 'Saturday', date: '2027-07-10' },
  { day: 'Sunday', date: '2027-07-11' },
  { day: 'Monday', date: '2027-07-12' }
];

oneOff2027Dates.forEach(({ day, date }) => {
  const oneOffJob = [{
    id: `oneoff-${day.toLowerCase()}-2027`,
    name: `Special ${day} One-Off 2027`,
    category: 'Arterial Road',
    frequencyType: 'one_off',
    targetDate: date,
    startTime: '07:00 AM',
    durationHours: 6,
    crewSize: 2,
    status: 'active'
  }];

  const d2026 = window.HortOpsScheduler.generateOperationalDigest(oneOffJob, 2026);
  const d2027 = window.HortOpsScheduler.generateOperationalDigest(oneOffJob, 2027);
  const d2028 = window.HortOpsScheduler.generateOperationalDigest(oneOffJob, 2028);

  const shifts2026 = d2026.allShifts.filter(s => s.jobId === oneOffJob[0].id);
  const shifts2027 = d2027.allShifts.filter(s => s.jobId === oneOffJob[0].id);
  const shifts2028 = d2028.allShifts.filter(s => s.jobId === oneOffJob[0].id);

  assert.strictEqual(shifts2026.length, 0, `One-off job for 2027 must generate 0 shifts in 2026 (${day})`);
  assert.strictEqual(shifts2027.length, 1, `One-off job for 2027 must generate exactly 1 shift in 2027 (${day})`);
  assert.strictEqual(shifts2028.length, 0, `One-off job for 2027 must generate 0 shifts in 2028 (${day})`);
  assert.strictEqual(shifts2027[0].date, date, `Generated shift date must match target date (${date})`);
});
console.log('[PASS] One-off year isolation verified: 2027 events generate 0 shifts in 2026/2028 across Fri/Sat/Sun/Mon.');

// 10. NEW: Recurring Anchor Weekday Mismatch (Mandate Section 3, 17)
const mismatchJob = [{
  id: 'mismatch-job',
  name: 'Mismatched Anchor Job',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 4,
  anchorDate: '2026-02-14', // Saturday
  preferredDay: 'sunday',   // Sunday
  startTime: '06:00 AM',
  durationHours: 6,
  crewSize: 2,
  status: 'active'
}];
const mismatchDigest = window.HortOpsScheduler.generateOperationalDigest(mismatchJob, 2026);
const mismatchShifts = mismatchDigest.allShifts.filter(s => s.jobId === 'mismatch-job');
assert.strictEqual(mismatchShifts.length, 0, 'Recurring job with anchor Saturday and preferred Sunday must not generate shifts');

const matchingJob = [{
  id: 'matching-job',
  name: 'Matching Anchor Job',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 4,
  anchorDate: '2026-02-15', // Sunday
  preferredDay: 'sunday',   // Sunday
  startTime: '06:00 AM',
  durationHours: 6,
  crewSize: 2,
  status: 'active'
}];
const matchingDigest = window.HortOpsScheduler.generateOperationalDigest(matchingJob, 2026);
const matchingShifts = matchingDigest.allShifts.filter(s => s.jobId === 'matching-job');
assert(matchingShifts.length > 0, 'Matching anchor and preferred day must generate shifts');
console.log('[PASS] Recurring anchor weekday mismatch enforcement verified.');

// 11. NEW: Canonical Eligibility Revalidation for Existing Assignments (Mandate Section 4, 17)
const mockRoster = [
  { id: 'STAFF-1', name: 'Alice Normal', status: 'active', team: 'Parks', role: 'Worker' },
  { id: 'STAFF-2', name: 'Bob OnLeave', status: 'on_leave', team: 'Parks', role: 'Worker' },
  { id: 'STAFF-3', name: 'Carol Unavailable', status: 'temporarily_unavailable', team: 'Parks', role: 'Worker' },
  { id: 'STAFF-4', name: 'Dave Inactive', status: 'inactive', team: 'Parks', role: 'Worker' },
  { id: 'STAFF-5', name: 'Eve Departed', status: 'departed', team: 'Parks', role: 'Worker' }
];
const testJob = {
  id: 'test-job',
  name: 'Test Job',
  frequencyType: 'one_off',
  targetDate: '2026-05-16',
  startTime: '07:00 AM',
  durationHours: 6,
  crewSize: 2,
  status: 'active'
};

const revalDigest = window.HortOpsScheduler.generateOperationalDigest(
  [testJob], 2026, true,
  { 'test-job@2026-05-16': ['STAFF-1', 'STAFF-2', 'STAFF-3', 'STAFF-4', 'STAFF-5'] },
  mockRoster
);
const evaluatedShift = revalDigest.allShifts.find(s => s.shiftId === 'test-job@2026-05-16');
assert(evaluatedShift, 'Evaluated shift must exist');
assert(evaluatedShift.invalidAssignees, 'Shift must have invalidAssignees list');

const invalidIds = evaluatedShift.invalidAssignees.map(a => a.staffId);
assert(!invalidIds.includes('STAFF-1'), 'Active staff member must not be flagged');
assert(invalidIds.includes('STAFF-2'), 'Staff with status on_leave must be flagged as invalid');
assert(invalidIds.includes('STAFF-3'), 'Staff with status temporarily_unavailable must be flagged as invalid');
assert(invalidIds.includes('STAFF-4'), 'Staff with status inactive must be flagged as invalid');
assert(invalidIds.includes('STAFF-5'), 'Staff with status departed must be flagged as invalid');
console.log('[PASS] Canonical eligibility revalidation flags on_leave, temporarily_unavailable, inactive, and departed assignees.');

// 12. NEW: Retired Job Future Explicit Occurrences Suppression (Mandate Section 11, 17)
const retiredJobs = JSON.parse(JSON.stringify(jobs));
const westTerrace = retiredJobs.find(j => j.id === 'west-terrace-median');
assert(westTerrace, 'west-terrace-median job must exist');
westTerrace.status = 'inactive';
westTerrace.active = false;

const localTodayKey = window.HortOpsDateUtils.getLocalDateKey();
const testPastDate = '2026-01-10'; // A past Saturday in 2026
const testFutureDate = '2026-12-19'; // A future Saturday in 2026
const testCustomAssignments = {
  [`west-terrace-median@${testPastDate}`]: ['STAFF-1'],
  [`west-terrace-median@${testFutureDate}`]: ['STAFF-1']
};
const testHistoricalSnapshots = {
  [`west-terrace-median@${testPastDate}`]: {
    shiftId: `west-terrace-median@${testPastDate}`,
    jobId: 'west-terrace-median',
    date: testPastDate,
    startTime: '06:00 AM',
    durationHours: 4,
    crewSize: 2
  }
};

const retiredDigest = window.HortOpsScheduler.generateOperationalDigest(retiredJobs, 2026, true, testCustomAssignments, null, null, testHistoricalSnapshots);
const westTerraceShifts = retiredDigest.allShifts.filter(s => s.jobId === 'west-terrace-median');
const futureWestTerrace = westTerraceShifts.filter(s => s.date >= localTodayKey);
assert.strictEqual(futureWestTerrace.length, 0, 'Retired job must have 0 future explicit occurrences');
const pastWestTerrace = westTerraceShifts.filter(s => s.date < localTodayKey);
assert(pastWestTerrace.length > 0, 'Retired job must strictly preserve past completed historical actuals');
assert.strictEqual(pastWestTerrace[0].startTime, '06:00 AM', 'Historical snapshot startTime must be preserved');
assert.strictEqual(pastWestTerrace[0].durationHours, 4, 'Historical snapshot durationHours must be preserved');
console.log('[PASS] Retired job cancels future explicit occurrences while preserving past actuals.');


// 13. Canonical Crew-Level Plant Operator Validation (Mandate Section 3, 4, 5, 26)
const opStaff = { id: 'OP-1', name: 'Oscar Operator', isPlantOperator: true, status: 'active', team: 'Arbor' };
const regularStaff = { id: 'REG-1', name: 'Rachel Regular', isPlantOperator: false, status: 'active', team: 'Arbor' };
const mockRosterWithOp = [opStaff, regularStaff];

const opReqJob = { id: 'op-job', name: 'Heavy Clearing', plantOperatorRequired: true, status: 'active' };
const noOpJob = { id: 'noop-job', name: 'Hand Weeding', plantOperatorRequired: false, status: 'active' };
const futureOccurrence = { shiftId: 'op-job@2026-10-10', jobId: 'op-job', date: '2026-10-10', plantOperatorRequired: true, assignedStaffIds: ['REG-1'] };

// A. Crew missing required operator -> PLANT_OPERATOR_REQUIRED
const crewResMissing = window.HortOpsEligibilityEngine.validateCrewForOccurrence({
  occurrence: futureOccurrence,
  job: opReqJob,
  assignedStaffIds: ['REG-1'],
  roster: mockRosterWithOp
});
assert.strictEqual(crewResMissing.valid, false, 'Crew missing plant operator must be invalid');
assert.strictEqual(crewResMissing.hardBlock, true, 'Crew missing plant operator must be hard blocked');
assert(crewResMissing.issues.some(i => i.code === 'PLANT_OPERATOR_REQUIRED'), 'Must report PLANT_OPERATOR_REQUIRED issue');

// B. Crew with eligible operator -> valid
const crewResValid = window.HortOpsEligibilityEngine.validateCrewForOccurrence({
  occurrence: futureOccurrence,
  job: opReqJob,
  assignedStaffIds: ['REG-1', 'OP-1'],
  roster: mockRosterWithOp
});
assert.strictEqual(crewResValid.valid, true, 'Crew with eligible plant operator must be valid');
assert.strictEqual(crewResValid.issues.length, 0, 'Valid crew must have 0 issues');

// C. Non-required shift without operator -> valid
const crewResNonReq = window.HortOpsEligibilityEngine.validateCrewForOccurrence({
  occurrence: { shiftId: 'noop-job@2026-10-10', jobId: 'noop-job', date: '2026-10-10', plantOperatorRequired: false },
  job: noOpJob,
  assignedStaffIds: ['REG-1'],
  roster: mockRosterWithOp
});
assert.strictEqual(crewResNonReq.valid, true, 'Non-required shift without plant operator must be valid');
console.log('[PASS] Canonical crew-level Plant Operator validation verified (valid, missing, non-required).');

// 14. Explicit Occurrence Lifecycle Resolver (Mandate Section 16, 17, 18, 30)
const pastDate = '2026-03-01';
const futureDate = '2026-11-01';
const todayDate = '2026-09-05';

// Past explicit + missing job -> include (preserve historical attribution)
const resPastMissing = window.HortOpsScheduler.resolveExplicitOccurrenceLifecycle({
  explicitOccurrence: { date: pastDate, jobId: 'missing-job' },
  parentJob: null,
  todayStr: todayDate
});
assert.strictEqual(resPastMissing.include, true, 'Past explicit occurrence with missing job must be included for history');

// Future explicit + missing job -> suppress from operational schedule
const resFutureMissing = window.HortOpsScheduler.resolveExplicitOccurrenceLifecycle({
  explicitOccurrence: { date: futureDate, jobId: 'missing-job' },
  parentJob: null,
  todayStr: todayDate
});
assert.strictEqual(resFutureMissing.include, false, 'Future explicit occurrence with missing job must be suppressed');
assert.strictEqual(resFutureMissing.integrityIssue.code, 'MISSING_PARENT_JOB', 'Must record MISSING_PARENT_JOB integrity issue');

// Future explicit + inactive job -> suppress
const resFutureInactive = window.HortOpsScheduler.resolveExplicitOccurrenceLifecycle({
  explicitOccurrence: { date: futureDate, jobId: 'inactive-job' },
  parentJob: { id: 'inactive-job', status: 'inactive' },
  todayStr: todayDate
});
assert.strictEqual(resFutureInactive.include, false, 'Future explicit occurrence with inactive job must be suppressed');

// Future explicit + active job -> include
const resFutureActive = window.HortOpsScheduler.resolveExplicitOccurrenceLifecycle({
  explicitOccurrence: { date: futureDate, jobId: 'active-job' },
  parentJob: { id: 'active-job', status: 'active' },
  todayStr: todayDate
});
assert.strictEqual(resFutureActive.include, true, 'Future explicit occurrence with active job must be included');
console.log('[PASS] Explicit occurrence lifecycle resolver verified (past orphan, future orphan, future inactive, future active).');

// 15. Annual Job Unsupported Preferred Day Validation (Mandate Section 13, 14, 28)
const annualTuesdayJob = [{
  id: 'annual-tues',
  name: 'Annual Tuesday Job',
  frequencyType: 'annual',
  targetMonth: 6,
  preferredDay: 'tuesday',
  status: 'active'
}];
const annualTuesDigest = window.HortOpsScheduler.generateOperationalDigest(annualTuesdayJob, 2026);
assert.strictEqual(annualTuesDigest.allShifts.filter(s => s.jobId === 'annual-tues').length, 0, 'Annual job with preferredDay Tuesday must generate 0 shifts');

const annualFridayJob = [{
  id: 'annual-fri',
  name: 'Annual Friday Job',
  frequencyType: 'annual',
  targetMonth: 6,
  preferredDay: 'friday',
  status: 'active'
}];
const annualFriDigest = window.HortOpsScheduler.generateOperationalDigest(annualFridayJob, 2026);
const annualFriShifts = annualFriDigest.allShifts.filter(s => s.jobId === 'annual-fri');
assert.strictEqual(annualFriShifts.length, 1, 'Annual job with preferredDay Friday must generate 1 shift');
assert.strictEqual(annualFriShifts[0].dayOfWeek, 'Friday', 'Generated shift must fall on Friday');
console.log('[PASS] Annual job preferredDay validation verified: Tuesday skipped, Friday scheduled.');

// 16. Seeded Schedule Plant Operator Diagnostic Audit (Mandate Section 9, 27, 33)
const auditDigest = digest2026.allShifts;
let auditReqTotal = 0, auditValid = 0, auditInvalid = 0;
let futureReqTotal = 0, futureValid = 0, futureInvalid = 0;
const auditToday = '2026-09-05';

auditDigest.forEach(shift => {
  if (!shift.plantOperatorRequired) return;
  auditReqTotal++;
  const isFut = shift.date >= auditToday;
  if (isFut) futureReqTotal++;

  const assigned = shift.assignedStaffIds || [];
  let hasEligibleOp = false;
  assigned.forEach(id => {
    const s = window.HortOpsData.STAFF_ROSTER.find(r => r.id === id);
    if (!s || !s.isPlantOperator) return;
    const v = window.HortOpsEligibilityEngine.validateEmployeeForOccurrence({ employee: s, occurrence: shift });
    if (v.eligible) hasEligibleOp = true;
  });

  if (hasEligibleOp) {
    auditValid++;
    if (isFut) futureValid++;
  } else {
    auditInvalid++;
    if (isFut) futureInvalid++;
  }
});

console.log('--- SEEDED 2026 PLANT OPERATOR AUDIT REPORT ---');
console.log(`2026 Plant-Operator-required shifts: ${auditReqTotal}`);
console.log(`Valid crews: ${auditValid}`);
console.log(`Invalid crews: ${auditInvalid}`);
console.log(`Future Plant-Operator-required shifts: ${futureReqTotal}`);
console.log(`Future valid crews: ${futureValid}`);
console.log(`Future invalid crews: ${futureInvalid}`);
console.log('------------------------------------------------');

// Relational and contractual Plant Operator invariants (Mandate Section 8; Constitution Art. 15, 29)
assert.strictEqual(auditReqTotal, auditValid + auditInvalid, 'Total required Plant Operator shifts must equal valid + invalid');
assert.strictEqual(futureReqTotal, futureValid + futureInvalid, 'Future required Plant Operator shifts must equal future valid + future invalid');
assert(futureReqTotal <= auditReqTotal, 'Future required shifts cannot exceed total required shifts');
assert(futureValid <= auditValid, 'Future valid shifts cannot exceed total valid shifts');
assert(futureInvalid <= auditInvalid, 'Future invalid shifts cannot exceed total invalid shifts');

// Contractual validation: every crew classified valid satisfies canonical crew validator, and invalid genuinely lacks eligible operator
auditDigest.forEach(shift => {
  if (!shift.plantOperatorRequired) return;
  const crewRes = window.HortOpsEligibilityEngine.validateCrewForOccurrence({
    occurrence: shift,
    assignedStaffIds: shift.assignedStaffIds || [],
    roster: window.HortOpsData.STAFF_ROSTER
  });
  const assigned = shift.assignedStaffIds || [];
  let hasEligibleOp = false;
  assigned.forEach(id => {
    const s = window.HortOpsData.STAFF_ROSTER.find(r => r.id === id);
    if (!s || !s.isPlantOperator) return;
    const v = window.HortOpsEligibilityEngine.validateEmployeeForOccurrence({ employee: s, occurrence: shift });
    if (v.eligible) hasEligibleOp = true;
  });
  if (hasEligibleOp) {
    assert.strictEqual(crewRes.valid, true, `Crew on ${shift.shiftId} with eligible operator must pass canonical crew validator`);
  } else {
    assert.strictEqual(crewRes.valid, false, `Crew on ${shift.shiftId} lacking eligible operator must fail canonical crew validator`);
    assert(crewRes.issues.some(i => i.code === 'PLANT_OPERATOR_REQUIRED'), `Crew on ${shift.shiftId} must report PLANT_OPERATOR_REQUIRED`);
  }
});
console.log('[PASS] Seeded 2026 Plant Operator relational invariants & crew contracts verified.');

// 17. Active Recurring Seeded Jobs Schedulability Consistency (Mandate Section 20)
const activeRecurringJobs = jobs.filter(j => j.status === 'active' && j.frequencyType === 'recurring_weeks' && (j.expectedAnnualShifts || 0) > 0);
activeRecurringJobs.forEach(j => {
  const generatedCount = digest2026.allShifts.filter(s => s.jobId === j.id).length;
  assert(generatedCount > 0, `Active recurring job "${j.id}" with expectedAnnualShifts=${j.expectedAnnualShifts} must generate > 0 shifts in 2026 (got ${generatedCount}).`);
});
console.log(`[PASS] All ${activeRecurringJobs.length} active recurring seeded jobs generate non-zero occurrences matching schedule intent.`);

// 12. Job Status Schedulability Engine Fail-Closed (Mandate Section 12)
const testStatuses = ['active', 'inactive', 'draft', 'archived', 'resolved', 'banana'];
const baseJob = {
  id: 'test-sched-job',
  name: 'Test Sched Job',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-01-03',
  intervalWeeks: 2,
  preferredDay: 'saturday',
  startTime: '06:00 AM',
  durationHours: 6,
  requiredStaffCount: 2,
  category: 'Grounds'
};

const statusCounts = {};
testStatuses.forEach(st => {
  const jobCopy = Object.assign({}, baseJob, { status: st });
  const d = window.HortOpsScheduler.generateOperationalDigest([jobCopy], 2026, false);
  const genShifts = (d.allShifts || []).filter(s => !s.isHistorical);
  statusCounts[st] = genShifts.length;
});

console.log('--- JOB STATUS SCHEDULABILITY AUDIT ---');
console.log(`active occurrences:   ${statusCounts['active']}`);
console.log(`inactive occurrences: ${statusCounts['inactive']}`);
console.log(`draft occurrences:    ${statusCounts['draft']}`);
console.log(`archived occurrences: ${statusCounts['archived']}`);
console.log(`resolved occurrences: ${statusCounts['resolved']}`);
console.log(`banana occurrences:   ${statusCounts['banana']}`);
console.log('---------------------------------------');

assert(statusCounts['active'] > 0, 'Active job must generate future occurrences');
assert.strictEqual(statusCounts['inactive'], 0, 'Inactive job must generate 0 occurrences');
assert.strictEqual(statusCounts['draft'], 0, 'Draft job must generate 0 occurrences');
assert.strictEqual(statusCounts['archived'], 0, 'Archived job must generate 0 occurrences');
assert.strictEqual(statusCounts['resolved'], 0, 'Resolved job must generate 0 occurrences');
assert.strictEqual(statusCounts['banana'], 0, 'Arbitrary unhandled status must fail closed with 0 occurrences');
console.log('[PASS] Job status schedulability positive allow-list verified.');

// 13. Suppressed Explicit Occurrence Integrity Issue Reporting (Mandate Section 16)
const testParentJob = {
  id: 'parent-job-active',
  name: 'Parent Job Active',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-01-03',
  intervalWeeks: 2,
  preferredDay: 'saturday',
  status: 'active'
};
const testParentInactive = {
  id: 'parent-job-inactive',
  name: 'Parent Job Inactive',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-01-03',
  intervalWeeks: 2,
  preferredDay: 'saturday',
  status: 'inactive'
};

// Save original historical occurrences
const origOccurrences = window.HortOpsData.HISTORICAL_OCCURRENCES;
try {
  window.HortOpsData.HISTORICAL_OCCURRENCES = [
    // Past explicit with missing parent: must be preserved in allShifts
    {
      shiftId: 'explicit-past-missing-parent',
      jobId: 'non-existent-parent-past',
      date: '2026-01-10',
      startTime: '06:00 AM',
      durationHours: 6,
      assignedStaffIds: ['EMP-001']
    },
    // Future explicit with missing parent: must be suppressed from allShifts, reported in integrityIssues
    {
      shiftId: 'explicit-future-missing-parent',
      jobId: 'non-existent-parent-future',
      date: '2026-10-10',
      startTime: '06:00 AM',
      durationHours: 6,
      assignedStaffIds: ['EMP-001']
    },
    // Future explicit with inactive parent: must be suppressed from allShifts
    {
      shiftId: 'explicit-future-inactive-parent',
      jobId: 'parent-job-inactive',
      date: '2026-10-17',
      startTime: '06:00 AM',
      durationHours: 6,
      assignedStaffIds: ['EMP-001']
    }
  ];

  // Create parents for each lifecycle status (Mandate Section 36)
  const testParentDraft = { id: 'parent-job-draft', name: 'Parent Job Draft', frequencyType: 'recurring_weeks', anchorDate: '2026-01-03', intervalWeeks: 2, preferredDay: 'saturday', status: 'draft' };
  const testParentArchived = { id: 'parent-job-archived', name: 'Parent Job Archived', frequencyType: 'recurring_weeks', anchorDate: '2026-01-03', intervalWeeks: 2, preferredDay: 'saturday', status: 'archived' };
  const testParentResolved = { id: 'parent-job-resolved', name: 'Parent Job Resolved', frequencyType: 'recurring_weeks', anchorDate: '2026-01-03', intervalWeeks: 2, preferredDay: 'saturday', status: 'resolved' };

  window.HortOpsData.HISTORICAL_OCCURRENCES.push(
    { shiftId: 'explicit-future-active-parent', jobId: 'parent-job-active', date: '2026-10-24', startTime: '06:00 AM', durationHours: 6, assignedStaffIds: ['EMP-001'] },
    { shiftId: 'explicit-future-draft-parent', jobId: 'parent-job-draft', date: '2026-10-24', startTime: '06:00 AM', durationHours: 6, assignedStaffIds: ['EMP-001'] },
    { shiftId: 'explicit-future-archived-parent', jobId: 'parent-job-archived', date: '2026-10-24', startTime: '06:00 AM', durationHours: 6, assignedStaffIds: ['EMP-001'] },
    { shiftId: 'explicit-future-resolved-parent', jobId: 'parent-job-resolved', date: '2026-10-24', startTime: '06:00 AM', durationHours: 6, assignedStaffIds: ['EMP-001'] }
  );

  const allTestParents = [testParentJob, testParentInactive, testParentDraft, testParentArchived, testParentResolved];
  const testSnapMap = {};
  window.HortOpsData.HISTORICAL_OCCURRENCES.forEach(o => { testSnapMap[o.shiftId] = o; });
  window.HortOpsApp = window.HortOpsApp || { state: {} };
  window.HortOpsApp.state = window.HortOpsApp.state || {};
  window.HortOpsApp.state.historicalSnapshots = testSnapMap;
  const explicitDigest = window.HortOpsScheduler.generateOperationalDigest(allTestParents, 2026, true, null, null, null, testSnapMap);
  
  // 1. Future explicit + active parent: included
  const hasFutActive = explicitDigest.allShifts.some(s => s.shiftId === 'explicit-future-active-parent');
  assert.strictEqual(hasFutActive, true, 'Future explicit occurrence with active parent must be included in allShifts');

  // 2. Future explicit + non-active parent (inactive, draft, archived, resolved): suppressed
  const hasFutInactive = explicitDigest.allShifts.some(s => s.shiftId === 'explicit-future-inactive-parent');
  assert.strictEqual(hasFutInactive, false, 'Future explicit occurrence with inactive parent must be suppressed');
  const hasFutDraft = explicitDigest.allShifts.some(s => s.shiftId === 'explicit-future-draft-parent');
  assert.strictEqual(hasFutDraft, false, 'Future explicit occurrence with draft parent must be suppressed');
  const hasFutArchived = explicitDigest.allShifts.some(s => s.shiftId === 'explicit-future-archived-parent');
  assert.strictEqual(hasFutArchived, false, 'Future explicit occurrence with archived parent must be suppressed');
  const hasFutResolved = explicitDigest.allShifts.some(s => s.shiftId === 'explicit-future-resolved-parent');
  assert.strictEqual(hasFutResolved, false, 'Future explicit occurrence with resolved parent must be suppressed');

  // 3. Future explicit with missing parent: suppressed and reported in integrityIssues
  const hasFutMissing = explicitDigest.allShifts.some(s => s.shiftId === 'explicit-future-missing-parent');
  assert.strictEqual(hasFutMissing, false, 'Future explicit occurrence with missing parent must be suppressed from allShifts');

  // 4. Past explicit occurrence: preserved
  const hasPastMissing = explicitDigest.allShifts.some(s => s.shiftId === 'explicit-past-missing-parent');
  assert.strictEqual(hasPastMissing, true, 'Past explicit occurrence with missing parent must be preserved in allShifts');

  // 5. Verify integrityIssues contains MISSING_PARENT_JOB
  assert(Array.isArray(explicitDigest.integrityIssues), 'Digest must contain integrityIssues array');
  const missingParentIssue = explicitDigest.integrityIssues.find(i => i.code === 'MISSING_PARENT_JOB' && i.shiftId === 'explicit-future-missing-parent');
  assert(missingParentIssue, 'integrityIssues must retain MISSING_PARENT_JOB issue for suppressed future explicit occurrence');
  assert.strictEqual(missingParentIssue.severity, 'error', 'Missing parent job issue must have error severity');
  console.log(`[PASS] Universal active-only explicit occurrence schedulability verified across all parent statuses.`);

} finally {
  window.HortOpsData.HISTORICAL_OCCURRENCES = origOccurrences;
  if (window.HortOpsApp && window.HortOpsApp.state) window.HortOpsApp.state.historicalSnapshots = {};
}

// Section 15: Required Scheduler Defence-in-Depth Test (Mandate Pass 9)
const defenceInDepthJobs = [
  { id: 'job-missing-status', name: 'Job Missing Status', frequencyType: 'recurring_weeks', intervalWeeks: 2, anchorDate: '2026-01-03', startTime: '06:00 AM', durationHours: 6, crewSize: 1 },
  { id: 'job-null-status', name: 'Job Null Status', status: null, frequencyType: 'recurring_weeks', intervalWeeks: 2, anchorDate: '2026-01-03', startTime: '06:00 AM', durationHours: 6, crewSize: 1 },
  { id: 'job-empty-status', name: 'Job Empty Status', status: '', frequencyType: 'recurring_weeks', intervalWeeks: 2, anchorDate: '2026-01-03', startTime: '06:00 AM', durationHours: 6, crewSize: 1 },
  { id: 'job-whitespace-status', name: 'Job Whitespace Status', status: '   ', frequencyType: 'recurring_weeks', intervalWeeks: 2, anchorDate: '2026-01-03', startTime: '06:00 AM', durationHours: 6, crewSize: 1 },
  { id: 'job-banana-status', name: 'Job Banana Status', status: 'banana', frequencyType: 'recurring_weeks', intervalWeeks: 2, anchorDate: '2026-01-03', startTime: '06:00 AM', durationHours: 6, crewSize: 1 }
];

const origHistForDefence = window.HortOpsData.HISTORICAL_OCCURRENCES;
try {
  window.HortOpsData.HISTORICAL_OCCURRENCES = [];
  const defenceDigest = window.HortOpsScheduler.generateOperationalDigest(defenceInDepthJobs, 2026);
  assert.strictEqual(defenceDigest.allShifts.length, 0, 'Jobs with missing, null, empty, whitespace, or unknown status must generate 0 occurrences');
} finally {
  window.HortOpsData.HISTORICAL_OCCURRENCES = origHistForDefence;
}

const defenceDigestWithHist = window.HortOpsScheduler.generateOperationalDigest(defenceInDepthJobs, 2026);
const generatedForDefenceJobs = defenceDigestWithHist.allShifts.filter(s => defenceInDepthJobs.some(j => j.id === s.jobId));
assert.strictEqual(generatedForDefenceJobs.length, 0, 'Zero occurrences must be generated for non-active/missing status jobs');
console.log('[PASS] Scheduler defence-in-depth test: missing, null, empty, whitespace, and unknown status jobs generate 0 occurrences.');

console.log('ALL SCHEDULER REGRESSION TESTS PASSED (100%)\n');
