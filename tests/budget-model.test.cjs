const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function suite() {
  const context = { console, structuredClone, TextEncoder, TextDecoder, URLSearchParams, setTimeout, clearTimeout };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: "uos.horticulture.nsa", workspaceKind: "NSA", owner: "NSA" }) } };
  vm.createContext(context);
  for (const file of ["status.js", "default-rate-catalog.js", "model.js", "budget-model.js", "budget-governance.js"]) {
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file });
  }
  return context.UOS;
}
const authority = { actor: "Budget officer", reason: "Annual operations", date: "2026-09-28", at: "2026-09-28T00:00:00Z" };
function setup() {
  const UOS = suite();
  let ws = UOS.ProgramModel.blank("2026-09-28T00:00:00Z");
  ws.entities.applications.push({ id: "NSA-APP-BUDGET-TEST", owner: "NSA", type: "application", title: "Budget test", status: "received", dateReceived: "2026-09-28", provenance: {} });
  ws = UOS.ProgramBudget.createAnnualBudget(ws, { owner: "NSA", financialYear: "2026-27", at: authority.at });
  const budgetId = ws.entities.annualBudgets[0].id;
  ws = UOS.ProgramBudget.approveAnnualBudget(ws, budgetId, { ...authority, amount: 1000 });
  return { UOS, ws, budgetId, registerId: "NSA-APP-BUDGET-TEST" };
}

test("Register allocations exist without Projects and cannot overdraw their annual budget", () => {
  let { UOS, ws, budgetId, registerId } = setup();
  ws = UOS.ProgramBudget.adjustAllocation(ws, budgetId, registerId, { ...authority, amount: 600 });
  assert.equal(ws.entities.projects.length, 0);
  assert.equal(UOS.ProgramBudget.recordAmount(ws, registerId), 600);
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, budgetId).unallocated, 400);
  assert.throws(() => UOS.ProgramBudget.adjustAllocation(ws, budgetId, registerId, { ...authority, amount: 401 }), /exceeds unallocated/);
  assert.throws(() => UOS.ProgramBudget.adjustAnnualBudget(ws, budgetId, { ...authority, kind: "reduction", amount: -401 }), /exceed unallocated/);
  ws = UOS.ProgramBudget.adjustAnnualBudget(ws, budgetId, { ...authority, kind: "supplement", amount: 200 });
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, budgetId).unallocated, 600);
  assert.doesNotThrow(() => UOS.ProgramModel.assertValid(ws));
});

test("Budget entries remain immutable and legacy Project funding is not converted automatically", () => {
  const { UOS, ws, budgetId, registerId } = setup();
  const promoted = UOS.ProgramModel.promoteRegisterRecord(ws, registerId).workspace;
  const project = promoted.entities.projects[0];
  project.funding = { operationalAmount: 500 };
  const normalized = UOS.ProgramModel.normalize(promoted);
  assert.equal(UOS.ProgramBudget.projectAmount(normalized, project.id), 0);
  assert.equal(normalized.entities.annualBudgets[0].approvedAmount, 1000);
  const tampered = JSON.parse(JSON.stringify(normalized));
  tampered.entities.budgetEntries[0].reason = "Tampered";
  assert.throws(() => UOS.ProgramBudget.assertTransition(normalized, tampered), /immutable/);
  assert.equal(UOS.ProgramBudget.budgetBalance(normalized, budgetId).allocated, 0);
});

test("Carry-forward uses verified unused funds and preserves the closed source year", () => {
  let { UOS, ws, budgetId, registerId } = setup();
  ws = UOS.ProgramBudget.adjustAllocation(ws, budgetId, registerId, { ...authority, amount: 700 });
  const sourceId = ws.entities.registerAllocations[0].id;
  ws = UOS.ProgramBudget.closeYear(ws, budgetId, authority);
  ws = UOS.ProgramBudget.createAnnualBudget(ws, { owner: "NSA", financialYear: "2027-28", at: authority.at });
  const destinationId = ws.entities.annualBudgets.find((item) => item.financialYear === "2027-28").id;
  ws = UOS.ProgramBudget.approveAnnualBudget(ws, destinationId, { ...authority, amount: 0 });
  ws = UOS.ProgramBudget.recordCarryReview(ws, sourceId, "Yes", { ...authority, evidence: "Year-end balance review" });
  ws = UOS.ProgramBudget.carryForward(ws, sourceId, destinationId, { ...authority, amount: 500, verifiedUnspentEvidence: "Verified year-end balance" });
  assert.equal(UOS.ProgramBudget.allocationBalance(ws, sourceId).available, 200);
  assert.equal(UOS.ProgramBudget.budgetBalance(ws, destinationId).approved, 500);
  assert.equal(UOS.ProgramBudget.recordAmount(ws, registerId), 700);
  assert.throws(() => UOS.ProgramBudget.carryForward(ws, sourceId, destinationId, { ...authority, amount: 201, verifiedUnspentEvidence: "Verified year-end balance" }), /exceeds verified unused/);
  assert.throws(() => UOS.ProgramBudget.adjustAllocation(ws, budgetId, registerId, { ...authority, amount: 1 }), /open year/);
});

test("Job commitments and actuals charge a selected allocation without double-counting", () => {
  let { UOS, ws, budgetId, registerId } = setup();
  ws = UOS.ProgramBudget.adjustAllocation(ws, budgetId, registerId, { ...authority, amount: 600 });
  const allocationId = ws.entities.registerAllocations[0].id;
  const promoted = UOS.ProgramModel.promoteRegisterRecord(ws, registerId);
  ws = promoted.workspace;
  const projectId = promoted.project.id;
  ws.entities.jobs.push({ id: "NSA-JOB-BUDGET-TEST", owner: "NSA", type: "job", projectId, applicationId: registerId, sourceKind: "calculator", sourceEntityId: "NSA-JOB-BUDGET-TEST", title: "Budgeted work", status: "Draft", estimate: 300, actualCost: 150, provenance: {} });
  ws = UOS.ProgramModel.normalize(ws);
  ws = UOS.ProgramBudget.chargeJob(ws, allocationId, "NSA-JOB-BUDGET-TEST", { ...authority, kind: "commitment", amount: 300 });
  assert.equal(UOS.ProgramBudget.allocationBalance(ws, allocationId).available, 300);
  ws = UOS.ProgramBudget.chargeJob(ws, allocationId, "NSA-JOB-BUDGET-TEST", { ...authority, kind: "actual", amount: 150 });
  const balance = UOS.ProgramBudget.allocationBalance(ws, allocationId);
  assert.equal(balance.openCommitment, 150);
  assert.equal(balance.actual, 150);
  assert.equal(balance.available, 300);
  assert.equal(UOS.ProgramBudget.projectAmount(ws, projectId), 600);
  assert.throws(() => UOS.ProgramBudget.chargeJob(ws, allocationId, "NSA-JOB-BUDGET-TEST", { ...authority, kind: "actual", amount: 1 }), /cannot exceed/);
  ws = UOS.ProgramBudget.releaseJobCommitment(ws, allocationId, "NSA-JOB-BUDGET-TEST", { ...authority, amount: 100 });
  assert.equal(UOS.ProgramBudget.allocationBalance(ws, allocationId).openCommitment, 50);
  assert.equal(UOS.ProgramBudget.allocationBalance(ws, allocationId).available, 400);
  assert.throws(() => UOS.ProgramBudget.releaseJobCommitment(ws, allocationId, "NSA-JOB-BUDGET-TEST", { ...authority, amount: 51 }), /exceeds/);
  assert.doesNotThrow(() => UOS.ProgramModel.assertValid(ws));
});
