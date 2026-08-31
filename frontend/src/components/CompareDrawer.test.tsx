import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CompareDrawer } from './CompareDrawer'
import type { DepartmentView } from '../types/department'

afterEach(() => cleanup())

function departmentWithLeadManager(managerId: 'MGR_A' | 'MGR_C'): DepartmentView {
  return {
    scenario: 'comparison-fixture',
    root_id: 'HOD',
    employees: [
      { employee_id: 'HOD', name: 'Head', role: 'Head', monthly_salary: 100, manager_id: null, children_ids: ['MGR_A', 'MGR_C'], direct_report_count: 2, team_headcount: 4, team_payroll: 400 },
      { employee_id: 'MGR_A', name: 'Manager A', role: 'Manager', monthly_salary: 100, manager_id: 'HOD', children_ids: managerId === 'MGR_A' ? ['LEAD_A'] : [], direct_report_count: managerId === 'MGR_A' ? 1 : 0, team_headcount: 2, team_payroll: 200 },
      { employee_id: 'MGR_C', name: 'Manager C', role: 'Manager', monthly_salary: 100, manager_id: 'HOD', children_ids: managerId === 'MGR_C' ? ['LEAD_A'] : [], direct_report_count: managerId === 'MGR_C' ? 1 : 0, team_headcount: 2, team_payroll: 200 },
      { employee_id: 'LEAD_A', name: 'Lead', role: 'Lead', monthly_salary: 100, manager_id: managerId, children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 100 },
    ],
    totals: { employee_count: 4, total_payroll: 400 },
    last_successful_transfer: null,
  }
}

describe('CompareDrawer', () => {
  it('exposes source-ordered original and current reporting relationships by default', () => {
    render(
      <CompareDrawer
        leftDepartment={departmentWithLeadManager('MGR_A')}
        rightDepartment={departmentWithLeadManager('MGR_C')}
        isOpen
        onClose={vi.fn()}
      />,
    )

    const originalHeading = screen.getByRole('heading', { name: 'Original reporting relationships' })
    const currentHeading = screen.getByRole('heading', { name: 'Current reporting relationships' })

    expect(within(originalHeading.parentElement as HTMLElement).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'HOD has no manager (root).',
      'MGR_A reports to HOD.',
      'MGR_C reports to HOD.',
      'LEAD_A reports to MGR_A.',
    ])
    expect(within(currentHeading.parentElement as HTMLElement).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'HOD has no manager (root).',
      'MGR_A reports to HOD.',
      'MGR_C reports to HOD.',
      'LEAD_A reports to MGR_C.',
    ])
  })

  it('supports custom labels and title for non-original/current comparisons', () => {
    render(
      <CompareDrawer
        leftDepartment={departmentWithLeadManager('MGR_A')}
        rightDepartment={departmentWithLeadManager('MGR_C')}
        leftLabel="Current"
        rightLabel="Preview"
        title="Preview transfer impact"
        isOpen
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Preview transfer impact' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Current reporting relationships' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Preview reporting relationships' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Original reporting relationships' })).not.toBeInTheDocument()
  })
})
