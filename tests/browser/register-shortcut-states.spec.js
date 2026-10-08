const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.beforeEach(async ({ page }) => { await suppressBackupModalForFunctionalTest(page); });

for (const owner of ['NSA', 'EVT']) {
  test(`${owner} shortcuts distinguish prerequisites and saved work while retaining drawer context`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const id = `${owner === 'NSA' ? 'NSA-APP' : 'EVT'}-SHORTCUT-STATES`;
    await child.evaluate(async ({ id, owner }) => {
      await window.UOS.ProgramApp.updateWorkspace(workspace => {
        const records = owner === 'NSA' ? workspace.entities.applications : workspace.entities.events;
        records.push({ id, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Shortcut states', status: 'received', dateReceived: '2026-09-30' });
        workspace.workspace.selectedEntityId = id;
        workspace.workspace.destination = 'register';
        return workspace;
      });
    }, { id, owner });
    const row = child.locator(`tr[data-register-record="${id}"]`);
    const button = name => row.locator(`[data-register-action="${name}"]`);
    expect(await child.locator('[data-program-destination="planner"] svg').evaluate(element => element.innerHTML)).toBe('<circle cx="6" cy="7" r="1"></circle><circle cx="6" cy="12" r="1"></circle><circle cx="6" cy="17" r="1"></circle><path d="M10 7h8M10 12h8M10 17h8"></path>');
    expect(await child.locator('[data-program-destination="map"] svg').evaluate(element => element.innerHTML)).toBe('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line>');
    expect(await button('planner').locator('svg').evaluate(element => element.innerHTML)).toBe('<circle cx="6" cy="7" r="1"></circle><circle cx="6" cy="12" r="1"></circle><circle cx="6" cy="17" r="1"></circle><path d="M10 7h8M10 12h8M10 17h8"></path>');
    expect(await row.locator('[data-register-delete-id] svg').evaluate(element => element.innerHTML)).toBe('<path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14"></path>');
    await expect(button('register')).toBeEnabled();
    await expect(button('register')).toHaveAttribute('data-shortcut-state', 'in-use');
    await expect(button('map')).toHaveAttribute('data-shortcut-state', 'unused');
    await expect(button('map')).toBeEnabled();
    for (const name of ['planner', 'costing', 'scheduler', 'quotes']) {
      await expect(button(name)).toBeDisabled();
      await expect(button(name)).toHaveAttribute('data-shortcut-state', 'inactive');
      await expect(button(name)).toHaveAttribute('data-uos-tooltip', /linked delivery project/);
      await button(name).evaluate(element => element.click());
      await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.destination)).toBe('register');
    }
    expect(await button('planner').evaluate(element => Number(getComputedStyle(element).opacity))).toBeLessThan(1);
    await button('map').click();
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.destination)).toBe('map');
    expect(await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.projects.length)).toBe(0);
    await button('register').click();
    await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.destination)).toBe('register');
    await button('register').click();
    await button('register').click();
    expect(await child.locator(`[data-register-drawer-record="${id}"] [data-register-unlock-edit] svg`).evaluate(element => element.innerHTML)).toBe('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"></path><path d="m13.5 6.5 4 4"></path>');
    await expect(child.locator(`[data-disclosure-key="register:${id}"][data-disclosure-toggle]`)).toHaveAttribute('aria-expanded', 'true');

    const receiptEdit = child.locator(`[data-register-drawer-record="${id}"] [data-register-unlock-edit]`).first();
    const receiptLayout = await receiptEdit.evaluate(button => {
      const rect = button.getBoundingClientRect();
      const icon = button.querySelector('svg').getBoundingClientRect();
      const input = button.parentElement.querySelector('input').getBoundingClientRect();
      return { width: rect.width, height: rect.height, iconWidth: icon.width, iconHeight: icon.height,
        offsetX: Math.abs((icon.left + icon.width / 2) - (rect.left + rect.width / 2)),
        offsetY: Math.abs((icon.top + icon.height / 2) - (rect.top + rect.height / 2)),
        inputOffsetY: Math.abs((input.top + input.height / 2) - (rect.top + rect.height / 2)) };
    });
    expect(receiptLayout.width).toBe(28);
    expect(receiptLayout.height).toBe(28);
    expect(receiptLayout.iconWidth).toBe(16);
    expect(receiptLayout.iconHeight).toBe(16);
    expect(receiptLayout.offsetX).toBeLessThanOrEqual(1);
    expect(receiptLayout.offsetY).toBeLessThanOrEqual(1);
    expect(receiptLayout.inputOffsetY).toBeLessThanOrEqual(1);
    const projectId = await child.evaluate(async id => {
      let projectId;
      await window.UOS.ProgramApp.updateWorkspace(workspace => {
        const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, id);
        projectId = promoted.project.id;
        return promoted.workspace;
      });
      return projectId;
    }, id);
    for (const name of ['planner', 'costing', 'scheduler', 'quotes']) {
      await expect(button(name)).toBeEnabled();
      await expect(button(name)).toHaveAttribute('data-shortcut-state', 'unused');
    }
    const unusedStyle = await button('costing').evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      border: getComputedStyle(element).borderTopWidth,
      borderColor: getComputedStyle(element).borderTopColor,
      iconColor: getComputedStyle(element).color
    }));
    expect(unusedStyle).toEqual({
      background: 'rgb(255, 255, 255)', border: '1px',
      borderColor: owner === 'NSA' ? 'rgb(21, 128, 61)' : 'rgb(29, 78, 216)',
      iconColor: owner === 'NSA' ? 'rgb(21, 128, 61)' : 'rgb(29, 78, 216)'
    });
    const ownerHover = owner === 'NSA' ? 'rgb(220, 252, 231)' : 'rgb(219, 234, 254)';
    expect(await button('register').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(ownerHover);
    await button('costing').hover();
    await expect.poll(() => button('costing').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(ownerHover);
    await page.mouse.move(0, 0);
    const before = await child.evaluate(() => Object.fromEntries(Object.entries(window.UOS.ProgramApp.workspace().entities).map(([key, records]) => [key, records.length])));
    for (const name of ['planner', 'costing', 'scheduler', 'quotes', 'map', 'register']) {
      await button(name).click();
      await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.destination)).toBe(name);
    const surface = name === 'register' ? '[data-register-detail-content]' : `[data-program-view="${name}"]`;
    await expect(child.locator(`[data-register-drawer-record="${id}"] ${surface}`)).toBeVisible();
    if (name !== 'register') {
      await expect(button(name)).toHaveAttribute('aria-current', 'page');
      await expect(button(name)).toHaveAttribute('data-shortcut-state', 'unused');
      await page.mouse.move(0, 0);
      await expect.poll(() => button(name).evaluate(element => ({
        border: getComputedStyle(element).borderTopWidth,
        background: getComputedStyle(element).backgroundColor
      }))).toEqual({ border: '1px', background: 'rgb(255, 255, 255)' });
    }
      await button(name).click();
      await expect(child.locator(`[data-disclosure-key="register:${id}"][data-disclosure-toggle]`)).toHaveAttribute('aria-expanded', 'true');
      await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.selectedEntityId)).toBe(id);
    }
    expect(await child.evaluate(() => Object.fromEntries(Object.entries(window.UOS.ProgramApp.workspace().entities).map(([key, records]) => [key, records.length])))).toEqual(before);

    // Verify actual row geometry, including the compact panel's two padding edges.
    const alignment = await child.evaluate(id => {
      const row = document.querySelector(`tr[data-register-record="${id}"]`);
      const table = document.querySelector('.program-register-table');
      const panel = row.querySelector('.program-register-mini-toolbar');
      const buttons = [...panel.querySelectorAll('button')];
      const budget = row.querySelector('.program-register-table__budget-cell');
      const budgetHeader = table.querySelector('.program-register-table__budget-col');
      const actionLabel = table.querySelector('.program-register-actions-label');
      const panelBounds = panel.getBoundingClientRect();
      return {
        budgetAlignment: getComputedStyle(budget.querySelector('.commercial-value-frame')).justifyContent,
        budgetEdge: Math.abs(budget.getBoundingClientRect().left - budgetHeader.getBoundingClientRect().left),
        actionEdge: Math.abs(actionLabel.getBoundingClientRect().left - buttons[0].getBoundingClientRect().left),
        width: panelBounds.width,
        expectedWidth: buttons.reduce((sum, button) => sum + button.getBoundingClientRect().width, 0) + (buttons.length - 1) * 8 + 16,
        rightGap: row.querySelector('.program-register-table__actions-cell').getBoundingClientRect().right - panelBounds.right,
        firstInset: buttons[0].getBoundingClientRect().left - panelBounds.left,
        lastInset: panelBounds.right - buttons.at(-1).getBoundingClientRect().right,
        borders: Object.fromEntries(buttons.filter(button => button.dataset.registerAction).map(button => [button.dataset.registerAction, getComputedStyle(button).borderTopWidth]))
      };
    }, id);
    expect(alignment.budgetAlignment).toBe('flex-end');
    expect(alignment.budgetEdge).toBeLessThanOrEqual(1);
    expect(alignment.actionEdge).toBeLessThanOrEqual(1);
    expect(alignment.width).toBeCloseTo(alignment.expectedWidth, 0);
    expect(alignment.rightGap).toBeLessThanOrEqual(10);
    expect(alignment.firstInset).toBeGreaterThanOrEqual(8);
    expect(alignment.lastInset).toBeGreaterThanOrEqual(8);
    expect(alignment.borders.register).toBe('2px');
    expect(alignment.borders.planner).toBe('1px');

    const duplicateId = await child.evaluate(async projectId => {
      let duplicateId;
      await window.UOS.ProgramApp.updateWorkspace(workspace => {
        const template = workspace.entities.tasks.find(task => task.projectId === projectId);
        const duplicated = window.UOS.ProgramPlannerModel.duplicateTasks(workspace, projectId, [template.id]);
        duplicateId = duplicated.tasks[0].id;
        return duplicated.workspace;
      });
      return duplicateId;
    }, projectId);
    await expect(button('planner')).toHaveAttribute('data-shortcut-state', 'in-use');
    await expect.poll(() => button('planner').evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('2px');
    await child.evaluate(async duplicateId => {
      await window.UOS.ProgramApp.updateWorkspace(workspace => {
        workspace.entities.tasks = workspace.entities.tasks.filter(task => task.id !== duplicateId);
        for (const collection of ['statusEvents', 'statusRecommendations']) workspace.entities[collection] = workspace.entities[collection].filter(item => item.entityId !== duplicateId);
        return workspace;
      });
    }, duplicateId);
    await expect(button('planner')).toHaveAttribute('data-shortcut-state', 'unused');
    await expect.poll(() => button('planner').evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('1px');

    const taskId = await child.evaluate(async projectId => {
      let taskId;
      await window.UOS.ProgramApp.updateWorkspace(workspace => {
        const added = window.UOS.ProgramPlannerModel.createTask(workspace, projectId, { title: 'Saved reminder' });
        taskId = added.task.id;
        return added.workspace;
      });
      return taskId;
    }, projectId);
    await expect(button('planner')).toHaveAttribute('data-shortcut-state', 'in-use');
    await child.evaluate(async taskId => {
      await window.UOS.ProgramApp.updateWorkspace(workspace => {
        workspace.entities.tasks = workspace.entities.tasks.filter(task => task.id !== taskId);
        for (const collection of ['statusEvents', 'statusRecommendations']) workspace.entities[collection] = workspace.entities[collection].filter(item => item.entityId !== taskId);
        return workspace;
      });
    }, taskId);
    await expect(button('planner')).toHaveAttribute('data-shortcut-state', 'unused');
    await child.evaluate(async projectId => {
      await window.UOS.ProgramApp.updateWorkspace(workspace => {
        const template = workspace.entities.tasks.find(task => task.projectId === projectId);
        return window.UOS.ProgramPlannerModel.updateTask(workspace, projectId, template.id, { notes: 'Saved edit' }).workspace;
      });
    }, projectId);
    await expect(button('planner')).toHaveAttribute('data-shortcut-state', 'in-use');
    const costingOnlyUsage = await child.evaluate(({ owner, projectId, id }) => {
      const app = window.UOS.ProgramApp;
      const workspace = app.workspace();
      workspace.entities.costingLines.push({ id: 'COSTING-ONLY-QUOTE', owner, projectId, jobId: null, kind: 'Labour' });
      const usage = app.evaluateShortcutRule('quotes', app.shortcutContextForWorkspace('register', workspace, id)).usage;
      workspace.entities.costingLines = workspace.entities.costingLines.filter(line => line.id !== 'COSTING-ONLY-QUOTE');
      const removedUsage = app.evaluateShortcutRule('quotes', app.shortcutContextForWorkspace('register', workspace, id)).usage;
      return { usage, removedUsage };
    }, { owner, projectId, id });
    expect(costingOnlyUsage).toEqual({ usage: 'in-use', removedUsage: 'unused' });
    await page.reload();
    const refreshed = page.frames().find(frame => frame !== page.mainFrame());
    await refreshed.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    await expect(refreshed.locator(`tr[data-register-record="${id}"] [data-register-action="planner"]`)).toHaveAttribute('data-shortcut-state', 'in-use');

    // Derivation uses canonical records, not module visits or Project presence alone.
    const derived = await refreshed.evaluate(({ id, projectId, owner }) => {
      const app = window.UOS.ProgramApp;
      const workspace = app.workspace();
      workspace.entities.jobs.push({ id: 'SHORTCUT-JOB', owner, projectId });
      workspace.entities.quotes.push({ id: 'SHORTCUT-QUOTE', owner, projectId, status: 'Draft' });
      const emptyQuote = app.evaluateShortcutRule('quotes', app.shortcutContextForWorkspace('register', workspace, id)).usage;
      workspace.entities.costingLines.push({ id: 'SHORTCUT-COST', owner, projectId, jobId: 'SHORTCUT-JOB', quantity: 1, unitRate: 1 });
      const record = (owner === 'NSA' ? workspace.entities.applications : workspace.entities.events).find(record => record.id === id);
      record.locations = [{ coordinate: [138.6, -34.9] }];
      const context = app.shortcutContextForWorkspace('register', workspace, id);
      const states = Object.fromEntries(['map', 'costing', 'scheduler', 'quotes'].map(name => [name, app.evaluateShortcutRule(name, context).usage]));
      workspace.entities.costingLines = [];
      workspace.entities.quoteLines.push({ id: 'SHORTCUT-ADJUSTMENT', owner, projectId, quoteId: 'SHORTCUT-QUOTE', sourceKind: 'custom' });
      const adjustmentOnly = app.shortcutContextForWorkspace('register', workspace, id);
      return { emptyQuote, states, adjustmentOnly: {
        costing: app.evaluateShortcutRule('costing', adjustmentOnly).usage,
        quotes: app.evaluateShortcutRule('quotes', adjustmentOnly).usage
      } };
    }, { id, projectId, owner });
    expect(derived).toEqual({ emptyQuote: 'unused', states: { map: 'in-use', costing: 'in-use', scheduler: 'in-use', quotes: 'in-use' }, adjustmentOnly: { costing: 'unused', quotes: 'in-use' } });
  });
}
