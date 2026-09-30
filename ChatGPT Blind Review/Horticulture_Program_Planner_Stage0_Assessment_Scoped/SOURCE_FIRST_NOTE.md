# Stage 0 — Independent source-first note (re-scoped)

**Archive SHA-256:** `3bc65a0ece717d2ca920fb4c885fa1f3e1c32d34da77415fb11cdbd4d12dfcc7`. Initial archive handling inspected ZIP entries, verified path traversal, symlink, encryption, duplicate-name, per-entry expansion and total expansion limits, then extracted to a disposable directory without executing application code. Archive contains 351 regular files; 154 under the user-excluded component are excluded from the assessment. The in-scope/ancillary manifest tracks the other **197** files. No archive entries are executed in Stage 0.

Before reading supplied test results or governance claims, direct source inspection established:

- `src/index.html:21–29` links to `program-planner/nsa.html` and `events.html`. Both wrappers load `program-planner/index.html` within an iframe and use separate `workspace` values (`NSA`, `EVT`). `app-config.js:11–23` selects separate application IDs, ownership and IndexedDB names; the shared Program Planner scripts implement both workspaces.
- `program-planner/index.html:48–83` exposes Register, Project Planner, Space Map, Cost Calculator, Job Scheduler, Quote Builder, Annual Budget and Data & Settings, with Dashboard and Reports shown as hidden navigation buttons in this HTML. Feature logic remains to be traced.
- `program-planner/js/model.js:229–232,322–355` constructs blank collections, then loads a bundled default rate catalog. This is an observed exception to **literally zero entities** at first use; whether catalog rates constitute operational data is an architectural requirement question, not yet a confirmed defect.
- `program-planner/js/app.js:851–865` reads an existing canonical workspace or activates `ProgramModel.blank()`. Existing-workspace startup repair and migration code exist. `program-planner/js/app.js:635–677` shows queued mutation and validated-save paths. Strict operation under storage failure has **not** been executed.
- `shared/js/storage.js:4–15,29–44` opens route-selected IndexedDB names and defines separate keys/leases. `program-planner/js/storage.js` implements canonical workspace operations and last-verified recovery; backup/restore surfaces exist in `data-workspace.js`.
- `src/remediation-planner/js/model.js`, `map.js` and map-provider config are loaded as **shared mapping dependencies** by both Program Planner routes (`index.html:1115–1116,1161–1163`), not a separately launched application.
- The browser-distributed map-provider config includes an API token (`src/remediation-planner/config/metromaps-provider.js:5`) and the fallback map provider config contains remote tile URLs. No secret value is reproduced in this assessment.

Not yet done: review governance/constitutional content, inspect complete business workflows, execute application or tests, validate actual first-run state, verify key restrictions or determine production deployment/security posture. **No release-readiness verdict is made at Stage 0.**
