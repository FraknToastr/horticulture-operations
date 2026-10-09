const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.beforeEach(async ({ page }) => { await suppressBackupModalForFunctionalTest(page); });

for (const owner of ['NSA', 'EVT']) for (const width of [1600, 1024, 600]) for (const font of ['default', 'dyslexic']) {
  test(`${owner} framed Register at ${width}px (${font}) preserves columns, gaps and fixed actions`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const prefix = owner === 'NSA' ? 'NSA-APP' : 'EVT';
    const ids = [`${prefix}-FRAME-1`, `${prefix}-FRAME-LONG-IDENTIFIER-2`, `${prefix}-FRAME-EMPTY-3`];
    await child.evaluate(async ({ owner, ids, font }) => {
      document.documentElement.dataset.suiteFont = font;
      await document.fonts.ready;
      await UOS.ProgramApp.updateWorkspace(workspace => {
        const records = owner === 'NSA' ? workspace.entities.applications : workspace.entities.events;
        records.push(...ids.map((id, n) => ({ id, owner, type: owner === 'NSA' ? 'application' : 'event',
          ...(n === 2 ? {} : { title: n ? 'A very long title to test responsive truncation and full-value tooltip access' : 'Compact name' }),
          ...(n === 2 ? {} : { location: n ? 'An extended location value for the responsive Register layout' : 'North Terrace' }),
          ...(n === 2 ? {} : { receipt: n ? 'RECEIPT-LONG-000002' : 'R-1', jobId: n ? 'EVENT-LONG-000002' : 'E-1' }),
          status: ['received', 'approved', 'cancelled'][n], dateReceived: `2026-09-${20 + n}` })));
        records.push(...Array.from({ length: 21 }, (_, n) => ({ id: `${owner === 'NSA' ? 'NSA-APP' : 'EVT'}-EXTRA-${n}`,
          owner, type: owner === 'NSA' ? 'application' : 'event', title: `Additional record ${n}`, status: 'received', dateReceived: '2026-09-23' })));
        workspace.workspace.destination = 'register';
        workspace.workspace.selectedEntityId = null;
        return workspace;
      });
      UOS.ProgramDisclosureRows.closeScope('register');
    }, { owner, ids, font });
    const table = child.locator('.program-register-table');
    const row = child.locator(`tr[data-register-record="${ids[0]}"]`);
    await expect(row).toBeVisible();
    await expect(table.locator('thead th')).toHaveText(['Expand / Collapse', owner === 'NSA' ? /^Receipt[↕↑↓]$/ : /^Event Number[↕↑↓]$/, 'App Id', 'Title / Name', 'Location', 'Status', /^Received[↕↑↓]$/, 'Project', 'Budget', 'Actions']);
    await expect(row.locator('.program-register-table__app-id-cell')).toHaveText(ids[0]);
    await expect(row.locator('.program-register-table__title-cell')).toHaveText('Compact name');
    await expect(child.locator(`tr[data-register-record="${ids[2]}"] .program-register-table__title-cell`)).toHaveText(owner === 'NSA' ? 'Untitled application' : 'Untitled event');
    await expect(row.locator('td > .commercial-value-frame')).toHaveCount(8);
  await expect(row.locator('.program-register-project-state')).toHaveText('Not Created');
  expect(await row.locator('.program-register-project-state').evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(255, 255, 0)');
    await expect(row.locator('.program-status-pill > *, .program-register-project-state > *')).toHaveCount(0);
    await expect(row.locator('td:first-child [data-disclosure-toggle]')).toHaveCount(1);
    await expect(row.locator('.program-register-table__actions-cell [data-disclosure-toggle]')).toHaveCount(0);
    const headerFills = await table.locator('thead th').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
    expect(new Set(headerFills).size).toBe(1);
    expect(headerFills[0]).toBe(owner === 'NSA' ? 'rgb(4, 120, 87)' : 'rgb(3, 105, 161)');
    expect(await table.locator('thead th').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).color === 'rgb(255, 255, 255)'))).toBe(true);
    const usedFill = await row.locator('.is-current-module').first().evaluate(node => getComputedStyle(node).backgroundColor);
    expect(await row.locator('td:not(.program-register-table__actions-cell)').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor))).toEqual(Array(9).fill(usedFill));
    const expectRailBackgrounds = async () => {
      const fills = await table.locator('.program-register-summary-row').evaluateAll(nodes => nodes.map(node => ({
        expected: node.matches(':hover,:focus-within,:focus-visible,.is-selected,.is-being-edited,.is-navigation-focus,.is-disclosure-open,[aria-selected="true"]') ? getComputedStyle(node).backgroundColor : 'rgb(255, 255, 255)',
        cell: getComputedStyle(node.querySelector('.program-register-table__actions-cell')).backgroundColor,
        rail: getComputedStyle(node.querySelector('.commercial-action-rail')).backgroundColor
      })));
      expect(fills.length).toBeGreaterThan(0);
      for (const fill of fills) {
        expect(fill.cell).toBe(fill.expected);
        expect(fill.rail).toBe(fill.expected);
      }
      expect(await row.locator('.is-current-module').first().evaluate(node => getComputedStyle(node).backgroundColor)).toBe(usedFill);
    };
    await expectRailBackgrounds();
    const geometry = await row.evaluate(node => {
      const frames = Array.from(node.querySelectorAll('td > .commercial-value-frame'));
      const next = node.nextElementSibling.nextElementSibling;
      return { heights: frames.concat(Array.from(node.querySelectorAll('.commercial-icon-button'))).map(x => x.getBoundingClientRect().height),
        gaps: frames.slice(1).map((x, n) => x.getBoundingClientRect().left - frames[n].getBoundingClientRect().right),
        rowGap: next.querySelector('.commercial-value-frame').getBoundingClientRect().top - frames[0].getBoundingClientRect().bottom,
        topBuffer: frames[0].getBoundingClientRect().top - node.getBoundingClientRect().top,
        bottomBuffer: node.getBoundingClientRect().bottom - frames[0].getBoundingClientRect().bottom,
        fills: frames.filter(x => x.matches('.program-status-pill,.program-register-project-state')).map(x => getComputedStyle(x).backgroundColor) };
    });
    expect(new Set(geometry.heights).size).toBe(1);
    geometry.gaps.forEach(gap => expect(gap).toBeCloseTo(8, 0));
    expect(geometry.rowGap).toBeCloseTo(16, 0);
    expect(geometry.topBuffer).toBeCloseTo(8, 0);
    expect(geometry.bottomBuffer).toBeCloseTo(8, 0);
    const edgeBuffers = await row.evaluate(node => ({
      left: node.querySelector('[data-disclosure-toggle]').getBoundingClientRect().left - node.getBoundingClientRect().left,
      right: node.querySelector('.program-register-table__actions-cell').getBoundingClientRect().right - node.querySelector('.commercial-action-rail button:last-child').getBoundingClientRect().right
    }));
    expect(edgeBuffers.left).toBeCloseTo(8, 0);
    expect(edgeBuffers.right).toBeCloseTo(edgeBuffers.left, 0);
    geometry.fills.forEach(fill => expect(fill).not.toBe('rgba(0, 0, 0, 0)'));
    const railAppearance = () => row.locator('.commercial-action-rail button').evaluateAll(nodes => nodes.map(node => ({ border: getComputedStyle(node).borderColor, shadow: getComputedStyle(node).boxShadow })));
    const neutralRail = await railAppearance();
    await row.focus();
    expect(await row.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('none');
    await row.locator('.program-register-table__reference-cell').hover();
    const highlighted = await row.evaluate(node => Array.from(node.querySelectorAll('.commercial-value-frame')).map(x => getComputedStyle(x).borderTopColor));
    expect(new Set(highlighted).size).toBe(1);
    expect(highlighted[0]).toBe('rgb(74, 222, 128)');
    await expectRailBackgrounds();
    expect(await railAppearance()).toEqual(neutralRail);
    for (const frame of await row.locator('.commercial-value-frame').evaluateAll(nodes => nodes.map(node => ({ width: getComputedStyle(node).borderWidth, shadow: getComputedStyle(node).boxShadow })))) {
      expect(frame.width).toBe('2px');
      expect(frame.shadow).toBe('none');
    }
    await row.evaluate(node => { node.classList.add('is-selected'); node.blur(); });
    const otherRow = child.locator(`tr[data-register-record="${ids[1]}"]`);
    await otherRow.locator('.program-register-table__reference-cell').hover();
    for (const candidate of [row, otherRow]) {
      expect(await candidate.locator('.commercial-value-frame').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).borderWidth === '2px'))).toBe(true);
    }
    expect(await railAppearance()).toEqual(neutralRail);
    await expectRailBackgrounds();
    await row.evaluate(node => node.classList.remove('is-selected'));
    await page.mouse.move(0, 0);
    await expectRailBackgrounds();
    const scroller = child.locator('.program-register-main-pane .program-table-wrap');
    const headerBefore = await table.locator('thead th').first().boundingBox();
    await scroller.evaluate(node => { node.scrollTop = 120; });
    expect((await table.locator('thead th').first().boundingBox()).y).toBeCloseTo(headerBefore.y, 0);
    await scroller.evaluate(node => { node.scrollTop = 0; });
    const before = await row.locator('.program-register-table__actions-cell').boundingBox();
    await scroller.evaluate(node => { node.scrollLeft = node.scrollWidth; });
    const after = await row.locator('.program-register-table__actions-cell').boundingBox();
    expect(after.x).toBeCloseTo(before.x, 0);
    await expectRailBackgrounds();
    const actionBounds = await row.locator('.commercial-action-rail').evaluate(node => {
      const bounds = node.closest('.program-table-wrap').getBoundingClientRect();
      return Array.from(node.querySelectorAll('button')).map(button => ({ left: button.getBoundingClientRect().left - bounds.left, right: bounds.right - button.getBoundingClientRect().right }));
    });
    actionBounds.forEach(button => { expect(button.left).toBeGreaterThanOrEqual(0); expect(button.right).toBeGreaterThanOrEqual(0); });
    await scroller.evaluate(node => { node.scrollLeft = 0; });
    await row.locator('[data-disclosure-toggle]').click();
    await expect(row.locator('[data-disclosure-toggle]')).toHaveAttribute('aria-expanded', 'true');
    const dividerStyles = await child.locator(`[data-register-drawer-record="${ids[0]}"] .program-register-nsa-main-grid > .program-register-nsa-section--delivery`).evaluate(node => {
      const delivery = getComputedStyle(node);
      const divider = getComputedStyle(node, '::after');
      const reference = getComputedStyle(node.parentElement.querySelector('.program-register-nsa-summary-group'), '::after');
      return { border: delivery.borderRightWidth, top: divider.top, bottom: divider.bottom, width: divider.width,
        fill: divider.backgroundColor, display: divider.display, reference: { top: reference.top, bottom: reference.bottom, width: reference.width, fill: reference.backgroundColor, display: reference.display } };
    });
    expect(dividerStyles.border).toBe('0px');
    expect(dividerStyles.top).toBe('18px');
    expect(dividerStyles.bottom).toBe('18px');
    expect(dividerStyles.width).toBe('1px');
    for (const property of ['top', 'bottom', 'width', 'fill', 'display']) expect(dividerStyles[property]).toBe(dividerStyles.reference[property]);
    await page.mouse.move(0, 0);
    await expectRailBackgrounds();
    expect(await row.evaluate(node => new Set(Array.from(node.querySelectorAll('.commercial-value-frame')).map(x => getComputedStyle(x).borderTopColor)).size)).toBe(1);
    await page.screenshot({ path: testInfo.outputPath('framed-register.png') });
    await row.locator('[data-disclosure-toggle]').click();
    await expect(row.locator('[data-disclosure-toggle]')).toHaveAttribute('aria-expanded', 'false');
    await row.locator('[data-disclosure-toggle]').focus();
    await page.keyboard.press('Enter');
    await expect(row.locator('[data-disclosure-toggle]')).toHaveAttribute('aria-expanded', 'true');
    expect(errors).toEqual([]);
  });
}
