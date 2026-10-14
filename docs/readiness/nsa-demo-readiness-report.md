# NSA demonstration readiness

**Not ready.** One confirmed application defect blocks a clean first-use import and recovery flow. The tested reload workaround succeeds; financial, storage-safety and live-map checks passed as detailed below.

Generated: 2026-10-14T08:43:49.139Z

Published app: https://frakntoastr.github.io/horticulture-operations/src/program-planner/nsa.html
Git revision: 840f619adcf80bbf12020d36bb4c50d94f4f5d18
Browser: Microsoft Edge 155.0.4283.45 — Windows, headless, 1600 × 1000
Supplementary Chromium: 151.0.7922.34
Dataset: src/sample/nsa-workspace-2026-27-area-pricing-v5.json
Dataset SHA-256: d3424d247bca9586f1a35a7e3e584fa18b637e0bbeb44b0e29da84122c64ec5f
92 deployed assets matched local source bytes.

Results: **105 passed · 2 failed · 1 blocked · 0 not run**. Two failed scenarios trace to one application defect.

## Findings

### F01 — First import fails in a fresh profile or after deleted-workspace reload

Severity: blocker. Open — no application fix made.

Settings navigation writes durable revision 1 while in-memory revision stays 0. Apply import fails with “Workspace changed before this mutation could be committed. Reload and retry.” The same failure was reproduced after permanent deletion and reload.

**Impact:** Blocks a smooth first-use import or recovery demonstration. No loss of the source file or downloaded backup was observed.

1. Open the published NSA URL in a clean browser profile.
2. Open Data and Settings.
3. Choose the area-pricing v5 JSON and click Apply import.
4. Observe the dialog remains open and Save failed appears.
5. Reload the page, reopen Settings and import the same file: it succeeds.

**Workaround:** Open Settings, reload the page, then select and apply the JSON. Verified in Chromium and Edge. This is an operational workaround, not a fix.

**Next action:** Correct startup/navigation revision synchronisation, add fresh-profile UI import and delete/reload/reimport regressions, obtain publication approval, then retest the deployed fix.

### F02 — Converted workspace has 57 data-health warnings

Severity: warning. Recorded for demonstration preparation.

0 relationship errors; 54 legacy-catalog warnings, 2 missing Council Operational Amount warnings and 1 pending status-migration readiness review.

**Impact:** Do not present status automation as enabled or Council operational funding as already configured. These are inherited data warnings, not failed financial arithmetic.

1. Import the converted file using the verified workaround.
2. Open Data and Settings and click Run checks.

**Workaround:** Use the customer-funded rehearsal path unless the relevant configuration is explicitly reviewed and updated.

**Next action:** Review migration readiness and the two Council funding amounts before demonstrating those behaviours.

### F03 — Import preview does not display entity counts

Severity: note. Observed UI limitation.

The preview shows a signature-inspection message and Apply/Cancel controls, but not the 12 / 2 / 50 / 54 entity counts. Counts were verified after applying and against the input independently.

**Impact:** The operator cannot reconcile entity counts from the preview itself.

1. Choose the converted JSON in Settings.
2. Inspect the staged import dialog before applying.

**Workaround:** Use the report baseline and post-import record checks.

**Next action:** Consider count visibility separately; this report does not introduce a UI change.

## Baseline and recovery

Expected original data: 12 applications, 2 projects, 50 tasks, 54 rates, and no jobs, geometries, quotes or payments.

Prepared Edge profile: C:\Users\n0rt\AppData\Local\Temp\nsa-demo-original-1791954235081

Verified original-data backup: [original-demo-recovery.json](faults-edge/artifacts/original-demo-recovery.json)
Backup SHA-256: 37290099d60800117680ee218e8d8c2a7cb61c74fa2db05c5f44c3449dc8cbaf

1. Keep the original area-pricing v5 file and the verified original-demo-recovery.json backup accessible before presenting.
2. Use the dedicated prepared Edge profile; the existing working browser profile was not changed.
3. If importing into a fresh profile or after deletion: open Settings, reload, then choose the JSON and apply it. Confirm 12 applications, 2 projects, 50 tasks and 54 rates.
4. For Dangerzone demonstration, use a separate disposable profile. Download and keep the required backup before confirming deletion. Never use the prepared demonstration profile as the deletion target.
5. After deletion, Restore Stored Data must not bring the workspace back. Restore from the actual downloaded JSON using the reload workaround, then verify counts and a subsequent save.
6. If any import or save fails, stop entering data. Keep the original file and backups, record the displayed error, reload and repeat only the verified recovery route.

## Demonstration sequence

1. Launch the prepared original-data Edge profile and confirm Register totals. Do not demonstrate a clean-profile first import without acknowledging the blocker.
2. Open an existing project in Planner, expand its sections and show retained task completion. Create another project only in a disposable rehearsal copy.
3. Open Calculator: use the $80/hour rate, quantity 2; expected subtotal $160, GST $16, total $176.
4. Open Quotes: record a $20 deposit, show $156 remaining, then reverse it. Demonstrate Council/Customer switching only after reversal. Mixed customer contribution $60 produces $66 gross; a $15 deposit leaves $51.
5. Issue the customer quote in the disposable copy. Record $44 then $132 to settle $176; reverse both and confirm $176 remains unpaid.
6. Show the draft job in Scheduler, click the 09:00 slot and show 09:00–09:30 with handles. Multi-day, Month view and Outlook behaviours passed the listed supplementary regressions.
7. Show polygon drawing and the Moasure sample. Expand before editing/saving the anchor; collapse should retain the action buttons. Pan/zoom the live aerial map; tree layers require zoom 16/17.
8. Download a complete JSON backup. Keep the prepared original-data profile clean; do the worked example and deletion in disposable copies.

## Test results

### WS01 — Converted dataset integrity

**PASSED** · Hosted • Windows Edge · Workspace

Expected: Expected counts, unique IDs, valid model, stable normalization and linked project/task records.

Observed:

{
  "counts": {
    "applications": 12,
    "costingLines": 0,
    "events": 0,
    "geometries": 0,
    "jobs": 0,
    "payments": 0,
    "projects": 2,
    "quoteEvents": 0,
    "quoteLines": 0,
    "quotes": 0,
    "rateItems": 54,
    "tasks": 50,
    "catalogs": 1,
    "paymentAllocations": 0,
    "statusEvents": 5,
    "statusRecommendations": 0,
    "annualBudgets": 0,
    "budgetEntries": 0,
    "registerAllocations": 0,
    "allocationEntries": 0,
    "budgetCharges": 0,
    "budgetChangeRequests": 0,
    "budgetDecisions": 0,
    "budgetCarryReviews": 0
  },
  "inputSha256": "d3424d247bca9586f1a35a7e3e584fa18b637e0bbeb44b0e29da84122c64ec5f"
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### WS02 — Import preview cancellation

**PASSED** · Hosted • Windows Edge · Workspace

Expected: Real file input previews current-year file; Cancel preserves stored and active data.

Observed:

{
  "preview": "STAGED IMPORT\n\nReview before applying\nWarnings\nMatched by JSON key inspection and exact schema discriminators.\n\nNo workspace data changes until Apply import succeeds.\n\nCancel\nApply import",
  "unchanged": true,
  "countsShown": false
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### WS03 — Apply current-year file through Settings

**PASSED** · Hosted • Windows Edge · Workspace

Expected: All expected entities import and Data Health has no errors.

Observed:

{
  "counts": {
    "applications": 12,
    "costingLines": 0,
    "events": 0,
    "geometries": 0,
    "jobs": 0,
    "payments": 0,
    "projects": 2,
    "quoteEvents": 0,
    "quoteLines": 0,
    "quotes": 0,
    "rateItems": 54,
    "tasks": 50,
    "catalogs": 1,
    "paymentAllocations": 0,
    "statusEvents": 5,
    "statusRecommendations": 0,
    "annualBudgets": 0,
    "budgetEntries": 0,
    "registerAllocations": 0,
    "allocationEntries": 0,
    "budgetCharges": 0,
    "budgetChangeRequests": 0,
    "budgetDecisions": 0,
    "budgetCarryReviews": 0
  },
  "health": "0 errors · 57 warnings · 14 enforced product contracts checked"
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### WS04 — Reload and second-tab persistence

**PASSED** · Hosted • Windows Edge · Workspace

Expected: Imported entity content survives reload and a second tab.

Observed:

All entity collections retained with identical business content.

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### WS05 — JSON download and fresh-context recovery

**PASSED** · Hosted • Windows Edge · Workspace

Expected: Actual downloaded JSON restores complete imported entity content.

Observed:

{
  "artifact": "artifacts\\workspace-backup.json",
  "sha256": "9896c3b4f31dc6e79c128f37454013739a732352f71c0d957d6da46f50463293"
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### WS06 — JSON drop import

**PASSED** · Hosted • Windows Edge · Workspace

Expected: Dropping the latest file stages it; cancellation preserves active data.

Observed:

Drop staged preview; cancel retained baseline.

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### WS07 — Malformed JSON import rejection

**PASSED** · Hosted • Windows Edge · Workspace

Expected: Unsafe file cannot replace active or stored data.

Observed:

The selected JSON is malformed: Expected property name or '}' in JSON at position 1 (line 1 column 2). No data was changed.

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### WS08 — Wrong app import rejection

**PASSED** · Hosted • Windows Edge · Workspace

Expected: Unsafe file cannot replace active or stored data.

Observed:

The JSON content does not match a supported import signature. No data was changed.

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### WS09 — Unsupported schema import rejection

**PASSED** · Hosted • Windows Edge · Workspace

Expected: Unsafe file cannot replace active or stored data.

Observed:

The JSON content does not match a supported import signature. No data was changed.

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### WS10 — Temporary clear and restore

**PASSED** · Hosted • Windows Edge · Workspace

Expected: Clear Session Data removes memory data but Restore Stored Data recovers it.

Observed:

Session cleared; stored entity content restored.

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### DZ01 — Required backup, Cancel, Escape and reopen

**PASSED** · Hosted • Windows Edge · Dangerzone

Expected: Cancel retains data; reopening and Escape reset the required-backup gate.

Observed:

All cancellation and backup gates passed.

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [faults-edge/workspace-results.json](faults-edge/workspace-results.json)

### DZ02 — Stale backup cannot delete newer revision

**PASSED** · Hosted • Windows Edge · Dangerzone

Expected: UI deletion refuses an older backed-up revision after a second-tab save.

Observed:

{
  "backedUpRevision": 2,
  "message": "Failed to delete stored workspace: Workspace changed before this mutation could be committed. Reload and retry."
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### DZ03 — Delete, reload, then restore without the reload workaround

**FAILED** · Hosted • Windows Edge · Dangerzone

Expected: Canonical/recovery state is removed, stale tabs cannot resurrect it, EVT is preserved, actual backup restores and can save.

Observed:

Deletion removed the canonical, verified, migration and legacy records. Restore Stored Data and a stale tab did not resurrect them; EVT data was unchanged. After reloading the empty app, direct reimport of the downloaded backup failed with the same revision mismatch as COLD01. DZ04 subsequently restored that exact backup using the tested reload workaround and saved another change.

Notes: One composite scenario: the deletion/isolation assertions passed; the final direct recovery assertion failed. This is the same underlying defect as COLD01, not a second independent defect.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### WS11 — CSV/GeoJSON bundle download and recovery

**PASSED** · Hosted • Windows Edge · Workspace

Expected: Alternative export is a valid ZIP and reimports supported entity content.

Observed:

{
  "counts": {
    "applications": 12,
    "events": 0,
    "projects": 2,
    "jobs": 0,
    "tasks": 50,
    "catalogs": 1,
    "costingLines": 0,
    "rateItems": 54,
    "geometries": 0,
    "quotes": 0,
    "quoteLines": 0,
    "payments": 0,
    "paymentAllocations": 0,
    "quoteEvents": 0,
    "statusEvents": 5,
    "statusRecommendations": 0,
    "annualBudgets": 0,
    "budgetEntries": 0,
    "registerAllocations": 0,
    "allocationEntries": 0,
    "budgetCharges": 0,
    "budgetChangeRequests": 0,
    "budgetDecisions": 0,
    "budgetCarryReviews": 0
  },
  "sha256": "e892ba445fc08ce99108e0fee0bd13b9bf355a7067ff4091a5bc4bd0d7722f53"
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### WS12 — Stale import preview

**PASSED** · Hosted • Windows Edge · Workspace

Expected: A second-tab save prevents stale preview from overwriting newer records.

Observed:

Workspace changed before this mutation could be committed. Reload and retry.

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### DEP01 — Published asset parity

**PASSED** · Hosted • Windows Edge · Deployment

Expected: All inspected same-repository deployed assets match local source bytes.

Observed:

{
  "checked": 89,
  "matched": true
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### DEP02 — Workspace runtime errors

**PASSED** · Hosted • Windows Edge · Deployment

Expected: Workspace lifecycle does not produce unhandled browser exceptions.

Observed:

No unhandled page errors during workspace scenarios.

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [edge/workspace-results.json](edge/workspace-results.json)

### DEMO01 — Register and Planner converted records

**PASSED** · Hosted • Windows Edge · Register / Planner

Expected: Both projects and completed Planner tasks retain their converted relationships.

Observed:

{
  "projects": 2,
  "tasks": 50,
  "completed": 1
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [demo-edge-retest/workspace-results.json](demo-edge-retest/workspace-results.json)

### COST01 — Converted Cost Library categories and scheduler flags

**PASSED** · Hosted • Windows Edge · Cost Library

Expected: Material items remain Material and do not offer Scheduler creation.

Observed:

{
  "groups": {
    "Labour": 7,
    "Sundry": 6,
    "Material": 38,
    "Contractors": 2,
    "Equipment": 1
  },
  "materialSchedulerEnabled": 0
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [demo-edge-retest/workspace-results.json](demo-edge-retest/workspace-results.json)

### COST02 — Add converted hourly rate and check amount

**PASSED** · Hosted • Windows Edge · Calculator

Expected: Two hours at $80 produce $160 before GST and $176 including 10% GST.

Observed:

{
  "quantity": 2,
  "rate": 80,
  "subtotal": 160,
  "gst": 16,
  "total": 176,
  "linkedJob": true
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [demo-edge-retest/workspace-results.json](demo-edge-retest/workspace-results.json)

### QUOTE01 — Initial Customer deposit and funding changes

**PASSED** · Hosted • Windows Edge · Quotes / Payments

Expected: Deposit works without toggling; reverse releases lock; Council disables payment; mixed balance reconciles.

Observed:

{
  "gross": 176,
  "initialDeposit": 20,
  "initialBalance": 156,
  "mixedCustomerGross": 66,
  "mixedDeposit": 15,
  "mixedBalance": 51,
  "reversed": true
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [demo-edge/workspace-results.json](demo-edge/workspace-results.json)

### QUOTE02 — Issue, payment, full settlement and reversals

**PASSED** · Hosted • Windows Edge · Quotes / Payments

Expected: Issued quote accepts $44 then $132; reversing both restores $176 unpaid.

Observed:

{
  "payments": [
    44,
    132
  ],
  "settled": true,
  "reversedBalance": 176
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [demo-edge/workspace-results.json](demo-edge/workspace-results.json)

### SCH01 — Converted-rate job direct calendar placement

**PASSED** · Hosted • Windows Edge · Scheduler

Expected: Draft job opens editor; 09:00 click creates 09:00–09:30 with handles and no modal.

Observed:

Direct 30-minute placement has no modal.

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [demo-edge-retest/workspace-results.json](demo-edge-retest/workspace-results.json)

### MAP01 — Hosted map and polygon drawing

**PASSED** · Hosted • Windows Edge · Space Map

Expected: Live map becomes ready; polygon clicks form a stored closed geometry after Approve.

Observed:

{
  "geometries": 1,
  "type": "Polygon"
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [demo-edge-retest/workspace-results.json](demo-edge-retest/workspace-results.json)

### MAP02 — Moasure CSV and collapse

**PASSED** · Hosted • Windows Edge · Space Map

Expected: Repository Moasure sample imports; unsaved-anchor collapse is stable and remains collapsed.

Observed:

{
  "groupCount": 1,
  "collapseStateStable": true,
  "anchorSaved": true
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [moasure-edge/workspace-results.json](moasure-edge/workspace-results.json)

### REC01 — Worked-example backup recovery

**PASSED** · Hosted • Windows Edge · Recovery

Expected: Downloaded backup retains all created geometry, costs, jobs, quotes and reversed payments.

Observed:

{
  "counts": {
    "applications": 12,
    "costingLines": 1,
    "events": 0,
    "geometries": 1,
    "jobs": 1,
    "payments": 4,
    "projects": 2,
    "quoteEvents": 1,
    "quoteLines": 1,
    "quotes": 1,
    "rateItems": 54,
    "tasks": 50,
    "catalogs": 1,
    "paymentAllocations": 0,
    "statusEvents": 6,
    "statusRecommendations": 0,
    "annualBudgets": 0,
    "budgetEntries": 0,
    "registerAllocations": 0,
    "allocationEntries": 0,
    "budgetCharges": 0,
    "budgetChangeRequests": 0,
    "budgetDecisions": 0,
    "budgetCarryReviews": 0
  },
  "sha256": "e9e028cfe4f5838dad98e9f980595be2b5f8ae0aec309d560ad801fdf7af3947",
  "backup": "artifacts\\worked-example-backup.json"
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [demo-edge/workspace-results.json](demo-edge/workspace-results.json)

### COLD01 — Fresh-profile import and recovery workaround

**FAILED** · Hosted • Windows Edge · Import

Expected: A fresh browser profile imports the latest workspace on the first attempt.

Observed:

First import failed: Workspace changed before this mutation could be committed. Reload and retry.

true !== false


Notes: Confirmed in Linux Chromium and Windows Edge. Fresh profile: memory revision 0, durable revision 1 after opening Settings. After reloading, both are revision 1 and import succeeds at revision 2.

Evidence: [faults-edge/workspace-results.json](faults-edge/workspace-results.json)

### DZ04 — Downloaded Dangerzone backup restores after reload workaround

**PASSED** · Hosted • Windows Edge · Recovery

Expected: The actual backup from deletion restores all business entities and permits a subsequent save.

Observed:

{
  "sha256": "24f87e9f180366a6949d5afe65e3c2f64f66f1067f5b0d4a7b829c9e3b41782d",
  "entitiesRestored": true,
  "subsequentSave": true,
  "workaround": "Reload before import"
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [faults-edge/workspace-results.json](faults-edge/workspace-results.json)

### FAULT01 — Aborted import write transaction

**PASSED** · Hosted • Windows Edge · Storage faults

Expected: An actual IndexedDB transaction abort does not replace canonical or verified data or report success.

Observed:

{
  "message": "Browser storage transaction failed",
  "canonicalPreserved": true
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [faults-edge/workspace-results.json](faults-edge/workspace-results.json)

### FAULT02 — Aborted deletion transaction

**PASSED** · Hosted • Windows Edge · Storage faults

Expected: Failure partway through the delete transaction preserves the complete canonical/recovery pair.

Observed:

{
  "message": "Failed to delete stored workspace: Uncaught exception in event handler.",
  "canonicalAndRecoveryPreserved": true
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [faults-edge/workspace-results.json](faults-edge/workspace-results.json)

### FAULT03 — Damaged-startup backup retains damaged data

**PASSED** · Hosted • Windows Edge · Storage faults

Expected: Recovery mode backs up the raw damaged revision before deliberate deletion.

Observed:

{
  "rawDamagedSnapshotPreserved": true,
  "deletedAfterBackup": true,
  "sha256": "899a7d5718e4875b59a4778e34f8f5e7bd56e3d42f849d460e575f160aa89ee3"
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [faults-edge/workspace-results.json](faults-edge/workspace-results.json)

### HEALTH01 — Inspect imported health warnings

**PASSED** · Hosted • Windows Edge · Data health

Expected: Imported workspace has no relationship errors; warnings are recorded for review.

Observed:

{
  "errors": 0,
  "warnings": 57,
  "warningCodes": {
    "STATUS_MIGRATION_READINESS": 1,
    "FUNDING_OPERATIONAL_AMOUNT_MISSING": 2,
    "RATE_LEGACY_CATALOG_ACTIVE": 54
  }
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [faults-edge/workspace-results.json](faults-edge/workspace-results.json)

### FINAL01 — Prepare original-data Edge profile and restart

**PASSED** · Hosted • Windows Edge · Demonstration preparation

Expected: A dedicated profile retains the original converted entities across a real browser process restart.

Observed:

{
  "path": "C:\\Users\\n0rt\\AppData\\Local\\Temp\\nsa-demo-original-1791954235081",
  "browser": "155.0.4283.45",
  "backup": "artifacts\\original-demo-recovery.json",
  "sha256": "37290099d60800117680ee218e8d8c2a7cb61c74fa2db05c5f44c3449dc8cbaf",
  "counts": {
    "applications": 12,
    "costingLines": 0,
    "events": 0,
    "geometries": 0,
    "jobs": 0,
    "payments": 0,
    "projects": 2,
    "quoteEvents": 0,
    "quoteLines": 0,
    "quotes": 0,
    "rateItems": 54,
    "tasks": 50,
    "catalogs": 1,
    "paymentAllocations": 0,
    "statusEvents": 5,
    "statusRecommendations": 0,
    "annualBudgets": 0,
    "budgetEntries": 0,
    "registerAllocations": 0,
    "allocationEntries": 0,
    "budgetCharges": 0,
    "budgetChangeRequests": 0,
    "budgetDecisions": 0,
    "budgetCarryReviews": 0
  }
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [faults-edge/workspace-results.json](faults-edge/workspace-results.json)

### REG02 — Create a project from an unlinked imported record

**PASSED** · Hosted • Windows Edge · Register / Planner

Expected: Create Project in Space Manager creates one correctly linked project.

Observed:

Created one project linked to the selected previously unlinked imported application.

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [live-edge/workspace-results.json](live-edge/workspace-results.json)

### FAULT04 — Simulated quota exhaustion

**PASSED** · Hosted • Windows Edge · Storage faults

Expected: Quota failure cannot report a successful import or alter stored business content.

Observed:

{
  "message": "Readiness simulated browser quota exhaustion",
  "canonicalPreserved": true,
  "injection": "QuotaExceededError at the commit interface; not an actual disk-fill test"
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [live-edge/workspace-results.json](live-edge/workspace-results.json)

### LIVE01 — Live MetroMap pan and zoom

**PASSED** · Hosted • Windows Edge · Live services

Expected: Real aerial tile responses continue after mouse pan and zoom; renderer camera and tile keys change.

Observed:

{
  "responsesBefore": 3,
  "responsesAfter": 28,
  "zoomBefore": 14,
  "zoomAfter": 15,
  "metrics": {
    "backend": "webgpu",
    "referenceGpuBytes": 0,
    "tiles": 48,
    "canvasPixels": 957609,
    "pixelRatio": 1,
    "referenceLayers": []
  }
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [live-edge/workspace-results.json](live-edge/workspace-results.json)

### LIVE02 — Live tree layers and lazy hub

**PASSED** · Hosted • Windows Edge · Live services

Expected: Opening hub makes no service requests; enabled layers render service data at zoom 17 and free buffers when disabled.

Observed:

{
  "serviceRequests": 20,
  "metrics": {
    "renderer": {
      "backend": "webgpu",
      "referenceGpuBytes": 2691960,
      "tiles": 68,
      "canvasPixels": 957609,
      "pixelRatio": 1,
      "referenceLayers": [
        "trees",
        "srz",
        "tpz"
      ]
    },
    "tree": {
      "enabled": {
        "trees": true,
        "srz": true,
        "tpz": true
      },
      "visible": true,
      "metrics": {
        "requests": 20,
        "active": 0,
        "peakRequests": 4,
        "cacheBytes": 4800780,
        "staleResults": 0,
        "worker": true,
        "enabled": {
          "trees": true,
          "srz": true,
          "tpz": true
        }
      }
    }
  },
  "disabledBuffersFreed": true,
  "cameraSetup": "Camera API sets service location and threshold; hub/toggles use UI"
}

Notes: Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.

Evidence: [live-edge/workspace-results.json](live-edge/workspace-results.json)

### REG038 — imported legacy rates appear in each of the five Cost Library menus

**PASSED** · Local • Chromium · Cost Library

Expected: imported legacy rates appear in each of the five Cost Library menus

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG039 — NSA: default Customer permits a first deposit without toggling funding

**PASSED** · Local • Chromium · Quotes / Payments

Expected: NSA: default Customer permits a first deposit without toggling funding

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG040 — NSA: a saved Draft deposit keeps the Quote panes aligned

**PASSED** · Local • Chromium · Quotes / Payments

Expected: NSA: a saved Draft deposit keeps the Quote panes aligned

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG041 — EVT: default Customer permits a first deposit without toggling funding

**PASSED** · Local • Chromium · Quotes / Payments

Expected: EVT: default Customer permits a first deposit without toggling funding

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG042 — EVT: a saved Draft deposit keeps the Quote panes aligned

**PASSED** · Local • Chromium · Quotes / Payments

Expected: EVT: a saved Draft deposit keeps the Quote panes aligned

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG043 — first-deposit failure keeps data and retry records one payment despite repeated submits

**PASSED** · Local • Chromium · Quotes / Payments

Expected: first-deposit failure keeps data and retry records one payment despite repeated submits

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG044 — Accepted Quote handles an overpayment and reversal without changing its commercial snapshot

**PASSED** · Local • Chromium · Quotes / Payments

Expected: Accepted Quote handles an overpayment and reversal without changing its commercial snapshot

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG045 — holding a date handle at the week edge pages once and Cancel restores the original period

**PASSED** · Local • Chromium · Scheduler

Expected: holding a date handle at the week edge pages once and Cancel restores the original period

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG046 — Month timed extension confirms conversion; keyboard cancellation leaves hours intact

**PASSED** · Local • Chromium · Scheduler

Expected: Month timed extension confirms conversion; keyboard cancellation leaves hours intact

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG047 — NSA: move preserves hours; side handles convert only after confirmation and Save

**PASSED** · Local • Chromium · Scheduler

Expected: NSA: move preserves hours; side handles convert only after confirmation and Save

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG048 — EVT: move preserves hours; side handles convert only after confirmation and Save

**PASSED** · Local • Chromium · Scheduler

Expected: EVT: move preserves hours; side handles convert only after confirmation and Save

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG049 — Month single-row spans, cross-row linked cards, date resizing and keyboard movement

**PASSED** · Local • Chromium · Scheduler

Expected: Month single-row spans, cross-row linked cards, date resizing and keyboard movement

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG050 — radial Undo appears on its parent spoke and smoothly separates the original approval orbs

**PASSED** · Local • Chromium · Space Map

Expected: radial Undo appears on its parent spoke and smoothly separates the original approval orbs

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG051 — NSA: radial Undo restores completed vertex edits without saving or remounting cards

**PASSED** · Local • Chromium · Space Map

Expected: NSA: radial Undo restores completed vertex edits without saving or remounting cards

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG052 — NSA: radial Undo reverses Moasure movement and rotation with gesture-sized history

**PASSED** · Local • Chromium · Space Map

Expected: NSA: radial Undo reverses Moasure movement and rotation with gesture-sized history

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG053 — EVT: radial Undo restores completed vertex edits without saving or remounting cards

**PASSED** · Local • Chromium · Space Map

Expected: EVT: radial Undo restores completed vertex edits without saving or remounting cards

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG054 — EVT: radial Undo reverses Moasure movement and rotation with gesture-sized history

**PASSED** · Local • Chromium · Space Map

Expected: EVT: radial Undo reverses Moasure movement and rotation with gesture-sized history

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG055 — NSA: radial geometry creation uses third-tier Accept and Cancel

**PASSED** · Local • Chromium · Space Map

Expected: NSA: radial geometry creation uses third-tier Accept and Cancel

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG056 — NSA: Location actions stage pins and mirror saving states

**PASSED** · Local • Chromium · Space Map

Expected: NSA: Location actions stage pins and mirror saving states

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG057 — EVT: radial geometry creation uses third-tier Accept and Cancel

**PASSED** · Local • Chromium · Space Map

Expected: EVT: radial geometry creation uses third-tier Accept and Cancel

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG058 — EVT: Location actions stage pins and mirror saving states

**PASSED** · Local • Chromium · Space Map

Expected: EVT: Location actions stage pins and mirror saving states

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG059 — third tier follows each parent, fits narrow layouts and supports keyboard and collapse

**PASSED** · Local • Chromium · Space Map

Expected: third tier follows each parent, fits narrow layouts and supports keyboard and collapse

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG060 — pin Move and Remove and vertex editing use third-tier actions; Moasure keeps its own workflow

**PASSED** · Local • Chromium · Space Map

Expected: pin Move and Remove and vertex editing use third-tier actions; Moasure keeps its own workflow

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG061 — line vertices branch from Line and saved square vertices branch from Polygon

**PASSED** · Local • Chromium · Space Map

Expected: line vertices branch from Line and saved square vertices branch from Polygon

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG062 — a short narrow viewport keeps Undo reachable while preserving map space

**PASSED** · Local • Chromium · Space Map

Expected: a short narrow viewport keeps Undo reachable while preserving map space

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG063 — other map consumers retain automatic square completion by default

**PASSED** · Local • Chromium · Space Map

Expected: other map consumers retain automatic square completion by default

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG064 — orphaned status event opens Settings recovery; retry remains usable and preserves raw data

**PASSED** · Local • Chromium · Workspace recovery

Expected: orphaned status event opens Settings recovery; retry remains usable and preserves raw data

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG065 — Danger zone backs up the damaged stored revision before deliberate deletion

**PASSED** · Local • Chromium · Workspace recovery

Expected: Danger zone backs up the damaged stored revision before deliberate deletion

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG066 — recovery deletion keeps a newer damaged revision when its backup becomes stale

**PASSED** · Local • Chromium · Workspace recovery

Expected: recovery deletion keeps a newer damaged revision when its backup becomes stale

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG067 — workspace backup is primary, deletion requires it, and no browser editing takeover is rendered

**PASSED** · Local • Chromium · Workspace recovery

Expected: workspace backup is primary, deletion requires it, and no browser editing takeover is rendered

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG068 — stale revision cannot delete a newer workspace

**PASSED** · Local • Chromium · Workspace recovery

Expected: stale revision cannot delete a newer workspace

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG069 — revision-fenced deletion clears canonical, recovery, migration, and legacy workspace state together

**PASSED** · Local • Chromium · Workspace recovery

Expected: revision-fenced deletion clears canonical, recovery, migration, and legacy workspace state together

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [regression-results.json](regression-results.json)

### REG070 — Moasure tooltip follows readiness and leaves when the pointer leaves

**PASSED** · Local • Chromium · Space Map

Expected: Moasure tooltip follows readiness and leaves when the pointer leaves

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG071 — NSA: Moasure card collapses without redraws before and after saving its anchor

**PASSED** · Local • Chromium · Space Map

Expected: NSA: Moasure card collapses without redraws before and after saving its anchor

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG072 — EVT: Moasure card collapses without redraws before and after saving its anchor

**PASSED** · Local • Chromium · Space Map

Expected: EVT: Moasure card collapses without redraws before and after saving its anchor

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG073 — NSA: Moasure import, rigid drag, rotation, confirmation, job creation and reload

**PASSED** · Local • Chromium · Space Map

Expected: NSA: Moasure import, rigid drag, rotation, confirmation, job creation and reload

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG074 — NSA: invalid Moasure CSV is rejected without creating polygons

**PASSED** · Local • Chromium · Space Map

Expected: NSA: invalid Moasure CSV is rejected without creating polygons

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG075 — EVT: Moasure import, rigid drag, rotation, confirmation, job creation and reload

**PASSED** · Local • Chromium · Space Map

Expected: EVT: Moasure import, rigid drag, rotation, confirmation, job creation and reload

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG076 — EVT: invalid Moasure CSV is rejected without creating polygons

**PASSED** · Local • Chromium · Space Map

Expected: EVT: invalid Moasure CSV is rejected without creating polygons

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG077 — Moasure import uses only selected groups and fits a narrow viewport

**PASSED** · Local • Chromium · Space Map

Expected: Moasure import uses only selected groups and fits a narrow viewport

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG078 — NSA 1440: full-day stacked week, overnight fragments and preserved scrolling

**PASSED** · Local • Chromium · Scheduler

Expected: NSA 1440: full-day stacked week, overnight fragments and preserved scrolling

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG079 — NSA 390: full-day stacked week, overnight fragments and preserved scrolling

**PASSED** · Local • Chromium · Scheduler

Expected: NSA 390: full-day stacked week, overnight fragments and preserved scrolling

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG080 — EVT 1440: full-day stacked week, overnight fragments and preserved scrolling

**PASSED** · Local • Chromium · Scheduler

Expected: EVT 1440: full-day stacked week, overnight fragments and preserved scrolling

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG081 — EVT 390: full-day stacked week, overnight fragments and preserved scrolling

**PASSED** · Local • Chromium · Scheduler

Expected: EVT 390: full-day stacked week, overnight fragments and preserved scrolling

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG082 — NSA: cancel, all-day download and conversion to saved timed job

**PASSED** · Local • Chromium · Scheduler

Expected: NSA: cancel, all-day download and conversion to saved timed job

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG083 — EVT: cancel, all-day download and conversion to saved timed job

**PASSED** · Local • Chromium · Scheduler

Expected: EVT: cancel, all-day download and conversion to saved timed job

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG084 — failed persistence prevents downloads and retains edited times for correction

**PASSED** · Local • Chromium · Scheduler

Expected: failed persistence prevents downloads and retains edited times for correction

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG085 — timed export protects location, prevents duplicate submissions and does not repeat status events

**PASSED** · Local • Chromium · Scheduler

Expected: timed export protects location, prevents duplicate submissions and does not repeat status events

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG086 — local-file entry draws reference layers, full radial connectors and raster camera gestures

**PASSED** · Local • Chromium · Space Map

Expected: local-file entry draws reference layers, full radial connectors and raster camera gestures

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG087 — NSA: radial polygon preview draws complete dashed edges on webgpu

**PASSED** · Local • Chromium · Space Map

Expected: NSA: radial polygon preview draws complete dashed edges on webgpu

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG088 — EVT: radial polygon preview draws complete dashed edges on webgl

**PASSED** · Local • Chromium · Space Map

Expected: EVT: radial polygon preview draws complete dashed edges on webgl

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG089 — NSA: GPU adapter loads on demand, retains drawing on backend loss

**PASSED** · Local • Chromium · Space Map

Expected: NSA: GPU adapter loads on demand, retains drawing on backend loss

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG090 — EVT: GPU adapter loads on demand, retains drawing on backend loss

**PASSED** · Local • Chromium · Space Map

Expected: EVT: GPU adapter loads on demand, retains drawing on backend loss

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG091 — webgl: tree hub is independent, threshold gated, worker renders service holes and deduplicates cells

**PASSED** · Local • Chromium · Space Map

Expected: webgl: tree hub is independent, threshold gated, worker renders service holes and deduplicates cells

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG092 — webgpu: tree hub is independent, threshold gated, worker renders service holes and deduplicates cells

**PASSED** · Local • Chromium · Space Map

Expected: webgpu: tree hub is independent, threshold gated, worker renders service holes and deduplicates cells

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG093 — GPU Moasure placement moves without changing saved geometry

**PASSED** · Local • Chromium · Space Map

Expected: GPU Moasure placement moves without changing saved geometry

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG094 — pin movement survives all backend losses without changing saved locations

**PASSED** · Local • Chromium · Space Map

Expected: pin movement survives all backend losses without changing saved locations

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG095 — software WebGPU renders GPU points and preserves the draft when its device is lost

**PASSED** · Local • Chromium · Space Map

Expected: software WebGPU renders GPU points and preserves the draft when its device is lost

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG096 — transfer limits subdivide cells; hidden maps abort service loading and retain toggles

**PASSED** · Local • Chromium · Space Map

Expected: transfer limits subdivide cells; hidden maps abort service loading and retain toggles

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG097 — tree outage clears only the reference layer and stops automatic retries

**PASSED** · Local • Chromium · Space Map

Expected: tree outage clears only the reference layer and stops automatic retries

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG098 — tree malformed clears only the reference layer and stops automatic retries

**PASSED** · Local • Chromium · Space Map

Expected: tree malformed clears only the reference layer and stops automatic retries

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG099 — tree response-budget clears only the reference layer and stops automatic retries

**PASSED** · Local • Chromium · Space Map

Expected: tree response-budget clears only the reference layer and stops automatic retries

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG100 — tree point-budget clears only the reference layer and stops automatic retries

**PASSED** · Local • Chromium · Space Map

Expected: tree point-budget clears only the reference layer and stops automatic retries

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG101 — local launcher webgpu replaces raster tiles at native display resolution

**PASSED** · Local • Chromium · Space Map

Expected: local launcher webgpu replaces raster tiles at native display resolution

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG102 — local launcher webgl replaces raster tiles at native display resolution

**PASSED** · Local • Chromium · Space Map

Expected: local launcher webgl replaces raster tiles at native display resolution

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG103 — pan, zoom, resize and raster tiles align with the same geographic projection

**PASSED** · Local • Chromium · Space Map

Expected: pan, zoom, resize and raster tiles align with the same geographic projection

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### REG104 — late worker results cannot replace the latest viewport

**PASSED** · Local • Chromium · Space Map

Expected: late worker results cannot replace the latest viewport

Observed:

All assertions in the existing regression passed. Synthetic fixtures and service stubs are used where defined by the test.

Notes: Supplementary regression against local application source. Tested deployed assets matched local bytes; this does not replace the hosted Edge scenarios.

Evidence: [additional-regressions.json](additional-regressions.json)

### MODEL01 — Area pricing model checks

**PASSED** · Local • Node · Model contracts

Expected: Area pricing model assertions pass.

Observed:

Selected model test file passed; the three-file Node run reported 3 tests, 3 passed, 0 failed.

Evidence: [model-checks.tap](model-checks.tap)

### MODEL02 — Import signatures model checks

**PASSED** · Local • Node · Model contracts

Expected: Import signatures model assertions pass.

Observed:

Selected model test file passed; the three-file Node run reported 3 tests, 3 passed, 0 failed.

Evidence: [model-checks.tap](model-checks.tap)

### MODEL03 — Workspace sanitation model checks

**PASSED** · Local • Node · Model contracts

Expected: Workspace sanitation model assertions pass.

Observed:

Selected model test file passed; the three-file Node run reported 3 tests, 3 passed, 0 failed.

Evidence: [model-checks.tap](model-checks.tap)

### SIGN01 — Uninterrupted headed client demonstration rehearsal

**BLOCKED** · Windows Edge • headed · Sign-off

Expected: Complete the final demonstration sequence in a visible Edge window at the client presentation display settings.

Observed:

Not signed off. Edge scenarios used real Windows Edge in headless mode at 1600 × 1000. The confirmed first-use import/recovery blocker remains unfixed; a continuous headed rehearsal on the presentation display is still required after correction.

Notes: Do not infer human visual approval or a clean first-use workflow from automated passes.

## Limits and execution notes

- No product source was changed, committed or published. The current local and remote main revision is the recorded commit.
- The tests used isolated contexts and a dedicated original-data profile; no existing user workspace was deleted.
- Storage quota was simulated at the commit interface; import and deletion aborts used actual IndexedDB transaction aborts.
- Software GPU, transfer-limit, stale-response and budget-exhaustion checks used controlled regression fixtures. Live Edge separately fetched MetroMap and ArcGIS data and checked GPU resource limits.
- Preliminary selector/fixture errors were corrected and retested. Superseded harness failures are retained in local artifacts but are not counted as application defects.
- Imported rate grouping was verified as Labour 7, Sundry 6, Material 38, Contractors 2 and Equipment 1; Material Scheduler-enabled count was 0. The earlier raw-file concern was not reproduced after normalisation.
- A headed presentation-display rehearsal remains blocked; automated tests cannot establish future network availability.

## Publication and correction gate

The navigation revision defect is now fixed and verified locally; the public build is unchanged. With the focused local correction verified, obtain a separate publication request, verify the deployed assets and repeat COLD01, DZ03, backup recovery and the headed rehearsal before changing the readiness decision.


## Local correction verification

Local source only. The published baseline below remains unchanged: 105 passed, 2 failed, 1 blocked.

Navigation saves now use the navigation mutation kind and explicit base revision, reconcile only the saved revision, and recheck session deletion before queued persistence. No schema changes.

### linux — 151.0.7922.34

Source SHA-256: 157112935bda019bfeca183b0f0daa4afa5fb4352d4402b5e154338f705ba976

- **Passed** FIX-nsa: nsa fresh import and permanent-delete recovery
- **Passed** FIX-events: events fresh import and permanent-delete recovery
- **Passed** FIX-QUEUE: Queued navigation, business edits and deletion
- **Passed** FIX-STALE: Second-tab stale import and deletion
- **Passed** FIX-FAIL: Failed navigation persistence

Evidence: [local-fix/workspace-results.json](local-fix/workspace-results.json)

### win32 — 155.0.4283.45

Source SHA-256: 157112935bda019bfeca183b0f0daa4afa5fb4352d4402b5e154338f705ba976

- **Passed** FIX-nsa: nsa fresh import and permanent-delete recovery
- **Passed** FIX-events: events fresh import and permanent-delete recovery
- **Passed** FIX-QUEUE: Queued navigation, business edits and deletion
- **Passed** FIX-STALE: Second-tab stale import and deletion
- **Passed** FIX-FAIL: Failed navigation persistence

Evidence: [local-fix-edge/workspace-results.json](local-fix-edge/workspace-results.json)

The two existing stale-revision and atomic-deletion browser regressions also passed. Syntax and whitespace checks passed. No unrelated application suites were run.

Report recovery note: the existing Playwright command cleared its default output folder. The public baseline reports and Edge evidence were restored from the preserved Windows runner copies. Some original Linux raw artifacts are no longer present; their recorded baseline results remain in this report.

## Quote interaction correction

Local source only; no commit or publication.

- Payment controls no longer invoke automatic card scrolling when clicked or focused.
- Ledger action controls remain stable through Quote refreshes; reversal guards prevent duplicate dialogs and reject empty reasons.
- Reversal evidence resolves by payment ID and displays its stored timestamp. Missing historical actor information remains Not recorded.
- Dialog close and successful reversal return focus to the payment control without scrolling.

**Deposit availability:** The initially disabled Customer deposit button was not reproduced in the current local source. Fresh-entry and reopened-workspace checks passed without changing funding. Existing funding eligibility rules were preserved.

- 8 passed: [quote-focused/results.json](quote-focused/results.json)
- 2 passed: [quote-status-focus/results.json](quote-status-focus/results.json)
- 2 passed: [quote-file-edge/results.json](quote-file-edge/results.json)

Edge checks used isolated local-file NSA and EVT app entries, including reopening the workspace. Chromium checks include single-click activation, refresh during the pointer gesture, cancellation, empty reason, duplicate-dialog prevention, stored timestamp and scroll/focus assertions. Existing payment/funding tests and two shared status-dialog regressions also passed.
