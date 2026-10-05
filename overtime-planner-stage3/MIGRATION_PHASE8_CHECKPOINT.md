# Migration Phase 8 checkpoint

Date: 5 October 2026. Candidate: PR26_08.
Status: Phase 8 closed and corrected Stage 3 baseline accepted by subsequent explicit
owner authority. Stage 4A design/policy documentation is complete. Earlier pending
acceptance statements below describe the historical checkpoint; see the closure entry.

## Owner runtime and reported defect

The owner reports Windows 11, browser Version 154.0.4258.53 (Official build), 64-bit,
opening index.html by double-click. The browser product name is unspecified.
After resetting, importing the User Table, saving a job and allocating three people,
the assigned occurrence disappeared from Forward Planner. This is a corrective
Stage 3 defect. The observation does not constitute acceptance or a successful
Windows retest of the corrected build.

## Correction

The initial Phase 8 qualification changed no application logic. The subsequent
owner report was reproduced using real assignment buttons: a saved commitment
lacked weekNumber/dayOfWeek in the scheduler's runtime projection. Forward Planner
could not associate its assigned staff with a displayed week/day. The projection
now derives those display coordinates from its slot and canonical date without
rewriting persisted snapshots, provenance or lifecycle rules. Both generated
standalone entry points were rebuilt. See FORWARD_PLANNER_ASSIGNMENT_FIX.md.

## Verification

- Six new planner checks pass: partial/full/reloaded crews for one-off and recurring
  jobs, visible assigned cards, correct counts and reopening the assigned editor.
- Six runtime checks pass: real navigation/peer takeover/return/reload for all three
  offline entry points and failure preservation under denied reads/writes/locks.
- The corrective regression run passes all 24 retained suites (17 Stage 1, seven
  Stage 2), six separate Stage 3 contracts, seven Stage 3 browser checks, 18 writer
  checks, 15 domain-handoff checks, seven security groups, both tooling checks and
  ten unchanged Review 55–63 probes. A final scheduler suite also passes.
- No unhandled browser errors; index/distribution byte parity, JavaScript syntax
  and Git whitespace checks pass. The before-fix failure is retained as a failure.

Automated qualification uses Linux child-local Chromium 149.0.7827.55, Playwright
1.61.1, Node 22.23.2 and npm 12.1.0. Actual back/forward-cache restoration was not
observed. SUPPORTED_RUNTIME.md distinguishes controlled denial fixtures, actual
navigation evidence, owner observations and unqualified browser/OS combinations.
The unchanged Review 64 raw reproductions were not rerun in this follow-up; their
earlier observations are historical and are not promoted to new positive passes.

## Stage 4 direction and acceptance

The owner identifies flexibility and fairness as the leading Stage 4 goals,
alongside greater capability and robustness. Flexible staffing must preserve hard
eligibility, history and operator control. Fairness requires agreed measures,
populations, windows and explanations. No new fairness weight, adjacency rule,
override policy, schema or algorithm is approved or implemented here.

Stage 3 remains open until an independent/owner verdict accepts the corrected
candidate under a stated runtime boundary. The next product work, after acceptance
and separate authorisation, is a bounded Stage 4 design/policy/governance phase.
Do not automatically begin it or fabricate an independent Review 65 verdict.

## Integrity and transport

Only independent Overtime source/test/governance and its generated outputs changed.
All 433 protected host files remain unchanged; no NSA/EVT integration was introduced.
The transport allowlist contains 396 necessary files. Reports, raw logs, screenshots,
digest inventories, inactive research and archives remain excluded. No review ZIP,
evidence package, staging, commit or push was performed. The ignored current
inventory is history/migration/PHASE8_VERIFICATION.json and excludes itself.

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
