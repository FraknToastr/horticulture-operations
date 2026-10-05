const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});

test("Budget form and all eight actions persist through approval, closure and reload", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  let child = page.frames().find((frame) => frame !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((ws) => ws);
    await window.UOS.ProgramApp.navigate("budget");
  });
  let frame = page.frameLocator("iframe");
  await frame.locator('[data-budget-year]').selectOption("2026-27");
  let form = frame.locator('[data-budget-inline-approve]');
  const names = ["amount", "date", "actor", "approver", "reason", "evidence"];
  const values = ["1250.5", "2026-09-23", "Recording officer", "Named authority", "Annual authority", "Council minutes 42"];
  for (let index = 0; index < names.length; index++) await form.locator(`[name="${names[index]}"]`).fill(values[index]);
  const actions = form.locator('[data-budget-persistent-actions] button');
  await expect(actions).toHaveText(["Approve budget", "Allocate", "Reconcile year", "Adjust budget", "Transfer allocation", "Close year", "Record reopen decision", "Apply reopen"]);
  for (let index = 1; index < 8; index++) await expect(actions.nth(index)).toBeDisabled();
  await actions.first().click();
  await expect(form.locator('input[readonly]')).toHaveCount(6);
  await expect(actions.first()).toBeDisabled();
  for (const action of ["allocate", "adjust", "transfer", "close"]) await expect(form.locator(`[data-budget-action="${action}"]`)).toBeEnabled();
  await expect(form.locator('[data-budget-action="reconcile"]')).toBeDisabled();
  await page.reload();
  child = page.frames().find((item) => item !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(() => window.UOS.ProgramApp.navigate("budget"));
  frame = page.frameLocator("iframe");
  await frame.locator('[data-budget-year]').selectOption("2026-27");
  form = frame.locator('[data-budget-inline-approve]');
  for (let index = 0; index < names.length; index++) {
    await expect(form.locator(`[name="${names[index]}"]`)).toHaveValue(values[index]);
    await expect(form.locator(`[name="${names[index]}"]`)).toHaveAttribute("readonly", "");
  }
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((ws) => {
      const budget = ws.entities.annualBudgets.find((item) => item.owner === "NSA" && item.financialYear === "2026-27");
      return window.UOS.ProgramBudget.closeYear(ws, budget.id, { actor: "Recording officer", reason: "Close approved year", evidence: "Year report", date: "2026-09-30" });
    });
  });
  await expect(form.locator('input[readonly]')).toHaveCount(6);
  await expect(form.locator('[data-budget-action="reopen"]')).toBeEnabled();
  for (const action of ["allocate", "adjust", "transfer", "close", "apply-reopen"]) await expect(form.locator(`[data-budget-action="${action}"]`)).toBeDisabled();
  await form.locator('[data-budget-action="reopen"]').click();
  const decision = frame.locator('[data-budget-form="reopen"]');
  for (const [name, value] of Object.entries({ actor: "Recording officer", approver: "Named authority", reason: "Approve reopening", evidence: "Council minutes 43" })) await decision.locator(`[name="${name}"]`).fill(value);
  await decision.locator('button[type="submit"]').click();
  await expect(decision).toBeHidden();
  await expect(form.locator('[data-budget-action="reopen"]')).toBeDisabled();
  await expect(form.locator('[data-budget-action="apply-reopen"]')).toBeEnabled();
  await form.locator('[data-budget-action="apply-reopen"]').click();
  const application = frame.locator('[data-budget-form="apply-reopen"]');
  await application.locator('button[type="submit"]').click();
  await expect(application).toBeHidden();
  await expect(form.locator('[data-budget-action="allocate"]')).toBeEnabled();
  await expect(form.locator('[data-budget-action="apply-reopen"]')).toBeDisabled();
  await expect(form.locator('[name="evidence"]')).toHaveValue("Council minutes 42");
  await page.setViewportSize({ width: 480, height: 720 });
  const row = form.locator('[data-budget-persistent-actions]');
  await expect(row.locator('button')).toHaveCount(8);
  expect(await row.evaluate((node) => ({ overflow: getComputedStyle(node).overflowX, wide: node.scrollWidth > node.clientWidth }))).toEqual({ overflow: "auto", wide: true });
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
  await expect(frame.getByRole("heading", { name: "Annual Budgets" })).toBeVisible();
  await expect(frame.locator(".program-budget__header")).toHaveCount(0);
  await expect(frame.locator(".program-budget__workspace")).toBeVisible();
  const budgetFloor = await frame.locator(".program-budget__workspace").evaluate((node) => ({
    width: getComputedStyle(node).borderBottomWidth,
    top: node.getBoundingClientRect().top,
    bottom: node.getBoundingClientRect().bottom,
    viewport: innerHeight
  }));
  expect(budgetFloor.width).toBe("4px");
  expect(budgetFloor.bottom).toBeLessThanOrEqual(budgetFloor.viewport);
  expect(budgetFloor.bottom).toBeGreaterThanOrEqual(budgetFloor.viewport - 8);
  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: originalViewport.width, height: originalViewport.height - 100 });
  await expect.poll(() => frame.locator(".program-budget__workspace").evaluate((node) => innerHeight - node.getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(0);
  await expect.poll(() => frame.locator(".program-budget__workspace").evaluate((node) => innerHeight - node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(8);
  await page.setViewportSize(originalViewport);
  await expect(frame.locator(".program-budget__approvals")).toBeVisible();
  await expect(frame.locator(".program-budget__metrics")).toBeVisible();
  await expect(frame.locator(".program-budget__metric")).toHaveCount(3);
  await expect(frame.locator('[data-budget-pending]')).toHaveCount(1);
  await expect(frame.locator('[data-budget-allocations]')).toHaveCount(1);
  const recordsLayout = await frame.locator(".program-budget__records").evaluate((records) => {
    const allocations = records.querySelector(".program-budget__allocations");
    const pending = records.querySelector(".program-budget__pending");
    const tableWrap = records.querySelector(".program-budget__table-wrap");
    const pendingList = records.querySelector(".program-budget__history");
    return {
      allocationsHeight: allocations.getBoundingClientRect().height,
      pendingHeight: pending.getBoundingClientRect().height,
      tableOverflow: getComputedStyle(tableWrap).overflowY,
      pendingOverflow: getComputedStyle(pendingList).overflowY,
      allocationColumns: records.querySelectorAll(".program-budget__allocations thead th").length
    };
  });
  expect(recordsLayout).toEqual(expect.objectContaining({ tableOverflow: "auto", pendingOverflow: "auto", allocationColumns: 6 }));
  expect(recordsLayout.allocationsHeight).toBeGreaterThanOrEqual(145);
  expect(recordsLayout.pendingHeight).toBeGreaterThanOrEqual(105);
  const budgetColumns = await frame.locator(".program-budget__workspace").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").map(parseFloat));
  expect(Math.abs(budgetColumns[0] - budgetColumns[1])).toBeLessThanOrEqual(2);
  await expect(frame.locator('[data-budget-header-unallocated]')).toBeVisible();
  const headerOrder = await frame.locator('[data-budget-header-unallocated], [data-program-destination="budget"]').evaluateAll((nodes) => nodes.map((node) => node.hasAttribute("data-budget-header-unallocated") ? "unallocated" : "budget"));
  expect(headerOrder).toEqual(["budget", "unallocated"]);
  const headerGeometry = await frame.locator('[data-program-destination="budget"], [data-budget-header-unallocated]').evaluateAll((nodes) => {
    const budgetButton = nodes.find((node) => node.hasAttribute("data-program-destination"));
    const balanceCard = nodes.find((node) => node.hasAttribute("data-budget-header-unallocated"));
    const buttonRect = budgetButton.getBoundingClientRect();
    const cardRect = balanceCard.getBoundingClientRect();
    return { heightDifference: Math.abs(buttonRect.height - cardRect.height), separation: cardRect.left - buttonRect.right };
  });
  expect(headerGeometry.heightDifference).toBeLessThanOrEqual(1);
  expect(headerGeometry.separation).toBeGreaterThanOrEqual(12);
  await expect(frame.locator('[data-budget-header-year]')).toHaveCount(0);
  expect(await frame.locator('[data-budget-header-amount]').evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(18);
  // Global warning presentation is covered by its dedicated shell test.
  await frame.locator('[data-budget-year]').selectOption("2026-27");
  await expect(frame.locator('[data-budget-action="create"]')).toHaveCount(0);
  const approval = frame.locator('[data-budget-inline-approve]');
  await expect(approval).toBeVisible();
  const approvalLayout = await approval.evaluate((form) => {
    const box = (name) => {
      const rect = form.elements[name].getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width };
    };
    return { amount: box("amount"), date: box("date"), actor: box("actor"), approver: box("approver"), reason: box("reason"), evidence: box("evidence") };
  });
  expect(Math.abs(approvalLayout.amount.y - approvalLayout.date.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(approvalLayout.actor.y - approvalLayout.approver.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(approvalLayout.reason.y - approvalLayout.evidence.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(approvalLayout.amount.width - approvalLayout.date.width)).toBeLessThanOrEqual(2);
  await expect(frame.locator('[data-budget-action="approve"]')).toHaveCount(0);
  await expect(frame.locator('[data-budget-history]')).toHaveCount(0);
  await expect(frame.locator('[data-budget-year-state]')).not.toContainText("Manage annual budget");
  await expect(frame.locator('.program-budget__status')).toHaveCount(0);
  await approval.locator('[name="amount"]').fill("1000");
  await frame.locator('[data-budget-year]').selectOption("2027-28");
  await frame.locator('[data-budget-year]').selectOption("2026-27");
  await expect(frame.locator('[data-budget-inline-approve] [name="amount"]')).toHaveValue("1000");
  await approval.locator('[name="actor"]').fill("Budget officer");
  await approval.locator('[name="approver"]').fill("Budget officer");
  await approval.locator('[name="reason"]').fill("Annual approval");
  await approval.locator('[name="evidence"]').fill("Council approval record");
  await approval.locator('button[type="submit"]').click();
  await expect(frame.locator('[data-budget-inline-approve]')).toBeVisible();
  await expect(approval.locator('input[readonly]')).toHaveCount(6);
  await expect(approval.locator('button[type="submit"]')).toBeDisabled();
  await expect(frame.locator('.program-budget__status')).toHaveAttribute("data-state", "open");
  await expect(frame.locator('[data-budget-header-amount]')).toHaveText("$1,000.00");
  await expect(frame.locator('.program-budget__approval-details')).toHaveCount(0);
  await expect(approval).toBeVisible();
  await child.evaluate(() => window.UOS.ProgramApp.navigate("register"));
  await expect(frame.locator('[data-program-view="register"]')).toBeVisible();
  await expect(frame.locator('[data-budget-header-unallocated]')).toBeVisible();
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
  await expect(projectBudget.locator('[data-register-action="allocate-budget"]')).toHaveText("Allocate");
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
  await expect(projectBudget.locator('[data-register-action="allocate-budget"]')).toHaveText("Adjust");
  for (const amount of [-600, 600]) {
    await child.evaluate(async amount => {
      await window.UOS.ProgramApp.updateWorkspace(ws => {
        const allocation = ws.entities.registerAllocations.find(item => item.registerId === 'NSA-APP-BUDGET-UI');
        return window.UOS.ProgramBudget.adjustAllocation(ws, allocation.budgetId, allocation.registerId, {
          amount, actor: 'Budget officer', approver: 'Budget authority', date: '2026-10-01', reason: 'Verify allocation label', evidence: 'Approved adjustment', financialYear: '2026-27'
        });
      });
    }, amount);
    await expect(projectBudget.locator('[data-register-action="allocate-budget"]')).toHaveText(amount < 0 ? 'Allocate' : 'Adjust');
  }

  await expect(frame.locator('[data-budget-header-amount]')).toHaveText("$400.00");
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
  await expect(frame.locator('[data-budget-history]')).toHaveCount(0);
  await expect(frame.locator('.program-budget__approval-details')).toHaveCount(0);
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
      headerText: "Financial YearAllocated",
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
  await expect(projectGroup.locator("[data-register-allocation-header]")).toHaveText("Financial YearAllocated");
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
