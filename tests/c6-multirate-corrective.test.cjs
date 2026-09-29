const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadSuite() {
  const context = {
    console, structuredClone, TextEncoder, TextDecoder, Uint8Array, DataView,
    ArrayBuffer, URL, URLSearchParams, setTimeout, clearTimeout, crypto,
    document: { currentScript: { src: "http://example.test/src/shared/js/imports.js" } }
  };
  context.window = context;
  context.root = context;
  context.UOS = {
    ProgramAppConfig: { current: () => ({ appId: "uos.horticulture.nsa", workspaceKind: "NSA", owner: "NSA" }) }
  };
  vm.createContext(context);
 ["src/shared/js/imports.js", "src/shared/js/smart-import.js", "src/shared/js/rate-library.js", "src/shared/js/map-costing.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  });
  [
    "status.js", "default-rate-catalog.js", "model.js", "funding-model.js",
    "quote-model.js", "status-model.js", "scheduler-model.js", "costing-model.js",
    "work-area-service.js", "data-health.js", "data-workspace.js"
  ].forEach((file) => {
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file });
  });
  return context.UOS;
}

function workspaceWithProject(UOS) {
  const ws = UOS.ProgramModel.blank("2026-09-22T00:00:00.000Z");
  ws.entities.applications.push({
    id: "NSA-APP-C6-CORRECTIVE", owner: "NSA", type: "application",
    status: "received", dateReceived: "2026-09-22", title: "C6 corrective"
  });
  ws.entities.projects.push({
    id: "NSA-PROJ-C6-CORRECTIVE", owner: "NSA", type: "project",
    applicationId: "NSA-APP-C6-CORRECTIVE", title: "C6 corrective",
    status: "planning", funding: { operationalAmount: 1000000000 }
  });
  return ws;
}

function rateInput(id, unit, unitRate, options = {}) {
  return {
    id, kind: "Labour", category: "Maintenance", description: options.description || id,
    unit, unitRate, quantityMode: options.quantityMode || "m2", active: options.active !== false
  };
}

function addEligibleRate(UOS, ws, workTypeKey, input) {
  return UOS.ProgramCosting.upsertRateItemWithWorkType(ws, input, { enabled: true, workTypeKey });
}

function addPolygon(UOS, ws, workTypeKey, id, rateItemId) {
  return UOS.WorkAreaService.createGeometry(ws, "NSA-PROJ-C6-CORRECTIVE", {
    id,
    geometryKind: "polygon",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [138.6000, -34.9200], [138.6000, -34.9201], [138.6001, -34.9201],
        [138.6001, -34.9200], [138.6000, -34.9200]
      ]]
    },
    workTypeKey,
    rateItemId: rateItemId || "",
    payload: { type: workTypeKey, workTypeKey, rateItemId: rateItemId || "", valid: true }
  });
}

function calculatedLine(UOS, unit, unitRate, areaSqM) {
  const rate = UOS.rateLibrary.normalizeItem({
    id: `RATE-C6-${String(unit).replace(/[^A-Z0-9]/gi, "").toUpperCase()}`,
    category: "Maintenance", description: `Area ${unit}`, unit, unitRate,
    quantityKind: "area", active: true
  });
  const quantity = UOS.ProgramModel.spatialQuantityForRate(rate, areaSqM);
  return UOS.rateLibrary.calculateLine(rate, { areaSqM }, {
    owner: "NSA", quantityOverride: quantity, discriminator: unit
  });
}

test("C6-11: 10,000 m² uses m² pricing quantity and amount", () => {
  const UOS = loadSuite();
  const line = calculatedLine(UOS, "m²", 0.10, 10000);
  assert.equal(line.quantity, 10000);
  assert.equal(line.unit, "m²");
  assert.equal(line.estimatedTotal, 1000);
});

test("C6-12: 10,000 m² converts to one hectare for hectare pricing", () => {
  const UOS = loadSuite();
  const line = calculatedLine(UOS, "ha", 300, 10000);
  assert.equal(line.quantity, 1);
  assert.equal(line.unit, "ha");
  assert.equal(line.estimatedTotal, 300);
});

test("C6-13: 1,000,000 m² converts to one km² for km² pricing", () => {
  const UOS = loadSuite();
  const line = calculatedLine(UOS, "km²", 500, 1000000);
  assert.equal(line.quantity, 1);
  assert.equal(line.unit, "km²");
  assert.equal(line.estimatedTotal, 500);
});

test("C6-14: one work type retains multiple eligible Rate Items without mutation", () => {
  const UOS = loadSuite();
  let ws = workspaceWithProject(UOS);
  ws = addEligibleRate(UOS, ws, "aerate", rateInput("RATE-AERATION-M2", "m²", 0.1));
  const firstSnapshot = structuredClone(ws.entities.rateItems.find((item) => item.id === "RATE-AERATION-M2"));
  ws = addEligibleRate(UOS, ws, "aerate", rateInput("RATE-AERATION-HA", "ha", 300));
  const eligible = UOS.ProgramModel.eligibleSpatialRatesForWorkType(ws, "aerate");
  assert.deepEqual(Array.from(eligible, (item) => item.id), ["RATE-AERATION", "RATE-AERATION-M2", "RATE-AERATION-HA"]);
  assert.deepEqual(JSON.parse(JSON.stringify(ws.entities.rateItems.find((item) => item.id === "RATE-AERATION-M2"))), firstSnapshot);
  assert.equal(ws.entities.rateItems.find((item) => item.id === "RATE-AERATION-HA").unitRate, 300);
});

test("C6-15: ambiguous multi-rate work requires and honors exact selected Rate Item", () => {
  const UOS = loadSuite();
  let ws = workspaceWithProject(UOS);
  ws = addEligibleRate(UOS, ws, "aerate", rateInput("RATE-AERATION-HA", "ha", 300));
  ws.referenceData.shared.workTypeRateItems.aerate.defaultRateItemId = null;
  ws = addPolygon(UOS, ws, "aerate", "NSA-GEO-C6-15");
  const geometry = ws.entities.geometries[0];
  assert.throws(
    () => UOS.WorkAreaService.syncGeometry(ws, geometry.id),
    (error) => error.code === "WORK_LINEAGE_RATE_SELECTION_REQUIRED"
  );
  ws = UOS.WorkAreaService.updateGeometry(ws, geometry.id, { rateItemId: "RATE-AERATION-HA" });
  ws = UOS.WorkAreaService.syncGeometry(ws, geometry.id);
  const line = ws.entities.costingLines[0];
  assert.equal(ws.entities.geometries[0].rateItemId, "RATE-AERATION-HA");
  assert.equal(line.rateItemId, "RATE-AERATION-HA");
  assert.equal(line.unit, "ha");
  assert.equal(line.quantity, Math.round((ws.entities.geometries[0].payload.areaSqM / 10000) * 1000000) / 1000000);
});

test("C6-16: mutable selected pricing basis reprices same lineage without changing canonical area", () => {
  const UOS = loadSuite();
  let ws = workspaceWithProject(UOS);
  ws = addEligibleRate(UOS, ws, "aerate", rateInput("RATE-AERATION-M2", "m²", 0.1));
  ws = addEligibleRate(UOS, ws, "aerate", rateInput("RATE-AERATION-HA", "ha", 300));
  ws = addPolygon(UOS, ws, "aerate", "NSA-GEO-C6-16", "RATE-AERATION-M2");
  ws = UOS.WorkAreaService.syncGeometry(ws, "NSA-GEO-C6-16");
  const area = ws.entities.geometries[0].payload.areaSqM;
  const before = structuredClone(ws.entities.costingLines[0]);
  ws = UOS.WorkAreaService.updateGeometry(ws, "NSA-GEO-C6-16", { rateItemId: "RATE-AERATION-HA" });
  ws = UOS.WorkAreaService.syncGeometry(ws, "NSA-GEO-C6-16");
  const after = ws.entities.costingLines[0];
  assert.equal(after.id, before.id);
  assert.equal(ws.entities.geometries[0].payload.areaSqM, area);
  assert.equal(after.rateItemId, "RATE-AERATION-HA");
  assert.equal(after.unit, "ha");
  assert.equal(after.quantity, Math.round((area / 10000) * 1000000) / 1000000);
  assert.equal(after.estimatedTotal, Math.round(after.quantity * 300 * 100) / 100);
});

test("C6-17: direct-mode area unit is incompatible, unavailable, and reported by Data Health", () => {
  const UOS = loadSuite();
  let ws = workspaceWithProject(UOS);
  ws = UOS.ProgramCosting.upsertRateItemWithWorkType(
    ws, rateInput("RATE-C6-DIRECT-M2", "m²", 5, { quantityMode: "direct" }), { enabled: false }
  );
  ws.referenceData.shared.workTypeRateItems.fertilise = {
    eligibleRateItemIds: ["RATE-C6-DIRECT-M2"], defaultRateItemId: "RATE-C6-DIRECT-M2"
  };
  const rate = ws.entities.rateItems.find((item) => item.id === "RATE-C6-DIRECT-M2");
  assert.equal(UOS.ProgramModel.isSpatiallyCompatibleRate(rate), false);
  assert.deepEqual(Array.from(UOS.ProgramModel.eligibleSpatialRatesForWorkType(ws, "fertilise")), []);
  assert.ok(UOS.ProgramDataHealth.check(ws).issues.some((issue) => issue.code === "RATE_MAPPING_INCOMPATIBLE"));
});

test("C6-18: inactive eligible Rate Item cannot resolve or be selected", () => {
  const UOS = loadSuite();
  let ws = workspaceWithProject(UOS);
  ws = UOS.ProgramCosting.upsertRateItemWithWorkType(
    ws, rateInput("RATE-C6-INACTIVE", "ha", 300, { active: false }), { enabled: false }
  );
  ws.referenceData.shared.workTypeRateItems.rolling = {
    eligibleRateItemIds: ["RATE-C6-INACTIVE"], defaultRateItemId: "RATE-C6-INACTIVE"
  };
  assert.deepEqual(Array.from(UOS.ProgramModel.eligibleSpatialRatesForWorkType(ws, "rolling")), []);
  assert.equal(UOS.WorkAreaService.resolveWorkTypeRate(ws, "rolling"), null);
  ws = addPolygon(UOS, ws, "rolling", "NSA-GEO-C6-18", "RATE-C6-INACTIVE");
  assert.throws(
    () => UOS.WorkAreaService.syncGeometry(ws, "NSA-GEO-C6-18"),
    (error) => error.code === "WORK_LINEAGE_RATE_NOT_ELIGIBLE"
  );
});

test("C6-19: issued QuoteLine and fingerprint remain immutable after operational repricing", () => {
  const UOS = loadSuite();
  let ws = workspaceWithProject(UOS);
  ws = addEligibleRate(UOS, ws, "aerate", rateInput("RATE-AERATION-M2", "m²", 0.1));
  ws = addEligibleRate(UOS, ws, "aerate", rateInput("RATE-AERATION-HA", "ha", 300));
  ws = addPolygon(UOS, ws, "aerate", "NSA-GEO-C6-19", "RATE-AERATION-M2");
  ws = UOS.WorkAreaService.syncGeometry(ws, "NSA-GEO-C6-19");
  ws = UOS.ProgramQuotes.saveDraft(ws, {
    projectId: "NSA-PROJ-C6-CORRECTIVE", quoteDate: "2026-09-22",
    scopeNotes: "Aeration corrective pricing", refreshCosts: true
  });
  const quoteId = ws.entities.quotes[0].id;
  ws = UOS.ProgramQuotes.issue(ws, quoteId);
  const projection = JSON.parse(JSON.stringify(UOS.ProgramQuotes.commercialProjection(ws, quoteId)));
  const quoteLine = JSON.parse(JSON.stringify(ws.entities.quoteLines[0]));
  const fingerprint = ws.entities.quotes[0].commercialFingerprint;
  assert.ok(quoteLine.sourceAreaSqM > 0);
  assert.equal(quoteLine.sourceWorkTypeKey, "aerate");
  ws = UOS.WorkAreaService.updateGeometry(ws, "NSA-GEO-C6-19", { rateItemId: "RATE-AERATION-HA" });
  ws = UOS.WorkAreaService.syncGeometry(ws, "NSA-GEO-C6-19");
  assert.equal(ws.entities.costingLines[0].rateItemId, "RATE-AERATION-HA");
  assert.deepEqual(JSON.parse(JSON.stringify(UOS.ProgramQuotes.commercialProjection(ws, quoteId))), projection);
  assert.deepEqual(JSON.parse(JSON.stringify(ws.entities.quoteLines[0])), quoteLine);
  assert.equal(ws.entities.quotes[0].commercialFingerprint, fingerprint);
  assert.equal(ws.entities.quotes[0].status, "Issued");
});

test("C6-20: current save/reload and export/import retain selection, conversion, area, and eligibility", () => {
  const UOS = loadSuite();
  let ws = workspaceWithProject(UOS);
  ws = addEligibleRate(UOS, ws, "aerate", rateInput("RATE-AERATION-HA", "ha", 300));
  ws = addPolygon(UOS, ws, "aerate", "NSA-GEO-C6-20", "RATE-AERATION-HA");
  ws = UOS.WorkAreaService.syncGeometry(ws, "NSA-GEO-C6-20");
  const expected = {
    areaSqM: ws.entities.geometries[0].payload.areaSqM,
    rateItemId: ws.entities.geometries[0].rateItemId,
    unit: ws.entities.costingLines[0].unit,
    quantity: ws.entities.costingLines[0].quantity,
    mapping: JSON.parse(JSON.stringify(ws.referenceData.shared.workTypeRateItems.aerate))
  };
  const reloaded = UOS.ProgramModel.normalize(JSON.parse(JSON.stringify(ws)));
  const restored = UOS.ProgramModel.importJson(UOS.ProgramModel.exportJson(reloaded));
  assert.deepEqual({
    areaSqM: restored.entities.geometries[0].payload.areaSqM,
    rateItemId: restored.entities.geometries[0].rateItemId,
    unit: restored.entities.costingLines[0].unit,
    quantity: restored.entities.costingLines[0].quantity,
    mapping: JSON.parse(JSON.stringify(restored.referenceData.shared.workTypeRateItems.aerate))
  }, expected);
});

test("C6-21: referenced Rate Item structural changes are blocked while monetary edits preserve snapshots", () => {
 const UOS = loadSuite();
 let ws = UOS.ProgramModel.normalize(workspaceWithProject(UOS));
 ws = addEligibleRate(UOS, ws, "aerate", rateInput("RATE-C6-21", "m²", 0.1));
 ws = addPolygon(UOS, ws, "aerate", "NSA-GEO-C6-21", "RATE-C6-21");
 ws = UOS.WorkAreaService.syncGeometry(ws, "NSA-GEO-C6-21");
 const before = JSON.parse(JSON.stringify(ws));
 assert.throws(() => UOS.ProgramCosting.upsertRateItemWithWorkType(ws, rateInput("RATE-C6-21", "ha", 300), { enabled: true, workTypeKey: "aerate" }), /cannot be changed after it has commercial lineage.*Create a new Rate Item/i);
 assert.deepEqual(JSON.parse(JSON.stringify(ws)), before);
 ws = UOS.ProgramCosting.upsertRateItemWithWorkType(ws, rateInput("RATE-C6-21", "m²", 0.2), { enabled: true, workTypeKey: "aerate" });
 ws = UOS.WorkAreaService.syncGeometry(ws, "NSA-GEO-C6-21");
 assert.equal(ws.entities.costingLines[0].unit, "m²");
 assert.equal(ws.entities.costingLines[0].unitRate, 0.1);
 assert.equal(ws.entities.costingLines[0].estimatedTotal, Math.round(ws.entities.costingLines[0].quantity * 0.1 * 100) / 100);
});

test("C6-22: Data Health detects an intentionally mismatched spatial quantity without false positives for supported area units", () => {
 const UOS = loadSuite();
 ["m²", "ha", "km²"].forEach((unit, index) => {
  let ws = workspaceWithProject(UOS);
  const id = `RATE-C6-22-${index}`;
  ws = addEligibleRate(UOS, ws, "aerate", rateInput(id, unit, 1));
  ws = addPolygon(UOS, ws, "aerate", `NSA-GEO-C6-22-${index}`, id);
  ws = UOS.WorkAreaService.syncGeometry(ws, `NSA-GEO-C6-22-${index}`);
  assert.equal(UOS.ProgramDataHealth.check(ws).issues.some((issue) => issue.code === "SPATIAL_COST_QUANTITY_MISMATCH"), false);
  ws.entities.costingLines[0].quantity += 1;
  assert.equal(UOS.ProgramDataHealth.check(ws).issues.some((issue) => issue.code === "SPATIAL_COST_QUANTITY_MISMATCH"), true);
 });
});

test("C6-23: generic upsert cannot bypass the referenced Rate Item structural lock", () => {
 const UOS = loadSuite();
 let ws = workspaceWithProject(UOS);
 ws = addEligibleRate(UOS, ws, "aerate", rateInput("RATE-C6-23", "m²", 0.1));
 ws = addPolygon(UOS, ws, "aerate", "NSA-GEO-C6-23", "RATE-C6-23");
 ws = UOS.WorkAreaService.syncGeometry(ws, "NSA-GEO-C6-23");
 const before = JSON.parse(JSON.stringify(ws));
 assert.throws(() => UOS.ProgramCosting.upsertRateItem(ws, rateInput("RATE-C6-23", "m²", 0.1, { quantityMode: "direct" })), /cannot be changed after it has commercial lineage.*Create a new Rate Item/i);
 assert.deepEqual(JSON.parse(JSON.stringify(ws)), before);
 assert.equal(UOS.ProgramDataHealth.check(ws).status, "healthy");
});

test("C6-24: staged Rate Catalog import cannot bypass the referenced Rate Item structural lock", async () => {
 const UOS = loadSuite();
 UOS.ProgramModel.assertValid = () => {};
 const rateCsv = function (quantityKind) {
  const text = ["owner,category,description,unit,unitRate,rate,active,quantityKind", `NSA,Labour,C6 import aeration,m²,0.10,0.10,true,${quantityKind}`].join("\n");
  const bytes = new TextEncoder().encode(text);
  return { name: "rate-catalog.csv", size: bytes.byteLength, lastModified: 0, text: async () => text, arrayBuffer: async () => bytes.buffer.slice(0) };
 };
 let ws = UOS.ProgramModel.normalize(workspaceWithProject(UOS));
 ws.entities.tasks = [];
 ws = (await UOS.ProgramData.stage(rateCsv("area"), ws)).candidate;
 const importedRate = ws.entities.rateItems.find((item) => item.description === "C6 import aeration");
 ws = UOS.ProgramCosting.upsertRateItemWithWorkType(ws, importedRate, { enabled: true, workTypeKey: "aerate" });
 ws = addPolygon(UOS, ws, "aerate", "NSA-GEO-C6-24", importedRate.id);
 ws = UOS.WorkAreaService.syncGeometry(ws, "NSA-GEO-C6-24");
 const before = JSON.parse(JSON.stringify(ws));
 await assert.rejects(UOS.ProgramData.stage(rateCsv("direct"), ws), /cannot be changed after it has commercial lineage.*Create a new Rate Item/i);
 assert.deepEqual(JSON.parse(JSON.stringify(ws)), before);
 assert.equal(UOS.ProgramDataHealth.check(ws).status, "healthy");
});
