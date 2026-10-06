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
      ['FIXED', 'Fixed Officer', 'Parks', 'FALSE'],
      ['ROTATE', 'Rotation Officer', 'Parks', 'TRUE'],
      ['SUB', 'Manual Substitute', 'Roads', 'FALSE'],
      ['HIGH', 'Higher Hours', 'Libraries', 'FALSE']
    ].map(([id, name, team, operator]) => ['EMP-MIX-' + id, name, id.toLowerCase() + '@example.test', 'Operations', team, 'Worker', operator, 'active'].join(',')).join('\n') + '\n';
    const parsed = HortOpsUserCsvParser.parseUserCsv(csv, []);
    const imported = HortOpsApp.importStaffMembers(parsed.staff);
    const job = HortOpsApp.saveJob({
      id: 'JOB-MIX', name: 'Bounded mixed planning', category: 'Parks',
      staffingSections: { teams: false, pools: false }, frequencyType: 'work_pattern',
      workPattern: { mode: 'weekly', startDate: '2026-12-05', endDate: '2026-12-26', days: [6], includePublicHolidays: false, excludedDates: [] },
      startTime: '06:00 AM', durationHours: 6, crewSize: 2, status: 'active', color: '#047857'
    });
    const absence = HortOpsApp._commitCanonicalProposal({ absences: [
      { id: 'ABS-MIX-FIXED', staffId: 'EMP-MIX-FIXED', startDate: '2026-12-12', endDate: '2026-12-12', type: 'annual_leave', notes: 'Approved leave' }
    ] });
    const hours = [['FIXED', 4], ['ROTATE', 8], ['SUB', 1], ['HIGH', 30]].map(([id, value]) => HortOpsApp.recordOvertimeHoursEvidence('EMP-MIX-' + id, {
      year: 2026, throughDate: '2026-10-05', hours: value, source: 'Operator-verified payroll statement'
    }).success);
    return { parsed: parsed.success, imported: imported.success, job: job.success, absence: absence.success, hours };
  });
  assert.deepEqual(setup, { parsed: true, imported: true, job: true, absence: true, hours: [true, true, true, true] });
  checked('Saved workforce, weekly job, future absence and verified overtime evidence established');

  await page.evaluate(() => {
    HortOpsStaffAssignModal.open('JOB-MIX@2026-12-05');
    HortOpsStaffAssignModal.addStaff('EMP-MIX-FIXED');
    HortOpsStaffAssignModal.addStaff('EMP-MIX-ROTATE');
    HortOpsStaffAssignModal.updateSlotMode('EMP-MIX-FIXED', 'fixed');
    HortOpsStaffAssignModal.updateSlotRepeat('EMP-MIX-FIXED', 3);
    HortOpsStaffAssignModal.updateSlotMode('EMP-MIX-ROTATE', 'rotation');
    HortOpsStaffAssignModal.updateSlotRepeat('EMP-MIX-ROTATE', 3);
  });
  const draft = await page.evaluate(() => HortOpsApp.getMixedPolicyPlanDraft('JOB-MIX@2026-12-05').model);
  assert.equal(draft.success, true);
  assert.equal(draft.policy.fixedIneligible, 'visible_conflict_with_approved_manual_substitute');
  assert.equal(draft.policy.scope, 'occurrence_count');
  assert.equal(draft.maxRepeat, 3);
  assert.deepEqual(draft.occurrences.map(row => row.date), ['2026-12-05', '2026-12-12', '2026-12-19']);
  assert.equal(draft.repairs.length, 1);
  assert.deepEqual(draft.repairs[0], {
    shiftId: 'JOB-MIX@2026-12-12', date: '2026-12-12', fixedStaffId: 'EMP-MIX-FIXED',
    staffId: 'EMP-MIX-SUB', slotId: 'SLOT-1', reason: 'STAFF_ABSENT', source: 'approved_manual_substitute'
  });
  assert(draft.occurrences[1].conflicts.some(item => item.action === 'fixed_ineligible_vacancy'));
  checked('Three-occurrence projection keeps fixed conflict visible and proposes lowest-hours eligible manual substitute');

  const protectedManual = await page.evaluate(() => {
    const c = HortOpsApp.getMixedPolicyPlanDraft('JOB-MIX@2026-12-05');
    c.state.customAssignments['JOB-MIX@2026-12-12'] = ['EMP-MIX-SUB'];
    c.state.assignments = c.state.customAssignments;
    c.state.rostering.provenance['JOB-MIX@2026-12-12:EMP-MIX-SUB'] = { source: 'manual', slotId: 'SLOT-1', appliedAt: '2026-10-06T00:00:00.000Z' };
    const target = c.allShifts.find(item => item.shiftId === 'JOB-MIX@2026-12-12');
    target.assignedStaffIds = ['EMP-MIX-SUB'];
    return HortOpsMixedPolicyPlan.build(c);
  });
  assert.equal(protectedManual.repairs.length, 0);
  assert(protectedManual.occurrences[1].assignedIds.includes('EMP-MIX-SUB'));
  assert(protectedManual.occurrences[1].conflicts.some(item => item.action === 'manual_assignment_preserved'));
  checked('Existing downstream manual assignment is protected and receives no replacement repair');

  const beforeOpen = await saved(page);
  await page.locator('[data-mixed-policy-open]').click();
  const planModal = page.locator('#mixed-policy-plan-modal-root .mixed-policy-plan-modal');
  await planModal.waitFor();
  assert.equal(await planModal.locator('[data-mixed-shift]').count(), 3);
  assert((await planModal.textContent()).toLowerCase().includes('later occurrences remain unstaffed'));
  assert.equal(await saved(page), beforeOpen);
  const reportDir = path.join(root, 'test_reports/stage4e'); fs.mkdirSync(reportDir, { recursive: true });
  await page.screenshot({ path: path.join(reportDir, 'mixed-policy-desktop.png') });
  await page.setViewportSize({ width: 375, height: 720 });
  await page.screenshot({ path: path.join(reportDir, 'mixed-policy-mobile.png') });
  await page.setViewportSize({ width: 1200, height: 760 });
  checked('Review modal explains bounded scope, conflicts, proposals and remains zero-write');

  await planModal.locator('[data-mixed-action="approve"]').click();
  assert.equal(await page.evaluate(() => HortOpsStaffAssignModal._mixedPolicyApproval.repairs.length), 1);
  assert.equal(await saved(page), beforeOpen);
  checked('Approval stages the exact manual repair without persisting');

  await page.evaluate(() => HortOpsStaffAssignModal.saveAllocation());
  await page.waitForFunction(() => !HortOpsStaffAssignModal.activeShiftId);
  const persisted = await page.evaluate(() => ({
    assignments: HortOpsApp.state.customAssignments,
    instructions: HortOpsApp.state.rostering.instructions,
    provenance: HortOpsApp.state.rostering.provenance,
    audit: HortOpsApp.state.lastRosteringAudit
  }));
  assert(persisted.assignments['JOB-MIX@2026-12-12'].includes('EMP-MIX-SUB'));
  assert.equal(persisted.provenance['JOB-MIX@2026-12-12:EMP-MIX-SUB'].source, 'manual');
  assert.equal(persisted.provenance['JOB-MIX@2026-12-12:EMP-MIX-SUB'].stage4eRepair, true);
  assert(Object.values(persisted.instructions).some(item => item.mode === 'fixed' && item.employeeId === 'EMP-MIX-FIXED' && item.repeatCount === 3));
  assert(Object.values(persisted.instructions).some(item => item.mode === 'rotation' && item.repeatCount === 3));
  assert(persisted.audit.some(item => item.action === 'fixed_ineligible_vacancy'));
  assert(persisted.audit.some(item => item.action === 'stage4e_manual_substitute'));
  assert.deepEqual(persisted.assignments['JOB-MIX@2026-12-26'] || [], []);
  checked('One atomic save preserves fixed and rotation instructions, records manual repair provenance and stops after count');

  await page.reload(); await ready(page);
  assert.equal(await page.evaluate(() => HortOpsApp.state.customAssignments['JOB-MIX@2026-12-12'].includes('EMP-MIX-SUB')), true);
  assert.deepEqual(await page.evaluate(() => HortOpsApp.state.customAssignments['JOB-MIX@2026-12-26'] || []), []);
  checked('Reload preserves approved repairs and leaves post-scope occurrence unstaffed');

  await page.evaluate(() => {
    HortOpsStaffAssignModal.open('JOB-MIX@2026-12-05');
    HortOpsStaffAssignModal.updateSlotRepeat('EMP-MIX-FIXED', 2);
  });
  const staleSignature = await page.evaluate(() => HortOpsApp.getMixedPolicyPlanSignature('JOB-MIX@2026-12-05'));
  await page.evaluate(() => HortOpsStaffAssignModal.updateSlotRepeat('EMP-MIX-FIXED', 3));
  assert.equal(await page.evaluate(sig => HortOpsStaffAssignModal.approveMixedPolicyPlan(sig).success, staleSignature), false);
  checked('Changed staged policy invalidates an older proposal');

  const peer = await context.newPage(); await peer.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await peer.waitForFunction(() => window.HortOpsWriterSession && HortOpsWriterSession.status().mode === 'read-only');
  const peerBytes = await saved(peer);
  const denied = await peer.evaluate(() => HortOpsMixedPolicyPlanModal.open('JOB-MIX@2026-12-05'));
  assert.equal(denied.success, false);
  assert.equal(await saved(peer), peerBytes);
  checked('Read-only peer cannot open or approve mixed-policy planning');

  assert.deepEqual(errors, []); assert.deepEqual(dialogs, []);
  fs.writeFileSync(path.join(reportDir, 'mixed-policy-results.json'), JSON.stringify({ passed: true, checks, errors, dialogs }, null, 2));
  console.log('MIXED POLICY PLANNING CHECKS PASSED: ' + checks.length);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
