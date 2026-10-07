# Release Candidate Hardening & Modal Scroll Correction Walkthrough (Pass 8)

## 1. Agreement / Refutation Summary

| Review Finding / Mandate Requirement | Position | Action & Architectural Implementation |
| :--- | :--- | :--- |
| **Universal Active-Only Schedulability** | **Agreed** | Updated `resolveExplicitOccurrenceLifecycle()` in `scheduler.js` so future explicit occurrences schedule **only** when `(parentJob.status \|\| '').toLowerCase() === 'active'`. Parent statuses such as `inactive`, `draft`, `archived`, `resolved`, `banana` suppress future scheduling. Suppressed future explicit occurrences with missing parent jobs report structured anomaly `code: 'MISSING_PARENT_JOB'` (`severity: 'error'`). Past explicit occurrences preserved as historical actuals. |
| **Workspace Schema Version 2 Upgrade** | **Agreed** | Upgraded `WORKSPACE_SCHEMA_VERSION = 2` (`hort_ops_workspace_v2`) in `storage.js`. Added `migrateWorkspaceV1toV2()` with automatic canonical migration. Rejects missing `job.status` or `staff.status` in v2 imports/persisted records. Added pre-adoption schema validation in `loadWorkspace()`, rejecting malformed or unsafe persisted data prior to adoption. |
| **Modal Background Scroll Lock & Containment** | **Agreed** | Created centralized `HortOpsModalUtils` in `js/utils/modalUtils.js` with reference-counted locking (`activeModals`) and exact `window.scrollTo` restoration. Updated CSS with `.modal-scroll-locked` on `body` (avoiding root viewport clamp), `.modal-form` flex column chain, rigid header/footer (`flex: 0 0 auto`), and scrollable `.modal-body` (`flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain`). Standardized across all 5 modals. |
| **Job Registry Modal Scroll Reproduction** | **Agreed** | Automated the exact reproduction test in Playwright (`test_browser_smoke.cjs`): scrolled background to 150px, opened slideout drawer, clicked Edit Job Specifications, verified internal modal body scrolling under mouse wheel, verified boundary chaining containment, header/footer wheel inertness, and verified that closing the modal preserves the drawer and restores `window.scrollY === initialWindowY`. |
| **Packaging & Deliverable Deliverable** | **Agreed** | Packaged deliverable as **`Offline8.zip`** (37 items, 136,713 bytes), strictly excluding all `.png` files and all nested `.zip` archives. Verified archive integrity with `unzip -t`. |

---

## 2. Universal Active-Only Schedulability Verification

In `Offline/js/utils/scheduler.js`:
- In `resolveExplicitOccurrenceLifecycle(occ, parentJob, nowStr)`:
  - If `occ.date < nowStr`: resolves to `{ shouldSchedule: true, status: 'past_actual', ... }`.
  - If `occ.date >= nowStr`:
    - If no `parentJob`: resolves to `{ shouldSchedule: false, status: 'orphaned_future', code: 'MISSING_PARENT_JOB', severity: 'error', reason: 'Explicit occurrence references non-existent parent job' }`.
    - If `(parentJob.status || '').toLowerCase() === 'active'`: resolves to `{ shouldSchedule: true, status: 'active_future' }`.
    - If non-active parent (`inactive`, `draft`, `archived`, `resolved`, `banana`): resolves to `{ shouldSchedule: false, status: 'inactive_parent', ... }`.

### Scheduler Schedulability Audit Output:
```text
--- JOB STATUS SCHEDULABILITY AUDIT ---
active occurrences:   26
inactive occurrences: 0
draft occurrences:    0
archived occurrences: 0
resolved occurrences: 0
banana occurrences:   0
---------------------------------------
[PASS] Job status schedulability positive allow-list verified.
[PASS] Universal active-only explicit occurrence schedulability verified across all parent statuses.
```

---

## 3. Workspace Schema Version 2 Upgrade & Pre-Adoption Validation

In `Offline/js/utils/storage.js`:
- `WORKSPACE_SCHEMA_VERSION = 2` (`STORAGE_KEYS.WORKSPACE_V2 = 'hort_ops_workspace_v2'`).
- `migrateWorkspaceV1toV2(v1Data)`:
  - Backfills missing `job.status` with `'active'`.
  - Backfills missing `staff.status` with `'active'`.
  - Stamps `schemaVersion: 2` and returns validated v2 workspace.
- `loadWorkspace()`:
  - Validates persisted v2 schema before adoption.
  - Rejects missing statuses, invalid IDs, or malformed data, gracefully falling back to canonical defaults without application crashes.
  - Automatically migrates legacy v1 storage if found.

### Persistence Gate Output:
```text
[PASS] Schema v2 rejects job with missing status.
[PASS] Schema v2 rejects staff member with missing status.
[PASS] Legacy v1 persisted workspace migrated to v2 with explicit statuses and validated.
[PASS] Malformed persisted workspace with unsafe ID rejected before adoption.
ALL PERSISTENCE REGRESSION TESTS PASSED (100%)
```

---

## 4. Modal Scroll Isolation & Layout Contract

### 4.1 Centralized Manager (`js/utils/modalUtils.js`)
- Reference counter `activeModals` tracks active modals.
- Records initial scroll offset via `window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop`.
- Locks `document.body.classList.add('modal-scroll-locked')`.
- Upon final modal close (`activeModals === 0`), removes `modal-scroll-locked` and restores exact position via `window.scrollTo(0, savedScrollY)`.

### 4.2 Modal Flex Hierarchy (`css/style.css`)
```css
body.modal-scroll-locked {
  overflow: hidden !important;
  overscroll-behavior: none !important;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  overflow: hidden;
  overscroll-behavior: contain;
}

.modal-card {
  width: 100%;
  max-height: calc(100vh - 2rem);
  max-height: calc(100dvh - 2rem);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.modal-form {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.modal-header,
.modal-footer {
  flex: 0 0 auto;
}

.modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
```

### 4.3 Standardized Modals (5/5)
1. **Job Edit / Add Modal** (`js/components/jobEditModal.js`): Uses `<form class="modal-form">`, rigid header/footer, scrollable body, single-point scroll locking on `open()` and `close()`.
2. **Crew Allocator Modal** (`js/components/staffAssignModal.js`): Rigid header/footer, scrollable body, single-point scroll locking on `open()` and `close()`.
3. **Import Modal** (`js/components/importModal.js`): Rigid header/footer, scrollable body, single-point scroll locking on `open()` and `close()`.
4. **Export Modal** (`js/components/exportModal.js`): Rigid header/footer, scrollable body, single-point scroll locking on `open()` and `close()`.
5. **Overtime Exemption Modal** (`js/components/staffExemptionModal.js`): Standardized with `.modal-header`, `.modal-body`, `.modal-footer`, rigid header/footer, scrollable body, single-point scroll locking on `open()` and `close()`.

---

## 5. Playwright Browser Smoke Test Evidence

### 5.1 Job Registry Reproduction & Containment Test (Step 6)
1. Scrolled background page to non-zero offset: `150px`.
2. Opened slide-out drawer on first row of Job Registry.
3. Clicked "Edit Job Specifications" button inside drawer.
4. Verified `body` has `modal-scroll-locked`.
5. Dispatched mouse wheel (400px down) over modal body:
   - Initial modal body `scrollTop`: `0px` -> After wheel: `334px` (modal scrolls internally).
   - Window `scrollY` before wheel: `150px` -> After wheel: `150px` (zero leakage).
6. **Boundary Chaining Containment**:
   - Scrolled modal body to bottom (`scrollTop = scrollHeight`), wheeled down 300px: `window.scrollY === 150px`.
   - Scrolled modal body to top (`scrollTop = 0`), wheeled up 300px: `window.scrollY === 150px`.
7. **Header & Footer Wheel Inertness**:
   - Wheeled over modal header: `window.scrollY === 150px`.
   - Wheeled over modal footer: `window.scrollY === 150px`.
8. **Modal Close & Background Restoration**:
   - Clicked Cancel button.
   - `window.scrollY` restored exactly: `150px`.
   - `modal-scroll-locked` class removed from `body`.
   - Slideout drawer remained open in Job Registry.
9. **Modal Containment Across All 5 Modals (Section 32)**:
   - Crew Allocator: verified inertness & exact scroll restoration (`150px`).
   - Import Modal: verified inertness & exact scroll restoration (`150px`).
   - Export Modal: verified inertness & exact scroll restoration (`150px`).
   - Overtime Exemption Modal: verified inertness & exact scroll restoration (`150px`).
10. **Short Viewport Test (Section 33)**:
   - Viewport set to `{ width: 1200, height: 520 }`.
   - Header top >= 0 (`shortHeaderBox.top >= 0`).
   - Footer bottom <= 520 (`shortFooterBox.bottom <= 520`).
   - Modal body scrolled to bottom (`scrollTop > 0`).

```text
=== Step 6: Testing Modal Scroll Isolation, Chaining Containment & Scroll Restoration ===
[PASS] Background scrolled to non-zero offset: 150px
[PASS] Job Edit modal body scrolls internally without background leakage.
[PASS] Scroll chaining containment verified at top and bottom boundaries.
[PASS] Wheel over modal header and footer verified inert.
[PASS] Modal close restored exact background scroll position and preserved drawer.
[PASS] Crew Allocator modal containment, inertness, and scroll restoration verified.
[PASS] Import modal containment, inertness, and scroll restoration verified.
[PASS] Export modal containment, inertness, and scroll restoration verified.
[PASS] Overtime Exemption modal containment, inertness, and scroll restoration verified.
[PASS] Short viewport (520px height) internal scrolling and header/footer accessibility verified.
[PASS] Truthful header storage health pill verified.
Browser console errors logged: 0
Browser unhandled page errors: 0
BROWSER SMOKE TESTS PASSED (100%)
```

---

## 6. Release Gates Execution Summary (`npm test`)

```text
================================================================
 FINAL RELEASE GATES AUDIT SUMMARY:
================================================================
 ✓ [PASSED] Static Syntax & Helper Scope Audit                 (0.46s)
 ✓ [PASSED] Scheduler Engine Invariants & Overrides            (0.12s)
 ✓ [PASSED] Workforce Lifecycle & Assignment Integrity         (0.04s)
 ✓ [PASSED] Persistence Contract & JSON Schema Validation      (0.04s)
 ✓ [PASSED] Playwright Headless Browser Smoke Suite            (18.61s)
OVERALL SCORE: 5/5 SUITES PASSED (100% COMPLIANT)
ZERO BROWSER CONSOLE ERRORS. ZERO UNCAUGHT EXCEPTIONS.
================================================================
```

---

## 7. Deliverable Archive Confirmation (`Offline8.zip`)

- **File Path**: `/home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline/Offline8.zip`
- **File Size**: `136,713 bytes`
- **Item Count**: `37 items`
- **Excluded Content**: **Strictly 0 `.png` files and 0 nested `.zip` archives.**
- **Integrity Check**: `unzip -t Offline8.zip` returned `No errors detected in compressed data of Offline8.zip.`

---

## 8. Final 2026 Core Invariants

| Invariant | Expected | Actual Result | Status |
| :--- | :--- | :--- | :--- |
| **2026 Schedule Rows** | 93 | **93** | **PASSED** |
| **2026 Unique Shift IDs** | 93 | **93** | **PASSED** |
| **2026 Duplicate Shift IDs** | 0 | **0** | **PASSED** |
| **2026 Total Cost** | ~$269,672.80 | **$269,672.80** | **PASSED** |
| **Job Status Allow-List** | Active-only (26) | **26 active, 0 non-active** | **PASSED** |
| **Release Gate Suites** | 5/5 Passed | **5/5 Passed (100%)** | **PASSED** |
| **Browser Console Errors** | 0 | **0** | **PASSED** |
