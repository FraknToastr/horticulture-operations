# Horticulture Overtime Planner — Stage 1 Gate C PR21 Revised Independent Peer Review 23

**Review date:** 28 September 2026  
**Reviewed archive:** `HortOps-Stage1-GateC-PR21(1).zip`  
**Archive SHA-256:** `f46dc8ac57f217efc292d0606d438db67f6067b03f83c4ac8197cb3b3ed8a08b`  
**Reconstruction basis:** complete PR19 source + PR20 overlay + revised PR21 overlay.  
**Decision:** **Gate C remains open.** The revised package fixes the PR20 nested permit alias issue and retirement success-notification ordering, and removes seed datasets from the compiled release HTML. However, several Review 22 acceptance conditions remain unmet or unproven. Gate D is not yet authorised.

## 1. Package integrity and positive results

- ZIP integrity check: pass.
- Manifest integrity: all 16 listed payload hashes match.
- `index.html` and `dist/hort_ops_offline_planner.html` are byte-identical at SHA-256 `4cddac307a12c9fa196e3509ee73690cf2acba9e5d62ae74a90adff6dcde4c24`.
- Compiled release HTML no longer contains assignments defining `INITIAL_JOBS`, `STAFF_ROSTER`, or `HISTORICAL_OCCURRENCES` seed arrays.
- `index.modular.html` imports only the public holiday data module from `js/data/`.
- Gate B3 transactional suite: 18/18 pass.
- Gate B2 suite: pass.
- Gate B1 suite: pass.
- Permit nested caller-aliasing issue from Review 22: no longer reproduced.
- Retirement false-success alert issue from Review 22: no longer reproduced.

## 2. R23-01 — BLOCKING — Incremental package does not prove or enact the required source/deletion hygiene

Reconstructing the project by applying PR20 then revised PR21 to the submitted complete PR19 source still leaves inherited files such as `User_table.csv`, `sample-overtime-source.json`, `js/data/initialJobs.js`, and `js/data/historicalOccurrences.js` in the working tree. The revised PR21 ZIP itself also still includes `js/data/staffRoster.js`.

Because ZIP overlays cannot delete inherited files, the claimed quarantine/removal cannot be independently reproduced from this package. The supplied `test_gate_c.cjs` therefore fails immediately in the reconstructed tree with:

`AssertionError: User_table.csv must not exist in distribution root`

After manually removing only that inherited CSV in an isolated review copy, the same Gate C suite passes 7/7. This proves the test logic can pass under the intended file state; it does not prove the submitted incremental package actually establishes that state.

**Required correction/evidence:** provide either a full authoritative post-Gate-C source snapshot or an explicit machine-verifiable deletion/move manifest plus a packaging method that reproduces the final tree. The final releasable tree must be demonstrably free of the quarantined development masters and obsolete seed modules.

## 3. R23-02 — BLOCKING — Production seed fallback paths remain active

The revised evidence report states that latent prototype fallbacks were purged, but source inspection shows live production references remain:

- `js/utils/storage.js` still falls back to `window.HortOpsData.INITIAL_JOBS` and `window.HortOpsData.STAFF_ROSTER`.
- `js/utils/storage/migrationEngine.js` recovery construction still falls back to the same globals.
- `js/utils/scheduler/engine.js` still reads `window.HortOpsData.HISTORICAL_OCCURRENCES` in multiple production paths.
- `js/app.js` still reads `window.HortOpsData.HISTORICAL_OCCURRENCES` for dependency logic.

The independent Review 22 runtime probe remains reproducible on the reconstructed source:

- public `HortOpsStorage.loadWorkspace()` with no explicit defaults returns **12 Jobs and 253 staff** when those legacy modules are present;
- clean `app.init()` has 0 canonical Jobs and 0 canonical staff, but the loaded legacy modules still contain 12 Jobs and 44 historical occurrences and produce 38 rendered shifts plus 6 integrity issues.

The compiled standalone release avoids this only because those data scripts are no longer embedded. That is useful, but it is not equivalent to removing the hidden production compatibility/fallback contract required by Gate C/C7.

**Required correction:** remove or test-isolate the seed globals from production source paths. Empty/default/recovery behaviour must be canonical and explicit rather than dependent on whether a legacy global happened to be loaded.

## 4. R23-03 — HIGH — FR-04 restore/reload canonical-equivalence defect remains

`restoreWorkspaceJson()` still persists `adoptedData` before supplying canonical defaults for omitted `budgetSettings` and `uiState`. The defaults are applied only to live memory after persistence.

Independent runtime reproduction on revised PR21:

- partial current-v2 restore returns success;
- live state receives canonical default budget settings;
- committed JSON still omits `budgetSettings`;
- cold `app.init()` reload returns `budgetSettings === undefined`.

This directly contradicts the claimed restore canonical-equivalence contract. The existing B3 test only confirms stale prior values are removed; it does not verify live == committed == cold reload.

**Required correction:** normalize the complete canonical envelope before `saveWorkspace()`, persist that exact detached envelope, then adopt from the committed canonical values. Alternatively, reject incomplete full-workspace backups before any write. The current product direction appears to favour normalization, but the business contract should remain explicit.

## 5. R23-04 — HIGH — Privacy-clearance claim is contradicted by the shipped test itself

`scripts/test_gate_c.cjs` contains a literal block of 18 real-person/name-or-email-fragment sentinels. The test therefore embeds identifying material inside the very package claimed to contain zero real personnel names.

Do not distribute those literals in release-facing tests or peer-review packages. Replace them with non-identifying pattern checks, confidential local-only verification, or irreversible/hash-based sentinels where appropriate.

The revised compiled HTML did pass the supplied blacklist check and does not embed the old seed arrays. That positive result should be retained.

## 6. R23-05 — MEDIUM — Governance evidence is incomplete/stale in the reproducible tree

The revised Gate C evidence report claims the governance transition register maintains Gate D blockers, but the revised PR21 ZIP does not contain an updated `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md`. The reconstructed tree therefore retains the PR20 register, which still states B3 is awaiting Independent Review 21 and Gate C is unauthorised.

The actual `STAGE1_GATE_B3_INDEPENDENT_PEER_REVIEW_21.md` was also not included or found in the supplied conversation/library sources. This does not prove the review never occurred; it means the claimed authority cannot be independently authenticated from the submitted artifacts.

**Required correction:** include the current transition register in the next package and ensure its statements match independently available review artifacts. Do not mark Gate C accepted before this review closes the remaining blockers.

## 7. R23-06 — MEDIUM — Non-transactional UI preference mutation remains

`setActiveView()` and `setYear()` still update live state before calling `saveCurrentWorkspace()` and ignore persistence failure. Review 22's injected storage-failure probe still reproduces live/committed divergence for the active view.

This is not operational roster-data loss and need not broaden the present Gate C correction if UI-state atomicity is explicitly assigned to Gate D. It must nevertheless retain a named owner before final release because Workspace export/restore includes UI state.

## 8. Existing Gate D blockers remain exactly where they were

The following are not new Gate C regressions and should not be folded into another broad rewrite:

- **FR-02:** strict Gregorian date and integer recurrence validation.
- **FR-03:** Adelaide-zone DST-safe 10-hour-rest calculation.
- **FR-07:** lifecycle test fixture modernization so the complete suite actually runs.
- **FR-09:** reconcile the declared ES5 contract with modern syntax/runtime usage.
- **Browser release smoke:** retain as final Gate D evidence.

## 9. Gate decision

**Gate B3:** the PR20 transactional methods reviewed here remain materially improved; permit aliasing and retirement alert sequencing are fixed. The FR-04 restore boundary is still open and therefore should remain an explicit pre-Gate-D corrective item unless the governing authority formally assigns it elsewhere.

**Gate C:** **NOT ACCEPTED.** The compiled distribution is significantly cleaner, but the source/reconstruction evidence still fails the clean-source/deletion contract, live fallback paths remain, the partial-restore mismatch remains, and the distributed Gate C test itself contains identifying literals.

**Gate D:** not authorised yet.

## 10. Bounded next acceptance matrix

| ID | Required evidence |
|---|---|
| R23-C1 | Full authoritative final source tree or machine-verifiable deletion manifest reproduces the intended post-Gate-C tree; `test_gate_c.cjs` passes without manual reviewer deletion. |
| R23-C2 | No production reads/defaults/recovery paths can pull `INITIAL_JOBS`, `STAFF_ROSTER`, or `HISTORICAL_OCCURRENCES`; test fixtures may live only in clearly isolated test locations. |
| R23-C3 | Real clean `app.init()` on the final source tree yields 0 Jobs, 0 staff, 0 inherited shifts and 0 seed-derived warnings. |
| R23-B3 | Accepted partial restore persists canonical defaults before adoption; live, verified committed bytes, cold reload and subsequent export agree. |
| R23-P1 | Distributed tests/reports contain no real personnel names, email fragments or raw roster masters; confidential local privacy checks remain outside shared artifacts. |
| R23-G1 | Current governance transition register is included and accurately records accepted/open gates and remaining Gate D blockers. |
| R23-REG | B3 18/18, B2, B1, relevant Gate C tests and focused Review 22/23 probes remain green. |

**Stopping rule:** make one bounded Gate C/restore correction package, then stop for independent review. Do not begin Gate D, Stage 2, Stage 3 smart rostering, registry expansion or unrelated UI work.
