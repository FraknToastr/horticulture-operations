const { test, expect } = require('@playwright/test');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');

for (const width of [1840, 390]) {
  test(`shared tooltips keep 48px clearance, viewport bounds and accessible names at ${width}px`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/src/program-planner/nsa.html');
    const child = page.frames().find(frame => frame !== page.mainFrame());
    await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      await child.evaluate(corner => {
        document.getElementById('tooltip-test')?.remove();
        const button = document.createElement('button');
        button.id = 'tooltip-test';
        button.title = corner === 'bottom-right' ? 'A long description that remains readable and scrollable. '.repeat(100) : 'Full description for this control';
        button.style.cssText = `position:fixed;z-index:999999;width:34px;height:34px;${corner.includes('top') ? 'top' : 'bottom'}:16px;${corner.includes('left') ? 'left' : 'right'}:16px;`;
        document.body.append(button);
      }, corner);
      const button = child.locator('#tooltip-test');
      await expect(button).not.toHaveAttribute('title');
      await expect(button).toHaveAttribute('aria-label', /description/);
      await button.hover();
      const tooltip = child.locator('.uos-tooltip');
      await expect(tooltip).toBeVisible();
      const layout = await button.evaluate(button => {
        const tip = document.querySelector('.uos-tooltip'), a = button.getBoundingClientRect(), b = tip.getBoundingClientRect();
        return { clearance: Math.max(b.left - (a.left + a.width / 2), (a.left + a.width / 2) - b.right, b.top - (a.top + a.height / 2), (a.top + a.height / 2) - b.bottom), left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: innerWidth, height: innerHeight, scrollable: tip.scrollHeight > tip.clientHeight, described: button.getAttribute('aria-describedby') === tip.id };
      });
      expect(layout.clearance).toBeGreaterThanOrEqual(48);
      expect(layout.left).toBeGreaterThanOrEqual(8);
      expect(layout.top).toBeGreaterThanOrEqual(8);
      expect(layout.right).toBeLessThanOrEqual(layout.width - 8);
      expect(layout.bottom).toBeLessThanOrEqual(layout.height - 8);
      expect(layout.described).toBe(true);
      if (corner !== 'bottom-right') {
        // Clicking a neighbouring control underneath visible help must work.
        await button.evaluate(() => {
          const rect = document.querySelector('.uos-tooltip').getBoundingClientRect();
          const underlying = document.createElement('button'); underlying.id = 'tooltip-underlying';
          underlying.textContent = 'Neighbour';
          underlying.style.cssText = `position:fixed;z-index:99999;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`;
          underlying.addEventListener('click', () => { underlying.dataset.clicked = 'true'; });
          document.body.append(underlying);
        });
        await child.locator('#tooltip-underlying').click();
        await expect(child.locator('#tooltip-underlying')).toHaveAttribute('data-clicked', 'true');
        await child.locator('#tooltip-underlying').evaluate(button => button.remove());
        await button.hover();
        await expect(tooltip).toBeVisible();
      }
      if (corner === 'bottom-right') {
        expect(layout.scrollable).toBe(true);
      if (layout.scrollable) {
        await expect(tooltip).toHaveCSS('pointer-events', 'auto');
        await tooltip.hover();
        await tooltip.evaluate(tip => { tip.scrollTop = 80; });
      } else await expect(tooltip).toHaveCSS('pointer-events', 'none');
        await expect(tooltip).toBeVisible();
      }
      await button.evaluate(button => button.remove());
      await expect(tooltip).toBeHidden();
    }
    await child.evaluate(() => {
      const button = document.createElement('button'); button.id = 'tooltip-keyboard';
      button.textContent = 'Keyboard help';
      button.style.cssText = 'position:fixed;top:50px;left:50px;z-index:999999';
      button.setAttribute('data-uos-tooltip', 'Existing explicit help'); button.title = 'Accessible name';
      button.setAttribute('aria-describedby', 'existing-description'); document.body.append(button);
      const input = document.createElement('input'); input.style.cssText = 'position:fixed;top:90px;left:50px;z-index:999999'; document.body.append(input);
    });
    const keyboard = child.locator('#tooltip-keyboard');
    await expect(keyboard).not.toHaveAttribute('title');
    await keyboard.focus();
    await keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(keyboard).toBeFocused();
    await expect(child.locator('.uos-tooltip')).toBeVisible();
    await expect(child.locator('.uos-tooltip')).toHaveText('Existing explicit help');
    await expect(keyboard).toHaveAttribute('aria-describedby', 'existing-description uos-shared-tooltip');
    await keyboard.press('Escape');
    await expect(child.locator('.uos-tooltip')).toBeHidden();
    await expect(keyboard).toHaveAttribute('aria-describedby', 'existing-description');
  });
}
