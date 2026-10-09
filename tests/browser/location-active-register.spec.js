const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});


[
  { page: "nsa.html", owner: "NSA" },
  { page: "events.html", owner: "EVT" }
].forEach(({ page: entryPage, owner }) => {
  test(`${owner} manual Register creation opens Location tools for the active record without a Project`, async ({ page }) => {
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
    expect(await child.evaluate(()=>UOS.ProgramMapController.canonicalMapState(UOS.ProgramApp.workspace()).selectedRegisterId)).toBe(activeId);
    await expect(frame.locator('[data-space-panel="location"]')).toBeVisible();
    await expect(frame.locator('[data-space-pin]')).toHaveCount(0);
    await expect(frame.locator('#eventPickerList')).toContainText('No pins');
    await expect(frame.locator('#eventPickerList .program-status-pill,[data-event-card-id]')).toHaveCount(0);
    await frame.locator('#spaceRadialToggle').click();
    await expect(frame.locator('[data-space-create="location"]')).toBeEnabled();
    for(const kind of ['polygon','line','square'])await expect(frame.locator('[data-space-create="'+kind+'"]')).toBeDisabled();
    await frame.locator('[data-space-create="location"]').click();
    await expect(frame.locator('#spaceDraftActions')).toBeVisible();
    await frame.locator('#spaceCancelDraft').click();
    expect(await child.evaluate(()=>UOS.ProgramMapController.canonicalMapState(UOS.ProgramApp.workspace()).selectedRegisterId)).toBe(activeId);

  });
});
