const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});

test("record modules cannot scroll the outer Register drawer or move its hard floor", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  const recordId = "NSA-APP-SCROLL-OWNERSHIP";

  await child.evaluate(async (id) => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push({ id, owner: "NSA", type: "application", receipt: "SCROLL-OWNERSHIP", title: "Scroll ownership proof", status: "received", dateReceived: "2026-09-30" });
      for (let index = 0; index < 12; index += 1) {
        workspace.entities.applications.push({ id: `NSA-APP-SCROLL-FILL-${index}`, owner: "NSA", type: "application", receipt: `SCROLL-${index}`, title: `Scroll filler ${index}`, status: "received", dateReceived: "2026-09-30" });
      }
      const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, id);
      promoted.workspace.workspace.selectedEntityId = id;
      return promoted.workspace;
    });
    window.UOS.ProgramDisclosureRows.open("register:" + id);
  }, recordId);

  const frame = page.frameLocator("iframe");
  const host = frame.locator(`[data-register-drawer-record="${recordId}"] [data-register-module-host]`);

  for (const moduleName of ["planner", "map", "costing", "scheduler", "quotes"]) {
    await child.evaluate(({ id, moduleName }) => window.UOS.ProgramApp.navigateWithContext(moduleName, id), { id: recordId, moduleName });
    await child.waitForFunction((name) => document.body.getAttribute("data-drawer-module") === name, moduleName);
    await expect(host).toBeVisible();
    await page.waitForTimeout(150);

    const before = await child.evaluate((id) => {
      const drawer = document.querySelector(`[data-register-drawer-record="${CSS.escape(id)}"]`);
      const outer = drawer.closest(".program-table-wrap");
      const cell = drawer.closest("td");
      return {
        outerScrollTop: outer.scrollTop,
        outerOverflowY: getComputedStyle(outer).overflowY,
        drawerOverflowY: getComputedStyle(drawer).overflowY,
        drawerHeight: drawer.getBoundingClientRect().height,
        drawerMaxHeight: parseFloat(getComputedStyle(drawer).maxHeight),
        floor: drawer.style.getPropertyValue("--program-drawer-max-height"),
        floorWidth: getComputedStyle(drawer).borderBottomWidth,
        floorBottom: drawer.getBoundingClientRect().bottom,
        viewportBottom: innerHeight
      };
    }, recordId);

    expect(before.outerOverflowY).toBe("hidden");
    expect(before.drawerOverflowY).toBe("hidden");
    expect(before.floorWidth).toBe("4px");
    expect(Math.abs(before.drawerHeight - before.drawerMaxHeight), moduleName + " hard floor height").toBeLessThanOrEqual(1);
    expect(before.drawerHeight).toBeLessThanOrEqual(before.drawerMaxHeight + 1);
    expect(before.floorBottom, moduleName + " floor geometry: " + JSON.stringify(before)).toBeLessThanOrEqual(before.viewportBottom);
    expect(before.floorBottom, moduleName + " floor must remain at viewport bottom").toBeGreaterThanOrEqual(before.viewportBottom - 8);
    if (moduleName === "map" || moduleName === "scheduler") {
      const divider = await host.evaluate((node, name) => {
        const sidebar = node.querySelector(name === "map" ? ".program-map-workspace > .program-map-sidebar" : ".program-scheduler-layout > .program-scheduler-inspector");
        return sidebar && { width: getComputedStyle(sidebar).borderRightWidth, color: getComputedStyle(sidebar).borderRightColor };
      }, moduleName);
      expect(divider && divider.width).toBe("4px");
    }

    if (moduleName === "quotes") {
      const inner = frame.locator(`[data-register-drawer-record="${recordId}"] .program-quote-pane-body`);
      await expect(inner).toBeVisible();
      await inner.evaluate((node) => { node.scrollTop = 0; });
      await inner.hover();
      await page.mouse.wheel(0, 500);
      await expect.poll(() => inner.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    }

    await host.hover();
    await page.mouse.wheel(0, 1800);
    const after = await child.evaluate((id) => {
      const drawer = document.querySelector(`[data-register-drawer-record="${CSS.escape(id)}"]`);
      return {
        outerScrollTop: drawer.closest(".program-table-wrap").scrollTop,
        floor: drawer.style.getPropertyValue("--program-drawer-max-height"),
        floorBottom: drawer.getBoundingClientRect().bottom
      };
    }, recordId);
    expect(after.outerScrollTop).toBe(before.outerScrollTop);
    expect(after.floor).toBe(before.floor);
    expect(after.floorBottom).toBeLessThanOrEqual(before.viewportBottom);
    if (moduleName === "planner") {
      await frame.locator(`[data-register-record="${recordId}"] .program-register-row-toggle`).focus();
      await page.keyboard.press("PageDown");
      await expect.poll(() => child.evaluate(() => document.querySelector(".program-register-main-pane > .program-table-wrap").scrollTop)).toBe(before.outerScrollTop);
      await child.evaluate(() => { document.querySelector(".program-register-main-pane > .program-table-wrap").scrollTop += 100; });
      await expect.poll(() => child.evaluate(() => document.querySelector(".program-register-main-pane > .program-table-wrap").scrollTop)).toBe(before.outerScrollTop);
    }
  }
});

test("unused Create Project and Allocate Budget actions use a white surface", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  const recordId = "NSA-APP-UNUSED-ACTIONS";
  await child.evaluate(async (id) => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push({ id, owner: "NSA", type: "application", receipt: "UNUSED-ACTIONS", title: "Unused action proof", status: "received", dateReceived: "2026-09-30" });
      workspace.workspace.selectedEntityId = id;
      return workspace;
    });
    window.UOS.ProgramDisclosureRows.open("register:" + id);
  }, recordId);

  const drawer = page.frameLocator("iframe").locator(`[data-register-drawer-record="${recordId}"]`);
  const create = drawer.locator('[data-register-action="create-project"]');
  const allocate = drawer.locator('[data-register-action="allocate-budget"]');
  await expect(create).toBeVisible();
  await expect(allocate).toBeVisible();
  for (const button of [create, allocate]) {
    await expect(button).toHaveClass(/uos-button--secondary/);
    expect(await button.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgb(255, 255, 255)");
  }
});
