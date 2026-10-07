const { test, expect } = require("@playwright/test");

async function seedRegisterWithProject(page, shell, owner) {
  await page.goto(shell);
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS && window.UOS.ProgramApp && window.UOS.ProgramApp.snapshot().phase === "ready");
  const id = owner === "NSA" ? "NSA-APP-FLOOR-PROOF" : "EVT-FLOOR-PROOF";
  await child.evaluate(async ({ id, owner }) => {
    const record = owner === "EVT"
      ? {
          id, owner, type: "event", jobId: "FLOOR-PROOF", title: "Events drawer floor proof",
          status: "received", dateReceived: "2026-09-14",
          provenance: { owner, sourceApp: "test", sourceVersion: 5, sourceId: id, importedAt: "2026-09-14T00:00:00.000Z" }
        }
      : {
          id, owner, type: "application", receipt: "FLOOR-PROOF", title: "NSA drawer floor proof",
          status: "received", dateReceived: "2026-09-14",
          provenance: { owner, sourceApp: "test", sourceVersion: 5, sourceId: id, importedAt: "2026-09-14T00:00:00.000Z" }
        };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      (owner === "EVT" ? workspace.entities.events : workspace.entities.applications).push(record);
      workspace.workspace.selectedEntityId = id;
      const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, id);
      promoted.workspace.workspace.destination = "register";
      return promoted.workspace;
    });
    window.UOS.ProgramDisclosureRows.open("register:" + id);
  }, { id, owner });
  await page.waitForTimeout(350);
  return { child, id };
}

async function floorGeometry(child, id) {
  return child.evaluate((recordId) => {
    const drawer = document.querySelector('[data-register-drawer-record="' + CSS.escape(recordId) + '"]');
    const cell = drawer.closest("td");
    const host = drawer.querySelector("[data-register-module-host]");
    const floorStyle = getComputedStyle(drawer);
    const drawerStyle = getComputedStyle(drawer);
    const drawerRect = drawer.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    return {
      viewportBottom: innerHeight,
      floorBottom: drawerRect.bottom,
      drawerBottom: drawerRect.bottom,
      floorWidth: floorStyle.borderBottomWidth,
      floorStyle: floorStyle.borderBottomStyle,
      floorColor: floorStyle.borderBottomColor,
      drawerHeight: drawerRect.height,
      drawerMaxHeight: parseFloat(drawerStyle.maxHeight),
      hostHeight: host && !host.hidden ? host.getBoundingClientRect().height : 0
    };
  }, id);
}

for (const fixture of [
  { owner: "NSA", shell: "/src/program-planner/nsa.html", colour: /rgb\((4, 120, 87|21, 128, 61)\)/ },
    { owner: "EVT", shell: "/src/program-planner/events.html", colour: /rgb\((23, 105, 242|29, 78, 216)\)/ }
]) {
  test(fixture.owner + " Register and Calculator keep their owner floor inside the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 720 });
    const { child, id } = await seedRegisterWithProject(page, fixture.shell, fixture.owner);

    const register = await floorGeometry(child, id);
    expect(register.floorWidth).toBe("4px");
    expect(register.floorStyle).toBe("solid");
    expect(register.floorColor).toMatch(fixture.colour);
    expect(register.floorBottom).toBeLessThanOrEqual(register.viewportBottom);
    expect(register.floorBottom).toBeGreaterThanOrEqual(register.viewportBottom - 8);

    await child.evaluate((recordId) => window.UOS.ProgramApp.navigateWithContext("costing", recordId), id);
    await child.waitForFunction(() => document.body.getAttribute("data-drawer-module") === "costing");
    await page.waitForTimeout(350);

    const calculator = await floorGeometry(child, id);
    expect(calculator.floorWidth).toBe("4px");
    expect(calculator.floorStyle).toBe("solid");
    expect(calculator.floorColor).toMatch(fixture.colour);
    expect(calculator.floorBottom).toBeLessThanOrEqual(calculator.viewportBottom);
    expect(calculator.floorBottom).toBeGreaterThanOrEqual(calculator.viewportBottom - 8);
    expect(calculator.drawerBottom).toBeLessThan(calculator.viewportBottom);
    expect(calculator.drawerHeight).toBeLessThanOrEqual(calculator.drawerMaxHeight + 0.5);
    expect(calculator.hostHeight).toBeLessThanOrEqual(calculator.drawerHeight + 0.5);

    const frame = page.frameLocator("iframe");
    // This test explicitly exercises Job-level allowances; ordinary Calculator
    // additions may be costing-only and do not imply a selected Scheduler Job.
    await child.evaluate(async () => {
      await window.UOS.ProgramApp.updateWorkspace((workspace) => window.UOS.ProgramCosting.upsertRateItem(workspace, { id: 'RATE-FLOOR-LABOUR', kind: 'Labour', kindSource: 'user', category: 'Labour', description: 'A drawer floor labour rate', unit: 'hour', unitRate: 10, active: true, schedulerEnabled: true }));
    });
    for (let index = 1; index <= 8; index += 1) {
      const add = frame.locator('[data-costing-add-rate="RATE-FLOOR-LABOUR"]');
      await expect(add).toHaveCount(1);
      await add.evaluate((button) => button.click());
      await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(index);
      await page.waitForTimeout(250);

      const populated = await floorGeometry(child, id);
      expect(populated.floorBottom, "line " + index + " geometry: " + JSON.stringify(populated)).toBeLessThanOrEqual(populated.viewportBottom);
      expect(populated.drawerHeight).toBeLessThanOrEqual(populated.drawerMaxHeight + 0.5);
      expect(populated.hostHeight).toBeLessThanOrEqual(populated.drawerHeight + 0.5);
    }

    const baseline = await child.evaluate((recordId) => {
      const drawer = document.querySelector('[data-register-drawer-record="' + CSS.escape(recordId) + '"]');
      const tableScroller = drawer.closest(".program-table-wrap");
      const catalogScroller = drawer.querySelector(".program-cost-table-wrap");
      const calculatorScroller = drawer.querySelector(".program-calculator-table-wrap");
      // The outer Register scroll position is locked while its drawer is open.
      catalogScroller.scrollTop = Math.min(30, catalogScroller.scrollHeight - catalogScroller.clientHeight);
      calculatorScroller.scrollTop = Math.min(80, calculatorScroller.scrollHeight - calculatorScroller.clientHeight);
      return {
        floor: drawer.style.getPropertyValue("--program-drawer-max-height"),
        drawerHeight: drawer.getBoundingClientRect().height,
        tableScrollTop: tableScroller.scrollTop,
        catalogScrollTop: catalogScroller.scrollTop,
        calculatorScrollTop: calculatorScroller.scrollTop,
      };
    }, id);

    await child.evaluate(async () => {
      await window.UOS.ProgramApp.updateWorkspace((workspace) => {
        workspace.workspace.costing = Object.assign({}, workspace.workspace.costing, { selectedProjectId: workspace.workspace.selectedProjectId, jobId: workspace.entities.jobs[0].id });
        return workspace;
      });
    });
    const costingContext = await child.evaluate(() => {
      const workspace = window.UOS.ProgramApp.workspace();
      const controller = window.UOS.ProgramCostingController.snapshot();
      return {
        controllerJobId: controller.jobId,
        workspaceJobId: workspace.workspace.costing && workspace.workspace.costing.jobId,
        controllerJobExists: workspace.entities.jobs.some((job) => job.id === controller.jobId)
      };
    });
    expect(costingContext.controllerJobId).toBeTruthy();
    expect(costingContext.controllerJobExists).toBe(true);

    for (const values of [[10, 5], [0, 0]]) {
    await frame.locator("[data-costing-preliminaries]").evaluate((input, value) => {
      input.value = String(value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, values[0]);
      await expect.poll(() => child.evaluate(() => Number(window.UOS.ProgramCostingController.snapshot().preliminaries))).toBe(values[0]);
    await expect.poll(() => child.evaluate((jobId) => {
      const ws = window.UOS.ProgramApp.workspace();
      const job = ws.entities.jobs.find((item) => item.id === jobId);
      return Number(job?.costing?.preliminariesPercent);
    }, costingContext.controllerJobId)).toBe(values[0]);
    await frame.locator("[data-costing-margin]").evaluate((input, value) => {
      input.value = String(value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, values[1]);
    await expect.poll(() => child.evaluate((jobId) => {
      const ws = window.UOS.ProgramApp.workspace();
      const job = ws.entities.jobs.find((item) => item.id === jobId);
      return Number(job?.costing?.marginPercent);
    }, costingContext.controllerJobId)).toBe(values[1]);

      const stable = await child.evaluate((recordId) => {
        const drawer = document.querySelector('[data-register-drawer-record="' + CSS.escape(recordId) + '"]');
        const tableScroller = drawer.closest(".program-table-wrap");
        const catalogScroller = drawer.querySelector(".program-cost-table-wrap");
        const calculatorScroller = drawer.querySelector(".program-calculator-table-wrap");
        const footer = drawer.querySelector("[data-costing-totals-footer]");
        const catalog = drawer.querySelector(".program-cost-catalog");
        const calculator = drawer.querySelector(".program-job-calculator");
        return {
          floor: drawer.style.getPropertyValue("--program-drawer-max-height"),
          floorState: drawer.getAttribute("data-program-drawer-floor"),
          drawerHeight: drawer.getBoundingClientRect().height,
          tableScrollTop: tableScroller.scrollTop,
          catalogScrollTop: catalogScroller.scrollTop,
          calculatorScrollTop: calculatorScroller.scrollTop,
          footerVisible: footer.getBoundingClientRect().top >= drawer.getBoundingClientRect().top && footer.getBoundingClientRect().bottom <= drawer.getBoundingClientRect().bottom + 1,
          catalogVisible: catalog.getBoundingClientRect().top < catalog.getBoundingClientRect().bottom,
          calculatorVisible: calculator.getBoundingClientRect().top < calculator.getBoundingClientRect().bottom
        };
      }, id);
      expect(stable.floor).toBe(baseline.floor);
      expect(Math.abs(stable.drawerHeight - baseline.drawerHeight)).toBeLessThanOrEqual(1);
      expect(stable.floorState).toBe("stable");
      expect(stable.tableScrollTop).toBe(baseline.tableScrollTop);
      expect(stable.catalogScrollTop).toBe(baseline.catalogScrollTop);
      expect(stable.calculatorScrollTop).toBe(baseline.calculatorScrollTop);
      expect(stable.footerVisible).toBe(true);
      expect(stable.catalogVisible).toBe(true);
      expect(stable.calculatorVisible).toBe(true);
    }

  const finalCostingContext = await child.evaluate(() => ({ controller: window.UOS.ProgramCostingController.snapshot(), workspace: window.UOS.ProgramApp.workspace().workspace.costing }));
  expect(finalCostingContext.controller.preliminaries).toBe(0);
  expect(finalCostingContext.controller.margin).toBe(0);
  await expect(frame.locator('[data-costing-total-label="preliminaries"]')).toHaveText("Preliminaries (0%)");
  await expect(frame.locator('[data-costing-total-label="margin"]')).toHaveText("Margin (0%)");
    const expectedTotals = await child.evaluate(() => {
      const ws = window.UOS.ProgramApp.workspace();
      const controller = window.UOS.ProgramCostingController.snapshot();
      const totals = window.UOS.ProgramCosting.totals(ws.entities.costingLines.filter((line) => line.projectId === controller.selectedProjectId), { preliminariesPercent: controller.preliminaries, marginPercent: controller.margin });
      const money = (value) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);
      return {
        subtotal: money(totals.subtotal),
        preliminaries: money(totals.preliminaries),
        margin: money(totals.margin),
        gst: money(totals.gst),
        grand: money(totals.grandTotal)
      };
    });
    for (const [key, amount] of Object.entries(expectedTotals)) {
      await expect(frame.locator(`[data-costing-total="${key}"]`)).toHaveText(amount);
    }
  });
}
