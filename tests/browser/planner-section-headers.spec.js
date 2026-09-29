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
  await frame.locator('[data-program-view="planner"]').screenshot({ path: "test-results/planner-section-headers.png" });
  const section = table.locator(".planner-cat-header-row").first();
  await expect(section.locator("th")).toHaveCount(6);
 await expect(section.locator(".planner-section-toggle")).toBeVisible();
 const plannerControl = await section.locator(".planner-section-toggle").evaluate((element) => {
   const style = getComputedStyle(element);
   const rect = element.getBoundingClientRect();
   return { width: rect.width, height: rect.height, borderRadius: style.borderRadius, color: style.color, backgroundColor: style.backgroundColor };
 });
 expect(registerControl).toEqual(plannerControl);
 expect(plannerControl.width).toBe(30);
 expect(plannerControl.height).toBe(30);
  await expect(section.locator(".planner-section-toggle")).toHaveAttribute("aria-expanded", "true");
  const sectionRows = table.locator('[data-planner-section-row]');
  await expect(sectionRows.first()).toBeVisible();
  await section.locator(".planner-section-toggle").click();
  await expect(section.locator(".planner-section-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(sectionRows.first()).toBeHidden();
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
