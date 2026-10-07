'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { loadPlaywright, repoRoot } = require('./local-test-environment.cjs');
const root = repoRoot();
const output = path.join(root, 'test_reports/phase6');
fs.mkdirSync(output, { recursive: true });
const checks = [], pageErrors = [];
function pass(name) { checks.push(name); console.log('[PASS] ' + name); }
const valid = ['#123', '#abcd', '#12AbEF', '#12345678'];
const invalid = [
  'red;" onmouseover="window.__colorAttack=1" data-attack="1',
  '#123456; color:red', 'red', 'transparent', 'rgb(1,2,3)',
  'url(javascript:alert(1))', 'var(--custom)', '#123456\\22 onmouseover=x',
  '#123456&#34; onmouseover=x', '#123456\n', ' #123456', '#12', '#12345',
  '#123456789', '<svg onload=alert(1)>', '\\72 ed', 123456, {}, [], true
];
const ctx = { window: {}, console, Date, Map, Set };
for (const file of ['js/data/initialJobs.js', 'js/data/staffRoster.js', 'js/utils/qualifications.js',
  'js/utils/securityUtils.js', 'js/utils/planningRules.js', 'js/utils/storage/schemaValidator.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
}
const validator = ctx.window.HortOpsSchemaValidator;
const baseJob = JSON.parse(JSON.stringify(ctx.window.HortOpsData.INITIAL_JOBS[0]));
const baseStaff = JSON.parse(JSON.stringify(ctx.window.HortOpsData.STAFF_ROSTER[0]));
function envelope(color, field) {
  const job = Object.assign({}, baseJob), staff = Object.assign({}, baseStaff);
  if (field === 'job') job.color = color;
  else staff.avatarColor = color;
  if (color === undefined) {
    if (field === 'job') delete job.color; else delete staff.avatarColor;
  }
  return { schemaVersion: 2, jobs: [job], roster: [staff], assignments: {},
    rostering: { instructions: {}, provenance: {} }, historicalSnapshots: {}, permits: {},
    budgetSettings: {}, uiState: {}, absences: [], refusalHistory: [] };
}
for (const field of ['job', 'staff']) {
  for (const color of valid.concat([undefined, null, ''])) {
    const data = envelope(color, field);
    const result = validator.validateCurrentV2ForBoundary(data);
    assert.equal(result.valid, true, field + ': ' + JSON.stringify(color) + ': ' + result.error);
    assert.equal(field === 'job' ? data.jobs[0].color : data.roster[0].avatarColor, color);
  }
  for (const color of invalid) {
    assert.equal(validator.validateCurrentV2ForBoundary(envelope(color, field)).valid, false,
      field + ': ' + JSON.stringify(color));
  }
}
pass('job and workforce boundaries reject 20 hostile/malformed colours and preserve valid/absent values');
const snapshot = { shiftId: 'COLOR-JOB@2026-10-10', jobId: 'COLOR-JOB', date: '2026-10-10',
  startTime: '08:00 AM', durationHours: 2, color: '#123456' };
assert.equal(validator.validateScheduledCommitment(snapshot.shiftId, snapshot).valid, true);
for (const color of invalid) {
  assert.equal(validator.validateScheduledCommitment(snapshot.shiftId, { ...snapshot, color }).valid, false);
  assert.equal(validator.validateScheduledCommitment(snapshot.shiftId,
    { ...snapshot, job: { color } }).valid, false);
}
pass('historical commitment colours and embedded job colours fail closed without changing valid history');

async function main() {
  const browser = await loadPlaywright().chromium.launch({ headless: true });
  const report = { browserVersion: browser.version(), checks, pageErrors, passed: false };
  const url = pathToFileURL(path.join(root, 'index.html')).href;
  const key = 'hort_ops_workspace_v2_single_writer_v1';
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => window.HortOpsWriterSession && HortOpsWriterSession.canWrite());
    assert.equal(await page.evaluate(() => {
      const csv = 'ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\nCOLOR-WORKER,Colour Worker,worker@example.test,Horticulture,Parks,Gardener,FALSE,active\n';
      const parsed = HortOpsUserCsvParser.parseUserCsv(csv, []);
      const workforce = HortOpsApp.importStaffMembers(parsed.staff);
      const job = HortOpsApp.saveJob({ id: 'COLOR-JOB', name: 'Colour Job', category: 'Parks',
        frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-10-10',
        preferredDay: 'saturday', startTime: '08:00 AM', durationHours: 2, crewSize: 1,
        status: 'active', color: '#12AbEF' });
      return workforce.success && job.success;
    }), true);
    const saved = await page.evaluate(key => localStorage.getItem(key), key);
    const denied = await page.evaluate(({ invalid, key }) => {
      const before = localStorage.getItem(key), jobs = JSON.stringify(HortOpsApp.state.jobs),
        staff = JSON.stringify(HortOpsApp.state.staffList);
      const results = [];
      for (const color of invalid) {
        for (const field of ['job', 'staff']) {
          const bad = JSON.parse(before);
          if (field === 'job') bad.jobs[0].color = color;
          else bad.roster[0].avatarColor = color;
          results.push(!HortOpsStorage.prepareWorkspaceJsonImport(JSON.stringify(bad)).success);
          results.push(HortOpsApp.restoreWorkspaceJson(bad) === false);
          results.push(!HortOpsStorage.saveWorkspace(bad).success);
        }
        results.push(!HortOpsApp.saveJob({ ...HortOpsApp.state.jobs[0], color }).success);
        results.push(!HortOpsApp.importStaffMembers([{ ...HortOpsApp.state.staffList[0], avatarColor: color }]).success);
      }
      return { allDenied: results.every(Boolean), bytes: before === localStorage.getItem(key),
        jobs: jobs === JSON.stringify(HortOpsApp.state.jobs), staff: staff === JSON.stringify(HortOpsApp.state.staffList) };
    }, { invalid, key });
    assert.deepEqual(denied, { allDenied: true, bytes: true, jobs: true, staff: true });
    pass('live JSON preparation/restore, driver saves and job/workforce commands reject attacks without changing saved bytes or records');

    // Exercise the real file input and asynchronous FileReader import path.
    await page.evaluate(() => HortOpsApp.openImportModal());
    const badImport = JSON.parse(saved); badImport.roster[0].avatarColor = invalid[0];
    await page.locator('#staff-csv-file-input').setInputFiles({ name: '<img onerror="window.__colorAttack=1">.json',
      mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(badImport)) });
    await page.waitForFunction(() => document.getElementById('import-error-area').textContent.includes('invalid avatar colour'));
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), saved);
    assert.equal(await page.locator('#import-modal-root img').count(), 0);
    assert.equal(await page.locator('#import-error-area').isVisible(), true);
    await page.locator('#staff-csv-file-input').setInputFiles({ name: 'valid-workspace.json',
      mimeType: 'application/json', buffer: Buffer.from(saved) });
    await page.waitForFunction(() => HortOpsImportModal.pendingJsonBackup !== null);
    assert.equal(await page.locator('#import-error-area').isVisible(), false);
    await page.evaluate(() => HortOpsImportModal.close());
    pass('file-input JSON import reports invalid colour and preserves the committed workspace');

    const renderResult = await page.evaluate(payload => {
      const forged = JSON.parse(JSON.stringify(HortOpsApp.state));
      forged.jobs[0].color = payload; forged.staffList[0].avatarColor = payload;
      for (const shift of forged.allShifts) shift.color = payload;
      for (const slot of forged.slots) {
        slot.isOverloaded = true;
        for (const shift of slot.shifts) { shift.color = payload; if (shift.job) shift.job.color = payload; }
      }
      const firstSlot = forged.slots.find(slot => slot.shifts.length);
      const allocatedId = firstSlot.shifts[0].shiftId;
      for (const shift of forged.allShifts.concat(firstSlot.shifts)) {
        if (shift.shiftId === allocatedId) shift.assignedStaffIds = [forged.staffList[0].id];
      }
      const originalState = HortOpsApp.state, originalView = { ...HortOpsForwardPlanner };
      const parts = {};
      try {
        HortOpsApp.state = forged;
        HortOpsJobRegistry.selectedJobId = forged.jobs[0].id;
        parts.jobs = HortOpsJobRegistry.render(forged);
        parts.staff = HortOpsStaffRegistry.render(forged);
        parts.candidates = HortOpsStaffAssignCandidateList.render({ filteredStaff: forged.staffList });
        parts.stagedCrew = HortOpsStaffAssignStagedCrew.render({ shift: forged.allShifts[0],
          assignedStaffList: forged.staffList, stagedAssignedStaffIds: [forged.staffList[0].id], allShifts: [] });
        HortOpsForwardPlanner.selectedJobId = forged.jobs[0].id;
        HortOpsForwardPlanner.startWeek = firstSlot.weekNumber;
        HortOpsForwardPlanner.startWeekInitialized = true;
        HortOpsForwardPlanner.filterDrawerOpen = true;
        parts.forward = HortOpsForwardPlanner.render(forged);
        HortOpsCalendarView.selectedMonth = 10;
        parts.calendar = HortOpsCalendarView.render(forged);
        parts.peaks = HortOpsPeakWeekends.render(forged);
        HortOpsJobEditModal.open(forged.jobs[0].id);
        parts.jobEditor = document.getElementById('job-edit-modal-root').innerHTML;
        HortOpsJobEditModal.close();
        HortOpsApp.openStaffAssignModal(forged.allShifts[0].shiftId);
        parts.assignment = document.getElementById('staff-assign-modal-root').innerHTML;
        HortOpsStaffAssignModal.close();
        HortOpsStaffAbsenceModal.open(forged.staffList[0].id);
        parts.absence = document.getElementById('staff-absence-modal-root').innerHTML;
        HortOpsStaffAbsenceModal.close();
      } finally {
        HortOpsApp.state = originalState;
        Object.assign(HortOpsForwardPlanner, originalView);
        HortOpsJobRegistry.selectedJobId = null;
      }
      const counts = {};
      window.__colorAttack = 0;
      for (const [name, html] of Object.entries(parts)) {
        const container = document.createElement('div');
        container.innerHTML = html; document.body.appendChild(container);
        counts[name] = container.querySelectorAll('[style]').length;
        if (!counts[name]) throw new Error('Colour sink was not rendered: ' + name);
        if (name === 'forward' && (!container.querySelector('.shift-card-btn') ||
            !container.querySelector('.unallocated-slot-card') || !container.querySelector('.job-filter-pill'))) {
          throw new Error('Both allocated/vacant cards and job-filter pills must be exercised');
        }
        for (const element of container.querySelectorAll('*')) {
          if (element.hasAttribute('onmouseover') || element.hasAttribute('data-attack') ||
              (element.getAttribute('style') || '').includes(payload)) throw new Error('Unsafe sink: ' + name);
          element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }
        container.remove();
      }
      return { counts, fired: window.__colorAttack };
    }, invalid[0]);
    assert.equal(renderResult.fired, 0);
    assert.equal(Object.keys(renderResult.counts).length, 10);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), saved);
    pass('ten real registry, inspector, planner, calendar and modal render paths produce no attacker attributes or executed mouseover handlers');
    for (const color of valid) {
      const preserved = await page.evaluate(color => {
        const prepared = JSON.parse(HortOpsClientStorage.localStorage.getItem(HortOpsStorage.WORKSPACE_STORAGE_KEY));
        prepared.jobs[0].color = color; prepared.roster[0].avatarColor = color;
        if (!HortOpsApp.restoreWorkspaceJson(prepared)) return false;
        const state = HortOpsApp.state;
        const box = document.createElement('div');
        box.innerHTML = HortOpsJobRegistry.render(state) + HortOpsStaffRegistry.render(state);
        const css = document.createElement('span'); css.style.backgroundColor = color;
        return state.jobs[0].color === color && state.staffList[0].avatarColor === color &&
          [...box.querySelectorAll('[style]')].filter(el => el.style.backgroundColor === css.style.backgroundColor).length >= 2;
      }, color);
      assert.equal(preserved, true, color);
    }
    pass('ordinary RGB/RGBA colours import unchanged and display as valid browser CSS');
    await context.close();
    for (const field of ['job', 'staff']) {
      const corrupted = JSON.parse(saved);
      if (field === 'job') corrupted.jobs[0].color = invalid[0]; else corrupted.roster[0].avatarColor = invalid[0];
      const raw = JSON.stringify(corrupted), recovery = await browser.newContext();
      await recovery.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
      const p = await recovery.newPage(); p.on('pageerror', error => pageErrors.push(error.message));
      await p.goto(url);
      await p.waitForFunction(() => window.HortOpsApp && HortOpsApp.state.recoveryRequired === true);
      assert.equal(await p.evaluate(() => HortOpsApp.saveCurrentWorkspace()), false);
      assert.equal(await p.evaluate(key => localStorage.getItem(key), key), raw);
      assert.equal(await p.locator('[onmouseover], [data-attack]').count(), 0);
      await recovery.close();
    }
    pass('hostile saved colours trigger recovery without executing markup or overwriting original bytes');
    assert.deepEqual(pageErrors, []);
    report.passed = true;
    console.log('COLOUR SECURITY CHECKS PASSED: ' + checks.length);
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(output, 'color-security-results.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
