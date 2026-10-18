# Stage 5 checkpoint — 18 October 2026

**Stage 5 is complete locally; stopped as requested.** It implements the remaining
governance, receipt attribution and bounded CSS work. The [final Markdown report](final-remediation-report.md) and
[self-contained interactive HTML report](final-remediation-report.html) record
the whole five-stage roadmap. Target release readiness remains **UNVERIFIED**;
the original audit is unchanged. No commit or push was performed for Stage 5.

## Owner direction and Stage 3 closure

The owner confirmed that the client has not received the release-ready app and
will receive a clean start without a saved workspace. The two historical sample
budget decisions are closed as not applicable. No budgets were invented or set
to zero, and neither sample was adopted as client data. Automated status
processing must remain paused. See the
[dated owner decisions](stage-3-owner-decisions-2026-10-18.json) and updated
[Stage 3 checkpoint](stage-3-checkpoint.md).

New workspaces, missing status controls and explicit operational resets now
default to paused automation without invented activation attribution. Ordinary
normalization retains explicit saved preferences. Fresh NSA and EVT browser
contexts start with zero operational records and 47 default Rate Items, remaining
paused after reload. Existing operator browser data is not erased automatically;
a clean client handover requires fresh or deliberately cleared browser storage.

## Implementation

- **Governance:** updated eight governance documents/viewer records to follow
  the accepted 1 October explicit-calendar decision. Task Purpose determines
  eligibility; ordinary saves never create or recreate Jobs. Historical ADR and
  dated acceptance wording remain, clearly marked superseded. Runtime Job
  creation behavior was already correct and was not changed.
- **Reversals:** the existing collector adds a required, editable officer field,
  prefilled from the established session key when available. The canonical API
  is now `reversePayment(workspace, paymentId, reason, actor)` and trims/requires
  both values before a new reversal. `payment.reversedBy` survives normalization,
  export/import, persistence and reload. Already reversed commands preserve the
  first actor/reason/time before validating new arguments. Legacy absent actors
  remain absent and the viewer continues to show “Not recorded”.
- **Fallback and failures:** native-dialog fallback permits officer editing;
  blocked session reads permit manual entry. Cancel, invalid input and failed
  durable saves leave receipts and allocations unchanged. Existing first-click,
  section/focus and funding behavior remain covered.
- **CSS:** consolidated exact duplicate inspector/disclosure declarations,
  removed a superseded action-row flex rule and used the existing equivalent
  `--uos-space-2` token. No redesign, theme change or global stylesheet cleanup.
  Both owner themes, light/dark states, six tools, all three collapse levels and
  active/hover/focus icon colours are checked through DOM/computed styles.
- **Caching:** updated the affected script and stylesheet version URLs in the
  shared NSA/EVT document so reopened deployments request the amended files.

## Focused verification and interpretation

| Evidence | Result | Unit |
| --- | --- | --- |
| `stage-5-actor-model-results.json` | 10 passed | Individual NSA/EVT attribution cases |
| Same actor evidence | 2 passed | Attribution/funding file gates; overlaps individual cases |
| `stage-5-clean-default-tests.tap` | 7 passed | Individual blank/reset/preference cases |
| `stage-5-default-model-results.tap` | 4 passed | Model/default/sanitation/status file gates |
| `stage-5-governance-tests.tap` | 17 passed | Governance/Planner cases |
| Main browser run and inspector-only rerun | 17 distinct passed | 15 from main run plus 2 final inspector cases |

Do not add the different units or overlapping model runs into a single total.
See [structured results](stage-5-results.json) for exact case titles, durations
and source files. Final report checks are recorded separately in
[report validation](stage-5-report-validation.json).

Both offline report cases passed: embedded data/Markdown parity, keyboard
filtering/disclosures, zero network/page-console errors, and essential content
with JavaScript disabled. These two report cases are separate from the 17
application browser cases above.

Commands used for the root-owned verification:

```sh
rtk proxy node --test tests/model-v5.test.cjs tests/empty-operational-baseline.test.cjs tests/workspace-sanitation.test.cjs tests/status.test.cjs
rtk proxy node tests/empty-operational-baseline.test.cjs
rtk proxy node node_modules/@playwright/test/cli.js test --config=docs/remediation/nsa-evt-release-2026-10-17/stage-5/playwright.config.cjs
rtk proxy env PLAYWRIGHT_JSON_OUTPUT_FILE=docs/remediation/nsa-evt-release-2026-10-17/stage-5-inspector-browser-results.json node node_modules/@playwright/test/cli.js test --config=docs/remediation/nsa-evt-release-2026-10-17/stage-5/playwright.config.cjs stage5-inspector-styles.spec.js
rtk proxy node docs/remediation/nsa-evt-release-2026-10-17/stage-5/build-report.cjs
rtk proxy env PLAYWRIGHT_JSON_OUTPUT_FILE=docs/remediation/nsa-evt-release-2026-10-17/stage-5-report-browser-results.json node node_modules/@playwright/test/cli.js test --config=docs/remediation/nsa-evt-release-2026-10-17/stage-5/playwright.config.cjs stage5-remediation-report.spec.js
```

The actor evidence records the agent's exact commands and output qualifications;
the governance agent ran the canonical-work and planner-draft-job tests. The
root's four-file run emitted file-level TAP; the direct clean-default run provides
seven named individual cases. Passing tests were not repeated merely to produce
new raw output. No unrelated full suite, screenshots, mobile/device, touch,
videos or traces were run.

## Earlier attempts retained

The first browser attempt ran no tests because the nested config needed a server
working directory. The next stopped on two stale Draft ordinary-payment fixtures;
they now explicitly use deposits, retaining the Stage 2 protection. The main run
then passed 15 cases and exposed two successive inspector-probe assumptions:
sampling the start of a colour transition, then expecting resting colour during
hover/focus. The corrected probe uses real Edit/Cancel and checks each state
independently. Only the two inspector cases were rerun. Their production CSS
required no additional changes.

The first offline report check found an ambiguous select label. The report now
supplies explicit accessible filter names; only its two offline checks were
rerun. The initial result is retained separately.

All raw attempts are retained. The governance documentation test's initial
wording matcher was also corrected before its final passing run. These are
reported as corrections, not hidden or claimed as first-attempt passes.

## Preservation and release limits

The Stage 5 baseline covers 959 tracked files, including the already modified H2
image. [Preservation evidence](stage-5-preservation-results.json) permits only the
explicit Stage 5 source, test and checkpoint changes. The original audit,
historical warning inventory, original/reviewed samples, shipped vendor files,
Overtime and unrelated edits remain unchanged.

MapLibre's critical advisory, full local vendor licence texts and the conditional
PDF.js upgrade remain separate outstanding work. Local desktop HTTP proof does
not certify GitHub Pages or Edge `file://`, and the broader PDF corpus is still
unassessed. Do not call the client release ready until the relevant vendor and
deployment checks are addressed.

Report verification and final preservation checks passed. Stop here; further
work and GitHub publication require another owner request.
