# Stage 4F checkpoint — absence impact and one-off replacement review

Date: 6 October 2026
Status: complete locally. Stage 4 roadmap work is complete through 4F; stop before any post-Stage 4 increment until the owner resumes it.

## Owner-approved policy

- Review only saved future occurrences inside a newly added or changed absence date range.
- Keep each affected assignment visible until the operator reviews the impact.
- Propose a replacement under the approved pool, team, eligibility, fatigue and overtime-hours policy.
- Apply an approved replacement as a one-off manual assignment. Do not change the original fixed or rotation instruction or its later scope.
- Allow the operator to save the absence without a replacement; the affected assignment then remains visible as an unresolved conflict for manual action.
- Regular working hours remain excluded from entry, review and calculation.

## Implemented behavior

Saving a staff absence now checks the detached working absence ledger against its modal baseline. Added and amended intervals are matched to saved future assignment occurrences. The review lists the date and job, affected person, assignment type, instruction identity when present, proposed replacement, or shortage explanation.

Replacement selection reuses the Stage 4D hours allocator against the proposed absence ledger. Unknown verified overtime hours remain unknown and cannot win an hours comparison. All existing pool, team, qualification, plant-operator, overlap and fatigue checks remain active.

Opening and refreshing the review performs no write. Approval re-reads verified committed storage and recomputes the exact proposal signature. Stale workspace or form changes fail closed. A successful approval commits the absence/refusal ledgers, assignments, rostering provenance and scheduled commitment snapshots through the canonical transaction.

For each replacement, the displaced active provenance is embedded in the new manual replacement provenance because canonical active provenance may only reference assigned staff. Fixed and rotation instructions remain unchanged. The replacement record retains the displaced staff ID, absence ID, slot, prior evidence and explicit Stage 4F origin.

The **Save absence only** action uses the existing guarded absence transaction and leaves the saved assignment unchanged. This deliberately preserves the visible conflict rather than silently removing or replacing the person.

## Verification completed

- Stage 4F focused browser suite: seven groups passed.
- Covers exact absence-range detection, fixed-assignment labeling, lowest-hours eligible replacement, zero-write review, stale-signature rejection, atomic save/reload, unresolved shortage, absence-only save and read-only ownership denial.
- Stage 4D hours allocation: 15 groups passed.
- Stage 4E bounded mixed-policy planning: nine groups passed.
- Stage 3 browser smoke: all seven checks passed.
- Retained release runner: all 24 suites passed.
- Writer domain handoff and runtime qualification commands exited 0.
- Modular build succeeded; `index.html` and `dist/hort_ops_offline_planner.html` are byte-identical.
- A 375 px review capture and machine-readable focused result were generated only under ignored `test_reports/stage4f/`; they are not transport artifacts.

## Boundaries

- The review does not alter historical occurrences.
- Deleted absence intervals do not generate replacement work.
- A no-replacement save leaves the original assignment present and visibly conflicting; it does not certify that occurrence as safely staffed.
- There is no payroll integration or regular-hours model.
- No peer-review archive or evidence package was generated.
- This checkpoint does not authorize commit, push, branch update, publication, an independent Review 65 verdict or expanded runtime certification.
