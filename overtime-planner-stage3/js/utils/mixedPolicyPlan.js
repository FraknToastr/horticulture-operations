// Stage 4E: deterministic bounded mixed-policy proposal. No writes.
(function () {
  'use strict';

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function unique(values) { return Array.from(new Set(values || [])); }
  function byDate(a, b) { return String(a.date || '').localeCompare(String(b.date || '')) || String(a.shiftId || '').localeCompare(String(b.shiftId || '')); }

  function build(context) {
    context = context || {};
    var state = context.state || {};
    var occurrence = context.occurrence;
    var job = context.job;
    var stagedSlots = clone(context.stagedSlots || []);
    var stagedIds = unique(context.stagedIds || []);
    var allShifts = clone(context.allShifts || []);
    var errors = [];

    if (!occurrence || !occurrence.shiftId || !job) errors.push('A saved occurrence and job are required.');
    if (!window.HortOpsRosteringEngine || typeof window.HortOpsRosteringEngine.applyRostering !== 'function') errors.push('Canonical rostering engine unavailable.');
    if (!window.HortOpsHoursAllocation || typeof window.HortOpsHoursAllocation.build !== 'function') errors.push('Overtime-hours allocation service unavailable.');
    if (!window.HortOpsEligibilityEngine || typeof window.HortOpsEligibilityEngine.validateStaffEligibility !== 'function') errors.push('Canonical eligibility engine unavailable.');
    if (errors.length) return { success: false, errors: errors, occurrences: [], repairs: [], shortages: [] };

    var maxRepeat = stagedSlots.reduce(function (max, slot) {
      return Math.max(max, slot.mode === 'manual' ? 1 : (parseInt(slot.repeatCount, 10) || 1));
    }, 1);
    var strategies = {};
    stagedSlots.forEach(function (slot) {
      strategies[slot.staffId] = { mode: slot.mode || 'manual', repeatCount: slot.mode === 'manual' ? 1 : (parseInt(slot.repeatCount, 10) || 1) };
    });

    var projected = window.HortOpsRosteringEngine.applyRostering({
      job: clone(job),
      currentShift: clone(occurrence),
      stagedStaffIds: stagedIds.slice(),
      stagedSlots: stagedSlots,
      stagedStrategies: strategies,
      allShifts: allShifts,
      roster: clone(state.staffList || state.roster || []),
      customAssignments: clone(state.customAssignments || state.assignments || {}),
      rosteringState: clone(state.rostering || { instructions: {}, provenance: {} }),
      jobs: clone(state.jobs || [job])
    });
    if (!projected || !projected.success) return { success: false, errors: ['Canonical mixed-policy projection failed.'], occurrences: [], repairs: [], shortages: [] };

    var occurrenceMap = {};
    Object.keys(projected.affectedOccurrences || {}).forEach(function (id) { occurrenceMap[id] = clone(projected.affectedOccurrences[id]); });
    occurrenceMap[occurrence.shiftId] = clone(occurrence);
    var series = Object.keys(occurrenceMap).map(function (id) { return occurrenceMap[id]; }).sort(byDate).slice(0, maxRepeat);
    var seriesIds = new Set(series.map(function (item) { return item.shiftId; }));
    var roster = clone(state.staffList || state.roster || []);
    var fixedConflicts = (projected.auditLog || []).filter(function (entry) {
      return entry.action === 'fixed_ineligible_vacancy' && seriesIds.has(entry.shiftId);
    });
    var repairs = [];

    function projectedShifts() {
      return allShifts.map(function (shift) {
        var next = clone(shift);
        if (Object.prototype.hasOwnProperty.call(projected.customAssignments || {}, shift.shiftId)) next.assignedStaffIds = clone(projected.customAssignments[shift.shiftId] || []);
        return next;
      });
    }

    fixedConflicts.forEach(function (conflict) {
      var target = occurrenceMap[conflict.shiftId] || allShifts.find(function (shift) { return shift.shiftId === conflict.shiftId; });
      if (!target) return;
      var assigned = unique((projected.customAssignments[conflict.shiftId] || target.assignedStaffIds || []).slice());
      var planState = clone(state);
      planState.customAssignments = clone(projected.customAssignments || {});
      planState.assignments = planState.customAssignments;
      var hourPlan = window.HortOpsHoursAllocation.build({
        state: planState,
        occurrence: clone(target),
        job: clone(job),
        allShifts: projectedShifts(),
        stagedIds: assigned,
        currentDate: context.currentDate
      });
      var substituteId = hourPlan && hourPlan.selectedIds && hourPlan.selectedIds[0];
      if (!substituteId) return;
      var slot = stagedSlots.find(function (item) { return item.staffId === conflict.employeeId && item.mode === 'fixed'; });
      var repair = {
        shiftId: conflict.shiftId,
        date: target.date,
        fixedStaffId: conflict.employeeId,
        staffId: substituteId,
        slotId: slot && slot.slotId || 'SLOT-1',
        reason: conflict.reason || 'INELIGIBLE',
        source: 'approved_manual_substitute'
      };
      repairs.push(repair);
      projected.customAssignments[repair.shiftId] = assigned.concat(substituteId);
    });

    var rows = series.map(function (item) {
      var assigned = unique((projected.customAssignments[item.shiftId] || item.assignedStaffIds || []).slice());
      var rowRepairs = repairs.filter(function (repair) { return repair.shiftId === item.shiftId; });
      var repairIds = rowRepairs.map(function (repair) { return repair.staffId; });
      var policyAssigned = assigned.filter(function (id) { return repairIds.indexOf(id) < 0; });
      var after = unique(policyAssigned.concat(repairIds));
      var conflicts = (projected.auditLog || []).filter(function (entry) {
        return entry.shiftId === item.shiftId && ['fixed_ineligible_vacancy', 'rotation_no_candidate_vacancy', 'plant_operator_unresolved', 'manual_assignment_preserved', 'staff_not_found'].indexOf(entry.action) >= 0;
      });
      return {
        shiftId: item.shiftId,
        date: item.date,
        assignedIds: policyAssigned,
        repairIds: repairIds,
        afterIds: after,
        conflicts: conflicts,
        vacancies: Math.max(0, Number(item.crewSize || job.crewSize || 1) - after.length)
      };
    });

    return {
      success: true,
      policy: {
        fixedIneligible: 'visible_conflict_with_approved_manual_substitute',
        scope: 'occurrence_count',
        afterScope: 'unassigned_unless_another_policy_applies',
        automaticPersistence: false
      },
      sourceShiftId: occurrence.shiftId,
      maxRepeat: maxRepeat,
      occurrences: rows,
      repairs: repairs,
      shortages: rows.filter(function (row) { return row.vacancies > 0; }).map(function (row) { return { shiftId: row.shiftId, date: row.date, vacancies: row.vacancies }; }),
      projectedAudit: clone(projected.auditLog || [])
    };
  }

  window.HortOpsMixedPolicyPlan = Object.freeze({ build: build });
})();
