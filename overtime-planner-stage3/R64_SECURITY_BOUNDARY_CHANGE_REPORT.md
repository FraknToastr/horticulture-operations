# Review 64 colour boundary correction

Phase 6, corrective candidate PR26_08. Stage 3 remains open; independent Review 65 and release acceptance are not granted by this implementation.

## Canonical input contract

`js/utils/storage/schemaValidator.js` defines one colour predicate: hexadecimal RGB/RGBA strings of exactly 3, 4, 6 or 8 digits after `#`. Case is preserved. Missing, null and empty optional colours retain their established fallback behaviour. Named colours, whitespace, declarations, CSS functions, escapes, HTML entities, quotes and non-string values are rejected. No invalid imported colour is silently replaced in saved data.

The predicate applies to `job.color`, `staff.avatarColor`, historical commitment `color` and an embedded snapshot job's colour. Existing Schema v2 identity, lineage, status, scheduling, qualification, absence and historical retention rules are unchanged. Invalid current saved records enter recovery without overwriting the original bytes.

`js/app.js` checks incoming workforce colours before reconciliation. Reconciliation otherwise retains an existing employee's presentation fields and could conceal invalid input; the new check rejects that input before any proposal is committed. Job commands, canonical saves, JSON preparation, restore and recovery use the existing schema boundary.

## Rendering contract and affected sources

`js/utils/securityUtils.js` supplies `safeColor` through the canonical predicate. Components interpolate only an accepted hexadecimal token or a fixed trusted fallback. Thus HTML attributes never receive the raw colour string, even when a component is called directly with an unvalidated record. HTML/attribute encoders remain in their existing contexts. Missing security capability uses a fixed fallback. `colorWithAlpha` constructs the vacancy glow from validated RGB channels and two validated hex alpha digits.

Affected components: `jobRegistry.js` (table and inspector), `staffRegistry.js`, `staffAssignModal/candidateList.js`, `staffAssignModal/stagedCrew.js`, `jobEditModal.js`, `staffAssignModal.js`, `staffAbsenceModal.js`, `calendarView.js`, `peakWeekends.js`, `forwardPlanner/controls.js` (selected filter and drawer pills), and `forwardPlanner/matrixRenderer.js` (vacancies and allocated cards).

The file-input proof also exposed an existing import-modal defect: rendering erased validation errors. `importModal.js` now retains an escaped error message through rendering, clears stale previews, clears the error after a successful file preparation and escapes the selected filename. Layout, accepted import workflow and modal scroll controls are preserved.

## Verification and limits

`npm run test:security` runs seven independent groups: canonical job/workforce attack matrices; historical commitment colours; actual JSON preparation, restore and save rejection with unchanged bytes; the asynchronous file-input path and filenames; ten browser-rendered registry/planner/modal paths with actual mouseover dispatch; normal RGB/RGBA round trips; and hostile saved-data recovery. Twenty malformed/hostile inputs cover quotes, attribute injection, CSS escapes/functions/declarations, entities, whitespace, malformed lengths and wrong types. Browser rendering explicitly includes allocated and vacant cards and selected job-filter pills.

The unchanged original `R64_SECURITY_PROBE.cjs` reproduced two exposed sinks before correction. After correction it reports both schema checks false, both handler checks false and zero security-boundary failures. It exits 1 because its original contract demands successful vulnerability reproduction; that is expected here, not a passing regression result. The new positive suite supplies fail-closed assertions. No inherited probe assertions were rewritten.

This is targeted colour/import rendering remediation, not a claim that all possible HTML/JavaScript injection paths are certified. Validation does not sanitize or destroy rejected records. Cooperative writer protection does not prevent arbitrary same-origin scripts or developer tools from writing storage. Chromium evidence is not certification of other browsers. Generated standalone source remains compiled from the modular graph and byte-identical to its distribution copy.
