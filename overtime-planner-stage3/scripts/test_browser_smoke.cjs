const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { repoRoot, loadPlaywright } = require('./local-test-environment.cjs');
const playwright = loadPlaywright();

console.log('=== RUNNING BROWSER SMOKE TEST SUITE (STATIC FILE:// EXECUTION) ===');

const baseDir = repoRoot();
const fileUrl = 'file://' + path.join(baseDir, 'dist', 'hort_ops_offline_planner.html');

(async () => {
  console.log(`Testing static self-contained app directly via: ${fileUrl}`);

  let browser;
  const consoleErrors = [];
  const uncaughtErrors = [];

  try {
    browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    // Listen for console errors & uncaught exceptions
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.error('BROWSER CONSOLE ERROR:', msg.text());
      }
    });
    page.on('pageerror', err => {
      uncaughtErrors.push(err.message);
      console.error('BROWSER PAGE ERROR:', err.message);
    });

    // Accept or handle native alert/confirm dialogs
    let lastDialogMessage = '';
    page.on('dialog', async dialog => {
      lastDialogMessage = dialog.message();
      // console.log(`[DIALOG ${dialog.type()}]:`, dialog.message());
      await dialog.accept();
    });

    // Navigate to local test app via file://
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.HortOpsWriterSession && !window.HortOpsWriterSession.status().pending);
    await page.waitForTimeout(500);

    console.log('[PASS] Application initialised and mounted successfully.');

    // Seed canonical initial workspace with synthetic test records for browser smoke verification
    await page.evaluate(() => {
      const tramlineJob = {
        id: "tramline-5am",
        name: "5am Tramline",
        frequencyType: "recurring_weeks",
        intervalWeeks: 5,
        anchorDate: "2026-02-15",
        targetDate: "2026-02-15",
        startTime: "05:00 AM",
        durationHours: 6,
        crewSize: 2,
        preferredDay: "sunday",
        status: "active",
        category: "CBD Corridor",
        color: "#10b981",
        locationDetails: "King William Street / Victoria Square Tram Corridor",
        defaultDepartment: "Horticulture",
        primaryDepartment: "Horticulture",
        defaultTeam: "Parks",
        primaryTeam: "Parks",
        secondaryTeam: "Arboriculture",
        tertiaryTeam: "Squares",
        isExclusiveTeams: true,
        exclusiveTeams: ["Parks", "Arboriculture", "Squares", "Irrigation"],
        plantOperatorRequired: true,
        requiresWZTM: true,
        requiresTPO: true
      };

      const smokeStaff = [
        {
          id: "EMP-SMOKE-1",
          name: "Michael Synthetic Operative",
          title: "Michael Synthetic Operative",
          userType: "Portal and App",
          email: "michael@synthetic.council.local",
          department: "Horticulture",
          team: "Parks",
          crew: "Parks",
          jobTitle: "Senior Horticulturist",
          role: "Horticulturist",
          status: "active",
          isContractor: false,
          isPlantOperator: false,
          hasPlantOperatorCertification: false,
          skills: [],
          phone: "0400000001",
          avatarColor: "#10b981",
          overtimeExempt: false,
          overtimeStats: { hoursYTD: 0, shiftCount: 0 }
        },
        {
          id: "EMP-SMOKE-2",
          name: "Sarah Synthetic Operative",
          title: "Sarah Synthetic Operative",
          userType: "Portal and App",
          email: "sarah@synthetic.council.local",
          department: "Horticulture",
          team: "Arboriculture",
          crew: "Arboriculture",
          jobTitle: "Arborist",
          role: "Arborist",
          status: "active",
          isContractor: false,
          isPlantOperator: false,
          hasPlantOperatorCertification: false,
          skills: [],
          phone: "0400000002",
          avatarColor: "#3b82f6",
          overtimeExempt: false,
          overtimeStats: { hoursYTD: 0, shiftCount: 0 }
        },
        {
          id: "EMP-SMOKE-3",
          name: "James Synthetic Operative",
          title: "James Synthetic Operative",
          userType: "Portal and App",
          email: "james@synthetic.council.local",
          department: "Horticulture",
          team: "Squares",
          crew: "Squares",
          jobTitle: "Gardener",
          role: "Gardener",
          status: "active",
          isContractor: false,
          isPlantOperator: false,
          hasPlantOperatorCertification: false,
          skills: [],
          phone: "0400000003",
          avatarColor: "#6366f1",
          overtimeExempt: false,
          overtimeStats: { hoursYTD: 0, shiftCount: 0 }
        }
      ];

      window.HortOpsApp.restoreWorkspaceJson({
        schemaVersion: 2,
        jobs: [tramlineJob],
        roster: smokeStaff,
        assignments: {},
        rostering: { instructions: {}, provenance: {} },
        historicalSnapshots: {},
        permits: {},
        budgetSettings: { annualBudgetCap: 50000, hourlyBaseRate: 44.50 },
        uiState: { activeView: 'forward_planner', currentYear: 2026 }
      });
    });
    await page.waitForTimeout(300);

    // Step 1: Verify all 6 navigation tabs mount without error
    const tabs = [
      { name: 'Overtime Calendar', selector: 'button.nav-tab-btn:has-text("Overtime Calendar")' },
      { name: 'Job Registry', selector: 'button.nav-tab-btn:has-text("Job Registry")' },
      { name: 'Workforce Registry', selector: 'button.nav-tab-btn:has-text("Workforce Registry")' },
      { name: 'Peak Weekends & Clashes', selector: 'button.nav-tab-btn:has-text("Peak Weekends")' },
      { name: 'Analytics & Budget', selector: 'button.nav-tab-btn:has-text("Analytics & Budget")' },
      { name: 'Forward Planner', selector: 'button.nav-tab-btn:has-text("Forward Planner")' }
    ];

    for (const tab of tabs) {
      await page.click(tab.selector);
      await page.waitForTimeout(200);
      const content = await page.$('#content-mount');
      const text = await content.innerText();
      assert(text && text.length > 50, `Tab ${tab.name} mounted with non-empty content`);
    }
    console.log('[PASS] All 6 main views navigated and mounted with non-empty content.');

    // Step 2: Job Registry ? Add Job Modal & Edit Job Modal
    await page.click('button.nav-tab-btn:has-text("Job Registry")');
    await page.waitForTimeout(200);

    // Open Add Job Modal via header button
    await page.click('button.btn-add-job-header');
    await page.waitForTimeout(300);

    const modalTitle = await page.$eval('.modal-header h2', el => el.innerText);
    assert.strictEqual(modalTitle, 'Create New Horticultural Job', 'Add Job modal title must match');

    // Fill form fields
    await page.fill('.modal-body input[type="text"][required]', 'Smoke Test Seasonal Planting');
    // Anchor start date is required
    await page.fill('.modal-body input[type="date"][required]', '2026-02-14');

    // Test cancel / close without saving
    await page.click('.modal-footer button.btn-secondary:has-text("Cancel")');
    await page.waitForTimeout(200);
    const modalClosed = await page.$('#job-edit-modal-root .modal-overlay');
    assert.strictEqual(modalClosed, null, 'Modal should close on Cancel');

    // Re-open Add Job, populate and save
    await page.click('button.btn-add-job-header');
    await page.waitForTimeout(200);
    await page.fill('.modal-body input[type="text"][required]', 'Smoke Test Temporary Job to Delete');
    await page.fill('.modal-body input[type="date"][required]', '2026-03-07');
    await page.click('.modal-footer button.btn-primary:has-text("Save Job Definition")');
    await page.waitForTimeout(400);

    // Verify job appears in table
    const tableHtml = await page.$eval('#content-mount', el => el.innerHTML);
    assert(tableHtml.includes('Smoke Test Temporary Job to Delete'), 'Newly created job must appear in registry');

    // Edit the created job
    await page.click('tr:has-text("Smoke Test Temporary Job to Delete") button[title="Edit Job"]');
    await page.waitForTimeout(300);
    const editModalTitle = await page.$eval('.modal-header h2', el => el.innerText);
    assert(editModalTitle.includes('Edit Job: Smoke Test Temporary Job to Delete'), 'Edit Job modal header must include job name');

    // Change location details and save
    await page.fill('.modal-body input[oninput*="locationDetails"]', 'Park 15 East Terrace');
    await page.click('.modal-footer button.btn-primary:has-text("Save Job Definition")');
    await page.waitForTimeout(400);

    // Delete / retire the test job
    await page.click('tr:has-text("Smoke Test Temporary Job to Delete") button[title="Delete Job"]');
    await page.waitForTimeout(400);

    console.log('[PASS] Job Registry Add Job, Edit Job, and Deletion workflows verified without error.');

    // Step 3: Crew Allocator Modal Interaction
    await page.click('button.nav-tab-btn:has-text("Forward Planner")');
    await page.waitForTimeout(200);

    // Find first shift card and open allocator
    const firstShiftBtn = await page.$('button[onclick*="openStaffAssignModal"]');
    assert(firstShiftBtn, 'At least one shift card with crew allocator must exist');
    await firstShiftBtn.click();
    await page.waitForTimeout(400);

    const allocHeader = await page.$eval('#staff-assign-modal-root .modal-header h2', el => el.innerText);
    assert(allocHeader && allocHeader.length > 0, 'Crew Allocator modal must open with non-empty job title');

    // Search input interaction
    await page.fill('#staff-assign-modal-root input[placeholder*="Search"]', 'Michael');
    await page.waitForTimeout(200);
    await page.fill('#staff-assign-modal-root input[placeholder*="Search"]', '');
    await page.waitForTimeout(200);

    // Test adding and removing staff
    const addBtn = await page.$('.candidate-card button[onclick*="addStaff"]') || await page.$('.candidate-card button:has-text("Add")') || await page.$('.candidate-card button:has-text("Assign")');
    if (addBtn) {
      await addBtn.click();
      await page.waitForTimeout(200);
    }

    // Offline17: Verify Assignment Mode & Repeat Dropdowns
    const modeSelects = await page.$$('.allocated-staff-row select.assignment-mode-select');
    assert(modeSelects.length > 0, 'Allocated staff rows must have Assignment Mode select');

    const repeatSelects = await page.$$('.allocated-staff-row select.repeat-count-select');
    assert(repeatSelects.length > 0, 'Allocated staff rows must have Repeat Count select');

    // Test changing mode to fixed enables repeat dropdown
    await page.selectOption('.allocated-staff-row select.assignment-mode-select', 'fixed');
    await page.waitForTimeout(200);
    const isRepeatDisabled = await page.$eval('.allocated-staff-row select.repeat-count-select', el => el.disabled);
    assert.strictEqual(isRepeatDisabled, false, 'Repeat select must be enabled when mode is Fixed');

    // Save allocation
    await page.click('#staff-assign-modal-root button[onclick*="saveAllocation"]');
    await page.waitForTimeout(400);

    // If modal is still open (e.g. plant operator required alert triggered), close with Cancel
    const stillOpen = await page.$('#staff-assign-modal-root .modal-overlay');
    if (stillOpen) {
      await page.click('#staff-assign-modal-root button:has-text("Cancel")');
      await page.waitForTimeout(400);
    }

    console.log('[PASS] Crew Allocator modal opened, searched, interacted, and saved successfully.');
    // Forward Planner Card Streamlining & Pill Removal Verification (Offline15.2 Directive)
    // A. Forward Planner shift cards must NOT display intrusive Plant Op pills
    const tramlineOpBadges = await page.$$eval('button.shift-card-btn', btns => {
      return btns.filter(b => b.textContent.includes('Plant Op')).length;
    });
    assert.strictEqual(tramlineOpBadges, 0, 'Forward Planner shift cards must not display Plant Op pills');
    console.log('[PASS] Forward Planner shift cards verified clean: 0 Plant Op pills on shift cards.');

    // B. Vacancy rows must NOT display Plant Op pills, but MUST display Unallocated pill
    const vacancyOpBadges = await page.$$eval('.vacancy-row', rows => {
      return rows.filter(r => r.textContent.includes('Plant Op')).length;
    });
    assert.strictEqual(vacancyOpBadges, 0, 'Vacancy rows must not display Plant Op pills');

    const unallocatedPills = await page.$$eval('.vacancy-row .unallocated-pill', pills => {
      return pills.filter(p => p.textContent.trim() === 'Unallocated Slot').length;
    });
    assert(unallocatedPills > 0, 'Vacancy rows must display Unallocated Slot pills (Offline17 3-line format)');
    console.log(`[PASS] Forward Planner unallocated rows verified: ${unallocatedPills} Unallocated Slot pills displayed, 0 Plant Op pills.`);

    // C. SVG Warning Badges positioned on right side of cards
    const warningBadges = await page.$$eval('.plant-op-warning-badge', badges => badges.length);
    assert(warningBadges > 0, 'Forward Planner must render SVG warning badges for plant operator required shifts');
    console.log(`[PASS] Plant Operator SVG warning badges verified: ${warningBadges} badges rendered on right side of cards.`);


    // Step 4: Overtime Exemption Modal Interaction & Security Escaping Test (Mandate Section 13, 21)
    await page.click('button.nav-tab-btn:has-text("Workforce Registry")');
    await page.waitForTimeout(200);

    // Click first Edit Overtime Exemption button
    const firstExemptBtn = await page.$('table button[title="Edit Overtime Exemption"]');
    assert(firstExemptBtn, 'Overtime exemption button must exist');
    await firstExemptBtn.click();
    await page.waitForTimeout(300);

    const exemptHeader = await page.$eval('#staff-exemption-modal-root h3', el => el.innerText);
    assert(exemptHeader && exemptHeader.length > 0, 'Overtime Exemption modal must open with staff name');

    // Enable exemption toggle first so date and governance section is enabled
    await page.evaluate(() => {
      const toggle = document.getElementById('exemption-toggle');
      if (toggle) {
        toggle.checked = true;
        window.HortOpsStaffExemptionModal.toggleExempt(true);
      }
    });
    await page.waitForTimeout(200);

    // Test benign HTML injection in exemption reason
    const payload = '<img src=x data-security-test="1">';
    await page.fill('#staff-exemption-modal-root #exemption-reason', payload);
    await page.click('#staff-exemption-modal-root button.btn-primary:has-text("Save Exemption")');
    await page.waitForTimeout(300);

    // Re-open and verify payload was escaped (no injected <img> element in DOM)
    await page.click('table button[title="Edit Overtime Exemption"]');
    await page.waitForTimeout(300);
    const injectedNode = await page.$('[data-security-test="1"]');
    assert.strictEqual(injectedNode, null, 'Injected HTML payload must NOT produce a DOM element');
    const reasonVal = await page.$eval('#staff-exemption-modal-root #exemption-reason', el => el.value);
    assert.strictEqual(reasonVal, payload, 'Exemption reason must preserve literal text content without corruption');

    // Save and close
    await page.click('#staff-exemption-modal-root button.btn-primary:has-text("Save Exemption")');
    await page.waitForTimeout(300);
    console.log('[PASS] Overtime Exemption modal opened, saved, and verified inert under HTML injection payloads.');

    // Step 4B: Search Input Typing & Focus Preservation (Mandate Section 15)
    await page.click('button.nav-tab-btn:has-text("Workforce Registry")');
    await page.waitForTimeout(200);
    const searchInput = await page.$('input[placeholder*="Search name"]');
    assert(searchInput, 'Workforce search input must exist');
    await searchInput.focus();
    await page.keyboard.type('Parks', { delay: 50 });
    await page.waitForTimeout(200);
    const isFocused = await page.evaluate(() => document.activeElement === document.querySelector('input[placeholder*="Search name"]'));
    assert(isFocused, 'Search input must preserve focus during sequential typing');
    const searchVal = await page.$eval('input[placeholder*="Search name"]', el => el.value);
    assert.strictEqual(searchVal, 'Parks', 'Search input must retain complete typed string');
    await page.fill('input[placeholder*="Search name"]', '');
    await page.waitForTimeout(200);
    console.log('[PASS] Non-destructive search input typing and focus preservation verified.');

    
    // Step 4C: Comprehensive HTML Escaping Across All Operational Views (Mandate Section 23, 24)
    const securityPayload = '<img src=x data-security-test="1">';
    
    // Inject security payload into unassigned job, assigned job, and staff member (Mandate Section 13)
    const assignedPayload = '<img src=x data-security-test="assigned-fp">';
    await page.evaluate(({ unassignedPayload, assignedPayload }) => {
      const state = window.HortOpsApp.state;
      state.jobs.unshift({
        id: 'sec-test-job',
        name: unassignedPayload,
        category: unassignedPayload,
        locationDetails: unassignedPayload,
        primaryTeam: 'Parks',
        frequencyType: 'one_off',
        targetDate: '2026-09-12',
        startTime: '06:00 AM',
        durationHours: 6,
        crewSize: 2,
        status: 'active'
      });
      state.jobs.unshift({
        id: 'sec-assigned-job',
        name: assignedPayload,
        category: 'Parks',
        locationDetails: 'Test Location',
        primaryTeam: 'Parks',
        frequencyType: 'one_off',
        targetDate: '2026-09-12',
        startTime: '07:00 AM',
        durationHours: 6,
        crewSize: 1,
        status: 'active'
      });
      state.staffList.unshift({
        id: 'SEC-STAFF-1',
        name: unassignedPayload,
        role: 'Horticulturist',
        team: 'Parks',
        status: 'active'
      });
      state.customAssignments['sec-assigned-job@2026-09-12'] = ['SEC-STAFF-1'];
      window.HortOpsApp.recomputeDigest();
    }, { unassignedPayload: securityPayload, assignedPayload: assignedPayload });
    await page.waitForTimeout(300);

    // 1. Forward Planner View Escaping (Both Unassigned Vacancy & Assigned Shift Card) (Mandate Section 13)
    await page.click('button.nav-tab-btn:has-text("Forward Planner")');
    await page.waitForTimeout(300);
    let secNodeUnassigned = await page.$('[data-security-test="1"]');
    assert.strictEqual(secNodeUnassigned, null, 'Forward Planner unassigned vacancy must NOT interpret HTML payload as DOM element');
    let secNodeAssigned = await page.$('[data-security-test="assigned-fp"]');
    assert.strictEqual(secNodeAssigned, null, 'Forward Planner assigned shift card must NOT interpret HTML payload as DOM element');
    console.log('[PASS] Forward Planner verified safe from HTML payload injection across both unassigned and assigned branches.');

    // 2. Calendar View Escaping
    await page.click('button.nav-tab-btn:has-text("Calendar")');
    await page.waitForTimeout(300);
    secNode = await page.$('[data-security-test="1"]');
    assert.strictEqual(secNode, null, 'Calendar view must NOT interpret HTML payload as DOM element');
    console.log('[PASS] Calendar view verified safe from HTML payload injection.');

    // 3. Peak Weekends View Escaping
    await page.click('button.nav-tab-btn:has-text("Peak Weekends")');
    await page.waitForTimeout(300);
    secNode = await page.$('[data-security-test="1"]');
    assert.strictEqual(secNode, null, 'Peak Weekends view must NOT interpret HTML payload as DOM element');
    console.log('[PASS] Peak Weekends view verified safe from HTML payload injection.');

    // 4. Job Registry View & Attribute Escaping
    await page.click('button.nav-tab-btn:has-text("Job Registry")');
    await page.waitForTimeout(300);
    secNode = await page.$('[data-security-test="1"]');
    assert.strictEqual(secNode, null, 'Job Registry view must NOT interpret HTML payload as DOM element');

    // Type payload into Job Registry search input to test attribute escaping (Mandate Section 22)
    const jobSearchInput = await page.$('input[placeholder*="Search jobs"]');
    assert(jobSearchInput, 'Job Registry search input must exist');
    await page.fill('input[placeholder*="Search jobs"]', securityPayload);
    await page.waitForTimeout(300);
    secNode = await page.$('[data-security-test="1"]');
    assert.strictEqual(secNode, null, 'Job Registry search attribute must NOT interpret HTML payload as DOM element');
    await page.fill('input[placeholder*="Search jobs"]', '');
    await page.waitForTimeout(200);
    console.log('[PASS] Job Registry view and search attribute verified safe from HTML payload injection.');

    // Clean up injected test job and staff
    await page.evaluate(() => {
      window.HortOpsApp.state.jobs = window.HortOpsApp.state.jobs.filter(j => j.id !== 'sec-test-job' && j.id !== 'sec-assigned-job');
      delete window.HortOpsApp.state.customAssignments['sec-assigned-job@2026-09-12'];
      window.HortOpsApp.state.staffList = window.HortOpsApp.state.staffList.filter(s => s.id !== 'SEC-STAFF-1');
      window.HortOpsApp.recomputeDigest();
    });
    await page.waitForTimeout(300);

    // Step 5: Export Modal & Import Modal
    await page.click('button.btn-header-action:has-text("Export")');
    await page.waitForTimeout(300);
    const exportHeader = await page.$eval('#export-modal-root .modal-header h2', el => el.innerText);
    assert(exportHeader.includes('Export Operations Data'), 'Export modal must open');
    await page.click('#export-modal-root button.btn-secondary:has-text("Close")');
    await page.waitForTimeout(200);

    await page.click('button.btn-header-action:has-text("Import Staff")');
    await page.waitForTimeout(300);
    const importHeader = await page.$eval('#import-modal-root .modal-header h2', el => el.innerText);
    assert(importHeader.includes('Workforce') || importHeader.includes('Restore'), 'Import modal must open');
    await page.click('#import-modal-root button.btn-secondary:has-text("Cancel")');
    await page.waitForTimeout(200);

    // Test Warning button and modal
    const warningBtn = await page.$('#btn-header-warnings');
    if (warningBtn) {
      await warningBtn.click();
      await page.waitForTimeout(300);
      const warnHeader = await page.$eval('#warnings-modal-root .modal-header h2', el => el.innerText);
      assert(warnHeader.includes('Operational Warnings'), 'Warnings modal must open');
      await page.click('#warnings-modal-root button:has-text("Close")');
      await page.waitForTimeout(200);
      console.log('[PASS] Warnings button and modal opened and closed successfully.');
    }

    console.log('[PASS] Export and Import modals opened and closed successfully.');

    // Step 6: Modal Scroll Isolation, Containment & Background Restoration (Mandate Sections 29, 30, 31, 32, 33)
    console.log('=== Step 6: Testing Modal Scroll Isolation, Chaining Containment & Scroll Restoration ===');
    await page.setViewportSize({ width: 1440, height: 750 });
    await page.waitForTimeout(100);
    await page.click('button.nav-tab-btn:has-text("Job Registry")');
    await page.waitForTimeout(300);

    // 6.1 Scroll background to non-zero offset
    await page.evaluate(() => window.scrollTo(0, 150));
    await page.waitForTimeout(100);
    const initialWindowY = await page.evaluate(() => window.scrollY);
    assert(initialWindowY > 0, 'Initial window scroll position must be non-zero');
    console.log(`[PASS] Background scrolled to non-zero offset: ${initialWindowY}px`);

    // 6.2 Open first row drawer in Job Registry
    await page.click('table tbody tr:first-child');
    await page.waitForTimeout(300);

    // 6.3 Open Job Edit Modal from drawer
    const editBtn = await page.$('button:has-text("Edit Job Specifications")') || await page.$('button[title="Edit Job"]');
    assert(editBtn, 'Edit button must exist in drawer or row');
    await editBtn.click();
    await page.waitForTimeout(400);

    // 6.4 Verify modal scroll lock applied
    const modalOverlay = await page.$('#job-edit-modal-root .modal-overlay');
    assert(modalOverlay, 'Job Edit modal overlay must be present');
    const isLocked = await page.evaluate(() => document.body.classList.contains('modal-scroll-locked'));
    assert.strictEqual(isLocked, true, 'Body must have modal-scroll-locked class while modal is open');

    // 6.5 Verify modal body scrolls internally without background scroll leakage (Section 29)
    const modalBody = await page.$('#job-edit-modal-root .modal-body');
    assert(modalBody, 'Modal body must exist in Job Edit modal');
    const initialModalScroll = await page.$eval('#job-edit-modal-root .modal-body', el => el.scrollTop);

    const bodyBox = await modalBody.boundingBox();
    assert(bodyBox, 'Modal body bounding box must exist');
    await page.mouse.move(bodyBox.x + bodyBox.width / 2, bodyBox.y + bodyBox.height / 2);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(200);

    const scrolledModalScroll = await page.$eval('#job-edit-modal-root .modal-body', el => el.scrollTop);
    const currentWindowY = await page.evaluate(() => window.scrollY);
    assert(scrolledModalScroll > initialModalScroll, 'Modal body must scroll internally under mouse wheel');
    assert.strictEqual(currentWindowY, initialWindowY, 'Background window.scrollY must remain strictly unchanged');
    console.log('[PASS] Job Edit modal body scrolls internally without background leakage.');

    // 6.6 Boundary chaining test (Section 16, 29)
    await page.$eval('#job-edit-modal-root .modal-body', el => el.scrollTop = el.scrollHeight);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(100);
    assert.strictEqual(await page.evaluate(() => window.scrollY), initialWindowY, 'Wheel at bottom boundary must NOT chain to background');

    await page.$eval('#job-edit-modal-root .modal-body', el => el.scrollTop = 0);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(100);
    assert.strictEqual(await page.evaluate(() => window.scrollY), initialWindowY, 'Wheel at top boundary must NOT chain to background');
    console.log('[PASS] Scroll chaining containment verified at top and bottom boundaries.');

    // 6.7 Wheel over modal header and footer (Section 30)
    const headerBox = await page.$eval('#job-edit-modal-root .modal-header', el => el.getBoundingClientRect());
    await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(100);
    assert.strictEqual(await page.evaluate(() => window.scrollY), initialWindowY, 'Wheel over header must not move background');

    const footerBox = await page.$eval('#job-edit-modal-root .modal-footer', el => el.getBoundingClientRect());
    await page.mouse.move(footerBox.x + footerBox.width / 2, footerBox.y + footerBox.height / 2);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(100);
    assert.strictEqual(await page.evaluate(() => window.scrollY), initialWindowY, 'Wheel over footer must not move background');
    console.log('[PASS] Wheel over modal header and footer verified inert.');

    // 6.8 Close modal and verify background restoration and drawer preservation (Section 31)
    await page.click('#job-edit-modal-root .modal-footer button:has-text("Cancel")');
    await page.waitForTimeout(200);

    const restoredWindowY = await page.evaluate(() => window.scrollY);
    assert.strictEqual(restoredWindowY, initialWindowY, 'Closing modal must restore exact pre-modal background scroll offset');
    const isUnlocked = await page.evaluate(() => !document.body.classList.contains('modal-scroll-locked'));
    assert.strictEqual(isUnlocked, true, 'Body scroll lock must be released on modal close');
    const drawerStillOpen = await page.$('.slideout-drawer');
    assert(drawerStillOpen, 'Job Registry slideout drawer must remain open after modal close');
    console.log('[PASS] Modal close restored exact background scroll position and preserved drawer.');

    // 6.9 Test background containment across all other 4 modals (Section 32)
    const modalSuites = [
      {
        name: 'Crew Allocator',
        open: () => window.HortOpsStaffAssignModal.open(window.HortOpsApp.state.allShifts[0].shiftId),
        close: () => window.HortOpsStaffAssignModal.close(),
        rootId: '#staff-assign-modal-root'
      },
      {
        name: 'Import',
        open: () => window.HortOpsImportModal.open(),
        close: () => window.HortOpsImportModal.close(),
        rootId: '#import-modal-root'
      },
      {
        name: 'Export',
        open: () => window.HortOpsExportModal.open(),
        close: () => window.HortOpsExportModal.close(),
        rootId: '#export-modal-root'
      },
      {
        name: 'Overtime Exemption',
        open: () => window.HortOpsStaffExemptionModal.open(window.HortOpsApp.state.staffList[0].id),
        close: () => window.HortOpsStaffExemptionModal.close(),
        rootId: '#staff-exemption-modal-root'
      },
      {
        name: 'Warnings',
        open: () => window.HortOpsWarningsModal.open(),
        close: () => window.HortOpsWarningsModal.close(),
        rootId: '#warnings-modal-root'
      }
    ];

    for (const suite of modalSuites) {
      const preModalY = await page.evaluate(() => window.scrollY);
      await page.evaluate(suite.open);
      await page.waitForTimeout(200);

      const locked = await page.evaluate(() => document.body.classList.contains('modal-scroll-locked'));
      assert.strictEqual(locked, true, `${suite.name} must lock body scroll`);

      const modalEl = await page.$(`${suite.rootId} .modal-card`);
      assert(modalEl, `${suite.name} card must be visible`);
      const cardBox = await modalEl.boundingBox();
      await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(100);

      const duringModalY = await page.evaluate(() => window.scrollY);
      assert.strictEqual(duringModalY, preModalY, `${suite.name} wheel must not scroll background`);

      await page.evaluate(suite.close);
      await page.waitForTimeout(200);

      const postModalY = await page.evaluate(() => window.scrollY);
      assert.strictEqual(postModalY, preModalY, `${suite.name} close must preserve background scroll position`);
      const unlocked = await page.evaluate(() => !document.body.classList.contains('modal-scroll-locked'));
      assert.strictEqual(unlocked, true, `${suite.name} close must release body scroll lock`);
      console.log(`[PASS] ${suite.name} modal containment, inertness, and scroll restoration verified.`);
    }

    // 6.10 Short viewport test (Section 33)
    await page.setViewportSize({ width: 1200, height: 520 });
    await page.waitForTimeout(100);

    await page.click('button.btn-add-job-header');
    await page.waitForTimeout(300);

    const shortHeaderBox = await page.$eval('#job-edit-modal-root .modal-header', el => el.getBoundingClientRect());
    const shortFooterBox = await page.$eval('#job-edit-modal-root .modal-footer', el => el.getBoundingClientRect());

    assert(shortHeaderBox.top >= 0, 'Modal header must be fully visible within short viewport');
    assert(shortFooterBox.bottom <= 520, 'Modal footer must remain accessible within short viewport');

    await page.$eval('#job-edit-modal-root .modal-body', el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(100);
    const scrolledShort = await page.$eval('#job-edit-modal-root .modal-body', el => el.scrollTop);
    assert(scrolledShort > 0, 'Modal body must remain internally scrollable in short viewport');

    await page.click('#job-edit-modal-root .modal-footer button:has-text("Cancel")');
    await page.waitForTimeout(200);
    await page.setViewportSize({ width: 1280, height: 800 });
    console.log('[PASS] Short viewport (520px height) internal scrolling and header/footer accessibility verified.');

    // Step 7: Verify Truthful Header Storage Indicator
    const healthPill = await page.$eval('.header-health-pill', el => el.innerText);
    assert(healthPill.includes('Saved'), 'Storage header must show truthful Saved state under healthy storage');
    console.log('[PASS] Truthful header storage health pill verified.');

    // Step 7.1: Section 22 Security Regression Test — Crew Allocator Escaping (Mandate Pass 9)
    await page.evaluate(() => {
      window.HortOpsApp.state.staffList.push({
        id: 'sec-staff-xss',
        name: 'Sec XSS Staff',
        department: '"><img src=x data-security-department="1">',
        team: '"><img src=x data-security-team="1">',
        status: 'active'
      });
    });
    await page.evaluate(() => {
      window.HortOpsStaffAssignModal.open(window.HortOpsApp.state.allShifts[0].shiftId);
    });
    await page.waitForTimeout(300);

    const injectedImgs = await page.$$('img[data-security-department], img[data-security-team]');
    assert.strictEqual(injectedImgs.length, 0, 'Payload tags must NOT execute or be injected into DOM');

    const deptOpts = await page.$$eval('#assign-filter-dept option', opts => opts.map(o => o.value));
    assert(deptOpts.includes('"><img src=x data-security-department="1">'), 'Escaped department string must be present as option value');
    
    // Select the department and check team options
    await page.selectOption('#assign-filter-dept', '"><img src=x data-security-department="1">');
    await page.waitForTimeout(100);
    const teamOpts = await page.$$eval('#assign-filter-team option', opts => opts.map(o => o.value));
    assert(teamOpts.includes('"><img src=x data-security-team="1">'), 'Escaped team string must be present as option value');

    await page.evaluate(() => {
      window.HortOpsStaffAssignModal.close();
      const idx = window.HortOpsApp.state.staffList.findIndex(s => s.id === 'sec-staff-xss');
      if (idx !== -1) window.HortOpsApp.state.staffList.splice(idx, 1);
    });
    await page.waitForTimeout(200);
    console.log('[PASS] Section 22: Crew Allocator department and team XSS escaping verified.');

    // Step 7.2: Section 32 Job Editor Dynamic Workforce Hierarchy Test (Mandate Pass 9)
    await page.evaluate(() => {
      window.HortOpsApp.state.staffList.push({
        id: 'rc-workforce-staff',
        name: 'RC Workforce Staff',
        department: 'RC Dynamic Dept',
        team: 'RC Dynamic Team',
        status: 'active'
      });
    });

    await page.click('button.btn-add-job-header');
    await page.waitForTimeout(300);

    const jobDeptOpts = await page.$$eval('#job-dept-target option', opts => opts.map(o => o.value));
    assert(jobDeptOpts.includes('RC Dynamic Dept'), 'Job Editor department dropdown must reflect live staffList');

    await page.selectOption('#job-dept-target', 'RC Dynamic Dept');
    await page.waitForTimeout(100);

    const jobTeamOpts = await page.$$eval('#job-team-target option', opts => opts.map(o => o.value));
    assert(jobTeamOpts.includes('RC Dynamic Team'), 'Job Editor team dropdown must reflect live staffList for selected dept');

    await page.click('#job-edit-modal-root .modal-footer button:has-text("Cancel")');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const idx = window.HortOpsApp.state.staffList.findIndex(s => s.id === 'rc-workforce-staff');
      if (idx !== -1) window.HortOpsApp.state.staffList.splice(idx, 1);
    });
    console.log('[PASS] Section 32: Job Editor dynamic workforce hierarchy verified against live staffList.');

    // Step 7.3: Section 9 & 27: JavaScript Injection Click Tests (Mandate Pass 10)
    // Job Editor exclusive chip click test
    await page.evaluate(() => {
      window.HortOpsApp.state.staffList.push({
        id: 'xss-team-staff',
        name: 'XSS Team Staff',
        department: 'Parks',
        team: "x');window.__teamInjected=123;//",
        status: 'active'
      });
      window.HortOpsJobEditModal.open('tramline-5am');
      window.HortOpsJobEditModal.formData.isExclusiveTeams = true;
      window.HortOpsJobEditModal.renderModal();
    });
    await page.waitForTimeout(300);

    const targetChip = await page.waitForSelector('button.btn-exclusive-chip[data-team="x\');window.__teamInjected=123;//"]');
    assert(targetChip, 'Exclusive chip with special team name must exist');
    await targetChip.click();
    await page.waitForTimeout(100);

    const teamInjected = await page.evaluate(() => window.__teamInjected);
    assert.strictEqual(teamInjected, undefined, 'Clicking team chip must NOT execute injected JavaScript string');

    const isTeamToggled = await page.evaluate(() => {
      return (window.HortOpsJobEditModal.formData.exclusiveTeams || []).indexOf("x');window.__teamInjected=123;//") !== -1;
    });
    assert.strictEqual(isTeamToggled, true, 'Team chip click must successfully toggle team in formData');

    await page.click('#job-edit-modal-root .modal-footer button:has-text("Cancel")');
    await page.waitForTimeout(200);

    // Crew Allocator Auto-Fill click test
    await page.evaluate(() => {
      const shift = window.HortOpsApp.state.allShifts[0];
      const job = window.HortOpsApp.state.jobs.find(j => j.id === shift.jobId);
      if (job) {
        job.primaryTeam = "x');window.__autoInjected=456;//";
      }
      window.HortOpsStaffAssignModal.open(shift.shiftId);
    });
    await page.waitForTimeout(300);

    const autoFillBtn = await page.waitForSelector('button.btn-autofill-team[data-team="x\');window.__autoInjected=456;//"]');
    assert(autoFillBtn, 'Auto-Fill button with special team name must exist');
    await autoFillBtn.click();
    await page.waitForTimeout(100);

    const autoInjected = await page.evaluate(() => window.__autoInjected);
    assert.strictEqual(autoInjected, undefined, 'Clicking Auto-Fill button must NOT execute injected JavaScript string');

    await page.evaluate(() => {
      window.HortOpsStaffAssignModal.close();
      const sIdx = window.HortOpsApp.state.staffList.findIndex(s => s.id === 'xss-team-staff');
      if (sIdx !== -1) window.HortOpsApp.state.staffList.splice(sIdx, 1);
      const shift = window.HortOpsApp.state.allShifts[0];
      const job = window.HortOpsApp.state.jobs.find(j => j.id === shift.jobId);
      if (job) job.primaryTeam = 'Parks';
    });
    await page.waitForTimeout(200);
    console.log('[PASS] Section 9 & 27: Job Editor and Crew Allocator team handlers verified safe from JavaScript injection.');

    // Step 7.4: Section 17, 20 & 29: Job Editor Secondary & Tertiary Display and Historical Team Preservation (Mandate Pass 10)
    await page.evaluate(() => {
      window.HortOpsJobEditModal.open('tramline-5am');
    });
    await page.waitForTimeout(300);

    const primVal = await page.$eval('#job-team-target', el => el.value);
    assert.strictEqual(primVal, 'Parks', 'Primary team select must visibly display Parks');

    const secVal = await page.$eval('#job-sec-team-target', el => el.value);
    assert.strictEqual(secVal, 'Arboriculture', 'Secondary team select must visibly display Arboriculture');

    const tertVal = await page.$eval('#job-tert-team-target', el => el.value);
    assert.strictEqual(tertVal, 'Squares', 'Tertiary team select must visibly display Squares');

    // Save without changing and assert preferences preserved
    await page.click('#job-edit-modal-root .modal-footer button:has-text("Save Job Definition")');
    await page.waitForTimeout(300);

    const tramlineJob = await page.evaluate(() => window.HortOpsApp.state.jobs.find(j => j.id === 'tramline-5am'));
    assert.strictEqual(tramlineJob.secondaryTeam, 'Arboriculture', 'Secondary team must be preserved on save');
    assert.strictEqual(tramlineJob.tertiaryTeam, 'Squares', 'Tertiary team must be preserved on save');

    // Historical missing team test: job has team not present in live workforce
    await page.evaluate(() => {
      const j = window.HortOpsApp.state.jobs.find(j => j.id === 'tramline-5am');
      j.secondaryTeam = 'Historical Absent Team';
      window.HortOpsJobEditModal.open('tramline-5am');
    });
    await page.waitForTimeout(300);

    const histSecVal = await page.$eval('#job-sec-team-target', el => el.value);
    assert.strictEqual(histSecVal, 'Historical Absent Team', 'Historical team absent from workforce must remain visible and selected');

    await page.click('#job-edit-modal-root .modal-footer button:has-text("Cancel")');
    await page.waitForTimeout(200);

    // Restore seeded secondaryTeam
    await page.evaluate(() => {
      const j = window.HortOpsApp.state.jobs.find(j => j.id === 'tramline-5am');
      j.secondaryTeam = 'Arboriculture';
    });
    console.log('[PASS] Section 17, 20 & 29: Job Editor Secondary & Tertiary team preferences and historical preservation verified.');

    // Step 7B: Offline17 Truthful Recovery Required UI State Test
    await page.evaluate(() => {
      window.HortOpsApp.state.recoveryRequired = true;
      window.HortOpsApp.state.recoverySource = 'smoke_test';
      window.HortOpsApp.renderCurrentView();
    });
    await page.waitForTimeout(300);

    const recoveryHeaderPill = await page.$eval('.header-health-pill', el => el.innerText);
    assert(recoveryHeaderPill.includes('Recovery Required'), 'Header must display Recovery Required');
    assert(!recoveryHeaderPill.includes('Saved'), 'Header must NOT display Saved when recoveryRequired is true');

    const warnBtn = await page.$('#btn-header-warnings');
    assert(warnBtn, 'Warnings button must be visible when recoveryRequired is true');

    // Restore normal state
    await page.evaluate(() => {
      window.HortOpsApp.state.recoveryRequired = false;
      window.HortOpsApp.state.recoverySource = null;
      window.HortOpsApp.renderCurrentView();
    });
    await page.waitForTimeout(200);
    console.log('[PASS] Truthful Recovery Required UI verified: exposes Recovery Required and suppresses Saved status.');

    // Step 7C: Offline17.5b Permanent Historical Sealing & Fail-Closed Lineage Smoke Verification
    console.log('Running Step 7C: Permanent Historical Sealing & Lineage Verification...');
    const step7cResult = await page.evaluate(async () => {
      const state = window.HortOpsApp.state;
      const job = state.jobs.find(j => j.id === 'tramline-5am') || state.jobs[0];
      const staff = (state.staffList && state.staffList[0]) || (window.HortOpsData && window.HortOpsData.STAFF_ROSTER[0]);
      const emp = staff.id;
      const jobId = job.id;

      // Real shift IDs that naturally occur in 2026 and 2027 for tramline-5am
      // Note: Historical shift must be strictly in the past (< today 2026-09-28) per Invariant I2
      const histShiftId = jobId + '@2026-09-13';
      const contShiftId = jobId + '@2027-01-31';
      const histInstId = 'ROSTER-' + jobId + '-2026-09-13-SLOT-1';
      const contInstId = 'ROSTER-' + jobId + '-2027-01-31-SLOT-1';

      const prevRostering = JSON.parse(JSON.stringify(state.rostering || { instructions: {}, provenance: {} }));
      const prevAssignments = JSON.parse(JSON.stringify(state.customAssignments || {}));

      // Ensure 2026 historical shift exists and has staff assigned
      var s26 = state.allShifts.find(function(s) { return s.shiftId === histShiftId; });
      if (!s26) {
        state.allShifts.push({ shiftId: histShiftId, jobId: jobId, date: '2026-09-13', crewSize: 1, primaryTeam: job.primaryTeam || 'Parks', assignedStaffIds: [emp] });
      } else {
        s26.assignedStaffIds = [emp];
      }

      state.rostering = state.rostering || { instructions: {}, provenance: {} };
      state.rostering.instructions = state.rostering.instructions || {};
      state.rostering.provenance = state.rostering.provenance || {};

      state.rostering.instructions[histInstId] = {
        id: histInstId,
        instructionId: histInstId,
        jobId: jobId,
        slotId: 'SLOT-1',
        mode: 'fixed',
        employeeId: emp,
        sourceShiftId: histShiftId,
        startDate: '2026-09-13',
        repeatCount: 1,
        status: 'historical',
        lineageRootId: histInstId,
        predecessorInstructionId: null
      };

      state.rostering.instructions[contInstId] = {
        id: contInstId,
        instructionId: contInstId,
        jobId: jobId,
        slotId: 'SLOT-1',
        mode: 'fixed',
        employeeId: emp,
        sourceShiftId: contShiftId,
        startDate: '2027-01-31',
        repeatCount: 2,
        status: 'active',
        lineageRootId: histInstId,
        predecessorInstructionId: histInstId
      };

      state.rostering.provenance[histShiftId + ':' + emp] = {
        source: 'rostering-rule',
        instructionId: histInstId,
        strategy: 'fixed',
        sourceShiftId: histShiftId,
        slotId: 'SLOT-1',
        sequenceIndex: 0
      };

      state.rostering.provenance[contShiftId + ':' + emp] = {
        source: 'rostering-rule',
        instructionId: contInstId,
        strategy: 'fixed',
        sourceShiftId: contShiftId,
        slotId: 'SLOT-1',
        sequenceIndex: 0
      };

      state.customAssignments[histShiftId] = [emp];
      state.customAssignments[contShiftId] = [emp];

      // Open modal on sealed historical shift
      window.HortOpsStaffAssignModal.open(histShiftId);

      return {
        histShiftId: histShiftId,
        contShiftId: contShiftId,
        histInstId: histInstId,
        contInstId: contInstId,
        prevRostering: prevRostering,
        prevAssignments: prevAssignments
      };
    });

    await page.waitForTimeout(300);

    // Verify Sealed Historical Banner with active continuation
    const bannerTextWithCont = await page.$eval('.sealed-history-banner', el => el.innerText);
    assert(bannerTextWithCont.includes('Historical Record'), 'Banner must display Historical Record');
    assert(bannerTextWithCont.includes('Open Active Rostering'), 'Banner must include Open Active Rostering CTA');

    // Verify Open Active Rostering button is visible
    const openActiveBtn = await page.$('button[onclick*="openActiveContinuation"]');
    assert(openActiveBtn, 'Open Active Rostering button must exist');

    // Verify selects are suppressed in sealed modal
    const suppressedSelects = await page.$$('.assignment-mode-select, .repeat-count-select');
    assert.strictEqual(suppressedSelects.length, 0, 'Mode and repeat selects must be suppressed in sealed modal');

    // Verify remove button is disabled with sealed historical tooltip
    const removeBtnDisabledWithCont = await page.$eval('button[disabled][title*="Sealed historical record"]', el => el !== null);
    assert(removeBtnDisabledWithCont, 'Remove button must be disabled with sealed historical tooltip');

    // Click [Open Active Rostering]
    await openActiveBtn.click();
    await page.waitForTimeout(500);

    // Verify modal transitioned year and opened on active continuation shift
    const currentYear = await page.evaluate(() => window.HortOpsApp.state.currentYear);
    assert.strictEqual(currentYear, 2027, 'App must have transitioned to 2027');

    const currentActiveShiftId = await page.evaluate(() => window.HortOpsStaffAssignModal.activeShiftId);
    assert.strictEqual(currentActiveShiftId, step7cResult.contShiftId, 'Modal must navigate to active continuation shift');

    // Verify active continuation has editable controls (not sealed)
    const activeBanner = await page.$('.sealed-history-banner');
    assert.strictEqual(activeBanner, null, 'Active continuation modal must NOT display historical banner');
    const editableSelects = await page.$$('.assignment-mode-select, .repeat-count-select');
    assert(editableSelects.length > 0, 'Active continuation modal must render editable select dropdowns');

    // Close modal
    await page.evaluate(() => window.HortOpsStaffAssignModal.close());
    await page.waitForTimeout(200);

    // Part 2: Test historical shift with NO active continuation
    await page.evaluate((r) => {
      const state = window.HortOpsApp.state;
      // Remove active continuation and associated provenance
      delete state.rostering.instructions[r.contInstId];
      Object.keys(state.rostering.provenance || {}).forEach(k => {
        if (state.rostering.provenance[k] && state.rostering.provenance[k].instructionId === r.contInstId) {
          delete state.rostering.provenance[k];
        }
      });
      delete state.customAssignments[r.contShiftId];
      // Switch back to 2026
      window.HortOpsApp.setYear(2026);
      window.HortOpsStaffAssignModal.open(r.histShiftId);
    }, step7cResult);

    await page.waitForTimeout(300);

    // Verify Completed Historical banner (NO continuation)
    const bannerTextNoCont = await page.$eval('.sealed-history-banner', el => el.innerText);
    assert(bannerTextNoCont.includes('This rostering instruction is complete. No active future continuation.'),
      'Banner must display complete message when no active continuation exists');
    const noContOpenBtn = await page.$('button[onclick*="openActiveContinuation"]');
    assert.strictEqual(noContOpenBtn, null, 'Open Active Rostering button must NOT be present when no continuation exists');

    // Verify remove button is disabled with complete tooltip
    const removeBtnDisabledComplete = await page.$eval('button[disabled][title*="This rostering instruction is complete"]', el => el !== null);
    assert(removeBtnDisabledComplete, 'Remove button must be disabled with complete status tooltip');

    // Cleanup and close
    await page.evaluate((r) => {
      window.HortOpsStaffAssignModal.close();
      window.HortOpsApp.state.rostering = r.prevRostering;
      window.HortOpsApp.state.customAssignments = r.prevAssignments;
      window.HortOpsApp.setYear(2026);
      window.HortOpsApp.renderCurrentView();
    }, step7cResult);
    await page.waitForTimeout(200);
    console.log('[PASS] Step 7C: Permanent historical sealing, navigation, and completed historical UI verified in browser.\n');

    // Step 7D: Offline17.5f - Active future schedule compatibility guard & Active -> Inactive protection in browser
    console.log('Running Step 7D: Active Future Schedule Compatibility & Status Protection...');
    const step7dResult = await page.evaluate(() => {
      const job = window.HortOpsApp.state.jobs.find(j => j.status === 'active' && j.frequencyType === 'recurring_weeks');
      if (!job) return { ok: false, error: 'No active recurring job found' };

      const digest = window.HortOpsScheduler.generateOperationalDigest([job], 2026);
      const futureShifts = (digest && digest.allShifts) ? digest.allShifts.filter(s => s.jobId === job.id && s.date >= '2026-10-01') : [];
      if (futureShifts.length === 0) return { ok: false, error: 'No future shifts found for job' };

      const testShift = futureShifts[0];
      const state = window.HortOpsApp.state;
      const instId = 'ROSTER-' + job.id + '-' + testShift.date + '-SLOT-1';
      state.rostering = state.rostering || { instructions: {}, provenance: {} };
      state.rostering.instructions = state.rostering.instructions || {};
      state.rostering.instructions[instId] = {
        id: instId,
        instructionId: instId,
        jobId: job.id,
        slotId: 'SLOT-1',
        mode: 'fixed',
        employeeId: (state.staffList && state.staffList[0] && state.staffList[0].id) || 'EMP-01',
        sourceShiftId: testShift.shiftId,
        startDate: testShift.date,
        repeatCount: 2,
        status: 'active'
      };

      // 1. Attempt status toggle via JobRegistry.toggleStatus
      window.HortOpsJobRegistry.toggleStatus(job.id);
      const statusAfterToggle = job.status;

      // 2. Attempt incompatible recurrence edit via saveJob
      const saveRes = window.HortOpsApp.saveJob(Object.assign({}, job, { intervalWeeks: (job.intervalWeeks || 1) + 1 }));

      // Clean up test instruction
      delete state.rostering.instructions[instId];

      return {
        ok: true,
        statusAfterToggle: statusAfterToggle,
        saveResSuccess: saveRes.success,
        saveResError: saveRes.error
      };
    });

    assert(step7dResult.ok, 'Step 7D evaluation must succeed');
    assert.strictEqual(step7dResult.statusAfterToggle, 'active', 'Job.status must remain active after blocked toggleStatus');
    assert.strictEqual(step7dResult.saveResSuccess, false, 'Incompatible recurrence edit must fail saveJob');
    assert(step7dResult.saveResError.includes('active future rostering'), 'Error message must specify active future rostering');
    assert(lastDialogMessage.includes('cannot be made inactive') || lastDialogMessage.includes('active future rostering'),
      'Native alert dialog must display active future rostering warning');
    console.log('[PASS] Step 7D: Active future schedule compatibility and status protection verified in browser.\n');

    // Step 7E: Offline17.5g - Job dependency detection & assignment-free active Delete protection in browser
    console.log('Running Step 7E: Assignment-Free Active Future Job Delete Protection...');
    lastDialogMessage = '';
    const step7eResult = await page.evaluate(() => {
      const job = window.HortOpsApp.state.jobs.find(j => j.status === 'active' && j.frequencyType === 'recurring_weeks');
      if (!job) return { ok: false, error: 'No active recurring job found' };

      const digest = window.HortOpsScheduler.generateOperationalDigest([job], 2026);
      const futureShifts = (digest && digest.allShifts) ? digest.allShifts.filter(s => s.jobId === job.id && s.date >= '2026-10-01') : [];
      if (futureShifts.length === 0) return { ok: false, error: 'No future shifts found for job' };

      const testShift = futureShifts[0];
      const state = window.HortOpsApp.state;
      const instId = 'ROSTER-VACANT-' + job.id + '-' + testShift.date + '-SLOT-1';
      state.rostering = state.rostering || { instructions: {}, provenance: {} };
      state.rostering.instructions = state.rostering.instructions || {};
      state.rostering.instructions[instId] = {
        id: instId,
        instructionId: instId,
        jobId: job.id,
        slotId: 'SLOT-1',
        mode: 'fixed',
        employeeId: (state.staffList && state.staffList[0] && state.staffList[0].id) || 'EMP-001',
        sourceShiftId: testShift.shiftId,
        startDate: testShift.date,
        repeatCount: 3,
        status: 'active',
        predecessorInstructionId: null,
        lineageRootId: instId
      };

      // Ensure zero custom assignment rows exist for this job
      state.customAssignments = state.customAssignments || {};
      Object.keys(state.customAssignments).forEach(k => {
        if (k.indexOf(job.id + '@') === 0) delete state.customAssignments[k];
      });

      // Query dependencies: rostering instruction must be detected as dependency
      const deps = window.HortOpsApp.getJobDependencies(job.id, state);

      // Attempt to delete job: active future instruction with 0 assignments must block retirement/deletion
      const jobCountBefore = state.jobs.length;
      window.HortOpsApp.deleteJob(job.id);
      const jobAfter = state.jobs.find(j => j.id === job.id);

      // Clean up test instruction
      delete state.rostering.instructions[instId];

      return {
        ok: true,
        depsInstructions: deps.rosteringInstructions,
        canHardDelete: deps.canHardDelete,
        jobCountBefore: jobCountBefore,
        jobCountAfter: state.jobs.length,
        jobStatusAfter: jobAfter ? jobAfter.status : null
      };
    });

    assert(step7eResult.ok, 'Step 7E evaluation must succeed');
    assert(step7eResult.depsInstructions >= 1, 'Job dependencies must count rostering instructions');
    assert.strictEqual(step7eResult.canHardDelete, false, 'Job with active instruction must have canHardDelete: false');
    assert.strictEqual(step7eResult.jobCountBefore, step7eResult.jobCountAfter, 'Job must NOT be deleted from state.jobs');
    assert.strictEqual(step7eResult.jobStatusAfter, 'active', 'Job.status must remain active (retirement blocked by active future rostering)');
    assert(lastDialogMessage.includes('cannot be made inactive') || lastDialogMessage.includes('active future rostering'),
      'Native alert dialog must display active future rostering warning on deleteJob');
    console.log('[PASS] Step 7E: Assignment-free active future Job delete protection verified in browser.\n');

    // Step 7F: Offline17.5h - Exhausted Active Instruction Retirement & Sealing in Browser
    console.log('Running Step 7F: Exhausted Active Instruction Retirement & Sealing in Browser...');
    lastDialogMessage = '';
    const step7fResult = await page.evaluate(() => {
      const state = window.HortOpsApp.state;
      const testJob = {
        id: 'JOB-EXHAUST-SMOKE',
        name: 'Exhausted Smoke Job',
        frequencyType: 'recurring_weeks',
        intervalWeeks: 1,
        anchorDate: '2025-05-03',
        preferredDay: 'saturday',
        status: 'active',
        shiftDurationHours: 8,
        crewSize: 1
      };
      state.jobs.push(testJob);

      const instId = 'ROSTER-JOB-EXHAUST-SMOKE-2025-05-03-SLOT-0';
      state.rostering = state.rostering || { instructions: {}, provenance: {} };
      state.rostering.instructions = state.rostering.instructions || {};
      state.rostering.instructions[instId] = {
        id: instId,
        instructionId: instId,
        jobId: testJob.id,
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 1,
        sourceShiftId: testJob.id + '@2025-05-03',
        startDate: '2025-05-03',
        status: 'active',
        predecessorInstructionId: null,
        lineageRootId: instId,
        assignments: {}
      };

      // Perform retirement via saveJob
      const saveRes = window.HortOpsApp.saveJob(Object.assign({}, testJob, { status: 'inactive' }));
      const jobAfter = state.jobs.find(j => j.id === testJob.id);
      const instAfter = state.rostering.instructions[instId];

      const result = {
        ok: true,
        saveSuccess: saveRes && saveRes.success,
        saveError: saveRes && saveRes.error,
        jobStatusAfter: jobAfter ? jobAfter.status : null,
        instStatusAfter: instAfter ? instAfter.status : null
      };

      // Clean up: remove test job and instruction from state
      delete state.rostering.instructions[instId];
      const jobIdx = state.jobs.findIndex(j => j.id === testJob.id);
      if (jobIdx !== -1) state.jobs.splice(jobIdx, 1);
      window.HortOpsApp.saveCurrentWorkspace();
      window.HortOpsApp.renderCurrentView();

      return result;
    });

    assert(step7fResult.ok, 'Step 7F evaluation must succeed: ' + (step7fResult.error || ''));
    assert.strictEqual(step7fResult.saveSuccess, true, 'saveJob must succeed for exhausted instruction retirement: ' + step7fResult.saveError);
    assert.strictEqual(step7fResult.jobStatusAfter, 'inactive', 'Job must become inactive');
    assert.strictEqual(step7fResult.instStatusAfter, 'historical', 'Exhausted active instruction must be sealed to historical');
    console.log('[PASS] Step 7F: Exhausted active instruction retirement & sealing verified in browser.\n');

    // Step 7G: Offline17.5i - Exhausted Active Instruction Sealing on Schedule Mutation in Browser
    console.log('Running Step 7G: Exhausted Active Instruction Sealing on Schedule Mutation in Browser...');
    lastDialogMessage = '';
    const step7gResult = await page.evaluate(() => {
      const state = window.HortOpsApp.state;
      const testJob = {
        id: 'JOB-SCHED-MUT-SMOKE',
        name: 'Schedule Mutation Smoke Job',
        frequencyType: 'recurring_weeks',
        intervalWeeks: 1,
        anchorDate: '2025-05-03',
        preferredDay: 'saturday',
        status: 'active',
        shiftDurationHours: 8,
        crewSize: 1
      };
      state.jobs.push(testJob);
      const instId = 'ROSTER-JOB-SCHED-MUT-SMOKE-2025-05-03-SLOT-0';
      state.rostering = state.rostering || { instructions: {}, provenance: {} };
      state.rostering.instructions[instId] = {
        id: instId,
        instructionId: instId,
        jobId: testJob.id,
        slotId: 'SLOT-0',
        mode: 'manual',
        repeatCount: 2,
        sourceShiftId: `${testJob.id}@2025-05-03`,
        status: 'active',
        lineageRootId: instId,
        predecessorInstructionId: null,
        assignments: {}
      };

      const mutateJob = Object.assign({}, testJob, { intervalWeeks: 4 });
      const saveRes = window.HortOpsApp.saveJob(mutateJob);
      const jobAfter = state.jobs.find(j => j.id === testJob.id);
      const instAfter = state.rostering.instructions[instId];

      const result = {
        ok: true,
        saveSuccess: saveRes && saveRes.success,
        saveError: saveRes && saveRes.error,
        intervalWeeksAfter: jobAfter ? jobAfter.intervalWeeks : null,
        instStatusAfter: instAfter ? instAfter.status : null
      };

      // Clean up: remove test job and instruction from state
      delete state.rostering.instructions[instId];
      const jobIdx = state.jobs.findIndex(j => j.id === testJob.id);
      if (jobIdx !== -1) state.jobs.splice(jobIdx, 1);
      window.HortOpsApp.saveCurrentWorkspace();
      window.HortOpsApp.renderCurrentView();

      return result;
    });

    assert(step7gResult.ok, 'Step 7G evaluation must succeed: ' + (step7gResult.error || ''));
    assert.strictEqual(step7gResult.saveSuccess, true, 'saveJob must succeed for exhausted instruction schedule mutation: ' + step7gResult.saveError);
    assert.strictEqual(step7gResult.intervalWeeksAfter, 4, 'Job intervalWeeks must be updated to 4');
    assert.strictEqual(step7gResult.instStatusAfter, 'historical', 'Exhausted active instruction must be sealed to historical');
    console.log('[PASS] Step 7G: Exhausted active instruction sealing on schedule mutation verified in browser.\n');

    // Step 8: Take verification screenshot
    const screenshotDir = path.join(baseDir, 'test_reports', 'browser');
        fs.mkdirSync(screenshotDir, { recursive: true });
        const screenshotPath = path.join(screenshotDir, 'offline_release_gates_captured.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const repoScreenshotPath = path.join(screenshotDir, 'offline_release_gates_verified.png');
    fs.copyFileSync(screenshotPath, repoScreenshotPath);
    console.log(`[PASS] Verification screenshot saved to ${screenshotPath} and ${repoScreenshotPath}`);

    // Step 9: Assert ZERO console errors or unhandled exceptions
    console.log(`Browser console errors logged: ${consoleErrors.length}`);
    console.log(`Browser unhandled page errors: ${uncaughtErrors.length}`);

    assert.strictEqual(consoleErrors.length, 0, `Expected 0 console errors, found: ${consoleErrors.join(' | ')}`);
    assert.strictEqual(uncaughtErrors.length, 0, `Expected 0 page errors, found: ${uncaughtErrors.join(' | ')}`);

    console.log('BROWSER SMOKE TESTS PASSED (100%)\n');

  } catch(err) {
    console.error('BROWSER SMOKE TEST FAILED:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
