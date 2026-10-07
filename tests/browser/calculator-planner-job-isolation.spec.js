const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('Calculator Rate Items do not reuse a Planner job', async ({ page }) => {
  await page.goto('/src/program-planner/nsa.html');
  const child = page.frames().find((frame) => frame !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');

  const ids = await child.evaluate(async () => {
    const record = {
      id: 'NSA-APP-CALCULATOR-JOB-ISOLATION',
      owner: 'NSA',
      type: 'application',
      title: 'Calculator job isolation',
      status: 'received',
      dateReceived: '2026-10-01',
    };
    let result;
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id);
      const canonical = window.UOS.ProgramStatus.migrate(promoted.workspace);
      const saved = window.UOS.ProgramPlannerModel.saveTask(
        canonical,
        promoted.project.id,
        null,
        {
          title: 'Planner job must remain separate',
          description: 'Regression fixture',
          section: 'Planning and Approval',
          operational: true,
          status: 'Not Started',
          sortOrder: 1,
        },
        {},
      );
      const draft = window.UOS.ProgramPlannerModel.createDraftJob(saved.workspace, promoted.project.id, saved.task.id);
      saved.workspace = draft.workspace;
      saved.job = draft.job;
      result = { recordId: record.id, projectId: promoted.project.id, plannerJobId: saved.job.id };
      saved.workspace.workspace.selectedProjectId = promoted.project.id;
      saved.workspace.workspace.selectedEntityId = record.id;
      return saved.workspace;
    });
    await window.UOS.ProgramApp.navigate('costing');
    return result;
  });

  const frame = page.frameLocator('iframe');
  await child.evaluate((projectId) => {
    document.querySelector(`[data-costing-project-id="${projectId}"]`)?.click();
  }, ids.projectId);
  await frame.locator('[data-costing-add-rate]:not([disabled])').first().click();

  await expect.poll(() => child.evaluate(({ projectId, plannerJobId }) => {
    const workspace = window.UOS.ProgramApp.workspace();
    const jobs = workspace.entities.jobs.filter((job) => job.projectId === projectId);
    const lines = workspace.entities.costingLines.filter((line) => line.projectId === projectId);
    return {
      jobCount: jobs.length,
      plannerStillPresent: jobs.some((job) => job.id === plannerJobId),
      calculatorJob: jobs.find((job) => job.id !== plannerJobId),
      lineJobId: lines.at(-1)?.jobId,
    };
  }, ids)).toMatchObject({ jobCount: 2, plannerStillPresent: true });

  const state = await child.evaluate(({ projectId, plannerJobId }) => {
    const workspace = window.UOS.ProgramApp.workspace();
    const job = workspace.entities.jobs.find((item) => item.projectId === projectId && item.id !== plannerJobId);
    const line = workspace.entities.costingLines.find((item) => item.jobId === job?.id);
    return { job, line };
  }, ids);
  expect(state.job).toBeTruthy();
  expect(state.job.sourceKind).toBe('calculator');
  expect(state.job.provenance.sourceApp).toBe('uos.costing-commands');
  expect(state.line.jobId).toBe(state.job.id);
});
