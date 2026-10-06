// Stage 4D application boundary: append verified overtime evidence and stage a detached proposal.
(function () {
  'use strict';
  var app = window.HortOpsApp;
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function currentStaging(shiftId) {
    var modal = window.HortOpsStaffAssignModal;
    if (!modal || modal.activeShiftId !== shiftId) return null;
    return {
      ids: (modal.stagedAssignedStaffIds || []).slice(),
      slots: clone(modal.stagedSlots || []),
      strategies: clone(modal.stagedSlotStrategies || {})
    };
  }
  app.recordOvertimeHoursEvidence = function (staffId, input) {
    if (typeof staffId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(staffId) ||
        !input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).sort().join(',') !== 'hours,source,throughDate,year') {
      return { success: false, error: 'Provide staff, year, coverage date, hours and source.' };
    }
    var roster = this.state.staffList || [];
    var index = roster.findIndex(function (person) { return person.id === staffId; });
    if (index < 0) return { success: false, error: 'Staff member not found.' };
    var recordedAt = new Date().toISOString();
    var existingIds = new Set();
    roster.forEach(function (person) {
      (person.overtimeHoursEvidence || []).forEach(function (record) { existingIds.add(record.id); });
    });
    var base = 'HOURS-' + staffId + '-' + Date.now();
    var id = base, suffix = 1;
    while (existingIds.has(id)) id = base + '-' + suffix++;
    var record = {
      id: id,
      year: input.year,
      throughDate: input.throughDate,
      hours: input.hours,
      source: typeof input.source === 'string' ? input.source.trim() : input.source,
      recordedAt: recordedAt,
      verification: 'operator_verified'
    };
    var evidence = window.HortOpsHoursEvidence;
    var today = window.HortOpsDateUtils.getLocalDateKey();
    var check = evidence && evidence.validateRecord(record, { today: today });
    if (!check || !check.valid) return { success: false, error: check && check.error || 'Hours evidence validation unavailable.' };
    var proposed = clone(roster);
    proposed[index].overtimeHoursEvidence = (proposed[index].overtimeHoursEvidence || []).concat([record]);
    var commit = this._commitCanonicalProposal({ roster: proposed });
    if (!commit || !commit.success) return commit || { success: false, error: 'Hours evidence could not be saved.' };
    this.state.staffList = proposed;
    this.state.roster = proposed;
    this.state.storageStatus = commit.storageMode === 'session-only' ? 'session_only' : 'saved';
    this.recomputeDigest();
    this.renderCurrentView();
    return { success: true, record: clone(record) };
  };
  app.getHoursAllocationSignature = function (shiftId) {
    var staging = currentStaging(shiftId);
    if (!staging) throw new Error('Open the matching occurrence in the Staff Allocator first.');
    return JSON.stringify([
      this.getSavedCandidatePreviewSignature(shiftId),
      staging.ids,
      staging.slots,
      staging.strategies
    ]);
  };
  app.getHoursAllocationDraftContext = function (shiftId) {
    var staging = currentStaging(shiftId);
    if (!staging) throw new Error('Open the matching occurrence in the Staff Allocator first.');
    var context = this.getSavedCandidatePreviewContext(shiftId);
    context.stagedIds = staging.ids.slice();
    context.currentDate = window.HortOpsDateUtils.getLocalDateKey();
    context.signature = this.getHoursAllocationSignature(shiftId);
    if (!window.HortOpsHoursAllocation || typeof window.HortOpsHoursAllocation.build !== 'function') {
      throw new Error('Hours allocation service unavailable.');
    }
    context.model = window.HortOpsHoursAllocation.build(context);
    return context;
  };
  window.HortOpsStaffAssignModal.applyHoursProposal = function (signature) {
    var shiftId = this.activeShiftId;
    if (!shiftId || typeof signature !== 'string') return { success: false, error: 'No current hours proposal.' };
    var current;
    try { current = app.getHoursAllocationDraftContext(shiftId); }
    catch (error) { return { success: false, error: error.message }; }
    if (current.signature !== signature) return { success: false, error: 'The saved workspace or staged crew changed. Refresh the proposal.' };
    if (!current.model || !current.model.success) return { success: false, error: 'The current hours proposal is not safe to stage.' };
    var originalIds = (this.stagedAssignedStaffIds || []).slice();
    var additions = (current.model.selectedIds || []).filter(function (id) { return originalIds.indexOf(id) === -1; });
    var slots = clone(this.stagedSlots || []), strategies = clone(this.stagedSlotStrategies || {}), used = new Set();
    slots.forEach(function (slot) {
      var match = slot.slotId && slot.slotId.match(/SLOT-(\d+)/);
      if (match) used.add(Number(match[1]));
    });
    additions.forEach(function (id) {
      var next = 1; while (used.has(next)) next++;
      used.add(next);
      slots.push({ slotId: 'SLOT-' + next, staffId: id, mode: 'manual', repeatCount: 1,
        isInherited: false, sourceDate: current.occurrence.date || '' });
      strategies[id] = { mode: 'manual', repeatCount: 1 };
    });
    this.stagedAssignedStaffIds = originalIds.concat(additions);
    this.stagedSlots = slots;
    this.stagedSlotStrategies = strategies;
    this.autoAddStatus = additions.length + ' hours-prioritised officer' + (additions.length === 1 ? '' : 's') +
      ' staged; ' + current.model.shortage + ' crew vacancies remain. Review before saving.';
    this.renderModal();
    return { success: true, selectedIds: additions.slice(), shortage: current.model.shortage };
  };
}());
