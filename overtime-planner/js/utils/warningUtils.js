// Standalone Operational Warning Detection Engine
// Detects missing plant operators, crew integrity conflicts, ineligible assignees, and slot collisions.

window.HortOpsWarningUtils = {
  /**
   * Evaluates workspace state and returns all operational warnings.
   * @param {Object} state - Main application state
   * @returns {Array<Object>} List of structured warning objects
   */
  getWarnings: function(state) {
    if (!state) return [];
    var allShifts = state.allShifts || [];
    var slots = state.slots || [];
    var staffList = state.staffList || [];
    var warnings = [];

    // 0. High-Priority System & Storage Quarantine Warnings (Mandate Section 28, 57)
    if (state.recoveryRequired) {
      warnings.push({
        id: 'warn-storage-recovery-required',
        type: 'system',
        category: 'Persistence',
        severity: 'high',
        title: 'Workspace Recovery Required',
        message: 'Auto-save is suspended. Workspace was loaded in quarantine/recovery mode (' + (state.recoverySource || 'Schema v2 failure') + '). Restore a valid backup JSON to restore persistent auto-saving.'
      });
    }

    // Map staff for fast lookup
    var staffMap = {};
    staffList.forEach(function(s) { staffMap[s.id] = s; });

    // 1. Shift-level Warnings: Crew Integrity, Ineligibility, Missing Plant Operators
    allShifts.forEach(function(shift) {
      var assignedIds = shift.assignedStaffIds || [];
      var jobName = shift.jobName || 'Operational Shift';
      var shiftDate = shift.date || 'Unscheduled';
      var timeStr = shift.startTime ? (shift.startTime + (shift.durationHours ? ' (' + shift.durationHours + 'h)' : '')) : '';

      // A. Missing Plant Operator
      var isPlantOpReq = Boolean(shift.plantOperatorRequired || (shift.job && shift.job.plantOperatorRequired));
      if (isPlantOpReq) {
        var hasPlantOp = assignedIds.some(function(id) {
          var s = staffMap[id];
          return s && s.isPlantOperator;
        });

        if (!hasPlantOp) {
          warnings.push({
            id: 'warn-plant-op-' + shift.shiftId,
            type: 'plant_operator',
            category: 'Certification',
            severity: 'medium',
            shiftId: shift.shiftId,
            jobId: shift.jobId,
            jobName: jobName,
            date: shiftDate,
            time: timeStr,
            title: jobName + ' — Plant Operator Required',
            message: 'This operation requires at least one certified Plant Operator, but none is currently assigned to the crew.'
          });
        }
      }

      // B. Crew Integrity Conflicts (Overtime limits, rest intervals, duplicate shifts)
      if (shift.hasCrewConflict || (shift.crewIntegrityIssues && shift.crewIntegrityIssues.length > 0)) {
        var issues = shift.crewIntegrityIssues || [];
        var firstIssueMsg = (issues[0] && issues[0].message) ? issues[0].message : 'Crew integrity conflict detected on this shift.';
        
        // Avoid duplicate if issue was already caught as plant operator requirement
        if (!firstIssueMsg.toLowerCase().includes('plant operator') || !isPlantOpReq) {
          warnings.push({
            id: 'warn-conflict-' + shift.shiftId,
            type: 'crew_conflict',
            category: 'Crew Integrity',
            severity: 'high',
            shiftId: shift.shiftId,
            jobId: shift.jobId,
            jobName: jobName,
            date: shiftDate,
            time: timeStr,
            title: jobName + ' — Crew Conflict',
            message: firstIssueMsg
          });
        }
      }

      // C. Ineligible Assignees
      if (shift.invalidAssignees && shift.invalidAssignees.length > 0) {
        shift.invalidAssignees.forEach(function(inv, idx) {
          warnings.push({
            id: 'warn-ineligible-' + shift.shiftId + '-' + idx,
            type: 'ineligible_assignee',
            category: 'Eligibility',
            severity: 'high',
            shiftId: shift.shiftId,
            jobId: shift.jobId,
            jobName: jobName,
            date: shiftDate,
            time: timeStr,
            title: jobName + ' — Ineligible Staff Assigned',
            message: (inv.name || 'Staff') + ': ' + (inv.reason || 'Assignment violates eligibility policy')
          });
        });
      }
    });

    // 2. Slot-level Warnings: Arterial Collisions & Overloaded Slots
    slots.forEach(function(slot) {
      if (slot.hasArterialConflict) {
        warnings.push({
          id: 'warn-arterial-' + slot.date,
          type: 'arterial_conflict',
          category: 'Slot Collision',
          severity: 'medium',
          date: slot.date,
          time: 'Week ' + slot.weekNumber,
          title: 'Arterial Road Conflict (' + slot.date + ')',
          message: 'Multiple arterial road operations are scheduled concurrently on this weekend slot. Traffic permits may clash.'
        });
      }

      if (slot.isOverloaded) {
        warnings.push({
          id: 'warn-overload-' + slot.date,
          type: 'slot_overload',
          category: 'Slot Collision',
          severity: 'low',
          date: slot.date,
          time: 'Week ' + slot.weekNumber,
          title: 'High Density Slot (' + slot.date + ')',
          message: slot.shifts.length + ' operations scheduled simultaneously. Coordinate field resources.'
        });
      }
    });

    // 3. System & Storage Warnings
    if (window.HortOpsStorage && typeof window.HortOpsStorage.getStorageHealth === 'function') {
      try {
        var health = window.HortOpsStorage.getStorageHealth();
        if (health && health.status === 'warning') {
          warnings.push({
            id: 'warn-storage-status',
            type: 'system',
            category: 'System',
            severity: 'medium',
            title: 'Storage Warning',
            message: health.message || 'Workspace storage requires attention.'
          });
        } else if (health && (health.status === 'unavailable' || health.status === 'recovery')) {
          warnings.push({
            id: 'warn-storage-critical',
            type: 'system',
            category: 'System',
            severity: 'high',
            title: 'Storage Health Degraded',
            message: health.message || 'Storage driver unavailable or recovery required.'
          });
        }
      } catch (e) {}
    }

    // 4. Rostering Engine Actionable Warnings (Mandate Section 76)
    if (state.lastRosteringAudit && Array.isArray(state.lastRosteringAudit)) {
      state.lastRosteringAudit.forEach(function(entry, idx) {
        var dateStr = entry.shiftId ? entry.shiftId.split('@')[1] : '';
        if (entry.action === 'fixed_ineligible_vacancy') {
          warnings.push({
            id: 'warn-roster-fixed-ineligible-' + (entry.shiftId || idx),
            type: 'rostering_fixed_unavailable',
            category: 'Rostering',
            severity: 'medium',
            shiftId: entry.shiftId,
            date: dateStr,
            title: 'Fixed Staff Unavailable' + (dateStr ? ' (' + dateStr + ')' : ''),
            message: entry.message || 'Fixed officer is ineligible on downstream occurrence. Slot left vacant.'
          });
        } else if (entry.action === 'rotation_no_candidate_vacancy') {
          warnings.push({
            id: 'warn-roster-rotation-exhausted-' + (entry.shiftId || idx),
            type: 'rostering_pool_exhausted',
            category: 'Rostering',
            severity: 'medium',
            shiftId: entry.shiftId,
            date: dateStr,
            title: 'Rotation Pool Exhausted' + (dateStr ? ' (' + dateStr + ')' : ''),
            message: entry.message || 'Eligible rotation pool exhausted for downstream occurrence. Slot left vacant.'
          });
        } else if (entry.action === 'plant_operator_unresolved') {
          warnings.push({
            id: 'warn-roster-plant-unresolved-' + (entry.shiftId || idx),
            type: 'rostering_plant_operator_unresolved',
            category: 'Rostering',
            severity: 'high',
            shiftId: entry.shiftId,
            date: dateStr,
            title: 'Plant Operator Unresolved' + (dateStr ? ' (' + dateStr + ')' : ''),
            message: entry.message || 'Certified Plant Operator required but none available in rotation pool. Slot left vacant.'
          });
        } else if (entry.action === 'manual_assignment_preserved') {
          warnings.push({
            id: 'warn-roster-manual-preserved-' + (entry.shiftId || idx),
            type: 'rostering_manual_preserved',
            category: 'Rostering',
            severity: 'low',
            shiftId: entry.shiftId,
            date: dateStr,
            title: 'Manual Assignment Preserved' + (dateStr ? ' (' + dateStr + ')' : ''),
            message: entry.message || 'Downstream occurrence already had a manual assignment; propagation bypassed.'
          });
        }
      });
    }

    return warnings;
  }
};
