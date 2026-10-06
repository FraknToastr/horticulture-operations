'use strict';
// The capability stays in this closure: imported state cannot grant ownership.
(function () {
  var mode = 'starting', reason = 'Checking exclusive workspace ownership';
  var held = null, request = null, pending = false, generation = 0, active = 0, releaseWanted = false;
  var key = window.HortOpsClientStorage.workspaceKey;
  var lockName = 'hort-ops:workspace-writer:' + key;
  var app = window.HortOpsApp, driver = window.HortOpsStorageDriver, storage = window.HortOpsStorage;
  // Retain logical artifact identities; the adapter maps these to the new key.
  driver.WORKSPACE_STORAGE_KEY = storage.WORKSPACE_STORAGE_KEY;
  var originalInit = app.init;
  function canWrite() { return mode === 'writer' && !!held && !releaseWanted; }
  function status() { return { mode: mode, reason: reason, pending: pending, generation: generation }; }
  function denied() { return { success: false, ok: false, status: 'blocked-read-only', storageMode: 'unchanged', error: 'Workspace is read-only. Exclusive editing ownership is required.' }; }
  function finishRelease() {
    if (active) return;
    mode = 'read-only'; releaseWanted = false;
    if (held) { var resolve = held; held = null; resolve(); }
  }
  function guard(object, names) {
    names.forEach(function(name) {
      if (typeof object[name] !== 'function') throw new Error('Missing guarded write boundary: ' + name);
      var original = object[name];
      object[name] = function() {
        if (!canWrite() && !active) {
          if ((object === app && ['saveCurrentWorkspace','restoreWorkspaceJson','resetToCleanSlate','updateShiftStaff'].indexOf(name) !== -1) || name === 'resetWorkspace') return false;
          return denied();
        }
        active++;
        try { return original.apply(this, arguments); }
        finally { active--; if (releaseWanted) finishRelease(); }
      };
    });
  }
 guard(app, ['init', '_commitCanonicalProposal', 'saveCurrentWorkspace', 'updatePermit', 'updateShiftStaff', 'saveJob', 'deleteJob', 'resetJobAllocations', 'restoreWorkspaceJson', 'resetToCleanSlate', 'reconcileStaffSnapshot', 'importStaffMembers', 'updateStaffMember', 'recordOvertimeHoursEvidence', 'handleAutoStagger', 'saveAbsenceAndRefusalData', 'openStaffAssignModal', 'openAddJobModal', 'openEditJobModal', 'openImportModal', 'openResetWorkspaceModal']);
  guard(storage, ['set', 'remove', 'resetWorkspace', 'restoreEmergencyRecoveryArtifact', 'recordParentEvidenceInspected', 'recordParentEvidenceExportInitiated', 'acknowledgeParentPriorEvidence', 'retireCompositeParentBundle', 'compactStorage', 'importWorkspaceJson', 'saveWorkspace']);
  guard(driver, ['set', 'remove', '_restoreRawStorageSnapshot', '_restoreEmergencyRecoveryMetadata', '_stageTransactionRecoveryBundle', '_stageEmergencyRecoveryArtifact', '_executeCompensatingRollback', 'resetWorkspace', 'restoreEmergencyRecoveryArtifact', 'retireCompositeParentBundle', 'recordParentEvidenceInspected', 'recordParentEvidenceExportInitiated', 'acknowledgeParentPriorEvidence', 'compactStorage']);
  guard(app, ['setPlanningRange','applyPlanningRange']);
  var editorBoundaries = [
    [window.HortOpsStaffAssignModal, ['open','addStaff','openActiveContinuation','removeStaff','removeAllUnaccredited','removeAllFatigued','removeAllIneligible','autoFillTeam','autoAddEligible','applyHoursProposal','approveMixedPolicyPlan','setPoolTag','updatePermit','updatePermitNotes','updateSlotMode','updateSlotRepeat','saveAllocation']],
    [window.HortOpsHoursEvidenceModal, ['open','save']],
    [window.HortOpsHoursAllocationModal, ['open','apply']],
    [window.HortOpsMixedPolicyPlanModal, ['open','approve']],
    [window.HortOpsStaffExemptionModal, ['open','toggleExempt','setPreset','save']],
    [window.HortOpsStaffQualificationModal, ['open','addQualification','removeQualification','save']],
    [window.HortOpsStaffAbsenceModal, ['open','addAbsence','updateAbsence','removeAbsence','addRefusal','updateRefusal','removeRefusal','save','saveDirect']],
    [window.HortOpsAbsenceImpactModal, ['open','approve','saveAbsenceOnly']],
    [window.HortOpsJobEditModal, ['open','handleSubmit','setPlanningField','togglePatternDay','setPoolSource','togglePoolTag','setStaffingSection','setFrequencyType','setRecurrenceField','setRecurrenceDay']],
    [window.HortOpsStaffPoolModal, ['open','save','createTag','setTagActive','setMembership']],
    [window.HortOpsImportModal, ['open','handleFileSelect','processJsonContent','processCsvContent','confirmSync','confirmJsonRestore']],
    [window.HortOpsResetWorkspaceModal, ['open','executeReset']]
  ];
  editorBoundaries.forEach(function(entry) { guard(entry[0], entry[1]); });
  // Recovery is current namespace/current schema only, including direct driver calls.
  var restore = driver.restoreEmergencyRecoveryArtifact;
  driver.restoreEmergencyRecoveryArtifact = function(input, options) {
    var candidate = input;
    try { if (typeof candidate === 'string') candidate = JSON.parse(candidate); } catch (error) { return {success:false, status:'restore_preflight_failed', error:error.message}; }
    var checked = window.HortOpsRecoveryArtifact.validateEmergencyRecoveryArtifact(candidate && candidate.currentWorkspaceRecoveryArtifact || candidate);
    if (!checked.valid) return { success: false, status: 'restore_preflight_failed', error: checked.error };
    var snapshot = checked.artifact.storageSnapshot;
    for (var name in snapshot) {
      if (name === storage.WORKSPACE_STORAGE_KEY) {
        if (!storage.prepareWorkspaceJsonImport(snapshot[name]).success) return { success: false, error: 'Recovery requires current Schema v2 workspace data' };
      } else if (/workspace_v[12]/.test(name)) {
        return { success: false, error: 'Legacy workspace recovery is not supported in this client' };
      }
    }
    return restore.call(this, input, options);
  };
  var health = driver.getStorageHealth;
  driver.getStorageHealth = function() {
    if (canWrite()) return health.call(this);
    return { status: 'read-only', probeOk: false, usedBytes: 0, workspaceBytes: 0, percentUsed: 0, lastSaved: app.state && app.state.lastSaved };
  };
  function readOnlyAction(element) {
    if (element.closest('#export-modal-root, #warnings-modal-root, #storage-health-modal-root')) return true;
    var button = element.closest('button');
    if (button && button.hasAttribute('data-candidate-preview')) return true;
    if (button && button.closest('#candidate-preview-modal-root') && /^(refresh|close)$/.test(button.getAttribute('data-candidate-preview-action') || '')) return true;
    var action = button && button.getAttribute('onclick') || '';
    return /\.(close|copyQuarantinePayload|exportQuarantineFile|exportParentEvidence)\(/.test(action);
  }
  function decorate() {
    if (typeof document === 'undefined') return;
    var panel = document.getElementById('workspace-ownership');
    if (!panel) return;
    panel.replaceChildren();
    var text = document.createElement('span');
    text.textContent = canWrite() ? 'Editing this workspace' : 'Read-only — ' + reason;
    panel.appendChild(text);
    var button = document.createElement('button');
    button.type = 'button'; button.className = 'btn';
    button.textContent = canWrite() ? 'Release editing' : 'Try editing';
    button.disabled = pending || mode === 'starting';
    button.addEventListener('click', function() { if (canWrite()) release(); else acquire(); });
    panel.appendChild(button);
    var readonly = !canWrite();
    document.querySelectorAll('#content-mount input, #content-mount select, #content-mount textarea, #content-mount button, [id$="-modal-root"] input, [id$="-modal-root"] select, [id$="-modal-root"] textarea, [id$="-modal-root"] button').forEach(function(element) {
      if (readOnlyAction(element)) return;
      if (readonly && !element.disabled) { element.dataset.writerDisabled = 'true'; element.disabled = true; }
      else if (!readonly && element.dataset.writerDisabled) { element.disabled = false; delete element.dataset.writerDisabled; }
    });
    ['btn-header-reset-workspace','btn-header-import','btn-header-add-job'].forEach(function(id) { var el = document.getElementById(id); if (el) el.disabled = readonly; });
  }
  var render = app.renderCurrentView;
  app.renderCurrentView = function() { var value = render.apply(this, arguments); decorate(); return value; };
  ['click','change','input','submit'].forEach(function(name) {
    document.addEventListener(name, function(event) {
      if (canWrite() || !event.target.closest) return;
      var protectedArea = event.target.closest('#content-mount, [id$="-modal-root"]');
      if (protectedArea && !readOnlyAction(event.target)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
  });
  var exportBackup = window.HortOpsExportModal.exportBackupJson;
  window.HortOpsExportModal.exportBackupJson = function() {
    if (canWrite()) return exportBackup.apply(this, arguments);
    var committed = storage.readVerifiedCommittedV2();
    if (!committed.ok || !committed.exists || !committed.raw) return false;
    this.downloadFile(committed.raw, 'hort-ops-workspace-backup-' + app.state.currentYear + '.json', 'application/json');
    return true;
  };
  ['setActiveView', 'setYear'].forEach(function(name) {
    var original = app[name];
    app[name] = function(value) {
      if (canWrite()) return original.call(this, value);
      if (name === 'setActiveView') this.state.activeView = value;
      else { this.state.currentYear = parseInt(value, 10); this.recomputeDigest(); }
      this.renderCurrentView();
    };
  });
  function load() {
    // Driver isolation still protects memory-only recovery following failed reset.
    var isolation = driver._checkUnresolvedEmergencyIsolation();
    app._autosaveBlocked = !!isolation.hasUnresolvedIsolation;
    originalInit.call(app);
    decorate();
  }
  function release() {
    generation++; releaseWanted = true; reason = 'Editing was released. Try editing to reload the latest saved workspace.';
    window.HortOpsCandidatePreviewModal.close();
    // Discard editor models as well as their DOM. A retained save callback must
    // not regain access to an old form when this tab later reacquires editing.
    editorBoundaries.forEach(function(entry) { entry[0].close(); });
    document.querySelectorAll('[id$="-modal-root"]').forEach(function(root) { root.replaceChildren(); });
    while (window.HortOpsModalUtils.getActiveModalCount() > 0) window.HortOpsModalUtils.unlockBackgroundScroll();
    finishRelease(); decorate();
    return request ? request.catch(function() {}) : Promise.resolve();
  }
  function acquire() {
    if (canWrite() || pending) return Promise.resolve(status());
    window.HortOpsCandidatePreviewModal.close();
    var attempt = generation;
    pending = true; mode = 'starting'; reason = 'Checking exclusive workspace ownership'; decorate();
    return new Promise(function(ready) {
      var settled = false;
      function finish() { pending = false; if (!settled) { settled = true; ready(status()); } decorate(); }
      function unavailable(message) { mode = 'read-only'; reason = message; load(); finish(); }
      try {
        if (!window.isSecureContext || !navigator.locks || typeof navigator.locks.request !== 'function') {
          unavailable('This browser cannot coordinate safe editing.'); return;
        }
        request = navigator.locks.request(lockName, { mode: 'exclusive', ifAvailable: true }, function(lock) {
          if (attempt !== generation) { mode = 'read-only'; finish(); return; }
          if (!lock) { unavailable('Another tab is editing this workspace.'); return; }
          return new Promise(function(resolve) {
            held = resolve; mode = 'writer'; reason = '';
            try { load(); finish(); }
            catch (error) { releaseWanted = true; finishRelease(); reason = 'Workspace could not be loaded safely.'; finish(); }
          });
        });
        request.catch(function() { held = null; unavailable('Browser denied exclusive editing ownership.'); });
      } catch (error) { unavailable('Browser denied exclusive editing ownership.'); }
    });
  }
  Object.defineProperty(window, 'HortOpsWriterSession', { value: Object.freeze({
    canWrite: canWrite, status: status, acquire: acquire, release: release,
    canPersist: function() { return !!held && (canWrite() || active > 0); },
    start: acquire
  }), writable: false, configurable: false });
  window.addEventListener('pagehide', release);
  window.addEventListener('pageshow', function(event) { if (event.persisted) acquire(); });
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(decorate);
    document.querySelectorAll('#header-mount, #content-mount, [id$="-modal-root"]').forEach(function(root) { observer.observe(root, {childList:true, subtree:true}); });
  }
}());
