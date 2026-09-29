"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const node = process.execPath;
const playwright = path.join(root, "node_modules", "@playwright", "test", "cli.js");
const stages = [
  ["Gate O/P model and persistence", node, ["--test", "tests/budget-model.test.cjs", "tests/budget-governance.test.cjs"]],
  ["Gate O/P browser workflow", node, [playwright, "test", "tests/browser/budget-workflow.spec.js", "--workers=1"]],
];

for (const [name, command, args] of stages) {
  console.log(`\n[budget gates] ${name}`);
  const result = spawnSync(command, args, { cwd: root, env: process.env, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    console.error(`[budget gates] FAILED: ${name}${result.error ? `: ${result.error.message}` : ""}`);
    process.exitCode = 1;
  } else {
    console.log(`[budget gates] PASSED: ${name}`);
  }
}
