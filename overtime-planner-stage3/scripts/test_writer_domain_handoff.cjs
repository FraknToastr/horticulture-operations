'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { repoRoot, loadPlaywright } = require('./local-test-environment.cjs');
const root = repoRoot(), key = 'hort_ops_workspace_v2_single_writer_v1';
const folder = path.join(root, 'test_reports/phase7');
fs.mkdirSync(folder, { recursive: true });
const checks = [], errors = [];
function pass(name) { checks.push(name); console.log('[PASS] ' + name); }
async function open(context, file) {
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root, file)).href);
  await page.waitForFunction(() => window.HortOpsWriterSession && !HortOpsWriterSession.status().pending &&
    HortOpsWriterSession.status().mode !== 'starting');
  return page;
}
async function snapshot(page) { return page.evaluate(key => localStorage.getItem(key), key); }
async function setup(page) {
  assert.equal(await page.evaluate(() => {
    const parsed = HortOpsUserCsvParser.parseUserCsv('ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\nDOMAIN-WORKER,Domain Worker,domain@example.test,Horticulture,Parks,Gardener,FALSE,active\n', []);
    const imported = HortOpsApp.importStaffMembers(parsed.staff);
    const qualified = HortOpsApp.updateStaffMember({ id: 'DOMAIN-WORKER',
      qualifications: [{ code: 'WHITE_CARD', status: 'active', issuedDate: '2025-01-01' }] });
    const job = HortOpsApp.saveJob({ id: 'DOMAIN-JOB', name: 'Domain Job', category: 'Parks',
      frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-10-10', preferredDay: 'saturday',
      startTime: '08:00 AM', durationHours: 2, crewSize: 1, status: 'active', color: '#10b981', requiredQualifications: ['WHITE_CARD'] });
    const absence = HortOpsApp.saveAbsenceAndRefusalData([{ id: 'DOMAIN-ABSENCE', staffId: 'DOMAIN-WORKER',
      type: 'rdo', startDate: '2026-10-10', endDate: '2026-10-10', notes: 'original leave' }], undefined,
      { baseAbsences: [] });
    const budget = HortOpsApp._commitCanonicalProposal({ budgetSettings: { ...HortOpsApp.state.budgetSettings, annualTarget: 1200 } });
    return imported.success && qualified.success && job.success && absence.success && budget.success;
  }), true);
}
async function stageAbsence(page, notes) {
  await page.evaluate(() => HortOpsStaffAbsenceModal.open('DOMAIN-WORKER'));
  await page.locator('[data-action="edit-absence"][data-id="DOMAIN-ABSENCE"]').click();
  await page.locator('#edit-absence-notes').fill(notes);
  await page.locator('button[onclick*="updateAbsence()"]').click();
}
function assertTarget(raw, domain) {
  const saved = JSON.parse(raw);
  assert.equal(saved.jobs.length, 1);
  assert.equal(saved.roster.length, 1);
  assert.equal(saved.absences.length, 1);
  assert.equal(saved.roster[0].qualifications[0].status, domain === 'qualification' ? 'suspended' : 'active');
  assert.equal(saved.absences[0].notes, domain === 'absence' ? 'second tab leave' : 'original leave');
  assert.equal(saved.budgetSettings.annualTarget, domain === 'budget' ? 4321 : 1200);
}
async function main() {
  const browser = await loadPlaywright().chromium.launch({ headless: true });
  const report = { browserVersion: browser.version(), checks, errors, cases: [], passed: false };
  try {
    for (const domain of ['qualification', 'absence', 'budget']) {
      const context = await browser.newContext();
      try {
        const first = await open(context, 'index.html');
        assert.equal(await first.evaluate(() => HortOpsWriterSession.canWrite()), true);
        await setup(first);
        const second = await open(context, 'dist/hort_ops_offline_planner.html');
        const third = await open(context, 'index.modular.html');
        assert.equal(await second.evaluate(() => HortOpsWriterSession.canWrite()), false);
        assert.equal(await third.evaluate(() => HortOpsWriterSession.canWrite()), false);
        await stageAbsence(first, 'stale first-tab leave');
        await first.evaluate(() => {
          HortOpsStaffQualificationModal.open('DOMAIN-WORKER');
          // Retain callbacks just as a pending UI action could retain them.
          window.phase7DelayedAbsenceSave = () => HortOpsStaffAbsenceModal.save();
          window.phase7DelayedQualificationSave = () => HortOpsStaffQualificationModal.save();
        });
        const old = await snapshot(first);
        // The modal overlay intentionally blocks background controls; invoke the
        // same public release boundary while testing open-form invalidation.
        await first.evaluate(() => HortOpsWriterSession.release());
        await first.waitForFunction(() => !HortOpsWriterSession.canWrite());
        assert.equal(await first.locator('#staff-absence-modal-root').textContent(), '');
        assert.equal(await first.locator('#staff-qualification-modal-root').textContent(), '');
        await second.locator('#workspace-ownership button').click();
        await second.waitForFunction(() => HortOpsWriterSession.canWrite());
        assert.equal(await snapshot(second), old);
        assert.equal(await first.evaluate(() => HortOpsWriterSession.canWrite()), false);
        assert.equal(await third.evaluate(() => HortOpsWriterSession.canWrite()), false);
        pass(domain + ': only the explicitly selected tab edits, with index/dist/modular storage shared');

        if (domain === 'qualification') {
          assert.equal(await second.evaluate(() => HortOpsApp.updateStaffMember({ id: 'DOMAIN-WORKER',
            qualifications: [{ ...HortOpsApp.state.staffList[0].qualifications[0], status: 'suspended' }] }).success), true);
        } else if (domain === 'absence') {
          await stageAbsence(second, 'second tab leave');
          await second.locator('button[onclick*="HortOpsStaffAbsenceModal.save()"]').click();
          await second.waitForFunction(() => document.getElementById('staff-absence-modal-root').textContent === '');
        } else {
          assert.equal(await second.evaluate(() => HortOpsApp._commitCanonicalProposal({ budgetSettings:
            { ...HortOpsApp.state.budgetSettings, annualTarget: 4321 } }).success), true);
        }
        const latest = await snapshot(second);
        assertTarget(latest, domain);
        const denied = await first.evaluate(({ old, key }) => {
          const stale = JSON.parse(old), before = JSON.stringify(HortOpsApp.state);
          const results = [
            HortOpsApp.saveAbsenceAndRefusalData(stale.absences.map(a => ({ ...a, notes: 'must not save' })),
              undefined, { baseAbsences: stale.absences }),
            HortOpsApp.updateStaffMember(stale.roster[0]),
            HortOpsApp._commitCanonicalProposal({ budgetSettings: stale.budgetSettings }),
            HortOpsStorage.saveWorkspace(stale),
            window.phase7DelayedAbsenceSave(), window.phase7DelayedQualificationSave()
          ];
          return { denied: results.every(r => r && r.success === false), unchanged: before === JSON.stringify(HortOpsApp.state),
            raw: localStorage.getItem(key) };
        }, { old, key });
        assert.deepEqual(denied, { denied: true, unchanged: true, raw: latest });
        assert.equal(await snapshot(third), latest);
        pass(domain + ': stale former-owner commands and callbacks cannot change records or saved bytes');

        await second.locator('#workspace-ownership button').click();
        await second.waitForFunction(() => !HortOpsWriterSession.canWrite());
        await first.locator('#workspace-ownership button').click();
        await first.waitForFunction(() => HortOpsWriterSession.canWrite());
        assert.deepEqual(await first.evaluate(() => ({ qualification: HortOpsApp.state.staffList[0].qualifications[0].status,
          notes: HortOpsApp.state.absences[0].notes, budget: HortOpsApp.state.budgetSettings.annualTarget })), {
          qualification: JSON.parse(latest).roster[0].qualifications[0].status,
          notes: JSON.parse(latest).absences[0].notes, budget: JSON.parse(latest).budgetSettings.annualTarget });
        await first.evaluate(() => { window.phase7DelayedAbsenceSave(); window.phase7DelayedQualificationSave(); });
        assert.equal(await snapshot(first), latest, 'Old form callbacks must be harmless after reacquisition');
        pass(domain + ': reacquisition reloads current domains and discarded form callbacks cannot restore old data');

        await stageAbsence(first, 'fresh owner leave');
        await first.locator('button[onclick*="HortOpsStaffAbsenceModal.save()"]').click();
        await first.waitForFunction(() => document.getElementById('staff-absence-modal-root').textContent === '');
        const fresh = await snapshot(first), actual = JSON.parse(fresh), previous = JSON.parse(latest);
        assert.equal(actual.absences[0].notes, 'fresh owner leave');
        assert.deepEqual(actual.roster, previous.roster);
        assert.deepEqual(actual.budgetSettings, previous.budgetSettings);
        assert.deepEqual(actual.jobs, previous.jobs);
        pass(domain + ': a fresh UI absence edit succeeds while preserving the other committed domains');
        await first.locator('#workspace-ownership button').click();
        await first.waitForFunction(() => !HortOpsWriterSession.canWrite());
        await third.locator('#workspace-ownership button').click();
        await third.waitForFunction(() => HortOpsWriterSession.canWrite());
        assert.equal(await snapshot(third), fresh);
        await third.reload();
        await third.waitForFunction(() => window.HortOpsWriterSession && HortOpsWriterSession.canWrite());
        assert.equal(await snapshot(third), fresh);
        assert.equal(await third.evaluate(() => HortOpsApp.state.absences[0].notes), 'fresh owner leave');
        pass(domain + ': a third client acquires and cold-reloads the latest records without replaying stale data');
        report.cases.push({ domain, successful: true });
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
    report.passed = true;
    console.log('DOMAIN HANDOFF CHECKS PASSED: ' + checks.length);
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(folder, 'domain-handoff-results.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
