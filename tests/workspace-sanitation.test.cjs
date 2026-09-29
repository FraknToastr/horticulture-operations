const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function load(owner = "NSA") {
  const context = { console, structuredClone, TextEncoder, TextDecoder, URLSearchParams, setTimeout, clearTimeout };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: owner === "NSA" ? "uos.horticulture.nsa" : "uos.horticulture.events", workspaceKind: owner, owner }) } };
  vm.createContext(context);
  for (const file of ["status.js", "default-rate-catalog.js", "model.js", "status-model.js"]) vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file });
  return { model: context.UOS.ProgramModel, status: context.UOS.ProgramStatus };
}

function unsanitized(model, at) {
  const ws = model.blank(at);
  delete ws.migration.registerBaselineSanitation;
  return ws;
}

test("baseline sanitation retains valid records from 1 July 2026 inclusively and purges all operational artifacts", () => {
  const { model } = load("NSA");
  const ws = unsanitized(model, "2026-09-12T00:00:00.000Z");
  ws.referenceData.sanitationSentinel = { retained: true };
  ws.entities.applications.push(
    { id: "NSA-APP-OLD", owner: "NSA", type: "application", receivedDate: "2026-06-30", status: "complete", provenance: {} },
    { id: "NSA-APP-CUTOFF", owner: "NSA", type: "application", dateReceived: "2026-07-01", status: "complete", statusHistory: [{ status: "Complete", date: "2026-08-01" }], provenance: {} },
    { id: "NSA-APP-LATER", owner: "NSA", type: "application", lodgedDate: "3/07/2026", status: "cancelled", provenance: {} },
    { id: "NSA-APP-MISSING", owner: "NSA", type: "application", status: "received", provenance: {} },
    { id: "NSA-APP-INVALID", owner: "NSA", type: "application", dateReceived: "2026-02-30", status: "received", provenance: {} }
  );
  const artifacts = {
    projects: { id: "NSA-PROJ-X", owner: "NSA", applicationId: "NSA-APP-CUTOFF", status: "draft", provenance: {} },
    jobs: { id: "NSA-JOB-X", owner: "NSA", projectId: "NSA-PROJ-X", status: "draft", provenance: {} },
    tasks: { id: "NSA-TASK-X", owner: "NSA", projectId: "NSA-PROJ-X", status: "not_started", provenance: {} },
    costingLines: { id: "NSA-COST-X", owner: "NSA", projectId: "NSA-PROJ-X", jobId: "NSA-JOB-X", provenance: {} },
    geometries: { id: "NSA-GEO-X", owner: "NSA", projectId: "NSA-PROJ-X", provenance: {} },
    quotes: { id: "NSA-QUOTE-X", owner: "NSA", projectId: "NSA-PROJ-X", status: "Draft", provenance: {} },
    quoteLines: { id: "NSA-QLINE-X", owner: "NSA", quoteId: "NSA-QUOTE-X", projectId: "NSA-PROJ-X", quantity: 1, unitRate: 10, total: 10, provenance: {} },
    payments: { id: "NSA-PAY-X", owner: "NSA", quoteId: "NSA-QUOTE-X", projectId: "NSA-PROJ-X", amount: 10, reference: "PAY-X", status: "Recorded", provenance: {} },
    paymentAllocations: { id: "NSA-PALLOC-X", owner: "NSA", projectId: "NSA-PROJ-X", quoteId: "NSA-QUOTE-X", quoteLineId: "NSA-QLINE-X", paymentId: "NSA-PAY-X", amount: 10, status: "Active", provenance: {} },
    quoteEvents: { id: "NSA-QEVT-X", owner: "NSA", quoteId: "NSA-QUOTE-X", provenance: {} },
    statusEvents: { id: "NSA-SEVT-X", owner: "NSA", entityId: "NSA-APP-CUTOFF" },
    statusRecommendations: { id: "NSA-SREC-X", owner: "NSA", entityId: "NSA-APP-CUTOFF", status: "open" }
  };
  for (const [collection, item] of Object.entries(artifacts)) ws.entities[collection].push(item);

  const result = model.sanitizeRegisterBaseline(ws, { at: "2026-09-12T01:00:00.000Z" });
  const kept = result.workspace.entities.applications;
  assert.equal(result.changed, true);
  assert.deepEqual(Array.from(kept, (item) => item.id), ["NSA-APP-CUTOFF", "NSA-APP-LATER"]);
  assert.deepEqual(Array.from(kept, (item) => item.status), ["received", "received"]);
  assert.deepEqual(Array.from(kept, (item) => item.receivedDate), ["2026-07-01", "2026-07-03"]);
  for (const collection of ["projects", "jobs", "tasks", "costingLines", "geometries", "quotes", "quoteLines", "payments", "paymentAllocations", "quoteEvents", "statusRecommendations"]) assert.equal(result.workspace.entities[collection].length, 0, collection);
  assert.equal(result.workspace.entities.statusEvents.length, 2);
  assert.ok(result.workspace.entities.statusEvents.every((item) => item.actor === "Status engine" && item.toStatus === "received" && item.reason === ""));
  assert.equal(result.workspace.referenceData.sanitationSentinel.retained, true);
  assert.deepEqual(Array.from(result.report.purgedRegisterIds), ["NSA-APP-INVALID", "NSA-APP-MISSING", "NSA-APP-OLD"]);
  assert.doesNotThrow(() => model.assertValid(result.workspace));

  const repeated = model.sanitizeRegisterBaseline(result.workspace, { at: "2026-09-13T01:00:00.000Z" });
  assert.equal(repeated.changed, false);
  assert.deepEqual(JSON.parse(JSON.stringify(repeated.workspace)), JSON.parse(JSON.stringify(result.workspace)));
});

test("Event dateReceived is retained and future pre-cutoff records remain backwards compatible", () => {
  const { model, status } = load("EVT");
  const ws = unsanitized(model, "2026-09-12T00:00:00.000Z");
  ws.entities.events.push(
    { id: "EVT-EVENT-KEEP", owner: "EVT", type: "event", dateReceived: "01/07/2026", status: "report_sent", provenance: {} },
    { id: "EVT-EVENT-NODATE", owner: "EVT", type: "event", status: "received", provenance: {} }
  );
  const cleaned = model.sanitizeRegisterBaseline(ws, { at: "2026-09-12T02:00:00.000Z" }).workspace;
  assert.deepEqual(Array.from(cleaned.entities.events, (item) => item.id), ["EVT-EVENT-KEEP"]);
  assert.equal(cleaned.entities.events[0].receivedDate, "2026-07-01");
  assert.equal(cleaned.entities.events[0].dateReceived, "2026-07-01");
  assert.equal(cleaned.entities.events[0].status, "received");

  const before = JSON.parse(JSON.stringify(cleaned));
  const laterImport = JSON.parse(JSON.stringify(cleaned));
  laterImport.entities.events.push({ id: "EVT-EVENT-HISTORIC", owner: "EVT", type: "event", dateReceived: "2025-05-01", status: "received", provenance: {} });
  const reconciled = status.reconcileMutation(before, laterImport, { source: "automatic", action: "Register imported", at: "2026-09-12T03:00:00.000Z" });
  const repeated = model.sanitizeRegisterBaseline(reconciled, { at: "2026-09-12T04:00:00.000Z" });
  assert.equal(repeated.changed, false);
  assert.ok(repeated.workspace.entities.events.some((item) => item.id === "EVT-EVENT-HISTORIC"));
  assert.ok(repeated.workspace.entities.statusEvents.some((item) => item.entityId === "EVT-EVENT-HISTORIC" && item.toStatus === "received"));
  assert.doesNotThrow(() => model.assertValid(repeated.workspace));
});
