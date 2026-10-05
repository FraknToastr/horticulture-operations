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
