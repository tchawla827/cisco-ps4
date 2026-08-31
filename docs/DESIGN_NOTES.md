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
