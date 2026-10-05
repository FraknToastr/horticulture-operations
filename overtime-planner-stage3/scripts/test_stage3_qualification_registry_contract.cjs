/**
 * Stage 3 - Gate 3A Verification Contract:
 * Qualification Registry Core & Schema v2 Additive Extensions
 *
 * Verifies:
 * 1. Canonical Municipal Qualification Definitions (9 core accreditations)
 * 2. Date parsing, format enforcement, and Gregorian validity bounds
 * 3. Accreditation lifecycle validation (active, expired, suspended)
 * 4. Staff qualification compliance evaluation (active, missing, expired)
 * 5. Additive Schema v2 backward compatibility (Invariant C2)
 * 6. Schema v2 validation of staff qualifications and job requiredQualifications
 */

const assert = require('assert');
const path = require('path');

// Setup mock window environment for browser/node hybrid modules
if (typeof window === 'undefined') {
  global.window = {};
}

// 1. Load Qualification Engine
require('../js/utils/qualifications.js');
const quals = window.HortOpsQualifications;
assert(quals, 'HortOpsQualifications must be exported to window');

// 2. Load Schema Validator
require('../js/utils/storage/schemaValidator.js');
const validator = window.HortOpsSchemaValidator;
assert(validator, 'HortOpsSchemaValidator must be exported to window');

console.log('=== STAGE 3 GATE 3A VERIFICATION CONTRACT ===\n');

// -------------------------------------------------------------
// Test Group 1: Canonical Municipal Qualification Definitions
// -------------------------------------------------------------
console.log('--- Test Group 1: Canonical Municipal Definitions ---');
const expectedCodes = [
  'CHAINSAW_L1',
  'CHAINSAW_L2',
  'EWP_TICKET',
  'CHIPPER',
  'CHEM_ACUP',
  'CPR',
  'FIRST_AID',
  'HR_LICENSE',
  'MR_LICENSE',
  'TRAFFIC_MGMT',
  'WHITE_CARD'
];

assert.strictEqual(Object.keys(quals.DEFINITIONS).length, 11, 'Must define all 11 canonical qualifications (including CPR & White Card)');

expectedCodes.forEach(code => {
  const def = quals.DEFINITIONS[code];
  assert(def, `Definition for ${code} must exist`);
  assert(def.code === code, `Code mismatch in definition for ${code}`);
  assert(typeof def.name === 'string' && def.name.length > 0, `Name required for ${code}`);
  assert(typeof def.category === 'string', `Category required for ${code}`);
  if (!def.isNonExpiring) {
    assert(typeof def.validityDays === 'number' && def.validityDays > 0, `validityDays must be positive for time-limited ${code}`);
  } else {
    assert.strictEqual(def.isNonExpiring, true, `Non-expiring flag required for ${code}`);
  }
  assert(typeof def.description === 'string', `Description required for ${code}`);
});
console.log('✔ All 9 canonical municipal qualifications correctly registered');

// -------------------------------------------------------------
// Test Group 2: Date & Expiry Mechanics
// -------------------------------------------------------------
console.log('\n--- Test Group 2: Date & Expiry Mechanics ---');
assert.strictEqual(quals.isValidDateString('2026-05-15'), true, 'Valid date string must pass');
assert.strictEqual(quals.isValidDateString('2026-02-29'), false, 'Non-leap year Feb 29 must fail');
assert.strictEqual(quals.isValidDateString('2024-02-29'), true, 'Leap year Feb 29 must pass');
assert.strictEqual(quals.isValidDateString('2026-13-01'), false, 'Month 13 must fail');
assert.strictEqual(quals.isValidDateString('invalid-date'), false, 'Malformed date string must fail');
assert.strictEqual(quals.isValidDateString(''), false, 'Empty date string must fail');

const defaultExp = quals.calculateDefaultExpiry('2026-01-01', 'FIRST_AID'); // 1095 days (3 yrs)
assert(defaultExp.startsWith('2029-'), `Expected 2029 expiry for FIRST_AID, got ${defaultExp}`);

assert.strictEqual(quals.isQualificationExpired('2026-06-01', '2026-06-02'), true, 'Past date must be expired');
assert.strictEqual(quals.isQualificationExpired('2026-06-02', '2026-06-01'), false, 'Future date must not be expired');
assert.strictEqual(quals.isQualificationExpired('2026-06-01', '2026-06-01'), false, 'Exact same date is valid through end of day');
console.log('✔ Date parsing, leap-year checks, and expiry arithmetic pass');

// -------------------------------------------------------------
// Test Group 3: Qualification Object Validator
// -------------------------------------------------------------
console.log('\n--- Test Group 3: Qualification Record Validation ---');
const validRecord = {
  code: 'CHAINSAW_L1',
  issuedDate: '2025-01-01',
  expiryDate: '2027-01-01',
  licenseNumber: 'CS-88912',
  status: 'active'
};
const resValid = quals.validateQualification(validRecord);
assert.strictEqual(resValid.valid, true, 'Valid record must pass validation');

const invalidCodeRecord = { ...validRecord, code: 'ROCKET_LICENSE' };
assert.strictEqual(quals.validateQualification(invalidCodeRecord).valid, false, 'Invalid code must be rejected');

const invertedDateRecord = { ...validRecord, issuedDate: '2027-01-01', expiryDate: '2025-01-01' };
assert.strictEqual(quals.validateQualification(invertedDateRecord).valid, false, 'Expiry before issue must be rejected');

const invalidStatusRecord = { ...validRecord, status: 'revoked_unknown' };
assert.strictEqual(quals.validateQualification(invalidStatusRecord).valid, false, 'Unknown status must be rejected');
console.log('✔ Qualification record validator strictly rejects malformed data');

// -------------------------------------------------------------
// Test Group 4: Staff Qualification Evaluation Engine
// -------------------------------------------------------------
console.log('\n--- Test Group 4: Staff Qualification Evaluation Engine ---');
const mockStaff = {
  id: 'staff-1',
  name: 'Marcus Vance',
  role: 'Team Member',
  qualifications: [
    { code: 'CHAINSAW_L1', issuedDate: '2025-01-01', expiryDate: '2027-01-01', status: 'active' },
    { code: 'FIRST_AID', issuedDate: '2023-01-01', expiryDate: '2026-01-01', status: 'active' }, // Expired on 2026-06-01
    { code: 'TRAFFIC_MGMT', issuedDate: '2025-01-01', expiryDate: '2028-01-01', status: 'suspended' } // Suspended
  ]
};

const evalDate = '2026-06-01';

// Scenario A: Job requiring CHAINSAW_L1 only -> Compliant
const evalA = quals.evaluateStaffQualifications(mockStaff, ['CHAINSAW_L1'], evalDate);
assert.strictEqual(evalA.compliant, true);
assert.strictEqual(evalA.validCodes.length, 1);
assert.strictEqual(evalA.missingCodes.length, 0);
assert.strictEqual(evalA.expiredCodes.length, 0);

// Scenario B: Job requiring FIRST_AID -> Non-compliant (Expired)
const evalB = quals.evaluateStaffQualifications(mockStaff, ['FIRST_AID'], evalDate);
assert.strictEqual(evalB.compliant, false);
assert.strictEqual(evalB.expiredCodes.includes('FIRST_AID'), true);

// Scenario C: Job requiring EWP_TICKET -> Non-compliant (Missing)
const evalC = quals.evaluateStaffQualifications(mockStaff, ['EWP_TICKET'], evalDate);
assert.strictEqual(evalC.compliant, false);
assert.strictEqual(evalC.missingCodes.includes('EWP_TICKET'), true);

// Scenario D: Job requiring TRAFFIC_MGMT -> Non-compliant (Suspended ticket is not active)
const evalD = quals.evaluateStaffQualifications(mockStaff, ['TRAFFIC_MGMT'], evalDate);
assert.strictEqual(evalD.compliant, false);
assert.strictEqual(evalD.expiredCodes.includes('TRAFFIC_MGMT'), true);

// Scenario E: Job requiring none -> Compliant
const evalE = quals.evaluateStaffQualifications(mockStaff, [], evalDate);
assert.strictEqual(evalE.compliant, true);
assert.strictEqual(evalE.totalRequired, 0);

// Scenario F: Undated ticket must be evaluated as non-compliant (R55-P0-02 / S3-P01)
const evalF = quals.evaluateStaffQualifications({
  ...mockStaff,
  qualifications: [{ code: 'CHAINSAW_L1', status: 'active' }]
}, ['CHAINSAW_L1'], evalDate);
assert.strictEqual(evalF.compliant, false, 'Undated qualification must be non-compliant');

// Scenario G: Future-issued ticket must be evaluated as non-compliant (R55-P0-02 / S3-P02)
const evalG = quals.evaluateStaffQualifications({
  ...mockStaff,
  qualifications: [{ code: 'CHAINSAW_L1', issuedDate: '2027-01-01', expiryDate: '2029-01-01', status: 'active' }]
}, ['CHAINSAW_L1'], evalDate);
assert.strictEqual(evalG.compliant, false, 'Future-issued qualification must be non-compliant on 2026 date');

// Scenario H: Non-expiring ticket (White Card) with valid issue date must be compliant
const evalH = quals.evaluateStaffQualifications({
  ...mockStaff,
  qualifications: [{ code: 'WHITE_CARD', issuedDate: '2024-01-01', status: 'active', isNonExpiring: true }]
}, ['WHITE_CARD'], evalDate);
assert.strictEqual(evalH.compliant, true, 'Valid non-expiring ticket must be compliant');

console.log('✔ Staff qualification evaluation correctly categorizes compliant, missing, expired, and suspended tickets');

// -------------------------------------------------------------
// Test Group 5: Schema v2 Additive Backward Compatibility
// -------------------------------------------------------------
console.log('\n--- Test Group 5: Schema v2 Additive Backward Compatibility ---');
const legacyV2Workspace = {
  schemaVersion: 2,
  lastSaved: new Date().toISOString(),
  jobs: [
    {
      id: 'job-leg-1',
      name: 'Legacy Job',
      status: 'active',
      category: 'General',
      frequencyType: 'recurring_weeks',
      intervalWeeks: 2,
      anchorDate: '2026-01-03',
      applicableDays: ['saturday'],
      crewSize: 2,
      durationHours: 4,
      startTime: '07:00'
    }
  ],
  roster: [
    {
      id: 'staff-leg-1',
      name: 'Legacy Staff',
      role: 'Team Member',
      department: 'Horticulture',
      status: 'active',
      standardHoursPerWeek: 38
    }
  ],
  assignments: {},
  overrides: {},
  historicalSnapshots: {},
  auditLog: []
};

const legacyValidation = validator.validateWorkspaceSchema(legacyV2Workspace);
assert.strictEqual(legacyValidation.valid, true, `Legacy Schema v2 envelope without qualifications must validate: ${legacyValidation.error}`);
console.log('✔ Legacy Schema v2 envelope with zero qualification properties validates cleanly (Invariant C2)');

// -------------------------------------------------------------
// Test Group 6: Schema v2 with Valid Qualifications
// -------------------------------------------------------------
console.log('\n--- Test Group 6: Schema v2 with Valid Additive Qualifications ---');
const extendedV2Workspace = JSON.parse(JSON.stringify(legacyV2Workspace));
extendedV2Workspace.roster[0].qualifications = [
  {
    code: 'CHAINSAW_L1',
    issuedDate: '2025-01-01',
    expiryDate: '2027-01-01',
    licenseNumber: 'LIC-12345',
    status: 'active'
  }
];
extendedV2Workspace.jobs[0].requiredQualifications = ['CHAINSAW_L1', 'FIRST_AID'];

const extendedValidation = validator.validateWorkspaceSchema(extendedV2Workspace);
assert.strictEqual(extendedValidation.valid, true, `Extended Schema v2 envelope must validate: ${extendedValidation.error}`);
console.log('✔ Extended Schema v2 envelope with staff qualifications and job requiredQualifications validates cleanly');

// -------------------------------------------------------------
// Test Group 7: Schema v2 Rejection of Corrupt Qualification Data
// -------------------------------------------------------------
console.log('\n--- Test Group 7: Schema v2 Rejection of Corrupt Qualification Data ---');

// Case 1: Unknown qualification code on staff
const corruptStaffCode = JSON.parse(JSON.stringify(extendedV2Workspace));
corruptStaffCode.roster[0].qualifications[0].code = 'UNKNOWN_TICKET';
const corruptRes1 = validator.validateWorkspaceSchema(corruptStaffCode);
assert.strictEqual(corruptRes1.valid, false, 'Unknown staff qualification code must fail validation');

// Case 2: Duplicate qualification codes on same staff member
const duplicateStaffCode = JSON.parse(JSON.stringify(extendedV2Workspace));
duplicateStaffCode.roster[0].qualifications.push({
  code: 'CHAINSAW_L1',
  issuedDate: '2025-02-01',
  expiryDate: '2027-02-01',
  status: 'active'
});
const corruptRes2 = validator.validateWorkspaceSchema(duplicateStaffCode);
assert.strictEqual(corruptRes2.valid, false, 'Duplicate qualification code on one staff member must fail validation');

// Case 3: Unknown required qualification code on job
const corruptJobCode = JSON.parse(JSON.stringify(extendedV2Workspace));
corruptJobCode.jobs[0].requiredQualifications = ['FAKE_TICKET'];
const corruptRes3 = validator.validateWorkspaceSchema(corruptJobCode);
assert.strictEqual(corruptRes3.valid, false, 'Unknown required qualification code on job must fail validation');

// Case 4: Non-array qualifications on staff
const nonArrayStaffQuals = JSON.parse(JSON.stringify(extendedV2Workspace));
nonArrayStaffQuals.roster[0].qualifications = 'CHAINSAW_L1';
const corruptRes4 = validator.validateWorkspaceSchema(nonArrayStaffQuals);
assert.strictEqual(corruptRes4.valid, false, 'Non-array staff qualifications must fail validation');

console.log('✔ All corrupt qualification variations fail-closed with clear error messages');

console.log('\n======================================================');
console.log(' [PASS] GATE 3A CONTRACT VERIFICATION COMPLETE: 100% OK');
console.log('======================================================\n');
