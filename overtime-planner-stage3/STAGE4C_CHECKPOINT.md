# Stage 4C checkpoint: explainable occurrence candidate preview

Date: 6 October 2026. Status: implemented and verified locally. Stop before Stage 4D until the owner explicitly resumes. No GitHub publication or independent review verdict is claimed.

## Authority and scope

The owner instructed this thread to proceed with Stage 4C and explicitly reaffirmed agent approval. The bounded scope follows `STAGE4C_FRESH_CONTEXT_HANDOFF.md`: explain current eligibility and ordering for one saved job occurrence without changing roster data or introducing an allocation/fairness policy. Root integration, verification and this checkpoint retain the final acceptance responsibility; agents implemented the detached model, UI and independent acceptance tests.

Stage 4B pool and work-pattern contracts remain in force. Schema v2, current-only storage, offline operation, historical commitments, the independent Overtime application and all guarded allocation commands remain preserved.

## Delivered behaviour

Use **Preview candidates** beneath a vacancy or assigned occurrence in Forward Planner, or within an occurrence card in Calendar. The same action is available in a read-only peer tab. It opens a separate preview with only refresh and close controls; it does not open the allocation editor.

The preview shows the saved job/date/timing, crew size, qualification requirements, preferred pools, hard team/tag restrictions and team preferences. It separates eligible candidates, excluded workforce records and already assigned staff. Every exclusion includes the canonical applicable reason codes and readable reasons; displayed eligibility is not an allocation promise. Assigned staff who now fail checks remain visible without being removed or replaced. Crew vacancies and the canonical eligible-plant-operator requirement are explained separately.

Eligible candidates use the existing comparator, with its actual preferred-pool grouping, team tiers, fatigue tier and consecutive weekends, job plant-operator preference, existing fair-share score or hours fallback, and name tie-break. The UI explains each row's inputs and the existing formula. No new scoring weights, fairness window, replacement rule or batch allocation is implemented. Hard team restrictions are described independently of the comparator's softer preference flags.

User Table imports and new reconciled records can store numeric zero overtime hours without worked-hours evidence. The preview labels that zero as unverified and explains the input currently used by ranking. Nonzero stored hours also carry no invented verification claim. Missing regular-work intervals remain explicit: absence of a recorded overtime conflict is not proof of adequate rest, and planned commitments are not verified worked hours.

## Saved-state, ownership and persistence boundaries

- `candidatePreviewContext.js` reads through `readVerifiedCommittedV2`, clones the saved envelope and generates canonical occurrences from detached inputs. Unsaved allocation staging and live workforce/job/pool/snapshot drift cannot replace the saved preview context.
- The scheduler's optional detached context uses explicit saved snapshots even when empty, avoids live snapshot fallbacks and leaves assignment validation to the canonical explanation model with explicit saved absence/pool context. Adjacent-year occurrences use the canonical generator and the existing allocation boundary window without changing the live year or boundary cache.
- The model delegates individual and crew checks to the canonical eligibility engine. The comparator now accepts optional explicit `poolTags`; existing callers retain their prior behaviour. The crew validator forwards optional explicit pool/absence context for its eligible-operator check.
- Opening, building, rendering, refreshing and closing have no persistence calls or allocation callback. Saved bytes, workforce, jobs, pools, absences, assignments, snapshots, instructions, provenance and refusal histories remain unchanged.
- Saved bytes, relevant live domain changes, the current local date, viewed year and ownership generation invalidate an open result. The preview polls its signature every second and checks on focus, visibility and application rendering. Stale results remove the eligibility rows until refresh; unreadable/corrupt/missing saved data produces an unavailable state without fallback claims or source replacement.
- Read-only permission is confined to preview entry buttons and this modal's refresh/close buttons. Every existing writer/domain guard remains in place. Release/reacquisition closes the preview and clears its model, timer and listeners; retained preview controls cannot acquire allocation authority.
- Saved text is escaped. The modal contains keyboard focus, locks background scrolling, scrolls internally, keeps header/footer controls accessible and restores scrolling/focus when closed.

## Verification

All commands were run inside this child's independent project using its own dependencies and browser runtime. Initial sandbox subprocess/browser restrictions were rerun with the required execution permission; those blocked attempts were not counted as passing evidence.

| Command | Verified outcome |
| --- | --- |
| `npm run test:stage4c:model` | 11 model groups passed: canonical reasons, exact comparator/context correspondence, assigned crew, imported/missing hours, boundary checks, pool restrictions, preference/source distinctions and detached/frozen input preservation. |
| `node scripts/test_candidate_preview.cjs` | 23 browser groups passed with zero browser errors. Covers real imports, all reasons/current order, saved-vs-live isolation, default-zero evidence, escaped text, no write controls, stale refresh, denied/corrupt/missing saved data, independent allocation rejection, saved crew, overnight/holiday/year boundaries, real saved multi-day runs, read-only peers and ownership transfer. |
| `npm test` | All 24 retained release suites passed: 17 Stage 1 and seven Stage 2. |
| `npm run test:stage3` | All six Stage 3 contracts passed. |
| `npm run test:stage3:smoke` | All seven Stage 3 browser checks passed. |
| `npm run test:writer` | All 18 writer checks passed. |
| `npm run test:handoff` | All 15 domain handoff checks passed. |
| `npm run test:security` | All seven security groups passed. |
| `npm run test:runtime` | All six runtime checks passed. |
| `npm run test:planner:assignments` | All six existing Forward Planner assignment checks passed. |
| `npm run test:stage4b` | All 30 pool/work-pattern checks passed. |
| `npm run test:ordering` | All seven retained candidate ordering scenarios passed. |
| `npm run test:tooling` | Both tooling portability groups passed. |
| `npm run test:inherited` | All ten retained Review 55–63 scripts completed successfully under their original contracts. Historical Review 64 vulnerability reproductions were not relabelled as acceptance checks. |

`npm run test:stage4c` runs the same model and browser scripts together. The final source was rebuilt with `npm run build`, then both focused scripts passed again. Generated `index.html` and `dist/hort_ops_offline_planner.html` are byte-identical. Browser checks include desktop, 390×700 and 800×400 viewports, accessible close/refresh controls, wheel-boundary isolation and modal lock-count restoration. Local desktop/mobile images were inspected for layout and text wrapping.

Observed tooling: Node 22.23.2, npm 12.1.0, child-local Playwright 1.61.1 and Linux Chromium 149.0.7827.55. This is technical verification in the existing Linux browser regime, not new Windows certification or an independent Review 65 verdict. The owner's previously supplied browser product remains unspecified.

Raw results, screenshots, runner scratch files and inventories remain in ignored local `test_reports/` paths. No peer-review ZIP, review-results ZIP or test-evidence package was generated.

## Transport and isolation

The explicit transport allowlist now contains **410 unique existing files**: the prior 403-file handoff list plus the preview stylesheet, three source modules, two self-contained tests and this checkpoint. Source/runtime/build references remain child-local. Dependencies, caches, research, history, logs, screenshots, inventories and scratch outputs are excluded. Prior checkpoint/handoff counts remain historical.

The isolation audit preserves all **433 tracked host files** and **841 local historical/constitution/baseline-image files** byte for byte. Two original root verification images were preserved/restored after regression runners. Original signed review and constitutional material was not edited. No NSA/EVT source, assets, modules, packages, tests or storage identities were shared or changed.

## Limitations and next boundary

This is an explanation of the current saved occurrence and current algorithm. Allocation still independently validates when saving. Regular-work intervals and authoritative worked-hours verification remain absent; F01–F05, M01/M02 and D01 remain pending. The existing full-day South Australian holiday and current runtime boundaries remain unchanged.

Stage 4C ends here. Stage 4D's proposed one-occurrence hours-aware assisted allocation requires the owner's next phase instruction and the relevant fairness/regular-hours policy decisions. No automatic staging, commit, merge, publication, package generation or later phase is authorised by this checkpoint.
