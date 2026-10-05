const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.beforeEach(async ({ page }) => { await suppressBackupModalForFunctionalTest(page); });

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: Operational calendar and Planner shortcut reset after Job deletion`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    let child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const ids = await child.evaluate(async owner => {
      const app = window.UOS.ProgramApp;
      const recordId = `${owner === 'NSA' ? 'NSA-APP' : 'EVT'}-PLANNER-CURRENT-STATE`;
      let ids;
      await app.updateWorkspace(workspace => {
        workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id: recordId, owner,
          type: owner === 'NSA' ? 'application' : 'event', title: 'Planner current state', status: 'received', dateReceived: '2026-10-01' });
        const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, recordId);
        const candidate = window.UOS.ProgramStatus.migrate(promoted.workspace);
        const task = candidate.entities.tasks.find(item => item.projectId === promoted.project.id);
        ids = { recordId, projectId: promoted.project.id, taskId: task.id };
        candidate.workspace.selectedEntityId = recordId;
        candidate.workspace.selectedProjectId = promoted.project.id;
        return candidate;
      });
      await app.navigate('planner');
      return ids;
    }, owner);
    const row = () => child.locator(`.planner-item-row[data-task-entity-id="${ids.taskId}"]`);
    const shortcut = () => child.locator(`tr[data-register-record="${ids.recordId}"] [data-register-action="planner"]`);
    const icon = () => row().locator('.planner-task-path');
    async function revealTask() {
      await expect(child.locator('[data-program-view="planner"]')).toBeVisible();
      if (await row().getAttribute('hidden') !== null) {
        const section = await row().getAttribute('data-planner-section-item');
        await child.locator(`[data-planner-section-toggle="${section}"]`).click();
      }
      await expect(row()).toBeVisible();
    }
    async function assertNeutral() {
      await expect(icon()).toHaveAttribute('data-planner-job-state', 'operational');
      await expect(icon()).toHaveAttribute('data-planner-draft-job', ids.taskId);
      await expect(icon()).toHaveAccessibleName('Operational task — create draft Job in Scheduler');
      await expect(row().locator('.planner-task-type-group')).not.toHaveClass(/is-linked-job/);
      expect(await icon().locator('svg').innerHTML()).not.toContain('M8 16l');
      const style = await icon().evaluate(element => {
        const css = getComputedStyle(element);
        const probe = document.createElement('span');
        element.appendChild(probe);
        probe.style.color = 'var(--uos-text-muted)';
        const neutral = getComputedStyle(probe).color;
        probe.style.color = 'var(--program-owner-strong)';
        const owner = getComputedStyle(probe).color;
        probe.remove();
        return { border: css.borderTopWidth, color: css.color, owner, neutral };
      });
      expect(style.border).toBe('1px');
      // Computed neutral token, rather than either program's owner colour.
      expect(style.color).toBe(style.neutral);
      expect(style.color).not.toBe(style.owner);
      await expect(shortcut()).toHaveAttribute('data-shortcut-state', 'unused');
      expect(await shortcut().evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('1px');
    }
    await revealTask();
    await expect(shortcut()).toHaveAttribute('data-shortcut-state', 'unused');
    async function editAndSave(field, value) {
      await row().locator('[data-planner-edit-task]').click();
      const editor = child.locator('[data-planner-task-form]');
      if (field === 'classification') await editor.locator(`[name="${field}"]`).selectOption(value);
      else await editor.locator(`[name="${field}"]`).fill(value);
      await editor.locator('button[type="submit"][value="save"]').click();
      await expect(editor).not.toBeVisible();
    }
    await editAndSave('classification', 'operational');
    await assertNeutral();
    await editAndSave('notes', 'Delivery note');
    await expect(shortcut()).toHaveAttribute('data-shortcut-state', 'in-use');
    await expect(icon()).toHaveAttribute('data-planner-job-state', 'operational');
    await editAndSave('notes', '');
    await assertNeutral();
    await icon().click();
    await expect(child.locator('[data-scheduler-form]')).toBeVisible();
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);
    await child.evaluate(async () => { await window.UOS.ProgramApp.navigate('planner'); });
    await revealTask();
    await expect(icon()).toHaveAttribute('data-planner-job-state', 'draft');
    await expect(shortcut()).toHaveAttribute('data-shortcut-state', 'in-use');
    expect(await icon().evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('2px');
    expect(await icon().locator('svg').innerHTML()).not.toContain('M8 16l');
    const jobId = await icon().getAttribute('data-planner-open-scheduled-job');
    await icon().click();
    const form = child.locator('[data-scheduler-form]');
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.scheduler.selectedId)).toBe(jobId);
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);
    await form.locator('[name="startDate"]').fill('2026-10-05');
    await form.locator('button[type="submit"]').click();
    await expect.poll(() => child.evaluate(jobId => window.UOS.ProgramApp.workspace().entities.jobs.find(job => job.id === jobId)?.status, jobId)).toBe('scheduled');
    await child.evaluate(async () => { await window.UOS.ProgramApp.navigate('planner'); });
    await revealTask();
    await expect(icon()).toHaveAttribute('data-planner-job-state', 'scheduled');
    expect(await icon().locator('svg').innerHTML()).toContain('M8 16l');
    await icon().click();
    await form.locator('[data-scheduler-delete-job]').click();
    const dialog = child.locator('.uos-modal--scheduler-delete');
    await dialog.getByRole('button', { name: 'Keep job' }).click();
    await expect(shortcut()).toHaveAttribute('data-shortcut-state', 'in-use');
    await form.locator('[data-scheduler-delete-job]').click();
    await dialog.getByRole('button', { name: 'Delete job', exact: true }).click();
    await expect.poll(() => child.evaluate(jobId => window.UOS.ProgramApp.workspace().entities.jobs.some(job => job.id === jobId), jobId)).toBe(false);
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);
    await child.evaluate(async () => { await window.UOS.ProgramApp.navigate('planner'); });
    await revealTask();
    await assertNeutral();
    await row().screenshot({ path: testInfo.outputPath(`${owner}-operational-unused.png`) });
    await page.reload();
    child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    await child.evaluate(async () => { await window.UOS.ProgramApp.navigate('planner'); });
    await revealTask();
    await assertNeutral();
    expect(await child.evaluate(jobId => window.UOS.ProgramApp.workspace().entities.jobs.some(job => job.id === jobId), jobId)).toBe(false);
    // Real editor saves after deletion also must not recreate the Job.
    await editAndSave('notes', 'Delivery note');
    await expect(shortcut()).toHaveAttribute('data-shortcut-state', 'in-use');
    await expect(icon()).toHaveAttribute('data-planner-job-state', 'operational');
    await editAndSave('notes', '');
    await assertNeutral();
    expect(await child.evaluate(jobId => window.UOS.ProgramApp.workspace().entities.jobs.some(job => job.id === jobId), jobId)).toBe(false);
    const remainingWork = await child.evaluate(ids => {
      const { ProgramApp: app, ProgramPlannerModel: planner } = window.UOS;
      const workspace = app.workspace();
      const other = workspace.entities.tasks.find(task => task.projectId === ids.projectId && task.id !== ids.taskId);
      const marked = planner.updateTask(workspace, ids.projectId, other.id, { operational: true });
      const draft = planner.createDraftJob(marked.workspace, ids.projectId, other.id);
      const custom = planner.createTask(workspace, ids.projectId, { title: 'Additional reminder' });
      return [draft.workspace, custom.workspace].map(candidate => app.shortcutContextForWorkspace('register', candidate, ids.recordId).hasPlannerWork);
    }, ids);
    expect(remainingWork).toEqual([true, true]);
  });
}
