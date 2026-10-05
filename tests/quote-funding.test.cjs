"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
function load(owner = "NSA") {
  const context = { console, structuredClone, URLSearchParams, crypto };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: owner === "NSA" ? "uos.horticulture.nsa" : "uos.horticulture.events", owner, workspaceKind: owner }) } };
  vm.createContext(context);
  for (const file of ["status.js", "default-rate-catalog.js", "model.js", "funding-model.js", "quote-model.js", "reports-model.js"]) vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context);
  return context.UOS;
}
function fixture(UOS, owner, allocation = 40) {
  const ws = UOS.ProgramModel.blank();
  const parentId = owner + (owner === "NSA" ? "-APP-FUNDING" : "-EVENT-FUNDING"), projectId = owner + "-PROJ-FUNDING";
  ws.entities[owner === "NSA" ? "applications" : "events"].push({ id: parentId, owner, type: owner === "NSA" ? "application" : "event", title: "Funding work", status: owner === "NSA" ? "received" : "enquiry", dateReceived: "2026-10-01" });
  ws.entities.projects.push({ id: projectId, owner, type: "project", [owner === "NSA" ? "applicationId" : "eventId"]: parentId, funding: { operationalAmount: allocation } });
  // Costing-only Labour has no Job and must count without Scheduler use.
  ws.entities.costingLines.push({ id: owner + "-COST-FUNDING", owner, type: "costingLine", projectId, jobId: null, kind: "Labour", description: "Costing-only labour", quantity: 2, unitRate: 50, estimatedTotal: 100 });
  return { ws, projectId };
}
function save(UOS, ws, projectId, values = {}) {
  return UOS.ProgramQuotes.saveDraft(ws, { projectId, quoteDate: "2026-10-01", scopeNotes: "Delivery of horticultural work", ...values });
}
for (const owner of ["NSA", "EVT"]) {
  test(`${owner}: three funding arrangements, exact coverage, shortfall and surplus`, () => {
    const UOS = load(owner), Q = UOS.ProgramQuotes, F = UOS.ProjectFunding;
    let { ws, projectId } = fixture(UOS, owner);
    ws = save(UOS, ws, projectId);
    let quote = ws.entities.quotes[0];
    assert.equal(quote.fundingMode, "customer");
    assert.equal(F.deliveryCost(ws, projectId), 100);
    let position = F.position(ws, projectId, { quote });
    assert.equal(position.operationalAmount, 0);
    assert.equal(position.availableCityAllocation, 40);
    assert.equal(position.fundingGap, 0);
    assert.equal(Q.customerAmounts(quote).payable, 110);
    ws = save(UOS, ws, projectId, { id: quote.id, fundingMode: "mixed" });
    quote = ws.entities.quotes[0];
    assert.equal(quote.proposedCustomerContribution, 60);
    assert.equal(Q.customerAmounts(quote).payable, 66);
    assert.equal(F.position(ws, projectId, { quote }).fundingPosition, 0);
    ws = save(UOS, ws, projectId, { id: quote.id, proposedCustomerContribution: 59.99 });
    assert.throws(() => Q.issue(ws, quote.id), /funding gap/i);
    ws = save(UOS, ws, projectId, { id: quote.id, proposedCustomerContribution: 70 });
    assert.equal(F.position(ws, projectId, { quote: ws.entities.quotes[0] }).fundingSurplus, 10);
    ws = Q.issue(ws, quote.id);
    assert.equal(F.position(ws, projectId).customerAgreementStatus, "Awaiting acceptance");
    assert.equal(F.position(ws, projectId).confirmedCustomerFunding, 0);
    ws = Q.accept(ws, quote.id);
    assert.equal(F.position(ws, projectId).confirmedCustomerFunding, 70);
    assert.equal(F.position(ws, projectId).customerAgreementStatus, "Accepted");
    assert.equal(UOS.ProgramReportsModel.summarize(ws).fundingPositions[0].customerGrandTotal, 77);
    assert.equal(ws.entities.projects[0].funding.operationalAmount, 40);
  });
  test(`${owner}: City coverage, zero customer GST/payable and payment command prohibition`, () => {
    const UOS = load(owner), Q = UOS.ProgramQuotes;
    let { ws, projectId } = fixture(UOS, owner, 100);
    ws = save(UOS, ws, projectId, { fundingMode: "city" });
    const quote = ws.entities.quotes[0];
    assert.equal(quote.grandTotal, 110);
    assert.deepEqual(JSON.parse(JSON.stringify(Q.customerAmounts(quote))), { contribution: 0, gst: 0, payable: 0 });
    for (const method of ["Bank transfer", "Paid with Deposit"]) assert.throws(() => Q.recordPayment(ws, { quoteId: quote.id, method, amount: 10, reference: "Payment", paymentDate: "2026-10-01" }), /No customer payment required/);
    assert.equal(Q.paymentSummary(ws, quote.id).status, "No customer payment required");
    ws = Q.issue(ws, quote.id);
    assert.equal(Q.paymentSummary(ws, quote.id).balanceDue, 0);
    assert.throws(() => save(UOS, ws, projectId, { id: quote.id, fundingMode: "customer" }), /stable snapshot/);
    ws = Q.createRevision(ws, quote.id);
    assert.equal(ws.entities.quotes[1].fundingMode, "city");
    ws.entities.projects[0].funding.operationalAmount = 99.99;
    assert.throws(() => Q.issue(ws, ws.entities.quotes[1].id), /funding gap/i);
  });
  test(`${owner}: genuine surpluses in each mode preserve City allocation and customer offers`, () => {
    const UOS = load(owner), Q = UOS.ProgramQuotes, F = UOS.ProjectFunding;
    for (const fundingMode of ['city', 'customer', 'mixed']) {
      let { ws, projectId } = fixture(UOS, owner, 130);
      ws = save(UOS, ws, projectId, { fundingMode, contingencyRate: 20, proposedCustomerContribution: fundingMode === 'mixed' ? 20 : undefined });
      const quote = ws.entities.quotes[0], position = F.position(ws, projectId, { quote });
      assert.equal(position.fundingSurplus, fundingMode === 'city' ? 30 : fundingMode === 'customer' ? 20 : 50);
      assert.equal(ws.entities.projects[0].funding.operationalAmount, 130);
      ws = Q.issue(ws, quote.id);
      if (fundingMode === 'mixed') assert.equal(ws.entities.quotes[0].proposedCustomerContribution, 20);
      if (fundingMode === 'customer') assert.equal(Q.customerAmounts(ws.entities.quotes[0]).payable, 132);
    }
  });
  test(`${owner}: suggestions are explicit; overrides survive reload, refresh and revision`, () => {
    const UOS = load(owner), Q = UOS.ProgramQuotes;
    let { ws, projectId } = fixture(UOS, owner);
    ws = save(UOS, ws, projectId, { fundingMode: "mixed", contingencyRate: 20, discountRate: 10 });
    let quote = ws.entities.quotes[0];
    assert.equal(quote.proposedCustomerContribution, 70);
    ws = save(UOS, ws, projectId, { id: quote.id, proposedCustomerContribution: 150 });
    ws = UOS.ProgramModel.normalize(JSON.parse(JSON.stringify(ws)));
    ws.entities.costingLines[0].estimatedTotal = 120;
    ws.entities.projects[0].funding.operationalAmount = 50;
    ws = Q.refreshDraftFromCurrentCosts(ws, quote.id, { confirmed: true });
    quote = ws.entities.quotes[0];
    assert.equal(quote.proposedCustomerContribution, 150);
    assert.equal(Q.suggestedContribution(quote, 50), 84);
    ws = save(UOS, ws, projectId, { id: quote.id, proposedCustomerContribution: Q.suggestedContribution(quote, 50) });
    ws = Q.issue(ws, quote.id);
    const snapshot = JSON.stringify(Q.commercialProjection(ws, quote.id));
    ws.entities.projects[0].funding.operationalAmount = 60;
    ws.entities.costingLines[0].estimatedTotal = 180;
    ws = Q.createRevision(ws, quote.id);
    assert.equal(ws.entities.quotes[1].proposedCustomerContribution, 84);
    assert.equal(ws.entities.quotes[1].fundingMode, "mixed");
    assert.equal(JSON.stringify(Q.commercialProjection(ws, quote.id)), snapshot);
    assert.equal(ws.entities.quotes[0].cityFundingAmount, 50);
    assert.equal(ws.entities.quotes[0].estimatedDeliveryCost, 120);
  });
}
test("Customer-only shortfalls cannot use City allocation; declines are not confirmed funding", () => {
  const UOS = load(), Q = UOS.ProgramQuotes, F = UOS.ProjectFunding;
  let { ws, projectId } = fixture(UOS, "NSA", 500);
  ws = save(UOS, ws, projectId, { discountRate: 10 });
  const quote = ws.entities.quotes[0];
  assert.throws(() => Q.issue(ws, quote.id), /funding gap/i);
  ws = save(UOS, ws, projectId, { id: quote.id, discountRate: 0, discountAmount: 0 });
  ws = Q.issue(ws, quote.id);
  ws = Q.decline(ws, quote.id);
  assert.equal(F.position(ws, projectId, { quote: ws.entities.quotes[0] }).confirmedCustomerFunding, 0);
  assert.equal(F.position(ws, projectId, { quote: ws.entities.quotes[0] }).customerQuote, 100);
  assert.equal(Q.agreementStatus(ws.entities.quotes[0]), "Declined");
});
test("Funding commercial values lock with deposits/allocations and unlock after reversal", () => {
  const UOS = load(), Q = UOS.ProgramQuotes;
  let { ws, projectId } = fixture(UOS, "NSA");
  ws = save(UOS, ws, projectId, { fundingMode: "mixed", proposedCustomerContribution: 60 });
  const quote = ws.entities.quotes[0];
  ws = Q.recordPayment(ws, { quoteId: quote.id, amount: 20, method: "Paid with Deposit", reference: "Deposit", paymentDate: "2026-10-01", allocations: [{ quoteLineId: ws.entities.quoteLines[0].id, amount: 20 }] });
  assert.equal(Q.paymentSummary(ws, quote.id).balanceDue, 46);
  assert.throws(() => save(UOS, ws, projectId, { id: quote.id, fundingMode: "city" }), /Reverse active payments/);
  assert.throws(() => save(UOS, ws, projectId, { id: quote.id, proposedCustomerContribution: 80 }), /Reverse active payments/);
  assert.equal(ws.entities.paymentAllocations[0].status, "Active");
  assert.equal(Q.commerciallyLocked(ws, quote.id), true);
  ws = Q.reversePayment(ws, ws.entities.payments[0].id, "Customer cancelled deposit");
  ws = save(UOS, ws, projectId, { id: quote.id, fundingMode: "city" });
  assert.equal(Q.paymentSummary(ws, quote.id).balanceDue, 0);
  assert.equal(ws.entities.payments[0].status, "Reversed");
});
test("Legacy Drafts and revisions require selection; existing issued amounts and projections survive", () => {
  const UOS = load(), Q = UOS.ProgramQuotes;
  let { ws, projectId } = fixture(UOS, "NSA");
  ws = save(UOS, ws, projectId);
  const quote = ws.entities.quotes[0];
  delete quote.fundingMode; delete quote.proposedCustomerContribution;
  const legacyProjection = JSON.stringify(Q.commercialProjection(ws, quote.id));
  assert.equal(Q.customerAmounts(quote).payable, 110);
  ws = save(UOS, ws, projectId, { id: quote.id });
  assert.throws(() => Q.issue(ws, quote.id), /Choose a funding arrangement/);
  ws.entities.quotes[0].status = "Issued";
  assert.equal(JSON.stringify(Q.commercialProjection(ws, quote.id)), legacyProjection);
  ws = Q.createRevision(ws, quote.id);
  assert.equal(ws.entities.quotes[1].fundingMode, null);
  assert.throws(() => Q.issue(ws, ws.entities.quotes[1].id), /Choose a funding arrangement/);
});
