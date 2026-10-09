const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});

const squareCoords = [
  [138.6000, -34.9200],
  [138.6000, -34.9201],
  [138.6001, -34.9201],
  [138.6001, -34.9200],
  [138.6000, -34.9200]
];

async function ready(page) {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  return { child, frame: page.frameLocator("iframe") };
}

async function createProject(child, id) {
  return child.evaluate(async (recordId) => {
    const record = {
      id: recordId, owner: "NSA", type: "application", receipt: recordId,
      title: "C6 Mapping Project", status: "received", dateReceived: "2026-09-22",
      provenance: { owner: "NSA", sourceApp: "c6-browser-test", sourceVersion: 5, sourceId: recordId, importedAt: "2026-09-22T00:00:00.000Z" }
    };
    let workspace = window.UOS.ProgramApp.workspace();
    workspace.entities.applications.push(record);
    workspace.workspace.selectedEntityId = record.id;
    const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id);
    await window.UOS.ProgramApp.updateWorkspace(() => promoted.workspace);
    return promoted.project.id;
  }, id);
}

async function createPolygon(child, projectId, workTypeKey, id) {
  return child.evaluate(async ({ projectId, workTypeKey, id, coords }) => {
    let geometryId = "";
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      const updated = window.UOS.WorkAreaService.createGeometry(workspace, projectId, {
        id, workTypeKey, geometryKind: "polygon",
        geometry: { type: "Polygon", coordinates: [coords] },
        payload: { type: workTypeKey, workTypeKey, visible: true, valid: true }
      });
      geometryId = updated.entities.geometries[updated.entities.geometries.length - 1].id;
      return updated;
    });
    return geometryId;
  }, { projectId, workTypeKey, id, coords: squareCoords });
}

async function openPolygonInspector(frame, geometryId) {
  await frame.locator('[data-program-destination="map"]').click();
  await expect(frame.locator('[data-program-view="map"]')).toBeVisible();
  const scope = frame.locator('[data-map-scope="projects"]');
  await scope.click();
  await expect(scope).toHaveAttribute("aria-pressed", "true");
  const projectCard = frame.locator('#eventPickerList [data-event-card-id]').first();
  await expect(projectCard).toBeVisible();
  await projectCard.locator('[data-edit-event-id]').click();
  const shapeCard = frame.locator(`[data-shape-card-id="${geometryId}"]`);
  await expect(shapeCard).toBeVisible();
  return shapeCard;
}

async function openCosting(frame) {
  await frame.locator('[data-program-destination="costing"]').click();
  await expect(frame.locator(".program-cost-table").first()).toBeVisible();
}

async function fillRateDialog(frame, values) {
  const form = frame.locator('[data-costing-rate-form]');
  await form.locator('[name="description"]').fill(values.description);
  await form.locator('[name="kind"]').selectOption(values.kind || "Labour");
  await form.locator('[name="category"]').selectOption(values.category || "Maintenance");
  await form.locator('[name="unit"]').selectOption(values.unit || "m²");
  await form.locator('[name="unitRate"]').fill(String(values.unitRate));
  await form.locator('[name="quantityMode"]').selectOption(values.quantityMode || "m2");
  if (values.spatial) {
    await form.locator('[name="spatialEnabled"]').check();
    await form.locator('[name="workTypeKey"]').selectOption(values.workTypeKey);
  }
  await form.locator('[data-costing-rate-submit]').click();
  await expect(frame.locator('[data-costing-rate-dialog]')).not.toBeVisible();
}

async function configureAerationPricing(child, options = {}) {
  const includeInvalid = Boolean(options.includeInvalid);
  await child.evaluate(async ({ includeInvalid }) => {
    const ids = ["RATE-C6-AERATE-M2", "RATE-C6-AERATE-HA", "RATE-C6-AERATE-INACTIVE", "RATE-C6-AERATE-DIRECT"];
    const rates = [
      { id: ids[0], owner: "SHARED", type: "rateItem", description: "Aeration fine area", kind: "Labour", category: "Maintenance", unit: "m²", unitRate: 0.1, quantityMode: "m2", active: true, status: "active" },
      { id: ids[1], owner: "SHARED", type: "rateItem", description: "Aeration hectare area", kind: "Labour", category: "Maintenance", unit: "ha", unitRate: 300, quantityMode: "m2", active: true, status: "active" },
      { id: ids[2], owner: "SHARED", type: "rateItem", description: "Aeration inactive area", kind: "Labour", category: "Maintenance", unit: "m²", unitRate: 2, quantityMode: "m2", active: false, status: "inactive" },
      { id: ids[3], owner: "SHARED", type: "rateItem", description: "Aeration direct area", kind: "Labour", category: "Maintenance", unit: "m²", unitRate: 3, quantityMode: "direct", active: true, status: "active" }
    ];
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.rateItems = workspace.entities.rateItems.filter((rate) => !ids.includes(rate.id));
      workspace.entities.rateItems.push(...rates);
      workspace.referenceData.shared.workTypeRateItems.aerate = {
        eligibleRateItemIds: includeInvalid ? ids.slice() : ids.slice(0, 2),
        defaultRateItemId: null
      };
      return workspace;
    });
  }, { includeInvalid });
  return { m2: "RATE-C6-AERATE-M2", ha: "RATE-C6-AERATE-HA", inactive: "RATE-C6-AERATE-INACTIVE", direct: "RATE-C6-AERATE-DIRECT" };
}

async function polygonCommercialState(child, geometryId) {
  return child.evaluate((id) => {
    const workspace = window.UOS.ProgramApp.workspace();
    const geometry = workspace.entities.geometries.find((item) => item.id === id);
    const line = workspace.entities.costingLines.find((item) => item.sourceGeometryId === id);
    return {
      areaSqM: geometry && geometry.payload && geometry.payload.areaSqM,
      geometryRateItemId: geometry && geometry.rateItemId,
      lineId: line && line.id,
      rateItemId: line && line.rateItemId,
      unit: line && line.unit,
      quantity: line && line.quantity,
      unitRate: line && line.unitRate,
    amount: line && line.estimatedTotal
    };
  }, geometryId);
}

test("C6-BR-01: Aeration polygon creates exact RATE-AERATION Job and Costing Line", async ({ page }) => {
  const { child, frame } = await ready(page);
  const projectId = await createProject(child, "NSA-APP-C6-AERATION");
  const geometryId = await createPolygon(child, projectId, "aerate", "NSA-GEO-C6-AERATION");
  const shapeCard = await openPolygonInspector(frame, geometryId);
  await expect(shapeCard.locator('[data-shape-type]')).toHaveValue("aerate");
  const create = shapeCard.locator('[data-create-shape-job]');
  await expect(create).toBeEnabled();
  await create.click();
  await expect(create).toHaveClass(/is-created/);
  await expect(frame.locator("[data-program-persistence]")).toHaveText("Saved");

  const lineage = await child.evaluate((geometryId) => {
    const ws = window.UOS.ProgramApp.workspace();
    const job = ws.entities.jobs.find((item) => item.sourceGeometryId === geometryId);
    const line = ws.entities.costingLines.find((item) => item.sourceGeometryId === geometryId);
    return { job, line };
  }, geometryId);
  expect(lineage.job.sourceKind).toBe("space-map");
  expect(lineage.line.rateItemId).toBe("RATE-AERATION");
  expect(lineage.line.unitRate).toBe(18);
  expect(lineage.line.jobId).toBe(lineage.job.id);
  expect(lineage.line.sourceGeometryId).toBe(geometryId);
});

test("C6-BR-02: Supported unmapped polygon keeps Create Job disabled with no lineage", async ({ page }) => {
  const { child, frame } = await ready(page);
  const projectId = await createProject(child, "NSA-APP-C6-UNMAPPED");
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.referenceData.shared.workTypeRateItems.fertilise = "";
      return window.UOS.ProgramModel.normalize(workspace);
    });
  });
  const geometryId = await createPolygon(child, projectId, "fertilise", "NSA-GEO-C6-UNMAPPED");
  const shapeCard = await openPolygonInspector(frame, geometryId);
  const create = shapeCard.locator('[data-create-shape-job]');
  await expect(shapeCard.locator('[data-shape-type]')).toHaveValue("fertilise");
  await expect(create).toBeDisabled();
  await expect(create).toHaveAttribute("data-uos-tooltip", /active compatible pricing rates/i);
  const counts = await child.evaluate((geometryId) => {
    const ws = window.UOS.ProgramApp.workspace();
    return [ws.entities.jobs.filter((item) => item.sourceGeometryId === geometryId).length, ws.entities.costingLines.filter((item) => item.sourceGeometryId === geometryId).length];
  }, geometryId);
  expect(counts).toEqual([0, 0]);
});

test("C6-BR-03: Governed mapping persists through storage reload and remains effective", async ({ page }) => {
  let { child } = await ready(page);
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => window.UOS.ProgramCosting.upsertRateItemWithWorkType(workspace, {
      id: "RATE-C6-ROLLING-PERSIST", kind: "Labour", category: "Maintenance", description: "Rolling persistent", unit: "m²", unitRate: 11, quantityMode: "m2", active: true
    }, { enabled: true, workTypeKey: "rolling" }));
  });
  await expect.poll(() => child.evaluate(async () => {
    const stored = await window.UOS.ProgramStorage.get();
    const mapping = stored && stored.referenceData && stored.referenceData.shared.workTypeRateItems.rolling;
    return mapping && mapping.eligibleRateItemIds;
  })).toContain("RATE-C6-ROLLING-PERSIST");

  await page.reload();
  child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const restored = await child.evaluate(() => {
    const ws = window.UOS.ProgramApp.workspace();
    const rate = window.UOS.WorkAreaService.resolveWorkTypeRate(ws, "rolling");
    return { mapping: ws.referenceData.shared.workTypeRateItems.rolling, rateId: rate && rate.id };
  });
  expect(restored.mapping.eligibleRateItemIds).toContain("RATE-C6-ROLLING-PERSIST");
  expect(restored.rateId).toBe("RATE-C6-ROLLING-PERSIST");
});

test("C6-BR-DUAL-01: Adding a dual-path Rate creates one row whose Map button adds manually", async ({ page }) => {
  const { child, frame } = await ready(page);
  await createProject(child, "NSA-APP-C6-DUAL-ADD");
  await openCosting(frame);
  await expect(frame.locator('[data-costing-tools]')).toBeHidden();
  await expect(frame.locator('[data-costing-add-item]')).toBeHidden();
  await frame.locator('[data-costing-tools-toggle]').click();
  await frame.locator('[data-costing-add-item]').click();
  await fillRateDialog(frame, { description: "C6 Fertilising Pair", unitRate: 6.5, spatial: true, workTypeKey: "fertilise" });

  const rateInfo = await child.evaluate(() => {
    const rate = window.UOS.ProgramApp.workspace().entities.rateItems.find((item) => item.description === "C6 Fertilising Pair");
    return { id: rate.id, kind: rate.kind };
  });
  const rateId = rateInfo.id;
  await frame.locator(`[data-costing-section="${rateInfo.kind}"]`).click();
  const rows = frame.locator(`[data-costing-edit-rate="${rateId}"]`).locator("xpath=ancestor::tr[1]");
  await expect(rows).toHaveCount(1);
  const mapAdd = rows.locator(`[data-costing-add-rate="${rateId}"].program-rate-btn--map`);
  await expect(mapAdd).toBeVisible();
  await expect(mapAdd).toHaveAttribute("aria-label", /Also available through mapped polygons/);
  await mapAdd.click();
  await frame.locator('[data-costing-area-form] [name="area"]').fill("10");
  await frame.locator('[data-costing-area-form] [type="submit"]').click();
  await expect.poll(() => child.evaluate((rateId) => {
    const line = window.UOS.ProgramApp.workspace().entities.costingLines.find((item) => item.rateItemId === rateId);
    return line ? { sourceKind: line.sourceKind, sourceGeometryId: line.sourceGeometryId } : null;
  }, rateId)).toEqual({ sourceKind: "calculator", sourceGeometryId: null });
});

test("C6-BR-DUAL-02: Editing a manual Rate into a dual-path Rate preserves one row and changes + to Map", async ({ page }) => {
  const { child, frame } = await ready(page);
  await createProject(child, "NSA-APP-C6-DUAL-EDIT");
  await openCosting(frame);
  await frame.locator('[data-costing-tools-toggle]').click();
  await frame.locator('[data-costing-add-item]').click();
  await fillRateDialog(frame, { description: "C6 Topdressing Pair", unitRate: 8, spatial: false });

  const rateInfo = await child.evaluate(() => {
    const rate = window.UOS.ProgramApp.workspace().entities.rateItems.find((item) => item.description === "C6 Topdressing Pair");
    return { id: rate.id, kind: rate.kind };
  });
  const rateId = rateInfo.id;
  await frame.locator(`[data-costing-section="${rateInfo.kind}"]`).click();
  let row = frame.locator(`[data-costing-edit-rate="${rateId}"]`).locator("xpath=ancestor::tr[1]");
  await expect(row).toHaveCount(1);
  await expect(row.locator(`[data-costing-add-rate="${rateId}"]`)).not.toHaveClass(/program-rate-btn--map/);
  await row.locator(`[data-costing-edit-rate="${rateId}"]`).click();
  const form = frame.locator('[data-costing-rate-form]');
  await expect(frame.locator('[data-costing-rate-dialog]')).toBeVisible();
  await expect(form.locator('[name="description"]')).toHaveValue("C6 Topdressing Pair");
  await expect(form.locator('[name="unitRate"]')).toHaveValue("8");
  await form.locator('[name="spatialEnabled"]').check();
  await form.locator('[name="workTypeKey"]').selectOption("topdressing");
  await form.locator('[data-costing-rate-submit]').click();
  await expect(frame.locator('[data-costing-rate-dialog]')).not.toBeVisible();

  row = frame.locator(`[data-costing-edit-rate="${rateId}"]`).locator("xpath=ancestor::tr[1]");
  await expect(row).toHaveCount(1);
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().referenceData.shared.workTypeRateItems.topdressing.eligibleRateItemIds)).toContain(rateId);
  await expect.poll(() => child.evaluate((id) => window.UOS.WorkAreaService.isMappedRate(window.UOS.ProgramApp.workspace(), id), rateId)).toBe(true);
  await openCosting(frame);
  await frame.locator(`[data-costing-section="${rateInfo.kind}"]`).click();
  row = frame.locator(`[data-costing-edit-rate="${rateId}"]`).locator("xpath=ancestor::tr[1]");
  await expect(row.locator(`[data-costing-add-rate="${rateId}"].program-rate-btn--map`)).toBeVisible();
});

test("C6-BR-04: choose m² pricing for an Aeration polygon", async ({ page }) => {
  const { child, frame } = await ready(page);
  const rates = await configureAerationPricing(child);
  const projectId = await createProject(child, "NSA-APP-C6-BR04");
  const geometryId = await createPolygon(child, projectId, "aerate", "NSA-GEO-C6-BR04");
  const shapeCard = await openPolygonInspector(frame, geometryId);
  const rateSelect = shapeCard.locator('[data-shape-rate]');

  await expect(rateSelect).toHaveValue(rates.m2);
  await rateSelect.selectOption(rates.m2);
  await expect(shapeCard.locator('[data-create-shape-job]')).toBeEnabled();
  await shapeCard.locator('[data-create-shape-job]').click();

  await expect.poll(() => polygonCommercialState(child, geometryId)).toMatchObject({
    geometryRateItemId: rates.m2,
    rateItemId: rates.m2,
    unit: "m²",
    unitRate: 0.1
  });
  const state = await polygonCommercialState(child, geometryId);
  expect(state.quantity).toBeCloseTo(state.areaSqM, 6);
  expect(state.amount).toBeCloseTo(state.quantity * state.unitRate, 2);
});

test("C6-BR-05: choose hectare pricing and convert the same canonical measurement", async ({ page }) => {
  const { child, frame } = await ready(page);
  const rates = await configureAerationPricing(child);
  const projectId = await createProject(child, "NSA-APP-C6-BR05");
  const geometryId = await createPolygon(child, projectId, "aerate", "NSA-GEO-C6-BR05");
  const shapeCard = await openPolygonInspector(frame, geometryId);

  await shapeCard.locator('[data-shape-pricing-unit]').selectOption('ha');
  await shapeCard.locator('[data-shape-rate]').selectOption(rates.ha);
  await shapeCard.locator('[data-create-shape-job]').click();
  await expect.poll(() => polygonCommercialState(child, geometryId)).toMatchObject({
    geometryRateItemId: rates.ha,
    rateItemId: rates.ha,
    unit: "ha",
    unitRate: 300
  });
  const state = await polygonCommercialState(child, geometryId);
  expect(state.quantity).toBeCloseTo(state.areaSqM / 10000, 6);
  expect(state.amount).toBeCloseTo(state.quantity * state.unitRate, 2);
});

test("C6-BR-06: switch pricing basis before Issue without changing geometry", async ({ page }) => {
  const { child, frame } = await ready(page);
  const rates = await configureAerationPricing(child);
  const projectId = await createProject(child, "NSA-APP-C6-BR06");
  const geometryId = await createPolygon(child, projectId, "aerate", "NSA-GEO-C6-BR06");
  const shapeCard = await openPolygonInspector(frame, geometryId);
  const rateSelect = shapeCard.locator('[data-shape-rate]');

  await rateSelect.selectOption(rates.m2);
  await shapeCard.locator('[data-create-shape-job]').click();
  await expect.poll(() => polygonCommercialState(child, geometryId)).toMatchObject({
    geometryRateItemId: rates.m2,
    rateItemId: rates.m2,
    unit: "m²"
  });
  const before = await polygonCommercialState(child, geometryId);
  await shapeCard.locator('[data-shape-pricing-unit]').selectOption('ha');
  await rateSelect.selectOption(rates.ha);
  await expect.poll(() => polygonCommercialState(child, geometryId)).toMatchObject({
    geometryRateItemId: rates.ha,
    lineId: before.lineId,
    rateItemId: rates.ha,
    unit: "ha",
    unitRate: 300
  });
  const after = await polygonCommercialState(child, geometryId);
  expect(after.areaSqM).toBeCloseTo(before.areaSqM, 8);
  expect(after.quantity).toBeCloseTo(before.areaSqM / 10000, 6);
  expect(after.amount).toBeCloseTo(after.quantity * after.unitRate, 2);
});

test("C6-BR-07: multiple eligible pricing options are visible and understandable", async ({ page }) => {
  const { child, frame } = await ready(page);
  const rates = await configureAerationPricing(child);
  const projectId = await createProject(child, "NSA-APP-C6-BR07");
  const geometryId = await createPolygon(child, projectId, "aerate", "NSA-GEO-C6-BR07");
  const shapeCard = await openPolygonInspector(frame, geometryId);
  const rateSelect = shapeCard.locator('[data-shape-rate]');

  await expect(rateSelect).toHaveValue(rates.m2);
  await expect(rateSelect.locator(`option[value="${rates.m2}"]`)).toContainText(/Aeration fine area.*\$0\.10.*m²/);
  await shapeCard.locator('[data-shape-pricing-unit]').selectOption('ha');
  await expect(rateSelect.locator(`option[value="${rates.ha}"]`)).toContainText(/Aeration hectare area.*\$300\.00.*ha/);
  await expect(shapeCard.locator('[data-create-shape-job]')).toBeEnabled();
});

test("C6-BR-08: inactive and incompatible Rate Items are unavailable", async ({ page }) => {
  const { child, frame } = await ready(page);
  const rates = await configureAerationPricing(child, { includeInvalid: true });
  const projectId = await createProject(child, "NSA-APP-C6-BR08");
  const geometryId = await createPolygon(child, projectId, "aerate", "NSA-GEO-C6-BR08");
  const shapeCard = await openPolygonInspector(frame, geometryId);
  const rateSelect = shapeCard.locator('[data-shape-rate]');

  await expect(rateSelect.locator(`option[value="${rates.m2}"]`)).toHaveCount(1);
  await shapeCard.locator('[data-shape-pricing-unit]').selectOption('ha');
  await expect(rateSelect.locator(`option[value="${rates.ha}"]`)).toHaveCount(1);
  await expect(rateSelect.locator(`option[value="${rates.inactive}"]`)).toHaveCount(0);
  await expect(rateSelect.locator(`option[value="${rates.direct}"]`)).toHaveCount(0);
 await expect(shapeCard.locator('[data-create-shape-job]')).toBeEnabled();
});

test("C6-BR-09: polygon-derived Calculator controls are locked while manual controls remain editable", async ({ page }) => {
 const { child, frame } = await ready(page);
 const rates = await configureAerationPricing(child);
 const projectId = await createProject(child, "NSA-APP-C6-BR09");
 const geometryId = await createPolygon(child, projectId, "aerate", "NSA-GEO-C6-BR09", rates.m2);
 const lineIds = await child.evaluate(async ({ projectId, geometryId, rateId }) => {
  let ids;
  await window.UOS.ProgramApp.updateWorkspace((workspace) => {
   let updated = window.UOS.WorkAreaService.updateGeometry(workspace, geometryId, { rateItemId: rateId });
   updated = window.UOS.WorkAreaService.syncGeometry(updated, geometryId);
   updated = window.UOS.ProgramCosting.createJob(updated, projectId, { title: "C6 BR09 manual", sourceKind: "calculator" });
   const manualJob = updated.entities.jobs.find((job) => job.title === "C6 BR09 manual");
   updated = window.UOS.ProgramCosting.createLine(updated, rateId, { areaSqM: 10 }, { owner: "NSA", jobId: manualJob.id });
   ids = {
    spatial: updated.entities.costingLines.find((line) => line.sourceGeometryId === geometryId).id,
    manual: updated.entities.costingLines.find((line) => line.jobId === manualJob.id).id
   };
   updated.workspace.selectedEntityId = projectId;
   return updated;
  });
  return ids;
 }, { projectId, geometryId, rateId: rates.m2 });
 await frame.locator('[data-program-destination="costing"]').click();
 await expect(frame.locator(`[data-costing-line-quantity="${lineIds.spatial}"]`)).toBeDisabled();
 await expect(frame.locator(`[data-costing-line-unit="${lineIds.spatial}"]`)).toBeDisabled();
 await expect(frame.locator(`[data-costing-line-rate="${lineIds.spatial}"]`)).toBeDisabled();
 await expect(frame.locator(`[data-costing-spatial-derived="${lineIds.spatial}"]`)).toContainText(/Derived from polygon.*Space Map/);
 await expect(frame.locator(`[data-costing-line-quantity="${lineIds.manual}"]`)).toBeEnabled();
 await expect(frame.locator(`[data-costing-line-unit="${lineIds.manual}"]`)).toBeEnabled();
 await expect(frame.locator(`[data-costing-line-rate="${lineIds.manual}"]`)).toBeEnabled();
});
