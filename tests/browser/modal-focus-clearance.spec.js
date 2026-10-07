const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

async function audit(frame, selector) {
  return frame.evaluate(async selector => {
    const root = document.querySelector(selector), failures = [];
    const fields = [...root.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')]
      .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
    for (const field of fields) {
      field.focus();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const style = getComputedStyle(field);
      const ring = style.outlineStyle === 'none' ? 0 : parseFloat(style.outlineWidth) + Math.max(0, parseFloat(style.outlineOffset));
      const rect = field.getBoundingClientRect();
      for (let parent = field.parentElement; parent; parent = parent.parentElement) {
        const css = getComputedStyle(parent), box = parent.getBoundingClientRect();
        const left = box.left + parent.clientLeft, top = box.top + parent.clientTop;
        const clipsX = /auto|scroll|hidden|clip/.test(css.overflowX);
        const clipsY = /auto|scroll|hidden|clip/.test(css.overflowY);
        if ((clipsX && (rect.left - ring < left - .75 || rect.right + ring > left + parent.clientWidth + .75)) ||
            (clipsY && (rect.top - ring < top - .75 || rect.bottom + ring > top + parent.clientHeight + .75))) {
          failures.push({ field: field.name || field.textContent.trim().slice(0, 40) || field.type, container: parent.className, ring, rect: {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom}, clip: {left,top,right:left+parent.clientWidth,bottom:top+parent.clientHeight} });
        }
        if (parent === root) break;
      }
    }
    return { count: fields.length, failures };
  }, selector);
}

for (const owner of ['NSA', 'EVT']) for (const width of [1280, 390]) {
  test(`${owner} modal outlines fit clipping containers at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await suppressBackupModalForFunctionalTest(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/src/program-planner/${owner === 'EVT' ? 'events' : 'nsa'}.html`);
    const frame = page.frames().find(f => f !== page.mainFrame());
    await frame.waitForFunction(() => UOS.ProgramApp?.snapshot().phase === 'ready');
    await frame.evaluate(() => UOS.ProgramApp.updateWorkspace(ws => ws));
    await page.keyboard.press('Tab');
    const dialogs = await frame.locator('dialog').count();
    let controls = 0;
    for (let index = 0; index < dialogs; index++) {
      await frame.locator('dialog').nth(index).evaluate(node => { node.dataset.focusAudit = 'active'; node.showModal(); });
      const result = await audit(frame, '[data-focus-audit="active"]');
      expect(result.failures).toEqual([]);
      controls += result.count;
      await frame.locator('[data-focus-audit="active"]').evaluate(node => { node.close(); delete node.dataset.focusAudit; });
    }
    expect(controls).toBeGreaterThan(10);
    await frame.evaluate(() => UOS.ProgramApp.init());
    await frame.evaluate(() => UOS.ProgramApp.navigate('budget'));
    await frame.locator('[data-budget-year]').selectOption('2026-27');
    const names = ['amount', 'date', 'actor', 'approver', 'reason', 'evidence'];
    const values = ['5000', '2026-10-01', 'Officer', 'Approver', 'Annual budget', 'Decision 42'];
    for (let i = 0; i < names.length; i++) await frame.locator('[data-budget-inline-approve] [name="' + names[i] + '"]').fill(values[i]);
    await frame.locator('[data-budget-inline-approve]').evaluate(form => form.requestSubmit());
    await frame.waitForFunction(() => document.querySelector('[data-budget-inline-approve] input[readonly]') || !document.querySelector('[data-budget-inline-approve] [data-budget-dialog-error]').hidden);
    await expect(frame.locator('[data-budget-inline-approve] input[readonly]')).toHaveCount(6);
    await frame.locator('[data-budget-action="adjust"]').evaluate(button => button.click());
    await expect(frame.locator('.program-budget__dialog')).toBeVisible();
    await page.keyboard.press('Tab');
    expect((await audit(frame, '.program-budget__dialog')).failures).toEqual([]);
    await frame.evaluate(() => document.querySelector('.program-budget__dialog').close());
    await frame.evaluate(() => {
      const content = document.createElement('div');
      content.style.fontSize = '1rem';
      for (let i = 0; i < 18; i++) {
        const label = document.createElement('label'); label.style.display = 'block'; label.style.marginBottom = '16px';
        label.textContent = 'Shared modal field ' + i;
        const input = document.createElement('input'); input.className = 'uos-input'; label.appendChild(input); content.appendChild(label);
      }
      UOS.dialogs.open({ title: 'Shared modal clearance', node: content });
    });
    await page.keyboard.press('Tab');
    expect((await audit(frame, '.uos-modal')).failures).toEqual([]);
    if (width === 390) {
      await frame.evaluate(() => document.documentElement.style.fontSize = '20px');
      expect((await audit(frame, '.uos-modal')).failures).toEqual([]);
    }
    await page.keyboard.press('Escape');
    await expect(frame.locator('.uos-modal')).toHaveCount(0);
    if (owner === 'NSA') {
      await frame.evaluate(async () => {
        await UOS.ProgramApp.updateWorkspace(ws => {
          const record = { id: 'NSA-APP-FOCUS-AUDIT', owner: 'NSA', type: 'application', receipt: 'FOCUS-AUDIT', title: 'Focus audit', status: 'received', dateReceived: '2026-10-01' };
          ws.entities.applications.push(record);
          const result = UOS.ProgramModel.promoteRegisterRecord(ws, record.id);
          result.workspace.workspace.selectedProjectId = result.project.id;
          result.workspace.workspace.selectedEntityId = result.project.id;
          return result.workspace;
        });
        await UOS.ProgramApp.navigate('planner');
      });
      await frame.locator('.planner-btn-add-item').click();
      await expect(frame.locator('[data-planner-task-dialog]')).toBeVisible();
      await page.keyboard.press('Tab');
      expect((await audit(frame, '[data-planner-task-dialog]')).failures).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(frame.locator('[data-planner-task-dialog]')).not.toBeVisible();
    }
  });
}
