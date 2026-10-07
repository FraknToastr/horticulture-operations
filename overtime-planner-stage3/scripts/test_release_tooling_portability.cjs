'use strict';

// Harness proof only: never executes business suites or changes their assertions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const runnerPath = path.join(__dirname, 'run_all_release_gates.cjs');
const runnerSource = fs.readFileSync(runnerPath, 'utf8');
const core = require('./release_runner_core.cjs');
assert.equal(core.DEFAULT_SUITES.length, 24);
assert.equal(core.DEFAULT_SUITES.filter(suite => suite.stage === 'Stage 1 Retained').length, 17);
assert.equal(core.DEFAULT_SUITES.filter(suite => suite.stage === 'Stage 2 Acceptance').length, 7);
assert.equal(core.validateManifest(core.DEFAULT_SUITES, {
  requiredSuiteContract: core.MANDATORY_SUITE_CONTRACT, scriptsRoot: __dirname
}).valid, true);

const calls = [];
vm.runInNewContext(runnerSource, {
  __dirname,
  console: { log() {}, error() {} },
  process: { execPath: process.execPath, env: { NODE_PATH: '/untrusted/global/modules', HORTOPS_ROOT: '/untrusted/original/source', HORTOPS_REPO_ROOT: '/untrusted/parent', PATH: process.env.PATH },
    stdout: { write() {} }, exit(code) { assert.equal(code, 0); } },
  require(name) {
    if (name === 'child_process') return { spawnSync(executable, args, options) {
      calls.push({ executable, args, options });
      return { status: 0, stdout: '', stderr: '' };
    } };
    if (name === 'path') return path;
    if (name === './release_runner_core.cjs') return core;
    throw new Error('Unexpected runner dependency: ' + name);
  }
}, { filename: runnerPath });
assert.equal(calls.length, 24);
for (const [index, call] of calls.entries()) {
  assert.equal(call.executable, process.execPath);
  assert.equal(call.args.length, 1);
  assert.equal(call.args[0], path.join(__dirname, core.DEFAULT_SUITES[index].script));
  assert.equal(call.options.cwd, root);
  assert.equal(Object.hasOwn(call.options.env, 'NODE_PATH'), false);
  assert.equal(call.options.env.HORTOPS_ROOT, root);
  assert.equal(call.options.env.HORTOPS_REPO_ROOT, root);
  assert.equal(call.options.timeout, core.DEFAULT_SUITES[index].timeout);
}

// Execute the real builder with a confined filesystem facade. Escaped references
// must fail before any outside read or generated-output write is attempted.
const builderPath = path.join(__dirname, 'build_single_file.cjs');
const builderSource = fs.readFileSync(builderPath, 'utf8');
for (const kind of ['css', 'js']) {
  for (const reference of ['../outside.js', '/outside.js', 'https://invalid.example/module.js', '//invalid.example/module.js', 'js/escaped-symlink.js']) {
    const reads = [];
    const writes = [];
    const html = kind === 'css'
      ? `<link rel="stylesheet" href="${reference}">`
      : `<script src="${reference}"></script>`;
    const fakeFs = {
      existsSync() { return true; },
      realpathSync(file) { return file === path.join(root, 'js/escaped-symlink.js') ? '/outside.js' : file; },
      readFileSync(file) {
        reads.push(file);
        assert.equal(file, path.join(root, 'index.modular.html'), 'An escaped input was read');
        return html;
      },
      mkdirSync() { throw new Error('Unexpected output directory mutation'); },
      writeFileSync(file) { writes.push(file); throw new Error('Unexpected generated output write'); },
      statSync() { throw new Error('Unexpected output inspection'); }
    };
    assert.throws(() => vm.runInNewContext(builderSource, {
      __dirname,
      console: { log() {}, error() {} },
      process: { exit() { throw new Error('Unexpected process exit'); } },
      require(name) {
        if (name === 'fs') return fakeFs;
        if (name === 'path') return path;
        throw new Error('Unexpected build dependency: ' + name);
      }
    }, { filename: builderPath }), /Build input.*escapes this planner/);
    assert.deepEqual(reads, [path.join(root, 'index.modular.html')]);
    assert.equal(writes.length, 0);
  }
}
function compileWithoutWriting(source) {
  const outputs = new Map();
  const facade = Object.assign({}, fs, {
    mkdirSync() {},
    writeFileSync(file, content) { outputs.set(file, content); },
    statSync(file) { return outputs.has(file) ? { size: Buffer.byteLength(outputs.get(file)) } : fs.statSync(file); }
  });
  vm.runInNewContext(source, {
    __dirname,
    console: { log() {}, error() {} },
    process: { exit() { throw new Error('Unexpected compiler exit'); } },
    require(name) {
      if (name === 'fs') return facade;
      if (name === 'path') return path;
      throw new Error('Unexpected build dependency: ' + name);
    }
  });
  return outputs;
}
const currentOutput = compileWithoutWriting(builderSource);
assert.equal(currentOutput.size, 2);
assert.equal(currentOutput.get(path.join(root, 'index.html')), currentOutput.get(path.join(root, 'dist/hort_ops_offline_planner.html')));
console.log('RELEASE TOOLING PORTABILITY PASSED: 24 retained suites, isolated execution, 10 escaped build inputs rejected before reads/writes.');
