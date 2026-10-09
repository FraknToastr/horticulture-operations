const {startSpaceCreation}=require('./test-helper.cjs');
const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function openDrawing(page, owner) {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(item => item !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const ids = await frame.evaluate(async owner => {
    let ids;
    await UOS.ProgramApp.updateWorkspace(workspace => {
      const collection = owner === 'NSA' ? 'applications' : 'events';
      const id = `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-DRAWING`;
      workspace.entities[collection].push({ id, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Drawing lifecycle', status: 'received', dateReceived: '2026-10-09' });
      const result = UOS.ProgramModel.promoteRegisterRecord(workspace, id);
      const next = UOS.ProgramStatus.migrate(result.workspace);
      next.workspace.selectedEntityId = id;
      next.workspace.selectedProjectId = result.project.id;
      ids = { recordId: id, projectId: result.project.id };
      return next;
    });
    await UOS.ProgramApp.navigate('map');
    return ids;
  }, owner);
  await frame.waitForFunction(()=>UOS.ProgramMapController.getMapController()?.ready());
  return { frame, ids, errors };
}

async function point(frame, x, y) {
  const canvas = frame.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  const rect = await canvas.boundingBox();
  await canvas.click({ position: { x: rect.width * x, y: rect.height * y } });
}

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: fresh polygon completion, undo, cancellation and reload use real map clicks`, async ({ page }) => {
    const { frame, ids, errors } = await openDrawing(page, owner);
    const finish = frame.locator('#spaceAcceptDraft');
    const cancel = frame.locator('#spaceCancelDraft');
    const undo = frame.locator('#undoDrawingButton');
    await startSpaceCreation(frame,"polygon");
    await expect(finish).toBeDisabled();
    await expect(cancel).toBeEnabled();
    await expect(undo).toBeDisabled();
    await point(frame, .35, .55);
    await expect(undo).toBeEnabled();
    await point(frame, .65, .55);
    await expect(finish).toBeDisabled();
    // An attempted premature completion must leave the current drawing usable.
    await finish.evaluate(button => button.click());
    await expect(cancel).toBeEnabled();
    await point(frame, .65, .8);
    await expect(finish).toBeEnabled();
    await undo.click();
    await expect(finish).toBeDisabled();
    await point(frame, .65, .8);
    await finish.click();
    await expect(frame.locator('[data-shape-card-id]:visible')).toHaveCount(1);
    await expect(finish).toBeDisabled();
    await expect(cancel).toBeDisabled();
    await expect(undo).toBeDisabled();
    const saved = await frame.evaluate(() => UOS.ProgramApp.workspace().entities.geometries);
    expect(saved).toHaveLength(1);
    expect(saved[0].projectId).toBe(ids.projectId);
    expect(saved[0].owner).toBe(owner);
    await startSpaceCreation(frame,"polygon");
    await point(frame, .4, .6);
    await cancel.click();
    expect(await frame.evaluate(() => UOS.ProgramApp.workspace().entities.geometries.length)).toBe(1);
    await page.reload();
    const restored = page.frames().find(item => item !== page.mainFrame());
    await restored.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    expect(await restored.evaluate(() => UOS.ProgramApp.workspace().entities.geometries.map(item => item.id))).toEqual([saved[0].id]);
    expect(errors).toEqual([]);
  });

  test(`${owner}: mode buttons complete polygons, lines and accepted squares`, async ({ page }) => {
    const { frame, errors } = await openDrawing(page, owner);
    for (const mode of ['polygon', 'line', 'square']) {
      await startSpaceCreation(frame,mode);
      await point(frame, .35, .55);
      await point(frame, .65, .55);
      if (mode === 'polygon') await point(frame, .65, .8);
      await frame.locator('#spaceAcceptDraft').click();
      const count = ['polygon', 'line', 'square'].indexOf(mode) + 1;
      await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().entities.geometries.length)).toBe(count);
      await expect(frame.locator('#spaceCancelDraft')).toBeDisabled();
      await expect(frame.locator('#spaceDrawingTools')).not.toHaveClass(/is-drawing/);
    }
    const kinds = await frame.evaluate(() => UOS.ProgramApp.workspace().entities.geometries.map(item => item.geometry.type));
    expect(kinds).toEqual(['Polygon', 'LineString', 'Polygon']);
    expect(errors).toEqual([]);
  });

  test(`${owner}: rejected geometry save reports the error and preserves existing data`, async ({ page }) => {
    const { frame, errors } = await openDrawing(page, owner);
    await frame.evaluate(() => {
      UOS.WorkAreaService.createGeometry = () => { throw new Error('Drawing save rejected for test'); };
    });
    await startSpaceCreation(frame,"polygon");
    await point(frame, .35, .55);
    await point(frame, .65, .55);
    await point(frame, .65, .8);
    await frame.locator('#spaceAcceptDraft').click();
    await expect(frame.locator('#mapToolStatus')).toContainText('Drawing save rejected for test');
    expect(await frame.evaluate(() => UOS.ProgramApp.workspace().entities.geometries.length)).toBe(0);
    expect(await frame.evaluate(() => UOS.ProgramApp.workspace().entities.projects.length)).toBe(1);
    expect(errors).toEqual([]);
  });
}
