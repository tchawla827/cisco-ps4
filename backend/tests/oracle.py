"""Hand-transcribed expected values from docs/EXPECTED_RESULTS.md."""

from app.domain.models import Rollup


TOTAL_PAYROLL = 821_000

INITIAL_ROLLUPS = {
    "HOD": Rollup(12, TOTAL_PAYROLL),
    "MGR_A": Rollup(5, 282_000),
    "MGR_B": Rollup(4, 222_000),
    "MGR_C": Rollup(2, 117_000),
    "LEAD_A": Rollup(3, 145_000),
    "LEAD_B": Rollup(2, 101_000),
    "E1": Rollup(1, 42_000),
    "E2": Rollup(1, 38_000),
    "E3": Rollup(1, 47_000),
    "E4": Rollup(1, 41_000),
    "E5": Rollup(1, 36_000),
    "E6": Rollup(1, 39_000),
}

POST_TRANSFER_ROLLUPS = {
    "HOD": Rollup(12, TOTAL_PAYROLL),
    "MGR_A": Rollup(2, 137_000),
    "MGR_B": Rollup(4, 222_000),
    "MGR_C": Rollup(5, 262_000),
    "LEAD_A": Rollup(3, 145_000),
    "LEAD_B": Rollup(2, 101_000),
    "E1": Rollup(1, 42_000),
    "E2": Rollup(1, 38_000),
    "E3": Rollup(1, 47_000),
    "E4": Rollup(1, 41_000),
    "E5": Rollup(1, 36_000),
    "E6": Rollup(1, 39_000),
}

CHANGED_IDS = ["MGR_A", "MGR_C"]
MOVED_SUBTREE_IDS = ["LEAD_A", "E1", "E2"]
MOVED_HEADCOUNT = 3
MOVED_PAYROLL = 145_000
