# Job Reset repair checkpoint — 6 October 2026

Completed the reset repair in the active `overtime-planner-stage3` app.

## Traced cause

The earlier test used assignments without saved scheduled-commitment snapshots.
Real allocation saves create both. Reset deleted the assignment override, but
the scheduler interprets an absent override as permission to restore staff from
the snapshot. The command therefore returned success while the shift remained
staffed. Both scopes had this defect.

## Repair

Reset retains snapshots unchanged and persists explicit empty assignment
overrides for their affected live occurrences. These are vacancy markers, not
allocations. Preview counts include snapshot-only allocations and exclude empty
markers, so a repeated reset reports no additional assignments cleared.

Current-and-future reset also seals rules originating before today and clamps
their repeat count to past occurrences. Past assignments and provenance remain;
today/future assignments and provenance are cleared. All reset clears the job's
rules and live provenance. The job definition and unrelated jobs are retained.

Rebuilt `index.html` and `dist/hort_ops_offline_planner.html` from modular source.

## Verification

- `node scripts/test_job_reset.cjs`: passes with real allocation saves and real
  canonical storage commits. Covers both scopes, row/detail actions, confirmation,
  cancellation, snapshots, past/today/future shifts, public holidays, spanning
  fixed rules, snapshot-only allocations, permit overrides, unrelated jobs,
  reload, idempotence, validation/storage/concurrent-baseline failures and
  released-writer rejection. Browser workspaces are isolated from operator data.
- `node scripts/test_scheduler.cjs`: passes.
- `node scripts/test_persistence.cjs`: passes.
- `git diff --check`: passes.

The reset regression is also available as `npm run test:job-reset`.
No GitHub publication or changes to the older app tree were made in this repair.
