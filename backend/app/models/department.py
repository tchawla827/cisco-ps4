from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class EmployeeView(BaseModel):
    employee_id: str
    name: str
    role: str
    monthly_salary: int
    manager_id: Optional[str]
    children_ids: list[str]
    direct_report_count: int
    team_headcount: int
    team_payroll: int


class DepartmentTotalsView(BaseModel):
    employee_count: int
    total_payroll: int


class RollupView(BaseModel):
    team_headcount: int
    team_payroll: int


class RollupChangeView(BaseModel):
    employee_id: str
    name: str
    role: str
    before: RollupView
    after: RollupView


class TransferImpactView(BaseModel):
    employee_id: str
    employee_name: str
    old_manager_id: str
    new_manager_id: str
    moved_subtree_ids: list[str]
    moved_headcount: int
    moved_payroll: int
    changed_rollup_ids: list[str]
    changes: list[RollupChangeView]
    root_unchanged: bool


class DepartmentView(BaseModel):
    scenario: str
    root_id: str
    employees: list[EmployeeView]
    totals: DepartmentTotalsView
    last_successful_transfer: Optional[TransferImpactView]


class ScenarioView(BaseModel):
    key: str
    label: str
    kind: str
    description: str


class TransferRequest(BaseModel):
    employee_id: str
    new_manager_id: str


class AddEmployeeRequest(BaseModel):
    employee_id: str
    name: str
    role: str
    monthly_salary: int
    manager_id: str


class LoadRequest(BaseModel):
    scenario: str = "main-12"
