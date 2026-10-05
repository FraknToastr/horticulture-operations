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
  return { trigger, dialog, drawer, child };
}

test("Governed Lifecycle closes with Escape and restores trigger focus", async ({ page }) => {
  const { trigger, dialog, drawer, child } = await openLifecycle(page);
  const snapshot = () => ({
    module: document.querySelector("[data-program-destination][aria-current='page']").getAttribute("data-program-destination"),
    drawer: document.querySelector("[data-register-drawer-record='NSA-APP-LIFECYCLE-CLOSE']").getAttribute("data-register-drawer-record"),
    scroll: Array.from(document.querySelectorAll(".program-register-drawer, .program-table-scroll")).map((element) => [element.scrollTop, element.scrollLeft]),
    pageScroll: [window.scrollX, window.scrollY]
  });
  const before = await child.evaluate(snapshot);
  await dialog.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(drawer).toBeVisible();
  expect(before.module).toBe("register");
  expect(await child.evaluate(snapshot)).toEqual(before);
});

test("Escape dismisses only the newest native or shared modal and preserves the background drawer", async ({ page }) => {
  const { dialog, drawer, child } = await openLifecycle(page);
  await child.evaluate(() => {
    const native = document.querySelector("[data-status-lifecycle-dialog]");
    const button = document.createElement("button");
    button.id = "nested-modal-opener";
    button.textContent = "Nested modal";
    native.appendChild(button);
    button.focus();
    const nested = document.createElement("dialog");
    nested.id = "nested-native-modal";
    nested.innerHTML = "<button>Inner action</button>";
    document.body.appendChild(nested);
    nested.showModal();
  });
  const frame = page.frameLocator("iframe");
  await frame.locator("#nested-native-modal").press("Escape");
  await expect(frame.locator("#nested-native-modal")).not.toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(frame.locator("#nested-modal-opener")).toBeFocused();
  await expect(drawer).toBeVisible();
  await dialog.press("Escape");
  await child.evaluate(() => {
    const node = document.createElement("button");
    node.id = "shared-modal-opener";
    node.textContent = "Open another";
    window.UOS.dialogs.open({ title: "First shared modal", node });
    node.focus();
    window.UOS.dialogs.open({ title: "Second shared modal", message: "Topmost" });
  });
  const modals = frame.locator(".uos-modal-backdrop");
  await expect(modals).toHaveCount(2);
  await modals.last().press("Escape");
  await expect(modals).toHaveCount(1);
  await expect(frame.locator("#shared-modal-opener")).toBeFocused();
  await expect(frame.locator("body")).toHaveClass(/uos-modal-open/);
  await expect(drawer).toBeVisible();
  await modals.last().press("Escape");
  await expect(modals).toHaveCount(0);
  await expect(frame.locator("body")).not.toHaveClass(/uos-modal-open/);
  await expect(drawer).toBeVisible();
});

test("Governed Lifecycle Close button dismisses and restores trigger focus", async ({ page }) => {
  const { trigger, dialog } = await openLifecycle(page);
  await dialog.locator("footer [data-status-lifecycle-close]").click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
