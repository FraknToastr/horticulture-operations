'use strict';
// Stage 4C independent browser proof. Fixtures, runtime and outputs stay child-local.
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
async function domains(page) {
  return page.evaluate(() => JSON.stringify(Object.fromEntries([
    'staffList', 'jobs', 'poolTags', 'assignments', 'customAssignments', 'historicalSnapshots',
    'rostering', 'refusalHistory', 'permits', 'allShifts'
  ].map(k => [k, HortOpsApp.state[k]]))));
}
async function model(page, shiftId) {
  return page.evaluate(id => {
    const c = HortOpsApp.getSavedCandidatePreviewContext(id);
    if (!c) throw new Error('Missing saved occurrence ' + id);
    return HortOpsCandidatePreview.build(c);
  }, shiftId);
}
async function main() {
  const playwright = loadPlaywright();
  const browser = await playwright.chromium.launch({ headless: true });
  report.browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  try {
    const page = await context.newPage();
    page.on('pageerror', e => errors.push('After ' + checks.at(-1) + ': ' + e.stack));
    page.on('dialog', d => { dialogs.push(d.message()); return d.dismiss(); });
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href); await ready(page);
    assert.equal(await page.evaluate(() => !!window.HortOpsCandidatePreviewModal && !!window.HortOpsCandidatePreview), true,
      'Build standalone before running candidate preview proof');
    const setup = await page.evaluate(() => {
      const rows = [
        ['PREF', 'Zulu Preferred', 'Roads', 'TRUE', 'active'],
        ['HOME', 'Alpha Home', 'Parks', 'FALSE', 'active'],
        ['OTHER', 'Bravo Other', 'Libraries', 'FALSE', 'active'],
        ['INACTIVE', 'Inactive member', 'Roads', 'FALSE', 'inactive'],
        ['EXEMPT', 'Exempt member', 'Roads', 'FALSE', 'active'],
        ['UNAVAILABLE', 'Unavailable member', 'Roads', 'FALSE', 'active'],
        ['UNSAFE', '<img src=x onerror="window.previewInjected=1">', 'Roads', 'FALSE', 'active']
      ];
      const csv = 'ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\n' + rows.map(([id, name, team, operator, status]) =>
        ['EMP-PREVIEW-' + id, name, id.toLowerCase() + '@example.test', 'Operations', team, 'Worker', operator, status].join(',')).join('\n') + '\n';
      const parsed = HortOpsUserCsvParser.parseUserCsv(csv, []);
      const imported = HortOpsApp.importStaffMembers(parsed.staff);
      const pools = HortOpsApp._commitCanonicalProposal({ poolTags: [{ id: 'POOL-PREVIEW', label: 'PreviewPool', active: true }] });
      const updates = ['PREF', 'INACTIVE', 'EXEMPT', 'UNAVAILABLE', 'UNSAFE'].map(id => HortOpsApp.updateStaffMember({
        id: 'EMP-PREVIEW-' + id, poolTagIds: ['POOL-PREVIEW'],
        ...(['EXEMPT', 'INACTIVE'].includes(id) ? { isOvertimeExempt: true } : {}),
        ...(id === 'UNAVAILABLE' ? { status: 'temporarily_unavailable' } : {})
      }).success);
      const job = HortOpsApp.saveJob({
        id: 'JOB-PREVIEW', name: 'Preview <script>window.previewInjected=2</script>', category: 'Parks',
        frequencyType: 'work_pattern', workPattern: { mode: 'weekly', startDate: '2026-01-01', days: [6, 0], includePublicHolidays: true, excludedDates: [] },
        preferredPoolTagIds: ['POOL-PREVIEW'], primaryTeam: 'Parks',
        startTime: '06:00 AM', durationHours: 6, crewSize: 2, plantOperatorRequired: true, status: 'active', color: '#047857'
      });
      return { parsed: parsed.success, imported: imported.success, pools: pools.success, updates, job: job.success, error: job.error };
    });
    assert.equal(setup.parsed, true); assert.equal(setup.imported, true); assert.equal(setup.pools, true);
    assert.deepEqual(setup.updates, [true, true, true, true, true]); assert.equal(setup.job, true, setup.error);
    checked('Real User Table import supplies zero hours and saved pool/job fixtures');
    const shiftId = 'JOB-PREVIEW@2026-12-25';
    const beforeBytes = await source(page), beforeDomains = await domains(page);
    const preview = await model(page, shiftId);
    assert(preview.eligible.some(s => s.id === 'EMP-PREVIEW-PREF'));
    assert(preview.excluded.some(s => s.id === 'EMP-PREVIEW-INACTIVE'));
    assert(preview.excluded.some(s => s.id === 'EMP-PREVIEW-EXEMPT'));
    const canonical = await page.evaluate(id => {
      const c = HortOpsApp.getSavedCandidatePreviewContext(id);
      const assigned = c.occurrence.assignedStaffIds || [];
      return c.state.staffList.map(s => ({ id: s.id, ...HortOpsEligibilityEngine.validateStaffEligibility(s, c.occurrence, c.job, c.allShifts, assigned) }));
    }, shiftId);
    for (const expected of canonical) {
      const row = [...preview.eligible, ...preview.excluded, ...preview.assigned].find(s => s.id === expected.id);
      assert(row, 'Every employee, including excluded employees, appears: ' + expected.id);
      assert.equal(row.eligible, expected.eligible, expected.id);
      assert.deepEqual(row.reasons.map(r => r.code).sort(), [...expected.reasons].sort(), expected.id);
    }
    checked('Every workforce record exposes all canonical eligibility reasons');
    const multiplyBlocked = preview.excluded.find(s => s.id === 'EMP-PREVIEW-INACTIVE');
    assert(multiplyBlocked.reasons.some(r => r.code === 'EMPLOYMENT_INACTIVE'));
    assert(multiplyBlocked.reasons.some(r => r.code === 'OVERTIME_EXEMPT'));
    assert.equal(preview.crew.compliant, false);
    checked('Multiple simultaneous hard restrictions and missing crew operator remain visible');
    const expectedOrder = await page.evaluate(id => {
      const c = HortOpsApp.getSavedCandidatePreviewContext(id), j = c.job;
      const prefs = { primaryTeam: j.primaryTeam || j.defaultTeam || j.preferredTeam || '', secondaryTeam: j.secondaryTeam, tertiaryTeam: j.tertiaryTeam, isExclusive: j.isExclusiveTeams, exclusiveTeams: j.exclusiveTeams || [] };
      const list = HortOpsStaffAssignCandidateModel.filterCandidates(c.state.staffList, { shift: c.occurrence, allShifts: c.allShifts, stagedAssignedStaffIds: c.occurrence.assignedStaffIds || [], matchingJob: j, jobPreferences: prefs });
      return HortOpsStaffAssignCandidateModel.sortCandidates(list, { assignedIdsSet: new Set(c.occurrence.assignedStaffIds || []), prefs, matchingJob: j, asOfDate: c.occurrence.date })
        .filter(s => HortOpsEligibilityEngine.validateStaffEligibility(s, c.occurrence, j, c.allShifts, c.occurrence.assignedStaffIds || []).eligible).map(s => s.id);
    }, shiftId);
    assert.deepEqual(preview.eligible.map(s => s.id), expectedOrder);
    assert.equal(preview.eligible[0].id, 'EMP-PREVIEW-PREF');
    checked('Preview ordering exactly matches current comparator and preferred tag tier');
    const imported = preview.eligible.find(s => s.id === 'EMP-PREVIEW-HOME');
    assert.equal(imported.ranking.overtimeHours, 0); assert.equal(imported.ranking.hoursVerified, false);
    assert.equal(imported.ranking.hoursSource, 'stored-zero-unverified');
    assert.match(JSON.stringify(preview.evidenceGaps), /regular|rest/i);
    checked('Imported numeric zero remains unverified and regular-work evidence gap is explicit');
    assert.equal(await source(page), beforeBytes); assert.equal(await domains(page), beforeDomains);
    checked('Detached explanation model leaves exact saved bytes and live domain records untouched');
    const detachedPurity = await page.evaluate(id => {
      const state = HortOpsApp.state, originals = {};
      const fields = ['staffList', 'poolTags', 'jobs', 'allShifts', 'historicalSnapshots'];
      fields.forEach(k => { originals[k] = state[k]; });
      const original = HortOpsCandidatePreview.build(HortOpsApp.getSavedCandidatePreviewContext(id));
      let fresh;
      try {
        state.staffList = state.staffList.map(s => ({ ...s, status: 'inactive', name: 'Unsaved live employee' }));
        state.poolTags = state.poolTags.map(t => ({ ...t, active: false }));
        state.jobs = state.jobs.map(j => ({ ...j, name: 'Unsaved live job', requiredQualifications: ['WHITE_CARD'] }));
        state.allShifts = state.allShifts.map(s => ({ ...s, assignedStaffIds: ['EMP-PREVIEW-OTHER'] }));
        state.historicalSnapshots = {};
        fresh = HortOpsCandidatePreview.build(HortOpsApp.getSavedCandidatePreviewContext(id));
      } finally { fields.forEach(k => { state[k] = originals[k]; }); }
      return { original, fresh };
    }, shiftId);
    assert.deepEqual(detachedPurity.fresh, detachedPurity.original, 'Saved preview ignores live-domain drift and global projection fallbacks');
    assert.equal(await source(page), beforeBytes); assert.equal(await domains(page), beforeDomains);
    checked('Saved context isolates eligibility, pool ranking and occurrence projection from unsaved live drift');
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const locksBefore = await page.evaluate(() => HortOpsModalUtils.getActiveModalCount());
    await page.evaluate(id => HortOpsCandidatePreviewModal.open(id), shiftId);
    const modal = page.locator('#candidate-preview-modal-root');
    assert.match(await modal.innerText(), /2026-12-25/);
    assert.match(await modal.innerText(), /unverified/i);
    assert.match(await modal.innerText(), /Plant.operator/i);
    assert.equal(await modal.locator('img,script').count(), 0);
    assert.equal(await page.evaluate(() => window.previewInjected || 0), 0);
    assert.match(await modal.innerText(), /<img src=x/);
    assert.match(await modal.innerText(), /<script>/);
    checked('Modal names the occurrence, crew and evidence gaps and escapes saved staff/job text');
    const imageFolder = path.join(root, 'test_reports/candidate-preview'); fs.mkdirSync(imageFolder, { recursive: true });
    await page.screenshot({ path: path.join(imageFolder, 'preview-desktop.png') });
    assert.equal(await modal.locator('button:not([data-candidate-preview-action="close"]):not([data-candidate-preview-action="refresh"])').count(), 0, 'Preview exposes close/refresh actions only');
    assert.equal(await modal.locator('input,select,textarea,[onclick*="saveAllocation"],[onclick*="addStaff"]').count(), 0);
    checked('Preview has no allocation, workforce or instruction editing controls');
    const geometry = await page.evaluate(() => {
      const root = document.querySelector('#candidate-preview-modal-root');
      const scrollBody = root.querySelector('.modal-body') || root.querySelector('.candidate-preview-body');
      return { locked: document.body.style.position === 'fixed' || ['hidden', 'clip'].includes(getComputedStyle(document.body).overflowY),
        body: !!scrollBody, overscroll: scrollBody && getComputedStyle(scrollBody).overscrollBehaviorY };
    });
    assert.equal(geometry.locked, true); assert.equal(geometry.body, true); assert(['contain', 'none'].includes(geometry.overscroll));
    const lockedY = await page.evaluate(() => window.scrollY);
    await modal.locator('.candidate-preview-body').evaluate(node => { node.scrollTop = node.scrollHeight; });
    await modal.locator('.candidate-preview-body').hover();
    await page.mouse.wheel(0, 600);
    assert.equal(await page.evaluate(() => window.scrollY), lockedY, 'Boundary wheel cannot move background');
    for (const viewport of [{ width: 800, height: 400 }, { width: 390, height: 700 }]) {
      await page.setViewportSize(viewport);
      const actionBoxes = await modal.locator('button').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }));
      assert(actionBoxes.every(r => r.top >= 0 && r.bottom <= viewport.height && r.left >= 0 && r.right <= viewport.width), 'Short/narrow viewport keeps close/refresh accessible');
      assert.equal(await modal.locator('.candidate-preview-modal').evaluate(n => n.scrollWidth <= n.clientWidth), true, 'Overflow remains within table body');
      if (viewport.width === 390) {
        await modal.locator('.candidate-preview-body').evaluate(n => { n.scrollTop = 0; });
        await page.screenshot({ path: path.join(imageFolder, 'preview-mobile.png') });
      }
    }
    await page.setViewportSize({ width: 1200, height: 700 });
    await modal.locator('[data-candidate-preview-action="refresh"]').click();
    await modal.locator('[data-candidate-preview-action="close"]').first().click();
    assert.equal(await source(page), beforeBytes); assert.equal(await domains(page), beforeDomains);
    assert.notEqual(await page.evaluate(() => document.body.style.position), 'fixed');
    assert.equal(await page.evaluate(() => window.scrollY), scrollBefore);
    assert.equal(await page.evaluate(() => HortOpsModalUtils.getActiveModalCount()), locksBefore);
    assert.equal(await page.evaluate(() => document.body.classList.contains('modal-scroll-locked')), false);
    checked('Open/refresh/close preserve data and modal scrolling contracts at short viewport');
    await page.evaluate(id => HortOpsCandidatePreviewModal.open(id), shiftId);
    assert.equal(await page.evaluate(() => HortOpsApp.updateStaffMember({ id: 'EMP-PREVIEW-HOME', name: 'Changed saved name' }).success), true);
    await page.evaluate(() => HortOpsCandidatePreviewModal.checkFreshness());
    assert.equal(await modal.locator('.candidate-preview-stale').count(), 1);
    assert.equal(await modal.locator('[data-candidate-preview-staff]').count(), 0, 'Stale results must not retain current-looking eligibility rows');
    await modal.locator('[data-candidate-preview-action="refresh"]').click();
    assert.match(await modal.innerText(), /Changed saved name/);
    await modal.locator('[data-candidate-preview-action="close"]').first().click();
    checked('Canonical changes hide stale eligibility claims until fresh saved-state refresh');
    const unavailableBytes = await source(page), unavailableDomains = await domains(page);
    const deniedRead = await page.evaluate(id => {
      const original = HortOpsStorage.readVerifiedCommittedV2;
      let opened, text, rows;
      try {
        HortOpsStorage.readVerifiedCommittedV2 = () => { throw new Error('Synthetic denied saved-workspace read'); };
        opened = HortOpsCandidatePreviewModal.open(id);
        const root = document.getElementById('candidate-preview-modal-root');
        text = root.innerText; rows = root.querySelectorAll('[data-candidate-preview-staff]').length;
      } finally { HortOpsCandidatePreviewModal.close(); HortOpsStorage.readVerifiedCommittedV2 = original; }
      return { opened, text, rows };
    }, shiftId);
    assert.equal(deniedRead.opened, false); assert.equal(deniedRead.rows, 0); assert.match(deniedRead.text, /Preview unavailable/);
    assert.match(deniedRead.text, /denied saved-workspace read/);
    assert.equal(await source(page), unavailableBytes); assert.equal(await domains(page), unavailableDomains);
    checked('Denied verified saved-data read fails closed without rows or source/domain changes');
    const corruptRead = await page.evaluate(id => {
      const key = HortOpsClientStorage.workspaceKey, original = localStorage.getItem(key), malformed = '{stage4c-corrupt-source';
      let opened, preserved, text, rows;
      try {
        localStorage.setItem(key, malformed);
        opened = HortOpsCandidatePreviewModal.open(id);
        const root = document.getElementById('candidate-preview-modal-root');
        text = root.innerText; rows = root.querySelectorAll('[data-candidate-preview-staff]').length;
        preserved = localStorage.getItem(key) === malformed;
      } finally { HortOpsCandidatePreviewModal.close(); localStorage.setItem(key, original); }
      return { opened, preserved, text, rows };
    }, shiftId);
    assert.equal(corruptRead.opened, false); assert.equal(corruptRead.rows, 0); assert.equal(corruptRead.preserved, true);
    assert.match(corruptRead.text, /Preview unavailable/);
    assert.equal(await source(page), unavailableBytes); assert.equal(await domains(page), unavailableDomains);
    checked('Corrupt saved source stays untouched and no fallback eligibility is displayed');
    const absent = await page.evaluate(() => {
      const opened = HortOpsCandidatePreviewModal.open('JOB-NO-SAVED-OCCURRENCE@2026-12-25');
      const root = document.getElementById('candidate-preview-modal-root');
      const result = { opened, text: root.innerText, rows: root.querySelectorAll('[data-candidate-preview-staff]').length };
      HortOpsCandidatePreviewModal.close(); return result;
    });
    assert.equal(absent.opened, false); assert.equal(absent.rows, 0); assert.match(absent.text, /no longer present|no longer available/i);
    assert.equal(await source(page), unavailableBytes); assert.equal(await domains(page), unavailableDomains);
    checked('Missing saved occurrence fails closed and preserves all workspace domains');
    const stagedBytes = await source(page), stagedDomains = await domains(page);
    await page.evaluate(id => { HortOpsStaffAssignModal.open(id); HortOpsStaffAssignModal.addStaff('EMP-PREVIEW-HOME'); }, shiftId);
    const savedPreview = await model(page, shiftId);
    assert.equal(savedPreview.assigned.length, 0, 'Allocation staging cannot masquerade as saved crew');
    await page.evaluate(() => HortOpsStaffAssignModal.close());
    assert.equal(await source(page), stagedBytes); assert.equal(await domains(page), stagedDomains);
    checked('Unsaved allocation staging is excluded from saved-state preview');
    // Allocation remains independently validated: the preview cannot grant authority.
    await page.evaluate(id => HortOpsStaffAssignModal.open(id), shiftId);
    const denyBytes = await source(page);
    await page.evaluate(() => HortOpsStaffAssignModal.addStaff('EMP-PREVIEW-INACTIVE'));
    assert.equal(await page.evaluate(() => HortOpsStaffAssignModal.stagedAssignedStaffIds.includes('EMP-PREVIEW-INACTIVE')), false);
    await page.evaluate(() => HortOpsStaffAssignModal.close());
    assert.equal(await source(page), denyBytes);
    checked('Allocation independently refuses a blocked staff member after preview use');
    // Commit one valid operator through existing allocation controls.
    await page.evaluate(id => HortOpsStaffAssignModal.open(id), shiftId);
    await page.locator('button[onclick*="addStaff"][onclick*="EMP-PREVIEW-PREF"]').click();
    await page.locator('button[onclick*="addStaff"][onclick*="EMP-PREVIEW-HOME"]').click();
    await page.locator('button[onclick*="saveAllocation"]').click();
    assert.equal(await page.evaluate(() => !HortOpsStaffAssignModal.activeShiftId), true, 'Valid allocation closes editor: ' + JSON.stringify(dialogs));
    await page.waitForFunction(() => !HortOpsStaffAssignModal.activeShiftId);
    const committed = await model(page, shiftId);
    assert.deepEqual(committed.assigned.map(s => s.id).sort(), ['EMP-PREVIEW-HOME', 'EMP-PREVIEW-PREF']);
    assert(committed.eligible.every(s => !committed.assigned.some(a => a.id === s.id)));
    assert.equal(committed.crew.compliant, true);
    checked('Saved assigned crew is separate from candidates and eligible operator satisfies crew contract');
    const restrictions = await page.evaluate(id => {
      const c = HortOpsApp.getSavedCandidatePreviewContext(id);
      const variants = [
        { ...c.job, exclusivePoolSource: 'tags', exclusivePoolTagIds: ['POOL-PREVIEW'] },
        { ...c.job, exclusivePoolSource: 'teams', isExclusiveTeams: true, exclusiveTeams: ['Roads'] },
        { ...c.job, requiredQualifications: ['WHITE_CARD'] }
      ];
      return variants.map(job => {
        const occurrence = { ...c.occurrence, assignedStaffIds: [], plantOperatorRequired: false };
        const preview = HortOpsCandidatePreview.build({ ...c, job, occurrence });
        return { preview, expected: c.state.staffList.map(s => ({ id: s.id, ...HortOpsEligibilityEngine.validateStaffEligibility(s, occurrence, job, c.allShifts, []) })) };
      });
    }, shiftId);
    for (const { preview: p, expected } of restrictions) for (const e of expected) {
      const row = [...p.eligible, ...p.excluded, ...p.assigned].find(s => s.id === e.id);
      assert.equal(row.eligible, e.eligible); assert.deepEqual(row.reasons.map(r => r.code).sort(), e.reasons.sort());
    }
    checked('Exclusive tags, exclusive teams and required qualifications match canonical hard checks');
    const boundary = await page.evaluate(id => {
      const c = HortOpsApp.getSavedCandidatePreviewContext(id), staff = c.state.staffList.find(s => s.id === 'EMP-PREVIEW-OTHER');
      return ['2026-04-01', '2026-04-03', '2026-12-31', '2027-01-01'].map(date => {
        const occurrence = { ...c.occurrence, date, shiftId: c.job.id + '@' + date, startTime: '10:00 PM', durationHours: 8, assignedStaffIds: [] };
        const other = { ...occurrence, jobId: 'JOB-PREVIEW-OTHER', shiftId: 'JOB-PREVIEW-OTHER@' + date, startTime: '11:00 PM', assignedStaffIds: [staff.id] };
        const allShifts = [occurrence, other];
        const preview = HortOpsCandidatePreview.build({ ...c, occurrence, allShifts });
        const row = [...preview.eligible, ...preview.excluded].find(s => s.id === staff.id);
        const canonical = HortOpsEligibilityEngine.validateStaffEligibility(staff, occurrence, c.job, allShifts, []);
        return { date, row, canonical };
      });
    }, shiftId);
    for (const b of boundary) {
      assert.equal(b.row.eligible, b.canonical.eligible); assert.equal(b.row.eligible, false);
      assert.deepEqual(b.row.reasons.map(r => r.code).sort(), b.canonical.reasons.sort());
      assert(b.canonical.reasons.includes('OVERLAPPING_SHIFT'));
    }
    checked('Overnight, weekday holiday and month/year boundary previews use canonical interval checks');
    const run = await page.evaluate(() => HortOpsApp.saveJob({
      id: 'JOB-PREVIEW-RUN', name: 'Four-day boundary run', category: 'Parks', frequencyType: 'work_pattern',
      workPattern: { mode: 'run', startDate: '2026-12-30', runLength: 4, includePublicHolidays: false, excludedDates: [] },
      startTime: '10:00 PM', durationHours: 8, crewSize: 2, status: 'active', color: '#047857'
    }));
    assert.equal(run.success, true, run.error);
    const boundaryBytes = await source(page), boundaryDomains = await domains(page);
    const crossYear = await page.evaluate(() => ['2026-12-31', '2027-01-01'].map(date => {
      const c = HortOpsApp.getSavedCandidatePreviewContext('JOB-PREVIEW-RUN@' + date);
      return { date: c.occurrence.date, shiftIds: c.allShifts.map(s => s.shiftId), model: HortOpsCandidatePreview.build(c) };
    }));
    for (const c of crossYear) {
      assert.equal(c.model.summary.date, c.date);
      assert(c.shiftIds.includes('JOB-PREVIEW-RUN@2026-12-31'));
      assert(c.shiftIds.includes('JOB-PREVIEW-RUN@2027-01-01'));
      assert.equal(c.model.summary.startTime, '10:00 PM');
    }
    assert.equal(await source(page), boundaryBytes); assert.equal(await domains(page), boundaryDomains);
    checked('Saved multi-day run contexts resolve both years and adjacent intervals without changing live year or caches');
    const peer = await context.newPage();
    peer.on('pageerror', e => errors.push(e.stack)); peer.on('dialog', d => d.dismiss());
    await peer.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await peer.waitForFunction(() => HortOpsWriterSession.status().mode === 'read-only');
    await peer.evaluate(() => { HortOpsForwardPlanner.startWeekInitialized = true; HortOpsForwardPlanner.startWeek = 52; HortOpsForwardPlanner.windowSize = 6; HortOpsApp.setActiveView('forward_planner'); });
    const entry = peer.locator('[data-candidate-preview="' + shiftId + '"]').first();
    assert.equal(await entry.count(), 1); assert.equal(await entry.isEnabled(), true);
    const peerBytes = await source(peer), peerDomains = await domains(peer);
    await entry.click();
    const peerModal = peer.locator('#candidate-preview-modal-root');
    assert.match(await peerModal.innerText(), /2026-12-25/);
    assert.equal(await peerModal.locator('[data-candidate-preview-action="refresh"]').isEnabled(), true);
    await peerModal.locator('[data-candidate-preview-action="refresh"]').click();
    await peerModal.locator('[data-candidate-preview-action="close"]').first().click();
    assert.equal(await source(peer), peerBytes); assert.equal(await domains(peer), peerDomains);
    assert.equal(await peer.evaluate(() => HortOpsApp.updateStaffMember({ id: 'EMP-PREVIEW-HOME', name: 'Forbidden peer' }).success), false);
    assert.equal(await source(page), peerBytes);
    checked('Readonly peer can preview/refresh/close while domain writes remain blocked and bytes unchanged');
    await peer.evaluate(id => HortOpsCandidatePreviewModal.open(id), shiftId);
    assert.equal(await page.evaluate(() => HortOpsApp.updateStaffMember({ id: 'EMP-PREVIEW-HOME', name: 'Newer writer-saved employee' }).success), true);
    const changedBytes = await source(page), changedPeerDomains = await domains(peer);
    await peerModal.locator('.candidate-preview-stale').waitFor({ timeout: 5000 });
    assert.equal(await peerModal.locator('[data-candidate-preview-staff]').count(), 0);
    await peerModal.locator('[data-candidate-preview-action="refresh"]').click();
    assert.match(await peerModal.innerText(), /Newer writer-saved employee/);
    assert.equal(await source(peer), changedBytes); assert.equal(await domains(peer), changedPeerDomains);
    await peerModal.locator('[data-candidate-preview-action="close"]').first().click();
    checked('Readonly peer automatically invalidates older saved results and refreshes newer writer data without writes');
    await peer.evaluate(id => HortOpsCandidatePreviewModal.open(id), shiftId);
    await page.evaluate(() => HortOpsWriterSession.release());
    await peer.evaluate(() => HortOpsWriterSession.acquire()); await ready(peer);
    const transferBytes = await source(peer);
    await peer.evaluate(() => { HortOpsCandidatePreviewModal.refresh(); HortOpsCandidatePreviewModal.close(); });
    assert.equal(await source(peer), transferBytes);
    assert.equal(await peer.locator('[onclick*="saveAllocation"]').count(), 0);
    await peer.evaluate(() => HortOpsWriterSession.release());
    await page.evaluate(() => HortOpsWriterSession.acquire()); await ready(page);
    await page.evaluate(() => { HortOpsCandidatePreviewModal.refresh(); HortOpsCandidatePreviewModal.close(); });
    assert.equal(await source(page), transferBytes);
    checked('Ownership transfer discards stale preview and never enables retained allocation callbacks');
    await peer.close();
    assert.deepEqual(errors, []); report.passed = true;
    console.log('CANDIDATE PREVIEW CHECKS PASSED: ' + checks.length);
  } finally {
    await context.close(); await browser.close();
    const folder = path.join(root, 'test_reports/candidate-preview'); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
