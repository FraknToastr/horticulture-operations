// Main Application Controller & State Store
window.HortOpsApp = {
  state: {
    schemaVersion: 2,
    activeView: 'forward_planner',
    currentYear: 2026,
    jobs: [],
    staffList: [],
    customAssignments: {},
    customPermits: {},
    historicalSnapshots: {},
    rostering: { instructions: {}, provenance: {} },
    budgetSettings: { annualTarget: 0, defaultStandardHoursPerShift: 8 },
    slots: [],
    allShifts: [],
    clashCount: 0
  },

  init: function() {
    var storage = window.HortOpsStorage;
    var data = window.HortOpsData;
    var scheduler = window.HortOpsScheduler;

    // Load unified workspace envelope (B1)
    var ws = storage.loadWorkspace([], [], scheduler.DEFAULT_BUDGET_SETTINGS);
    this.state = this.state || {};
    this.state.schemaVersion = 2;
    this.state.jobs = ws.jobs;
    this.state.staffList = ws.roster;
    this.state.customAssignments = ws.assignments;
    this.state.rostering = ws.rostering || { instructions: {}, provenance: {} };
    this.state.historicalSnapshots = (ws.historicalSnapshots && typeof ws.historicalSnapshots === 'object' && !Array.isArray(ws.historicalSnapshots)) ? ws.historicalSnapshots : {};
    this._authoritativeSnapshotCount = (this.state.historicalSnapshots && typeof this.state.historicalSnapshots === 'object') ? Object.keys(this.state.historicalSnapshots).length : 0;
    this._allowHistoryReset = false;
    this.state.customPermits = ws.permits;
    this.state.budgetSettings = ws.budgetSettings;
    this.state.recoveryRequired = Boolean(ws.recoveryRequired);
    this.state.recoverySource = ws.recoveryRequired ? ws.recoverySource : null;
    this.state.recoveryError = ws.recoveryRequired ? ws.recoveryError : null;

    // Check for emergency recovery payload staged in sessionStorage from prior unrecovered reset
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        var emergencyPayload = window.sessionStorage.getItem('hort_ops_emergency_recovery_v2');
        if (emergencyPayload && (!ws || !ws.jobs || ws.jobs.length === 0)) {
          this.state.emergencyRecoveryPayload = emergencyPayload;
          this.state.recoveryRequired = true;
          this.state.recoverySource = 'emergency_session_backup';
          this.state.recoveryError = 'Detected unrecovered partial reset from prior session. Emergency backup staged for manual restoration.';
        }
      }
    } catch(e) {}

    if (ws.uiState) {
      var validViews = ['forward_planner', 'calendar', 'job_manager', 'staff_registry', 'peak_weekends', 'analytics'];
      if (ws.uiState.activeView && validViews.indexOf(ws.uiState.activeView) !== -1) {
        this.state.activeView = ws.uiState.activeView;
      }
      if (ws.uiState.currentYear && typeof ws.uiState.currentYear === 'number' && ws.uiState.currentYear >= 2020 && ws.uiState.currentYear <= 2040) {
        this.state.currentYear = ws.uiState.currentYear;
      }
    }

    this.recomputeDigest();
    this.renderCurrentView();
  },

  _commitCanonicalProposal: function(proposalOverrides) {
    try {
      if (this._autosaveBlocked) {
        console.warn('Workspace save blocked: persistent storage is safeguarded following reset failure.');
        return { success: false, error: 'Autosave blocked following reset failure' };
      }
      if (this.state && this.state.recoveryRequired) {
        console.warn('Auto-save suspended: workspace in recoveryRequired state. User must explicitly resolve recovery.');
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Workspace in recoveryRequired state' };
      }

      if (this.state && !this.state.schemaVersion) {
        this.state.schemaVersion = 2;
      }

      proposalOverrides = proposalOverrides || {};
      var own = Object.prototype.hasOwnProperty;

      // Authoritative canonical domains: distinguish omitted from explicitly null/invalid; NEVER coerce with truthy defaults
      var proposedJobs;
      if (own.call(proposalOverrides, 'jobs')) {
        proposedJobs = proposalOverrides.jobs;
      } else if (this.state && own.call(this.state, 'jobs')) {
        proposedJobs = this.state.jobs;
      } else {
        proposedJobs = [];
      }

      var proposedRoster;
      if (own.call(proposalOverrides, 'roster')) {
        proposedRoster = proposalOverrides.roster;
      } else if (this.state && own.call(this.state, 'roster')) {
        proposedRoster = this.state.roster;
      } else if (this.state && own.call(this.state, 'staffList')) {
        proposedRoster = this.state.staffList;
      } else {
        proposedRoster = [];
      }

      var proposedAssignments;
      if (own.call(proposalOverrides, 'assignments')) {
        proposedAssignments = proposalOverrides.assignments;
      } else if (this.state && own.call(this.state, 'assignments')) {
        proposedAssignments = this.state.assignments;
      } else if (this.state && own.call(this.state, 'customAssignments')) {
        proposedAssignments = this.state.customAssignments;
      } else {
        proposedAssignments = {};
      }

      var proposedRostering;
      if (own.call(proposalOverrides, 'rostering')) {
        proposedRostering = proposalOverrides.rostering;
      } else if (this.state && own.call(this.state, 'rostering')) {
        proposedRostering = this.state.rostering;
      } else {
        proposedRostering = { instructions: {}, provenance: {} };
      }

      var proposedSnapshots;
      if (own.call(proposalOverrides, 'historicalSnapshots')) {
        proposedSnapshots = proposalOverrides.historicalSnapshots;
      } else if (this.state && own.call(this.state, 'historicalSnapshots')) {
        proposedSnapshots = this.state.historicalSnapshots;
      } else {
        proposedSnapshots = {};
      }

      var proposedPermits;
      if (own.call(proposalOverrides, 'permits')) {
        proposedPermits = proposalOverrides.permits;
      } else if (this.state && own.call(this.state, 'permits')) {
        proposedPermits = this.state.permits;
      } else if (this.state && own.call(this.state, 'customPermits')) {
        proposedPermits = this.state.customPermits;
      } else {
        proposedPermits = {};
      }

      var proposedBudget;
      if (own.call(proposalOverrides, 'budgetSettings')) {
        proposedBudget = proposalOverrides.budgetSettings;
      } else if (this.state && own.call(this.state, 'budgetSettings')) {
        proposedBudget = this.state.budgetSettings;
      } else {
        proposedBudget = (window.HortOpsScheduler && window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS) || { annualTarget: 0, defaultStandardHoursPerShift: 8 };
      }

      var proposedUiState;
      if (own.call(proposalOverrides, 'uiState')) {
        proposedUiState = proposalOverrides.uiState;
      } else if (this.state && own.call(this.state, 'uiState')) {
        proposedUiState = this.state.uiState;
      } else {
        proposedUiState = {
          activeView: (this.state && this.state.activeView) || 'forward_planner',
          currentYear: (this.state && this.state.currentYear) || 2026
        };
      }

      // Fail-closed negative validation: reject explicitly null or malformed structures before any state or storage mutation
      if (proposedJobs === null || !Array.isArray(proposedJobs)) {
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Missing or invalid "jobs" array in workspace' };
      }
      if (proposedRoster === null || !Array.isArray(proposedRoster)) {
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Missing or invalid "roster" array in workspace' };
      }
      if (proposedAssignments === null || typeof proposedAssignments !== 'object' || Array.isArray(proposedAssignments)) {
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Missing or invalid "assignments" map in workspace' };
      }
      if (proposedRostering === null || typeof proposedRostering !== 'object' || Array.isArray(proposedRostering)) {
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Missing or invalid "rostering" state in workspace' };
      }
      if (proposedSnapshots === null || typeof proposedSnapshots !== 'object' || Array.isArray(proposedSnapshots)) {
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Missing or invalid "historicalSnapshots" map in workspace' };
      }
      if (proposedPermits === null || typeof proposedPermits !== 'object' || Array.isArray(proposedPermits)) {
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Missing or invalid "permits" map in workspace' };
      }
      if (proposedBudget === null || typeof proposedBudget !== 'object' || Array.isArray(proposedBudget)) {
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Missing or invalid "budgetSettings" object in workspace' };
      }
      if (proposedUiState === null || typeof proposedUiState !== 'object' || Array.isArray(proposedUiState)) {
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Missing or invalid "uiState" object in workspace' };
      }

      // Protocol v2 Invariant A: validate complete current-v2 presence on live state
      var validator = window.HortOpsSchemaValidator;
      if (validator && typeof validator.validateCurrentV2Presence === 'function') {
        var runtimeCandidate = {
          schemaVersion: 2,
          jobs: proposedJobs,
          roster: proposedRoster,
          customAssignments: proposedAssignments,
          rostering: proposedRostering,
          historicalSnapshots: proposedSnapshots
        };
        var presenceCheck = validator.validateCurrentV2Presence(
          runtimeCandidate,
          { inputKind: 'runtime_state' }
        );
        if (!presenceCheck.valid) {
          console.error('Cannot save workspace: ' + presenceCheck.error);
          if (this.state) this.state.storageStatus = 'save_failed';
          return { success: false, error: presenceCheck.error };
        }
      } else {
        if (!proposedSnapshots || typeof proposedSnapshots !== 'object' || Array.isArray(proposedSnapshots)) {
          console.error('Cannot save workspace: historicalSnapshots state is missing or malformed.');
          if (this.state) this.state.storageStatus = 'save_failed';
          return { success: false, error: 'historicalSnapshots state is missing or malformed' };
        }
      }

      // Review 11 Mandatory Baseline Reader & Evidence-Loss Guard (R11-01)
      var currentSnapKeys = Object.keys(proposedSnapshots);
      var prevCount = (typeof this._authoritativeSnapshotCount === 'number') ? this._authoritativeSnapshotCount : 0;
      var prevStoredSnapshots = null;
      var storage = window.HortOpsStorage;
      if (!storage || typeof storage.saveWorkspace !== 'function' || typeof storage.readVerifiedCommittedV2 !== 'function') {
        console.error('Cannot save workspace: storage baseline reader or save function unavailable.');
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Storage baseline reader or save function unavailable' };
      }
      var committed = storage.readVerifiedCommittedV2();
      if (!committed || !committed.ok) {
        console.error('Cannot save workspace: ' + (committed ? committed.error : 'Storage baseline unreadable'));
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: committed ? committed.error : 'Storage baseline unreadable' };
      }

      if (committed.exists && committed.data && committed.data.historicalSnapshots) {
        prevStoredSnapshots = committed.data.historicalSnapshots;
        var storedCount = Object.keys(prevStoredSnapshots).length;
        if (storedCount > prevCount) {
          prevCount = storedCount;
        }
      }

      if (!this._allowHistoryReset && prevCount > 0) {
        if (currentSnapKeys.length === 0) {
          console.error('Cannot save workspace: suspicious evidence loss detected. Live historicalSnapshots is empty ({}) while established workspace contains ' + prevCount + ' authoritative snapshot records. Save aborted to preserve historical evidence.');
          if (this.state) this.state.storageStatus = 'save_failed';
          return { success: false, error: 'Suspicious evidence loss: snapshot count is 0' };
        }
        if (prevStoredSnapshots && typeof prevStoredSnapshots === 'object') {
          var snapCheck = (validator && typeof validator.missingIdentityKeys === 'function')
            ? validator.missingIdentityKeys(prevStoredSnapshots, proposedSnapshots, 'historicalSnapshots')
            : { valid: true };
          if (!snapCheck.valid) {
            console.error('Cannot save workspace: suspicious partial evidence loss detected: ' + snapCheck.error + '. Save aborted.');
            if (this.state) this.state.storageStatus = 'save_failed';
            return { success: false, error: snapCheck.error };
          }
        }
      }

      // Gate B1: Canonical constructor is mandatory; fail closed if unavailable
      if (!storage || typeof storage.createWorkspaceEnvelope !== 'function') {
        console.error('Cannot save workspace: canonical envelope constructor unavailable.');
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Canonical envelope constructor unavailable' };
      }

      var candidateEnvelope = {
        schemaVersion: 2
      };
      if (proposedJobs !== undefined) candidateEnvelope.jobs = proposedJobs;
      if (proposedRoster !== undefined) candidateEnvelope.roster = proposedRoster;
      if (proposedAssignments !== undefined) candidateEnvelope.assignments = proposedAssignments;
      if (proposedRostering !== undefined) candidateEnvelope.rostering = proposedRostering;
      if (proposedSnapshots !== undefined) candidateEnvelope.historicalSnapshots = proposedSnapshots;
      if (proposedPermits !== undefined) candidateEnvelope.permits = proposedPermits;
      if (proposedBudget !== undefined) candidateEnvelope.budgetSettings = proposedBudget;
      if (proposedUiState !== undefined) candidateEnvelope.uiState = proposedUiState;

      var envelope = storage.createWorkspaceEnvelope(candidateEnvelope);

      var res = storage.saveWorkspace(envelope);
      this.state.storageStatus = (res && res.ok) ? 'saved' : ((res && res.storageMode === 'session-only') ? 'session_only' : 'save_failed');
      if (!res || !res.ok) {
        return { success: false, error: (res && res.error) ? res.error : 'Storage write failed' };
      }

      return {
        success: true,
        storageMode: res.storageMode,
        envelope: envelope,
        snapshotCount: currentSnapKeys.length
      };
    } catch(e) {
      console.error('Failed to save current workspace:', e);
      if (this.state) this.state.storageStatus = 'save_failed';
      return { success: false, error: e.message || String(e) };
    }
  },

  saveCurrentWorkspace: function() {
    var res = this._commitCanonicalProposal({});
    if (!res.success) {
      return false;
    }
    this._authoritativeSnapshotCount = res.snapshotCount;
    return true;
  },

  recomputeDigest: function() {
    var scheduler = window.HortOpsScheduler;
    var digest = scheduler.generateOperationalDigest(
      this.state.jobs,
      this.state.currentYear || 2026,
      true,
      this.state.customAssignments,
      this.state.staffList,
      this.state.customPermits
    );

    this.state.slots = digest.slots;
    this.state.allShifts = digest.allShifts;
    this.state.integrityIssues = digest.integrityIssues || [];

    // Calculate clash count
    var count = 0;
    digest.slots.forEach(function(s) {
      if (s.isOverloaded || s.hasArterialConflict) count++;
    });
    this.state.clashCount = count;
  },

  updatePermit: function(shiftOrOccurrenceId, updates) {
    if (!shiftOrOccurrenceId || typeof shiftOrOccurrenceId !== 'string') {
      return { success: false, error: 'Invalid shift or occurrence ID' };
    }
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return { success: false, error: 'Invalid permit updates payload' };
    }
    // Deep clone updates to ensure caller isolation (B3-ALIAS / R22-02)
    var clonedUpdates = JSON.parse(JSON.stringify(updates));

    var proposedPermits = {};
    var currentPermits = this.state.customPermits || {};
    for (var pKey in currentPermits) {
      if (currentPermits.hasOwnProperty(pKey) && currentPermits[pKey]) {
        proposedPermits[pKey] = JSON.parse(JSON.stringify(currentPermits[pKey]));
      }
    }
    if (!proposedPermits[shiftOrOccurrenceId]) {
      proposedPermits[shiftOrOccurrenceId] = {};
    }
    for (var k in clonedUpdates) {
      if (clonedUpdates.hasOwnProperty(k)) {
        proposedPermits[shiftOrOccurrenceId][k] = clonedUpdates[k];
      }
    }

    var commitRes = this._commitCanonicalProposal({ permits: proposedPermits });
    if (!commitRes.success) {
      return commitRes;
    }

    // Adopt fully detached clone to guarantee caller mutation isolation
    this.state.customPermits = JSON.parse(JSON.stringify(proposedPermits));
    this.state.storageStatus = (commitRes.storageMode === 'session-only') ? 'session_only' : 'saved';
    this.recomputeDigest();
    this.renderCurrentView();
    return { success: true };
  },

  renderCurrentView: function() {
    if (typeof document === 'undefined') return;
    var headerMount = document.getElementById('header-mount');
    var contentMount = document.getElementById('content-mount');
    if (!headerMount || !contentMount) return;

    headerMount.innerHTML = window.HortOpsHeader.render(this.state);

    var viewHtml = '';
    var view = this.state.activeView;

    if (view === 'forward_planner') {
      viewHtml = window.HortOpsForwardPlanner.render(this.state);
    } else if (view === 'calendar') {
      viewHtml = window.HortOpsCalendarView.render(this.state);
    } else if (view === 'job_manager') {
      viewHtml = window.HortOpsJobRegistry.render(this.state);
    } else if (view === 'staff_registry') {
      viewHtml = window.HortOpsStaffRegistry.render(this.state);
    } else if (view === 'peak_weekends') {
      viewHtml = window.HortOpsPeakWeekends.render(this.state);
    } else if (view === 'analytics') {
      viewHtml = window.HortOpsAnalytics.render(this.state);
    }

    contentMount.innerHTML = viewHtml;
  },

  setActiveView: function(viewId) {
    this.state.activeView = viewId;
    this.renderCurrentView();
    this.saveCurrentWorkspace();
  },

  setYear: function(year) {
    this.state.currentYear = parseInt(year, 10) || year;
    this.recomputeDigest();
    this.renderCurrentView();
    this.saveCurrentWorkspace();
  },

  updateShiftStaff: function(shiftId, assignedStaffIds) {
    console.warn('HortOpsApp.updateShiftStaff is deprecated and fails closed: schedule assignments must be allocated via HortOpsStaffAssignModal or canonical B2 operations with authoritative scheduled-commitment snapshots.');
    return false;
  },

  saveJob: function(jobData) {
    if (!jobData || !jobData.id) return { success: false, error: 'Invalid job data' };
    var detachedJobData = JSON.parse(JSON.stringify(jobData));

    var existingJob = this.state.jobs.find(function(j) { return j.id === detachedJobData.id; });

    var instructionsToSeal = [];
    if (existingJob && window.HortOpsJobEditFormValidator && typeof window.HortOpsJobEditFormValidator.validateRecurrenceCompatibility === 'function') {
      var compat = window.HortOpsJobEditFormValidator.validateRecurrenceCompatibility(existingJob, detachedJobData, this.state);
      if (!compat.valid) {
        console.warn('Job recurrence change blocked by active future rostering guard:', compat.message);
        return { success: false, error: compat.message };
      }
      if (compat.instructionsToSeal && Array.isArray(compat.instructionsToSeal)) {
        instructionsToSeal = compat.instructionsToSeal;
      }
    }

    // Offline17.5h & Gate B3: Transactional sealing of exhausted active instructions during retirement
    var proposedJobs = JSON.parse(JSON.stringify(this.state.jobs || []));
    var proposedRostering = JSON.parse(JSON.stringify(this.state.rostering || { instructions: {}, provenance: {} }));
    var proposedInstructions = proposedRostering.instructions || {};

    for (var sIdx = 0; sIdx < instructionsToSeal.length; sIdx++) {
      var sealId = instructionsToSeal[sIdx];
      if (proposedInstructions[sealId]) {
        proposedInstructions[sealId].status = 'historical';
      }
    }

    var idx = proposedJobs.findIndex(function(j) { return j.id === detachedJobData.id; });
    if (idx !== -1) {
      proposedJobs[idx] = detachedJobData;
    } else {
      proposedJobs.push(detachedJobData);
    }

    var commitRes = this._commitCanonicalProposal({
      jobs: proposedJobs,
      rostering: proposedRostering
    });
    if (!commitRes.success) {
      console.warn('saveJob in-memory mutation rolled back due to storage failure.');
      return { success: false, error: 'Workspace save failed. Job edit rolled back.' };
    }

    this.state.jobs = proposedJobs;
    this.state.rostering = proposedRostering;
    this.state.storageStatus = (commitRes.storageMode === 'session-only') ? 'session_only' : 'saved';
    this.recomputeDigest();
    this.renderCurrentView();
    return { success: true, instructionsSealed: instructionsToSeal };
  },

  getJobDependencies: function(jobId, state) {
    state = state || this.state;
    var assignmentsCount = 0;
    var permitsCount = 0;
    var occurrencesCount = 0;
    var rosteringInstructionsCount = 0;
    var rosteringProvenanceCount = 0;
    var historicalSnapshotsCount = 0;

    // Canonical occurrence dependencies tracked via workspace-owned historicalSnapshots
    var occurrencesCount = 0;

    var customAssignments = state.customAssignments || {};
    Object.keys(customAssignments).forEach(function(k) {
      if (k.indexOf(jobId + '@') === 0 ||
          k.indexOf(jobId + '_') === 0 ||
          k.indexOf(jobId + '-w') === 0 ||
          k.indexOf(jobId + '-oneoff-') === 0) {
        if ((customAssignments[k] || []).length > 0) assignmentsCount++;
      }
    });

    var customPermits = state.customPermits || {};
    Object.keys(customPermits).forEach(function(k) {
      if (k.indexOf(jobId + '@') === 0 ||
          k.indexOf(jobId + '_') === 0 ||
          k.indexOf(jobId + '-w') === 0 ||
          k.indexOf(jobId + '-oneoff-') === 0) {
        permitsCount++;
      }
    });

    // Offline17.5g: Rostering instructions and provenance are formal Job dependencies
    var rostering = state.rostering || {};
    var instructions = rostering.instructions || {};
    Object.keys(instructions).forEach(function(instId) {
      var inst = instructions[instId];
      if (inst && inst.jobId === jobId) {
        rosteringInstructionsCount++;
      }
    });

    var provenance = rostering.provenance || {};
    Object.keys(provenance).forEach(function(provKey) {
      var prov = provenance[provKey];
      if (!prov) return;
      var matches = false;
      if (prov.sourceShiftId && (
          prov.sourceShiftId.indexOf(jobId + '@') === 0 ||
          prov.sourceShiftId.indexOf(jobId + '_') === 0 ||
          prov.sourceShiftId.indexOf(jobId + '-w') === 0 ||
          prov.sourceShiftId.indexOf(jobId + '-oneoff-') === 0)) {
        matches = true;
      } else if (prov.instructionId && instructions[prov.instructionId] && instructions[prov.instructionId].jobId === jobId) {
        matches = true;
      }
      if (matches) {
        rosteringProvenanceCount++;
      }
    });

    // Gate B3 / FR-01: Historical scheduled-commitment snapshots are authoritative dependencies
    var historicalSnapshots = state.historicalSnapshots || {};
    Object.keys(historicalSnapshots).forEach(function(snapKey) {
      var snap = historicalSnapshots[snapKey];
      if (!snap) return;
      var matches = false;
      if (snap.jobId === jobId) {
        matches = true;
      } else if (snap.shiftId && (
          snap.shiftId.indexOf(jobId + '@') === 0 ||
          snap.shiftId.indexOf(jobId + '_') === 0 ||
          snap.shiftId.indexOf(jobId + '-w') === 0 ||
          snap.shiftId.indexOf(jobId + '-oneoff-') === 0)) {
        matches = true;
      } else if (snapKey.indexOf(jobId + '@') === 0 ||
                 snapKey.indexOf(jobId + '_') === 0 ||
                 snapKey.indexOf(jobId + '-w') === 0 ||
                 snapKey.indexOf(jobId + '-oneoff-') === 0) {
        matches = true;
      }
      if (matches) {
        historicalSnapshotsCount++;
      }
    });

    var total = assignmentsCount + occurrencesCount + permitsCount + rosteringInstructionsCount + rosteringProvenanceCount + historicalSnapshotsCount;
    return {
      assignments: assignmentsCount,
      occurrences: occurrencesCount,
      permitOverrides: permitsCount,
      rosteringInstructions: rosteringInstructionsCount,
      rosteringProvenance: rosteringProvenanceCount,
      historicalSnapshots: historicalSnapshotsCount,
      totalDependencies: total,
      canHardDelete: total === 0
    };
  },

  deleteJob: function(jobId) {
    var job = this.state.jobs.find(function(j) { return j.id === jobId; });
    if (!job) return { success: false, error: 'Job not found' };

    var deps = this.getJobDependencies(jobId, this.state);
    if (!deps.canHardDelete) {
      // Offline17.5f & 17.5g & Gate B3: Deleting a job with dependencies retires it to inactive.
      // Guard against retiring a job that has active future rostering.
      if (window.HortOpsJobEditFormValidator && typeof window.HortOpsJobEditFormValidator.validateRecurrenceCompatibility === 'function') {
        var compat = window.HortOpsJobEditFormValidator.validateRecurrenceCompatibility(job, { status: 'inactive' }, this.state);
        if (!compat.valid) {
          if (typeof alert === 'function') alert(compat.message);
          return { success: false, error: compat.message, retired: false };
        }
      }

      var reasons = [];
      if (deps.occurrences > 0) reasons.push(deps.occurrences + ' explicit/historical occurrences');
      if (deps.historicalSnapshots > 0) reasons.push(deps.historicalSnapshots + ' historical scheduled-commitment snapshot(s)');
      if (deps.assignments > 0) reasons.push(deps.assignments + ' custom assignment records');
      if (deps.permitOverrides > 0) reasons.push(deps.permitOverrides + ' permit overrides');
      if (deps.rosteringInstructions > 0) reasons.push(deps.rosteringInstructions + ' rostering instruction(s)');

      // Offline17.5g: Transactional retirement staged via saveJob
      var proposedJob = Object.assign({}, job, { status: 'inactive' });
      var saveResult = this.saveJob(proposedJob);
      if (!saveResult || !saveResult.success) {
        var err = (saveResult && saveResult.error) ? saveResult.error : 'Failed to retire job due to storage error.';
        if (typeof alert === 'function') alert(err);
        return { success: false, error: err, retired: false };
      }

      // Gate C (R22-03): Notify operator only AFTER retirement is successfully committed
      if (typeof alert === 'function') {
        alert('Job "' + job.name + '" has existing dependencies (' + reasons.join(', ') + '). To preserve data integrity and prevent orphaned records, it has been retired (set to Inactive) rather than permanently deleted.');
      }
      return { success: true, retired: true, dependencies: deps };
    } else {
      // Gate B3: Transactional hard delete staged via _commitCanonicalProposal
      var proposedJobs = this.state.jobs.filter(function(j) { return j.id !== jobId; });
      var commitRes = this._commitCanonicalProposal({ jobs: proposedJobs });
      if (!commitRes.success) {
        if (typeof alert === 'function') alert('Failed to delete job due to storage error. Operation rolled back.');
        return { success: false, error: commitRes.error || 'Storage error', deleted: false };
      }

      this.state.jobs = proposedJobs;
      this.state.storageStatus = (commitRes.storageMode === 'session-only') ? 'session_only' : 'saved';
      this.recomputeDigest();
      this.renderCurrentView();
      return { success: true, deleted: true };
    }
  },

  restoreWorkspaceJson: function(envelope) {
    if (!envelope || typeof envelope !== 'object') return false;

    // 1. Protocol v2 Boundary 6: Strict presence and schema validation of input
    var validator = window.HortOpsSchemaValidator;
    var adoptedData = envelope;
    if (validator && typeof validator.validateCurrentV2ForBoundary === 'function') {
      var boundaryCheck = validator.validateCurrentV2ForBoundary(envelope);
      if (!boundaryCheck.valid) {
        console.warn('Workspace restore aborted: invalid Schema v2 envelope', boundaryCheck.error);
        return false;
      }
      if (boundaryCheck.data) {
        adoptedData = boundaryCheck.data;
      }
    }

    // 2. Build one fully canonical detached restore envelope with canonical defaults for ALL optional domains (R23-B3 / FR-04)
    var defaultBudget = (window.HortOpsScheduler && window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS)
      ? JSON.parse(JSON.stringify(window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS))
      : { annualBudgetCap: 50000, hourlyBaseRate: 44.50 };

    var validViews = ['forward_planner', 'calendar', 'job_manager', 'staff_registry', 'peak_weekends', 'analytics'];
    var proposedView = (adoptedData.uiState && adoptedData.uiState.activeView && validViews.indexOf(adoptedData.uiState.activeView) !== -1)
      ? adoptedData.uiState.activeView
      : 'forward_planner';
    var rawYear = adoptedData.uiState ? (adoptedData.uiState.currentYear || adoptedData.uiState.selectedYear) : undefined;
    var proposedYear = rawYear ? (parseInt(rawYear, 10) || 2026) : 2026;

    var canonicalEnvelope = {
      schemaVersion: 2,
      jobs: Array.isArray(adoptedData.jobs) ? JSON.parse(JSON.stringify(adoptedData.jobs)) : [],
      roster: Array.isArray(adoptedData.roster) ? JSON.parse(JSON.stringify(adoptedData.roster)) : [],
      assignments: (adoptedData.assignments && typeof adoptedData.assignments === 'object') ? JSON.parse(JSON.stringify(adoptedData.assignments)) : {},
      permits: (adoptedData.permits && typeof adoptedData.permits === 'object') ? JSON.parse(JSON.stringify(adoptedData.permits)) : {},
      rostering: (adoptedData.rostering && typeof adoptedData.rostering === 'object') ? JSON.parse(JSON.stringify(adoptedData.rostering)) : { instructions: {}, provenance: {} },
      historicalSnapshots: (adoptedData.historicalSnapshots && typeof adoptedData.historicalSnapshots === 'object') ? JSON.parse(JSON.stringify(adoptedData.historicalSnapshots)) : {},
      budgetSettings: (adoptedData.budgetSettings && typeof adoptedData.budgetSettings === 'object' && adoptedData.budgetSettings !== null)
        ? JSON.parse(JSON.stringify(adoptedData.budgetSettings))
        : defaultBudget,
      uiState: (adoptedData.uiState && typeof adoptedData.uiState === 'object' && adoptedData.uiState !== null)
        ? JSON.parse(JSON.stringify(adoptedData.uiState))
        : {
            activeView: proposedView,
            currentYear: proposedYear,
            selectedDepartment: 'all',
            selectedTeam: 'all',
            onlyPreferredCrew: false,
            searchTerm: ''
          }
    };
    canonicalEnvelope.uiState.activeView = proposedView;
    canonicalEnvelope.uiState.currentYear = proposedYear;

    // 3. Persist the exact canonical envelope to storage BEFORE adopting to live state
    var saveRes = window.HortOpsStorage.saveWorkspace(canonicalEnvelope);
    if (window.HortOpsHeader && typeof window.HortOpsHeader.updateStorageHealth === 'function') {
      window.HortOpsHeader.updateStorageHealth(saveRes);
    }
    if (!saveRes || !saveRes.ok) {
      console.warn('Workspace restore aborted: persistence failed', saveRes ? saveRes.error : 'Storage error');
      if (window.HortOpsHeader && typeof window.HortOpsHeader.updateStorageHealthIndicator === 'function') {
        window.HortOpsHeader.updateStorageHealthIndicator();
      }
      return false;
    }

    // 4. Successful JSON restore exits Recovery Mode immediately (Mandate Pass 10)
    this.state.recoveryRequired = false;
    this.state.recoverySource = null;
    this.state.recoveryError = null;
    this.state.storageStatus = 'saved';
    if (window.HortOpsHeader && typeof window.HortOpsHeader.updateStorageHealthIndicator === 'function') {
      window.HortOpsHeader.updateStorageHealthIndicator();
    }

    // 5. Gate B3 / FR-04: Full live-state replacement from accepted committed data
    // Live state adopts exact detached values from canonicalEnvelope (ensuring live == committed == cold reload)
    this.state.schemaVersion = 2;
    this.state.jobs = JSON.parse(JSON.stringify(canonicalEnvelope.jobs));
    this.state.staffList = JSON.parse(JSON.stringify(canonicalEnvelope.roster));
    this.state.customAssignments = JSON.parse(JSON.stringify(canonicalEnvelope.assignments));
    this.state.rostering = JSON.parse(JSON.stringify(canonicalEnvelope.rostering));
    this.state.customPermits = JSON.parse(JSON.stringify(canonicalEnvelope.permits));
    this._allowHistoryReset = true;
    this.state.historicalSnapshots = JSON.parse(JSON.stringify(canonicalEnvelope.historicalSnapshots));
    this._authoritativeSnapshotCount = Object.keys(this.state.historicalSnapshots).length;
    this._allowHistoryReset = false;
    if (window.HortOpsScheduler && typeof window.HortOpsScheduler.clearBoundaryCache === 'function') {
      window.HortOpsScheduler.clearBoundaryCache();
    }

    this.state.budgetSettings = JSON.parse(JSON.stringify(canonicalEnvelope.budgetSettings));
    this.state.activeView = canonicalEnvelope.uiState.activeView;
    this.state.currentYear = canonicalEnvelope.uiState.currentYear;

    this.recomputeDigest();
    this.renderCurrentView();
    return true;
  },

  resetToCleanSlate: function() {
    var storage = window.HortOpsStorage;
    var resetSuccess = false;
    try {
      if (storage && typeof storage.resetWorkspace === 'function') {
        resetSuccess = storage.resetWorkspace();
      }
    } catch(e) {
      resetSuccess = false;
      console.error('Persistent reset exception:', e);
    }

    if (!resetSuccess) {
      var details = (storage && typeof storage.getLastResetResult === 'function')
        ? storage.getLastResetResult()
        : null;

      this.state.lastResetDetails = details;
      this.state.storageStatus = 'save_failed';
      // Suppress autosave to safeguard persistent storage after failed reset (Review 38 R38-01)
      this._autosaveBlocked = true;

      if (window.HortOpsHeader && typeof window.HortOpsHeader.updateStorageHealthIndicator === 'function') {
        window.HortOpsHeader.updateStorageHealthIndicator();
      }
      return false;
    }

    // 2. Clear boundary cache
    if (window.HortOpsScheduler && typeof window.HortOpsScheduler.clearBoundaryCache === 'function') {
      window.HortOpsScheduler.clearBoundaryCache();
    }
    // 3. Clear recovery state
    this.state.recoveryRequired = false;
    this.state.recoverySource = null;
    this.state.recoveryError = null;
    this.state.storageStatus = 'saved';
    this.state.lastResetDetails = null;
    this._autosaveBlocked = false;

    // 4. Reset in-memory state cleanly to clean slate
    this.state.schemaVersion = 2;
    this.state.jobs = [];
    this.state.staffList = [];
    this.state.customAssignments = {};
    this.state.customPermits = {};
    this.state.rostering = { instructions: {}, provenance: {} };
    this._allowHistoryReset = true;
    this.state.historicalSnapshots = {};
    this._authoritativeSnapshotCount = 0;
    this._allowHistoryReset = false;
    var defaultBudget = (window.HortOpsScheduler && window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS) ?
      JSON.parse(JSON.stringify(window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS)) :
      { annualTarget: 0, defaultStandardHoursPerShift: 8 };
    this.state.budgetSettings = defaultBudget;
    this.state.activeView = 'forward_planner';
    // 2026 is the canonical baseline reference year for the self-contained offline dataset
    this.state.currentYear = 2026;

    // 5. Update header health indicator
    if (window.HortOpsHeader && typeof window.HortOpsHeader.updateStorageHealthIndicator === 'function') {
      window.HortOpsHeader.updateStorageHealthIndicator();
    }

    // 6. Recompute and re-render
    this.recomputeDigest();
    this.renderCurrentView();
    return true;
  },

  reconcileStaffSnapshot: function(diff) {
    if (!diff || typeof diff !== 'object') {
      return { success: false, error: 'Invalid reconciliation diff' };
    }
    if (!window.HortOpsReconciliationEngine || typeof window.HortOpsReconciliationEngine.applyWorkforceReconciliation !== 'function') {
      return { success: false, error: 'Reconciliation engine unavailable' };
    }

    var result = window.HortOpsReconciliationEngine.applyWorkforceReconciliation(
      this.state.staffList,
      diff,
      this.state.customAssignments,
      this.state.allShifts
    );

    var proposedRoster = JSON.parse(JSON.stringify(result.reconciledRoster));
    var proposedAssignments = JSON.parse(JSON.stringify(result.reconciledAssignments));

    var commitRes = this._commitCanonicalProposal({
      roster: proposedRoster,
      assignments: proposedAssignments
    });
    if (!commitRes.success) {
      return commitRes;
    }

    this.state.staffList = proposedRoster;
    this.state.customAssignments = proposedAssignments;
    this.state.storageStatus = (commitRes.storageMode === 'session-only') ? 'session_only' : 'saved';
    this.recomputeDigest();
    this.renderCurrentView();
    return { success: true, vacatedCount: result.vacatedCount };
  },

  importStaffMembers: function(newStaffList) {
    if (!newStaffList || !Array.isArray(newStaffList)) {
      return { success: false, error: 'Invalid staff list: expected array' };
    }
    if (!window.HortOpsReconciliationEngine || typeof window.HortOpsReconciliationEngine.computeWorkforceReconciliation !== 'function') {
      return { success: false, error: 'Reconciliation engine unavailable' };
    }
    var diff = window.HortOpsReconciliationEngine.computeWorkforceReconciliation(
      this.state.staffList,
      newStaffList,
      this.state.customAssignments,
      this.state.allShifts
    );
    return this.reconcileStaffSnapshot(diff);
  },

  updateStaffMember: function(updatedStaff) {
    if (!updatedStaff || typeof updatedStaff !== 'object' || !updatedStaff.id) {
      return { success: false, error: 'Invalid staff update: missing staff id' };
    }
    var staffId = String(updatedStaff.id);
    var staffList = this.state.staffList || [];
    var idx = staffList.findIndex(function(s) { return s.id === staffId; });
    if (idx === -1) {
      return { success: false, error: 'Staff member "' + staffId + '" not found' };
    }

    var proposedRoster = JSON.parse(JSON.stringify(staffList));
    var target = proposedRoster[idx];

    for (var k in updatedStaff) {
      if (updatedStaff.hasOwnProperty(k)) {
        if (k === 'id') {
          if (String(updatedStaff[k]) !== staffId) {
            return { success: false, error: 'Cannot mutate staff identity id' };
          }
        } else {
          target[k] = JSON.parse(JSON.stringify(updatedStaff[k]));
        }
      }
    }

    var commitRes = this._commitCanonicalProposal({ roster: proposedRoster });
    if (!commitRes.success) {
      return commitRes;
    }

    this.state.staffList = proposedRoster;
    this.state.storageStatus = (commitRes.storageMode === 'session-only') ? 'session_only' : 'saved';
    this.recomputeDigest();
    this.renderCurrentView();
    return { success: true };
  },

  handleAutoStagger: function() {
    alert("Notice: Auto-Stagger on legacy anchor weeks is disabled to preserve canonical date-anchored recurrences. Please adjust job anchor dates individually in the Job Registry.");
  },

  openStaffAssignModal: function(shiftId) {
    window.HortOpsStaffAssignModal.open(shiftId);
  },

  openAddJobModal: function(targetDate, preferredDay) {
    window.HortOpsJobEditModal.open(null, targetDate, preferredDay);
  },

  openEditJobModal: function(jobId) {
    window.HortOpsJobEditModal.open(jobId);
  },

  openExportModal: function() {
    window.HortOpsExportModal.open();
  },

  openImportModal: function() {
    window.HortOpsImportModal.open();
  },

  openWarningsModal: function() {
    if (window.HortOpsWarningsModal && typeof window.HortOpsWarningsModal.open === 'function') {
      window.HortOpsWarningsModal.open();
    }
  },

  openResetWorkspaceModal: function() {
    if (window.HortOpsResetWorkspaceModal && typeof window.HortOpsResetWorkspaceModal.open === 'function') {
      window.HortOpsResetWorkspaceModal.open();
    }
  },

  openStorageHealthModal: function() {
    if (window.HortOpsStorageHealthModal && typeof window.HortOpsStorageHealthModal.open === 'function') {
      window.HortOpsStorageHealthModal.open();
    }
  },

  openQuarantineModal: function() {
    var qModal = window.HortOpsQuarantineModal || window.HortOpsQuarantineViewerModal;
    if (qModal && typeof qModal.open === 'function') {
      qModal.open();
    }
  },

  handleHealthPillClick: function() {
    if (this.state && this.state.recoveryRequired) {
      this.openQuarantineModal();
    } else {
      this.openStorageHealthModal();
    }
  }
};

// Bootstrap application on DOM ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    window.HortOpsApp.init();

    // Query parameter testing hooks
    if (window.location.search.indexOf('testVacancy=1') !== -1) {
      // Remove two staff from the first shift to demonstrate vacancies
      var s0 = window.HortOpsApp.state.allShifts[0];
      if (s0 && s0.assignedStaffIds && s0.assignedStaffIds.length >= 2) {
        window.HortOpsApp.state.customAssignments[s0.shiftId] = s0.assignedStaffIds.slice(0, 2);
        window.HortOpsApp.recomputeDigest();
        window.HortOpsApp.renderCurrentView();
      }
    } else if (window.location.search.indexOf('showAll=1') !== -1) {
      window.HortOpsForwardPlanner.hideUnassigned = false;
      window.HortOpsApp.renderCurrentView();
    } else if (window.location.search.indexOf('openAddJob') !== -1) {
      setTimeout(function() { window.HortOpsApp.openAddJobModal(); }, 50);
    } else if (window.location.search.indexOf('openStaffAssign') !== -1) {
      setTimeout(function() {
        var firstShift = window.HortOpsApp.state.allShifts[0];
        if (firstShift) window.HortOpsApp.openStaffAssignModal(firstShift.shiftId);
      }, 50);
    } else if (window.location.search.indexOf('view=') !== -1) {
      var match = window.location.search.match(/view=([a-z_]+)/);
      if (match && match[1]) {
        window.HortOpsApp.setActiveView(match[1]);
      }
    }
  });
}
