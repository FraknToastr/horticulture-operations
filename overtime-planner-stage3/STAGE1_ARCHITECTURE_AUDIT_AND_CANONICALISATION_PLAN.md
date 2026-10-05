# STAGE 1 ARCHITECTURE AUDIT & CANONICALISATION PLAN
## Horticulture Overtime Planner — Baseline Stage 1 Architecture, Governance & Canonical-Data Reset

- **Document Version:** 2.0.0 (Gate A Accepted / Gate B1 Proposed — Canonical V2 Persistence & Scheduled-Commitment Validation)
- **Governing Directive:** `GEMINI_STAGE1_ARCHITECTURE_GOVERNANCE_RESET_DIRECTIVE.md` (Constitutional Section 6)
- **Status:** Gate A Accepted (Review 12, 2026-09-25) — Gate B1 Developer-Implemented (Submitted for Independent Review)
- **Applicability:** Stage 1 (Gate A Integrity Closure & Baseline Canonical Audit)
- **Authoritative Date:** 2026-09-25

---

## Document Governance & Status Nomenclature

Every component, function, schema field, and lifecycle path in this audit is classified using strict governance statuses:
- **Observed:** Directly verified in the current production source files.
- **Developer-Implemented:** Implemented, verified by unit tests, and submitted by the developer in Gate A.
- **Proposed:** Architectural plan for subsequent gates (Gate B, Gate C, or Gate D). Strictly non-binding until respective gate entry.
- **Class A:** Canonical production component to be retained and hardened.
- **Class B:** Safe fallback / quarantine / diagnostic component.
- **Class D:** Obsolete legacy migration path targeted for deletion in Gate C.
- **Class E:** Schema version constants to be restricted in Gate C.
- **Class F:** Prototype storage key routines targeted for removal in Gate C.
- **Class G:** Test-only fixtures and harnesses.
- **Class H:** Active production-seed dependencies or components under investigation pending isolation.

---

# 1. End-to-End Data Lifecycle Map [Observed in Checked-Out Source & Developer-Implemented]

The current application lifecycle operates as a single-page offline application persisting state to browser `localStorage`.

```
[Clean Boot / Clean Slate]
          â
          ââââº HortOpsStorage.loadWorkspace() [js/utils/storage.js:175]
          â         â
          â         ââââº Existing v2 Key? (hort_ops_workspace_v2)
          â         â         âââº Valid Schema 2 âââº HortOpsApp.init() [Adopts State]
          â         â         âââº Missing/Null History (with assignments) âââº Quarantine [recoveryRequired: true]
          â         â         âââº Corrupt / Invalid âââº Quarantine [recoveryRequired: true] (Raw Bytes Preserved)
          â         â
          â         ââââº Legacy v1 Key? (hort_ops_workspace) âââº Migrate v1->v2 âââº Validate âââº Persist v2
          â         â
          â         ââââº Clean Slate (No Keys) âââº Default Seed Workspace âââº Persist v2
          â
[Runtime Operation & User Interaction]
          â
          ââââº Allocations: HortOpsApp.updateShiftStaff() [js/app.js:280]
          â         â
          â         ââââº HortOpsApp.saveCurrentWorkspace() [js/app.js:125]
          â                   â
          â                   âââº Fail-Closed Guard: Malformed historicalSnapshots? âââº Abort Save
          â                   âââº F01 Guard: Established snapshots dropped to {}? âââº Abort Save (Bytes Preserved)
          â                   â
          â                   âââº Valid State âââº HortOpsStorage.saveWorkspace() [js/utils/storage.js:120]
          â                             â
          â                             âââº Validate Canonical Schema 2 [schemaValidator.js:240]
          â                             âââº Direct Write: window.localStorage.setItem() [storage.js:147]
          â
[Backup Export & Restore Lifecycle]
          â
          ââââº Backup Export: HortOpsExportModal.exportBackupJson() [js/components/exportModal.js:20]
          â         â
          â         âââº F03 Guard: Validate state.rostering (instructions/provenance) & historicalSnapshots
          â         âââº Valid âââº JSON Download Triggered
          â
          ââââº JSON Restore: HortOpsApp.restoreWorkspaceJson() [js/app.js:220]
                    â
                    âââº Prepare & Validate Import [migrationEngine.js:74]
                    âââº Save Proposed Workspace to Storage [storage.js:120]
                    âââº Replace Active Runtime State Completely [app.js:240]
                    âââº Clear Boundary Caches: HortOpsScheduler.clearBoundaryCache()
```

### 1.1 Lifecycle Operation & Formal 8-Boundary Inventory Table

In accordance with Stage 1 Peer Review Protocol v2 and Review 10, every ingress, egress, persistence, and conversion boundary is cataloged below with its boundary role tag (*new workspace*, *runtime current-v2 projection*, *raw supported-v2 input*, *v1 migration only*, or *recovery result*), verified source line reference, shared validator enforcement, and fail-closed failure semantics:

| # | Boundary Name & Call Site | Source Location | Boundary Role Tag | Ingress / Egress | Shared Validator Hook & Contract | Failure Semantics & Storage Preservation |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| **B1** | `HortOpsStorage.saveWorkspace()` | `js/utils/storage.js:156` | Raw supported-v2 input / Runtime projection | Ingress to storage (localStorage / driver) | Prevalidates raw input via `HortOpsSchemaValidator.validateCurrentV2ForBoundary(workspace)`. No fallback insertion (`|| {}`). Serializes `check.data`. | **Fail-closed:** Returns `{ok: false, stage: 'validation', storageMode: 'unchanged', error: check.error}`. Zero write to storage; previous raw bytes preserved. |
| **B2** | `HortOpsStorage.loadWorkspace()` / `HortOpsApp.init()` | `js/utils/storage.js:224` / `js/app.js:19` | Stored current-v2 envelope / Recovery result | Egress from storage / Ingress to application state | Validates persisted v2 envelope via `validateCurrentV2Presence(parsedV2)`. | **Quarantine:** Missing or invalid evidence maps quarantined with `recoveryRequired: true`. Zero storage overwrite; raw bytes untouched. |
| **B3** | `HortOpsApp.saveCurrentWorkspace()` | `js/app.js:54` | Runtime current-v2 projection | Egress from live state / Ingress to storage | Validates live state presence (`validateCurrentV2Presence`) and verifies committed baseline via `HortOpsStorage.readVerifiedCommittedV2()`. Checks snapshot key retention. | **Fail-closed:** Suspends auto-save if recovery required, evidence missing, or committed storage unreadable/invalid; sets `storageStatus = 'save_failed'`; returns `false`. Storage untouched. |
| **B4** | `HortOpsMigrationEngine.createWorkspaceEnvelope()` | `js/utils/storage/migrationEngine.js:41` | Envelope builder (new, runtime projection, or migrated) | Data transformation | Strictly requires explicit evidence maps on current-v2 input via `validateCurrentV2Presence`. Throws `Error` if `historicalSnapshots` or `rostering` missing. | **Fail-closed:** Prohibits synthesis of fallback maps for incomplete current-v2. Leaves v1 empty evidence materialization to `migrateWorkspaceV1toV2()`. |
| **B5** | `HortOpsMigrationEngine.prepareWorkspaceJsonImport()` | `js/utils/storage/migrationEngine.js:91` | Raw supported-v2 input (file import) | Ingress from external JSON to import staging | If `sourceVersion === 2`, strictly executes `validateCurrentV2Presence(parsed)` followed by `validateWorkspaceSchema(parsed)`. Removed all contextual exceptions. | **Fail-closed:** Rejects incomplete v2 regardless of assignment counts; returns `{success: false, stage: 'validation', schemaVersion: 2, error: shape.error}`. |
| **B6** | `HortOpsApp.restoreWorkspaceJson()` | `js/app.js:448` | Raw supported-v2 input / Full workspace replacement | Ingress to storage and runtime state | Prevalidates envelope via `validateCurrentV2ForBoundary(envelope)` operating on defensive working copy *before* any state or storage mutation. Adopts `check.data`. Clears scheduler boundary cache. | **Fail-closed:** Rejects invalid envelope immediately; returns `false`. Zero mutation to `app.state`; zero write to storage. Shared runtime references preserved untouched. |
| **B7** | `HortOpsExportModal.exportBackupJson()` | `js/components/exportModal.js:22` | Runtime current-v2 projection | Egress from live state to JSON download | Reads verified committed baseline via `HortOpsStorage.readVerifiedCommittedV2()`. Validates live projection via `validateCurrentV2Presence`. Verifies identity key retention via `checkEvidenceKeyRetention(committed.data, liveProjection)`. | **Fail-closed:** Aborts export immediately if committed baseline is corrupt or if live keys are missing. Zero file download (`downloadFile` blocked); storage untouched. |
| **B8** | Default Initial Envelope Construction | `js/utils/storage.js:456` | New workspace (clean slate initialization) | Internal creation on first boot | Constructs canonical initial envelope with explicit `{}` evidence fields: `historicalSnapshots: {}`, `rostering: { instructions: {}, provenance: {} }`. | Produces fully compliant current-v2 envelope ready for valid persistence. |

### 1.2 Defensive Working Copy & Boundary Normalization Audit
In accordance with Protocol v2 and Review 10, boundary validation contracts and in-place normalization within `HortOpsSchemaValidator` are governed as follows:
- `HortOpsSchemaValidator.validateCurrentV2ForBoundary(input)` (`schemaValidator.js:729`) executes `validateCurrentV2Presence(input)` on the raw input first, then deep clones `input` into a defensive working copy `working = JSON.parse(JSON.stringify(input))`.
- Semantic validation and in-place normalization (`normalizeLineage()`) operate **exclusively on the defensive working copy**.
- On validation failure, the error is returned immediately without mutating caller-owned objects or live application state (addressing Review 10 finding GA10-04).
- On validation success, `{ valid: true, data: working }` is returned, allowing persistence writers (`saveWorkspace()`) and state adopters (`restoreWorkspaceJson()`) to consume the verified, normalized data safely.
- **Gate B Scope Boundary (`GB-OWN-001`):** Direct complete-v2 whole-workspace replacement currently permits intentional or accidental record key removal. Gate B must establish formal authorization contracts for individual instruction/provenance retirement, distinguishing verified intentional deletions from accidental evidence loss.

---

# 2. Observed Supported-v2 Field Contract & Runtime Projections [Observed & Proposed]

### 2.1 Runtime Projections vs Persisted Truths
Review 06 (R06) correctly established that differences between in-memory runtime property names and envelope keys are **architectural projections**, not duplicated persisted truths:
- `staffList` (runtime array of rich employee models) âââº Projected to `roster` in Schema v2 envelope.
- `customAssignments` (runtime dictionary of shift allocations) âââº Projected to `assignments` in Schema v2 envelope.
- `customPermits` (runtime dictionary of shift permits) âââº Projected to `permits` in Schema v2 envelope.
- `recoveryRequired`, `recoverySource`, `recoveryError` âââº **Runtime quarantine diagnostics**, not operational business data.

### 2.2 Envelope Domain Specification Table

| Envelope Key | Data Type | Currently Enforced Requirement | Proposed Canonical Rule (Gate B) | Runtime Source | Default | Validator Owner |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `schemaVersion` | number (integer) | Strictly === 2 | Strictly === 2 | Constant (2) | None | `schemaValidator.js:250` |
| `lastSaved` | string (ISO 8601) | Non-empty string | ISO 8601 UTC timestamp | `new Date().toISOString()` | Current time | `schemaValidator.js:260` |
| `jobs` | Job[] | Array of valid Job objects | Canonical Job schema; unique id | `state.jobs` | `[]` | `schemaValidator.js:275` |
| `roster` | Employee[] | Array of valid Employee objects | Canonical Employee schema; unique id | `state.staffList` | `[]` | `schemaValidator.js:330` |
| `assignments` | Record<string, string[]> | Object map: shiftId -> employeeId[] | shiftId format `JOB_ID@YYYY-MM-DD` | `state.customAssignments` | `{}` | `schemaValidator.js:656` |
| `rostering.instructions` | Record<string, Instruction> | Keyed by instructionId (`ROSTER-...`) | Keyed by canonical instructionId | `state.rostering.instructions` | `{}` | `schemaValidator.js:379` |
| `rostering.provenance` | Record<string, Provenance> | Keyed by `targetShiftId + ':' + employeeId` | Keyed by `targetShiftId + ':' + employeeId` | `state.rostering.provenance` | `{}` | `schemaValidator.js:559` |
| `permits` | Record<string, Permit> | Object map: shiftId -> Permit | Strictly typed permit records | `state.customPermits` | `{}` | `schemaValidator.js:630` |
| `budgetSettings` | Object | Object map | Overtime multipliers and cap | `state.budgetSettings` | Defaults | `schemaValidator.js:645` |
| `uiState` | Object | Optional object (`activeView`, `currentYear`) | View configuration | `state.uiState` | Defaults | `schemaValidator.js:650` |
| `historicalSnapshots` | Record<string, Snapshot> | Object map: shiftId -> Snapshot | Strict timing, date, and duration validation | `state.historicalSnapshots` | `{}` | `schemaValidator.js:672` |

---

# 3. Formal A–H Dependency Inventory & Deletion Candidates [Observed & Proposed]

Under Section 12 of the Governance Directive, every persistence, migration, fallback, and fixture pathway has been audited:

| ID | File & Line | Component / Path | Class | Call Sites & Consumers | Proposed Action & Rollback Plan | Status |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **P-01** | `js/utils/storage.js:120` | `saveWorkspace()` | **A** | `app.js:125`, `app.js:220`, `storage.js:235` | **KEEP.** Canonical transactional save driver. | Observed |
| **P-02** | `js/utils/storage.js:175` | `loadWorkspace()` (Schema 2) | **A** | `app.js:20` (via `init()`) | **KEEP.** Canonical storage load entry point. | Observed |
| **P-03** | `js/utils/storage.js:208` | `isV1UnderV2Key` handler | **D** | `loadWorkspace()` line 208 | **REMOVE in Gate C.** Coerces v1 under v2 key. Replacement: reject explicitly. Rollback: restore branch. | Proposed (Gate C) |
| **P-04** | `js/utils/storage.js:275` | `LEGACY_V1_KEY` loader | **D** | `loadWorkspace()` line 275 | **REMOVE in Gate C.** Standalone v1 key load. Replacement: reject explicitly. Rollback: restore branch. | Proposed (Gate C) |
| **P-05** | `js/utils/storage.js:330` | Legacy individual offline keys | **F** | `loadWorkspace()` line 330 | **REMOVE in Gate C.** Prototype un-enveloped keys. Replacement: clean slate. Rollback: restore branch. | Proposed (Gate C) |
| **P-06** | `js/utils/storage/migrationEngine.js:14` | `migrateWorkspaceV1toV2()` | **D** | `storage.js:214`, `storage.js:299`, `storage.js:395` | **REMOVE in Gate C.** Obsolete v1 migration logic. Replacement: reject v1. Rollback: restore module. | Proposed (Gate C) |
| **P-07** | `js/utils/storage/migrationEngine.js:5` | `SUPPORTED_WORKSPACE_SCHEMA_VERSIONS: [1, 2]` | **E** | `migrationEngine.js:87`, `storage.js:203` | **UPDATE in Gate C.** Change to `[2]`. Reject v1 JSON import explicitly. | Proposed (Gate C) |
| **P-08** | `js/utils/storage/migrationEngine.js:39` | `createWorkspaceEnvelope()` | **A** | `app.js:130`, `storage.js:233`, `storage.js:428` | **KEEP.** Envelope factory. Gate B will consolidate into single canonical builder. | Developer-Implemented |
| **P-09** | `js/utils/storage/migrationEngine.js:56` | `createWorkspaceRecoveryResult()` | **B** | `storage.js:188`, `storage.js:212`, `storage.js:225` | **KEEP.** Safe quarantine generator. Preserves raw source bytes untouched. | Observed |
| **P-10** | `js/utils/storage/schemaValidator.js:240` | `validateWorkspaceSchema()` | **A** | `storage.js:133`, `migrationEngine.js:125` | **KEEP.** Authoritative Schema v2 validator. Line 240. | Observed |
| **P-11** | `js/utils/storage/schemaValidator.js:27` | `normalizeLineage()` | **H** | `schemaValidator.js:244`, `storage.js:231`, `storage.js:281` | **INVESTIGATE (Do not delete in Gate A/B).** Runs on current v2 load path. Must be audited before any replacement. | Class H — Investigate |
| **P-12** | `js/data/initialJobs.js:5` | `INITIAL_JOBS` (12 jobs) | **H** | `app.js:24`, `storage.js:176`, `migrationEngine.js:60`, `scheduler/engine.js:1262`, `staffAssignModal.js:221,445,583,694,769` | **PRODUCTION-SEED DEPENDENCY.** Active operational fallback across UI modals, scheduler engine, and app init. Isolate to test fixtures in Gate C after clean-boot capability is proven. | Class H — Operational Dependency |
| **P-13** | `js/data/staffRoster.js:5` | `STAFF_ROSTER` (253 staff) | **H** | `app.js:24`, `storage.js:177`, `migrationEngine.js:61`, `eligibilityEngine.js:16`, `scheduler/engine.js:619,1264`, `jobEditModal.js:70,259`, `staffAssignModal.js:234,546,578,699` | **PRODUCTION-SEED DEPENDENCY.** Active operational fallback across eligibility checks, allocation modals, and scheduler. Isolate to test fixtures in Gate C after clean-boot capability is proven. | Class H — Operational Dependency |
| **P-14** | `js/data/historicalOccurrences.js:6` | `HISTORICAL_OCCURRENCES` (44 occs) | **H** | `app.js:318`, `scheduler/engine.js:446,544,628` | **PRODUCTION-SEED DEPENDENCY.** Fallback historical occurrence source for digest and shift timing. Isolate to test fixtures in Gate C once `historicalSnapshots` fully covers legacy shift ranges. | Class H — Operational Dependency |

---

# 4. Constitutional Conformance Matrix (Principles C1–C10) [Truthful Adjudication]

In strict accordance with Section 6 of `GEMINI_STAGE1_ARCHITECTURE_GOVERNANCE_RESET_DIRECTIVE.md`, each non-negotiable principle is adjudicated against its exact constitutional definition and verified with source code citations:

| Principle ID & Verbatim Constitutional Title | Adjudicated Status | Direct Code / Test Evidence & Factual Assessment | Gate Providing Full Closure |
| :--- | :---: | :--- | :---: |
| **C1. One canonical source of truth per concept** | **Partially Verified** | Schema v2 is the sole persisted format (`storage.js:147`). Historical scheduled timing has one canonical authoritative record (`historicalSnapshots`). However, `createWorkspaceEnvelope()` is defined in `migrationEngine.js:39` while `storage.js:125` performs shallow envelope creation, and runtime state maintains parallel projections (`staffList` -> `roster`, `customAssignments` -> `assignments`). Consolidation into a single canonical builder is scheduled for Gate B. | Gate B |
| **C2. Eligibility is authoritative and centralised** | **Partially Verified** | `window.HortOpsEligibilityEngine` is centrally consumed by modal workflows (`staffAssignModal.js`) and auto-rostering rotation (`scheduler/engine.js:28`). In Gate A, `test_rostering_engine.cjs` Suites 11–13 confirm rest-gap enforcement across allocation modes. Input validation hardening across non-modal paths is scheduled for Gate B. | Gate B |
| **C3. Historical facts must not be reconstructed from mutable definitions** | **Partially Verified** | Implemented via `resolveShiftHistoricalTiming()` (`scheduler/engine.js:501`). Once recorded, `historicalSnapshots[shiftId]` timings govern rest calculations regardless of subsequent parent Job mutations or archival (verified in `test_normal_save_snapshots.cjs` Group 1 and `test_rostering_engine.cjs` Suites 18, 22, 23). Missing snapshots on past assigned shifts fail closed (`unverifiedSchedule: true`). Gate A added fail-closed protection in normal save preventing established snapshots from being erased (`app.js:125`, F01). Series-wide descendant snapshot capture is scheduled for Gate B. | Gate B |
| **C4. Planned schedule and actual work are different concepts** | **Future Foundation Only** | The Schema v2 data model strictly stores scheduled commitments in `historicalSnapshots` and `assignments`. It does not conflate scheduled shifts with payroll completion, actual hours worked, or timesheet approvals. Architectural separation is preserved; future attendance/actuals reporting modules will build upon this foundation. | Future Foundation Only |
| **C5. Fail closed where integrity cannot be established** | **Partially Verified** | Gate A reinforced fail-closed operation: normal save aborts on malformed or dropping snapshots (`app.js:125`, F01), startup/import quarantines missing/null history with assignments into `recoveryRequired: true` preserving raw storage (`storage.js:220`, `migrationEngine.js:100`, F02), and backup export aborts on missing rostering/snapshots (`exportModal.js:20`, F03). Missing parent jobs or adjacent schedule unavailability block allocation (`INSUFFICIENT_REST`). Strict nested snapshot validator is Gate B. | Gate B |
| **C6. No speculative refactor** | **Verified** | Strictly observed. Gate A executed zero deletions of legacy code. All legacy migration branches (`P-03`, `P-04`, `P-05`, `P-06`), conversion routines, and seed files remain intact pending Gate B canonical persistence and Gate C proven isolation. | Gate A / Maintained |
| **C7. No hidden compatibility layer** | **Partially Verified** | Corrupted Schema 2 payloads and unsupported versions (`schemaVersion !== 1 && schemaVersion !== 2`) are explicitly quarantined into `recoveryRequired: true` without rollback to v1 or silent coercion (`storage.js:187, 204`). Full elimination of legacy v1 compatibility paths is scheduled for Gate C. | Gate C |
| **C8. Stable identities are permanent contracts** | **Partially Verified** | Shift IDs (`JOB_ID@YYYY-MM-DD`), employee IDs (`EMP-...`), instruction IDs (`ROSTER-...`), and provenance keys (`shiftId:empId`) use durable strings validated by `schemaValidator.js`. Gate B will conduct a complete identity contract audit across all dynamic allocation paths. | Gate B |
| **C9. Transactional writes remain mandatory** | **Partially Verified** | Direct storage writes in `saveWorkspace()` validate schema before mutating localStorage, catching storage exceptions and preserving prior bytes (`storage.js:147`). `app.saveCurrentWorkspace()` aborts on evidence loss and preserves storage. **Open Defect for Gate B:** In-memory operational mutations in `app.js` (`updateShiftStaff()`, `updatePermit()`) lack local in-memory rollback if subsequent persistence fails. Scheduled for Gate B. | Gate B |
| **C10. User-visible data integrity beats silent convenience** | **Partially Verified** | Gate A eliminated silent omission of snapshots in normal save (`app.js:125`), eliminated silent omission of rostering in backup export (`exportModal.js:20`), and quarantined corrupt persisted workspaces into `recoveryRequired: true`. Auto-save is suspended in recovery mode. Comprehensive UI recovery dialogue and user alerts will be finalized in Gate B / Gate D. | Gate B / Gate D |

---

# 5. Historical Lifecycle Architecture Proposed for Gate B [Proposed]

1. **Commitment Ownership Across Series:**
   - Manual modal allocation captures a snapshot for the single target shift.
   - Fixed and Rotation propagation must capture snapshots for source **and all generated descendant occurrences**.
2. **Rollover to Historical Evidence:**
   - As physical date rolls past shift date (`shiftDate < todayStr`), scheduled commitment becomes immutable historical evidence of planned work.
   - Planned schedule is distinct from payroll actuals; past commitments are not regenerated or rewritten when parent Job definitions change.
3. **Parent Job Archival & Retirement:**
   - Retiring or deleting a parent Job suppresses future unworked shifts, but past historical snapshots remain permanently authoritative.
4. **Missing or Unverified Evidence:**
   - Any past assigned occurrence lacking an authoritative snapshot is marked `unverifiedSchedule: true`, reports `UNVERIFIED_HISTORICAL_SCHEDULE`, and blocks subsequent adjacent assignments fail-closed (`ADJACENT_SCHEDULE_UNAVAILABLE`).
5. **No Universal 24-Hour Cap:**
   - Gate B validation will not impose arbitrary `durationHours <= 24` restrictions without verifying multi-day and overnight municipal shift policies.

---

# 6. Gate Exit Contracts & Progressive Acceptance Checklists [Proposed]

| Gate | Focus Scope | Entry Criteria | Exit & Independent Acceptance Checklist |
| :--- | :--- | :--- | :--- |
| **Gate A** (Current) | Audit correction, normal-save fix, real app lifecycle test, governance register | Conditionally endorsed sequence | 1. `app.js` saves `historicalSnapshots` fail-closed (F01).<br/>2. Startup/import quarantines missing/null history with assignments (F02).<br/>3. Backup exporter validates rostering & snapshots; import preparer rejects invalid history (F03).<br/>4. Real app lifecycle test (`test_normal_save_snapshots.cjs`) passes 100%.<br/>5. Truthful audit and governance register published.<br/>6. Minimal incremental ZIP submitted.<br/>**STOP for independent review.** |
| **Gate B** | Canonical persistence, strict validation, full historical lifecycle | Gate A independently accepted | 1. Single consolidated envelope builder.<br/>2. Strict snapshot validation (real dates, DST elapsed time, typed IDs).<br/>3. Source + Fixed/Rotation descendant snapshot capture.<br/>4. Transactional state rollback on `updateShiftStaff` and `updatePermit`.<br/>5. Prototype v2 compatibility ruling. |
| **Gate C** | Verified legacy deletion, clean client install | Gate B independently accepted | 1. Deletion of audited legacy paths (P-03, P-04, P-05, P-06, P-07).<br/>2. Seed data (12 jobs, 253 staff, 44 occs) isolated to test fixtures.<br/>3. Clean boot test: empty storage -> create Job/Staff -> assign -> save -> export -> restore.<br/>4. Preservation of static holiday/budget config and recovery paths. |
| **Gate D** | Integrated Stage 1 release verification | Gate C independently accepted | 1. Full release gate execution (`run_all_release_gates.cjs`).<br/>2. Cross-year, DST, and 10-hour rest compliance independently verified.<br/>3. Single-file build reproducibility confirmed.<br/>4. Final Stage 1 closeout report and Stage 2 handoff package. |

---

# 7. Future Extension Points (Design-Only — Zero Implementation in Gate A) [Proposed]

The following extension points are documented for Stage 3 architectural compatibility without adding code or collections in Stage 1:
- **Workforce Tags & Qualifications:** Extension hooks in `HortOpsEligibilityEngine` for skills (e.g. chainsaw, first aid) and multi-window unavailability.
- **Job Requirements Matrix:** Extension hook for required certifications beyond plant operator.
- **53-Occurrence Years & Multi-Year Successive Days:** Calendar boundary compatibility for 53-week leap years and contiguous multi-year forward planning.
- **Workforce Allocation Pools:** Tiered candidate selection algorithms (e.g. equal-opportunity rotation, seniority, overtime cost optimization).

---

# 8. Gate A Executed Changes & Verification Evidence [Developer-Implemented]

1. **Source Code Modifications:**
   - `js/app.js`: Added evidence-loss guard in `saveCurrentWorkspace()`. If live `historicalSnapshots` is `{}` or drops established records while `_allowHistoryReset` is false, save aborts (`storageStatus = 'save_failed'`), returning `false` and preserving persisted bytes (F01). Synchronized `app.state.recoveryRequired = Boolean(ws.recoveryRequired)` on `init()`.
   - `js/utils/storage.js`: In `saveWorkspace()`, ensured `envelope.historicalSnapshots = (workspace && workspace.historicalSnapshots !== undefined) ? workspace.historicalSnapshots : {}`. In `loadWorkspace()`, quarantined missing or null `historicalSnapshots` in persisted Schema 2 envelopes into `recoveryRequired: true`, preserving raw storage bytes untouched (F02).
   - `js/utils/storage/migrationEngine.js`: In `prepareWorkspaceJsonImport()`, rejected Schema 2 backups missing `historicalSnapshots` when assignments exist or when explicitly null/malformed (F02).
   - `js/components/exportModal.js`: Enforced fail-closed validation on `state.rostering` (requiring valid `instructions` and `provenance` objects) and `state.historicalSnapshots` before triggering backup download (F03).
2. **Focused Gate A Verification Suite (`scripts/test_normal_save_snapshots.cjs`):**
   - **Group 1 (Real App Lifecycle):** `HortOpsApp.saveCurrentWorkspace()` -> mutated parent Job -> reloaded via real `HortOpsApp.init()` and storage load -> verified authoritative snapshot survived and canonical eligibility rejected Sunday morning shift for `INSUFFICIENT_REST` (100% PASS).
   - **Group 2 (Negative Proof & Fail-Closed Quarantine):** Proved malformed/missing in-memory history fails closed without altering persisted bytes; proved live history set to `{}` aborts save and preserves bytes (F01); proved multi-snapshot partial loss aborts save (F01); proved fresh empty workspace saves successfully; proved persisted missing/null `historicalSnapshots` enters `recoveryRequired: true` and preserves raw bytes (F02); proved storage write exception preserves prior state (100% PASS).
   - **Group 3 (Real Exporter, Import Preparer & Restore Pipeline):** Exercised actual `HortOpsExportModal.exportBackupJson()` capturing download, negative guards blocking export on malformed rostering/snapshots, `prepareWorkspaceJsonImport()`, and `restoreWorkspaceJson()` replacing active memory and clearing boundary cache (F03) (100% PASS).
3. **Regression & Build Verification:**
   - `scripts/test_persistence.cjs`: All persistence regression tests pass 100%.
   - `scripts/test_rostering_engine.cjs`: All 26 rostering engine suites pass 100%.
   - Node.js syntax check (`node -c`) executed across all modified JavaScript files (`js/app.js`, `js/utils/storage.js`, `js/utils/storage/migrationEngine.js`, `js/components/exportModal.js`). Note: syntax checking proves parseability under Node 22, not strict ES5 grammar or cross-browser API support (F07).
   - `scripts/build_single_file.cjs`: Recompiled `index.html` and `dist/hort_ops_offline_planner.html` with byte-identical matching SHA-256 hashes.

4. **Review 10 Unified Closures (PR10):**
   - GA10-01: Enforced strict presence checks in `createWorkspaceEnvelope()` (`migrationEngine.js`), prohibiting empty fallback synthesis on incomplete raw current-v2 payloads.
   - GA10-02: Added `readVerifiedCommittedV2()` to `storage.js`; `exportBackupJson()` verifies committed baseline before allowing backup download.
   - GA10-03: `saveCurrentWorkspace()` in `app.js` fails closed if committed baseline is unreadable or malformed JSON, preventing silent byte overwrite.
   - GA10-04: Refactored `validateCurrentV2ForBoundary()` in `schemaValidator.js` to operate on a deep-cloned defensive working copy, preventing rejected mutations to caller/runtime state.
   - GA10-05: Restored and repaired canonical persistence test suite `test_persistence.cjs` (100% pass).
   - GA10-06: Purged all C0 control characters and verified source line anchors.

5. **Review 11 Prescriptive Micro-Closure (PR11):**
   - R11-01: Mandatory baseline reader `readVerifiedCommittedV2()` in `saveCurrentWorkspace()` (`app.js`) and `exportBackupJson()` (`exportModal.js`). Missing reader or unverified baseline fails closed immediately.
   - R11-02: Checked save-then-export backup semantics in `exportBackupJson()`: preflight validates live projection, saves live state via `app.saveCurrentWorkspace()`, re-reads confirmed committed bytes, and downloads newly confirmed payload.
   - R11-03: Complete validated working copy adoption in `restoreWorkspaceJson()` (`app.js`): adopts `adoptedData.budgetSettings` and `adoptedData.uiState`, eliminating post-restore caller mutation leakage into active runtime state.
   - R11-04: Added `rejectNonJsonValue()` in `schemaValidator.js` to inspect input before `JSON.stringify()`, strictly rejecting `Infinity`, `NaN`, functions, symbols, and cyclic references before cloning.
   - R11-05: Cleaned `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md`: updated Gate A row in §3 to PR11 proposed status, removed duplicate row fragment in §6, and eliminated UTF-8 mojibake.

# 9. Gate B1 Canonical V2 Persistence & Scheduled-Commitment Architecture [Developer-Implemented]

1. **Single Canonical Current-v2 Construction:**
   - Consolidated canonical workspace envelope creation through `HortOpsStorage.createWorkspaceEnvelope()`.
   - Removed the alternate fallback object literal constructor in `js/app.js:saveCurrentWorkspace()`. If the canonical constructor is missing or fails, save fails closed immediately without creating ad-hoc unvalidated envelopes.
   - Removed masking `|| {}` defaults for evidence maps in `js/components/exportModal.js:exportBackupJson()`.
   - Made `checkEvidenceKeyRetention` a mandatory dependency in `exportModal.js`; missing retention checker fails closed with zero downloads.

2. **Strict Scheduled-Commitment Validation (`validateScheduledCommitment`):**
   - Added canonical `validateScheduledCommitment(key, snapshot)` in `js/utils/storage/schemaValidator.js`:
     - Asserts key and `snapshot.shiftId` match canonical occurrence identity.
     - Validates `JOB_ID@YYYY-MM-DD` structure: prefix matches `jobId` (when supplied) and suffix is a real calendar date verified by `isRealYmd()`.
     - Validates start time using `isRealClock()` across observed production formats (`05:00 AM`, `08:00 PM`, `14:30`, `5:00`, `22:00`), rejecting impossible clocks (e.g. `25:00`, `12:60`, unparseable text).
     - Enforces positive finite `durationHours` (no unapproved universal 24-hour cap).
     - Validates `crewSize` as a positive integer when supplied.
     - Validates `assignedStaffIds` as an array of non-empty strings with strict duplicate rejection.
     - Preserves caller immutability on rejected validation by operating exclusively on defensive working copies.
