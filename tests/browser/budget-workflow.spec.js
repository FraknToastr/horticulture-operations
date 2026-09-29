const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});

test("Budget UI allocates to a Register record before any Project exists", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((frame) => frame !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((ws) => {
      ws.entities.applications.push({
        id: "NSA-APP-BUDGET-UI", owner: "NSA", type: "application",
        title: "Budget UI test", receipt: "R-UI-42", status: "received", dateReceived: "2026-09-28"
      });
      return ws;
    });
    await window.UOS.ProgramApp.navigate("budget");
  });
  const frame = page.frameLocator("iframe");
  await expect(frame.locator('[data-program-view="budget"]')).toBeVisible();
  await frame.locator('[data-budget-year]').selectOption("2026-27");
  await frame.locator('[data-budget-action="create"]').click();
  await frame.locator('[data-budget-form="create"] button[type="submit"]').click();
  await expect(frame.locator('[data-budget-action="approve"]')).toBeVisible();
  await frame.locator('[data-budget-action="approve"]').click();
  const approval = frame.locator('[data-budget-form="approve"]');
  await approval.locator('[name="amount"]').fill("1000");
  await approval.locator('[name="actor"]').fill("Budget officer");
  await approval.locator('[name="approver"]').fill("Budget officer");
  await approval.locator('[name="reason"]').fill("Annual approval");
  await approval.locator('[name="evidence"]').fill("Council approval record");
  await approval.locator('button[type="submit"]').click();
  await expect(approval).toBeHidden();
  await child.evaluate(() => window.UOS.ProgramApp.navigate("register"));
  await expect(frame.locator('[data-program-view="register"]')).toBeVisible();
  const filterToggle = frame.locator('[data-filter-drawer="register"] [data-filter-drawer-toggle]');
  if (await filterToggle.count()) await filterToggle.click();
  await frame.locator('[data-register-search]').fill("BUDGET-UI");
  const row = frame.locator('tr[data-register-record="NSA-APP-BUDGET-UI"]');
  await expect(row).toBeVisible();
  await row.locator('[data-disclosure-toggle]').click();
  const projectBudget = frame.locator('[data-register-drawer-record="NSA-APP-BUDGET-UI"] .program-register-nsa-summary-group--project');
  await expect(frame.locator('[data-register-budget-card]')).toHaveCount(0);
  await expect(projectBudget.locator('[data-register-operational-amount]')).toHaveCount(0);
  await expect(projectBudget).not.toContainText("Council Operational Amount");
  await expect(projectBudget.locator('[data-register-budget-row="action"]')).toContainText("Budget");
  await expect(projectBudget.locator('[data-register-allocation-fy]')).toHaveText("FY 2026/27");
  await expect(projectBudget.locator('[data-register-budget-row="allocation"]')).toContainText("$0.00");
  await projectBudget.locator('[data-register-action="allocate-budget"]').click();
  const allocation = frame.locator('[data-budget-form="allocate"]');
  await expect(allocation.locator('[name="registerId"]')).toHaveValue("NSA-APP-BUDGET-UI");
  await expect(allocation.locator('[name="budgetId"] option:checked')).toContainText("2026/27");
  await expect(allocation.locator('[data-budget-allocation-context]')).toContainText("Approved authority $1,000.00");
  await allocation.locator('[name="amount"]').fill("1200");
  await expect(allocation.locator('[data-budget-allocation-context]')).toContainText("Shortfall $200.00");
  await expect(allocation.locator('button[value="approved"]')).toBeDisabled();
  await allocation.locator('[name="amount"]').fill("600");
  await allocation.locator('[name="actor"]').fill("Budget officer");
  await allocation.locator('[name="approver"]').fill("Budget officer");
  await allocation.locator('[name="reason"]').fill("Initial record allocation");
  await allocation.locator('[name="evidence"]').fill("Allocation approval record");
  await allocation.locator('button[value="approved"]').click();
  await expect(projectBudget.locator('[data-register-allocation-amount]')).toHaveText("$600.00");
  await projectBudget.locator('[data-register-action="allocate-budget"]').click();
  const draft = frame.locator('[data-budget-form="allocate"]');
  await draft.locator('[name="amount"]').fill("50");
  await draft.locator('[name="actor"]').fill("Budget officer");
  await draft.locator('[name="reason"]').fill("Pending scope");
  await draft.locator('[name="evidence"]').fill("Awaiting approval file");
  await draft.locator('button[value="draft"]').click();
  await expect(draft).toBeHidden();
  await child.evaluate(() => window.UOS.ProgramApp.navigate("budget"));
  await expect(frame.locator('[data-budget-pending]')).toContainText("Pending scope");
  await expect(frame.locator('[data-budget-history]')).toContainText("$1,000.00");
  await expect(frame.locator('[data-budget-history]')).toContainText("NSA-APP-BUDGET-UI");
  await expect(frame.locator('[data-budget-history]')).toContainText("R-UI-42");
  await frame.locator('[data-budget-action="decide"]').click();
  const rejected = frame.locator('[data-budget-form="decide"]');
  await rejected.locator('[name="decision"]').selectOption("rejected");
  await rejected.locator('[name="approver"]').fill("Budget officer");
  await rejected.locator('[name="evidence"]').fill("Scope deferred");
  await rejected.locator('button[type="submit"]').click();
  await expect(frame.locator('[data-budget-pending]')).toContainText("No pending changes");
  const result = await child.evaluate(() => {
    const ws = window.UOS.ProgramApp.workspace();
    const budget = ws.entities.annualBudgets.find((item) => item.financialYear === "2026-27");
    return {
      projects: ws.entities.projects.length,
      allocated: window.UOS.ProgramBudget.budgetBalance(ws, budget.id).allocated,
      recordAmount: window.UOS.ProgramBudget.recordAmount(ws, "NSA-APP-BUDGET-UI")
    };
  });
  expect(result).toEqual({ projects: 0, allocated: 600, recordAmount: 600 });
});

test("NSA Register drawer places newest-first FY allocations in the inline table", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    const authority = { actor: "Budget officer", approver: "Budget officer", reason: "Inline budget test", evidence: "Council record", date: "2026-09-29" };
    await window.UOS.ProgramApp.updateWorkspace((initial) => {
      let ws = initial;
      ws.entities.applications.push({ id: "NSA-APP-INLINE-BUDGET", owner: "NSA", type: "application", title: "Linked NSA budget", status: "received", dateReceived: "2026-09-29" });
      ws = window.UOS.ProgramModel.promoteRegisterRecord(ws, "NSA-APP-INLINE-BUDGET").workspace;
      for (const owner of ["NSA"]) {
        for (const year of ["2025-26", "2026-27"]) {
          ws = window.UOS.ProgramBudget.createAnnualBudget(ws, { owner, financialYear: year });
          const budget = ws.entities.annualBudgets.find((item) => item.owner === owner && item.financialYear === year);
          ws = window.UOS.ProgramBudget.approveAnnualBudget(ws, budget.id, { ...authority, amount: 1000 });
          const registerId = owner === "NSA" ? "NSA-APP-INLINE-BUDGET" : "EVT-INLINE-BUDGET";
          ws = window.UOS.ProgramBudget.adjustAllocation(ws, budget.id, registerId, { ...authority, amount: year === "2026-27" ? 625 : 375 });
        }
      }
      ws.workspace.destination = "register";
      return ws;
    });
  });
  const frame = page.frameLocator("iframe");
  for (const recordId of ["NSA-APP-INLINE-BUDGET"]) {
    const row = frame.locator(`tr[data-register-record="${recordId}"]`);
    await row.locator("[data-disclosure-toggle]").click();
    const drawer = frame.locator(`[data-register-drawer-record="${recordId}"]`);
    const projectGroup = drawer.locator(".program-register-nsa-summary-group--project");
    const allocationRows = projectGroup.locator('[data-register-budget-row="allocation"]');
    await expect(allocationRows).toHaveCount(2);
    await expect(allocationRows.nth(0).locator("[data-register-allocation-fy]")).toHaveText("FY 2026/27");
    await expect(allocationRows.nth(0).locator("[data-register-allocation-amount]")).toHaveText("$625.00");
    await expect(allocationRows.nth(1).locator("[data-register-allocation-fy]")).toHaveText("FY 2025/26");
    await expect(allocationRows.nth(1).locator("[data-register-allocation-amount]")).toHaveText("$375.00");
    const geometry = await projectGroup.evaluate((group) => {
      const project = group.querySelector(".program-register-nsa-project-fact");
      const action = group.querySelector('[data-register-budget-row="action"]');
      const tableRow = group.querySelector('[data-register-budget-row="allocation-table"]');
      const table = tableRow?.querySelector("[data-register-allocation-table]");
      const header = table?.querySelector("[data-register-allocation-header]");
      const firstAllocation = table?.querySelector('[data-register-budget-row="allocation"]');
      const projectButton = project?.querySelector("button");
      const allocateButton = action?.querySelector("button");
      const headerStyle = header ? getComputedStyle(header) : null;
      const allocationStyle = firstAllocation ? getComputedStyle(firstAllocation) : null;
      return {
        actionImmediatelyAfterProject: project?.nextElementSibling === action,
        tableImmediatelyAfterAction: action?.nextElementSibling === tableRow,
        projectColumns: project ? getComputedStyle(project).gridTemplateColumns : "",
        actionColumns: action ? getComputedStyle(action).gridTemplateColumns : "",
        equalButtonWidths: !!projectButton && !!allocateButton && Math.abs(projectButton.getBoundingClientRect().width - allocateButton.getBoundingClientRect().width) <= 1,
        tableMatchesActionWidth: !!allocateButton && !!table && Math.abs(allocateButton.getBoundingClientRect().width - table.getBoundingClientRect().width) <= 1,
        headerColumns: header ? getComputedStyle(header).gridTemplateColumns.split(" ").length : 0,
        headerText: header ? header.textContent.replace(/\s+/g, " ").trim() : "",
        compactHeader: !!headerStyle && parseFloat(headerStyle.fontSize) <= 10 && Number(headerStyle.fontWeight) >= 800,
        discreteRowDivider: !!allocationStyle && parseFloat(allocationStyle.borderTopWidth) >= 1,
        allocationRows: table?.querySelectorAll('[data-register-budget-row="allocation"]').length || 0
      };
    });
    expect(geometry).toEqual(expect.objectContaining({
      actionImmediatelyAfterProject: true,
      tableImmediatelyAfterAction: true,
      equalButtonWidths: true,
      tableMatchesActionWidth: true,
      headerColumns: 2,
      headerText: "Financial FYAllocated",
      compactHeader: true,
      discreteRowDivider: true,
      allocationRows: 2
    }));
    await expect(drawer.locator('[data-register-operational-amount]')).toHaveCount(0);
    await expect(drawer).not.toContainText("Council Operational Amount");
    expect(geometry.actionColumns).toBe(geometry.projectColumns);
    await projectGroup.locator('[data-register-action="allocate-budget"]').click();
    await expect(frame.locator('[data-budget-form="allocate"] [name="registerId"]')).toHaveValue(recordId);
    await frame.locator('[data-budget-form="allocate"]').getByRole("button", { name: "Cancel" }).click();
    await row.locator("[data-disclosure-toggle]").click();
  }
  await expect(frame.locator("[data-register-budget-card]")).toHaveCount(0);
});

test("Event Register drawer keeps project-free allocations in the inline table", async ({ page }) => {
  await page.goto("/src/program-planner/events.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    const authority = { actor: "Budget officer", approver: "Budget officer", reason: "Inline Event budget test", evidence: "Council record", date: "2026-09-29" };
    await window.UOS.ProgramApp.updateWorkspace((initial) => {
      let ws = initial;
      ws.entities.events.push({ id: "EVT-INLINE-BUDGET", owner: "EVT", type: "event", title: "Project-free Event budget", status: "received", startDate: "2026-09-29", endDate: "2026-09-30" });
      for (const year of ["2025-26", "2026-27"]) {
        ws = window.UOS.ProgramBudget.createAnnualBudget(ws, { owner: "EVT", financialYear: year });
        const budget = ws.entities.annualBudgets.find((item) => item.owner === "EVT" && item.financialYear === year);
        ws = window.UOS.ProgramBudget.approveAnnualBudget(ws, budget.id, { ...authority, amount: 1000 });
        ws = window.UOS.ProgramBudget.adjustAllocation(ws, budget.id, "EVT-INLINE-BUDGET", { ...authority, amount: year === "2026-27" ? 625 : 375 });
      }
      ws.workspace.destination = "register";
      return ws;
    });
  });
  const frame = page.frameLocator("iframe");
  const row = frame.locator('tr[data-register-record="EVT-INLINE-BUDGET"]');
  await row.locator("[data-disclosure-toggle]").click();
  const drawer = frame.locator('[data-register-drawer-record="EVT-INLINE-BUDGET"]');
  const projectGroup = drawer.locator(".program-register-nsa-summary-group--project");
  await expect(projectGroup.locator('[data-register-budget-row="allocation"]')).toHaveCount(2);
  await expect(projectGroup.locator("[data-register-allocation-header]")).toHaveText("Financial FYAllocated");
  await expect(projectGroup.locator('[data-register-budget-fy="2026-27"] [data-register-allocation-amount]')).toHaveText("$625.00");
  await expect(projectGroup.locator('[data-register-budget-fy="2025-26"] [data-register-allocation-amount]')).toHaveText("$375.00");
  await expect(projectGroup.locator('[data-register-action="allocate-budget"]')).toBeVisible();
  await expect(projectGroup).toContainText("Create Delivery Project");
});

test("Carry-forward requires review and confirmation before moving unused funds", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((frame) => frame !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    const api = window.UOS.ProgramBudget;
    const authority = { actor: "Budget officer", reason: "Year-end review", date: "2027-07-02" };
    await window.UOS.ProgramApp.updateWorkspace((initial) => {
      let ws = initial;
      ws.entities.applications.push({ id: "NSA-APP-CARRY-UI", owner: "NSA", type: "application", title: "Carry review", status: "received", dateReceived: "2026-09-28" });
      ws = api.createAnnualBudget(ws, { owner: "NSA", financialYear: "2026-27" });
      const source = ws.entities.annualBudgets[0].id;
      ws = api.approveAnnualBudget(ws, source, { ...authority, amount: 1000 });
      ws = api.adjustAllocation(ws, source, "NSA-APP-CARRY-UI", { ...authority, amount: 700 });
      ws = api.closeYear(ws, source, authority);
      ws = api.createAnnualBudget(ws, { owner: "NSA", financialYear: "2027-28" });
      const destination = ws.entities.annualBudgets.find((item) => item.financialYear === "2027-28").id;
      return api.approveAnnualBudget(ws, destination, { ...authority, amount: 0 });
    });
    await window.UOS.ProgramApp.navigate("register");
  });
  const frame = page.frameLocator("iframe");
  const registerRow = frame.locator('tr[data-register-record="NSA-APP-CARRY-UI"]');
  await registerRow.locator("[data-disclosure-toggle]").click();
  let carryDrawer = frame.locator('[data-register-drawer-record="NSA-APP-CARRY-UI"]');
  await expect(carryDrawer.locator('[data-register-edit-key="carryForward"][data-register-value="true"]')).toBeVisible();
  await expect(carryDrawer.locator('[data-register-carry-forward]')).toHaveCount(0);
  await expect(carryDrawer.locator('[data-register-budget-fy="2027-28"]')).toHaveCount(0);

  await child.evaluate(async () => {
    await window.UOS.ProgramApp.navigate("budget");
    window.UOS.ProgramBudgetUI.openCarryForward("NSA-APP-CARRY-UI");
  });
  const review = frame.locator('[data-budget-form="carry-review"]');
  await expect(review).toBeVisible();
  expect(await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.allocationEntries.filter((entry) => entry.kind === "carryForward").length)).toBe(0);
  await review.locator('[name="answer"]').selectOption("Yes");
  await review.locator('[name="actor"]').fill("Budget officer");
  await review.locator('[name="reason"]').fill("Year-end review");
  await review.locator('[name="evidence"]').fill("Verified unspent balance");
  await review.locator('button[type="submit"]').click();
  await expect(review).toBeHidden();

  await child.evaluate(() => window.UOS.ProgramApp.navigate("register"));
  await frame.locator('tr[data-register-record="NSA-APP-CARRY-UI"] [data-disclosure-toggle]').click();
  carryDrawer = frame.locator('[data-register-drawer-record="NSA-APP-CARRY-UI"]');
  await expect(carryDrawer.locator('[data-register-carry-forward]')).toHaveCount(0);
  await expect(carryDrawer.locator('[data-register-budget-fy="2027-28"]')).toHaveCount(0);

  await child.evaluate(async () => {
    await window.UOS.ProgramApp.navigate("budget");
    window.UOS.ProgramBudgetUI.openCarryForward("NSA-APP-CARRY-UI");
  });
  const dialog = frame.locator('[data-budget-form="carry"]');
  await expect(dialog).toBeVisible();
  await dialog.locator('[name="amount"]').fill("500");
  await dialog.locator('[name="actor"]').fill("Budget officer");
  await dialog.locator('[name="approver"]').fill("Budget officer");
  await dialog.locator('[name="reason"]').fill("Verified unspent allocation");
  await dialog.locator('[name="evidence"]').fill("Verified unspent balance");
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toBeHidden();

  await child.evaluate(() => window.UOS.ProgramApp.navigate("register"));
  await frame.locator('tr[data-register-record="NSA-APP-CARRY-UI"] [data-disclosure-toggle]').click();
  carryDrawer = frame.locator('[data-register-drawer-record="NSA-APP-CARRY-UI"]');
  const approvedCarry = carryDrawer.locator('[data-register-budget-fy="2027-28"][data-register-carry-forward="approved"]');
  await expect(approvedCarry).toHaveCount(1);
  await expect(approvedCarry.locator('[data-register-allocation-amount]')).toHaveText("$500.00");
  const result = await child.evaluate(() => {
    const ws = window.UOS.ProgramApp.workspace();
    const destination = ws.entities.annualBudgets.find((item) => item.financialYear === "2027-28");
    return {
      approved: window.UOS.ProgramBudget.budgetBalance(ws, destination.id).approved,
      recordAmount: window.UOS.ProgramBudget.recordAmount(ws, "NSA-APP-CARRY-UI"),
      carryEntries: ws.entities.allocationEntries.filter((entry) => entry.kind === "carryForward").length
    };
  });
  expect(result).toEqual({ approved: 500, recordAmount: 700, carryEntries: 1 });
});

test("annual management transfers exact cents as a linked pair", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((frame) => frame !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    const api = window.UOS.ProgramBudget;
    const options = { actor: "Budget officer", approver: "Budget officer", reason: "Transfer test", evidence: "Council transfer file", date: "2026-09-29" };
    await window.UOS.ProgramApp.updateWorkspace((initial) => {
      let ws = initial;
      ws.entities.applications.push(
        { id: "NSA-APP-TRANSFER-A", owner: "NSA", type: "application", title: "Transfer A", receipt: "R-A", status: "received", dateReceived: "2026-09-29" },
        { id: "NSA-APP-TRANSFER-B", owner: "NSA", type: "application", title: "Transfer B", receipt: "R-B", status: "received", dateReceived: "2026-09-29" }
      );
      ws = api.createAnnualBudget(ws, { owner: "NSA", financialYear: "2026-27" });
      const budgetId = ws.entities.annualBudgets[0].id;
      ws = api.approveAnnualBudget(ws, budgetId, { ...options, amount: 500 });
      return api.adjustAllocation(ws, budgetId, "NSA-APP-TRANSFER-A", { ...options, amount: 200 });
    });
    await window.UOS.ProgramApp.navigate("budget");
  });
  const frame = page.frameLocator("iframe");
  await frame.locator('[data-budget-year]').selectOption("2026-27");
  await frame.locator('[data-budget-action="transfer"]').click();
  const form = frame.locator('[data-budget-form="transfer"]');
  await form.locator('[name="registerId"]').selectOption("NSA-APP-TRANSFER-A");
  await form.locator('[name="targetRegisterId"]').selectOption("NSA-APP-TRANSFER-B");
  await form.locator('[name="amount"]').fill("20.01");
  await form.locator('[name="actor"]').fill("Budget officer");
  await form.locator('[name="approver"]').fill("Budget officer");
  await form.locator('[name="reason"]').fill("Move allocation");
  await form.locator('[name="evidence"]').fill("Council transfer file");
  await form.locator('button[type="submit"]').click();
  await expect(form).toBeHidden();
  const result = await child.evaluate(() => {
    const entries = window.UOS.ProgramApp.workspace().entities.allocationEntries.filter((item) => item.transferId);
    return entries.map((item) => ({ amountCents: item.amountCents, referenceNumber: item.referenceNumber, counterpartEntryId: item.counterpartEntryId }));
  });
  expect(result).toHaveLength(2);
  expect(result.map((row) => row.amountCents)).toEqual([-2001, 2001]);
  expect(result.map((row) => row.referenceNumber)).toEqual(["R-A", "R-B"]);
});

test("No year-end review records the answer without a next-year budget or movement", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((frame) => frame !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    const api = window.UOS.ProgramBudget;
    const options = { actor: "Budget officer", approver: "Budget officer", reason: "Close test", evidence: "Year-end file", date: "2027-07-01" };
    await window.UOS.ProgramApp.updateWorkspace((initial) => {
      let ws = initial;
      ws.entities.applications.push({ id: "NSA-APP-NO-CARRY", owner: "NSA", type: "application", title: "No carry", status: "received", dateReceived: "2026-09-29" });
      ws = api.createAnnualBudget(ws, { owner: "NSA", financialYear: "2026-27" });
      const id = ws.entities.annualBudgets[0].id;
      ws = api.approveAnnualBudget(ws, id, { ...options, amount: 100 });
      ws = api.adjustAllocation(ws, id, "NSA-APP-NO-CARRY", { ...options, amount: 100 });
      return api.closeYear(ws, id, options);
    });
    await window.UOS.ProgramApp.navigate("budget");
    window.UOS.ProgramBudgetUI.openCarryForward("NSA-APP-NO-CARRY");
  });
  const frame = page.frameLocator("iframe");
  const review = frame.locator('[data-budget-form="carry-review"]');
  await expect(review).toBeVisible();
  await review.locator('[name="answer"]').selectOption("No");
  await review.locator('[name="actor"]').fill("Budget officer");
  await review.locator('[name="reason"]').fill("No carry required");
  await review.locator('[name="evidence"]').fill("Year-end file");
  await review.locator('button[type="submit"]').click();
  await expect(review).toBeHidden();
  const result = await child.evaluate(() => {
    const ws = window.UOS.ProgramApp.workspace();
    return { answer: ws.entities.budgetCarryReviews.at(-1).answer, carryEntries: ws.entities.allocationEntries.filter((item) => item.kind === "carryForward").length, years: ws.entities.annualBudgets.length };
  });
  expect(result).toEqual({ answer: "No", carryEntries: 0, years: 1 });
});
