# Stage 2 checkpoint — complete, stopped

The canonical receipt command now matches the Quote UI: **Draft quotes accept
deposits; ordinary payments require Issued or Accepted.** City-funded quotes and
Declined/Superseded quotes continue to reject new receipts. Existing transaction
history and reversal access are preserved.

Work remains on `main`, tracking `origin/main`, based on
`8545d675921297349123e9828e62035981d34889` plus the existing local edits.
Nothing was committed or pushed.

## Changes

- `quote-model.js` now checks `receiptEligibility.paymentAllowed` when the payment
  method is anything other than the explicit `Paid with Deposit` method. The
  canonical error matches the existing UI message. Existing funding/status error
  precedence is preserved.
- The shared entry point uses a new quote-model script version so a refreshed
  browser loads the amended command. Existing radial-menu changes are preserved.
- The NSA/EVT funding matrix tests every supported ordinary method, plus the
  omitted-method fallback, across three funding modes and five quote statuses.
  Every command leaves its input unchanged. Additional checks reject invalid
  amount, date, method, reference and allocations without partial entity changes.
- Declined-quote checks retain payment identity, history and allocation reversal.
  Repeating a reversal preserves the first result.
- Two existing tests used ordinary bank transfers as Draft-deposit fixtures.
  They now use the explicit deposit method, retaining their original protection
  and Calculator membership assertions.
- The existing save-failure/repeated-submit browser test now runs for NSA and EVT.
  It also rejects an ordinary Draft payment inside `updateWorkspace`, confirming
  that the candidate Draft and payment are absent from memory and storage. A
  failed deposit commit preserves input; retry plus repeated form submission
  during the pending commit records one receipt.

## Verification

Target: local HTTP, desktop Chromium, Node v22.23.2, Playwright 1.62.0,
Google Chrome for Testing 151.0.7922.34. Synthetic workspaces and disposable browser
contexts were used.

| Check | Result |
| --- | --- |
| Quote funding/receipt, Calculator membership and bulk-deletion model checks | 46 passed |
| Focused desktop browser checks | 11 passed |
| Independent read-only implementation review | No blocking findings |
| Protected source, unrelated tests and prior evidence | 380 file hashes unchanged |
| Screenshots, video or trace attachments | 0 |
| `git diff --check` | Passed |

Browser checks cover both owners' default Customer deposits, funding changes,
Issued payments, first-click evidence/reversal access, Declined receipt controls,
Draft pane alignment, failed commits and repeated submits. The existing Accepted
overpayment/commercial-snapshot case also passes. The canonical eligibility and
atomic-rejection matrices run for both NSA and EVT.

The model invocation was captured through an RTK-wrapped Node child-process
recorder to preserve raw TAP. Its arguments were:

```text
--test tests/quote-funding.test.cjs tests/quote-calculator-membership.test.cjs tests/calculator-bulk-delete.test.cjs
```

The focused browser command was:

```sh
rtk proxy env PLAYWRIGHT_JSON_OUTPUT_FILE=docs/remediation/nsa-evt-release-2026-10-17/stage-2-browser-results.json node node_modules/@playwright/test/cli.js test --config=playwright.desktop.config.cjs --project=core tests/browser/quote-payment-funding-workflow.spec.js tests/browser/quote-first-interaction.spec.js tests/browser/performance-audit.spec.js --grep 'default Customer|saved Draft deposit|first-deposit failure|Accepted Quote handles|first deposit, reversal and evidence clicks|Declined receipts stay disabled' --reporter=line,json
rtk proxy git diff --check
```

The pre-fix focused eligibility command returned failure before the canonical
guard was added. That direct runner captured only file-wrapper diagnostics; its
output is retained without treating it as detailed assertion evidence. The
original immutable audit records the NSA/EVT API mismatch. The final raw TAP and
browser results contain the successful detailed checks.

Evidence:

- [Results and amended source hashes](stage-2-results.json)
- [Model TAP](stage-2-model-results.tap)
- [Exact browser selection](stage-2-browser-selection.json)
- [Browser results](stage-2-browser-results.json)
- [Pre-fix command output](stage-2-model-before.tap)
- [Preservation verification](stage-2-preservation-results.json)

## Limits and next stage

This completes Stage 2; it does not certify the whole application for release.
The original audit remains **UNVERIFIED** and unchanged. Unrelated suites were
not rerun. No mobile, touch, screenshot, video, trace, GitHub Pages or Edge
`file://` checks were performed. Reversal attribution remains assigned to Stage 5.

**Stop here for quota management. Next stage: Stage 3, review the latest approved
workspace's 57 warnings.** No workspace repair or later-stage work has started.
The [accepted plan](README.md) preserves the remaining scope and decisions.
