(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {};
  var appConfig = UOS.ProgramAppConfig && typeof UOS.ProgramAppConfig.current === "function" ? UOS.ProgramAppConfig.current() : null;
  var databaseName = appConfig && appConfig.storageDatabase || "uos-horticulture-suite-v2";
  var storeName = "workspaces";
  var memory = new Map();
  var databasePromise = null;
  var unifiedApp = appConfig && appConfig.appId || "suite";
  var unifiedName = appConfig ? "workspace" : "unified-workspace";
  var updateQueue = Promise.resolve();
  var leaseChannel = typeof window.BroadcastChannel === "function" ? new window.BroadcastChannel(databaseName + ":workspace-leases") : null;

  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function key(app, name) { return app + ":" + name; }
  function leaseKey(app, name) { return "__edit-lease__:" + key(app, name); }
  function verifiedKey(app, name) { return "__last-verified__:" + key(app, name); }
  function now() { return Date.now(); }
  function publishLease(type, app, name, lease) {
    if (leaseChannel) leaseChannel.postMessage({ type: type, app: app, name: name, lease: clone(lease || null) });
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("IndexedDB is unavailable")); return; }
      var request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = function () {
        if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
      };
      request.onsuccess = function () {
        var database = request.result;
        database.onversionchange = function () { database.close(); databasePromise = null; };
        resolve(database);
      };
      request.onerror = function () { databasePromise = null; reject(request.error || new Error("Could not open browser storage")); };
      request.onblocked = function () { databasePromise = null; reject(new Error("Browser storage is blocked by another open tab.")); };
    });
    return databasePromise;
  }

  function transaction(mode, action) {
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, mode);
        var store = tx.objectStore(storeName);
        var request;
        var result;
        try { request = action(store); }
        catch (error) { tx.abort(); reject(error); return; }
        request.onsuccess = function () { result = request.result; };
        /* A successful request can still be rolled back before its transaction
           commits. Resolve only from oncomplete so callers never report a save
           that the browser subsequently aborted. */
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error || request.error || new Error("Browser storage transaction failed")); };
        tx.onabort = function () { reject(tx.error || request.error || new Error("Browser storage transaction was aborted")); };
      });
    });
  }

  function warn(error) {
    document.dispatchEvent(new CustomEvent("uos-storage-warning", { detail: error }));
  }

  function get(app, name) {
    var storageKey = key(app, name);
    return transaction("readonly", function (store) { return store.get(storageKey); }).then(clone).catch(function (error) { warn(error); return clone(memory.get(storageKey)); });
  }

  /* Canonical persistence verification must never fall back to process memory.
     Callers use getStrict() whenever absence/failure must remain distinguishable. */
  function getStrict(app, name) {
    var storageKey = key(app, name);
    return transaction("readonly", function (store) { return store.get(storageKey); }).then(clone);
  }

  function revisionConflict(expected, actual) {
    var error = new Error("Workspace changed before this mutation could be committed. Reload and retry.");
    error.name = "WorkspaceRevisionConflictError";
    error.expectedRevision = expected;
    error.actualRevision = actual;
    return error;
  }

  function revisionOf(workspace) {
    var value = workspace && workspace.workspaceRevision;
    return Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
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

  /* The base check, optional lease fence, canonical replacement, and pending
     verification marker are one IndexedDB transaction. A transaction abort
     therefore cannot expose a partially advanced canonical/recovery pair. */
  function commitRevision(app, name, value, baseRevision, supplied) {
    var storageKey = key(app, name);
    var recoveryKey = verifiedKey(app, name);
    var snapshot = clone(value);
    var expected = Number(baseRevision);
    if (!Number.isInteger(expected) || expected < 0) return Promise.reject(new TypeError("baseRevision must be a non-negative integer."));
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        var settled = false;
        function abort(error) {
          if (settled) return;
          settled = true;
          try { tx.abort(); } catch (_) {}
          reject(error);
        }
        function readCurrent() {
          var request = store.get(storageKey);
          request.onerror = function () { abort(request.error || new Error("Canonical workspace revision could not be read.")); };
          request.onsuccess = function () {
            var actual = revisionOf(request.result);
            if (actual !== expected) { abort(revisionConflict(expected, actual)); return; }
            var recoveryRequest = store.get(recoveryKey);
            recoveryRequest.onerror = function () { abort(recoveryRequest.error || new Error("Last-verified workspace could not be read.")); };
            recoveryRequest.onsuccess = function () {
              /* Preserve existing recovery authority during the candidate
                 commit. An existing canonical value seeds recovery only when
                 no earlier verified record exists; the candidate itself is
                 promoted only after strict read-back succeeds. */
              var prior = recoveryRequest.result || (request.result ? {
                revision: actual,
                committedAt: new Date().toISOString(),
                workspace: clone(request.result)
              } : { revision: null, committedAt: "", workspace: null });
              prior.pendingRevision = revisionOf(snapshot);
              prior.pendingAt = new Date().toISOString();
              store.put(prior, recoveryKey);
              store.put(snapshot, storageKey);
            };
          };
        }
        if (supplied) {
          var leaseRequest = store.get(leaseKey(app, name));
          leaseRequest.onerror = function () { abort(leaseRequest.error || new Error("Workspace edit lease could not be verified.")); };
          leaseRequest.onsuccess = function () {
            var current = leaseRequest.result;
            if (!current || current.holderId !== supplied.holderId || Number(current.epoch) !== Number(supplied.epoch) || Number(current.expiresAt) <= now()) {
              var error = new Error("This workspace is read-only because another tab owns the edit lease.");
              error.name = "WorkspaceReadOnlyError";
              abort(error);
              return;
            }
            readCurrent();
          };
        } else readCurrent();
        tx.oncomplete = function () {
          if (settled) return;
          settled = true;
          memory.set(storageKey, clone(snapshot));
          resolve(clone(snapshot));
        };
        tx.onerror = function () { abort(tx.error || new Error("Browser storage transaction failed")); };
        tx.onabort = function () {
          if (settled) return;
          settled = true;
          reject(tx.error || new Error("Browser storage transaction was aborted"));
        };
      });
    }).catch(function (error) { warn(error); throw error; });
  }

  function getLastVerified(app, name) {
    return transaction("readonly", function (store) { return store.get(verifiedKey(app, name)); }).then(clone);
  }

  function promoteVerified(app, name, value, supplied) {
    var storageKey = key(app, name);
    var snapshot = clone(value);
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        function verifyCanonical() {
          var request = store.get(storageKey);
          request.onerror = function () { reject(request.error || new Error("Canonical workspace could not be verified.")); };
          request.onsuccess = function () {
            if (!equivalent(request.result, snapshot)) {
              try { tx.abort(); } catch (_) {}
              return;
            }
            store.put({ revision: revisionOf(snapshot), committedAt: new Date().toISOString(), workspace: clone(snapshot) }, verifiedKey(app, name));
          };
        }
        if (supplied) {
          var leaseRequest = store.get(leaseKey(app, name));
          leaseRequest.onerror = function () { reject(leaseRequest.error || new Error("Workspace edit lease could not be verified.")); };
          leaseRequest.onsuccess = function () {
            var current = leaseRequest.result;
            if (!current || current.holderId !== supplied.holderId || Number(current.epoch) !== Number(supplied.epoch) || Number(current.expiresAt) <= now()) {
              try { tx.abort(); } catch (_) {}
              return;
            }
            verifyCanonical();
          };
        } else verifyCanonical();
        tx.oncomplete = function () { resolve(clone(snapshot)); };
        tx.onerror = function () { reject(tx.error || new Error("Verified revision promotion failed.")); };
        tx.onabort = function () { reject(tx.error || new Error("Canonical workspace changed before verified promotion.")); };
      });
    }).catch(function (error) { warn(error); throw error; });
  }

  function restoreVerified(app, name, value, expectedCurrentRevision, supplied) {
    var storageKey = key(app, name);
    var snapshot = clone(value);
    var expected = Number(expectedCurrentRevision);
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        function restore() {
          var request = store.get(storageKey);
          request.onerror = function () { reject(request.error || new Error("Unverified workspace could not be read for recovery.")); };
          request.onsuccess = function () {
            var actual = revisionOf(request.result);
            if (actual !== expected) {
              try { tx.abort(); } catch (_) {}
              return;
            }
            store.put(snapshot, storageKey);
          };
        }
        if (supplied) {
          var leaseRequest = store.get(leaseKey(app, name));
          leaseRequest.onerror = function () { reject(leaseRequest.error || new Error("Workspace edit lease could not be verified.")); };
          leaseRequest.onsuccess = function () {
            var current = leaseRequest.result;
            if (!current || current.holderId !== supplied.holderId || Number(current.epoch) !== Number(supplied.epoch) || Number(current.expiresAt) <= now()) {
              try { tx.abort(); } catch (_) {}
              return;
            }
            restore();
          };
        } else restore();
        tx.oncomplete = function () { memory.set(storageKey, clone(snapshot)); resolve(clone(snapshot)); };
        tx.onerror = function () { reject(tx.error || new Error("Workspace recovery failed.")); };
        tx.onabort = function () { reject(tx.error || new Error("Workspace changed before guarded recovery.")); };
      });
    }).catch(function (error) { warn(error); throw error; });
  }

  function removeRevisionState(app, name, supplied) {
    var storageKey = key(app, name);
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        function removeBoth() {
          store.delete(storageKey);
          store.delete(verifiedKey(app, name));
        }
        if (supplied) {
          var request = store.get(leaseKey(app, name));
          request.onerror = function () { reject(request.error || new Error("Workspace edit lease could not be verified.")); };
          request.onsuccess = function () {
            var current = request.result;
            if (!current || current.holderId !== supplied.holderId || Number(current.epoch) !== Number(supplied.epoch) || Number(current.expiresAt) <= now()) {
              try { tx.abort(); } catch (_) {}
              return;
            }
            removeBoth();
          };
        } else removeBoth();
        tx.oncomplete = function () { memory.delete(storageKey); resolve(); };
        tx.onerror = function () { reject(tx.error || new Error("Browser storage transaction failed")); };
        tx.onabort = function () {
          var error = tx.error || new Error("This workspace is read-only because another tab owns the edit lease.");
          error.name = error.name === "Error" ? "WorkspaceReadOnlyError" : error.name;
          reject(error);
        };
      });
    }).catch(function (error) { warn(error); throw error; });
  }

  /* Atomic, revision-fenced removal for a Workspace and its recovery state. */
  function removeWorkspaceState(app, name, expectedRevision, extraStorageKeys) {
    var storageKey = key(app, name);
    var expected = Number(expectedRevision);
    var extras = Array.isArray(extraStorageKeys) ? extraStorageKeys.slice() : [];
    if (!Number.isInteger(expected) || expected < 0) return Promise.reject(new TypeError("expectedRevision must be a non-negative integer."));
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var settled = false;
        var tx = database.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        function rejectAndAbort(error) {
          if (settled) return;
          settled = true;
          try { tx.abort(); } catch (_) {}
          reject(error);
        }
        var request = store.get(storageKey);
        request.onerror = function () { rejectAndAbort(request.error || new Error("Stored workspace could not be read for deletion.")); };
        request.onsuccess = function () {
          var actual = revisionOf(request.result);
          if (actual !== expected) { rejectAndAbort(revisionConflict(expected, actual)); return; }
          store.delete(storageKey);
          store.delete(verifiedKey(app, name));
          extras.forEach(function (extraKey) { if (typeof extraKey === "string" && extraKey) store.delete(extraKey); });
        };
        tx.oncomplete = function () {
          if (settled) return;
          settled = true;
          memory.delete(storageKey);
          resolve();
        };
        tx.onerror = function () { rejectAndAbort(tx.error || new Error("Browser storage transaction failed.")); };
        tx.onabort = function () {
          if (settled) return;
          settled = true;
          reject(tx.error || new Error("Workspace deletion was aborted."));
        };
      });
    }).catch(function (error) { warn(error); throw error; });
  }

  function set(app, name, value) {
    var storageKey = key(app, name);
    var snapshot = clone(value);
    return transaction("readwrite", function (store) { return store.put(snapshot, storageKey); }).then(function () { memory.set(storageKey, clone(snapshot)); }).catch(function (error) { warn(error); throw error; });
  }

  function remove(app, name) {
    var storageKey = key(app, name);
    return transaction("readwrite", function (store) { return store.delete(storageKey); }).then(function () {
      memory.delete(storageKey);
    }).catch(function (error) { warn(error); throw error; });
  }

  function leaseTransaction(app, name, operation) {
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        var request = store.get(leaseKey(app, name));
        var result;
        request.onerror = function () { reject(request.error || new Error("Workspace edit lease could not be read.")); };
        request.onsuccess = function () {
          try { result = operation(store, request.result || null); }
          catch (error) { try { tx.abort(); } catch (_) {} reject(error); }
        };
        tx.oncomplete = function () { resolve(clone(result)); };
        tx.onerror = function () { reject(tx.error || new Error("Workspace edit lease transaction failed.")); };
        tx.onabort = function () { reject(tx.error || new Error("Workspace edit lease transaction was aborted.")); };
      });
    });
  }

  function acquireLease(app, name, holderId, options) {
    options = options || {};
    var ttl = Math.max(5000, Number(options.ttlMs) || 30000);
    return leaseTransaction(app, name, function (store, current) {
      var stamp = now();
      if (current && current.holderId !== holderId && Number(current.expiresAt) > stamp && options.force !== true) {
        return { acquired: false, lease: current };
      }
      var lease = {
        holderId: String(holderId || ""),
        epoch: Math.max(0, Number(current && current.epoch) || 0) + (current && current.holderId === holderId && options.force !== true ? 0 : 1),
        acquiredAt: current && current.holderId === holderId && options.force !== true ? current.acquiredAt : stamp,
        expiresAt: stamp + ttl
      };
      store.put(lease, leaseKey(app, name));
      return { acquired: true, lease: lease };
    }).then(function (result) {
      if (result.acquired) publishLease(options.force === true ? "takeover" : "acquired", app, name, result.lease);
      return result;
    });
  }

  function renewLease(app, name, supplied, options) {
    options = options || {};
    var ttl = Math.max(5000, Number(options.ttlMs) || 30000);
    return leaseTransaction(app, name, function (store, current) {
      if (!current || !supplied || current.holderId !== supplied.holderId || Number(current.epoch) !== Number(supplied.epoch)) {
        throw new Error("Workspace edit lease is no longer owned by this tab.");
      }
      current.expiresAt = now() + ttl;
      store.put(current, leaseKey(app, name));
      return current;
    }).then(function (lease) { publishLease("renewed", app, name, lease); return lease; });
  }

  function takeOverLease(app, name, holderId, options) {
    options = Object.assign({}, options || {}, { force: true });
    return acquireLease(app, name, holderId, options);
  }

  function releaseLease(app, name, supplied) {
    return leaseTransaction(app, name, function (store, current) {
      if (!current || !supplied || current.holderId !== supplied.holderId || Number(current.epoch) !== Number(supplied.epoch)) return false;
      store.delete(leaseKey(app, name));
      return true;
    }).then(function (released) { if (released) publishLease("released", app, name, supplied); return released; });
  }

  function setWithLease(app, name, value, supplied) {
    var storageKey = key(app, name);
    var snapshot = clone(value);
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        var request = store.get(leaseKey(app, name));
        request.onerror = function () { reject(request.error || new Error("Workspace edit lease could not be verified.")); };
        request.onsuccess = function () {
          var current = request.result;
          if (!current || !supplied || current.holderId !== supplied.holderId || Number(current.epoch) !== Number(supplied.epoch) || Number(current.expiresAt) <= now()) {
            try { tx.abort(); } catch (_) {}
            reject(new Error("This workspace is read-only because another tab owns the edit lease."));
            return;
          }
          store.put(snapshot, storageKey);
        };
        tx.oncomplete = function () { memory.set(storageKey, clone(snapshot)); resolve(); };
        tx.onerror = function () { reject(tx.error || new Error("Browser storage transaction failed")); };
        tx.onabort = function () { reject(tx.error || new Error("Browser storage transaction was aborted")); };
      });
    }).catch(function (error) { warn(error); throw error; });
  }

  function removeWithLease(app, name, supplied) {
    var storageKey = key(app, name);
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        var request = store.get(leaseKey(app, name));
        request.onsuccess = function () {
          var current = request.result;
          if (!current || !supplied || current.holderId !== supplied.holderId || Number(current.epoch) !== Number(supplied.epoch) || Number(current.expiresAt) <= now()) {
            try { tx.abort(); } catch (_) {}
            reject(new Error("This workspace is read-only because another tab owns the edit lease."));
            return;
          }
          store.delete(storageKey);
        };
        request.onerror = function () { reject(request.error || new Error("Workspace edit lease could not be verified.")); };
        tx.oncomplete = function () { memory.delete(storageKey); resolve(); };
        tx.onerror = function () { reject(tx.error || new Error("Browser storage transaction failed")); };
        tx.onabort = function () { reject(tx.error || new Error("Browser storage transaction was aborted")); };
      });
    }).catch(function (error) { warn(error); throw error; });
  }

  function onLeaseMessage(listener) {
    if (!leaseChannel || typeof listener !== "function") return function () {};
    function receive(event) { listener(clone(event && event.data)); }
    leaseChannel.addEventListener("message", receive);
    return function () { leaseChannel.removeEventListener("message", receive); };
  }

  /* A configured application owns a separate database. The legacy fallback is
     retained only for the old unconfigured entrypoint and migration tooling. */
  function getUnified() { return get(unifiedApp, unifiedName); }
  function setUnified(value) {
    if (UOS.unifiedWorkspace) UOS.unifiedWorkspace.assertValid(value);
    return set(unifiedApp, unifiedName, value);
  }
  function removeUnified() { return remove(unifiedApp, unifiedName); }
  function updateUnified(updater) {
    if (typeof updater !== "function") return Promise.reject(new TypeError("Unified workspace updater must be a function."));
    updateQueue = updateQueue.catch(function () { /* a rejected update must not block later work */ }).then(function () {
      return getUnified().then(function (current) {
        var initial = current || (UOS.unifiedWorkspace ? UOS.unifiedWorkspace.blank() : undefined);
        return Promise.resolve(updater(initial)).then(function (next) {
          if (!next) throw new Error("Unified workspace updater must return a workspace.");
          return setUnified(next).then(function () { return next; });
        });
      });
    });
    return updateQueue;
  }

  UOS.storage = {
    get: get, getStrict: getStrict, set: set, remove: remove, setWithLease: setWithLease, removeWithLease: removeWithLease,
    commitRevision: commitRevision, getLastVerified: getLastVerified, promoteVerified: promoteVerified,
    restoreVerified: restoreVerified, removeRevisionState: removeRevisionState, removeWorkspaceState: removeWorkspaceState,
    acquireLease: acquireLease, renewLease: renewLease, takeOverLease: takeOverLease, releaseLease: releaseLease, onLeaseMessage: onLeaseMessage,
    databaseName: databaseName, storeName: storeName,
    unified: { get: getUnified, set: setUnified, remove: removeUnified, update: updateUnified, app: unifiedApp, name: unifiedName, key: key(unifiedApp, unifiedName) }
  };
})();
