# SPR26_D2_P04: Departmental Reorg Payroll Rollup Tracker
*AI-Assisted Coding Interview Problem*

---

# Problem Statement

A university department is preparing for a new semester. Some project teams are moving under different managers, but the existing organisation chart is a flat employee list. Before approving a change, the department head wants to see the proposed reporting structure, the size and monthly payroll of every team, and exactly which totals would change.

Build an interactive **Departmental Reorg Payroll Rollup Tracker**. It should turn employee records into one validated reporting tree, calculate each employee's complete team headcount and payroll, let an administrator move one employee or team to a different manager, and explain the before-and-after impact on a clear organisation chart.

When a team lead moves, everyone reporting through that lead moves with them. The tool must prevent a reorganisation that would create a reporting cycle or attempt to move the department head. A rejected move must leave the department exactly as it was.

No starter dataset, employee photograph, or company asset is supplied. Create a deterministic fictional department with exactly **12 employees** and document its expected results independently before relying on the application. The main department must contain:

- one department head and at least two separate branches below that person;
- at least three employees who have direct reports;
- at least one team lead with one or more descendants who can be moved between branches;
- at least one employee at three or more reporting links below the department head; and
- different salary values that make the affected payroll totals visibly change.

Choose one valid cross-branch transfer of a non-leaf employee for the main demonstration. It must change the headcount and payroll of at least two non-root managers while leaving the department head's total headcount and payroll unchanged. Also choose one attempted transfer that would create a cycle both before and after that valid transfer, so the rejection can be demonstrated in either order. Record the expected initial totals, post-transfer totals, affected employee IDs, and rejected-cycle outcome separately—for example, in hand-worked notes, a spreadsheet, or explicit test constants. The application must calculate its own results from employee records and must not read those expected answers as operational input.

This small illustration explains the calculations; it is not large enough to be the main demonstration:

| ID | Role | Monthly salary | Manager |
| --- | --- | ---: | --- |
| `HOD` | Department Head | `150000` | `null` |
| `MGR_A` | Programme Manager | `80000` | `HOD` |
| `MGR_B` | Laboratory Manager | `75000` | `HOD` |
| `LEAD_A` | Project Lead | `60000` | `MGR_A` |
| `E_X` | Developer | `40000` | `LEAD_A` |
| `E_Y` | Designer | `45000` | `MGR_A` |

Team totals include the selected employee. Initially, `LEAD_A` has headcount `2` and payroll `100000`; `MGR_A` has `4` and `225000`; `MGR_B` has `1` and `75000`; and `HOD` has `6` and `450000`. Moving `LEAD_A` under `MGR_B` keeps the lead's two-person subtree together. Afterwards, `MGR_A` has `2` and `125000`, `MGR_B` has `3` and `175000`, and `HOD` remains at `6` and `450000`. Only `MGR_A` and `MGR_B` have changed rollup values. Attempting to move `MGR_A` under its unchanged descendant `E_Y` must be rejected because it would create a cycle before or after the valid transfer.

Create one attractive reorganisation workspace with the reporting tree, a compact employee table, team-total cards, transfer controls, and a before-and-after impact panel. A user should be able to load the department in one action, inspect any employee, apply the documented valid transfer, attempt the documented invalid transfer, and reset the original organisation. Clearly distinguish the moved subtree from managers whose rollup values changed, using labels or symbols as well as colour.

A local browser application is a natural fit, although a desktop or mobile application, notebook, or another local interactive solution with an equally clear tree visualization is acceptable. Use familiar technology. Accounts, authentication, databases, live HR integrations, individual salary editing, hiring or termination, tax and benefit calculations, dotted-line reporting, approval workflows, and reorganisation history are outside the required scope.

## Contracts

### Department records and validation

- The calculation engine must support from `1` through `30` employee records. The main demonstration must contain exactly `12`.
- Each employee has a unique `employee_id` matching `[A-Z][A-Z0-9_-]{0,15}`, a non-empty `name` and `role` after surrounding whitespace is removed, a whole-number `monthly_salary` from `1` through `1,000,000`, and a `manager_id` that is either `null` or another employee ID.
- Exactly one employee has `manager_id: null`; that employee is the department head and root. Every other employee must reference a declared manager. An employee cannot manage themself.
- Employee records may appear in any source order. Resolve manager references by ID rather than assuming managers appear first. Preserve source order in the employee table and among a manager's direct reports.
- The complete structure must form one connected rooted tree. Reject it before calculating or displaying rollups if the employee count or a field is invalid, an ID is duplicated, the root count is not one, a manager is unknown, an employee manages themself, or any reporting cycle exists.
- Expose stable error codes `INVALID_EMPLOYEE`, `DUPLICATE_EMPLOYEE_ID`, `INVALID_ROOT_COUNT`, `UNKNOWN_MANAGER`, `SELF_MANAGER`, and `MANAGEMENT_CYCLE` as appropriate, together with a useful message identifying the affected record or cycle. A failed load must show no partial tree, totals, transfer result, or stale result from an earlier valid department.
- When a candidate-authored invalid scenario deliberately contains more than one error, report the first category in this order: invalid field or count, duplicate ID, root count, self or unknown manager reference, then cycle. Within one category, use source-record order.

### Team rollups

For an employee `e`, let `children(e)` be their current direct reports. Calculate:

```text
team_headcount(e) = 1 + sum(team_headcount(child))
team_payroll(e) = monthly_salary(e) + sum(team_payroll(child))
```

- Both values include `e` and every direct or indirect report below `e`. A leaf therefore has headcount `1` and payroll equal to their own salary.
- Calculate with exact whole currency units. Use separators or a currency symbol for display, but do not round, abbreviate, or parse displayed text back into the calculation.
- The root's team headcount must equal the number of employees, and the root's team payroll must equal the sum of every employee salary. Treat a failed invariant as an implementation error, not as a second valid interpretation.
- Selecting an employee for inspection must show their own role and salary, direct-report count, complete team headcount, and complete team payroll without changing the tree.

### Reorganisation

- A transfer request contains an existing `employee_id` and an existing `new_manager_id`. It changes only the selected employee's `manager_id`; the employee's complete descendant subtree, salary, and every source record position remain unchanged.
- Check a transfer request in this order: reject `UNKNOWN_TRANSFER_EMPLOYEE` when either ID is unknown; `ROOT_MOVE_FORBIDDEN` when the selected employee is the root; `SELF_MANAGER` when both IDs are the same; `ALREADY_REPORTS_TO_MANAGER` when the selected employee already reports directly to that manager; and `MANAGEMENT_CYCLE` when the proposed manager is anywhere in the selected employee's current subtree.
- Validate the complete request before mutation. A rejected transfer is atomic: preserve every manager link, rollup, and prior successful result.
- On a successful transfer, rebuild both affected direct-report lists in original employee source order. The moved employee therefore takes the position implied by its unchanged source record; no other siblings change their relative order.
- Recalculate all rollups from the updated tree. `changed_rollup_ids` contains exactly those employees whose `team_headcount` or `team_payroll` differs from immediately before the transfer, listed in original employee source order. The moved employee may be shown separately even when their own rollup values did not change.
- Show the old and new direct manager, the moved subtree's headcount and payroll, and before-and-after values for every employee in `changed_rollup_ids`. Do not label an unchanged common ancestor as financially affected merely because it remains above both branches.
- **Reset** restores the exact candidate-created employee records, initial rollups, default inspected employee, and unused transfer controls. It also clears every transfer result and highlight.

## Acceptance Criteria

- **Required:** Create and load in one action a deterministic 12-employee department satisfying every stated shape condition. Independently document and reproduce each employee's initial team headcount and payroll without using the documented answers as calculation input.
- **Required:** Show the complete reporting tree, source-ordered employee table, selected-employee details, and rollup values together. A leaf must show headcount `1`, and the department head must show headcount `12` and payroll equal to the independently calculated sum of all 12 salaries.
- **Required:** Apply the documented cross-branch transfer of a non-leaf employee. Preserve the moved subtree exactly, reproduce the independently documented post-transfer totals, and highlight precisely the documented `changed_rollup_ids` plus the moved subtree.
- **Required:** Explain the transfer with the old manager, new manager, moved headcount and payroll, and before-and-after values for every changed rollup. The department head's totals must remain unchanged for this within-department move.
- **Required:** Reject the documented descendant-as-manager transfer with `MANAGEMENT_CYCLE` and reject an attempted department-head transfer with `ROOT_MOVE_FORBIDDEN`. Neither attempt may alter the last valid chart, totals, or transfer explanation.
- **Required:** Demonstrate a valid one-employee department with headcount `1` and payroll equal to its salary. In addition to the visible invalid transfers, use repeatable candidate-authored tests to reject at least two materially different structural load failures, including a duplicate ID and either an unknown manager or a cycle.
- **Required:** Reset after a successful transfer and restore every original manager link, rollup, selection, and visual state. Reapplying the same transfer must reproduce the same result.
- **Required:** Include focused tests or equivalent repeatable evidence for leaf and multi-level rollups, root invariants, subtree preservation, changed-rollup identification, sibling placement, valid transfer, cycle prevention, root protection, failure atomicity, invalid-load clearing, and reset.
- **Optional:** Add a compact comparison drawer that keeps the original and current organisation charts side by side without adding multi-step history or another reorganisation policy.

Use AI coding assistants. Before implementation, create a short plan with 3–5 ordered steps and useful checkpoints. Be prepared to present that plan, explain any changes you made to it, share relevant prompts, summarize your design, and show test evidence such as tests, screenshots, or output samples.

## How You'll Be Evaluated

- **Planning and Solution Presentation**: Present your 3–5-step implementation plan, explain how the work followed or changed that plan, and demonstrate the working solution with clear explanations
- **AI Prompting Strategy**: Show the prompts you used to translate this problem statement into technical specifications for AI assistants
- **Design Constraints and Technology Choices**: Explain the constraints you provided to AI regarding design patterns, technology stack, and architectural decisions
- **AI-Influenced Decision Making**: Discuss trade-offs, assumptions, and how AI recommendations influenced your choices for components, data structures, and implementation approaches
- **Testing and Validation**: Demonstrate how you tested the application covering both typical usage scenarios and edge cases
- **Live Modification Capability**: Be prepared to implement one small modification, and possibly a second if time permits, using AI assistance; keep your development environment ready for focused changes and verification

