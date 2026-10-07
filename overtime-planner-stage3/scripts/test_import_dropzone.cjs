'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { repoRoot, loadPlaywright } = require('./local-test-environment.cjs');

(async function run() {
  const browser = await loadPlaywright().chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(pathToFileURL(path.join(repoRoot(), 'index.html')).href);
    await page.waitForFunction(() => window.HortOpsWriterSession && HortOpsWriterSession.canWrite());
    await page.evaluate(() => HortOpsApp.openImportModal());

    const zone = page.locator('#import-file-dropzone');
    assert.equal(await zone.count(), 1, 'import modal exposes an actual drop target');
    assert.equal(await zone.getAttribute('role'), 'button');
    assert.equal(await zone.getAttribute('tabindex'), '0');

    const initial = await zone.evaluate(element => ({
      border: getComputedStyle(element).borderColor,
      background: getComputedStyle(element).backgroundColor
    }));
    await page.evaluate(() => {
      const csv = [
        'ID,Name,Email,Department,Team,Role,IsPlantOperator,Status',
        'EMP-DROP,Drop Zone Worker,drop@example.test,Operations,Parks,Worker,FALSE,active'
      ].join('\n');
      const transfer = new DataTransfer();
      transfer.items.add(new File([csv], 'users.csv', { type: 'text/csv' }));
      const zone = document.getElementById('import-file-dropzone');
      zone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await page.waitForTimeout(150);
    const active = await zone.evaluate(element => ({
      border: getComputedStyle(element).borderColor,
      background: getComputedStyle(element).backgroundColor
    }));
    assert.notDeepEqual(active, initial, 'dragging provides a visible active state');
    await page.evaluate(() => {
      const csv = [
        'ID,Name,Email,Department,Team,Role,IsPlantOperator,Status',
        'EMP-DROP,Drop Zone Worker,drop@example.test,Operations,Parks,Worker,FALSE,active'
      ].join('\n');
      const transfer = new DataTransfer();
      transfer.items.add(new File([csv], 'users.csv', { type: 'text/csv' }));
      const zone = document.getElementById('import-file-dropzone');
      zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await page.waitForFunction(() => window.HortOpsImportModal.currentDiff !== null);
    const modalState = await page.evaluate(() => ({
      name: HortOpsImportModal.fileName,
      diff: HortOpsImportModal.currentDiff,
      json: HortOpsImportModal.isJsonMode
    }));
    assert.match(modalState.name, /^users\.csv \(/);
    assert.equal(modalState.json, false);
    assert.equal(modalState.diff.added.length, 1);

    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['not a valid file type'], 'users.txt', { type: 'text/plain' }));
      document.getElementById('import-file-dropzone').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await page.waitForFunction(() => /Choose a \.csv user table/.test(HortOpsImportModal.errorMessage));
    assert.match(await page.locator('#import-error-area').innerText(), /Choose a \.csv user table/);
    assert.deepEqual(errors, []);
    console.log('PASS: User Table drop zone accepts CSV files, gives drag feedback, and rejects unsupported files.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
