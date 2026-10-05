'use strict';

/*
 * Stage 2 Transaction-Model Closure Audit
 *
 * TEMPORARY READINESS AUDIT — not a permanent release-suite ID.
 * Implements authoritative verification of canonical rows TM-F01 through TM-F25
 * per 05_FAILURE_INJECTION_MATRIX.md and Stage2_Transaction_Model_Design_Gate_Review_04_PASS.md.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { repoRoot } = require('./local-test-environment.cjs');

const root = repoRoot();

function mockStorage(initial, options) {
  options = options || {};
  const data = Object.assign(Object.create(null), initial || {});
  let getCount = 0, setCount = 0, removeCount = 0, keyCount = 0;
  const obj = {
    getItem(k) {
      getCount++;
      if (options.failGet && options.failGet(k, getCount, { setCount, removeCount, keyCount })) {
        throw new Error('Injected getItem failure: ' + k);
      }
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
    },
    setItem(k, v) {
      setCount++;
      if (options.failSet && options.failSet(k, setCount, v, { getCount, removeCount, keyCount })) {
        throw new Error('Injected setItem failure: ' + k);
      }
      data[k] = String(v);
    },
    removeItem(k) {
      removeCount++;
      if (options.failRemove && options.failRemove(k, removeCount, { getCount, setCount, keyCount })) {
        throw new Error('Injected removeItem failure: ' + k);
      }
      delete data[k];
    },
    key(i) {
      keyCount++;
      const keys = Object.keys(data);
      const k = keys[i] !== undefined ? keys[i] : null;
      if (options.failKey && options.failKey(k, i, keyCount, { getCount, setCount, removeCount })) {
        throw new Error('Injected key() failure at index ' + i);
      }
      return k;
    },
    get length() {
      if (options.failLength && options.failLength({ getCount, setCount, removeCount, keyCount })) {
        throw new Error('Injected length failure');
      }
      return Object.keys(data).length;
    },
    snapshot() { return Object.assign({}, data); },
    counters() { return { getCount, setCount, removeCount, keyCount }; }
  };
  return obj;
}

function load(rel, ctx) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
}

function env(ls, ss) {
  const w = {
    localStorage: ls,
    sessionStorage: ss,
    console,
    Date, JSON, Object, Array, Math, String, Error
  };
  w.window = w;
  const ctx = vm.createContext(w);
  load('js/utils/storage/recoveryArtifact.js', ctx);
  load('js/utils/storage/storageDriver.js', ctx);
  return { ctx, driver: ctx.HortOpsStorageDriver || ctx.window.HortOpsStorageDriver };
}

function workspace(id) {
  return JSON.stringify({
    schemaVersion: 2,
    jobs: [{ id: id || 'current' }],
    shifts: [], employees: [], settings: {},
    customLocations: [], workforceAssignments: []
  });
}

function recovery(id, jobId) {
  return JSON.stringify({
    artifactType: 'hort_ops_reset_recovery',
    artifactVersion: 1,
    recoveryId: id,
    createdAt: '2026-10-01T00:00:00.000Z',
    reason: 'closure-audit',
    failedKey: null,
    error: null,
    unrecoveredKeys: [],
    storageSnapshot: { 'hort_ops_workspace_v2': workspace(jobId) }
  });
}

function localSeed() {
  return {
    'hort_ops_workspace_v2': workspace('current'),
    'hort_ops_jobs_offline': '["current"]',
    'hort_ops_staff_offline': '["staff"]',
    'unrelated-local': 'KEEP-LOCAL'
  };
}

function sessionSeed() {
  return {
    'hort_ops_emergency_recovery_v2:a': recovery('a', 'older-a'),
    'hort_ops_emergency_recovery_v2:b': recovery('b', 'older-b'),
    'unrelated-session': 'KEEP-SESSION'
  };
}

function governedLocal(snapshot) {
  const out = {};
  for (const [k,v] of Object.entries(snapshot)) {
    if (k.startsWith('hort_ops_') || k.startsWith('__hort_ops_')) out[k] = v;
  }
  return out;
}

function governedSession(snapshot) {
  const out = {};
  for (const [k,v] of Object.entries(snapshot)) {
    if (k.startsWith('hort_ops_emergency_recovery_v2')) out[k] = v;
  }
  return out;
}

function hasTransactionBundle(result) {
  if (!result) return false;
  const bundle = result.transactionRecoveryBundle || result.recoveryBundle;
  const json = result.transactionRecoveryBundleJson || result.recoveryBundleJson;
  if (bundle && typeof bundle === 'object') {
    return Boolean(bundle.currentWorkspaceRecoveryArtifact) &&
      Boolean(bundle.previousEmergencyRecoveryMetadata);
  }
  if (typeof json === 'string' && json) {
    try {
      const parsed = JSON.parse(json);
      return Boolean(parsed.currentWorkspaceRecoveryArtifact) &&
        Boolean(parsed.previousEmergencyRecoveryMetadata);
    } catch (_) {}
  }
  return false;
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// =========================================================================
// PREFLIGHT ROWS: TM-F01 & TM-F02 (+ SUPPLEMENTAL VARIANTS)
// =========================================================================

test('TM-F01: local preflight getItem throws aborts before mutation', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0, {
    failGet: k => k === 'hort_ops_workspace_v2'
  });
  const ss = mockStorage(s0);
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.rolledBack, false);
  assert.strictEqual(r.deletedCount, 0);
  assert.strictEqual(r.terminalState, 'PREFLIGHT_ABORT_READ');
});

test('TM-F01-key: local preflight key() throws aborts before mutation', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0, {
    failKey: (k, i) => i === 0
  });
  const ss = mockStorage(s0);
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.rolledBack, false);
  assert.strictEqual(r.terminalState, 'PREFLIGHT_ABORT_READ');
});

test('TM-F01-length: local preflight length throws aborts before mutation', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0, {
    failLength: () => true
  });
  const ss = mockStorage(s0);
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.rolledBack, false);
  assert.strictEqual(r.terminalState, 'PREFLIGHT_ABORT_READ');
});

test('TM-F02: session recovery preflight read failure aborts before any destructive mutation', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0);
  const ss = mockStorage(s0, {
    failGet: k => String(k).startsWith('hort_ops_emergency_recovery_v2')
  });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
  const r = e.driver.getLastResetResult();
  assert.ok(r && r.success === false);
  assert.strictEqual(r.deletedCount || 0, 0);
  assert.strictEqual(r.terminalState, 'PREFLIGHT_ABORT_READ');
});

test('TM-F02-key: session preflight key() throws aborts before mutation', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0);
  const ss = mockStorage(s0, {
    failKey: (k, i) => i === 0
  });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.terminalState, 'PREFLIGHT_ABORT_READ');
});

test('TM-F02-length: session preflight length throws aborts before mutation', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0);
  const ss = mockStorage(s0, {
    failLength: () => true
  });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.terminalState, 'PREFLIGHT_ABORT_READ');
});

// =========================================================================
// LOCAL DELETION ROWS: TM-F03, TM-F04, TM-F05
// =========================================================================

test('TM-F03: first local deletion failure compensates and restores both stores', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0, { failRemove: (k, n) => n === 1 });
  const ss = mockStorage(s0);
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, true);
  assert.strictEqual(r.terminalState, 'ROLLED_BACK_INTACT');
});

test('TM-F04: middle local deletion failure restores local state and leaves emergency session metadata unchanged', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0, { failRemove: (k, n) => n === 2 });
  const ss = mockStorage(s0);
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, true);
  assert.strictEqual(r.terminalState, 'ROLLED_BACK_INTACT');
});

test('TM-F05: final local deletion failure compensates and restores both stores', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const keyCount = Object.keys(l0).filter(k => k.startsWith('hort_ops_')).length;
  const ls = mockStorage(l0, { failRemove: (k, n) => n === keyCount });
  const ss = mockStorage(s0);
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, true);
  assert.strictEqual(r.terminalState, 'ROLLED_BACK_INTACT');
});

// =========================================================================
// LOCAL CLEAR VERIFICATION ROWS: TM-F06, TM-F07
// =========================================================================

test('TM-F06: local clear verification read throws triggers compensating rollback', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  let deletedCount = 0;
  const ls = mockStorage(l0, {
    failRemove: () => { deletedCount++; return false; },
    failGet: (k, n, st) => st.removeCount > 0 && st.setCount === 0 // Throws during clear check before rollback begins
  });
  const ss = mockStorage(s0);
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, true);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
});

test('TM-F07: local clear verify residual key detected triggers compensating rollback', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  // Simulate mock where removeItem quietly fails on one key without throwing
  const ls = mockStorage(l0);
  const originalRemove = ls.removeItem;
  ls.removeItem = function(k) {
    if (k === 'hort_ops_staff_offline') return; // Silent failure -> residual key remains
    originalRemove.call(ls, k);
  };
  const ss = mockStorage(s0);
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, true);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
});

// =========================================================================
// SESSION CLEANUP ROWS: TM-F08, TM-F09, TM-F10
// =========================================================================

test('TM-F08: first session cleanup removal throws restores BOTH storage domains', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0);
  const ss = mockStorage(s0, {
    failRemove: (k, n) => n === 1
  });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, true);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
});

test('TM-F09: partial emergency cleanup failure restores BOTH storage domains byte-for-byte', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0);
  const ss = mockStorage(s0, {
    failRemove: (k, n) => String(k).startsWith('hort_ops_emergency_recovery_v2') && n === 2
  });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, true);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
});

test('TM-F10: final session recovery removal throws restores BOTH storage domains', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0);
  const sessionRecoveryCount = Object.keys(s0).filter(k => k.startsWith('hort_ops_emergency_recovery_v2')).length;
  const ss = mockStorage(s0, {
    failRemove: (k, n) => n === sessionRecoveryCount
  });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, true);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
});

// =========================================================================
// SESSION VERIFY ROWS: TM-F11 (+ VARIANTS), TM-F12
// =========================================================================

test('TM-F11: session cleanup verification exception after mutation restores BOTH storage domains', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0);
  const ss = mockStorage(s0, {
    failKey: (k, i, keyCount, state) => state.removeCount > 0 && state.setCount === 0
  });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, true);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
});

test('TM-F11-key: session verification key() throws restores both stores', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0);
  const ss = mockStorage(s0, {
    failKey: (k, i, keyCount, state) => state.removeCount >= 2 && state.setCount === 0
  });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, true);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
});

test('TM-F11-length: session verification length throws restores both stores', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0);
  const ss = mockStorage(s0, {
    failLength: (state) => state.removeCount >= 2 && state.setCount === 0
  });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, true);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
});

test('TM-F12: session cleanup verify detects residual recovery key and restores both stores', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0);
  const ss = mockStorage(s0);
  const origSsRemove = ss.removeItem;
  ss.removeItem = function(k) {
    if (k === 'hort_ops_emergency_recovery_v2:b') return; // Silent failure -> residual remains
    origSsRemove.call(ss, k);
  };
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, true);
  assert.deepStrictEqual(ls.snapshot(), l0);
  assert.deepStrictEqual(ss.snapshot(), s0);
});

// =========================================================================
// ROLLBACK WRITE & VERIFY ROWS: TM-F13, TM-F14, TM-F15, TM-F16
// =========================================================================

test('TM-F13: local rollback restore write throws enters emergency isolation with complete bundle', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0, {
    failRemove: (k, n) => n === 2,
    failSet: () => true
  });
  const ss = mockStorage(s0);
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, false);
  assert.strictEqual(r.terminalState, 'EMERGENCY_ISOLATION');
  assert.ok(hasTransactionBundle(r));
});

test('TM-F14: local rollback verify read failure enters emergency isolation with complete bundle', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  let failLocalVerify = false;
  const ls = mockStorage(l0, {
    failRemove: (k, n) => {
      if (n === 2) { failLocalVerify = true; return true; }
      return false;
    },
    failGet: (k, n, st) => failLocalVerify && st.setCount > 0 // Throws during rollback verification read
  });
  const ss = mockStorage(s0);
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, false);
  assert.strictEqual(r.terminalState, 'EMERGENCY_ISOLATION');
  assert.ok(hasTransactionBundle(r));
});

test('TM-F15: session metadata rollback write failure cannot claim rolledBack and retains complete recovery bundle', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0);
  let cleanupStarted = false;
  const ss = mockStorage(s0, {
    failRemove: (k, n) => {
      if (String(k).startsWith('hort_ops_emergency_recovery_v2')) cleanupStarted = true;
      return cleanupStarted && n === 2;
    },
    failSet: k => cleanupStarted && String(k).startsWith('hort_ops_emergency_recovery_v2')
  });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, false);
  assert.strictEqual(r.terminalState, 'EMERGENCY_ISOLATION');
  assert.ok(hasTransactionBundle(r),
    'rollback-incomplete result must retain current workspace artifact + previous recovery metadata in memory');
});

test('TM-F16: session rollback verify read mismatch/exception enters emergency isolation with complete bundle', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0);
  let cleanupStarted = false;
  const ss = mockStorage(s0, {
    failRemove: (k, n) => {
      if (String(k).startsWith('hort_ops_emergency_recovery_v2')) cleanupStarted = true;
      return cleanupStarted && n === 2;
    },
    failGet: (k, n, st) => cleanupStarted && st.setCount > 0
  });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, false);
  assert.strictEqual(r.terminalState, 'EMERGENCY_ISOLATION');
  assert.ok(hasTransactionBundle(r));
});

// =========================================================================
// ISOLATION & PERSISTENCE ROWS: TM-F17, TM-F18, TM-F19, TM-F20
// =========================================================================

test('TM-F17: recovery bundle staging setItem throws retains memory-only bundle', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0, {
    failRemove: (k, n) => n === 2,
    failSet: () => true
  });
  const ss = mockStorage(s0, {
    failSet: k => String(k).indexOf('hort_ops_') === 0
  });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, false);
  assert.strictEqual(r.terminalState, 'EMERGENCY_ISOLATION');
  assert.strictEqual(r.recoveryPersistence, 'memory_only');
  assert.ok(hasTransactionBundle(r));
});

test('TM-F18: total persistence failure still retains a directly exportable in-memory transaction recovery bundle', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0, {
    failRemove: (k, n) => n === 2,
    failSet: () => true
  });
  const ss = mockStorage(s0, { failSet: () => true });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.rolledBack, false);
  assert.ok(r.recoveryArtifactJson || r.recoveryArtifact,
    'current workspace recovery artifact must remain in memory');
  assert.ok(hasTransactionBundle(r),
    'complete transaction recovery bundle must remain in memory despite persistence failure');
});

test('TM-F19: successful reset commits both governed domains and preserves unrelated origin/session data', () => {
  const ls = mockStorage(localSeed());
  const ss = mockStorage(sessionSeed());
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, true);
  assert.deepStrictEqual(governedLocal(ls.snapshot()), {});
  assert.deepStrictEqual(governedSession(ss.snapshot()), {});
  assert.strictEqual(ls.snapshot()['unrelated-local'], 'KEEP-LOCAL');
  assert.strictEqual(ss.snapshot()['unrelated-session'], 'KEEP-SESSION');
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.terminalState, 'COMMITTED_CLEAN_SLATE');
});

test('TM-F20: retry attempted during unresolved isolation is rejected before mutation or telemetry wipe', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0, {
    failRemove: (k, n) => n === 2,
    failSet: () => true
  });
  const ss = mockStorage(s0, { failSet: () => true });
  const e = env(ls, ss);
  
  // First attempt fails into EMERGENCY_ISOLATION
  assert.strictEqual(e.driver.resetWorkspace(), false);
  const firstResult = e.driver.getLastResetResult();
  assert.strictEqual(firstResult.terminalState, 'EMERGENCY_ISOLATION');
  assert.strictEqual(firstResult.recoveryPersistence, 'memory_only');
  const firstBundle = firstResult.recoveryBundle;
  assert.ok(firstBundle, 'memory-only bundle must exist');

  // Attempt second reset while unresolved isolation active
  const secondOk = e.driver.resetWorkspace();
  assert.strictEqual(secondOk, false, 'second reset must be rejected');
  const afterResult = e.driver.getLastResetResult();
  // Existing memory-only bundle must not be destroyed or wiped
  assert.strictEqual(afterResult.recoveryBundle, firstBundle, 'memory bundle must remain intact on rejected retry');
  assert.strictEqual(afterResult.recoveryPersistence, 'memory_only');
});

// =========================================================================
// TRANSACTION B (RESTORE) ROWS: TM-F21, TM-F22, TM-F23, TM-F24, TM-F25
// =========================================================================

test('TM-F21: emergency restore write failure compensates and restores pre-restore state', () => {
  const initialLocal = {
    'hort_ops_workspace_v2': workspace('current-w2'),
    'unrelated-key': 'KEEP'
  };
  const targetRecoveryRaw = recovery('restore-target', 'restored-job');
  const ss = mockStorage({
    'hort_ops_emergency_recovery_v2:target': targetRecoveryRaw
  });
  let writeCalls = 0;
  const ls = mockStorage(initialLocal, {
    failSet: (k, n) => {
      writeCalls++;
      // Fail only the forward restore write (call #1); allow compensating rollback setItem to succeed
      return writeCalls === 1;
    }
  });
  const e = env(ls, ss);

  const res = e.driver.restoreEmergencyRecoveryArtifact(targetRecoveryRaw);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.terminalState, 'ROLLBACK_CURRENT_VERIFIED');
  assert.deepStrictEqual(ls.snapshot(), initialLocal, 'pre-restore state must be restored byte-for-byte');
});

test('TM-F22: emergency restore verification exception compensates to pre-restore state', () => {
  const initialLocal = {
    'hort_ops_workspace_v2': workspace('current-w2')
  };
  const targetRecoveryRaw = recovery('verify-fail', 'restored-job');
  const ss = mockStorage({
    'hort_ops_emergency_recovery_v2:target': targetRecoveryRaw
  });
  let writeOccurred = false;
  const ls = mockStorage(initialLocal, {
    failSet: () => { writeOccurred = true; return false; },
    failGet: (k, n, st) => writeOccurred && st.setCount === 1 // Fails post-write verify read
  });
  const e = env(ls, ss);

  const res = e.driver.restoreEmergencyRecoveryArtifact(targetRecoveryRaw);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.terminalState, 'ROLLBACK_CURRENT_VERIFIED');
  assert.deepStrictEqual(ls.snapshot(), initialLocal, 'pre-restore state must be compensated');
});

test('TM-F23: targeted retirement failure keeps artifact unresolved and blocks autosave', () => {
  const initialLocal = {
    'hort_ops_workspace_v2': workspace('current-w2')
  };
  const targetRecoveryRaw = recovery('retire-fail', 'restored-job');
  const targetKey = 'hort_ops_emergency_recovery_v2:retire-fail';
  const otherKey = 'hort_ops_emergency_recovery_v2:other';
  const otherRecoveryRaw = recovery('other', 'other-job');

  const ss = mockStorage({
    [targetKey]: targetRecoveryRaw,
    [otherKey]: otherRecoveryRaw
  }, {
    failRemove: k => k === targetKey
  });
  const ls = mockStorage(initialLocal);
  const e = env(ls, ss);

  const res = e.driver.restoreEmergencyRecoveryArtifact(targetRecoveryRaw);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.terminalState, 'RESTORE_METADATA_UNRESOLVED');
  assert.strictEqual(res.retirementOutcome.targetRetired, false);
  // Target artifact remains in session storage because remove failed
  assert.strictEqual(ss.getItem(targetKey), targetRecoveryRaw);
  // Other artifact is preserved
  assert.strictEqual(ss.getItem(otherKey), otherRecoveryRaw);
});

test('TM-F24: cold reload reconciler detects unresolved recovery evidence', () => {
  const l0 = localSeed(), s0 = sessionSeed();
  const ls = mockStorage(l0);
  const ss = mockStorage(s0);
  const e = env(ls, ss);
  // Preflight inspects session storage and correctly identifies all existing recovery metadata
  const preflight = e.driver._captureStoragePreflight([]);
  assert.strictEqual(preflight.success, true);
  assert.ok(Object.keys(preflight.sessionSnapshot).length >= 2, 'cold inspection discovers all unresolved artifacts');
});

test('TM-F25: restore deep-failure (write fails AND rollback write fails) builds exportable restore transaction bundle', () => {
  const initialLocal = {
    'hort_ops_workspace_v2': workspace('pre-restore-work')
  };
  const targetRecoveryRaw = recovery('deep-fail', 'target-job');
  const targetKey = 'hort_ops_emergency_recovery_v2:deep-fail';
  const ss = mockStorage({ [targetKey]: targetRecoveryRaw });
  const ls = mockStorage(initialLocal, {
    failSet: () => true // Both forward restore write AND rollback write fail!
  });
  const e = env(ls, ss);

  const res = e.driver.restoreEmergencyRecoveryArtifact(targetRecoveryRaw);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.terminalState, 'RESTORE_DEEP_FAILURE');
  assert.ok(res.restoreRecoveryBundle, 'must generate exportable restore recovery bundle');
  assert.strictEqual(res.restoreRecoveryBundle.bundleType, 'hort_ops_restore_transaction_recovery');
  assert.ok(res.restoreRecoveryBundle.preRestoreWorkspaceSnapshot['hort_ops_workspace_v2']);
  assert.strictEqual(res.restoreRecoveryBundle.targetRecoveryArtifact.recoveryId, 'deep-fail');
});

// =========================================================================
// TARGETED RETIREMENT & PARENT BUNDLE GOVERNED LIFECYCLE TESTS (Review 04 Section 4)
// =========================================================================

test('Targeted Retirement: removes unique key, removes matching legacy alias, preserves other artifacts', () => {
  const targetRaw = recovery('target-1', 'job-1');
  const otherRaw = recovery('other-2', 'job-2');
  const parentRaw = JSON.stringify({
    bundleType: 'hort_ops_reset_transaction_recovery',
    transactionId: 'parent-tx',
    currentWorkspaceRecoveryArtifact: JSON.parse(targetRaw),
    previousEmergencyRecoveryMetadata: {}
  });

  const ss = mockStorage({
    'hort_ops_emergency_recovery_v2:target-1': targetRaw,
    'hort_ops_emergency_recovery_v2': targetRaw, // byte-identical legacy alias
    'hort_ops_emergency_recovery_v2:other-2': otherRaw,
    'hort_ops_emergency_recovery_v2:transaction:parent-tx': parentRaw
  });
  const ls = mockStorage({ 'hort_ops_workspace_v2': workspace('pre') });
  const e = env(ls, ss);

  const res = e.driver.restoreEmergencyRecoveryArtifact(targetRaw);
  assert.strictEqual(res.success, true);
  // Terminal state reflects that other evidence remains (Review 04 Section 4.3)
  assert.strictEqual(res.terminalState, 'RESTORE_SUCCESS_EVIDENCE_REMAINS');
  
  // Unique target key removed
  assert.strictEqual(ss.getItem('hort_ops_emergency_recovery_v2:target-1'), null);
  // Matching legacy alias removed
  assert.strictEqual(ss.getItem('hort_ops_emergency_recovery_v2'), null);
  // Other artifact strictly preserved
  assert.strictEqual(ss.getItem('hort_ops_emergency_recovery_v2:other-2'), otherRaw);
  // Parent bundle strictly preserved
  assert.strictEqual(ss.getItem('hort_ops_emergency_recovery_v2:transaction:parent-tx'), parentRaw);

  // When sole artifact is restored, terminal state transitions to RESTORE_COMMITTED_CLEAN
  const ssSole = mockStorage({
    'hort_ops_emergency_recovery_v2:target-1': targetRaw,
    'hort_ops_emergency_recovery_v2': targetRaw
  });
  const lsSole = mockStorage({ 'hort_ops_workspace_v2': workspace('pre') });
  const eSole = env(lsSole, ssSole);
  const resSole = eSole.driver.restoreEmergencyRecoveryArtifact(targetRaw);
  assert.strictEqual(resSole.success, true);
  assert.strictEqual(resSole.terminalState, 'RESTORE_SUCCESS_CLEAN');
  assert.strictEqual(ssSole.getItem('hort_ops_emergency_recovery_v2:sole'), null);
  assert.strictEqual(ssSole.getItem('hort_ops_emergency_recovery_v2'), null);
});

test('Governed Parent Lifecycle: inner artifact extracted; parent bundle remains until explicit retirement', () => {
  const targetRaw = recovery('inner-1', 'job-inner');
  const parentRaw = JSON.stringify({
    bundleType: 'hort_ops_reset_transaction_recovery',
    transactionId: 'parent-governed',
    currentWorkspaceRecoveryArtifact: JSON.parse(targetRaw),
    previousEmergencyRecoveryMetadata: {}
  });

  const ss = mockStorage({
    'hort_ops_emergency_recovery_v2:transaction:parent-governed': parentRaw
  });
  const ls = mockStorage({ 'hort_ops_workspace_v2': workspace('pre') });
  const e = env(ls, ss);

  // Extract inner artifact
  const extracted = e.driver.extractWorkspaceArtifactFromBundle(parentRaw);
  assert.ok(extracted, 'must extract inner workspace artifact');
  assert.strictEqual(extracted.recoveryId, 'inner-1');

  // Restore inner artifact
  const res = e.driver.restoreEmergencyRecoveryArtifact(extracted.artifactJson, { parentTransactionId: extracted.parentTransactionId });
  assert.strictEqual(res.success, true);
  // Parent bundle MUST NOT be automatically deleted (Review 04 Section 4.3)
  assert.strictEqual(ss.getItem('hort_ops_emergency_recovery_v2:transaction:parent-governed'), parentRaw);

  // Explicit operator acknowledgement of parent recovery evidence (Review 50 R50-D / R50-P04)
  const ack = e.driver.acknowledgeParentPriorEvidence('parent-governed', { operatorConfirmed: true });
  assert.strictEqual(ack.success, true);

  // Explicit operator retirement retires parent bundle
  const retired = e.driver.retireCompositeParentBundle('parent-governed');
  assert.strictEqual(retired.success, true);
  assert.strictEqual(ss.getItem('hort_ops_emergency_recovery_v2:transaction:parent-governed'), null);
});

// =========================================================================
// REVIEW 44 ADVERSARIAL TRANSACTION PROBES (R44-P01 TO R44-P08)
// =========================================================================

test('R44-P01: full composite MUST be durable before claiming persisted', () => {
  const a = recovery('old_a', 'old_a');
  const b = recovery('old_b', 'old_b');
  const keyA = 'hort_ops_emergency_recovery_v2:a';
  const keyB = 'hort_ops_emergency_recovery_v2:b';
  const base = {
    'hort_ops_workspace_v2': workspace('current'),
    'hort_ops_jobs_offline': '[]',
    'outside': 'KEEP'
  };
  const ls = mockStorage(base);
  const ss = mockStorage({ [keyA]: a, [keyB]: b }, {
    failRemove: (k, n) => n === 2,
    failSet: (k, n) => k === keyA || String(k).startsWith('hort_ops_emergency_recovery_v2:transaction:')
  });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false);
  const r = e.driver.getLastResetResult();
  assert.strictEqual(r.terminalState, 'EMERGENCY_ISOLATION');
  const snap = ss.snapshot();
  const persistedComposite = Object.entries(snap).some(([k, v]) =>
    k.startsWith('hort_ops_emergency_recovery_v2:transaction:') && (() => {
      try {
        let x = JSON.parse(v);
        return x.previousEmergencyRecoveryMetadata && x.previousEmergencyRecoveryMetadata[keyA] === a;
      } catch (e) { return false; }
    })()
  );
  assert.ok(r.recoveryPersistence !== 'persisted' || persistedComposite,
    `claimed ${r.recoveryPersistence} despite missing durable composite and deleted preflight artifact A`);
});

test('R44-P02: alias with different raw evidence MUST remain untouched', () => {
  const a = JSON.parse(recovery('AAA', 'job-AAA'));
  const b = JSON.parse(recovery('BBB', 'job-BBB'));
  b.reason = 'old note references AAA';
  const alias = JSON.stringify(b);
  const base = { 'hort_ops_workspace_v2': workspace('current'), 'outside': 'KEEP' };
  const ls = mockStorage(base);
  const ss = mockStorage({
    'hort_ops_emergency_recovery_v2:AAA': JSON.stringify(a),
    'hort_ops_emergency_recovery_v2': alias
  });
  const e = env(ls, ss);
  const r = e.driver.restoreEmergencyRecoveryArtifact(a);
  assert.strictEqual(ss.getItem('hort_ops_emergency_recovery_v2'), alias,
    `raw different alias destroyed, result ${r.status}`);
});

test('R44-P03: persisted emergency bundle MUST block reset after cold reload', () => {
  const b = JSON.stringify({
    artifactType: 'hort_ops_reset_transaction_recovery',
    artifactVersion: 1,
    transactionId: 'old-tx',
    currentWorkspaceRecoveryArtifact: JSON.parse(recovery('old', 'old')),
    previousEmergencyRecoveryMetadata: { 'hort_ops_emergency_recovery_v2:A': 'critical original' }
  });
  const k = 'hort_ops_emergency_recovery_v2:transaction:old-tx';
  const base = { 'hort_ops_workspace_v2': workspace('current'), 'outside': 'KEEP' };
  const ls = mockStorage(base);
  const ss = mockStorage({ [k]: b });
  const e = env(ls, ss);
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false, 'destructive reset succeeded while unresolved composite exists');
  assert.strictEqual(ss.getItem(k), b, 'persisted bundle removed');
});

test('R44-P04: direct composite restore MUST retain parent resolution linkage', () => {
  const a = JSON.parse(recovery('R1', 'job-R1'));
  const parent = {
    artifactType: 'hort_ops_reset_transaction_recovery',
    artifactVersion: 1,
    transactionId: 'parent-1',
    currentWorkspaceRecoveryArtifact: a,
    previousEmergencyRecoveryMetadata: { 'hort_ops_emergency_recovery_v2:old': 'old' }
  };
  const pk = 'hort_ops_emergency_recovery_v2:transaction:parent-1';
  const base = { 'hort_ops_workspace_v2': workspace('current'), 'outside': 'KEEP' };
  const ls = mockStorage(base);
  const ss = mockStorage({ [pk]: JSON.stringify(parent) });
  const e = env(ls, ss);
  const r = e.driver.restoreEmergencyRecoveryArtifact(parent);
  assert.ok(r.success, 'restore preflight failed: ' + r.error);
  assert.ok(e.driver.resolvedBundles['parent-1'] && e.driver.resolvedBundles['parent-1'].workspaceRecovered,
    'parent bundle resolution registry not updated');
});

test('R44-P05: rollback session enumeration fault MUST NOT produce verified rollback', () => {
  const k = 'hort_ops_emergency_recovery_v2:a';
  const sp = 'hort_ops_emergency_recovery_v2:unexpected';
  const base = { 'hort_ops_workspace_v2': workspace('current'), 'outside': 'KEEP' };
  const ls = mockStorage(base);
  const ss = mockStorage({ [k]: recovery('old', 'old'), [sp]: 'spurious' }, {
    failKey: () => true
  });
  const e = env(ls, ss);
  const out = e.driver._restoreEmergencyRecoveryMetadata({ [k]: recovery('old', 'old') });
  assert.strictEqual(out.success, false, 'claimed success after silently swallowing enumeration fault with spurious extra key');
});

test('R44-P06: cannot retire unacknowledged parent before workspace recovery', () => {
  const pk = 'hort_ops_emergency_recovery_v2:transaction:unresolved';
  const original = JSON.stringify({
    artifactType: 'hort_ops_reset_transaction_recovery',
    previousEmergencyRecoveryMetadata: { 'hort_ops_emergency_recovery_v2:a': 'ORIGINAL' }
  });
  const base = { 'hort_ops_workspace_v2': workspace('current'), 'outside': 'KEEP' };
  const ls = mockStorage(base);
  const ss = mockStorage({ [pk]: original });
  const e = env(ls, ss);
  const r = e.driver.retireCompositeParentBundle('unresolved');
  assert.strictEqual(r.success, false, 'unguarded retirement succeeded with prior evidence unacknowledged');
  assert.strictEqual(ss.getItem(pk), original, 'unguarded retirement destroyed only copy of older evidence');
});

test('R44-P07: restore deep-failure MUST prevent subsequent destructive reset', () => {
  let sets = 0;
  const target = JSON.parse(recovery('deep-target', 'job-deep'));
  const tk = 'hort_ops_emergency_recovery_v2:deep-target';
  const base = { 'hort_ops_workspace_v2': workspace('current'), 'outside': 'KEEP' };
  const ls = mockStorage(base, {
    failSet: () => ++sets <= 2 // forward write fails (#1) and rollback write fails (#2)
  });
  const ss = mockStorage({ [tk]: JSON.stringify(target) });
  const e = env(ls, ss);
  const r = e.driver.restoreEmergencyRecoveryArtifact(target);
  assert.strictEqual(r.terminalState, 'RESTORE_DEEP_FAILURE', 'failed to produce precondition deep-failure');
  const key = ss.snapshot();
  const ok = e.driver.resetWorkspace();
  assert.strictEqual(ok, false, 'reset committed over unresolved restore deep failure');
  assert.strictEqual(ss.getItem(tk), key[tk], 'original target evidence lost');
});

test('R44-P08: RESTORE_DEEP_FAILURE memory-only bundle MUST be exposed via UI export', () => {
  const mockWindow = {
    console: { warn() {}, error() {} },
    HortOpsStorageDriver: {
      getLastResetResult() { return null; },
      getLastRestoreResult() {
        return {
          terminalState: 'RESTORE_DEEP_FAILURE',
          recoveryBundleJson: '{"artifactType":"hort_ops_restore_transaction_recovery","test":8}'
        };
      }
    },
    HortOpsApp: { state: {} },
    sessionStorage: mockStorage({}),
    Blob: function(parts) { mockWindow.blobPayload = parts.join(''); },
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    document: {
      body: { appendChild() {}, removeChild() {} },
      createElement() { return { click() {} }; }
    },
    alert: x => { mockWindow.alertText = x; },
    setTimeout: f => {}
  };
  mockWindow.window = mockWindow;
  const context = vm.createContext(mockWindow);
  load('js/components/resetWorkspaceModal.js', context);
  mockWindow.HortOpsResetWorkspaceModal.exportEmergencyBackup();
  assert.ok(mockWindow.blobPayload && mockWindow.blobPayload.indexOf('hort_ops_restore_transaction_recovery') !== -1,
    'restore-only memory bundle not exported; ' + (mockWindow.alertText || 'no file'));
});

test('R45-P01: legacy alias sharing recoveryId and createdAt but different workspace MUST survive', () => {
  const a = JSON.parse(recovery('SAME', 'same-job'));
  const b = JSON.parse(recovery('SAME', 'same-job'));
  b.storageSnapshot.hort_ops_workspace_v2 = 'OLDER DIFFERENT WORKSPACE';
  const alias = JSON.stringify(b);
  const base = { 'hort_ops_workspace_v2': workspace('current'), 'outside': 'KEEP' };
  const ls = mockStorage(base);
  const ss = mockStorage({
    'hort_ops_emergency_recovery_v2:SAME': JSON.stringify(a),
    'hort_ops_emergency_recovery_v2': alias
  });
  const e = env(ls, ss);
  e.driver.restoreEmergencyRecoveryArtifact(a);
  assert.strictEqual(ss.getItem('hort_ops_emergency_recovery_v2'), alias, 'non-identical alias removed');
});

test('R45-P02: opts.force MUST NOT retire parent containing unacknowledged prior evidence', () => {
  const key = 'hort_ops_emergency_recovery_v2:transaction:UNRESOLVED';
  const raw = JSON.stringify({
    artifactType: 'hort_ops_reset_transaction_recovery',
    artifactVersion: 1,
    transactionId: 'UNRESOLVED',
    currentWorkspaceRecoveryArtifact: JSON.parse(recovery('R', 'R')),
    previousEmergencyRecoveryMetadata: { 'hort_ops_emergency_recovery_v2:OLD': 'IRREPLACEABLE' }
  });
  const base = { 'hort_ops_workspace_v2': workspace('current'), 'outside': 'KEEP' };
  const ls = mockStorage(base);
  const ss = mockStorage({ [key]: raw });
  const e = env(ls, ss);
  const r = e.driver.retireCompositeParentBundle('UNRESOLVED', { force: true });
  assert.strictEqual(r.success, false, 'forced deletion succeeded');
  assert.strictEqual(ss.getItem(key), raw, 'irrecoverable evidence deleted');
});

test('R45-P03: Quarantine viewer composite restore MUST register its parent link', () => {
  const a = JSON.parse(recovery('INNER', 'job-INNER'));
  const parent = {
    artifactType: 'hort_ops_reset_transaction_recovery',
    artifactVersion: 1,
    transactionId: 'PARENT',
    currentWorkspaceRecoveryArtifact: a,
    previousEmergencyRecoveryMetadata: { 'hort_ops_emergency_recovery_v2:prior': 'PRIOR DATA' }
  };
  const key = 'hort_ops_emergency_recovery_v2:transaction:PARENT';
  const mockWin = {
    console: { warn() {}, log() {}, error() {} },
    localStorage: mockStorage({}),
    sessionStorage: mockStorage({ [key]: JSON.stringify(parent) }),
    Date, JSON, Object, Array, Math, String, Error,
    confirm: () => true,
    alert: () => {},
    setTimeout: () => {}
  };
  mockWin.window = mockWin;
  mockWin.HortOpsApp = { state: { emergencyRecoveryPayload: JSON.stringify(parent), _autosaveBlocked: true, recoveryRequired: true } };
  const ctx = vm.createContext(mockWin);
  load('js/utils/storage/recoveryArtifact.js', ctx);
  load('js/utils/storage/storageDriver.js', ctx);
  mockWin.HortOpsStorage = ctx.HortOpsStorageDriver;
  load('js/components/quarantineViewerModal.js', ctx);
  mockWin.HortOpsQuarantineModal.renderModal = () => {};
  mockWin.HortOpsQuarantineModal.restoreEmergencyArtifact();
  assert.strictEqual(ctx.HortOpsStorageDriver.resolvedBundles.PARENT?.workspaceRecovered, true, 'UI stripped parent context before restore');
});

test('R45-P04: parent staging failure MUST NOT overwrite a previous composite stored in legacy alias', () => {
  const alias = 'hort_ops_emergency_recovery_v2';
  const original = JSON.stringify({
    artifactType: 'hort_ops_reset_transaction_recovery',
    previousEmergencyRecoveryMetadata: { original: 'IRREPLACEABLE' }
  });
  const mockSession = mockStorage({ [alias]: original }, {
    failSet: (k) => String(k).startsWith('hort_ops_emergency_recovery_v2:transaction:')
  });
  const mockWin = {
    console: { warn() {}, log() {}, error() {} },
    localStorage: mockStorage({}),
    sessionStorage: mockSession,
    Date, JSON, Object, Array, Math, String, Error
  };
  mockWin.window = mockWin;
  const ctx = vm.createContext(mockWin);
  load('js/utils/storage/recoveryArtifact.js', ctx);
  load('js/utils/storage/storageDriver.js', ctx);
  const a = JSON.parse(recovery('CHILD', 'child-job'));
  const b = {
    artifactType: 'hort_ops_reset_transaction_recovery',
    transactionId: 'NEW',
    currentWorkspaceRecoveryArtifact: a,
    previousEmergencyRecoveryMetadata: { [alias]: original }
  };
  const x = ctx.HortOpsStorageDriver._stageTransactionRecoveryBundle(b, JSON.stringify(b));
  assert.strictEqual(x.persistence, 'memory_only');
  assert.strictEqual(mockSession.getItem(alias), original, 'older composite alias overwritten on failure');
});

test('R45-P05: post-restore session enumeration exception MUST remain recoveryRequired/autosaveBlocked', () => {
  const a = JSON.parse(recovery('TARGET', 'target-job'));
  const key = 'hort_ops_emergency_recovery_v2:TARGET';
  const other = 'hort_ops_emergency_recovery_v2:OTHER';
  const otherVal = recovery('OTHER', 'other-job');
  const mockSession = mockStorage({ [key]: JSON.stringify(a), [other]: otherVal }, {
    failLength: () => true
  });
  const mockWin = {
    console: { warn() {}, log() {}, error() {} },
    localStorage: mockStorage({}),
    sessionStorage: mockSession,
    Date, JSON, Object, Array, Math, String, Error
  };
  mockWin.window = mockWin;
  mockWin.HortOpsApp = { state: { _autosaveBlocked: true, recoveryRequired: true } };
  const ctx = vm.createContext(mockWin);
  load('js/utils/storage/recoveryArtifact.js', ctx);
  load('js/utils/storage/storageDriver.js', ctx);
  const r = ctx.HortOpsStorageDriver.restoreEmergencyRecoveryArtifact(a);
  assert.notStrictEqual(r.terminalState, 'RESTORE_SUCCESS_CLEAN', 'unverifiable recovery inventory declared clean');
  assert.strictEqual(mockWin.HortOpsApp.state._autosaveBlocked, true, 'autosave unblocked on scan failure');
  assert.strictEqual(mockSession.getItem(other), otherVal);
});

test('R45-P06: post-retirement session scan exception MUST NOT unblock autosave', () => {
  const bundle = JSON.stringify({
    artifactType: 'hort_ops_reset_transaction_recovery',
    transactionId: 'PARENT',
    previousEmergencyRecoveryMetadata: {}
  });
  const key = 'hort_ops_emergency_recovery_v2:transaction:PARENT';
  const other = 'hort_ops_emergency_recovery_v2:OTHER';
  const mockSession = mockStorage({ [key]: bundle, [other]: 'KEEP' }, {
    failLength: () => true
  });
  const mockWin = {
    console: { warn() {}, log() {}, error() {} },
    localStorage: mockStorage({}),
    sessionStorage: mockSession,
    Date, JSON, Object, Array, Math, String, Error
  };
  mockWin.window = mockWin;
  mockWin.HortOpsApp = { state: { _autosaveBlocked: true, recoveryRequired: true } };
  const ctx = vm.createContext(mockWin);
  load('js/utils/storage/recoveryArtifact.js', ctx);
  load('js/utils/storage/storageDriver.js', ctx);
  ctx.HortOpsStorageDriver.resolvedBundles.PARENT = { workspaceRecovered: true, priorEvidenceAcknowledged: true };
  const r = ctx.HortOpsStorageDriver.retireCompositeParentBundle('PARENT');
  assert.ok(!r.success || mockWin.HortOpsApp.state._autosaveBlocked === true, 'unverified scan enabled autosave');
});


// R46 PROBES
function r46_storage(seed={},opts={}){const m={...seed};return {getItem(k){if(opts.get?.(k,m))throw Error('injected-get');return Object.hasOwn(m,k)?m[k]:null},setItem(k,v){if(opts.set?.(k,m))throw Error('injected-set');m[k]=String(v)},removeItem(k){if(opts.remove?.(k,m))throw Error('injected-remove');delete m[k]},key(i){if(opts.key?.(i,m))throw Error('injected-key');if(opts.keyValue)return opts.keyValue(i,m);return Object.keys(m)[i]??null},get length(){if(opts.length?.(m))throw Error('injected-length');return Object.keys(m).length},dump(){return {...m}}};}
function r46_env(ls={},ss={},lf={},sf={}){const l=r46_storage(ls,lf),s=r46_storage(ss,sf);const w={console:{warn(){},log(){},error(){}},localStorage:l,sessionStorage:s,Date,JSON,Object,Array,Math,String,Error,confirm(){return true},alert(){},setTimeout(){}};w.window=w;w.HortOpsApp={state:{_autosaveBlocked:true,recoveryRequired:true}};const ctx=vm.createContext(w);for(const file of ['js/utils/storage/recoveryArtifact.js','js/utils/storage/storageDriver.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});return {d:ctx.HortOpsStorageDriver,w,l,s,ctx};}
function r46_art(id, extra={}){return {artifactType:'hort_ops_reset_recovery',artifactVersion:1,recoveryId:id,createdAt:'2026-10-01T09:00:00Z',storageSnapshot:{hort_ops_workspace_v2:JSON.stringify({schemaVersion:2,jobs:[id]})},...extra}}
const r46_base={hort_ops_workspace_v2:JSON.stringify({schemaVersion:2,jobs:['current']})};

test('R46-P01 caller flags MUST NOT authorise retirement of unrecovered parent with prior evidence',()=>{
 const tx='PARENT',k='hort_ops_emergency_recovery_v2:transaction:'+tx,raw=JSON.stringify({artifactType:'hort_ops_reset_transaction_recovery',artifactVersion:1,transactionId:tx,currentWorkspaceRecoveryArtifact:r46_art('T'),previousEmergencyRecoveryMetadata:{old:'IRREPLACEABLE'}});const e=r46_env(r46_base,{[k]:raw});const r=e.d.retireCompositeParentBundle(tx,{workspaceRecovered:true,acknowledgedPriorEvidence:true});assert.equal(r.success,false,'unverified caller claims authorized destructive retirement');assert.equal(e.s.getItem(k),raw);
});
test('R46-P02 caller workspaceRecovered alone MUST NOT retire unrelated empty-prior parent',()=>{
 const tx='UNRELATED',k='hort_ops_emergency_recovery_v2:transaction:'+tx,raw=JSON.stringify({artifactType:'hort_ops_reset_transaction_recovery',artifactVersion:1,transactionId:tx,currentWorkspaceRecoveryArtifact:r46_art('T'),previousEmergencyRecoveryMetadata:{}});const e=r46_env(r46_base,{[k]:raw});const r=e.d.retireCompositeParentBundle(tx,{workspaceRecovered:true});assert.equal(r.success,false,'unrelated parent retired without verified workspace recovery');assert.equal(e.s.getItem(k),raw);
});
test('R46-P03 restoring target MUST NOT retire same-ID unique key with different stored raw evidence',()=>{
 const target=r46_art('COLLIDE'),existing=r46_art('COLLIDE',{storageSnapshot:{hort_ops_workspace_v2:'different evidence'}}),k='hort_ops_emergency_recovery_v2:COLLIDE',raw=JSON.stringify(existing);const e=r46_env(r46_base,{[k]:raw});e.d.restoreEmergencyRecoveryArtifact(target);assert.equal(e.s.getItem(k),raw,'different unique-key evidence destroyed despite nonidentical bytes');
});
test('R46-P04 legacy alias with semantically equal but different raw bytes MUST survive exact-byte retirement',()=>{
 const target=r46_art('SAME'),alias=JSON.stringify(target,null,4),k='hort_ops_emergency_recovery_v2';const e=r46_env(r46_base,{'hort_ops_emergency_recovery_v2:SAME':JSON.stringify(target),[k]:alias});e.d.restoreEmergencyRecoveryArtifact(target);assert.equal(e.s.getItem(k),alias,'non-byte-identical legacy artifact removed');
});
test('R46-P05 parent staging MUST NOT overwrite an existing different child recovery artifact',()=>{
 const k='hort_ops_emergency_recovery_v2:CHILD',existing=JSON.stringify(r46_art('CHILD',{storageSnapshot:{hort_ops_workspace_v2:'old different evidence'}})),newArtifact=r46_art('CHILD'),bundle={artifactType:'hort_ops_reset_transaction_recovery',transactionId:'NEW',currentWorkspaceRecoveryArtifact:newArtifact,previousEmergencyRecoveryMetadata:{}};const e=r46_env(r46_base,{[k]:existing});e.d._stageTransactionRecoveryBundle(bundle,JSON.stringify(bundle));assert.equal(e.s.getItem(k),existing,'previously persisted child artifact silently overwritten');
});
test('R46-P06 inventory MUST NOT report empty when length>0 but key(i) is null',()=>{
 const k='hort_ops_emergency_recovery_v2:LOST',e=r46_env(r46_base,{[k]:JSON.stringify(r46_art('LOST'))},{},{keyValue:()=>null});const r=e.d._reconcileRecoveryInventory();assert.ok(!r.ok || r.count>0,'nonempty storage reported empty after anomalous enumeration');
});
test('R46-P07 UI MUST NOT automatically reload and lose parent-resolution state while parent evidence remains',()=>{
 const tx='PARENT',target=r46_art('INNER'),parent={artifactType:'hort_ops_reset_transaction_recovery',artifactVersion:1,transactionId:tx,currentWorkspaceRecoveryArtifact:target,previousEmergencyRecoveryMetadata:{'prior':'DO NOT LOSE'}};const k='hort_ops_emergency_recovery_v2:transaction:'+tx;const e=r46_env(r46_base,{[k]:JSON.stringify(parent)});let scheduled=0;e.w.setTimeout=(f)=>{scheduled++};e.w.location={reload(){}};e.w.HortOpsStorage=e.d;e.w.HortOpsApp.state.emergencyRecoveryPayload=JSON.stringify(parent);vm.runInContext(fs.readFileSync(path.join(root,'js/components/quarantineViewerModal.js'),'utf8'),e.ctx,{filename:'quarantineViewerModal.js'});e.w.HortOpsQuarantineModal.renderModal=()=>{};e.w.HortOpsQuarantineModal.restoreEmergencyArtifact();assert.equal(e.s.getItem(k),JSON.stringify(parent),'parent evidence not preserved');assert.equal(scheduled,0,'forced reload drops volatile resolvedBundles registry before operator acknowledges earlier evidence');
});
test('R46-P08 parent staging MUST NOT overwrite different existing bundle at same transaction key',()=>{
 const tx='EXISTING',k='hort_ops_emergency_recovery_v2:transaction:'+tx,old=JSON.stringify({artifactType:'hort_ops_reset_transaction_recovery',transactionId:tx,previousEmergencyRecoveryMetadata:{older:'IRREPLACEABLE'}}),newBundle={artifactType:'hort_ops_reset_transaction_recovery',transactionId:tx,currentWorkspaceRecoveryArtifact:r46_art('NEW'),previousEmergencyRecoveryMetadata:{}};const e=r46_env(r46_base,{[k]:old});e.d._stageTransactionRecoveryBundle(newBundle,JSON.stringify(newBundle));assert.equal(e.s.getItem(k),old,'older composite overwritten by new composite with same ID');
});

console.log('================================================================');
console.log(' STAGE 2 TRANSACTION-MODEL CLOSURE AUDIT (CANONICAL MATRIX)');
console.log('================================================================\n');

let failed = 0;
for (let i = 0; i < tests.length; i++) {
  const [name, fn] = tests[i];
  try {
    fn();
    console.log(`[PASS] (${i+1}/${tests.length}) ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] (${i+1}/${tests.length}) ${name}`);
    console.error(`       ${err.message}\n`);
  }
}
console.log(`\nTOTAL: ${tests.length-failed} PASSED, ${failed} FAILED (of ${tests.length})`);
process.exit(failed ? 1 : 0);
