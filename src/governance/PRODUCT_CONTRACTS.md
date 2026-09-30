# Product Contracts — v1.5-draft

This register is subordinate to `PRODUCT_CONSTITUTION.md` and makes its invariants testable.

| ID | Contract | Protected invariant | Criticality |
|---|---|---|---|
| PC-001 | REGISTER_ROOT | Every delivery chain has one originating Register matter. | Critical |
| PC-002 | PROJECT_PARENTAGE | Exactly one Register parent; at most one active Project per matter. | Critical |
| PC-003 | PLANNER_TASK_CANON | Planner Tasks are canonical Project records; no shadow checklist. | Critical |
| PC-004 | SPATIAL_OWNERSHIP | Register Locations and Project Work Geometry remain distinct. | High |
| PC-005 | GEOMETRY_JOB_PROMOTION | Geometry becomes Job/Costing lineage only by explicit promotion. | Critical |
| PC-006 | JOB_PARENTAGE | Jobs are Project-owned and source-traceable. | Critical |
| PC-007 | COST_SNAPSHOT | Historical costing preserves its rate/basis. | High |
| PC-008 | QUOTE_REVISION | Issued/resolved commercial content is immutable and revisioned. | Critical |
| PC-009 | PAYMENT_TRACEABILITY | Payments remain tied to exact Quote revision/Project. | Critical |
| PC-010 | DEPENDENCY_PROTECTION | Destructive actions cannot silently invalidate history. | Critical |
| PC-011 | WORKSPACE_RECOVERY | Persistence preserves canonical IDs, ownership and lineage. | Critical |
| PC-012 | DOMAIN_LIFECYCLES | Business domains retain separate governed lifecycles. | Critical |
| PC-013 | QUOTE_READINESS | Draft creation is permissive; Issue requires Scope, Cost-basis and Funding evidence. Gates are satisfied by evidence, not module visitation. | Critical |
| PC-014 | SIDEBAR_SURFACE_CONTRACT | Operational sidebars use only the currently sanctioned Register/Project card, row-table, full-size Location/Polygon, Polygon Inspector and Scheduler Editor surfaces. The retired expand/collapse-to-compact/undock sidebar system is not a supported UI state and must be completely unwired. | Critical |
| PC-015 | LOCATION_POLYGON_SIDEBAR | In Location module Register view, the sidebar always presents a full-size Location Card, including the empty/not-yet-recorded state. In Project view it always presents a full-size Polygons Summary Card, including the no-polygon state, and that card is the entry point to polygon editing in Polygon Inspector. Polygon Inspector cards are full-size. | Critical |
| PC-016 | SCHEDULER_INTERACTION_SCOPE | Scheduler may list all Jobs in a compact row-table and display all owner-app Jobs on the calendar, but Scheduler Editor may receive only a Job belonging to the active Register/Project. Active-project row selection and active-project calendar Job-card selection open Scheduler Editor; non-active-project calendar Job-card selection opens a read-only/summary modal instead. | Critical |
| PC-017 | SCHEDULER_ACTIVE_PROJECT_SIGNAL | Calendar days containing Draft or Scheduled Jobs belonging to the active Register/Project carry a distinct cell-level visual state. The signal is derived from canonical Job ownership/status, not from calendar-local shadow state. | High |
| PC-018 | DRAWER_VIEWPORT_FLOOR | Expanded accordion drawers must remain within the usable viewport below their row header. The thick drawer floor is always visible. Overflow is handled by internal drawer-content scrolling, not by allowing the floor or terminal content to extend off-screen. | Critical |
| PC-019 | UNIFIED_DRAWER_SCROLL | Every Register-row drawer has the same full viewport floor. Opening a row aligns its header beneath the sticky column headings and locks outer table scrolling; internal sections scroll. Closing the last row restores the prior table position. Budget remains full-page. | Critical |
| PC-020 | PLANNER_TASK_MANAGEMENT | Canonical Inert/Operational Tasks; one Draft Planner Job per Operational Task; downstream transitions respect domain boundaries and commercial history. The detailed PC-020 document applies, as amended by PC-026–028. | Critical |
| PC-021 | FINANCIAL_YEAR_CANON | Financial years are 1 July–30 June, retain identity and status, and partition annual authority without merging NSA and EVT. | Critical |
| PC-022 | ANNUAL_BUDGET_AUTHORITY | At most one Annual Budget per owner and year; approval and every later authority change are recorded. Approved budget is distinct from project funding, forecast, commitment and actual spend. | Critical |
| PC-023 | BUDGET_ALLOCATION_LINEAGE | Allocations belong to a same-owner Register and Annual Budget; Project references resolve to that Register. Multiple years remain separate and net allocations cannot exceed net approved authority. | Critical |
| PC-024 | BUDGET_ADJUSTMENT_IMMUTABILITY | Signed budget/allocation adjustments and transfers are append-only, explicitly approved with recorded names and evidence; corrections are compensating records. | Critical |
| PC-025 | FINANCIAL_PERIOD_CLOSURE | Closed years freeze financial mutations until a recorded reopen decision. Register carry-forward Yes/No starts review; verified prior-year unspent can only be proposed, then independently approved into new-year authority. | Critical |
| PC-026 | JOB_ORIGIN_LINEAGE | Exactly one of Planner Task, Calculator work or Space Map geometry is each Job's canonical origin; source identity, Register, Project and owner are preserved. | Critical |
| PC-027 | OPERATIONAL_TASK_PROMOTION | Inert Tasks have no delivery lineage. Operational classification creates/resolves one Planner Draft Job; scheduling is a separate action. Repeated promotion is idempotent and demotion protects history. | Critical |
| PC-028 | COSTING_AND_QUOTE_LINEAGE | Planner Draft Job creation does not cost or quote work. Explicit costing snapshots a valid basis on the same Job; eligible Draft Quote inclusion is deliberate and Issue still needs readiness evidence. | Critical |

A Critical contract change requires an explicit decision, constitutional amendment where applicable, migration analysis, updated proof and release-gate reassessment. Restoring compliance with an existing contract is a bug fix, not a constitutional amendment.

## Financial and delivery interpretation

Budget authority is the approved annual amount plus approved signed budget adjustments. Allocation is the sum of approved signed allocations for that year. Each amount is stored in cents; negative totals, cross-owner links, duplicate owner/year budgets and over-allocation are invalid. Commitment, actual expenditure and forecast are reported separately. A released commitment must not be counted again as actual spend.

An approval record includes a named person and decision evidence; this contract does not assert login authentication. A recorded approval is required for budget approval, adjustment, transfer, allocation, close, reopen and carry-forward acceptance. No imported `project.funding.operationalAmount` or legacy `approvedBudget` is promoted to annual authority without reviewed mapping and explicit approval.

PC-020's automatic Draft Job creation remains. Its older language about automatic costing and inherited Quote Lines is narrowed by PC-028: downstream records are created only by the separate governed actions described there. This amendment is recorded in `DECISIONS.md` and the detailed PC-020 document.


## UI contract interpretation

PC-014 through PC-017 protect interaction architecture rather than decorative styling. They may be implemented with different colours, spacing or typography, but their surface types, ownership boundaries, routing behaviour and active-project distinction must not drift.

The retired sidebar framework is not a dormant feature. No expand-to-wide, collapse-to-super-narrow, undock, floating-sidebar or associated state/persistence pathway is permitted to remain wired into production behaviour. Residual dead code is a release concern and should be removed once verified safe.

For Scheduler, “active Register/Project” means the Project currently selected through the owning Register context. A Job from any other Register/Project may be visible on the owner-app calendar, but it must not be injected into Scheduler Editor under the active context.

## Drawer contract interpretation

PC-018 and PC-019 define geometry and overflow behaviour, not cosmetic styling. The thick bottom rule is a functional boundary marker and is part of the acceptance contract.

For every Register-row drawer, the selected row header sits directly beneath the sticky table headings and establishes the drawer's top boundary. Its 4px floor sits 4px above the usable viewport bottom. Overflow belongs inside the drawer content region.

There is no Register-specific height exception. While any row is open the outer Register table cannot scroll; all rows remain in the DOM, internal sections may scroll, and the previous table position is restored when the last row closes. Budget remains a full-page workspace with the same hard-floor treatment.
