# Horticulture Operations Suite v5.0.0 — Tranche C2 Walkthrough & Checkpoint Report

**Tranche:** C2 — Quote Issue Prospective Customer Funding  
**Application Version:** 5.0.0  
**Date:** 2026-09-20  
**Status:** **PASS** (Checkpointed, Verified & Peer Review Reconciled)  
**Governing Principle:** *“One defect, one controlled remediation, one proof, one checkpoint.”*

---

## 1. Controlling Sequence

> **Preserve → Branch → Verify → Baseline → P0 → Prove → Checkpoint → Stop.**

- **Preservation Status**: Preserved master source root (`src/`) remains 100% read-only and byte-identical to baseline.
- **Working Branch**: [`Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation`](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation)
- **Current Position**: Tranche C2 source remediation is confirmed PASS by ChatGPT in [C2 peer review 3 — Quote Issue prospective funding.md](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/ChatGPT%20Reviews/C2%20peer%20review%203%20%E2%80%94%20Quote%20Issue%20prospective%20funding.md). Peer review archive has been regenerated to fully preserve the `Offline/ChatGPT Reviews` development history. Halted at the required **Stop Point** prior to Tranche C3.

---

## 2. Checkpoint Status Card

```text
TRANCHE: C2 — Quote Issue Prospective Customer Funding
STATUS: PASS (Code Verified PASS by ChatGPT Peer Review 3; Package Provenance Reconciled)

MASTER SOURCE MODIFIED: NO (100% untouched)
WORKING BRANCH: Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation

PRODUCTION FILES CHANGED IN TRANCHE C2:
- src/program-planner/js/funding-model.js (only production file changed for C2)

TOTAL PRODUCTION FILES CHANGED SINCE BASELINE (C1 + C2):
- src/program-planner/js/app.js (C1)
- src/program-planner/js/register.js (C1)
- src/program-planner/js/funding-model.js (C2)

TEST FILES CHANGED:
- tests/governed-remediation.test.cjs (+5 regression tests covering all 5 C2 scenarios)
- tests/browser/quoted-lifecycle.spec.js (+1 end-to-end browser test)

DETERMINISTIC TEST RESULT:
- 39 / 39 PASS (independently reproduced by ChatGPT in Peer Review 3)
- 78 / 78 files pass node syntax check (independently verified 75/75 non-vendor files)

BROWSER TEST RESULT:
- 30 / 31 PASS (was 29 / 30 after C1, +1 new browser test passed)
- 1 known pre-existing P0 deferred finding remains (drawer.closest in status-ui.spec.js:15)

MANUAL/BROWSER ACCEPTANCE RESULT:
- PASS: Created Project with costed Job ($150 ex-GST) and council operationalAmount = $0.
  Opened Quote Builder and saved Draft Quote ($150 ex-GST).
  Quote Builder displayed customer quote contribution as $150.00, total funding as $150.00, and funding position as $0.00 (balanced).
  Issue button was enabled. Clicked Issue.
  Quote transitioned to "Issued" in live workspace.
  Readiness snapshot recorded: ready: true, customerQuote: 150, fundingGap: 0.

PEER REVIEW PACKAGE:
- Offline/Zip files for peer review/Offline-Horticulture-Operations-Suite-v5.0.0-C2-Remediation-Peer-Review.zip
- Size: 4,178,650 bytes
- SHA256: 3a96b552b309dd96ece4b3fad6eecf8ee724431c43152024000790ea2f748494
- Total Files in Archive: 145 files (includes complete Offline/ChatGPT Reviews/ history)

BRANCH RECORD PRESERVATION:
- Offline/ChatGPT Reviews/ preserved in branch and packaged in review ZIP (all 8 review & walkthrough files included).

REGRESSIONS FOUND: None
DEFERRED FINDINGS: 
- drawer.closest is not a function (status-ui.spec.js:15) [Unchanged from P0 baseline]

SAFE TO PROCEED TO NEXT TRANCHE (C3): YES (Awaiting user authorization)
```

---

## 3. Defect Analysis & Remediation Scope

### 3.1 Problem Statement (F-06 / PC-013)
When evaluating whether a candidate Draft Quote is ready for issuance, `evaluateReadiness()` evaluates project funding by querying:
`UOS.ProjectFunding.position(workspace, quote.projectId, { quote: quote })`

In the unpatched code:
```javascript
function quoteRank(quote) {
  return text(quote.status) === "Accepted" ? 2 : text(quote.status) === "Issued" ? 1 : 0;
}
function quoteContribution(quote) {
  return !quote || quoteRank(quote) < 1 || text(quote.supersededByQuoteId)
    ? 0
    : Math.max(0, money(Number(quote.grandTotal) - Number(quote.gst)));
}
```
Because the candidate quote is in `Draft` status, `quoteRank(quote)` returned `0`, forcing `quoteContribution(quote)` to `$0.00`.

As a result:
- For any customer-funded project where council operational budget is `$0.00`, `totalFunding` evaluated to `$0.00`.
- The `fundingGap` equaled the entire project delivery cost.
- `evaluateReadiness()` failed with `{ code: "FUNDING_GAP", message: "Resolve the funding gap before issuing this Quote." }`.
- The officer was permanently blocked from issuing the customer quote.

### 3.2 Contract Affected: PC-013 / Quote Readiness
- **Customer Contribution in Issue Readiness**: A candidate quote evaluated for Issue readiness must have its prospective customer contribution recognized to determine whether it satisfies the delivery cost.
- **Unrelated Workspace Drafts Protected**: Draft quotes sitting in the workspace must **never** count as committed funding. General position queries `position(workspace, projectId)` continue to ignore uncommitted drafts.
- **Superseded Quotes Blocked**: Any quote marked with `supersededByQuoteId` contributes `$0.00`.
- **Existing Committed Quotes Maintained**: Existing Issued and Accepted quotes retain their established funding contribution.

### 3.3 Strict Boundaries Maintained
- **Master source root**: 100% read-only.
- **`src/program-planner/js/funding-model.js`**: The ONLY production file modified in Tranche C2.
- **`quote-model.js`**: Untouched.
- **`program-map.js`**: Untouched; reserved for Tranche C3 (*turfing rate mapping*).
- **`costing.js`**: Untouched; reserved for Tranche C4 (*event sync & line deletion*).

---

## 4. Exact Source Changes

### [`src/program-planner/js/funding-model.js`](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation/src/program-planner/js/funding-model.js)

```diff
@@ -27,7 +27,13 @@
     });
     return quotes.length ? quotes[0] : null;
   }
-  function quoteContribution(quote) { return !quote || quoteRank(quote) < 1 || text(quote.supersededByQuoteId) ? 0 : Math.max(0, money(Number(quote.grandTotal) - Number(quote.gst))); }
+  function quoteContribution(quote, isCandidate) {
+    if (!quote || text(quote.supersededByQuoteId)) return 0;
+    if (quoteRank(quote) > 0 || (isCandidate && text(quote.status) === "Draft")) {
+      return Math.max(0, money(Number(quote.grandTotal) - Number(quote.gst)));
+    }
+    return 0;
+  }
   function activePayments(workspaceValue, quoteId) {
     if (!quoteId) return 0;
     return money((workspaceValue.entities.payments || []).reduce(function (sum, payment) { return payment.quoteId === quoteId && text(payment.status).toLowerCase() !== "reversed" ? sum + Math.max(0, Number(payment.amount) || 0) : sum; }, 0));
@@ -44,16 +50,18 @@
     var result = workspace(inputWorkspace);
     var project = find(result.entities.projects, text(projectId), "Project");
     var supplied = object(options) && object(options.quote) ? options.quote : null;
+    if (supplied && supplied.projectId && text(supplied.projectId) !== project.id) supplied = null;
+    var isCandidate = Boolean(supplied);
     var quote = supplied || applicableQuoteFor(result, project.id);
     var delivery = deliveryCostFor(result, project.id);
     var council = operationalAmount(project);
-    var customer = quoteContribution(quote);
+    var customer = quoteContribution(quote, isCandidate);
     var total = money(customer + council);
     var signedPosition = money(total - delivery);
     var receivables = receivablesFor(result, quote);
     return {
       projectId: project.id, basis: "ex-GST", calculatedDeliveryCost: delivery, operationalAmount: council,
-      customerQuote: customer, customerQuoteId: quote && quoteRank(quote) > 0 ? quote.id : null, customerQuoteStatus: quote && quoteRank(quote) > 0 ? quote.status : null,
+      customerQuote: customer, customerQuoteId: quote && (quoteRank(quote) > 0 || isCandidate) ? quote.id : null, customerQuoteStatus: quote && (quoteRank(quote) > 0 || isCandidate) ? quote.status : null,
       totalFunding: total, fundingPosition: signedPosition, fundingGap: Math.max(0, money(-signedPosition)), fundingSurplus: Math.max(0, signedPosition),
       fundingStatus: signedPosition < 0 ? "gap" : signedPosition > 0 ? "surplus" : "balanced", label: signedPosition < 0 ? "Funding Gap" : signedPosition > 0 ? "Funding Surplus" : "Balanced",
       customerGrandTotal: receivables.customerGrandTotal, paymentsPaid: receivables.paymentsPaid, depositPaid: receivables.depositPaid, customerOutstanding: receivables.customerOutstanding
```

---

## 5. Automated Regression Test Coverage

### 5.1 Deterministic Tests ([`tests/governed-remediation.test.cjs`](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation/tests/governed-remediation.test.cjs))

Added 5 comprehensive regression tests covering all governing requirements:
1. `PC-013 C2: Fully customer-funded candidate Quote satisfies readiness and issues with $0 council funding`:
   - Validates that a draft quote ($250 ex-GST) covering 100% of delivery cost ($250) with $0 council operational funding satisfies readiness (`ready: true`, `fundingGap: 0`).
   - Validates that `issue()` succeeds and snapshots readiness evidence.
2. `PC-013 C2: Partial customer contribution maintains accurate funding gap`:
   - Validates that when a candidate quote has a discount such that contribution is $120 against $200 delivery cost, `fundingGap` is exactly $80.
   - Validates that `evaluateReadiness` fails and `issue()` throws an error.
3. `PC-013 C2: Unrelated Draft Quotes in workspace do not count as committed funding`:
   - Validates that when querying `position(ws, projectId)` without a candidate option, an uncommitted Draft quote in the workspace contributes $0, maintaining `customerQuote: 0` and the full funding gap.
4. `PC-013 C2: Superseded candidate quotes cannot contribute to funding`:
   - Validates that a quote with `supersededByQuoteId` contributes $0 even if passed in `options.quote`.
5. `PC-013 C2: Existing Issued and Accepted quotes retain established committed funding behavior`:
   - Validates that existing Issued and Accepted quotes in the workspace are recognized by general queries without options.

**Result:** `39 / 39 tests PASS` (100% independently reproduced by ChatGPT in Peer Review 3).

### 5.2 End-to-End Playwright Spec ([`tests/browser/quoted-lifecycle.spec.js`](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/Horticulture-Operations-Suite-v5.0.0-P0-Remediation/tests/browser/quoted-lifecycle.spec.js))

Added end-to-end browser regression test:
- `PC-013 C2: Quote Builder evaluates prospective customer funding and allows Quote Issue with $0 council budget`:
  - Registers a record, promotes it to a Delivery Project with a $150 costed job and $0 council operational budget.
  - Opens Quote Builder and saves a Draft Quote ($150 ex-GST).
  - Verifies Quote Builder UI displays customer contribution as `$150.00`, total funding as `$150.00`, and funding position as `$0.00` (balanced).
  - Verifies Issue button is enabled and clicks Issue.
  - Verifies Quote status transitions to "Issued" in the live workspace.
  - Verifies readiness snapshot records `ready: true`, `customerQuote: 150`, and `fundingGap: 0`.

**Result:** `30 / 31 tests PASS` across full Playwright suite (only the single known pre-existing P0 deferred finding `status-ui.spec.js` remains).

---

## 6. Peer Review Package

Packaged into [`Offline/Zip files for peer review/`](file:////wsl.localhost/Ubuntu/home/n0rt/headroom-projects/Hort%20Ops%20Codex%206%20Astra%20First%20Project/src_ChatGPT-6aa27ffd-3068-83ec-bd27-67b7e6c3c05c/src/Offline/Zip%20files%20for%20peer%20review):
- **ZIP File**: `Offline-Horticulture-Operations-Suite-v5.0.0-C2-Remediation-Peer-Review.zip`
- **File Size**: `4,178,650 bytes`
- **SHA256**: `3a96b552b309dd96ece4b3fad6eecf8ee724431c43152024000790ea2f748494`
- **Contents**: Includes 145 files, preserving the complete `Offline/ChatGPT Reviews` development history.

---

## 7. Stop Point & Next Steps

In strict adherence to the controlling sequence:
> **Preserve → Branch → Verify → Baseline → P0 → Prove → Checkpoint → Stop.**

Execution halts here at the required **Stop Point**.
- **Tranche C2 is Complete & Closed**.
- Awaiting user authorization before beginning **Tranche C3 — Polygon → Job canonical Rate mapping**.
