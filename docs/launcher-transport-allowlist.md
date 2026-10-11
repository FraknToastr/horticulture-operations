# Public launcher transport allowlist

The owner selected `main` as the publication destination for `src/index.html` and all files supporting its NSA and EVT applications. Publishing to `main` does not update `github-replacement` or `overtime-stage3`, and does not change GitHub Pages deployment settings.

## Launcher and runtime source

- `src/index.html` and `src/launcher.css`
- The assets referenced by the launcher in `src/shared/assets/`
- `src/program-planner/`: NSA/EVT entrypoints, shared application source, styles and application documentation
- `src/shared/`: required shared CSS, JavaScript, assets and bundled vendor libraries
- `src/remediation-planner/`: map source and provider configuration used by Space Map
- `src/scripts/static-server.cjs`: development and test server
- Root dependency manifests, browser-test configuration and required test/release scripts
- Self-contained tests and synthetic fixtures for these applications
- Current repository instructions and publication documentation

Use an explicit file allowlist when staging. These directory descriptions are not permission for blanket staging of untracked files.

## Independent Overtime entrypoint

The repository-root `index.html` has an existing Overtime link. This NSA/EVT publication preserves the current `main` root launcher and Overtime entrypoint unchanged. The local `src/index.html` links only to NSA and EVT. Overtime runtime, build outputs, modular development changes and independent tests are not part of this update.

## Exclusions

Do not publish operator or customer workspace exports, local backups, conversion reports, backup-dependent recovery scripts/tests, local Moasure source files, PDFs, rosters, review archives, evidence packages, logs, screenshots, scratch outputs, dependency caches or browser profiles. Preserve local originals. Existing remote history is not deleted or rewritten by this publication.

## Space Map update — 11 October 2026

The main update includes the GPU renderer, lazy tree worker/loader, local bundles
and licenses, MetroMap tile-resolution correction, map radial controls and their
self-contained tests. The existing Overtime entrypoint and runtime remain unchanged.
Local exports, archives, screenshots, logs and unrelated pending edits are excluded.
