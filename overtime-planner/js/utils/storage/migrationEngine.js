// Workspace Migration Engine & Envelope Synthesis
// Manages Schema v1 to v2 migration, envelope synthesis, recovery packaging, and backup preparation.
window.HortOpsMigrationEngine = {
  WORKSPACE_SCHEMA_VERSION: 2,
  SUPPORTED_WORKSPACE_SCHEMA_VERSIONS: [1, 2],

  /**
   * Migrates Schema v1 workspace payload to Schema v2 with explicit statuses.
   * @param {Object} parsed - Source payload
   * @returns {Object} Migrated payload
   */
  migrateWorkspaceV1toV2: function(parsed) {
    if (!parsed || typeof parsed !== 'object') return parsed;
    var migrated = Object.assign({}, parsed);
    migrated.schemaVersion = this.WORKSPACE_SCHEMA_VERSION;
    if (Array.isArray(migrated.jobs)) {
      migrated.jobs = migrated.jobs.map(function(j) {
        if (!j || typeof j !== 'object') return j;
        var copy = Object.assign({}, j);
        if (copy.status === undefined || copy.status === null || String(copy.status).trim() === '') {
          copy.status = 'active';
        }
        return copy;
      });
    }
    if (Array.isArray(migrated.roster)) {
      migrated.roster = migrated.roster.map(function(s) {
        if (!s || typeof s !== 'object') return s;
        var copy = Object.assign({}, s);
        if (copy.status === undefined || copy.status === null || String(copy.status).trim() === '') {
          copy.status = 'active';
        }
        return copy;
      });
    }
    if (!migrated.assignments && migrated.customAssignments) {
      migrated.assignments = migrated.customAssignments;
    }
    if (!migrated.assignments || typeof migrated.assignments !== 'object' || Array.isArray(migrated.assignments)) {
      migrated.assignments = {};
    }
    var ownV1 = Object.prototype.hasOwnProperty;
    if (ownV1.call(parsed, 'customAssignments')) {
      if (ownV1.call(parsed, 'assignments')) {
        throw new Error(
          'Ambiguous Schema v1 assignment sources require explicit recovery'
        );
      }
      // Existing v1 logic above has copied the legacy alias to assignments.
      delete migrated.customAssignments;
    }
    if (!migrated.permits || typeof migrated.permits !== 'object' || Array.isArray(migrated.permits)) {
      migrated.permits = {};
    }
    if (!migrated.budgetSettings || typeof migrated.budgetSettings !== 'object' || Array.isArray(migrated.budgetSettings)) {
      migrated.budgetSettings = {};
    }
    if (!migrated.uiState || typeof migrated.uiState !== 'object' || Array.isArray(migrated.uiState)) {
      migrated.uiState = {};
    }
    migrated.historicalSnapshots = {};
    migrated.rostering = { instructions: {}, provenance: {} };
    return migrated;
  },

  createWorkspaceEnvelope: function(data) {
    var validator = window.HortOpsSchemaValidator;
    var candidate;
    var checked;
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.schemaVersion !== 2) {
      throw new Error('Explicit current-v2 workspace required');
    }
    if (!validator || typeof validator.validateCurrentV2ForBoundary !== 'function') {
      throw new Error('Canonical current-v2 validator unavailable');
    }

    var own = Object.prototype.hasOwnProperty;
    if (own.call(data, 'customAssignments')) {
      throw new Error(
        'Ambiguous current-v2 workspace: customAssignments is a runtime-only field; ' +
        'project to canonical assignments before construction'
      );
    }
    candidate = {
      schemaVersion: 2,
      lastSaved: data.lastSaved === undefined ? new Date().toISOString() : data.lastSaved
    };
    if (own.call(data, 'jobs')) candidate.jobs = data.jobs;
    if (own.call(data, 'roster')) candidate.roster = data.roster;
    if (own.call(data, 'assignments')) candidate.assignments = data.assignments;
    if (own.call(data, 'rostering')) candidate.rostering = data.rostering;
    if (own.call(data, 'historicalSnapshots')) candidate.historicalSnapshots = data.historicalSnapshots;
    if (own.call(data, 'permits')) candidate.permits = data.permits;
    if (own.call(data, 'budgetSettings')) candidate.budgetSettings = data.budgetSettings;
    if (own.call(data, 'uiState')) candidate.uiState = data.uiState;
    checked = validator.validateCurrentV2ForBoundary(candidate);
    if (!checked.valid) {
      throw new Error(checked.error || 'Invalid current-v2 workspace');
    }
    checked.data.recoveryRequired = false;
    return checked.data; // fully detached, validated canonical envelope with recoveryRequired: false
  },

  createWorkspaceRecoveryResult: function(source, error, defaultJobs, defaultRoster, defaultBudget) {
    return {
      schemaVersion: this.WORKSPACE_SCHEMA_VERSION,
      lastSaved: new Date().toISOString(),
      jobs: defaultJobs || [],
      roster: defaultRoster || [],
      assignments: {},
      rostering: { instructions: {}, provenance: {} },
      permits: {},
      budgetSettings: defaultBudget || (window.HortOpsScheduler && window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS) || {},
      uiState: {},
      historicalSnapshots: {},
      recoveryRequired: true,
      recoverySource: source,
      recoveryError: error
    };
  },

  prepareWorkspaceJsonImport: function(jsonStr) {
    if (!jsonStr || typeof jsonStr !== 'string') {
      return { success: false, error: 'Empty or invalid JSON backup file content.' };
    }
    try {
      var parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { success: false, error: 'Workspace backup root must be a valid JSON object.' };
      }
      var sourceVersion = parsed.schemaVersion;
      if (sourceVersion === undefined || sourceVersion === null || typeof sourceVersion !== 'number' || !Number.isInteger(sourceVersion)) {
        return { success: false, error: 'Workspace backup missing or invalid integer schemaVersion: ' + sourceVersion };
      }
      if (sourceVersion !== 1 && sourceVersion !== 2) {
        return { success: false, error: 'Unsupported workspace schema version ' + sourceVersion + '. This version of the planner supports Schema 1 and Schema 2 only.' };
      }
      var isMigrated = false;
      if (sourceVersion === 1) {
        parsed = this.migrateWorkspaceV1toV2(parsed);
        isMigrated = true;
      }
      // Protocol v2 Invariant A: validate current-v2 presence without contextual exceptions
      if (sourceVersion === 2) {
        var validator = window.HortOpsSchemaValidator;
        if (!validator || typeof validator.validateCurrentV2Presence !== 'function') {
          return { success: false, stage: 'validation', schemaVersion: 2, error: 'Schema validator unavailable: window.HortOpsSchemaValidator is required' };
        }
        var shape = validator.validateCurrentV2Presence(parsed);
        if (!shape.valid) {
          return { success: false, stage: 'validation', schemaVersion: 2, error: shape.error };
        }
      }

      var validator = window.HortOpsSchemaValidator;
      if (!validator || typeof validator.validateWorkspaceSchema !== 'function') {
        return { success: false, error: 'Schema validator unavailable: window.HortOpsSchemaValidator is required', schemaVersion: sourceVersion };
      }
      var valRes = validator.validateWorkspaceSchema(parsed);
      if (!valRes.valid) {
        return { success: false, error: valRes.error, schemaVersion: sourceVersion };
      }
      var envelope = this.createWorkspaceEnvelope(parsed);
      return {
        success: true,
        migrated: isMigrated,
        sourceSchemaVersion: sourceVersion,
        targetSchemaVersion: this.WORKSPACE_SCHEMA_VERSION,
        data: envelope
      };
    } catch(e) {
      return { success: false, error: 'Failed to parse JSON backup: ' + (e.message || String(e)) };
    }
  }
};
