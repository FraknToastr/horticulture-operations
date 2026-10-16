# Space Map guidance and Scheduler updates — 16 October 2026

Implemented for NSA and EVT. Overtime is unchanged. Changes remain local; no commit or publication was requested.

## Behaviour

- Empty Space Map records show a centred Add orb and a Location/Approve/Undo/Cancel explanation. Add opens the real guarded creation menu; example controls are illustrative. Saved locations or work polygons dismiss the guide, while drafts and tree reference features do not. Create Project and Moasure remain available.
- Timed Week bookings use continuous side-by-side cards. Connected overlap groups have stable equal-width lanes, with lane reuse when a booking finishes. Time rows stay at 48px per half hour. The calendar widens horizontally when needed, retaining the 6am starting scroll and full 24-hour access.
- Month cards show a clock for timed bookings or calendar for all-day bookings, with separate hover-tips. A shared accessory rail aligns priority, warning and booking-type symbols right and reserves the Move target. Side-handle hit areas avoid these symbols.
- Selected cards use a strong persistent border and a 1.4-second pulsing overlay. Text and fill remain steady. Multi-day segments pulse together; reduced motion uses a static highlight. The dedicated overlay avoids the shared hover-tip reset on card pseudo-elements.
- Edge dragging detects actual horizontal scroll progress before starting the week-paging dwell. This handles reserved scrollbar gutters that overstate the reachable scroll limit.

## Outlook export

The modal supplies an editable `<job title> - <resolved location>` subject, reminder choices (none, one hour, one day, one week), CC recipients and a conditional organiser email. Missing real locations are omitted from the subject. The subject includes the location even in Privacy Mode, as requested; the separate ICS LOCATION property retains its privacy behaviour.

CC accepts comma- or semicolon-separated addresses, validates each address and deduplicates them. Organiser email is required only with CC. These fields and the custom subject are transient and do not alter saved job titles or workspace contact data. Validation happens before the existing save-and-download sequence. No email is sent.

`SchedulerCalendarTools.outlookFile(job, options)` adds optional `subject`, `reminderMinutes` (0, 60, 1440, 10080), `ccEmails` (array or separated string), and `organizerEmail`. Existing callers remain supported. Files include informational attendees, an organiser when needed, and display alarms. Existing timezone, exclusive all-day end dates, escaping, line folding and stable UID behaviour remain.

## Verification

Focused verification only; no screenshots or mobile-device tests.

- 17 model cases across `scheduler-calendar-tools.test.cjs` and `scheduler-week-editing.test.cjs` pass.
- 22 distinct desktop Chromium scenarios pass across onboarding, Week viewport, side-by-side cards, multi-day editing, direct placement, vertical handles and Outlook export. Affected cases were rerun after the overlay and edge-paging fixes.
- Live opacity samples verify that the pulse actually animates. Geometry checks verify overlap lanes, uninterrupted durations, accessory bounds and sticky-header clipping.
- JavaScript syntax and Git whitespace checks pass.

Actual import into desktop Outlook has not been tested; generated ICS content and the app's download workflow are covered.

Subsequent mode-specific guidance, MetroMap activation, adaptive columns and EVT table updates are documented in `space-map-adaptive-scheduler-register-2026-10-16.md`.
