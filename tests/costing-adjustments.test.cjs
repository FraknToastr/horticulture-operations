const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function costingModel() {
  const context = { window: { UOS: {} } };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync("src/program-planner/js/costing-model.js", "utf8"),
    context,
    { filename: "src/program-planner/js/costing-model.js" }
  );
  return context.window.UOS.ProgramCosting;
}

test("calculator totals apply preliminaries before margin and GST", () => {
  const totals = costingModel().totals(
    [{ estimatedTotal: 800 }, { estimatedTotal: 200 }],
    { preliminariesPercent: 12.5, marginPercent: 7.5 }
  );

  assert.deepEqual(
    {
      subtotal: totals.subtotal,
      preliminariesPercent: totals.preliminariesPercent,
      preliminaries: totals.preliminaries,
      marginPercent: totals.marginPercent,
      margin: totals.margin,
      gst: totals.gst,
      grandTotal: totals.grandTotal,
      currency: totals.currency
    },
    {
      subtotal: 1000,
      preliminariesPercent: 12.5,
      preliminaries: 125,
      marginPercent: 7.5,
      margin: 84.38,
      gst: 120.94,
      grandTotal: 1330.32,
      currency: "AUD"
    }
  );
});

test("calculator totals default both adjustments to zero", () => {
  const totals = costingModel().totals([{ estimatedTotal: 100 }]);

  assert.equal(totals.preliminariesPercent, 0);
  assert.equal(totals.preliminaries, 0);
  assert.equal(totals.marginPercent, 0);
  assert.equal(totals.margin, 0);
  assert.equal(totals.gst, 10);
  assert.equal(totals.grandTotal, 110);
});
