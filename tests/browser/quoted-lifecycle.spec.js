const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});

test("a newly received NSA Register does not offer Quoted as a human lifecycle action", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.workspace());
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push({
        id: "NSA-APP-QUOTE-GUARD",
        owner: "NSA",
        type: "application",
        receiptNumber: "QUOTE-GUARD",
        title: "Quote guard",
        status: "received",
        dateReceived: "2026-09-13",
        createdAt: "2026-09-13T00:00:00.000Z",
        updatedAt: "2026-09-13T00:00:00.000Z",
        provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "QUOTE-GUARD", importedAt: "2026-09-13T00:00:00.000Z" }
      });
      return workspace;
    });
    const host = document.createElement("article");
    host.setAttribute("data-register-drawer-record", "NSA-APP-QUOTE-GUARD");
    host.innerHTML = '<section data-register-status-history-panel><div data-register-status-history-list></div></section>';
    document.body.appendChild(host);
    document.dispatchEvent(new CustomEvent("uos:workspace-changed"));
  });
  const frame = page.frameLocator("iframe");
  const trigger = frame.locator('[data-register-drawer-record="NSA-APP-QUOTE-GUARD"] [data-status-lifecycle-open]:visible');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const lifecycle = frame.locator("[data-status-lifecycle-dialog]");
  await expect(lifecycle).toBeVisible();
  await expect(lifecycle.locator('[data-status-command="quoted"]')).toHaveCount(0);
  await expect(lifecycle).toContainText("Received");

  const result = await child.evaluate(async () => {
    const before = window.UOS.ProgramApp.workspace();
    let error = "";
    try {
      await window.UOS.ProgramApp.executeStatusCommand({ entityId: "NSA-APP-QUOTE-GUARD", entityType: "application", to: "quoted", actor: "Test Officer" });
    } catch (exception) {
      error = exception.message;
    }
    const after = window.UOS.ProgramApp.workspace();
    return { error, beforeRevision: before.workspaceRevision, afterRevision: after.workspaceRevision, status: after.entities.applications.find((item) => item.id === "NSA-APP-QUOTE-GUARD").status };
  });
  expect(result.error).toContain("automatically");
  expect(result.afterRevision).toBe(result.beforeRevision);
  expect(result.status).toBe("received");
});

test("PC-013 Draft-first Quote Builder access allows navigating from Project with 0 Jobs, saving Draft Quote, and blocking Issue", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");

  const frame = page.frameLocator("iframe");
  const initialCount = await child.evaluate(() => (window.UOS.ProgramApp.workspace().entities.applications || []).length);

  await frame.locator("[data-register-add-record]").click();
  await expect.poll(() => child.evaluate(() => (window.UOS.ProgramApp.workspace().entities.applications || []).length)).toBe(initialCount + 1);

  const recordId = await child.evaluate(() => {
    const apps = window.UOS.ProgramApp.workspace().entities.applications;
    return apps[apps.length - 1].id;
  });

  const row = frame.locator(`tr[data-register-record="${recordId}"]`);
  await expect(row).toBeVisible();

  // Create Project from Register record via explicit governed action
  const createProjectBtn = frame.locator(`[data-register-drawer-record="${recordId}"] [data-register-action="create-project"]`).first();
  await expect(createProjectBtn).toBeVisible();
  await page.waitForTimeout(350);
  await createProjectBtn.click();

  // Verify Project is created and has 0 Jobs and 0 Costing Lines
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.selectedProjectId)).not.toBe("");
  const projId = await child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.selectedProjectId);

  const counts = await child.evaluate((projectId) => {
    const ws = window.UOS.ProgramApp.workspace();
    return {
      jobs: ws.entities.jobs.filter((j) => j.projectId === projectId).length,
      costingLines: ws.entities.costingLines.filter((c) => c.projectId === projectId).length
    };
  }, projId);
  expect(counts.jobs).toBe(0);
  expect(counts.costingLines).toBe(0);

  // Switch back to Register to verify Quote Builder shortcut on row
  await child.evaluate(() => window.UOS.ProgramApp.navigate("register"));
  await expect(frame.locator('[data-program-view="register"]')).toBeVisible();

  // Row Quote Builder button must be active / enabled
  const rowQuoteBtn = row.locator('button[data-register-action="quotes"]');
  await expect(rowQuoteBtn).toBeVisible();
  await expect(rowQuoteBtn).not.toBeDisabled();

  // Click Open in Quote Builder from the row mini-toolbar
  await rowQuoteBtn.click();

  // Verify Quote Builder opens
  await expect(frame.locator('[data-program-view="quotes"]')).toBeVisible();

  // Save Draft button is enabled for the selected project
  const saveBtn = frame.locator('[data-program-view="quotes"] [data-quote-save]');
  await expect(saveBtn).toBeVisible();
  await expect(saveBtn).toBeEnabled();

  // Save the draft quote
  await saveBtn.click();

  // Verify Draft quote exists in workspace
  await expect.poll(async () => child.evaluate((projectId) => {
    const ws = window.UOS.ProgramApp.workspace();
    return (ws.entities.quotes || []).filter((q) => q.projectId === projectId).length;
  }, projId)).toBeGreaterThanOrEqual(1);

  const draftQuote = await child.evaluate((projectId) => {
    const ws = window.UOS.ProgramApp.workspace();
    return (ws.entities.quotes || []).find((q) => q.projectId === projectId);
  }, projId);
  expect(draftQuote.status).toBe("Draft");

  // Verify PC-013 blocks Quote Issue
  const readiness = await child.evaluate((quoteId) => {
    const ws = window.UOS.ProgramApp.workspace();
    return window.UOS.ProgramQuotes.evaluateReadiness(ws, quoteId);
  }, draftQuote.id);
  expect(readiness.ready).toBe(false);

  // Direct issue call throws error
  const issueResult = await child.evaluate((quoteId) => {
    try {
      window.UOS.ProgramQuotes.issue(window.UOS.ProgramApp.workspace(), quoteId);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, draftQuote.id);
  expect(issueResult.success).toBe(false);
  expect(issueResult.error).toMatch(/line item|readiness/i);
});


test("PC-013 C2: Quote Builder evaluates prospective customer funding and allows Quote Issue with $0 council budget", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");

  const frame = page.frameLocator("iframe");
  const initialCount = await child.evaluate(() => (window.UOS.ProgramApp.workspace().entities.applications || []).length);

  // Add application record
  await frame.locator("[data-register-add-record]").click();
  await expect.poll(() => child.evaluate(() => (window.UOS.ProgramApp.workspace().entities.applications || []).length)).toBe(initialCount + 1);

  const recordId = await child.evaluate(() => {
    const apps = window.UOS.ProgramApp.workspace().entities.applications;
    return apps[apps.length - 1].id;
  });

  // Create Project via drawer action
  const createProjectBtn = frame.locator(`[data-register-drawer-record="${recordId}"] [data-register-action="create-project"]`).first();
  await expect(createProjectBtn).toBeVisible();
  await page.waitForTimeout(350);
  await createProjectBtn.click();

  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.selectedProjectId)).not.toBe("");
  const projId = await child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.selectedProjectId);

  // Add costed job and ensure operationalAmount = 0
  await child.evaluate(async (projectId) => {
    await window.UOS.ProgramApp.updateWorkspace((ws) => {
      const jobId = window.UOS.ProgramModel.stableId("NSA", "job", projectId + ":c2-job");
      ws.entities.jobs.push({
        id: jobId,
        owner: "NSA",
        type: "job",
        projectId: projectId,
        title: "Tree maintenance",
        status: "Draft",
        sourceKind: "calculator",
        sourceEntityId: "rate-1"
      });
      ws.entities.costingLines.push({
        id: window.UOS.ProgramModel.stableId("NSA", "costingLine", jobId + ":c2-cost"),
        owner: "NSA",
        type: "costingLine",
        projectId: projectId,
        jobId: jobId,
        description: "Selective tree maintenance",
        quantity: 1,
        unitRate: 150,
        estimatedTotal: 150
      });
      const proj = ws.entities.projects.find((p) => p.id === projectId);
      if (proj) {
        proj.funding = proj.funding || {};
        proj.funding.operationalAmount = 0;
      }
      return ws;
    });
  }, projId);

  // Open Quote Builder
  await child.evaluate(() => window.UOS.ProgramApp.navigate("quotes"));
  await expect(frame.locator('[data-program-view="quotes"]')).toBeVisible();

  // Save Draft Quote (which imports costing lines)
  const saveBtn = frame.locator('[data-program-view="quotes"] [data-quote-save]');
  await expect(saveBtn).toBeVisible();
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();

  // Dismiss Quote Saved alert modal
  const okBtn = frame.locator('.uos-modal-backdrop button').first();
  await expect(okBtn).toBeVisible();
  await okBtn.click();
  await expect(frame.locator('.uos-modal-backdrop')).not.toBeVisible();

  // Verify Draft quote created with $150 ex-GST
  await expect.poll(async () => child.evaluate((projectId) => {
    const ws = window.UOS.ProgramApp.workspace();
    return (ws.entities.quotes || []).filter((q) => q.projectId === projectId).length;
  }, projId)).toBeGreaterThanOrEqual(1);

  // Verify Quote Builder displays customer quote prospective funding as $150.00 and balanced position ($0.00)
  const customerFundingNode = frame.locator('[data-program-view="quotes"] [data-funding-value="customer"]').first();
  const totalFundingNode = frame.locator('[data-program-view="quotes"] [data-funding-value="total"]').first();
  const positionFundingNode = frame.locator('[data-program-view="quotes"] [data-funding-value="positionTotal"]').first();
  await expect(customerFundingNode).toContainText("$150.00");
  await expect(totalFundingNode).toContainText("$150.00");
  await expect(positionFundingNode).toContainText("$0.00");

  // Verify Issue button is enabled
  const issueBtn = frame.locator('[data-program-view="quotes"] [data-quote-issue]');
  await expect(issueBtn).toBeVisible();
  await expect(issueBtn).toBeEnabled();

  // Issue the Quote
  await issueBtn.click();

  // Verify Quote status is updated to Issued in the workspace
  await expect.poll(async () => child.evaluate((projectId) => {
    const ws = window.UOS.ProgramApp.workspace();
    const q = (ws.entities.quotes || []).find((item) => item.projectId === projectId);
    return q ? q.status : "";
  }, projId)).toBe("Issued");

  // Verify readiness snapshot is recorded and ready: true
  const issuedQuote = await child.evaluate((projectId) => {
    const ws = window.UOS.ProgramApp.workspace();
    return (ws.entities.quotes || []).find((item) => item.projectId === projectId);
  }, projId);
  expect(issuedQuote.readinessSnapshot.ready).toBe(true);
  expect(issuedQuote.readinessSnapshot.evidence.funding.fundingGap).toBe(0);
  expect(issuedQuote.readinessSnapshot.evidence.funding.customerQuote).toBe(150);
});
