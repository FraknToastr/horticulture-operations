# Gemini 3.8 — Stage 1 Gate B3: Full-Review Findings, Focused Execution Prompt

**Project:** Horticulture Overtime Planner  
**Implementation baseline:** Accepted Gate B2, PR19; Independent Review 20; full-repository PR19 assessment  
**Current authority:** Gate A, B1 and B2 **ACCEPTED**; Gate B3 **AUTHORISED, NOT YET ACCEPTED**  
**Purpose:** Execute the existing Gate B3 transaction-hardening mandate, incorporating the applicable independently reproduced full-review defects without expanding the active roadmap.

> **This prompt supplements, rather than replaces, `GEMINI_GATE_B3_PRESCRIPTIVE_IMPLEMENTATION_PROMPT_REVIEW20.md`.** The governing `GEMINI_STAGE1_ARCHITECTURE_GOVERNANCE_RESET_DIRECTIVE.md`, current constitution, frozen I1–I12 and accepted Review 20 contracts remain authoritative. If any instruction conflicts with those sources, identify the exact conflict and submit a bounded design challenge before implementing the disputed branch. Do not silently amend governance or reinterpret an accepted gate.

## 1. Verified starting position

The independent full-repository review identified FR-01 through FR-09. Subsequently, the independent synthetic script was run inside the actual Antigravity working tree:

`Offline2-Overtime-Planner/scripts/HortOps_PR19_Independent_Synthetic_Probes.cjs`

Gemini reports reproduction of the following *actual-method* failures:

- **FR-01:** A Job whose sole dependency is a valid retained `historicalSnapshots` record can be hard-deleted, orphaning that authoritative evidence.
- **FR-02:** An impossible one-off date (`2026-02-30`) and fractional `intervalWeeks` (`1.5`) pass canonical schedule validation.
- **FR-04:** A valid accepted restore omitting optional budget/UI domains leaves old live values in memory although the committed envelope omits them.
- **FR-05:** A failed `updatePermit()` persistence attempt changes live permits while committed bytes stay unchanged.
- **Control:** Normal-save snapshot retention passes.

These are reproduced observations, **not a claim that FR-03 timezone behavior has been retested in Gemini's environment**. The prior independent review also identified FR-03, FR-06 through FR-09; those retain their separate dispositions below. Preserve the independent probe unchanged as reviewer evidence. The five findings are grouped into underlying contracts rather than treated as five unrelated patches.

## 2. Strict scope and exclusions

**Implement now, within existing Gate B3:**

1. `updatePermit()` operational atomicity.
2. `reconcileStaffSnapshot()` / `importStaffMembers()` operational atomicity and evidence-preserving workforce reconciliation.
3. `updateStaffMember()` operational atomicity and detached caller input.
4. Focused proof and correction, **only where actual tests fail**, of `saveJob()` / `deleteJob()` insertion, update, dependency detection, retirement/sealing and rollback.
5. **FR-01:** Add historical snapshot evidence to the actual `getJobDependencies()` / `deleteJob()` decision and regression tests. Preserve current fail-closed retirement policy for Jobs with active future rostering instructions.
6. **FR-04, narrowly where it intersects the existing canonical restore contract:** Establish and test complete live-state replacement for *accepted* v2 restores. Use an already-authorised, validated canonical default for omitted optional domains **only if the current v2 contract actually defines one**. Otherwise reject the incomplete backup during preflight, before storage or live-state mutation, with an actionable error. If neither behavior is established by the accepted contract, submit `DESIGN_CHALLENGE_B3.md` and pause only this branch. Do not invent product-policy defaults.
7. Correct the **active** governance transition and continuity documents to state that Gate B2 was accepted by Review 20 and B3 is in progress/pending independent acceptance. Preserve historical records.

**Do not implement now:**

- **FR-02:** Job schedule validator/recurrence semantics. Maintain as a named pre–Gate D release blocker, with one canonical validator/scheduler seam and reproducible acceptance tests assigned for separate approval. Do not opportunistically rewrite recurrence while fixing Job deletion.
- **FR-03:** Host-timezone-dependent 10-hour physical-rest calculation. Maintain as a named pre–Gate D release blocker requiring explicit South Australia roster-timezone semantics and dedicated DST tests under `Australia/Adelaide` and `UTC`. Do not make an unsupported claim that Node's local-time behavior is safe.
- **FR-06:** Prototype employee data isolation and compiled-bundle hygiene — **Gate C**. Do not place personal data or the two private roster workbooks in this incremental review package.
- **FR-07:** Repair the obsolete `test_rostering_lifecycle.cjs` test-14 fixture and actually execute its downstream tests — **Gate D**, unless a B3 change directly requires that fixture for a focused assertion.
- **FR-09:** Reconcile the ES5 declaration and holiday module syntax — record for **Gate D**; do not rewrite unrelated holiday code in B3.
- Gate C legacy/seed deletion; Stage 2 browser-storage reset; Stage 3 registries/hybrid/smart rostering; the separate Codex research; independent UI polish; speculative engine refactors.

**No active roadmap change, gate resequencing or constitutional amendment is authorised.** Do not resurrect deprecated `updateShiftStaff()` as a writer or weaken Gate B1/B2 validation to make a B3 test pass.

## 3. Mandatory bounded write-path audit before coding

Inspect the current working tree, not stale line numbers from a review document. Trace each B3 method and its direct UI callers. Produce a small table in `GATE_B3_CHANGE_AND_EVIDENCE_REPORT.md` recording:

`method | canonical domains touched | live mutation before commit? | checked return? | rollback | committed-byte effect | cache/digest/render side effects | caller alias risk | B2 evidence impact | test ID`

Verify the real storage façade, `createWorkspaceEnvelope()`, complete current-v2 boundary validator and verified committed-reader contract. Trace how a failed write is reported to the UI. Do not assume a method is unsafe merely because it uses rollback; prove gaps with failing-storage actual-method tests. Do not introduce a second canonical envelope builder or change a successful accepted B2 allocation transaction without executable evidence.

## 4. Transaction design: stage, validate, persist, then adopt

For demonstrated unsafe paths, prefer:

```text
capture existing live and committed state
  -> create detached affected-domain proposal
  -> apply requested mutation to proposal only
  -> construct the *existing* canonical full-v2 envelope
  -> validate complete proposal and B2 evidence ownership
  -> commit exactly once through existing storage API
  -> verify reported result
  -> only after success adopt detached committed domains
  -> update affected cache/digest and render
  -> report truthful success/failure to direct caller
```

A failure at any preflight or persistence point must leave **raw committed bytes, all affected live canonical domains, historical snapshots, rostering instructions/provenance, unrelated assignments, recovery state and derived state** unchanged. Do not silently reconstruct historical snapshots from mutable current Jobs or delete manually owned assignments during reconciliation. Preserve existing canonical identities. Never coerce missing/corrupt evidence to an empty map.

A small B3-only helper is permissible if it removes demonstrated duplication while retaining explicit transaction boundaries; a generic command bus, event sourcing, global state rewrite, schema migration or new undo architecture is not.

### B3-01 — Permit mutation

- Validate the target occurrence and update payload before touching live permits.
- Stage a detached `customPermits` map and preserve unrelated overrides.
- Save the complete canonical proposal once; adopt and recompute only after verified success.
- On injected `localStorage.setItem` failure, `updatePermit()` returns deterministic failure, original live permits and committed bytes remain identical, and the UI must not imply success.
- Include one positive successful-commit control, including reload.

### B3-02 — Staff import / reconciliation

- Treat the reconciliation engine's roster and assignment output as one detached proposal. Never publish only half the proposed changes.
- Prove that no historical `assignedStaffIds`, authoritative snapshots, instruction/provenance or unrelated manual allocations are silently discarded.
- If an existing reconciliation operation would revoke future assignments but cannot prove the required accepted B2 evidence delta, **fail closed** and submit a design challenge rather than deleting snapshots heuristically.
- On storage failure, original roster, assignments, snapshots, rostering, bytes, recovery/digest/cache state all remain unchanged; direct UI caller reports failure.
- On success, reload reproduces the same roster and assignment state.

### B3-03 — Individual staff updates

- Clone the containing roster and affected staff member; do not mutate `state.staffList[idx]` or retain a mutable alias to caller-owned `updatedStaff`.
- Reject unknown staff IDs, identity changes, invalid existing-contract fields and any update failing canonical validation.
- Commit before adopting; test failure rollback and successful reload.
- Do not add Stage 3 tags, qualifications or new absence-period models.

### B3-04 — Job saves, dependencies, retirement and deletion (includes FR-01)

- Run actual-method failure-injection tests before editing existing rollback code. Cover new Job, existing Job, exhausted-instruction sealing, unencumbered hard delete and active-future-instruction retirement.
- **Fix FR-01 at the ownership source:** `getJobDependencies()` must recognise retained `state.historicalSnapshots` associated with the Job, including a Job with no current assignments, permit overrides, static-history rows, instructions or provenance. Ensure the resulting normal `deleteJob()` path **does not hard-delete** the Job or leave a newly orphaned retained snapshot. If established policy allows retirement of history-only Jobs, prove that the retained Job identity and historical attribution survive commit/reload; otherwise fail closed and present the dependency truthfully.
- A Job with future active instructions remains subject to the accepted fail-closed retirement guard. Do **not** implement the previously debated one-step retirement policy without an explicit user decision.
- Test injected storage failure after dependency-aware retirement: no live retirement flag, no deletion, no changes to committed bytes or historical evidence.
- Preserve I10 whole-sequence compatibility; do not modify schedule rules as a side effect of FR-01.
- Test that post-commit mutation of caller-owned Job input cannot mutate live canonical state contrary to the accepted contract.

### B3-05 — Full restore state equivalence (FR-04, strictly bounded)

Inspect the accepted current-v2 `restoreWorkspaceJson()` and validator contracts. The independently reproduced failure is accepted storage state differing from live state because prior `budgetSettings`/`uiState` survive when omitted from an accepted restore. Enumerate *all* optional live domains with this risk; do not correct only the two sample keys if another domain has the same accepted-but-stale behavior.

For every accepted restore, the resulting live state must represent the **entire accepted canonical committed workspace**, not a merge with pre-existing workspace values. Use detached validated data for every field, and invalidate stale dependent caches only after successful persistence. An invalid or incomplete restore must leave both live state and pre-existing committed bytes unchanged. If policy for omitted optional values is unresolved, provide the exact proposed rule and affected UX in `DESIGN_CHALLENGE_B3.md` rather than guessing. Preserve validated historical/rostering evidence and the previously accepted backup/save safeguards.

## 5. Focused executable acceptance matrix

Create or update **one** portable `scripts/test_gate_b3.cjs` covering the accepted Review 20 B3-01 through B3-14 matrix, plus these bounded full-review additions:

| Test | Required result |
|---|---|
| FULL-B3-01 | A valid history-only scheduled commitment makes its Job a dependency; ordinary deletion cannot create an orphaned snapshot. Positive no-dependency deletion control. |
| FULL-B3-02 | Failing persistence during history-only retirement/deletion preserves Job, evidence, live state and exact raw storage bytes. |
| FULL-B3-03 | Reproduced FR-05 permit failure now leaves permits, bytes, cache and UI state unchanged, with truthful failure return. |
| FULL-B3-04 | Workforce reconciliation and single-member changes each prove successful atomic save/reload and failure rollback. |
| FULL-B3-05 | Existing Job edit, new Job insert, instruction sealing and hard delete each prove failure rollback without rewriting passing paths. |
| FULL-B3-06 | Accepted partial-v2 restore obeys the agreed optional-domain policy, leaves no stale live values and reloads identically; rejected restore preserves both old live state and bytes. |
| FULL-B3-07 | Each unrelated B3 mutation preserves B2 snapshots, instructions, provenance and canonical assignment identity. |
| FULL-B3-08 | Caller mutation after successful staff/Job save or restore cannot reach adopted canonical state. |

Use **synthetic** staff identifiers and Jobs. Simulate persistence failure at the actual storage boundary. Compare byte-for-byte stored state and deep live-domain equality before/after every failure, not merely the returned boolean. Assert that normal positive operations persist after reload. Preserve `HortOps_PR19_Independent_Synthetic_Probes.cjs` unchanged as independent baseline; its previously failing B3/FR-01/FR-04 cases should now report correction, while **FR-02 is expected to remain reproduced and must be explicitly labelled deferred, not concealed or recast as a B3 regression**. Do not rewrite independent assertions to manufacture a pass.

## 6. Proportionate regression and reproducibility

Run the smallest set that proves affected contracts:

```bash
node scripts/test_gate_b3.cjs
node scripts/HortOps_PR19_Independent_Synthetic_Probes.cjs
node scripts/test_gate_b2.cjs
node scripts/test_gate_b1.cjs
node scripts/test_normal_save_snapshots.cjs
node scripts/test_persistence.cjs
```

Run `test_rostering_engine.cjs` if reconciliation or changed code affects eligibility/rostering; otherwise state why not. Rebuild both standalone HTML distributions using the repository's actual build command and compare their SHA-256 hashes. Verify every incremental ZIP payload hash. **Do not claim the full 158-gate lifecycle or Playwright browser suite passed** unless the entire suite actually ran. The known lifecycle test-14 fixture and missing Playwright installation are Gate D evidence issues, not permission to mark tests green.

Do not require full Gate D release gates for this incremental B3 review. Where a test is blocked, name its exact missing dependency or obsolete fixture and the assigned follow-up.

## 7. Full-review issue ledger: retain explicit ownership

Update the evidence report with all nine findings and **do not mark a deferred issue resolved without testing it**:

| Finding | Disposition |
|---|---|
| FR-01: history-only deletion | B3, execute now |
| FR-02: invalid dates/fractional recurrence | Separate bounded validator/scheduler correction before Gate D sign-off; explicit release blocker, no B3 schedule rewrite |
| FR-03: timezone/DST 10-hour rest | Separate explicit roster-zone implementation and two-host DST verification before Gate D sign-off; release blocker |
| FR-04: accepted partial restore diverges | B3 bounded canonical restore-state equivalence, or design challenge if optional-field semantics undecided |
| FR-05: mutate before save | Existing B3 main scope |
| FR-06: private seeded staff / compiled output | Gate C isolated seed/legacy removal and distribution audit |
| FR-07: obsolete lifecycle fixture/browser smoke evidence | Gate D test fixture repair and complete browser smoke |
| FR-08: outdated governance statuses | B3 active transition register/continuity correction; preserve history |
| FR-09: ES5 claim vs holiday code | Gate D standards and build compatibility verification |

For FR-02 and FR-03, prepare short **non-implementing release-blocker acceptance notes** identifying proposed source seam, synthetic input, expected invariant and test command. Do not silently shift either issue to an indefinite backlog. Their exact implementation authorisation remains a separate decision, with **no change to the stage order**.

## 8. Governance, privacy and constitutional constraints

C1, C2, C3, C5, C6, C8, C9 and C10 already support these corrections. I7, I10, I11 and I12 remain frozen as accepted. Do not weaken them, rewrite constitutional text, reclassify older decisions as current authority or dilute lineage proof. Preserve Gate A/B1/B2 acceptance and all historical review entries.

Correct the current transition register to show **Gate B2 accepted at Independent Review 20; Gate B3 authorised, in progress and awaiting independent acceptance**. Do not claim PR20 or Gate B3 has passed before its independent review. Note the FR-02/FR-03 pre-release decision outstanding explicitly. Do not include identifiable prototype staff data or private XLSX rosters in new tests, reports or reviewer attachments; Gate C remains responsible for removing original seeded source and bundle exposure.

## 9. Deliverables and stopping rule

Submit a single uniquely named **minimal incremental peer-review ZIP**, for example:

`HortOps-Stage1-GateB3-PR20.zip`

Include **only** genuinely changed source, the focused B3 tests, rebuilt standalone HTML files where changed production source requires them, changed current governance/continuity documentation, `GATE_B3_CHANGE_AND_EVIDENCE_REPORT.md`, any necessary `DESIGN_CHALLENGE_B3.md`, and `MANIFEST.sha256.txt`. Exclude unchanged old sources, unrelated test suites, seed datasets, private rosters, copies of this prompt and redundant reviewer scripts. Do not overwrite an earlier PR archive. The evidence report must state changed paths, precise validation/transaction contracts, actual executed commands/results, unchanged-byte rollback assertions, remaining FR-02/FR-03 release blockers and all deferrals.

**STOP after submitting the B3 incremental package for focused independent review.** Do not self-authorise Gate C, Gate D, Stage 2/3 development or a constitutional amendment. If a genuine product-policy conflict arises, submit a concise `DESIGN_CHALLENGE_B3.md` with actual-method reproduction, exact authoritative contracts, two safe alternatives, rollback/evidence consequences and one explicit user decision; pause only the disputed branch.
