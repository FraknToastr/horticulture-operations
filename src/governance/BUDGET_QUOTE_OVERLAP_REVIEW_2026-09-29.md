# Budget and Quote overlap review — 29 September 2026

## Decision

Budget authority and Quote composition remain separate governed concerns. This review makes no Quote source-code or workflow change. It records overlap for a later, separately approved tranche.

## Canonical responsibilities

| Concern | Canonical source | Purpose |
|---|---|---|
| Annual authority | `annualBudgets` plus signed budget entries | Approves gross Council authority for one owner and financial year. |
| Register allocation | `registerAllocations` plus signed allocation entries | Assigns authority to one same-owner Register record and financial year. A Project is not required. |
| Quote | `quotes`, Quote items and governed snapshots | Describes a commercial offer assembled from deliberate costing lines. It does not create budget authority. |
| Quote funding display | Governed allocation projection, with quarantined legacy fallback | Explains funding associated with a Quote; it is not an approval or allocation control. |

## Confirmed overlap and risks

1. Quote Builder's “Council Operational Amount” and Budget's Register allocation can describe the same money in different language. With governed annual budgets, the Quote field is derived/read-only; legacy workspaces can treat the similarly labelled value as editable. One control therefore changes meaning according to workspace history.
2. Funding projection can aggregate Register allocations without an explicit Quote financial-year choice. A Quote spanning years can therefore present a cross-year amount beside one commercial total. This is an explanatory-risk boundary, not evidence that money moved incorrectly.
3. “Approved budget”, “allocated”, “Council funding”, and “operational amount” appear close together although they represent owner/year authority, Register/year assignment, and Quote funding presentation.
4. Quote Builder's Manage Budget route opens Budget, while operational Register allocation is intentionally performed from the Register drawer. Removing the Budget-page Register Allocations table clarifies the distinction but leaves future navigation wording to resolve.
5. Reports may compare Quote and budget data, but an approved Quote value must never be inferred as annual authority or a Register allocation.

## Recommended later tranche

- Add an explicit Quote funding basis: owner, Register and financial year. Never silently total multiple financial years.
- Replace the dual-mode “Council Operational Amount” control with a clearly labelled read-only governed allocation summary when annual-budget governance is active. Keep legacy manual values visibly marked and quarantined until migrated.
- Use consistent terms: **Annual authority**, **Register allocation**, **Quote value**, and **Quote funding position**.
- Route “Manage allocation” to the selected Register's Allocate/Adjust action; retain a separate “Open Budget approvals” route for annual authority.
- Show allocation lineage (financial year, Register ID and approval state) in Quote review evidence without copying or mutating the Budget ledger.
- Add contract tests proving Quote save/issue cannot create, approve, adjust, transfer or consume Budget authority.

## Non-change statement

No Quote UI, model, persistence, issue-readiness, or reporting behavior was changed by this review. These recommendations require a later plan, explicit approval, migration analysis and focused regression coverage.
