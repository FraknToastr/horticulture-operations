const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

for (const owner of ['NSA', 'EVT']) test(`${owner} Space Map field waits for focus loss and commits the originating geometry`, async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  const id = await frame.evaluate(async owner => {
    let geometryId;
    await UOS.ProgramApp.updateWorkspace(w => {
      const id = owner + (owner === 'NSA' ? '-APP-' : '-EVENT-') + 'FOCUS-MAP';
      w.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id, owner, title: 'Focus Map', status: 'received', dateReceived: '2026-11-02', raw: {} });
      const result = UOS.ProgramModel.promoteRegisterRecord(w, id);
      w = UOS.WorkAreaService.createGeometry(result.workspace, result.project.id, {
        geometry: { type: 'Polygon', coordinates: [[[138.6,-34.92],[138.601,-34.92],[138.601,-34.921],[138.6,-34.92]]] }, payload: { visible: true }
      });
      geometryId = w.entities.geometries[0].id;
      w.workspace.selectedEntityId = id; w.workspace.selectedProjectId = result.project.id;
      return w;
    });
    await UOS.ProgramApp.navigate('map');
    return geometryId;
  }, owner);
  await frame.evaluate(() => {
    window.__fieldSaves = 0;
    const save = UOS.ProgramStorage.saveValidated;
    UOS.ProgramStorage.saveValidated = function (...args) { window.__fieldSaves++; return save.apply(this, args); };
  });
  // Dispatch the same field events as a checkbox activation while retaining focus.
  // Geometry cards can be outside the visible sidebar scroll, so avoid scrolling them.
  await frame.evaluate(id => {
    const field = document.querySelector('[data-shape-visible="' + id + '"]');
    if (!field) throw new Error('Geometry visibility field was not rendered');
    field.focus(); field.checked = false;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }, id);
  expect(await frame.evaluate(() => window.__fieldSaves)).toBe(0);
  expect(await frame.evaluate(id => UOS.ProgramModel.workGeometryById(UOS.ProgramApp.workspace(), id).payload.visible, id)).toBe(true);
  await frame.evaluate(async id => {
    document.querySelector('[data-shape-visible="' + id + '"]').blur();
    await UOS.ProgramFieldCommits.flushAll();
  }, id);
  expect(await frame.evaluate(id => UOS.ProgramModel.workGeometryById(UOS.ProgramApp.workspace(), id).payload.visible, id)).toBe(false);
  expect(await frame.evaluate(() => window.__fieldSaves)).toBeGreaterThan(0);
});
