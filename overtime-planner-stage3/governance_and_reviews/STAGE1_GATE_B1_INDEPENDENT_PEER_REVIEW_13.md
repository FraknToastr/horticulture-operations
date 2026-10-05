# Horticulture Overtime Planner — Stage 1 Gate B1, Independent Peer Review 13

**Package:** `HortOps-Stage1-GateB1-PR12.zip`  
**Baseline:** independently accepted Gate A PR11, Review 12, overlaid on the preceding incremental source lineage  
**Date:** 25 September 2026  
**Authority:** Stage 1 governance reset (C1–C10), frozen rostering invariants I1–I12, Peer Review Protocol v2, and `GEMINI_GATE_B1_PRESCRIPTIVE_IMPLEMENTATION_PROMPT.md`  
**Decision:** **B1 NOT ACCEPTED — three directly related B1 contract gaps.** Gate A acceptance remains intact. Do not start B2, B3 or C.

## 1. Executive assessment

Gemini has made genuine progress. PR12 removes the application save fallback builder; its exporter now supplies evidence maps explicitly and requires the retention validator; the scheduled-commitment validator rejects many invalid dates, times, identities and numeric values. The PR12 archive passed CRC and all 10 entries in its SHA-256 manifest. Its rebuilt `index.html` and `dist/hort_ops_offline_planner.html` match each other **and** the submitted versions (SHA-256 `202c16e6c3258233e996e7b3f979766fcada612a758ef2f62d1a97db0c0970da`).

Reconstructed baseline and scope-limited test results:

| Verification | Independent result |
|---|---|
| Gate B1 suite, with only the two developer-specific absolute file paths replaced in a local test copy | **7/7 PASS** |
| Previous Gate A focused normal-save/persistence tests | **PASS** |
| Existing Persistence regression | **PASS** |
| Rostering Engine regression (schema-consuming, 26 groups) | **PASS** |
| Node syntax checks of three modified production JavaScript files | **PASS** |
| Standalone build reproducibility and distributed-file SHA equality | **PASS** |
| Unmodified submitted B1 test executed outside the developer's WSL path | **FAIL**, hard-coded absolute paths in assertion 7 |
| Independent B1 adversarial reproduction script | **0/6 secure-behaviour assertions pass** on the submitted revision |

This is **not** a recurrence of the accepted Gate A defects. PR12's new canonical-builder and snapshot-validator work is incomplete. The next prompt consolidates the three technical causes into one bounded B1 correction, and expressly excludes B2 snapshot capture/ownership work.

## 2. Submitted change inventory

Changed production files, relative to PR11: `js/app.js`, `js/components/exportModal.js`, `js/utils/storage/schemaValidator.js`. New suite: `scripts/test_gate_b1.cjs`. Both rebuilt HTML distributions and the active architecture/governance/continuity documents were supplied, together with the developer evidence report and checksum manifest. **No legacy deletion or B2 mutation-lifecycle implementation was observed.**

The public constructor's actual implementation remains in **unchanged** `js/utils/storage/migrationEngine.js`. Reviewing this live dependency was essential to evaluate the claimed single canonical path; its omission from the delta ZIP is correct because it was not modified. The before-edit caller matrix documents several methods imprecisely; see Finding B1-04.

## 3. Eight-boundary contract assessment

| Boundary | Status and evidence | B1 conclusion |
|---|---|---|
| First-run construction | Existing fresh constructor explicitly supplies both evidence maps; validated fresh-empty round trip works. Its call into `createWorkspaceEnvelope()` still supplies an implicit schema version and relies on a permissive builder. | **Partially verified:** fresh scenario works, construction contract remains noncanonical. |
| Actual app `saveCurrentWorkspace()` | Fallback local literal removed; ordinary positive save passes. **Independently reproduced** `state.jobs = null` followed by successful save that replaces previously persisted job with zero jobs. | **Fails B1-01.** |
| Direct `saveWorkspace()` | Requires `validateCurrentV2ForBoundary()`; independently rejects the same raw `jobs: null`. Rejects tested bad dates, clocks, identity mismatches and nonfinite durations. Accepts the still-permitted malformed fields in B1-02/03. | **Partially verified.** |
| `loadWorkspace()` | Existing current-v2 missing-evidence quarantine still passes. It invokes the same snapshot validator when loading successfully; malicious semantic variants are accepted. | **Partially verified, shared validator gap.** |
| JSON import preparation | Public `prepareWorkspaceJsonImport()` preserves recognized v1 migration. For current-v2 it uses presence plus full schema validation, but that schema still permits B1-02/03 semantic variants. | **Partially verified, shared validator gap.** |
| Actual app `restoreWorkspaceJson()` | Focused tests prove malformed recognized data cannot mutate storage or active state and valid restored data is detached. Variants accepted by the common schema still pass. | **Partially verified, shared validator gap.** |
| `exportBackupJson()` | Mandatory retention checker and checked save–verified reread–download sequence independently pass the focused suite. Distinct live projection remains rather than calling the canonical constructor; it is validated before saving but duplicates construction logic. | **Functional for tested data; architecture consolidation incomplete.** |
| `checkEvidenceKeyRetention()` | Existing safeguard still present for historical snapshot, instruction and provenance keys; the original B1 test checks unavailability, not live identity deletion, while the existing Gate A suite covers identity loss. Authorised key removal remains explicitly B2/B3 policy work. | **Verified for Gate B1's required existing contract.** |

A pass at one public entry point does **not** establish that malformed input is rejected at another. Likewise, genuine current-v2 repairs cannot be achieved by synthesising missing Jobs, Workforce or evidence maps from `null` input.

## 4. Findings, severity and operational effects

### B1-01 — BLOCKING: the supposedly canonical constructor still silently converts corrupted current-v2 operational data to empty data

**Root cause:** `js/utils/storage/migrationEngine.js` `createWorkspaceEnvelope()` checks only `validateCurrentV2Presence()` (the historical and rostering map presence test) and then defaults `jobs`, `roster`, `assignments`, `permits`, `budgetSettings` and `uiState` to empty containers for malformed input. PR12's `js/app.js` now calls this constructor unconditionally, so removing the local fallback exposes the remaining fallback inside the canonical constructor.

**Reproduced, using real public methods:** Save a valid workspace containing one Job. Initialise `HortOpsApp`; unexpectedly set `app.state.jobs = null`; call actual `saveCurrentWorkspace()`. It **returns true** and the previously persisted one-Job workspace becomes a zero-Job workspace. Direct `saveWorkspace()` of the same raw `jobs: null` rejects it, but passing it through `createWorkspaceEnvelope()` produces `jobs: []` that direct save then accepts. No historical-snapshot key is needed to trigger this loss, so the Gate A retention guards do not prevent it.

**Expected:** The public current-v2 constructor rejects incomplete/malformed current-v2 input **before** any default materialisation. Only a distinct, deliberately invoked fresh-workspace path and the still-supported recognized v1 migration may explicitly create empty maps. No mutation of live state or persisted bytes on rejection. The actual current `loadWorkspace()` first-run call must explicitly supply `schemaVersion: 2` if the strict builder requires it. Review and minimally adapt v1 construction calls before deleting existing defaults. **Do not delete v1 code in B1.**

**Required affected files:** `migrationEngine.js` (constructor), `storage.js` (first-run and any recognized migration adapter as needed), `app.js` (retain fail-closed mandatory constructor), `exportModal.js` (share canonical runtime projection where source-grounded). Add **one** production-current-v2 constructor and make the validator the only schema authority; do not add a second standalone builder in export or the app. Follow the exact caller inventory in the corrective prompt.

### B1-02 — HIGH: snapshot-validation semantics remain permissive despite 'strict' schema claim

**Root cause:** `schemaValidator.js` `validateScheduledCommitment()` checks the optional `assignedStaffIds` and `crewSize` fields only when they are neither `undefined` **nor `null`**, accepting an explicitly null value on a verified scheduled commitment. It also accepts **any** non-empty `recordType` string (for example `banana`). These differ from a truly absent optional field and do not establish the semantic class of supposed authoritative scheduling evidence.

**Reproduced:** Complete current-v2 candidates with a verified, correctly keyed snapshot, but `assignedStaffIds: null`, `crewSize: null` or `recordType: 'banana'`, each passed `validateCurrentV2ForBoundary()`. Previously saved bytes would be replaced if such a candidate were written.

**Expected:** Presence-sensitive validation for explicitly supplied optional fields, using `Object.prototype.hasOwnProperty.call(...)`; null is not an acceptable array or positive crew size on a verified commitment. Inventory actual known `recordType` values before imposing an allow-list: production producer emits `scheduled_commitment`; older project tests include `historical` as a recorded tag. Preserve **documented legitimate** variants rather than mischaracterising a historical *scheduled* snapshot as confirmed actual attendance. Unknown types must not acquire authoritative status by virtue of a nonempty string. Do not invent a new actual-work schema in B1.

### B1-03 — HIGH: a stored record labelled unverified can be accepted and then treated as authoritative

**Root cause:** The new validator specifically accepts `unverifiedSchedule: true` and permits well-formed start/duration values alongside it. The existing `HortOpsSchedulerEngine.resolveShiftHistoricalTiming()` considers any matching snapshot with parseable time and non-null duration `found: true` but does not inspect `unverifiedSchedule`. Therefore 'unverified' evidence is silently promoted to verified scheduling evidence.

**Reproduced:** A full current-v2 workspace containing `{ unverifiedSchedule: true, startTime: '08:00 PM', durationHours: 8, ... }` passes boundary validation. The real scheduler resolver then reports `found: true` for this same record. This undermines the stated 'fail closed on unverified historical timing' contract.

**B1-specific prescription:** Audit actual snapshot producers and stored fixtures. The current production modal writes `recordType: 'scheduled_commitment'` without a persisted `unverifiedSchedule` flag; the scheduler already creates **runtime-only** unverified shifts when authoritative timing is missing. If the flag is indeed runtime-only, reject it in persisted authoritative snapshot records, rather than creating a new partially supported persistent class in B1. If Gemini identifies real retained workspaces containing intentional persisted unverified entries, issue a `DESIGN_CHALLENGE_B1.md` with that evidence before changing the representation. Any approved durable unverified class must be honoured by the scheduler resolver and the eligibility engine, never accepted and then treated as verified.

### B1-04 — MEDIUM, review-evidence correctness: nonportable suite and inaccurate method labels

The newly submitted `scripts/test_gate_b1.cjs` hardcodes `/home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/` twice for its final build assertion; its unmodified copy fails outside that absolute path although an otherwise identical locally adapted copy passes all seven assertions. Derive paths from `path.resolve(__dirname, '..')` and `path.join()`.

The supplied 'eight-boundary' evidence table refers to `HortOpsStorage.restoreWorkspace()` and `HortOpsImportModal.importBackupJson()`, neither of which is exposed by the inspected source. The real relevant methods are `HortOpsApp.restoreWorkspaceJson()`, `HortOpsImportModal.processJsonContent()` / `confirmJsonRestore()`, and the public storage `prepareWorkspaceJsonImport()` / `importWorkspaceJson()`. Its sequence description for export also incorrectly places checked saving **before** the first baseline read and identity-retention check; source actually prevalidates and checks the committed baseline *before* the checked save, then rereads the committed result before download. Correct the documentation to match the code; no additional application feature is authorised by this correction.

Also, the governance register still begins with a 'starter register / do not describe as Gate A approval' header despite later correctly recording Review 12 Gate A acceptance. Keep exactly one current status and preserve historic review entries separately.

## 5. Exact old-finding accounting and scoped deferrals

- **Gate A Review 11:** Accepted under Review 12; not reopened. Baseline-reader rejection, live-edits-in-backup, detached successful restore and non-JSON preflight still pass.
- **Gate B1 requested constructor unification:** **Partial** — removal of `app.js` fallback succeeded, but the remaining facade target still defaults malformed current-v2 data. `exportModal.js` still manually projects live state.
- **Gate B1 requested strict authoritative snapshot validation:** **Partial** — real date, clock, identity, duration and duplication protections pass; supplied-but-null fields, unbounded `recordType` and unverified semantics remain.
- **Gate B1 requested evidence-retention check:** **Satisfied for existing B1 scope.** Do not impose immutable rostering-key checks on ordinary instruction edits before the B2/B3 authorised-operation policy is designed.
- **Gate B2:** all committed Fixed/Rotation descendants, historical snapshot ownership, cancellation/retirement and archived-job semantics — **deferred**.
- **Gate B3:** atomic mutation rollback for all operational write paths — **deferred**.
- **Gate C:** legacy deletion, production seed removal, clean empty client bootstrap — **prohibited now**.

## 6. B1 corrective acceptance and test budget

One focused incremental correction is required, **not another general audit**. The included portable reproduction script proves the three root findings (six discriminating assertions). Gemini should extend `scripts/test_gate_b1.cjs` with these cases and fix its two absolute paths. Re-run that suite, Persistence, and the 26 Rostering Engine groups **only if** the changed snapshot-validator contract affects their documented fixtures; the snapshot validator does change, so one Rostering Engine run at closure is justified. Rebuild the two standalone HTML files and verify byte equality against the submitted distribution. No complete release suite, unrelated UI suite, scheduler differential or speculative field extension.

Specific acceptance: (a) malformed current-v2 constructor input cannot silently erase any domain; (b) valid deliberate-empty v2 and recognized v1 continue working; (c) all six new discriminating assertions pass; (d) recognized production snapshot format and any source-verified historical variants still round-trip; (e) corrupted inputs leave original storage bytes and rejected restore state unchanged; (f) governance and test paths are accurate; (g) ZIP includes only genuinely changed files and manifest; (h) Gemini stops for independent B1 closure review.

**Next gate decision:** Gate B1 remains open. Once this bounded correction is accepted, Gate B2 may be proposed separately. Gate A remains formally accepted throughout.
