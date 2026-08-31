# Product Requirements Document — Departmental Reorg Payroll Rollup Tracker

## 1. Product Summary

Build a local interactive application that converts a flat list of employee records into one validated reporting tree, calculates complete-team headcount and monthly payroll rollups for every employee, allows an administrator to move an employee or team under a different manager, rejects illegal reorganisations atomically, and explains the before/after impact clearly.

The product is an interview-scale decision and explanation tool, not a general HR platform.

## 2. Primary User

**Department administrator / department head** who needs to:
- understand the current reporting hierarchy;
- inspect team size and payroll at any node;
- preview/apply a valid cross-branch reorganisation;
- understand exactly which rollups changed;
- safely reject illegal moves without corrupting the current organisation.

## 3. Product Goals

1. Correctly validate arbitrary flat employee records before showing derived hierarchy or rollups.
2. Build one deterministic rooted organisation tree while preserving source-record order.
3. Calculate exact subtree headcount and payroll for every employee.
4. Support one-employee/team transfers by changing only the selected employee's direct manager.
5. Prevent illegal transfers, especially root moves and cycle-creating moves.
6. Explain successful transfers with moved-subtree data and exact before/after rollup changes.
7. Make reset and repeated demonstrations deterministic.
8. Be simple enough to explain, test, debug, and modify live during the interview.

## 4. Non-Goals / Out of Scope

Do not implement:
- authentication or accounts;
- a database or persistent storage;
- live HR integrations;
- individual salary editing;
- hiring or termination;
- tax or benefit calculations;
- dotted-line reporting;
- approval workflows;
- multi-step reorganisation history;
- a general-purpose organisation editor.

An optional side-by-side original/current comparison may be added only after all required functionality is complete.

## 5. Required Technology Direction

- **Frontend:** React + TypeScript + Vite.
- **Backend:** FastAPI + Python.
- **Persistence:** none; in-memory local state only.
- **Backend testing:** pytest; FastAPI `TestClient` for a small integration layer.
- **Frontend:** presentation and interaction only; all hierarchy, validation, rollup, and transfer business rules live on the backend.

## 6. Main Demonstration Dataset

Create a deterministic fictional department with **exactly 12 employees**.

The main dataset must contain:
- exactly one department head/root;
- at least two distinct branches below the root;
- at least three employees with direct reports;
- at least one non-leaf team lead with descendants who can be moved between branches;
- at least one employee at depth 3 or greater from the department head;
- differing monthly salaries so branch payroll changes are visibly meaningful.

### 6.1 Required Valid Demo Transfer

Choose one deterministic cross-branch transfer where:
- the moved employee is non-leaf;
- their entire descendant subtree remains intact;
- at least two non-root managers change team headcount and payroll;
- the department head's total headcount remains unchanged;
- the department head's total payroll remains unchanged.

### 6.2 Required Invalid Demo Transfer

Choose one deterministic descendant-as-manager transfer that:
- would create a management cycle;
- is invalid before the valid demo transfer;
- remains invalid after the valid demo transfer;
- can therefore be demonstrated in either order.

### 6.3 Independent Oracle

Before relying on the application, independently document:
- initial team headcount/payroll for all 12 employees;
- expected post-transfer headcount/payroll;
- expected `changed_rollup_ids`;
- moved-subtree headcount/payroll;
- expected cycle rejection result.

The production application must **never import or read these expected answers as operational input**. Keep the oracle in documentation and/or test constants only.

## 7. Employee Data Contract

The engine must support **1–30 employee records**.

Each employee contains:

```text
employee_id: string
name: string
role: string
monthly_salary: integer
manager_id: string | null
```

Rules:
- `employee_id` is unique and matches `[A-Z][A-Z0-9_-]{0,15}`;
- `name` is non-empty after trimming;
- `role` is non-empty after trimming;
- `monthly_salary` is an integer from 1 through 1,000,000;
- `manager_id` is `null` or references another declared employee ID;
- exactly one employee has `manager_id = null`;
- every non-root employee references an existing manager;
- self-management is invalid;
- the complete data must form one connected rooted tree;
- employee source order is meaningful and must be preserved.

## 8. Load Validation Requirements

Validate the entire department before calculating or displaying rollups.

Reject:
- invalid employee count;
- malformed employee fields;
- duplicate employee IDs;
- root count other than exactly one;
- unknown manager references;
- self-management;
- any management cycle.

### 8.1 Stable Error Codes

Use these domain codes exactly where applicable:

```text
INVALID_EMPLOYEE
DUPLICATE_EMPLOYEE_ID
INVALID_ROOT_COUNT
UNKNOWN_MANAGER
SELF_MANAGER
MANAGEMENT_CYCLE
```

Each error should include a useful human-readable message identifying the affected record or cycle when possible.

### 8.2 Validation Precedence

When deliberately invalid test data contains multiple errors, report the first category in this exact order:

1. invalid field or count;
2. duplicate ID;
3. invalid root count;
4. self-manager or unknown-manager reference;
5. cycle.

Within one category, choose the first issue in original source-record order.

### 8.3 Failed Load State

A failed load must clear or show none of the following from any previous valid load:
- partial organisation tree;
- rollups;
- transfer result;
- stale impact data;
- derived highlights.

## 9. Tree Construction Requirements

- Resolve employees/managers by ID; never assume a manager appears earlier in the source array.
- Preserve source order in the employee table.
- Preserve source order among each manager's direct reports.
- Do not reorder source employee records during load or transfer.

## 10. Team Rollup Requirements

For employee `e`:

```text
team_headcount(e) = 1 + sum(team_headcount(child))
team_payroll(e)   = monthly_salary(e) + sum(team_payroll(child))
```

Rules:
- totals include the employee themselves plus all direct and indirect reports;
- a leaf has headcount `1`;
- a leaf's payroll equals their own salary;
- calculations use exact whole currency units;
- display formatting may use separators/currency symbols but must never affect calculations;
- displayed values must never be parsed back into business logic.

### 10.1 Root Invariants

For a valid department:
- root team headcount equals total employee count;
- root team payroll equals the sum of all employee salaries.

Failure of either invariant is an implementation defect, not an alternate valid interpretation.

## 11. Employee Inspection Requirements

Selecting an employee is read-only and must show:
- employee ID/name;
- role;
- own monthly salary;
- direct-report count;
- complete team headcount;
- complete team payroll.

Inspection must not alter hierarchy, rollups, or transfer state.

## 12. Transfer Request Contract

A transfer request contains:

```text
employee_id
new_manager_id
```

A successful transfer:
- changes only the selected employee's `manager_id`;
- does not change descendant manager links;
- does not change salary values;
- does not change employee source positions;
- therefore moves the selected employee's entire current subtree intact.

## 13. Transfer Validation Requirements

Validate in this exact order:

1. if either ID is unknown → `UNKNOWN_TRANSFER_EMPLOYEE`;
2. if selected employee is root → `ROOT_MOVE_FORBIDDEN`;
3. if selected employee equals proposed manager → `SELF_MANAGER`;
4. if selected employee already directly reports to proposed manager → `ALREADY_REPORTS_TO_MANAGER`;
5. if proposed manager is anywhere in selected employee's current subtree → `MANAGEMENT_CYCLE`.

The transfer request must be fully validated before committing any mutation.

## 14. Transfer Atomicity

A rejected transfer must preserve the complete last valid state, including:
- every manager link;
- every rollup;
- the current chart;
- the prior successful transfer explanation/result.

A failed transfer may show a new transient error message, but must not erase or replace the last successful impact data.

## 15. Successful Transfer Processing

After a valid transfer:
1. change only the selected employee's direct `manager_id` in a candidate copy;
2. rebuild the hierarchy from the unchanged source order;
3. rebuild affected direct-report lists in original employee source order;
4. recalculate all rollups from the updated tree;
5. compare the immediately previous and new rollups;
6. produce exact `changed_rollup_ids` in original source order;
7. commit the new state only after the candidate hierarchy is valid.

`changed_rollup_ids` contains exactly employees whose team headcount or team payroll differs from immediately before the transfer.

The moved employee/subtree must be represented separately from changed-rollup managers; the moved employee may have unchanged own rollup values.

Do not label an unchanged common ancestor such as the department head as financially affected merely because it remains above both branches.

## 16. Transfer Impact Explanation

A successful transfer must display:
- moved employee;
- old direct manager;
- new direct manager;
- moved subtree IDs or a clear moved-subtree visual;
- moved subtree headcount;
- moved subtree payroll;
- `changed_rollup_ids`;
- for every changed employee: before/after headcount and payroll.

## 17. UI Requirements

Create one coherent reorganisation workspace showing together:
- complete reporting tree;
- compact source-ordered employee table;
- selected-employee details/team-total card;
- transfer controls;
- before/after impact panel;
- load/reset actions;
- validation/transfer feedback.

Required interactions:
- load the demo department in one action;
- inspect any employee;
- apply the documented valid demo transfer;
- attempt the documented invalid cycle transfer;
- attempt a root transfer and receive `ROOT_MOVE_FORBIDDEN`;
- reset the application exactly.

### 17.1 Visual Semantics

Clearly distinguish with text/symbols as well as colour:
- department root;
- selected employee;
- moved subtree;
- employees whose rollups changed.

Suggested semantics are acceptable but not mandatory:

```text
★ ROOT
● SELECTED
↪ MOVED
Δ CHANGED
```

## 18. Reset Requirements

Reset restores:
- exact original 12 employee records;
- all original manager links;
- initial rollups;
- default inspected employee;
- unused/default transfer controls;
- no transfer error;
- no successful-transfer result;
- no moved/changed highlights.

After reset, applying the same documented valid transfer must reproduce identical results.

## 19. Required Test Evidence

At minimum, provide repeatable tests/evidence for:
- leaf rollup;
- multi-level rollups;
- root invariants;
- valid one-employee department;
- duplicate-ID load failure;
- unknown-manager or structural-cycle load failure;
- invalid-load stale-state clearing;
- valid cross-branch transfer;
- subtree preservation;
- exact changed-rollup identification;
- source-order sibling placement after transfer;
- cycle prevention;
- root-move protection;
- transfer validation ordering where relevant;
- rejected-transfer atomicity;
- reset exactness and deterministic reapplication.

## 20. Interview / Development Deliverables

Before implementation begins, the coding agent must produce a **3–5 step implementation plan with checkpoints**.

Project deliverables should include:
- working application;
- clear run instructions;
- realistic deterministic sample data;
- `PLAN.md` with checkpoints and later deviations;
- AI prompt history / notable iterations;
- architecture/design rationale and trade-offs;
- independent expected-results oracle;
- repeatable test evidence;
- development environment ready for a small live modification.

## 21. Success Criteria

The solution is successful when:
- all required domain rules are encoded in testable backend logic;
- the 12-person main demo exactly reproduces independently verified initial and post-transfer results;
- illegal operations never corrupt valid state;
- source order and reset determinism are preserved;
- the UI clearly explains both structure and change impact;
- the implementation remains simple enough for the candidate to explain and modify confidently.

## 22. Implementation Planning Note for Coding Agent

Do **not** start coding immediately after reading this PRD.

First:
1. read `ARCHITECTURE.md`;
2. design the exact 12-person demo dataset and independent expected-result oracle;
3. produce the required 3–5 step `PLAN.md` with measurable checkpoints;
4. identify any conflicts or ambiguities before implementation;
5. then implement core domain logic and tests before UI polish.
