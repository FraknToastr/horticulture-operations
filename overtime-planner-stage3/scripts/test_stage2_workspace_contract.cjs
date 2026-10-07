'use strict';
// Stage 2 Deterministic Node Contract Test Suite (PR23_02 / Review 38 Verification)
// Covers:
// - Review 37 Independent Probes (R37-P1, R37-P2, R37-P3)
// - Review 38 Acceptance Matrix:
//     A01: Preflight backup/read cannot complete -> Zero deletions, explicit failure, state intact
//     A02: First targeted removal fails -> No success or reload, durable recovery intact
//     A03: Second/later removal fails -> Compensating rollback restores all keys, survives cold reload
//     A04: Multiple removal failures -> Deterministic recovery & actionable error details
//     A05: Compensating rollback fails -> Detects partial failure, stages emergency session backup, blocks autosave
//     A06: Success path -> All app keys absent, unrelated origin keys intact, session staging purged
//     A08: Confirmation mismatch -> Exact 'RESET' required, no destructive call, no reload
//     A09: Modal error reporting -> Renders truthful rollback vs emergency banner, suppresses reload
//     A10: Quarantine export & corrupt workspace recovery
// - Storage Compaction idempotency (T03)
// - Persistence Probe double-fault resilience & unrounded quota boundary (T04)
// 100% Headless Node.js — Zero browser / Playwright dependency.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function mockStorage(initial, options) {
  options = options || {};
  const failRemovePredicate = typeof options === 'function' ? options : options.failRemove;
  const failSetPredicate = options.failSet;
  const failGetPredicate = options.failGet;

  const data = Object.assign(Object.create(null), initial || {});
  let removeCallCount = 0;
  let setCallCount = 0;
  let getCallCount = 0;

  return {
    getItem(k) {
      getCallCount++;
      if (failGetPredicate && failGetPredicate(k, getCallCount)) {
        throw new Error('Injected getItem denial for key: ' + k);
      }
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
    },
    setItem(k, v) {
      setCallCount++;
      if (failSetPredicate && failSetPredicate(k, setCallCount, v)) {
        throw new Error('Injected setItem denial for key: ' + k);
      }
      data[k] = String(v);
    },
    removeItem(k) {
      removeCallCount++;
      if (failRemovePredicate && failRemovePredicate(k, removeCallCount)) {
        throw new Error('Injected removeItem denial for key: ' + k + ' (call #' + removeCallCount + ')');
      }
      delete data[k];
    },
    key(i) { return Object.keys(data)[i] || null; },
    get length() { return Object.keys(data).length; },
    _removeCallCount() { return removeCallCount; },
    _setCallCount() { return setCallCount; },
    _data() { return data; }
  };
}

function load(relative, context) {
  const abs = path.join(root, relative);
  vm.runInContext(fs.readFileSync(abs, 'utf8'), context, { filename: relative });
}

function buildEnv(localStorageMock, options) {
  options = options || {};
  let reloaded = false;
  const sessionStorageMock = options.sessionStorage || mockStorage({});

  const docElements = {};
  function getEl(id) {
    if (!docElements[id]) {
      const el = {
        id: id,
        _html: '',
        _text: '',
        value: '',
        disabled: false,
        style: {},
        focus: function() {},
        querySelector: function() { return null; },
        querySelectorAll: function() { return []; }
      };
      Object.defineProperty(el, 'innerHTML', {
        get: function() { return this._html; },
        set: function(val) {
          this._html = String(val);
          this._text = this._html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      });
      Object.defineProperty(el, 'textContent', {
        get: function() { return this._text; },
        set: function(val) {
          this._text = String(val);
          this._html = String(val);
        }
      });
      docElements[id] = el;
    }
    return docElements[id];
  }

  const windowMock = {
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    console: console,
    Date: Date,
    JSON: JSON,
    Object: Object,
    Array: Array,
    Math: Math,
    String: String,
    Error: Error,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    scrollTo: function() {},
    location: {
      reload: function() { reloaded = true; }
    },
    alert: function(msg) { /* no-op in tests */ }
  };
  windowMock.window = windowMock;

  const ctx = vm.createContext(windowMock);
  ctx.document = {
    getElementById: getEl,
    body: { style: {}, classList: { add: function() {}, remove: function() {}, contains: function() { return false; } } },
    addEventListener: function() {}
  };

  load('js/data/holidays.js', ctx);
  load('js/utils/icons.js', ctx);
  load('js/utils/securityUtils.js', ctx);
  load('js/utils/dateUtils.js', ctx);
  load('js/utils/planningRules.js', ctx);
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
    clearBoundaryCache: function() {},
    DEFAULT_BUDGET_SETTINGS: { annualTarget: 0, defaultStandardHoursPerShift: 8 },
    generateOperationalDigest: function() { return { slots: [] }; }
  };
  ctx.window.HortOpsHeader = {
    updateStorageHealthIndicator: function() {}
  };

  return {
    ctx: ctx,
    app: app,
    driver: ctx.window.HortOpsStorageDriver,
    storage: ctx.window.HortOpsStorage,
    sessionStorage: sessionStorageMock,
    resetModal: ctx.window.HortOpsResetWorkspaceModal,
    healthModal: ctx.window.HortOpsStorageHealthModal,
    quarantineModal: ctx.window.HortOpsQuarantineViewerModal,
    wasReloaded: function() { return reloaded; },
    getEl: getEl
  };
}

const suites = [
  // --- 1. R37 BASELINE PROBES (MUST REMAIN EXACT & PASSING) ---
  ['R37-P1: Failed reset must not report success or clear live state', () => {
    const ls = mockStorage(
      { 'hort_ops_workspace_v2': '{"jobs":[{"id":"synthetic"}]}', 'unrelated': 'keep' },
      k => k === 'hort_ops_workspace_v2'
    );
    const { app } = buildEnv(ls);
    app.state.jobs = [{ id: 'synthetic' }];
    const result = app.resetToCleanSlate();
    assert.notStrictEqual(result, true, 'A failed persistent wipe cannot return true');
    assert.strictEqual(app.state.jobs.length, 1, 'Retain live data when wipe fails');
    assert.ok(ls.getItem('hort_ops_workspace_v2'), 'Preserve evidence for retry');
    assert.strictEqual(ls.getItem('unrelated'), 'keep');
  }],

  ['R37-P2: Compaction deletion failures must be reported truthfully', () => {
    const ls = mockStorage(
      { 'hort_ops_custom_staff_v1': 'synthetic', 'unrelated': 'keep' },
      k => k === 'hort_ops_custom_staff_v1'
    );
    const { driver } = buildEnv(ls);
    const res = driver.compactStorage();
    assert.strictEqual(res.success, false, 'Partial compaction cannot claim success');
    assert.strictEqual(ls.getItem('hort_ops_custom_staff_v1'), 'synthetic');
  }],

  ['R37-P3: Persistence probe must clean up on read mismatch', () => {
    const ls = mockStorage({ 'unrelated': 'keep' });
    const oldGet = ls.getItem.bind(ls);
    ls.getItem = function(k) {
      if (k === '__hort_ops_persistence_probe__') return 'mismatch';
      return oldGet(k);
    };
    const { driver } = buildEnv(ls);
    const health = driver.getStorageHealth();
    assert.strictEqual(health.probeOk, false, 'Mismatch probe must report probeOk = false');
    assert.strictEqual(oldGet('__hort_ops_persistence_probe__'), null, 'Probe key must not linger after failure');
  }],

  // --- 2. REVIEW 38 ACCEPTANCE MATRIX (A01 - A06, A08 - A10) ---
  ['A01: Preflight read snapshot failure causes zero deletions and explicit failure', () => {
    const ls = mockStorage(
      { 'hort_ops_workspace_v2': '{"jobs":[{"id":"job1"}]}', 'unrelated': 'keep' },
      { failGet: (k) => k === 'hort_ops_workspace_v2' }
    );
    const { app, driver } = buildEnv(ls);
    app.state.jobs = [{ id: 'job1' }];

    const success = app.resetToCleanSlate();
    assert.strictEqual(success, false, 'Preflight read failure must abort reset');
    assert.strictEqual(ls._removeCallCount(), 0, 'Zero removeItem calls must occur when preflight fails');
    assert.strictEqual(app.state.jobs.length, 1, 'In-memory jobs must be preserved');
    assert.strictEqual(app.state.storageStatus, 'save_failed');
    assert.strictEqual(driver.lastResetResult.status, 'preflight_failed');
    assert.strictEqual(ls.getItem('unrelated'), 'keep');
  }],

  ['A02: First targeted removal failure halts and maintains durable state', () => {
    const ls = mockStorage(
      { 'hort_ops_workspace_v2': '{"jobs":[{"id":"job1"}]}', 'unrelated': 'keep' },
      { failRemove: (k, count) => count === 1 }
    );
    const { app, driver } = buildEnv(ls);
    app.state.jobs = [{ id: 'job1' }];

    const success = app.resetToCleanSlate();
    assert.strictEqual(success, false, 'First removal failure must return false');
    assert.strictEqual(driver.lastResetResult.rolledBack, true, 'Result must indicate rolledBack = true');
    assert.strictEqual(driver.lastResetResult.status, 'rolled_back');
    assert.ok(ls.getItem('hort_ops_workspace_v2'), 'Workspace key must remain intact');
    assert.strictEqual(ls.getItem('unrelated'), 'keep');
  }],

  ['A03: Nth-key deletion failure triggers compensating rollback and survives cold reload', () => {
    const initialWorkspaceJson = JSON.stringify({
      schemaVersion: 2,
      lastSaved: '2026-06-06T12:00:00Z',
      jobs: [
        { id: 'job-parks-1', name: 'Parks Main', category: 'Parks', frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-06-06', preferredDay: 'saturday', startTime: '08:00 PM', durationHours: 8, crewSize: 2, status: 'active' }
      ],
      roster: [
        { id: 'emp-b1-1', name: 'Alice Smith', role: 'Gardener', primaryTeam: 'Parks', status: 'active', isPlantOperator: false }
      ],
      assignments: {},
      rostering: { instructions: {}, provenance: {} },
      historicalSnapshots: {},
      permits: {},
      budgetSettings: { annualBudgetCap: 500000, contingencyPercent: 10 },
      uiState: { activeView: 'forward_planner', currentYear: 2026 }
    });

    const ls = mockStorage(
      {
        'hort_ops_workspace_v2': initialWorkspaceJson,
        'hort_ops_jobs_offline': '{"offlineJobs":["job-parks-1"]}',
        'hort_ops_custom_staff_v1': '["emp-b1-1"]',
        'unrelated': 'leave-alone'
      },
      // Fail on the 2nd key deletion call (after key 1 was already removed)
      (k, callCount) => callCount >= 2
    );

    const { app, driver } = buildEnv(ls);
    app.state.jobs = [{ id: 'job-parks-1' }];
    app.state.staffList = [{ id: 'emp-b1-1' }];

    const success = app.resetToCleanSlate();
    assert.strictEqual(success, false, 'Midway deletion failure must return false');
    assert.strictEqual(app.state.jobs.length, 1, 'Live in-memory jobs must be preserved');
    assert.strictEqual(app.state.staffList.length, 1, 'Live in-memory staff must be preserved');
    assert.strictEqual(app.state.storageStatus, 'save_failed', 'Storage status must indicate save_failed');

    // Verify Compensating Rollback postconditions (R38-01, Matrix A03)
    assert.strictEqual(driver.lastResetResult.rolledBack, true, 'Compensating rollback must succeed');
    assert.strictEqual(driver.lastResetResult.status, 'rolled_back');
    assert.strictEqual(driver.lastResetResult.restoredCount >= 1, true, 'At least 1 key was restored by rollback');
    assert.strictEqual(ls.getItem('hort_ops_workspace_v2'), initialWorkspaceJson, 'Workspace key restored identically');
    assert.strictEqual(ls.getItem('hort_ops_jobs_offline'), '{"offlineJobs":["job-parks-1"]}', 'Offline jobs key restored');
    assert.strictEqual(ls.getItem('hort_ops_custom_staff_v1'), '["emp-b1-1"]', 'Custom staff key restored');
    assert.strictEqual(ls.getItem('unrelated'), 'leave-alone', 'Third-party keys remain intact');

    // Simulate Cold Browser Reload: fresh environment bootstrapping from ls
    const reloadEnv = buildEnv(ls);
    reloadEnv.app.init();
    assert.strictEqual(reloadEnv.app.state.jobs.length, 1, 'Cold reload must successfully restore pre-reset jobs');
    assert.strictEqual(reloadEnv.app.state.jobs[0].id, 'job-parks-1');
    assert.strictEqual(reloadEnv.app.state.staffList.length, 1, 'Cold reload must restore pre-reset staff');
  }],

  ['A04: Multiple removal failures handled deterministically with explicit diagnostics', () => {
    const ls = mockStorage(
      {
        'hort_ops_workspace_v2': '{"jobs":[{"id":"j1"}]}',
        'hort_ops_jobs_offline': '["old"]',
        'hort_ops_budget_offline': '{"annualTarget":100}'
      },
      // Deny removal on all keys
      () => true
    );
    const { app, driver } = buildEnv(ls);
    const success = app.resetToCleanSlate();
    assert.strictEqual(success, false);
    assert.strictEqual(driver.lastResetResult.status, 'rolled_back');
    assert.strictEqual(driver.lastResetResult.deletedCount, 0, 'No keys successfully deleted');
  }],

  ['A05: Compensating rollback write failure stages emergency backup and blocks autosave', () => {
    const ls = mockStorage(
      {
        'hort_ops_workspace_v2': '{"jobs":[{"id":"critical-job"}]}',
        'hort_ops_jobs_offline': '["critical-offline"]'
      },
      {
        // Fail on removal of key #2
        failRemove: (k, callCount) => callCount >= 2,
        // Fail on setItem during rollback
        failSet: () => true
      }
    );
    const session = mockStorage({});
    const { app, driver } = buildEnv(ls, { sessionStorage: session });
    app.state.jobs = [{ id: 'critical-job' }];

    const success = app.resetToCleanSlate();
    assert.strictEqual(success, false, 'Reset must report failure');
    assert.strictEqual(driver.lastResetResult.rolledBack, false, 'Rollback must report failure');
    assert.strictEqual(driver.lastResetResult.status, 'partial_failure_unrecovered');

    // Emergency backup was staged in sessionStorage
    const emergencyJson = session.getItem('hort_ops_emergency_recovery_v2');
    assert.ok(emergencyJson, 'Emergency backup must be staged in sessionStorage');
    assert.ok(emergencyJson.indexOf('critical-job') !== -1, 'Emergency payload must contain pre-reset data');

    // Verify Autosave is locked out
    assert.strictEqual(app._autosaveBlocked, true, 'Autosave must be blocked to safeguard persistent storage');
    const saveRes = app.saveCurrentWorkspace();
    assert.strictEqual(saveRes, false, 'saveCurrentWorkspace must fail closed when autosave is blocked');
  }],

  ['A06: Verified clean reset wipes all owned keys, cleans staging, and leaves third-party data', () => {
    const ls = mockStorage({
      'hort_ops_workspace_v2': '{"schemaVersion":2,"jobs":[{"id":"j1"}]}',
      'hort_ops_workspace_v1': '{"legacy":true}',
      'hort_ops_jobs_offline': '["old"]',
      'hort_ops_custom_staff_v1': '["staff"]',
      '__hort_ops_persistence_probe__': '1',
      'unrelated_app_setting': 'preserve-me'
    });
    const session = mockStorage({ 'hort_ops_emergency_recovery_v2': 'old-staged' });
    const { app, driver } = buildEnv(ls, { sessionStorage: session });
    app.state.jobs = [{ id: 'j1' }];
    app.state.staffList = [{ id: 's1' }];
    app.state.historicalSnapshots = { '2026-W01': {} };

    const success = app.resetToCleanSlate();
    assert.strictEqual(success, true, 'Clean reset must return true');
    assert.strictEqual(driver.lastResetResult.status, 'success');
    assert.strictEqual(app.state.jobs.length, 0, 'Clean slate must have 0 jobs');
    assert.strictEqual(app.state.staffList.length, 0, 'Clean slate must have 0 staff');
    assert.strictEqual(app.state.currentYear, 2026, 'Clean slate currentYear must default to 2026');
    assert.strictEqual(Object.keys(app.state.historicalSnapshots).length, 0, 'Historical snapshots must be empty');

    // Durable storage postcondition
    assert.strictEqual(ls.getItem('hort_ops_workspace_v2'), null, 'Workspace key must be deleted');
    assert.strictEqual(ls.getItem('hort_ops_workspace_v1'), null, 'Legacy v1 key must be deleted');
    assert.strictEqual(ls.getItem('hort_ops_jobs_offline'), null, 'Offline jobs key must be deleted');
    assert.strictEqual(ls.getItem('__hort_ops_persistence_probe__'), null, 'Probe key must be deleted');
    assert.strictEqual(ls.getItem('unrelated_app_setting'), 'preserve-me', 'Unrelated keys must survive reset');
    assert.strictEqual(session.getItem('hort_ops_emergency_recovery_v2'), null, 'Emergency session staging must be cleared on success');
  }],

  ['A08: Confirmation input not exactly RESET rejects execution without destructive calls', () => {
    const ls = mockStorage({ 'hort_ops_workspace_v2': '{"jobs":[{"id":"safe"}]}' });
    const env = buildEnv(ls);
    env.resetModal.renderModal();

    const inputEl = env.getEl('input-confirm-reset');
    const btnConfirm = env.getEl('btn-confirm-destructive-reset');

    // Test rejection: lowercase 'reset'
    inputEl.value = 'reset';
    env.resetModal.handleInput('reset');
    assert.strictEqual(btnConfirm.disabled, true, 'Must reject lowercase "reset"');
    env.resetModal.executeReset();
    assert.strictEqual(ls._removeCallCount(), 0, 'No deletion call made on invalid token');
    assert.strictEqual(env.wasReloaded(), false, 'No reload on invalid token');

    // Test rejection: trailing space 'RESET '
    inputEl.value = 'RESET ';
    env.resetModal.handleInput('RESET ');
    assert.strictEqual(btnConfirm.disabled, true, 'Must reject trailing space');

    // Test rejection: prefix 'RESE'
    inputEl.value = 'RESE';
    env.resetModal.handleInput('RESE');
    assert.strictEqual(btnConfirm.disabled, true, 'Must reject prefix "RESE"');
  }],

  ['A09: Reset modal renders truthful rollback banner and suppresses reload on failure', () => {
    const ls = mockStorage(
      { 'hort_ops_workspace_v2': '{"jobs":[]}' },
      k => k === 'hort_ops_workspace_v2'
    );
    const env = buildEnv(ls);
    env.app.state.jobs = [{ id: 'preserved-data' }];

    env.resetModal.renderModal();
    const inputEl = env.getEl('input-confirm-reset');
    inputEl.value = 'RESET';

    env.resetModal.executeReset();

    // Verify reload was suppressed
    assert.strictEqual(env.wasReloaded(), false, 'window.location.reload() must NEVER be called on reset failure');
    assert.strictEqual(env.app.state.jobs.length, 1, 'In-memory jobs must be preserved');

    // Verify error banner is visible and conveys truthful rollback
    const errorBanner = env.getEl('reset-modal-error-banner');
    assert.strictEqual(errorBanner.style.display, 'block', 'Error banner must be shown in modal');
    assert.ok(errorBanner.innerHTML.indexOf('Reset Aborted') !== -1, 'Banner must explain rollback');
    assert.ok(errorBanner.textContent.indexOf('Compensating rollback') !== -1 || errorBanner.textContent.indexOf('survive a page reload') !== -1, 'Banner text must explain durability');
  }],

  // --- 3. STORAGE COMPACTION IDEMPOTENCY & KEY PROTECTION (T03) ---
  ['T03-A: Compaction idempotency on already clean workspace', () => {
    const ls = mockStorage({
      'hort_ops_workspace_v2': '{"clean":true}',
      'unrelated': 'safe'
    });
    const { driver } = buildEnv(ls);
    const res = driver.compactStorage();
    assert.strictEqual(res.success, true, 'Compaction on clean store must succeed');
    assert.strictEqual(res.prunedCount, 0, 'Pruned count must be 0');
    assert.strictEqual(res.reclaimedBytes, 0, 'Reclaimed bytes must be 0');
    assert.strictEqual(ls.getItem('hort_ops_workspace_v2'), '{"clean":true}', 'Active workspace must be untouched');
    assert.strictEqual(ls.getItem('unrelated'), 'safe', 'Third-party keys must be untouched');
  }],

  ['T03-B: Compaction prunes all allowlisted stale keys and leaves active data safe', () => {
    const ls = mockStorage({
      'hort_ops_workspace_v2': '{"active":true}',
      'hort_ops_workspace_v1': 'old-v1',
      'hort_ops_custom_staff_v1': 'old-staff',
      'hort_ops_custom_jobs_v1': 'old-jobs',
      'hort_ops_jobs_offline': 'old-offline',
      '__hort_ops_persistence_probe__': 'old-probe',
      '__hort_ops_probe_test__': 'temp-probe',
      'unrelated_key': 'untouched'
    });
    const { driver } = buildEnv(ls);
    const res = driver.compactStorage();
    assert.strictEqual(res.success, true, 'Compaction must succeed');
    assert.strictEqual(res.prunedCount, 6, 'All 6 stale keys must be pruned');
    assert.ok(res.reclaimedBytes > 0, 'Reclaimed bytes must be positive');
    assert.strictEqual(ls.getItem('hort_ops_workspace_v2'), '{"active":true}', 'Active workspace must survive');
    assert.strictEqual(ls.getItem('unrelated_key'), 'untouched', 'Unrelated key must survive');
  }],

  // --- 4. ACTIVE PROBE ROBUSTNESS & QUOTA RATIO BOUNDARY (T04) ---
  ['T04-A: Probe cleanup double-fault marks probeOk = false without throwing', () => {
    const ls = mockStorage({}, (k) => {
      if (k === '__hort_ops_persistence_probe__') throw new Error('Quota lock on remove');
    });
    const { driver } = buildEnv(ls);
    let health;
    assert.doesNotThrow(() => {
      health = driver.getStorageHealth();
    }, 'Storage health probe must not bubble cleanup error');
    assert.strictEqual(health.probeOk, false, 'Cleanup failure must invalidate probeOk');
    assert.strictEqual(health.status, 'failed', 'Status must be failed when probe fails');
  }],

  ['T04-B: Unrounded quota ratio boundary testing (> 80%)', () => {
    const targetBytesOver = 4194306;
    const charsOver = targetBytesOver / 2;
    const paddingOver = 'x'.repeat(charsOver - 10);
    const lsOver = mockStorage({ 'k123456789': paddingOver });
    const envOver = buildEnv(lsOver);
    const healthOver = envOver.driver.getStorageHealth();
    assert.strictEqual(healthOver.status, 'warning', 'Usage strictly > 80% must trigger warning');

    const targetBytesUnder = 4194300;
    const charsUnder = targetBytesUnder / 2;
    const paddingUnder = 'x'.repeat(charsUnder - 10);
    const lsUnder = mockStorage({ 'k123456789': paddingUnder });
    const envUnder = buildEnv(lsUnder);
    const healthUnder = envUnder.driver.getStorageHealth();
    assert.strictEqual(healthUnder.status, 'healthy', 'Usage <= 80% must report healthy');
  }],

  // --- 5. CORRUPT WORKSPACE QUARANTINE PAYLOAD EXTRACTION (T05 / A10) ---
  ['T05/A10: Quarantine payload extraction conserves corrupt bytes safely', () => {
    const rawCorrupt = '{"jobs": [{"id": unclosed_json';
    const ls = mockStorage({ 'hort_ops_workspace_v2': rawCorrupt });
    const { driver, quarantineModal } = buildEnv(ls);

    const payload = driver.getRawQuarantinePayload();
    assert.strictEqual(payload, rawCorrupt, 'Quarantine payload must preserve exact raw corrupt bytes');

    quarantineModal.open();
    assert.strictEqual(typeof quarantineModal.close, 'function');
    quarantineModal.close();
  }]
];

console.log('================================================================');
console.log(' STAGE 2 WORKSPACE MANAGEMENT & STORAGE HYGIENE CONTRACT SUITE');
console.log(' (PR23_02 / Review 38 Comprehensive Acceptance Matrix)');
console.log('================================================================\n');

let failed = 0;
for (let i = 0; i < suites.length; i++) {
  const [name, fn] = suites[i];
  try {
    fn();
    console.log(`[PASS] (${i + 1}/${suites.length}) ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] (${i + 1}/${suites.length}) ${name}`);
    console.error(`       Error: ${err.message}\n${err.stack}\n`);
  }
}

console.log('\n----------------------------------------------------------------');
console.log(`TOTAL: ${suites.length - failed} PASSED, ${failed} FAILED (of ${suites.length} contract assertions)`);
console.log('----------------------------------------------------------------\n');

if (failed > 0) {
  process.exit(1);
}
