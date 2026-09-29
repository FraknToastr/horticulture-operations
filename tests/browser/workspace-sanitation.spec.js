const { test, expect } = require("@playwright/test");

async function programFrame(page) {
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  return child;
}

for (const fixture of [
  { owner: "NSA", route: "nsa.html", collection: "applications", id: "NSA-APP-RELOAD-SAFE" },
  { owner: "EVT", route: "events.html", collection: "events", id: "EVT-EVENT-RELOAD-SAFE" }
]) {
  test(`${fixture.owner} reload preserves operational records even without a rollout marker`, async ({ page }) => {
    await page.goto(`/src/program-planner/${fixture.route}`);
    let child = await programFrame(page);
    const before = await child.evaluate(async ({ owner, collection, id }) => {
      const saved = await window.UOS.ProgramApp.updateWorkspace((workspace) => {
        delete workspace.migration.emptyOperationalBaseline;
        workspace.entities[collection].push({
          id, owner, type: owner === "EVT" ? "event" : "application",
          dateReceived: "2026-09-01", status: "received",
          provenance: { owner, sourceApp: "browser-test", sourceVersion: 5, sourceId: id, importedAt: "2026-09-01T00:00:00.000Z" }
        });
        return workspace;
      });
      return saved.workspaceRevision;
    }, fixture);

    await page.reload();
    child = await programFrame(page);
    const after = await child.evaluate(({ collection, id }) => {
      const workspace = window.UOS.ProgramApp.workspace();
      return {
        revision: workspace.workspaceRevision,
        retained: workspace.entities[collection].some((item) => item.id === id),
        marker: workspace.migration.emptyOperationalBaseline || null
      };
    }, fixture);

    expect(after.retained).toBe(true);
    expect(after.revision).toBe(before);
    expect(after.marker).toBeNull();
  });
}

test("workspace adoption preserves a local rollout marker for legacy-compatible imports", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  let child = await programFrame(page);
  const adopted = await child.evaluate(async () => {
    const candidate = window.UOS.ProgramModel.blank("2026-09-12T04:00:00.000Z");
    candidate.entities.applications.push({
      id: "NSA-APP-IMPORTED-HISTORIC", owner: "NSA", type: "application",
      dateReceived: "2025-05-01", status: "received", provenance: {}
    });
    const saved = await window.UOS.ProgramApp.adoptWorkspace(candidate);
    return {
      marker: saved.migration.emptyOperationalBaseline,
      retained: saved.entities.applications.some((item) => item.id === "NSA-APP-IMPORTED-HISTORIC")
    };
  });
  expect(adopted.marker.id).toBe("empty-operational-baseline-2026-09-12");
  expect(adopted.retained).toBe(true);

  await page.reload();
  child = await programFrame(page);
  expect(await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.applications.some((item) => item.id === "NSA-APP-IMPORTED-HISTORIC"))).toBe(true);
});
