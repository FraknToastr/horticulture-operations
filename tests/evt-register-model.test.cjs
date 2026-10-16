const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function load(owner = "EVT") {
  const context = { console, structuredClone, TextEncoder, TextDecoder, URLSearchParams, setTimeout, clearTimeout };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: owner === "EVT" ? "uos.horticulture.events" : "uos.horticulture.nsa", workspaceKind: owner, owner }) } };
  vm.createContext(context);
  for (const file of ["status.js", "default-rate-catalog.js", "model.js", "status-model.js"]) {
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file });
  }
  return context.UOS.ProgramModel;
}
function event(id, fields = {}) {
  return { id: `EVT-EVENT-${id}`, owner: "EVT", type: "event", title: `Event ${id}`, status: "received", ...fields };
}
function workspace(model, records) {
  const output = model.blank("2026-10-16T00:00:00.000Z");
  output.entities.events = records;
  return output;
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }

test("EVT identity migration preserves unique legacy references and their original fields", () => {
  const model = load();
  const records = [event("TOP", { jobId: "EVT-LEGACY-31", eventNumber: "Original alternate", councilEventNumber: "COA-0042" }), event("PAYLOAD", { payload: { eventNumber: "EVT-LEGACY-32" } })];
  const input = workspace(model, records);
  input.entities.projects.push({ id: "EVT-PROJ-TOP", type: "project", owner: "EVT", eventId: records[0].id, status: "active" });
  const output = model.normalize(input);
  const [first, second] = output.entities.events;
  assert.equal(first.id, records[0].id);
  assert.equal(first.eventAuditId, "EVT-LEGACY-31");
  assert.equal(first.eventIdentityVersion, 1);
  assert.equal(first.eventIdentityMigration.reason, "legacy-reference");
  assert.deepEqual(plain(first.eventIdentityMigration.originalReferences), { jobId: "EVT-LEGACY-31", eventNumber: "Original alternate" });
  assert.equal(first.jobId, "EVT-LEGACY-31");
  assert.equal(first.eventNumber, "Original alternate");
  assert.equal(first.councilEventNumber, "COA-0042");
  assert.equal(second.eventAuditId, "EVT-LEGACY-32");
  assert.equal(second.payload.eventNumber, "EVT-LEGACY-32");
  assert.equal(output.entities.projects[0].eventId, records[0].id);
  assert.equal(input.entities.events[0].eventIdentityVersion, undefined, "normalization must not mutate imported data");
});

test("missing and duplicated legacy references fall back to stable record IDs regardless of order", () => {
  const model = load();
  const records = [event("A", { jobId: "duplicated" }), event("B", { payload: { eventNumber: "duplicated" } }), event("MISSING", { projectId: "EVT-PROJ-DO-NOT-USE" })];
  function identities(list) {
    return model.normalize(workspace(model, list)).entities.events.map(row => ({ id: row.id, eventAuditId: row.eventAuditId, reason: row.eventIdentityMigration.reason })).sort((a, b) => a.id.localeCompare(b.id));
  }
  const forward = identities(records);
  assert.deepEqual(forward, identities(records.slice().reverse()));
  assert.ok(forward.every(row => row.eventAuditId === row.id));
  assert.equal(forward.find(row => row.id.endsWith("A")).reason, "record-id-duplicate-reference");
  assert.equal(forward.find(row => row.id.endsWith("MISSING")).reason, "record-id-missing-reference");
});

test("new identity candidates cannot collide with another record ID or assigned Event ID", () => {
  const model = load();
  let output = model.normalize(workspace(model, [event("ASSIGNED", { jobId: "reserved" }), event("OTHER")]));
  output.entities.events.push(event("COLLISION", { jobId: "reserved" }), event("RECORD-COLLISION", { eventNumber: "EVT-EVENT-OTHER" }));
  output = model.normalize(output);
  for (const suffix of ["COLLISION", "RECORD-COLLISION"]) {
    const row = output.entities.events.find(item => item.id === `EVT-EVENT-${suffix}`);
    assert.equal(row.eventAuditId, row.id);
    assert.equal(row.eventIdentityMigration.reason, suffix === "COLLISION" ? "record-id-duplicate-reference" : "record-id-conflicting-reference");
  }
  assert.equal(output.entities.events[0].eventAuditId, "reserved");
});

test("later legacy imports cannot adopt a reference already duplicated in migrated Events", () => {
  const model = load();
  let output = model.normalize(workspace(model, [event("A", { jobId: "old-duplicate" }), event("B", { jobId: "old-duplicate" })]));
  const identities = output.entities.events.map(row => row.eventAuditId);
  output.entities.events[0].jobId = "edited legacy alias";
  output.entities.events.push(event("LATER", { eventNumber: "old-duplicate" }));
  output = model.normalize(output);
  assert.deepEqual(output.entities.events.slice(0, 2).map(row => row.eventAuditId), identities);
  assert.equal(output.entities.events[2].eventAuditId, "EVT-EVENT-LATER");
  assert.equal(output.entities.events[2].eventIdentityMigration.reason, "record-id-duplicate-reference");
});

test("nested legacy work data is preserved without being converted to an Event ID", () => {
  const model = load();
  const output = model.normalize(workspace(model, [event("OBJECT", { job: { title: "delivery" }, eventNumber: "VALID-REF" }), event("NO-REF", { job: { title: "delivery" } })]));
  assert.equal(output.entities.events[0].eventAuditId, "VALID-REF");
  assert.equal(output.entities.events[1].eventAuditId, "EVT-EVENT-NO-REF");
  assert.deepEqual(plain(output.entities.events[0].eventIdentityMigration.originalReferences.job), { title: "delivery" });
});

test("identity migration is idempotent and retains originals after Council number edits and transport", () => {
  const model = load();
  let output = model.normalize(workspace(model, [event("SAVED", { jobNumber: "EVT-INTERNAL-8", bumpInDate: "2026-10-17", bumpOutDate: "2026-10-19" })]));
  const original = plain(output.entities.events[0].eventIdentityMigration);
  assert.deepEqual(plain(model.normalize(output)), plain(output));
  output = model.updateRecord(output, "EVT-EVENT-SAVED", { councilEventNumber: " COA-2026-81 " }, "2026-10-16T00:10:00.000Z").workspace;
  output.entities.events[0].jobNumber = "updated legacy field";
  const restored = model.importJson(model.exportJson(output));
  const row = restored.entities.events[0];
  assert.equal(row.eventAuditId, "EVT-INTERNAL-8");
  assert.equal(row.councilEventNumber, "COA-2026-81");
  assert.equal(row.bumpInDate, "2026-10-17");
  assert.equal(row.bumpOutDate, "2026-10-19");
  assert.deepEqual(plain(row.eventIdentityMigration), original);
  assert.equal(row.jobNumber, "updated legacy field");
  assert.throws(() => model.updateRecord(restored, row.id, { eventAuditId: "changed" }), /not editable/);
  row.eventAuditId = "changed";
  assert.throws(() => model.normalize(restored), /Event ID is immutable/);
});

test("EVT milestone dates are optional and validate real ISO dates and date order", () => {
  const model = load();
  for (const fields of [{}, { bumpInDate: "2026-10-16" }, { bumpOutDate: "2026-10-16" }, { bumpInDate: "2026-10-16", bumpOutDate: "2026-10-16" }, { bumpInDate: "2028-02-29", bumpOutDate: "2028-03-01" }]) {
    assert.equal(model.validateEventDates(event("DATES", fields)).length, 0);
    assert.doesNotThrow(() => model.normalize(workspace(model, [event("DATES", fields)])));
  }
  for (const invalid of ["2026-02-29", "2026-02-30", "2026-13-01", "16/10/2026", "2026-10-16T00:00:00Z", 0, false]) {
    assert.match(model.validateEventDates(event("DATES", { bumpInDate: invalid })).join(" "), /Bump-in.*valid date/);
    assert.throws(() => model.normalize(workspace(model, [event("DATES", { bumpOutDate: invalid })])), /Bump-out.*valid date/);
  }
  assert.match(model.validateEventDates(event("DATES", { bumpInDate: "2026-10-17", bumpOutDate: "2026-10-16" })).join(" "), /cannot be before/);
});

test("only explicit EVT bump fields migrate, and clearing fields persists without reviving aliases", () => {
  const model = load();
  let output = model.normalize(workspace(model, [event("DATES", { startDate: "2026-10-12", endDate: "2026-10-16", payload: { eventBumpInDate: "2026-10-10", bump_out_date: "2026-10-17" } }), event("NO-DATES", { startDate: "2026-10-12", endDate: "2026-10-16" })]));
  assert.equal(output.entities.events[0].bumpInDate, "2026-10-10");
  assert.equal(output.entities.events[0].bumpOutDate, "2026-10-17");
  assert.equal(output.entities.events[1].bumpInDate, undefined);
  assert.equal(output.entities.events[1].bumpOutDate, undefined);
  output = model.updateRecord(output, "EVT-EVENT-DATES", { bumpInDate: "", bumpOutDate: "" }).workspace;
  const restored = model.importJson(model.exportJson(output));
  assert.equal(restored.entities.events[0].bumpInDate, "");
  assert.equal(restored.entities.events[0].bumpOutDate, "");
});

test("EVT-specific editable fields and identity metadata are not added to NSA", () => {
  const model = load("NSA");
  let output = model.blank("2026-10-16T00:00:00.000Z");
  output.entities.applications.push({ id: "NSA-APP-DATES", owner: "NSA", type: "application", title: "NSA", status: "received" });
  output = model.normalize(output);
  const row = output.entities.applications[0];
  for (const key of ["eventAuditId", "eventIdentityVersion", "councilEventNumber", "bumpInDate", "bumpOutDate"]) assert.equal(Object.hasOwn(row, key), false);
  for (const key of ["councilEventNumber", "bumpInDate", "bumpOutDate"]) assert.throws(() => model.updateRecord(output, row.id, { [key]: "2026-10-16" }), /not editable/);
  assert.equal(model.validateEventDates({ ...row, bumpInDate: "invalid" }).length, 0);
});
