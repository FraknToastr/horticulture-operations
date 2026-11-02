# Save field edits after focus leaves

NSA/EVT field autosaves now capture edits in memory and persist when focus leaves the field. Explicit submission and business actions remain explicit. No workspace schema changes or Overtime changes.

## Implementation and audit

- Shared `ProgramFieldCommits.register({isDirty, flush})` and `flushAll()` serialize pending field commits. In-flight saves are visible to navigation guards. Completing an older save does not automatically persist newer active typing.
- Quote updates state/previews on input, saves on focusout, validates pending fields and flushes before explicit actions. Pending input survives unrelated workspace notifications and delayed commits. Operational amount follows the same boundary.
- Register edits, Calculator quantity/rate/unit/adjustment fields and legacy Planner inline fields defer persistence until focusout. Field snapshots identify their originating record/work item. Calculator snapshots avoid reading replacement controls inside queued mutations.
- Space Map visibility and polygon classification/rate/unit selections defer writes until focusout. Snapshots retain originating geometry/project context. Placement and geometry previews retain their explicit Approve/gesture rules.
- Scheduler and week editor already capture in-memory drafts and use explicit Save schedule; Budget approval forms/settings/import forms already use explicit submission. Their business submission rules remain unchanged. Search/filter feedback and governed Status dialogs remain explicit UI actions.
- Programmatic module navigation, working-item/owner changes and workspace adoption flush registered edits first. Failed flushes reject navigation; pending drafts remain retryable. Browser shutdown while focused is not a guaranteed asynchronous save boundary.

## Focused verification

- Shared coordinator unit checks cover deferred writes, concurrent waiting, retry after failure and newer active edits remaining unsaved when an earlier commit completes.
- Two Quote desktop cases (NSA/EVT): zero writes while typing, Tab commit, delayed save versus newer typing, navigation/reopen, invalid email blocking navigation, storage failure and retry.
- Two Register/Calculator desktop cases: zero typing writes and persisted canonical address/quantity on blur.
- Two Space Map desktop cases: focused visibility change remains unsaved; blur commits originating geometry.
- Four existing privacy/delayed-save cases pass. A compatibility run initially failed; the final recorded focused run passed all four. Field fixtures were corrected to use an existing address control and canonical `address` output rather than the NSA model's removed `location` alias.
- Syntax checks for changed JavaScript and `git diff --check` pass. No full battery, screenshots, mobile tests, video or traces.

Focused browser rerun: `rtk proxy node node_modules/@playwright/test/cli.js test --config=playwright.desktop.config.cjs --project=core 'privacy-editing|quote-focus-commit|module-field-commits|map-field-focus-save'`.

Changes remain local; no commit or push was requested.
