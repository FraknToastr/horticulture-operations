# Active remediation roadmap

> **Current controlling status — 22 September 2026:** P0–C6 and H1 are PASS / CLOSED. H1 was accepted by `ChatGPT Codex takeover review 11.md`; H2 is IMPLEMENTED / AWAITING INDEPENDENT PEER REVIEW. MH1 and M1 remain blocked pending explicit authorisation. The deferred pre-C5 historical-status migration remains not applicable to the supported fresh-start deployment.

Updated 22 September 2026 for the C6 final commercial-snapshot safety micro-patch.

| Stage | Status |
| --- | --- |
| P0, C1, C2, C3, R1 | Complete |
| C4 | Pass / closed |
| C5 | Pass / closed |
| Pre-C5 migration | Not applicable to the supported fresh-start deployment |
| C6 | Pass / closed |
| H1 | Pass / closed |
| H2 | Implemented / awaiting independent peer review |
| MH1, M1 | Blocked pending explicit authorisation |

## C6 final patch scope

- Block structural unit or quantity-mode edits to Rate Items with Job, CostingLine, or QuoteLine lineage; users must create a new Rate Item.
- Preserve existing commercial snapshots during monetary-only rate edits and geometry synchronisation.
- Detect source-area / quantity / unit mismatches in Data Health.
- Clearly lock polygon-derived Calculator quantity, unit, and unit-rate controls while retaining editable manual Calculator controls.
- Retain C6’s structured multi-rate mapping and canonical `geometry.areaSqM` model.

The C6 peer-review deliverable must include deterministic, browser, syntax, archive-integrity evidence and a replacement ZIP package. No H1 work is authorised before C6 peer-review closure.

Historical milestone records, prior reviews, walkthroughs, and the previously deferred legacy migration material remain archival evidence; they are not active work instructions for the supported fresh-start deployment.
