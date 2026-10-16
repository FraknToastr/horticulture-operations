const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function setup(page, owner = 'EVT') {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/src/program-planner/${owner === 'EVT' ? 'events' : 'nsa'}.html`);
  const frame = page.frames().find(item => item !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const ids = await frame.evaluate(async owner => {
    const prefix = owner === 'EVT' ? 'EVT-EVENT' : 'NSA-APP';
    const ids = { first: `${prefix}-MILESTONE-A`, second: `${prefix}-MILESTONE-B` };
    await UOS.ProgramApp.updateWorkspace(workspace => {
      for (const [key, id] of Object.entries(ids)) {
        workspace.entities[owner === 'EVT' ? 'events' : 'applications'].push({
          id, owner, type: owner === 'EVT' ? 'event' : 'application', title: `Milestone ${key}`, status: 'received', dateReceived: '2026-10-01',
          bumpInDate: '2026-10-05', bumpOutDate: key === 'first' ? '2026-10-07' : '2026-10-08'
        });
      }
      workspace.workspace.calendarCursor = '2026-10-05';
      return workspace;
    });
    await UOS.ProgramApp.navigateWithContext('scheduler', ids.first);
    return ids;
  }, owner);
  return { frame, ids, errors };
}

test('EVT dates show scoped read-only all-day references without a Project and stay authoritative across views/reload', async ({ page }) => {
  let { frame, ids, errors } = await setup(page);
  const cards = () => frame.locator('[data-scheduler-milestone]');
  const recordCards = id => frame.locator(`[data-scheduler-milestone-event="${id}"]`);
  await expect(frame.locator('[data-scheduler-calendar-scope="application"]')).toBeEnabled();
  await expect(frame.locator('[data-scheduler-calendar-scope="application"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(cards()).toHaveCount(2);
  await expect(cards().first()).toHaveClass(/scheduler-all-day-card/);
  await expect(cards().first()).toContainText('Milestone first · Bump-in');
  expect(await cards().first().getAttribute('data-scheduler-job')).toBeNull();
  expect(await cards().first().evaluate(node => getComputedStyle(node).borderInlineStartWidth)).toBe('4px');
  await expect(frame.locator('[data-week-handle]')).toHaveCount(0);
  await frame.evaluate(() => UOS.ProgramApp.updateWorkspace(workspace => {
    workspace.workspace.scheduler.filters = { category: ['unmatched'], status: ['unmatched'], crew: ['unmatched'] };
    return workspace;
  }));
  await expect(cards()).toHaveCount(2);
  await frame.locator('[data-scheduler-calendar-scope="all"]').click();
  await expect(cards()).toHaveCount(4);
  await expect(recordCards(ids.first).first()).toHaveClass(/is-active-event/);
  await expect(recordCards(ids.second).first()).toHaveClass(/is-other-event/);
  expect(await recordCards(ids.first).first().evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe(await recordCards(ids.second).first().evaluate(node => getComputedStyle(node).backgroundColor));
  await frame.getByRole('button', { name: 'Month', exact: true }).click();
  await expect(cards()).toHaveCount(4);
  await expect(cards().first()).toHaveClass(/scheduler-month-card/);
  await frame.evaluate(first => UOS.ProgramApp.updateWorkspace(workspace => {
    const event = workspace.entities.events.find(item => item.id === first);
    event.bumpInDate = '2026-10-06'; event.bumpOutDate = '';
    return workspace;
  }), ids.first);
  await expect(recordCards(ids.first)).toHaveCount(1);
  await expect(recordCards(ids.first)).toHaveAttribute('aria-label', /2026-10-06/);
  const before = await frame.evaluate(() => {
    const entities = UOS.ProgramApp.workspace().entities;
    return { jobs: entities.jobs, costingLines: entities.costingLines, projects: entities.projects };
  });
  expect(before).toEqual({ jobs: [], costingLines: [], projects: [] });
  await recordCards(ids.second).first().focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().workspace.destination)).toBe('register');
  await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().workspace.selectedEntityId)).toBe(ids.second);
  await expect(frame.locator('[data-week-handle]')).toHaveCount(0);
  expect(await frame.evaluate(() => {
    const entities = UOS.ProgramApp.workspace().entities;
    return { jobs: entities.jobs, costingLines: entities.costingLines, projects: entities.projects };
  })).toEqual(before);
  await frame.evaluate(id => UOS.ProgramApp.navigateWithContext('scheduler', id), ids.first);
  await page.reload();
  frame = page.frames().find(item => item !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  await frame.evaluate(id => UOS.ProgramApp.navigateWithContext('scheduler', id), ids.first);
  await expect(cards()).toHaveCount(3);
  await frame.locator('[data-scheduler-calendar-scope="application"]').click();
  await expect(cards()).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('NSA calendar does not expose Event milestones', async ({ page }) => {
  const { frame, errors } = await setup(page, 'NSA');
  await expect(frame.locator('[data-scheduler-milestone]')).toHaveCount(0);
  await frame.getByRole('button', { name: 'Month', exact: true }).click();
  await expect(frame.locator('[data-scheduler-milestone]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Event milestones coexist with operational jobs without editor handles, conflicts or job-count changes', async ({ page }) => {
  const { frame, ids, errors } = await setup(page);
  const created = await frame.evaluate(async ids => {
    let jobId = '';
    await UOS.ProgramApp.updateWorkspace(input => {
      let workspace = UOS.ProgramModel.promoteRegisterRecord(input, ids.first).workspace;
      workspace = UOS.ProgramStatus.migrate(UOS.ProgramModel.promoteRegisterRecord(workspace, ids.second).workspace);
      const project = workspace.entities.projects.find(item => item.eventId === ids.first);
      const task = UOS.ProgramPlannerModel.saveTask(workspace, project.id, null, { title: 'Operational setup', description: 'Milestone coexistence', section: 'Planning and Approval', operational: true, status: 'Not Started' });
      const draft = UOS.ProgramPlannerModel.createDraftJob(task.workspace, project.id, task.task.id);
      jobId = draft.job.id;
      return UOS.ProgramSchedulerModel.scheduleJob(draft.workspace, jobId, { startDate: '2026-10-05', endDate: '2026-10-05', allDay: true, crewId: 'Setup crew' });
    });
    await UOS.ProgramApp.navigateWithContext('scheduler', ids.first);
    return { jobId, jobs: UOS.ProgramApp.workspace().entities.jobs };
  }, ids);
  const card = frame.locator(`[data-scheduler-job="${created.jobId}"].program-calendar-job`);
  await expect(frame.locator('[data-scheduler-milestone]')).toHaveCount(2);
  await expect(card).not.toHaveClass(/is-conflict/);
  await card.click();
  await expect(frame.locator('[data-scheduler-detail]')).toBeVisible();
  await expect(frame.locator('[data-week-handle="move"]')).toHaveCount(1);
  await expect(frame.locator('.scheduler-event-milestone.has-schedule-handles')).toHaveCount(0);
  await frame.locator('[data-scheduler-calendar-scope="all"]').click();
  await expect(frame.locator('[data-scheduler-milestone]')).toHaveCount(4);
  await expect(frame.locator('[data-scheduler-other-project-summary][open]')).toHaveCount(0);
  await frame.locator(`[data-scheduler-milestone-event="${ids.second}"]`).first().click();
  await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().workspace.destination)).toBe('register');
  await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().workspace.selectedEntityId)).toBe(ids.second);
  expect(await frame.evaluate(() => UOS.ProgramApp.workspace().entities.jobs)).toEqual(created.jobs);
  await expect(frame.locator('[data-week-handle]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
