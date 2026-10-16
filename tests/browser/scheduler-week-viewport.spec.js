const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

for (const owner of ['NSA', 'EVT']) {
  test(`${owner} Week opens at 6am and draft handles stay below the date header`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.setViewportSize({ width: 1600, height: 1000 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
    const frame = page.frames().find(candidate => candidate !== page.mainFrame());
    await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
    const ids = await frame.evaluate(async owner => {
      const ids = { record: `${owner}-${owner === 'NSA' ? 'APP' : 'EVENT'}-VIEWPORT` };
      await UOS.ProgramApp.updateWorkspace(workspace => {
        workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push({
          id: ids.record, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Viewport fixture', status: 'received'
        });
        const promoted = UOS.ProgramModel.promoteRegisterRecord(workspace, ids.record);
        workspace = UOS.ProgramStatus.migrate(promoted.workspace);
        for (const [key, schedule] of Object.entries({
          early: { startTime: '02:00', endTime: '04:00' },
          earlyOverlap: { startTime: '03:00', endTime: '05:00' },
          allDay: { allDay: true },
          draft: null
        })) {
          const task = UOS.ProgramPlannerModel.saveTask(workspace, promoted.project.id, null, {
            title: key, description: 'Calendar viewport regression', section: 'Planning and Approval', operational: true, status: 'Not Started'
          });
          const draft = UOS.ProgramPlannerModel.createDraftJob(task.workspace, promoted.project.id, task.task.id);
          workspace = draft.workspace;
          ids[key] = draft.job.id;
          if (schedule) workspace = UOS.ProgramSchedulerModel.scheduleJob(workspace, draft.job.id, {
            startDate: '2026-10-05', endDate: '2026-10-05', allDay: false, ...schedule
          });
        }
        workspace.workspace.calendarCursor = '2026-10-05';
        return workspace;
      });
      await UOS.ProgramApp.navigateWithContext('scheduler', ids.record);
      return ids;
    }, owner);
    const scroller = frame.locator('.program-calendar-scroll');
    const slot = minute => frame.locator(`[data-scheduler-date="2026-10-05"] [data-scheduler-minute="${minute}"]`);
    const firstSlotOffset = minute => frame.evaluate(minute => {
      const slot = document.querySelector(`[data-scheduler-date="2026-10-05"] [data-scheduler-minute="${minute}"]`);
      const header = document.querySelector('.scheduler-week-head');
      return slot && header ? slot.getBoundingClientRect().top - header.getBoundingClientRect().bottom : Infinity;
    }, minute);
    const firstFrame = await frame.evaluate(() => new Promise(resolve => new ResizeObserver((entries, observer) => {
      observer.disconnect();
      const slot = document.querySelector('[data-scheduler-minute="360"]');
      const scroller = document.querySelector('.program-calendar-scroll');
      resolve({ offset: slot.getBoundingClientRect().top - document.querySelector('.scheduler-week-head').getBoundingClientRect().bottom,
        scrollTop: scroller.scrollTop });
    }).observe(document.querySelector('.program-calendar-scroll'))));
    expect(Math.abs(firstFrame.offset), JSON.stringify(firstFrame)).toBeLessThanOrEqual(1);
    await expect.poll(() => firstSlotOffset(360), { message: JSON.stringify(firstFrame) }).toBeCloseTo(0, 0);
    await expect(frame.locator('.scheduler-week-slot')).toHaveCount(336);
    await expect(frame.locator('.scheduler-week-hour-label').first()).toHaveText('00:00');
    await scroller.evaluate(node => { node.scrollTop = 0; });
    await expect.poll(() => firstSlotOffset(0)).toBeCloseTo(0, 0);
    await frame.evaluate(() => UOS.ProgramApp.updateWorkspace(workspace => {
      workspace.workspace.scheduler.sort = 'priority';
      return workspace;
    }));
    await expect.poll(() => scroller.evaluate(node => node.scrollTop)).toBe(0);
    await frame.getByRole('button', { name: 'Month', exact: true }).click();
    await frame.getByRole('button', { name: 'Week', exact: true }).click();
    await expect.poll(() => firstSlotOffset(360)).toBeCloseTo(0, 0);
    const initialScroll = await scroller.evaluate(node => node.scrollTop);

    await frame.evaluate(id => UOS.ProgramSchedulerUI.focusCalendarJob(id), ids.allDay);
    await expect(frame.locator('[data-week-handle="move"]')).toBeVisible();
    await expect(frame.locator('[data-week-handle="start"]')).toHaveCount(0);
    await frame.evaluate(id => UOS.ProgramSchedulerUI.focusCalendarJob(id), ids.draft);
    await slot(540).click({ position: { x: 80, y: 5 } });
    await expect(frame.locator('[data-scheduler-form] [name="startTime"]')).toHaveValue('09:00');
    await expect(frame.locator('[data-scheduler-form] [name="endTime"]')).toHaveValue('09:30');
    await expect(frame.locator('[data-week-handle="end"]')).toBeVisible();
    await expect(frame.locator('dialog[open], .uos-modal-backdrop')).toHaveCount(0);
    const originalJobs = await frame.evaluate(() => JSON.stringify(UOS.ProgramApp.workspace().entities.jobs));

    // Leave part of the end handle's target below the sticky header. Its
    // overlapping part must neither paint nor receive clicks over the header.
    await frame.evaluate(id => {
      const card = document.querySelector(`.scheduler-week-job[data-scheduler-job="${id}"]`);
      const header = document.querySelector('.scheduler-week-head').getBoundingClientRect();
      const scroller = document.querySelector('.program-calendar-scroll');
      scroller.scrollTop += card.getBoundingClientRect().bottom - (header.bottom - 8);
    }, ids.draft);
    const handleHitsInHeader = () => frame.evaluate(() => {
      const header = document.querySelector('.scheduler-week-head').getBoundingClientRect();
      return [...document.querySelectorAll('[data-week-handle]:not([hidden])')].filter(node => {
        const rect = node.getBoundingClientRect();
        const top = Math.max(header.top, rect.top), bottom = Math.min(header.bottom, rect.bottom);
        if (bottom <= top) return false;
        const hit = document.elementFromPoint(rect.left + rect.width / 2, (top + bottom) / 2);
        return Boolean(hit?.closest('[data-week-handle]'));
      }).length;
    });
    await expect.poll(handleHitsInHeader).toBe(0);
    await expect(frame.locator('[data-week-handle="start"]')).toBeHidden();
    await scroller.evaluate((node, scrollTop) => { node.scrollTop = scrollTop; }, initialScroll);
    await expect(frame.locator('[data-week-handle="start"]')).toBeVisible();
    await expect(frame.locator('[data-week-handle="end"]')).toBeVisible();
    expect(await frame.evaluate(() => JSON.stringify(UOS.ProgramApp.workspace().entities.jobs))).toBe(originalJobs);
    expect(errors).toEqual([]);
  });
}
