const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');
test.use({ screenshot: 'off', trace: 'off', video: 'off', launchOptions: { args: ['--use-angle=swiftshader'] } });

async function open(page, owner = 'NSA', backend = 'maplibre') {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(value => { window.UOS_SPACE_MAP_BACKEND = value; }, backend);
  await page.goto('/src/program-planner/' + (owner === 'NSA' ? 'nsa' : 'events') + '.html');
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  await frame.evaluate(async owner => {
    UOS_REMEDIATION_MAP_CONFIG.defaultProvider = 'offline';
    UOS_REMEDIATION_MAP_CONFIG.providerTimeoutMs = 600;
    await UOS.ProgramApp.updateWorkspace(w => {
      const id = owner + (owner === 'NSA' ? '-APP-' : '-EVENT-') + 'AUDIT-FIX';
      w.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id, owner, title: 'Audit regression', status: 'received', dateReceived: '2026-10-16' });
      const result = UOS.ProgramModel.promoteRegisterRecord(w, id);
      w = result.workspace; w.workspace.selectedEntityId = id; w.workspace.selectedProjectId = result.project.id;
      return w;
    });
  }, owner);
  return frame;
}

for (const owner of ['NSA', 'EVT']) test(owner + ': native raster survives its watchdog; failed raster falls back', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 }));
  const frame = await open(page, owner);
  await frame.evaluate(() => UOS.ProgramApp.navigate('map'));
  await frame.waitForFunction(() => UOS.ProgramMapController.getMapController()?.ready());
  const png = Buffer.from(await frame.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 2; c.getContext('2d').fillRect(0, 0, 2, 2); return c.toDataURL().split(',')[1]; }), 'base64');
  const tiles = new Set();
  await page.route('https://audit-tiles.test/**', route => { tiles.add(route.request().url()); return route.fulfill({ body: png, contentType: 'image/png' }); });
  await frame.evaluate(() => {
    UOS_REMEDIATION_MAP_CONFIG.providers.push({ id: 'audit', tileSize: 256, tiles: ['https://audit-tiles.test/{z}/{x}/{y}.png'] });
    UOS.ProgramMapController.getMapController().setProvider('audit');
  });
  await frame.waitForFunction(() => UOS.ProgramMapController.getMapController().getRendererAdapter().isSourceLoaded('uos-basemap'));
  // Deliberately cross the watchdog deadline to prove successful load cancels it.
  await page.waitForTimeout(750);
  expect(await frame.evaluate(() => {
    const a = UOS.ProgramMapController.getMapController().getRendererAdapter();
    let enables = 0, updates = 0;
    const en = a.legacy.dragPan.enable.bind(a.legacy.dragPan), update = a.updateCamera.bind(a);
    a.legacy.dragPan.enable = (...args) => { enables++; return en(...args); };
    a.updateCamera = (...args) => { updates++; return update(...args); };
    for (let i = 0; i < 20; i++) a.legacy.fire('mousemove', { point: { x: 10, y: 10 }, lngLat: a.legacy.getCenter() });
    return { present: !!a.getSource('uos-basemap'), ready: a.isSourceLoaded('uos-basemap'), enables, updates };
  })).toEqual({ present: true, ready: true, enables: 0, updates: 0 });
  const initialTiles = tiles.size;
  await frame.evaluate(() => { const a = UOS.ProgramMapController.getMapController().getRendererAdapter(); a.legacy.jumpTo({ center: [a.getCenter().lng + .01, a.getCenter().lat], zoom: a.getZoom() + 1 }); });
  await expect.poll(() => tiles.size).toBeGreaterThan(initialTiles);
  const metrics = await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererMetrics());
  expect(metrics.activeTiles).toBeGreaterThan(0); expect(metrics.referenceGpuBytes).toBeNull();
  expect(metrics.pixelRatio).toBeLessThanOrEqual(2); expect(metrics.pixelRatio).toBeGreaterThan(1); expect(metrics.tileCacheLimit).toBe(128);
  await page.setViewportSize({ width: 2600, height: 2000 });
  await expect.poll(() => frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererMetrics().canvasPixels)).toBeLessThanOrEqual(4000000);
  await frame.evaluate(() => {
    const a = UOS.ProgramMapController.getMapController().getRendererAdapter();
    a.dragPan.disable(); a.doubleClickZoom.disable();
    if (a.legacy.dragPan.isEnabled() || a.legacy.doubleClickZoom.isEnabled()) throw Error('Native gesture state did not follow adapter');
    a.dragPan.enable(); a.doubleClickZoom.enable();
  });
  await page.route('https://failed-audit-tiles.test/**', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await frame.evaluate(() => {
    UOS_REMEDIATION_MAP_CONFIG.providers.push({ id: 'audit-failure', tileSize: 256, tiles: ['https://failed-audit-tiles.test/{z}/{x}/{y}.png'] });
    UOS.ProgramMapController.getMapController().setProvider('audit-failure');
  });
  await frame.waitForFunction(() => !UOS.ProgramMapController.getMapController().getRendererAdapter().getSource('uos-basemap'));
  expect(errors).toEqual([]);
});

test('catalog owns accessible labels without accumulating observers', async ({ page }) => {
  await page.addInitScript(() => {
    window.catalogObservers = 0;
    const observe = MutationObserver.prototype.observe;
    MutationObserver.prototype.observe = function (target, options) {
      if (target.matches?.('[data-costing-catalog-body]')) window.catalogObservers++;
      return observe.call(this, target, options);
    };
  });
  const frame = await open(page);
  for (const module of ['costing', 'register', 'quotes', 'register', 'costing', 'register', 'costing']) await frame.evaluate(module => UOS.ProgramApp.navigate(module), module);
  expect(await frame.evaluate(() => window.catalogObservers)).toBe(0);
  const row = frame.locator('[data-costing-catalog-body] tr').first();
  await expect(row).toBeVisible();
  const category = row.locator('[data-rate-category]');
  expect(await category.getAttribute('aria-label')).toBe('Category: ' + await category.getAttribute('data-category-full-label'));
  await expect(row.locator('[data-costing-edit-rate]')).toHaveAttribute('data-uos-tooltip', /Edit/);
});

for (const owner of ['NSA', 'EVT']) test(owner + ': quote adjustments roll back, snapshots disclose source changes and Declined receipts stay disabled', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const frame = await open(page, owner);
  const id = await frame.evaluate(async owner => {
    let quoteId;
    await UOS.ProgramApp.updateWorkspace(w => {
      const projectId = w.workspace.selectedProjectId;
      w.entities.costingLines.push({ id: owner + '-COST-QUOTE-AUDIT', owner, type: 'costingLine', projectId, description: 'Original source', kind: 'Material', quantity: 1, unit: 'item', unitRate: 100, estimatedTotal: 100 });
      w = UOS.ProgramQuotes.saveDraft(w, { projectId, quoteDate: '2026-10-16', fundingMode: 'customer' });
      quoteId = w.entities.quotes[0].id; return w;
    });
    await UOS.ProgramApp.navigate('quotes'); return quoteId;
  }, owner);
  const add = frame.locator('[data-add-line]');
  await expect(add).toBeEnabled();
  await frame.evaluate(() => {
    const save = UOS.ProgramStorage.saveValidated;
    UOS.ProgramStorage.saveValidated = function () { UOS.ProgramStorage.saveValidated = save; return Promise.reject(new Error('Synthetic persistence failure')); };
  });
  await add.click();
  const dialog = frame.getByRole('dialog');
  await expect(dialog).toContainText('Quote adjustment not saved');
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(add).toBeEnabled();
  expect(await frame.evaluate(id => UOS.ProgramApp.workspace().entities.quoteLines.filter(l => l.quoteId === id).length, id)).toBe(1);
  await expect(frame.locator('[data-remove-line]')).toHaveCount(0);
  await frame.evaluate(() => UOS.ProgramApp.updateWorkspace(w => { w.entities.costingLines[0].quantity = 2; w.entities.costingLines[0].estimatedTotal = 200; return w; }));
  const notice = frame.locator('[data-quote-source-changes]');
  await expect(notice).toBeVisible(); await expect(notice.locator('summary')).toContainText('1 changed');
  expect(await frame.evaluate(id => UOS.ProgramApp.workspace().entities.quotes.find(q => q.id === id).subtotal, id)).toBe(100);
  await frame.locator('[data-quote-refresh]').click();
  await expect(notice).toBeHidden();
  expect(await frame.evaluate(id => UOS.ProgramApp.workspace().entities.quotes.find(q => q.id === id).subtotal, id)).toBe(200);
  await frame.evaluate(id => UOS.ProgramApp.updateWorkspace(w => UOS.ProgramQuotes.decline(UOS.ProgramQuotes.issue(w, id), id)), id);
  await expect(add).toBeDisabled(); await expect(add).not.toHaveClass(/uos-button--primary/);
  for (const selector of ['[data-deposit-record]', '[data-payment-record]']) {
    const button = frame.locator(selector); await expect(button).toBeDisabled(); await expect(button).not.toHaveClass(/uos-button--primary/);
  }
  await add.dispatchEvent('click');
  expect(await frame.evaluate(id => UOS.ProgramApp.workspace().entities.quoteLines.filter(l => l.quoteId === id).length, id)).toBe(1);
  expect(errors).toEqual([]);
});

test('mutation metadata identifies changed collections and shares defensive event aliases', async ({ page }) => {
  const frame = await open(page);
  expect(await frame.evaluate(async () => {
    let ready, changed;
    function onReady(e) { ready = e.detail; }
    function onChanged(e) { changed = e.detail; }
    document.addEventListener('uos:program-ready', onReady); document.addEventListener('uos:workspace-changed', onChanged);
    try {
      await UOS.ProgramApp.updateWorkspace(w => { w.entities.projects[0].title = 'Metadata regression'; return w; });
      const first = changed, sameChange = ready.changeId === changed.changeId;
      await UOS.ProgramApp.updateWorkspace(w => { w.workspace.searchQuery = 'UI only'; return w; });
      const stableRevision = first.collectionRevisions.projects === changed.collectionRevisions.projects;
      changed.workspace.entities.projects[0].title = 'Event consumer edit';
      return { sameChange, aliases: changed.workspace === changed.after, changedCollections: Object.keys(first.changed), stableRevision, isolated: UOS.ProgramApp.workspace().entities.projects[0].title === 'Metadata regression' };
    } finally { document.removeEventListener('uos:program-ready', onReady); document.removeEventListener('uos:workspace-changed', onChanged); }
  })).toEqual({ sameChange: true, aliases: true, changedCollections: ['projects'], stableRevision: true, isolated: true });
});

for (const backend of ['webgl', 'maplibre']) test(backend + ': pooled measurement labels retain positioning classes and DOM identity', async ({ page }) => {
  const frame = await open(page, 'NSA', backend);
  await frame.evaluate(async () => {
    await UOS.ProgramApp.updateWorkspace(w => UOS.WorkAreaService.createGeometry(w, w.workspace.selectedProjectId, {
      geometry: { type: 'Polygon', coordinates: [[[138.600,-34.922],[138.601,-34.922],[138.601,-34.923],[138.600,-34.922]]] },
      payload: { visible: true, workTypeKey: 'turfing' }
    }));
    await UOS.ProgramApp.navigate('map');
  });
  await frame.waitForFunction(() => UOS.ProgramMapController.getMapController()?.ready());
  await frame.locator('[data-space-mode="projects"]').click();
  await expect.poll(() => frame.locator('.rem-map-measure-label').count()).toBeGreaterThan(0);
  await frame.evaluate(() => { window.pooledLabelProof = [...document.querySelectorAll('.rem-map-measure-label')]; });
  await frame.evaluate(() => { const m = UOS.ProgramMapController.getMapController().getRendererAdapter(); m.fire('moveend'); m.fire('moveend'); });
  expect(await frame.evaluate(() => {
    const now = [...document.querySelectorAll('.rem-map-measure-label')];
    return now.length === pooledLabelProof.length && now.every((node, i) => node === pooledLabelProof[i] && node.classList.contains('maplibregl-marker'));
  })).toBe(true);
});

test('pending Quote adjustment protects existing edits and rolls back only its added row', async ({ page }) => {
  const frame = await open(page);
  await frame.evaluate(async () => {
    await UOS.ProgramApp.updateWorkspace(w => UOS.ProgramQuotes.saveDraft(w, { projectId: w.workspace.selectedProjectId, fundingMode: 'customer', customLines: [{ id:'EXISTING', description:'Existing adjustment', quantity:2, rate:10 }] }));
    await UOS.ProgramApp.navigate('quotes');
    const save = UOS.ProgramStorage.saveValidated;
    UOS.ProgramStorage.saveValidated = function () { UOS.ProgramStorage.saveValidated = save; return new Promise((_, reject) => { window.rejectAdjustment = reject; }); };
  });
  const existing = frame.locator('[data-line-field="description"][value="Existing adjustment"]');
  await expect(existing).toBeEnabled();
  await frame.locator('[data-add-line]').click();
  await expect(existing).toBeDisabled();
  await expect(frame.locator('[data-deposit-record]')).toBeDisabled();
  await expect(frame.locator('[data-quote-save]')).toBeDisabled();
  await expect(frame.locator('[data-operational-amount]')).toBeDisabled();
  await frame.evaluate(() => window.rejectAdjustment(new Error('Delayed synthetic failure')));
  const dialog = frame.getByRole('dialog');
  await expect(dialog).toContainText('Quote adjustment not saved');
  await dialog.getByRole('button', {name:'OK',exact:true}).click();
  await expect(existing).toBeEnabled();
  await expect(frame.locator('[data-quote-builder-lines] tr')).toHaveCount(1);
  await expect(existing).toHaveValue('Existing adjustment');
  await expect(frame.locator('[data-deposit-record]')).toBeEnabled();
});
