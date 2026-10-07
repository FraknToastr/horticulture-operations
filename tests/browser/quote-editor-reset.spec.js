const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function start(page, owner) {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const child = page.frames().find(f => f !== page.mainFrame());
  await child.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  const privacy = child.locator('[data-action="toggle-privacy"]');
  if (await privacy.getAttribute('aria-pressed') === 'true') await privacy.click();
  return child;
}

async function project(child, owner, suffix, withQuote) {
  return child.evaluate(async ({ owner, suffix, withQuote }) => {
    let projectId;
    const id = `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-RESET-${suffix}`;
    await UOS.ProgramApp.updateWorkspace(ws => {
      ws.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id, owner, title: `Customer ${suffix}`, status: 'received', dateReceived: '2026-10-05', raw: {} });
      const promoted = UOS.ProgramModel.promoteRegisterRecord(ws, id);
      projectId = promoted.project.id;
      let next = promoted.workspace;
      if (withQuote) next = UOS.ProgramQuotes.saveDraft(next, { projectId, quoteDate: '2026-10-05', clientName: 'Previous customer', address: 'Previous private address', email: 'previous-customer@example.com', preparedBy: 'Previous preparer', scopeNotes: 'Previous scope', terms: 'Previous private terms', fundingMode: 'customer' });
      return next;
    });
    await UOS.ProgramApp.navigateWithContext('quotes', id);
    return projectId;
  }, { owner, suffix, withQuote });
}

for (const owner of ['NSA', 'EVT']) for (const destination of ['quotes', 'register']) test(`${owner}: clearing from ${destination} removes quote contact details`, async ({ page }) => {
  const child = await start(page, owner);
  await project(child, owner, 'OLD', true);
  await expect(child.locator('[data-quote-email]')).toHaveValue('previous-customer@example.com');
  await child.evaluate(destination => UOS.ProgramApp.navigate(destination), destination);
  await child.evaluate(() => UOS.ProgramApp.clearInMemory('all'));
  const id = await project(child, owner, 'NEW', false);
  await expect(child.locator('[data-quote-email]')).toHaveValue('');
  await expect(child.locator('[data-quote-prepared]')).toHaveValue('');
  await expect(child.locator('[data-quote-address]')).not.toHaveValue('Previous private address');
  await child.locator('[data-quote-save]').click();
  await child.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  const workspace = await child.evaluate(() => UOS.ProgramApp.workspace());
  expect(workspace.entities.quotes.find(q => q.projectId === id).email).toBe('');
  expect(JSON.stringify(workspace)).not.toContain('previous-customer@example.com');
});

for (const owner of ['NSA', 'EVT']) test(`${owner}: a new Project never inherits another quote's contact details`, async ({ page }) => {
  const child = await start(page, owner);
  const oldId = await project(child, owner, 'FIRST', true);
  await project(child, owner, 'SECOND', false);
  await expect(child.locator('[data-quote-email]')).toHaveValue('');
  await expect(child.locator('[data-quote-prepared]')).toHaveValue('');
  await child.evaluate(id => UOS.ProgramApp.navigateWithContext('quotes', id), oldId);
  await expect(child.locator('[data-quote-email]')).toHaveValue('previous-customer@example.com');
});

for (const owner of ['NSA', 'EVT']) test(`${owner}: quote inherits Register contacts and auto-saves edits before Issue`, async ({ page }) => {
  const child = await start(page, owner);
  const id = await project(child, owner, 'CONTACTS', false);
  await child.evaluate(async ({ owner, id }) => {
    await UOS.ProgramApp.updateWorkspace(ws => {
      const p = ws.entities.projects.find(p => p.id === id);
      const record = ws.entities[owner === 'NSA' ? 'applications' : 'events'].find(r => r.id === (p.applicationId || p.eventId));
      record.raw = owner === 'NSA'
        ? { customerName: 'Application customer', customerEmail: 'application@example.com', address: '10 Customer Street, Adelaide' }
        : { applicantName: 'Application customer', email: 'application@example.com', address: '10 Customer Street, Adelaide' };
      let next = UOS.ProgramCosting.upsertRateItem(ws, { id: 'RATE-CONTACT-MATERIAL', description: 'Contact workflow material', kind: 'Material', category: 'Material', unit: 'each', unitRate: 45, quantityMode: 'direct', schedulerEnabled: false });
      return UOS.ProgramCosting.createWork(next, id, 'RATE-CONTACT-MATERIAL', { quantity: 2 }, { operationId: 'contacts-material' });
    });
  }, { owner, id });
  await expect(child.locator('[data-quote-client]')).toHaveValue('Application customer');
  await expect(child.locator('[data-quote-address]')).toHaveValue('10 Customer Street, Adelaide');
  await expect(child.locator('[data-quote-email]')).toHaveValue('application@example.com');
  await child.locator('[data-quote-email]').fill('quote-contact@example.com');
  await child.locator('[data-quote-email]').press('Tab');
  // No Save Quote click: the input event creates and persists the Draft.
  await expect.poll(() => child.evaluate(id => UOS.ProgramApp.workspace().entities.quotes.find(q => q.projectId === id)?.email, id)).toBe('quote-contact@example.com');
  await child.locator('[data-quote-issue]').click();
  await child.getByRole('dialog').getByRole('button', { name: 'Issue quote', exact: true }).click();
  await expect(child.getByRole('dialog')).toContainText('Quote Issued');
  await child.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  await child.evaluate(() => UOS.ProgramApp.navigate('register'));
  await child.evaluate(id => UOS.ProgramApp.navigateWithContext('quotes', id), id);
  await expect(child.locator('[data-quote-email]')).toHaveValue('quote-contact@example.com');
  await page.reload();
  const reloaded = page.frames().find(f => f !== page.mainFrame());
  await reloaded.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  expect(await reloaded.evaluate(id => {
    const q = UOS.ProgramApp.workspace().entities.quotes.find(q => q.projectId === id);
    return { client: q.clientName, address: q.address, email: q.email, status: q.status };
  }, id)).toEqual({ client: 'Application customer', address: '10 Customer Street, Adelaide', email: 'quote-contact@example.com', status: 'Issued' });
});

test('an Issue validation failure explains the blocker without changing the Draft', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const child = await start(page, 'NSA');
  const id = await project(child, 'NSA', 'NOT-READY', true);
  await child.locator('[data-quote-issue]').click();
  await child.getByRole('dialog').getByRole('button', { name: 'Issue quote', exact: true }).click();
  await expect(child.getByRole('dialog')).toContainText('Quote Not Issued');
  await expect(child.getByRole('dialog')).toContainText('at least one line item');
  expect(await child.evaluate(id => UOS.ProgramApp.workspace().entities.quotes.find(q => q.projectId === id).status, id)).toBe('Draft');
  expect(errors).toEqual([]);
});

test('clearing also discards contact details cached under Privacy Mode', async ({ page }) => {
  const child = await start(page, 'NSA');
  await project(child, 'NSA', 'PRIVATE-OLD', true);
  await child.locator('[data-action="toggle-privacy"]').click();
  await child.evaluate(() => UOS.ProgramApp.navigate('register'));
  await child.evaluate(() => UOS.ProgramApp.clearInMemory('all'));
  await project(child, 'NSA', 'PRIVATE-NEW', false);
  await child.locator('[data-action="toggle-privacy"]').click();
  await expect(child.locator('[data-quote-email]')).toHaveValue('');
});

for (const width of [1440, 390]) test(`Resource Calculator unit focus ring clears clipping ancestors at ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  const child = await start(page, 'NSA');
  const id = await project(child, 'NSA', 'FOCUS', false);
  await child.evaluate(async id => {
    await UOS.ProgramApp.updateWorkspace(ws => {
      let next = UOS.ProgramCosting.upsertRateItem(ws, { id: 'RATE-UNIT-FOCUS', description: 'Focus material', kind: 'Material', category: 'Material', unit: 'item', unitRate: 10, quantityMode: 'direct', schedulerEnabled: false });
      return UOS.ProgramCosting.createWork(next, id, 'RATE-UNIT-FOCUS', { quantity: 1 }, { operationId: 'unit-focus' });
    });
    await UOS.ProgramApp.navigate('costing');
  }, id);
  const field = child.locator('[data-costing-line-unit]').first();
  await field.scrollIntoViewIfNeeded();
  await field.focus();
  const failures = await field.evaluate(async el => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    const ring = parseFloat(s.outlineWidth) + Math.max(0, parseFloat(s.outlineOffset));
    const failures = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      const css = getComputedStyle(p), b = p.getBoundingClientRect();
      const x = b.left + p.clientLeft, y = b.top + p.clientTop;
      if ((/auto|scroll|hidden|clip/.test(css.overflowX) && (r.left - ring < x - .75 || r.right + ring > x + p.clientWidth + .75)) || (/auto|scroll|hidden|clip/.test(css.overflowY) && (r.top - ring < y - .75 || r.bottom + ring > y + p.clientHeight + .75))) failures.push({ container: p.className, ring });
    }
    return failures;
  });
  expect(failures).toEqual([]);
  await field.locator('xpath=ancestor::tr[1]').screenshot({ path: testInfo.outputPath('calculator-unit-focus.png') });
});
