const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test('Quote description receives remaining width and value controls stay compact', async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1840, height: 1000 });
  await page.goto('/src/program-planner/nsa.html');
  const child = page.frames().find(frame => frame !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace(workspace => {
      const record = { id: 'NSA-APP-QUOTE-LAYOUT', owner: 'NSA', type: 'application', title: 'Quote layout', status: 'received', dateReceived: '2026-10-01' };
      workspace.entities.applications.push(record);
      const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id);
      promoted.workspace.workspace.selectedProjectId = promoted.project.id;
      promoted.workspace.workspace.selectedEntityId = record.id;
      return promoted.workspace;
    });
    await window.UOS.ProgramApp.navigate('quotes');
  });
  const frame = page.frameLocator('iframe');
  await frame.locator('[data-add-line]').click();
  const row = frame.locator('[data-quote-builder-lines] tr').first();
  await expect(row).toBeVisible();
  let layout;
  await expect.poll(async () => { layout = await row.evaluate(row => {
    if (!row.closest("table")) return null;
    const cells = [...row.cells];
    return { headers: [...row.closest('table').querySelectorAll('th')].map(header => getComputedStyle(header).textAlign), widths: cells.map(cell => cell.getBoundingClientRect().width), controls: cells.slice(0, 5).map(cell => { const input = cell.querySelector('input, select'); const rect = input.getBoundingClientRect(); return { width: rect.width, left: rect.left, right: rect.right, align: getComputedStyle(input).textAlign }; }), totalAlign: getComputedStyle(cells[5].querySelector('input')).textAlign };
  }); return layout !== null; }).toBe(true);
  expect(layout.widths[0]).toBeGreaterThan(layout.widths[1] * 2);
  expect(layout.controls.slice(1).map(control => control.width)).toEqual([112, 64, 72, 96]);
  for (let i = 1; i < 4; i++) expect(layout.controls[i + 1].left - layout.controls[i].right).toBe(8);
  expect(layout.headers.every(align => align === 'left')).toBe(true);
  expect(layout.controls.slice(1).every(control => control.align === 'left')).toBe(true);
  expect(layout.totalAlign).toBe('left');
  await expect(frame.locator('.program-quote-builder-table th').nth(1)).toHaveText('Kind');
  const total = row.locator('[aria-label="Total"]');
  await expect(total).toHaveAttribute('readonly', '');
  expect(await total.evaluate(input => input.getBoundingClientRect().width)).toBe(96);
  await row.locator('[data-line-field="kind"]').selectOption('Labour');
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.quoteLines.find(line => line.sourceKind === 'custom')?.kind)).toBe('Labour');
});
