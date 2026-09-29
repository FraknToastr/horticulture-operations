const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});


test("opening another Register drawer cannot retain the previous Register map context", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");

  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications = [
        { id: "NSA-APP-A3330", owner: "NSA", type: "application", receipt: "A3330", dateReceived: "2026-09-13", status: "received", locations: [{ id: "LOC-A3330", coordinate: [138.6, -34.9], name: "A3330" }] },
        { id: "NSA-APP-NEW", owner: "NSA", type: "application", receipt: "A3331", dateReceived: "2026-09-13", status: "received", locations: [] }
      ];
      workspace.workspace.ownerMode = "NSA";
      workspace.workspace.register = workspace.workspace.register || { filters: {} };
      workspace.workspace.register.filters = workspace.workspace.register.filters || {};
      workspace.workspace.register.filters.ownership = "NSA";
      return workspace;
    });
      await window.UOS.ProgramApp.navigateWithContext("map", "NSA-APP-A3330");
  });

  const aDrawer = child.locator('[data-register-drawer-record="NSA-APP-A3330"]');
  const bToggle = child.locator('[data-disclosure-toggle][data-disclosure-key="register:NSA-APP-NEW"]');
  await expect(aDrawer.locator('[data-program-view="map"]')).toHaveCount(1);

  await bToggle.click();
  await expect(bToggle).toHaveAttribute("aria-expanded", "true");
  await expect.poll(async () => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.map.selectedRegisterId)).toBe("NSA-APP-NEW");
  const bDrawer = child.locator('[data-register-drawer-record="NSA-APP-NEW"]');
  await expect(bDrawer.locator('[data-program-view="map"]')).toHaveCount(1);
  await expect(aDrawer.locator('[data-program-view="map"]')).toHaveCount(0);
  await expect(bDrawer.locator('#eventPickerList [data-event-card-id="NSA-APP-NEW"]')).toBeVisible();
  await expect(bDrawer.locator('#eventPickerList [data-event-card-id="NSA-APP-A3330"]')).toHaveCount(0);
  await expect(bDrawer.locator('[data-location-action="add"]')).toBeVisible();
  const moduleFitsDrawer = await bDrawer.evaluate((drawer) => {
    const host = drawer.querySelector("[data-register-module-host]");
    return Boolean(host && drawer.getBoundingClientRect().height >= host.getBoundingClientRect().height);
  });
  expect(moduleFitsDrawer).toBe(true);

  const context = await child.evaluate(() => {
    const ui = window.UOS.ProgramApp.workspace().workspace;
    return {
      selectedEntityId: ui.selectedEntityId,
      selectedProjectId: ui.selectedProjectId,
      mapRegisterId: ui.map.selectedRegisterId,
      mapProjectId: ui.map.selectedProjectId,
      mapLocationId: ui.map.selectedLocationId,
      mapGeometryId: ui.map.selectedGeometryId
    };
  });
  expect(context).toEqual({
    selectedEntityId: "NSA-APP-NEW",
    selectedProjectId: "",
    mapRegisterId: "NSA-APP-NEW",
    mapProjectId: "",
    mapLocationId: "",
    mapGeometryId: ""
  });
});

test("creating a Project from a newly added Register mounts Planner in that Register drawer", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const frame = page.frameLocator("iframe");
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push({ id: "NSA-APP-A3330", owner: "NSA", type: "application", receipt: "A3330", title: "Receipt A3330", status: "received", dateReceived: "2026-09-13", provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "A3330", importedAt: "2026-09-13T00:00:00.000Z" } });
      return workspace;
    });
  });
  await frame.locator("[data-register-add-record]").click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.applications.filter((item) => item.id !== "NSA-APP-A3330").map((item) => item.id))).toHaveLength(1);
  const newId = await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.applications.find((item) => item.id !== "NSA-APP-A3330").id);
  const newRow = frame.locator(`tr[data-register-record="${newId}"]`);
  await expect(newRow).toBeVisible();
  const create = frame.locator(`[data-register-drawer-record="${newId}"] [data-register-action="create-project"]`).first();
  // Add Application intentionally opens the new Register drawer.
  await expect(create).toBeVisible();
  await page.waitForTimeout(350);
  await expect(create).toBeVisible();
  await create.click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.selectedEntityId)).toBe(newId);
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.selectedProjectId)).not.toBe("");
  await expect.poll(() => child.evaluate(() => {
    const workspace = window.UOS.ProgramApp.workspace();
    const projectId = workspace.workspace.selectedProjectId;
    return workspace.entities.jobs.filter((job) => job.projectId === projectId).length;
  })).toBe(0);
  await expect(frame.locator(`[data-register-drawer-record="${newId}"] [data-program-view="planner"]`)).toHaveCount(1);
  await expect(frame.locator('[data-register-drawer-record="NSA-APP-A3330"] [data-program-view="planner"]')).toHaveCount(0);
});

test("Register row shortcut remains usable while Planner is active", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const frame = page.frameLocator("iframe");
  const recordId = "NSA-APP-REGISTER-RETURN";

  await child.evaluate(async (id) => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      const record = {
        id,
        owner: "NSA",
        type: "application",
        receipt: "REGISTER-RETURN",
        title: "Register return shortcut",
        status: "received",
        dateReceived: "2026-09-13",
        provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "REGISTER-RETURN", importedAt: "2026-09-13T00:00:00.000Z" }
      };
      workspace.entities.applications.push(record);
      const result = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id);
      result.workspace.workspace.destination = "planner";
      result.workspace.workspace.selectedEntityId = record.id;
      result.workspace.workspace.selectedProjectId = result.project.id;
      result.workspace.workspace.planner = { selectedProjectId: result.project.id };
      return result.workspace;
    });
  }, recordId);

  await child.evaluate((id) => window.UOS.ProgramDisclosureRows.open("register:" + id), recordId);
  const registerButton = frame.locator(`[data-register-action="register"][data-register-record="${recordId}"]`);
  await expect(registerButton).toBeVisible();
  await expect(registerButton).toBeEnabled();
  await expect(registerButton).not.toHaveAttribute("aria-current", "page");
  await registerButton.click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.destination)).toBe("register");
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.selectedEntityId)).toBe(recordId);
  await expect(registerButton).toHaveClass(/is-current-module/);
  await expect(registerButton).toHaveAttribute("aria-current", "page");
  await expect(registerButton).toBeDisabled();
});
