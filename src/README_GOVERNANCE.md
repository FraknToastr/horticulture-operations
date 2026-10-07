# Horticulture Operations Suite — Constitution & Governance Pack

**Version:** 1.5-draft

`governance/PRODUCT_CONSTITUTION_VIEWER.html` is a self-contained offline visual viewer. It is a derived convenience artifact and is currently excluded from governance synchronisation work; the Markdown sources below remain authoritative.

## Authority and update pathway

1. `governance/PRODUCT_CONSTITUTION.md` — highest-order product truths
2. `governance/PRODUCT_CONTRACTS.md` — PC-001 through PC-028 (with detailed PC-020)
3. `governance/CANONICAL_MODEL.md` — ownership, lineage, evidence and UI projection graphs
4. `governance/DECISIONS.md` — accepted decisions and rejected alternatives
5. `governance/UX_RULES.md` — protected interaction rules
6. `governance/RELEASE_GATES.md` — implementation/release proof
7. `AI_INSTRUCTIONS.md` — AI-assisted change-control protocol

## Review methods and project test profile

`governance/Horticulture_Applications_Universal_Engineering_Test_and_Review_Standard_v1.1.md` (HORT-ENG-TEST-001) governs engineering/testing evidence and independent change review. `governance/COMPREHENSIVE_BASELINE_REVIEW_PROTOCOL.md` extends it for whole-codebase, contract/test, documentation, UI language and UI DNA audits. `governance/PROJECT_TEST_PROFILE.md` supplies this product's current risk, runtime, invariants, suites and unresolved acceptance parameters. These are review methods and a profile, not additions to the product-truth authority order above; where they conflict with that order, escalate rather than silently revise a product contract.

## Current governance additions in v1.5

- T-015 through T-019, PC-021 through PC-028: annual owner/year budget authority, Register allocations, immutable adjustments, year closure, carry-forward review and three Job origins.
- PC-020 amendment: one Planner Draft Job is created for an Operational Task; scheduling, costing and Quote inclusion are separate governed actions.
- ADR-013 through ADR-015 record scope, migration and compatibility decisions. Gates O–Q define the release proof; they are currently unproven and release blocking.

## Release verification

Run `npm run test:release` to execute Node tests followed by browser tests. Any failed suite exits nonzero. A green runner alone does not certify PC-001–PC-028: each Critical contract needs recorded proof under `governance/RELEASE_GATES.md`. The offline HTML viewer is derived and has not been regenerated for v1.5; consult the Markdown sources for current authority.

## Earlier v1.4 additions

- PC-014 — retired sidebar surface/system contract
- PC-015 — Location/Polygon full-size sidebar contract
- PC-016 — Scheduler global visibility vs active-project editability
- PC-017 — active-project Draft/Scheduled calendar-day signalling
- Release gates I–L covering source retirement, Location/Polygon UI, Scheduler routing and calendar signalling

The standalone viewer retains a single section-navigation sidebar with scroll-spy and viewport-follow behaviour.
## Conservative test execution

Project changes use impact-scoped verification by default: test the changed module(s), then the directly affected browser or cross-module boundary. Reserve the complete test regime for broad, high-risk, schema/storage/migration, shared-contract, security, release-gate, or release-candidate changes. Every change record must state the targeted tests run, results, and why broader suites were or were not required.
