const assert = require('assert');

global.window = global;
require('../js/data/holidays.js');
require('../js/data/initialJobs.js');
require('../js/data/staffRoster.js');
require('../js/utils/dateUtils.js');
require('../js/utils/securityUtils.js');
require('../js/utils/storage/schemaValidator.js');

console.log('=== RUNNING FR-02 SCHEDULE PRECISION & RECURRENCE INTERVAL VALIDATION SUITE ===');

const validator = window.HortOpsSchemaValidator;
const dateUtils = window.HortOpsDateUtils;

assert(validator, 'HortOpsSchemaValidator must be available');
assert(dateUtils, 'HortOpsDateUtils must be available');
assert(typeof dateUtils.isRealYmd === 'function', 'dateUtils.isRealYmd must be a function');
assert(typeof dateUtils.isValidGregorianDate === 'function', 'dateUtils.isValidGregorianDate must be a function');

// 1. Direct dateUtils Gregorian Validation
assert.strictEqual(dateUtils.isRealYmd('2026-02-30'), false, 'Feb 30 is non-existent Gregorian date');
assert.strictEqual(dateUtils.isRealYmd('2026-04-31'), false, 'April 31 is non-existent Gregorian date');
assert.strictEqual(dateUtils.isRealYmd('2025-02-29'), false, '2025 is not a leap year');
assert.strictEqual(dateUtils.isRealYmd('2024-02-29'), true, '2024 is a leap year');
assert.strictEqual(dateUtils.isRealYmd('2026-01-03'), true, '2026-01-03 is a valid Gregorian date');
assert.strictEqual(dateUtils.isValidGregorianDate('2026-02-30'), false, 'isValidGregorianDate alias matches');
console.log('[PASS] Test 1: dateUtils strict Gregorian calendar decomposition verified.');

// 2. Base Valid Job Template
const baseJob = {
  id: 'JOB-TEST-VALID',
  name: 'Test Validation Job',
  category: 'Gardening',
  locationDetails: 'Test Garden',
  primaryTeam: 'Parks',
  startTime: '07:00 AM',
  durationHours: 6,
  crewSize: 2,
  status: 'active'
};

// 3. One-off Job Non-Existent Gregorian Date Rejection (Feb 30)
const badOneOffJob = Object.assign({}, baseJob, {
  id: 'JOB-BAD-DATE-1',
  frequencyType: 'one_off',
  targetDate: '2026-02-30'
});
const res1 = validator.validateJob(badOneOffJob);
assert.strictEqual(res1.valid, false, 'Feb 30 one-off job must fail validation');
assert(res1.error.includes('valid Gregorian calendar targetDate'), 'Error message must specify Gregorian calendar requirement');
console.log('[PASS] Test 2: One-off job with non-existent Gregorian date (2026-02-30) rejected.');

// 4. One-off Job April 31 Rejection
const badAprilJob = Object.assign({}, baseJob, {
  id: 'JOB-BAD-DATE-2',
  frequencyType: 'one_off',
  targetDate: '2026-04-31'
});
const res2 = validator.validateJob(badAprilJob);
assert.strictEqual(res2.valid, false, 'April 31 one-off job must fail validation');
console.log('[PASS] Test 3: One-off job with non-existent Gregorian date (2026-04-31) rejected.');

// 5. One-off Job Non-Leap Year Feb 29 Rejection
const badLeapJob = Object.assign({}, baseJob, {
  id: 'JOB-BAD-DATE-3',
  frequencyType: 'one_off',
  targetDate: '2025-02-29'
});
const res3 = validator.validateJob(badLeapJob);
assert.strictEqual(res3.valid, false, 'Non-leap year Feb 29 one-off job must fail validation');
console.log('[PASS] Test 4: One-off job with non-leap year Feb 29 rejected.');

// 6. Recurring Job Non-Existent Anchor Date Rejection
const badRecurringDateJob = Object.assign({}, baseJob, {
  id: 'JOB-BAD-REC-DATE',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-02-30',
  intervalWeeks: 2,
  preferredDay: 'saturday'
});
const res4 = validator.validateJob(badRecurringDateJob);
assert.strictEqual(res4.valid, false, 'Recurring job with non-existent anchorDate must fail');
assert(res4.error.includes('valid Gregorian calendar YYYY-MM-DD anchorDate'), 'Error must specify Gregorian calendar anchorDate');
console.log('[PASS] Test 5: Recurring job with non-existent anchorDate rejected.');

// 7. Non-Integer Recurrence Interval Rejection (intervalWeeks: 1.5)
const nonIntIntervalJob = Object.assign({}, baseJob, {
  id: 'JOB-NON-INT-INTERVAL',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-01-03', // Valid Saturday
  intervalWeeks: 1.5,
  preferredDay: 'saturday'
});
const res5 = validator.validateJob(nonIntIntervalJob);
assert.strictEqual(res5.valid, false, 'Non-integer intervalWeeks (1.5) must fail validation');
assert(res5.error.includes('integer intervalWeeks >= 1'), 'Error message must specify integer interval requirement');
console.log('[PASS] Test 6: Non-integer recurrence interval (1.5) strictly rejected.');

// 8. Zero Recurrence Interval Rejection (intervalWeeks: 0)
const zeroIntervalJob = Object.assign({}, baseJob, {
  id: 'JOB-ZERO-INTERVAL',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-01-03',
  intervalWeeks: 0,
  preferredDay: 'saturday'
});
const res6 = validator.validateJob(zeroIntervalJob);
assert.strictEqual(res6.valid, false, 'Zero intervalWeeks must fail validation');
console.log('[PASS] Test 7: Zero recurrence interval (0) strictly rejected.');

// 9. Negative Recurrence Interval Rejection (intervalWeeks: -2)
const negIntervalJob = Object.assign({}, baseJob, {
  id: 'JOB-NEG-INTERVAL',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-01-03',
  intervalWeeks: -2,
  preferredDay: 'saturday'
});
const res7 = validator.validateJob(negIntervalJob);
assert.strictEqual(res7.valid, false, 'Negative intervalWeeks must fail validation');
console.log('[PASS] Test 8: Negative recurrence interval (-2) strictly rejected.');

// 10. Valid Jobs Pass Validation
const validOneOff = Object.assign({}, baseJob, {
  id: 'JOB-VALID-ONEOFF',
  frequencyType: 'one_off',
  targetDate: '2026-03-07' // Saturday
});
const resValidOneOff = validator.validateJob(validOneOff);
assert.strictEqual(resValidOneOff.valid, true, 'Valid one-off job must pass: ' + resValidOneOff.error);

const validRecurring = Object.assign({}, baseJob, {
  id: 'JOB-VALID-RECURRING',
  frequencyType: 'recurring_weeks',
  anchorDate: '2026-01-03',
  intervalWeeks: 2,
  preferredDay: 'saturday'
});
const resValidRec = validator.validateJob(validRecurring);
assert.strictEqual(resValidRec.valid, true, 'Valid recurring job must pass: ' + resValidRec.error);
console.log('[PASS] Test 9: Valid Gregorian date and integer recurrence interval jobs pass validation.');

console.log('\n================================================================');
console.log(' ALL FR-02 SCHEDULE VALIDATION TESTS PASSED (100%)');
console.log('================================================================\n');
