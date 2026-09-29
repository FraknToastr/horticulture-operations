# Tranche C3 — Walkthrough v5.0.0: Polygon → Job Canonical Rate Mapping (Final Corrected)

## Executive Summary

- **Tranche**: C3 — Polygon → Job Canonical Rate Mapping
- **Status**: **COMPLETE, CONSOLIDATED & FULLY REMEDIATED — AWAITING PEER REVIEW**
- **Governing Principle**: *"One defect, one controlled remediation, one proof, one checkpoint."*
- **Active Remediation Branch**: [`Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation`](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation)
- **Master Root Status**: **100% Untouched & Preserved** (0 files modified outside the branch)
- **Previous Tranche Preservations**:
  - **P0** (test harness backup recovery timing): PRESERVED
  - **C1** (Quote Builder Draft-First Access): PRESERVED
  - **C2** (Quote Issue Prospective Customer Funding): PRESERVED (Verdict: PASSED)
- **Deferred Tranche Exclusions**:
  - **C4** (Resource Calculator line deletion / event synchronisation): **UNTOUCHED (0 changes in `costing.js`)**
  - **C5** (Authoritative Status History / Register legacy controls): **UNTOUCHED (0 changes to status history controls in `register.js`)**

---

## 1. Peer Review 6 Feedback & Remediation Goals

In [`Offline/ChatGPT Reviews/Corrected C3 peer review 6.md`](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/ChatGPT%20Reviews/Corrected%20C3%20peer%20review%206.md), ChatGPT verified:
- **Unknown → Turfing UI conversion**: **PASS** (neutral placeholder, eligibility gating, click guard, dynamic dropdown synchronization).
- **Preservation of unknown value**: **PASS** (geometry retains unmapped work type until explicit user action).
- **C3 Scope Isolation**: **PASS** (production changes strictly confined to `model.js`, `work-area-service.js`, and `program-map.js`; 0 leakage into C4/C5).
- **Deterministic verification**: **43 / 43 PASS** independently reproduced.
- **Source syntax**: **79 / 79 PASS**.
- **Browser evidence**: **32 / 33 PASS** (both C3 browser tests pass).
- **Documentation & provenance history**: **PASS**.

**Single Remaining Correction**:
In `work-area-service.js`, remove the emergency hardcoded fallback `{ turfing: "RATE-TURFING" }` so that `ProgramModel.canonicalWorkTypeRateItems` is the sole, unambiguous authority for canonical work-type rate mappings across the entire application, and provide deterministic proof that `WorkAreaService` consumes that authority dynamically.

---

## 2. Final Surgical Remediation

### 2.1 Complete Elimination of Hardcoded Fallback in `work-area-service.js`
In [`src/program-planner/js/work-area-service.js`](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation/src/program-planner/js/work-area-service.js):
```javascript
// BEFORE:
function canonicalWorkTypeRateItems() {
  if (UOS.ProgramModel && UOS.ProgramModel.canonicalWorkTypeRateItems) {
    return UOS.ProgramModel.canonicalWorkTypeRateItems;
  }
  return Object.freeze({ turfing: "RATE-TURFING" }); // <-- Removed!
}

// AFTER:
function canonicalWorkTypeRateItems() {
  var model = UOS.ProgramModel;
  if (model && model.canonicalWorkTypeRateItems && typeof model.canonicalWorkTypeRateItems === "object") {
    return model.canonicalWorkTypeRateItems;
  }
  return {};
}
```
`work-area-service.js` now contains **zero hardcoded instances** of `"RATE-TURFING"`.
[`src/program-planner/js/model.js`](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation/src/program-planner/js/model.js) is the sole business-rule authority for canonical rate mapping.

### 2.2 UI Protection Against Silent Work-Type Conversion (`program-map.js`)
- `workTypeOptions(current)` prepends `<option value=""' + (!isKnown ? " selected" : "") + '>Select work type…</option>`.
- Shape card header displays `"Select work type…"` when work type is unknown or blank.
- "Create Job" button is disabled when work type is blank/unknown or lacks an active Rate Item mapping, displaying actionable tooltips.
- Click handler early returns and toasts error if `selectedJobWorkType` is empty.
- Dropdown `change` event updates geometry and calls `.then(renderShapeCards)`, instantly enabling the button when a valid type is selected.

---

## 3. Strict Scope & Production Isolation

Comparison against master source (`master/src` vs `branch/src`):
```text
Production files changed: Exactly 6 files across C1 + C2 + C3:
  1. src/program-planner/js/app.js               (C1: Quote shortcut navigation)
  2. src/program-planner/js/register.js          (C1: Register row Quote action)
  3. src/program-planner/js/funding-model.js     (C2: Candidate quote prospective funding)
  4. src/program-planner/js/program-map.js       (C3: Unsafe fallback elimination & UI protection)
  5. src/program-planner/js/work-area-service.js (C3: Canonical default rate mapping consolidation)
  6. src/program-planner/js/model.js             (C3: Sole authoritative canonical reference constant)

Files strictly untouched:
  * src/program-planner/js/costing.js            (0 changes - reserved for C4)
  * src/program-planner/js/register.js           (0 status history changes - reserved for C5)
  * All other production files                    (100% untouched)
```

---

## 4. Verification Evidence

### 4.1 Deterministic Test Suite
Ran all 10 unit test suites across the repository:
```text
data-roundtrip.test.cjs:              1 passed, 0 failed
delete-register-v5.test.cjs:          2 passed, 0 failed
empty-operational-baseline.test.cjs:  4 passed, 0 failed
governed-remediation.test.cjs:       13 passed, 0 failed
location-polygon-sidebar.test.cjs:    4 passed, 0 failed
model-v5.test.cjs:                    6 passed, 0 failed
nsa-pdf-import-preview.test.cjs:      2 passed, 0 failed
sidebar-architecture.test.cjs:        2 passed, 0 failed
status.test.cjs:                      7 passed, 0 failed
workspace-sanitation.test.cjs:        2 passed, 0 failed

TOTAL: 43 passed, 0 failed (100% PASS)
```

#### Deterministic Single-Source Invariant Checks in `tests/governed-remediation.test.cjs`:
1. **Reference Equality**:
   `assert.equal(UOS.WorkAreaService.canonicalWorkTypeRateItems(), UOS.ProgramModel.canonicalWorkTypeRateItems);`
2. **Source Invariant**:
   `assert.doesNotMatch(fs.readFileSync("src/program-planner/js/work-area-service.js", "utf8"), /RATE-TURFING/);`
3. **Dynamic Authority Delegation**:
   Modifying `UOS.ProgramModel.canonicalWorkTypeRateItems` dynamically propagates to `UOS.WorkAreaService.canonicalWorkTypeRateItems()`, proving zero local caching or independent fallback.

### 4.2 Browser E2E Suite (Playwright)
Ran the complete Playwright browser test suite inside Linux WSL:
```text
33 tests across 13 test files:
  32 passed
   1 failed (known pre-existing P0 finding: status-ui.spec.js:15 "drawer.closest is not a function")
```

#### Dedicated C3 Browser Tests (`tests/browser/polygon-job-promotion.spec.js` - 2 / 2 PASS):
1. `PC-005 C3: Turfing polygon on fresh canonical Project resolves RATE-TURFING and promotes to Job & Costing Line`: **PASS**
2. `PC-005 C3: Unknown work type does not silently default to turfing and blocks Create Job until mapped work type selected`: **PASS**

### 4.3 Syntax Verification
Checked all 79 JavaScript / CJS files:
```text
79 / 79 files passed syntax check (0 errors).
```

---

## 5. Peer Review Checkpoint Archive

- **Archive File**: `Offline/Zip files for peer review/Offline-Horticulture-Operations-Suite-v5.0.0-C3-Remediation-Peer-Review.zip`
- **Archive Contents**:
  - Full branch development tree: `src/`, `tests/`, `package.json`, `playwright.config.js`.
  - Complete unbroken review history in `Offline/ChatGPT Reviews/`:
    - `ChatPGT Review 1 - Review of 5.0.0.md`
    - `ChatGPT Peer review 2 — C1 remediation package.md`
    - `C2 peer review 3 — Quote Issue prospective funding.md`
    - `Corrected C2 peer review 3 - Verdict - Passed.md`
    - `Corrected C2 peer review 4 - Verdict - Passed.md`
    - `C3 peer review 5 — Polygon → Job canonical Rate mapping.md`
    - `Corrected C3 peer review 6.md`
    - `Gemini — Revised Staggered Remediation Direction.md`
    - `New branch - Antigravity and ChatGPT Collaboration.md`
    - `Tranche C1 - Walkthrough v5.0.0.md`
    - `Tranche C2 - Walkthrough v5.0.0.md`
    - `Tranche C3 - Walkthrough v5.0.0.md`
- **External Archive Metrics**:
  *(Calculated externally upon package generation)*

---

## 6. Stop Point & Next Authorized Scope

In compliance with the governed remediation protocol:
- **Tranche C3 is STOPPED at this checkpoint.**
- **No C4 implementation work has been started.**
- Awaiting final peer review verdict before commencing:
  **Tranche C4 — Resource Calculator line deletion / workspace event synchronisation**
