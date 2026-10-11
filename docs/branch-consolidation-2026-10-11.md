# Main-only repository consolidation

Owner instruction: main is the sole branch and holds the latest source, required
assets, self-contained tests, build configuration and documents for the NSA/EVT
launcher at src/index.html and independent Overtime at
overtime-planner-stage3/index.html.

All local and remote branch tips were compared with current main. Older branch
versions do not supersede the current NSA/EVT working source. The complete
432-file Overtime transport allowlist already matches main's Stage 4F source.
Pending NSA/EVT business-date, calculator, accessibility and test changes are
carried forward together with the published GPU map and tree-layer work.

Other branch-only files belong to the older, separate overtime-planner project
and inactive research/history. Local operator exports, rosters, archive packages,
raw logs, screenshots and private-input recovery scripts/tests stay local.
The existing remote commit history is preserved; no force push or history rewrite
is needed. Existing legacy files in that history are not new transport additions.

A verified Git bundle and pending-work patch were retained locally before branch
removal. Neither backup is published. Branch deletion follows successful main
publication and verification. Both applications retain separate dependency and
test configurations. Future work uses main and origin/main.

Verification: the business-date unit checks and 16 focused NSA/EVT browser
checks passed from the prepared main checkout. The 432 Overtime transport files
matched the existing main baseline before the three branch-authority documents
were updated; its runtime, standalone outputs and tests are unchanged.
