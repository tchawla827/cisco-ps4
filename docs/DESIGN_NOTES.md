# Design Notes

Architecture decisions, trade-offs, and deviations discovered during
implementation. The canonical decision record is `ARCHITECTURE.md` (AD-01
through AD-08) — this file captures anything discovered *while building* that
refines, tests, or deviates from those decisions. Append chronologically.

## Baseline decisions (see `ARCHITECTURE.md` for full rationale)

- Flat `list[Employee]` is the only canonical state; the tree, rollups, and
  API view models are always derived, never separately stored/mutated (AD-02).
- Every transfer follows validate → candidate copy → rebuild/recalc/assert →
  commit; a rejected transfer touches zero authoritative state (AD-06).
- Rollups are fully recomputed after every transfer rather than incrementally
  patched — the 30-employee ceiling makes O(n) recomputation both simpler and
  cheap enough to not need optimisation (AD-07).
- The independent oracle (`docs/EXPECTED_RESULTS.md`) is never imported by
  production code — only by tests and this documentation (AD-08).

## Entries

(none yet — add dated entries here as implementation surfaces trade-offs,
ambiguities resolved one way vs. another, or deviations from `PLAN.md`)

### 2026-08-31 — D1 frozen dataclass validation fixtures
`Employee` remains a frozen dataclass. Its annotations intentionally do not
perform runtime coercion or rejection, which keeps the domain pure and permits
invalid field fixtures to reach validation pass 1 unchanged.

### 2026-08-31 — Validation ordering contract
Load validation is a six-pass first-error contract: fields, duplicates, root
count, manager references, cycles, then defensive connectivity. Records are
examined in source order within every pass; manager-reference checks share one
loop so an earlier unknown manager precedes a later self-manager.

### 2026-08-31 — D8 DepartmentTree source-order employees
`DepartmentTree` carries the canonical source-order employee tuple alongside
its indexes and child lists. This keeps order available to every derived domain
calculation without passing a parallel employee collection through each API.

### 2026-08-31 — Full recompute with postorder rollups
Rollups are rebuilt with a postorder traversal after each candidate hierarchy
change. At the 30-employee limit, a full exact-integer recomputation is cheap,
easier to audit, and avoids fragile incremental ancestor updates.

### 2026-08-31 — Transfer impact exactness and atomicity
Changed rollup IDs are derived by exact before/after headcount or payroll value
comparison in employee source order, rather than by guessing ancestor paths;
this correctly excludes an unchanged shared root. Transfer processing is
validate → immutable candidate copy → rebuild/recompute, so a validation error
leaves both the canonical employee list and its existing derived rollups intact.

### 2026-08-31 — D2 scenario-key service boundary and oracle separation
`SCENARIOS` provides fresh ordered employee lists keyed by a scenario identifier
and contains no expected-result values or test imports. The hand-transcribed
oracle is test-only in `backend/tests/oracle.py`. `DepartmentService` derives a
candidate transfer entirely before assigning current employees or the last
successful impact; invalid loads deliberately clear all service state, while
rejected transfers preserve it exactly.

### 2026-08-31 — D3/D6 thin API and normalized views
The FastAPI layer owns scenario discovery and non-domain request state: D3 adds
the scenario list (`GET /api/scenarios`), the `LoadRequest.scenario` body on
`POST /api/department/load`, and the non-mutating transfer preview, while D6
defines the API-only `NO_DEPARTMENT_LOADED` 409 envelope. See `docs/PLAN.md`
D3 for the full rationale (demonstrability of invalid-load and solo-1
acceptance criteria from the UI). It projects normalized Pydantic views
from the service's canonical ordered employees plus derived tree and rollups;
it neither validates hierarchy rules nor stores a second mutable department
representation. This preserves source order, keeps domain code free of FastAPI
and Pydantic, and lets root-invariant failures remain 500 implementation defects.

### 2026-08-31 — D7 operational UI state and semantic language
The frontend uses the API response as its sole department snapshot. `originalDepartment`
is cached only on a successful load/reset for the later comparison view; no client-side
tree, rollup, or impact calculation is introduced. An invalid load clears all visible
department-derived state, while a rejected transfer only clears a speculative preview so
the current department and backend-provided `last_successful_transfer` remain visible.

The workspace is intentionally a dense three-zone operations surface, using the fixed
dark console tokens and a quiet system sans alongside monospace identifiers and tabular
numeric values. Root, selected, moved, and changed states each carry a symbol and label
as well as a distinct semantic colour; later table, chart, details, and impact components
share that same language rather than inventing component-local highlights.

### 2026-08-31 — D4 presentation-only SVG tree layout
`layoutTree` is a pure display helper with fixed card and gap dimensions. It
walks `children_ids` in supplied order, assigns sequential leaf slots in a
post-order pass, and places internal nodes at their first/last-child midpoint.
The resulting coordinates and elbow paths are used only by `OrgTree`; they are
never written into the department snapshot or fed back into transfer, rollup,
or ordering decisions. Preview impact uses a dashed outline so it remains
visually distinct from backend-confirmed transfer state.

### 2026-08-31 — Task 10 API-backed impact presentation
`ImpactPanel` derives card order from `changed_rollup_ids` and finds matching
server-provided change views by ID; the browser never infers ancestor paths or
rollup deltas. Preview state is local and dashed in both chart and panel, while
the fallback to `last_successful_transfer` keeps confirmed impact visible after
cycle or root-protection rejections. On narrow screens the employee table moves
to page flow and retains only horizontal scrolling, preventing an inspected row
from leaving the mobile source-records pane vertically scrolled.

### 2026-08-31 — D5 backend snapshot comparison
The comparison drawer receives `originalDepartment` only from successful load
or reset responses and renders it as returned by the backend. `OrgTree` now has
a read-only rendering mode for the drawer: it preserves source-ordered layout
and backend-provided impact markers while removing tree-item activation, so the
comparison cannot mutate App selection or introduce an alternate hierarchy,
rollup, or history model.

### 2026-08-31 — Task 13 documentation and verification wrap-up
Consolidated D1–D8 (see `docs/PLAN.md` "Deviations") from the choices already
recorded above plus the execution ledger, and re-verified all of them live
against the committed tree: 86 backend tests, 16 frontend tests, a clean
frontend build and lint, and a Playwright-driven walkthrough of the full demo
(load → valid cross-branch transfer → cycle rejection → root-move rejection →
reset → deterministic reapplication) against `docs/EXPECTED_RESULTS.md`'s
exact numbers. Every deviation is either an intentional boundary tightening
(oracle isolation in D2, unloaded-state handling staying API-only in D6) or an
additive, backward-compatible surface the mandated 4-route/6-pass/5-check
contracts still fully satisfy (the preview route in D3, the presentation-only
tree layout in D4) — none of them change validation order, transfer-check
order, or the stable error codes.

Two design choices called out in Task 13's brief are worth restating plainly,
since they are the two most tempting "optimizations" a future contributor
might reach for:

- **Full recompute over incremental ancestor patching (AD-07).** After a
  transfer, `calculate_rollups` walks the *entire* rebuilt tree postorder
  rather than patching only the old and new ancestor chains. At n ≤ 30 this
  costs nothing measurable, and it sidesteps an entire class of bugs that
  incremental patching invites: forgetting a shared ancestor above a
  cross-branch move, patching a chain twice when old and new managers share
  ancestors, or drifting from the true value after several transfers. A full
  recompute is trivially correct by construction — it is the same function
  used for the initial load — so the transfer path and the load path can
  never disagree about what a correct rollup looks like.
- **`changed_rollup_ids` as an exact before/after value diff, not an
  ancestor-path walk.** Computing "who changed" by walking from the moved
  employee up to the root would over-report: on an internal cross-branch
  move (e.g. `LEAD_A` from `MGR_A` to `MGR_C`), `HOD` sits on *both* the old
  and new ancestor paths but its headcount and payroll are provably
  unchanged (the same 12 people, same total payroll, just regrouped
  underneath it). The chosen approach — compute rollups before and after,
  then compare every employee's `(team_headcount, team_payroll)` pair in
  source order — reports precisely the set that actually differs, with no
  false positives and no risk of the ancestor-walk and the real diff ever
  disagreeing. This is also why `HOD` is asserted absent from
  `changed_rollup_ids` in `test_transfer.py`, not merely absent from a
  hand-picked list of "expected" IDs.
