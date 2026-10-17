# Stage 3 checkpoint — review complete, stopped

All **57 warnings** in the latest approved NSA workspace have been reviewed.
A separately named candidate resolves **54** legacy catalogue warnings and retains
**three owner decisions**. No financial amount was invented and status automation
remains paused. The approved original has not been replaced or modified.

Work remains on `main`, tracking `origin/main`, based on
`8545d675921297349123e9828e62035981d34889` plus the existing local edits.
Nothing was committed or pushed.

## Warning decisions

| Warning | Count | Disposition |
| --- | --- | --- |
| `RATE_LEGACY_CATALOG_ACTIVE` | 54 | Corrected in the candidate using the existing explicit global-rate migration, with source archives and IDs preserved. |
| `FUNDING_OPERATIONAL_AMOUNT_MISSING` | 2 | Requires authorised Council operational amounts for `NSA-PROJ-0VCASS6` and `NSA-PROJ-186F3X1`. No amount is recorded on the Projects or parent records, and there are no budget allocations supplying evidence. Zero is not assumed. |
| `STATUS_MIGRATION_READINESS` | 1 | Requires an attributed officer's readiness review and decision about enabling automation. The review-required state is preserved. |

The full [57-item inventory](stage-3-warning-review.json) records each affected
entity, warning and disposition. Its health check includes `status-health.js`,
which supplies the readiness warning in addition to the 56 base Data Health warnings.
The three pending decisions are deliberately retained as warnings.

## Migration defect and correction

The existing global-rate migration removed active catalogues while retaining two
Project `catalogId` links to the removed `NSA-CAT-2026` catalogue. This produced two
structural validation errors even though Data Health alone reported no errors.
A focused pre-fix regression reproduced that defect.

`ProgramModel.canonicalizeLegacyGlobalRates()` now archives each uniquely resolved
Project/catalogue link before clearing that obsolete eligibility reference.
Unknown/ambiguous Project links are retained for validation rather than guessed.
A malformed link archive causes rejection without modifying the caller's input.
The entry point's model script version is updated. No schema version changes.

The candidate preserves all rate IDs, prices, units, descriptions, source
provenance and work-type mappings. Its archive contains the exact original
catalogue and 54 rate records, plus the two original Project/catalogue links.
All other operational collections and Project fields are unchanged. Applying the
migration again produces the same result.

## Files and reproducibility

Approved source: `src/sample/nsa-workspace-2026-27-area-pricing-v5.json`

- 173,344 bytes
- SHA-256: `d3424d247bca9586f1a35a7e3e584fa18b637e0bbeb44b0e29da84122c64ec5f`

Candidate: [nsa-workspace-2026-27-global-rates-reviewed-v5.json](../../../src/sample/nsa-workspace-2026-27-global-rates-reviewed-v5.json)

- 254,345 bytes; the additional content preserves migration evidence
- SHA-256: `347b3a039ccfe2d25804d7eff368a1ee875cf233d142232c696e50a95c821781`
- Not adopted, substituted for the approved fixture, or designated a new default

`scripts/review_nsa_workspace_warnings.cjs` verifies the approved source identity,
asserts the permitted changes and builds this separate candidate. It refuses to
overwrite a different existing candidate. `--check` confirms byte-for-byte
reproducibility without writing it.

## Verification

Target: local HTTP, desktop Chromium, Node v22.23.2, Playwright 1.62.0,
Google Chrome for Testing 151.0.7922.34. Both workspace files were imported into
separate fresh browser contexts; external requests were blocked. No operator
workspace or profile was opened.

| Check | Result |
| --- | --- |
| Migration, core v5 model, rate-library and desktop-policy checks | 17 passed |
| Original and candidate isolated import, IDs/lineage, JSON/ZIP round trips and reload | 2 passed |
| Candidate deterministic regeneration check | Passed |
| Original and candidate structural validation | Zero errors |
| Remaining warnings | Original 57; candidate 3 |
| Independent read-only review of migration and candidate delta | No unjustified changes found |
| Protected source, unrelated tests, original audit and earlier evidence | 391 file hashes unchanged |
| Excluded media attachments | 0 |
| `git diff --check` | Passed |

The first browser comparison omitted two documented browser-local rollout markers
that `adoptWorkspace()` intentionally carries into imported workspaces:
`emptyOperationalBaseline` and `registerBaselineSanitation`. A diagnostic run
identified those exact additions. The test now expects their exact current
browser values and keeps the strict comparison of every other entity, reference,
status and migration field. Both final cases pass. Both earlier failed harness
attempts are retained and classified as expectation setup errors.

Verification commands:

```sh
rtk proxy node scripts/review_nsa_workspace_warnings.cjs
rtk proxy node scripts/review_nsa_workspace_warnings.cjs --check
rtk proxy node --test tests/global-rate-workspace-recovery.test.cjs tests/model-v5.test.cjs tests/rate-library-schema.test.cjs tests/desktop-release-policy.test.cjs
rtk proxy env PLAYWRIGHT_JSON_OUTPUT_FILE=docs/remediation/nsa-evt-release-2026-10-17/stage-3-browser-results.json node node_modules/@playwright/test/cli.js test --config=playwright.desktop.config.cjs --project=core tests/browser/reviewed-workspace-recovery.spec.js --reporter=line,json
rtk proxy git diff --check
```

Raw model TAP was captured through an RTK-wrapped Node child-process recorder.
Evidence: [results and source hashes](stage-3-results.json),
[model TAP](stage-3-model-results.tap), [pre-fix regression](stage-3-model-before.tap),
[final browser results](stage-3-browser-results.json),
[first harness attempt](stage-3-browser-attempt-1.json),
[diagnostic harness attempt](stage-3-browser-attempt-2.json),
and [preservation verification](stage-3-preservation-results.json).

## Limits and next stage

This completes the Stage 3 review and justified mechanical correction. The three
owner decisions remain open. Overall production readiness stays **UNVERIFIED**;
the original audit is immutable. No unrelated full-suite, screenshot, mobile,
touch, video, trace, published GitHub Pages or Edge `file://` checks were performed.
Previously verified Danger Zone deletion was not repeated for this data-only
review and narrowly scoped migration correction.

**Stop here for quota management. Next stage: Stage 4, vendored dependency and
PDF.js compatibility assessment.** No Stage 4 or Stage 5 work has started.
