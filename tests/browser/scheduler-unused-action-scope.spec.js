const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.use({ screenshot: 'off', trace: 'off', video: 'off' });

async function setup(page, owner, savedScope = 'application') {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(candidate => candidate !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  const ids = await frame.evaluate(async ({ owner, savedScope }) => {
    const ids = { records: {}, projects: {}, jobs: {}, lines: {} };
    await UOS.ProgramApp.updateWorkspace(workspace => {
      for (const key of ['primary', 'other', 'noProject', 'emptyProject']) {
        const id = `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-SCOPE-${key}`;
        ids.records[key] = id;
        workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push({
          id, owner, type: owner === 'NSA' ? 'application' : 'event', title: `Scope ${key}`,
          status: 'received', dateReceived: '2026-10-01'
        });
        if (key === 'noProject') continue;
        const promoted = UOS.ProgramModel.promoteRegisterRecord(workspace, id);
        workspace = UOS.ProgramStatus.migrate(promoted.workspace);
        ids.projects[key] = promoted.project.id;
        if (key === 'emptyProject') continue;
        const rateId = `RATE-SCOPE-${owner}-${key}`, operationId = `scope-${owner}-${key}`;
        workspace = UOS.ProgramCosting.upsertRateItem(workspace, {
          id: rateId, description: `Scope ${key} booking`, kind: 'Labour', category: 'Labour',
          unit: 'unit', unitRate: 10, quantityMode: 'direct', schedulerEnabled: true
        });
        workspace = UOS.ProgramCosting.createWork(workspace, promoted.project.id, rateId, { quantity: 1 }, { operationId });
        const line = workspace.entities.costingLines.find(item => item.operationId === operationId);
        ids.lines[key] = line.id;
        ids.jobs[key] = line.jobId;
      }
      workspace.workspace.calendarCursor = '2026-10-05';
      workspace.workspace.scheduler.calendarScope = savedScope;
      return workspace;
    });
    await UOS.ProgramApp.updateWorkspace(workspace => {
      for (const jobId of Object.values(ids.jobs)) workspace = UOS.ProgramSchedulerModel.scheduleJob(workspace, jobId, {
        startDate: '2026-10-05', endDate: '2026-10-05', startTime: '09:00', endTime: '10:00', allDay: false
      });
      return workspace;
    }, { source: 'automatic' });
    return ids;
  }, { owner, savedScope });
  return { frame, ids, errors };
}

const scope = (frame, value) => frame.locator(`[data-scheduler-calendar-scope="${value}"]`);
const cards = frame => frame.locator('.program-calendar-job[data-scheduler-job]');

for (const owner of ['NSA', 'EVT']) {
  for (const key of ['noProject', 'emptyProject']) {
    for (const savedScope of ['application', 'all']) {
      test(`${owner}: unused ${key} action retains ${savedScope} and enables both calendar scopes`, async ({ page }) => {
        let { frame, ids, errors } = await setup(page, owner, savedScope);
        const recordId = ids.records[key];
        await frame.evaluate(id => UOS.ProgramApp.navigateWithContext('register', id), recordId);
        const action = frame.locator(`tr[data-register-record="${recordId}"] [data-register-action="scheduler"]`);
        await expect(action).toHaveAttribute('data-shortcut-state', 'unused');
        await expect(action).toBeEnabled();
        await action.click();
        await expect(scope(frame, 'application')).toBeEnabled();
        await expect(scope(frame, 'all')).toBeEnabled();
        await expect(scope(frame, savedScope)).toHaveAttribute('aria-pressed', 'true');

        await scope(frame, 'application').click();
        await expect(scope(frame, 'application')).toHaveAttribute('aria-pressed', 'true');
        await expect(cards(frame)).toHaveCount(0);
        await scope(frame, 'all').click();
        await expect(cards(frame)).toHaveCount(2);
        await frame.locator(`.program-calendar-job[data-scheduler-job="${ids.jobs.primary}"]`).click();
        const summary = frame.locator('[data-scheduler-other-project-summary]');
        await expect(summary).toBeVisible();
        await expect(frame.locator('[data-scheduler-detail]')).toBeHidden();
        await expect(frame.locator('[data-week-handle]')).toHaveCount(0);
        await summary.press('Escape');
        expect(await frame.evaluate(() => UOS.ProgramApp.workspace().workspace.selectedEntityId)).toBe(recordId);
        expect(await frame.evaluate(() => UOS.ProgramSchedulerUI.snapshot().selectedProjectId)).toBe(ids.projects[key] || '');

        await scope(frame, 'application').focus();
        await scope(frame, 'application').press('Enter');
        await expect(cards(frame)).toHaveCount(0);
        await frame.getByRole('button', { name: 'Month', exact: true }).click();
        await expect(cards(frame)).toHaveCount(0);
        await scope(frame, 'all').click();
        await expect(frame.locator('.scheduler-month-card[data-scheduler-job]')).toHaveCount(2);
        await expect(frame.locator('[data-program-persistence]')).toHaveText('Saved');

        await page.reload();
        frame = page.frames().find(candidate => candidate !== page.mainFrame());
        await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
        expect(await frame.evaluate(() => UOS.ProgramApp.workspace().workspace.scheduler.calendarScope)).toBe('all');
        await frame.evaluate(id => UOS.ProgramApp.navigateWithContext('register', id), recordId);
        await frame.locator(`tr[data-register-record="${recordId}"] [data-register-action="scheduler"]`).click();
        await expect(scope(frame, 'all')).toHaveAttribute('aria-pressed', 'true');
        await expect(scope(frame, 'application')).toBeEnabled();
        await expect(cards(frame)).toHaveCount(2);
        await scope(frame, 'application').click();
        await expect(cards(frame)).toHaveCount(0);
        expect(await frame.evaluate(id => UOS.ProgramApp.evaluateShortcutRule('scheduler', UOS.ProgramApp.shortcutContextForWorkspace('register', UOS.ProgramApp.workspace(), id)).usage, recordId)).toBe('unused');
        expect(errors).toEqual([]);
      });
    }
  }

  test(`${owner}: Resource Calculator Scheduler entry retains its job draft across scope changes`, async ({ page }) => {
    const { frame, ids, errors } = await setup(page, owner);
    await frame.evaluate(id => UOS.ProgramApp.navigateWithContext('costing', id), ids.jobs.primary);
    await frame.locator(`[data-costing-line-calendar="${ids.lines.primary}"]`).click();
    const form = frame.locator('[data-scheduler-form]');
    await expect(frame.locator('[data-scheduler-detail]')).toBeVisible();
    await expect(form.locator('[name="startTime"]')).toHaveValue('09:00');
    await form.locator('[name="location"]').fill('Retained Calculator schedule draft');
    await scope(frame, 'all').click();
    await expect(cards(frame)).toHaveCount(2);
    await expect(form.locator('[name="location"]')).toHaveValue('Retained Calculator schedule draft');
    await frame.locator(`.program-calendar-job[data-scheduler-job="${ids.jobs.other}"]`).click();
    await expect(frame.locator('[data-scheduler-other-project-summary]')).toBeVisible();
    await frame.locator('[data-scheduler-other-project-summary]').press('Escape');
    await scope(frame, 'application').click();
    await expect(cards(frame)).toHaveCount(1);
    await expect(form.locator('[name="location"]')).toHaveValue('Retained Calculator schedule draft');
    expect(await frame.evaluate(() => UOS.ProgramSchedulerUI.snapshot().selectedId)).toBe(ids.jobs.primary);
    expect(errors).toEqual([]);
  });
}
