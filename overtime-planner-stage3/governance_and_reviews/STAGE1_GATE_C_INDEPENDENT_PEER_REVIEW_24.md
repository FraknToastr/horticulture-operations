# Independent Review Assessment — Horticulture Operations Overtime Planner

**Review:** Review 24 under HORT-ENG-TEST-001 v1.1  
**Date:** 28 September 2026  
**Target artifact:** `HortOps-Stage1-GateC-Full-PeerReview-PR21.zip`  
**Artifact SHA-256:** `5d68badd47b80b9715d987957eebb85e908ddfebb5c97b71ef17f3e9d823b0c3`  
**Current project gate:** Stage 1 Gate C — Seed Isolation, Clean-Slate Boot, Obsolete Deprecation & Privacy Clearance  
**Review risk class:** R3 (persistence, canonical restore, historical state, clean-start and privacy-sensitive package hygiene)

## 1. Verdict and scope

**VERDICT: NOT ACCEPTED — Gate C only.**

The core Gate C runtime changes independently reproduce successfully: deletion verification, seed-global isolation, clean-slate boot, canonical restore equivalence, Gate C tests, and B1/B2/B3 regression suites all pass on the submitted artifact. The standalone build is reproducible and byte-identical.

Gate C nevertheless remains unaccepted because its explicit privacy-clearance acceptance condition is not satisfied. The full review package contains identity-bearing historical references in seven packaged text documents, including an explicit `employee <First> <Last>` sentence. This directly contradicts the Gate C report's claim that distributed tests/reports contain no real personnel names.

A second gate-evidence issue must also be corrected: the full briefing states that the "entire test suite" is 100% passing, but independent execution demonstrates multiple failing legacy/regression suites and a blocked browser suite. Most are fixture/test-infrastructure issues rather than demonstrated runtime defects, but the evidence record must describe them truthfully.

This review does **not** authorise Gate D implementation.

## 2. Artifact integrity

| Check | Result | Evidence |
|---|---|---|
| ZIP readable/extractable | PASS | 140 files extracted successfully |
| Archive path safety | PASS | No absolute paths, traversal paths or duplicate ZIP names |
| Manifest integrity | PASS | 139 manifest entries; `sha256sum -c MANIFEST.sha256.txt` returned 0 failures |
| ZIP SHA-256 | PASS | `5d68badd47b80b9715d987957eebb85e908ddfebb5c97b71ef17f3e9d823b0c3` |
| `index.html` SHA-256 | PASS | `5ec73836ea4a2502425cec531963c05bbf4d3e450bb5b8852c430f3a8cb372a8` |
| `dist/hort_ops_offline_planner.html` parity | PASS | Same SHA-256 as `index.html` |
| Rebuild parity | PASS | `node scripts/build_single_file.cjs` exit 0; rebuilt files retain submitted hash |
| Unexpected sensitive historical references | **FAIL** | Seven packaged files contain identity-bearing historical references |

The full package includes both source and compiled distributions, governance history, prior reviews, tests and evidence. This is appropriate for the requested full peer-review milestone, but full-package privacy rules apply to **all included files**, not only runtime files.

## 3. Change and impact inventory

The submitted Gate C correction materially affects these risk surfaces:

- clean-slate workspace initialisation and empty defaults;
- removal of production reads from legacy/seed globals;
- scheduler and recovery boundaries that previously consumed seed fixtures;
- canonical workspace restore, persistence-before-adoption and rollback on write failure;
- deletion/quarantine of prototype or identifying source material;
- standalone single-file rebuilds;
- governance truthfulness and Gate C evidence;
- tests that historically relied on seeded fixtures or non-empty recovery defaults.

Directly inspected/reproduced files include `js/app.js`, `js/utils/storage.js`, `js/utils/storage/migrationEngine.js`, `js/utils/scheduler/engine.js`, Gate C/B1/B2/B3 suites, persistence/scheduler/rostering regressions, release runner, evidence reports and privacy-related package documents.

## 4. Boundary coverage matrix

| Boundary / invariant | Positive path | Negative/failure path | Reviewer verification | Result |
|---|---|---|---|---|
| Quarantined files absent | `verify_deletions.cjs` | Presence would fail | Reviewer-executed | PASS |
| Production cannot re-read seed globals | Focused R23 probe | Static prohibited-read scan | Reviewer-executed/source inspected | PASS |
| Clean empty workspace | Gate C C-02/C-03 | No seed-derived shifts/warnings | Reviewer-executed | PASS |
| Clean-slate CRUD | Gate C C-04 | Persistence contract | Reviewer-executed | PASS |
| Existing workspace preserved | Gate C C-05 | No forced reset | Reviewer-executed | PASS |
| Deprecated write boundary closed | Gate C C-06 | Deprecated call fails closed | Reviewer-executed | PASS |
| Canonical restore | Partial restore normalised/persisted | Simulated quota failure preserves prior state/bytes | Reviewer-executed | PASS |
| Historical snapshot scheduler boundary | Archived snapshot supplied through `historicalSnapshots` | No legacy global required | Reviewer-authored test | PASS |
| Unsupported/corrupt stored v2 recovery | Recovery mode, raw bytes preserved | Stale v1 not adopted | Reviewer-modified persistence test | PASS |
| Full package privacy clearance | N/A | Identity-bearing historical references must be absent | Reviewer-authored package scan | **FAIL / INTENDED RED** |
| Standalone build parity | Rebuild | Hash mismatch would fail evidence | Reviewer-executed | PASS |
| Browser runtime smoke | Headless browser | Console/runtime errors | Environment blocked: Playwright absent | BLOCKED / Gate D deferred |

## 5. Evidence ledger

Environment: Ubuntu container; Node `v22.16.0`; npm `10.9.2`. No production services or live data were used.

| Test ID | Command | Exit | Observed outcome | Classification |
|---|---|---:|---|---|
| R24-E01 | `sha256sum -c MANIFEST.sha256.txt` | 0 | All 139 manifest entries verified | PASS |
| R24-E02 | `node scripts/verify_deletions.cjs` | 0 | 3 quarantined files absent | PASS |
| R24-E03 | `node scripts/REVIEW23_FOCUSED_PROBES.cjs` | 0 | 5/5 | PASS |
| R24-E04 | `node scripts/test_gate_c.cjs` | 0 | 7/7 | PASS |
| R24-E05 | `node scripts/test_r23_restore_canonical.cjs` | 0 | Canonical equivalence + rollback | PASS |
| R24-E06 | `node scripts/test_gate_b3.cjs` | 0 | 18/18 | PASS |
| R24-E07 | `node scripts/test_gate_b2.cjs` | 0 | 100% | PASS |
| R24-E08 | `node scripts/test_gate_b1.cjs` | 0 | 100% | PASS |
| R24-E09 | `node scripts/test_static_release.cjs` | 0 | 45 JS files pass syntax audit | PASS |
| R24-E10 | `node scripts/test_scheduler.cjs` | 1 | Legacy historical fixture expectation fails at line 285 | FAIL — stale test fixture |
| R24-E11 | `node scripts/test_workforce.cjs` | 0 | 100% | PASS |
| R24-E12 | `node scripts/test_persistence.cjs` | 1 | TypeError at line 939 due `jobs[0]` on intended empty recovery | FAIL — test defect |
| R24-E13 | `node scripts/test_dependency_contracts.cjs` | 0 | 6/6 fail-closed contracts | PASS |
| R24-E14 | `node scripts/test_candidate_ordering.cjs` | 0 | 7/7 equivalence scenarios | PASS |
| R24-E15 | `node scripts/test_recovery_ui.cjs` | 0 | Recovery UI contract | PASS |
| R24-E16 | `node scripts/test_normal_save_snapshots.cjs` | 0 | Protocol/Review 10/11 suite | PASS |
| R24-E17 | `node scripts/test_rostering_engine.cjs` | 1 | Legacy `HISTORICAL_OCCURRENCES` fixture no longer authoritative | FAIL — stale test fixture |
| R24-E18 | `node scripts/test_multi_year_differential.cjs` | 0 | Differential suite passes | PASS |
| R24-E19 | `node scripts/test_rostering_lifecycle.cjs` | 1 | Test 14 incomplete current-v2 constructor fixture | KNOWN BASELINE FAILURE (FR-07) |
| R24-E20 | `node scripts/run_all_release_gates.cjs` | 1 | Stops on scheduler failure; later suites not reported | FAIL — runner evidence limitation |
| R24-E21 | `node scripts/test_browser_smoke.cjs` | 1 | `Cannot find module 'playwright'` | BLOCKED — environment/deferred Gate D evidence |
| R24-E22 | `node scripts/build_single_file.cjs` | 0 | Rebuild hash identical | PASS |
| R24-T01 | Reviewer-patched `test_persistence.cjs` | 0 | Entire persistence regression suite passes | PASS — reviewer-authored modification |
| R24-T02 | `review24_workspace_snapshot_scheduler_boundary.cjs` | 0 | Workspace snapshot preserves archived occurrence without legacy global | PASS — reviewer-authored |
| R24-T03 | `review24_package_privacy_hygiene.cjs` | 1 | 12 violations across 7 files | **INTENDED RED — verified Gate C defect** |
| R24-T04 | Reviewer-patched complete-evidence release runner | 1 | 5 pass, 3 fail, 1 blocked | PASS as runner behaviour; aggregate product state not green |

## 6. Findings

### HORT-GC-R24-F01 — Privacy clearance is incomplete

**Severity:** BLOCKER  
**Invariant/requirement:** Gate C R23-P1 and HORT-ENG-TEST-001 require no unauthorised personal information in any packaged file. Gate C's own evidence matrix states distributed tests/reports contain no real personnel names.  
**Current revision / locations:** identity-bearing references occur in seven files: `00_CHATGPT_FULL_PEER_REVIEW_BRIEFING.md`, `Antigravity-IDE Overtime Planner background.md`, `DELETIONS.txt`, `GATE_C_CHANGE_AND_EVIDENCE_REPORT.md`, `HANDOFF_GATE_C_PR21.md`, `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md`, and `governance_and_reviews/STAGE1_GATE_C_INDEPENDENT_PEER_REVIEW_22.md`. The background document also includes a direct named-employee sentence.  
**Reproduction:** reviewer test `review24_package_privacy_hygiene.cjs` reports 12 identity-bearing references across those files and exits 1.  
**Expected / actual:** expected zero; actual 12.  
**Consequence:** the full peer-review package still distributes an identifying personnel reference despite Gate C being explicitly a privacy-clearance gate.  
**Root cause:** remediation verified absence of the quarantined source file and removed literals from a shared test, but did not perform package-wide privacy scanning across governance/history documents.  
**Prescriptive correction:** replace identity-bearing filename references with a neutral identifier such as `PERSONNEL_DUPLICATE_ASSIGNMENT_INVESTIGATION.md` or a non-identifying historical-reference ID; rewrite named-employee prose generically; rebuild `MANIFEST.sha256.txt`; re-run the reviewer privacy probe. Preserve the technical root-cause history without preserving the person's identity.  
**Required regression:** R24-T03 must pass with zero hits.  
**Owner / closure gate:** Gate C corrective resubmission.

### HORT-GC-R24-F02 — Gate evidence overstates regression health

**Severity:** HIGH  
**Invariant/requirement:** truthful gate evidence; PASS/FAIL/BLOCKED/KNOWN BASELINE FAILURE must be distinguished.  
**Current revision:** `00_CHATGPT_FULL_PEER_REVIEW_BRIEFING.md` states "Entire test suite 100% PASS"; Gate C evidence similarly implies all regressions are green.  
**Reproduction:** scheduler, persistence and rostering-engine suites independently exit 1; lifecycle Test 14 exits 1 as the documented FR-07 baseline failure; browser smoke is blocked by missing Playwright. The shipped master runner stops at the first failure and therefore never reports the full state.  
**Consequence:** a reviewer relying on the briefing can infer broader green status than the artifact demonstrates.  
**Root cause:** targeted Gate C acceptance tests were conflated with the complete regression/release suite, and the master runner is fail-fast rather than evidence-complete.  
**Prescriptive correction:** amend the briefing/evidence report to list targeted Gate C green suites separately from known/test-fixture failures and blocked browser evidence. Integrate or adapt the reviewer complete-evidence runner so all suites are reported before a non-zero final exit.  
**Required regression:** master runner produces a complete summary even when one suite fails; evidence report matches exact current outputs.  
**Owner / closure gate:** Gate C evidence correction; technical Gate D blockers remain deferred.

### HORT-GC-R24-F03 — Persistence regression suite contains stale clean-slate assertions

**Severity:** MEDIUM (P1 test reliability)  
**Invariant/requirement:** recovery from invalid v2 must not adopt stale v1, while Gate C clean-slate defaults may legitimately be empty.  
**Current revision:** `scripts/test_persistence.cjs:939` and `:962` dereference `jobs[0].id`.  
**Reproduction:** current test exits with TypeError when recovery correctly returns `jobs: []`.  
**Expected / actual:** the test should assert an array and zero jobs / absence of stale v1 adoption; it instead assumes a non-empty fallback.  
**Consequence:** false regression failure obscures actual persistence health.  
**Correction:** reviewer patch replaces those dereferences with explicit clean-slate array/length assertions. The complete persistence suite then exits 0.  
**Owner / closure gate:** integrate as test-only correction before the next full regression run.

### HORT-GC-R24-F04 — Historical regression fixtures still depend on removed legacy seed globals

**Severity:** MEDIUM (P1 test reliability)  
**Invariant/requirement:** Gate C deliberately removed production dependence on seed globals; historical runtime state is workspace-owned through `historicalSnapshots`.  
**Current revision:** `test_scheduler.cjs` and `test_rostering_engine.cjs` still create or expect historical state via legacy fixture globals without supplying the supported snapshot boundary.  
**Reproduction:** both suites exit 1. Reviewer-authored R24-T02 passes when the same class of archived historical occurrence is supplied via `customSnapshots`.  
**Consequence:** legacy tests are red for the wrong reason and can mask genuine scheduler regressions.  
**Correction:** migrate those fixtures to explicit synthetic `historicalSnapshots` maps and pass them through the current scheduler/workspace boundary. Preserve assertions about immutable historical timing and archived-parent behaviour.  
**Owner / closure gate:** test maintenance before Gate D release validation.

### HORT-GC-R24-F05 — Browser release smoke not independently executable in review environment

**Severity:** LOW for Gate C / deferred Gate D evidence  
**Classification:** BLOCKED, not product failure.  
**Evidence:** `node scripts/test_browser_smoke.cjs` exits 1 because the review environment lacks the `playwright` module. `package.json` declares Playwright as a dev dependency.  
**Disposition:** retain as Gate D browser-release evidence; execute in the approved dependency environment and report exact browser/version. Do not represent as PASS in this review.

## 7. Historical blocking findings

| Historical item | Review 24 status |
|---|---|
| R23-C1 deletions reproducible | CLOSED — independently PASS |
| R23-C2 production seed-global reads | CLOSED — independently PASS |
| R23-C3 clean-slate boot/distribution | CLOSED — independently PASS |
| R23-B3 restore canonical equivalence | CLOSED — independently PASS |
| R23-P1 privacy clearance | **REOPENED / NOT CLOSED PACKAGE-WIDE** — F01 |
| R23-G1 transition register status | CLOSED as status ledger, but evidence claims need F02 correction |
| FR-02 Gregorian/recurrence validation | DEFERRED — Gate D blocker |
| FR-03 Adelaide/DST 10-hour rest | DEFERRED — Gate D blocker |
| FR-07 lifecycle Test 14 fixture | KNOWN BASELINE FAILURE — reproduced |
| FR-09 ES5 reconciliation | DEFERRED — Gate D blocker |
| Browser release smoke | DEFERRED / BLOCKED in this review environment |

## 8. Non-functional and privacy results

- **Privacy:** FAIL due F01. The issue is documentation/history leakage, not runtime seed loading.
- **Offline artifact parity:** PASS by deterministic rebuild/hash.
- **Path/archive safety:** PASS.
- **Syntax/static audit:** PASS.
- **Browser/runtime visual smoke:** BLOCKED in this environment; no claim made.
- **Security dependency failure contracts:** PASS 6/6.
- **Performance/accessibility:** not materially re-assessed in this Gate C review; no new claim made.

## 9. Test-suite health and improvement plan

Overall test depth is strong around persistence boundaries, mutation rollback and gate-specific regressions. The main weakness is **test-transition maintenance**: older suites retain assumptions from the pre-clean-slate architecture. The master runner also optimises for fast failure instead of complete review evidence.

Priority actions:

1. P0 — add package-wide privacy hygiene regression and make it a Gate C/full-package check.
2. P1 — integrate the clean-slate persistence assertion corrections.
3. P1 — migrate scheduler/rostering historical fixtures from legacy globals to `historicalSnapshots`.
4. P1 — change the aggregate release runner to execute every suite and classify PASS/FAIL/BLOCKED.
5. P1 — close the already documented lifecycle Test 14 fixture under its authorised gate.
6. P2 — remove dead legacy comments/expressions referring to a fallback that no longer exists, to reduce architectural ambiguity.

Detailed mapping is in `TEST_IMPROVEMENT_PLAN.md`.

## 10. Test changes and verification

A separate minimal `REVIEWER_TEST_PATCH.zip` is supplied. It contains no production code.

Included proposals:

- **MODIFIED:** `scripts/test_persistence.cjs` — updates two stale assertions to clean-slate semantics. Verified PASS.
- **MODIFIED:** `scripts/run_all_release_gates.cjs` — continues through all suites, reports complete status, and distinguishes missing Playwright as BLOCKED. Verified runner behaviour.
- **NEW:** `scripts/review24_package_privacy_hygiene.cjs` — package-wide structural privacy scan without embedding the person's name. Verified **INTENDED RED** on PR21 with 12 violations.
- **NEW:** `scripts/review24_workspace_snapshot_scheduler_boundary.cjs` — proves the supported workspace snapshot boundary preserves an archived historical occurrence without a legacy global. Verified PASS.

Exact hashes and commands are recorded in `TEST_PATCH_VERIFICATION.md`.

## 11. Residual risk and gate criteria

### Proven

- Gate C clean-slate runtime behaviour and targeted regressions are green.
- Restore persistence-before-adoption and write-failure rollback are green.
- B1/B2/B3 gate suites remain green.
- Submitted standalone artifacts rebuild identically.
- Workspace-owned historical snapshots can preserve an archived occurrence without relying on legacy seed globals.

### Unproven / deferred

- Browser release smoke in a Playwright-enabled environment.
- Gate D FR-02, FR-03, FR-07 and FR-09.
- Full release readiness; this review is Gate C only.

### Gate C closure criteria

Gate C can be reconsidered when a minimal corrective submission demonstrates all of the following:

1. Remove/anonymise all identity-bearing historical references in the full package, not only runtime/test source.
2. Run `review24_package_privacy_hygiene.cjs` with zero findings.
3. Correct the Gate C briefing/evidence statements so targeted green suites are not described as the entire regression suite.
4. Integrate the reviewer persistence test correction or an equivalent assertion set.
5. Re-run Gate C, R23 restore, B3, B2 and B1 suites successfully.
6. Rebuild the standalone HTML and regenerate the package manifest.

The stale scheduler/rostering fixtures should be repaired before Gate D integrated release validation; they do not, by themselves, demonstrate a Gate C runtime defect because R24-T02 independently validates the replacement workspace-owned boundary.

## 12. Next handoff — consolidated corrective instruction

Apply a **Gate C corrective-only patch**. Do not begin Gate D or unrelated feature/UI work.

- Anonymise every personnel-identifying historical reference in the full review tree, including identity-bearing investigation filenames embedded in governance/history text and any direct named-employee prose. Preserve technical meaning using neutral identifiers.
- Integrate the Review 24 package-privacy test (or demonstrably equivalent structural test) and require zero findings.
- Correct the Gate C briefing and evidence report so they distinguish targeted Gate C/B1/B2/B3 passes from stale test failures, known FR-07 baseline failure and browser BLOCKED status.
- Integrate the Review 24 persistence test correction (or equivalent) so invalid-v2 recovery asserts clean-slate empty arrays and stale-v1 non-adoption without dereferencing element zero.
- Prefer the Review 24 complete-evidence release runner behaviour: execute every suite, report each exit/status, and return non-zero after the complete summary.
- Update scheduler and rostering regression fixtures to use explicit `historicalSnapshots` rather than legacy seed globals; do not reintroduce production fallback reads.
- Re-run all Gate C closure commands, rebuild the standalone bundle, regenerate `MANIFEST.sha256.txt`, and provide a minimal corrective peer-review package.

**Stop after Gate C corrective evidence. Gate D remains unauthorised.**
