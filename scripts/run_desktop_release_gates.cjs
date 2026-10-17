'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { modelFiles, browserBatches } = require('./desktop-release-plan.cjs');
const root = path.resolve(__dirname, '..');
const available = ['model', ...browserBatches.map(batch => batch.name)];
const requested = [];
let list = false;
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (argument === '--list') list = true;
  else if (argument === '--batch' && available.includes(process.argv[index + 1])) requested.push(process.argv[++index]);
  else {
    console.error(`Unknown/incomplete argument: ${argument}. Use --list or --batch ${available.join('|')}.`);
    process.exit(2);
  }
}
const selected = requested.length ? [...new Set(requested)] : available;
const runModel = selected.includes('model');
const projects = selected.filter(name => name !== 'model');
if (runModel) for (const file of modelFiles) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing desktop model test: ${file}`);
}
function run(args, env = process.env) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
if (runModel) {
  if (list) console.log(JSON.stringify({ batch: 'model', files: modelFiles }, null, 2));
  else run(['--test', ...modelFiles]);
}
if (projects.length) {
  const args = [require.resolve('@playwright/test/cli'), 'test', '--config=playwright.desktop.config.cjs'];
  for (const project of projects) args.push('--project', project);
  if (list) args.push('--list');
  // Optional JSON reporting uses Playwright's standard environment variable.
  if (process.env.PLAYWRIGHT_JSON_OUTPUT_FILE && !list) args.push('--reporter=line,json');
  run(args);
}
