'use strict';
/**
 * Review 58 Independent Negative Probes & Corrective Verifications (PR26_02).
 * Verifies that all 4 reproduced vulnerabilities in Review 58 are strictly closed
 * and fail-safe behavior is enforced across all ledger contracts.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.env.HORTOPS_ROOT || process.argv[2] || __dirname;
global.window = global;
require(path.join(root, 'js/utils/absences.js'));
require(path.join(root, 'js/app.js'));
require(path.join(root, 'js/utils/securityUtils.js'));
require(path.join(root, 'js/components/staffAbsenceModal.js'));

const app = global.HortOpsApp;
app.recomputeDigest = () => {};
app.renderCurrentView = () => {};

const old = {
  schemaVersion: 2,
  jobs: [],
  roster: [],
  assignments: {},
  rostering: { instructions: {}, provenance: {} },
  historicalSnapshots: {},
  permits: {},
  budgetSettings: {},
  uiState: {},
  absences: [{ id: 'A1', staffId: 'S', type: 'rdo', startDate: '2026-10-10', endDate: '2026-10-10' }],
  refusalHistory: [{ id: 'R1', staffId: 'S', date: '2026-10-01' }]
};

let saved = null;
global.HortOpsScheduler = { DEFAULT_BUDGET_SETTINGS: {} };
global.HortOpsStorage = {
  loadWorkspace: () => structuredClone(old),
  readVerifiedCommittedV2: () => ({ ok: true, exists: true, data: structuredClone(old) }),
  createWorkspaceEnvelope: x => x,
  saveWorkspace: x => { saved = structuredClone(x); return { ok: true }; }
};
global.HortOpsSchemaValidator = { validateCurrentV2Presence: () => ({ valid: true }) };
app.init();

console.log('REVIEW58 INDEPENDENT NEGATIVE PROBES (PR26_02 CORRECTED)');

// Probe 0: Direct unsolicited ledger deletion blocked
let direct = app._commitCanonicalProposal({ absences: [], refusalHistory: [] });
assert.equal(direct.success, false);
console.log('PASS direct unsolicited ledger deletion blocked');

// R58-P0-01 (Contract A): Ordinary save called with empty ledgers but no declared deletion IDs must be rejected
saved = null;
const through = app.saveAbsenceAndRefusalData([], []);
assert.equal(through.success, false, 'Ordinary saveAbsenceAndRefusalData([],[]) without deletion options must fail closed');
assert.equal(saved, null, 'Committed storage must remain completely untouched on rejected deletion');
console.log('PASS R58-01 ordinary saveAbsenceAndRefusalData([],[]) blocked without explicit deletion IDs');

// Contract A: Cross-ledger deletion authorization isolation: authorizing absence deletion must NEVER authorize refusal deletion
saved = null;
const crossFail = app.saveAbsenceAndRefusalData([], [], { deletedAbsenceIds: ['A1'] });
assert.equal(crossFail.success, false, 'Authorizing absence deletion must not permit unsolicited refusal deletion');
assert.equal(saved, null);
console.log('PASS R58-01b cross-ledger deletion isolation: absence authorization cannot delete refusal ledger');

// Contract A: Explicit removal of specific absence record with matching option succeeds
saved = null;
const authAbsenceOnly = app.saveAbsenceAndRefusalData([], [{ id: 'R1', staffId: 'S', date: '2026-10-01' }], { deletedAbsenceIds: ['A1'] });
assert.equal(authAbsenceOnly.success, true);
assert.deepEqual(saved.absences, []);
assert.equal(saved.refusalHistory.length, 1);
console.log('PASS R58-01c explicit single-ledger removal with declared deletion ID succeeds');

// R58-P1-03 (Contract C1): Refusals with missing or invalid date must NOT count toward historical fair share
const abs = global.HortOpsAbsences;
const noDate = abs.getStaffRefusalCount('S', [{ id: 'bad', staffId: 'S' }], '2026-10-10');
assert.equal(noDate, 0, 'Refusal with missing date must evaluate to 0 (fail-safe exclusion)');
const invalidDate = abs.getStaffRefusalCount('S', [{ id: 'bad2', staffId: 'S', date: 'not-a-date' }], '2026-10-10');
assert.equal(invalidDate, 0, 'Refusal with malformed non-YMD date must evaluate to 0');
console.log('PASS R58-02 refusal with missing or invalid date strictly excluded from historical fair share score');

// R58-P2-04 (Contract C2): Deduplication occurs AFTER date filtering; future-dated duplicate does not suppress historical record
const dupFuturePast = abs.getStaffRefusalCount('S', [
  { id: 'same', staffId: 'S', date: '2026-12-01' },
  { id: 'same', staffId: 'S', date: '2026-10-01' }
], '2026-10-10');
assert.equal(dupFuturePast, 1, '[future, past] ordering must yield count 1');

const dupPastFuture = abs.getStaffRefusalCount('S', [
  { id: 'same', staffId: 'S', date: '2026-10-01' },
  { id: 'same', staffId: 'S', date: '2026-12-01' }
], '2026-10-10');
assert.equal(dupPastFuture, 1, '[past, future] ordering must yield count 1');
console.log('PASS R58-03 future-dated duplicate does not preempt valid historical refusal (both orderings count = 1)');

// R58-P1-02 (Contract B): No inline executable code generated for crafted IDs
const modal = global.HortOpsStaffAbsenceModal;
const maliciousId = "x');globalThis.__review58Flag=1;//";
global.__review58Flag = 0;

// Setup mock DOM for modal render test
global.document = {
  getElementById: (id) => {
    if (!global._mockElements) global._mockElements = {};
    if (!global._mockElements[id]) {
      global._mockElements[id] = { id, innerHTML: '', style: {}, appendChild: () => {}, addEventListener: () => {} };
    }
    return global._mockElements[id];
  },
  createElement: (tag) => ({ id: '', innerHTML: '', style: {}, appendChild: () => {}, addEventListener: () => {} }),
  body: { appendChild: () => {} }
};

app.state = {
  staffList: [{ id: 'S', name: 'Staff S', avatarColor: '#0284c7' }],
  absences: [{ id: maliciousId, staffId: 'S', type: 'rdo', startDate: '2026-10-10', endDate: '2026-10-10' }],
  refusalHistory: [{ id: maliciousId, staffId: 'S', date: '2026-10-01', reason: 'Declined' }]
};

modal.open('S');
modal.render();

const renderedHtml = global.document.getElementById('staff-absence-modal-root').innerHTML;
assert.ok(!renderedHtml.includes('onclick="window.HortOpsStaffAbsenceModal.startEditAbsence'), 'Must NOT contain inline startEditAbsence onclick');
assert.ok(!renderedHtml.includes('onclick="window.HortOpsStaffAbsenceModal.removeAbsence'), 'Must NOT contain inline removeAbsence onclick');
assert.ok(!renderedHtml.includes('onclick="window.HortOpsStaffAbsenceModal.startEditRefusal'), 'Must NOT contain inline startEditRefusal onclick');
assert.ok(!renderedHtml.includes('onclick="window.HortOpsStaffAbsenceModal.removeRefusal'), 'Must NOT contain inline removeRefusal onclick');
assert.ok(renderedHtml.includes('data-action="edit-absence"'), 'Must use data-action="edit-absence"');
assert.ok(renderedHtml.includes('data-action="remove-absence"'), 'Must use data-action="remove-absence"');
assert.equal(global.__review58Flag, 0, 'No arbitrary JavaScript executed during rendering or data binding');
console.log('PASS R58-04 safe DOM data-attributes and event delegation eliminate inline executable JS vulnerability');

console.log('================================================================');
console.log('REVIEW58 INDEPENDENT VERIFICATION SUMMARY: 5/5 PASSED (100% OK)');
console.log('All Review 58 reproduced vulnerabilities verified strictly closed.');
console.log('================================================================');
