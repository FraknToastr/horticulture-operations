// Stage 4E application boundary: approve bounded repairs and merge only during allocator save.
(function () {
  'use strict';
  var app = window.HortOpsApp;
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function modal() { return window.HortOpsStaffAssignModal; }

  app.getMixedPolicyPlanSignature = function (shiftId) {
    if (!modal() || modal().activeShiftId !== shiftId) throw new Error('Open the Staff Allocator first.');
    return JSON.stringify([
      this.getHoursAllocationSignature(shiftId),
      modal().stagedSlots || [],
      modal().stagedSlotStrategies || {}
    ]);
  };

  app.getMixedPolicyPlanDraft = function (shiftId) {
    if (!modal() || modal().activeShiftId !== shiftId) throw new Error('Open the Staff Allocator first.');
    var context = this.getSavedCandidatePreviewContext(shiftId);
    context.stagedIds = (modal().stagedAssignedStaffIds || []).slice();
    context.stagedSlots = clone(modal().stagedSlots || []);
    context.stagedStrategies = clone(modal().stagedSlotStrategies || {});
    context.currentDate = window.HortOpsDateUtils.getLocalDateKey();
    context.signature = this.getMixedPolicyPlanSignature(shiftId);
    context.model = window.HortOpsMixedPolicyPlan.build(context);
    return context;
  };

  modal().approveMixedPolicyPlan = function (signature) {
    if (!this.activeShiftId || typeof signature !== 'string') return { success: false, error: 'No current mixed-policy proposal.' };
    var current;
    try { current = app.getMixedPolicyPlanDraft(this.activeShiftId); }
    catch (error) { return { success: false, error: error.message }; }
    if (current.signature !== signature) return { success: false, error: 'The saved workspace or staged policies changed. Refresh proposal.' };
    if (!current.model || !current.model.success) return { success: false, error: 'The current mixed-policy proposal cannot be approved.' };
    this._mixedPolicyApproval = { signature: signature, repairs: clone(current.model.repairs || []) };
    this.autoAddStatus = (current.model.repairs || []).length + ' manual substitute proposal' + ((current.model.repairs || []).length === 1 ? '' : 's') + ' approved for the next save; ' + (current.model.shortages || []).length + ' occurrence shortage' + ((current.model.shortages || []).length === 1 ? '' : 's') + ' remain.';
    this.renderModal();
    return { success: true, repairs: clone(current.model.repairs || []), shortages: clone(current.model.shortages || []) };
  };

  app._applyApprovedMixedPolicyRepairs = function (shiftId, rosterResult) {
    var approval = modal() && modal()._mixedPolicyApproval;
    if (!approval) return { success: true, result: rosterResult };
    var current;
    try { current = this.getMixedPolicyPlanDraft(shiftId); }
    catch (error) { return { success: false, error: error.message }; }
    if (current.signature !== approval.signature || JSON.stringify(current.model.repairs || []) !== JSON.stringify(approval.repairs || [])) {
      return { success: false, error: 'The approved mixed-policy proposal is stale. Refresh it before saving.' };
    }
    var result = rosterResult;
    var assignments = result.customAssignments;
    var provenance = result.rosteringState.provenance;
    var projectedShifts = clone(current.allShifts || []).map(function (shift) {
      if (Object.prototype.hasOwnProperty.call(rosterResult.customAssignments || {}, shift.shiftId)) shift.assignedStaffIds = clone(rosterResult.customAssignments[shift.shiftId] || []);
      return shift;
    });
    var roster = current.state.staffList || current.state.roster || [];
    var job = current.job;
    var now = new Date().toISOString();

    function refreshShift(shiftId, ids) {
      var shift = projectedShifts.find(function (item) { return item.shiftId === shiftId; });
      if (shift) shift.assignedStaffIds = ids.slice();
      return shift;
    }

    for (var i = 0; i < approval.repairs.length; i++) {
      var repair = approval.repairs[i];
      var occurrence = (current.allShifts || []).find(function (item) { return item.shiftId === repair.shiftId; });
      var staff = roster.find(function (person) { return person.id === repair.staffId; });
      var assigned = (assignments[repair.shiftId] || occurrence && occurrence.assignedStaffIds || []).slice();
      if (!occurrence || !staff || assigned.indexOf(repair.staffId) >= 0) return { success: false, error: 'An approved substitute can no longer be applied safely.' };
      var eligibility = window.HortOpsEligibilityEngine.validateStaffEligibility(staff, occurrence, job, projectedShifts, assigned);
      if (!eligibility.eligible || assigned.length >= Number(occurrence.crewSize || job.crewSize || 1)) return { success: false, error: 'An approved substitute is no longer eligible or the occurrence is full.' };
      assigned.push(repair.staffId);
      assignments[repair.shiftId] = assigned;
      provenance[repair.shiftId + ':' + repair.staffId] = { source: 'manual', slotId: repair.slotId, appliedAt: now, stage4eRepair: true };
      result.auditLog.push({ shiftId: repair.shiftId, employeeId: repair.staffId, replacedFixedEmployeeId: repair.fixedStaffId, slotId: repair.slotId, mode: 'manual', action: 'stage4e_manual_substitute', message: 'Operator-approved manual substitute added while the fixed conflict remains recorded.' });
      result.affectedOccurrences[repair.shiftId] = occurrence;
      refreshShift(repair.shiftId, assigned);
    }
    return { success: true, result: result };
  };
})();
