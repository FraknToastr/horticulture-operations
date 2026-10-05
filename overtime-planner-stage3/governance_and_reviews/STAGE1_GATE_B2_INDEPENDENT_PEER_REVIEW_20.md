# Horticulture Operations Suite — Stage 1 Gate B2 Independent Peer Review 20

**Reviewed package:** `HortOps-Stage1-GateB2-PR19.zip`  
**Package SHA-256:** `796177ccc5f18c40992e6253b4c313a80f7327d2c3e1b1d69126906f8653947d`  
**Review decision:** **GATE B2 ACCEPTED**  
**Previous accepted gates:** Gate A (Review 12), Gate B1 (Review 17)  
**Next authorised gate:** Gate B3 only  
**Not authorised:** Gate C, Stage 2, Stage 3, Codex smart-rostering implementation, legacy deletion

---

## 1. Executive decision

PR19 closes the bounded exported-planner contract defects identified in Independent Review 19. I independently reconstructed the current application through the incremental Stage 1 package sequence, overlaid PR19, reran the reviewer-owned Review 19 and Review 18 discriminators, ran the focused Gate B2 and Gate B1 suites, reran Gate A normal-save and persistence regressions, ran all 26 Rostering Engine groups, and rebuilt both standalone distributions.

No new Gate B2 blocking defect was reproduced.

**Gate B2 is accepted.**

This acceptance is deliberately bounded. It does not certify broader application mutation atomicity, legacy removal, clean boot, Stage 2 reset/onboarding, or future smart rostering. Those remain assigned to later gates/stages.

---

## 2. Review 19 finding accountability

| Review 19 finding | PR19 implementation | Independent result |
|---|---|---|
| Missing or malformed caller-injected `todayKey` could disable historical protection | `plan()` now requires the canonical validator and a valid `todayKey` before planning any mutation | **FIXED** — Review19 checks B19-01 and B19-02 pass |
| Descendant deletion could be authorised with incomplete ownership proof | Descendant removal now requires object-shaped before/after provenance state, instruction lookup, matching source ownership, absence from new provenance and exact engine `prunedProvenance` evidence | **FIXED** — B19-03 through B19-06 pass |
| Planner mutated caller-owned `operation` metadata | `operation` is copied using own-property iteration before `todayKey` enrichment | **FIXED** — B19-08 passes |
| Existing explicit source cancellation must remain legitimate | Direct current/future source unassignment remains permitted | **PRESERVED** — B19-07 passes |

PR19 does not reopen the seven actual modal/application defects already closed by PR18. The unchanged Review 18 discriminator remains 7/7 passing.

---

## 3. Independent verification

### Review-owned discriminators

```text
node scripts/REVIEW19_PLANNER_BOUNDARY_REPRO.cjs
8 / 8 PASS — 0 gaps

node scripts/REVIEW18_FOCUSED_REPRO.cjs
7 / 7 PASS — 0 gaps
```

### Focused and regression suites

```text
node scripts/test_gate_b2.cjs
PASS — all Gate B2 scenarios and Review 18/19 boundary contracts

node scripts/test_gate_b1.cjs
PASS — Assertions 1–11

node scripts/test_normal_save_snapshots.cjs
PASS

node scripts/test_persistence.cjs
PASS — including architecture dependency failure contracts

node scripts/test_rostering_engine.cjs
PASS — 26 / 26 groups
```

Expected simulated storage failures and quarantine warnings appeared in the persistence suite; the suite exited successfully and reported 100% regression pass.

### Deterministic standalone build

`node scripts/build_single_file.cjs` completed successfully.

```text
45b215002cf2aee12b02ace1b6ca8b0623ac93aba2355a656f62b8c9940a3767  index.html
45b215002cf2aee12b02ace1b6ca8b0623ac93aba2355a656f62b8c9940a3767  dist/hort_ops_offline_planner.html
```

The two distributions are byte-identical.

### PR19 manifest

`sha256sum -c MANIFEST.sha256.txt` passes for every listed payload file.

---

## 4. Source-level assessment

The PR19 change remains appropriately narrow. `commitmentPlanner.js` continues to own the evidence-delta decision instead of duplicating removal authority in the UI. The caller-injected date requirement is fail-closed and uses the accepted canonical date validator. Descendant evidence deletion now requires cumulative proof rather than treating any one provenance clue as sufficient.

The planner's public input remains intentionally strict. This is appropriate for an integrity boundary: malformed or incomplete caller data should prevent evidence modification rather than be repaired heuristically.

The existing source-shift cancellation branch remains intentionally simpler than descendant pruning. That behavior was explicitly retained by Review 19 and is covered by a positive discriminator. It should not be broadened into generic future-evidence deletion in later work.

---

## 5. Eight-boundary Gate B2 assessment

| Boundary | Result | Review 20 assessment |
|---|---|---|
| 1. Runtime assignment proposal | **PASS** | Allocation flow stages proposed assignments rather than relying on the deprecated direct writer |
| 2. Rostering propagation result | **PASS** | Fixed/Rotation descendant results and exact pruned provenance are available to the transaction |
| 3. Commitment delta planning | **PASS** | Mandatory date, authoritative timing and strict ownership rules now fail closed |
| 4. Historical immutability | **PASS** | Past commitment modification/deletion is rejected using verified local date |
| 5. Canonical envelope validation | **PASS** | Proposed full current-v2 state remains subject to accepted B1 validation |
| 6. Persistence failure | **PASS for B2 allocation transaction** | B2 tests prove storage failure leaves allocation transaction state and committed bytes unchanged |
| 7. Save/export/restore continuity | **PASS** | Commitment evidence survives verified reload, backup and clean restore |
| 8. Standalone distribution | **PASS** | Rebuilt outputs are deterministic and identical |

This matrix does **not** claim that every other write method in the application is transactionally safe. That broader question is Gate B3.

---

## 6. Governance and documentation assessment

The governance transition register correctly records PR18 as reviewed/non-accepted for the exported planner boundary and PR19 as awaiting Review 20. The continuity document now directs the next reviewer to the correct Gate B2 checkpoint rather than stale Gate A execution instructions.

Two documentation observations are non-blocking:

1. `GATE_B2_CHANGE_AND_EVIDENCE_REPORT.md` contains stale illustrative hashes in its human-readable checksum table for at least `commitmentPlanner.js` and `test_gate_b2.cjs`. The actual `MANIFEST.sha256.txt` is correct and independently verifies. Correct the prose table opportunistically in the next documentation update; do not issue another B2 PR solely for this.
2. `HANDOFF_GATE_B2_PR19.md` references `DESIGN_CHALLENGE_B2.md`, which is not included in the incremental PR19 ZIP. This is acceptable because PR19 is correctly packaged as a changed-files-only incremental artifact and the design challenge already exists in the reconstructed governed workspace.

Neither observation changes the acceptance decision.

---

## 7. Gate B2 acceptance boundary

Gate B2 is accepted as establishing:

- authoritative scheduled-commitment evidence for committed allocation changes;
- Fixed/Rotation descendant evidence across supported recurrence boundaries;
- preservation of past evidence when parent Job definitions later change;
- exact provenance-based future descendant pruning;
- explicit current/future source unassignment;
- fail-closed handling of malformed planner inputs and unverified historical data;
- transaction-safe B2 allocation persistence;
- commitment preservation through save/reload/export/restore.

Gate B2 acceptance does **not** decide the product-policy question of one-step Job retirement with future automatic cancellation. The existing fail-closed retirement behavior remains the interim contract. The alternative can be considered during Gate B3 design without retroactively changing B2 acceptance.

---

## 8. Deferred work — now authorised only as Gate B3

The governing register already assigns `GB-TXN-004` to Gate B3: broader operational mutation atomicity outside the now-accepted B2 allocation transaction.

Source inspection identifies the most important B3 targets:

- `HortOpsApp.updatePermit()` mutates `state.customPermits` before persistence and ignores save failure.
- `HortOpsApp.reconcileStaffSnapshot()` replaces workforce and assignment state before persistence and ignores save failure.
- `HortOpsApp.updateStaffMember()` mutates an existing staff object in place before persistence and ignores save failure.
- `HortOpsApp.saveJob()` and `deleteJob()` already contain rollback logic and recurrence guards, but B3 must verify complete transaction behavior across Job state, instruction status, committed bytes, caches and caller-owned objects rather than assuming the existing rollback is complete.

`updateShiftStaff()` is no longer an active writer; B2 deliberately makes it fail closed. Do not re-enable it in B3.

UI-only preferences such as changing the active view/year are not the initial B3 priority unless evidence shows they can corrupt canonical operational state.

---

## 9. Review 20 decision

**ACCEPT Stage 1 Gate B2.**

Authorise **Gate B3 only** under the accompanying prescriptive prompt. Preserve Gate A, B1 and B2 acceptance records. Do not start Gate C or remove compatibility/seed code until Gate B3 is independently accepted.
