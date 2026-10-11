const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.use({ viewport: { width: 1440, height: 900 }, screenshot: 'off', trace: 'off', video: 'off' });

async function settle(frame) {
  await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: hidden Calculator defers rows and active updates preserve unrelated sections`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const frame = page.frames().find(candidate => candidate !== page.mainFrame());
    await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
    const ids = await frame.evaluate(async owner => {
      sessionStorage.setItem('uos.program.statusOperator', 'Render scope test operator');
      const recordId = `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-RENDER-SCOPE`;
      let projectId;
      await UOS.ProgramApp.updateWorkspace(workspace => {
        workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id: recordId, owner, title: 'Render scope test', status: 'received', dateReceived: '2026-10-01' });
        const promoted = UOS.ProgramModel.promoteRegisterRecord(workspace, recordId);
        projectId = promoted.project.id;
        let next = UOS.ProgramCosting.upsertRateItem(UOS.ProgramStatus.migrate(promoted.workspace), { id: 'RATE-RENDER-SCOPE', description: 'Render scope labour', kind: 'Labour', category: 'Labour', unit: 'hour', unitRate: 10, quantityMode: 'direct', schedulerEnabled: true });
        next = UOS.ProgramCosting.createWork(next, projectId, 'RATE-RENDER-SCOPE', { quantity: 1 }, { operationId: 'render-scope' });
        next.workspace.selectedProjectId = projectId;
        next.workspace.selectedEntityId = recordId;
        next.workspace.costing = { selectedProjectId: projectId, section: 'Labour', mode: owner === 'NSA' ? 'applications' : 'events' };
        return next;
      });
      await UOS.ProgramApp.navigate('costing');
      const line = UOS.ProgramApp.workspace().entities.costingLines.find(item => item.projectId === projectId);
      return { recordId, projectId, lineId: line.id, jobId: line.jobId };
    }, owner);
    const quantity = frame.locator(`[data-costing-line-quantity="${ids.lineId}"]`);
    const calendar = frame.locator(`[data-costing-line-calendar="${ids.lineId}"]`);
    await expect(quantity).toHaveValue('1');
    await frame.evaluate(() => UOS.ProgramApp.navigate('register'));
    await settle(frame);
    await frame.evaluate(() => {
      const catalog = document.querySelector('[data-costing-catalog-body]');
      const calculator = document.querySelector('[data-costing-lines]');
      const probe = window.costingRenderProbe = { catalogRow: catalog.firstElementChild, quantity: calculator.querySelector('[data-costing-line-quantity]'), catalogChanges: 0, calculatorChanges: 0 };
      new MutationObserver(records => { probe.catalogChanges += records.length; }).observe(catalog, { childList: true, subtree: true });
      new MutationObserver(records => { probe.calculatorChanges += records.length; }).observe(calculator, { childList: true, subtree: true });
    });
    await frame.evaluate(async ({ owner, ids }) => {
      await UOS.ProgramApp.updateWorkspace(workspace => {
        workspace.entities[owner === 'NSA' ? 'applications' : 'events'].find(record => record.id === ids.recordId).title = 'Renamed in Register';
        workspace.entities.projects.find(project => project.id === ids.projectId).title = 'Latest Project title';
        return workspace;
      });
      await UOS.ProgramApp.navigateWithContext('planner', ids.recordId);
      await UOS.ProgramApp.updateWorkspace(workspace => {
        let next = UOS.ProgramCosting.updateLine(workspace, ids.lineId, { quantity: 3 });
        next = UOS.ProgramSchedulerModel.scheduleJob(next, ids.jobId, { startDate: '2027-05-03', endDate: '2027-05-03' });
        const rate = next.entities.rateItems.find(item => item.id === 'RATE-RENDER-SCOPE');
        return UOS.ProgramCosting.upsertRateItem(next, { ...rate, description: 'Updated hidden rate' });
      });
    }, { owner, ids });
    await settle(frame);
    expect(await frame.evaluate(() => ({ catalog: window.costingRenderProbe.catalogChanges, calculator: window.costingRenderProbe.calculatorChanges }))).toEqual({ catalog: 0, calculator: 0 });
    await expect(calendar).toHaveAttribute('data-costing-calendar-state', 'scheduled');
    expect(await frame.evaluate(() => window.costingRenderProbe.quantity.value)).toBe('1');
    await frame.evaluate(() => UOS.ProgramApp.navigate('costing'));
    await expect(quantity).toHaveValue('3');
    await expect(frame.locator('[data-rate-description="RATE-RENDER-SCOPE"]')).toHaveText('Updated hidden rate');
    await expect(calendar).toHaveAttribute('data-costing-calendar-state', 'scheduled');
    await expect(frame.locator('[data-costing-line-total="' + ids.lineId + '"]')).toHaveText('$30.00');

    await settle(frame);
    await frame.evaluate(() => {
      window.costingRenderProbe.catalogRow = document.querySelector('[data-costing-catalog-body]').firstElementChild;
      window.costingRenderProbe.catalogChanges = 0;
      window.costingRenderProbe.calculatorChanges = 0;
    });
    await frame.evaluate(({ owner, ids }) => UOS.ProgramApp.updateWorkspace(workspace => {
      workspace.entities[owner === 'NSA' ? 'applications' : 'events'].find(record => record.id === ids.recordId).title = 'Another Register rename';
      return workspace;
    }), { owner, ids });
    await settle(frame);
    expect(await frame.evaluate(() => ({ catalog: window.costingRenderProbe.catalogChanges, calculator: window.costingRenderProbe.calculatorChanges }))).toEqual({ catalog: 0, calculator: 0 });
    await quantity.fill('4');
    await quantity.press('Tab');
    await expect.poll(() => frame.evaluate(id => UOS.ProgramApp.workspace().entities.costingLines.find(line => line.id === id).quantity, ids.lineId)).toBe(4);
    await settle(frame);
    expect(await frame.evaluate(() => window.costingRenderProbe.catalogRow === document.querySelector('[data-costing-catalog-body]').firstElementChild)).toBe(true);
    expect(await frame.evaluate(() => window.costingRenderProbe.catalogChanges)).toBe(0);
    await expect(frame.locator('[data-costing-line-total="' + ids.lineId + '"]')).toHaveText('$40.00');
    await frame.evaluate(id => UOS.ProgramApp.updateWorkspace(workspace => UOS.ProgramSchedulerModel.scheduleJob(workspace, id, { startDate: '2027-05-04', endDate: '2027-05-04' })), ids.jobId);
    await settle(frame);
    await expect(calendar).toHaveAttribute('data-costing-calendar-state', 'scheduled');
    expect(await frame.evaluate(() => window.costingRenderProbe.catalogChanges)).toBe(0);
    await frame.evaluate(() => UOS.ProgramApp.updateWorkspace(workspace => {
      const rate = workspace.entities.rateItems.find(item => item.id === 'RATE-RENDER-SCOPE');
      return UOS.ProgramCosting.upsertRateItem(workspace, { ...rate, description: 'Updated active rate' });
    }));
    expect(await frame.evaluate(() => ({ destination: UOS.ProgramApp.workspace().workspace.destination, description: UOS.ProgramApp.workspace().entities.rateItems.find(item => item.id === 'RATE-RENDER-SCOPE').description }))).toEqual({ destination: 'costing', description: 'Updated active rate' });
    await expect(frame.locator('[data-rate-description="RATE-RENDER-SCOPE"]')).toHaveText('Updated active rate');
    expect(await frame.evaluate(() => window.costingRenderProbe.catalogRow === document.querySelector('[data-costing-catalog-body]').firstElementChild)).toBe(false);
  });
}
