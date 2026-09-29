const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const Status = require("../src/program-planner/js/status.js");

function workspace() {
  return {
    schemaVersion: 5,
    workspaceRevision: 3,
    statusControl: { automationEnabled: true },
    entities: {
      applications: [],
      events: [],
      projects: [{
        id: "NSA-PROJ-C5",
        owner: "NSA",
        type: "project",
        status: "planning"
      }],
      jobs: [],
      tasks: [],
      quotes: [],
      statusEvents: [],
      statusRecommendations: []
    }
  };
}

test("C5-01: active Register implementation has no writable legacy status-history path", () => {
  const source = fs.readFileSync("src/program-planner/js/register.js", "utf8");

  assert.doesNotMatch(source, /data-register-action=["']add-status-history["']/);
  assert.doesNotMatch(source, /function\s+addStatusHistoryEntry\s*\(/);
  assert.doesNotMatch(source, /function\s+deleteStatusHistoryEntry\s*\(/);
  assert.doesNotMatch(source, /\.statusHistory\s*\.\s*push\s*\(/);
  assert.doesNotMatch(source, /persistWorkspaceEntity\s*\([^)]*["']statusHistory["']/s);
  assert.doesNotMatch(source, /data-delete-history-for/);
});

test("C5-02: one governed transition updates current status and writes exactly one canonical event", () => {
  const before = workspace();
  const after = Status.transition(before, {
    entityId: "NSA-PROJ-C5",
    to: "in_delivery",
    actor: "C5 Test Officer",
    at: "2026-09-21T01:00:00.000Z"
  });

  assert.equal(after.entities.projects[0].status, "in_delivery");
  assert.equal(after.entities.statusEvents.length, 1);
  assert.deepEqual(
    {
      entityId: after.entities.statusEvents[0].entityId,
      fromStatus: after.entities.statusEvents[0].fromStatus,
      toStatus: after.entities.statusEvents[0].toStatus,
      actor: after.entities.statusEvents[0].actor
    },
    {
      entityId: "NSA-PROJ-C5",
      fromStatus: "planning",
      toStatus: "in_delivery",
      actor: "C5 Test Officer"
    }
  );
  assert.equal(Object.hasOwn(after.entities.projects[0], "statusHistory"), false);
  assert.equal(before.entities.projects[0].status, "planning", "the input remains immutable");
});

test("C5-03: current status aligns with the latest canonical event after two transitions", () => {
  const delivered = Status.transition(workspace(), {
    entityId: "NSA-PROJ-C5",
    to: "in_delivery",
    actor: "C5 Test Officer",
    at: "2026-09-21T01:00:00.000Z"
  });
  const held = Status.transition(delivered, {
    entityId: "NSA-PROJ-C5",
    to: "on_hold",
    actor: "C5 Test Officer",
    reason: "Awaiting site access",
    at: "2026-09-21T02:00:00.000Z"
  });
  const newestFirst = held.entities.statusEvents
    .filter((event) => event.entityId === "NSA-PROJ-C5")
    .toSorted((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)));

  assert.equal(held.entities.statusEvents.length, 2);
  assert.equal(held.entities.projects[0].status, "on_hold");
  assert.equal(newestFirst[0].toStatus, held.entities.projects[0].status);
  assert.equal(newestFirst[0].fromStatus, "in_delivery");
  assert.equal(newestFirst[1].toStatus, "in_delivery");
});

test("C5-04: legitimate legacy history migrates without loss and cannot be appended by a new transition", () => {
  const legacy = {
    schemaVersion: 4,
    workspaceRevision: 1,
    entities: {
      applications: [{
        id: "NSA-APP-C5-HISTORIC",
        owner: "NSA",
        type: "application",
        status: "Complete",
        statusHistory: [{
          status: "Complete",
          date: "2025-01-03",
          reason: "Historical completion evidence"
        }]
      }],
      events: [],
      projects: [],
      jobs: [],
      tasks: [],
      quotes: []
    }
  };

  const migrated = Status.migrate(legacy);
  const migrationEvent = migrated.entities.statusEvents.find(
    (event) => event.entityId === "NSA-APP-C5-HISTORIC"
  );

  assert.ok(migrationEvent);
  assert.equal(migrationEvent.toStatus, "complete");
  assert.equal(migrationEvent.source, "migration");
  assert.equal(migrationEvent.action, "Legacy status history");
  assert.equal(migrationEvent.reason, "Historical completion evidence");
  assert.equal(Object.hasOwn(migrated.entities.applications[0], "statusHistory"), false);

  const reopened = Status.transition(migrated, {
    entityId: "NSA-APP-C5-HISTORIC",
    to: "received",
    actor: "C5 Test Officer",
    reason: "Historic case reopened",
    at: "2026-09-21T03:00:00.000Z"
  });

  assert.equal(reopened.entities.statusEvents.length, migrated.entities.statusEvents.length + 1);
  assert.equal(Object.hasOwn(reopened.entities.applications[0], "statusHistory"), false);
  assert.ok(reopened.entities.statusEvents.some((event) => event.id === migrationEvent.id));
});

test("C5-05: reconciliation of one status change performs one canonical write and no legacy double-write", () => {
  const before = workspace();
  const proposed = structuredClone(before);
  proposed.entities.projects[0].status = "in_delivery";

  const reconciled = Status.reconcileMutation(before, proposed, {
    source: "human",
    actor: "C5 Test Officer",
    action: "Governed Register update",
    at: "2026-09-21T04:00:00.000Z"
  });
  const matching = reconciled.entities.statusEvents.filter(
    (event) => event.entityId === "NSA-PROJ-C5" && event.toStatus === "in_delivery"
  );

  assert.equal(reconciled.entities.projects[0].status, "in_delivery");
  assert.equal(matching.length, 1);
  assert.equal(reconciled.entities.statusEvents.length, 1);
  assert.equal(Object.hasOwn(reconciled.entities.projects[0], "statusHistory"), false);
});
