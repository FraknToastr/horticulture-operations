const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

// Desktop style contracts for the existing cards. No image or map-rendering proof.
test.use({ viewport: { width: 1600, height: 1000 } });

async function openInspector(page, owner) {
  await suppressBackupModalForFunctionalTest(page);
  await page.route('https://**/*', route => route.abort());
  await page.goto('/src/program-planner/' + (owner === 'NSA' ? 'nsa' : 'events') + '.html');
  const frame = page.frames().find(candidate => candidate !== page.mainFrame());
  await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
  const geometryId = await frame.evaluate(async owner => {
    const id = owner + (owner === 'NSA' ? '-APP-' : '-EVENT-') + 'INSPECTOR-STYLE';
    const geometryId = owner + '-GEO-INSPECTOR-STYLE';
    UOS_REMEDIATION_MAP_CONFIG.defaultProvider = 'offline';
    await UOS.ProgramApp.updateWorkspace(workspace => {
      workspace.entities[owner === 'NSA' ? 'applications' : 'events'].push({
        id, owner, type: owner === 'NSA' ? 'application' : 'event',
        title: 'Inspector style contract', status: 'received', dateReceived: '2026-10-18'
      });
      const promoted = UOS.ProgramModel.promoteRegisterRecord(workspace, id);
      workspace = UOS.WorkAreaService.createGeometry(promoted.workspace, promoted.project.id, {
        id: geometryId, workTypeKey: 'turfing', geometryKind: 'polygon',
        geometry: { type: 'Polygon', coordinates: [[
          [138.6, -34.92], [138.6003, -34.92], [138.6003, -34.9203], [138.6, -34.92]
        ]] }
      });
      workspace.workspace.selectedEntityId = id;
      workspace.workspace.selectedProjectId = promoted.project.id;
      return workspace;
    });
    await UOS.ProgramApp.navigate('map');
    return geometryId;
  }, owner);
  await frame.locator('[data-space-mode="projects"]').click();
  const card = frame.locator('[data-shape-card-id="' + geometryId + '"]');
  await expect(card).toHaveAttribute('data-card-size', 'summary');
  // Summary -> minimal -> full, using the real disclosure controls.
  await card.locator('[data-space-expand]').click();
  await card.locator('[data-space-expand]').click();
  await expect(card).toHaveAttribute('data-card-size', 'full');
  await frame.waitForFunction(() => UOS.ProgramMapController.getMapController()?.ready());
  // This contract measures final styles, rather than a transition's starting frame.
  await frame.addStyleTag({ content: '.space-editor__geometry-card .uos-button { transition:none !important; }' });
  return { frame, card };
}

for (const owner of ['NSA', 'EVT']) {
  test(owner + ': inspector spacing, action contrast and collapse levels retain their desktop styles', async ({ page }) => {
    const { frame, card } = await openInspector(page, owner);
    for (const theme of ['light', 'dark']) {
      await frame.evaluate(theme => { document.documentElement.dataset.suiteTheme = theme; }, theme);
      const edit = card.locator('[data-shape-action="edit"]');
      await edit.click();
      await expect(edit).toHaveAttribute('aria-pressed', 'true');
      await expect(edit).toHaveClass(/uos-button--primary is-active/);
      const hovered = await edit.evaluate(button => ({
        color: getComputedStyle(button).color, background: getComputedStyle(button).backgroundColor,
        stroke: getComputedStyle(button.querySelector('svg')).stroke
      }));
      // Owner hover/focus styles deliberately use dark text on a pale background.
      // Move away and blur before checking the separate resting active style.
      await page.mouse.move(0, 0);
      await edit.evaluate(button => button.blur());
      const active = await edit.evaluate(button => ({
        color: getComputedStyle(button).color, stroke: getComputedStyle(button.querySelector('svg')).stroke
      }));
      await frame.locator('#spaceCancelDraft').click();
      await expect(edit).toHaveAttribute('aria-pressed', 'false');
      const styles = await card.evaluate(card => {
        const get = selector => getComputedStyle(card.querySelector(selector));
        const actions = card.querySelector('.program-shape-actions');
        const tools = [...actions.querySelectorAll('button')];
        const probe = document.createElement('span');
        probe.style.color = 'var(--uos-on-action)';
        card.append(probe);
        const onAction = getComputedStyle(probe).color;
        probe.style.color = 'var(--space-line)';
        const line = getComputedStyle(probe).color;
        probe.style.color = 'var(--space-ink)';
        const ink = getComputedStyle(probe).color;
        probe.style.color = 'var(--program-owner-strong)';
        const ownerStrong = getComputedStyle(probe).color;
        probe.style.color = 'var(--program-owner-soft)';
        const ownerSoft = getComputedStyle(probe).color;
        probe.remove();
        return {
          owner: card.closest('.space-editor').dataset.spaceOwner,
          accent: getComputedStyle(card).getPropertyValue('--space-active').trim(),
          padding: get('.space-editor__inspector').padding,
          actionDisplay: getComputedStyle(actions).display,
          actionGap: getComputedStyle(actions).gap,
          actionPadding: getComputedStyle(actions).padding,
          columns: getComputedStyle(actions).gridTemplateColumns.split(' ').length,
          buttonHeights: tools.map(tool => tool.getBoundingClientRect().height),
          buttonRows: tools.map(tool => tool.getBoundingClientRect().top),
          buttonBorders: tools.map(tool => getComputedStyle(tool).borderTopColor),
          buttonRadii: tools.map(tool => getComputedStyle(tool).borderTopLeftRadius),
          selectBorder: get('.space-editor__inspector select').borderTopColor,
          selectRadius: get('.space-editor__inspector select').borderTopLeftRadius,
          summaryButton: { height: get('[data-space-expand]').height, minHeight: get('[data-space-expand]').minHeight,
            border: get('[data-space-expand]').borderTopWidth, color: get('[data-space-expand]').color },
          line, ink, onAction, ownerStrong, ownerSoft
        };
      });
      expect(styles.owner).toBe(owner);
      expect(styles.accent).toBe(owner === 'NSA' ? (theme === 'light' ? '#087c5c' : '#50cfa8') : (theme === 'light' ? '#137998' : '#65cde5'));
      expect(styles.padding).toBe('8px');
      expect(styles.actionDisplay).toBe('grid');
      expect(styles.actionGap).toBe('8px');
      expect(styles.actionPadding).toBe('8px');
      expect(styles.columns).toBe(6);
      expect(styles.buttonHeights).toEqual(Array(6).fill(32));
      expect(new Set(styles.buttonRows).size).toBe(1);
      expect(styles.buttonBorders).toEqual(Array(6).fill(styles.line));
      expect(styles.buttonRadii).toEqual(Array(6).fill('2px'));
      expect(styles.selectBorder).toBe(styles.line);
      expect(styles.selectRadius).toBe('2px');
      expect(styles.summaryButton).toEqual({ height: '32px', minHeight: '28px', border: '0px', color: styles.ink });
      expect(active.color).toBe(styles.onAction);
      expect(active.stroke).toBe(styles.onAction);
      expect(hovered.color).toBe(styles.ownerStrong);
      expect(hovered.background).toBe(styles.ownerSoft);
      expect(hovered.stroke).toBe(styles.ownerStrong);

      for (const level of ['full', 'summary', 'minimal']) {
        await expect(card).toHaveAttribute('data-card-size', level);
        await expect(card.locator('.space-editor__drawer')).toBeVisible({ visible: level === 'full' });
        await expect(card.locator('.program-shape-actions')).toBeVisible({ visible: level !== 'minimal' });
        await expect(card.locator('.space-editor__fields tr:visible')).toHaveCount(level === 'minimal' ? 1 : 3);
        await expect(card.locator('.space-editor__fields th:visible')).toHaveCount(level === 'minimal' ? 0 : 3);
        await card.locator('[data-space-expand]').click();
      }
      await expect(card).toHaveAttribute('data-card-size', 'full');
    }
  });
}
