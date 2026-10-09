const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function load(owner) {
  const context = { console, structuredClone, TextEncoder, TextDecoder, URLSearchParams, setTimeout, clearTimeout };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({
    appId: owner === "EVT" ? "uos.horticulture.events" : "uos.horticulture.nsa",
    workspaceKind: owner,
    owner
  }) } };
  vm.createContext(context);
  for (const file of ["status.js", "default-rate-catalog.js", "model.js", "status-model.js"]) {
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file });
  }
  return context.UOS.ProgramModel;
}

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

for (const owner of ["NSA", "EVT"]) {
  test(`${owner} blank workspace contains only the governed default Rate Catalog`, () => {
    const model = load(owner);
    const workspace = model.blank("2026-09-12T00:00:00.000Z");
    const ids = workspace.entities.rateItems.map((item) => item.id);

    assert.equal(ids.length, 47);
    assert.equal(new Set(ids).size, 47);
    assert.equal(workspace.entities.rateItems.filter((item) => item.active !== false).length, 44);
    assert.equal(workspace.entities.rateItems.filter((item) => item.active === false).length, 3);
  assert.ok(workspace.entities.rateItems.every((item) => item.owner === "" && item.id.startsWith("RATE-") && ["Labour", "Equipment", "Material", "Contractors", "Sundry"].includes(item.kind)));
    assert.equal(workspace.entities.rateItems.filter((item) => item.kind === "Labour").length, 3);
    assert.equal(workspace.entities.rateItems.filter((item) => item.kind === "Sundry").length, 5);
  assert.equal(workspace.workspace.destination, "register");
  assert.deepEqual(Object.fromEntries(["Labour", "Equipment", "Material", "Contractors", "Sundry"].map((kind) => [kind, workspace.entities.rateItems.filter((item) => item.kind === kind).length])), {
    Labour: 3, Equipment: 2, Material: 35, Contractors: 2, Sundry: 5
  });
    for (const collection of model.collections) {
      if (collection !== "rateItems") assert.deepEqual(json(workspace.entities[collection]), [], collection);
    }
    assert.equal(workspace.migration.emptyOperationalBaseline.id, model.emptyOperationalBaselineId);
    assert.equal(workspace.statusControl.automationEnabled, true);
    assert.equal(workspace.statusControl.operatorName, "");
    assert.doesNotThrow(() => model.assertValid(workspace));
  });
}

test("one-time reset destroys operational state, restores rates, and is idempotent", () => {
  const model = load("NSA");
  const workspace = model.blank("2026-09-12T00:00:00.000Z");
  delete workspace.migration.emptyOperationalBaseline;
  workspace.workspaceRevision = 7;
  workspace.entities.rateItems = [{ id: "RATE-DIRTY", owner: "", type: "rateItem", active: true, category: "Dirty", description: "Dirty", unit: "item", unitRate: 999, provenance: {} }];
  workspace.entities.applications.push({ id: "NSA-APP-DIRTY", owner: "NSA", type: "application", status: "received", dateReceived: "2026-09-01", provenance: {} });
  workspace.entities.projects.push({ id: "NSA-PROJ-DIRTY", owner: "NSA", type: "project", applicationId: "NSA-APP-DIRTY", status: "draft", provenance: {} });
  workspace.entities.jobs.push({ id: "NSA-JOB-DIRTY", owner: "NSA", type: "job", projectId: "NSA-PROJ-DIRTY", status: "draft", provenance: {} });
  workspace.entities.tasks.push({ id: "NSA-TASK-DIRTY", owner: "NSA", type: "task", projectId: "NSA-PROJ-DIRTY", status: "not_started", provenance: {} });
  workspace.entities.tasks.push({ id: "corrupt-pre-reset-task", status: "legacy-invalid" });
  workspace.referenceData.users = [{ id: "user-dirty", title: "Dirty user" }];
  workspace.referenceData.dirty = { retained: false };
  workspace.workspace.destination = "planner";
  workspace.workspace.selectedEntityId = "NSA-APP-DIRTY";
  workspace.statusControl = { automationEnabled: false, operatorName: "Dirty operator", enabledBy: "Dirty operator", enabledAt: "2026-01-01T00:00:00.000Z" };
  workspace.migration.recovery = { records: [{ id: "NSA-APP-RECOVERY" }] };
  workspace.migration.unresolvedLinks = [{ entityId: "NSA-APP-DIRTY" }];

  const result = model.resetOperationalBaseline(workspace, { at: "2026-09-12T01:00:00.000Z" });
  assert.equal(result.changed, true);
  assert.equal(result.workspace.workspaceRevision, 7);
  assert.equal(result.workspace.entities.rateItems.length, 47);
  assert.equal(result.workspace.entities.rateItems.some((item) => item.id === "RATE-DIRTY"), false);
  for (const collection of model.collections) {
    if (collection !== "rateItems") assert.deepEqual(json(result.workspace.entities[collection]), [], collection);
  }
  assert.deepEqual(json(result.workspace.referenceData.users || []), []);
  assert.equal(result.workspace.referenceData.dirty, undefined);
  assert.equal(result.workspace.workspace.destination, "register");
  assert.equal(result.workspace.workspace.selectedEntityId, null);
  assert.equal(result.workspace.statusControl.automationEnabled, true);
  assert.equal(result.workspace.statusControl.operatorName, "");
  assert.equal(result.workspace.migration.recovery, undefined);
  assert.equal(result.workspace.migration.unresolvedLinks, undefined);
  assert.equal(result.report.rateItemCount, 47);
  assert.equal(result.report.purgedEntities.tasks, 2);
  assert.doesNotThrow(() => model.assertValid(result.workspace));

  const snapshot = json(result.workspace);
  const repeated = model.resetOperationalBaseline(result.workspace, { at: "2026-09-13T01:00:00.000Z" });
  assert.equal(repeated.changed, false);
  assert.deepEqual(json(repeated.workspace), snapshot);
});

test("legacy unclassified Rate Items gain deterministic library kinds without changing identity or price", () => {
  const model = load("NSA");
  const workspace = model.blank("2026-09-12T00:00:00.000Z");
  const before = workspace.entities.rateItems.map((item) => ({ id: item.id, unitRate: item.unitRate, category: item.category, description: item.description }));
  workspace.entities.rateItems.forEach((item) => { delete item.kind; });
  const normalized = model.normalize(workspace);
  assert.deepEqual(normalized.entities.rateItems.map((item) => ({ id: item.id, unitRate: item.unitRate, category: item.category, description: item.description })), before);
  assert.ok(normalized.entities.rateItems.every((item) => ["Labour", "Equipment", "Material", "Contractors", "Sundry"].includes(item.kind)));
});

test("legacy Equipment kinds are upgraded from clear Material and Contractor categories", () => {
  const model = load("NSA");
  const workspace = model.blank("2026-09-12T00:00:00.000Z");
  workspace.entities.rateItems.push(
    { id: "RATE-LEGACY-MATERIAL", owner: "", type: "rateItem", kind: "Equipment", category: "Turf Remediation", description: "Instant turf supply", unit: "m2", unitRate: 12, active: true, provenance: {} },
    { id: "RATE-LEGACY-CONTRACTOR", owner: "", type: "rateItem", kind: "Equipment", category: "Plant Hire", description: "Excavator hire", unit: "day", unitRate: 90, active: true, provenance: {} }
  );
  const normalized = model.normalize(workspace);
  assert.equal(normalized.entities.rateItems.find((item) => item.id === "RATE-LEGACY-MATERIAL").kind, "Material");
  assert.equal(normalized.entities.rateItems.find((item) => item.id === "RATE-LEGACY-CONTRACTOR").kind, "Contractors");
});
