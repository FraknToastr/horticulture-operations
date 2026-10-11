const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../src/shared/space-map/tree-worker.mjs');
function feature(id, coordinates, type = 'Polygon') { return { type: 'Feature', properties: { OBJECTID: id, risk: 'High' }, geometry: { type, coordinates } }; }
function cell(worker, layer, key, features, flags = {}) { const buffer = new TextEncoder().encode(JSON.stringify({ type: 'FeatureCollection', features, ...flags })).buffer; return worker.processMessage({ type: 'cell', layer, key, buffer, token: 1 }); }
function build(worker, layer, keys) { return worker.processMessage({ type: 'build', layer, keys, token: 2, origin: [0, 0], tolerance: 0, colors: { High: '#ca0020' }, defaultColor: '#ca0020' }); }
test('triangulation preserves polygon holes, multipart rings and geographic alignment', async () => {
  const { polygonBuffers, mercator, geographic } = await import('../src/shared/space-map/geometry.mjs');
  const exterior = [[0, 0], [.01, 0], [.01, .01], [0, .01], [0, 0]], hole = [[.002, .002], [.002, .008], [.008, .008], [.008, .002], [.002, .002]];
  const result = polygonBuffers([exterior, hole], [0, 0]); let area = 0;
  for (let i = 0; i < result.vertices.length; i += 9) { const v = result.vertices.slice(i, i + 9); area += Math.abs((v[3] - v[0]) * (v[7] - v[1]) - (v[6] - v[0]) * (v[4] - v[1])) / 2; }
  const outerSize = mercator([.01, .01]), a = mercator([.002, .002]), b = mercator([.008, .008]);
  assert.ok(Math.abs(area - (outerSize[0] * outerSize[1] - (b[0] - a[0]) * (b[1] - a[1]))) < .01);
  const coordinate = [138.6014, -34.9214], roundtrip = geographic(mercator(coordinate)); assert.ok(Math.abs(roundtrip[0] - coordinate[0]) < 1e-10); assert.ok(Math.abs(roundtrip[1] - coordinate[1]) < 1e-10);
  const worker = await load(); cell(worker, 'srz', 'multipart', [feature(1, [[exterior, hole], [exterior]], 'MultiPolygon')]); const buffers = build(worker, 'srz', ['multipart']); assert.equal(buffers.payload.batches[0].ringCount, 3);
});
test('worker detects both transfer-limit locations and deduplicates OBJECTIDs', async () => {
  const worker = await load(); assert.equal(cell(worker, 'trees', 'limited-a', [], { exceededTransferLimit: true }).limited, true); assert.equal(cell(worker, 'trees', 'limited-b', [], { properties: { exceededTransferLimit: true } }).limited, true);
  const point = feature(3, [138.6, -34.9], 'Point'); cell(worker, 'trees', 'a', [point]); cell(worker, 'trees', 'b', [point]); const result = build(worker, 'trees', ['a', 'b']); assert.equal(result.payload.count, 1); assert.equal(result.payload.points.byteLength, 12);
});
test('malformed coordinates and visible point exhaustion are rejected without partial buffers', async () => {
  const worker = await load(); assert.throws(() => cell(worker, 'trees', 'bad', [feature(1, [181, 0], 'Point')]), /Malformed/);
  cell(worker, 'trees', 'budget', Array.from({ length: 10001 }, (_, i) => feature(i, [138.6, -34.9], 'Point')));
  assert.throws(() => build(worker, 'trees', ['budget']), error => error.limit && /budget/.test(error.message)); worker.processMessage({ type: 'clear', layer: 'trees', token: 4 }); assert.equal(build(worker, 'trees', ['a']).missing, true);
});
test('zone feature and combined GPU budgets reject oversized batches', async () => {
  const worker = await load(); worker.processMessage({ type: 'clear', layer: 'srz' }); worker.processMessage({ type: 'clear', layer: 'tpz' });
  const small = [[[0, 0], [.01, 0], [0, .01], [0, 0]]]; cell(worker, 'srz', 'zone-count', Array.from({ length: 4001 }, (_, i) => feature(i, small)));
  assert.throws(() => build(worker, 'srz', ['zone-count']), e => e.limit && /feature budget/.test(e.message)); worker.processMessage({ type: 'clear', layer: 'srz' });
  const ring = Array.from({ length: 400 }, (_, i) => [138.6 + Math.cos(i / 400 * Math.PI * 2) * .0001, -34.92 + Math.sin(i / 400 * Math.PI * 2) * .0001]); ring.push(ring[0]);
  const features = Array.from({ length: 140 }, (_, i) => feature(i, [ring])); cell(worker, 'srz', 'gpu-srz', features); cell(worker, 'tpz', 'gpu-tpz', features);
  assert.ok(build(worker, 'srz', ['gpu-srz']).payload.gpuBytes > 8 * 1024 * 1024);
  assert.throws(() => build(worker, 'tpz', ['gpu-tpz']), e => e.limit && /Combined tree rendering budget/.test(e.message));
  worker.processMessage({ type: 'clear', layer: 'srz' }); worker.processMessage({ type: 'clear', layer: 'tpz' });
});
test('worker cache stays bounded and reports evicted cells explicitly', async () => {
  const worker = await load(), padding = 'x'.repeat(2 * 1024 * 1024);
  for (let i = 0; i < 6; i++) { const result = cell(worker, 'trees', 'cache-' + i, [], { padding }); assert.ok(result.cacheBytes <= 32 * 1024 * 1024); }
  assert.equal(build(worker, 'trees', ['cache-0']).missing, true); assert.equal(build(worker, 'trees', ['cache-5']).payload.count, 0);
  worker.processMessage({ type: 'clear', layer: 'trees' });
});
