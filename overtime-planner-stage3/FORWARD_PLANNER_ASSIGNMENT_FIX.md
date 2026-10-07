# Forward Planner assigned jobs disappearing

Owner report: Windows 11, browser Version 154.0.4258.53 (Official build), 64-bit,
opening `index.html` by double-click. Browser product name was not supplied.
After reset, User Table workforce import, job creation and three-person assignment,
the filled occurrence disappeared from Forward Planner. This is a Stage 3
corrective defect, not a Stage 4 capability request or owner release acceptance.

## Reproduction and correction

A real-browser regression reproduced the issue after saving even one person to a
three-person one-off job on Saturday 10 October 2026. The committed occurrence had
no runtime `weekNumber`, despite belonging to planner week 41. It also lacked
`dayOfWeek`. Forward Planner indexes assigned staff by week/day, so it removed filled
vacancies without rendering their assigned staff cards. Assignments remained saved.

The scheduler's explicit-occurrence projection now derives the display week from
its resolved slot and the display day from the canonical occurrence date. Dates
outside the slot's recognised weekdays retain their supplied day rather than being
mislabelled. The projection copies the record: persisted snapshot bytes, assignment
provenance, eligibility, recurrence and historical lifecycle rules are not changed.
Modular source remains authoritative; index and distribution are rebuilt together.

## Verification

`npm run test:planner:assignments` exercises real Add Staff and Save Allocation
buttons with a clean current-schema client, real synthetic User Table import and
three workers. Six checks cover partial/full/reloaded assignments for one-off and
recurring jobs. Assigned cards remain visible, counts reflect three rostered people,
filled vacancy buttons disappear and an assigned card reopens the correct editor.
The original committed snapshot, assignments and provenance survive reload.

The before-fix failure is retained locally in
`test_reports/phase8-forward-planner-before.log`; it is not counted as a pass.
Results and regression logs remain ignored and outside GitHub transport. Automated
verification uses child-local Linux Chromium; it does not claim a Windows browser
retest by the owner. Current release acceptance remains open pending the corrected
runtime's owner/independent acceptance. The owner's Stage 4 goals remain flexibility
and fairness; this fix does not implement or approve new rostering policy.
