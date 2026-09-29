# Horticulture Operations Suite v5.0.0 — Tranche C1 Walkthrough & Checkpoint Report

**Tranche:** C1 — Quote Builder Draft-First Access  
**Application Version:** 5.0.0  
**Date:** 2026-09-20  
**Status:** **PASS** (Checkpointed & Verified)  
**Governing Principle:** *“One defect, one controlled remediation, one proof, one checkpoint.”*

---

## 1. Controlling Sequence

> **Preserve → Branch → Verify → Baseline → P0 → Prove → Checkpoint → Stop.**

- **Preservation Status**: Preserved master source remains 100% read-only and untouched.
- **Working Branch**: [`Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation`](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation)
- **Current Position**: Tranche C1 is fully implemented, verified across deterministic and browser test suites, packaged for peer review, and halted at the required **Stop Point** prior to Tranche C2.

---

## 2. Checkpoint Status Card

```text
TRANCHE: C1 — Quote Builder Draft-First Access
STATUS: PASS

MASTER SOURCE MODIFIED: NO (100% untouched)
WORKING BRANCH: Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation

PRODUCTION FILES CHANGED:
- src/program-planner/js/app.js
- src/program-planner/js/register.js

TEST FILES CHANGED:
- tests/governed-remediation.test.cjs (+2 regression tests)
- tests/browser/quoted-lifecycle.spec.js (+1 browser spec)

UNIT/GOVERNANCE TEST RESULT:
- 34 / 34 PASS (was 32 / 32 at baseline, +2 new regression tests)

BROWSER TEST RESULT:
- 29 / 30 PASS (was 28 / 29 at P0 baseline, +1 new browser test passed)
- 1 known pre-existing P0 deferred finding remains (drawer.closest in status-ui.spec.js)

MANUAL/BROWSER ACCEPTANCE RESULT:
- PASS: Created Project with 0 Jobs and 0 Costing Lines.
  Row mini-toolbar shortcut and drawer action enabled.
  Navigated to Quote Builder. Draft Quote saved.
  Quote Issue blocked strictly under PC-013.

PEER REVIEW PACKAGE:
- Offline/Zip files for peer review/Offline-Horticulture-Operations-Suite-v5.0.0-C1-Remediation-Peer-Review.zip
- SHA256: ff9e84c20549cc0931e512b1901772c322111c0da6da6ecc5d4c91cb0e6e5c6e

REGRESSIONS FOUND: None
DEFERRED FINDINGS: 
- drawer.closest is not a function (status-ui.spec.js:9) [Unchanged from P0]

SAFE TO PROCEED TO NEXT TRANCHE (C2): YES (Awaiting user authorization)
```

---

## 3. Defect Analysis & Remediation Scope

### 3.1 Problem Statement (F-01)
The underlying Quote model and business rules explicitly support creating and saving a Draft Quote for a valid Project before any Jobs or Costing Lines exist. However, the application navigation layer prematurely disabled Quote Builder access via `hasCostedJobs` checks across `app.js` and `register.js`.

### 3.2 Contract Affected
- **Draft-First Quote Contract / PC-013**:
  - Entering Quote Builder and creating/saving a Draft Quote requires only a valid Project.
  - Jobs and Costing Lines must **not** be prerequisites to entering Quote Builder or saving a Draft Quote.
  - Quote Issue readiness remains strictly governed by PC-013 (readiness check must fail and block Issue when scope or funding requirements are not met).

### 3.3 Strict Boundaries Maintained
- **Master source root**: Master remains 100% read-only.
- **`funding-model.js`**: Untouched; reserved for Tranche C2 (*prospective customer funding*).
- **`quote-model.js` readiness**: Untouched; PC-013 Quote Issue gating remains strictly active.
- **`program-map.js`**: Untouched; reserved for Tranche C3 (*turfing rate mapping*).
- **`costing.js`**: Untouched; reserved for Tranche C4 (*event sync & line deletion*).
- **No styling redesign or opportunistic refactoring**.

---

## 4. Exact Source Changes

### 4.1 `src/program-planner/js/app.js`
In `evaluateShortcutRule`, removed the check requiring `hasCostedJobs` for the `quotes` module action:
```diff
    } else if (actionKey === "quotes") {
      if (isCurrent) {
        tooltip = "Currently in Quote Builder";
      } else if (!hasProject) {
        isDisabled = true;
        tooltip = "Create a linked delivery project first to open in Quote Builder";
-     } else if (!hasCostedJobs) {
-       isDisabled = true;
-       tooltip = "Add jobs to the Cost Calculator before opening in Quote Builder";
      } else {
        isLinked = true;
        tooltip = "Create or open Quote in Quote Builder";
      }
      ariaLabel = tooltip;
    }
```

### 4.2 `src/program-planner/js/register.js`
Updated `actionLinkState`, `buildMiniToolbarHtml`, and the NSA drawer application action so that a valid linked Project is sufficient:
```diff
  function actionLinkState(token, hasProject, hasMap, hasJobs, hasCosted) {
    if (token.key === "planner") return hasProject;
    if (token.key === "costing") return hasProject && hasJobs;
    if (token.key === "map") return hasMap;
    if (token.key === "scheduler") return hasJobs;
-   if (token.key === "quotes") return hasProject && hasCosted;
+   if (token.key === "quotes") return hasProject;
    return false;
  }
```
```diff
      if ((tok.key === "planner" || tok.key === "quotes") && !hasProject) {
        isDisabled = true;
        tooltip = tok.key === "quotes"
          ? "Create a linked delivery project first to open in Quote Builder"
          : "Create a linked project first to open in Project Planner";
        ariaLabel = tooltip;
-     } else if (tok.key === "quotes" && !hasCosted) {
-       isDisabled = true;
-       tooltip = "Add jobs to the Cost Calculator before opening in Quote Builder";
-       ariaLabel = tooltip;
      } else if (tok.key === "scheduler" && !hasJobs) {
```
```diff
      '<button type="button" class="register-cta-btn" data-register-action="costing" data-register-record="' + esc(record.id) + '"' + (!linkedProject ? ' disabled aria-disabled="true"' : '') + '>Go to Cost Calculator <span aria-hidden="true">→</span></button>' +
-     '<button type="button" class="register-cta-btn" data-register-action="quotes" data-register-record="' + esc(record.id) + '"' + (!linkedProject || !hasCostedJobs(record, state.workspace) ? ' disabled aria-disabled="true"' : '') + '>Open in Quote Builder <span aria-hidden="true">→</span></button>';
+     '<button type="button" class="register-cta-btn" data-register-action="quotes" data-register-record="' + esc(record.id) + '"' + (!linkedProject ? ' disabled aria-disabled="true"' : '') + '>Open in Quote Builder <span aria-hidden="true">→</span></button>';
```

---

## 5. Automated Regression Test Coverage

### 5.1 Deterministic Tests ([`tests/governed-remediation.test.cjs`](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation/tests/governed-remediation.test.cjs))
Added two comprehensive tests:
1. `PC-013 Draft-first Quote contract allows creating and saving Draft without Jobs or Costing Lines, but blocks Issue`:
   - Validates that when a Project exists with 0 Jobs and 0 Costing Lines, `saveDraft` creates a valid Draft quote ($0 subtotal, $0 grand total).
   - Validates that `evaluateReadiness` fails with `SCOPE_MISSING` and calling `issue()` throws an error.
2. `PC-013 navigation rules allow Quote Builder entry when Project exists with 0 Jobs`:
   - Validates that `evaluateShortcutRule("quotes", { hasProject: true, hasJobs: false, hasCostedJobs: false })` returns `isDisabled: false` and `isLinked: true`.
   - Validates that when `hasProject: false`, `isDisabled: true`.

**Result:** `34 / 34 tests PASS` (100%).

### 5.2 End-to-End Playwright Spec ([`tests/browser/quoted-lifecycle.spec.js`](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation/tests/browser/quoted-lifecycle.spec.js))
Added end-to-end browser regression test:
- `PC-013 Draft-first Quote Builder access allows navigating from Project with 0 Jobs, saving Draft Quote, and blocking Issue`:
  - Registers a record, promotes it to a Delivery Project with 0 Jobs and 0 Costing Lines.
  - Returns to Register and verifies row shortcut `button[data-register-action="quotes"]` is visible and not disabled.
  - Clicks shortcut to navigate into Quote Builder.
  - Clicks Save Draft button (`[data-quote-save]`).
  - Verifies Draft quote is durably saved in workspace.
  - Verifies `evaluateReadiness` reports `ready: false` and issuing throws an error.

**Result:** `29 / 30 tests PASS` (only the single known pre-existing P0 deferred finding `status-ui.spec.js` remains).

---

## 6. Peer Review Package

Packaged cleanly into [`Offline/Zip files for peer review/`](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/Zip%20files%20for%20peer%20review):
- **ZIP File**: `Offline-Horticulture-Operations-Suite-v5.0.0-C1-Remediation-Peer-Review.zip` (4,155,649 bytes)
- **SHA256**: `ff9e84c20549cc0931e512b1901772c322111c0da6da6ecc5d4c91cb0e6e5c6e`

---

## 7. Stop Point & Next Steps

In adherence to the controlling sequence, execution stops here.
- **Tranche C1 is Complete & Closed**.
- Awaiting user authorization before commencing **Tranche C2 — Quote Issue Prospective Customer Funding**.
