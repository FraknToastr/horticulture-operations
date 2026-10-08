const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});

test("Planner modal governs task fields and hands one Draft Planner Job to Scheduler", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    const record = { id: "NSA-APP-PLANNER-EDITOR", owner: "NSA", type: "application", receipt: "PLANNER-EDITOR", title: "Planner editor test", status: "received", dateReceived: "2026-09-29" };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id);
      promoted.workspace.workspace.selectedProjectId = promoted.project.id;
      promoted.workspace.workspace.selectedEntityId = promoted.project.id;
      return promoted.workspace;
    });
    await window.UOS.ProgramApp.navigate("planner");
  });

  const frame = page.frameLocator("iframe");
  async function revealPlanningSection() {
    const toggle = frame.locator('[data-planner-section-toggle="PLANNING AND APPROVAL"]');
    await expect(toggle).toBeVisible();
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  }
  await expect(frame.locator('[data-program-view="planner"]')).toBeVisible();
  await frame.locator(".planner-btn-add-item").click();
  const dialog = frame.locator("[data-planner-task-dialog]");
  await expect(dialog).toBeVisible();
  await dialog.locator('[name="title"]').fill("Inspect irrigation assets");
  await dialog.locator('[name="description"]').fill("Confirm valves, heads, and isolation points before work.");
  await dialog.locator('[name="section"]').selectOption("Planning and Approval");
  await dialog.locator('[name="classification"]').selectOption("operational");
  await dialog.locator('[name="status"]').selectOption("In Progress");
  await dialog.locator('[name="operator"]').fill("Planner test operator");
  await dialog.locator('[name="assigneeId"]').selectOption("Technical Officer");
  await dialog.locator('[name="dueDate"]').fill("2026-10-12");
  await dialog.locator('[name="notes"]').fill("Coordinate with irrigation team.");
  await expect(dialog.locator("[data-planner-save-scheduler]")).toHaveCount(0);
  await dialog.locator('button[value="save"]').click();
  await expect(dialog).not.toBeVisible();
  const taskId = await child.evaluate(() => {
    const workspace = window.UOS.ProgramApp.workspace();
    const task = workspace.entities.tasks.find(item => item.title === "Inspect irrigation assets");
    if (workspace.entities.jobs.some(job => job.sourceEntityId === task.id)) throw new Error("Save created a Job");
    return task.id;
  });
  await frame.locator('[data-planner-section-toggle="PLANNING AND APPROVAL"][aria-expanded="false"]').click();
  await frame.locator(`[data-planner-draft-job="${taskId}"]`).click();

  await expect(frame.locator('[data-program-view="scheduler"]')).toBeVisible();
  await expect.poll(() => child.evaluate(() => {
    const scheduler = window.UOS.ProgramApp.workspace().workspace.scheduler || {};
    return scheduler.detail === true && scheduler.inspectorMode === "detail";
  })).toBe(true);
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramSchedulerUI.snapshot().detail)).toBe(true);
  await expect(frame.locator('[data-scheduler-form]')).toBeVisible();
  const lineage = await child.evaluate(() => {
    const workspace = window.UOS.ProgramApp.workspace();
    const task = workspace.entities.tasks.find((item) => item.title === "Inspect irrigation assets");
    const jobs = workspace.entities.jobs.filter((item) => item.sourceKind === "planner" && item.sourceEntityId === task.id);
    return { task, jobs, selectedId: workspace.workspace.scheduler.selectedId, selectedProjectId: workspace.workspace.scheduler.selectedProjectId };
  });
  expect(lineage.task.operational).toBe(true);
  expect(lineage.jobs).toHaveLength(1);
  expect(lineage.jobs[0].status).toBe("draft");
  expect(lineage.selectedId).toBe(lineage.jobs[0].id);
  expect(lineage.selectedProjectId).toBe(lineage.task.projectId);
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);
  await child.evaluate(async () => { await window.UOS.ProgramApp.navigate("planner"); });
  await revealPlanningSection();
  const draftJobIcon = frame.locator(`.planner-item-row[data-task-entity-id="${lineage.task.id}"] [data-planner-open-scheduled-job="${lineage.jobs[0].id}"]`);
  await expect(draftJobIcon).toBeVisible();
  await draftJobIcon.click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.scheduler.selectedId)).toBe(lineage.jobs[0].id);
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.destination)).toBe("scheduler");
  await expect(frame.locator('[data-program-view="scheduler"]')).toBeVisible();
  await expect(frame.locator('[data-scheduler-form]')).toBeVisible();

  await child.evaluate(async ({ taskId, jobId }) => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      const task = workspace.entities.tasks.find((item) => item.id === taskId);
      const job = workspace.entities.jobs.find((item) => item.id === jobId);
      task.schedulerJobId = jobId;
      task.jobId = jobId;
    job.status = "scheduled";
    job.startDate = "2026-10-05";
    job.endDate = "2026-10-05";
      return workspace;
    });
    await window.UOS.ProgramApp.navigate("planner");
  }, { taskId: lineage.task.id, jobId: lineage.jobs[0].id });
  await revealPlanningSection();
  const scheduledJobIcon = frame.locator(`.planner-item-row[data-task-entity-id="${lineage.task.id}"] .planner-task-path.is-scheduled[data-planner-open-scheduled-job="${lineage.jobs[0].id}"]`);
  await expect(scheduledJobIcon).toBeVisible();
  await scheduledJobIcon.click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.scheduler.selectedId)).toBe(lineage.jobs[0].id);
  await expect(frame.locator('[data-scheduler-form]')).toBeVisible();
});

test("Planner rows are summaries and Edit reopens every governed field", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    const record = { id: "NSA-APP-PLANNER-EDIT", owner: "NSA", type: "application", title: "Planner edit test", status: "received", dateReceived: "2026-09-29" };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id);
      const canonical = window.UOS.ProgramStatus.migrate(promoted.workspace);
      const saved = window.UOS.ProgramPlannerModel.saveTask(canonical, promoted.project.id, null, { title: "Check SRZ / TPZ with Arboriculture", description: "Governed description", section: "Planning and Approval", operational: false, status: "Not Started", assigneeId: "Admin", dueDate: "2026-10-15", notes: "Governed notes", sortOrder: 50 }, {});
      window.__plannerEditorTaskId = saved.task.id;
      saved.workspace.workspace.selectedProjectId = promoted.project.id;
      return saved.workspace;
    });
    await window.UOS.ProgramApp.navigate("planner");
  });
  const frame = page.frameLocator("iframe");
  await frame.locator(".planner-section-toggle").first().click();
  const taskId = await child.evaluate(() => window.__plannerEditorTaskId);
  const row = frame.locator(`.planner-item-row[data-task-entity-id="${taskId}"]`);
  await expect(row.locator("select,input")).toHaveCount(0);
  await expect(row.locator(".planner-col-due")).toHaveText("15/10/2026");
  await expect.poll(() => row.locator(".planner-value-frame--task").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const normalFrame = await row.locator(".planner-value-frame--task").evaluate((element) => getComputedStyle(element).borderColor);
  await row.hover();
  const hoverFrame = await row.locator(".planner-value-frame--task").evaluate((element) => getComputedStyle(element).borderColor);
  expect(hoverFrame).not.toBe(normalFrame);
  await row.click();
  await expect(row).toHaveAttribute("aria-selected", "true");
  await page.mouse.move(0, 0);
  await expect.poll(() => row.locator(".planner-value-frame--task").evaluate((element) => getComputedStyle(element).borderColor)).toBe(hoverFrame);
  await row.locator("[data-planner-edit-task]").click();
  await expect(row).toHaveClass(/is-being-edited/);
  const dialog = frame.locator("[data-planner-task-dialog]");
  const editorBackground = await dialog.evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect(dialog.locator('[name="title"]')).toHaveValue("Check SRZ / TPZ with Arboriculture");
  await expect(dialog.locator('[name="description"]')).toHaveValue("Governed description");
  await expect(dialog.locator('[name="section"]')).toHaveValue("Planning and Approval");
  await expect(dialog.locator('[name="dueDate"]')).toHaveValue("2026-10-15");
  await expect(dialog.locator('[name="notes"]')).toHaveValue("Governed notes");
  await dialog.locator('[name="status"]').selectOption("In Progress");
  await dialog.locator('[name="operator"]').fill("Planner status officer");
  await dialog.locator('button[value="save"]').click();
  await expect(dialog).toBeHidden();
  await expect(row).not.toHaveClass(/is-being-edited/);
  await expect.poll(() => child.evaluate(() => {
    const workspace = window.UOS.ProgramApp.workspace();
    return workspace.entities.statusEvents.some((event) => event.actor === "Planner status officer");
  })).toBe(true);
  await expect.poll(() => child.evaluate((id) => window.UOS.ProgramApp.workspace().entities.tasks.find((task) => task.id === id).status, taskId)).toBe("in_progress");
  await expect(row).toHaveAttribute("data-status-slug", "in-progress");
  await expect(row.locator(".planner-col-status")).toContainText("In Progress");
  await expect(row.locator(".planner-progress-frame")).toHaveClass(/planner-progress-frame--in-progress/);
  await row.locator("[data-planner-task-info]").click();
  const infoDialog = frame.locator("[data-planner-task-info-dialog]");
  await expect(infoDialog).toBeVisible();
  await expect.poll(() => infoDialog.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(editorBackground);
  await expect(infoDialog.locator("[data-planner-task-info-title]")).toHaveText("Check SRZ / TPZ with Arboriculture");
  await expect(infoDialog.locator("[data-planner-task-info-description]")).toHaveText("Governed description");
  await expect(infoDialog.locator(".planner-guide-column")).toHaveCount(2);
  const cards = await infoDialog.locator(".planner-task-editor__job").evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, accent: style.borderLeftColor, width: style.borderLeftWidth, padding: style.padding, radius: style.borderRadius };
  }));
  expect(cards).toHaveLength(2);
  expect(cards[0]).toEqual(cards[1]);
  expect(cards[0].width).toBe("4px");
  await infoDialog.locator("[data-planner-task-info-close]").first().click();
  await expect(infoDialog).toBeHidden();
});
