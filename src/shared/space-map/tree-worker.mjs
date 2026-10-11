import { polygonBuffers, mercator, validCoordinate, outlineBuffers } from './geometry.mjs';

const CACHE_LIMIT = 32 * 1024 * 1024, GPU_LIMIT = 16 * 1024 * 1024;
const cache = new Map(), layerSizes = new Map(); let cacheBytes = 0;
function append(target, values) { for (const value of values) target.push(value); }
function remove(key) { const cell = cache.get(key); if (cell) { cacheBytes -= cell.bytes; cache.delete(key); } }
function fail(message, limit = false) { const e = new Error(message); e.limit = limit; throw e; }
function visible(feature, bounds) {
  if (!bounds) return true;
  const [xmin, ymin, xmax, ymax] = bounds, g = feature.geometry;
  if (g.type === 'Point') return g.coordinates[0] >= xmin && g.coordinates[0] <= xmax && g.coordinates[1] >= ymin && g.coordinates[1] <= ymax;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polygons.some(rings => { let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity; for (const p of rings[0]) { west = Math.min(west, p[0]); south = Math.min(south, p[1]); east = Math.max(east, p[0]); north = Math.max(north, p[1]); } return east >= xmin && west <= xmax && north >= ymin && south <= ymax; });
}
function signature(features, tolerance) {
  const source = JSON.stringify(features) + ':' + tolerance; let a = 2166136261, b = 5381;
  for (let i = 0; i < source.length; i++) { a = Math.imul(a ^ source.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ source.charCodeAt(i); }
  return `${source.length}:${a >>> 0}:${b >>> 0}`;
}
function validate(feature, layer) {
  if (feature?.type !== 'Feature' || feature.properties?.OBJECTID == null || !feature.geometry) fail('Malformed service feature');
  const g = feature.geometry;
  if (layer === 'trees') { if (g.type !== 'Point' || !validCoordinate(g.coordinates)) fail('Malformed tree coordinate'); }
  else {
    if (!['Polygon', 'MultiPolygon'].includes(g.type)) fail('Malformed zone geometry');
    for (const rings of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
      if (!Array.isArray(rings) || !rings.length) fail('Empty zone geometry');
      for (const ring of rings) if (!Array.isArray(ring) || ring.length < 4 || !ring.every(validCoordinate) || ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) fail('Malformed zone ring');
    }
  }
}

export function processMessage(message) {
  const { type, layer, token } = message;
  if (type === 'clear') { for (const [key, cell] of cache) if (cell.layer === layer) remove(key); layerSizes.delete(layer); return { type, layer, token, cacheBytes }; }
  if (type === 'cell') {
    const json = JSON.parse(new TextDecoder().decode(message.buffer));
    if (json.error) fail(json.error.message || 'Tree service failed');
    if (json.exceededTransferLimit || json.properties?.exceededTransferLimit) return { type, token, limited: true, cacheBytes };
    if (json.type !== 'FeatureCollection' || !Array.isArray(json.features)) fail('Malformed GeoJSON response');
    for (const f of json.features) validate(f, layer);
    const bytes = message.buffer.byteLength * 3;
    if (bytes > CACHE_LIMIT) fail('Tree cache budget exhausted', true);
    remove(message.key);
    while (cacheBytes + bytes > CACHE_LIMIT && cache.size) remove(cache.keys().next().value);
    cache.set(message.key, { layer, features: json.features, bytes }); cacheBytes += bytes;
    return { type, token, cacheBytes, count: json.features.length };
  }
  if (type !== 'build') fail('Unknown tree worker operation');
  const unique = new Map();
  for (const key of message.keys) {
    const cell = cache.get(key); if (!cell) return { type, token, missing: true, cacheBytes };
    cache.delete(key); cache.set(key, cell);
    for (const f of cell.features) if (visible(f, message.bounds)) unique.set(String(f.properties.OBJECTID), f);
  }
  const cap = layer === 'trees' ? 10000 : 4000;
  if (unique.size > cap) fail('Visible feature budget exhausted', true);
  const origin = message.origin, points = [], groups = new Map(), features = []; let vertexCount = 0, gpuBytes = 0;
  for (const original of unique.values()) {
    const f = structuredClone(original); features.push(f);
    if (layer === 'trees') { const p = mercator(f.geometry.coordinates); points.push(p[0] - origin[0], p[1] - origin[1], 0); continue; }
    const riskColor = message.colors[String(f.properties.risk)] || message.defaultColor;
    f.properties.__riskColor = riskColor;
    if (!groups.has(riskColor)) groups.set(riskColor, { color: riskColor, fill: [], outlineBase: [], outlineOffset: [], ringCount: 0 });
    const group = groups.get(riskColor);
    for (const polygon of f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) {
      const buffers = polygonBuffers(polygon, origin, message.tolerance);
      vertexCount += buffers.vertexCount;
      if (vertexCount > 500000) fail('Polygon vertex budget exhausted', true);
      const outline = outlineBuffers(buffers.rings, origin);
      append(group.fill, buffers.vertices); append(group.outlineBase, outline.base); append(group.outlineOffset, outline.offset); group.ringCount += buffers.rings.length;
      gpuBytes += buffers.vertices.length * 4;
      gpuBytes += (outline.base.length + outline.offset.length) * 4;
      if (gpuBytes > GPU_LIMIT) fail('Tree GPU budget exhausted', true);
    }
  }
  gpuBytes += points.length * 4;
  const previous = layerSizes.get(layer); layerSizes.set(layer, { gpuBytes, vertexCount });
  const combinedBytes = [...layerSizes.values()].reduce((n, item) => n + item.gpuBytes, 0), combinedVertices = [...layerSizes.values()].reduce((n, item) => n + item.vertexCount, 0);
  if (combinedBytes > GPU_LIMIT || combinedVertices > 500000) { if (previous) layerSizes.set(layer, previous); else layerSizes.delete(layer); fail('Combined tree rendering budget exhausted', true); }
  return { type, layer, token, cacheBytes, payload: { origin, signature: signature(features, layer === 'trees' ? 0 : message.tolerance), points: new Float32Array(points), batches: [...groups.values()].map(g => ({ color: g.color, fill: new Float32Array(g.fill), outlineBase: new Float32Array(g.outlineBase), outlineOffset: new Float32Array(g.outlineOffset), ringCount: g.ringCount })), geojson: { type: 'FeatureCollection', features }, gpuBytes, vertexCount, count: unique.size } };
}

if (typeof self !== 'undefined' && typeof self.postMessage === 'function') self.onmessage = ({ data }) => {
  try {
    const result = processMessage(data), transfers = [];
    if (result.payload) { transfers.push(result.payload.points.buffer); for (const batch of result.payload.batches) transfers.push(batch.fill.buffer, batch.outlineBase.buffer, batch.outlineOffset.buffer); }
    self.postMessage(result, transfers);
  } catch (error) { self.postMessage({ type: 'error', token: data.token, layer: data.layer, message: error.message || 'Tree geometry allocation failed', limit: !!error.limit || error instanceof RangeError }); }
};
