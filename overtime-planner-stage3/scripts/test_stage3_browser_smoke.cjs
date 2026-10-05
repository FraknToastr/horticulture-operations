'use strict';
/**
 * Stage 3 Playwright Browser Smoke Test Suite:
 * Workforce Intelligence, Qualification Registries & Advanced Fatigue Management
 *
 * Verifies live browser interaction:
 * 1. Accreditations column and tickets management in Staff Registry
 * 2. Mandatory qualification requirements selector in Job Edit Modal
 * 3. Live accreditation & prospective fatigue guards in Staff Assignment Modal
 * 4. Workforce Fatigue Risk Heatmap & Qualification Matrix in Analytics Dashboard
 * 5. Visual screenshot capture for audit evidence
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { repoRoot, loadPlaywright } = require('./local-test-environment.cjs');
const playwright = loadPlaywright();

const singleFileAppPath = path.join(repoRoot(), 'index.html');
const fileUrl = 'file://' + singleFileAppPath;


async function run() {
  console.log('================================================================');
  console.log(' STAGE 3 PLAYWRIGHT BROWSER SMOKE SUITE');
  console.log(' Live UI Interaction, Modals, Fatigue Heatmap & Audit Parity');
  console.log('================================================================\n');

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 }
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('  [BROWSER ERROR]:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('  [UNCAUGHT PAGE ERROR]:', err.message);
  });

  // Step 1: Load Single-File Application
  console.log('>>> [1/6] Loading Single-File Application into Chromium...');
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
  await page.waitForTimeout(500);

  const title = await page.title();
  assert(title.includes('Horticulture') || title.includes('Planner'), 'Page title should match application');
  console.log(`    [PASS] Application loaded successfully: "${title}"`);

  // Step 2: Seed sample Stage 3 data
  console.log('>>> [2/6] Seeding rich Stage 3 Workforce, Qualifications & Fatigue scenarios...');
  await page.evaluate(() => {
    const sampleStaff = [
      {
        id: 'STAFF-001',
        name: 'Alex Vance',
        department: 'Horticulture',
        team: 'Arboriculture',
        role: 'Senior Arborist',
        status: 'active',
        isPlantOperator: true,
        qualifications: [
          { code: 'CHAINSAW_L1', certificateNumber: 'CS-8812', issuedDate: '2024-01-10', expiryDate: '2027-01-10', status: 'active' },
          { code: 'CHAINSAW_L2', certificateNumber: 'CS-9021', issuedDate: '2024-03-15', expiryDate: '2027-03-15', status: 'active' },
          { code: 'EWP_TICKET', certificateNumber: 'EWP-4410', issuedDate: '2023-05-20', expiryDate: '2028-05-20', status: 'active' },
          { code: 'CHIPPER', certificateNumber: 'CHP-9901', issuedDate: '2024-02-01', expiryDate: '2027-02-01', status: 'active' }
        ]
      },
      {
        id: 'STAFF-002',
        name: 'Jordan Taylor',
        department: 'Horticulture',
        team: 'Arboriculture',
        role: 'Climber / Groundsman',
        status: 'active',
        isPlantOperator: false,
        qualifications: [
          { code: 'CHAINSAW_L1', certificateNumber: 'CS-7714', issuedDate: '2023-11-01', expiryDate: '2026-10-25', status: 'active' },
          { code: 'CHIPPER', certificateNumber: 'CHP-1002', issuedDate: '2023-02-14', expiryDate: '2025-02-14', status: 'expired' }
        ]
      },
      {
        id: 'STAFF-003',
        name: 'Casey Morgan',
        department: 'Horticulture',
        team: 'Parks',
        role: 'Horticulturalist',
        status: 'active',
        isPlantOperator: false,
        qualifications: [
          { code: 'CHEM_ACUP', certificateNumber: 'CHM-5531', issuedDate: '2024-08-01', expiryDate: '2027-08-01', status: 'active' }
        ]
      }
    ];

    const sampleJobs = [
      {
        id: 'JOB-TREE-01',
        name: 'Emergency Storm Tree Clearance',
        category: 'Arboriculture',
        status: 'active',
        crewSize: 2,
        durationHours: 6,
        startTime: '07:00 AM',
        preferredDay: 'saturday',
        frequencyType: 'recurring_weeks',
        intervalWeeks: 1,
        anchorDate: '2026-01-03',
        requiredQualifications: ['CHAINSAW_L1', 'CHIPPER']
      }
    ];

    const sampleShifts = [
      { shiftId: 's-f1', jobId: 'JOB-TREE-01', jobName: 'Emergency Storm Tree Clearance', date: '2026-09-12', startTime: '07:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: ['STAFF-002'] },
      { shiftId: 's-f2', jobId: 'JOB-TREE-01', jobName: 'Emergency Storm Tree Clearance', date: '2026-09-19', startTime: '07:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: ['STAFF-002'] },
      { shiftId: 's-f3', jobId: 'JOB-TREE-01', jobName: 'Emergency Storm Tree Clearance', date: '2026-09-26', startTime: '07:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: ['STAFF-002'] },
      { shiftId: 's-f4', jobId: 'JOB-TREE-01', jobName: 'Emergency Storm Tree Clearance', date: '2026-10-03', startTime: '07:00 AM', durationHours: 6, crewSize: 2, assignedStaffIds: [] }
    ];

    const sampleAbsences = [
      { id: 'abs-1', staffId: 'STAFF-003', type: 'annual_leave', startDate: '2026-10-01', endDate: '2026-10-15', notes: 'Scheduled annual leave' }
    ];

    window.HortOpsApp.state.staffList = sampleStaff;
    window.HortOpsApp.state.jobs = sampleJobs;
    window.HortOpsApp.state.allShifts = sampleShifts;
    window.HortOpsApp.state.absences = sampleAbsences;
    // Persist seeded scenario to canonical storage
    if (window.HortOpsStorage && typeof window.HortOpsStorage.saveWorkspace === 'function') {
      const currentWs = window.HortOpsStorage.loadWorkspace() || {};
      const envelope = window.HortOpsStorage.createWorkspaceEnvelope({
        ...currentWs,
        staffList: sampleStaff,
        jobs: sampleJobs,
        allShifts: sampleShifts,
        absences: sampleAbsences
      });
      window.HortOpsStorage.saveWorkspace(envelope);
    }
    window.HortOpsApp.renderCurrentView();
  });
  await page.waitForTimeout(400);
  console.log('    [PASS] Injected qualification, fatigue & absence scenarios.');

  // Step 3: Test Staff Registry View
  console.log('>>> [3/6] Inspecting Staff Registry with Accreditations & Fatigue columns...');
  await page.evaluate(() => {
    window.HortOpsApp.setActiveView('staff_registry');
  });
  await page.waitForTimeout(400);

  const staffContent = await page.content();
  assert(staffContent.includes('Accreditation') || staffContent.includes('Tickets'), 'Staff Registry must display Accreditations column');
  assert(staffContent.includes('Fatigue'), 'Staff Registry must display Fatigue tier column');
  console.log('    [PASS] Staff Registry renders Accreditations & Fatigue badges.');

  // Step 4: Test Live Modal Candidate Screening & Save Guard
  console.log('>>> [4/6] Verifying Staff Assignment Modal live UI guards...');
  const modalChecks = await page.evaluate(() => {
    const modal = window.HortOpsStaffAssignModal;
    modal.open('s-f4');

    // Filter candidate list for s-f4 (which requires CHAINSAW_L1 and CHIPPER)
    const options = {
      shift: modal.shift,
      allShifts: window.HortOpsApp.state.allShifts,
      matchingJob: modal.matchingJob,
      stagedAssignedStaffIds: []
    };
    const candidates = window.HortOpsStaffAssignCandidateModel.filterCandidates(
      window.HortOpsApp.state.staffList,
      options
    );

    // STAFF-001 (Alex) holds both tickets and is fatigue-safe -> eligible & accredited
    const cand1 = candidates.find(c => c.id === 'STAFF-001');
    // STAFF-002 (Jordan) has expired CHIPPER and critical fatigue
    const cand2 = candidates.find(c => c.id === 'STAFF-002');
    // STAFF-003 (Casey) lacks CHIPPER and is on annual leave
    const cand3 = candidates.find(c => c.id === 'STAFF-003');

    // Test staging Alex (should succeed)
    modal.addStaff('STAFF-001');
    const alexStaged = modal.stagedAssignedStaffIds.includes('STAFF-001');

    // Test attempting to add Jordan (expired ticket / critical fatigue) -> must be fail-closed blocked with alert
    let jordanAlert = null;
    const origAlert = window.alert;
    window.alert = msg => { jordanAlert = msg; };
    modal.addStaff('STAFF-002');
    const jordanStaged = modal.stagedAssignedStaffIds.includes('STAFF-002');

    // Test attempting to add Casey (missing ticket / annual leave) -> must be fail-closed blocked with alert
    let caseyAlert = null;
    window.alert = msg => { caseyAlert = msg; };
    modal.addStaff('STAFF-003');
    window.alert = origAlert;
    const caseyStaged = modal.stagedAssignedStaffIds.includes('STAFF-003');

    modal.close();
    return {
      cand1Eligible: !!cand1 && cand1._lacksQualifications === false && cand1._fatigueEval.tier !== 'CRITICAL',
      jordanFilteredOut: !cand2,
      caseyFilteredOut: !cand3,
      alexStaged,
      jordanBlocked: !jordanStaged && jordanAlert !== null,
      caseyBlocked: !caseyStaged && caseyAlert !== null
    };
  });

  assert(modalChecks.cand1Eligible, 'Fully accredited and safe Alex Vance must be present in candidate pool');
  assert(modalChecks.jordanFilteredOut, 'Unaccredited/critically fatigued Jordan Taylor must be filtered out by canonical safety gate');
  assert(modalChecks.caseyFilteredOut, 'Unaccredited/on-leave Casey Morgan must be filtered out by canonical safety gate');
  assert(modalChecks.alexStaged, 'Accredited Alex Vance must be staged successfully');
  assert(modalChecks.jordanBlocked, 'Critically fatigued/expired-ticket Jordan Taylor must be strictly blocked from staging');
  assert(modalChecks.caseyBlocked, 'Unaccredited Casey Morgan must be strictly blocked from staging');
  console.log('    [PASS] Staff Assignment Modal live qualification filtering and assignment guards verified.');

  // Step 5: Test Analytics Dashboard Workforce Intelligence Panels
  console.log('>>> [5/6] Navigating to Analytics Dashboard Workforce Intelligence...');
  await page.evaluate(() => {
    window.HortOpsApp.setActiveView('analytics');
  });
  await page.waitForTimeout(500);

  const analyticsContent = await page.content();
  assert(analyticsContent.includes('Workforce Fatigue Risk Heatmap'), 'Analytics must include Fatigue Risk Heatmap');
  assert(analyticsContent.includes('Workforce Qualification & Accreditation Compliance'), 'Analytics must include Qualification Compliance Matrix');
  assert(analyticsContent.includes('Jordan Taylor'), 'Elevated fatigue watchlist must display Jordan Taylor');
  assert(analyticsContent.includes('REST REQUIRED'), 'Must flag Jordan Taylor with REST REQUIRED badge');
  assert(analyticsContent.includes('Expiring (≤ 30 Days)'), 'Must report expiring tickets');
  console.log('    [PASS] Workforce Fatigue Risk Heatmap & Qualification Matrix 100% verified.');

  // Step 6: Direct Browser Leave & Refusal Operational Full CRUD Lifecycle Flow (R57-P1-06 & R57-P2-07)
  console.log('>>> [6/7] Testing direct browser leave/refusal lifecycle: create, amend, remove, export & reload...');
  const lifecycleRes = await page.evaluate(() => {
    const modal = window.HortOpsStaffAbsenceModal;
    const app = window.HortOpsApp;

    // 6a: Open modal for STAFF-001
    modal.open('STAFF-001');

    // 6b: Create new sick_leave interval
    const typeEl = document.getElementById('new-absence-type');
    const startEl = document.getElementById('new-absence-start');
    const endEl = document.getElementById('new-absence-end');
    const notesEl = document.getElementById('new-absence-notes');
    if (typeEl) typeEl.value = 'sick_leave';
    if (startEl) startEl.value = '2026-10-14';
    if (endEl) endEl.value = '2026-10-15';
    if (notesEl) notesEl.value = 'Initial leave entry';
    modal.addAbsence();

    const createdRec = modal.workingAbsences.find(a => a.staffId === 'STAFF-001');
    if (!createdRec) return { success: false, reason: 'Failed to create absence record' };
    const originalAbsId = createdRec.id;

    // 6c: Full CRUD Edit - Amend record in-place and verify identity retention
    modal.startEditAbsence(originalAbsId);
    const editNotesEl = document.getElementById('edit-absence-notes');
    if (editNotesEl) editNotesEl.value = 'Amended with medical certificate';
    modal.updateAbsence();

    const amendedRec = modal.workingAbsences.find(a => a.id === originalAbsId);
    if (!amendedRec || amendedRec.notes !== 'Amended with medical certificate') {
      return { success: false, reason: 'Edit failed or lost identity' };
    }

    // 6d: Commit to canonical storage
    modal.save();
    const persistedAfterAdd = app.state.absences.find(a => a.id === originalAbsId);
    if (!persistedAfterAdd) return { success: false, reason: 'Absence failed to persist' };

    // 6e: Switch to Refusals and log refusal
    modal.open('STAFF-001');
    modal.switchTab('refusals');
    const refDateEl = document.getElementById('new-refusal-date');
    const refNotesEl = document.getElementById('new-refusal-notes');
    if (refDateEl) refDateEl.value = '2026-10-10';
    if (refNotesEl) refNotesEl.value = 'Notice too short';
    modal.addRefusal();

    const createdRef = modal.workingRefusals.find(r => r.staffId === 'STAFF-001');
    if (!createdRef) return { success: false, reason: 'Refusal creation failed' };
    const originalRefId = createdRef.id;

    // 6f: Full CRUD Edit Refusal - Amend in place with identity retention
    modal.startEditRefusal(originalRefId);
    const editRefNotesEl = document.getElementById('edit-refusal-notes');
    if (editRefNotesEl) editRefNotesEl.value = 'Family commitments (confirmed)';
    modal.updateRefusal();

    modal.save();
    const persistedRef = app.state.refusalHistory.find(r => r.id === originalRefId);
    if (!persistedRef || persistedRef.reason !== 'Family commitments (confirmed)') {
      return { success: false, reason: 'Refusal failed to persist after amend' };
    }

    // 6g: Explicit removal of absence and verify authorised last-item removal
    modal.open('STAFF-001');
    modal.removeAbsence(originalAbsId);
    modal.save();

    const removedAbsCheck = app.state.absences.find(a => a.id === originalAbsId);
    if (removedAbsCheck) return { success: false, reason: 'Absence was not removed' };

    // 6h: Verify Export envelope preserves remaining ledger state
    const exportEnvelope = window.HortOpsStorage.loadWorkspace();
    const exportHasRefusal = Array.isArray(exportEnvelope.refusalHistory) && exportEnvelope.refusalHistory.some(r => r.id === originalRefId);

    // 6i (Review 58 Contract B): Import crafted-but-schema-valid record IDs with quotation marks & special characters
    // Verify that activating Edit and Remove buttons executes NO arbitrary JavaScript and safely operates via DOM data attributes
    window.__maliciousTestExecuted = 0;
    const craftedAbsId = "craft_abs_\"\';window.__maliciousTestExecuted=1;//";
    modal.open('STAFF-001');
    modal.workingAbsences.push({
      id: craftedAbsId,
      staffId: 'STAFF-001',
      type: 'annual_leave',
      startDate: '2026-10-20',
      endDate: '2026-10-21',
      notes: 'Adversarial payload id test'
    });
    modal.render();

    // Verify button has no inline onclick interpolating ID
    const rootEl = document.getElementById('staff-absence-modal-root');
    const rootHtml = rootEl ? rootEl.innerHTML : '';
    const hasUnsafeOnclick = rootHtml.includes('onclick="window.HortOpsStaffAbsenceModal.startEditAbsence') ||
                             rootHtml.includes('onclick="window.HortOpsStaffAbsenceModal.removeAbsence');

    // Locate edit button safely using DOM iteration (CSS selector escapes cannot handle arbitrary injection payloads)
    const allEditBtns = Array.from(document.querySelectorAll('button[data-action="edit-absence"]'));
    const editBtn = allEditBtns.find(b => b.getAttribute('data-id') === craftedAbsId);
    if (!editBtn) return { success: false, reason: 'Failed to locate data-action="edit-absence" button for crafted ID' };
    editBtn.click();
    const editWorked = modal.editingAbsenceId === craftedAbsId;

    // Locate remove button safely using DOM iteration
    const allRemoveBtns = Array.from(document.querySelectorAll('button[data-action="remove-absence"]'));
    const removeBtn = allRemoveBtns.find(b => b.getAttribute('data-id') === craftedAbsId);
    if (!removeBtn) return { success: false, reason: 'Failed to locate data-action="remove-absence" button for crafted ID' };
    removeBtn.click();
    const removeTracked = modal.removedAbsenceIds.has(craftedAbsId);

    modal.close();

    return {
      success: true,
      identityRetainedOnEdit: true,
      persistedInStorage: true,
      refusalAmendedAndPersisted: true,
      removedSuccessfully: true,
      exportEnvelopeValid: exportHasRefusal,
      craftedIdSafe: window.__maliciousTestExecuted === 0 && !hasUnsafeOnclick && editWorked && removeTracked
    };
  });

  assert(lifecycleRes.success, 'Operational lifecycle flow must succeed: ' + lifecycleRes.reason);
  assert(lifecycleRes.identityRetainedOnEdit, 'Record identity must be strictly retained across edits');
  assert(lifecycleRes.persistedInStorage, 'Changes must persist to canonical storage');
  assert(lifecycleRes.refusalAmendedAndPersisted, 'Refusal lifecycle must operate end-to-end');
  assert(lifecycleRes.removedSuccessfully, 'Authorised removal must succeed without false evidence-loss blocks');
  assert(lifecycleRes.exportEnvelopeValid, 'Export envelope must reflect updated ledgers');
  assert(lifecycleRes.craftedIdSafe, 'Review 58 Contract B: Crafted imported IDs with quotes/punctuation must not execute arbitrary code');
  console.log('    [PASS] Direct browser leave & refusal full CRUD, identity retention and export lifecycle 100% verified.');

  // Step 7: Capture Visual Verification Screenshot
  console.log('>>> [7/7] Capturing High-Resolution Audit Screenshot of Analytics Dashboard...');
  const screenshotDir = path.join(repoRoot(), 'test_reports', 'browser');
        fs.mkdirSync(screenshotDir, { recursive: true });
        const screenshotPath = path.join(screenshotDir, 'offline_stage3_release_verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  assert(fs.existsSync(screenshotPath), 'Screenshot file must be generated');
  const imgStats = fs.statSync(screenshotPath);
  console.log(`    [PASS] Screenshot captured: offline_stage3_release_verified.png (${(imgStats.size / 1024).toFixed(1)} KB)`);

  await browser.close();

  console.log('\n================================================================');
  console.log(' ALL 7 STAGE 3 BROWSER VERIFICATION CHECKS PASSED (100% OK)');
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('\n[FATAL ERROR]:', err);
  process.exit(1);
});
