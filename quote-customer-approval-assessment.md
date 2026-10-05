# Quote customer approval controls

For the current staff workflow, saved acceptance data and downstream app behaviour, see [How customer quote acceptance reaches the app](quote-acceptance-process.md).

Reviewed: 2 October 2026. Scope: the NSA and EVT Quote Builder, Quote commands, funding calculations, lifecycle integration and workspace persistence in this checkout. This is a code assessment, not a review of customer correspondence or the live application's stored records. No new approval controls were introduced.

## Finding

The app can record that a Quote has been accepted, but the current Accept action records an operator's assertion. It does not obtain or verify approval directly from the customer. Staff therefore need an external process for receiving approval and retaining evidence against the particular Quote revision.

## Controls present

| Control | Current behaviour |
| --- | --- |
| Explicit Accept action | Quote Builder exposes Accept when the saved Quote is Issued. Clicking it updates that Quote to Accepted through `ProgramApp.updateWorkspace` and `ProgramQuotes.setStatus`. |
| Model transition restrictions | Draft can become Issued; Issued can become Accepted or Declined. Accepted, Declined and Superseded Quotes cannot be accepted again or edited back into a Draft. Invalid transitions throw even if the UI is bypassed. |
| Issue readiness | Issue requires line items, a Quote date, a selected funding arrangement, scope/cost evidence and sufficient proposed funding. Customer acceptance is not required to Issue. |
| Commercial snapshot | Issued and resolved Quotes are immutable commercial snapshots. Changes require a revision. Issuing the replacement supersedes its predecessor; merely creating a Draft revision does not supersede it. |
| Audit record | Acceptance sets `statusChangedAt` and appends a `quoteEvents` record with the Quote ID, owner, event ID, timestamp, `status_changed` type, actor, reason and old/new status payload. |
| Agreement indicators | Draft customer funding is Proposed, Issued is Awaiting acceptance, and Accepted is Accepted. Funding position reports confirmed customer funding only for an Accepted Quote without a superseding replacement. Declined and superseded Quotes do not establish confirmed customer funding. |
| Separate payment history | Recording a payment does not set the Quote to Accepted. Payments reduce the customer balance independently of agreement. City-funded Quotes prohibit customer payments/deposits in the model as well as the UI. |
| Persistence protections | Workspace mutations are queued, normalized and saved through validated persistence. Shared IndexedDB storage provides revision checks and verified recovery snapshots. These protect consistency and recovery; they do not establish who the customer is. |

The current Quote UI enables payment recording for Issued/Accepted customer-payable Quotes. The underlying payment command also permits legacy Draft and Declined payments. Such payments are financial history, not proof of approval; active payments/allocations lock Draft commercial changes until reversed.

## Evidence and identity gaps

- Accept opens no evidence form or confirmation step. The command takes the Quote ID and target status, with no required customer name, authority, approval date, approval channel or evidence reference.
- The Quote audit actor is `quote.preparedBy`, falling back to `Officer`. This may identify the preparer rather than the person actually recording acceptance. The status wrapper has a session operator value, but the Quote command does not use it for its `quoteEvents` actor.
- Quote Builder captures the client's details and a preparer's name. Those fields are descriptive; they do not authenticate either party or prove that the client agreed to this revision and amount.
- This acceptance path includes no customer login, customer-facing approval link, signature capture, email-response processing or attachment requirement. Preview/PDF delivery does not itself signal approval back to the app.
- The inspected Quote acceptance command has no approver-role check. A user who can operate this workspace's Accept control can record acceptance. The audit event is part of locally persisted workspace data, not an independently signed or externally attested approval record.
- There is no dedicated acceptance evidence record linking the exact offered revision, customer amount, customer representative and supporting correspondence. The immutable commercial snapshot supplies the revision context, but the approval evidence still needs to be retained separately.

## Recommended next change

Keep the existing Issued → Accepted transition and add a **Record customer acceptance** form before invoking it. Require the customer representative, approval date, approval method and a correspondence/document reference; display the audit number, revision and customer amount being accepted. Record the interacting operator separately from the Quote preparer. Store these fields in an acceptance record and the audit event, linked to the immutable commercial snapshot. Make the acceptance details visible on the resolved Quote.

This would improve staff-recorded acceptance without requiring a customer portal. A later authenticated customer approval link could populate the same record. Revisions must require fresh approval; payments must continue to remain separate from acceptance. Role enforcement and external evidence retention should be evaluated if the operating environment requires verified identity or stronger audit assurances.

## Source references and verification

- `src/program-planner/js/quote-builder.js`: lifecycle visibility and Accept click handler; agreement/payment UI.
- `src/program-planner/js/quote-model.js`: `setStatus`, `logEvent`, `commercialProjection`, `createRevision`, `agreementStatus`, `recordPayment` and `commerciallyLocked`.
- `src/program-planner/js/funding-model.js`: proposed coverage versus `confirmedCustomerFunding`.
- `src/program-planner/js/status-app.js`: operator source and mutation reconciliation.
- `src/program-planner/js/app.js`, `src/program-planner/js/storage.js`, `src/shared/js/storage.js`: mutation queue, validated save and persistence recovery.
- `tests/browser/quote-funding.spec.js`: NSA/EVT issue-before-acceptance, agreement display and City payment restrictions. `tests/browser/draft-quoted-cost-deletion.spec.js`: issued/resolved and active payment protections during Calculator deletion.

The reviewed acceptance path is implemented in the shared program modules, so these findings apply to both NSA and EVT. External approval procedures are outside this assessment.
