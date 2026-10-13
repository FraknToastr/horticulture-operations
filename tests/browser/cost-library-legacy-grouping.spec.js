const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test('imported legacy rates appear in each of the five Cost Library menus', async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/src/program-planner/nsa.html');
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  await frame.evaluate(async () => {
    await UOS.ProgramApp.updateWorkspace(w => {
      w.entities.applications.push({ id: 'NSA-APP-LEGACY-GROUP', owner: 'NSA', type: 'application', title: 'Grouping fixture', status: 'received', dateReceived: '2026-10-11' });
      const promoted = UOS.ProgramModel.promoteRegisterRecord(w, 'NSA-APP-LEGACY-GROUP');
      w = promoted.workspace; w.workspace.selectedEntityId = promoted.project.id; w.workspace.selectedProjectId = promoted.project.id;
      const fixtures = [
        ['Labour', 'City Operations', 'Ground crew hours'],
        ['Equipment', 'Infrastructure', 'Barrier installation'],
        ['Material', 'Soil / top dress', 'Compost supply'],
        ['Contractors', 'Plant Hire/Contractors (external)', 'Machine hire'],
        ['Sundry', 'Sundry Costs', 'Permit fee']
      ];
      w.entities.rateItems.push(...fixtures.map(([kind, category, description]) => ({
        id: 'RATE-GROUP-' + kind, kind: 'Labour', catalogSection: 'Labour', libraryCategory: 'Labour',
        category, description, unit: 'item', unitRate: 12, active: true, schedulerEnabled: true,
        provenance: { migrationKind: 'catalog-rate-clone', sourceVersion: 3 }
      })));
      return w;
    });
    await UOS.ProgramApp.navigate('costing');
  });
  for (const kind of ['Labour', 'Equipment', 'Material', 'Contractors', 'Sundry']) {
    await frame.locator(`[data-costing-section="${kind}"]`).click();
    await expect(frame.locator(`[data-costing-section="${kind}"]`)).toHaveAttribute('aria-selected', 'true');
    await expect(frame.locator('[data-rate-item-row^="RATE-GROUP-"]')).toHaveCount(1);
    await expect(frame.locator(`[data-rate-item-row="RATE-GROUP-${kind}"]`)).toBeVisible();
    await expect(frame.locator(`[data-costing-scheduler-info="RATE-GROUP-${kind}"]`)).toHaveCount(['Labour', 'Contractors'].includes(kind) ? 1 : 0);
  }
});
