'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { loadPlaywright, repoRoot } = require('./local-test-environment.cjs');
const root = repoRoot(), playwright = loadPlaywright();
const key = 'hort_ops_workspace_v2_single_writer_v1';
const url = pathToFileURL(path.join(root, 'index.html')).href;
const folder = path.join(root, 'test_reports/phase5');
fs.mkdirSync(folder, { recursive: true });
const checks = [], errors = [];
function pass(name) { checks.push(name); console.log('[PASS] ' + name); }
async function ready(page) { await page.waitForFunction(() => window.HortOpsWriterSession && !HortOpsWriterSession.status().pending && HortOpsWriterSession.status().mode !== 'starting'); }
async function open(context, target = url) { const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); await page.goto(target); await ready(page); return page; }
async function main() {
  const template = fs.readFileSync(path.join(root, 'index.modular.html'), 'utf8');
  for (const inactive of ['js/data/initialJobs.js','js/data/staffRoster.js','js/data/historicalOccurrences.js','js/utils/storage/migrationEngine.js','js/utils/storage.js']) assert.equal(template.includes(inactive), false, inactive + ' must not be in the client graph');
  assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), fs.readFileSync(path.join(root, 'dist/hort_ops_offline_planner.html'), 'utf8'));
  pass('client source graph excludes sample/legacy loaders and standalone outputs match');
  const browser = await playwright.chromium.launch({ headless: true });
  const report = { checks, errors, releaseAccepted: false };
  report.browserVersion = browser.version();
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      localStorage.setItem('hort_ops_workspace_v2', '{"legacy":"preserve"}');
      localStorage.setItem('hort_ops_workspace_v1', '{"schemaVersion":1}');
      sessionStorage.setItem('hort_ops_emergency_recovery_v2', '{"old":"evidence"}');
    });
    const owner = await open(context);
    const clean = await owner.evaluate(() => ({ mode: HortOpsWriterSession.status().mode, jobs: HortOpsApp.state.jobs.length, staff: HortOpsApp.state.staffList.length, recovery: HortOpsApp.state.recoveryRequired, old: localStorage.getItem('hort_ops_workspace_v2'), oldEvidence: sessionStorage.getItem('hort_ops_emergency_recovery_v2'), migrate: typeof HortOpsStorage.migrateWorkspaceV1toV2 }));
    assert.deepEqual(clean, { mode: 'writer', jobs: 0, staff: 0, recovery: false, old: '{"legacy":"preserve"}', oldEvidence: '{"old":"evidence"}', migrate: 'undefined' });
    pass('clean start: empty registries, no legacy adoption, old data/evidence untouched');
    const blocker = await open(context, pathToFileURL(path.join(root, 'dist/hort_ops_offline_planner.html')).href);
    assert.equal(await blocker.evaluate(() => HortOpsWriterSession.status().mode), 'read-only');
    assert.equal(await blocker.locator('#btn-header-add-job').isDisabled(), true);
    pass('distribution and main file coordinate: second editor visibly read-only');
    const guarded = await blocker.evaluate(() => {
      const before = JSON.stringify(HortOpsApp.state);
      const results = [HortOpsApp.saveJob({ id: 'forbidden' }), HortOpsApp.saveCurrentWorkspace(), HortOpsStorage.saveWorkspace({ schemaVersion: 2 }), HortOpsStorage.set('hort_ops_test', 1), HortOpsStorage.remove('hort_ops_test'), HortOpsStorage.resetWorkspace(), HortOpsStorageDriver.set('hort_ops_test', 1), HortOpsStorageDriver.remove('hort_ops_test'), HortOpsStorageDriver.resetWorkspace()];
      let rawGuard = false; try { HortOpsClientStorage.localStorage.setItem('hort_ops_test', 'no'); } catch (_) { rawGuard = true; }
      return { results: results.map(r => r === false || (r && (r.success === false || r.ok === false))), unchanged: before === JSON.stringify(HortOpsApp.state), rawGuard };
    });
    assert.equal(guarded.results.every(Boolean), true); assert.equal(guarded.unchanged, true); assert.equal(guarded.rawGuard, true);
    pass('app, facade, driver and virtual-store writes denied without live-state changes');
    const populated = await owner.evaluate(() => {
      var csv = 'ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\nEMP-PHASE5,Fresh Worker,fresh@example.test,Horticulture,Parks,Gardener,FALSE,active\n';
      var parsed = HortOpsUserCsvParser.parseUserCsv(csv, []);
      var workforce = HortOpsApp.importStaffMembers(parsed.staff);
      var job = HortOpsApp.saveJob({ id: 'JOB-PHASE5', name: 'Client-created job', category: 'Parks', frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-10-10', preferredDay: 'saturday', startTime: '08:00 AM', durationHours: 2, crewSize: 1, status: 'active', color: '#10b981' });
      return { parsed: parsed.success, workforce: workforce.success, job: job.success, staff: HortOpsApp.state.staffList.length, jobs: HortOpsApp.state.jobs.length };
    });
    assert.deepEqual(populated, { parsed: true, workforce: true, job: true, staff: 1, jobs: 1 });
    pass('fresh User Table import and client-created Job persist through real app commands');
    const quota = await owner.evaluate(() => {
      const store = HortOpsClientStorage.localStorage, original = store.setItem;
      const before = store.getItem(HortOpsStorage.WORKSPACE_STORAGE_KEY), jobs = JSON.stringify(HortOpsApp.state.jobs);
      store.setItem = function(k, v) { if (k === HortOpsStorage.WORKSPACE_STORAGE_KEY) throw new Error('quota test'); return original.call(this, k, v); };
      const result = HortOpsApp.saveJob(Object.assign({}, HortOpsApp.state.jobs[0], {name:'unsaved change'}));
      store.setItem = original;
      return { success: result.success, bytes: before === store.getItem(HortOpsStorage.WORKSPACE_STORAGE_KEY), jobs: jobs === JSON.stringify(HortOpsApp.state.jobs) };
    });
    assert.deepEqual(quota, { success: false, bytes: true, jobs: true });
    pass('failed persistence reports failure and preserves saved bytes and job state');
    const frozen = await context.newCDPSession(owner);
    await frozen.send('Page.setWebLifecycleState', { state: 'frozen' });
    assert.equal(await blocker.evaluate(async () => { await HortOpsWriterSession.acquire(); return HortOpsWriterSession.canWrite(); }), false);
    await frozen.send('Page.setWebLifecycleState', { state: 'active' });
    assert.equal(await owner.evaluate(() => HortOpsWriterSession.canWrite()), true);
    pass('production frozen owner retains lock; second tab cannot take editing');
    assert.equal(await owner.evaluate(() => { HortOpsApp.state.budgetSettings.annualTarget = 3210; return HortOpsApp.saveCurrentWorkspace(); }), true);
    const saved = await owner.evaluate(key => localStorage.getItem(key), key);
    assert.equal(JSON.parse(saved).schemaVersion, 2);
    assert.equal(JSON.parse(saved).budgetSettings.annualTarget, 3210);
    await owner.evaluate(() => HortOpsWriterSession.release());
    assert.equal(await owner.evaluate(() => HortOpsApp.saveCurrentWorkspace()), false);
    await blocker.evaluate(() => HortOpsWriterSession.acquire());
    assert.equal(await blocker.evaluate(() => HortOpsApp.state.budgetSettings.annualTarget), 3210);
    assert.equal(await blocker.evaluate(() => HortOpsApp.state.jobs.length), 1);
    assert.equal(await blocker.evaluate(() => HortOpsApp.state.staffList.length), 1);
    pass('successful persistence and explicit handoff reload latest data; former owner cannot save');
    const rejected = await blocker.evaluate(() => [HortOpsStorage.prepareWorkspaceJsonImport('{"schemaVersion":1}').success, HortOpsApp.restoreWorkspaceJson({schemaVersion: 1})]);
    assert.deepEqual(rejected, [false, false]);
    assert.equal(await blocker.evaluate(key => localStorage.getItem(key), key), saved);
    pass('legacy schema import rejected without changing saved bytes');
    const backup = owner.waitForEvent('download');
    await owner.evaluate(() => HortOpsExportModal.exportBackupJson());
    // The read-only tab exports verified committed bytes without saving.
    const readOnlyBackup = await backup;
    const backupPath = path.join(folder, 'readonly-backup.json');
    await readOnlyBackup.saveAs(backupPath);
    assert.equal(fs.readFileSync(backupPath, 'utf8'), saved);
    assert.equal(await owner.evaluate(key => localStorage.getItem(key), key), saved);
    pass('read-only JSON backup exports verified current bytes without writing');
    await blocker.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    assert.equal(await blocker.evaluate(() => HortOpsWriterSession.canWrite()), false);
    await blocker.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted:true})));
    await ready(blocker);
    assert.equal(await blocker.evaluate(() => HortOpsApp.state.budgetSettings.annualTarget), 3210);
    pass('lifecycle departure blocks editing; persisted-page restoration reacquires and reloads');
    assert.equal(await blocker.evaluate(() => HortOpsApp.resetToCleanSlate()), true);
    const preserved = await blocker.evaluate(() => ({ old: localStorage.getItem('hort_ops_workspace_v2'), v1: localStorage.getItem('hort_ops_workspace_v1'), evidence: sessionStorage.getItem('hort_ops_emergency_recovery_v2'), jobs: HortOpsApp.state.jobs.length }));
    assert.deepEqual(preserved, { old: '{"legacy":"preserve"}', v1: '{"schemaVersion":1}', evidence: '{"old":"evidence"}', jobs: 0 });
    pass('reset stays inside new namespace and preserves historical keys/evidence');
    await blocker.close();
    await owner.evaluate(() => HortOpsWriterSession.acquire());
    assert.equal(await owner.evaluate(() => HortOpsWriterSession.canWrite()), true);
    pass('closing owner releases editing to a surviving tab');
    await context.close();
    for (const data of ['{"schemaVersion":1}', '{"schemaVersion":99}', '{broken']) {
      const c = await browser.newContext();
      await c.addInitScript(({ key, data }) => localStorage.setItem(key, data), { key, data });
      const p = await open(c);
      assert.equal(await p.evaluate(() => HortOpsApp.state.recoveryRequired), true);
      assert.equal(await p.evaluate(() => HortOpsApp.saveCurrentWorkspace()), false);
      assert.equal(await p.evaluate(key => localStorage.getItem(key), key), data);
      await c.close();
    }
    pass('Schema 1, future schema and corrupt current storage trigger recovery without overwrite');
    const unsupported = await browser.newContext();
    await unsupported.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
    const p = await open(unsupported);
    assert.equal(await p.evaluate(() => HortOpsWriterSession.canWrite()), false);
    assert.equal(await p.evaluate(() => HortOpsApp.saveCurrentWorkspace()), false);
    await unsupported.close();
    pass('unavailable browser coordination stays read-only');
    const quarantine = await browser.newContext();
    await quarantine.addInitScript(key => { localStorage.setItem(key, '{broken'); Object.defineProperty(navigator, 'locks', {value:undefined}); }, key);
    const q = await open(quarantine);
    await q.evaluate(() => HortOpsApp.openQuarantineModal());
    const exportButton = q.locator('button[onclick*="exportQuarantineFile"]');
    assert.equal(await exportButton.isEnabled(), true);
    const recoveryDownload = q.waitForEvent('download');
    await exportButton.click();
    await (await recoveryDownload).saveAs(path.join(folder, 'readonly-recovery.txt'));
    assert.equal(await q.evaluate(key => localStorage.getItem(key), key), '{broken');
    assert.equal(await q.evaluate(() => HortOpsWriterSession.canWrite()), false);
    await quarantine.close();
    pass('read-only recovery evidence remains exportable without modifying source data');
    const crashContext = await browser.newContext();
    const crashOwner = await open(crashContext), survivor = await open(crashContext);
    await crashOwner.evaluate(() => { HortOpsApp.state.budgetSettings.annualTarget = 777; HortOpsApp.saveCurrentWorkspace(); });
    const session = await crashContext.newCDPSession(crashOwner);
    const crashed = crashOwner.waitForEvent('crash', {timeout: 5000});
    session.send('Page.crash').catch(() => {});
    await crashed;
    for (let i = 0; i < 100; i++) {
      await survivor.evaluate(() => HortOpsWriterSession.acquire());
      if (await survivor.evaluate(() => HortOpsWriterSession.canWrite())) break;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.equal(await survivor.evaluate(() => HortOpsWriterSession.canWrite()), true);
    assert.equal(await survivor.evaluate(() => HortOpsApp.state.budgetSettings.annualTarget), 777);
    pass('real production renderer crash releases lock and surviving tab reloads saved data');
    await survivor.evaluate(async () => {
      await HortOpsWriterSession.release();
      const acquisition = HortOpsWriterSession.acquire();
      await HortOpsWriterSession.release();
      await acquisition;
    });
    assert.equal(await survivor.evaluate(() => HortOpsWriterSession.canWrite()), false);
    pass('cancelling a production acquisition prevents late writer activation');
    await crashContext.close();
    assert.deepEqual(errors, []);
    report.passed = true;
    console.log('APPLICATION WRITER CHECKS PASSED: ' + checks.length);
  } finally { await browser.close(); fs.writeFileSync(path.join(folder, 'writer-application-results.json'), JSON.stringify(report, null, 2) + '\n'); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
