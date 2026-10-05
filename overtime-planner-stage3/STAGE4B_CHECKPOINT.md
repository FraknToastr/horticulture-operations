# Stage 4B checkpoint: cross-team pools and work patterns

Date: 5 October 2026. Status: authorised implementation delivered for verification; test results and final qualification are pending. Stop after this increment until the owner resumes.

## Authority and delivered scope

The owner resumed Stage 4B after the Stage 4A design baseline. This increment implements cross-team staff pools and bounded job work patterns without introducing a new allocation algorithm. It supersedes Stage 4A's pending D02/D03 statements only for the contracts below. Fairness weights/windows, wider mixed automatic staffing and other unresolved Stage 4 policies remain pending.

Pool contracts:

- Optional Schema v2 `poolTags` catalogue entries have stable `POOL-` IDs, a case-insensitively unique label and explicit `active` state. Labels start with an ASCII letter and contain at most 40 ASCII letters, digits, underscores or hyphens; the UI displays the hashtag without making it an identity. Tags may be retired/reactivated rather than destructively deleting references.
- Optional staff `poolTagIds` retains formal team/department membership while allowing several cross-team pools. Missing optional catalogue/membership fields mean empty; no historical migration or automatic data adoption occurs.
- Job `preferredPoolTagIds` uses any-selected-active-tag membership. A candidate appears once; matching several tags adds no preference bonus. Eligible tagged candidates precede the existing ranking, which remains in force within each group.
- `exclusivePoolSource` is explicitly `none`, `teams` or `tags`; tag exclusivity uses `exclusivePoolTagIds`. Existing team restrictions retain their meaning when the new field is absent. Empty/retired exclusive pools cannot silently become unrestricted, and unresolved/duplicate references fail validation. Team and tag exclusivity cannot be invisibly combined.
- Hard qualification, availability, overlap, rest/fatigue and crew requirements remain authoritative for manual, fixed, rotation and assisted operations. A tag is not a qualification or safety override.
- Catalogue/membership editing exposes affected jobs and records the implemented change history. Confirmed workforce imports preserve matched memberships and qualification records; ambiguous identity matches are rejected rather than guessed. No saved assignment or past history is silently removed or reallocated when a tag changes.

Work-pattern contracts:

- `frequencyType: "work_pattern"` carries `workPattern` with explicit dates, exclusions and either `mode: "weekly"` or `mode: "run"`.
- Weekly `days` are zero to four consecutive cyclic weekdays, so Saturday/Sunday and runs crossing the end of the week are valid. With no selected weekdays, full-day public-holiday inclusion must be enabled. Weekly dates are the union of selected weekdays and optional full-day South Australian public holidays; each job/date occurs once.
- `includePublicHolidays` provides the owner's Saturday/Sunday plus nearly every public holiday workflow. `excludedDates` always wins, allowing deliberate holiday exceptions. Easter Friday through Monday can produce four daily occurrences without duplicating Saturday or Sunday. Part-day holidays are not automatically treated as full-day jobs.
- A one-off `mode: "run"` uses `startDate` and `runLength` from one to four days, including year crossings. Each date is staffed independently; there is no new shared multi-day allocation rule.
- Existing frequency types and saved historical facts are preserved. New fields are additive optional Schema v2 contracts, not a schema migration or history rewrite.

## Verification checkpoint

Completed locally on 5 October 2026. The standalone application was regenerated and `index.html` matches `dist/hort_ops_offline_planner.html` byte for byte.

- New `npm run test:stage4b`: 30 checks passed, with zero browser errors. Covers pool creation/membership, import preservation and ambiguity rejection, exclusive/preferred eligibility, holidays and exclusions, cross-year runs, real manual/fixed/rotation controls, assigned-card display/reload, protected assigned dates, retirement/history, failed writes and ownership transfer.
- All 24 retained release suites passed; all six Stage 3 contracts passed.
- Existing Stage 3 browser smoke, 18 writer, 15 handoff, seven security, six runtime and six Forward Planner assignment checks passed. Tooling portability and the ten inherited Review 55–63 probes passed. Historical Review 64 reproductions were not relabelled as positive acceptance checks.
- Test-environment fixtures now load the real planning-rules dependency before schema validation. Isolated old Schema v2 records remain valid without the extension module; any declared pool/pattern extension requires it and fails closed if missing.
- Browser coverage exposed and fixed editor re-entry during blur, removal of future assigned pattern dates, weekday-holiday projection metadata, and allocation-save baselines/assignment aliases when changing years. Failed saves do not advance baselines.
- The transport audit preserves all 433 host files and seven research files against the retained inventories. The 402-file allowlist contains four new source/document/test files and excludes local reports, history and packages.

Automated browser checks ran using this child project's local Linux Chromium runtime. This does not claim a new Windows/browser certification or independent peer-review verdict. Full-day holidays use the existing South Australian calendar; part-day holidays and new smart allocation algorithms remain outside this increment. Test reports and the source inventory stay local and ignored.

## Transport, isolation and next boundary

The reviewed transport allowlist adds the independent planning rules, planning editors, focused test and this checkpoint. Raw test results, history, research, ZIP packages, screenshots and hash inventories remain excluded. Original constitution and signed ChatGPT/Gemini history remain byte-preserved.

Overtime continues to own its source, styles, dependencies, fixtures and test regime; no NSA/EVT integration is authorised. No automatic staging, commit, merge, peer-review package or GitHub push occurs.

After verification, stop before Stage 4C. The owner must explicitly resume the next bounded increment; unresolved fairness, fixed fallback and regular-working-hours policies are not implicit defaults.
