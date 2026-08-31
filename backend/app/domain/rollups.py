from __future__ import annotations

from app.domain.models import DepartmentTree, Rollup


class RootInvariantError(Exception):
    """Raised when computed root totals do not match the department records."""


def calculate_rollups(tree: DepartmentTree) -> dict[str, Rollup]:
    """Calculate each employee's complete-team rollup with postorder traversal."""
    rollups: dict[str, Rollup] = {}

    def visit(employee_id: str) -> Rollup:
        employee = tree.employee_by_id[employee_id]
        headcount = 1
        payroll = employee.monthly_salary
        for child_id in tree.children_by_id[employee_id]:
            child_rollup = visit(child_id)
            headcount += child_rollup.team_headcount
            payroll += child_rollup.team_payroll
        rollup = Rollup(team_headcount=headcount, team_payroll=payroll)
        rollups[employee_id] = rollup
        return rollup

    visit(tree.root_id)
    return rollups


def assert_root_invariants(
    tree: DepartmentTree, rollups: dict[str, Rollup]
) -> None:
    """Raise when the root rollup does not cover the validated department."""
    root_rollup = rollups.get(tree.root_id)
    expected_headcount = len(tree.employees)
    expected_payroll = sum(employee.monthly_salary for employee in tree.employees)
    if (
        root_rollup is None
        or root_rollup.team_headcount != expected_headcount
        or root_rollup.team_payroll != expected_payroll
    ):
        raise RootInvariantError("Root rollup does not match department totals")
