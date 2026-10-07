const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.beforeEach(async ({ page }) => suppressBackupModalForFunctionalTest(page));

for (const owner of ['NSA', 'EVT']) for (const width of [1440, 390]) {
  test(`${owner} Cost Library first clicks stay stable while focused and scrolled at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    await child.evaluate(async owner => {
      await UOS.ProgramApp.updateWorkspace(workspace => {
        const record = { id: `${owner === 'NSA' ? 'NSA-APP' : 'EVT'}-FOCUS-STABLE`, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Focus stability project', status: 'received' };
        workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
        const promoted = UOS.ProgramModel.promoteRegisterRecord(workspace, record.id);
        workspace = promoted.workspace;
        workspace.workspace.selectedEntityId = record.id;
        workspace.workspace.selectedProjectId = promoted.project.id;
        for (let index = 0; index < 3; index++) workspace.entities.rateItems.push({
          id: `RATE-FOCUS-${index}`, owner: '', type: 'rateItem', kind: 'Labour', kindSource: 'user',
          description: `Focus stable ${['Zulu', 'Alpha', 'Beta'][index]}`, category: 'Focus stable category',
          unit: 'hour', unitRate: 15 + index, active: true, quantityKind: 'hours', schedulerEnabled: false
        });
        return workspace;
      });
      window.focusPointerEvents = [];
      for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, event => {
        const button = event.target.closest?.('[data-costing-add-rate], [data-costing-edit-rate], [data-costing-delete-rate]');
        window.focusPointerEvents.push({ type, action: button?.getAttribute('data-costing-add-rate') ? 'add' : button?.getAttribute('data-costing-edit-rate') ? 'edit' : button?.getAttribute('data-costing-delete-rate') ? 'delete' : null });
      }, true);
    }, owner);
    await child.locator('[data-program-destination="costing"]').click();
    await child.locator('[data-costing-section="Labour"]').click();
    await child.locator('[data-costing-tools-toggle]').click();
    await child.locator('[data-costing-search]').fill('Focus stable');
    await child.locator('[data-costing-category]').selectOption('Focus stable category');
    await child.locator('[data-rate-sort="description"]').click();
    await expect(child.locator('[data-rate-item-row]')).toHaveCount(3);

    const overflow = async () => child.locator('.program-cost-table-wrap').evaluate(wrap => {
      wrap.style.maxWidth = '520px';
      wrap.style.width = 'min(520px, 100%)';
      wrap.style.overflowX = 'auto';
      wrap.querySelector('table').style.minWidth = '980px';
      wrap.scrollLeft = Math.min(160, wrap.scrollWidth - wrap.clientWidth);
      return wrap.scrollWidth > wrap.clientWidth;
    });
    const geometry = button => button.evaluate(element => {
      const rect = element.getBoundingClientRect(), cell = element.closest('td'), wrap = element.closest('.program-cost-table-wrap');
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scrollLeft: wrap.scrollLeft, position: getComputedStyle(cell).position, zIndex: getComputedStyle(cell).zIndex };
    });
    const stable = (before, after) => {
      for (const key of ['x', 'y', 'width', 'height', 'scrollLeft']) expect(Math.abs(after[key] - before[key]), key).toBeLessThan(1);
      expect(after.position).toBe('sticky');
      expect(Number(after.zIndex)).toBeGreaterThanOrEqual(2);
    };
    const pointerClick = async (button, action) => {
      await button.scrollIntoViewIfNeeded();
      await button.click({ trial: true });
      await child.evaluate(() => { document.activeElement?.blur(); window.focusPointerEvents = []; });
      expect(await button.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest('button') === element;
      }), 'the pointer target is visible and unobscured').toBe(true);
      const before = await geometry(button), box = await button.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await child.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      stable(before, await geometry(button));
      await page.mouse.up();
      const events = await child.evaluate(() => window.focusPointerEvents.filter(event => ['pointerdown', 'pointerup', 'click'].includes(event.type)));
      expect(events.map(event => event.type)).toEqual(['pointerdown', 'pointerup', 'click']);
      expect(events.map(event => event.action)).toEqual([action, action, action]);
    };

    for (const theme of ['light', 'dark']) {
      await child.evaluate(theme => { document.documentElement.dataset.suiteTheme = theme; }, theme);
      expect(await overflow()).toBe(true);
      const row = child.locator('[data-rate-item-row="RATE-FOCUS-1"]');
      for (const attribute of ['add', 'edit', 'delete']) {
        const button = row.locator(`[data-costing-${attribute}-rate]`);
        await button.scrollIntoViewIfNeeded();
        const previous = button.locator('xpath=preceding-sibling::*[1]');
        if (attribute === 'add') await row.locator('[data-rate-description]').focus();
        else await previous.focus();
        const before = await geometry(button);
        await page.keyboard.press('Tab');
        await expect(button).toBeFocused();
        expect(await button.evaluate(element => element.matches(':focus-visible'))).toBe(true);
        expect(await button.evaluate(element => parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThan(0);
        stable(before, await geometry(button));
      }
      const beforeCount = await child.evaluate(() => UOS.ProgramApp.workspace().entities.costingLines.filter(line => line.rateItemId === 'RATE-FOCUS-1').length);
      await pointerClick(row.locator('[data-costing-add-rate]'), 'add');
      await expect.poll(() => child.evaluate(() => UOS.ProgramApp.workspace().entities.costingLines.filter(line => line.rateItemId === 'RATE-FOCUS-1').length)).toBe(beforeCount + 1);
      expect(await overflow()).toBe(true);
      await pointerClick(row.locator('[data-costing-edit-rate]'), 'edit');
      await expect(child.locator('[data-costing-rate-dialog]')).toBeVisible();
      await expect(child.locator('[data-costing-rate-form] [name="description"]')).toHaveValue('Focus stable Alpha');
      await child.locator('[data-costing-rate-cancel]').first().click();
      await expect(child.locator('[data-costing-rate-dialog]')).toBeHidden();
      expect(await overflow()).toBe(true);
      const deleteRow = child.locator('[data-rate-item-row="RATE-FOCUS-2"]');
      await pointerClick(deleteRow.locator('[data-costing-delete-rate]'), 'delete');
      const confirm = child.getByRole('dialog').filter({ hasText: 'Delete rate item?' });
      await expect(confirm).toBeVisible();
      await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(confirm).toBeHidden();
      expect(await child.evaluate(() => UOS.ProgramApp.workspace().entities.rateItems.some(rate => rate.id === 'RATE-FOCUS-2'))).toBe(true);
    }
  });
}
