'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { repoRoot, loadPlaywright } = require('./local-test-environment.cjs');

const root = repoRoot(), checks = [], errors = [], dialogs = [];
function checked(name) { checks.push(name); console.log('PASS: ' + name); }
async function ready(page) { await page.waitForFunction(() => window.HortOpsWriterSession && HortOpsWriterSession.canWrite()); }
async function saved(page) { return page.evaluate(() => localStorage.getItem(HortOpsClientStorage.workspaceKey)); }

(async () => {
  const browser = await loadPlaywright().chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 760 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.stack));
  page.on('dialog', dialog => { dialogs.push(dialog.message()); return dialog.dismiss(); });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await ready(page);

  const setup = await page.evaluate(() => {
    const csv = 'ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\n' + [
      ['AFFECTED', 'Affected Ranger', 'Parks'], ['LOW', 'Low Hours Ranger', 'Parks'], ['HIGH', 'High Hours Ranger', 'Parks']
    ].map(([id, name, team]) => ['EMP-4F-' + id, name, id.toLowerCase() + '@example.test', 'Operations', team, 'Worker', 'FALSE', 'active'].join(',')).join('\n') + '\n';
    const parsed = HortOpsUserCsvParser.parseUserCsv(csv, []);
    const imported = HortOpsApp.importStaffMembers(parsed.staff);
    const job = HortOpsApp.saveJob({ id: 'JOB-4F', name: 'Park Ranger Callout', category: 'Parks', staffingSections: { teams: false, pools: false }, frequencyType: 'work_pattern', workPattern: { mode: 'weekly', startDate: '2026-12-05', endDate: '2026-12-19', days: [6], includePublicHolidays: false, excludedDates: [] }, startTime: '06:00 AM', durationHours: 6, crewSize: 1, status: 'active', color: '#047857' });
    const evidence = [['AFFECTED', 4], ['LOW', 1], ['HIGH', 30]].map(([id, hours]) => HortOpsApp.recordOvertimeHoursEvidence('EMP-4F-' + id, { year: 2026, throughDate: '2026-10-05', hours, source: 'Stage 4F fixture' }));
    return { parsed: parsed.success, imported: imported.success, job: job.success, evidence: evidence.map(item => item.success) };
  });
  assert.equal(setup.parsed, true); assert.equal(setup.imported, true); assert.equal(setup.job, true); assert.deepEqual(setup.evidence, [true, true, true]);

  await page.evaluate(() => {
    HortOpsStaffAssignModal.open('JOB-4F@2026-12-05');
    HortOpsStaffAssignModal.addStaff('EMP-4F-AFFECTED');
    HortOpsStaffAssignModal.updateSlotMode('EMP-4F-AFFECTED', 'fixed');
    HortOpsStaffAssignModal.updateSlotRepeat('EMP-4F-AFFECTED', 3);
    HortOpsStaffAssignModal.saveAllocation();
  });
  await page.waitForFunction(() => !HortOpsStaffAssignModal.activeShiftId);
  assert.deepEqual(await page.evaluate(() => [
    HortOpsApp.state.customAssignments['JOB-4F@2026-12-05'],
    HortOpsApp.state.customAssignments['JOB-4F@2026-12-12'],
    HortOpsApp.state.customAssignments['JOB-4F@2026-12-19']
  ]), [['EMP-4F-AFFECTED'], ['EMP-4F-AFFECTED'], ['EMP-4F-AFFECTED']]);

  const draft = await page.evaluate(() => {
    HortOpsStaffAbsenceModal.open('EMP-4F-AFFECTED');
    HortOpsStaffAbsenceModal.workingAbsences.push({ id: 'ABS-4F', staffId: 'EMP-4F-AFFECTED', type: 'annual_leave', startDate: '2026-12-12', endDate: '2026-12-12', notes: 'Stage 4F' });
    return HortOpsApp.getAbsenceImpactDraft().model;
  });
  assert.equal(draft.success, true);
  assert.equal(draft.affected.length, 1);
  assert.equal(draft.affected[0].shiftId, 'JOB-4F@2026-12-12');
  assert.equal(draft.affected[0].assignmentType, 'Fixed');
  assert.equal(draft.affected[0].replacementId, 'EMP-4F-LOW');
  assert.equal(draft.policy.replacement, 'one_off_manual');
  assert.equal(draft.policy.regularHoursIncluded, false);
  checked('Changed absence range finds only its affected fixed occurrence and lowest-hours eligible replacement');

  const beforeReview = await saved(page);
  await page.evaluate(() => HortOpsStaffAbsenceModal.save());
  const modal = page.locator('#absence-impact-modal-root .absence-impact-modal');
  await modal.waitFor();
  assert.equal(await modal.locator('[data-absence-impact-shift]').count(), 1);
  assert.match(await modal.innerText(), /one-off manual/i);
  assert.match(await modal.innerText(), /Fixed/);
  assert.equal(await saved(page), beforeReview);
  checked('Impact preview is visible and performs zero writes');

  const stale = await page.evaluate(() => {
    const signature = HortOpsApp.getAbsenceImpactSignature();
    HortOpsStaffAbsenceModal.workingAbsences[HortOpsStaffAbsenceModal.workingAbsences.length - 1].notes = 'changed after review';
    const result = HortOpsApp.saveAbsenceImpactPlan(signature);
    HortOpsStaffAbsenceModal.workingAbsences[HortOpsStaffAbsenceModal.workingAbsences.length - 1].notes = 'Stage 4F';
    return result;
  });
  assert.equal(stale.success, false);
  assert.match(stale.error, /changed|Refresh/i);
  assert.equal(await saved(page), beforeReview);
  checked('Stale absence-impact approval is rejected without a write');

  await modal.locator('[data-absence-impact-action="refresh"]').click();
  await modal.locator('[data-absence-impact-action="approve"]').click();
  await page.waitForFunction(() => !HortOpsStaffAbsenceModal.activeStaff);
  const persisted = await page.evaluate(() => ({
    absences: HortOpsApp.state.absences,
    assignments: HortOpsApp.state.customAssignments,
    instructions: HortOpsApp.state.rostering.instructions,
    provenance: HortOpsApp.state.rostering.provenance,
    snapshots: HortOpsApp.state.historicalSnapshots,
    audit: HortOpsApp.state.lastRosteringAudit || []
  }));
  assert(persisted.absences.some(item => item.id === 'ABS-4F'));
  assert.deepEqual(persisted.assignments['JOB-4F@2026-12-12'], ['EMP-4F-LOW']);
  assert.deepEqual(persisted.assignments['JOB-4F@2026-12-05'], ['EMP-4F-AFFECTED']);
  assert.deepEqual(persisted.assignments['JOB-4F@2026-12-19'], ['EMP-4F-AFFECTED']);
  assert.equal(persisted.provenance['JOB-4F@2026-12-12:EMP-4F-LOW'].stage4fReplacement, true);
  assert.equal(persisted.provenance['JOB-4F@2026-12-12:EMP-4F-LOW'].replacementReason, 'approved_absence_replacement');
  assert.equal(persisted.provenance['JOB-4F@2026-12-12:EMP-4F-LOW'].replacedAssignmentEvidence.instructionId.length > 0, true);
  assert(Object.values(persisted.instructions).some(item => item.employeeId === 'EMP-4F-AFFECTED' && item.repeatCount === 3));
  assert.deepEqual(persisted.snapshots['JOB-4F@2026-12-12'].assignedStaffIds, ['EMP-4F-LOW']);
  assert(persisted.audit.some(item => item.action === 'stage4f_absence_replacement'));
  checked('Approval atomically saves the absence and one-off replacement while preserving later fixed scope and provenance');

  await page.reload(); await ready(page);
  assert.deepEqual(await page.evaluate(() => HortOpsApp.state.customAssignments['JOB-4F@2026-12-12']), ['EMP-4F-LOW']);
  assert(await page.evaluate(() => HortOpsApp.state.absences.some(item => item.id === 'ABS-4F')));
  checked('Absence and replacement survive reload');

  const shortage = await page.evaluate(() => {
    ['EMP-4F-LOW', 'EMP-4F-HIGH'].forEach(id => HortOpsApp.updateStaffMember({ id, isOvertimeExempt: true }));
    HortOpsStaffAbsenceModal.open('EMP-4F-AFFECTED');
    HortOpsStaffAbsenceModal.workingAbsences.push({ id: 'ABS-4F-SHORT', staffId: 'EMP-4F-AFFECTED', type: 'training', startDate: '2026-12-19', endDate: '2026-12-19', notes: 'No replacement available' });
    return HortOpsApp.getAbsenceImpactDraft().model;
  });
  assert.equal(shortage.shortages.length, 1);
  assert.equal(shortage.affected[0].replacementId, null);
  const beforeAbsenceOnly = await saved(page);
  await page.evaluate(() => HortOpsStaffAbsenceModal.save());
  await page.locator('#absence-impact-modal-root [data-absence-impact-action="absence-only"]').click();
  await page.waitForFunction(() => !HortOpsStaffAbsenceModal.activeStaff);
  assert.notEqual(await saved(page), beforeAbsenceOnly);
  assert.deepEqual(await page.evaluate(() => HortOpsApp.state.customAssignments['JOB-4F@2026-12-19']), ['EMP-4F-AFFECTED']);
  assert(await page.evaluate(() => HortOpsApp.state.absences.some(item => item.id === 'ABS-4F-SHORT')));
  checked('Unresolved shortage remains assigned as a visible conflict when operator saves the absence only');

  const peer = await context.newPage();
  await peer.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await peer.waitForFunction(() => window.HortOpsWriterSession && HortOpsWriterSession.status().mode === 'read-only');
  const peerBytes = await saved(peer);
  const denied = await peer.evaluate(() => HortOpsStaffAbsenceModal.open('EMP-4F-AFFECTED'));
  assert.equal(denied.success, false);
  assert.equal(await saved(peer), peerBytes);
  checked('Read-only peer cannot open the absence editor or impact workflow');

  assert.deepEqual(errors, []); assert.deepEqual(dialogs, []);
  const reportDir = path.join(root, 'test_reports/stage4f'); fs.mkdirSync(reportDir, { recursive: true });
  await page.setViewportSize({ width: 375, height: 720 });
  await page.evaluate(() => {
    HortOpsStaffAbsenceModal.open('EMP-4F-AFFECTED');
    HortOpsStaffAbsenceModal.workingAbsences.push({ id: 'ABS-4F-MOBILE', staffId: 'EMP-4F-AFFECTED', type: 'training', startDate: '2026-12-19', endDate: '2026-12-19', notes: '' });
    HortOpsStaffAbsenceModal.save();
  });
  await page.locator('#absence-impact-modal-root .absence-impact-modal').waitFor();
  await page.screenshot({ path: path.join(reportDir, 'absence-impact-mobile.png'), fullPage: true });
  fs.writeFileSync(path.join(reportDir, 'absence-impact-results.json'), JSON.stringify({ passed: true, checks, errors, dialogs }, null, 2));
  console.log('ABSENCE IMPACT PLANNING CHECKS PASSED: ' + checks.length);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
