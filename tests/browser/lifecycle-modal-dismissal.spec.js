const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});


async function openLifecycle(page) {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.workspace());
  const frame = page.frameLocator("iframe");
  await frame.locator('[data-program-destination="register"]').click();
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((ws) => {
      ws.entities.applications.push({
        id: "NSA-APP-LIFECYCLE-CLOSE", owner: "NSA", type: "application", receipt: "LCLOSE",
        title: "Lifecycle close test", status: "received", dateReceived: "2026-07-03", provenance: {}
      });
      return ws;
    });
    await window.UOS.ProgramApp.navigate("register");
  });
  const row = frame.locator('[data-register-record="NSA-APP-LIFECYCLE-CLOSE"]');
  await row.locator("[data-disclosure-toggle]").click();
  const drawer = frame.locator('[data-register-drawer-record="NSA-APP-LIFECYCLE-CLOSE"]');
  const trigger = drawer.locator('[data-status-lifecycle-open="NSA-APP-LIFECYCLE-CLOSE"]');
  const dialog = frame.locator("[data-status-lifecycle-dialog]");
  await trigger.click();
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

test("Governed Lifecycle closes with Escape and restores trigger focus", async ({ page }) => {
  const { trigger, dialog } = await openLifecycle(page);
  await dialog.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("Governed Lifecycle Close button dismisses and restores trigger focus", async ({ page }) => {
  const { trigger, dialog } = await openLifecycle(page);
  await dialog.locator("footer [data-status-lifecycle-close]").click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
