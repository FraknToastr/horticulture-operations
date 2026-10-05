const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function setup(page) {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/src/program-planner/nsa.html');
  const child = page.frames().find(f => f !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const projectId = await child.evaluate(async () => {
    let id;
    await UOS.ProgramApp.updateWorkspace(ws => {
      ws.entities.applications.push({ id: 'NSA-APP-COMMAND-BROWSER', owner: 'NSA', title: 'Canonical browser', status: 'received', dateReceived: '2026-10-01' });
      const promoted = UOS.ProgramModel.promoteRegisterRecord(ws, 'NSA-APP-COMMAND-BROWSER');
      id = promoted.project.id;
      let next = UOS.ProgramStatus.migrate(promoted.workspace);
      for (const [rateId, kind, enabled] of [['RATE-BROWSER-LABOUR', 'Labour', true], ['RATE-BROWSER-MATERIAL', 'Material', false]]) {
        next = UOS.ProgramCosting.upsertRateItem(next, { id: rateId, description: rateId, kind, category: kind, unit: 'each', unitRate: 10, quantityMode: 'direct', schedulerEnabled: enabled });
      }
      next.workspace.selectedProjectId = id;
      next.workspace.selectedEntityId = 'NSA-APP-COMMAND-BROWSER';
      next.workspace.costing = { selectedProjectId: id, section: 'Labour', mode: 'applications' };
      return next;
    });
    await UOS.ProgramApp.navigate('costing');
    return id;
  });
  return { child, frame: page.frameLocator('iframe'), projectId };
}

test('individual additions, flag settings, exact Scheduler navigation and calendar states', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.stack));
  const { child, frame, projectId } = await setup(page);
  const add = frame.locator('[data-costing-add-rate="RATE-BROWSER-LABOUR"]');
  await add.click(); await add.click();
  await expect.poll(() => child.evaluate(id => UOS.ProgramApp.workspace().entities.costingLines.filter(l => l.projectId === id).length, projectId)).toBe(2);
  const lines = await child.evaluate(id => UOS.ProgramApp.workspace().entities.costingLines.filter(l => l.projectId === id), projectId);
  expect(errors).toEqual([]);
  expect(lines[0].jobId).not.toBe(lines[1].jobId);
  await expect(frame.locator(`[data-costing-line-calendar="${lines[0].id}"]`)).toHaveAttribute('data-costing-calendar-state', 'draft');
  await expect(frame.locator(`[data-costing-line-calendar="${lines[0].id}"] path`)).not.toHaveAttribute('d', /M8 16/);
  await frame.locator(`[data-costing-line-calendar="${lines[0].id}"]`).click();
  await expect.poll(() => child.evaluate(() => UOS.ProgramSchedulerUI.snapshot().selectedId)).toBe(lines[0].jobId);
  await expect.poll(() => child.evaluate(() => UOS.ProgramSchedulerUI.snapshot().detail)).toBe(true);
  await child.evaluate(async jobId => {
    await UOS.ProgramApp.updateWorkspace(ws => UOS.ProgramSchedulerModel.scheduleJob(ws, jobId, { startDate: '2027-05-03', endDate: '2027-05-03' }), { source: 'automatic', command: 'Work Job scheduled' });
  }, lines[0].jobId);
  await expect(frame.locator(`[data-costing-line-calendar="${lines[0].id}"]`)).toHaveAttribute('data-costing-calendar-state', 'scheduled');
  await child.evaluate(() => UOS.ProgramApp.navigate('costing'));
  await expect(frame.locator(`[data-costing-line-calendar="${lines[0].id}"]`)).toHaveAttribute('data-costing-calendar-state', 'scheduled');
  await expect(frame.locator(`[data-costing-line-calendar="${lines[0].id}"] path`)).toHaveAttribute('d', /M8 16/);
  await frame.locator(`[data-costing-line-calendar="${lines[0].id}"]`).click();
  await expect.poll(() => child.evaluate(() => UOS.ProgramSchedulerUI.snapshot().cursor)).toBe('2027-05-03');
  await child.evaluate(() => UOS.ProgramApp.navigate('costing'));
  const info = frame.locator('[data-costing-scheduler-info="RATE-BROWSER-LABOUR"]');
  await expect(info).toHaveAttribute('role', 'img');
  await expect(info).toHaveAttribute('tabindex', '0');
  await expect(info).toHaveAttribute('data-uos-tooltip', /Future additions.*create draft Scheduler jobs/);
  const beforeInfo = await child.evaluate(() => JSON.stringify(UOS.ProgramApp.workspace()));
  await info.hover();
  await expect(frame.locator('#uos-shared-tooltip')).toBeVisible();
  await expect(frame.locator('#uos-shared-tooltip')).toHaveText(/Future additions.*create draft Scheduler jobs/);
  await page.mouse.move(0, 0);
  await page.keyboard.press('Tab');
  await info.focus();
  await expect(frame.locator('#uos-shared-tooltip')).toBeVisible();
  await expect(frame.locator('#uos-shared-tooltip')).toHaveText(/Future additions.*create draft Scheduler jobs/);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await info.click();
  expect(await child.evaluate(() => JSON.stringify(UOS.ProgramApp.workspace()))).toBe(beforeInfo);
  const dimensions = await info.evaluate(el => { const box = el.getBoundingClientRect(); return [box.width, box.height]; });
  const frameHeight = await info.evaluate(el => parseFloat(getComputedStyle(el.closest('table')).getPropertyValue('--commercial-frame-height')));
  expect(dimensions).toEqual([frameHeight, frameHeight]);
  await frame.locator('[data-costing-edit-rate="RATE-BROWSER-LABOUR"]').click();
  const flag = frame.locator('[data-costing-rate-form] [name="schedulerEnabled"]');
  await expect(flag).toBeChecked();
  await flag.uncheck();
  await frame.locator('[data-costing-rate-submit]').click();
  await expect(info).toHaveCount(0);
  await expect.poll(() => child.evaluate(() => UOS.ProgramApp.workspace().entities.rateItems.find(r => r.id === 'RATE-BROWSER-LABOUR').schedulerEnabled)).toBe(false);
  await add.click();
  await expect.poll(() => child.evaluate(id => UOS.ProgramApp.workspace().entities.costingLines.filter(l => l.projectId === id).length, projectId)).toBe(3);
  const last = await child.evaluate(() => UOS.ProgramApp.workspace().entities.costingLines.at(-1));
  expect(last.jobId).toBeNull();
  await expect(frame.locator(`[data-costing-line-calendar="${last.id}"]`)).toHaveCount(0);
  await page.reload();
  const reloaded = page.frames().find(f => f !== page.mainFrame());
  await reloaded.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  expect(await reloaded.evaluate(id => UOS.ProgramApp.workspace().entities.costingLines.filter(l => l.projectId === id).length, projectId)).toBe(3);
});

test('job deletion defaults to retaining the line and deliberately recreates one draft', async ({ page }) => {
  const { child, frame } = await setup(page);
  await frame.locator('[data-costing-add-rate="RATE-BROWSER-LABOUR"]').click();
  await expect.poll(() => child.evaluate(() => UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(1);
  const line = await child.evaluate(() => UOS.ProgramApp.workspace().entities.costingLines[0]);
  await frame.locator(`[data-costing-line-calendar="${line.id}"]`).click();
  await frame.locator('[data-scheduler-delete-job]').click();
  const option = frame.locator('[data-scheduler-delete-costing-line]');
  await expect(option).toBeVisible(); await expect(option).not.toBeChecked();
  await frame.getByRole('button', { name: 'Delete job', exact: true }).last().click();
  await expect.poll(() => child.evaluate(() => UOS.ProgramApp.workspace().entities.jobs.length)).toBe(0);
  await child.evaluate(() => UOS.ProgramApp.navigate('costing'));
  const calendar = frame.locator(`[data-costing-line-calendar="${line.id}"]`);
  await expect(calendar).toBeVisible(); await calendar.click();
  await expect.poll(() => child.evaluate(() => UOS.ProgramApp.workspace().entities.jobs.length)).toBe(1);
  expect(await child.evaluate(() => UOS.ProgramApp.workspace().entities.jobs[0].startDate)).toBe('');
  await child.evaluate(async () => {
    const lineId = UOS.ProgramApp.workspace().entities.costingLines[0].id;
    await UOS.ProgramApp.updateWorkspace(ws => UOS.ProgramCosting.recreateWorkJob(ws, lineId));
  });
  expect(await child.evaluate(() => UOS.ProgramApp.workspace().entities.jobs.length)).toBe(1);
  await frame.locator('[data-scheduler-delete-job]').click();
  await frame.locator('[data-scheduler-delete-costing-line]').check();
  await frame.getByRole('button', { name: 'Delete job', exact: true }).last().click();
  await expect.poll(() => child.evaluate(() => UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(0);
});

test('injected durable failures store no partial creation or deletion', async ({ page }) => {
  const { child, projectId } = await setup(page);
  const result = await child.evaluate(async projectId => {
    const app = UOS.ProgramApp, storage = UOS.storage;
    const original = storage.commitRevision;
    const before = JSON.stringify(app.workspace().entities);
    storage.commitRevision = () => Promise.reject(new Error('Injected durable commit failure'));
    let rejected = false;
    try { await app.updateWorkspace(ws => UOS.ProgramCosting.createWork(ws, projectId, 'RATE-BROWSER-LABOUR', { quantity: 1 }, { operationId: 'durable-retry' })); } catch (_) { rejected = true; }
    storage.commitRevision = original;
    const unchanged = JSON.stringify(app.workspace().entities) === before;
    await app.updateWorkspace(ws => UOS.ProgramCosting.createWork(ws, projectId, 'RATE-BROWSER-LABOUR', { quantity: 1 }, { operationId: 'durable-retry' }));
    const created = app.workspace().entities.costingLines[0];
    const beforeDelete = JSON.stringify(app.workspace().entities);
    storage.commitRevision = () => Promise.reject(new Error('Injected delete failure'));
    let deleteRejected = false;
    try { await app.updateWorkspace(ws => UOS.ProgramModel.deleteJob(ws, created.jobId, { deleteCostingLine: true })); } catch (_) { deleteRejected = true; }
    storage.commitRevision = original;
    const deleteUnchanged = JSON.stringify(app.workspace().entities) === beforeDelete;
    const durable = await UOS.ProgramStorage.get();
    return { rejected, unchanged, deleteRejected, deleteUnchanged, lines: durable.entities.costingLines.length, jobs: durable.entities.jobs.length };
  }, projectId);
  expect(result).toEqual({ rejected: true, unchanged: true, deleteRejected: true, deleteUnchanged: true, lines: 1, jobs: 1 });
});


test('Calculator keeps the complete action rail and unit options, scrolling at narrow widths', async ({ page }) => {
  const { child, frame } = await setup(page);
  await frame.locator('[data-costing-add-rate="RATE-BROWSER-LABOUR"]').click();
  await expect.poll(() => child.evaluate(() => UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(1);
  const line = await child.evaluate(() => UOS.ProgramApp.workspace().entities.costingLines[0]);
  const unit = frame.locator(`[data-costing-line-unit="${line.id}"]`);
  expect(await unit.locator('option').allTextContents()).toEqual(['each', 'hour', 'day', 'week', 'm²', 'ha', 'km²', 'm³', 'L', 'kg', 'tonne', 'm', 'lm', 'item', 'count', 'set']);
  for (const width of [1440, 600]) {
    await page.setViewportSize({ width, height: 900 });
    const measurements = await unit.evaluate(el => {
      const row = el.closest('tr'), cell = row.lastElementChild;
      const rail = cell.querySelector('.program-calculator-action-rail');
      const [calendar, remove] = [...rail.querySelectorAll('button')];
      const box = n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right }; };
      const divider = getComputedStyle(calendar, '::after');
      const wrap = row.closest('.program-calculator-table-wrap');
      return { table: { width: row.closest('table').getBoundingClientRect().width, layout: getComputedStyle(row.closest('table')).tableLayout, cols: [...row.closest('table').querySelectorAll('col')].map(c => ({ cls: c.className, width: getComputedStyle(c).width })) }, unit: box(el), cell: box(cell), calendar: box(calendar), remove: box(remove), gap: remove.getBoundingClientRect().left - calendar.getBoundingClientRect().right,
        divider: { width: divider.borderRightWidth, height: divider.height }, overflow: getComputedStyle(wrap).overflowX, scrollWidth: wrap.scrollWidth, clientWidth: wrap.clientWidth,
        railOverflow: getComputedStyle(rail).overflow, cellOverflow: getComputedStyle(cell).overflow, wrap: box(wrap) };
    });
    const frameHeight = await unit.evaluate(el => parseFloat(getComputedStyle(el.closest('table')).getPropertyValue('--commercial-frame-height')));
    expect(measurements.unit.width).toBeGreaterThanOrEqual(80);
    expect(measurements.cell.width).toBeGreaterThanOrEqual(2 * frameHeight + 16);
    expect(measurements.calendar.width).toBe(frameHeight);
    expect(measurements.remove.width).toBe(frameHeight);
    expect(measurements.calendar.y).toBe(measurements.remove.y);
    expect(measurements.gap).toBe(8);
    expect(measurements.calendar.x - measurements.cell.x).toBeGreaterThanOrEqual(0);
    expect(measurements.cell.right - measurements.remove.right).toBeGreaterThanOrEqual(4);
    expect(measurements.cellOverflow).toBe('visible');
    expect(measurements.railOverflow).toBe('visible');
    await page.keyboard.press("Tab");
    await frame.locator(`[data-costing-line-calendar="${line.id}"]`).focus();
    const focus = await frame.locator(`[data-costing-line-calendar="${line.id}"]`).evaluate(el => ({ focused: document.activeElement === el, outline: getComputedStyle(el).outlineWidth }));
    expect(focus.focused).toBe(true);
    expect(parseFloat(focus.outline)).toBeGreaterThanOrEqual(2);
    if (width === 600) {
      expect(measurements.scrollWidth, JSON.stringify(measurements)).toBeGreaterThan(measurements.clientWidth);
      expect(measurements.overflow).toBe('auto');
      const scrolled = await unit.evaluate(el => {
        const wrap = el.closest('.program-calculator-table-wrap');
        wrap.scrollLeft = wrap.scrollWidth;
        const remove = el.closest('tr').querySelector('[data-costing-remove]');
        return { left: remove.getBoundingClientRect().left, right: remove.getBoundingClientRect().right, wrapRight: wrap.getBoundingClientRect().right, scrollLeft: wrap.scrollLeft };
      });
      expect(scrolled.scrollLeft).toBeGreaterThan(0);
      expect(scrolled.right).toBeLessThanOrEqual(scrolled.wrapRight);
    }
  }
});

test('library icon follows effective defaults and explicit overrides in every section', async ({ page }) => {
  const { child, frame } = await setup(page);
  await child.evaluate(async () => {
    await UOS.ProgramApp.updateWorkspace(ws => {
      for (const kind of ['Labour', 'Contractors', 'Equipment', 'Material', 'Sundry']) {
        for (const enabled of [undefined, true, false]) {
          ws = UOS.ProgramCosting.upsertRateItem(ws, { id: `RATE-FLAG-${kind}-${enabled}`, description: `${kind} ${enabled}`, kind, kindSource: 'user', category: kind, unit: 'each', unitRate: 1, schedulerEnabled: enabled });
        }
      }
      return ws;
    });
  });
  for (const kind of ['Labour', 'Contractors', 'Equipment', 'Material', 'Sundry']) {
    await frame.locator(`[data-costing-section="${kind}"]`).click();
    for (const enabled of [undefined, true, false]) {
      const effective = enabled === undefined ? ['Labour', 'Contractors'].includes(kind) : enabled;
      const icon = frame.locator(`[data-costing-scheduler-info="RATE-FLAG-${kind}-${enabled}"]`);
      await expect(icon).toHaveCount(effective ? 1 : 0);
    }
  }
});


for (const removeItems of [false, true]) {
  test(`Scheduler offers an unchecked plural option for historical aggregate work: remove=${removeItems}`, async ({ page }) => {
    const { child, frame, projectId } = await setup(page);
    const work = await child.evaluate(async projectId => {
      let ids;
      await UOS.ProgramApp.updateWorkspace(ws => {
        ws = UOS.ProgramCosting.createWork(ws, projectId, 'RATE-BROWSER-LABOUR', { quantity: 1 }, { operationId: 'historical-browser' });
        const line = ws.entities.costingLines[0], job = ws.entities.jobs[0];
        for (const item of [line, job]) { delete item.workCommandVersion; delete item.sourceIdentity; }
        delete job.sourceCostingLineId;
        ws.entities.costingLines.push({ ...line, id: line.id + '-SECOND' });
        ids = { jobId: job.id, lineId: line.id };
        ws.workspace.selectedProjectId = projectId;
        ws.workspace.costing.selectedProjectId = projectId;
        return ws;
      });
      return ids;
    }, projectId);

    await frame.locator(`[data-costing-line-calendar="${work.lineId}"]`).click();
    await frame.locator('[data-scheduler-delete-job]').click();
    const modal = frame.locator('.uos-modal--scheduler-delete');
    await expect(modal.getByText('Also delete its Resource Calculator items', { exact: true })).toBeVisible();
    const checkbox = modal.locator('[data-scheduler-delete-costing-line]');
    await expect(checkbox).not.toBeChecked();
    if (removeItems) await checkbox.check();
    await modal.getByRole('button', { name: 'Delete job', exact: true }).click();
    await expect.poll(() => child.evaluate(() => UOS.ProgramApp.workspace().entities.jobs.length)).toBe(0);
    const remaining = await child.evaluate(() => UOS.ProgramApp.workspace().entities.costingLines);
    expect(remaining).toHaveLength(removeItems ? 0 : 2);
    if (!removeItems) for (const line of remaining) expect(line).toMatchObject({ jobId: null, jobCreationSuspended: true });
  });
}
