import { installLegacyReference } from './legacy-reference.mjs';
const SERVICE = 'https://services.arcgis.com/BzylpWnjWP0tW4nL/arcgis/rest/services/Forestree_TPZ_and_SRZ/FeatureServer';
const LAYERS = { trees: { service: 0, zoom: 16 }, srz: { service: 1, zoom: 17 }, tpz: { service: 2, zoom: 17 } };
const MAX_RESPONSE = 4 * 1024 * 1024;
export class TreeLayers {
  constructor(map, options = {}) {
    installLegacyReference(map);
    this.map = map; this.service = options.service || SERVICE; this.workerUrl = options.workerUrl; this.createWorker = options.createWorker || (() => new Worker(this.workerUrl, { type: 'module', name: 'space-map-tree-geometry' })); this.workerGeneration = 0; this.status = options.onStatus || (() => {}); this.failed = new Map();
    this.enabled = { trees: false, srz: false, tpz: false }; this.visible = false; this.revision = 0; this.controllers = new Set(); this.queue = []; this.active = 0; this.sequence = 0; this.pending = new Map(); this.cells = new Map(); this.metadata = new Map(); this.metrics = { requests: 0, active: 0, peakRequests: 0, cacheBytes: 0, staleResults: 0 }; this.renderKeys = new Map();
  }
  async ensureWorker() {
    if (this.worker) return this.worker;
    if (this.workerPending) return this.workerPending;
    const generation = this.workerGeneration;
    const pending = Promise.resolve().then(() => this.createWorker()).then(worker => {
    if (generation !== this.workerGeneration) { worker.terminate(); throw new DOMException('Obsolete tree worker', 'AbortError'); }
    this.worker = worker;
    this.worker.onmessage = ({ data }) => { this.metrics.cacheBytes = data.cacheBytes ?? this.metrics.cacheBytes; const task = this.pending.get(data.token); if (!task) { this.metrics.staleResults++; return; } this.pending.delete(data.token); clearTimeout(task.timer); if (data.type === 'error') { const error = new Error(data.message); error.limit = data.limit; error.permanent = true; task.reject(error); } else task.resolve(data); };
    this.worker.onerror = () => { this.stopWorker(new Error('Tree geometry worker unavailable')); for (const id of Object.keys(LAYERS)) if (this.enabled[id]) { this.map.clearReferenceLayer(id); this.failed.set(id, { limit: false, zoom: this.map.getZoom() }); this.status(id, 'Tree geometry unavailable. Toggle layer to retry.'); } };
    return worker;
    }).finally(() => { if (this.workerPending === pending) this.workerPending = null; });
    this.workerPending = pending; return pending;
  }
  async work(message, transfer = []) {
    const worker = await this.ensureWorker(), token = ++this.sequence;
    if (worker !== this.worker) throw new DOMException('Obsolete tree worker', 'AbortError');
    return new Promise((resolve, reject) => { const timer = setTimeout(() => { this.pending.delete(token); const error = new Error('Tree geometry processing timed out'); error.permanent = true; reject(error); }, 8000); this.pending.set(token, { resolve, reject, timer }); worker.postMessage({ ...message, token }, transfer); });
  }
  stopWorker(error = new DOMException('Obsolete tree request', 'AbortError')) { this.workerGeneration++; this.workerPending = null; this.worker?.terminate(); this.worker = null; for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(error); } this.pending.clear(); this.cells.clear(); this.renderKeys.clear(); this.metrics.cacheBytes = 0; }
  cancel() { for (const c of this.controllers) c.abort(); this.controllers.clear(); for (const item of this.queue.splice(0)) item.reject(new DOMException('Obsolete viewport', 'AbortError')); }
  cancelLayer(layer) { for (const c of this.controllers) if (c.layer === layer) c.abort(); const remaining = []; for (const item of this.queue) { if (item.layer === layer) item.reject(new DOMException('Layer request cancelled', 'AbortError')); else remaining.push(item); } this.queue = remaining; }
  update(enabled, visible) {
    const previous = this.enabled; this.enabled = { ...enabled }; this.visible = visible; this.revision++; const revision = this.revision; clearTimeout(this.timer); this.cancel();
    for (const id of Object.keys(LAYERS)) if (!this.enabled[id] || !previous[id]) this.failed.delete(id);
    for (const id of Object.keys(LAYERS)) {
      if (!this.enabled[id]) { this.map.clearReferenceLayer(id); this.renderKeys.delete(id); if (previous[id] && this.worker) this.work({ type: 'clear', layer: id }).catch(() => {}); for (const [key] of this.cells) if (key.startsWith(id + ':')) this.cells.delete(key); this.status(id, 'Off'); }
      else if (!visible) { this.map.clearReferenceLayer(id); this.renderKeys.delete(id); this.status(id, 'Map hidden'); }
      else if (this.map.getZoom() < LAYERS[id].zoom) { this.map.clearReferenceLayer(id); this.renderKeys.delete(id); this.status(id, 'Zoom in to view'); }
    }
    if (!Object.values(this.enabled).some(Boolean)) { this.stopWorker(); return; }
    if (!visible || !Object.keys(LAYERS).some(id => this.enabled[id] && this.map.getZoom() >= LAYERS[id].zoom)) return;
    this.timer = setTimeout(() => this.loadViewport(revision), 200);
  }
  valid(revision, id) { return revision === this.revision && this.visible && this.enabled[id] && this.map.getZoom() >= LAYERS[id].zoom; }
  schedule(task, revision, layer) {
    return new Promise((resolve, reject) => { this.queue.push({ task, revision, layer, resolve, reject }); this.pump(); });
  }
  pump() { while (this.active < 4 && this.queue.length) { const job = this.queue.shift(); if (job.revision !== this.revision) { job.reject(new DOMException('Obsolete viewport', 'AbortError')); continue; } this.active++; this.metrics.active = this.active; this.metrics.peakRequests = Math.max(this.metrics.peakRequests, this.active); Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => { this.active--; this.metrics.active = this.active; this.pump(); }); } }
  async fetchBytes(url, revision, layer) {
    return this.schedule(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (revision !== this.revision) throw new DOMException('Obsolete viewport', 'AbortError');
        const controller = new AbortController(); controller.layer = layer; this.controllers.add(controller); let timedOut = false; const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 8000);
        try {
          this.metrics.requests++; const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) { const error = new Error('Tree service unavailable'); error.permanent = response.status >= 400 && response.status < 500 && response.status !== 429; throw error; }
          if (Number(response.headers.get('content-length')) > MAX_RESPONSE) { const error = new Error('Tree response budget exhausted'); error.limit = error.permanent = true; throw error; }
          const reader = response.body.getReader(), parts = []; let length = 0;
          while (true) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > MAX_RESPONSE) { await reader.cancel(); const error = new Error('Tree response budget exhausted'); error.limit = error.permanent = true; throw error; } parts.push(value); }
          const bytes = new Uint8Array(length); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; } return bytes.buffer;
        } catch (error) { if (error.permanent || (controller.signal.aborted && !timedOut) || attempt === 2) throw error; }
        finally { clearTimeout(timer); this.controllers.delete(controller); }
      }
    }, revision, layer);
  }
  async colors(id, revision) {
    if (this.metadata.has(id)) return this.metadata.get(id);
    if (id === 'trees') return { colors: {}, defaultColor: '#ffffff' };
    const buffer = await this.fetchBytes(`${this.service}/${LAYERS[id].service}?f=pjson`, revision, id), metadata = JSON.parse(new TextDecoder().decode(buffer));
    const renderer = metadata.drawingInfo?.renderer;
    if (metadata.error || !renderer) { const e = new Error('Tree service colors unavailable'); e.permanent = true; throw e; }
    const hex = rgb => '#' + rgb.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('');
    const result = { colors: Object.fromEntries((renderer.uniqueValueInfos || []).map(info => [info.value, hex(info.symbol.color)])), defaultColor: hex(renderer.defaultSymbol?.color || renderer.symbol?.color || [202, 0, 32]) }; this.metadata.set(id, result); return result;
  }
  viewportCells() {
    const bounds = this.map.getBounds(), sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    // Stable WGS84 cells at the current screen scale, clipped to legal geographic bounds.
    const step = 360 / 2 ** Math.floor(this.map.getZoom()), cells = [];
    for (let x = Math.floor(sw.lng / step); x <= Math.floor(ne.lng / step); x++) for (let y = Math.floor(sw.lat / step); y <= Math.floor(ne.lat / step); y++) {
      if (cells.length >= 256) { const e = new Error('Viewport cell budget exhausted'); e.limit = true; throw e; }
      cells.push({ key: `${step}:${x}:${y}`, bounds: [Math.max(-180, x * step), Math.max(-90, y * step), Math.min(180, (x + 1) * step), Math.min(90, (y + 1) * step)] });
    }
    return cells;
  }
  async cell(id, cell, revision, depth = 0) {
    const key = `${id}:${cell.key}`; if (this.cells.has(key)) return this.cells.get(key);
    this.cellCounts[id] = (this.cellCounts[id] || 0) + 1;
    if (this.cellCounts[id] > 512) throw Object.assign(new Error('Viewport subdivision budget exhausted'), { limit: true });
    const [xmin, ymin, xmax, ymax] = cell.bounds, params = new URLSearchParams({ f: 'geojson', where: '1=1', outFields: id === 'trees' ? 'OBJECTID' : 'OBJECTID,risk', returnGeometry: 'true', outSR: '4326', inSR: '4326', geometryType: 'esriGeometryEnvelope', geometry: JSON.stringify({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } }), spatialRel: 'esriSpatialRelIntersects' });
    const buffer = await this.fetchBytes(`${this.service}/${LAYERS[id].service}/query?${params}`, revision, id);
    if (!this.valid(revision, id)) throw new DOMException('Obsolete viewport', 'AbortError');
    const result = await this.work({ type: 'cell', layer: id, key, buffer }, [buffer]);
    if (!this.valid(revision, id)) { this.metrics.staleResults++; throw new DOMException('Obsolete viewport', 'AbortError'); }
    let keys = [key];
    if (result.limited) {
      if (depth >= 8) { const error = new Error('Tree service density exceeds cell budget'); error.limit = true; throw error; }
      const mx = (xmin + xmax) / 2, my = (ymin + ymax) / 2;
      keys = (await Promise.all([[xmin, ymin, mx, my], [mx, ymin, xmax, my], [xmin, my, mx, ymax], [mx, my, xmax, ymax]].map((bounds, i) => this.cell(id, { key: cell.key + '/' + i, bounds }, revision, depth + 1)))).flat();
    }
    this.cells.set(key, keys); while (this.cells.size > 2048) this.cells.delete(this.cells.keys().next().value); return keys;
  }
  async loadViewport(revision) {
    this.cellCounts = {};
    let cells;
    try { cells = this.viewportCells(); } catch (error) { for (const id of Object.keys(LAYERS)) if (this.valid(revision, id)) this.status(id, 'Zoom closer to view'); return; }
    await Promise.all(Object.keys(LAYERS).map(async id => {
      if (!this.valid(revision, id)) return;
      const failure = this.failed.get(id);
      if (failure && (!failure.limit || this.map.getZoom() <= failure.zoom)) { this.status(id, failure.limit ? 'Zoom closer to view' : 'Service unavailable. Toggle layer to retry.'); return; }
      this.failed.delete(id);
      this.status(id, 'Loading…');
      try {
        const colors = await this.colors(id, revision), keys = (await Promise.all(cells.map(cell => this.cell(id, cell, revision)))).flat();
        if (!this.valid(revision, id)) return;
        const sw = this.map.getBounds().getSouthWest(), ne = this.map.getBounds().getNorthEast(), bounds = [sw.lng, sw.lat, ne.lng, ne.lat];
        const renderKey = JSON.stringify([keys, Math.floor(this.map.getZoom() * 10), bounds]);
        if (this.renderKeys.get(id) === renderKey) { this.status(id, 'Visible'); return; }
        const lat = Math.max(-85, Math.min(85, this.map.getCenter().lat)) * Math.PI / 180, origin = [this.map.getCenter().lng / 360 * 40075016.68557849, Math.log(Math.tan(Math.PI / 4 + lat / 2)) * 40075016.68557849 / (2 * Math.PI)];
        let result = await this.work({ type: 'build', layer: id, keys, origin, bounds, tolerance: 40075016.68557849 / (512 * 2 ** this.map.getZoom()) * .2, ...colors });
        if (result.missing) { for (const cell of cells) this.cells.delete(`${id}:${cell.key}`); throw Object.assign(new Error('Tree cache budget exhausted; zoom closer to view'), { limit: true }); }
        if (!this.valid(revision, id)) { this.metrics.staleResults++; return; }
        this.map.setReferenceLayer(id, result.payload); this.renderKeys.set(id, renderKey); this.status(id, `${result.payload.count.toLocaleString()} visible`);
      } catch (error) {
        if (!this.valid(revision, id) || error.name === 'AbortError') return;
        this.map.clearReferenceLayer(id); this.renderKeys.delete(id); this.status(id, error.limit ? 'Zoom closer to view' : 'Service unavailable. Toggle layer to retry.');
        this.failed.set(id, { limit: !!error.limit, zoom: this.map.getZoom() });
        this.cancelLayer(id);
        if (this.worker) this.work({ type: 'clear', layer: id }).catch(() => {});
        for (const key of this.cells.keys()) if (key.startsWith(id + ':')) this.cells.delete(key);
      }
    }));
  }
  destroy() { clearTimeout(this.timer); this.revision++; this.cancel(); this.stopWorker(); for (const id of Object.keys(LAYERS)) this.map.clearReferenceLayer(id); }
  getMetrics() { return { ...this.metrics, worker: !!this.worker, enabled: { ...this.enabled } }; }
}
