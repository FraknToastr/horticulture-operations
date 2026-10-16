const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

for (const owner of ["NSA", "EVT"]) {
  test(`${owner}: Show Project Plan uses the native action and returns to its originating Register`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/src/program-planner/${owner === "NSA" ? "nsa" : "events"}.html`);
    await expect(page.locator("iframe")).toHaveCount(1);
    const child = page.frames().find((candidate) => candidate !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
    const fixture = await child.evaluate(async (owner) => {
      const collection = owner === "NSA" ? "applications" : "events";
      const prefix = owner === "NSA" ? "APP" : "EVT";
      const recordIds = [`${owner}-${prefix}-OPEN-PREVIOUS`, `${owner}-${prefix}-OPEN-TARGET`];
      await UOS.ProgramApp.updateWorkspace((workspace) => {
        for (const id of recordIds) {
          workspace.entities[collection].push({
            id, owner, type: owner === "NSA" ? "application" : "event",
            receipt: id, title: id, status: "received", dateReceived: "2026-10-16",
            provenance: { owner, sourceApp: "test", sourceVersion: 5, sourceId: id, importedAt: "2026-10-16T00:00:00.000Z" }
          });
          workspace = UOS.ProgramModel.promoteRegisterRecord(workspace, id).workspace;
        }
        workspace.workspace.ownerMode = owner;
        workspace.workspace.destination = "register";
        workspace.workspace.selectedEntityId = recordIds[0];
        workspace.workspace.selectedProjectId = workspace.entities.projects.find((project) =>
          (project.applicationId || project.eventId) === recordIds[0]).id;
        return workspace;
      });
      const workspace = UOS.ProgramApp.workspace();
      return {
        recordId: recordIds[1],
        projectId: workspace.entities.projects.find((project) =>
          (project.applicationId || project.eventId) === recordIds[1]).id,
        entities: JSON.stringify(workspace.entities)
      };
    }, owner);
    const frame = page.frameLocator("iframe");
    await frame.locator(`tr[data-register-record="${fixture.recordId}"]`).click();
    const openProject = frame.locator(`[data-register-action="open-project"][data-register-project-id="${fixture.projectId}"]`);
    await expect(openProject).toBeVisible();
    await openProject.click();
    await expect.poll(() => child.evaluate(() => {
      const ui = UOS.ProgramApp.workspace().workspace;
      return { destination: ui.destination, projectId: ui.selectedProjectId, recordId: ui.selectedEntityId, owner: ui.ownerMode, plannerProjectId: ui.planner?.selectedProjectId };
    })).toEqual({ destination: "planner", projectId: fixture.projectId, recordId: fixture.recordId, owner, plannerProjectId: fixture.projectId });
    await expect(frame.locator(`[data-register-drawer-record="${fixture.recordId}"] [data-program-view="planner"]`)).toBeVisible();
    const registerButton = frame.locator(`[data-register-action="register"][data-register-record="${fixture.recordId}"]`);
    await expect(registerButton).toBeVisible();
    await registerButton.click();
    await expect.poll(() => child.evaluate(() => {
      const ui = UOS.ProgramApp.workspace().workspace;
      return { destination: ui.destination, recordId: ui.selectedEntityId, projectId: ui.selectedProjectId };
    })).toEqual({ destination: "register", recordId: fixture.recordId, projectId: fixture.projectId });
    await expect(registerButton).toHaveAttribute("aria-current", "page");
    expect(await child.evaluate(() => JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(fixture.entities);
    expect(await child.locator('script[src*="register-open-project-fix"]').count()).toBe(0);
    expect(errors).toEqual([]);
  });
}
