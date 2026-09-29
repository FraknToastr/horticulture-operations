const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});


test("status governance UI loads without inline reason narratives", async ({ page }) => {
  const errors = []; page.on("console", (message) => { if (message.type() === "error" || message.type() === "warning") errors.push(message.text()); }); page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.status() === 404) errors.push("404 " + response.url()); });
  await page.goto("/src/program-planner/nsa.html");
  const frame = page.frameLocator("iframe");
  await page.waitForTimeout(500);
  expect(errors.filter((message) => !message.includes("404") && !message.includes("Failed to load resource"))).toEqual([]);
  await expect(frame.locator("[data-status-automation-card]")).toBeAttached();
  await expect(frame.locator("[data-status-review-panel]")).toBeAttached();
  await expect(frame.locator("[data-status-reason-dialog]")).toBeAttached();
  expect(errors.filter((message) => !message.includes("404"))).toEqual([]);
});

test("operator dialog is keyboard dismissible and restores focus", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const frame = page.frameLocator("iframe");
  await frame.locator('[data-program-destination="data"]').click();
  const toggle = frame.locator("[data-status-automation]"); await toggle.focus(); await toggle.press("Space");
  const dialog = frame.locator("[data-status-operator-dialog]"); await expect(dialog).toBeVisible(); await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(toggle).toBeFocused();
});

test("reason narratives stay out of the drawer until the reason button opens its modal", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.workspace());
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((ws) => {
      ws.entities.applications.push({ id: "NSA-APP-REASON", owner: "NSA", type: "application", status: "received", title: "Reason test", createdAt: "2026-09-12T04:00:00.000Z", updatedAt: "2026-09-12T04:00:00.000Z", provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "reason", importedAt: "2026-09-12T04:00:00.000Z" } });
      ws.entities.statusEvents.push({ id: "NSA-SEVT-REASON", owner: "NSA", type: "statusEvent", entityId: "NSA-APP-REASON", entityType: "application", domain: "register_nsa", fromStatus: "scheduled", toStatus: "in_progress", action: "Delivery resumed", reason: "Sensitive operational narrative", actor: "Test Officer", timestamp: "2026-09-12T05:00:00.000Z", source: "human", provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "reason-event", importedAt: "2026-09-12T05:00:00.000Z" } });
      return ws;
    });
    const host = document.createElement("div"); host.setAttribute("data-register-drawer-record", "NSA-APP-REASON"); document.body.appendChild(host);
    document.dispatchEvent(new CustomEvent("uos:workspace-changed"));
  });
  const frame = page.frameLocator("iframe"), host = frame.locator('[data-register-drawer-record="NSA-APP-REASON"]').last();
  await expect(host.locator("[data-status-reason-id]")).toBeVisible();
  await expect(host).not.toContainText("Sensitive operational narrative");
  const reasonButton = host.locator("[data-status-reason-id]"); await reasonButton.focus(); await reasonButton.press("Enter");
  const dialog = frame.locator("[data-status-reason-dialog]"); await expect(dialog).toBeVisible(); await expect(dialog).toContainText("Sensitive operational narrative"); await expect(dialog).toContainText("Test Officer");
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(reasonButton).toBeFocused();
});

test("EVT shell remains isolated and exposes the exact report label", async ({ page }) => {
  await page.goto("/src/program-planner/events.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramModel);
  const result = await child.evaluate(() => ({ owner: window.UOS.ProgramModel.owner, workspaceKind: window.UOS.ProgramModel.workspaceKind, label: window.UOS.ProgramStatus.labelFor("register_evt", "report_sent") }));
  expect(result).toEqual({ owner: "EVT", workspaceKind: "EVT", label: "Report Completed and Sent" });
});

test("failed guarded commands leave durable revision and audit collections unchanged", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.workspace());
  const result = await child.evaluate(async () => {
    sessionStorage.setItem("uos.program.statusOperator", "Atomicity Officer");
    await window.UOS.ProgramApp.updateWorkspace((ws) => { ws.entities.applications.push({ id: "NSA-APP-ATOMIC", owner: "NSA", type: "application", status: "received", title: "Atomic", createdAt: "2026-09-12T06:00:00.000Z", updatedAt: "2026-09-12T06:00:00.000Z", provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "atomic", importedAt: "2026-09-12T06:00:00.000Z" } }); return ws; });
    const before = window.UOS.ProgramApp.workspace(); let message = "";
    try { await window.UOS.ProgramApp.executeStatusCommand({ entityId: "NSA-APP-ATOMIC", entityType: "application", to: "cancelled", actor: "Atomicity Officer" }); } catch (error) { message = error.message; }
    const after = window.UOS.ProgramApp.workspace(); const durable = await window.UOS.ProgramStorage.get();
    return { message, beforeRevision: before.workspaceRevision, afterRevision: after.workspaceRevision, durableRevision: durable.workspaceRevision, beforeEvents: before.entities.statusEvents.length, afterEvents: after.entities.statusEvents.length };
  });
  expect(result.message).toContain("reason");
  expect(result.afterRevision).toBe(result.beforeRevision);
  expect(result.durableRevision).toBe(result.beforeRevision);
  expect(result.afterEvents).toBe(result.beforeEvents);
});
