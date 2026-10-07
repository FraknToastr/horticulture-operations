# Runtime qualification and deployment boundary

Current candidate: PR26_08. Phase 8 qualification, 5 October 2026.
This is a technical evidence boundary, not a developer-issued release verdict.

## Qualified configuration

Automated application evidence covers Linux, child-local Chromium 149.0.7827.55,
Playwright 1.61.1, Node 22.23.2 and npm 12.1.0. The offline entry points are
`index.html`, `dist/hort_ops_offline_planner.html` and `index.modular.html`, opened
with `file://`. Distribution and index must remain byte-identical. The modular
entry point requires its adjacent project-owned files.

Editing requires a secure browser context, working persistent browser storage and
the Web Locks API. All editing clients must run the current guarded application
graph. One tab owns editing; another can view/export and explicitly try editing
after ownership is released. Reacquisition reloads the committed workspace.
No guarantee extends to arbitrary same-origin scripts, raw compatibility modules,
external storage tools or clients that bypass the writer boundary.

The client starts with empty Workforce and Job registries. It accepts current
Schema v2 only; no historical roster, legacy namespace or migration is adopted.
Browser data belongs to the browser profile and its storage context. A standalone
file is not a backup of the operator's workspace: export workspace JSON separately.
If future deployment uses a web server, require a dedicated Overtime origin and
qualify it separately; do not share an NSA/EVT origin or infer isolation from folders.

## Phase 8 observations

`npm run test:runtime` adds six positive checks. Real navigation away, peer-tab
takeover and saving, return, fresh ownership acquisition and reload preserve the
latest committed data for all three entry points. Read denial, write denial and
rejected lock requests are injected against an actual valid saved Schema v2
workspace. They prevent a successful save and preserve the original bytes. Read
denial enters Recovery Required; rejected locking leaves the client read-only.
These are controlled failure simulations, not certification of every browser's
privacy-mode or administrative-policy implementation.

No persisted `pageshow` was observed during these actual navigation tests: Chromium
reloaded the documents. Phase 5 separately exercises the persisted lifecycle event
handler. Neither result certifies actual back/forward-cache restoration. Windows
Chrome/Edge, Firefox, Safari, mobile, HTTP/HTTPS deployment, private browsing,
storage eviction and long-duration use are not qualified by this automated matrix.
Unsupported capability must fail closed rather than fall back to unsafe editing.

## Owner observation and acceptance

The owner approved Phase 8 and reported testing on Windows 11, browser Version
154.0.4258.53 (Official build), 64-bit, by double-clicking `index.html`. The browser
product name was not supplied. The owner identified a disappearing assigned-job
defect; it was reproduced in automated Linux Chromium testing and corrected in
`FORWARD_PLANNER_ASSIGNMENT_FIX.md`. The original manual observation is not a
successful Windows retest or an explicit release verdict. Limited current capability
and the owner's flexibility/fairness direction are retained as future Stage 4 scope.

The owner subsequently authorises Phase 8 closure and Stage 4 commencement;
corrected PR26_08 is the accepted baseline for that transition. The qualification
boundary and known limitations above remain unchanged. Owner acceptance does not
certify an unreported Windows retest, identify the unnamed browser or supply an
independent Review 65 verdict. Future capability is Stage 4 work.
