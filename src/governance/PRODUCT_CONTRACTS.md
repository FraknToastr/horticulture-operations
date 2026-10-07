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

## Register shortcut contract interpretation

Shortcut readiness and usage are separate. A linked Project enables Planner, Calculator, Scheduler and Quotes, including empty modules; missing Project disables these shortcuts. Space Map is independently available. Register is always enabled and in use. Current selection uses aria-current without disabling the button. Active navigation opens the requested record/module and cannot create prerequisite records or collapse the drawer. Usage is derived from current saved module data; generated untouched tasks and visitation alone do not count. Budget and Actions alignment must match their corresponding row content without widening the shortcut background unnecessarily.


## Canonical Calculator and Map command ownership — PC-026 / PC-028 amendment

This amendment supersedes rules requiring every Costing Line to have a Job,
requiring all Calculator additions to share an aggregate Job, or requiring
every mapped costing lineage to have a Job. Existing assigned lines,
aggregate Jobs, confirmed schedules and financial history are preserved.

- Rate Items persist schedulerEnabled. Missing values default on for Labour
  and Contractors and off for other categories. Explicit settings win;
  changes affect future additions only and never create Jobs for old lines.
- ProgramCosting owns createWork, recreateWorkJob and deleteWorkJob. Manual
  Calculator additions, mapped costing and explicit polygon Create a Job
  enter this command layer. UI handlers do not construct or repair links.
- Each intentional manual addition carries a stable operationId. Retrying
  returns the same line and Job; another intentional addition gets a new
  identity. Map synchronisation uses stable geometry lineage and updates
  existing work. Explicit Create a Job overrides the Rate Item flag.
- A Costing Line belongs to one Project and owner and may have no Job.
  Command-created Jobs reciprocally identify exactly one source Costing
  Line in that same Project and owner, with matching source identity.
  Commands validate those relationships before committing.
- Creation, deletion and linking persist atomically. A persistence failure
  stores no partial line/Job changes. Identity and links survive reopening.
- New Jobs are unscheduled Drafts with no scheduling dates. Confirmation
  schedules the same Job; finalised here means scheduling confirmed.
- Job-only deletion retains the source line and records
  jobCreationSuspended. Ordinary synchronisation cannot recreate it.
  Its calendar action deliberately recreates one Draft Job; retries reuse
  that Job. Deleting Job and line retains source geometry and records
  deliberate removal, so ordinary updates cannot recreate work. Explicit
  creation may establish a fresh lineage.
- Planner Jobs keep canonical Task ownership. Calculator commands cannot
  appropriate them. Existing historical aggregate/assigned relationships
  are not converted. Issued Quotes, payments and protected financial
  records retain their deletion and immutability protections.
- Calculator shows all selected-Project Costing Lines, including Map and
  Planner work, independently of selected Job. Costing-only and linked
  lines both contribute to totals and Quotes. Optional Job links do not
  weaken Project/owner validation or financial evidence requirements.

## Persistent UI projections — PC-014 / PC-018 / PC-024 amendment

- The Rate Item settings Scheduler checkbox edits schedulerEnabled. The
  compact Rate Library calendar appears only when its effective flag is
  enabled. It is informational, with hover and keyboard-focus help explaining
  that future additions create draft jobs; clicking it never changes data. Icon rails use Register Action dimensions and established
  module SVGs. Source icons distinguish Calculator, Map and Planner.
- Calculator Job calendar immediately precedes Delete, separated by a
  subtle vertical divider. Draft uses Planner calendar-without-tick;
  confirmed scheduling uses calendar-with-tick. Either opens the exact
  Job's Scheduler sidebar and brings its schedule into view. Suspended
  lines offer deliberate recreation; unflagged costing-only lines have
  no Job calendar. Job deletion offers an unchecked Also delete its
  Resource Calculator item option (items for multiple links). Keeping items
  suspends automatic recreation; deleting them records deliberate removal.
  The Unit selector is 88px wide and the action column reserves 88px for two
  28px buttons, their divider, spacing and focus clearance. Narrow tables
  scroll horizontally without wrapping or clipping the action rail.
- Escape closes only the topmost native or shared modal, restores opener
  focus, and preserves Register drawer, active module, selection and
  background scroll. Lower modal and drawer Escape handlers must not
  consume the same event.
- Selected Financial Year's Budget form is always visible: Amount /
  Effective date, Recording officer / Named approver, Reason / Evidence.
  Fields are editable before approval and read-only after approval, using
  recorded approval data. Amendments retain their governed workflow.
- One permanently visible action row directly follows the form: Approve
  budget, Allocate, Reconcile year, Adjust budget, Transfer allocation,
  Close year, Record reopen decision, Apply reopen. Unavailable actions
  are disabled, never hidden; narrow widths allow horizontal overflow.
  Dashboard cards, allocation/request controls, internal scrolling and
  shared drawer hard floor remain intact.
- Release evidence covers both owners; defaults and overrides; command
  retries and distinct additions; geometry synchronisation and explicit
  promotion; scheduling; deletion/recreation; persistence failure and
  round trips; malformed/cross-Project links; costing-only totals and
  Quotes; exact sidebar navigation; icons; modal Escape isolation; and
  Budget form/action states. Screenshot tests are not required.


## Quote funding arrangements and customer agreement — 2026-10-01

NSA and EVT Quotes explicitly select City of Adelaide, Customer, or City of Adelaide and customer. New Quotes default to Customer; existing editable legacy Drafts and legacy revisions require an explicit selection before Issue. Selection never creates or changes a Budget allocation.

The immutable commercial snapshot includes fundingMode (city/customer/mixed), the explicitly proposed mixed customer contribution (ex GST), and the applicable City funding and delivery-cost basis captured at Issue. Estimated work totals remain independent from customer payable amounts. ProgramQuotes.customerAmounts is the canonical customer calculation for Quote UI, funding position, payment balances, reports, preview and PDF. Legacy issued documents retain their original calculations and history.

City mode has zero customer contribution, GST, payable and outstanding balance; no customer payments or deposits are allowed. Customer mode charges the calculated Quote total and excludes all available City allocation from coverage. Mixed mode charges the explicitly proposed contribution plus existing 10% GST. Its initial suggestion is the work subtotal after discount and contingency minus City allocation, floored at zero. Subsequent costs, allowances and allocations never silently change the proposal; Use suggested amount is an explicit action. Show genuine surpluses.

Drafts may be underfunded. Issue requires the applicable City allocation plus proposed customer contribution to cover Calculator delivery cost ex GST, including costing-only Labour independently of Jobs or Scheduler use. Customer acceptance is not an Issue prerequisite. Draft customer funding is Proposed; Issued is Awaiting acceptance; Accepted is Accepted. Declined and superseded Quotes do not count as confirmed customer funding. Payments reduce the customer balance without changing agreement or proposed coverage.

Issued commercial changes require revision. Drafts with active payments or allocations require reversal through existing commands before funding arrangement, contribution or Council PDF disclosure changes. Customer and mixed-funding Preview/PDF documents distinguish the customer contribution, customer GST and customer payable; mixed documents do not expose internal work-cost line prices. Mixed Quotes may suppress all Council disclosure in the customer document; this is automatic when the applicable Council allocation is zero and otherwise is an immutable per-Quote choice. City-funded documents are internal Works Estimates: they show site context, scope and internal cost estimate totals, but omit customer identity, quotation, agreement and payment language. Third-party grants and in-kind funding are outside this model.
