const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function openRegister(page, owner, dates = { bumpInDate: '2026-10-17', bumpOutDate: '2026-10-19' }) {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === 'EVT' ? 'events' : 'nsa'}.html`);
  await expect(page.locator('iframe')).toHaveCount(1);
  const frame = page.frames().find(candidate => candidate !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const id = `${owner}-${owner === 'EVT' ? 'EVENT' : 'APP'}-DELIVERY`;
  await frame.evaluate(async ({ owner, id, dates }) => {
    await UOS.ProgramApp.updateWorkspace(workspace => {
      workspace.entities[owner === 'EVT' ? 'events' : 'applications'].push({
        id, owner, type: owner === 'EVT' ? 'event' : 'application', title: 'North Terrace event',
        status: 'received', dateReceived: '2026-10-16', jobId: 'EVT-INTERNAL-42',
        receipt: 'R-42', ...(owner === 'EVT' ? dates : {})
      });
      workspace.workspace.ownerMode = owner;
      workspace.workspace.destination = 'register';
      workspace.workspace.selectedEntityId = id;
      return workspace;
    });
  }, { owner, id, dates });
  await frame.locator(`tr[data-register-record="${id}"] [data-disclosure-toggle]`).click();
  const drawer = frame.locator(`[data-register-drawer-record="${id}"]`);
  await expect(drawer.locator('[data-register-detail-content]')).toBeVisible();
  return { frame, id, drawer };
}

test('EVT dates validate inline and persist without changing audit identity or legacy references', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const { frame, id, drawer } = await openRegister(page, 'EVT');
  const delivery = drawer.locator('.program-register-nsa-section--delivery');
  // Native date inputs have no implicit textbox role in Chromium.
  const dateIn = delivery.locator('[data-register-edit-key="bumpInDate"]');
  const dateOut = delivery.locator('[data-register-edit-key="bumpOutDate"]');
  await expect(dateIn).toHaveValue('2026-10-17');
  await expect(dateOut).toHaveValue('2026-10-19');
  await expect(drawer.locator('[data-register-readonly-key="eventAuditId"]')).toHaveText('EVT-INTERNAL-42');
  await expect(drawer.locator('[data-register-edit-key="eventAuditId"], [data-register-edit-key="jobId"]')).toHaveCount(0);
  const council = drawer.getByRole('textbox', { name: 'Council Event Number', exact: true });
  await expect(council).toHaveValue('');
  await council.fill('COA-EV-2026-001');
  await council.press('Tab');
  const event = () => frame.evaluate(id => UOS.ProgramApp.workspace().entities.events.find(event => event.id === id), id);
  await expect.poll(async () => (await event()).councilEventNumber).toBe('COA-EV-2026-001');
  const row = frame.locator(`tr[data-register-record="${id}"]`);
  await expect(row.locator('.program-register-table__reference-cell')).toHaveText('COA-EV-2026-001');
  await expect(row.locator('.program-register-table__app-id-cell')).toHaveText('EVT-INTERNAL-42');

  await dateOut.fill('2026-10-16');
  await dateOut.press('Tab');
  await expect(dateOut).toHaveAttribute('aria-invalid', 'true');
  await expect(delivery.locator('[data-register-date-error]:visible')).toContainText('cannot be before');
  expect((await event()).bumpOutDate).toBe('2026-10-19');
  await dateOut.fill('2026-10-17');
  await dateOut.press('Tab');
  await expect.poll(async () => (await event()).bumpOutDate).toBe('2026-10-17');
  await expect(dateOut).toHaveAttribute('aria-invalid', 'false');
  await dateIn.fill('');
  await dateIn.press('Tab');
  await expect.poll(async () => (await event()).bumpInDate).toBe('');
  expect((await event()).eventAuditId).toBe('EVT-INTERNAL-42');
  expect((await event()).jobId).toBe('EVT-INTERNAL-42');
  expect((await event()).id).toBe(id);
  expect((await event()).eventNumber).toBeUndefined();
  await frame.evaluate(async () => {
    const exported = UOS.ProgramModel.exportJson(UOS.ProgramApp.workspace());
    const restored = UOS.ProgramModel.importJson(exported);
    await UOS.ProgramApp.updateWorkspace(() => restored);
  });
  expect((await event()).councilEventNumber).toBe('COA-EV-2026-001');
  expect((await event()).bumpInDate).toBe('');
  expect((await event()).bumpOutDate).toBe('2026-10-17');
  await frame.evaluate(() => UOS.ProgramApp.updateWorkspace(workspace => {
    workspace.workspace.calendarCursor = '2026-10-17';
    return workspace;
  }));
  const scheduler = frame.locator(`tr[data-register-record="${id}"] [data-register-action="scheduler"]`);
  await expect(scheduler).toBeEnabled();
  await scheduler.click();
  await expect.poll(() => frame.evaluate(() => UOS.ProgramApp.workspace().workspace.destination)).toBe('scheduler');
  await expect(frame.locator(`[data-scheduler-milestone-event="${id}"]`)).toHaveCount(1);
  expect(await frame.evaluate(() => UOS.ProgramApp.workspace().entities.projects.length)).toBe(0);
  expect(errors).toEqual([]);
});

test('NSA Register retains its existing receipt and fields without EVT delivery dates', async ({ page }) => {
  const { frame, drawer, id } = await openRegister(page, 'NSA');
  await expect(drawer.locator('.program-register-nsa-section--delivery')).toBeVisible();
  await expect(drawer.locator('[data-register-edit-key="bumpInDate"], [data-register-edit-key="bumpOutDate"], [data-register-edit-key="councilEventNumber"]')).toHaveCount(0);
  await expect(frame.locator('.program-register-table thead .program-register-table__app-id-col')).toHaveText('App Id');
  const record = await frame.evaluate(id => UOS.ProgramApp.workspace().entities.applications.find(record => record.id === id), id);
  expect(record.receipt).toBe('R-42');
  expect(record.eventAuditId).toBeUndefined();
  expect(record.bumpInDate).toBeUndefined();
});

for (const withProject of [false, true]) {
  test(`Scheduler action reflects saved Event dates immediately ${withProject ? 'with' : 'without'} a Project`, async ({ page }) => {
    const { frame, id, drawer } = await openRegister(page, 'EVT', { bumpInDate: '', bumpOutDate: '' });
    if (withProject) await frame.evaluate(id => UOS.ProgramApp.updateWorkspace(workspace => UOS.ProgramModel.promoteRegisterRecord(workspace, id).workspace), id);
    const action = frame.locator(`tr[data-register-record="${id}"] [data-register-action="scheduler"]`);
    const bumpIn = drawer.locator('[data-register-edit-key="bumpInDate"]');
    const bumpOut = drawer.locator('[data-register-edit-key="bumpOutDate"]');
    const emptyState = 'unused';
    await expect(action).toHaveAttribute('data-shortcut-state', emptyState);
    await bumpIn.fill('2026-10-17');
    await bumpIn.press('Tab');
    await expect(action).toHaveAttribute('data-shortcut-state', 'in-use');
    await expect(action).toHaveClass(/program-register-action--linked/);
    await expect(action).toHaveClass(/is-available-module/);
    await expect(action).toHaveAttribute('data-linked-entity', 'true');
    await expect(action).toBeEnabled();
    await expect(bumpIn).toBeVisible();

    await bumpOut.fill('2026-10-19');
    await bumpOut.press('Tab');
    await bumpIn.fill('');
    await bumpIn.press('Tab');
    await expect(action).toHaveAttribute('data-shortcut-state', 'in-use');
    await bumpOut.fill('');
    await bumpOut.press('Tab');
    await expect(action).toHaveAttribute('data-shortcut-state', emptyState);
    await expect(action).not.toHaveClass(/program-register-action--linked/);
    await expect(action).not.toHaveAttribute('data-linked-entity', 'true');

    await bumpOut.fill('2026-10-19');
    await bumpOut.press('Tab');
    await expect(action).toHaveAttribute('data-shortcut-state', 'in-use');
    await expect(action).toBeEnabled();
    expect(await frame.evaluate(() => UOS.ProgramApp.workspace().entities.jobs.length)).toBe(0);
  });
}

for (const owner of ['EVT', 'NSA']) {
  test(`${owner} Register identifier order and title privacy preserve their field meanings`, async ({ page }) => {
    const { frame, id, drawer } = await openRegister(page, owner);
    await frame.evaluate(({ id, owner }) => UOS.ProgramApp.updateWorkspace(workspace => {
      const record = workspace.entities[owner === 'EVT' ? 'events' : 'applications'].find(record => record.id === id);
      record.applicantName = record.title;
      record.customerName = record.title;
      record.email = record.customerEmail = 'applicant@example.test';
      record.phone = record.customerPhone = '0412345678';
      if (owner === 'EVT') record.councilEventNumber = 'COA-020';
      return workspace;
    }), { id, owner });
    const table = frame.locator('.program-register-table');
    const row = table.locator(`tr[data-register-record="${id}"]`);
    await expect(table.locator('thead th').nth(1)).toHaveText(owner === 'EVT' ? 'Event ID' : /^Receipt/);
    await expect(table.locator('thead th').nth(2)).toHaveText(owner === 'EVT' ? /^Council Event Number/ : 'App Id');
    await expect(row.locator('td').nth(1)).toHaveText(owner === 'EVT' ? 'EVT-INTERNAL-42' : 'R-42');
    await expect(row.locator('td').nth(2)).toHaveText(owner === 'EVT' ? 'COA-020' : id);
    await expect(table.locator('colgroup col').nth(1)).toHaveClass(owner === 'EVT' ? /__app-id-col/ : /__reference-col/);
    const title = row.locator('.program-register-table__title-cell strong');
    const mask = await frame.evaluate(() => UOS.ProgramPrivacy.MASK);
    const expectedPrivateTitle = owner === 'EVT' ? 'North Terrace event' : mask;
    await expect(title).toHaveText(expectedPrivateTitle);
    await expect(title).toHaveAttribute('data-uos-tooltip', expectedPrivateTitle);
    const applicant = drawer.getByRole('textbox', { name: `${owner === 'EVT' ? 'Applicant' : 'Customer name'} masked by Privacy Mode`, exact: true });
    await expect(applicant).toHaveValue(mask);
    await expect(applicant).toHaveAttribute('readonly', '');
    if (owner === 'EVT') {
      await expect(drawer.locator('[data-register-edit-key="name"]')).toHaveValue('North Terrace event');
      await expect(drawer.getByRole('textbox', { name: 'Email Address masked by Privacy Mode', exact: true })).toHaveValue(mask);
      await expect(drawer.getByRole('textbox', { name: 'Phone Number masked by Privacy Mode', exact: true })).toHaveValue(mask);
    }
    await frame.evaluate(() => UOS.ProgramPrivacy.setEnabled(false));
    await expect(title).toHaveText('North Terrace event');
    await frame.evaluate(() => UOS.ProgramPrivacy.setEnabled(true));
    await expect(title).toHaveText(expectedPrivateTitle);
    await expect(applicant).toHaveValue(mask);
  });
}
