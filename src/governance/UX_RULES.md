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
20. **Standard drawer height.** For ordinary module drawers, the available drawer height is the viewport space from immediately below the expanded row header to the bottom of the viewport, accounting for any persistent application chrome/insets. The drawer must not extend beyond that usable viewport.
21. **Internal overflow.** If standard drawer content requires more vertical space than is available above the visible drawer floor, scrolling occurs inside the drawer content region. The page must not be relied upon to reveal a floor that has been pushed off-screen.
22. **No clipped terminal content.** Drawer sizing must reserve the floor thickness and required bottom padding before calculating the internally scrollable content height. The final control, text block or status element must remain reachable without being hidden beneath the floor.
23. **Register drawer grows before it scrolls.** A Register drawer initially expands only as far as required to contain its content. Long content, including long Notes, may increase the drawer height. Growth continues until the drawer reaches the usable bottom of the viewport. Only then does the Register drawer stop growing and enable internal scrolling.
24. **Register floor remains invariant.** The Register drawer's growth rule never permits its thick bottom floor to pass below the viewport. The floor remains visible at the maximum permitted height while the drawer content region scrolls internally.
25. **Content changes reflow the drawer.** Adding, removing, expanding or collapsing content inside a drawer must recompute its usable content height. Register drawers may grow/shrink within their limit; other drawers remain constrained to their defined viewport allocation.
