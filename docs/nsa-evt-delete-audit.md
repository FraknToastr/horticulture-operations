# NSA/EVT destructive-action audit

Audit date: 8 October 2026. Overtime is intentionally excluded.

| Entry point | Warning and deletion behaviour |
| --- | --- |
| Register rail / record inspector bin | Existing impact modal retained; confirmation rechecks the captured workspace before cascading linked-record deletion. |
| Planner task bin | New warning explains suppression, not physical deletion. Linked Jobs and financial history remain. |
| Planner Edit task: reset or change purpose requiring linked Job deletion | Existing explicit Keep Job / Delete Job confirmation retained inside the editor. |
| Scheduler Delete job | Existing warning and optional linked-task/Calculator deletion retained; captured workspace rechecked before applying. |
| Cost Library rate bin | Existing warning retained through the shared safety helper. Referenced rates remain protected; missing dialogs no longer allow deletion. |
| Resource Calculator item bin | New warning names the item and previews affected costing, geometry, Jobs and Draft quote lines. Existing financial protections remain. |
| Resource Calculator bulk Delete controls | Existing impact preview/confirmation and workspace fingerprint checks retained. |
| Quote adjustment Remove (×) | New warning identifies the editable adjustment. Source Calculator items remain; financial locks are rechecked. |
| Map polygon bin | Existing polygon warning retained; captured workspace checked before geometry/costing cascade. |
| Map vertex Remove (×) | New warning explains geometry and costing recalculation; shape identity and workspace checked before editing. Minimum-vertex validation remains. |
| Map location / pin Remove | Existing warning retained through the shared safety helper; unconfirmed fallback removed. |
| Data & Settings: session Clear controls | Existing session-clear warning retained; captured workspace/context checked before clearing. Stored data remains available. |
| Data & Settings: Delete Stored Workspace | Existing warning and required backup retained. Deletion remains tied to the backed-up workspace revision. |
| Startup factory-reset request | Existing explicit warning retained; startup is not implicit deletion authority. |

## Common rules

- The shared NSA/EVT `ProgramDeleteSafety` helper uses the existing `UOS.dialogs.confirm` danger modal, explicit Cancel and action-specific confirmation labels.
- Opening, cancelling, Escape and closing must not mutate workspace data. Missing or failed warning services block deletion and report an error.
- A changed target/workspace or selection requires a fresh warning. Mutation callbacks recheck captured state before applying queued commands.
- Repeated activation of new warnings opens only one modal and executes one confirmed action.
- Every bin SVG uses the common `program-delete-action` class and `--uos-danger` colour, including hover, focus and selected states. Existing button frames/fills and disabled opacity are preserved.
- Close buttons, cancel buttons, filter resets and map drawing Undo/Cancel are not deletion entry points. Final destructive buttons inside warning modals do not open a second warning.

## Verification

- `tests/delete-safety.test.cjs`: cancellation, missing/failed dialogs, stale entities/context, queued mutation guards and duplicate activation.
- `tests/browser/delete-warning-audit.spec.js`: NSA/EVT warnings, persistence, stale-target handling and bin colour states.
- Existing Calculator, financial-protection, Register and Scheduler deletion regressions explicitly confirm before checking results.
