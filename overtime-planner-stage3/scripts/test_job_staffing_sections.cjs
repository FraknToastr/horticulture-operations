'use strict';
// Self-contained Overtime staffing-section contracts and real offline workflow proof.
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
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/utils/planningRules.js'), 'utf8'), scope);
  const rules = scope.window.HortOpsPlanningRules;
  const valid = staffingSections => rules.validateWorkspace({ jobs: [{ id: 'JOB-SECTIONS', ...(staffingSections === undefined ? {} : { staffingSections }) }], roster: [] }).valid;
  assert.equal(valid(undefined), true);
  for (const teams of [true, false]) for (const pools of [true, false]) assert.equal(valid({ teams, pools }), true);
  checked('Absent section extension and all four explicit boolean combinations validate');
  for (const staffingSections of [null, [], {}, { teams: true }, { pools: true }, { teams: 'false', pools: true },
    { teams: true, pools: 0 }, { teams: true, pools: true, unknown: false }, true]) {
    assert.equal(valid(staffingSections), false, 'Malformed section extension: ' + JSON.stringify(staffingSections));
  }
  checked('Section extension rejects null, arrays, partial, nonboolean and unknown-key shapes');
}
async function ready(page) { await page.waitForFunction(() => window.HortOpsWriterSession && HortOpsWriterSession.canWrite()); }
async function source(page) { return page.evaluate(() => localStorage.getItem(HortOpsClientStorage.workspaceKey)); }
async function main() {
  contracts();
  const browser = await loadPlaywright().chromium.launch({ headless: true });
  report.browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  try {
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.stack)); page.on('dialog', d => { dialogs.push(d.message()); return d.dismiss(); });
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href); await ready(page);
    const seeded = await page.evaluate(() => {
      const csv = 'ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\n' + [
        ['HOME', 'Alpha Home', 'Parks', 'FALSE', 'active'], ['OTHER', 'Bravo Other', 'Libraries', 'FALSE', 'active'],
        ['MEMBER', 'Zulu Pool', 'Roads', 'TRUE', 'active'], ['EXEMPT', 'Exempt Pool', 'Roads', 'FALSE', 'active'],
        ['INACTIVE', 'Inactive Pool', 'Roads', 'FALSE', 'inactive']
      ].map(([id, name, team, op, status]) => ['EMP-SECTION-' + id, name, id.toLowerCase() + '@example.test', 'Operations', team, 'Worker', op, status].join(',')).join('\n') + '\n';
      const parsed = HortOpsUserCsvParser.parseUserCsv(csv, []), imported = HortOpsApp.importStaffMembers(parsed.staff);
      const pools = HortOpsApp._commitCanonicalProposal({ poolTags: [{ id: 'POOL-SECTION', label: 'SectionCrew', active: true }] });
      const memberships = ['MEMBER', 'EXEMPT', 'INACTIVE'].map(id => HortOpsApp.updateStaffMember({ id: 'EMP-SECTION-' + id,
        poolTagIds: ['POOL-SECTION'], ...(id === 'EXEMPT' ? { isOvertimeExempt: true } : {}) }).success);
      const job = HortOpsApp.saveJob({ id: 'JOB-SECTIONS', name: 'Independent staffing sections', category: 'Parks',
        defaultDepartment: 'Operations', primaryTeam: 'Parks', secondaryTeam: 'Roads', tertiaryTeam: 'Libraries',
        preferredPoolTagIds: ['POOL-SECTION'], exclusivePoolSource: 'tags', exclusivePoolTagIds: ['POOL-SECTION'],
        frequencyType: 'work_pattern', workPattern: { mode: 'weekly', startDate: '2026-01-01', days: [6, 0], includePublicHolidays: true, excludedDates: [] },
        startTime: '06:00 AM', durationHours: 6, crewSize: 1, status: 'active', color: '#047857' });
      return { parsed: parsed.success, imported: imported.success, pools: pools.success, memberships, job: job.success, error: job.error };
    });
    assert.equal(seeded.parsed, true); assert.equal(seeded.imported, true); assert.equal(seeded.pools, true);
    assert.deepEqual(seeded.memberships, [true, true, true]); assert.equal(seeded.job, true, seeded.error);
    checked('Current User Table, active tag memberships and legacy-default job save independently');
    const shiftId = 'JOB-SECTIONS@2026-12-25';
    const matrix = await page.evaluate(id => {
      const c = HortOpsApp.getSavedCandidatePreviewContext(id);
      const variants = [
        { label: 'legacy', job: { ...c.job } },
        { label: 'pool-only', job: { ...c.job, staffingSections: { teams: false, pools: true } } },
        { label: 'team-only-tags-dormant', job: { ...c.job, staffingSections: { teams: true, pools: false } } },
        { label: 'both-off', job: { ...c.job, staffingSections: { teams: false, pools: false } } },
        { label: 'team-only-exclusive', job: { ...c.job, exclusivePoolSource: 'teams', isExclusiveTeams: true, exclusiveTeams: ['Parks'], staffingSections: { teams: true, pools: false } } },
        { label: 'pool-only-team-dormant', job: { ...c.job, exclusivePoolSource: 'teams', isExclusiveTeams: true, exclusiveTeams: ['Parks'], staffingSections: { teams: false, pools: true } } }
      ];
      return variants.map(({ label, job }) => ({ label, preview: HortOpsCandidatePreview.build({ ...c, job }),
        evaluations: c.state.staffList.map(s => ({ id: s.id, ...HortOpsEligibilityEngine.validateStaffEligibility(s, c.occurrence, job, c.allShifts, [], { poolTags: c.state.poolTags, absences: c.state.absences || [] }) })),
        recommendation: HortOpsRosteringEngine.recommendRotationCandidate({ job, occurrence: c.occurrence, roster: c.state.staffList,
          allShifts: c.allShifts, jobs: [job], poolTags: c.state.poolTags, currentAssignedIds: [] }) }));
    }, shiftId);
    for (const row of matrix) for (const canonical of row.evaluations) {
      const explained = [...row.preview.eligible, ...row.preview.excluded].find(s => s.id === canonical.id);
      assert.equal(explained.eligible, canonical.eligible, row.label + ':' + canonical.id);
      assert.deepEqual(explained.reasons.map(r => r.code).sort(), canonical.reasons.sort());
    }
    const variant = label => matrix.find(r => r.label === label);
    for (const label of ['legacy', 'pool-only']) {
      assert.deepEqual(variant(label).preview.eligible.map(s => s.id), ['EMP-SECTION-MEMBER']);
      assert.equal(variant(label).recommendation.candidate.id, 'EMP-SECTION-MEMBER');
      assert(variant(label).preview.excluded.find(s => s.id === 'EMP-SECTION-HOME').reasons.some(r => r.code === 'POOL_NOT_ALLOWED'));
    }
    checked('Pools-only and absent-default tagged restriction agree across preview, canonical checks and assisted rotation');
    assert.equal(variant('team-only-tags-dormant').preview.eligible[0].id, 'EMP-SECTION-HOME');
    assert.equal(variant('team-only-tags-dormant').recommendation.candidate.id, 'EMP-SECTION-HOME');
    assert.deepEqual(variant('team-only-exclusive').preview.eligible.map(s => s.id), ['EMP-SECTION-HOME']);
    assert.equal(variant('team-only-exclusive').recommendation.candidate.id, 'EMP-SECTION-HOME');
    assert.equal(variant('pool-only-team-dormant').preview.eligible[0].id, 'EMP-SECTION-MEMBER');
    assert(variant('pool-only-team-dormant').preview.eligible.some(s => s.id === 'EMP-SECTION-OTHER'));
    checked('Each disabled section removes only its team or pool restrictions/preferences');
    const neutral = variant('both-off');
    assert.deepEqual(neutral.preview.eligible.map(s => s.id), ['EMP-SECTION-HOME', 'EMP-SECTION-OTHER', 'EMP-SECTION-MEMBER']);
    assert(neutral.preview.eligible.every(s => s.ranking.teamTier === 5 && s.ranking.preferredPoolMatch === false));
    assert.equal(neutral.recommendation.candidate.id, 'EMP-SECTION-HOME');
    for (const row of matrix) {
      assert(row.preview.excluded.find(s => s.id === 'EMP-SECTION-EXEMPT').reasons.some(r => r.code === 'OVERTIME_EXEMPT'));
      assert(row.preview.excluded.find(s => s.id === 'EMP-SECTION-INACTIVE').reasons.some(r => r.code === 'EMPLOYMENT_INACTIVE'));
    }
    checked('Both sections off removes staffing preferences while employment and overtime safety remain mandatory');
    const preferredFilter = await page.evaluate(id => {
      const c = HortOpsApp.getSavedCandidatePreviewContext(id), job = { ...c.job, staffingSections: { teams: false, pools: false } };
      const prefs = HortOpsPlanningRules.effectivePrefs(job, { primaryTeam: 'Parks', secondaryTeam: 'Roads', tertiaryTeam: 'Libraries', isExclusive: true, exclusiveTeams: ['Parks'] });
      return HortOpsStaffAssignCandidateModel.resolveCandidateModel(c.state.staffList, { shift: c.occurrence, matchingJob: job, allShifts: c.allShifts,
        stagedAssignedStaffIds: [], assignedIdsSet: new Set(), jobPreferences: prefs, onlyPreferredCrew: true }).filteredStaff.map(s => s.id).sort();
    }, shiftId);
    assert.deepEqual(preferredFilter, ['EMP-SECTION-HOME', 'EMP-SECTION-MEMBER', 'EMP-SECTION-OTHER']);
    checked('Inactive team preferences cannot hide otherwise eligible staff through a retained preferred-crew filter');
    const safety = await page.evaluate(id => {
      const c = HortOpsApp.getSavedCandidatePreviewContext(id), s = c.state.staffList.find(s => s.id === 'EMP-SECTION-MEMBER');
      const job = { ...c.job, staffingSections: { teams: false, pools: false } };
      const other = { ...c.occurrence, jobId: 'JOB-OTHER', shiftId: 'JOB-OTHER@2026-12-25', assignedStaffIds: [s.id] };
      const qualification = HortOpsEligibilityEngine.validateStaffEligibility(s, c.occurrence, { ...job, requiredQualifications: ['WHITE_CARD'] }, c.allShifts, []);
      const overlap = HortOpsEligibilityEngine.validateStaffEligibility(s, c.occurrence, job, [other], []);
      const earlier = { ...other, startTime: '11:00 PM', date: '2026-12-24', shiftId: 'JOB-OTHER@2026-12-24', durationHours: 4 };
      const rest = HortOpsEligibilityEngine.validateStaffEligibility(s, c.occurrence, job, [earlier], []);
      const absent = HortOpsEligibilityEngine.validateStaffEligibility(s, c.occurrence, job, c.allShifts, [], { absences: [{ id: 'ABS-SECTION', staffId: s.id, startDate: '2026-12-25', endDate: '2026-12-25', type: 'leave', status: 'active' }], poolTags: c.state.poolTags });
      const crew = HortOpsEligibilityEngine.validateCrewForOccurrence({ occurrence: { ...c.occurrence, plantOperatorRequired: true }, job,
        assignedStaffIds: ['EMP-SECTION-HOME'], roster: c.state.staffList, allAssignments: c.allShifts });
      return { qualification, overlap, rest, absent, crew };
    }, shiftId);
    assert(safety.qualification.reasons.includes('LACKS_REQUIRED_QUALIFICATION'));
    assert(safety.overlap.reasons.includes('OVERLAPPING_SHIFT')); assert(safety.rest.reasons.includes('INSUFFICIENT_REST'));
    assert.equal(safety.absent.eligible, false); assert(safety.absent.reasons.includes('STAFF_ABSENT'));
    assert.equal(safety.crew.valid, false); assert(safety.crew.issues.some(i => i.code === 'PLANT_OPERATOR_REQUIRED'));
    checked('Both switches off retains qualifications, absence, overlap, rest and crew operator contracts');
    const before = await source(page);
    for (const staffingSections of [null, {}, { teams: false, pools: 'true' }, { teams: true, pools: false, extra: true }]) {
      const invalid = await page.evaluate(sections => HortOpsApp.saveJob({ ...HortOpsApp.state.jobs.find(j => j.id === 'JOB-SECTIONS'), staffingSections: sections }), staffingSections);
      assert.equal(invalid.success, false); assert.equal(await source(page), before);
    }
    checked('Canonical saves reject malformed staffing switches without changing persisted bytes');
    await page.evaluate(() => HortOpsJobEditModal.open('JOB-SECTIONS'));
    const modal = page.locator('#job-edit-modal-root');
    const teamSwitch = modal.locator('[data-staffing-section="teams"]'), poolSwitch = modal.locator('[data-staffing-section="pools"]');
  assert.equal(await teamSwitch.isChecked(), true); assert.equal(await poolSwitch.isChecked(), true);
  assert.equal((await modal.locator('[data-preferred-pool="POOL-SECTION"]').locator('xpath=..').textContent()).trim(), '#SectionCrew (3)');
  assert.equal(await modal.locator('[data-preferred-pool="POOL-SECTION"]').locator('xpath=..').locator('[data-pool-member-count="3"]').count(), 1);
  checked('Pool tags show current workforce membership counts in brackets');
    const imageFolder = path.join(root, 'test_reports/staffing-sections'); fs.mkdirSync(imageFolder, { recursive: true });
    await page.screenshot({ path: path.join(imageFolder, 'staffing-desktop.png') });
    const settings = await page.evaluate(() => JSON.stringify(Object.fromEntries(['primaryTeam', 'secondaryTeam', 'tertiaryTeam', 'exclusiveTeams', 'preferredPoolTagIds', 'exclusivePoolTagIds', 'exclusivePoolSource'].map(k => [k, HortOpsJobEditModal.formData[k]]))));
    await teamSwitch.uncheck(); await poolSwitch.uncheck();
    assert.equal(await modal.locator('[data-staffing-unrestricted]').count(), 1);
    assert.equal(await modal.locator('[data-pool-source]').count(), 0);
    await teamSwitch.check(); await poolSwitch.check();
    assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(['primaryTeam', 'secondaryTeam', 'tertiaryTeam', 'exclusiveTeams', 'preferredPoolTagIds', 'exclusivePoolTagIds', 'exclusivePoolSource'].map(k => [k, HortOpsJobEditModal.formData[k]])))), settings);
    assert.equal(await source(page), before);
    checked('Real UI switches hide inactive controls, preserve settings off/on and do not save staging');
  await modal.locator('[data-pool-source]').selectOption('teams');
  assert.deepEqual(await modal.locator('.btn-exclusive-chip').evaluateAll(chips => Object.fromEntries(chips.map(chip => [chip.getAttribute('data-team'), Number(chip.querySelector('[data-team-member-count]').textContent)]))), { Parks: 1, Libraries: 1, Roads: 3 });
  checked('Exclusive team pills show current workforce member counts');
  assert.equal(await page.evaluate(() => HortOpsJobEditModal.formData.isExclusiveTeams), true);
    await teamSwitch.uncheck();
    assert.equal(await modal.locator('[data-pool-source]').inputValue(), 'teams');
    assert.equal(await page.evaluate(() => HortOpsJobEditModal.formData.isExclusiveTeams), true, 'Toggle retains dormant source flags');
    await modal.locator('[data-pool-source]').selectOption('tags');
    assert.equal(await modal.locator('[data-pool-source]').inputValue(), 'tags');
    assert.equal(await page.evaluate(() => HortOpsJobEditModal.formData.isExclusiveTeams || HortOpsJobEditModal.formData.isExclusive), false);
    checked('Switching a dormant exclusive-team source to tagged staff clears aliases while retaining team selections');
    await page.setViewportSize({ width: 390, height: 700 });
    await page.screenshot({ path: path.join(imageFolder, 'staffing-mobile.png') });
    await page.setViewportSize({ width: 1200, height: 700 });
    await modal.locator('button[type="submit"]').click();
    await page.waitForFunction(() => !HortOpsJobEditModal.formData);
    assert.deepEqual(await page.evaluate(() => HortOpsApp.state.jobs.find(j => j.id === 'JOB-SECTIONS').staffingSections), { teams: false, pools: true });
    const savedSettings = await page.evaluate(() => JSON.stringify(Object.fromEntries(['primaryTeam', 'secondaryTeam', 'tertiaryTeam', 'exclusiveTeams', 'preferredPoolTagIds', 'exclusivePoolTagIds', 'exclusivePoolSource'].map(k => [k, HortOpsApp.state.jobs.find(j => j.id === 'JOB-SECTIONS')[k]]))));
    await page.reload(); await ready(page);
    assert.deepEqual(await page.evaluate(() => HortOpsApp.state.jobs.find(j => j.id === 'JOB-SECTIONS').staffingSections), { teams: false, pools: true });
    assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(['primaryTeam', 'secondaryTeam', 'tertiaryTeam', 'exclusiveTeams', 'preferredPoolTagIds', 'exclusivePoolTagIds', 'exclusivePoolSource'].map(k => [k, HortOpsApp.state.jobs.find(j => j.id === 'JOB-SECTIONS')[k]])))), savedSettings);
    checked('Pools-only switch state saves and reloads with retained tag/team settings');
    await page.evaluate(() => HortOpsJobEditModal.open('JOB-SECTIONS'));
    await poolSwitch.uncheck(); await modal.locator('button[type="submit"]').click();
    await page.waitForFunction(() => !HortOpsJobEditModal.formData);
    await page.reload(); await ready(page);
    assert.deepEqual(await page.evaluate(() => HortOpsApp.state.jobs.find(j => j.id === 'JOB-SECTIONS').staffingSections), { teams: false, pools: false });
    assert.deepEqual(await page.evaluate(id => HortOpsCandidatePreview.build(HortOpsApp.getSavedCandidatePreviewContext(id)).eligible.map(s => s.id), shiftId), ['EMP-SECTION-HOME', 'EMP-SECTION-OTHER', 'EMP-SECTION-MEMBER']);
    await page.evaluate(() => HortOpsJobEditModal.open('JOB-SECTIONS'));
    await poolSwitch.check();
    assert.equal(await modal.locator('[data-pool-source]').inputValue(), 'tags');
    assert.equal(await modal.locator('[data-exclusive-pool="POOL-SECTION"]').isChecked(), true);
    await modal.locator('button[type="submit"]').click(); await page.waitForFunction(() => !HortOpsJobEditModal.formData);
    await page.reload(); await ready(page);
    assert.deepEqual(await page.evaluate(() => HortOpsApp.state.jobs.find(j => j.id === 'JOB-SECTIONS').staffingSections), { teams: false, pools: true });
    assert.deepEqual(await page.evaluate(id => HortOpsCandidatePreview.build(HortOpsApp.getSavedCandidatePreviewContext(id)).eligible.map(s => s.id), shiftId), ['EMP-SECTION-MEMBER']);
    assert.equal(await page.evaluate(() => JSON.stringify(Object.fromEntries(['primaryTeam', 'secondaryTeam', 'tertiaryTeam', 'exclusiveTeams', 'preferredPoolTagIds', 'exclusivePoolTagIds', 'exclusivePoolSource'].map(k => [k, HortOpsApp.state.jobs.find(j => j.id === 'JOB-SECTIONS')[k]])))), savedSettings);
    checked('Saved both-off reload stays neutral and reenabled pools restore the retained hard restriction');
    await page.evaluate(id => HortOpsStaffAssignModal.open(id), shiftId);
    const deniedBytes = await source(page);
    await page.evaluate(() => HortOpsStaffAssignModal.addStaff('EMP-SECTION-HOME'));
    assert.equal(await page.evaluate(() => HortOpsStaffAssignModal.stagedAssignedStaffIds.includes('EMP-SECTION-HOME')), false);
    assert.equal(await source(page), deniedBytes);
    await page.evaluate(() => HortOpsStaffAssignModal.autoFillTeam('Parks'));
    assert.deepEqual(await page.evaluate(() => HortOpsStaffAssignModal.stagedAssignedStaffIds), []);
    await page.evaluate(() => { HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-SECTION-HOME']; HortOpsStaffAssignModal.saveAllocation(); });
    assert.equal(await page.evaluate(() => !!HortOpsStaffAssignModal.activeShiftId), true);
    assert.equal(await source(page), deniedBytes);
    await page.evaluate(() => { HortOpsStaffAssignModal.stagedAssignedStaffIds = []; HortOpsStaffAssignModal.renderModal(); });
    checked('Disabled-team autofill and forced nonmember save cannot bypass active tagged restriction');
    await page.locator('button[onclick*="addStaff"][onclick*="EMP-SECTION-MEMBER"]').click();
    await page.locator('button[onclick*="saveAllocation"]').click();
    assert.equal(await page.evaluate(() => !HortOpsStaffAssignModal.activeShiftId), true, JSON.stringify(dialogs));
    const assigned = await page.evaluate(id => HortOpsApp.state.allShifts.find(s => s.shiftId === id).assignedStaffIds, shiftId);
    assert.deepEqual(assigned, ['EMP-SECTION-MEMBER']);
    checked('Manual allocation refuses a nonmember and saves only the eligible pool member');
    const cache = await page.evaluate(() => {
      const job = { ...HortOpsApp.state.jobs.find(j => j.id === 'JOB-SECTIONS'), id: 'JOB-CACHE-SECTIONS',
        workPattern: { mode: 'run', startDate: '2026-12-31', runLength: 2, includePublicHolidays: false, excludedDates: [] } };
      const off = { ...job, staffingSections: { teams: false, pools: false } };
      const engine = HortOpsSchedulerEngine;
      const onSignature = engine._getJobsSignature([job]), offSignature = engine._getJobsSignature([off]);
      const a = engine.getAdjacentBoundaryShifts('2026-12-31', [job], {}, HortOpsApp.state.staffList, {});
      const b = engine.getAdjacentBoundaryShifts('2026-12-31', [off], {}, HortOpsApp.state.staffList, {});
      const home = HortOpsApp.state.staffList.find(s => s.id === 'EMP-SECTION-HOME');
      const evalA = HortOpsEligibilityEngine.validateStaffEligibility(home, a[0], job, a, []);
      const evalB = HortOpsEligibilityEngine.validateStaffEligibility(home, b[0], off, b, []);
      return { onSignature, offSignature, same: a === b, a: evalA, b: evalB };
    });
    assert.notEqual(cache.onSignature, cache.offSignature); assert.equal(cache.same, false);
    assert.equal(cache.a.eligible, false); assert.equal(cache.b.eligible, true);
    checked('Staffing switches invalidate boundary cache signatures and change fresh eligibility without stale reuse');
    const peer = await context.newPage(); peer.on('pageerror', e => errors.push(e.stack));
    await peer.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await peer.waitForFunction(() => HortOpsWriterSession.status().mode === 'read-only');
    const peerBefore = await source(peer);
    assert.equal(await peer.evaluate(() => HortOpsApp.saveJob({ ...HortOpsApp.state.jobs.find(j => j.id === 'JOB-SECTIONS'), staffingSections: { teams: false, pools: false } }).success), false);
    assert.equal(await source(page), peerBefore);
    checked('Readonly peer cannot change job staffing switches');
    await peer.close(); assert.deepEqual(errors, []); report.passed = true;
    console.log('JOB STAFFING SECTION CHECKS PASSED: ' + checks.length);
  } finally {
    await context.close(); await browser.close();
    const folder = path.join(root, 'test_reports/job-staffing-sections'); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
