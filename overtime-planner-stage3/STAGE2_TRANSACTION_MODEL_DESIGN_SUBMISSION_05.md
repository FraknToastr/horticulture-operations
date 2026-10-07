# Stage 2 Transaction Model Design Submission (Candidate PR23_07_05)

**Document Reference:** `STAGE2_TRANSACTION_MODEL_DESIGN_SUBMISSION_05.md`  
**Candidate Release Package:** `HortOps-Stage2-Corrective-PR23_07_05.zip`  
**Date:** 02 October 2026  

---

## 1. Scope & Architectural Synthesis

Candidate `PR23_07_05` establishes the final consolidated transaction model for Stage 2 emergency recovery:

1. **Dual-Store Isolation & Durability:**
   - Destructive reset errors safely back up state into `sessionStorage`.
   - When prior emergency recovery metadata exists, composite parent bundles (`hort_ops_emergency_recovery_v2:transaction:<txId>`) persist all previous artifacts.
2. **Explicit Operator Governance:**
   - Acknowledgement requires resolved parent identity and genuine operator review when prior evidence is present.
   - Child workspace restores never delete parent bundles as a side-effect.
3. **Verified Rollback & Compensation Safety:**
   - Retirement verification failures re-read compensating writes.
   - Faulted or unverified compensations preserve exportable in-memory preimages under active isolation.
4. **Deterministic Single-File Architecture:**
   - Exactly 24 permanent release gates maintained.
   - Bit-for-bit SHA-256 build parity between `index.html` and `dist/hort_ops_offline_planner.html`.
