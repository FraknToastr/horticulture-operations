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

for (const owner of ['NSA', 'EVT']) for (const width of [1440, 390]) test(owner+' '+width+': full-day side-by-side week, overnight fragments and preserved scrolling', async ({ page }) => {
  await page.setViewportSize({width,height:1000});const {frame,ids}=await setup(page,owner);
  await expect(frame.locator('.scheduler-week-day')).toHaveCount(7);await expect(frame.locator('.scheduler-week-slot')).toHaveCount(336);
  await expect(frame.locator('.scheduler-week-hour-label').first()).toHaveText('00:00');await expect(frame.locator('.scheduler-week-hour-label').last()).toHaveText('24:00');
  await expect(card(frame,ids.overnight)).toHaveCount(2);await expect(card(frame,ids.midnightEnd)).toHaveCount(1);await expect(card(frame,ids.allDay)).toHaveCount(1);
  await expect(frame.locator('.scheduler-week-all-day').locator('[data-scheduler-job="'+ids.allDay+'"]')).toHaveCount(1);
  const overlap=frame.locator('[data-scheduler-date="2026-10-05"]');
  const geometry=await overlap.locator('.scheduler-week-job[data-scheduler-job="'+ids.morning+'"], .scheduler-week-job[data-scheduler-job="'+ids.overlap+'"]').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,height:b.height,width:b.width};}));
  expect(geometry).toHaveLength(2);expect(geometry[0].right).toBeLessThanOrEqual(geometry[1].left);expect(geometry[0].width).toBeCloseTo(geometry[1].width,1);
  expect(geometry[1].top).toBeLessThan(geometry[0].bottom);expect(geometry[0].height).toBeCloseTo(188,1);expect(geometry[1].height).toBeCloseTo(188,1);
  expect(await frame.locator('.scheduler-week-slot').evaluateAll(nodes=>nodes.every(n=>Math.abs(n.getBoundingClientRect().height-48)<0.1))).toBe(true);
  await expect(frame.locator('[data-scheduler-band]')).toHaveCount(0);
 const scroller=frame.locator('.program-calendar-scroll');await scroller.evaluate(el=>el.scrollTop=750);const before=await scroller.evaluate(el=>el.scrollTop);
 await frame.evaluate(id=>UOS.ProgramSchedulerUI.focusCalendarJob(id),ids.overnight);await expect(frame.locator('[data-scheduler-form]')).toBeVisible();expect(await scroller.evaluate(el=>el.scrollTop)).toBe(before);
 for(const c of await card(frame,ids.overnight).all())await expect(c).toHaveClass(/is-selected/);
 await frame.evaluate(id=>UOS.ProgramSchedulerUI.focusCalendarJob(id),ids.allDay);await frame.locator('[data-scheduler-form] button[type="submit"]').click();await expect(frame.locator('[data-program-persistence]')).toHaveText('Saved');expect(await scroller.evaluate(el=>el.scrollTop)).toBe(before);
 const sticky=await scroller.evaluate(el=>({head:el.querySelector('.scheduler-week-head').getBoundingClientRect().top,viewport:el.getBoundingClientRect().top}));expect(Math.abs(sticky.head-sticky.viewport)).toBeLessThanOrEqual(1);
 await scroller.evaluate(el=>{el.scrollTop=el.scrollHeight;el.scrollLeft=200;});const end=await scroller.evaluate(el=>({bottom:el.scrollTop+el.clientHeight,height:el.scrollHeight,gutterLeft:el.querySelector('.scheduler-week-gutter').getBoundingClientRect().left,viewportLeft:el.getBoundingClientRect().left}));
 expect(end.height-end.bottom).toBeLessThanOrEqual(1);expect(Math.abs(end.gutterLeft-end.viewportLeft)).toBeLessThanOrEqual(1);
 await frame.getByRole('button',{name:'Month',exact:true}).click();await expect(frame.locator('.scheduler-week-slot')).toHaveCount(0);await frame.getByRole('button',{name:'Week',exact:true}).click();expect(await scroller.evaluate(el=>el.querySelector('[data-scheduler-minute="360"]').getBoundingClientRect().top-el.querySelector('.scheduler-week-head').getBoundingClientRect().bottom)).toBeCloseTo(0,0);
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
  await expect(card(frame, ids.allDay)).toHaveCount(1);
  await expect(card(frame, ids.allDay).first()).toHaveClass(/scheduler-week-job/);
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
  expect(first.replace(/\r\n /g, '')).toMatch(/SUMMARY:.* - Private depot address/); expect(first).not.toContain('LOCATION:');
  await frame.evaluate(() => window.restoreOutlookSave());
  const count = await frame.evaluate(() => window.UOS.ProgramApp.workspace().entities.statusEvents.length);
  await frame.locator('[data-scheduler-outlook]').click();
  const repeat = page.waitForEvent('download'); await modal.getByRole('button', { name: 'Save and download', exact: true }).click();
  const second = await downloadText(await repeat);
  expect(second.match(/UID:.*/)[0]).toBe(first.match(/UID:.*/)[0]);
  expect(await frame.evaluate(() => window.UOS.ProgramApp.workspace().entities.statusEvents.length)).toBe(count);
});

for (const owner of ['NSA', 'EVT']) test(owner + ': Outlook export validates transient subject, reminder and CC before saving', async ({ page }) => {
  const { frame, ids } = await setup(page, owner);
  await frame.evaluate(id => window.UOS.ProgramSchedulerUI.focusCalendarJob(id), ids.morning);
  const form = frame.locator('[data-scheduler-form]');
  await form.locator('[name="location"]').fill('North Terrace, Adelaide');
  await form.locator('[name="startTime"]').fill('09:30');
  await frame.evaluate(() => {
    window.UOS.ProgramPrivacy.setEnabled(true);
    const original = window.UOS.ProgramApp.updateWorkspace;
    window.outlookSaveCalls = 0;
    window.UOS.ProgramApp.updateWorkspace = (...args) => { window.outlookSaveCalls++; return original(...args); };
  });
  await frame.locator('[data-scheduler-outlook]').click();
  const modal = frame.locator('.scheduler-outlook-dialog');
  await expect(modal.locator('[name="exportSubject"]')).toHaveValue(/ - North Terrace, Adelaide$/);
  await expect(modal.locator('[name="exportReminder"]')).toHaveValue('0');
  await expect(modal.locator('[data-outlook-organizer]')).toBeHidden();
  await modal.locator('[name="exportCc"]').fill('copy@example.com; invalid-address');
  await expect(modal.locator('[data-outlook-organizer]')).toBeVisible();
  await modal.getByRole('button', { name: 'Save and download', exact: true }).click();
  await expect(modal.locator('[data-outlook-error]')).toContainText('each CC recipient');
  await modal.locator('[name="exportCc"]').fill('copy@example.com; COPY@example.com, other@example.org');
  await modal.getByRole('button', { name: 'Save and download', exact: true }).click();
  await expect(modal.locator('[data-outlook-error]')).toContainText('Your email');
  await modal.locator('[name="exportOrganizerEmail"]').fill('owner@example.com');
  await modal.locator('[name="exportSubject"]').fill(' ');
  await modal.getByRole('button', { name: 'Save and download', exact: true }).click();
  await expect(modal.locator('[data-outlook-error]')).toContainText('calendar subject');
  expect(await frame.evaluate(() => window.outlookSaveCalls)).toBe(0);
  expect(await frame.evaluate(id => window.UOS.ProgramApp.workspace().entities.jobs.find(j => j.id === id).startTime, ids.morning)).toBe('09:00');
  await modal.locator('[name="exportSubject"]').fill('Site inspection - North Terrace');
  await modal.locator('[name="exportReminder"]').selectOption('1440');
  const download = page.waitForEvent('download');
  await modal.getByRole('button', { name: 'Save and download', exact: true }).click();
  const contents = (await downloadText(await download)).replace(/\r\n /g, '');
  expect(contents).toContain('SUMMARY:Site inspection - North Terrace');
  expect(contents).toContain('TRIGGER:-P1D');
  expect(contents).toContain('ORGANIZER:mailto:owner@example.com');
  expect((contents.match(/ATTENDEE;/g) || []).length).toBe(2);
  expect(contents).not.toContain('LOCATION:');
  expect(await frame.evaluate(() => window.outlookSaveCalls)).toBe(1);
  const saved = await frame.evaluate(id => window.UOS.ProgramApp.workspace().entities.jobs.find(j => j.id === id), ids.morning);
  expect(saved.startTime).toBe('09:30');
  expect(JSON.stringify(saved)).not.toMatch(/copy@example|owner@example|Site inspection - North Terrace/);
  await frame.locator('[data-scheduler-outlook]').click();
  await expect(modal.locator('[name="exportCc"]')).toHaveValue('');
  await expect(modal.locator('[name="exportOrganizerEmail"]')).toHaveValue('');
  await expect(modal.locator('[name="exportReminder"]')).toHaveValue('0');
  await expect(modal.locator('[name="exportSubject"]')).not.toHaveValue('Site inspection - North Terrace');
  await expect(modal.locator('[data-outlook-organizer]')).toBeHidden();
});
