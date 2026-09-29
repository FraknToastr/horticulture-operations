const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});

test("targeted Cost Calculator UI corrections preserve filtering and automatic Add", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    const record = {
      id: "NSA-APP-COST-TARGETED",
      owner: "NSA",
      type: "application",
      receipt: "COST-TARGETED",
      title: "Cost Calculator targeted UI test",
      status: "received",
      dateReceived: "2026-09-22",
      provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "COST-TARGETED", importedAt: "2026-09-22T00:00:00.000Z" }
    };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      workspace.workspace.selectedEntityId = record.id;
      return window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id).workspace;
    });
  });
  const frame = page.frameLocator("iframe");
  await frame.locator('[data-program-destination="costing"]').click();
  const table = frame.locator(".program-cost-table");
  await expect(table).toBeVisible();
  await frame.locator('[data-program-view="costing"]').screenshot({ path: "test-results/cost-calculator-targeted-ui.png" });
  await expect(frame.locator("#costing-title")).toHaveText("Assigned Rate Items");
  await expect(frame.locator(".program-costing-catalog-current")).toHaveCount(0);
  await expect(frame.locator("[data-costing-tools]")).toBeHidden();
  await expect(frame.locator("[data-costing-add-item]")).toBeHidden();
  await expect(frame.locator("[data-costing-export]")).toBeHidden();
  await frame.locator("[data-costing-tools-toggle]").click();
  await expect(frame.locator("[data-costing-search]")).toBeVisible();
  await expect(frame.locator("[data-costing-category]")).toBeVisible();
  await expect(frame.locator("[data-costing-add-item]")).toBeVisible();
  await expect(frame.locator("[data-costing-export]")).toBeVisible();
  await expect(frame.locator("[data-costing-add-item]")).toHaveText("Add rate");
  await expect(frame.locator("[data-costing-export]")).toHaveText("Export Rate Library");
  await expect(frame.locator(".program-cost-controls__actions")).toBeVisible();
  await expect.poll(() => frame.locator(".program-cost-catalog").evaluate((node) => getComputedStyle(node).borderRightWidth)).toBe("4px");

  for (const section of ["Labour", "Equipment", "Material", "Contractors", "Sundry"]) {
    await frame.locator(`[data-costing-section="${section}"]`).click();
    await expect(table.locator("tbody tr")).not.toHaveCount(0);
    const row = table.locator("tbody tr").first();
    await expect(row.locator("[data-costing-add-rate]")).toBeVisible();
    await expect(row.locator("[data-costing-edit-rate]")).toBeVisible();
    await expect(row.locator("[data-costing-delete-rate]")).toBeVisible();
    const labels = await row.locator(".program-category-pill, .program-rate-state").evaluateAll((items) => items.map((item) => ({ text: item.textContent, overflow: getComputedStyle(item).textOverflow, tooltip: item.getAttribute("data-uos-tooltip"), name: item.getAttribute("aria-label") })));
    for (const item of labels) {
      expect(item.overflow).toBe("clip");
      expect(item.tooltip).toBeTruthy();
      expect(item.name).toBeTruthy();
      if (item.text.endsWith("...")) expect(item.tooltip.startsWith(item.text.slice(0, -3))).toBe(true);
    }
    const description = row.locator("td").nth(1).locator("strong");
    await expect(description).toHaveAttribute("data-uos-tooltip");
    await description.focus();
    await expect(description).toHaveAttribute("aria-label");
    const actionFits = await row.locator(".program-rate-actions").evaluate((actions) => {
      const cell = actions.closest("td");
      const actionRect = actions.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      return actionRect.left >= cellRect.left && actionRect.right <= cellRect.right;
    });
    expect(actionFits).toBe(true);
    await expect(row.locator("[data-costing-add-rate], [data-costing-edit-rate], [data-costing-delete-rate]").first()).toHaveAttribute("data-uos-tooltip");
  }

  await frame.locator('[data-costing-section="Labour"]').click();
  await frame.locator("[data-costing-search]").fill("Horticulture");
  await expect(table.locator("tbody tr")).not.toHaveCount(0);
  await frame.locator("[data-costing-search]").fill("");
  await frame.locator("[data-costing-category]").selectOption({ index: 1 });
  await expect(table.locator("tbody tr")).not.toHaveCount(0);
  await frame.locator("[data-costing-category]").selectOption("all");
  const before = await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length);
  await table.locator('[data-costing-add-rate]:not([disabled])').first().click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(before + 1);
  await expect(frame.locator("[data-costing-error]")).toBeHidden();
});
