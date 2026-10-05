# GitHub transport boundary

The approved destination is the host repository's `github-replacement` branch. Overtime remains a separate application in this folder; publishing does not integrate it with NSA/EVT or update `main`.

`GITHUB_TRANSPORT_FILES.txt` is the reviewed, explicit file allowlist for this initial publication. It contains modular and generated standalone source, required compatibility fixtures and test probes, independent build/test configuration, necessary design and handoff documents, constitutional files and governance records. Signed narrative review records remain governance documents, not release approval by the current developers.

Excluded files remain local: `history/`, test reports, raw logs, screenshots, historical hash and detached-copy inventories, archives, one-off peer-package generators, dependencies, caches, browser runtimes and operator exports. No peer-review or test-evidence packages are generated for publication. Tests generate their own results locally. Inactive compatibility modules and synthetic fixtures are required by inherited tests; the client source graph does not load them or adopt legacy data.

The older host `overtime-planner/` folder and its pre-existing tracked log are unchanged. They were already in the destination's history before this migration; this publication adds no historical packages or evidence from the new project and does not rewrite or remove remote history. The host's NSA/EVT files retain their existing publication rules.

Phase 5 is complete, but Stage 3 release acceptance remains open. Colour/rendering security remediation and review traceability are pending Phase 6. Publication is a development checkpoint, not a release certification. See `MIGRATION_PHASE5_CHECKPOINT.md` and `TOOLING.md` for verification and reproducible commands. Browser tests require this project's own Playwright packages and locally installed browser runtime.

Future source/test/document additions require review and an allowlist update. Never use this list to stage ignored local evidence or packages.

## Initial publication verification

The staged allowlist was exported to an independent temporary checkout without excluded history, manifests, evidence or package generators. With its own copies of the project dependencies and browser runtime, it passed all 24 retained release suites, six Stage 3 contracts, seven Stage 3 browser checks, 18 application writer checks, tooling checks and the ten Review 55–63 probes. Generated standalone outputs match each other. The host's 213 Node tests and 27 affected NSA/EVT browser tests also passed. Raw execution results stay local and are not transport files. Original inherited source/governance whitespace was preserved rather than rewriting the migration's historical records.
