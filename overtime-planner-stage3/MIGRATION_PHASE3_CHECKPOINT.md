# Migration Phase 3 checkpoint

Date: 5 October 2026. Status: tooling portability complete; stopped before
Phase 4. This is a migration checkpoint, not Stage 3 application release
acceptance. PR26_07 remains rejected by Review 64; PR26_08 / Review 65 is the
next corrective sequence.

## Scope and changes

Work remained in `overtime-planner-stage3/` on local branch `overtime-stage3`.
No files were staged, committed, merged or pushed. Existing NSA/EVT work and
the earlier `overtime-planner/` folder were preserved.

- Pinned child-local Playwright packages and added a reproducible lockfile.
  Installed Chromium in the child cache with a child-only installation script.
- Ported browser harness roots and dependencies to a shared Overtime-only
  helper that rejects external packages, roots and browser runtimes.
- Bound retained test subprocesses to the child root and removed inherited
  `NODE_PATH`; retained the original 24 descriptors and exit contracts.
- Bounded static checks and build inputs/outputs to this project. Escaped,
  absolute, URL and symlink references fail before outside reads/writes.
- Added isolated tooling tests and an explicit inherited-probe runner. Copied
  the two Review 64 probe sources verbatim into the active test-source tree,
  so executing them does not depend on the ignored history archive.
- Moved new browser screenshots into ignored report folders and restored the
  two copied historical screenshots to their original approved bytes.
- Added `TOOLING.md`, updated current phase instructions and retained original
  constitutions, signed reviews, application source and historical documents.

No application-domain remediation, shared NSA/EVT code, launcher integration,
automatic packaging or historical replay was introduced.

## Verification

| Check | Result |
| --- | --- |
| Child build | Passed; inherited standalone bytes unchanged |
| Retained release regime | 24/24: 17 Stage 1 and seven Stage 2; no failures or blocks |
| Separate Stage 3 gates | 6/6 passed |
| Stage 1 browser smoke | Passed; zero console/page errors |
| Stage 3 browser smoke | All seven checks passed |
| Tooling boundary tests | Passed; 24 isolated suite invocations and ten escaped build inputs checked |
| Runner contracts | 10/10 plus 8/8 Review 40/41 checks passed |
| Static audit | 54 JavaScript files; no undeclared helper issues |
| Review 55–63 scripts | Ten scripts completed with raw exit zero |
| Review 64 reproductions | Both completed; known vulnerabilities reproduced, still open |
| Host isolation | All 224 baseline host hashes unchanged |
| Original source isolation | All 1,802 inventoried original source/support hashes unchanged |
| Copied application preservation | 131 unchanged baseline files; 14 explicitly approved tooling/package ports |
| Inherited assertions | All 2,917 original assertion lines across 86 files retained in order |

Node 22.23.2, npm 12.1.0, Playwright/Core/Test 1.61.1 and child-local Chromium
revision 1228 were used. Sandbox restrictions initially blocked installation
and some subprocess checks. Approved retries executed those checks; blocked
attempts were not counted as passes.

`index.html` and `dist/hort_ops_offline_planner.html` remain identical with
SHA-256 `775c9e6d9b7b5e533d1498b2a06da96bb8660c7127da0a63b52ba201929bcd36`.
No original application JavaScript, CSS, modular template or runtime behaviour
changed. The 14 approved ports affect package/build/test tooling only.

Local logs are retained in `test_reports/`, including
`phase3-retained-release.log`, `phase3-stage3-gates.log`,
`phase3-browser-smoke-output-boundary.log`,
`phase3-stage3-browser-output-boundary.log`, `phase3-inherited-probes.log` and
`phase3-review64-reproduction.log`. Detailed local verification is in
`history/migration/PHASE3_FINAL_VERIFICATION.json` and the tooling change ledgers.
These raw records, caches, screenshots and history are excluded from GitHub
transport. Necessary source, tests, lockfile, tooling and current documentation
remain eligible for a separately authorised transport review.

## Open findings and next boundary

Review 64 still reproduces lost qualification-suspension, absence and budget
updates across concurrent writers (R64-P0-01). Imported job and staff colour
values still permit inline HTML event injection (R64-P1-02). Historical
manifest self-digest and governance attribution findings also remain tracked;
updated migration instructions do not close the inherited review.

Stop here until the owner resumes. Phase 4 designs and proves one editable
writer per Overtime workspace, with explicit blocked/read-only behaviour and
fail-closed coordination across supported browser modes. It precedes the
concurrency implementation, security/evidence corrections, full closure and
future smart/automatic rostering. Do not infer safe concurrent editing,
supported-mode enforcement or release acceptance from these tooling results.
