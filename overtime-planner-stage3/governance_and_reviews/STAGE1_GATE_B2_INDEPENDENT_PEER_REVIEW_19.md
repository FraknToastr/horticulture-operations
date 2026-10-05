# Horticulture Overtime Planner — Stage 1 Gate B2 Independent Peer Review 19

**Submission:** `HortOps-Stage1-GateB2-PR18.zip`  
**Submitted ZIP SHA-256:** `649dadbd145097a4c5f88a7fe441d1e09183d3486a39986df697da4e7a244f73`  
**Baseline:** Reconstructed PR17 modular project from the previous independent Review 18, with all 12 submitted PR18 members overlaid; no unrelated source changes.  
**Decision:** **Gate B2 remains open for one bounded, same-module planner-contract correction.** Gate A and B1 remain accepted. Do not commence Gate B3, C, Stage 2/3 or Codex smart-rostering implementation. No constitutional or roadmap amendment is indicated by the new findings.

## 1. Result and proportionality

PR18 **genuinely fixes the three Review 18 code causes in the actual modal/application paths** and the prior timestamp issue. The unchanged original independent Review 18 script was shipped byte-identically; it passed **7/7** when independently rerun. All focused Gate B2 scenarios, B1's 11 checks, Gate A normal-save, Persistence, and the 26 Rostering Engine groups passed. The standalone builder reproduced both submitted HTML files exactly, SHA-256 `80f7c07c43fd5f3adbcc28255eca462ca1e540e1ae6ce7f1a587f2e1b63fb393`.

The new issue is specifically the **public/pure `HortOpsCommitmentPlanner.plan()` contract**, not a claim that the current modal ordinarily deletes another Job's evidence. The actual modal supplies date and pruning fields. However, the planner still regards indispensable authority inputs as optional; its own exported API can approve a historical deletion without a verified date, or a descendant deletion without engine proof. Since Gate B2 is meant to establish the single authoritative planner for subsequent allocation integrations, those are same-gate acceptance defects, not a rationale for another general-purpose audit.

One minimal correction in `js/utils/rostering/commitmentPlanner.js`, plus directly affected tests and small **active** document updates, should close the issue. An eight-scenario independent focused script accompanies this review. A **separately tested, non-production reference diff** repaired all eight scenarios and preserved the previous suites in a disposable overlay. The developer may challenge that reference if the actual source requires an alternative.

## 2. Verified inventory

| Check | Independently observed |
|---|---|
| PR18 ZIP extraction and SHA-256 manifest | PASS; all 11 payload hashes matched; archive integrity PASS |
| Three changed production JavaScript files and B2 test syntax | `node --check` PASS |
| Original Review 18 discriminator, identical SHA-256 `67a0f22ee66e38ac774a51708d1f0b8fa93aaaf3cad59ce722a37ef458ff3b4f` | **7/7 PASS** |
| `node scripts/test_gate_b2.cjs` | PASS: six lifecycle scenario groups and integrated original R18 negatives |
| `node scripts/test_gate_b1.cjs` | PASS: eleven existing contract assertions |
| `node scripts/test_normal_save_snapshots.cjs` | PASS |
| `node scripts/test_persistence.cjs` | PASS |
| `node scripts/test_rostering_engine.cjs` | PASS: all 26 groups |
| `node scripts/build_single_file.cjs`, comparing both generated files with both submitted files | PASS: all four files have the identical SHA-256 above |
| New, independently constructed `REVIEW19_PLANNER_BOUNDARY_REPRO.cjs` against submitted PR18 | **2/8 PASS; six negative/purity conditions FAIL** |
| Same Review 19 script in isolated one-file experimental patch | **8/8 PASS**, plus unchanged Review 18 **7/7**, linked B2 PASS, B1 PASS |

The new failures represent **two shared input-contract causes and one minor purity issue**, not six new implementation projects. This review does not assert full browser or Gate D release testing. The existing deferred Rostering Lifecycle Test 14 is unchanged and remains Gate D debt.

## 3. Accounting for all Review 18 findings

| Previous finding | PR18 result | Independent evidence / limit |
|---|---|---|
| R18-01: optional baseline reader permitted overwriting established evidence | **Fixed in actual modal** | Reader and retention checker mandatory in `staffAssignModal.js:834–875`; missing reader and corrupt saved JSON checks pass; storage bytes preserved. |
| R18-02: missing engine fallback and public direct assignment writer bypassed snapshots | **Fixed for inspected client call paths** | Modal fails visibly if engine missing (`staffAssignModal.js:752–755`); no remaining production call to `updateShiftStaff()` found in `js/`; `app.js` method now returns false. Both original negative tests pass. |
| R18-03: occurrence journal alone authorised descendant evidence deletion | **Improved, but exported planner proof still incomplete** | Source/provenance checking prevents original unrelated-manual probe and real Fixed repeat reduction still passes. New independent tests show missing `afterRostering` or missing `prunedProvenance` is nevertheless accepted at the exposed planner interface; contradictory ownership inputs also accepted. See R19-02. |
| R18-04: hidden `new Date()` / fabricated existing `recordedAt` | **Fixed for timestamp preservation** | No `new Date()` in planner; pre-existing absent/present `recordedAt` preserved by focused test. However date-guard absence remains a different, related injected-clock input issue R19-01. |
| R18-05: ineffective archived-one-off test | **Improved accurately** | Updated actual `HortOpsApp.saveJob()` test uses recurring parent with proved future snapshot and active instruction; retirement correctly rejects and raw bytes remain unchanged. Clean-parent archival also executes. It does **not** prove automated cancellation and does not claim to. |
| R18-06: report overclaimed exact bytes / simulated export | **Corrected** | Idempotency now claims only snapshot/assignment map equality. Real `HortOpsExportModal.exportBackupJson()` is executed and actual captured bytes restored. |

## 4. Gate B2 remaining contract defects — narrowly confined to planner

### B2-R19-01 — HIGH: Missing/invalid local-date input disables historical protection

**Source:** `js/utils/rostering/commitmentPlanner.js:278–309`. The function uses `input.todayKey || window.HortOpsDateUtils.getLocalDateKey() || null`, but its historical guard is `if (todayKey && row.date < todayKey)`. In the exported planner with no injected date and no DateUtils, `todayKey=null` **turns the protection off**. The independent actual-module test deleted a snapshot dated `2020-01-04` as an ostensibly permitted future source unassignment. An invalid but nonempty supplied date such as `2026-99-99` is accepted as the comparison baseline. Neither condition should be able to grant deletion authority.

**Required:** Validate a mandatory, caller-injected Adelaide-local `todayKey` via the existing canonical real-calendar-date validator **before diffing or permitting any operation**; if it or the validator is unavailable, return `{ok:false}`. Do not introduce an internal date fallback. The real modal already injects `todayKey`; ordinary positive operations must remain unchanged. Test missing date and malformed date with unchanged supplied prior snapshots. This is a pure-planner API failure; no live modal date error was independently observed.

### B2-R19-02 — HIGH: Descendant deletion proof still has optional and contradictory branches

**Source:** `commitmentPlanner.js:141–204`, especially the two optional branches around `afterRostering` and `prunedProvenance`. The intended proof is cumulative: verified old instruction/provenance ownership **and** exact engine pruning **and** absence from the new provenance map. PR18 permits skipping the latter two if those inputs are not supplied. It also accepts an old provenance record whose `sourceShiftId` points elsewhere as long as its referenced instruction points at the edited source (an internally contradictory predecessor). These are not valid substitute proofs.

The independent script supplies a source-owned future descendant snapshot and omits either the after-provenance map or the engine pruning list; `plan()` returns `ok:true` and authorises its deletion in both cases. A separate contradictory old-provenance input also succeeds. **These are exported-planner trust-boundary tests; the actual modal supplies all three maps and the canonical committed schema separately rejects contradictory persisted source references.** The vulnerability is to optional/malformed planner inputs and future direct consumers, not a claim that current normal modal flows fabricate contradictions.

**Required:** For **descendant** evidence deletion, insist on a map-shaped `beforeRostering.instructions` and `.provenance`, map-shaped `afterRostering.provenance`, an actual array of engine `prunedProvenance`, and all of: `oldProv.source==='rostering-rule'`, valid referenced old instruction, **both** source-shift IDs equal `operation.sourceShiftId`, exact removed employee key in `prunedProvenance`, and absence in after-provenance. Reject omitted, malformed, contradictory and empty pruning proof. Keep legitimate explicit future **source** unassignment distinct; it does not require descendant pruning proof, but remains date-guarded. Preserve real cross-year Fixed repeat reduction and unrelated Manual assignments.

### B2-R19-03 — LOW: Input operation object is mutated by a supposedly pure planner

**Source:** `commitmentPlanner.js:281–285`. Setting `operation.todayKey=todayKey` modifies `input.operation` in place. An independent repeatable test observed a new property appearing on the caller's original object. Clone the small operation descriptor using ES5 own-property copying before adding the verified date. This is a minimal same-file hygiene correction, **not** justification to refactor the engine or stage new transactions.

## 5. Boundary inventory (avoid claiming unexecuted coverage)

| Boundary | Review 19 evidence |
|---|---|
| Fresh explicit-empty v2 bootstrap | Re-exercised by accepted B1 linked suite, PASS; legacy seed removal is Gate C, not attempted. |
| `HortOpsApp.saveCurrentWorkspace()` | Gate A and B1 regression suites PASS; no PR18 edit to this function. |
| Direct `HortOpsStorage.saveWorkspace()` | Existing B1/Persistence suites PASS; not a new standalone PR18 adversarial sweep. |
| `HortOpsStorage.loadWorkspace()` | B2 round-trip and B1 suite PASS. |
| Current-v2 JSON import preparation | B1 suite PASS; unchanged code in PR18. |
| `HortOpsApp.restoreWorkspaceJson()` | B2's captured-export restore and B1 suite PASS. |
| `HortOpsExportModal.exportBackupJson()` | Actual method called in corrected B2 test; Gate A original regression PASS. |
| Canonical envelope constructor + actual modal commit | Real Manual/Fixed/Rotation, repeat reconciliation and failure-rollback tests PASS; exported pure planner with incomplete input **FAIL**, as detailed above. |

## 6. Design challenge adjudication: retiring a Job with active future commitments

`DESIGN_CHALLENGE_B2.md` accurately presents two different product policies, not two equivalent implementations. The submitted code currently **rejects archive/inactivation while active future rostering remains**, with unchanged live state and raw persisted bytes. This behavior protects existing integrity and is independently tested. The alternative, a one-step **transactional future cancellation** when retiring a Job, would require explicit authorisation, exact provenance-based removal, canonical validation, and all-or-nothing persistence.

**Review disposition:** Do **not** silently turn job retirement into a cascade while closing B2. Treat the currently observed strict fail-closed workflow as a safe *interim B2 contract*; record the long-term one-step-versus-two-step product decision as **pending user decision** in Gate B3 planning. This does not select a permanent product policy or authorise B3 now. If the user explicitly requires automatic retirement during B2 instead, seek that decision separately before changing scheduling rules. Historical timing and evidence must never be deleted by either option.

## 7. Governance and package hygiene

No C1–C10 or I1–I12 amendment is necessary for PR18 or the focused closure: the findings are failures to fully enforce existing C3/C5 and the advertised pure planner contract. The proposed gate remains Gate B2 only. The independent Codex research on hybrid allocation and public holidays stays isolated Stage 3 design input.

The appended Review 18 status in `STAGE1_GATE_A_PEER_REVIEW_CONTINUITY.md` is useful, but the maintained guide still contains live-looking *“Gate A (now)”*, *“neither Gate B nor Gate C currently authorised”* and step-by-step Gate A execution prose. The governance register has a truthful PR18 **proposed** amendment row, while §3's active B2 ledger still merely says *“In Progress (Review 17)”*. Update **only maintained/current status and instructions** to a single current B2 Review 19 handoff. Keep historical records immutable; no cosmetic constitutional rewrite. The submitted inclusion of `scripts/REVIEW18_FOCUSED_REPRO.cjs` is unchanged reviewer evidence by design: carry it forward as a reusable test if desired, but next incremental ZIP should contain only genuinely changed program files, updated relevant tests/documents and rebuilt HTML files.

## 8. Single bounded closure and next review

1. Correct only the shared planner input contract in `js/utils/rostering/commitmentPlanner.js`: mandatory real `todayKey`, mandatory complete and consistent descendant proof, no input.operation mutation.
2. Integrate the focused eight independent cases into `scripts/test_gate_b2.cjs`, **without editing the reviewer-owned `REVIEW19_PLANNER_BOUNDARY_REPRO.cjs`**. Keep the unchanged Review 18 discriminator as an independent regression.
3. Re-run Review 19 **8/8**, unchanged Review 18 **7/7**, focused B2 and B1, Gate A normal-save and affected Persistence; Rostering Engine 26 only if relevant consumed behavior changes. Rebuild both HTML files and verify identical hashes/manifest. No full Gate D test run for this one-module correction.
4. Update the PR evidence report and the two *active* status sections described above. Package only changed source/tests/docs and the two newly generated standalone files; stop for **Review 20**. Do not begin Gate B3 or delete seeded/legacy code.

**Independent reference:** The accompanying `REVIEW19_TESTED_ONE_FILE_REFERENCE.patch` is a near-drop-in **reviewer-tested reference, not applied to the user's PR18**. In a disposable overlay the complete 8/8 Review 19 suite, original 7/7 Review 18 suite, focused B2 suite and B1 suite all passed. Gemini may implement an equivalent narrower change or submit a tightly scoped `DESIGN_CHALLENGE_B2.md` if it identifies a genuine legacy-import or source-ownership incompatibility. That is a micro-review, not a reopening of accepted gates.
