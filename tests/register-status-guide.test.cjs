const test = require("node:test");
const assert = require("node:assert/strict");
const Status = require("../src/program-planner/js/status.js");

for (const domain of ["register_nsa", "register_evt"]) {
  test(`${domain} guide covers the canonical application vocabulary in lifecycle order`, () => {
    const guide = Status.registerGuide(domain);
    const definition = Status.definitions[domain];
    const expected = definition.order.concat(Object.keys(definition.labels).filter((code) => !definition.order.includes(code)));
    assert.deepEqual(guide.statuses.map((status) => status.code), expected);
    assert.equal(new Set(expected).size, Object.keys(definition.labels).length);
    for (const status of guide.statuses) {
      assert.equal(status.label, Status.labelFor(domain, status.code));
      assert.ok(status.meaning.trim());
      assert.ok(status.reached.trim());
    }
    assert.match(guide.statuses.find((status) => status.code === "quoted").reached, /current linked Quote.*cannot be selected manually/);
    assert.match(guide.statuses.find((status) => status.code === "cancelled").reached, /reason/);
    assert.match(guide.statuses.find((status) => status.code === "review_required").reached, /original value is retained.*blocked/);
    assert.match(guide.notes.join(" "), /operator name.*reason.*resuming automation does not replay/);
  });
}

test("guides expose only application lifecycle information and return independent metadata", () => {
  for (const domain of ["project", "task", "job", "quote", "", "register_unknown"]) assert.equal(Status.registerGuide(domain), null);
  const first = Status.registerGuide("register_evt");
  first.statuses[0].meaning = "modified by consumer";
  first.notes.length = 0;
  const second = Status.registerGuide("register_evt");
  assert.notEqual(second.statuses[0].meaning, first.statuses[0].meaning);
  assert.equal(second.notes.length, 3);
  assert.equal(second.statuses.some((status) => status.code === "in_progress"), false);
  assert.match(second.statuses.find((status) => status.code === "scheduled").reached, /does not create an Event In Progress status/);
  assert.match(second.statuses.find((status) => status.code === "completed").reached, /separate Register completion recommendation.*Project completion alone does not/);
  assert.match(Status.registerGuide("register_nsa").statuses.find((status) => status.code === "in_progress").reached, /nominated Job changing to In Progress/);
});
