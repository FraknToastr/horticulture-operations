# AI Instructions
## Horticulture Operations Suite

**Version:** 1.4-draft

Read this file before any non-trivial source change.

## Source-of-truth hierarchy

1. `governance/PRODUCT_CONSTITUTION.md`
2. `governance/PRODUCT_CONTRACTS.md`
3. `governance/CANONICAL_MODEL.md`
4. `governance/DECISIONS.md`
5. `governance/UX_RULES.md`
6. `governance/RELEASE_GATES.md`
7. Current source code
8. Current development prompt

A lower-level source must not silently contradict a higher-level source.

## Mandatory pre-change report

```text
CHANGE IMPACT
Requested change:
Affected modules:
Affected canonical entities:
Affected workflows:
Affected contracts:
Affected lifecycle domains:
Persistence/schema impact:
Commercial-history impact:
Sidebar/UI-surface impact:
Scheduler ownership/routing impact:
Deletion/dependency impact:
Workspace-isolation impact:
Release gates affected:
Constitutional conflict: NONE / DETAILS
Proceed: YES / REQUIRES PRODUCT DECISION
```

## Implementation rules

- Make surgical changes; do not opportunistically redesign unrelated code.
- Do not create shadow business state.
- Do not bypass validation to make a workflow appear functional.
- Do not fuzzy-guess Rate Item IDs, parent IDs, statuses or migration relationships.
- Do not convert human decision boundaries into automatic actions without approval.
- Do not use module visitation/completion flags as substitutes for canonical business evidence.
- Quote Readiness governs Issue, not Draft Quote access/creation.
- Preserve issued/resolved commercial history.
- Preserve canonical IDs and lineage unless an approved migration explicitly changes them.
- The retired expandable/collapsible/undocked sidebar framework must not be resurrected.
- Location Register view and Project Polygon view must preserve their required full-size sidebar surfaces, including empty states.
- Scheduler Editor may receive only Jobs belonging to the active Register/Project.
- Calendar Jobs outside the active Register/Project remain inspectable by summary modal and must not be injected into Scheduler Editor.
- Active-project calendar-day signalling must derive from canonical Job ownership/status.
- Treat every Critical failure in `governance/RELEASE_GATES.md` as release-blocking.

## Milestone peer-review package

Every completed remediation milestone must produce a new peer-review ZIP before it is checkpointed or handed off. The ZIP must contain the complete runnable package, relevant tests, governance material, and preserved `Offline/ChatGPT Reviews/` history. Record its exact path, file count, SHA-256 digest, verification result, and test evidence in the milestone walkthrough or checkpoint. Do not overwrite a prior milestone ZIP.

## Mandatory post-change report

```text
CONSTITUTIONAL VERIFICATION
Requested change:
Files changed:
Contracts affected:
Contracts verified:
Canonical graph changed: YES / NO
Lifecycle changed: YES / NO
Persistence/schema changed: YES / NO
Human decision boundary changed: YES / NO
Commercial history semantics changed: YES / NO
Sidebar/UI-surface contract changed: YES / NO
Scheduler ownership/routing changed: YES / NO
Workspace isolation changed: YES / NO
Release gates exercised:
Unrequested behavioural changes: NONE / DETAILS
Known constitutional regressions: NONE / DETAILS
Known release blockers remaining:
Tests/validation performed:
```
