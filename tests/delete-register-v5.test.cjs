const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function load() {
  const context = { console, structuredClone, TextEncoder, TextDecoder, URLSearchParams, setTimeout, clearTimeout };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: "uos.horticulture.nsa", workspaceKind: "NSA", owner: "NSA" }) } };
  vm.createContext(context);
  for (const file of ["status.js", "default-rate-catalog.js", "model.js", "status-model.js"]) {
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file });
  }
  return context.UOS.ProgramModel;
}

test("deleting NSA receipt A3330 cascades status control records and preserves unrelated audit", () => {
  const model = load();
  const ws = model.blank("2026-09-12T00:00:00.000Z");
  ws.entities.applications.push(
    { id: "NSA-APP-A3330", owner: "NSA", type: "application", title: "Receipt A3330", status: "received", provenance: {} },
    { id: "NSA-APP-KEEP", owner: "NSA", type: "application", title: "Keep me", status: "received", provenance: {} }
  );
  ws.entities.projects.push({ id: "NSA-PROJ-A3330", owner: "NSA", applicationId: "NSA-APP-A3330", status: "draft", provenance: {} });
  ws.entities.statusEvents.push(
    { id: "NSA-SEVT-A3330", entityId: "NSA-APP-A3330", owner: "NSA" },
    { id: "NSA-SEVT-PROJ-A3330", entityId: "NSA-PROJ-A3330", owner: "NSA" },
    { id: "NSA-SEVT-KEEP", entityId: "NSA-APP-KEEP", owner: "NSA" }
  );
  ws.entities.statusRecommendations.push(
    { id: "NSA-SREC-A3330", entityId: "NSA-APP-A3330", owner: "NSA", status: "open" },
    { id: "NSA-SREC-KEEP", entityId: "NSA-APP-KEEP", owner: "NSA", status: "open" }
  );
  const preview = model.registerDeletionImpact(ws, "NSA-APP-A3330");
  assert.equal(preview.counts.statusEvents, 2);
  assert.equal(preview.counts.statusRecommendations, 1);
  assert.throws(() => model.deleteRegisterRecord(ws, "NSA-APP-A3330"), /explicit confirmation/i);
  const result = model.deleteRegisterRecord(ws, "NSA-APP-A3330", { confirmed: true });

  assert.equal(result.workspace.entities.applications.some((item) => item.id === "NSA-APP-A3330"), false);
  assert.equal(result.workspace.entities.projects.some((item) => item.id === "NSA-PROJ-A3330"), false);
  assert.deepEqual(Array.from(result.workspace.entities.statusEvents, (item) => item.id), ["NSA-SEVT-KEEP"]);
  assert.deepEqual(Array.from(result.workspace.entities.statusRecommendations, (item) => item.id), ["NSA-SREC-KEEP"]);
  assert.equal(result.impact.counts.statusEvents, 2);
  assert.equal(result.impact.counts.statusRecommendations, 1);
  assert.doesNotThrow(() => model.assertValid(result.workspace));
});

test("Register deletion blocks issued commercial lineage after confirmation", () => {
  const model = load();
  const ws = model.blank("2026-09-12T00:00:00.000Z");
  ws.entities.applications.push({ id: "NSA-APP-PROTECTED", owner: "NSA", type: "application", status: "received", provenance: {} });
  ws.entities.projects.push({ id: "NSA-PROJ-PROTECTED", owner: "NSA", type: "project", applicationId: "NSA-APP-PROTECTED", status: "planning", provenance: {} });
  ws.entities.quotes.push({ id: "NSA-QUOTE-PROTECTED", owner: "NSA", type: "quote", projectId: "NSA-PROJ-PROTECTED", status: "Issued", provenance: {} });
  assert.throws(() => model.deleteRegisterRecord(ws, "NSA-APP-PROTECTED", { confirmed: true }), /commercial history/i);
});
