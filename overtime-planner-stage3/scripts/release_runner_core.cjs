'use strict';

/**
 * release_runner_core.cjs
 *
 * Core manifest, validation and release evaluation logic for Horticulture Operations.
 * Enforces strict fail-closed acceptance criteria across Stage 1 and Stage 2 gates.
 */

const fs = require('fs');
const path = require('path');

// Authoritative mandatory suite descriptor contract (Review 41 R41-03)
// Explicitly binds each mandatory suite ID -> script -> stage -> browser requirement.
const MANDATORY_SUITE_CONTRACT = Object.freeze([
  Object.freeze({ id: 'stage1-gate-b1', script: 'test_gate_b1.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-gate-b2', script: 'test_gate_b2.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-gate-b3', script: 'test_gate_b3.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-gate-c', script: 'test_gate_c.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-restore-canonical', script: 'test_r23_restore_canonical.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-r29-negative-domains', script: 'test_r29_negative_canonical_domains.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-fr02-schedule-validation', script: 'test_fr02_schedule_validation.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-fr03-dst-rest', script: 'test_fr03_dst_rest.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-rg1-static-syntax', script: 'test_static_release.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-rg2-scheduler', script: 'test_scheduler.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-rg3-workforce', script: 'test_workforce.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-rg4-persistence', script: 'test_persistence.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-rg5-rostering-engine', script: 'test_rostering_engine.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-rg6-recovery-ui', script: 'test_recovery_ui.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-rg7-multi-year', script: 'test_multi_year_differential.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-rg8-rostering-lifecycle', script: 'test_rostering_lifecycle.cjs', stage: 'Stage 1 Retained', browser: false }),
  Object.freeze({ id: 'stage1-rg9-browser-smoke', script: 'test_browser_smoke.cjs', stage: 'Stage 1 Retained', browser: true }),
  Object.freeze({ id: 'stage2-workspace-contract', script: 'test_stage2_workspace_contract.cjs', stage: 'Stage 2 Acceptance', browser: false }),
  Object.freeze({ id: 'stage2-review39-recovery-contract', script: 'test_review39_recovery_contract.cjs', stage: 'Stage 2 Acceptance', browser: false }),
  Object.freeze({ id: 'stage2-runner-contract', script: 'test_runner_contract.cjs', stage: 'Stage 2 Acceptance', browser: false }),
  Object.freeze({ id: 'stage2-review40-recovery-restore-contract', script: 'test_review40_recovery_restore_contract.cjs', stage: 'Stage 2 Acceptance', browser: false }),
  Object.freeze({ id: 'stage2-review40-release-runner-contract', script: 'test_review40_release_runner_contract.cjs', stage: 'Stage 2 Acceptance', browser: false }),
  Object.freeze({ id: 'stage2-browser-smoke', script: 'test_stage2_browser_smoke.cjs', stage: 'Stage 2 Acceptance', browser: true }),
  Object.freeze({ id: 'stage2-review39-browser-recovery', script: 'test_review39_browser_recovery.cjs', stage: 'Stage 2 Acceptance', browser: true })
]);

// Authoritative mandatory suite ID literal array
const MANDATORY_SUITE_IDS = Object.freeze([
  'stage1-gate-b1',
  'stage1-gate-b2',
  'stage1-gate-b3',
  'stage1-gate-c',
  'stage1-restore-canonical',
  'stage1-r29-negative-domains',
  'stage1-fr02-schedule-validation',
  'stage1-fr03-dst-rest',
  'stage1-rg1-static-syntax',
  'stage1-rg2-scheduler',
  'stage1-rg3-workforce',
  'stage1-rg4-persistence',
  'stage1-rg5-rostering-engine',
  'stage1-rg6-recovery-ui',
  'stage1-rg7-multi-year',
  'stage1-rg8-rostering-lifecycle',
  'stage1-rg9-browser-smoke',
  'stage2-workspace-contract',
  'stage2-review39-recovery-contract',
  'stage2-runner-contract',
  'stage2-review40-recovery-restore-contract',
  'stage2-review40-release-runner-contract',
  'stage2-browser-smoke',
  'stage2-review39-browser-recovery'
]);

const DEFAULT_SUITES = [
  { id: 'stage1-gate-b1', name: 'Retained Gate B1: Canonical v2 Persistence & Boundary Validation', script: 'test_gate_b1.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 30000 },
  { id: 'stage1-gate-b2', name: 'Retained Gate B2: Authoritative Commitment Lifecycle Acceptance', script: 'test_gate_b2.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 30000 },
  { id: 'stage1-gate-b3', name: 'Retained Gate B3: Transaction Coordinator & Rollback Hardening', script: 'test_gate_b3.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 30000 },
  { id: 'stage1-gate-c', name: 'Retained Gate C: Prototype Seed Isolation & Privacy Clearance', script: 'test_gate_c.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 30000 },
  { id: 'stage1-restore-canonical', name: 'Retained Canonical Restore: Full Envelope Equivalence (R23-B3)', script: 'test_r23_restore_canonical.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 30000 },
  { id: 'stage1-r29-negative-domains', name: 'Review 29: Negative Canonical Domain Matrix & Shift Resilience', script: 'test_r29_negative_canonical_domains.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 30000 },
  { id: 'stage1-fr02-schedule-validation', name: 'FR-02: Strict Gregorian Calendar & Recurrence Interval Validation', script: 'test_fr02_schedule_validation.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 30000 },
  { id: 'stage1-fr03-dst-rest', name: 'FR-03: Adelaide Timezone & DST-Aware 10-hour Physical Rest', script: 'test_fr03_dst_rest.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 30000 },
  { id: 'stage1-rg1-static-syntax', name: 'RG1: Static Syntax & Helper Scope Audit', script: 'test_static_release.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 30000 },
  { id: 'stage1-rg2-scheduler', name: 'RG2: Scheduler Engine Invariants & Recurrence Overrides', script: 'test_scheduler.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 60000 },
  { id: 'stage1-rg3-workforce', name: 'RG3: Workforce Lifecycle & Assignment Integrity', script: 'test_workforce.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 30000 },
  { id: 'stage1-rg4-persistence', name: 'RG4 : Persistence Contract & JSON Schema Validation', script: 'test_persistence.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 60000 },
  { id: 'stage1-rg5-rostering-engine', name: 'RG5: Assisted Rostering Engine & Propagation Invariants', script: 'test_rostering_engine.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 60000 },
  { id: 'stage1-rg6-recovery-ui', name: 'RG6 : Truthful Persistence State & Recovery Warnings', script: 'test_recovery_ui.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 30000 },
  { id: 'stage1-rg7-multi-year', name: 'RG7 : Multi-Year Scheduler & Rostering Differential (2025-2028)', script: 'test_multi_year_differential.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 60000 },
  { id: 'stage1-rg8-rostering-lifecycle', name: 'RG8 : Offline17.5j Rostering Integrity Freeze & Invariants', script: 'test_rostering_lifecycle.cjs', stage: 'Stage 1 Retained', browser: false, timeout: 120000 },
  { id: 'stage1-rg9-browser-smoke', name: 'RG9: Playwright Headless Browser Smoke Suite', script: 'test_browser_smoke.cjs', stage: 'Stage 1 Retained', browser: true, timeout: 120000 },
  { id: 'stage2-workspace-contract', name: 'Stage 2 Node: Workspace Management, Destructive Reset & Storage Hygiene Contract', script: 'test_stage2_workspace_contract.cjs', stage: 'Stage 2 Acceptance', browser: false, timeout: 60000 },
  { id: 'stage2-review39-recovery-contract', name: 'Stage 2 Node: Review 39 Emergency Recovery Architecture Contract', script: 'test_review39_recovery_contract.cjs', stage: 'Stage 2 Acceptance', browser: false, timeout: 60000 },
  { id: 'stage2-runner-contract', name: 'Stage 2 Node: Master Release Runner Self-Test Contract (Review 39 R39-03)', script: 'test_runner_contract.cjs', stage: 'Stage 2 Acceptance', browser: false, timeout: 60000 },
  { id: 'stage2-review40-recovery-restore-contract', name: 'Stage 2 Node: Review 40/41 Recovery Restore Contract', script: 'test_review40_recovery_restore_contract.cjs', stage: 'Stage 2 Acceptance', browser: false, timeout: 60000 },
  { id: 'stage2-review40-release-runner-contract', name: 'Stage 2 Node: Review 40/41 Release Runner Assurance Contract', script: 'test_review40_release_runner_contract.cjs', stage: 'Stage 2 Acceptance', browser: false, timeout: 60000 },
  { id: 'stage2-browser-smoke', name: 'Stage 2 Browser: Workspace Seeding, Reset Verification & Quarantine Smoke', script: 'test_stage2_browser_smoke.cjs', stage: 'Stage 2 Acceptance', browser: true, timeout: 120000 },
  { id: 'stage2-review39-browser-recovery', name: 'Stage 2 Browser: Review 39 Recovery Lifecycle & Cold Reload Smoke', script: 'test_review39_browser_recovery.cjs', stage: 'Stage 2 Acceptance', browser: true, timeout: 180000 }
];


function validateManifest(suites, options) {
  options = options || {};
  const errors = [];

  if (!Array.isArray(suites) || suites.length === 0) {
    return {
      valid: false,
      errors: ['Manifest is empty or not an array']
    };
  }

  const seenIds = new Set();
  const presentIds = new Set();

  for (let i = 0; i < suites.length; i++) {
    const s = suites[i];
    if (!s || typeof s !== 'object') {
      errors.push(`Suite at index ${i} is not an object`);
      continue;
    }

    if (!s.id || typeof s.id !== 'string' || !s.id.trim()) {
      errors.push(`Suite at index ${i} is missing a valid 'id' property`);
    } else {
      if (seenIds.has(s.id)) {
        errors.push(`Duplicate suite ID found: '${s.id}' at index ${i}`);
      }
      seenIds.add(s.id);
      presentIds.add(s.id);
    }

    if (!s.name || typeof s.name !== 'string' || !s.name.trim()) {
      errors.push(`Suite '${s.id || i}' is missing a valid 'name' property`);
    }

    if (!s.script || typeof s.script !== 'string' || !s.script.trim()) {
      errors.push(`Suite '${s.id|| i}' is missing a valid 'script' property`);
    } else if (options.scriptsRoot) {
      const scriptFullPath = path.isAbsolute(s.script)
        ? s.script
        : path.join(options.scriptsRoot, s.script);
      if (!fs.existsSync(scriptFullPath)) {
        errors.push(`Suite '${s.id || i}' script not found on disk: '${s.script}'`);
      } else {
        const stats = fs.statSync(scriptFullPath);
        if (stats.size === 0) {
          errors.push(`Suite '${s.id|| i}' script is empty (zero bytes): '${s.script}'`);
        } else {
          const scriptContent = fs.readFileSync(scriptFullPath, 'utf8');
          if (!scriptContent.trim()) {
            errors.push(`Suite '${s.id || i}' script contains only whitespace: '${s.script}'`);
          }
        }
      }
    }
  }


  // R41-03: Validate descriptor contract if provided or if validating authoritative MANDATORY_SUITE_IDS
  const contract = Array.isArray(options.requiredSuiteContract)
    ? options.requiredSuiteContract
    : (options.requiredSuiteIds === MANDATORY_SUITE_IDS ? MANDATORY_SUITE_CONTRACT : null);

  if (contract) {
    const contractMap = new Map();
    for (const entry of contract) {
      contractMap.set(entry.id, entry);
    }


    // Check every suite matches its contract descriptor
    for (const s of suites) {
      if (!s || !s.id) continue;
      if (!contractMap.has(s.id)) {
        errors.push(`Unknown extra suite ID not in mandatory contract: '${s.id}'`);
      } else {
        const exp = contractMap.get(s.id);
        if (exp.script && s.script !== exp.script) {
          errors.push(`Suite '${s.id}' script '${s.script}' does not match contract descriptor script '${exp.script}'`);
        }
        if (exp.stage && s.stage !== exp.stage) {
          errors.push(`Suite '${s.id}' stage '${s.stage}' does not match contract descriptor stage '${exp.stage}'`);
        }
        if (exp.browser !== undefined && Boolean(s.browser) !== Boolean(exp.browser)) {
          errors.push(`Suite '${s.id}' browser classification '${Boolean(s.browser)}' does not match contract descriptor browser classification '${Boolean(exp.browser)}'`);
        }
      }
    }

    // Check all required contract IDs are present
    for (const entry of contract) {
      if (!presentIds.has(entry.id)) {
        errors.push(`Required mandatory suite ID missing from manifest: '${entry.id}'`);
      }
    }
  } else if (Array.isArray(options.requiredSuiteIds)) {
    const requiredSet = new Set(options.requiredSuiteIds);
    for (const reqId of options.requiredSuiteIds) {
      if (!presentIds.has(reqId)) {
        errors.push(`Required mandatory suite ID missing from manifest: '${reqId}'`);
      }
    }
    for (const pid of presentIds) {
      if (!requiredSet.has(pid)) {
        errors.push(`Unknown extra suite ID not in mandatory contract: '${pid}'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}


function evaluateReleaseOutcome(input) {
  input = input || {};
  const validation = input.manifestValidation;
  const results = input.results;
  const expectedCount = input.expectedSuiteCount;

  if (!validation || !validation.valid) {
    const detail = (validation && Array.isArray(validation.errors))
      ? validation.errors.join('; ')
      : 'Manifest validation rejected or absent';
    return {
      exitCode: 3,
      status: 'MANIFEST_INTEGRITY_ERROR',
      reason: `Release rejected: manifest validation failure: ${detail}`
    };
  }


 if (typeof expectedCount === 'number') {
    const actualCount = Array.isArray(results) ? results.length : 0;
    if (actualCount !== expectedCount) {
      return {
        exitCode: 3,
        status: 'RUNNER_INTEGRITY_ERROR',
        reason: `Release rejected: expected ${expectedCount} executed suites but recorded ${actualCount}`
      };
    }
  }


  if (!Array.isArray(results) || results.length === 0) {
    return {
      exitCode: 3,
      status: 'RUNNER_INTEGRITY_ERROR',
      reason: 'Release rejected: no execution results recorded'
    };
  }

  let failedCount = 0;
  let blockedCount = 0;
  let passedCount = 0;

  for (const r of results) {
    if (r.status === 'FAILED') {
      failedCount++;
    } else if (r.status === 'BLOCKED') {
      blockedCount++;
    } else if (r.status === 'PASSED') {
      passedCount++;
    } else {
      failedCount++;
    }
  }

  if (failedCount > 0) {
    return {
      exitCode: 1,
      status: 'FAILED',
      passedCount,
      failedCount,
      blockedCount,
      totalCount: results.length,
      reason: `${failedCount} mandatory suite(s) failed.`
    };
  }

  if (blockedCount > 0) {
    return {
      exitCode: 2,
      status: 'BLOCKED',
      passedCount,
      failedCount,
      blockedCount,
      totalCount: results.length,
      reason: `${blockedCount} mandatory suite(s) were blocked.`
    };
  }

  return {
    exitCode: 0,
    status: 'PASSED',
    passedCount,
    failedCount: 0,
    blockedCount: 0,
    totalCount: results.length,
    reason: `All ${results.length} mandatory release suites passed cleanly.`
  };
}

module.exports = {
  MANDATORY_SUITE_CONTRACT,
  MANDATORY_SUITE_IDS,
  DEFAULT_SUITES,
  validateManifest,
  evaluateReleaseOutcome
};
