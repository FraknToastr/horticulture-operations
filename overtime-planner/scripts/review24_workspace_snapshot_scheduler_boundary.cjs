const assert = require('assert');

global.window = global;
require('../js/data/holidays.js');
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

console.log('=== REVIEW 24: WORKSPACE SNAPSHOT -> SCHEDULER BOUNDARY ===');

const jobId = 'SYN-ARCHIVED-JOB';
const date = '2025-01-04';
const shiftId = `${jobId}@${date}`;
const archivedJob = {
  id: jobId,
  name: 'Synthetic Archived Job',
  status: 'archived',
  active: false,
  frequencyType: 'one_off',
  targetDate: date,
  startTime: '08:00 AM',
  durationHours: 2,
  crewSize: 1
};
const snapshots = {
  [shiftId]: {
    shiftId,
    jobId,
    date,
    startTime: '10:00 PM',
    durationHours: 7,
    crewSize: 1,
    assignedStaffIds: ['SYN-001']
  }
};
const assignments = { [shiftId]: ['SYN-001'] };

const digest = window.HortOpsScheduler.generateOperationalDigest(
  [archivedJob], 2025, true, assignments, [], {}, snapshots
);
const shift = digest.allShifts.find(s => s.shiftId === shiftId);

assert(shift, 'Workspace historical snapshot must seed the preserved archived occurrence without any legacy global fixture');
assert.strictEqual(shift.startTime, '10:00 PM', 'Preserved occurrence must use workspace snapshot startTime');
assert.strictEqual(shift.durationHours, 7, 'Preserved occurrence must use workspace snapshot durationHours');
assert.deepStrictEqual(shift.assignedStaffIds, ['SYN-001'], 'Preserved occurrence must retain authoritative assigned staff IDs');
console.log('[PASS] Workspace historicalSnapshots independently preserve an archived historical occurrence.');
