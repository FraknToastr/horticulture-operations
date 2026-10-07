'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {repoRoot,loadPlaywright} = require('./local-test-environment.cjs');
(async () => {
  const browser = await loadPlaywright().chromium.launch({headless:true});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(pathToFileURL(path.join(repoRoot(),'index.html')).href);
    await page.waitForFunction(()=>window.HortOpsWriterSession && HortOpsWriterSession.canWrite());
    for (const width of [2048,1440,1280,768,390]) {
      await page.setViewportSize({width,height:900});
      const layout = await page.evaluate(() => {
        const header = document.querySelector('.app-header');
        const main = document.querySelector('.header-container');
        const bar = document.querySelector('.programme-toolbar');
        const controls = Array.from(header.querySelectorAll('button, input, select'));
        return {
          mainHeight:main.getBoundingClientRect().height,
          toolbarBelow:bar.getBoundingClientRect().top >= main.getBoundingClientRect().bottom - 1,
          overflow:controls.filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.left < 0 || r.right > innerWidth + 1;}).map(e=>e.id || e.className),
          outsideActions:!document.querySelector('.header-actions .planning-range-controls'),
          labelColor:getComputedStyle(bar.querySelector('label')).color,
          background:getComputedStyle(bar).backgroundColor
        };
      });
      assert(layout.toolbarBelow,'period bar must not stretch navigation');
      assert(layout.outsideActions,'date controls must not compete with action buttons');
      assert.deepEqual(layout.overflow,[],'controls fit viewport '+width);
      if (width === 2048) {
        assert(layout.mainHeight <= 80,'desktop navigation remains compact');
        const dates = await page.locator('#planning-range-start').boundingBox();
        const end = await page.locator('#planning-range-end').boundingBox();
        const apply = await page.locator('#planning-range-apply').boundingBox();
        assert.equal(dates.y,end.y);
        assert(Math.abs(dates.y-apply.y)<3,'date controls stay on one line');
      }
      await page.locator('.app-header').screenshot({path:path.join(require('node:os').tmpdir(),'hort-header-'+width+'.png')});
    }
    await page.setViewportSize({width:1440,height:900});
    await page.locator('#planning-range-start').fill('2026-11-01');
    await page.locator('#planning-range-end').fill('2027-02-28');
    await page.locator('#planning-range-apply').click();
    assert.deepEqual(await page.evaluate(()=>HortOpsApp.state.uiState.planningRange),{start:'2026-11-01',end:'2027-02-28'});
    await page.getByLabel('Calendar year',{exact:true}).selectOption('2027');
    assert.equal(await page.evaluate(()=>HortOpsApp.state.uiState.planningRange),undefined);
    assert.deepEqual(errors,[]);
    console.log('PASS: compact desktop header, separate readable period bar, no control overflow at 2048/1440/1280/768/390, programme and year actions');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
