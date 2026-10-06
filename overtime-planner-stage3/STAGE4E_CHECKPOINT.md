# Stage 4E checkpoint — bounded mixed-policy planning

Date: 6 October 2026

Status: complete locally. Stop before Stage 4F until the owner explicitly resumes it.

## Owner-approved policy

- When fixed staff are ineligible, keep the fixed conflict visible and propose a separate eligible manual substitute for operator approval.
- Keep fixed and rotation scope bounded by the existing occurrence repeat count.
- After that count, leave later occurrences unstaffed unless another saved policy applies.
- Never silently replace a fixed officer, alter a fixed instruction, or convert post-scope vacancies to automatic staffing.

Stage 4D's approved overtime-only policy remains in force. Manual substitute selection uses calendar-year operator-verified actual overtime plus saved future overtime commitments, raw hours, existing pool/team/fatigue precedence, no refusal bonus, and no regular-hours entry or calculation. Unknown overtime remains unknown.

## Implemented behavior

The Staff Allocator exposes **Plan future mix** when at least one staged fixed or rotation slot spans more than one occurrence. The detached proposal runs the canonical rostering engine against cloned saved state and the open allocator's staged slots. It shows each bounded occurrence, projected policy crew, manual substitute proposals, fixed/rotation conflicts and remaining vacancies.

Existing manual and unrelated downstream assignments are protected and receive no repair. When a fixed officer is ineligible and the slot remains vacant, the planner can propose the lowest-hours otherwise eligible candidate as a separate manual assignment. Scarcity stays visible when no verified-hours eligible substitute exists. Rotation failure is reported as a vacancy and is not silently converted into another policy.

Approval remains zero-write. It records the exact proposal against the saved-state and staged-policy signature. **Confirm & Save Allocation** recomputes that proposal, rejects stale changes, applies approved manual repairs to the detached rostering result, and sends the complete delta through the existing commitment planner, Schema v2 retention checks and verified atomic save. Repair provenance is `manual` and records its Stage 4E origin; the original fixed/rotation instruction and repeat count remain intact.

## Safety and compatibility

- Current and downstream manual assignments remain authoritative.
- Existing pool/team restrictions, qualifications, absence, overlap, rest, fatigue, plant-operator and crew limits remain canonical.
- Fixed and rotation instructions retain existing identities, provenance and occurrence-count semantics.
- Later occurrences receive no assignment after scope unless another saved rule covers them.
- Changed workspace data, staged crew, strategy, repeat count or writer generation invalidates approval.
- Read-only peers cannot open or approve the planning editor.
- The proposal does not write, save automatically, mutate historical occurrences or authorize batch planning beyond staged instruction counts.

## Verification completed

- Stage 4E focused browser suite: nine groups passed.
- Canonical rostering engine and lifecycle suites passed.
- Stage 4D overtime-hours allocation: 15 groups passed.
- Stage 4C preview, allocator usability, per-job staffing sections and Forward Planner assigned-card regressions passed.
- Retained release runner: all 24 suites passed.
- Stage 3 contracts and browser smoke, writer ownership, domain handoff, security, runtime and tooling portability suites all exited 0.
- Desktop and 375 px mobile proposal captures were inspected; the plan table scrolls horizontally and actions remain visible.

Local screenshots and results remain ignored under `test_reports/stage4e/`. No review archive or evidence package was generated.

## Publication boundary

The transport allowlist adds only Stage 4E source, its self-contained test and this checkpoint. This checkpoint does not authorize a commit, push, branch update, package, independent Review 65 verdict or expanded Windows/browser certification.
