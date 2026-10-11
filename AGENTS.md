# Repository instructions

## Permanent main-only branch policy

The owner consolidated the repository on 11 October 2026. `main` is the sole
local and remote branch and contains the latest source, required assets, tests,
build configuration and documentation for `src/index.html` (NSA/EVT) and
`overtime-planner-stage3/index.html` (independent Overtime).

- Work on `main` and track `origin/main`. Do not create additional branches
  unless the owner explicitly requests one.
- Before publishing, verify the current branch, upstream and remote state.
- Keep Overtime's runtime, dependencies and test regime independent of NSA/EVT.
- GitHub updates still require a user request. Report the updated commit link.
- The former `github-replacement` and `overtime-stage3` branch roles are
  historical; do not recreate or recommend them from old documents.

## Permanent Overtime GitHub transport policy

The owner requires future Overtime GitHub publication to contain only what is strictly necessary to transport and independently develop the project: source code and required assets, self-contained tests and fixtures, dependency/build configuration, necessary documents, current governance and constitutional files.

- Do not publish peer-review ZIPs, peer-review-result ZIPs, test-evidence packages, other historical/legacy archives, historical checksum/hash inventories, raw test logs, evidence screenshots, scratch outputs, dependency caches, browser profiles or operator workspace/roster exports.
- Local migration history and verification inventories may remain available for development, but are not the GitHub transport set. Preserve originals locally; do not delete history merely to satisfy publication policy.
- Peer-review packages may be generated locally only on explicit request. Never generate them automatically during development, tests, builds or handoffs, and never add them to GitHub.
- Use an explicit reviewed transport allowlist before publication. Inspect the complete proposed Git tree and branch history, not just extensions or the latest diff. An ignored file that was already tracked or committed remains publishable; `.gitignore` alone does not satisfy this policy.
- Keep transport tests reproducible using included test source/fixtures and locally generated results. If a retained test requires an excluded archive, evidence file or hash inventory, resolve that dependency without weakening the test or silently including the excluded artifact.
- Before a requested GitHub update, identify any existing tracked evidence/history that conflicts with this rule and prepare a clean transport tree/branch as needed. Do not delete remote content or rewrite existing history without explicit authorization.
- No shared NSA/EVT CSS, JavaScript, modules, dependencies, test helpers or test regime is authorized. Overtime remains independent until the owner explicitly approves integration.
- Migration and development are phased: write a checkpoint and stop after each phase until the owner resumes. Preserve the original ChatGPT/Gemini review history as inactive records and retain current constitutional safeguards.

This rule is permanent across sessions and applies to the new `overtime-planner-stage3/` project and any later Overtime publication. Do not commit or push merely because a transport review has passed; GitHub updates require a separate user request.
