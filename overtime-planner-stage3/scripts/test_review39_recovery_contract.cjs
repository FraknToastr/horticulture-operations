'use strict';

// Review 39 Stage 2 recovery acceptance contract.
// This suite encodes the REQUIRED corrected behavior for R39-01, R39-02,
// R39-04 and R39-05. It is expected to fail against unmodified PR23_02.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { repoRoot } = require('./local-test-environment.cjs');

const root = repoRoot();

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
    _resetCounters() { removeCallCount = 0; setCallCount = 0; getCallCount = 0; }
  };
}

function cloneStorageData(storage) {
  return Object.assign({}, storage._data());
}

function load(relative, context) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), 'utf8'), context, { filename: relative });
}

function buildEnv(localStorageMock, options) {
  options = options || {};
  const sessionStorageMock = options.sessionStorage || mockStorage({});
  const alerts = [];
  const downloads = [];
  const objectUrls = new Map();
  let objectUrlId = 0;
  const docElements = {};

  class BlobMock {
    constructor(parts, opts) {
      this.parts = (parts || []).map(x => String(x));
      this.type = opts && opts.type ? opts.type : '';
    }
    text() { return Promise.resolve(this.parts.join('')); }
  }

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

  const body = {
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild() {},
    removeChild() {}
  };

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
    Blob: BlobMock,
    URL: {
      createObjectURL(blob) {
        const key = 'blob:review39-' + (++objectUrlId);
        objectUrls.set(key, blob);
        return key;
      },
      revokeObjectURL(key) { objectUrls.delete(key); }
    },
    setTimeout(fn) { if (typeof fn === 'function') fn(); return 1; },
    clearTimeout() {},
    scrollTo() {},
    location: { reload() {} },
    alert(msg) { alerts.push(String(msg)); }
  };
  windowMock.window = windowMock;

  const ctx = vm.createContext(windowMock);
  ctx.Blob = BlobMock;
  ctx.URL = windowMock.URL;
  ctx.document = {
    getElementById: getEl,
    body,
    addEventListener() {},
    createElement(tag) {
      if (String(tag).toLowerCase() === 'a') {
        return {
          href: '',
          download: '',
          click() {
            const blob = objectUrls.get(this.href);
            downloads.push({ name: this.download, text: blob ? blob.parts.join('') : '' });
          }
        };
      }
      return { style: {}, click() {} };
    }
  };

  load('js/data/holidays.js', ctx);
  load('js/utils/icons.js', ctx);
  load('js/utils/securityUtils.js', ctx);
  load('js/utils/dateUtils.js', ctx);
  load('js/utils/storage/schemaValidator.js', ctx);
  load('js/utils/storage/migrationEngine.js', ctx);
  if (fs.existsSync(path.join(root, 'js/utils/storage/recoveryArtifact.js'))) {
    load('js/utils/storage/recoveryArtifact.js', ctx);
  }
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
    alerts,
    downloads
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

function emergencyEntries(storage) {
  return Object.entries(storage._data())
    .filter(([k]) => k.indexOf('hort_ops_emergency_recovery_v2') === 0)
    .map(([key, raw]) => ({ key, raw }));
}

function getArtifactJson(result) {
  if (!result) return '';
  if (typeof result.recoveryArtifactJson === 'string' && result.recoveryArtifactJson) return result.recoveryArtifactJson;
  if (result.recoveryArtifact && typeof result.recoveryArtifact === 'object') return JSON.stringify(result.recoveryArtifact);
  return '';
}

function resultFailed(res) {
  return res === false || (res && res.success === false);
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('R39-T01: double persistence failure retains a directly exportable in-memory recovery artifact', () => {
  const ls = mockStorage({
    'hort_ops_workspace_v2': validWorkspace('memory-only-job'),
    'hort_ops_jobs_offline': '["memory-only-job"]'
  }, {
    failRemove: (k, n) => n === 2,
    failSet: () => true
  });
  const ss = mockStorage({}, { failSet: () => true });
  const env = buildEnv(ls, { sessionStorage: ss });
  env.app.state.jobs = [{ id: 'memory-only-job' }];

  assert.strictEqual(env.app.resetToCleanSlate(), false);
  const result = env.driver.getLastResetResult();
  const artifactJson = getArtifactJson(result);
  assert.ok(artifactJson, 'reset result must expose serialisable recovery artifact in memory');
  assert.ok(artifactJson.indexOf('memory-only-job') !== -1, 'artifact must contain the pre-reset canonical data');
  assert.ok(
    result.status === 'recovery_staging_failed_memory_only' ||
    result.status === 'delete_failed_recovery_required' ||
    result.status === 'partial_failure_unrecovered',
    'result must explicitly represent recovery-required failure state'
  );

  env.resetModal.exportEmergencyBackup();
  assert.strictEqual(env.downloads.length, 1, 'modal must download the in-memory artifact even when sessionStorage is unavailable');
  assert.ok(env.downloads[0].text.indexOf('memory-only-job') !== -1);
  assert.strictEqual(env.alerts.some(x => x.indexOf('No emergency backup data found') !== -1), false);
});

test('R39-T02: emergency recovery artifact round-trips all captured application-owned raw values', () => {
  const original = {
    'hort_ops_workspace_v2': validWorkspace('roundtrip-job'),
    'hort_ops_jobs_offline': '["roundtrip-job"]',
    'hort_ops_staff_offline': '["review39-staff"]'
  };
  const ls = mockStorage(original, {
    failRemove: (k, n) => n === 2,
    failSet: (k, n) => n === 1
  });
  const ss = mockStorage({});
  const env = buildEnv(ls, { sessionStorage: ss });

  assert.strictEqual(env.driver.resetWorkspace(), false);
  const result = env.driver.getLastResetResult();
  const artifactJson = getArtifactJson(result) || (emergencyEntries(ss)[0] && emergencyEntries(ss)[0].raw) || '';
  assert.ok(artifactJson, 'recovery artifact must be obtainable after incomplete rollback');
  assert.strictEqual(typeof env.storage.restoreEmergencyRecoveryArtifact, 'function', 'storage facade must expose dedicated emergency restore boundary');

  const restore = env.storage.restoreEmergencyRecoveryArtifact(artifactJson);
  assert.ok(restore === true || (restore && restore.success === true), 'emergency restore must report success');
  for (const [key, raw] of Object.entries(original)) {
    assert.strictEqual(ls.getItem(key), raw, 'restored raw value must match byte-for-byte for ' + key);
  }
});

test('R39-T03: invalid emergency recovery artifacts are rejected before any storage mutation', () => {
  const ls = mockStorage({
    'hort_ops_workspace_v2': validWorkspace('safe-job'),
    'unrelated_key': 'preserve'
  });
  const env = buildEnv(ls);
  assert.strictEqual(typeof env.storage.restoreEmergencyRecoveryArtifact, 'function', 'restore boundary is mandatory');

  const before = JSON.stringify(cloneStorageData(ls));
  const invalid = JSON.stringify({
    artifactType: 'not-hort-ops',
    artifactVersion: 999,
    storageSnapshot: { 'evil_key': 'overwrite' }
  });
  const res = env.storage.restoreEmergencyRecoveryArtifact(invalid);
  assert.ok(resultFailed(res), 'malformed/unsupported artifact must be rejected');
  assert.strictEqual(JSON.stringify(cloneStorageData(ls)), before, 'validation failure must cause zero storage mutation');
});

test('R39-T04: a retry cannot overwrite the earlier unresolved recovery artifact', () => {
  const ls = mockStorage({
    'hort_ops_workspace_v2': validWorkspace('retry-preserve-job'),
    'hort_ops_jobs_offline': '["retry-preserve-job"]',
    'hort_ops_staff_offline': '["review39-staff"]'
  }, {
    failRemove: (k, n) => n === 2,
    failSet: () => true
  });
  const ss = mockStorage({});
  const env = buildEnv(ls, { sessionStorage: ss });

  assert.strictEqual(env.driver.resetWorkspace(), false);
  const firstEntries = emergencyEntries(ss);
  assert.ok(firstEntries.length >= 1, 'first failed reset must persist an unresolved recovery artifact when session storage is available');
  const firstRaw = firstEntries[0].raw;
  assert.ok(firstRaw.indexOf('retry-preserve-job') !== -1);

  ls._resetCounters();
  env.driver.resetWorkspace();

  const afterEntries = emergencyEntries(ss);
  assert.ok(afterEntries.some(x => x.raw === firstRaw), 'the first unresolved artifact must remain available byte-for-byte after retry');
});

test('R39-T05: unresolved emergency artifact forces recovery state even when canonical workspace is non-empty', () => {
  const failingLs = mockStorage({
    'hort_ops_workspace_v2': validWorkspace('recovery-origin-job'),
    'hort_ops_jobs_offline': '["recovery-origin-job"]'
  }, {
    failRemove: (k, n) => n === 2,
    failSet: () => true
  });
  const staged = mockStorage({});
  const first = buildEnv(failingLs, { sessionStorage: staged });
  assert.strictEqual(first.driver.resetWorkspace(), false);
  assert.ok(emergencyEntries(staged).length >= 1, 'test setup must stage an unresolved recovery artifact');

  const freshLs = mockStorage({ 'hort_ops_workspace_v2': validWorkspace('currently-visible-job') });
  const freshSs = mockStorage(cloneStorageData(staged));
  const reload = buildEnv(freshLs, { sessionStorage: freshSs });
  reload.app.init();

  assert.strictEqual(reload.app.state.jobs.length, 1, 'sanity: canonical workspace is non-empty');
  assert.strictEqual(reload.app.state.recoveryRequired, true, 'unresolved recovery artifact must override the normal non-empty-workspace happy path');
  assert.ok(String(reload.app.state.recoverySource || '').indexOf('emergency') !== -1);
});

test('R39-T07: preflight read failure is a no-mutation state and must not claim rollback', () => {
  const ls = mockStorage({ 'hort_ops_workspace_v2': validWorkspace('preflight-job') }, {
    failGet: k => k === 'hort_ops_workspace_v2'
  });
  const env = buildEnv(ls);
  assert.strictEqual(env.driver.resetWorkspace(), false);
  const result = env.driver.getLastResetResult();
  assert.strictEqual(result.status, 'preflight_failed');
  assert.strictEqual(result.deletedCount, 0);
  assert.notStrictEqual(result.rolledBack, true, 'no rollback occurred because no destructive mutation occurred');
});

test('R39-T08: recovery-metadata cleanup failure restores exact pre-reset persistent state before reporting reset failure', () => {
  const originalWorkspace = validWorkspace('cleanup-job');
  const originalJobsRaw = '["cleanup-job"]';
  const ls = mockStorage({
    'hort_ops_workspace_v2': originalWorkspace,
    'hort_ops_jobs_offline': originalJobsRaw,
    'unrelated-origin-key': 'KEEP'
  });

  const staleRecoveryRaw = JSON.stringify({
    artifactType: 'hort_ops_reset_recovery',
    artifactVersion: 1,
    recoveryId: 'cleanup-stale',
    createdAt: '2026-10-01T00:00:00.000Z',
    reason: 'prior_unresolved_recovery',
    failedKey: null,
    error: null,
    unrecoveredKeys: [],
    storageSnapshot: { 'hort_ops_workspace_v2': originalWorkspace }
  });

  const ss = mockStorage({
    'hort_ops_emergency_recovery_v2': staleRecoveryRaw,
    'hort_ops_emergency_recovery_v2:cleanup-stale': staleRecoveryRaw
  }, {
    failRemove: k => k.indexOf('hort_ops_emergency_recovery_v2') === 0
  });

  const env = buildEnv(ls, { sessionStorage: ss });
  env.app.state.jobs = [{ id: 'cleanup-job' }];

  const success = env.app.resetToCleanSlate();
  const details = env.driver.getLastResetResult();

  assert.strictEqual(success, false);
  assert.ok(details && details.success === false);
  assert.strictEqual(details.rolledBack, true,
    'a failed reset after persistent deletion must compensate to the pre-reset snapshot');
  assert.ok(String(details.status || '').indexOf('rolled_back') !== -1);

  assert.strictEqual(ls.getItem('hort_ops_workspace_v2'), originalWorkspace,
    'canonical workspace bytes must be restored exactly');
  assert.strictEqual(ls.getItem('hort_ops_jobs_offline'), originalJobsRaw,
    'captured raw application-owned bytes must be restored exactly');
  assert.strictEqual(ls.getItem('unrelated-origin-key'), 'KEEP');
  assert.strictEqual(env.app._autosaveBlocked, true);

  const reload = buildEnv(ls, { sessionStorage: ss });
  reload.app.init();
  assert.deepStrictEqual(reload.app.state.jobs.map(j => j.id), ['cleanup-job'],
    'cold reload must retain the current pre-reset workspace');
  assert.strictEqual(reload.app.state.recoveryRequired, true,
    'unresolved session recovery metadata must remain explicit');
});

console.log('================================================================');
console.log(' REVIEW 39 STAGE 2 RECOVERY ACCEPTANCE CONTRACT');
console.log('================================================================\n');
console.log('Repository:', root, '\n');

let failed = 0;
for (let i = 0; i < tests.length; i++) {
  const [name, fn] = tests[i];
  try {
    fn();
    console.log(`[PASS] (${i + 1}/${tests.length}) ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] (${i + 1}/${tests.length}) ${name}`);
    console.error(`       ${err.message}\n${err.stack}\n`);
  }
}

console.log('\n----------------------------------------------------------------');
console.log(`TOTAL: ${tests.length - failed} PASSED, ${failed} FAILED (of ${tests.length} Review 39 recovery assertions)`);
console.log('----------------------------------------------------------------\n');

process.exit(failed > 0 ? 1 : 0);
