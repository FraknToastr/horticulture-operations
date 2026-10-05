# Overtime Planner — Stage 1 Gate B1 Independent Peer Review 16

**Submitted:** `HortOps-Stage1-GateB1-PR15.zip`  
**Package SHA-256:** `ff71da39c7a9fb2aae6b2cd75e5391d0827ec986a8b64e8d1ae119d1b70e0d7e`  
**Comparison:** PR14 plus the PR15 incremental files, applied to the previously reconstructed modular source.  
**Decision:** **Gate B1 remains open for ONE bounded constructor-input correction.** Gate A remains accepted. Gate B2/B3, Gate C and legacy removal are not authorised.

## 1. Scope and evidence ledger

PR15 implements Review 15's principal fix in `schemaValidator.validateCurrentV2Presence(input, options)` (`js/utils/storage/schemaValidator.js:860–904`). The default current-v2 boundary now requires `assignments` and rejects the runtime-only `customAssignments` field. Only `HortOpsApp.saveCurrentWorkspace()` requests `{ inputKind: 'runtime_state' }` (`js/app.js:67–72`). This is the correct distinction: application runtime state and the persisted envelope are not competing persisted schemas.

Its two previously omitted regression files are now included and reconcile the mandatory assignments fixtures without weakening production validation. The PR15 checksum manifest verifies every listed file. The two distribution HTML files are byte-for-byte identical. Rebuilding the modular source produces the submitted SHA-256 `8aa5a217ad2b53935ba697d1fa8d9055148842c2a5f3be964aa935484dc01d63` for both targets.

### Independently executed tests on the reconstructed PR15 source

| Verification | Result | Interpretation |
|---|---:|---|
| Review 13 discriminator | 6/6 pass | Earlier malformed-Jobs/snapshot protections retained. |
| Review 14 discriminator | 11/11 pass | Assignment validation, safe allow-lists and null-entity checks retained. |
| Review 15 discriminator | 5/5 pass | Canonical/alias distinction works in the five *tested* scenarios. |
| Gate B1 suite | 10/10 groups pass | Includes real app save and canonical JSON backup. |
| Gate A normal-save suite | Pass | Earlier evidence-loss protections retained. |
| Persistence suite | Pass | Supplied fixtures are now reproducible. |
| Rostering Engine | 26/26 groups pass | Persisted group-26 fixture now uses canonical `assignments`. |
| Independently added Review 16 boundary probe | **6/7 pass** | One constructor-input gap not exercised by Review 15's discriminator. |
| Standalone compilation | Pass | Both files rebuild to the exact distributed hash. |
| Rostering Lifecycle suite | Pre-existing fixture failure at test 14, line 466 | The fixture omits mandatory current-v2 constructor fields; documented at the earlier review, not a PR15 code regression. |

These results do not mean the entire Stage 1 lifecycle has passed; Stage 1 integration belongs at Gate D.

## 2. B1-16-01 — Constructor silently discards a contradictory runtime assignment map

**Severity:** Blocking to the **explicit Gate B1 Review 15 constructor acceptance criterion**. **Scope:** a single remaining manifestation of the *same* canonical-vs-runtime distinction, not a new architecture-wide audit.

**Affected source:** `js/utils/storage/migrationEngine.js:56–85`, particularly the selective `candidate` projection at lines 67–80. The constructor copies `data.assignments` but does not copy `data.customAssignments`, then validates only the *projected candidate*. This hides a conflicting original representation from the otherwise corrected default validator.

**Independent reproduction:** Supply a syntactically valid Schema v2 object with `assignments: { 'J01@2027-01-02': ['E1'] }` and `customAssignments: { 'J01@2027-01-02': ['E2'] }` to `HortOpsStorage.createWorkspaceEnvelope(...)`. The PR15 constructor **accepts** it and returns a canonical envelope containing only E1. The second assignment source disappears without an error. This contradicts Review 15's exact requirement that the constructor reject a contradictory dual-map current-v2 object.

An alias-only constructor input correctly fails. Direct saving, public boundary validation, JSON import and actual restore also correctly reject the dual-map object, so there is **no reproduced new direct-save overwrite** in PR15. The defect is isolated to callers that invoke the constructor with unvalidated source objects, because projection occurs before validating the complete source representation.

### Eight-boundary decision table for the unchanged PR15 submission

| Boundary | Independent result | B1-16-01 action |
|---|---|---|
| Canonical constructor | **FAIL for dual-map input**; alias-only rejected | Reject `customAssignments` before projecting into a candidate. |
| Direct save | Pass | No production change needed. |
| Real application save | Pass | Preserve runtime preflight and explicit canonical projection. |
| JSON backup | Pass | No export change needed. |
| Verified read/startup | Pass | Keep strict default and non-mutating Recovery Required behaviour. |
| JSON import/actual restore | Pass | Both alias-only and dual-map inputs rejected before mutation. |
| Snapshot validation | Pass against the required prior discriminators | Preserve B1 snapshot rules. |
| Invalid entity arrays | Pass | Preserve controlled validation errors. |

**Why Review 15 missed it:** The five-scenario discriminator tests the corrected public boundary and direct storage save, but not `createWorkspaceEnvelope(dualMapInput)` itself. The PR15 evidence report asserts that the constructor rejects dual maps; that one assertion is not supported by its submitted tests or the actual constructor. The added seven-case probe closes this exact test gap.

## 3. Surgical implementation guidance

A small, correct fix is to reject the runtime alias on the **original current-v2 input** immediately after identifying the canonical validator and before assembling `candidate`. This is not a request for another schema rewrite. No change is required to `schemaValidator.js` or `app.js` for the demonstrated defect.

**Explicit dependency:** Schema v1 is still supported until Gate C. The existing v1 migrator can carry a `customAssignments` alias into a synthetic v2 object. If the constructor begins rejecting that alias, v1 conversion must consume it **inside the v1 migration boundary only** before invoking the canonical constructor. A v1 input with both assignment sources must not silently choose a winner; fail closed unless Gemini demonstrates an existing, trustworthy and unambiguous equality/precedence contract.

I tested a reviewer-only prototype of this two-location change within `migrationEngine.js`. The new boundary probe passed 7/7; Review 13 passed 6/6, Review 14 11/11, Review 15 5/5; focused Gate B1, Gate A, Persistence and 26 Rostering Engine groups all passed. An alias-only v1 fixture still migrated to canonical `assignments`, and conflicting dual-source v1 input was rejected. **The prototype is not production code and is not included in PR15.** Gemini may challenge the specific v1 handling if it supplies concrete evidence and equivalent fail-closed tests.

## 4. Finite acceptance conditions

1. On the **actual submitted modular source**, alias-only and dual-map current-v2 constructor inputs both fail before projection. Previously committed bytes are unchanged if a caller attempts to save rejected data.
2. Canonical input with real assignment entries constructs, saves, reloads, backs up and restores with exact employee IDs.
3. Actual `HortOpsApp.state.customAssignments` still passes explicit runtime preflight, and normal save/backup contain **only** canonical persisted `assignments`.
4. Recognised v1 alias-only migration still works while legacy support remains. If dual-source v1 is ambiguous, it fails closed without writing or deleting the original data. Do not delete the v1 migrator now.
5. Review 16's *one* new independent discriminator closes: **7/7**. Focused Gate B1 (which already embeds earlier discriminators), Persistence and Gate A normal-save stay green; reproduce the legacy-migration case if the migrator changes. No complete release-suite rerun is required for this microclosure.
6. The standalone pair is rebuilt and reproducible; only genuinely modified source, tests and requisite review files appear in the incremental PR16 ZIP.

**Test debt retained rather than misclassified:** `scripts/test_rostering_lifecycle.cjs:466` still uses an incomplete constructor fixture. The failure predates PR15 and does not demonstrate a new runtime defect. Correct that test fixture at the agreed relevant integrated checkpoint, without weakening canonical validation.

## 5. Governance / status

Gate A's Review 12 acceptance remains intact. Gate B1 cannot be independently accepted until the explicit constructor condition is satisfied; this is one precise unclosed element of Review 15, not permission for another general adversarial audit. Gate B2/B3, seed isolation, legacy removal, clean-slate workspace reset, registries, smart rostering and UI work remain outside this PR16 microclosure.

Once verified, the next review should **close B1 rather than search for unrelated theoretical failure modes**. The next stage will require a separately scoped, source-grounded Gate B2 prompt covering authoritative snapshot capture and lifecycle ownership.
