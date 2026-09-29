const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});

async function readyFrame(page) {
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => (
    window.UOS
    && window.UOS.ProgramApp
    && window.UOS.ProgramApp.snapshot().phase === "ready"
  ));
  return { child, frame: page.frameLocator("iframe") };
}

async function exposeRecord(page, id) {
  const { child, frame } = await readyFrame(page);
  await child.evaluate(() => window.UOS.ProgramApp.navigate("register"));
  await expect(frame.locator('[data-program-view="register"]')).toBeVisible();
  const filterToggle = frame.locator('[data-filter-drawer="register"] [data-filter-drawer-toggle]');
  if (await filterToggle.count()) await filterToggle.click();
  await frame.locator("[data-register-search]").fill(id.replace(/^NSA-APP-/, ""));
  const row = frame.locator(`tr[data-register-record="${id}"]`);
  await expect(row).toBeVisible();
  await row.locator("[data-disclosure-toggle]").click();
  const drawer = frame.locator(`[data-register-drawer-record="${id}"]`);
  await expect(drawer).toBeVisible();
  return { child, frame, drawer };
}

async function createCanonicalRecord(page, id) {
  await page.goto("/src/program-planner/nsa.html");
  const { child } = await readyFrame(page);
  await child.evaluate(async (recordId) => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push({
        id: recordId,
        owner: "NSA",
        type: "application",
        receipt: recordId.replace(/^NSA-APP-/, ""),
        title: "C5 canonical status record",
        status: "received",
        dateReceived: "2026-09-21",
        createdAt: "2026-09-21T00:00:00.000Z",
        updatedAt: "2026-09-21T00:00:00.000Z",
        provenance: {
          owner: "NSA",
          sourceApp: "c5-browser-test",
          sourceVersion: 5,
          sourceId: recordId,
          importedAt: "2026-09-21T00:00:00.000Z"
        }
      });
      return workspace;
    }, { command: "C5.create-register-fixture" });
  }, id);
  return exposeRecord(page, id);
}

async function transitionToCancelled(child, frame, drawer, id, reason) {
  await child.evaluate(() => sessionStorage.setItem(
    "uos.program.statusOperator",
    "C5 Browser Officer"
  ));
  await drawer.locator(`[data-status-lifecycle-open="${id}"]`).click();
  const lifecycle = frame.locator("[data-status-lifecycle-dialog]");
  await expect(lifecycle).toBeVisible();
  await lifecycle.locator('[data-status-command="cancelled"]').click();
  const confirmation = frame.locator("[data-status-confirm-dialog]");
  await expect(confirmation).toBeVisible();
  await confirmation.locator('textarea[name="reason"]').fill(reason);
  await confirmation.locator('button[value="confirm"]').click();
  await expect(confirmation).not.toBeVisible();
}

async function establishDurableFixture(child) {
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace(
      (workspace) => workspace,
      { command: "C5.persistence-barrier" }
    );
    const candidate = window.UOS.ProgramApp.workspace();
    candidate.migration = candidate.migration || {};
    candidate.migration.repairs = candidate.migration.repairs || {};
    candidate.migration.repairs.nsaAuthoritativeProjectsV1 = {
      appliedAt: "2026-09-21T00:00:00.000Z",
      removed: {
        projects: 0,
        jobs: 0,
        tasks: 0,
        costingLines: 0,
        geometries: 0,
        quotes: 0,
        quoteLines: 0,
        payments: 0
      }
    };
    await window.UOS.ProgramApp.adoptWorkspace(candidate, {
      baseRevision: candidate.workspaceRevision,
      mutationKind: "import"
    });
  });
}

test("C5-BR-01: legacy Register status controls are structurally absent", async ({ page }) => {
  const id = "NSA-APP-C5-BR01";
  const { drawer } = await createCanonicalRecord(page, id);

  await expect(drawer.locator('[data-register-edit-key="status"]')).toHaveCount(0);
  await expect(drawer.locator('[data-register-edit-key="statusDate"]')).toHaveCount(0);
  await expect(drawer.locator('[data-register-action="add-status-history"]')).toHaveCount(0);
  await expect(drawer.locator("[data-delete-history-for]")).toHaveCount(0);
  await expect(drawer.locator("[data-register-status-history-panel]")).toBeVisible();
  await expect(drawer.locator(`[data-status-lifecycle-open="${id}"]`)).toHaveCount(1);
});

test("C5-BR-02: governed UI transition writes exactly one canonical history event", async ({ page }) => {
  const id = "NSA-APP-C5-BR02";
  const { child, frame, drawer } = await createCanonicalRecord(page, id);
  const before = await child.evaluate((recordId) => {
    const workspace = window.UOS.ProgramApp.workspace();
    return workspace.entities.statusEvents.filter((event) => event.entityId === recordId).length;
  }, id);

  await transitionToCancelled(child, frame, drawer, id, "C5 governed cancellation");

  await expect.poll(() => child.evaluate((recordId) => {
    const workspace = window.UOS.ProgramApp.workspace();
    const record = workspace.entities.applications.find((item) => item.id === recordId);
    const events = workspace.entities.statusEvents.filter((event) => event.entityId === recordId);
    return {
      status: record && record.status,
      events: events.length,
      latest: events.at(-1) && events.at(-1).toStatus,
      hasLegacyHistory: Boolean(record && Object.hasOwn(record, "statusHistory"))
    };
  }, id)).toEqual({
    status: "cancelled",
    events: before + 1,
    latest: "cancelled",
    hasLegacyHistory: false
  });
  await expect(frame.locator("[data-status-lifecycle-dialog] .program-status-current"))
    .toHaveText("Cancelled");
  await expect(frame.locator("[data-status-lifecycle-dialog] .program-status-events > li").first())
    .toContainText("Cancelled");
});

test("C5-BR-03: canonical status identity and event survive durable reload without a legacy phantom", async ({ page }) => {
  const id = "NSA-APP-C5-BR03";
  const opened = await createCanonicalRecord(page, id);
  const before = await opened.child.evaluate((recordId) => (
    window.UOS.ProgramApp.workspace().entities.statusEvents
      .filter((event) => event.entityId === recordId).length
  ), id);

  await transitionToCancelled(
    opened.child,
    opened.frame,
    opened.drawer,
    id,
    "C5 durable cancellation"
  );
  await expect.poll(() => opened.child.evaluate((recordId) => (
    window.UOS.ProgramApp.workspace().entities.statusEvents
      .filter((event) => event.entityId === recordId).length
  ), id)).toBe(before + 1);
  await establishDurableFixture(opened.child);
  const expected = await opened.child.evaluate((recordId) => {
    const workspace = window.UOS.ProgramApp.workspace();
    const record = workspace.entities.applications.find((item) => item.id === recordId);
    const events = workspace.entities.statusEvents.filter((event) => event.entityId === recordId);
    return {
      id: record.id,
      status: record.status,
      eventIds: events.map((event) => event.id),
      eventCount: events.length
    };
  }, id);
  expect(expected.eventCount).toBeGreaterThan(0);

  await expect.poll(() => opened.child.evaluate(async ({ recordId, eventIds }) => {
    const stored = await window.UOS.ProgramStorage.get();
    const record = stored.entities.applications.find((item) => item.id === recordId);
    const ids = stored.entities.statusEvents
      .filter((event) => event.entityId === recordId)
      .map((event) => event.id);
    return Boolean(record && record.status === "cancelled"
      && JSON.stringify(ids) === JSON.stringify(eventIds));
  }, { recordId: id, eventIds: expected.eventIds })).toBe(true);

  await page.reload();
  const reloaded = await readyFrame(page);
  await expect.poll(() => reloaded.child.evaluate(({ recordId, identity }) => {
    const workspace = window.UOS.ProgramApp.workspace();
    const record = workspace.entities.applications.find((item) => item.id === recordId);
    const events = workspace.entities.statusEvents.filter((event) => event.entityId === recordId);
    return {
      id: record && record.id,
      status: record && record.status,
      eventIds: events.map((event) => event.id),
      eventCount: events.length,
      hasLegacyHistory: Boolean(record && Object.hasOwn(record, "statusHistory")),
      matchesIdentity: Boolean(record && record.id === identity.id)
    };
  }, { recordId: id, identity: expected })).toEqual({
    id,
    status: "cancelled",
    eventIds: expected.eventIds,
    eventCount: expected.eventCount,
    hasLegacyHistory: false,
    matchesIdentity: true
  });

  const { drawer } = await exposeRecord(page, id);
  await expect(drawer.locator("[data-register-status-history-list] [data-register-timeline-status]")).toHaveCount(expected.eventCount);
  await expect(drawer.locator('[data-register-action="add-status-history"]')).toHaveCount(0);
});

test("C5-BR-04: migrated historical evidence remains readable while legacy writers stay absent", async ({ page }) => {
  const id = "NSA-APP-C5-HISTORIC";
  await page.goto("/src/program-planner/nsa.html");
  const { child } = await readyFrame(page);
  await child.evaluate(async (recordId) => {
    const candidate = window.UOS.ProgramApp.workspace();
    candidate.schemaVersion = 4;
    delete candidate.statusControl;
    delete candidate.entities.statusEvents;
    delete candidate.entities.statusRecommendations;
    candidate.entities.applications.push({
      id: recordId,
      owner: "NSA",
      type: "application",
      receipt: "C5-HISTORIC",
      title: "C5 historical status record",
      status: "Complete",
      dateReceived: "2025-01-03",
      statusHistory: [{
        status: "Complete",
        date: "2025-01-03",
        reason: "Historical completion evidence"
      }],
      provenance: {
        owner: "NSA",
        sourceApp: "legacy-import",
        sourceVersion: 4,
        sourceId: recordId,
        importedAt: "2026-09-21T00:00:00.000Z"
      }
    });
    await window.UOS.ProgramApp.adoptWorkspace(candidate, {
      baseRevision: candidate.workspaceRevision,
      mutationKind: "import"
    });
  }, id);

  const migrated = await child.evaluate((recordId) => {
    const workspace = window.UOS.ProgramApp.workspace();
    const record = workspace.entities.applications.find((item) => item.id === recordId);
    const event = workspace.entities.statusEvents.find((item) => item.entityId === recordId);
    return {
      status: record && record.status,
      hasLegacyHistory: Boolean(record && Object.hasOwn(record, "statusHistory")),
      source: event && event.source,
      action: event && event.action,
      reason: event && event.reason
    };
  }, id);
  expect(migrated).toEqual({
    status: "complete",
    hasLegacyHistory: false,
    source: "migration",
    action: "Legacy status history",
    reason: "Historical completion evidence"
  });

  const { frame, drawer } = await exposeRecord(page, id);
  await expect(drawer.locator("[data-register-status-history-list]")).toContainText("Complete");
  await expect(drawer.locator('[data-register-action="add-status-history"]')).toHaveCount(0);
  await expect(drawer.locator("[data-delete-history-for]")).toHaveCount(0);
});
