# Gemini — Stage 1 Gate C Final Corrective Prompt (Review 23)

You are correcting the revised Gate C PR21 submission only. Do **not** change the active roadmap, constitution, Stage 2/3 scope, smart-rostering research, or unrelated UI.

## Authoritative review outcome

Independent Review 23 does **not** accept Gate C. The revised package successfully removes embedded seed datasets from the standalone HTML and fixes the PR20 permit-alias and retirement-alert issues, but four bounded causes remain:

1. the incremental ZIP does not reproducibly enact the claimed source-file deletion/quarantine;
2. production seed fallback reads remain in storage/recovery/scheduler/application paths;
3. partial workspace restore still persists a different shape from the live canonical defaults adopted afterward;
4. the shared Gate C test contains literal identifying personnel sentinels.

A stale/missing governance artifact also needs correction in the next package.

## A. Reproduce the final tree, not just an overlay

Provide a reproducible post-Gate-C source state.

Preferred: produce a **minimal corrective ZIP plus `DELETIONS.txt`** containing exact repository-relative paths that must be removed, and make the handoff explicitly require applying deletions before overlaying changed files. Also provide a small verification script that fails if any deleted/quarantined path still exists.

Acceptable alternative: provide a complete sanitized post-Gate-C source snapshot if that is easier to make independently reproducible.

At minimum, the final production/release tree must not contain raw development roster masters, real-person sample workspace files, or obsolete operational seed modules in production paths.

## B. Remove hidden seed fallbacks from production code

Search the complete active source for all production reads of:

```text
window.HortOpsData.INITIAL_JOBS
window.HortOpsData.STAFF_ROSTER
window.HortOpsData.HISTORICAL_OCCURRENCES
```

Production startup, recovery, scheduler, dependency and restore paths must not depend on those globals.

Canonical defaults are:

```text
jobs: []
roster: []
historicalSnapshots: {}
```

Do not silently recreate legacy/demo data.

If seed data is still useful for automated tests, move it to explicit test fixtures under `scripts/fixtures/` or equivalent. Tests must inject those fixtures deliberately.

Do not weaken current-v2 validation or accepted v1 behaviour without explicit governance authority. If legacy migration retention conflicts with C7, raise a focused `DESIGN_CHALLENGE.md` rather than silently deciding policy.

## C. Fix FR-04 restore canonical equivalence

Current defect:

```text
validate incoming envelope
→ persist incomplete adoptedData
→ apply missing budget/ui defaults only to live memory
→ cold reload differs from accepted live state
```

Required contract:

```text
validate input
→ build one fully canonical detached restore envelope
→ insert canonical defaults for all accepted optional domains
→ validate canonical envelope
→ persist exact canonical envelope
→ reread/verify committed data where available
→ adopt detached committed/canonical data
```

At minimum include explicit values for:

```text
budgetSettings
uiState
permits
rostering
historicalSnapshots
assignments
jobs
roster
schemaVersion
```

Do not mutate caller-owned restore objects.

Add a test proving:

```text
restore
→ live state
→ readVerifiedCommittedV2
→ cold app.init()
→ export/import round trip
```

all agree for the relevant domains.

Also prove persistence failure leaves previous live state and previous raw committed bytes untouched.

## D. Remove identifying literals from shared tests

Do not retain a literal list of personnel names or email fragments in `scripts/test_gate_c.cjs`.

Use non-identifying checks such as:

- forbidden known production-domain pattern(s) where the domain itself is not sensitive;
- structural checks for synthetic-only fixture naming;
- confidential local privacy audit outside the shared package;
- irreversible hashes if a known-value sentinel is absolutely required.

The peer-review ZIP must contain no raw roster masters or real-person identifiers.

## E. Governance synchronization

Include the current `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md` in the correction package.

It must truthfully show:

- Gate A accepted;
- Gate B1 accepted;
- Gate B2 accepted;
- B3 transactional fixes implemented, with FR-04 still open until this correction is independently accepted;
- Gate C awaiting independent acceptance;
- Gate D not yet authorised;
- FR-02, FR-03, FR-07, FR-09 and browser smoke remain Gate D blockers.

Do not cite an independent review artifact that is unavailable from the package without clearly identifying it as an external prior authority.

## F. Focused tests only

Run and report:

```text
node scripts/test_gate_c.cjs
node scripts/test_gate_b3.cjs
node scripts/test_gate_b2.cjs
node scripts/test_gate_b1.cjs
node scripts/REVIEW23_FOCUSED_PROBES.cjs
```

Also rebuild both standalone distributions twice and verify byte-identical output.

Do not spend this cycle repairing FR-02, FR-03, FR-07 or FR-09 unless an unavoidable dependency is discovered. Those retain their Gate D owners.

## G. Required package contents

Minimal package only:

- genuinely changed production files;
- genuinely changed focused tests;
- `REVIEW23_FOCUSED_PROBES.cjs` result-compatible implementation;
- `DELETIONS.txt` if using an incremental deletion-aware package;
- rebuilt `index.html` and `dist/hort_ops_offline_planner.html` if source changes affect them;
- `index.modular.html` if changed;
- updated `GATE_C_CHANGE_AND_EVIDENCE_REPORT.md`;
- updated `HANDOFF_GATE_C_PR21.md` or successor;
- updated `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md`;
- SHA-256 manifest.

## H. Stop condition

After the bounded corrections and tests, **STOP** and return the package for independent Review 24.

Do not begin Gate D or any Stage 2/3 work.
