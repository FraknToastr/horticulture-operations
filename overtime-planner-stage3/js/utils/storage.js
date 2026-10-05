// Unified Workspace Storage & Persistence Manager (B1, B2, B3)
// Sole Public Facade for Persistence: coordinates validation, migration, envelope synthesis, and storage I/O.
if (typeof require !== 'undefined') {
  if (typeof window === 'undefined') {
    global.window = global;
  }
  if (typeof window.HortOpsSchemaValidator === 'undefined') {
    try { require('./storage/schemaValidator.js'); } catch (e) {}
  }
  if (typeof window.HortOpsMigrationEngine === 'undefined') {
    try { require('./storage/migrationEngine.js'); } catch (e) {}
  }
  if (typeof window.HortOpsStorageDriver === 'undefined') {
    try { require('./storage/storageDriver.js'); } catch (e) {}
  }
}

window.HortOpsStorage = {
  WORKSPACE_SCHEMA_VERSION: 2,
  SUPPORTED_WORKSPACE_SCHEMA_VERSIONS: [1, 2],
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

  migrateWorkspaceV1toV2: function(parsed) {
    if (window.HortOpsMigrationEngine && typeof window.HortOpsMigrationEngine.migrateWorkspaceV1toV2 === 'function') {
      return window.HortOpsMigrationEngine.migrateWorkspaceV1toV2(parsed);
    }
    throw new Error('Migration engine unavailable: window.HortOpsMigrationEngine is required for Schema 1 migration');
  },

  validateWorkspaceSchema: function(parsed) {
    if (window.HortOpsSchemaValidator && typeof window.HortOpsSchemaValidator.validateWorkspaceSchema === 'function') {
      return window.HortOpsSchemaValidator.validateWorkspaceSchema(parsed);
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
      store = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : null;
      if (!store || typeof store.getItem !== 'function') {
        return { ok: false, unavailable: true, error: 'Persistent storage is unavailable; committed state cannot be verified' };
      }
      raw = store.getItem(this.WORKSPACE_STORAGE_KEY);
      if (raw === null) {
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
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.WORKSPACE_STORAGE_KEY, JSON.stringify(envelope));
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

  loadWorkspace: function(defaultJobs, defaultRoster, defaultBudget) {
    defaultJobs = defaultJobs || [];
    defaultRoster = defaultRoster || [];
    defaultBudget = defaultBudget || (window.HortOpsScheduler && window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS) || {};

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // 1. Authoritative canonical v2 storage key
        var rawV2 = window.localStorage.getItem(this.WORKSPACE_STORAGE_KEY);
        if (rawV2 !== null) {
          var parsedV2;
          try {
            parsedV2 = JSON.parse(rawV2);
          } catch(errV2) {
            console.warn('Persisted v2 workspace corrupted, quarantined without overwriting storage:', errV2);
            return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, 'JSON parse error: ' + (errV2.message || String(errV2)), defaultJobs, defaultRoster, defaultBudget);
          }

          if (parsedV2 === null || typeof parsedV2 !== 'object' || Array.isArray(parsedV2)) {
            console.warn('Persisted v2 workspace root is not an object, quarantined without overwriting storage');
            return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, 'Root structure must be a valid JSON object envelope.', defaultJobs, defaultRoster, defaultBudget);
          }

          var v2Version = parsedV2.schemaVersion;
          if (v2Version === undefined || v2Version === null || typeof v2Version !== 'number' || !Number.isInteger(v2Version)) {
            console.warn('Persisted v2 workspace missing or invalid integer schemaVersion:', v2Version);
            return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, 'Workspace missing or invalid integer schemaVersion: ' + v2Version, defaultJobs, defaultRoster, defaultBudget);
          }

          if (v2Version !== 1 && v2Version !== 2) {
            console.warn('Persisted v2 workspace has unsupported schemaVersion:', v2Version);
            return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, 'Unsupported workspace schema version ' + v2Version + '. This version of the planner supports Schema 1 and Schema 2 only.', defaultJobs, defaultRoster, defaultBudget);
          }

          var isV1UnderV2Key = (v2Version === 1);
          if (isV1UnderV2Key) {
            if (!window.HortOpsMigrationEngine || typeof window.HortOpsMigrationEngine.migrateWorkspaceV1toV2 !== 'function') {
              console.warn('Migration engine missing during v1-in-v2 load, quarantined without overwriting storage');
              return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, 'Migration engine unavailable: window.HortOpsMigrationEngine is required for Schema 1 migration', defaultJobs, defaultRoster, defaultBudget);
            }
            parsedV2 = this.migrateWorkspaceV1toV2(parsedV2);
          }

          // Protocol v2 Invariant A: validate current-v2 presence BEFORE normalizeLineage or adopting state
          if (v2Version === 2) {
            var v2PresenceCheck = (window.HortOpsSchemaValidator && typeof window.HortOpsSchemaValidator.validateCurrentV2Presence === 'function')
              ? window.HortOpsSchemaValidator.validateCurrentV2Presence(parsedV2)
              : { valid: false, error: 'Schema validator unavailable: window.HortOpsSchemaValidator is required' };
            if (!v2PresenceCheck.valid) {
              console.warn('Persisted v2 workspace missing or invalid evidence maps, quarantined without overwriting storage:', v2PresenceCheck.error);
              return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, v2PresenceCheck.error, defaultJobs, defaultRoster, defaultBudget);
            }
          }

          if (window.HortOpsSchemaValidator && typeof window.HortOpsSchemaValidator.normalizeLineage === 'function') {
            window.HortOpsSchemaValidator.normalizeLineage(parsedV2);
          }
          var valResV2 = this.validateWorkspaceSchema(parsedV2);
          if (valResV2.valid) {
            var envelopeV2 = this.createWorkspaceEnvelope(parsedV2);
            if (isV1UnderV2Key) {
              var saveV2Res = this.saveWorkspace(envelopeV2);
              if (!saveV2Res || !saveV2Res.ok) {
                console.warn('Persisting migrated v1-in-v2 envelope failed, preserving raw source:', saveV2Res ? saveV2Res.error : 'Write error');
                return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, 'Migration persistence failed: ' + (saveV2Res ? saveV2Res.error : 'Write error'), defaultJobs, defaultRoster, defaultBudget);
              }
              var verifyV2 = window.localStorage.getItem(this.WORKSPACE_STORAGE_KEY);
              if (!verifyV2) {
                return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, 'Verification failed after v1-in-v2 migration persistence', defaultJobs, defaultRoster, defaultBudget);
              }
            }
            return envelopeV2;
          } else {
            console.warn('Persisted v2 workspace failed validation, quarantined without overwriting storage:', valResV2.error);
            return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, valResV2.error, defaultJobs, defaultRoster, defaultBudget);
          }
        }

        // 2. Only if no v2 workspace exists: atomic migration from legacy v1 workspace key
        var rawV1 = window.localStorage.getItem(this.LEGACY_V1_KEY);
        if (rawV1 !== null) {
          var parsedV1;
          try {
            parsedV1 = JSON.parse(rawV1);
          } catch(errV1) {
            console.warn('Legacy v1 workspace corrupted, preserving legacy v1 untouched:', errV1);
            return this.createWorkspaceRecoveryResult(this.LEGACY_V1_KEY, 'Legacy v1 JSON parse error: ' + (errV1.message || String(errV1)), defaultJobs, defaultRoster, defaultBudget);
          }

          if (parsedV1 === null || typeof parsedV1 !== 'object' || Array.isArray(parsedV1)) {
            console.warn('Legacy v1 workspace root is not an object, preserving legacy v1 untouched');
            return this.createWorkspaceRecoveryResult(this.LEGACY_V1_KEY, 'Legacy v1 root must be a valid JSON object envelope.', defaultJobs, defaultRoster, defaultBudget);
          }

          if (parsedV1.schemaVersion !== undefined && parsedV1.schemaVersion !== null && parsedV1.schemaVersion !== 1) {
            console.warn('Legacy v1 workspace has invalid schemaVersion:', parsedV1.schemaVersion);
            return this.createWorkspaceRecoveryResult(this.LEGACY_V1_KEY, 'Legacy workspace key contains non-v1 schemaVersion: ' + parsedV1.schemaVersion, defaultJobs, defaultRoster, defaultBudget);
          }

          if (!window.HortOpsMigrationEngine || typeof window.HortOpsMigrationEngine.migrateWorkspaceV1toV2 !== 'function') {
            console.warn('Migration engine missing during legacy v1 load, preserving legacy v1 untouched');
            return this.createWorkspaceRecoveryResult(this.LEGACY_V1_KEY, 'Migration engine unavailable: window.HortOpsMigrationEngine is required for Schema 1 migration', defaultJobs, defaultRoster, defaultBudget);
          }
          var migratedV1 = this.migrateWorkspaceV1toV2(parsedV1);
          if (window.HortOpsSchemaValidator && typeof window.HortOpsSchemaValidator.normalizeLineage === 'function') {
            window.HortOpsSchemaValidator.normalizeLineage(migratedV1);
          }
          var valResV1 = this.validateWorkspaceSchema(migratedV1);
          if (valResV1.valid) {
            var envelopeV1 = this.createWorkspaceEnvelope(migratedV1);
            var saveRes = this.saveWorkspace(envelopeV1);
            if (saveRes && saveRes.ok) {
              var verifyRead = window.localStorage.getItem(this.WORKSPACE_STORAGE_KEY);
              if (verifyRead) {
                window.localStorage.removeItem(this.LEGACY_V1_KEY);
                return envelopeV1;
              }
            }
            console.warn('Migration v1 -> v2 persistence failed, preserving legacy v1 untouched.');
            return this.createWorkspaceRecoveryResult(this.LEGACY_V1_KEY, 'Migration persistence failed: ' + (saveRes ? saveRes.error : 'Write error'), defaultJobs, defaultRoster, defaultBudget);
          } else {
            console.warn('Legacy v1 workspace failed migration validation, preserving legacy v1 untouched:', valResV1.error);
            return this.createWorkspaceRecoveryResult(this.LEGACY_V1_KEY, valResV1.error, defaultJobs, defaultRoster, defaultBudget);
          }
        }

        // 3. Seamless migration from legacy offline individual keys (only if neither v2 nor v1 exists)
        var legacyJobs = window.localStorage.getItem('hort_ops_jobs_offline');
        var legacyStaff = window.localStorage.getItem('hort_ops_staff_offline');
        var legacyAssignments = window.localStorage.getItem('hort_ops_assignments_offline');
        var legacyPermits = window.localStorage.getItem('hort_ops_permits_offline');
        var legacyBudget = window.localStorage.getItem('hort_ops_budget_offline');

        var hasAnyLegacyKey = (legacyJobs !== null || legacyStaff !== null || legacyAssignments !== null || legacyPermits !== null || legacyBudget !== null);
        if (hasAnyLegacyKey) {
          var parsedJobs = null;
          if (legacyJobs !== null) {
            try {
              parsedJobs = JSON.parse(legacyJobs);
              if (!Array.isArray(parsedJobs)) throw new Error('Legacy jobs must be an array');
            } catch(e) {
              return this.createWorkspaceRecoveryResult('hort_ops_jobs_offline', 'Legacy jobs parse error: ' + (e.message || String(e)), defaultJobs, defaultRoster, defaultBudget);
            }
          }

          var parsedStaff = null;
          if (legacyStaff !== null) {
            try {
              parsedStaff = JSON.parse(legacyStaff);
              if (!Array.isArray(parsedStaff)) throw new Error('Legacy staff must be an array');
            } catch(e) {
              return this.createWorkspaceRecoveryResult('hort_ops_staff_offline', 'Legacy staff parse error: ' + (e.message || String(e)), defaultJobs, defaultRoster, defaultBudget);
            }
          }

          var parsedAssignments = null;
          if (legacyAssignments !== null) {
            try {
              parsedAssignments = JSON.parse(legacyAssignments);
              if (!parsedAssignments || typeof parsedAssignments !== 'object' || Array.isArray(parsedAssignments)) throw new Error('Legacy assignments must be an object');
            } catch(e) {
              return this.createWorkspaceRecoveryResult('hort_ops_assignments_offline', 'Legacy assignments parse error: ' + (e.message || String(e)), defaultJobs, defaultRoster, defaultBudget);
            }
          }

          var parsedPermits = null;
          if (legacyPermits !== null) {
            try {
              parsedPermits = JSON.parse(legacyPermits);
              if (!parsedPermits || typeof parsedPermits !== 'object' || Array.isArray(parsedPermits)) throw new Error('Legacy permits must be an object');
            } catch(e) {
              return this.createWorkspaceRecoveryResult('hort_ops_permits_offline', 'Legacy permits parse error: ' + (e.message || String(e)), defaultJobs, defaultRoster, defaultBudget);
            }
          }

          var parsedBudget = null;
          if (legacyBudget !== null) {
            try {
              parsedBudget = JSON.parse(legacyBudget);
              if (!parsedBudget || typeof parsedBudget !== 'object' || Array.isArray(parsedBudget)) throw new Error('Legacy budget must be an object');
            } catch(e) {
              return this.createWorkspaceRecoveryResult('hort_ops_budget_offline', 'Legacy budget parse error: ' + (e.message || String(e)), defaultJobs, defaultRoster, defaultBudget);
            }
          }

          var legacyEnvelope = {
            schemaVersion: 1,
            lastSaved: new Date().toISOString(),
            jobs: parsedJobs || defaultJobs,
            roster: parsedStaff || defaultRoster,
            assignments: parsedAssignments || {},
            permits: parsedPermits || {},
            budgetSettings: parsedBudget || defaultBudget,
            uiState: {}
          };
          if (!window.HortOpsMigrationEngine || typeof window.HortOpsMigrationEngine.migrateWorkspaceV1toV2 !== 'function') {
            console.warn('Migration engine missing during legacy individual keys load, preserving legacy keys untouched');
            return this.createWorkspaceRecoveryResult('legacy_individual_keys', 'Migration engine unavailable: window.HortOpsMigrationEngine is required for Schema 1 migration', defaultJobs, defaultRoster, defaultBudget);
          }
          legacyEnvelope = this.migrateWorkspaceV1toV2(legacyEnvelope);
          var valResLegacy = this.validateWorkspaceSchema(legacyEnvelope);
          if (valResLegacy.valid) {
            var envelopeLegacy = this.createWorkspaceEnvelope(legacyEnvelope);
            var saveLegacyRes = this.saveWorkspace(envelopeLegacy);
            if (saveLegacyRes && saveLegacyRes.ok) {
              var verifyLegacy = window.localStorage.getItem(this.WORKSPACE_STORAGE_KEY);
              if (verifyLegacy) {
                window.localStorage.removeItem('hort_ops_jobs_offline');
                window.localStorage.removeItem('hort_ops_staff_offline');
                window.localStorage.removeItem('hort_ops_assignments_offline');
                window.localStorage.removeItem('hort_ops_permits_offline');
                window.localStorage.removeItem('hort_ops_budget_offline');
                return envelopeLegacy;
              }
            }
            console.warn('Migration from legacy individual keys failed persistence, preserving legacy keys untouched.');
            return this.createWorkspaceRecoveryResult('legacy_individual_keys', 'Migration persistence failed: ' + (saveLegacyRes ? saveLegacyRes.error : 'Write error'), defaultJobs, defaultRoster, defaultBudget);
          } else {
            console.warn('Legacy individual keys failed migration validation, preserving legacy keys untouched:', valResLegacy.error);
            return this.createWorkspaceRecoveryResult('legacy_individual_keys', valResLegacy.error, defaultJobs, defaultRoster, defaultBudget);
          }
        }
      }
    } catch(e) {
      console.warn('Failed to load workspace, entering recovery mode:', e);
      return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, 'Unexpected load error: ' + (e.message || String(e)), defaultJobs, defaultRoster, defaultBudget);
    }

    // 4. Default: seed initial workspace ONLY when no user source exists
    if (!window.HortOpsMigrationEngine || typeof window.HortOpsMigrationEngine.createWorkspaceEnvelope !== 'function') {
      return this.createWorkspaceRecoveryResult(this.WORKSPACE_STORAGE_KEY, 'Migration engine unavailable: window.HortOpsMigrationEngine is required to initialize workspace', defaultJobs, defaultRoster, defaultBudget);
    }
    var initial = this.createWorkspaceEnvelope({
      schemaVersion: 2,
      jobs: defaultJobs,
      roster: defaultRoster,
      assignments: {},
      rostering: { instructions: {}, provenance: {} },
      permits: {},
      budgetSettings: defaultBudget,
      historicalSnapshots: {},
      uiState: {}
    });
    this.saveWorkspace(initial);
    return initial;
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
