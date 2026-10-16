'use strict';
// Desktop-only, synthetic operation-count benchmark. No screenshots or workspace exports.
delete process.env.PLAYWRIGHT_BROWSERS_PATH;
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('../tests/browser/test-helper.cjs');
const root = path.resolve(__dirname, '..');
const baseline = process.argv[2] === '--baseline' ? process.argv[3] : null;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error('Provide a Git commit hash for --baseline');
function prior(file) { return execFileSync('rtk', ['proxy', 'git', 'show', baseline + ':' + file], { cwd: root, maxBuffer: 16 * 1024 * 1024 }); }
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const backend of ['maplibre', 'webgl']) for (const count of [100, 1000]) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
      const errors = [], serviceRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/FeatureServer|api\.metromap|audit-tiles/.test(request.url())) serviceRequests.push(request.url()); });
      await suppressBackupModalForFunctionalTest(page);
      await page.addInitScript(backend => { window.UOS_SPACE_MAP_BACKEND = backend; }, backend);
      if (baseline) {
        const renderer = prior('src/shared/vendor/space-map/renderer.js'), controller = prior('src/remediation-planner/js/map.js');
        await page.route(/\/vendor\/space-map\/renderer\.js(?:\?.*)?$/, route => route.fulfill({ body: renderer, contentType: 'text/javascript' }));
        await page.route(/\/remediation-planner\/js\/map\.js(?:\?.*)?$/, route => route.fulfill({ body: controller, contentType: 'text/javascript' }));
      }
      await page.goto('http://127.0.0.1:4199/src/program-planner/nsa.html');
      const frame = page.frames().find(f => f !== page.mainFrame());
      await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
      await frame.evaluate(() => UOS.ProgramRuntime.ensureMap());
      // Isolate controller callbacks from workspace persistence so synthetic
      // pan notifications cannot replace the benchmark data with Project data.
      await frame.evaluate(() => {
        const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;width:800px;height:600px;z-index:9999'; document.body.append(host);
        window.mapBenchmarkController = UOS.RemediationMap.create({ container: host, maplibregl: UOSSpaceGPU, model: UOS.RemediationModel, numberedLocations: true, getWorkspaceMap: () => ({ provider:'offline', zoom:17 }) });
      });
      await frame.waitForFunction(() => window.mapBenchmarkController.ready());
      await frame.evaluate(count => {
        const c = window.mapBenchmarkController;
        c.setMeasurementVisibility(false, false, false, false, false, false);
        const polygons = Array.from({ length: count }, (_, i) => {
          const x = 138.600 + (i % 40) * .00004, y = -34.921 + Math.floor(i / 40) * .00004;
          const shape = { id: 'BENCH-' + i, type: 'turfing', geometryType: 'polygon', closed: true, visible: true, coordinates: [[x,y], [x+.00002,y], [x+.00002,y+.00002], [x,y+.00002]] };
          UOS.RemediationModel.refreshShape(shape); return shape;
        });
        window.mapBenchmarkEvent = { id: 'BENCH-EVENT', polygons, locations: [{ id: 'BENCH-PIN', owner: 'NSA', coordinate: [138.6014,-34.9214], sourceRecordId: 'BENCH-REGISTER' }] };
        c.setEvent(mapBenchmarkEvent);
      }, count);
      await frame.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const result = await frame.evaluate(async () => {
        const c = window.mapBenchmarkController, m = c.getRendererAdapter(), frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const calls = {}, sources = [...m.sources.keys()];
        for (const id of sources) { const source = m.getSource(id), set = source.setData.bind(source); source.setData = data => { calls[id] = (calls[id] || 0) + 1; return set(data); }; }
        const fill = (m.objects.get('uos-shape-fill') || []).slice();
        const pin = document.querySelector('.uos-numbered-location-pin');
        let enables = 0, cameras = 0, sourceUploads = 0;
        if (m.legacy) {
          const en = m.legacy.dragPan.enable.bind(m.legacy.dragPan), cam = m.updateCamera.bind(m);
          m.legacy.dragPan.enable = (...args) => { enables++; return en(...args); };
          m.updateCamera = (...args) => { cameras++; return cam(...args); };
          for (const id of sources) { const native = m.legacy.getSource(id); if (!native?.setData) continue; const set = native.setData.bind(native); native.setData = (...args) => { sourceUploads++; return set(...args); }; }
          for (let i=0; i<20; i++) m.legacy.fire('mousemove', { point: { x: 10, y: 10 }, lngLat: m.legacy.getCenter() });
        }
        const mousemove20 = { enables, cameras };
        for (const id of sources) calls[id] = 0;
        m.fire('moveend');
        const moveendSourceCalls = { ...calls }, moveendNativeUploads = sourceUploads;
        const pinSurvivedMoveend = pin === document.querySelector('.uos-numbered-location-pin');
        c.setEvent(mapBenchmarkEvent);
        const pinSurvivedRefresh = pin === document.querySelector('.uos-numbered-location-pin');
        await frames();
        let fillsReusedOnZoom = null;
        if (!m.legacy) {
          m.easeTo({ zoom: m.getZoom() + .25 }); await frames();
          const next = m.objects.get('uos-shape-fill') || [];
          fillsReusedOnZoom = fill.length > 0 && fill.length === next.length && fill.every((mesh, i) => mesh === next[i]);
        }
        c.startDrawing('polygon');
        m.fire('click', { point: m.project([138.6014,-34.9214]), lngLat: { lng:138.6014, lat:-34.9214 } });
        await frames();
        for (const id of sources) calls[id] = 0;
        const started = performance.now();
        for (let i=0;i<50;i++) m.fire('mousemove', { point: { x:300+i, y:300 }, lngLat: { lng:138.6015+i*.000001, lat:-34.9215 } });
        await frames();
        const preview50 = { sourceCalls: { ...calls }, elapsedMs: Math.round((performance.now()-started)*100)/100 };
        c.cancelDrawing();
        return { backend:m.backend, mousemove20, moveendSourceCalls, moveendNativeUploads, pinSurvivedMoveend, pinSurvivedRefresh, fillsReusedOnZoom, preview50 };
      });
      assert.deepEqual(errors, [], 'benchmark must not hide runtime failures');
      assert.equal(serviceRequests.length, 0, 'offline workload must not request map services');
      if (!baseline) {
        assert.deepEqual(result.mousemove20, { enables: 0, cameras: 0 });
        assert.equal(result.moveendSourceCalls['uos-grid'], 1);
        for (const id of ['uos-shapes','uos-draft','uos-edit-vertices','uos-location']) assert.equal(result.moveendSourceCalls[id], 0);
        assert.equal(result.pinSurvivedMoveend, true); assert.equal(result.pinSurvivedRefresh, true);
        if (result.backend === 'webgl2') assert.equal(result.fillsReusedOnZoom, true);
        assert.equal(result.preview50.sourceCalls['uos-draft'], 1);
        for (const id of ['uos-grid','uos-shapes','uos-edit-vertices','uos-location']) assert.equal(result.preview50.sourceCalls[id], 0);
      }
      console.log(JSON.stringify({ version: baseline || 'working-tree', features: count, serviceRequests: serviceRequests.length, ...result }));
      await page.close();
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
