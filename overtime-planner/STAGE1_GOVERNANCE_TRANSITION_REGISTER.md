# Stage 1 — Governance transition and decision register

**Established:** 24 September 2026 · **Revision status:** Gate A Accepted (Review 12); Gate B1 Accepted (Review 17); Gate B2 Authorised & In Progress.

## 1. Document authority and supersession

| Instrument | Role | Status / precedence |
|---|---|---|
| Explicit subsequent user decisions | Scope and priority, subject to preserved safety/integrity obligations | Highest project instruction |
| `references/GEMINI_STAGE1_ARCHITECTURE_GOVERNANCE_RESET_DIRECTIVE.md` | Standing Stage 1 constitution (C1–C10), stage boundaries, canonical concepts and review standards | **Governing; unchanged**. Original Section 21 sequence narrowly amended as recorded below. |
| Existing frozen rostering invariants I1–I12 and adopted product constitution where non-conflicting | Preserve assignment identity, provenance, historical immutability and agreed UI protections | **Remain in force**; conflict requires explicit user authorisation and a reviewed addendum. |
| Independent Review 06 and Review 07 adjudication under `references/` | Governing **gate decisions and resolution of contradictory dated instructions**, not a rewrite of C1–C10 | Sequence conditional; Gate A implementation can proceed but Gate A **not accepted**. Review 07 resolves the old continuity conflict. |
| `GEMINI_GATE_B2_PRESCRIPTIVE_IMPLEMENTATION_PROMPT_REVIEW17.md` | Sole current detailed Gate B2 execution instructions | **Active, Gate B2 only**, subordinate to constitution and independent review decisions. Governs B2 scheduled-commitment ownership, pure delta planner, occurrence evidence journal, and stage-before-commit transaction integration. |
| `STAGE1_GATE_A_PEER_REVIEW_CONTINUITY.md` | **Single maintained active resume document** | Current procedural guide; points to current prompt, does not duplicate another design authority. |
| `RESUME_WORK_INSTRUCTIONS.md` | Redirect | Pointer only. Never maintain a competing executable runbook. |
| `IMPLEMENTATION_PLAN.md` | A–D status/entry/exit index | Active status index; **not** separate schema or governance authority. |
| `STAGE1_ARCHITECTURE_AUDIT_AND_CANONICALISATION_PLAN.md` in checked-out repository | Observed current architecture, field schema, A–H inventory, **proposed** canonical decisions | **Not yet independently accepted**. Promote as technical source of truth *after* independent review. |
| Original audit ZIP, PR04/PR05 documents, September 23 continuity guide, earlier Review 06 execution prompt | Historical provenance | **Read-only and superseded as live instructions**. Do not rewrite, overwrite or reissue under existing filenames. |

**Conflict resolution:** New express user instruction → unchanged C1–C10 and compatible frozen invariants (with documented narrow amendment below) → independent gate decisions/adjudication → active Gate A prompt → continuity guide → status index → unaccepted proposal → historical sources. If an ambiguity would affect data loss, deletion or scope, stop and request review rather than infer permission.

## 2. Amendment ledger

| ID | Decision | Scope and rationale | Status |
|---|---|---|---|
| ST1-SEQ-001 | **A → B → C → D**. Canonical persistence and complete historical-evidence protection (**Gate B**) must be independently accepted **before** deleting verified obsolete compatibility (**Gate C**). | Narrow sequencing amendment to the reset directive's original Section 21 Steps 4/5, reducing the risk of removing code still needed for current v2 integrity. All C1–C10 principles, Stage 1 goals and Stage 2–4 definitions remain unchanged. | Roadmap **conditionally endorsed** by Review 06; Review 07 explicitly records the amendment. Does **not** accept A, B, C or D implementation. |
| ST1-GOV-002 | One maintained active continuity guide, one current Gate A task prompt, short plan index and one eventually accepted audit as the architectural technical record. | Prevent stale PR04/PR05 or September 23 pause instructions from being re-executed. | Established by this *documentation-only* continuity package; Gemini to integrate into current checkout at Gate A. |
| ST1-SCOPE-003 | Gate A code work is limited to audit correction, surgical normal-save evidence integrity and focused supported-v2 backup/restore bridge. | Prevents hidden Stage B/C refactoring or legacy deletion. | **Authorised to implement; not accepted**. |
| ST1-REV08-004 | Adjudication of Independent Review 08 (Findings F01–F07). Scope strictly confined to corrective Gate A exit requirements: fail-closed evidence-loss guards, startup/import quarantine, export/restore pipeline, verbatim C1–C10 alignment, zero control characters, line anchor accuracy, Class H seed inventory, bounded syntax checks, and minimal package hygiene. | Preserves constitutional governance and integrity boundaries; strictly defers Gate B/C. | Superseded by PR09 / Protocol v2. |
| ST1-REV09-005 | Adjudication of Review Protocol v2 Prescription & Invariant Closure (PR09). Enforces Invariant A (explicit current-v2 presence), Invariant B (evidence key retention check), and Invariant C (no false test successes) across 8 ingress/egress/storage boundaries. | Replaced by Review 10 unified closure. | Superseded by PR10 / Review 10. |
| ST1-REV10-006 | Adjudication of Independent Review 10 Unified Closure (PR10). Resolves GA10-01 (envelope builder bypass closed with strict presence checks), GA10-02 (authoritative committed baseline reader `readVerifiedCommittedV2` preventing backup download on malformed storage), GA10-03 (normal save refusing to overwrite unreadable/corrupt committed bytes), GA10-04 (boundary validator operating on defensive working copy, preventing rejected mutations to caller/runtime state), GA10-05 (canonical persistence test suite `test_persistence.cjs` repaired and passing 100%), and GA10-06 (elimination of all C0 control characters, source anchor accuracy, record `GB-OWN-001`). | Closes remaining architectural bypasses, eliminates in-place validation mutations, repairs regression suite. | Superseded by PR11 / Review 11. |
| ST1-REV11-007 | Adjudication of Independent Review 11 Prescriptive Micro-Closure (PR11). Resolves R11-01 (mandatory baseline reader `readVerifiedCommittedV2` in `saveCurrentWorkspace` and `exportBackupJson` failing closed immediately if unavailable or unverified), R11-02 (truthful backup semantics via preflight validation, checked `saveCurrentWorkspace`, and re-reading newly confirmed committed bytes), R11-03 (complete validated working copy adoption in `restoreWorkspaceJson` for `budgetSettings` and `uiState`, eliminating post-restore caller mutation leakage), R11-04 (pre-clone non-JSON value guard `rejectNonJsonValue` rejecting `Infinity`, `NaN`, functions, symbols, and cyclic references before `JSON.stringify`), and R11-05 (governance register ledger cleanup, removing duplicate malformed row in §6, replacing Gate A row in §3 with PR11 proposed status, and fixing UTF-8 mojibake). | Enforces fail-closed baseline reader, save-then-export integrity, isolated restore adoption, pre-clone non-JSON rejection, and governance register accuracy. | **Accepted by Independent Review 12** (PR11 archive SHA-256: `bb8ca019d8dd6ac98fdf72529717c61bfa068929e38123b2724eb556302a24cb`, 2026-09-25). |
| ST1-GATE-B1-008 | Authorisation of Stage 1 Gate B1 (Canonical V2 Persistence & Scheduled-Commitment Validation). Governed by Review 12 and `GEMINI_GATE_B1_PRESCRIPTIVE_IMPLEMENTATION_PROMPT.md`. Implements single canonical current-v2 construction service, strict scheduled-commitment validation in `validateScheduledCommitment()` (real calendar dates, supported clock times, positive finite duration, valid crewSize and duplicate-free assigned staff array), mandatory evidence retention in export preflight, removal of masking fallbacks and fallback constructors, and bounded test matrix. | Hardens persistence boundary and scheduled commitment validation before historical lifecycle work in B2/B3. | Evaluated in Review 13; non-accepted with 3 code causes. |
| ST1-GATE-B1-009 | Adjudication of Independent Review 13 Prescriptive Microclosure (PR13). Resolves B1-01 (strict canonical workspace constructor rejecting malformed domains without laundering/defaulting, and preventing jobs:null from erasing stored data), B1-02 (strict typing for optional snapshot crewSize and assignedStaffIds when supplied, source-backed allow-list for recordType: scheduled_commitment and historical), B1-03 (runtime unverifiedSchedule flag strictly rejected from persisted authoritative snapshots), B1-04 (portable test suite paths, Review 13 discriminating probes passing 100%, accurate method labels in evidence report). | Closes permissive constructor, strict snapshot semantics, unverified ambiguity, and test portability. | Evaluated in Review 14; non-accepted with 3 code causes. |
| ST1-GATE-B1-010 | Adjudication of Independent Review 14 Prescriptive Microclosure (PR14). Resolves B1-14-01 (canonical operational assignments map validation across all 8 boundaries in `schemaValidator.validateAssignmentsMap()` and presence check, preventing assignment loss or silent defaulting), B1-14-02 (prototype-safe recordType allow-list checking and prototype-safe staff duplicate detection via null-prototype sets `Object.create(null)`), B1-14-03 (null Job and roster entries returning normal validation failure instead of uncaught TypeError, defensive try/catch in `validateCurrentV2ForBoundary`). Review 14 discriminating probes (11/11 passing). | Enforces assignments map schema integrity, prototype pollution resistance, robust entity-array error handling. | Evaluated in Review 15; non-accepted with 1 contract cause (runtime alias accepted at boundary). |
| ST1-GATE-B1-011 | Adjudication of Independent Review 15 Prescriptive Microclosure (PR15). Resolves B1-15-01 (strict canonical envelope vs runtime state distinction: `validateCurrentV2Presence(input, options)` requiring `assignments` and rejecting `customAssignments` as ambiguous by default across all public boundaries; allowing `options.inputKind === 'runtime_state'` only for `HortOpsApp.saveCurrentWorkspace()` live-state preflight before projection to canonical `assignments`), B1-15-02 (test evidence reconciliation, updating `test_rostering_engine.cjs` group 26 persisted fixture to canonical `assignments` only, supplying updated `test_persistence.cjs` and `test_rostering_engine.cjs` in incremental archive). Review 15 discriminating probes (5/5 PASS), Review 14 probes (11/11 PASS), Review 13 probes (6/6 PASS), Gate B1 assertions 1-10 PASS (100%). | Enforces strict canonical assignments boundary, eliminates alias confusion, reconciles test evidence fixtures. | Evaluated in Review 16; non-accepted with 1 constructor cause (contradictory dual-map silent acceptance). |
| ST1-GATE-B1-012 | Adjudication of Independent Review 16 Prescriptive Microclosure (PR16). Resolves B1-16-01 (canonical constructor in `migrationEngine.js:createWorkspaceEnvelope` rejecting `customAssignments` before candidate projection, preventing silent information loss on conflicting dual-map current-v2 objects; normalising Schema v1 `customAssignments` alias exclusively within `migrateWorkspaceV1toV2`, removing `customAssignments` from synthetic v2 and failing closed on conflicting dual-source v1 inputs). Review 16 independent boundary probe 7/7 PASS; Review 15 probes 5/5 PASS; Review 14 probes 11/11 PASS; Review 13 probes 6/6 PASS; Gate B1 assertions 1-11 PASS (100%). | Enforces constructor-level alias rejection before projection and fail-closed v1 alias normalisation. | **Accepted by Independent Review 17** (PR16 archive SHA-256: `ba5f9d223c32bbf3956ca13ebb1ced4ed8ca242bd2fde9fd685fd181c9d8edce`, 2026-09-25). |
| ST1-GATE-B2-013 | Authorisation of Stage 1 Gate B2 (Authoritative Scheduled-Commitment Ownership, Pure Delta Planner & Lifecycle Integration). Governed by Review 17 and `GEMINI_GATE_B2_PRESCRIPTIVE_IMPLEMENTATION_PROMPT_REVIEW17.md`. Implements pure commitment delta planner, occurrence evidence journal in rostering engine, full descendant snapshot lifecycle across years, historical immutability, explicit future cancellation, and stage-before-commit transaction integration. | Establishes end-to-end operational commitment lifecycle ownership, eliminates missing descendant snapshots, enforces stage-before-commit atomicity. | Evaluated in Review 18; non-accepted with 3 code causes (missing reader check, direct writer bypass, unproven descendant deletion). |
| ST1-GATE-B2-014 | Adjudication of Independent Review 18 Corrective Microclosure (PR18). Governed by Review 18 and `GEMINI_GATE_B2_CORRECTIVE_IMPLEMENTATION_PROMPT_REVIEW18.md`. Resolves P0 findings: (1) mandatory baseline reader check in `staffAssignModal.js`; (2) elimination of unsnapshotted assignment writers; (3) genuine source-owned descendant unassignment authorization; (4) removal of hidden `new Date()` calls; (5) submission of `DESIGN_CHALLENGE_B2.md`. Evaluated in Review 19: all 7 modal/app checks verified passing; exported planner trust-boundary API required narrow input-contract correction. | Enforces strict commit-gate baseline verification, eliminates direct writer bypasses, establishes genuine source-provenance pruning, ensures deterministic time contracts. | Evaluated in Review 19 (non-accepted with 1 exported-planner contract cause). |
| ST1-GATE-B2-015 | Adjudication of Independent Review 19 Final Planner Contract Microclosure (PR19). Governed by Review 19 and `GEMINI_GATE_B2_FINAL_PLANNER_CONTRACT_PROMPT_REVIEW19.md`. Resolves B2-R19-01 (mandatory, verified, caller-injected local date key via `HortOpsSchemaValidator.isRealYmd()`, failing closed if missing or malformed), B2-R19-02 (strict cumulative descendant removal proof), B2-R19-03 (pure `plan()` function). Review 19 boundary repro (8/8 PASS, 0 gaps), Review 18 repro (7/7 PASS), `test_gate_b2.cjs` (100% PASS), `test_gate_b1.cjs` (100% PASS). | Enforces strict exported-planner input contract, cumulative descendant proof, and pure input non-mutation. | **ACCEPTED — Independent Review 20** (2026-09-27; PR19 SHA-256: `796177ccc5f18c40992e6253b4c313a80f7327d2c3e1b1d69126906f8653947d`). |
| ST1-GATE-B2-016 | Formal Acceptance of Stage 1 Gate B2 via Independent Peer Review 20 (`HortOps_Stage1_PR19_Full_Independent_Peer_Review.md`, 2026-09-27). Verified complete closure of B2-R19-01, B2-R19-02, and B2-R19-03. Documented explicit release blockers for pre-Gate D: FR-02 (schedule precision) and FR-03 (timezone/DST 10h rest). | Endorses Gate B2 closure with documented B3 and pre-Gate D release blocker deferrals; authorises Gate B3 implementation. | **ACCEPTED — Independent Review 20**. |
| ST1-GATE-B3-017 | Authorisation and Implementation of Stage 1 Gate B3 (Transaction Hardening, Snapshot Evidence Loss Protection, Restore Canonical Equivalence & Modals Non-Aliasing). Governed by `GEMINI_STAGE1_GATE_B3_PR19_FULL_REVIEW_EXECUTION_PROMPT.md`. Implements B3-01 (`updatePermit` detached proposal commit & rollback), B3-02 (`reconcileStaffSnapshot` detached proposal & departed staff retention), B3-03 (`updateStaffMember` detached clone commit & caller isolation), B3-04 (`saveJob` and `deleteJob` detached commit & atomic rollback), FR-01 (history-only Job deletion snapshot protection in `getJobDependencies`), FR-04 (canonical restore live replacement & budget/ui defaults), and UI modal return-contract adoption. Verified via `test_gate_b3.cjs` (18/18 PASS [100%]) and `HortOps_PR19_Independent_Synthetic_Probes.cjs` (FR-01, FR-04, FR-05 resolved; FR-02 deferred to pre-Gate D). | Enforces stage-before-commit atomicity, zero live/storage divergence on failure, evidence retention for history-only jobs, and canonical restore domain equivalence. | **ACCEPTED — Independent Review 21** (2026-09-28; PR20 SHA-256: `24981a4806185f398ce49e441836dd19122abd1d993b3019d8e6e0f13d5d3fec`). |
| `ST1-GATE-C-018` | Gate B3 | Gate C | `2026-09-28` | REVISED | Evaluated in Independent Review 22 and Independent Review 23 (`STAGE1_GATE_C_PR21_REVISED_INDEPENDENT_PEER_REVIEW_23.md`). Outcome: NOT ACCEPTED; 4 bounded causes identified (R23-01 quarantine tree, R23-02 seed fallbacks, R23-03 FR-04 restore canonical equivalence, R23-04 test sentinels) and R23-05 governance synchronization. |
| `ST1-GATE-C-019` | Gate C | Gate C | `2026-09-28` | EVALUATED | Evaluated by Independent Peer Review 24 (`Review24_GateC_Protocol_v1.1_Assessment_Package`). Decision: NOT ACCEPTED; findings: HORT-GC-R24-F01 (Blocker: 12 identity-bearing historical references in documentation), HORT-GC-R24-F02 (High: gate evidence overstatement), HORT-GC-R24-F03 (Medium: stale persistence element-zero assertion), HORT-GC-R24-F04 (Medium: stale historical fixtures), HORT-GC-R24-F05 (Low: browser smoke blocked in container). |
| `ST1-GATE-C-020` | Gate C | Gate C | `2026-09-28` | EVALUATED | Evaluated by Independent Peer Review 25 (`STAGE1_GATE_C_INDEPENDENT_PEER_REVIEW_25.md`). Decision: NOT YET ACCEPTED — single documentation finding R25-F01 (evidence consistency in briefing row R23-REG); confirmed privacy blocker and persistence assertions closed, zero production defects demonstrated. |
| `ST1-GATE-C-021` | Gate C | Gate C | `2026-09-28` | EVALUATED | Evaluated by Independent Peer Review 26 (`STAGE1_GATE_C_INDEPENDENT_PEER_REVIEW_26.md`). Decision: **ACCEPTED FOR DEFINED SCOPE**. Non-blocking governance errata identified (briefing/register review cross-references). Confirmed R25-F01 closed, privacy hygiene clean, persistence green, zero production defects demonstrated. |
| `ST1-GATE-C-022` | Gate C | Gate C | `2026-09-28` | ACCEPTED | Governance errata reconciled; formal acceptance ledger published; `scripts/review26_governance_crosscheck.cjs` verified PASS. Gate C formally accepted and closed. |
| `ST1-GATE-C-023` | Gate C | Gate C | `2026-09-28` | VERIFIED | Evaluated by Independent Peer Review 27 (`STAGE1_GATE_C_INDEPENDENT_PEER_REVIEW_27.md`). Decision: Review 26 governance corrections VERIFIED CLOSED. Gate C acceptance confirmed standing. Non-blocking editorial current-status detail fields reconciled; `scripts/review27_current_status_consistency.cjs` verified PASS. |
| `ST1-GATE-C-024` | Gate C | Gate C | `2026-09-28` | VERIFIED | Evaluated by Independent Peer Review 28 (`STAGE1_GATE_C_INDEPENDENT_PEER_REVIEW_28.md`). Decision: PR21_01 confirmed content-identical to PR21(4); PR21_02 verified closing all Review 27 status inconsistencies. Gate C acceptance confirmed standing. Format-tolerant governance probe `scripts/review28_governance_status_robust.cjs` verified PASS. |
| `ST1-GATE-D-025` | Gate C | Gate D | `2026-09-28` | NOT_AUTHORISED | Gate D awaiting formal authorization and initiation upon user directive. Documented Gate D release blockers: FR-02 (Gregorian/recurrence validation), FR-03 (Adelaide/DST 10h rest calculation), FR-07 (lifecycle Test 14 fixture), FR-09 (ES5 review), and browser release smoke. |

**Amendment control:** Do not alter the unchanged original constitutional directive to hide a sequencing discrepancy. Enter subsequent amendments here with date, reason, affected clauses, user authorisation where needed, independent review result and exact released artifact. Where this initial register merely restates Review 06/07, cite those unchanged reference documents, not an invented new approval.

## 3. Current gate ledger (as of issuance)

| Gate | Implementation / audit status | Independent decision | Next permitted action |
|---|---|---|---|
| A — corrected audit + normal-save integrity | Implemented in PR11; verified across 8 boundaries; all 5 Review 11 gaps resolved; test suites passing 100%. | **ACCEPTED WITH DOCUMENTED GATE B DEFERRALS** (Independent Review 12, 2026-09-25; PR11 SHA-256: `bb8ca019d8dd6ac98fdf72529717c61bfa068929e38123b2724eb556302a24cb`) | Gate A closed; proceed to Gate B1 only. Legacy deletion remains strictly prohibited. |
| B1 — canonical current-schema persistence + scheduled-commitment validation | Implemented in PR16; verified across 8 boundaries; all Review 13–16 probes passing 100%; independent reviewer extra probe 5/5 PASS; deterministic single-file build verified. | **ACCEPTED WITH DOCUMENTED B2/B3/D DEFERRALS** (Independent Review 17, 2026-09-25; PR16 SHA-256: `ba5f9d223c32bbf3956ca13ebb1ced4ed8ca242bd2fde9fd685fd181c9d8edce`) | Gate B1 closed; proceed to Gate B2 only. |
| B2 — authoritative scheduled-commitment ownership & propagation lifecycle | Implemented in PR18; corrected in PR19; verified across all 8 boundaries; all Review 18-19 probes passing 100%. | **ACCEPTED WITH DOCUMENTED B3 & PRE-GATE D DEFERRALS** (Independent Review 20, 2026-09-27; PR19 SHA-256: `796177ccc5f18c40992e6253b4c313a80f7327d2c3e1b1d69126906f8653947d`) | Gate B2 closed; proceed to Gate B3 only. |
| B3 — transaction hardening, atomicity & restore canonical equivalence | Implemented in PR20; stage-before-commit atomicity across permits, staff, jobs, and restores; FR-01 history-only snapshot protection; FR-04 restore canonical equivalence normalized and persisted in PR21 corrective submission. Verified across `test_gate_b3.cjs` (18/18 PASS), `test_r23_restore_canonical.cjs` (100% PASS). | **ACCEPTED IN PR20 (External Prior Authority: Independent Review 21); FR-04 closure evaluated in Review 23/24** | Gate B3 transactional fixes implemented; awaiting Review 24 confirmation of FR-04 and Gate C. |
| `ST1-GATE-C-018` | Gate B3 | Gate C | `2026-09-28` | REVISED | Evaluated in Independent Review 22 and Independent Review 23 (`STAGE1_GATE_C_PR21_REVISED_INDEPENDENT_PEER_REVIEW_23.md`). Outcome: NOT ACCEPTED; 4 bounded causes identified (R23-01 quarantine tree, R23-02 seed fallbacks, R23-03 FR-04 restore canonical equivalence, R23-04 test sentinels) and R23-05 governance synchronization. |
| `ST1-GATE-C-019` | Gate C | Gate C | `2026-09-28` | EVALUATED | Evaluated by Independent Peer Review 24 (`Review24_GateC_Protocol_v1.1_Assessment_Package`). Decision: NOT ACCEPTED; findings: HORT-GC-R24-F01 (Blocker: 12 identity-bearing historical references in documentation), HORT-GC-R24-F02 (High: gate evidence overstatement), HORT-GC-R24-F03 (Medium: stale persistence element-zero assertion), HORT-GC-R24-F04 (Medium: stale historical fixtures), HORT-GC-R24-F05 (Low: browser smoke blocked in container). |
| `ST1-GATE-C-020` | Gate C | Gate C | `2026-09-28` | EVALUATED | Evaluated by Independent Peer Review 25 (`STAGE1_GATE_C_INDEPENDENT_PEER_REVIEW_25.md`). Decision: NOT YET ACCEPTED — single documentation finding R25-F01 (evidence consistency in briefing row R23-REG); confirmed privacy blocker and persistence assertions closed, zero production defects demonstrated. |
| `ST1-GATE-C-021` | Gate C | Gate C | `2026-09-28` | EVALUATED | Evaluated by Independent Peer Review 26 (`STAGE1_GATE_C_INDEPENDENT_PEER_REVIEW_26.md`). Decision: **ACCEPTED FOR DEFINED SCOPE**. Non-blocking governance errata identified (briefing/register review cross-references). Confirmed R25-F01 closed, privacy hygiene clean, persistence green, zero production defects demonstrated. |
| `ST1-GATE-C-022` | Gate C | Gate C | `2026-09-28` | ACCEPTED | Governance errata reconciled; formal acceptance ledger published; `scripts/review26_governance_crosscheck.cjs` verified PASS. Gate C formally accepted and closed. |
| `ST1-GATE-C-023` | Gate C | Gate C | `2026-09-28` | VERIFIED | Evaluated by Independent Peer Review 27 (`STAGE1_GATE_C_INDEPENDENT_PEER_REVIEW_27.md`). Decision: Review 26 governance corrections VERIFIED CLOSED. Gate C acceptance confirmed standing. Non-blocking editorial current-status detail fields reconciled; `scripts/review27_current_status_consistency.cjs` verified PASS. |
| `ST1-GATE-C-024` | Gate C | Gate C | `2026-09-28` | VERIFIED | Evaluated by Independent Peer Review 28 (`STAGE1_GATE_C_INDEPENDENT_PEER_REVIEW_28.md`). Decision: PR21_01 confirmed content-identical to PR21(4); PR21_02 verified closing all Review 27 status inconsistencies. Gate C acceptance confirmed standing. Format-tolerant governance probe `scripts/review28_governance_status_robust.cjs` verified PASS. |
| `ST1-GATE-D-025` | Gate C | Gate D | `2026-09-28` | NOT_AUTHORISED | Gate D awaiting formal authorization and initiation upon user directive. Documented Gate D release blockers: FR-02 (Gregorian/recurrence validation), FR-03 (Adelaide/DST 10h rest calculation), FR-07 (lifecycle Test 14 fixture), FR-09 (ES5 review), and browser release smoke. |
| D — integrated Stage 1 release checkpoint | Planned (FR-02 schedule precision, FR-03 Adelaide/DST rest calculations, FR-07 test fixture lifecycle, FR-09 ES5 review, browser release smoke). | **NOT YET AUTHORISED** | Gate D cannot start until Gate C is formally accepted by independent review. |
| Stage 2 handoff | Issued | **Authorised by User** | User authorization granted (2026-09-29); commences Stage 2 implementation. |

No test or status recorded in the old continuity guide is promoted automatically to current acceptance. Check the actual repository state when Gate A resumes.

## 4. C1–C10 review-status policy

Required status vocabulary: **Verified**, **Partially verified**, **Blocked**, **Not assessed**, **Future foundation only**. Never use a general “Compliant” label without source-backed coverage of every relevant current contract. Gate A's corrected audit must assign statuses using code and executed tests, not this starter document's assertions. Starting issues requiring review:

| Principle | Evidence / unresolved question carried into Gate A |
|---|---|
| C1 — one canonical source per concept | Multiple envelope-build paths; distinguish legitimate runtime `staffList`/`customAssignments` projections from actual competing persisted truths. |
| C2 — central eligibility | Inspect every real app entry point and malformed-input behaviour, not just PR05 engine tests. |
| C3 — historical timing authoritative | Prior `saveCurrentWorkspace()` omission and missing descendant snapshots; Gate A fixes save, Gate B closes capture/lifecycle. |
| C4 — planned versus actual | Current snapshot `recordType` names a **scheduled commitment**, not verified attendance. Validate end-to-end presentation and persistence claims. |
| C5 — fail closed | Prior snapshot validator accepted malformed data; ensure Gate A touched paths do not coerce missing evidence; Gate B owns complete strict validation. |
| C6 — no speculative refactor | Audit actual changed source for scope creep; documentation compliance alone is not implementation proof. |
| C7 — no hidden compatibility | Obsolete migration paths remain until Gate C verifies current-v2 consumers and safe replacements. |
| C8 — stable identities | Inspect real persisted representations of `jobId`, `employeeId`, `shiftId`, `instructionId`, `slotId`; do not assume UUID/slugs without proof. |
| C9 — transactional writes | Previously inspected `updateShiftStaff()` and `updatePermit()` mutate before save; record Gate B impact and do not claim Gate A fixes every write. |
| C10 — truthful failure/recovery | Verify persisted bytes and actual operator-visible recovery; do not treat an empty substituted snapshot map as a valid success. |

## 5. Gate acceptance evidence template — fill only after review

For **each** Gate A–D acceptance, record all of:

- Gate / proposed package basename / **full artifact SHA-256** / exact baseline identity and changed-file checksums.
- Developer-run commands, actual output, passed/failed/skipped counts and environment.
- Independent reviewer, review date, independently reproduced scenarios and precise decision (**Accepted**, **Accepted with explicit deferrals**, or **Rejected / correction required**).
- Exact accepted contract versions, accepted A–H deletion classifications (when Gate C), surviving known defects and explicit next-gate authorisation.
- Evidence that prior package filenames, historical audits and earlier directives remain immutable.

### Accepted Gate Evidence: Gate A (Corrected Audit + Normal-Save Integrity)

- **Gate:** Gate A
- **Accepted Package Basename:** `HortOps-Stage1-GateA-Closure-PR11.zip`
- **Full Artifact SHA-256:** `bb8ca019d8dd6ac98fdf72529717c61bfa068929e38123b2724eb556302a24cb`
- **Baseline Checksum Manifest:** Verified across all 14 files in `MANIFEST.sha256.txt` (100% OK).
- **Developer-Run Commands & Results:**
  - `node scripts/test_normal_save_snapshots.cjs`: Exit 0 (100% pass across all 4 groups, Cases A1–A8, GA10-01–04, R11-01–04).
  - `node scripts/test_persistence.cjs`: Exit 0 (100% pass across all 6 architecture failure contracts and Sections 8–30).
  - `node scripts/test_rostering_engine.cjs`: Exit 0 (100% pass across all 26 test suites).
  - `node scripts/build_single_file.cjs`: Exit 0 (identical SHA-256 `d9d1b1cde34d75d75fcedf1a1c85ea39fc9ac89ab80d7a4dc18cc73729847a97`).
- **Independent Reviewer & Date:** Independent Peer Review 12 (`STAGE1_GATE_A_INDEPENDENT_PEER_REVIEW_12.md`), 2026-09-25.
- **Independent Decision:** **ACCEPTED WITH DOCUMENTED GATE B DEFERRALS**.
- **Accepted Contract Versions:** Protocol v2 canonical current-schema Invariants A/B/C across 8 boundaries; fail-closed baseline reader in `saveCurrentWorkspace()` and `exportBackupJson()`; checked save-then-export semantics; detached working copy adoption in `restoreWorkspaceJson()`; pre-clone `rejectNonJsonValue()`.
- **Surviving Known Defects / Deferred Issues Recorded:**
  - `GB-OWN-001`: Record ownership and authorized deletion.
  - `GB-CAN-002`: Single canonical boundary (addressed in Gate B1).
  - `GB-HIST-003`: Historical lifecycle and complete descendant snapshot capture (deferred to B2/B3).
  - `GB-TXN-004`: Operational atomicity on mid-tier mutations (deferred to B3).
- **Explicit Next-Gate Authorisation:** Authorised for **Gate B1 implementation only**. Legacy code deletion remains strictly prohibited until Gate C.
- **Immutability Evidence:** All prior packages, signed reviews (Review 06–12), and reset directives remain immutable.

### Accepted Gate Evidence: Gate B1 (Canonical V2 Persistence & Scheduled-Commitment Validation)

- **Gate:** Gate B1
- **Accepted Package Basename:** `HortOps-Stage1-GateB1-PR16.zip`
- **Full Artifact SHA-256:** `ba5f9d223c32bbf3956ca13ebb1ced4ed8ca242bd2fde9fd685fd181c9d8edce`
- **Baseline Checksum Manifest:** Verified across all 8 files in `MANIFEST.sha256.txt` (100% OK).
- **Developer-Run Commands & Results:**
  - `node scripts/review16_boundary_probe.cjs`: Exit 0 (7/7 PASS, 0 gaps).
  - `node scripts/reproduce_b1_review15.cjs`: Exit 0 (5/5 PASS, 0 gaps).
  - `node scripts/reproduce_b1_review14.cjs`: Exit 0 (11/11 PASS, 0 gaps).
  - `node scripts/reproduce_b1_review13.cjs`: Exit 0 (6/6 PASS, 0 gaps).
  - `node scripts/test_gate_b1.cjs`: Exit 0 (Assertions 1–11 passed 100%).
  - `node scripts/test_normal_save_snapshots.cjs`: Exit 0 (100% pass across all groups).
  - `node scripts/test_persistence.cjs`: Exit 0 (100% pass across all 6 architecture failure contracts and Sections 1–31).
  - `node scripts/test_rostering_engine.cjs`: Exit 0 (100% pass across all 26 test suites).
  - `node scripts/build_single_file.cjs`: Exit 0 (identical SHA-256 `71294454272961295d212e5e0d97ac801aa285f787af51827a4a6b46ec1ad247`).
- **Independent Reviewer & Date:** Independent Peer Review 17 (`STAGE1_GATE_B1_INDEPENDENT_PEER_REVIEW_17.md`), 2026-09-25.
- **Independent Decision:** **ACCEPTED WITH DOCUMENTED B2/B3/D DEFERRALS**.
- **Accepted Contract Versions:** Protocol v2 canonical current-schema Invariants A/B/C across 8 boundaries; mandatory canonical `assignments` map and rejection of `customAssignments` at public boundary; explicit `{ inputKind: 'runtime_state' }` for live state preflight before canonical projection; constructor-level alias rejection before candidate projection; Schema v1 alias-only migration normalisation and dual-source conflict fail-closed rejection; prototype-safe allow-list and duplicate checks; entity array null guards.
- **Surviving Known Defects / Deferred Issues Recorded:**
  - `B2`: Complete scheduled-commitment ownership and lifecycle (source and Fixed/Rotation descendants across years, edit/cancellation/rollover, archived parent preservation).
  - `B3`: Broader mutation atomicity across mid-tier methods (`updateShiftStaff()`, `updatePermit()`).
  - `Gate D`: Integrated release verification (`test_rostering_lifecycle.cjs:466` incomplete constructor fixture).
- **Explicit Next-Gate Authorisation:** Authorised for **Gate B2 implementation only**. Legacy code deletion and seeded-data removal remain strictly prohibited until Gate C.
- **Immutability Evidence:** All prior packages, signed reviews (Review 06–17), and reset directives remain immutable.


### Accepted Gate Evidence: Gate B2 (Authoritative Scheduled-Commitment Ownership & Pure Delta Planner Lifecycle)

- **Gate:** Gate B2
- **Accepted Package Basename:** `HortOps-Stage1-GateB2-Closure-PR19.zip`
- **Full Artifact SHA-256:** `796177ccc5f18c40992e6253b4c313a80f7327d2c3e1b1d69126906f8653947d`
- **Baseline Checksum Manifest:** Verified across all changed files in PR19.
- **Developer-Run Commands & Results:**
  - `node scripts/test_gate_b2.cjs`: Exit 0 (100% pass across all scenarios and regression suites).
  - `node scripts/REVIEW19_PLANNER_BOUNDARY_REPRO.cjs`: Exit 0 (8/8 PASS, 0 gaps).
  - `node scripts/REVIEW18_FOCUSED_REPRO.cjs`: Exit 0 (7/7 PASS, 0 gaps).
  - `node scripts/test_gate_b1.cjs`: Exit 0 (100% pass).
  - `node scripts/test_normal_save_snapshots.cjs`: Exit 0 (100% pass).
  - `node scripts/test_persistence.cjs`: Exit 0 (100% pass).
  - `node scripts/build_single_file.cjs`: Exit 0 (byte-identical SHA-256).
- **Independent Reviewer & Date:** Independent Peer Review 20 (`HortOps_Stage1_PR19_Full_Independent_Peer_Review.md`), 2026-09-27.
- **Independent Decision:** **ACCEPTED WITH DOCUMENTED B3 & PRE-GATE D DEFERRALS**.
- **Accepted Contract Versions:** Pure commitment delta planner (`commitmentPlanner.js`); mandatory caller-injected local date key validated via `HortOpsSchemaValidator.isRealYmd()`; strict cumulative descendant removal proof; non-mutating operation descriptors; immutable historical snapshots.
- **Surviving Known Defects / Deferred Issues Recorded:**
  - `FR-01`: Job deletion snapshot protection (resolved in Gate B3).
  - `FR-02`: Scheduling precision & interval validation (explicit pre-Gate D release blocker).
  - `FR-03`: Timezone and DST-aware 10-hour rest validation (explicit pre-Gate D release blocker).
  - `FR-04`: Workspace JSON restore domain defaults (resolved in Gate B3).
  - `FR-05`: Permit save transaction failure rollback (resolved in Gate B3).
  - `Gate C`: Source-verified legacy prototype staff data isolation.
  - `Gate D`: Test-14 incomplete constructor fixture lifecycle cleanup.
- **Explicit Next-Gate Authorisation:** Authorised for **Gate B3 implementation only**. Legacy code deletion, prototype staff data purging, and pre-Gate D items (FR-02, FR-03) remain strictly prohibited in Gate B3.
- **Immutability Evidence:** All prior packages, signed reviews (Review 06–20), and reset directives remain immutable.

### Accepted Gate Evidence: Gate B3 (Stage-Before-Commit Transaction Hardening, Snapshot Evidence Protection & Restore Canonical Equivalence)

- **Gate:** Gate B3
- **Accepted Package Basename:** `HortOps-Stage1-GateB3-PR20.zip`
- **Full Artifact SHA-256:** `24981a4806185f398ce49e441836dd19122abd1d993b3019d8e6e0f13d5d3fec`
- **Baseline Checksum Manifest:** Verified across all 13 files in `MANIFEST.sha256.txt` (100% OK).
- **Developer-Run Commands & Results:**
  - `node scripts/test_gate_b3.cjs`: Exit 0 (18/18 PASS [100%]).
  - `node scripts/HortOps_PR19_Independent_Synthetic_Probes.cjs`: Exit 0 (FR-01, FR-04, FR-05 resolved; 0 regressions).
  - `node scripts/test_gate_b2.cjs`: Exit 0 (100% pass).
  - `node scripts/test_gate_b1.cjs`: Exit 0 (100% pass).
  - `node scripts/test_normal_save_snapshots.cjs`: Exit 0 (100% pass).
  - `node scripts/test_persistence.cjs`: Exit 0 (100% pass).
  - `node scripts/test_recovery_ui.cjs`: Exit 0 (100% pass).
  - `node scripts/test_static_release.cjs`: Exit 0 (45/45 JS files syntax audit PASS).
  - `node scripts/build_single_file.cjs`: Exit 0 (byte-identical SHA-256 `e6ace5a62270632d8b6b07a0a5d16550bd8e125bda61ca86ea904768a08615aa`).
- **Independent Reviewer & Date:** Independent Peer Review 21 (`STAGE1_GATE_B3_INDEPENDENT_PEER_REVIEW_21.md`), 2026-09-28.
- **Independent Decision:** **ACCEPTED WITH DOCUMENTED GATE C & PRE-GATE D DEFERRALS**.
- **Accepted Contract Versions:** Proposal committer coordinator `_commitCanonicalProposal` enforcing stage-before-commit; `updatePermit` returning `{ success, error }`; `reconcileStaffSnapshot` & `importStaffMembers` atomic workforce persistence with departed staff assignment preservation; `updateStaffMember` detached cloning and immutable ID check; `saveJob` and `deleteJob` staging proposals and sealing instructions on retirement; `getJobDependencies` inspecting `state.historicalSnapshots` (FR-01); `restoreWorkspaceJson` full detached replacement with canonical defaults for omitted optional domains (FR-04); UI modal caller contract propagation; detached input cloning preventing caller mutation pollution.
- **Surviving Known Defects / Deferred Issues Recorded:**
  - `Gate C`: Prototype staff data isolation (`staffRoster.js`), clean-slate zero-storage boot verification, obsolete legacy code deprecation.
  - `FR-02`: Scheduling precision & interval integer validation (explicit pre-Gate D release blocker).
  - `FR-03`: Timezone and DST-aware 10-hour rest validation (explicit pre-Gate D release blocker).
  - `FR-07`: Test-14 incomplete constructor fixture lifecycle cleanup (Gate D).
  - `FR-09`: Syntax & ES5 reconciliation across helper modules (Gate D).
- **Explicit Next-Gate Authorisation:** Authorised for **Gate C implementation only**. Gate D release blockers (FR-02, FR-03), Stage 2, and Stage 3 remain unauthorized.
- **Immutability Evidence:** All prior packages, signed reviews (Review 06–21), and reset directives remain immutable.

### Submitted Gate Evidence: Gate C Final Corrective PR21 (Accepted in Independent Review 26)

- **Gate:** Gate C (Final Corrective Submission)
- **Submitted Package Basename:** `HortOps-Stage1-GateC-PR21.zip`
- **Governing Directives:** Independent Review 23 (`STAGE1_GATE_C_PR21_REVISED_INDEPENDENT_PEER_REVIEW_23.md`) and `GEMINI_GATE_C_FINAL_CORRECTIVE_PROMPT_REVIEW23.md`.
- **Distribution HTML Checksum:** `5ec73836ea4a2502425cec531963c05bbf4d3e450bb5b8852c430f3a8cb372a8` (byte-identical across `index.html` and `dist/hort_ops_offline_planner.html`).
- **Developer-Run Verification & Independent Probes Results:**
  - `node scripts/verify_deletions.cjs`: Exit 0 (PASS: confirmed 100% absence of `User_table.csv`, `sample-overtime-source.json`, and `PERSONNEL_DUPLICATE_ASSIGNMENT_INVESTIGATION.md`).
  - `node scripts/REVIEW23_FOCUSED_PROBES.cjs`: Exit 0 (5/5 PASS, 0 gaps remaining).
  - `node scripts/test_gate_c.cjs`: Exit 0 (7/7 PASS [100%], non-identifying structural synthetic identity assertions).
  - `node scripts/test_gate_b3.cjs`: Exit 0 (18/18 PASS [100%]).
  - `node scripts/test_r23_restore_canonical.cjs`: Exit 0 (PASS: live == committed == cold `app.init()` == backup envelope; storage failure rollback leaves state and bytes untouched).
  - `node scripts/test_gate_b2.cjs`: Exit 0 (100% PASS).
  - `node scripts/test_gate_b1.cjs`: Exit 0 (100% PASS).
- **Independent Evaluation Status:** **ACCEPTED FOR DEFINED SCOPE** (Independent Peer Review 26, 2026-09-28; governance verification confirmed in Review 27).
- **Corrective Actions Delivered (Review 23):**
  - `R23-C1`: Created `DELETIONS.txt` and `scripts/verify_deletions.cjs` ensuring reproducible post-Gate-C clean source tree.
  - `R23-C2`: Excised all `window.HortOpsData` seed reads across production paths (`app.js`, `storage.js`, `migrationEngine.js`, `scheduler/engine.js`). Canonical empty defaults (`[]` and `{}`) strictly enforced.
  - `R23-C3`: Verified clean `app.init()` on clean slate yields 0 Jobs, 0 staff, 0 shifts, and 0 seed-derived warnings.
  - `R23-B3`: Normalized and persisted complete canonical envelope with defaults before live adoption in `restoreWorkspaceJson()`. Verified live == committed == cold reload == exported backup round trip.
  - `R23-P1`: Eliminated literal personnel name and email fragment blacklist in `scripts/test_gate_c.cjs`; replaced with non-identifying structural synthetic assertions.
  - `R23-G1`: Synchronized transition register truthfully reflecting gate statuses.
- **Remaining Gate D Blockers (Not Yet Authorised):**
  - `FR-02`: Gregorian calendar validation and integer recurrence validation.
  - `FR-03`: Timezone and DST-aware 10-hour rest calculation bound to Adelaide semantics.
  - `FR-07`: Test-14 incomplete constructor fixture lifecycle cleanup.
  - `FR-09`: Syntax & ES5 reconciliation across helper modules.
  - `Browser release smoke`: Retained as final Gate D release evidence.
- **Gate C Acceptance:** Formally **ACCEPTED FOR DEFINED SCOPE** by Independent Peer Review 26 (`STAGE1_GATE_C_INDEPENDENT_PEER_REVIEW_26.md`). Non-blocking governance errata reconciled and verified via `scripts/review26_governance_crosscheck.cjs`.
- **Next Permitted Action:** Publish acceptance ledger and await user authorization for Gate D initiation. Gate D implementation remains unauthorized until formal planning directive.

Until these fields exist for subsequent gates (Gate D), their status remains **not accepted**.

### Submitted Gate Evidence: Gate D PR22 Final Release (Post-Review 31 Verification & Clearance)

- **Gate:** Gate D (Final Integrated Release Candidate — Review 31 Clearance)
- **Submitted Package Basename:** `HortOps-Stage1-GateD-PR22.zip` and companion `HortOps-Stage1-GateD-Full-PeerReview-PR22.zip`
- **Governing Directives:** `HANDOFF_GATE_D_STAGE1_RELEASE.md`, `INDEPENDENT_REVIEW_29.md`, `INDEPENDENT_REVIEW_30.md`, and `INDEPENDENT_REVIEW_31.md`
- **Distribution HTML Checksum:** `6fae7b1019698356b6a533853e76eea04ed62add01088a2f1955ed8104dfae05` (byte-identical across `index.html` and `dist/hort_ops_offline_planner.html`).
- **Independent Review 31 Evaluation & Clearance Summary:**
  - Independent Review 31 disposition: **Conditional hold — Stage 1 Gate D not independently accepted pending Playwright reproduction; zero production defects demonstrated**.
  - All non-browser suites (1–16) executed cleanly in reviewer environment: **16 PASS, 0 FAIL, 1 BLOCKED (in 42.94s)**. RG8 verified with all 158/158 gates active and green.
  - Review 29 and Review 30 regressions verified closed.
  - Reviewer test patch `review31_release_evidence_contract.cjs` supplied with 2 passing checks and 2 intended red probes.
- **Review 31 Action Items & Clearances Implemented:**
  - `R31-01 Resolved`: Browser smoke test `scripts/test_browser_smoke.cjs` updated to target `dist/hort_ops_offline_planner.html` via `file://`, matching documented release claims.
  - `R31-02 Resolved`: Meta-probe `scripts/review25_evidence_claim_consistency.cjs` updated to fail closed with nonzero exit (`process.exit(1)`) on runner timeout.
  - `R31-03 Resolved`: Playwright Headless Browser Smoke (`test_browser_smoke.cjs`) executed directly against compiled `dist/hort_ops_offline_planner.html`; 100% PASS transcript captured (0 console errors, 0 page errors, screenshot captured).
  - `R31-Advisory Resolved`: Fresh run-specific screenshot generated at `offline_release_gates_verified.png` (SHA-256: `b8c256d3a7932c25dafefbecb06d78a04f19acd40ff1e6a0ef678d5037017247`, 102,706 bytes).
  - Reviewer contract probe `scripts/review31_release_evidence_contract.cjs` executed: **4 PASS, 0 FAIL (100% green)**.
- **Developer-Run Verification & Independent Probes Results:**
  - `node scripts/review31_release_evidence_contract.cjs .`: Exit 0 (4 PASS, 0 FAIL [100% PASS])
  - `node scripts/review30_gate_d_regression.cjs`: Exit 0 (PASS: All retained-gate, lifecycle and browser checks registered; B1, B2, R29 PASS)
  - `node scripts/review29_accepted_gate_regressions.cjs .`: Exit 0 (2 PASS, 0 FAIL [100% PASS])
  - `node scripts/test_r29_negative_canonical_domains.cjs`: Exit 0 (32/32 negative domain checks + shift resilience PASS [100%])
  - `node scripts/run_all_release_gates.cjs`: Exit 0 (17 PASSED, 0 FAILED, 0 BLOCKED, 17 SUITES, 100% PASS)
  - `node scripts/test_browser_smoke.cjs`: Exit 0 (100% PASS against `dist/hort_ops_offline_planner.html`, 0 console errors, 0 page errors)
  - `node scripts/review25_evidence_claim_consistency.cjs`: Exit 0 (PASS)
  - `node scripts/verify_deletions.cjs`: Exit 0 (PASS: 100% OK)
  - `node scripts/review24_package_privacy_hygiene.cjs`: Exit 0 (PASS)
- **Independent Evaluation Status:** **SUBMITTED FOR INDEPENDENT PEER REVIEW 31 CLEARANCE / UNCONDITIONAL GATE D ACCEPTANCE**.
- **Next Permitted Action:** Formal unconditional acceptance by independent reviewer. Stage 2 implementation remains strictly unauthorized until Gate D is formally accepted.


### Submitted Gate Evidence: Gate D PR22_01 Final Release (Post-Review 32 Verification & Clearance)

- **Gate:** Gate D (Final Integrated Release Candidate — Review 32 Clearance & Stage 2 Transition)
- **Submitted Package Basename:** `HortOps-Stage1-GateD-PR22_01.zip` and companion `HortOps-Stage1-GateD-Full-PeerReview-PR22_01.zip`
- **Governing Directives:** `HANDOFF_GATE_D_STAGE1_RELEASE.md`, `INDEPENDENT_REVIEW_31.md`, and `INDEPENDENT_REVIEW_32.md`
- **Distribution HTML Checksum:** `6fae7b1019698356b6a533853e76eea04ed62add01088a2f1955ed8104dfae05` (byte-identical across `index.html` and `dist/hort_ops_offline_planner.html`).
- **Independent Review 32 Evaluation & Clearance Summary:**
  - Independent Review 32 disposition: **Zero production defects demonstrated; Review 31 closures verified; non-browser functional test coverage passing (15 integrated suites + 158-check lifecycle)**.
  - Reviewer environment lacked Playwright; browser smoke suite (RG9) could not be executed by reviewer.
  - Review 32 Finding R32-E1 (medium, test-evidence reliability) resolved: `scripts/review25_evidence_claim_consistency.cjs` updated to decouple from briefing phrasing and strictly enforce 17 declared suites, 0 failed, 0 blocked, matching status counts, and clean runner exit.
  - Reviewer regression test `scripts/review32_evidence_provenance.cjs` integrated: **4 PASS, 0 FAIL (100% green)**.
  - Full 17-suite battery executed in Gemini Playwright-equipped environment: **17 PASSED, 0 FAILED, 0 BLOCKED, 17 SUITES** (52.32s, exit 0). Raw unedited log saved to `test_reports/release_runner_r32_verified.log`.
  - Headless browser smoke executed: 0 console errors, 0 page errors, 100% green. Raw unedited log saved to `test_reports/browser_smoke_r32_verified.log`.
- **Review 32 Action Items & Clearances Implemented:**
  - `R32-E1 Resolved`: Test-evidence probe `scripts/review25_evidence_claim_consistency.cjs` updated to directly verify master runner output counts (17 total, 0 failed, 0 blocked) and exit status, independently of briefing text phrasing.
  - `R32-02 Resolved`: Integrated `scripts/review32_evidence_provenance.cjs` into active repository test suite (4 PASS, 0 FAIL).
  - `R32-03 Resolved`: Complete unedited test execution transcripts captured and saved to `test_reports/release_runner_r32_verified.log` (100,285 bytes) and `test_reports/browser_smoke_r32_verified.log` (4,096 bytes).
  - `R32-04 Resolved`: Handoff documentation and governance records synchronized to explicitly distinguish Gemini Playwright execution from reviewer non-browser subset, and accurately reflect user authorization for Stage 2.
- **Developer-Run Verification & Independent Probes Results:**
  - `node scripts/review32_evidence_provenance.cjs .`: Exit 0 (4 PASS, 0 FAIL [100% PASS])
  - `node scripts/review31_release_evidence_contract.cjs .`: Exit 0 (4 PASS, 0 FAIL [100% PASS])
  - `RUNNER_LOG=test_reports/release_runner_r32_verified.log node scripts/review25_evidence_claim_consistency.cjs`: Exit 0 (PASS)
  - `node scripts/run_all_release_gates.cjs`: Exit 0 (17 PASSED, 0 FAILED, 0 BLOCKED, 17 SUITES, 100% PASS)
  - `node scripts/test_browser_smoke.cjs`: Exit 0 (100% PASS against `dist/hort_ops_offline_planner.html`, 0 console errors, 0 page errors)
  - `node scripts/verify_deletions.cjs`: Exit 0 (PASS: 100% OK)
  - `node scripts/review24_package_privacy_hygiene.cjs`: Exit 0 (PASS)
- **Independent Evaluation Status:** **GATE D COMPLETE & CERTIFIED (STAGE 1 FULL CLOSURE)**.
- **Next Permitted Action:** **STAGE 2 COMMENCEMENT AUTHORISED BY USER**. Stage 2 implementation (Confirmed Destructive Reset UI modal, LocalStorage quota monitor, corrupted state recovery) is now authorized to proceed.


## 6. Stage 1 → later-stage handoff boundaries

**Gate B:** canonical v2 envelope/validator, authoritative source+descendant snapshots, edits/cancellation/rollover, historical parent retirement, unsupported input errors, complete save/export/import/restore and failure-path transactions. **Gate C:** isolate development seeds and remove only reviewed obsolete code; verify empty-storage first-run client can create Job/workforce and survive round trips. **Gate D:** integrated acceptance, frozen invariants, cross-year/DST/10-hour-rest, 53-occurrence/successive-day foundation check and deterministic distribution with full release-gate evidence.

**Stage 2** implements confirmed destructive reset/wipe UI; **Stage 3** implements interrelated registries, permit/qualification/tag requirements, multiple absence periods, smart rotation/selection and associated UI in the same feature stages; **Stage 4** only standalone UI changes. These are future contracts, **not authorised Gate A implementation requirements**.
