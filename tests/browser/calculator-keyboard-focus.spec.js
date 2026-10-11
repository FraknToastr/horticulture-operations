const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.use({ viewport: { width: 1440, height: 900 }, screenshot: 'off', trace: 'off', video: 'off' });

async function start(page, owner, theme = 'light') {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(candidate => candidate !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  const lines = await frame.evaluate(async ({ owner, theme }) => {
    document.documentElement.setAttribute('data-suite-theme', theme);
    const recordId = `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-KEYBOARD`;
    let projectId;
    await UOS.ProgramApp.updateWorkspace(workspace => {
      workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id: recordId, owner, title: 'Keyboard test', status: 'received', dateReceived: '2026-10-01' });
      const promoted = UOS.ProgramModel.promoteRegisterRecord(workspace, recordId);
      projectId = promoted.project.id;
      let next = UOS.ProgramCosting.upsertRateItem(UOS.ProgramStatus.migrate(promoted.workspace), { id: 'RATE-KEYBOARD', description: 'Keyboard material', kind: 'Material', category: 'Material', unit: 'each', unitRate: 10, quantityMode: 'direct', schedulerEnabled: false });
      for (const operationId of ['first', 'second']) next = UOS.ProgramCosting.createWork(next, projectId, 'RATE-KEYBOARD', { quantity: 1 }, { operationId });
      next.workspace.selectedProjectId = projectId;
      next.workspace.selectedEntityId = recordId;
      next.workspace.costing = { selectedProjectId: projectId, section: 'Material', mode: owner === 'NSA' ? 'applications' : 'events' };
      return next;
    });
    await UOS.ProgramApp.navigate('costing');
    return UOS.ProgramApp.workspace().entities.costingLines.filter(line => line.projectId === projectId).map(line => line.id);
  }, { owner, theme });
  await expect(frame.locator(`[data-costing-line-quantity="${lines[0]}"]`)).toBeVisible();
  return { frame, lines };
}

async function saved(frame, id, field, value) {
  await expect.poll(() => frame.evaluate(({ id, field }) => UOS.ProgramApp.workspace().entities.costingLines.find(line => line.id === id)[field], { id, field })).toBe(value);
  // Allow the post-save redraw and drawer remount to finish before checking focus.
  await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

for (const owner of ['NSA', 'EVT']) {
  for (const theme of ['light', 'dark']) {
    test(`${owner} ${theme}: saved edits preserve forward and reverse keyboard navigation`, async ({ page }) => {
      const { frame, lines: [first, second] } = await start(page, owner, theme);
      const quantity = frame.locator(`[data-costing-line-quantity="${first}"]`);
      const unit = frame.locator(`[data-costing-line-unit="${first}"]`);
      const rate = frame.locator(`[data-costing-line-rate="${first}"]`);
      const remove = frame.locator(`[data-costing-remove="${first}"]`);
      await quantity.fill('2');
      await quantity.press('Tab');
      await saved(frame, first, 'quantity', 2);
      await expect(unit).toBeFocused();

      await unit.selectOption('hour');
      await saved(frame, first, 'unit', 'hour');
      await expect(unit).toBeFocused();
      await unit.press('Tab');
      await expect(rate).toBeFocused();
      await rate.fill('17');
      await rate.press('Tab');
      await saved(frame, first, 'unitRate', 17);
      await expect(remove).toBeFocused();
      await expect(frame.locator(`[data-costing-line-total="${first}"]`)).toHaveText('$34.00');

      const secondQuantity = frame.locator(`[data-costing-line-quantity="${second}"]`);
      await remove.press('Tab');
      await expect(secondQuantity).toBeFocused();
      await secondQuantity.fill('3');
      await secondQuantity.press('Shift+Tab');
      await saved(frame, second, 'quantity', 3);
      await expect(remove).toBeFocused();
      const secondRate = frame.locator(`[data-costing-line-rate="${second}"]`);
      await secondRate.fill('19');
      await secondRate.press('Shift+Tab');
      await saved(frame, second, 'unitRate', 19);
      await expect(frame.locator(`[data-costing-line-unit="${second}"]`)).toBeFocused();
      await expect(quantity).toHaveValue('2');
      await expect(rate).toHaveValue('17');
      await expect(frame.locator(`[data-costing-line-total="${second}"]`)).toHaveText('$57.00');
    });
  }

  test(`${owner}: a pending save does not take focus from a dialog or another module`, async ({ page }) => {
    const { frame, lines: [id] } = await start(page, owner);
    await frame.evaluate(() => {
      const original = UOS.ProgramStorage.saveValidated;
      UOS.ProgramStorage.saveValidated = function (workspace) {
        return new Promise(resolve => {
          window.releaseKeyboardSave = () => { UOS.ProgramStorage.saveValidated = original; resolve(original(workspace)); };
        });
      };
    });
    const quantity = frame.locator(`[data-costing-line-quantity="${id}"]`);
    await quantity.fill('4');
    await quantity.press('Tab');
    await frame.waitForFunction(() => typeof window.releaseKeyboardSave === 'function');
    await frame.evaluate(() => {
      const dialog = document.createElement('dialog');
      dialog.id = 'keyboard-focus-dialog';
      dialog.innerHTML = '<label>Dialog field<input id="keyboard-dialog-field"></label>';
      document.body.appendChild(dialog);
      dialog.showModal();
      dialog.querySelector('input').focus();
      window.releaseKeyboardSave();
    });
    await saved(frame, id, 'quantity', 4);
    await expect(frame.locator('#keyboard-dialog-field')).toBeFocused();
    await frame.evaluate(() => { const dialog = document.querySelector('#keyboard-focus-dialog'); dialog.close(); dialog.remove(); });
    await frame.evaluate(() => UOS.ProgramApp.navigate('quotes'));
    const email = frame.locator('[data-quote-email]');
    await email.focus();
    await frame.evaluate(() => UOS.ProgramApp.updateWorkspace(workspace => { workspace.entities.projects[0].title = 'Renamed while viewing Quotes'; return workspace; }));
    await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(email).toBeFocused();
  });
}
