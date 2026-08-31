import { describe, expect, it } from 'vitest'

import { layoutTree } from './orgTreeLayout'
import type { DepartmentView } from '../types/department'

const department: DepartmentView = {
  scenario: 'layout-fixture',
  root_id: 'HOD',
  employees: [
    { employee_id: 'HOD', name: 'Head', role: 'HOD', monthly_salary: 1, manager_id: null, children_ids: ['MGR_A', 'MGR_B', 'MGR_C'], direct_report_count: 3, team_headcount: 8, team_payroll: 8 },
    { employee_id: 'MGR_C', name: 'C', role: 'Manager', monthly_salary: 1, manager_id: 'HOD', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 1 },
    { employee_id: 'E2', name: 'Employee 2', role: 'IC', monthly_salary: 1, manager_id: 'LEAD_A', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 1 },
    { employee_id: 'LEAD_A', name: 'Lead', role: 'Lead', monthly_salary: 1, manager_id: 'MGR_A', children_ids: ['E1', 'E2'], direct_report_count: 2, team_headcount: 3, team_payroll: 3 },
    { employee_id: 'MGR_B', name: 'B', role: 'Manager', monthly_salary: 1, manager_id: 'HOD', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 1 },
    { employee_id: 'E1', name: 'Employee 1', role: 'IC', monthly_salary: 1, manager_id: 'LEAD_A', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 1 },
    { employee_id: 'MGR_A', name: 'A', role: 'Manager', monthly_salary: 1, manager_id: 'HOD', children_ids: ['LEAD_A'], direct_report_count: 1, team_headcount: 4, team_payroll: 4 },
  ],
  totals: { employee_count: 7, total_payroll: 7 },
  last_successful_transfer: null,
}

describe('layoutTree', () => {
  it('orders siblings by children_ids even when employee records are scrambled', () => {
    const result = layoutTree(department)
    const byId = new Map(result.nodes.map((node) => [node.id, node]))

    expect(byId.get('MGR_A')?.x).toBeLessThan(byId.get('MGR_B')?.x ?? Number.NaN)
    expect(byId.get('MGR_B')?.x).toBeLessThan(byId.get('MGR_C')?.x ?? Number.NaN)
    expect(byId.get('E1')?.x).toBeLessThan(byId.get('E2')?.x ?? Number.NaN)
  })

  it('centres each parent between its first and last child', () => {
    const result = layoutTree(department)
    const byId = new Map(result.nodes.map((node) => [node.id, node]))
    const xOf = (id: string): number => {
      const node = byId.get(id)
      if (node === undefined) throw new Error(`Expected ${id} to be positioned`)
      return node.x
    }

    expect(xOf('HOD')).toBe((xOf('MGR_A') + xOf('MGR_C')) / 2)
    expect(xOf('LEAD_A')).toBe((xOf('E1') + xOf('E2')) / 2)
  })

  it('returns deterministic, unique coordinates and orthogonal elbow edges', () => {
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
