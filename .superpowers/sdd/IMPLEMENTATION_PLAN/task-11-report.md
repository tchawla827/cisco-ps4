# Task 11 Report — Compare drawer

## Status

Complete.

## Implementation

- Added `CompareDrawer`, a right-side modal slide-over with backdrop, close
  control, Escape handling, initial close-button focus, and focus return to the
  compare control.
- The original and current views are the backend `DepartmentView` responses
  stored at successful load/reset. The drawer does not compute or mutate
  hierarchy, rollups, history, selection, or transfer state.
- `OrgTree` now supports a read-only mode used by the drawer. Its nodes are not
  focusable or activatable in that mode, and its accessible labels state each
  employee's direct manager.
- Desktop charts are side by side. At the narrow mobile breakpoint they stack
  vertically inside the full-width drawer to keep both rendered trees legible
  and unclipped.

## Verification

```text
$ cd frontend && npm test
Test Files  2 passed (2)
Tests  4 passed (4)

$ cd frontend && npm run build
tsc -b && vite build completed successfully

$ cd frontend && npm run lint
oxlint completed with no findings

$ node .superpowers/sdd/task-11-browser.mjs
status: passed
```

The live browser walkthrough loaded `main-12`, applied `LEAD_A -> MGR_C`, and
then opened the drawer. It asserted that the Original chart labels `LEAD_A` as
reporting to `MGR_A`, while Current labels it as reporting to `MGR_C`; the
legend contains Root, Moved subtree, and Changed rollup; drawer charts expose
zero interactive tree items; focus begins on Close and returns to the Compare
control after close; reopening and Escape leave `LEAD_A` under `MGR_C`.

Desktop geometry was contained at 1440x900. At 390x844 the drawer filled the
viewport horizontally and the Original and Current charts stacked without
overlap or horizontal clipping. Screenshots were inspected manually:

- `.superpowers/sdd/task-11-evidence/desktop-transfer-comparison.png`
- `.superpowers/sdd/task-11-evidence/mobile-transfer-comparison.png`

## Documentation

Appended `docs/AI_PROMPTS.md` and `docs/DESIGN_NOTES.md` with the D5
backend-snapshot rationale.

## Concerns

Task 12 is the approved point for frontend interaction tests, so this task adds
no permanent component test. It has repeatable live-browser evidence instead.

## Fix Round 1/5 — Read-only chart text alternative

Review found that `role="img"` makes each read-only SVG atomic to assistive
technology, hiding its descendant node labels. The visual charts therefore did
not provide the original/current manager difference to screen-reader users.

`CompareDrawer` now renders a visually-hidden semantic heading and source-order
list in each comparison section. Each list is generated directly from that
section's `DepartmentView.employees` and `manager_id` fields: root employees
state that they have no manager, and every other employee states its direct
manager. The summaries are explicitly titled `Original reporting relationships`
and `Current reporting relationships`; no hierarchy, rollup, or history is
calculated on the client.

TDD evidence:

```text
$ cd frontend && npm test -- src/components/CompareDrawer.test.tsx
RED: failed because Original reporting relationships was absent.

GREEN: 1 test passed after adding the semantic relationship lists.

$ cd frontend && npm test
Test Files  3 passed (3)
Tests  5 passed (5)

$ cd frontend && npm run build
tsc -b && vite build completed successfully

$ cd frontend && npm run lint
oxlint completed with no findings
```

The focused component test asserts the list order is the supplied employee
source order and proves the visible-to-screen-readers distinction:
`LEAD_A reports to MGR_A.` in Original versus `LEAD_A reports to MGR_C.` in
Current.
