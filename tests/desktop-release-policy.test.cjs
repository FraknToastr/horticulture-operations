'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkOptions, guardPage, guardContext, guardBrowser } = require('../scripts/desktop-browser-guard.cjs');
const { modelFiles, browserBatches } = require('../scripts/desktop-release-plan.cjs');

test('desktop release blocks excluded capabilities before invoking them', async () => {
  const blocked = /DESKTOP_RELEASE_POLICY/;
  for (const options of [
    { viewport: { width: 480, height: 720 } }, { isMobile: true },
    { hasTouch: true }, { recordVideo: { dir: 'unused' } }
  ]) assert.throws(() => checkOptions(options), blocked);
  assert.doesNotThrow(() => checkOptions({ viewport: { width: 1024, height: 768 } }));
  class Locator { screenshot() { assert.fail('screenshot invoked'); } }
  let resizes = 0;
  const page = guardPage({
    locator: () => new Locator(), touchscreen: {},
    setViewportSize: () => { resizes++; }
  });
  assert.throws(() => page.screenshot(), blocked);
  assert.throws(() => page.locator('html').screenshot(), blocked);
  assert.throws(() => page.touchscreen.tap(0, 0), blocked);
  assert.throws(() => page.setViewportSize({ width: 390, height: 700 }), blocked);
  assert.equal(resizes, 0);
  page.setViewportSize({ width: 1600, height: 1000 });
  assert.equal(resizes, 1);
  const context = guardContext({ tracing: {}, on() {}, pages: () => [page], newPage: async () => page });
  assert.throws(() => context.tracing.start(), blocked);
  assert.throws(() => context.tracing.startChunk(), blocked);
  const browser = guardBrowser({ newContext: () => assert.fail('context invoked'), newPage: () => assert.fail('page invoked') });
  await assert.rejects(browser.newContext({ hasTouch: true }), blocked);
  await assert.rejects(browser.newPage({ recordVideo: { dir: 'unused' } }), blocked);
});

test('desktop release retains filters for mixed files and excludes mobile Budget coverage', () => {
  const byName = Object.fromEntries(browserBatches.map(batch => [batch.name, batch]));
  assert.equal(byName.budget.testMatch.includes('**/budget-mobile-layout.spec.js'), false);
  assert.equal(byName.gpu.grepInvert.test('local-file entry'), true);
  assert.equal(byName.gpu.grepInvert.test('local launcher'), true);
  assert.equal(byName.inspector.grep.test('NSA: radial Undo restores completed vertex edits'), true);
  assert.equal(byName.inspector.grep.test('radial Undo appears on its parent spoke'), false);
  assert.equal(byName['map-draft'].grep.test('radial Undo appears on its parent spoke'), false);
  assert.equal([...modelFiles, ...browserBatches.flatMap(batch => batch.testMatch)].some(file => /overtime/i.test(file)), false);
});
