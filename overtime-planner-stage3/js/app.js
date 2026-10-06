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
    absences: [],
    refusalHistory: [],
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
    this.state.poolTags = JSON.parse(JSON.stringify(ws.poolTags || []));
    this.state.jobs = ws.jobs;
    this.state.staffList = ws.roster;
    this.state.roster = ws.roster;
    this.state.customAssignments = ws.assignments;
    this.state.assignments = ws.assignments;
    this.state.rostering = ws.rostering || { instructions: {}, provenance: {} };
    this.state.historicalSnapshots = (ws.historicalSnapshots && typeof ws.historicalSnapshots === 'object' && !Array.isArray(ws.historicalSnapshots)) ? ws.historicalSnapshots : {};
    this._authoritativeSnapshotCount = (this.state.historicalSnapshots && typeof this.state.historicalSnapshots === 'object') ? Object.keys(this.state.historicalSnapshots).length : 0;
    this._allowHistoryReset = false;
    this.state.customPermits = ws.permits;
    this.state.permits = ws.permits;
    this.state.budgetSettings = ws.budgetSettings;
    this.state.uiState = JSON.parse(JSON.stringify(ws.uiState || { activeView: 'forward_planner', currentYear: 2026 }));
    this.state.activeView = this.state.uiState.activeView || 'forward_planner';
    this.state.currentYear = this.state.uiState.currentYear || 2026;
    this.state.absences = Array.isArray(ws.absences) ? ws.absences.slice() : [];
    this.state.refusalHistory = Array.isArray(ws.refusalHistory) ? ws.refusalHistory.slice() : (Array.isArray(ws.refusals) ? ws.refusals.slice() : []);
    this.state.refusals = this.state.refusalHistory;
    this.state.recoveryRequired = Boolean(ws.recoveryRequired);
    this.state.recoverySource = ws.recoveryRequired ? ws.recoverySource : null;
    this.state.recoveryError = ws.recoveryRequired ? ws.recoveryError : null;

    // Check for emergency recovery payload staged in sessionStorage from prior unrecovered reset or restore (Review 44 R44-06)
    try {
      if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).sessionStorage) {
        var emergencyPayload = null;
        var recoveryInventory = {
          transactionBundles: [],
          workspaceArtifacts: [],
          allKeys: []
        };

        var sLen = (typeof (window.HortOpsClientStorage || window).sessionStorage.length === 'number') ? (window.HortOpsClientStorage || window).sessionStorage.length : 0;
        for (var sI = 0; sI < sLen; sI++) {
          var sK = (window.HortOpsClientStorage || window).sessionStorage.key(sI);
          if (sK && sK.indexOf('hort_ops_emergency_recovery_v2') === 0) {
            recoveryInventory.allKeys.push(sK);
            var itemRaw = (window.HortOpsClientStorage || window).sessionStorage.getItem(sK);
            if (sK.indexOf('hort_ops_emergency_recovery_v2:transaction:') === 0 || (itemRaw && itemRaw.indexOf('hort_ops_reset_transaction_recovery') !== -1)) {
              recoveryInventory.transactionBundles.push({ key: sK, raw: itemRaw });
            } else {
              recoveryInventory.workspaceArtifacts.push({ key: sK, raw: itemRaw });
            }
          }
        }

        // Prioritize direct workspace recovery artifacts for UI payload display (Review 39 / R39-B parity)
        if (recoveryInventory.workspaceArtifacts.length > 0) {
          emergencyPayload = recoveryInventory.workspaceArtifacts[0].raw;
        } else if (recoveryInventory.transactionBundles.length > 0) {
          emergencyPayload = recoveryInventory.transactionBundles[0].raw;
        }

        if (emergencyPayload || recoveryInventory.allKeys.length > 0) {
          this.state.emergencyRecoveryPayload = emergencyPayload;
          this.state.recoveryInventory = recoveryInventory;
          this.state.recoveryRequired = true;
          this._autosaveBlocked = true;
          this.state.recoverySource = 'emergency_session_backup';
          var totalCount = recoveryInventory.allKeys.length;
          this.state.recoveryError = 'Detected unrecovered emergency recovery evidence (' + totalCount + ' artifact' + (totalCount > 1 ? 's' : '') + ') from prior session. Auto-saving suspended.';
        }
      }
    } catch(e) {
      this.state.recoveryRequired = true;
      this._autosaveBlocked = true;
      this.state.recoverySource = 'emergency_session_backup';
      this.state.recoveryError = 'Session storage scan failed: ' + (e.message || String(e)) + '. Auto-saving suspended.';
    }

    if (ws.uiState) {
      var validViews = ['forward_planner', 'calendar', 'job_manager', 'staff_registry', 'peak_weekends', 'analytics'];
      if (ws.uiState.activeView && validViews.indexOf(ws.uiState.activeView) !== -1) {
        this.state.activeView = ws.uiState.activeView;
      }
      if (ws.uiState.currentYear && typeof ws.uiState.currentYear === 'number' && ws.uiState.currentYear >= 2020 && ws.uiState.currentYear <= 2040) {
        this.state.currentYear = ws.uiState.currentYear;
      }
    }

    this._updateDomainBaselines(ws);
    this.recomputeDigest();
    this.renderCurrentView();
  },

  _resolveDomainState: function(canonicalKey, legacyKey) {
    if (!this.state) return undefined;
    var own = Object.prototype.hasOwnProperty;
    var hasCanon = own.call(this.state, canonicalKey);
    var hasLeg = legacyKey ? own.call(this.state, legacyKey) : false;

    if (!hasCanon && !hasLeg) return undefined;
    if (hasCanon && !hasLeg) return this.state[canonicalKey];
    if (!hasCanon && hasLeg) return this.state[legacyKey];

    var vCanon = this.state[canonicalKey];
    var vLeg = this.state[legacyKey];

    // Check if either is explicitly null or invalid primitive (fail-closed precedence)
    if (vCanon === null || (vCanon !== undefined && typeof vCanon !== 'object')) return vCanon;
    if (vLeg === null || (vLeg !== undefined && typeof vLeg !== 'object')) return vLeg;

    var baseVal = this._domainBaselines ? (this._domainBaselines[canonicalKey] || (legacyKey ? this._domainBaselines[legacyKey] : undefined)) : undefined;
    if (baseVal !== undefined) {
      var canonDiff = JSON.stringify(vCanon) !== JSON.stringify(baseVal);
      var legDiff = JSON.stringify(vLeg) !== JSON.stringify(baseVal);
      if (canonDiff && !legDiff) return vCanon;
      if (!canonDiff && legDiff) return vLeg;
    }

    return vCanon !== undefined ? vCanon : vLeg;
  },

  _updateDomainBaselines: function(src) {
    if (!src || typeof src !== 'object') return;
    this._domainBaselines = {
      poolTags: JSON.parse(JSON.stringify(src.poolTags || [])),
      jobs: JSON.parse(JSON.stringify(src.jobs || [])),
      roster: JSON.parse(JSON.stringify(src.roster || src.staffList || [])),
      assignments: JSON.parse(JSON.stringify(src.assignments || src.customAssignments || {})),
      rostering: JSON.parse(JSON.stringify(src.rostering || { instructions: {}, provenance: {} })),
      historicalSnapshots: JSON.parse(JSON.stringify(src.historicalSnapshots || {})),
      permits: JSON.parse(JSON.stringify(src.permits || src.customPermits || {})),
      budgetSettings: JSON.parse(JSON.stringify(src.budgetSettings || {})),
      uiState: JSON.parse(JSON.stringify(src.uiState || {})),
      absences: JSON.parse(JSON.stringify(src.absences || [])),
      refusalHistory: JSON.parse(JSON.stringify(src.refusalHistory || src.refusals || []))
    };
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

      // Review 62 (R62-P0-01): Identify explicit mutating domain intent
      var explicitMutatingDomains = new Set();
      if (own.call(proposalOverrides, 'poolTags')) explicitMutatingDomains.add('poolTags');
    if (own.call(proposalOverrides, 'jobs')) explicitMutatingDomains.add('jobs');
      if (own.call(proposalOverrides, 'roster') || own.call(proposalOverrides, 'staffList')) explicitMutatingDomains.add('roster');
      if (own.call(proposalOverrides, 'assignments') || own.call(proposalOverrides, 'customAssignments')) explicitMutatingDomains.add('assignments');
      if (own.call(proposalOverrides, 'rostering')) explicitMutatingDomains.add('rostering');
      if (own.call(proposalOverrides, 'historicalSnapshots')) explicitMutatingDomains.add('historicalSnapshots');
      if (own.call(proposalOverrides, 'permits') || own.call(proposalOverrides, 'customPermits')) explicitMutatingDomains.add('permits');
      if (own.call(proposalOverrides, 'budgetSettings')) explicitMutatingDomains.add('budgetSettings');
      if (own.call(proposalOverrides, 'uiState')) explicitMutatingDomains.add('uiState');
      if (own.call(proposalOverrides, 'absences')) explicitMutatingDomains.add('absences');
      if (own.call(proposalOverrides, 'refusalHistory') || own.call(proposalOverrides, 'refusals')) explicitMutatingDomains.add('refusalHistory');

      var isRestoreOrReset = proposalOverrides && (
        proposalOverrides.isRestore === true ||
        proposalOverrides.isReset === true
      );

      // Detect any in-memory domain changes vs established baseline (fail-closed, without masking)
      var activeMutatingDomains = new Set(explicitMutatingDomains);
      if (!isRestoreOrReset && this._domainBaselines) {
        var currentPools = this.state.poolTags || [];
      if (JSON.stringify(currentPools) !== JSON.stringify(this._domainBaselines.poolTags || [])) activeMutatingDomains.add('poolTags');
      var currentJobs = this._resolveDomainState('jobs');
        if (JSON.stringify(currentJobs) !== JSON.stringify(this._domainBaselines.jobs)) activeMutatingDomains.add('jobs');

        var currentRoster = this._resolveDomainState('roster', 'staffList');
        if (JSON.stringify(currentRoster) !== JSON.stringify(this._domainBaselines.roster)) activeMutatingDomains.add('roster');

        var currentAssignments = this._resolveDomainState('assignments', 'customAssignments');
        if (JSON.stringify(currentAssignments) !== JSON.stringify(this._domainBaselines.assignments)) activeMutatingDomains.add('assignments');

        var currentRostering = this._resolveDomainState('rostering');
        if (JSON.stringify(currentRostering) !== JSON.stringify(this._domainBaselines.rostering)) activeMutatingDomains.add('rostering');

        var currentSnapshots = this._resolveDomainState('historicalSnapshots');
        if (JSON.stringify(currentSnapshots) !== JSON.stringify(this._domainBaselines.historicalSnapshots)) activeMutatingDomains.add('historicalSnapshots');

        var currentPermits = this._resolveDomainState('permits', 'customPermits');
        if (JSON.stringify(currentPermits) !== JSON.stringify(this._domainBaselines.permits)) activeMutatingDomains.add('permits');

        var currentBudget = this._resolveDomainState('budgetSettings');
        if (JSON.stringify(currentBudget) !== JSON.stringify(this._domainBaselines.budgetSettings)) activeMutatingDomains.add('budgetSettings');

        var currentUiState = this._resolveDomainState('uiState');
        if (currentUiState && typeof currentUiState === 'object') {
          currentUiState = Object.assign({}, currentUiState);
          if (this.state && this.state.activeView) currentUiState.activeView = this.state.activeView;
          if (this.state && this.state.currentYear) currentUiState.currentYear = this.state.currentYear;
        } else if (currentUiState === undefined && this.state && (this.state.activeView || this.state.currentYear)) {
          var baseUiComp = this._domainBaselines.uiState || {};
          currentUiState = Object.assign({}, baseUiComp, {
            activeView: this.state.activeView || baseUiComp.activeView || 'forward_planner',
            currentYear: this.state.currentYear || baseUiComp.currentYear || 2026
          });
        }
        if (JSON.stringify(currentUiState) !== JSON.stringify(this._domainBaselines.uiState)) activeMutatingDomains.add('uiState');

        var currentAbsences = this._resolveDomainState('absences');
        if (JSON.stringify(currentAbsences) !== JSON.stringify(this._domainBaselines.absences)) activeMutatingDomains.add('absences');

        var currentRefusals = this._resolveDomainState('refusalHistory', 'refusals');
        if (JSON.stringify(currentRefusals) !== JSON.stringify(this._domainBaselines.refusalHistory)) activeMutatingDomains.add('refusalHistory');
      }

      // Authoritative canonical domains: distinguish omitted from explicitly null/invalid; NEVER coerce with truthy defaults
      var proposedPools = own.call(proposalOverrides, 'poolTags') ? proposalOverrides.poolTags : (this.state.poolTags || []);
    var proposedJobs;
      if (own.call(proposalOverrides, 'jobs')) {
        proposedJobs = proposalOverrides.jobs;
      } else {
        proposedJobs = this._resolveDomainState('jobs');
        if (proposedJobs === undefined) proposedJobs = [];
      }

      var proposedRoster;
      if (own.call(proposalOverrides, 'roster')) {
        proposedRoster = proposalOverrides.roster;
      } else if (own.call(proposalOverrides, 'staffList')) {
        proposedRoster = proposalOverrides.staffList;
      } else {
        proposedRoster = this._resolveDomainState('roster', 'staffList');
        if (proposedRoster === undefined) proposedRoster = [];
      }

      // Corrections append evidence; ordinary edits/imports cannot erase prior records.
      if (!isRestoreOrReset && Array.isArray(proposedRoster) && this._domainBaselines) {
        var baselineRoster = this._domainBaselines.roster || [];
        function evidenceEqual(a, b) {
          return ['id','year','throughDate','hours','source','recordedAt','verification'].every(function(field) { return a[field] === b[field]; });
        }
        for (var previousStaff of baselineRoster) {
          var previousEvidence = previousStaff.overtimeHoursEvidence || [];
          if (!previousEvidence.length) continue;
          var proposedStaff = proposedRoster.find(function(person) { return person.id === previousStaff.id; });
          var proposedEvidence = proposedStaff && proposedStaff.overtimeHoursEvidence;
          if (!Array.isArray(proposedEvidence) || previousEvidence.some(function(record) {
            return !proposedEvidence.some(function(next) { return evidenceEqual(record, next); });
          })) return { success: false, error: 'Overtime hours evidence history cannot be removed or rewritten by an ordinary workspace edit.' };
        }
      }

      var proposedAssignments;
      if (own.call(proposalOverrides, 'assignments')) {
        proposedAssignments = proposalOverrides.assignments;
      } else if (own.call(proposalOverrides, 'customAssignments')) {
        proposedAssignments = proposalOverrides.customAssignments;
      } else {
        proposedAssignments = this._resolveDomainState('assignments', 'customAssignments');
        if (proposedAssignments === undefined) proposedAssignments = {};
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
        if (proposedUiState && typeof proposedUiState === 'object' && !Array.isArray(proposedUiState)) {
          proposedUiState = JSON.parse(JSON.stringify(this.state.uiState));
          if (this.state.activeView) proposedUiState.activeView = this.state.activeView;
          if (this.state.currentYear) proposedUiState.currentYear = this.state.currentYear;
        }
      } else {
        var baseUi = (this._domainBaselines && this._domainBaselines.uiState) ? JSON.parse(JSON.stringify(this._domainBaselines.uiState)) : {};
        proposedUiState = Object.assign({}, baseUi, {
          activeView: (this.state && this.state.activeView) || baseUi.activeView || 'forward_planner',
          currentYear: (this.state && this.state.currentYear) || baseUi.currentYear || 2026
        });
      }

      var proposedAbsences;
      if (own.call(proposalOverrides, 'absences')) {
        proposedAbsences = proposalOverrides.absences;
      } else if (this.state && own.call(this.state, 'absences')) {
        proposedAbsences = this.state.absences;
      } else {
        proposedAbsences = [];
      }

      var proposedRefusals;
      if (own.call(proposalOverrides, 'refusalHistory')) {
        proposedRefusals = proposalOverrides.refusalHistory;
      } else if (own.call(proposalOverrides, 'refusals')) {
        proposedRefusals = proposalOverrides.refusals;
      } else if (this.state && own.call(this.state, 'refusalHistory')) {
        proposedRefusals = this.state.refusalHistory;
      } else {
        proposedRefusals = [];
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
      // Review 60 P0 (R60-P0-01): Reject explicit null for absences and refusalHistory throughout authoritative chain
      if (proposedAbsences !== undefined && (proposedAbsences === null || !Array.isArray(proposedAbsences))) {
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Invalid "absences" property: must be an array, null is not permitted' };
      }
      if (proposedRefusals !== undefined && (proposedRefusals === null || !Array.isArray(proposedRefusals))) {
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Invalid "refusalHistory" property: must be an array, null is not permitted' };
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
      var committedData = (committed.exists && committed.data) ? committed.data : null;

      // Review 62 (R62-P0-01): Cross-Domain Freshness & Intent Reconciliation
      // For untouched domains: preserve latest verified committed storage values to prevent reverting concurrent external edits.
      // For mutating domains: detect concurrent collisions against established baseline.
      if (!isRestoreOrReset && committedData) {
        if (!this._domainBaselines) {
          this._updateDomainBaselines(committedData);
        }

        // 1. Untouched domains preservation
        if (!activeMutatingDomains.has('poolTags')) proposedPools = committedData.poolTags || [];
      if (activeMutatingDomains.has('poolTags') && this._domainBaselines && JSON.stringify(committedData.poolTags || []) !== JSON.stringify(this._domainBaselines.poolTags || [])) return {success:false,error:'Pool catalogue changed; reopen the editor.'};
      if (!activeMutatingDomains.has('jobs') && Array.isArray(committedData.jobs)) {
          proposedJobs = committedData.jobs;
        }
        if (!activeMutatingDomains.has('roster') && Array.isArray(committedData.roster)) {
          proposedRoster = committedData.roster;
        }
        if (!activeMutatingDomains.has('assignments') && committedData.assignments && typeof committedData.assignments === 'object') {
          proposedAssignments = committedData.assignments;
        }
        if (!activeMutatingDomains.has('rostering') && committedData.rostering && typeof committedData.rostering === 'object') {
          proposedRostering = committedData.rostering;
        }
        if (!activeMutatingDomains.has('historicalSnapshots') && committedData.historicalSnapshots && typeof committedData.historicalSnapshots === 'object') {
          proposedSnapshots = committedData.historicalSnapshots;
        }
        if (!activeMutatingDomains.has('permits') && committedData.permits && typeof committedData.permits === 'object') {
          proposedPermits = committedData.permits;
        }
        if (!activeMutatingDomains.has('budgetSettings') && committedData.budgetSettings && typeof committedData.budgetSettings === 'object') {
          proposedBudget = committedData.budgetSettings;
        }
        if (!activeMutatingDomains.has('uiState') && committedData.uiState && typeof committedData.uiState === 'object') {
          proposedUiState = committedData.uiState;
        }
        if (!activeMutatingDomains.has('absences') && Array.isArray(committedData.absences)) {
          proposedAbsences = committedData.absences;
        }
        if (!activeMutatingDomains.has('refusalHistory') && Array.isArray(committedData.refusalHistory)) {
          proposedRefusals = committedData.refusalHistory;
        }

        // 2. Same-domain conflict detection for mutating non-ledger domains
        if (this._domainBaselines) {
          var nonLedgerDomains = [
            { name: 'jobs', getProposed: function() { return proposedJobs; } },
            { name: 'roster', getProposed: function() { return proposedRoster; } },
            { name: 'assignments', getProposed: function() { return proposedAssignments; } },
            { name: 'rostering', getProposed: function() { return proposedRostering; } },
            { name: 'historicalSnapshots', getProposed: function() { return proposedSnapshots; } },
            { name: 'permits', getProposed: function() { return proposedPermits; } },
            { name: 'budgetSettings', getProposed: function() { return proposedBudget; } },
            { name: 'uiState', getProposed: function() { return proposedUiState; } }
          ];

          for (var nli = 0; nli < nonLedgerDomains.length; nli++) {
            var nlItem = nonLedgerDomains[nli];
            var nlName = nlItem.name;
            if (activeMutatingDomains.has(nlName) && this._domainBaselines[nlName] !== undefined && committedData[nlName] !== undefined) {
              var nlBase = this._domainBaselines[nlName];
              var nlComm = committedData[nlName];
              if (JSON.stringify(nlComm) !== JSON.stringify(nlBase)) {
                var nlProp = nlItem.getProposed();
                if (JSON.stringify(nlProp) !== JSON.stringify(nlComm)) {
                  console.error('Cannot save workspace: concurrent modification conflict on domain "' + nlName + '". Committed storage was modified concurrently.');
                  if (this.state) this.state.storageStatus = 'save_failed';
                  return { success: false, error: 'Concurrent conflict on domain "' + nlName + '": modified concurrently in another session. Please reload or reconcile.' };
                }
              }
            }
          }
        }
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

      // Review 58 Identity-Level Evidence Loss Guard for Absences & Refusals (Contract A: R58-P0-01)
      if (!this._allowHistoryReset && committed.data) {
        var isRestoreOrReset = proposalOverrides && (
          proposalOverrides.isRestore === true ||
          proposalOverrides.isReset === true
        );

        // Review 59 Gate C (R59-P1-04): Baseline capture for stale edit conflict detection
        var baseAbs = (proposalOverrides && Array.isArray(proposalOverrides.baseAbsences))
          ? proposalOverrides.baseAbsences
          : ((this.state && Array.isArray(this.state.absences)) ? this.state.absences : null);

        var baseRef = (proposalOverrides && Array.isArray(proposalOverrides.baseRefusals))
          ? proposalOverrides.baseRefusals
          : ((this.state && Array.isArray(this.state.refusalHistory)) ? this.state.refusalHistory : null);

        // 1. Absences Identity Guard
        var prevAbs = Array.isArray(committed.data.absences) ? committed.data.absences : [];
        var authAbsDeletions = new Set(
          (proposalOverrides && Array.isArray(proposalOverrides.authorisedAbsenceDeletions))
            ? proposalOverrides.authorisedAbsenceDeletions
            : []
        );

        if (Array.isArray(proposedAbsences)) {
          var seenAbsIds = new Set();
          for (var ai = 0; ai < proposedAbsences.length; ai++) {
            var aRec = proposedAbsences[ai];
            if (!aRec || !aRec.id || typeof aRec.id !== 'string') {
              console.error('Cannot save workspace: invalid absence record without string id.');
              if (this.state) this.state.storageStatus = 'save_failed';
              return { success: false, error: 'Invalid absence record: missing or malformed id' };
            }
            if (seenAbsIds.has(aRec.id)) {
              console.error('Cannot save workspace: duplicate absence identity "' + aRec.id + '".');
              if (this.state) this.state.storageStatus = 'save_failed';
              return { success: false, error: 'Duplicate absence record id: ' + aRec.id };
            }
            seenAbsIds.add(aRec.id);

            // Review 59 Gate C (R59-P1-04) & Review 61 (R61-P1-01, R61-P1-02): Three-way reconciliation for proposed absence
            if (!isRestoreOrReset && baseAbs && prevAbs) {
              var commAbsRec = prevAbs.find(function(x) { return x && x.id === aRec.id; });
              var baseAbsRec = baseAbs.find(function(x) { return x && x.id === aRec.id; });

              // R61-P1-01: B present, C absent, P present -> record was deleted concurrently; do not resurrect
              if (baseAbsRec && !commAbsRec) {
                console.error('Cannot save workspace: stale edit conflict on absence record "' + aRec.id + '". Record was deleted concurrently in committed storage.');
                if (this.state) this.state.storageStatus = 'save_failed';
                return { success: false, error: 'Stale edit conflict: record "' + aRec.id + '" was deleted concurrently. Please reopen the modal.' };
              }

              // R61-P1-02: B absent, C present, P present -> colliding concurrent addition; do not overwrite if differing
              if (!baseAbsRec && commAbsRec) {
                if (JSON.stringify(aRec) !== JSON.stringify(commAbsRec)) {
                  console.error('Cannot save workspace: colliding concurrent addition on absence record "' + aRec.id + '". Record was added concurrently with differing payload.');
                  if (this.state) this.state.storageStatus = 'save_failed';
                  return { success: false, error: 'Colliding concurrent addition: record "' + aRec.id + '" was added concurrently with differing payload. Please reopen the modal.' };
                }
              }

              // R59-P1-04: B present, C present, P present -> check stale edit if C changed from B and P differs from C
              if (baseAbsRec && commAbsRec) {
                if (JSON.stringify(commAbsRec) !== JSON.stringify(baseAbsRec)) {
                  if (JSON.stringify(aRec) !== JSON.stringify(commAbsRec)) {
                    console.error('Cannot save workspace: stale edit conflict on absence record "' + aRec.id + '". Committed version has changed since baseline.');
                    if (this.state) this.state.storageStatus = 'save_failed';
                    return { success: false, error: 'Stale edit conflict: record "' + aRec.id + '" has been modified concurrently. Please reopen the modal.' };
                  }
                }
              }
            }
          }

          for (var pi = 0; pi < prevAbs.length; pi++) {
            var prevAbsId = prevAbs[pi] && prevAbs[pi].id;
            if (prevAbsId && !seenAbsIds.has(prevAbsId)) {
              var isAbsAuth = isRestoreOrReset || authAbsDeletions.has(prevAbsId);
              if (!isAbsAuth) {
                console.error('Cannot save workspace: suspicious absence record loss detected. Committed historical absence identity "' + prevAbsId + '" dropped without explicit authorised deletion.');
                if (this.state) this.state.storageStatus = 'save_failed';
                return { success: false, error: 'Suspicious evidence loss: absence records dropped' };
              }

              // Review 60 P1-high (R60-P1-02): Validate stale deletion against modal baseline revision
              if (!isRestoreOrReset && baseAbs) {
                var baseAbsRec = baseAbs.find(function(x) { return x && x.id === prevAbsId; });
                if (!baseAbsRec) {
                  console.error('Cannot save workspace: stale deletion conflict on absence record "' + prevAbsId + '". Record was added concurrently and is missing from baseline.');
                  if (this.state) this.state.storageStatus = 'save_failed';
                  return { success: false, error: 'Stale deletion conflict: record not present in baseline' };
                }
                var commAbsRec = prevAbs[pi];
                if (JSON.stringify(commAbsRec) !== JSON.stringify(baseAbsRec)) {
                  console.error('Cannot save workspace: stale deletion conflict on absence record "' + prevAbsId + '". Committed version has changed since baseline.');
                  if (this.state) this.state.storageStatus = 'save_failed';
                  return { success: false, error: 'Stale deletion conflict: record has been modified concurrently' };
                }
              }
            }
          }
        }

        // 2. Refusals Identity Guard
        var prevRef = Array.isArray(committed.data.refusalHistory) ? committed.data.refusalHistory : [];
        var authRefDeletions = new Set(
          (proposalOverrides && Array.isArray(proposalOverrides.authorisedRefusalDeletions))
            ? proposalOverrides.authorisedRefusalDeletions
            : []
        );

        if (Array.isArray(proposedRefusals)) {
          var seenRefIds = new Set();
          for (var ri = 0; ri < proposedRefusals.length; ri++) {
            var rRec = proposedRefusals[ri];
            if (!rRec || !rRec.id || typeof rRec.id !== 'string') {
              console.error('Cannot save workspace: invalid refusal record without string id.');
              if (this.state) this.state.storageStatus = 'save_failed';
              return { success: false, error: 'Invalid refusal record: missing or malformed id' };
            }
            if (seenRefIds.has(rRec.id)) {
              console.error('Cannot save workspace: duplicate refusal identity "' + rRec.id + '".');
              if (this.state) this.state.storageStatus = 'save_failed';
              return { success: false, error: 'Duplicate refusal record id: ' + rRec.id };
            }
            seenRefIds.add(rRec.id);

            // Review 59 Gate C (R59-P1-04) & Review 61 (R61-P1-01, R61-P1-02): Three-way reconciliation for proposed refusal
            if (!isRestoreOrReset && baseRef && prevRef) {
              var commRefRec = prevRef.find(function(x) { return x && x.id === rRec.id; });
              var baseRefRec = baseRef.find(function(x) { return x && x.id === rRec.id; });

              // R61-P1-01: B present, C absent, P present -> record was deleted concurrently; do not resurrect
              if (baseRefRec && !commRefRec) {
                console.error('Cannot save workspace: stale edit conflict on refusal record "' + rRec.id + '". Record was deleted concurrently in committed storage.');
                if (this.state) this.state.storageStatus = 'save_failed';
                return { success: false, error: 'Stale edit conflict: refusal record "' + rRec.id + '" was deleted concurrently. Please reopen the modal.' };
              }

              // R61-P1-02: B absent, C present, P present -> colliding concurrent addition; do not overwrite if differing
              if (!baseRefRec && commRefRec) {
                if (JSON.stringify(rRec) !== JSON.stringify(commRefRec)) {
                  console.error('Cannot save workspace: colliding concurrent addition on refusal record "' + rRec.id + '". Record was added concurrently with differing payload.');
                  if (this.state) this.state.storageStatus = 'save_failed';
                  return { success: false, error: 'Colliding concurrent addition: refusal record "' + rRec.id + '" was added concurrently with differing payload. Please reopen the modal.' };
                }
              }

              // R59-P1-04: B present, C present, P present -> check stale edit if C changed from B and P differs from C
              if (baseRefRec && commRefRec) {
                if (JSON.stringify(commRefRec) !== JSON.stringify(baseRefRec)) {
                  if (JSON.stringify(rRec) !== JSON.stringify(commRefRec)) {
                    console.error('Cannot save workspace: stale edit conflict on refusal record "' + rRec.id + '". Committed version has changed since baseline.');
                    if (this.state) this.state.storageStatus = 'save_failed';
                    return { success: false, error: 'Stale edit conflict: refusal record "' + rRec.id + '" has been modified concurrently. Please reopen the modal.' };
                  }
                }
              }
            }
          }

          for (var pri = 0; pri < prevRef.length; pri++) {
            var prevRefId = prevRef[pri] && prevRef[pri].id;
            if (prevRefId && !seenRefIds.has(prevRefId)) {
              var isRefAuth = isRestoreOrReset || authRefDeletions.has(prevRefId);
              if (!isRefAuth) {
                console.error('Cannot save workspace: suspicious refusal record loss detected. Committed refusal ledger identity "' + prevRefId + '" dropped without explicit authorised deletion.');
                if (this.state) this.state.storageStatus = 'save_failed';
                return { success: false, error: 'Suspicious evidence loss: refusal records dropped' };
              }

              // Review 60 P1-high (R60-P1-02): Validate stale deletion against modal baseline revision
              if (!isRestoreOrReset && baseRef) {
                var baseRefRec = baseRef.find(function(x) { return x && x.id === prevRefId; });
                if (!baseRefRec) {
                  console.error('Cannot save workspace: stale deletion conflict on refusal record "' + prevRefId + '". Record was added concurrently and is missing from baseline.');
                  if (this.state) this.state.storageStatus = 'save_failed';
                  return { success: false, error: 'Stale deletion conflict: refusal record not present in baseline' };
                }
                var commRefRec = prevRef[pri];
                if (JSON.stringify(commRefRec) !== JSON.stringify(baseRefRec)) {
                  console.error('Cannot save workspace: stale deletion conflict on refusal record "' + prevRefId + '". Committed version has changed since baseline.');
                  if (this.state) this.state.storageStatus = 'save_failed';
                  return { success: false, error: 'Stale deletion conflict: refusal record has been modified concurrently' };
                }
              }
            }
          }
        }
      }

      // Gate B1: Canonical constructor is mandatory; fail closed if unavailable
      if (!storage || typeof storage.createWorkspaceEnvelope !== 'function') {
        console.error('Cannot save workspace: canonical envelope constructor unavailable.');
        if (this.state) this.state.storageStatus = 'save_failed';
        return { success: false, error: 'Canonical envelope constructor unavailable' };
      }

      var candidateEnvelope = { schemaVersion: 2, poolTags: proposedPools };
      if (proposedJobs !== undefined) candidateEnvelope.jobs = proposedJobs;
      if (proposedRoster !== undefined) candidateEnvelope.roster = proposedRoster;
      if (proposedAssignments !== undefined) candidateEnvelope.assignments = proposedAssignments;
      if (proposedRostering !== undefined) candidateEnvelope.rostering = proposedRostering;
      if (proposedSnapshots !== undefined) candidateEnvelope.historicalSnapshots = proposedSnapshots;
      if (proposedPermits !== undefined) candidateEnvelope.permits = proposedPermits;
      if (proposedBudget !== undefined) candidateEnvelope.budgetSettings = proposedBudget;
      if (proposedUiState !== undefined) candidateEnvelope.uiState = proposedUiState;
      if (proposedAbsences !== undefined) candidateEnvelope.absences = proposedAbsences;
      if (proposedRefusals !== undefined) candidateEnvelope.refusalHistory = proposedRefusals;

      var envelope = storage.createWorkspaceEnvelope(candidateEnvelope);

      var res = storage.saveWorkspace(envelope);
      this.state.storageStatus = (res && res.ok) ? 'saved' : ((res && res.storageMode === 'session-only') ? 'session_only' : 'save_failed');
      if (!res || !res.ok) {
        return { success: false, error: (res && res.error) ? res.error : 'Storage write failed' };
      }

      // Review 63 (R63-P0-01 & R63-P1-02): Unconditionally synchronize ALL in-memory domain aliases to the committed envelope
      if (this.state) {
        this.state.poolTags = JSON.parse(JSON.stringify(candidateEnvelope.poolTags || []));
      this.state.jobs = JSON.parse(JSON.stringify(candidateEnvelope.jobs || []));

        var syncedRoster = JSON.parse(JSON.stringify(candidateEnvelope.roster || []));
        this.state.roster = syncedRoster;
        this.state.staffList = syncedRoster;

        var syncedAssignments = JSON.parse(JSON.stringify(candidateEnvelope.assignments || {}));
        this.state.assignments = syncedAssignments;
        this.state.customAssignments = syncedAssignments;

        this.state.rostering = JSON.parse(JSON.stringify(candidateEnvelope.rostering || { instructions: {}, provenance: {} }));
        this.state.historicalSnapshots = JSON.parse(JSON.stringify(candidateEnvelope.historicalSnapshots || {}));

        var syncedPermits = JSON.parse(JSON.stringify(candidateEnvelope.permits || {}));
        this.state.permits = syncedPermits;
        this.state.customPermits = syncedPermits;

        this.state.budgetSettings = JSON.parse(JSON.stringify(candidateEnvelope.budgetSettings || {}));

        var syncedUi = JSON.parse(JSON.stringify(candidateEnvelope.uiState || {}));
        this.state.uiState = syncedUi;
        if (syncedUi.activeView) this.state.activeView = syncedUi.activeView;
        if (syncedUi.currentYear) this.state.currentYear = syncedUi.currentYear;

        this.state.absences = JSON.parse(JSON.stringify(candidateEnvelope.absences || []));

        var syncedRefusals = JSON.parse(JSON.stringify(candidateEnvelope.refusalHistory || []));
        this.state.refusalHistory = syncedRefusals;
        this.state.refusals = syncedRefusals;
      }
      this._updateDomainBaselines(candidateEnvelope);

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
    var detachedPermits = JSON.parse(JSON.stringify(proposedPermits));
    this.state.customPermits = detachedPermits;
    this.state.permits = detachedPermits;
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
    if (this.state.uiState && typeof this.state.uiState === 'object') {
      this.state.uiState.activeView = viewId;
    }
    this.renderCurrentView();
    this.saveCurrentWorkspace();
  },

  setYear: function(year) {
    var parsedYear = parseInt(year, 10) || year;
    this.state.currentYear = parsedYear;
    if (this.state.uiState && typeof this.state.uiState === 'object') {
      this.state.uiState.currentYear = parsedYear;
    }
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
      poolTags: JSON.parse(JSON.stringify(adoptedData.poolTags || [])),
      jobs: Array.isArray(adoptedData.jobs) ? JSON.parse(JSON.stringify(adoptedData.jobs)) : [],
      roster: Array.isArray(adoptedData.roster) ? JSON.parse(JSON.stringify(adoptedData.roster)) : [],
      assignments: (adoptedData.assignments && typeof adoptedData.assignments === 'object') ? JSON.parse(JSON.stringify(adoptedData.assignments)) : {},
      permits: (adoptedData.permits && typeof adoptedData.permits === 'object') ? JSON.parse(JSON.stringify(adoptedData.permits)) : {},
      rostering: (adoptedData.rostering && typeof adoptedData.rostering === 'object') ? JSON.parse(JSON.stringify(adoptedData.rostering)) : { instructions: {}, provenance: {} },
      historicalSnapshots: (adoptedData.historicalSnapshots && typeof adoptedData.historicalSnapshots === 'object') ? JSON.parse(JSON.stringify(adoptedData.historicalSnapshots)) : {},
      budgetSettings: (adoptedData.budgetSettings && typeof adoptedData.budgetSettings === 'object' && adoptedData.budgetSettings !== null)
        ? JSON.parse(JSON.stringify(adoptedData.budgetSettings))
        : defaultBudget,
      absences: Array.isArray(adoptedData.absences) ? JSON.parse(JSON.stringify(adoptedData.absences)) : [],
      refusalHistory: Array.isArray(adoptedData.refusalHistory) ? JSON.parse(JSON.stringify(adoptedData.refusalHistory)) : (Array.isArray(adoptedData.refusals) ? JSON.parse(JSON.stringify(adoptedData.refusals)) : []),
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
    this.state.poolTags = JSON.parse(JSON.stringify(canonicalEnvelope.poolTags || []));
    this.state.staffList = JSON.parse(JSON.stringify(canonicalEnvelope.roster));
    this.state.roster = this.state.staffList;
    this.state.customAssignments = JSON.parse(JSON.stringify(canonicalEnvelope.assignments));
    this.state.assignments = this.state.customAssignments;
    this.state.rostering = JSON.parse(JSON.stringify(canonicalEnvelope.rostering));
    this.state.customPermits = JSON.parse(JSON.stringify(canonicalEnvelope.permits));
    this.state.permits = this.state.customPermits;
    this._allowHistoryReset = true;
    this.state.historicalSnapshots = JSON.parse(JSON.stringify(canonicalEnvelope.historicalSnapshots));
    this._authoritativeSnapshotCount = Object.keys(this.state.historicalSnapshots).length;
    this._allowHistoryReset = false;
    this.state.absences = JSON.parse(JSON.stringify(canonicalEnvelope.absences || []));
    this.state.absenceLedger = this.state.absences;
    this.state.refusalHistory = JSON.parse(JSON.stringify(canonicalEnvelope.refusalHistory || []));
    this.state.refusals = this.state.refusalHistory;
    this.state.uiState = JSON.parse(JSON.stringify(canonicalEnvelope.uiState));
    if (window.HortOpsScheduler && typeof window.HortOpsScheduler.clearBoundaryCache === 'function') {
      window.HortOpsScheduler.clearBoundaryCache();
    }

    this.state.budgetSettings = JSON.parse(JSON.stringify(canonicalEnvelope.budgetSettings));
    this.state.activeView = canonicalEnvelope.uiState.activeView;
    this._updateDomainBaselines(canonicalEnvelope);
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

      if (details) {
        if (details.recoveryBundleJson) {
          this.state.emergencyRecoveryPayload = details.recoveryBundleJson;
          this.state.recoveryRequired = true;
          this.state.recoverySource = 'emergency_transaction_bundle';
          this.state.recoveryError = 'Unrecovered reset failure. Transaction recovery bundle staged in memory/session.';
        } else if (details.recoveryArtifactJson) {
          this.state.emergencyRecoveryPayload = details.recoveryArtifactJson;
          this.state.recoveryRequired = true;
          this.state.recoverySource = 'emergency_session_backup';
          this.state.recoveryError = 'Unrecovered reset failure. Emergency recovery artifact staged in memory/session.';
        }
      }
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
    this.state.poolTags = [];
    this.state.staffList = [];
    this.state.roster = [];
    this.state.customAssignments = {};
    this.state.assignments = {};
    this.state.customPermits = {};
    this.state.permits = {};
    this.state.rostering = { instructions: {}, provenance: {} };
    this._allowHistoryReset = true;
    this.state.historicalSnapshots = {};
    this._authoritativeSnapshotCount = 0;
    this._allowHistoryReset = false;
    var defaultBudget = (window.HortOpsScheduler && window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS) ?
      JSON.parse(JSON.stringify(window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS)) :
      { annualTarget: 0, defaultStandardHoursPerShift: 8 };
    this.state.budgetSettings = defaultBudget;
    this.state.absences = [];
    this.state.absenceLedger = [];
    this.state.refusalHistory = [];
    this.state.refusals = [];
    this.state.uiState = {
      activeView: 'forward_planner',
      currentYear: 2026,
      selectedDepartment: 'all',
      selectedTeam: 'all',
      onlyPreferredCrew: false,
      searchTerm: ''
    };
    this.state.activeView = 'forward_planner';
    // 2026 is the canonical baseline reference year for the self-contained offline dataset
    this.state.currentYear = 2026;
    this._updateDomainBaselines({
      jobs: [],
      roster: [],
      assignments: {},
      rostering: { instructions: {}, provenance: {} },
      historicalSnapshots: {},
      permits: {},
      budgetSettings: defaultBudget,
      uiState: this.state.uiState,
      absences: [],
      refusalHistory: []
    });

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
        // Reconciliation intentionally retains existing presentation fields.
        // Reject hostile incoming colours before that merge can discard them.
        var validator = window.HortOpsSchemaValidator;
        if (!validator || typeof validator.validateOptionalColor !== 'function') {
            return { success: false, error: 'Colour validation unavailable' };
        }
        for (var colorIndex = 0; colorIndex < newStaffList.length; colorIndex++) {
            var incomingStaff = newStaffList[colorIndex];
            if (incomingStaff && !validator.validateOptionalColor(incomingStaff.avatarColor)) {
                return { success: false, error: 'Staff member at index ' + colorIndex + ' has an invalid avatar colour.' };
            }
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
    this.state.roster = proposedRoster;
    this.state.storageStatus = (commitRes.storageMode === 'session-only') ? 'session_only' : 'saved';
    this.recomputeDigest();
    this.renderCurrentView();
    return { success: true };
  },

  handleAutoStagger: function() {
    alert("Notice: Auto-Stagger on legacy anchor weeks is disabled to preserve canonical date-anchored recurrences. Please adjust job anchor dates individually in the Job Registry.");
  },


  saveAbsenceAndRefusalData: function(updatedAbsences, updatedRefusals, options) {
    // Review 60 P0 (R60-P0-01): Reject explicit null for absence or refusal ledger inputs
    if (updatedAbsences !== undefined && (updatedAbsences === null || !Array.isArray(updatedAbsences))) {
      return { success: false, error: 'Invalid absences ledger: must be an array, null is not permitted' };
    }
    if (updatedRefusals !== undefined && (updatedRefusals === null || !Array.isArray(updatedRefusals))) {
      return { success: false, error: 'Invalid refusalHistory ledger: must be an array, null is not permitted' };
    }
    options = options || {};
    var proposal = {};
    if (updatedAbsences !== undefined) proposal.absences = updatedAbsences;
    if (updatedRefusals !== undefined) proposal.refusalHistory = updatedRefusals;
    if (options.baseAbsences !== undefined) proposal.baseAbsences = options.baseAbsences;
    if (options.baseRefusals !== undefined) proposal.baseRefusals = options.baseRefusals;

    var authAbs = [];
    if (Array.isArray(options.deletedAbsenceIds)) {
      authAbs = options.deletedAbsenceIds.slice();
    }
    if (authAbs.length > 0) {
      proposal.authorisedAbsenceDeletions = authAbs;
    }

    var authRef = [];
    if (Array.isArray(options.deletedRefusalIds)) {
      authRef = options.deletedRefusalIds.slice();
    }
    if (authRef.length > 0) {
      proposal.authorisedRefusalDeletions = authRef;
    }

    var commitRes = this._commitCanonicalProposal(proposal);
    if (!commitRes.success) {
      return commitRes;
    }

    if (updatedAbsences !== undefined) this.state.absences = JSON.parse(JSON.stringify(updatedAbsences));
    if (updatedRefusals !== undefined) this.state.refusalHistory = JSON.parse(JSON.stringify(updatedRefusals));
    this.state.storageStatus = (commitRes.storageMode === 'session-only') ? 'session_only' : 'saved';
    this.recomputeDigest();
    this.renderCurrentView();
    return { success: true };
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
        if (window.HortOpsWriterSession) { window.HortOpsWriterSession.start(); return; }
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
