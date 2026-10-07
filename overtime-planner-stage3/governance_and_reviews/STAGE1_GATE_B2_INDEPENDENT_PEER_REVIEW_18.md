# Horticulture Overtime Planner — Stage 1 Gate B2 Independent Peer Review 18

**Submitted artifact:** `HortOps-Stage1-GateB2-PR17(2).zip`  
**Submitted SHA-256:** `9b6eae73d802454eb538440813295227724ec2308972b2948ed5b587c706fa57`  
**Accepted comparison baseline:** PR16, Gate B1 accepted by Review 17; reconstructed accepted modular project at `/mnt/data/pr16_review/reconstructed/`, with the submitted PR17 incremental changes overlaid.  
**Decision: GATE B2 NOT YET ACCEPTED.** Retain Gate A acceptance (Review 12) and Gate B1 acceptance (Review 17). Three related Gate B2 integrity causes require **one bounded corrective package**; two coverage/documentation corrections and one planner-purity improvement should be handled in that same package. No B3, Gate C, Stage 2, Stage 3, or smart-rostering work is authorised by this assessment.

## 1. Change inventory and independent verification

The 14-file incremental ZIP adds `js/utils/rostering/commitmentPlanner.js`, extends the engine's `affectedOccurrences` journal and pruning reports, extends validator identity-retention checks with optional permitted removals, stages the Staff Assignment Modal's allocation operation before writing, and adds a scheduler facade and the Gate B2 test file. Modular entrypoint and both generated standalone HTML files were updated. The active transition register and evidence report were updated. `scripts/build_single_file.cjs` was included even though it is byte-identical to the accepted baseline; omit unchanged files next time.

**Independently reproduced (on the reconstructed source, not merely reading Gemini's log):**

| Verification | Result | Evidence |
|---|---|---|
| Submitted ZIP integrity and manifest | PASS; all 13 manifest entries matched | `unzip -t`, `sha256sum -c MANIFEST.sha256.txt` |
| Changed production JS syntax | PASS; all five changed/new JavaScript files | `node --check` per file |
| Submitted B2 linked lifecycle scenarios | PASS as written | `node scripts/test_gate_b2.cjs` |
| Accepted B1 canonical contract suite | PASS | `node scripts/test_gate_b1.cjs` |
| Accepted Gate A normal save/snapshot suite | PASS | `node scripts/test_normal_save_snapshots.cjs` |
| Existing persistence suite | PASS | `node scripts/test_persistence.cjs` |
| Rostering engine suites | 26/26 groups PASS | `node scripts/test_rostering_engine.cjs` |
| Deterministic single-file build | PASS; both built outputs equal both submitted outputs | `node scripts/build_single_file.cjs`; SHA-256 `1ba990cd8f5cb202a62145ba7b5abb66c4fd518e8ab65826ce0f2b04b63b8d9d` |
| New independent adversarial probe | **1/7 PASS; 6/7 FAIL**; failures collapse into three integrity causes plus timestamp purity | `node scripts/REVIEW18_FOCUSED_REPRO.cjs` (copy accompanying file into app's `scripts/`) |

The positive tests support genuine progress: ordinary Manual, Fixed and Rotation snapshots, cross-year descendant capture, normal repeat reduction, ordinary future cancellation and rollback on an ordinary `localStorage.setItem` exception all work for the supplied fixtures. They do **not** establish fail-closed behavior when a required dependency is missing, prove all assignment writers route through this lifecycle, or prove authorization of every snapshot removal.

## 2. Blocking finding B2-R18-01 — Optional baseline verification permits overwriting protected evidence

**Affected:** `js/components/staffAssignModal.js:822–846`; `js/utils/storage.js:130–153,156–202`. **Severity: BLOCKING.**

The modal executes its committed-baseline verification only inside:

```javascript
if (storage && typeof storage.readVerifiedCommittedV2 === 'function' &&
    validator && typeof validator.checkEvidenceKeyRetention === 'function') {
  var committed = storage.readVerifiedCommittedV2();
  if (committed && committed.ok && committed.exists && committed.data) {
    // retention check
  }
}
// unconditionally attempts storage.saveWorkspace(proposedEnvelope)
```

The accepted Gate A/B1 *normal-save and export* paths make the verified reader mandatory. The new B2 allocation path regresses that invariant: missing reader or `committed.ok === false` silently skips protection. `saveWorkspace()` itself validates the candidate envelope but does not compare it against the previously persisted identity keys, so it cannot compensate for the skipped check.

**Independent actual-modal reproductions:**

1. Save a real Manual commitment. Remove its snapshot from live session state to simulate lost in-memory evidence. Make `readVerifiedCommittedV2` unavailable; assign an unrelated future Job through the actual modal. The modal reports no error, commits the new workspace and **permanently loses the previously stored Manual snapshot**.
2. Save a real commitment, replace persisted bytes with malformed JSON and allocate a different Job. The modal overwrites those unreadable committed bytes with a new envelope and reports no error instead of quarantining the pre-existing data.

These are two manifestations of **one mandatory-baseline-reader invariant**, not two independent workstreams. Fix together by making the verified reader and retention validator required, checking every reader return, and declining to save on failure. A verified `exists:false` is distinct from reader failure and must follow the separately proven, explicitly initialized new-workspace contract. Do not add a global evidence-reset switch, silently repair corrupt storage or block a legitimate complete user-authorized restore.

**Required regression tests:** missing reader, corrupt JSON reader and explicitly valid new workspace; check user-visible failure, **unchanged raw committed bytes, unchanged complete live state and no newly recorded assignment** on the two failure cases. Preserve the positive authorised future-cancellation test with the exact removal whitelist and zero unrelated loss.

## 3. Blocking finding B2-R18-02 — The same UI still has a legacy unsnapshotted assignment writer

**Affected:** `js/components/staffAssignModal.js:752,865–867`; `js/app.js:258–263`. **Severity: BLOCKING.**

If `HortOpsRosteringEngine.applyRostering` is unavailable, the modal falls into `HortOpsApp.updateShiftStaff(this.activeShiftId,current)` rather than failing closed. That public app method directly mutates `state.customAssignments[shiftId]`, invokes ordinary save and refreshes the view; it creates **no scheduled-commitment snapshot**. It can also be invoked independently of the modal.

**Independent actual-method reproductions:** (a) remove the rostering engine while leaving the real modal and eligibility engine available and save a Manual allocation; (b) with all engines available, call `HortOpsApp.updateShiftStaff()` for a future generated shift. Both persist a nonempty assignment **without** the required evidence snapshot. The absence of a Rostering Engine is not an authorised fallback to weakened data integrity.

Remove the modal fallback; fail closed with a controlled operational message if the engine is absent. Inventory and close the direct writer: if the submitted modular source has no other legitimate consumers, make `updateShiftStaff()` reject unplanned assignment changes (or delegate to the **same** canonical validated allocation transaction if a legitimate caller needs it). Do not introduce another independent snapshot writer inside that method. Prove the ordinary modal still works and both bypasses can no longer write. If an actual essential caller would be broken, raise a source-backed bounded design challenge **before** choosing a new API; wider `updatePermit` and registry transactions remain B3.

## 4. Blocking finding B2-R18-03 — Descendant evidence removal is not tied to source ownership

**Affected:** `js/utils/rostering/commitmentPlanner.js:137–158,224–301`; `js/components/staffAssignModal.js:781–791`; `js/utils/rostering/engine.js` occurrence journal and `prunedProvenance`. **Severity: HIGH; Gate B2 ownership contract incomplete.**

`canAuthoriseFutureRemoval()` currently authorizes a different target if its shift ID is merely present in `authoritativeOccurrences` (or `operation.affectedShiftIds`), without checking **who owned the old assignment/provenance**. The planner accepts an `afterRostering` field from the modal but never reads it, accepts no previous provenance, and cannot demonstrate that a descendant removal came from the edited source instruction. An occurrence journal proves **timing identity**, not **authority to delete a different instruction's evidence**.

**Independent isolated planner reproduction:** supply a valid existing Manual commitment for `JOB-MANUAL-1@2026-06-06`, propose an empty target, supply that valid occurrence in the journal but specify a completely different source `JOB-FIXED-CROSS@2026-06-13`. The planner returns `ok:true` and lists the unrelated Manual snapshot as an authorised removal. **This proves a planner-contract bypass; it does not assert that the current modal ordinarily generates a forged journal.** It is nevertheless unsuitable as the Gate B2 operation-authorization authority and would expose future consumers or broadened engine journals to deletion.

Fix the pure planner's proof obligation: (1) an explicit **source-occurrence** future unassignment may affect its exact `sourceShiftId`, if that operator action is valid; (2) a **descendant** removal additionally requires a before-provenance record identifying the owning instruction from that source, verified before/after assignment delta, engine-reported precise pruning of those provenance keys, and absence of those keys in after-provenance; (3) no Manual or other-source assignment can be lost merely because its date appears in the occurrence journal. Retain timing journal validation for *new* snapshots, but never use journal membership alone as cancellation authorization. The engine should return the minimal detached ownership evidence, or the planner should consume validated before/after rostering maps. Add one negative unrelated-manual deletion and one positive genuine cross-year Fixed-repeat reduction, including unrelated manual preservation.

## 5. Additional corrections in the same bounded cycle

**B2-R18-04 (MEDIUM; source-backed + independently reproduced): the new supposedly pure planner invents a timestamp.** `commitmentPlanner.js:100–135,230–233` reads `new Date()` for `recordedAt` and for fallback `todayKey`. An existing valid snapshot lacking optional `recordedAt` acquires a fabricated present-day `recordedAt` merely because a future employee is replaced; the independent probe reproduces this. Preserve prior `recordedAt` *exactly, including absence* and require an explicitly injected ISO timestamp for new commitments. Require `todayKey` explicitly and validate it with the accepted local calendar check; fail closed if absent. Do not pretend that the time recorded is an actual attendance timestamp. This is a small improvement in the existing module, **not** permission to refactor all engine clocks during B2.

**B2-R18-05 (TEST GAP; no new production defect independently established): the archiving test does not exercise the claimed behavior.** `test_gate_b2.cjs:359–375` directly mutates the status of `JOB-MANUAL-1`, a `one_off` Job whose only occurrence was in 2026, then checks for **zero 2027 occurrences**. There would be zero 2027 occurrences even if the Job remained active. It also bypasses `HortOpsApp.saveJob()`, the real retirement guard. Replace that scenario with an active recurring/annual Job **proven to have a future assigned occurrence and snapshot**, and exercise the real save/retirement method. The existing guard may properly reject retirement while future instructions remain. If the desired archive/cancel operation is not specified, record an explicit **B2 business-policy design challenge** rather than silently cancelling those future commitments. Preserve a separately verified historical snapshot regardless. This is an unverified acceptance case, not evidence of an existing bug in archived-job generation.

**B2-R18-06 (REPORT/TEST HONESTY):** `test_gate_b2.cjs:320–330` compares the snapshot map but does not compare persistent raw bytes, despite the report's “0 churn and preserves exact bytes” claim. `test_gate_b2.cjs:572–575` copies verified stored data with `JSON.parse(JSON.stringify(...))` instead of executing `HortOpsExportModal.exportBackupJson()`. Distinguish actual snapshot idempotence and simulated JSON serialization from unexecuted full export-UI behavior. Test the *real* export path once if claiming checked backup, without duplicating all existing Gate A export tests. Correct the evidence report. The included unchanged `scripts/build_single_file.cjs` should be omitted from the next minimal incremental package.

## 6. Gate B2 acceptance coverage ledger

| Required operation/boundary | Review 18 status | Evidence and limitation |
|---|---|---|
| Manual/Fix/Rotation normal creation | **Independently reproduced PASS for supplied fixtures** | Actual modal, planner and saved envelope |
| Cross-year descendant timing | **Independently reproduced PASS for supplied fixture** | Ordinary Fixed/Rotation paths and existing 2027 case |
| Repeat reduction / replacement / ordinary future cancellation | **Independently reproduced PASS for supplied fixture** | Positive tests; unrelated-source negative planner check **FAIL** |
| Historical rollover / original recorded timing / 10-hour rest | **Independently reproduced PASS for supplied fixture** | Existing B2 suite; not evidence of every archived-parent business case |
| Archived recurring parent with future assigned occurrence | **Not exercised** | Existing one-off test is non-discriminating; real retirement writer not called |
| Unverified past missing timing | **Independently reproduced PASS for supplied fixture** | Existing fail-closed B2 test |
| Mandatory verified baseline / unrelated evidence retention | **FAIL — blocking** | Independent real-modal missing-reader and malformed-storage probes |
| Single authorised assignment writer | **FAIL — blocking** | Independent real-modal missing-engine and public-direct-writer probes |
| Source-authorized descendant deletion | **FAIL at exposed planner contract** | Independent negative unrelated-source planner probe; ordinary current modal path not shown to forge journal |
| New snapshot planner purity / optional prior `recordedAt` | **FAIL — medium** | Independent existing-snapshot timestamp probe and source inspection |
| Write-exception rollback | **Independently reproduced PASS for supplied fixture** | Existing actual-modal `setItem` failure; no assertion of cross-tab atomicity |
| Save, reload and direct canonical restore | **Independently reproduced PASS for supplied fixture** | Existing B2 suite; checked user-visible JSON export not executed |
| B1 validation, Gate A normal-save and Rostering 26 | **PASS; acceptance remains intact** | Independently rerun affected suites |
| Browser smoke and full release gates | **Not exercised** | Not justified for this single Gate B2 correction; full release gate remains Gate D |

## 7. Constitutional and governance disposition

The proposed pure planner, stage-before-commit modal and evidence journal follow C1 (single authority), C3 (immutable timing evidence), C5 (fail closed), C9 (transactional operations) and C10 (visible integrity) in their **ordinary positive path**. The three blocking findings demonstrate incomplete enforcement on exceptional but supported call boundaries and on cancellation ownership. They are failures against the existing frozen contract, **not** reasons to amend the constitution or the current staged roadmap.

Preserve the active governance directive and historical accepted Reviews 12 and 17 verbatim. Register PR17/Review 18 as **B2 developer implemented, independently not yet accepted**, with the three causes and precise retest contract; correct the stale continuity guide's old “Gate A now” and “Gate B not authorised” executable wording without modifying historical records. Any unresolved archive policy or essential direct-writer use requires a `DESIGN_CHALLENGE_B2.md` and a targeted user-mediated decision; it does not automatically authorize a roadmap change. Keep independent Codex smart-rostering research isolated for Stage 3.

**Stopping rule:** Gemini addresses these **three causes together**, the modest timestamp fix and truthful acceptance tests/report, then supplies one minimal incremental corrective ZIP and stops for Review 19. No new unrelated architecture audit; no B3 or legacy deletion. Review 19 should rerun the unchanged reviewer discriminator, the focused updated B2 suite, B1 contract tests and directly affected persistence/regression tests, plus deterministic standalone rebuild, rather than all release gates.
