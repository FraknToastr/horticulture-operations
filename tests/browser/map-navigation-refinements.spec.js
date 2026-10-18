const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.use({ launchOptions: { args: ['--use-angle=swiftshader'] } });

for (const [owner, backend] of [['NSA', 'webgl'], ['EVT', 'maplibre']]) {
  test(`${owner}: compact SVG map controls are inset and zoom/home preserve map data on ${backend}`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.addInitScript(value => { window.UOS_SPACE_MAP_BACKEND = value; }, backend);
    await page.route(/^https?:/, route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.goto('/src/program-planner/' + (owner === 'NSA' ? 'nsa' : 'events') + '.html');
    const frame = page.frames().find(candidate => candidate !== page.mainFrame());
    await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
    await frame.evaluate(async owner => {
      UOS_REMEDIATION_MAP_CONFIG.defaultProvider = 'offline';
      const id = owner + (owner === 'NSA' ? '-APP-' : '-EVENT-') + 'MAP-NAV';
      await UOS.ProgramApp.updateWorkspace(workspace => {
        workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id, owner, title: 'Map controls', status: 'received', dateReceived: '2026-10-18' });
        workspace.workspace.selectedEntityId = id;
        return workspace;
      });
      UOS.ProgramApp.navigate('map');
    }, owner);
    await frame.waitForFunction(() => UOS.ProgramMapController.getMapController()?.ready());
    const controls = frame.getByRole('group', { name: 'Map navigation', exact: true });
    await expect(controls).toHaveCount(1);
    await expect(controls.getByRole('button')).toHaveCount(3);
    await expect(controls.locator('svg')).toHaveCount(3);
    const bounds = await controls.evaluate(element => {
      const box = element.getBoundingClientRect(), viewport = element.closest('.maplibregl-map').getBoundingClientRect();
      return {
        top: box.top - viewport.top, right: viewport.right - box.right,
        sizes: [...element.querySelectorAll('button')].map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height }))
      };
    });
    expect(bounds.top).toBeCloseTo(10, 0);
    expect(bounds.right).toBeCloseTo(10, 0);
    expect(bounds.sizes).toEqual(Array(3).fill({ width: 28, height: 28 }));
    const zoom = () => frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().getZoom());
    const before = await frame.evaluate(() => ({
      locations: [...UOS.ProgramApp.workspace().entities.applications, ...UOS.ProgramApp.workspace().entities.events].map(record => record.locations),
      geometries: UOS.ProgramApp.workspace().entities.geometries
    }));
    await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().easeTo({ center: [138.62, -34.94], zoom: 17, duration: 0 }));
    await expect.poll(zoom).toBeCloseTo(17, 4);
    await controls.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(zoom).toBeCloseTo(18, 4);
    await controls.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect.poll(zoom).toBeCloseTo(17, 4);
    await controls.getByRole('button', { name: 'Home', exact: true }).focus();
    await controls.getByRole('button', { name: 'Home', exact: true }).press('Enter');
    await expect.poll(zoom).toBeCloseTo(14, 4);
    const result = await frame.evaluate(() => {
      const center = UOS.ProgramMapController.getMapController().getRendererAdapter().getCenter();
      return { center: [center.lng, center.lat], home: UOS_REMEDIATION_MAP_CONFIG.defaultCenter,
        locations: [...UOS.ProgramApp.workspace().entities.applications, ...UOS.ProgramApp.workspace().entities.events].map(record => record.locations), geometries: UOS.ProgramApp.workspace().entities.geometries };
    });
    expect(result.center[0]).toBeCloseTo(result.home[0], 5);
    expect(result.center[1]).toBeCloseTo(result.home[1], 5);
    expect(result.locations).toEqual(before.locations);
    expect(result.geometries).toEqual(before.geometries);
  });
}
