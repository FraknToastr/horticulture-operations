# Planner and Budget UI acceptance — 29 September 2026

## Planner Task editor

- Add and Edit open the same modal and expose title, description, section, classification, status, assignee, due date, notes and order.
- Rows display concise summaries; governed mutation occurs in the modal.
- Inert saves create no Job.
- Operational saves create or resolve exactly one Draft Job with `sourceKind: planner` and the Task as `sourceEntityId`.
- Repeated edits preserve Job identity and synchronize its current title.
- A linked Task cannot return to Inert, and linked Job details remain read-only in Planner.
- Save & Open Scheduler selects the exact Job and Project in the existing Scheduler editor. Planner does not own duplicate scheduling fields.

Prepared automation: `tests/planner-draft-job.test.cjs` and `tests/browser/planner-task-editor.spec.js`.

## Budget presentation

- Desktop Budget uses equal left/right columns.
- Left contains financial-year selection, all selected-year approval parameters, and Pending changes.
- The main heading is **Budget Approvals Annual**; the separate introductory Annual Budget card is absent.
- Draft approval inputs form three equal desktop pairs: Amount/Effective date, Recording officer/Named approver, and Reason/Evidence. The Status pill occupies the approval section's upper-right corner.
- Right stacks Approved, Allocated and Unallocated metric cards.
- Budget page has no Register Allocations table; Register drawer Allocate/Adjust remains the allocation workflow.
- The header shows only the active-owner/current-FY Unallocated amount immediately after Budget, uses prominent numeric type, and renders `$0.00` when no authority/allocation exists.
- Header warnings are represented by a counted Warnings button and read in an accessible modal rather than occupying persistent header space.
- Approval draft values remain isolated by financial year and status pills retain distinct governed state colors.

Prepared automation: `tests/browser/budget-workflow.spec.js` plus existing Budget model/governance suites.

## Evidence state

Implementation and tests are verified. On 29 September 2026, `npm run test:release` passed 112 Node tests, 73 browser tests, and the dedicated 17 model plus 6 browser Budget Gate O/P checks. Focused Planner/Budget browser tests, syntax checks and `git diff --check` also passed. This is revision evidence, not a declaration that every Critical release obligation is closed.
