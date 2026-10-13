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
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: "uos.horticulture.nsa", workspaceKind: "NSA", owner: "NSA" }) } };
  vm.createContext(context);
  ["src/shared/js/imports.js", "src/shared/js/smart-import.js", "src/shared/js/rate-library.js", "src/shared/js/map-costing.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  });
  ["status.js", "default-rate-catalog.js", "model.js", "funding-model.js", "quote-model.js", "status-model.js", "scheduler-model.js", "costing-model.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file });
  });
  return context.UOS;
}

test("legacy catalog rates recover all five library menus without overriding user choices", () => {
  const UOS = loadSuite();
  const workspace = UOS.ProgramModel.blank("2026-10-11T00:00:00Z");
  const fixtures = [
    ["Labour", "City Operations", "Ground crew hours"],
    ["Equipment", "Infrastructure", "Barrier installation"],
    ["Material", "Soil / top dress", "Compost supply"],
    ["Contractors", "Plant Hire/Contractors (external)", "Machine hire"],
    ["Sundry", "Sundry Costs", "Permit fee"]
  ];
  workspace.entities.rateItems = fixtures.map(([kind, category, description]) => ({
    id: "RATE-LEGACY-GROUP-" + kind, kind: "Labour", catalogSection: "Labour", libraryCategory: "Labour",
    category, description, unit: "item", unitRate: 12, active: true, schedulerEnabled: true,
    provenance: { migrationKind: "catalog-rate-clone", sourceVersion: 3 }
  }));
  workspace.entities.rateItems.push({ ...workspace.entities.rateItems[2], id: "RATE-EXPLICIT-LABOUR", kindSource: "user" });
  const recovered = UOS.ProgramModel.normalize(workspace);
  for (const [kind] of fixtures) {
    const rate = recovered.entities.rateItems.find(item => item.id === "RATE-LEGACY-GROUP-" + kind);
    assert.equal(rate.kind, kind); assert.equal(rate.catalogSection, kind); assert.equal(rate.libraryCategory, kind);
    assert.ok(UOS.ProgramCosting.catalogItems(recovered, { section: kind }).some(item => item.id === rate.id));
    assert.equal(rate.unitRate, 12);
    assert.equal(rate.schedulerEnabled, ["Labour", "Contractors"].includes(kind));
  }
  assert.equal(recovered.entities.rateItems.find(item => item.id === "RATE-EXPLICIT-LABOUR").kind, "Labour");
  assert.equal(recovered.entities.rateItems.find(item => item.id === "RATE-EXPLICIT-LABOUR").schedulerEnabled, true);
  assert.deepEqual(UOS.ProgramModel.normalize(recovered), recovered);
  const legacy = UOS.ProgramModel.blank("2026-10-11T00:00:00Z");
  legacy.schemaVersion = 3;
  legacy.entities.applications.push({ id: "NSA-APP-LEGACY-MENUS", owner: "NSA", type: "application", title: "Legacy catalog fixture", status: "received", dateReceived: "2026-10-11" });
  legacy.entities.rateItems = fixtures.map(([kind, category, description]) => ({ id: "OLD-" + kind, category, description, unit: "item", unitRate: 12, active: true }));
  const migrated = UOS.ProgramModel.normalize(legacy);
  for (const [kind, , description] of fixtures) assert.equal(migrated.entities.rateItems.find(rate => rate.description === description).kind, kind);
});

test("Rate Library CSV exports current schema and round-trips source metadata and both add paths", () => {
  const UOS = loadSuite();
  const workspace = UOS.ProgramModel.blank("2026-09-28T00:00:00.000Z");
  const mappedId = workspace.entities.rateItems[0].id;
  const mappingKey = UOS.ProgramModel.supportedPolygonWorkTypes[0].key;
  workspace.referenceData.shared.workTypeRateItems[mappingKey] = {
    eligibleRateItemIds: [mappedId], defaultRateItemId: mappedId
  };
  const manual = UOS.ProgramCosting.normalizeRateItem({
    id: "RATE-EXPORT-MANUAL", category: "Seedlings - Mixed", description: "Mixed native plants",
    kind: "Material", unit: "each", unitRate: 2.5, active: true, quantityMode: "direct",
    source: { fileName: "seedlings.csv", importedAt: "2026-09-01T12:00:00Z", sourceRow: 8, id: "legacy-seedling-8" },
    sourceApp: "legacy-rate-import", sourceVersion: 4, legacyId: "OLD-8"
  });
  manual.provenance.sourceApp = "legacy-rate-import";
  manual.provenance.sourceVersion = 4;
  manual.provenance.legacyId = "OLD-8";
  workspace.entities.rateItems.push(manual);

  const csv = UOS.ProgramCosting.exportRateCsv(workspace);
  const rows = UOS.rateLibrary.importCsv(csv).items;
  const columns = Array.from(UOS.rateLibrary.csvColumns);
  const mapped = rows.find((item) => item.id === mappedId);
  const exportedManual = rows.find((item) => item.id === manual.id);

  assert.deepEqual(columns.slice(8, 12), ["kind", "libraryCategory", "catalogSection", "addPath"]);
  assert.equal(rows.length, workspace.entities.rateItems.length);
  assert.equal(mapped.addPath, "Manual + Map");
  assert.equal(exportedManual.addPath, "Manual");
  assert.equal(exportedManual.kind, "Material");
  assert.equal(exportedManual.libraryCategory, "Material");
  assert.equal(exportedManual.source.fileName, "seedlings.csv");
  assert.equal(exportedManual.source.sourceRow, 8);
  assert.equal(exportedManual.source.id, "legacy-seedling-8");
  assert.equal(exportedManual.sourceApp, "legacy-rate-import");
  assert.equal(exportedManual.sourceVersion, "4");
  assert.equal(exportedManual.legacyId, "OLD-8");
});

test("Rate Library CSV import remains compatible with the original eight-column schema", () => {
  const UOS = loadSuite();
  const imported = UOS.rateLibrary.importCsv([
    "id,owner,category,description,unit,unitRate,active,quantityKind",
    "RATE-OLD,GLOBAL,Maintenance,Legacy rate,item,12.5,true,direct"
  ].join("\n")).items;

  assert.equal(imported.length, 1);
  assert.equal(imported[0].description, "Legacy rate");
  assert.equal(imported[0].kind, "");
  assert.equal(imported[0].addPath, "");
});

test("user-selected Rate Kind survives normalization when category suggests another Kind", () => {
  const UOS = loadSuite();
  let workspace = UOS.ProgramModel.blank("2026-09-29T00:00:00.000Z");
  workspace = UOS.ProgramCosting.upsertRateItem(workspace, {
    id: "RATE-USER-EQUIPMENT", kind: "Equipment", kindSource: "user",
    category: "Materials", description: "Selected equipment rate",
    unit: "item", unitRate: 7.25, active: true
  });
  workspace = UOS.ProgramModel.normalize(JSON.parse(JSON.stringify(workspace)));
  const saved = workspace.entities.rateItems.find((rate) => rate.id === "RATE-USER-EQUIPMENT");
  assert.equal(saved.kind, "Equipment");
  assert.equal(saved.catalogSection, "Equipment");
  assert.equal(saved.kindSource, "user");
  assert.equal(UOS.ProgramCosting.catalogItems(workspace, { section: "Equipment" }).some((rate) => rate.id === saved.id), true);

  const legacy = UOS.ProgramCosting.normalizeRateItem({
    id: "RATE-LEGACY-MATERIAL", kind: "Equipment", category: "Materials",
    description: "Legacy material rate", unit: "item", unitRate: 7.25, active: true
  });
  assert.equal(legacy.kind, "Material");
});
