# Product and Architecture Decisions — v1.4-draft

## ADR-001 — Register is the business root
**Accepted.**

## ADR-002 — Register Location and Project Work Geometry are distinct
**Accepted.**

## ADR-003 — Geometry promotion is explicit
**Accepted.**

## ADR-004 — Issued Quotes are immutable and revisioned
**Accepted.**

## ADR-005 — Quote Readiness is an evidence gate, not a module sequence
**Accepted — v1.2.** Draft Quote may exist after Project creation. Issue requires Scope, Cost-basis and Funding evidence.

**Rejected:** mandatory Planner → Space Map → Calculator → Quote Builder sequence.  
**Reason:** modules produce/work with evidence; visiting a module is not business evidence.

## ADR-006 — Critical implementation defects belong in Release Gates
**Accepted — v1.3.** Inaccessible Quote Builder, unusable Cost Library integration and failed Space Map rate mapping are release blockers, not constitutional tenets.

**Reason:** the Constitution defines product truth; `RELEASE_GATES.md` proves whether a particular implementation is releasable.


## ADR-007 — Legacy adaptive/undocked sidebar framework is decommissioned
**Accepted — v1.4.** The former wide/compact/undocked sidebar system is no longer a product capability. It is to be completely unwired and removed from production source pathways.

**Rejected:** retaining the old framework as hidden, dormant or future-toggle functionality.  
**Reason:** dormant interaction architecture creates drift risk, conflicting layout states, unnecessary persistence/state complexity and an attractive path for AI-assisted changes to accidentally resurrect retired behaviour.

## ADR-008 — Location and Polygon sidebar surfaces remain full-size
**Accepted — v1.4.** Location Register view always exposes a full-size Location Card, even in the empty state. Location Project view always exposes a full-size Polygons Summary Card, even with zero polygons; this is the polygon-editing entry point. Polygon Inspector uses full-size cards.

**Reason:** absence of data must not remove the user's entry point to create or manage that data.

## ADR-009 — Scheduler separates global visibility from active-project editability
**Accepted — v1.4.** The Scheduler calendar may show all Jobs in the owner app. Scheduler Editor remains scoped to the active Register/Project.

An active-project Job selected from the Job row-table or calendar opens Scheduler Editor. A Job belonging to another Register/Project, when selected on the calendar, opens a Job Summary modal and does not enter Scheduler Editor.

**Reason:** cross-project operational awareness is useful, but editing under the wrong active business context would violate ownership boundaries.

## ADR-010 — Active-project Job days are visually signalled
**Accepted — v1.4.** Calendar cells containing Draft or Scheduled Jobs for the active Register/Project receive a distinct colour state derived from canonical ownership and status.

**Reason:** the calendar must make the active delivery context legible without hiding other owner-app Jobs.


## ADR-011 — Accordion drawers own their vertical overflow
**Accepted — v1.4a.** Expanded accordion drawers are bounded by the usable viewport below their row header. Their thick bottom rule is always visible. Content exceeding the available internal content area scrolls inside the drawer.

**Rejected:** allowing drawer content to extend the drawer floor below the screen and relying on document/page scrolling to recover it.

**Reason:** the drawer floor is the user's persistent visual boundary for the expanded record. Losing it makes the drawer appear clipped or structurally unfinished and can place terminal controls off-screen.

## ADR-012 — Register drawers grow intrinsically before internal scrolling (superseded by ADR-016)
**Accepted — v1.4a.** Register drawers use content-driven height while content fits. As Notes or other content grow, the drawer may descend until its floor reaches the usable viewport bottom. At that point the outer drawer stops growing and excess content becomes internally scrollable.

**Reason:** short Register records should not create unnecessarily empty full-height drawers, while long records must remain fully usable without violating the always-visible floor contract.

**Superseded:** ADR-016 replaces the Register-specific intrinsic-height exception. This paragraph is historical, not an active UI rule.

## ADR-013 — Annual budget authority is owner/year scoped
**Accepted — 2026-09-28.** A July–June year has at most one Annual Budget for each of NSA and EVT. Register allocations retain their own year and owner, so one Register can receive allocations in successive years. Net allocations may not exceed net approved budget. Budget, allocations, commitments, actual spend and forecast remain separate. Legacy `project.funding.operationalAmount` and `approvedBudget` are migration inputs or compatibility projections only; neither is annual authority.

**Reason:** a Project contribution cannot establish citywide annual authority or explain multi-year Register funding. Migration must report ambiguity and require a reviewed mapping, never infer approval from a legacy value.

## ADR-014 — Adjustment, closure and carry-forward audit
**Accepted — 2026-09-28.** Approved authority changes use signed, append-only adjustments with named recorded decisions. A transfer is an atomic paired debit and credit. Names are recorded evidence, not an authentication claim. A closed year is frozen until an independently recorded reopen decision. Register carry-forward Yes/No starts a review; only verified prior-year unspent can be proposed into the next year, and it has no effect before approval and a new-year adjustment.

**Reason:** financial history must be reconstructable across correction and year end without retroactive silent edits.

## ADR-015 — Planner Draft Job precedes scheduling and costing
**Accepted — 2026-09-28; amends PC-020 sections 5–8, 17, 22 and acceptance criteria where they imply automatic costing or Quote inclusion.** Inert Task has no Job. Operational Task creation/promotion creates or resolves exactly one Planner-origin Draft Job. Scheduling and costing are separate explicit actions on that Job; costing snapshots an evidenced basis. Inclusion of an eligible Costing Line in a Draft Quote is deliberate. The three Job origins are Planner Task, Calculator work and Space Map geometry; source identity must be exact and immutable.

**Reason:** Draft delivery intent, scheduled commitment, priced work and customer-facing commercial inclusion are separate decisions. Existing records and issued Quote history remain protected; migration of mixed or unknown legacy origins requires review. Gate Q is the acceptance proof.

## ADR-016 — One Register-row viewport floor and scroll owner

**Accepted — 2026-09-30; supersedes ADR-012.** Native Register and every mounted module use the same full-height drawer, with a 4px floor 4px above the usable viewport bottom. Opening a row positions its header beneath the sticky column headings and locks the outer Register table; internal sections retain their own scrolling. Closing the last row restores the prior table position. Budget remains full-page with a hard floor. No Register-only height or scroll exceptions are permitted.

**Reason:** separate Register and module sizing/scroll paths repeatedly hid sibling rows and displaced the hard floor. A single scroll owner and geometry rule is observable and testable across modules.

## Amendment record for ADR-013 through ADR-015

**Old rule:** no annual budget/financial-year authority contract; PC-020 allowed Task classification to cause Costing and Quote projection, and WF-002 connected Task scheduling directly to Job creation. **New rule:** T-015 through T-019, PC-021 through PC-028, revised PC-020 and WF-002. **Compatibility/migration:** retain legacy Project funding as labeled historical data; stage diagnostic mapping to owner, year and Register; quarantine ambiguous or conflicting values. Existing Task/Job/Costing/Quote lineage is preserved, with no automatic historical rewrite. **Release proof:** Gates O–Q plus existing persistence, owner isolation, Costing and Quote gates. **Effective governance version/date:** v1.5-draft, 2026-09-28. **Approval authority:** these decisions record the agreed product rule; named approval of individual financial transactions is separately required by PC-024.
