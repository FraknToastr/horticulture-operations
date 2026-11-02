const {test, expect} = require('@playwright/test');
const {suppressBackupModalForFunctionalTest} = require('./test-helper.cjs');
for (const owner of ['NSA','EVT']) test(`${owner} Quote persists fields only on blur and flushes navigation`, async ({page}) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  await frame.evaluate(async owner => {
    const id = owner + (owner === 'NSA' ? '-APP-' : '-EVENT-') + 'FOCUS-SAVE';
    await UOS.ProgramApp.updateWorkspace(w => {
      w.entities[owner === 'NSA' ? 'applications' : 'events'].push({id, owner, title: 'Field commit test', status:'received', dateReceived:'2026-11-02', raw:{}});
      return UOS.ProgramModel.promoteRegisterRecord(w,id).workspace;
    });
    await UOS.ProgramApp.navigateWithContext('quotes', id);
    UOS.ProgramPrivacy.setEnabled(false);
  }, owner);
  await frame.waitForTimeout(200);
  await frame.evaluate(() => {
    window.fieldSaves = 0;
    const save = UOS.ProgramStorage.saveValidated;
    UOS.ProgramStorage.saveValidated = function(...args) {
      window.fieldSaves++;
      if (window.delayNextFieldSave) {
        window.delayNextFieldSave = false;
        return new Promise(resolve => { window.releaseFieldSave = resolve; }).then(() => save.apply(this,args));
      }
      return save.apply(this,args);
    };
  });
  const input = frame.locator('[data-quote-client]');
  await input.fill('Changed while focused');
  await frame.waitForTimeout(350);
  expect(await frame.evaluate(() => window.fieldSaves)).toBe(0);
  await expect(input).toBeFocused();
  await input.press('Tab');
  await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().entities.quotes[0]?.clientName)).toBe('Changed while focused');
  expect(await frame.evaluate(() => window.fieldSaves)).toBe(1);
  await frame.evaluate(() => { window.delayNextFieldSave = true; });
  await input.fill('Earlier delayed edit');
  await input.press('Tab');
  await expect.poll(() => frame.evaluate(() => typeof window.releaseFieldSave)).toBe('function');
  await input.fill('Newer unsaved edit');
  await frame.evaluate(() => window.releaseFieldSave());
  await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().entities.quotes[0]?.clientName)).toBe('Earlier delayed edit');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Newer unsaved edit');
  await input.press('Tab');
  await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().entities.quotes[0]?.clientName)).toBe('Newer unsaved edit');
  await input.fill('Navigation flush');
  await frame.evaluate(() => UOS.ProgramApp.navigate('planner'));
  await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().entities.quotes[0]?.clientName)).toBe('Navigation flush');
  await frame.evaluate(() => UOS.ProgramApp.navigate('quotes'));
  await expect(input).toHaveValue('Navigation flush');
  const email = frame.locator('[data-quote-email]');
  await email.fill('not-an-email');
  const validation = await frame.evaluate(async () => {
    try { await UOS.ProgramApp.navigate('planner'); return 'unexpected navigation'; }
    catch (error) { return error.message; }
  });
  expect(validation).toMatch(/Correct the Quote field/);
  await expect(email).toHaveValue('not-an-email');
  expect(await frame.evaluate(() => UOS.ProgramApp.workspace().workspace.destination)).toBe('quotes');
  await email.fill('valid@example.com');
  await frame.evaluate(() => UOS.ProgramFieldCommits.flushAll());
  await input.fill('Retry retained text');
  await frame.evaluate(() => {
    const save = UOS.ProgramStorage.saveValidated;
    UOS.ProgramStorage.saveValidated = function(...args) {
      UOS.ProgramStorage.saveValidated = save;
      return Promise.reject(new Error('Simulated focused save failure'));
    };
  });
  const failure = await frame.evaluate(async () => {
    try { await UOS.ProgramApp.navigate('planner'); return 'unexpected navigation'; }
    catch (error) { return error.message; }
  });
  expect(failure).toMatch(/Simulated focused save failure/);
  await expect(input).toHaveValue('Retry retained text');
  expect(await frame.evaluate(() => UOS.ProgramApp.workspace().workspace.destination)).toBe('quotes');
  await frame.evaluate(() => UOS.ProgramApp.navigate('planner'));
  expect(await frame.evaluate(() => UOS.ProgramApp.workspace().entities.quotes[0].clientName)).toBe('Retry retained text');
});
