# HORTICULTURE OPERATIONS SUITE — F-01 TO F-09 REMEDIATION PROGRAM

You are working on the Horticulture Operations Suite reviewed as **v5.0.0**.

This is an implementation and release-readiness remediation program.

The source review identified nine findings, F-01 through F-09. Your task is to address them in a controlled sequence that protects the existing canonical business model and avoids broad refactoring before the release-blocking behavioural defects are resolved.

## PRIMARY RULE

**Do not redesign the canonical data model.**

The review found the core Register → Project → Task / Geometry / Job → Costing → Quote → Payment model to be one of the strongest parts of the application.

The principal problem is drift between:

- declared product contracts,
- executable governance,
- actual UI interaction paths,
- browser acceptance proof, and
- release packaging.

This remediation must therefore favour **surgical contract alignment before architectural cleanup**.

---

# FINDINGS IN SCOPE

## F-01 — CRITICAL
### PC-016 Scheduler routing contradiction

The Scheduler already determines whether a Job belongs to the active Project for presentation purposes, but the interaction path does not enforce that distinction.

Current behaviour routes calendar Jobs through the Scheduler Editor regardless of whether they belong to the active Project.

Required contract:

- Job belongs to active Project → normal Scheduler/Editor workflow.
- Job belongs to another Project → open the prescribed summary modal.
- Opening an other-project Job must **not** change the active Register or active Project context.

This is a direct business-contract contradiction.

---

## F-02 — CRITICAL
### PC-018 / PC-019 drawer viewport containment

The product contracts require accordion/drawer content to remain constrained to the usable viewport.

Required behaviour includes:

- the thick line representing the drawer floor must always remain visible;
- standard drawers extend from their row/header position to the available viewport bottom;
- excess content scrolls internally;
- the Register drawer has an exception:
  - it may grow naturally to accommodate its content;
  - it stops growing once its floor reaches the viewport bottom;
  - only then does internal scrolling begin;
- viewport/resolution changes must recalculate available height correctly.

Current source remains substantially intrinsic-height / `overflow:visible` based.

---

## F-03 — HIGH
### PC-017 active-project calendar-day signal absent

Scheduler Job cards distinguish active-project and other-project Jobs, but the day cells themselves do not expose the required active-project state.

Implement the PC-017 day-state signal from canonical data.

The signal must derive from:

- canonical Job `projectId`;
- the active Project;
- eligible Job status, specifically Draft/Scheduled as defined by the contract.

It must recompute from state rather than becoming independently persisted UI state.

---

## F-04 — CRITICAL GOVERNANCE GAP
### Executable product-contract registry stops at PC-015

The authoritative product-contract documentation contains PC-001 through PC-019.

The executable contract registry currently stops at PC-015.

Governance documentation is also inconsistent about the number of contracts.

Bring all governance representations into agreement.

PC-016 through PC-019 must become first-class executable contracts rather than prose-only rules.

Do not invent alternative wording where authoritative contract wording already exists.

---

## F-05 — HIGH / RELEASE INFRASTRUCTURE
### Documented portable launch command is broken

The package instructs the user to run:

`npm start`

but no `start` script exists.

A static server implementation already exists.

Repair the package so the documented launch path works as documented.

Do not replace the static-server architecture merely to repair this defect.

---

## F-06 — CRITICAL BUSINESS RULE
### PC-013 Quote Readiness not enforced at Issue

Draft quote creation is intentionally permissive and should remain so.

The problem occurs when a Quote is issued.

Current issue validation is materially weaker than PC-013.

Implement a central Quote Readiness evaluation that proves the required evidence exists before Issue.

This includes the contract-defined evidence classes for:

- Scope;
- Cost basis;
- Funding.

At Issue:

1. evaluate readiness against canonical source information;
2. provide actionable failure information if readiness is incomplete;
3. prevent Issue when mandatory readiness requirements fail;
4. create the required Issue-time readiness/evidence snapshot;
5. preserve existing Quote immutability and revision lineage.

Do not turn draft editing into an unnecessarily restrictive workflow.

---

## F-07 — MEDIUM
### Retired compact/floating sidebar CSS remains

Large CSS areas remain for sidebar behaviours that the current product no longer uses.

The regression suite indicates those behaviours are not active production mechanics.

Remove only code proven to be dead.

Do not perform opportunistic visual redesign while doing this.

Do not remove compatibility selectors until source and regression evidence establishes that they are unused.

---

## F-08 — EVIDENCE / RELEASE-PROOF GAP
### Browser acceptance suite is not reproducible from the supplied package

The Node regression suite passes.

The browser test specifications exist, but the supplied package did not contain a locally runnable browser-test environment.

The final remediation package must make browser acceptance reproducible.

The objective is not merely to say that Playwright tests exist.

A clean checkout/package must have a documented and reproducible method to execute the browser suite.

---

## F-09 — MEDIUM / STRUCTURAL RISK
### Change concentration in monolithic browser modules

Particularly large mutable modules include:

- `register.js`
- `model.js`
- `program-map.js`

Do **not** respond to this finding with a rewrite.

The required strategy is gradual facade-preserving decomposition.

Existing public interfaces such as the relevant `UOS.*` APIs should remain stable while responsibilities are extracted behind them.

F-09 must not destabilise the release-blocking remediation.

---

# REQUIRED PRIORITY MODEL

Treat severity and implementation order as related but not identical.

Use the following remediation sequence.

---

# STAGE 0 — RESTORE THE RELEASE/TEST HARNESS

## Priority: P0 enabling work

Address:

### F-05 — portable launch contract
### F-08 — reproducible browser acceptance environment

Do these first because subsequent browser-level remediation requires trustworthy execution and proof.

### Stage 0 requirements

#### F-05
Wire the existing static server into the documented `npm start` command.

Prove:

- `npm start` launches the application;
- the documented URL/path is correct;
- no unnecessary server architecture change was introduced.

#### F-08
Make the browser suite reproducible from the supplied repository/package.

Prefer normal package-managed developer dependencies and documented commands.

Prove from a clean dependency installation that:

- Node regression tests run;
- browser tests can run;
- test setup does not depend on an undocumented globally installed executable.

### Stage 0 checkpoint

STOP and report:

- files changed;
- exact commands used;
- Node suite result;
- browser suite launch result;
- any existing browser failures discovered before application remediation.

Do not conceal pre-existing failures by modifying tests.

---

# STAGE 1 — RESTORE GOVERNANCE AS AN IMPLEMENTATION GUARDRAIL

## Priority: P0 governance

Address:

### F-04 — executable registry drift

Synchronise:

- authoritative Product Contracts;
- executable contract registry;
- governance README/documentation;
- any diagnostics or contract-count assumptions.

Add PC-016, PC-017, PC-018 and PC-019 to the executable registry using the authoritative definitions.

Where practical, introduce automated assertions that prevent the prose contract set and executable registry from silently diverging again.

### Important

This stage must not implement the UI behaviours yet.

Its purpose is to ensure that the codebase's executable governance knows about the contracts that the following stages will implement.

### Stage 1 checkpoint

Demonstrate:

- PC-001 through PC-019 are represented consistently;
- contract IDs are unique;
- existing contract tests still pass;
- governance counts and versions are internally coherent.

---

# STAGE 2 — FIX DIRECT USER-CONTEXT AND VIEWPORT CONTRACT VIOLATIONS

## Priority: P0 release blockers

Address:

### F-01 — PC-016 Scheduler routing
### F-02 — PC-018 / PC-019 drawer geometry

These are the highest-priority behavioural corrections.

They are direct contradictions between declared user experience and production code.

---

## Stage 2A — F-01 Scheduler routing

Implement one authoritative routing decision.

The Scheduler must branch according to canonical Project ownership.

### Required behaviour

**Active-project Job**
→ existing active-project Scheduler workflow.

**Other-project Job**
→ summary modal.

For the other-project modal path:

- do not mutate active Register;
- do not mutate active Project;
- do not silently enter Scheduler Editor under the wrong context;
- preserve enough Job/Project context for the user to understand what they selected.

Add focused regression/browser coverage for both branches.

Include a test proving that selecting an other-project card leaves active context unchanged.

---

## Stage 2B — F-02 drawer containment

Create a shared viewport-height/geometry mechanism rather than separate arbitrary fixes in every module.

The implementation should calculate usable vertical space from the expanded row/drawer header to the usable viewport bottom.

### Standard drawer

Use the available bounded height.

Overflow belongs to an inner scrolling content region.

The thick drawer floor/bottom border must remain outside that scroller and always remain visible.

### Register drawer exception

Use conceptually:

`min(intrinsic content height, available viewport height)`

Therefore:

- short Register content grows only as far as necessary;
- longer content may continue downward naturally;
- once the viewport floor is reached, the drawer stops growing;
- content thereafter scrolls internally;
- the thick floor remains visible.

Prove at multiple viewport sizes.

Do not hard-code behaviour for one 1920×1080 display.

---

## Stage 2 checkpoint

Run:

- Node tests;
- relevant browser tests;
- PC-016 acceptance proof;
- PC-018 acceptance proof;
- PC-019 Register exception proof.

Do not proceed merely because the implementation “looks right”.

---

# STAGE 3 — COMPLETE THE REMAINING BUSINESS-CONTRACT BEHAVIOUR

## Priority: P1

Address:

### F-03 — PC-017 Scheduler day signalling
### F-06 — PC-013 Quote Readiness

These are important business-contract gaps, but should be implemented after the more direct Stage 2 contradictions are stabilised.

---

## Stage 3A — F-03

Derive active-project day state from canonical Jobs on every relevant render/update.

Do not persist a separate day-state flag that can diverge from Job data.

Test at least:

- no active-project Jobs;
- Draft active-project Job;
- Scheduled active-project Job;
- only another Project's Job;
- mixed active/other Project Jobs;
- Job status change;
- Job movement to another date;
- active Project change.

---

## Stage 3B — F-06

Implement PC-013 Quote Readiness as a central domain/business rule.

Avoid spreading readiness checks through individual UI controls.

The Issue command should call one authoritative readiness evaluator.

The evaluator should return structured evidence/results usable by both UI and tests.

At successful Issue, persist the required readiness snapshot.

Protect existing behaviour for:

- draft creation;
- issued quote immutability;
- supersession/revision lineage;
- payment attachment to exact quote revisions.

---

## Stage 3 checkpoint

Prove:

- PC-017 state responds correctly to canonical changes;
- incomplete Quotes remain editable as Drafts;
- incomplete Quotes cannot Issue;
- valid Quotes can Issue;
- Issue stores the required evidence/readiness snapshot;
- existing Quote immutability/revision/payment tests still pass.

---

# STAGE 4 — RELEASE PROOF

## Priority: P0 release gate

Before cleanup work, execute the complete proof suite.

At minimum include the equivalent applicable release gates for:

- Quote Readiness;
- Scheduler routing;
- active-project calendar-day signal;
- standard drawer viewport containment;
- Register drawer viewport exception;
- browser acceptance;
- existing Node regression suite.

Treat test failures as evidence to investigate, not tests to weaken.

Do not alter expected behaviour merely to make a test green unless the test demonstrably contradicts the authoritative contract.

Produce a clear release-gate matrix:

| Contract/Gate | Evidence | Result | Notes |
|---|---|---|---|

At this checkpoint determine whether the release-blocking portion of the work is complete.

---

# STAGE 5 — SAFE DEAD-CODE REMOVAL

## Priority: P2

Address:

### F-07 — retired sidebar CSS

Only begin this after release-blocking behaviour is passing.

Identify compact/floating/undocked/sidebar selectors that are genuinely unreachable.

Before deletion:

- search HTML;
- search JavaScript;
- search CSS composition;
- search tests;
- search dynamic class construction;
- search governance references.

Remove in small groups.

Run visual/browser regression tests after each logical removal.

This stage must produce **no intended UI change**.

Do not redesign the sidebar.

---

# STAGE 6 — CONTROLLED STRUCTURAL DECOMPOSITION

## Priority: P2 / continuing engineering improvement

Address:

### F-09 — monolithic module concentration

This is intentionally last.

Do not undertake F-09 until the business-contract remediation is passing.

Do not combine F-09 refactoring with F-01, F-02, F-03 or F-06 behavioural changes.

### Strategy

Use facade-preserving extraction.

Existing consumers should continue calling the same stable public interfaces.

New focused modules may sit behind those facades.

### Recommended order

#### 1. `model.js` first

Extract cohesive canonical/domain responsibilities while retaining the existing ProgramModel/public API as a compatibility facade.

Potential boundaries should follow actual source responsibilities, for example:

- Register/Application operations;
- Project operations;
- Task operations;
- Job operations;
- commercial/Quote operations;
- validation/selectors.

Do not create arbitrary files merely to reduce line count.

A module boundary must represent a meaningful responsibility.

#### 2. `register.js` second

Separate progressively:

- state/selectors;
- domain actions;
- rendering;
- drawer/disclosure UI;
- event wiring/orchestration.

Rendering code should not become an alternative business-rule engine.

#### 3. `program-map.js` last

Extract only natural map responsibilities such as:

- map state/context;
- Register Locations;
- Project Geometry;
- geometry editing;
- inspector/sidebar presentation;
- camera/navigation behaviour.

Map behaviour is interaction-heavy and should be decomposed cautiously.

### F-09 governing rule

Every extraction must satisfy:

**same behaviour + same external contract + stronger isolation**

Do not accept:

**large rewrite + assumed equivalence**

Add characterization/regression tests before moving behaviour where existing coverage is inadequate.

---

# NON-NEGOTIABLE IMPLEMENTATION RULES

1. **No canonical-model rewrite.**

2. **No mass refactor while repairing F-01 through F-06.**

3. **Do not merge distinct lifecycle/state machines into one universal status system.**

4. **Do not introduce duplicated state when a value can be derived from canonical data.**

5. **Do not make Draft Quote creation restrictive merely to implement Issue readiness.**

6. **Do not permit another-project Scheduler interactions to silently change active business context.**

7. **Do not solve drawer overflow by hiding the bottom border/floor.**

8. **Do not modify tests simply to accommodate defective implementation.**

9. **Do not remove CSS merely because its selector looks old; prove it is unreachable.**

10. **Do not decompose large files according to line-count targets. Decompose by business or UI responsibility.**

11. Preserve browser-storage compatibility and existing migrations unless a finding explicitly requires a schema change.

12. Preserve existing public APIs wherever feasible.

---

# CHANGE CONTROL

Work in small, reviewable stages.

For every stage provide:

## Before implementation
- files expected to change;
- contracts/findings being addressed;
- likely regression surfaces;
- tests that will prove success.

## After implementation
- exact files changed;
- concise explanation of each change;
- tests executed;
- results;
- unresolved observations;
- whether any new contract/governance discrepancy was discovered.

Do not silently expand scope.

If you discover a defect unrelated to F-01 through F-09:

- document it;
- classify its severity;
- explain whether it blocks the current stage;
- do not automatically redesign adjacent systems.

---

# REQUIRED FINAL REPORT

At completion, produce a matrix covering every finding:

| Finding | Initial severity | Stage | Resolution | Automated proof | Browser proof | Remaining risk |
|---|---|---|---|---|---|---|
| F-01 | Critical | 2 | | | | |
| F-02 | Critical | 2 | | | | |
| F-03 | High | 3 | | | | |
| F-04 | Critical governance | 1 | | | | |
| F-05 | High | 0 | | | | |
| F-06 | Critical | 3 | | | | |
| F-07 | Medium | 5 | | | | |
| F-08 | Evidence gap | 0/4 | | | | |
| F-09 | Medium | 6 | | | | |

Also state one of:

- **RELEASE GATES SATISFIED**
- **RELEASE REMAINS BLOCKED**

with evidence.

---

# EXECUTION ORDER SUMMARY

Follow this sequence:

**Stage 0**
F-05 → F-08  
Restore launch and browser-test reproducibility.

**Stage 1**
F-04  
Synchronise executable governance before relying on it as a guardrail.

**Stage 2**
F-01 → F-02  
Repair the direct Scheduler-context and drawer-viewport contract violations.

**Stage 3**
F-03 → F-06  
Complete Scheduler signalling and Quote Readiness.

**Stage 4**
Full release proof  
Node + browser + applicable release gates.

**Stage 5**
F-07  
Remove proven dead sidebar CSS without visual redesign.

**Stage 6**
F-09  
Begin gradual facade-preserving decomposition, starting with `model.js`.

Do not collapse these stages into one broad change set.

The desired outcome is not merely “all nine findings changed”.

The desired outcome is:

**business-contract alignment restored, release proof reproducible, and structural risk reduced without destabilising the canonical model.**