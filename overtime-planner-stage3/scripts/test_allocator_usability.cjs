'use strict';
// Independent, child-local allocator directory and staging workflow proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { repoRoot, loadPlaywright } = require('./local-test-environment.cjs');
const root = repoRoot(), checks = [], errors = [], dialogs = [];
const report = { passed: false, checks, errors, dialogs };
function checked(name) { checks.push(name); console.log('PASS: ' + name); }
async function ready(page) { await page.waitForFunction(() => window.HortOpsWriterSession && HortOpsWriterSession.canWrite()); }
async function source(page) { return page.evaluate(() => localStorage.getItem(HortOpsClientStorage.workspaceKey)); }
async function domains(page) { return page.evaluate(() => JSON.stringify(Object.fromEntries(['staffList', 'jobs', 'poolTags', 'allShifts', 'assignments', 'customAssignments', 'historicalSnapshots', 'rostering', 'absences', 'refusalHistory'].map(k => [k, HortOpsApp.state[k]])))); }
async function resolve(page, options = {}) {
  return page.evaluate(options => {
    const c = HortOpsApp.getSavedCandidatePreviewContext('JOB-ALLOCATOR@2026-12-25');
    const job = { ...c.job, ...(options.job || {}) };
    return HortOpsStaffAssignCandidateModel.resolveAllocatorModel(c.state.staffList, { shift: c.occurrence, matchingJob: job,
      allShifts: c.allShifts, stagedAssignedStaffIds: [], assignedIdsSet: new Set(), poolTags: c.state.poolTags,
      absences: c.state.absences || [], refusalHistory: c.state.refusalHistory || [],
      ...Object.fromEntries(Object.entries(options).filter(([k]) => k !== 'job')) });
  }, options);
}
async function main() {
  const browser = await loadPlaywright().chromium.launch({ headless: true }); report.browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  try {
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.stack)); page.on('dialog', d => { dialogs.push(d.message()); return d.dismiss(); });
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href); await ready(page);
    assert.equal(await page.evaluate(() => typeof HortOpsStaffAssignCandidateModel.resolveAllocatorModel), 'function', 'Build current standalone first');
    const seeded = await page.evaluate(() => {
      const csv = 'ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\n' + [
        ['HOME', 'Alpha Home', 'Operations', 'Parks', 'FALSE', 'active'],
        ['OTHER', 'Bravo Other', 'Services', 'Libraries', 'FALSE', 'active'],
        ['OPERATOR', 'Zulu Operator', 'Operations', 'Roads', 'TRUE', 'active'],
        ['MEMBER', 'Charlie Member', 'Operations', 'Roads', 'FALSE', 'active'],
        ['EXTRA', 'Delta Member', 'Operations', 'Roads', 'FALSE', 'active'],
        ['BLOCKED', 'Inactive Member', 'Operations', 'Roads', 'FALSE', 'inactive']
      ].map(([id, name, dept, team, op, status]) => ['EMP-ALLOCATOR-' + id, name, id.toLowerCase() + '@example.test', dept, team, 'Worker', op, status].join(',')).join('\n') + '\n';
      const parsed = HortOpsUserCsvParser.parseUserCsv(csv, []), imported = HortOpsApp.importStaffMembers(parsed.staff);
      const pools = HortOpsApp._commitCanonicalProposal({ poolTags: [{ id: 'POOL-RANGER', label: 'Ranger', active: true }, { id: 'POOL-ARCHIVE', label: 'Archive', active: false }] });
      const members = ['OPERATOR', 'MEMBER', 'EXTRA', 'BLOCKED'].map(id => HortOpsApp.updateStaffMember({ id: 'EMP-ALLOCATOR-' + id,
        poolTagIds: id === 'OPERATOR' ? ['POOL-RANGER', 'POOL-ARCHIVE'] : ['POOL-RANGER'], ...(id === 'BLOCKED' ? { isOvertimeExempt: true } : {}) }).success);
      const job = HortOpsApp.saveJob({ id: 'JOB-ALLOCATOR', name: 'Usable cross-team allocator', category: 'Parks', primaryTeam: 'Parks',
        preferredPoolTagIds: ['POOL-RANGER'], exclusivePoolSource: 'none', staffingSections: { teams: true, pools: true },
        frequencyType: 'work_pattern', workPattern: { mode: 'weekly', startDate: '2026-01-01', days: [6, 0], includePublicHolidays: true, excludedDates: [] },
        startTime: '06:00 AM', durationHours: 6, crewSize: 3, status: 'active', color: '#047857' });
      return { parsed: parsed.success, imported: imported.success, pools: pools.success, members, job: job.success, error: job.error };
    });
    assert.equal(seeded.parsed, true); assert.equal(seeded.imported, true); assert.equal(seeded.pools, true);
    assert.deepEqual(seeded.members, [true, true, true, true]); assert.equal(seeded.job, true, seeded.error);
    checked('Independent imported workforce, active/retired tags and preferred-pool occurrence persist');
    const baselineBytes = await source(page), baselineDomains = await domains(page);
    const directory = await resolve(page);
    assert.equal(directory.groupMode, 'pools');
    assert.deepEqual(directory.matchingStaff.map(s => s.id).sort(), ['EMP-ALLOCATOR-BLOCKED', 'EMP-ALLOCATOR-EXTRA', 'EMP-ALLOCATOR-MEMBER', 'EMP-ALLOCATOR-OPERATOR']);
    assert.deepEqual(directory.otherStaff.map(s => s.id).sort(), ['EMP-ALLOCATOR-HOME', 'EMP-ALLOCATOR-OTHER']);
    assert.equal(directory.filteredStaff.length, 6);
  const firstBlockedMember = directory.matchingStaff.findIndex(s => !s._eligible);
  assert(firstBlockedMember < 0 || directory.matchingStaff.slice(firstBlockedMember).every(s => !s._eligible), 'Eligible members must precede blocked members within their displayed pool group');
    const blocked = directory.matchingStaff.find(s => s.id === 'EMP-ALLOCATOR-BLOCKED');
    assert.equal(blocked._eligible, false); assert(blocked._eligibility.reasons.includes('EMPLOYMENT_INACTIVE')); assert(blocked._eligibility.reasons.includes('OVERTIME_EXEMPT'));
    assert(directory.otherStaff.every(s => s._eligible));
    checked('Full workforce groups retain blocked matching members and eligible preferred-pool outsiders');
    const canonical = await page.evaluate(() => {
      const c = HortOpsApp.getSavedCandidatePreviewContext('JOB-ALLOCATOR@2026-12-25');
      return c.state.staffList.map(s => ({ id: s.id, ...HortOpsEligibilityEngine.validateStaffEligibility(s, c.occurrence, c.job, c.allShifts, [], { poolTags: c.state.poolTags, absences: c.state.absences || [] }) }));
    });
    for (const e of canonical) {
      const row = directory.filteredStaff.find(s => s.id === e.id); assert.equal(row._eligible, e.eligible);
      assert.deepEqual(row._eligibility.reasons.sort(), e.reasons.sort());
    }
    assert.equal(await source(page), baselineBytes); assert.equal(await domains(page), baselineDomains);
    checked('Directory projections preserve every canonical reason and exact source/domain bytes');
    const exclusive = await resolve(page, { job: { exclusivePoolSource: 'tags', exclusivePoolTagIds: ['POOL-RANGER'] } });
    assert(exclusive.otherStaff.every(s => !s._eligible && s._eligibility.reasons.includes('POOL_NOT_ALLOWED')));
    const emptyPool = await resolve(page, { job: { exclusivePoolSource: 'tags', exclusivePoolTagIds: [] } });
    assert.equal(emptyPool.groupMode, 'pools'); assert.equal(emptyPool.matchingStaff.length, 0); assert(emptyPool.otherStaff.every(s => !s._eligible));
    checked('Exclusive nonmembers remain visible but blocked and an empty exclusive pool fails closed');
    const rangerIds = directory.matchingStaff.map(s => s.id).sort();
    for (const searchTerm of ['ranger', '#RANGER', '#rAnGeR']) assert.deepEqual((await resolve(page, { searchTerm })).filteredStaff.map(s => s.id).sort(), rangerIds);
    assert.deepEqual((await resolve(page, { selectedPoolTag: 'POOL-RANGER' })).filteredStaff.map(s => s.id).sort(), rangerIds);
    assert.deepEqual((await resolve(page, { selectedPoolTag: 'POOL-RANGER', searchTerm: '#archive', selectedDept: 'Operations', selectedTeam: 'Roads' })).filteredStaff.map(s => s.id), ['EMP-ALLOCATOR-OPERATOR']);
    assert.equal((await resolve(page, { selectedPoolTag: 'POOL-RANGER', selectedDept: 'Services' })).filteredStaff.length, 0);
    assert.equal((await resolve(page, { selectedPoolTag: 'POOL-RANGER', selectedTeam: 'Parks' })).filteredStaff.length, 0);
    assert.deepEqual((await resolve(page, { searchTerm: '#aRcHiVe' })).filteredStaff.map(s => s.id), ['EMP-ALLOCATOR-OPERATOR']);
    checked('Smart tag search accepts hash/case variants and combines pool, department and team slicers');
    const neutral = await resolve(page, { job: { staffingSections: { teams: false, pools: false } } });
    assert.equal(neutral.groupMode, 'neutral'); assert.equal(neutral.matchingStaff.length, 5); assert.equal(neutral.otherStaff.length, 1);
    assert(neutral.matchingStaff.every(s => s._eligible)); assert(neutral.otherStaff.every(s => !s._eligible));
    const teamsOnly = await resolve(page, { job: { staffingSections: { teams: true, pools: false } } });
    assert.equal(teamsOnly.groupMode, 'teams'); assert.deepEqual(teamsOnly.matchingStaff.map(s => s.id), ['EMP-ALLOCATOR-HOME']);
    checked('Disabled staffing sections remove pool bias; both-off groups eligible staff separately from blocked staff');
    const selection = await page.evaluate(() => {
      const c = HortOpsApp.getSavedCandidatePreviewContext('JOB-ALLOCATOR@2026-12-25');
      const ctx = { roster: c.state.staffList, shift: c.occurrence, matchingJob: c.job, allShifts: c.allShifts,
        stagedAssignedStaffIds: ['EMP-ALLOCATOR-MEMBER'], poolTags: c.state.poolTags, absences: c.state.absences || [],
        refusalHistory: c.state.refusalHistory || [], selectedPoolTag: 'POOL-ARCHIVE', selectedTeam: 'Libraries', searchTerm: 'no match' };
      const result = HortOpsStaffAssignCandidateModel.selectAutoAddCandidates(ctx);
      const expected = HortOpsStaffAssignCandidateModel.resolveAllocatorModel(ctx.roster, { ...ctx, selectedPoolTag: 'all', selectedTeam: 'all', searchTerm: '' }).filteredStaff
        .filter(s => s._eligible && s.id !== 'EMP-ALLOCATOR-MEMBER').slice(0, 2).map(s => s.id);
      return { result, expected };
    });
    assert.equal(selection.result.success, true); assert.deepEqual(selection.result.selectedIds, selection.expected);
    assert(selection.result.stagedIds.includes('EMP-ALLOCATOR-MEMBER')); assert.equal(new Set(selection.result.stagedIds).size, 3);
    assert.equal(selection.result.shortage, 0); assert.equal(await source(page), baselineBytes); assert.equal(await domains(page), baselineDomains);
    checked('Auto-add uses current comparator, preserves assigned staff, ignores browsing filters and stays detached');
    const safety = await page.evaluate(() => {
      const c = HortOpsApp.getSavedCandidatePreviewContext('JOB-ALLOCATOR@2026-12-25');
      const base = { roster: c.state.staffList, shift: c.occurrence, matchingJob: c.job, allShifts: c.allShifts,
        stagedAssignedStaffIds: [], poolTags: c.state.poolTags, absences: c.state.absences || [], refusalHistory: [] };
      const select = patch => HortOpsStaffAssignCandidateModel.selectAutoAddCandidates({ ...base, ...patch });
      const operatorJob = { ...c.job, crewSize: 2, plantOperatorRequired: true };
      const operatorShift = { ...c.occurrence, crewSize: 2, plantOperatorRequired: true };
      const operator = select({ matchingJob: operatorJob, shift: operatorShift });
      const missingOperator = select({ matchingJob: operatorJob, shift: operatorShift, roster: c.state.staffList.filter(s => !s.isPlantOperator) });
      const shortage = select({ matchingJob: { ...c.job, crewSize: 10 }, shift: { ...c.occurrence, crewSize: 10 } });
      const invalidStaged = select({ stagedAssignedStaffIds: ['EMP-ALLOCATOR-BLOCKED'] });
      const qualification = select({ matchingJob: { ...c.job, requiredQualifications: ['WHITE_CARD'] } });
      const overlap = c.state.staffList.map(s => ({ ...c.occurrence, jobId: 'JOB-OVERLAP-' + s.id, shiftId: 'JOB-OVERLAP-' + s.id + '@2026-12-25', assignedStaffIds: [s.id] }));
      const conflicts = select({ allShifts: overlap });
      const earlier = overlap.map(s => ({ ...s, date: '2026-12-24', shiftId: s.jobId + '@2026-12-24', startTime: '11:00 PM', durationHours: 4 }));
      const rest = select({ allShifts: earlier });
      const absences = c.state.staffList.map((s, index) => ({ id: 'ABS-ALLOCATOR-' + index, staffId: s.id, startDate: '2026-12-25', endDate: '2026-12-25', type: 'leave', status: 'active' }));
      const absent = select({ absences });
      const failedBoundary = []; failedBoundary.lookupFailed = true;
      const boundary = select({ allShifts: failedBoundary });
      const originalEngine = window.HortOpsEligibilityEngine;
      let missingEngine;
      try { window.HortOpsEligibilityEngine = null; missingEngine = select({}); } finally { window.HortOpsEligibilityEngine = originalEngine; }
      return { operator, missingOperator, shortage, invalidStaged, qualification, conflicts, rest, absent, boundary, missingEngine };
    });
    assert(safety.operator.stagedIds.includes('EMP-ALLOCATOR-OPERATOR')); assert.equal(safety.operator.shortage, 0); assert.equal(safety.operator.crewValidation.valid, true);
    assert.equal(safety.missingOperator.selectedIds.length, 0); assert(safety.missingOperator.shortage > 0);
    assert.equal(safety.shortage.stagedIds.length, 5); assert.equal(safety.shortage.shortage, 5);
    assert.equal(safety.invalidStaged.selectedIds.length, 0); assert.equal(safety.qualification.selectedIds.length, 0); assert.equal(safety.conflicts.selectedIds.length, 0);
    checked('Auto-add enforces operator crew rules, qualifications and conflicts and reports shortage without bypassing invalid staged staff');
    for (const key of ['rest', 'absent', 'boundary', 'missingEngine']) assert.equal(safety[key].selectedIds.length, 0, key + ' must fail closed');
    assert.equal(await source(page), baselineBytes); assert.equal(await domains(page), baselineDomains);
    checked('Rest, absence, unavailable boundary data and missing canonical engine prevent auto-add without mutation');
    const shiftId = 'JOB-ALLOCATOR@2026-12-25';
    await page.evaluate(id => HortOpsStaffAssignModal.open(id), shiftId);
    const modal = page.locator('#staff-assign-modal-root');
    assert.equal(await modal.locator('[data-allocator-staff]').count(), 6);
    assert.equal(await modal.locator('[data-allocator-group="matching"]').count(), 1); assert.equal(await modal.locator('[data-allocator-group="other"]').count(), 1);
    const blockedCard = modal.locator('[data-allocator-staff="EMP-ALLOCATOR-BLOCKED"]');
    assert.match(await blockedCard.innerText(), /Inactive/i); assert.match(await blockedCard.innerText(), /Exempt/i);
    assert.equal(await blockedCard.locator('button').isEnabled(), false);
    const memberCard = modal.locator('[data-allocator-staff="EMP-ALLOCATOR-OPERATOR"]');
    assert.equal(await memberCard.locator('[data-staff-pool-tag="POOL-RANGER"]').count(), 1);
    assert.match(await memberCard.locator('[data-staff-pool-tag="POOL-ARCHIVE"]').innerText(), /retired/i);
    assert.equal(await modal.locator('[data-allocator-staff="EMP-ALLOCATOR-OTHER"] button').isEnabled(), true);
    checked('Real directory renders matching/all-other divider, hard reasons, disabled blocked actions and active/retired badges');
    const search = modal.locator('input[oninput*="setSearch"]');
    await search.fill('#rAnGeR'); assert.equal(await modal.locator('[data-allocator-staff]').count(), 4);
    await modal.locator('#assign-filter-pool').selectOption('POOL-RANGER');
    await search.fill('#Archive'); assert.equal(await modal.locator('[data-allocator-staff]').count(), 1);
    await modal.locator('#assign-filter-team').selectOption('Parks'); assert.equal(await modal.locator('[data-allocator-staff]').count(), 0);
    assert.match(await modal.innerText(), /No .*match|No .*filter|No staff/i);
    await modal.locator('#assign-filter-team').selectOption('all'); await modal.locator('#assign-filter-pool').selectOption('all'); await search.fill('');
    checked('Real smart search and pool/team slicers combine and explain empty results');
    await page.locator('button[onclick*="addStaff"][onclick*="EMP-ALLOCATOR-MEMBER"]').click();
    assert.equal(await modal.locator('[data-staff-pool-tag="POOL-RANGER"]').count() >= 5, true, 'Staged crew also displays tags');
    await page.locator('button[onclick*="saveAllocation"]').click();
    assert.equal(await page.evaluate(() => !HortOpsStaffAssignModal.activeShiftId), true, JSON.stringify(dialogs));
    checked('One existing manual assignment is durably saved before auto-add fills its remaining vacancies');
    await page.evaluate(id => HortOpsStaffAssignModal.open(id), shiftId);
    const stagingBytes = await source(page), stagingDomains = await domains(page);
    await search.fill('nothing matches this directory');
    await modal.locator('[data-auto-add-eligible]').click();
    const staged = await page.evaluate(() => ({ ids: HortOpsStaffAssignModal.stagedAssignedStaffIds, slots: HortOpsStaffAssignModal.stagedSlots }));
    assert.deepEqual(staged.ids, ['EMP-ALLOCATOR-MEMBER', ...selection.expected]);
    assert.equal(new Set(staged.slots.map(s => s.slotId)).size, 3);
    assert.equal(await source(page), stagingBytes); assert.equal(await domains(page), stagingDomains);
    assert.match(await modal.locator('[data-auto-add-status]').innerText(), /added|staged|vacanc/i);
    assert.match(await modal.locator('[data-staged-staff="EMP-ALLOCATOR-OPERATOR"] [data-staff-pool-tag="POOL-ARCHIVE"]').innerText(), /retired/i);
    checked('Real general Auto-add stages ranked vacancies with stable slots and preserves existing assignment/source bytes');
    await search.fill('');
    const folder = path.join(root, 'test_reports/allocator-usability'); fs.mkdirSync(folder, { recursive: true });
    await page.screenshot({ path: path.join(folder, 'allocator-desktop.png') });
    await page.setViewportSize({ width: 390, height: 700 });
    await page.screenshot({ path: path.join(folder, 'allocator-mobile.png') });
    const panel = modal.locator('.modal-card');
    assert.equal(await panel.evaluate(n => n.scrollWidth <= n.clientWidth + 1), true, 'Narrow modal has no horizontal panel overflow');
    await page.setViewportSize({ width: 1200, height: 700 });
    await page.locator('button[onclick*="saveAllocation"]').click();
    assert.equal(await page.evaluate(() => !HortOpsStaffAssignModal.activeShiftId), true, JSON.stringify(dialogs));
    const committed = JSON.parse(await source(page)); await page.reload(); await ready(page);
    assert.deepEqual(await page.evaluate(id => HortOpsApp.state.allShifts.find(s => s.shiftId === id).assignedStaffIds, shiftId), staged.ids);
    const reloaded = JSON.parse(await source(page));
    for (const key of ['assignments', 'rostering', 'historicalSnapshots', 'roster', 'poolTags']) assert.deepEqual(reloaded[key], committed[key]);
    checked('Auto-added manual crew saves/reloads canonical assignments, provenance, workforce and tags');
    const shortageJob = await page.evaluate(() => HortOpsApp.saveJob({ ...HortOpsApp.state.jobs.find(j => j.id === 'JOB-ALLOCATOR'), id: 'JOB-ALLOCATOR-SHORT', name: 'Shortage service', crewSize: 10 }));
    assert.equal(shortageJob.success, true, shortageJob.error);
    await page.evaluate(() => HortOpsStaffAssignModal.open('JOB-ALLOCATOR-SHORT@2026-12-26'));
    const shortageBytes = await source(page); await modal.locator('[data-auto-add-eligible]').click();
    assert(await page.evaluate(() => HortOpsStaffAssignModal.stagedAssignedStaffIds.length < 10));
    assert.match(await modal.locator('[data-auto-add-status]').innerText(), /short|remain|unfilled/i);
    assert.equal(await source(page), shortageBytes); await page.evaluate(() => HortOpsStaffAssignModal.close());
    checked('Real shortage feedback reports unfilled vacancies and closing discards auto-add staging');
    assert.equal(await page.evaluate(() => HortOpsApp.saveJob({ ...HortOpsApp.state.jobs.find(j => j.id === 'JOB-ALLOCATOR'),
      id: 'JOB-ALLOCATOR-EXCLUSIVE', name: 'Exclusive pool service', staffingSections: { teams: false, pools: true },
      exclusivePoolSource: 'tags', exclusivePoolTagIds: ['POOL-RANGER'] }).success), true);
    const exclusiveBytes = await source(page);
    await page.evaluate(() => HortOpsStaffAssignModal.open('JOB-ALLOCATOR-EXCLUSIVE@2026-12-27'));
    const outsider = modal.locator('[data-allocator-group="other"] [data-allocator-staff="EMP-ALLOCATOR-HOME"]');
    assert.equal(await outsider.count(), 1); assert.equal(await outsider.locator('button').isEnabled(), false);
    assert.match(await outsider.innerText(), /pool|allowed|member/i);
    const restriction = modal.locator('[data-allocator-pool-restriction]');
    assert.match(await restriction.innerText(), /Tagged staff only/i); assert.match(await restriction.innerText(), /#Ranger/);
    await page.screenshot({ path: path.join(folder, 'allocator-exclusive-desktop.png') });
    await page.setViewportSize({ width: 390, height: 700 });
    await page.screenshot({ path: path.join(folder, 'allocator-exclusive-mobile.png') });
    await page.setViewportSize({ width: 1200, height: 700 });
    assert.equal(await source(page), exclusiveBytes); await page.evaluate(() => HortOpsStaffAssignModal.close());
    checked('Real exclusive directory keeps nonmembers below divider with hard reason and disabled action');
    const peer = await context.newPage(); peer.on('pageerror', e => errors.push(e.stack)); peer.on('dialog', d => d.dismiss());
    await peer.goto(pathToFileURL(path.join(root, 'index.html')).href); await peer.waitForFunction(() => HortOpsWriterSession.status().mode === 'read-only');
    const peerBytes = await source(peer);
    const guarded = await peer.evaluate(() => {
      const openResult = HortOpsStaffAssignModal.open('JOB-ALLOCATOR-SHORT@2026-12-26');
      const before = JSON.stringify(HortOpsStaffAssignModal.stagedAssignedStaffIds);
      const poolBefore = HortOpsStaffAssignModal.selectedPoolTag;
      const result = HortOpsStaffAssignModal.autoAddEligible();
      const filterResult = HortOpsStaffAssignModal.setPoolTag('POOL-RANGER');
      return { result, openResult, filterResult, poolUnchanged: poolBefore === HortOpsStaffAssignModal.selectedPoolTag,
        unchanged: before === JSON.stringify(HortOpsStaffAssignModal.stagedAssignedStaffIds) };
    });
    assert.equal(guarded.unchanged, true); assert.equal(guarded.result.success, false); assert.equal(await source(page), peerBytes);
    assert.equal(guarded.openResult.success, false); assert.equal(guarded.filterResult.success, false); assert.equal(guarded.poolUnchanged, true);
    assert.equal(await peer.locator('[data-auto-add-eligible]').count(), 0);
    await peer.evaluate(() => HortOpsStaffAssignModal.close()); await peer.close();
    checked('Readonly peer blocks general auto-add method and button without changing staging or persisted state');
    assert.deepEqual(errors, []); report.passed = true; console.log('ALLOCATOR USABILITY CHECKS PASSED: ' + checks.length);
  } finally {
    await context.close(); await browser.close();
    const folder = path.join(root, 'test_reports/allocator-usability'); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
