# Migration Phase 5 checkpoint

Date: 5 October 2026. Status: clean client and cooperative single-writer
integration complete. Stop before Phase 6 until the owner resumes. This is not
Stage 3 release acceptance or authorisation for smart/automatic rostering.

## Resulting client behaviour

- Empty Workforce and Job registries; Workforce comes from the client's User
  Table and Jobs are created by the client. No sample people/jobs, saved rosters
  or historical operational data is loaded. Normal calendar/rate configuration
  remains available.
- Current Schema v2 only. Schema 1, future versions and corrupt saved data
  trigger recovery without overwrite. No automatic legacy import or migration.
- Canonical physical key: `hort_ops_workspace_v2_single_writer_v1`. Auxiliary
  local/session data uses `hort_ops_single_writer_v1:`. Virtual-store enumeration,
  reset, compaction and recovery touch only this namespace. Old raw keys and
  old evidence remain untouched and are not adopted.
- Logical artifact identities remain stable internally: logical
  `hort_ops_workspace_v2` maps to the new physical key, never to old raw data.
- A lifetime exclusive Web Lock is acquired before editable loading or empty
  initialisation. Another tab remains read-only. Try editing explicitly retries
  and reloads current committed data; Release editing blocks writes and releases
  ownership. Frozen owners cannot be displaced by a timeout. Closing/crashing
  the owner permits a surviving tab to acquire and reload.
- Private capability guards app commands, storage facade/driver mutations,
  recovery/reset transactions and editor actions. Read-only controls are clear;
  navigation, validated backup and recovery-evidence export remain available.
  Modal cleanup restores scrolling. Delayed import callbacks from an earlier
  ownership generation are discarded.

## Implementation and compatibility boundaries

New client modules are `clientStorage.js`, `currentWorkspace.js`,
`currentStorage.js` and `writerSession.js`. The client template excludes the
historical storage/migration modules and sample job/workforce/history modules.
Those files remain inactive compatibility/test sources for inherited Node
contracts; they are not the client runtime. No test-only ownership bypass was
added. The standalone compiler remains the sole way to update index/dist.

App startup, driver and recovery views use scoped stores. The header/template
show ownership and truthful read-only status. Editor entry points and raw
virtual-store writes require the capability; existing synchronous transactions
finish before ownership is released. Existing validation, histories, snapshots,
failure reporting and compensation remain in force.

Browser fixtures now wait for ownership and use the virtual stores. One
compensation scenario explicitly establishes pre-restore bytes instead of
depending on implicit legacy loading. Its original assertions remain unchanged.
Original harness bytes are retained in ignored local history.

## Executed verification

| Check | Result |
| --- | --- |
| Retained release regime | 24/24: 17 Stage 1 and seven Stage 2; no failures or blocks |
| Separate Stage 3 contracts | Six gates passed |
| Separate Stage 3 browser verification | All seven checks passed |
| New production writer suite | All 18 checks passed; zero unhandled page errors |
| Review 55–63 | Ten unchanged scripts completed successfully |
| Tooling boundaries | Passed |
| Inherited assertions | All 2,917 lines across 86 files intact and in order |
| Standalone outputs | Index/dist remain byte-identical |

The production suite covers clean startup, source graph, fresh User Table/Job
commands, denied writes without mutation, quota preservation, frozen ownership,
fresh-data handoff, schema rejection, read-only backups, lifecycle handling,
namespace-safe reset, tab closure, actual renderer crash, cancelled acquisition
and read-only recovery export. Page lifecycle events were tested directly;
a complete browser back/forward-cache navigation matrix was not certified.

Node 22.23.2, npm 12.1.0, child-local Playwright 1.61.1 and Chromium
149.0.7827.55 were used. Other engines and Windows Edge were not executed.
Initial regression failures exposed durable-empty/reset and recovery-evidence
initialisation issues; both were corrected and the final suites passed.

Local results: `test_reports/phase5-retained-release-final.log`,
`phase5-stage3-gates.log`, `phase5-stage3-browser-final.log`,
`phase5-inherited-probes.log`, `phase5-review64-reproduction.log` and
`test_reports/phase5/writer-application-results.json`. Protected source/host
hashes and final source/build hashes are in ignored
`history/migration/PHASE5_FINAL_VERIFICATION.json`.

## Open findings and next boundary

Supported cooperative client tabs now have enforced exclusive editing. This
does not prevent arbitrary same-origin JavaScript or developer-tool writes.
Original Review 64 Node reproductions exercise unguarded raw storage and retained
compatibility modules: their three write-window losses and two colour-injection
failures still reproduce. Raw exit zero means reproduction, not release
acceptance. Production concurrency evidence supplements the unchanged probes;
it does not self-approve Review 65 closure.

Colour/HTML injection remains open for Phase 6, along with traceability/evidence
corrections. Finish these before release closure or smart rostering.

NSA/EVT, the earlier Overtime folder, root configuration/launchers and original
source/support workspaces remain unchanged. No staging, commit, merge, push or
review/evidence ZIP generation occurred. Logs, screenshots, generated fixtures,
history and caches remain local and ignored under the Overtime transport policy.

Stop here. Next phase after owner resumption: Phase 6 imported-colour/rendering
security and current traceability/evidence corrections. Preserve clean startup,
Schema v2 and writer controls while addressing those findings.
