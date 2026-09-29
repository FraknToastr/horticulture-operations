# Planner / Calculator / Locator / Quote / Register UI Checkpoint

Status: IMPLEMENTED — AWAITING PEER REVIEW

Implemented the requested cross-module UI corrections:

- planner section controls now use a right-positioned, keyboard-accessible collapse affordance while retaining merged prominent section/column rows;
- Calculator and Quote Builder share the permanent 4px green divider token/rule; the Calculator polygon-linked source uses the shared map icon;
- Locator Display now offers the `Metromaps` basemap provider backed by the supplied WMTS endpoint;
- Register rows now include a Project column after Receipt, showing Created or Not Created, with drawer colspans updated;
- Register Show Project Plan navigation persists planner selection and opens the linked project for NSA and EVT.

Verification:

- focused planner/Register/Locator tests: 3/3 passed;
- focused Calculator test: passed;
- deterministic suite: 12/12 files passed;
- complete browser suite: 60/60 passed;
- changed JavaScript syntax checks passed.

No ZIP package was produced.
