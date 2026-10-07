'use strict';
// Reviewer-authored governance crosscheck. No production modifications.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const briefing = read('00_CHATGPT_FULL_PEER_REVIEW_BRIEFING.md');
const roadmap = read('ROADMAP_TEST_ACCEPTANCE_AND_RELEASE_GATES.md');
const register = read('STAGE1_GOVERNANCE_TRANSITION_REGISTER.md');
assert(/Review 26/.test(roadmap), 'Roadmap must identify current Review 26 submission');
assert(!/AWAITING INDEPENDENT ACCEPTANCE \(Review 25 Evaluation\)/i.test(briefing), 'Briefing still identifies previous review as current acceptance authority');
assert(!/Peer Review 26 \(`STAGE1_GATE_C_INDEPENDENT_PEER_REVIEW_25\.md`\)/.test(register), 'Previous Review 25 is mislabelled Review 26');
assert(!/Gate D is NOT authorised until Review 24 formal acceptance/i.test(register), 'Gate D dependency references superseded Review 24');
console.log('PASS: Current review identification and gate sequencing are consistent');
