const { test, expect } = require("@playwright/test");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

test.beforeEach(async ({ page }) => { await suppressBackupModalForFunctionalTest(page); });

test("NSA Planner shortcut retains every Register row header and dates use DD/MM/YYYY", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    const pdfRecord = { id: "NSA-APP-PDF-ROW", owner: "NSA", type: "application", receipt: "PDF-42", title: "PDF source", status: "received", dateReceived: "1974-03-22", provenance: { owner: "NSA", sourceApp: "pdf-drop", sourceVersion: 5, sourceId: "PDF-42", importedAt: "1974-03-22T00:00:00.000Z" } };
    const secondRecord = { id: "NSA-APP-SECOND-ROW", owner: "NSA", type: "application", receipt: "SECOND-41", title: "Second source", status: "received", dateReceived: "1974-03-21" };
    const manualRecord = { id: "NSA-APP-MANUAL-ROW", owner: "NSA", type: "application", receipt: "MANUAL-43", title: "Manual source", status: "received", dateReceived: "1974-03-23", provenance: { owner: "NSA", sourceApp: "manual-entry", sourceVersion: 5, sourceId: "MANUAL-43", importedAt: "1974-03-23T00:00:00.000Z" } };
    const fourthRecord = { id: "NSA-APP-FOURTH-ROW", owner: "NSA", type: "application", receipt: "FOURTH-44", title: "Fourth source", status: "received", dateReceived: "1974-03-24" };
    const fifthRecord = { id: "NSA-APP-FIFTH-ROW", owner: "NSA", type: "application", receipt: "FIFTH-45", title: "Fifth source", status: "received", dateReceived: "1974-03-25" };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(secondRecord, pdfRecord, manualRecord, fourthRecord, fifthRecord);
      const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, manualRecord.id);
      promoted.workspace.workspace.destination = "register";
    promoted.workspace.workspace.ownerMode = "NSA";
    promoted.workspace.workspace.selectedEntityId = manualRecord.id;
    promoted.workspace.workspace.selectedProjectId = promoted.project.id;
    promoted.workspace.workspace.register = promoted.workspace.workspace.register || {};
    promoted.workspace.workspace.register.sort = "date";
    promoted.workspace.workspace.register.sortDirection = "asc";
    return promoted.workspace;
    });
  });

  const frame = page.frameLocator("iframe");
  const secondRow = frame.locator('tr[data-register-record="NSA-APP-SECOND-ROW"]');
  const pdfRow = frame.locator('tr[data-register-record="NSA-APP-PDF-ROW"]');
  const manualRow = frame.locator('tr[data-register-record="NSA-APP-MANUAL-ROW"]');
  await expect(pdfRow).toBeVisible();
  await expect(secondRow).toBeVisible();
  await expect(manualRow).toBeVisible();
  await expect(pdfRow.locator(".program-register-table__received-cell")).toHaveText("22/03/1974");
  await expect(manualRow.locator(".program-register-table__received-cell")).toHaveText("23/03/1974");
  await expect(frame.locator(".program-register-table thead th").nth(3)).toContainText("Status");
  await expect(frame.locator(".program-register-table thead th").nth(4)).toContainText("Received");
  await expect(frame.locator(".program-register-table thead th").nth(5)).toContainText("Receipt");
  await expect(frame.locator(".program-register-table thead th").nth(6)).toContainText("Project");
  await expect(frame.locator(".program-register-table thead th").nth(7)).toContainText("Budget");
  await expect(manualRow.locator(".program-register-table__budget-cell")).toHaveText("$0.00");
  await expect(manualRow.locator('[data-register-action="budget"]')).toHaveCount(0);

  const plannerButton = manualRow.locator('[data-register-action="planner"]');
  await expect(plannerButton).toBeEnabled();
  await expect(pdfRow.locator('[data-register-action="planner"]')).toBeDisabled();
  const actionLayout = await manualRow.locator(".program-register-table__actions-cell").evaluate((cell) => {
    const toolbar = cell.querySelector(".program-register-mini-toolbar");
    const buttons = Array.from(toolbar.querySelectorAll("button"));
    const cellBounds = cell.getBoundingClientRect();
    const toolbarBounds = toolbar.getBoundingClientRect();
    const plannerStyle = getComputedStyle(toolbar.querySelector('[data-register-action="planner"]'));
    return {
      rightGap: cellBounds.right - toolbarBounds.right,
      toolbarWidth: toolbarBounds.width,
      firstInset: buttons[0].getBoundingClientRect().left - toolbarBounds.left,
      lastInset: toolbarBounds.right - buttons[buttons.length - 1].getBoundingClientRect().right,
      plannerBorderWidth: plannerStyle.borderTopWidth,
      plannerRadius: plannerStyle.borderTopLeftRadius
    };
  });
  expect(actionLayout.rightGap).toBeLessThanOrEqual(10);
  expect(actionLayout.toolbarWidth).toBeLessThanOrEqual(280);
  expect(actionLayout.firstInset).toBeGreaterThanOrEqual(8);
  expect(actionLayout.lastInset).toBeGreaterThanOrEqual(8);
  expect(actionLayout.plannerBorderWidth).toBe("1px");
  expect(actionLayout.plannerRadius).toBe("4px");
  const before = await child.evaluate(() => {
    const outer = document.querySelector("[data-register-table-body]").closest(".program-table-wrap");
    const second = document.querySelector('tr[data-register-record="NSA-APP-SECOND-ROW"]');
    const pdf = document.querySelector('tr[data-register-record="NSA-APP-PDF-ROW"]');
    const manual = document.querySelector('tr[data-register-record="NSA-APP-MANUAL-ROW"]');
    return { scrollTop: outer.scrollTop, secondTop: second.getBoundingClientRect().top, pdfTop: pdf.getBoundingClientRect().top, manualTop: manual.getBoundingClientRect().top };
  });
  expect(before.secondTop).toBeLessThan(before.pdfTop);
  expect(before.pdfTop).toBeLessThan(before.manualTop);
  await plannerButton.click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.destination)).toBe("planner");
  await expect(manualRow).toBeVisible();
  const openGeometry = async () => child.evaluate(() => {
    const outer = document.querySelector("[data-register-table-body]").closest(".program-table-wrap");
    const header = outer.querySelector(".program-register-table thead th");
    const selected = document.querySelector('tr[data-register-record="NSA-APP-MANUAL-ROW"]');
    return {
      rowCount: document.querySelectorAll("[data-register-table-body] > tr.program-register-summary-row").length,
      offset: selected.getBoundingClientRect().top - header.getBoundingClientRect().bottom,
      overflow: getComputedStyle(outer).overflowY,
      scrollTop: outer.scrollTop
    };
  });
  await expect.poll(async () => (await openGeometry()).offset).toBeGreaterThanOrEqual(-1);
  const plannerGeometry = await openGeometry();
  expect(plannerGeometry.offset).toBeLessThanOrEqual(1);
  expect(plannerGeometry.rowCount).toBeGreaterThanOrEqual(5);
  expect(plannerGeometry.overflow).toBe("hidden");

  await manualRow.locator('[data-register-action="register"]').click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.destination)).toBe("register");
  expect((await openGeometry()).offset).toBeLessThanOrEqual(1);

  await manualRow.locator('[data-register-action="map"]').click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.destination)).toBe("map");
  expect((await openGeometry()).rowCount).toBeGreaterThanOrEqual(5);
  expect((await openGeometry()).offset).toBeLessThanOrEqual(1);
  await manualRow.locator('[data-register-action="register"]').click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.destination)).toBe("register");

  await manualRow.locator('[data-register-action="planner"]').click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.destination)).toBe("planner");

  await frame.locator("[data-register-add-record]").click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.destination)).toBe("register");
  const newRecordId = await child.evaluate(() => window.UOS.ProgramApp.workspace().workspace.selectedEntityId);
  expect(newRecordId).toMatch(/^NSA-APP-/);
  const newDrawer = frame.locator(`[data-register-drawer-record="${newRecordId}"]`);
  await expect(newDrawer).toBeVisible();
  await expect.poll(() => newDrawer.getAttribute("data-program-drawer-floor")).toBe("stable");
  expect(await newDrawer.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(179.5);
  await expect.poll(() => child.evaluate(() => document.body.getAttribute("data-drawer-module"))).toBe(null);
  await child.evaluate(() => window.UOS.ProgramDisclosureRows.closeScope("register"));
  await expect.poll(() => child.evaluate(() => document.querySelector("[data-register-table-body]").closest(".program-table-wrap").scrollTop)).toBe(before.scrollTop);
});
