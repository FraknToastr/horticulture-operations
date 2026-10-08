const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});

test('Planner controls match Register actions and Scheduler confirms and deletes its Job', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/src/program-planner/nsa.html');
  const child = page.frames().find((frame) => frame !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const lineage = await child.evaluate(async () => {
    const record = { id: 'NSA-APP-PLANNER-SCHEDULER-CHECK', owner: 'NSA', type: 'application', title: 'Planner Scheduler check', status: 'received', dateReceived: '2026-10-01' };
    let ids;
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id);
      const canonical = window.UOS.ProgramStatus.migrate(promoted.workspace);
      const saved = window.UOS.ProgramPlannerModel.saveTask(canonical, promoted.project.id, null, {
        title: 'Site inspection', description: 'Inspect site before delivery.', section: 'Planning and Approval', operational: true,
        status: 'Not Started', sortOrder: 1
      }, {});
      const draft = window.UOS.ProgramPlannerModel.createDraftJob(saved.workspace, promoted.project.id, saved.task.id);
      saved.workspace = draft.workspace;
      saved.job = draft.job;
      ids = { recordId: record.id, projectId: promoted.project.id, taskId: saved.task.id, jobId: saved.job.id };
      saved.workspace.workspace.selectedProjectId = promoted.project.id;
      saved.workspace.workspace.selectedEntityId = record.id;
      return saved.workspace;
    });
    await window.UOS.ProgramApp.navigate('planner');
    return ids;
  });
  const frame = page.frameLocator('iframe');
  await frame.locator('.planner-section-toggle[aria-expanded="false"]').first().click();
  const row = frame.locator(`.planner-item-row[data-task-entity-id="${lineage.taskId}"]`);
  await expect(row).toBeVisible();
  const sizes = await child.evaluate(({ recordId, taskId }) => {
    const register = document.querySelector(`tr[data-register-record="${recordId}"] [data-register-action="planner"]`);
    const row = document.querySelector(`.planner-item-row[data-task-entity-id="${taskId}"]`);
    const section = row.closest('tbody').querySelector('.planner-cat-header-row');
    const controls = ['[data-planner-task-info]', '.planner-task-path', '[data-planner-edit-task]', '[data-delete-item]']
      .map((selector) => row.querySelector(selector).getBoundingClientRect());
    const reference = register.getBoundingClientRect();
    return {
      reference: { width: reference.width, height: reference.height },
      controls: controls.map(({ width, height }) => ({ width, height })),
      gap: controls[1].left - controls[0].right,
      rightGap: row.querySelector('.planner-col-action').getBoundingClientRect().right - controls[3].right,
      rowHeight: row.getBoundingClientRect().height,
      sectionHeight: section.getBoundingClientRect().height,
      sectionBackground: getComputedStyle(section.cells[0]).backgroundColor
    };
  }, lineage);
  expect(sizes.controls).toEqual(Array(4).fill({ width: 34, height: 34 }));
  expect(sizes.gap).toBeGreaterThanOrEqual(8);
  expect(sizes.gap).toBeLessThanOrEqual(24);
  expect(sizes.rightGap).toBeLessThanOrEqual(10);
  expect(sizes.rowHeight).toBeGreaterThanOrEqual(46);
  expect(sizes.sectionHeight).toBeGreaterThanOrEqual(46);
  expect(sizes.sectionBackground).not.toBe('rgb(240, 244, 248)');

  await row.locator(`[data-planner-open-scheduled-job="${lineage.jobId}"]`).click();
  const form = frame.locator('[data-scheduler-form]');
  await expect(form).toBeVisible();
  await expect(form.locator('[name="sameDay"]')).toBeChecked();
  await expect(form.locator('[data-scheduler-end-date]')).toBeHidden();
  await form.locator('[name="sameDay"]').uncheck();
  await expect(form.locator('[data-scheduler-end-date]')).toBeVisible();
  await form.locator('[name="sameDay"]').check();
  await expect(form.locator('[data-scheduler-end-date]')).toBeHidden();
  await form.locator('[name="allDay"]').check();
  await expect(form.locator('[data-scheduler-timed]')).toHaveCount(2);
  await expect(form.locator('[data-scheduler-timed]').first()).toBeHidden();
  await form.locator('[name="allDay"]').uncheck();
  await expect(form.locator('[data-scheduler-timed]').first()).toBeVisible();
  await form.locator('[name="allDay"]').check();
  await form.locator('[name="startDate"]').fill('2026-10-05');
  await form.locator('button[type="submit"]').click();
  await expect.poll(() => child.evaluate((jobId) => {
    const workspace = window.UOS.ProgramApp.workspace();
    return workspace.entities.jobs.find((job) => job.id === jobId)?.status;
  }, lineage.jobId)).toBe('scheduled');
  await expect.poll(() => child.evaluate((jobId) => window.UOS.ProgramApp.workspace().entities.statusEvents.some((event) => event.entityId === jobId && event.toStatus === 'scheduled'), lineage.jobId)).toBe(true);
  const source = await child.evaluate((jobId) => {
    const workspace = window.UOS.ProgramApp.workspace();
    const job = workspace.entities.jobs.find((item) => item.id === jobId);
    const visibleJob = window.UOS.ProgramSchedulerUI.snapshot().jobs.find((item) => item.id === jobId);
    return { sourceKind: job.sourceKind, sourceEntityId: job.sourceEntityId, hasTask: workspace.entities.tasks.some((item) => item.id === job.sourceEntityId), visibleSourceKind: visibleJob.sourceKind, visibleSourceEntityId: visibleJob.sourceEntityId };
  }, lineage.jobId);
  expect(source).toEqual({ sourceKind: 'planner', sourceEntityId: lineage.taskId, hasTask: true, visibleSourceKind: 'Planner', visibleSourceEntityId: lineage.taskId });

  await form.locator('[data-scheduler-delete-job]').click();
  const dialog = frame.locator('.uos-modal--scheduler-delete');
  await expect(dialog).toBeVisible();
  const positions = await dialog.evaluate((element) => {
    const checkbox = element.querySelector('[data-scheduler-delete-planner-task]').getBoundingClientRect();
    const keep = [...element.querySelectorAll('.uos-modal__foot button')].find((button) => button.textContent.includes('Keep')).getBoundingClientRect();
    const remove = [...element.querySelectorAll('.uos-modal__foot button')].find((button) => button.textContent.includes('Delete')).getBoundingClientRect();
    return { checkboxTop: checkbox.top, keepTop: keep.top, deleteTop: remove.top };
  });
  expect(Math.abs(positions.checkboxTop - positions.keepTop)).toBeLessThan(25);
  expect(Math.abs(positions.keepTop - positions.deleteTop)).toBeLessThan(2);
  await dialog.getByRole('button', { name: 'Delete job' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => child.evaluate(({ jobId, taskId }) => {
    const workspace = window.UOS.ProgramApp.workspace();
    const task = workspace.entities.tasks.find((item) => item.id === taskId);
    return { jobGone: !workspace.entities.jobs.some((item) => item.id === jobId), taskKept: Boolean(task), linksCleared: task?.jobId == null && task?.schedulerJobId == null, auditCleared: !workspace.entities.statusEvents.some((item) => item.entityId === jobId) };
  }, lineage)).toEqual({ jobGone: true, taskKept: true, linksCleared: true, auditCleared: true });

  const replacementId = await child.evaluate(async ({ projectId, taskId }) => {
    let jobId;
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      const created = window.UOS.ProgramPlannerModel.createDraftJob(workspace, projectId, taskId);
      jobId = created.job.id;
      return created.workspace;
    });
    await window.UOS.ProgramSchedulerUI.focusCalendarJob(jobId);
    return jobId;
  }, lineage);
  await expect(form).toBeVisible();
  await form.locator('[data-scheduler-delete-job]').click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-scheduler-delete-planner-task]').check();
  await dialog.getByRole('button', { name: 'Delete job' }).click();
  await expect.poll(() => child.evaluate(({ jobId, taskId }) => {
    const workspace = window.UOS.ProgramApp.workspace();
    return {
      jobGone: !workspace.entities.jobs.some((item) => item.id === jobId),
      taskGone: !workspace.entities.tasks.some((item) => item.id === taskId),
      taskAuditGone: !workspace.entities.statusEvents.some((item) => item.entityId === taskId)
    };
  }, { jobId: replacementId, taskId: lineage.taskId })).toEqual({ jobGone: true, taskGone: true, taskAuditGone: true });
  await page.reload();
  const reopened = page.frames().find((frame) => frame !== page.mainFrame());
  await reopened.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  expect(await reopened.evaluate(({ jobId, taskId }) => {
    const workspace = window.UOS.ProgramApp.workspace();
    return workspace.entities.jobs.some((item) => item.id === jobId) ||
      workspace.entities.tasks.some((item) => item.id === taskId);
  }, { jobId: replacementId, taskId: lineage.taskId })).toBe(false);
});
