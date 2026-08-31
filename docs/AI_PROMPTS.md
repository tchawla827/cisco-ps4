# AI Prompt History

Log key prompts, refinements, and notable accepted/rejected AI suggestions as
implementation proceeds (`PRD.md` §20, `ARCHITECTURE.md` §29). Append entries
chronologically; don't rewrite earlier ones.

## Format

```
### <date> — <stage/topic>
**Prompt:** <what was asked>
**Outcome:** accepted / rejected / modified — why
```

## Entries

### 2026-08-31 — Project initialisation
**Prompt:** Convert the raw problem statement
(`Student_SPR26_D2_P04-departmental-reorg-payroll-rollup-tracker.md`) into
`PRD.md` and `ARCHITECTURE.md`, then initialise the repo's documentation
scaffold for systematic building.
**Outcome:** accepted. `PRD.md` and `ARCHITECTURE.md` were reviewed against
the source problem statement and found consistent — no edits needed. Added
`docs/PLAN.md` (5-stage plan with checkpoints), `docs/EXPECTED_RESULTS.md`
(independent 12-employee oracle, hand-derived before any code exists),
`docs/DESIGN_NOTES.md`, `docs/TEST_EVIDENCE.md`, `README.md`, and `CLAUDE.md`.

### 2026-08-31 — Step 2 load validation
**Prompt:** Implement the pure six-pass department-load validation pipeline
test-first, preserving pass and source order, frozen `Employee`, and avoiding
`sorted()` in domain and service code.
**Outcome:** accepted. Added the validator plus only the minimal validated-input
tree builder required by defensive pass 6; full tree behavior remains Step 3.

### 2026-08-31 — Step 3 tree construction and rollups
**Prompt:** Complete source-order tree construction and exact integer postorder
rollups test-first, with root invariant failures raising exceptions and the
independent oracle kept outside production code.
**Outcome:** accepted. Used recursive preorder for subtree collection and
postorder for rollups; source-order appends preserve sibling ordering without
sorting, and the root guard raises `RootInvariantError` on corrupted totals.

### 2026-08-31 — Step 4 transfer domain logic
**Prompt:** Implement pure transfer validation, immutable candidate copying, and
rollup-impact detection with exact source-order semantics.
**Outcome:** accepted. Rollup highlights compare before/after values directly,
not inferred ancestor paths; validation, candidate copy, and full recomputation
remain separate so rejected requests cannot mutate authoritative inputs.

### 2026-08-31 — D2 scenario service and independent oracle
**Prompt:** Add scenario-key loading, a test-only oracle, and an in-memory
service that computes transfer candidates before committing state.
**Outcome:** accepted. Production scenarios hold operational employee inputs
only; expected values live in `backend/tests/oracle.py`, while the service
retains state only after validation, rebuild, recomputation, and invariant
checks succeed.

### 2026-08-31 — D3/D6 FastAPI transport boundary
**Prompt:** Expose scenario selection, department views, transfer preview, and
reset through a thin local FastAPI API while keeping API-only unloaded-state
handling outside the domain.
**Outcome:** accepted. Added `GET /api/scenarios` and preview before approval
(D3), with `NO_DEPARTMENT_LOADED` returned only by the API as a direct 409
JSON envelope (D6). Pydantic models normalize derived tree and rollup state
into stable response views; business validation and transfer precedence remain
in pure domain and service code.

### 2026-08-31 — Step 7 frontend scaffold and API client
**Prompt:** Recover the interrupted React, TypeScript, and Vite frontend
scaffold; add API view types and a typed client for all department routes, then
verify the development proxy renders the main department rollup.
**Outcome:** accepted. Replaced generated Vite demo content with a raw JSON
stub that loads `main-12`; added JSdom Vitest setup, Testing Library support,
and a shared non-2xx parser that always throws `ApiError` with backend code and
message rather than a partial department.

### 2026-08-31 — D7 payroll operations cockpit
**Prompt:** Build the first frontend workspace increment as a dense university
payroll-operations cockpit: fixed utility header, source-ordered employee table,
reserved chart and review zones, accessible semantic status markers, and distinct
invalid-load versus rejected-transfer state handling.
**Outcome:** accepted. Used the specified neutral dark token set and semantic
multi-colour states; table and chart/detail placeholders deliberately avoid client-side
hierarchy or payroll calculation. Transfer handlers live at the App boundary now so
Task 10 controls retain the required rejection semantics.

### 2026-08-31 — D4 SVG organisation tree
**Prompt:** Add a pure, test-first SVG organisation chart with deterministic
source-order layout, keyboard selection, and transfer-impact markers.
**Outcome:** accepted. The chart consumes the existing normalized department
view only: a post-order presentation layout assigns leaf slots and parent
midpoints, while impact styling uses the API-provided preview or last committed
impact without calculating hierarchy, payroll, or transfer state in the client.

### 2026-08-31 — Task 10 transfer review panels
**Prompt:** Add read-only employee details, staged transfer controls, and an
impact panel that preserves committed state through rejected transfer attempts.
**Outcome:** accepted. Controls call the existing API boundary directly; the
impact panel presents backend-provided source-order changes and distinguishes a
preview with dashed treatment rather than calculating payroll client-side.

### 2026-08-31 — Task 11 comparison drawer
**Prompt:** Add an accessible original/current comparison drawer using the
load/reset response snapshot and read-only organisation charts, without adding
client-side hierarchy calculations or history.
**Outcome:** accepted. The drawer renders backend-computed snapshots directly;
its read-only charts cannot change the operational selection or transfer state.

### 2026-08-31 — Task 12 frontend test strategy
**Prompt:** Add focused frontend regression coverage for layout invariants,
employee selection, transfer rejection retention, invalid-load clearing, reset
semantics, and every API-client route contract.
**Outcome:** accepted. Tests use complete `DepartmentView` and impact fixtures,
mock only the API boundary, and assert accessible rendered state rather than
component doubles or full-page snapshots. The layout fixture deliberately
scrambles employee-record order while retaining `children_ids`, so rendering
order remains a presentation contract of the normalized hierarchy.

### 2026-08-31 — Task 13 documentation and final verification
**Prompt:** Run the real backend and frontend test/build/lint commands, drive
a live end-to-end walkthrough of the demo (load, valid cross-branch transfer,
cycle rejection, root-move rejection, reset, deterministic reapplication)
against `docs/EXPECTED_RESULTS.md`'s exact oracle values, capture screenshots,
then fill in `docs/TEST_EVIDENCE.md`, append D1–D8 to `docs/PLAN.md`, extend
`docs/DESIGN_NOTES.md`, and replace `README.md`'s and `CLAUDE.md`'s
not-yet-scaffolded language with verified commands.
**Outcome:** accepted. 86 backend tests and 16 frontend tests passed, build
and lint were clean, and every walkthrough step matched the oracle exactly
(`HOD` 12/₹8,21,000; `MGR_A` 5→2/₹2,82,000→₹1,37,000; `MGR_C`
2→5/₹1,17,000→₹2,62,000; `MANAGEMENT_CYCLE` and `ROOT_MOVE_FORBIDDEN`
rejections left the chart/impact panel untouched; `solo-1` loaded at
headcount 1; `invalid-duplicate-id` cleared the workspace to
`NO_DEPARTMENT_LOADED`; reset then reapply reproduced byte-identical
rollups). Screenshots saved under `.superpowers/sdd/task-13-evidence/`. No
production-code defects were found, so no `backend/app/**` or `frontend/src`
changes were made in this step.

### 2026-08-31 — Frontend revamp: tree-as-hero layout, drag-and-drop, add/delete
**Prompt:** Revamp the frontend into a tree-as-hero layout with a collapsible
sidebar and review panel, a zoomable/pannable organisation chart supporting
`@dnd-kit` drag-and-drop transfers, and backend add/delete-employee support,
per `docs/superpowers/specs/2026-08-31-frontend-revamp-design.md` and
`docs/superpowers/plans/2026-08-31-frontend-revamp.md`. Then (this task)
verify the full backend/frontend suites, build, and lint; drive a live
walkthrough of load, collapse/expand, zoom/pan/collapse, drag-to-transfer,
cycle rejection, add employee, blocked delete, leaf delete, and reset; and
record the results here and in `docs/DESIGN_NOTES.md`.
**Outcome:** modified. 108 backend tests and 38 frontend tests passed, build
and lint were clean. The live walkthrough was completed end-to-end but the
drag-and-drop and visual zoom/pan/collapse steps were exercised through the
existing text-based Transfer and Roster controls instead of literal pointer
drags, because the walkthrough surfaced a real bug: the organisation chart's
wrapping `<section className="workspace-zone workspace-zone--chart">` in
`App.tsx` has no matching CSS rule, so `OrgTreeCanvas`'s `flex:1` height
chain collapses to `0px` and the entire chart renders invisibly (fully
present in the DOM/accessibility tree, confirmed interactive via a
dispatched JS click, but not visible or pointer-clickable) from the very
first load. All non-visual transfer/add/delete/reset outcomes matched
`docs/EXPECTED_RESULTS.md` exactly. Per this task's verification-only scope,
the CSS bug was documented as a concern rather than fixed; no
`backend/app/**` or `frontend/src` changes were made in this step, only
`docs/DESIGN_NOTES.md` and this file.
