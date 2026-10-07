'use strict';
// Independent Review 34: current-state editorial checks, excluding dated archival review notes.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(process.argv[2] || '.');
const roadmap = fs.readFileSync(path.join(root, 'ROADMAP_TEST_ACCEPTANCE_AND_RELEASE_GATES.md'), 'utf8');
let pass = 0, fail = 0;
function check(name, fn) { try { fn(); console.log('PASS: ' + name); pass++; } catch (e) { console.error('FAIL: ' + name + ' — ' + e.message); fail++; } }
const diagram = roadmap.split('stateDiagram-v2')[1]?.split('```')[0] || '';
const ledger = roadmap.split('## 8. Current Truthful Governance Ledger')[1]?.split('## 9. Verification Runbook')[0] || '';
check('stage transition diagram does not show Gate D awaiting authorisation', () => {
  assert(!/Gate_C\s*-->\s*Gate_D:[^\n]*Awaiting Authorisation/i.test(diagram));
});
check('Gate C ledger does not claim Gate D is awaiting initiation', () => {
  assert(!/\|\s*\*\*Gate C[^\n]*Gate D awaiting initiation/i.test(ledger));
});
check('ledger acknowledges Stage 2 authorisation', () => {
  assert(/\|\s*\*\*Stage 2\*\*\s*\|\s*\*\*AUTHORISED BY USER\*\*/i.test(ledger));
});
console.log(`REVIEW34: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
