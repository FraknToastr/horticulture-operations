const path = require("path");
const { test, expect } = require("@playwright/test");

test("first valid NSA PDF import has no baseline Rate Catalog conflicts", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.workspace());
  const frame = page.frameLocator("iframe");

  await frame.locator("[data-register-pdf-input]").setInputFiles(
    path.resolve("src/sample/nature-strip-dashboard-source.sample.pdf")
  );

  const dialog = frame.locator("[data-program-import-modal]");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-program-import-warnings] li")).toHaveCount(0);
  await expect(dialog.locator("[data-program-import-conflicts] li")).toHaveCount(0);
  await expect(dialog.locator("[data-program-import-warnings]").locator("xpath=..")).toBeHidden();
  await expect(dialog.locator("[data-program-import-conflicts]").locator("xpath=..")).toBeHidden();

  await dialog.locator("[data-program-import-apply]").click();
  await expect(dialog).not.toBeVisible();

  const result = await child.evaluate(() => {
    const workspace = window.UOS.ProgramApp.workspace();
    const application = workspace.entities.applications.find((item) => item.receipt === "A3330");
    return {
      applications: workspace.entities.applications.length,
      rateItems: workspace.entities.rateItems.length,
      receipt: application && application.receipt,
      status: application && application.status,
      receivedEvents: application
        ? workspace.entities.statusEvents.filter((item) => item.entityId === application.id && item.toStatus === "received").length
        : 0
    };
  });

  expect(result).toEqual({ applications: 1, rateItems: 47, receipt: "A3330", status: "received", receivedEvents: 1 });
});
