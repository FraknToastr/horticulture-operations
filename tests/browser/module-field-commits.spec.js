const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

for (const owner of ['NSA', 'EVT']) test(`${owner} Register and Calculator commit only after field focus leaves`, async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(item => item !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  const id = `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-FIELD-COMMIT`;
  await frame.evaluate(async ({ owner, id }) => {
    await UOS.ProgramApp.updateWorkspace(w => {
      w.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Field commit fixture', status: 'received', dateReceived: '2026-11-02' });
      return UOS.ProgramModel.promoteRegisterRecord(w, id).workspace;
    });
    UOS.ProgramPrivacy.setEnabled(false);
  }, { owner, id });
  await frame.locator(`tr[data-register-record="${id}"] [data-disclosure-toggle]`).click();
  const name = frame.locator(`[data-register-drawer-record="${id}"] [data-register-edit-key="address"]`);
  await expect(name).toBeVisible();
  await frame.evaluate(() => {
    window.fieldWrites = 0;
    const save = UOS.ProgramStorage.saveValidated;
    UOS.ProgramStorage.saveValidated = function (...args) { window.fieldWrites++; return save.apply(this, args); };
  });
  await name.fill('Changed after blur');
  expect(await frame.evaluate(() => window.fieldWrites)).toBe(0);
  await name.blur();
  await expect.poll(() => frame.evaluate(({ owner, id }) => UOS.ProgramApp.workspace().entities[owner === 'NSA' ? 'applications' : 'events'].find(r => r.id === id).address, { owner, id })).toBe('Changed after blur');
  await frame.evaluate(async id => {
    await UOS.ProgramApp.updateWorkspace(w => {
      let next = UOS.ProgramCosting.upsertRateItem(w, { id: 'RATE-FIELD-COMMIT', description: 'Field fixture', kind: 'Material', category: 'Material', unit: 'each', unitRate: 10, quantityMode: 'direct', schedulerEnabled: false });
      const project = next.entities.projects.find(p => (p.applicationId || p.eventId) === id);
      return UOS.ProgramCosting.createWork(next, project.id, 'RATE-FIELD-COMMIT', { quantity: 1 }, { operationId: 'field-fixture' });
    });
    await UOS.ProgramApp.navigateWithContext('costing', id);
  }, id);
  const quantity = frame.locator('[data-costing-line-quantity]').first();
  await expect(quantity).toBeVisible();
  await frame.evaluate(() => { window.fieldWrites = 0; });
  await quantity.fill('7');
  expect(await frame.evaluate(() => window.fieldWrites)).toBe(0);
  await quantity.blur();
  await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().entities.costingLines[0].quantity)).toBe(7);
});
