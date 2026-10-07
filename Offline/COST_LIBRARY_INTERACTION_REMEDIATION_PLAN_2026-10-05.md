# Cost Library interaction remediation plan

## Evidence and scope

The full release run passed 213 Node tests, four canonical governance tests, and the budget gates (17 model tests and seven browser tests). The main browser suite passed 184 of 193 tests. A sequential rerun of the six affected files passed 24 of 31 tests and reproduced seven failures.

Read-only agent audits identified a CSS conflict in `src/program-planner/styles.css`: the Cost Library's last cell is sticky at the right edge (approximately lines 10928–10934), but the shared table focus rule changes it to relative positioning (approximately lines 11462–11464). When the action column extends beyond the visible panel, focus removes the sticky clamp and moves the button during a click. Recorded pointer events show press on Add and release on the Active pill, followed by no costing line and no command error.

The editor failures show a closed or stale editor after Edit is clicked. A fresh read-only diagnostic confirmed press on the Edit icon, release on the calendar-information icon, and a click on their common action-container element; the editor remained closed and its description empty. Sorting assertions preceding the click pass, and the editor binds its fields synchronously by canonical rate ID before opening. The job-isolation failure shows no new Calculator job, rather than reuse of the existing Planner job. These are likely consequences of unsuccessful action clicks; do not change model logic without evidence remaining after the interaction fix.

## Implementation sequence

1. Correct the focused action-cell CSS.
   - Preserve sticky positioning and its right-edge anchor before, during and after focus.
   - Preserve focus-ring clearance, stable dimensions and appropriate stacking beneath sticky headings.
   - Separate the Cost Library action-cell rule from ordinary Quote and Calculator cell focus rules. Avoid another broad override affecting unrelated controls.
   - Update the stylesheet cache version in the app entry point.

2. Add focused browser coverage for stable, accessible actions.
   - Measure Add, Edit and Delete positions before focus, after keyboard focus, and between real pointer press and release. Require less than one pixel of movement and no unexpected horizontal scroll.
   - Exercise an overflowing desktop library panel and mobile layout, both NSA and EVT, plus light and dark themes.
   - Verify a first Add click creates exactly one costing line; a first Edit click opens the intended rate with the correct values. Test Delete geometry with cancellation so no unrelated records are removed.
   - Include sorted/filtered rows, horizontal scrolling, and an Add after the Scheduler flag changes.
   - Preserve visible keyboard focus and existing Quote/Calculator focus-frame checks.

3. Make workflow tests wait for meaningful completion.
   - After Edit, assert the editor is visible and bound to the expected rate before interacting with its fields.
   - For ordinary sequential additions, await the saved line before the next action. Keep explicit rapid-add coverage separate so intended repeated additions remain supported.
   - Do not use forced clicks, arbitrary sleeps, automatic retries or larger timeouts to mask a moving hit target.

4. Reassess remaining failures after successful click delivery.
   - For dual-path rates, confirm manual addition produces one Calculator line with no geometry link; mapped additions retain their existing behavior.
   - For job isolation, confirm a pre-existing Planner job survives and the Calculator line receives its own reciprocal Scheduler job link.
   - Confirm scheduler-enabled/disabled rates, independent additions, operation idempotency, deletion and save failures retain their current behavior.
   - Change editor or model code only if a delivered command still produces an incorrect result; first add a focused regression proving that separate defect.

## Compatibility protections

No schema migration, historical replay or persisted-data rewrite is planned. Preserve workspace history, status events, financial totals, privacy behavior, application advancement nominations, Planner tasks and all existing job identities and links. Keep Quote focus styling and keyboard operation intact. Do not modify the job-linking rules merely to compensate for an Add event that never occurred.

## Verification and completion

Run the new interaction regression and these six files with one worker: `c6-work-type-rate-mapping.spec.js`, `calculator-line-deletion.spec.js`, `calculator-planner-job-isolation.spec.js`, `canonical-costing.spec.js`, `rate-library-interactions.spec.js`, and `scheduler-costing-refinements.spec.js`. Also run modal focus clearance and the relevant Calculator/rate action-rail tests.

Then run `npm run test:release` at normal concurrency, covering canonical governance, the complete Node/browser suites and budget gates. Any recurrence should capture pointer targets, action geometry, scroll position, editor visibility and saved command outcomes before choosing further changes. Completion requires all suites to pass without masking assertions and a clean diff check. Review and restore any test-generated tracked evidence images that are not intentional deliverables.

Implement locally. Do not commit or push until the user separately requests it. GitHub branches `main` and `github-replacement` remain independent.

## Implementation and verification completed

Implemented locally on 5 October 2026. Cost Library focused action cells retain sticky positioning, right-edge anchoring and stacking; Quote and Calculator focus protection remains in place. The stylesheet cache version was updated. No editor, model, schema or persistence changes were required.

Added action geometry, real pointer routing and visible Tab-focus checks for NSA/EVT, desktop/mobile and both themes, plus first-click Add/Edit and real Delete cancellation. Editor workflows now assert the selected rate is visible and bound before field operations. Sequential additions wait for the first saved line; separate rapid-add coverage verifies distinct work/job identities and reload persistence.

All 41 affected browser checks passed together with one worker. The complete release run then passed four canonical governance tests, 213 Node tests, all 198 browser tests, and budget gates (17 model tests plus seven browser tests). Logs: `/tmp/cost-library-fix-affected.log` and `/tmp/cost-library-fix-full-release.log`. The test-generated tracked evidence image was restored. No commit or push was performed.
