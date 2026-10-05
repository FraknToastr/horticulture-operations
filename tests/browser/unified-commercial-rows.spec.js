const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');
test.beforeEach(async ({ page }) => { await suppressBackupModalForFunctionalTest(page); });

for (const owner of ['NSA', 'EVT']) for (const width of [1840, 390]) {
  test(`${owner} commercial rows share frames, gaps and contained ellipses at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const description = 'A very long horticulture description with measurements and delivery instructions '.repeat(8) + '\nOriginal second line';
    await child.evaluate(async ({ owner, description }) => {
      await window.UOS.ProgramApp.updateWorkspace(workspace => {
        const record = { id: `${owner === 'NSA' ? 'NSA-APP' : 'EVT'}-UNIFIED-ROWS`, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Unified rows', status: 'received' };
        workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
        const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id);
        promoted.workspace.entities.rateItems.push({ id: 'RATE-UNIFIED-ROWS', owner: '', type: 'rateItem', kind: 'Labour', kindSource: 'user', category: 'City Operations', description, unit: 'hour', unitRate: 141, schedulerEnabled: true, active: true, quantityMode: 'direct' });
        promoted.workspace.entities.rateItems.push({ id: 'RATE-UNIFIED-SHORT', owner: '', type: 'rateItem', kind: 'Labour', kindSource: 'user', category: 'Short', description: 'Short category comparison', unit: 'hour', unitRate: 10, schedulerEnabled: false, active: false, quantityMode: 'direct' });
        promoted.workspace.workspace.selectedProjectId = promoted.project.id;
        promoted.workspace.workspace.selectedEntityId = record.id;
        return promoted.workspace;
      });
    }, { owner, description });
    await child.locator('[data-program-destination="costing"]').click();
    await child.locator('[data-costing-section="Labour"]').press('Enter');
    const library = child.locator('[data-rate-item-row="RATE-UNIFIED-ROWS"]');
    await library.locator('[data-costing-add-rate]').click();
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.some(line => line.rateItemId === 'RATE-UNIFIED-ROWS'))).toBe(true);
    const calculator = child.locator('[data-costing-line-quantity]').last().locator('xpath=ancestor::tr[1]');
    async function inspect(row, kind) {
      return row.evaluate((row, kind) => {
        const table = row.closest('table');
        if (!table) return null;
        const frameSelector = '.uos-input,.uos-select,.program-cost-value,.program-rate-state,.program-cost-source-frame,.program-rate-actions>button,.program-rate-scheduler-info,.program-calculator-action-rail>button,.program-quote-builder-table__actions>button';
        const frames = [...row.querySelectorAll(frameSelector)];
        const rects = frames.map(node => node.getBoundingClientRect());
        const rowBounds = row.getBoundingClientRect();
        for (const frame of frames.concat([...row.querySelectorAll('.program-category-pill')])) {
          const control = frame.getBoundingClientRect(), cell = frame.closest('td').getBoundingClientRect();
          if (control.top < rowBounds.top || control.bottom > rowBounds.bottom || control.top < cell.top || control.bottom > cell.bottom) {
            throw new Error(`${kind}: a row control is vertically clipped (control ${control.top}–${control.bottom}, row ${rowBounds.top}–${rowBounds.bottom}, cell ${cell.top}–${cell.bottom})`);
          }
        }
        const rail = row.querySelector('.program-rate-actions,.program-calculator-action-rail,.program-quote-builder-table__actions');
        const buttons = [...rail.children];
        const railRects = buttons.map(node => node.getBoundingClientRect());
        const cells = [...row.cells].slice(kind === 'library' ? 1 : 0);
        const cellFrames = cells.map(cell => cell.querySelector(frameSelector)).filter(Boolean).map(node => node.getBoundingClientRect());
        if (kind === 'library' && table.getBoundingClientRect().width > table.parentElement.clientWidth + 1) cellFrames.pop();
        const text = row.querySelector('[data-rate-description],.program-calculator-line-item>.program-cost-value,[data-line-field="description"]');
        const css = getComputedStyle(text);
        const clippingCell = rail.closest('td').getBoundingClientRect();
        return { height: parseFloat(getComputedStyle(table).getPropertyValue('--commercial-frame-height')), heights: rects.map(rect => rect.height), railGaps: railRects.slice(1).map((rect, i) => rect.left - railRects[i].right), cellGaps: cellFrames.slice(1).map((rect,i) => rect.left - cellFrames[i].right), noClippedButtons: railRects.every(rect => rect.left >= clippingCell.left - 0.5 && rect.right <= clippingCell.right - 3), whiteSpace: css.whiteSpace, overflow: css.overflowX, ellipsis: css.textOverflow, overflows: text.scrollWidth > text.clientWidth, text: text.value || text.textContent, title: text.title, iconSizes: [...rail.querySelectorAll('svg')].map(icon => getComputedStyle(icon).width), buttonCount: buttons.length, categoryHeight: row.querySelector('.program-category-pill')?.getBoundingClientRect().height };
      }, kind);
    }
    function assertLayout(layout, kind) {
      expect(layout).not.toBeNull();
      for (const height of layout.heights) expect(height).toBe(layout.height);
      for (const gap of [...layout.railGaps, ...layout.cellGaps]) expect(gap, `${kind} frame gap`).toBeCloseTo(8, 1);
      expect(layout.noClippedButtons, `${kind} complete action rail`).toBe(true);
      expect(layout.whiteSpace).toBe('nowrap');
      expect(['hidden', 'clip']).toContain(layout.overflow);
      expect(layout.ellipsis).toBe('ellipsis');
      expect(layout.overflows).toBe(true);
      for (const size of layout.iconSizes) expect(size).toBe('20px');
      if (kind === 'library') { expect(layout.buttonCount).toBe(4); expect(layout.categoryHeight).toBe(layout.height); }
    }
    for (const font of ['normal', 'dyslexic']) {
      await child.evaluate(font => { document.documentElement.dataset.suiteFont = font; document.documentElement.dataset.suiteTheme = font === 'normal' ? 'light' : 'dark'; }, font);
      assertLayout(await inspect(library, 'library'), 'library');
      assertLayout(await inspect(calculator, 'calculator'), 'calculator');
    }
    await expect(library.locator('[data-rate-description]')).toHaveAttribute('data-uos-tooltip', description);
    const positions = await child.evaluate(() => ['RATE-UNIFIED-ROWS', 'RATE-UNIFIED-SHORT'].map(id => {
      const row = document.querySelector(`[data-rate-item-row="${id}"]`);
      const category = row.querySelector('.program-category-pill').getBoundingClientRect();
      const description = row.querySelector('[data-rate-description]').getBoundingClientRect();
      const rail = row.querySelector('.program-rate-actions');
      const buttons = [...rail.children].map(node => node.getBoundingClientRect());
      const cell = rail.closest('td');
      return { gap: description.left - category.right, description: description.left, unit: row.cells[2].getBoundingClientRect().left, slots: buttons.length, blank: !!rail.querySelector('.program-rate-empty-slot'), rightGap: cell.getBoundingClientRect().right - buttons.at(-1).right, padding: parseFloat(getComputedStyle(cell).paddingRight) };
    }));
    for (const row of positions) { expect(row.gap).toBeCloseTo(8, 1); expect(row.slots).toBe(4); expect(row.rightGap).toBeCloseTo(row.padding, 1); }
    expect(positions[1].blank).toBe(true);
    expect(positions[1].description).toBeCloseTo(positions[0].description, 1);
    expect(positions[1].unit).toBeCloseTo(positions[0].unit, 1);
    for (const zoom of [1, 1.25, 2]) {
      await child.locator('.program-cost-table').evaluate((table, zoom) => { table.style.zoom = zoom; }, zoom);
      for (const kind of ['Labour', 'Equipment', 'Material', 'Contractors', 'Sundry']) {
        await child.locator(`[data-costing-section="${kind}"]`).click();
        const clipped = await child.locator('[data-costing-catalog-body]').evaluate(body => {
          const failures = [];
          for (const row of body.rows) {
            const bounds = row.getBoundingClientRect();
            for (const control of row.querySelectorAll('.program-category-pill,.program-cost-value,.program-rate-state,.program-rate-actions>button,.program-rate-scheduler-info')) {
              const rect = control.getBoundingClientRect(), cell = control.closest('td').getBoundingClientRect();
              if (rect.top < bounds.top - 0.5 || rect.bottom > bounds.bottom + 0.5 || rect.top < cell.top - 0.5 || rect.bottom > cell.bottom + 0.5 || rect.left < cell.left - 0.5 || rect.right > cell.right + 0.5) failures.push(row.dataset.rateItemRow);
            }
          }
          return failures;
        });
        expect(clipped, `${owner} ${kind} controls fit their rows and cells at ${zoom * 100}%`).toEqual([]);
      }
    }
    await child.locator('.program-cost-table').evaluate(table => { table.style.zoom = ''; });
    await child.locator('[data-costing-section="Material"]').click();
    if (width > 640) await child.locator('.program-cost-table-wrap').screenshot({ path: testInfo.outputPath(`${owner}-material-table.png`) });
    await child.locator('[data-costing-section="Labour"]').click();
    await expect(library).toBeVisible();
    expect(await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.rateItems.find(rate => rate.id === 'RATE-UNIFIED-ROWS').description)).toBe(description);
    const wrap = child.locator('.program-cost-table-wrap');
    await wrap.evaluate(node => { node.scrollLeft = node.scrollWidth; });
    const railVisible = () => library.locator('.program-rate-actions').evaluate(rail => { const container = rail.closest('.program-cost-table-wrap'); if (!container) return false; const wrap = container.getBoundingClientRect(); return [...rail.children].every(button => { const rect = button.getBoundingClientRect(); return rect.left >= wrap.left + 3 && rect.right <= wrap.right - 3; }); });
    await expect.poll(railVisible).toBe(true);
    if (width > 640) await library.screenshot({ path: testInfo.outputPath(`${owner}-library-rows.png`) });
    await child.locator('[data-program-destination="quotes"]').click();
    await child.locator('[data-add-line]').click();
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.quoteLines.filter(line => line.sourceKind === 'custom').length)).toBe(1);
    await expect(child.locator('[data-program-persistence]')).toHaveText('Saved');
    const quote = child.locator('[data-quote-builder-lines] tr').filter({ has: child.locator('[data-remove-line]') }).last();
    const quoteDescription = description.replace(/\n/g, ' ');
    await quote.locator('[data-line-field="description"]').fill(quoteDescription);
    await quote.locator('[data-line-field="description"]').press('Tab');
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.quoteLines.find(line => line.sourceKind === 'custom')?.description)).toBe(quoteDescription);
    for (const font of ['normal', 'dyslexic']) {
      await child.evaluate(font => { document.documentElement.dataset.suiteFont = font; }, font);
      let layout;
      await expect.poll(async () => { layout = await inspect(quote, 'quote'); return layout !== null; }).toBe(true);
      assertLayout(layout, 'quote');
      expect(layout.text).toBe(quoteDescription);
    }
    await quote.locator('[data-line-field="description"]').focus();
    await quote.locator('[data-line-field="description"]').press('End');
    await expect(quote.locator('[data-line-field="description"]')).toHaveValue(quoteDescription);
    if (width > 640) { await quote.locator('[data-line-field="description"]').blur(); await quote.screenshot({ path: testInfo.outputPath(`${owner}-quote-row.png`) }); }
  });
}
