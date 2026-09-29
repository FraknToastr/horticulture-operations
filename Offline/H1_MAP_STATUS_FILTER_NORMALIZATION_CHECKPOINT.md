# H1 Map Status Filter Normalization Checkpoint

Date: 22 September 2026  
Status: PASS / CLOSED — independent peer review 11 accepted H1.  
Scope: Map status comparison normalization only.

## Governance

```text
P0, C1, C2, C3, R1   COMPLETE
C4, C5, C6           PASS / CLOSED
Pre-C5 migration     NOT APPLICABLE TO SUPPORTED FRESH-START DEPLOYMENT
H1                   PASS / CLOSED
H2, MH1, M1          BLOCKED — not authorised
```

## Change

`src/program-planner/js/program-map.js` now uses one local `normalizedStatus()` authority for:

- Map dataset status matching;
- status-pill active-state matching; and
- status-pill toggle/removal matching.

Display labels and stored status values are unchanged. The patch does not alter lifecycle governance or the Map's spatial, owner, polygon, location, or search filters.

## Acceptance evidence

- H1-A: case-only stored-status variants render as one preferred-label status pill; PASS.
- H1-B: a missing stored Application status uses the same `Received` fallback for pill count and filtering; PASS.
- H1-01 deterministic: lowercase, uppercase, and missing stored status all match `Received`; unrelated status excludes them; PASS.
- H1-BR-01 browser: one visible `Received` pill has count 3, the active corresponding Map card remains visible through activation/deactivation, and a nonmatching status excludes the target dataset item; PASS.
- RC-DEL-01 isolated: PASS. Calculator deletion spec: 4 / 4 PASS. The test retains its automatic event-driven Calculator update assertion and no manual refresh.
- Root cause of the inconclusive earlier full run: Playwright reused a short-lived server from a prior foreground execution; its exit caused unrelated `ERR_CONNECTION_REFUSED` failures. A standalone server was started and verified with repeated page loads before the final gate.
- Complete deterministic suite: previously verified 81 / 81 PASS.
- Complete browser suite: 56 / 56 PASS (one worker; no retries) against the verified standalone server.
- Changed JavaScript/CJS syntax: PASS (`program-map.js`, `governed-remediation.test.cjs`, `location-filter.spec.js`).

## Stop point

Independent review: `ChatGPT Reviews/ChatGPT Codex takeover review 11.md` — PASS / CLOSED. It independently verified deterministic coverage, changed-file syntax, ZIP integrity, source scope, and the distinction between Codex-reported browser completion and an inconclusive independent browser reproduction.

No C4/C6 production change, manual Calculator refresh, H2, MH1, M1, or deferred C5 historical-migration work was started.
