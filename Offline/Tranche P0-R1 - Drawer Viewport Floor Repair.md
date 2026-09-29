# Tranche P0-R1 — Drawer viewport-floor repair

## Scope

Repair the known browser-startup error `drawer.closest is not a function` without changing drawer sizing, register state, persistence, lifecycle, or other remediation scopes.

## Cause and repair

`requestAnimationFrame(applyViewportFloor)` passed the browser animation timestamp to a function whose optional argument is a drawer element. The resulting numeric value reached `drawer.closest("tr")`.

The scheduler now invokes `applyViewportFloor()` from a no-argument animation-frame callback, so it measures all Register drawers as intended.

## Changed files

- `src/program-planner/js/drawer-workspace.js`
- `src/AI_INSTRUCTIONS.md` — requires a distinct peer-review ZIP for every completed milestone.

## Verification

- `npm test` — 47 / 47 passed.
- `npm run test:browser` — 37 / 37 passed.
- `node --check src/program-planner/js/drawer-workspace.js` — passed.

## Package

The peer-review ZIP and its SHA-256 sidecar are in `Offline/Zip files for peer review/`. The archive excludes generated `node_modules/` and `test-results/`, while retaining the runnable source, lockfile, tests, governance, and Offline review history.

## Constitutional verification

- Canonical graph changed: no.
- Lifecycle changed: no.
- Persistence/schema changed: no.
- Human decision boundary changed: no.
- Sidebar/UI-surface contract changed: no; this restores the existing drawer-floor scheduler.
- Known release blockers remaining: release-gate evidence still requires reconciliation; this removes the previously known status-UI browser error.
