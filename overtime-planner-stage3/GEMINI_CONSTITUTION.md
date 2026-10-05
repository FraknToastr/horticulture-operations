# HORTICULTURE OVERTIME PLANNER
## GEMINI DEVELOPMENT CONSTITUTION

**Status:** Governing document  
**Applies to:** All Gemini-led development, remediation, refactoring, UI work, smart rostering work, testing, migration, and release preparation  
**Priority:** This document overrides convenience, stylistic preference, speculative redesign, stale documentation, and attempts to preserve historical test totals at the expense of correct business behaviour.

---

# 1. PURPOSE

This Constitution exists to prevent:

- development drift;
- UI regressions;
- hidden changes to business behaviour;
- speculative reinterpretation of requirements;
- broad rewrites during narrow corrections;
- destructive persistence changes;
- reintroduction of deliberately removed features;
- special-case code added merely to make tests pass;
- silent automation that removes operator control;
- inconsistent implementations of the same business rule;
- deterioration of an already mature and hardened application.

The Horticulture Overtime Planner is now a mature standalone operational planning application entering a phase of:

- UI refinement;
- workflow improvement;
- assisted rostering;
- smarter allocation;
- long-range planning support.

It is **not** an early prototype requiring wholesale redesign.

---

# 2. AUTHORITY HIERARCHY

When requirements appear to conflict, Gemini must use this order of authority:

1. **Explicit current user instruction**
2. **This Constitution**
3. **Approved Governance Framework**
4. **Established canonical business contracts**
5. **Verified current application behaviour**
6. **Current regression tests**
7. **Current source comments/documentation**
8. **README and historical documentation**

README content is not automatically authoritative.

A stale README must never override explicit product direction or verified current behaviour.

---

# 3. APPLICATION SHAPE IS INTENTIONAL

The application is deliberately:

- Vanilla HTML;
- Vanilla CSS;
- Vanilla JavaScript;
- modular in source;
- capable of portable offline operation;
- capable of running without a live local server;
- persisted through hardened browser storage plus backup/export.

Gemini must not introduce:

- React;
- Vue;
- Angular;
- another frontend framework;
- server dependence;
- cloud database requirements;
- authentication systems;
- enterprise platform dependencies;

unless explicitly instructed.

The modular source is authoritative.

Any generated portable/single-file output is a **distribution artifact**, not the source authority.

---

# 4. BUSINESS TRUTH OVERRIDES HISTORICAL TEST TOTALS

Regression totals are evidence, not business law.

Gemini must never:

- introduce a named Job exception;
- weaken validation;
- suppress legitimate shifts;
- alter recurrence;
- manipulate seed data;

merely to preserve a historical row count, cost, or test expectation.

The Whitmore Square exception is the canonical example of behaviour that must never recur.

Correct principle:

> Business rules + coherent source data determine the baseline.

Not:

> The previous baseline determines which business rules apply.

---

# 5. NO NAMED-ENTITY EXCEPTIONS IN GENERIC DOMAIN RULES

Generic validation and scheduling rules must not contain logic such as:

```text
all Jobs follow rule X
except Job ABC
```

unless the exception is an explicit and documented business rule approved by the user.

Named fixtures, seeded Jobs, or awkward historical records must not receive secret runtime privileges.

If data contradicts a rule:

- correct the source data when intent is known;
- migrate it explicitly if historical compatibility is required;
- report the ambiguity if intent is unclear.

Do not corrupt generic logic to accommodate one record.

---

# 6. AMBIGUITY MUST NOT BE INVENTED AWAY

If business intent cannot be determined from:

- explicit user direction;
- current code;
- authoritative source data;
- established contracts;

Gemini must not silently choose an interpretation.

Gemini must:

1. identify the ambiguity;
2. explain the viable interpretations;
3. quantify their impact where possible;
4. preserve existing data safely;
5. avoid presenting an assumption as canonical fact.

A technically convenient assumption is not business authority.

---

# 7. CANONICAL SHIFT IDENTITY

Operational shift identity is:

```text
shiftId = jobId@YYYY-MM-DD
```

Identity comparisons must be explicit and safe.

Gemini must never rely on:

```javascript
undefined === undefined
```

to infer that two entities are the same.

An identity comparison is valid only when required identifiers actually exist.

Missing canonical IDs must be:

- rejected;
- reported;
- or handled through an explicit legacy/migration rule.

They must not silently create false identity.

---

# 8. EXPLICIT OCCURRENCES HAVE DEFINED PRECEDENCE

Where generated recurrence and an explicit occurrence represent the same canonical shift:

> The explicit occurrence wins.

Do not create duplicate operational shifts.

Do not fix duplicate generation by deleting arbitrary rows after generation.

Correct the precedence/generation path.

---

# 9. PAST ACTUALS AND FUTURE PLANS ARE DIFFERENT

Canonical principle:

> Preserve historical truth. Validate future plans against current rules.

Historical assignments may remain attached to a person who later becomes:

- departed;
- inactive;
- unavailable;
- exempt.

Future work must obey current eligibility.

Gemini must not rewrite history merely to make current validation clean.

---

# 10. ONLY EXPLICITLY ACTIVE JOBS GENERATE FUTURE WORK

Future operational work must fail closed.

Only an explicitly schedulable/Active Job may create future work.

Missing or unknown status must never imply Active.

This applies consistently to:

- recurring generation;
- annual generation;
- one-off scheduling where applicable;
- future explicit occurrences;
- projections.

Do not create separate definitions of "active" in different modules.

---

# 11. WORKFORCE ELIGIBILITY FAILS CLOSED

Unknown employment state must never become Active by default.

Supported workforce states must be explicit.

Hard eligibility includes, where applicable:

- employment status;
- overtime exemption;
- availability;
- overlapping assignments;
- Team restrictions;
- exclusive staff restrictions;
- Plant Operator requirements;
- other established hard constraints.

Malformed workforce data must not silently increase eligibility.

---

# 12. HARD CONSTRAINTS AND SOFT PREFERENCES MUST REMAIN SEPARATE

This principle is mandatory for future smart rostering.

## Hard constraints determine whether a person may be assigned.

Examples:

- departed;
- inactive;
- exempt;
- overlapping work;
- exclusive Team;
- exclusive Staff;
- required qualification;
- Plant Operator requirement.

## Soft preferences rank people who are already eligible.

Examples:

- Same Staff;
- rotation fairness;
- preferred Team;
- preferred Pool;
- recently rostered;
- continuity.

A ranking strategy must never turn an ineligible employee into an eligible employee.

---

# 13. SMART ROSTERING MUST BE EXPLAINABLE

Future rostering intelligence must be:

- deterministic where practical;
- explainable;
- auditable;
- testable;
- operator-controlled.

Do not implement opaque random allocation as the primary rostering strategy.

Given the same state and strategy, recommendations should normally be reproducible.

Smart rostering should be able to explain:

```text
Selected because...
Skipped because...
```

---

# 14. SMART ROSTERING IS ASSISTANCE, NOT SILENT AUTHORITY

Future features such as:

- Same Staff;
- Rotate Individuals;
- Rotate Teams;
- Pools;
- Exclusive Staff;
- replacement recommendations;

must not silently rewrite committed rosters.

Preferred workflow:

```text
detect
→ recommend
→ explain
→ operator applies
```

Automatic mutation must only occur where the user has explicitly invoked an Auto-Fill/Apply action whose behaviour is clear.

---

# 15. PLANT OPERATOR IS A CREW-LEVEL CONTRACT

Where a shift requires a Plant Operator, the crew must contain at least one employee who is:

- assigned;
- currently eligible;
- flagged as a Plant Operator.

A fully staffed crew can still be invalid.

Gemini must not reduce:

```text
crew size satisfied
```

to:

```text
crew valid
```

Forward Planner and future rostering tools must preserve this distinction.

---

# 16. EXCLUSIVE TEAM IS A HARD RULE

If a Job has an Exclusive Team:

> staff outside the permitted Team are not eligible for that Job.

Do not weaken this because another employee is available.

---

# 17. EXCLUSIVE STAFF WILL ALSO BE A HARD RULE

When introduced, Exclusive Staff must restrict the candidate universe.

Likely model:

```text
exclusiveStaffIds
```

An employee must be:

```text
in exclusiveStaffIds
AND
otherwise eligible
```

Exact interaction with Exclusive Team must be explicitly defined before implementation.

Do not invent OR/AND semantics.

---

# 18. POOLS DO NOT OVERRIDE ELIGIBILITY

Future Rostering Pools may contain:

- individual employees;
- Teams;
- combinations of individuals and Teams.

A Pool defines a candidate source.

It does not make an otherwise ineligible person eligible.

---

# 19. UI CONTINUITY IS A PRODUCT CONTRACT

Gemini must treat established UI behaviours as contracts, not suggestions.

Do not perform visual redesign during unrelated logic work.

Do not make "clean-up" UI changes without instruction.

Do not change layout, interaction style, wording, component placement, or navigation simply because Gemini prefers an alternative.

---

# 20. PROTECTED UI CONTRACT — JOB REGISTRY

The Job Registry is intentionally:

> table based.

Do not convert it to a card-based registry.

Row → inspector/drawer interaction is intentional.

---

# 21. PROTECTED UI CONTRACT — FORWARD PLANNER

Do not reintroduce removed:

```text
+ Sat
+ Sun
```

controls.

Their absence is deliberate.

Do not classify their absence as a defect based on stale documentation.

---

# 22. PROTECTED UI CONTRACT — MODALS

Modal behaviour is now canonical.

When a modal is open:

- background content must not scroll;
- modal body must scroll internally where needed;
- header/footer must remain accessible;
- wheel/touch scrolling at modal boundaries must not chain to the background;
- closing the modal must restore the previous background position;
- closing Job Editor must not unexpectedly close the Job drawer.

This must be regression-tested after modal/CSS work.

---

# 23. UI REGRESSIONS ARE DEFECTS

If a requested change works logically but causes:

- lost scrolling;
- hidden controls;
- content off-screen;
- broken focus;
- incorrect drawer position;
- missing warnings;
- background scroll leakage;
- collapsed layout problems;
- mobile/short-view accessibility failure;

the change is not complete.

---

# 24. PERSISTENCE IS FAIL-CLOSED

Canonical persistence principle:

```text
READ:
invalid → never adopt

WRITE:
invalid → never persist
```

No user data:

```text
→ defaults allowed
```

Existing user data that is corrupt, unsupported, or unsafe:

```text
→ Recovery Required
```

Never treat those two cases as equivalent.

---

# 25. RECOVERY MUST NEVER DESTROY THE SOURCE

Recovery handling must not:

- overwrite failed persisted state;
- shadow it with defaults;
- roll back silently to stale data;
- delete the only recoverable source;
- claim success before durable persistence is verified.

Successful deliberate restore may clear Recovery Required.

---

# 26. MIGRATION MUST BE EXPLICIT

Canonical current workspace is Schema 2.

Legacy Schema 1:

```text
→ explicit migration
→ validation
→ canonical Schema 2
→ persistence
```

Unsupported future schema:

```text
→ reject
```

`saveWorkspace()` is not a migration engine.

Never relabel an unsupported envelope as the current schema merely to make it pass validation.

---

# 27. SECURITY IS CONTEXT-SPECIFIC

Imported/user-controlled values must be treated according to output context.

HTML text:

```text
→ HTML escaping
```

HTML attributes:

```text
→ attribute escaping
```

Executable JavaScript:

```text
→ do not interpolate arbitrary user data
```

Prefer:

```text
data-* attributes + event listeners
```

over embedding imported text inside inline JavaScript handlers.

---

# 28. NO BROAD REWRITE DURING A SURGICAL CHANGE

If the request is:

```text
fix one overlap comparison
```

Gemini must not also:

- redesign Forward Planner;
- replace persistence;
- refactor all global state;
- change recurrence;
- reorganise unrelated modules.

Scope discipline is mandatory.

---

# 29. TESTS MUST PROVE CONTRACTS, NOT IMPLEMENTATION PREFERENCES

Tests should prove things like:

- no duplicate shift IDs;
- hard constraints cannot be bypassed;
- invalid workspace cannot be saved;
- modal background cannot scroll;
- explicit occurrence precedence works;
- malformed identity cannot falsely match;
- future non-active Jobs do not schedule.

Do not write tests whose primary purpose is preserving an arbitrary total that no longer reflects correct business data.

---

# 30. COMPLETION CLAIMS REQUIRE EVIDENCE

Gemini must not claim:

```text
fixed
complete
release ready
100%
```

based only on code inspection.

Important changes require evidence such as:

- automated test output;
- browser interaction result;
- before/after counts;
- calculated schedule;
- explicit regression proof.

If a test was not executed, say so.

---

# 31. CURRENT DEVELOPMENT PHASE

The project is transitioning from:

```text
Integrity Hardening
```

to:

```text
UI Refinement + Assisted Rostering
```

Gemini should therefore default toward:

- preserving architecture;
- improving usability;
- adding explicit rostering strategies;
- strengthening operator decision support;

rather than reopening stable core systems.

---

# 32. CONSTITUTIONAL AMENDMENT

Gemini cannot unilaterally amend this Constitution.

A conflict between this Constitution and a new explicit user instruction must be reported.

The user's explicit current direction may supersede an existing rule.

When that occurs:

1. identify the affected constitutional clause;
2. explain the impact;
3. implement the user's instruction;
4. recommend updating this Constitution so future Gemini sessions receive the new canon.

---

# FINAL CONSTITUTIONAL RULE

When uncertain whether a proposed change is acceptable, apply this test:

> Does this preserve established business integrity, operator control, data safety, and intentional UI behaviour while making only the change that was actually requested?

If the answer is not clearly yes, do not silently proceed.