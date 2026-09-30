# Horticulture Operations Suite

## Product Constitution

**Constitution version:** 1.5-draft\
**Derived from:** Horticulture Operations Suite v5.0.0 portable
codebase\
**Contract baseline:** PC-001 through PC-028 / workspace schema v5 (new contracts pending implementation)\
**Purpose:** Prevent product, data-model, workflow and AI-development
drift.

------------------------------------------------------------------------

## 1. Constitutional authority

This Constitution defines the product truths that must remain stable
across refactoring, UI redesign, optimisation, AI-assisted development
and future releases.

It is deliberately narrower than a specification. It does **not** freeze
every implementation detail, screen layout, label or code structure. It
protects the business graph, ownership boundaries, lifecycle rules,
commercial history, persistence guarantees and deliberate human decision
points that make the product what it is.

### 1.1 Authority order

When sources conflict, the intended authority order is:

1.  **Product Constitution**
2.  **Explicit Product Contracts**
3.  **Canonical data model and lifecycle registries**
4.  **Recorded product/architecture decisions**
5.  **Executable validation and regression tests**
6.  **Current source implementation**
7.  **Individual development prompt**

A development prompt does not silently amend a higher-order rule.

### 1.2 Amendment rule

A constitutional rule may change only when the change is explicit and
deliberate.

An AI agent or developer must not reinterpret, bypass, weaken,
generalise or remove a constitutional rule merely because another
implementation appears simpler.

If a requested change conflicts with this Constitution, implementation
must stop at that boundary and identify:

-   the constitutional rule affected;
-   the requested conflicting behaviour;
-   the business/data consequences;
-   the contracts and workflows affected; and
-   the amendment that would be required before implementation.

------------------------------------------------------------------------

# 2. Product identity

The Horticulture Operations Suite is a governed operational system for
progressing horticulture matters from an originating **Register matter**
through planning and delivery activity while preserving traceable
operational and commercial history.

The current suite contains two isolated business workspaces:

-   **Nature Strip Applications (NSA)**
-   **Event Space Remediation (EVT)**

They share product architecture and services, but their operational
records do not form one interchangeable workspace.

The product is not a collection of independent mini-app databases.
Register, Planner, Space Map, Calculator/Costing, Scheduler, Quote
Builder and status functions are different views or services operating
over a **canonical business graph**.

------------------------------------------------------------------------

# 3. The canonical business graph

The following ownership chain is constitutional:

``` text
REGISTER MATTER
Application (NSA) or Event (EVT)
        |
        | 0..1 active Delivery Project
        v
DELIVERY PROJECT
        |
        +-------------------+-------------------+------------------+
        |                   |                   |                  |
        v                   v                   v                  v
     Tasks            Work Geometry           Jobs              Quotes
        |                   |                   ^                  |
        | Operational       | explicit          |                  |
        | classification    | promotion         |                  |
        +------------------>|-------------------+                  |
                            |                                      |
                            v                                      v
                         Costing                               Quote Lines
                                                                   |
                                                                   v
                                                                Payments
                                                                   |
                                                                   v
                                                         Payment Allocations
```

Supporting audit/history objects include status events, status
recommendations and quote events.

This graph must not be replaced by module-specific editable copies of
the same business objects.

------------------------------------------------------------------------

# 4. Iron-clad product tenets

## T-001 --- The Register is the business root

Every delivery chain begins with exactly one originating **Nature Strip
Application** or **Event** Register matter.

No Project, Task, Job, Quote, Payment or operational delivery lineage
may become an unexplained root-level business record.

Every downstream delivery record must remain traceable to the Register
matter that caused the work to exist.

**Existing contract:** PC-001 --- REGISTER_ROOT.

------------------------------------------------------------------------

## T-002 --- NSA and Events are isolated operational workspaces

NSA records belong to the NSA workspace. Event records belong to the EVT
workspace.

Imports must respect the target application identity and workspace kind.
Operational records from the other owner are not silently admitted into
the active workspace.

Shared reference data may exist where explicitly designed, but
operational ownership must remain unambiguous.

**Consequence:** convenience is not sufficient justification for merging
NSA and EVT operational data into one mutable workspace.

**Existing enforcement:** `app-config.js`,
`ProgramData.assertImportIdentity`,
`ProgramData.assertWorkspaceIsolation`.

------------------------------------------------------------------------

## T-003 --- A Register matter has at most one active Delivery Project

A Delivery Project has exactly one existing Register parent: an
Application **or** an Event, never both and never neither.

The Project owner must match its Register parent.

A Register matter may have zero or one active Delivery Project. Multiple
simultaneous active Projects for one Register matter are invalid.

Historical Projects may exist only where their lifecycle explicitly
makes them non-active.

**Existing contract:** PC-002 --- PROJECT_PARENTAGE.

------------------------------------------------------------------------

## T-004 --- Canonical records are edited; shadow business records are forbidden

A business concept has one canonical editable representation.

Planner Tasks are canonical Project Task records. The Planner must not
maintain a second editable checklist database.

The Scheduler schedules canonical Jobs. It must not create or maintain a
separate Scheduler Job database.

Other modules must follow the same principle: a module may project,
filter, calculate or present canonical data, but must not create a
competing mutable copy of the same business truth.

**Existing contracts:** PC-003 and PC-006.

------------------------------------------------------------------------

## T-005 --- Register location and Project work geometry mean different things

A **Register Location** describes where the originating Application or
Event is located.

**Project Work Geometry** describes the spatial extent of work that may
be delivered.

Therefore:

-   Location pins belong to Applications or Events.
-   Work Geometry belongs to a Delivery Project.
-   Projects do not own Register Location pins.
-   Point/Location records are not stored as Project Work Geometry.
-   Project Work Geometry is polygon/line work geometry, not a
    substitute for the originating Register location.

**Existing contract:** PC-004 --- SPATIAL_OWNERSHIP.

------------------------------------------------------------------------

## T-006 --- Drawing work does not authorise work

Creating, importing or editing Project Work Geometry is a planning act.

It does **not** automatically create a Job or Costing Line.

Geometry enters the operational Job/Costing lineage only through an
explicit user promotion/create-work action.

Planning-only geometry with no Job and no Costing Line is valid.

Once promoted:

-   one Work Geometry has exactly one canonical Space Map Job;
-   it has exactly one mapped Costing Line;
-   Job, Costing Line and Geometry remain within the same Project and
    owner lineage;
-   the lineage may not exist in a half-created state; and
-   later geometry edits update the existing mapped lineage rather than
    creating duplicate Jobs.

The deliberate human promotion boundary must not be automated away for
convenience.

**Existing contract:** PC-005 --- GEOMETRY_JOB_PROMOTION.

------------------------------------------------------------------------

## T-007 --- Every Job belongs to a Project and retains its origin

Every Job belongs to exactly one existing Delivery Project of the same
owner.

Where a Job originates from Planner, Calculator or Space Map activity,
its source lineage must remain explainable through the canonical source
identity.

Planner and Space Map Jobs require exact source linkage.

The Scheduler operates on these canonical Jobs rather than manufacturing
unrelated scheduling copies.

**Existing contract:** PC-006 --- JOB_PARENTAGE.

------------------------------------------------------------------------

## T-008 --- Costing is a snapshot, not a live reinterpretation of history

A Costing Line belongs to a Job and the same Delivery Project.

The rate, description and costing basis used for an estimate are
preserved as an explainable snapshot.

A later Rate Catalog change must not silently rewrite an existing
costing result.

Recalculation or refresh must be an explicit operation where the product
permits it.

Mapped costing must retain its link to the Work Geometry that generated
it.

**Existing contract:** PC-007 --- COST_SNAPSHOT.

------------------------------------------------------------------------

## T-009A --- Workflow gates are satisfied by business evidence, not module visitation

A workflow gate exists to prove that a business condition is true. It must not be satisfied merely because an officer opened, visited or completed a particular application module.

Modules are interfaces over the canonical business graph, not workflow tokens. Planner, Space Map, Calculator/Costing, Scheduler and Quote Builder may contribute evidence, but visiting them is not itself evidence.

Where the product requires a gate, the gate must evaluate canonical business evidence that can be inspected, persisted and explained. Equivalent legitimate evidence pathways may satisfy the same gate without forcing an artificial linear sequence through modules.

For Quote issuance, this principle is expressed as **Quote Readiness**. A Draft Quote may be created as soon as an eligible Delivery Project exists, but it may cross the irreversible boundary to **Issued** only when the canonical record contains sufficient evidence of:

- **Scope** --- what Council is proposing to deliver or charge for;
- **Cost basis** --- how the commercial amount was established; and
- **Funding position** --- who is funding the work and how the commercial amount is composed.

The evidence may originate from governed Costing Lines, Work Geometry, Jobs, approved/fixed rates, an evidenced external estimate, or an explicitly authorised manual estimate/adjustment. No specific module is mandatory merely for its own sake.

Manual or exceptional commercial lines remain permissible only when their basis is explicitly classified and supported by the evidence required for that class.

Quote Readiness is **not** a Project lifecycle status and is **not** a Quote lifecycle status. It is a computed issuance gate over canonical evidence.

At Issue, the readiness result and the evidence basis that satisfied it must be snapshotted with the immutable commercial record so the system can later explain why issuance was permitted.

**Constitutional contract:** PC-013 --- QUOTE_READINESS. This is a v1.2 constitutional amendment. Its implementation status and release-blocking proof requirements are governed by `RELEASE_GATES.md`; the Constitution defines the invariant, while the release gate records whether the current product proves it.
  PC-014 SIDEBAR_SURFACE_CONTRACT Retired sidebar width/undock states are prohibited; sanctioned sidebar surfaces only. Critical
  PC-015 LOCATION_POLYGON_SIDEBAR Full-size Location/Polygon/Inspector surfaces remain present, including empty states. Critical
  PC-016 SCHEDULER_INTERACTION_SCOPE Global Job visibility does not permit cross-active-project Scheduler editing. Critical
  PC-017 SCHEDULER_ACTIVE_PROJECT_SIGNAL Active-project Draft/Scheduled Job days are visually signalled from canonical data. High

------------------------------------------------------------------------

## T-009 --- Draft commercial work is mutable; issued commercial history is not

A Draft Quote may be edited and refreshed from current costs.

Once a Quote is **Issued**, its commercial content becomes a stable
snapshot.

Issued and resolved Quotes must not be rewritten to make them resemble
current Jobs, current costs or later business circumstances.

Later commercial change occurs through a **new Quote revision**.

A replacement revision:

-   remains within the same Delivery Project;
-   preserves the audit root;
-   identifies its predecessor;
-   supersedes rather than overwrites the predecessor; and
-   preserves the earlier Quote as history.

Accepted, Declined and Superseded history is not editable current-state
data.

**Existing contract:** PC-008 --- QUOTE_REVISION.

------------------------------------------------------------------------

## T-010 --- Money must remain traceable to the exact commercial record

A Payment belongs to an exact Quote revision and the same Project
lineage.

Payment allocations may not cross Quote revision or Project boundaries.

A reversal does not delete the Payment. It records reversal evidence and
reverses associated active allocations.

Commercial history must remain reconstructable after correction.

**Existing contract:** PC-009 --- PAYMENT_TRACEABILITY.

------------------------------------------------------------------------

## T-011 --- Destructive actions may not destroy the business story

Deletion is dependency-aware.

A record with downstream operational or commercial meaning must not be
casually removed in a way that leaves orphaned or impossible history.

Specifically:

-   Register deletion must expose its dependency impact and require
    confirmation before removing the complete dependent chain.
-   Mapped work with protected Scheduler, Planner or Quote dependencies
    cannot be casually removed.
-   Jobs referenced by issued or resolved Quote history cannot be
    deleted.
-   Historical commercial evidence is preserved rather than silently
    repaired by deletion.

The product must prefer an explicit blocked action, lifecycle
transition, supersession or reversal over silent historical corruption.

**Existing contract:** PC-010 --- DEPENDENCY_PROTECTION.

------------------------------------------------------------------------

## T-012 --- Persistence must preserve the complete business graph

Save, export, import and recovery operate on the canonical workspace and
its relationships.

A workspace round-trip must preserve:

-   canonical IDs;
-   owner boundaries;
-   Register → Project relationships;
-   Task/Job source lineage;
-   Geometry/Job/Costing lineage;
-   Quote revision lineage;
-   Payment lineage;
-   lifecycle/audit evidence; and
-   other canonical relationships required to reconstruct the same
    business story.

Import is staged and validated before commit.

If the workspace changes after staging, the stale staged import must not
simply be applied.

Ambiguous migration data must be retained for review/quarantine rather
than having missing relationships invented.

**Existing contract:** PC-011 --- WORKSPACE_RECOVERY.

------------------------------------------------------------------------

## T-013 --- Persistence failure must not legitimise corrupt state

A canonical business mutation is revision-aware.

Durable writes are read back and verified.

A failed or unverified commit must not become the new accepted canonical
state merely because it was the latest attempted write.

Where supported, recovery returns to a last verified durable revision.

Concurrent/stale revision conflicts are errors to resolve, not
permission to overwrite a newer canonical state.

------------------------------------------------------------------------

## T-014 --- Lifecycle vocabularies belong to their business domains

There is no universal application-wide status vocabulary.

Register matters, Projects, Tasks, Jobs and Quotes represent different
business concepts and retain their own governed lifecycle.

Current state and milestone/audit history must not contradict one
another.

Unknown imported status values become **Review required** rather than
being guessed into a convenient state.

Cross-object automation may establish a status only from a concrete
business fact. It must not infer business judgement.

**Existing contract:** PC-012 --- DOMAIN_LIFECYCLES.

------------------------------------------------------------------------

## T-015 --- Annual budgets belong to one owner and one July–June financial year

Each financial year runs from 1 July through 30 June and has a stable identity and governed state. NSA and EVT each have at most one canonical Annual Budget for a financial year. An Annual Budget belongs to exactly one owner and one year; it is not a sum or alias of Project funding fields.

Approved annual authority, Register allocations, commitments, actual expenditure, forecasts and remaining capacity are distinct values. Planned Costing and Quote amounts do not themselves approve a budget, commit funds or establish actual spend. Reconciliation must avoid counting the same expenditure as both commitment and actual.

**Contracts:** PC-021 and PC-022.

## T-016 --- Register allocations preserve year and owner lineage

Each Budget Allocation links an Annual Budget to one Register matter of the same owner and financial year. Its Project link, when present, must resolve to that Register and owner. The same Register may receive allocations in multiple years, each retained separately; an allocation may not be silently moved between years or owners. Approved allocations and every signed change must remain reconstructable from immutable records.

No approval, adjustment or transfer may make the net allocation total exceed the net approved Annual Budget. Decreases and transfers must also respect protected commitments and actual expenditure. An attempted over-allocation is blocked as a whole, with the shortfall explained; an exception requires new recorded budget authority before allocation.

**Contract:** PC-023.

## T-017 --- Financial authority changes are recorded, signed and attributable

An approved Annual Budget or allocation is never silently overwritten. Each adjustment is an append-only, signed amount with type, reason, effective year, source and target where applicable, predecessor or version, creation time, named recording officer, named approver, approval decision and approval time. A transfer is one atomic linked debit and credit, never an unpaired edit. Corrections use compensating entries that preserve original history.

Names and approval records document a human decision; they do not claim authenticated identity or enforce external delegation. Approval must be explicitly recorded before an adjustment changes approved authority. A draft or rejected adjustment has no financial effect.

**Contract:** PC-024.

## T-018 --- Closed years are frozen; carry-forward is a review decision

Closing a year freezes its approved budget, allocations, adjustments and financial attribution. Any later correction first requires a separately recorded reopen decision with year, reason, named recorder and approver, decision time and audit link; reopening does not erase the original close or authorise silent historical edits. Reclose is recorded.

The Register's carry-forward Yes/No answer opens a review for that Register and year. Yes is a request to consider carry-forward; No records the decision path. Neither answer moves money. Only verified prior-year unspent capacity may be proposed for the next year, with the source allocation, reconciliation evidence and proposed amount. The proposal needs a recorded decision and an approved new-year budget/allocation adjustment before it has effect. It must never mutate the closed prior year by implication.

**Contract:** PC-025.

## T-019 --- Planner Draft Jobs precede scheduling and costing

An Operational Planner Task creates or resolves exactly one canonical Planner-origin Job in Draft, preserving Task, Project, Register and owner lineage. Draft creation is a preparation step. Scheduling and costing are later, distinct, explicit actions over that same Job; neither is implied by Task classification, Draft Job creation or viewing a module. Costing requires a selected, evidenced basis and creates a snapshot under PC-007. Quote inclusion requires an eligible Costing lineage and a deliberate commercial decision; Issue remains subject to PC-013. Inert Tasks create no Job.

Each Job has exactly one explainable origin: Planner Task, Calculator work, or Space Map geometry. Its origin identity is immutable. A Job must not acquire a second origin to make a workflow convenient. Scheduler state is a projection of that same canonical Job. Existing historical records with unknown or legacy origin require review, not invented source links.

**Contracts:** PC-020 and PC-026 through PC-028.

------------------------------------------------------------------------

# 5. Governed lifecycle model

The current schema-v5 lifecycle vocabularies are authoritative unless
deliberately amended.

## 5.1 Nature Strip Application Register

``` text
Received
  -> Quoted
  -> Scheduled
  -> In Progress
  -> Complete

Alternative terminal path: Cancelled
Exceptional imported state: Review required
```

`Quoted` is not a free human status choice. It is established from the
concrete fact that the current linked Quote has been issued.

## 5.2 Event Register

``` text
Received
  -> Report Completed and Sent
  -> Quoted
  -> Planning
  -> Scheduled
  -> Completed

Alternative terminal path: Cancelled
Exceptional imported state: Review required
```

As with NSA, `Quoted` is tied to an eligible issued current Quote rather
than arbitrary manual declaration.

## 5.3 Delivery Project

``` text
Draft
  -> Planning
  -> In Delivery
  -> Complete
```

Additional governed states:

-   On Hold
-   Cancelled
-   Review required

## 5.4 Task

``` text
Not Started
  -> In Progress
  -> Complete
```

Additional governed states:

-   On Hold
-   N/A
-   Review required

## 5.5 Job

``` text
Draft
  -> Scheduled
  -> In Progress
  -> Completed
```

Additional governed states:

-   Cancelled
-   Review required

## 5.6 Quote

``` text
Draft -> Issued -> Accepted
                 -> Declined
```

A later revision may supersede an Issued/Accepted/Declined predecessor
when the replacement is issued.

`Superseded` is historical and terminal.

## 5.7 Status governance

Backward lifecycle movement, cancellation, hold states and movement away
from terminal states require explicit governance/reasoning as defined by
the status engine.

`Review required` is reserved for unresolved/unrecognised imported state
and is not a normal officer-selected lifecycle stage.

Status history must be recorded through the canonical status/audit
mechanism rather than by independently rewriting labels in individual
modules.

------------------------------------------------------------------------

# 6. Constitutional business workflows

## WF-001 --- Matter intake to Delivery Project

``` text
Application/Event received
        |
        v
Register matter created/imported
        |
        v
Register remains canonical business root
        |
        v
Officer determines delivery work is required
        |
        v
Delivery Project created
        |
        v
Project linked to exactly one Register parent
```

A Project cannot legitimately precede or lose its originating Register
matter.

------------------------------------------------------------------------

## WF-002 --- Planner workflow

``` text
Delivery Project
      |
      v
Canonical Project Tasks
      |
      +--> assign / due date / notes / governed task state
      |
      v
Classify as Operational
      |
      v
One canonical Draft Planner Job
      |
      v
Explicit scheduling and separate explicit costing on that Job
```

Planner does not maintain an independent editable checklist truth.

Repeated scheduling of the same Task must resolve to its existing
canonical Planner Job rather than create duplicates.

------------------------------------------------------------------------

## WF-003 --- Spatial planning to operational work

``` text
Delivery Project
      |
      v
Draw/import Work Geometry
      |
      v
Planning-only geometry
      |
      | explicit user promotion
      v
Canonical Space Map Job
      |
      v
Mapped Costing Line
      |
      v
Subsequent geometry edits update lineage
```

The transition from planning geometry to operational Job is a deliberate
business action.

------------------------------------------------------------------------

## WF-004 --- Calculator/Costing to Job

Manual/Calculator costing operates within a selected Delivery Project.

Jobs created for costing remain canonical Project-owned Jobs.

Costing Lines remain subordinate to the relevant Job and Project and
preserve the costing basis used at the time.

The Calculator/Costing module does not become a second independent Job
register.

------------------------------------------------------------------------

## WF-005 --- Job scheduling

``` text
Canonical Job
     |
     v
Scheduler
     |
     +--> date/time
     +--> crew
     +--> location
     +--> scheduling attributes
     |
     v
Same canonical Job
```

Scheduling changes scheduling properties on the canonical Job.

Source identity and Project ownership are not rewritten by scheduling.

Conflict detection may identify crew/location clashes, but it does not
create an alternative Job truth.

------------------------------------------------------------------------

## WF-006 --- Quote creation, readiness and issue

``` mermaid
flowchart TD
    P[Delivery Project] --> D[Draft Quote]
    D --> S[Scope Evidence]
    D --> C[Cost Basis Evidence]
    D --> F[Funding Evidence]

    S --> R{Quote Readiness}
    C --> R
    F --> R

    R -->|Not sufficient| B[Remain Draft / Resolve Evidence]
    B --> D
    R -->|Sufficient| I[ISSUE]
    I --> X[Immutable Quote + Readiness Evidence Snapshot]
    X --> A[Accepted]
    X --> E[Declined]
```

A Draft Quote may be created immediately after an eligible Delivery Project exists. Detailed Planner Tasks, Work Geometry, Jobs or Costing Lines are **not individually mandatory prerequisites** to creating the Draft.

Issuance is different. The transition from Draft to Issued is governed by **Quote Readiness**. The system must evaluate canonical business evidence rather than whether particular modules have been visited or completed.

The minimum constitutional readiness dimensions are:

1. **Scope evidence** --- the Quote can explain what is being proposed, delivered or charged for.
2. **Cost-basis evidence** --- the Quote can explain how each material commercial amount was established.
3. **Funding evidence** --- the Quote can explain the customer contribution, Council contribution/operational amount, other funding, and resulting funding position where applicable.

Legitimate evidence pathways may include:

``` mermaid
flowchart LR
    P[Project] --> Q[Draft Quote]
    J[Jobs / Governed Costing] --> E[Canonical Evidence]
    G[Work Geometry / Quantities] --> E
    R[Approved or Fixed Rates] --> E
    X[External Estimate + Reference] --> E
    M[Authorised Manual Basis + Reason] --> E
    E --> QR{Quote Ready?}
    Q --> QR
    QR -->|Yes| I[Issue]
    QR -->|No| D[Remain Draft]
```

This is deliberately **not** a mandatory `Planner -> Space Map -> Calculator -> Quote Builder` sequence. The product governs the sufficiency and provenance of evidence, not the screens an officer happened to use.

Custom/manual Quote Lines are permitted, but their basis must be classified and evidenced. A bare amount with no recognised cost basis cannot by itself satisfy Quote Readiness.

At Issue, the immutable Quote snapshot must also preserve the readiness outcome and sufficient evidence references/snapshots to reconstruct why the Quote was allowed to be issued at that time. Later changes to Jobs, geometry, rates or costs do not rewrite that historical issuance basis; material commercial change proceeds through Quote revision.

------------------------------------------------------------------------

## WF-007 --- Quote revision

``` text
Issued / Accepted / Declined Quote
              |
              | explicit Create Revision
              v
          New Draft revision
              |
              | edit / refresh
              v
             Issue
              |
              v
Previous revision -> Superseded
New revision      -> Issued
```

Revision is additive history, not mutation of historical commercial
truth.

Only the appropriate latest non-superseded lineage may continue forward.

------------------------------------------------------------------------

## WF-008 --- Payment and reversal

``` text
Payable Quote revision
        |
        v
Record Payment
        |
        +--> exact Quote revision
        +--> exact Project
        +--> payment reference
        |
        v
Optional line allocations
        |
        v
Payment history

Correction:
Payment -> Reversed + reason
Allocations -> Reversed
Historical record remains
```

Payments cannot be moved across commercial lineages merely to reconcile
totals.

------------------------------------------------------------------------

## WF-009 --- Import

``` text
Select import
     |
     v
Identify target / workspace identity
     |
     v
Parse and build candidate
     |
     v
Normalize + validate
     |
     v
Preview warnings/conflicts
     |
     v
Stage against current workspace revision
     |
     | explicit Apply
     v
Re-check base workspace has not changed
     |
     v
Revision-aware durable commit
     |
     v
Read-back verification
```

An import is not a direct uncontrolled write into live canonical state.

------------------------------------------------------------------------

## WF-010 --- Destructive change

``` text
Delete/remove request
        |
        v
Determine dependency impact
        |
        +--> protected dependency? -> BLOCK / require appropriate lifecycle action
        |
        +--> removable chain? -> expose impact + explicit confirmation
                                      |
                                      v
                               controlled deletion
```

Deletion must never be used as an invisible repair mechanism for
inconsistent business history.

------------------------------------------------------------------------

# 7. Explicit product contracts

PC-018 and PC-019 now require one full-height, 4px hard-floor and scroll-ownership rule for native Register and every mounted module. An open row sits directly beneath the sticky Register column headings; its outer table cannot scroll until all rows close, while internal sections may scroll. Register-specific intrinsic-height or module-specific floor exceptions are prohibited. Budget remains a full-page workspace with the same hard-floor treatment. ADR-016 supersedes ADR-012.

The constitutional register declares PC-001 through PC-028. PC-014 through PC-019 formalise the UI interaction architecture; PC-020 governs Planner Task management; PC-021 through PC-028 govern annual finance and delivery lineage. They are incorporated into this Constitution by reference. The historical excerpt below lists PC-001 through PC-012; `PRODUCT_CONTRACTS.md` is the complete contract register.

  ------------------------------------------------------------------------
  Contract                 Constitutional meaning  Criticality
  ------------------------ ----------------------- -----------------------
  PC-001 REGISTER_ROOT     Register is the origin  Critical
                           of every delivery chain 

  PC-002 PROJECT_PARENTAGE One parent and at most  Critical
                           one active Project per  
                           Register matter         

  PC-003                   Planner Tasks are       Critical
  PLANNER_TASK_CANON       canonical Project       
                           records                 

  PC-004 SPATIAL_OWNERSHIP Register Locations and  High
                           Project Work Geometry   
                           are distinct            

  PC-005                   Geometry becomes        Critical
  GEOMETRY_JOB_PROMOTION   operational work only   
                           by explicit promotion   

  PC-006 JOB_PARENTAGE     Jobs are Project-owned  Critical
                           and source-traceable    

  PC-007 COST_SNAPSHOT     Costing preserves its   High
                           historical rate/basis   

  PC-008 QUOTE_REVISION    Issued commercial       Critical
                           history is immutable    
                           and revisioned          

  PC-009                   Payments remain tied to Critical
  PAYMENT_TRACEABILITY     exact Quote             
                           revision/Project        

  PC-010                   Destructive actions     Critical
  DEPENDENCY_PROTECTION    cannot invalidate       
                           history                 

  PC-011                   Workspace persistence   Critical
  WORKSPACE_RECOVERY       preserves the complete  
                           graph                   

  PC-012 DOMAIN_LIFECYCLES Business domains own    Critical
                           separate governed       
                           lifecycles              
  ------------------------------------------------------------------------

A future implementation must not satisfy the wording of one contract by
violating another.

------------------------------------------------------------------------

# 8. Human decision boundaries

The following boundaries are intentionally human-controlled and must not
be silently converted into AI or automatic actions:

1.  Promotion of planning-only Work Geometry into operational
    Job/Costing lineage.
2.  Issuing a Draft Quote after the Quote Readiness gate has been satisfied.
3.  Creating a commercial Quote revision after issue/resolution.
4.  Acceptance/decline actions where an officer records the business
    outcome.
5.  Payment recording and payment reversal.
6.  Confirmation of destructive Register/dependency deletion.
7.  Resolution of ambiguous migrated/imported data.
8.  Status actions requiring an operator, reason or explicit business
    judgement.
9.  Application of a staged import.

Automation may assist, validate, recommend or establish a state from a
concrete fact where explicitly contracted. It must not manufacture the
underlying business decision.

------------------------------------------------------------------------

# 9. Audit and explainability

The system must be capable of answering, from canonical data:

-   What Register matter caused this Project to exist?
-   Which Project owns this Task, Geometry, Job, Quote or Payment?
-   Where did this Job originate?
-   Which geometry produced this mapped Job/Costing Line?
-   Which costing basis was used for an estimate?
-   What exact commercial content was issued?
-   Which Quote revision replaced which?
-   Which Quote revision received a Payment?
-   Was a Payment reversed, when, and why?
-   What lifecycle changes occurred?
-   Which imported value could not safely be interpreted?
-   What downstream records would a destructive action affect?

A refactor that makes these questions harder or impossible is a
regression even if the UI still appears functional.

------------------------------------------------------------------------

# 10. Data integrity rules

The following are invalid product states:

-   a Project with no Register parent;
-   a Project with both an Application and Event parent;
-   multiple active Projects for one Register matter;
-   owner mismatch across a parent/child lineage;
-   a canonical Task outside a Project;
-   Planner shadow checklist state acting as business truth;
-   multiple Planner Jobs for one source Task;
-   a Project-owned Register Location pin;
-   Point geometry represented as Project Work Geometry;
-   operationally promoted geometry with missing or duplicate
    Job/Costing lineage;
-   a Job without an existing Project;
-   unexplained loss of source lineage;
-   a Costing Line detached from its Job/Project;
-   silent re-rating of historical costing;
-   mutation of issued/resolved commercial content;
-   an Issued Quote with no preserved Quote Readiness outcome/evidence basis;
-   a workflow gate satisfied only by module visitation/completion rather than canonical business evidence;
-   broken Quote revision/supersession lineage;
-   a Payment crossing Quote/Project boundaries;
-   deletion that leaves impossible downstream history;
-   silent guessing of ambiguous migration relationships;
-   cross-workspace operational leakage between NSA and EVT;
-   current lifecycle state contradicting canonical lifecycle history.

These states should be rejected, quarantined for review, or explicitly
repaired through governed migration---not normalised into apparently
valid data by guessing.

------------------------------------------------------------------------

# 11. AI development guardrails

Any AI agent modifying this codebase must treat this Constitution as a
constraint, not background documentation.

## 11.1 Before implementation

For any non-trivial change, the agent must report:

``` text
CHANGE IMPACT

Requested change:
Affected modules:
Affected canonical entities:
Affected workflows:
Affected Product Contracts:
Affected lifecycle domains:
Persistence/schema impact:
Commercial-history impact:
Quote-readiness/evidence-gate impact:
Deletion/dependency impact:
Workspace-isolation impact:

Constitutional conflict:
NONE / DETAILS

Implementation may proceed:
YES / REQUIRES PRODUCT DECISION
```

## 11.2 During implementation

The agent must:

-   prefer surgical changes over unrelated redesign;
-   reuse canonical records and services rather than introduce shadow
    state;
-   preserve IDs and lineage unless an approved migration explicitly
    changes them;
-   not bypass validation to make a feature appear to work;
-   not weaken a contract because existing data violates it;
-   not infer missing business relationships during migration;
-   not convert deliberate user actions into automatic actions without
    approval;
-   not change unrelated lifecycle vocabularies;
-   not rewrite historical commercial records;
-   not use deletion to hide integrity problems.

## 11.3 After implementation

The agent must report:

``` text
CONSTITUTIONAL VERIFICATION

Requested change:
Files changed:

Contracts affected:
Contracts verified:

Canonical graph changed:
YES / NO

Lifecycle changed:
YES / NO

Persistence/schema changed:
YES / NO

Human decision boundary changed:
YES / NO

Commercial history semantics changed:
YES / NO

Workspace isolation changed:
YES / NO

Unrequested behavioural changes:
NONE / DETAILS

Known constitutional regressions:
NONE / DETAILS

Tests/validation performed:
```

An answer of `YES` to a protected change is not automatically a defect,
but it requires evidence that the change was explicitly authorised.

------------------------------------------------------------------------

# 12. What is NOT constitutional

To prevent the Constitution itself from causing development stagnation,
the following are **not automatically constitutional** unless separately
recorded as an explicit product decision:

-   exact colours;
-   exact typography;
-   pixel dimensions;
-   precise panel arrangements;
-   CSS implementation strategy;
-   DOM structure;
-   filenames;
-   function names;
-   internal module boundaries;
-   particular rendering libraries;
-   exact wording of ordinary UI labels;
-   temporary performance implementation choices.

These may change freely provided the protected business model,
workflows, contracts and user decision boundaries remain intact.

Important UX decisions may be governed separately in `UX_RULES.md`.

------------------------------------------------------------------------

# 13. Current release/platform constraints

These are strong constraints of the reviewed v5.0.0 package, but are
intentionally classified below constitutional business invariants so
they can evolve deliberately without redefining the business model.

### RC-001 --- Local web runtime

The portable v5 package is designed to run through its local Node static
server rather than direct `file://` execution.

### RC-002 --- No runtime npm dependency installation

The reviewed package declares no runtime npm dependency installation
requirement; required browser assets are packaged with the application.

### RC-003 --- Browser-local persistence

NSA and Events persist their operational workspaces locally in browser
IndexedDB using separate configured storage databases.

### RC-004 --- Empty operational baseline

The reviewed package is designed to begin with an empty operational
workspace and built-in Rate Catalog rather than shipping live
operational records.

These constraints should be changed explicitly, especially if the
product later moves toward a hosted, multi-user, PWA or server-backed
architecture.

------------------------------------------------------------------------

# 14. Evidence map to the reviewed codebase

This Constitution was derived primarily from executable rules already
present in the v5.0.0 codebase rather than from aspirational product
wording.

  -----------------------------------------------------------------------------------
  Area                                Primary evidence
  ----------------------------------- -----------------------------------------------
  Declared contracts PC-001--PC-019   `src/program-planner/js/product-contracts.js`

  Canonical model / validation /      `src/program-planner/js/model.js`
  deletion                            

  Lifecycle vocabularies and          `src/program-planner/js/status.js`,
  transition governance               `status-model.js`

  Planner Task → Job lineage          `src/program-planner/js/planner-model.js`

  Scheduler canonical Job             `src/program-planner/js/scheduler-model.js`
  intake/scheduling                   

  Geometry → Job → Costing promotion  `src/program-planner/js/work-area-service.js`

  Costing/Job behaviour               `src/program-planner/js/costing-model.js`

  Quote snapshots/revisions/payments  `src/program-planner/js/quote-model.js`

  Import staging and workspace        `src/program-planner/js/data-workspace.js`
  isolation                           

  Migration non-guessing behaviour    `src/program-planner/js/migration.js`,
                                      `storage.js`

  Revision-aware durable              `src/program-planner/js/storage.js`,
  persistence/recovery                `src/shared/js/storage.js`

  NSA/EVT identity boundaries         `src/program-planner/app-config.js`

  Current portable runtime            `README_RUN.txt`, `package.json`
  -----------------------------------------------------------------------------------

------------------------------------------------------------------------

# 15. Constitutional acceptance test

A future version remains recognisably the same governed product only if
all of the following remain true:

-   The Register is still the origin of delivery.
-   Project parentage remains singular and traceable.
-   NSA and EVT ownership remains unambiguous.
-   Modules operate on canonical business records rather than shadow
    copies.
-   Location and Work Geometry retain their different meanings.
-   Planning geometry does not silently become operational work.
-   Jobs remain Project-owned and source-traceable.
-   Costing remains explainable historical evidence.
-   Draft Quotes may be created without artificial module prerequisites.
-   Quote issuance is blocked until canonical scope, cost-basis and funding evidence satisfy Quote Readiness.
-   Workflow gates are satisfied by business evidence, never merely by module visitation/completion.
-   Issued Quotes preserve the readiness basis that authorised issuance.
-   Issued Quotes remain immutable commercial snapshots.
-   Quote changes occur through revision history.
-   Payments remain tied to exact Quote revisions.
-   Reversal preserves history.
-   Destructive actions remain dependency-aware.
-   Import/persistence preserves the business graph.
-   Ambiguous migration state is not guessed.
-   Domain lifecycles remain governed separately.
-   Human business decisions are not silently automated.
-   The system remains capable of explaining the lineage of its
    operational and commercial records.

If a proposed change breaks one of these statements, it is not merely a
refactor. It is a **product-model change** and requires an explicit
constitutional decision.

------------------------------------------------------------------------

# 15A. Non-negotiable UI interaction architecture

UI presentation may evolve, but several interaction structures are now product contracts rather than styling preferences.

## 15A.1 Retired sidebar system

The former sidebar framework that allowed sidebars to expand, collapse into super-narrow compact rails, undock or float is decommissioned. These states are not supported dormant features. Production source must not expose or retain an executable pathway capable of reactivating them.

**Constitutional contract:** PC-014 — SIDEBAR_SURFACE_CONTRACT.

## 15A.2 Location and Polygon surfaces

In Location module **Register view**, the sidebar always exposes a full-size Location Card, including when no Location has yet been recorded.

In Location module **Project view**, the sidebar always exposes a full-size Polygons Summary Card, including when no polygon exists. That summary card is the entry point to polygon editing in Polygon Inspector.

Polygon Inspector cards are full-size.

**Constitutional contract:** PC-015 — LOCATION_POLYGON_SIDEBAR.

## 15A.3 Scheduler visibility versus editability

The Scheduler may provide broad operational visibility: Jobs from any Register/Project in the owning application may appear on the calendar.

Editability is narrower. Scheduler Editor accepts only a Job belonging to the active Register/Project.

- selecting an active-project Job from the Scheduler Job row-table opens Scheduler Editor;
- selecting an active-project compact Job card on the calendar opens Scheduler Editor;
- selecting a calendar Job card belonging to another Register/Project opens a Job Summary modal instead and must not send that Job to Scheduler Editor.

This distinction must not be bypassed by silently changing active ownership context.

**Constitutional contract:** PC-016 — SCHEDULER_INTERACTION_SCOPE.

## 15A.4 Active-project calendar signal

Calendar days containing Draft or Scheduled Jobs belonging to the active Register/Project carry a distinct cell-level colour state. This signal is derived from canonical Job ownership and status and recomputes when the active context or canonical Job data changes.

**Constitutional contract:** PC-017 — SCHEDULER_ACTIVE_PROJECT_SIGNAL.

# 16. Governance document boundaries

The Constitution is the highest-order product authority, but it is not the correct place to record every implementation defect, release blocker or UI rule. Companion governance documents translate constitutional intent into maintainable development controls:

- **`PRODUCT_CONTRACTS.md`** — named constitutional contracts, invariants and proof obligations.
- **`CANONICAL_MODEL.md`** — authoritative ownership, cardinality, lineage and evidence model, including Mermaid diagrams.
- **`RELEASE_GATES.md`** — release-blocking implementation conditions and acceptance proofs.
- **`UX_RULES.md`** — deliberate user-experience rules.
- **`DECISIONS.md`** — accepted product/architecture decisions and rejected alternatives.
- **`AI_INSTRUCTIONS.md`** — mandatory AI-assisted change-control protocol.

A defect must not be promoted into the Constitution merely because it is severe. Conversely, an implementation cannot be declared release-ready merely because the Constitution is internally coherent. **Constitutional integrity and release readiness are separate gates and both must pass.**

## 16.1 Current critical implementation gap

The reviewed v5.0.0 baseline does not currently demonstrate an uninterrupted path from a newly created Project to governed quoteable cost evidence. `RELEASE_GATES.md` records the known release blockers:

- Quote Builder remains locked/inaccessible after Project creation.
- Cost Library items cannot currently be added to the Resource Calculator.
- Space Map `Create a Job` can fail because a configured work type such as `turfing` cannot resolve to an exact active Rate Item ID or approved mapping.

These are **not new constitutional tenets**. They are implementation failures preventing the constitutional workflow from being exercised and must be resolved before release.

## Appendix A --- Recommended repository placement

``` text
/governance
    PRODUCT_CONSTITUTION.md
    PRODUCT_CONTRACTS.md
    CANONICAL_MODEL.md
    UX_RULES.md
    DECISIONS.md
    RELEASE_GATES.md

AI_INSTRUCTIONS.md
```

`PRODUCT_CONSTITUTION.md` should remain concise enough that an AI coding
agent can be required to read it at the beginning of every substantial
development task.

The existing executable `product-contracts.js` should remain the
enforcement companion to this document rather than being replaced by
prose.
## T-020 --- Conservative, impact-scoped verification

Testing effort must be proportional to the change surface and risk. A change that is limited to one JavaScript module or a clearly bounded set of modules must begin with the smallest relevant unit or module tests, then add only the directly affected browser or cross-module checks. The complete repository test regime is not the default for a narrow change.

The change record must identify:

- the changed modules and protected contracts;
- the targeted tests run and their results;
- any cross-module or browser boundary exercised;
- why broader suites were not required, or the specific risk that justified them.

The complete test regime is required when a change is broad, cross-cutting, schema/storage/migration related, security-sensitive, release-gate related, or otherwise likely to affect unrelated contracts. A full run may also be requested by the release owner. A green targeted run never waives a required release gate, and conservative testing must not be used to avoid testing a known impacted boundary.

This rule is constitutional guidance for engineering verification, not permission to weaken product contracts or release evidence.
