# Master Maintainer Handoff Guide: Stage 3 Active Baseline & PR26_07 Architecture

**Document Identifier:** `NEW_MAINTAINER_HANDOFF_GUIDE.md` / `MASTER_MAINTAINER_HANDOFF_STAGE3.md`  
**Target Audience:** Incoming Software Engineers, Technical Architects, and Autonomous AI Agents with **zero prior knowledge** of this project.  
**System Name:** Horticultural Operations Overtime Planner (`HortOps Offline Planner`)  
**Active Milestone:** Stage 3 Active — Candidate `PR26_07` (Review 63 Resolved, Review 64 Handoff Pending)  
**Governance Authority:** Project Owner Authorization (Stage 3 Active & Authorized; **Stage 4 STRICTLY NOT AUTHORIZED**)  
**Last Updated:** 04 October 2026  

---

## 1. Executive Orientation & Project Identity

### 1.1 The Mission of HortOps
The **Horticultural Operations Overtime Planner** (`HortOps`) is an enterprise-grade, offline-first, single-file web application built specifically for the **City of Adelaide Municipal Horticultural Operations** (Adelaide, South Australia).

It manages 52-week annual overtime rostering, recurring maintenance schedules (Parklands, CBD street trees, North Adelaide verges, plant nurseries), emergency storm response crews, and summer heatwave watering operations.

### 1.2 The Offline-First Deployment Reality
Field supervisors, park depot coordinators, and tree maintenance crews operate across municipal depots with intermittent, firewalled, or completely air-gapped network connectivity. 
Therefore, the application is strictly architected as a **deterministic, self-contained single-file HTML bundle** (`dist/hort_ops_offline_planner.html` and `index.html`) containing:
- Inlined CSS stylesheets (`css/style.css`)
- Inlined JavaScript modules (data, utilities, engines, components, and coordinator)
- LocalStorage persistence under canonical Schema v2 envelopes
- Zero external CDN scripts, zero runtime npm dependencies in production, and zero remote API phone-homes.

---

## 2. Governance Lifecycle & Stage Boundaries

The project strictly follows a phased, gate-driven governance model with independent adversarial peer review (conducted iteratively with ChatGPT and independent synthetic probe suites):

| Stage | Scope | Status | Acceptance Gate |
|:---|:---|:---|:---|
| **Stage 1** | Architecture Governance, Core Invariants (`C1`–`C10`), Gregorian Calendar, 10-Hour Physical Rest | **CLOSED & FROZEN** | 17 Retained Release Suites |
| **Stage 2** | Transaction Model (`TM-I01`–`TM-I17`), Storage Hygiene, Reset & Emergency Recovery | **CLOSED & FROZEN** | Candidate `PR23_07_10` Signed Off (7 Acceptance Gates) |
| **Stage 3** | Workforce Intelligence, Qualification Tracking, Absence Ledger, Multi-Session Concurrency, Dual-Alias Harmonization | **ACTIVE & AUTHORIZED** | Candidate `PR26_07` (Review 63 Resolved, 6/6 Probes, 24/24 Release Gates) |
| **Stage 4** | Advanced Multi-Depot Optimization & Extended Exporting | **STRICTLY NOT AUTHORIZED** | *Do not write code, tests, or migrations for Stage 4 without explicit owner sign-off.* |

---

## 3. Canonical Architecture & The Schema v2 Envelope

### 3.1 Authoritative Schema v2 Envelope Structure
The entire application state is persisted in `localStorage` under the key `hort_ops_workspace_v2`. The JSON root is an immutable top-level envelope containing 10 distinct canonical domains:

```json
{
  "schemaVersion": 2,
  "jobs": [ /* Array of job objects: id, name, frequency, crewSize, teams... */ ],
  "roster": [ /* Array of staff objects: id, name, team, skills, qualifications... */ ],
  "assignments": { /* Map of "date_jobId_slotIndex": staffId */ },
  "rostering": { "instructions": {}, "provenance": {} },
  "historicalSnapshots": { /* Map of sealed historical dates: { date, assignments, digest } */ },
  "permits": { /* Map of active shift overtime permits and exemptions */ },
  "budgetSettings": { "annualBudgetCap": 50000, "hourlyBaseRate": 44.50 },
  "absences": [ /* Array of absence records: id, staffId, startDate, endDate, type */ ],
  "refusalHistory": [ /* Array of overtime shift refusal records: id, staffId, date, reason */ ],
  "uiState": {
    "activeView": "forward_planner",
    "currentYear": 2026,
    "selectedDepartment": "all",
    "selectedTeam": "all",
    "onlyPreferredCrew": false,
    "searchTerm": ""
  }
}
```

### 3.2 Dual-Alias Harmonization Pattern (PR26_07 Mandate)
Throughout the application's history, legacy code referred to certain domains by secondary names (e.g., `staffList` vs `roster`, `customAssignments` vs `assignments`, `customPermits` vs `permits`, `refusals` vs `refusalHistory`).

**The Golden Invariant (R63-P0-01):**
> *Every canonical domain has exactly ONE authoritative in-memory representation. If both canonical and legacy aliases exist, they MUST be unconditionally synchronized views of the exact same committed post-save value, never competing candidates.*

In `js/app.js`:
- Upon `init()`: Both canonical and legacy aliases are initialized from the loaded workspace.
- Upon `_commitCanonicalProposal()`: After durable storage write succeeds, all aliases are unconditionally synchronized:
  ```javascript
  this.state.roster = candidateEnvelope.roster;
  this.state.staffList = candidateEnvelope.roster;
  this.state.assignments = candidateEnvelope.assignments;
  this.state.customAssignments = candidateEnvelope.assignments;
  this.state.permits = candidateEnvelope.permits;
  this.state.customPermits = candidateEnvelope.permits;
  this.state.refusalHistory = candidateEnvelope.refusalHistory;
  this.state.refusals = candidateEnvelope.refusalHistory;
  this.state.uiState = candidateEnvelope.uiState;
  ```
- Upon `restoreWorkspaceJson()` and `resetToCleanSlate()`: All dual aliases are synchronized in tandem with `_updateDomainBaselines()`.

### 3.3 Three-Way Concurrency Reconciliation (Review 61 & 62)
When an operator saves a domain (e.g. adding an absence in `StaffAbsenceModal`), `_commitCanonicalProposal()` reads the freshly committed storage from disk and performs 3-way reconciliation:
1. `_domainBaselines`: The state of each domain when the current session/modal was opened.
2. `committedData`: The current state in `localStorage` (which may have been updated concurrently by another tab or operator).
3. `proposedData`: The state proposed by the current session.

- **Non-interfering domain changes** (e.g., Session A updates `absences`, Session B concurrently updates `uiState` or `jobs`): Cleanly merged without data loss.
- **True conflicting same-domain edits**: Fail closed with a deterministic `CONCURRENT_MODIFICATION_CONFLICT` and zero disk mutation.
- **Resurrection Prevention**: Records deleted by an authorized session are never resurrected by a stale session.

---

## 4. Directory Structure & Key Files

```
Hort_Ops_Visualisations/
├── Offline2-Overtime-Planner/           <- Primary codebase & distribution build
│   ├── index.html                       <- Standalone single-file application (root)
│   ├── index.modular.html               <- Development modular HTML entrypoint
│   ├── dist/
│   │   └── hort_ops_offline_planner.html<- Standalone production build (must equal index.html)
│   ├── js/
│   │   ├── app.js                       <- Core application coordinator, state & transactions
│   │   ├── components/                  <- UI Views and Modals
│   │   │   ├── forwardPlanner.js        <- 52-week forward overtime planning grid
│   │   │   ├── staffAbsenceModal.js     <- Planned/unplanned leave and refusals modal
│   │   │   ├── staffQualificationModal.js<- Qualification matrix & suspensions modal
│   │   │   ├── staffAssignModal.js      <- Crew allocator modal (with candidateModel.js)
│   │   │   ├── jobRegistry.js           <- Job definition registry & lifecycle manager
│   │   │   └── analytics.js             <- Real-time budget and fatigue analytics
│   │   └── utils/
│   │       ├── storage.js               <- LocalStorage driver & schema validator
│   │       ├── storage/                 <- Schema validation & migration engines
│   │       ├── fatigueEngine.js         <- 10-hour rest, Adelaide timezone & DST rules
│   │       ├── qualifications.js        <- Qualification validation & verification engine
│   │       └── scheduler/               <- Recurrence engine & boundary caches
│   ├── scripts/
│   │   ├── build_single_file.cjs        <- Inlines CSS/JS into index.html and dist/
│   │   ├── run_all_release_gates.cjs    <- Master release runner (24 suites)
│   │   ├── run_all_stage3_gates.cjs     <- Stage 3 master runner (6 gates)
│   │   ├── test_stage3_browser_smoke.cjs<- Playwright Chromium headless smoke (7 scenarios)
│   │   ├── test_browser_smoke.cjs       <- Retained Stage 1/2 Playwright browser smoke
│   │   └── package_stage3_pr26_07.py    <- Authoritative packaging & manifest script
│   └── test_reports/                    <- Raw execution logs from latest verified build
│
└── Offline2-overtime-planner-support/   <- Governance, reviews, and release packages
    ├── peer reviews/                    <- Complete peer review archives (Review 01 through 63)
    │   ├── Review63_PR26_07_Candidate_Submission/ <- Latest staged candidate submission
    │   └── Review63_Stage3_PR26_06_Assessment_and_Gemini_Handoff/ <- Directive for PR26_07
    ├── zip packages/                    <- Archived candidate and companion ZIP packages
    └── prompts/                         <- Maintainer briefings and handoff guides
        └── NEW_MAINTAINER_HANDOFF_GUIDE.md <- This document
```

---

## 5. Development Environment & Execution Rules

### 5.1 WSL2 Linux First (Mandatory)
The host machine runs Windows, but the entire development workspace, toolchains, package managers, compilers, and git repositories live inside **Ubuntu 24.04 WSL2**.
- **NEVER execute Windows PowerShell or CMD commands** for repository workflows, tests, or builds.
- Always execute inside Linux via `wsl -d Ubuntu bash -lic '<command>'` or run Python helper scripts with `wsl -d Ubuntu python3 <script>.py`.
- Working directory inside WSL: `/home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner`.

### 5.2 Token Conservation (RTK)
Prefix supported shell commands with `rtk` (Rust Token Killer at `/home/n0rt/.local/bin/rtk`):
```bash
rtk git status
rtk git diff
rtk node scripts/run_all_stage3_gates.cjs
```

---

## 6. Verification Runbook & Standard Maintainer Commands

Execute all commands from the repository root inside Ubuntu WSL2:

### Step 1: Run Stage 3 Master Gates (6 Gates)
```bash
node scripts/run_all_stage3_gates.cjs
```
*Expected Result:* `6/6 GATES PASSED (exit 0)`.

### Step 2: Run Review 63 Independent Negative Probes (6 Probes)
```bash
node REVIEW63_INDEPENDENT_NEGATIVE_PROBES.cjs
```
*Expected Result:* `6 PASS / 0 FAIL / 6 ASSERTIONS (exit 0)`.

### Step 3: Run Full Master Release Runner (24 Release Suites)
```bash
node scripts/run_all_release_gates.cjs
```
*Expected Result:* `TOTAL: 24 PASSED, 0 FAILED, 0 BLOCKED (exit 0)`.

### Step 4: Run Playwright Browser Smoke Suites
```bash
node scripts/test_stage3_browser_smoke.cjs
node scripts/test_browser_smoke.cjs
```
*Expected Result:* `All scenarios pass with 0 browser console errors (exit 0)`.

### Step 5: Build Single-File Distribution & Verify Parity
```bash
node scripts/build_single_file.cjs
sha256sum index.html dist/hort_ops_offline_planner.html
```
*Expected Result:* Both SHA-256 hashes must match bit-for-bit.

### Step 6: Package Candidate Release
```bash
python3 scripts/package_stage3_pr26_07.py
```
*Expected Result:* Generates `HortOps-Stage3-Candidate-PR26_07.zip` and full companion package, staging artifacts in `Offline2-overtime-planner-support/peer reviews/Review63_PR26_07_Candidate_Submission/`.

---

## 7. Golden Rules for Future Maintainers

1. **Never Advance to Stage 4 Without Explicit Owner Authority**:
   Stage 3 is active and authorized. Stage 4 is strictly unauthorized. Do not add Stage 4 features.
2. **Never Break Single-File Parity**:
   Whenever `js/app.js`, CSS, or any component is edited, always re-run `node scripts/build_single_file.cjs` and verify bit-for-bit identity between `index.html` and `dist/hort_ops_offline_planner.html`.
3. **Never Allow Dual-Alias Desynchronization**:
   If modifying state in `js/app.js`, ensure `roster === staffList`, `assignments === customAssignments`, `permits === customPermits`, `refusals === refusalHistory`, and `uiState` are updated in lockstep.
4. **Never Modify Independent Peer Review Probes**:
   Files like `REVIEW63_INDEPENDENT_NEGATIVE_PROBES.cjs` are immutable adversarial contracts from the independent reviewer. Fix the application code, never the probe.
5. **Always Fail Closed on Corrupted Input**:
   Invalid types, explicit `null` domains, and schema violations must reject saves with clear diagnostics, leaving storage bytes completely untouched.

---

*Handoff authored and verified for Candidate PR26_07 baseline on 04 October 2026.*
