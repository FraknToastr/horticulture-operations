const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function readyFrame(page) {
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  return frame;
}

async function damagedStartup(page) {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto('/src/program-planner/nsa.html');
  const first = await readyFrame(page);
  const raw = await first.evaluate(async () => {
    await UOS.ProgramApp.updateWorkspace(ws => {
      ws.entities.applications.push({ id: 'NSA-APP-RECOVERY-RETAIN', owner: 'NSA', type: 'application', title: 'Retain until deliberate recovery', status: 'received', dateReceived: '2026-10-01' });
      return ws;
    });
    const source = await UOS.ProgramStorage.getRaw();
    source.entities.statusEvents.push({ id: 'NSA-SEVT-1HILOCN', owner: 'NSA', type: 'statusEvent', entityId: 'NSA-JOB-MISSING', entityType: 'job', fromStatus: 'draft', toStatus: 'scheduled', actor: 'Recovery fixture', reason: 'Orphaned test event', at: '2026-10-01T00:00:00Z' });
    return { source, canonical: UOS.ProgramStorage.canonical, config: UOS.ProgramAppConfig.current() };
  });
  await page.route('**/recovery-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<script>window.UOS={ProgramAppConfig:{current:()=>('+JSON.stringify(raw.config)+')}}</script><script src="/src/shared/js/storage.js"></script>' }));
  await page.goto('/recovery-fixture.html');
  await page.waitForFunction(() => window.UOS?.storage);
  await page.evaluate(async ({source, canonical}) => { await UOS.storage.set(canonical.app, canonical.name, source); }, raw);
  await page.goto('/src/program-planner/nsa.html');
  const frame = await readyFrame(page);
  await expect(frame.locator('[data-program-startup-recovery]')).toBeVisible();
  return { frame, raw: raw.source };
}

test('orphaned status event opens Settings recovery; retry remains usable and preserves raw data', async ({ page }) => {
  const { frame, raw } = await damagedStartup(page);
  await expect(frame.locator('[data-program-recovery-error]')).toContainText('NSA-SEVT-1HILOCN references a missing status target');
  await expect(frame.locator('[data-program-view="data"]')).toBeVisible();
  await frame.locator('details.program-danger-zone summary').click();
  await expect(frame.locator('[data-program-delete-stored]')).toBeVisible();
  await frame.locator('[data-program-startup-recovery] [data-program-retry]').click();
  await expect(frame.locator('[data-program-startup-recovery]')).toBeVisible();
  expect(await frame.evaluate(() => UOS.ProgramApp.snapshot().startupRecovery)).toBe(true);
  expect(await frame.evaluate(() => UOS.ProgramStorage.getRaw())).toEqual(raw);
  // An unrelated startup failure still has an explicit Settings escape route.
  await frame.evaluate(() => { window.savedRawReader = UOS.ProgramStorage.getRaw; UOS.ProgramStorage.getRaw = () => Promise.reject(new Error('Injected storage read failure')); });
  await frame.locator('[data-program-startup-recovery] [data-program-retry]').click();
  await expect(frame.locator('[data-program-error]')).toBeVisible();
  await frame.evaluate(() => { UOS.ProgramStorage.getRaw = window.savedRawReader; });
  await frame.locator('[data-program-recovery-settings]').click();
  await expect(frame.locator('[data-program-view="data"]')).toBeVisible();
  expect(await frame.evaluate(() => UOS.ProgramStorage.getRaw())).toEqual(raw);
});

test('Danger zone backs up the damaged stored revision before deliberate deletion', async ({ page }) => {
  const { frame, raw } = await damagedStartup(page);
  await frame.locator('details.program-danger-zone summary').click();
  await frame.locator('[data-program-delete-stored]').click();
  const confirm = frame.locator('[data-program-delete-confirm]');
  await expect(confirm).toBeDisabled();
  const downloadEvent = page.waitForEvent('download');
  await frame.locator('[data-program-delete-backup]').click();
  const download = await downloadEvent;
  expect(JSON.parse(await fs.readFile(await download.path(), 'utf8'))).toEqual(raw);
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect.poll(() => frame.evaluate(() => UOS.ProgramStorage.getRaw())).toBeUndefined();
  expect(await frame.evaluate(() => UOS.ProgramApp.snapshot().startupRecovery)).toBe(false);
  await expect(frame.locator('[data-program-startup-recovery]')).toHaveCount(0);
});

test('recovery deletion keeps a newer damaged revision when its backup becomes stale', async ({ page }) => {
  const { frame, raw } = await damagedStartup(page);
  await frame.locator('details.program-danger-zone summary').click();
  await frame.locator('[data-program-delete-stored]').click();
  await frame.locator('[data-program-delete-backup]').click();
  await expect(frame.locator('[data-program-delete-confirm]')).toBeEnabled();
  const newer = await frame.evaluate(async source => {
    source.workspaceRevision += 1;
    source.entities.applications[0].title = 'Newer revision must survive stale deletion';
    await UOS.storage.set(UOS.ProgramStorage.canonical.app, UOS.ProgramStorage.canonical.name, source);
    return source;
  }, raw);
  await frame.locator('[data-program-delete-confirm]').click();
  await expect(frame.locator('[data-program-data-status]')).toContainText('Failed to delete');
  expect(await frame.evaluate(() => UOS.ProgramStorage.getRaw())).toEqual(newer);
});
