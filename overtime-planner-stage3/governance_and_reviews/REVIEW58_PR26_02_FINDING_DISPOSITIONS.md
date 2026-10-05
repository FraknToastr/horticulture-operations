# Independent Review 58 Findings & Corrective Action Dispositions (PR26_02)

**Candidate Release:** PR26_02 (Corrective Candidate for Review 58 re-assessment)  
**Governance Scope:** Stage 3 (Workforce Intelligence, Qualifications, Absence Ledger & Fatigue Governance)  
**Date:** 2026-10-04  
**Author:** Principal Municipal Systems Architect (Gemini / Antigravity)  
**Authority Reference:** Owner-authorised Stage 3 active; Stage 4 strictly NOT authorized.  

---

## 1. Executive Summary & Verification Matrix

Independent Peer Review 58 identified four behavioural vulnerabilities across ledger deletion authorization contracts, inline event-handler code interpolation, refusal date validation, and duplicate deduplication ordering, as well as one portability defect in Review 56 test fixtures.

All five findings have been addressed with surgical precision in candidate **PR26_02**. The fixes have been verified via the standalone reviewer regression probe (`REVIEW58_INDEPENDENT_NEGATIVE_PROBES.cjs`: **5/5 PASS**), the Review 57 suite (`review57_independent_regressions.cjs`: **7/7 PASS**), Review 55 adversarial probes (**0 departures**), Review 56 corrected probes (`test_review56_resolved.cjs`: **5/5 PASS**), all Stage 3 acceptance gates (`run_all_stage3_gates.cjs`: **6/6 PASS**), the Stage 3 Playwright browser suite (`test_stage3_browser_smoke.cjs`: **7/7 PASS**), and all 24 permanent master release gates (`run_all_release_gates.cjs`: **24/24 PASS**).

| Finding ID | Severity | Description | Status | Verification Mechanism & Test |
|---|---|---|---|---|
| **R58-P0-01** (Contract A) | **P0** | Whole-ledger deletion silently authorised by ordinary save | **CLOSED** | Blanket `isAuthorisedLedgerMutation: true` bypass eliminated. Per-ledger identity allowlists enforced (`authorisedAbsenceDeletions`, `authorisedRefusalDeletions`). Modal tracks `removedAbsenceIds` and `removedRefusalIds`. Unsolicited whole-ledger or identity drop fails closed. Absence authorization can never authorize refusal drops. Probe `R58-01`, `R58-01b`, `R58-01c` **PASS**. |
| **R58-P1-02** (Contract B) | **P1** | Imported ledger record ID can become executable inline JavaScript | **CLOSED** | Data interpolation into inline HTML `onclick` handlers eliminated. Replaced with safe DOM data attributes (`data-action="edit-absence"`, `data-action="remove-absence"`, etc.) and `data-id` with delegated event listener on modal root. Opaque data attributes cannot execute JS code. Probe `R58-04` **PASS**; Browser smoke Step 6i **PASS**. |
| **R58-P1-03** (Contract C1) | **P1** | Invalid or absent refusal date contributes to historical fair-share | **CLOSED** | `getStaffRefusalCount` strictly enforces `isRealYmd(ref.date)`. Records with missing or malformed dates are excluded from historical fair-share scoring. Canonical `validateRefusalRecord` added to `absences.js`. Probe `R58-02` **PASS**. |
| **R58-P2-04** (Contract C2) | **P2** | Duplicate-refusal deduplication precedes date filtering | **CLOSED** | Deduplication via `seenIds` moved strictly AFTER date and calendar-year filtering. Future-dated duplicates cannot poison `seenIds` or suppress valid in-window duplicates. Both `[future, past]` and `[past, future]` orderings yield count 1. Probe `R58-03` **PASS**. |
| **R58-P1-05** (Contract D) | **P1** | Hardcoded absolute path in Review 56 test harness | **CLOSED** | Portable repository root resolution enforced (`process.env.HORTOPS_ROOT \|\| path.resolve(__dirname)`). Probe `test_review56_resolved.cjs` **PASS** (5/5). |

---

## 2. Detailed Finding-by-Finding Dispositions & Architecture Hardening

### R58-P0-01 (Contract A): Identity-Specific Ledger Deletion & Isolation
- **Location:** `js/app.js` lines 341–425, 1070–1110; `js/components/staffAbsenceModal.js` lines 25–40, 195–210, 285–300, 315–335.
- **Root Cause:** In PR26_01, `saveAbsenceAndRefusalData()` set `isAuthorisedLedgerMutation: true`, which acted as an unconditional blanket bypass in `_commitCanonicalProposal`, approving any dropped record identity across both ledgers even when no deletion IDs were declared.
- **Remediation:**
  1. Completely removed `proposalOverrides.isAuthorisedLedgerMutation === true` from `_commitCanonicalProposal`.
  2. Enforced strict per-ledger deletion allowlists: dropped absence records require matching IDs in `proposalOverrides.authorisedAbsenceDeletions`; dropped refusal records require matching IDs in `proposalOverrides.authorisedRefusalDeletions`. Authorizing absence deletion can never authorize refusal drops, and vice versa.
  3. In `staffAbsenceModal.js`, added persistent tracking sets `this.removedAbsenceIds = new Set()` and `this.removedRefusalIds = new Set()`. Only explicit user Remove actions add IDs to these sets. On modal close/cancel without saving, these sets are discarded.
  4. On modal `save()`, passed `{ deletedAbsenceIds: Array.from(this.removedAbsenceIds), deletedRefusalIds: Array.from(this.removedRefusalIds) }` to `saveAbsenceAndRefusalData()`.
  5. In `saveAbsenceAndRefusalData()`, ordinary invocations with empty ledgers and no options fail closed immediately with evidence loss rejection.
- **Evidence:**
  - `REVIEW58_INDEPENDENT_NEGATIVE_PROBES.cjs`:
    - Probe `R58-01`: `app.saveAbsenceAndRefusalData([], [])` returns `{ success: false }`, committed storage untouched.
    - Probe `R58-01b`: `app.saveAbsenceAndRefusalData([], [], { deletedAbsenceIds: ['A1'] })` returns `{ success: false }` because refusal deletion was not authorized.
    - Probe `R58-01c`: `app.saveAbsenceAndRefusalData([], [{ id: 'R1', ... }], { deletedAbsenceIds: ['A1'] })` succeeds with explicit matching deletion ID.
  - `review57_independent_regressions.cjs`: Probe `R57-P1-02` **PASS**; 7/7 suites green.

### R58-P1-02 (Contract B): Elimination of Inline Executable Event Handlers
- **Location:** `js/components/staffAbsenceModal.js` lines 435–445, 560–570, 645–665.
- **Root Cause:** Edit and Remove buttons interpolated record IDs into inline `onclick="window.HortOpsStaffAbsenceModal.startEditAbsence('...')"` handlers. When browsers parse HTML attributes, character entities (`&#39;`) are unescaped into quotes (`'`) prior to JavaScript execution, enabling imported crafted IDs to escape string literals and execute arbitrary code.
- **Remediation:**
  1. Replaced all inline `onclick` handlers on absence and refusal table rows with HTML5 data attributes:
     - Absence Edit: `<button data-action="edit-absence" data-id="...">`
     - Absence Remove: `<button data-action="remove-absence" data-id="...">`
     - Refusal Edit: `<button data-action="edit-refusal" data-id="...">`
     - Refusal Remove: `<button data-action="remove-refusal" data-id="...">`
  2. Implemented idempotent event delegation on the modal root element (`root.addEventListener('click', ...)`). The handler extracts `e.target.closest('button[data-action]')` and reads `btn.getAttribute('data-id')` purely as an opaque string value.
  3. In the DOM, `getAttribute('data-id')` never undergoes JavaScript evaluation or template expansion, completely immunizing the UI from entity decoding injection, script execution, and prototype pollution.
- **Evidence:**
  - `REVIEW58_INDEPENDENT_NEGATIVE_PROBES.cjs`: Probe `R58-04` **PASS**. Rendered markup contains zero inline `startEditAbsence`/`removeAbsence` onclick attributes; `globalThis.__review58Flag` remains 0.
  - `scripts/test_stage3_browser_smoke.cjs`: Step 6i injects adversarial payload `craft_abs_"';window.__maliciousTestExecuted=1;//`, triggers DOM click, verifies edit and removal track cleanly, and asserts `window.__maliciousTestExecuted === 0` in Chromium headless.

### R58-P1-03 (Contract C1): Dated, Bounded Refusal Fair-Share Scoring
- **Location:** `js/utils/absences.js` lines 15–30, 160–185.
- **Root Cause:** `getStaffRefusalCount` only executed date checks when `typeof ref.date === 'string'`. Records with missing date (`{ id: 'bad', staffId: 'S' }`) bypassed date bounds and inflated fair-share priority.
- **Remediation:**
  1. Refusal date is now mandatory: `if (!ref.date || typeof ref.date !== 'string' || !isRealYmd(ref.date)) continue;`.
  2. Added canonical `validateRefusalRecord(record)` to `absences.js` enforcing valid object, non-empty `id`, non-empty `staffId`, and valid Gregorian `date` (YYYY-MM-DD).
  3. Preexisting undated records are excluded from historical fair-share scoring without mutating or corrupting runtime storage.
- **Evidence:**
  - `REVIEW58_INDEPENDENT_NEGATIVE_PROBES.cjs`: Probe `R58-02` **PASS** (count = 0).

### R58-P2-04 (Contract C2): Safe Deduplication Ordering
- **Location:** `js/utils/absences.js` lines 160–185.
- **Root Cause:** `seenIds.add(ref.id)` occurred before date and calendar-year checks. A future-dated duplicate record poisoned `seenIds`, suppressing a valid earlier historical record.
- **Remediation:**
  1. Reordered deduplication to execute strictly AFTER date validation, `asOfDate` bounds, and calendar-year filtering.
  2. Records outside the operational time window cannot poison the deduplication set for valid in-window records.
  3. Tested both ordering permutations (`[future, past]` and `[past, future]`); both deterministically produce count 1.
- **Evidence:**
  - `REVIEW58_INDEPENDENT_NEGATIVE_PROBES.cjs`: Probe `R58-03` **PASS** (both permutations count = 1).

### R58-P1-05 (Contract D): Test Reproducibility & Portability
- **Location:** `test_review56_resolved.cjs` line 3.
- **Root Cause:** Hardcoded `/home/n0rt/.../Offline2-Overtime-Planner` path caused suite failure when executed from foreign directories or candidate extraction roots.
- **Remediation:** Made repository root resolution portable: `const root = process.env.HORTOPS_ROOT || path.resolve(__dirname);`.
- **Evidence:** `test_review56_resolved.cjs` executed and **PASS** 5/5.

---

## 3. Policy Documentation: Calendar Year vs Financial Year Horizon

Per Review 58 Directive Contract C, the alignment between overtime horizons and fair-share history is formally documented as follows:

1. **Current System Architecture (Calendar Year Alignment):**
   - In accordance with municipal enterprise baseline specifications and `state.budgetSettings.annualTarget` (which configures annual overtime expenditure from January 1 to December 31), the overtime forward planner and fair-share engine currently operate on an **annual Gregorian calendar year horizon** (`YYYY-01-01` through `YYYY-12-31`).
   - Staff YTD overtime hours in `staffList[].ytdOvertimeHours` reflect hours accrued within the active calendar year.
   - Refusal event history in `getStaffRefusalCount()` aligns with this horizon by restricting counted events to `ref.date.slice(0, 4) === asOfDate.slice(0, 4)`.

2. **Australian Financial Year Considerations (July 1 – June 30):**
   - If the System Owner determines that operational overtime quotas must transition to the Australian Financial Year (1 July to 30 June), the calculation rule would require bounding `asOfDate` between `YYYY-07-01` and `(YYYY+1)-06-30`.
   - **Governance Position:** In strict adherence to Stage 3 authority constraints, this architectural baseline preserves the current calendar-year policy without unilateral modification. Any transition to financial-year accounting will be submitted for formal System Owner authorization.

---

## 4. Verification Evidence & Test Run Inventory

| Suite | File | Exit Code | Outcome |
|---|---|---|---|
| Review 58 Independent Probes | `REVIEW58_INDEPENDENT_NEGATIVE_PROBES.cjs` | 0 | **5/5 PASS** (All vulnerabilities closed) |
| Review 57 Independent Regressions | `review57_independent_regressions.cjs` | 0 | **7/7 PASS** |
| Review 55 Adversarial Probes | `review55_adversarial_probes.cjs` | 0 | **0 departures** |
| Review 56 Corrected Probes | `test_review56_resolved.cjs` | 0 | **5/5 PASS** |
| Stage 3 Master Acceptance Gates | `scripts/run_all_stage3_gates.cjs` | 0 | **6/6 PASS** |
| Stage 3 Playwright Browser Smoke | `scripts/test_stage3_browser_smoke.cjs` | 0 | **7/7 PASS** (Chromium headless) |
| Master Release Gates | `scripts/run_all_release_gates.cjs` | 0 | **24/24 PASS** |

Single-File Parity:
- `index.html`: `56afc274ba767355cb288dea9264ea834120356d7ce2f983fc97e86b6544aa15`
- `dist/hort_ops_offline_planner.html`: `56afc274ba767355cb288dea9264ea834120356d7ce2f983fc97e86b6544aa15`
- Parity: **Bit-for-bit identical (100% matched)**

---

## 5. Scope Boundaries & Stop Statement

Stage 3 implementation and corrective hardening are **COMPLETE**.  
Stage 4 is **STRICTLY NOT AUTHORISED** and has not been initiated.  
No further code changes are proposed. Candidate PR26_02 is formally submitted for independent peer review assessment.
