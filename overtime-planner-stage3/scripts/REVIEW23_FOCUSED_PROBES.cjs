'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
let failures = 0;

function result(name, ok, evidence) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ': ' + JSON.stringify(evidence || {}));
  if (!ok) failures++;
}

function text(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// 1. Deletion/source-hygiene proof.
const forbiddenRoot = ['User_table.csv', 'sample-overtime-source.json'];
const presentRoot = forbiddenRoot.filter(p => fs.existsSync(path.join(root, p)));
result('R23-C1 quarantined development masters absent from final tree', presentRoot.length === 0, { present: presentRoot });

// 2. Production seed fallback scans.
const productionFiles = [
  'js/app.js',
  'js/utils/storage.js',
  'js/utils/storage/migrationEngine.js',
  'js/utils/scheduler/engine.js',
  'js/components/jobEditModal.js',
  'js/components/staffAssignModal.js',
  'js/utils/eligibilityEngine.js'
];
const needles = ['HortOpsData.INITIAL_JOBS', 'HortOpsData.STAFF_ROSTER', 'HortOpsData.HISTORICAL_OCCURRENCES'];
const hits = [];
for (const rel of productionFiles) {
  if (!fs.existsSync(path.join(root, rel))) continue;
  const src = text(rel);
  for (const needle of needles) if (src.includes(needle)) hits.push(rel + ' :: ' + needle);
}
result('R23-C2 no production seed-global fallback reads', hits.length === 0, { hits });

// 3. Standalone compiled assets must not define old seed arrays.
const standalone = ['index.html', 'dist/hort_ops_offline_planner.html'];
const defs = [];
for (const rel of standalone) {
  const src = text(rel);
  for (const needle of ['HortOpsData.INITIAL_JOBS =', 'HortOpsData.STAFF_ROSTER =', 'HortOpsData.HISTORICAL_OCCURRENCES =']) {
    if (src.includes(needle)) defs.push(rel + ' :: ' + needle);
  }
}
result('R23-C3 standalone bundles contain no seed-array definitions', defs.length === 0, { definitions: defs });

// 4. Shared privacy test must not embed a literal personnel blacklist.
const gateCTest = text('scripts/test_gate_c.cjs');
const hasLiteralPersonnelList = gateCTest.includes('const forbiddenPhrases = [');
result('R23-P1 shared Gate C test has no literal personnel-name/email-fragment blacklist', !hasLiteralPersonnelList, { literalBlacklistBlockPresent: hasLiteralPersonnelList });

// 5. Governance package should include current transition register.
result('R23-G1 transition register included in final tree', fs.existsSync(path.join(root, 'STAGE1_GOVERNANCE_TRANSITION_REGISTER.md')), {});

console.log('Focused Review 23 gaps remaining: ' + failures);
process.exitCode = failures ? 1 : 0;
