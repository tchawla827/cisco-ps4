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
the scenario list and non-mutating transfer preview, while D6 defines the API
only `NO_DEPARTMENT_LOADED` 409 envelope. It projects normalized Pydantic views
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
