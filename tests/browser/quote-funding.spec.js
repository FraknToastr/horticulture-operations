const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');
const { execFileSync } = require('node:child_process');
async function verifyPdf(page, child, owner, mode, expected) {
  const path = test.info().outputPath(`${owner}-${mode}-quote.pdf`);
  // Exercise the actual hosted print action first. Chromium's PDF API targets
  // the top document, so render its complete live DOM snapshot for PDF proof.
  // Keep the Register ancestors in that snapshot to catch blank-page regressions.
  await child.evaluate(() => { window.print = () => window.dispatchEvent(new Event('beforeprint')); });
  await child.locator('[data-quote-print]').click();
  await expect(child.locator('[data-quote-print-host]')).toBeAttached();
  const documentHtml = await child.evaluate(() => {
    const copy = document.documentElement.cloneNode(true);
    copy.querySelectorAll('script').forEach(node => node.remove());
    const base = document.createElement('base'); base.href = location.href;
    copy.querySelector('head').prepend(base);
    return '<!doctype html>' + copy.outerHTML;
  });
  const printPage = await page.context().newPage();
  await printPage.setContent(documentHtml, { waitUntil: 'networkidle' });
  await printPage.emulateMedia({ media: 'print' });
  await printPage.pdf({ path, format: 'A4', printBackground: true });
  const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
  for (const phrase of expected) expect(text).toContain(phrase);
  await printPage.close();
  await child.evaluate(() => window.dispatchEvent(new Event('afterprint')));
}

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: funding choice, retained contribution, agreement and City print`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.setViewportSize({ width: 1600, height: 1000 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const projectId = await child.evaluate(async owner => {
      const recordId = owner + (owner === 'NSA' ? '-APP-FUNDING-UI' : '-EVENT-FUNDING-UI');
      let projectId;
      await window.UOS.ProgramApp.updateWorkspace(ws => {
        ws.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id: recordId, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Funding test', status: owner === 'NSA' ? 'received' : 'enquiry', dateReceived: '2026-10-01' });
        const promoted = window.UOS.ProgramModel.promoteRegisterRecord(ws, recordId);
        ws = promoted.workspace; projectId = promoted.project.id;
        ws.entities.projects.find(project => project.id === projectId).funding = { operationalAmount: 40 };
        ws.entities.costingLines.push({ id: owner + '-COST-FUNDING-UI', owner, type: 'costingLine', projectId, jobId: null, description: 'Costing-only Labour', kind: 'Labour', quantity: 2, unitRate: 50, estimatedTotal: 100 });
        ws.workspace.selectedProjectId = projectId;
        ws.workspace.selectedEntityId = recordId;
        return ws;
      });
      await window.UOS.ProgramApp.navigate('quotes');
      return projectId;
    }, owner);
    const frame = page.frameLocator('iframe');
    const radio = mode => frame.locator(`[data-quote-funding-mode][value="${mode}"]`);
    await expect(radio('customer')).toBeChecked();
    await expect(frame.locator('[data-city-allocation-note]')).toHaveText('Available — excluded from this Quote');
    await verifyPdf(page, child, owner, 'customer', ['Customer-funded work.', 'Proposed customer contribution', '$100.00', '$10.00', '$110.00']);
    await radio('mixed').check();
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.quotes[0]?.fundingMode)).toBe('mixed');
    const contribution = frame.locator('[data-quote-customer-contribution]');
    await expect(contribution).toHaveValue('60');
    await contribution.fill('75');
    await contribution.press('Tab');
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.quotes[0]?.proposedCustomerContribution)).toBe(75);
    await frame.locator('[data-quote-contingency]').fill('20');
    await frame.locator('[data-quote-contingency]').press('Tab');
    await expect(contribution).toHaveValue('75');
    await expect(frame.locator('[data-customer-suggestion]')).toContainText('$80.00');
    await frame.locator('[data-use-suggested-contribution]').click();
    await expect(contribution).toHaveValue('80');
    await expect(frame.locator('[data-preview-contribution]')).toHaveText('$80.00');
    await expect(frame.locator('[data-preview-customer-gst]')).toHaveText('$8.00');
    await expect(frame.locator('.uos-quote-sheet__grand-total-val')).toHaveText('$88.00');
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.quotes[0]?.proposedCustomerContribution)).toBe(80);
    await verifyPdf(page, child, owner, 'mixed', ['Co-funded by City of Adelaide and customer.', 'Proposed customer contribution', '$80.00', '$8.00', '$88.00']);
    await page.reload();
    const reloaded = page.frames().find(frame => frame !== page.mainFrame());
    await reloaded.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    await reloaded.evaluate(() => window.UOS.ProgramApp.navigate('quotes'));
    await expect(radio('mixed')).toBeChecked();
    await expect(contribution).toHaveValue('80');
    await frame.locator('[data-quote-issue]').click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Issue quote', exact: true }).click();
    await expect(frame.getByRole('dialog')).toContainText('Quote Issued');
    await frame.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
    await expect(frame.locator('[data-customer-agreement]')).toHaveText('— Awaiting acceptance');
    await expect(contribution).toBeDisabled();
    await frame.locator('[data-quote-accept]').click();
    await frame.getByRole('dialog').getByRole('button', { name: 'Accept quote', exact: true }).click();
    await expect(frame.getByRole('dialog')).toContainText('Customer Acceptance Recorded');
    await frame.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
    await expect.poll(async () => ({ status: await reloaded.evaluate(() => window.UOS.ProgramApp.workspace().entities.quotes[0].status), errors })).toEqual({ status: 'Accepted', errors: [] });
    await expect(frame.locator('[data-customer-agreement]')).toHaveText('— Accepted');
    await reloaded.evaluate(() => window.UOS.ProgramApp.navigate('reports'));
    const fundingReport = frame.locator('[data-reports-funding-body] tr').first();
    await expect(fundingReport.locator('td').nth(5)).toHaveText('Accepted');
    await expect(fundingReport.locator('td').nth(6)).toHaveText('$80.00');
    await expect(fundingReport.locator('td').nth(7)).toHaveText('$8.00');
    await expect(fundingReport.locator('td').nth(8)).toHaveText('$88.00');
    await reloaded.evaluate(() => window.UOS.ProgramApp.navigate('quotes'));
    await reloaded.evaluate(async projectId => {
      await window.UOS.ProgramApp.updateWorkspace(ws => {
        const quote = ws.entities.quotes.find(quote => quote.projectId === projectId);
        ws = window.UOS.ProgramQuotes.createRevision(ws, quote.id);
        ws.entities.projects.find(project => project.id === projectId).funding.operationalAmount = 100;
        return window.UOS.ProgramQuotes.saveDraft(ws, { id: ws.entities.quotes[1].id, projectId, fundingMode: 'city' });
      });
    }, projectId);
    await expect(radio('city')).toBeChecked();
    await expect(frame.locator('[data-deposit-record]')).toBeDisabled();
    await expect(frame.locator('[data-payment-record]')).toBeDisabled();
    await expect(frame.locator('[data-payment-status]')).toHaveText('No customer payment required');
    await expect(frame.locator('.uos-quote-sheet__grand-total-val')).toHaveText('$0.00');
    await expect(frame.locator('[data-preview-customer-gst]')).toHaveText('$0.00');
    await expect(frame.locator('[data-preview-funding-statement]')).toHaveText('Fully funded by City of Adelaide — no customer payment required.');
    await verifyPdf(page, reloaded, owner, 'city', ['Fully funded by City of Adelaide', 'no customer payment required.', 'Customer amount payable', '$0.00']);
    if (owner === 'NSA') await frame.locator('.program-quote-section--funding').screenshot({ path: '/tmp/quote-city-funding.png' });
    await page.setViewportSize({ width: 900, height: 900 });
    await expect(radio('city')).toBeVisible();
    const choice = await frame.locator('.program-quote-funding-choice').evaluate(field => ({ width: field.clientWidth, scroll: field.scrollWidth }));
    expect(choice.scroll).toBeLessThanOrEqual(choice.width + 2);
    expect(errors).toEqual([]);
  });
}
