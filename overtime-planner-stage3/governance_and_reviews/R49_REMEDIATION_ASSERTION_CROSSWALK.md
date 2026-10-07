# Review 49 Assertion Crosswalk: Stage 2 Architecture Consolidation (Candidate PR23_07_06)

**Document Reference:** `governance_and_reviews/R49_REMEDIATION_ASSERTION_CROSSWALK.md`  
**Candidate Release Package:** `HortOps-Stage2-Corrective-PR23_07_06.zip`  
**Baseline Review:** Independent Peer Review 49 (`Review49_Stage2_PR23_07_05_Independent_Assessment.md`)  
**Target Review:** Independent Peer Review 50 / Stage 2 Final Closure  
**Date:** 02 October 2026  

---

## 1. Challenge-to-Code Traceability Matrix

| Challenge ID | Challenge Assertion | Root Cause in PR23_07_05 | Exact Code Resolution in PR23_07_06 | Test Verification |
| :--- | :--- | :--- | :--- | :--- |
| **`R49-P01`** | `b=parent('NEWFAIL',child('CNEW'),{}); r=_stageTransactionRecoveryBundle(b,json); key='hort_ops_emergency_recovery_v2:transaction:NEWFAIL'; assert.equal(r.stagingSuccess,true); assert.equal(e.s.getItem(key),json)` | In `storageDriver.js`, `shouldStageParent` skipped parent composite staging when `previousEmergencyRecoveryMetadata` was `{}`. | Reversed `shouldStageParent`. Parent composite bundle is staged and verified FIRST under `hort_ops_emergency_recovery_v2:transaction:<txId>` unconditionally before auxiliary child or legacy alias staging (`storageDriver.js:712–760`). | `PASS R49-P01 composite reset bundle remains authoritative even with no older emergency metadata` |
| **`R49-P02`** | `tx='OPERATOR', a=child('COLD'), key='hort_ops_emergency_recovery_v2:transaction:'+tx, raw=JSON.stringify(parent(tx,a,{prior:'IRREPLACEABLE'})); restore(a,{parentTransactionId:tx}); ack=acknowledgeParentPriorEvidence(tx,{operatorConfirmed:true}); retire=retireCompositeParentBundle(tx); assert.equal(e.s.getItem(key),raw)` | `acknowledgeParentPriorEvidence(tx, options)` allowed caller-supplied option flags (`operatorConfirmed: true`) to satisfy prior evidence review requirement without recorded in-app inspection or export. | Added `inspectParentPriorEvidence(txId)` and `exportParentPriorEvidence(txId)` to record `priorEvidenceInspected` / `priorEvidenceExported` on verified bound parent records. Updated `acknowledgeParentPriorEvidence` to fail closed if non-empty prior evidence exists without recorded in-app review (`storageDriver.js:1880–1990`). | `PASS R49-P02 caller-supplied operator flags cannot forge review and retire older evidence` |
| **`R49-P03`** | `sources=['quarantineViewerModal.js','resetWorkspaceModal.js','app.js']; assert.match(sources,/acknowledgeParentPriorEvidence\s*\(/); assert.match(sources,/retireCompositeParentBundle\s*\(/)` | UI components lacked direct call sites invoking `acknowledgeParentPriorEvidence()` and `retireCompositeParentBundle()`. | Implemented concrete operator UI methods (`inspectParentEvidence`, `exportParentEvidence`, `acknowledgeParentEvidence`, `retireParentEvidence`) in `quarantineViewerModal.js` and rendered dedicated composite parent cards in the viewer (`quarantineViewerModal.js:83–155, 300–375`). | `PASS R49-P03 actual operator UI includes governed parent-specific evidence review and retirement actions` |
| **`R49-C`** | Native `sha256sum -c CORRECTIVE_PACKAGE_MANIFEST.sha256` fails to parse records | Generator wrote literal `\n` string pairs instead of genuine ASCII LF newline bytes `0x0A`. | Updated package script `scripts/package_stage2_pr23_07_06.py` to write genuine ASCII `\n` newlines. Verified with unmodified GNU `sha256sum -c` (62/62 OK). | GNU `sha256sum -c CORRECTIVE_PACKAGE_MANIFEST.sha256`: 100% OK |
