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
