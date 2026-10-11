import earcut from 'earcut';

export const WORLD = 40075016.68557849;
export function mercator(c) {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, Number(c[1]))) * Math.PI / 180;
  return [Number(c[0]) / 360 * WORLD, Math.log(Math.tan(Math.PI / 4 + lat / 2)) * WORLD / (2 * Math.PI)];
}
export function geographic(c) {
  return [c[0] / WORLD * 360, (2 * Math.atan(Math.exp(c[1] / WORLD * 2 * Math.PI)) - Math.PI / 2) * 180 / Math.PI];
}
export function validCoordinate(c) {
  return Array.isArray(c) && c.length >= 2 && c.slice(0, 2).every(Number.isFinite) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
}

// Each segment is a pair of triangles. Width is in world units; no Line2 resize dependency.
export function strip(ring, width, origin = [0, 0]) {
  const vertices = [];
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (!length) continue;
    const nx = -dy / length * width / 2, ny = dx / length * width / 2;
    const v = [[a[0] + nx, a[1] + ny], [a[0] - nx, a[1] - ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny]];
    for (const index of [0, 1, 2, 2, 1, 3]) vertices.push(v[index][0] - origin[0], v[index][1] - origin[1], 0);
  }
  return vertices;
}

export function outlineBuffers(rings, origin) {
  const base = [], offset = [];
  for (const ring of rings) for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (!length) continue;
    const nx = -dy / length / 2, ny = dx / length / 2;
    for (const [point, side] of [[a, 1], [a, -1], [b, 1], [b, 1], [a, -1], [b, -1]]) { base.push(point[0] - origin[0], point[1] - origin[1], 0); offset.push(nx * side, ny * side); }
  }
  return { base, offset };
}

export function dashedStrip(ring, width, origin, pattern) {
  if (!Array.isArray(pattern) || pattern.length < 2 || !pattern[1]) return strip(ring, width, origin);
  const dash = pattern.map(n => Math.max(.01, n * width)), vertices = [];
  let index = 0, remaining = dash[0];
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!length) continue;
    let distance = 0;
    while (distance < length) {
      // Consume each dash explicitly: modulo at a rounded dash boundary can
      // produce a zero step and truncate every later part of the preview.
      const step = Math.min(remaining, length - distance), next = distance + step;
      if (next <= distance) break;
      if (!(index % 2)) { const p = d => [a[0] + (b[0] - a[0]) * d / length, a[1] + (b[1] - a[1]) * d / length]; for (const v of strip([p(distance), p(next)], width, origin)) vertices.push(v); }
      distance = next;
      if (step === remaining) { index = (index + 1) % dash.length; remaining = dash[index]; }
      else remaining -= step;
    }
  }
  return vertices;
}

export function polygonBuffers(rings, origin, tolerance = 0) {
  const flat = [], holes = [], projected = [];
  for (let r = 0; r < rings.length; r++) {
    let ring = rings[r];
    if (!Array.isArray(ring) || ring.length < 4 || !ring.every(validCoordinate)) throw new Error('Malformed polygon ring');
    if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) throw new Error('Unclosed polygon ring');
    ring = ring.slice(0, -1).map(mercator);
    // Conservative screen-scale reduction only removes near-collinear interior vertices.
    // Keep all corners and every ring, including small holes.
    if (tolerance > 0 && ring.length > 4) {
      const reduced = ring.filter((p, i) => {
        const a = ring[(i + ring.length - 1) % ring.length], b = ring[(i + 1) % ring.length];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return !length || Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / length > tolerance;
      });
      if (reduced.length >= 3) ring = reduced;
    }
    if (r) holes.push(flat.length / 2);
    projected.push(ring.concat([ring[0]]));
    for (const p of ring) flat.push(p[0] - origin[0], p[1] - origin[1]);
  }
  const indices = earcut(flat, holes, 2), vertices = [];
  if (!indices.length) throw new Error('Polygon triangulation failed');
  for (const index of indices) vertices.push(flat[index * 2], flat[index * 2 + 1], 0);
  return { vertices, rings: projected, vertexCount: flat.length / 2 };
}

export function evaluate(expression, feature) {
  if (!Array.isArray(expression)) return expression;
  const e = v => evaluate(v, feature);
  switch (expression[0]) {
    case 'get': return feature.properties?.[expression[1]];
    case 'geometry-type': return feature.geometry.type === 'MultiPolygon' ? 'Polygon' : feature.geometry.type;
    case 'literal': return expression[1];
    case '==': return e(expression[1]) === e(expression[2]);
    case '!=': return e(expression[1]) !== e(expression[2]);
    case 'all': return expression.slice(1).every(e);
    case 'in': return e(expression[2]).includes(e(expression[1]));
    case 'case': for (let i = 1; i < expression.length - 1; i += 2) if (e(expression[i])) return e(expression[i + 1]); return e(expression.at(-1));
    case 'match': for (let i = 2; i < expression.length - 1; i += 2) if (expression[i] === e(expression[1])) return e(expression[i + 1]); return e(expression.at(-1));
    default: return expression;
  }
}
