# Post-Stage 4 roadmap — solver-based rostering and extended operations

Date: 6 October 2026
Status: planning only. No post-Stage 4 implementation is authorised by this document.

## Outcome

Add an explainable, operator-controlled rostering assistant that can evaluate a bounded planning horizon and recommend staffing choices without bypassing current absence, qualification, fatigue, rest, pool/team, plant-operator, commitment-history, writer-ownership or persistence safeguards.

The work separates four concerns so that a recurrence change does not silently change rostering policy:

1. A solver proposes alternatives against canonical occurrence data.
2. An adjacent-day rule becomes an explicit policy with a narrow, auditable override.
3. Holiday-triggered jobs become explicit recurrence rules rather than an implicit side effect of holiday inclusion.
4. Longer weekday and consecutive-day jobs become an explicit operational pattern with fatigue and coverage review.

## Non-negotiable constraints

- Existing manual assignments, historical commitments and unrelated fixed/rotation provenance remain protected.
- The canonical eligibility, qualification, absence, overlap, ten-hour rest, fatigue, crew and plant-operator checks remain hard constraints. A solver cannot waive them.
- Regular working hours remain out of scope unless the owner later changes that policy.
- Every proposal is detached and zero-write until an operator approves a specific delta.
- Each apply action revalidates saved state, writer ownership, policy version, affected occurrences and candidate eligibility immediately before the canonical commit.
- A shortage is a valid result. The solver must explain infeasibility instead of fabricating coverage.
- No cloud service, remote optimisation API or unreviewed runtime dependency may be introduced. Any local dependency needs a separate offline feasibility and licensing decision.

## Delivery sequence

| Increment | Scope | Deliverable | Exit gate |
| --- | --- | --- | --- |
| 5A — solver feasibility | Measure representative horizon sizes and constraint density; compare a small deterministic in-client search with offline-capable solver options. | Technical decision record, benchmark fixtures, dependency/licensing decision and maximum supported horizon. No production scheduling changes. | Repeatable measurements show a bounded solution path; owner selects the solver approach. |
| 5B — read-only solver preview | Translate saved occurrences and canonical hard checks into a pure input model. Produce ranked alternatives, shortages and constraint explanations for a small horizon. | Review-only Solver Plan modal, deterministic signatures and no-write browser/model tests. | Same input yields the same result; every selected person passes canonical validation; infeasibility names blocking constraints. |
| 5C — controlled solver application | Add an exact delta preview and explicit approval for selected recommendations only. | Atomic operator-controlled commit through current commitment planner and evidence retention checks. | Stale plans fail closed; manual/historical/unrelated assignments remain unchanged; reload preserves accepted deltas. |
| 5D — adjacent-day policy | Add an explicit adjacent-day restriction and a scoped override record. | Policy fields, canonical validation, candidate reasons, review UI and audit provenance. | Default rule, override authority, reason, expiry/scope and collision with rest/fatigue are all tested. |
| 5E — holiday-triggered recurrence | Add named holiday triggers and offsets as a recurrence type. | Schema, Job Registry controls, occurrence generation, holiday provenance and cross-year tests. | Observed versus actual holiday policy is explicit; collisions deduplicate; excluded dates win; year crossings retain identities. |
| 5F — extended operational patterns | Expand weekday/consecutive-day patterns only after fatigue and coverage behavior is defined. | Explicit maximum run policy, per-day occurrence materialisation, crew handling and solver integration. | Longer runs materialise one canonical occurrence per day, preserve commitment history and surface safety/coverage shortages. |
| 5G — integrated operational horizon | Let the approved solver consume adjacent-day, holiday-triggered and extended-pattern constraints together. | Bounded multi-job review workflow and regression/performance evidence. | No constraint is weakened when combined; runtime remains within the approved offline horizon. |

Each increment ends with a checkpoint and stops until the owner resumes the next one.

## 5A: solver feasibility decision

The feasibility work should use saved, anonymised fixture shapes rather than live operator data. Measure jobs, daily occurrences, required crew, qualified candidates, plant-operator requirements, absences, fixed/rotation/manual commitments and cross-year boundaries.

Candidate approaches to evaluate:

- A deterministic bounded branch-and-bound search written in the existing offline JavaScript style.
- A bundled local constraint solver, only if its browser/offline footprint, license, reproducible build and deterministic behavior are acceptable.

The decision record must select one approach and declare:

- maximum jobs, occurrences, candidates and planning days per request;
- cancellation/time budget behavior;
- deterministic tie-breaking order;
- input/output schema and versioning;
- evidence required when no feasible plan exists;
- fallback behavior when the solver exceeds its budget.

The fallback is a clearly labelled incomplete proposal, never a partial silent allocation.

## Solver model and objectives

The solver input is a detached snapshot of canonical occurrences, saved assignments, workforce, policy settings and verified overtime evidence. It does not read or write storage itself.

Hard constraints, in order, include active employment, absence, overtime exemption, job pool/team source, qualifications, plant-operator crew requirement, overlap, physical rest, fatigue hard blocks, crew capacity, fixed/rotation ownership and protected manual/history records.

Soft objectives are lexicographic and must remain visible in the plan:

1. Maximise safely filled required crew positions.
2. Prefer policy-compliant pools and teams.
3. Avoid higher fatigue tiers and reduce consecutive-weekend burden.
4. Apply the approved overtime-hours ordering among otherwise equal candidates.
5. Use stable staff-ID ordering as the final deterministic tie-breaker.

The preview must show why each selected person won and why each unfilled position could not be safely staffed. It must also show alternatives rejected because of a hard rule, not merely the winning answer.

## Adjacent-day restrictions and overrides

This rule is not implied by the existing ten-hour rest rule. Before 5D, the owner must choose:

- Whether the restriction means calendar-day adjacency, operational-day adjacency, or a specific day-of-week pairing.
- Which assignments it applies to: all overtime, selected job classes, only an employee's own prior/next assignment, or crew-wide coverage.
- Whether it is a hard block or a warning in each case.
- Who may create an override, required reason text, expiry, and whether it applies to one occurrence or an explicit bounded series.
- How it interacts with an existing rest/fatigue hard block. An override must never waive a mandatory safety rule.

The persisted override should identify the staff member, occurrence(s), rule version, author, reason, recorded time and expiry. Deletion or expiry must revalidate future assignments and surface conflicts without rewriting history.

## Holiday-triggered recurrence

The current public-holiday inclusion flag is insufficient for jobs such as “the Monday after a public holiday” or “the Friday before a named holiday.” The new rule should use an explicit trigger object rather than adding special values to the legacy weekday field.

The owner must settle:

- jurisdiction and holiday calendar authority;
- actual-date versus observed-date behavior;
- supported trigger relations, such as on holiday, N days before, N days after, first operational weekday after, or named holiday only;
- collision handling when several triggers or a normal weekday produce the same date;
- exclusion precedence, start/end bounds, end-of-year behavior and holiday-name changes.

Every generated occurrence must retain trigger provenance so later holiday-data changes cannot falsify an already committed history record.

## Extended weekdays and consecutive-day jobs

Current work patterns are capped at four consecutive days and materialise daily occurrences. 5F should preserve that daily occurrence model. It should not represent a five-to-seven-day job as one opaque block, because eligibility, fatigue, absence, coverage and replacement decisions occur per day.

Before expansion, the owner must choose:

- maximum consecutive days and whether wrap-around weekly sequences are allowed;
- whether different daily crew sizes, start times, qualifications or pool rules are supported in one run;
- whether a missed or excluded day breaks a run or merely leaves an unstaffed occurrence;
- whether assignments may be proposed for the whole run or require daily approval;
- how adjacent-day policy and fatigue limits cap a run.

The first implementation should keep one shared job definition and one canonical occurrence per day. Per-day variants can be a later increment if operational demand justifies their added schema and review complexity.

## Test strategy

Every increment adds focused model, browser, persistence/reload, stale-state, single-writer and standalone parity checks. Existing retained release gates, Stage 3 safety contracts, Stage 4D hours-allocation checks and Stage 4E/4F policy-preservation checks remain required regressions.

Required fixtures include:

- a feasible mixed crew with pool/team preferences and one plant-operator role;
- an infeasible crew caused separately by absence, qualifications, rest, fatigue, adjacent-day policy and missing verified hours;
- a protected manual assignment and an instruction-owned fixed/rotation assignment in the same horizon;
- a holiday trigger across observed holidays, exclusions and a year boundary;
- a five-or-more-day run with one unavailable day and a visible shortage;
- stale saved bytes or lost writer ownership between preview and approval;
- persistence failure proving no partial assignment, override or snapshot change.

## First resumption request

When ready to begin, resume **5A only**. The first decision is whether a bounded in-client deterministic search is sufficient or a bundled offline solver is justified by measured workload. No production solver, adjacent-day restriction, holiday-triggered recurrence or extended work-pattern behavior should be implemented before that decision and its acceptance tests are approved.
