# Review 65 corrective-candidate handoff

Candidate: PR26_08, after local migration/development Phase 8. Parent assessed candidate: PR26_07, rejected for Stage 3 closure by Review 64. Owner closure of Phase 8 and acceptance for the transition to Stage 4 are now recorded below. No independent Review 65 verdict is claimed. Earlier pending-owner and unauthorised-Stage-4 statements describe the historical handoff.

## Reviewable change

Phase 5 introduced clean current-schema storage, lifetime exclusive browser editing ownership and guarded mutations. Phase 6 constrained imported colours and hardened all identified colour render sinks, while preserving rejected source data. Phase 7 adds real qualification/absence/budget handoff evidence and corrects a stale-form gap discovered by that evidence.

Before the Phase 7 correction, release removed editor HTML but retained the qualification and absence form models. After another tab saved a qualification suspension, the first tab could reacquire editing and an old save callback could restore the prior qualification and unsaved absence note. `js/utils/writerSession.js` now uses the same registered editor boundaries for guarding actions and closing editor models during release. Generation is invalidated and writes are blocked before closing. Existing close methods clear their model and DOM; lock cleanup and explicit fresh-load acquisition remain unchanged. The modular compiler generated matching index/dist copies. There is no new persistence schema, algorithm or application integration.

Review `scripts/test_writer_domain_handoff.cjs` and `npm run test:handoff`. Three fresh browser-context cases use real application commands, actual absence-editor controls and index/dist/modular clients sharing storage. They verify exclusive ownership, denied stale commands, preserved saved bytes, fresh domain reload, deliberately retained save callbacks invoked after reacquisition, a successful fresh UI edit and third-tab cold reload. The budget case uses the actual guarded canonical proposal command; it does not claim a budget form exists. Qualification suspension uses the actual staff update command. The new proof has 15 checks and zero unhandled page errors.

## Reproduce independently

Use this project's own pinned packages and browser installation as described in `TOOLING.md`. From this folder, run:

```sh
rtk proxy npm run build
rtk proxy npm test
rtk proxy npm run test:stage3
rtk proxy npm run test:stage3:smoke
rtk proxy npm run test:writer
rtk proxy npm run test:handoff
rtk proxy npm run test:security
rtk proxy npm run test:tooling
rtk proxy npm run test:inherited
rtk proxy npm run probe:review64
```

Expected positive results: 24 retained suites (17 Stage 1 and seven Stage 2), six separate Stage 3 contracts, seven Stage 3 browser checks, 18 writer checks, 15 domain handoff checks, seven security groups, tooling checks and ten Review 55–63 probes. The final command intentionally returns 1: the untouched colour reproduction no longer reproduces its vulnerability. Its observations are both schema checks false and zero handlers; the untouched raw compatibility-storage concurrency reproduction still observes three losses and returns 0. Inspect the contracts and observations rather than converting those raw exits into acceptance.

## Findings and decision boundary

| Finding | Evidence to assess |
| --- | --- |
| R64-P0-01 | Lifetime exclusive editing, current namespace, real tab/crash/freeze proofs, and the new domain/form handoff proof. Scope is cooperative clients running the compiled graph; raw compatibility modules and arbitrary same-origin scripts are outside that boundary. |
| R64-P1-02 | Canonical colour rejection, trusted-token rendering, seven positive security groups and zero injected handlers in the unchanged reproduction. This is a targeted audit of identified colour/import paths, not certification of unrelated HTML/JavaScript inputs. |
| R64-P2-03 | Historical inventories remain excluded and unchanged. The current ignored verification record lists explicit current sources/evidence, excludes itself and historical inventories and verifies every recorded digest. No package is created. |
| R64-P2-04 | `CURRENT_REVIEW_STATUS.md`, finding dispositions and phase checkpoints distinguish stage attribution, old reproductions and current positive proofs without rewriting signed history. |

Verified runtime is Linux headless Chromium 149.0.7827.55, child-local Playwright 1.61.1, Node 22.23.2 and npm 12.1.0, including the tested `file://` clients. Windows Edge/Chrome, Firefox, Safari, denied storage and a full back/forward-cache navigation matrix are not broadly certified by these results. Owner and reviewer must decide the supported deployment/runtime contract and any additional qualification before release closure.

All peer-review ZIPs, result/evidence packages, raw logs, digest inventories, caches and inactive research remain outside GitHub transport. Narrative handoff and test source are transport documents. No automatic ZIP generation, external review submission, commit or push is authorised by this handoff. Stage 4 smart/automatic rostering remains unauthorised until Stage 3 is explicitly closed and the owner separately approves it.

## Phase 8 evidence and decision summary

Run `rtk proxy npm run test:runtime` for six additional checks. Denial fixtures use
valid application-saved Schema v2 bytes, so failed writes are not explained by
invalid input. Real offline navigation returns to the latest peer-tab state without
allowing stale saves. No persisted pageshow was observed in this matrix; retain that
limitation and distinguish the older synthetic lifecycle-handler proof.

Review `SUPPORTED_RUNTIME.md` and `MIGRATION_PHASE8_CHECKPOINT.md`. The initial qualification changed no application logic. A subsequent owner
report exposed missing week/day coordinates in committed occurrence projections;
`FORWARD_PLANNER_ASSIGNMENT_FIX.md` records the correction and fresh verification. The developer assessment is that
the candidate's remediation evidence supports review for the stated Linux Chromium
offline boundary; this is not an independent verdict or release approval. The
owner reports Windows 11, browser version 154.0.4258.53 (product name unspecified),
and double-clicked index.html. Explicit acceptance of the corrected candidate remains outstanding.
Limited present rostering functionality is recorded as future Stage 4 scope,
with flexibility and fairness the owner's leading goals, rather than a failed
Stage 3 security/integrity correction. Phase 8 does not implement that scope.

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
