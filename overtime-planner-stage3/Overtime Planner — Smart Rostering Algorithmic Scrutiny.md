# Overtime Planner — Smart Rostering Algorithmic Scrutiny

## 1. Purpose and authority

Act as a senior operations-research engineer, workforce-scheduling algorithm specialist, and adversarial software architect. Assess whether the Overtime Planner uses the best practical decision models for one-off jobs, short series, long-running recurrence, composed allocation strategies, and recovery after circumstances change.

This is an evidence-led assessment, not just a coding-defect review. Establish what the engine should do under approved operational rules, reconstruct what it actually does, and compare the two. Passing existing tests is evidence, not proof that the decision model is appropriate.

The application is an enterprise-targeted, standalone browser application for capital-city local-government horticulture operations. Recommendations must support fairness, determinism, explainability, safety, reproducibility, operator control, bounded computation, and minimal unnecessary roster disruption.

This brief authorises review and self-contained assessment fixtures or experiments within the independent Overtime project. It does **not** authorise production-code changes, policy decisions, schema migration, UI redesign, application integration, commits, publication, or peer-review packages. Preserve original review history and constitutional safeguards. Follow current repository instructions and checkpoints; do not infer the current implementation phase from the folder name.

## 2. Minimal-intervention policy

Prefer **minimal to no refactoring**. Retain working architecture, interfaces, storage contracts, and simple algorithms wherever they meet demonstrated requirements.

Recommend refactoring only when it is critical to correctness, safety, reproducibility, or maintainability, **or when a strong evidence-backed argument demonstrates substantial operational or engineering value**. Refactoring is not justified merely by stylistic preferences, theoretical elegance, generic best practice, or the availability of a more sophisticated solver.

For every proposed change, record:

- the specific observed problem and its source references or reproducer;
- the smallest viable correction and affected scope;
- a no-refactor alternative, where feasible, and why it is sufficient or insufficient;
- measurable expected benefit, implementation cost, and compatibility risks;
- verification needed to demonstrate the benefit without weakening existing protections;
- whether it is essential, strongly justified, or optional.

Separate algorithm corrections from structural refactoring. A justified algorithm change does not automatically justify restructuring surrounding modules. Present implementation phases for owner approval; do not implement them during this assessment.

## 3. Evidence baseline and planning boundary

Inspect current smart-rostering source, canonical eligibility and crew checks, assignment and rotation logic, recurrence, Job and Workforce Registry models, tests, persistence and transaction mechanisms, governance, and current checkpoints.

Record the exact source revision or working-tree baseline, relevant local changes, runtime, and test commands. Keep unrelated owner changes intact. Distinguish clearly between:

- implemented behaviour, supported by source and execution evidence;
- approved rules and invariants;
- proposed or unresolved policy;
- missing data or unimplemented capabilities;
- research alternatives that have not been demonstrated in this application.

Establish representative and upper-bound workforce sizes, concurrent jobs, roles per occurrence, recurrence length, planning windows, and candidate-pool sizes. If actual operating scale is unknown, label assumptions and evaluate a reasonable range rather than inventing an authoritative scale.

Define whether each experiment plans one occurrence, one series, several competing jobs, or an affected recovery neighbourhood. Account for existing commitments outside that boundary. Explain which future commitments are known, tentative, accepted, completed, or unavailable to the planner. Do not claim globally optimal outcomes from a single-job experiment.

Identify available fairness/history fields and their provenance before proposing metrics. Regular working hours remain outside entry, review, and calculation under current authority; do not introduce them through a research scoring assumption.

## 4. Preserve the decision pipeline and allocation ownership

Preserve this separation:

Canonical Job + Workforce data → hard eligibility → planning → explainable proposal → operator review/approval → complete revalidation → transactional persistence.

Hard eligibility is not soft ranking. Candidate browsing filters must not redefine eligibility or the planning universe.

Retain `manual`, `fixed`, and `rotation`. Hybrid behaviour composes these across occurrences or date windows; it is not a fourth top-level mode. Test a six-occurrence series with a fixed worker for the first four occurrences and smart rotation for the final two.

Manual/operator-owned and fixed allocations must not silently become planner-owned. Protected decisions are constraints, not preferences that can be outweighed by filling vacancies or improving fairness. If a protected allocation becomes invalid, preserve its provenance and expose the conflict; do not silently keep it valid, delete it, or replace it. Any release requires explicit operator authority.

## 5. Reconstruct the current engine

Document candidate generation, filtering, scoring, tie-breaking, rotation, continuity, fairness state, qualification checks, teams/pools, exclusivity, fixed/manual decisions, series propagation, recurrence, recovery, stale-plan detection, final validation, and persistence.

For each decision identify inputs, hard and soft constraints, objectives and their order, state carried between decisions, side effects, ownership, tie-break method, and failure behaviour. Cite concrete files/functions and relevant tests.

Identify unintended dependencies on array/object iteration, date traversal, candidate order, staff IDs or surnames, runtime, time zone, or browser behaviour. Determine whether explanations reflect the actual decision path rather than a narrative added afterwards.

Separate historical provenance from present validity. A completed historical allocation need not be rewritten because current rules differ; an upcoming proposal must satisfy the applicable current rules. Record which rule version and facts are available, and where historical validity cannot be reconstructed.

## 6. Hard constraints and objective order

Scrutinise active status, availability, applicable teams/pools and exclusivity, qualifications and expiry, absences, overlapping commitments, cross-midnight intervals, physical rest including the established 10-hour boundary, crew-level capabilities such as Plant Operator, occurrence restrictions, and protected manual/fixed decisions.

Malformed or unknown safety-critical eligibility data must not be treated as proof of eligibility. Verify canonical individual and whole-crew checks both when proposing and when committing.

Subject to approved policy, assess a lexicographic objective hierarchy:

1. Preserve ownership and satisfy hard constraints, including protection of manual/fixed decisions unless explicitly released.
2. Fill required roles within those constraints.
3. Minimise disruption to existing accepted allocations.
4. Protect scarce capabilities and avoid preventable future infeasibility.
5. Improve fairness under an explicit approved model.
6. Maintain useful continuity and preferences.
7. Apply an explicit deterministic tie-break.

Challenge this hierarchy with counterexamples. Distinguish protecting scarce capabilities as a feasibility issue from using scarcity as a soft preference. Identify any unresolved priority requiring an owner decision.

Never weaken a hard rule to manufacture a complete roster. Distinguish proven infeasibility, a feasible partial proposal with vacancies, invalid input, and search-budget exhaustion. A bounded search that failed to find a solution has not proved that none exists.

## 7. Assess each planning horizon

### One-off occurrences

Determine when filtered ranking is adequate and when multi-position assignment requires matching or another crew-level formulation. Test cases where a locally best worker consumes a scarce capability needed by another role. Compare worker-first greedy selection with most-constrained-role-first selection and global matching.

### Short series

Treat related occurrences as a planning problem, not blind repetition of one-off ranking. Evaluate continuity, cumulative overtime, opportunity, weekend/undesirable burden, scarce qualifications, adjacent rest, known future absence, partial fixed windows, and manual overrides.

Construct the case where A and B can work today but only A can satisfy tomorrow. Determine the smallest look-ahead or bounded repair that avoids the dead end. Compare finite/rolling horizons, matching across occurrences, bounded backtracking, and local search only where relevant.

### Long-running recurrence

Test fairness drift, starvation, availability patterns, qualifications changing, new/returning staff, fixed periods, manual interventions, holidays, year boundaries, descendant occurrences, roster stability, and computational growth.

Evaluate rolling windows, periodic re-optimisation, explicit fairness debt/credit, and cumulative objectives. Do not extend a short-series heuristic indefinitely without scrutiny, or recommend unrestricted future optimisation when a small transparent window suffices.

### Competing jobs

Include simultaneous or adjacent jobs competing for the same staff, scarce qualifications, and rest capacity. Determine whether job-processing order creates avoidable vacancies or systemic preference. Explain the cost and benefit of cross-job coordination, and the smallest coordination boundary that resolves demonstrated failures.

## 8. Compare practical algorithm alternatives

Compare the current approach with relevant candidates: deterministic greedy or lexicographic ranking, weighted scoring, bipartite/Hungarian assignment, min-cost maximum flow, constraint satisfaction, integer programming/CP-SAT, rolling horizons, bounded backtracking, local search, regret/scarcity-first allocation, repair heuristics, and fairness debt/credit.

Do not build every alternative. Screen unsuitable approaches first, then prototype the smallest useful comparisons in isolated assessment code. Use primary research or official documentation for technical claims and cite it. Do not confuse theoretical suitability with demonstrated browser feasibility.

Use this comparison structure:

| Algorithm | Appropriate problem | Strengths | Weaknesses | Complexity | Explainability | Browser/offline suitability | Measured benefit over baseline |
|---|---|---|---|---|---|---|---|

Compare candidates on identical inputs, constraints, ownership protections, objective definitions, planning boundaries, and computational budgets. Record solution quality, vacancies, fairness, disruption, latency, memory where measurable, and termination behaviour. Include dependency/runtime/bundle implications; a native or hosted solver is not automatically suitable for an offline browser.

Inspect composite scores for commensurability, meaningful weights, overpowering factors, sensitivity, instability, and magic numbers. Compare explicit lexicographic stages where they improve predictability. Require demonstrable value before recommending additional complexity.

## 9. Fairness data and adversarial bias

Do not equate fairness with lowest recorded overtime hours. Distinguish availability → opportunity → offer → acceptance → allocation → actual work performed.

Evaluate allocated overtime, actual completed overtime where recorded, assignment count, opportunity, refusals, availability, desirable/undesirable shifts, weekend/holiday burden, recent versus historical allocation, qualification scarcity, and continuity.

For every proposed metric, identify source fields, time window, units, missing-data handling, and whether current records support it. **Missing offers, refusals, acceptance, or actual-work history are unknown, not zero.** Do not present an allocation count as an opportunity or completed-work metric. If a policy requires new collection or persistence, report the gap and approval needed rather than silently inventing data or changing the schema.

Test second-ranked starvation, surname/ID tie bias, specialist overuse, limited-availability workers, repeated undesirable/weekend/holiday work, new and returning staff, repeated refusals where data exists, and workers with exactly equal state. Unavailability must not automatically count against workers for work they could not reasonably accept; refusals are not completed allocations.

Determine what fairness and rotation state must persist. Determinism must not hide structural bias: explicit deterministic rotation can depend on recorded state, but arbitrary order or uncontrolled randomness is not a fairness policy.

## 10. Recovery and minimum disruption

Assess changed absence/availability, qualification expiry, job or recurrence edits, staff joining/leaving, and manual changes after a roster is prepared. Respect current absence-review authority and preserve visible conflicts until operator approval.

Evaluate this recovery sequence:

1. Identify directly affected upcoming occurrences and relevant neighbouring commitments.
2. Attempt direct substitution without disturbing unaffected protected decisions.
3. If needed, perform bounded local repair, favouring planner-owned assignments.
4. Preserve manual/fixed decisions unless explicitly released.
5. Revalidate the complete affected crew and temporal constraints.
6. Present reasons, vacancies, and every proposed change for approval.
7. Persist through the authorised transaction path; do not broaden a one-off replacement into fixed/rotation propagation.

Compare complete replanning, local repair, min-cost reassignment, and bounded neighbourhood search. Define measurable disruption: changed workers/slots/occurrences, changes to accepted plans, propagation distance, and operator review burden. Protected changes are forbidden without release, not merely assigned a large penalty. Justify remaining weights or lexicographic priorities.

## 11. Determinism, stale proposals, and bounded execution

Identical canonical inputs, commitments, history, policy/configuration, planning boundary, and explicit rotation/tie state should reproduce the same proposal and explanation. Record clock/time-zone assumptions and deterministic seeds for experiments. Test permutations of equivalent input order.

Define the proposal's dependency set: job/occurrence/recurrence and staffing scope; workforce status, pools, qualifications and absences; relevant assignments and neighbouring commitments; manual/fixed ownership; fairness/rotation history; policy/configuration and planning window. Determine how each dependency is versioned or revalidated, including changes that do not increment an existing coarse version.

Test generation at state X, intervening edits, and attempted commit. Detect stale assumptions; reject or regenerate/revalidate safely, then obtain renewed approval if the proposal materially changes. Final validation and persistence must close the read-to-write gap and must not overwrite another operator's manual decision.

Distinguish sessions sharing the same storage namespace from independent browser profiles, devices, or downloaded copies. Do not imply distributed locking or synchronisation that the standalone application does not provide.

Specify bounded search/work budgets, cancellation where applicable, and safe partial/failure results. Exhaustion must leave canonical data unchanged and report what was and was not established. Benchmark realistic browser execution, not only an unrestricted command-line solver.

## 12. Reproducible scenarios and longitudinal experiments

For each scenario provide a minimal fixture, rule assumptions, source/test references, expected invariants, actual baseline result, explanation, and any alternative result. Label approved expectations separately from unresolved policy. Use synthetic data, not private operator exports.

Cover at least:

1. Single job, single position.
2. Single job, multiple positions.
3. Scarce qualification and a generic role competing for specialists.
4. Two equally eligible workers.
5. All workers exactly tied; input-order permutations.
6. Insufficient eligible workers; honest vacancies.
7. Fixed and smart allocations together.
8. Manual and smart allocations together.
9. Fixed first four occurrences, smart final two.
10. Worker becomes unavailable midway through a series.
11. Qualification expires midway.
12. Exactly 10 hours of physical rest.
13. Rest boundary missed by one minute.
14. Cross-midnight work and overlap.
15. Successive-day commitments.
16. Public holiday adjacent to a weekend.
17. Year boundary and recurrence descendants.
18. Long-running weekly job.
19. Worker joins midway.
20. Worker leaves midway.
21. Missing historical fairness data; distinguish unknown from zero.
22. Corrupted/malformed eligibility data and fail-closed behaviour.
23. Multiple shared-storage sessions producing stale proposals.
24. Recovery: direct substitution, bounded repair, and no feasible repair; protect manual/fixed decisions and measure disruption.
25. Competing jobs where processing order consumes scarce staff or rest capacity.
26. Known future availability where choosing A today blocks tomorrow.
27. A manual/fixed edit between proposal and commit, including a dependency change missed by coarse versioning.
28. Search-budget exhaustion versus demonstrated infeasibility; no partial persistence.
29. Current-rule changes affecting upcoming work without rewriting completed historical provenance.
30. Independent browser copies: document limits rather than claiming shared coordination.

Run reproducible sequences of 6, 12, 26, 52, and 104 occurrences with identical workers, mixed availability/qualifications, new/returning workers, frequent absences, holidays, fixed allocations, and manual exceptions. Where data is unavailable, use explicitly labelled synthetic histories; do not claim the current app records them.

Report overtime-hour and assignment distributions, opportunity-adjusted measures only where supported, maximum fairness debt under the defined model, undesirable-shift concentration, variance/spread, starvation duration, vacancies, disruption, and runtime. Use metrics diagnostically; do not blindly optimise a statistic that contradicts approved operational fairness.

## 13. Required deliverables and completion checkpoint

Produce:

1. **Current-engine reconstruction:** pipeline, ownership, decision rules, carried state, source references, and observed failure behaviour.
2. **Constraints and policy register:** approved invariants, unresolved owner choices, missing data, historical/current-rule distinctions, and planning/scale assumptions.
3. **Reproducible scenario results:** fixtures, commands, expected/actual outcomes, failures, and longitudinal measurements.
4. **Algorithm comparison:** fair baseline comparisons, browser budgets, explanations, and measured trade-offs; document alternatives screened out without prototyping.
5. **Ranked findings:** severity, evidence, operational consequence, smallest remedy, and essential/strongly justified/optional classification.
6. **Minimal-change recommendation:** what should stay unchanged, targeted corrections, and any separately justified refactoring with alternatives, costs, risks, and acceptance tests.
7. **Phased implementation proposal:** exact scope and approval required for each later phase; separate algorithm, policy/data, storage, and structural changes.
8. **Durable assessment checkpoint:** baseline, assessed coverage, commands/results, limitations, unresolved decisions, and exact next authorised step.

The assessment is complete when the engine has been reconstructed, all required scenarios have documented results or explicit evidence-backed limitations, serious alternatives have been compared or justifiably screened out, and recommendations are traceable to evidence. Do not claim tests or simulations were run when only reasoning was performed.

End at the assessment checkpoint and stop for owner review. No production changes, follow-on implementation, automatic packaging, commits, or GitHub updates are authorised by completion of this brief.
