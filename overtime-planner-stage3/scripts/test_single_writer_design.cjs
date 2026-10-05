'use strict';
// Isolated capability/coordination proof. Does not load application code/data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { repoRoot, loadPlaywright } = require('./local-test-environment.cjs');
const root = repoRoot();
const playwright = loadPlaywright();
const prototype = fs.readFileSync(path.join(__dirname, 'design-proof/single-writer-prototype.js'), 'utf8');
const folder = path.join(root, 'test_reports/phase4-writer-design');
fs.mkdirSync(path.join(folder, 'dist'), { recursive: true });
fs.mkdirSync(path.join(folder, 'copy'), { recursive: true });
const fixture = '<!doctype html><meta charset="utf-8"><title>Isolated Overtime writer proof</title>';
for (const file of ['index.html', 'dist/hort_ops_offline_planner.html', 'copy/index.html']) fs.writeFileSync(path.join(folder, file), fixture);
const report = { recordedAt: new Date().toISOString(), applicationIntegrated: false, checks: [], modes: [] };
const rawLog = [];
function pass(name) { report.checks.push(name); rawLog.push('[PASS] ' + name); console.log('[PASS] ' + name); }
async function prepare(page, url) {
  await page.goto(url);
  await page.addScriptTag({ content: prototype });
  return page.evaluate(() => ({ secure: isSecureContext, protocol: location.protocol, locks: !!navigator.locks, userAgent: navigator.userAgent }));
}
async function install(page, options = {}) {
  return page.evaluate(options => {
    window.writeCount = 0;
    window.readCount = 0;
    let locks = navigator.locks;
    if (options.missing) locks = null;
    if (options.reject) locks = { request() { return Promise.reject(new Error('denied')); } };
    if (options.throw) locks = { request() { throw new Error('denied'); } };
    window.proof = createOvertimeWriterProof({
      key: options.key || 'phase4-proof:hort_ops_workspace_v2', locks,
      read() { readCount++; if (options.badRead) throw new Error('storage unavailable'); return localStorage.getItem(options.key || 'phase4-proof:hort_ops_workspace_v2'); },
      write(value) { if (options.badWrite) throw new Error('quota'); localStorage.setItem(options.key || 'phase4-proof:hort_ops_workspace_v2', value); writeCount++; }
    });
    return proof.acquire();
  }, options);
}
const status = page => page.evaluate(() => proof.status());
const commit = (page, value) => page.evaluate(value => proof.commit(value), value);
const release = page => page.evaluate(() => proof.release());
async function acquireEventually(page) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    const result = await page.evaluate(() => proof.acquire());
    if (result.state === 'writer') return result;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error('Writer was not released within bounded crash-recovery window');
}
async function sharedScope(browser, urls, mode) {
  const context = await browser.newContext();
  try {
    const pages = await Promise.all(urls.map(() => context.newPage()));
    const capabilities = await Promise.all(pages.map((page, i) => prepare(page, urls[i])));
    // Check storage sharing separately from API existence/lock sharing.
    await pages[0].evaluate(() => localStorage.setItem('phase4-scope-marker', 'shared-storage'));
    const shared = await Promise.all(pages.map(page => page.evaluate(() => localStorage.getItem('phase4-scope-marker'))));
    const storageShared = shared.every(value => value === 'shared-storage');
    const grants = await Promise.all(pages.map(page => install(page)));
    const writers = grants.filter(grant => grant.state === 'writer').length;
    const row = { mode, capabilities, storageShared, writers, paths: urls.map(url => new URL(url).pathname), supportedForPrototype: storageShared && writers === 1 };
    report.modes.push(row);
    // A shared workspace must never yield two editable clients.
    if (storageShared) assert.ok(writers <= 1, mode + ': shared storage split lock scope');
    if (!writers) {
      for (const page of pages) assert.equal((await commit(page, 'forbidden')).success, false);
      pass(mode + ': unsupported lock scope stays read-only');
      return;
    }
    assert.equal(storageShared, true, mode + ': no shared storage proof');
    assert.equal(writers, 1);
    const ownerIndex = grants.findIndex(grant => grant.state === 'writer');
    const owner = pages[ownerIndex];
    const other = pages[(ownerIndex + 1) % pages.length];
    pass(mode + ': simultaneous acquisition gives exactly one writer across paths');
    assert.equal((await commit(owner, 'qualification-suspended')).success, true);
    const bytes = await owner.evaluate(() => localStorage.getItem('phase4-proof:hort_ops_workspace_v2'));
    for (let i = 0; i < pages.length; i++) {
      if (i === ownerIndex) continue;
      assert.equal((await commit(pages[i], 'stale-absence')).success, false);
      assert.equal(await pages[i].evaluate(() => readCount), 0, 'no editable read without lock');
    }
    assert.equal(await owner.evaluate(() => localStorage.getItem('phase4-proof:hort_ops_workspace_v2')), bytes);
    pass(mode + ': blocked tabs cannot discard suspended qualification');
    await release(owner);
    assert.equal((await commit(owner, 'late-write')).success, false);
    const takeover = await acquireEventually(other);
    assert.equal(takeover.snapshot, bytes, 'takeover must read the latest committed value');
    assert.equal((await commit(other, 'absence-and-budget-updated')).success, true);
    pass(mode + ': explicit handoff reloads current bytes and former owner stays read-only');
    await other.close();
    const closeTakeover = await acquireEventually(owner);
    assert.equal(closeTakeover.snapshot, 'absence-and-budget-updated');
    pass(mode + ': closing owner releases lock; next writer reloads committed bytes');
    await release(owner);
  } finally { await context.close(); }
}
async function negativeCases(browser, url) {
  for (const options of [{ missing: true }, { reject: true }, { throw: true }, { badRead: true }]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await prepare(page, url);
      assert.equal((await install(page, options)).state, 'read-only');
      assert.equal((await commit(page, 'forbidden')).success, false);
      assert.equal(await page.evaluate(() => writeCount), 0);
      await release(page);
      pass('fail closed: ' + Object.keys(options)[0]);
    } finally { await context.close(); }
  }
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await prepare(page, url);
    assert.equal((await install(page, { badWrite: true })).state, 'writer');
    assert.equal((await commit(page, 'quota-failure')).success, false);
    assert.equal(await page.evaluate(() => writeCount), 0);
    await release(page);
    pass('write failure reports failure without fabricated persistence');
  } finally { await context.close(); }
}
async function nonCooperatingWriter(browser, url) {
  const context = await browser.newContext();
  try {
    const a = await context.newPage(), b = await context.newPage();
    await prepare(a, url); await prepare(b, url);
    await install(a); await install(b);
    assert.equal((await status(a)).state, 'writer');
    assert.equal((await status(b)).state, 'read-only');
    await commit(a, 'new-owner-value');
    await b.evaluate(() => localStorage.setItem('phase4-proof:hort_ops_workspace_v2', 'unguarded-old-copy'));
    assert.equal(await a.evaluate(() => localStorage.getItem('phase4-proof:hort_ops_workspace_v2')), 'unguarded-old-copy');
    report.nonCooperatingClientRiskConfirmed = true;
    pass('limitation demonstrated: an unguarded old copy bypasses cooperative locks');
    await release(a);
  } finally { await context.close(); }
}
async function isolatedLegacyKey(browser, url) {
  const context = await browser.newContext();
  try {
    const a = await context.newPage(), b = await context.newPage();
    await prepare(a, url); await prepare(b, url);
    const key = 'phase4-proof:hort_ops_workspace_v2_single_writer_v1';
    await install(a, { key }); await install(b, { key });
    await commit(a, 'upgraded-workspace');
    await b.evaluate(() => localStorage.setItem('phase4-proof:hort_ops_workspace_v2', 'old-copy-write'));
    assert.equal(await a.evaluate(key => localStorage.getItem(key), key), 'upgraded-workspace');
    assert.equal((await commit(b, 'duplicate-upgraded-writer')).success, false);
    pass('proposed new physical key isolates old-copy writes and retains exclusive upgraded writer');
    await release(a);
  } finally { await context.close(); }
}
async function rendererCrash(browser, url) {
  const context = await browser.newContext();
  try {
    const owner = await context.newPage(), other = await context.newPage();
    await prepare(owner, url); await prepare(other, url);
    await install(owner); await install(other);
    await commit(owner, 'before-renderer-crash');
    const session = await context.newCDPSession(owner);
    const crashed = owner.waitForEvent('crash', { timeout: 5000 });
    session.send('Page.crash').catch(() => {});
    await crashed;
    assert.equal((await acquireEventually(other)).snapshot, 'before-renderer-crash');
    pass('actual renderer crash releases ownership; surviving tab reloads committed bytes');
    await release(other);
  } finally { await context.close(); }
}
async function lifecycleCases(browser, url) {
  const context = await browser.newContext();
  try {
    const owner = await context.newPage(), other = await context.newPage();
    await prepare(owner, url); await prepare(other, url);
    const late = await owner.evaluate(async () => {
      window.readCount = 0;
      window.proof = createOvertimeWriterProof({ key: 'phase4-proof:hort_ops_workspace_v2', locks: navigator.locks,
        read() { readCount++; return null; }, write() { throw new Error('must not write'); } });
      const acquisition = proof.acquire();
      await proof.release();
      await acquisition;
      return { state: proof.status().state, readCount };
    });
    assert.deepEqual(late, { state: 'read-only', readCount: 0 });
    pass('release during pending acquisition prevents late editable initialization');
    await install(owner); await install(other);
    const session = await context.newCDPSession(owner);
    await session.send('Page.setWebLifecycleState', { state: 'frozen' });
    assert.equal((await other.evaluate(() => proof.acquire())).state, 'read-only');
    assert.equal((await commit(other, 'timeout-takeover')).success, false);
    await session.send('Page.setWebLifecycleState', { state: 'active' });
    assert.equal((await commit(owner, 'resumed-owner')).success, true);
    pass('frozen owner retains lock; second tab cannot steal or write; owner resumes safely');
    await release(owner);
  } finally { await context.close(); }
}
async function main() {
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(fixture); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    report.browserVersion = browser.version();
    await sharedScope(browser, ['/index.html', '/dist/hort_ops_offline_planner.html', '/copy/index.html', '/index.html?second-tab'].map(p => origin + p), 'dedicated-loopback');
    await sharedScope(browser, ['index.html', 'dist/hort_ops_offline_planner.html', 'copy/index.html', 'index.html'].map(p => pathToFileURL(path.join(folder, p)).href), 'file-path-matrix');
    await negativeCases(browser, origin + '/index.html');
    await nonCooperatingWriter(browser, origin + '/index.html');
    await isolatedLegacyKey(browser, origin + '/index.html');
    await rendererCrash(browser, origin + '/index.html');
    await lifecycleCases(browser, origin + '/index.html');
    report.passed = true;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(path.join(folder, 'browser-proof.log'), rawLog.join('\n') + '\n');
  }
  console.log('DESIGN PROOF PASSED: ' + report.checks.length + ' checks; application remains unchanged.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
