const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const { suppressBackupModalForFunctionalTest } = require("./test-helper.cjs");

function visibleRateIds(frame) {
  return frame.locator("[data-rate-item-row]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-rate-item-row")));
}

test.beforeEach(async ({ page }) => {
  await suppressBackupModalForFunctionalTest(page);
});

test("Rate Item headers sort full values accessibly and retain state through filters", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      const record = { id: "NSA-APP-RATE-SORT", owner: "NSA", type: "application", title: "Rate sort", status: "received", dateReceived: "2026-09-29" };
      workspace.entities.applications.push(record);
      workspace = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id).workspace;
      workspace.entities.rateItems.push(
        { id: "RATE-SORT-003", owner: "", type: "rateItem", kind: "Labour", category: "Beta", description: "Sort target Alpha", unit: "hour", unitRate: 30, active: true, quantityKind: "hours" },
        { id: "RATE-SORT-001", owner: "", type: "rateItem", kind: "Labour", category: "Alpha", description: "Sort target Alpha", unit: "hour", unitRate: 10, active: true, quantityKind: "hours" },
        { id: "RATE-SORT-002", owner: "", type: "rateItem", kind: "Labour", category: "Alpha", description: "Sort target Zulu", unit: "hour", unitRate: 20, active: true, quantityKind: "hours" },
        { id: "RATE-SORT-EQUIPMENT", owner: "", type: "rateItem", kind: "Equipment", category: "Alpha", description: "Sort target Equipment", unit: "hour", unitRate: 40, active: true, quantityKind: "hours" }
      );
      workspace.workspace.destination = "costing";
      workspace.workspace.selectedProjectId = workspace.entities.projects.at(-1).id;
      return workspace;
    });
  });
  const frame = page.frameLocator("iframe");
  await frame.locator('[data-program-destination="costing"]').click();
  await frame.locator("[data-costing-tools-toggle]").click();
  await frame.locator("[data-costing-search]").fill("Sort target");
  const categorySort = frame.locator('[data-rate-sort="category"]');
  const descriptionSort = frame.locator('[data-rate-sort="description"]');
  const customIds = async () => (await visibleRateIds(frame)).filter((id) => id.startsWith("RATE-SORT-") && id !== "RATE-SORT-EQUIPMENT");

  await expect(descriptionSort.locator("[data-rate-sort-indicator]")).toHaveText("↑");
  await expect(descriptionSort.locator("xpath=ancestor::th[1]")).toHaveAttribute("aria-sort", "ascending");
  expect(await customIds()).toEqual(["RATE-SORT-001", "RATE-SORT-003", "RATE-SORT-002"]);

  await categorySort.click();
  await expect(categorySort.locator("xpath=ancestor::th[1]")).toHaveAttribute("aria-sort", "ascending");
  expect(await customIds()).toEqual(["RATE-SORT-001", "RATE-SORT-002", "RATE-SORT-003"]);
  await categorySort.click();
  await expect(categorySort.locator("[data-rate-sort-indicator]")).toHaveText("↓");
  expect(await customIds()).toEqual(["RATE-SORT-003", "RATE-SORT-002", "RATE-SORT-001"]);

  await descriptionSort.focus();
  await descriptionSort.press("Enter");
  await expect(descriptionSort.locator("xpath=ancestor::th[1]")).toHaveAttribute("aria-sort", "ascending");
  await descriptionSort.press("Space");
  await expect(descriptionSort.locator("xpath=ancestor::th[1]")).toHaveAttribute("aria-sort", "descending");
  expect(await customIds()).toEqual(["RATE-SORT-002", "RATE-SORT-003", "RATE-SORT-001"]);

  await frame.locator('[data-costing-section="Equipment"]').click();
  await frame.locator('[data-costing-section="Labour"]').click();
  await expect(descriptionSort.locator("xpath=ancestor::th[1]")).toHaveAttribute("aria-sort", "descending");
  await frame.locator("[data-costing-category]").selectOption("Alpha");
  expect(await customIds()).toEqual(["RATE-SORT-002", "RATE-SORT-001"]);
  await frame.locator("[data-costing-category]").selectOption("all");
  await frame.locator("[data-costing-search]").fill("Sort target Alpha");
  expect(await customIds()).toEqual(["RATE-SORT-003", "RATE-SORT-001"]);

  const editRow = frame.locator('[data-rate-item-row="RATE-SORT-003"]');
  await editRow.locator('[data-costing-edit-rate="RATE-SORT-003"]').click();
  await expect(frame.locator('[data-costing-rate-form] [name="description"]')).toHaveValue("Sort target Alpha");
  await frame.locator("[data-costing-rate-cancel]").first().click();
  await editRow.locator('[data-costing-add-rate="RATE-SORT-003"]').click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.costingLines.some((line) => line.rateItemId === "RATE-SORT-003"))).toBe(true);
  await child.evaluate(() => { window.UOS.dialogs.confirm = async () => true; });
  await frame.locator('[data-rate-item-row="RATE-SORT-001"] [data-costing-delete-rate="RATE-SORT-001"]').click();
  await expect.poll(() => child.evaluate(() => window.UOS.ProgramApp.workspace().entities.rateItems.some((rate) => rate.id === "RATE-SORT-001"))).toBe(false);
});

test("Rate Library keeps its action rail visible while the table scrolls and Escape closes the editor", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  await child.evaluate(async () => {
    const record = {
      id: "NSA-APP-RATE-LIBRARY-UI", owner: "NSA", type: "application",
      receipt: "RATE-LIBRARY-UI", title: "Rate Library interaction test", status: "received",
      dateReceived: "2026-09-28", provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 1, sourceId: "RATE-LIBRARY-UI" }
    };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      workspace.workspace.selectedEntityId = record.id;
      return window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id).workspace;
    });
  });
  const frame = page.frameLocator("iframe");
  await frame.locator('[data-program-destination="costing"]').click();
  const table = frame.locator(".program-cost-table");
  await expect(table).toBeVisible();
  await frame.locator('[data-costing-section="Material"]').click();
  await expect(table.locator("tbody tr")).not.toHaveCount(0);

  const scrollState = await frame.locator(".program-cost-table-wrap").evaluate((wrap) => {
    // Exercise the conditional sticky rail even when this viewport happens
    // to be wide enough for the current rate catalog without scrolling.
    wrap.style.maxWidth = "520px";
    wrap.style.width = "520px";
    wrap.style.overflowX = "auto";
    wrap.querySelector("table").style.minWidth = "900px";
    const row = Array.from(wrap.querySelectorAll("tbody tr")).find((candidate) => candidate.querySelector("td:nth-child(2)"));
    const action = row?.querySelector("td:last-child");
    const description = row?.querySelector("td:nth-child(2)");
    if (!action || !description || wrap.scrollWidth <= wrap.clientWidth) return { overflows: false, action: !!action, description: !!description, scrollWidth: wrap.scrollWidth, clientWidth: wrap.clientWidth };
    const beforeAction = action.getBoundingClientRect().left;
    const beforeDescription = description.getBoundingClientRect().left;
    wrap.scrollLeft = Math.min(260, wrap.scrollWidth - wrap.clientWidth);
    return {
      overflows: true,
      actionShift: action.getBoundingClientRect().left - beforeAction,
      descriptionShift: description.getBoundingClientRect().left - beforeDescription,
      actionsStayInside: action.getBoundingClientRect().right <= wrap.getBoundingClientRect().right + 1
    };
  });
  expect(scrollState.overflows, JSON.stringify(scrollState)).toBe(true);
  expect(Math.abs(scrollState.actionShift)).toBeLessThanOrEqual(1);
  expect(scrollState.descriptionShift).toBeLessThan(-20);
  expect(scrollState.actionsStayInside).toBe(true);

  await expect(frame.locator("[data-costing-tools]")).toBeHidden();
  await expect(frame.locator("[data-costing-add-item]")).toBeHidden();
  await frame.locator("[data-costing-tools-toggle]").click();
  await expect(frame.locator("[data-costing-tools] [data-costing-add-item]")).toBeVisible();
  await frame.locator("[data-costing-add-item]").click();
  const dialog = frame.locator("[data-costing-rate-dialog]");
  await expect(dialog).toBeVisible();
  await dialog.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(frame.locator("[data-costing-add-item]")).toBeFocused();
});

test("Rate Library tools disclose accessibly and icon menu aligns with Calculator header", async ({ page }) => {
 await page.setViewportSize({ width: 1600, height: 900 });
 await page.goto("/src/program-planner/nsa.html");
 const child = page.frames().find((candidate) => candidate !== page.mainFrame());
 await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
 await child.evaluate(async () => {
   const record = {
     id: "NSA-APP-RATE-LIBRARY-MENU", owner: "NSA", type: "application",
     receipt: "RATE-LIBRARY-MENU", title: "Rate Library menu test", status: "received",
     dateReceived: "2026-09-28", provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 1, sourceId: "RATE-LIBRARY-MENU" }
   };
   await window.UOS.ProgramApp.updateWorkspace((workspace) => {
     workspace.entities.applications.push(record);
     workspace.workspace.selectedEntityId = record.id;
     const promoted = window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id).workspace;
     const rate = promoted.entities.rateItems[0];
     rate.kind = "Labour";
     rate.category = "Plant Hire/Contractors and more";
     return promoted;
   });
 });
 const frame = page.frameLocator("iframe");
 await frame.locator('[data-program-destination="costing"]').click();
 await expect(frame.locator('.program-cost-table')).toBeVisible();
 const toggle = frame.locator("[data-costing-tools-toggle]");
 const drawer = frame.locator("[data-costing-tools]");
 await expect(drawer).toBeHidden();
 await expect(toggle).toHaveAttribute("aria-expanded", "false");
 const menuBefore = await frame.locator(".program-cost-tabs").boundingBox();
 await toggle.click();
 await expect(drawer).toBeVisible();
 await expect(toggle).toHaveAttribute("aria-expanded", "true");
 const menuAfter = await frame.locator(".program-cost-tabs").boundingBox();
 expect(menuAfter.y).toBeGreaterThan(menuBefore.y);
 await expect(frame.locator("[data-costing-search]")).toBeFocused();
 await frame.locator("[data-costing-search]").press("Escape");
 await expect(drawer).toBeHidden();
 await expect(toggle).toBeFocused();
 const layout = await child.evaluate(() => {
   const menu = document.querySelector(".program-cost-tabs");
   const heading = document.querySelector(".program-job-calculator .program-calculator-table thead tr");
   const buttons = [...menu.querySelectorAll("button")];
   const pills = [...document.querySelectorAll(".program-cost-table .program-category-pill")];
   const truncated = pills.find((pill) => pill.textContent.endsWith("..."));
   const textRange = document.createRange();
   if (truncated) textRange.selectNodeContents(truncated);
   const textRect = truncated ? textRange.getBoundingClientRect() : null;
   const pillRect = truncated?.getBoundingClientRect();
   const pillStyle = truncated ? getComputedStyle(truncated) : null;
   return {
     menuHeight: menu.getBoundingClientRect().height,
     headingHeight: heading.getBoundingClientRect().height,
     icons: buttons.map((button) => button.querySelector("svg")?.innerHTML),
     pillOutlinesClosed: pills.length > 0 && pills.every((pill) =>
       parseFloat(getComputedStyle(pill).borderRightWidth) > 0 &&
       pill.getBoundingClientRect().right < pill.closest("td").getBoundingClientRect().right),
     pillBounds: pills.map((pill) => ({ text: pill.textContent, pill: pill.getBoundingClientRect().toJSON(), cell: pill.closest("td").getBoundingClientRect().toJSON(), colWidth: document.querySelector('.program-cost-col-category')?.style.width, tableWidth: document.querySelector('.program-cost-table')?.getBoundingClientRect().width })),
     ellipsisInsidePill: !!truncated && truncated.textContent === "Plant Hire/Contractors..." &&
       textRect.right <= pillRect.right - parseFloat(pillStyle.paddingRight) &&
       Math.abs(parseFloat(pillStyle.paddingLeft) - parseFloat(pillStyle.paddingRight)) < 1,
     pillDiagnostic: { text: truncated?.textContent, textRight: textRect?.right, pillRight: pillRect?.right, paddingRight: pillStyle?.paddingRight },
     centered: Math.abs((buttons[0].getBoundingClientRect().left + buttons[buttons.length - 1].getBoundingClientRect().right) / 2 - (menu.getBoundingClientRect().left + menu.getBoundingClientRect().right) / 2) < 2,
     verticallyCentered: buttons.every((button) => Math.abs((button.getBoundingClientRect().top + button.getBoundingClientRect().bottom) / 2 - (menu.getBoundingClientRect().top + menu.getBoundingClientRect().bottom) / 2) < 2),
     matchesHeader: buttons.every((button) => {
       const header = document.querySelector('.program-header-nav__item');
       return getComputedStyle(button).height === getComputedStyle(header).height &&
         getComputedStyle(button).fontSize === getComputedStyle(header).fontSize &&
         getComputedStyle(button.querySelector('svg')).width === getComputedStyle(header.querySelector('svg')).width;
     })
   };
 });
 expect(layout.icons).toHaveLength(5);
 expect(new Set(layout.icons).size).toBe(5);
 expect(layout.centered).toBe(true);
 expect(layout.verticallyCentered).toBe(true);
 expect(layout.matchesHeader).toBe(true);
 expect(layout.pillOutlinesClosed, JSON.stringify(layout.pillBounds)).toBe(true);
 expect(layout.ellipsisInsidePill, JSON.stringify(layout.pillDiagnostic)).toBe(true);
  expect(Math.abs(layout.menuHeight - layout.headingHeight)).toBeLessThanOrEqual(1);
});

test("drawer actions remain available for every Kind and Add saves to the active Kind", async ({ page }) => {
  await page.goto("/src/program-planner/nsa.html");
  const child = page.frames().find((candidate) => candidate !== page.mainFrame());
  await child.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === "ready");
  expect(await child.evaluate(() => window.UOS.ProgramApp.isSessionCleared())).toBe(false);
  await child.evaluate(async () => {
    const record = {
      id: "NSA-APP-RATE-KIND-ADD", owner: "NSA", type: "application",
      receipt: "RATE-KIND-ADD", title: "Rate Kind action test", status: "received",
      dateReceived: "2026-09-29",
      provenance: { owner: "NSA", sourceApp: "test", sourceVersion: 5, sourceId: "RATE-KIND-ADD" }
    };
    await window.UOS.ProgramApp.updateWorkspace((workspace) => {
      workspace.entities.applications.push(record);
      workspace.workspace.selectedEntityId = record.id;
      return window.UOS.ProgramModel.promoteRegisterRecord(workspace, record.id).workspace;
    });
  });

  const frame = page.frameLocator("iframe");
  const costingNav = frame.locator('[data-program-destination="costing"]');
  await costingNav.click();
  await expect(frame.locator(".program-cost-table")).toBeVisible();
  await expect(costingNav).toHaveAttribute("aria-current", "page");
  await expect(frame.locator("[data-program-persistence]")).toHaveText("Saved");
  const drawer = frame.locator("[data-costing-tools]");
  const add = drawer.locator("[data-costing-add-item]");
  const exportButton = drawer.locator("[data-costing-export]");
  const dialog = frame.locator("[data-costing-rate-dialog]");
  await expect(drawer).toBeHidden();
  await expect(add).toBeHidden();
  await expect(exportButton).toBeHidden();
  await frame.locator("[data-costing-tools-toggle]").click();

  for (const kind of ["Labour", "Equipment", "Material", "Contractors", "Sundry"]) {
    const tab = frame.locator(`[data-costing-section="${kind}"]`);
    if (kind !== "Labour") await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(drawer).toBeVisible();
    await expect(add).toBeEnabled();
    await expect(exportButton).toBeEnabled();
    await add.click();
    await expect(dialog.locator('[name="kind"]')).toHaveValue(kind);
    await dialog.locator('[data-costing-rate-cancel]').first().click();
    await expect(dialog).toBeHidden();
    await expect(costingNav).toHaveAttribute("aria-current", "page");
  }

  await frame.locator('[data-costing-section="Equipment"]').click();
  await add.click();
  await dialog.locator('[name="description"]').fill("Selected Equipment Kind rate");
  await dialog.locator('[name="category"]').selectOption("Materials");
  await dialog.locator('[name="unitRate"]').fill("7.25");
  await dialog.locator('[data-costing-rate-submit]').click();
  await expect(dialog).toBeHidden();
  await expect(frame.locator('[data-costing-section="Equipment"]')).toHaveAttribute("aria-selected", "true");
  await expect(frame.locator('[data-costing-catalog-body]')).toContainText("Selected Equipment Kind rate");
  const saved = await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.rateItems.find((rate) => rate.description === "Selected Equipment Kind rate"));
  expect(saved.kind).toBe("Equipment");
  expect(saved.kindSource).toBe("user");
  const stored = await child.evaluate(async () => (await window.UOS.ProgramStorage.get()).entities.rateItems.find((rate) => rate.description === "Selected Equipment Kind rate"));
  expect(stored.kind).toBe("Equipment");
  const otherKindDescription = await child.evaluate(() => window.UOS.ProgramApp.workspace().entities.rateItems.find((rate) => rate.kind === "Labour").description);
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("horticulture-rate-items.csv");
  const csv = fs.readFileSync(await download.path(), "utf8");
  expect(csv).toContain("Selected Equipment Kind rate");
  expect(csv).toContain(otherKindDescription);
});
