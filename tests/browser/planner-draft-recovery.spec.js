const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.beforeEach(async ({ page }) => { await suppressBackupModalForFunctionalTest(page); });

test('deleting a Planner job leaves its task as an unticked draft calendar', async ({ page }) => {
  await page.goto('/src/program-planner/nsa.html');
  const child = page.frames().find((frame) => frame !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const ids = await child.evaluate(async () => {
    const record = { id: 'NSA-APP-PLANNER-DRAFT-RECOVERY', owner: 'NSA', type: 'application', title: 'Draft recovery', status: 'received', dateReceived: '2026-10-01' };
    let result;
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id);
      const canonical = window.UOS.ProgramStatus.migrate(promoted.workspace);
      const saved = window.UOS.ProgramPlannerModel.saveTask(canonical, promoted.project.id, null, {
        title: 'Operational inspection', description: 'Inspect before delivery.', section: 'Planning', operational: true, status: 'Not Started', sortOrder: 1
      }, {});
      const draft = window.UOS.ProgramPlannerModel.createDraftJob(saved.workspace, promoted.project.id, saved.task.id);
      saved.workspace = draft.workspace;
      saved.job = draft.job;
      result = { projectId: promoted.project.id, taskId: saved.task.id, jobId: saved.job.id };
      return saved.workspace;
    });
    await window.UOS.ProgramApp.updateWorkspace((workspace) => window.UOS.ProgramModel.deleteJob(workspace, result.jobId));
    await window.UOS.ProgramApp.navigate('planner');
    return result;
  });
  const frame = page.frameLocator('iframe');
  const draft = frame.locator(`[data-planner-draft-job="${ids.taskId}"]`);
  await draft.evaluate((element) => {
    let header = element.closest('tr')?.previousElementSibling;
    while (header && !header.matches('.planner-cat-header-row')) header = header.previousElementSibling;
    const toggle = header?.querySelector('.planner-section-toggle[aria-expanded="false"]');
    if (toggle) toggle.click();
  });
  await expect(draft).toBeVisible();
  expect(await draft.locator('svg').evaluate((element) => element.innerHTML)).toBe('<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4M16 3v4M3 10h18"></path>');
  await draft.click();
  await expect.poll(() => child.evaluate((taskId) => {
    const workspace = window.UOS.ProgramApp.workspace();
    const task = workspace.entities.tasks.find((item) => item.id === taskId);
    return { jobs: workspace.entities.jobs.filter((item) => item.sourceEntityId === taskId).length, jobId: task?.jobId, scheduled: task?.schedulerJobId };
  }, ids.taskId)).toMatchObject({ jobs: 1, scheduled: null });
});
