const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/shared/js/program-runtime.js', 'utf8');

function setup() {
  const scripts = [];
  const window = {};
  const document = {
    currentScript: { src: 'http://localhost/src/shared/js/program-runtime.js?v=test' },
    createElement: () => ({ remove() { this.removed = true; } }),
    head: { appendChild(script) { scripts.push(script); } }
  };
  vm.runInNewContext(source, { window, document, URL, Promise, Error });
  return { window, scripts, runtime: window.UOS.ProgramRuntime };
}

test('local libraries load only on demand and concurrent calls share a request', async () => {
  const { window, scripts, runtime } = setup();
  assert.equal(scripts.length, 0);
  const first = runtime.ensureMap();
  assert.equal(runtime.ensureMap(), first);
  assert.equal(scripts.length, 1);
  const rendererURL = new URL(scripts[0].src);
  assert.equal(rendererURL.origin, 'http://localhost');
  assert.equal(rendererURL.pathname, '/src/shared/vendor/space-map/renderer.js');
  assert.ok(rendererURL.searchParams.get('v'), 'renderer URL must be cache-versioned');
  window.UOSSpaceGPU = { Map: function () {} };
  scripts[0].onload();
  assert.equal(await first, window.UOSSpaceGPU);
  assert.equal(await runtime.ensureMap(), window.UOSSpaceGPU);
  assert.equal(scripts.length, 1);
  const pdf = runtime.ensurePdf();
  assert.equal(runtime.ensurePdf(), pdf);
  assert.equal(scripts[1].src, 'http://localhost/src/shared/vendor/pdfjs/pdf.min.js');
  window.pdfjsLib = {};
  scripts[1].onload();
  assert.equal(await pdf, window.pdfjsLib);
});

for (const failure of ['onerror', 'onload']) {
  test(`failed runtime (${failure}) is removed and can be retried`, async () => {
    const { window, scripts, runtime } = setup();
    const first = runtime.ensurePdf();
    scripts[0][failure]();
    await assert.rejects(first, /Check that the app files are available, then try again/);
    assert.equal(scripts[0].removed, true);
    const retry = runtime.ensurePdf();
    assert.notEqual(retry, first);
    assert.equal(scripts.length, 2);
    window.pdfjsLib = {};
    scripts[1].onload();
    assert.equal(await retry, window.pdfjsLib);
  });
}
