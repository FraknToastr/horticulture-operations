I reviewed the codebase and ran the existing Node test suite: 12 test files passed, 0 failed. The current system has a serious governance foundation, but it is not yet strong enough to govern annual budgets or Planner-originated delivery paths safely.

## Governance and constitution

Strong points:

- The constitution establishes a canonical business graph: Register → Project → Tasks / Geometry / Jobs / Quotes.
- It explicitly prohibits shadow module databases.
- It protects ownership, workspace separation, geometry promotion, costing snapshots, quote revisions, payment traceability, and dependency-aware deletion.
- The authority order and amendment rule are unusually good for AI-assisted development.
- PC-020 gives Planner Tasks explicit lineage and lifecycle semantics.
- The test suite already proves important invariants such as quote readiness, workspace isolation, data sanitation, geometry/job promotion, and status history.

The main weaknesses are governance completeness and enforceability:

1. The constitution is still marked `1.4-draft`, while the contracts are `1.5-draft`.

2. Governance documents are not fully synchronized. `README_GOVERNANCE.md` says the Markdown sources are authoritative and the viewer is a derived convenience artifact, but the viewer must still be treated as a generated artifact with a reproducible validation process.

3. There is no explicit constitutional domain for:

   - annual financial years;
   - approved budgets;
   - budget revisions;
   - transfers;
   - commitments;
   - actual expenditure;
   - carry-forward;
   - budget approvals;
   - adjustment authority;
   - audit history.

4. The authority order places executable tests below decisions and canonical models, but there is no automated check that tests actually cover every Critical contract.

5. There is no formal amendment record structure. Decisions are prose ADRs, but amendments should identify:

   - affected constitutional clauses;
   - old rule;
   - new rule;
   - migration requirement;
   - compatibility impact;
   - release gates;
   - effective version/date;
   - approval authority.

6. There is no explicit “no silent migration” rule for financial data. Budget data requires stronger protection than ordinary project metadata.

7. The constitution protects quote and payment history, but not the financial source-of-truth boundary between:

   - planned cost;
   - approved budget;
   - allocated budget;
   - committed amount;
   - actual spend;
   - forecast;
   - remaining availability.

I recommend adding a financial constitution amendment before implementing annual budgets.

## Current City Operational Amount

The existing implementation is narrower than an annual budget:

- It stores one project-level value at `project.funding.operationalAmount`.
- It is non-negative and rounded to cents.
- It contributes to quote funding calculations.
- It is also reported as `approvedBudget`.
- Legacy `approvedBudget` values are migrated into it.
- Financial summaries calculate committed and actual amounts from Jobs and Costing Lines.

This means “City Operational Amount” currently behaves as a project funding contribution, not as an annual City budget.

The important issue is that `approvedBudget` is being used as an alias for the operational amount:

```text
operationalAmount → approvedBudget
```

That will become unsafe once annual allocations exist. A project’s allocation cannot be the same thing as the City’s annual approved budget.

The current model also has no adjustment ledger. A value can be changed, but the system cannot answer:

- who changed it;
- why;
- under which authority;
- from which amount;
- to which amount;
- whether it was a transfer, correction, supplementary allocation, or reduction;
- whether the adjustment occurred before or after commitment;
- which financial year it affected.

## Recommended budget model

Introduce a separate canonical financial layer rather than expanding `operationalAmount` into an overloaded field.

Suggested entities:

```text
FinancialYear
  id
  code: "2026-27"
  startDate
  endDate
  status: draft | open | closed
  approvedAt
  approvedBy

AnnualBudget
  id
  financialYearId
  owner
  approvedAmount
  reservedAmount
  committedAmount
  actualAmount
  status
  version

BudgetAllocation
  id
  annualBudgetId
  projectId
  allocatedAmount
  reservedAmount
  committedAmount
  actualAmount
  status
  source
  version

BudgetAdjustment
  id
  annualBudgetId
  allocationId
  type
  amount
  reason
  authority
  effectiveDate
  createdBy
  createdAt
  predecessorId
  approvalState
```

The existing field should be retained temporarily as a compatibility projection:

```text
project.funding.operationalAmount
```

It should become either:

- the current project allocation projection; or
- a deprecated legacy field that is read only during migration.

The financial calculations should distinguish:

```text
approved budget
+ adjustments
- transfers out
+ transfers in
= available annual budget

available annual budget
- project allocations
= unallocated budget

project allocation
- commitments
- actual spend
= remaining project allocation
```

Do not derive annual budget from project totals without preserving the allocation records. That would lose the financial audit trail.

## Required budget behaviour

The budget feature should support at least:

- financial-year creation and closure;
- annual approval;
- project allocation;
- allocation increases and decreases;
- supplementary budget;
- transfers between projects or budget lines;
- returns/reductions;
- carry-forward;
- budget freeze after year close;
- correction adjustments with justification;
- commitment checks;
- overspend warnings and hard stops where appropriate;
- immutable adjustment history;
- reporting by owner, year, project, job, quote, and status;
- migration diagnostics for conflicting legacy values.

A closed financial year should be immutable except through a controlled correction or reopening process.

## Planner-originated job paths

The code already contains meaningful Planner job support.

`planner-model.js` has a `scheduleTask()` pathway that:

- creates a deterministic Job ID;
- links the Job to the Task;
- sets `sourceKind: "planner"`;
- sets `sourceEntityId` to the Planner Task;
- preserves Project and owner lineage;
- prevents duplicate Planner Jobs.

The Scheduler also recognises Planner as a canonical source and resolves it back to `entities.tasks`.

This is a good foundation.

However, the current design appears to conflate “schedule this task” with “create a Planner Job.” That creates several risks:

1. A Planner task can become schedulable before its operational classification is fully governed.

2. The Planner path does not appear to establish a complete downstream costing/quote path. It creates a Job, but Planner-originated Jobs may not automatically have a Costing Line or a clear cost basis.

3. The constitution says Planner Tasks may establish Job and Costing lineage, but the implementation needs an explicit distinction between:

   - inert Planner task;
   - operational Planner task;
   - scheduled Planner Job;
   - costed Planner Job;
   - quoted Planner work.

4. Planner-originated Jobs need stronger lineage fields than only `sourceKind` and `sourceEntityId`.

5. The system needs a clear rule for whether a Planner task creates:

   - a Job only;
   - a Job plus Costing Line;
   - a Job plus Costing Line plus Quote Line;
   - or a Job first, with later deliberate promotion into costed work.

I recommend the following canonical path:

```text
Planner Task
  ↓ classify as Operational
Planner Job
  ↓ schedule
Scheduler Job state
  ↓ cost explicitly
Costing Line snapshot
  ↓ include deliberately
Draft Quote Line
  ↓ readiness evidence
Issued Quote revision
  ↓ delivery
Actual expenditure
```

Each transition should be explicit, idempotent, and reversible only through governed state changes.

Suggested Planner Job lineage:

```text
job.sourceKind = "planner"
job.sourceEntityId = task.id
job.sourceTaskId = task.id
job.projectId = task.projectId
job.owner = task.owner
job.lineage = {
  origin: "planner",
  originId: task.id,
  projectId: task.projectId
}
```

The existing `jobId` and `schedulerJobId` fields on Tasks should eventually be reduced to one canonical relationship or treated as compatibility aliases. Having both creates a potential divergence point.

## Highest-priority governance additions

Before implementation, I would add:

- PC-021 — FINANCIAL_YEAR_CANON
- PC-022 — ANNUAL_BUDGET_AUTHORITY
- PC-023 — BUDGET_ALLOCATION_LINEAGE
- PC-024 — BUDGET_ADJUSTMENT_IMMUTABILITY
- PC-025 — FINANCIAL_PERIOD_CLOSURE
- PC-026 — PLANNER_JOB_LINEAGE
- PC-027 — OPERATIONAL_TASK_PROMOTION
- PC-028 — COSTING_AND_QUOTE_LINEAGE

And release gates for:

- no budget mutation without an adjustment record;
- no closed-year mutation;
- no cross-owner allocation;
- no allocation without a Project/Register lineage;
- no duplicate Planner Job for one Task;
- no orphan Planner Job;
- no quote issuance from untraceable Planner work;
- migration of existing `operationalAmount` values;
- reconciliation of annual totals against project allocations.

## Overall assessment

The codebase has a strong operational constitution and a credible lineage model. Its strongest architectural principle is that modules are views over canonical records rather than independent databases.

The financial model is currently the weakest major domain. City Operational Amount is suitable as a project-level contribution, but it should not be extended directly into an annual budget. Add a separate annual budget and immutable adjustment ledger, then expose project allocations as a governed link to it.

Planner-originated Jobs are partially implemented and conceptually aligned with the constitution, but need a formal operational-task promotion rule and explicit Job → Costing → Quote lineage before they can safely drive the broader Planner–Calculator–Scheduler–Map–Quote–Job system.
