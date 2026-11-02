const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

for (const owner of ['NSA', 'EVT']) test(`${owner} privacy off preserves Quote editing and removes stale help`, async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  await frame.evaluate(async owner => {
    const id = owner + (owner === 'NSA' ? '-APP-' : '-EVENT-') + 'PRIVACY-EDIT';
    await UOS.ProgramApp.updateWorkspace(w => {
      w.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id, owner, title: 'Privacy test', status: 'received', dateReceived: '2026-11-02', raw: {} });
      return UOS.ProgramModel.promoteRegisterRecord(w, id).workspace;
    });
    await UOS.ProgramApp.navigateWithContext('quotes', id);
    UOS.ProgramPrivacy.setEnabled(false);
  }, owner);
  for (const selector of ['[data-quote-client]', '[data-quote-address]', '[data-quote-email]']) {
    const input = frame.locator(selector);
    await input.fill(selector.includes('email') ? 'person@example.com' : 'Private original');
  }
  await frame.evaluate(() => UOS.ProgramPrivacy.setEnabled(true));
  await expect(frame.locator('[data-quote-client]')).toHaveValue('**********');
  await frame.locator('[data-quote-client]').hover();
  await expect(frame.locator('#uos-shared-tooltip')).toBeVisible();
  await frame.evaluate(() => UOS.ProgramPrivacy.setEnabled(false));
  await expect(frame.locator('#uos-shared-tooltip')).toBeHidden();
  for (const selector of ['[data-quote-client]', '[data-quote-address]', '[data-quote-email]']) {
    const input = frame.locator(selector);
    await expect(input).toBeEditable();
    await expect(input).not.toHaveAttribute('data-uos-tooltip', /Privacy/);
    await input.focus();
    if (!selector.includes('email')) await input.evaluate(el => el.setSelectionRange(2, 5));
    await input.pressSequentially('XYZ');
    await expect(input).toBeFocused();
    const value = await input.inputValue();
    const selection = await input.evaluate(el => [el.selectionStart, el.selectionEnd]);
    await frame.evaluate(() => UOS.QuoteBuilderController.renderUI());
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(value);
    expect(await input.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual(selection);
  }
  await frame.evaluate(() => {
    const el = document.createElement('input');
    el.setAttribute('data-uos-tooltip', 'Original help');
    document.body.append(el);
    UOS.ProgramPrivacy.setEnabled(true);
    UOS.ProgramPrivacy.applyToInput(el, 'Private', 'clientName');
    UOS.ProgramPrivacy.setEnabled(false);
    UOS.ProgramPrivacy.applyToInput(el, 'Private', 'clientName');
    if (el.getAttribute('data-uos-tooltip') !== 'Original help') throw new Error('Lost original help');
    el.remove();
  });
});

for (const owner of ['NSA', 'EVT']) test(`${owner} delayed autosaves preserve active Quote input and latest draft`, async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  await frame.evaluate(async owner => {
    const id = owner + (owner === 'NSA' ? '-APP-' : '-EVENT-') + 'DELAYED-EDIT';
    await UOS.ProgramApp.updateWorkspace(w => {
      w.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id, owner, title: 'Delayed editing', status: 'received', dateReceived: '2026-11-02', raw: {} });
      return UOS.ProgramModel.promoteRegisterRecord(w, id).workspace;
    });
    await UOS.ProgramApp.navigateWithContext('quotes', id);
    UOS.ProgramPrivacy.setEnabled(false);
    const save = UOS.ProgramStorage.saveValidated;
    window.delayedSave = { calls: 0, completed: 0, held: true, releases: [] };
    UOS.ProgramStorage.saveValidated = async function (...args) {
      const state = window.delayedSave;
      state.calls++;
      if (state.held) await new Promise(resolve => state.releases.push(resolve));
      const result = await save.apply(this, args);
      state.completed++;
      return result;
    };
  }, owner);
  const input = frame.locator('[data-quote-client]');
  await input.fill('First name');
  expect(await frame.evaluate(() => delayedSave.calls)).toBe(0);
  await input.press('Tab');
  await expect.poll(() => frame.evaluate(() => delayedSave.calls)).toBeGreaterThan(0);
  await input.focus();
  await input.evaluate(el => {
    window.originalQuoteInput = el;
    window.quoteInputDetachments = 0;
    const observer = new MutationObserver(records => {
      if (records.some(record => Array.from(record.removedNodes).some(node => node === el || node.contains?.(el)))) window.quoteInputDetachments++;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.quoteInputObserver = observer;
    el.setSelectionRange(0, 5);
  });
  await input.pressSequentially('Latest');
  await expect(input).toHaveValue('Latest name');
  const selection = await input.evaluate(el => [el.selectionStart, el.selectionEnd]);
  await frame.evaluate(() => {
    delayedSave.held = false;
    delayedSave.releases.splice(0).forEach(release => release());
  });
  await expect.poll(() => frame.evaluate(() => {
    const quote = UOS.ProgramApp.workspace().entities.quotes.find(q => q.status === 'Draft');
    return quote?.clientName;
  })).toBe('First name');
  await expect.poll(() => frame.evaluate(() => delayedSave.completed === delayedSave.calls)).toBe(true);
  expect(await frame.evaluate(() => quoteInputDetachments)).toBe(0);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Latest name');
  expect(await frame.evaluate(() => originalQuoteInput === document.activeElement)).toBe(true);
  expect(await input.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual(selection);
  await input.press('Tab');
  await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().entities.quotes.find(q => q.status === 'Draft')?.clientName)).toBe('Latest name');
  await frame.evaluate(async () => {
    quoteInputObserver.disconnect();
    await UOS.ProgramApp.navigate('register');
    await UOS.ProgramApp.navigateWithContext('quotes', UOS.ProgramApp.workspace().entities[UOS.ProgramApp.workspace().workspace.ownerMode === 'EVT' ? 'events' : 'applications'][0].id);
  });
  await expect(frame.locator('[data-quote-client]')).toHaveValue('Latest name');
});
