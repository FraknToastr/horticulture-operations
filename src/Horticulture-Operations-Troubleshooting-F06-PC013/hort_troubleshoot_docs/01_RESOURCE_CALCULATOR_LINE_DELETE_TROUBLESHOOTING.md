# Resource Calculator — Costing Line Delete Failure

## Symptom

When a line item is added in Resource Calculator and the officer attempts to remove it, the UI can report:

> `Costing line "EVT-COST-0Z335BA" was not found.`

The line remains effectively undeletable from the user's perspective.

## Severity

**High functional defect.**

This blocks normal editing of a Draft operational cost model. It is not merely a test-procedure issue.

## What has been proven

A clean source-level reproduction was run using the current package's actual:

- `shared/js/rate-library.js`
- `program-planner/js/model.js`
- `program-planner/js/costing-model.js`
- default Rate catalogue

The first manual EVT costing line produced by the current source was:

```text
EVT-COST-0Z335BA
```

This exactly matches the ID reported in the UI failure.

The following canonical sequence succeeds:

```text
ProgramCosting.createLine(...)
→ EVT-COST-0Z335BA exists
→ ProgramCosting.removeLine(workspace, "EVT-COST-0Z335BA")
→ costingLines length becomes 0
```

### Conclusion

`ProgramCosting.removeLine()` and the canonical Costing Line identity are functioning correctly when they receive a coherent workspace.

The defect therefore exists **above the Costing model**, in the Resource Calculator/browser controller and workspace-synchronisation path.

---

# Source path analysis

## Creation path

`src/program-planner/js/costing.js`

`addRate()`:

1. resolves the selected Project;
2. resolves or creates a canonical Draft calculator Job;
3. calls `ProgramCosting.createLine()`;
4. persists through `ProgramApp.updateWorkspace()`;
5. separately performs a delayed reconciliation of the Costing controller from `ProgramApp.workspace()`.

The source contains an explicit reconciliation workaround:

```js
var reconcile = function () {
  var app = root.UOS && root.UOS.ProgramApp;
  var liveWorkspace = app && typeof app.workspace === "function" ? app.workspace() : null;
  if (liveWorkspace) update(liveWorkspace);
  else if (saved) update(saved);
};

if (typeof root.setTimeout === "function") root.setTimeout(reconcile, 0);
```

The comment immediately above this code acknowledges that the controller has previously needed special handling to reconcile its local view with the canonical workspace.

## Delete path

`removeCalculatorLine(lineId)` calls:

```js
mutate(function (api, workspace) {
  var line = (workspace.entities.costingLines || []).find(function (item) {
    return item.id === lineId;
  });

  ...

  return api.removeLine(workspace, lineId);
});
```

`ProgramCosting.removeLine()` then normalises the supplied workspace and executes:

```js
var line = find(result.entities.costingLines, text(lineId), "Costing line");
```

The reported exception can only occur if the **workspace passed into the delete mutation does not contain the line ID rendered by the controller**.

That is the critical diagnostic fact.

---

# Controller versus canonical workspace

Resource Calculator has two relevant workspace views:

1. `ProgramCostingController.state.workspace`
   - a cloned local snapshot;
   - used to render costing rows and their `data-costing-remove` IDs.

2. `ProgramApp.state.workspace`
   - authoritative application workspace;
   - cloned by `ProgramApp.updateWorkspace()` and passed to mutations.

The delete button ID comes from the first.

The delete operation executes against the second.

The error proves that those two views can diverge.

## Additional event-contract defect

The Costing controller subscribes to:

```js
document.addEventListener("uos:workspace-changed", function (event) {
  var detail = event.detail || {};
  var workspace = detail.workspace || detail.after;
  if (!workspace || !workspace.workspace || workspace.workspace.destination !== "costing") return;
  update(workspace);
});
```

However `ProgramApp.publishWorkspaceChange()` dispatches the return value from `ProgramObservability.recordMutation()`.

That record contains metadata such as:

- revision;
- command;
- changed IDs;
- operations;
- duration.

It does **not** contain `workspace` or `after`.

Therefore this controller listener cannot currently perform the refresh it is written to perform.

This is a concrete event-contract mismatch and should be repaired even if another pathway is currently providing most refreshes.

---

# Recommended repair

## Principle

**Resource Calculator must render from the same canonical workspace authority used for mutations.**

Do not resolve this by making `removeLine()` silently ignore missing IDs. That would hide the state divergence and could conceal real data loss.

## Step 1 — repair the workspace-change event contract

Choose one canonical event contract.

Recommended:

```js
document.dispatchEvent(new CustomEvent("uos:workspace-changed", {
  detail: {
    workspace: clone(state.workspace),
    mutation: record
  }
}));
```

Then update all listeners to consume that documented shape.

Alternatively rename the event if it is intended to contain observability metadata only. Do not keep a listener expecting a workspace from an event that never supplies one.

## Step 2 — make the Costing controller's update path canonical

After every successful business mutation:

- controller state must be refreshed from the authoritative ProgramApp workspace;
- do not preserve a separately mutated controller workspace;
- do not render a newly created line from an intermediate mutation result that has not become authoritative.

The existing `setTimeout(reconcile, 0)` workaround should be reviewed and ideally removed once the event/update contract is deterministic.

## Step 3 — add a defensive preflight to delete

Before invoking the model delete command, compare the displayed line ID against the authoritative workspace.

Conceptually:

```js
var appWorkspace = ProgramApp.workspace();
var canonicalLine = appWorkspace.entities.costingLines.find(function (line) {
  return line.id === lineId;
});

if (!canonicalLine) {
  // Refresh UI from canonical state and surface a diagnostic state mismatch.
  update(appWorkspace);
  throw new Error(
    'Resource Calculator was out of sync with the canonical workspace for Costing Line "' + lineId + '".'
  );
}
```

This is not the primary fix. It is a safety net and diagnostic guard.

## Step 4 — serialize UI intent while a costing mutation is pending

Add/delete/update actions should not be allowed to overlap ambiguously.

While a costing mutation is in-flight:

- disable Add/Remove controls or mark the calculator busy;
- complete the canonical mutation;
- refresh controller state from canonical ProgramApp state;
- then re-enable editing.

`ProgramApp.updateWorkspace()` already serializes mutations internally, but the Resource Calculator UI should reflect that transaction boundary so users cannot act against a stale rendered row.

## Step 5 — preserve dependency rules

Once line lookup succeeds, deletion must continue to distinguish:

### Manual costing line

Remove the Costing Line through `ProgramCosting.removeLine()` and recalculate its Job estimate.

### Geometry-derived line

Continue to use `WorkAreaService.removeGeometry()` so mapped-work lineage is removed through its governed dependency path.

Do not bypass mapped-work lineage protections merely to make the trash button work.

---

# Required instrumentation during the repair

Temporarily record the following when Remove is clicked:

```text
lineId
controller workspaceRevision
ProgramApp workspaceRevision
controller contains line? true/false
ProgramApp contains line? true/false
selectedProjectId
jobId
pending mutation count if exposed
```

The expected failing signature is:

```text
controller contains line = true
ProgramApp contains line = false
```

or a revision mismatch that explains the same condition.

Remove temporary logging after the regression is proven fixed.

---

# Required tests

## Model regression

Create the exact deterministic first EVT line and remove it:

```text
createLine → EVT-COST-0Z335BA
removeLine → succeeds
```

This protects the canonical Costing model from future regression.

## Browser acceptance — mandatory

### RC-DEL-01

1. Open Event Resource Calculator.
2. Select a Delivery Project.
3. Add one active Rate Item.
4. Confirm one Costing Line appears.
5. Click Remove.
6. Confirm the row disappears.
7. Confirm canonical `entities.costingLines` no longer contains the ID.
8. Reload/reopen the workspace.
9. Confirm the line does not return.

### RC-DEL-02

Add → edit quantity → remove.

Expected: no stale update command recreates the deleted line and no `not found` error is emitted.

### RC-DEL-03

Add → immediately remove as soon as the row becomes actionable.

Expected: transaction boundary prevents stale-state deletion.

### RC-DEL-04

Add two copies of different Rate Items and remove only one.

Expected: the exact selected Costing Line is removed; the other remains.

### RC-DEL-05

Repeat in NSA Resource Calculator.

### RC-DEL-06

Remove a geometry-derived costing line.

Expected: the governed mapped-work removal path is used; manual-line deletion logic does not bypass geometry lineage.

---

# Definition of done

This issue is resolved only when:

- manual Resource Calculator lines can be created and deleted reliably;
- the exact canonical line ID visible in the row exists in the workspace used by the delete mutation;
- the UI and ProgramApp revisions cannot silently diverge across the action;
- mapped lines still obey WorkAreaService dependency rules;
- reload/export-import does not resurrect a deleted line;
- the browser regression suite covers add/edit/delete behaviour for both EVT and NSA.
