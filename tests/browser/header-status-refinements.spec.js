const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

async function openProgram(page, owner) {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === "EVT" ? "events" : "nsa"}.html`);
  const child = page.frames().find((frame) => frame !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.workspace());
  return { child, frame: page.frameLocator("iframe") };
}

for (const owner of ["NSA", "EVT"]) {
  test(`${owner} header titles are enlarged and keep descenders within the accent height`, async ({ page }) => {
    const { child, frame } = await openProgram(page, owner);
    await child.evaluate(async (moduleOwner) => {
      const id = `${moduleOwner}-${moduleOwner === "EVT" ? "EVENT" : "APP"}-HEADER-STYLE`;
      await window.UOS.ProgramApp.updateWorkspace((workspace) => {
        workspace.entities[moduleOwner === "EVT" ? "events" : "applications"].push({
          id,
          owner: moduleOwner,
          type: moduleOwner === "EVT" ? "event" : "application",
          title: "Header typography check",
          status: "received",
          dateReceived: "2026-10-18"
        });
        const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, id);
        workspace = promoted.workspace;
        workspace.workspace.selectedEntityId = id;
        workspace.workspace.selectedProjectId = promoted.project.id;
        return workspace;
      });
    }, owner);
    await frame.locator('.program-header-nav [data-program-destination="planner"]').click();
    await expect(frame.locator("#program-header-module")).toHaveText("Project Planner");
    await expect(frame.locator("#program-header-title")).toHaveText(owner === "EVT" ? "Event Space Remediation" : "Nature Strip Applications");

    for (const font of ["standard", "dyslexic"]) {
      const measurements = await child.evaluate(async (readingFont) => {
        document.documentElement.dataset.suiteFont = readingFont;
        if (readingFont === "dyslexic") await document.fonts.load('800 26px "OpenDyslexic"');
        await document.fonts.ready;
        const accent = document.querySelector(".uos-brand__divider").getBoundingClientRect();
        const ctx = document.createElement("canvas").getContext("2d");
        return [...document.querySelectorAll("#program-header-title, #program-header-module")].map((node) => {
          const style = getComputedStyle(node);
          ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          // Include every descender even when the current application name has none.
          const ink = ctx.measureText(`${node.textContent} gyjpq`);
          const box = node.getBoundingClientRect();
          return {
            id: node.id,
            size: parseFloat(style.fontSize),
            lineHeight: parseFloat(style.lineHeight),
            inkHeight: ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent,
            height: box.height,
            top: box.top,
            bottom: box.bottom,
            accentHeight: accent.height,
            accentTop: accent.top,
            accentBottom: accent.bottom,
            visible: box.width > 0 && style.display !== "none"
          };
        });
      }, font);
      for (const measurement of measurements) {
        expect(measurement.visible, `${owner}/${font}/${measurement.id}`).toBe(true);
        expect(measurement.size).toBeGreaterThanOrEqual(24);
        expect(measurement.lineHeight).toBeLessThanOrEqual(measurement.accentHeight);
        expect(measurement.inkHeight).toBeLessThanOrEqual(measurement.accentHeight);
        expect(measurement.height).toBeLessThanOrEqual(measurement.accentHeight);
        expect(measurement.top).toBeGreaterThanOrEqual(measurement.accentTop - 1);
        expect(measurement.bottom).toBeLessThanOrEqual(measurement.accentBottom + 1);
      }
    }
  });
}

test("EVT Status Guide scrolls only its contents and keeps both close controls reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 760 });
  const { frame } = await openProgram(page, "EVT");
  await frame.locator('[data-program-destination="register"]').click();
  const trigger = frame.locator("[data-status-guide-open]");
  await trigger.click();
  const dialog = frame.getByRole("dialog", { name: "EVT Register status guide" });
  await expect(dialog).toBeVisible();
  const content = dialog.locator("[data-status-guide-content]");
  const before = await dialog.evaluate((node) => {
    const body = node.querySelector("[data-status-guide-content]");
    return {
      overflow: getComputedStyle(node).overflowY,
      outerExcess: node.scrollHeight - node.clientHeight,
      innerExcess: body.scrollHeight - body.clientHeight,
      outerScrollTop: node.scrollTop,
      headerTop: node.querySelector("header").getBoundingClientRect().top,
      footerBottom: node.querySelector("footer").getBoundingClientRect().bottom,
      scrollContainers: [...node.querySelectorAll("*")].filter((element) => /auto|scroll/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1).map((element) => element.hasAttribute("data-status-guide-content"))
    };
  });
  expect(before.overflow).toBe("hidden");
  expect(before.outerExcess).toBeLessThanOrEqual(1);
  expect(before.innerExcess).toBeGreaterThan(0);
  expect(before.scrollContainers).toEqual([true]);
  await content.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  expect(await content.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await dialog.evaluate((node) => node.scrollTop)).toBe(before.outerScrollTop);
  await expect(dialog.locator("header [data-status-guide-close]")).toBeInViewport();
  await expect(dialog.locator("footer [data-status-guide-close]")).toBeInViewport();
  const after = await dialog.evaluate((node) => ({
    headerTop: node.querySelector("header").getBoundingClientRect().top,
    footerBottom: node.querySelector("footer").getBoundingClientRect().bottom
  }));
  expect(after.headerTop).toBeCloseTo(before.headerTop, 1);
  expect(after.footerBottom).toBeCloseTo(before.footerBottom, 1);
  await dialog.locator("footer [data-status-guide-close]").click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
