# Adelaide Horticulture Operations Overtime Planner
## Architecture Decomposition Audit (Roadmap for Offline15 Governed Modularisation)

**Status:** Technical Baseline & Decomposition Blueprint  
**Target Release:** Offline15 (Governed Modularisation — Zero Behavioural Change)  
**Governing Authority:** `GEMINI_CONSTITUTION.md` (Articles 1, 3, 11, 28, 31)

---

### Executive Summary

The standalone offline application (`Offline/`) has successfully completed its integrity-hardening phase with `Offline14`. All core business rules, canonical shift identities, fail-closed workforce lifecycles, and Schema v2 storage contracts are robustly verified with 100% compliance across all 5 release gates.

As observed in Codex's review of `Offline14.zip`, the application is now ready for **Offline15 — Governed Modularisation**. This pass will decompose the monolithic UI and utility files into clean, focused sub-modules with **strictly zero intended behavioural change**.

This document provides the definitive file-by-file decomposition audit, dependency map, and refactoring boundary plan.

---

### 1. Codebase Inventory & Volume Profile

```text
File                               Lines   Primary Responsibility
------------------------------------------------------------------------------------------------------
js/components/staffAssignModal.js    708   Staged crew allocation, candidate filtering, team delegation
js/utils/scheduler.js                703   Multi-year occurrence generator, costing, clash detection
js/components/forwardPlanner.js      668   52-week horizontal matrix, clustering, vacancy rows
js/utils/storage.js                  619   Schema v2 persistence, atomic migration, quarantine handler
js/components/jobEditModal.js        505   Job definition editor, multi-tier preferences, recurrence
js/components/importModal.js         389   JSON / CSV roster import and 3-way diff preview
js/utils/reconciliationEngine.js     306   Workforce reconciliation lifecycle (departures, vacancies)
js/components/jobRegistry.js         296   Operational job catalog & detail slideout drawer
js/utils/eligibilityEngine.js        288   Authoritative assignment validator & crew qualification
js/utils/userCsvParser.js            282   RFC 4180 CSV roster parser & formula injection guard
js/components/staffExemptionModal.js 232   Employee overtime exemption window manager
js/components/exportModal.js         218   Canonical Schema v2 JSON backup exporter
js/components/staffRegistry.js       212   Workforce directory with plant operator ticket filters
js/utils/dateUtils.js                136   Date arithmetic, weekday checks, ISO week numbering
js/components/calendarView.js        111   Monthly overtime calendar & weekend shift cards
js/components/header.js              103   Top navigation, year selector, storage health pill
js/components/analytics.js            78   Overtime budget projections & monthly expenditure
js/utils/securityUtils.js             77   HTML and attribute sanitization engine
js/components/peakWeekends.js         71   High-density clash & conflict analysis
js/utils/icons.js                     64   Self-contained SVG icon engine with dimension safety
js/utils/modalUtils.js                47   Two-phase scroll lock and modal lifecycle
------------------------------------------------------------------------------------------------------
Total Modular JS:                  6,113 lines across 21 files
```

---

### 2. High-Priority Decomposition Targets for Offline15

#### Target A: `forwardPlanner.js` (668 lines)
* **Current State**: Manages filter controls, search state, 52-week matrix generation, 2-tier table header layout, team-clustered row placement, vacancy button rendering, and shift card rendering.
* **Identified Documentation Drift**: Line 3 contains a stale header comment referencing removed `+ Sat / + Sun / +` cell controls. (Protected by Constitution Art. 21).
* **Proposed Modular Partitioning**:
  1. `forwardPlanner/header.js`: 52-week 2-tier column headers (Months, Week numbers, Sat/Sun sub-columns).
  2. `forwardPlanner/controls.js`: Department filter, team filter, search input, unassigned-only toggle.
  3. `forwardPlanner/matrixRenderer.js`: Optimal contiguous clustering algorithm, row placement, and cell rendering.
  4. Clean up the stale `+ Sat / + Sun / +` header comment.

#### Target B: `staffAssignModal.js` (708 lines)
* **Current State**: Manages modal DOM rendering, candidate eligibility scoring, filtering controls (Department/Team/Plant Op/Exempt), staged assignment state, plant operator warnings, and commit persistence.
* **Proposed Modular Partitioning**:
  1. `staffAssignModal/candidateList.js`: Candidate card rendering, score badges, conflict chips.
  2. `staffAssignModal/filterBar.js`: Delegated team chips, search filtering, plant op toggle.
  3. `staffAssignModal/stagedCrew.js`: Current shift crew slots, vacancy placeholders, stage/commit actions.

#### Target C: `jobEditModal.js` (505 lines)
* **Current State**: Dynamic modal DOM construction, recurrence frequency fields (weekly/annual/one-off), multi-tier team preference selectors (Primary, Secondary, Tertiary), and validation.
* **Proposed Modular Partitioning**:
  1. `jobEditModal/recurrenceForm.js`: Cadence selector, anchor date, day-of-week radio groups.
  2. `jobEditModal/teamPreferences.js`: Multi-tier delegated team selection and exclusive team toggles.
  3. `jobEditModal/formValidator.js`: Client-side pre-save validation before committing to storage.

#### Target D: `scheduler.js` (703 lines)
* **Current State**: Weekend slot generator, multi-year recurrence expansion, Enterprise Agreement costing, and operational integrity validation.
* **Identified Architectural Redundancy**:
  - Lines 38–43 contain a defensive fallback employment-status check (`staff.status === 'departed' ...`) used only if `HortOpsEligibilityEngine` is absent.
  - This fallback duplicates the eligibility contract and is less strict than canonical fail-closed rules.
* **Proposed Clean-Up & Partitioning**:
  1. Eliminate the redundant lines 38–43 fallback; strictly require `HortOpsEligibilityEngine` (fail-closed dependency assertion).
  2. Partition costing into `scheduler/costCalculator.js` ($44.50 base rate, Saturday 1.5x/2.0x, Sunday 2.0x, meal allowances).
  3. Retain core occurrence materialization in `scheduler/engine.js`.

#### Target E: `storage.js` (619 lines)
* **Current State**: In-memory cache, localStorage driver, Schema v2 pre-write validator, v1->v2 migration engine, and quarantine error handler.
* **Proposed Partitioning**:
  1. `storage/schemaValidator.js`: Authoritative Schema v2 schema definition and validators.
  2. `storage/migrationEngine.js`: Isolated legacy v1-to-v2 transformation routines.
  3. `storage/storageDriver.js`: LocalStorage wrapper, atomic quarantine handler, and health telemetry.

---

### 3. Non-Functional Invariants for Offline15
1. **Zero Behavioural Change**: Offline15 must NOT alter user workflows, candidate rankings, scheduling outputs, costing calculations, or persistence envelope formats.
2. **Build Pipeline Compatibility**: All modular files must inline cleanly via `scripts/build_single_file.cjs` into `index.html` and `dist/hort_ops_offline_planner.html`.
3. **100% Release Gates Green**: Gates 1 through 5 must pass continuously during every incremental step.
