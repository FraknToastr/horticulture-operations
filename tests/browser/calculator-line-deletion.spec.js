const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});

test("RC-DEL-01: Resource Calculator line deletion removes row from DOM, updates totals, and syncs canonical workspace", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const frame = page.frameLocator("iframe");

  // Create a Delivery Project
  await child.evaluate(async () => {
    const record = {
      id: "NSA-APP-RC-DEL-01",
      owner: "NSA",
      type: "application",
      receipt: "RC-DEL-01",
      title: "Line Deletion Project",
      status: "received",
      dateReceived: "2026-09-18",
      provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "RC-DEL-01", importedAt: "2026-09-18T00:00:00.000Z" }
    };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      workspace.workspace.selectedEntityId = record.id;
      return window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id).workspace;
    });
  });

  // Navigate to Costing
  await frame.locator('[data-program-destination="costing"]').click();
  await expect(frame.locator(".program-cost-table")).toBeVisible();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);

  // Add one active rate item
  const addButton = frame.locator('[data-costing-add-rate]:not([disabled])').first();
  await expect(addButton).toBeEnabled();
  await addButton.click();

  // Verify line appears in table and workspace
  const lineRows = frame.locator('[data-costing-lines] tr:not(.program-costing-line-group)');
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(1);
  await expect(lineRows).toHaveCount(1);

  // Subtotal should not be $0.00
  await expect(frame.locator('[data-costing-total="subtotal"]')).not.toHaveText("$0.00");
  await expect(frame.locator('[data-costing-error]')).toBeHidden();

  // Retrieve line ID
  const lineId = await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines[0].id);
  expect(lineId).toBeTruthy();

  // Click Remove
  const removeButton = frame.locator(`[data-costing-remove="${lineId}"]`);
  await expect(removeButton).toBeVisible();
  await removeButton.click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Delete item', exact: true }).click();

  // Row should disappear from DOM immediately
  await expect(lineRows).toHaveCount(0);
  await expect(frame.locator('[data-costing-lines-empty]')).toBeVisible();

  // Canonical workspace must not contain the deleted line
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(0);

  // Subtotal and grand total must update to $0.00
  await expect(frame.locator('[data-costing-total="subtotal"]')).toHaveText("$0.00");
  await expect(frame.locator('[data-costing-total="grand"]')).toHaveText("$0.00");

  // No error toast or error alert
  await expect(frame.locator('[data-costing-error]')).toBeHidden();
});

test("RC-DEL-02: Add line, edit quantity/rate, then remove: row disappears cleanly without stale recreate", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const frame = page.frameLocator("iframe");

  await child.evaluate(async () => {
    const record = {
      id: "NSA-APP-RC-DEL-02",
      owner: "NSA",
      type: "application",
      receipt: "RC-DEL-02",
      title: "Edit-Delete Project",
      status: "received",
      dateReceived: "2026-09-18",
      provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "RC-DEL-02", importedAt: "2026-09-18T00:00:00.000Z" }
    };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      workspace.workspace.selectedEntityId = record.id;
      return window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id).workspace;
    });
  });

  await frame.locator('[data-program-destination="costing"]').click();
  await expect(frame.locator(".program-cost-table")).toBeVisible();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);

  // Add line
  const addButton = frame.locator('[data-costing-add-rate]:not([disabled])').first();
  await addButton.click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(1);
  await child.evaluate(() => window.UOS.ProgramCostingController.update(window.UOS.ProgramApp.workspace()));

  const lineRows = frame.locator('[data-costing-lines] tr:not(.program-costing-line-group)');
  await expect(lineRows).toHaveCount(1);
  const lineId = await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines[0].id);

  // Edit quantity input
  const qtyInput = frame.locator(`[data-costing-line-quantity="${lineId}"]`);
  await qtyInput.fill("5");
  await qtyInput.dispatchEvent("change");

  await expect.poll(() => child.evaluate((id) => {
    const l = window.UOS.ProgramApp.workspace().entities.costingLines.find((item) => item.id === id);
    return l ? Number(l.quantity) : 0;
  }, lineId)).toBe(5);

  // Now delete the edited line
  const removeButton = frame.locator(`[data-costing-remove="${lineId}"]`);
  await removeButton.click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Delete item', exact: true }).click();

  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(0);
  await child.evaluate(() => window.UOS.ProgramCostingController.update(window.UOS.ProgramApp.workspace()));
  await expect(lineRows).toHaveCount(0);
  await expect(frame.locator('[data-costing-error]')).toBeHidden();
  await expect(frame.locator('[data-costing-total="subtotal"]')).toHaveText("$0.00");
});

test("RC-DEL-04: Add two different Rate Items, remove one: only target line is deleted", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const frame = page.frameLocator("iframe");

  await child.evaluate(async () => {
    const record = {
      id: "NSA-APP-RC-DEL-04",
      owner: "NSA",
      type: "application",
      receipt: "RC-DEL-04",
      title: "Multi Line Project",
      status: "received",
      dateReceived: "2026-09-18",
      provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "RC-DEL-04", importedAt: "2026-09-18T00:00:00.000Z" }
    };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      workspace.workspace.selectedEntityId = record.id;
      return window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id).workspace;
    });
  });

  await frame.locator('[data-program-destination="costing"]').click();
  await expect(frame.locator(".program-cost-table")).toBeVisible();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);

  // Add first rate item from Labour
  const firstAdd = frame.locator('[data-costing-add-rate]:not([disabled])').first();
  await firstAdd.click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(1);

  // Switch to Equipment section and add second rate item
  await frame.locator('[data-costing-section="Equipment"]').click();
  const secondAdd = frame.locator('[data-costing-add-rate]:not([disabled])').first();
  await secondAdd.click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(2);
  await child.evaluate(() => window.UOS.ProgramCostingController.update(window.UOS.ProgramApp.workspace()));

  const lineRows = frame.locator('[data-costing-lines] tr:not(.program-costing-line-group)');
  await expect(lineRows).toHaveCount(2);

  const [firstId, secondId] = await child.evaluate(() => [
    window.UOS.ProgramApp.workspace().entities.costingLines[0].id,
    window.UOS.ProgramApp.workspace().entities.costingLines[1].id
  ]);

  // Remove only the first line
  const removeFirst = frame.locator(`[data-costing-remove="${firstId}"]`);
  await removeFirst.click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Delete item', exact: true }).click();

  // Exactly 1 line row should remain
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(1);
  await child.evaluate(() => window.UOS.ProgramCostingController.update(window.UOS.ProgramApp.workspace()));
  await expect(lineRows).toHaveCount(1);

  // The remaining line in workspace must be secondId
  const remainingId = await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines[0].id);
  expect(remainingId).toBe(secondId);

  // The second remove button should still be in DOM
  await expect(frame.locator(`[data-costing-remove="${secondId}"]`)).toBeVisible();
  await expect(frame.locator('[data-costing-error]')).toBeHidden();
});

test("RC-DEL-05: EVT mode Resource Calculator line creation and deletion parity", async ({ page }) => {
  await page.goto("/src/program-planner/events.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const frame = page.frameLocator("iframe");

  await child.evaluate(async () => {
    const record = {
      id: "EVT-RC-DEL-05",
      owner: "EVT",
      type: "event",
      receipt: "RC-DEL-EVT",
      title: "EVT Deletion Event",
      status: "received",
      dateReceived: "2026-09-18",
      provenance: { owner: "EVT", sourceApp: "test", sourceVersion: 5, sourceId: "RC-DEL-EVT", importedAt: "2026-09-18T00:00:00.000Z" }
    };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.events.push(record);
      workspace.workspace.selectedEntityId = record.id;
      return window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id).workspace;
    });
  });

  await frame.locator('[data-program-destination="costing"]').click();
  await expect(frame.locator(".program-cost-table")).toBeVisible();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);

  const addBtn = frame.locator('[data-costing-add-rate]:not([disabled])').first();
  await addBtn.click();

  const lineRows = frame.locator('[data-costing-lines] tr:not(.program-costing-line-group)');
  await expect(lineRows).toHaveCount(1);

  const lineId = await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines[0].id);
  const removeBtn = frame.locator(`[data-costing-remove="${lineId}"]`);
  await removeBtn.click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Delete item', exact: true }).click();

  await expect(lineRows).toHaveCount(0);
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(0);
  await expect(frame.locator('[data-costing-error]')).toBeHidden();
});
