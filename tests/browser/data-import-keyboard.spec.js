const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test.use({ viewport: { width: 1440, height: 900 }, screenshot: 'off', trace: 'off', video: 'off' });

for (const owner of ['NSA', 'EVT']) {
  test(`${owner}: Browse Files skips the native input and keyboard and drop imports still work`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const frame = page.frames().find(candidate => candidate !== page.mainFrame());
    await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
    await frame.evaluate(async () => {
      await UOS.ProgramApp.updateWorkspace(workspace => workspace);
      await UOS.ProgramApp.navigate('data');
    });
    const browse = frame.getByRole('button', { name: 'Browse Files', exact: true });
    await browse.focus();
    await browse.press('Tab');
    await expect(frame.getByRole('button', { name: 'Run checks', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(browse).toBeFocused();

    const recordId = `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-KEYBOARD-IMPORT`;
    const contents = await frame.evaluate(({ owner, recordId }) => {
      const workspace = UOS.ProgramModel.blank();
      workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id: recordId, owner, title: 'Keyboard import test', status: 'received', dateReceived: '2026-10-01' });
      return UOS.ProgramData.exportJson(workspace, UOS.ProgramAppConfig.current());
    }, { owner, recordId });
    const file = { name: `${owner}-keyboard-import.json`, mimeType: 'application/json', buffer: Buffer.from(contents) };
    const preview = frame.locator('[data-program-import-modal]');
    const containsRecord = () => frame.evaluate(({ owner, recordId }) => UOS.ProgramApp.workspace().entities[owner === 'NSA' ? 'applications' : 'events'].some(record => record.id === recordId), { owner, recordId });

    for (const key of ['Enter', 'Space']) {
      const chooserPromise = page.waitForEvent('filechooser');
      await browse.press(key);
      const chooser = await chooserPromise;
      await chooser.setFiles(file);
      await expect(preview).toBeVisible();
      await expect(preview.locator('[data-program-import-apply]')).toBeEnabled();
      expect(await containsRecord()).toBe(false);
      await preview.locator('[data-program-import-cancel]').last().click();
      await expect(preview).not.toBeVisible();
      expect(await containsRecord()).toBe(false);
    }

    await frame.evaluate(({ contents, name }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([contents], name, { type: 'application/json' }));
      const zone = document.querySelector('[data-program-dropzone]');
      zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }, { contents, name: file.name });
    await expect(preview).toBeVisible();
    await expect(preview.locator('[data-program-import-apply]')).toBeEnabled();
    expect(await containsRecord()).toBe(false);
    await preview.locator('[data-program-import-apply]').click();
    await expect(frame.locator('[data-program-data-status]')).toHaveText('Import applied atomically.');
    await expect(preview).not.toBeVisible();
    await expect.poll(containsRecord).toBe(true);
  });
}
