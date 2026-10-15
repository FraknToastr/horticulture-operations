import { WebGPURenderer, Scene, OrthographicCamera, BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshBasicNodeMaterial, Color, DoubleSide, CanvasTexture, PlaneGeometry, Sprite, PointsNodeMaterial, InstancedBufferAttribute, SRGBColorSpace } from 'three/webgpu';
import { instancedBufferAttribute, uv, vec4, vec3, color, float, smoothstep, attribute, positionLocal, uniform } from 'three/tsl';
import { WORLD, mercator, geographic, polygonBuffers, dashedStrip, evaluate } from './geometry.mjs';
import { addLegacyReference } from './legacy-reference.mjs';

function disposeRenderer(renderer) {
  if (!renderer) return;
  // Three's dispose() starts an animation-loop promise even after failed init.
  // Dispose initialized renderers; failed initialization only owns its device.
  if (renderer._initialized) renderer.dispose().catch(() => {});
  else renderer.backend.device?.destroy();
}

export class LngLatBounds {
  constructor(a, b) { this.coordinates = []; if (a) this.extend(a); if (b) this.extend(b); }
  extend(c) { if (c instanceof LngLatBounds) this.coordinates.push(...c.coordinates); else if (Array.isArray(c[0])) c.forEach(p => this.extend(p)); else this.coordinates.push(Array.isArray(c) ? c : [c.lng, c.lat]); return this; }
  isEmpty() { return !this.coordinates.length; }
  getSouthWest() { return { lng: Math.min(...this.coordinates.map(c => c[0])), lat: Math.min(...this.coordinates.map(c => c[1])) }; }
  getNorthEast() { return { lng: Math.max(...this.coordinates.map(c => c[0])), lat: Math.max(...this.coordinates.map(c => c[1])) }; }
}

export class NavigationControl {
  onAdd(map) {
    const el = document.createElement('div'); el.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    for (const [label, delta] of [['Zoom in', 1], ['Zoom out', -1]]) {
      const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', label); button.textContent = delta > 0 ? '+' : '−'; button.addEventListener('click', () => map.easeTo({ zoom: map.getZoom() + delta, originalEvent: { type: 'control' } })); el.append(button);
    }
    return el;
  }
}

export class Marker {
  constructor(options = {}) { this.options = options; this.element = options.element || document.createElement('div'); this.handlers = {}; this.coordinate = [0, 0]; this.element.classList.add('maplibregl-marker'); }
  setLngLat(c) { this.coordinate = Array.isArray(c) ? c.slice(0, 2) : [c.lng, c.lat]; this.update(); return this; }
  getLngLat() { return { lng: this.coordinate[0], lat: this.coordinate[1] }; }
  getElement() { return this.element; }
  setDraggable(value) { this.options.draggable = value; return this; }
  on(name, handler) { (this.handlers[name] ||= []).push(handler); return this; }
  emit(name) { for (const fn of this.handlers[name] || []) fn({ target: this }); }
  addTo(map) {
    this.map = map; map.markers.add(this); map.overlay.append(this.element); this.update();
    this.down = event => {
      if (!this.options.draggable) return;
      event.preventDefault(); event.stopPropagation(); this.element.setPointerCapture(event.pointerId); this.emit('dragstart');
      this.move = e => { e.stopPropagation(); this.setLngLat(map.unproject(map.eventPoint(e))); this.emit('drag'); };
      this.up = e => { e.stopPropagation(); this.element.removeEventListener('pointermove', this.move); this.element.removeEventListener('pointerup', this.up); this.emit('dragend'); };
      this.element.addEventListener('pointermove', this.move); this.element.addEventListener('pointerup', this.up, { once: true });
    };
    this.element.addEventListener('pointerdown', this.down); return this;
  }
  update() {
    if (!this.map) return;
    const p = this.map.project(this.coordinate), o = this.options.offset || [0, 0];
    const anchor = this.options.anchor === 'bottom' ? 'translate(-50%, -100%)' : 'translate(-50%, -50%)';
    Object.assign(this.element.style, { position: 'absolute', left: `${p.x + o[0]}px`, top: `${p.y + o[1]}px`, transform: anchor });
  }
  remove() { this.element.removeEventListener('pointerdown', this.down); this.map?.markers.delete(this); this.element.remove(); this.map = null; return this; }
}

class GeoSource {
  constructor(map, id, definition) { this.map = map; this.id = id; Object.assign(this, definition); this.version = 0; this.serialized = ''; }
  setData(data) { const serialized = JSON.stringify(data); if (serialized !== this.serialized) { this.data = data; this.serialized = serialized; this.version++; this.map.dirtySources.add(this.id); this.map.legacy?.getSource(this.id)?.setData(data); this.map.invalidate(); } }
}

export class Map {
  constructor(options) {
    this.isSpaceMapAdapter = true; this.placeholderCanvas = document.createElement('canvas');
    this.options = options; this.container = typeof options.container === 'string' ? document.getElementById(options.container) : options.container;
    this.center = Array.isArray(options.center) ? options.center.slice() : [options.center.lng, options.center.lat]; this.zoom = options.zoom || 14;
    this.origin = mercator(this.center); this.sources = new globalThis.Map(); this.layers = []; this.handlers = {}; this.markers = new Set(); this.controls = [];
    this.layers = structuredClone(options.style?.layers || []);
    this.outlineScale = uniform(1);
    this.objects = new globalThis.Map(); this.dirtySources = new Set(); this.reference = new globalThis.Map(); this.tiles = new globalThis.Map(); this.tileGeneration = 0;
    this.backend = 'initializing'; this.attempt = -1; this.generation = 0; this.removed = false; this.loaded = false; this.pendingFrame = 0; this.rendering = false; this.redraw = false;
    this.dragPan = { enabled: true, disable: () => { this.dragPan.enabled = false; }, enable: () => { this.dragPan.enabled = true; } };
    this.doubleClickZoom = { disable: () => { this.noDoubleClick = true; }, enable: () => { this.noDoubleClick = false; } };
    this.container.classList.add('maplibregl-map'); this.container.style.position = 'relative';
    // The controller accesses the canvas before asynchronous GPU initialization.
    this.canvas = document.createElement('canvas'); this.container.prepend(this.canvas); this.bindCanvas(this.canvas);
    this.overlay = document.createElement('div'); this.overlay.className = 'space-map-dom-overlay'; Object.assign(this.overlay.style, { position: 'absolute', inset: '0', pointerEvents: 'none' }); this.container.append(this.overlay);
    this.attribution = document.createElement('div'); this.attribution.className = 'maplibregl-ctrl-attrib space-map-attribution'; this.attribution.setAttribute('aria-label', 'Basemap attribution'); Object.assign(this.attribution.style, { position: 'absolute', bottom: '0', right: '0', zIndex: '2' }); this.container.append(this.attribution);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.container);
    this.resize(); queueMicrotask(() => this.recover());
  }
  on(name, handler) { (this.handlers[name] ||= []).push(handler); return this; }
  off(name, handler) { this.handlers[name] = (this.handlers[name] || []).filter(fn => fn !== handler); return this; }
  fire(name, event = {}) { for (const fn of this.handlers[name] || []) fn({ target: this, ...event }); }
  getCanvas() { return this.canvas || this.legacy?.getCanvas() || this.placeholderCanvas; }
  getCenter() { return { lng: this.center[0], lat: this.center[1] }; }
  getZoom() { return this.zoom; }
  getBounds() { const a = this.unproject([0, this.height]), b = this.unproject([this.width, 0]); return new LngLatBounds([a.lng, a.lat], [b.lng, b.lat]); }
  isMoving() { return !!this.panning; }
  getStyle() { return { version: 8, sources: Object.fromEntries([...this.sources].map(([id, s]) => [id, { type: s.type, data: s.data }])), layers: this.layers }; }
  setGlyphs() {}
  getSource(id) { return this.sources.get(id); }
  addSource(id, definition) { const s = new GeoSource(this, id, definition); this.sources.set(id, s); if (definition.data) s.setData(definition.data); this.legacy?.addSource(id, definition); this.invalidate(); }
  removeSource(id) { this.sources.delete(id); for (const [key, tile] of this.tiles) if (tile.source === id) this.releaseTile(key, tile); this.legacy?.removeSource(id); this.invalidate(); }
  getLayer(id) { return this.layers.find(l => l.id === id); }
  addLayer(layer, before) { const i = this.layers.findIndex(l => l.id === before); this.layers.splice(i < 0 ? this.layers.length : i, 0, structuredClone(layer)); this.legacy?.addLayer(layer, before); if (layer.source) this.dirtySources.add(layer.source); this.invalidate(); }
  removeLayer(id) { this.layers = this.layers.filter(l => l.id !== id); this.disposeObject(id); this.legacy?.removeLayer(id); this.invalidate(); }
  setPaintProperty(id, key, value) { const l = this.getLayer(id); if (!l) return; l.paint ||= {}; l.paint[key] = value; this.dirtySources.add(l.source); this.legacy?.setPaintProperty(id, key, value); this.invalidate(); }
  setLayoutProperty(id, key, value) { const l = this.getLayer(id); if (!l) return; l.layout ||= {}; l.layout[key] = value; this.dirtySources.add(l.source); this.legacy?.setLayoutProperty(id, key, value); this.invalidate(); }
  isSourceLoaded(id) { const source = this.sources.get(id); return !!source && (source.type !== 'raster' || [...this.tiles.values()].some(t => t.source === id && t.texture)); }
  addControl(control, position = 'top-right') { const el = control.onAdd(this); const wrap = document.createElement('div'); wrap.className = `maplibregl-control-container space-map-controls space-map-controls--${position}`; Object.assign(wrap.style, { position: 'absolute', top: '0', right: '0', zIndex: '3' }); wrap.append(el); this.container.append(wrap); this.controls.push(wrap); return this; }
  project(c) { if (this.legacy) return this.legacy.project(c); const p = mercator(Array.isArray(c) ? c : [c.lng, c.lat]), center = mercator(this.center); return { x: this.width / 2 + (p[0] - center[0]) * this.scale, y: this.height / 2 - (p[1] - center[1]) * this.scale }; }
  unproject(p) { if (this.legacy) return this.legacy.unproject(p); p = Array.isArray(p) ? p : [p.x, p.y]; const center = mercator(this.center), c = geographic([center[0] + (p[0] - this.width / 2) / this.scale, center[1] - (p[1] - this.height / 2) / this.scale]); return { lng: c[0], lat: c[1] }; }
  easeTo(options) {
    if (this.legacy) { this.legacy.easeTo(options); return this; }
    if (options.center) this.center = Array.isArray(options.center) ? options.center.slice() : [options.center.lng, options.center.lat];
    const previous = this.zoom; if (options.zoom != null) this.zoom = Math.max(0, Math.min(22, options.zoom));
    this.updateCamera();
    // Camera motion also changes raster visibility and the local projection
    // used by reference geometry; always schedule a complete redraw.
    this.dirtyAll(); this.invalidate(); this.fire('move'); this.fire('moveend', { originalEvent: options.originalEvent }); return this;
  }
  jumpTo(options) { return this.easeTo(options); }
  fitBounds(bounds, options = {}) {
    if (!(bounds instanceof LngLatBounds)) bounds = new LngLatBounds(bounds);
    if (bounds.isEmpty()) return this;
    const a = mercator(Object.values(bounds.getSouthWest())), b = mercator(Object.values(bounds.getNorthEast()));
    const p = typeof options.padding === 'number' ? { left: options.padding, right: options.padding, top: options.padding, bottom: options.padding } : (options.padding || {});
    const w = Math.max(1, this.width - (p.left || 0) - (p.right || 0)), h = Math.max(1, this.height - (p.top || 0) - (p.bottom || 0));
    const zoom = Math.min(options.maxZoom || 22, Math.log2(Math.min(w / Math.max(1, b[0] - a[0]), h / Math.max(1, b[1] - a[1])) * WORLD / 512));
    const scale = 512 * 2 ** zoom / WORLD;
    return this.easeTo({ center: geographic([(a[0] + b[0]) / 2 - ((p.left || 0) - (p.right || 0)) / (2 * scale), (a[1] + b[1]) / 2 + ((p.top || 0) - (p.bottom || 0)) / (2 * scale)]), zoom, ...options });
  }
  resize() {
    const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight), ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(4000000 / (width * height)));
    const changed = width !== this.width || height !== this.height || ratio !== this.ratio;
    this.width = width; this.height = height; this.ratio = ratio;
    const size = `${width}:${height}:${ratio}`;
    // Reassigning canvas dimensions clears the surface, even at the same size.
    if (this.renderer && this.rendererSize !== size) { if (this.renderer.getPixelRatio() !== ratio) this.renderer.setPixelRatio(ratio); this.renderer.setSize(width, height, false); this.rendererSize = size; }
    if (changed) this.legacy?.resize(); this.updateCamera();
    if (changed) { this.invalidate(); this.fire('resize'); } return this;
  }
  updateCamera() {
    this.scale = 512 * 2 ** this.zoom / WORLD;
    this.outlineScale.value = 1 / this.scale;
    if (!this.camera) return;
    const c = mercator(this.center);
    if (Math.hypot(c[0] - this.origin[0], c[1] - this.origin[1]) > 65536) { this.origin = c; this.dirtyAll(); for (const ref of this.reference.values()) ref.dirty = true; for (const [key, tile] of this.tiles) this.releaseTile(key, tile); }
    this.camera.left = -this.width / (2 * this.scale); this.camera.right = -this.camera.left; this.camera.top = this.height / (2 * this.scale); this.camera.bottom = -this.camera.top;
    this.camera.position.set(c[0] - this.origin[0], c[1] - this.origin[1], 100); this.camera.updateProjectionMatrix();
    for (const m of this.markers) m.update();
  }
  dirtyAll() { for (const id of this.sources.keys()) this.dirtySources.add(id); }
  eventPoint(event) { const r = this.container.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  bindCanvas(canvas) {
    canvas.className = 'maplibregl-canvas space-map-gpu-canvas'; Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', touchAction: 'none' }); canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Interactive spatial map');
    const eventFor = e => { const point = this.eventPoint(e); return { point, lngLat: this.unproject(point), originalEvent: e }; };
    let start, last, moved = false; const pointers = new globalThis.Map(); let pinchDistance = 0;
    canvas.addEventListener('pointerdown', e => { canvas.focus({ preventScroll: true }); canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, this.eventPoint(e)); start = last = this.eventPoint(e); moved = false; this.fire(e.pointerType === 'touch' ? 'touchstart' : 'mousedown', eventFor(e)); this.panning = this.dragPan.enabled; if (pointers.size === 2) pinchDistance = Math.hypot(...[...pointers.values()].reduce((a, p, i) => i ? [a[0] - p.x, a[1] - p.y] : [p.x, p.y], [])); });
    canvas.addEventListener('pointermove', e => {
      this.fire(e.pointerType === 'touch' ? 'touchmove' : 'mousemove', eventFor(e));
      if (!pointers.has(e.pointerId)) return; const p = this.eventPoint(e); pointers.set(e.pointerId, p);
      if (start && Math.hypot(p.x - start.x, p.y - start.y) > 3) moved = true;
      if (pointers.size === 2 && this.dragPan.enabled) { const ps = [...pointers.values()], distance = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y); if (pinchDistance) this.zoom = Math.max(0, Math.min(22, this.zoom + Math.log2(distance / pinchDistance))); pinchDistance = distance; this.dirtyAll(); this.updateCamera(); this.invalidate(); }
      else if (this.panning && this.dragPan.enabled && last) { const c = mercator(this.center); this.center = geographic([c[0] - (p.x - last.x) / this.scale, c[1] + (p.y - last.y) / this.scale]); this.updateCamera(); this.invalidate(); this.fire('move', eventFor(e)); } last = p;
    });
    const finish = e => { pointers.delete(e.pointerId); this.fire(e.pointerType === 'touch' ? 'touchend' : 'mouseup', eventFor(e)); if (!moved && e.type !== 'pointercancel') this.fire('click', eventFor(e)); this.panning = false; start = last = null; pinchDistance = 0; this.fire('moveend', eventFor(e)); };
    canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('wheel', e => { e.preventDefault(); const p = this.eventPoint(e), before = this.unproject(p); this.zoom = Math.max(0, Math.min(22, this.zoom - e.deltaY * .003)); this.updateCamera(); const after = this.unproject(p), a = mercator([before.lng, before.lat]), b = mercator([after.lng, after.lat]), c = mercator(this.center); this.center = geographic([c[0] + a[0] - b[0], c[1] + a[1] - b[1]]); this.updateCamera(); this.dirtyAll(); this.invalidate(); clearTimeout(this.wheelTimer); this.wheelTimer = setTimeout(() => this.fire('moveend', eventFor(e)), 100); }, { passive: false });
    canvas.addEventListener('dblclick', e => { if (!this.noDoubleClick) this.easeTo({ zoom: this.zoom + 1, center: Object.values(this.unproject(this.eventPoint(e))), originalEvent: e }); });
    canvas.addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '='].includes(e.key)) return; e.preventDefault(); if (['+', '-', '='].includes(e.key)) this.easeTo({ zoom: this.zoom + (e.key === '-' ? -1 : 1), originalEvent: e }); else { const c = mercator(this.center), dx = e.key === 'ArrowRight' ? 100 : e.key === 'ArrowLeft' ? -100 : 0, dy = e.key === 'ArrowUp' ? 100 : e.key === 'ArrowDown' ? -100 : 0; this.easeTo({ center: geographic([c[0] + dx / this.scale, c[1] + dy / this.scale]), originalEvent: e }); } });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.recover(new Error('Graphics context lost')); });
  }
  async recover(error) {
    if (this.removed || this.recovering) return;
    if (error) { this.lastRecoveryError = error.message; if (globalThis.UOS_SPACE_MAP_DEBUG) console.info('Space Map recovery:', error.stack || error.message); }
    this.recovering = true; this.generation++; this.backend = 'recovering'; this.disposeRenderer();
    const forced = globalThis.UOS_SPACE_MAP_BACKEND;
    if (this.attempt < 0 && forced === 'webgl') this.attempt = 0;
    if (this.attempt < 0 && forced === 'maplibre') this.attempt = 1;
    while (++this.attempt < 3 && !this.removed) {
      try {
        if (this.attempt === 2) { await this.startLegacy(); break; }
        const canvas = document.createElement('canvas'); this.canvas = canvas; this.container.prepend(canvas); this.bindCanvas(canvas);
        if (this.attempt === 0 && !navigator.gpu) throw new Error('WebGPU unavailable');
        this.scene = new Scene(); this.camera = new OrthographicCamera(-1, 1, 1, -1, .1, 1000);
        const renderer = new WebGPURenderer({ canvas, forceWebGL: this.attempt === 1, antialias: true, alpha: false }); this.renderer = renderer; this.rendererSize = null;
        // Pinned Three captures its automatic fallback in Renderer._getFallback.
        // Disable it so our explicit ladder advances exactly once per backend.
        if (this.attempt === 0) renderer._getFallback = null;
        renderer.onDeviceLost = info => { if (!this.removed && this.renderer === renderer) this.recover(new Error(info.message || 'GPU device lost')); };
        let initializationTimer;
        const initialization = renderer.init();
        initialization.then(() => { if (this.renderer !== renderer) disposeRenderer(renderer); }).catch(() => {});
        try { await Promise.race([initialization, new Promise((_, reject) => { initializationTimer = setTimeout(() => reject(new Error('Graphics initialization timed out')), 4000); })]); } finally { clearTimeout(initializationTimer); }
        // Observe loss directly as Three intentionally ignores explicitly destroyed devices.
        renderer.backend.device?.lost.then(info => { if (!this.removed && this.renderer === renderer && !this.recovering) this.recover(new Error(info.message || 'GPU device lost')); });
        this.backend = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2'; this.resize(); this.dirtyAll(); break;
      } catch (failure) { error = failure; this.disposeRenderer(); }
    }
    for (const ref of this.reference.values()) ref.dirty = true;
    this.recovering = false;
    if (this.removed) return;
    if (this.attempt >= 3) { this.backend = 'unavailable'; this.canvas = document.createElement('canvas'); this.canvas.hidden = true; this.container.prepend(this.canvas); this.fire('unavailable', { error }); return; }
    if (!this.loaded) { this.loaded = true; this.fire('load'); } else this.fire('rendererchange', { backend: this.backend });
    this.invalidate();
  }
  async startLegacy() {
    const api = await window.UOS.ProgramRuntime.ensureLegacyMap();
    const host = document.createElement('div'); Object.assign(host.style, { position: 'absolute', inset: '0' }); this.container.prepend(host); this.legacyHost = host;
    const sources = {}; for (const [id, s] of this.sources) sources[id] = s.type === 'geojson' ? { type: s.type, data: s.data } : { type: s.type, tiles: s.tiles, tileSize: s.tileSize, minzoom: s.minzoom, maxzoom: s.maxzoom, attribution: s.attribution };
    this.legacy = new api.Map({ container: host, center: this.center, zoom: this.zoom, style: { version: 8, sources, layers: this.layers } }); this.canvas = this.legacy.getCanvas();
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Legacy map timed out')), 8000); this.legacy.once('load', () => { clearTimeout(timer); resolve(); }); this.legacy.once('error', e => { clearTimeout(timer); reject(e.error); }); });
    this.backend = 'maplibre';
    this.attribution.hidden = true; this.dragPan.enabled ? this.legacy.dragPan.enable() : this.legacy.dragPan.disable();
    for (const name of ['click', 'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchmove', 'touchend', 'move', 'moveend', 'sourcedata', 'idle', 'error']) this.legacy.on(name, e => { const c = this.legacy.getCenter(); this.center = [c.lng, c.lat]; this.zoom = this.legacy.getZoom(); this.updateCamera(); this.dragPan.enabled ? this.legacy.dragPan.enable() : this.legacy.dragPan.disable(); this.fire(name, e); this.dragPan.enabled ? this.legacy.dragPan.enable() : this.legacy.dragPan.disable(); });
    this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.recover(new Error('Legacy context lost')); });
    this.syncLegacyReference();
  }
  disposeObject(id) { const objects = this.objects.get(id) || []; for (const o of objects) { this.scene?.remove(o); if (!o.isSprite) o.geometry?.dispose(); o.userData.buffer?.dispose(); o.material?.dispose(); } this.objects.delete(id); }
  disposeRenderer() { cancelAnimationFrame(this.pendingFrame); this.pendingFrame = 0; for (const id of this.objects.keys()) this.disposeObject(id); for (const [key, tile] of this.tiles) this.releaseTile(key, tile); disposeRenderer(this.renderer); this.renderer = null; this.scene = null; this.canvas?.remove(); this.canvas = null; this.legacy?.remove(); this.legacy = null; this.legacyHost?.remove(); this.legacyHost = null; }
  invalidate() { if (this.removed || this.recovering || this.backend === 'unavailable') return; if (this.rendering) { this.redraw = true; return; } if (!this.pendingFrame) this.pendingFrame = requestAnimationFrame(() => { this.pendingFrame = 0; this.render(); }); }
  makeMesh(vertices, material, order) { const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); const mesh = new Mesh(geometry, new MeshBasicMaterial({ ...material, depthTest: false, depthWrite: false, side: DoubleSide, transparent: material.opacity < 1 })); mesh.renderOrder = order; this.scene.add(mesh); return mesh; }
  makePoints(positions, radius, fill, opacity, order) {
    const attribute = new InstancedBufferAttribute(new Float32Array(positions), 3);
    const material = new PointsNodeMaterial({ size: radius * 2, sizeAttenuation: false, transparent: true, depthTest: false, depthWrite: false, positionNode: instancedBufferAttribute(attribute) });
    material.fragmentNode = vec4(color(fill), float(opacity).mul(float(1).sub(smoothstep(.45, .5, uv().sub(.5).length()))));
    const sprite = new Sprite(material); sprite.count = positions.length / 3; sprite.frustumCulled = false; sprite.renderOrder = order; sprite.userData.buffer = attribute; this.scene.add(sprite); return sprite;
  }
  rebuildLayer(layer, order) {
    this.disposeObject(layer.id); if (layer.layout?.visibility === 'none' || layer.type === 'background' || layer.type === 'raster') return;
    const source = this.sources.get(layer.source); if (!source?.data) return;
    const batches = new globalThis.Map(), p = layer.paint || {};
    const add = (key, kind, vertices, style) => { if (!vertices.length) return; if (!batches.has(key)) batches.set(key, { kind, vertices: [], style }); for (const value of vertices) batches.get(key).vertices.push(value); };
    for (const f of source.data.features || []) {
      if (layer.filter && !evaluate(layer.filter, f)) continue;
      const g = f.geometry;
      const prop = (name, fallback) => p[name] == null ? fallback : evaluate(p[name], f);
      if (layer.type === 'fill' && ['Polygon', 'MultiPolygon'].includes(g.type)) {
        const style = { color: prop('fill-color', '#12835e'), opacity: prop('fill-opacity', 1) };
        for (const polygon of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) { try { add(JSON.stringify(style), 'mesh', polygonBuffers(polygon, this.origin).vertices, style); } catch (_) { /* Controller retains invalid work geometry and displays its outline. */ } }
      } else if (layer.type === 'line') {
        const style = { color: prop('line-color', '#12835e'), opacity: prop('line-opacity', 1) };
        const rings = g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : g.type === 'LineString' ? [g.coordinates] : [];
        for (const ring of rings) add(JSON.stringify(style), 'mesh', dashedStrip(ring.map(mercator), prop('line-width', 1) / this.scale, this.origin, p['line-dasharray']), style);
      } else if (layer.type === 'circle' && g.type === 'Point') {
        const position = mercator(g.coordinates), radius = prop('circle-radius', 5), border = prop('circle-stroke-width', 0), fill = prop('circle-color', '#fff'), opacity = prop('circle-opacity', 1);
        if (border && prop('circle-stroke-opacity', 1)) add(`border:${radius}:${border}:${prop('circle-stroke-color', '#fff')}`, 'points', [position[0] - this.origin[0], position[1] - this.origin[1], 0], { radius: radius + border, fill: prop('circle-stroke-color', '#fff'), opacity: prop('circle-stroke-opacity', 1), subOrder: 0 });
        if (opacity) add(`fill:${radius}:${fill}:${opacity}`, 'points', [position[0] - this.origin[0], position[1] - this.origin[1], 0], { radius, fill, opacity, subOrder: 1 });
      }
    }
    const objects = []; for (const batch of batches.values()) objects.push(batch.kind === 'mesh' ? this.makeMesh(batch.vertices, batch.style, order) : this.makePoints(batch.vertices, batch.style.radius, batch.style.fill, batch.style.opacity, order + batch.style.subOrder * .01)); this.objects.set(layer.id, objects);
  }
  async render() {
    if (!this.renderer || !this.scene || this.removed || this.recovering) return;
    this.rendering = true; const generation = this.generation;
    try {
      const background = this.layers.find(l => l.type === 'background'); this.scene.background = new Color(background?.paint?.['background-color'] || '#f7f9fd');
      for (let i = 0; i < this.layers.length; i++) if (this.dirtySources.has(this.layers[i].source)) this.rebuildLayer(this.layers[i], this.layers[i].source === 'uos-grid' ? 0 : 100 + i);
      this.dirtySources.clear(); this.renderReference(); this.renderTiles(); this.renderer.render(this.scene, this.camera); if (generation === this.generation) this.fire('idle');
    } catch (error) { if (generation === this.generation) queueMicrotask(() => this.recover(error)); }
    finally { this.rendering = false; if (this.redraw) { this.redraw = false; this.invalidate(); } }
  }
  renderTiles() {
    const layer = this.layers.find(l => l.type === 'raster' && l.layout?.visibility !== 'none'), source = layer && this.sources.get(layer.source); const visible = new Set();
    const attribution = source?.attribution || ''; if (this.attribution.textContent !== attribution) this.attribution.textContent = attribution; this.attribution.hidden = !attribution;
    if (source) {
      // Camera zoom uses a 512px world tile. Raster sources may supply 256px
      // tiles; select their native resolution, including physical canvas pixels.
      const minZoom = source.minzoom ?? 0, maxZoom = source.maxzoom ?? 22;
      let z = Math.max(minZoom, Math.min(maxZoom, Math.ceil(this.zoom + Math.log2(512 * this.ratio / (source.tileSize || 512)))));
      const center = mercator(this.center);
      let n, size, x0, x1, y0, y1;
      do {
        n = 2 ** z; size = WORLD / n;
        x0 = Math.floor((center[0] - this.width / (2 * this.scale) + WORLD / 2) / size); x1 = Math.floor((center[0] + this.width / (2 * this.scale) + WORLD / 2) / size);
        y0 = Math.max(0, Math.floor((WORLD / 2 - center[1] - this.height / (2 * this.scale)) / size)); y1 = Math.min(n - 1, Math.floor((WORLD / 2 - center[1] + this.height / (2 * this.scale)) / size));
        if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 128 || z === minZoom) break;
        z--;
      } while (true);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const key = `${layer.source}:${z}:${x}:${y}`; visible.add(key); let tile = this.tiles.get(key);
        if (!tile) { tile = { source: layer.source, touched: performance.now() }; this.tiles.set(key, tile); this.fetchTile(key, tile, source, z, ((x % n) + n) % n, y, x, size); }
        tile.touched = performance.now(); if (tile.mesh) tile.mesh.visible = true;
      }
    }
    for (const [key, t] of this.tiles) { if (t.mesh) t.mesh.visible = visible.has(key); if (t.source !== layer?.source && !t.texture) { t.abort?.abort(); this.tiles.delete(key); } }
    while (this.tiles.size > 128) { const entry = [...this.tiles].filter(([key]) => !visible.has(key)).sort((a, b) => a[1].touched - b[1].touched)[0]; if (!entry) break; this.releaseTile(...entry); }
  }
  releaseTile(key, t) { t.abort?.abort(); t.texture?.dispose(); t.bitmap?.close(); if (t.mesh) { this.scene?.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); } this.tiles.delete(key); }
  async fetchTile(key, tile, source, z, x, y, worldX, size) {
    const generation = this.generation; tile.abort = new AbortController(); const timer = setTimeout(() => tile.abort.abort(), 8000);
    try {
      const url = source.tiles[(x + y) % source.tiles.length].replaceAll('{z}', z).replaceAll('{x}', x).replaceAll('{y}', y); const response = await fetch(url, { signal: tile.abort.signal }); if (!response.ok) throw new Error('Basemap tile unavailable');
      const bitmap = await createImageBitmap(await response.blob()); if (this.removed || generation !== this.generation || this.tiles.get(key) !== tile) { bitmap.close(); return; }
      const texture = new CanvasTexture(bitmap); texture.colorSpace = SRGBColorSpace; const geometry = new PlaneGeometry(size + .001, size + .001), material = new MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false }); const mesh = new Mesh(geometry, material); mesh.position.set(-WORLD / 2 + (worldX + .5) * size - this.origin[0], WORLD / 2 - (y + .5) * size - this.origin[1], 0); mesh.renderOrder = -100; tile.texture = texture; tile.bitmap = bitmap; tile.mesh = mesh; this.scene.add(mesh); this.fire('sourcedata', { sourceId: tile.source, isSourceLoaded: true }); this.invalidate();
    } catch (error) { if (generation === this.generation && this.sources.has(tile.source) && !tile.abort.signal.aborted) this.fire('error', { sourceId: tile.source, error }); }
    finally { clearTimeout(timer); }
  }
  queryRenderedFeatures(point, options = {}) {
    if (this.legacy) return this.legacy.queryRenderedFeatures(point, options);
    const isBox = Array.isArray(point) && Array.isArray(point[0]), p = isBox ? { x: (point[0][0] + point[1][0]) / 2, y: (point[0][1] + point[1][1]) / 2 } : Array.isArray(point) ? { x: point[0], y: point[1] } : point;
    const radius = isBox ? Math.max(point[1][0] - point[0][0], point[1][1] - point[0][1]) / 2 : 0, hits = [];
    for (const id of options.layers || this.layers.map(l => l.id)) {
      const l = this.getLayer(id); if (!l || l.layout?.visibility === 'none' || id.startsWith('reference-')) continue;
      for (const f of this.sources.get(l.source)?.data?.features || []) {
        if (l.filter && !evaluate(l.filter, f)) continue;
        if (f.geometry.type === 'Point') { const c = this.project(f.geometry.coordinates); if (Math.hypot(c.x - p.x, c.y - p.y) <= radius + (evaluate(l.paint?.['circle-radius'], f) || 7)) hits.push({ ...f, layer: l }); }
        // Work polygon/line hit testing remains in the authoritative controller.
      }
    }
    return hits;
  }
  setReferenceLayer(id, payload) { if (payload?.signature && this.reference.get(id)?.payload.signature === payload.signature) return; this.clearReferenceLayer(id); if (payload) this.reference.set(id, { payload, dirty: true }); this.syncLegacyReference(); this.invalidate(); }
  clearReferenceLayer(id) { this.reference.delete(id); this.disposeObject(`reference-${id}`); if (this.legacy) for (const suffix of ['points', 'fill', 'outline', 'casing']) { const layer = `reference-${id}-${suffix}`; if (this.legacy.getLayer(layer)) this.legacy.removeLayer(layer); } if (this.legacy?.getSource(`reference-${id}`)) this.legacy.removeSource(`reference-${id}`); this.invalidate(); }
  renderReference() {
    for (const [id, ref] of this.reference) {
      if (!ref.dirty) continue; ref.dirty = false; this.disposeObject(`reference-${id}`); const objects = [], p = ref.payload, offset = [p.origin[0] - this.origin[0], p.origin[1] - this.origin[1]];
      const shifted = array => { const out = new Float32Array(array); for (let i = 0; i < out.length; i += 3) { out[i] += offset[0]; out[i + 1] += offset[1]; } return out; };
      if (p.points?.length) {
        if (p.highlight) objects.push(this.makePoints(shifted(p.points), 9, '#10233f', 1, 34));
        objects.push(this.makePoints(shifted(p.points), p.highlight ? 6 : 2, p.highlight ? '#ffde59' : '#ffffff', 1, p.highlight ? 35 : 30));
      }
      for (const batch of p.batches || []) {
 objects.push(this.makeMesh(shifted(batch.fill), { color: batch.color, opacity: .25 }, p.highlight ? 31 : id === 'tpz' ? 10 : 20));
 for (const stroke of p.highlight ? [{color:'#10233f',width:6,order:32},{color:'#ffde59',width:3,order:33}] : [{color:'#ffffff',width:.5,order:id === 'tpz' ? 11 : 21}]) {
        const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(shifted(batch.outlineBase), 3)); geometry.setAttribute('edgeOffset', new Float32BufferAttribute(batch.outlineOffset, 2));
 const material = new MeshBasicNodeMaterial({ color: stroke.color, opacity: p.highlight ? 1 : .25, transparent: true, depthTest: false, depthWrite: false, side: DoubleSide }); material.positionNode = positionLocal.add(vec3(attribute('edgeOffset', 'vec2').mul(this.outlineScale).mul(stroke.width), 0));
        const outline = new Mesh(geometry, material); outline.renderOrder = stroke.order; this.scene.add(outline); objects.push(outline);
        }
      }
      this.objects.set(`reference-${id}`, objects);
    }
  }
  syncLegacyReference() {
    if (!this.legacy || this.backend !== 'maplibre') return;
    for (const [id, ref] of [...this.reference].sort((a, b) => ['tpz', 'srz', 'trees'].indexOf(a[0]) - ['tpz', 'srz', 'trees'].indexOf(b[0]))) {
      addLegacyReference(this.legacy, id, ref.payload);
    }
  }
  getResourceMetrics() { let bytes = 0; for (const [id, objects] of this.objects) if (id.startsWith('reference-')) for (const o of objects) bytes += o.userData.buffer?.array.byteLength || Object.values(o.geometry?.attributes || {}).reduce((n, a) => n + a.array.byteLength, 0); return { backend: this.backend, referenceGpuBytes: bytes, tiles: this.tiles.size, canvasPixels: Math.round(this.width * this.height * this.ratio ** 2), pixelRatio: this.ratio, referenceLayers: [...this.reference.keys()] }; }
  remove() { this.removed = true; clearTimeout(this.wheelTimer); this.resizeObserver.disconnect(); this.disposeRenderer(); for (const m of [...this.markers]) m.remove(); this.overlay.remove(); this.attribution.remove(); this.controls.forEach(c => c.remove()); this.handlers = {}; }
}
