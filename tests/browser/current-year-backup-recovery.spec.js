const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test('recovered current-year NSA workspace stages, imports and renders without legacy contamination', async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto('/src/program-planner/nsa.html');
  const frame = page.frames().find(candidate => candidate !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const input = fs.readFileSync('src/sample/nsa-workspace-2026-27-schema-v5.json', 'utf8');
  const result = await frame.evaluate(async input => {
    const U = window.UOS;
    const current = U.ProgramApp.workspace();
    const stage = await U.ProgramData.stage(new File([input], 'nsa-workspace-2026-27-schema-v5.json', { type: 'application/json' }), current, { expectedApp: 'NSA' });
    const imported = await U.ProgramData.apply(stage, { currentWorkspace: current, commit: (candidate, options) => U.ProgramApp.adoptWorkspace(candidate, options) });
    U.ProgramModel.assertValid(imported);
    await U.ProgramApp.navigate('register');
    return {
      blocked: stage.preview.blocked,
      schema: imported.schemaVersion,
      counts: { applications: imported.entities.applications.length, events: imported.entities.events.length, tasks: imported.entities.tasks.length },
      progress: imported.entities.applications.filter(record => record.status === 'in_progress').length,
      completedTask: imported.entities.tasks.some(task => task.projectId === 'NSA-PROJ-186F3X1' && task.templateKey === '1' && task.status === 'complete' && task.assigneeId === 'Technical Officer'),
      datesValid: imported.entities.applications.every(record => record.payload.dateReceived >= '2026-07-01' && record.payload.dateReceived <= '2027-06-30')
    };
  }, input);
  expect(result).toEqual({ blocked: false, schema: 5, counts: { applications: 12, events: 0, tasks: 50 }, progress: 2, completedTask: true, datesValid: true });
  await expect(frame.getByText('27 Barton Terrace E, North Adelaide SA 5006', { exact: true }).first()).toBeVisible();
  await frame.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace(workspace => {
      workspace.workspace.selectedEntityId = 'NSA-APP-1U7VLB1';
      workspace.workspace.selectedProjectId = 'NSA-PROJ-186F3X1';
      return workspace;
    });
    await window.UOS.ProgramApp.navigate('planner');
  });
  const row = frame.locator('.planner-item-row').filter({ hasText: 'Pre-project photos' }).last();
  const section = await row.getAttribute('data-planner-section-item');
  await frame.locator(`[data-planner-section-toggle="${section}"]:visible`).first().click();
  await expect(frame.locator('.planner-value-frame--task:visible').filter({ hasText: 'Pre-project photos' }).first()).toBeVisible();
  await page.reload();
  const restored = page.frames().find(candidate => candidate !== page.mainFrame());
  await restored.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const persisted = await restored.evaluate(() => {
    const ws = window.UOS.ProgramApp.workspace();
    return { applications: ws.entities.applications.length, tasks: ws.entities.tasks.length, progress: ws.entities.applications.filter(record => record.status === 'in_progress').length };
  });
  expect(persisted).toEqual({ applications: 12, tasks: 50, progress: 2 });
});
