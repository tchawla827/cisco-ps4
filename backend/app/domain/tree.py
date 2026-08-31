from __future__ import annotations

from collections.abc import Sequence

from app.domain.models import DepartmentTree, Employee


def build_tree(employees: Sequence[Employee]) -> DepartmentTree:
    """Build the source-order-preserving hierarchy from validated employees."""
    employee_by_id = {employee.employee_id: employee for employee in employees}
    children_by_id = {employee.employee_id: [] for employee in employees}
    root_id = ""

    for employee in employees:
        if employee.manager_id is None:
            root_id = employee.employee_id
        else:
            children_by_id[employee.manager_id].append(employee.employee_id)

    return DepartmentTree(
        root_id=root_id,
        employees=tuple(employees),
        employee_by_id=employee_by_id,
        children_by_id=children_by_id,
    )


def collect_subtree_ids(tree: DepartmentTree, employee_id: str) -> list[str]:
    """Collect an employee and descendants in source-order preorder."""
    employee_ids = [employee_id]
    for child_id in tree.children_by_id[employee_id]:
        employee_ids.extend(collect_subtree_ids(tree, child_id))
    return employee_ids
