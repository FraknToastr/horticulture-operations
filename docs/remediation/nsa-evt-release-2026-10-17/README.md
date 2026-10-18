# NSA/EVT release remediation — 17 October 2026

This is the implementation checkpoint for the accepted five-stage remediation plan.
The original assessment at `docs/audits/nsa-evt/20261017-094545-local-8545d67/`
remains immutable. This work verifies the local working tree over HTTP in desktop
Chromium. It does not certify GitHub Pages or Edge `file://` operation.

## Agreed boundaries

- Stop after each completed stage for quota management. Resume only when requested.
- Preserve existing edits and keep Overtime independent. Work on `main`.
- No screenshots, mobile/device or touch tests, video, or traces.
- Run only checks affected by changes or necessary after a code amendment.
- No commits or publication without a separate request.
- Draft quotes may accept deposits; regular payments require Issued or Accepted.
- Require an officer name for new receipt reversals; never invent historical actors.
- Persist verification, unresolved issues and the next stage at every checkpoint.
  A failed required check blocks that checkpoint; it does not justify advancing.

## Stage 1 — desktop test alignment and release selection

Update MetroMap tests to direct manual input while retaining credential exclusion,
storage failure, activation label and unfinished-draft checks. Update inspector
tests for full → summary → minimal → full, preserving Undo and immutable saved
geometry checks. Separate desktop Budget lifecycle proof from mobile layout proof.
Add a guarded, explicit desktop release command. Run the changed MetroMap and
inspector cases and complete desktop Budget checks, inspect the wider selection,
record results, then stop.

## Stage 2 — canonical receipt eligibility

Match the UI in the canonical receipt command: allow Draft deposits, allow regular
payments only on Issued or Accepted quotes, block new receipts on Declined quotes,
and retain existing history and reversal access. Verify NSA/EVT, duplicate commands,
save failures and atomic rejection. Record the checkpoint and stop.

## Stage 3 — latest approved workspace warnings

Review the 57 warnings in the latest approved workspace. Make only evidence-based
corrections. Separate owner decisions from safe automatic repairs, preserve the
original, and produce a separately named candidate only when justified. Verify
isolated import, IDs, lineage, round-trip and reload. Record the checkpoint and stop.

## Stage 4 — vendored dependency assessment

Inventory vendored dependencies, licences and advisories. Assess PDF.js 6.4.299 in
an isolated compatibility build with the existing `ensurePdf()` promise, lazy-load
and retry contract, worker/offline behavior and explicit `isEvalSupported: false`.
This is an assessment and proposal, not an automatic shipped-runtime replacement.
Record the checkpoint and stop.

## Stage 5 — governance, reversal attribution and bounded CSS cleanup

Reconcile obsolete automatic-Job clauses with the accepted explicit-calendar ADR.
For new reversals, reuse the session operator or ask for a required officer name;
pass the actor through the canonical command and persist `reversedBy`. Preserve
old records and idempotent repeats. Remove only proven CSS duplication and use
existing shared tokens/classes around Space Map inspector/action buttons, without
redesign. Run focused attribution, persistence, idempotency and computed-style
checks. Produce both Markdown and self-contained interactive HTML assessments.
Record the final checkpoint and stop.

## Desktop command

`npm run test:release:desktop -- --list` lists the reviewed model files and exact
browser cases without running them. `--batch` may be repeated to select `model`,
`core`, `budget`, `metromap`, `adaptive`, `inspector`, `map-draft`, or `gpu`.
With no batch filter the command runs the whole reviewed desktop selection.
The old `test:release` command remains the broader suite, including coverage
outside the desktop policy.

The desktop config disables screenshots, video and traces. Its runtime guard
rejects those APIs, touch/mobile emulation, viewports below 768 pixels and
persistent profiles before the excluded operation occurs. Mixed files have
explicit title filters. Mobile Budget layout coverage is retained separately in
`tests/browser/budget-mobile-layout.spec.js` and is excluded from this command.
The local server cannot be reused, preventing verification against a stale server.

## Current checkpoint

**Stages 1–5 complete locally; stopped on 18 October 2026.** See the
[Stage 1 checkpoint](stage-1-checkpoint.md), [Stage 2 checkpoint](stage-2-checkpoint.md)
and [Stage 3 checkpoint](stage-3-checkpoint.md), followed by the
[Stage 4 dependency assessment](stage-4-checkpoint.md).
The owner authorised Stage 5 after the quota deferral, using the
[Stage 5 plan and handoff](stage-5-resume-plan.md) and its
[saved evidence manifest](stage-5-deferred-evidence.json).
Stage 3 produced a separate workspace candidate. Its three owner decisions are
now closed in the [18 October decision record](stage-3-owner-decisions-2026-10-18.json):
the sample budgets do not apply to a clean client release, and status automation
must stay paused. The original and candidate remain unchanged and are not adopted.
Stage 4 assessed an isolated PDF.js upgrade; shipped PDF.js and MapLibre remain
unchanged. Its dependency advisories and adoption limits remain open.

[Final remediation report](final-remediation-report.md) and
[self-contained interactive report](final-remediation-report.html) record the
completed work, verification and remaining release limits. No commit or push
was performed for Stage 5. See the [Stage 5 checkpoint](stage-5-checkpoint.md).
