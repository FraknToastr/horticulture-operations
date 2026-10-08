const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});

async function createProject(child, id) {
  await child.evaluate(async (recordId) => {
    const record = {
      id: recordId, owner: "NSA", type: "application", receipt: recordId,
      title: recordId, status: "received", dateReceived: "2026-09-21",
      provenance: { owner: "NSA", sourceApp: "c4-browser-test", sourceVersion: 5, sourceId: recordId, importedAt: "2026-09-21T00:00:00.000Z" }
    };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      workspace.workspace.selectedEntityId = record.id;
      return window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id).workspace;
    });
  }, id);
}

async function openCosting(page, id) {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  await createProject(child, id);
  const frame = page.frameLocator("iframe");
  await frame.locator('[data-program-destination="costing"]').click();
  await expect(frame.locator(".program-cost-table")).toBeVisible();
  return { child, frame };
}

test("RC-DEL-03: immediate Add → Remove reaches canonical zero without a settled-state wait", async ({ page }) => {
  const { child, frame } = await openCosting(page, "NSA-APP-RC-DEL-03");
  await frame.locator('[data-costing-add-rate]:not([disabled])').first().click();
  const remove = frame.locator('[data-costing-remove]').first();
  await expect(remove).toBeEnabled();
  await remove.click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Delete item', exact: true }).click();
  await expect(frame.locator('[data-costing-lines] tr:not(.program-costing-line-group)')).toHaveCount(0);
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(0);
  await expect(frame.locator("[data-costing-error]")).toBeHidden();
});

test("C4 mapped work deletion retains geometry and prevents automatic recreation", async ({ page }) => {
  const { child, frame } = await openCosting(page, "NSA-APP-C4-GEOMETRY");
  const geometryId = await child.evaluate(async () => {
    let createdId = "";
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      const projectId = workspace.workspace.selectedProjectId;
      const created = window.UOS.WorkAreaService.createGeometry(workspace, projectId, {
        workTypeKey: "turfing", geometryKind: "polygon",
        geometry: { type: "Polygon", coordinates: [[[138.6, -34.9], [138.601, -34.9], [138.601, -34.901], [138.6, -34.9]]] },
        payload: { workTypeKey: "turfing", visible: true, valid: true }
      });
      createdId = created.entities.geometries[created.entities.geometries.length - 1].id;
      const synced = window.UOS.WorkAreaService.syncGeometry(created, createdId, { explicit: true });
      const job = synced.entities.jobs.find((item) => item.sourceGeometryId === createdId);
      synced.workspace.selectedProjectId = projectId;
      synced.workspace.costing = { selectedProjectId: projectId, jobId: job.id, section: "Labour", mode: "applications" };
      return synced;
    });
    return createdId;
  });
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(1);
  const lineId = await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines[0].id);
  const jobId = await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines[0].jobId);
  await child.evaluate(() => window.UOS.ProgramCostingController.update(window.UOS.ProgramApp.workspace()));
  await frame.locator('[data-program-destination="costing"]').click();
  await expect(frame.locator(`[data-costing-remove="${lineId}"]`)).toBeVisible();
  await expect(frame.locator(`[data-costing-remove="${lineId}"]`)).toBeEnabled();
  await frame.locator(`[data-costing-remove="${lineId}"]`).click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Delete item', exact: true }).click();
  await expect.poll(() => child.evaluate(({ geometryId, jobId }) => {
    const ws = window.UOS.ProgramApp.workspace();
    return [
      ws.entities.geometries.some((item) => item.id === geometryId),
      ws.entities.jobs.some((item) => item.sourceGeometryId === geometryId),
      ws.entities.costingLines.some((item) => item.sourceGeometryId === geometryId),
      (ws.entities.statusEvents || []).some((item) => item.entityId === jobId),
      (ws.entities.statusRecommendations || []).some((item) => item.entityId === jobId)
    ];
  }, { geometryId, jobId })).toEqual([true, false, false, false, false]);
  await expect.poll(() => child.evaluate((id) => window.UOS.ProgramApp.workspace().entities.geometries.find((item) => item.id === id).workRemoved, geometryId)).toBe(true);
  await child.evaluate(async (id) => { await window.UOS.ProgramApp.updateWorkspace((workspace) => window.UOS.WorkAreaService.syncGeometry(workspace, id)); }, geometryId);
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(0);
  await expect(frame.locator("[data-costing-error]")).toBeHidden();
});

test("C4 deleted calculator line remains absent after reload", async ({ page }) => {
  const { child, frame } = await openCosting(page, "NSA-APP-C4-REOPEN");
  await frame.locator('[data-costing-add-rate]:not([disabled])').first().click();
  const remove = frame.locator("[data-costing-remove]").first();
  await expect(remove).toBeEnabled();
  const identity = await child.evaluate(() => {
    const workspace = window.UOS.ProgramApp.workspace();
    return {
      registerId: "NSA-APP-C4-REOPEN",
      projectId: workspace.workspace.selectedProjectId,
      lineId: workspace.entities.costingLines[0].id
    };
  });
  /* Functional browser tests start with an intentionally in-memory blank
   * workspace. Establish revision 1 so this case genuinely exercises durable
   * delete/reload behavior rather than reloading another blank session. */
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => workspace, { command: "C4.persistence-barrier" });
    const candidate = window.UOS.ProgramApp.workspace();
    candidate.migration = candidate.migration || {};
    candidate.migration.repairs = candidate.migration.repairs || {};
    candidate.migration.repairs.nsaAuthoritativeProjectsV1 = {
      appliedAt: "2026-09-21T00:00:00.000Z",
      removed: { projects: 0, jobs: 0, tasks: 0, costingLines: 0, geometries: 0, quotes: 0, quoteLines: 0, payments: 0 }
    };
    await window.UOS.ProgramApp.adoptWorkspace(candidate, {
      baseRevision: candidate.workspaceRevision,
      mutationKind: "import"
    });
  });
  await remove.click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Delete item', exact: true }).click();
  await expect.poll(() => child.evaluate((lineId) => !window.UOS.ProgramApp.workspace().entities.costingLines.some((item) => item.id === lineId), identity.lineId)).toBe(true);
  await expect.poll(() => child.evaluate(async (expected) => {
    const stored = await window.UOS.ProgramStorage.get();
    return stored ? [
      stored.entities.applications.some((item) => item.id === expected.registerId),
      stored.entities.projects.some((item) => item.id === expected.projectId),
      stored.entities.costingLines.some((item) => item.id === expected.lineId)
    ] : [false, false, true];
  }, identity)).toEqual([true, true, false]);
  await child.evaluate(async () => {
    const model = window.UOS.ProgramModel;
    const stored = await window.UOS.ProgramStorage.getRaw();
    const nature = model.repairNatureProjectScope(stored);
    const geometry = model.repairLegacyGeometryDuplicates(nature.workspace);
    const placeholders = model.repairGeneratedPlaceholderJobs(geometry.workspace);
    model.assertValid(placeholders.workspace);
  });
  await page.reload();
  const reloaded = page.frames().find((candidate) => candidate !== page.mainFrame());
  await reloaded.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  await expect.poll(() => reloaded.evaluate(async (expected) => {
    const workspace = window.UOS.ProgramApp.workspace();
    const stored = await window.UOS.ProgramStorage.getRaw();
    return [
      workspace.entities.applications.some((item) => item.id === expected.registerId),
      workspace.entities.projects.some((item) => item.id === expected.projectId),
      workspace.entities.costingLines.some((item) => item.id === expected.lineId),
      Boolean(stored && stored.entities.applications.some((item) => item.id === expected.registerId)),
      Boolean(stored && stored.entities.projects.some((item) => item.id === expected.projectId)),
      window.UOS.ProgramApp.snapshot().isSessionCleared,
      String(window.UOS.ProgramApp.snapshot().error && window.UOS.ProgramApp.snapshot().error.message || "")
    ];
  }, identity)).toEqual([true, true, false, true, true, false, ""]);
});
