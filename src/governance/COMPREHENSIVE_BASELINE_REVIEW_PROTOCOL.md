# Horticulture Operations Suite — Comprehensive Baseline Review Protocol

**Status:** Review method, not a product constitution or a release approval  
**Applies with:** `Horticulture_Applications_Universal_Engineering_Test_and_Review_Standard_v1.1.md` (HORT-ENG-TEST-001) and `PROJECT_TEST_PROFILE.md`  
**Product authority:** `PRODUCT_CONSTITUTION.md` → `PRODUCT_CONTRACTS.md` → `CANONICAL_MODEL.md` → `DECISIONS.md` → `UX_RULES.md` → `RELEASE_GATES.md`, as explained in `../README_GOVERNANCE.md`

## 1. Purpose and decision boundary

Use this protocol for a **whole-product baseline review**, not merely a changed-file peer review. It covers source architecture, business contracts, tests, documentation, UI language and UI DNA across both NSA and Events workspaces and each supported delivery form. HORT-ENG-TEST-001 supplies the evidence, risk, adversarial-testing and gate rules; this protocol supplies the missing whole-product inventory and discipline-specific checks. Neither document changes product authority, authorises implementation, or declares a release ready.

The reviewer records an exact commit or content-hashed snapshot and review date before making findings. A dirty or untracked file is included only when explicitly named in the reviewed snapshot; otherwise mark it outside the baseline. Distinguish **specified**, **implemented**, **tested**, **observed in the delivered artifact** and **release-approved**. These are different states.

## 2. Review contract and coverage register

Before execution, record the review owner, independent reviewer, scope, exclusions, target artifact(s), supported environments, evidence location and requested decision. Confirm the current `PROJECT_TEST_PROFILE.md`; unresolved entries remain `UNKNOWN` and cannot be silently inferred from a green test. Use `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`, `N/A (reason)` or `UNPROVEN` for each check. `KNOWN BASELINE FAILURE` is separately identified, never counted as a pass.

Build one coverage register with stable IDs. Every inventory item must have an owner, applicable authority, evidence reference, status and disposition. The inventory is exhaustive; execution may be risk-prioritised, but unexecuted cases remain visible. At minimum enumerate:

1. Runtime entry points, modes, routes/screens, shared components, scripts, styles, assets, browser-storage stores, import/export and backup formats, external services, distribution artifacts and supported environments.
2. Every constitutional tenet and Product Contract (including PC-001–PC-028), its canonical owner, each reachable create/edit/delete/import/restore/read/export boundary, downstream consumers, release gate and test evidence.
3. Every test file and runner, its requirement IDs, fixture provenance, assertion strength, isolation, current status and inclusion in automated/release commands.
4. Every authoritative, operational, developer and user-facing document, its version, maintainer, intended audience, cross-links and implementation claim.
5. Every screen and reusable UI component family, including empty/loading/error/success/disabled/selected states, overlay/drawer/dialog variants and narrow/zoomed layouts.

No percentage or green suite substitutes for a coverage register with explicitly unproven rows. Record source paths and exact revision-specific line references; do not import old finding line numbers without rechecking.

## 3. Architecture and codebase review

Trace entry point → load order/dependency graph → canonical model/service → persistence → UI projection → export/backup. For each module, record ownership and public contract, caller/consumer set, mutable state, side effects and error/recovery path. Check module boundaries, duplicate business rules, implicit globals, circular/load-order dependence, duplicate listeners, cross-owner leakage and dead or unreachable code. Distinguish deliberate compatibility adapters from competing authorities. Review the actual bundled/portable artifact, not just source modules.

For high-risk paths, inspect validation before mutation, ID and relationship integrity, financial units/rounding, provenance, immutable history, transaction/rollback behaviour, migration/quarantine decisions, cross-tab or stale-state behaviour, and truthful failure presentation. Include budget authority and allocations, Planner/Calculator/Map Job origins, Scheduler state, costing snapshots, Quote Issue and persistence/import/restore. Classify each architectural finding by root cause and affected contracts rather than by symptom count. Recommend a refactor only with a boundary map and behavioural-parity test plan; this review does not itself authorise one.

## 4. Contracts-to-tests traceability and test-suite audit

Maintain a bidirectional matrix:

`Tenet / PC / UX rule / release gate → invariant and legitimate exception → entry boundaries → test IDs and assertions → observed result → missing coverage`.

Also trace each test back to a requirement; unowned tests may be valuable but cannot count as contract proof. For every Critical contract, distinguish positive, negative, boundary, failure/rollback, durable reload, export/restore and delivered-UI evidence where applicable. Inspect fixture construction and setup assertions, real output bytes/state comparisons, meaningful failure messages, deterministic clocks/timezones, isolation and test sensitivity. Detect mirrored implementation assertions, no-op tests, accidental skip/focus, false-green setup, flaky timing and suites omitted from `npm run test:release`. A passing launcher proves only that its included tests passed; reconcile it against `RELEASE_GATES.md` contract by contract.

Run the exact commands and record exit codes, versions, environment and artifact hashes. Apply HORT-ENG-TEST-001 Section 17A to the independent review's test-improvement deliverables. Executable reviewer tests are supplied where feasible and authorised; intentional red defect-reproduction tests are labelled as such. Do not modify production code in an independent review.

## 5. Documentation audit

Inventory and classify constitution, contracts, model, decisions, UX rules, release gates, AI/developer instructions, README/run instructions, schema/API descriptions, user help and generated viewers. For each document, check:

- Authority, status, owner, version/date, amendment path and whether another document contradicts it.
- Factual agreement with the reviewed source, actual commands, file paths, schema, states, workflows and delivered artifact; separate future/draft requirements from implemented capability.
- Completeness of setup, offline use, persistence, backup/restore, migrations, failure recovery, accessibility and known limitations for its audience.
- Broken links, stale screenshots/diagrams, obsolete terminology, missing examples, ambiguous pronouns or approval claims, and generated/derived documents that lag their Markdown authority.
- Traceability of each Critical product claim to a contract, executable evidence or explicit `UNPROVEN` release gate.

Corrective recommendations name the authoritative source to update and the downstream documents/artifacts to synchronise. Do not turn documentation wording into a new business rule without an authorised product decision.

## 6. UI language audit

Create a controlled terminology ledger from the Constitution, Contracts and actual UI. Record canonical term, definition, allowed abbreviation, prohibited synonym, owner and occurrences in navigation, forms, statuses, errors, tooltips, aria labels, exports, printed output and help. Review at least Register, Delivery Project, Task, Job, Rate Item, Category, Rate Library, Resource Calculator, Budget/Allocation/Adjustment, Schedule and Quote language across NSA and Events. Check that distinct lifecycle domains are not collapsed into one vague status.

For each primary journey and failure state, assess action clarity, consistent nouns and verbs, honest permissions/approval claims, useful recovery instructions, concise empty states, accessible names matching visible purpose, spelling, punctuation, casing, truncation/tooltips, units and locale conventions (AUD, GST, July–June financial year, dates and spatial units). Test real long labels and translated-length stress where localisation is in scope; do not claim localisation support without a product requirement. Record copy defects with exact screen/state and replacement proposal, not a general “improve wording” finding.

## 7. UI DNA and interaction audit

Derive the *current intended* visual system from shared tokens/components, `UX_RULES.md`, accepted decisions and actual screens. Record a reviewable component inventory: typography, spacing, density, radii, borders, shadows, colour roles, icon set/size/stroke, button hierarchy and active/hover/focus/disabled states, pills, table anatomy, sticky actions, drawers, dialogs and navigation. Identify any missing design authority instead of treating whichever CSS rule wins as intended design.

For each reusable component family and screen, compare token use and geometry across NSA/Events and modules. Verify horizontal/vertical alignment, icon-label spacing, colour semantics independent of unrelated classifications, equal cap/padding on pills, visible ellipses inside their container, contrast, focus, hit area, scrolling/sticky behaviour, overlay stacking and drawer containment. Specifically apply `UX_RULES.md` drawer floor and ownership/routing rules. Include keyboard-only and screen-reader semantics, reduced motion, zoom/reflow, high-DPI/font differences and agreed desktop/narrow viewports. Inspect default and non-default states with representative long, empty and error data. Capture before/after images with viewport, theme, data and revision metadata; visual diffs require human review and may not be accepted by blindly replacing baselines.

Defects in UI language/DNA are contract or accessibility failures where they violate an approved rule; otherwise classify them as proposed design decisions. Do not invent a new palette, icon policy or design token by review fiat.

## 8. Execution, findings and decision

Start with static inventory and authority conflicts, then run automated suites, then adversarial contract workflows and delivered-artifact/UI checks. Cover every inventory row by review or explicit deferral; prioritise execution by impact, not convenience. Investigate failures and reproducibility before widening the run. Preserve user data and worktree; use synthetic fixtures and isolated browser storage.

Deliver:

- `BASELINE_REVIEW_ASSESSMENT.md`: exact baseline/artifacts, scope, environment, coverage register summary, contract and discipline findings, evidence ledger, limitations and named-gate verdict.
- `CONTRACT_TEST_TRACEABILITY.md`: all tenets/PCs/UX rules/release gates mapped to boundaries, test IDs, assertions and statuses.
- `DOCUMENTATION_AND_UI_AUDIT.md`: document drift, terminology ledger, UI DNA component/state matrix, screenshots and explicit design decisions needed.
- `TEST_IMPROVEMENT_PLAN.md` and reviewer test patch/verification where HORT-ENG-TEST-001 Section 17A requires them.
- A prioritised corrective roadmap with owner, affected authority, dependency, acceptance test and closure gate for each root cause.

Use HORT-ENG-TEST-001 finding severity and verdict vocabulary. A baseline review may conclude **INCONCLUSIVE** when supported platforms, authority or representative data are unresolved. It may identify release blockers, but cannot itself approve release or implement its recommendations. Re-run affected checks after corrections and retain the original baseline and finding IDs for comparison.
