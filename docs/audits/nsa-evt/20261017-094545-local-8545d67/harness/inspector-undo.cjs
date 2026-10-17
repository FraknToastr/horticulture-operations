const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const assert = require('node:assert/strict');
delete process.env.PLAYWRIGHT_BROWSERS_PATH;
const source = '/tmp/nsa-evt-audit-20261017-094545';
const { chromium, expect } = require(path.join(source, 'node_modules/@playwright/test'));
const helperFile = path.join(source, 'tests/browser/space-map-draft-actions.spec.js');
const helperText = fs.readFileSync(helperFile, 'utf8');
const helperLines = helperText.split('\n');
const helperModule = new Module(helperFile, module);
helperModule.filename = helperFile;
helperModule.paths = Module._nodeModulePaths(path.dirname(helperFile));
helperModule._compile(helperLines.slice(0, 37).join('\n') + '\n' + helperLines.slice(81, 87).join('\n') + '\nmodule.exports={setup,point,start,draftCoordinates,dragCoordinate};', helperFile);
const { setup, point, start, draftCoordinates, dragCoordinate } = helperModule.exports;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const report = {
  id: 'S-MAP-COLLAPSE-UNDO',
  candidate: 'disposable local working-tree snapshot /tmp/nsa-evt-audit-20261017-094545',
  procedure: 'Independent current three-level card disclosure plus vertex Undo procedure; existing failing test is retained unchanged.',
  harnessSha256: sha(fs.readFileSync(__filename)),
  helper: { file: 'tests/browser/space-map-draft-actions.spec.js', sha256: sha(helperText), lines: ['1-37', '82-87'] },
  startedAt: new Date().toISOString(),
  browser: {}, cases: []
};
async function persisted(frame) { return frame.evaluate(() => JSON.stringify(UOS.ProgramApp.workspace().entities.geometries)); }
async function cardState(card) {
  return card.evaluate(node => {
    const visible = element => Boolean(element && element.getBoundingClientRect().width && element.getBoundingClientRect().height && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden');
    return { level: node.dataset.cardSize, rows: [...node.querySelectorAll('.space-editor__fields tr')].filter(visible).length, tools: [...node.querySelectorAll('.program-shape-actions button')].filter(visible).length, drawerVisible: visible(node.querySelector('.space-editor__drawer')), firstLabelVisible: visible(node.querySelector('.space-editor__fields th')), jobType: node.querySelector('.space-editor__fields td')?.textContent.trim(), header: visible(node.querySelector('header')) };
  });
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  report.browser.version = browser.version();
  try {
    for (const owner of ['NSA', 'EVT']) {
      const entry = { owner, startedAt: new Date().toISOString(), checks: [], levels: [] };
      report.cases.push(entry);
      const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4403', viewport: { width: 1600, height: 1000 } });
      try {
        const page = await context.newPage();
        const { frame, errors } = await setup(page, owner);
        await start(frame, 'polygon');
        for (const [x, y] of [[.35,.5],[.6,.5],[.6,.8],[.35,.8]]) await point(frame,x,y);
        await frame.locator('#spaceAcceptDraft').click();
        const card = frame.locator('[data-shape-card-id]');
        await expect(card).toHaveCount(1);
        const saved = await persisted(frame);
        await card.locator('[data-shape-action="edit"]').click();
        await expect(card).toHaveAttribute('data-card-size', 'full');
        await frame.evaluate(() => { window.__auditCardIdentity = document.querySelector('[data-shape-card-id]'); });
        const original = await draftCoordinates(frame);
        const undo = frame.locator('#spaceUndoDraft');
        await dragCoordinate(page, frame, original[0]);
        await expect(undo).toBeVisible();
        assert.notDeepEqual(await draftCoordinates(frame), original);
        assert.equal(await persisted(frame), saved);
        await undo.click();
        assert.deepEqual(await draftCoordinates(frame), original);
        entry.checks.push('Pointer vertex edit changes preview; Undo restores it without saving.');
        const lat = card.locator('[data-coord-lat="0"]');
        const lng = card.locator('[data-coord-lng="0"]');
        await lat.fill(String(Number(await lat.inputValue())+.00003)); await lat.press('Tab');
        const latitudePreview = await draftCoordinates(frame);
        await lng.fill(String(Number(await lng.inputValue())+.00003)); await lng.press('Tab');
        assert.notDeepEqual(await draftCoordinates(frame), latitudePreview);
        entry.levels.push(await cardState(card));
        await card.locator('[data-space-expand]').click();
        await expect(card).toHaveAttribute('data-card-size', 'summary');
        const summary = await cardState(card); entry.levels.push(summary);
        assert.equal(summary.rows,3); assert.equal(summary.tools,6); assert.equal(summary.drawerVisible,false); assert.equal(summary.header,true);
        await undo.click(); assert.deepEqual(await draftCoordinates(frame), latitudePreview);
        await undo.click(); assert.deepEqual(await draftCoordinates(frame), original);
        await expect(undo).toBeHidden();
        assert.equal(await persisted(frame), saved);
        assert.equal(await frame.evaluate(() => window.__auditCardIdentity === document.querySelector('[data-shape-card-id]')), true);
        entry.checks.push('Undo while summary is collapsed reverses both coordinate edits, preserves card node and saved geometry.');
        await card.locator('[data-space-expand]').click();
        await expect(card).toHaveAttribute('data-card-size','minimal');
        const minimal=await cardState(card); entry.levels.push(minimal);
        assert.equal(minimal.rows,1); assert.equal(minimal.tools,0); assert.equal(minimal.drawerVisible,false); assert.equal(minimal.firstLabelVisible,false); assert.equal(minimal.header,true); assert.ok(minimal.jobType);
        await expect(card.locator('[data-delete-vertex="1"]')).toBeHidden();
        await card.locator('[data-space-expand]').click();
        await expect(card).toHaveAttribute('data-card-size','full');
        const full=await cardState(card); entry.levels.push(full);
        assert.equal(full.rows,3); assert.equal(full.tools,6); assert.equal(full.drawerVisible,true);
        assert.equal(await frame.evaluate(() => window.__auditCardIdentity === document.querySelector('[data-shape-card-id]')), true);
        entry.checks.push('Disclosure cycles full -> summary (3 rows + 6 tools) -> minimal (header + Job Type value only) -> full, preserving card node.');
        await card.locator('[data-delete-vertex="1"]').click();
        await frame.getByRole('dialog').getByRole('button',{name:'Remove vertex',exact:true}).click();
        await expect(card.locator('.rem-vertex-item')).toHaveCount(3);
        assert.equal(await persisted(frame),saved);
        await undo.click();
        await expect(card.locator('.rem-vertex-item')).toHaveCount(4);
        assert.deepEqual(await draftCoordinates(frame),original);
        assert.equal(await persisted(frame),saved);
        entry.checks.push('After reopening full level, vertex deletion and Undo restore four vertices without saving.');
        await frame.locator('#spaceCancelDraft').click();
        assert.equal(await persisted(frame),saved);
        assert.deepEqual(errors,[]);
        entry.backend = await frame.evaluate(() => UOS.ProgramMapController.getMapController().getRendererMetrics().backend);
        entry.status='PASS';
      } catch(error) { entry.status='FAIL'; entry.error={message:error.message,stack:error.stack}; }
      finally { entry.endedAt=new Date().toISOString(); await context.close(); }
    }
  } finally { await browser.close(); report.endedAt=new Date().toISOString(); report.status=report.cases.every(entry=>entry.status==='PASS')?'PASS':'FAIL'; fs.writeFileSync('/tmp/nsa-map-collapse-undo-supplement-results.json',JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report,null,2)); }
  process.exitCode = report.status==='PASS'?0:1;
})().catch(error => { console.error(error.stack); process.exitCode=1; });
