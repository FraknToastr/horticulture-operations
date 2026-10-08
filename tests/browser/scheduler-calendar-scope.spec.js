const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function setup(page, owner) {
  await suppressBackupModalForFunctionalTest(page);
  await page.goto(`/src/program-planner/${owner === 'NSA' ? 'nsa' : 'events'}.html`);
  const frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const ids = await frame.evaluate(async owner => {
    const UOS = window.UOS, ids = { scheduled: {}, draft: {}, project: {}, register: {} };
    await UOS.ProgramApp.updateWorkspace(input => {
      let ws = input;
      for (const key of ['A', 'B']) {
        const registerId = `${owner === 'NSA' ? 'NSA-APP' : 'EVT-EVENT'}-CALENDAR-${key}`;
        ids.register[key] = registerId;
        ws.entities[owner === 'NSA' ? 'applications' : 'events'].push({ id: registerId, owner, type: owner === 'NSA' ? 'application' : 'event', title: `Calendar application ${key}`, status: 'received', dateReceived: '2026-10-02' });
        const promoted = UOS.ProgramModel.promoteRegisterRecord(ws, registerId);
        ws = UOS.ProgramStatus.migrate(promoted.workspace);
        ids.project[key] = promoted.project.id;
        ids.scheduled[key] = {};
        for (const suffix of ['scheduled', 'draft']) {
          const task = UOS.ProgramPlannerModel.saveTask(ws, promoted.project.id, null, { title: `Planner ${key} ${suffix}`, description: 'Calendar test work', section: 'Planning and Approval', operational: true, status: 'Not Started' });
          const created = UOS.ProgramPlannerModel.createDraftJob(task.workspace, promoted.project.id, task.task.id);
          ws = created.workspace;
          if (suffix === 'scheduled') ids.scheduled[key].planner = created.job.id;
          else ids.draft[key] = created.job.id;
        }
        const calculatorRate = `RATE-CALENDAR-${key}`;
        ws = UOS.ProgramCosting.upsertRateItem(ws, { id: calculatorRate, description: `Calculator ${key}`, kind: 'Labour', category: 'Labour', unit: 'unit', unitRate: 10, quantityMode: 'direct', schedulerEnabled: true });
        ws = UOS.ProgramCosting.createWork(ws, promoted.project.id, calculatorRate, { quantity: 1 }, { operationId: `calendar-${key}` });
        ids.scheduled[key].calculator = ws.entities.costingLines.find(l => l.operationId === `calendar-${key}`).jobId;
        const mappedRate = `RATE-CALENDAR-MAP-${key}`, geometryId = `${owner}-GEO-CALENDAR-${key}`;
        ws = UOS.ProgramCosting.upsertRateItemWithWorkType(ws, { id: mappedRate, description: `Mapped ${key}`, kind: 'Labour', category: 'Labour', unit: 'm²', unitRate: 10, quantityMode: 'm2', schedulerEnabled: true }, { enabled: true, workTypeKey: 'turfing' });
        ws = UOS.WorkAreaService.createGeometry(ws, promoted.project.id, { id: geometryId, workTypeKey: 'turfing', rateItemId: mappedRate, geometryKind: 'polygon', geometry: { type: 'Polygon', coordinates: [[[138.6,-34.92],[138.6,-34.9201],[138.6001,-34.9201],[138.6001,-34.92],[138.6,-34.92]]] }, payload: { valid: true, workTypeKey: 'turfing', rateItemId: mappedRate } });
        ws = UOS.WorkAreaService.syncGeometry(ws, geometryId);
        ids.scheduled[key]['space-map'] = ws.entities.jobs.find(j => j.sourceGeometryId === geometryId).id;
      }
      return ws;
    });
    await UOS.ProgramApp.updateWorkspace(input => {
      let ws = input;
      for (const key of ['A', 'B']) for (const [source, id] of Object.entries(ids.scheduled[key])) ws = UOS.ProgramSchedulerModel.scheduleJob(ws, id, { startDate: '2026-10-05', endDate: '2026-10-05', allDay: true, crewId: source === 'planner' ? 'Shared crew' : `${key}-${source}` });
      ws.workspace.calendarCursor = '2026-10-05';
      return ws;
    }, { source: 'automatic' });
    await UOS.ProgramApp.navigateWithContext('scheduler', ids.register.A);
    return ids;
  }, owner);
  return { frame, ids };
}

for (const owner of ['NSA', 'EVT']) for (const width of [1440, 390]) test(`${owner} ${width}: focused/all calendar and safe modal/editor activation`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  let { frame, ids } = await setup(page, owner);
  const scope = value => frame.locator(`[data-scheduler-calendar-scope="${value}"]`);
  const card = id => frame.locator(`.program-calendar-job[data-scheduler-job="${id}"]`);
  const context = () => frame.evaluate(() => {
    const w = window.UOS.ProgramApp.workspace();
    return { register: w.workspace.selectedEntityId, project: w.workspace.selectedProjectId, job: w.workspace.scheduler.selectedId, revision: w.workspaceRevision };
  });
  await expect(scope('application')).toHaveAttribute('aria-pressed', 'true');
  await expect(frame.locator('.program-scheduler-head [aria-label="Toggle schedule filters"]')).toHaveCount(0);
  await expect(frame.locator('.program-scheduler-header__left')).toHaveCount(0);
  await expect(frame.locator('[data-scheduler-mini-toolbar]')).toHaveCount(0);
  await expect(frame.locator('[data-scheduler-toolbar-jump]')).toHaveCount(0);
  await expect(frame.locator('.program-scheduler-job-register__header')).toHaveCount(0);
  await expect(scope('application')).toHaveText(owner === 'NSA' ? 'This application' : 'This event');
  for (const id of Object.values(ids.scheduled.A)) await expect(card(id)).toBeVisible();
  for (const id of Object.values(ids.scheduled.B)) await expect(card(id)).toHaveCount(0);
  await expect(card(ids.draft.A)).toBeVisible();
  await expect(card(ids.draft.B)).toHaveCount(0);
  await expect(card(ids.scheduled.A.planner)).toHaveClass(/is-conflict/);
  await scope('all').click();
  await expect(scope('all')).toHaveAttribute('aria-pressed', 'true');
  await expect(frame.locator('[data-scheduler-calendar-legend]')).toBeVisible();
  const headerLayout = await frame.locator('.program-scheduler-header__controls').evaluate(el => {
    const children = Array.from(el.children);
    const scope = el.querySelector('[data-scheduler-calendar-scope="all"]');
    const mode = el.querySelector('[data-scheduler-mode="week"]');
    const styles = button => { const s = getComputedStyle(button); return [s.height, s.padding, s.fontSize, s.borderRadius]; };
    return { legendFirst: children[0].hasAttribute('data-scheduler-calendar-legend'), scopeSecond: children[1].classList.contains('program-scheduler-calendar-scope'), scopeStyles: styles(scope), modeStyles: styles(mode) };
  });
  expect(headerLayout.legendFirst).toBe(true);
  expect(headerLayout.scopeSecond).toBe(true);
  expect(headerLayout.scopeStyles).toEqual(headerLayout.modeStyles);
  const legendStyle = await frame.locator('[data-scheduler-calendar-legend]').evaluate(el => ({
    font: getComputedStyle(el).fontSize,
    patch: getComputedStyle(el.querySelector('span'), '::before').width,
    alignment: getComputedStyle(el).alignItems,
    justification: getComputedStyle(el).justifyContent
  }));
  expect(legendStyle).toEqual({ font: '12px', patch: '12px', alignment: 'center', justification: 'center' });
  if (width === 390) expect(await frame.locator('.program-scheduler-header__controls').evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(width);
  for (const id of Object.values(ids.scheduled.B)) await expect(card(id)).toBeVisible();
  await expect(card(ids.draft.B)).toBeVisible();
  const before = await context();
  await card(ids.scheduled.B.planner).click();
  const modal = frame.locator('[data-scheduler-other-project-summary]');
  await expect(modal).toBeVisible();
  for (const text of ['Planner B scheduled', 'Planner', 'Calendar application B', '2026-10-05', 'Shared crew', 'Scheduled']) await expect(modal).toContainText(text);
  expect(await context()).toEqual(before);
  await expect(modal.locator('button')).toHaveCount(2);
  if (width === 1440) await modal.screenshot({ path: testInfo.outputPath(`${owner}-other-job-modal.png`) });
  await modal.press('Escape');
  await expect(modal).toBeHidden();
  await expect(card(ids.scheduled.B.planner)).toBeFocused();
  await card(ids.draft.B).focus();
  await card(ids.draft.B).press('Enter');
  await expect(modal).toContainText('Unscheduled');
  await modal.getByRole('button', { name: 'Return to calendar' }).click();
  await expect(card(ids.draft.B)).toBeFocused();
  expect(await context()).toEqual(before);
  for (const source of ['planner', 'calculator', 'space-map']) {
    await card(ids.scheduled.A[source]).click();
    await expect(frame.locator('[data-scheduler-detail]')).toBeVisible();
    await expect(frame.locator('[data-scheduler-detail-title] svg')).toHaveAttribute('aria-label', `${source === 'space-map' ? 'Space Map' : source === 'planner' ? 'Planner' : 'Calculator'} source`);
    const titleLayout = await frame.locator('[data-scheduler-detail-title]').evaluate(el => {
      const icon = el.querySelector('svg').getBoundingClientRect(), name = el.querySelector('span').getBoundingClientRect();
      return { width: icon.width, height: icon.height, centreDifference: Math.abs(icon.y + icon.height / 2 - name.y - name.height / 2) };
    });
    expect(titleLayout.width).toBe(36);
    expect(titleLayout.height).toBe(36);
    expect(titleLayout.centreDifference).toBeLessThanOrEqual(1);
    await expect(card(ids.scheduled.A[source])).toHaveClass(/is-selected/);
    const selectionStyle = await card(ids.scheduled.A[source]).evaluate(el => ({
      outline: getComputedStyle(el).outlineStyle,
      animation: getComputedStyle(el, '::after').animationName,
      pointerEvents: getComputedStyle(el, '::after').pointerEvents
    }));
    expect(selectionStyle).toEqual({ outline: 'none', animation: 'scheduler-selection-ants', pointerEvents: 'none' });
    const borderVisibility = await card(ids.scheduled.A[source]).evaluate(el => {
      const s = getComputedStyle(el, '::after');
      return { content: s.content, display: s.display, position: s.position, parentPosition: getComputedStyle(el).position, background: s.backgroundImage };
    });
    expect(borderVisibility.content).toBe('""');
    expect(borderVisibility.display).not.toBe('none');
    expect(borderVisibility.position).toBe('absolute');
    expect(borderVisibility.parentPosition).toBe('relative');
    expect(borderVisibility.background).not.toBe('none');
    if (width === 1440) await card(ids.scheduled.A[source]).screenshot({ path: testInfo.outputPath(`${owner}-${source}-selected-pill.png`) });
    expect((await context()).register).toBe(before.register);
    expect((await context()).project).toBe(before.project);
    expect((await context()).job).toBe(ids.scheduled.A[source]);
    if (width === 1440) await frame.locator('[data-scheduler-detail]').screenshot({ path: testInfo.outputPath(`${owner}-${source}-job-editor.png`) });
  }
  const form = frame.locator('[data-scheduler-form]');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => card(ids.scheduled.A['space-map']).evaluate(el => getComputedStyle(el, '::after').animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await form.locator('[name="startDate"]').fill('2026-10-07');
  await form.locator('[name="updatesApplicationStatus"]').check();
  await scope('application').click();
  await expect(scope('application')).toHaveAttribute('aria-pressed', 'true');
  await expect(form.locator('[name="startDate"]')).toHaveValue('2026-10-07');
  await expect(form.locator('[name="updatesApplicationStatus"]')).toBeChecked();
  await scope('all').click();
  await expect(scope('all')).toHaveAttribute('aria-pressed', 'true');
  await expect(form.locator('[name="startDate"]')).toHaveValue('2026-10-07');
  expect(await frame.evaluate(id => {
    const job = window.UOS.ProgramApp.workspace().entities.jobs.find(j => j.id === id);
    return { date: job.startDate, nomination: job.updatesApplicationStatus };
  }, ids.scheduled.A['space-map'])).toEqual({ date: '2026-10-05', nomination: false });
  for (const theme of ['light', 'dark']) {
    await frame.evaluate(theme => { document.documentElement.dataset.suiteTheme = theme; }, theme);
    const activeStyle = await card(ids.scheduled.A.planner).evaluate(el => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
    const otherStyle = await card(ids.scheduled.B.planner).evaluate(el => ({ background: getComputedStyle(el).backgroundColor, opacity: getComputedStyle(el).opacity }));
    expect(activeStyle.background).not.toBe(otherStyle.background);
    expect(activeStyle.background).not.toBe(activeStyle.color);
    expect(otherStyle.opacity).toBe('1');
    await frame.locator('.program-scheduler-calendar').screenshot({ path: testInfo.outputPath(`${owner}-${width}-${theme}-calendar.png`) });
  }
  await frame.getByRole('button', { name: 'Month', exact: true }).click();
  await expect(card(ids.scheduled.B.planner)).toBeVisible();
  await frame.getByRole('button', { name: 'Week', exact: true }).click();
  await expect(frame.locator('[data-program-persistence]')).toHaveText('Saved');
  await page.reload();
  frame = page.frames().find(f => f !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  await frame.evaluate(async id => { await window.UOS.ProgramApp.navigateWithContext('scheduler', id); }, ids.register.B);
  await expect(scope('all')).toHaveAttribute('aria-pressed', 'true');
  await expect(card(ids.scheduled.B.planner)).toHaveClass(/is-linked-project/);
  await expect(card(ids.scheduled.A.planner)).toHaveClass(/is-other-project/);
  await scope('application').click();
  await expect(card(ids.scheduled.A.planner)).toHaveCount(0);
  await expect(card(ids.scheduled.B.planner)).toBeVisible();
});

test('without an active project the calendar shows all jobs and never opens an editor', async ({ page }) => {
  const { frame, ids } = await setup(page, 'NSA');
  await frame.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace(ws => {
      ws.entities.applications.push({ id: 'NSA-APP-CALENDAR-UNPROMOTED', owner: 'NSA', type: 'application', title: 'Application without a Project', status: 'received', dateReceived: '2026-10-02' });
      ws.workspace.selectedEntityId = 'NSA-APP-CALENDAR-UNPROMOTED'; ws.workspace.selectedProjectId = null;
      Object.assign(ws.workspace.scheduler, { selectedProjectId: '', selectedId: '', detail: false, inspectorMode: 'list', calendarScope: 'application' });
      return ws;
    });
    await window.UOS.ProgramApp.navigateWithContext('scheduler', 'NSA-APP-CALENDAR-UNPROMOTED');
  });
  await expect(frame.locator('[data-scheduler-calendar-scope="application"]')).toBeDisabled();
  await expect(frame.locator('[data-scheduler-calendar-scope="all"]')).toHaveAttribute('aria-pressed', 'true');
  await frame.locator(`.program-calendar-job[data-scheduler-job="${ids.scheduled.A.planner}"]`).click();
  await expect(frame.locator('[data-scheduler-other-project-summary]')).toBeVisible();
  await expect(frame.locator('[data-scheduler-detail]')).toBeHidden();
  expect(await frame.evaluate(() => window.UOS.ProgramApp.workspace().workspace.scheduler.calendarScope)).toBe('application');
  await frame.locator('[data-scheduler-other-project-summary]').press('Escape');
  await frame.evaluate(async id => { await window.UOS.ProgramApp.navigateWithContext('scheduler', id); }, ids.register.A);
  await expect(frame.locator('[data-scheduler-calendar-scope="application"]')).toHaveAttribute('aria-pressed', 'true');
});
