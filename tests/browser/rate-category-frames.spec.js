const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

for (const owner of ['NSA', 'EVT']) for (const width of [1840, 390]) {
  test(`${owner}: equal Category frames contain shortened text at ${width}px`, async ({ page }, testInfo) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    await child.evaluate(async owner => {
      await window.UOS.ProgramApp.updateWorkspace(ws => {
        const record = { id: `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-CATEGORY-FRAMES`, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Category frames', status: owner === 'NSA' ? 'received' : 'enquiry' };
        ws.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
        const promoted = window.UOS.ProgramModel.promoteRegisterRecord(ws, record.id);
        ws = promoted.workspace;
        ws.workspace.selectedEntityId = record.id;
        ws.workspace.selectedProjectId = promoted.project.id;
        ['Planting & Vegetation and native trees', 'Soil / top dress', 'Groundworks & Turf'].forEach((category, i) => ws.entities.rateItems.push({ id: `RATE-CATEGORY-FRAME-${i}`, owner: '', type: 'rateItem', kind: 'Material', kindSource: 'user', category, description: `Category frame regression ${i}`, unit: 'each', unitRate: 1, active: true, schedulerEnabled: false, quantityMode: 'direct' }));
        return ws;
      });
      await window.UOS.ProgramApp.navigate('costing');
    }, owner);
    await child.locator('[data-costing-section="Material"]').click();
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);
    const tools = child.locator('[data-costing-tools-toggle]');
    if (width < 640) await tools.press('Space');
    else await tools.click();
    const search = child.locator('[data-costing-search]');
    await expect(search).toBeVisible();
    await search.fill('Category frame regression');
    const table = child.locator('.program-cost-table');
    async function measure() {
      return table.evaluate(table => {
        const pills = [...table.querySelectorAll('.program-category-pill')];
        return { column: table.style.getPropertyValue('--commercial-category-width'), rows: pills.map(pill => {
          const frame = pill.getBoundingClientRect(), cell = pill.closest('td'), description = cell.nextElementSibling.querySelector('[data-rate-description]').getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(pill);
          const text = range.getBoundingClientRect();
          return { width: frame.width, text: pill.textContent, tooltip: pill.getAttribute('data-uos-tooltip'), inside: text.left >= frame.left && text.right <= frame.right && text.top >= frame.top && text.bottom <= frame.bottom, gap: description.left - frame.right, description: description.left, clipped: getComputedStyle(pill).overflowX === 'hidden' };
        }) };
      });
    }
    for (const font of ['normal', 'dyslexic']) {
      await child.evaluate(async font => { document.documentElement.dataset.suiteFont = font; await document.fonts.ready; }, font);
      for (const zoom of [1, 1.25, 2]) {
        await table.evaluate((table, zoom) => { table.style.zoom = zoom; }, zoom);
        await expect.poll(async () => (await measure()).rows.every(row => row.inside)).toBe(true);
        const layout = await measure();
        expect(layout.rows).toHaveLength(3);
        expect(layout.rows[0].text).toBe('Planting & Vegetation ...');
        expect(layout.rows[0].tooltip).toContain('Planting & Vegetation and native trees');
        for (const row of layout.rows) {
          expect(row.width).toBeCloseTo(layout.rows[0].width, 1);
          expect(row.description).toBeCloseTo(layout.rows[0].description, 1);
          expect(row.gap).toBeCloseTo(8 * zoom, 1);
          expect(row.clipped).toBe(true);
        }
        await search.fill('Category frame regression 1');
        const shorter = await measure();
        expect(shorter.rows).toHaveLength(1);
        expect(parseFloat(shorter.column)).toBeLessThan(parseFloat(layout.column));
        await search.fill('Category frame regression');
        expect((await measure()).column).toBe(layout.column);
      }
    }
    await table.evaluate(table => { table.style.zoom = ''; });
    if (width > 640) await table.screenshot({ path: testInfo.outputPath(`${owner}-equal-category-frames.png`) });
  });
}
