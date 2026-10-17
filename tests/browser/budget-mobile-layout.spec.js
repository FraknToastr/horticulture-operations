// Deliberately separate from the desktop Budget functional/release checks.
const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test('Budget approved actions remain horizontally scrollable on a narrow viewport', async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto('/src/program-planner/nsa.html');
  const child = page.frames().find(frame => frame !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  await child.evaluate(() => window.UOS.ProgramApp.navigate('budget'));
  const frame = page.frameLocator('iframe');
  await frame.locator('[data-budget-year]').selectOption('2026-27');
  const form = frame.locator('[data-budget-inline-approve]');
  for (const [name, value] of Object.entries({
    amount: '1250.5', date: '2026-09-23', actor: 'Recording officer',
    approver: 'Named authority', reason: 'Annual authority', evidence: 'Council minutes 42'
  })) await form.locator(`[name="${name}"]`).fill(value);
  await form.locator('[data-budget-persistent-actions] button').first().click();
  await expect(form.locator('input[readonly]')).toHaveCount(6);
  await page.setViewportSize({ width: 480, height: 720 });
  const row = form.locator('[data-budget-persistent-actions]');
  await expect(row.locator('button')).toHaveCount(8);
  expect(await row.evaluate(node => ({
    overflow: getComputedStyle(node).overflowX, wide: node.scrollWidth > node.clientWidth
  }))).toEqual({ overflow: 'auto', wide: true });
});
