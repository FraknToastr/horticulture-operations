const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => { await suppressBackupModalForFunctionalTest(page); });

test("Project Planner merges section and column headers and collapses sections", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    const record = { id: "NSA-APP-PLANNER-HEADERS", owner: "NSA", type: "application", receipt: "PLANNER-HEADERS", title: "Planner header test", status: "received", dateReceived: "2026-09-22", provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "PLANNER-HEADERS", importedAt: "2026-09-22T00:00:00.000Z" } };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => { workspace.entities.applications.push(record); workspace.workspace.selectedEntityId = record.id; return window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id).workspace; });
 });
 const frame = page.frameLocator("iframe");
 const registerToggle = frame.locator(".program-register-row-toggle").first();
 await expect(registerToggle).toBeVisible();
 const registerControl = await registerToggle.evaluate((element) => {
   const style = getComputedStyle(element);
   const rect = element.getBoundingClientRect();
   return { width: rect.width, height: rect.height, borderRadius: style.borderRadius, color: style.color, backgroundColor: style.backgroundColor };
 });
 await frame.locator('[data-program-destination="planner"]').click();
  const table = frame.locator(".planner-table");
  await expect(table).toBeVisible();
  const checklistEdges = await frame.locator(".program-register-module-host .program-planner-main-pane").evaluate((pane) => {
    const drawer = pane.closest("[data-register-drawer-record]");
    const table = pane.querySelector(".planner-table");
    return {
      border: getComputedStyle(pane).borderLeftWidth,
      radius: getComputedStyle(pane).borderTopLeftRadius,
      leftGap: pane.getBoundingClientRect().left - drawer.getBoundingClientRect().left,
      rightGap: drawer.getBoundingClientRect().right - table.getBoundingClientRect().right
    };
  });
  expect(checklistEdges.border).toBe("0px");
  expect(checklistEdges.radius).toBe("0px");
  expect(checklistEdges.leftGap).toBeLessThanOrEqual(1);
  expect(checklistEdges.rightGap).toBeGreaterThanOrEqual(0);
  expect(checklistEdges.rightGap).toBeLessThanOrEqual(20);
  await expect(table).toBeVisible();
  const section = table.locator(".planner-cat-header-row").first();
  await expect(section.locator("th")).toHaveCount(6);
 await expect(section.locator(".planner-section-toggle")).toBeVisible();
 const plannerControl = await section.locator(".planner-section-toggle").evaluate((element) => {
   const style = getComputedStyle(element);
   const rect = element.getBoundingClientRect();
   return { width: rect.width, height: rect.height, borderRadius: style.borderRadius, color: style.color, backgroundColor: style.backgroundColor };
 });
  expect(registerControl.width).toBe(34);
  expect(registerControl.height).toBe(34);
  expect(registerControl.borderRadius).toBe(plannerControl.borderRadius);
  expect(registerControl.backgroundColor).toBe(plannerControl.backgroundColor);
 expect(plannerControl.width).toBe(30);
 expect(plannerControl.height).toBe(30);
  await expect(section.locator(".planner-section-toggle")).toHaveAttribute("aria-expanded", "false");
  const sectionRows = table.locator('[data-planner-section-item]');
  await expect(sectionRows.first()).toBeHidden();
  await section.locator(".planner-section-toggle").click();
  await expect(section.locator(".planner-section-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(sectionRows.first()).toBeVisible();
  await expect(table.locator(".planner-item-row:visible").first()).toBeVisible();
  const plannerLayout = await table.evaluate((element) => {
    const wrap = element.closest(".planner-table-wrap");
    const sectionRow = element.querySelector(".planner-cat-header-row");
    const row = Array.from(element.querySelectorAll(".planner-item-row")).find((candidate) => candidate.getBoundingClientRect().height > 0);
    const frames = Array.from(row.querySelectorAll(".commercial-value-frame")).map((frame) => frame.getBoundingClientRect());
    const actions = Array.from(row.querySelectorAll(".planner-action-rail .commercial-icon-button"));
    return {
      sectionBackground: getComputedStyle(sectionRow).backgroundColor,
      sectionText: getComputedStyle(sectionRow.querySelector("th")).color,
      horizontalOverflow: wrap.scrollWidth - wrap.clientWidth,
      gaps: frames.slice(1).map((frame, index) => Math.round(frame.left - frames[index].right)),
      actionLabels: actions.map((button) => button.getAttribute("aria-label")),
      taskLeftGap: Math.round(frames[0].left - row.getBoundingClientRect().left),
      railRightGap: Math.round(row.getBoundingClientRect().right - row.querySelector(".planner-action-rail").getBoundingClientRect().right)
    };
  });
  expect(plannerLayout.sectionBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(plannerLayout.sectionText).toBe("rgb(255, 255, 255)");
  expect(plannerLayout.horizontalOverflow, JSON.stringify(plannerLayout)).toBeLessThanOrEqual(1);
  expect(plannerLayout.gaps, JSON.stringify(plannerLayout)).toEqual([8, 8, 8, 8]);
  expect(plannerLayout.actionLabels).toContain("View task information");
  expect(plannerLayout.actionLabels[0]).toBe("View task information");
  expect(plannerLayout.actionLabels).toContain("Delete task");
  expect(plannerLayout.taskLeftGap).toBe(8);
  expect(plannerLayout.railRightGap).toBe(8);
  for (const font of ['default', 'dyslexic']) {
    await child.evaluate(async font => {
      document.documentElement.dataset.suiteFont = font;
      await document.fonts.ready;
    }, font);
    const bounds = await table.locator('.planner-item-row:visible').first().evaluate(row => {
      const rail = row.querySelector('.planner-action-rail');
      const frame = row.querySelector('.commercial-value-frame').getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const cellRect = rail.closest('td').getBoundingClientRect();
      return [...rail.querySelectorAll('.commercial-icon-button')].map(button => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height, frameHeight: frame.height,
          railWidth: railRect.width, cellWidth: cellRect.width, gap: getComputedStyle(rail).gap,
          railPadding: getComputedStyle(rail).padding, margin: getComputedStyle(button).margin,
          controlWidth: getComputedStyle(row.closest('table')).getPropertyValue('--planner-action-width'),
          left: rect.left - cellRect.left, right: cellRect.right - rect.right,
          railLeft: rect.left - railRect.left, railRight: railRect.right - rect.right };
      });
    });
    for (const button of bounds) {
      expect(button.width).toBe(button.frameHeight);
      expect(button.height).toBe(button.frameHeight);
      expect(button.left, JSON.stringify(bounds)).toBeGreaterThanOrEqual(0);
      expect(button.right).toBeGreaterThanOrEqual(0);
      expect(button.railLeft).toBeGreaterThanOrEqual(0);
      expect(button.railRight).toBeGreaterThanOrEqual(0);
    }
  }
  await frame.locator('[data-program-view="planner"]').screenshot({ path: "test-results/planner-section-headers.png" });
  await section.locator(".planner-section-toggle").focus();
  await expect(section.locator(".planner-section-toggle")).toBeFocused();
});

test("Register Show Project Plan opens the linked planner project", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    const record = { id: "NSA-APP-OPEN-PLAN", owner: "NSA", type: "application", receipt: "OPEN-PLAN", title: "Open plan test", status: "received", dateReceived: "2026-09-22", provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "OPEN-PLAN", importedAt: "2026-09-22T00:00:00.000Z" } };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => { workspace.entities.applications.push(record); const result = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id); result.workspace.workspace.destination = "register"; result.workspace.workspace.selectedEntityId = record.id; return result.workspace; });
  });
  const frame = page.frameLocator("iframe");
  await frame.locator('[data-program-destination="register"]').click();
  await frame.locator(`[data-register-record="NSA-APP-OPEN-PLAN"]`).first().click();
  await expect(frame.locator('[data-register-action="open-project"]')).toBeVisible();
  await frame.locator('[data-register-action="open-project"]').click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.destination)).toBe("planner");
  await expect(frame.locator('[data-program-view="planner"]')).toBeVisible();
});

test("Register exposes Project state and Locator exposes Metromaps", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const frame = page.frameLocator("iframe");
  await expect(frame.locator(".program-register-table thead th.program-register-table__project-col")).toHaveText("Project");
  await frame.locator('[data-program-destination="map"]').click();
  await expect(frame.locator("#providerSelect option[value=metromaps]")).toHaveText("Metromaps");
});
