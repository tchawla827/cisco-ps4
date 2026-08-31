from __future__ import annotations

from dataclasses import dataclass

from app.domain.models import Employee


@dataclass(frozen=True)
class Scenario:
    key: str
    label: str
    kind: str
    description: str
    _employee_records: tuple[Employee, ...]

    def employees(self) -> list[Employee]:
        """Return a new canonical employee list for each load attempt."""
        return list(self._employee_records)


SCENARIOS: dict[str, Scenario] = {
    "main-12": Scenario(
        key="main-12",
        label="Main 12-person department",
        kind="valid",
        description="The primary cross-branch transfer demonstration.",
        _employee_records=(
            Employee("HOD", "Asha Menon", "Department Head", 200_000, None),
            Employee("MGR_A", "Daniel Ortiz", "Programme Manager", 90_000, "HOD"),
            Employee("MGR_B", "Mei Chen", "Laboratory Manager", 85_000, "HOD"),
            Employee("MGR_C", "Priya Shah", "Operations Manager", 78_000, "HOD"),
            Employee("LEAD_A", "Noah Williams", "Project Lead", 65_000, "MGR_A"),
            Employee("LEAD_B", "Elena Garcia", "Research Lead", 60_000, "MGR_B"),
            Employee("E1", "Liam Brown", "Developer", 42_000, "LEAD_A"),
            Employee("E2", "Sophia Patel", "Developer", 38_000, "LEAD_A"),
            Employee("E3", "Marcus Lee", "Designer", 47_000, "MGR_A"),
            Employee("E4", "Hannah Kim", "Analyst", 41_000, "LEAD_B"),
            Employee("E5", "Owen Wilson", "Technician", 36_000, "MGR_B"),
            Employee("E6", "Grace Martin", "Coordinator", 39_000, "MGR_C"),
        ),
    ),
    "solo-1": Scenario(
        key="solo-1",
        label="Solo department",
        kind="valid",
        description="A one-person department for root and rollup edge cases.",
        _employee_records=(
            Employee("SOLO", "Jordan Reed", "Department Head", 50_000, None),
        ),
    ),
    "invalid-duplicate-id": Scenario(
        key="invalid-duplicate-id",
        label="Duplicate employee identifier",
        kind="invalid",
        description="Contains two records with the same employee identifier.",
        _employee_records=(
            Employee("ROOT", "Rina Das", "Department Head", 100_000, None),
            Employee("DUP", "Taylor Stone", "Manager", 60_000, "ROOT"),
            Employee("DUP", "Morgan Bell", "Analyst", 40_000, "ROOT"),
        ),
    ),
    "invalid-unknown-manager": Scenario(
        key="invalid-unknown-manager",
        label="Unknown manager reference",
        kind="invalid",
        description="A record reports to a manager who is not in the department.",
        _employee_records=(
            Employee("ROOT", "Rina Das", "Department Head", 100_000, None),
            Employee("REPORT", "Taylor Stone", "Analyst", 40_000, "GHOST"),
        ),
    ),
    "invalid-cycle": Scenario(
        key="invalid-cycle",
        label="Disjoint management cycle",
        kind="invalid",
        description="A valid root accompanies a separate two-person cycle.",
        _employee_records=(
            Employee("ROOT", "Rina Das", "Department Head", 100_000, None),
            Employee("C1", "Taylor Stone", "Manager", 60_000, "C2"),
            Employee("C2", "Morgan Bell", "Analyst", 40_000, "C1"),
        ),
    ),
    "invalid-precedence": Scenario(
        key="invalid-precedence",
        label="Duplicate precedes cycle",
        kind="invalid",
        description="A duplicate identifier and a cycle demonstrate validation precedence.",
        _employee_records=(
            Employee("ROOT", "Rina Das", "Department Head", 100_000, None),
            Employee("DUP", "Taylor Stone", "Manager", 60_000, "ROOT"),
            Employee("DUP", "Morgan Bell", "Analyst", 40_000, "ROOT"),
            Employee("C1", "Avery Quinn", "Manager", 55_000, "C2"),
            Employee("C2", "Casey Ray", "Analyst", 45_000, "C1"),
        ),
    ),
}
