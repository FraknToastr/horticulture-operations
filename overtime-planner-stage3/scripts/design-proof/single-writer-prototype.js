'use strict';
// Phase 4 experiment only. Not imported by the application or compiler.
(function (scope) {
  scope.createOvertimeWriterProof = function (options) {
    var state = 'read-only';
    var pending = false;
    var releaseHeld = null;
    var released = Promise.resolve();
    var snapshot = null;
    var generation = 0;
    var key = options.key;
    // A stable canonical storage key, never a filename, tab ID or revision.
    var name = 'hort-ops:workspace-writer:' + key;
    function status() { return { state: state, pending: pending, snapshot: snapshot, lockName: name }; }
    function acquire() {
      if (state === 'writer' || pending) return Promise.resolve(status());
      if (!options.locks || typeof options.locks.request !== 'function') return Promise.resolve(status());
      pending = true;
      var attempt = generation;
      var settled = false;
      return new Promise(function (ready) {
        function finish() { pending = false; settled = true; ready(status()); }
        try {
          released = options.locks.request(name, { mode: 'exclusive', ifAvailable: true }, function (lock) {
            if (attempt !== generation) { finish(); return; }
            if (!lock) { finish(); return; }
            // Acquire BEFORE reading any editable state. Initialization itself
            // may write in the real application and must stay within this lock.
            try { snapshot = options.read(); }
            catch (error) { state = 'read-only'; finish(); return; }
            return new Promise(function (done) {
              releaseHeld = done;
              state = 'writer';
              finish();
            });
          });
          released.catch(function () {
            state = 'read-only'; releaseHeld = null;
            if (!settled) finish();
          });
        } catch (error) { state = 'read-only'; finish(); }
      });
    }
    function commit(value) {
      if (state !== 'writer' || !releaseHeld) return { success: false, reason: 'read-only' };
      // Synchronous write used by this experiment. Application integration must
      // cover all lower-level mutators and existing validation/rollback paths.
      try { options.write(value); snapshot = value; return { success: true }; }
      catch (error) { return { success: false, reason: 'storage-failed' }; }
    }
    function release() {
      generation++;
      state = 'read-only';
      snapshot = null;
      if (releaseHeld) { var done = releaseHeld; releaseHeld = null; done(); }
      return released.catch(function () {});
    }
    return Object.freeze({ acquire: acquire, commit: commit, release: release, status: status });
  };
}(window));
