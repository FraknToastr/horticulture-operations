# Architecture Consolidation & Remediation Assertion Crosswalk — PR23_07_04

**Author:** Antigravity / Gemini Maintenance Pair  
**Date:** 2026-10-02  
**Target Candidate:** `PR23_07_04` (Responding to Independent Peer Review 47 Directive)  
**Governance Scope:** Stage 2 Architecture Consolidation, Findings R47-01..R47-03, Dimensions AC-01..AC-12, Probes R47-P01..R47-P08  

---

## 1. Review 47 Findings Remediation Crosswalk

| Finding ID | Severity | Controlled Invariants & Dimensions | Root Cause in PR23_07_03 | Architectural Remediation in PR23_07_04 | Source Control Points | Verified Probes / Tests |
|---|---|---|---|---|---|---|
| **R47-01** | **HIGH** | `AC-01`<br/>`AC-07`<br/>`AC-10`<br/>`TM-I04`<br/>`TM-I10`<br/>`TM-I11` | Storage enumeration in `_reconcileRecoveryInventory()` counted keys by prefix but did not read raw values via `getItem(k)`, did not reject duplicate enumerated keys, and did not detect absent/null raw values. | Constructed authoritative typed inventory reader performing verified `getItem(k)` reads across every enumerated key; fails closed on `getItem` exceptions/denials (`R47-P01`), duplicate enumerated keys (`R47-P02`), and null/absent raw values (`R47-P03`). All subsystems consume authoritative typed inventory. | `storageDriver.js` lines 580-690 (`_reconcileRecoveryInventory`) | `R47-P01` (PASS)<br/>`R47-P02` (PASS)<br/>`R47-P03` (PASS) |
| **R47-02** | **HIGH** | `AC-03`<br/>`AC-04`<br/>`AC-05`<br/>`AC-06`<br/>`TM-I08`<br/>`TM-I12`<br/>`TM-I13` | Parent resolution tracked in-memory `parentTransactionId` without binding raw parent bytes or verifying inner child provenance. Retirement and acknowledgement trusted ID alone without revalidating stored bytes. Quarantine modal silently auto-retired parent bundles after restore. | Bounded provenance check during child restore: compares embedded child identity with authenticated restore target; resolution record binds `boundRawBytes` and `boundChildRecoveryId`. `retireCompositeParentBundle()` and `acknowledgeParentPriorEvidence()` re-verify exact raw byte match against stored parent. UI modal detects direct parent composite viewing and preserves parent bundle without auto-retirement. | `storageDriver.js` lines 1580-1650, 1660-1760<br/>`quarantineViewerModal.js` lines 150-240 | `R47-P04` (PASS)<br/>`R47-P05` (PASS)<br/>`R47-P06` (PASS)<br/>Browser `R39-C` (PASS) |
| **R47-03** | **HIGH** | `AC-08`<br/>`AC-09`<br/>`AC-10`<br/>`TM-I08`<br/>`TM-I09`<br/>`TM-F21`..`25` | `_checkUnresolvedEmergencyIsolation()` failed to recognise `:restore_transaction:` namespaces, and content string heuristics failed on malformed payloads, allowing destructive reset over valid evidence. `retireCompositeParentBundle()` lacked pre-removal preimage preservation and compensating rollback on verification errors. | Recognises all governed transaction prefixes (`:transaction:`, `:restore_transaction:`, and standalone artifacts); malformed or unparseable bundles fail closed and block destructive reset. `retireCompositeParentBundle()` caches pre-removal preimage and executes compensating `setItem` rollback if post-removal verification throws. | `storageDriver.js` lines 150-250 (`_checkUnresolvedEmergencyIsolation`), 1680-1750 (`retireCompositeParentBundle`) | `R47-P07` (PASS)<br/>`R47-P08` (PASS) |

---

## 2. Locked Acceptance Dimensions Crosswalk (AC-01 through AC-12)

| Dimension | Title | Controlled Invariant | Target Implementation in PR23_07_04 | Assertion & Test Reference | Status |
|---|---|---|---|---|---|
| **AC-01** | Identity | Exact raw-byte match on unique, parent, and legacy evidence | `storageDriver.js::restoreEmergencyRecoveryArtifact()` and `_reconcileRecoveryInventory()` | `R46-P03, R46-P04, R47-P03`<br/>Audit #50, #51 | **FULL (PASS)** |
| **AC-02** | Collisions | Non-destructive staging; raw equality permits idempotency | `storageDriver.js::_stageTransactionRecoveryBundle()` | `R46-P05, R46-P08`<br/>Audit #52, #55 | **FULL (PASS)** |
| **AC-03** | Provenance | Provenance binding: inner child identity and raw parent bytes | `storageDriver.js::restoreEmergencyRecoveryArtifact()` | `R45-P03, R46-P07, R47-P05`<br/>Audit #44, #54 | **FULL (PASS)** |
| **AC-04** | Retirement Authority | Pre-retirement raw byte validation; internal verified state + operator acknowledgement | `storageDriver.js::retireCompositeParentBundle()` | `R46-P01, R46-P02, R47-P04`<br/>Audit #48, #49 | **FULL (PASS)** |
| **AC-05** | Operator Resolution | Explicit operator acknowledgement bound to immutable parent bytes | `storageDriver.js::acknowledgeParentPriorEvidence()` | `R44-P04, R44-P06, R47-P04`<br/>Audit #34, #36 | **FULL (PASS)** |
| **AC-06** | UI Lifecycle | Suppress premature auto-reload; no silent retirement of viewed parent bundles | `quarantineViewerModal.js::restoreEmergencyArtifact()` | `R46-P07, R47-P06`<br/>Audit #54, Browser R39-C | **FULL (PASS)** |
| **AC-07** | Inventory Completeness | Authoritative typed inventory; fail-closed on read denial, null, duplicate | `storageDriver.js::_reconcileRecoveryInventory()` | `R46-P06, R47-P01, R47-P02, R47-P03`<br/>Audit #53 | **FULL (PASS)** |
| **AC-08** | Isolation | Complete prefix coverage (`:restore_transaction:`); fail-closed on corrupt payloads | `storageDriver.js::_checkUnresolvedEmergencyIsolation()` | `R47-P07, TM-I08, TM-I09`<br/>Audit #8, #9 | **FULL (PASS)** |
| **AC-09** | TxB Failures | Compensating restaging on removal fault; double fault retains evidence | `storageDriver.js::retireCompositeParentBundle()` | `R47-P08, TM-F21, TM-F22, TM-F25`<br/>Audit #21, #22, #25 | **FULL (PASS)** |
| **AC-10** | Origin Isolation | Clean reset loops isolate HortOps keys without collateral damage or evidence bypass | `storageDriver.js` clean reset loops & inventory isolation | `R47-P07, TM-I15, TM-F24`<br/>Audit #15, #24 | **FULL (PASS)** |
| **AC-11** | Browser | Offline recovery, download, acknowledgement, and cold reload | `test_review39_browser_recovery.cjs` | Browser R39-A..R39-E | **FULL (PASS)** |
| **AC-12** | Release Battery | Exactly 24 suites, deterministic build, bit-for-bit SHA-256 parity | `run_all_release_gates.cjs, build_single_file.cjs` | 24/24 Suites PASS, SHA-256 Match | **FULL (PASS)** |

---

## 3. Review 47 Independent Probes Mapping & Verification Ledger

| Probe ID | Invariant & Failure Class | Baseline (`PR23_07_03`) | Consolidated (`PR23_07_04`) | Execution Status |
|---|---|---|---|---|
| **R47-P01** | Inventory `getItem` denial MUST fail closed with `{ ok: false, error: ... }` | FAIL | **PASS** | **VERIFIED (0 errors)** |
| **R47-P02** | Duplicate enumerated key MUST fail closed with `{ ok: false, error: ... }` | FAIL | **PASS** | **VERIFIED (0 errors)** |
| **R47-P03** | Absent raw entry (`getItem(k) === null`) MUST NOT count as verified evidence | FAIL | **PASS** | **VERIFIED (0 errors)** |
| **R47-P04** | Mutated / changed parent raw bytes after restore MUST block retirement | FAIL | **PASS** | **VERIFIED (0 errors)** |
| **R47-P05** | Forged / mismatched `parentTransactionId` MUST NOT mark unrelated parent recovered | FAIL | **PASS** | **VERIFIED (0 errors)** |
| **R47-P06** | UI modal MUST NOT automatically retire empty-prior parent when directly viewed/restored | FAIL | **PASS** | **VERIFIED (0 errors)** |
| **R47-P07** | Malformed persisted `:restore_transaction:` bundle MUST prevent destructive reset | FAIL | **PASS** | **VERIFIED (0 errors)** |
| **R47-P08** | Failed parent-retirement verification MUST preserve raw prior evidence via compensating restaging | FAIL | **PASS** | **VERIFIED (0 errors)** |

---

## 4. Architectural Certification & Backward Compatibility

All 12 locked acceptance dimensions (AC-01..AC-12) and all 8 Review 47 independent probes are fully satisfied and verified with 100% green test execution.
- Prior Review 46 probes (8/8 PASS) remain untouched and passing.
- Prior Review 45 probes (6/6 PASS) remain untouched and passing.
- Prior Review 44 probes (8/8 PASS) remain untouched and passing.
- Temporary Closure Audit (55/55 PASS) remains untouched and passing.
- Permanent release suite count remains strictly 24 (17 Stage 1 frozen + 7 Stage 2 acceptance).
- Single-file build parity between `index.html` and `dist/hort_ops_offline_planner.html` is maintained at exact bit-for-bit SHA-256 parity: `f613d4265cfb1073ebbfb7202d81954eeccea911e6df4a0a754dea9712637780`.
