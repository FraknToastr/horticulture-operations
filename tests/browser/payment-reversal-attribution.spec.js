const {test, expect} = require('@playwright/test');
const {suppressBackupModalForFunctionalTest} = require('./test-helper.cjs');

for (const owner of ['NSA', 'EVT']) {
  test(owner + ': manual officer works without session storage and reversal commit failure is atomic and retryable', async ({page}) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.goto('/src/program-planner/' + (owner === 'NSA' ? 'nsa' : 'events') + '.html');
    const f = page.frames().find(frame => frame !== page.mainFrame());
    await f.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
    const paymentId = await f.evaluate(async owner => {
      const recordId = owner + (owner === 'NSA' ? '-APP-' : '-EVENT-') + 'REVERSAL-ATOMIC';
      let paymentId;
      await UOS.ProgramApp.updateWorkspace(w => {
        w.entities[owner === 'NSA' ? 'applications' : 'events'].push({id: recordId, owner, title: 'Synthetic reversal atomicity', status: 'received', dateReceived: '2026-10-18'});
        const promoted = UOS.ProgramModel.promoteRegisterRecord(w, recordId);
        w = promoted.workspace;
        const projectId = promoted.project.id;
        w.entities.costingLines.push({id: owner + '-COST-REVERSAL-ATOMIC', owner, type: 'costingLine', projectId, kind: 'Material', description: 'Synthetic receipt work', quantity: 1, unitRate: 100, estimatedTotal: 100});
        w = UOS.ProgramQuotes.saveDraft(w, {projectId, quoteDate: '2026-10-18', scopeNotes: 'Reversal atomicity test', fundingMode: 'customer'});
        const quoteId = w.entities.quotes.find(quote => quote.projectId === projectId).id;
        w = UOS.ProgramQuotes.recordPayment(w, {quoteId, amount: 20, paymentDate: '2026-10-18', method: 'Paid with Deposit', reference: 'REVERSAL-ATOMIC'});
        paymentId = w.entities.payments.find(payment => payment.quoteId === quoteId).id;
        return w;
      });
      await UOS.ProgramApp.navigateWithContext('quotes', recordId);
      return paymentId;
    }, owner);
    await f.locator('[data-quote-section-link="5"]').click();
    await expect(f.locator('[data-payment-paid]')).toHaveText('$20.00');
    const before = await f.evaluate(() => JSON.stringify(UOS.ProgramApp.workspace().entities));
    const durableBefore = await f.evaluate(async () => JSON.stringify((await UOS.ProgramStorage.get()).entities));
    await f.evaluate(() => {
      window.stage5SessionGet = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (key === 'uos.program.statusOperator') throw new Error('Synthetic blocked operator session storage');
        return window.stage5SessionGet.call(this, key);
      };
      window.stage5OriginalCommit = UOS.storage.commitRevision;
      UOS.storage.commitRevision = () => Promise.reject(new Error('Synthetic reversal commit failure'));
    });
    await f.locator('[data-payment-reverse="' + paymentId + '"]').click();
    const dialog = f.getByRole('dialog');
    await expect(dialog).toContainText('Reverse payment?');
    await expect(dialog.locator('[data-payment-reversal-actor]')).toHaveValue('');
    await dialog.locator('[data-payment-reversal-actor]').fill('Manual Audit Officer');
    await dialog.locator('textarea').fill('Incorrect deposit reference');
    await dialog.getByRole('button', {name: 'Reverse payment', exact: true}).click();
    await expect(dialog).toContainText('Synthetic reversal commit failure');
    expect(await f.evaluate(() => JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(before);
    expect(await f.evaluate(async () => JSON.stringify((await UOS.ProgramStorage.get()).entities))).toBe(durableBefore);
    await expect(f.locator('[data-payment-paid]')).toHaveText('$20.00');
    await f.evaluate(() => {
      UOS.storage.commitRevision = window.stage5OriginalCommit;
      Storage.prototype.getItem = window.stage5SessionGet;
    });
    await dialog.getByRole('button', {name: 'OK', exact: true}).click();
    await f.locator('[data-payment-reverse="' + paymentId + '"]').click();
    await expect(dialog).toContainText('Reverse payment?');
    await dialog.locator('[data-payment-reversal-actor]').fill('Manual Audit Officer');
    await dialog.locator('textarea').fill('Incorrect deposit reference');
    await dialog.getByRole('button', {name: 'Reverse payment', exact: true}).click();
    await expect(f.locator('[data-payment-paid]')).toHaveText('$0.00');
    expect(await f.evaluate(async id => {
      const payment = (await UOS.ProgramStorage.get()).entities.payments.find(payment => payment.id === id);
      return {status: payment.status, actor: payment.reversedBy, reason: payment.reversalReason};
    }, paymentId)).toEqual({status: 'Reversed', actor: 'Manual Audit Officer', reason: 'Incorrect deposit reference'});
  });
}
