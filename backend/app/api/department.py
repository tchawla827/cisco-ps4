from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.data.scenarios import SCENARIOS
from app.domain.errors import DomainError
from app.domain.transfer import TransferImpact
from app.models.department import (
    DepartmentTotalsView,
    DepartmentView,
    EmployeeView,
    LoadRequest,
    RollupChangeView,
    RollupView,
    ScenarioView,
    TransferImpactView,
    TransferRequest,
)
from app.services.department_service import DepartmentService, DepartmentState


router = APIRouter(prefix="/api")
department_service = DepartmentService()


def _error_response(error: DomainError, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": error.code, "message": error.message}},
    )


def _no_department_response() -> JSONResponse:
    return _error_response(
        DomainError("NO_DEPARTMENT_LOADED", "No department is loaded"), status_code=409
    )


def _impact_view(impact: TransferImpact, state: DepartmentState) -> TransferImpactView:
    employees = state.tree.employee_by_id
    return TransferImpactView(
        employee_id=impact.employee_id,
        employee_name=employees[impact.employee_id].name,
        old_manager_id=impact.old_manager_id,
        new_manager_id=impact.new_manager_id,
        moved_subtree_ids=impact.moved_subtree_ids,
        moved_headcount=impact.moved_headcount,
        moved_payroll=impact.moved_payroll,
        changed_rollup_ids=impact.changed_rollup_ids,
        changes=[
            RollupChangeView(
                employee_id=change.employee_id,
                name=employees[change.employee_id].name,
                role=employees[change.employee_id].role,
                before=RollupView(
                    team_headcount=change.before.team_headcount,
                    team_payroll=change.before.team_payroll,
                ),
                after=RollupView(
                    team_headcount=change.after.team_headcount,
                    team_payroll=change.after.team_payroll,
                ),
            )
            for change in impact.changes
        ],
        root_unchanged=impact.root_unchanged,
    )


def _department_view(state: DepartmentState) -> DepartmentView:
    return DepartmentView(
        scenario=state.scenario_key,
        root_id=state.tree.root_id,
        employees=[
            EmployeeView(
                employee_id=employee.employee_id,
                name=employee.name,
                role=employee.role,
                monthly_salary=employee.monthly_salary,
                manager_id=employee.manager_id,
                children_ids=list(state.tree.children_by_id[employee.employee_id]),
                direct_report_count=len(state.tree.children_by_id[employee.employee_id]),
                team_headcount=state.rollups[employee.employee_id].team_headcount,
                team_payroll=state.rollups[employee.employee_id].team_payroll,
            )
            for employee in state.employees
        ],
        totals=DepartmentTotalsView(
            employee_count=len(state.employees),
            total_payroll=state.rollups[state.tree.root_id].team_payroll,
        ),
        last_successful_transfer=(
            _impact_view(state.last_successful_transfer, state)
            if state.last_successful_transfer is not None
            else None
        ),
    )


@router.get("/scenarios", response_model=list[ScenarioView])
def list_scenarios() -> list[ScenarioView]:
    return [
        ScenarioView(
            key=scenario.key,
            label=scenario.label,
            kind=scenario.kind,
            description=scenario.description,
        )
        for scenario in SCENARIOS.values()
    ]


@router.post("/department/load", response_model=DepartmentView)
def load_department(request: LoadRequest) -> DepartmentView | JSONResponse:
    result = department_service.load(request.scenario)
    if isinstance(result, DomainError):
        return _error_response(result)
    return _department_view(result)


@router.get("/department", response_model=DepartmentView)
def get_department() -> DepartmentView | JSONResponse:
    state = department_service.get_state()
    if state is None:
        return _no_department_response()
    return _department_view(state)


@router.post("/department/transfer", response_model=None)
def transfer_department(request: TransferRequest):
    state = department_service.get_state()
    if state is None:
        return _no_department_response()

    result = department_service.transfer(request.employee_id, request.new_manager_id)
    if isinstance(result, DomainError):
        return _error_response(result)

    updated_state = department_service.get_state()
    assert updated_state is not None
    return {
        "department": _department_view(updated_state),
        "impact": _impact_view(result, updated_state),
    }


@router.post("/department/transfer/preview", response_model=None)
def preview_transfer(request: TransferRequest):
    state = department_service.get_state()
    if state is None:
        return _no_department_response()

    result = department_service.preview(request.employee_id, request.new_manager_id)
    if isinstance(result, DomainError):
        return _error_response(result)
    return {"impact": _impact_view(result, state)}


@router.post("/department/reset", response_model=DepartmentView)
def reset_department() -> DepartmentView | JSONResponse:
    state = department_service.reset()
    if state is None:
        return _no_department_response()
    return _department_view(state)
