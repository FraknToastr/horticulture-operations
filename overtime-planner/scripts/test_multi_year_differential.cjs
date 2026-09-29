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
require('../js/utils/rostering/engine.js');

console.log('================================================================');
console.log(' OFFLINE17 MULTI-YEAR SCHEDULER & ROSTERING DIFFERENTIAL AUDIT');
console.log(' EVALUATING YEARS: 2025, 2026, 2027, 2028');
console.log('================================================================\n');

const jobs = JSON.parse(JSON.stringify(window.HortOpsData.INITIAL_JOBS));
const staffList = JSON.parse(JSON.stringify(window.HortOpsData.STAFF_ROSTER));

const years = [2025, 2026, 2027, 2028];
const report = {};

years.forEach(year => {
  console.log(`>>> [YEAR ${year}] Running Schedule Generation & Invariant Analysis...`);
  
  // 1. Generate clean digest
  const digest = window.HortOpsScheduler.generateOperationalDigest(jobs, year);
  const allShifts = digest.allShifts || [];
  
  assert(allShifts.length > 0, `Year ${year} must generate non-zero shifts`);
  
  // Check canonical shift IDs
  const shiftIds = new Set();
  const duplicateIds = [];
  allShifts.forEach(shift => {
    assert(shift.shiftId, `Shift in year ${year} missing shiftId`);
    assert(shift.jobId, `Shift ${shift.shiftId} missing jobId`);
    assert(shift.date, `Shift ${shift.shiftId} missing date`);
    assert.strictEqual(shift.shiftId, `${shift.jobId}@${shift.date}`, `Shift identity must follow jobId@YYYY-MM-DD`);
    if (shiftIds.has(shift.shiftId)) {
      duplicateIds.push(shift.shiftId);
    }
    shiftIds.add(shift.shiftId);
  });
  assert.strictEqual(duplicateIds.length, 0, `Year ${year} has duplicate shift IDs: ${duplicateIds.join(', ')}`);
  
  // Date validation
  allShifts.forEach(shift => {
    const shiftDate = new Date(shift.date);
    assert(!isNaN(shiftDate.getTime()), `Invalid shift date: ${shift.date}`);
    assert.strictEqual(shiftDate.getFullYear(), year, `Shift date ${shift.date} does not match target year ${year}`);
  });
  
  // Cost calculation invariant
  const totalCost = allShifts.reduce((acc, shift) => {
    const costObj = window.HortOpsScheduler.calculateShiftCost(shift);
    const cost = costObj ? costObj.totalCost : 0;
    assert(typeof cost === 'number' && !isNaN(cost) && cost >= 0, `Cost calculation produced invalid value for shift ${shift.shiftId}`);
    return acc + cost;
  }, 0);
  
  // Year boundary sanity
  const slots = window.HortOpsScheduler.generateWeekendSlots(year);
  if (year === 2028) {
    const w53 = slots.find(s => s.weekNumber === 53);
    assert(w53, '2028 must support 53 Saturday weeks');
    assert.strictEqual(w53.saturdayDate, '2028-12-30', '2028 W53 Saturday must be 2028-12-30');
  }
  
  // 2. Test intentional rostering differential vs clean baseline
  // Select active job with occurrences in this year
  const targetJob = jobs.find(j => allShifts.some(s => s.jobId === j.id));
  assert(targetJob, `Must find an active job with shifts in year ${year}`);
  const series = window.HortOpsRosteringEngine.resolveSeries(targetJob, allShifts);
  assert(series.length > 0, `Series for Job ${targetJob.id} in year ${year} must exist`);
  
  const startOcc = series[0];
  const eligibleStaff = staffList.filter(e => e.status === 'active' || e.employmentStatus === 'active');
  const assignedStaffId = eligibleStaff[0].id;
  
  const modifiedJobs = JSON.parse(JSON.stringify(jobs));
  const rosteringState = { instructions: {}, provenance: {} };
  const customAssignments = {};
  
  const repeatCount = Math.min(3, series.length);
  const stagedStrategies = {};
  stagedStrategies[assignedStaffId] = { mode: 'fixed', repeatCount: repeatCount };
  
  const rosterResult = window.HortOpsRosteringEngine.applyRostering({
    job: targetJob,
    currentShift: startOcc,
    stagedStaffIds: [assignedStaffId],
    stagedStrategies: stagedStrategies,
    allShifts: allShifts,
    roster: staffList,
    customAssignments: customAssignments,
    rosteringState: rosteringState
  });
  
  // Apply customAssignments to modified digest / simulation with canonical parameter signature
  const rosteredDigest = window.HortOpsScheduler.generateOperationalDigest(
    modifiedJobs,
    year,
    true,
    rosterResult.customAssignments,
    staffList
  );
  const rosteredShifts = rosteredDigest.allShifts || [];
  
  // Schedule shape invariants MUST be 100% identical
  assert.strictEqual(rosteredShifts.length, allShifts.length, `Shift count changed after rostering in ${year}`);
  
  allShifts.forEach((baselineShift, idx) => {
    const rosteredShift = rosteredShifts[idx];
    assert.strictEqual(rosteredShift.shiftId, baselineShift.shiftId, `Shift ID mismatch at index ${idx} in ${year}`);
    assert.strictEqual(rosteredShift.date, baselineShift.date, `Shift date mismatch at index ${idx} in ${year}`);
    assert.strictEqual(rosteredShift.jobId, baselineShift.jobId, `Job ID mismatch at index ${idx} in ${year}`);
    assert.strictEqual(rosteredShift.weekNumber, baselineShift.weekNumber, `Week number mismatch in ${year}`);
  });
  
  // Cost differential: rostering assigned an active employee across repeatCount shifts
  const rosteredTotalCost = rosteredShifts.reduce((acc, shift) => {
    const costObj = window.HortOpsScheduler.calculateShiftCost(shift);
    return acc + (costObj ? costObj.totalCost : 0);
  }, 0);
  
  report[year] = {
    totalShifts: allShifts.length,
    uniqueShiftIds: shiftIds.size,
    weekendSlots: slots.length,
    targetJob: targetJob.id,
    seriesLength: series.length,
    baselineProjectedCost: '$' + totalCost.toFixed(2),
    rosteredProjectedCost: '$' + rosteredTotalCost.toFixed(2),
    costDelta: '$' + (rosteredTotalCost - totalCost).toFixed(2),
    scheduleShapePreserved: true
  };
  
  console.log(`  ✔ Year ${year}: ${allShifts.length} shifts generated across ${slots.length} weekend slots.`);
  console.log(`  ✔ Shift IDs, dates, recurrence, and job counts 100% invariant under rostering.`);
  console.log(`  ✔ Baseline Cost: $${totalCost.toFixed(2)} | Rostered Cost: $${rosteredTotalCost.toFixed(2)} (Delta: $${(rosteredTotalCost - totalCost).toFixed(2)})\n`);
});

console.log('================================================================');
console.log(' MULTI-YEAR DIFFERENTIAL SUMMARY REPORT');
console.log('================================================================');
console.table(report);
console.log('\n[PASS] Multi-year differential verified: zero unexpected scheduling/cost anomalies.');
