'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { repoRoot, loadPlaywright } = require('./local-test-environment.cjs');

async function ready(page, today = '2026-10-10') {
  await page.waitForFunction(() => window.HortOpsWriterSession && HortOpsWriterSession.canWrite());
  await page.evaluate(date => { HortOpsDateUtils.getLocalDateKey = () => date; }, today);
}
async function fixture(page) {
  await page.goto(pathToFileURL(path.join(repoRoot(), 'index.html')).href);
  await ready(page, '2026-10-01');
  const setup = await page.evaluate(() => {
    const parsed = HortOpsUserCsvParser.parseUserCsv('ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\nEMP-RESET,Reset Worker,reset@example.test,Operations,Parks,Worker,FALSE,active\nEMP-OTHER,Other Worker,other@example.test,Operations,Parks,Worker,FALSE,active\n', []);
    const imported = HortOpsApp.importStaffMembers(parsed.staff);
    function save(id) {
      return HortOpsApp.saveJob({ id, name: id, category: 'Parks', primaryTeam: 'Parks', staffingSections: { teams: true, pools: true }, frequencyType: 'work_pattern', workPattern: { mode: 'weekly', startDate: '2026-01-01', days: [6, 0], includePublicHolidays: true, excludedDates: [] }, startTime: '06:00 AM', durationHours: 6, crewSize: 1, status: 'active', color: '#047857' });
    }
    const jobs = [save('JOB-RESET'), save('JOB-OTHER')];
    function allocate(jobId, employeeId, repeats) {
      HortOpsStaffAssignModal.open(jobId + '@2026-10-03');
      HortOpsStaffAssignModal.stagedAssignedStaffIds = [employeeId];
      HortOpsStaffAssignModal.stagedSlots = [{ slotId: 'SLOT-1', staffId: employeeId, mode: repeats > 1 ? 'fixed' : 'manual', repeatCount: repeats, isInherited: false, sourceDate: '2026-10-03' }];
      HortOpsStaffAssignModal.saveAllocation();
      return HortOpsStaffAssignModal.activeShiftId === null;
    }
    return { imported, jobs, allocated: [allocate('JOB-RESET', 'EMP-RESET', 5), allocate('JOB-OTHER', 'EMP-OTHER', 1)] };
  });
  assert.equal(setup.imported.success, true);
  setup.jobs.forEach(job => assert.equal(job.success, true, job.error));
  assert.deepEqual(setup.allocated, [true, true]);
  await ready(page);
  const prepared = await page.evaluate(() => {
    const permits = ['JOB-RESET@2026-10-03', 'JOB-RESET@2026-10-11', 'JOB-OTHER@2026-10-03'].map(id => HortOpsApp.updatePermit(id, { wztmNotes: 'Reset regression override' }));
    // Model an existing workspace with only a snapshot for one live allocation.
    const assignments = JSON.parse(JSON.stringify(HortOpsApp.state.customAssignments));
    delete assignments['JOB-RESET@2026-10-11'];
    const rostering = JSON.parse(JSON.stringify(HortOpsApp.state.rostering));
    delete rostering.provenance['JOB-RESET@2026-10-11:EMP-RESET'];
    const commit = HortOpsApp._commitCanonicalProposal({ assignments, rostering });
    HortOpsApp.recomputeDigest();
    return { permits, commit };
  });
  prepared.permits.forEach(result => assert.equal(result.success, true, result.error));
  assert.equal(prepared.commit.success, true, prepared.commit.error);
  return page.evaluate(() => ({
    snapshots: JSON.stringify(HortOpsApp.state.historicalSnapshots),
    jobs: JSON.stringify(HortOpsApp.state.jobs), roster: JSON.stringify(HortOpsApp.state.staffList),
    other: JSON.stringify(HortOpsApp.state.customAssignments['JOB-OTHER@2026-10-03'])
  }));
}
async function check(page, before, scope) {
  const actual = await page.evaluate(() => ({
    snapshots: JSON.stringify(HortOpsApp.state.historicalSnapshots), jobs: JSON.stringify(HortOpsApp.state.jobs),
    roster: JSON.stringify(HortOpsApp.state.staffList), other: JSON.stringify(HortOpsApp.state.customAssignments['JOB-OTHER@2026-10-03']),
    shifts: HortOpsApp.state.allShifts.filter(s => s.jobId === 'JOB-RESET').map(s => ({ date: s.date, crew: s.assignedStaffIds })),
    instructions: HortOpsApp.state.rostering.instructions,
    provenance: HortOpsApp.state.rostering.provenance,
    permits: HortOpsApp.state.customPermits
  }));
  for (const key of ['snapshots', 'jobs', 'roster', 'other']) assert.equal(actual[key], before[key], key + ' must be preserved');
  for (const date of ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-10', '2026-10-11']) {
    assert.deepEqual(actual.shifts.find(s => s.date === date).crew, scope === 'current_and_future' && date < '2026-10-10' ? ['EMP-RESET'] : [], date);
  }
  const rules = Object.values(actual.instructions).filter(i => i.jobId === 'JOB-RESET');
  if (scope === 'all') assert.equal(rules.length, 0);
  else { assert.equal(rules.length, 1); assert.equal(rules[0].status, 'historical'); assert.equal(rules[0].repeatCount, 3); }
  for (const key of Object.keys(actual.provenance).filter(k => k.startsWith('JOB-RESET@'))) {
    assert.equal(scope, 'current_and_future');
    assert.ok(key.slice(10, 20) < '2026-10-10', key);
  }
  assert.ok(actual.permits['JOB-OTHER@2026-10-03']);
  assert.equal(!!actual.permits['JOB-RESET@2026-10-03'], scope === 'current_and_future');
  assert.equal(actual.permits['JOB-RESET@2026-10-11'], undefined);
}
(async () => {
  const browser = await loadPlaywright().chromium.launch({ headless: true });
  const errors = [], dialogs = [];
  try {
    for (const scope of ['current_and_future', 'all']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss(); });
      const before = await fixture(page);
      const preview = await page.evaluate(scope => HortOpsApp.getJobAllocationResetPreview('JOB-RESET', scope), scope);
      assert.equal(preview.assignments, scope === 'all' ? 5 : 2, 'Preview includes snapshot-only allocations');
      // Open the real registry row action; the detail action shares this modal.
      await page.evaluate(() => { HortOpsApp.state.activeView = 'job_manager'; HortOpsApp.renderCurrentView(); });
      const rowReset = page.locator('button[title="Reset allocations"][onclick*="JOB-RESET"]');
      assert.equal(await rowReset.count(), 1);
      await rowReset.click();
      assert.equal(await page.locator('#job-reset-confirm').isDisabled(), true);
      assert.deepEqual(await page.locator('#job-reset-confirm').evaluate(button => ({
        opacity: getComputedStyle(button).opacity,
        cursor: getComputedStyle(button).cursor,
        ariaDisabled: button.getAttribute('aria-disabled')
      })), { opacity: '0.5', cursor: 'not-allowed', ariaDisabled: 'true' });
      const bytes = await page.evaluate(() => localStorage.getItem(HortOpsClientStorage.workspaceKey));
      await page.locator('#job-reset-modal-root button').filter({ hasText: 'Cancel' }).click();
      assert.equal(await page.evaluate(() => localStorage.getItem(HortOpsClientStorage.workspaceKey)), bytes);
      if (scope === 'all') {
        await page.evaluate(() => HortOpsJobRegistry.selectJob('JOB-RESET'));
        await page.getByRole('button', { name: 'Reset allocations', exact: true }).click();
      } else await rowReset.click();
      if (scope === 'all') await page.locator('#job-reset-modal-root input[type="radio"]').nth(1).check();
      assert.match(await page.locator('#job-reset-modal-root').innerText(), /Snapshots retained/);
      await page.locator('#job-reset-confirmation').fill('RESET');
      await page.waitForFunction(() => {
        var button = document.getElementById('job-reset-confirm');
        return button && !button.disabled && getComputedStyle(button).opacity === '1';
      });
      assert.deepEqual(await page.locator('#job-reset-confirm').evaluate(button => ({
        disabled: button.disabled,
        opacity: getComputedStyle(button).opacity,
        cursor: getComputedStyle(button).cursor,
        ariaDisabled: button.getAttribute('aria-disabled')
      })), { disabled: false, opacity: '1', cursor: 'pointer', ariaDisabled: 'false' });
      await page.locator('#job-reset-confirm').click();
      assert.match(await page.locator('#job-reset-feedback').innerText(), /Reset complete/);
      await check(page, before, scope);
      await page.reload(); await ready(page);
      await check(page, before, scope);
      const repeated = await page.evaluate(scope => HortOpsApp.resetJobAllocations('JOB-RESET', scope), scope);
      assert.equal(repeated.success, true, repeated.error);
      assert.equal(repeated.counts.assignments, 0);
      await check(page, before, scope);
      console.log('PASS ' + scope + ': real allocations, spanning rule, retained snapshots, vacancies, reload and idempotence');
      await context.close();
    }
    const context = await browser.newContext(), page = await context.newPage();
    page.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss(); });
    await fixture(page);
    async function unchanged(action) {
      const outcome = await page.evaluate(action => {
        const domains = () => JSON.stringify(['jobs', 'staffList', 'customAssignments', 'customPermits', 'rostering', 'historicalSnapshots', 'absences', 'refusalHistory'].map(key => HortOpsApp.state[key]));
        if (action === 'validation') HortOpsApp.state.staffList[0].overtimeHoursEvidence = [{ invalid: true }];
        if (action === 'concurrent') {
          const envelope = JSON.parse(localStorage.getItem(HortOpsClientStorage.workspaceKey));
          envelope.permits['JOB-OTHER@2026-10-03'].wztmNotes = 'Concurrent writer modification';
          // Simulate a separate session, without updating this tab's baselines.
          localStorage.setItem(HortOpsClientStorage.workspaceKey, JSON.stringify(envelope));
        }
        const before = domains(), stored = localStorage.getItem(HortOpsClientStorage.workspaceKey);
        const save = HortOpsStorage.saveWorkspace;
        if (action === 'persistence') HortOpsStorage.saveWorkspace = () => ({ ok: false, error: 'Injected persistence failure' });
        const result = HortOpsApp.resetJobAllocations('JOB-RESET', 'all');
        HortOpsStorage.saveWorkspace = save;
        return { result, unchanged: before === domains(), storedUnchanged: stored === localStorage.getItem(HortOpsClientStorage.workspaceKey) };
      }, action);
      assert.equal(outcome.result.success, false, JSON.stringify(outcome));
      assert.equal(outcome.unchanged, true);
      assert.equal(outcome.storedUnchanged, true);
      console.log('PASS ' + action + ' failure preserves exact storage and domain state');
    }
    await unchanged('persistence');
    await unchanged('validation');
    await page.reload(); await ready(page);
    await unchanged('concurrent');
    await page.reload(); await ready(page);
    await page.evaluate(() => HortOpsWriterSession.release());
    const blocked = await page.evaluate(() => {
      const before = localStorage.getItem(HortOpsClientStorage.workspaceKey);
      const result = HortOpsApp.resetJobAllocations('JOB-RESET', 'all');
      return { result, unchanged: before === localStorage.getItem(HortOpsClientStorage.workspaceKey) };
    });
    assert.equal(blocked.result.success, false); assert.equal(blocked.unchanged, true);
    console.log('PASS released writer cannot reset');
    await context.close();
    assert.deepEqual(dialogs, []);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
