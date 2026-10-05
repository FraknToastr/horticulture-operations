// Current-schema-only client envelope builder. Historical migration engine is test-only.
window.HortOpsMigrationEngine = {
  WORKSPACE_SCHEMA_VERSION: 2,
  SUPPORTED_WORKSPACE_SCHEMA_VERSIONS: [2],
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
    if (own.call(data, 'poolTags')) candidate.poolTags = data.poolTags;
    if (own.call(data, 'jobs')) candidate.jobs = data.jobs;
    if (own.call(data, 'roster')) candidate.roster = data.roster;
    if (own.call(data, 'assignments')) candidate.assignments = data.assignments;
    if (own.call(data, 'rostering')) candidate.rostering = data.rostering;
    if (own.call(data, 'historicalSnapshots')) candidate.historicalSnapshots = data.historicalSnapshots;
    if (own.call(data, 'permits')) candidate.permits = data.permits;
    if (own.call(data, 'budgetSettings')) candidate.budgetSettings = data.budgetSettings;
    if (own.call(data, 'uiState')) candidate.uiState = data.uiState;
    if (own.call(data, 'absences')) {
      if (data.absences === null || !Array.isArray(data.absences)) {
        throw new Error('Invalid current-v2 field: absences: expected array, null is not permitted');
      }
      candidate.absences = data.absences;
    }
    if (own.call(data, 'refusals')) candidate.refusals = data.refusals;
    if (own.call(data, 'refusalHistory')) {
      if (data.refusalHistory === null || !Array.isArray(data.refusalHistory)) {
        throw new Error('Invalid current-v2 field: refusalHistory: expected array, null is not permitted');
      }
      candidate.refusalHistory = data.refusalHistory;
    }
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
      absences: [],
      refusalHistory: [],
      recoveryRequired: true,
      recoverySource: source,
      recoveryError: error
    };
  },

  prepareWorkspaceJsonImport: function(raw) {
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.schemaVersion !== 2) return { success: false, error: 'Only current Schema v2 backups are supported' };
      var result = window.HortOpsSchemaValidator.validateCurrentV2ForBoundary(parsed);
      if (!result.valid) return { success: false, error: result.error };
      return { success: true, migrated: false, sourceSchemaVersion: 2, targetSchemaVersion: 2, data: this.createWorkspaceEnvelope(result.data) };
    } catch (error) { return { success: false, error: error.message || String(error) }; }
  }
};

