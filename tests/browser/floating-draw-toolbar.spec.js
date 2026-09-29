const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
});

test("floating drawing toolbar exposes stateful controls and remains within the map", async ({ page }) => {
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push({ id: "NSA-APP-DRAW-TOOLS", owner: "NSA", type: "application", receipt: "DRAW-TOOLS", title: "Draw tools test", status: "received", dateReceived: "2026-09-23", provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "DRAW-TOOLS", importedAt: "2026-09-23T00:00:00.000Z" } });
      workspace.workspace.selectedEntityId = "NSA-APP-DRAW-TOOLS";
      return workspace;
    });
  });
  const frame = page.frameLocator("iframe");
  await frame.locator('[data-program-destination="map"]').click();
  await expect(frame.locator('[data-program-view="map"]')).toBeVisible();

  const addPin = frame.locator('[data-location-action="add"][data-location-event-id="NSA-APP-DRAW-TOOLS"]');
  await expect(addPin).toBeVisible();
  await addPin.click();
  await expect.poll(() => frame.locator("#eventMap canvas").evaluate((canvas) => canvas.style.cursor)).toBe("crosshair");
  await frame.locator("#selectToolButton").click();

  const toolbar = frame.locator("#floatingDrawToolbar");
  const handle = toolbar.locator(".program-map-floating-draw-toolbar__handle");
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator('[data-draw-mode="polygon"]')).toHaveAttribute("aria-pressed", "true");
  await expect(toolbar.locator("#finishDrawingButton")).toBeDisabled();
  await expect(toolbar.locator("#undoDrawingButton")).toBeDisabled();
  await expect(toolbar.locator("#cancelDrawingButton")).toBeDisabled();

  const before = await toolbar.boundingBox();
  const grip = await handle.boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + 220, grip.y + 140, { steps: 6 });
  await page.mouse.up();
  const after = await toolbar.boundingBox();
  expect(after.x).toBeGreaterThan(before.x + 100);
  expect(after.y).toBeGreaterThan(before.y + 60);

  await expect(toolbar.locator(".program-draw-modes").locator("button")).toHaveText(["Polygon", "Line", "Line to Square"]);
  await expect(toolbar.locator(".program-map-floating-draw-toolbar__start")).toHaveText("Start Drawing");
  await expect(toolbar.locator(".program-map-drawing-actions").locator("button")).toHaveText(["Finish", "Cancel", "Undo Point"]);
  await toolbar.locator('[data-draw-mode="line"]').click();
  await expect(toolbar.locator('[data-draw-mode="line"]')).toHaveAttribute("aria-pressed", "true");
  await expect(toolbar.locator('[data-draw-mode="polygon"]')).toHaveAttribute("aria-pressed", "false");
  await toolbar.locator("#startDrawingButton").click();
  await expect(toolbar.locator("#cancelDrawingButton")).toBeEnabled();
});
