# Tranche C5 - Canonical Status History Walkthrough v5.0.0

Date: 2026-09-21

Status: PASS / COMPLETE / AWAITING PEER REVIEW

## Outcome

C5 removes the competing writable legacy Register timeline while preserving historical evidence. Governed lifecycle commands and canonical `statusEvents` are now the only active lifecycle-status write path.

## Production changes

### `src/program-planner/js/register.js`

- Removed all `data-register-action="add-status-history"` controls.
- Removed editable Register `status` and `statusDate` controls from NSA, EVT, and generic detail rendering.
- Preserved unrelated editable fields, including EVT priority.
- Removed `addStatusHistoryEntry(...)` and `deleteStatusHistoryEntry(...)`.
- Removed legacy timeline delete controls and their delegated click handler.
- Removed generic persistence propagation for `status`, `statusDate`, and `statusHistory`.
- Retained legacy history as a read-only compatibility source.
- Removed the derived/fabricated NSA Received history item; the timeline now shows only actual evidence.
- Standardised read-only history presentation to newest-first.

### `src/program-planner/js/status-ui.js`

- Removed cosmetic hiding shims for Register lifecycle controls that no longer exist structurally.
- Kept the governed lifecycle launcher, confirmation, attribution, current-status display, and canonical event history.
- Standardised Register drawer canonical event order to newest-first.

## Compatibility retained

- `status.js` continues deterministic legacy `statusHistory` to `statusEvents` migration.
- `data-workspace.js` continues import preservation/merge compatibility.
- Genuine legacy evidence is represented as migration events with `source: "migration"` and `action: "Legacy status history"`.
- No active UI can append, edit, or delete legacy history.

## Tests added

- `tests/c5-canonical-status-history.test.cjs`
  - C5-01 obsolete writer unavailable.
  - C5-02 one governed transition writes exactly one canonical event.
  - C5-03 two transitions align current status with latest canonical history.
  - C5-04 legacy history migrates without loss and cannot be newly appended.
  - C5-05 reconciliation produces no double-write.
- `tests/browser/c5-status-history.spec.js`
  - C5-BR-01 obsolete controls absent from the DOM.
  - C5-BR-02 real governed UI transition writes one canonical event.
  - C5-BR-03 identity, status, and canonical event set survive durable reload with no legacy phantom.
  - C5-BR-04 migrated historical evidence remains readable and obsolete controls remain absent.

## Gate results

- Deterministic: 56 / 56 PASS.
- Playwright browser: 44 / 44 PASS across 17 spec files.
- Focused C5 browser: 4 / 4 PASS.
- JavaScript/CJS syntax: 83 / 83 PASS, 0 failures.

The accepted C4 baselines of 51 deterministic and 40 browser tests remain green inside the expanded totals. Drawer R1, Calculator C4, Quote C1/C2, and polygon promotion C3 regressions all remain covered by the complete browser run.

## Historical migration deferral

After the C5 peer review identified incomplete handling of legacy payload-held history and schema-v5 C4-era workspaces, the user authorised a fresh-start rollout deferral. The legacy-history compatibility corrective remains open, but is deferred until after C6 and H1+.

The rollout condition is strict: users start from a completely reset workspace, use new records or newly parsed PDFs, and do not restore or import legacy workspace/backup data. Pre-C5 workspace/backup restoration is unsupported until the deferred patch is complete.

The authoritative decision is `Offline/ChatGPT Reviews/C5 Historical Status Migration Deferral Decision.md`.

## Scope boundary

No C6 rate-pair work or H1+ work was started under C5. The next authorised order is C6, then H1+, then the deferred C5 historical-status migration corrective.
