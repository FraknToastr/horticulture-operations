const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');
test.beforeEach(async ({ page }) => { await suppressBackupModalForFunctionalTest(page); });

for (const owner of ['NSA', 'EVT']) for (const width of [1440, 390]) {
  test(`${owner} Scheduler lifecycle and costing fields at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const ids = await child.evaluate(async owner => {
      let ids;
      await window.UOS.ProgramApp.updateWorkspace(workspace => {
        const record = { id: `${owner === 'NSA' ? 'NSA-APP' : 'EVT'}-REFINEMENTS`, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Refinements project', status: 'received' };
        workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
        const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id);
        const canonical = window.UOS.ProgramStatus.migrate(promoted.workspace);
        const saved = window.UOS.ProgramPlannerModel.saveTask(canonical, promoted.project.id, null, { title: 'Refinements job', description: 'Inspect the project site', section: 'Planning and Approval', operational: true, status: 'Not Started', sortOrder: 1 });
        const draft = window.UOS.ProgramPlannerModel.createDraftJob(saved.workspace, promoted.project.id, saved.task.id);
        draft.workspace.entities.rateItems.push({ id: 'RATE-REFINEMENTS', type: 'rateItem', owner: '', kind: 'Labour', kindSource: 'user', category: 'Plant Hire/Contractors and more', description: 'A long reusable horticulture labour description for testing the complete field and action controls', unit: 'hour', unitRate: 141, active: true, quantityMode: 'direct', schedulerEnabled: false });
        draft.workspace.workspace.selectedProjectId = promoted.project.id;
        draft.workspace.workspace.selectedEntityId = record.id;
        ids = { projectId: promoted.project.id, jobId: draft.job.id };
        return draft.workspace;
      });
      await window.UOS.ProgramApp.navigateWithContext('scheduler', ids.jobId);
      await window.UOS.ProgramSchedulerUI.focusCalendarJob(ids.jobId);
      return ids;
    }, owner);
    const detail = child.locator('[data-scheduler-detail]');
    const form = detail.locator('[data-scheduler-form]');
    const status = form.getByRole('button', { name: 'Job status', exact: true });
    await expect(form.getByRole('checkbox', { name: 'Updates application status for the main works' })).not.toBeChecked();
    await expect(child.locator('#scheduler-application-status-help')).toBeVisible();
    await expect(status).toHaveAttribute('data-status-lifecycle-open', ids.jobId);
    await expect(detail.locator('[data-scheduler-detail-fields], [data-status-scheduler-mount], [data-status-controls-for]')).toHaveCount(0);
    await form.locator('[name="startDate"]').fill('2026-10-05');
    for (const theme of ['light', 'dark']) {
      await child.evaluate(theme => { document.documentElement.dataset.suiteTheme = theme; }, theme);
      await status.click();
      const lifecycle = child.locator('[data-status-lifecycle-dialog]');
      await expect(lifecycle).toBeVisible();
      await expect(lifecycle.locator('[data-status-controls-for]')).toHaveAttribute('data-status-controls-for', ids.jobId);
      await expect(lifecycle.locator('[data-status-pause]')).toBeVisible();
      await lifecycle.press('Escape');
      await expect(lifecycle).toBeHidden();
      await expect(status).toBeFocused();
      await expect(detail).toBeVisible();
      await expect(form.locator('[name="startDate"]')).toHaveValue('2026-10-05');
    }
    await form.locator('[name="allDay"]').uncheck();
    await expect(form.locator('[data-scheduler-timed]').first()).toBeVisible();
    await form.locator('[name="startTime"]').fill('09:00');
    await form.locator('[name="endTime"]').fill('10:30');
    await form.locator('[name="allDay"]').check();
    await expect(form.locator('[data-scheduler-timed]').first()).toBeHidden();
    await expect(form.locator('[data-scheduler-timed]').last()).toBeHidden();
    await form.locator('[name="allDay"]').uncheck();
    await expect(form.locator('[name="startTime"]')).toHaveValue('09:00');
    await form.locator('[name="sameDay"]').uncheck();
    await form.locator('[name="endDate"]').fill('2026-10-06');
    await form.locator('[name="allDay"]').check();
    await form.locator('button[type="submit"]').click();
    await expect.poll(() => child.evaluate(jobId => window.UOS.ProgramApp.workspace().entities.jobs.find(job => job.id === jobId)?.allDay, ids.jobId)).toBe(true);
    await expect.poll(() => child.evaluate(jobId => window.UOS.ProgramApp.workspace().entities.jobs.find(job => job.id === jobId)?.endDate, ids.jobId)).toBe('2026-10-06');
    await expect(child.locator('[data-program-persistence]')).toHaveText('Saved');
    await expect(form.locator('[data-scheduler-timed]').first()).toBeHidden();
    if (width > 640) {
      const tops = await form.locator('.program-scheduler-form__actions>button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().top));
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
    }
    await child.locator('[data-program-destination="costing"]').click();
    await expect(child.locator('[data-program-view="costing"]')).toBeVisible();
    await child.locator('[data-costing-section="Labour"]').press('Enter');
    const row = child.locator('[data-rate-item-row="RATE-REFINEMENTS"]');
    await expect(child.locator('.program-cost-catalog .program-costing-title .uos-eyebrow').first()).toHaveText('Cost Library');
    await expect(child.locator('.program-cost-table thead svg')).toHaveCount(0);
    await expect(row.locator('td:first-child>.program-category-pill')).toHaveCount(1);
    await expect(row.locator('.program-cost-value')).toHaveCount(3);
    await expect(row.locator('[data-costing-add-rate]')).toBeEnabled();
    await row.locator('[data-costing-add-rate]').click();
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.some(line => line.rateItemId === 'RATE-REFINEMENTS'))).toBe(true);
    const calculator = child.locator('[data-costing-line-quantity]').last().locator('xpath=ancestor::tr');
    for (const theme of ['light', 'dark']) {
      await child.evaluate(theme => { document.documentElement.dataset.suiteTheme = theme; }, theme);
      const geometry = await row.evaluate(row => {
        const value = row.querySelector('[data-rate-description]');
        const css = getComputedStyle(value);
        const ref = document.createElement('input'); ref.className = 'uos-input'; row.cells[1].appendChild(ref);
        const reference = getComputedStyle(ref);
        const result = { radius: css.borderRadius, referenceRadius: reference.borderRadius, border: css.borderColor, referenceBorder: reference.borderColor, background: css.backgroundColor, referenceBackground: reference.backgroundColor, visibleText: value.scrollHeight <= value.clientHeight + 1 };
        ref.remove(); return result;
      });
      expect(geometry.radius).toBe(geometry.referenceRadius);
      expect(geometry.border).toBe(geometry.referenceBorder);
      expect(geometry.background).toBe(geometry.referenceBackground);
      expect(geometry.visibleText).toBe(true);
      await expect(calculator.locator('.program-cost-value--total')).toHaveText('$141.00');
      if (width > 640) await row.screenshot({ path: testInfo.outputPath(`${owner}-${width}-${theme}-cost-row.png`) });
    }
    await calculator.locator('[data-costing-line-quantity]').fill('2');
    await calculator.locator('[data-costing-line-quantity]').press('Tab');
    await expect(calculator.locator('[data-costing-line-total]')).toHaveText('$282.00');
    await page.reload();
    const reloaded = page.frames().find(frame => frame !== page.mainFrame());
    await reloaded.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    await reloaded.evaluate(async ids => { await window.UOS.ProgramApp.navigateWithContext('scheduler', ids.jobId); await window.UOS.ProgramSchedulerUI.focusCalendarJob(ids.jobId); }, ids);
    await expect(reloaded.locator('[data-scheduler-form] [name="allDay"]')).toBeChecked();
    await expect(reloaded.locator('[data-scheduler-timed]').first()).toBeHidden();
    await expect(reloaded.locator('[name="endDate"]')).toHaveValue('2026-10-06');
  });
}
