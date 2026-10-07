# Horticulture Overtime Planner — Stage 1 Gate B1 Independent Peer Review 15

**Package:** `HortOps-Stage1-GateB1-PR14.zip`  
**Package SHA-256:** `822330d3f91d6536d68e9f6f67d6fc12c7ee1abd123f1ba292c97a038c2d2230`  
**Prior baseline:** `HortOps-Stage1-GateB1-PR13.zip`, SHA-256 `0840b242f3dd281c12b7eb43ded0dbaa10060996d8e7552ac48a6d4363ad0a65`  
**Independent status:** **Gate A remains accepted; Gate B1 requires one bounded canonical-assignment correction and test-evidence reconciliation.** Gate B2/B3 and legacy deletion remain unauthorised.

## 1. Decision and closed findings

PR14 closes **all three explicit Review 14 code findings in their submitted test scenarios**. This is verified, not inferred from Gemini's report:

- **B1-14-01:** Missing/null `assignments`, malformed arrays and duplicate staff IDs are rejected through the eleven supplied Review 14 checks.
- **B1-14-02:** Snapshot `recordType` cannot exploit inherited object properties; prototype-shaped staff IDs no longer produce false duplicate errors.
- **B1-14-03:** Null or non-object Job/Workforce entries return normal validation errors instead of throwing.

The PR14 ZIP has eight members, every manifest entry passes SHA-256 verification, and both standalone HTML files match. The reconstructed complete source—Offline17.5j plus successive Stage 1 packages through PR14—rebuilds byte-for-byte to the distributed HTML hash `428c3d7ca204230f6c40a162dedbf8ac535118cb055418c764ef2798762cdfd3`.

### Independently executed checks

| Check | Result | Meaning |
|---|---|---|
| Review 13 discriminators | 6/6 pass | Previously accepted cases retained. |
| Review 14 discriminators | 11/11 pass | All explicit Review 14 corrections demonstrated. |
| Gate B1 focused suite | 9/9 groups pass | Existing focused suite retained, but lacked the alias/round-trip discriminator below. |
| Gate A normal-save suite | Pass | The current correction has not broken Gate A normal-save safeguards. |
| Scheduler, Workforce | Pass | Directly executed; no new failure seen. |
| Persistence suite supplied by accepted package chain | **Fails** at a negative-fixture assertion | Missing `assignments` now prevents reaching the intended `anchorDate` validation. |
| Rostering Engine (26 groups) supplied by accepted package chain | **Fails in group 26** | A supposedly current-v2 persisted fixture supplies only `customAssignments`; it now saves successfully but cannot be reloaded. |
| Rostering Lifecycle (158-gate suite) | Fails before the PR14 change, including on reconstructed PR13 | Pre-existing incomplete current-v2 fixture; separately record for later test-fixture alignment, not an invented PR14 code regression. |

**Evidence caveat:** Gemini's report claims the Persistence suite and all 26 Rostering Engine groups passed in its local checkout. They do not pass from the submitted source-and-test package chain. The developer must reconcile that difference; no allegation is made about the unseen local working tree.

## 2. B1-15-01 — Blocking to B1 acceptance: runtime assignment alias accepted as persisted current-v2

**One shared root cause, not three additional unrelated defects.** `validateCurrentV2Presence()` in `js/utils/storage/schemaValidator.js:880–888` accepts *either* `assignments` *or* `customAssignments` without distinguishing the canonical persisted envelope from the live runtime state. `validateWorkspaceSchema()` repeats the fallback at lines 369–370. However, the canonical constructor `js/utils/storage/migrationEngine.js:67–85` only copies `assignments` into a saved envelope. The actual app uses `state.customAssignments` and explicitly projects it to `assignments` in `js/app.js:146–151`.

This creates contradictory contracts at the same public boundary:

| Entry point | Alias-only current-v2 input (`customAssignments` present; `assignments` absent) |
|---|---|
| `validateCurrentV2ForBoundary()` | **Returns valid**, incorrectly treating a runtime projection as a canonical envelope. |
| `HortOpsStorage.saveWorkspace()` | **Returns `ok:true`** and writes that non-canonical object, potentially replacing earlier valid storage bytes. |
| `HortOpsStorage.loadWorkspace()` | **Returns `recoveryRequired:true`**: the later canonical constructor discards the alias and then detects missing `assignments`. |
| `createWorkspaceEnvelope()` | Rejects the same alias-only object. |

**Independent reproduction:** a canonical workspace containing `JOB-REVIEW@2027-01-02 → EMP-01` was saved. A second current-v2 object with only `customAssignments` assigned the shift to `EMP-02`. `saveWorkspace()` returned success and overwrote storage; immediate reload entered recovery instead of returning the newly saved allocation. This is not merely a mismatch in wording; it is a successful write of an object the application itself cannot reload.

**Second expression of the same root cause:** if both `assignments` and `customAssignments` exist and disagree, boundary validation and direct save currently accept both. The constructor later silently selects `assignments` and discards `customAssignments`. No general-purpose merge or implicit precedence is acceptable for a canonical current-v2 envelope.

**Five-scenario independent discriminator:** `scripts/reproduce_b1_review15.cjs` produced **2/5 pass and 3/5 fail** on submitted PR14. The failures are alias-only boundary acceptance, alias-only direct-save overwrite and contradictory dual-map acceptance. The two passing controls verify canonical assignment round-trip and canonical JSON import.

### Prescriptive correction, restricted to this source owner

Make `validateCurrentV2Presence(input, options)` distinguish *explicitly declared* `runtime_state` from the default **canonical envelope**. Only `HortOpsApp.saveCurrentWorkspace()` may select the runtime-state mode for its preflight `this.state` check. Every public storage, constructor, verified-read, import, export, restore and evidence-retention call continues using the strict default canonical contract. Require `assignments` in that default mode and reject `customAssignments` as a second persisted source. Do **not** remove the internal runtime field or force `app.state` to adopt the persisted field name in this microclosure. Retain compatibility for direct `validateWorkspaceSchema()` on in-memory test/migration objects as appropriate; the *public current-v2 boundary* is where canonical form must be enforced.

The accompanying Gemini prompt provides tested ES5 reference code. In a **reviewer-only prototype** applying that change to `schemaValidator.js` and the single `app.js` preflight call, Review 13 (6/6), Review 14 (11/11), Review 15 (5/5), Gate B1 (9/9), Gate A normal-save and the Rostering Engine (with its group-26 fixture corrected) all pass. **This prototype is not included as a replacement app or claimed as submitted production code.**

## 3. B1-15-02 — Test evidence reconciliation, no second architecture redesign

Strict mandatory `assignments` checking is correct. Several earlier tests were authored when alias-only or missing-assignment Schema v2 fixtures could pass validation. They now fail *earlier* than the condition they intend to test. Do not weaken the validator to accommodate these test mistakes.

- In `scripts/test_persistence.cjs`, explicitly add `assignments: {}` to current-v2 fixtures designed to test an unrelated error such as an invalid `anchorDate`, unsupported weekday or duplicate staff ID. **Do not add it** to tests intentionally proving that missing assignments are rejected. Preserve each negative test's targeted expected error.
- In `scripts/test_rostering_engine.cjs`, group 26's `validEnvelope` represents persisted data yet contains `customAssignments: pr5Assignments` instead of canonical `assignments: pr5Assignments`. Correct the **single fixture**, not all runtime-domain `customAssignments` uses in the test suite. The independently corrected fixture restores all 26 groups to green without modifying rostering production code.
- Ask Gemini to identify whether its reported green Persistence/Rostering runs used later local test edits that were not included in the incremental ZIP. Supply only genuinely modified test files if so. Record the exact independently reproducible commands and results.

The Rostering Lifecycle suite has a pre-existing PR13-era fixture that calls the canonical constructor without `schemaVersion:2`; both reconstructed PR13 and PR14 fail at the same site (`test_rostering_lifecycle.cjs` around line 466). This is an existing release-suite maintenance item, not a newly discovered PR14 failure. Record it in the verification debt register for the relevant integrated/release gate. Do not expand this microclosure into a broad lifecycle rewrite.

## 4. Eight-boundary acceptance matrix for **this one owner**

| Boundary | Required distinction / observed check |
|---|---|
| 1. Constructor | Only canonical `assignments` accepted; alias-only and contradictory dual-source current-v2 rejected. |
| 2. Direct save | Reject those inputs *before writing*; preserve previous raw bytes exactly. |
| 3. Real app save | Runtime `state.customAssignments` passes **explicit runtime preflight** and is projected once to canonical `assignments`; normal save and rest-related historical evidence remain intact. |
| 4. JSON backup | Produces canonical assignments from live state; no additional alias in downloaded payload; existing save-then-export contract preserved. |
| 5. Verified read/startup | The storage-key payload is strictly canonical. Alias-only previously saved data enters recovery without overwriting raw bytes. |
| 6. JSON import/restore | Alias-only and conflicting current-v2 payloads are rejected without mutating active state or storage; genuinely canonical imports remain valid. |
| 7. Snapshot validation | Review 13 and 14 cases remain green; no historical-evidence semantics changed. |
| 8. Bad entities | Null Job and Workforce records still return normal validation failures. |

**Do not broaden** this correction into historical-snapshot ownership (Gate B2), transaction architecture (B3), legacy migration removal (Gate C), seeded-data removal (Gate C), or Stage 2 reset/UI work.

## 5. Review protocol applied and next decision

The independent assessment did not reopen the 11 previously closed Review 14 probes or order the full release suite. It compared the exact schema-owner change to its canonical representation contract, traced its one mismatch through the public boundaries, and checked pre-existing regression-suite compatibility. The remaining work is **one bounded source contract and its required test fixtures**, not another expanding architecture audit.

**Decision:** Gate B1 is **not yet accepted**. Authorise one targeted correction implementing the single canonical-vs-runtime distinction; stop for one focused independent review. Gate A remains accepted. Gate B2/B3 and legacy deletion remain on hold pending subsequent authorisation.
