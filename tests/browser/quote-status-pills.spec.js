const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function setup(page, mode = 'customer') {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/src/program-planner/nsa.html');
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  const projectId = await frame.evaluate(async mode => {
    let projectId;
    await UOS.ProgramApp.updateWorkspace(ws => {
      ws.entities.applications.push({ id: 'NSA-APP-PILL-ISSUE', owner: 'NSA', title: 'Status pill customer', status: 'received', dateReceived: '2026-10-05' });
      const promoted = UOS.ProgramModel.promoteRegisterRecord(ws, 'NSA-APP-PILL-ISSUE');
      projectId = promoted.project.id;
      let next = UOS.ProgramCosting.upsertRateItem(UOS.ProgramStatus.migrate(promoted.workspace), { id: 'RATE-PILL-MATERIAL', description: 'Quote material with a recognised cost basis', kind: 'Material', category: 'Material', unit: 'each', unitRate: 45, quantityMode: 'direct', schedulerEnabled: false });
      next = UOS.ProgramCosting.createWork(next, projectId, 'RATE-PILL-MATERIAL', { quantity: 2 }, { operationId: 'pill-material' });
      return UOS.ProgramQuotes.saveDraft(next, { projectId, quoteDate: '2020-01-01', fundingMode: mode, proposedCustomerContribution: mode === 'mixed' ? 90 : null, scopeNotes: '', terms: '' });
    });
    await UOS.ProgramApp.navigateWithContext('quotes', 'NSA-APP-PILL-ISSUE');
    return projectId;
  }, mode);
  return { frame, projectId };
}

for (const [mode, source] of [['customer', 'Customer'], ['city', 'City of Adelaide'], ['mixed', 'City of Adelaide and customer']]) test(`Issue confirmation prominently identifies ${mode} funding and empty sections`, async ({ page }, testInfo) => {
  const { frame, projectId } = await setup(page, mode);
  await expect(frame.locator('[data-quote-status]')).toHaveText('Draft');
  await frame.locator('[data-quote-issue]').click();
  const dialog = frame.getByRole('dialog');
  await expect(dialog).toContainText('Issue Quote');
  await expect(dialog.locator('.program-quote-issue-funding strong')).toHaveText(source);
  await expect(dialog.getByRole('alert')).toContainText('Scope/Description is empty.');
  await expect(dialog.getByRole('alert')).toContainText('Terms and Conditions are empty.');
  await dialog.screenshot({ path: testInfo.outputPath(`issue-${mode}.png`) });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await frame.evaluate(id => UOS.ProgramApp.workspace().entities.quotes.find(q => q.projectId === id).status, projectId)).toBe('Draft');
});

test('toolbar pills align with lifecycle buttons and history rows start with fixed-width status pills', async ({ page }, testInfo) => {
  const { frame, projectId } = await setup(page);
  const status = frame.locator('[data-quote-status]');
  const assertHeights = async () => {
    const heights = await frame.locator('.program-quote-preview-toolbar').evaluate(el => [el.querySelector('.program-quote-live-pill'), el.querySelector('[data-quote-status]'), ...el.querySelectorAll('[data-quote-lifecycle-actions] button')].filter(n => n.getClientRects().length).map(n => n.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThanOrEqual(2);
    heights.forEach(height=>expect(height).toBeCloseTo(28,4));
  };
  await assertHeights();
  await frame.locator('[data-quote-issue]').click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Issue quote', exact: true }).click();
  await expect(frame.getByRole('dialog')).toContainText('Quote Issued');
  await frame.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  const issueDate = await frame.evaluate(id => {
    const ws = UOS.ProgramApp.workspace(), q = ws.entities.quotes.find(q => q.projectId === id);
    const event = ws.entities.quoteEvents.find(e => e.quoteId === q.id && e.payload?.newStatus === 'Issued');
    return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(event.timestamp));
  }, projectId);
  await expect(status).toHaveText(`Issued · ${issueDate}`);
  await expect(frame.locator('[data-quote-history-list]')).toContainText(`Issued ${issueDate}`);
  await assertHeights();
  await frame.locator('[data-quote-accept]').click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Accept quote', exact: true }).click();
  await expect(frame.getByRole('dialog')).toContainText('Customer Acceptance Recorded');
  await frame.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  await frame.evaluate(async id => {
    await UOS.ProgramApp.updateWorkspace(ws => {
      const q = ws.entities.quotes.find(q => q.projectId === id);
      let next = UOS.ProgramQuotes.createRevision(ws, q.id);
      const replacement = next.entities.quotes.find(q => q.previousQuoteId);
      next = UOS.ProgramQuotes.issue(next, replacement.id);
      return UOS.ProgramQuotes.setStatus(next, replacement.id, 'Declined');
    });
  }, projectId);
  const rows = frame.locator('.program-quote-history__row');
  await expect(rows).toHaveCount(2);
  const layout = await rows.evaluateAll(rows => rows.map(row => {
    const pill = row.firstElementChild, style = getComputedStyle(row);
    return { firstIsPill: pill.classList.contains('program-quote-status-pill--slim'), width: pill.getBoundingClientRect().width, fits: pill.scrollWidth <= pill.clientWidth, height: pill.getBoundingClientRect().height, direction: style.flexDirection, wrap: style.whiteSpace };
  }));
  const headerPillHeight = await status.evaluate(pill => pill.getBoundingClientRect().height);
  expect(layout.every(row => row.height === headerPillHeight)).toBe(true);
  for (const row of layout) expect(row).toEqual({ firstIsPill: true, width: 104, fits: true, height: 28, direction: 'row', wrap: 'nowrap' });
  await expect(rows.first()).toContainText('Declined');
  await expect(rows.last()).toContainText('Superseded');
  await expect(rows.first()).toContainText('Revision 2');
  const separators = await rows.first().evaluate(row => Array.from(row.children).slice(1).map(node => getComputedStyle(node, '::before').content));
  expect(separators).toEqual(['"•"', '"•"', '"•"']);
  const pillColours = await rows.evaluateAll(rows => rows.map(row => ({ foreground: getComputedStyle(row.firstElementChild).color, background: getComputedStyle(row.firstElementChild).backgroundColor })));
  expect(pillColours.every(pill => pill.foreground === 'rgb(255, 255, 255)')).toBe(true);
  expect(new Set(pillColours.map(pill => pill.background)).size).toBe(2);

  const meta = frame.locator('.program-quote-project-card__meta').first();
  await expect(meta.locator(':scope > :first-child')).toHaveClass(/program-quote-status-pill--slim/);
  for (const theme of ['light', 'dark']) {
    await frame.evaluate(theme => { document.documentElement.dataset.suiteTheme = theme; }, theme);
    await frame.locator('.program-quote-preview-toolbar').screenshot({ path: testInfo.outputPath(`toolbar-${theme}.png`) });
    await frame.locator('.program-quote-history').screenshot({ path: testInfo.outputPath(`history-${theme}.png`) });
  }
});


test('Site/location follows privacy without replacing the saved address', async ({ page }) => {
  const { frame, projectId } = await setup(page);
  await frame.evaluate(() => UOS.ProgramPrivacy.setEnabled(false));
  const address = frame.locator('[data-quote-address]');
  await address.fill('42 Private Customer Street');
  await address.blur();
  await expect.poll(() => frame.evaluate(id => UOS.ProgramApp.workspace().entities.quotes.find(q => q.projectId === id).address, projectId)).toBe('42 Private Customer Street');
  await frame.evaluate(() => UOS.ProgramPrivacy.setEnabled(true));
  await expect(address).toHaveValue('**********');
  await expect(address).toHaveAttribute('readonly', '');
  await expect(frame.locator('[data-quote-preview-sheet]')).not.toContainText('42 Private Customer Street');
  await frame.evaluate(() => UOS.ProgramPrivacy.setEnabled(false));
  await expect(address).toHaveValue('42 Private Customer Street');
  await expect(frame.locator('[data-quote-preview-sheet]')).toContainText('42 Private Customer Street');
});

test('Acceptance and revision confirmations cancel without changing the issued quote', async ({ page }) => {
  const { frame, projectId } = await setup(page);
  await frame.locator('[data-quote-issue]').click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Issue quote', exact: true }).click();
  await frame.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  const snapshot = () => frame.evaluate(id => {
    const ws = UOS.ProgramApp.workspace();
    return { quotes: ws.entities.quotes.filter(q => q.projectId === id), events: ws.entities.quoteEvents };
  }, projectId);
  const before = await snapshot();
  await frame.locator('[data-quote-accept]').click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await snapshot()).toEqual(before);
  await frame.locator('[data-quote-revision]').click();
  await expect(frame.getByRole('dialog')).toContainText('Superseded');
  await frame.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await snapshot()).toEqual(before);
  await frame.locator('[data-quote-revision]').click();
  await frame.getByRole('dialog').getByRole('button', { name: 'Create revision', exact: true }).click();
  await expect.poll(async () => (await snapshot()).quotes.length).toBe(2);
  expect((await snapshot()).quotes.find(q => q.id === before.quotes[0].id).status).toBe('Issued');
});


for (const theme of ['light', 'dark']) test(`Draft pills share readable colours in cards and preview in ${theme}`, async ({ page }) => {
  const { frame } = await setup(page);
  await frame.evaluate(theme => document.documentElement.setAttribute('data-suite-theme', theme), theme);
  const styles = await frame.locator('.program-quote-status-pill[data-quote-state="Draft"]').evaluateAll(pills => pills.map(pill => {
    const style = getComputedStyle(pill);
    const luminance = colour => {
      const rgb = colour.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const a = luminance(style.color), b = luminance(style.backgroundColor);
    return { colour: style.color, background: style.backgroundColor, border: style.borderColor, height: parseFloat(style.height), contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
  }));
  expect(styles.length).toBeGreaterThanOrEqual(3);
  for (const style of styles) expect(style).toEqual(styles[0]);
  expect(styles[0].contrast).toBeGreaterThanOrEqual(4.5);
});

for (const width of [1440, 390]) test(`Quote fields show unclipped focus and Kind does not reset scroll at ${width}`, async ({ page }, testInfo) => {
  const { frame } = await setup(page);
  await page.setViewportSize({ width, height: 1000 });
  const kind = frame.getByRole('textbox', { name: 'Kind', exact: true }).first();
  await kind.scrollIntoViewIfNeeded();
  await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const positions = () => frame.evaluate(() => Array.from(document.querySelectorAll('.program-quote-pane-body, .program-scroll-region, .program-table-wrap')).map(el => el.scrollTop));
  const before = await positions();
  await kind.click();
  await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await positions()).toEqual(before);
  await kind.locator('xpath=ancestor::tr[1]').screenshot({ path: testInfo.outputPath('quote-kind-focus.png') });
  // Register drawers retain a wide document layout on narrow screens; audit
  // every form field at desktop width and every horizontally scrolling table field at narrow width.
  await frame.locator('[data-add-line]').click();
  await frame.locator('[data-quote-save]').click();
  await frame.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  const scope = width < 600 ? '.program-quote-builder-table' : '[data-program-view="quotes"]';
  const fields = frame.locator(`${scope} input:not(:disabled), ${scope} select:not(:disabled), ${scope} textarea:not(:disabled)`);
  const count = await fields.count();
  for (let i = 0; i < count; i++) {
    const field = fields.nth(i);
    if (!await field.isVisible()) continue;
    await field.scrollIntoViewIfNeeded();
    await field.focus();
    const failures = await field.evaluate(async el => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (document.activeElement !== el) return []; // Privacy deliberately blurs protected fields.
      const css = getComputedStyle(el), r = el.getBoundingClientRect();
      const ring = parseFloat(css.outlineWidth) + Math.max(0, parseFloat(css.outlineOffset));
      const failures = [];
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p), b = p.getBoundingClientRect(), x = b.left + p.clientLeft, y = b.top + p.clientTop;
        if ((/auto|scroll|hidden|clip/.test(s.overflowX) && r.width <= p.clientWidth && (r.left - ring < x - .75 || r.right + ring > x + p.clientWidth + .75)) || (/auto|scroll|hidden|clip/.test(s.overflowY) && (r.top - ring < y - .75 || r.bottom + ring > y + p.clientHeight + .75))) failures.push({ field: el.id || el.getAttribute('aria-label') || el.getAttribute('data-line-field'), container: p.className, tag: p.tagName, fieldRect: {left:r.left,top:r.top,right:r.right,bottom:r.bottom}, clip: {left:x,top:y,right:x+p.clientWidth,bottom:y+p.clientHeight}, ring });
      }
      return failures;
    });
    if (failures.length) await page.screenshot({ path: testInfo.outputPath("focus-failure.png") });
    expect(failures).toEqual([]);
  }
});
