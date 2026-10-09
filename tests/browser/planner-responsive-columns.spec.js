const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

for (const owner of ['NSA', 'EVT']) test(`${owner}: loaded workspace values take width before Notes`, async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  let frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  const context = await frame.evaluate(async owner => {
    const recordId = `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-COLUMN-LOAD`;
    let projectId, taskId;
    await UOS.ProgramApp.updateWorkspace(ws => {
      ws.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id: recordId, owner, title: 'Loaded workspace column sizing', status: owner === 'NSA' ? 'received' : 'enquiry', dateReceived: '2026-10-05' });
      const promoted = UOS.ProgramModel.promoteRegisterRecord(ws, recordId);
      projectId = promoted.project.id;
      const saved = UOS.ProgramPlannerModel.saveTask(UOS.ProgramStatus.migrate(promoted.workspace), projectId, null, {
        title: 'Check SRZ / TPZ with Arboriculture', description: 'Imported workspace task details', section: 'Planning and Approval',
        status: 'In Progress', operational: false, assigneeId: 'Horticulture operations coordinator — North Adelaide team',
        dueDate: '2026-10-15', notes: 'Extensive imported legacy notes '.repeat(30), sortOrder: 50
      }, {});
      taskId = saved.task.id;
      return UOS.ProgramModel.normalize(JSON.parse(JSON.stringify(saved.workspace)));
    });
    await UOS.ProgramApp.navigateWithContext('planner', recordId);
    return { recordId, projectId, taskId };
  }, owner);
  await page.reload();
  frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  await frame.evaluate(id => UOS.ProgramApp.navigateWithContext('planner', id), context.recordId);
  const row = frame.locator(`[data-task-entity-id="${context.taskId}"]`);
  const section = await row.getAttribute('data-planner-section-item');
  const toggle = frame.locator(`[data-planner-section-toggle="${section}"]`);
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  await expect(row).toBeVisible();
  const wrap = frame.locator('.planner-table-wrap');
  const availableWidth = await wrap.evaluate(node => node.getBoundingClientRect().width);
  let previousNotes;
  for (const width of [availableWidth, availableWidth * .9, availableWidth * .8]) {
    await wrap.evaluate((node, width) => { node.style.maxWidth = `${width}px`; }, width);
    if (previousNotes != null) await expect.poll(() => row.locator('.planner-value-frame--notes').evaluate(node => node.getBoundingClientRect().width)).toBeLessThan(previousNotes);
    await expect.poll(() => row.evaluate(row => [...row.querySelectorAll('.planner-col-task .planner-value-frame,.planner-progress-frame,.planner-col-owner .planner-value-frame,.planner-col-due .planner-value-frame')].every(frame => frame.scrollWidth <= frame.clientWidth))).toBe(true);
    const layout = await row.evaluate(row => {
      const table = row.closest('table'), wrap = table.parentElement;
      return { notes: row.querySelector('.planner-value-frame--notes').getBoundingClientRect().width, minimum: table.style.getPropertyValue('--planner-notes-min-width'), overflow: wrap.scrollWidth - wrap.clientWidth };
    });
    expect(layout.minimum).toBe('34px');
    expect(layout.overflow).toBeLessThanOrEqual(1);
    if (previousNotes != null) expect(layout.notes).toBeLessThan(previousNotes);
    previousNotes = layout.notes;
  }
  await frame.evaluate(async ({ projectId, taskId }) => {
    await UOS.ProgramApp.updateWorkspace(ws => UOS.ProgramPlannerModel.updateTask(ws, projectId, taskId, { notes: '' }).workspace);
  }, context);
  await expect(row.locator('.planner-value-frame--notes')).toHaveText('');
  await expect.poll(() => row.evaluate(row => row.closest('table').parentElement.scrollWidth - row.closest('table').parentElement.clientWidth)).toBeLessThanOrEqual(1);
});
