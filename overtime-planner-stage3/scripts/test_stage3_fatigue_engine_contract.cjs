/**
 * Stage 3 - Gate 3C Verification Contract:
 * Advanced Multi-Week Fatigue Risk & Predictive Overtime Allocation Engine
 *
 * Verifies:
 * 1. Date math & weekend anchor resolution (Fri/Sat/Sun/Mon -> Saturday anchor)
 * 2. Rolling lookback overtime hours (14-day and 28-day window calculations)
 * 3. Consecutive working weekends lookback & broken-streak reset
 * 4. Fatigue risk tier classification (LOW, MODERATE, HIGH, CRITICAL)
 * 5. Critical fatigue hard block (>=4 consecutive weekends or >=32h / 14d)
 * 6. Predictive overtime opportunity equalization ranking
 * 7. Staff assignment modal fatigue integration (badges, alerts, addStaff & saveAllocation guards)
 */

const assert = require('assert');
const path = require('path');

// Setup mock window environment
if (typeof window === 'undefined') {
  global.window = {};
}
if (typeof document === 'undefined') {
  global.document = {
    getElementById: function() { return null; }
  };
}

// 1. Load Dependencies
require('../js/data/holidays.js');
require('../js/utils/icons.js');
require('../js/utils/securityUtils.js');
require('../js/utils/dateUtils.js');
require('../js/utils/qualifications.js');
require('../js/utils/fatigueEngine.js');
require('../js/utils/storage/schemaValidator.js');
require('../js/utils/eligibilityEngine.js');
require('../js/components/staffAssignModal/candidateModel.js');
require('../js/components/staffAssignModal/candidateList.js');
require('../js/components/staffAssignModal/stagedCrew.js');
require('../js/components/staffAssignModal.js');

const fatigue = window.HortOpsFatigueEngine;
const candidateModel = window.HortOpsStaffAssignCandidateModel;
const candidateList = window.HortOpsStaffAssignCandidateList;
const stagedCrew = window.HortOpsStaffAssignStagedCrew;
const modal = window.HortOpsStaffAssignModal;

assert(fatigue, 'HortOpsFatigueEngine must be exported');

console.log('=== STAGE 3 GATE 3C VERIFICATION CONTRACT ===\n');

// -------------------------------------------------------------
// Test Group 1: Weekend Anchor & Date Mechanics
// -------------------------------------------------------------
console.log('--- Test Group 1: Weekend Anchor & Date Mechanics ---');
// 2026-06-05 is Friday, 2026-06-06 is Saturday, 2026-06-07 is Sunday, 2026-06-08 is Monday
assert.strictEqual(fatigue.getWeekendAnchor('2026-06-05'), '2026-06-06', 'Friday must map to Saturday anchor');
assert.strictEqual(fatigue.getWeekendAnchor('2026-06-06'), '2026-06-06', 'Saturday must map to Saturday anchor');
assert.strictEqual(fatigue.getWeekendAnchor('2026-06-07'), '2026-06-06', 'Sunday must map to Saturday anchor');
assert.strictEqual(fatigue.getWeekendAnchor('2026-06-08'), '2026-06-06', 'Monday must map to Saturday anchor');
assert.strictEqual(fatigue.getWeekendAnchor('2026-06-09'), null, 'Tuesday must return null for weekend anchor');

assert.strictEqual(fatigue.getDaysDiff('2026-06-10', '2026-06-01'), 9, 'Difference must be 9 days');
assert.strictEqual(fatigue.getDaysDiff('2026-06-01', '2026-06-10'), -9, 'Inverted difference must be -9 days');
console.log('✔ Weekend anchor normalization and date math pass');

// -------------------------------------------------------------
// Test Group 2: Rolling Hours & Consecutive Weekend Calculations
// -------------------------------------------------------------
console.log('\n--- Test Group 2: Rolling Hours & Consecutive Weekend Calculations ---');
const staffId = 'staff-f-1';

// Scenario: Staff worked 4 consecutive weekends
// Wknd 1: Sat 2026-05-16 (4h)
// Wknd 2: Sun 2026-05-24 (6h)
// Wknd 3: Sat 2026-05-30 (5h)
// Wknd 4: Sat 2026-06-06 (4h)
const mockShiftHistory = [
  { shiftId: 's1', jobId: 'job-1', jobName: 'Park Maintenance', date: '2026-05-16', startTime: '07:00', durationHours: 4, crewSize: 2, assignedStaffIds: [staffId] },
  { shiftId: 's2', jobId: 'job-1', jobName: 'Park Maintenance', date: '2026-05-24', startTime: '07:00', durationHours: 6, crewSize: 2, assignedStaffIds: [staffId] },
  { shiftId: 's3', jobId: 'job-1', jobName: 'Park Maintenance', date: '2026-05-30', startTime: '07:00', durationHours: 5, crewSize: 2, assignedStaffIds: [staffId] },
  { shiftId: 's4', jobId: 'job-1', jobName: 'Park Maintenance', date: '2026-06-06', startTime: '07:00', durationHours: 4, crewSize: 2, assignedStaffIds: [staffId] }
];

const asOf = '2026-06-06';
const rolling14 = fatigue.calculateRollingHours(staffId, mockShiftHistory, asOf, 14);
// Within 14 days of 2026-06-06: 2026-06-06 (4h), 2026-05-30 (5h), 2026-05-24 (6h) = 15h
assert.strictEqual(rolling14, 15, `Expected 15h rolling 14-day overtime, got ${rolling14}`);

const rolling28 = fatigue.calculateRollingHours(staffId, mockShiftHistory, asOf, 28);
// Within 28 days: all 4 shifts = 19h
assert.strictEqual(rolling28, 19, `Expected 19h rolling 28-day overtime, got ${rolling28}`);

const consecutiveWknds = fatigue.calculateConsecutiveWeekends(staffId, mockShiftHistory, asOf);
assert.strictEqual(consecutiveWknds, 4, `Expected 4 consecutive weekends, got ${consecutiveWknds}`);

// Test broken streak: If wknd 2 was skipped
const brokenStreakShifts = [
  { shiftId: 's1', jobId: 'job-1', jobName: 'Park Maintenance', date: '2026-05-16', startTime: '07:00', durationHours: 4, crewSize: 2, assignedStaffIds: [staffId] },
  // skipped 2026-05-23/24
  { shiftId: 's3', jobId: 'job-1', jobName: 'Park Maintenance', date: '2026-05-30', startTime: '07:00', durationHours: 5, crewSize: 2, assignedStaffIds: [staffId] },
  { shiftId: 's4', jobId: 'job-1', jobName: 'Park Maintenance', date: '2026-06-06', startTime: '07:00', durationHours: 4, crewSize: 2, assignedStaffIds: [staffId] }
];
const brokenWknds = fatigue.calculateConsecutiveWeekends(staffId, brokenStreakShifts, asOf);
assert.strictEqual(brokenWknds, 2, `Broken streak must reset consecutive count to 2, got ${brokenWknds}`);
console.log('✔ Rolling lookback hours and consecutive weekend streak tracking pass');

// -------------------------------------------------------------
// Test Group 3: Fatigue Tier Classification & Hard Rest Block
// -------------------------------------------------------------
console.log('\n--- Test Group 3: Fatigue Tier Classification ---');
const staffRecord = {
  id: staffId,
  name: 'Jordan Taylor',
  status: 'active',
  department: 'Horticulture',
  role: 'Team Member',
  team: 'Parks'
};

// 4 consecutive weekends -> CRITICAL (Hard Blocked)
const evalCritical = fatigue.evaluateStaffFatigue(staffRecord, mockShiftHistory, asOf);
assert.strictEqual(evalCritical.tier, 'CRITICAL', '4 consecutive weekends must trigger CRITICAL tier');
assert.strictEqual(evalCritical.isHardBlocked, true, 'CRITICAL tier must enforce isHardBlocked = true');
assert(evalCritical.message.includes('Mandatory rest required'));

// 3 consecutive weekends -> HIGH
const evalHigh = fatigue.evaluateStaffFatigue(staffRecord, mockShiftHistory.slice(0, 3), '2026-05-30');
assert.strictEqual(evalHigh.tier, 'HIGH', '3 consecutive weekends must trigger HIGH tier');
assert.strictEqual(evalHigh.isHardBlocked, false);

// 2 consecutive weekends -> MODERATE
const evalModerate = fatigue.evaluateStaffFatigue(staffRecord, mockShiftHistory.slice(0, 2), '2026-05-24');
assert.strictEqual(evalModerate.tier, 'MODERATE', '2 consecutive weekends must trigger MODERATE tier');
assert.strictEqual(evalModerate.isHardBlocked, false);

// 0 weekends -> LOW
const evalLow = fatigue.evaluateStaffFatigue(staffRecord, [], asOf);
assert.strictEqual(evalLow.tier, 'LOW', 'Zero weekends must trigger LOW tier');
assert.strictEqual(evalLow.isHardBlocked, false);
console.log('✔ All 4 fatigue risk tiers accurately classified with hard block enforcement');

// -------------------------------------------------------------
// Test Group 4: Prospective Assignment Fatigue Simulation
// -------------------------------------------------------------
console.log('\n--- Test Group 4: Prospective Assignment Fatigue Simulation ---');
// Staff has 3 consecutive weekends (May 16, May 24, May 30).
// Simulating an assignment on June 6 (4th weekend) must prospectively flag CRITICAL hard block.
const candidateShift4th = {
  shiftId: 's4_cand',
  date: '2026-06-06',
  durationHours: 4,
  assignedStaffIds: []
};
const simResult = fatigue.simulateAssignmentFatigue(staffRecord, candidateShift4th, mockShiftHistory.slice(0, 3));
assert.strictEqual(simResult.consecutiveWeekends, 4, 'Simulation must accurately project 4 consecutive weekends');
assert.strictEqual(simResult.tier, 'CRITICAL');
assert.strictEqual(simResult.isHardBlocked, true, 'Simulation must flag prospective hard block');
console.log('✔ Assignment fatigue simulation accurately projects downstream fatigue risk');

// -------------------------------------------------------------
// Test Group 5: Equal-Opportunity Overtime Dispatch Ranking
// -------------------------------------------------------------
console.log('\n--- Test Group 5: Equal-Opportunity Overtime Ranking ---');
const officerLow = { id: 'o-low', name: 'Zoe Low', ytdHours: 30 };
const officerMod = { id: 'o-mod', name: 'Aaron Mod', ytdHours: 10 };
const officerCrit = { id: 'o-crit', name: 'Ben Crit', ytdHours: 5 };

const rankHistory = [
  // officerCrit worked 4 weekends
  { shiftId: 'r1', date: '2026-05-16', assignedStaffIds: ['o-crit'] },
  { shiftId: 'r2', date: '2026-05-23', assignedStaffIds: ['o-crit'] },
  { shiftId: 'r3', date: '2026-05-30', assignedStaffIds: ['o-crit'] },
  { shiftId: 'r4', date: '2026-06-06', assignedStaffIds: ['o-crit'] },
  // officerMod worked 2 weekends
  { shiftId: 'r3b', date: '2026-05-30', assignedStaffIds: ['o-mod'] },
  { shiftId: 'r4b', date: '2026-06-06', assignedStaffIds: ['o-mod'] }
  // officerLow worked 0 weekends
];

const ranked = fatigue.rankEqualizedCandidates([officerCrit, officerMod, officerLow], rankHistory, '2026-06-06');
// Even though officerLow has 30 YTD hours, Zoe is in LOW tier, so Zoe MUST rank first!
// Next is Aaron Mod (MODERATE tier), and last is Ben Crit (CRITICAL tier).
assert.strictEqual(ranked[0].id, 'o-low', 'LOW fatigue candidate must rank first for dispatch');
assert.strictEqual(ranked[1].id, 'o-mod', 'MODERATE fatigue candidate must rank second');
assert.strictEqual(ranked[2].id, 'o-crit', 'CRITICAL fatigue candidate must rank last');
console.log('✔ Equalized ranking prioritizes fatigue-safe workforce dispatch');

// -------------------------------------------------------------
// Test Group 6: Staff Assignment Modal Hard Block & Cleansing
// -------------------------------------------------------------
console.log('\n--- Test Group 6: Modal Fatigue Hard Block & Cleansing ---');
let lastAlert = null;
global.alert = function(msg) { lastAlert = msg; };

window.HortOpsApp = {
  state: {
    allShifts: mockShiftHistory,
    jobs: [{ id: 'job-1', name: 'Park Maintenance', crewSize: 2, durationHours: 4, startTime: '07:00' }],
    staffList: [staffRecord, officerLow],
    currentYear: 2026
  }
};

modal.activeShiftId = 's4';
modal.stagedAssignedStaffIds = [];
modal.stagedSlots = [];
modal.stagedSlotStrategies = {};
modal.renderModal = function() {};

// Attempt to add staffRecord (who has 4 consecutive weekends on June 6)
lastAlert = null;
modal.addStaff(staffRecord.id);
assert(lastAlert && lastAlert.includes('consecutive weekends'), 'addStaff must block assignment of critically fatigued staff');
assert.strictEqual(modal.stagedAssignedStaffIds.length, 0, 'Fatigued staff must not be staged');

// Test removeAllFatigued
modal.stagedAssignedStaffIds = [staffRecord.id, officerLow.id];
modal.removeAllFatigued();
assert.strictEqual(modal.stagedAssignedStaffIds.includes(staffRecord.id), false, 'Fatigued staff must be removed');
assert.strictEqual(modal.stagedAssignedStaffIds.includes(officerLow.id), true, 'Safe staff must be retained');

// Test saveAllocation hard block if fatigued staff is staged
modal.stagedAssignedStaffIds = [staffRecord.id];
lastAlert = null;
let rosterCalled = false;
window.HortOpsRosteringEngine = {
  applyRostering: function() { rosterCalled = true; return { success: true }; }
};
modal.saveAllocation();
assert(lastAlert && lastAlert.includes('fatigue safety limits'), 'saveAllocation must hard-block on fatigue safety violation: ' + lastAlert);
assert.strictEqual(rosterCalled, false, 'applyRostering must not be reached when fatigue check fails');

console.log('✔ Modal strictly blocks fatigued assignments, cleanses fatigued crew, and enforces save guard');

console.log('\n======================================================');
console.log(' [PASS] GATE 3C CONTRACT VERIFICATION COMPLETE: 100% OK');
console.log('======================================================\n');
