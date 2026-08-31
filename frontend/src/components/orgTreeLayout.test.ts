import { describe, expect, it } from 'vitest'

import { layoutTree } from './orgTreeLayout'
import type { DepartmentView } from '../types/department'

const department: DepartmentView = {
  scenario: 'layout-fixture',
  root_id: 'HOD',
  employees: [
    { employee_id: 'HOD', name: 'Head', role: 'HOD', monthly_salary: 1, manager_id: null, children_ids: ['MGR_A', 'MGR_B', 'MGR_C'], direct_report_count: 3, team_headcount: 8, team_payroll: 8 },
    { employee_id: 'MGR_A', name: 'A', role: 'Manager', monthly_salary: 1, manager_id: 'HOD', children_ids: ['LEAD_A'], direct_report_count: 1, team_headcount: 4, team_payroll: 4 },
    { employee_id: 'MGR_B', name: 'B', role: 'Manager', monthly_salary: 1, manager_id: 'HOD', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 1 },
    { employee_id: 'MGR_C', name: 'C', role: 'Manager', monthly_salary: 1, manager_id: 'HOD', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 1 },
    { employee_id: 'LEAD_A', name: 'Lead', role: 'Lead', monthly_salary: 1, manager_id: 'MGR_A', children_ids: ['E1', 'E2'], direct_report_count: 2, team_headcount: 3, team_payroll: 3 },
    { employee_id: 'E1', name: 'Employee 1', role: 'IC', monthly_salary: 1, manager_id: 'LEAD_A', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 1 },
    { employee_id: 'E2', name: 'Employee 2', role: 'IC', monthly_salary: 1, manager_id: 'LEAD_A', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 1 },
  ],
  totals: { employee_count: 7, total_payroll: 7 },
  last_successful_transfer: null,
}

describe('layoutTree', () => {
  it('assigns source-ordered leaf slots and centres parents at every depth', () => {
    const result = layoutTree(department)
    const byId = new Map(result.nodes.map((node) => [node.id, node]))

    expect(byId.get('HOD')).toEqual({ id: 'HOD', x: 378, y: 0 })
    expect(byId.get('MGR_A')).toEqual({ id: 'MGR_A', x: 108, y: 140 })
    expect(byId.get('MGR_B')).toEqual({ id: 'MGR_B', x: 432, y: 140 })
    expect(byId.get('MGR_C')).toEqual({ id: 'MGR_C', x: 648, y: 140 })
    expect(byId.get('E1')).toEqual({ id: 'E1', x: 0, y: 420 })
    expect(byId.get('E2')).toEqual({ id: 'E2', x: 216, y: 420 })
    expect(byId.get('LEAD_A')).toEqual({ id: 'LEAD_A', x: 108, y: 280 })
    expect(result.width).toBe(828)
    expect(result.height).toBe(508)
  })

  it('returns deterministic unique coordinates and orthogonal elbow edges', () => {
    const first = layoutTree(department)
    const second = layoutTree(department)
    const coordinates = first.nodes.map(({ x, y }) => `${x},${y}`)

    expect(second).toEqual(first)
    expect(new Set(coordinates).size).toBe(first.nodes.length)
    expect(first.edges).toContainEqual({
      parentId: 'HOD',
      childId: 'MGR_A',
      path: 'M 468,88 V 114 H 198 V 140',
    })
  })
})
