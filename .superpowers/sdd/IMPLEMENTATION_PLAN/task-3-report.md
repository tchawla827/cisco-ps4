# Task 3 Report — Tree Construction and Rollups

## Scope

Implemented source-order tree traversal and complete-team rollups in the pure
domain layer. The independent initial-rollup oracle remains test-only; no
backend application module imports documentation or oracle values.

## RED Evidence

Before changing `backend/app/domain/tree.py` or adding
`backend/app/domain/rollups.py`, created:

- `backend/tests/test_tree.py`
- `backend/tests/test_rollups.py`

Ran from `backend/`:

```text
.venv/bin/pytest tests/test_tree.py tests/test_rollups.py -v
```

Expected RED result: collection stopped with two missing-feature import errors:

```text
ImportError: cannot import name 'collect_subtree_ids' from 'app.domain.tree'
ModuleNotFoundError: No module named 'app.domain.rollups'
```

This establishes that the tests exercised the missing Step 3 public behavior,
rather than passing against the partial Step 2 tree builder.

## Implementation

- Added `collect_subtree_ids`, a recursive preorder traversal that includes its
  starting employee and follows stored child-list order.
- Added `calculate_rollups`, a recursive postorder traversal calculating
  headcount and payroll with integers only.
- Added `RootInvariantError` and a root total guard that raises on absent or
  mismatched root rollups.
- Kept `build_tree` source-order-driven: it builds ID indexes first, seeds every
  child list, and appends reports in input order.

## GREEN Evidence

Ran from `backend/`:

```text
.venv/bin/pytest tests/test_tree.py tests/test_rollups.py -v
```

Result:

```text
19 passed in 0.02s
```

The successful suite includes all 12 literal initial-oracle rows (`HOD`, three
managers, two leads, and six leaves), source-order child-map assertions,
manager-after-report construction, preorder subtree collection, solo and leaf
rollups, valid root invariants, and a deliberately corrupted root rollup that
raises `RootInvariantError`.

## Requirement Self-Review

- Domain purity maintained: Step 3 modules import only `collections.abc` and
  `app.domain.models`.
- No `sorted()` is used in `backend/app/domain` or `backend/app/services`.
- Child lists and preorder traversal use source order directly.
- Payroll totals are exact integers; no float conversion, rounding, or display
  formatting occurs in the calculation.
- Root invariant failures raise `RootInvariantError`.
- Oracle values are literals in tests and are not referenced by production
  modules.

## Documentation

Appended the Step 3 implementation prompt and choices to `docs/AI_PROMPTS.md`.
Appended D8 and the full-recompute/postorder rationale to `docs/DESIGN_NOTES.md`.
