# Interview Notes

## 30-Second Project Explanation

This is a local tool for a department administrator who has flat employee records but needs to understand the reporting tree and complete-team payroll. The backend validates those records, derives the tree and rollups, and safely previews or applies a reporting-line change. Invalid moves, such as creating a cycle or moving the department head, are rejected without changing the current state.

## 2-Minute Project Walkthrough

The problem is that a flat list does not answer team-level questions or make reorganisation risk obvious. FastAPI validates a chosen scenario and a pure domain layer builds the tree and calculates payroll bottom-up. React renders the normalized snapshot.

For the main interaction, a transfer changes a person's manager while retaining their subtree. The service validates the request, builds a candidate record list, recomputes rollups, and only then commits it. I identify changed rollups by comparing full before/after values, not by guessing ancestor paths; the department head is on both paths in a cross-branch move but its total does not change.

In the demo, `LEAD_A` moves from `MGR_A` to `MGR_C`. The UI shows the three-person, INR 145,000 subtree and only the two manager rollups that change. Tests cover the rule ordering and state retention behind that flow.

## Architecture Walkthrough

1. React stores interaction state and renders API snapshots.
2. FastAPI routes map service state to JSON views.
3. `DepartmentService` owns the in-memory session and coordinates operations.
4. Domain modules handle validation, tree building, rollups, transfer, and roster rules.
5. Candidate-then-commit means failed work never assigns authoritative state.

## 5 Decisions I Should Be Able to Defend

### Flat list as source of truth

**Likely question:** Why not store a mutable nested tree?

**Answer:** A transfer changes one `manager_id`. Deriving the tree avoids synchronising two mutable structures and preserves the required source order.

**Possible follow-up:** Is rebuilding wasteful?

**Good response:** The input is capped at 30 employees, so it is cheap and easier to audit than incremental updates.

### Backend owns business rules

**Likely question:** Why not calculate rollups in React?

**Answer:** One backend implementation keeps preview, display, and commit consistent.

**Possible follow-up:** Does that hurt responsiveness?

**Good response:** A local preview request is a reasonable trade for avoiding a UI result that cannot be committed.

### Candidate before commit

**Likely question:** How is transfer atomicity implemented?

**Answer:** Current records are not assigned until validation, candidate rebuild, rollup calculation, and invariant checks succeed.

**Possible follow-up:** What if recomputation fails?

**Good response:** The candidate has not been assigned, so the current department and previous impact remain intact.

### Exact rollup diff

**Likely question:** Why compare all rollups instead of walking ancestors?

**Answer:** Ancestor paths would over-report the shared root in a cross-branch move. Comparing values gives the exact visible impact.

**Possible follow-up:** What is the cost?

**Good response:** O(n) after an O(n) recomputation, negligible at this size.

### In-memory state

**Likely question:** Why no database?

**Answer:** Persistence is outside this local interview problem. In-memory state makes reset deterministic and keeps focus on hierarchy rules.

**Possible follow-up:** What would change for production?

**Good response:** Persisted departments, user/session ownership, optimistic concurrency, audit history, and migration-backed tests.

## Most Important Code to Understand

| File | Responsibility | What to know | Likely interviewer question |
| --- | --- | --- | --- |
| `backend/app/domain/validation.py` | Six-pass validation | Ordering and source precedence are contractual | Why is manager validation one loop? |
| `backend/app/domain/tree.py` | Derived hierarchy | Child lists follow source order | Why rebuild it? |
| `backend/app/domain/rollups.py` | Postorder totals | Root invariant checks count/payroll | How are totals calculated? |
| `backend/app/domain/transfer.py` | Move rules and exact diff | Fixed check order and value-based diff | How do you prevent cycles? |
| `backend/app/services/department_service.py` | State and candidate commit | Invalid loads clear state; rejected transfers retain it | Where is atomicity enforced? |
| `backend/app/api/department.py` | HTTP boundary | Routes map state to views | Why use response models? |
| `frontend/src/App.tsx` | UI workflow | Preview vs commit and clearing behavior | What does React own? |
| `frontend/src/components/OrgTreeCanvas.tsx` | Tree interaction | Drag only proposes; backend validates | How is drag validated? |

## Likely Technical Questions

1. **What happens if a load fails after another scenario was loaded?** Service and UI clear department-derived state.
2. **Why a dataclass instead of Pydantic for `Employee`?** Invalid fixtures must reach explicit domain validation unchanged; Pydantic stays at the transport edge.
3. **What preserves sibling order after transfer?** Candidate records keep source order and `build_tree` appends in that order.
4. **Why can a moved employee be absent from `changed_rollup_ids`?** Its subtree total can stay the same; it is reported separately as the moved subtree.
5. **What happens during preview?** The same candidate impact is computed but state is not assigned.
6. **Can the frontend commit an invalid drag?** It only proposes; backend independently validates preview and commit.
7. **How are duplicate IDs handled?** Validation pass two catches them before tree construction.
8. **Why does deleting a manager fail?** Direct reports would be orphaned; transfer them first.
9. **What happens after adding an employee?** The full validator checks the candidate; success clears stale transfer impact and recalculates.
10. **What happens at 100× the data?** Measure first; then consider iterative traversal, persistence, pagination, and aggregate updates.
11. **What happens with concurrent users?** This local version shares process state; production needs persisted state and concurrency control.
12. **Why limit CORS?** The API is intended for the local Vite UI, not a public browser surface.
