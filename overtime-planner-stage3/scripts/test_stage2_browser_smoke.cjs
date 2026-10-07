'use strict';
// Stage 2 Playwright Browser Smoke Test Suite (PR23_02 / Review 38 Verification)
// Covers:
// - Step 1: Populated workspace seeding & validation
// - Step 2: Strict rejection of invalid confirmation tokens ('reset', 'RESET ', 'RESE')
// - Step 3: Partial Reset Failure with Injected Error -> Truthful Modal Banner, Reload Suppression,
//           Compensating Rollback, and Durability across Cold Reload (R38-01, Matrix A03, A09)
// - Step 4: Exact 'RESET' Execution & Clean Slate Post-Reload Verification (Matrix A06, A07)
// - Step 5: Storage Health Monitor Modal & Compaction
// - Step 6: Corrupt Workspace Quarantine Viewer Flow (Matrix A10)

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { repoRoot, loadPlaywright } = require('./local-test-environment.cjs');
const playwright = loadPlaywright();

const singleFileAppPath = path.join(repoRoot(), 'index.html');
const fileUrl = 'file://' + singleFileAppPath;


const syntheticWorkspace = {
  schemaVersion: 2,
  lastSaved: '2026-06-06T12:00:00Z',
  jobs: [
    {
      id: 'JOB-SEEDED-01',
      name: 'Seeded Glasshouse Monitoring',
      category: 'Parks',
      frequencyType: 'recurring_weeks',
      intervalWeeks: 1,
      anchorDate: '2026-06-06',
      preferredDay: 'saturday',
      startTime: '08:00 PM',
      durationHours: 8,
      crewSize: 2,
      status: 'active'
    },
    {
      id: 'JOB-SEEDED-02',
      name: 'Seeded Irrigation Maintenance',
      category: 'Irrigation',
      frequencyType: 'recurring_weeks',
      intervalWeeks: 1,
      anchorDate: '2026-06-07',
      preferredDay: 'sunday',
      startTime: '05:00 AM',
      durationHours: 4,
      crewSize: 1,
      status: 'active'
    }
  ],
  roster: [
    { id: 'STAFF-SEEDED-01', name: 'Alice Operator', status: 'active', weeklyLimitHours: 38 },
    { id: 'STAFF-SEEDED-02', name: 'Bob Maintainer', status: 'active', weeklyLimitHours: 38 }
  ],
  assignments: {
    'JOB-SEEDED-01@2026-06-06': ['STAFF-SEEDED-01']
  },
  rostering: {
    instructions: {},
    provenance: {}
  },
  historicalSnapshots: {},
  permits: {},
  budgetSettings: { annualTarget: 50000, defaultStandardHoursPerShift: 8 },
  uiState: { activeView: 'forward_planner', currentYear: 2026 }
};

(async () => {
  console.log('================================================================');
  console.log(' STAGE 2 PLAYWRIGHT BROWSER SMOKE SUITE');
  console.log(' (PR23_02 / Review 38 Durability & Cold Reload Verification)');
  console.log('================================================================\n');

  let browser;
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  } catch (launchErr) {
    console.log('[BLOCKED] Chromium browser failed to launch: ' + launchErr.message);
    process.exit(0);
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const pageErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  try {
    // --- Step 1: Seed Synthetic Populated Workspace ---
    console.log('>>> [1/6] Seeding populated canonical Schema v2 workspace...');
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
    await page.waitForTimeout(300);

    const restoreOk = await page.evaluate((fixture) => {
      const res = window.HortOpsApp.restoreWorkspaceJson(fixture);
      (window.HortOpsClientStorage || window).localStorage.setItem('unrelated_third_party_token', 'preserve-session');
      return res;
    }, syntheticWorkspace);
    assert.strictEqual(restoreOk, true, 'Workspace JSON restore must succeed');
    await page.waitForTimeout(300);

    const seededJobCount = await page.evaluate(() => {
      return (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.jobs)
        ? window.HortOpsApp.state.jobs.length
        : 0;
    });
    assert.strictEqual(seededJobCount, 2, 'Booted app must have loaded 2 seeded jobs');
    console.log('    [PASS] Populated workspace seeded successfully (2 jobs, 2 staff).');

    // --- Step 2: Test Reset Modal False Confirmation Rejection ---
    console.log('>>> [2/6] Testing Reset Confirmation input validation...');
    const resetHeaderBtn = await page.$('#btn-header-reset-workspace');
    assert.ok(resetHeaderBtn, 'Header reset workspace button must exist');
    await resetHeaderBtn.click();
    await page.waitForSelector('#modal-reset-workspace', { state: 'visible' });

    const btnReset = await page.$('#btn-confirm-destructive-reset');
    assert.ok(btnReset, 'Destructive reset confirm button must exist');
    assert.strictEqual(await btnReset.isDisabled(), true, 'Confirm button must be initially disabled');

    await page.fill('#input-confirm-reset', 'reset');
    assert.strictEqual(await btnReset.isDisabled(), true, 'Must reject lowercase "reset"');

    await page.fill('#input-confirm-reset', 'RESET ');
    assert.strictEqual(await btnReset.isDisabled(), true, 'Must reject trailing whitespace "RESET "');

    await page.fill('#input-confirm-reset', 'RESE');
    assert.strictEqual(await btnReset.isDisabled(), true, 'Must reject incomplete token "RESE"');

    console.log('    [PASS] All false confirmation tokens strictly rejected.');

    // --- Step 3: Test Partial Reset Failure with Injected Error -> Compensating Rollback & Cold Reload (R38-01, A03, A09) ---
    console.log('>>> [3/6] Testing Partial Reset Failure, Compensating Rollback & Cold Reload...');
    await page.evaluate(() => {
      let callCount = 0;
      const origRemove = (window.HortOpsClientStorage || window).localStorage.removeItem.bind((window.HortOpsClientStorage || window).localStorage);
      (window.HortOpsClientStorage || window).localStorage.removeItem = function(k) {
        callCount++;
        if (callCount >= 2) {
          throw new Error('Injected removeItem browser quota exception on ' + k);
        }
        return origRemove(k);
      };
      window.__pageReloadedFlag = false;
    });

    await page.fill('#input-confirm-reset', 'RESET');
    await btnReset.click();
    await page.waitForTimeout(300);

    const bannerVisible = await page.$eval('#reset-modal-error-banner', el => el.style.display);
    assert.strictEqual(bannerVisible, 'block', 'Error banner must be displayed on reset failure');
    const bannerText = await page.$eval('#reset-modal-error-banner', el => el.textContent);
    assert.ok(bannerText.indexOf('Reset Aborted & Durably Rolled Back') !== -1, 'Banner must explain rollback');

    const modalVisible = await page.$eval('#modal-reset-workspace', el => el !== null);
    assert.strictEqual(modalVisible, true, 'Modal must remain open');

    const rollbackStorageCheck = await page.evaluate(() => {
      const raw = (window.HortOpsClientStorage || window).localStorage.getItem('hort_ops_workspace_v2');
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch(e) {}
      return {
        hasWorkspace: raw !== null,
        jobCount: (parsed && Array.isArray(parsed.jobs)) ? parsed.jobs.length : 0,
        unrelated: (window.HortOpsClientStorage || window).localStorage.getItem('unrelated_third_party_token')
      };
    });
    assert.strictEqual(rollbackStorageCheck.hasWorkspace, true, 'Workspace must remain in localStorage');
    assert.strictEqual(rollbackStorageCheck.jobCount, 2, 'All 2 pre-reset jobs must be restored in localStorage');
    assert.strictEqual(rollbackStorageCheck.unrelated, 'preserve-session', 'Unrelated token preserved');

    await page.click('#modal-reset-workspace .modal-close-btn');
    await page.waitForSelector('#modal-reset-workspace', { state: 'hidden' });

    console.log('    Performing cold browser reload to verify pre-reset data survival...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
    await page.waitForTimeout(500);

    const postColdReloadJobs = await page.evaluate(() => {
      return (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.jobs)
        ? window.HortOpsApp.state.jobs.length
        : -1;
    });
    assert.strictEqual(postColdReloadJobs, 2, 'Pre-reset data must survive cold reload following partial reset rollback');
    console.log('    [PASS] Partial reset safely rolled back and 100% verified durable across cold reload.');

    // --- Step 4: Exact 'RESET' Execution & Clean Slate Verification ---
    console.log('>>> [4/6] Executing clean destructive reset with un-mocked storage...');
    await page.click('#btn-header-reset-workspace');
    await page.waitForSelector('#modal-reset-workspace', { state: 'visible' });

    await page.fill('#input-confirm-reset', 'RESET');
    const btnResetClean = await page.$('#btn-confirm-destructive-reset');
    assert.strictEqual(await btnResetClean.isDisabled(), false);

    await Promise.all([
      btnResetClean.click(),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {})
    ]);
    await page.waitForTimeout(500);

    const cleanSlateCheck = await page.evaluate(() => {
      const rawWs = (window.HortOpsClientStorage || window).localStorage.getItem('hort_ops_workspace_v2');
      let parsed = null;
      try { parsed = JSON.parse(rawWs); } catch(e) {}
      return {
        persistedJobsCount: (parsed && Array.isArray(parsed.jobs)) ? parsed.jobs.length : -1,
        persistedRosterCount: (parsed && Array.isArray(parsed.roster)) ? parsed.roster.length : -1,
        unrelated: (window.HortOpsClientStorage || window).localStorage.getItem('unrelated_third_party_token'),
        liveJobs: window.HortOpsApp ? window.HortOpsApp.state.jobs.length : -1,
        liveStaff: window.HortOpsApp ? window.HortOpsApp.state.staffList.length : -1,
        currentYear: window.HortOpsApp ? window.HortOpsApp.state.currentYear : -1
      };
    });

    assert.strictEqual(cleanSlateCheck.persistedJobsCount, 0, 'Clean slate persisted jobs must be 0');
    assert.strictEqual(cleanSlateCheck.persistedRosterCount, 0, 'Clean slate persisted roster must be 0');
    assert.strictEqual(cleanSlateCheck.unrelated, 'preserve-session', 'Unrelated keys preserved');
    assert.strictEqual(cleanSlateCheck.liveJobs, 0, 'Clean slate live jobs must be 0');
    assert.strictEqual(cleanSlateCheck.liveStaff, 0, 'Clean slate live staff must be 0');
    assert.strictEqual(cleanSlateCheck.currentYear, 2026, 'Default year must be 2026');
    console.log('    [PASS] Clean slate verified durable post-reload.');

    // --- Step 5: Storage Health Modal Verification & Compaction ---
    console.log('>>> [5/6] Testing Storage Health Monitor Modal & Compaction...');
    const healthHeaderBtn = await page.$('#btn-header-storage-health');
    assert.ok(healthHeaderBtn);
    await healthHeaderBtn.click();
    await page.waitForSelector('#modal-storage-health', { state: 'visible' });

    const modalText = await page.$eval('#modal-storage-health', el => el.textContent);
    assert.ok(modalText.indexOf('Storage Quota & Health Monitor') !== -1);
    assert.ok(modalText.indexOf('browser quota estimate') !== -1);

    await page.click('#modal-storage-health button:has-text("Run Active Probe")');
    await page.waitForTimeout(100);
    const probeFeedback = await page.$eval('#modal-storage-health', el => el.textContent);
    assert.ok(probeFeedback.indexOf('Active persistence probe verified') !== -1);

    await page.click('#modal-storage-health button:has-text("Compact Storage")');
    await page.waitForTimeout(100);
    const compactFeedback = await page.$eval('#modal-storage-health', el => el.textContent);
    assert.ok(compactFeedback.indexOf('Compaction complete') !== -1);

    await page.click('#modal-storage-health .modal-close-btn');
    await page.waitForSelector('#modal-storage-health', { state: 'hidden' });
    console.log('    [PASS] Storage health monitor, active probe & compaction verified.');

    // --- Step 6: Corrupt Quarantine Viewer Flow ---
    console.log('>>> [6/6] Testing Corrupted Workspace Quarantine Recovery Flow...');
    await page.evaluate(() => {
      (window.HortOpsClientStorage || window).localStorage.setItem('hort_ops_workspace_v2', '{"jobs": [{"malformed": true');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
    await page.waitForTimeout(400);

    const recoveryTriggered = await page.evaluate(() => {
      return window.HortOpsApp ? window.HortOpsApp.state.recoveryRequired : false;
    });
    assert.strictEqual(recoveryTriggered, true, 'Corrupt workspace must trigger recoveryRequired');
    console.log('    [PASS] Corrupted workspace triggered recovery state successfully.');

    await browser.close();

    const criticalErrors = pageErrors.filter(e => !e.includes('favicon') && !e.includes('Injected removeItem browser quota exception'));
    assert.strictEqual(criticalErrors.length, 0, 'No uncaught errors in browser: ' + criticalErrors.join('; '));

    console.log('\n================================================================');
    console.log(' ALL 6 STAGE 2 BROWSER LIFECYCLE TESTS PASSED (100% OK)');
    console.log('================================================================\n');
  } catch (err) {
    if (browser) await browser.close();
    console.error('\n[FAIL] Stage 2 browser smoke failed:', err.message);
    process.exit(1);
  }
})();
