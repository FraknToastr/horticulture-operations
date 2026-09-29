# PC-020 — PLANNER_TASK_MANAGEMENT

**Criticality:** Critical

## 2026-09-28 binding amendment — Draft Job boundary

PC-020 predates the agreed separation of Planner Draft Job creation, scheduling and costing. Wherever the older text below says that Operational classification or promotion automatically creates Costing or inherited Draft Quote Lines, read it as eligibility after a separate explicit costing action on the same Job, followed by deliberate inclusion in a Draft Quote. Automatic Draft Job creation remains required. No Job is scheduled, costed, or quoted merely by classifying a Task as Operational. This amendment governs any conflicting workflow examples or acceptance items below; PC-026 through PC-028 and ADR-015 record the controlling rule.

## Protected invariant

Planner is the authoritative task-management interface for canonical Delivery Project Tasks.

A Planner Task is a first-class, editable Project-owned business record. Users may create new Tasks and edit existing Tasks without creating a shadow Planner checklist or duplicate representation of the same Task.

Every Task has a governed **Task Classification** that determines whether it remains Planner-only or participates in downstream operational and commercial workflows.

The two canonical Task Classifications are:

- **Inert**
- **Operational**

Where an Operational Task produces Costing lineage that is inherited by a Draft Quote, each inherited Quote Line must also have a governed **Customer Treatment** describing how that real operational cost is presented and charged to the customer.

The canonical `customerTreatment` values are:

- `CHARGEABLE`
- `COUNCIL_FUNDED`
- `SUPPRESSED`

Task Classification and Customer Treatment are separate concepts.

**Task Classification determines whether downstream operational lineage exists.**

**Customer Treatment determines how an existing operational cost is represented commercially to the customer.**

---

# 1. Canonical Task ownership

Every Planner Task:

- belongs to exactly one existing Delivery Project;
- has one immutable canonical Task identity;
- is edited directly through that canonical record;
- has one governed Task Classification;
- must not be copied into a second editable Planner checklist or module-local task store;
- retains its Project and originating Register lineage.

Planner may create entirely new canonical Tasks as well as edit Tasks created through existing Project setup or templates.

---

# 2. First-class Task Classification

Every canonical Planner Task must be classified as either **Inert** or **Operational**.

## 2.1 Inert Task

An Inert Task is a reminder, checklist item, planning action, administrative action or other Project Task that does not itself represent deliverable operational work.

An Inert Task:

- remains entirely within the Planner domain;
- does not automatically create a Planner Job;
- does not automatically create a Resource Calculator/Costing record;
- does not automatically create a Quote Line;
- may have assignment;
- may have a responsible team;
- may have a due date;
- may have notes;
- may have priority/order;
- retains its own governed Task lifecycle;
- remains a canonical Project Task.

Examples may include:

- contact applicant;
- confirm access arrangements;
- review documentation;
- obtain internal approval;
- inspect submitted material;
- follow-up reminder;
- administrative checklist activity.

The existence of an Inert Task must never imply that operational work has been authorised, scheduled, costed or quoted.

## 2.2 Operational Task

An Operational Task represents deliverable work intended to participate in downstream delivery planning.

An Operational Task:

- remains a canonical Project Task;
- automatically establishes the Draft delivery lineage governed by this contract;
- owns at most one canonical Planner Job;
- may establish Resource Calculator/Costing lineage after explicit costing;
- may establish eligible Draft Quote Line lineage after deliberate Quote inclusion;
- remains governed by its own Task lifecycle independently of Job, Project and Quote lifecycle state.

Operational classification does not itself mean that work has been scheduled, authorised, completed or commercially issued.

---

# 3. Task editing

The Planner editing tool may modify governed Task properties including, where applicable:

- Task title/name;
- description or scope;
- Task Classification;
- assignment;
- responsible team;
- due date;
- priority/order;
- notes;
- governed Task state;
- scheduling/delivery attributes;
- quantities or operational attributes required for delivery or costing.

Task state remains a Task lifecycle and must not be replaced by Job, Project, Quote or Register status.

Significant Task changes must be attributable and sufficiently auditable to explain subsequent changes to downstream delivery lineage.

Changing Task Classification is a significant business mutation and must be explicitly processed under this contract.

Customer Treatment is not a Planner Task property and must not be edited in Planner.

---

# 4. Inert Task protection

Creating, editing, reopening, completing, reordering or otherwise interacting with an Inert Task must not create downstream operational or commercial records.

An Inert Task must not create:

- a Planner Job;
- a Scheduler Job;
- Resource Calculator/Costing lineage;
- a Draft Quote Line;
- an issued commercial consequence.

Repeated rendering, module navigation, save/reload, export/import or migration must not accidentally promote an Inert Task into operational lineage.

An Inert Task may later be deliberately promoted to Operational classification.

---

# 5. Promotion from Inert to Operational

Changing a Task from **Inert → Operational** is a governed promotion.

On successful promotion:

1. the existing canonical Task identity is retained;
2. no replacement Task is created;
3. the Task becomes eligible for downstream delivery lineage;
4. exactly one canonical Draft Planner Job is created or resolved;
5. Costing eligibility is exposed without creating a Costing Line;
6. Draft Quote inclusion remains a later deliberate action;
7. the promotion is auditable.

Promotion must be idempotent.

Repeated promotion attempts, rendering, navigation or synchronisation must not create duplicate Jobs, Costing records or Quote Lines.

---

# 6. Automatic Draft delivery lineage

An Operational Task automatically owns **at most one canonical Planner Job**.

When an Operational Task is created, or an Inert Task is promoted to Operational, Planner automatically creates or resolves its linked Planner Job in **Draft** state.

The Job:

- belongs to the same Delivery Project;
- retains the exact canonical Task identity as its source;
- is immediately visible to Scheduler under normal Scheduler ownership rules;
- is not equivalent to a scheduled or authorised Job merely because it exists;
- must not be duplicated by repeated Task edits, Planner rendering, navigation or repeated synchronisation.

Automatic creation of a Draft Job is a preparation action, not approval to schedule or deliver the work.

---

# 7. Resource Calculator / Costing lineage

Where an Operational Task contains sufficient information for costing, its Draft Job becomes eligible for a separate explicit Costing action. Task classification and Draft Job creation alone do not establish or update a Costing Line. A chosen Costing action creates or updates the corresponding governed Resource Calculator/Costing representation.

The downstream Costing record must:

- remain subordinate to the canonical Job and Project;
- retain its Task and Job source lineage;
- distinguish quantities/requirements supplied by the Task from rates and costing assumptions supplied by the costing system;
- preserve historical rate/basis snapshots in accordance with PC-007;
- never silently reinterpret historical issued commercial records because a Task subsequently changes.

Where information is insufficient to calculate a valid amount, the system may create an incomplete Draft Costing representation but must identify missing evidence rather than inventing values.

An Inert Task must never receive Costing lineage merely because it contains text, dates, assignment or notes.

**Customer Treatment must never modify the canonical Resource Calculator cost.**

A $1,000 operational cost remains a $1,000 operational cost regardless of whether the customer is charged $1,000, charged $0, or does not see the line on their Quote.

---

# 8. Draft Quote Line projection

Eligible Operational Task → Job → Costing lineage may be deliberately included in a **Draft Quote Line**. Later refresh of that already included Draft line may follow its existing canonical Costing source while the Quote remains mutable.

An inherited Quote Line must retain sufficient lineage to identify:

- source Task;
- source Job;
- source Costing Line;
- Delivery Project;
- Quote revision.

Refresh of an already deliberately included inherited line is permitted only while the affected Quote revision remains mutable.

Therefore:

- Draft Quote Lines may be created or refreshed from current canonical Costing evidence;
- appropriate Task or Costing changes may refresh an associated inherited Draft Quote Line where lineage remains unambiguous;
- Inert Tasks must not create Quote Lines;
- immutable Quote revisions must never be rewritten because the originating Task or Costing record later changes;
- later operational changes affecting an issued Quote must follow the governed Quote revision process under PC-008;
- deliberate inclusion and later Draft refresh must not bypass PC-013 Quote Readiness.

---

# 9. Governed Customer Treatment

Every Quote Line inherited from Resource Calculator/Costing must have one canonical `customerTreatment` value.

Valid values are exclusively:

```text
CHARGEABLE
COUNCIL_FUNDED
SUPPRESSED
```

The value is owned by the **Draft Quote revision and Quote Line**, not by the Task, Job or Resource Calculator Costing record.

Changing Customer Treatment is therefore a commercial decision.

It must not alter:

- Task Classification;
- Task lifecycle;
- Job lifecycle;
- operational scope;
- Resource Calculator quantities;
- canonical delivery cost;
- historical Costing snapshots.

For migrated or existing Draft Quotes whose inherited lines predate this contract, an inherited line that was previously presented and charged normally may initialise as `CHARGEABLE` unless stronger existing evidence establishes another treatment.

Customer Treatment must never remain ambiguous or undefined once the Quote is eligible for Issue.

---

# 10. `CHARGEABLE`

`CHARGEABLE` means:

- the operational work exists;
- the operational cost remains canonical;
- the line is displayed on the customer-facing Quote;
- the customer is charged according to the governed Quote calculation;
- the customer amount contributes to customer subtotal, applicable tax and amount payable;
- the underlying delivery cost remains available to funding calculations.

Conceptually:

**Operational cost → visible to customer → customer charge applies**

---

# 11. `COUNCIL_FUNDED`

`COUNCIL_FUNDED` means:

- the operational work exists;
- its full canonical operational cost remains in Resource Calculator/Costing;
- the line remains visible on the customer-facing Quote;
- the customer charge for that line is zero;
- the cost is funded from Council operational funding or another governed non-customer funding source;
- the treatment contributes appropriately to Council funding/funding-gap calculations;
- the line must not contribute to customer amount payable.

Customer-facing presentation must make the treatment intelligible.

A Council-funded line must not be presented merely as an unexplained `$0.00` item where that could imply the work itself has no cost.

Approved presentation should convey the equivalent of:

**Council funded — No charge to customer**

The customer-facing Quote does not need to disclose Council's internal operational cost unless a separate product or policy requirement explicitly requires that disclosure.

Therefore a line may internally represent:

```text
Delivery cost: $1,200
Customer treatment: COUNCIL_FUNDED
Customer charge: $0
Council funding requirement: $1,200
```

while the customer-facing document may simply display:

```text
Irrigation inspection
Council funded — No charge to customer
```

This permits the Quote to describe the full agreed work without falsely representing all work as customer-funded.

---

# 12. `SUPPRESSED`

`SUPPRESSED` means:

- the operational work still exists;
- its canonical Resource Calculator/Costing value remains unchanged;
- its Task → Job → Costing → Quote lineage remains intact;
- the inherited line remains visible to authorised users within Quote Builder;
- the line is excluded from the customer-facing Quote preview and exported Quote document;
- customer charge for the suppressed line is zero;
- the operational cost remains part of internal funding analysis;
- suppression does not delete the inherited Quote Line.

Conceptually:

**Operational cost → retained internally → not presented to customer → no customer charge**

Suppression must never be implemented by:

- deleting the Costing Line;
- setting Resource Calculator cost to zero;
- deleting the source Task;
- deleting the source Job;
- breaking source lineage;
- converting the inherited line into an unrelated custom adjustment.

A suppressed line is still part of the auditable commercial preparation history.

---

# 13. Quote Builder Customer Treatment control

For every inherited Resource Calculator/Costing Quote Line in a mutable Draft Quote, Quote Builder must provide a compact three-state control adjacent to the line.

The user-facing states are:

**Charge | Council funded | Hide**

These map canonically to:

```text
Charge          → CHARGEABLE
Council funded  → COUNCIL_FUNDED
Hide            → SUPPRESSED
```

The control must:

- be visually compact;
- clearly indicate the currently selected state;
- operate only on the relevant inherited Quote Line;
- persist its selected value;
- survive Quote Builder rerendering;
- survive module navigation;
- survive browser restart/workspace restoration;
- survive export/import;
- not be reset when the inherited line is refreshed from Resource Calculator;
- become immutable as part of an immutable Quote revision.

Changing this control must not mutate Resource Calculator.

Quote Builder must visually distinguish inherited lines from custom Quote-only lines.

Quote Builder should also make Council-funded and Suppressed treatment readily identifiable without requiring the user to inspect an internal record.

---

# 14. Quote calculations and funding separation

Customer Treatment must enforce a strict distinction between:

**delivery cost** and **customer charge**.

The total canonical delivery cost must continue to represent the true operational cost of delivering the work.

Customer amount payable must include only amounts chargeable under the Quote.

Therefore:

## `CHARGEABLE`

- included in operational delivery cost;
- included in customer charge calculation.

## `COUNCIL_FUNDED`

- included in operational delivery cost;
- excluded from customer charge;
- included in the applicable Council/non-customer funding requirement.

## `SUPPRESSED`

- included in operational delivery cost;
- excluded from customer charge;
- excluded from customer-facing line presentation;
- included in the applicable Council/non-customer funding requirement unless another governed funding source applies.

Customer Treatment must not allow total funding to cease reconciling with calculated delivery cost.

The existing commercial distinction between:

- Calculated delivery cost;
- Customer quote contribution;
- Council Operational Amount;
- other applicable funding;
- Total funding;
- Funding gap

must remain mathematically coherent.

---

# 15. Customer Treatment and Quote readiness

PC-013 Quote Readiness must recognise Customer Treatment.

A Quote must not Issue while any inherited Quote Line has an invalid, unknown or unresolved Customer Treatment.

Before Issue, the Quote must be able to establish:

- which operational lines are chargeable;
- which are Council funded;
- which are suppressed;
- the resulting customer contribution;
- the resulting Council/non-customer funding requirement;
- whether Total Funding reconciles with Calculated Delivery Cost according to governed commercial rules.

`COUNCIL_FUNDED` and `SUPPRESSED` must not be used to conceal an unresolved funding gap.

Customer Treatment is therefore part of commercial readiness evidence.

---

# 16. Quote revision immutability

On Issue, each inherited Quote Line's `customerTreatment` becomes part of the immutable Quote revision snapshot.

Subsequent changes to:

- Task;
- Job;
- Resource Calculator;
- Costing;
- Customer Treatment

must not rewrite an issued Quote revision.

If the treatment needs to change after Issue, the governed Quote revision/supersession process under PC-008 must be used.

For example:

**Issued revision 1**

```text
Tree replacement → CHARGEABLE
Irrigation inspection → COUNCIL_FUNDED
Site inspection → SUPPRESSED
```

must remain historically intact even if Draft revision 2 later uses different treatments.

---

# 17. Synchronisation rather than duplication

Once an Operational Task has downstream lineage, subsequent edits operate on existing canonical lineage.

The relationship is:

**Canonical Operational Task → one canonical Draft Planner Job → explicit Costing action and governed Costing representation → deliberate inclusion in a Draft Quote Line → governed Customer Treatment**

Repeated editing, refreshing, rendering, workspace loading or navigation must not create additional Jobs, Costing records or Quote Lines for the same lineage unless the user deliberately creates a distinct item of work.

Refreshing an inherited Draft Quote Line from Resource Calculator must preserve its Quote-owned `customerTreatment`.

---

# 18. Propagation boundaries

Automatic synchronisation must respect domain ownership.

For example:

- Task scope changes may affect Job description/scope;
- Task assignment may inform delivery planning without replacing Scheduler crew allocation;
- Task due date may inform scheduling but must not silently create a confirmed scheduled date;
- resource requirements may affect Draft Costing;
- Costing changes may update the inherited Draft Quote Line's cost basis;
- Task lifecycle state must not masquerade as Job lifecycle state;
- Customer Treatment must not modify operational cost;
- Quote Builder controls commercial presentation and customer liability;
- Planner must not determine whether a customer is charged for a Costing Line.

Each business domain retains its own lifecycle and authority under PC-012.

---

# 19. Existing Job protection

If an Operational Task already owns a canonical Planner Job, editing the Task must resolve to and update that Job where propagation is permitted.

It must never manufacture a second Planner Job merely because:

- the Task was reopened;
- its title changed;
- its state changed;
- a due date changed;
- its classification was reselected as Operational;
- Planner was reloaded;
- the Project was reselected;
- workspace data was exported/imported.

Task ↔ Planner Job linkage is persistent canonical lineage.

---

# 20. Task demotion protection

Changing a Task from **Operational → Inert** is a governed demotion.

Demotion must never be treated as a simple field toggle once downstream lineage exists.

## 20.1 Operational Task with no downstream lineage

If an Operational Task has not created any Job, Costing or Quote lineage, demotion to Inert may proceed directly.

The canonical Task identity must be retained.

## 20.2 Operational Task with Draft-only downstream lineage

Where the Task has downstream records but all affected records remain safely disposable Draft preparation records, the system may permit demotion only through an explicit reconciliation action.

The user must be informed that the Task owns downstream lineage.

The system must then either:

- safely retire/remove the Draft downstream lineage as one governed operation; or
- retain that lineage in an explicitly cancelled/retired state where deletion would lose required history.

Demotion must not leave orphaned records.

The existence of `SUPPRESSED` Customer Treatment does not make downstream lineage nonexistent.

A suppressed Quote Line is still downstream lineage.

## 20.3 Operational Task with established downstream business history

If the Task has downstream history that must be preserved, demotion must not destroy, detach or rewrite that history.

Protected downstream history includes, as applicable:

- Scheduled Jobs;
- Jobs with crew/resource allocation;
- Jobs with delivery records;
- Completed Jobs;
- historical Costing snapshots;
- issued or immutable Quote revisions;
- Customer Treatment snapshots;
- payments;
- payment allocations;
- other governed dependent records.

The system must:

1. block simple demotion;
2. explain which downstream lineage prevents demotion;
3. require the relevant cancellation, retirement, revision or reconciliation workflow before classification can change.

Changing a Quote Line to `SUPPRESSED` or `COUNCIL_FUNDED` must never be treated as permission to demote its source Operational Task.

---

# 21. Downstream lineage protection

Once downstream activity has acquired business history, Task editing must not silently invalidate that history.

The canonical lineage:

**Project → Task → Job → Costing → Quote Line → Customer Treatment → Quote revision → Payment**

must remain traceable where applicable.

The system must not:

- sever a Task from its existing Job;
- repoint a Job to another Task merely to simplify editing;
- create a replacement Task and abandon original lineage;
- delete Costing history required to explain a Quote;
- rewrite immutable Customer Treatment history;
- rewrite immutable Quote lineage;
- orphan payment history;
- silently remove downstream records during Task demotion.

Where a requested Task mutation would make downstream records materially inconsistent, the product must either:

1. safely propagate the change under an authorised contract;
2. require an explicit revision/reconciliation action; or
3. block the change with an explanation.

Silent severance, replacement or rewriting of established lineage is prohibited.

---

# 22. Task creation

Planner permits officers to create entirely new Tasks within the active Delivery Project.

Creation must establish:

- a valid canonical Task identity;
- an explicit Task Classification;
- valid Project lineage;

before downstream records are generated.

## New Inert Task

**New Task  
→ Inert  
→ Planner only**

No downstream Job, Costing or Quote records are created.

## New Operational Task

**New Task → Operational → Draft Planner Job → explicit Costing action when a basis is available → deliberate Draft Quote inclusion when eligible → governed Customer Treatment**

Task creation must be atomic enough that failure during downstream creation cannot leave misleading duplicate or orphaned business records.

---

# 23. Task deletion / retirement

A Task with no downstream business history may be removed according to normal governed deletion rules.

A Task that owns downstream Job, Costing, Quote or payment lineage must not be silently deleted in a manner that destroys or orphans that history.

Such Tasks require a governed retirement, cancellation, dependency-resolution or other explicit action appropriate to their downstream state.

Changing:

- Task Classification;
- Customer Treatment;
- Quote visibility

must not be used as a workaround for deletion protection.

PC-010 Dependency Protection applies.

---

# 24. Recovery and persistence

Task identity, Task Classification, Customer Treatment and all downstream source links must survive:

- redraw;
- module navigation;
- browser restart;
- workspace save/export;
- workspace import/recovery;
- schema migration.

Recovery must not:

- promote Inert Tasks to Operational;
- demote Operational Tasks to Inert;
- rebuild the same Operational Task into duplicate Jobs;
- generate duplicate Costing records;
- generate duplicate Draft Quote Lines;
- reset inherited Quote Lines to `CHARGEABLE` where a deliberate different treatment was already stored;
- lose Task ↔ Job ↔ Costing ↔ Quote lineage.

PC-011 Workspace Recovery applies.

---

# 25. Planner UI requirement

Planner must provide a dedicated Task editing surface capable of:

- selecting an existing canonical Task;
- editing its permitted fields;
- creating a new canonical Task;
- setting or changing Task Classification;
- showing its current Task state;
- clearly distinguishing Inert from Operational Tasks;
- showing whether an Operational Task has a linked Draft/operational Job;
- exposing downstream lineage sufficiently for the officer to understand whether the Task has Scheduler, Costing and commercial consequences;
- warning when promotion will create downstream records;
- warning or blocking demotion where downstream lineage exists;
- identifying downstream records preventing unsafe demotion;
- warning or blocking other changes where immutable downstream history prevents automatic propagation.

Planner must make clear the distinction between:

- editing the Task;
- changing Task Classification;
- editing Scheduler-owned information;
- editing Costing-owned information;
- changing customer commercial treatment.

Planner must not become an alternative Scheduler, Resource Calculator or Quote Builder.

---

# 26. Quote Builder UI requirement

For inherited Resource Calculator Quote Lines, Quote Builder is the authoritative interface for Customer Treatment.

Every mutable inherited line must expose the compact:

**Charge | Council funded | Hide**

control.

The Quote Builder must make it immediately apparent whether an inherited operational line is:

- customer chargeable;
- visible but Council funded;
- hidden from customer presentation.

The customer-facing Preview and exported Quote must respond immediately and consistently to the selected treatment.

### Charge

Display the line normally and include its customer charge.

### Council funded

Display the line as part of the work scope but communicate that there is **no charge to the customer**.

Do not expose internal Council cost solely because the line is Council funded.

### Hide

Do not display the line on the customer-facing Preview or exported Quote.

Retain the line, treatment and full lineage internally.

Once the Quote revision becomes immutable, the three-state control must also become immutable for that revision.

---

# 27. Explicit acceptance contract

PC-020 is satisfied only when automated and browser-level proof demonstrates all of the following.

## Canonical Task editing

1. An existing Task can be edited and the canonical Task itself changes.
2. A new Task can be created within the active Project.
3. Task identity survives redraw, navigation, save/reload and export/import.
4. No shadow Planner Task database or competing editable Task representation is introduced.

## Inert Task behaviour

5. A newly created Inert Task creates no Job.
6. A newly created Inert Task creates no Costing record.
7. A newly created Inert Task creates no Quote Line.
8. Editing an Inert Task does not create downstream lineage.
9. Reopening, completing, rerendering or reloading an Inert Task does not create downstream lineage.
10. Export/import preserves Inert classification without downstream creation.

## Operational Task behaviour

11. A newly created Operational Task automatically obtains exactly one Draft Planner Job.
12. The Job is visible to Scheduler and retains exact Task/Project lineage.
13. Repeated Task edits do not create duplicate Jobs.
14. Appropriate Task changes update permitted Draft Job attributes.
15. Draft Job creation alone creates no Costing Line; an explicit action with a valid basis creates or updates canonical Costing lineage.
16. Draft Job creation alone creates no Quote Line; an eligible Costing Line may be deliberately included in a Draft Quote.
17. Insufficient Costing evidence remains visibly incomplete rather than being fabricated.

## Promotion

18. Promoting Inert → Operational retains the same canonical Task identity.
19. Promotion creates or resolves exactly one Draft Planner Job.
20. Repeated promotion does not create duplicate downstream records.
21. Promotion establishes Task → Draft Job lineage; later explicit Costing and deliberate Quote inclusion retain that lineage.

## Customer Treatment

22. Every inherited Draft Quote Line has exactly one valid `customerTreatment`.
23. `CHARGEABLE` displays the line and contributes correctly to customer amount payable.
24. `COUNCIL_FUNDED` displays the line but contributes zero to customer amount payable.
25. `COUNCIL_FUNDED` retains the true Resource Calculator cost.
26. `COUNCIL_FUNDED` contributes correctly to Council/non-customer funding requirements.
27. `SUPPRESSED` removes the line from customer Preview.
28. `SUPPRESSED` removes the line from exported customer Quote output.
29. `SUPPRESSED` does not delete the inherited Quote Line internally.
30. `SUPPRESSED` retains Task/Job/Costing lineage.
31. `SUPPRESSED` retains the true operational cost.
32. Customer Treatment changes never mutate Resource Calculator quantities or cost.
33. Refreshing an inherited line from Resource Calculator preserves its existing Customer Treatment.
34. Changing Customer Treatment does not create duplicate Quote Lines.
35. Customer Treatment survives rerender, navigation, browser restart and workspace recovery.
36. Customer Treatment survives export/import.

## Quote Builder control

37. Each mutable inherited Quote Line displays the compact **Charge | Council funded | Hide** control.
38. The control maps exactly to `CHARGEABLE`, `COUNCIL_FUNDED` and `SUPPRESSED`.
39. Changing the control updates customer Preview appropriately.
40. Changing the control updates commercial totals appropriately.
41. Council-funded lines are communicated as no charge rather than merely appearing as unexplained zero-value lines.
42. Suppressed lines remain visible to authorised users in Quote Builder while absent from customer output.
43. Immutable Quote revisions do not permit Customer Treatment editing.

## Funding and readiness

44. Customer contribution includes only governed customer-chargeable amounts.
45. Council-funded operational cost remains represented in funding calculations.
46. Suppressed operational cost remains represented in internal funding calculations.
47. Customer Treatment cannot conceal an unresolved funding gap.
48. A Quote cannot Issue with unresolved/invalid Customer Treatment.
49. Quote Readiness correctly evaluates the final treatment and funding position.
50. Creating Costing or Quote lineage does not automatically make a Quote ready for Issue.

## Quote revision protection

51. Issue snapshots Customer Treatment for every inherited line.
52. Later Resource Calculator changes do not rewrite Customer Treatment in an issued Quote.
53. Later Task changes do not rewrite an issued Quote.
54. Changing treatment after Issue requires the governed Quote revision process.
55. Superseded/previous Quote revisions retain their historical treatment exactly.

## Safe demotion

56. An Operational Task with no downstream lineage may be demoted to Inert.
57. An Operational Task with Draft-only downstream lineage cannot be silently demoted while leaving orphaned records.
58. Draft-only demotion requires governed reconciliation.
59. A Scheduled Job prevents silent Task demotion.
60. Completed delivery history prevents silent Task demotion.
61. Immutable Quote lineage prevents silent Task demotion where reconciliation is required.
62. Payment history prevents silent Task demotion.
63. A blocked demotion identifies the downstream dependency preventing the action.
64. Marking a Quote Line `SUPPRESSED` does not remove the demotion protection created by that downstream lineage.

## Lineage protection

65. Task demotion cannot sever Task ↔ Job lineage.
66. Task demotion cannot orphan Costing records.
67. Task demotion cannot rewrite issued Quote history.
68. Task demotion cannot orphan payment history.
69. Cancellation, retirement or reconciliation preserves original canonical lineage required for audit.
70. Task → Job → Costing → Quote Line → Customer Treatment lineage survives save, reload, export and import.

## Domain protection

71. Task state remains distinct from Job state.
72. Task Classification remains distinct from Task lifecycle state.
73. Customer Treatment remains distinct from Task Classification.
74. Customer Treatment remains Quote-owned rather than Resource Calculator-owned.
75. Creating a Draft Job does not automatically schedule it.
76. Council funding does not change the canonical operational cost.
77. Hiding a Quote Line does not delete or zero the canonical operational cost.
78. Deliberate Draft Quote inclusion and later refresh do not bypass PC-013 Quote Readiness.

---

# 28. Relationship to existing contracts

PC-020 strengthens PC-003 `PLANNER_TASK_CANON`.

It operates with:

- PC-006 `JOB_PARENTAGE`;
- PC-007 `COST_SNAPSHOT`;
- PC-008 `QUOTE_REVISION`;
- PC-010 `DEPENDENCY_PROTECTION`;
- PC-011 `WORKSPACE_RECOVERY`;
- PC-012 `DOMAIN_LIFECYCLES`;
- PC-013 `QUOTE_READINESS`;
- PC-016 `SCHEDULER_INTERACTION_SCOPE`.

PC-020 also amends the former Planner workflow rule that creation of a Planner Job necessarily requires a separate explicit scheduling action.

Under PC-020:

**creation of an Operational Task automatically provisions one canonical Draft Planner Job.**

An Inert Task creates no downstream delivery lineage.

A separate explicit user action remains necessary for any transition constituting actual scheduling, authorisation, issuance, payment or other governed lifecycle advancement.

The operational distinction is:

**Inert Task  
→ canonical Planner Task only**

versus:

**Operational Task → canonical Planner Task → one Draft Planner Job → explicit Costing lineage → deliberate inherited Draft Quote Line inclusion**

The commercial presentation then becomes:

**Inherited Quote Line  
→ `CHARGEABLE`  
→ visible + customer charged**

or:

**Inherited Quote Line  
→ `COUNCIL_FUNDED`  
→ visible + no customer charge + operational cost retained**

or:

**Inherited Quote Line  
→ `SUPPRESSED`  
→ hidden from customer + no customer charge + operational cost retained**

At no point may Customer Treatment corrupt, zero, delete or obscure the underlying canonical operational cost or its traceable business lineage.
