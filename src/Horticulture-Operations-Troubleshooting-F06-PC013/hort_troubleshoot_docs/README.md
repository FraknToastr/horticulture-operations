# Horticulture Operations Suite — Focused Troubleshooting Pack

This pack deliberately narrows scope to two issues raised during the updated v5.0.0 review:

1. Resource Calculator line items can be added but cannot reliably be deleted, with messages such as `Costing line "EVT-COST-0Z335BA" was not found.`
2. F-06 / PC-013 Quote Readiness incorrectly treats the Draft Quote being evaluated for Issue as contributing $0 customer funding.

The documents are ordered as follows:

- `01_RESOURCE_CALCULATOR_LINE_DELETE_TROUBLESHOOTING.md` — diagnosis, confirmed exclusions, likely state-synchronisation fault, repair plan, instrumentation and regression tests.
- `02_F06_PC013_QUOTE_READINESS_REMEDIATION.md` — complete focused remediation design for F-06 / PC-013, including exact business semantics and acceptance matrix.
- `03_CODEX_PROMPT_F06_PC013.md` — implementation prompt for Codex, intentionally limited to F-06 / PC-013.

## Current conclusions

### Resource Calculator deletion

The canonical Costing model is **not** the failing component. A clean EVT model reproduction generated the exact ID reported by the user, `EVT-COST-0Z335BA`, and `ProgramCosting.removeLine()` removed it successfully. The defect is therefore in the browser/controller workspace hand-off: the UI can hold/render a costing-line snapshot that is not present in the authoritative workspace supplied to the delete mutation.

### F-06 / PC-013

The failure is confirmed and deterministic. A Draft Quote with a $100 ex-GST customer charge and a $100 delivery cost is assessed as having `customerQuote: 0`, `fundingGap: 100`, and `ready: false` when Council operational funding is $0. The error is caused by the funding model accepting only Issued/Accepted Quotes as customer contributions even when Quote Readiness explicitly supplies the Draft Quote being evaluated for Issue.

The correct rule is:

> Ordinary project funding views use issued/accepted commercial commitments. Quote Readiness uses the Draft Quote being evaluated as a **prospective customer contribution** for the purpose of deciding whether that Draft may become Issued.

This distinction must be explicit in code and tests.
