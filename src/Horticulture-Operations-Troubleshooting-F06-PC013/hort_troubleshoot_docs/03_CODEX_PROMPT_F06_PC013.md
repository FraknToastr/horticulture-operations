# Codex Prompt — Resolve F-06 / PC-013 Quote Readiness Only

You are working on the current Horticulture Operations Suite v5.0.0 package.

This task is deliberately narrow.

## Scope

Resolve **F-06 / PC-013 Quote Readiness** completely.

Do not work on F-01, F-02, F-03, F-04, F-05, F-07, F-08, F-09 or PC-020 in this change set unless a tiny compatibility adjustment is strictly required for F-06.

Do not perform broad refactoring.

---

# Confirmed defect

The current implementation has a circular funding-readiness defect.

`quote-model.js` correctly calls:

```js
ProjectFunding.position(result, quote.projectId, { quote: quote })
```

while evaluating a Draft Quote for Issue.

But `funding-model.js` uses `quoteContribution()` which returns customer contribution only for **Issued** or **Accepted** Quotes.

Therefore the Draft Quote being evaluated contributes `$0` to its own readiness calculation.

Confirmed reproduction:

```text
Calculated delivery cost:      $100 ex GST
Draft Quote subtotal:          $100
Draft Quote GST:               $10
Draft Quote grand total:       $110
Council Operational Amount:    $0
```

Current result:

```text
customerQuote:  $0
fundingGap:     $100
ready:          false
```

This blocks a valid fully customer-funded Quote from Issue.

---

# Required business rule

There are two distinct funding contexts.

## Ordinary committed Project funding

Only the applicable non-superseded Issued/Accepted Quote should normally count as committed customer funding.

Draft Quotes must not inflate the ordinary Project funding position.

## Quote Readiness candidate funding

When a specific Draft Quote is being evaluated for Issue, that Draft's proposed ex-GST customer contribution must be counted **prospectively**.

The readiness question is:

> If this Draft becomes Issued, does its proposed customer contribution plus governed Council/non-customer funding cover the calculated delivery cost?

Do not require the Quote to already be Issued before counting that candidate contribution.

---

# Preferred implementation

Make candidate semantics explicit in `funding-model.js`.

Prefer an API such as:

```js
ProjectFunding.position(workspace, projectId, {
  candidateQuote: quote
});
```

If retaining `{ quote: quote }` for compatibility, document and implement it explicitly as candidate/hypothetical funding rather than silently reusing committed-Quote semantics.

Separate helpers conceptually into:

```text
preGstQuoteContribution
committedQuoteContribution
candidateQuoteContribution
```

Do not globally make Draft Quotes count as committed funding.

Update `quote-model.js::evaluateReadiness()` to request candidate funding explicitly.

---

# Readiness dimensions that must remain intact

PC-013 must continue to evaluate:

1. Scope evidence.
2. Cost-basis evidence.
3. Funding evidence.

Do not weaken any dimension merely to fix the Draft funding defect.

Draft creation remains permissive.

Issue remains blocked if any mandatory evidence dimension fails.

---

# Required tests

The existing test is inadequate because Council Operational Amount fully covers the delivery cost and therefore masks the customer-contribution bug.

Add explicit tests for:

### 1. Fully customer funded

```text
Delivery cost 100
Draft customer contribution 100 ex GST
Council Operational Amount 0
Expected funding gap 0
Expected ready true
```

### 2. Mixed funding

```text
Delivery cost 100
Draft customer contribution 60
Council Operational Amount 40
Expected funding gap 0
Expected ready true
```

### 3. Genuine funding gap

```text
Delivery cost 100
Draft customer contribution 60
Council Operational Amount 20
Expected funding gap 20
Expected ready false
```

### 4. Semantic separation

With a Draft Quote of 100 and no Issued/Accepted Quote:

```text
ordinary Project funding customer contribution = 0
candidate Quote Readiness customer contribution = 100
```

### 5. Readiness snapshot

On successful Issue, verify that the immutable Quote stores:

- ready = true;
- scope evidence;
- cost-basis evidence;
- candidate funding evidence;
- calculated delivery cost;
- prospective customer contribution;
- Council Operational Amount;
- final funding gap/status.

### 6. Missing scope still blocks

### 7. Missing cost basis still blocks

### 8. Issued snapshot remains unchanged after later mutable source changes

---

# Acceptance conditions

Do not declare this task complete until all are true:

- a valid fully customer-funded Draft Quote can Issue with Council Operational Amount = 0;
- a valid mixed-funded Draft Quote can Issue;
- a genuine funding gap blocks Issue;
- Draft Quotes do not contaminate ordinary committed Project funding views;
- Issue stores immutable readiness evidence;
- existing Quote revision/immutability behaviour remains intact;
- Node tests pass;
- relevant browser acceptance is updated where available.

Test-harness/reproducibility shortcomings are to be reported separately as evidence/release-process issues, not promoted to Critical business defects by themselves.

---

# Forbidden shortcuts

Do not:

- remove the funding gate;
- force Council funding to cover every delivery cost;
- count every Draft Quote as committed funding;
- use GST-inclusive customer totals against ex-GST delivery cost;
- satisfy readiness by module visitation;
- weaken scope or cost-basis evidence;
- alter tests merely to match defective implementation;
- refactor unrelated modules.

At completion, report:

1. files changed;
2. exact funding semantics before/after;
3. every test added or changed;
4. test results;
5. evidence that fully customer-funded Draft Issue now succeeds;
6. evidence that genuine funding gaps still fail.
