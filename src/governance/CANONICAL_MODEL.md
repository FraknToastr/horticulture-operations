# Canonical Model — v1.5-draft

## Canonical business graph
```mermaid
flowchart TD
 R["Register Matter"] -->|"0..1 active"| P["Delivery Project"]
 P --> T["Tasks"]
 P --> G["Work Geometry"]
 P --> J["Jobs"]
 P --> Q["Quotes"]
 T -->|"Operational classification: Draft Job"| J
 G -->|"explicit promotion"| J
 J --> C["Costing Lines"]
 Q --> QL["Quote Lines"]
 Q --> PAY["Payments"]
 PAY --> PA["Payment Allocations"]
```

## Quote Readiness evidence graph
```mermaid
flowchart LR
 P["Project"] --> DQ["Draft Quote"]
 P --> S["Scope evidence"]
 P --> C["Cost-basis evidence"]
 P --> F["Funding evidence"]
 S --> R{"Quote Readiness"}
 C --> R
 F --> R
 R -->|"FAIL"| DQ
 R -->|"PASS"| I["Issue Quote"]
 I --> IQ["Immutable Issued Snapshot"]
 SC["Governed Costing"] --> C
 FR["Approved Fixed Rate"] --> C
 EE["External Estimate + Reference"] --> C
 ME["Authorised Manual Estimate + Reason"] --> C
```

Workflow gates are satisfied by canonical business evidence, never by module visitation or completion. Quote Readiness therefore does not mandate Planner → Space Map → Calculator → Quote Builder. The minimum evidence classes are Scope, Cost basis and Funding, with legitimate evidence permitted through multiple governed pathways.


## Annual authority and delivery lineage

```mermaid
flowchart TD
 FY["Financial Year · 1 Jul–30 Jun"] --> BA["Annual Budget · one per NSA/EVT owner"]
 BA --> BJ["Signed budget adjustments · approved, append-only"]
 BA --> AL["Register Allocation · owner + FY + Register"]
 AL --> AJ["Signed allocation adjustments · approved, append-only"]
 R["Register Matter"] --> AL
 R --> P["Delivery Project"]
 AL -. "optional same-Register link" .-> P
 R --> CF["Carry-forward Yes/No → review"]
 AL --> V["Verify prior-year unspent"]
 V --> PR["Next-year proposal · no authority yet"]
 CF --> PR
 PR -->|"recorded approval and adjustment"| NY["Next-year Annual Budget + Allocation"]
 P --> T["Planner Task · Inert or Operational"]
 T -->|"Operational: create/resolve"| DJ["Planner Draft Job"]
 P --> CJ["Calculator-origin Job"]
 P --> G["Work Geometry"]
 G -->|"explicit promotion"| SJ["Space Map-origin Job"]
 DJ -->|"explicit schedule"| SCH["Scheduler state on same Job"]
 DJ -->|"explicit cost"| C["Costing Line snapshot"]
 CJ --> C
 SJ --> C
 C -->|"deliberate inclusion"| QL["Draft Quote Line"]
```

Canonical keys: `financialYearId` identifies an exact July–June period; `(owner, financialYearId)` is unique for Annual Budget. Allocation references its Annual Budget, Register ID and owner, with an optional Project ID that must resolve to that Register. Multiple allocations for one Register in different years remain separate. Approved totals are derived from original approved amounts plus approved signed entries in cents. Draft/rejected entries have no effect. Transfer entries are linked debit/credit peers committed atomically.

Financial states remain distinct: approved annual authority; allocated authority; unallocated capacity; committed amount; actual expenditure; forecast; verified unspent. Actual expenditure retires or reconciles the corresponding commitment so reports do not double count. Availability must be calculated from approved authority and protected obligations. A Register carry-forward answer starts review and never changes authority by itself. A closed year cannot accept financial changes before a recorded reopen.

Job origin is exactly one of `planner` (source Task ID), `calculator` (source Calculator work identity), or `space-map` (source Work Geometry ID). Each Job retains its owner, Project and originating Register lineage. A Planner Draft Job is schedulable and costable later, but its existence alone is neither a schedule nor a Costing Line. Legacy `manual` or ambiguous source values remain review candidates; they are not silently relabeled. Quote inclusion follows Costing and preserves source Job/Costing IDs through Draft and immutable Issue snapshots.

## UI projection and Scheduler interaction graph

```mermaid
flowchart TD
    AR["Active Register"] --> AP["Active Project"]

    AR --> LR["Location module — Register view"]
    LR --> LC["Full-size Location Card<br/>always present, including empty state"]

    AP --> LP["Location module — Project view"]
    LP --> PS["Full-size Polygons Summary Card<br/>always present, including zero polygons"]
    PS --> PI["Polygon Inspector"]
    PI --> PIC["Full-size Polygon Inspector Cards"]

    JALL["All Jobs in owner app"] --> CAL["Scheduler Calendar"]
    JALL --> JT["Scheduler compact Job row-table"]

    AP --> AJ["Jobs owned by active Project"]
    AJ --> JT
    AJ --> CAL

    JT -->|"select active-project Job"| SE["Scheduler Editor"]

    CAL -->|"select active-project Job card"| SE
    CAL -->|"select other-project Job card"| MOD["Job Summary Modal"]

    AJ -->|"Draft or Scheduled"| DAY["Active-project calendar day colour state"]
```

### Projection rules

- Calendar visibility is broader than editability.
- The Scheduler Calendar may project all Jobs in the owning application.
- Scheduler Editor is ownership-scoped: it accepts only Jobs whose `projectId` resolves to the active Project under the active Register.
- A non-active-project Job remains inspectable through a summary modal without changing the active Register/Project context.
- Active-project calendar-day colouring is a projection of canonical Job ownership plus Draft/Scheduled status; it is not stored as independent calendar truth.
