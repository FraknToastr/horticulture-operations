const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function setup(page, owner = 'NSA') {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  const projectId = await frame.evaluate(async owner => {
    let projectId;
    await UOS.ProgramApp.updateWorkspace(ws => {
      ws.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id: owner + (owner === 'NSA' ? '-APP-RAIL' : '-EVENT-RAIL'), owner, title: 'Section navigation customer', status: owner === 'NSA' ? 'received' : 'enquiry', dateReceived: '2026-10-05' });
      const promoted = UOS.ProgramModel.promoteRegisterRecord(ws, owner + (owner === 'NSA' ? '-APP-RAIL' : '-EVENT-RAIL'));
      projectId = promoted.project.id;
      let next = UOS.ProgramCosting.upsertRateItem(UOS.ProgramStatus.migrate(promoted.workspace), { id: 'RATE-RAIL-MATERIAL', description: 'Quote material with a recognised cost basis', kind: 'Material', category: 'Material', unit: 'each', unitRate: 45, quantityMode: 'direct', schedulerEnabled: false });
      next = UOS.ProgramCosting.createWork(next, projectId, 'RATE-RAIL-MATERIAL', { quantity: 2 }, { operationId: 'rail-material' });
      return UOS.ProgramQuotes.saveDraft(next, { projectId, quoteDate: '2020-01-01', fundingMode: "customer", proposedCustomerContribution: null, scopeNotes: '', terms: '' });
    });
    await UOS.ProgramApp.navigateWithContext('quotes', owner + (owner === 'NSA' ? '-APP-RAIL' : '-EVENT-RAIL'));
    return projectId;
  }, owner);
  return { frame, projectId };
}


for (const owner of ['NSA', 'EVT']) for (const width of [1440, 1024, 390]) test(`${owner} quote section navigation aligns headings and keeps headers fixed at ${width}`, async ({ page }, testInfo) => {
  const { frame } = await setup(page, owner);
  await page.setViewportSize({ width, height: 1000 });
  const rail = frame.getByRole('navigation', { name: 'Quote sections', exact: true });
  const body = frame.locator('.program-quote-pane-body');
  await expect(rail.getByRole('button')).toHaveCount(6);
  const layout = await rail.evaluate(el => {
    const railBounds = el.getBoundingClientRect();
    return {
      width: railBounds.width,
      height: railBounds.height,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      buttons: [...el.querySelectorAll('[data-quote-section-link]')].map(button => {
        const bounds = button.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height, top: bounds.top - railBounds.top, left: bounds.left - railBounds.left, accent: getComputedStyle(button, '::before').content, fontSize: getComputedStyle(button).fontSize, scrollWidth: button.scrollWidth, clientWidth: button.clientWidth };
      })
    };
  });
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  layout.buttons.forEach((button, index) => {
    expect(button.width).toBeCloseTo(layout.width / 6, 0);
    expect(button.height).toBeCloseTo(layout.height, 0);
    expect(button.fontSize).toBe('14px');
    expect(button.top).toBeCloseTo(0, 0);
    expect(button.left).toBeCloseTo(index * layout.width / 6, 0);
    expect(['none', 'normal']).toContain(button.accent);
    expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
  });
  await expect(rail.locator('[aria-current="location"]')).toHaveText('1 Customer');
  const fixedPositions = () => frame.evaluate(() => ['.program-quote-pane-head', '.program-quote-section-navigation'].map(selector => document.querySelector(selector).getBoundingClientRect().top));
  await expect.poll(() => frame.evaluate(async () => {
    const head = document.querySelector('.program-quote-pane-head');
    const before = head.getBoundingClientRect().top;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return Math.abs(head.getBoundingClientRect().top - before) < .01;
  })).toBe(true);
  const fixed = await fixedPositions();
  const preview = () => frame.locator('.program-quote-preview-viewport').evaluate(el => el.scrollTop);
  const beforePreview = await preview();
  for (const number of [2, 4, 6, 5, 3, 1]) {
    await rail.locator(`[data-quote-section-link="${number}"]`).click();
    await expect(rail.locator('[aria-current="location"]')).toHaveAttribute('data-quote-section-link', String(number));
    await expect.poll(() => body.evaluate((el, number) => document.getElementById(`quote-section-${number}`).getBoundingClientRect().top - el.getBoundingClientRect().top - el.clientTop, number)).toBeCloseTo(12, 0);
    (await fixedPositions()).forEach((position, index) => expect(Math.abs(position - fixed[index])).toBeLessThan(1));
    expect(await preview()).toBe(beforePreview);
  }
  await rail.screenshot({ path: testInfo.outputPath('section-rail.png') });
  await body.evaluate(el => { const heading = document.getElementById('quote-section-4'); el.scrollTop += heading.getBoundingClientRect().top - el.getBoundingClientRect().top - 12; });
  await expect(rail.locator('[aria-current="location"]')).toHaveText('4 Funding');
  await body.evaluate(el => { el.scrollTop = 0; });
  await expect(rail.locator('[aria-current="location"]')).toHaveText('1 Customer');
});

test('quote section navigation survives autosaves and drawer remounts without moving focus', async ({ page }) => {
  const { frame, projectId } = await setup(page);
  const rail = frame.getByRole('navigation', { name: 'Quote sections', exact: true });
  await rail.locator('[data-quote-section-link="3"]').focus();
  await page.keyboard.press('Enter');
  await expect(rail.locator('[aria-current="location"]')).toHaveText('3 Terms');
  await expect(rail.locator('[data-quote-section-link="3"]')).toBeFocused();
  const field = frame.locator('[data-quote-scope]');
  await field.fill('New scope recorded from the section navigation test');
  await field.blur();
  await expect.poll(() => frame.evaluate(id => UOS.ProgramApp.workspace().entities.quotes.find(q => q.projectId === id).scopeNotes, projectId)).toBe('New scope recorded from the section navigation test');
  await expect(rail.locator('[aria-current="location"]')).toHaveText('3 Terms');
  await frame.locator('[data-quote-save]').click();
  await frame.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  await expect(rail.locator('[aria-current="location"]')).toHaveText('3 Terms');
  await rail.locator('[data-quote-section-link="6"]').click();
  await expect(rail.locator('[aria-current="location"]')).toHaveText('6 Position');
  await frame.locator('[data-quote-print]').evaluate(el => { window.print = () => window.dispatchEvent(new Event('beforeprint')); el.click(); });
  await expect(frame.locator('.program-quote-print-host')).not.toContainText('1 Customer');
  await frame.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await rail.locator('[data-quote-section-link="1"]').click();
  await expect(rail.locator('[aria-current="location"]')).toHaveText('1 Customer');
});


test('rail reveals the active item after narrowing and stays readable in both themes', async ({ page }) => {
  const { frame } = await setup(page);
  const rail = frame.getByRole('navigation', { name: 'Quote sections', exact: true });
  await rail.evaluate(el => { el.style.width = '240px'; });
  await rail.locator('[data-quote-section-link="6"]').click();
  await expect(rail.locator('[aria-current="location"]')).toHaveText('6 Position');
  await rail.evaluate(el => { el.style.width = '180px'; });
  await expect.poll(() => rail.evaluate(el => {
    const r = el.getBoundingClientRect(), active = el.querySelector('[aria-current]').getBoundingClientRect();
    return active.left >= r.left - 0.5 && active.right <= r.right + 0.5 && el.scrollWidth <= el.clientWidth;
  })).toBe(true);
  const rows = await rail.getByRole('button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().top));
  expect(new Set(rows).size).toBe(1);
  for (const theme of ['light', 'dark']) {
    await frame.evaluate(theme => document.documentElement.setAttribute('data-suite-theme', theme), theme);
    const contrast = await rail.locator('[aria-current]').evaluate(el => {
      const css = getComputedStyle(el);
      const luminance = colour => {
        const rgb = colour.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      const a = luminance(css.color), b = luminance(css.backgroundColor);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
});
