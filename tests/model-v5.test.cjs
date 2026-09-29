const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function load(owner = "NSA") {
  const context = { console, structuredClone, TextEncoder, TextDecoder, URLSearchParams, setTimeout, clearTimeout };
  context.window = context; context.UOS = { ProgramAppConfig: { current: () => ({ appId: owner === "NSA" ? "uos.horticulture.nsa" : "uos.horticulture.events", workspaceKind: owner, owner }) } };
  vm.createContext(context);
  for (const file of ["status.js", "default-rate-catalog.js", "model.js", "status-model.js"]) vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file });
  return context.UOS.ProgramModel;
}

test("blank v5 workspaces contain canonical collections and guarded automation", () => {
  const model = load(); const ws = model.blank("2026-09-12T00:00:00.000Z");
  assert.equal(ws.schemaVersion, 5); assert.deepEqual(Array.from(ws.entities.statusEvents), []); assert.deepEqual(Array.from(ws.entities.statusRecommendations), []);
  assert.equal(ws.statusControl.automationEnabled, true); assert.doesNotThrow(() => model.assertValid(ws));
});

test("PC-006 Project promotion creates canonical checklist Tasks but no implicit Job", () => {
  ["NSA", "EVT"].forEach((owner) => {
    const model = load(owner);
    const ws = model.blank("2026-09-12T00:00:00.000Z");
    const record = {
      id: owner === "NSA" ? "NSA-APP-PROMOTION-NO-JOB" : "EVT-EVENT-PROMOTION-NO-JOB",
      owner,
      type: owner === "NSA" ? "application" : "event",
      title: "Promotion without Job",
      dateReceived: "2026-09-12",
      status: "received"
    };
    ws.entities[owner === "NSA" ? "applications" : "events"].push(record);

    const result = model.promoteRegisterRecord(ws, record.id);
    const projectTasks = result.workspace.entities.tasks.filter((task) => task.projectId === result.project.id);
    const projectJobs = result.workspace.entities.jobs.filter((job) => job.projectId === result.project.id);

    assert.equal(result.created, true);
    assert.ok(projectTasks.length > 0, owner + " Project receives its canonical checklist Tasks");
    assert.deepEqual(Array.from(projectJobs), [], owner + " Project promotion must not create a Job");
  });
});

test("v4 normalisation performs v5 status migration and JSON round-trip", () => {
  const model = load(); const v4 = model.blank("2026-09-12T00:00:00.000Z");
  v4.schemaVersion = 4; delete v4.statusControl; delete v4.entities.statusEvents; delete v4.entities.statusRecommendations;
  v4.entities.applications.push({ id: "NSA-APP-X", owner: "NSA", type: "application", status: "Received", provenance: {} });
  const migrated = model.normalize(v4); assert.equal(migrated.schemaVersion, 5); assert.equal(migrated.entities.applications[0].status, "received"); assert.equal(migrated.statusControl.automationEnabled, false);
  const restored = model.importJson(model.exportJson(migrated)); assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(migrated)));
});

for (const sourceVersion of [2, 3]) test(`schema-v${sourceVersion} normalisation chains through exact legacy migrations to v5`, () => {
  const model = load(); const legacy = model.blank("2026-09-12T00:00:00.000Z");
  legacy.schemaVersion = sourceVersion; delete legacy.statusControl; delete legacy.entities.statusEvents; delete legacy.entities.statusRecommendations;
  const migrated = model.normalize(legacy);
  assert.equal(migrated.schemaVersion, 5); assert.equal(migrated.statusControl.automationEnabled, false); assert.equal(migrated.migration.statusReadiness.sourceSchemaVersion, 4);
});

test("invalid canonical status is rejected without changing the source", () => {
  const model = load(); const ws = model.blank(); ws.entities.projects.push({ id: "NSA-PROJ-X", owner: "NSA", type: "project", status: "mystery", applicationId: "NSA-APP-X", provenance: {} }); ws.entities.applications.push({ id: "NSA-APP-X", owner: "NSA", type: "application", status: "received", provenance: {} });
  assert.throws(() => model.assertValid(ws), /canonical project code/); assert.equal(ws.entities.projects[0].status, "mystery"); assert.equal(ws.workspaceRevision, 0);
});
