const { test, expect } = require("@playwright/test");

async function programFrame(page) {
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  return frame;
}

async function seedOperationalRecord(frame, id) {
  return frame.evaluate(async (recordId) => {
    return window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push({
        id: recordId,
        owner: "NSA",
        type: "application",
        dateReceived: "2026-09-01",
        status: "received",
        provenance: { owner: "NSA", sourceApp: "workspace-backup-test", sourceVersion: 5, sourceId: recordId, importedAt: "2026-09-01T00:00:00.000Z" }
      });
      return workspace;
    });
  }, id);
}

test("workspace backup is primary, deletion requires it, and no browser editing takeover is rendered", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const frame = await programFrame(page);
  await seedOperationalRecord(frame, "NSA-APP-BACKUP-REQUIRED");

  expect(await frame.locator("[data-program-edit-lock-banner], [data-program-takeover-editing]").count()).toBe(0);

  const reminder = frame.locator("[data-program-backup-reminder]");
  await expect(reminder).toBeVisible();
  await expect(reminder).toHaveAttribute("open", "");
  await expect(reminder).toHaveCSS("width", "300px");
  await expect(reminder.getByText("Browser storage can be cleared or become unavailable. Download a complete JSON backup before continuing.")).toHaveCount(0);
  await expect(reminder.locator("h2")).toHaveCount(0);
  await expect(reminder.locator("header")).toHaveCSS("border-bottom-width", "0px");
  await expect(reminder.getByRole("button", { name: "Download backup" })).toHaveCSS("height", "32px");
  await expect(reminder.getByRole("button", { name: "Later" })).toHaveCSS("height", "32px");
  await expect(reminder.locator("[data-program-backup-last-saved]")).toHaveText(/^Last workspace save: (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) \d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December), \d{1,2}:\d{2}(am|pm)$/);
  const alignment = await reminder.evaluate((node) => {
    const identity = node.querySelector(".program-workspace-backup-reminder__identity").getBoundingClientRect();
    const actions = node.querySelector(".program-data-card__actions").getBoundingClientRect();
    const savedAt = node.querySelector("[data-program-backup-last-saved]").getBoundingClientRect();
    return {
      identityCenter: identity.left + identity.width / 2,
      actionsCenter: actions.left + actions.width / 2,
      savedAtCenter: savedAt.left + savedAt.width / 2,
      identityBottom: identity.bottom,
      actionsTop: actions.top
    };
  });
  expect(alignment.actionsCenter).toBeCloseTo(alignment.identityCenter, 4);
  expect(alignment.savedAtCenter).toBeCloseTo(alignment.identityCenter, 4);
  expect(alignment.actionsTop).toBeGreaterThan(alignment.identityBottom);
  const position = await reminder.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2, viewportX: window.innerWidth / 2, viewportY: window.innerHeight / 2 };
  });
  expect(position.centerX).toBe(position.viewportX);
  expect(position.centerY).toBe(position.viewportY);
  await frame.evaluate(() => window.UOS.ProgramApp.navigate("data"));
  await reminder.getByRole("button", { name: "Later" }).click();
  await expect(reminder).toBeHidden();

  await frame.locator("details.program-danger-zone > summary").click();
  await frame.locator("[data-program-delete-stored]").click();
  const dialog = frame.locator("[data-program-delete-dialog]");
  const confirm = frame.locator("[data-program-delete-confirm]");
  await expect(dialog).toBeVisible();
  await expect(confirm).toBeDisabled();

  await frame.locator("[data-program-delete-backup]").click();
  await expect(confirm).toBeEnabled();
});

test("stale revision cannot delete a newer workspace", async ({ browser }) => {
  const context = await browser.newContext();
  const firstPage = await context.newPage();
  const secondPage = await context.newPage();
  await firstPage.goto("http://127.0.0.1:4199/src/program-planner/nsa.html");
  const first = await programFrame(firstPage);
  const original = await seedOperationalRecord(first, "NSA-APP-REVISION-ONE");

  await secondPage.goto("http://127.0.0.1:4199/src/program-planner/nsa.html");
  const second = await programFrame(secondPage);
  await seedOperationalRecord(first, "NSA-APP-REVISION-TWO");

  const result = await second.evaluate(async (revision) => {
    try {
      await window.UOS.ProgramApp.deleteStoredWorkspace(revision);
      return { deleted: true };
    } catch (error) {
      return { deleted: false, name: error && error.name };
    }
  }, original.workspaceRevision);
  expect(result).toEqual({ deleted: false, name: "WorkspaceRevisionConflictError" });

  const durable = await first.evaluate(() => window.UOS.ProgramStorage.getRaw());
  expect(durable.workspaceRevision).toBeGreaterThan(original.workspaceRevision);
  expect(durable.entities.applications.map((record) => record.id)).toEqual(expect.arrayContaining([
    "NSA-APP-REVISION-ONE",
    "NSA-APP-REVISION-TWO"
  ]));
  await context.close();
});

test("revision-fenced deletion clears canonical, recovery, migration, and legacy workspace state together", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const frame = await programFrame(page);
  const saved = await seedOperationalRecord(frame, "NSA-APP-ATOMIC-DELETE");
  const cleared = await frame.evaluate(async (revision) => {
    await window.UOS.ProgramApp.deleteStoredWorkspace(revision);
    const storage = window.UOS.ProgramStorage;
    return {
      canonical: await storage.getRaw(),
      verified: await window.UOS.storage.get(storage.lastVerified.app, storage.lastVerified.name),
      migration: await storage.getMigrationState(),
      legacy: await storage.stageLegacySources()
    };
  }, saved.workspaceRevision);
  expect(cleared.canonical).toBeUndefined();
  expect(cleared.verified).toBeUndefined();
  expect(cleared.migration).toBeNull();
  expect(cleared.legacy.nature).toBeUndefined();
  expect(cleared.legacy.remediation).toBeUndefined();
  expect(cleared.legacy.unified).toBeUndefined();
});
