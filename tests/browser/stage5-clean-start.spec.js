const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: clean client start has no operational data and automation stays paused after reload`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.goto('/src/program-planner/' + (owner === 'NSA' ? 'nsa' : 'events') + '.html');
    for (let attempt = 0; attempt < 2; attempt++) {
      const frame = page.frames().find(item => item !== page.mainFrame());
      await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
      const snapshot = await frame.evaluate(() => {
        const workspace = UOS.ProgramApp.workspace();
        return {
          counts: Object.fromEntries(UOS.ProgramModel.collections.filter(name => name !== 'rateItems').map(name => [name, workspace.entities[name].length])),
          rates: workspace.entities.rateItems.length,
          automation: workspace.statusControl
        };
      });
      expect(Object.values(snapshot.counts).every(count => count === 0)).toBe(true);
      expect(snapshot.rates).toBe(47);
      expect(snapshot.automation).toEqual({ automationEnabled: false, operatorName: '', enabledBy: '', enabledAt: '' });
      if (attempt === 0) await page.reload();
    }
  });
}
