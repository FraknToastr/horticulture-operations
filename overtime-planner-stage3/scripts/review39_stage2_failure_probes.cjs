'use strict';

// Review 39 independent failure probes for PR23_02.
// These probes intentionally PASS when the PR23_02 defect is reproduced.
// After remediation they should stop reproducing the defect and are not intended
// to remain as the maintained acceptance suite. See test_review39_recovery_contract.cjs.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

function resolveRepoRoot() {
  const candidates = [];
  if (process.env.HORTOPS_REPO_ROOT) candidates.push(path.resolve(process.env.HORTOPS_REPO_ROOT));
  candidates.push(path.resolve(__dirname, '..'));
  candidates.push(path.resolve(process.cwd()));
  candidates.push(path.resolve(__dirname, '../..'));
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'js', 'app.js')) && fs.existsSync(path.join(c, 'scripts', 'run_all_release_gates.cjs'))) {
      return c;
    }
  }
  throw new Error('Cannot locate Overtime Planner repository. Set HORTOPS_REPO_ROOT to the application root.');
}

const root = resolveRepoRoot();

function mockStorage(initial, options) {
  options = options || {};
  const data = Object.assign(Object.create(null), initial || {});
  let removeCallCount = 0;
  let setCallCount = 0;
  let getCallCount = 0;
  return {
    getItem(k) {
      getCallCount++;
      if (options.failGet && options.failGet(k, getCallCount)) throw new Error('Injected getItem denial for key: ' + k);
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
    },
    setItem(k, v) {
      setCallCount++;
      if (options.failSet && options.failSet(k, setCallCount, v)) throw new Error('Injected setItem denial for key: ' + k);
      data[k] = String(v);
    },
    removeItem(k) {
      removeCallCount++;
      if (options.failRemove && options.failRemove(k, removeCallCount)) throw new Error('Injected removeItem denial for key: ' + k);
      delete data[k];
    },
    key(i) { return Object.keys(data)[i] || null; },
    get length() { return Object.keys(data).length; },
    _data() { return data; },
    _counts() { return { remove: removeCallCount, set: setCallCount, get: getCallCount }; },
    _resetCounters() { removeCallCount = 0; setCallCount = 0; getCallCount = 0; }
  };
}

function load(relative, context) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), 'utf8'), context, { filename: relative });
}

function buildEnv(localStorageMock, options) {
  options = options || {};
  const sessionStorageMock = options.sessionStorage || mockStorage({});
  const alerts = [];
  const docElements = {};

  function getEl(id) {
    if (!docElements[id]) {
      const el = {
        id,
        _html: '',
        _text: '',
        value: '',
        disabled: false,
        style: {},
        focus() {},
        querySelector() { return null; },
        querySelectorAll() { return []; }
      };
      Object.defineProperty(el, 'innerHTML', {
        get() { return this._html; },
        set(val) {
          this._html = String(val);
          this._text = this._html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      });
      Object.defineProperty(el, 'textContent', {
        get() { return this._text; },
        set(val) { this._text = String(val); this._html = String(val); }
      });
      docElements[id] = el;
    }
    return docElements[id];
  }

  const windowMock = {
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    console,
    Date,
    JSON,
    Object,
    Array,
    Math,
    String,
    Error,
    setTimeout,
    clearTimeout,
    scrollTo() {},
    location: { reload() {} },
    alert(msg) { alerts.push(String(msg)); }
  };
  windowMock.window = windowMock;

  const ctx = vm.createContext(windowMock);
  ctx.document = {
    getElementById: getEl,
    body: { style: {}, classList: { add() {}, remove() {}, contains() { return false; } } },
    addEventListener() {}
  };

  load('js/data/holidays.js', ctx);
  load('js/utils/icons.js', ctx);
  load('js/utils/securityUtils.js', ctx);
  load('js/utils/dateUtils.js', ctx);
  load('js/utils/storage/schemaValidator.js', ctx);
  load('js/utils/storage/migrationEngine.js', ctx);
  load('js/utils/storage/storageDriver.js', ctx);
  load('js/utils/storage.js', ctx);
  load('js/utils/modalUtils.js', ctx);
  load('js/components/resetWorkspaceModal.js', ctx);
  load('js/components/storageHealthModal.js', ctx);
  load('js/components/quarantineViewerModal.js', ctx);
  load('js/app.js', ctx);

  const app = ctx.window.HortOpsApp;
  app.recomputeDigest = function() {};
  app.renderCurrentView = function() {};
  ctx.window.HortOpsScheduler = {
    clearBoundaryCache() {},
    DEFAULT_BUDGET_SETTINGS: { annualTarget: 0, defaultStandardHoursPerShift: 8 },
    generateOperationalDigest() { return { slots: [] }; }
  };
  ctx.window.HortOpsHeader = { updateStorageHealthIndicator() {} };

  return {
    ctx,
    app,
    storage: ctx.window.HortOpsStorage,
    driver: ctx.window.HortOpsStorageDriver,
    resetModal: ctx.window.HortOpsResetWorkspaceModal,
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    alerts
  };
}

function validWorkspace(jobId) {
  return JSON.stringify({
    schemaVersion: 2,
    lastSaved: '2026-09-30T00:00:00Z',
    jobs: [{
      id: jobId || 'review39-job', name: 'Review 39 Job', category: 'Parks',
      frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-09-26',
      preferredDay: 'saturday', startTime: '08:00 PM', durationHours: 8, crewSize: 2, status: 'active'
    }],
    roster: [{ id: 'review39-staff', name: 'Review 39 Staff', role: 'Gardener', primaryTeam: 'Parks', status: 'active', isPlantOperator: false }],
    assignments: {},
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: {},
    permits: {},
    budgetSettings: { annualTarget: 0, defaultStandardHoursPerShift: 8 },
    uiState: { activeView: 'forward_planner', currentYear: 2026 }
  });
}

const probes = [];
function probe(name, fn) { probes.push([name, fn]); }

probe('R39-P1: double persistence failure leaves valid snapshot in memory but emergency export cannot retrieve it', () => {
  const ls = mockStorage({
    'hort_ops_workspace_v2': validWorkspace('critical-job'),
    'hort_ops_jobs_offline': '["critical-job"]'
  }, {
    failRemove: (k, n) => n === 2,
    failSet: () => true
  });
  const ss = mockStorage({}, { failSet: () => true });
  const env = buildEnv(ls, { sessionStorage: ss });
  env.app.state.jobs = [{ id: 'critical-job' }];

  const ok = env.app.resetToCleanSlate();
  assert.strictEqual(ok, false);
  assert.strictEqual(env.driver.lastResetResult.status, 'partial_failure_unrecovered');
  assert.ok(env.driver.lastResetResult.snapshot, 'pre-reset snapshot must still exist in memory');
  assert.ok(env.driver.lastResetResult.snapshot['hort_ops_workspace_v2'], 'snapshot retains canonical workspace bytes');
  assert.strictEqual(ss.getItem('hort_ops_emergency_recovery_v2'), null, 'session staging was injected to fail');

  env.resetModal.exportEmergencyBackup();
  assert.ok(env.alerts.some(x => x.indexOf('No emergency backup data found') !== -1), 'current modal cannot export the in-memory snapshot');
});

probe('R39-P1B: staged emergency payload is rejected by the ordinary workspace importer', () => {
  const ls = mockStorage({
    'hort_ops_workspace_v2': validWorkspace('critical-job'),
    'hort_ops_jobs_offline': '["critical-job"]'
  }, {
    failRemove: (k, n) => n === 2,
    failSet: () => true
  });
  const ss = mockStorage({});
  const env = buildEnv(ls, { sessionStorage: ss });
  env.app.state.jobs = [{ id: 'critical-job' }];
  assert.strictEqual(env.app.resetToCleanSlate(), false);
  const raw = ss.getItem('hort_ops_emergency_recovery_v2');
  assert.ok(raw);
  const prep = env.storage.prepareWorkspaceJsonImport(raw);
  assert.strictEqual(prep.success, false, 'raw multi-key emergency snapshot is not a canonical import envelope');
  assert.ok(String(prep.error || '').indexOf('schemaVersion') !== -1);
});

probe('R39-P2: a retry can overwrite the original complete emergency snapshot with a degraded snapshot', () => {
  const ls = mockStorage({
    'hort_ops_workspace_v2': validWorkspace('retry-job'),
    'hort_ops_jobs_offline': '["retry-job"]',
    'hort_ops_staff_offline': '["review39-staff"]'
  }, {
    failRemove: (k, n) => n === 2,
    failSet: () => true
  });
  const ss = mockStorage({});
  const env = buildEnv(ls, { sessionStorage: ss });

  assert.strictEqual(env.driver.resetWorkspace(), false);
  const firstRaw = ss.getItem('hort_ops_emergency_recovery_v2');
  const first = JSON.parse(firstRaw);
  assert.ok(first['hort_ops_workspace_v2'], 'first recovery snapshot contains canonical workspace');

  ls._resetCounters();
  assert.strictEqual(env.driver.resetWorkspace(), false);
  const secondRaw = ss.getItem('hort_ops_emergency_recovery_v2');
  const second = JSON.parse(secondRaw);

  assert.notStrictEqual(secondRaw, firstRaw, 'fixed recovery key was overwritten');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(second, 'hort_ops_workspace_v2'), false, 'second snapshot has lost the original canonical workspace');
});

probe('R39-P3: unresolved emergency recovery is ignored on reload when canonical workspace has jobs', () => {
  const ls = mockStorage({ 'hort_ops_workspace_v2': validWorkspace('nonempty-job') });
  const emergency = JSON.stringify({
    'hort_ops_workspace_v2': validWorkspace('older-recovery-job'),
    'hort_ops_jobs_offline': '["older-recovery-job"]'
  });
  const ss = mockStorage({ 'hort_ops_emergency_recovery_v2': emergency });
  const env = buildEnv(ls, { sessionStorage: ss });
  env.app.init();
  assert.strictEqual(env.app.state.jobs.length, 1);
  assert.strictEqual(env.app.state.recoveryRequired, false, 'PR23_02 suppresses emergency recovery solely because current jobs are non-empty');
  assert.strictEqual(env.app.state.recoverySource, null);
});

probe('R39-P4: preflight read failure is incorrectly labelled rolledBack=true', () => {
  const ls = mockStorage({ 'hort_ops_workspace_v2': validWorkspace('preflight-job') }, {
    failGet: k => k === 'hort_ops_workspace_v2'
  });
  const env = buildEnv(ls);
  assert.strictEqual(env.driver.resetWorkspace(), false);
  assert.strictEqual(env.driver.lastResetResult.status, 'preflight_failed');
  assert.strictEqual(env.driver.lastResetResult.deletedCount, 0);
  assert.strictEqual(env.driver.lastResetResult.rolledBack, true, 'current result falsely claims rollback despite zero destructive mutations');
});

probe('R39-P5: successful reset can leave stale emergency payload that reappears as recovery after reload', () => {
  const ls = mockStorage({ 'hort_ops_workspace_v2': validWorkspace('cleanup-job') });
  const ss = mockStorage({ 'hort_ops_emergency_recovery_v2': '{"stale":true}' }, {
    failRemove: k => k === 'hort_ops_emergency_recovery_v2'
  });
  const env = buildEnv(ls, { sessionStorage: ss });
  env.app.state.jobs = [{ id: 'cleanup-job' }];

  assert.strictEqual(env.app.resetToCleanSlate(), true, 'PR23_02 reports reset success despite cleanup failure');
  assert.strictEqual(env.driver.lastResetResult.status, 'success');
  assert.ok(ss.getItem('hort_ops_emergency_recovery_v2'), 'stale emergency payload remains');

  const reload = buildEnv(ls, { sessionStorage: ss });
  reload.app.init();
  assert.strictEqual(reload.app.state.recoveryRequired, true, 'stale recovery metadata changes post-reload state after a reported successful reset');
  assert.strictEqual(reload.app.state.recoverySource, 'emergency_session_backup');
});

probe('R39-P6: complete release runner passes an empty and truncated synthetic manifest', () => {
  const runner = path.join(root, 'scripts', 'run_all_release_gates.cjs');
  const empty = spawnSync(process.execPath, [runner], {
    env: Object.assign({}, process.env, { RELEASE_RUNNER_SUITES_JSON: '[]' }),
    encoding: 'utf8',
    timeout: 30000
  });
  const emptyOut = (empty.stdout || '') + (empty.stderr || '');
  assert.strictEqual(empty.status, 0, 'current runner passes empty manifest');
  assert.ok(emptyOut.indexOf('[RELEASE GATE PASSED]') !== -1);

  const tmpDir = path.join(root, 'test_reports', 'review39_probe');
  fs.mkdirSync(tmpDir, { recursive: true });
  const passPath = path.join(tmpDir, 'mock_pass.cjs');
  fs.writeFileSync(passPath, 'console.log("review39 synthetic pass"); process.exit(0);\n');
  const rel = path.relative(path.join(root, 'scripts'), passPath).replace(/\\/g, '/');
  const suites = [{ name: 'Only One Synthetic Passing Suite', script: rel, stage: 'Stage 1 Retained' }];
  const one = spawnSync(process.execPath, [runner], {
    env: Object.assign({}, process.env, { RELEASE_RUNNER_SUITES_JSON: JSON.stringify(suites) }),
    encoding: 'utf8',
    timeout: 30000
  });
  const oneOut = (one.stdout || '') + (one.stderr || '');
  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.strictEqual(one.status, 0, 'current runner passes arbitrarily truncated one-suite manifest');
  assert.ok(oneOut.indexOf('[RELEASE GATE PASSED]') !== -1);
});

console.log('================================================================');
console.log(' REVIEW 39 INDEPENDENT PR23_02 FAILURE PROBES');
console.log('================================================================\n');
console.log('Repository:', root, '\n');

let failed = 0;
for (let i = 0; i < probes.length; i++) {
  const [name, fn] = probes[i];
  try {
    fn();
    console.log(`[REPRODUCED] (${i + 1}/${probes.length}) ${name}`);
  } catch (err) {
    failed++;
    console.error(`[NOT REPRODUCED] (${i + 1}/${probes.length}) ${name}`);
    console.error(`  ${err.message}\n${err.stack}\n`);
  }
}

console.log('\n----------------------------------------------------------------');
console.log(`TOTAL: ${probes.length - failed} DEFECT PROBES REPRODUCED, ${failed} NOT REPRODUCED`);
console.log('----------------------------------------------------------------\n');

process.exit(failed > 0 ? 1 : 0);
