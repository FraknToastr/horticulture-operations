# Stage 4C — fresh context handoff

Prepared 6 October 2026 for the next Codex thread. Read this before implementing Stage 4C, then re-read the referenced source and current repository instructions. This is a handoff, not a record that Stage 4C has started or passed verification.

## Owner intent and authority

The owner wants Stage 4C to start in a new thread with fresh context. This thread was instructed to write the handoff only. Do not begin implementation merely by completing this document.

The owner has approved closing Stage 3/Phase 8 and starting Stage 4 smart rostering. Their leading directions are **flexibility and fairness**. Development must proceed in bounded phases to manage Codex quota; do not implement all algorithms together. Agents have been explicitly requested and are encouraged for suitable independent tasks.

When the owner asks the new thread to start/proceed with Stage 4C, implement its bounded scope through verification. Do not ask again for routine implementation choices already covered by that instruction. Stop after the completed Stage 4C checkpoint; Stage 4D requires the owner's next instruction.

Suggested opening instruction for the new thread:

> Read `overtime-planner-stage3/STAGE4C_FRESH_CONTEXT_HANDOFF.md`, re-read the applicable instructions and source, and implement Stage 4C. Use agents. Complete implementation and verification, then stop at its checkpoint. Do not update GitHub.

## Stage 4C goals and completion criteria

The approved phase sequence proposes an **explainable candidate preview for one job occurrence**. Its exit gate is: no roster writes; current hard checks and reasons visible; current ranking explained; missing regular-hours facts labelled.

Implement a clear preview that:

1. Identifies the selected occurrence by job name, canonical date, timing, required crew and relevant requirements/pool settings.
2. Shows eligible candidates in the current ordering and explains the actual factors that put them in that order.
3. Shows excluded staff and the applicable canonical eligibility reasons. Do not lose blocked staff simply by reusing a list that already filters them out.
4. Distinguishes hard restrictions from preferences, individual eligibility from crew compliance, and already assigned staff from available candidates.
5. Makes missing evidence visible, especially regular-work intervals and absent overtime-hour facts. A lack of recorded work must not be described as proof of adequate rest.
6. Opens, refreshes and closes without changing assignments, snapshots, instructions, provenance, workforce records, audit histories or saved workspace bytes.

A preview must reflect the selected occurrence's current saved state. If the underlying state changes, show that it needs refreshing or recompute from a fresh detached snapshot. Never present stale results as a guarantee that an allocation would succeed. Existing allocation commands continue to validate independently.

Keep the scope to one occurrence. New hours-based scoring, fairness windows/weights, batch planning, replacement allocation and automatic substitution belong to subsequent phases. Explain existing behaviour faithfully; do not introduce a new allocation or fairness policy through a displayed score.

## Current baseline and publication

- Working root: `/home/n0rt/headroom-projects/Hort Ops 23 September`.
- Independent application root: `overtime-planner-stage3/`.
- Current local branch when this handoff was prepared: `overtime-stage3`.
- Local HEAD: `7b7dd783005898310b9c37f6cd31038d7190da73` — `Add Stage 4B staff pools and multi-day work patterns`.
- Last authorised push sent that commit to `origin/github-replacement` in `FraknToastr/horticulture-operations`.
- At that verified push, remote `main` remained `40b0a20288bc2b0aed8f28f59c09ee7155d5a0bf`.
- There was no configured upstream for the local branch. The push used an explicit destination; do not infer a new destination from the local branch name.
- Working tree before this handoff: no tracked changes; untracked local research under `overtime-planner-roster-research/`. This handoff and its allowlist entry are new local changes.

Verify these facts again in the next thread. A previous authorised push does not authorise publication of the next phase. Before any future authorised GitHub update, give the permanent branch reminder, verify remote branches/tracking and identify the exact destination. Updating `github-replacement` does not update `main`.

## Isolation, governance and transport

Read the root `AGENTS.md`, `/home/n0rt/.codex/RTK.md`, and child `AGENTS.md`. Use `rtk` for shell commands. Follow the owner's package discovery protocol before reporting tooling as unavailable; identify the exact missing layer and relevant package names before choosing a workaround.

Overtime remains independent of NSA/EVT. Keep its source, CSS, JavaScript, tests, dependency/browser setup, fixtures, assets and browser storage inside its own project. Do not share them with the host applications or alter the earlier `overtime-planner/` application. Original source/support workspaces and signed historical reviews are reference material, not editable development targets.

Use the current constitutional/governance documents and retain original constitutional and review material. No automatic peer-review ZIPs, review-results ZIPs or test-evidence packages. The owner permits packages only on demand.

For future GitHub transport, use `GITHUB_TRANSPORT_FILES.txt`. Include source, tests, required documents and governance/constitutional files only. Leave caches, installed dependencies, local reports, inventories, old archives/hashes and the separate research folder outside transport. This handoff adds one required document to the previous 402-file allowlist; the list becomes 403 files. The Stage 4B checkpoint's 402-file count remains its historical result.

The owner starts with a clean current-schema client: the User Table supplies workforce, and the Job Registry starts from scratch. Do not add legacy data/schema migration or restore seeded customer records. Existing current Schema v2 backups remain compatible.

## What Stage 4B already implements

Read `STAGE4B_CHECKPOINT.md` as the latest implementation contract. `STAGE4_SMART_ROSTERING_BASELINE.md` is the Stage 4A design baseline; its proposed phases and some pending entries are historical. In particular, Stage 4B settled D02/D03 and expanded work patterns under explicit owner instructions. Do not treat its older pending pool/holiday statements as a reason to undo the completed implementation.

Pool contracts:

- Optional workspace `poolTags`: `{id, label, active, history?}` records. IDs use `POOL-`; labels are case-insensitively unique, start with an ASCII letter and use up to 40 letters/digits/underscores/hyphens. The stored label omits `#`.
- Staff `poolTagIds` and membership history persist across matched User Table imports. Qualifications are also preserved. Ambiguous identity matches are rejected rather than transferring memberships silently.
- Jobs have `preferredPoolTagIds`, `exclusivePoolTagIds` and `exclusivePoolSource: none | teams | tags`. Several tags form an any-tag union; staff are deduplicated.
- Eligible preferred tagged staff come first, with existing ordering inside groups. Exclusive tags restrict eligibility and fail closed when the active matching pool is empty. Tags do not prove qualifications, availability, rest or fatigue safety.
- Retiring a tag/removing a membership exposes impacts and retains saved assignments/history. Old jobs and workspaces with absent extension fields remain valid.

Work patterns:

- New `frequencyType: work_pattern`, leaving older job types available.
- `workPattern` has `mode: weekly | run`, `startDate`, optional `endDate`, `days`, `runLength`, `includePublicHolidays` and `excludedDates`.
- Weekly selections allow up to four consecutive weekdays cyclically, e.g. Friday–Monday. Weekly days OR full-day South Australian public holidays generate at most one occurrence per job/date. Exclusions win over both triggers. A holiday-only weekly pattern is supported.
- A run generates one to four consecutive dates, including across New Year. Each date's staffing is independent; common job timing and crew settings apply.
- The owner specifically needs every Saturday and Sunday plus nearly every public holiday for Park Lands Rangers, including Easter Friday–Monday. Do not reinterpret this as weekend-only holiday selection.
- The existing holiday calendar supplies full-day dates; part-day holidays remain outside the implemented scope. Do not invent pay rules or adjacent-day prohibitions.

## Source map and integration cautions

Start with these child-local files:

| File | Role |
| --- | --- |
| `js/components/staffAssignModal.js` | Existing occurrence/assignment editor, context construction, validated allocation save |
| `js/components/staffAssignModal/candidateModel.js` | Candidate projections, filtering and current deterministic sorting |
| `js/components/staffAssignModal/candidateList.js` | Existing candidate presentation |
| `js/components/staffAssignModal/stagedCrew.js` | Existing staged crew presentation |
| `js/utils/eligibilityEngine.js` | Canonical hard eligibility, warnings and readable reason mappings |
| `js/utils/rostering/engine.js` | Existing recommendation/assignment logic and repeat resolution |
| `js/utils/planningRules.js` | Pool matching, extension validation and generated pattern dates |
| `js/components/planningEditors.js` | Pool/work-pattern editors and impact review |
| `js/utils/scheduler/engine.js` | Canonical occurrences, projections, holidays and boundary handling |
| `js/app.js` | Current state, canonical save/conflict baselines, digest regeneration |
| `js/utils/writerSession.js` | Exclusive writer ownership and read-only UI/action boundaries |
| `js/utils/storage/schemaValidator.js` | Workspace validation and extension dependency checks |

Do not create a parallel eligibility engine. `validateStaffEligibility`/the underlying canonical evaluator must supply exclusion reasons and warnings with the correct job, occurrence, assignments, staged crew and context. Inspect signatures rather than assuming them.

The current candidate model makes shallow staff projections before annotating them. Its filtering has display exceptions (including overlap-only candidates); being displayed is not the same as being eligible for a successful save. Its sorter mutates the candidate array: pass a detached array/projection to a preview.

The current sorter considers assignment/qualification flags, preferred tag match, team tiers, fatigue, plant-operator preference and the existing fair-share calculation (with an overtime-hours fallback), then name. Re-read the exact comparator before explaining its order. Explain the factors actually used, including fallback values; do not label absent imported hours as verified zero or confuse planned commitments with worked hours. Crew-level plant-operator compliance needs a separate explanation from each person's eligibility.

User Table imports already default `ytdOvertimeHours` to numeric `0` in `js/utils/userCsvParser.js`; new staff records in `js/utils/reconciliationEngine.js` also initialise it to `0`. Checking only for a missing hours field will miss this unknown-evidence case. A stored numeric zero alone does not establish verified worked hours. The preview must label imported default-zero hours as unverified unless supporting evidence establishes their meaning, while explaining the value used by the existing ranking. Do not change stored records or introduce a new hours policy to supply that label.

Read-only tabs currently disable many content controls through `writerSession`. If preview is offered there, narrowly permit its read-only actions while preserving every write guard; do not whitelist the whole allocation editor or an entire modal indiscriminately. Release/reacquire discards editor models. A preview must not retain a callback that later gains authority to write.

Stage 4B fixed several regressions that must remain fixed:

- A successful allocation save refreshes domain baselines and synchronises `assignments` with `customAssignments`; otherwise subsequent year changes can be rejected and reload can reopen the wrong year. Failed saves never refresh those baselines.
- Committed pattern occurrences derive display weekday/pattern/holiday metadata from canonical dates without rewriting snapshots; weekday holidays and dates crossing month/year boundaries remain visible.
- Job pattern edits cannot exclude future dates with assigned staff by relying on a snapshot as proof that the proposed pattern still generates the date.
- Editor rendering guards prevent nested blur/change re-entry while focused controls are removed.
- Reset clears pools. Schema validation accepts isolated old Schema v2 records without the extension module, but declared pool/pattern fields (even empty/null) require the real module and fail closed if it is missing.

## Policy decisions still pending

Stage 4C can expose these gaps without resolving them:

- F01–F05: fairness time window; worked versus planned hours; comparison population/opportunity adjustment; treatment of refusals/cancellations; future ordering of hours fairness, preferences and fatigue.
- M01/M02: fixed staff becoming ineligible, permitted fallback and what happens after a fixed assignment's scope ends.
- D01: authoritative regular-work intervals, verification and handling of unknown safety evidence.

Do not guess these policies or claim fully verified rest-based automatic approval. Showing the present ranking and its limitations is the purpose of this phase.

## Verification baseline and plan

Stage 4B completed locally with 30 focused checks and zero browser errors. Its full regression run passed: 24 retained release suites, six Stage 3 contracts, seven Stage 3 browser checks, 18 writer checks, 15 handoff checks, seven security checks, six runtime checks, six existing Forward Planner assignment checks, two tooling groups and ten inherited Review 55–63 probes. Historical Review 64 reproductions are separate negative probes; do not call their raw results positive acceptance checks.

Automated coverage used the child's local Linux Chromium. This is not a new independent review verdict or Windows certification. The owner previously used Windows 11, double-clicked `index.html`, and reported browser version `154.0.4258.53` (Official build, 64-bit); the browser name was not supplied.

Observed tooling in the previous phase: Node 22.23.2, npm 12.1.0, project-local Playwright 1.61.1 and Chromium 149.0.7827.55 under `.cache/ms-playwright`. Discover and check the current versions/runtime before relying on them; do not import ancestor/global browser packages.

For implementation, add meaningful tests proving:

- Correct eligible/blocked results, all applicable reasons, exact correspondence with current ranking and tag/team restrictions.
- Missing hours/regular-work evidence is labelled, including imported staff whose `ytdOvertimeHours` was defaulted to numeric `0`: those hours remain unverified without supporting evidence, and the existing ranking value is explained without changing it. Crew requirements and assigned staff are distinguished.
- Opening, rendering, refreshing and closing a preview leave saved bytes and live domain data/history unchanged, including in a read-only peer tab.
- Stale/changed occurrence data cannot produce an apparently current allocation promise.
- Overnight, weekday holiday, month/year boundary and multi-day occurrence contexts use the same canonical checks as allocation.
- Saved text is escaped, ownership transfer remains safe, and allocation continues to reject blocked candidates independently of the preview.

Use child-local test fixtures and the existing package scripts. `npm run test:stage4b` is the 30-check pool/pattern suite; `npm test` retains its 24-suite manifest. Re-read `package.json` for all current commands. Run the focused new checks, relevant existing regressions, then the required complete child regression matrix. Complete meaningful failures before declaring the phase done. Browser/subprocess sandbox failures are blocked execution, not passing tests; request the needed execution permission through the tool when necessary.

Build the standalone via the child's `npm run build` after source changes. Verify `index.html` and `dist/hort_ops_offline_planner.html` match. Keep reports/inventories local and ignored. Existing release runners can overwrite retained root verification images; preserve/restore those historical baseline images rather than publishing new evidence over them.

## Suggested bounded work sequence

1. Re-read instructions, current baseline and the source graph. Capture current source/host inventories for an isolation audit and inspect tooling.
2. Agree ordinary implementation choices within the authorised scope, then implement a detached explanation model and the occurrence preview UI using the current application styling.
3. If using agents, give each clear non-overlapping ownership: explanation model; UI; independent tests/audit. Keep integration, ownership/storage protections and final acceptance with the root agent.
4. Complete targeted and required regression checks, build parity, transport and host-isolation audits.
5. Write a Stage 4C checkpoint with actual results/limitations; update current status/governance and the transport allowlist for required new source/tests/documents. Keep past checkpoint counts historical.
6. Report how to open the preview, what it explains, its material limitations and verified outcomes. Stop before Stage 4D and wait for the owner's next phase instruction. Publish only after a new explicit GitHub instruction.

## Documents to consult

- `AGENTS.md` (root and child): permanent operating/isolation/publication rules.
- `CURRENT_REVIEW_STATUS.md` and `DEVELOPMENT_TRANSITION.md`: current local completion and phase boundary.
- `STAGE4B_CHECKPOINT.md`: latest implemented pool/pattern contracts and verification.
- `STAGE4_SMART_ROSTERING_BASELINE.md`: phase sequence, policy register and scenario catalogue.
- `STAGE4A_CHECKPOINT.md`: historical design checkpoint.
- `SUPPORTED_RUNTIME.md`, `TOOLING.md`, `package.json`: launch/tooling/test contracts.
- `GITHUB_TRANSPORT.md` and `GITHUB_TRANSPORT_FILES.txt`: publication scope.
- `FORWARD_PLANNER_ASSIGNMENT_FIX.md`: assigned-card regression context.

The local research folder is useful reference material and is deliberately outside GitHub transport. The shipped Stage 4 baseline reconciles its relevant ideas; do not make implementation depend on that folder existing in every clone.
