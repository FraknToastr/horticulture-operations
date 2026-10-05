# Horticulture Overtime Planner — Independent Peer Review 12

**Submission:** `HortOps-Stage1-GateA-Closure-PR11.zip`  
**Decision:** **GATE A ACCEPTED WITH EXPLICIT GATE B DEFERRALS.**  
**Review standard:** Stage 1 Peer Review Protocol v2 and Review 11's fixed, bounded five-probe acceptance contract.  
**Scope:** Gate A canonical current-v2 presence, existing historical-evidence retention protections, save/export/import/restore integrity and truthful governance status. This decision **does not** accept the entire Stage 1, approve legacy deletion, certify all operational mutations, or imply a production-ready release.

## 1. Executive decision and why the review cycle stops here

The PR11 submission closes **all four specific Review 11 code findings** at their actual application entry points. Independently rerunning the Review 11 reproduction script yielded **five passes and zero remaining gaps**. A separate seven-case adversarial script verified non-JSON rejection, successful restore detachment and governance-ledger structure. The focused Gate A and existing Persistence suites passed when PR11 was overlaid on the reconstructed previous package; the standalone distributions reproduced byte-for-byte.

Review 08–11 repeatedly exposed related data-boundary errors. Under Protocol v2's anti-recurrence rule, we will **not** reopen successfully corrected Gate A cases to enforce yet another undocumented closure criterion. The broader, already documented absence of a unified authorized-deletion/record-ownership contract remains Gate B's work (`GB-OWN-001`). The missing comprehensive descendant-commitment capture and transactional operational mutations also remain Gate B. They are not newly discovered Gate A regressions.

## 2. Exact baseline, integrity and packaging

- Reconstructed project: the previous independently assembled project through PR10, overlaid with each file from this PR11 incremental submission. The parent assembly used `Offline2-Overtime-Planner.zip`, then EligibilityFix, CorrectiveFix, FinalClosure, FinalClosure(1), PR04, PR05, ArchitectureAudit, GateA-Corrected and GateA-Closure PR08→PR09→PR10 in order.
- Submitted PR11 archive: **14 entries; no duplicate names or path traversal; ZIP CRC test passed; all 13 non-manifest SHA-256 entries match.** Archive SHA-256: `bb8ca019d8dd6ac98fdf72529717c61bfa068929e38123b2724eb556302a24cb`.
- Code changes from PR10: `js/app.js`, `js/components/exportModal.js`, `js/utils/storage/schemaValidator.js`, `scripts/test_normal_save_snapshots.cjs`. Also changed: audit document, transition register, evidence report, standalone `index.html`, standalone distribution and manifest.
- Four included files are **unchanged** relative to the immediately preceding package: `js/utils/storage.js`, `js/utils/storage/migrationEngine.js`, `scripts/test_persistence.cjs`, `scripts/test_rostering_engine.cjs`. Omit these from future incremental reviewer ZIPs unless they genuinely change or are absolutely needed to apply the delta. This is packaging feedback, **not an integrity blocker**.
- Rebuilding `node scripts/build_single_file.cjs` yielded two matching **814,780-byte** standalone HTML files, identical to the submitted files; both SHA-256: `d9d1b1cde34d75d75fcedf1a1c85ea39fc9ac89ab80d7a4dc18cc73729847a97`.

## 3. Review 11 finding-by-finding closure

| ID | Independent status | Source and proof | Gate A implication |
|---|---|---|---|
| R11-01 — missing committed reader | **Closed** | `js/app.js:90–105` and `js/components/exportModal.js:35–37`; reviewer removed `readVerifiedCommittedV2`, inserted corrupt committed bytes and called the **actual** save and exporter. Save returned `false`, raw bytes remained unchanged; exporter returned `false`, zero downloads. | The reader is mandatory in both affected callers. |
| R11-02 — backup silently excludes live edits | **Closed** | `exportModal.js:39–109` preflights the live candidate, verifies existing committed state and evidence-key retention, calls actual `HortOpsApp.saveCurrentWorkspace()`, rereads the committed bytes and downloads that exact payload. Reviewer edited a live Job name without saving: exported JSON and newly committed workspace both contained the edit. | The declared complete-backup contract is now truthful under the tested persistent-storage path. |
| R11-03 — successful restore retains raw budget alias | **Closed** | `app.js:497–516` now adopts `adoptedData.budgetSettings` and reads only `adoptedData.uiState` after validation/save. Reviewer mutated the caller's input **after** successful restoration; budget, active view and year remained stable. Previously passing rejected-restore nonmutation coverage also passes. | Raw import objects no longer remain referenced via these two paths. |
| R11-04 — JSON cloning launders invalid values | **Closed for the defined pre-clone contract** | `schemaValidator.js:729–773` rejects non-finite numbers, functions, `undefined`, unsupported objects, accessors and cycles before cloning. Independent additional probes confirmed `NaN`, function, `undefined`, cyclic and accessor rejection, unchanged prior storage; the original Review 11 repro confirmed `Infinity`. | Full semantic nested-snapshot validation (date/time/identity/crew) remains Gate B, not a reason to re-open this pre-clone fix. |
| R11-05 — governance ledger | **Functional ledger corrected; minor text hygiene outstanding** | `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md` has exactly one Gate A row under §3, points to PR11 pending external acceptance and has no malformed row appended to §6. One inherited mojibake token, `Â·`, remains on line 3; the review-acceptance status naturally needs updating after this independent decision. | Make the two administrative updates in Gate B1; do not demand another Gate A ZIP solely for this typography. |

**Test-quality qualification:** Gemini's newly added R11-04 case exercises `Infinity` but its label says “Infinity/NaN”. We independently exercised `NaN` and other non-JSON types. If updating that test for B1, make its assertion text match the actual inputs rather than duplicating the existing large suite.

## 4. Eight-boundary coverage — precise scope, no transitive pass claims

| Boundary | Gate A verification | Remaining contract / owner |
|---|---|---|
| First-run construction | Existing A1 focused test: explicitly empty evidence maps save and reload successfully. | Removal of seeded Jobs/staff/historical fixture remains **Gate C**. |
| B1 `HortOpsStorage.saveWorkspace()` | A2 and independent R11-04: raw required maps and pre-clone non-JSON checks reject invalid inputs without replacing bytes. | Intent-aware authorized whole-workspace replacements, record ownership and complete nested semantics: **Gate B**. |
| B2 `loadWorkspace()` + real `HortOpsApp.init()` | A3 and real lifecycle Group 1: invalid stored current-v2 is quarantined and authoritative saved timing reloads. | Additional validity of snapshot contents and complete historic capture: **Gate B**. |
| B3 `HortOpsApp.saveCurrentWorkspace()` | A1/Group 1/GA10-03/R11-01 reviewer probe: normal saving retains existing timing and refuses corrupt or unverifiable committed state. | Guarding all operational writes and distinguishing legitimate versus accidental deletion of rostering identities: **Gate B**. |
| B4 `createWorkspaceEnvelope()` | GA10-01 executed: raw incomplete current-v2 evidence cannot be silently defaulted into validity. | Consolidate normal envelope construction, make explicit current schema and separate trusted fresh/v1 constructors: **Gate B1**. |
| B5 `prepareWorkspaceJsonImport()` | A4 executed: incomplete v2 rejected irrespective of assignment count; valid explicit-empty accepted. | Separate v1 migration retained until **Gate C**. |
| B6 `restoreWorkspaceJson()` | A5/GA10-04b and reviewer R11-03: rejected restore leaves bytes and memory unchanged; accepted restore adopts detached budget and UI state. | Full deletion/retirement authorization and transactional state replacement: **Gate B**. |
| B7 `exportBackupJson()` | A6/A7 and reviewer R11-01/R11-02: verified existing baseline, evidence retention, checked save, exact committed bytes and no download on failure. | Make `checkEvidenceKeyRetention` a *mandatory* dependency during B1 consolidation, and remove masking `|| {}` fallbacks from live projection. Currently the real bundled validator is present and the tested normal paths pass. |

## 5. Independent execution record

Execution against the reconstructed **PR11** project, not a developer-provided test log:

| Command or independent probe | Observed result |
|---|---|
| `node scripts/test_normal_save_snapshots.cjs` | Exit **0**; real save→Job edit→`init()`→insufficient-rest rejection; A1–A8, Review 10 and Review 11 cases passed. |
| `node scripts/test_persistence.cjs` | Exit **0**; all canonical Persistence cases and six missing-dependency contracts passed. |
| Reviewer-only `REVIEW11_FOCUSED_REPRO.cjs` | Exit **0**, **5/5 passes**, 0/5 remaining gaps. Actual save/export/restore/boundary methods were invoked. |
| Reviewer-only additional probes | Exit **0**, **7/7 passes**, 0 failures: `NaN`, function, `undefined`, cyclic value, accessor, accepted restore detachment of budget/UI/year, unique Gate A ledger row. |
| `node scripts/build_single_file.cjs`; byte/hash comparison | Exit **0**; both output HTML files identical to submitted payloads and each other. |
| Submitted checksums and ZIP CRC | **13/13 valid**, no duplicate ZIP paths. |
| Rostering Engine 26 groups | Developer reports pass; **not independently rerun for this reviewer cycle**, because no rostering engine or scheduler source changed. |
| Playwright/browser UI | **Not independently executed**. No new UI control was introduced; B1 may use a targeted smoke if a visible backup/recovery interaction changes. |

## 6. Material remaining issues — explicitly assigned, not new Gate A blockers

**GB-OWN-001, record ownership and authorized deletion:** A direct complete-v2 replacement can still delete identity keys. `saveCurrentWorkspace()` protects historic snapshot keys and `exportBackupJson()` protects all three evidence maps on its normal path, but normal operational reconciliation and intentional whole-workspace replacement do not yet share a universal authorization contract. Gate B must distinguish legitimate cancellation, instruction replacement and explicit operator-approved import from accidental loss. Do not naively make all keys permanently undeletable.

**GB-CAN-002, single canonical boundary:** `app.js` still has a fallback envelope builder; the exporter constructs a second live projection that uses `||` to invent empty evidence maps. B1 must move these callers to one validated projection and require the validator and retention helper rather than treat either as optional. An absent helper must not silently bypass protection.

**GB-HIST-003, historical lifecycle:** Newly committed Fixed/Rotation descendant occurrences currently lack complete authoritative snapshots; mutable Job edits, inactive parents, rollover and cancelled future allocations need coherent, tested ownership rules. B2/B3 must cover them without claiming planned commitments are verified hours actually worked.

**GB-TXN-004, operational atomicity:** `updateShiftStaff()` and `updatePermit()` can mutate live state before persistence fails; cover the meaningful actual editing pathways in B3. No blanket workspace-reset feature belongs here.

**Documentation/packaging:** Correct the single `Â·` token and enter this external acceptance in the active register in the next B1 documentation update. Future peer-review ZIPs must omit unchanged source/tests. Record this acceptance with the above archive SHA-256; do not rewrite old signed-off reviews.

## 7. Formal acceptance and next authorization

**Gate A: ACCEPTED WITH DOCUMENTED GATE B DEFERRALS.** Required PR11 functional corrections, the actual Gate A A1–A8 test contract, focused adversarial reproductions and deterministic build are satisfied. The next authorized activity is **Gate B1: canonical supported-v2 envelope and strict scheduled-commitment validation**, in a single bounded package reviewed before B2. **Legacy code deletion remains prohibited until Gate B's complete lifecycle is accepted and the Gate C deletion matrix is explicitly approved.** Stage 2–4 feature development remains unchanged and unauthorised within Gate B1.
