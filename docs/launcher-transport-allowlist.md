# Public launcher transport allowlist

This is the approved file set that travels with the public launcher rooted at
`src/index.html`. Every future “track, push, and commit” operation that
publishes the launcher must include and verify this set, while excluding local
workspace backups, reports, rosters, screenshots, caches and unrelated working
files.

## Launcher shell

- `index.html` — repository-root GitHub Pages entrypoint
- `src/index.html` — local/source launcher entrypoint
- `src/launcher.css`

## Launcher assets referenced by `src/index.html`

- `src/shared/assets/uos-grid-arrow-favicon.svg`
- `src/shared/assets/Horticulture Operations Suite Backdrop.png`
- `src/shared/assets/uos-logo-forward-dark.svg`
- `src/shared/assets/uos-logo-dot-column.svg`

## Linked application entrypoints

- `src/program-planner/nsa.html`
- `src/program-planner/events.html`
- `overtime-planner/index.html`

`overtime-planner/index.html` is the self-contained public entrypoint. Its
bundled source must be regenerated and reviewed with the Overtime transport
rules before changing it; the modular development files are not implicitly
included by this launcher allowlist.

The application files loaded by those entrypoints remain part of their own
approved source transport sets. This allowlist prevents the launcher from
being committed without its direct assets and entrypoints, but does not grant
permission to publish customer workspace exports or operator data.

## Branch rule

The current publication branch is `overtime-stage3`, tracking
`origin/overtime-stage3`. The repository also has separate `main` and
`github-replacement` branches; updating this branch does not update either of
those branches or change which branch GitHub Pages deploys.
