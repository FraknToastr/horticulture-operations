# Privacy editing and direct Planner completion

Privacy input warnings previously passed through `title`. Shared tooltip normalization copied them to `data-uos-tooltip`, which remained after privacy was disabled. Privacy input handling now owns its temporary tooltip, restores earlier help, and avoids redundant input-type assignments during editing. Shared tooltips dismiss visible content when their source tooltip changes. Existing Quote rendering preserves the active input value; focused desktop checks confirm typing and selection survive an explicit redraw.

The audit covered the canonical input helper, Quote's compatibility fallback, Register input handling, privacy-change listeners and shared tooltip normalization. Quote and Register use the canonical helper when loaded. Privacy remains enabled by default and protected fields remain masked/read-only while enabled. No financial data or workspace schema changed.

Planner's canonical transition policy now allows task `not_started` → `complete`. Operator attribution and normal history remain required; no additional reason is required for this forward transition. Other domains retain their existing transitions and reopening still requires a reason. Automation remains paused by default.

Verification: `node --test tests/status.test.cjs tests/c5-canonical-status-history.test.cjs` passed both file gates. Two desktop Chromium cases in `tests/browser/privacy-editing.spec.js` passed (NSA and EVT), checking masking, tooltip dismissal, editable state, continuous typing, focus/selection across redraw and preservation of unrelated help. The new spec is included in the desktop release selection. No screenshot/mobile tests were run. Browser fixture setup was corrected to use canonical Register ID prefixes before the final passing run.

Focused rerun: `rtk proxy node node_modules/@playwright/test/cli.js test --config=playwright.desktop.config.cjs --project=core privacy-editing.spec.js`.

No commits or GitHub publication were requested for these changes.
