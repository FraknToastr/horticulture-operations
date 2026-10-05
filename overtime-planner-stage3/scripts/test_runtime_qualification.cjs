'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { loadPlaywright, repoRoot } = require('./local-test-environment.cjs');
const root = repoRoot();
const playwright = loadPlaywright();
const key = 'hort_ops_workspace_v2_single_writer_v1';
const entries = ['index.html', 'dist/hort_ops_offline_planner.html', 'index.modular.html'];
const checks = [], errors = [];
let validWorkspace;
const report = { passed: false, node: process.version, platform: process.platform, checks, errors, navigation: [] };
const folder = path.join(root, 'test_reports/phase8');
fs.mkdirSync(folder, { recursive: true });
function pass(name) { checks.push(name); console.log('[PASS] ' + name); }
async function ready(page) {
    await page.waitForFunction(() => window.HortOpsWriterSession &&
        !HortOpsWriterSession.status().pending && HortOpsWriterSession.status().mode !== 'starting');
}
async function open(context, entry) {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, entry)).href);
    await ready(page);
    return page;
}
async function main() {
    const browser = await playwright.chromium.launch({ headless: true });
    report.browserVersion = browser.version();
    try {
        for (const entry of entries) {
            const context = await browser.newContext();
            try {
                await context.addInitScript(() => {
                    window.__qualificationShows = [];
                    window.addEventListener('pageshow', event => window.__qualificationShows.push(event.persisted));
                });
                const owner = await open(context, entry);
                const capabilities = await owner.evaluate(() => ({ secure: isSecureContext,
                    locks: typeof navigator.locks.request === 'function', mode: HortOpsWriterSession.status().mode,
                    jobs: HortOpsApp.state.jobs.length, staff: HortOpsApp.state.staffList.length }));
                assert.deepEqual(capabilities, { secure: true, locks: true, mode: 'writer', jobs: 0, staff: 0 });
                assert.equal(await owner.evaluate(() => {
                    HortOpsApp.state.budgetSettings.annualTarget = 8100;
                    return HortOpsApp.saveCurrentWorkspace();
                }), true);
                const peer = await open(context, 'index.html');
                assert.equal(await peer.evaluate(() => HortOpsWriterSession.canWrite()), false);
                await owner.goto('about:blank');
                await peer.evaluate(() => HortOpsWriterSession.acquire());
                assert.equal(await peer.evaluate(() => HortOpsWriterSession.canWrite()), true);
                assert.equal(await peer.evaluate(() => {
                    HortOpsApp.state.budgetSettings.annualTarget = 8200;
                    return HortOpsApp.saveCurrentWorkspace();
                }), true);
                const saved = await peer.evaluate(key => localStorage.getItem(key), key);
                validWorkspace = saved;
                await owner.goBack();
                await ready(owner);
                assert.equal(await owner.evaluate(() => HortOpsWriterSession.canWrite()), false);
                assert.equal(await owner.evaluate(() => HortOpsApp.state.budgetSettings.annualTarget), 8200);
                assert.equal(await owner.evaluate(() => HortOpsApp.saveCurrentWorkspace()), false);
                assert.equal(await peer.evaluate(key => localStorage.getItem(key), key), saved);
                report.navigation.push({ entry, persistedPageshowObserved:
                    await owner.evaluate(() => window.__qualificationShows.includes(true)) });
                await peer.evaluate(() => HortOpsWriterSession.release());
                await owner.evaluate(() => HortOpsWriterSession.acquire());
                assert.equal(await owner.evaluate(() => HortOpsWriterSession.canWrite()), true);
                assert.equal(await owner.evaluate(() => HortOpsApp.state.budgetSettings.annualTarget), 8200);
                await owner.reload();
                await ready(owner);
                assert.equal(await owner.evaluate(() => HortOpsWriterSession.canWrite()), true);
                assert.equal(await owner.evaluate(() => HortOpsApp.state.budgetSettings.annualTarget), 8200);
                assert.equal(await owner.evaluate(key => localStorage.getItem(key), key), saved);
                pass(entry + ': actual navigation, peer handoff, fresh return, reacquisition and reload preserve committed data');
            } finally { await context.close(); }
        }
        for (const denial of ['read', 'write', 'locks']) {
            const context = await browser.newContext();
            try {
                await context.addInitScript(({ denial, key, preserved }) => {
                    const raw = localStorage;
                    const originalGet = Storage.prototype.getItem;
                    const originalSet = Storage.prototype.setItem;
                    originalSet.call(raw, key, preserved);
                    window.__qualificationRaw = () => originalGet.call(raw, key);
                    if (denial === 'locks') {
                        Object.defineProperty(navigator, 'locks', { value: {
                            request: () => Promise.reject(new DOMException('Denied by qualification fixture', 'SecurityError'))
                        } });
                    } else {
                        const operation = denial === 'read' ? 'getItem' : 'setItem';
                        Storage.prototype[operation] = function() {
                            throw new DOMException('Denied by qualification fixture', 'SecurityError');
                        };
                    }
                }, { denial, key, preserved: validWorkspace });
                const page = await open(context, 'index.html');
                assert.equal(await page.evaluate(() => {
                    HortOpsApp.state.budgetSettings.annualTarget = 8300;
                    return HortOpsApp.saveCurrentWorkspace();
                }), false);
                assert.equal(await page.evaluate(() => window.__qualificationRaw()), validWorkspace);
                if (denial === 'locks') {
                    assert.equal(await page.evaluate(() => HortOpsWriterSession.canWrite()), false);
                } else if (denial === 'read') {
                    assert.equal(await page.evaluate(() => HortOpsApp.state.recoveryRequired), true);
                } else {
                    assert.equal(await page.evaluate(() => HortOpsWriterSession.canWrite()), true);
                }
                pass('denied ' + denial + ': no successful save or replacement of existing source');
            } finally { await context.close(); }
        }
        assert.deepEqual(errors, []);
        report.passed = true;
        console.log('RUNTIME QUALIFICATION CHECKS PASSED: ' + checks.length);
    } finally {
        await browser.close();
        fs.writeFileSync(path.join(folder, 'runtime-qualification-results.json'), JSON.stringify(report, null, 2) + '\n');
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
