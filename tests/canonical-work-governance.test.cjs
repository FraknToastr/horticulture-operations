"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("canonical work governance supersedes mandatory Job rules in source and viewer", () => {
  for (const file of ["CANONICAL_MODEL.md", "PRODUCT_CONSTITUTION.md", "PRODUCT_CONTRACTS.md", "PRODUCT_CONSTITUTION_VIEWER.html"]) {
    const text = read(`src/governance/${file}`);
    for (const required of ["schedulerEnabled", "operationId", "createWork", "recreateWorkJob", "deleteWorkJob", "jobCreationSuspended", "atomically", "topmost", "Apply reopen"]) {
      assert.ok(text.includes(required), `${file} must define ${required}`);
    }
    assert.doesNotMatch(text, /A Costing Line belongs to a Job and the same Delivery Project\./);
    assert.doesNotMatch(text, /one Work Geometry has exactly one canonical Space Map Job/);
  }
});

test("executable contracts preserve optional links, stable identities and atomic command ownership", () => {
  const text = read("src/program-planner/js/product-contracts.js");
  for (const required of ["createWork, recreateWorkJob and deleteWorkJob", "operationId", "schedulerEnabled", "persist atomically", "may have no Job", "Planner Task ownership"]) {
    assert.ok(text.includes(required), `executable contracts must define ${required}`);
  }
  assert.doesNotMatch(text, /Once promoted, one Work Geometry has exactly one canonical space-map Job/);
});

test("Calculator additions and mapped creation enter the canonical command layer", () => {
  const calculator = read("src/program-planner/js/costing.js");
  const start = calculator.indexOf("  function addRate(");
  assert.ok(start >= 0, "manual addition handler must exist");
  const end = calculator.indexOf("\n  function ", start + 1);
  const handler = calculator.slice(start, end < 0 ? undefined : end);
  assert.match(handler, /api\.createWork\(/);
  assert.match(handler, /operationId/);
  assert.doesNotMatch(handler, /(?:api|model)\.(?:addEntity|createLine|createJob|ensureCalculatorJob)\s*\(/, "manual additions cannot construct independent lines or Jobs");
  assert.match(calculator, /api\.recreateWorkJob\(/);
  assert.doesNotMatch(calculator, /entities\.jobs\.push\s*\(/, "Calculator UI cannot independently construct Jobs");
  const map = read("src/program-planner/js/work-area-service.js");
  assert.match(map, /deps\.costing\.createWork\(/, "new mapped work must use ProgramCosting");
  const polygon = read("src/program-planner/js/program-map.js");
  assert.match(polygon, /syncGeometry\(candidate, geometry\.id, \{ explicit: true \}\)/, "polygon Create a Job must deliberately override the automatic flag");
  assert.doesNotMatch(polygon, /(?:ProgramModel|ProgramCosting)\.(?:addEntity|createLine|createJob)\s*\(/, "polygon UI cannot independently construct work records");
  assert.match(read("src/program-planner/js/model.js"), /(?:UOS\.)?ProgramCosting\.deleteWorkJob\(/, "command-owned Job deletion must use ProgramCosting");
});


test("governance defines informational library calendars and command-owned Scheduler deletion", () => {
  for (const file of ["CANONICAL_MODEL.md", "PRODUCT_CONSTITUTION.md", "PRODUCT_CONTRACTS.md", "PRODUCT_CONSTITUTION_VIEWER.html"]) {
    const text = read(`src/governance/${file}`).replace(/\s+/g, " ");
    assert.match(text, /calendar appears only when its effective flag is enabled/);
    assert.match(text, /hover and keyboard-focus help/);
    assert.match(text, /clicking it never changes data/);
    assert.doesNotMatch(text, /calendar toggle/);
    assert.match(text, /action column reserves 88px/);
  }
  const scheduler = read("src/program-planner/js/scheduler.js");
  assert.doesNotMatch(scheduler, /entities\.tasks\s*=|task\.suppressed\s*=/, 'UI cannot repair Planner ownership');
  assert.match(scheduler, /deletePlannerTask: !!deletePlannerTask/);
  const calculator = read("src/program-planner/js/costing.js");
  assert.doesNotMatch(calculator, /data-costing-toggle-scheduler/);
});
