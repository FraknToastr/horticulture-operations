'use strict';
// Optional governance-document test: inspect only current-state sections, not archival review records.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(process.argv[2] || '.');
const doc = fs.readFileSync(path.join(root, 'ROADMAP_TEST_ACCEPTANCE_AND_RELEASE_GATES.md'), 'utf8');
let pass=0, fail=0;
function check(name,fn){try{fn();console.log('PASS: '+name);pass++;}catch(e){console.error('FAIL: '+name+' — '+e.message);fail++;}}
const roadmap = doc.split('## 2. End-to-End Multi-Stage Roadmap')[1]?.split('## 3. The Core Architectural Invariants')[0] || '';
const gateD = doc.split('### 4.6 Gate D: Integrated Stage 1 Release Checkpoint')[1]?.split('## 5. Automated Release Gates')[0] || '';
const ledger = doc.split('## 8. Current Truthful Governance Ledger')[1]?.split('## 9. Verification Runbook')[0] || '';
check('current governance ledger acknowledges user-authorised Stage 2',()=>assert(/Stage 2[^\n]*AUTHORISED BY USER/.test(ledger)));
check('current roadmap does not describe Gate D as submitted or awaiting Review 29',()=>assert(!/Gate D[^\n]*(?:Submitted \(PR22\)|Awaiting Independent Review 29)/i.test(roadmap)));
check('current Gate D status does not refer to obsolete Review 29 submission',()=>assert(!/Status:[^\n]*Submitted for Review 29/i.test(gateD)));
console.log('REVIEW33 GOVERNANCE: '+pass+' PASS, '+fail+' FAIL');
process.exit(fail?1:0);
