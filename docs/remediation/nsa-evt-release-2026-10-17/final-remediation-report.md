# NSA/EVT final remediation report — 18 October 2026

<!-- report-data-sha256: 234f0c2cefb9bddde49f96d190da26d67174b9867aed252226cc93b2fe5bd6e3 -->

**All five roadmap stages are complete locally. Release readiness remains UNVERIFIED.**
This assessment covers the working tree after b4e5db9516cb6df3900f1b6ad6d08f2bcf68a35a; it does not certify a later deployment. No Stage 5 commit or push was performed.

## Roadmap

- **Stage 1: Desktop test alignment — complete.** Manual MetroMap activation, current inspector collapse levels and guarded desktop release selection. [Checkpoint](stage-1-checkpoint.md).
- **Stage 2: Canonical receipt eligibility — complete.** Draft deposits remain allowed. Ordinary payments require Issued or Accepted; Declined blocks new receipts. [Checkpoint](stage-2-checkpoint.md).
- **Stage 3: Workspace review and owner decisions — complete.** 54 sample warnings corrected in a separate candidate. All three owner decisions closed: sample budgets do not apply to the clean release; automation stays paused. [Checkpoint](stage-3-checkpoint.md).
- **Stage 4: Dependency assessment — complete.** Inventory and isolated PDF.js 6.4.299 compatibility proposal retained. Shipped runtimes unchanged; dependency risks remain open. [Checkpoint](stage-4-checkpoint.md).
- **Stage 5: Governance, officers and CSS — complete.** Explicit-calendar contracts, named officers for new reversals, paused clean defaults, bounded inspector CSS consolidation and final reports. [Checkpoint](stage-5-checkpoint.md).

## Owner decisions and clean release

All three Stage 3 decisions are closed by the owner's 18 October instruction. The client has not received the release-ready version and will start with no saved workspace. The two absent historical sample budgets are irrelevant to that handover; no amounts were invented. Status automation must stay paused. Original and candidate sample files remain unchanged and are not adopted as client starting data. [Owner record](stage-3-owner-decisions-2026-10-18.json).

New and explicitly reset workspaces now default to paused automation with no invented activation actor/time. Ordinary normalization preserves explicit saved preferences. Two fresh-browser checks confirm empty operational collections, the 47 default Rate Items and paused automation before and after reload. Existing operator browser data was not erased; a clean handover requires fresh or deliberately cleared browser storage.

## Findings

### F-001 — Stale release checks: Remediated

Desktop selection and guarded tests match the current manual-key and inspector workflows. Screenshot/mobile aggregates remain excluded.

### F-002 — Receipt command eligibility: Remediated

The command and UI agree on deposits, ordinary payments and Declined Quotes. Historical receipts and reversals remain accessible.

### F-003 — Historical sample warnings: Owner decisions closed

Two absent sample budgets are irrelevant to a release with no saved workspace. No amounts were invented. The owner confirmed automation must stay paused; historical sample warnings remain truthful.

### F-004 — Automatic Job governance drift: Remediated

Active contracts now require the explicit Planner calendar action. Purpose changes and normal saves affect eligibility without creating or recreating Jobs. Historical rules are retained as superseded.

### F-005 — Vendored dependency risks: Open vendor update

MapLibre 5.3.0 matches critical GHSA-jrc7-96c5-q579. Current attribution is curated, but the affected library still ships. PDF.js 2.16.105 retains its explicit isEvalSupported:false mitigation. Full local licence texts and a separately verified vendor upgrade remain outstanding.

### F-006 — Inspector CSS duplication: Remediated

Consolidated proven duplicate declarations and removed an overridden action-row rule. Existing 8px tokens replace equivalent literals; both owner themes and all three collapse levels were checked using computed styles.

### F-007 — Payment reversal officer: Remediated

New reversals require a trimmed officer name and reason in the UI and canonical command. Session names prefill an editable field. Evidence survives reload; old missing actors remain missing and repeated commands preserve the first evidence.

### RELEASE — Release environment verification: Not verified

These are local desktop Chromium HTTP checks. GitHub Pages, Edge file:// and the broader PDF corpus are not certified. A clean client handover requires fresh or deliberately cleared browser storage; this work does not erase an existing operator workspace.


The MapLibre maintainer's [critical advisory](https://github.com/maplibre/maplibre-gl-js/security/advisories/GHSA-jrc7-96c5-q579) and PDF.js [mitigation advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq) are detailed in the Stage 4 assessment. No shipped vendor replacement occurred here.

## Verification

| Check | Result | Unit |
| --- | --- | --- |
| Reversal attribution, atomic validation, persistence and idempotence | 10 passed | individual model cases |
| Actor and existing funding regressions | 2 passed | model file gates; overlaps the actor cases above |
| Clean/reset defaults and explicit saved preferences | 7 passed | individual model cases |
| Affected model, baseline sanitation and status engine | 4 passed | model file gates; not an individual-case total |
| Governance and explicit Planner Job lineage | 17 passed | individual cases |
| Reversal/funding UI, clean startup and inspector styles | 17 passed | distinct browser cases across the retained run and focused inspector rerun |

These units overlap and must not be summed. Browser proof is 17 distinct cases: 15 passed in the retained main run, then only the two inspector cases were rerun. All selected cases have passing final evidence. Environment: desktop Chromium, local HTTP, 1600 × 1000, Node v22.23.2, Playwright 1.62.0. No screenshot, mobile, touch, video or trace tests were performed.

## Corrections during verification

- [stage-5-browser-attempt-1.json](stage-5-browser-attempt-1.json): No tests ran: nested config needed an explicit server working directory. Corrected configuration.
- [stage-5-browser-attempt-2.json](stage-5-browser-attempt-2.json): Stopped on stale Draft ordinary-payment fixtures. Corrected fixtures to their intended allowed deposit method; production eligibility unchanged.
- [stage-5-browser-attempt-3.json](stage-5-browser-attempt-3.json): 15 passed; inspector probe sampled the start of a colour transition. Corrected probe to exercise real Edit/Cancel with test-only transitions disabled; reran only the two inspector cases.
- [stage-5-inspector-browser-attempt-1.json](stage-5-inspector-browser-attempt-1.json): Inspector-only probe then exposed its separate hover/focus expectation error. Checked owner-soft hover/focus colours and resting active colours independently; both final owner cases passed without further production CSS changes.
- [stage-5-report-browser-attempt-1.json](stage-5-report-browser-attempt-1.json): Report keyboard check found an ambiguous Stage select label. Added explicit accessible filter names and reran only the two offline report checks.

The governance documentation regression initially used an overly narrow wording matcher; it was corrected and all 17 final cases passed. Earlier unsuccessful checks have not been hidden or represented as passing first attempts.

## Preservation and remaining release work

Checked 959 tracked baseline hashes: 24 authorised changes, 935 unchanged and zero unexpected changes. Original audit, both sample workspaces, shipped vendor files, Overtime and unrelated edits remain unchanged. [Preservation evidence](stage-5-preservation-results.json).

Separately scope the outstanding vendor/licence work and target GitHub Pages / Edge local-file checks before calling the client release ready. The PDF.js proposal also needs the broader document corpus and additional failure/entry-point checks identified in Stage 4. No existing operator workspace is automatically deleted by this work.

The [self-contained interactive HTML report](final-remediation-report.html) embeds the same [structured data](stage-5-results.json). The [original audit](../../audits/nsa-evt/20261017-094545-local-8545d67/report.md) remains immutable with its original verdict. Stage 5 is complete; stop here until the owner requests further work.
