const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

for (const owner of ["NSA", "EVT"]) {
  test(`${owner} Register guide lists only its application statuses and restores keyboard focus`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.goto(`/src/program-planner/${owner === "EVT" ? "events" : "nsa"}.html`);
    const child = page.frames().find((candidate) => candidate !== page.mainFrame());
    await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.workspace());
    const frame = page.frameLocator("iframe");
    await frame.locator('[data-program-destination="register"]').click();
    const expected = await child.evaluate((moduleOwner) => {
      const domain = moduleOwner === "EVT" ? "register_evt" : "register_nsa";
      return {
        statuses: window.UOS.ProgramStatus.registerGuide(domain).statuses.map(({ code, label }) => ({ code, label })),
        revision: window.UOS.ProgramApp.workspace().workspaceRevision
      };
    }, owner);
    const trigger = frame.locator("[data-status-guide-open]");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await trigger.focus();
    await trigger.press("Enter");
    const dialog = frame.getByRole("dialog", { name: `${owner} Register status guide` });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("[data-status-guide-title]")).toBeFocused();
    await expect(dialog.locator("[data-status-guide-code]")).toHaveCount(expected.statuses.length);
    expect(await dialog.locator("[data-status-guide-code]").evaluateAll((nodes) => nodes.map((node) => ({ code: node.dataset.statusGuideCode, label: node.querySelector("h3").textContent })))).toEqual(expected.statuses);
    await expect(dialog).toContainText("cannot be selected manually");
    await expect(dialog).toContainText("requires a recorded reason");
    await expect(dialog).toContainText("resuming automation does not replay missed signals");
    await expect(frame.locator("[data-status-operator-dialog]")).not.toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.press("Space");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(trigger).toBeFocused();
    expect(await child.evaluate(() => window.UOS.ProgramApp.workspace().workspaceRevision)).toBe(expected.revision);
  });
}
