const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});


test("Cost Library gives Description a readable dominant column and adds rates from every section", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const frame = page.frameLocator("iframe");

  await child.evaluate(async () => {
    const record = {
      id: "NSA-APP-COST-LAYOUT",
      owner: "NSA",
      type: "application",
      receipt: "COST-LAYOUT",
      title: "Cost Library layout test",
      status: "received",
      dateReceived: "2026-09-13",
      provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "COST-LAYOUT", importedAt: "2026-09-13T00:00:00.000Z" }
    };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      workspace.workspace.selectedEntityId = record.id;
      return window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id).workspace;
    });
  });

 await frame.locator('[data-program-destination="costing"]').click();
 await frame.locator('[data-costing-tools-toggle]').click();
  await frame.locator('[data-program-view="costing"]').screenshot({ path: "Offline/H2 Evidence/h2-cost-library-after.png" });
  const table = frame.locator(".program-cost-table");
  await expect(table).toBeVisible();
  const libraryLayout = await child.evaluate(() => {
    const pane = document.querySelector(".program-cost-catalog");
    const wrap = document.querySelector(".program-cost-table-wrap");
    const actions = document.querySelector(".program-rate-actions");
    const rect = (node) => { const value = node.getBoundingClientRect(); return { left: value.left, right: value.right, width: value.width }; };
    return { pane: rect(pane), wrap: { ...rect(wrap), scrollWidth: wrap.scrollWidth, clientWidth: wrap.clientWidth }, actions: rect(actions) };
  });
  expect(libraryLayout.wrap.scrollWidth).toBeLessThanOrEqual(libraryLayout.wrap.clientWidth + 1);
  expect(libraryLayout.actions.left).toBeGreaterThanOrEqual(libraryLayout.pane.left);
  expect(libraryLayout.actions.right).toBeLessThanOrEqual(libraryLayout.pane.right + 1);
  await expect(frame.locator("[data-costing-search]")).toBeVisible();
  await expect(frame.locator("[data-costing-category]")).toBeVisible();
  await expect(frame.locator('[data-costing-add-item]')).toBeVisible();
 await expect(frame.locator('[data-costing-export]')).toBeVisible();
 await frame.locator('[data-costing-tools-toggle]').click();
  await expect(frame.locator("[data-program-persistence]")).toHaveText("Saved");
  await page.waitForTimeout(750);
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);
  const registerShortcut = frame.locator('[data-costing-mini-toolbar] button[data-costing-toolbar-jump="register"]');
  await expect(registerShortcut).toBeEnabled();
  await expect(registerShortcut).toHaveClass(/program-register-action--linked/);
  await expect(registerShortcut).toHaveAttribute("data-linked-entity", "true");

  for (const [index, section] of ["Labour", "Equipment", "Material", "Contractors", "Sundry"].entries()) {
    await frame.locator(`[data-costing-section="${section}"]`).click();
    await expect(table).toBeVisible();
    await expect(table.locator("tbody tr")).not.toHaveCount(0);
    const widths = await table.locator("thead tr").evaluate((row) => Array.from(row.cells).map((cell) => cell.getBoundingClientRect().width));
    // Category pills now have enough space for full labels; Description should
    // remain the larger text column without assuming the old narrow category.
    expect(widths[1]).toBeGreaterThan(widths[0]);
    expect(widths[1]).toBeGreaterThan(widths[3] * 2.75);
    const add = table.locator('[data-costing-add-rate]:not([disabled])').first();
    await expect(add).toBeEnabled();
    const addFitsActionCell = await add.evaluate((button) => {
      const cell = button.closest("td");
      const actions = button.closest(".program-rate-actions");
      if (!cell || !actions) return false;
      const cellRect = cell.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      return actionsRect.left >= cellRect.left && actionsRect.right <= cellRect.right;
    });
    expect(addFitsActionCell).toBe(true);
    await add.click();
    await expect(frame.locator("[data-costing-error]")).toBeHidden();
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(index + 1);
    await expect.poll(async () => frame.locator('[data-costing-lines] [data-costing-line-quantity]').count()).toBe(index + 1);
  }
});
