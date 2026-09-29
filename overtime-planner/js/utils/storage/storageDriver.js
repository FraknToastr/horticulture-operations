// Low-Level LocalStorage I/O Driver & Persistence Health Telemetry
// Manages LocalStorage read/write, in-memory fallback, active persistence probes, and capacity telemetry.
window.HortOpsStorageDriver = {
  WORKSPACE_STORAGE_KEY: 'hort_ops_workspace_v2',
  LEGACY_V1_KEY: 'hort_ops_workspace_v1',
  memory: {},

  get: function(key, defaultVal) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        var item = window.localStorage.getItem(key);
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
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(val));
      }
    } catch(e) {
      console.warn('LocalStorage set failed, using in-memory store:', e);
    }
  },

  remove: function(key) {
    delete this.memory[key];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch(e) {}
  },

  getStorageHealth: function() {
    var usedBytes = 0;
    var workspaceBytes = 0;
    var lastSaved = new Date().toISOString();
    var probeOk = false;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Active persistence probe (Mandate Section 12.1 & Review 37 R37-03)
        var probeKey = '__hort_ops_persistence_probe__';
        var probeSet = false;
        try {
          window.localStorage.setItem(probeKey, '1');
          probeSet = true;
          if (window.localStorage.getItem(probeKey) === '1') {
            probeOk = true;
          }
        } catch(probeErr) {
          probeOk = false;
        } finally {
          if (probeSet) {
            try {
              window.localStorage.removeItem(probeKey);
            } catch(cleanupErr) {
              probeOk = false;
            }
          }
        }

        for (var i = 0; i < window.localStorage.length; i++) {
          var key = window.localStorage.key(i);
          if (key) {
            var val = window.localStorage.getItem(key) || '';
            usedBytes += (key.length + val.length) * 2;
          }
        }
        var raw = window.localStorage.getItem(this.WORKSPACE_STORAGE_KEY);
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

  lastResetResult: null,

  getLastResetResult: function() {
    return this.lastResetResult;
  },

  resetWorkspace: function() {
    this.lastResetResult = null;
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

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Step 1: Preflight Inventory & Snapshot (Review 38 R38-01, Matrix A01)
        var snapshot = {};
        try {
          var storageLen = (typeof window.localStorage.length === 'number') ? window.localStorage.length : 0;
          for (var i = 0; i < storageLen; i++) {
            var k = window.localStorage.key(i);
            if (k && (k.indexOf('hort_ops_') === 0 || k.indexOf('__hort_ops_') === 0)) {
              snapshot[k] = window.localStorage.getItem(k);
            }
          }
          // Also guarantee known canonical keys are inspected if present
          for (var m = 0; m < keysToRemove.length; m++) {
            var rk = keysToRemove[m];
            if (!Object.prototype.hasOwnProperty.call(snapshot, rk)) {
              var val = window.localStorage.getItem(rk);
              if (val !== null) {
                snapshot[rk] = val;
              }
            }
          }
        } catch(preflightErr) {
          console.error('StorageDriver preflight read snapshot failed:', preflightErr);
          this.lastResetResult = {
            success: false,
            status: 'preflight_failed',
            rolledBack: true,
            failedKey: null,
            deletedCount: 0,
            restoredCount: 0,
            unrecoveredKeys: [],
            error: preflightErr.message || String(preflightErr)
          };
          return false;
        }

        var keysToDelete = Object.keys(snapshot);
        for (var n = 0; n < keysToRemove.length; n++) {
          if (keysToDelete.indexOf(keysToRemove[n]) === -1) {
            keysToDelete.push(keysToRemove[n]);
          }
        }

        // Step 2: Sequential Targeted Deletion (Matrix A02, A03, A04)
        var deletedKeys = [];
        var deletionFailed = false;
        var failedKey = null;
        var deletionError = null;

        for (var j = 0; j < keysToDelete.length; j++) {
          var targetKey = keysToDelete[j];
          try {
            window.localStorage.removeItem(targetKey);
            deletedKeys.push(targetKey);
          } catch(err) {
            deletionFailed = true;
            failedKey = targetKey;
            deletionError = err;
            console.error('StorageDriver removeItem failed for ' + targetKey + ':', err);
            break; // Halt deletions immediately on first failure
          }
        }

        // Post-deletion verification: verify all targeted keys are actually removed
        if (!deletionFailed) {
          for (var p = 0; p < keysToDelete.length; p++) {
            var checkKey = keysToDelete[p];
            try {
              if (window.localStorage.getItem(checkKey) !== null) {
                deletionFailed = true;
                failedKey = checkKey;
                deletionError = new Error('Postcondition check failed: key ' + checkKey + ' still present');
                break;
              }
            } catch(checkErr) {
              deletionFailed = true;
              failedKey = checkKey;
              deletionError = checkErr;
              break;
            }
          }
        }

        // Step 3: Compensating Rollback if any deletion failed (Matrix A03, A05)
        if (deletionFailed) {
          var rollbackFailed = false;
          var unrecoveredKeys = [];
          var restoredCount = 0;

          for (var r = 0; r < deletedKeys.length; r++) {
            var restoreKey = deletedKeys[r];
            if (Object.prototype.hasOwnProperty.call(snapshot, restoreKey) && snapshot[restoreKey] !== null) {
              try {
                window.localStorage.setItem(restoreKey, snapshot[restoreKey]);
                restoredCount++;
              } catch(rbErr) {
                rollbackFailed = true;
                unrecoveredKeys.push(restoreKey);
                console.error('StorageDriver compensating rollback setItem failed for ' + restoreKey + ':', rbErr);
              }
            }
          }

          // Verify rollback integrity
          if (!rollbackFailed) {
            for (var v = 0; v < deletedKeys.length; v++) {
              var vKey = deletedKeys[v];
              if (Object.prototype.hasOwnProperty.call(snapshot, vKey) && snapshot[vKey] !== null) {
                try {
                  if (window.localStorage.getItem(vKey) !== snapshot[vKey]) {
                    rollbackFailed = true;
                    if (unrecoveredKeys.indexOf(vKey) === -1) unrecoveredKeys.push(vKey);
                  }
                } catch(vErr) {
                  rollbackFailed = true;
                  if (unrecoveredKeys.indexOf(vKey) === -1) unrecoveredKeys.push(vKey);
                }
              }
            }
          }

          // Case A: Rollback Succeeded: all persistent keys safely restored (A03)
          if (!rollbackFailed) {
            this.lastResetResult = {
              success: false,
              status: 'rolled_back',
              rolledBack: true,
              failedKey: failedKey,
              deletedCount: deletedKeys.length,
              restoredCount: restoredCount,
              unrecoveredKeys: [],
              error: deletionError ? (deletionError.message || String(deletionError)) : 'Deletion failure with successful rollback'
            };
            return false;
          }

          // Case B: Rollback Failed: stage emergency recovery payload to sessionStorage (A05)
          try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
              window.sessionStorage.setItem('hort_ops_emergency_recovery_v2', JSON.stringify(snapshot));
            }
          } catch(sErr) {
            console.error('Failed to stage emergency backup to sessionStorage:', sErr);
          }

          this.lastResetResult = {
            success: false,
            status: 'partial_failure_unrecovered',
            rolledBack: false,
            failedKey: failedKey,
            deletedCount: deletedKeys.length,
            restoredCount: restoredCount,
            unrecoveredKeys: unrecoveredKeys,
            snapshot: snapshot,
            error: deletionError ? (deletionError.message || String(deletionError)) : 'Compensating rollback failed'
          };
          return false;
        }

        // Step 4: Full Success Path (Matrix A06)
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.removeItem('hort_ops_emergency_recovery_v2');
          }
        } catch(sErr) {}

        this.memory = {};
        this.lastResetResult = {
          success: true,
          status: 'success',
          rolledBack: false,
          failedKey: null,
          deletedCount: deletedKeys.length,
          restoredCount: 0,
          unrecoveredKeys: []
        };
        return true;
      }

      this.memory = {};
      this.lastResetResult = {
        success: true,
        status: 'success',
        rolledBack: false,
        failedKey: null,
        deletedCount: 0,
        restoredCount: 0,
        unrecoveredKeys: []
      };
      return true;
    } catch(e) {
      console.error('StorageDriver resetWorkspace unexpected exception:', e);
      this.lastResetResult = {
        success: false,
        status: 'unexpected_exception',
        rolledBack: false,
        failedKey: null,
        deletedCount: 0,
        restoredCount: 0,
        unrecoveredKeys: [],
        error: e.message || String(e)
      };
      return false;
    }
  },

  getRawQuarantinePayload: function() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        var raw = window.localStorage.getItem(this.WORKSPACE_STORAGE_KEY);
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
      if (typeof window !== 'undefined' && window.localStorage) {
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

        if (typeof window.localStorage.key === 'function' && typeof window.localStorage.length === 'number') {
          for (var k = 0; k < window.localStorage.length; k++) {
            var storageKey = window.localStorage.key(k);
            if (storageKey && storageKey.indexOf('__hort_ops_probe') === 0 && staleKeys.indexOf(storageKey) === -1) {
              staleKeys.push(storageKey);
            }
          }
        }

        var deletionFailed = false;
        for (var i = 0; i < staleKeys.length; i++) {
          var key = staleKeys[i];
          var val = window.localStorage.getItem(key);
          if (val !== null) {
            try {
              window.localStorage.removeItem(key);
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
