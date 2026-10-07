const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');
async function setup(page, owner = 'NSA') {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const ids = await frame.evaluate(async owner => {
    const UOS = window.UOS, ids = {};
    await UOS.ProgramApp.updateWorkspace(input => {
      let ws = input;
      const record = { id: `${owner === 'NSA' ? 'NSA-APP' : 'EVT-EVENT'}-HOURLY-APP`, owner, type: owner === 'NSA' ? 'application' : 'event', title: '24-hour depot', status: 'received', dateReceived: '2026-10-01' };
      ws.entities[owner === 'NSA' ? 'applications' : 'events'].push(record);
      const promoted = UOS.ProgramModel.promoteRegisterRecord(ws, record.id);
      ws = UOS.ProgramStatus.migrate(promoted.workspace); ids.record = record.id; ids.project = promoted.project.id;
      const schedules = {
        allDay: { allDay: true },
        morning: { startTime: '09:00', endTime: '11:00', allDay: false },
        overlap: { startTime: '10:00', endTime: '12:00', allDay: false },
        overnight: { startTime: '23:00', endTime: '01:00', endDate: '2026-10-06', allDay: false },
        midnightEnd: { startTime: '22:00', endTime: '00:00', endDate: '2026-10-06', allDay: false },
        short: { startTime: '14:00', endTime: '14:05', allDay: false }
      };
      for (const [name, schedule] of Object.entries(schedules)) {
        const task = UOS.ProgramPlannerModel.saveTask(ws, promoted.project.id, null, { title: name, description: 'Depot operation', operational: true, section: 'Planning and Approval', status: 'Not Started' });
        const draft = UOS.ProgramPlannerModel.createDraftJob(task.workspace, promoted.project.id, task.task.id);
        ids[name] = draft.job.id;
        ws = UOS.ProgramSchedulerModel.scheduleJob(draft.workspace, draft.job.id, { startDate: '2026-10-05', endDate: '2026-10-05', crewId: name, ...schedule });
      }
      ws.workspace.calendarCursor = '2026-10-05'; return ws;
    });
    await UOS.ProgramApp.navigateWithContext('scheduler', ids.record);
    return ids;
  }, owner);
  return { frame, ids };
}
const card = (frame, id) => frame.locator(`.program-calendar-job[data-scheduler-job="${id}"]`);
async function downloadText(download) {
  const stream = await download.createReadStream(); let text = '';
  for await (const chunk of stream) text += chunk.toString();
  return text;
}

for (const owner of ['NSA', 'EVT']) for (const width of [1440, 390]) test(`${owner} ${width}: full-day week, overnight jobs, overlap lanes and preserved scrolling`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  const { frame, ids } = await setup(page, owner);
  await expect(frame.locator('.scheduler-week-day')).toHaveCount(7);
  await expect(frame.locator('.scheduler-week-hour')).toHaveCount(168);
  await expect(frame.locator('.scheduler-week-hour-label').first()).toHaveText('00:00');
  await expect(frame.locator('.scheduler-week-hour-label').last()).toHaveText('24:00');
  await expect(card(frame, ids.overnight)).toHaveCount(2);
  await expect(card(frame, ids.midnightEnd)).toHaveCount(1);
  await expect(card(frame, ids.allDay)).toHaveCount(1);
  await expect(frame.locator('.scheduler-week-all-day').locator(`[data-scheduler-job="${ids.allDay}"]`)).toHaveCount(1);
  const geometry = await frame.evaluate(ids => {
    const rect = id => document.querySelector(`.scheduler-week-job[data-scheduler-job="${id}"]`).getBoundingClientRect();
    const a = rect(ids.morning), b = rect(ids.overlap), short = rect(ids.short);
    const day = document.querySelector('.scheduler-week-day').getBoundingClientRect();
    return { top: a.top - day.top, height: a.height, separated: a.right <= b.left, shortHeight: short.height, dayWidth: day.width, totalHeight: day.height };
  }, ids);
  expect(geometry.top).toBeCloseTo(432, 0); expect(geometry.height).toBeCloseTo(96, 0);
  expect(geometry.separated).toBe(true); expect(geometry.shortHeight).toBeCloseTo(4, 0);
  expect(geometry.dayWidth).toBeGreaterThanOrEqual(140); expect(geometry.totalHeight).toBe(1152);
  const scroller = frame.locator('.program-calendar-scroll');
  await scroller.evaluate(el => { el.scrollTop = 750; });
  const before = await scroller.evaluate(el => el.scrollTop);
  await frame.evaluate(id => window.UOS.ProgramSchedulerUI.focusCalendarJob(id), ids.overnight);
  await expect(frame.locator('[data-scheduler-form]')).toBeVisible();
  expect(await scroller.evaluate(el => el.scrollTop)).toBe(before);
  await expect(card(frame, ids.overnight).first()).toHaveClass(/is-selected/);
  const selectedSlots = await card(frame, ids.overnight).evaluateAll(cards => cards.map(card => {
    const rect = card.getBoundingClientRect(), day = card.closest('.scheduler-week-day').getBoundingClientRect();
    return { position: getComputedStyle(card).position, top: rect.top - day.top, height: rect.height, dayHeight: day.height, ants: getComputedStyle(card, '::after').animationName };
  }));
  expect(selectedSlots).toEqual([
    { position: 'absolute', top: 1104, height: 48, dayHeight: 1152, ants: 'scheduler-selection-ants' },
    { position: 'absolute', top: 0, height: 48, dayHeight: 1152, ants: 'scheduler-selection-ants' }
  ]);
  await frame.evaluate(id => window.UOS.ProgramSchedulerUI.focusCalendarJob(id), ids.allDay);
  await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await scroller.evaluate(el => el.scrollTop)).toBe(before);
  await frame.locator('[data-scheduler-form] button[type="submit"]').click();
  await expect(frame.locator('[data-program-persistence]')).toHaveText('Saved');
  expect(await scroller.evaluate(el => el.scrollTop)).toBe(before);
  const sticky = await scroller.evaluate(el => ({ head: el.querySelector('.scheduler-week-head').getBoundingClientRect().top, viewport: el.getBoundingClientRect().top }));
  expect(Math.abs(sticky.head - sticky.viewport)).toBeLessThanOrEqual(1);
  await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; el.scrollLeft = 200; });
  const end = await scroller.evaluate(el => ({ bottom: el.scrollTop + el.clientHeight, height: el.scrollHeight, gutterLeft: el.querySelector('.scheduler-week-gutter').getBoundingClientRect().left, viewportLeft: el.getBoundingClientRect().left }));
  expect(end.height - end.bottom).toBeLessThanOrEqual(1); expect(Math.abs(end.gutterLeft - end.viewportLeft)).toBeLessThanOrEqual(1);
  await scroller.evaluate(el => { el.scrollTop = 400; el.scrollLeft = 0; });
  await frame.locator('.program-scheduler-calendar').screenshot({ path: info.outputPath(`${owner}-${width}-hourly.png`) });
  await frame.getByRole('button', { name: 'Month', exact: true }).click();
  await expect(frame.locator('.scheduler-week-hour')).toHaveCount(0);
  await frame.getByRole('button', { name: 'Week', exact: true }).click();
  expect(await scroller.evaluate(el => el.scrollTop)).toBe(0);
});

for (const owner of ['NSA', 'EVT']) test(`${owner}: cancel, all-day download and conversion to saved timed job`, async ({ page }) => {
  const { frame, ids } = await setup(page, owner);
  await frame.evaluate(id => window.UOS.ProgramSchedulerUI.focusCalendarJob(id), ids.allDay);
  const form = frame.locator('[data-scheduler-form]'), trigger = frame.locator('[data-scheduler-outlook]');
  await trigger.click();
  let modal = frame.locator('.scheduler-outlook-dialog');
  await modal.locator('[name="eventMode"]').selectOption('timed');
  await modal.locator('[name="exportStartTime"]').fill('23:00');
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(form.locator('[name="allDay"]')).toBeChecked(); await expect(trigger).toBeFocused();
  await trigger.click(); await modal.press('Escape'); await expect(modal).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click();
  const allDayDownload = page.waitForEvent('download');
  await modal.getByRole('button', { name: 'Save and download', exact: true }).click();
  const allDay = await downloadText(await allDayDownload);
  expect(allDay).toContain('DTSTART;VALUE=DATE:20261005'); expect(allDay).toContain('DTEND;VALUE=DATE:20261006');
  await trigger.click();
  await modal.locator('[name="eventMode"]').selectOption('timed');
  await modal.getByRole('button', { name: 'Save and download', exact: true }).click();
  await expect(modal.locator('[data-outlook-error]')).toBeVisible();
  await modal.locator('[name="exportStartTime"]').fill('09:15');
  await modal.locator('[name="exportEndTime"]').fill('10:30');
  const timedDownload = page.waitForEvent('download');
  await modal.getByRole('button', { name: 'Save and download', exact: true }).click();
  const timed = await downloadText(await timedDownload);
  expect(timed).toContain('DTSTART:20261004T224500Z'); expect(timed).toContain('DTEND:20261005T000000Z');
  await expect(form.locator('[name="allDay"]')).not.toBeChecked();
  await expect(form.locator('[name="startTime"]')).toHaveValue('09:15');
  await expect(form.locator('[name="endTime"]')).toHaveValue('10:30');
  const saved = await frame.evaluate(id => window.UOS.ProgramApp.workspace().entities.jobs.find(j => j.id === id), ids.allDay);
  expect(saved.allDay).toBe(false); expect(saved.startTime).toBe('09:15');
  await expect(card(frame, ids.allDay)).toHaveClass(/scheduler-week-job/);
  await page.reload();
  const reloaded = page.frames().find(f => f !== page.mainFrame());
  await reloaded.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  expect(await reloaded.evaluate(id => window.UOS.ProgramApp.workspace().entities.jobs.find(j => j.id === id).startTime, ids.allDay)).toBe('09:15');
});

test('failed persistence prevents downloads and retains edited times for correction', async ({ page }) => {
  const { frame, ids } = await setup(page);
  await frame.evaluate(id => window.UOS.ProgramSchedulerUI.focusCalendarJob(id), ids.allDay);
  await frame.locator('[data-scheduler-outlook]').click();
  const modal = frame.locator('.scheduler-outlook-dialog');
  await modal.locator('[name="eventMode"]').selectOption('timed');
  await modal.locator('[name="exportStartTime"]').fill('09:00'); await modal.locator('[name="exportEndTime"]').fill('10:00');
  await frame.evaluate(() => { window.UOS.ProgramApp.updateWorkspace = () => Promise.reject(new Error('Simulated storage failure')); });
  const downloads = []; page.on('download', file => downloads.push(file));
  await modal.getByRole('button', { name: 'Save and download', exact: true }).click();
  await expect(modal.locator('[data-outlook-error]')).toHaveText('Simulated storage failure');
  await expect(modal.getByRole('button', { name: 'Save and download', exact: true })).toBeEnabled();
  await expect(frame.locator('[data-scheduler-form] [name="startTime"]')).toHaveValue('09:00');
  expect(downloads).toHaveLength(0);
});

test('timed export protects location, prevents duplicate submissions and does not repeat status events', async ({ page }) => {
  const { frame, ids } = await setup(page);
  await frame.evaluate(id => window.UOS.ProgramSchedulerUI.focusCalendarJob(id), ids.morning);
  const form = frame.locator('[data-scheduler-form]');
  await form.locator('[name="location"]').fill('Private depot address');
  await form.locator('[name="updatesApplicationStatus"]').check();
  await frame.evaluate(() => {
    window.UOS.ProgramPrivacy.setEnabled(true);
    const original = window.UOS.ProgramApp.updateWorkspace;
    window.outlookSaveCalls = 0;
    const gate = new Promise(resolve => { window.releaseOutlookSave = resolve; });
    window.UOS.ProgramApp.updateWorkspace = async (...args) => {
      window.outlookSaveCalls++;
      const saved = await original(...args); await gate; return saved;
    };
    window.restoreOutlookSave = () => { window.UOS.ProgramApp.updateWorkspace = original; };
  });
  await frame.locator('[data-scheduler-outlook]').click();
  const modal = frame.locator('.scheduler-outlook-dialog');
  await expect(modal.locator('[name="exportStartTime"]')).toHaveValue('09:00');
  await modal.locator('form').evaluate(node => { node.requestSubmit(); node.requestSubmit(); });
  await expect(modal.locator('[data-outlook-download]')).toBeDisabled();
  expect(await frame.evaluate(() => window.outlookSaveCalls)).toBe(1);
  const download = page.waitForEvent('download'); await frame.evaluate(() => window.releaseOutlookSave());
  const first = await downloadText(await download);
  expect(first).not.toContain('Private depot address'); expect(first).not.toContain('LOCATION:');
  await frame.evaluate(() => window.restoreOutlookSave());
  const count = await frame.evaluate(() => window.UOS.ProgramApp.workspace().entities.statusEvents.length);
  await frame.locator('[data-scheduler-outlook]').click();
  const repeat = page.waitForEvent('download'); await modal.getByRole('button', { name: 'Save and download', exact: true }).click();
  const second = await downloadText(await repeat);
  expect(second.match(/UID:.*/)[0]).toBe(first.match(/UID:.*/)[0]);
  expect(await frame.evaluate(() => window.UOS.ProgramApp.workspace().entities.statusEvents.length)).toBe(count);
});
