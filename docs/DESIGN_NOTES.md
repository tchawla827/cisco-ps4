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
