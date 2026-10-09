const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function setup(page, owner, destination) {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(candidate => candidate !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const ids = await frame.evaluate(async ({ owner, destination }) => {
    const U = window.UOS, app = U.ProgramApp;
    let ids;
    await app.updateWorkspace(ws => {
      const record = { id: `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-DELETE-AUDIT`, owner,
        type: owner === 'NSA' ? 'application' : 'event', title: 'Delete safety audit', status: owner === 'NSA' ? 'received' : 'enquiry' };
      ws.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
      const promoted = U.ProgramModel.promoteRegisterRecord(ws, record.id);
      ws = U.ProgramStatus.migrate(promoted.workspace);
      const task = U.ProgramPlannerModel.saveTask(ws, promoted.project.id, null, {
        title: 'Warning audit task', description: 'Retain until confirmed', section: 'Planning and Approval', operational: false, status: 'Not Started'
      });
      ws = task.workspace;
      const lineId = `${owner}-COST-DELETE-AUDIT`;
      ws.entities.costingLines.push({ id: lineId, owner, type: 'costingLine', projectId: promoted.project.id,
        jobId: null, kind: 'Labour', description: 'Warning audit cost', quantity: 1, unitRate: 25, estimatedTotal: 25 });
      ws.entities.rateItems.push({ id: 'RATE-DELETE-AUDIT', type: 'rateItem', description: 'Unused audit rate',
        kind: 'Labour', kindSource: 'user', category: 'Labour', unit: 'each', unitRate: 12, active: true, quantityMode: 'direct' });
      ws = U.ProgramQuotes.saveDraft(ws, { projectId: promoted.project.id, quoteDate: '2026-10-08',
        customLines: [{ id: `${owner}-QUOTE-LINE-AUDIT`, description: 'Warning audit adjustment', category: 'Labour', unit: 'each', quantity: 1, unitRate: 10 }] });
      ws.workspace.selectedEntityId = record.id;
      ws.workspace.selectedProjectId = promoted.project.id;
      ids = { recordId: record.id, projectId: promoted.project.id, taskId: task.task.id, lineId };
      return ws;
    });
    if (destination === 'map') {
      U.RemediationMap.create = options => {
        let currentEvent;
        window.deleteAuditMap = { removes: 0 };
        return new Proxy({
          available: () => true, ready: () => true,
          setEvent: value => { currentEvent = value; },
          removeVertex: (id, index) => {
            const shape = JSON.parse(JSON.stringify(currentEvent.polygons.find(item => item.id === id)));
            if (shape.coordinates.length <= 3) return { success: false, reason: 'A polygon requires at least 3 vertices.' };
            shape.coordinates.splice(index, 1);
            window.deleteAuditMap.removes += 1;
            options.onShapeEdited(shape);
            return { success: true };
          }
        }, { get: (target, key) => key in target ? target[key] : () => {} });
      };
    }
    await app.navigate(destination);
    return ids;
  }, { owner, destination });
  return { frame, ids };
}
const canonical = frame => frame.evaluate(() => JSON.stringify(window.UOS.ProgramApp.workspace()));
const warning = frame => frame.getByRole('dialog').filter({ has: frame.locator('.uos-modal__foot .uos-button--danger') });

async function redIcon(button, page) {
  const icon = button.locator('svg');
  const expected = await button.evaluate(element => {
    const probe = document.createElement('span'); probe.style.color = 'var(--uos-danger)'; document.body.appendChild(probe);
    const colour = getComputedStyle(probe).color; probe.remove(); return colour;
  });
  for (const state of ['normal', 'hover', 'focus', 'selected']) {
    if (state === 'hover') await button.hover();
    if (state === 'focus') { await page.mouse.move(0, 0); await button.focus(); }
    if (state === 'selected') await button.evaluate(element => element.closest('tr')?.classList.add('is-selected'));
    await expect.poll(() => icon.evaluate(element => getComputedStyle(element).color)).toBe(expected);
  }
}

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: Register warning cancels and rejects changed impact before confirmed cascade`, async ({ page }) => {
    const { frame, ids } = await setup(page, owner, 'register');
    const bin = frame.locator(`[data-register-delete-id="${ids.recordId}"]`).first();
    await redIcon(bin, page);
    const before = await canonical(frame);
    await bin.click();
    const dialog = frame.locator('#deleteRegisterDialog');
    await expect(dialog).toBeVisible();
    expect(await canonical(frame)).toBe(before);
    await dialog.locator('[data-register-delete-cancel]').last().click();
    expect(await canonical(frame)).toBe(before);
    await bin.click();
    await frame.evaluate(async id => window.UOS.ProgramApp.updateWorkspace(ws => {
      ws.entities.projects.find(project => project.id === id).title = 'Changed impact'; return ws;
    }), ids.projectId);
    await dialog.locator('[data-register-delete-confirm]').click();
    await expect(frame.locator('.uos-toast').filter({ hasText: 'changed' })).toBeVisible();
    await expect(bin).toBeVisible();
    await bin.click();
    await dialog.locator('[data-register-delete-confirm]').click();
    await expect.poll(() => frame.evaluate(id => window.UOS.ProgramApp.workspace().entities.projects.some(project => project.id === id), ids.projectId)).toBe(false);
  });

  test(`${owner}: Scheduler job bin stays red and existing confirmation remains required`, async ({ page }) => {
    const { frame, ids } = await setup(page, owner, 'planner');
    const jobId = await frame.evaluate(async ids => {
      let jobId;
      await window.UOS.ProgramApp.updateWorkspace(ws => {
        const task = window.UOS.ProgramPlannerModel.updateTask(ws, ids.projectId, ids.taskId, { operational: true }, {});
        const created = window.UOS.ProgramPlannerModel.createDraftJob(task.workspace, ids.projectId, ids.taskId);
        jobId = created.job.id; return created.workspace;
      });
      await window.UOS.ProgramApp.navigateWithContext('scheduler', jobId);
      await window.UOS.ProgramSchedulerUI.focusCalendarJob(jobId);
      return jobId;
    }, ids);
    const bin = frame.locator('[data-scheduler-delete-job]');
    await redIcon(bin, page);
    const before = await canonical(frame);
    await bin.click();
    await expect(warning(frame)).toBeVisible();
    expect(await canonical(frame)).toBe(before);
    await warning(frame).getByRole('button', { name: 'Keep job', exact: true }).click();
    expect(await canonical(frame)).toBe(before);
    await bin.click();
    await warning(frame).getByRole('button', { name: 'Delete job', exact: true }).click();
    await expect.poll(() => frame.evaluate(id => window.UOS.ProgramApp.workspace().entities.jobs.some(job => job.id === id), jobId)).toBe(false);
  });

  test(`${owner}: pin removal cancels, confirms, and fails closed without warning service`, async ({ page }) => {
    const { frame, ids } = await setup(page, owner, 'map');
    async function addPin() {
      await frame.evaluate(async id => window.UOS.ProgramApp.updateWorkspace(ws => window.UOS.ProgramModel.addLocationToRegister(ws, id, {
        coordinate: [138.60, -34.92], name: 'Warning audit pin'
      })), ids.recordId);
    }
    await addPin();
    const remove = frame.locator(`[data-location-action="delete"][data-location-event-id="${ids.recordId}"]`);
    await expect(remove).toBeVisible();
    const before = await canonical(frame);
    await remove.click();
    await expect(warning(frame)).toContainText('Warning audit pin');
    expect(await canonical(frame)).toBe(before);
    await warning(frame).getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await canonical(frame)).toBe(before);
    await remove.click();
    await warning(frame).getByRole('button', { name: 'Remove pin', exact: true }).click();
    await expect(remove).toHaveCount(0);
    await addPin();
    const retained = await canonical(frame);
    await frame.evaluate(() => { window.UOS.dialogs.confirm = undefined; });
    await remove.click();
    await expect(frame.locator('.uos-toast').filter({ hasText: 'warning dialog' })).toBeVisible();
    expect(await canonical(frame)).toBe(retained);
  });
  test(`${owner}: map vertex and polygon warnings prevent accidental geometry removal`, async ({ page }) => {
    const { frame, ids } = await setup(page, owner, 'map');
    const geometryId = `${owner}-GEO-DELETE-AUDIT`;
    await frame.evaluate(async ({ geometryId, projectId }) => {
      await window.UOS.ProgramApp.updateWorkspace(ws => window.UOS.WorkAreaService.createGeometry(ws, projectId, {
        id: geometryId, workTypeKey: 'turfing', geometryKind: 'polygon',
        geometry: { type: 'Polygon', coordinates: [[[138.60, -34.92], [138.601, -34.92], [138.601, -34.921], [138.60, -34.921], [138.60, -34.92]]] },
        payload: { visible: true, valid: true }
      }));
      await window.UOS.ProgramApp.navigateWithContext('map', geometryId);
      await window.UOS.ProgramApp.updateWorkspace(ws => window.UOS.ProgramMapController.writeCanonicalMapState(ws, {
        scopeMode: 'projects', selectedProjectId: projectId, selectedGeometryId: geometryId, inspectorMode: 'geometry'
      }));
    }, { geometryId, projectId: ids.projectId });
    const card = frame.locator(`[data-shape-card-id="${geometryId}"]`);
    const edit = card.locator('[data-shape-action="edit"]');
    await expect(edit).toBeVisible();
    await edit.click();
    const vertex = card.locator('[data-delete-vertex="0"]');
    await expect(vertex).toBeVisible();
    const before = await canonical(frame);
    await vertex.click();
    await expect(warning(frame)).toContainText('vertex 1');
    expect(await canonical(frame)).toBe(before);
    await page.keyboard.press('Escape');
    expect(await canonical(frame)).toBe(before);
    expect(await frame.evaluate(() => window.deleteAuditMap.removes)).toBe(0);
    await vertex.click();
    await warning(frame).getByRole('button', { name: 'Remove vertex', exact: true }).click();
    await expect.poll(() => frame.evaluate(() => window.deleteAuditMap.removes)).toBe(1);
    expect(await canonical(frame)).toBe(before);
    await frame.locator("#spaceAcceptDraft").click();
    await expect.poll(() => canonical(frame)).not.toBe(before);
    const bin = card.locator('[data-shape-action="delete"]');
    await redIcon(bin, page);
    await bin.click();
    const polygonWarning = frame.locator('#deleteShapeDialog');
    await expect(polygonWarning).toBeVisible();
    const afterVertex = await canonical(frame);
    await polygonWarning.locator('#cancelDeleteShapeButton').click();
    expect(await canonical(frame)).toBe(afterVertex);
    await bin.click();
    await polygonWarning.locator('#confirmDeleteShapeButton').click();
    await expect.poll(() => frame.evaluate(id => window.UOS.ProgramApp.workspace().entities.geometries.some(item => item.id === id), geometryId)).toBe(false);
  });
  test(`${owner}: Planner delete warning cancels safely and confirms suppression`, async ({ page }) => {
    const { frame, ids } = await setup(page, owner, 'planner');
    const row = frame.locator(`[data-task-entity-id="${ids.taskId}"]`);
    if (await row.getAttribute('hidden') !== null) await frame.locator(`[data-planner-section-toggle="${await row.getAttribute('data-planner-section-item')}"]`).click();
    const button = row.locator('[data-delete-item]');
    await redIcon(button, page);
    const before = await canonical(frame);
    for (const dismiss of ['Cancel', 'Escape', 'Close']) {
      await button.click();
      await expect(warning(frame)).toBeVisible();
      await expect(warning(frame)).toContainText('suppressed');
      expect(await canonical(frame)).toBe(before);
      if (dismiss === 'Escape') await page.keyboard.press('Escape');
      else if (dismiss === 'Close') await warning(frame).locator('[data-uos-close]').click();
      else await warning(frame).getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(warning(frame)).toHaveCount(0);
      expect(await canonical(frame)).toBe(before);
    }
    await button.click();
    await warning(frame).getByRole('button', { name: 'Remove task', exact: true }).click();
    await expect.poll(() => frame.evaluate(id => window.UOS.ProgramApp.workspace().entities.tasks.find(task => task.id === id).suppressed, ids.taskId)).toBe(true);
    await expect(row).toHaveCount(0);
  });

  test(`${owner}: Calculator warning retains data, blocks stale deletion, and confirms correct item`, async ({ page }) => {
    const { frame, ids } = await setup(page, owner, 'costing');
    const button = frame.locator(`[data-costing-remove="${ids.lineId}"]`);
    await redIcon(button, page);
    const before = await canonical(frame);
    await button.click();
    await expect(warning(frame)).toContainText('Warning audit cost');
    expect(await canonical(frame)).toBe(before);
    await warning(frame).getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await canonical(frame)).toBe(before);
    await button.click();
    await frame.evaluate(async id => window.UOS.ProgramApp.updateWorkspace(ws => {
      ws.entities.costingLines.find(line => line.id === id).description = 'Changed after warning'; return ws;
    }), ids.lineId);
    await warning(frame).getByRole('button', { name: 'Delete item', exact: true }).click();
    await expect(frame.locator('.uos-toast').filter({ hasText: 'changed' })).toBeVisible();
    await expect(button).toBeVisible();
    await button.click();
    await warning(frame).getByRole('button', { name: 'Delete item', exact: true }).click();
    await expect(button).toHaveCount(0);
    await expect.poll(() => frame.evaluate(id => window.UOS.ProgramApp.workspace().entities.costingLines.some(line => line.id === id), ids.lineId)).toBe(false);
  });

  test(`${owner}: Quote adjustment warning preserves cancellation and updates Draft on confirmation`, async ({ page }) => {
    const { frame } = await setup(page, owner, 'quotes');
    const row = frame.locator('[data-quote-builder-lines] tr').filter({ has: frame.locator('input[value="Warning audit adjustment"]') });
    const button = row.locator('[data-remove-line]');
    await expect(button).toBeVisible();
    const before = await canonical(frame);
    await button.click();
    await expect(warning(frame)).toContainText('Warning audit adjustment');
    expect(await canonical(frame)).toBe(before);
    await warning(frame).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(row).toBeVisible();
    expect(await canonical(frame)).toBe(before);
    await button.click();
    await warning(frame).getByRole('button', { name: 'Remove adjustment', exact: true }).click();
    await expect(row).toHaveCount(0);
    await expect.poll(() => frame.evaluate(() => window.UOS.ProgramApp.workspace().entities.quoteLines.some(line => line.description === 'Warning audit adjustment'))).toBe(false);
  });

  test(`${owner}: unavailable dialog blocks Calculator and rate deletion; all bins stay red`, async ({ page }) => {
    const { frame, ids } = await setup(page, owner, 'costing');
    const rate = frame.locator('[data-costing-delete-rate="RATE-DELETE-AUDIT"]');
    await redIcon(rate, page);
    const before = await canonical(frame);
    await frame.evaluate(() => { window.UOS.dialogs.confirm = undefined; });
    await rate.click();
    await expect(frame.locator('.uos-toast').filter({ hasText: 'warning dialog' })).toBeVisible();
    await frame.locator(`[data-costing-remove="${ids.lineId}"]`).click();
    expect(await canonical(frame)).toBe(before);
    const registerBin = frame.locator(`[data-register-delete-id="${ids.recordId}"]`).first();
    await redIcon(registerBin, page);
  });
}
