const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');
test.beforeEach(async ({ page }) => { await suppressBackupModalForFunctionalTest(page); });

for (const owner of ['NSA', 'EVT']) for (const width of [1440, 390]) {
  test(`${owner} Rate editor matches Planner controls and documents Calculator icons at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const taskId = await child.evaluate(async owner => {
      let taskId;
      await window.UOS.ProgramApp.updateWorkspace(workspace => {
        const record = { id: `${owner === 'NSA' ? 'NSA-APP' : 'EVT'}-RATE-EDITOR`, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Rate editor layout', status: 'received' };
        workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
        const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id);
        const canonical = window.UOS.ProgramStatus.migrate(promoted.workspace);
        taskId = canonical.entities.tasks.find(task => task.projectId === promoted.project.id).id;
        for (const kind of ['Labour', 'Equipment', 'Material', 'Contractors', 'Sundry']) canonical.entities.rateItems.push({ id: `RATE-EDITOR-${kind.toUpperCase()}`, owner: '', type: 'rateItem', kind, category: 'Custom category', description: `Editor ${kind}`, unit: 'each', unitRate: 25, active: true, quantityMode: 'direct', schedulerEnabled: false });
        canonical.workspace.selectedEntityId = record.id;
        canonical.workspace.selectedProjectId = promoted.project.id;
        return canonical;
      });
      await window.UOS.ProgramApp.navigate('planner');
      return taskId;
    }, owner);
    await child.locator(`[data-planner-edit-task="${taskId}"]`).evaluate(button => button.click());
    const signature = element => {
      const css = getComputedStyle(element);
      return Object.fromEntries(['fontSize', 'lineHeight', 'padding', 'minHeight', 'borderWidth', 'borderRadius', 'backgroundColor', 'color'].map(key => [key, css[key]]));
    };
    const planner = child.locator('[data-planner-task-dialog]');
    const baseline = {
      width: await planner.evaluate(element => element.getBoundingClientRect().width),
      select: await planner.locator('[name="classification"]').evaluate(signature),
      input: await planner.locator('[name="title"]').evaluate(signature),
      textarea: await planner.locator('[name="description"]').evaluate(signature),
      header: await planner.locator('header').evaluate(element => getComputedStyle(element).padding),
      footer: await planner.locator('footer').evaluate(element => getComputedStyle(element).padding)
    };
    await planner.locator('[data-planner-task-cancel]').first().click();
    await child.evaluate(async () => { await window.UOS.ProgramApp.navigate('costing'); });
    const dialog = child.locator('[data-costing-rate-dialog]');
    const guide = dialog.locator('[data-rate-editor-guide]');
    async function verifyGuide() {
      expect(await guide.locator('.planner-calendar-guide__row>span:last-child').allTextContents()).toEqual([
        'Click to add this to the Resource Calculator',
        'Click this to add this to the Resource Calculator with estimated measurements OR Add to Resource Calculator Via Space Map to confirm measurements.',
        'Click this icon in Resource Calculator to Schedule a Job',
        'This symbol indicates a successfully scheduled job.'
      ]);
      expect(await guide.locator('h3').allTextContents()).toEqual(['Cost Library', 'Resource Calculator']);
      expect(await guide.locator('button,a,input,[tabindex]').count()).toBe(0);
      expect(await guide.locator('svg[aria-hidden="true"]').count()).toBe(4);
      expect(await guide.locator('[data-rate-guide-icon="calendar"] svg').innerHTML()).not.toContain('M8 16l');
      expect(await guide.locator('[data-rate-guide-icon="calendar-tick"] svg').innerHTML()).toContain('M8 16l');
      expect(await guide.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)');
      await dialog.locator('.planner-task-editor__body').evaluate(body => { body.scrollTop = body.scrollHeight; });
      await expect(guide).toBeVisible();
      await expect(dialog.locator('[data-costing-rate-submit]')).toBeVisible();
      const geometry = await guide.evaluate(element => {
        const [first, second] = [...element.children].map(column => column.getBoundingClientRect());
        const css = getComputedStyle(element);
        const body = element.closest('.planner-task-editor__body');
        const probe = document.createElement('span');
        element.appendChild(probe);
        probe.style.color = 'var(--program-owner-strong)';
        const owner = getComputedStyle(probe).color;
        probe.remove();
        const mapText = element.querySelector('[data-rate-guide-icon="map"]').nextElementSibling;
        return { sameTop: Math.abs(first.top - second.top) < 1, secondBelow: second.top >= first.bottom,
          leftAccent: css.borderLeftWidth, accentColour: css.borderLeftColor, owner,
          overflow: body.scrollWidth > body.clientWidth,
          mapWraps: mapText.getBoundingClientRect().height > parseFloat(getComputedStyle(mapText).lineHeight) * 1.5 };
      });
      expect(geometry.leftAccent).toBe('4px');
      expect(geometry.accentColour).toBe(geometry.owner);
      expect(geometry.overflow).toBe(false);
      expect(geometry.mapWraps).toBe(true);
      expect(width > 640 ? geometry.sameTop : geometry.secondBelow).toBe(true);
    }
    for (const kind of ['Labour', 'Equipment', 'Material', 'Contractors', 'Sundry']) {
      await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);
      await child.locator(`[data-costing-section="${kind}"]`).click();
      await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.costing.section)).toBe(kind);
      await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);
      const edit = child.locator(`[data-costing-edit-rate="RATE-EDITOR-${kind.toUpperCase()}"]`);
      // Keyboard activation avoids the wide background table's sticky columns on phones.
      await edit.press('Enter');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[name="category"]')).toHaveValue('Custom category');
      expect(await dialog.evaluate(element => element.getBoundingClientRect().width)).toBe(baseline.width);
      expect(await dialog.locator('[name="kind"]').evaluate(signature)).toEqual(baseline.select);
      expect(await dialog.locator('[name="unitRate"]').evaluate(signature)).toEqual(baseline.input);
      expect(await dialog.locator('[name="description"]').evaluate(signature)).toEqual(baseline.textarea);
      await expect(dialog.locator('[name="description"]')).toHaveAttribute('rows', '1');
      expect(await dialog.locator('[name="description"]').evaluate(element => getComputedStyle(element).resize)).toBe('vertical');
      expect(await dialog.locator('header').evaluate(element => getComputedStyle(element).padding)).toBe(baseline.header);
      expect(await dialog.locator('footer').evaluate(element => getComputedStyle(element).padding)).toBe(baseline.footer);
      await verifyGuide();
      if (kind === 'Labour') await guide.screenshot({ path: testInfo.outputPath(`${owner}-${width}-rate-guide.png`) });
      await dialog.locator('[data-costing-rate-cancel]').first().click();
    }
    // Creation uses this same editor, whereas the table's + / Map actions do not.
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.snapshot().busy)).toBe(false);
    await child.locator('[data-costing-tools-toggle]').click();
    await child.locator('[data-costing-add-item]').click();
    await expect(dialog.locator('[data-costing-rate-dialog-title]')).toHaveText('Add rate');
    await verifyGuide();
    await dialog.locator('[name="description"]').fill('New editor rate');
    await dialog.locator('[name="category"]').selectOption('Administration');
    await dialog.locator('[name="unitRate"]').fill('-1');
    expect(await dialog.locator('[name="unitRate"]').evaluate(input => input.validity.valid)).toBe(false);
    await dialog.locator('[name="unitRate"]').fill('12.50');
    await dialog.locator('[data-costing-rate-submit]').click();
    await expect(dialog).not.toBeVisible();
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.rateItems.some(rate => rate.description === 'New editor rate' && rate.unitRate === 12.5))).toBe(true);
    await child.locator('[data-costing-edit-rate="RATE-EDITOR-SUNDRY"]').press('Enter');
    await dialog.locator('[name="description"]').fill('Updated editor rate');
    await dialog.locator('[data-costing-rate-submit]').click();
    await expect(dialog).not.toBeVisible();
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.rateItems.find(rate => rate.id === 'RATE-EDITOR-SUNDRY')?.description)).toBe('Updated editor rate');
    expect(pageErrors).toEqual([]);
  });
}
