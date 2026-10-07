'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { repoRoot } = require('./local-test-environment.cjs');
const root = repoRoot();
const review64 = process.argv.includes('--review64');
if (process.argv.slice(2).some(arg => arg !== '--review64')) throw new Error('Only --review64 is supported.');
const historical = [
  'review55_adversarial_probes.cjs', 'test_review56_resolved.cjs',
  'review57_independent_regressions.cjs', 'REVIEW58_INDEPENDENT_NEGATIVE_PROBES.cjs',
  'REVIEW59_INDEPENDENT_NEGATIVE_PROBES.cjs', 'REVIEW60_INDEPENDENT_NEGATIVE_PROBES.cjs',
  'REVIEW61_INDEPENDENT_CONCURRENCY_PROBES.cjs', 'REVIEW61_REAL_STORAGE_PROBE.cjs',
  'REVIEW62_CROSS_DOMAIN_NEGATIVE_PROBES.cjs', 'REVIEW63_INDEPENDENT_NEGATIVE_PROBES.cjs'
];
const evidencePrefix = 'scripts/independent-probes/review64/';
const scripts = review64 ? ['R64_CONCURRENT_WRITE_WINDOW.cjs', 'R64_SECURITY_PROBE.cjs'].map(name => evidencePrefix + name) : historical;
const outputDir = path.join(root, 'test_reports', 'phase3-probes');
fs.mkdirSync(outputDir, { recursive: true });
const env = { ...process.env, HORTOPS_ROOT: root, HORTOPS_REPO_ROOT: root, PLAYWRIGHT_BROWSERS_PATH: path.join(root, '.cache', 'ms-playwright') };
delete env.NODE_PATH;
const results = [];
if (review64) console.log('REVIEW 64 VULNERABILITY REPRODUCTION ONLY: successful reproduction leaves findings OPEN.');
for (const relative of scripts) {
  const file = fs.realpathSync(path.join(root, relative));
  if (!file.startsWith(root + path.sep)) throw new Error('Probe must be inside this Overtime folder.');
  const name = path.basename(file, '.cjs');
  const result = spawnSync(process.execPath, [file, root], { cwd: root, env, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  const output = (result.stdout || '') + (result.stderr || '') + (result.error ? '\n' + result.error.message : '');
  fs.writeFileSync(path.join(outputDir, name + '.log'), output);
  process.stdout.write(output);
  results.push({ script: relative, sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), exitCode: result.status, error: result.error ? result.error.message : null, interpretation: review64 ? 'Vulnerability reproduction; inspect raw observations, never release acceptance' : 'Inherited regression/probe observations; inspect original contract' });
  console.log(`[${name}] raw exit ${result.status}`);
}
const report = { recordedAt: new Date().toISOString(), targetRoot: root, mode: review64 ? 'review64-reproduction' : 'review55-63', releaseAccepted: false, results };
fs.writeFileSync(path.join(outputDir, review64 ? 'review64-results.json' : 'review55-63-results.json'), JSON.stringify(report, null, 2) + '\n');
process.exitCode = results.some(result => result.exitCode !== 0 || result.error) ? 1 : 0;
if (review64) console.log('Review 64 reproduction results do not close Stage 3.');
