# Stage 5 — deferred implementation handoff

**Resumed by the owner on 18 October 2026.** The Stage 3 budget decisions are
closed as irrelevant to a clean client release; automated status processing must
remain paused. See the [dated resolution](stage-3-owner-decisions-2026-10-18.json).
The text below preserves the original handoff and is superseded where it says
Stage 5 is still deferred or the three Stage 3 decisions are pending.

Recorded 17 October 2026 at the owner's request to wait for a quota top-up.
**Deferred; implementation and tests have not started.** Resume only when the
owner requests it. This document and the accompanying evidence manifest preserve
the remaining work; no temporary conversation state is needed to recover it.

## Starting point

- Repository: `/home/n0rt/headroom-projects/Hort Ops 23 September`.
- Work on `main`, tracking `origin/main`. Baseline commit:
  `8545d675921297349123e9828e62035981d34889`.
- Stages 1–4 are complete locally, with uncommitted changes and retained evidence.
  They have not been published. Preserve every unrelated tracked and untracked
  file; do not reset, blanket-stage, clean, branch or rewrite history.
- Stage 4 completed an isolated dependency assessment, not a production upgrade.
  Shipped PDF.js and MapLibre remain unchanged.
- The original release audit remains immutable and **UNVERIFIED**:
  [original report](../../audits/nsa-evt/20261017-094545-local-8545d67/report.md).
  Do not replace that verdict with a later remediation conclusion.
- Overtime is independent and entirely outside this stage.

## Evidence to read before editing

Read the [accepted five-stage scope](README.md), then the
[Stage 1](stage-1-checkpoint.md), [Stage 2](stage-2-checkpoint.md),
[Stage 3](stage-3-checkpoint.md) and [Stage 4](stage-4-checkpoint.md) checkpoints.
The [deferred evidence manifest](stage-5-deferred-evidence.json) records hashes of
the existing evidence and likely source/test inputs at this handoff. It is an
inventory of existing proof, not a new test result.

Key findings to carry forward:

| Item | Existing evidence and required treatment |
| --- | --- |
| Governance drift | Original finding F-004: older automatic Planner Job clauses conflict with the accepted 1 October explicit-calendar decision. Follow the later accepted decision. |
| Reversal actor | Original finding F-007: reversal reason, timestamp and commercial lineage exist, but `reversedBy` is not written. The owner has since required a named officer for new reversals. Historical records must remain truthful. |
| CSS density | Original finding F-006: override density is a maintenance concern. Source metrics alone prove neither unused CSS nor a performance defect. Remove only duplication demonstrated safe to remove. |
| Receipts | Stage 2: Draft deposits remain allowed; ordinary payments require Issued or Accepted; new receipts on Declined are blocked. Existing history and reversal access remain available. Preserve this behavior. |
| Workspace review | Stage 3 created a separate reviewed candidate. Two missing Council operational amounts and an attributed status-readiness decision remain owner decisions. Automation remains paused. Do not adopt the candidate or invent those decisions. |
| Dependencies | Stage 4: 7 browser and 3 loader checks passed; all 409 protected files were unchanged. PDF.js 6 requires compatibility changes and additional entry-point checks before adoption. MapLibre's critical advisory and missing full local licence texts remain open. Do not silently include vendor upgrades in Stage 5. |

## Work sequence

### 1. Establish the resumption baseline

Re-read root `AGENTS.md`, `/home/n0rt/.codex/RTK.md` and any applicable local
instructions. Use `rtk` for shell commands. Inspect current branch/upstream and
working-tree status, then compare relevant inputs with the deferred evidence
manifest. New owner edits after this handoff take precedence: inspect differences
and adapt without overwriting them. Record a fresh Stage 5 preservation baseline.

Use the existing Node/Playwright setup and desktop guard. Discover only relevant
tools if anything fails; do not claim a package is absent from one lookup. Tell
the owner the exact missing package/runtime and why it is needed before a
workaround. No additional packages are currently required for the handoff itself.

### 2. Reconcile governance with explicit calendar creation

Read `src/governance/DECISIONS.md`, especially **Explicit Planner calendar
creation — 2026-10-01**, and the historical 28 September rule it supersedes.
Cross-check `PRODUCT_CONTRACTS.md`, `PRODUCT_CONSTITUTION.md`, `RELEASE_GATES.md`
and `PC-020 — Planner Task Management and Delivery Lineage.md` in the same directory.
Review linked active documents and contract assertions before changing wording.

Make current normative text agree with the accepted behavior: Task Purpose
controls eligibility; ordinary saves do not automatically create or recreate
Jobs; creation is an explicit calendar action. Preserve the historical decision
record, marking superseded rules and linking the accepted replacement. Do not
restore automatic Job creation or broaden Job/costing/Quote coupling. Record
which active contradictions were corrected and which historical text was kept.

### 3. Require and preserve reversal-officer attribution

Likely implementation surfaces, to re-read at resumption:

- `src/program-planner/js/quote-builder.js`: `reversePaymentWithReason()` builds
  the reason collector and calls the canonical command through
  `ProgramApp.updateWorkspace()`.
- `src/program-planner/js/quote-model.js`: `reversePayment(inputWorkspace,
  paymentId, reason)` writes reversal state/time/reason, then normalizes. Its
  existing early return preserves an already reversed payment.
- `src/program-planner/js/planner.js`: existing session-operator helper uses
  `uos.program.statusOperator`; inspect the established behavior before reuse.
- `src/program-planner/js/status.js`, `status-ui.js`, `status-model.js`: current
  actor conventions and the evidence viewer's `payment.reversedBy` display.
- `src/program-planner/js/model.js` and persistence/storage code: confirm actor
  fields survive normalization, save/reload and export/import.

Implement the following bounded behavior:

1. Reuse an available session operator to prefill an editable officer-name field
   beside the existing required reversal reason. Collect a nonblank trimmed
   officer name for each new reversal. It is entered attribution, not proof of
   authentication. Do not add an authentication system.
2. Pass the actor explicitly to the canonical reversal command and persist it as
   `payment.reversedBy`. Validate it in the command as well as the UI so direct
   callers cannot bypass the requirement. Determine the smallest compatible
   signature after inspecting all call sites.
3. Preserve payment/allocation ownership, identity, amount, reason, timestamp and
   reversal lineage. Maintain atomic rejection/save-failure behavior and the
   first-click evidence-dialog/navigation fixes from earlier work.
4. An already reversed payment remains idempotent: a repeated command must not
   replace the original actor/reason/time or require fabricated historical
   attribution. Keep the existing no-op branch effective before validations that
   apply only to a new reversal.
5. Cancel, blank actor, blank reason and persistence failure must not leave a
   partial reversal. Handle unavailable session storage gracefully.
6. Existing historical reversals without an actor remain unchanged. The viewer
   continues to show “Not recorded”; do not backfill a current officer or infer
   one from an unrelated record.

Update affected synthetic callers and fixtures to supply an explicit actor for
new reversals. Keep legacy-history and repeated-command cases meaningful; do
not weaken assertions to accommodate a regression.

### 4. Perform bounded CSS consolidation

Inspect `src/program-planner/space-map-editor.css`, `styles.css`,
`client-demo-fixes.css`, the Space Map inspector markup in
`js/program-map.js`, and `src/shared/css/tokens.css` / `components.css`.

Measure the relevant cascade and identify exact repeated declarations before
editing. Reuse existing shared classes/tokens for inspector and action buttons
where behavior is equivalent. Consolidate only proven redundant rules. Preserve
NSA and EVT theme differences, accessible states, focus, active Edit icon
contrast, the six inspector tools, and full/summary/minimal collapse behavior.
Do not redesign controls, remove purposeful later overrides or claim dead code
from a text search alone. If no safe removal is demonstrated, document that
finding rather than forcing a cleanup. No Overtime/shared-runtime integration.

### 5. Verify only affected behavior and required dependencies

Use desktop Chromium, local HTTP, `playwright.desktop.config.cjs` and
`scripts/desktop-browser-guard.cjs`. No screenshots, mobile/device emulation,
touch tests, video, traces, persistent browser profiles or broad release reruns.
Record exact commands, selection and raw results. A required failure must be
fixed or documented as blocking; do not report completion over a failed gate.

| Area | Focused proof required |
| --- | --- |
| Canonical command, NSA and EVT | Named actor stored; blank actor/reason rejected atomically; original workspace preserved; payment/allocation lineage unchanged; repeated reversal leaves first actor/reason/time intact. |
| Persistence | `reversedBy` survives normalization, save/reload and export/import; legacy missing actors stay missing. |
| Reversal UI | Session prefill, explicit officer entry, cancellation, required-field validation, first-click reversal and evidence access; Payments section and focus remain stable. Test storage failure if the new code depends on it. |
| Funding regression | Draft deposits, Issued/Accepted payments, Declined receipt blocking and access to historical reversals remain correct after the attribution amendment. |
| CSS | DOM/computed-style checks in both owner themes, only for changed selectors and inspector states. No screenshot tests. |
| Governance | Current contracts and accepted explicit-calendar semantics agree; no ordinary save creates/recreates a Job. Run the applicable existing governance/Planner checks if affected. |

Candidate existing test sources: `tests/quote-funding.test.cjs`,
`tests/browser/quote-first-interaction.spec.js`,
`tests/browser/quote-payment-funding-workflow.spec.js`,
`tests/browser/performance-audit.spec.js`,
`tests/browser/space-map-editor.spec.js`,
`tests/browser/space-map-sidebar.spec.js`,
`tests/canonical-work-governance.test.cjs` and applicable Planner lineage tests.
Inspect current titles and helpers before choosing exact files/grep filters.
Do not run every mixed test file merely because it appears in this list.

Extend or add focused tests when existing ones do not prove the actor/cascade
change. Run each necessary selection once; repeat only for a new amendment,
failure or unresolved concern. Do not rerun Stage 4 PDF assessment for unrelated
Stage 5 changes.

### 6. Save final assessment in both required formats

Create a Stage 5 checkpoint with change rationale, evidence, exact validation,
remaining limits and preservation results. Produce these final durable outputs
in this remediation directory:

- `final-remediation-report.md`.
- `final-remediation-report.html`: one self-contained HTML/JS/CSS file with
  embedded report data and no CDN, fetch, external fonts or build dependency.
  Provide interactive stage/finding filters and expandable evidence details,
  usable from a local file. Use keyboard-accessible controls and text status
  labels. Keep essential results readable if JavaScript is unavailable.

Both reports must agree on counts, statuses, assessed environment, unresolved
owner decisions and dependency risks. Distinguish passed proof, not tested,
blocked and deferred work. Link the original audit rather than changing it.
Do not certify GitHub Pages or Edge `file://` runtime from local HTTP Chromium
results. Validate report data parity, local links and the HTML's independence
with small nonvisual checks; only add a focused desktop interaction check if
needed for the report's behavior. No screenshot/mobile tests.

Verify the final diff and preservation baseline. Save a clear checkpoint and
stop. Do not commit, push, adopt the Stage 3 workspace or upgrade vendor runtimes
without a separate owner request.

## Resume instruction

After the quota top-up the owner can say:

> Resume Stage 5 from
> `docs/remediation/nsa-evt-release-2026-10-17/stage-5-resume-plan.md`.
> Implement the remaining work, run only focused necessary checks, save both
> final reports, then stop without committing or pushing.

This handoff records existing evidence only. No Stage 5 implementation, tests or
completion claim has been made.
