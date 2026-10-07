"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const stages = [
 { name: "Canonical Calculator and Map governance", script: "test:canonical-work-governance" },
 { name: "Node suite", script: "test" },
 { name: "Browser suite", script: "test:browser" },
 { name: "Budget Gates O and P", script: "test:budget-gates" },
];
const failures = [];

for (const stage of stages) {
  console.log(`\n[release gates] Running ${stage.name}: npm run ${stage.script}`);
  const result = spawnSync(npm, ["run", stage.script], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    console.error(`[release gates] ${stage.name} could not start: ${result.error.message}`);
    failures.push(stage.name);
    continue;
  }
  if (result.status !== 0) {
    const detail = result.signal ? `signal ${result.signal}` : `exit code ${result.status}`;
    console.error(`[release gates] FAILED: ${stage.name} (${detail}).`);
    failures.push(stage.name);
    continue;
  }
  console.log(`[release gates] PASSED: ${stage.name}`);
}

if (failures.length) {
  console.error(`\n[release gates] FAILED: ${failures.join(" and ")}. Release gates did not pass.`);
  process.exitCode = 1;
} else {
  console.log("\n[release gates] All automated stages passed. Review the documented Critical gate evidence before release.");
}
