# Horticulture Overtime Planner — Stage 1 Gate B1 Independent Peer Review 14

**Reviewed:** `HortOps-Stage1-GateB1-PR13.zip` (15 members; incremental package)  
**Previous finding set:** Review 13 B1-01 to B1-04  
**Review basis:** reconstructed Offline17.5j + intervening accepted/incremental packages through PR12, overlaid with submitted PR13; rebuilt standalone app; direct current-code checks and independent discriminating probes.  
**Decision:** **Gate A remains accepted. Gate B1 corrective closure required. Gate B2/B3, legacy removal, Stage 2 and Stage 3 remain on hold.**

## 1. Review outcome — distinguish closed findings from new evidence

PR13 materially closes **the four specific Review 13 findings**:

- **B1-01, `jobs:null` laundering:** delegated `createWorkspaceEnvelope()` no longer converts malformed Job data to `[]`; actual app save with `jobs:null` rejects. The Review 13 six-scenario script and changed B1 suite both pass.
- **B1-02, snapshot optional fields and record labels:** explicit `crewSize:null` and `assignedStaffIds:null` now reject, as does `recordType:'banana'`. Observed `'scheduled_commitment'` and historical fixture `'historical'` survive.
- **B1-03, unverified authoritative snapshots:** any persisted snapshot carrying `unverifiedSchedule` now rejects rather than later becoming `found:true` in the scheduler.
- **B1-04, portability and reporting:** test paths use `__dirname` rather than fixed WSL roots. The change report identifies the real public methods.

**Independent build and tests:** all submitted 15 manifest entries have valid SHA-256 values; submitted `index.html` and `dist/hort_ops_offline_planner.html` match, and a rebuild from the reconstructed source reproduces their exact SHA-256 (`f9c06dba072818b1a23ab60b6ea3bcb4375a73fe966fc3646baa4728aa4e30df`). `test_gate_b1.cjs`, `reproduce_b1_review13.cjs`, `test_normal_save_snapshots.cjs`, `test_persistence.cjs` and `test_rostering_engine.cjs` pass. This evidence **does not**, by itself, establish full eight-boundary correctness.

## 2. Review protocol applied

The review examined the common validator as the owner of the **current-v2 schema**, not simply the patched constructor. It followed malformed but syntactically valid current-v2 workspaces through:

1. Direct delegated constructor and `HortOpsStorage.createWorkspaceEnvelope()`.
2. Direct `HortOpsStorage.saveWorkspace()`.
3. Actual `HortOpsApp.saveCurrentWorkspace()`.
4. Actual `HortOpsExportModal.exportBackupJson()`.
5. `HortOpsStorage.loadWorkspace()` / `HortOpsApp.init()`.
6. `prepareWorkspaceJsonImport()` and actual `HortOpsApp.restoreWorkspaceJson()`.
7. Nested scheduled-commitment validation and scheduler evidence semantics.
8. Error contracts for malformed Job/Workforce arrays.

A new portable `scripts/reproduce_b1_review14.cjs` covers 11 discriminating conditions across these paths. **Against PR13, 1/11 pass and 10 fail**, grouped below into only **three root causes**. This is not a request for ten new feature changes.

## 3. B1-14-01 — BLOCKING: `assignments` is not validated as a canonical domain

**Owner:** `js/utils/storage/schemaValidator.js`, `validateCurrentV2Presence()` (~802–821), `validateWorkspaceSchema()` (~240 onward); second-order effect in `migrationEngine.js:createWorkspaceEnvelope()` (~56–85). **This is another manifestation of the canonical-domain weakness already covered by Review 13 B1-01, not a newly authorised expansion.** The Review 13 corrective prompt expressly required testing `roster`, `assignments` and other genuinely mandatory current-v2 domains; PR13's submitted probes targeted only `jobs:null`.

**Actual implementation:** `validateCurrentV2Presence()` requires only `historicalSnapshots`, `rostering.instructions` and `rostering.provenance`. `validateWorkspaceSchema()` requires `jobs` and `roster` but performs no root requirement or typed-value check on `assignments`. The constructor copies `assignments` **if present** and approves omission or null if the common validator approves them. All other entry points trust the same validator.

### Reproduced pathways

| Boundary | Exact scenario | Actual PR13 | Required current-v2 behaviour |
|---|---|---|---|
| Constructor | Omit `assignments`, or supply `assignments:null` | Returns an apparently valid workspace | Reject; no default on raw current-v2 |
| Direct save | As above, with a valid prior assignment map persisted | Returns `ok:true`; may replace previously stored assignments | Return `ok:false`; preserve all previous raw bytes |
| Real app save | Load a previously saved assignment; set `app.state.customAssignments=null`; call `saveCurrentWorkspace()` | Returns `true`; stored `assignments` becomes `null` | Return `false`; previous saved assignments untouched |
| Backup export | Same live `null` assignments; call actual `exportBackupJson()` | Returns `true`; downloads backup with `assignments:null`, commits loss | Fail; **zero downloads**; preserve previous stored bytes |
| Startup/load | Place a current-v2 JSON envelope lacking `assignments` under canonical storage key | Loads without Recovery Required; `app.state.customAssignments` becomes `undefined` | Quarantine invalid current-v2; preserve raw bytes; no operational adoption |
| Import/restore | Current-v2 JSON missing/null assignments | Import preparation/restore accepts; potential live state replacement | Reject without mutating persisted or active state |
| Nested map | `assignments:{'job-1@2027-01-02':'not-an-array'}` or `[12,null]` | Canonical validator returns `{valid:true}` | Reject; canonical map values must be typed arrays of legitimate identifiers |

**Risk:** silent loss of operational allocations, misleadingly successful backups and undefined state entering scheduler/rostering consumers. This is not the separately deferred Gate B2 historical-snapshot ownership problem.

**Source evidence:** `schemaValidator.js:802–821`, `schemaValidator.js:240–261`, `migrationEngine.js:67–85`, `app.js:146–161`, `exportModal.js:39–100`. Independent reproduction script conditions 01–07.

**Required fix:** one schema-owner correction, enforced by the shared validation already called at every boundary. Require `assignments` as a plain own current-v2 map; validate each value as an array of nonblank string IDs with no duplicates, and validate the occurrence key/date format **only if confirmed compatible with existing actual keys**. Do not impose current-staff referential integrity on historical assignments whose employees may have left. Distinguish explicitly created fresh/v1 empty maps from malformed existing current-v2 payloads. The relevant built-in fresh-workspace and v1 call sites already supply `{}`.

## 4. B1-14-02 — HIGH: claimed record-type allow-list admits inherited object properties

**Owner:** `schemaValidator.js:789–795`; same function's `seenStaff` handling ~771–784.

The new `ALLOWED_RECORD_TYPES = {'scheduled_commitment':true, 'historical':true}` is an ordinary object, and `ALLOWED_RECORD_TYPES[snapshot.recordType]` looks up inherited properties. Independent calls with `recordType:'constructor'`, `'toString'`, `'__proto__'` and `'valueOf'` **all pass** the ostensibly strict validator. `'banana'` rejects, so the submitted test gives false confidence about allow-list completeness.

The same prototype lookup problem affects duplicate detection: a single `assignedStaffIds:['toString']` is incorrectly rejected as a duplicate because `seenStaff = {}` has inherited keys. Neither defect requires a new schema version or a new public API.

**Required fix:** use exact string equality for the two accepted record types, or `hasOwnProperty` against an allow-list; use a null-prototype set (`Object.create(null)`) or an actual `Set` for duplicate IDs. Keep compatibility with the *documented actual* `'historical'` fixture without interpreting that word as confirmed attendance. Add a tiny negative test for `constructor` and `__proto__` and a positive test for one permitted employee identifier that is also an Object-prototype key.

## 5. B1-14-03 — MEDIUM: null Job/staff entries throw instead of producing schema-validation results

**Owner:** `schemaValidator.js:268–273` (`j.id`) and `schemaValidator.js:339–343` (`s.id`); `validateCurrentV2ForBoundary()` calls `validateWorkspaceSchema(working)` (~863) without a catch.

`validateCurrentV2ForBoundary({...jobs:[null]})` and the equivalent `roster:[null]` **throw `TypeError`** rather than returning `{valid:false,error:...}`. Normal app save has its own catch and does not overwrite committed bytes, so this is not demonstrated data erasure. However, public raw-save and verified-read callers expect the stable `{valid:false}` result and may surface uncaught exceptions instead of controlled recovery. It is within B1's strict boundary contract and can be closed with small guards and one defensive catch, **without broadening into a new entity-schema rewrite**.

## 6. Eight-boundary comparison and stop criteria

| Boundary | Review 13 explicit probes | Independent Review 14 result | B1 closure requirement |
|---|---|---|---|
| Public constructor | `jobs:null` rejected | Pass for Jobs; fail for omitted/null assignments | Reject all mandatory malformed domains |
| Direct save | Bad Jobs rejected | Bad assignments accepted; storage overwritten | Validate before any write |
| Normal app save | Bad Jobs rejected | `customAssignments:null` returns success | Reject, prior raw bytes intact |
| Verified read and startup | Snapshot maps protected | Missing assignments adopted without recovery | Reject/quarantine malformed current-v2 |
| JSON backup | Snapshot and provenance retention | Can export and persist null assignments | Zero download on invalid projection |
| JSON import/restore | Snapshot and rostering checks | Missing/null assignments accepted | Reject without state/storage mutation |
| Snapshot validation | Null optional metadata; `banana`; unverified flag | These pass; inherited record types accepted | Use prototype-safe enum/membership |
| Error and rollback semantics | Selected negative tests | Null entity array items throw | Structured rejection, no byte loss |

**Acceptance requires one completed matrix**, not a sequence of partial fixes. Integrate Review 14's 11-probe script into the existing targeted B1 suite or run it once as a companion test. All 11 must pass on the corrected implementation, while the previously passing B1, Gate A, Persistence and Rostering suites remain green. Avoid full release-gate repetition at this microclosure checkpoint.

## 7. Boundaries explicitly deferred — do not reopen

Gate B2/B3 continues to own: complete snapshots for every committed Fixed/Rotation descendant; original scheduled-commitment timing after source Job edits and retirement; the distinction between planned and actual work; snapshot ownership/authorised deletion; and atomic rollback of ordinary Job/Workforce/Permit operational mutations. Gate C owns verified v1 removal and removal of seeded 12 Jobs, 253 staff and 44 hard-coded historical occurrences. Stage 2 owns the user-facing reset and browser-storage wipe. None of these are a reason to reopen Gate A or withhold acceptance of a demonstrably correct B1.

## 8. Incremental packaging and governance

The 15-member PR13 archive has valid checksums and matching distributions. However, `js/app.js`, `STAGE1_ARCHITECTURE_AUDIT_AND_CANONICALISATION_PLAN.md`, and `STAGE1_GATE_A_PEER_REVIEW_CONTINUITY.md` were byte-for-byte unchanged from PR12 yet supplied again. **Omit unchanged files** from the next peer-review ZIP. Preserve Review 12's Gate A acceptance and Review 13's historical audit record. Mark B1 “developer-implemented, awaiting Review 14 corrective acceptance”; do not prematurely record independent approval.

Do not describe `node -c` as proof of full ES5 runtime compatibility; it is a syntax check. No claim of browser testing is made in this review. The latest complete build is a production bundle reproducibility check, not a substitute for end-to-end browser interaction.

**Next decision point:** one narrow shared-validator implementation and one incremental ZIP, then independent re-review. Gemini may challenge any prescribed code with actual supported payloads, a concrete alternative and two decisive probes in a separate short Markdown file for user-mediated micro-review.
