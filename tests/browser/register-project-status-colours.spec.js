const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

test('Register keeps pending yellow, Created fill and subdued In Progress pink distinct', async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/src/program-planner/nsa.html');
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  await frame.evaluate(async () => {
    await UOS.ProgramApp.updateWorkspace(ws => {
      ws.entities.applications.push(...['PENDING', 'WORKING', 'CREATED'].map(key => ({
        id: `NSA-APP-COLOUR-${key}`, owner: 'NSA', title: `${key} colour check`,
        status: 'received', dateReceived: '2026-10-05'
      })));
      ws.workspace.destination = 'register';
      return UOS.ProgramModel.promoteRegisterRecord(ws, 'NSA-APP-COLOUR-CREATED').workspace;
    });
    // Establish the test's current-work state through the automatic-signal API.
    await UOS.ProgramApp.executeStatusCommand({
      entityId: 'NSA-APP-COLOUR-WORKING', entityType: 'application', to: 'in_progress',
      source: 'automatic', action: 'Work started fixture signal'
    });
  });
  const row = key => frame.locator(`tr[data-register-record="NSA-APP-COLOUR-${key}"]`);
  const background = locator => locator.evaluate(node => getComputedStyle(node).backgroundColor);
  const pending = row('PENDING').locator('.program-register-project-state');
  const created = row('CREATED').locator('.program-register-project-state');
  const progress = row('WORKING').locator('.program-status-pill');
  await expect(pending).toHaveText('Not Created');
  await expect(created).toHaveText('Created');
  await expect(progress).toHaveText('In Progress');
  await expect.poll(() => background(pending)).toBe('rgb(255, 255, 0)');
  await expect.poll(() => background(progress)).toBe('rgb(243, 227, 232)');
  expect(await created.evaluate(node => {
    const probe = document.createElement('span'); probe.style.background = 'var(--uos-brand-soft)'; node.append(probe);
    const matches = getComputedStyle(node).backgroundColor === getComputedStyle(probe).backgroundColor;
    probe.remove(); return matches;
  })).toBe(true);
  await row('WORKING').locator('td').first().hover();
  await row('WORKING').evaluate(node => node.classList.add('is-selected'));
  await page.mouse.move(0, 0);
  await expect.poll(() => background(progress)).toBe('rgb(243, 227, 232)');
  await expect.poll(() => background(pending)).toBe('rgb(255, 255, 0)');
  await expect(row('PENDING').locator('[data-register-action="planner"]')).toBeDisabled();
});
