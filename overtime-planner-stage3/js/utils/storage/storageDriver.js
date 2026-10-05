// Low-Level LocalStorage I/O Driver & Persistence Health Telemetry
// Stage 2 Transaction-Model Closure Architecture (Candidate PR23_07)
// Manages LocalStorage read/write, in-memory fallback, active persistence probes, capacity telemetry,
// and multi-store transaction orchestration with verified compensating rollback and SAGA-style emergency recovery.

window.HortOpsStorageDriver = {
  WORKSPACE_STORAGE_KEY: 'hort_ops_workspace_v2',
  LEGACY_V1_KEY: 'hort_ops_workspace_v1',
  memory: {},
  lastResetResult: null,
  lastRestoreResult: null,
  resolvedBundles: {},

  get: function(key, defaultVal) {
    try {
      if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).localStorage) {
        var item = (window.HortOpsClientStorage || window).localStorage.getItem(key);
        if (item) return JSON.parse(item);
      }
    } catch(e) {
      console.warn('LocalStorage get failed, using fallback:', e);
    }
    return this.memory[key] !== undefined ? this.memory[key] : defaultVal;
  },

  set: function(key, val) {
    this.memory[key] = val;
    try {
      if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).localStorage) {
        (window.HortOpsClientStorage || window).localStorage.setItem(key, JSON.stringify(val));
      }
    } catch(e) {
      console.warn('LocalStorage set failed, using in-memory store:', e);
    }
  },

  remove: function(key) {
    delete this.memory[key];
    try {
      if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).localStorage) {
        (window.HortOpsClientStorage || window).localStorage.removeItem(key);
      }
    } catch(e) {}
  },

  getStorageHealth: function() {
    var usedBytes = 0;
    var workspaceBytes = 0;
    var lastSaved = new Date().toISOString();
    var probeOk = false;

    try {
      if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).localStorage) {
        // Active persistence probe (Mandate Section 12.1 & Review 37 R37-03)
        var probeKey = '__hort_ops_persistence_probe__';
        var probeSet = false;
        try {
          (window.HortOpsClientStorage || window).localStorage.setItem(probeKey, '1');
          probeSet = true;
          if ((window.HortOpsClientStorage || window).localStorage.getItem(probeKey) === '1') {
            probeOk = true;
          }
        } catch(probeErr) {
          probeOk = false;
        } finally {
          if (probeSet) {
            try {
              (window.HortOpsClientStorage || window).localStorage.removeItem(probeKey);
            } catch(cleanupErr) {
              probeOk = false;
            }
          }
        }

        for (var i = 0; i < (window.HortOpsClientStorage || window).localStorage.length; i++) {
          var key = (window.HortOpsClientStorage || window).localStorage.key(i);
          if (key) {
            var val = (window.HortOpsClientStorage || window).localStorage.getItem(key) || '';
            usedBytes += (key.length + val.length) * 2;
          }
        }
        var raw = (window.HortOpsClientStorage || window).localStorage.getItem(this.WORKSPACE_STORAGE_KEY);
        if (raw) {
          workspaceBytes = (this.WORKSPACE_STORAGE_KEY.length + raw.length) * 2;
          try {
            var parsed = JSON.parse(raw);
            if (parsed.lastSaved) lastSaved = parsed.lastSaved;
          } catch(err) {}
        }
      }
    } catch(e) {
      probeOk = false;
    }

    var quotaEstimate = 5 * 1024 * 1024;
    var rawRatio = (usedBytes / quotaEstimate) * 100;
    var percentUsed = Math.min(100, Math.round(rawRatio));

    var status = 'healthy';
    if (!probeOk) {
      status = 'failed';
    } else if (rawRatio > 80) {
      status = 'warning';
    }

    return {
      status: status,
      probeOk: probeOk,
      usedBytes: usedBytes,
      workspaceBytes: workspaceBytes,
      quotaEstimate: quotaEstimate,
      percentUsed: percentUsed,
      lastSaved: lastSaved
    };
  },

  getLastResetResult: function() {
    return this.lastResetResult;
  },

  getLastRestoreResult: function() {
    return this.lastRestoreResult;
  },

  // =========================================================================
  // TRANSACTION ISOLATION & PREFLIGHT HELPERS (TM-I01, TM-I02, TM-I12, TM-I15)
  // =========================================================================

  _generateTransactionId: function(prefix) {
    var p = prefix || 'tx';
    return p + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  },

  _deepFreezeTelemetry: function(telemetry) {
    if (!telemetry || typeof telemetry !== 'object') return telemetry;
    if (Array.isArray(telemetry.transitionHistory)) {
      Object.freeze(telemetry.transitionHistory);
    }
    if (Array.isArray(telemetry.errors)) {
      Object.freeze(telemetry.errors);
    }
    if (telemetry.compensationOutcome && typeof telemetry.compensationOutcome === 'object') {
      if (Array.isArray(telemetry.compensationOutcome.unrecoveredLocalKeys)) {
        Object.freeze(telemetry.compensationOutcome.unrecoveredLocalKeys);
      }
      if (Array.isArray(telemetry.compensationOutcome.unrecoveredSessionKeys)) {
        Object.freeze(telemetry.compensationOutcome.unrecoveredSessionKeys);
      }
      Object.freeze(telemetry.compensationOutcome);
    }
    return Object.freeze(telemetry);
  },

  _checkUnresolvedEmergencyIsolation: function() {
    // 1. Check in-memory volatile reset emergency isolation (Review 03/04 Guardrail 4.4, TM-I12)
    if (this.lastResetResult && (
      this.lastResetResult.terminalState === 'EMERGENCY_ISOLATION' ||
      this.lastResetResult.terminalState === 'RESET_REJECTED_ISOLATION' ||
      this.lastResetResult.requiresIsolation ||
      this.lastResetResult.status === 'recovery_staging_failed_memory_only' ||
      this.lastResetResult.status === 'partial_failure_unrecovered' ||
      this.lastResetResult.status === 'rejected_unresolved_emergency_isolation'
    )) {
      return {
        hasUnresolvedIsolation: true,
        memoryOnly: (this.lastResetResult.recoveryPersistence === 'memory_only' || this.lastResetResult.status === 'recovery_staging_failed_memory_only'),
        reason: 'unresolved_in_memory_reset_isolation',
        bundle: this.lastResetResult.recoveryBundle || this.lastResetResult.recoveryArtifact,
        bundleJson: this.lastResetResult.recoveryBundleJson || this.lastResetResult.recoveryArtifactJson
      };
    }

    // 2. Check in-memory volatile restore isolation / deep failure (Review 44 R44-02 / R44-P07, TM-I10, TM-I12)
    if (this.lastRestoreResult && (
      this.lastRestoreResult.terminalState === 'RESTORE_DEEP_FAILURE' ||
      this.lastRestoreResult.terminalState === 'EMERGENCY_ISOLATION' ||
      this.lastRestoreResult.requiresIsolation ||
      this.lastRestoreResult.status === 'restore_deep_failure_recovery_staged' ||
      this.lastRestoreResult.status === 'restore_deep_failure_recovery_memory_only' ||
      this.lastRestoreResult.status === 'partial_restore_failure_unrecovered'
    )) {
      return {
        hasUnresolvedIsolation: true,
        memoryOnly: (this.lastRestoreResult.recoveryPersistence === 'memory_only' || this.lastRestoreResult.status === 'restore_deep_failure_recovery_memory_only'),
        reason: 'unresolved_in_memory_restore_isolation',
        bundle: this.lastRestoreResult.recoveryBundle,
        bundleJson: this.lastRestoreResult.recoveryBundleJson
      };
    }

    if (this._activeIsolation) {
      return {
        hasUnresolvedIsolation: true,
        memoryOnly: false,
        reason: 'driver_active_isolation_flag',
        bundle: (this.lastResetResult && (this.lastResetResult.recoveryBundle || this.lastResetResult.recoveryArtifact)) || (this.lastRestoreResult && this.lastRestoreResult.recoveryBundle) || null,
        bundleJson: (this.lastResetResult && (this.lastResetResult.recoveryBundleJson || this.lastResetResult.recoveryArtifactJson)) || (this.lastRestoreResult && this.lastRestoreResult.recoveryBundleJson) || null
      };
    }

    // 3. Check persisted unresolved composite / restore transaction bundles in sessionStorage (Review 44 R44-02 / R44-P03)
    try {
      if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).sessionStorage) {
        var sLen = (typeof (window.HortOpsClientStorage || window).sessionStorage.length === 'number') ? (window.HortOpsClientStorage || window).sessionStorage.length : 0;
        for (var i = 0; i < sLen; i++) {
          var k = (window.HortOpsClientStorage || window).sessionStorage.key(i);
          if (k) {
            // Check for transaction bundles (reset composite parent or restore transaction)
            if (k.indexOf('hort_ops_emergency_recovery_v2:transaction:') === 0 || k.indexOf('hort_ops_emergency_recovery_v2:restore_transaction:') === 0 || k.indexOf('hort_ops_emergency_recovery_v2:restore:') === 0) {
              var pVal = (window.HortOpsClientStorage || window).sessionStorage.getItem(k);
              return {
                hasUnresolvedIsolation: true,
                memoryOnly: false,
                reason: 'persisted_transaction_recovery_bundle',
                bundleKey: k,
                bundleJson: pVal
              };
            }
            // Check if key payload is a composite transaction bundle
            if (k.indexOf('hort_ops_emergency_recovery_v2') === 0) {
              var rawVal = (window.HortOpsClientStorage || window).sessionStorage.getItem(k);
              if (rawVal && (rawVal.indexOf('hort_ops_reset_transaction_recovery') !== -1 || rawVal.indexOf('hort_ops_restore_transaction_recovery') !== -1)) {
                return {
                  hasUnresolvedIsolation: true,
                  memoryOnly: false,
                  reason: 'persisted_composite_recovery_artifact',
                  bundleKey: k,
                  bundleJson: rawVal
                };
              }
            }
          }
        }
      }
    } catch (scanErr) {
      // If scanning sessionStorage throws, allow Phase 1 _captureStoragePreflight to handle preflight read failure (TM-F02)
      return { hasUnresolvedIsolation: false };
    }

    return { hasUnresolvedIsolation: false };
  },

  _captureStoragePreflight: function(knownLocalKeys) {
    var localSnapshot = {};
    var sessionSnapshot = {};

    if (typeof window === 'undefined' || !(window.HortOpsClientStorage || window).localStorage || !(window.HortOpsClientStorage || window).sessionStorage) {
      return {
        success: false,
        phase: 'platform',
        error: 'Browser storage APIs (localStorage / sessionStorage) not available'
      };
    }

    // 1. Capture application-owned localStorage
    try {
      var localLen = (typeof (window.HortOpsClientStorage || window).localStorage.length === 'number') ? (window.HortOpsClientStorage || window).localStorage.length : 0;
      for (var i = 0; i < localLen; i++) {
        var lKey = (window.HortOpsClientStorage || window).localStorage.key(i);
        if (lKey && (lKey.indexOf('hort_ops_') === 0 || lKey.indexOf('__hort_ops_') === 0)) {
          localSnapshot[lKey] = (window.HortOpsClientStorage || window).localStorage.getItem(lKey);
        }
      }
      // Guarantee known keys are inspected if present
      if (Array.isArray(knownLocalKeys)) {
        for (var m = 0; m < knownLocalKeys.length; m++) {
          var rk = knownLocalKeys[m];
          if (!Object.prototype.hasOwnProperty.call(localSnapshot, rk)) {
            var val = (window.HortOpsClientStorage || window).localStorage.getItem(rk);
            if (val !== null) {
              localSnapshot[rk] = val;
            }
          }
        }
      }
    } catch (lErr) {
      return {
        success: false,
        phase: 'local',
        error: 'localStorage preflight capture failed: ' + (lErr.message || String(lErr))
      };
    }

    // 2. Capture emergency-recovery sessionStorage
    try {
      var sessionLen = (typeof (window.HortOpsClientStorage || window).sessionStorage.length === 'number') ? (window.HortOpsClientStorage || window).sessionStorage.length : 0;
      for (var j = 0; j < sessionLen; j++) {
        var sKey = (window.HortOpsClientStorage || window).sessionStorage.key(j);
        if (sKey && sKey.indexOf('hort_ops_emergency_recovery_v2') === 0) {
          sessionSnapshot[sKey] = (window.HortOpsClientStorage || window).sessionStorage.getItem(sKey);
        }
      }
    } catch (sErr) {
      return {
        success: false,
        phase: 'session',
        error: 'sessionStorage preflight capture failed: ' + (sErr.message || String(sErr))
      };
    }

    return {
      success: true,
      localSnapshot: localSnapshot,
      sessionSnapshot: sessionSnapshot
    };
  },

  // =========================================================================
  // DUAL-DOMAIN COMPENSATING ROLLBACK HELPERS (TM-I04, TM-I14)
  // =========================================================================

  _restoreRawStorageSnapshot: function(snapshot, keysToRestore) {
    var targets = Array.isArray(keysToRestore) ? keysToRestore : Object.keys(snapshot || {});
    var restoredCount = 0;
    var unrecoveredKeys = [];
    var rollbackFailed = false;
    var rollbackError = null;

    if (!snapshot || typeof window === 'undefined' || !(window.HortOpsClientStorage || window).localStorage) {
      return {
        success: false,
        restoredCount: 0,
        unrecoveredKeys: targets.slice(),
        error: 'localStorage not available for rollback'
      };
    }

    // Step 1: Write values back to localStorage (or removeItem if null)
    for (var r = 0; r < targets.length; r++) {
      var restoreKey = targets[r];
      if (Object.prototype.hasOwnProperty.call(snapshot, restoreKey)) {
        try {
          var val = snapshot[restoreKey];
          if (val === null) {
            (window.HortOpsClientStorage || window).localStorage.removeItem(restoreKey);
          } else {
            (window.HortOpsClientStorage || window).localStorage.setItem(restoreKey, String(val));
            restoredCount++;
          }
        } catch (rbErr) {
          rollbackFailed = true;
          if (!rollbackError) rollbackError = rbErr;
          if (unrecoveredKeys.indexOf(restoreKey) === -1) {
            unrecoveredKeys.push(restoreKey);
          }
          console.error('StorageDriver compensating rollback setItem failed for ' + restoreKey + ':', rbErr);
        }
      }
    }

    // Step 2: Verify rollback integrity byte-for-byte
    if (!rollbackFailed) {
      for (var v = 0; v < targets.length; v++) {
        var vKey = targets[v];
        if (Object.prototype.hasOwnProperty.call(snapshot, vKey)) {
          try {
            var expected = snapshot[vKey];
            var actual = (window.HortOpsClientStorage || window).localStorage.getItem(vKey);
            if (expected === null) {
              if (actual !== null) {
                rollbackFailed = true;
                if (!rollbackError) rollbackError = new Error('Rollback verification residual key for ' + vKey);
                if (unrecoveredKeys.indexOf(vKey) === -1) unrecoveredKeys.push(vKey);
              }
            } else if (actual !== String(expected)) {
              rollbackFailed = true;
              if (!rollbackError) rollbackError = new Error('Rollback verification mismatch for ' + vKey);
              if (unrecoveredKeys.indexOf(vKey) === -1) {
                unrecoveredKeys.push(vKey);
              }
            }
          } catch (vErr) {
            rollbackFailed = true;
            if (!rollbackError) rollbackError = vErr;
            if (unrecoveredKeys.indexOf(vKey) === -1) {
              unrecoveredKeys.push(vKey);
            }
          }
        }
      }
    }

    return {
      success: !rollbackFailed,
      restoredCount: restoredCount,
      unrecoveredKeys: unrecoveredKeys,
      error: rollbackError ? (rollbackError.message || String(rollbackError)) : null
    };
  },

  _restoreEmergencyRecoveryMetadata: function(sessionSnapshot) {
    if (!sessionSnapshot || typeof window === 'undefined' || !(window.HortOpsClientStorage || window).sessionStorage) {
      return { success: false, error: 'sessionStorage not available for metadata restoration', unrecoveredKeys: [] };
    }

    var targets = Object.keys(sessionSnapshot);
    var unrecoveredKeys = [];
    var failed = false;
    var lastError = null;

    // 1. Re-write all preflight session recovery keys
    for (var i = 0; i < targets.length; i++) {
      var k = targets[i];
      try {
        var val = sessionSnapshot[k];
        if (val === null) {
          (window.HortOpsClientStorage || window).sessionStorage.removeItem(k);
        } else {
          (window.HortOpsClientStorage || window).sessionStorage.setItem(k, String(val));
        }
      } catch (err) {
        failed = true;
        if (!lastError) lastError = err;
        unrecoveredKeys.push(k);
        console.error('StorageDriver metadata rollback setItem failed for ' + k + ':', err);
      }
    }

    // 2. Remove any newly created/residual recovery keys not in snapshot
    try {
      var sLen = (typeof (window.HortOpsClientStorage || window).sessionStorage.length === 'number') ? (window.HortOpsClientStorage || window).sessionStorage.length : 0;
      var spuriousKeys = [];
      for (var j = 0; j < sLen; j++) {
        var curKey = (window.HortOpsClientStorage || window).sessionStorage.key(j);
        if (curKey && curKey.indexOf('hort_ops_emergency_recovery_v2') === 0) {
          if (!Object.prototype.hasOwnProperty.call(sessionSnapshot, curKey) || sessionSnapshot[curKey] === null) {
            spuriousKeys.push(curKey);
          }
        }
      }
      for (var s = 0; s < spuriousKeys.length; s++) {
        try {
          (window.HortOpsClientStorage || window).sessionStorage.removeItem(spuriousKeys[s]);
        } catch (spErr) {
          failed = true;
          if (!lastError) lastError = spErr;
          unrecoveredKeys.push(spuriousKeys[s]);
        }
      }
    } catch (scanErr) {
      // Review 44 R44-04 / R44-P05: Scanning / enumeration failure during rollback verification
      // is fatal to the claim of verified compensation.
      failed = true;
      if (!lastError) lastError = scanErr;
      unrecoveredKeys.push('sessionStorage_enumeration_failure');
    }

    // 3. Verify session restoration byte-for-byte and verify exact governed key set
    if (!failed) {
      for (var v = 0; v < targets.length; v++) {
        var vKey = targets[v];
        try {
          var expVal = sessionSnapshot[vKey];
          var actVal = (window.HortOpsClientStorage || window).sessionStorage.getItem(vKey);
          if (expVal === null) {
            if (actVal !== null) {
              failed = true;
              if (!lastError) lastError = new Error('Session rollback residual key: ' + vKey);
              if (unrecoveredKeys.indexOf(vKey) === -1) unrecoveredKeys.push(vKey);
            }
          } else if (actVal !== String(expVal)) {
            failed = true;
            if (!lastError) lastError = new Error('Session rollback value mismatch for key: ' + vKey);
            if (unrecoveredKeys.indexOf(vKey) === -1) unrecoveredKeys.push(vKey);
          }
        } catch (vErr) {
          failed = true;
          if (!lastError) lastError = vErr;
          if (unrecoveredKeys.indexOf(vKey) === -1) unrecoveredKeys.push(vKey);
        }
      }

      // Also verify no spurious unexpected recovery keys remain (Review 44 R44-04)
      try {
        var finalLen = (typeof (window.HortOpsClientStorage || window).sessionStorage.length === 'number') ? (window.HortOpsClientStorage || window).sessionStorage.length : 0;
        for (var f = 0; f < finalLen; f++) {
          var fk = (window.HortOpsClientStorage || window).sessionStorage.key(f);
          if (fk && fk.indexOf('hort_ops_emergency_recovery_v2') === 0) {
            if (!Object.prototype.hasOwnProperty.call(sessionSnapshot, fk) || sessionSnapshot[fk] === null) {
              failed = true;
              if (!lastError) lastError = new Error('Spurious unverified recovery key in sessionStorage: ' + fk);
              if (unrecoveredKeys.indexOf(fk) === -1) unrecoveredKeys.push(fk);
            }
          }
        }
      } catch (fErr) {
        failed = true;
        if (!lastError) lastError = fErr;
        unrecoveredKeys.push('sessionStorage_final_scan_failure');
      }
    }

    return {
      success: !failed,
      restoredCount: targets.length - unrecoveredKeys.length,
      unrecoveredKeys: unrecoveredKeys,
      error: lastError ? (lastError.message || String(lastError)) : null
    };
  },

  // =========================================================================
  // RECOVERY BUNDLE FACTORIES & STAGING (TM-I07, TM-I08, DG-03, DG3-03)
  // =========================================================================

  _buildResetTransactionRecoveryBundle: function(localSnapshot, sessionSnapshot, failedKey, errorMsg, unrecLocal, unrecSession, txId) {
    var id = txId || this._generateTransactionId('tx');
    var recId = 'rec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    
    var workspaceArtifact = null;
    if (typeof HortOpsRecoveryArtifact !== 'undefined' && typeof HortOpsRecoveryArtifact.createEmergencyRecoveryArtifact === 'function') {
      workspaceArtifact = HortOpsRecoveryArtifact.createEmergencyRecoveryArtifact(localSnapshot, {
        recoveryId: recId,
        failedKey: failedKey,
        error: errorMsg || 'Compensating rollback failed',
        unrecoveredKeys: unrecLocal || []
      });
    } else {
      workspaceArtifact = {
        artifactType: 'hort_ops_reset_recovery',
        artifactVersion: 1,
        recoveryId: recId,
        createdAt: new Date().toISOString(),
        reason: 'rollback_compensation_failure',
        failedKey: failedKey,
        error: errorMsg || 'Compensating rollback failed',
        unrecoveredKeys: unrecLocal || [],
        storageSnapshot: localSnapshot || {}
      };
    }

    var compositeBundle = {
      artifactType: 'hort_ops_reset_transaction_recovery',
      bundleType: 'hort_ops_reset_transaction_recovery',
      artifactVersion: 1,
      transactionId: id,
      transactionType: 'clean_slate_reset',
      createdAt: new Date().toISOString(),
      reason: 'dual_storage_rollback_failed',
      compensationOutcome: {
        localRestored: (unrecLocal || []).length === 0,
        localVerified: (unrecLocal || []).length === 0,
        recoveryMetadataRestored: (unrecSession || []).length === 0,
        recoveryMetadataVerified: (unrecSession || []).length === 0,
        unrecoveredLocalKeys: unrecLocal || [],
        unrecoveredSessionKeys: unrecSession || []
      },
      currentWorkspaceRecoveryArtifact: workspaceArtifact,
      previousEmergencyRecoveryMetadata: sessionSnapshot || {}
    };

    return {
      bundle: compositeBundle,
      bundleJson: JSON.stringify(compositeBundle),
      transactionId: id,
      workspaceArtifact: workspaceArtifact
    };
  },

  _buildRestoreTransactionRecoveryBundle: function(preRestoreSnapshot, targetArtifact, targetSource, rollbackOutcome, txId) {
    var id = txId || this._generateTransactionId('restore-tx');
    var bundle = {
      artifactType: 'hort_ops_restore_transaction_recovery',
      bundleType: 'hort_ops_restore_transaction_recovery',
      artifactVersion: 1,
      transactionId: id,
      transactionType: 'emergency_recovery_restore',
      createdAt: new Date().toISOString(),
      reason: 'restore_mutation_and_rollback_failed',
      targetRecoverySource: targetSource || {
        recoveryId: (targetArtifact && targetArtifact.recoveryId) ? targetArtifact.recoveryId : null,
        sessionKey: (targetArtifact && targetArtifact.recoveryId) ? ('hort_ops_emergency_recovery_v2:' + targetArtifact.recoveryId) : null,
        parentTransactionId: null
      },
      preRestoreWorkspaceSnapshot: preRestoreSnapshot || {},
      targetRecoveryArtifact: targetArtifact || {},
      rollbackOutcome: rollbackOutcome || { restored: false, verified: false, unrecoveredKeys: [] }
    };

    return {
      bundle: bundle,
      bundleJson: JSON.stringify(bundle),
      transactionId: id
    };
  },

  _reconcileRecoveryInventory: function() {
    try {
      if (typeof window === 'undefined' || !(window.HortOpsClientStorage || window).sessionStorage) {
        return { ok: true, count: 0, verified: true, keys: [], compositeKeys: [], allKeys: [], recoveryEntries: [], byType: {} };
      }
      var keys = [];
      var compositeKeys = [];
      var allKeys = [];
      var recoveryEntries = [];
      var byType = { parent_transaction: 0, restore_transaction: 0, unique_child: 0, legacy_alias: 0 };
      var seenKeys = Object.create(null);
      var len = (typeof (window.HortOpsClientStorage || window).sessionStorage.length === 'number') ? (window.HortOpsClientStorage || window).sessionStorage.length : 0;
      for (var i = 0; i < len; i++) {
        var k = (window.HortOpsClientStorage || window).sessionStorage.key(i);
        if (k === null || typeof k !== 'string') {
          return { ok: false, count: -1, verified: false, error: new Error('Enumeration failed: unexpected null or non-string key at index ' + i + ' for length ' + len), keys: [], compositeKeys: [], allKeys: [], recoveryEntries: [], byType: byType };
        }
        if (seenKeys[k]) {
          return { ok: false, count: -1, verified: false, error: new Error('Enumeration failed: duplicate key encountered: ' + k), keys: [], compositeKeys: [], allKeys: [], recoveryEntries: [], byType: byType };
        }
        seenKeys[k] = true;
        allKeys.push(k);
        if (k.indexOf('hort_ops_emergency_recovery_v2') === 0) {
          var rawVal = null;
          try {
            rawVal = (window.HortOpsClientStorage || window).sessionStorage.getItem(k);
          } catch (getErr) {
            return { ok: false, count: -1, verified: false, error: new Error('Storage read denied for key ' + k + ': ' + (getErr.message || String(getErr))), keys: [], compositeKeys: [], allKeys: [], recoveryEntries: [], byType: byType };
          }
          if (rawVal === null || typeof rawVal !== 'string') {
            return { ok: false, count: -1, verified: false, error: new Error('Storage read returned null or non-string for key: ' + k), keys: [], compositeKeys: [], allKeys: [], recoveryEntries: [], byType: byType };
          }
          keys.push(k);
          var entryType = 'unique_child';
          var artifactId = null;
          var validationStatus = 'valid';
          if (k.indexOf('hort_ops_emergency_recovery_v2:transaction:') === 0) {
            entryType = 'parent_transaction';
            compositeKeys.push(k);
            byType.parent_transaction++;
          } else if (k.indexOf('hort_ops_emergency_recovery_v2:restore_transaction:') === 0 || k.indexOf('hort_ops_emergency_recovery_v2:restore:') === 0) {
            entryType = 'restore_transaction';
            compositeKeys.push(k);
            byType.restore_transaction++;
          } else if (k === 'hort_ops_emergency_recovery_v2') {
            entryType = 'legacy_alias';
            byType.legacy_alias++;
          } else {
            entryType = 'unique_child';
            byType.unique_child++;
          }
          var parsed = null;
          try {
            parsed = JSON.parse(rawVal);
          } catch (pErr) {
            validationStatus = 'malformed';
          }

          if (validationStatus === 'valid') {
            if (!parsed || typeof parsed !== 'object') {
              validationStatus = 'malformed';
            } else if (entryType === 'parent_transaction') {
              var isTxArtifact = (parsed.artifactType === 'hort_ops_reset_transaction_recovery' || parsed.bundleType === 'hort_ops_reset_transaction_recovery');
              var hasTxId = (typeof parsed.transactionId === 'string' && parsed.transactionId.length > 0);
              var hasWsArt = Boolean(parsed.currentWorkspaceRecoveryArtifact && typeof parsed.currentWorkspaceRecoveryArtifact === 'object');
              if (!isTxArtifact || !hasTxId || !hasWsArt) {
                validationStatus = 'malformed';
              } else {
                artifactId = parsed.transactionId;
              }
            } else if (entryType === 'restore_transaction') {
              var isRestoreArtifact = (parsed.artifactType === 'hort_ops_restore_transaction_recovery' || parsed.bundleType === 'hort_ops_restore_transaction_recovery' || parsed.artifactType === 'hort_ops_reset_transaction_recovery');
              var hasRestoreTxId = (typeof parsed.transactionId === 'string' && parsed.transactionId.length > 0) || (typeof parsed.restoreTransactionId === 'string' && parsed.restoreTransactionId.length > 0);
              if (!isRestoreArtifact || !hasRestoreTxId) {
                validationStatus = 'malformed';
              } else {
                artifactId = parsed.transactionId || parsed.restoreTransactionId;
              }
            } else if (entryType === 'unique_child') {
              var isChildArtifact = (parsed.artifactType === 'hort_ops_reset_recovery' || parsed.artifactType === 'hort_ops_restore_recovery');
              var hasRecoveryId = (typeof parsed.recoveryId === 'string' && parsed.recoveryId.length > 0);
              var hasSnapshot = Boolean(parsed.storageSnapshot && typeof parsed.storageSnapshot === 'object');
              var isDirectSnapshot = (typeof parsed.schemaVersion === 'number' && Array.isArray(parsed.jobs));
              if ((isChildArtifact && hasRecoveryId && hasSnapshot) || isDirectSnapshot) {
                artifactId = parsed.recoveryId || null;
              } else {
                validationStatus = 'malformed';
              }
            } else if (entryType === 'legacy_alias') {
              var isChildArt = (parsed.artifactType === 'hort_ops_reset_recovery' || parsed.artifactType === 'hort_ops_restore_recovery');
              var isDirectWs = (typeof parsed.schemaVersion === 'number' && Array.isArray(parsed.jobs));
              var isSnap = Boolean(parsed.storageSnapshot && typeof parsed.storageSnapshot === 'object');
              if (!isChildArt && !isDirectWs && !isSnap) {
                validationStatus = 'malformed';
              } else {
                artifactId = parsed.recoveryId || null;
              }
            }
          }

          recoveryEntries.push({ key: k, raw: rawVal, type: entryType, artifactIdentity: artifactId, validationStatus: validationStatus });
        }
      }

      // Length drift check (Review 48 R48-C, R48-P04)
      var finalLen = (typeof (window.HortOpsClientStorage || window).sessionStorage.length === 'number') ? (window.HortOpsClientStorage || window).sessionStorage.length : 0;
      if (finalLen !== len || finalLen !== allKeys.length) {
        return {
          ok: false,
          count: -1,
          verified: false,
          error: new Error('Enumeration instability: storage length drifted during inventory enumeration (started ' + len + ', finished ' + finalLen + ', enumerated ' + allKeys.length + ')'),
          keys: [],
          compositeKeys: [],
          allKeys: [],
          recoveryEntries: [],
          byType: byType
        };
      }

      return { ok: true, count: keys.length, verified: true, keys: keys, compositeKeys: compositeKeys, allKeys: allKeys, recoveryEntries: recoveryEntries, byType: byType };
    } catch (err) {
      return { ok: false, count: -1, verified: false, error: err, keys: [], compositeKeys: [], allKeys: [], recoveryEntries: [], byType: {} };
    }
  },

  _stageTransactionRecoveryBundle: function(bundle, bundleJson, keyPrefix) {
    var stagingSuccess = false;
    var stagingError = null;
    var prefix = keyPrefix || 'hort_ops_emergency_recovery_v2:transaction:';
    var parentKey = prefix + bundle.transactionId;
    var wsRecoveryKey = null;
    var parentPersisted = false;
    var childPersisted = false;
    var aliasPersisted = false;

    try {
      if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).sessionStorage) {
        var wsArtifact = bundle.currentWorkspaceRecoveryArtifact || bundle.targetRecoveryArtifact;
        var wsArtifactJson = wsArtifact ? JSON.stringify(wsArtifact) : bundleJson;
        wsRecoveryKey = (wsArtifact && wsArtifact.recoveryId)
          ? ('hort_ops_emergency_recovery_v2:' + wsArtifact.recoveryId)
          : null;

        // 1. Stage the parent composite bundle FIRST (authoritative durability contract: R44-01 / TM-I06 / TM-I07, Review 46 R46-02 / R46-P08, Review 49 R49-A / R49-P01)
        try {
          var existingParent = (window.HortOpsClientStorage || window).sessionStorage.getItem(parentKey);
          if (existingParent !== null) {
            if (existingParent === bundleJson) {
              parentPersisted = true; // idempotent reuse of identical bytes
            } else {
              // Occupied with different bytes: DO NOT OVERWRITE! (R46-P08)
              parentPersisted = false;
              stagingError = new Error('Collision on parent transaction key: ' + parentKey + '; existing evidence preserved');
            }
          } else {
            (window.HortOpsClientStorage || window).sessionStorage.setItem(parentKey, bundleJson);
            if ((window.HortOpsClientStorage || window).sessionStorage.getItem(parentKey) === bundleJson) {
              parentPersisted = true;
            }
          }
        } catch (pErr) {
          stagingError = pErr;
        }

        // 2. Auxiliary staging of the inner workspace artifact (for legacy UI components)
        // ONLY if parent composite staging succeeded! (Review 46 R46-02 / R46-P05)
        if (parentPersisted && wsRecoveryKey) {
          try {
            var existingChild = (window.HortOpsClientStorage || window).sessionStorage.getItem(wsRecoveryKey);
            if (existingChild !== null) {
              if (existingChild === wsArtifactJson) {
                childPersisted = true; // idempotent reuse of identical bytes
              } else {
                // Occupied with different bytes: DO NOT OVERWRITE! (R46-P05)
                childPersisted = false;
              }
            } else {
              (window.HortOpsClientStorage || window).sessionStorage.setItem(wsRecoveryKey, wsArtifactJson);
              if ((window.HortOpsClientStorage || window).sessionStorage.getItem(wsRecoveryKey) === wsArtifactJson) {
                childPersisted = true;
              }
            }
          } catch (cErr) {
            if (!stagingError) stagingError = cErr;
          }
        }

        // 3. Auxiliary staging of legacy alias (Review 45 R45-P04 / TM-I06, Review 46 R46-02)
        // ONLY if parent composite was successfully persisted and legacy key does not already hold older recovery evidence!
        var legacyKey = 'hort_ops_emergency_recovery_v2';
        if (parentPersisted) {
          try {
            var currentLegacy = (window.HortOpsClientStorage || window).sessionStorage.getItem(legacyKey);
            if (currentLegacy === null) {
              (window.HortOpsClientStorage || window).sessionStorage.setItem(legacyKey, wsArtifactJson);
              if ((window.HortOpsClientStorage || window).sessionStorage.getItem(legacyKey) === wsArtifactJson) {
                aliasPersisted = true;
              }
            } else if (currentLegacy === wsArtifactJson) {
              aliasPersisted = true; // idempotent reuse
            }
          } catch (lErr) {}
        }

        // Durability requirement (R44-01, Review 49 R49-A): The COMPLETE parent composite bundle must be persisted and verified!
        // Staging a child artifact alone never establishes composite durability!
        stagingSuccess = parentPersisted;

      }
    } catch (sErr) {
      stagingError = sErr;
      console.error('Failed to stage transaction recovery bundle to sessionStorage:', sErr);
    }

    return {
      stagingSuccess: stagingSuccess,
      stagingError: stagingError ? (stagingError.message || String(stagingError)) : null,
      parentKey: parentPersisted ? parentKey : null,
      recoveryKey: parentPersisted ? parentKey : (childPersisted ? wsRecoveryKey : null),
      childKey: childPersisted ? wsRecoveryKey : null,
      parentPersisted: parentPersisted,
      childPersisted: childPersisted,
      aliasPersisted: aliasPersisted,
      persistence: stagingSuccess ? 'persisted' : 'memory_only'
    };
  },

  _stageEmergencyRecoveryArtifact: function(snapshot, failedKey, errorMsg, unrecoveredKeys) {
    // Retained compatibility helper for existing Review 39/42 unit tests
    var artifact = null;
    var artifactJson = '';
    var recId = 'rec_' + Date.now();

    if (typeof HortOpsRecoveryArtifact !== 'undefined' && typeof HortOpsRecoveryArtifact.createEmergencyRecoveryArtifact === 'function') {
      artifact = HortOpsRecoveryArtifact.createEmergencyRecoveryArtifact(snapshot, {
        failedKey: failedKey,
        error: errorMsg || 'Compensating rollback failed',
        unrecoveredKeys: unrecoveredKeys || []
      });
      artifactJson = JSON.stringify(artifact);
    } else {
      artifact = {
        artifactType: 'hort_ops_reset_recovery',
        artifactVersion: 1,
        recoveryId: recId,
        createdAt: new Date().toISOString(),
        reason: 'incomplete_reset_rollback',
        failedKey: failedKey,
        error: errorMsg || 'Compensating rollback failed',
        unrecoveredKeys: unrecoveredKeys || [],
        storageSnapshot: snapshot
      };
      artifactJson = JSON.stringify(artifact);
    }

    var stagingSuccess = false;
    var stagingError = null;
    var recoveryKey = (typeof HortOpsRecoveryArtifact !== 'undefined' && HortOpsRecoveryArtifact.getRecoveryKey)
      ? HortOpsRecoveryArtifact.getRecoveryKey(artifact.recoveryId)
      : ('hort_ops_emergency_recovery_v2:' + artifact.recoveryId);

    try {
      if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).sessionStorage) {
        (window.HortOpsClientStorage || window).sessionStorage.setItem(recoveryKey, artifactJson);
        if ((window.HortOpsClientStorage || window).sessionStorage.getItem(recoveryKey) === artifactJson) {
          stagingSuccess = true;
        }
        var legacyKey = 'hort_ops_emergency_recovery_v2';
        if (!(window.HortOpsClientStorage || window).sessionStorage.getItem(legacyKey)) {
          try { (window.HortOpsClientStorage || window).sessionStorage.setItem(legacyKey, artifactJson); } catch (lErr) {}
        }
      }
    } catch (sErr) {
      stagingError = sErr;
      console.error('Failed to stage emergency backup to sessionStorage:', sErr);
    }

    return {
      artifact: artifact,
      artifactJson: artifactJson,
      recoveryKey: stagingSuccess ? recoveryKey : null,
      stagingSuccess: stagingSuccess,
      stagingError: stagingError ? (stagingError.message || String(stagingError)) : null
    };
  },

  _executeCompensatingRollback: function(localSnapshot, sessionSnapshot, deletedLocalKeys, failedSessionKeys, primaryError, txId, failedKey, telemetryTransitions) {
    if (telemetryTransitions) telemetryTransitions.push('ROLLBACK_BOTH');

    // 1. Compensate local storage
    var localRb = this._restoreRawStorageSnapshot(localSnapshot, deletedLocalKeys);

    // 2. Compensate session storage
    var sessionRb = this._restoreEmergencyRecoveryMetadata(sessionSnapshot);

    var bothVerified = localRb.success && sessionRb.success;

    if (bothVerified) {
      if (telemetryTransitions) telemetryTransitions.push('ROLLBACK_VERIFIED');
      return {
        rolledBack: true,
        terminalState: 'ROLLED_BACK_INTACT',
        status: (failedSessionKeys && failedSessionKeys.length > 0)
          ? 'postcondition_failed_recovery_metadata_rolled_back'
          : 'rolled_back',
        localResult: localRb,
        sessionResult: sessionRb,
        error: primaryError ? (primaryError.message || String(primaryError)) : 'Compensating rollback succeeded'
      };
    }

    // Second-order failure: at least one domain failed rollback verification
    if (telemetryTransitions) telemetryTransitions.push('BUILD_RECOVERY_BUNDLE');

    var bundleInfo = this._buildResetTransactionRecoveryBundle(
      localSnapshot,
      sessionSnapshot,
      failedKey,
      primaryError ? (primaryError.message || String(primaryError)) : 'Compensating rollback failed',
      localRb.unrecoveredKeys,
      sessionRb.unrecoveredKeys,
      txId
    );

    var stageInfo = this._stageTransactionRecoveryBundle(bundleInfo.bundle, bundleInfo.bundleJson);
    if (telemetryTransitions) {
      telemetryTransitions.push(stageInfo.stagingSuccess ? 'RECOVERY_PERSISTED' : 'MEMORY_ONLY_RECOVERY');
      telemetryTransitions.push('EMERGENCY_ISOLATION');
    }

    return {
      rolledBack: false,
      terminalState: 'EMERGENCY_ISOLATION',
      status: (failedSessionKeys && failedSessionKeys.length > 0)
        ? (stageInfo.stagingSuccess ? 'postcondition_failed_recovery_metadata_rollback_incomplete' : 'recovery_staging_failed_memory_only')
        : (stageInfo.stagingSuccess ? 'partial_failure_unrecovered' : 'recovery_staging_failed_memory_only'),
      localResult: localRb,
      sessionResult: sessionRb,
      recoveryBundle: bundleInfo.bundle,
      recoveryBundleJson: bundleInfo.bundleJson,
      recoveryKey: stageInfo.recoveryKey,
      recoveryPersistence: stageInfo.persistence,
      stagingSuccess: stageInfo.stagingSuccess,
      stagingError: stageInfo.stagingError,
      error: primaryError ? (primaryError.message || String(primaryError)) : 'Dual storage rollback incomplete'
    };
  },

  // =========================================================================
  // TRANSACTION A: CLEAN SLATE RESET ORCHESTRATOR (TM-I03, TM-I05, TM-I06, TM-I10)
  // =========================================================================

  resetWorkspace: function() {
    var txId = this._generateTransactionId('tx');
    var transitions = [];
    var errors = [];
    var startedAt = new Date().toISOString();

    // -----------------------------------------------------------------------
    // PHASE 0: PREFLIGHT ISOLATION CHECK (DG3-02, Guardrail 4.4, TM-I12)
    // -----------------------------------------------------------------------
    transitions.push('PREFLIGHT_ISOLATION_CHECK');
    var isolationCheck = this._checkUnresolvedEmergencyIsolation();
    if (isolationCheck.hasUnresolvedIsolation) {
      // Reject reset immediately WITHOUT overwriting or disconnecting pre-existing memory-only bundle!
      transitions.push('RESET_REJECTED_ISOLATION');
      console.warn('StorageDriver resetWorkspace rejected: unresolved emergency isolation active.');
      
      // If lastResetResult already exists with active isolation, keep it intact (Review 03 Section 4.C, Review 04 Section 4.4)
      if (!this.lastResetResult) {
        var existingBundle = isolationCheck.bundle || null;
        var existingBundleJson = isolationCheck.bundleJson || null;
        var existingPersistence = isolationCheck.memoryOnly ? 'memory_only' : 'persisted';

        var rejectionTelemetry = {
          transactionId: txId,
          transactionType: 'clean_slate_reset',
          startedAt: startedAt,
          completedAt: new Date().toISOString(),
          initialLocalKeyCount: 0,
          initialRecoveryKeyCount: 0,
          transitionHistory: transitions,
          terminalState: 'RESET_REJECTED_ISOLATION',
          compensationOutcome: {
            localRestored: false,
            localVerified: false,
            recoveryMetadataRestored: false,
            recoveryMetadataVerified: false,
            unrecoveredLocalKeys: [],
            unrecoveredSessionKeys: []
          },
          recoveryPersistence: existingPersistence,
          recoveryBundleAvailable: Boolean(existingBundle || existingBundleJson),
          errors: ['Destructive reset rejected: unresolved emergency isolation active (' + isolationCheck.reason + ')']
        };

        this.lastResetResult = {
          success: false,
          status: 'rejected_unresolved_emergency_isolation',
          terminalState: 'RESET_REJECTED_ISOLATION',
          rolledBack: false,
          failedKey: null,
          deletedCount: 0,
          restoredCount: 0,
          unrecoveredKeys: [],
          error: 'Destructive reset rejected: unresolved emergency recovery active (' + isolationCheck.reason + ')',
          recoveryBundle: existingBundle,
          recoveryBundleJson: existingBundleJson,
          recoveryPersistence: existingPersistence,
          telemetry: this._deepFreezeTelemetry(rejectionTelemetry)
        };
      } else {
        // Tag retry rejection non-destructively while preserving previous terminalState & bundle intact
        this.lastResetResult.retryRejected = true;
      }

      if (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state) {
        window.HortOpsApp.state.recoveryRequired = true;
        window.HortOpsApp.state._autosaveBlocked = true;
      }
      return false;
    }

    // -----------------------------------------------------------------------
    // PHASE 1: PREFLIGHT INVENTORY & DUAL-DOMAIN SNAPSHOT (TM-I01)
    // -----------------------------------------------------------------------
    transitions.push('PREFLIGHT_LOCAL');
    transitions.push('PREFLIGHT_SESSION');

    var keysToRemove = [
      this.WORKSPACE_STORAGE_KEY,
      this.LEGACY_V1_KEY,
      'hort_ops_jobs_offline',
      'hort_ops_staff_offline',
      'hort_ops_assignments_offline',
      'hort_ops_permits_offline',
      'hort_ops_budget_offline',
      '__hort_ops_persistence_probe__'
    ];

    var preflight = this._captureStoragePreflight(keysToRemove);
    if (!preflight.success) {
      transitions.push('PREFLIGHT_ABORT_READ');
      errors.push(preflight.error);
      console.error('StorageDriver preflight read snapshot failed:', preflight.error);

      var abortTelemetry = {
        transactionId: txId,
        transactionType: 'clean_slate_reset',
        startedAt: startedAt,
        completedAt: new Date().toISOString(),
        initialLocalKeyCount: 0,
        initialRecoveryKeyCount: 0,
        transitionHistory: transitions,
        terminalState: 'PREFLIGHT_ABORT_READ',
        compensationOutcome: {
          localRestored: false,
          localVerified: false,
          recoveryMetadataRestored: false,
          recoveryMetadataVerified: false,
          unrecoveredLocalKeys: [],
          unrecoveredSessionKeys: []
        },
        recoveryPersistence: null,
        recoveryBundleAvailable: false,
        errors: errors
      };

      this.lastResetResult = {
        success: false,
        status: 'preflight_failed',
        terminalState: 'PREFLIGHT_ABORT_READ',
        rolledBack: false,
        failedKey: null,
        deletedCount: 0,
        restoredCount: 0,
        unrecoveredKeys: [],
        error: preflight.error,
        telemetry: this._deepFreezeTelemetry(abortTelemetry)
      };
      return false;
    }

    transitions.push('SNAPSHOTS_READY');
    var localSnapshot = preflight.localSnapshot;
    var sessionSnapshot = preflight.sessionSnapshot;

    var initialLocalCount = Object.keys(localSnapshot).length;
    var initialSessionCount = Object.keys(sessionSnapshot).length;

    // Keys to delete in localStorage
    var keysToDelete = Object.keys(localSnapshot);
    for (var n = 0; n < keysToRemove.length; n++) {
      if (keysToDelete.indexOf(keysToRemove[n]) === -1) {
        keysToDelete.push(keysToRemove[n]);
      }
    }

    // -----------------------------------------------------------------------
    // PHASE 2: SEQUENTIAL LOCAL STORAGE DELETION (TM-I02, TM-I05)
    // -----------------------------------------------------------------------
    transitions.push('DELETE_LOCAL');
    var deletedLocalKeys = [];
    var localDeleteFailed = false;
    var failedLocalKey = null;
    var localDeleteError = null;

    for (var j = 0; j < keysToDelete.length; j++) {
      var targetKey = keysToDelete[j];
      try {
        (window.HortOpsClientStorage || window).localStorage.removeItem(targetKey);
        deletedLocalKeys.push(targetKey);
      } catch (err) {
        localDeleteFailed = true;
        failedLocalKey = targetKey;
        localDeleteError = err;
        errors.push('localStorage removeItem failed on key: ' + targetKey + ' (' + (err.message || String(err)) + ')');
        console.error('StorageDriver removeItem failed for ' + targetKey + ':', err);
        break; // Stop mutations immediately on first failure
      }
    }

    // -----------------------------------------------------------------------
    // PHASE 3: LOCAL STORAGE CLEAR VERIFICATION (Guardrail 4.1, TM-I14)
    // -----------------------------------------------------------------------
    if (!localDeleteFailed) {
      transitions.push('VERIFY_LOCAL_CLEAR');
      try {
        // Postcondition check 1: targeted keys absent
        for (var p = 0; p < keysToDelete.length; p++) {
          var checkKey = keysToDelete[p];
          if ((window.HortOpsClientStorage || window).localStorage.getItem(checkKey) !== null) {
            localDeleteFailed = true;
            failedLocalKey = checkKey;
            localDeleteError = new Error('Postcondition check failed: key ' + checkKey + ' still present');
            errors.push(localDeleteError.message);
            break;
          }
        }
        // Postcondition check 2: scan entire localStorage for any remaining governed keys
        if (!localDeleteFailed) {
          var lLenCheck = (typeof (window.HortOpsClientStorage || window).localStorage.length === 'number') ? (window.HortOpsClientStorage || window).localStorage.length : 0;
          for (var lIdx = 0; lIdx < lLenCheck; lIdx++) {
            var scKey = (window.HortOpsClientStorage || window).localStorage.key(lIdx);
            if (scKey && (scKey.indexOf('hort_ops_') === 0 || scKey.indexOf('__hort_ops_') === 0)) {
              localDeleteFailed = true;
              failedLocalKey = scKey;
              localDeleteError = new Error('Postcondition scan failed: residual governed key ' + scKey);
              errors.push(localDeleteError.message);
              break;
            }
          }
        }
      } catch (checkErr) {
        localDeleteFailed = true;
        failedLocalKey = failedLocalKey || 'verification_read';
        localDeleteError = checkErr;
        errors.push('localStorage verification read exception: ' + (checkErr.message || String(checkErr)));
      }
    }

    // If local deletion or clear verification failed, trigger dual-store rollback
    if (localDeleteFailed) {
      var rbOutcomeLocal = this._executeCompensatingRollback(
        localSnapshot,
        sessionSnapshot,
        deletedLocalKeys,
        [],
        localDeleteError,
        txId,
        failedLocalKey,
        transitions
      );

      var rbTelemetryLocal = {
        transactionId: txId,
        transactionType: 'clean_slate_reset',
        startedAt: startedAt,
        completedAt: new Date().toISOString(),
        initialLocalKeyCount: initialLocalCount,
        initialRecoveryKeyCount: initialSessionCount,
        transitionHistory: transitions,
        terminalState: rbOutcomeLocal.terminalState,
        compensationOutcome: {
          localRestored: rbOutcomeLocal.localResult.success,
          localVerified: rbOutcomeLocal.localResult.success,
          recoveryMetadataRestored: rbOutcomeLocal.sessionResult.success,
          recoveryMetadataVerified: rbOutcomeLocal.sessionResult.success,
          unrecoveredLocalKeys: rbOutcomeLocal.localResult.unrecoveredKeys,
          unrecoveredSessionKeys: rbOutcomeLocal.sessionResult.unrecoveredKeys
        },
        recoveryPersistence: rbOutcomeLocal.recoveryPersistence || null,
        recoveryBundleAvailable: Boolean(rbOutcomeLocal.recoveryBundle || rbOutcomeLocal.recoveryBundleJson),
        errors: errors
      };

      this.lastResetResult = {
        success: false,
        status: rbOutcomeLocal.status,
        terminalState: rbOutcomeLocal.terminalState,
        rolledBack: rbOutcomeLocal.rolledBack,
        failedKey: failedLocalKey,
        deletedCount: deletedLocalKeys.length,
        restoredCount: rbOutcomeLocal.localResult.restoredCount,
        unrecoveredKeys: rbOutcomeLocal.localResult.unrecoveredKeys,
        recoveryArtifact: (rbOutcomeLocal.recoveryBundle && rbOutcomeLocal.recoveryBundle.currentWorkspaceRecoveryArtifact) || null,
        recoveryArtifactJson: (rbOutcomeLocal.recoveryBundle && JSON.stringify(rbOutcomeLocal.recoveryBundle.currentWorkspaceRecoveryArtifact)) || null,
        recoveryBundle: rbOutcomeLocal.recoveryBundle || null,
        recoveryBundleJson: rbOutcomeLocal.recoveryBundleJson || null,
        recoveryKey: rbOutcomeLocal.recoveryKey || null,
        recoveryPersistence: rbOutcomeLocal.recoveryPersistence || null,
        snapshot: localSnapshot,
        error: rbOutcomeLocal.error,
        stagingError: rbOutcomeLocal.stagingError || null,
        telemetry: this._deepFreezeTelemetry(rbTelemetryLocal)
      };

      if (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state) {
        window.HortOpsApp.state._autosaveBlocked = true;
        if (!rbOutcomeLocal.rolledBack) {
          window.HortOpsApp.state.recoveryRequired = true;
        }
      }
      return false;
    }

    // -----------------------------------------------------------------------
    // PHASE 4: EMERGENCY SESSION STORAGE CLEANUP (TM-I02, TM-I05)
    // -----------------------------------------------------------------------
    transitions.push('CLEAN_RECOVERY_METADATA');
    var sessionKeysToRemove = Object.keys(sessionSnapshot);
    var deletedSessionKeys = [];
    var sessionCleanupFailed = false;
    var failedSessionKey = null;
    var sessionCleanupError = null;

    for (var sj = 0; sj < sessionKeysToRemove.length; sj++) {
      var sTargetKey = sessionKeysToRemove[sj];
      try {
        (window.HortOpsClientStorage || window).sessionStorage.removeItem(sTargetKey);
        deletedSessionKeys.push(sTargetKey);
      } catch (sRemErr) {
        sessionCleanupFailed = true;
        failedSessionKey = sTargetKey;
        sessionCleanupError = sRemErr;
        errors.push('sessionStorage removeItem failed on key: ' + sTargetKey + ' (' + (sRemErr.message || String(sRemErr)) + ')');
        console.error('StorageDriver session removeItem failed for ' + sTargetKey + ':', sRemErr);
        break; // Stop session deletions immediately on first failure
      }
    }

    // -----------------------------------------------------------------------
    // PHASE 5: SESSION CLEAR VERIFICATION (Guardrail 4.1, TM-I14)
    // -----------------------------------------------------------------------
    if (!sessionCleanupFailed) {
      transitions.push('VERIFY_RECOVERY_CLEAR');
      try {
        for (var skIdx = 0; skIdx < sessionKeysToRemove.length; skIdx++) {
          var chkSKey = sessionKeysToRemove[skIdx];
          if ((window.HortOpsClientStorage || window).sessionStorage.getItem(chkSKey) !== null) {
            sessionCleanupFailed = true;
            failedSessionKey = chkSKey;
            sessionCleanupError = new Error('Postcondition check failed: session recovery key ' + chkSKey + ' still present');
            errors.push(sessionCleanupError.message);
            break;
          }
        }
        if (!sessionCleanupFailed) {
          var ssLenCheck = (typeof (window.HortOpsClientStorage || window).sessionStorage.length === 'number') ? (window.HortOpsClientStorage || window).sessionStorage.length : 0;
          for (var sIdx = 0; sIdx < ssLenCheck; sIdx++) {
            var remKey = (window.HortOpsClientStorage || window).sessionStorage.key(sIdx);
            if (remKey && remKey.indexOf('hort_ops_emergency_recovery_v2') === 0) {
              sessionCleanupFailed = true;
              failedSessionKey = remKey;
              sessionCleanupError = new Error('Postcondition scan failed: residual emergency recovery key ' + remKey);
              errors.push(sessionCleanupError.message);
              break;
            }
          }
        }
      } catch (sCheckErr) {
        sessionCleanupFailed = true;
        failedSessionKey = failedSessionKey || 'session_verification_read';
        sessionCleanupError = sCheckErr;
        errors.push('sessionStorage verification read exception: ' + (sCheckErr.message || String(sCheckErr)));
      }
    }

    // If session cleanup or clear verification failed, trigger dual-store rollback
    if (sessionCleanupFailed) {
      var rbOutcomeSession = this._executeCompensatingRollback(
        localSnapshot,
        sessionSnapshot,
        deletedLocalKeys,
        deletedSessionKeys,
        sessionCleanupError,
        txId,
        failedSessionKey,
        transitions
      );

      var rbTelemetrySession = {
        transactionId: txId,
        transactionType: 'clean_slate_reset',
        startedAt: startedAt,
        completedAt: new Date().toISOString(),
        initialLocalKeyCount: initialLocalCount,
        initialRecoveryKeyCount: initialSessionCount,
        transitionHistory: transitions,
        terminalState: rbOutcomeSession.terminalState,
        compensationOutcome: {
          localRestored: rbOutcomeSession.localResult.success,
          localVerified: rbOutcomeSession.localResult.success,
          recoveryMetadataRestored: rbOutcomeSession.sessionResult.success,
          recoveryMetadataVerified: rbOutcomeSession.sessionResult.success,
          unrecoveredLocalKeys: rbOutcomeSession.localResult.unrecoveredKeys,
          unrecoveredSessionKeys: rbOutcomeSession.sessionResult.unrecoveredKeys
        },
        recoveryPersistence: rbOutcomeSession.recoveryPersistence || null,
        recoveryBundleAvailable: Boolean(rbOutcomeSession.recoveryBundle || rbOutcomeSession.recoveryBundleJson),
        errors: errors
      };

      this.lastResetResult = {
        success: false,
        status: rbOutcomeSession.status,
        terminalState: rbOutcomeSession.terminalState,
        rolledBack: rbOutcomeSession.rolledBack,
        failedKey: failedSessionKey,
        deletedCount: deletedLocalKeys.length,
        restoredCount: rbOutcomeSession.localResult.restoredCount,
        unrecoveredKeys: rbOutcomeSession.localResult.unrecoveredKeys,
        recoveryArtifact: (rbOutcomeSession.recoveryBundle && rbOutcomeSession.recoveryBundle.currentWorkspaceRecoveryArtifact) || null,
        recoveryArtifactJson: (rbOutcomeSession.recoveryBundle && JSON.stringify(rbOutcomeSession.recoveryBundle.currentWorkspaceRecoveryArtifact)) || null,
        recoveryBundle: rbOutcomeSession.recoveryBundle || null,
        recoveryBundleJson: rbOutcomeSession.recoveryBundleJson || null,
        recoveryKey: rbOutcomeSession.recoveryKey || null,
        recoveryPersistence: rbOutcomeSession.recoveryPersistence || null,
        snapshot: localSnapshot,
        error: rbOutcomeSession.error,
        stagingError: rbOutcomeSession.stagingError || null,
        telemetry: this._deepFreezeTelemetry(rbTelemetrySession)
      };

      if (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state) {
        window.HortOpsApp.state._autosaveBlocked = true;
        if (!rbOutcomeSession.rolledBack) {
          window.HortOpsApp.state.recoveryRequired = true;
        }
      }
      return false;
    }

    // -----------------------------------------------------------------------
    // PHASE 6: COMMIT (TM-I03)
    // -----------------------------------------------------------------------
    transitions.push('COMMIT');
    this.memory = {};

    transitions.push('COMMITTED_CLEAN_SLATE');
    var successTelemetry = {
      transactionId: txId,
      transactionType: 'clean_slate_reset',
      startedAt: startedAt,
      completedAt: new Date().toISOString(),
      initialLocalKeyCount: initialLocalCount,
      initialRecoveryKeyCount: initialSessionCount,
      transitionHistory: transitions,
      terminalState: 'COMMITTED_CLEAN_SLATE',
      compensationOutcome: {
        localRestored: true,
        localVerified: true,
        recoveryMetadataRestored: true,
        recoveryMetadataVerified: true,
        unrecoveredLocalKeys: [],
        unrecoveredSessionKeys: []
      },
      recoveryPersistence: null,
      recoveryBundleAvailable: false,
      errors: []
    };

    this.lastResetResult = {
      success: true,
      status: 'success',
      terminalState: 'COMMITTED_CLEAN_SLATE',
      rolledBack: false,
      failedKey: null,
      deletedCount: deletedLocalKeys.length,
      restoredCount: 0,
      unrecoveredKeys: [],
      telemetry: this._deepFreezeTelemetry(successTelemetry)
    };

    if (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state) {
      window.HortOpsApp.state.recoveryRequired = false;
      window.HortOpsApp.state._autosaveBlocked = false;
    }

    return true;
  },

  // =========================================================================
  // TRANSACTION B: EMERGENCY RECOVERY RESTORE ORCHESTRATOR (TM-I13, DG3-01..03)
  // =========================================================================

  restoreEmergencyRecoveryArtifact: function(artifactInput, targetSourceContext) {
    if (typeof HortOpsRecoveryArtifact === 'undefined' || typeof HortOpsRecoveryArtifact.validateEmergencyRecoveryArtifact !== 'function') {
      return { success: false, status: 'restore_preflight_failed', error: 'HortOpsRecoveryArtifact validator not available' };
    }

    var parsedInput = null;
    if (typeof artifactInput === 'string') {
      try { parsedInput = JSON.parse(artifactInput); } catch (e) {}
    } else if (artifactInput && typeof artifactInput === 'object') {
      parsedInput = artifactInput;
    }

    var sourceCtx = targetSourceContext || {};
    if (parsedInput && (parsedInput.artifactType === 'hort_ops_reset_transaction_recovery' ||
        parsedInput.bundleType === 'hort_ops_reset_transaction_recovery' ||
        parsedInput.currentWorkspaceRecoveryArtifact)) {
      if (parsedInput.currentWorkspaceRecoveryArtifact) {
        if (!sourceCtx.parentTransactionId && parsedInput.transactionId) {
          sourceCtx.parentTransactionId = parsedInput.transactionId;
        }
        artifactInput = parsedInput.currentWorkspaceRecoveryArtifact;
      }
    }

    var validation = HortOpsRecoveryArtifact.validateEmergencyRecoveryArtifact(artifactInput);
    if (!validation.valid) {
      return { success: false, status: 'restore_preflight_failed', error: validation.error };
    }

    var artifact = validation.artifact;
    var snapshot = artifact.storageSnapshot;
    var rawInputString = (typeof artifactInput === 'string') ? artifactInput : JSON.stringify(artifactInput);

    if (typeof window === 'undefined' || !(window.HortOpsClientStorage || window).localStorage || !(window.HortOpsClientStorage || window).sessionStorage) {
      return { success: false, status: 'restore_preflight_failed', error: 'Browser storage APIs not accessible' };
    }

    // 1. Snapshot pre-restore state for all keys in target before any mutation
    var preRestoreSnapshot = {};
    try {
      for (var k in snapshot) {
        if (Object.prototype.hasOwnProperty.call(snapshot, k)) {
          preRestoreSnapshot[k] = (window.HortOpsClientStorage || window).localStorage.getItem(k);
        }
      }
    } catch (snapErr) {
      return {
        success: false,
        status: 'restore_preflight_failed',
        error: 'Pre-restore storage snapshot failed: ' + (snapErr.message || String(snapErr))
      };
    }

    var restoredKeys = [];
    var writeFailed = false;
    var writeError = null;

    // 2. Perform restorative write of snapshot to localStorage
    try {
      for (var key in snapshot) {
        if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
          var val = snapshot[key];
          if (val === null || val === undefined) {
            (window.HortOpsClientStorage || window).localStorage.removeItem(key);
          } else {
            (window.HortOpsClientStorage || window).localStorage.setItem(key, String(val));
          }
          restoredKeys.push(key);
        }
      }
    } catch (wErr) {
      writeFailed = true;
      writeError = wErr;
    }

    // 3. Post-write verification: verify restored values in localStorage byte-for-byte
    var verificationFailed = false;
    var verificationError = null;
    if (!writeFailed) {
      for (var i = 0; i < restoredKeys.length; i++) {
        var vKey = restoredKeys[i];
        var expected = snapshot[vKey];
        if (expected !== null && expected !== undefined) {
          try {
            var actual = (window.HortOpsClientStorage || window).localStorage.getItem(vKey);
            if (actual !== String(expected)) {
              verificationFailed = true;
              verificationError = new Error('Post-restore verification failed for key: ' + vKey);
              break;
            }
          } catch (vErr) {
            verificationFailed = true;
            verificationError = vErr;
            break;
          }
        }
      }
    }

    // 4. If write or verification failed, execute compensating rollback (TM-F21, TM-F22, TM-F25)
    if (writeFailed || verificationFailed) {
      var rbResult = this._restoreRawStorageSnapshot(preRestoreSnapshot);
      var rollbackFailed = !rbResult.success;
      var rollbackError = rbResult.error;

      if (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state) {
        window.HortOpsApp.state.recoveryRequired = true;
        window.HortOpsApp.state._autosaveBlocked = true;
      }

      var primaryError = writeError || verificationError;

      // Double-fault handling: RESTORE_DEEP_FAILURE (TM-F25, DG3-03)
      if (rollbackFailed) {
        var deepBundleInfo = this._buildRestoreTransactionRecoveryBundle(
          preRestoreSnapshot,
          artifact,
          targetSourceContext,
          { restored: false, verified: false, unrecoveredKeys: rbResult.unrecoveredKeys, error: rollbackError }
        );

        var deepStageInfo = this._stageTransactionRecoveryBundle(
          deepBundleInfo.bundle,
          deepBundleInfo.bundleJson,
          'hort_ops_emergency_recovery_v2:restore_transaction:'
        );

        this.lastRestoreResult = {
          success: false,
          status: 'restore_deep_failure',
          terminalState: 'RESTORE_DEEP_FAILURE',
          rolledBack: false,
          recoveryBundle: deepBundleInfo.bundle,
          recoveryBundleJson: deepBundleInfo.bundleJson,
          restoreRecoveryBundle: deepBundleInfo.bundle,
          restoreRecoveryBundleJson: deepBundleInfo.bundleJson,
          recoveryPersistence: deepStageInfo.persistence,
          stagingSuccess: deepStageInfo.stagingSuccess,
          stagingError: deepStageInfo.stagingError,
          error: primaryError ? (primaryError.message || String(primaryError)) : 'Restore and rollback failed',
          rollbackError: rollbackError,
          restoredKeys: restoredKeys
        };

        return this.lastRestoreResult;
      }

      // Single-fault: Rollback of current workspace succeeded (TM-F21, TM-F22)
      this.lastRestoreResult = {
        success: false,
        status: writeFailed ? 'restore_write_failed_rolled_back' : 'restore_verification_failed_rolled_back',
        terminalState: 'ROLLBACK_CURRENT_VERIFIED',
        rolledBack: true,
        error: primaryError ? (primaryError.message || String(primaryError)) : 'Restore failed; current workspace restored intact',
        rollbackError: null,
        restoredKeys: restoredKeys
      };
      return this.lastRestoreResult;
    }

    // -----------------------------------------------------------------------
    // 5. TARGETED ARTIFACT RETIREMENT (Guardrail 4.2, DG3-01)
    // -----------------------------------------------------------------------
    var cleanupFailed = false;
    var cleanupError = null;

    try {
      if ((window.HortOpsClientStorage || window).sessionStorage) {
        // (a) Retire unique recovery artifact key ONLY IF raw string is byte-identical (Review 46 R46-02 / R46-P03)
        if (artifact.recoveryId) {
          var rKey = (typeof HortOpsRecoveryArtifact !== 'undefined' && HortOpsRecoveryArtifact.getRecoveryKey)
            ? HortOpsRecoveryArtifact.getRecoveryKey(artifact.recoveryId)
            : ('hort_ops_emergency_recovery_v2:' + artifact.recoveryId);
          try {
            var currentUniqueVal = (window.HortOpsClientStorage || window).sessionStorage.getItem(rKey);
            if (currentUniqueVal !== null) {
              if (currentUniqueVal === rawInputString) {
                (window.HortOpsClientStorage || window).sessionStorage.removeItem(rKey);
                if ((window.HortOpsClientStorage || window).sessionStorage.getItem(rKey) !== null) {
                  cleanupFailed = true;
                  cleanupError = new Error('Failed to remove unique recovery key: ' + rKey);
                }
              } else {
                // Different raw bytes exist under this key - DO NOT DESTROY! (R46-P03)
              }
            }
          } catch (e1) {
            cleanupFailed = true;
            cleanupError = e1;
          }
        }

        // (b) Retire legacy compatibility alias ONLY IF raw string is byte-identical (R44-03, Review 46 R46-02 / R46-P04)
        var legacyKey = 'hort_ops_emergency_recovery_v2';
        try {
          var currentLegacyVal = (window.HortOpsClientStorage || window).sessionStorage.getItem(legacyKey);
          if (currentLegacyVal !== null) {
            var isExactLegacyMatch = (currentLegacyVal === rawInputString);

            if (isExactLegacyMatch) {
              (window.HortOpsClientStorage || window).sessionStorage.removeItem(legacyKey);
              if ((window.HortOpsClientStorage || window).sessionStorage.getItem(legacyKey) !== null) {
                cleanupFailed = true;
                if (!cleanupError) cleanupError = new Error('Failed to remove matching legacy alias key');
              }
            } else {
              // Legacy alias holds DIFFERENT raw recovery evidence - strictly preserve it! (R46-P04)
            }
          }
        } catch (e2) {
          cleanupFailed = true;
          if (!cleanupError) cleanupError = e2;
        }


      }
    } catch (cleanErr) {
      cleanupFailed = true;
      if (!cleanupError) cleanupError = cleanErr;
    }

    if (cleanupFailed) {
      console.error('StorageDriver restoreEmergencyRecoveryArtifact: targeted retirement failed:', cleanupError);
      if (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state) {
        window.HortOpsApp.state.recoveryRequired = true;
        window.HortOpsApp.state._autosaveBlocked = true;
      }
      this.lastRestoreResult = {
        success: false,
        status: 'restore_metadata_cleanup_failed',
        terminalState: 'RESTORE_METADATA_UNRESOLVED',
        error: cleanupError ? (cleanupError.message || String(cleanupError)) : 'Metadata cleanup postcondition failed',
        restoredKeys: restoredKeys,
        recoveryId: artifact.recoveryId || null,
        retirementOutcome: {
          targetRetired: false,
          error: cleanupError ? (cleanupError.message || String(cleanupError)) : null
        }
      };
      return this.lastRestoreResult;
    }

    // -----------------------------------------------------------------------
    // 6. EVALUATE REMAINING RECOVERY EVIDENCE & AUTOSAVE GATING (DG3-02, Review 45 R45-P05)
    // -----------------------------------------------------------------------
    var inv = this._reconcileRecoveryInventory();
    var remainingArtifactsCount = inv.ok ? inv.count : -1;
    var remainingParentBundles = inv.ok ? inv.compositeKeys.length : -1;
    var scanFailed = !inv.ok;

    // If target source was a parent composite bundle, verify child provenance and mark workspace recovered in registry (Review 44 R44-03 / R44-P04, Review 47 R47-02 / R47-P04_ / R47-P05)
    var pTxId = (sourceCtx && sourceCtx.parentTransactionId) || (targetSourceContext && targetSourceContext.parentTransactionId);
    if (pTxId) {
      var parentKey = 'hort_ops_emergency_recovery_v2:transaction:' + pTxId;
      var parentRaw = null;
      try {
        if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).sessionStorage) {
          parentRaw = (window.HortOpsClientStorage || window).sessionStorage.getItem(parentKey);
        }
      } catch (pReadErr) {}

      if (parentRaw) {
        var pBundle = null;
        try { pBundle = JSON.parse(parentRaw); } catch(pParseErr) {}
        var embeddedChild = pBundle && (pBundle.currentWorkspaceRecoveryArtifact || pBundle.targetRecoveryArtifact);
        var embeddedChildId = embeddedChild && (embeddedChild.recoveryId || embeddedChild.artifactIdentity);

        // Authoritative provenance match: Only bind if embeddedChild identity matches the restored artifact recoveryId (R47-02, R47-P05)
        if (embeddedChildId && artifact && embeddedChildId === artifact.recoveryId) {
          if (!this.resolvedBundles[pTxId]) {
            this.resolvedBundles[pTxId] = {};
          }
          this.resolvedBundles[pTxId].transactionId = pTxId;
          this.resolvedBundles[pTxId].parentKey = parentKey;
          this.resolvedBundles[pTxId].boundRawBytes = parentRaw;
          this.resolvedBundles[pTxId].boundChildRecoveryId = artifact.recoveryId;
          this.resolvedBundles[pTxId].workspaceRecovered = true;
          this.resolvedBundles[pTxId].recoveredAt = new Date().toISOString();
          this.resolvedBundles[pTxId].targetRecoveryId = artifact.recoveryId;
          this.resolvedBundles[pTxId].priorEvidenceAcknowledged = Boolean(this.resolvedBundles[pTxId].priorEvidenceAcknowledged);
          this.resolvedBundles[pTxId].retired = false;
        }
      }
    }

    if (scanFailed || remainingArtifactsCount > 0) {
      // Other evidence remains OR scan failed (Review 45 R45-P05): workspace restored, but recoveryRequired remains true and autosave stays BLOCKED!
      if (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state) {
        window.HortOpsApp.state.recoveryRequired = true;
        window.HortOpsApp.state._autosaveBlocked = true;
        if (window.HortOpsHeader && typeof window.HortOpsHeader.updateStorageHealthIndicator === 'function') {
          window.HortOpsHeader.updateStorageHealthIndicator();
        }
      }
      this.lastRestoreResult = {
        success: true,
        status: scanFailed ? 'restore_scan_failed' : 'restore_success_evidence_remains',
        terminalState: scanFailed ? 'RESTORE_SCAN_FAILED' : 'RESTORE_SUCCESS_EVIDENCE_REMAINS',
        restoredKeys: restoredKeys,
        recoveryId: artifact.recoveryId || null,
        remainingArtifactsCount: remainingArtifactsCount,
        remainingParentBundles: remainingParentBundles,
        recoveryRequired: true
      };
      return this.lastRestoreResult;
    }

    // Zero recovery evidence remains: full clean resolution, unlock autosave
    if (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state) {
      window.HortOpsApp.state.recoveryRequired = false;
      window.HortOpsApp.state._autosaveBlocked = false;
      window.HortOpsApp.state.recoverySource = null;
      window.HortOpsApp.state.recoveryError = null;
      window.HortOpsApp.state.emergencyRecoveryPayload = null;
      if (window.HortOpsHeader && typeof window.HortOpsHeader.updateStorageHealthIndicator === 'function') {
        window.HortOpsHeader.updateStorageHealthIndicator();
      }
    }

    this.lastRestoreResult = {
      success: true,
      status: 'restore_success',
      terminalState: 'RESTORE_SUCCESS_CLEAN',
      restoredKeys: restoredKeys,
      recoveryId: artifact.recoveryId || null,
      recoveryRequired: false
    };
    return this.lastRestoreResult;
  },

  retireCompositeParentBundle: function(transactionId, options) {
    if (!transactionId || typeof window === 'undefined' || !(window.HortOpsClientStorage || window).sessionStorage) {
      return { success: false, error: 'Invalid transactionId or sessionStorage unavailable' };
    }

    var opts = options || {};
    var targetKey = 'hort_ops_emergency_recovery_v2:transaction:' + transactionId;
    var rawBundle = null;
    try {
      rawBundle = (window.HortOpsClientStorage || window).sessionStorage.getItem(targetKey);
    } catch (gErr) {
      return { success: false, error: 'Failed to read parent transaction bundle: ' + (gErr.message || String(gErr)) };
    }

    if (!rawBundle) {
      return { success: false, error: 'Parent bundle not found: ' + targetKey };
    }

    // 1. Verify workspace recovery precondition (Review 44 R44-03 / R44-P06, Review 45 R45-P02, Review 46 R46-01 / R46-P01 / R46-P02)
    // Authorization MUST come exclusively from verified internal state! Caller options are NEVER proof!
    var resolutionRecord = this.resolvedBundles[transactionId];
    var isWorkspaceRecovered = Boolean(resolutionRecord && resolutionRecord.workspaceRecovered === true);
     if (!isWorkspaceRecovered) {
      return {
        success: false,
        status: 'retirement_rejected_unresolved',
        error: 'Cannot retire parent bundle: workspace recovery has not occurred or been confirmed for transaction: ' + transactionId
      };
    }

    // Evidence tampering check: Verify current raw bytes match bound raw bytes at restore (Review 47 R47-02, R47-P04)
    if (resolutionRecord.boundRawBytes && rawBundle !== resolutionRecord.boundRawBytes) {
      return {
        success: false,
        status: 'retirement_rejected_evidence_tampered',
        error: 'Cannot retire parent bundle: stored raw evidence does not match bound recovery evidence for transaction: ' + transactionId
      };
    }

    // 2. Require recorded distinct operator acknowledgement on EVERY parent composite bundle (Review 50 R50-D / R50-P04)
    var parsedBundle = null;
    try { parsedBundle = JSON.parse(rawBundle); } catch (e) {}
    var isPriorAcknowledged = Boolean(resolutionRecord && resolutionRecord.priorEvidenceAcknowledged === true);
    if (!isPriorAcknowledged) {
      return {
        success: false,
        status: 'retirement_rejected_unacknowledged_parent_evidence',
        error: 'Cannot retire parent bundle: parent transaction recovery evidence has not been explicitly acknowledged for transaction: ' + transactionId
      };
    }

    // 3. Execution of removal with pre-removal hold & verified compensating rollback (Review 47 R47-03, R47-P08, Review 48 R48-B, R48-P03)
    var preRemovalPreimage = rawBundle;
    var removalSucceeded = false;
    try {
      (window.HortOpsClientStorage || window).sessionStorage.removeItem(targetKey);
      var verifyCheck = (window.HortOpsClientStorage || window).sessionStorage.getItem(targetKey);
      if (verifyCheck === null) {
        removalSucceeded = true;
      }
    } catch (remErr) {
      removalSucceeded = false;
    }

    if (!removalSucceeded) {
      var compensationVerified = false;
      try {
        (window.HortOpsClientStorage || window).sessionStorage.setItem(targetKey, preRemovalPreimage);
        var compCheck = (window.HortOpsClientStorage || window).sessionStorage.getItem(targetKey);
        if (compCheck === preRemovalPreimage) {
          compensationVerified = true;
        }
      } catch (compErr) {
        compensationVerified = false;
      }

      if (compensationVerified) {
        return {
          success: false,
          status: 'retirement_verification_failed_compensated',
          error: 'Failed to verify removal of parent transaction bundle: prior evidence restored and verified preserved for transaction: ' + transactionId
        };
      }

      // Compensation unverified / failed: Retain exportable in-memory preimage (Review 48 R48-B, R48-P03)
      this._retirementRecoveryBundleJson = preRemovalPreimage;
      this._retirementRecoveryKey = targetKey;
      if (this.lastRestoreResult) {
        this.lastRestoreResult.recoveryBundleJson = preRemovalPreimage;
      }
      if (this.lastResetResult) {
        this.lastResetResult.recoveryBundleJson = preRemovalPreimage;
      }

      // Enter active emergency isolation
      this._activeIsolation = true;
      if (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state) {
        window.HortOpsApp.state.recoveryRequired = true;
        window.HortOpsApp.state._autosaveBlocked = true;
      }

      return {
        success: false,
        status: 'retirement_verification_failed_uncompensated',
        error: 'Failed to verify removal and failed to verify compensation for parent bundle: in-memory preimage retained under emergency isolation for transaction: ' + transactionId,
        recoveryBundleJson: preRemovalPreimage
      };
    }

    if (!this.resolvedBundles[transactionId]) {
      this.resolvedBundles[transactionId] = {};
    }
    this.resolvedBundles[transactionId].retired = true;
    this.resolvedBundles[transactionId].retiredAt = new Date().toISOString();

    // Check if any other recovery artifacts remain in sessionStorage using fail-closed inventory (Review 45 R45-P06)
    var inv = this._reconcileRecoveryInventory();
    if (!inv.ok) {
      if (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state) {
        window.HortOpsApp.state.recoveryRequired = true;
        window.HortOpsApp.state._autosaveBlocked = true;
      }
      return {
        success: true,
        status: 'retired_scan_unverified',
        warning: 'Parent bundle removed, but remaining inventory scan encountered storage exception',
        retiredTransactionId: transactionId,
        remainingEvidenceCount: -1
      };
    }

    if (inv.count === 0 && typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state) {
      window.HortOpsApp.state.recoveryRequired = false;
      window.HortOpsApp.state._autosaveBlocked = false;
      if (window.HortOpsHeader && typeof window.HortOpsHeader.updateStorageHealthIndicator === 'function') {
        window.HortOpsHeader.updateStorageHealthIndicator();
      }
    }

    return { success: true, remainingEvidenceCount: inv.count };
  },

  prepareParentEvidenceInspection: function(transactionId) {
    if (!transactionId) {
      return { success: false, status: 'invalid_transaction_id', error: 'Invalid transactionId' };
    }
    if (!this.resolvedBundles || !this.resolvedBundles[transactionId] || !this.resolvedBundles[transactionId].workspaceRecovered) {
      return {
        success: false,
        status: 'parent_not_resolved_or_workspace_not_recovered',
        error: 'Cannot inspect prior evidence: parent bundle not resolved or workspace not recovered for transaction: ' + transactionId
      };
    }

    var record = this.resolvedBundles[transactionId];
    var targetKey = record.parentKey || ('hort_ops_emergency_recovery_v2:transaction:' + transactionId);
    var currentRaw = null;
    try {
      if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).sessionStorage) {
        currentRaw = (window.HortOpsClientStorage || window).sessionStorage.getItem(targetKey);
      }
    } catch (e) {
      return { success: false, status: 'storage_read_failed', error: e.message || String(e) };
    }
    if (!currentRaw) {
      return { success: false, status: 'parent_bundle_not_found', error: 'Parent bundle not found in sessionStorage: ' + targetKey };
    }
    if (record.boundRawBytes && currentRaw !== record.boundRawBytes) {
      return {
        success: false,
        status: 'inspection_rejected_evidence_tampered',
        error: 'Cannot inspect prior evidence: stored raw evidence does not match bound recovery evidence for transaction: ' + transactionId
      };
    }

    var parsedBundle = null;
    try { parsedBundle = JSON.parse(currentRaw); } catch (e) {
      return { success: false, status: 'parent_bundle_malformed', error: 'Parent bundle JSON parse failure: ' + e.message };
    }

    return {
      success: true,
      status: 'parent_prior_evidence_prepared',
      transactionId: transactionId,
      rawBytes: currentRaw,
      previousEmergencyRecoveryMetadata: parsedBundle.previousEmergencyRecoveryMetadata || {},
      compensationOutcome: parsedBundle.compensationOutcome || null,
      parentBundle: parsedBundle
    };
  },

  recordParentEvidenceInspected: function(transactionId, receipt) {
    if (!transactionId || !this.resolvedBundles || !this.resolvedBundles[transactionId] || !this.resolvedBundles[transactionId].workspaceRecovered) {
      return {
        success: false,
        status: 'parent_not_resolved_or_workspace_not_recovered',
        error: 'Parent bundle not resolved or workspace not recovered for transaction: ' + transactionId
      };
    }
    var record = this.resolvedBundles[transactionId];

    // Mandatory complete presentation receipt verification (Review 53 R53-01)
    if (!receipt || typeof receipt !== 'object') {
      return {
        success: false,
        status: 'missing_presentation_receipt',
        error: 'Cannot record inspection without affirmative presentation receipt'
      };
    }
    if (receipt.transactionId !== transactionId) {
      return {
        success: false,
        status: 'receipt_transaction_mismatch',
        error: 'Receipt transactionId mismatch: expected ' + transactionId + ', got ' + receipt.transactionId
      };
    }
    if (receipt.presented !== true || receipt.evidenceDisplayed !== true) {
      return {
        success: false,
        status: 'presentation_not_confirmed',
        error: 'Receipt does not confirm affirmative evidence presentation and display'
      };
    }
    if (!receipt.rawBytes) {
      return {
        success: false,
        status: 'receipt_missing_raw_bytes',
        error: 'Receipt must include presented rawBytes'
      };
    }
    if (record.boundRawBytes && receipt.rawBytes !== record.boundRawBytes) {
      return {
        success: false,
        status: 'receipt_evidence_mismatch',
        error: 'Receipt rawBytes do not match bound parent rawBytes'
      };
    }

    record.priorEvidenceInspected = true;
    record.priorEvidenceInspectedAt = receipt.inspectedAt || new Date().toISOString();
    record.inspectionReceipt = receipt;
    return {
      success: true,
      status: 'parent_prior_evidence_inspected',
      transactionId: transactionId,
      priorEvidenceInspected: true,
      receipt: receipt
    };
  },

  inspectParentPriorEvidence: function(transactionId, options) {
    var prep = this.prepareParentEvidenceInspection(transactionId);
    if (!prep.success) return prep;
    if (options && options.prepareOnly === true) {
      return prep;
    }
    if (options && options.receipt) {
      var rec = this.recordParentEvidenceInspected(transactionId, options.receipt);
      if (!rec.success) return rec;
      prep.status = 'parent_prior_evidence_inspected';
      prep.priorEvidenceInspected = true;
      prep.receipt = options.receipt;
      return prep;
    }
    // Route through verified UI presentation path if quarantine modal is active (Review 53 R53-01)
    if (typeof window !== 'undefined' && window.HortOpsQuarantineModal && typeof window.HortOpsQuarantineModal.inspectParentEvidence === 'function') {
      window.HortOpsQuarantineModal.inspectParentEvidence(transactionId);
      var record = this.resolvedBundles && this.resolvedBundles[transactionId];
      if (record && record.priorEvidenceInspected) {
        prep.status = 'parent_prior_evidence_inspected';
        prep.priorEvidenceInspected = true;
        prep.receipt = record.inspectionReceipt || null;
        return prep;
      }
    }
    // Preparation-only: do not self-certify inspection or fabricate synthetic presentation receipts
    prep.status = 'parent_evidence_inspection_prepared';
    prep.priorEvidenceInspected = false;
    return prep;
  },

  prepareParentEvidenceExport: function(transactionId) {
    if (!transactionId) {
      return { success: false, status: 'invalid_transaction_id', error: 'Invalid transactionId' };
    }
    if (!this.resolvedBundles || !this.resolvedBundles[transactionId] || !this.resolvedBundles[transactionId].workspaceRecovered) {
      return {
        success: false,
        status: 'parent_not_resolved_or_workspace_not_recovered',
        error: 'Cannot export prior evidence: parent bundle not resolved or workspace not recovered for transaction: ' + transactionId
      };
    }

    var record = this.resolvedBundles[transactionId];
    var targetKey = record.parentKey || ('hort_ops_emergency_recovery_v2:transaction:' + transactionId);
    var currentRaw = null;
    try {
      if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).sessionStorage) {
        currentRaw = (window.HortOpsClientStorage || window).sessionStorage.getItem(targetKey);
      }
    } catch (e) {
      return { success: false, status: 'storage_read_failed', error: e.message || String(e) };
    }
    if (!currentRaw) {
      return { success: false, status: 'parent_bundle_not_found', error: 'Parent bundle not found in sessionStorage: ' + targetKey };
    }
    if (record.boundRawBytes && currentRaw !== record.boundRawBytes) {
      return {
        success: false,
        status: 'export_rejected_evidence_tampered',
        error: 'Cannot export prior evidence: stored raw evidence does not match bound recovery evidence for transaction: ' + transactionId
      };
    }

    var parsedBundle = null;
    try { parsedBundle = JSON.parse(currentRaw); } catch (e) {
      return { success: false, status: 'parent_bundle_malformed', error: 'Parent bundle JSON parse failure: ' + e.message };
    }

    return {
      success: true,
      status: 'parent_prior_evidence_prepared',
      transactionId: transactionId,
      exportData: currentRaw,
      filename: 'hort_ops_parent_transaction_' + transactionId + '_' + (new Date()).toISOString().replace(/[:.]/g, '-') + '.json',
      previousEmergencyRecoveryMetadata: parsedBundle.previousEmergencyRecoveryMetadata || {}
    };
  },

  recordParentEvidenceExportInitiated: function(transactionId) {
    if (!transactionId) {
      return { success: false, status: 'invalid_transaction_id', error: 'Invalid transactionId' };
    }
    if (!this.resolvedBundles || !this.resolvedBundles[transactionId] || !this.resolvedBundles[transactionId].workspaceRecovered) {
      return {
        success: false,
        status: 'parent_not_resolved_or_workspace_not_recovered',
        error: 'Cannot record export initiated: parent bundle not resolved for transaction: ' + transactionId
      };
    }
    var record = this.resolvedBundles[transactionId];
    record.priorEvidenceExported = true;
    record.priorEvidenceExportedAt = new Date().toISOString();
    return {
      success: true,
      status: 'parent_prior_evidence_export_initiated',
      transactionId: transactionId,
      priorEvidenceExported: true
    };
  },

  exportParentPriorEvidence: function(transactionId, options) {
    // Review 51 R51-P01: Caller-supplied options alone MUST NOT grant export authority
    return this.prepareParentEvidenceExport(transactionId);
  },

  acknowledgeParentPriorEvidence: function(transactionId, options) {
    if (!transactionId) {
      return { success: false, status: 'invalid_transaction_id', error: 'Invalid transactionId' };
    }
    if (!this.resolvedBundles || !this.resolvedBundles[transactionId] || !this.resolvedBundles[transactionId].workspaceRecovered) {
      return {
        success: false,
        status: 'parent_not_resolved_or_workspace_not_recovered',
        error: 'Cannot acknowledge prior evidence: parent bundle not resolved or workspace not recovered for transaction: ' + transactionId
      };
    }

    var record = this.resolvedBundles[transactionId];
    var targetKey = record.parentKey || ('hort_ops_emergency_recovery_v2:transaction:' + transactionId);
    var currentRaw = null;
    try {
      if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).sessionStorage) {
        currentRaw = (window.HortOpsClientStorage || window).sessionStorage.getItem(targetKey);
      }
    } catch (e) {
      return {
        success: false,
        status: 'storage_read_failed',
        error: 'Cannot acknowledge prior evidence: failed to re-read parent evidence from storage: ' + (e.message || String(e))
      };
    }

    if (!currentRaw) {
      return {
        success: false,
        status: 'parent_bundle_not_found',
        error: 'Cannot acknowledge prior evidence: parent bundle not found in storage: ' + targetKey
      };
    }

    // Check tampering against bound raw bytes (Review 47 R47-02, Review 48 R48-A, Review 50 R50-C)
    if (record.boundRawBytes && currentRaw !== record.boundRawBytes) {
      return {
        success: false,
        status: 'acknowledgement_rejected_evidence_tampered',
        error: 'Cannot acknowledge prior evidence: stored raw evidence does not match bound recovery evidence for transaction: ' + transactionId
      };
    }

    // Check if bundle contains non-empty prior metadata (Review 48 R48-A, R48-P02, Review 49 R49-B / R49-P02)
    var parsedBundle = null;
    try { parsedBundle = JSON.parse(currentRaw); } catch (e) {
      return {
        success: false,
        status: 'parent_bundle_malformed',
        error: 'Cannot acknowledge prior evidence: parent bundle JSON parse failure: ' + (e.message || String(e))
      };
    }

    var hasPrior = Boolean(parsedBundle && parsedBundle.previousEmergencyRecoveryMetadata && Object.keys(parsedBundle.previousEmergencyRecoveryMetadata).length > 0);
    
    // Gating requirement (Review 49 R49-B / R49-P02):
    // For bundles containing non-empty prior metadata, actual in-app inspection or export MUST have been recorded!
    // Caller-supplied options flags alone cannot forge prior review authority!
    var hasRecordedReview = Boolean(record.priorEvidenceInspected === true || record.priorEvidenceExported === true);
    if (hasPrior && !hasRecordedReview) {
      return {
        success: false,
        status: 'acknowledgement_requires_prior_inspection_or_export',
        error: 'Cannot acknowledge prior evidence: bundle contains prior emergency recovery metadata which must be inspected or exported in-app before acknowledgement.'
      };
    }

    // Review 51 R51-P01, R51-P02:
    // Inspection/export is a prerequisite, NOT confirmation itself!
    // Explicit affirmative operator confirmation (options.operatorConfirmed === true) is MANDATORY on ALL parents!
    var opts = options || {};
    if (opts.operatorConfirmed !== true) {
      return {
        success: false,
        status: 'acknowledgement_requires_operator_confirmation',
        error: 'Cannot acknowledge prior evidence: explicit operator confirmation is required (options.operatorConfirmed must be true).'
      };
    }

    record.priorEvidenceAcknowledged = true;
    record.priorEvidenceAcknowledgedAt = new Date().toISOString();
    return {
      success: true,
      transactionId: transactionId,
      priorEvidenceAcknowledged: true
    };
  },

  extractWorkspaceArtifactFromBundle: function(bundleInput) {
    var bundle = null;
    if (typeof bundleInput === 'string') {
      try { bundle = JSON.parse(bundleInput); } catch (e) { return { valid: false, error: 'Bundle JSON parse error: ' + e.message }; }
    } else {
      bundle = bundleInput;
    }

    if (!bundle || typeof bundle !== 'object') {
      return { valid: false, error: 'Invalid bundle payload' };
    }

    var bType = bundle.artifactType || bundle.bundleType;
    if (bType !== 'hort_ops_reset_transaction_recovery' && bType !== 'hort_ops_restore_transaction_recovery') {
      return { valid: false, error: 'Unsupported bundle artifactType: ' + bType };
    }

    var targetArtifact = bundle.currentWorkspaceRecoveryArtifact || bundle.targetRecoveryArtifact;
    if (!targetArtifact || typeof targetArtifact !== 'object') {
      return { valid: false, error: 'Bundle missing embedded workspace recovery artifact' };
    }

    return {
      valid: true,
      artifact: targetArtifact,
      artifactJson: JSON.stringify(targetArtifact),
      recoveryId: targetArtifact.recoveryId || null,
      parentTransactionId: bundle.transactionId || null,
      parentCreatedAt: bundle.createdAt || null
    };
  },

  // =========================================================================
  // UTILITY METHODS (QUARANTINE & COMPACTION)
  // =========================================================================

  getRawQuarantinePayload: function() {
    try {
      if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).localStorage) {
        var raw = (window.HortOpsClientStorage || window).localStorage.getItem(this.WORKSPACE_STORAGE_KEY);
        if (raw !== null) return raw;
      }
    } catch(e) {}
    if (this.memory && this.memory[this.WORKSPACE_STORAGE_KEY]) {
      try {
        return typeof this.memory[this.WORKSPACE_STORAGE_KEY] === 'string'
          ? this.memory[this.WORKSPACE_STORAGE_KEY]
          : JSON.stringify(this.memory[this.WORKSPACE_STORAGE_KEY]);
      } catch(e) {}
    }
    return '';
  },

  compactStorage: function() {
    var prunedCount = 0;
    var reclaimedBytes = 0;
    try {
      if (typeof window !== 'undefined' && (window.HortOpsClientStorage || window).localStorage) {
        var staleKeys = [
          this.LEGACY_V1_KEY,
          'hort_ops_workspace',
          'hort_ops_custom_staff_v1',
          'hort_ops_custom_jobs_v1',
          'hort_ops_custom_assignments_v1',
          'hort_ops_jobs_offline',
          'hort_ops_staff_offline',
          'hort_ops_assignments_offline',
          'hort_ops_permits_offline',
          'hort_ops_budget_offline',
          '__hort_ops_persistence_probe__'
        ];

        if (typeof (window.HortOpsClientStorage || window).localStorage.key === 'function' && typeof (window.HortOpsClientStorage || window).localStorage.length === 'number') {
          for (var k = 0; k < (window.HortOpsClientStorage || window).localStorage.length; k++) {
            var storageKey = (window.HortOpsClientStorage || window).localStorage.key(k);
            if (storageKey && storageKey.indexOf('__hort_ops_probe') === 0 && staleKeys.indexOf(storageKey) === -1) {
              staleKeys.push(storageKey);
            }
          }
        }

        var deletionFailed = false;
        for (var i = 0; i < staleKeys.length; i++) {
          var key = staleKeys[i];
          var val = (window.HortOpsClientStorage || window).localStorage.getItem(key);
          if (val !== null) {
            try {
              (window.HortOpsClientStorage || window).localStorage.removeItem(key);
              reclaimedBytes += (key.length + val.length) * 2;
              prunedCount++;
            } catch(delErr) {
              deletionFailed = true;
              console.warn('Storage compaction deletion failure for ' + key + ':', delErr);
            }
          }
        }
      }
    } catch(e) {
      console.warn('Storage compaction warning:', e);
      deletionFailed = true;
    }
    return {
      success: !deletionFailed,
      prunedCount: prunedCount,
      reclaimedBytes: reclaimedBytes,
      health: this.getStorageHealth()
    };
  }
};
