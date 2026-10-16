const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

for (const owner of ['NSA', 'EVT']) {
  test(owner + ': MetroMap has no Paste button and its label follows activation and storage removal', async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.route('https://api.metromap.com.au/**', route => route.fulfill({
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
    }));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/src/program-planner/' + (owner === 'NSA' ? 'nsa' : 'events') + '.html');
    let frame = page.frames().find(f => f !== page.mainFrame());
    async function openMap() {
      frame = page.frames().find(f => f !== page.mainFrame());
      await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
      await frame.evaluate(async owner => {
        const id = owner + (owner === 'NSA' ? '-APP-' : '-EVENT-') + 'METRO-LABEL';
        await UOS.ProgramApp.updateWorkspace(workspace => {
          const list = workspace.entities[owner === 'NSA' ? 'applications' : 'events'];
          if (!list.some(record => record.id === id)) list.push({ id, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'MetroMap activation', status: 'received' });
          workspace.workspace.selectedEntityId = id;
          workspace.workspace.selectedProjectId = '';
          return workspace;
        });
        await UOS.ProgramApp.navigate('map');
      }, owner);
      await expect(frame.locator('#activateMetroMap')).toBeVisible();
    }
    await openMap();
    const button = () => frame.locator('#activateMetroMap');
    const dialog = () => frame.locator('#metroMapActivation');
    async function activate(remember) {
      await button().click();
      await expect(dialog().getByRole('button', { name: 'Paste', exact: true })).toHaveCount(0);
      await dialog().locator('#metroMapKey').fill('test-key-user-entered');
      await dialog().locator('[data-metro-save]').setChecked(remember);
      await dialog().getByRole('button', { name: 'Activate', exact: true }).click();
      await expect(dialog()).not.toBeVisible();
      await expect(button()).toHaveText('Metromap Active');
      await expect(button()).toHaveAttribute('aria-label', 'Metromap Active');
    }
    await expect(button()).toHaveText('Activate Metromap');
    await activate(false);
    await activate(true);
    await page.reload();
    await openMap();
    await expect(button()).toHaveText('Metromap Active');
    await button().click();
    await dialog().getByRole('button', { name: 'Remove saved key', exact: true }).click();
    await expect(button()).toHaveText('Activate Metromap');
    expect(await frame.evaluate(() => UOS.MetroMapCredentials.status().active)).toBe(true);
    await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();

    // Storage changes from another document must update this iframe immediately.
    await activate(true);
    await page.evaluate(() => localStorage.removeItem('uos.metromap.user-key'));
    await expect(button()).toHaveText('Activate Metromap');
    await expect(button()).toHaveAttribute('aria-label', 'Activate Metromap');
    await activate(true);
    await page.evaluate(() => localStorage.clear());
    await expect(button()).toHaveText('Activate Metromap');

    // The same-document browser-storage controls are reconciled on returning focus.
    await activate(true);
    await frame.evaluate(() => { localStorage.removeItem('uos.metromap.user-key'); window.dispatchEvent(new Event('focus')); });
    await expect(button()).toHaveText('Activate Metromap');
    expect(await frame.evaluate(() => UOS.MetroMapCredentials.status().active)).toBe(true);
    expect(errors).toEqual([]);
  });
}
