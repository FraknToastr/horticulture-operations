'use strict';
// Independent, bounded current-status check; historical review chronology is retained.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const roadmap = fs.readFileSync(path.join(root, 'ROADMAP_TEST_ACCEPTANCE_AND_RELEASE_GATES.md'), 'utf8');
const register = fs.readFileSync(path.join(root, 'STAGE1_GOVERNANCE_TRANSITION_REGISTER.md'), 'utf8');
function section(text, start, end) {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, 'Cannot locate section boundary: ' + start);
  return text.slice(a, b);
}
const roadmapGateC = section(roadmap, '### 4.5 Gate C:', '### 4.6 Gate D:');
const currentGateEvidence = section(register, '### Submitted Gate Evidence: Gate C', '## 6. Stage 1');
assert(!/AWAITING INDEPENDENT ACCEPTANCE|Awaiting Independent Review 26/i.test(roadmapGateC), 'Roadmap current Gate C acceptance section contradicts accepted ledger');
assert(!/AWAITING INDEPENDENT ACCEPTANCE|Awaiting Independent Review 26/i.test(currentGateEvidence), 'Register current Gate C evidence section contradicts accepted ledger');
assert(/Gate C \*\*\| \*\*ACCEPTED/.test(roadmap), 'Roadmap ledger must identify Gate C accepted');
assert(/Gate D \*\*\|\s*\*\*(?:AWAITING AUTHORISATION|SUBMITTED|ACCEPTED \/ CLOSED)/.test(roadmap), 'Roadmap must record a recognized, progressed Gate D state');
console.log('PASS: Current Gate C status consistent across detailed evidence and ledger.');
