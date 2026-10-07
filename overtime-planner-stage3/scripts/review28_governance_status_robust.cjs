'use strict';
// Reviewer-authored supplemental check: independent of Markdown bold-marker whitespace.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const roadmap = fs.readFileSync(path.join(root, 'ROADMAP_TEST_ACCEPTANCE_AND_RELEASE_GATES.md'), 'utf8');
const register = fs.readFileSync(path.join(root, 'STAGE1_GOVERNANCE_TRANSITION_REGISTER.md'), 'utf8');
const normalize = s => s.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
const rows = roadmap.split(/\r?\n/).filter(line => /^\|\s*\*\*Gate [CD]\b/.test(line));
const matching = gate => rows.map(line => line.split('|').map(normalize)).filter(cols => cols[1] === gate);
for (const [gate, expected] of [['Gate C', 'ACCEPTED'], ['Gate D', 'ACCEPTED / CLOSED']]) {
 const matches = matching(gate);
 assert.strictEqual(matches.length, 1, gate + ': expected exactly one live ledger row');
 const isMatch = expected.includes('|') ? expected.split('|').some(e => matches[0][2].includes(e)) : matches[0][2] === expected;
 assert(isMatch, gate + ': live ledger status mismatch');
}
const section = (doc, from, to) => {
 const a = doc.indexOf(from), b = doc.indexOf(to, a + from.length);
 assert(a >= 0 && b > a, 'Missing evidence section ' + from);
 return doc.slice(a, b);
};
const gateC = section(roadmap, '### 4.5 Gate C:', '### 4.6 Gate D:');
const gateEvidence = section(register, '### Submitted Gate Evidence: Gate C', '## 6. Stage 1');
for (const [name, s] of [['roadmap current Gate C', gateC], ['register current Gate C evidence', gateEvidence]]) {
 assert(!/AWAITING INDEPENDENT ACCEPTANCE|Awaiting Independent Review 26/i.test(s), name + ' has stale current status');
 assert(/ACCEPTED FOR DEFINED SCOPE/i.test(s), name + ' must describe accepted status');
}
assert(/ST1-GATE-C-023.*Review 27.*VERIFIED CLOSED/m.test(register), 'Register must retain Review 27 verification provenance');
console.log('PASS: Format-tolerant Gate C/D status and Review 27 provenance verified.');
