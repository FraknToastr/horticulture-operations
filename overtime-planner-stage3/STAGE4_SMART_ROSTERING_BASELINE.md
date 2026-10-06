# Stage 4 Smart Rostering design and policy baseline

Current status, 6 October 2026: the owner-authorised Stage 4 roadmap is implemented locally through Stage 4F. `STAGE4F_CHECKPOINT.md` is the current checkpoint and supersedes historical unstarted/stop wording below. No post-Stage 4 work or publication is authorised by that completion.

Date: 5 October 2026. Status: Stage 4A documentation increment complete.
Authority: current owner instructions and selections; implementation of later
increments requires explicit resumption. This is not an implemented feature set.

## 1. Authority, outcome and boundaries

The owner states: "Phase 8 is authorised to be closed, and Stage 4 Smart Rostering
is authorised to begin." This closes migration Phase 8 and accepts the corrected
Stage 3 baseline for the owner-authorised transition. It does not fabricate an
independent Review 65 verdict or a Windows retest after the Forward Planner fix.
Original signed reviews and constitutional copies remain byte-preserved.

The owner subsequently selected **Design and policy baseline** as the first
increment, replacing the earlier candidate-preview selection. The leading goals
are **flexibility and fairness**. Fairness should balance overtime hours among
eligible, available staff. Flexibility should support mixed manual, fixed and
automatic staffing by role and date. The customer's cross-team tag pools are a
required capability and the first proposed implementation increment.

Stage 4A changes documentation only: no application logic, UI, ranking, persisted
fields, schema, migration, seed data, dependencies or algorithms. Overtime remains
fully independent of NSA/EVT, including source, assets, storage, tests and tooling.
The client continues to start with empty registries and accepts current Schema v2
only. No research workbook or legacy roster becomes client data.

Constitutional continuity: Articles 2/32 give current owner instructions priority;
Articles 7–11 protect identity, occurrence precedence and history; Articles 12–18
separate hard eligibility, preferences and pools; Articles 24–26 protect persistence;
Articles 29–30 require meaningful verification and evidenced completion. Current
development/acceptance authority is recorded here and in DEVELOPMENT_TRANSITION.md,
without rewriting inherited Gemini-specific wording or approving legacy migration.

## 2. Research reconciled with the current application

The six narrative documents in overtime-planner-roster-research are design input.
Their PR13 snapshot, proposed future-stage labels, sample-data counts and package
claims are not current implementation or acceptance evidence. The research/archive
remains inactive and outside transport; the links below identify current local source.

| Topic | Verified current implementation | Stage 4 consequence |
| --- | --- | --- |
| Cross-team tags | No staff-tag catalogue, memberships or job tag pools in the client source | Add a bounded tag-pool capability before new allocation algorithms. |
| Team preferences/exclusivity | Job editor and candidate model support preferred team tiers and exclusive teams | Preserve existing jobs; make tag-based exclusivity an explicit alternative. |
| Qualification | qualifications.js, eligibilityEngine.js and Schema v2 validation already handle required qualifications and dated staff evidence | Extend the canonical checks if approved; do not replace them with hashtags. |
| Availability | absences.js and assignment validation already handle dated absences | Compare proposed intended/approved and partial-day behaviour against current contracts before extending. |
| Fatigue/fair-share | fatigueEngine.js, candidateModel.js and absences.js already evaluate fatigue, recorded YTD hours and refusal history | Expose current behaviour and evaluate it against the approved hours-balancing goal; do not describe fairness inputs as absent. |
| Current ranking | Team tiers, fatigue, plant-operator preference, fair-share score and name tie-breaking already influence candidate ordering | Tag preference becomes an explicit leading preference group in the future tag increment; no other ranking change is approved here. |
| Current fair-share formula | calculateFairShareScore uses recorded hours and refusal contributions; its existence does not prove fair distribution | New fairness definitions/weights need owner approval and benchmarks. |
| Assisted allocation | autoFillTeam exists for one occurrence; rostering/engine.js supports manual, fixed and rotation instructions with provenance | Reuse protected ownership and validation; future mixed staffing must not overwrite manual or unrelated commitments. |
| Complete regular hours | eligibilityEngine.js explicitly checks rest against known assignments without complete regular working schedules | Define authoritative regular-work inputs before claiming fully verified automated rest coverage. |
| Permits/role criteria | Current permit handling and whole-job qualification/crew checks exist | Generic dated permits, per-role criteria and credential scopes require further design, not a blanket new model. |
| Recurrence/holidays | Scheduler supports current frequency types and holiday context; validators restrict supported operational weekdays | General holiday-triggered series, part-day intervals and arbitrary multi-day runs need separate approved changes. |
| Adjacent-day rule | Research proposes an additional prohibition and scoped override | Unapproved policy; do not introduce it or infer it from the current rest rule. |
| Commit integrity | Current client uses a lifetime Web Lock, guarded commands, verified persistence and protected history | All future apply actions must use those boundaries; a preview digest alone cannot authorise writes. |
| Forward Planner display | Phase 8 corrected runtime week/day projection for saved commitments | Preserve assigned-card visibility for every later increment. |

Key implementation references: js/components/staffAssignModal/candidateModel.js,
js/utils/eligibilityEngine.js, js/utils/rostering/engine.js, js/utils/absences.js,
js/utils/scheduler/engine.js, js/utils/userCsvParser.js and
js/utils/storage/schemaValidator.js. These modules were inspected; none changed
in Stage 4A. Proposed schemas in the research are not adopted automatically.

## 3. Approved tag-pool capability and future interfaces

### Membership and identity

- A person retains their formal department/team and may belong to multiple pools,
  for example #ParkRanger while remaining in another team.
- Use one Overtime-owned canonical catalogue. Stable tag IDs carry relationships;
  the displayed hashtag is a label. Match labels case-insensitively and use
  autocomplete to prevent capitalisation/spelling variants creating accidental pools.
- Start without seeded memberships or historical examples. Operators create pools
  and assign membership through Workforce Registry. A tag is not credential evidence.
- Workforce updates preserve locally maintained membership for people matched by
  the existing importer. Current matching uses explicit ID, then email, then name;
  review ambiguity handling before implementing preservation. Unmatched people
  start untagged; do not transfer membership merely because someone resembles a
  former employee or infer it from team, skills or job title.

### Job pool selection and ordering

- Job Registry can select preferred tag pools and an exclusive candidate source.
  Exclusive source is explicit: no exclusive restriction, existing team restriction,
  or tag-pool restriction. Switching source must be deliberate; do not combine team
  and tag exclusivity invisibly or rewrite existing job settings during load.
- Selecting several tags means **any selected tag**. Membership is a union, with
  each person appearing once. Multiple matching tags grant no additional preference.
- A preferred tag group ranks eligible tagged people first, then eligible untagged
  people. Existing preference ordering operates within each group. Preferred tags
  never widen the exclusive candidate source.
- An exclusive tag source permits only members of its selected active pools who
  also satisfy all hard checks. It applies to manual, fixed, rotation and future
  automatic proposals, not just the displayed candidate list.
- An exclusive pool with no eligible members is visibly unfillable. Empty, retired
  or unresolved exclusive references must never silently become unrestricted.
- Membership and retirement edits identify affected future jobs/assignments and
  explain conflicts. They must not silently remove/reassign saved staff. Past
  evidence remains intact. Prefer retirement over destructive tag deletion.

### Interface boundary

The future capability needs a tag catalogue, staff-to-tag membership references,
job preferred-tag references, job exclusive-source selection and exclusive-tag
references. Workforce and Job editor controls, canonical validation, import/export,
central eligibility and candidate ordering must agree on those concepts.

No persisted field names, schema version or public runtime API is introduced by
Stage 4A. Stage 4B must first specify and approve the exact persistence-compatible
change, current-v2 handling, round trips and failure behaviour. Do not bolt unknown
fields onto the current strict envelope, create a second eligibility engine or
activate the inactive historical migration loader. Preserve untagged existing jobs.

## 4. Mixed staffing, fairness and policy register

Mixed staffing is the longer-term target: manual assignments remain operator-owned;
fixed people retain nominated roles/dates; automatic planning targets eligible open
roles within an explicit horizon. Every fixed occurrence is revalidated. A planner
must explain shortages and protect manual, historical and unrelated provenance.
No silent substitute, standing safety override or committed-roster reshuffle is
authorised by this baseline.

Hours fairness compares eligible, available staff using evidence appropriate to
the roster decision. Recorded actual work and future scheduled commitments are
different measures and must be labelled separately, without double-counting the
same occurrence. Missing actual/workload data must be visible rather than invented.
The current client starts empty, so legacy sample hours are not a fairness baseline.

| ID | Policy | Status / next decision |
| --- | --- | --- |
| A01 | Leading fairness goal is balanced overtime hours | OWNER APPROVED; not an earnings or offers-balancing objective. |
| A02 | Leading flexibility goal is mixed staffing by role/date | OWNER APPROVED; no new propagation algorithm implemented. |
| A03 | Cross-team staff tags with preferred/exclusive job pools | REQUIRED by customer and approved plan. |
| A04 | Preferred tagged staff first; existing preferences within groups | OWNER APPROVED selection. |
| A05 | Several selected tags use any-tag membership; deduplicate staff | OWNER APPROVED selection. |
| A06 | Exclusive source explicitly chooses team or tags; hard checks still apply | APPROVED design baseline; retain current jobs until deliberate change. |
| A07 | Preserve memberships on matched workforce updates; identify future impacts | APPROVED design baseline; exact identity-conflict workflow required before coding. |
| F01 | Fairness time window: rolling period, season or YTD | OWNER APPROVED FOR 4D: calendar year-to-date. |
| F02 | How actual hours and planned commitments contribute | OWNER APPROVED FOR 4D: latest operator-verified actual overtime evidence plus saved future overtime commitments in the same calendar year. Canonical staff/shift pairs count once; unresolved or overlapping evidence remains unknown. |
| F03 | Comparison populations and part-time/availability opportunity adjustment | OWNER APPROVED FOR 4D: compare raw overtime hours among otherwise eligible candidates. Do not apply part-time or availability normalization. |
| F04 | Refusals, cancelled work and current refusal bonus | OWNER APPROVED FOR 4D: no refusal bonus in the hours-aware proposal. Existing legacy scoring remains unchanged; cancelled or unsaved work does not add hours. |
| F05 | Ordering between future hours fairness, team preference and fatigue preferences | OWNER APPROVED FOR 4D: preserve current pool, team and fatigue preference order, then compare approved overtime-hour totals. All canonical safety limits remain mandatory. |
| M01 | Fixed staff ineligible: leave open or propose an approved substitute | OWNER APPROVED FOR 4E: retain the fixed conflict and propose a separate eligible manual substitute for operator approval. Never silently replace or alter the fixed instruction. |
| M02 | Fixed scope by count/date and post-scope behaviour | OWNER APPROVED FOR 4E: use the existing occurrence repeat count. After that count, leave occurrences unstaffed unless another saved policy applies; never silently convert to rotation or automatic staffing. |
| D01 | Authoritative regular-work intervals, verification and unknown-data handling | OWNER DECISION FOR 4D: regular working hours are excluded and require no operator entry or review. Existing overtime assignment safety checks remain authoritative; the app makes no claim of complete regular-hours rest coverage. Unknown overtime evidence remains unknown. |
| D02 | Pool maintenance authority, ambiguous re-imports, retirement review and tag audit | PENDING before Stage 4B implementation; expose conflicts instead of guessing. |
| D03 | Exact tag persistence contract and compatibility with existing v2 workspaces | PENDING before Stage 4B implementation; require backup/round-trip/failure evidence. |
| X01 | Adjacent-day restrictions/overrides, general holiday series and extended weekdays | UNAPPROVED research proposals; separate policy/design increments. |
| X02 | New sensitive-clearance or health information | UNAPPROVED; do not infer, import or store it as tag evidence. |

Pending items are visible owner decisions, not defaults delegated to an implementer.
They do not prevent completion of this documentation increment. Implementation of
each dependent capability waits for the corresponding decision and authorisation.

## 5. Phased delivery and acceptance scenarios

| Increment | Deliverable | Exit gate |
| --- | --- | --- |
| 4A — current | This research reconciliation, approved directions, policy register and scenario catalogue | Source-grounded documentation, owner closure recorded, unchanged application and preserved history. Stop here. |
| 4B — proposed | Canonical tags, membership editing and job preferred/exclusive pools | D02/D03 settled; pool behaviour consistent across UI, commands and persistence; no new allocation algorithm. |
| 4C — proposed | Explainable candidate preview for one occurrence | No roster writes; current hard checks/reasons visible; current ranking explained; missing regular-hours facts labelled. |
| 4D — completed locally | One-occurrence hours-aware assisted allocation | F01–F05/D01 settled for this scope; deterministic proposal, operator review, manual staging and fail-closed commit. Stop before 4E. |
| 4E — completed locally | Bounded mixed-policy planning across occurrences | M01/M02 settled; fixed/rotation occurrence-count projection, protected manual assignments, overtime-prioritised manual repairs, shortages, stale-state rejection and atomic operator-controlled save verified. Stop before 4F. |
| 4F — proposed | Absence impact/replacement recommendations | Explicit change preview, bounded churn, revalidation and operator-controlled persistence. |

Each increment ends with a durable checkpoint and stops until resumed. Additional
solver/dependency adoption requires measured need and a separate offline feasibility
decision. No global optimiser, combined algorithm rollout or performance promise is
authorised now. No automatic peer-review/evidence ZIPs or GitHub updates.

Synthetic scenario catalogue for later meaningful tests (not tests executed in 4A):

| ID | Scenario | Expected contract |
| --- | --- | --- |
| T01 | Ranger team has four people; eleven active people across other teams share #ParkRanger | Formal teams remain intact; tag pool exposes participating staff subject to eligibility. |
| T02 | Staff has two selected tags; job selects both, with case-varied labels | Canonical any-tag union; one candidate, no duplicate membership or preference bonus. |
| T03 | Eligible tagged/non-tagged staff have different team tiers | Tagged group first; existing ordering within groups; exclusive gate applied before preference. |
| T04 | Exclusive tag pool is empty, retired or has unresolved references | Visible inability to fill; no unrestricted fallback or hidden team/tag combination. |
| T05 | Tagged person is inactive, absent, exempt, overlapping, inadequately rested, fatigued or lacks required qualification | Same canonical hard checks block every assignment strategy. Membership proves none of these facts. |
| T06 | Crew requires a plant operator but otherwise eligible pool candidates lack one | Crew remains invalid; individual rankings do not imply crew compliance. |
| T07 | Matched workforce re-import and an ambiguous identity match | Preserve confirmed person's memberships; ambiguity reported, no silent transfer. |
| T08 | Tag membership removed/retired while future and past assignments exist | Explain future impacts, retain history, do not silently remove/reallocate commitments. |
| T09 | Three-person one-off/recurring occurrence is partially then fully assigned | Visible assigned cards beside vacancies, then fully staffed display; reload preserves commitments. |
| T10 | Staff have unequal actual hours, planned commitments, part-time availability and unknown history | Label distinct evidence, avoid invented zeros/double-counting; compare owner-approved fairness policies. |
| T11 | Manual, fixed and automatic roles overlap; fixed staff becomes unavailable | Protect manual/history/provenance; show fixed conflict and only use approved fallback. |
| T12 | Overnight/year-boundary work and missing regular-hours intervals | Canonical dates/intervals and rest checks; unknown safety facts visible, no broad safety claim. |
| T13 | Preview is stale, tab lacks ownership, storage fails or staffing is infeasible | No stale/partial write; preserve original bytes/history; explain shortages and failed apply. |

No real customer identities, email addresses, historical workbook values or health
details are required for these fixtures. They will belong solely to Overtime tests.

## 8. Owner-requested allocator usability requirements — 6 October 2026

After Stage 4C and the per-job staffing-section prerequisite, the owner requested the following explicit Staff Allocator features. These requirements are now implemented and locally verified under explicit owner resumption; see `ALLOCATOR_USABILITY_CHECKPOINT.md`. They do not start Stage 4D. The original phase table above describes its historical approved baseline.

| Requirement | Intended behaviour | Current status |
|---|---|---|
| Auto-add eligible/preferred staff | A general allocator button stages eligible candidates in the existing preference order, up to remaining vacancies. Preserve selected staff; respect active team/pool sections, all canonical safety checks and crew requirements. Report shortages. Operator reviews and saves the staged allocation. | Implemented: general staged auto-add works for pool-only, team and unrestricted jobs. |
| Visible candidate division | For a tagged-only job, show its pool members above a visible divider and all other staff below. Within the matching group, distinguish eligible candidates from blocked members and show reasons. Nonmembers and anyone blocked by mandatory checks remain visible but cannot be added. For preferred-only pools, eligible nonmembers remain selectable below the preferred group. | Implemented: matching/other groups retain canonical blocked reasons and disabled Add actions. |
| Tags beside staff names | Show the person's pool hashtags beside their name in candidate and staged/assigned staff cards. Resolve canonical tag IDs to labels; distinguish retired tags, avoid duplicate staff and escape imported text. | Implemented in allocator candidate and staged/assigned cards. |
| Tag-aware smart search | Search allocator staff by canonical pool label with or without the leading hashtag, case-insensitively, alongside existing name/ID/role/team/crew/department matching. Searching changes visibility, never eligibility. | Implemented alongside existing search fields. |
| Pool slicer | Add a pool/tag selector in the allocator slicer row, using the canonical catalogue. It should work with smart search and existing slicers, preserve the candidate division, and never widen job restrictions. | Implemented alongside department and team slicers. |

Implement these as a bounded allocator usability increment before introducing the Stage 4D hours-aware algorithm. Auto-add in this increment uses the existing comparator and stages changes for review; it does not settle or introduce the pending fairness policies. Per-job section switches control restrictions/preferences, while browsing by a staff's team or tag remains available independently.
