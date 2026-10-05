const assert = require('assert');

global.window = global;
require('../js/data/holidays.js');
require('../js/data/initialJobs.js');
require('../js/data/staffRoster.js');
require('../js/utils/dateUtils.js');
require('../js/utils/securityUtils.js');
require('../js/utils/eligibilityEngine.js');

console.log('=== RUNNING FR-03 TIMEZONE & DST-AWARE 10-HOUR REST SUITE ===');
console.log('Current process.env.TZ:', process.env.TZ || '(host default)');

const engine = window.HortOpsEligibilityEngine;
assert(engine, 'HortOpsEligibilityEngine must be loaded');
assert(typeof engine.adelaideLocalToUtcMs === 'function', 'adelaideLocalToUtcMs must be defined');
assert(typeof engine.getAdelaideOffsetMinutes === 'function', 'getAdelaideOffsetMinutes must be defined');

// 1. Direct Timezone Conversion Checks across 2026 DST transitions
// Autumn transition 2026: Sunday 5 April 2026 (clocks fall back at 03:00 to 02:00)
// Before transition (4 April 2026 22:00): Daylight Saving Time (UTC+10:30, offset 630 min)
const apr4_ms = engine.adelaideLocalToUtcMs('2026-04-04', '10:00 PM');
const apr4_off = engine.getAdelaideOffsetMinutes(apr4_ms);
assert.strictEqual(apr4_off, 630, '4 April 2026 22:00 must have ACDT offset 630 min (UTC+10:30)');

// After transition (5 April 2026 08:00): Standard Time (UTC+9:30, offset 570 min)
const apr5_ms = engine.adelaideLocalToUtcMs('2026-04-05', '08:00 AM');
const apr5_off = engine.getAdelaideOffsetMinutes(apr5_ms);
assert.strictEqual(apr5_off, 570, '5 April 2026 08:00 must have ACST offset 570 min (UTC+9:30)');

// Physical elapsed hours between Apr 4 22:00 and Apr 5 08:00
const aprElapsedHours = (apr5_ms - apr4_ms) / (3600 * 1000);
assert.strictEqual(aprElapsedHours, 11, 'April transition must yield 11 physical hours for 10 nominal clock hours');
console.log('[PASS] Test 1: Autumn DST transition physical elapsed time verified (11 hours).');

// Spring transition 2026: Sunday 4 October 2026 (clocks jump forward at 02:00 to 03:00)
// Before transition (3 October 2026 22:00): Standard Time (UTC+9:30, offset 570 min)
const oct3_ms = engine.adelaideLocalToUtcMs('2026-10-03', '10:00 PM');
const oct3_off = engine.getAdelaideOffsetMinutes(oct3_ms);
assert.strictEqual(oct3_off, 570, '3 October 2026 22:00 must have ACST offset 570 min (UTC+9:30)');

// After transition (4 October 2026 08:00): Daylight Saving Time (UTC+10:30, offset 630 min)
const oct4_ms = engine.adelaideLocalToUtcMs('2026-10-04', '08:00 AM');
const oct4_off = engine.getAdelaideOffsetMinutes(oct4_ms);
assert.strictEqual(oct4_off, 630, '4 October 2026 08:00 must have ACDT offset 630 min (UTC+10:30)');

// Physical elapsed hours between Oct 3 22:00 and Oct 4 08:00
const octElapsedHours = (oct4_ms - oct3_ms) / (3600 * 1000);
assert.strictEqual(octElapsedHours, 9, 'October transition must yield 9 physical hours for 10 nominal clock hours');
console.log('[PASS] Test 2: Spring DST transition physical elapsed time verified (9 hours).');

// 2. Eligibility Engine End-to-End Shift Rest Evaluation
const testEmployee = {
  id: 'EMP-DST-TEST',
  name: 'DST Test Operative',
  status: 'active',
  role: 'Worker',
  team: 'Parks'
};

// Case A: Spring DST Gap Violation
// Shift 1 ends at 22:00 (10:00 PM) on Saturday 3 Oct 2026
// Shift 2 starts at 08:00 AM on Sunday 4 Oct 2026
// Nominal clock difference = 10.0 hours.
// BUT physical elapsed rest = 9.0 hours (540 minutes).
// Must FAIL with INSUFFICIENT_REST.
const springShift1 = {
  shiftId: 'job-1@2026-10-03',
  jobId: 'job-1',
  date: '2026-10-03',
  startTime: '04:00 PM',
  durationHours: 6, // ends at 22:00
  assignedStaffIds: ['EMP-DST-TEST']
};
const springShift2 = {
  shiftId: 'job-2@2026-10-04',
  jobId: 'job-2',
  date: '2026-10-04',
  startTime: '08:00 AM',
  durationHours: 4,
  assignedStaffIds: []
};

const springEval = engine.validateEmployeeForOccurrence({
  employee: testEmployee,
  occurrence: springShift2,
  job: { id: 'job-2', name: 'Sunday Job', status: 'active' },
  allAssignments: [springShift1],
  currentShiftAssignedIds: []
});

assert.strictEqual(springEval.valid, false, 'Spring shift with nominal 10h but physical 9h rest must be invalid');
assert.strictEqual(springEval.hardBlock, true, 'Insufficient rest must be a hard block');
assert(springEval.reasons.includes('INSUFFICIENT_REST'), 'Reason must include INSUFFICIENT_REST');
console.log('[PASS] Test 3: Spring DST changeover correctly detects 9h physical rest violation despite nominal 10h clock gap.');

// Case B: Autumn DST Gap Sufficiency
// Shift 1 ends at 22:00 (10:00 PM) on Saturday 4 April 2026
// Shift 2 starts at 07:30 AM on Sunday 5 April 2026
// Nominal clock difference = 9.5 hours (570 min).
// BUT physical elapsed rest = 10.5 hours (630 minutes >= 600 min).
// Must PASS (Eligible, NO INSUFFICIENT_REST).
const autumnShift1 = {
  shiftId: 'job-1@2026-04-04',
  jobId: 'job-1',
  date: '2026-04-04',
  startTime: '04:00 PM',
  durationHours: 6, // ends at 22:00
  assignedStaffIds: ['EMP-DST-TEST']
};
const autumnShift2 = {
  shiftId: 'job-2@2026-04-05',
  jobId: 'job-2',
  date: '2026-04-05',
  startTime: '07:30 AM', // nominal 9.5h gap
  durationHours: 4,
  assignedStaffIds: []
};

const autumnEval = engine.validateEmployeeForOccurrence({
  employee: testEmployee,
  occurrence: autumnShift2,
  job: { id: 'job-2', name: 'Sunday Job', status: 'active' },
  allAssignments: [autumnShift1],
  currentShiftAssignedIds: []
});

assert.strictEqual(autumnEval.valid, true, 'Autumn shift with nominal 9.5h but physical 10.5h rest must be valid');
assert.strictEqual(autumnEval.reasons.includes('INSUFFICIENT_REST'), false, 'Must not report INSUFFICIENT_REST');
console.log('[PASS] Test 4: Autumn DST changeover correctly permits physical 10.5h rest despite nominal 9.5h clock gap.');

// Case C: Standard Non-Transition Days
// Shift 1 ends at 22:00 on Saturday 2026-05-16
// Shift 2 starts at 07:00 AM on Sunday 2026-05-17 (nominal 9.0h = physical 9.0h) -> INSUFFICIENT_REST
const stdShift1 = {
  shiftId: 'job-1@2026-05-16',
  jobId: 'job-1',
  date: '2026-05-16',
  startTime: '04:00 PM',
  durationHours: 6, // ends at 22:00
  assignedStaffIds: ['EMP-DST-TEST']
};
const stdShift2 = {
  shiftId: 'job-2@2026-05-17',
  jobId: 'job-2',
  date: '2026-05-17',
  startTime: '07:00 AM', // 9h gap
  durationHours: 4,
  assignedStaffIds: []
};

const stdEval = engine.validateEmployeeForOccurrence({
  employee: testEmployee,
  occurrence: stdShift2,
  job: { id: 'job-2', name: 'Sunday Job', status: 'active' },
  allAssignments: [stdShift1],
  currentShiftAssignedIds: []
});
assert.strictEqual(stdEval.valid, false, 'Standard 9h gap must fail');
assert(stdEval.reasons.includes('INSUFFICIENT_REST'), 'Reason must include INSUFFICIENT_REST');
console.log('[PASS] Test 5: Standard non-transition 9h rest gap correctly fails.');

console.log('\n================================================================');
console.log(' ALL FR-03 TIMEZONE & DST REST VALIDATION TESTS PASSED (100%)');
console.log('================================================================\n');
