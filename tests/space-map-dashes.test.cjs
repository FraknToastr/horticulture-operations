const { test } = require('node:test');
const assert = require('node:assert/strict');

test('fractional-width preview dashes span long edges without truncation', async () => {
  const { dashedStrip } = await import('../src/shared/space-map/geometry.mjs');
  for (const width of [.23, .37, .7, 1.3, 2.8, 3.0001]) {
    const vertices = dashedStrip([[0, 0], [300, 0]], width, [0, 0], [2, 1]);
    const end = Math.max(...vertices.filter((_, i) => i % 3 === 0));
    assert.ok(end >= 300 - width, `width ${width}: edge stops at ${end}`);
    assert.ok(vertices.every(Number.isFinite));
  }
});

test('dashes continue around polygon corners with local Mercator rebasing', async () => {
  const { dashedStrip, mercator } = await import('../src/shared/space-map/geometry.mjs');
  const ring = [[138.6, -34.92], [138.604, -34.92], [138.604, -34.924], [138.6, -34.92]].map(mercator);
  const width = .37, origin = ring[0], vertices = dashedStrip(ring, width, origin, [2, 1]);
  for (const corner of ring) {
    let nearest = Infinity;
    for (let i = 0; i < vertices.length; i += 3) nearest = Math.min(nearest, Math.hypot(vertices[i] - (corner[0] - origin[0]), vertices[i + 1] - (corner[1] - origin[1])));
    assert.ok(nearest < width * 3, `missing edge near corner: ${nearest}`);
  }
});
