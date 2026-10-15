const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.beforeEach(async ({ page }) => suppressBackupModalForFunctionalTest(page));

async function setup(page, owner = 'NSA') {
  await page.goto('/src/program-planner/' + (owner === 'NSA' ? 'nsa' : 'events') + '.html');
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  await frame.evaluate(async owner => {
    await UOS.ProgramApp.updateWorkspace(w => {
      const records = Array.from({ length: 12 }, (_, i) => ({
        id: owner + (owner === 'NSA' ? '-APP-' : '-') + 'MOTION-' + i,
        owner, type: owner === 'NSA' ? 'application' : 'event',
        receipt: 'MOTION-' + i, jobId: 'MOTION-' + i, title: 'Motion ' + i,
        status: 'received', dateReceived: '2026-09-30'
      }));
      w.entities[owner === 'NSA' ? 'applications' : 'events'] = records;
      w.workspace.destination = 'register';
      return w;
    });
  }, owner);
  await frame.waitForFunction(() => document.querySelectorAll('.program-register-summary-row').length === 12);
  // Let the fixture's debounced Register rebuild finish before measuring motion.
  await page.waitForTimeout(100);
  return frame;
}

async function settled(frame) {
  await frame.waitForFunction(() => !Array.from(document.querySelectorAll('.program-register-drawer-row')).some(r => r._uosDisclosureAnimation));
}

async function floor(frame) {
  return frame.evaluate(() => {
    const row = document.querySelector('.program-register-summary-row.is-disclosure-open');
    const drawer = row.nextElementSibling.querySelector('.program-register-drawer');
    const header = row.closest('table').querySelector('thead th');
    const style = getComputedStyle(drawer);
    return { bottom: drawer.getBoundingClientRect().bottom, viewport: innerHeight,
      height: drawer.getBoundingClientRect().height, max: parseFloat(style.maxHeight),
      rowTop: row.getBoundingClientRect().top, headerBottom: header.getBoundingClientRect().bottom,
      border: style.borderBottomWidth, shell: drawer.parentElement.getBoundingClientRect().height };
  });
}

function expectFloor(g, expectedHeaderGap = 0) {
  expect(g.bottom).toBeLessThanOrEqual(g.viewport);
  expect(g.bottom).toBeGreaterThanOrEqual(g.viewport - 8);
  expect(Math.abs(g.height - g.max)).toBeLessThanOrEqual(1);
  expect(Math.abs(g.rowTop - g.headerBottom - expectedHeaderGap)).toBeLessThanOrEqual(1);
  expect(Math.abs(g.shell - g.height)).toBeLessThanOrEqual(1);
  expect(g.border).toBe('4px');
}

for (const owner of ['NSA', 'EVT']) {
  test(owner + ' drawer reveals smoothly and preserves floor at each viewport and row position', async ({ page }) => {
    const frame = await setup(page, owner);
    for (const viewport of [{width:1024,height:720}, {width:1280,height:800}, {width:1920,height:1080}]) {
      await page.setViewportSize(viewport);
      for (const index of [0, 5, 11]) {
        const result = await frame.evaluate(async index => {
          const rows = document.querySelectorAll('.program-register-summary-row');
          const row = rows[index], drawerRow = row.nextElementSibling;
          const host = drawerRow.querySelector('.program-register-drawer');
          const shell = host.parentElement, table = row.closest('.program-table-wrap');
          table.scrollTop = index === 0 ? 0 : 100;
          const origin = table.scrollTop;
          const key = row.getAttribute('data-disclosure-key');
          const samples = [];
          UOS.ProgramDisclosureRows.open(key);
          const started = performance.now();
          do {
            await new Promise(requestAnimationFrame);
            samples.push({shell:shell.getBoundingClientRect().height, inner:host.getBoundingClientRect().height});
          } while (drawerRow._uosDisclosureAnimation && performance.now() - started < 1500);
          return { samples, origin, key };
        }, index);
        const final = result.samples.at(-1).shell;
        expect(result.samples.filter(s => s.shell > 1 && s.shell < final - 1).length).toBeGreaterThan(3);
        const inner = result.samples.map(s => s.inner);
        expect(Math.max(...inner) - Math.min(...inner)).toBeLessThanOrEqual(1);
        // Preserve the original 6px last-row gap at the table's scroll limit.
        expectFloor(await floor(frame), index === 11 ? 6 : 0);
        const close = await frame.evaluate(async key => {
          const row = Array.from(document.querySelectorAll('.program-register-summary-row')).find(r => r.getAttribute('data-disclosure-key') === key);
          const drawer = row.nextElementSibling, shell = drawer.querySelector('.program-register-motion-shell');
          const samples = [];
          UOS.ProgramDisclosureRows.closeScope('register');
          const started = performance.now();
          do { await new Promise(requestAnimationFrame); samples.push(shell.getBoundingClientRect().height); }
          while (drawer._uosDisclosureAnimation && performance.now() - started < 1500);
          return { samples, hidden:drawer.hidden, scroll:row.closest('.program-table-wrap').scrollTop };
        }, result.key);
        expect(close.hidden).toBe(true);
        expect(close.samples.filter(h => h > 1 && h < final - 1).length).toBeGreaterThan(3);
        expect(Math.abs(close.scroll - result.origin)).toBeLessThanOrEqual(1);
      }
    }
  });
}

test('Register reverses continuously, switches records, handles resize and reduced motion', async ({ page }) => {
  const frame = await setup(page);
  const report = await frame.evaluate(async () => {
    const row = document.querySelector('.program-register-summary-row');
    const key = row.getAttribute('data-disclosure-key');
    const shell = row.nextElementSibling.querySelector('.program-register-motion-shell');
    UOS.ProgramDisclosureRows.open(key);
    await new Promise(r => setTimeout(r, 110));
    const beforeClose = shell.getBoundingClientRect().height;
    UOS.ProgramDisclosureRows.closeScope('register');
    const afterClose = shell.getBoundingClientRect().height;
    await new Promise(r => setTimeout(r, 70));
    const beforeOpen = shell.getBoundingClientRect().height;
    UOS.ProgramDisclosureRows.open(key);
    return { beforeClose, afterClose, beforeOpen, afterOpen:shell.getBoundingClientRect().height };
  });
  expect(report.beforeClose).toBeGreaterThan(0);
  expect(Math.abs(report.beforeClose - report.afterClose)).toBeLessThanOrEqual(1);
  expect(Math.abs(report.beforeOpen - report.afterOpen)).toBeLessThanOrEqual(1);
  await settled(frame);
  expectFloor(await floor(frame));
  const switchScroll = await frame.evaluate(async () => {
    const rows = document.querySelectorAll('.program-register-summary-row');
    const table = rows[0].closest('.program-table-wrap');
    const samples = [];
    UOS.ProgramDisclosureRows.open(rows[5].getAttribute('data-disclosure-key'));
    const started = performance.now();
    do { await new Promise(requestAnimationFrame); samples.push(table.scrollTop); }
    while (Array.from(document.querySelectorAll('.program-register-drawer-row')).some(r => r._uosDisclosureAnimation) && performance.now() - started < 1500);
    return samples;
  });
  expect(Math.abs(switchScroll.at(-1) - switchScroll.at(-2))).toBeLessThan(20);
  expectFloor(await floor(frame));
  await frame.evaluate(() => {
    const rows = document.querySelectorAll('.program-register-summary-row');
    UOS.ProgramDisclosureRows.open(rows[7].getAttribute('data-disclosure-key'));
  });
  await page.setViewportSize({width:1024,height:720});
  await settled(frame);
  expectFloor(await floor(frame));
  await expect(frame.locator('.program-register-drawer-row:not([hidden])')).toHaveCount(1);
  await page.emulateMedia({reducedMotion:'reduce'});
  await frame.evaluate(() => UOS.ProgramDisclosureRows.closeScope('register'));
  const toggle = frame.locator('.program-register-row-toggle').first();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await settled(frame);
  expectFloor(await floor(frame));
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(frame.locator('.program-register-drawer-row:not([hidden])')).toHaveCount(0);
});

test('Register rebuild during motion cannot leave stale animation or reopen a closed drawer', async ({ page }) => {
  const frame = await setup(page);
  await frame.evaluate(async () => {
    const row = document.querySelector('.program-register-summary-row');
    UOS.ProgramDisclosureRows.open(row.getAttribute('data-disclosure-key'));
    await new Promise(r => setTimeout(r, 90));
    document.dispatchEvent(new Event('uos:privacy-changed'));
  });
  await settled(frame);
  expectFloor(await floor(frame));
  await frame.evaluate(() => UOS.ProgramDisclosureRows.closeScope('register'));
  await settled(frame);
  // Also allow the cancelled opening timeline's original deadline to pass.
  await page.waitForTimeout(350);
  await expect(frame.locator('.program-register-drawer-row:not([hidden])')).toHaveCount(0);
  expect(await frame.evaluate(() => UOS.ProgramDisclosureRows.activeKey('register'))).toBe('');
});
