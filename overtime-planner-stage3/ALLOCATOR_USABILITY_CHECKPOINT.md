# Allocator usability checkpoint

Status: completed and verified locally, 6 October 2026. The owner explicitly resumed all allocator requirements recorded after Stage 4C and per-job staffing sections. This is a bounded usability increment; Stage 4D remains unstarted. No commit, push, deployment, independent approval or review/evidence package is included.

## Delivered behaviour

- **Auto-add eligible / preferred staff** stages the existing ranked eligible candidates up to remaining crew vacancies. Search and slicers only affect the displayed directory; the button uses the full eligible workforce for the job. Existing assigned staff, stable slots, modes, repeats and provenance are preserved. New slots use the existing one-occurrence manual strategy. Operators review the staged result and explicitly confirm/save. Closing discards staging.
- **Matching / other staff division** keeps matching exclusive/preferred pool members above a visible divider, including blocked members; all other staff remain below. Eligible members precede blocked members within each displayed group, with existing comparator order inside each subset. Team preferences supply grouping when no active pool grouping applies; both sections off show eligible staff above blocked staff. Canonical reasons remain visible. Exclusive nonmembers and unsafe members have disabled Add actions. Preferred-only eligible nonmembers can be added.
- **Pool tags beside names** appear on candidate and staged/assigned cards, resolved from canonical IDs and safely escaped. Retired memberships remain visibly marked; they do not satisfy active exclusive pools.
- **Tag-aware smart search** matches pool labels case-insensitively with or without `#`, alongside existing name/ID/role/team/crew/department fields.
- **Pool slicer** appears beside department and team controls, with active tag membership counts. Filters combine without changing eligibility. Empty groups explain the current browsing result. The tagged-only banner names the active restriction and explains the unfillable empty-pool case.

All per-job section semantics and canonical safety requirements remain active. Qualifying as a pool member never proves employment, qualification, availability, overlap/rest or fatigue eligibility. Crew operator requirements remain separate from individual eligibility. Auto-add inserts a required eligible operator before filling other vacancies; if that requirement cannot be met it leaves staging unchanged and reports the conflict. Other valid staffing shortages can stage a partial crew while explicitly reporting remaining vacancies.

## Implementation boundary

`resolveAllocatorModel` supplies a detached full browsed directory without changing the retained legacy `resolveCandidateModel` contract. `selectAutoAddCandidates` returns a pure staging proposal, checking existing staged staff and each proposed addition through canonical individual and crew validation. It uses the current preference comparator, canonical tag catalogue, explicit absence/refusal data and effective adjacent-year schedule context. Failed safety data cannot produce additions.

The allocator facade stages manual slots only; existing save validation independently rechecks the allocation and remains authoritative. Writer ownership guards auto-add and the new pool control. Read-only peers cannot open or mutate the allocator. Candidate/staged cards wrap names and tags; the two-column desktop layout becomes one column on narrow screens without horizontal overflow. Existing qualification/fatigue labels remain distinct and preserved.

No new persisted fields, schema migration, dependency, replacement scoring/fairness policy, cross-occurrence planning algorithm or shared NSA/EVT asset is introduced. No hours-aware approval or verified regular-work coverage is claimed.

## Verification

The final focused check passed **17 groups with zero browser errors** using child-local Playwright and Chromium 149.0.7827.55. It covers full roster group membership/reasons, hard-exclusive and preferred-only behaviour, empty pools, active/retired labels, tag search and combined slicers, disabled sections, detached current ordering, operator/qualification/overlap/rest/absence/boundary failures, missing canonical engine, preserved existing slots, real save/reload, shortage and close/discard behaviour, and peer guards. The final presentation ordering assertion also passed.

The parent-coordinated regression matrix passed:

| Command | Passed result |
|---|---|
| `npm test` | 24 mandatory retained suites (17 Stage 1, seven Stage 2) |
| `npm run test:stage3` | Six contracts |
| `npm run test:stage3:smoke` | Seven browser checks |
| `npm run test:writer` | 18 checks |
| `npm run test:handoff` | 15 checks |
| `npm run test:security` | Seven groups |
| `npm run test:runtime` | Six groups |
| `npm run test:planner:assignments` | Six checks |
| `npm run test:tooling` | Both portability groups |
| `npm run test:inherited` | Ten Review 55–63 scripts |
| `npm run test:stage4b` | 30 focused checks |
| `npm run test:ordering` | Seven scenarios |
| `npm run test:stage4c` | 11 model and 23 browser groups |
| `npm run test:staffing-sections` | 17 groups |
| `npm run test:allocator` | 17 groups |

Browser execution required approved local execution outside the sandbox after Chromium launch returned Operation not permitted. Existing Stage 3 qualification rendering caught a merged missing/expired label; distinct labels were restored and the unchanged contract passed. The final eligible-before-blocked presentation refinement was verified through the focused model/browser suite. Original Stage 1/2 tests were not rewritten or weakened.

Desktop 1200×700 and mobile 390×700 preferred/exclusive allocator views were inspected, with mobile overflow checks. Generated `index.html` and `dist/hort_ops_offline_planner.html` are byte-identical. All 433 tracked host files and preserved child history/constitution/baseline images remain unchanged. The reviewed transport allowlist contains 414 unique existing files, including the new test/checkpoint and all runtime dependencies. Raw results, screenshots and scratch inventories remain ignored local outputs under `test_reports/allocator-usability/`; no package was generated.

## Stop point

All five owner-requested allocator features are complete locally. Stop before Stage 4D. Fairness, fixed fallback and regular-hours policy decisions remain pending as recorded in the Stage 4 baseline. GitHub publication requires a separate request, branch reminder and transport/tree review. No independent review verdict or expanded Windows/browser certification is claimed.
