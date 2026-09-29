const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const source = fs.readFileSync("src/program-planner/js/program-map.js", "utf8");

test("PC-015 retains the Project Polygon Summary action for empty and populated states", () => {
  assert.match(source, /var polygonPillText = shapeCount === 1 \? "1 polygon" : \(shapeCount \+ " polygons"\)/);
  assert.match(source, /var buttonLabel = shapeCount > 0 \? "Edit Polygons" : "Add Polygons"/);
  assert.match(source, /data-edit-event-id/);
});

test("PC-015 keeps drawer-scoped Location cards out of compact disclosure modes", () => {
  assert.match(source, /data-disclosure-skip/);
  assert.match(source, /data-location-action="add"/);
  assert.doesNotMatch(source, /data-compact-panel/);
});

test("PC-015 keeps Project Polygon Summary permanently full-size without disclosure wiring", () => {
  assert.match(source, /var isAlwaysExpandedCard = isRegisterDrawer \|\| !isRegisterScope/);
  assert.match(source, /isAlwaysExpandedCard \? ' data-disclosure-skip' : ''/);
});

test("Project map fallback is presentation-only and map-state saves are idempotent", () => {
  assert.match(source, /if \(storedMapStateMatches\(workspace, intendedState\)\) return Promise\.resolve\(workspace\);/);
  assert.match(source, /This is a presentation fallback/);
  assert.doesNotMatch(source, /selectedEventFilterId = "all";\s*persistCanonicalMapState/);
});
