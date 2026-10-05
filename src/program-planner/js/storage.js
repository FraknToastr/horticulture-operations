(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var appConfig = UOS.ProgramAppConfig && typeof UOS.ProgramAppConfig.current === "function" ? UOS.ProgramAppConfig.current() : null;
  var canonicalApp = appConfig && appConfig.appId || "suite";
  var canonicalName = appConfig ? "workspace" : "unified-workspace";
  var CANONICAL = { app: canonicalApp, name: canonicalName, key: canonicalApp + ":" + canonicalName };
  var migrationName = appConfig ? "legacy-import-state" : "unified-workspace-migration-v2";
  var MIGRATION = { app: canonicalApp, name: migrationName, key: canonicalApp + ":" + migrationName };
  var VERIFIED = { app: canonicalApp, name: canonicalName, key: "__last-verified__:" + CANONICAL.key };
  var LEGACY = {
    nature: { app: "uos.nature-strip", name: "workspace", key: "uos.nature-strip:workspace" },
    remediation: { app: "uos.remediation", name: "default", key: "uos.remediation:default" }
  };
  var saveQueue = Promise.resolve();

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function storage() {
    if (!UOS.storage || typeof UOS.storage.get !== "function" || typeof UOS.storage.set !== "function") {
      throw new Error("UOS.storage must be loaded before ProgramStorage.");
    }
    return UOS.storage;
  }

  function model() {
    if (!UOS.ProgramModel) throw new Error("UOS.ProgramModel must be loaded before ProgramStorage.");
    return UOS.ProgramModel;
  }

  function normalizeAndValidate(workspace) {
    var api = model();
    var normalized = typeof api.normalize === "function" ? api.normalize(clone(workspace)) : clone(workspace);
    if (typeof api.assertValid === "function") api.assertValid(normalized);
    else if (typeof api.validate === "function") {
      var errors = api.validate(normalized);
      if (Array.isArray(errors) && errors.length) throw new Error(errors.join("\n"));
      if (errors === false) throw new Error("The Horticulture Program workspace is invalid.");
    } else throw new Error("UOS.ProgramModel must expose assertValid() or validate().");
    if (!normalized || normalized.app !== model().appId || Number(normalized.schemaVersion) !== Number(model().schemaVersion)) {
      throw new Error("Only the active " + model().appId + " schemaVersion " + model().schemaVersion + " workspace can be saved.");
    }
    return normalized;
  }

  function revisionOf(workspace) {
    var value = workspace && workspace.workspaceRevision;
    return Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
  }

  function durableGet() {
    var store = storage();
    if (typeof store.getStrict !== "function") return Promise.reject(new Error("Strict durable workspace reads are unavailable."));
    return store.getStrict(CANONICAL.app, CANONICAL.name);
  }

  function canonicalMutationChanged(current, candidate) {
    function canonicalPayload(value) {
      var payload = clone(value || {});
      delete payload.workspaceRevision;
      delete payload.updatedAt;
      /* `workspace` is presentation/session navigation state. Persisting it is
         allowed, but it does not consume the canonical business revision. */
      delete payload.workspace;
      return payload;
    }
    return JSON.stringify(canonicalPayload(current)) !== JSON.stringify(canonicalPayload(candidate));
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") {
      var output = {};
      Object.keys(value).sort().forEach(function (name) { output[name] = stableValue(value[name]); });
      return output;
    }
    return value;
  }
  function equivalent(left, right) { return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right)); }

  function recoverLastVerified(lease, options) {
    var store = storage();
    options = options || {};
    if (typeof store.getLastVerified !== "function") return Promise.reject(new Error("Last-verified workspace recovery is unavailable."));
    return Promise.all([
      durableGet().catch(function () { return undefined; }),
      store.getLastVerified(CANONICAL.app, CANONICAL.name)
    ]).then(function (values) {
      var current = null, verified = null;
      try { if (values[0]) current = normalizeAndValidate(values[0]); } catch (_) { current = null; }
      try {
        if (values[1] && values[1].workspace && Number(values[1].revision) === revisionOf(values[1].workspace)) {
          verified = normalizeAndValidate(values[1].workspace);
        }
      } catch (_) { verified = null; }
      var currentRejected = options.unverifiedRevision != null && current && revisionOf(current) === Number(options.unverifiedRevision);
      var recovered = !currentRejected && current && (!verified || revisionOf(current) >= revisionOf(verified)) ? current : verified;
      if (!recovered) throw new Error("No valid durable workspace revision can be recovered.");
      if (current && equivalent(current, recovered)) return recovered;
      if (typeof store.restoreVerified !== "function") throw new Error("Guarded revision recovery is unavailable.");
      return store.restoreVerified(CANONICAL.app, CANONICAL.name, recovered, revisionOf(values[0]), lease).then(function () {
        return durableGet().then(function (readBack) {
          var checked = normalizeAndValidate(readBack);
          if (!equivalent(checked, recovered)) throw new Error("Recovered workspace failed durable read-back verification.");
          return checked;
        });
      });
    });
  }

  function commitNormalized(normalized, lease, options) {
    var store = storage();
    if (typeof store.commitRevision !== "function") return Promise.reject(new Error("Revision-aware durable commits are unavailable."));
    options = options || {};
    var baseRevision = options.baseRevision == null ? revisionOf(normalized) : Number(options.baseRevision);
    if (!Number.isInteger(baseRevision) || baseRevision < 0) return Promise.reject(new TypeError("baseRevision must be a non-negative integer."));
    return durableGet().then(function (currentRaw) {
      var current = currentRaw ? normalizeAndValidate(currentRaw) : null;
      var candidate = clone(normalized);
      var sessionOnly = options.mutationKind === "session" || options.mutationKind === "ui" || options.mutationKind === "navigation";
      var changed = sessionOnly ? false : canonicalMutationChanged(current, candidate);
      /* Imports and explicit business mutations always represent one local
         canonical mutation; their embedded source revision is never adopted. */
      if (options.mutationKind === "import" || options.mutationKind === "business") changed = true;
      candidate.workspaceRevision = baseRevision + (changed ? 1 : 0);
      return store.commitRevision(CANONICAL.app, CANONICAL.name, candidate, baseRevision, lease).then(function () {
        return durableGet().then(function (readBack) {
          var checked = normalizeAndValidate(readBack);
          if (!equivalent(checked, candidate)) throw new Error("Committed workspace failed durable read-back verification.");
          if (typeof store.promoteVerified !== "function") throw new Error("Verified revision promotion is unavailable.");
          return store.promoteVerified(CANONICAL.app, CANONICAL.name, checked, lease).then(function () { return checked; });
        });
      }).catch(function (error) {
        if (error && (error.name === "WorkspaceRevisionConflictError" || error.name === "WorkspaceReadOnlyError")) throw error;
        return recoverLastVerified(lease, { unverifiedRevision: candidate.workspaceRevision }).then(function () { throw error; }, function (recoveryError) {
          recoveryError.cause = error;
          recoveryError.message += " Original commit failure: " + String(error && error.message || error);
          throw recoveryError;
        });
      });
    });
  }

  function recoverLegacyRelationships(workspace, originalError) {
    var candidate = clone(workspace);
    var entities = candidate.entities;
    if (!entities || typeof entities !== "object") throw originalError;
    var quarantined = [];
    var removed = {};

    function text(value) { return String(value == null ? "" : value).trim(); }
    function rows(collection) { return Array.isArray(entities[collection]) ? entities[collection] : []; }
    function remove(collection, predicate, reason) {
      var retained = [];
      rows(collection).forEach(function (record) {
        if (!predicate(record)) { retained.push(record); return; }
        var id = text(record && record.id);
        quarantined.push({ collection: collection, id: id, payload: clone(record), reason: reason(record) });
        if (id) removed[id] = collection;
      });
      entities[collection] = retained;
    }
    function index(collection) {
      var result = {};
      rows(collection).forEach(function (record) { if (text(record && record.id)) result[text(record.id)] = record; });
      return result;
    }

    /* This is deliberately limited to relationship shapes emitted before the
       canonical Project boundary. It preserves records instead of guessing a
       Project, Job, Quote, or commercial lineage. */
    remove("jobs", function (job) { return !text(job && job.projectId); }, function () { return "Legacy Job requires projectId before restoration."; });
      remove("costingLines", function (line) { return !text(line && line.projectId); }, function () { return "Legacy Costing Line requires projectId before restoration."; });
    remove("quotes", function (quote) { return !text(quote && quote.projectId); }, function () { return "Legacy Quote requires projectId before restoration."; });

    var quotes = index("quotes");
    remove("quoteLines", function (line) {
      var quote = quotes[text(line && line.quoteId)];
      return !text(line && line.projectId) || Boolean(quote && line.projectId !== quote.projectId);
    }, function () { return "Legacy Quote Line requires a projectId matching its Quote before restoration."; });

    /* Quarantining an invalid parent must also quarantine its direct canonical
       dependants, otherwise recovery itself would manufacture dangling links. */
    var changed = true;
    while (changed) {
      var before = quarantined.length;
      remove("jobs", function (job) { return Boolean(removed[text(job && job.parentJobId)]); }, function () { return "Job depends on a quarantined parent Job."; });
      remove("tasks", function (task) { return Boolean(removed[text(task && task.jobId)]); }, function () { return "Task depends on a quarantined Job."; });
      remove("costingLines", function (line) { return Boolean(removed[text(line && line.jobId)]); }, function () { return "Costing Line depends on a quarantined Job."; });
      remove("quoteLines", function (line) {
        return Boolean(removed[text(line && line.quoteId)] || removed[text(line && line.jobId)] || removed[text(line && line.costingLineId)]);
      }, function () { return "Quote Line depends on a quarantined Quote, Job, or Costing Line."; });
      changed = quarantined.length !== before;
    }

    if (!quarantined.length) throw originalError;
    candidate.migration = candidate.migration && typeof candidate.migration === "object" ? candidate.migration : {};
    var priorRecovery = candidate.migration.recovery && typeof candidate.migration.recovery === "object" ? candidate.migration.recovery : {};
    var priorItems = Array.isArray(priorRecovery.items) ? priorRecovery.items : [];
    var priorRecords = Array.isArray(priorRecovery.records) ? priorRecovery.records : [];
    candidate.migration.recovery = {
      kind: "legacy-canonical-relationships",
      status: "review-required",
      recoveredAt: new Date().toISOString(),
      count: priorItems.length + quarantined.length,
      items: clone(priorItems.concat(quarantined)),
      /* Retained for compatibility with the original costing-only recovery. */
      records: clone(priorRecords.concat(quarantined.map(function (item) { return item.payload; })))
    };
    candidate.migration.unresolvedLinks = Array.isArray(candidate.migration.unresolvedLinks) ? candidate.migration.unresolvedLinks : [];
    quarantined.forEach(function (item) {
      var record = item.payload;
      var relationships = {
        jobs: [["projectId", "projects"]],
        tasks: [["jobId", "jobs"]],
        costingLines: [["projectId", "projects"], ["jobId", "jobs"]],
        quotes: [["projectId", "projects"]],
        quoteLines: [["projectId", "projects"], ["quoteId", "quotes"], ["jobId", "jobs"], ["costingLineId", "costingLines"]]
      }[item.collection] || [];
      relationships.forEach(function (relationship) {
        var field = relationship[0], targetCollection = relationship[1];
        if (text(record[field]) && !removed[text(record[field])] && field !== "projectId") return;
        candidate.migration.unresolvedLinks.push({ id: item.id + ":" + field, sourceCollection: item.collection, sourceId: item.id, field: field, targetCollection: targetCollection, targetId: text(record[field]), status: "unresolved", reason: item.reason, candidates: [] });
      });
    });
    candidate.migration.warnings = Array.isArray(candidate.migration.warnings) ? candidate.migration.warnings : [];
    candidate.migration.warnings.push(quarantined.length + " legacy records with unresolved canonical relationships were quarantined during startup; review Data Health before restoring them.");
    var normalized = model().normalize(candidate);
    model().assertValid(normalized);
    return normalized;
  }

  function get() {
    var store = storage();
    return Promise.all([
      durableGet(),
      typeof store.getLastVerified === "function" ? store.getLastVerified(CANONICAL.app, CANONICAL.name) : Promise.resolve(null)
    ]).then(function (values) {
      var workspace = values[0];
      var verification = values[1];
      if (workspace == null) return null;
      if (verification && verification.pendingRevision != null && Number(verification.pendingRevision) === revisionOf(workspace)) {
        return recoverLastVerified(null, { unverifiedRevision: verification.pendingRevision });
      }
      /* Schema v1 at this key is the former cross-app mirror, not yet the
         canonical Program Planner record. Leave it for migration staging so
         the richer native owner workspaces can take precedence. */
      if (workspace.app === "uos.horticulture" && Number(workspace.schemaVersion) === 1) return null;
      try { return normalizeAndValidate(workspace); }
      catch (error) {
        try { return recoverLegacyRelationships(workspace, error); }
        catch (_) {
          return recoverLastVerified(null).catch(function () { throw error; });
        }
      }
    });
  }

  function save(workspace, lease, options) {
    /* Normalize and validate before entering the storage write queue. A rejected
       candidate therefore cannot partially replace the last valid snapshot. */
    var normalized;
    try { normalized = normalizeAndValidate(workspace); }
    catch (error) { return Promise.reject(error); }
    saveQueue = saveQueue.catch(function () { /* keep later saves usable */ }).then(function () {
      return commitNormalized(normalized, lease, options);
    });
    return saveQueue;
  }

  function saveValidated(workspace, lease, options) {
    var snapshot = clone(workspace);
    if (!snapshot || snapshot.app !== model().appId || Number(snapshot.schemaVersion) !== Number(model().schemaVersion)) {
      return Promise.reject(new Error("saveValidated requires a canonical workspace validated by ProgramApp."));
    }
    saveQueue = saveQueue.catch(function () {}).then(function () {
      return commitNormalized(snapshot, lease, options);
    });
    return saveQueue;
  }

  function stageLegacySources() {
    var store = storage();
    return Promise.all([
      store.get(LEGACY.nature.app, LEGACY.nature.name),
      store.get(LEGACY.remediation.app, LEGACY.remediation.name),
      store.get(CANONICAL.app, CANONICAL.name)
    ]).then(function (values) {
      return {
        nature: clone(values[0]),
        remediation: clone(values[1]),
        unified: clone(values[2]),
        sourceKeys: {
          nature: LEGACY.nature.key,
          remediation: LEGACY.remediation.key,
          unified: CANONICAL.key
        }
      };
    });
  }

  function getMigrationState() {
    return storage().get(MIGRATION.app, MIGRATION.name).then(function (state) {
      return state == null ? null : clone(state);
    });
  }

  function setMigrationState(state) {
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return Promise.reject(new TypeError("Migration state must be an object."));
    }
    var snapshot = clone(state);
    snapshot.schemaVersion = Number(model().schemaVersion);
    return storage().set(MIGRATION.app, MIGRATION.name, snapshot).then(function () { return clone(snapshot); });
  }

  function markMigrationComplete(summary) {
    return setMigrationState({
      status: "complete",
      completedAt: new Date().toISOString(),
      summary: clone(summary || {})
    });
  }

  function deleteStoredWorkspace(expectedRevision) {
    var store = storage();
    saveQueue = saveQueue.catch(function () { /* keep later operations usable */ }).then(function () {
      if (typeof store.removeWorkspaceState !== "function") return Promise.reject(new Error("Revision-aware workspace deletion is unavailable."));
      return store.removeWorkspaceState(CANONICAL.app, CANONICAL.name, expectedRevision, [
        MIGRATION.key, LEGACY.nature.key, LEGACY.remediation.key
      ]);
    });
    return saveQueue;
  }
  /* An unreadable or retired local workspace must never block a new operator.
     Delete its canonical/recovery/migration state, then persist the normal empty
     workspace with the governed default Rate Catalog. */
  function factoryReset() {
    var store = storage();
    saveQueue = saveQueue.catch(function () { /* keep factory reset available after a failed save */ }).then(function () {
      return durableGet().catch(function () { return null; }).then(function (raw) {
        if (typeof store.removeWorkspaceState !== "function") throw new Error("Revision-aware workspace deletion unavailable.");
        return store.removeWorkspaceState(CANONICAL.app, CANONICAL.name, revisionOf(raw), [
          MIGRATION.key, LEGACY.nature.key, LEGACY.remediation.key
        ]);
      }).then(function () {
        var fresh = model().blank();
        fresh.workspace.destination = "register";
        return commitNormalized(normalizeAndValidate(fresh), null, { baseRevision: 0, mutationKind: "business" });
      });
    });
    return saveQueue;
  }

  function isMigrationComplete() {
    return getMigrationState().then(function (state) {
      return Boolean(state && Number(state.schemaVersion) === Number(model().schemaVersion) && state.status === "complete");
    });
  }

  UOS.ProgramStorage = {
    canonical: clone(CANONICAL),
    lastVerified: clone(VERIFIED),
    legacy: clone(LEGACY),
    migration: clone(MIGRATION),
    get: get,
    getRaw: durableGet,
    getStrict: durableGet,
    recoverLastVerified: recoverLastVerified,
    save: save,
    saveValidated: saveValidated,
    set: save,
    deleteStoredWorkspace: deleteStoredWorkspace,
    factoryReset: factoryReset,
    stageLegacySources: stageLegacySources,
    getMigrationState: getMigrationState,
    setMigrationState: setMigrationState,
    markMigrationComplete: markMigrationComplete,
    isMigrationComplete: isMigrationComplete
  };
})();
