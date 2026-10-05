# Current Overtime status and evidence attribution

This document supersedes historical status claims for current development without rewriting the constitution, signed reviews or frozen contracts. Consult it with `DEVELOPMENT_TRANSITION.md`, `STAGE4A_CHECKPOINT.md`, `STAGE4_SMART_ROSTERING_BASELINE.md` and `SUPPORTED_RUNTIME.md`. Earlier phase narratives below describe their status at the time and are superseded by current owner authority.

- Original candidate: PR26_07, rejected for Stage 3 closure by Review 64 on 4 October 2026.
- Current corrective candidate: PR26_08, Phase 5 clean-client writer implementation, Phase 6 colour security/traceability, Phase 7 stale-editor correction/domain handoff proof and Phase 8 bounded runtime qualification.
- Stage 1 and Stage 2 remain frozen. Phase 8 is closed and corrected PR26_08 accepted by explicit owner authority for Stage 3 closure and Stage 4 commencement. Stage 4B is implemented and verified locally; stop before Stage 4C until the owner resumes.
- No independent Review 65 verdict is claimed. Closure is the explicit owner decision, not a developer inference from tests or an expanded browser certification.

| Verification regime | Exact attribution | Current command |
| --- | --- | --- |
| Retained release runner | 24 suites: 17 Stage 1, seven Stage 2; none are Stage 3 suites | `npm test` |
| Stage 3 contract runner | Six separate gates, 3A–3F | `npm run test:stage3` |
| Stage 3 browser verification | Seven browser workflow checks, separate from the six Node contracts | `npm run test:stage3:smoke` |
| Production writer verification | 18 application checks; supplements the retained and Stage 3 regimes | `npm run test:writer` |
| Production domain handoff | 15 checks across qualification, same-record absence and budget changes; retained forms discarded on release | `npm run test:handoff` |
| Colour security verification | Seven positive groups, including browser execution and source preservation | `npm run test:security` |
| Review 55–63 retained probes | Ten unchanged scripts; inspect each original contract | `npm run test:inherited` |
| Review 64 historical reproductions | Two unchanged reproduction scripts; raw exit 0 denotes reproduction, not safety | `npm run probe:review64` |
| Tooling boundaries | Independent build/runner/browser-dependency proofs | `npm run test:tooling` |

The original concurrency reproduction remains vulnerable in unguarded compatibility/raw-storage paths. The corrected colour reproduction exits 1 after observing both invalid schema colours rejected and zero injected handlers; it is not relabelled as a conventional passing test. The positive production suites are the new implementation evidence. Node/Chromium versions, actual results and limitations belong in the current checkpoint; raw logs and digest records stay in ignored local storage.

Historical hash inventories do not describe current modified source and must not be used to certify it. Current verification lists only explicit source/evidence files, excludes all manifests including itself, verifies the recorded bytes and separately checks standalone parity. The GitHub transport allowlist is a reviewed file list, not a cryptographic manifest or an assertion that every historical governance statement is current.

Phase 7 adds proof of real cooperative domain edits and retained save callbacks after reacquisition. All editor models are now closed on release. The reviewable handoff is `REVIEW65_CANDIDATE_HANDOFF.md`; it is not an independent Review 65 verdict.

## Phase 8 runtime qualification

`npm run test:runtime` adds six checks, separate from every preceding regime.
Real navigation/peer-save/return/reacquisition/reload succeeds for index,
distribution and modular offline entry points. Valid saved workspace bytes survive
denied reads, denied writes and rejected lock requests; no unhandled page errors.
Actual persisted back/forward-cache restoration was not observed. The automated
boundary remains Linux Chromium 149.0.7827.55, not every browser or deployment.
See `SUPPORTED_RUNTIME.md` for capability requirements and limits.

The owner reports testing but has not yet identified the runtime or issued an
explicit release verdict. Phase 8 approval authorises qualification work; it does
not fabricate independent Review 65 acceptance. Stage 3 remains open. The next
product direction is flexibility and fairness in Stage 4, with policies/design
agreed before implementation and separate authorisation after closure.

## Phase 8 owner-report follow-up — current disposition

The owner supplied Windows 11, browser version 154.0.4258.53 (product name
unspecified), and double-clicked index.html. Their disappearing assigned-job
observation was reproduced: committed snapshots lacked planner display week/day
coordinates in the scheduler projection. The projection is corrected without
rewriting saved history. Six new assignment checks and the complete corrective
regression run pass; see FORWARD_PLANNER_ASSIGNMENT_FIX.md and the updated
MIGRATION_PHASE8_CHECKPOINT.md. This supersedes earlier Phase 8 statements that
runtime identity was entirely pending or no application changes were required.
Acceptance of the corrected candidate is still an explicit independent/owner
decision. Original signed reviews remain unchanged. Stage 4 implementation is not
authorised; flexibility and fairness remain its owner's leading design goals.

## Owner closure and Stage 4A — current authority

The owner explicitly states: "Phase 8 is authorised to be closed, and Stage 4 Smart
Rostering is authorised to begin." Record this as owner closure of migration Phase 8
and acceptance of corrected PR26_08 for the transition from Stage 3 to Stage 4.
No independent Review 65 verdict, additional browser certification or owner retest
is invented. Earlier pending-owner statements are historical checkpoint observations.

Stage 4A is the approved documentation-only first increment, now complete. The owner
selects balancing overtime hours, mixed staffing policies, and cross-team tag pools
with tagged staff first and any-selected-tag membership. The source-grounded design,
policy register and roadmap are in STAGE4_SMART_ROSTERING_BASELINE.md. See
STAGE4A_CHECKPOINT.md. Stop before 4B until resumed; pending policy decisions and
implementation of tags or algorithms are not authorised by this checkpoint.

## Stage 4B current update — completed locally

The owner resumed Stage 4B. Cross-team pool catalogue/membership and job preferred/exclusive source controls are implemented with additive optional Schema v2 fields; all qualification, availability, fatigue/rest and history protections remain authoritative. Eligible active tag matches form a deduplicated any-tag group before existing ranking. Team/tag exclusivity is explicit and tag restrictions fail closed. Workforce imports preserve confirmed memberships and qualifications; ambiguity is rejected.

The authorised work-pattern capability supports up to four consecutive cyclic weekly weekdays, the union with full-day South Australian public holidays and overriding excluded dates, or a one-off one-to-four-day run crossing year boundaries. Each job/date is emitted once and staffed independently. The owner's Saturday/Sunday plus nearly every public holiday requirement uses explicit exceptions; Easter Friday–Monday yields four daily dates without duplicates.

See `STAGE4B_CHECKPOINT.md` for exact fields, compatibility and completed verification. New allocation/fairness algorithms are not implemented. Earlier Stage 4A stop-before-4B statements are historical and superseded by this explicit resumption. All 30 focused Stage 4B checks passed with zero browser errors, alongside all required retained and applicable supplementary suites; stop before Stage 4C until resumed. Original signed reviews remain unchanged, and no independent Review 65 verdict or publication is claimed.
