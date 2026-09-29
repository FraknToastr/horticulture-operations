# F-06 / PC-013 — Quote Readiness Focused Remediation

## Purpose

This document deliberately excludes F-01 through F-05 and F-07 through F-09.

Its sole purpose is to resolve **F-06 / PC-013 Quote Readiness** correctly and to prevent the current implementation from blocking valid customer-funded Draft Quotes.

---

# 1. Constitutional requirement

PC-013 establishes Quote Readiness as an **evidence gate at Issue**.

Draft Quote creation remains permissive.

A Draft may become Issued only when canonical evidence sufficiently answers three questions:

1. **Scope** — what is Council proposing to deliver or charge for?
2. **Cost basis** — how was each material commercial amount established?
3. **Funding** — who is funding the work and how is the commercial amount composed?

The gate is evidence-based, not module-visitation-based.

A user must not be required to visit Planner, Space Map or Resource Calculator merely to satisfy a workflow sequence if equivalent canonical evidence already exists.

At Issue, the readiness outcome and sufficient evidence references/snapshots must become part of the immutable Quote revision.

---

# 2. Current implementation

`src/program-planner/js/quote-model.js`

`evaluateReadiness()` currently:

- identifies material Quote Lines;
- evaluates scope evidence;
- evaluates cost-basis evidence;
- calls `ProjectFunding.position(result, quote.projectId, { quote: quote })`;
- blocks Issue when the resulting `fundingGap` is greater than zero;
- snapshots readiness evidence on successful Issue.

This is architecturally correct.

The defect is inside funding semantics.

---

# 3. Confirmed F-06 defect

`src/program-planner/js/funding-model.js`

Current logic defines:

```js
function quoteRank(quote) {
  return text(quote.status) === "Accepted" ? 2 :
         text(quote.status) === "Issued" ? 1 : 0;
}

function quoteContribution(quote) {
  return !quote || quoteRank(quote) < 1 || text(quote.supersededByQuoteId)
    ? 0
    : Math.max(0, money(Number(quote.grandTotal) - Number(quote.gst)));
}
```

Therefore Draft Quotes always contribute `$0`.

`ProjectFunding.position()` accepts an explicitly supplied Quote:

```js
var supplied = object(options) && object(options.quote) ? options.quote : null;
var quote = supplied || applicableQuoteFor(result, project.id);
...
var customer = quoteContribution(quote);
```

But because `quoteContribution()` still requires Issued/Accepted state, the supplied Draft Quote is discarded as a funding source.

## Circular failure

PC-013 asks:

> If this Draft Quote were issued, would the proposed customer contribution plus governed non-customer funding cover the delivery cost?

The current code instead asks:

> Has this Quote already been issued before I count it as customer funding?

That creates a circular gate:

```text
Draft must be Issued to count as customer funding
       ↓
Issue requires Quote Readiness
       ↓
Quote Readiness ignores Draft customer funding
       ↓
funding gap
       ↓
Issue blocked
```

---

# 4. Reproduced failure

The current source was executed with:

```text
Calculated delivery cost:      $100 ex GST
Draft Quote subtotal:          $100
Draft Quote GST:               $10
Draft Quote grand total:       $110
Council operational funding:   $0
```

Current readiness result:

```json
{
  "customerQuote": 0,
  "operationalAmount": 0,
  "totalFunding": 0,
  "fundingGap": 100,
  "fundingStatus": "gap",
  "ready": false
}
```

Failure:

```text
Resolve the funding gap before issuing this Quote.
```

The correct prospective position is:

```text
Calculated delivery cost:  $100
Prospective customer funds: $100
Council operational funds: $0
Total funding:              $100
Funding gap:                $0
Ready on funding dimension: YES
```

This is a Critical business-rule defect because it can prevent valid Quotes from being issued.

---

# 5. Required semantic distinction

The funding model has two different legitimate questions and must represent them separately.

## A. Current committed Project funding position

Used by dashboards/reports/general project funding views.

Customer contribution should normally come from the current non-superseded **Issued or Accepted** Quote because that represents an established commercial commitment.

Draft Quotes must not inflate the ordinary committed funding position merely because someone is preparing them.

## B. Candidate Quote Readiness funding position

Used only when deciding whether a particular Draft Quote may become Issued.

The Draft Quote being evaluated must be treated as the **prospective customer contribution** that will become commercially active if Issue succeeds.

This does not make every Draft Quote committed funding.

It is a hypothetical/candidate calculation scoped to the Issue decision.

---

# 6. Recommended implementation

Do not globally change `quoteContribution()` so that every Draft Quote counts in normal Project funding.

Instead make candidate semantics explicit.

## Preferred API

Change the funding call from a vague supplied `quote` option to an explicit candidate concept, for example:

```js
ProjectFunding.position(workspace, projectId, {
  candidateQuote: quote
});
```

or retain `quote` for compatibility but make the semantics explicit in the implementation and documentation.

## Preferred internal structure

```js
function committedQuoteContribution(quote) {
  if (!quote || quoteRank(quote) < 1 || text(quote.supersededByQuoteId)) return 0;
  return preGstQuoteContribution(quote);
}

function candidateQuoteContribution(quote) {
  if (!quote || text(quote.supersededByQuoteId)) return 0;
  if (text(quote.status) !== "Draft") return committedQuoteContribution(quote);
  return preGstQuoteContribution(quote);
}

function preGstQuoteContribution(quote) {
  return Math.max(0, money(Number(quote.grandTotal) - Number(quote.gst)));
}
```

Then:

```js
function position(inputWorkspace, projectId, options) {
  ...
  var candidate = object(options) && object(options.candidateQuote)
    ? options.candidateQuote
    : null;

  var committedQuote = candidate ? null : applicableQuoteFor(result, project.id);
  var fundingQuote = candidate || committedQuote;

  var customer = candidate
    ? candidateQuoteContribution(candidate)
    : committedQuoteContribution(committedQuote);

  ...
}
```

The exact function names may differ, but the semantic split is mandatory.

---

# 7. Readiness call

`evaluateReadiness()` should explicitly request candidate funding semantics:

```js
var funding = UOS.ProjectFunding && typeof UOS.ProjectFunding.position === "function"
  ? UOS.ProjectFunding.position(result, quote.projectId, {
      candidateQuote: quote
    })
  : null;
```

This makes it impossible for a future maintainer to mistake ordinary committed-funding logic for Issue-time candidate funding logic.

---

# 8. Required readiness snapshot

On successful Issue, `readinessSnapshot.evidence.funding` should preserve enough evidence to reconstruct the Issue decision.

Recommended fields:

```text
basis: ex-GST
calculatedDeliveryCost
candidateQuoteId
candidateQuoteStatusAtEvaluation
prospectiveCustomerContribution
operationalAmount
totalFunding
fundingGap
fundingSurplus
fundingStatus
evaluatedAt
```

The existing Quote then becomes Issued immediately after the readiness decision, but the snapshot should truthfully show that it was evaluated as a Draft candidate.

This is more auditable than storing only a generic `customerQuote` number with no explanation of why a Draft amount was counted.

---

# 9. Scope dimension

The current approach is broadly appropriate:

- Quote-level scope notes can provide scope evidence;
- material Quote Line descriptions can provide scope evidence;
- a Quote with no material scope must not Issue.

Do not require a Planner Task or Space Map Geometry if the Quote already has legitimate canonical scope evidence.

## Important future interaction with PC-020

When governed Customer Treatment is implemented, a `COUNCIL_FUNDED` inherited line may be visible to the customer with zero customer charge while still representing real operational work and cost.

Therefore future PC-020 integration must not define “material scope” solely as `QuoteLine.total > 0`.

For the current F-06 fix, do not prematurely implement PC-020, but do not harden PC-013 in a way that makes zero-customer-charge operational lines impossible later.

---

# 10. Cost-basis dimension

The current recognised pathways are conceptually sound:

### Inherited Costing Line

```text
sourceKind = costingLine
AND costingLineId resolves canonically
```

### Approved Rate / catalogue evidence

```text
rateItemId or catalogId resolves to approved governed evidence
```

### Authorised manual Quote Line

```text
sourceKind = custom
costBasis = authorised-manual
costBasisReason or sufficient description exists
```

A bare custom amount with no recognised basis must not satisfy PC-013.

## Required improvement

Tests must explicitly exercise every accepted pathway and every rejected pathway.

One Council-funded happy path is not enough to prove Quote Readiness.

---

# 11. Funding dimension

The funding equation for the current implementation is ex-GST:

```text
Total Funding
= Prospective Customer Contribution
+ Council Operational Amount
```

and:

```text
Funding Position
= Total Funding - Calculated Delivery Cost
```

Therefore:

```text
Funding Gap = max(0, Calculated Delivery Cost - Total Funding)
```

## Readiness rule

Issue may proceed on the funding dimension when:

```text
Funding Gap <= monetary tolerance
```

The existing `$0.004`-style tolerance may be retained if it is consistently applied to rounded currency amounts.

Do not use GST-inclusive customer totals against ex-GST delivery cost.

The existing use of:

```text
grandTotal - gst
```

is therefore directionally correct for the current model.

---

# 12. Required test matrix

The current PC-013 Node test proves only one narrow pathway: Council operational funding fully covers the cost.

Replace or extend it with the following matrix.

## QR-01 — fully customer funded

```text
Delivery cost:    100
Draft customer:   100 ex GST
Council:            0
Expected gap:        0
Expected ready:    true
```

This is the regression that catches F-06.

## QR-02 — mixed customer/Council funding

```text
Delivery cost:    100
Draft customer:    60
Council:            40
Expected gap:        0
Expected ready:    true
```

## QR-03 — fully Council funded

```text
Delivery cost:    100
Draft customer:     0 where legitimate commercial representation permits it
Council:           100
Expected gap:        0
Expected ready:    true
```

For the pre-PC-020 product, use a Quote structure that legitimately represents the scenario without inventing future Customer Treatment functionality.

## QR-04 — genuine funding gap

```text
Delivery cost:    100
Draft customer:    60
Council:            20
Expected gap:       20
Expected ready:   false
```

## QR-05 — surplus

```text
Delivery cost:    100
Draft customer:    80
Council:            30
Expected surplus:   10
Expected gap:        0
Expected funding readiness: true
```

The product may separately decide whether a surplus needs officer review, but it must not mislabel it as a gap.

## QR-06 — Draft does not contaminate ordinary Project funding view

Project has no Issued/Accepted Quote and a Draft customer Quote of 100.

Expected ordinary committed Project funding:

```text
customer contribution = 0
```

Expected candidate readiness funding for that same Draft:

```text
prospective customer contribution = 100
```

This proves the semantic separation.

## QR-07 — Issue snapshots readiness

After QR-01 passes and Issue succeeds:

- Quote status = Issued;
- readinessSnapshot.ready = true;
- scope evidence retained;
- cost-basis evidence retained;
- candidate funding evidence retained;
- commercial fingerprint retained.

## QR-08 — missing scope

Adequate cost and funding but insufficient scope evidence.

Expected: blocked with actionable `SCOPE_MISSING` result.

## QR-09 — missing cost basis

Adequate scope and funding but one material custom line has no recognised basis.

Expected: blocked with `COST_BASIS_MISSING` identifying the line.

## QR-10 — issue immutability

After Issue, later Project funding, Costing or Draft changes must not rewrite the issued readiness snapshot.

---

# 13. Browser acceptance

Node tests are necessary but are not sufficient to prove the complete Issue workflow.

Browser acceptance should prove:

1. create/open a Draft Quote;
2. customer contribution visibly matches Quote calculation;
3. Council Operational Amount is editable and retained;
4. readiness indicator/failure message matches the canonical evaluator;
5. a valid fully customer-funded Quote can Issue;
6. a genuine funding gap blocks Issue with an actionable explanation;
7. after Issue, the Quote is immutable and the readiness snapshot is preserved.

If the browser-test harness has execution issues, classify those separately as evidence/release-process issues rather than reclassifying PC-013 itself. The business rule must still be verified by source-level tests while the harness issue is repaired.

---

# 14. Do not solve F-06 with these shortcuts

Do **not**:

- remove the funding readiness check;
- count every Draft Quote as committed Project funding;
- automatically increase Council Operational Amount to close a gap;
- use GST-inclusive Quote total against ex-GST delivery cost;
- mark readiness true merely because Resource Calculator or Quote Builder was visited;
- weaken missing scope/cost-basis evidence requirements;
- modify tests so the current defective calculation passes;
- require Council Operational Amount to equal delivery cost when the customer is legitimately funding the work.

---

# 15. Minimal code surface expected

Primary files:

```text
src/program-planner/js/funding-model.js
src/program-planner/js/quote-model.js
```

Tests:

```text
tests/governed-remediation.test.cjs
```

Add a dedicated Quote Readiness test file if that produces a clearer matrix, for example:

```text
tests/quote-readiness.test.cjs
```

Browser coverage should be added/extended under:

```text
tests/browser/
```

Do not refactor unrelated modules as part of F-06.

---

# 16. Definition of done

F-06 / PC-013 is resolved only when all of the following are true:

- Draft Quote creation remains permissive;
- `evaluateReadiness()` is the single authoritative Issue readiness evaluator;
- the Draft Quote under evaluation contributes its prospective ex-GST customer amount to candidate funding;
- ordinary Project funding views still ignore unissued Draft Quotes as committed customer funding;
- scope, cost-basis and funding remain separate evidence dimensions;
- genuine funding gaps still block Issue;
- fully customer-funded valid Quotes can Issue with `$0` Council Operational Amount;
- mixed customer/Council-funded valid Quotes can Issue;
- Issue stores immutable readiness evidence;
- issued commercial content remains immutable;
- tests explicitly cover the customer-funded pathway that the current test suite misses.

The central invariant is:

> **A Draft Quote must not have to be Issued before its own proposed customer contribution can be considered when deciding whether that Draft is ready to Issue.**
