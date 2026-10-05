# Repository instructions

## Permanent GitHub branch reminder

This rule applies to `FraknToastr/horticulture-operations` and must be followed across sessions working in this repository.

- Before updating GitHub (including pushes, merges or changes to the default/deployment branch), remind the user that this repository has separate `main` and `github-replacement` branches.
- Identify the current local branch and the exact remote branch or branches that the planned update will affect. Explain that updating one branch does not automatically update the other.
- Verify the current remote branches and local tracking before an update. If branch names or roles have changed, report the current situation rather than repeating stale assumptions.
- As of 5 October 2026, `main` contains the earlier published snapshot and `github-replacement` contains the recent working updates. This is historical context, not a permanent instruction to choose either branch.
- The reminder is informational. Continue with updates already authorized by the user; do not add an extra confirmation step solely because two branches exist.
- Do not switch, merge, overwrite or synchronize branches merely to satisfy this reminder. Follow the user's intended destination and preserve the independent branch histories.
- After an update, report which branch or branches were updated and include the commit or pull-request link where available.
- Keep this instruction tracked in the repository and preserve it unless the user explicitly changes or removes the preference.

Example reminder: "This repository has `main` and `github-replacement`. I am pushing to `github-replacement`; that push will not update `main`."

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
