const { test, expect } = require("@playwright/test");

test("NSA receipt deletion commits durably with its status audit", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.workspace());

  const result = await child.evaluate(async () => {
    const app = window.UOS.ProgramApp;
    const model = window.UOS.ProgramModel;
    await app.updateWorkspace((ws) => {
      ws.entities.applications.push({
        id: "NSA-APP-A3330",
        owner: "NSA",
        type: "application",
        status: "received",
        title: "Receipt A3330",
        createdAt: "2026-09-12T06:00:00.000Z",
        updatedAt: "2026-09-12T06:00:00.000Z",
        provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "A3330", importedAt: "2026-09-12T06:00:00.000Z" }
      });
      return ws;
    });
    const before = app.workspace();
    const beforeAudit = before.entities.statusEvents.filter((item) => item.entityId === "NSA-APP-A3330").length;
      const saved = await app.updateWorkspace((ws) => model.deleteRegisterRecord(ws, "NSA-APP-A3330", { confirmed: true }).workspace);
    const after = app.workspace();
    const durable = await window.UOS.ProgramStorage.get();
    return {
      savedRevision: saved && saved.workspaceRevision,
      beforeAudit,
      beforeRevision: before.workspaceRevision,
      afterRevision: after.workspaceRevision,
      durableRevision: durable.workspaceRevision,
      liveReceipt: durable.entities.applications.some((item) => item.id === "NSA-APP-A3330"),
      liveAudit: durable.entities.statusEvents.some((item) => item.entityId === "NSA-APP-A3330"),
      liveRecommendation: durable.entities.statusRecommendations.some((item) => item.entityId === "NSA-APP-A3330")
    };
  });

  expect(result.savedRevision).toBe(result.afterRevision);
  expect(result.beforeAudit).toBeGreaterThan(0);
  expect(result.afterRevision).toBe(result.beforeRevision + 1);
  expect(result.durableRevision).toBe(result.afterRevision);
  expect(result.liveReceipt).toBe(false);
  expect(result.liveAudit).toBe(false);
  expect(result.liveRecommendation).toBe(false);
});
