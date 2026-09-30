# Handoff capsule — Stage 0 complete (Program Planner only)

**Source archive:** `horticulture-operations-detached-branch(1).zip`  
**SHA-256:** `3bc65a0ece717d2ca920fb4c885fa1f3e1c32d34da77415fb11cdbd4d12dfcc7`  
**Stages complete:** Stage 0 intake and source-first reconnaissance. No tests executed. Stage 1 has **not** started. Do not infer release-readiness.

## Non-negotiable scope boundary

The user **excluded the entire Overtime and Workforce Planner** from this independent assessment. Exclude that subsystem's code, tests, governance, release status, prior findings and artifacts. The source ZIP contains 351 regular files, 154 excluded by this instruction; `SOURCE_MANIFEST.csv` tracks the other 197 (business source plus supporting/ancillary material). Do not import findings from the excluded project into this review.

**In-scope applications:** Nature Strip Applications (`src/program-planner/nsa.html`, app ID `uos.horticulture.nsa`, DB `uos-horticulture-nsa-v16`) and Event Space Remediation (`src/program-planner/events.html`, app ID `uos.horticulture.events`, DB `uos-horticulture-events-v16`). They load the same Program Planner implementation and source-level shared modules. `src/remediation-planner` supplies their shared mapping implementation and is in scope to that extent. `src/index.html` is their launcher; separate business application inventory otherwise not proven.

## Authoritative cumulative assessment artifacts

- `STAGE_00_REPORT.md`: findings summary, architecture Mermaid, evidence boundaries, coverage plan.
- `APPLICATION_SCOPE.md`: explicit include/exclude map with embedded Mermaid.
- `BUSINESS_WORKFLOW_MAPS.md`: provisional NSA, EVT, startup/edit/recovery Mermaid diagrams; verified code structure separated from proposed workflows.
- `SOURCE_FIRST_NOTE.md`: original source-first observations re-scoped before governance/test claims.
- `SOURCE_MANIFEST.csv`: retained-path hashes, inspection depth and stage-by-stage plan.
- `FINDINGS_LEDGER.csv`: stable IDs HPA-0001–HPA-0004, each **verification item**, not confirmed defect; preserve IDs and record status changes.
- `CHANGELOG.md`: boundary amendment and generated-file inventory.

**Risk queue:** HPA-0001 public/client-distributed map API token (provisional P1, Stage 3); HPA-0002 reference rates appear in model blank state (provisional P2, Stage 2); HPA-0003 session operator may be shared across routes (provisional P2, Stages 2/4); HPA-0004 external map tile URLs have an offline/deployment dependency (provisional P2, Stages 3/6). None has runtime proof of a defect.

**Inspected:** launcher, route wrappers, config, package script metadata fully; portions of Program Planner HTML/model/app/storage/import and mapping providers. **Not inspected in detail:** remaining 1st-party modules, supplied test assertions, governance contracts, bundled third-party contents, historical docs. No install, test, supplied application code or nested ZIP executed; do not claim tests passed.

## Stage 1 instruction (only after CONTINUE)

Recheck ZIP SHA-256 and the material source hashes before relying on ledger. Read `src/governance/PRODUCT_CONSTITUTION.md`, `PRODUCT_CONTRACTS.md`, `CANONICAL_MODEL.md`, `DECISIONS.md`, `RELEASE_GATES.md`, `UX_RULES.md` and relevant scope/precedence docs. Independently trace their applicability to NSA and EVT and their common modules against source; identify architecture, ownership, dependency and lifecycle contradictions. Inspect the largest JavaScript modules for maintainability/coupling only where code supports a concrete assessment. Never use supplied historical review conclusions as source proof. Deliver Stage 1 incremental Markdown+Mermaid and minimal ZIP with changed findings ledger and new handoff. Stop at stage boundary.
