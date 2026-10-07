// Stage 4F application boundary: revalidate and atomically persist absence replacements.
(function () {
  'use strict';
  var app = window.HortOpsApp;
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function modal() { return window.HortOpsStaffAbsenceModal; }
  function optionsFromModal() {
    return {
      deletedAbsenceIds: Array.from(modal().removedAbsenceIds || []),
      deletedRefusalIds: Array.from(modal().removedRefusalIds || []),
      baseAbsences: clone(modal().baseAbsences || []),
      baseRefusals: clone(modal().baseRefusals || [])
    };
  }
  app.getAbsenceImpactSignature = function () {
    var editor = modal();
    if (!editor || !editor.activeStaff) throw new Error('Open a staff absence editor first.');
    var storage = window.HortOpsStorage && window.HortOpsStorage.readVerifiedCommittedV2();
    if (!storage || !storage.ok) throw new Error('Saved workspace verification failed.');
    return JSON.stringify([
      storage.raw || '', editor.activeStaff.id, editor.baseAbsences || [], editor.workingAbsences || [],
      editor.baseRefusals || [], editor.workingRefusals || [], Array.from(editor.removedAbsenceIds || []),
      Array.from(editor.removedRefusalIds || [])
    ]);
  };
  app.getAbsenceImpactDraft = function () {
    var editor = modal();
    if (!editor || !editor.activeStaff) throw new Error('Open a staff absence editor first.');
    var signature = this.getAbsenceImpactSignature();
    return {
      signature: signature,
      staff: clone(editor.activeStaff),
      state: clone(this.state),
      model: window.HortOpsAbsenceImpactPlan.build({
        state: this.state,
        staffId: editor.activeStaff.id,
        baseAbsences: editor.baseAbsences || [],
        proposedAbsences: editor.workingAbsences || [],
        currentDate: window.HortOpsDateUtils.getLocalDateKey()
      })
    };
  };
  app.saveAbsenceImpactPlan = function (signature) {
    var current;
    try { current = this.getAbsenceImpactDraft(); } catch (error) { return { success: false, error: error.message }; }
    if (current.signature !== signature) return { success: false, error: 'The saved workspace or absence edits changed. Refresh the review.' };
    if (!current.model.success) return { success: false, error: current.model.errors[0] || 'Absence impact review failed.' };
    var editor = modal(), state = this.state;
    var assignments = clone(state.customAssignments || state.assignments || {});
    var rostering = clone(state.rostering || { instructions: {}, provenance: {} });
    rostering.instructions = rostering.instructions || {};
    rostering.provenance = rostering.provenance || {};
    var snapshots = clone(state.historicalSnapshots || {}), now = new Date().toISOString(), audit = [], applyError = null;
    current.model.replacements.forEach(function (row) {
      if (applyError) return;
      var crew = (assignments[row.shiftId] || row.assignedIds || []).slice();
      var index = crew.indexOf(row.affectedStaffId);
      if (index < 0 || crew.indexOf(row.replacementId) >= 0) { applyError = 'An affected assignment changed before approval. Refresh the review.'; return; }
      crew[index] = row.replacementId;
      assignments[row.shiftId] = crew;
      var oldKey = row.shiftId + ':' + row.affectedStaffId;
      var displacedEvidence = clone(rostering.provenance[oldKey] || row.sourceEvidence || {});
      delete rostering.provenance[oldKey];
      rostering.provenance[row.shiftId + ':' + row.replacementId] = {
        source: 'manual', slotId: row.slotId || 'SLOT-1', appliedAt: now,
        stage4fReplacement: true, replacedStaffId: row.affectedStaffId, absenceId: row.absenceId,
        replacedAssignmentEvidence: displacedEvidence, replacementReason: 'approved_absence_replacement'
      };
      audit.push({ action: 'stage4f_absence_replacement', shiftId: row.shiftId, date: row.date,
        employeeId: row.affectedStaffId, replacementEmployeeId: row.replacementId,
        absenceId: row.absenceId, assignmentType: row.assignmentType,
        message: 'Operator approved a one-off manual absence replacement; fixed and rotation instructions remain unchanged.' });
    });
    if (applyError) return { success: false, error: applyError };
    if (!window.HortOpsCommitmentPlanner || typeof window.HortOpsCommitmentPlanner.plan !== 'function') return { success: false, error: 'Scheduled commitment planner unavailable.' };
    var authoritative = {};
    (state.allShifts || []).forEach(function (item) { if (item && item.shiftId) authoritative[item.shiftId] = clone(item); });
    Object.keys(snapshots).forEach(function (id) { if (!authoritative[id]) authoritative[id] = clone(snapshots[id]); });
    var commitment = window.HortOpsCommitmentPlanner.plan({
      beforeAssignments: state.customAssignments || state.assignments || {}, afterAssignments: assignments,
      beforeSnapshots: snapshots, beforeRostering: state.rostering, afterRostering: rostering,
      prunedProvenance: [], authoritativeOccurrences: authoritative,
      todayKey: window.HortOpsDateUtils.getLocalDateKey(), nowIso: now,
      operation: { type: 'allocation_reconciliation', sourceShiftId: 'stage4f-absence-impact', recordedAtIso: now }
    });
    if (!commitment.ok) return { success: false, error: commitment.error || commitment.errors && commitment.errors[0] || 'Commitment update failed.' };
    snapshots = commitment.snapshots;
    var options = optionsFromModal();
    var proposal = {
      absences: clone(editor.workingAbsences || []), refusalHistory: clone(editor.workingRefusals || []),
      baseAbsences: options.baseAbsences, baseRefusals: options.baseRefusals,
      assignments: assignments, rostering: rostering, historicalSnapshots: snapshots
    };
    if (options.deletedAbsenceIds.length) proposal.authorisedAbsenceDeletions = options.deletedAbsenceIds;
    if (options.deletedRefusalIds.length) proposal.authorisedRefusalDeletions = options.deletedRefusalIds;
    var result;
    try { result = this._commitCanonicalProposal(proposal); } catch (error) { return { success: false, error: error.message }; }
    if (!result.success) return result;
    this.state.lastRosteringAudit = (this.state.lastRosteringAudit || []).concat(audit);
    this.state.storageStatus = result.storageMode === 'session-only' ? 'session-only' : 'saved';
    this.recomputeDigest();
    this.renderCurrentView();
    return { success: true, replacements: current.model.replacements.length, shortages: current.model.shortages.length };
  };
}());
