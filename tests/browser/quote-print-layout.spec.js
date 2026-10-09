const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: native Quote printing escapes the Register drawer and preserves roomy totals and scope`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const scope = 'Supply plants and prepare the existing garden beds.\n\nRetain existing irrigation, protect established planting and remove all waste after delivery. Finish every part of the agreed work without narrowing or truncating this description. SCOPE-END';
    await child.evaluate(async ({ owner, scope }) => {
      await window.UOS.ProgramApp.updateWorkspace(ws => {
        const recordId = owner + (owner === 'NSA' ? '-APP-PRINT' : '-EVENT-PRINT');
        ws.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id: recordId, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Printable horticultural work', status: owner === 'NSA' ? 'received' : 'enquiry', dateReceived: '2026-10-01' });
        const promoted = window.UOS.ProgramModel.promoteRegisterRecord(ws, recordId);
        ws = promoted.workspace;
        const projectId = promoted.project.id;
        ws.entities.projects.find(project => project.id === projectId).funding = { operationalAmount: 2000 };
        ws.entities.costingLines.push({ id: owner + '-COST-PRINT', owner, type: 'costingLine', projectId, jobId: null, kind: 'Labour', description: 'Garden bed preparation', quantity: 1, unitRate: 141, estimatedTotal: 141 });
        ws.workspace.selectedProjectId = projectId;
        ws.workspace.selectedEntityId = recordId;
        return window.UOS.ProgramQuotes.saveDraft(ws, { projectId, quoteDate: '2026-10-01', fundingMode: 'city', scopeNotes: scope });
      });
      await window.UOS.ProgramApp.navigate('quotes');
      window.print = () => {
        window.__quotePrintCalls = (window.__quotePrintCalls || 0) + 1;
        window.dispatchEvent(new Event('beforeprint'));
      };
    }, { owner, scope });
    const quote = child.locator('[data-program-view="quotes"]');
    await expect(quote).toBeVisible();
    expect(await quote.evaluate(node => !!node.closest('[data-program-view="register"]'))).toBe(true);
    await child.locator('[data-quote-print]').click();
    await expect.poll(() => child.evaluate(() => window.__quotePrintCalls)).toBe(1);
    const host = child.locator('[data-quote-print-host]');
    await expect(host).toBeAttached();
    expect(await host.evaluate(node => node.parentElement === document.body)).toBe(true);
    const documentHtml = await child.evaluate(() => {
      const copy = document.documentElement.cloneNode(true);
      copy.querySelectorAll('script').forEach(node => node.remove());
      const base = document.createElement('base'); base.href = location.href;
      copy.querySelector('head').prepend(base);
      return '<!doctype html>' + copy.outerHTML;
    });
    const printPage = await page.context().newPage();
    await printPage.setViewportSize({ width: 794, height: 1123 });
    await printPage.setContent(documentHtml, { waitUntil: 'networkidle' });
    await printPage.emulateMedia({ media: 'print' });
    const printedHost = printPage.locator('[data-quote-print-host]');
    await expect(printedHost).toBeVisible();
    await expect(printPage.locator('[data-program-view="register"]')).toBeHidden();
    await expect(printedHost.locator('.uos-quote-sheet__notes-col p')).toHaveText(scope);
    const layout = await printedHost.evaluate(host => {
      const notes = host.querySelector('.uos-quote-sheet__notes-col');
      const totals = host.querySelector('.uos-quote-sheet__totals-col');
      const box = host.querySelector('.uos-quote-sheet__totals-list');
      return {
        notesWidth: notes.getBoundingClientRect().width,
        notesOverflow: notes.scrollWidth > notes.clientWidth + 1,
        totalsWidth: totals.getBoundingClientRect().width,
        totalsOverflow: box.scrollWidth > box.clientWidth + 1,
        labels: [...box.querySelectorAll('dt')].map(node => {
          const range = document.createRange(); range.selectNodeContents(node);
          const lines = new Set([...range.getClientRects()].map(rect => Math.round(rect.top)));
          return { text: node.textContent, lines: lines.size, overflow: node.scrollWidth > node.clientWidth + 1 };
        })
      };
    });
    expect(layout.notesWidth).toBeGreaterThanOrEqual(240);
    expect(layout.totalsWidth).toBeGreaterThan(400);
    expect(layout.notesOverflow).toBe(false);
    expect(layout.totalsOverflow).toBe(false);
    for (const label of layout.labels) {
      expect(label.lines, label.text).toBe(1);
      expect(label.overflow, label.text).toBe(false);
    }
    const pdfPath = test.info().outputPath(`${owner}-live-quote.pdf`);
    await printedHost.locator('.uos-quote-sheet__summary-wrap').screenshot({ path: test.info().outputPath(`${owner}-quote-summary.png`) });
    await printPage.pdf({ path: pdfPath, format: 'A4', printBackground: true });
    await printPage.close();
    const pdf = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
    expect(pdf).toContain('SCOPE-END');
    expect(pdf).toContain('$141.00');
    expect(pdf).toContain('$155.10');
    expect(pdf).not.toContain('$2,000.00');
    expect(pdf).toContain('Estimated work cost (inc GST)');
    for (const pageText of pdf.split('\f').filter((_, index, pages) => index < pages.length - 1)) expect(pageText.trim()).not.toBe('');
    await child.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(host).toHaveCount(0);
    await expect(child.locator('body')).not.toHaveClass(/is-printing-quote/);
    await expect(quote).toBeVisible();
    await expect(quote.locator('.uos-quote-sheet__notes-col p')).toHaveText(scope);
    // Browser Ctrl+P also goes through the same root print document, with cleanup
    // covering both a completed print and cancelling its preview.
    await child.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await expect(host).toHaveCount(1);
    await child.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(host).toHaveCount(0);
  });
}
