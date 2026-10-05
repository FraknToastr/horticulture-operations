# HORTICULTURE OVERTIME PLANNER

## STAGE 1 ARCHITECTURE, GOVERNANCE & CANONICAL-DATA RESET DIRECTIVE

**Status:** Authoritative development directive for Gemini 3.8  
**Date:** 23 September 2026  
**Purpose:** Reset development assumptions after PR04/PR05 and establish the governing contracts for the remainder of Stage 1 and subsequent development.  
**Supersedes:** Any statement in `GEMINI_STAGE2_HANDOFF.md`, PR04/PR05 close-out notes, or earlier development prompts that describes Stage 1 as complete, closed, approved, or ready to transition directly to Stage 2.

---

# 1. READ THIS FIRST — THE DEVELOPMENT POSITION HAS CHANGED

Gemini must no longer operate on the assumption that the project is still at the PR04/PR05 development standard.

The previous handoff describes Stage 1 as essentially complete and frames the next major activity as a Stage 2 clean-slate reset. That is no longer the governing position.

Independent peer review has subsequently established that:

- historical scheduled-commitment persistence is not yet integrated consistently through all real application workflows;
- JSON backup/restore does not yet preserve all canonical rostering and historical evidence consistently;
- propagated Fixed/Rotation assignments do not yet guarantee authoritative snapshot capture for every committed occurrence;
- snapshot validation still needs to be treated as authoritative evidence validation, not merely optional envelope validation;
- the current codebase still carries legacy-schema, migration, compatibility and preserved-workspace concerns that are no longer required for the intended client handover;
- the project now requires a single authoritative data model and explicitly governed canonical concepts before additional rostering features are introduced;
- future Job Registry, Workforce Registry and smart auto-rostering features will depend on this canonical model and must not force another persistence redesign immediately after Stage 1.

Therefore:

> **Stage 1 is not a narrow PR05 bug-fix exercise anymore. It is now the integrity, canonical-data, legacy-removal and architecture-foundation stage.**

This is still not permission for a broad product redesign. The objective is to simplify and harden the architecture that will actually be shipped.

---

# 2. AUTHORITY AND CONFLICT RULE

This document is the current governing development directive.

If it conflicts with:

- `GEMINI_STAGE2_HANDOFF.md`;
- PR04 or PR05 assumptions;
- previous close-out reports;
- old migration requirements;
- old preserved-workspace compatibility expectations;
- older prompts requiring legacy data to remain loadable;

then this document takes precedence unless the user explicitly instructs otherwise.

Historical documents remain evidence of previous decisions and implementation history. They are not automatically current requirements.

Do not silently rewrite historical governance documents to make them appear consistent with the new direction. Create new current-state documentation or addenda instead.

---

# 3. CURRENT PRODUCT HANDOVER ASSUMPTION

The intended client handover is now based on a **clean installation**.

The client will:

- receive no legacy saved workspace from earlier development stages;
- receive no requirement to migrate historical prototype schemas;
- configure the Job Registry from scratch;
- configure the Workforce Registry from scratch or from a supported new-format import;
- generate all operational history under the final supported schema;
- require reliable save, reload, backup, restore and browser-storage reset behaviour from that point onward.

Therefore backwards compatibility with obsolete development workspaces has no business value unless explicitly retained for another reason.

The architecture should now optimise for:

```text
one supported schema
+ one canonical workspace envelope
+ one canonical persistence path
+ explicit rejection of unsupported old data
+ reliable history created under the supported schema
```

not:

```text
multiple historical schemas
+ silent migration
+ fallback reconstruction
+ preserved prototype workspaces
+ indefinite backwards compatibility
```

---

# 4. STAGE 1 — NEW PRIMARY GOAL

Stage 1 now has five linked goals.

## Goal A — Close the remaining integrity defects

Complete the historical scheduled-commitment lifecycle and other still-open eligibility/persistence defects identified through PR05 review.

## Goal B — Establish one authoritative canonical data model

Identify the schema and runtime structures that will be supported at handover and make them authoritative.

## Goal C — Remove obsolete legacy compatibility

Delete verified obsolete migration, conversion, fallback and preserved-workspace compatibility code that exists only to support unsupported historical schemas or development-era saved workspaces.

## Goal D — Establish foundations required by future registry and smart-rostering work

Define the canonical concepts and extension points needed for future:

- Workforce Tags;
- Qualifications;
- Permits;
- multiple unavailability periods;
- Job requirements;
- successive-day scheduling;
- eligibility filtering;
- smart rotation;
- randomised eligible allocation;
- leaderboards and workload summaries;
- calendar/ICS integration.

Do not implement all of those features in Stage 1. Establish only the data and architectural contracts required to avoid another foundational rewrite.

## Goal E — Prove a clean-install lifecycle

A brand-new installation must be capable of creating its first operational data, persisting it, reloading it, backing it up and restoring it without legacy scaffolding.

---

# 5. REVISED DEVELOPMENT STAGES

The current development sequence is:

## Stage 1 — Integrity + Canonical Architecture + Legacy Removal

Includes:

- remaining eligibility/persistence corrections;
- authoritative workspace/schema decision;
- removal of obsolete migration/backwards-compatibility code;
- historical scheduled-commitment lifecycle completion;
- canonical concepts and extension points for upcoming Registry and rostering work;
- clean-install architecture verification.

## Stage 2 — User-facing Reset and Clean-Slate Operation

Includes:

- deliberate workspace reset mechanism;
- complete application-owned browser-storage reset;
- safe destructive confirmation;
- clean first-run state;
- empty or intentionally minimal initial registries;
- onboarding/reset UX as required.

Stage 2 should use the canonical Stage 1 architecture, not maintain old migration pathways.

## Stage 3 — Job Registry + Workforce Registry + Smart Auto-Rostering

These are expected to be interconnected and may be developed together where their dependencies justify it.

This stage may include feature-driven UI changes required to make those capabilities functional.

## Stage 4 — Standalone Targeted UI Improvements

This stage is reserved for UI changes that are independent of the functional work above.

**Important distinction:** UI changes caused by or required for Registry, Reset, Permits, eligibility or smart-rostering functionality are **collateral/feature-driven UI changes**, not “targeted UI changes”, and should be implemented in the relevant functional stage.

---

# 6. DEVELOPMENT CONSTITUTION — NON-NEGOTIABLE PRINCIPLES

The following principles govern all subsequent development.

## C1. One canonical source of truth per concept

Do not maintain parallel competing representations of the same operational fact unless a clearly documented projection/cache exists.

Examples:

- employee identity has one canonical key;
- Job identity has one canonical key;
- shift/occurrence identity has one canonical key;
- allocation provenance has one canonical representation;
- eligibility is determined by one canonical engine;
- historical scheduled timing has one canonical authoritative record;
- current workspace state has one canonical envelope.

## C2. Eligibility is authoritative and centralised

Manual allocation, Fixed allocation, Rotation, future smart rotation, random allocation, pools and future selection mechanisms must all consume the same canonical eligibility contract.

No rostering strategy may implement a private alternate interpretation of:

- overlap;
- rest period;
- booking conflict;
- unavailability;
- qualifications;
- permits;
- required tags;
- Job acceptance requirements;
- future policy restrictions.

## C3. Historical facts must not be reconstructed from mutable definitions

Once a scheduled commitment becomes historical, its authoritative scheduled timing must not depend on the current Job definition.

A later change to:

- Job start time;
- duration;
- recurrence;
- active/inactive state;
- permit requirement;
- qualification requirement;

must not rewrite what was originally scheduled.

Where authoritative historical evidence is absent, the system must say that it is unavailable or unverified. It must not invent certainty.

## C4. Planned schedule and actual work are different concepts

A historical scheduled commitment is evidence of what was scheduled.

It is not automatically evidence of:

- actual attendance;
- actual hours worked;
- payroll acceptance;
- overtime actually paid;
- confirmed completion.

The data model must preserve this distinction so later leaderboard/reporting work does not mistake plans for actuals.

## C5. Fail closed where integrity cannot be established

Where a rostering decision requires data that cannot be verified, the application must not silently treat the employee as eligible.

Do not convert uncertainty into availability.

## C6. No speculative refactor

Remove code because it is demonstrably obsolete, duplicative or tied solely to unsupported legacy behaviour—not because it looks old.

Do not refactor stable modules merely to make them stylistically cleaner during Stage 1.

## C7. No hidden compatibility layer

After legacy removal, unsupported old workspaces must be explicitly rejected rather than partially loaded, silently migrated or coerced into the current schema.

## C8. Stable identities are permanent contracts

Do not use:

- array indexes;
- row order;
- employee display names;
- DOM positions;
- current sort order;

as persistent identity.

## C9. Transactional writes remain mandatory

Any workflow that changes operational assignments, rostering instructions, historical evidence or canonical Registry data must preserve the existing fail-safe persistence contract:

```text
validate proposed state
→ persist successfully
→ adopt new state
```

On failure:

```text
previous valid state remains authoritative
```

Do not mutate live canonical state irreversibly before persistence success.

## C10. User-visible data integrity beats silent convenience

When an operation cannot be safely completed, prefer an explicit blocked state or actionable warning over an apparently successful but unverifiable result.

---

# 7. CANONICAL DATA MODEL — REQUIRED CONCEPTS

Stage 1 must define the supported conceptual model even where later stages provide the editors and UI.

The exact property names may be proposed by Gemini, but the concepts and relationships below must remain explicit.

---

## 7.1 Workspace

The workspace is the authoritative persisted application state.

It should contain only supported current-schema domains.

Candidate canonical domains include:

```text
schemaVersion
jobs
workforce
assignments
rostering
historicalScheduledCommitments
permits / permit definitions or references
qualification definitions or references
application settings required for operation
```

Do not add placeholder domains purely because a future feature might exist.

Where future extensibility can be achieved cleanly through existing Registry objects and requirement references, prefer that over speculative empty collections.

---

## 7.2 Workforce Member

A Workforce Registry record represents a person who may be considered for allocation.

The future model must be able to accommodate:

```text
employeeId                stable identity
name / display fields
team
active/current status
tags[]
qualifications[]
permits or permit eligibility where person-scoped
unavailabilityPeriods[]
jobAcceptanceAttributes[] or equivalent
```

Examples of future tags/attributes include:

```text
Park Lands Ranger
Plant Operator
```

Examples of future qualifications include:

```text
First Aid
vehicle licence
```

Do not encode these concepts as ad hoc booleans spread across unrelated components if a canonical collection/reference model is more appropriate.

---

## 7.3 Tag

A Tag is a general workforce classification or selection attribute.

Examples:

```text
Park Lands Ranger
specific workgroup membership
special operational experience
```

Tags are not automatically qualifications and are not automatically permits.

They may be used for filtering, preference or requirement matching depending on the Job configuration.

---

## 7.4 Qualification

A Qualification is evidence that a workforce member satisfies a defined competency or credential requirement.

The future model should be capable of supporting validity metadata such as:

```text
qualificationId
type
validFrom
validTo
status
```

Only add expiry/validity fields to the Stage 1 schema if the architecture genuinely needs them now. Otherwise define the extension contract clearly.

Health-related requirements such as vaccination should store only the minimum eligibility/clearance information needed for rostering. Do not design the application as a medical-record store.

---

## 7.5 Permit

A Permit is not the same concept as a workforce qualification.

Future examples include:

```text
WZTM
TPO
```

The model must allow the later Permits module to determine whether a Job/occurrence has the operational permission required to proceed.

A permit may be:

- Job-scoped;
- occurrence/date-scoped;
- location-scoped;
- subject to a validity period.

Do not prematurely decide that permits always belong to employees.

---

## 7.6 Unavailability Period

A workforce member may have multiple non-availability periods.

The model must not assume a single start/end absence record.

Future eligibility must be able to determine whether a proposed shift overlaps any applicable unavailability period.

---

## 7.7 Job

A Job is the canonical operational definition from which occurrences/shifts are generated.

Future requirements may include:

```text
required workforce tags
required qualifications
required permits
successive-days count
public-holiday inclusion behaviour
crew requirements
preferred start day
recurrence
start time
duration
```

A Job definition is mutable operational configuration.

It must never become the sole source used to reconstruct authoritative historical schedule timing after the fact.

---

## 7.8 Occurrence / Shift

A generated occurrence is the canonical schedulable instance of a Job.

It must have stable identity independent of display order.

The occurrence model must support:

- cross-year generation;
- overnight timing;
- daylight-saving-safe elapsed-time calculations;
- future successive-day scheduling;
- public-holiday scheduling;
- years containing 53 occurrences of a weekly weekday pattern where calendar structure produces them.

No fixed “52 weeks means a full year” assumption may be introduced.

---

## 7.9 Assignment

An Assignment links a workforce member to an occurrence/slot.

The data contract must distinguish at least conceptually between:

```text
manual assignment
generated/propagated assignment
source rostering instruction
allocation provenance
```

Assignment identity and provenance must survive Registry sorting, editing and workspace reload.

---

## 7.10 Rostering Instruction

A rostering instruction describes how assignments are to be generated or maintained.

Existing modes include:

```text
Manual
Fixed
Rotation
```

Future modes/strategies may include:

```text
smart rotation by staff
smart rotation by team
pool-based rotation
exclusive staff
same-staff continuation
random eligible allocation
```

Stage 1 must not implement those future modes.

It must ensure the current instruction/provenance architecture can be extended without bypassing canonical eligibility.

---

## 7.11 Historical Scheduled Commitment

This is the authoritative record of the scheduled facts needed after an occurrence becomes historical.

At minimum it should be capable of preserving:

```text
shift/occurrence identity
Job identity where relevant
date
start time
duration
assigned employee identities
record type / provenance required to distinguish scheduled commitment from actual work
```

The exact schema must be validated strictly enough that the eligibility engine can trust it.

A malformed record must never be silently interpreted as a valid midnight/default-duration shift.

---

# 8. CANONICAL ELIGIBILITY CONTRACT

The eligibility engine is one of the most important architectural boundaries in the application.

Future candidate selection should conceptually follow:

```text
candidate universe
↓
current workforce status
↓
time overlap / existing booking
↓
10-hour rest rule
↓
unavailability periods
↓
Job tag requirements
↓
qualification requirements
↓
permit / operational requirements where workforce-related
↓
other explicit Job acceptance requirements
↓
eligible candidate set
↓
strategy-specific ranking or selection
```

The final strategy-specific stage may vary:

```text
alphabetical
least recently allocated
fair rotation
same staff
team preference
pool preference
random among eligible candidates
```

but strategy selection must occur **after eligibility**, not instead of eligibility.

Future “random rostering” means random selection from the eligible candidate population according to defined selection preferences. It must not randomly test workers until one happens to pass.

Where auditability is required, future random selection should be capable of recording sufficient decision context to explain the result.

---

# 9. CALENDAR AND SCHEDULER FOUNDATION CONTRACT

Upcoming Job Registry work proposes successive-day rostering, such as:

```text
preferred start day = Saturday
successive days = 2
→ Saturday + Sunday occurrence sequence
```

Future requirements may also include:

```text
include public holidays
full-year programming
calendar years with 53 instances of a weekday
```

Stage 1 does not need to implement the user-facing feature.

It must ensure the scheduler architecture does not prevent it.

Required foundation principles:

1. Occurrence identity must be based on actual canonical date/Job identity, not week number alone.
2. Cross-year occurrence generation must be valid.
3. A calendar year must not be assumed to contain exactly 52 occurrences for weekly patterns.
4. Public-holiday inclusion must be representable as scheduling policy rather than a hard-coded special case.
5. Successive-day sequences must eventually be able to span month/year boundaries.
6. Rest/overlap calculations must use real elapsed time and correct local time semantics.

Do not add speculative scheduler complexity if the current engine already satisfies these foundations.

---

# 10. HISTORICAL EVIDENCE LIFECYCLE — STAGE 1 MUST COMPLETE THIS

The previous PR05 implementation introduced `historicalSnapshots` / historical scheduled-commitment evidence but did not prove a complete application-level lifecycle.

Stage 1 must now establish one authoritative lifecycle.

For every assignment that becomes a committed scheduled allocation, determine when its authoritative scheduled timing becomes immutable evidence.

The canonical flow should be explicit, for example:

```text
allocation committed
↓
canonical occurrence timing captured
↓
assignment + timing evidence included in proposed workspace state
↓
workspace validated
↓
persistence succeeds
↓
new state adopted
```

For Fixed/Rotation propagation:

```text
one save operation may commit multiple occurrence assignments
→ every committed occurrence requiring historical evidence must be covered
```

Do not record only the source modal occurrence while leaving propagated assignments dependent on mutable Job definitions.

The implementation must define:

- when evidence is created;
- when it becomes historical;
- whether future scheduled commitments are snapshotted immediately or sealed on rollover;
- how cancellation/replacement affects evidence;
- how archived Jobs interact with historical evidence;
- how orphaned historical evidence is retained or identified;
- how workspace save/reload preserves it;
- how JSON backup/restore preserves it;
- how reset deletes it when intentionally wiping the workspace;
- how corrupted evidence is rejected.

Prefer the simplest model that satisfies these contracts.

---

# 11. CURRENT PR05 DEFECTS THAT REMAIN IN SCOPE

The following findings remain relevant unless legacy removal makes a particular path disappear completely.

## 11.1 Normal application save must persist historical scheduled commitments

`saveCurrentWorkspace()` and any canonical envelope construction must include the authoritative historical evidence domain.

No alternate/fallback envelope may silently omit it.

## 11.2 Backup/restore must preserve the complete current-schema workspace

The supported JSON backup must preserve all canonical domains required for operational continuity, including:

- assignments;
- rostering instructions;
- rostering provenance;
- historical scheduled commitments;
- Registry data;
- any other current-schema domain required for the application to continue accurately.

Do not preserve obsolete schema artifacts solely for backwards compatibility.

## 11.3 Restore must replace active state completely and safely

Restoring a workspace must not leave snapshot/history/rostering state from the previously active workspace in memory.

Workspace replacement must invalidate relevant caches.

## 11.4 Propagated allocations must preserve authoritative timing

Fixed and Rotation workflows must not leave later historical occurrences dependent on mutable Job definitions.

## 11.5 Historical evidence validation must be strict

Validate canonical identity, dates, start time, finite positive duration and correctly typed employee identifiers.

Malformed authoritative evidence must fail closed.

## 11.6 Persistence failure must roll back the complete proposed transaction

Assignments, instructions, provenance and historical evidence must not diverge when saving fails.

---

# 12. LEGACY SCHEMA & BACKWARDS-COMPATIBILITY REMOVAL

This is now an explicit Stage 1 objective.

Gemini must first perform a dependency audit before deleting code.

Classify every persistence-related path into one of these categories:

```text
A. Current canonical path — KEEP
B. Current recovery/integrity path — KEEP
C. Current backup/restore path — KEEP and correct if required
D. Development-era migration path — REMOVE if no longer required
E. Old-schema conversion path — REMOVE if no longer required
F. Fallback for preserved old workspaces — REMOVE if no longer required
G. Test-only legacy fixture/scaffold — REMOVE or isolate when no longer relevant
H. Unknown/ambiguous — investigate before changing
```

### Remove only after proving that the code is legacy-only.

Likely candidates for examination include:

- migration engine branches;
- schema-version upgrade handlers;
- old field-name adapters;
- legacy hard-coded historical fixtures;
- fallback loaders that reconstruct unsupported envelopes;
- compatibility coercion of malformed old data;
- preserved seeded Jobs/staff used only to support development history.

Do **not** automatically delete a module merely because it is named `migrationEngine.js`. If the module still performs required current-schema recovery or validation orchestration, separate the current responsibility from the obsolete compatibility responsibility first.

---

# 13. CURRENT SCHEMA CONTRACT

Stage 1 must explicitly declare exactly one supported workspace schema for handover.

If the supported schema remains named `Schema v2`, that is acceptable. The number/name is not important.

What matters is:

```text
one accepted schema
one validator
one current envelope
one documented import/export contract
```

Unsupported schemas should receive an explicit error such as:

```text
Unsupported workspace version
```

not an attempt to silently migrate.

Once the canonical schema has been declared, remove tests whose sole purpose is to guarantee migration from unsupported development-era schemas.

Retain tests for:

- rejecting unsupported schemas;
- rejecting malformed current-schema data;
- preserving current-schema data round trips;
- recovery from current-schema storage failure where that behaviour remains supported.

---

# 14. RESET FOUNDATION — STAGE 1 VS STAGE 2

The actual user-facing reset mechanism belongs primarily to Stage 2.

Stage 1 must ensure that the architecture can support two distinct operations later:

## Reset Workspace

Clear current operational workspace state and return to a clean current-schema workspace.

## Wipe Application Storage

Delete all application-owned browser persistence, caches and recovery state and return to true first-run behaviour.

Do not implement UI confirmation flows in Stage 1 unless they are required to exercise the canonical clean-install lifecycle.

Do not leave hidden legacy keys in browser storage after a full wipe.

---

# 15. FUTURE FEATURE FOUNDATIONS — DEFINE, DO NOT IMPLEMENT

The following future concepts are now known and should influence architectural choices, but they are **not Stage 1 feature requests**.

## Workforce Registry

Future editor support for:

- Tags;
- multiple unavailability periods;
- qualifications;
- job-acceptance requirements.

## Permits Module

Future operational permits such as WZTM and TPO.

## Job Registry

Future support for:

- successive-day rostering;
- workforce tag requirements;
- permit requirements;
- qualification requirements;
- public-holiday inclusion behaviour.

## Forward Planner / Workforce Allocator

Future support for:

- smart rotation through all eligible unallocated slots;
- random selection from an eligible candidate set according to preferences;
- clearer Booked terminology;
- consistent SVG iconography for requirements.

## Major future features

- mobile calendar;
- Outlook ICS export;
- staff/team leaderboard.

Do not build these now.

Use them to avoid closing Stage 1 with an obviously incompatible data design.

---

# 16. REVIEW STANDARD — EFFECTIVE IMMEDIATELY

The ChatGPT/Gemini development process is returning to the more rigorous Offline17-era peer-review standard.

A small incremental ZIP does **not** imply a superficial review.

Each peer review should, where relevant, examine:

## 16.1 Change inventory

Identify exactly which files changed and what responsibilities they own.

## 16.2 Architecture impact

Trace the changed code into adjacent modules and canonical contracts.

## 16.3 Developer claims vs independent verification

Do not accept close-out documents or test reports as proof by themselves.

Separate:

```text
claimed
observed in source
reproduced independently
not verified
```

## 16.4 End-to-end lifecycle

For persistence-affecting work, follow the data through:

```text
UI/action
→ state mutation
→ business validation
→ persistence envelope
→ schema validation
→ browser storage
→ reload
→ backup/export
→ restore/import
→ cache invalidation
→ subsequent business use
```

## 16.5 Failure paths

Examine the important failure mode, not only the happy path.

Examples:

- persistence rejection;
- malformed workspace;
- missing historical evidence;
- scheduler unavailable;
- unsupported schema;
- cache stale after workspace replacement.

## 16.6 Regression surface

Identify what existing behaviour could plausibly be affected.

## 16.7 Acceptance decision

Use an explicit status such as:

```text
Accepted
Provisionally accepted
Corrective work required
Release blocked
```

and state why.

---

# 17. TESTING CONSTITUTION

Testing must be **risk-based and change-specific**.

Do not repeatedly order the full test suite after every patch.

Required principle:

> Run the smallest test set that gives strong evidence for the changed contract and its realistic regression surface.

Examples:

### Pure CSS/layout change

Use focused UI/browser checks. Do not rerun persistence and scheduler suites without a concrete dependency.

### Eligibility change

Run focused eligibility/rostering tests and the specific integration paths that consume eligibility.

### Persistence/schema change

Run persistence tests plus application-level save/reload/backup/restore tests relevant to the modified domains.

### Scheduler/date-generation change

Run scheduler and affected rostering boundary tests. Use multi-year differential only where schedule generation could drift.

### Release/integration milestone

Run the complete agreed release regime once.

Tests added purely for obsolete legacy migration may be deleted when that behaviour is intentionally removed.

Do not weaken tests protecting the current canonical schema.

---

# 18. PEER-REVIEW PACKAGE CONSTITUTION

Incremental peer-review ZIPs must contain only files needed to review or integrate the current change.

Include:

- genuinely modified production files;
- genuinely modified tests;
- rebuilt standalone HTML only when affected or required to verify the build;
- concise change manifest;
- updated governing/handoff document only when changed.

Exclude:

- unchanged source files;
- unrelated tests;
- redundant historical documents;
- complete application trees merely for convenience.

A complete application ZIP is reserved for explicit integration/release milestones.

---

# 19. DOCUMENTATION & GOVERNANCE CONTRACT

Gemini must keep documentation truthful.

Do not state:

```text
Stage 1 complete
all gates passed
production ready
fully verified
```

unless independent peer review has actually accepted that state.

Developer-executed tests may be documented as:

```text
Developer-reported: PASS
```

Independent review may then record:

```text
Independently reproduced: PASS
```

These are different claims.

Future governance documents should distinguish:

- constitutional/invariant rules;
- current implementation contract;
- proposed future capabilities;
- historical decisions.

Do not turn brainstorm ideas into mandatory requirements without authorisation.

---

# 20. UI GOVERNANCE

The final targeted-UI stage has been moved to the end of the development sequence.

However:

> UI changes required by functional development are not “targeted UI changes”.

Examples:

- a new Workforce qualification editor requires UI in Stage 3;
- a Permits module requires UI when that module is implemented;
- smart rostering requires controls and feedback in its implementation stage;
- a workspace reset requires confirmation and reset UX in Stage 2.

Those changes must not be deferred merely because they affect the interface.

Stage 4 is for independent UI refinement and polish after the functional architecture is stable.

---

# 21. SPECIFIC STAGE 1 ENGINEERING TASK ORDER

Gemini should approach the remaining Stage 1 work in this order.

## Step 1 — Architecture inventory

Document the current workspace envelope, schema validator, persistence driver, migration/compatibility paths, backup/restore path, historical evidence path, rostering domains and application state ownership.

Output a concise current-state map before making broad deletions.

## Step 2 — Classify legacy code

For each migration/fallback/compatibility path, classify it using the A–H categories in Section 12.

Identify removal candidates and dependencies.

## Step 3 — Declare the canonical supported schema

State the exact current workspace contract that will survive Stage 1.

## Step 4 — Remove obsolete compatibility paths

Delete only verified legacy-only code and tests.

Unsupported old workspace versions must fail explicitly.

## Step 5 — Complete historical evidence lifecycle

Correct PR05 persistence, backup/restore, propagation and validation gaps using only the surviving canonical architecture.

## Step 6 — Establish future-extension contracts

Ensure the canonical Registry, Job, eligibility, scheduling and history models can support the known future requirements without implementing those features prematurely.

## Step 7 — Clean-install verification

Using empty application-owned storage:

1. start the application;
2. create the minimum new Job/Workforce data required for operation;
3. generate an occurrence;
4. allocate staff;
5. save;
6. reload;
7. verify the allocation and authoritative timing evidence;
8. export current-schema backup;
9. clear the active workspace;
10. restore the backup;
11. verify assignments, rostering provenance and historical evidence are restored correctly.

This should be implemented as focused verification, not a giant new end-to-end test harness unless one already exists.

---

# 22. STAGE 1 ACCEPTANCE CRITERIA

Stage 1 may be presented for independent close-out only when all of the following are true.

## Canonical architecture

- [ ] Exactly one supported workspace schema is declared.
- [ ] Current-schema validation is authoritative.
- [ ] Unsupported legacy schema versions are explicitly rejected.
- [ ] Obsolete migration/backwards-compatibility code has been removed or explicitly justified as still required.
- [ ] No hidden preserved-workspace dependency remains in normal application startup.

## Historical integrity

- [ ] Historical scheduled timing does not depend on mutable current Job definitions.
- [ ] Every committed assignment path that needs historical timing captures or preserves authoritative evidence.
- [ ] Fixed/Rotation propagation does not leave uncovered historical occurrences.
- [ ] Malformed historical evidence fails closed.
- [ ] Planned scheduled commitment is not misrepresented as actual work performed.

## Persistence

- [ ] Normal application save includes all canonical domains.
- [ ] Reload restores the complete canonical state.
- [ ] Backup/export preserves the complete supported workspace.
- [ ] Restore/import replaces active state without retaining unrelated previous workspace data.
- [ ] Persistence failure rolls back assignments, rostering and historical evidence together.

## Eligibility

- [ ] Existing overlap and 10-hour-rest rules remain canonical.
- [ ] All current rostering strategies consume canonical eligibility.
- [ ] Architecture provides one extension point for future tags, qualifications, permits and multiple unavailability periods.

## Scheduling

- [ ] Current occurrence identity is stable across year boundaries.
- [ ] No fixed 52-week assumption blocks future 53-occurrence years or successive-day scheduling.
- [ ] Current cross-year/rest/DST behaviour remains correct.

## Clean install

- [ ] Empty-storage startup succeeds.
- [ ] Client can construct operational Registry data from scratch.
- [ ] No seeded legacy Job/history is required for normal operation.
- [ ] Current-schema save/reload/export/restore works from a clean installation.

## Governance

- [ ] No future feature has been implemented merely because it was mentioned as a foundation.
- [ ] Incremental ZIP contains only necessary changed files.
- [ ] Tests executed are relevant to the changed contracts.
- [ ] Documentation does not claim independent approval before peer review.

---

# 23. OUT-OF-SCOPE FOR THE CURRENT STAGE 1 PASS

Unless a dependency makes a very small preparatory change unavoidable, do not implement:

```text
full Workforce Registry redesign
Tags editor UI
Qualification editor UI
Permits module UI
successive-day Job editor controls
smart rotation UX
random allocation UX
pools
exclusive staff
same-staff rostering
team rotation
leaderboard
mobile calendar
ICS export
SVG icon system
final standalone UI polish
```

Do not use this architecture reset as permission to expand the product.

---

# 24. REQUIRED NEXT DELIVERABLE FROM GEMINI

The next Gemini package should **not immediately implement all of Stage 1**.

First produce a focused architecture-audit and canonicalisation package/document that contains:

1. a current workspace/schema map;
2. a legacy-code classification table;
3. the proposed single canonical schema contract;
4. a list of exact legacy paths proposed for deletion;
5. a dependency/risk assessment for each deletion;
6. a map of the complete historical scheduled-commitment lifecycle;
7. identification of the PR05 findings that remain after legacy removal;
8. any small code changes that are strictly necessary to make the audit truthful;
9. a proposed focused test plan for the subsequent implementation package.

Do not delete large parts of persistence architecture until the audit establishes what is genuinely obsolete.

Return a minimal peer-review ZIP.

Stop for independent peer review.

---

# 25. FINAL GOVERNING PRINCIPLE

The development direction is now:

```text
remove unsupported history
without removing operational history

simplify persistence
without weakening integrity

create one canonical model
without prematurely implementing future features

make smart rostering extensible
without creating parallel eligibility logic

support a clean client handover
without carrying development-era baggage
```

That is the standard against which the remainder of Stage 1 will be reviewed.
