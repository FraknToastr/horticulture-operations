// Stage 4F: deterministic absence-impact review. This module never writes state.
(function (root) {
  'use strict';

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function unique(values) { return Array.from(new Set(values || [])); }
  function dateOf(item, fallback) {
    return item && item.date || fallback && fallback.date || '';
  }
  function changedIntervals(staffId, before, after) {
    var oldById = Object.create(null);
    (before || []).forEach(function (item) { if (item && item.id) oldById[item.id] = item; });
    return (after || []).filter(function (item) {
      if (!item || item.staffId !== staffId) return false;
      var previous = oldById[item.id];
      return !previous || JSON.stringify(previous) !== JSON.stringify(item);
    }).map(clone);
  }
  function sourceLabel(provenance, instructions, shiftId, staffId) {
    var evidence = provenance[shiftId + ':' + staffId] || {};
    var instruction = evidence.instructionId && instructions[evidence.instructionId];
    var mode = instruction && instruction.mode || evidence.source || 'manual';
    if (mode === 'fixed') return { type: 'Fixed', instruction: instruction || null, evidence: evidence };
    if (mode === 'rotation') return { type: 'Rotation', instruction: instruction || null, evidence: evidence };
    return { type: 'Manual', instruction: instruction || null, evidence: evidence };
  }
  function occurrenceMap(state) {
    var map = Object.create(null);
    (state.allShifts || []).forEach(function (item) {
      if (item && item.shiftId) map[item.shiftId] = clone(item);
    });
    Object.keys(state.historicalSnapshots || {}).forEach(function (id) {
      if (!map[id]) map[id] = clone(state.historicalSnapshots[id]);
    });
    Object.keys(state.customAssignments || state.assignments || {}).forEach(function (id) {
      if (!map[id]) {
        var match = /^(.*)@(\d{4}-\d{2}-\d{2})$/.exec(id);
        if (match) map[id] = { shiftId: id, jobId: match[1], date: match[2] };
      }
      if (map[id]) map[id].assignedStaffIds = clone((state.customAssignments || state.assignments || {})[id] || []);
    });
    return map;
  }

  function build(input) {
    input = input || {};
    var state = clone(input.state || {});
    var staffId = input.staffId;
    var today = input.currentDate || (root.HortOpsDateUtils && root.HortOpsDateUtils.getLocalDateKey()) || '';
    var intervals = changedIntervals(staffId, input.baseAbsences || [], input.proposedAbsences || []);
    var assignments = state.customAssignments || state.assignments || {};
    var rostering = state.rostering || { instructions: {}, provenance: {} };
    var instructions = rostering.instructions || {}, provenance = rostering.provenance || {};
    var occurrences = occurrenceMap(state), rows = [], errors = [];
    if (!staffId) errors.push('A staff member is required.');
    if (!root.HortOpsHoursAllocation || typeof root.HortOpsHoursAllocation.build !== 'function') errors.push('Hours allocation service unavailable.');
    if (!root.HortOpsEligibilityEngine) errors.push('Eligibility service unavailable.');

    Object.keys(occurrences).forEach(function (shiftId) {
      var occurrence = occurrences[shiftId];
      var date = dateOf(occurrence);
      var interval = intervals.find(function (item) { return date >= item.startDate && date <= item.endDate; });
      var assigned = unique((assignments[shiftId] || occurrence.assignedStaffIds || []).slice());
      if (!interval || date < today || assigned.indexOf(staffId) === -1) return;
      var job = (state.jobs || []).find(function (item) { return item.id === occurrence.jobId || shiftId.indexOf(item.id + '@') === 0; });
      if (!job) { errors.push('Job unavailable for affected occurrence ' + shiftId + '.'); return; }
      occurrence.assignedStaffIds = assigned.slice();
      occurrence.jobId = occurrence.jobId || job.id;
      occurrence.crewSize = occurrence.crewSize || job.crewSize;
      var remaining = assigned.filter(function (id) { return id !== staffId; });
      var proposalState = clone(state);
      proposalState.absences = clone(input.proposedAbsences || []);
      proposalState.customAssignments = clone(assignments);
      proposalState.assignments = proposalState.customAssignments;
      proposalState.customAssignments[shiftId] = remaining.slice();
      var projected = Object.keys(occurrences).map(function (id) {
        var item = clone(occurrences[id]);
        item.assignedStaffIds = id === shiftId ? remaining.slice() : unique((assignments[id] || item.assignedStaffIds || []).slice());
        return item;
      });
      var hours = root.HortOpsHoursAllocation.build({
        state: proposalState,
        occurrence: clone(occurrence),
        job: clone(job),
        allShifts: projected,
        stagedIds: remaining,
        currentDate: today
      });
      var replacementId = hours && hours.success && hours.selectedIds && hours.selectedIds[0] || null;
      var source = sourceLabel(provenance, instructions, shiftId, staffId);
      rows.push({
        shiftId: shiftId,
        date: date,
        jobId: job.id,
        jobName: occurrence.jobName || job.name || job.id,
        absenceId: interval.id,
        absenceType: interval.type,
        affectedStaffId: staffId,
        assignedIds: assigned,
        assignmentType: source.type,
        instructionId: source.evidence.instructionId || null,
        slotId: source.evidence.slotId || source.instruction && source.instruction.slotId || 'SLOT-1',
        replacementId: replacementId,
        shortage: replacementId ? 0 : 1,
        replacementPolicy: 'one_off_manual',
        explanation: replacementId ? 'Lowest-hours eligible staff under the current pool, team, fatigue and overtime policy.' : ((hours && hours.messages || [])[0] || 'No eligible replacement with known verified overtime hours is available.'),
        sourceEvidence: clone(source.evidence)
      });
    });
    rows.sort(function (a, b) { return a.date.localeCompare(b.date) || a.shiftId.localeCompare(b.shiftId); });
    return {
      success: errors.length === 0,
      staffId: staffId,
      intervals: intervals,
      affected: rows,
      replacements: rows.filter(function (row) { return !!row.replacementId; }),
      shortages: rows.filter(function (row) { return !row.replacementId; }),
      errors: errors,
      policy: { horizon: 'changed_absence_date_range', replacement: 'one_off_manual', preserveInstructions: true, regularHoursIncluded: false }
    };
  }

  root.HortOpsAbsenceImpactPlan = Object.freeze({ build: build, changedIntervals: changedIntervals });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HortOpsAbsenceImpactPlan;
})(typeof window !== 'undefined' ? window : globalThis);
