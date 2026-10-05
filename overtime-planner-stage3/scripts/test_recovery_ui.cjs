// Truthful Persistence Telemetry Test (Offline17 Mandate Section 28, 57)
const assert = require('assert');

global.window = global;
class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(k) { return this.store[k] !== undefined ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}
global.window.localStorage = new MockLocalStorage();
require('../js/utils/icons.js');
require('../js/utils/securityUtils.js');
require('../js/utils/storage/schemaValidator.js');
require('../js/utils/storage/migrationEngine.js');
require('../js/utils/storage/storageDriver.js');
require('../js/utils/storage.js');
require('../js/utils/warningUtils.js');
require('../js/components/header.js');

console.log('=== RUNNING OFFLINE17 TRUTHFUL PERSISTENCE RECOVERY TEST ===');

// 1. Normal State Test: state.recoveryRequired is false
const normalState = {
  activeView: 'forward_planner',
  currentYear: 2026,
  recoveryRequired: false,
  storageStatus: 'saved',
  allShifts: [],
  slots: [],
  staffList: []
};

const normalHeaderHtml = window.HortOpsHeader.render(normalState);
assert(normalHeaderHtml.includes('Saved'), 'Normal header must show Saved');
assert(normalHeaderHtml.includes('Storage Health: Normal'), 'Normal header must describe normal health');
assert(!normalHeaderHtml.includes('Recovery Required'), 'Normal header must NOT show Recovery Required');

const normalWarnings = window.HortOpsWarningUtils.getWarnings(normalState);
assert(!normalWarnings.some(w => w.id === 'warn-storage-recovery-required'), 'Normal state must have no recovery warning');
console.log('  ✔ Normal persistence state correctly displays Saved / Storage Health Normal.');

// 2. Truthfulness Contract Test: state.recoveryRequired is true
const recoveryState = {
  activeView: 'forward_planner',
  currentYear: 2026,
  recoveryRequired: true,
  recoverySource: 'quarantine_schema_failure',
  storageStatus: 'saved', // deliberately simulate storageStatus left as saved
  allShifts: [],
  slots: [],
  staffList: []
};

const recoveryHeaderHtml = window.HortOpsHeader.render(recoveryState);

// MUST NOT display "Saved" or "Storage Health: Normal"
assert(!recoveryHeaderHtml.includes('>Saved<'), 'Header MUST NOT display Saved when recoveryRequired is true');
assert(!recoveryHeaderHtml.includes('Storage Health: Normal'), 'Header MUST NOT claim Storage Health: Normal when recoveryRequired is true');

// MUST display "Recovery Required"
assert(recoveryHeaderHtml.includes('Recovery Required'), 'Header MUST truthfully display Recovery Required');
assert(recoveryHeaderHtml.includes('quarantine active') || recoveryHeaderHtml.includes('Auto-save is suspended'), 'Header tooltip must explain auto-save suspension');

// Reactive warnings engine MUST register critical persistence warning
const recoveryWarnings = window.HortOpsWarningUtils.getWarnings(recoveryState);
const recoveryAlert = recoveryWarnings.find(w => w.id === 'warn-storage-recovery-required');
assert(recoveryAlert, 'Reactive warnings engine MUST generate Workspace Recovery Required warning');
assert.strictEqual(recoveryAlert.category, 'Persistence');
assert.strictEqual(recoveryAlert.severity, 'high');

console.log('  ✔ Truthfulness contract verified: UI strictly exposes Recovery Required and suppresses normal Saved status.');
console.log('=== TRUTHFUL PERSISTENCE RECOVERY TEST PASSED ===\n');