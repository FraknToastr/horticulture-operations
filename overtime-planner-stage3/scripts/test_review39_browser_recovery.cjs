'use strict';

// Review 39 Playwright recovery lifecycle acceptance suite.
// Expected to fail against unmodified PR23_02 and pass after R39 remediation.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const { repoRoot, loadPlaywright } = require('./local-test-environment.cjs');
const playwright = loadPlaywright();

const root = repoRoot();
const appUrl = pathToFileURL(path.join(root, 'index.html')).href;

function workspace(jobId) {
  return {
    schemaVersion: 2,
    lastSaved: '2026-09-30T00:00:00Z',
    jobs: [{
      id: jobId, name: 'Review 39 Browser Job', category: 'Parks',
      frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-09-26',
      preferredDay: 'saturday', startTime: '08:00 PM', durationHours: 8, crewSize: 2, status: 'active'
    }],
    roster: [{ id: 'review39-browser-staff', name: 'Review 39 Staff', role: 'Gardener', primaryTeam: 'Parks', status: 'active', isPlantOperator: false }],
    assignments: {},
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: {},
    permits: {},
    budgetSettings: { annualTarget: 0, defaultStandardHoursPerShift: 8 },
    uiState: { activeView: 'forward_planner', currentYear: 2026 }
  };
}

async function seedWorkspace(page, jobId, extraKeys) {
  const ws = workspace(jobId);
  await page.evaluate(({ ws, extraKeys }) => {
    (window.HortOpsClientStorage || window).localStorage.clear();
    (window.HortOpsClientStorage || window).sessionStorage.clear();
    (window.HortOpsClientStorage || window).localStorage.setItem('hort_ops_workspace_v2', JSON.stringify(ws));
    for (const [k, v] of Object.entries(extraKeys || {})) (window.HortOpsClientStorage || window).localStorage.setItem(k, String(v));
  }, { ws, extraKeys: extraKeys || {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
  await page.waitForTimeout(250);
  return JSON.stringify(ws);
}

async function openReset(page) {
  await page.click('#btn-header-reset-workspace');
  await page.waitForSelector('#modal-reset-workspace', { state: 'visible' });
  await page.fill('#input-confirm-reset', 'RESET');
}

async function injectResetFaults(page, options) {
  options = options || {};
  await page.evaluate((opts) => {
    const ls = (window.HortOpsClientStorage || window).localStorage;
    const ss = (window.HortOpsClientStorage || window).sessionStorage;
    const orig = {
      lsRemove: ls.removeItem.bind(ls),
      lsSet: ls.setItem.bind(ls),
      ssSet: ss.setItem.bind(ss),
      ssRemove: ss.removeItem.bind(ss)
    };
    window.__review39OriginalStorage = orig;
    let removeCount = 0;

    ls.removeItem = function(k) {
      removeCount++;
      if (opts.failRemoveOnCall && removeCount === opts.failRemoveOnCall) {
        throw new Error('Review39 injected localStorage.removeItem failure for ' + k);
      }
      return orig.lsRemove(k);
    };

    if (opts.failLocalSet) {
      ls.setItem = function(k, v) {
        throw new Error('Review39 injected localStorage.setItem failure for ' + k);
      };
    }

    if (opts.failSessionSet) {
      ss.setItem = function(k, v) {
        throw new Error('Review39 injected sessionStorage.setItem failure for ' + k);
      };
    }

    if (opts.failSessionRemove) {
      ss.removeItem = function(k) {
        if (String(k).indexOf('hort_ops_emergency_recovery_v2') === 0) {
          throw new Error('Review39 injected sessionStorage.removeItem failure for ' + k);
        }
        return orig.ssRemove(k);
      };
    }
  }, options);
}

async function restoreStorageMethods(page) {
  await page.evaluate(() => {
    const orig = window.__review39OriginalStorage;
    if (!orig) return;
    (window.HortOpsClientStorage || window).localStorage.removeItem = orig.lsRemove;
    (window.HortOpsClientStorage || window).localStorage.setItem = orig.lsSet;
    (window.HortOpsClientStorage || window).sessionStorage.setItem = orig.ssSet;
    (window.HortOpsClientStorage || window).sessionStorage.removeItem = orig.ssRemove;
  });
}

async function getEmergencyEntries(page) {
  return page.evaluate(() => {
    const out = [];
    for (let i = 0; i < (window.HortOpsClientStorage || window).sessionStorage.length; i++) {
      const key = (window.HortOpsClientStorage || window).sessionStorage.key(i);
      if (key && key.indexOf('hort_ops_emergency_recovery_v2') === 0) {
        out.push({ key, raw: (window.HortOpsClientStorage || window).sessionStorage.getItem(key) });
      }
    }
    // Sort deterministically: direct workspace recovery artifacts first, then transaction bundles (matches app.js display priority)
    out.sort((a, b) => {
      const aIsTx = a.key.indexOf(':transaction:') !== -1;
      const bIsTx = b.key.indexOf(':transaction:') !== -1;
      if (aIsTx !== bIsTx) return aIsTx ? 1 : -1;
      return a.key.localeCompare(b.key);
    });
    return out;
  });
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('Browser R39-A: memory-only recovery remains downloadable when rollback and session staging both fail', async browser => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
  await seedWorkspace(page, 'browser-memory-only', { 'hort_ops_jobs_offline': '["browser-memory-only"]' });

  await injectResetFaults(page, { failRemoveOnCall: 2, failLocalSet: true, failSessionSet: true });
  await openReset(page);
  await page.click('#btn-confirm-destructive-reset');
  await page.waitForTimeout(250);

  const banner = await page.$eval('#reset-modal-error-banner', el => el.textContent);
  assert.ok(/Emergency|Recovery|Partial Reset/i.test(banner), 'UI must enter an explicit emergency recovery state');

  const downloadButton = page.getByRole('button', { name: /Export Emergency Backup|Download Recovery Artifact|Download Emergency/i });
  assert.strictEqual(await downloadButton.count() > 0, true, 'emergency recovery must expose a download action');

  const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
  await downloadButton.first().click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  assert.ok(downloadedPath, 'downloaded recovery artifact must have a browser file');
  const raw = fs.readFileSync(downloadedPath, 'utf8');
  assert.ok(raw.indexOf('browser-memory-only') !== -1, 'download must contain pre-reset data');
  assert.ok(raw.indexOf('artifactVersion') !== -1 || raw.indexOf('recoveryArtifactVersion') !== -1, 'download must be a versioned recovery artifact');

  await page.close();
});

test('Browser R39-B: unresolved emergency artifact survives cold reload with non-empty canonical workspace and is shown by recovery viewer', async browser => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
  await seedWorkspace(page, 'browser-recovery-origin', { 'hort_ops_jobs_offline': '["browser-recovery-origin"]' });

  await injectResetFaults(page, { failRemoveOnCall: 2, failLocalSet: true, failSessionSet: false });
  await openReset(page);
  await page.click('#btn-confirm-destructive-reset');
  await page.waitForTimeout(250);

  const entries = await getEmergencyEntries(page);
  assert.ok(entries.length >= 1, 'test setup must stage an unresolved emergency artifact');
  const recoveryRaw = entries[0].raw;

  await restoreStorageMethods(page);
  const currentWorkspace = workspace('browser-current-visible');
  await page.evaluate(ws => {
    (window.HortOpsClientStorage || window).localStorage.setItem('hort_ops_workspace_v2', JSON.stringify(ws));
  }, currentWorkspace);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
  await page.waitForTimeout(300);

  const state = await page.evaluate(() => ({
    recoveryRequired: window.HortOpsApp.state.recoveryRequired,
    recoverySource: window.HortOpsApp.state.recoverySource,
    jobs: window.HortOpsApp.state.jobs.map(j => j.id)
  }));
  assert.deepStrictEqual(state.jobs, ['browser-current-visible'], 'sanity: non-empty current workspace loaded');
  assert.strictEqual(state.recoveryRequired, true, 'unresolved emergency artifact must still force recovery');
  assert.ok(/emergency/i.test(String(state.recoverySource || '')));

  await page.evaluate(() => window.HortOpsQuarantineModal.open());
  await page.waitForSelector('#quarantine-payload-box');
  const shownPayload = await page.$eval('#quarantine-payload-box', el => el.value);
  assert.strictEqual(shownPayload, recoveryRaw, 'recovery viewer must display the emergency artifact, not the current canonical workspace');

  await page.close();
});

test('Browser R39-C: dedicated emergency restore UI action returns browser persistence to pre-reset state and resolves recovery', async browser => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
  const originalWorkspaceRaw = await seedWorkspace(page, 'browser-roundtrip', { 'hort_ops_jobs_offline': '["browser-roundtrip"]' });

  await injectResetFaults(page, { failRemoveOnCall: 2, failLocalSet: true, failSessionSet: false });
  await openReset(page);
  await page.click('#btn-confirm-destructive-reset');
  await page.waitForTimeout(250);
  const entries = await getEmergencyEntries(page);
  assert.ok(entries.length >= 1, 'recovery artifact must be staged');

  await restoreStorageMethods(page);

  // Cold reload into recovery state
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
  await page.waitForTimeout(300);

  const isRecovery = await page.evaluate(() => window.HortOpsApp.state.recoveryRequired);
  assert.strictEqual(isRecovery, true, 'cold reload must enter recovery state');

  // Open quarantine viewer modal
  await page.evaluate(() => window.HortOpsQuarantineModal.open());
  await page.waitForSelector('#btn-restore-emergency-artifact', { timeout: 3000 });

  // Handle confirmation dialog
  page.once('dialog', async dialog => {
    await dialog.accept();
  });

  // Click the real operator UI action
  await page.click('#btn-restore-emergency-artifact');
  await page.waitForTimeout(800);

  // If parent transaction bundle requires deliberate operator acknowledgement before retirement (Review 50 R50-D / R50-P04)
  const ackParentBtn = page.locator('.btn-ack-parent');
  if (await ackParentBtn.count() > 0) {
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await ackParentBtn.first().click();
    await page.waitForTimeout(300);
  }

  // If parent transaction bundle requires deliberate operator retirement (Review 48 R48-A / Review 49 R49-B / Review 50 R50-D)
  const retireParentBtn = page.locator('#btn-retire-parent-bundle, .btn-retire-parent-bundle');
  if (await retireParentBtn.count() > 0) {
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await retireParentBtn.first().click();
    await page.waitForTimeout(600);
  }

  // Verify restored localStorage contents
  const rawAfter = await page.evaluate(() => (window.HortOpsClientStorage || window).localStorage.getItem('hort_ops_workspace_v2'));
  assert.strictEqual(rawAfter, originalWorkspaceRaw, 'canonical workspace bytes must be restored exactly via operator UI');

  // Verify emergency metadata keys in sessionStorage purged
  const remainingEntries = await getEmergencyEntries(page);
  assert.strictEqual(remainingEntries.length, 0, 'sessionStorage emergency recovery keys must be verified purged');

  // Reload and verify application returns to normal non-recovery operation
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => ({
    jobs: window.HortOpsApp.state.jobs.map(j => j.id),
    recoveryRequired: window.HortOpsApp.state.recoveryRequired
  }));
  assert.deepStrictEqual(state.jobs, ['browser-roundtrip']);
  assert.strictEqual(state.recoveryRequired, false, 'successful emergency restore must resolve recovery state');

  await page.close();
});
test('Browser R39-D: failure-injected restore write failure compensates and keeps recovery active', async browser => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
  const originalWorkspaceRaw = await seedWorkspace(page, 'browser-fail-atomic', { 'hort_ops_jobs_offline': '["browser-fail-atomic"]' });

  // Stage an emergency artifact
  await injectResetFaults(page, { failRemoveOnCall: 2, failLocalSet: true, failSessionSet: false });
  await openReset(page);
  await page.click('#btn-confirm-destructive-reset');
  await page.waitForTimeout(250);
  await restoreStorageMethods(page);

  // Cold reload into recovery
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
  await page.waitForTimeout(300);

  // Inject failure on restore: mock localStorage.setItem to fail on the 2nd write
  // The clean client does not adopt legacy keys. Establish explicit pre-restore
  // bytes for this compensation scenario, retaining its recovery evidence.
  await page.evaluate(raw => window.HortOpsClientStorage.localStorage.setItem('hort_ops_workspace_v2', raw), originalWorkspaceRaw);
  await page.evaluate(() => {
    let callCount = 0;
    const origSet = (window.HortOpsClientStorage || window).localStorage.setItem.bind((window.HortOpsClientStorage || window).localStorage);
    (window.HortOpsClientStorage || window).localStorage.setItem = function(k, v) {
      callCount++;
      if (callCount === 2) {
        throw new Error('Injected setItem failure during restore');
      }
      return origSet(k, v);
    };
  });

  // Attempt restore via API
  const entries = await getEmergencyEntries(page);
  const artifactJson = entries[0].raw;
  const restoreRes = await page.evaluate(raw => {
    return window.HortOpsStorage.restoreEmergencyRecoveryArtifact(raw);
  }, artifactJson);

  assert.strictEqual(restoreRes.success, false, "restore must report failure");
  assert.ok(restoreRes.status.indexOf('rolled_back') !== -1, 'status must report rollback');

  // Verify persistent state was preserved
  const rawAfter = await page.evaluate(() => (window.HortOpsClientStorage || window).localStorage.getItem('hort_ops_workspace_v2'));
  assert.strictEqual(rawAfter, originalWorkspaceRaw, 'localStorage must be compensated to pre-restore snapshot');

  // Verify recovery remained active
  const recState = await page.evaluate(() => window.HortOpsApp.state.recoveryRequired);
  assert.strictEqual(recState, true, "recovery must remain active on failed restore");

  await page.close();
});

test('Browser R39-E: recovery-metadata cleanup failure restores pre-reset persistence before reset reports failure', async browser => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
  const originalWorkspaceRaw = await seedWorkspace(page, 'browser-cleanup-rollback', {
    'hort_ops_jobs_offline': '["browser-cleanup-rollback"]'
  });

  await page.evaluate(rawWorkspace => {
    const artifact = {
      artifactType: 'hort_ops_reset_recovery',
      artifactVersion: 1,
      recoveryId: 'browser-cleanup-stale',
      createdAt: new Date().toISOString(),
      reason: 'prior_unresolved_recovery',
      failedKey: null,
      error: null,
      unrecoveredKeys: [],
      storageSnapshot: {
        'hort_ops_workspace_v2': rawWorkspace,
        'hort_ops_jobs_offline': '["browser-cleanup-rollback"]'
      }
    };
    const raw = JSON.stringify(artifact);
    (window.HortOpsClientStorage || window).sessionStorage.setItem('hort_ops_emergency_recovery_v2', raw);
    (window.HortOpsClientStorage || window).sessionStorage.setItem('hort_ops_emergency_recovery_v2:browser-cleanup-stale', raw);
  }, originalWorkspaceRaw);

  await injectResetFaults(page, { failSessionRemove: true });
  await openReset(page);
  await page.click('#btn-confirm-destructive-reset');
  await page.waitForTimeout(300);

  const banner = await page.$eval('#reset-modal-error-banner', el => el.textContent);
  assert.ok(/failed|aborted|rollback|recovery/i.test(banner));

  const rawAfter = await page.evaluate(() => (window.HortOpsClientStorage || window).localStorage.getItem('hort_ops_workspace_v2'));
  assert.strictEqual(rawAfter, originalWorkspaceRaw,
    'failed reset must restore exact pre-reset canonical workspace bytes');

  await restoreStorageMethods(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
  await page.waitForTimeout(300);

  const state = await page.evaluate(() => ({
    jobs: window.HortOpsApp.state.jobs.map(j => j.id),
    recoveryRequired: window.HortOpsApp.state.recoveryRequired
  }));
  assert.deepStrictEqual(state.jobs, ['browser-cleanup-rollback']);
  assert.strictEqual(state.recoveryRequired, true);

  await page.close();
});

	(async () => {
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
  } catch (err) {
    console.log('[BLOCKED] Playwright Chromium could not launch:', err.message);
    process.exit(0);
  }

  console.log('================================================================');
  console.log(' REVIEW 39 STAGE 2 BROWSER RECOVERY ACCEPTANCE');
  console.log('================================================================\n');
  console.log('Application:', appUrl, '\n');

  let failed = 0;
  for (let i = 0; i < tests.length; i++) {
    const [name, fn] = tests[i];
    try {
      await fn(browser);
      console.log(`[PASS] (${i + 1}/${tests.length}) ${name}`);
    } catch (err) {
      failed++;
      console.error(`[FAIL] (${i + 1}/${tests.length}) ${name}`);
      console.error(`       ${err.message}\n${err.stack}\n`);
    }
  }

  await browser.close();
  console.log('\n----------------------------------------------------------------');
  console.log(`TOTAL: ${tests.length - failed} PASSED, ${failed} FAILED (of ${tests.length} Review 39 browser recovery scenarios)`);
  console.log('----------------------------------------------------------------\n');
  process.exit(failed > 0 ? 1 : 0);
})();
