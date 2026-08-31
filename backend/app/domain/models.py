from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Employee:
    # Annotations are documentation only - dataclasses do not enforce them at
    # runtime. validation.py is the sole enforcer, and invalid scenario
    # fixtures deliberately violate these types so Pass 1 can reject them.
    employee_id: str
    name: str
    role: str
    monthly_salary: int
    manager_id: str | None


@dataclass(frozen=True)
class Rollup:
    team_headcount: int
    team_payroll: int


@dataclass(frozen=True)
class DepartmentTree:
    root_id: str
    employees: tuple[Employee, ...]
    employee_by_id: dict[str, Employee]
    children_by_id: dict[str, list[str]]
