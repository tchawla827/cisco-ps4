from __future__ import annotations

import importlib
import pkgutil
from pathlib import Path

import app.domain


APP_ROOT = Path(__file__).resolve().parents[1] / "app"
FORBIDDEN_ORACLE_REFERENCES = (
    "tests.oracle",
    "from tests",
    "import tests",
    "EXPECTED_RESULTS",
)


def test_production_app_never_references_test_oracle() -> None:
    violations = [
        str(path.relative_to(APP_ROOT))
        for path in APP_ROOT.rglob("*.py")
        if any(reference in path.read_text() for reference in FORBIDDEN_ORACLE_REFERENCES)
    ]

    assert violations == []


def test_domain_modules_remain_independent_of_fastapi_and_pydantic() -> None:
    violations = []
    for module_info in pkgutil.walk_packages(app.domain.__path__, "app.domain."):
        module = importlib.import_module(module_info.name)
        source_path = Path(module.__file__ or "")
        source = source_path.read_text().lower()
        if "fastapi" in source or "pydantic" in source:
            violations.append(module_info.name)

    assert violations == []
