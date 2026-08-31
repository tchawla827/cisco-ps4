# Frontend Revamp — Tree-as-Hero Layout, Drag & Drop, Add/Delete Employee

Status: Approved 2026-08-31. Implementation in progress same day (demo deadline today).

## 1. Problem

The current frontend (`frontend/src/App.tsx` + `OrgTree.tsx`) is a rigid,
non-collapsible 3-column layout. The org chart is a squeezed SVG with
`textLength`-clamped text, no zoom/pan, and no way to reshape the tree except
through the text-only `TransferControls` form. There is no way to add or
remove an employee at all — the backend has no endpoint for it. This spec
revamps the UI/UX for a live demo happening today: clean minimalist layout,
collapsible panels, a readable zoomable/pannable tree, drag-and-drop
transfers, and graphical + text-based add/delete employee.

## 2. Non-goals

- No change to existing domain algorithms, validation pass order, or error
  codes for **load** and **transfer** (`ARCHITECTURE.md` §8/§10 stay exactly
  as specified — this is a hard contract per `CLAUDE.md`).
- No cascade-delete or reparent-on-delete logic — delete is blocked outright
  if the employee has any direct reports (user decision).
- No new visual theme/color system — reuse `theme.css`'s existing dark
  palette, just apply it more consistently.
- No persistence layer changes — still in-memory `DepartmentService` singleton.

## 3. Layout & IA

Three collapsible regions instead of a fixed 3-column grid:

- **Left sidebar** (collapsible to icon rail): scenario picker, compact
  employee list (click → focus/select), **Add Employee** form (text
  fields), **Delete Employee** by ID (text field + button).
- **Center stage**: the org tree — zoomable, pannable, drag-and-drop
  enabled, the dominant surface.
- **Right panel** (collapsible, opens on node selection): Employee details,
  Transfer controls (kept — covers the existing cycle/root-move demo
  presets already wired in `App.tsx`), Impact/rollup diff panel.

`AppHeader` (scenario load/reset/compare) stays, restyled as a slim toolbar.

## 4. Tree canvas

- Nodes render as absolutely-positioned HTML cards (not SVG `<g>`/`<rect>`)
  inside a zoom/pan viewport (`transform: translate() scale()`), positioned
  using the existing `layoutTree()` x/y output from `orgTreeLayout.ts`
  (unchanged). Edges render as an SVG line layer behind the cards.
- **Zoom**: scroll/pinch + `+`/`−`/"fit to screen" buttons, clamped
  (e.g. 0.4x–2x).
- **Pan**: click-drag on empty canvas background.
- **Collapse/expand**: a chevron on any node with children hides its
  subtree. The employee list passed into `layoutTree()` is filtered to
  exclude collapsed descendants so the visible tree recompacts (no blank
  gaps). "Expand all / Collapse all" toolbar buttons for demo speed.
- **Drag & drop** via `@dnd-kit/core`: dragging a card onto another card
  proposes "report to this manager." On drop: call `previewTransfer`
  (existing endpoint) and show an inline confirm popover at the drop
  point with the real impact (`moved_headcount`, `moved_payroll`,
  `changed_rollup_ids`) from the domain engine. Confirm → `transfer()`.
  A domain rejection (cycle, self, already-reports, root-move) surfaces
  the exact backend error code/message inline. Drag-and-drop is purely a
  new *gesture* for the existing transfer operation — zero domain change.

## 5. Add / Delete employee

### Backend additions (new, additive — existing load/transfer untouched)

New pure module `backend/app/domain/roster.py`, mirroring the
`validate_transfer`/`apply_transfer` split already used in `transfer.py`:

- `apply_add(employees, new_employee) -> list[Employee]` — pure append.
- `apply_delete(employees, employee_id) -> list[Employee]` — pure filter.
- `validate_delete(tree, employee_id) -> DomainError | None` — three new
  checks, in this order: employee exists → not the root → has zero direct
  reports.

Add employee validation deliberately does **not** get new checks — the
candidate list (current + new employee) is run through the existing,
unmodified `validate_department()` from `validation.py`. Its six passes
already cover: bad fields (Pass 1), duplicate ID (Pass 2), a second root
i.e. non-null-manager omitted (Pass 3), unknown manager (Pass 4), cycle
(Pass 5 — impossible for a manager_id pointing at an existing node with no
children yet, but the check runs anyway for defense-in-depth),
connectivity (Pass 6). This reuses 100% of already-tested logic.

New stable error codes (additive, do not touch the existing list in
`CLAUDE.md`): `EMPLOYEE_NOT_FOUND`, `ROOT_DELETE_FORBIDDEN`,
`EMPLOYEE_HAS_DIRECT_REPORTS`.

`DepartmentService` gets two new methods, `add_employee` and
`delete_employee`, following the exact same
validate-fully-before-mutating shape as `_compute_transfer`.

New routes in `app/api/department.py`:
- `POST /api/department/employees` — body `{employee_id, name, role,
  monthly_salary, manager_id}` (manager_id required/non-null — adding a
  second root is already rejected by Pass 3, so this is enforced by
  existing validation, not new code). Returns updated `DepartmentView`.
- `DELETE /api/department/employees/{employee_id}` — returns updated
  `DepartmentView`.

### Frontend

- Graphical: a "+" affordance appears on hover over any tree card,
  pre-filling that node as the manager in an Add Employee form; a delete
  icon appears on the selected card / in the details panel (confirm
  before calling the endpoint).
- Text-based: sidebar has the same Add Employee fields (ID, Name, Role,
  Salary, Manager) always available, plus a "Delete by ID" quick field —
  both call the same two endpoints above. This is the fast, keyboard-only
  path for the live demo.
- Errors surface via the existing `MessageBanner`/`ApiError` pattern
  already used for transfer errors — no new error-handling pattern needed.

## 6. Visual pass

Keep `theme.css`'s existing dark palette (slate canvas, blue accent,
semantic root/moved/changed colors) — apply it consistently to the new
card-based tree, collapsible panels, and forms. No new color system.

## 7. New dependency

`@dnd-kit/core` + `@dnd-kit/utilities` — the only new runtime dependency
added to `frontend/package.json`.

## 8. Testing / verification

- New `backend/tests/test_roster.py` covering `validate_delete` and the
  add/delete service methods and routes, mirroring `test_transfer.py`'s
  style and the six-pass precedence tests' spirit (existence → root →
  has-reports ordering, and add's reuse of `validate_department`).
- Frontend: extend existing vitest coverage only where it gates critical
  behavior (drag-drop confirm flow, add/delete form validation errors,
  collapse/expand doesn't lose selection) — matching this repo's existing
  "minimal frontend tests only where they add value" policy, not chasing
  full coverage given the same-day deadline.
- Manual live verification before handoff: load → drag-drop transfer
  (valid) → drag-drop transfer (cycle rejection, inline error) → add
  employee (graphical + text) → delete blocked on employee with reports
  → delete a leaf employee → reset → confirm deterministic reapply,
  mirroring how `docs/EXPECTED_RESULTS.md` was originally verified.

## 9. Explicit user decisions locked in

1. Delete is blocked (not cascaded) when the target has direct reports.
2. Drag-and-drop implemented with `@dnd-kit/core` (chosen over hand-rolled
   HTML5 DnD for reliability given the same-day deadline).
3. Layout is the "tree-as-hero" shape (not "keep 3 columns, add collapse").
