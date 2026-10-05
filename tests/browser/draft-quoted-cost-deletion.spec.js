const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: Draft-quoted unscheduled costs can be removed while financial history remains protected`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const checks = await child.evaluate(async owner => {
      const { ProgramApp: app, ProgramModel: model, ProgramQuotes: quotes, ProgramCosting: costs } = window.UOS;
      let projectId, quoteId; const lineId = owner + "-COST-DRAFT-DELETE";
      await app.updateWorkspace(ws => {
        const record = { id: `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-DRAFT-DELETE`, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Draft deletion regression', status: owner === 'NSA' ? 'received' : 'enquiry' };
        ws.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
        const promoted = model.promoteRegisterRecord(ws, record.id);
        ws = promoted.workspace; projectId = promoted.project.id;
        ws.entities.costingLines.push({ id: lineId, owner, type: 'costingLine', projectId, jobId: null, kind: 'Labour', description: 'Horticulture Labour rate - Monday to Friday 6pm - 6am', quantity: 1, unitRate: 141, estimatedTotal: 141 });
        ws.workspace.selectedEntityId = record.id;
        ws.workspace.selectedProjectId = projectId;
        ws = quotes.saveDraft(ws, { projectId, quoteDate: '2026-10-02', scopeNotes: 'Delivery work', fundingMode: 'customer' });
        quoteId = ws.entities.quotes[0].id;
        return ws;
      });
      const original = app.workspace();
      function failure(ws) { try { costs.removeLine(ws, lineId); return null; } catch (error) { return error.message; } }
      const issued = quotes.issue(original, quoteId);
      const accepted = quotes.accept(issued, quoteId);
      const declined = quotes.decline(issued, quoteId);
      const paid = quotes.recordPayment(original, { quoteId, amount: 10, paymentDate: '2026-10-02', reference: 'TEST-DEPOSIT' });
      const reversed = quotes.reversePayment(paid, paid.entities.payments[0].id, 'Test reversal');
      const allocated = quotes.recordPayment(original, { quoteId, amount: 10, paymentDate: '2026-10-02', reference: 'ALLOCATED-DEPOSIT', allocations: [{ quoteLineId: original.entities.quoteLines[0].id, amount: 10 }] });
      const reversedAllocation = quotes.reversePayment(allocated, allocated.entities.payments[0].id, 'Test allocation reversal');
      const actual = structuredClone(original); actual.entities.costingLines[0].actualCost = 0;
      const mixed = quotes.saveDraft(original, { id: quoteId, projectId, fundingMode: 'mixed', proposedCustomerContribution: 200 });
      const removed = costs.removeLine(mixed, lineId);
      return { issued: failure(issued), accepted: failure(accepted), declined: failure(declined), paid: failure(paid), actual: failure(actual), reversed: failure(reversed), reversedAllocation: failure(reversedAllocation), removed: { lines: removed.entities.costingLines.length, quoteLines: removed.entities.quoteLines.length, subtotal: removed.entities.quotes[0].subtotal, contribution: removed.entities.quotes[0].proposedCustomerContribution, mode: removed.entities.quotes[0].fundingMode }, originalLines: original.entities.costingLines.length };
    }, owner);
    for (const status of ['issued', 'accepted', 'declined']) expect(checks[status]).toMatch(/Quotes protect/);
    expect(checks.paid).toMatch(/Reverse active payments/);
    expect(checks.actual).toMatch(/financial history/);
    expect(checks.reversed).toBeNull();
    expect(checks.reversedAllocation).toMatch(/Payment allocation history/);
    expect(checks.removed).toEqual({ lines: 0, quoteLines: 0, subtotal: 0, contribution: 200, mode: 'mixed' });
    expect(checks.originalLines).toBe(1);
    await child.locator('[data-program-destination="costing"]').click();
    await child.locator(`[data-costing-remove="${owner}-COST-DRAFT-DELETE"]`).click();
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(0);
    await expect(child.locator('[data-costing-error]')).toBeHidden();
    await child.evaluate(async owner => {
      await window.UOS.ProgramApp.updateWorkspace(ws => {
        const quote = ws.entities.quotes[0];
        ws.entities.costingLines.push({ id: owner + '-COST-PROTECTED', owner, type: 'costingLine', projectId: quote.projectId, jobId: null, kind: 'Labour', description: 'Protected issued cost', quantity: 1, unitRate: 50, estimatedTotal: 50 });
        ws = window.UOS.ProgramQuotes.saveDraft(ws, { id: quote.id, projectId: quote.projectId, refreshCosts: true });
        return window.UOS.ProgramQuotes.issue(ws, quote.id);
      });
    }, owner);
    await child.locator(`[data-costing-remove="${owner}-COST-PROTECTED"]`).click();
    await expect(child.locator('[data-costing-error]')).toContainText('Quotes protect');
    await child.evaluate(async () => { await window.UOS.ProgramApp.updateWorkspace(ws => ws); });
    await expect(child.locator('[data-costing-error]')).toBeVisible();
    await expect(child.locator('[data-costing-error]')).toContainText('Quotes protect');
  });
}
