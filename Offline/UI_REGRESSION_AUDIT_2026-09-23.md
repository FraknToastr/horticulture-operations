# Horticulture Operations Suite v5.0.0 — UI Regression Audit

Date: 2026-09-23

Disposition: PASS WITH FINDINGS. No source changes were made as part of this audit.

## Scope and evidence

The review used the required primary 1920 × 1080 viewport and targeted 1366 × 768 checks across Register, Planner, Space Map, Cost Calculator / Rate Library, Job Scheduler and Quote Builder.

Automated integrity gates passed:

- Deterministic suite: 81 / 81 passed (`npm test`).
- Complete Playwright browser suite: 61 / 61 passed across 21 specifications, executed in bounded batches.
- Register, Planner and Space Map visual/functional subset: 9 / 9 passed.
- Cost Calculator / Quote focused subset: 9 / 9 passed.

Visual evidence retained for this session:

- Register, Planner and Space Map: `/tmp/ui-audit-*-seeded-{1920x1080,1366x768}.png`.
- Costing, Scheduler and Quote: `/tmp/ui-regression-audit/{costing,scheduler,quotes}-{1920x1080,1366x768}.png`.

## Confirmed regressions

| Priority | Module | Finding | Reproduction / evidence | Recommended minimal remediation |
| --- | --- | --- | --- | --- |
| P1 — High | Cost Calculator / Global Cost Library | At 1366 × 768, Rate Library row action controls fall outside the catalog pane and are not visually or pointer accessible. The Add, Edit and Delete controls are therefore unavailable at that viewport. | Open NSA workspace → Costing → Labour. At 1366 × 768, catalog ends around x=673 while actions begin around x=693. Evidence: `/tmp/ui-regression-audit/costing-1366x768.png`. At 1920 × 1080 the controls are intact. | Introduce a responsive action-column budget at ≤1366 that keeps all three action controls within the catalog pane. If a compact overflow pattern is selected, preserve individually accessible Add, Edit and Delete actions. Add a 1366 geometry and hit-target browser assertion. |

No Critical / P0 data-integrity, commercial-protection, status-history, persistence or workflow failure was reproduced.

## Review evidence gaps

These are not product defects. They prevent the audit from claiming complete automated proof for the stated areas.

| Priority | Area | Gap | Recommended follow-up |
| --- | --- | --- | --- |
| P2 — Medium | Job Scheduler | No direct browser UI specification exists. Empty-state presentation is sound at both audit viewports, but scheduled-job cards, filters, detail/save, week/month switching and responsive populated-state rendering lack proof. | Add a canonical-data browser fixture and acceptance coverage for populated Scheduler workflows at 1920 × 1080 and 1366 × 768. |
| P2 — Medium | Map Location pins | First-click crosshair activation and toolbar mouse dragging are covered, but no acceptance test places a pin and asserts post-save recentering. Keyboard repositioning of the floating toolbar is also untested. | Add a browser test that creates a pin with one click, asserts the saved pin and verifies camera centre after the final render; add keyboard-drag coverage. |
| P2 — Medium | Cost Library accessibility | Tests confirm description/category/state accessibility metadata and focusability, but not the rendered tooltip's visibility or complete-value exposure on keyboard focus. | Add keyboard-focus tooltip visibility/content assertions for long Description, Category and State values. |
| P2 — Medium | Import/export workflow | Deterministic model round-trip protection exists, but the browser UI export → import workflow and duplicate-prevention behaviour are not end-to-end tested. | Add an isolated UI export/import round-trip acceptance test. |
| P3 — Low | Quote Builder | Functional lifecycle coverage and visual checks passed at both audit viewports, but no dedicated responsive/focus/modal browser specification exists. | Add a targeted Quote viewport, modal and visible-focus smoke test. |
| P3 — Low | Performance/event stability | No baseline covers render duration or listener stability for the new floating toolbar, Planner disclosure header and map controls. | Add lightweight stability checks only if manual use identifies lag, duplicate updates or increasing handler counts. |

## Modules that passed this audit

- Register: desktop and 1366 presentation, disclosure drawer and actions showed no clipping or interaction regression.
- Planner: merged section/header rows, right-aligned disclosure control and normal scroll behaviour were intact.
- Space Map: side panel, floating drawing toolbar, Metromaps attribution and map controls remained intact at both viewports.
- Quote Builder: no visual clipping or overflow observed at either audit viewport.
- Job Scheduler: empty-state presentation had no page overflow at either audit viewport; populated state remains a P2 evidence gap.
- Cost Calculator / Rate Library: 1920 presentation and functional suite passed; the P1 responsive action-column defect above remains open.

## Governing next step

Remediate the single P1 Cost Library responsive regression, add its 1366 acceptance test, then rerun the complete browser and deterministic gates. Address the P2 and P3 items as planned coverage work; they do not authorise unrelated module or data-model changes.
