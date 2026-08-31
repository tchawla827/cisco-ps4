from __future__ import annotations

from dataclasses import dataclass

from app.data.scenarios import SCENARIOS, Scenario
from app.domain.errors import DomainError
from app.domain.models import DepartmentTree, Employee, Rollup
from app.domain.rollups import assert_root_invariants, calculate_rollups
from app.domain.roster import apply_add, apply_delete, validate_delete
from app.domain.transfer import (
    RollupChange,
    TransferImpact,
    apply_transfer,
    diff_rollups,
    validate_transfer,
)
from app.domain.tree import build_tree, collect_subtree_ids
from app.domain.validation import validate_department


@dataclass(frozen=True)
class DepartmentState:
    scenario_key: str
    employees: list[Employee]
    tree: DepartmentTree
    rollups: dict[str, Rollup]
    last_successful_transfer: TransferImpact | None


class DepartmentService:
    def __init__(self) -> None:
        self._original_employees: list[Employee] | None = None
        self._current_employees: list[Employee] | None = None
        self._last_successful_transfer: TransferImpact | None = None
        self._loaded_scenario: Scenario | None = None

    def load(self, scenario_key: str) -> DepartmentState | DomainError:
        scenario = SCENARIOS.get(scenario_key)
        if scenario is None:
            self._clear()
            return DomainError("UNKNOWN_SCENARIO", f"Unknown scenario: '{scenario_key}'")

        employees = scenario.employees()
        error = validate_department(employees)
        if error is not None:
            self._clear()
            return error

        self._original_employees = list(employees)
        self._current_employees = list(employees)
        self._last_successful_transfer = None
        self._loaded_scenario = scenario
        state = self.get_state()
        assert state is not None
        return state

    def get_state(self) -> DepartmentState | None:
        if self._current_employees is None or self._loaded_scenario is None:
            return None

        tree = build_tree(self._current_employees)
        rollups = calculate_rollups(tree)
        return DepartmentState(
            scenario_key=self._loaded_scenario.key,
            employees=list(self._current_employees),
            tree=tree,
            rollups=rollups,
            last_successful_transfer=self._last_successful_transfer,
        )

    def transfer(
        self, employee_id: str, new_manager_id: str
    ) -> TransferImpact | DomainError:
        result = self._compute_transfer(employee_id, new_manager_id)
        if isinstance(result, DomainError):
            return result

        candidate, impact = result
        self._current_employees = candidate
        self._last_successful_transfer = impact
        return impact

    def preview(
        self, employee_id: str, new_manager_id: str
    ) -> TransferImpact | DomainError:
        result = self._compute_transfer(employee_id, new_manager_id)
        if isinstance(result, DomainError):
            return result
        _, impact = result
        return impact

    def preview_department(
        self, employee_id: str, new_manager_id: str
    ) -> DepartmentState | DomainError:
        """Return the full candidate state a transfer would produce, without committing it."""
        result = self._compute_transfer(employee_id, new_manager_id)
        if isinstance(result, DomainError):
            return result

        candidate, _impact = result
        candidate_tree = build_tree(candidate)
        rollups = calculate_rollups(candidate_tree)
        assert self._loaded_scenario is not None
        return DepartmentState(
            scenario_key=self._loaded_scenario.key,
            employees=candidate,
            tree=candidate_tree,
            rollups=rollups,
            last_successful_transfer=self._last_successful_transfer,
        )

    def reset(self) -> DepartmentState | None:
        if self._original_employees is None:
            return None

        self._current_employees = list(self._original_employees)
        self._last_successful_transfer = None
        state = self.get_state()
        assert state is not None
        return state

    def add_employee(
        self,
        employee_id: str,
        name: str,
        role: str,
        monthly_salary: int,
        manager_id: str,
    ) -> DepartmentState | DomainError:
        if self._current_employees is None:
            return DomainError("NO_SCENARIO_LOADED", "No scenario is loaded")

        new_employee = Employee(
            employee_id=employee_id,
            name=name,
            role=role,
            monthly_salary=monthly_salary,
            manager_id=manager_id,
        )
        candidate = apply_add(self._current_employees, new_employee)
        error = validate_department(candidate)
        if error is not None:
            return error

        self._current_employees = candidate
        self._last_successful_transfer = None
        state = self.get_state()
        assert state is not None
        return state

    def delete_employee(self, employee_id: str) -> DepartmentState | DomainError:
        if self._current_employees is None:
            return DomainError("NO_SCENARIO_LOADED", "No scenario is loaded")

        tree = build_tree(self._current_employees)
        error = validate_delete(tree, employee_id)
        if error is not None:
            return error

        candidate = apply_delete(self._current_employees, employee_id)
        candidate_error = validate_department(candidate)
        if candidate_error is not None:
            return candidate_error

        self._current_employees = candidate
        self._last_successful_transfer = None
        state = self.get_state()
        assert state is not None
        return state

    def _compute_transfer(
        self, employee_id: str, new_manager_id: str
    ) -> tuple[list[Employee], TransferImpact] | DomainError:
        if self._current_employees is None:
            return DomainError("NO_SCENARIO_LOADED", "No scenario is loaded")

        current = self._current_employees
        tree = build_tree(current)
        before_rollups = calculate_rollups(tree)
        error = validate_transfer(tree, employee_id, new_manager_id)
        if error is not None:
            return error

        moved_subtree_ids = collect_subtree_ids(tree, employee_id)
        moved_rollup = before_rollups[employee_id]
        old_manager_id = tree.employee_by_id[employee_id].manager_id
        assert old_manager_id is not None

        candidate = apply_transfer(current, employee_id, new_manager_id)
        candidate_error = validate_department(candidate)
        if candidate_error is not None:
            return candidate_error
        candidate_tree = build_tree(candidate)
        after_rollups = calculate_rollups(candidate_tree)
        assert_root_invariants(candidate_tree, after_rollups)

        changed_rollup_ids = diff_rollups(current, before_rollups, after_rollups)
        impact = TransferImpact(
            employee_id=employee_id,
            old_manager_id=old_manager_id,
            new_manager_id=new_manager_id,
            moved_subtree_ids=moved_subtree_ids,
            moved_headcount=moved_rollup.team_headcount,
            moved_payroll=moved_rollup.team_payroll,
            changed_rollup_ids=changed_rollup_ids,
            changes=[
                RollupChange(
                    changed_id,
                    before_rollups[changed_id],
                    after_rollups[changed_id],
                )
                for changed_id in changed_rollup_ids
            ],
            root_unchanged=before_rollups[tree.root_id]
            == after_rollups[candidate_tree.root_id],
        )
        return candidate, impact

    def _clear(self) -> None:
        self._original_employees = None
        self._current_employees = None
        self._last_successful_transfer = None
        self._loaded_scenario = None
