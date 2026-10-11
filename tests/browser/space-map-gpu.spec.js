const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { suppressBackupModalForFunctionalTest, startSpaceCreation } = require('./test-helper.cjs');
test.use({ screenshot: 'off', trace: 'off', video: 'off', launchOptions: { args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-vulkan=swiftshader', '--enable-features=Vulkan'] } });

async function open(page, owner, backend, localFile = false) {
  await suppressBackupModalForFunctionalTest(page);
  await page.addInitScript(value => { window.UOS_SPACE_MAP_BACKEND = value; }, backend);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const requests = [], errors = [];
  page.on('request', r => requests.push(r.url())); page.on('pageerror', e => errors.push(e.message));
  const entry = `src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`;
  await page.goto(localFile ? pathToFileURL(path.resolve(entry)).href : '/' + entry);
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  await frame.evaluate(() => { UOS_REMEDIATION_MAP_CONFIG.defaultProvider = 'offline'; });
  return { frame, requests, errors };
}
async function enter(frame) { await frame.evaluate(() => UOS.ProgramApp.navigate('map')); await frame.waitForFunction(() => UOS.ProgramMapController.getMapController()?.ready()); }
async function seed(frame, owner) {
  await frame.evaluate(async owner => {
    await UOS.ProgramApp.updateWorkspace(w => { const id = owner + (owner === 'NSA' ? '-APP-' : '-EVENT-') + 'GPU'; w.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id, owner, title: 'GPU map test', status: 'received', dateReceived: '2026-10-10' }); const p = UOS.ProgramModel.promoteRegisterRecord(w, id); const next = UOS.ProgramStatus.migrate(p.workspace); next.workspace.selectedEntityId = id; next.workspace.selectedProjectId = p.project.id; return next; });
  }, owner);
}
async function clickPoint(frame, x, y) { const canvas = frame.locator('.maplibregl-canvas'), box = await canvas.boundingBox(); await canvas.click({ position: { x: box.width * x, y: box.height * y } }); }

test('local-file entry draws reference layers, full radial connectors and raster camera gestures', async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const requests = [], errors = [];
  page.on('request', r => requests.push(r.url())); page.on('pageerror', e => errors.push(e.message));
  await page.route('**/FeatureServer/**', route => {
    const url = new URL(route.request().url());
    const feature = { type: 'Feature', properties: { OBJECTID: 1, risk: 'High' }, geometry: url.pathname.includes('/0/') ? { type: 'Point', coordinates: [138.6014, -34.9214] } : { type: 'Polygon', coordinates: [[[138.601, -34.922], [138.602, -34.922], [138.602, -34.921], [138.601, -34.921], [138.601, -34.922]]] } };
    return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: url.pathname.endsWith('/query') ? { type: 'FeatureCollection', features: [feature] } : { drawingInfo: { renderer: { symbol: { color: [202, 0, 32] } } } } });
  });
  await page.goto(pathToFileURL(path.resolve('src/program-planner/nsa.html')).href);
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const png = Buffer.from(await frame.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 32; const ctx = c.getContext('2d'); ctx.fillStyle = '#246a32'; ctx.fillRect(0, 0, 32, 32); ctx.fillStyle = '#ee9b2e'; ctx.fillRect(0, 0, 16, 16); return c.toDataURL().split(',')[1]; }), 'base64');
  await page.route('**/api.metromap.com.au/**', route => route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'image/png', body: png }));
  await seed(frame, 'NSA'); await enter(frame);
  await frame.locator('#treeLayerHub').click();
  expect(requests.filter(url => /tree-loader|tree-worker|FeatureServer/.test(url))).toEqual([]);
  expect(await frame.evaluate(() => { const svg = document.querySelector('.tree-layer-menu__connections'), bounds = svg.getBoundingClientRect(); const nodes = [...document.querySelectorAll('[data-tree-layer]')].map(e => ({ id: e.dataset.treeLayer, rect: e.getBoundingClientRect() })); return { width: bounds.width, height: bounds.height, leftToRight: nodes.sort((a,b) => a.rect.x - b.rect.x).map(e=>e.id), centreAboveSides: nodes[1].rect.y < nodes[0].rect.y && nodes[1].rect.y < nodes[2].rect.y }; })).toEqual({ width: 260, height: 166, leftToRight: ['trees','srz','tpz'], centreAboveSides: true });
  await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().easeTo({ center: [138.6014,-34.9214], zoom: 17 }));
  for (const id of ['trees','srz','tpz']) await frame.locator(`[data-tree-layer="${id}"]`).click();
  await frame.waitForFunction(() => { const m=UOS.ProgramMapController.getMapController().getRendererAdapter(); return ['trees','srz','tpz'].every(id=>m.reference.get(id)?.payload.count === 1) && [...m.tiles.values()].some(tile=>tile.texture && tile.mesh.visible); });
  expect(requests.filter(url => /tree-loader-file\.js/.test(url))).toHaveLength(1);
  expect(requests.filter(url => /tree-worker-source\.js/.test(url))).toHaveLength(1);
  expect(requests.filter(url => /tree-loader\.js|tree-worker\.js/.test(url))).toHaveLength(0);
  const canvas=frame.locator('.maplibregl-canvas'), bounds=await canvas.boundingBox(), before=await canvas.screenshot();
  await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.4);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.5+65,bounds.y+bounds.height*.4+40,{steps:8});await page.mouse.up();
  await expect.poll(async()=>Buffer.compare(before,await canvas.screenshot())).not.toBe(0);
  const panned=await canvas.screenshot();await page.mouse.wheel(0,-200);
  await expect.poll(async()=>Buffer.compare(panned,await canvas.screenshot())).not.toBe(0);
  expect(errors).toEqual([]);
});

for (const [owner, backend] of [['NSA', 'webgpu'], ['EVT', 'webgl']]) test(`${owner}: radial polygon preview draws complete dashed edges on ${backend}`, async ({ page }) => {
  const { frame, errors } = await open(page, owner, backend, true);
  await seed(frame, owner); await enter(frame);
  await expect.poll(() => frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererMetrics().backend)).toBe(backend === 'webgpu' ? 'webgpu' : 'webgl2');
  await startSpaceCreation(frame, 'polygon');
  await clickPoint(frame, .3, .4); await clickPoint(frame, .7, .4); await clickPoint(frame, .7, .7);
  await expect.poll(() => frame.evaluate(() => {
    const adapter = UOS.ProgramMapController.getMapController().getRendererAdapter();
    const line = adapter.sources.get('uos-draft').data.features.find(f => f.geometry.type === 'LineString');
    const projected = line.geometry.coordinates.map(c => [c[0] / 360 * 40075016.68557849 - adapter.origin[0], Math.log(Math.tan(Math.PI / 4 + c[1] * Math.PI / 360)) * 40075016.68557849 / (2 * Math.PI) - adapter.origin[1]]);
    const positions = (adapter.objects.get('uos-draft-line') || []).flatMap(mesh => Array.from(mesh.geometry.attributes.position.array));
    const tolerance = 9 / adapter.scale;
    const samples = [];
    for (let i = 1; i < projected.length; i++) for (const fraction of [.25, .5, .75]) {
      const a = projected[i - 1], b = projected[i];
      samples.push([a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction]);
    }
    return samples.length > 0 && samples.every(point => {
      for (let i = 0; i < positions.length; i += 3) if (Math.hypot(positions[i] - point[0], positions[i + 1] - point[1]) <= tolerance) return true;
      return false;
    });
  })).toBe(true);
  await frame.locator('#spaceCancelDraft').click(); expect(errors).toEqual([]);
});

for (const owner of ['NSA', 'EVT']) test(`${owner}: GPU adapter loads on demand, retains drawing on backend loss`, async ({ page }) => {
  const { frame, requests, errors } = await open(page, owner, 'webgl');
  expect(requests.filter(r => /space-map\/(renderer|tree-loader|tree-worker)|maplibre-gl\.js|FeatureServer/.test(r))).toEqual([]);
  await seed(frame, owner); await enter(frame);
  await expect.poll(() => frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererMetrics().backend)).toBe('webgl2');
  expect(requests.filter(r => /space-map\/renderer\.js/.test(r))).toHaveLength(1);
  expect(requests.filter(r => /maplibre-gl\.js/.test(r))).toHaveLength(0);
  await frame.locator('#treeLayerHub').click(); expect(requests.filter(r => /tree-loader|tree-worker|FeatureServer/.test(r))).toHaveLength(0);
  await startSpaceCreation(frame, 'polygon'); await clickPoint(frame, .4, .5); await clickPoint(frame, .6, .5); await clickPoint(frame, .6, .7);
  const before = await frame.evaluate(() => UOS.ProgramMapController.getMapController().getDrawing());
  await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().recover(new Error('Test backend loss')));
  await expect.poll(() => frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererMetrics().backend)).toBe('maplibre');
  expect(await frame.evaluate(() => UOS.ProgramMapController.getMapController().getDrawing())).toEqual(before);
  expect(await frame.evaluate(() => UOS.ProgramApp.workspace().entities.geometries.length)).toBe(0);
  await frame.locator('#spaceAcceptDraft').click(); await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().entities.geometries.length)).toBe(1);
  expect(requests.filter(r => /maplibre-gl\.js/.test(r))).toHaveLength(1); expect(errors).toEqual([]);
});

for (const backend of ['webgl', 'webgpu']) test(`${backend}: tree hub is independent, threshold gated, worker renders service holes and deduplicates cells`, async ({ page }) => {
  const { frame, requests, errors } = await open(page, 'NSA', backend);
  const polygon = { type: 'Feature', properties: { OBJECTID: 7, risk: 'High' }, geometry: { type: 'Polygon', coordinates: [[[138.6005, -34.922], [138.602, -34.922], [138.602, -34.921], [138.6005, -34.921], [138.6005, -34.922]], [[138.601, -34.9218], [138.601, -34.9214], [138.6015, -34.9214], [138.6015, -34.9218], [138.601, -34.9218]]] } };
  await page.route('**/FeatureServer/**', route => {
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith('/query')) return route.fulfill({ json: { drawingInfo: { renderer: { defaultSymbol: { color: [202, 0, 32] }, uniqueValueInfos: [{ value: 'High', symbol: { color: [202, 0, 32] } }] } } } });
    const point = { type: 'Feature', properties: { OBJECTID: 3 }, geometry: { type: 'Point', coordinates: [138.6014, -34.9214] } };
    return route.fulfill({ json: { type: 'FeatureCollection', features: url.pathname.includes('/0/') ? [point] : [polygon] } });
  });
  await frame.evaluate(async () => UOS.ProgramApp.updateWorkspace(w => { w.entities.applications.push({ id: 'NSA-APP-TREES', owner: 'NSA', title: 'Unpromoted tree context', status: 'received', dateReceived: '2026-10-10' }); w.workspace.selectedEntityId = 'NSA-APP-TREES'; return w; }));
  await enter(frame); await frame.locator('#treeLayerHub').click();
  await frame.locator('[data-tree-layer="trees"]').click(); await expect(frame.locator('[data-tree-status="trees"]')).toHaveText('Zoom in to view');
  expect(requests.filter(r => /tree-loader|tree-worker|FeatureServer/.test(r))).toHaveLength(0);
  await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().easeTo({ zoom: 16 }));
  await expect(frame.locator('[data-tree-status="trees"]')).toHaveText('1 visible');
  await frame.locator('[data-tree-layer="srz"]').click(); await frame.locator('[data-tree-layer="tpz"]').click();
  await expect(frame.locator('[data-tree-status="srz"]')).toHaveText('Zoom in to view');
  await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().easeTo({ zoom: 17 }));
  await expect(frame.locator('[data-tree-status="srz"]')).toHaveText('1 visible'); await expect(frame.locator('[data-tree-status="tpz"]')).toHaveText('1 visible');
  await expect.poll(() => frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererMetrics().referenceGpuBytes)).toBeGreaterThan(0);
  const result = await frame.evaluate(() => { const m = UOS.ProgramMapController.getMapController().getRendererAdapter(); return { metrics: m.getResourceMetrics(), tree: UOS.TreeHub.getState(), rings: m.reference.get('srz').payload.batches[0].ringCount, count: m.reference.get('trees').payload.points.length, stored: UOS.ProgramApp.workspace().entities.geometries.length }; });
  expect(result.rings).toBe(2); expect(result.count).toBe(3); expect(result.stored).toBe(0); expect(result.tree.metrics.peakRequests).toBeLessThanOrEqual(4); expect(result.metrics.referenceGpuBytes).toBeLessThanOrEqual(16 * 1024 * 1024); expect(result.metrics.canvasPixels).toBeLessThanOrEqual(4000000);
  expect(result.metrics.backend).toBe(backend === 'webgpu' ? 'webgpu' : 'webgl2');
  const queries = requests.filter(r => /FeatureServer\/\d\/query/.test(r)).map(r => new URL(r)); expect(queries.every(url => url.searchParams.get('outSR') === '4326')).toBe(true); expect(queries.every(url => ['OBJECTID', 'OBJECTID,risk'].includes(url.searchParams.get('outFields')))).toBe(true);
  await frame.locator('[data-space-mode="projects"]').click(); await expect(frame.locator('#treeLayerHub')).toHaveAttribute('aria-expanded', 'true');
  await frame.locator('#treeLayerHub').focus(); await page.keyboard.press('Enter'); await expect(frame.locator('#treeLayerActions')).toBeHidden(); await page.keyboard.press('Space'); await expect(frame.locator('#treeLayerActions')).toBeVisible();
  for (const id of ['trees', 'srz', 'tpz']) await frame.locator(`[data-tree-layer="${id}"]`).click();
  await expect.poll(() => frame.evaluate(() => UOS.TreeHub.getState().metrics.worker)).toBe(false); await expect.poll(() => frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererMetrics().referenceGpuBytes)).toBe(0);
  await expect(frame.locator('#treeLayerHub')).toHaveAttribute('aria-expanded', 'true'); expect(errors).toEqual([]);
  await page.reload(); const fresh = page.frames().find(f => f !== page.mainFrame()); await fresh.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  expect(await fresh.evaluate(() => UOS.TreeHub.getState().enabled)).toEqual({ trees: false, srz: false, tpz: false }); await expect(fresh.locator('#treeLayerHub')).toHaveAttribute('aria-expanded', 'false');
});

test('GPU Moasure placement moves without changing saved geometry', async ({ page }) => {
  const { frame } = await open(page, 'NSA', 'webgl'); await seed(frame, 'NSA'); await enter(frame);
  await frame.locator('#moasureImportButton').click(); await frame.locator('#moasureCsvFile').setInputFiles(path.resolve('tests/fixtures/moasure/north-terrace-6.csv'));
  await frame.locator('#moasureAnchorButton').click(); await clickPoint(frame, .5, .5);
  await expect(frame.locator('[data-placement-controls]')).toBeVisible();
  const data = await frame.evaluate(() => { const c = UOS.ProgramMapController.getMapController(), g = UOS.ProgramApp.workspace().entities.geometries[0], b = g.localPlacement, coordinate = UOS.MoasureGeometry.place(UOS.MoasureGeometry.centroid(b.type, b.coordinates), b.anchor, b.bearing); return { coordinate, pixel: c.projectCoordinate(coordinate), ids: c.shapeIdsAtCoordinate(coordinate), metrics: c.getRendererMetrics(), camera: c.getLocationSnapshot(), id: g.id }; });
  expect(data.ids).toEqual([data.id]); expect(data.metrics.backend).toBe('webgl2');
  const before = await frame.evaluate(() => UOS.ProgramMapController.getMapController().getOperationalSnapshot().features);
  const box = await frame.locator('.maplibregl-canvas').boundingBox(); await page.mouse.move(box.x + data.pixel.x, box.y + data.pixel.y); await page.mouse.down(); await page.mouse.move(box.x + data.pixel.x + 35, box.y + data.pixel.y + 20, { steps: 8 }); await page.mouse.up();
  expect(await frame.evaluate(() => UOS.ProgramMapController.getMapController().getOperationalSnapshot().features)).not.toEqual(before);
  const preview = await frame.evaluate(() => UOS.ProgramMapController.getMapController().getOperationalSnapshot().features);
  await frame.locator('[data-placement-angle]').fill('37');
  const rotated = await frame.evaluate(() => UOS.ProgramMapController.getMapController().getOperationalSnapshot().features);
  await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().recover(new Error('Loss during polygon rotation')));
  expect(await frame.evaluate(() => UOS.ProgramMapController.getMapController().getOperationalSnapshot().features)).toEqual(rotated);
  expect(await frame.locator('[data-placement-angle]').inputValue()).toBe('37');
  await expect(frame.locator('.program-map-rotation-handle')).toHaveCount(1);
  expect(await frame.evaluate(() => UOS.ProgramApp.workspace().entities.geometries[0].localPlacement.bearing)).toBe(0);
  expect(preview).not.toEqual(rotated);
});

test('pin movement survives all backend losses without changing saved locations', async ({ page }) => {
  const { frame, errors } = await open(page, 'NSA', 'webgl'); await seed(frame, 'NSA');
  await frame.evaluate(async () => UOS.ProgramApp.updateWorkspace(w => UOS.ProgramModel.addLocationToRegister(w, w.workspace.selectedEntityId, { id: 'NSA-PIN-GPU', coordinate: [138.6, -34.92] })));
  await enter(frame); await frame.locator('[data-space-mode="register"]').click(); await frame.locator('[data-space-pin]').first().click();
  const original = await frame.evaluate(() => JSON.stringify(UOS.ProgramApp.workspace().entities));
  await frame.locator('#moveLocationButton').click(); await clickPoint(frame, .6, .6);
  const preview = await frame.evaluate(() => UOS.ProgramMapController.getMapController().getLocationSnapshot().features);
  await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().recover(new Error('Loss during pin movement')));
  expect(await frame.evaluate(() => UOS.ProgramMapController.getMapController().getLocationSnapshot().features)).toEqual(preview);
  expect(await frame.evaluate(() => JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(original);
  await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().recover(new Error('Loss of final backend')));
  await expect(frame.locator('#mapUnavailable')).toBeVisible();
  expect(await frame.evaluate(() => UOS.ProgramMapController.getMapController().getLocationSnapshot().features)).toEqual(preview);
  expect(await frame.evaluate(() => JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(original); expect(errors).toEqual([]);
});

test('software WebGPU renders GPU points and preserves the draft when its device is lost', async ({ page }) => {
  const { frame, errors } = await open(page, 'EVT', 'webgpu'); await seed(frame, 'EVT'); await enter(frame);
  await expect.poll(() => frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererMetrics().backend)).toBe('webgpu');
  await startSpaceCreation(frame, 'line'); await clickPoint(frame, .4, .5); await clickPoint(frame, .6, .6);
  await expect.poll(() => frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().renderer.info.render.calls)).toBeGreaterThan(0);
  const draft = await frame.evaluate(() => UOS.ProgramMapController.getMapController().getDrawing());
  await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().renderer.backend.device.destroy());
  await expect.poll(() => frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererMetrics().backend)).toBe('webgl2');
  expect(await frame.evaluate(() => UOS.ProgramMapController.getMapController().getDrawing())).toEqual(draft); expect(errors).toEqual([]);
});

test('transfer limits subdivide cells; hidden maps abort service loading and retain toggles', async ({ page }) => {
  const { frame, requests } = await open(page, 'NSA', 'webgl'); await seed(frame, 'NSA'); let limited = 0, leaves = 0;
  await page.route('**/FeatureServer/0/query?**', route => {
    const bounds = JSON.parse(new URL(route.request().url()).searchParams.get('geometry'));
    if (bounds.xmax - bounds.xmin > .003) { limited++; return route.fulfill({ json: { type: 'FeatureCollection', features: [], properties: { exceededTransferLimit: true } } }); }
    leaves++; return route.fulfill({ json: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { OBJECTID: 1 }, geometry: { type: 'Point', coordinates: [138.6014, -34.9214] } }] } });
  });
  await enter(frame); await frame.locator('#treeLayerHub').click(); await frame.locator('[data-tree-layer="trees"]').click();
  await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().easeTo({ zoom: 16 }));
  await expect(frame.locator('[data-tree-status="trees"]')).toHaveText('1 visible'); expect(limited).toBeGreaterThan(0); expect(leaves).toBe(limited * 4);
  await frame.evaluate(() => UOS.ProgramApp.navigate('register')); const count = requests.filter(r => r.includes('/FeatureServer/')).length;
  await page.waitForTimeout(350); expect(requests.filter(r => r.includes('/FeatureServer/')).length).toBe(count);
  expect(await frame.evaluate(() => UOS.TreeHub.getState().enabled.trees)).toBe(true);
  await frame.evaluate(() => UOS.ProgramApp.navigate('map')); await expect(frame.locator('#treeLayerHub')).toHaveAttribute('aria-expanded', 'true');
});

for (const scenario of ['outage', 'malformed', 'response-budget', 'point-budget']) test(`tree ${scenario} clears only the reference layer and stops automatic retries`, async ({ page }) => {
  const { frame } = await open(page, 'NSA', 'webgl'); await seed(frame, 'NSA'); let requests = 0, failing = true;
  const point = { type: 'Feature', properties: { OBJECTID: 1 }, geometry: { type: 'Point', coordinates: [138.6014, -34.9214] } };
  await page.route('**/FeatureServer/0/query?**', route => {
    requests++;
    if (!failing) return route.fulfill({ json: { type: 'FeatureCollection', features: [point] } });
    if (scenario === 'outage') return route.fulfill({ status: 503, body: 'Unavailable' });
    if (scenario === 'malformed') return route.fulfill({ json: { type: 'FeatureCollection', features: [{ ...point, geometry: { type: 'Point', coordinates: [181, 0] } }] } });
    if (scenario === 'response-budget') return route.fulfill({ headers: { 'Content-Length': String(4 * 1024 * 1024 + 1) }, body: 'Too large' });
    return route.fulfill({ json: { type: 'FeatureCollection', features: Array.from({ length: 10001 }, (_, i) => ({ ...point, properties: { OBJECTID: i } })) } });
  });
  await enter(frame); await frame.locator('#treeLayerHub').click(); await frame.locator('[data-tree-layer="trees"]').click(); await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().easeTo({ zoom: 16 }));
  await expect(frame.locator('[data-tree-status="trees"]')).toHaveText(scenario.endsWith('budget') ? 'Zoom closer to view' : 'Service unavailable. Toggle layer to retry.');
  const count = requests; await frame.evaluate(() => { const m = UOS.ProgramMapController.getMapController().getRendererAdapter(); m.easeTo({ center: [138.6015, -34.9214] }); m.resize(); }); await page.waitForTimeout(400); expect(requests).toBe(count);
  expect(await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererMetrics().referenceGpuBytes)).toBe(0);
  expect(await frame.evaluate(() => UOS.ProgramMapController.getMapController().ready())).toBe(true);
  failing = false; await frame.locator('[data-tree-layer="trees"]').click(); await frame.locator('[data-tree-layer="trees"]').click(); await expect(frame.locator('[data-tree-status="trees"]')).toHaveText('1 visible');
});

for (const backend of ['webgpu', 'webgl']) test(`local launcher ${backend} replaces raster tiles at native display resolution`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  try {
    await suppressBackupModalForFunctionalTest(page);
    await page.addInitScript(value => { window.UOS_SPACE_MAP_BACKEND = value; }, backend);
    await page.goto(pathToFileURL(path.resolve('src/index.html')).href);
    await page.locator('a[href="program-planner/nsa.html"]').click();
    await page.locator('iframe').waitFor();
    const frame = await page.locator('iframe').elementHandle().then(handle => handle.contentFrame());
    await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const images = await frame.evaluate(() => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const ctx = c.getContext('2d');
      return ['#c03030', '#30c030', '#3030c0'].map(color => { ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256); return c.toDataURL().split(',')[1]; });
    });
    const requests = [];
    await page.route('**/api.metromap.com.au/**', route => {
      const url = new URL(route.request().url()), z = Number(url.searchParams.get('TILEMATRIX'));
      requests.push(`${z}:${url.searchParams.get('TILECOL')}:${url.searchParams.get('TILEROW')}`);
      return route.fulfill({ contentType: 'image/png', body: Buffer.from(images[z % 3], 'base64') });
    });
    await frame.evaluate(async () => {
      await UOS.ProgramApp.updateWorkspace(w => { w.entities.applications.push({ id: 'NSA-APP-RASTER', owner: 'NSA', title: 'Raster reference', status: 'received', dateReceived: '2026-10-11' }); w.workspace.selectedEntityId = 'NSA-APP-RASTER'; return w; });
    });
    await enter(frame);
    let previousRequests = new Set();
    for (const step of ['initial', 'pan', 'zoom-out', 'zoom-in']) {
      if (step === 'initial') await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().easeTo({ center: [138.6014,-34.9214], zoom: 17 }));
      else {
        const bounds = await frame.locator('.maplibregl-canvas').boundingBox();
        await page.mouse.move(bounds.x + bounds.width * .7, bounds.y + bounds.height * .4);
        if (step === 'pan') {
          await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width * .2, bounds.y + bounds.height * .4, { steps: 8 }); await page.mouse.up();
        } else {
          const zoom = await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().getZoom());
          await page.mouse.wheel(0, step === 'zoom-out' ? 500 : -1000);
          await expect.poll(() => frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().getZoom())).not.toBe(zoom);
        }
      }
      const camera = await frame.evaluate(() => ({ zoom: UOS.ProgramMapController.getMapController().getRendererAdapter().getZoom() }));
      const expectedZoom = Math.min(20, Math.ceil(camera.zoom + 2));
      await frame.waitForFunction(z => {
        const m = UOS.ProgramMapController.getMapController().getRendererAdapter(), visible = [...m.tiles].filter(([,t]) => t.mesh?.visible);
        return visible.length > 0 && visible.every(([k]) => Number(k.split(':')[1]) === z) && [...m.tiles.values()].every(t => !!t.texture);
      }, expectedZoom);
      const keys = await frame.evaluate(() => { const m = UOS.ProgramMapController.getMapController().getRendererAdapter(); return { backend: m.backend, ratio: m.ratio, count: m.tiles.size, visible: [...m.tiles.keys()].filter(k => m.tiles.get(k).mesh?.visible).map(k => k.substring(k.indexOf(':') + 1)) }; });
      expect(keys.backend).toBe(backend === 'webgl' ? 'webgl2' : 'webgpu'); expect(keys.ratio).toBe(2); expect(keys.count).toBeLessThanOrEqual(128);
      expect(keys.visible.some(key => requests.includes(key) && !previousRequests.has(key))).toBe(true);
      // Decode the real GPU surface: uploading a new tile is insufficient if
      // the imagery displayed on the canvas remains from an earlier zoom.
      const screenshot = await frame.locator('.maplibregl-canvas').screenshot();
      const pixel = await frame.evaluate(async bytes => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
        const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height;
        const ctx = c.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
        return [...ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data].slice(0, 3);
      }, [...screenshot]);
      expect(pixel).toEqual([[192,48,48], [48,192,48], [48,48,192]][expectedZoom % 3]);
      previousRequests = new Set(requests);
    }
  } finally { await context.close(); }
});

test('pan, zoom, resize and raster tiles align with the same geographic projection', async ({ page }) => {
  const { frame, errors } = await open(page, 'NSA', 'webgl'); await seed(frame, 'NSA');
  const png = Buffer.from(await frame.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 2; const ctx = c.getContext('2d'); ctx.fillStyle = 'green'; ctx.fillRect(0, 0, 2, 2); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
  await page.route('https://tiles.example.test/**', route => route.fulfill({ body: png, contentType: 'image/png' }));
  await frame.evaluate(() => { UOS_REMEDIATION_MAP_CONFIG.providers.push({ id: 'test-tiles', tileSize: 256, minzoom: 0, maxzoom: 22, tiles: ['https://tiles.example.test/{z}/{x}/{y}.png'], attribution: 'Test tiles' }); });
  await enter(frame); await frame.evaluate(() => UOS.ProgramMapController.getMapController().setProvider('test-tiles'));
  await expect.poll(() => frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().isSourceLoaded('uos-basemap'))).toBe(true);
  const result = await frame.evaluate(() => {
    const m = UOS.ProgramMapController.getMapController().getRendererAdapter(), c = [138.6014, -34.9214], p = m.project(c), inverse = m.unproject(p), tile = [...m.tiles.values()].find(t => t.mesh);
    const local = tile.mesh.position.clone().project(m.camera); return { center: m.getCenter(), inverse, gpu: { x: (local.x + 1) * m.width / 2, y: (1 - local.y) * m.height / 2 }, point: m.project([((tile.mesh.position.x + m.origin[0]) / 40075016.68557849) * 360, (2 * Math.atan(Math.exp((tile.mesh.position.y + m.origin[1]) / 40075016.68557849 * 2 * Math.PI)) - Math.PI / 2) * 180 / Math.PI]), metrics: m.getResourceMetrics() };
  });
  expect(result.inverse.lng).toBeCloseTo(138.6014, 10); expect(result.inverse.lat).toBeCloseTo(-34.9214, 10); expect(result.gpu.x).toBeCloseTo(result.point.x, 4); expect(result.gpu.y).toBeCloseTo(result.point.y, 4);
  const canvas = frame.locator('.maplibregl-canvas'), box = await canvas.boundingBox(); await page.mouse.move(box.x + box.width * .3, box.y + box.height * .3); await page.mouse.down(); await page.mouse.move(box.x + box.width * .4, box.y + box.height * .4); await page.mouse.up();
  expect(await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().getCenter())).not.toEqual(result.center);
  await page.mouse.wheel(0, -200); await expect.poll(() => frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().getZoom())).toBeGreaterThan(14);
  await page.setViewportSize({ width: 1200, height: 900 }); await frame.evaluate(() => { document.documentElement.dataset.suiteTheme = 'dark'; UOS.ProgramMapController.getMapController().applyTheme(); });
  const resource = await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererMetrics()); expect(resource.tiles).toBeLessThanOrEqual(128); expect(resource.pixelRatio).toBeLessThanOrEqual(2); expect(errors).toEqual([]);
});

test('late worker results cannot replace the latest viewport', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker, handler = Object.getOwnPropertyDescriptor(NativeWorker.prototype, 'onmessage');
    window.Worker = class extends NativeWorker {
      constructor(url, options) { super(url, options); this.isTreeWorker = String(url).includes('tree-worker'); }
      set onmessage(fn) { handler.set.call(this, event => { if (this.isTreeWorker && event.data.type === 'build' && !window.delayedTreeBuild) { window.delayedTreeBuild = true; setTimeout(() => fn(event), 650); } else fn(event); }); }
    };
  });
  const { frame } = await open(page, 'NSA', 'webgl'); await seed(frame, 'NSA');
  await page.route('**/FeatureServer/0/query?**', route => {
    const b = JSON.parse(new URL(route.request().url()).searchParams.get('geometry')), next = b.xmin > 138.65;
    return route.fulfill({ json: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { OBJECTID: next ? 2 : 1 }, geometry: { type: 'Point', coordinates: next ? [138.7, -34.9214] : [138.6014, -34.9214] } }] } });
  });
  await enter(frame); await frame.locator('#treeLayerHub').click(); await frame.locator('[data-tree-layer="trees"]').click(); await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().easeTo({ zoom: 16 }));
  await frame.waitForFunction(() => window.delayedTreeBuild);
  await frame.evaluate(() => { const map = UOS.ProgramMapController.getMapController().getRendererAdapter(); for (let i = 0; i < 20; i++) map.easeTo({ center: [138.68 + i * .001, -34.9214] }); map.easeTo({ center: [138.7, -34.9214] }); });
  await expect(frame.locator('[data-tree-status="trees"]')).toHaveText('1 visible'); await expect.poll(() => frame.evaluate(() => UOS.TreeHub.getState().metrics.staleResults)).toBeGreaterThan(0);
  expect(await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererAdapter().reference.get('trees').payload.geojson.features.map(f => f.properties.OBJECTID))).toEqual([2]);
});
