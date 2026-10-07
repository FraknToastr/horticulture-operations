const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test('workspace review classifies every counted record and identifies the current saved source', async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto('/src/program-planner/nsa.html');
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  const expected = await frame.evaluate(async () => {
    await UOS.ProgramApp.updateWorkspace(ws => {
      for (let i = 0; i < 5; i++) ws.entities.applications.push({
        id: 'NSA-APP-PREVIEW-' + i, owner: 'NSA', type: 'application',
        title: 'Preview application ' + i, status: 'received', dateReceived: '2026-10-01'
      });
      return ws;
    });
    await UOS.ProgramApp.navigate('data');
    return UOS.ProgramMigration.countPreview(await UOS.ProgramStorage.getRaw());
  });
  await frame.locator('[data-program-review-legacy]').click();
  await expect(frame.locator('[data-program-migration]')).toBeVisible();
  await expect(frame.locator('[data-program-migration-sources]')).toContainText('Current saved workspace');
  await expect(frame.locator('[data-program-migration-sources]')).not.toContainText('Legacy Nature Strip storage');
  await expect(frame.locator('[data-program-migration-count="applications"]')).toHaveText('5');
  await expect(frame.locator('[data-program-migration-count="tasks"]')).toHaveText('0');
  await expect(frame.locator('[data-program-migration-count="tasks"]').locator('..')).toContainText('Planner tasks');
  await expect(frame.locator('[data-program-migration-owners]')).toContainText('not Register counts');
  let sum = 0;
  for (const [name, count] of Object.entries(expected.byCollection)) {
    await expect(frame.locator('[data-program-migration-count="' + name + '"]')).toHaveText(String(count));
    sum += count;
  }
  await expect(frame.locator('[data-program-migration-count="total"]')).toHaveText(String(sum));
  const raw = await frame.evaluate(() => UOS.ProgramStorage.getRaw());
  expect(raw.entities.applications).toHaveLength(5);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await frame.locator('[data-program-migration-counts]').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});
