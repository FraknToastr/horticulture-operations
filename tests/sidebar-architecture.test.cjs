const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const plannerRoot = path.join(process.cwd(), "src", "program-planner");

test("PC-014 removes loaded compact, floating and undocked sidebar mechanics", () => {
  const index = fs.readFileSync(path.join(plannerRoot, "index.html"), "utf8");
  const scripts = fs.readdirSync(path.join(plannerRoot, "js"));

  assert.equal(scripts.includes("compact-panels.js"), false);
  assert.doesNotMatch(index, /compact-panels|data-compact-panel/i);
  assert.doesNotMatch(index, /floating-small-panel|side-rail-state/i);
});

test("PC-014 keeps normal full-size operational sidebars in the application shell", () => {
  const index = fs.readFileSync(path.join(plannerRoot, "index.html"), "utf8");
  for (const selector of ["program-planner-sidebar", "program-costing-projects-pane", "program-quote-sidebar"]) {
    assert.match(index, new RegExp(selector));
  }
});
