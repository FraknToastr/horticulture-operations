const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.use({ timezoneId: 'UTC', screenshot: 'off', trace: 'off', video: 'off' });

for (const owner of ['NSA', 'EVT']) {
  for (const scenario of [
    { instant: '2026-10-09T14:00:00Z', today: '2026-10-10', expiry: '2026-11-09', year: '2026-27' },
    { instant: '2026-03-29T13:35:00Z', today: '2026-03-30', expiry: '2026-04-29', year: '2025-26' },
    { instant: '2026-06-30T14:35:00Z', today: '2026-07-01', expiry: '2026-07-31', year: '2026-27' }
  ]) {
    test(`${owner}: business date defaults on ${scenario.today} with device timezone UTC`, async ({ page }) => {
      await suppressBackupModalForFunctionalTest(page);
      await page.clock.setFixedTime(new Date(scenario.instant));
      await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
      const frame = page.frames().find(candidate => candidate !== page.mainFrame());
      await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
      await frame.evaluate(async owner => {
        const id = `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-BUSINESS-DATE`;
        await UOS.ProgramApp.updateWorkspace(workspace => {
          workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id, owner, title: 'Business date test', status: 'received', dateReceived: '2026-03-01' });
          return UOS.ProgramModel.promoteRegisterRecord(workspace, id).workspace;
        });
        await UOS.ProgramApp.navigateWithContext('quotes', id);
      }, owner);
      await expect(frame.locator('[data-quote-date]')).toHaveValue(scenario.today);
      await expect(frame.locator('[data-quote-expiry]')).toHaveValue(scenario.expiry);
      await expect(frame.locator('[name="paymentDate"]')).toHaveValue(scenario.today);

      await frame.evaluate(() => UOS.ProgramApp.navigate('budget'));
      await expect(frame.locator('[data-budget-year]')).toHaveValue(scenario.year);
      await expect(frame.locator('[data-budget-inline-approve] [name="date"]')).toHaveValue(scenario.today);

      await frame.evaluate(() => UOS.ProgramApp.navigate('scheduler'));
      await frame.locator('[data-scheduler-today]').click();
      await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().workspace.calendarCursor)).toBe(scenario.today);
      await expect(frame.locator(`[data-scheduler-date="${scenario.today}"].is-today`)).toHaveCount(1);
    });
  }
}
