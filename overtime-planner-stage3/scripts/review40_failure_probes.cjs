'use strict';

// Review 40 focused probes. These reproduce the PR23_03 gaps identified by
// independent peer review. They are diagnostic probes, not release gates.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');

const root = process.env.HORTOPS_REPO_ROOT
  ? path.resolve(process.env.HORTOPS_REPO_ROOT)
  : path.resolve(__dirname, '..');

function mockStorage(initial, opts = {}) {
  const d = Object.assign(Object.create(null), initial || {});
  let sc = 0, rc = 0;
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
    setItem(k, v) {
      sc++;
      if (opts.failSet && opts.failSet(k, sc, v)) throw new Error('set fail ' + k);
      d[k] = String(v);
    },
    removeItem(k) {
      rc++;
      if (opts.failRemove && opts.failRemove(k, rc)) throw new Error('remove fail ' + k);
      delete d[k];
    },
    key(i) { return Object.keys(d)[i] || null; },
    get length() { return Object.keys(d).length; },
    data: d
  };
}

function load(rel, ctx) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
}

function env(ls, ss) {
  const w = {
    localStorage: ls,
    sessionStorage: ss,
    console,
    Date, JSON, Object, Array, Math, String, Error,
    HortOpsApp: { state: {
      recoveryRequired: true,
      recoverySource: 'emergency_session_backup',
      recoveryError: 'x',
      emergencyRecoveryPayload: 'x'
    }},
    HortOpsHeader: { updateStorageHealthIndicator() {} }
  };
  w.window = w;
  const ctx = vm.createContext(w);
  load('js/utils/storage/recoveryArtifact.js', ctx);
  load('js/utils/storage/storageDriver.js', ctx);
  return ctx;
}

function emit(name, value) {
  console.log('\n### ' + name + '\n' + JSON.stringify(value));
}

const ra = require(path.join(root, 'js/utils/storage/recoveryArtifact.js'));
emit('P1 non-string value validation', ra.validateEmergencyRecoveryArtifact({
  artifactType: 'hort_ops_reset_recovery',
  artifactVersion: 1,
  recoveryId: 'r1',
  storageSnapshot: { 'hort_ops_workspace_v2': { bad: true } }
}));

{
  const ls = mockStorage(
    { 'hort_ops_workspace_v2': 'OLD_WS', 'hort_ops_jobs_offline': 'OLD_JOBS' },
    { failSet: (k, n) => n === 2 }
  );
  const ss = mockStorage({ 'hort_ops_emergency_recovery_v2': 'KEEP' });
  const ctx = env(ls, ss);
  const art = ctx.HortOpsRecoveryArtifact.createEmergencyRecoveryArtifact(
    { 'hort_ops_workspace_v2': 'NEW_WS', 'hort_ops_jobs_offline': 'NEW_JOBS' },
    { recoveryId: 'r2' }
  );
  const res = ctx.HortOpsStorageDriver.restoreEmergencyRecoveryArtifact(art);
  emit('P2 partial restore mutation', {
    result: res,
    workspace: ls.getItem('hort_ops_workspace_v2'),
    jobs: ls.getItem('hort_ops_jobs_offline')
  });
}

{
  const raw = JSON.stringify({
    artifactType: 'hort_ops_reset_recovery',
    artifactVersion: 1,
    recoveryId: 'r3',
    createdAt: new Date().toISOString(),
    reason: 'x',
    failedKey: null,
    error: null,
    unrecoveredKeys: [],
    storageSnapshot: { 'hort_ops_workspace_v2': 'RESTORED' }
  });
  const ls = mockStorage({ 'hort_ops_workspace_v2': 'OLD' });
  const ss = mockStorage(
    { 'hort_ops_emergency_recovery_v2': raw, 'hort_ops_emergency_recovery_v2:r3': raw },
    { failRemove: k => String(k).startsWith('hort_ops_emergency_recovery_v2') }
  );
  const ctx = env(ls, ss);
  const res = ctx.HortOpsStorageDriver.restoreEmergencyRecoveryArtifact(raw);
  emit('P3 cleanup false success', {
    result: res,
    sessionKeys: Object.keys(ss.data),
    state: ctx.HortOpsApp.state
  });
}

{
  const core = require(path.join(root, 'scripts/release_runner_core.cjs'));
  const suites = core.DEFAULT_SUITES.map(x => Object.assign({}, x));
  suites.push({ id: 'unknown-extra-suite', name: 'Unknown', script: 'test_gate_b1.cjs', stage: 'Stage 1 Retained' });
  emit('P4 unknown extra suite validation',
    core.validateManifest(suites, { requiredSuiteIds: core.MANDATORY_SUITE_IDS, scriptsRoot: path.join(root, 'scripts') })
  );

  const src = fs.readFileSync(path.join(root, 'scripts/release_runner_core.cjs'), 'utf8');
  emit('P5 mandatory inventory source coupling',
    (src.match(/const\s+MANDATORY_SUITE_IDS\s*=\s*([^;]+);/) || ['not found'])[0]
  );
}

{
  const q = fs.readFileSync(path.join(root, 'js/components/quarantineViewerModal.js'), 'utf8');
  emit('P6 operator UI wiring', {
    callsDedicatedRestore: q.includes('restoreEmergencyRecoveryArtifact'),
    opensNormalImport: q.includes('openImportModal')
  });
}
