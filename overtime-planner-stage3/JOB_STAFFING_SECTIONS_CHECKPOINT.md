# Per-job staffing sections prerequisite checkpoint

Status: completed and verified locally, 6 October 2026. The owner requested section switches after Stage 4C and selected per-job scope. This is a bounded prerequisite; Stage 4D has not begun. No commit, push, deployment, review package or independent approval is included.

## Result and use

Each job has separate **Enable Team Suitability** and **Enable Pools** switches. To restrict a job to pool members: disable Team Suitability, enable Pools, choose **Tagged staff only** and select the exclusive pool tag or tags. Membership in any selected active tag satisfies the existing pool rule. Preferred pools alone affect ordering and do not restrict eligibility.

Turning a section off hides its controls and retains its saved settings, while removing that section's restrictions and ordering preferences. Re-enabling restores them. Both off removes team/pool restrictions and preferences; qualification, employment, absence, overlap, rest, fatigue and crew/plant-operator requirements remain mandatory. An enabled tagged-only restriction with no matching active tags fails closed.

## Implementation contract

- Optional `job.staffingSections` contains exactly boolean `teams` and `pools`. Missing the entire field means both enabled, preserving existing jobs and Schema v2 compatibility. Malformed declarations are rejected by canonical validation; declaring the extension requires the planning validator.
- Team and pool evaluation use Overtime-owned planning helpers. Manual candidate filtering, assisted rotation/propagation and detached candidate previews honour active sections. Team-specific autofill cannot run when Team Suitability is disabled, and a retained preferred-team filter cannot hide pool-only candidates.
- Section changes are staged in the job editor until save. Toggle-only changes retain team/tag/source settings. Deliberately changing the exclusive source synchronizes its legacy aliases and retains the team selection list. Disabled team aliases do not receive hidden defaults during form validation.
- Writer ownership guards the new editor mutation. Read-only peers cannot change switches. Saved previews display active sections, retain canonical safety checks and preserve their zero-write contract. Scheduler job signatures include the switches to invalidate stale boundary caches.
- Job registry descriptions honour active settings, and job CSV exports include the section flags. Canonical workspace export/save/reload retains the settings. Existing allocations are not silently removed and historical snapshots are not rewritten.
- No dependency changes, schema migration, new allocation/scoring/fairness policy or shared NSA/EVT code is introduced.

## Verification

All checks passed on the child-local Node/Playwright/Chromium environment; Chromium version 149.0.7827.55. No expanded Windows/runtime certification is claimed.

| Check | Result |
|---|---|
| `npm run test:staffing-sections` | 17 focused groups, zero browser errors |
| `npm test` | All 24 mandatory retained suites |
| `npm run test:stage3` | All six gates |
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

The focused checks cover all section combinations, strict schema rejection, unchanged legacy defaults, canonical eligibility/preview/rotation agreement, disabled preferences, mandatory safety, staged UI preservation, source-alias transitions, saved reloads, restored pools, nonmember rejection in manual and assisted paths, cache invalidation and read-only peer guards. Desktop 1200×700 and mobile 390×700 views were inspected.

The retained runner required approved execution outside the sandbox after local process spawning returned EPERM; the completed rerun passed all suites. The Stage 4C browser regressions likewise passed with approved Chromium execution. This was a tooling restriction, not an application test failure.

Generated `index.html` and `dist/hort_ops_offline_planner.html` are byte-identical. All 433 tracked host files remain unchanged; the child audit found no changes to preserved history, original constitution or baseline images. The current transport allowlist has 412 unique existing files and excludes local results, images, inventories and scratch outputs. Logs/results/screenshots remain ignored local development outputs; no evidence package was generated.

## Stop point

The owner-requested prerequisite is complete. Stop before Stage 4D. Its fairness, fixed fallback, regular-hours and review decisions remain pending as documented in the Stage 4 baseline and Stage 4C checkpoint. GitHub publication requires a separate request and transport/branch review.
