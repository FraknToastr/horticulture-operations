# Migration Phase 4 checkpoint

Date: 5 October 2026. Status: single-writer design and isolated browser proof
complete; owner clarified a clean client start. Stopped before Phase 5 application
implementation. This phase concerns Review 64 Gate A, not product Stage 4
rostering development or Stage 3 release acceptance.

## Completed work

- Reviewed the inherited constitution, Review 64 corrective directive and
  concurrency threat model, current storage facade/driver and startup paths.
- Documented the lifetime exclusive-lock policy, fail-closed modes, lifecycle
  rules, alternatives, runtime limits and production integration requirements
  in `R64_TOCTOU_DESIGN_DECISION.md`.
- Added an isolated prototype and browser proof under `scripts/`. Neither is
  imported by the application or compiler. No runtime package was added.
- Verified storage sharing separately from lock availability across main,
  distribution and copied file paths, plus a temporary loopback fixture origin.
- Demonstrated the legacy-copy bypass and tested the proposed new-key isolation.
  Owner clarified no existing client data: fresh namespace, empty registries,
  current Schema v2 only, no legacy import/adoption. No data/key changes made.

## Executed verification

`rtk proxy node scripts/test_single_writer_design.cjs` passed all 18 checks on
child-local Chromium 149.0.7827.55 with Playwright 1.61.1:

- Simultaneous acquisition produced exactly one writer in both tested modes.
- Blocked tabs could neither load editable baselines nor overwrite saved data.
- Explicit handoff loaded the latest saved bytes and blocked the former owner.
- Closing the owner allowed another writer to reload current bytes.
- Missing, rejected and throwing lock APIs and failed reads stayed read-only.
- Failed storage writes reported failure.
- Direct unguarded old-key writes bypassed cooperative locking, as expected.
- Proposed new-key writes remained isolated from historical old-key writers.
- An actual renderer crash released ownership to the surviving tab.
- Cancelling during acquisition prevented late editable initialization.
- A frozen tab retained ownership; the other tab could not steal or write.

The proof used synthetic storage in fresh browser contexts, not user data.
The temporary server existed only during verification and served fixtures;
it is not a new application deployment or runtime requirement. Sandbox socket
restrictions blocked the initial run; the approved retry executed successfully.

Raw evidence is local and ignored:
`test_reports/phase4-writer-design/results.json` and `browser-proof.log`.
Final isolation checks are recorded in
`history/migration/PHASE4_FINAL_VERIFICATION.json`. These files and generated
fixtures must not be published as transport evidence packages.

## Limits and preserved state

No production JavaScript, CSS, template, standalone distribution, dependencies,
host NSA/EVT files or original source/support files changed. The inherited
2,917 assertion lines remain intact. Build parity and the Phase 3 standalone
hash remain unchanged. Full application suites were not repeated: this phase
added isolated design tests and documentation without application integration.

Windows Edge, interactive browsers and other engines were not tested. This
proof does not certify their editing support. Production startup, read-only
UI, lifecycle handling and recovery transactions still require integration
and real browser tests in Phase 5. Review 64's race and injection findings
remain open; no Review 65 or release closure is claimed.

No staging, commit, merge, push, launcher integration or review ZIP generation
occurred. Original signed reviews and constitutions remain unchanged.

## Owner clarification and next phase

The client has no existing or saved data. Use a fresh physical namespace with
empty Workforce and Job registries and current Schema v2 only. Workforce comes
from the client's User Table; Jobs are created from scratch. No legacy import,
automatic migration, sample people/jobs or historical operational data belongs
in the client workspace. Preserve inactive review/test provenance separately.
Do not read or delete unrelated old storage keys. The existing copied loader's
legacy branches must be excluded from active client loading/import behaviour
in Phase 5. This clarification resolves the earlier storage question.

Stop here. After the owner explicitly resumes, Phase 5 implements
the selected boundary, private writer capability, guarded startup/all write
paths, clear read-only controls, lifecycle recovery and production concurrency
tests. Follow with later security/evidence corrections and the complete
inherited release regime before any release acceptance or smart rostering.
