# Horticulture Operations Overtime & Workforce Planner (Offline Edition)

## Overview
The **Offline Edition** is a 100% client-side, zero-dependency version of the Adelaide City Council Horticulture Operations suite. It requires no live web server, Node.js runtime, or internet connection, and runs directly off the local filesystem (`file:///`) by opening `index.html` in any modern web browser (Edge, Chrome, Firefox, Safari).

---

## Baseline Milestone: Offline17.5j (Rostering Integrity Freeze — APPROVED)

> **"The Manual / Fixed / Rotation / Repeat rostering integrity foundation is frozen at Offline17.5j."**  
> **"No further integrity micro-patches are planned unless a reproducible defect demonstrates violation of the frozen contracts."**  
> *(Formally approved by independent audit in `Offline17.5j final review — FREEZE APPROVED.md`)*

Authoritative reference: [`ROSTERING_INTEGRITY_FREEZE.md`](ROSTERING_INTEGRITY_FREEZE.md)  
Close-out audit report: [`OFFLINE17_5J_CLOSEOUT_REPORT.md`](OFFLINE17_5J_CLOSEOUT_REPORT.md)  
Authoritative Checksums: [`OFFLINE17.5J_MANIFEST.sha256`](OFFLINE17.5J_MANIFEST.sha256)

---

## Architecture & Canonical File Structure

The project maintains an authoritative modular source tree and compiles a portable single-file bundle for air-gapped distribution.

```
Offline/
├── index.html                           # Generated self-contained single-file application
├── index.modular.html                   # Modular dev HTML entrypoint
├── README.md                            # Maintainer & operator architecture guide
├── package.json                         # Test suite runner & Playwright scripts
├── sample-overtime-source.json          # Reference Schema v2 backup dataset
├── ROSTERING_INTEGRITY_FREEZE.md        # Authoritative freeze specification & Invariants I1–I12
├── OFFLINE17_5J_CLOSEOUT_REPORT.md      # Milestone close-out audit report
├── OFFLINE17.5J_MANIFEST.sha256         # Authoritative release checksums manifest
├── css/
│   └── style.css                        # Native CSS tokens, layouts, and SVG sizing
├── dist/
│   └── hort_ops_offline_planner.html    # Compiled single-file distribution (bit-for-bit parity)
├── js/
│   ├── app.js                           # Master application coordinator & state store
│   ├── components/
│   │   ├── header.js                    # Top navigation, year selector, storage health pill
│   │   ├── forwardPlanner.js            # 52-week capacity matrix coordinator
│   │   ├── forwardPlanner/
│   │   │   ├── controls.js              # View options, search filter, department toggles
│   │   │   ├── header.js                # Dual-tier sticky date/week header
│   │   │   └── matrixRenderer.js        # Card and row rendering engine
│   │   ├── calendarView.js              # Monthly overtime calendar with 7-day columns
│   │   ├── jobRegistry.js               # Dense table-based job catalog & slideout drawer
│   │   ├── staffRegistry.js             # Workforce directory with plant operator ticket filters
│   │   ├── peakWeekends.js              # High-density clash & conflict analysis
│   │   ├── analytics.js                 # Overtime budget projections & monthly expenditure
│   │   ├── staffAssignModal.js          # Staged crew allocator (50/50 layout) coordinator
│   │   ├── staffAssignModal/
│   │   │   ├── candidateList.js         # Filterable candidate list (Primary/Secondary/Tertiary)
│   │   │   ├── candidateModel.js        # Eligibility and sorting heuristics
│   │   │   ├── filterBar.js             # Squad filters, search, and ticket badges
│   │   │   └── stagedCrew.js            # Staged crew slots (1..N) & roster mode selectors
│   │   ├── jobEditModal.js              # Job definition editor coordinator
│   │   ├── jobEditModal/
│   │   │   ├── formValidator.js         # Pre-save validation & scheduling compatibility guard
│   │   │   ├── recurrenceForm.js        # Weekly/fortnightly/monthly/annual recurrence builder
│   │   │   └── teamPreferences.js       # Departmental team ranking & exclusive team config
│   │   ├── staffExemptionModal.js       # Employee overtime exemption rules manager
│   │   ├── warningsModal.js             # Actionable scheduling and persistence warning drawer
│   │   ├── exportModal.js               # Canonical Schema v2 JSON backup exporter
│   │   └── importModal.js               # JSON / CSV roster import and diff preview modal
│   ├── data/
│   │   ├── staffRoster.js               # 253 staff members, department hierarchy, team colors
│   │   ├── initialJobs.js               # Baseline operational job definitions
│   │   ├── holidays.js                  # Gazetted South Australian public holidays (2025–2028)
│   │   └── historicalOccurrences.js     # Explicit historical actuals dataset
│   └── utils/
│       ├── dateUtils.js                 # Date arithmetic, ISO week numbering, local date keys
│       ├── icons.js                     # Self-contained inline SVG icon engine
│       ├── modalUtils.js                # Two-phase scroll lock and modal lifecycle
│       ├── securityUtils.js             # HTML sanitization & attribute escaping
│       ├── userCsvParser.js             # RFC 4180 CSV roster parser
│       ├── reconciliationEngine.js      # 3-Way CSV roster reconciliation
│       ├── eligibilityEngine.js         # Rest rule (10h), team suitability, plant tickets
│       ├── warningUtils.js              # Diagnostic audit & warning collectors
│       ├── scheduler.js                 # Schedule generator coordinator
│       ├── scheduler/
│       │   ├── costCalculator.js        # Enterprise Agreement overtime costing engine
│       │   └── engine.js                # Multi-year occurrence & clash generator
│       ├── rostering/
│       │   └── engine.js                # Assisted rostering (Manual/Fixed/Rotation/Repeat)
│       └── storage.js                   # Storage coordinator
│       └── storage/
│           ├── migrationEngine.js       # Legacy occurrence & Schema v1 migration
│           ├── schemaValidator.js       # Pre-write Schema v2 & Invariant I2 validator
│           └── storageDriver.js         # LocalStorage read/write & quarantine manager
└── scripts/
    ├── build_single_file.cjs            # Inlines CSS/JS into standalone HTML
    ├── run_all_release_gates.cjs        # Master release gate runner (Gates 1–9)
    ├── test_static_release.cjs          # Gate 1: Static syntax & scope audit
    ├── test_scheduler.cjs               # Gate 2: Scheduler invariants & overrides
    ├── test_workforce.cjs               # Gate 3: Workforce lifecycle & exclusions
    ├── test_persistence.cjs             # Gate 4: Schema v2 persistence contract
    ├── test_rostering_engine.cjs        # Gate 5: Assisted rostering & propagation
    ├── test_recovery_ui.cjs             # Gate 6: Truthful persistence & recovery warnings
    ├── test_multi_year_differential.cjs # Gate 7: Multi-year scheduler stability
    ├── test_rostering_lifecycle.cjs     # Gate 8: Rostering freeze & Invariants I1–I12 (158 gates)
    └── test_browser_smoke.cjs           # Gate 9: Playwright headless browser smoke suite
```

---

## Single-File Build Pipeline

To compile the modular source files into the standalone distribution bundles:

```bash
node scripts/build_single_file.cjs
```

This compiles:
1. `index.html` (root single-file application)
2. `dist/hort_ops_offline_planner.html` (distribution copy)

### Build Parity Contract
Both files must produce **bit-for-bit identical SHA-256 hashes**:
* **SHA-256**: `142da5c27a871fb49973cf023f8044d21e14a3108a7a63b88a3d450869973863`

---

## Automated Release Gates

The application is protected by 9 automated release gates. Run the canonical test suite via:

```bash
npm test
# or
node scripts/run_all_release_gates.cjs
```

| Gate | Suite Name | Scope & Coverage |
| :--- | :--- | :--- |
| **Gate 1** | Static Syntax & Helper Scope Audit | Validates 41 files for scope hygiene, zero undeclared globals, and strict syntax. |
| **Gate 2** | Scheduler Engine Invariants & Overrides | Verifies shift generation, zero duplicates, explicit occurrence precedence, and costing. |
| **Gate 3** | Workforce Lifecycle & Assignment Integrity | Verifies status allow-list, departed hard exclusions, and plant operator requirements. |
| **Gate 4** | Persistence Contract & Schema v2 Validation | Tests 43 persistence blocks, pre-write validation, quarantine, and recovery modes. |
| **Gate 5** | Assisted Rostering Engine & Propagation | Tests Fixed/Rotation propagation, Repeat bounds, and candidate tie-breaking. |
| **Gate 6** | Truthful Persistence State & Recovery Warnings | Asserts that `recoveryRequired` is visibly truthful and never masked as normal. |
| **Gate 7** | Multi-Year Scheduler & Rostering Differential | Validates scheduler stability across 2025–2028 with zero unintended recurrence drift. |
| **Gate 8** | **Offline17.5j Rostering Integrity Freeze (158 Gates)** | **158 Lifecycle Tests** asserting Global Invariants I1–I12 and the full state matrix. |
| **Gate 9** | **Playwright Headless Browser Smoke (Steps 1–7G)** | Automated end-to-end browser smoke test (zero console errors, zero uncaught exceptions). |

---

## Core Invariants & System Rules

### 1. Global Invariants (I1–I12)
Codified in [`ROSTERING_INTEGRITY_FREEZE.md`](ROSTERING_INTEGRITY_FREEZE.md):
* **I1**: Active instruction requires active parent Job.
* **I2**: Historical instruction cannot own current or future provenance (`targetDate >= today`).
* **I3**: Active instruction requires operational authority against parent Job recurrence.
* **I4**: Historical records survive recurrence drift permanently.
* **I5**: Unresolved active state fails closed (blocks save).
* **I6**: Exhausted instruction seals to `historical` on schedule changes and never resurrects.
* **I7**: Rostering lineage prevents hard deletion (retires Job instead).
* **I8**: Future rostering blocks Job retirement.
* **I9**: Completed lineage with zero active terminal instructions is valid in Schema v2.
* **I10**: Permitted schedule changes preserve exact active future sequence semantics.
* **I11**: Mutations are atomic (transactional rollback on failure).
* **I12**: Load → save equivalence (accepted loaded state is immediately saveable).

### 2. Symmetric Schema v2 Persistence Boundary
* **Storage Key**: `localStorage['hort_ops_workspace_v2']`.
* **Mandatory Version**: Integer `schemaVersion === 2`.
* **Pre-Write Validation**: Backups and in-memory workspaces are validated **before** storage write.
* **Quarantine**: Malformed payloads enter `Recovery Required` without overwriting quarantined state.

### 3. Preserved UI Canons
* **Job Registry**: Dense, searchable table with slideout inspector drawer.
* **Crew Allocator**: 50/50 layout (staged crew left, categorized candidate list right).
* **Modal Scroll Lock**: Two-phase scroll lock (`modalUtils.js`), preventing page jumping or background wheel chaining.
* **Forward Planner**: Dense 52-week capacity matrix, unallocated cards show actual vacancy count (`Vacancy n of x`), no noisy attribute pills.
* **Monthly Calendar & Peak Weekends**: Multi-day horizontal view divided into 7 distinct day columns.

---

## URL Testing Hooks
* `?testVacancy=1`: Removes crew from shift 0 to display unallocated vacancy rows.
* `?openStaffAssign=1`: Automatically opens the Crew Allocator modal on load.
* `?openAddJob=1`: Automatically opens the Job Add/Edit modal on load.
* `?showAll=1`: Displays all 253 staff rows in Forward Planner.
* `?view=[view_name]`: Activates view (`forward_planner`, `calendar`, `job_manager`, `staff_registry`, `peak_weekends`, `analytics`).
