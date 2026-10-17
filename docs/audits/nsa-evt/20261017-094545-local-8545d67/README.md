# NSA / EVT release-readiness audit

Open `report.html` directly for the offline interactive assessment, or read
`report.md`. Both were generated from `results.json`; the report validation
evidence records matching artifact hashes and a successful offline browser check.

The assessment identifies the **local working tree**, including uncommitted map
changes. It does not certify the deployed GitHub Pages version or another browser.
The production recommendation is **UNVERIFIED**, with missing proof distinguished
from application defects and stale test failures.

`evidence/` retains the candidate manifest, original gates, selected/excluded test
inventory, all batch outcomes, synthetic supplements and final preservation proof.
`harness/` retains the original execution and supplementary source. Some original
execution paths point to a disposable `/tmp` source copy; that copy is not an
operator workspace and is not required to browse the report.

For independent reproduction, verify the current source against
`evidence/candidate-manifest.json` and the dependency/runtime metadata first.
Recreate a disposable copy of that exact candidate, with the included fixture
files and installed project dependencies. Use the commands and title selections
in `evidence/execution-plan.json`; retain the media/mobile guard. The original
preflight intentionally refuses to overwrite this audit directory. Reproduction
outputs belong in a new run, not over these results.

Model/API supplements are explicitly labelled; they are not full UI walk-throughs.
Do not use an operator browser profile, execute a destructive check against a
real workspace, run the mixed screenshot/mobile aggregates unchanged, or treat
this assessment as authorisation to fix, commit, push or deploy anything.
