const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

const valueSelector = '.commercial-value-frame,.uos-input,.uos-select,.program-cost-value,.program-category-pill,.program-rate-state,.program-cost-source-frame';

async function emphasis(row) {
  return row.evaluate((node, selector) => ({
    frames: [...node.querySelectorAll(':scope > td > :is(' + selector + ')')].map(frame => ({
      border: getComputedStyle(frame).borderColor,
      borderWidth: getComputedStyle(frame).borderWidth,
      shadow: getComputedStyle(frame).boxShadow,
      width: frame.getBoundingClientRect().width,
      height: frame.getBoundingClientRect().height
    })),
    backgrounds: [...node.cells].map(cell => getComputedStyle(cell).backgroundColor),
    actions: [...node.querySelectorAll('.commercial-action-rail button,.program-rate-actions > button,.program-calculator-action-rail > button,.program-quote-builder-table__actions > button')].map(button => ({
      border: getComputedStyle(button).borderColor,
      shadow: getComputedStyle(button).boxShadow
    }))
  }), valueSelector);
}

async function checkSelectionAndIndependentHover(page, first, second) {
  await page.mouse.move(0, 0);
  await first.locator('input,select,button').evaluateAll(nodes => nodes.forEach(node => node.blur()));
  let baseline;
  await expect.poll(async()=>{baseline=await emphasis(first);return baseline.backgrounds.every(fill=>["rgba(0, 0, 0, 0)","rgb(255, 255, 255)"].includes(fill));}).toBe(true);
  baseline.backgrounds.forEach(fill => expect(['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)']).toContain(fill));
  await first.locator('td').first().hover();
  await expect.poll(async () => (await emphasis(first)).frames.every(frame => frame.border === 'rgb(74, 222, 128)')).toBe(true);
  const hovered = await emphasis(first);
  expect(hovered.frames.length).toBeGreaterThan(0);
  expect(new Set(hovered.frames.map(frame => frame.border)).size, JSON.stringify(hovered)).toBe(1);
  hovered.frames.forEach(frame => expect(frame.border).toBe('rgb(74, 222, 128)'));
  expect(hovered.backgrounds).toEqual(baseline.backgrounds);
  hovered.frames.forEach(frame => {
    expect(frame.borderWidth).toBe('2px');
    expect(frame.shadow).toBe('none');
  });
  expect(hovered.actions).toEqual(baseline.actions);
  expect(hovered.frames.map(({ width, height }) => ({ width, height }))).toEqual(baseline.frames.map(({ width, height }) => ({ width, height })));

  // Exercise the shared selected-row styling without inventing new selection
  // commands for modules whose existing tables do not select rows.
  await first.evaluate(node => node.classList.add('is-selected'));
  await page.mouse.move(0, 0);
  expect((await emphasis(first)).frames).toEqual(hovered.frames);
  await second.locator('td').first().hover();
  (await emphasis(second)).frames.forEach(frame => expect(frame.borderWidth).toBe('2px'));
  expect((await emphasis(first)).frames).toEqual(hovered.frames);
  expect((await emphasis(first)).actions).toEqual(baseline.actions);
  await first.evaluate(node => node.classList.remove('is-selected'));
  await expect.poll(async () => (await emphasis(first)).frames.map(frame => frame.border)).toEqual(baseline.frames.map(frame => frame.border));
  expect((await emphasis(first)).frames).toEqual(baseline.frames);
}

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: non-Register framed tables keep neutral rows and persistent green value emphasis, excluding actions`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    await child.evaluate(async owner => {
      await UOS.ProgramApp.updateWorkspace(workspace => {
        const record = { id: `${owner === 'NSA' ? 'NSA-APP' : 'EVT'}-EMPHASIS`, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Frame emphasis', status: 'received' };
        workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
        const promoted = UOS.ProgramModel.promoteRegisterRecord(workspace, record.id);
        workspace = promoted.workspace;
        workspace.workspace.selectedProjectId = promoted.project.id;
        workspace.workspace.selectedEntityId = record.id;
        for (let n = 1; n <= 2; n++) workspace.entities.rateItems.push({ id: `RATE-EMPHASIS-${n}`, owner: '', type: 'rateItem', kind: 'Labour', kindSource: 'user', category: 'Operations', description: `Emphasis rate ${n}`, unit: 'hour', unitRate: 10, active: true, schedulerEnabled: false, quantityMode: 'direct' });
        return workspace;
      });
    }, owner);
    await child.locator('[data-program-destination="costing"]').click();
    await child.locator('[data-costing-section="Labour"]').click();
    const library = child.locator('[data-rate-item-row="RATE-EMPHASIS-1"]');
    const otherLibrary = child.locator('[data-rate-item-row="RATE-EMPHASIS-2"]');
    await checkSelectionAndIndependentHover(page, library, otherLibrary);
    for (let n = 1; n <= 2; n++) {
      await child.locator(`[data-costing-add-rate="RATE-EMPHASIS-${n}"]`).click();
      await expect.poll(() => child.evaluate(() => UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(n);
    }
    const calculator = child.locator('.program-calculator-table > tbody > tr').filter({ has: child.locator('[data-costing-line-quantity]') });
    await checkSelectionAndIndependentHover(page, calculator.nth(0), calculator.nth(1));
    await child.locator('[data-program-destination="quotes"]').click();
    await child.locator('[data-add-line]').click();
    await child.locator('[data-add-line]').click();
    const quotes = child.locator('[data-quote-builder-lines] > tr').filter({ has: child.locator('[data-remove-line]') });
    await expect(quotes).toHaveCount(2);
    await checkSelectionAndIndependentHover(page, quotes.nth(0), quotes.nth(1));
    await child.locator('[data-program-destination="planner"]').click();
    const sectionToggle = child.locator('.planner-section-toggle').first();
    if (await sectionToggle.getAttribute('aria-expanded') !== 'true') await sectionToggle.click();
    const tasks = child.locator('.planner-item-row:visible');
    await expect(tasks.first()).toBeVisible();
    await checkSelectionAndIndependentHover(page, tasks.nth(0), tasks.nth(1));
  });
}
