// Saved, detached occurrence context. This module exposes no allocation commands.
(function () {
  'use strict';
  var app = window.HortOpsApp;
  function read(shiftId) {
    if (typeof shiftId !== 'string' || !/^.+@\d{4}-\d{2}-\d{2}$/.test(shiftId)) throw new Error('A canonical occurrence is required.');
    var storage = window.HortOpsStorage;
    if (!storage || typeof storage.readVerifiedCommittedV2 !== 'function') throw new Error('Saved workspace verification is unavailable.');
    var saved = storage.readVerifiedCommittedV2();
    if (!saved || !saved.ok) throw new Error((saved && saved.error) || 'The saved workspace cannot be verified.');
    if (!saved.exists) throw new Error('Save the workspace before previewing candidates.');
    return saved;
  }
  function signature(saved, shiftId) {
    var live = app.state || {};
    var writer = window.HortOpsWriterSession;
    var today = window.HortOpsDateUtils.getLocalDateKey();
    // A live domain change invalidates an open result even when it is not saved.
    // The next preview still uses saved data; editor models are never adopted.
    return JSON.stringify([shiftId, saved.raw, today, live.currentYear,
      writer ? writer.status().generation : 0,
      live.jobs, live.staffList, live.poolTags, live.absences, live.refusalHistory,
      live.customAssignments, live.historicalSnapshots, live.rostering, live.customPermits]);
  }
  app.getSavedCandidatePreviewSignature = function (shiftId) {
    return signature(read(shiftId), shiftId);
  };
  app.getSavedCandidatePreviewContext = function (shiftId) {
    var saved = read(shiftId);
    var state = JSON.parse(JSON.stringify(saved.data));
    state.staffList = state.roster || [];
    state.customAssignments = state.assignments || {};
    state.customPermits = state.permits || {};
    state.historicalSnapshots = state.historicalSnapshots || {};
    state.jobs = state.jobs || [];
    state.poolTags = state.poolTags || [];
    state.absences = state.absences || [];
    state.refusalHistory = state.refusalHistory || [];
    var engine = window.HortOpsSchedulerEngine;
    if (!engine || typeof engine.generateOperationalDigest !== 'function') throw new Error('The occurrence scheduler is unavailable.');
    var year = Number(shiftId.slice(-10, -6));
    function generate(targetYear) {
      return engine.generateOperationalDigest(state.jobs, targetYear, true,
        state.customAssignments, state.staffList, state.customPermits,
        state.historicalSnapshots, true);
    }
    var digest = generate(year);
    if (!digest || !Array.isArray(digest.allShifts)) throw new Error('Saved occurrences cannot be resolved.');
    var allShifts = digest.allShifts;
    var occurrence = allShifts.find(function (shift) { return shift.shiftId === shiftId; });
    if (!occurrence) throw new Error('This occurrence is no longer present in the saved workspace.');
    var monthDay = occurrence.date.slice(5, 10);
    if (monthDay <= '01-03' || monthDay >= '12-29') {
      // Use the allocation boundary window and canonical generator, without
      // populating or consuming its live-state boundary cache.
      try {
        var early = monthDay <= '01-03';
        var adjacentYear = early ? year - 1 : year + 1;
        var adjacent = generate(adjacentYear);
        if (!adjacent || !Array.isArray(adjacent.allShifts)) throw new Error('Adjacent occurrences cannot be resolved.');
        adjacent.allShifts.forEach(function (shift) {
          var within = early ? shift.date >= adjacentYear + '-12-29' : shift.date <= adjacentYear + '-01-03';
          if (within && !allShifts.some(function (other) { return other.shiftId === shift.shiftId; })) allShifts.push(shift);
        });
      } catch (error) {
        allShifts.lookupFailed = true;
        allShifts.errorMessage = error.message;
      }
    }
    return { state: state, occurrence: occurrence,
      job: state.jobs.find(function (job) { return job.id === occurrence.jobId; }) || null,
      allShifts: allShifts, signature: signature(saved, shiftId) };
  };
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('button[data-candidate-preview]');
    if (!button || button.disabled) return;
    event.preventDefault(); event.stopPropagation();
    window.HortOpsCandidatePreviewModal.open(button.getAttribute('data-candidate-preview'));
  }, true);
  var render = app.renderCurrentView;
  app.renderCurrentView = function () {
    var result = render.apply(this, arguments);
    window.HortOpsCandidatePreviewModal.checkFreshness();
    return result;
  };
}());
