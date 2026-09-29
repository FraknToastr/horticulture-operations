const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function api(owner = "NSA") {
  const context = { console, structuredClone, TextEncoder, TextDecoder, URLSearchParams, setTimeout, clearTimeout };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => owner ? ({ appId: "uos.horticulture." + owner.toLowerCase(), workspaceKind: owner, owner }) : null } };
  vm.createContext(context);
  for (const file of ["status.js", "default-rate-catalog.js", "model.js", "budget-model.js", "budget-governance.js", "funding-model.js", "reports-model.js"]) {
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file });
  }
  return context.UOS;
}
const decision = { actor: "Officer A", approver: "Officer A", reason: "Approved work", evidence: "Council record 42", date: "2026-09-29", at: "2026-09-29T01:00:00Z" };
function record(id, receipt = "R-1") { return { id, owner: "NSA", type: "application", title: id, receipt, status: "received", dateReceived: "2026-09-29", provenance: {} }; }
function setup() {
  const UOS = api();
  let ws = UOS.ProgramModel.blank("2026-09-29T00:00:00Z");
  ws.entities.applications.push(record("NSA-APP-A"), record("NSA-APP-B", "R-2"));
  ws = UOS.ProgramBudget.createAnnualBudget(ws, { owner: "NSA", financialYear: "2026-27" });
  const budgetId = ws.entities.annualBudgets[0].id;
  ws = UOS.ProgramBudget.approveAnnualBudget(ws, budgetId, { ...decision, amount: "1000.00" });
  return { UOS, ws, budgetId };
}

test("annual approval and Register allocation capture exact cents and the reference at decision time", () => {
  let { UOS, ws, budgetId } = setup();
  const budget = ws.entities.annualBudgets[0];
  assert.equal(budget.yearStart, "2026-07-01");
  assert.equal(budget.yearEnd, "2027-06-30");
  assert.equal(budget.approvedAmountCents, 100000);
  assert.equal(ws.entities.budgetEntries[0].amountCents, 100000);
  assert.equal(ws.entities.budgetEntries[0].registerId, "");
  ws = UOS.ProgramBudget.adjustAllocation(ws, budgetId, "NSA-APP-A", { ...decision, amount: "0.01" });
  const entry = ws.entities.allocationEntries[0];
  assert.equal(entry.amountCents, 1);
  assert.equal(entry.registerId, "NSA-APP-A");
  assert.equal(entry.referenceNumber, "R-1");
  assert.equal(entry.recorder, "Officer A");
  assert.equal(entry.approver, "Officer A");
  ws.entities.applications[0].receipt = "R-CHANGED";
  const restored = UOS.ProgramModel.importJson(UOS.ProgramModel.exportJson(ws));
  assert.equal(restored.entities.allocationEntries[0].referenceNumber, "R-1");
  assert.equal(UOS.ProgramBudget.budgetBalance(restored, budgetId).allocatedCents, 1);
});

test("pending and rejected changes have no balance effect; a later approval posts once", () => {
  let { UOS, ws, budgetId } = setup();
  ws = UOS.ProgramBudget.allocateOrDraft(ws, budgetId, "NSA-APP-A", { ...decision, amount: "10.05", saveDraft: true });
  const requestId = ws.entities.budgetChangeRequests.at(-1).id;
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, budgetId).allocatedCents, 0);
  ws = UOS.ProgramBudget.decideRequest(ws, requestId, { decision: "rejected", approver: "Officer B", evidence: "Rejected scope" });
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, budgetId).allocatedCents, 0);
  assert.throws(() => UOS.ProgramBudget.decideRequest(ws, requestId, { decision: "approved", approver: "Officer B", evidence: "Second decision" }), /already decided/);
  ws = UOS.ProgramBudget.allocateOrDraft(ws, budgetId, "NSA-APP-A", { ...decision, amount: "10.05", saveDraft: true });
  ws = UOS.ProgramBudget.decideRequest(ws, ws.entities.budgetChangeRequests.at(-1).id, { decision: "approved", approver: "Officer B", evidence: "Approved scope" });
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, budgetId).allocatedCents, 1005);
  assert.equal(ws.entities.allocationEntries.length, 1);
});

test("transfer posts linked debit and credit together and protects available funds", () => {
  let { UOS, ws, budgetId } = setup();
  ws = UOS.ProgramBudget.adjustAllocation(ws, budgetId, "NSA-APP-A", { ...decision, amount: "100.03" });
  const before = JSON.stringify(ws);
  assert.throws(() => UOS.ProgramBudget.transferAllocation(ws, budgetId, "NSA-APP-A", "NSA-APP-B", { ...decision, amount: "100.04" }), /uncommitted/);
  assert.equal(JSON.stringify(ws), before);
  ws = UOS.ProgramBudget.transferAllocation(ws, budgetId, "NSA-APP-A", "NSA-APP-B", { ...decision, amount: "10.01" });
  const pair = ws.entities.allocationEntries.slice(-2);
  assert.equal(pair[0].amountCents, -1001);
  assert.equal(pair[1].amountCents, 1001);
  assert.equal(pair[0].counterpartEntryId, pair[1].id);
  assert.equal(pair[1].counterpartEntryId, pair[0].id);
  assert.equal(pair[1].referenceNumber, "R-2");
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, budgetId).allocatedCents, 10003);
  const tampered = JSON.parse(JSON.stringify(ws));
  tampered.entities.allocationEntries.pop();
  assert.throws(() => UOS.ProgramModel.importJson(tampered), /incomplete transfer/);
});

test("signed annual adjustments reconcile authority in cents without rewriting approval", () => {
  let { UOS, ws, budgetId } = setup();
  const approvalEntryId = ws.entities.budgetEntries[0].id;
  ws = UOS.ProgramBudget.adjustAnnualBudget(ws, budgetId, { ...decision, kind: "supplement", amount: "0.07" });
  ws = UOS.ProgramBudget.adjustAnnualBudget(ws, budgetId, { ...decision, kind: "reduction", amount: "-0.03" });
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, budgetId).approvedCents, 100004);
  assert.equal(ws.entities.budgetEntries[0].id, approvalEntryId);
  assert.deepEqual(ws.entities.budgetEntries.slice(1).map((row) => row.amountCents), [7, -3]);
  assert.equal(ws.entities.budgetEntries[2].predecessorId, ws.entities.budgetEntries[1].id);
});

test("actual charge releases only the selected Job's outstanding commitment", () => {
  let { UOS, ws, budgetId } = setup();
  ws = UOS.ProgramBudget.adjustAllocation(ws, budgetId, "NSA-APP-A", { ...decision, amount: "200.00" });
  const allocationId = ws.entities.registerAllocations[0].id;
  const promoted = UOS.ProgramModel.promoteRegisterRecord(ws, "NSA-APP-A");
  ws = promoted.workspace;
  for (const [id, estimate, actualCost] of [["NSA-JOB-A", 50, 80], ["NSA-JOB-B", 70, 0]]) {
    ws.entities.jobs.push({ id, owner: "NSA", type: "job", projectId: promoted.project.id, applicationId: "NSA-APP-A", financialYear: "2026-27", sourceKind: "calculator", sourceEntityId: id, title: id, status: "Draft", estimate, actualCost, provenance: {} });
  }
  ws = UOS.ProgramModel.normalize(ws);
  assert.equal(UOS.ProgramBudget.allocationBalance(ws, allocationId).plannedCostCents, 12000);
  assert.equal(UOS.ProgramBudget.allocationBalance(ws, allocationId).forecastCents, 12000);
  assert.equal(UOS.ProgramBudget.allocationBalance(ws, allocationId).availableCents, 20000);
  ws = UOS.ProgramBudget.chargeJob(ws, allocationId, "NSA-JOB-A", { ...decision, kind: "commitment", amount: 50 });
  ws = UOS.ProgramBudget.chargeJob(ws, allocationId, "NSA-JOB-B", { ...decision, kind: "commitment", amount: 70 });
  ws = UOS.ProgramBudget.chargeJob(ws, allocationId, "NSA-JOB-A", { ...decision, kind: "actual", amount: 80 });
  const released = ws.entities.budgetCharges.filter((entry) => entry.kind === "release" && entry.jobId === "NSA-JOB-A");
  assert.equal(released.length, 1);
  assert.equal(released[0].amountCents, 5000);
  assert.equal(UOS.ProgramBudget.allocationBalance(ws, allocationId).committedCents, 7000);
  assert.throws(() => UOS.ProgramBudget.releaseJobCommitment(ws, allocationId, "NSA-JOB-A", { ...decision, amount: 1 }), /open commitment/);
});

test("closed year requires prior reopen decision; Yes and No reviews leave source unchanged", () => {
  let { UOS, ws, budgetId } = setup();
  ws = UOS.ProgramBudget.adjustAllocation(ws, budgetId, "NSA-APP-A", { ...decision, amount: 700 });
  const sourceId = ws.entities.registerAllocations[0].id;
  ws = UOS.ProgramBudget.closeYear(ws, budgetId, decision);
  assert.throws(() => UOS.ProgramBudget.reopenYear(ws, budgetId, decision), /separately recorded/);
  ws = UOS.ProgramBudget.recordCarryReview(ws, sourceId, "No", decision);
  assert.equal(ws.entities.budgetCarryReviews.at(-1).answer, "No");
  assert.equal(ws.entities.allocationEntries.length, 1);
  ws = UOS.ProgramBudget.recordCarryReview(ws, sourceId, "Yes", decision);
  assert.equal(ws.entities.allocationEntries.length, 1);
  ws = UOS.ProgramBudget.createAnnualBudget(ws, { owner: "NSA", financialYear: "2027-28" });
  const nextId = ws.entities.annualBudgets.find((row) => row.financialYear === "2027-28").id;
  ws = UOS.ProgramBudget.approveAnnualBudget(ws, nextId, { ...decision, amount: 0 });
  ws = UOS.ProgramBudget.carryForward(ws, sourceId, nextId, { ...decision, amount: 100, verifiedUnspentEvidence: "Reconciled close balance", saveDraft: true });
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, nextId).approvedCents, 0);
  ws = UOS.ProgramBudget.decideRequest(ws, ws.entities.budgetChangeRequests.at(-1).id, { decision: "approved", approver: "Officer A", evidence: "Council carry approval" });
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, nextId).approvedCents, 10000);
  assert.equal(ws.entities.annualBudgets.find((row) => row.id === budgetId).status, "closed");
  ws = UOS.ProgramBudget.recordReopenDecision(ws, budgetId, decision);
  const reopenDecisionId = ws.entities.budgetDecisions.at(-1).id;
  assert.equal(ws.entities.annualBudgets.find((row) => row.id === budgetId).status, "closed");
  ws = UOS.ProgramBudget.reopenYear(ws, budgetId, { decisionId: reopenDecisionId });
  assert.equal(ws.entities.annualBudgets.find((row) => row.id === budgetId).status, "open");
  ws = UOS.ProgramBudget.closeYear(ws, budgetId, decision);
  assert.equal(ws.entities.annualBudgets.find((row) => row.id === budgetId).status, "closed");
  assert.equal(ws.entities.budgetEntries.filter((row) => row.budgetId === budgetId && row.kind === "close").length, 2);
});

test("legacy authority remains review required until evidence-backed reconciliation", () => {
  let { UOS, ws, budgetId } = setup();
  ws.entities.annualBudgets[0].approvalDecisionId = "";
  ws.entities.budgetDecisions = [];
  ws.entities.budgetChangeRequests = [];
  ws.entities.budgetEntries[0].governanceVersion = 0;
  ws.entities.budgetEntries[0].decisionId = "";
  delete ws.migration.legacyBudgetEntryIds;
  delete ws.migration.budgetGovernanceVersion;
  ws = UOS.ProgramModel.importJson(ws);
  assert.equal(ws.entities.annualBudgets[0].reviewRequired, true);
  assert.throws(() => UOS.ProgramBudget.adjustAllocation(ws, budgetId, "NSA-APP-A", { ...decision, amount: 1 }), /review required/);
  ws = UOS.ProgramBudget.reconcileYear(ws, budgetId, { ...decision, evidence: "Legacy council file reviewed" });
  assert.equal(ws.entities.annualBudgets[0].reviewRequired, false);
  ws = UOS.ProgramBudget.adjustAllocation(ws, budgetId, "NSA-APP-A", { ...decision, amount: 1 });
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, budgetId).allocatedCents, 100);
});

test("owner and July–June year identities isolate Register allocations", () => {
  const UOS = api(null);
  let ws = UOS.ProgramModel.blank("2026-09-29T00:00:00Z");
  ws.entities.applications.push(record("NSA-APP-OWNER"));
  ws.entities.events.push({ id: "EVT-EVENT-OWNER", owner: "EVT", type: "event", title: "Event", status: "received", dateReceived: "2026-09-29", jobId: "EV-12", provenance: {} });
  ws = UOS.ProgramBudget.createAnnualBudget(ws, { owner: "NSA", financialYear: "2026-27" });
  ws = UOS.ProgramBudget.createAnnualBudget(ws, { owner: "EVT", financialYear: "2026-27" });
  ws = UOS.ProgramBudget.createAnnualBudget(ws, { owner: "NSA", financialYear: "2027-28" });
  const nsa = ws.entities.annualBudgets.find((row) => row.owner === "NSA" && row.financialYear === "2026-27").id;
  const evt = ws.entities.annualBudgets.find((row) => row.owner === "EVT").id;
  const next = ws.entities.annualBudgets.find((row) => row.owner === "NSA" && row.financialYear === "2027-28").id;
  assert.throws(() => UOS.ProgramBudget.createAnnualBudget(ws, { owner: "NSA", financialYear: "2026-27" }), /already exists/);
  ws = UOS.ProgramBudget.approveAnnualBudget(ws, nsa, { ...decision, amount: 100 });
  ws = UOS.ProgramBudget.approveAnnualBudget(ws, evt, { ...decision, amount: 200 });
  ws = UOS.ProgramBudget.approveAnnualBudget(ws, next, { ...decision, amount: 50 });
  ws = UOS.ProgramBudget.adjustAllocation(ws, nsa, "NSA-APP-OWNER", { ...decision, amount: 30 });
  ws = UOS.ProgramBudget.adjustAllocation(ws, next, "NSA-APP-OWNER", { ...decision, amount: 20 });
  ws = UOS.ProgramBudget.adjustAllocation(ws, evt, "EVT-EVENT-OWNER", { ...decision, amount: 40 });
  assert.throws(() => UOS.ProgramBudget.adjustAllocation(ws, nsa, "EVT-EVENT-OWNER", { ...decision, amount: 1 }), /budget owner/);
  assert.equal(ws.entities.registerAllocations.length, 3);
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, nsa).allocatedCents, 3000);
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, evt).allocatedCents, 4000);
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, next).allocatedCents, 2000);
  assert.equal(ws.entities.allocationEntries.find((row) => row.registerId === "EVT-EVENT-OWNER").referenceNumber, "EV-12");
});

test("legacy Project funding remains labelled data outside approved annual authority", () => {
  const UOS = api();
  let ws = UOS.ProgramModel.blank("2026-09-29T00:00:00Z");
  ws.entities.applications.push(record("NSA-APP-LEGACY"));
  ws.entities.projects.push({ id: "NSA-PROJ-LEGACY", owner: "NSA", type: "project", applicationId: "NSA-APP-LEGACY", title: "Legacy Project", status: "Draft", funding: { operationalAmount: 500 }, approvedBudget: 700, provenance: {} });
  ws = UOS.ProgramModel.normalize(ws);
  assert.equal(ws.entities.projects[0].funding.operationalAmount, 500);
  assert.equal(UOS.ProgramModel.finances(ws).approvedBudget, 0);
  assert.equal(UOS.ProgramReportsModel.summarize(ws).finances.approvedBudget, 0);
  const migrated = UOS.ProjectFunding.migrateApprovedBudgets(ws);
  assert.equal(migrated.entities.annualBudgets.length, 0);
  assert.equal(migrated.migration.unresolvedFunding.length, 1);
  assert.equal(UOS.ProjectFunding.finances(migrated).approvedBudget, 0);
});

test("legacy Register-linked entries expose internal ID and unverified historical number", () => {
  let { UOS, ws, budgetId } = setup();
  ws = UOS.ProgramBudget.adjustAllocation(ws, budgetId, "NSA-APP-A", { ...decision, amount: 10 });
  const old = ws.entities.allocationEntries[0];
  old.governanceVersion = 0;
  ws.migration.legacyBudgetEntryIds.push(old.id);
  delete old.registerId;
  delete old.referenceNumber;
  delete old.referenceNumberStatus;
  ws = UOS.ProgramModel.importJson(ws);
  assert.equal(ws.entities.allocationEntries[0].registerId, "NSA-APP-A");
  assert.equal(ws.entities.allocationEntries[0].referenceNumberStatus, "unverified legacy");
});

test("import rejects a governed financial posting after year closure", () => {
  let { UOS, ws, budgetId } = setup();
  ws = UOS.ProgramBudget.adjustAllocation(ws, budgetId, "NSA-APP-A", { ...decision, amount: 10 });
  ws = UOS.ProgramBudget.closeYear(ws, budgetId, decision);
  const tampered = JSON.parse(JSON.stringify(ws));
  const entry = { ...tampered.entities.allocationEntries[0], id: "NSA-AENTRY-POST-CLOSE", decisionSequence: tampered.entities.budgetDecisions.at(-1).sequence + 1 };
  tampered.entities.allocationEntries.push(entry);
  assert.throws(() => UOS.ProgramModel.importJson(tampered), /closed year|invalid governed ledger/);
});

test("import rejects cross-year allocation ledger links", () => {
  let { UOS, ws, budgetId } = setup();
  ws = UOS.ProgramBudget.adjustAllocation(ws, budgetId, "NSA-APP-A", { ...decision, amount: 10 });
  ws = UOS.ProgramBudget.createAnnualBudget(ws, { owner: "NSA", financialYear: "2027-28" });
  const nextId = ws.entities.annualBudgets.find((row) => row.financialYear === "2027-28").id;
  const tampered = JSON.parse(JSON.stringify(ws));
  tampered.entities.allocationEntries[0].budgetId = nextId;
  assert.throws(() => UOS.ProgramModel.importJson(tampered), /invalid allocation entry|invalid governed ledger/);
});

test("save and import reject new ledger entries without an approved decision", () => {
  let { UOS, ws, budgetId } = setup();
  ws = UOS.ProgramBudget.adjustAllocation(ws, budgetId, "NSA-APP-A", { ...decision, amount: 10 });
  const altered = JSON.parse(JSON.stringify(ws));
  altered.entities.allocationEntries.push({ ...altered.entities.allocationEntries[0], id: "NSA-AENTRY-UNAPPROVED", governanceVersion: 0, amount: 1, amountCents: 100, requestId: "", decisionId: "" });
  assert.throws(() => UOS.ProgramModel.importJson(altered), /lacks an approved decision/);
  assert.throws(() => UOS.ProgramBudget.assertTransition(ws, altered), /posting requires an approved decision/);
});
