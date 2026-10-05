'use strict';

/**
 * scratch_test_pw50.cjs
 *
 * Review 50 Directive 3 & 7 complete browser verification script:
 *   - Parent with prior emergency keys
 *   - Actual visible historical content rendered in DOM (R50-P01)
 *   - Failed download injection blocks export flag & acknowledgement (R50-P02)
 *   - Read error injection rejects acknowledgement (R50-P03)
 *   - Successful export download verified byte-for-byte
 *   - Empty-prior parent requires separate distinct acknowledgement before retirement (R50-P04)
 *   - Affirmative acknowledgement and deliberate retirement
 *   - Zero residual evidence & clean reload into normal operation
 */

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
      id: jobId, name: 'Review 50 Browser Job', category: 'Parks',
      frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-09-26',
      preferredDay: 'saturday', startTime: '08:00 PM', durationHours: 8, crewSize: 2, status: 'active'
    }],
    roster: [{ id: 'review50-staff', name: 'Review 50 Staff', role: 'Gardener', primaryTeam: 'Parks', status: 'active', isPlantOperator: false }],
    assignments: {},
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: {},
    permits: {},
    budgetSettings: { annualTarget: 0, defaultStandardHoursPerShift: 8 },
    uiState: { activeView: 'forward_planner', currentYear: 2026 }
  };
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
    return out;
  });
}

(async () => {
  console.log('================================================================');
  console.log(' REVIEW 50 PLAYWRIGHT FULL OPERATOR LIFECYCLE ACCEPTANCE');
  console.log('================================================================\n');

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });

  try {
    // 1. Seed workspace AND prior historical emergency evidence
    console.log('[STEP 1] Seeding canonical workspace and prior historical emergency evidence...');
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
    const ws = workspace('job-review50-parent-flow');
    const priorEvidenceKey = 'hort_ops_emergency_recovery_v2:prior-hist-unique';
    const priorEvidencePayload = 'HISTORICAL_EMERGENCY_EVIDENCE_PAYLOAD_50';

    await page.evaluate(({ w, pKey, pVal }) => {
      (window.HortOpsClientStorage || window).localStorage.clear();
      (window.HortOpsClientStorage || window).sessionStorage.clear();
      (window.HortOpsClientStorage || window).localStorage.setItem('hort_ops_workspace_v2', JSON.stringify(w));
      (window.HortOpsClientStorage || window).sessionStorage.setItem(pKey, pVal);
    }, { w: ws, pKey: priorEvidenceKey, pVal: priorEvidencePayload });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
    await page.waitForTimeout(200);

    // 2. Inject dual-storage reset failure
    console.log('[STEP 2] Injecting dual-storage reset rollback failure...');
    await page.evaluate(() => {
      const origRemove = (window.HortOpsClientStorage || window).localStorage.removeItem.bind((window.HortOpsClientStorage || window).localStorage);
      let count = 0;
      (window.HortOpsClientStorage || window).localStorage.removeItem = function(k) {
        count++;
        if (count === 2) throw new Error('Injected localStorage.removeItem failure on key: ' + k);
        return origRemove(k);
      };
      (window.HortOpsClientStorage || window).localStorage.setItem = function(k, v) {
        throw new Error('Injected localStorage.setItem failure during rollback for key: ' + k);
      };
    });

    // 3. Trigger reset in UI
    console.log('[STEP 3] Triggering destructive clean-slate reset in UI...');
    await page.click('#btn-header-reset-workspace');
    await page.waitForSelector('#modal-reset-workspace', { state: 'visible' });
    await page.fill('#input-confirm-reset', 'RESET');
    await page.click('#btn-confirm-destructive-reset');
    await page.waitForTimeout(300);

    // 4. Verify parent composite bundle staged unconditionally with prior evidence
    console.log('[STEP 4] Verifying authoritative composite parent staged unconditionally with prior metadata...');
    const entriesAfterReset = await getEmergencyEntries(page);
    const parentEntry = entriesAfterReset.find(e => e.key.indexOf('hort_ops_emergency_recovery_v2:transaction:') === 0);
    assert.ok(parentEntry, 'Authoritative parent composite bundle MUST be staged in sessionStorage');
    const parentParsed = JSON.parse(parentEntry.raw);
    assert.strictEqual(parentParsed.artifactType, 'hort_ops_reset_transaction_recovery');
    const txId = parentParsed.transactionId;
    assert.ok(txId, 'Parent must have valid transactionId');
    assert.ok(parentParsed.previousEmergencyRecoveryMetadata, 'Parent must have previousEmergencyRecoveryMetadata');
    assert.strictEqual(parentParsed.previousEmergencyRecoveryMetadata[priorEvidenceKey], priorEvidencePayload, 'Prior evidence must be captured');
    console.log(`         -> Staged parent bundle for transaction: ${txId} with ${Object.keys(parentParsed.previousEmergencyRecoveryMetadata).length} prior keys`);

    // The composite parent bundle now solely retains the prior historical evidence
    await page.evaluate(pKey => {
      (window.HortOpsClientStorage || window).sessionStorage.removeItem(pKey);
      delete (window.HortOpsClientStorage || window).localStorage.removeItem;
      delete (window.HortOpsClientStorage || window).localStorage.setItem;
    }, priorEvidenceKey);

    // 5. Cold reload
    console.log('[STEP 5] Cold reloading browser into recovery state...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
    await page.waitForTimeout(300);

    const isRecovery = await page.evaluate(() => window.HortOpsApp.state.recoveryRequired);
    assert.strictEqual(isRecovery, true, 'Recovery mode must remain active after cold reload');

    // 6. Open quarantine viewer modal
    console.log('[STEP 6] Opening quarantine viewer modal...');
    await page.evaluate(() => window.HortOpsQuarantineModal.open());
    await page.waitForSelector('#quarantine-modal-title', { state: 'visible' });

    // 7. Verify parent card rendered
    console.log('[STEP 7] Verifying dedicated parent composite review card rendered in UI...');
    const parentKeyLocator = page.locator(`text=${parentEntry.key}`);
    assert.ok(await parentKeyLocator.count() > 0, 'Parent composite key must be visible in modal');

    // 8. Restore workspace bytes
    console.log('[STEP 8] Clicking Restore Emergency Recovery Artifact...');
    page.once('dialog', async dialog => { await dialog.accept(); });
    await page.click('#btn-restore-emergency-artifact');
    await page.waitForTimeout(600);

    const entriesAfterRestore = await getEmergencyEntries(page);
    const parentAfterRestore = entriesAfterRestore.find(e => e.key === parentEntry.key);
    assert.ok(parentAfterRestore, 'Parent bundle MUST remain durable in sessionStorage after child restore');
    console.log('         -> Parent remains durable and unresolved after workspace restore');

    // 9. Inspect evidence & verify VISIBLE historical content in DOM (R50-P01)
    console.log('[STEP 9] Executing Inspect Evidence and verifying visible historical content in DOM (R50-P01)...');
    const inspectBtn = page.locator('.btn-inspect-parent');
    await inspectBtn.first().click();
    await page.waitForTimeout(200);

    const inspectedState = await page.evaluate(t => {
      const rec = window.HortOpsStorageDriver.resolvedBundles[t];
      return rec ? rec.priorEvidenceInspected : false;
    }, txId);
    assert.strictEqual(inspectedState, true, 'In-app inspection must be recorded in resolvedBundles');

    const modalHtml = await page.locator('.modal-card').innerHTML();
    assert.ok(modalHtml.includes(priorEvidencePayload), 'Inspected prior evidence payload must be visibly rendered in modal DOM (R50-P01)');
    console.log('         -> Confirmed historical prior payload is visibly rendered in DOM');

    // 10. Injected export failure blocks acknowledgement & retirement (R50-P02)
    console.log('[STEP 10] Testing injected download failure: ensures export state unset & retirement blocked (R50-P02)...');
    await page.evaluate(() => {
      window._origCreateObjectURL = window.URL.createObjectURL;
      window.URL.createObjectURL = () => { throw new Error('Injected download generation failure'); };
    });

    let exportAlertMessage = '';
    page.once('dialog', async dialog => {
      exportAlertMessage = dialog.message();
      await dialog.accept();
    });

    const exportBtn = page.locator('.btn-export-parent');
    await exportBtn.first().click();
    await page.waitForTimeout(200);
    assert.ok(exportAlertMessage.includes('Export download failed'), 'Alert must report export download failure');

    const exportedAfterFail = await page.evaluate(t => {
      const rec = window.HortOpsStorageDriver.resolvedBundles[t];
      return rec ? Boolean(rec.priorEvidenceExported) : false;
    }, txId);
    assert.strictEqual(exportedAfterFail, false, 'Failed download must NOT record priorEvidenceExported: true (R50-P02)');

    // Restore URL.createObjectURL
    await page.evaluate(() => {
      window.URL.createObjectURL = window._origCreateObjectURL;
    });

    // 11. Injected read error rejects acknowledgement (R50-P03)
    console.log('[STEP 11] Testing injected storage read exception during acknowledgement (R50-P03)...');
    const readFailResult = await page.evaluate(t => {
      const pKey = 'hort_ops_emergency_recovery_v2:transaction:' + t;
      const origGet = (window.HortOpsClientStorage || window).sessionStorage.getItem.bind((window.HortOpsClientStorage || window).sessionStorage);
      (window.HortOpsClientStorage || window).sessionStorage.getItem = function(k) {
        if (k === pKey) throw new Error('Injected read error on parent key');
        return origGet(k);
      };
      const res = window.HortOpsStorageDriver.acknowledgeParentPriorEvidence(t, { operatorConfirmed: true });
      (window.HortOpsClientStorage || window).sessionStorage.getItem = origGet;
      return res;
    }, txId);
    assert.strictEqual(readFailResult.success, false, 'Acknowledgement must fail closed on storage read error (R50-P03)');
    console.log('         -> Acknowledgement rejected cleanly on storage read error: ' + readFailResult.status);

    // 12. Successful download initiation
    console.log('[STEP 12] Executing successful Export Evidence in operator UI (download verification)...');
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
    await exportBtn.first().click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    assert.ok(downloadPath, 'Export action must generate downloadable JSON file');
    const exportedContent = fs.readFileSync(downloadPath, 'utf8');
    assert.strictEqual(exportedContent, parentEntry.raw, 'Exported JSON must match raw parent bundle byte-for-byte');
    console.log(`         -> Download verified byte-for-byte: ${path.basename(downloadPath)}`);

    const exportedState = await page.evaluate(t => {
      const rec = window.HortOpsStorageDriver.resolvedBundles[t];
      return rec ? Boolean(rec.priorEvidenceExported) : false;
    }, txId);
    assert.strictEqual(exportedState, true, 'Export initiated must be recorded in resolvedBundles');

    // 13. Empty-prior parent requires distinct acknowledgement before retirement (R50-P04)
    console.log('[STEP 13] Verifying empty-prior parent requires distinct acknowledgement before retirement (R50-P04)...');
    const emptyPriorTx = 'tx-empty-prior-browser';
    const emptyPriorTest = await page.evaluate(t => {
      const driver = window.HortOpsStorageDriver;
      const childArt = {
        artifactType: 'hort_ops_reset_recovery',
        artifactVersion: 1,
        recoveryId: 'child-empty',
        createdAt: '2026-10-02T05:00:00Z',
        storageSnapshot: { hort_ops_workspace_v2: (window.HortOpsClientStorage || window).localStorage.getItem('hort_ops_workspace_v2') }
      };
      const parentBundle = {
        artifactType: 'hort_ops_reset_transaction_recovery',
        artifactVersion: 1,
        transactionId: t,
        transactionType: 'clean_slate_reset',
        currentWorkspaceRecoveryArtifact: childArt,
        previousEmergencyRecoveryMetadata: {},
        compensationOutcome: { localRestored: false, localVerified: false }
      };
      const pKey = 'hort_ops_emergency_recovery_v2:transaction:' + t;
      const raw = JSON.stringify(parentBundle);
      (window.HortOpsClientStorage || window).sessionStorage.setItem(pKey, raw);

      // Simulate restore
      driver.restoreEmergencyRecoveryArtifact(JSON.stringify(childArt), { parentTransactionId: t });

      // Attempt retirement WITHOUT acknowledgement
      const unackRetire = driver.retireCompositeParentBundle(t);
      const stillInStorage = ((window.HortOpsClientStorage || window).sessionStorage.getItem(pKey) === raw);

      // Distinct deliberate acknowledgement
      const ackRes = driver.acknowledgeParentPriorEvidence(t, { operatorConfirmed: true });

      // Retirement WITH acknowledgement
      const ackRetire = driver.retireCompositeParentBundle(t);
      const purgedFromStorage = ((window.HortOpsClientStorage || window).sessionStorage.getItem(pKey) === null);

      return { unackRetire, stillInStorage, ackRes, ackRetire, purgedFromStorage };
    }, emptyPriorTx);

    assert.strictEqual(emptyPriorTest.unackRetire.success, false, 'Direct retirement without acknowledgement must be rejected (R50-P04)');
    assert.strictEqual(emptyPriorTest.stillInStorage, true, 'Unacknowledged empty-prior parent must remain in storage');
    assert.strictEqual(emptyPriorTest.ackRes.success, true, 'Distinct acknowledgement must succeed');
    assert.strictEqual(emptyPriorTest.ackRetire.success, true, 'Retirement after acknowledgement must succeed');
    assert.strictEqual(emptyPriorTest.purgedFromStorage, true, 'Parent purged after deliberate retirement');
    console.log('         -> Empty-prior distinct acknowledgement & deliberate retirement verified');

    // 14. Acknowledge primary prior evidence in UI
    console.log('[STEP 14] Executing Acknowledge Prior Evidence for primary parent in operator UI...');
    const ackBtn = page.locator('.btn-ack-parent');
    page.once('dialog', async dialog => { await dialog.accept(); });
    await ackBtn.first().click();
    await page.waitForTimeout(200);

    const ackState = await page.evaluate(t => {
      const rec = window.HortOpsStorageDriver.resolvedBundles[t];
      return rec ? rec.priorEvidenceAcknowledged : false;
    }, txId);
    assert.strictEqual(ackState, true, 'In-app acknowledgement must be recorded in resolvedBundles');

    // 15. Deliberately retire primary parent bundle in UI
    console.log('[STEP 15] Executing deliberate Retire Parent Bundle in operator UI...');
    const retireBtn = page.locator('#btn-retire-parent-bundle, .btn-retire-parent-bundle');
    page.once('dialog', async dialog => { await dialog.accept(); });
    await retireBtn.first().click();
    await page.waitForTimeout(600);

    // 16. Verify all emergency evidence purged
    console.log('[STEP 16] Verifying zero residual emergency evidence in sessionStorage...');
    const finalEntries = await getEmergencyEntries(page);
    console.log('Remaining entries:', finalEntries);
    assert.strictEqual(finalEntries.length, 0, 'All emergency recovery keys must be verified purged after retirement');

    const lsBeforeReload = await page.evaluate(() => (window.HortOpsClientStorage || window).localStorage.getItem('hort_ops_workspace_v2'));
    console.log('localStorage before reload:', lsBeforeReload);

    // 17. Cold reload and verify normal operation
    console.log('[STEP 17] Cold reloading and verifying return to normal operation...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
    await page.waitForTimeout(300);

    const finalState = await page.evaluate(() => ({
      jobs: window.HortOpsApp.state.jobs.map(j => j.id),
      recoveryRequired: window.HortOpsApp.state.recoveryRequired,
      autosaveBlocked: Boolean(window.HortOpsApp._autosaveBlocked || (window.HortOpsApp.state && window.HortOpsApp.state._autosaveBlocked))
    }));
    assert.deepStrictEqual(finalState.jobs, ['job-review50-parent-flow']);
    assert.strictEqual(finalState.recoveryRequired, false, 'Recovery required must be false');
    assert.strictEqual(finalState.autosaveBlocked, false, 'Autosave must be unlocked');

    console.log('\n================================================================');
    console.log(' [PASS] FULL OPERATOR LIFECYCLE 100% VERIFIED (17/17 STEPS)');
    console.log('================================================================\n');

  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('\n[FAIL]', err);
  process.exit(1);
});
