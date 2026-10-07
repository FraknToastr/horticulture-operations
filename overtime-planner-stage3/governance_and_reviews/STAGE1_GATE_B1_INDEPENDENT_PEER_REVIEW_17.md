# Horticulture Overtime Planner — Stage 1 Gate B1 Independent Peer Review 17

**Submission:** `HortOps-Stage1-GateB1-PR16.zip`  
**Submitted ZIP SHA-256:** `ba5f9d223c32bbf3956ca13ebb1ced4ed8ca242bd2fde9fd685fd181c9d8edce`  
**Comparison baseline:** `HortOps-Stage1-GateB1-PR15.zip`, reconstructed with its prior accepted modular source; baseline ZIP SHA-256 `ff71da39c7a9fb2aae6b2cd75e5391d0827ec986a8b64e8d1ae119d1b70e0d7e`.  
**Independent decision: GATE B1 ACCEPTED, with explicit B2/B3 and Gate D deferrals.** Gate A remains accepted under Review 12. This is not acceptance of all of Stage 1.

## 1. Scope and precise disposition

Review 16 identified **one** unclosed Gate B1 condition: `createWorkspaceEnvelope(data)` silently dropped an original `customAssignments` property before validating a projected current-v2 candidate. A dual-map current-v2 caller could pass conflicting `assignments` and `customAssignments`, and the constructor kept only `assignments`. Review 16 prescribed a guard **on the original argument before projection** and compatible handling of recognized v1 alias-only imports until Gate C.

PR16 implements this in `js/utils/storage/migrationEngine.js`:

- `createWorkspaceEnvelope()` lines **77–83** reject any *own* `customAssignments` property before building `candidate`, including an own property set to `undefined` and conflicting or apparently equivalent dual maps. This is deliberately stricter than attempting to reconcile two public/current-v2 assignment representations.
- `migrateWorkspaceV1toV2()` lines **36–51** recognize an alias-only Schema v1 source, project its assignments into canonical `assignments`, remove the alias from the *migrated* envelope, and reject a v1 source that supplies **both** representations. Raw source data is not mutated.
- Real `HortOpsApp` normal-save continues to take the explicitly sanctioned runtime-state path before projecting `state.customAssignments` to persisted `assignments` in `app.js`. This PR does not reopen that previously verified contract.

These are the exact two surgical production edits required by Review 16. No unrelated production refactor or legacy deletion was introduced.

## 2. Package integrity and change inventory

The nine-file incremental package passed its own manifest (`8/8` listed content files OK). The standalone `index.html` and `dist/hort_ops_offline_planner.html` were rebuilt from the reconstructed PR16 modular source and **both** match submitted SHA-256 `71294454272961295d212e5e0d97ac801aa285f787af51827a4a6b46ec1ad247`. Node syntax checking of `migrationEngine.js` passed.

Changed or introduced material: `migrationEngine.js`, `review16_boundary_probe.cjs` (reviewer probe added to the working project), `test_gate_b1.cjs` (Assertion 11), the two rebuilt HTML files, governance transition register and evidence report. **Packaging-only observation:** `scripts/reproduce_b1_review15.cjs` is byte-identical to PR15 and could have been omitted. This is not a code or acceptance blocker; omit unchanged tests from future incremental ZIPs.

## 3. Independent execution and evidence

I applied PR16 over the PR15 reconstructed source and executed the tests **against that combined source**, not just the supplied standalone bundle.

| Executed verification | Independent result | Boundary evidenced |
|---|---|---|
| Unmodified Review 16 independent probe; hash matches the reviewer-provided original | **7/7 PASS** | Constructor, default vs runtime preflight, direct save, JSON import, verified read, actual restore, detached canonical restoration |
| Review 15 discriminator | **5/5 PASS** | Canonical vs runtime representation retained |
| Review 14 discriminator | **11/11 PASS** | Required assignment map, prototype-safe allow-list and malformed entity entry handling retained |
| Review 13 discriminator | **6/6 PASS** | Job/snapshot strict validation retained |
| Focused Gate B1 suite | **11/11 groups PASS** | Complete Gate B1 assertions, including new constructor and v1 migration case |
| Gate A normal-save/snapshot suite | **PASS** | Prior evidence-loss guard and verified save paths retained |
| Persistence suite | **PASS** | Existing persistence and fail-closed contracts retained |
| Rostering Engine suite | **26/26 groups PASS** | Prior engine/eligibility checks retained |
| Deterministic bundle rebuild | **PASS** | Both generated distributions exactly match supplied files |

I additionally executed a fresh, independent live storage/import probe that was **not** merely a reprint of Gemini's test report. It verified: current-v2 alias presence (including `undefined`) and conflicting dual maps are rejected without changing committed bytes; an alias-only v1 JSON import succeeds with exact assignment retention and no surviving alias; a dual-source v1 import fails with committed bytes unchanged. **5/5 assertions passed.** These tests specifically address the Review 16 V1 migration dependency and non-mutation requirement.

## 4. Eight-boundary closure ledger

| Boundary | Review 17 conclusion | Evidence/limit |
|---|---|---|
| Canonical constructor | **Accepted** | New original-input guard; reviewer probe and independent extra probe |
| Direct save | **Accepted for B1** | Rejects alias-only/dual map without overwrite; reviewer probe |
| Real app normal save | **Accepted for B1** | Existing explicit runtime-state projection remains green in focused Gate B1 and Gate A suites |
| JSON backup | **Accepted for B1** | Focused Gate B1 checks canonical save-then-export round trip; not a claim about future B2 cancellation permissions |
| Verified read/startup | **Accepted for B1** | Reviewer probe rejects alias-only tampered current-v2 storage; prior gate tests retained |
| JSON import/restore | **Accepted for B1** | Reviewer probe covers rejected alias/dual and accepted detached canonical restore; independently checked real V1 import |
| Snapshot validation | **Accepted for B1** | Review 13/14 discriminators and Gate B1 assertions pass; full *creation/ownership lifecycle* expressly deferred to B2 |
| Entity-array guards | **Accepted for B1** | Review 14 discriminator retained; broader operational transactional writes expressly deferred to B3 |

**Review discipline:** This decision closes the exact B1 acceptance contract and does not create a new defect from untested, hypothetical future requirements.

## 5. Known deferrals and minor housekeeping

1. **B2 — complete scheduled-commitment ownership and lifecycle.** The current `staffAssignModal.saveAllocation()` records a snapshot for the currently open shift only (around lines 776–791), not every Fixed/Rotation descendant. Future edits/cancellation, archived-parent preservation, and authorized evidence removal require an explicitly approved operation contract. No assertion that B1 solved these.
2. **B3 — broader mutation atomicity.** Methods such as `app.updateShiftStaff()` and `app.updatePermit()` mutate state before save and need transactional integration beyond B1's strict persistence boundary. If a B2 path touches one of these, it must not knowingly persist an incomplete commitment; agree the narrow scope before implementation.
3. **Gate D — integrated release verification.** `scripts/test_rostering_lifecycle.cjs` Test 14 (around line 466) is a documented stale current-v2 constructor fixture; it omits mandatory fields. It was not rerun for this single-source microclosure. Repair its fixture (without weakening validation) at the relevant integration checkpoint, then run the complete suite once.
4. **Governance header:** `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md` top-level revision-status text still says B1 awaits Review 13 although its later ledger correctly records PR16/Review 17 pending. Update the active header **once** when registering this acceptance; do not edit historical signed reviews.
5. **Minimal ZIP hygiene:** Omit unchanged `reproduce_b1_review15.cjs` from the next peer-review submission unless it changes or is otherwise necessary to reproduce that package.

None of these is a regression in the PR16 constructor change or a reason to reopen Gate B1.

## 6. Independent decision and next authorisation

**Gate B1: ACCEPTED** for canonical current-v2 persistence and scheduled-commitment *validation*, subject to the explicit B2/B3/D boundaries above. Gate A remains accepted (Review 12). This decision authorises **Gate B2 only**, beginning with a source-grounded, operation-level scheduled-commitment ownership and propagation plan. It does **not** authorise Gate B3, Gate C legacy deletion, seeded-data removal, Stage 2 reset, Stage 3 registries/smart rostering or unrelated UI changes.

Proceed using the accompanying `GEMINI_GATE_B2_PRESCRIPTIVE_IMPLEMENTATION_PROMPT_REVIEW17.md`. Gemini may submit a source-grounded design challenge for a targeted independent micro-review; do not silently replace unresolved business policy with invented schema semantics.
