'use strict';
// Stage 4D independent evidence-ledger and one-occurrence staging proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { repoRoot, loadPlaywright } = require('./local-test-environment.cjs');
const root = repoRoot(), checks = [], errors = [], dialogs = [];
const report = { passed: false, checks, errors, dialogs };
function checked(name) { checks.push(name); console.log('PASS: ' + name); }
function contracts() {
  const scope = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/utils/hoursEvidence.js'), 'utf8'), scope);
  const evidence = scope.window.HortOpsHoursEvidence;
  const record = { id: 'HOURS-CONTRACT', year: 2026, throughDate: '2026-10-05', hours: 0,
    source: 'Approved payroll statement', recordedAt: '2026-10-06T00:00:00.000Z', verification: 'operator_verified' };
  assert.equal(evidence.validate(undefined).valid, true); assert.equal(evidence.validate([record]).valid, true);
  checked('Absent ledger remains compatible and explicitly verified zero validates');
  for (const records of [null, {}, [record, record], [{ ...record, hours: -1 }], [{ ...record, hours: '0' }],
    [{ ...record, hours: Infinity }], [{ ...record, throughDate: '2026-02-30' }], [{ ...record, year: 2027 }],
    [{ ...record, verification: 'unverified' }], [{ ...record, source: '' }], [{ ...record, recordedAt: 'invalid' }],
    [{ ...record, id: 'EMP-WRONG' }], [{ ...record, unexpected: true }]]) {
    assert.equal(evidence.validate(records).valid, false, 'Invalid ledger ' + JSON.stringify(records));
  }
  assert.equal(evidence.validate([{ ...record, throughDate: '2026-10-07' }], { today: '2026-10-06' }).valid, false);
  checked('Ledger rejects malformed records, duplicate IDs, invalid evidence and future coverage');
  const older = { ...record, id: 'HOURS-OLD', hours: 2, recordedAt: '2026-10-05T00:00:00.000Z' };
  const latest = { ...record, id: 'HOURS-NEW', hours: 8 };
  assert.equal(evidence.latest([latest, older], 2026).id, latest.id); assert.equal(evidence.latest([older, latest], 2026).id, latest.id);
  assert.equal(evidence.latest([latest], 2027), null);
  checked('Latest verified evidence is deterministic by record time within the requested year');
}
async function ready(page) { await page.waitForFunction(() => window.HortOpsWriterSession && HortOpsWriterSession.canWrite()); }
async function source(page) { return page.evaluate(() => localStorage.getItem(HortOpsClientStorage.workspaceKey)); }
async function domains(page) { return page.evaluate(() => JSON.stringify(Object.fromEntries(['staffList', 'jobs', 'poolTags', 'allShifts', 'assignments', 'customAssignments', 'historicalSnapshots', 'rostering', 'refusalHistory', 'absences'].map(k => [k, HortOpsApp.state[k]])))); }
async function main() {
  contracts();
  const browser = await loadPlaywright().chromium.launch({ headless: true }); report.browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  try {
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.stack));
    page.on('dialog', d => { dialogs.push(d.message()); return d.dismiss(); });
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href); await ready(page);
    const setup = await page.evaluate(() => {
      const csv = 'ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\n' + [
        ['ZERO', 'Alpha Verified Zero', 'FALSE', 'active'], ['LOW', 'Bravo Low', 'FALSE', 'active'],
        ['HIGH', 'Charlie Operator High', 'TRUE', 'active'], ['UNKNOWN', 'Delta Imported Zero', 'FALSE', 'active'],
        ['BLOCKED', 'Echo Inactive', 'FALSE', 'inactive']
      ].map(([id, name, op, status]) => ['EMP-HOURS-' + id, name, id.toLowerCase() + '@example.test', 'Operations', 'Parks', 'Worker', op, status].join(',')).join('\n') + '\n';
      const parsed = HortOpsUserCsvParser.parseUserCsv(csv, []), imported = HortOpsApp.importStaffMembers(parsed.staff);
      const evidence = [['ZERO', 0], ['LOW', 2], ['HIGH', 40], ['BLOCKED', 1]].map(([id, hours]) =>
        HortOpsApp.recordOvertimeHoursEvidence('EMP-HOURS-' + id, { year: 2026, throughDate: '2026-10-05', hours, source: 'Payroll verified by operator <script>window.hoursInjected=1</script>' }));
      const job = HortOpsApp.saveJob({ id: 'JOB-HOURS', name: 'Evidence-based overtime allocation', category: 'Parks', primaryTeam: 'Parks',
        staffingSections: { teams: true, pools: true }, frequencyType: 'work_pattern',
        workPattern: { mode: 'weekly', startDate: '2026-01-01', days: [6, 0], includePublicHolidays: true, excludedDates: [] },
        startTime: '06:00 AM', durationHours: 6, crewSize: 2, status: 'active', color: '#047857' });
      return { parsed: parsed.success, imported: imported.success, evidence: evidence.map(r => r.success), job: job.success, error: job.error };
    });
    assert.equal(setup.parsed, true); assert.equal(setup.imported, true); assert.deepEqual(setup.evidence, [true, true, true, true]);
    assert.equal(setup.job, true, setup.error);
    checked('Real User Table and append command persist four verified ledgers while imported zero stays unsupported');
    const baseline = await source(page), baselineDomains = await domains(page), shiftId = 'JOB-HOURS@2026-12-25';
    const initial = await page.evaluate(id => HortOpsHoursAllocation.build({ ...HortOpsApp.getSavedCandidatePreviewContext(id), stagedIds: [], currentDate: '2026-10-06' }), shiftId);
    assert.deepEqual(initial.selectedIds, ['EMP-HOURS-ZERO', 'EMP-HOURS-LOW']);
    const row = id => initial.staffRows.find(s => s.id === 'EMP-HOURS-' + id);
    assert.equal(row('ZERO').actualHours, 0); assert.equal(row('ZERO').unknown, false);
    assert.equal(row('UNKNOWN').unknown, true); assert.equal(row('UNKNOWN').actualHours, null);
    assert(!initial.selectedIds.includes('EMP-HOURS-UNKNOWN')); assert.equal(row('BLOCKED').eligible, false);
    assert.equal(initial.policy.regularHoursIncluded, false);
    assert.equal(await source(page), baseline); assert.equal(await domains(page), baselineDomains);
    checked('Verified zero participates, imported default zero remains unknown, blocked staff stay excluded and regular hours are explicitly outside this model');
    const planned = await page.evaluate(id => {
      const c = HortOpsApp.getSavedCandidatePreviewContext(id), low = 'EMP-HOURS-LOW';
      const commitment = { ...c.occurrence, jobId: 'JOB-PLANNED', shiftId: 'JOB-PLANNED@2026-12-20', date: '2026-12-20', durationHours: 8, assignedStaffIds: [low, low] };
      const past = { ...commitment, shiftId: 'JOB-PAST@2026-01-01', date: '2026-01-01', durationHours: 100 };
      const nextYear = { ...commitment, shiftId: 'JOB-NEXT@2027-01-01', date: '2027-01-01', durationHours: 100 };
      const allShifts = [...c.allShifts, commitment, { ...commitment }, past, nextYear];
      const result = HortOpsHoursAllocation.build({ ...c, allShifts, stagedIds: [low], currentDate: '2026-10-06' });
      const lowRow = result.staffRows.find(s => s.id === low);
      return { result, lowRow };
    }, shiftId);
    assert.equal(planned.lowRow.actualHours, 2); assert.equal(planned.lowRow.plannedHours, 14);
    assert.equal(planned.lowRow.baseHours, 16); assert.equal(planned.lowRow.projectedHours, 16);
    assert(planned.result.stagedIds.includes('EMP-HOURS-LOW')); assert.equal(new Set(planned.result.stagedIds).size, planned.result.stagedIds.length);
    checked('Future overtime counts canonical staff/shift pairs once, excludes past and other-year work, and counts target staging once');
    const policies = await page.evaluate(id => {
      const c = HortOpsApp.getSavedCandidatePreviewContext(id);
      const refusals = Array.from({ length: 100 }, (_, i) => ({ id: 'REF-HOURS-' + i, staffId: 'EMP-HOURS-HIGH', date: '2026-10-01' }));
      const withRefusals = HortOpsHoursAllocation.build({ ...c, state: { ...c.state, refusalHistory: refusals }, stagedIds: [], currentDate: '2026-10-06' });
      const legacyScore = HortOpsAbsences.calculateFairShareScore({ id: 'EMP-HOURS-HIGH', ytdOvertimeHours: 40 }, { refusalHistory: refusals, asOfDate: c.occurrence.date });
      const legacyPlain = HortOpsAbsences.calculateFairShareScore({ id: 'EMP-HOURS-HIGH', ytdOvertimeHours: 40 }, { refusalHistory: [], asOfDate: c.occurrence.date });
      const job = { ...c.job, plantOperatorRequired: true };
      const operator = HortOpsHoursAllocation.build({ ...c, job, occurrence: { ...c.occurrence, plantOperatorRequired: true }, stagedIds: [], currentDate: '2026-10-06' });
      const missingEvidence = HortOpsHoursAllocation.build({ ...c, stagedIds: ['EMP-HOURS-UNKNOWN'], currentDate: '2026-10-06' });
      const overlap = c.state.staffList.map(s => ({ ...c.occurrence, jobId: 'JOB-OTHER-' + s.id, shiftId: 'JOB-OTHER-' + s.id + '@2026-12-25', assignedStaffIds: [s.id] }));
      const safety = HortOpsHoursAllocation.build({ ...c, allShifts: overlap, stagedIds: [], currentDate: '2026-10-06' });
      const qualified = HortOpsHoursAllocation.build({ ...c, job: { ...c.job, requiredQualifications: ['WHITE_CARD'] }, stagedIds: [], currentDate: '2026-10-06' });
      return { withRefusals, legacyScore, legacyPlain, operator, missingEvidence, safety, qualified };
    }, shiftId);
    assert.deepEqual(policies.withRefusals.selectedIds, initial.selectedIds); assert(policies.legacyScore > policies.legacyPlain);
    assert(policies.operator.stagedIds.includes('EMP-HOURS-HIGH')); assert.equal(policies.operator.crewValidation.valid, true);
    assert.equal(policies.missingEvidence.selectedIds.length, 0); assert.equal(policies.missingEvidence.success, false);
    assert.equal(policies.safety.selectedIds.length, 0); assert.equal(policies.qualified.selectedIds.length, 0);
    assert.equal(await source(page), baseline); assert.equal(await domains(page), baselineDomains);
    checked('New hours policy suppresses refusal bonuses while legacy keeps them and canonical operator/overlap/qualification checks remain mandatory');
    const invalid = await page.evaluate(() => {
      const before = localStorage.getItem(HortOpsClientStorage.workspaceKey);
      const results = [
        HortOpsApp.recordOvertimeHoursEvidence('EMP-HOURS-LOW', { year: 2026, throughDate: '2027-01-01', hours: 2, source: 'Invalid year' }),
        HortOpsApp.recordOvertimeHoursEvidence('EMP-HOURS-LOW', { year: 2026, throughDate: '2026-10-05', hours: -1, source: 'Invalid hours' }),
        HortOpsApp.updateStaffMember({ id: 'EMP-HOURS-LOW', overtimeHoursEvidence: [] })
      ];
      return { results: results.map(r => r.success), unchanged: before === localStorage.getItem(HortOpsClientStorage.workspaceKey) };
    });
    assert.deepEqual(invalid.results, [false, false, false]); assert.equal(invalid.unchanged, true);
    checked('Invalid evidence and arbitrary ledger history overwrite fail without changing saved bytes');
    await page.evaluate(() => HortOpsHoursEvidenceModal.open('EMP-HOURS-LOW'));
    const evidenceModal = page.locator('#hours-evidence-modal-root');
    assert.equal(await evidenceModal.locator('script,img').count(), 0); assert.equal(await page.evaluate(() => window.hoursInjected || 0), 0);
    assert.match(await evidenceModal.innerText(), /<script>/);
    await evidenceModal.locator('#hours-evidence-through-date').fill('2026-10-05');
    await evidenceModal.locator('#hours-evidence-hours').fill('3');
    await evidenceModal.locator('#hours-evidence-source').fill('Corrected payroll source');
    await evidenceModal.locator('#hours-evidence-verified').check();
    await evidenceModal.locator('[data-hours-evidence-action="save"]').click();
    const ledger = await page.evaluate(() => HortOpsApp.state.staffList.find(s => s.id === 'EMP-HOURS-LOW').overtimeHoursEvidence);
    assert.equal(ledger.length, 2); assert.equal(ledger[0].hours, 2); assert.equal(ledger[1].hours, 3);
    assert.equal(ledger[1].verification, 'operator_verified'); assert.equal(ledger[1].source, 'Corrected payroll source');
    checked('Real evidence modal escapes provenance text and appends a corrected verified record without rewriting history');
    const importRoundtrip = await page.evaluate(() => {
      const before = JSON.stringify(HortOpsApp.state.staffList.find(s => s.id === 'EMP-HOURS-LOW').overtimeHoursEvidence);
      const csv = 'ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\n' + HortOpsApp.state.staffList.map(s => [s.id, s.name, s.email, s.department, s.team, s.role, s.isPlantOperator ? 'TRUE' : 'FALSE', s.status].join(',')).join('\n') + '\n';
      const parsed = HortOpsUserCsvParser.parseUserCsv(csv, HortOpsApp.state.staffList), imported = HortOpsApp.importStaffMembers(parsed.staff);
      return { success: imported.success, preserved: JSON.stringify(HortOpsApp.state.staffList.find(s => s.id === 'EMP-HOURS-LOW').overtimeHoursEvidence) === before };
    });
    assert.equal(importRoundtrip.success, true); assert.equal(importRoundtrip.preserved, true);
    const envelope = JSON.parse(await source(page)); await page.reload(); await ready(page);
    assert.deepEqual(await page.evaluate(() => HortOpsApp.state.staffList.find(s => s.id === 'EMP-HOURS-LOW').overtimeHoursEvidence), ledger);
    assert.deepEqual(envelope.roster.find(s => s.id === 'EMP-HOURS-LOW').overtimeHoursEvidence, ledger);
    checked('Matched workforce import, Schema v2 export bytes and reload preserve the complete evidence ledger');
    await page.evaluate(id => HortOpsStaffAssignModal.open(id), shiftId);
    const proposalBytes = await source(page), proposalDomains = await domains(page);
    await page.evaluate(id => HortOpsHoursAllocationModal.open(id), shiftId);
    const proposal = page.locator('#hours-allocation-modal-root');
    assert.match(await proposal.innerText(), /actual/i); assert.match(await proposal.innerText(), /planned/i);
    assert.match(await proposal.locator('[data-hours-staff="EMP-HOURS-UNKNOWN"]').innerText(), /unknown/i);
    assert.equal(await proposal.locator('#hours-allocation-reviewed').count(), 0);
    assert.equal(await proposal.locator('input[required]').count(), 0);
    assert.equal(await source(page), proposalBytes); assert.equal(await domains(page), proposalDomains);
    const folder = path.join(root, 'test_reports/stage4d'); fs.mkdirSync(folder, { recursive: true });
    await page.screenshot({ path: path.join(folder, 'hours-proposal-desktop.png') });
    await page.setViewportSize({ width: 390, height: 700 }); await page.screenshot({ path: path.join(folder, 'hours-proposal-mobile.png') });
    await page.setViewportSize({ width: 1200, height: 700 });
    checked('One saved-occurrence proposal explains actual/planned/projected/unknown hours without regular-hours entry or source writes');
    await proposal.locator('[data-hours-allocation-action="apply"]').click();
    const staged = await page.evaluate(() => HortOpsStaffAssignModal.stagedAssignedStaffIds);
    assert.deepEqual(staged, ['EMP-HOURS-ZERO', 'EMP-HOURS-LOW']);
    assert.equal(await source(page), proposalBytes); assert.equal(await domains(page), proposalDomains);
    checked('Explicit proposal application stages manual slots only and preserves live/saved domain records');
    await page.locator('button[onclick*="saveAllocation"]').click();
    assert.equal(await page.evaluate(() => !HortOpsStaffAssignModal.activeShiftId), true, JSON.stringify(dialogs));
    await page.reload(); await ready(page);
    assert.deepEqual(await page.evaluate(id => HortOpsApp.state.allShifts.find(s => s.shiftId === id).assignedStaffIds, shiftId), staged);
    assert.deepEqual(await page.evaluate(() => HortOpsApp.state.staffList.find(s => s.id === 'EMP-HOURS-LOW').overtimeHoursEvidence), ledger);
    checked('Existing canonical save/reload commits staged proposal while keeping evidence history intact');
    const staleJob = await page.evaluate(() => HortOpsApp.saveJob({ ...HortOpsApp.state.jobs.find(j => j.id === 'JOB-HOURS'), id: 'JOB-HOURS-STALE', name: 'Stale proposal service' }));
    assert.equal(staleJob.success, true, staleJob.error);
    const staleShift = 'JOB-HOURS-STALE@2026-12-26';
    await page.evaluate(id => { HortOpsStaffAssignModal.open(id); HortOpsHoursAllocationModal.open(id); }, staleShift);
    assert.equal(await page.evaluate(() => HortOpsApp.recordOvertimeHoursEvidence('EMP-HOURS-HIGH', { year: 2026, throughDate: '2026-10-05', hours: 41, source: 'Newer verified statement' }).success), true);
    const changedBytes = await source(page);
    await page.evaluate(() => HortOpsHoursAllocationModal.checkFreshness());
    assert.equal(await proposal.locator('.hours-allocation-stale').count(), 1);
    await page.evaluate(() => HortOpsHoursAllocationModal.apply());
    assert.deepEqual(await page.evaluate(() => HortOpsStaffAssignModal.stagedAssignedStaffIds), []); assert.equal(await source(page), changedBytes);
    await page.evaluate(() => { HortOpsHoursAllocationModal.close(); HortOpsStaffAssignModal.close(); });
    checked('Saved evidence changes invalidate older proposal application instead of staging stale choices');
    const peer = await context.newPage(); peer.on('pageerror', e => errors.push(e.stack)); peer.on('dialog', d => d.dismiss());
    await peer.goto(pathToFileURL(path.join(root, 'index.html')).href); await peer.waitForFunction(() => HortOpsWriterSession.status().mode === 'read-only');
    const peerBytes = await source(peer);
    const guard = await peer.evaluate(() => {
      const evidence = HortOpsApp.recordOvertimeHoursEvidence('EMP-HOURS-LOW', { year: 2026, throughDate: '2026-10-05', hours: 999, source: 'Forbidden peer' });
      const before = JSON.stringify(HortOpsStaffAssignModal.stagedAssignedStaffIds);
      const stage = HortOpsStaffAssignModal.applyHoursProposal('untrusted-signature');
      return { evidence, stage, unchanged: before === JSON.stringify(HortOpsStaffAssignModal.stagedAssignedStaffIds) };
    });
    assert.equal(guard.evidence.success, false); assert.equal(guard.stage.success, false); assert.equal(guard.unchanged, true); assert.equal(await source(page), peerBytes);
    checked('Readonly peer cannot append hours evidence or apply a staged hours proposal');
    await peer.close(); assert.deepEqual(errors, []); report.passed = true; console.log('HOURS ALLOCATION CHECKS PASSED: ' + checks.length);
  } finally {
    await context.close(); await browser.close();
    const folder = path.join(root, 'test_reports/stage4d'); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'hours-results.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
