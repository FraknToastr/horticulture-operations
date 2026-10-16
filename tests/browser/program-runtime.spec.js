const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');
const pdfPath = path.resolve('src/sample/nature-strip-dashboard-source.sample.pdf');
const bytes = Array.from(fs.readFileSync(pdfPath));
const rendererURL = /\/vendor\/space-map\/renderer\.js(?:\?.*)?$/;
test.use({ screenshot: 'off', trace: 'off', video: 'off' });

async function launch(page, owner) {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  return frame;
}

async function seed(frame, owner) {
  await frame.evaluate(async owner => {
    await UOS.ProgramApp.updateWorkspace(workspace => {
      const id = owner + (owner === 'NSA' ? '-APP-' : '-EVENT-') + 'RUNTIME-TEST';
      workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push({
        id, owner, title: 'Runtime loading test', status: 'received', dateReceived: '2026-10-10'
      });
      const promoted = UOS.ProgramModel.promoteRegisterRecord(workspace, id);
      const next = UOS.ProgramStatus.migrate(promoted.workspace);
      next.workspace.selectedEntityId = id;
      next.workspace.selectedProjectId = promoted.project.id;
      return next;
    });
  }, owner);
}

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: local Map and PDF runtimes load on first use and are reused`, async ({ page }) => {
    const requests = [];
    page.on('request', request => {
      if (/\/(renderer|maplibre-gl|pdf\.min)\.js(?:\?|$)/.test(request.url())) requests.push(request.url());
    });
    const frame = await launch(page, owner);
    expect(requests).toEqual([]);
    expect(await frame.evaluate(() => !!window.UOSSpaceGPU || !!window.maplibregl || !!window.pdfjsLib)).toBe(false);
    await seed(frame, owner);
    await frame.evaluate(() => UOS.ProgramApp.navigate('map'));
    await frame.waitForFunction(() => UOS.ProgramMapController.getMapController()?.ready());
    expect(requests.filter(url => url.includes('/space-map/renderer.js'))).toHaveLength(1);
    expect(requests.filter(url => url.includes('maplibre-gl'))).toHaveLength(0);
    await frame.evaluate(async () => {
      await UOS.ProgramApp.navigate('register');
      await UOS.ProgramApp.navigate('map');
    });
    const pages = await frame.evaluate(async data => {
      const documents = await Promise.all([UOS.imports.openPdf(data), UOS.imports.openPdf(data)]);
      const pages = documents.map(pdf => pdf.numPages);
      await Promise.all(documents.map(pdf => pdf.destroy()));
      return pages;
    }, bytes);
    expect(pages[0]).toBeGreaterThan(0);
    expect(pages[1]).toBe(pages[0]);
    expect(requests.filter(url => url.includes('pdf.min'))).toHaveLength(1);
    expect(requests.every(url => url.startsWith(new URL('/src/shared/vendor/', page.url()).href))).toBe(true);
    if (owner === 'NSA') {
      await frame.evaluate(async () => {
        await UOS.ProgramApp.updateWorkspace(workspace => workspace);
        await UOS.ProgramApp.navigate('data');
      });
      await frame.locator('[data-program-import-input]').setInputFiles(pdfPath);
      await expect(frame.locator('[data-program-import-modal]')).toBeVisible();
    }
    expect(requests.filter(url => url.includes('pdf.min'))).toHaveLength(1);
    expect(requests.filter(url => url.includes('/space-map/renderer.js'))).toHaveLength(1);
    expect(requests.filter(url => url.includes('maplibre-gl'))).toHaveLength(0);
  });

  test(`${owner}: failed local Map and PDF loads can be retried`, async ({ page }) => {
    await page.route(rendererURL, route => route.abort());
    await page.route('**/vendor/maplibre/maplibre-gl.js', route => route.abort());
    await page.route('**/vendor/pdfjs/pdf.min.js', route => route.abort());
    const frame = await launch(page, owner);
    await seed(frame, owner);
    await frame.evaluate(() => UOS.ProgramApp.navigate('map'));
    await expect(frame.locator('#mapNotice')).toContainText('Reopen Space Map to retry');
    expect(await frame.evaluate(() => UOS.ProgramMapController.getMapController())).toBeNull();
    const message = await frame.evaluate(() => UOS.imports.openPdf([]).then(() => '', error => error.message));
    expect(message).toContain('try again');
    await page.unroute(rendererURL);
    await page.unroute('**/vendor/maplibre/maplibre-gl.js');
    await page.unroute('**/vendor/pdfjs/pdf.min.js');
    await frame.evaluate(async () => {
      await UOS.ProgramApp.navigate('register');
      await UOS.ProgramApp.navigate('map');
    });
    await frame.waitForFunction(() => UOS.ProgramMapController.getMapController()?.ready());
    expect(await frame.evaluate(async data => (await UOS.imports.openPdf(data)).numPages, bytes)).toBeGreaterThan(0);
  });
}
