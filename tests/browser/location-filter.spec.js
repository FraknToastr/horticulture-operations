const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});


function registerRecord(id, locations) {
  return {
    id,
    owner: "NSA",
    type: "application",
    receipt: id,
    title: id,
    status: "received",
    dateReceived: "2026-09-13",
    ...(locations ? { locations } : {}),
    provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: id, importedAt: "2026-09-13T00:00:00.000Z" }
  };
}

test("Location map remains stable with a clean mapped-record baseline and reversible filters", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const frame = page.frameLocator("iframe");

  await child.evaluate(async (record) => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      return workspace;
    });
    window.__mapReadyEvents = 0;
    document.addEventListener("uos:program-ready", () => { window.__mapReadyEvents += 1; });
  }, registerRecord("NSA-APP-UNPINNED"));
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.workspace.selectedEntityId = "NSA-APP-UNPINNED";
      return workspace;
    });
  });

  await frame.locator('[data-program-destination="map"]').click();
  const locationFilter = frame.locator('[data-map-spatial-filter="location"]');
  const noLocationFilter = frame.locator('[data-map-spatial-filter="no-location"]');
  const cards = frame.locator("#eventPickerList [data-event-card-id]");
  const drawerToggle = frame.locator('[data-filter-drawer="map"] [data-filter-drawer-toggle]');
  const resetButton = frame.locator('[data-filter-drawer-reset="map"]');
  const badge = frame.locator('[data-filter-drawer-badge="map"]');

  await expect(frame.locator('[data-program-view="map"]')).toBeVisible();
  await expect(frame.locator("[data-program-persistence]")).toHaveText("Saved");
  await expect(locationFilter).toHaveAttribute("aria-pressed", "false");
  await expect(noLocationFilter).toHaveAttribute("aria-pressed", "false");
  await expect(badge).toBeHidden();
  // A Register drawer always retains its active record's full Location card,
  // even before a pin is present.
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute("data-event-card-id", "NSA-APP-UNPINNED");

  await page.waitForTimeout(700);
  const settledCount = await child.evaluate(() => window.__mapReadyEvents);
  await page.waitForTimeout(500);
  expect(await child.evaluate(() => window.__mapReadyEvents)).toBe(settledCount);
  expect(settledCount).toBeLessThanOrEqual(4);
  expect(await child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.map.selectedRegisterId)).toBe("NSA-APP-UNPINNED");

  await drawerToggle.click();
  await noLocationFilter.click();
  await expect(noLocationFilter).toHaveAttribute("aria-pressed", "true");
  await expect(badge).toHaveText("1");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute("data-event-card-id", "NSA-APP-UNPINNED");

  await resetButton.click();
  await expect(noLocationFilter).toHaveAttribute("aria-pressed", "false");
  await expect(locationFilter).toHaveAttribute("aria-pressed", "false");
  await expect(badge).toBeHidden();
  await expect(cards).toHaveCount(1);

  await child.evaluate(async (record) => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      return workspace;
    });
  }, registerRecord("NSA-APP-PINNED", [{ id: "NSA-LOC-PINNED", coordinate: [138.6, -34.9], name: "Pinned test location" }]));

  await expect(locationFilter).toHaveAttribute("aria-pressed", "false");
  await expect(badge).toBeHidden();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute("data-event-card-id", "NSA-APP-UNPINNED");

  await locationFilter.click();
  await expect(locationFilter).toHaveAttribute("aria-pressed", "true");
  await expect(badge).toHaveText("1");
  await expect(cards).toHaveCount(1);

  const search = frame.locator("#eventSearchInput,[data-event-search]");
  await search.fill("PINNED");
  await expect(search).toHaveValue("PINNED");
  await expect(cards).toHaveCount(1);
});

test("Project map scope settles after promoting the active Register record", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const frame = page.frameLocator("iframe");

  await child.evaluate(async (record) => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      workspace.workspace.selectedEntityId = record.id;
      return window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id).workspace;
    });
  }, registerRecord("NSA-APP-PROJECT-MAP"));

  await frame.locator('[data-program-destination="map"]').click();
  await expect(frame.locator('#eventPickerList [data-event-card-id="NSA-APP-PROJECT-MAP"]')).toHaveCount(1);

  await child.evaluate(() => {
    window.__projectMapReadyEvents = 0;
    document.addEventListener("uos:program-ready", () => { window.__projectMapReadyEvents += 1; });
  });
  await frame.locator('[data-map-scope="projects"]').click();
  await expect(frame.locator('[data-map-scope="projects"]')).toHaveAttribute("aria-pressed", "true");
    const projectCard = frame.locator('#eventPickerList [data-event-card-id]');
    await expect(projectCard).toHaveCount(1);
    await expect(projectCard).toContainText("0 polygons");
    await expect(projectCard.locator(".program-status-pill")).toHaveCount(0);
    await expect(projectCard.locator('[data-edit-event-id]')).toHaveText("Add Polygons");
    await expect(projectCard).toHaveAttribute("data-disclosure-skip", "");
    await expect(projectCard.locator('[data-disclosure-toggle], [data-disclosure-drawer]')).toHaveCount(0);

  await page.waitForTimeout(700);
  const settledEvents = await child.evaluate(() => window.__projectMapReadyEvents);
  await page.waitForTimeout(500);
  await expect.poll(() => child.evaluate(() => window.__projectMapReadyEvents)).toBe(settledEvents);
  expect(settledEvents).toBeLessThanOrEqual(3);
});

test("H1-BR-01: Map Received filter includes lowercase stored received and excludes mismatched status", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const frame = page.frameLocator("iframe");
  await child.evaluate(async (records) => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(...records);
      return workspace;
    });
  }, [
    registerRecord("NSA-APP-H1-BR-01", [{ id: "NSA-LOC-H1-BR-01", coordinate: [138.61, -34.91], name: "H1 lowercase location" }]),
    { ...registerRecord("NSA-APP-H1-BR-02", [{ id: "NSA-LOC-H1-BR-02", coordinate: [138.62, -34.92], name: "H1 uppercase location" }]), status: "RECEIVED" },
    (() => { const record = registerRecord("NSA-APP-H1-BR-03", [{ id: "NSA-LOC-H1-BR-03", coordinate: [138.63, -34.93], name: "H1 fallback location" }]); delete record.status; return record; })()
  ]);
  await child.evaluate(() => {
    const applications = window.UOS.ProgramApp.workspace().entities.applications;
    applications.find((record) => record.id === "NSA-APP-H1-BR-01").status = "received";
    applications.find((record) => record.id === "NSA-APP-H1-BR-02").status = "RECEIVED";
    delete applications.find((record) => record.id === "NSA-APP-H1-BR-03").status;
  });
  await frame.locator('[data-program-destination="map"]').click();
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.workspace.selectedEntityId = null;
      if (workspace.workspace.map) workspace.workspace.map.selectedRegisterId = null;
      return workspace;
    });
  });
  const received = frame.locator('[data-map-status-filter="Received"]');
  const approved = frame.locator('[data-map-status-filter="Approved"]');
  const visibleReceivedCard = frame.locator('#eventPickerList [data-event-card-id="NSA-APP-H1-BR-01"]');
  await frame.locator('[data-filter-drawer="map"] [data-filter-drawer-toggle]').click();
  await expect(frame.locator('[data-map-status-filter="Received"]')).toHaveCount(1);
  await expect(frame.locator('[data-map-status-filter="received"], [data-map-status-filter="RECEIVED"]')).toHaveCount(0);
  await received.click();
  await expect(received).toHaveAttribute("aria-pressed", "true");
  await expect(received).toContainText("Received3");
  await expect(visibleReceivedCard).toBeVisible();
  await expect(await child.evaluate(() => window.UOS.ProgramMapController.resolveFilteredMapDataset(
    window.UOS.ProgramApp.workspace(), "applications", "register", null, ["Received"], ""
  ).items.map((item) => item.id))).toContain("NSA-APP-H1-BR-01");
  await received.click();
  await expect(received).toHaveAttribute("aria-pressed", "false");
  await expect(visibleReceivedCard).toBeVisible();
  await approved.click();
  await expect(approved).toHaveAttribute("aria-pressed", "true");
  await expect(await child.evaluate(() => window.UOS.ProgramMapController.resolveFilteredMapDataset(
    window.UOS.ProgramApp.workspace(), "applications", "register", null, ["Approved"], ""
  ).items.map((item) => item.id))).not.toContain("NSA-APP-H1-BR-01");
});
