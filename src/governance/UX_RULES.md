# UX Rules — v1.4-draft

1. Evidence gates explain themselves and provide an actionable route forward.
2. Quote Readiness governs **Issue**, not Quote Builder access or Draft creation.
3. Never gate workflow by module visitation/completion.
4. Show commercial provenance where material: governed costing, fixed rate, external estimate, authorised manual estimate/adjustment.
5. Preserve explicit human decision boundaries.
6. Fail early: unsupported work-type/rate mappings should be resolved before the final Create Job action.
7. Canonical modules remain independently usable where the business model permits.
8. Never silently repair integrity failures by guessing IDs, rates, mappings, relationships or statuses.


## Sidebar and module surface rules

9. **Retired sidebar mechanics are prohibited.** Sidebars are not expandable/collapsible into alternate-width modes and cannot be undocked or floated. No user control, persisted preference, event path or active layout state may expose the decommissioned system.
10. **Sidebar content is domain-specific.** Sidebars may show cards or expandable row-tables relating to the active Register and Project only, except where a module contract explicitly defines a broader read-only/listing surface.
11. **Location — Register view.** Always show one full-size Location Card in the sidebar. The card remains present when no Location has yet been recorded and becomes the obvious create/edit entry surface.
12. **Location — Project view.** Always show one full-size Polygons Summary Card, including when polygon count is zero. This card is the entry point into Polygon Inspector editing.
13. **Polygon Inspector.** Inspector cards are full-size. Compact-card variants are not part of the supported UI.
14. **Scheduler Job table.** Scheduler may show a compact row-table of all Jobs. Selecting the row/header for a Job belonging to the active Register/Project opens that Job in Scheduler Editor mode.
15. **Scheduler calendar visibility.** The calendar may display Jobs from any Register/Project in the owning application.
16. **Scheduler calendar interaction boundary.** Selecting a compact calendar Job card belonging to the active Register/Project opens Scheduler Editor. Selecting a calendar Job card belonging to another Register/Project opens a Job Summary modal instead; it must not switch, spoof or inject that Job into the active Project's editor context.
17. **Active-project day signalling.** Calendar day cells containing Draft or Scheduled Jobs for the active Register/Project are colour-coded at cell level. Jobs from other Register/Projects do not cause that active-project day signal.
18. **Canonical derivation.** Scheduler routing and day-cell signalling derive from canonical Job owner/project identity and canonical Job status. Calendar-local flags are not authoritative.


## Accordion drawer viewport and floor rules

19. **Drawer floor is always visible.** Every expanded accordion drawer has a visually distinct thick bottom rule (“drawer floor”). While the drawer is open, that floor must remain visible within the viewport. Content must never push the floor below the visible screen.
20. **Standard drawer height.** Every Register-row drawer, including native Register, uses the viewport space immediately below the expanded row header, accounting for the 4px bottom inset and persistent application chrome. Budget retains its full-page workspace with the same hard-floor treatment.
21. **Internal overflow.** If standard drawer content requires more vertical space than is available above the visible drawer floor, scrolling occurs inside the drawer content region. The page must not be relied upon to reveal a floor that has been pushed off-screen.
22. **No clipped terminal content.** Drawer sizing must reserve the floor thickness and required bottom padding before calculating the internally scrollable content height. The final control, text block or status element must remain reachable without being hidden beneath the floor.
23. **Unified drawer floor.** Register and every mounted module fill the available viewport beneath the selected row header. The 4px-thick hard floor remains 4px above the usable viewport bottom; Register has no intrinsic-height exception.
24. **Outer Register table is fixed while open.** Opening any row positions its header directly below the sticky column headings. Wheel, touch, keyboard and scroll chaining may scroll internal sections, but not the outer Register table. Closing the last row restores the prior table position.
25. **Content changes preserve the floor.** Adding, removing, expanding or collapsing internal content never changes the shared outer drawer height; internal regions scroll to keep every terminal control reachable. Space Map and Scheduler sidebars use the same 4px green divider as Calculator.

## Register shortcut states and alignment

26. Inactive shortcuts are disabled and explain the missing linked Project. Planner, Calculator, Scheduler and Quotes become active-unused when that Project exists; Scheduler needs no existing Job to open. Space Map remains available without a Project.
27. Register is always active-in-use. Every active shortcut, including the currently selected module, opens that record's module without collapsing its drawer or creating prerequisite records.
28. Usage derives from current saved work, not visits: added/edited/duplicated/suppressed Planner tasks (excluding untouched templates), mapped data, costing lines, Jobs and Quotes. Planner task edits mean current content, order, status, assignee, due date or notes differing from the template; Operational classification, timestamps and deleted Job history alone do not qualify. Use the owner-family outline for active-unused and thick dark outline for active-in-use; inactive buttons remain subdued.
29. Budget headings and values align left. Actions heading aligns with the compact right-aligned white shortcut panel, whose padding encloses every button. The three styles apply uniformly, including Planner.
30. An Operational Planner task without an existing linked Job uses a neutral calendar without a tick. An existing Draft Job uses an owner-coloured calendar without a tick; a scheduled Job uses owner colour and a tick. Deleting the Job retains the Operational task and restores its neutral calendar; the Planner Action shortcut returns to active-unused if no other current Planner work remains. Rendering and reload never recreate a Job.


## Quote funding arrangements and customer agreement — 2026-10-01

NSA and EVT Quotes explicitly select City of Adelaide, Customer, or City of Adelaide and customer. New Quotes default to Customer; existing editable legacy Drafts and legacy revisions require an explicit selection before Issue. Selection never creates or changes a Budget allocation.

The immutable commercial snapshot includes fundingMode (city/customer/mixed), the explicitly proposed mixed customer contribution (ex GST), and the applicable City funding and delivery-cost basis captured at Issue. Estimated work totals remain independent from customer payable amounts. ProgramQuotes.customerAmounts is the canonical customer calculation for Quote UI, funding position, payment balances, reports, preview and PDF. Legacy issued documents retain their original calculations and history.

City mode has zero customer contribution, GST, payable and outstanding balance; no customer payments or deposits are allowed. Customer mode charges the calculated Quote total and excludes all available City allocation from coverage. Mixed mode charges the explicitly proposed contribution plus existing 10% GST. Its initial suggestion is the work subtotal after discount and contingency minus City allocation, floored at zero. Subsequent costs, allowances and allocations never silently change the proposal; Use suggested amount is an explicit action. Show genuine surpluses.

Drafts may be underfunded. Issue requires the applicable City allocation plus proposed customer contribution to cover Calculator delivery cost ex GST, including costing-only Labour independently of Jobs or Scheduler use. Customer acceptance is not an Issue prerequisite. Draft customer funding is Proposed; Issued is Awaiting acceptance; Accepted is Accepted. Declined and superseded Quotes do not count as confirmed customer funding. Payments reduce the customer balance without changing agreement or proposed coverage.

Issued commercial changes require revision. Drafts with active payments or allocations require reversal through existing commands before funding arrangement, contribution or Council PDF disclosure changes. Customer and mixed-funding Preview/PDF documents distinguish the customer contribution, customer GST and customer payable; mixed documents do not expose internal work-cost line prices. Mixed Quotes may suppress all Council disclosure in the customer document; this is automatic when the applicable Council allocation is zero and otherwise is an immutable per-Quote choice. City-funded documents are internal Works Estimates: they show site context, scope and internal cost estimate totals, but omit customer identity, quotation, agreement and payment language. Third-party grants and in-kind funding are outside this model.


## Planner task editor — 2026-10-01

Task Purpose offers Reminder Task and Add to Scheduler. Selecting Add to Scheduler classifies the task as Operational but never creates a Job. Saving any task edits, including after Job deletion, is Job-free; the calendar icon explicitly creates or opens exactly one Draft Planner Job. The editor offers Save task and Cancel only.

Section is a dropdown of the owner's standard headings and the selected project's existing custom headings. Order stays project-wide and displays stored sortOrder plus one; whole-number input starts at 1 and saves as input minus one. Existing stored order and history remain unchanged.

The bottom card contains three noninteractive guide rows: neutral unticked calendar / Click to schedule a job; owner-coloured unticked calendar / Job Schedule not finalised; owner-coloured ticked calendar / Job Schedule finalised. It uses the existing coloured background and left accent, expands for the guide, and scrolls with the modal body while footer actions remain accessible.

## Commercial table rows and shared help — 2026-10-02

Cost Library, Resource Calculator and Quote Section 2 use the same row control height, single-line descriptions with contained ellipses, and 8px spacing. Cost Library Category pills share that height and fill equally wide frames in one column sized to the widest shortened Category in the current table. The literal shortening dots stay inside each frame, with full names available through shared help; Description takes the remaining space. All rows share aligned column boundaries, and supporting columns keep fixed widths. Rows reserve space for the full control height plus vertical padding and borders. Unit, Rate, State and Actions stay aligned. Action rails align right and reserve every position, including the empty Scheduler position for unschedulable Library items.

Shared help replaces native title tooltips, preserves accessible names and existing descriptions, and remains at least 48px away from the pointer. Tips stay within an 8px viewport margin, reposition at edges, and allow scrolling long text. Keyboard focus exposes the same help; Escape, focus loss and removing a target clear it.

Calculator deletion may remove an unscheduled line and its references in editable Draft Quotes, recalculating those Draft totals without resetting their funding choice or proposed contribution. Issued/resolved Quotes, active payments, allocation history, actuals, Budget charges and Planner ownership remain protected. Errors persist through rerenders until the next deliberate mutation.

## Calculator headers and Quote interaction position — 2026-10-02

The five Kind choices live inside the Cost Library top header, centred between its title and compact Tools button. When the available panel width cannot fit that row, the choices occupy a second row inside the same header. Resource Calculator shares the measured header height. Both table heading rows and every heading cell use the commercial control height plus 13px, with the grey background continuing across the action rail. Resource Calculator uses Rate item, centres Qty separately from Source, and left-aligns its group headings.

Routine Quote updates preserve the current internal scroll position, focused control and text selection through content rendering and Register drawer remounts. Capture position immediately before rebuilding the UI so scrolling during persistence is retained. Restoration is scoped to the same Register record, Quote and revision; it must not override navigation, another focused control or an open dialog.

Cost Library and Resource Calculator column headings remain sticky at the top of their own table scroll containers, including the grey action-rail area. Headings scroll horizontally with their columns. Resource Calculator section headings scroll normally with the items and use the same commercial control height plus 13px as the table rows, with left-aligned, vertically centred labels.

## Scheduler calendar scope — 2026-10-02

The calendar offers This application / All applications in NSA and This event / All events in Events. It defaults to the focused view and remembers the preference independently in each workspace. The scope applies to calendar cards and the unscheduled strip, without changing the sidebar record context or existing filters. Without an active Project, show all jobs and disable the focused option without replacing the saved preference. Conflict detection continues across the workspace even when other jobs are hidden.

Active Register/Project jobs use strong workspace colours and a distinct selected outline; other jobs use readable neutral colours. In the all-records view, a legend explains the distinction. Activating a related calendar card opens its job in the sidebar editor. Other cards open a read-only modal with source, owning Register/Project, dates, crew and job status. The modal has no editing or navigation actions, preserves the active Register/Project, and restores card focus on Close or Escape. Jobs with missing or unrelated Project linkage cannot enter the sidebar editor through calendar activation.

Changing the calendar scope preserves unsaved values in the current job editor. It saves only the calendar preference; job edits still require Save schedule.

## Resource Calculator Tools — 2026-10-02

Ordinary shared tooltips allow pointer events to reach controls beneath them. Only overflowing tooltips capture pointer events for scrolling their complete text. Both Calculator and Cost Library Tools drawers own Escape before the outer Register drawer.

Routine Calculator updates preserve both table scroll positions, including horizontal offsets, during content rebuilding and Register drawer remounts. Restoration applies to the same Register record and Project, without overriding navigation. Allowance saves must preserve the visible drawer floor and table position.

Resource Calculator has its own right-aligned Tools button matching Cost Library. Its independently disclosed drawer offers Delete All and deletion by Labour, Equipment, Material, Contractors and Sundry. Buttons wrap on narrow panels; opening the drawer preserves table scrolling, sticky headings, visible totals and the drawer floor. Escape from the tools closes that drawer and restores its trigger without closing the Register drawer.

Bulk deletion targets matching lines in the current Project, independent of Library tabs and filters, using the same kind classification as the displayed groups. Confirmation states eligible and retained counts, protection reasons, and linked Job/mapped-work effects. Changed canonical data requires renewed confirmation; a changed Project cancels the action. Eligible lines are removed through existing commands in one persisted batch. Protected Quotes, payments, allocation history, actuals, Budget charges and Planner-owned work remain protected. No eligible lines means a reasons report without destructive confirmation. Results survive rerenders; failed storage leaves saved work unchanged. Library rate definitions are never deleted by these actions.
