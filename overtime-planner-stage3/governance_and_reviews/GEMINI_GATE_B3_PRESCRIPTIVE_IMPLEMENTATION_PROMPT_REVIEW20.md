# Gemini 3.8 — Stage 1 Gate B3 Prescriptive Implementation Prompt after Independent Review 20

## Authority and scope

Independent Review 20 **accepts Gate B2**. Continue from the actual PR19 governed workspace. Preserve accepted Gate A, B1 and B2 behavior and evidence.

This prompt authorises **Gate B3 only: broader operational mutation atomicity and rollback outside the accepted B2 allocation transaction**.

Do **not** begin Gate C, remove legacy/migration/seed code, implement Stage 2 reset/onboarding, implement Stage 3 registries/smart rostering, adopt the separate Codex smart-rostering research, redesign UI, or reopen accepted B2 planner contracts without contrary executable evidence.

The governing requirement is Constitution C9 plus frozen Invariant I11: an operational mutation must either commit a complete valid proposed workspace or leave both live operational state and committed bytes unchanged.

---

## 1. Start with a bounded write-path audit, not a refactor

Read `js/app.js` and the direct UI callers of the methods below. Record for each path:

```text
method
canonical domains changed
whether it mutates live state before save
whether save result is checked
rollback coverage
cache/digest/render side effects
caller-owned object aliasing risk
existing validation/eligibility consequences
```

Mandatory B3 targets observed in PR19:

1. `HortOpsApp.updatePermit()`
2. `HortOpsApp.reconcileStaffSnapshot()` / `importStaffMembers()`
3. `HortOpsApp.updateStaffMember()`
4. `HortOpsApp.saveJob()`
5. `HortOpsApp.deleteJob()`

`HortOpsApp.updateShiftStaff()` is intentionally deprecated and fail-closed after B2. **Do not restore it as a writer.**

Do not automatically pull `setActiveView()` or `setYear()` into the operational transaction redesign. They are UI-state changes; include them only if a concrete failure path can corrupt operational canonical state.

Before editing, create a short B3 transaction matrix in the Gate B3 evidence report and identify which methods are demonstrably unsafe versus already adequately guarded.

---

## 2. Preferred architecture — stage complete proposed state before commit

Where practical, do not mutate `HortOpsApp.state` and then attempt to undo pieces.

Preferred sequence:

```text
read current live domains
→ clone only affected canonical domains
→ apply requested mutation to detached proposal
→ construct one canonical current-v2 envelope
→ validate full proposal
→ persist once through existing storage facade
→ only on successful verified commit adopt proposed live domains
→ invalidate/recompute affected derived state
→ render
```

Use the accepted B1 canonical constructor/validator rather than inventing a second envelope builder. Preserve B2 `historicalSnapshots`, `rostering.instructions`, `rostering.provenance` and canonical `assignments` exactly unless the operation is explicitly authorised to change them.

If an existing method already has correct and complete rollback, you may retain it, but prove it with a failing-storage actual-method test. Do not rewrite stable code merely to make every method look identical.

No generic `skipValidation`, `force`, `unsafe`, or “best effort” write switch.

---

## 3. B3-01 — `updatePermit()` must become atomic

Current PR19 behavior mutates `state.customPermits` in place and then calls `saveCurrentWorkspace()` without checking the result.

Required contract:

- invalid `shiftOrOccurrenceId` / malformed update input fails without mutation;
- create a detached permits proposal;
- preserve every unrelated permit override;
- commit through the canonical workspace path;
- if persistence fails, original `state.customPermits`, committed storage bytes, digest/cache state and rendered operational state remain unchanged;
- only after successful persistence adopt the new permits map, recompute and render;
- return a deterministic success/failure result to the caller.

Do not use permit editing as a reason to modify scheduler policy.

Mandatory negative test: simulated storage failure after a proposed permit change proves byte-for-byte persisted workspace equality and deep equality of the live permits map to its pre-call value.

---

## 4. B3-02 — workforce reconciliation must commit roster + assignments atomically

Current `reconcileStaffSnapshot()` assigns both `result.reconciledRoster` and `result.reconciledAssignments` to live state before saving, then ignores the save result.

Required contract:

- call the existing reconciliation engine on current state;
- treat its output as a detached proposal;
- preserve canonical rostering and historical commitment evidence;
- validate the full proposed workspace before persistence;
- if reconciliation proposes assignment changes that conflict with B2 evidence ownership, **fail closed** rather than deleting/reconstructing snapshots heuristically;
- persist once;
- adopt roster and assignments only on success;
- on failure retain original staff list, assignments, historical snapshots, rostering, committed bytes, cache/digest state and recovery state;
- return an explicit result so import/reconciliation UI can report failure truthfully.

Do not silently remove past staff from historical commitment `assignedStaffIds`. Departed/inactive status affects future eligibility, not historical truth.

If the existing reconciliation engine can remove future assignments without producing sufficient B2 evidence-delta proof, do not patch around it. Submit a focused `DESIGN_CHALLENGE_B3.md` describing the exact conflict and two safe options.

---

## 5. B3-03 — `updateStaffMember()` must not mutate a live staff object before commit

Current code writes fields directly into `this.state.staffList[idx]` before persistence and ignores save failure.

Required contract:

- verify the staff ID exists;
- clone the roster (or affected staff object plus containing array) before applying updates;
- prevent caller-owned `updatedStaff` from becoming a live mutable alias;
- preserve immutable identity (`id`) and reject an update that attempts to change identity;
- validate values needed by existing eligibility contracts;
- save canonical proposal once;
- adopt only on successful commit;
- failing storage leaves staff record, assignments, snapshots, rostering and bytes unchanged;
- return deterministic `{ success, error? }` or equivalent and update direct callers accordingly.

Do not add future Stage 3 qualifications, tags, multiple absence periods or smart-roster metadata in B3.

---

## 6. B3-04 — prove Job mutation atomicity; change only what fails proof

`saveJob()` and `deleteJob()` already contain rollback logic and recurrence compatibility guards. Do not assume they are broken and do not broadly rewrite them.

Test the actual methods for at least:

1. existing Job edit + storage failure;
2. new Job insertion + storage failure;
3. exhausted-instruction sealing + storage failure;
4. hard-delete with zero dependencies + storage failure;
5. retirement request with dependencies and active future instruction guard;
6. caller mutates `jobData` after successful save — live canonical Job must not become unintentionally aliased if the accepted data contract requires detachment;
7. validation failure before persistence causes zero live mutation;
8. relevant digest/cache state is not left representing an uncommitted proposal.

If the existing implementation passes a scenario, document and preserve it. Patch only reproduced gaps.

### Job retirement policy

Review 19/20 preserves the current interim rule: a Job with active future rostering instructions fails closed until those instructions are explicitly ended/sealed under supported rules.

B3 may **analyse** the alternative one-step transactional retirement requested in `DESIGN_CHALLENGE_B2.md`, but do not implement it merely because B3 covers Job transactions. If product behavior needs to change, prepare a short `DESIGN_CHALLENGE_B3.md` for user decision containing:

- current exact behavior;
- proposed one-step behavior;
- treatment of future assignments, snapshots, instructions and provenance;
- protection of historical evidence;
- rollback semantics;
- UI consequence;
- test matrix.

Absent explicit user approval, retain the current fail-closed policy.

---

## 7. Canonical transaction helper — optional, not mandatory

A small internal helper may be justified if and only if it reduces repeated transaction mistakes across the demonstrated B3 write paths.

Any helper must remain narrow and explicit. A reasonable shape is:

```javascript
stage canonical proposal
validate proposal
persist proposal
return detached committed domains
```

Do not build a generic command framework, event-sourcing layer, state-management library, undo system or application-wide rewrite.

If a helper would materially increase scope or make B2 allocation persistence harder to reason about, keep the B3 fixes method-local instead.

---

## 8. Mandatory B3 acceptance matrix

Create one focused `scripts/test_gate_b3.cjs`. It must use actual application methods where possible and include at minimum:

```text
B3-01 permit successful commit
B3-02 permit storage failure = zero live/persisted change
B3-03 staff-member successful update
B3-04 staff-member storage failure = zero live/persisted change
B3-05 workforce reconciliation successful atomic commit
B3-06 workforce reconciliation storage failure = zero live/persisted change
B3-07 workforce reconciliation cannot silently invalidate/delete historical evidence
B3-08 existing Job edit storage failure rollback
B3-09 new Job insertion storage failure rollback
B3-10 instruction sealing + Job save failure rollback
B3-11 hard-delete failure rollback
B3-12 active-future-instruction retirement remains fail-closed unless separately authorised
B3-13 caller-owned Job/staff input mutation after commit does not mutate canonical live state
B3-14 B2 evidence maps retained across unrelated B3 mutations
```

For every failure scenario compare:

- raw committed storage bytes;
- affected live canonical domains;
- `historicalSnapshots`;
- `rostering.instructions` and `.provenance`;
- assignments where relevant;
- derived state/cache values where the method normally recomputes them.

Tests must distinguish “method returned failure” from “transaction actually rolled back.”

---

## 9. Proportionate regressions

Run:

```text
node scripts/test_gate_b3.cjs
node scripts/test_gate_b2.cjs
node scripts/test_gate_b1.cjs
node scripts/test_normal_save_snapshots.cjs
node scripts/test_persistence.cjs
```

Run `test_rostering_engine.cjs` only if a change touches rostering/eligibility/scheduler behavior or if B3 workforce reconciliation materially affects those contracts. Otherwise document why it was not rerun.

Rebuild the two standalone HTML files and verify identical hashes.

Do not run the full Gate D release regime in B3.

---

## 10. Governance/documentation update

Update `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md` truthfully:

- mark Gate B2 **ACCEPTED — Independent Review 20**;
- record PR19 package SHA-256 `796177ccc5f18c40992e6253b4c313a80f7327d2c3e1b1d69126906f8653947d`;
- authorise Gate B3 only;
- preserve all historical review rows;
- do not claim Gate B3 accepted before independent review.

Update the active continuity/handoff instructions so a new session resumes at Gate B3 rather than Review 20.

Correct the stale human-readable PR19 payload hashes in `GATE_B2_CHANGE_AND_EVIDENCE_REPORT.md` opportunistically if that document is touched. The PR19 machine manifest itself was verified correct; do not alter the immutable PR19 artifact.

Create `GATE_B3_CHANGE_AND_EVIDENCE_REPORT.md` with:

- transaction-path audit;
- exact code changes;
- test commands and outcomes;
- failure rollback evidence;
- any design challenge;
- explicit remaining Gate C/D deferrals.

---

## 11. Packaging and stop rule

Deliver one uniquely named minimal incremental package, e.g.:

```text
HortOps-Stage1-GateB3-PR20.zip
```

Include only genuinely changed source, the focused B3 test, rebuilt standalone files if source changed, changed active governance/evidence/handoff documents, and `MANIFEST.sha256.txt`.

Do not include unchanged reviewer scripts merely as padding.

**STOP for Independent Review 21.**

No Gate C, no seed/legacy deletion, no Stage 2, no Stage 3, no Codex smart-rostering implementation.

---

## 12. Design challenge route

If B3 exposes a genuine conflict between transaction atomicity and an accepted business/invariant contract, create `DESIGN_CHALLENGE_B3.md` containing:

```text
exact method and source lines
minimal actual-method reproduction
affected canonical domains
accepted invariant(s) in tension
two viable ES5-safe solutions
persistence and rollback consequences
historical-evidence consequences
recommended option
single explicit decision required
```

Pause only that branch and request focused review. Continue unrelated B3 work only if it cannot prejudice the challenged decision.
