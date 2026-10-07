const test = require("node:test");
const assert = require("node:assert/strict");
const Status = require("../src/program-planner/js/status.js");

function workspace(owner = "NSA") {
  const register = owner === "NSA" ? { id: "NSA-APP-1", owner, type: "application", status: "received" } : { id: "EVT-EVENT-1", owner, type: "event", status: "received" };
  const project = { id: `${owner}-PROJ-1`, owner, type: "project", status: "planning", applicationId: owner === "NSA" ? register.id : null, eventId: owner === "EVT" ? register.id : null };
  return { schemaVersion: 5, workspaceRevision: 2, statusControl: { automationEnabled: true }, entities: { applications: owner === "NSA" ? [register] : [], events: owner === "EVT" ? [register] : [], projects: [project], jobs: [], tasks: [], quotes: [], statusEvents: [], statusRecommendations: [] } };
}

test("domain vocabularies use stable codes and preserve the EVT report label", () => {
  assert.equal(Status.codeFor("register_evt", "Planned"), "planning");
  assert.equal(Status.labelFor("register_evt", "report_sent"), "Report Completed and Sent");
  assert.equal(Status.codeFor("job", "Complete"), "completed");
  assert.equal(Status.codeFor("job", "Planned"), "scheduled");
  assert.equal(Status.codeFor("job", "Unscheduled"), "draft");
  assert.equal(Status.codeFor("task", "N/A"), "not_applicable");
});

test("human transitions require attribution and guarded reasons", () => {
  const ws = workspace();
  assert.throws(() => Status.transition(ws, { entityId: "NSA-PROJ-1", to: "in_delivery" }), /operator name/i);
  const delivered = Status.transition(ws, { entityId: "NSA-PROJ-1", to: "in_delivery", actor: "A. Officer", at: "2026-09-12T01:00:00.000Z" });
  assert.equal(delivered.entities.projects[0].status, "in_delivery");
  assert.equal(delivered.entities.statusEvents[0].actor, "A. Officer");
  assert.throws(() => Status.transition(delivered, { entityId: "NSA-PROJ-1", to: "on_hold", actor: "A. Officer" }), /reason/i);
  const held = Status.transition(delivered, { entityId: "NSA-PROJ-1", to: "on_hold", actor: "A. Officer", reason: "Awaiting permit", at: "2026-09-12T02:00:00.000Z" });
  assert.equal(held.entities.statusEvents.at(-1).reason, "Awaiting permit");
  assert.equal(ws.entities.projects[0].status, "planning", "failed and successful commands do not mutate their input");
});

test("Quoted is not a human Register action and requires the current issued Quote signal", () => {
  const ws = workspace();
  assert.equal(Status.canHumanTransition("register_nsa", "received", "quoted"), false);
  assert.throws(() => Status.transition(ws, { entityId: "NSA-APP-1", to: "quoted", actor: "A. Officer" }), /automatically.*current linked Quote/i);
  assert.equal(ws.entities.applications[0].status, "received");
  assert.throws(() => Status.transition(ws, { entityId: "NSA-APP-1", to: "quoted", source: "automatic", signalQuoteId: "NSA-QUOTE-MISSING" }), /issued current Quote/i);
  ws.entities.quotes.push({ id: "NSA-QUOTE-1", owner: "NSA", type: "quote", projectId: "NSA-PROJ-1", revision: 1, status: "Issued" });
  ws.entities.quotes.push({ id: "NSA-QUOTE-2", owner: "NSA", type: "quote", projectId: "NSA-PROJ-1", revision: 2, status: "Draft" });
  assert.throws(() => Status.transition(ws, { entityId: "NSA-APP-1", to: "quoted", source: "automatic", signalQuoteId: "NSA-QUOTE-1" }), /issued current Quote/i);
  assert.equal(ws.entities.applications[0].status, "received");
});

test("completion gate requires jobs and all active work complete", () => {
  const ws = workspace();
  assert.equal(Status.completionEligible(ws, "NSA-PROJ-1"), false);
  ws.entities.jobs.push({ id: "NSA-JOB-1", owner: "NSA", type: "job", projectId: "NSA-PROJ-1", status: "completed" });
  ws.entities.tasks.push({ id: "NSA-TASK-1", owner: "NSA", type: "task", projectId: "NSA-PROJ-1", status: "complete" });
  ws.entities.tasks.push({ id: "NSA-TASK-2", owner: "NSA", type: "task", projectId: "NSA-PROJ-1", status: "in_progress", suppressed: true });
  assert.equal(Status.completionEligible(ws, "NSA-PROJ-1"), true);
  const evaluated = Status.evaluate(ws);
  assert.equal(evaluated.entities.statusRecommendations.filter((item) => item.kind === "project_completion").length, 1);
  assert.equal(Status.evaluate(evaluated).entities.statusRecommendations.filter((item) => item.kind === "project_completion").length, 1, "recommendations are idempotent");
});

test("automatic quote and job signals advance registers, but pause does not replay", () => {
  const ws = workspace();
  ws.entities.quotes.push({ id: "NSA-QUOTE-1", owner: "NSA", type: "quote", projectId: "NSA-PROJ-1", status: "Issued" });
  const before = structuredClone(ws); before.entities.quotes[0].status = "Draft";
  const quoted = Status.runAutomatic(ws, { before, at: "2026-09-12T03:00:00.000Z", initiatingOperator: "A. Officer" });
  assert.equal(quoted.entities.applications[0].status, "quoted");
  assert.equal(quoted.entities.statusEvents[0].actor, "Status engine");
  assert.equal(quoted.entities.statusEvents[0].initiatingOperator, "A. Officer");
  const repeated = Status.runAutomatic(quoted, { before: quoted, at: "2026-09-12T03:01:00.000Z" });
  assert.equal(repeated.entities.statusEvents.length, quoted.entities.statusEvents.length, "the same Quote signal is not replayed");
  quoted.entities.applications[0].statusAutomationPaused = true;
  quoted.entities.jobs.push({ id: "NSA-JOB-1", owner: "NSA", type: "job", projectId: "NSA-PROJ-1", status: "scheduled", updatesApplicationStatus: true, startDate: "2026-09-12", endDate: "2026-09-12", allDay: true });
  const prior = structuredClone(quoted); prior.entities.jobs[0].status = "draft";
  const paused = Status.runAutomatic(quoted, { before: prior });
  assert.equal(paused.entities.applications[0].status, "quoted");
  paused.entities.applications[0].statusAutomationPaused = false;
  assert.equal(Status.runAutomatic(paused, { before: paused }).entities.applications[0].status, "quoted", "resume does not replay the missed signal");
});

test("migration maps exact domain values, preserves unknowns, histories, and pauses automation", () => {
  const legacy = workspace("EVT"); legacy.schemaVersion = 4; delete legacy.statusControl; delete legacy.entities.statusEvents; delete legacy.entities.statusRecommendations;
  legacy.entities.events[0].status = "Unexpected legacy state";
  legacy.entities.events[0].statusHistory = [{ status: "Report Completed and Sent", date: "2025-01-03", notes: "legacy note" }];
  legacy.entities.projects[0].status = "Draft";
  const migrated = Status.migrate(legacy);
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.entities.events[0].status, "review_required");
  assert.equal(migrated.entities.events[0].legacyStatus, "Unexpected legacy state");
  assert.equal(migrated.entities.statusEvents[0].toStatus, "report_sent");
  assert.equal(migrated.entities.statusEvents[0].actor, "");
  assert.equal(migrated.entities.statusEvents[0].reason, "");
  assert.equal(migrated.entities.statusEvents[0].legacyNarrative, "legacy note");
  assert.equal(migrated.statusControl.automationEnabled, false);
  assert.equal(migrated.migration.statusReadiness.unknownStatusCount, 1);
});

test("recommendation approval is separate and project completion only recommends register completion", () => {
  let ws = workspace();
  ws.entities.jobs.push({ id: "NSA-JOB-1", owner: "NSA", type: "job", projectId: "NSA-PROJ-1", status: "completed" });
  ws = Status.evaluate(ws);
  const recommendation = ws.entities.statusRecommendations.find((item) => item.kind === "project_completion");
  ws = Status.resolveRecommendation(ws, recommendation.id, "approve", { actor: "A. Officer", at: "2026-09-12T04:00:00.000Z" });
  assert.equal(ws.entities.projects[0].status, "complete");
  ws = Status.evaluate(ws);
  assert.equal(ws.entities.applications[0].status, "received");
  assert.equal(ws.entities.statusRecommendations.some((item) => item.kind === "register_completion" && item.status === "open"), true);
});
