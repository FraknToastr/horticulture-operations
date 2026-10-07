const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test('NSA application to Project, Cost Library materials and issued customer-paid Quote', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/src/program-planner/nsa.html');
  const child = page.frames().find(frame => frame !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const frame = page.frameLocator('iframe');
  const privacy = frame.locator('[data-action="toggle-privacy"]');
  if (await privacy.getAttribute('aria-pressed') === 'true') await privacy.click();
  const before = await child.evaluate(() => UOS.ProgramApp.workspace().entities.applications.length);
  await frame.locator('[data-register-add-record]').click();
  await expect.poll(() => child.evaluate(() => UOS.ProgramApp.workspace().entities.applications.length)).toBe(before + 1);
  const applicationId = await child.evaluate(() => UOS.ProgramApp.workspace().entities.applications.at(-1).id);
  await frame.locator(`[data-register-drawer-record="${applicationId}"] [data-register-action="create-project"]`).click();
  await expect.poll(() => child.evaluate(() => UOS.ProgramApp.workspace().workspace.selectedProjectId)).toBeTruthy();
  const projectId = await child.evaluate(() => UOS.ProgramApp.workspace().workspace.selectedProjectId);
  // A known priced library item avoids relying on unpriced starter catalogue rows.
  const rateId = 'RATE-NSA-CUSTOMER-ISSUE-MATERIAL';
  await child.evaluate(async id => {
    await UOS.ProgramApp.updateWorkspace(ws => UOS.ProgramCosting.upsertRateItem(ws, { id, description: 'Quote workflow material', kind: 'Material', category: 'Material', unit: 'each', unitRate: 45, quantityMode: 'direct', schedulerEnabled: false }));
  }, rateId);
  await frame.locator('[data-program-destination="costing"]').click();
  await frame.locator('[data-costing-section="Material"]').click();
  const add = frame.locator(`[data-costing-add-rate="${rateId}"]`);
  await expect(add).toBeVisible();
  await add.click();
  await add.click();
  await expect.poll(() => child.evaluate(id => UOS.ProgramApp.workspace().entities.costingLines.filter(line => line.projectId === id).length, projectId)).toBe(2);
  await frame.locator('[data-program-destination="quotes"]').click();
  await expect(frame.locator('[data-program-view="quotes"]')).toBeVisible();
  for (const [field, value] of Object.entries({ client: 'Quote workflow customer', address: '1 Test Street, Adelaide', email: 'customer@example.com', prepared: 'Workflow Officer', date: '2026-10-05', expiry: '2026-11-05', scope: 'Supply the two selected Cost Library material items.' })) {
    await frame.locator(`[data-quote-${field}]`).fill(value);
    await frame.locator(`[data-quote-${field}]`).press('Tab');
  }
  await frame.locator('[data-quote-funding-mode][value="customer"]').check();
  await frame.locator('[data-quote-save]').click();
  await frame.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  await expect(frame.locator('[data-program-persistence]')).toHaveText('Saved');
  const inspect = () => child.evaluate(id => {
    const ws = UOS.ProgramApp.workspace();
    const quote = ws.entities.quotes.filter(q => q.projectId === id).sort((a,b) => b.revision - a.revision)[0];
    return { applicationId: ws.entities.projects.find(p => p.id === id).applicationId, quote, lines: ws.entities.quoteLines.filter(l => l.quoteId === quote?.id), readiness: quote ? UOS.ProgramQuotes.evaluateReadiness(ws, quote.id) : null, application: ws.entities.applications.find(a => a.id === ws.entities.projects.find(p => p.id === id).applicationId) };
  }, projectId);
  const saved = await inspect();
  await testInfo.attach('saved-before-issue', { body: JSON.stringify(saved, null, 2), contentType: 'application/json' });
  expect(saved.quote).toMatchObject({ status: 'Draft', fundingMode: 'customer', clientName: 'Quote workflow customer', email: 'customer@example.com', preparedBy: 'Workflow Officer', quoteDate: '2026-10-05' });
  expect(saved.lines).toHaveLength(2);
  expect(saved.lines.reduce((total, line) => total + line.total, 0)).toBe(90);
  expect(saved.readiness.ready).toBe(true);
  expect(saved.readiness.failures).toEqual([]);
  await frame.locator('[data-quote-issue]').click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Issue quote', exact: true }).click();
  try {
    await expect.poll(async () => (await inspect()).quote.status, { timeout: 5000 }).toBe('Issued');
  } finally {
    await testInfo.attach('after-issue', { body: JSON.stringify({ ...(await inspect()), errors }, null, 2), contentType: 'application/json' });
    await frame.locator('[data-program-view="quotes"]').screenshot({ path: testInfo.outputPath('customer-quote-after-issue.png'), animations: 'disabled' });
  }
  expect(errors).toEqual([]);
  await expect(frame.getByRole('dialog')).toContainText('Quote Issued');
  await expect(frame.getByRole('dialog')).toContainText('awaiting customer acceptance');
  await frame.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  await expect(frame.locator('[data-quote-accept]')).toBeVisible();
  await frame.locator('[data-quote-accept]').click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Accept quote', exact: true }).click();
  await expect(frame.getByRole('dialog')).toContainText('Customer Acceptance Recorded');
  await expect(frame.getByRole('dialog')).toContainText('payments and scheduling are recorded separately');
  await frame.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  expect((await inspect()).quote.status).toBe('Accepted');
  await page.reload();
  const reloaded = page.frames().find(frame => frame !== page.mainFrame());
  await reloaded.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  expect(await reloaded.evaluate(id => UOS.ProgramApp.workspace().entities.quotes.find(q => q.projectId === id).status, projectId)).toBe('Accepted');
});
