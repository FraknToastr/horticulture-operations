'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function resolveRepoRoot() {
  const candidates = [];
  if (process.env.HORTOPS_REPO_ROOT) candidates.push(path.resolve(process.env.HORTOPS_REPO_ROOT));
  candidates.push(path.resolve(__dirname, '..'));
  candidates.push(path.resolve(process.cwd()));
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'js', 'utils', 'storage', 'storageDriver.js'))) return c;
  }
  throw new Error('Cannot locate Overtime Planner repository. Set HORTOPS_REPO_ROOT.');
}
const root = resolveRepoRoot();

function mockStorage(initial, options) {
  options = options || {};
  const data = Object.assign(Object.create(null), initial || {});
  let getCount = 0;
  let setCount = 0;
  let removeCount = 0;
  return {
    getItem(k) {
      getCount++;
      if (options.failGet && options.failGet(k, getCount)) throw new Error('Injected getItem failure for ' + k);
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
    },
    setItem(k, v) {
      setCount++;
      if (options.failSet && options.failSet(k, setCount, v)) throw new Error('Injected setItem failure for ' + k);
      data[k] = String(v);
    },
    removeItem(k) {
      removeCount++;
      if (options.failRemove && options.failRemove(k, removeCount)) throw new Error('Injected removeItem failure for ' + k);
      delete data[k];
    },
    key(i) { return Object.keys(data)[i] || null; },
    get length() { return Object.keys(data).length; },
    snapshot() { return Object.assign({}, data); }
  };
}

function load(rel, ctx) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
}

function buildEnv(ls, ss) {
  const windowMock = {
    localStorage: ls,
    sessionStorage: ss,
    console,
    Date, JSON, Object, Array, Math, String, Error,
    HortOpsApp: {
      state: {
        recoveryRequired: true,
        recoverySource: 'emergency_session_backup',
        recoveryError: 'active recovery',
        emergencyRecoveryPayload: 'artifact'
      }
    },
    HortOpsHeader: { updateStorageHealthIndicator() {} }
  };
  windowMock.window = windowMock;
  const ctx = vm.createContext(windowMock);
  load('js/utils/storage/recoveryArtifact.js', ctx);
  load('js/utils/storage/storageDriver.js', ctx);
  return ctx;
}

function artifact(snapshot, recoveryId) {
  return {
    artifactType: 'hort_ops_reset_recovery',
    artifactVersion: 1,
    recoveryId: recoveryId || 'review40-artifact',
    createdAt: '2026-10-01T00:00:00.000Z',
    reason: 'review40-test',
    failedKey: null,
    error: null,
    unrecoveredKeys: [],
    storageSnapshot: snapshot
  };
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('R40-T01: recovery UI exposes a dedicated Emergency Recovery Restore action', () => {
  const src = fs.readFileSync(path.join(root, 'js/components/quarantineViewerModal.js'), 'utf8');
  assert.ok(src.indexOf('restoreEmergencyRecoveryArtifact') !== -1,
    'quarantine recovery UI must call the dedicated emergency restore boundary');
  assert.ok(/Restore Emergency Recovery Artifact/i.test(src),
    'operator UI must explicitly label the emergency-artifact restore action');
});

test('R40-T02: artifact validator rejects non-string raw storage values before mutation', () => {
  const ls = mockStorage({ 'hort_ops_workspace_v2': 'ORIGINAL' });
  const ss = mockStorage({});
  const ctx = buildEnv(ls, ss);

  for (const badValue of [{ bad: true }, ['bad'], 42, true]) {
    const before = JSON.stringify(ls.snapshot());
    const candidate = artifact({ 'hort_ops_workspace_v2': badValue }, 'invalid-value');
    const validation = ctx.HortOpsRecoveryArtifact.validateEmergencyRecoveryArtifact(candidate);
    assert.strictEqual(validation.valid, false, 'raw localStorage value must be a string');
    assert.strictEqual(JSON.stringify(ls.snapshot()), before, 'validation must not mutate storage');
  }
});

test('R40-T03: restore write failure compensates to exact pre-restore state', () => {
  const original = {
    'hort_ops_workspace_v2': 'OLD_WS',
    'hort_ops_jobs_offline': 'OLD_JOBS'
  };
  const ls = mockStorage(original, { failSet: (k, n) => n === 2 });
  const artRaw = JSON.stringify(artifact({
    'hort_ops_workspace_v2': 'NEW_WS',
    'hort_ops_jobs_offline': 'NEW_JOBS'
  }, 'atomic-write'));
  const ss = mockStorage({
    'hort_ops_emergency_recovery_v2': artRaw,
    'hort_ops_emergency_recovery_v2:atomic-write': artRaw
  });
  const ctx = buildEnv(ls, ss);

  const result = ctx.HortOpsStorageDriver.restoreEmergencyRecoveryArtifact(artRaw);
  assert.ok(!result || result.success !== true, 'failed restore must not report success');
  assert.deepStrictEqual(ls.snapshot(), original,
    'failed restore must compensate back to exact pre-restore persistent state');
  assert.strictEqual(ctx.HortOpsApp.state.recoveryRequired, true,
    'recovery must remain active after failed restore');
  assert.ok(ss.getItem('hort_ops_emergency_recovery_v2'),
    'emergency artifact must remain available');
});

test('R40-T04: recovery metadata cleanup failure cannot report success or clear recovery state', () => {
  const artRaw = JSON.stringify(artifact({
    'hort_ops_workspace_v2': 'RESTORED'
  }, 'cleanup-fail'));

  const ls = mockStorage({ 'hort_ops_workspace_v2': 'OLD' });
  const ss = mockStorage({
    'hort_ops_emergency_recovery_v2': artRaw,
    'hort_ops_emergency_recovery_v2:cleanup-fail': artRaw
  }, {
    failRemove: k => String(k).indexOf('hort_ops_emergency_recovery_v2') === 0
  });
  const ctx = buildEnv(ls, ss);

  const result = ctx.HortOpsStorageDriver.restoreEmergencyRecoveryArtifact(artRaw);
  assert.ok(!result || result.success !== true, 'cleanup failure must prevent success');
  assert.strictEqual(ctx.HortOpsApp.state.recoveryRequired, true,
    'recovery must remain active while recovery metadata persists');
});

test('R40-T05: normal successful restore verifies data and fully resolves recovery', () => {
  const artRaw = JSON.stringify(artifact({
    'hort_ops_workspace_v2': 'RESTORED_WS',
    'hort_ops_jobs_offline': 'RESTORED_JOBS'
  }, 'success'));
  const ls = mockStorage({ 'hort_ops_workspace_v2': 'OLD_WS' });
  const ss = mockStorage({
    'hort_ops_emergency_recovery_v2': artRaw,
    'hort_ops_emergency_recovery_v2:success': artRaw
  });
  const ctx = buildEnv(ls, ss);

  const result = ctx.HortOpsStorageDriver.restoreEmergencyRecoveryArtifact(artRaw);
  assert.ok(result && result.success === true, 'valid restore should report success');
  assert.strictEqual(ls.getItem('hort_ops_workspace_v2'), 'RESTORED_WS');
  assert.strictEqual(ls.getItem('hort_ops_jobs_offline'), 'RESTORED_JOBS');
  assert.strictEqual(ctx.HortOpsApp.state.recoveryRequired, false);
});


test('R41-T06: post-write verification read exception is caught and compensates to exact pre-restore state', () => {
  const original = {
    'hort_ops_workspace_v2': 'OLD_WS',
    'hort_ops_jobs_offline': 'OLD_JOBS'
  };
  // Two preflight reads occur first. Fail the first post-write verification read.
  const ls = mockStorage(original, { failGet: (k, n) => n === 3 });
  const artRaw = JSON.stringify(artifact({
    'hort_ops_workspace_v2': 'NEW_WS',
    'hort_ops_jobs_offline': 'NEW_JOBS'
  }, 'verification-read-failure'));
  const ss = mockStorage({
    'hort_ops_emergency_recovery_v2': artRaw,
    'hort_ops_emergency_recovery_v2:verification-read-failure': artRaw
  });
  const ctx = buildEnv(ls, ss);

  let result = null;
  let thrown = null;
  try {
    result = ctx.HortOpsStorageDriver.restoreEmergencyRecoveryArtifact(artRaw);
  } catch (err) {
    thrown = err;
  }

  assert.strictEqual(thrown, null, 'restore API must contain verification storage exceptions');
  assert.ok(result && result.success === false, 'verification read failure must return explicit failure');
  assert.ok(String(result.status || '').includes('rolled_back'),
    'verification read failure must enter compensating rollback');
  assert.deepStrictEqual(ls.snapshot(), original,
    'persistent state must be byte-equivalent to pre-restore state after verification exception');
  assert.strictEqual(ctx.HortOpsApp.state.recoveryRequired, true,
    'recovery must remain active after failed verification');
  assert.ok(ss.getItem('hort_ops_emergency_recovery_v2'),
    'emergency artifact must remain available after failed verification');
});

console.log('================================================================');
console.log(' REVIEW 40 EMERGENCY RESTORE CONTRACT');
console.log('================================================================\n');

let failed = 0;
for (let i = 0; i < tests.length; i++) {
  const [name, fn] = tests[i];
  try {
    fn();
    console.log(`[PASS] (${i + 1}/${tests.length}) ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] (${i + 1}/${tests.length}) ${name}`);
    console.error(`       ${err.message}\n`);
  }
}
console.log(`\nTOTAL: ${tests.length - failed} PASSED, ${failed} FAILED (of ${tests.length})`);
process.exit(failed > 0 ? 1 : 0);
