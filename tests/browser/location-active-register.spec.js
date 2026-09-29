const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});


[
  { page: "nsa.html", owner: "NSA" },
  { page: "events.html", owner: "EVT" }
].forEach(({ page: entryPage, owner }) => {
  test(`${owner} manual Register creation exposes one permanent full Location card`, async ({ page }) => {
    await page.goto(`/src/program-planner/${entryPage}`);
    const child = page.frames().find((candidate) => candidate !== page.mainFrame());
    await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
    const frame = page.frameLocator("iframe");

    await frame.locator("[data-register-add-record]").click();
    await child.waitForFunction(() => Boolean(window.UOS.ProgramApp.workspace().workspace.selectedEntityId));
    const firstId = await child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.selectedEntityId);
    await frame.locator("[data-register-add-record]").click();
    await child.waitForFunction((previousId) => window.UOS.ProgramApp.workspace().workspace.selectedEntityId !== previousId, firstId);
    const activeId = await child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.selectedEntityId);
    expect(activeId).toBeTruthy();
    expect(activeId).not.toBe(firstId);
    await expect.poll(() => child.evaluate(() => {
      const ui = window.UOS.ProgramApp.workspace().workspace;
      return { destination: ui.destination, projectId: ui.selectedProjectId, plannerProjectId: ui.planner && ui.planner.selectedProjectId };
    })).toEqual({ destination: "register", projectId: "", plannerProjectId: "" });
    expect(await child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.map.selectedRegisterId)).toBe(activeId);

    await frame.locator(`[data-register-action="map"][data-register-record="${activeId}"]`).click();
    await expect(frame.locator('body')).toHaveAttribute('data-drawer-module', 'map');
    const cards = frame.locator("#eventPickerList > [data-event-card-id]");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toHaveAttribute("data-event-card-id", activeId);
    await expect(cards.first()).toHaveAttribute("data-disclosure-skip", "");
    await expect(cards.first().locator('[data-location-action="add"]')).toHaveCSS("display", "flex");
    await expect(cards.first().locator(".program-status-pill")).toHaveCount(0);
    await expect(cards.first().locator('[data-location-action="move"]')).toHaveCount(0);
    await expect(frame.locator("#eventPickerList [data-disclosure-toggle]")).toHaveCount(0);
    await expect(frame.locator("#eventPickerList [data-disclosure-drawer]")).toHaveCount(0);
    await expect(frame.locator(`#eventPickerList [data-event-card-id="${firstId}"]`)).toHaveCount(0);
  });
});
