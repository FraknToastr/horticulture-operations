const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');
async function setup(page, owner, protectedItem = false) {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1840, height: 900 });
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(frame => frame !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  await frame.evaluate(async ({ owner, protectedItem }) => {
    await window.UOS.ProgramApp.updateWorkspace(ws => {
      const record = { id: `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-BULK-TOOLS`, owner, title: 'Calculator bulk tools', status: owner === 'NSA' ? 'received' : 'enquiry' };
      ws.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
      const promoted = window.UOS.ProgramModel.promoteRegisterRecord(ws, record.id);
      ws = window.UOS.ProgramStatus.migrate(promoted.workspace);
      const api = window.UOS.ProgramCosting;
      ws.workspace.selectedEntityId = record.id;
      ws.workspace.selectedProjectId = promoted.project.id;
      for (const kind of api.categories) {
        const rateItemId = `RATE-BULK-UI-${kind}`;
        ws = api.upsertRateItem(ws, { id: rateItemId, kind, kindSource: 'user', category: 'Preparation', description: 'Bulk ' + kind, unit: 'each', unitRate: 10, active: true, schedulerEnabled: kind === 'Labour' });
        ws = api.createWork(ws, promoted.project.id, rateItemId, { quantity: 1 }, { operationId: kind });
      }
      if (protectedItem) {
        ws = api.createWork(ws, promoted.project.id, 'RATE-BULK-UI-Equipment', { quantity: 1 }, { operationId: 'protected' });
        ws.entities.costingLines.find(l => l.operationId === 'protected').actualCost = 1;
      }
      ws = window.UOS.ProgramQuotes.saveDraft(ws, { projectId: promoted.project.id, quoteDate: '2026-10-02', fundingMode: 'mixed', proposedCustomerContribution: 90 });
      return ws;
    });
    await window.UOS.ProgramApp.navigate('costing');
  }, { owner, protectedItem });
  return frame;
}
const kinds = ['Labour', 'Equipment', 'Material', 'Contractors', 'Sundry'];
for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: Tools match Library, disclose independently and delete each kind with protection`, async ({ page }, testInfo) => {
    const frame = await setup(page, owner, true);
    const tools = frame.locator('[data-calculator-tools-toggle]'), drawer = frame.locator('[data-calculator-tools]');
    const libraryTools = frame.locator('[data-costing-tools-toggle]');
    await expect(drawer).toBeHidden();
    const geometry = await tools.evaluate(button => { const library = document.querySelector('[data-costing-tools-toggle]'); const a = button.getBoundingClientRect(), b = library.getBoundingClientRect(), head = button.parentElement.getBoundingClientRect(); return { height: a.height, width: a.width, otherHeight: b.height, otherWidth: b.width, rightGap: head.right - a.right, padding: getComputedStyle(button).padding, otherPadding: getComputedStyle(library).padding }; });
    expect(geometry.height).toBeCloseTo(geometry.otherHeight, 1);
    expect(geometry.width).toBeCloseTo(geometry.otherWidth, 1);
    expect(geometry.padding).toBe(geometry.otherPadding);
    expect(geometry.rightGap).toBeLessThan(20);
    await libraryTools.click(); await tools.click();
    await expect(frame.locator('[data-costing-tools]')).toBeVisible();
    await expect(drawer).toBeVisible();
    await frame.locator('[data-calculator-delete-kind="All"]').press('Escape');
    await expect(drawer).toBeHidden(); await expect(tools).toBeFocused();
    await expect(frame.locator('[data-costing-tools]')).toBeVisible();
    await libraryTools.click(); await tools.click();
    for (const width of [1840, 390]) for (const font of ['normal', 'dyslexic']) {
      await page.setViewportSize({ width, height: 900 });
      await frame.evaluate(async ({ width, font }) => { document.documentElement.dataset.suiteFont = font; document.querySelector('.program-job-calculator').style.maxWidth = width === 390 ? '350px' : ''; await document.fonts.ready; }, { width, font });
      const layout = await drawer.evaluate(drawer => { const bounds = drawer.getBoundingClientRect(), pane = drawer.parentElement, footer = pane.querySelector('.program-cost-totals').getBoundingClientRect(); return { buttonsFit: [...drawer.querySelectorAll('button')].every(button => { const r = button.getBoundingClientRect(); return r.left >= bounds.left && r.right <= bounds.right && r.bottom <= bounds.bottom; }), footerFits: footer.bottom <= pane.getBoundingClientRect().bottom + 1, tableHeight: pane.querySelector('.program-calculator-table-wrap').clientHeight }; });
      expect(layout.buttonsFit).toBe(true); expect(layout.footerFits).toBe(true); expect(layout.tableHeight).toBeGreaterThan(0);
    }
    await page.setViewportSize({ width: 1840, height: 900 });
    await frame.evaluate(() => { document.querySelector('.program-job-calculator').style.maxWidth = ''; });
    await frame.locator('.program-costing-workspace').screenshot({ path: testInfo.outputPath(`${owner}-calculator-tools.png`) });
    await frame.locator('[data-calculator-delete-kind="All"]').click();
    await expect(frame.getByRole('dialog')).toContainText('5 items eligible');
    await frame.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(frame.locator('[data-calculator-delete-kind="All"]')).toBeFocused();
    await expect(frame.locator('[data-costing-line-quantity]')).toHaveCount(6);
    await frame.evaluate(() => { const save = window.UOS.ProgramStorage.saveValidated; window.bulkSaveCount = 0; window.UOS.ProgramStorage.saveValidated = function (ws) { window.bulkSaveCount++; if (window.bulkSaveCount === 1) return new Promise(resolve => { window.resumeBulkSave = () => resolve(save(ws)); }); return save(ws); }; });
    for (let i = 0; i < kinds.length; i++) {
      await frame.locator(`[data-calculator-delete-kind="${kinds[i]}"]`).click();
      await frame.getByRole('dialog').getByRole('button', { name: 'Delete 1 items', exact: true }).click();
      if (i === 0) {
        await frame.waitForFunction(() => typeof window.resumeBulkSave === 'function');
        for (const button of await frame.locator('[data-calculator-delete-kind]').all()) await expect(button).toBeDisabled();
        expect(await frame.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(6);
        await frame.evaluate(() => window.resumeBulkSave());
      }
      await expect(frame.locator('[data-costing-line-quantity]')).toHaveCount(5 - i);
      await expect.poll(() => frame.evaluate(() => window.bulkSaveCount)).toBe(i + 1);
      await expect(frame.locator('[data-calculator-delete-result]')).toContainText('Deleted 1 items.');
    }
    await expect(frame.locator('[data-calculator-delete-kind="Labour"]')).toBeDisabled();
    await frame.locator('[data-calculator-delete-kind="All"]').click();
    await expect(frame.getByRole('dialog')).toHaveCount(0);
    await expect(frame.locator('[data-calculator-delete-result]')).toContainText('1 protected items will be retained');
    const saved = await frame.evaluate(() => ({ jobs: window.UOS.ProgramApp.workspace().entities.jobs.length, quote: window.UOS.ProgramApp.workspace().entities.quotes[0] }));
    expect(saved.jobs).toBe(0); expect(saved.quote.subtotal).toBe(10); expect(saved.quote.proposedCustomerContribution).toBe(90);
    await page.reload();
    const reloaded = page.frames().find(frame => frame !== page.mainFrame());
    await reloaded.waitForFunction(() => window.UOS.ProgramApp?.snapshot().phase === 'ready');
    await expect.poll(() => reloaded.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(1);
  });

  test(`${owner}: changed scopes require new confirmation, Delete All saves once and storage failure preserves work`, async ({ page }) => {
    const frame = await setup(page, owner);
    await frame.locator('[data-calculator-tools-toggle]').click();
    await frame.locator('[data-calculator-delete-kind="All"]').click();
    await frame.evaluate(async () => { await window.UOS.ProgramApp.updateWorkspace(ws => window.UOS.ProgramCosting.createWork(ws, ws.workspace.selectedProjectId, 'RATE-BULK-UI-Material', { quantity: 1 }, { operationId: 'changed-scope' })); });
    await frame.getByRole('dialog').getByRole('button', { name: 'Delete 5 items', exact: true }).click();
    await expect(frame.getByRole('dialog')).toContainText('6 items eligible');
    await expect(frame.locator('[data-costing-line-quantity]')).toHaveCount(6);
    await frame.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await frame.evaluate(() => { const save = window.UOS.ProgramStorage.saveValidated; window.restoreBulkSave = () => { window.UOS.ProgramStorage.saveValidated = save; }; window.UOS.ProgramStorage.saveValidated = () => Promise.reject(new Error('Bulk storage test failure')); });
    await frame.locator('[data-calculator-delete-kind="All"]').click();
    await frame.getByRole('dialog').getByRole('button', { name: 'Delete 6 items', exact: true }).click();
    await expect(frame.locator('[data-calculator-delete-result]')).toContainText('No bulk deletion was saved');
    await expect(frame.locator('[data-costing-line-quantity]')).toHaveCount(6);
    await frame.evaluate(() => { window.restoreBulkSave(); const save = window.UOS.ProgramStorage.saveValidated; window.bulkSaveCount = 0; window.UOS.ProgramStorage.saveValidated = function (ws) { window.bulkSaveCount++; return save(ws); }; });
    await frame.locator('[data-calculator-delete-kind="All"]').click();
    await frame.getByRole('dialog').getByRole('button', { name: 'Delete 6 items', exact: true }).click();
    await expect(frame.locator('[data-costing-line-quantity]')).toHaveCount(0);
    await expect.poll(() => frame.evaluate(() => window.bulkSaveCount)).toBe(1);
    await expect(frame.locator('[data-calculator-delete-kind="All"]')).toBeDisabled();
  });

  test(`${owner}: changing Project during confirmation cancels deletion`, async ({ page }) => {
    const frame = await setup(page, owner);
    await frame.locator('[data-calculator-tools-toggle]').click();
    await frame.locator('[data-calculator-delete-kind="All"]').click();
    await frame.evaluate(async owner => {
      await window.UOS.ProgramApp.updateWorkspace(ws => {
        const record = { id: `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-OTHER-BULK-UI`, owner, title: 'Other Project', status: owner === 'NSA' ? 'received' : 'enquiry' };
        ws.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
        const promoted = window.UOS.ProgramModel.promoteRegisterRecord(ws, record.id);
        ws = window.UOS.ProgramStatus.migrate(promoted.workspace);
        ws.workspace.selectedEntityId = record.id;
        ws.workspace.selectedProjectId = promoted.project.id;
        return window.UOS.ProgramCosting.createWork(ws, promoted.project.id, 'RATE-BULK-UI-Material', { quantity: 1 }, { operationId: 'other-project' });
      });
    }, owner);
    await frame.getByRole('dialog').getByRole('button', { name: 'Delete 5 items', exact: true }).click();
    await expect(frame.locator('[data-calculator-delete-result]')).toContainText('Project changed. No items were deleted.');
    expect(await frame.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(6);
    await expect(frame.locator('[data-costing-line-quantity]')).toHaveCount(1);
  });
}
