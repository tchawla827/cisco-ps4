# Expected Results — Independent Oracle (Main 12-Employee Demo)

This document is the **independent oracle** required by `PRD.md` §6.3 and
`ARCHITECTURE.md` AD-08. It is hand-worked, computed *before* (and independently
of) the running application. Production code (`backend/app/**`) must never
import this file or its values to decide a result — it exists purely for
comparison in `docs/TEST_EVIDENCE.md` and in `backend/tests/*`.

## 1. Demo Dataset (source order, exactly as loaded)

| # | `employee_id` | Role | Monthly salary | `manager_id` |
| - | --- | --- | ---: | --- |
| 1 | `HOD` | Department Head | 200000 | `null` |
| 2 | `MGR_A` | Programme Manager | 90000 | `HOD` |
| 3 | `MGR_B` | Laboratory Manager | 85000 | `HOD` |
| 4 | `MGR_C` | Operations Manager | 78000 | `HOD` |
| 5 | `LEAD_A` | Project Lead | 65000 | `MGR_A` |
| 6 | `LEAD_B` | Research Lead | 60000 | `MGR_B` |
| 7 | `E1` | Developer | 42000 | `LEAD_A` |
| 8 | `E2` | Developer | 38000 | `LEAD_A` |
| 9 | `E3` | Designer | 47000 | `MGR_A` |
| 10 | `E4` | Analyst | 41000 | `LEAD_B` |
| 11 | `E5` | Technician | 36000 | `MGR_B` |
| 12 | `E6` | Coordinator | 39000 | `MGR_C` |

Shape checklist (PRD §6):
- exactly one root (`HOD`) — ✅
- ≥2 distinct branches below root — ✅ (`MGR_A`, `MGR_B`, `MGR_C` branches)
- ≥3 employees with direct reports — ✅ (`HOD`, `MGR_A`, `MGR_B`, `MGR_C`, `LEAD_A`, `LEAD_B` — six)
- ≥1 non-leaf lead movable cross-branch — ✅ (`LEAD_A`, descendants `E1`, `E2`)
- ≥1 employee at depth ≥3 from root — ✅ (`E1`, `E2` under `LEAD_A`; `E4` under `LEAD_B`, all depth 3)
- differing salaries producing visible payroll deltas — ✅ (all 12 values distinct)

Total employee count: **12**. Total salary sum: **821,000**.

```text
200000+90000+85000+78000+65000+60000+42000+38000+47000+41000+36000+39000 = 821000
```

## 2. Initial Rollups (before any transfer)

| `employee_id` | `team_headcount` | `team_payroll` |
| --- | ---: | ---: |
| `HOD` | 12 | 821000 |
| `MGR_A` | 5 | 282000 |
| `MGR_B` | 4 | 222000 |
| `MGR_C` | 2 | 117000 |
| `LEAD_A` | 3 | 145000 |
| `LEAD_B` | 2 | 101000 |
| `E1` | 1 | 42000 |
| `E2` | 1 | 38000 |
| `E3` | 1 | 47000 |
| `E4` | 1 | 41000 |
| `E5` | 1 | 36000 |
| `E6` | 1 | 39000 |

Derivations:
- `LEAD_A` = 65000 + `E1`(42000) + `E2`(38000) → headcount 3, payroll 145000
- `MGR_A` = 90000 + `LEAD_A`(3, 145000) + `E3`(1, 47000) → headcount 5, payroll 282000
- `LEAD_B` = 60000 + `E4`(41000) → headcount 2, payroll 101000
- `MGR_B` = 85000 + `LEAD_B`(2, 101000) + `E5`(1, 36000) → headcount 4, payroll 222000
- `MGR_C` = 78000 + `E6`(39000) → headcount 2, payroll 117000
- `HOD` = 200000 + `MGR_A`(282000) + `MGR_B`(222000) + `MGR_C`(117000) → headcount 12, payroll 821000

Root invariant check: `HOD.team_headcount == 12` ✅, `HOD.team_payroll == 821000` ✅ (sum of all salaries).

## 3. Required Valid Demo Transfer

**Move `LEAD_A` from `MGR_A` to `MGR_C`.**

`LEAD_A` is non-leaf (subtree = `LEAD_A`, `E1`, `E2`; headcount 3, payroll 145000).
This is a genuine cross-branch move (`MGR_A`'s branch → `MGR_C`'s branch).

### 3.1 Post-transfer rollups

| `employee_id` | `team_headcount` | `team_payroll` | Changed? |
| --- | ---: | ---: | --- |
| `HOD` | 12 | 821000 | no |
| `MGR_A` | 2 | 137000 | **yes** |
| `MGR_B` | 4 | 222000 | no |
| `MGR_C` | 5 | 262000 | **yes** |
| `LEAD_A` | 3 | 145000 | no (own rollup unchanged) |
| `LEAD_B` | 2 | 101000 | no |
| `E1`–`E6` | unchanged | unchanged | no |

Derivations:
- `MGR_A` after = 90000 + `E3`(47000) → headcount 2, payroll 137000
- `MGR_C` after = 78000 + `LEAD_A` subtree(3, 145000) + `E6`(39000) → headcount 5, payroll 262000
- `HOD` after = 200000 + 137000 + 222000 + 262000 = 821000, headcount 1+2+4+5 = 12 (unchanged, as required)

### 3.2 `changed_rollup_ids`

In source order: **`["MGR_A", "MGR_C"]`**

(`LEAD_A` moved but its own rollup is unchanged, so it does not appear here; it must
still be represented as the moved subtree in the impact panel per PRD §Reorganisation.)

### 3.3 Moved subtree

`moved_subtree_ids = ["LEAD_A", "E1", "E2"]`, `moved_headcount = 3`, `moved_payroll = 145000`.

### 3.4 Sibling order after transfer (source-order rebuild)

- `MGR_A.children_ids` before: `["LEAD_A", "E3"]` → after: `["E3"]`
- `MGR_C.children_ids` before: `["E6"]` → after: `["LEAD_A", "E6"]`
  (`LEAD_A` is source record #5, `E6` is source record #12, so `LEAD_A` sorts first)

## 4. Required Invalid Demo Transfer (Cycle)

**Attempt to move `MGR_A` under `E3`.**

`E3` is a direct child of `MGR_A` both **before** and **after** the valid transfer in
§3 (the `LEAD_A` move does not touch `MGR_A`'s relationship with `E3`), so this
transfer is invalid in either ordering, satisfying PRD §6.2.

Expected result: `MANAGEMENT_CYCLE` (checked after `UNKNOWN_TRANSFER_EMPLOYEE`,
`ROOT_MOVE_FORBIDDEN`, `SELF_MANAGER`, and `ALREADY_REPORTS_TO_MANAGER` all pass —
`MGR_A` and `E3` are both known, `MGR_A` is not root, they are not the same
employee, and `MGR_A` does not already report to `E3`).

The last valid chart, rollups, and the §3 transfer explanation must remain
displayed unchanged after this rejection.

## 5. Root-Move Rejection

Attempt to move `HOD` to any other manager (e.g. `HOD` → `MGR_A`) must be
rejected with `ROOT_MOVE_FORBIDDEN` before any cycle/self checks are relevant.

## 6. One-Employee Department (edge case)

A single record, `SOLO` (`manager_id: null`, any valid salary, e.g. `50000`):
expected `team_headcount = 1`, `team_payroll = 50000`. Root invariants trivially
hold (`headcount == 1 == employee count`, `payroll == 50000 == salary sum`).

## 7. Structural Load Failures (for repeatable negative tests)

- **Duplicate ID**: two records sharing `employee_id: "MGR_A"` → `DUPLICATE_EMPLOYEE_ID`.
- **Unknown manager**: a record with `manager_id: "GHOST"` where no employee has
  `employee_id: "GHOST"` → `UNKNOWN_MANAGER`.
- **Cycle**: e.g. `A.manager_id = B`, `B.manager_id = A` (no `null` root at all,
  or a disjoint two-node cycle alongside an otherwise valid root) → depending on
  root count this may resolve to `INVALID_ROOT_COUNT` first; construct the cycle
  fixture so a single root still exists and the cycle is elsewhere in the graph,
  isolating `MANAGEMENT_CYCLE` for that specific test.

These fixtures live in `backend/tests/`, not in `backend/app/data/demo_department.py`.
