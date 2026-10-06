# Stage 4D checkpoint — overtime-hours assisted allocation

Date: 6 October 2026

Status: complete locally. Stop before Stage 4E until the owner explicitly resumes it.

## Owner-approved policy

- Use calendar year-to-date operator-verified actual overtime plus saved future overtime commitments in the same year.
- Compare raw overtime hours. Do not normalize for part-time status or availability.
- Preserve the existing pool, team and fatigue preference order and all canonical safety checks.
- Do not apply the legacy refusal bonus in this new hours-aware mode. Legacy scoring remains unchanged.
- Treat missing or unresolved overtime evidence as unknown, never as zero.
- Exclude regular working hours from entry, review and calculation. Stage 4D makes no claim of complete regular-hours rest coverage.

## Implemented behavior

Each workforce record may carry an optional `overtimeHoursEvidence` ledger. Records have strict keys for identity, calendar year, through-date, raw overtime hours, the operator-stated source, recorded time and `operator_verified` status. Evidence is append-only during normal operation. Schema validation rejects malformed or duplicate records, and matched workforce imports preserve the full ledger.

The Workforce registry exposes an Hours action. The modal records the operator's verification claim and stated source; it does not describe the value as automatically payroll-verified. Explicit verified zero is valid. Imported/default zero without evidence remains unknown.

The Staff Allocator exposes **Plan by overtime hours** for an occurrence with vacancies. The proposal:

- reads a detached saved occurrence context;
- includes current staged staff without overwriting them;
- counts canonical saved future staff/shift commitments once;
- excludes past, other-year, unresolved and evidence-overlap cases from a claimed total;
- shows actual, future planned, current total and after-proposal hours separately;
- excludes unknown-hour candidates from automatic recommendations while keeping manual allocation available through the existing safety checks;
- stages selected people as stable manual slots in the open allocator and requires the existing **Confirm & Save Allocation** action to persist them.

No proposal can write directly. A changed saved domain, evidence ledger, staged crew or ownership generation invalidates the proposal. Read-only peers cannot append evidence or apply a proposal.

## Safety and compatibility

The implementation reuses canonical eligibility, qualification, absence, overlap, rest, fatigue, pool/team restriction and plant-operator crew checks. It preserves existing jobs, assignments, instruction provenance and optional-field compatibility. The current-only Schema v2 envelope remains authoritative. Evidence is escaped at render boundaries and its source text is retained as data.

The generated `index.html` and `dist/hort_ops_offline_planner.html` were rebuilt only from modular source. No NSA/EVT code, shared dependencies or test helpers were introduced. Original constitution, signed reviews and inactive history were not rewritten.

## Verification completed

- Stage 4D focused contract/browser suite: 15 groups passed.
- Stage 4C detached model: 11 groups passed.
- Stage 4C saved-state browser preview: 23 groups passed.
- Per-job staffing sections: 17 groups passed.
- Allocator usability: 17 groups passed.
- Retained release runner: all 24 suites passed.
- Stage 3 contracts, Stage 3 browser smoke, writer ownership, domain handoff, security, runtime and tooling portability suites all exited 0.
- Desktop and 375 px mobile proposal captures were inspected; the modal remains bounded and scrollable, with fixed actions and visible overtime-only policy text.

Local results and screenshots remain ignored under `test_reports/stage4d/`. They are not transport evidence and are not added to the GitHub transport set.

## Publication boundary

The reviewed transport allowlist includes only the new source, stylesheet, self-contained test and this checkpoint. This checkpoint does not authorize a commit, push, branch update, package, peer-review archive, independent Review 65 verdict or expanded Windows/browser certification.
