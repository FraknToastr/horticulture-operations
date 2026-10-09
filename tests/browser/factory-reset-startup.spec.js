const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

async function confirmFactoryReset(page) {
  const frame = page.frameLocator("iframe");
  const dialog = frame.getByRole("dialog", { name: "Factory reset this workspace?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Permanently factory reset" }).click();
}

for (const [path, owner] of [["nsa.html", "NSA"], ["events.html", "EVT"]]) {
  test(`${owner} factory reset opens the empty Register with the default Rate Library`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.goto(`/src/program-planner/${path}?factory-reset=1`);
    await confirmFactoryReset(page);
    const child = page.frames().find((candidate) => candidate !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
    await child.waitForFunction(() => {
      const workspace = window.UOS.ProgramApp.workspace();
      return workspace.workspace.destination === "register" && workspace.entities.rateItems.length === window.UOS.ProgramDefaultRateCatalog.items().length;
    });
    await expect(page).toHaveURL(`/src/program-planner/${path}`);
    const frame = page.frameLocator("iframe");
    await expect(frame.locator('[data-program-view="register"]')).toBeVisible();
    await expect(frame.locator('[data-program-destination="register"]')).toHaveAttribute("aria-current", "page");
    await expect(frame.getByText("Workspace import required")).toHaveCount(0);
  });
}

for (const fixture of [
  { path: "nsa.html", owner: "NSA", collection: "applications", id: "NSA-APP-RESET-PERSISTENCE" },
  { path: "events.html", owner: "EVT", collection: "events", id: "EVT-EVENT-RESET-PERSISTENCE" }
]) {
  test(`${fixture.owner} linked Register record persists after a factory reset and outer-page reload`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.goto(`/src/program-planner/${fixture.path}?factory-reset=1`);
    await confirmFactoryReset(page);
    let child = page.frames().find((candidate) => candidate !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
    await expect(page).toHaveURL(`/src/program-planner/${fixture.path}`);

    await child.evaluate(async ({ owner, collection, id }) => {
      await window.UOS.ProgramApp.updateWorkspace((workspace) => {
        workspace.entities[collection].push({
          id,
          owner,
          type: owner === "NSA" ? "application" : "event",
          title: `${owner} persistence probe`,
          eventName: `${owner} persistence probe`,
          status: "received",
          dateReceived: "2026-09-30"
        });
        return window.UOS.ProgramModel.promoteRegisterRecord(workspace, id).workspace;
      });
    }, fixture);

    await page.reload();
    child = page.frames().find((candidate) => candidate !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
    const persisted = await child.evaluate(({ collection, id }) => {
      const workspace = window.UOS.ProgramApp.workspace();
      const project = workspace.entities.projects.find((item) => item.applicationId === id || item.eventId === id);
      return {
        record: workspace.entities[collection].some((item) => item.id === id),
        project: Boolean(project),
        tasks: project ? workspace.entities.tasks.filter((task) => task.projectId === project.id).length : 0
      };
    }, fixture);
    expect(persisted.record).toBe(true);
    expect(persisted.project).toBe(true);
    expect(persisted.tasks).toBeGreaterThan(0);
  });
}

test("EVT factory-reset launch purges a valid stored workspace", async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto("/src/program-planner/events.html");
  let child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(() => window.UOS.ProgramApp.updateWorkspace((workspace) => {
    workspace.entities.events.push({ id: "EVT-EVENT-RESET-PROBE", owner: "EVT", type: "event", title: "Discard me", status: "received", dateReceived: "2026-09-29" });
    return workspace;
  }));
  await page.goto("/src/program-planner/events.html?factory-reset=1");
  await confirmFactoryReset(page);
  child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  const result = await child.evaluate(() => {
    const workspace = window.UOS.ProgramApp.workspace();
    return { events: workspace.entities.events.length, applications: workspace.entities.applications.length, rates: workspace.entities.rateItems.length, destination: workspace.workspace.destination, query: window.location.search };
  });
  expect(result).toEqual({ events: 0, applications: 0, rates: await child.evaluate(() => window.UOS.ProgramDefaultRateCatalog.items().length), destination: "register", query: "?workspace=EVT" });
});

test("restored or cancelled NSA reset intent cannot delete Register records", async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto("/src/program-planner/nsa.html");
  let child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications = [
        { id: "NSA-APP-RESTART-1", owner: "NSA", type: "application", title: "Restart one", status: "received", dateReceived: "2026-09-30" },
        { id: "NSA-APP-RESTART-2", owner: "NSA", type: "application", title: "Restart two", status: "received", dateReceived: "2026-09-30" }
      ];
      return workspace;
    });
  });

  await page.goto("/src/program-planner/nsa.html?factory-reset=1");
  const frame = page.frameLocator("iframe");
  const dialog = frame.getByRole("dialog", { name: "Factory reset this workspace?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep stored workspace" }).click();
  child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await expect(page.locator("#workspace-frame")).toHaveAttribute("src", "index.html?workspace=NSA");
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.applications.map((item) => item.id).sort())).toEqual(["NSA-APP-RESTART-1", "NSA-APP-RESTART-2"]);

  await page.reload();
  child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.applications.map((item) => item.id).sort())).toEqual(["NSA-APP-RESTART-1", "NSA-APP-RESTART-2"]);

  // A browser may restore the iframe's former URL independently of its outer
  // launcher. The query string alone is never reset authority.
  const restoredNavigation = page.waitForEvent("framenavigated", (frame) => frame === child);
  await page.locator("#workspace-frame").evaluate((iframe) => { iframe.src = "index.html?workspace=NSA&factory-reset=1"; });
  await restoredNavigation;
  child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await expect(page.frameLocator("iframe").getByRole("dialog", { name: "Factory reset this workspace?" })).toHaveCount(0);
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.applications.map((item) => item.id).sort())).toEqual(["NSA-APP-RESTART-1", "NSA-APP-RESTART-2"]);
});
