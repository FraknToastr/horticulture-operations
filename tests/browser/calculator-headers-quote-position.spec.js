const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function setup(page, owner, destination) {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const child = page.frames().find(frame => frame !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  await child.evaluate(async ({ owner, destination }) => {
    await window.UOS.ProgramApp.updateWorkspace(ws => {
      const record = { id: `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-HEADER-POSITION`, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Header and position', status: owner === 'NSA' ? 'received' : 'enquiry' };
      ws.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
      const promoted = window.UOS.ProgramModel.promoteRegisterRecord(ws, record.id); ws = promoted.workspace;
      ws.workspace.selectedProjectId = promoted.project.id; ws.workspace.selectedEntityId = record.id;
      ws.entities.projects.find(p => p.id === promoted.project.id).funding = { operationalAmount: 1000 };
      ws.entities.costingLines.push({ id: owner + '-COST-HEADER-POSITION', owner, type: 'costingLine', projectId: promoted.project.id, jobId: null, description: 'Contractor work', kind: 'Contractors', quantity: 1, unitRate: 100, estimatedTotal: 100 });
      if (destination === 'quotes') ws = window.UOS.ProgramQuotes.saveDraft(ws, { projectId: promoted.project.id, quoteDate: '2026-10-02', scopeNotes: 'Initial scope' });
      return ws;
    });
    await window.UOS.ProgramApp.navigate(destination);
  }, { owner, destination });
  return child;
}

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: Calculator section headings reuse matching resource icons`, async ({ page }) => {
    const child = await setup(page, owner, 'costing');
    await child.evaluate(async owner => {
      await window.UOS.ProgramApp.updateWorkspace(ws => {
        ['Labour', 'Equipment', 'Material', 'Sundry'].forEach(kind => {
          ws.entities.costingLines.push({
            id: `${owner}-COST-SECTION-ICON-${kind}`, owner, type: 'costingLine',
            projectId: ws.workspace.selectedProjectId, jobId: null,
            description: `${kind} resource`, kind, quantity: 1, unitRate: 10, estimatedTotal: 10
          });
        });
        return ws;
      });
    }, owner);
    await expect(child.locator('[data-costing-line-group]')).toHaveCount(5);
    const headings = await child.locator('[data-costing-line-group]').evaluateAll(rows => rows.map(row => {
      const kind = row.dataset.costingLineGroup;
      const label = row.querySelector('.program-costing-line-group__label');
      const icon = label.querySelector('svg');
      const original = document.querySelector(`[data-costing-section="${kind}"] svg`);
      return { kind, first: label.firstElementChild.tagName.toLowerCase(),
        matches: icon?.outerHTML === original?.outerHTML,
        hidden: icon?.getAttribute('aria-hidden'), label: label.textContent,
        gap: getComputedStyle(label).gap };
    }));
    for (const heading of headings) {
      expect(heading).toEqual({ kind: heading.kind, first: 'svg', matches: true,
        hidden: 'true', label: heading.kind.toUpperCase(), gap: '8px' });
    }
  });
  test(`${owner}: Calculator headers align, wrap Kind menu and keep table headings separate`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 2400, height: 1000 });
    const child = await setup(page, owner, 'costing');
    for (const width of [2400, 1400, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await child.locator('.program-cost-catalog').evaluate((pane, width) => { pane.style.maxWidth = width === 390 ? '350px' : ''; }, width);
      for (const font of ['normal', 'dyslexic']) {
        await child.evaluate(async font => { document.documentElement.dataset.suiteFont = font; await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }, font);
        await expect.poll(() => child.evaluate(() => {
          const heads = [...document.querySelectorAll('.program-costing-workspace :is(.program-cost-catalog,.program-job-calculator)>.program-costing-head')];
          return heads.length === 2 && Math.abs(heads[0].getBoundingClientRect().height - heads[1].getBoundingClientRect().height) < 1;
        })).toBe(true);
        const layout = await child.evaluate(() => {
          const table = document.querySelector('.program-calculator-table'), menu = document.querySelector('.program-cost-tabs'), content = menu.parentElement;
          const th = [...table.tHead.rows[0].cells], bounds = th.map(n => n.getBoundingClientRect());
          const range = n => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect(); };
          return { withinHeader: !!menu.closest('header'), compact: content.classList.contains('is-compact'), height: parseFloat(getComputedStyle(table).getPropertyValue('--commercial-frame-height')) + 13, heights: [table.tHead.rows[0].getBoundingClientRect().height, document.querySelector('.program-cost-table thead tr').getBoundingClientRect().height], colours: th.map(n => getComputedStyle(n).backgroundColor), libraryColours: [...document.querySelectorAll('.program-cost-table thead th')].map(n => getComputedStyle(n).backgroundColor), labels: th.slice(0,3).map(n => n.textContent), qtyCentre: Math.abs((range(th[2]).left + range(th[2]).right) / 2 - (bounds[2].left + bounds[2].right - 8) / 2), noCollision: range(th[1]).right < range(th[2]).left, group: getComputedStyle(table.querySelector('.program-costing-line-group th')).textAlign, toolsIcons: document.querySelector('[data-costing-tools-toggle]').querySelectorAll('svg').length };
        });
        expect(layout.withinHeader).toBe(true);
        if (width === 2400) expect(layout.compact).toBe(false);
        if (width === 390) expect(layout.compact).toBe(true);
        for (const height of layout.heights) expect(height).toBeCloseTo(layout.height, 1);
        const headerCells = await child.evaluate(() => [...document.querySelectorAll('.program-cost-table thead th,.program-calculator-table thead th')].map(th => ({ height: th.getBoundingClientRect().height, width: th.getBoundingClientRect().width, text: th.textContent })));
        for (const cell of headerCells) expect(cell.height, JSON.stringify(headerCells)).toBeCloseTo(layout.height, 1);
        expect(new Set([...layout.colours, ...layout.libraryColours]).size).toBe(1);
        expect(layout.labels).toEqual(['Rate item', 'Source', 'Qty']);
        expect(layout.qtyCentre).toBeLessThan(1);
        expect(layout.noCollision).toBe(true);
        expect(layout.group).toBe('left');
        expect(layout.toolsIcons).toBe(1);
      }
    }
    await page.setViewportSize({ width: 1840, height: 1000 });
    await child.locator('.program-cost-catalog').evaluate(pane => { pane.style.maxWidth = ''; });
    await child.locator('.program-costing-workspace').screenshot({ path: testInfo.outputPath(`${owner}-calculator-headers.png`) });
  });

  test(`${owner}: Calculator column headings stick while standard-height sections scroll`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1840, height: 800 });
    const child = await setup(page, owner, 'costing');
    await child.evaluate(async owner => {
      await window.UOS.ProgramApp.updateWorkspace(ws => {
        const projectId = ws.workspace.selectedProjectId;
        for (let i = 0; i < 40; i++) {
          const kind = i < 20 ? 'Material' : 'Contractors';
          const rateItemId = `RATE-${owner}-STICKY-${i}`;
          ws.entities.rateItems.push({ id: rateItemId, type: 'rateItem', owner: '', kind, kindSource: 'user', category: 'Preparation', description: `Sticky header rate ${i}`, unit: 'each', unitRate: 10, active: true, quantityMode: 'direct' });
          ws.entities.costingLines.push({ id: `${owner}-COST-STICKY-${i}`, type: 'costingLine', owner, projectId, rateItemId, jobId: null, description: `Sticky header rate ${i}`, quantity: 1, unitRate: 10, estimatedTotal: 10 });
        }
        return ws;
      });
    }, owner);
    await child.locator('[data-costing-section="Material"]').click();
    await expect(child.locator('[data-costing-line-quantity]')).toHaveCount(41);
    await expect(child.locator(`[data-rate-item-row^="RATE-${owner}-STICKY-"]`)).toHaveCount(20);
    for (const width of [1840, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await child.evaluate(width => { for (const wrap of document.querySelectorAll('.program-cost-table-wrap,.program-calculator-table-wrap')) wrap.style.maxWidth = width === 390 ? '350px' : ''; }, width);
      for (const font of ['normal', 'dyslexic']) {
        await child.evaluate(async font => { document.documentElement.dataset.suiteFont = font; await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }, font);
        for (const selector of ['.program-cost-table', '.program-calculator-table']) {
          const table = child.locator(selector);
          await expect.poll(() => table.evaluate(table => table.parentElement.scrollHeight - table.parentElement.clientHeight)).toBeGreaterThan(150);
          const before = await table.evaluate(table => {
            const wrap = table.parentElement; wrap.scrollTop = 0; wrap.scrollLeft = 0;
            return { overflow: wrap.scrollHeight - wrap.clientHeight, bodyTop: table.tBodies[0].rows[0].getBoundingClientRect().top };
          });
          expect(before.overflow).toBeGreaterThan(150);
          await table.evaluate(table => { table.parentElement.scrollTop = 160; });
          const sticky = await table.evaluate(table => {
            const wrap = table.parentElement, head = table.tHead, bounds = head.getBoundingClientRect(), cells = [...head.rows[0].cells];
            const first = table.tBodies[0].rows[0], groupCells = [...table.querySelectorAll('.program-costing-line-group>th')];
            return { top: bounds.top, wrapTop: wrap.getBoundingClientRect().top + wrap.clientTop, bodyTop: first.getBoundingClientRect().top, height: bounds.height, standard: parseFloat(getComputedStyle(table).getPropertyValue('--commercial-frame-height')) + 13, groups: groupCells.map(cell => ({ height: cell.getBoundingClientRect().height, rowHeight: cell.parentElement.getBoundingClientRect().height, position: getComputedStyle(cell).position, align: getComputedStyle(cell).textAlign })), cells: cells.map(cell => ({ height: cell.getBoundingClientRect().height, background: getComputedStyle(cell).backgroundColor })) };
          });
          expect(sticky.top).toBeCloseTo(sticky.wrapTop, 0);
          expect(before.bodyTop - sticky.bodyTop).toBeCloseTo(160, 0);
          expect(sticky.height).toBeCloseTo(sticky.standard, 1);
          for (const cell of sticky.cells) { expect(cell.height).toBeCloseTo(sticky.standard, 1); expect(cell.background).not.toBe('rgba(0, 0, 0, 0)'); }
          if (selector === '.program-calculator-table') expect(sticky.groups.length).toBeGreaterThanOrEqual(2);
          for (const group of sticky.groups) { expect(group.height).toBeCloseTo(sticky.standard, 1); expect(group.rowHeight).toBeCloseTo(sticky.standard, 1); expect(group.position).toBe('static'); expect(group.align).toBe('left'); }
          const horizontal = await table.evaluate(table => {
            const wrap = table.parentElement; wrap.scrollLeft = wrap.scrollWidth - wrap.clientWidth;
            const head = table.tHead.rows[0], body = [...table.tBodies[0].rows].find(row => !row.hasAttribute('data-costing-line-group'));
            return { overflow: wrap.scrollWidth - wrap.clientWidth, scrollLeft: wrap.scrollLeft, alignment: [...head.cells].map((cell, i) => Math.abs(cell.getBoundingClientRect().left - body.cells[i].getBoundingClientRect().left)), top: table.tHead.getBoundingClientRect().top, wrapTop: wrap.getBoundingClientRect().top + wrap.clientTop };
          });
          if (width === 390) { expect(horizontal.overflow).toBeGreaterThan(0); expect(horizontal.scrollLeft).toBeGreaterThan(0); }
          for (const offset of horizontal.alignment) expect(offset).toBeLessThan(1);
          expect(horizontal.top).toBeCloseTo(horizontal.wrapTop, 0);
        }
      }
    }
    await page.setViewportSize({ width: 1840, height: 800 });
    await child.evaluate(() => { for (const wrap of document.querySelectorAll('.program-cost-table-wrap,.program-calculator-table-wrap')) { wrap.style.maxWidth = ''; wrap.scrollLeft = 0; wrap.scrollTop = 160; } });
    await child.locator('.program-costing-workspace').screenshot({ path: testInfo.outputPath(`${owner}-sticky-headers.png`) });
  });

  test(`${owner}: Quote funding preserves scroll and focused control after saves and remounts`, async ({ page }) => {
    await page.setViewportSize({ width: 1840, height: 800 });
    const child = await setup(page, owner, 'quotes');
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.quotes.length)).toBe(1);
    const pane = child.locator('.program-quote-pane-body');
    for (const mode of ['mixed', 'city', 'customer']) {
      const radio = child.locator(`[data-quote-funding-mode][value="${mode}"]`);
      await radio.evaluate(radio => {
        const pane = radio.closest('.program-quote-pane-body');
        pane.scrollTop += radio.getBoundingClientRect().top - pane.getBoundingClientRect().top - 100;
      });
      const before = await pane.evaluate(pane => pane.scrollTop);
      const point = await radio.boundingBox();
      await page.mouse.click(point.x + point.width / 2, point.y + point.height / 2);
      await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.quotes[0].fundingMode)).toBe(mode);
      await expect.poll(() => pane.evaluate(pane => pane.scrollTop)).toBeCloseTo(before, 0);
      await expect(radio).toBeFocused();
    }
    const scope = child.locator('[data-quote-scope]');
    await scope.fill('Scope notes remain here');
    await scope.dispatchEvent('change');
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.quotes[0].scopeNotes)).toBe('Scope notes remain here');
    await scope.evaluate(field => { field.focus({ preventScroll: true }); field.setSelectionRange(2, 8); field.closest('.program-quote-pane-body').scrollTop = 400; });
    await child.evaluate(async () => { await window.UOS.ProgramApp.updateWorkspace(ws => ws); });
    await expect(scope).toBeFocused();
    expect(await scope.evaluate(field => [field.selectionStart, field.selectionEnd])).toEqual([2, 8]);
    await expect.poll(() => pane.evaluate(pane => pane.scrollTop)).toBe(400);
    await child.evaluate(() => {
      const storage = window.UOS.ProgramStorage, save = storage.saveValidated;
      window.restoreQuoteSave = () => { storage.saveValidated = save; };
      storage.saveValidated = ws => new Promise(resolve => { window.resumeQuoteSave = resolve; }).then(() => save(ws));
      window.UOS.ProgramApp.updateWorkspace(ws => ws);
    });
    await child.waitForFunction(() => typeof window.resumeQuoteSave === 'function');
    await pane.evaluate(pane => { pane.scrollTop = 450; });
    await scope.evaluate(field => { field.focus({ preventScroll: true }); field.setSelectionRange(3, 9); });
    await child.evaluate(() => { window.resumeQuoteSave(); window.restoreQuoteSave(); });
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);
    await expect(scope).toBeFocused();
    await expect.poll(() => pane.evaluate(pane => pane.scrollTop)).toBe(450);
    expect(await scope.evaluate(field => [field.selectionStart, field.selectionEnd])).toEqual([3, 9]);
    await child.evaluate(() => {
      const storage = window.UOS.ProgramStorage, save = storage.saveValidated;
      window.restoreQuoteSave = () => { storage.saveValidated = save; };
      storage.saveValidated = ws => new Promise(resolve => { window.resumeQuoteSave = resolve; }).then(() => save(ws));
      window.resumeQuoteSave = null;
      window.UOS.ProgramApp.updateWorkspace(ws => ws);
    });
    await child.waitForFunction(() => typeof window.resumeQuoteSave === 'function');
    await child.evaluate(() => {
      const dialog = document.createElement('dialog'); dialog.id = 'quote-position-dialog'; dialog.innerHTML = '<input id="quote-dialog-focus" aria-label="Dialog focus">'; document.body.append(dialog); dialog.showModal();
      window.resumeQuoteSave(); window.restoreQuoteSave();
    });
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);
    await expect(child.locator('#quote-dialog-focus')).toBeFocused();
    await child.evaluate(() => { document.querySelector('#quote-position-dialog').close(); document.querySelector('#quote-position-dialog').remove(); });
  });
}
