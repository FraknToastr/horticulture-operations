# Horticulture Overtime Planner — Gate A Independent Review 11

**Submission:** `HortOps-Stage1-GateA-Closure-PR10.zip`  
**Basis:** Stage 1 Peer Review Protocol v2; Review 10 unified-closure prompt; C1–C10 constitutional principles; frozen I1–I12 rostering contracts.  
**Scope:** Gate A only. This is **not** a release review, authorisation to delete legacy code, or a review of Gate B's historical-record ownership policy.  
**Decision:** **Gate A not yet accepted; four bounded code corrections and one governance-document correction required.** The four Review 10 production failures are corrected in their normal execution paths. Do not recast their fixed instances as still open. The remaining items concern newly introduced or insufficiently completed Gate A boundary contracts.

## 1. Executive outcome and anti-recurrence ruling

The PR10 correction is a substantial improvement. It rejects incomplete supported-v2 data in the publicly exposed envelope builder; introduces `readVerifiedCommittedV2()` for normal save and export; avoids mutating caller objects during failed semantic validation; updates the affected Persistence fixtures; and rebuilds the standalone distribution reproducibly. The independently rerun focused Gate A, Persistence and Rostering Engine suites all pass.

This review deliberately **does not reopen** the previously fixed corruption cases. Instead, one combined, code-specific micro-closure is required for the precise gaps below, with a fixed acceptance matrix. Do not issue another series of single-method prompts. Once these bounded contracts pass, Gate A should be accepted with the already recorded Gate B ownership and lifecycle limitations, not expanded to speculative new features.

## 2. Reconstructed baseline, package and independent evidence

The runnable project was reconstructed by overlaying, in order: `Offline2-Overtime-Planner.zip`, `EligibilityFix`, `CorrectiveFix`, `FinalClosure`, `FinalClosure(1)`, PR04, PR05, ArchitectureAudit, GateA-Corrected, GateA-Closure-PR08, GateA-Closure-PR09 and submitted PR10. The exact mounted ZIP contains 14 entries; no path traversal or duplicate entries; all 13 payload checksum entries match the manifest; both submitted standalone HTML files are identical and reproduce byte-for-byte from the rebuilt source.

| Targeted check | Independently observed | Interpretation |
|---|---|---|
| `node scripts/test_normal_save_snapshots.cjs` | Pass: Group 1, A1–A8, GA10-01–04 | Prior blockers' normal paths are covered. |
| `node scripts/test_persistence.cjs` | Pass | Previously red valid-v2 fixtures have been repaired. |
| `node scripts/test_rostering_engine.cjs` | Pass: 26 groups | No direct regression detected in this affected contract. No need to rerun for unchanged reviewer-only documents. |
| `node scripts/build_single_file.cjs` | Pass | Both resulting file hashes `004ddf780c587404bc7da01c45e96f5f9fcba129fb8d62e8564c52084cfc35d9`, identical to the PR10 payload. |
| All manifest payload hashes | Pass | ZIP is internally consistent. |
| Control-character scan of three submitted Markdown reports | Pass: zero non-whitespace C0 | One *structural* Markdown corruption remains (below), unrelated to C0 bytes. |
| Browser/Playwright smoke | Not independently run | No UI interaction was intentionally redesigned; future disclosure text, if changed, should receive one targeted UI check. |

`test_rostering_engine.cjs` is genuinely changed from PR05 (a supported-v2 fixture now explicitly includes `historicalSnapshots: {}`). Its inclusion is consistent with minimal incremental packaging.

## 3. Review 10 finding-by-finding adjudication

| Prior finding | Independent disposition | Evidence |
|---|---|---|
| GA10-01 builder synthesises missing historical/rostering maps | **Corrected for all three required-map absence cases** | Builder throws on missing history, instructions or provenance; storage bytes unchanged. |
| GA10-02 malformed committed baseline bypasses export | **Corrected under normal dependency availability** | The actual exporter rejects malformed persisted v2 with zero downloads. A separate missing-reader fallback remains (R11-01). |
| GA10-03 unreadable committed bytes overwritten by normal save | **Corrected under normal dependency availability** | Actual normal save rejects unreadable JSON, retains exact raw bytes. A separate missing-reader fallback remains (R11-01). |
| GA10-04 rejected semantic validation mutates caller/live state | **Corrected on rejection** | Defensive working copy; actual rejected restore with deliberately shared nested object leaves runtime and bytes unchanged. Successful restore has one raw-object alias still open (R11-03). |
| GA10-05 Persistence fixtures and affected suite | **Corrected** | Affected suite passes without reviewer fixture alterations. |
| GA10-06 Markdown C0 characters/source references | **C0 and current function references corrected** | Byte scan and source search. The transition register still has an improperly appended Gate A row and outdated old ledger row (R11-05). |

## 4. Eight-boundary coverage, without transitive pass claims

| Boundary | Status in PR10 | Evidence / residual boundary |
|---|---|---|
| B1 `saveWorkspace` | Verified for explicit evidence-map presence, detached semantic check, normal storage errors | Direct complete-v2 key retirement is **GB-OWN-001**, Gate B; see non-JSON clone R11-04. |
| B2 `loadWorkspace` + real `init` | Verified for explicit evidence maps and quarantine | Full nested snapshot validation is Gate B. |
| B3 `saveCurrentWorkspace` | Verified under normal dependencies; **incomplete fail-closed dependency check** | Missing reader permits overwrite of unreadable committed bytes (R11-01). |
| B4 `createWorkspaceEnvelope` | Verified for missing required evidence maps | Other optional/defaulted domain projections are Gate B canonical-schema work unless shown to violate the specific Gate A evidence invariant. |
| B5 `prepareWorkspaceJsonImport` | Verified for raw missing-map rejection and explicit-empty import | v1 support retained until Gate C. |
| B6 `restoreWorkspaceJson` | Verified for rejected shared-reference restore; **partial on successful detached adoption** | `budgetSettings` and `uiState` still read from the raw envelope (R11-03). |
| B7 `exportBackupJson` | Verified for malformed committed bytes and lost evidence keys with reader present; **partial** | Missing-reader bypass (R11-01) and omitted unsaved-work disclosure (R11-02). |
| B8 first-run current-v2 evidence map construction | Verified by A1 and startup | Removal of inherited seeded Jobs/staff/history remains Gate C. |

## 5. Material findings (bounded Gate A correction)

### R11-01 — HIGH — Shared committed-reader dependency is optional in the two callers

**Source:** `js/app.js:92–113` (approximate) and `js/components/exportModal.js:27–34` of submitted PR10. Both use `typeof storage.readVerifiedCommittedV2 === 'function' ? ... : null`, and both proceed if `committed === null`.

**Independent dynamic reproduction:** Start the actual application with a healthy committed v2 workspace. Replace the stored bytes with malformed JSON. Temporarily remove the newly introduced reader method to model an unavailable module/capability. `app.saveCurrentWorkspace()` returns `true`, and the corrupted bytes are overwritten. In a separate run, `exportBackupJson()` returns `true` and downloads a backup even though committed bytes are unreadable. Normal-reader tests pass, so this is a real bypass rather than a re-finding of GA10-02/03.

**Root:** a security-/integrity-critical dependency is coded as optional; the shared baseline verification contract is not mandatory at the consuming boundary. This violates the established fail-closed dependency principle. **Fix once in both callers**; absent reader or unverified result must be an explicit error, never a null success path. Respect a genuinely supported session-only recovery/export mode only if separately specified and clearly presented; submit a design challenge if needed.

### R11-02 — HIGH — Full workspace backup silently omits unsaved live changes

**Source:** `js/components/exportModal.js:107–120` and backup modal description. PR10 downloads `committed.raw` when present, even if live operational domains have changed since that commit.

**Independent dynamic reproduction (no missing dependencies):** Save a valid workspace with a Job named `Overnight Emergency Clearing`. Change the live Job name to `UNSAVED NAME REV10 INDEPENDENT` without saving. Call the actual exporter. It returns `true`, downloads the old Job name and shows no indication that the edited name has been omitted. The UI still advertises a **Full Workspace System Backup**.

**Root:** a legitimate committed-only export policy was chosen without the accompanying unsaved-change disclosure expressly required by Review 10. Fix using **one** clearly declared policy: (preferred) preflight evidence retention and current-state semantic validation, perform a checked successful save, re-read the committed bytes and export exactly those bytes; OR retain committed-only export but clearly label it *last saved*, detect unsaved domain changes and explicitly warn/confirm before downloading. The export must not write first and discover missing instruction/provenance keys afterward. Gemini may challenge a forced-save policy if it would disable a documented emergency committed-only backup.

### R11-03 — MEDIUM–HIGH — Successful restore retains unvalidated raw references for two domains

**Source:** `js/app.js:498–514` (submitted PR10). Core domains adopt `adoptedData` from `validateCurrentV2ForBoundary()`, but `budgetSettings` and `uiState` still read `envelope`.

**Independent dynamic reproduction:** Restore a valid envelope; then mutate `envelope.budgetSettings.annualBudgetCap` from 500,000 to 7,654,321. Without another save, the live `app.state.budgetSettings.annualBudgetCap` changes to 7,654,321 while committed storage remains 500,000. This defeats the new validated working-copy ownership contract and creates live/stored divergence.

**Correction:** All accepted domain and UI-state adoption must read from the validated `adoptedData`, never the raw caller-owned `envelope`. Preserve existing `activeView` and year whitelisting. Add one focused test for mutation after a successful restore; retain the passing rejected-restore test.

### R11-04 — HIGH — JSON cloning can launder non-JSON data into successful writes

**Source:** `js/utils/storage/schemaValidator.js:729–748` and `js/utils/storage.js:156–197` (submitted PR10).

**Independent dynamic reproduction:** Take a complete, otherwise valid current-v2 workspace; set one historical snapshot's `durationHours = Infinity`; call the real boundary validator followed by `saveWorkspace()`. Both accept it. `JSON.stringify` converts `Infinity` to `null` before semantic validation, so the persisted historical record has `durationHours: null`. This is **not** a demand to complete all of Gate B's nested snapshot validation: Review 10 already required that the new clone must not make originally non-JSON values silently acceptable.

**Correction:** Before cloning, traverse the raw candidate and reject `undefined`, functions, symbols, nonfinite numbers, cyclic references and unsupported object types in fields that will be persisted. Then clone and perform the existing semantic validation on the working copy. Do not impose arbitrary duration ceilings here; valid JSON but semantically invalid snapshot values remain Gate B's separate stricter nested-validator responsibility. If legitimate current runtime objects contain intentionally unpersisted non-JSON fields, propose an explicit projection rather than silently dropping them.

### R11-05 — MEDIUM — Governance transition register has inconsistent active gate ledger

`STAGE1_GOVERNANCE_TRANSITION_REGISTER.md` still lists Gate A's PR09 state in its main table at line 39, while a new PR10 Gate A row was appended to the **end of an unrelated Stage 2–4 paragraph** on line 80. It is not a valid replacement table row. Replace the original ledger's Gate A row with PR10 proposed status and remove the appended fragment. Do not represent developer-reported success as independent Gate A approval. The file has zero non-whitespace C0 characters but still contains inherited mojibake; do not use the zero-C0 claim as proof of correct document structure.

## 6. Explicit Gate B/C/D debt (not new Gate A blockers)

- **GB-OWN-001:** Authorized whole-workspace replacement versus unauthorized historical/instruction/provenance-key removal; provenance-aware edit/retirement policy.
- **GB-LIFE-002:** Complete snapshot capture for source and propagated Fixed/Rotation occurrences; historical immutability after parent edits/retirement; genuine rollback of state and persisted data.
- **GB-VAL-003:** Full nested current-v2 schema (calendar times, snapshot identity, finite positive duration, crew/staff identifiers, semantic NULL rejection where required), including unsupported schema detection and valid multi-day design.
- **GB-CANON-004:** Resolve envelope construction's remaining generic defaults for optional/operational domains, distinguish runtime projections from actual persisted aliases and remove redundant builders only after call-site audit. Do not broaden R11-04 into this refactor.
- **Gate C:** Independently proven unused legacy-code removal, seed isolation (12 Jobs/253 staff/44 hardcoded historical occurrences), explicit empty first-run workspace. **No legacy deletion now.**
- **Gate D:** One integrated release gate and authoritative Stage 2 handoff, not one full suite per micro-fix.

## 7. Review decision, test boundary and stopping rule

Review 10's original four production manifestations have been **independently corrected** in normal operation. The three relevant suites, checksums and rebuilt HTML all pass. No requirement to repeat unrelated scheduling, UI or complete release tests for the bounded follow-up. The remaining acceptance obligations are precisely R11-01–05; use one micro-closure submission and one focused peer review. If they pass with normal pathways intact, accept Gate A with its explicitly documented Gate B limitations. No new speculative Gate A requirements should be added during the next review; genuinely independent future-feature risks belong in the named later gate.
