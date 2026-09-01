# Design Summary

## Architecture

The project is intentionally domain-first.

```text
React UI
   |
   v
FastAPI
   |
   v
DepartmentService
   |
   +--> validation.py
   +--> tree.py
   +--> rollups.py
   +--> transfer.py
   |
   v
ordered in-memory employee records
```

The frontend renders normalized backend responses. It does not independently validate hierarchy, calculate payroll, detect cycles, or decide whether a transfer is legal.

## 1. Flat employee records are the source of truth

A transfer changes one field: `manager_id`.

Keeping an ordered flat list as canonical state makes that change simple and avoids maintaining both a mutable list and a mutable nested tree.

The tree and rollups are derived whenever needed.

**Trade-off:** The tree is rebuilt instead of patched incrementally. With a maximum of 30 employees, the extra O(n) work is small and the code is easier to reason about.

## 2. Source order is preserved

Employee source order affects table order, sibling order, and `changed_rollup_ids`.

The domain layer does not sort records by name, ID, salary, or hierarchy depth. Child lists are built by scanning the canonical records in their existing order.

This gives deterministic behaviour without storing another ordering structure.

## 3. Backend owns business rules

Validation, hierarchy construction, rollups, subtree checks, and transfer validity live in pure Python domain modules.

FastAPI is a transport boundary. React is a presentation and interaction boundary.

This avoids implementing the same rule twice and makes most correctness tests independent of HTTP and the browser.

## 4. Candidate before commit

I did not use mutation followed by rollback.

For a transfer, the service:

```text
validate request
    -> create candidate copy
    -> change one manager_id
    -> rebuild tree
    -> recompute rollups
    -> check invariants
    -> commit candidate
```

If any step fails, the candidate is discarded. The current department and previous successful impact remain unchanged.

## 5. Full recomputation instead of incremental updates

After a valid transfer, all rollups are recomputed.

An incremental approach could update only old/new ancestor chains, but that introduces more bookkeeping and more opportunities for a stale aggregate.

At `n <= 30`, full recomputation is cheap and easier to verify.

## 6. Changed rollups are based on values, not ancestor paths

A manager is marked as changed only if their before/after headcount or payroll actually differs.

This matters in a cross-branch transfer. `HOD` is an ancestor of both branches, but its total headcount and payroll do not change. A simple ancestor-path approach would over-report it.

For `LEAD_A -> MGR_C`, the exact changed rollups are:

- `MGR_A`
- `MGR_C`

The moved employee/subtree is represented separately.

## 7. In-memory state is deliberate

This is a local, single-session interview application.

A database, authentication, user isolation, audit history, and production concurrency were intentionally left out because they do not improve the core hierarchy problem within the scope.

For a production version, I would introduce persisted department state, explicit user/session ownership, versioned updates or optimistic concurrency, and an audit trail.
