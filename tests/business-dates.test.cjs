const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function suite(owner = "NSA", instant = "2026-10-09T14:00:00Z") {
  const fixed = Date.parse(instant);
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [fixed])); }
    static now() { return fixed; }
  }
  const context = { console, structuredClone, URLSearchParams, crypto, Date: ClockDate };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: `uos.horticulture.${owner.toLowerCase()}`, workspaceKind: owner, owner }) } };
  vm.createContext(context);
  for (const file of ["src/shared/js/rate-library.js", ...["status.js", "default-rate-catalog.js", "model.js", "budget-model.js", "budget-governance.js", "costing-model.js", "quote-model.js"].map(name => `src/program-planner/js/${name}`)]) {
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  }
  return context.UOS;
}

test("business today uses Adelaide midnight rather than UTC or device midnight", () => {
  const dates = suite().ProgramDates;
  for (const [instant, expected] of [
    ["2026-10-09T13:29:59Z", "2026-10-09"],
    ["2026-10-09T13:30:00Z", "2026-10-10"],
    ["2026-06-30T14:29:59Z", "2026-06-30"],
    ["2026-06-30T14:30:00Z", "2026-07-01"],
    ["2026-04-04T16:29:59Z", "2026-04-05"],
    ["2026-04-04T16:30:00Z", "2026-04-05"],
    ["2026-10-03T16:29:59Z", "2026-10-04"],
    ["2026-10-03T16:30:00Z", "2026-10-04"]
  ]) assert.equal(dates.today(null, instant), expected, instant);
  assert.equal(dates.today({ context: { timeZone: "UTC" } }, "2026-10-09T14:00:00Z"), "2026-10-09");
});

test("quote expiry adds calendar days across daylight saving, leap days and year boundaries", () => {
  const dates = suite().ProgramDates;
  for (const [start, days, expected] of [
    ["2026-03-30", 30, "2026-04-29"],
    ["2026-09-05", 30, "2026-10-05"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2026-12-31", 1, "2027-01-01"]
  ]) assert.equal(dates.addDays(start, days), expected);
});

for (const owner of ["NSA", "EVT"]) {
  test(`${owner}: default Job, Budget and Quote revision dates use business today and preserve explicit dates`, () => {
    const UOS = suite(owner);
    let workspace = UOS.ProgramModel.blank();
    const id = `${owner}-${owner === "NSA" ? "APP" : "EVENT"}-DATES`;
    workspace.entities[owner === "NSA" ? "applications" : "events"].push({ id, owner, title: "Date test", status: "received", dateReceived: "2026-10-01" });
    const promoted = UOS.ProgramModel.promoteRegisterRecord(workspace, id);
    workspace = promoted.workspace;
    const projectId = promoted.project.id;
    const jobs = UOS.ProgramCosting.createJob(workspace, projectId, { title: "Default date" });
    assert.equal(jobs.entities.jobs.at(-1).startDate, "2026-10-10");
    assert.equal(jobs.entities.jobs.at(-1).endDate, "2026-10-10");
    const explicit = UOS.ProgramCosting.createJob(workspace, projectId, { startDate: "2026-10-12", endDate: "2026-10-13" });
    assert.equal(explicit.entities.jobs.at(-1).startDate, "2026-10-12");
    assert.equal(explicit.entities.jobs.at(-1).endDate, "2026-10-13");

    workspace = UOS.ProgramBudget.createAnnualBudget(workspace, { owner, financialYear: "2026-27" });
    const budgetId = workspace.entities.annualBudgets[0].id;
    const approved = UOS.ProgramBudget.approveAnnualBudget(workspace, budgetId, { actor: "Recorder", approver: "Approver", reason: "Annual allocation", evidence: "Decision", amount: "1000.00" });
    assert.equal(approved.entities.budgetChangeRequests[0].effectiveDate, "2026-10-10");
    assert.equal(approved.entities.budgetChangeRequests[0].createdAt, "2026-10-09T14:00:00.000Z");
    const dated = UOS.ProgramBudget.approveAnnualBudget(workspace, budgetId, { actor: "Recorder", approver: "Approver", reason: "Annual allocation", evidence: "Decision", amount: "1000.00", date: "2026-10-08" });
    assert.equal(dated.entities.budgetChangeRequests[0].effectiveDate, "2026-10-08");

    workspace = UOS.ProgramQuotes.saveDraft(workspace, { projectId, quoteDate: "2026-10-01", expiryDate: "2026-11-01", scopeNotes: "Date test" });
    const source = workspace.entities.quotes[0];
    source.status = "Issued";
    const revised = UOS.ProgramQuotes.createRevision(workspace, source.id);
    assert.equal(revised.entities.quotes.at(-1).quoteDate, "2026-10-10");
    assert.equal(revised.entities.quotes.at(-1).expiryDate, "2026-11-01");
    assert.equal(workspace.entities.quotes[0].quoteDate, "2026-10-01");
  });
}
