"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function load(owner) {
  const context = { console, structuredClone, URLSearchParams, crypto };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: owner === "NSA" ? "uos.horticulture.nsa" : "uos.horticulture.events", owner, workspaceKind: owner }) } };
  vm.createContext(context);
  for (const file of ["status.js", "default-rate-catalog.js", "model.js", "funding-model.js", "quote-model.js"])
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context);
  return context.UOS;
}

function fixture(UOS, owner) {
  let ws = UOS.ProgramModel.blank();
  const recordId = `${owner}-${owner === "NSA" ? "APP" : "EVENT"}-ATTRIBUTION`;
  const projectId = `${owner}-PROJ-ATTRIBUTION`;
  ws.entities[owner === "NSA" ? "applications" : "events"].push({ id: recordId, owner, title: "Receipt attribution test", status: "received", dateReceived: "2026-10-18" });
  ws.entities.projects.push({ id: projectId, owner, type: "project", [owner === "NSA" ? "applicationId" : "eventId"]: recordId, funding: { operationalAmount: 0 } });
  ws.entities.costingLines.push({ id: `${owner}-COST-ATTRIBUTION`, owner, type: "costingLine", projectId, kind: "Material", description: "Receipt test work", quantity: 1, unitRate: 100, estimatedTotal: 100 });
  ws = UOS.ProgramQuotes.saveDraft(ws, { projectId, quoteDate: "2026-10-18", scopeNotes: "Receipt attribution test", fundingMode: "customer" });
  const quoteId = ws.entities.quotes[0].id;
  ws = UOS.ProgramQuotes.recordPayment(ws, { quoteId, amount: 20, paymentDate: "2026-10-18", method: "Paid with Deposit", reference: "ATTRIBUTION", allocations: [{ quoteLineId: ws.entities.quoteLines[0].id, amount: 20 }] });
  return { ws, quoteId, paymentId: ws.entities.payments[0].id };
}

for (const owner of ["NSA", "EVT"]) {
  test(`${owner}: new reversal records a trimmed officer and reason without mutating the input`, () => {
    const UOS = load(owner), Q = UOS.ProgramQuotes;
    const { ws, quoteId, paymentId } = fixture(UOS, owner), before = JSON.stringify(ws);
    const result = Q.reversePayment(ws, paymentId, "  Incorrect deposit reference  ", "  Audit Officer  ");
    const payment = result.entities.payments[0];
    assert.equal(payment.reversedBy, "Audit Officer");
    assert.equal(payment.reversalReason, "Incorrect deposit reference");
    assert.equal(payment.status, "Reversed");
    assert.ok(Number.isFinite(Date.parse(payment.reversedAt)));
    assert.equal(result.entities.paymentAllocations[0].status, "Reversed");
    assert.equal(result.entities.paymentAllocations[0].reversedAt, payment.reversedAt);
    assert.equal(Q.paymentSummary(result, quoteId).paid, 0);
    assert.equal(JSON.stringify(ws), before);
  });

  test(`${owner}: missing officer or reason rejects atomically before any receipt or allocation changes`, () => {
    const UOS = load(owner), { ws, paymentId } = fixture(UOS, owner), before = JSON.stringify(ws);
    for (const actor of [undefined, null, "", " \t\n "]) {
      assert.throws(() => UOS.ProgramQuotes.reversePayment(ws, paymentId, "Incorrect receipt", actor), /officer|actor|name|required/i);
      assert.equal(JSON.stringify(ws), before);
    }
    for (const reason of [undefined, null, "", " \t\n "]) {
      assert.throws(() => UOS.ProgramQuotes.reversePayment(ws, paymentId, reason, "Audit Officer"), /reason|required/i);
      assert.equal(JSON.stringify(ws), before);
    }
  });

  test(`${owner}: reversal evidence survives canonical normalization and exported-workspace reload`, () => {
    const UOS = load(owner), { ws, paymentId } = fixture(UOS, owner);
    const reversed = UOS.ProgramQuotes.reversePayment(ws, paymentId, "Incorrect receipt", "Audit Officer");
    const normalized = UOS.ProgramModel.normalize(reversed);
    const exported = UOS.ProgramModel.exportJson(normalized);
    const reloaded = UOS.ProgramModel.importJson(exported);
    const expected = JSON.stringify(normalized.entities.payments[0]);
    assert.equal(JSON.stringify(reloaded.entities.payments[0]), expected);
    assert.equal(reloaded.entities.payments[0].reversedBy, "Audit Officer");
    assert.equal(JSON.stringify(UOS.ProgramModel.normalize(reloaded)), JSON.stringify(reloaded));
    // Canonical imports trim real recorded values but never infer an officer.
    reloaded.entities.payments[0].reversedBy = "  Audit Officer  ";
    assert.equal(UOS.ProgramModel.normalize(reloaded).entities.payments[0].reversedBy, "Audit Officer");
  });

  test(`${owner}: repeated reversal preserves the first evidence before validating new arguments`, () => {
    const UOS = load(owner), { ws, paymentId } = fixture(UOS, owner);
    const reversed = UOS.ProgramQuotes.reversePayment(ws, paymentId, "First recorded reason", "First Officer");
    const before = JSON.stringify(reversed);
    for (const args of [["Replacement reason", "Second Officer"], ["", ""], [undefined, undefined]]) {
      assert.equal(JSON.stringify(UOS.ProgramQuotes.reversePayment(reversed, paymentId, ...args)), before);
    }
  });

  test(`${owner}: legacy reversal reload and repeated commands retain missing historical attribution`, () => {
    const UOS = load(owner), { ws, paymentId } = fixture(UOS, owner);
    const legacy = UOS.ProgramQuotes.reversePayment(ws, paymentId, "Historical reason", "Synthetic seed officer");
    delete legacy.entities.payments[0].reversedBy;
    legacy.entities.payments[0].reversedAt = "2026-09-01T08:00:00.000Z";
    const loaded = UOS.ProgramModel.importJson(UOS.ProgramModel.exportJson(legacy));
    assert.equal(loaded.entities.payments[0].reversedBy || "", "");
    assert.equal(Object.hasOwn(loaded.entities.payments[0], "reversedBy"), false);
    const before = JSON.stringify(loaded);
    const repeated = UOS.ProgramQuotes.reversePayment(loaded, paymentId, "New reason", "Current Officer");
    assert.equal(JSON.stringify(repeated), before);
    assert.equal(repeated.entities.payments[0].reversalReason, "Historical reason");
    assert.equal(repeated.entities.payments[0].reversedAt, "2026-09-01T08:00:00.000Z");
    assert.equal(repeated.entities.payments[0].reversedBy || "", "");
    assert.equal(Object.hasOwn(repeated.entities.payments[0], "reversedBy"), false);
  });
}
