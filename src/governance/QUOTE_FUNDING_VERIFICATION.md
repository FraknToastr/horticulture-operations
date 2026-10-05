# Quote funding verification — 2026-10-01

Implemented City, Customer and co-funded arrangements for NSA and EVT. Customer amounts use `ProgramQuotes.customerAmounts`; work estimates remain separate. Mode and mixed contribution are commercial snapshot fields. City funding and the Calculator delivery-cost basis are captured at Issue for stable documents. Draft customer funding is Proposed, issued is Awaiting acceptance, and accepted is Accepted; acceptance is not an issuance prerequisite.

## Passing checks

- `npm test`: complete Node suite passes (20 test files).
- `node tests/quote-funding.test.cjs`: 11 funding cases pass across both owners. Covers costing-only Labour, exact coverage, shortfalls and surpluses in all modes, City allocation exclusion, retained suggestions/overrides, reload/refresh/revisions, payments and reversal, immutable snapshots, declines, and legacy compatibility.
- `playwright test tests/browser/quote-funding.spec.js tests/browser/quote-itemisation-layout.spec.js --workers=1`: 3 cases pass. Covers actual input, reload, Issue and Accept controls, reports with exact customer contribution/GST/payable amounts, City payment/deposit restrictions, responsive rendering and extracted PDF text in all three modes.
- `playwright test tests/browser/quote-funding.spec.js --repeat-each=3 --workers=2`: 6 repeated concurrent cases pass, including persistence and drawer remounts.
- Budget Gates O/P: 17 model/persistence checks and 7 browser workflow checks pass in the release run.
- `git diff --check`: passes.

PDF verification uses the installed `pdftotext` CLI against PDFs made from the complete live application document and its actual print styles after exercising the hosted Quote Print action. The document snapshot preserves the Register ancestors so hidden-ancestor regressions remain detectable.

## Quote print and totals layout follow-up

The Quote Print action now copies the current sheet into a temporary body-level print host. This prevents the Register drawer's hidden print ancestor from producing a blank page. Before-print also prepares this host for keyboard printing; after-print removes it after printing or cancellation.

Totals use their required label width, with at least 240px reserved for Scope and Description. When both columns cannot fit, totals move below the full scope text. Narrow screens retain a wrapping fallback.

- `playwright test tests/browser/quote-print-layout.spec.js tests/browser/quote-funding.spec.js tests/browser/quote-itemisation-layout.spec.js --workers=1`: 5 cases pass in NSA and EVT. Checks include the hosted Print action, nonblank PDF pages, exact amounts, full multiline scope text, single-line totals labels at A4 width, and print-host cleanup.
- A4 summary screenshots were visually checked. The native Windows print dialog was not manually tested; verification uses Chromium print media and PDF output.

## Broader browser failures

`npm run test:release` is not green. After correcting the funding event race, the complete serial browser run (`playwright test --workers=1`) passes 100 of 107 cases, including every Quote case. Seven failures remain outside the funding workflow:

- `c4-browser-acceptance.spec.js`: mapped geometry removal fixture reads a missing Job ID.
- `c6-work-type-rate-mapping.spec.js`: dual-path Rate/Map expectation mismatch.
- `drawer-viewport-floor.spec.js`: NSA and EVT Calculator tests expect a nonempty Job ID.
- `polygon-job-promotion.spec.js`: Turfing promotion and unknown work-type assertions.
- `workspace-backup-recovery.spec.js`: backup reminder position is 639.9921875 against a minimum of 640.

These failures were retained for review; no unrelated map, Job creation, startup or backup behavior was changed to satisfy them. The full release gate remains failed until the broader failures are resolved.
