const {startSpaceCreation}=require('./test-helper.cjs');
const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
});

test("sidebar drawing toolbar replaces floating controls and gates drawing on a Project",async({page})=>{
  const child=page.frames().find(f=>f!==page.mainFrame());
  await child.evaluate(async()=>{
    await UOS.ProgramApp.updateWorkspace(w=>{w.entities.applications.push({id:"NSA-APP-DRAW-TOOLS",owner:"NSA",type:"application",title:"Drawing controls",status:"received",dateReceived:"2026-10-09"});w.workspace.selectedEntityId="NSA-APP-DRAW-TOOLS";return w;});
    await UOS.ProgramApp.navigate("map");
  });
  const frame=page.frameLocator("iframe");
  await expect(frame.locator("#floatingDrawToolbar,#selectToolButton,#providerSelect")).toHaveCount(0);
  for(const mode of ['polygon','line','square']) await expect(frame.locator('[data-space-create="'+mode+'"]')).toBeDisabled();
  await expect(frame.locator('#moasureImportButton')).toBeDisabled();
  await frame.locator('[data-promote-register-id="NSA-APP-DRAW-TOOLS"]').click();
  await expect(frame.locator('[data-space-create="polygon"]')).toBeEnabled();
  const toolbar=frame.locator("#spaceDrawingTools");
  await expect(toolbar.locator(".space-editor__tool-row")).toHaveCount(2);
  await expect(frame.locator("#spaceAcceptDraft")).toBeDisabled();
  await startSpaceCreation(frame,'line');
  await expect(frame.locator('[data-space-create="line"]')).toHaveAttribute("aria-current","true");
  await expect(frame.locator('[data-space-create="line"]')).toHaveClass(/is-active/);
  await expect(frame.locator("#spaceCancelDraft")).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(frame.locator("[data-space-draft]")).toHaveCount(0);
});
