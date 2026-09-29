const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});


async function addA3330(page) {
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.workspace());
  const frame = page.frameLocator("iframe");
  await frame.locator('[data-program-destination="register"]').click();
  await expect(frame.locator('[data-program-view="register"]')).toBeVisible();
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((ws) => {
      ws.entities.applications.push({
        id: "NSA-APP-A3330",
        owner: "NSA",
        type: "application",
        receipt: "A3330",
        title: "Receipt A3330",
        status: "received",
        dateReceived: "2026-07-03",
        createdAt: "2026-07-03T00:00:00.000Z",
        updatedAt: "2026-07-03T00:00:00.000Z",
        provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "A3330", importedAt: "2026-07-03T00:00:00.000Z" }
      });
      ws.entities.statusEvents.push({
        id: "NSA-SEVT-A3330-RECEIVED",
        owner: "NSA",
        type: "statusEvent",
        entityId: "NSA-APP-A3330",
        entityType: "application",
        domain: "register_nsa",
        fromStatus: null,
        toStatus: "received",
        action: "Initial status established",
        reason: "",
        actor: "Status engine",
        timestamp: "2026-07-03T00:00:00.000Z",
        source: "automatic",
        provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "A3330-received", importedAt: "2026-07-03T00:00:00.000Z" }
      });
      return ws;
    });
    await window.UOS.ProgramApp.navigate("register");
  });
  await expect(frame.locator('[data-program-view="register"]')).toBeVisible();
  await frame.locator('[data-filter-drawer="register"] [data-filter-drawer-toggle]').click();
  await frame.locator("[data-register-search]").fill("A3330");
  const row = frame.locator('[data-register-record="NSA-APP-A3330"]');
  await row.locator("[data-disclosure-toggle]").click();
  const drawer = frame.locator('[data-register-drawer-record="NSA-APP-A3330"]');
  await expect(drawer).toBeVisible();
  return { child, frame, drawer };
}

test("A3330 drawer keeps canonical Received history and removes legacy status inputs", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const { frame, drawer } = await addA3330(page);
  const historyPanel = drawer.locator("[data-register-status-history-panel]");
  const trigger = historyPanel.locator('[data-status-lifecycle-open="NSA-APP-A3330"]');
  await expect(historyPanel).toBeVisible();
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveText("Review");
  await expect(drawer.locator('[data-status-lifecycle-open="NSA-APP-A3330"]')).toHaveCount(1);
  await expect(drawer.locator("[data-status-controls-for]")).toHaveCount(0);
  await expect(drawer.locator(".program-register-status-history")).toBeVisible();
  await expect(drawer.locator("[data-register-status-history-list]")).toBeVisible();
  await expect(drawer.locator("[data-register-status-history-list]")).toContainText("Received");
  await trigger.click();
  const dialog = frame.locator("[data-status-lifecycle-dialog]");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-status-controls-for="NSA-APP-A3330"] .program-status-current')).toHaveText("Received");
  await expect(dialog.locator(".program-status-events")).toContainText("Received");
  await page.waitForTimeout(100);
  await expect(dialog.locator(".program-status-current")).toHaveText("Received");
  await expect(drawer.locator('[data-register-edit-key="status"]')).toBeHidden();
  await expect(drawer.locator('[data-register-edit-key="statusDate"]')).toBeHidden();
  await expect(drawer.locator('[data-register-action="add-status-history"]')).toBeHidden();
});

test("clicking Cancel closes first-use operator modal without a status mutation", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const { child, frame, drawer } = await addA3330(page);
  await drawer.locator('[data-status-lifecycle-open="NSA-APP-A3330"]').click();
  const lifecycle = frame.locator("[data-status-lifecycle-dialog]");
  const command = lifecycle.locator('[data-status-command="cancelled"]');
  const before = await child.evaluate(() => {
    const ws = window.UOS.ProgramApp.workspace();
    return { revision: ws.workspaceRevision, events: ws.entities.statusEvents.length, status: ws.entities.applications.find((item) => item.id === "NSA-APP-A3330").status };
  });
  await command.click();
  const dialog = frame.locator("[data-status-operator-dialog]");
  await expect(dialog).toBeVisible();
  await dialog.locator("[data-status-cancel]").click();
  await expect(dialog).not.toBeVisible();
  await expect(lifecycle).toBeVisible();
  await expect(command).toBeFocused();
  const after = await child.evaluate(() => {
    const ws = window.UOS.ProgramApp.workspace();
    return { revision: ws.workspaceRevision, events: ws.entities.statusEvents.length, status: ws.entities.applications.find((item) => item.id === "NSA-APP-A3330").status };
  });
  expect(after).toEqual(before);
});

test("clicking Cancel closes transition modal without a status mutation", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const { child, frame, drawer } = await addA3330(page);
  await child.evaluate(() => sessionStorage.setItem("uos.program.statusOperator", "Regression Officer"));
  await drawer.locator('[data-status-lifecycle-open="NSA-APP-A3330"]').click();
  const lifecycle = frame.locator("[data-status-lifecycle-dialog]");
  const command = lifecycle.locator('[data-status-command="cancelled"]');
  const before = await child.evaluate(() => {
    const ws = window.UOS.ProgramApp.workspace();
    return { revision: ws.workspaceRevision, events: ws.entities.statusEvents.length, status: ws.entities.applications.find((item) => item.id === "NSA-APP-A3330").status };
  });
  await command.click();
  const dialog = frame.locator("[data-status-confirm-dialog]");
  await expect(dialog).toBeVisible();
  await dialog.locator("[data-status-cancel]").click();
  await expect(dialog).not.toBeVisible();
  await expect(lifecycle).toBeVisible();
  await expect(command).toBeFocused();
  const after = await child.evaluate(() => {
    const ws = window.UOS.ProgramApp.workspace();
    return { revision: ws.workspaceRevision, events: ws.entities.statusEvents.length, status: ws.entities.applications.find((item) => item.id === "NSA-APP-A3330").status };
  });
  expect(after).toEqual(before);
});
