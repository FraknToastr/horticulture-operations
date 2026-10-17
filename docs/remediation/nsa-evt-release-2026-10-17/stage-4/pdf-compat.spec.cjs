const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { root } = require('./prepare.cjs');
const { suppressBackupModalForFunctionalTest } = require(path.join(root, 'tests/browser/test-helper.cjs'));
const sample = fs.readFileSync(path.join(root, 'src/sample/nature-strip-dashboard-source.sample.pdf')).toString('base64');
const formSample = require('./form-fixture.cjs')().toString('base64');
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function open(page, owner, port = 4204) {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`http://127.0.0.1:${port}/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(frame => frame !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  return frame;
}
async function parse(frame, data = sample) {
  return frame.evaluate(async data => {
    const pdf = window.pdfjsLib, calls = [];
    // Observe the real consumer's security option without changing the library.
    window.pdfjsLib = { ...pdf, getDocument(options) { calls.push(options.isEvalSupported); return pdf.getDocument(options); } };
    let document;
    try {
      document = await UOS.imports.openPdf(Uint8Array.from(atob(data), character => character.charCodeAt(0)));
      const text = [];
      for (let page = 1; page <= document.numPages; page++) {
        text.push((await (await document.getPage(page)).getTextContent()).items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim());
      }
      const fields = await document.getFieldObjects();
      const entries = fields instanceof Map ? [...fields.entries()] : Object.entries(fields || {});
      return { pages: document.numPages, text, fields: Object.fromEntries(entries.sort().map(([key, rows]) => [key, rows.map(row => ({ value: row.value, type: row.type }))])), calls };
    } finally { if (document) await document.destroy(); window.pdfjsLib = pdf; }
  }, data);
}
test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
  });
});

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: 6.4.299 matches shipped PDF extraction with lazy promises, real workers and no external network`, async ({ page }) => {
    const proofs = [];
    let baseline;
    for (const [port, version] of [[4199, '2.16.105'], [4204, '6.4.299']]) {
      const requests = [], workers = [], errors = [];
      const requestListener = request => { if (/\/pdf(?:\.worker)?\.min\.(?:mjs|js)/.test(request.url())) requests.push(request.url()); };
      const workerListener = worker => workers.push(worker.url());
      const errorListener = error => errors.push(error.message);
      page.on('request', requestListener); page.on('worker', workerListener); page.on('pageerror', errorListener);
      try {
        const frame = await open(page, owner, port);
        expect(requests).toHaveLength(0);
        const load = await frame.evaluate(async () => {
          const first = UOS.ProgramRuntime.ensurePdf(), second = UOS.ProgramRuntime.ensurePdf();
          const samePromise = first === second, library = await first;
          return { samePromise, version: library.version, cached: await UOS.ProgramRuntime.ensurePdf() === library };
        });
        expect(load).toEqual({ samePromise: true, version, cached: true });
        expect(requests).toHaveLength(1);
        expect(workers).toHaveLength(0);
        const parsed = await parse(frame);
        expect(parsed.pages).toBeGreaterThan(0);
        expect(Object.keys(parsed.fields)).toHaveLength(0);
        expect(parsed.calls).toEqual([false]);
        expect(parsed.text.join(' ')).toContain('A3330');
        expect(workers).toHaveLength(1);
        expect(workers[0]).toMatch(/pdf\.worker\.min\.(?:mjs|js)/);
        await expect.poll(() => page.workers().length).toBe(0);
        expect(requests).toHaveLength(2);
        const form = await parse(frame, formSample);
        expect(form.fields.Receipt).toEqual([{ value: 'A3330', type: 'text' }]);
        expect(form.calls).toEqual([false]);
        expect(workers).toHaveLength(2);
        await expect.poll(() => page.workers().length).toBe(0);
        expect(requests).toHaveLength(3);
        if (baseline) expect({ parsed, form }).toEqual(baseline); else baseline = { parsed, form };
        expect(errors).toEqual([]);
        proofs.push({ port, version, load, pdfRequests: requests.length, workersCreated: workers.length,
          workersRemaining: page.workers().length, pages: parsed.pages, fields: Object.keys(parsed.fields).length,
          extractionSHA256: digest({ parsed, form }), formFields: Object.keys(form.fields).length,
          isEvalSupported: [...parsed.calls, ...form.calls] });
      } finally { page.off('request', requestListener); page.off('worker', workerListener); page.off('pageerror', errorListener); }
    }
    await test.info().attach('pdf-parity-proof', { body: Buffer.from(JSON.stringify(proofs)), contentType: 'application/json' });
  });

  test(`${owner}: failed PDF module load retries explicitly and deduplicates the retry`, async ({ page }) => {
    let failed = 0;
    await page.route(/\/pdf\.min\.mjs\?attempt=1$/, route => { failed++; return route.abort(); });
    const frame = await open(page, owner);
    const before = await frame.evaluate(() => JSON.stringify(UOS.ProgramApp.workspace().entities));
    const error = await frame.evaluate(() => UOS.ProgramRuntime.ensurePdf().then(() => '', error => error.message));
    expect(error).toContain('Unable to load the local PDF import runtime');
    expect(failed).toBe(1);
    const retry = await frame.evaluate(async () => {
      const first = UOS.ProgramRuntime.ensurePdf(), second = UOS.ProgramRuntime.ensurePdf();
      return { samePromise: first === second, version: (await first).version, attempts: UOS.ProgramRuntime.pdfLoadAttempt };
    });
    expect(retry).toEqual({ samePromise: true, version: '6.4.299', attempts: 2 });
    expect(await frame.evaluate(() => JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(before);
  });
}

test('NSA: candidate PDF library stages and applies the real Register PDF import', async ({ page }) => {
  const frame = await open(page, 'NSA');
  await frame.locator('[data-register-pdf-input]').setInputFiles(path.join(root, 'src/sample/nature-strip-dashboard-source.sample.pdf'));
  const dialog = frame.locator('[data-program-import-modal]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-program-import-warnings] li')).toHaveCount(0);
  await expect(dialog.locator('[data-program-import-conflicts] li')).toHaveCount(0);
  await dialog.locator('[data-program-import-apply]').click();
  await expect(dialog).toBeHidden();
  const imported = await frame.evaluate(() => {
    const workspace = UOS.ProgramApp.workspace(), application = workspace.entities.applications.find(item => item.receipt === 'A3330');
    UOS.ProgramModel.assertValid(workspace);
    return { count: workspace.entities.applications.length, rates: workspace.entities.rateItems.length,
      receipt: application?.receipt, status: application?.status,
      receivedEvents: workspace.entities.statusEvents.filter(item => item.entityId === application?.id && item.toStatus === 'received').length };
  });
  expect(imported).toEqual({ count: 1, rates: 47, receipt: 'A3330', status: 'received', receivedEvents: 1 });
});

test('candidate PDF load timeout stays bounded and permits an explicit retry', async ({ page }) => {
  let held;
  await page.route(/\/pdf\.min\.mjs\?attempt=1$/, route => { held = route; });
  const frame = await open(page, 'NSA');
  const error = await frame.evaluate(() => UOS.ProgramRuntime.ensurePdf().then(() => '', error => error.message));
  expect(error).toContain('Unable to load the local PDF import runtime');
  expect(held).toBeTruthy();
  expect(await frame.evaluate(() => UOS.ProgramRuntime.pdfLoadAttempt)).toBe(1);
  await held.abort();
  expect(await frame.evaluate(async () => (await UOS.ProgramRuntime.ensurePdf()).version)).toBe('6.4.299');
  expect(await frame.evaluate(() => UOS.ProgramRuntime.pdfLoadAttempt)).toBe(2);
});

test('a malformed PDF does not poison the successful candidate module cache', async ({ page }) => {
  const frame = await open(page, 'NSA');
  await frame.evaluate(() => UOS.ProgramRuntime.ensurePdf());
  const message = await frame.evaluate(async () => {
    try { await UOS.imports.openPdf(new TextEncoder().encode('not a PDF')); return ''; }
    catch (error) { return error.message; }
  });
  expect(message).not.toBe('');
  await expect.poll(() => page.workers().length).toBe(0);
  const parsed = await parse(frame);
  expect(parsed.pages).toBeGreaterThan(0);
  expect(parsed.calls).toEqual([false]);
  expect(await frame.evaluate(() => UOS.ProgramRuntime.pdfLoadAttempt)).toBe(1);
});
