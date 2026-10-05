// Clean client facade. Compatibility storage.js is excluded from the client build.
window.HortOpsStorage = {
  WORKSPACE_SCHEMA_VERSION: 2,
  SUPPORTED_WORKSPACE_SCHEMA_VERSIONS: [2],
  WORKSPACE_STORAGE_KEY: 'hort_ops_workspace_v2',
  LEGACY_V1_KEY: 'hort_ops_workspace_v1',

  get: function(key, defaultVal) {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.get === 'function') {
      return window.HortOpsStorageDriver.get(key, defaultVal);
    }
    return defaultVal;
  },

  set: function(key, val) {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.set === 'function') {
      return window.HortOpsStorageDriver.set(key, val);
    }
  },

  remove: function(key) {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.remove === 'function') {
      return window.HortOpsStorageDriver.remove(key);
    }
  },

  resetWorkspace: function() {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.resetWorkspace === 'function') {
      return window.HortOpsStorageDriver.resetWorkspace();
    }
    return false;
  },

  restoreEmergencyRecoveryArtifact: function(artifactInput, options) {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.restoreEmergencyRecoveryArtifact === 'function') {
      return window.HortOpsStorageDriver.restoreEmergencyRecoveryArtifact(artifactInput, options);
    }
    return { success: false, error: 'Storage driver does not support emergency recovery restore' };
  },

  prepareParentEvidenceInspection: function(transactionId) {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.prepareParentEvidenceInspection === 'function') {
      return window.HortOpsStorageDriver.prepareParentEvidenceInspection(transactionId);
    }
    return { success: false, error: 'Storage driver does not support parent evidence inspection preparation' };
  },

  recordParentEvidenceInspected: function(transactionId, receipt) {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.recordParentEvidenceInspected === 'function') {
      return window.HortOpsStorageDriver.recordParentEvidenceInspected(transactionId, receipt);
    }
    return { success: false, error: 'Storage driver does not support recording parent evidence inspection' };
  },

  inspectParentPriorEvidence: function(transactionId, options) {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.inspectParentPriorEvidence === 'function') {
      return window.HortOpsStorageDriver.inspectParentPriorEvidence(transactionId, options);
    }
    return { success: false, error: 'Storage driver does not support parent evidence inspection' };
  },

  prepareParentEvidenceExport: function(transactionId) {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.prepareParentEvidenceExport === 'function') {
      return window.HortOpsStorageDriver.prepareParentEvidenceExport(transactionId);
    }
    return { success: false, error: 'Storage driver does not support parent evidence export preparation' };
  },

  recordParentEvidenceExportInitiated: function(transactionId) {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.recordParentEvidenceExportInitiated === 'function') {
      return window.HortOpsStorageDriver.recordParentEvidenceExportInitiated(transactionId);
    }
    return { success: false, error: 'Storage driver does not support recording parent evidence export' };
  },

  exportParentPriorEvidence: function(transactionId, options) {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.exportParentPriorEvidence === 'function') {
      return window.HortOpsStorageDriver.exportParentPriorEvidence(transactionId, options);
    }
    return { success: false, error: 'Storage driver does not support parent evidence export' };
  },

  acknowledgeParentPriorEvidence: function(transactionId, options) {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.acknowledgeParentPriorEvidence === 'function') {
      return window.HortOpsStorageDriver.acknowledgeParentPriorEvidence(transactionId, options);
    }
    return { success: false, error: 'Storage driver does not support parent evidence acknowledgement' };
  },

  retireCompositeParentBundle: function(transactionId, options) {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.retireCompositeParentBundle === 'function') {
      return window.HortOpsStorageDriver.retireCompositeParentBundle(transactionId, options);
    }
    return { success: false, error: 'Storage driver does not support composite bundle retirement' };
  },

  extractWorkspaceArtifactFromBundle: function(bundleInput) {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.extractWorkspaceArtifactFromBundle === 'function') {
      return window.HortOpsStorageDriver.extractWorkspaceArtifactFromBundle(bundleInput);
    }
    return null;
  },

  getLastResetResult: function() {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.getLastResetResult === 'function') {
      return window.HortOpsStorageDriver.getLastResetResult();
    }
    return null;
  },

  getStorageHealth: function() {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.getStorageHealth === 'function') {
      return window.HortOpsStorageDriver.getStorageHealth();
    }
    return { status: 'healthy', probeOk: true, usedBytes: 0, percentUsed: 0, lastSaved: new Date().toISOString() };
  },

  compactStorage: function() {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.compactStorage === 'function') {
      return window.HortOpsStorageDriver.compactStorage();
    }
    return { success: false, prunedCount: 0, reclaimedBytes: 0, health: this.getStorageHealth() };
  },

  getRawQuarantinePayload: function() {
    if (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.emergencyRecoveryPayload) { return window.HortOpsApp.state.emergencyRecoveryPayload; }
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.getRawQuarantinePayload === 'function') {
      return window.HortOpsStorageDriver.getRawQuarantinePayload();
    }
    return '';
  },

  createWorkspaceEnvelope: function(data) {
    if (window.HortOpsMigrationEngine && typeof window.HortOpsMigrationEngine.createWorkspaceEnvelope === 'function') {
      return window.HortOpsMigrationEngine.createWorkspaceEnvelope(data);
    }
    throw new Error('Migration engine unavailable: window.HortOpsMigrationEngine is required');
  },

  createWorkspaceRecoveryResult: function(source, error, defaultJobs, defaultRoster, defaultBudget) {
    if (window.HortOpsMigrationEngine && typeof window.HortOpsMigrationEngine.createWorkspaceRecoveryResult === 'function') {
      return window.HortOpsMigrationEngine.createWorkspaceRecoveryResult(source, error, defaultJobs, defaultRoster, defaultBudget);
    }
    return {
      schemaVersion: this.WORKSPACE_SCHEMA_VERSION,
      lastSaved: new Date().toISOString(),
      jobs: defaultJobs || [],
      roster: defaultRoster || [],
      assignments: {},
      rostering: { instructions: {}, provenance: {} },
      permits: {},
      budgetSettings: defaultBudget || {},
      uiState: {},
      historicalSnapshots: {},
      recoveryRequired: true,
      recoverySource: source,
      recoveryError: error
    };
  },

  validateWorkspaceSchema: function(parsed) {
    if (window.HortOpsSchemaValidator && typeof window.HortOpsSchemaValidator.validateWorkspaceSchema === 'function') {
      return window.HortOpsSchemaValidator.validateCurrentV2ForBoundary(parsed);
    }
    return {
      valid: false,
      stage: 'validation',
      error: 'Schema validator unavailable: window.HortOpsSchemaValidator is required',
      errors: ['Schema validator unavailable: window.HortOpsSchemaValidator is required']
    };
  },

  validateCurrentV2Presence: function(parsed) {
    if (window.HortOpsSchemaValidator && typeof window.HortOpsSchemaValidator.validateCurrentV2Presence === 'function') {
      return window.HortOpsSchemaValidator.validateCurrentV2Presence(parsed);
    }
    return { valid: false, error: 'Schema validator unavailable: window.HortOpsSchemaValidator is required' };
  },

  validateCurrentV2ForBoundary: function(parsed) {
    if (window.HortOpsSchemaValidator && typeof window.HortOpsSchemaValidator.validateCurrentV2ForBoundary === 'function') {
      return window.HortOpsSchemaValidator.validateCurrentV2ForBoundary(parsed);
    }
    return { valid: false, error: 'Schema validator unavailable: window.HortOpsSchemaValidator is required' };
  },

  prepareWorkspaceJsonImport: function(jsonStr) {
    if (window.HortOpsMigrationEngine && typeof window.HortOpsMigrationEngine.prepareWorkspaceJsonImport === 'function') {
      return window.HortOpsMigrationEngine.prepareWorkspaceJsonImport(jsonStr);
    }
    return { success: false, error: 'Migration engine unavailable' };
  },

  importWorkspaceJson: function(jsonStr) {
    var prepRes = this.prepareWorkspaceJsonImport(jsonStr);
    if (!prepRes.success) {
      return prepRes;
    }
    var envelope = prepRes.data;
    var saveRes = this.saveWorkspace(envelope);
    if (!saveRes.ok) {
      return {
        success: false,
        stage: 'persistence',
        error: 'Workspace parsed and validated, but failed to persist to storage: ' + (saveRes.error || 'Write failure'),
        storageResult: saveRes,
        data: envelope
      };
    }
    return { success: true, data: envelope, storageResult: saveRes, migrated: prepRes.migrated };
  },

  readVerifiedCommittedV2: function() {
    var store, raw, parsed, check;
    var validator = window.HortOpsSchemaValidator;
    if (!validator || typeof validator.validateCurrentV2ForBoundary !== 'function') {
      return { ok: false, error: 'Canonical Schema v2 validator unavailable' };
    }
    try {
      store = (typeof window !== 'undefined' && window.HortOpsClientStorage.localStorage) ? window.HortOpsClientStorage.localStorage : null;
      if (!store || typeof store.getItem !== 'function') {
        return { ok: false, unavailable: true, error: 'Persistent storage is unavailable; committed state cannot be verified' };
      }
      raw = store.getItem(this.WORKSPACE_STORAGE_KEY);
      if (raw === null) {
        var session = window.HortOpsClientStorage.sessionStorage;
        for (var index = 0; index < session.length; index++) {
          var artifactKey = session.key(index);
          if (artifactKey && artifactKey.indexOf('hort_ops_emergency_recovery_v2') === 0) {
            return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, 'Unresolved recovery evidence: initialisation is blocked', [], [], budget);
          }
        }
        return { ok: true, exists: false, raw: null, data: null };
      }
      parsed = JSON.parse(raw);
    } catch (e) {
      return { ok: false, error: 'Stored workspace cannot be read or parsed: ' + (e.message || String(e)) };
    }
    check = validator.validateCurrentV2ForBoundary(parsed);
    if (!check.valid) {
      return { ok: false, error: 'Stored workspace failed Schema v2 validation: ' + (check.error || 'invalid workspace') };
    }
    return { ok: true, exists: true, raw: raw, data: check.data || parsed };
  },

  saveWorkspace: function(workspace) {
    if (!workspace || typeof workspace !== 'object') {
      return {
        ok: false,
        stage: 'validation',
        savedAt: new Date().toISOString(),
        storageMode: 'session-only',
        error: 'Invalid workspace object'
      };
    }
    var savedAt = new Date().toISOString();
    var validator = window.HortOpsSchemaValidator;
    if (!validator || typeof validator.validateCurrentV2ForBoundary !== 'function') {
      return {
        ok: false,
        stage: 'validation',
        storageMode: 'unchanged',
        savedAt: savedAt,
        error: 'Current-v2 validator unavailable: window.HortOpsSchemaValidator.validateCurrentV2ForBoundary is required'
      };
    }
    var check = validator.validateCurrentV2ForBoundary(workspace);
    if (!check.valid) {
      return {
        ok: false,
        stage: 'validation',
        storageMode: 'unchanged',
        savedAt: savedAt,
        error: 'Workspace validation failed: ' + (check.error || 'Invalid Schema v2 structure'),
        errors: check.error ? [check.error] : ['Invalid Schema v2 structure']
      };
    }

    var sourceData = check.data || workspace;
    var envelope = Object.assign({}, sourceData, {
      lastSaved: sourceData.lastSaved || savedAt
    });

    try {
      if (typeof window !== 'undefined' && window.HortOpsClientStorage.localStorage) {
        window.HortOpsClientStorage.localStorage.setItem(this.WORKSPACE_STORAGE_KEY, JSON.stringify(envelope));
        if (window.HortOpsApp && typeof window.HortOpsApp._updateDomainBaselines === 'function') {
          window.HortOpsApp._updateDomainBaselines(envelope);
        }
        return {
          ok: true,
          stage: 'persistence',
          savedAt: savedAt,
          storageMode: 'persistent',
          error: null
        };
      }
      return {
        ok: true,
        stage: 'persistence',
        savedAt: savedAt,
        storageMode: 'session-only',
        error: null
      };
    } catch(e) {
      console.error('Failed to save workspace to localStorage:', e);
      return {
        ok: false,
        stage: 'persistence',
        savedAt: savedAt,
        storageMode: 'session-only',
        error: e.message || String(e)
      };
    }
  },

  loadWorkspace: function() {
    var budget = (window.HortOpsScheduler && window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS) || {};
    try {
      var raw = window.HortOpsClientStorage.localStorage.getItem(this.WORKSPACE_STORAGE_KEY);
      if (raw === null) {
        var empty = this.createWorkspaceEnvelope({
          schemaVersion: 2, jobs: [], roster: [], assignments: {},
          rostering: { instructions: {}, provenance: {} }, historicalSnapshots: {},
          permits: {}, budgetSettings: budget, uiState: {}, absences: [], refusalHistory: []
        });
        if (window.HortOpsWriterSession && window.HortOpsWriterSession.canWrite()) {
          var seeded = this.saveWorkspace(empty);
          if (!seeded.ok) return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, seeded.error, [], [], budget);
        }
        return empty;
      }
      var imported = this.prepareWorkspaceJsonImport(raw);
      if (!imported.success) return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, imported.error, [], [], budget);
      return imported.data;
    } catch (error) {
      return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, error.message || String(error), [], [], budget);
    }
  },
  getStorageHealth: function() {
    if (window.HortOpsStorageDriver && typeof window.HortOpsStorageDriver.getStorageHealth === 'function') {
      return window.HortOpsStorageDriver.getStorageHealth();
    }
    return {
      status: 'unavailable',
      probeOk: false,
      usedBytes: 0,
      percentUsed: 0,
      error: 'Storage driver unavailable: window.HortOpsStorageDriver is required',
      lastSaved: null
    };
  }
};
