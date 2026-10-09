const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});

function registerRecord(id) {
  return {
    id,
    owner: "NSA",
    type: "application",
    receipt: id,
    title: "Turfing Promotion Application",
    status: "received",
    dateReceived: "2026-09-18",
    provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: id, importedAt: "2026-09-18T00:00:00.000Z" }
  };
}

const squareCoords = [
  [138.6000, -34.9200],
  [138.6000, -34.9201],
  [138.6001, -34.9201],
  [138.6001, -34.9200],
  [138.6000, -34.9200]
];

test("PC-005 C3: Turfing polygon on fresh canonical Project resolves RATE-TURFING and promotes to Job & Costing Line", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const frame = page.frameLocator("iframe");

  // Set up canonical Project in a fresh baseline
  const projId = await child.evaluate(async (record) => {
    let appWs = window.UOS.ProgramApp.workspace();
    appWs.entities.applications.push(record);
    appWs.workspace.selectedEntityId = record.id;
    const promoted = window.UOS.ProgramModel.promoteRegisterRecord(appWs, record.id);
    await window.UOS.ProgramApp.updateWorkspace(() => promoted.workspace);
    return promoted.project.id;
  }, registerRecord("NSA-APP-C3-PROMO"));

  expect(projId).toBeTruthy();

  // Create supported turfing polygon on the Delivery Project
  const geomId = await child.evaluate(async ({ projectId, coords }) => {
    let createdId = "";
    await window.UOS.ProgramApp.updateWorkspace((ws) => {
      const updated = window.UOS.WorkAreaService.createGeometry(ws, projectId, {
        workTypeKey: "turfing",
        geometryKind: "polygon",
        geometry: { type: "Polygon", coordinates: [coords] },
        payload: { type: "turfing", workTypeKey: "turfing", visible: true, valid: true }
      });
      const geom = updated.entities.geometries[updated.entities.geometries.length - 1];
      createdId = geom.id;
      return updated;
    });
    return createdId;
  }, { projectId: projId, coords: squareCoords });

  expect(geomId).toBeTruthy();

  // Navigate to Map view
  await frame.locator('[data-program-destination="map"]').click();
  await expect(frame.locator('[data-program-view="map"]')).toBeVisible();

  // The linked project and geometry inspector are now present together.
  await frame.locator("[data-space-expand]").first().click();

  // Polygon Inspector opens with shape card
  const shapeCard = frame.locator(`[data-shape-card-id="${geomId}"]`);
  await expect(shapeCard).toBeVisible();

  // Verify shape card shows work type "Turfing area"
  const shapeTypeSelect = shapeCard.locator("[data-shape-type]");
  await expect(shapeTypeSelect).toHaveValue("turfing");

  // Verify Create Job button is present and click it
  const createJobBtn = shapeCard.locator('[data-create-shape-job]');
  await expect(createJobBtn).toBeVisible();
  await expect(createJobBtn).toBeEnabled();
  await expect(createJobBtn).toContainText("Create Job");

  await createJobBtn.click();

  // Button transitions to "Job created" and disabled
  await expect(createJobBtn).toHaveClass(/is-created/);
  await expect(createJobBtn).toBeDisabled();
  await expect(createJobBtn).toContainText("Job created");

  // Wait for workspace save
  await expect(frame.locator("[data-program-persistence]")).toHaveText("Saved");

  // Verify Job and CostingLine created in workspace
  const lineage = await child.evaluate(({ geometryId, projectId }) => {
    const ws = window.UOS.ProgramApp.workspace();
    const job = (ws.entities.jobs || []).find((j) => j.sourceGeometryId === geometryId);
    const line = (ws.entities.costingLines || []).find((l) => l.sourceGeometryId === geometryId);
    const geom = (ws.entities.geometries || []).find((g) => g.id === geometryId);
    const turfMapping = ws.referenceData && ws.referenceData.shared && ws.referenceData.shared.workTypeRateItems && ws.referenceData.shared.workTypeRateItems.turfing;
    return {
      hasJob: Boolean(job),
      jobTitle: job ? job.title : "",
      jobSourceKind: job ? job.sourceKind : "",
      jobProjectId: job ? job.projectId : "",
      hasLine: Boolean(line),
      lineDescription: line ? line.description : "",
      lineRateItemId: line ? line.rateItemId : "",
      lineUnit: line ? line.unit : "",
      lineUnitRate: line ? line.unitRate : 0,
      lineQuantity: line ? line.quantity : 0,
      lineEstimatedTotal: line ? line.estimatedTotal : 0,
      lineJobId: line ? line.jobId : "",
      jobId: job ? job.id : "",
      geomSyncState: geom && geom.syncState ? geom.syncState.code : "",
      geomRateItemId: geom ? geom.rateItemId : "",
      turfMapping: turfMapping || ""
    };
  }, { geometryId: geomId, projectId: projId });

  expect(lineage.hasJob).toBe(true);
  expect(lineage.jobSourceKind).toBe("space-map");
  expect(lineage.jobProjectId).toBe(projId);
  expect(lineage.jobTitle).toBe(lineage.lineDescription);

  expect(lineage.hasLine).toBe(true);
  expect(lineage.lineRateItemId).toBe("RATE-TURFING");
  expect(lineage.lineUnit).toBe("m²");
  expect(lineage.lineUnitRate).toBe(45);
  expect(lineage.lineQuantity).toBeGreaterThan(0);
  expect(lineage.lineEstimatedTotal).toBe(Math.round(lineage.lineQuantity * 45 * 100) / 100);
  expect(lineage.lineJobId).toBe(lineage.jobId);

  expect(lineage.geomSyncState).toBe("synced");
  expect(lineage.geomRateItemId).toBe("RATE-TURFING");
  expect(lineage.turfMapping).toEqual({
    eligibleRateItemIds: ["RATE-TURFING", "RATE-TURFING-HA"],
    defaultRateItemId: "RATE-TURFING"
  });
});


test("PC-005 C3: Unknown work type does not silently default to turfing and blocks Create Job until mapped work type selected", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const frame = page.frameLocator("iframe");

  // 1. Set up canonical Project
  const projId = await child.evaluate(async (record) => {
    let appWs = window.UOS.ProgramApp.workspace();
    appWs.entities.applications.push(record);
    appWs.workspace.selectedEntityId = record.id;
    const promoted = window.UOS.ProgramModel.promoteRegisterRecord(appWs, record.id);
    await window.UOS.ProgramApp.updateWorkspace(() => promoted.workspace);
    return promoted.project.id;
  }, registerRecord("NSA-APP-C3-UNKNOWN"));

  expect(projId).toBeTruthy();

  // 2. Create geometry carrying unknown work type "alien-weeding"
  const geomId = await child.evaluate(async ({ projectId, coords }) => {
    let createdId = "";
    await window.UOS.ProgramApp.updateWorkspace((ws) => {
      const updated = window.UOS.WorkAreaService.createGeometry(ws, projectId, {
        workTypeKey: "alien-weeding",
        geometryKind: "polygon",
        geometry: { type: "Polygon", coordinates: [coords] },
        payload: { type: "alien-weeding", workTypeKey: "alien-weeding", visible: true, valid: true }
      });
      const geom = updated.entities.geometries[updated.entities.geometries.length - 1];
      createdId = geom.id;
      return updated;
    });
    return createdId;
  }, { projectId: projId, coords: squareCoords });

  expect(geomId).toBeTruthy();

  // 3. Navigate to Map view -> Switch scope to Projects -> Edit Polygons
  await frame.locator('[data-program-destination="map"]').click();
  await expect(frame.locator('[data-program-view="map"]')).toBeVisible();

  await frame.locator("[data-space-expand]").first().click();

  const shapeCard = frame.locator(`[data-shape-card-id="${geomId}"]`);
  await expect(shapeCard).toBeVisible();

  // 5. Verify Inspector dropdown DOES NOT silently select Turfing; value is "" and placeholder selected
  const shapeTypeSelect = shapeCard.locator("[data-shape-type]");
  await expect(shapeTypeSelect).toHaveValue("");
  await expect(shapeTypeSelect.locator("option:checked")).toHaveText("Select work type…");

  // 6. Verify Create Job button is DISABLED with actionable feedback
  const createJobBtn = shapeCard.locator('[data-create-shape-job]');
  await expect(createJobBtn).toBeVisible();
  await expect(createJobBtn).toBeDisabled();
  await expect(createJobBtn).not.toHaveClass(/is-created/);
  await expect(createJobBtn).toHaveAttribute("data-uos-tooltip", "Select a valid work type before generating a Job");

  // 7. Verify workspace geometry still has no falsely inferred turfing value and no Job exists
  const preCheck = await child.evaluate(({ geometryId }) => {
    const ws = window.UOS.ProgramApp.workspace();
    const geom = (ws.entities.geometries || []).find((g) => g.id === geometryId);
    const jobs = (ws.entities.jobs || []).filter((j) => j.sourceGeometryId === geometryId);
    return {
      workTypeKey: geom ? (geom.workTypeKey || (geom.payload && geom.payload.workTypeKey)) : "",
      jobCount: jobs.length
    };
  }, { geometryId: geomId });

  expect(preCheck.workTypeKey).toBe("alien-weeding");
  expect(preCheck.jobCount).toBe(0);

  // 8. Explicitly select "Turfing area" in the dropdown
  await shapeTypeSelect.selectOption("turfing");
  await expect(shapeTypeSelect).toHaveValue("turfing");

  // 9. Verify Create Job button transitions to ENABLED
  await expect(createJobBtn).toBeEnabled();
  await expect(createJobBtn).toHaveAttribute("data-uos-tooltip", "Generate operational Job and Costing Line from this polygon");

  // 10. Click Create Job
  await createJobBtn.click();

  // 11. Button transitions to "Job created" (disabled, class is-created)
  await expect(createJobBtn).toHaveClass(/is-created/);
  await expect(createJobBtn).toBeDisabled();
  await expect(createJobBtn).toContainText("Job created");

  // 12. Verify Job and Costing Line created with RATE-TURFING
  const postCheck = await child.evaluate(({ geometryId, projectId }) => {
    const ws = window.UOS.ProgramApp.workspace();
    const job = (ws.entities.jobs || []).find((j) => j.sourceGeometryId === geometryId);
    const line = (ws.entities.costingLines || []).find((l) => l.sourceGeometryId === geometryId);
    const geom = (ws.entities.geometries || []).find((g) => g.id === geometryId);
    return {
      hasJob: Boolean(job),
      jobTitle: job ? job.title : "",
      hasLine: Boolean(line),
      lineDescription: line ? line.description : "",
      lineRateItemId: line ? line.rateItemId : "",
      lineUnitRate: line ? line.unitRate : 0,
      geomSyncState: geom && geom.syncState ? geom.syncState.code : "",
      geomRateItemId: geom ? geom.rateItemId : ""
    };
  }, { geometryId: geomId, projectId: projId });

  expect(postCheck.hasJob).toBe(true);
  expect(postCheck.jobTitle).toBe(postCheck.lineDescription);
  expect(postCheck.hasLine).toBe(true);
  expect(postCheck.lineRateItemId).toBe("RATE-TURFING");
  expect(postCheck.lineUnitRate).toBe(45);
  expect(postCheck.geomSyncState).toBe("synced");
  expect(postCheck.geomRateItemId).toBe("RATE-TURFING");
});
