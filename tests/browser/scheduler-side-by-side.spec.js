const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function setup(page, owner) {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/src/program-planner/' + (owner === 'NSA' ? 'nsa' : 'events') + '.html');
  const frame = page.frames().find(candidate => candidate !== page.mainFrame());
  await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
  const ids = await frame.evaluate(async owner => {
    const ids = { record: owner + (owner === 'NSA' ? '-APP-' : '-EVENT-') + 'LANES' };
    await UOS.ProgramApp.updateWorkspace(workspace => {
      workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push({
        id: ids.record, owner, type: owner === 'NSA' ? 'application' : 'event', title: 'Concurrent bookings', status: 'received'
      });
      const promoted = UOS.ProgramModel.promoteRegisterRecord(workspace, ids.record);
      workspace = UOS.ProgramStatus.migrate(promoted.workspace);
      const schedules = {
        a: { startTime: '09:00', endTime: '12:00', priority: 'high' },
        b: { startTime: '10:00', endTime: '12:00', priority: 'medium' },
        c: { startDate: '2026-10-06', endDate: '2026-10-06', startTime: '09:00', endTime: '11:00' },
        d: { startDate: '2026-10-06', endDate: '2026-10-06', startTime: '09:00', endTime: '11:00', priority: 'low' },
        e: { startDate: '2026-10-06', endDate: '2026-10-06', startTime: '09:00', endTime: '11:00' },
        adjacent1: { startDate: '2026-10-07', endDate: '2026-10-07', startTime: '09:00', endTime: '09:30' },
        adjacent2: { startDate: '2026-10-07', endDate: '2026-10-07', startTime: '09:30', endTime: '10:00' },
        allDay: { allDay: true, endDate: '2026-10-14', priority: 'high' }
      };
      Object.entries(schedules).forEach(([name, schedule]) => {
        const task = UOS.ProgramPlannerModel.saveTask(workspace, promoted.project.id, null, {
          title: 'Landscape ' + name, description: 'Lane and accessory regression', section: 'Planning and Approval',
          operational: true, status: 'Not Started'
        });
        const draft = UOS.ProgramPlannerModel.createDraftJob(task.workspace, promoted.project.id, task.task.id);
        workspace = draft.workspace; ids[name] = draft.job.id;
        workspace.entities.jobs.find(job => job.id === draft.job.id).workTypeKey = name;
        workspace = UOS.ProgramSchedulerModel.scheduleJob(workspace, draft.job.id, {
          startDate: '2026-10-05', endDate: '2026-10-05', allDay: false, ...schedule
        });
      });
      workspace.workspace.calendarCursor = '2026-10-05';
      return workspace;
    });
    UOS.ProgramApp.navigateWithContext('scheduler', ids.record);
    return ids;
  }, owner);
  return { frame, ids, errors };
}
const card = (frame, id) => frame.locator('.program-calendar-job[data-scheduler-job="' + id + '"]');
const geometry = async node => node.evaluate(element => {
  const r = element.getBoundingClientRect();
  return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
});

for (const owner of ['NSA', 'EVT']) {
  test(owner + ': side-by-side overlaps retain continuous aligned time ranges', async ({ page }) => {
    const { frame, ids, errors } = await setup(page, owner);
    await expect(frame.locator('.scheduler-week-slot')).toHaveCount(336);
    const sizes = await frame.locator('.scheduler-week-slot').evaluateAll(nodes => [...new Set(nodes.map(n => n.getBoundingClientRect().height))]);
    expect(sizes).toEqual([48]);
    await expect(card(frame, ids.a)).toHaveCount(1);
    const a = await geometry(card(frame, ids.a)), b = await geometry(card(frame, ids.b));
    expect(a.right).toBeLessThanOrEqual(b.x);
    expect(a.width).toBeCloseTo(b.width, 0);
    expect(b.y - a.y).toBe(96);
    expect(a.bottom).toBe(b.bottom);
    expect(a.height).toBe(284);
    const triple = (await Promise.all(['c', 'd', 'e'].map(key => geometry(card(frame, ids[key]))))).sort((a, b) => a.x - b.x);
    expect(triple[0].right).toBeLessThanOrEqual(triple[1].x);
    expect(triple[1].right).toBeLessThanOrEqual(triple[2].x);
    expect(triple[0].width).toBeCloseTo(triple[2].width, 0);
    expect(triple.every(box => box.y === a.y && box.height === 188)).toBe(true);
    const adjacent1 = await geometry(card(frame, ids.adjacent1)), adjacent2 = await geometry(card(frame, ids.adjacent2));
    expect(adjacent1.x).toBe(adjacent2.x);
    expect(adjacent1.bottom).toBeLessThanOrEqual(adjacent2.y);
    expect(adjacent1.height).toBe(44);
    await frame.evaluate(id => UOS.ProgramSchedulerUI.focusCalendarJob(id), ids.a);
    await card(frame, ids.a).scrollIntoViewIfNeeded();
    const move = frame.locator('[data-week-handle="move"]');
    await expect(move).toBeVisible();
    const moveBox = await geometry(move), priorityBox = await geometry(card(frame, ids.a).locator('.scheduler-priority-pill'));
    expect(moveBox.right).toBeLessThanOrEqual(priorityBox.x);
    await expect(card(frame, ids.a)).toHaveClass(/is-selected/);
    expect(await card(frame, ids.a).evaluate(n => getComputedStyle(n.querySelector('.scheduler-selection-overlay')).animationName)).toBe('scheduler-selection-pulse');
    expect(await card(frame, ids.a).evaluate(n => getComputedStyle(n).opacity)).toBe('1');
    const livePulse = await frame.evaluate(async id => {
      const values = [];
      for (let i = 0; i < 3; i++) {
        const n = document.querySelector('.scheduler-week-job[data-scheduler-job="' + id + '"]');
        const style = getComputedStyle(n.querySelector('.scheduler-selection-overlay'));
        values.push({ opacity: Number(style.opacity), content: style.content, display: style.display, selected:n.classList.contains('is-selected') });
        await new Promise(resolve => setTimeout(resolve, 180));
      }
      return values;
    }, ids.a);
    expect(livePulse.every(s => s.display !== 'none'), JSON.stringify(livePulse)).toBe(true);
    expect(Math.max(...livePulse.map(s => s.opacity)) - Math.min(...livePulse.map(s => s.opacity)), JSON.stringify(livePulse)).toBeGreaterThan(.01);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await card(frame, ids.a).evaluate(n => getComputedStyle(n.querySelector('.scheduler-selection-overlay')).animationName)).toBe('none');
    expect(await card(frame, ids.a).evaluate(n => getComputedStyle(n).outlineStyle)).toBe('solid');
    expect(errors).toEqual([]);
  });

  test(owner + ': Month symbols have distinct tips and selected controls never overlap', async ({ page }) => {
    const { frame, ids, errors } = await setup(page, owner);
    await frame.getByRole('button', { name: 'Month', exact: true }).click();
    const timed = card(frame, ids.a);
    await expect(timed.locator('[data-booking-type="timed"]')).toHaveAttribute('data-uos-tooltip', 'Timed booking');
    const allDay = card(frame, ids.allDay);
    expect(await allDay.count()).toBeGreaterThan(1);
    await expect(allDay.first().locator('[data-booking-type="all-day"]')).toHaveAttribute('data-uos-tooltip', 'All-day booking');
    await frame.evaluate(id => UOS.ProgramSchedulerUI.focusCalendarJob(id), ids.a);
    await timed.scrollIntoViewIfNeeded();
    await expect(frame.locator('[data-week-handle="move"]')).toBeVisible();
    let move = await geometry(frame.locator('[data-week-handle="move"]'));
    const priority = await geometry(timed.locator('.scheduler-priority-pill'));
    const type = await geometry(timed.locator('.scheduler-booking-type'));
    const bounds = await geometry(timed);
    expect(move.right).toBeLessThanOrEqual(priority.x);
    expect(priority.right).toBeLessThanOrEqual(type.x);
    expect(type.right).toBeLessThanOrEqual(bounds.right);
    await timed.locator('.scheduler-booking-type').hover();
    await expect(frame.locator('[role="tooltip"]').filter({ hasText: 'Timed booking' })).toBeVisible();
    await frame.evaluate(id => UOS.ProgramSchedulerUI.focusCalendarJob(id), ids.allDay);
    await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const pulses = await allDay.evaluateAll(nodes => nodes.map(n => ({
      selected: n.classList.contains('is-selected'), animation: getComputedStyle(n.querySelector('.scheduler-selection-overlay')).animationName,
      duration: getComputedStyle(n.querySelector('.scheduler-selection-overlay')).animationDuration,
      opacity: getComputedStyle(n.querySelector('.scheduler-selection-overlay')).opacity, animations: n.getAnimations({ subtree: true }).map(a=>({ name:a.animationName, time:a.currentTime }))
    })));
    expect(pulses.every(p => p.selected && p.animation === 'scheduler-selection-pulse' && p.duration === '1.4s')).toBe(true);
    expect(new Set(pulses.map(p => p.opacity)).size, JSON.stringify(pulses)).toBe(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await allDay.evaluateAll(nodes => nodes.every(n => getComputedStyle(n.querySelector('.scheduler-selection-overlay')).animationName === 'none'))).toBe(true);
    expect(errors).toEqual([]);
  });
}
