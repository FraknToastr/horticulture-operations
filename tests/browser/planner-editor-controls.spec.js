const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');
test.beforeEach(async ({ page }) => { await suppressBackupModalForFunctionalTest(page); });

for (const owner of ['NSA', 'EVT']) for (const width of [1440, 390]) {
  test(`${owner} task purpose, Section choices, suppressed Order and calendar guide at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const ids = await child.evaluate(async owner => {
      let ids;
      await window.UOS.ProgramApp.updateWorkspace(workspace => {
        const id = `${owner === 'NSA' ? 'NSA-APP' : 'EVT'}-EDITOR-CONTROLS`;
        workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Editor controls', status: 'received' });
        const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, id);
        const canonical = window.UOS.ProgramStatus.migrate(promoted.workspace);
        const first = canonical.entities.tasks.find(task => task.projectId === promoted.project.id && task.sortOrder === 0);
        const custom = window.UOS.ProgramPlannerModel.createTask(canonical, promoted.project.id, { title: 'Custom section task', section: 'Heritage works', description: 'Custom heading preserved' });
        ids = { taskId: first.id, customId: custom.task.id, section: first.section, projectId: promoted.project.id, customOrder: custom.task.sortOrder };
        custom.workspace.workspace.selectedProjectId = promoted.project.id;
        custom.workspace.workspace.selectedEntityId = id;
        return custom.workspace;
      });
      await window.UOS.ProgramApp.navigate('planner');
      return ids;
    }, owner);
    async function open(taskId) {
      await child.locator(`[data-planner-edit-task="${taskId}"]`).evaluate(button => button.click());
      await expect(child.locator('[data-planner-task-dialog]')).toBeVisible();
    }
    const dialog = child.locator('[data-planner-task-dialog]');
    await open(ids.taskId);
    await expect(dialog.getByLabel('Task Purpose', { exact: true })).toBeVisible();
    expect(await dialog.locator('[name="classification"] option').allTextContents()).toEqual(['Reminder Task', 'Add to Scheduler']);
    await expect(dialog.locator('[data-planner-save-scheduler]')).toHaveCount(0);
    await expect(dialog.locator('select[name="section"]')).toHaveValue(ids.section);
    const sections = await dialog.locator('[name="section"] option').allTextContents();
    expect(sections).toEqual(owner === 'NSA' ? ['Planning and Approval', 'Contractors', 'Handover', 'Heritage works'] : ['Pre-Delivery Items', 'Post Delivery', 'Heritage works']);
    await expect(dialog.locator('[name="sortOrder"]')).toHaveCount(0);
    await expect(dialog.locator('[data-planner-task-reason]')).toBeHidden();
    const rows = dialog.locator('.planner-guide-column').nth(1).locator('.planner-calendar-guide__row:not(.planner-guide-conversion)');
    expect(await rows.locator('span:last-child').allTextContents()).toEqual(['Click to schedule a job', 'Job Schedule not finalised', 'Job Schedule finalised']);
    const guide = dialog.locator('[data-planner-task-job]');
    expect(await guide.locator('button,a,input').count()).toBe(0);
    expect(await guide.locator('svg[aria-hidden="true"]').count()).toBe(7);
    expect(await guide.locator('h3').allTextContents()).toEqual(['Edit task', 'Scheduler']);
    await expect(guide.locator('.planner-guide-edit')).toHaveText('');
    const leftRows = guide.locator('.planner-guide-column').first().locator('.planner-calendar-guide__row');
    await expect(leftRows).toHaveCount(3);
    await expect(leftRows.nth(1)).toHaveText('Reminder task');
    await expect(leftRows.nth(2)).toHaveClass(/planner-guide-conversion/);
    await expect(guide.locator('.planner-guide-column').nth(1).locator('.planner-guide-conversion')).toHaveCount(0);
    expect(await guide.locator('.planner-guide-arrow').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(30);
    await expect(guide.locator('.planner-guide-conversion')).toContainText('Any Reminder task can have its purpose changed');
    expect(await guide.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    expect(await rows.locator('svg').nth(0).innerHTML()).not.toContain('M8 16l');
    expect(await rows.locator('svg').nth(1).innerHTML()).not.toContain('M8 16l');
    expect(await rows.locator('svg').nth(2).innerHTML()).toContain('M8 16l');
    const colours = await rows.locator('.planner-calendar-guide__icon').evaluateAll(icons => icons.map(icon => ({ color: getComputedStyle(icon).color, border: getComputedStyle(icon).borderTopWidth })));
    expect(colours[0].border).toBe('1px');
    expect(colours[1].border).toBe('2px');
    expect(colours[0].color).not.toBe(colours[1].color);
    expect(colours[1].color).toBe(colours[2].color);
    await dialog.locator('.planner-task-editor__body').evaluate(body => { body.scrollTop = body.scrollHeight; });
    await expect(rows.last()).toBeVisible();
    await expect(dialog.locator('button[value="save"]')).toBeVisible();
    const fits = await dialog.evaluate(element => ({ dialogFits: element.getBoundingClientRect().width <= innerWidth, bodyFits: element.querySelector('.planner-task-editor__body').scrollWidth <= element.querySelector('.planner-task-editor__body').clientWidth }));
    expect(fits).toEqual({ dialogFits: true, bodyFits: true });
    await guide.screenshot({ path: testInfo.outputPath(`${owner}-${width}-calendar-guide.png`) });
    await dialog.locator('button[value="save"]').click();
    await expect(dialog).not.toBeVisible();
    expect(await child.evaluate(id => window.UOS.ProgramApp.workspace().entities.tasks.find(task => task.id === id).sortOrder, ids.taskId)).toBe(0);
    await open(ids.taskId);
    await dialog.getByLabel('Section', { exact: true }).selectOption('Heritage works');
    await dialog.locator('button[value="save"]').click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    const reopened = page.frames().find(frame => frame !== page.mainFrame());
    await reopened.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const saved = await reopened.evaluate(ids => {
      const ws = window.UOS.ProgramApp.workspace();
      const task = ws.entities.tasks.find(task => task.id === ids.taskId);
      return { section: task.section, order: task.sortOrder, jobs: ws.entities.jobs.length };
    }, ids);
    expect(saved).toEqual({ section: 'Heritage works', order: 0, jobs: 0 });
    await reopened.evaluate(async () => { await window.UOS.ProgramApp.navigate('planner'); });
    await reopened.locator(`[data-planner-edit-task="${ids.customId}"]`).evaluate(button => button.click());
    await expect(reopened.locator('[name="section"]')).toHaveValue('Heritage works');
    await expect(reopened.locator('[name="sortOrder"]')).toHaveCount(0);
    await reopened.locator('[data-planner-task-cancel]').first().click();
    await reopened.locator('.planner-btn-add-item').evaluate(button => button.click());
    await expect(reopened.locator('[name="sortOrder"]')).toHaveCount(0);
    await expect(reopened.locator('[data-planner-task-reset]')).toBeDisabled();
  });
}
