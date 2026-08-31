import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OrgTreeCanvas, resolveDrop } from './OrgTreeCanvas'
import type { DepartmentView } from '../types/department'

afterEach(() => cleanup())

const department: DepartmentView = {
  scenario: 'canvas-fixture',
  root_id: 'HOD',
  employees: [
    { employee_id: 'HOD', name: 'Head', role: 'HOD', monthly_salary: 1, manager_id: null, children_ids: ['MGR_A'], direct_report_count: 1, team_headcount: 3, team_payroll: 3 },
    { employee_id: 'MGR_A', name: 'Manager Ann', role: 'Manager', monthly_salary: 1, manager_id: 'HOD', children_ids: ['E1'], direct_report_count: 1, team_headcount: 2, team_payroll: 2 },
    { employee_id: 'E1', name: 'Employee One', role: 'IC', monthly_salary: 1, manager_id: 'MGR_A', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 1 },
  ],
  totals: { employee_count: 3, total_payroll: 3 },
  last_successful_transfer: null,
}

describe('resolveDrop', () => {
  it('returns null when there is no drop target', () => {
    expect(resolveDrop('E1', null)).toBeNull()
    expect(resolveDrop('E1', undefined)).toBeNull()
  })

  it('returns null when dropped on itself', () => {
    expect(resolveDrop('E1', 'E1')).toBeNull()
  })

  it('returns the employee and manager id when dropped on a different node', () => {
    expect(resolveDrop('E1', 'HOD')).toEqual({ employeeId: 'E1', managerId: 'HOD' })
  })
})

describe('OrgTreeCanvas', () => {
  it('renders every visible node card with id and name', () => {
    render(
      <OrgTreeCanvas
        department={department}
        selectedId={null}
        previewImpact={null}
        collapsedIds={new Set()}
        onSelect={vi.fn()}
        onToggleCollapse={vi.fn()}
        onProposeTransfer={vi.fn()}
      />,
    )

    expect(screen.getByText('HOD')).toBeInTheDocument()
    expect(screen.getByText('Manager Ann')).toBeInTheDocument()
    expect(screen.getByText('Employee One')).toBeInTheDocument()
  })

  it('omits collapsed descendants from the rendered cards', () => {
    render(
      <OrgTreeCanvas
        department={department}
        selectedId={null}
        previewImpact={null}
        collapsedIds={new Set(['MGR_A'])}
        onSelect={vi.fn()}
        onToggleCollapse={vi.fn()}
        onProposeTransfer={vi.fn()}
      />,
    )

    expect(screen.getByText('Manager Ann')).toBeInTheDocument()
    expect(screen.queryByText('Employee One')).not.toBeInTheDocument()
  })

  it('calls onToggleCollapse with the node id when its collapse toggle is clicked', () => {
    const onToggleCollapse = vi.fn()
    render(
      <OrgTreeCanvas
        department={department}
        selectedId={null}
        previewImpact={null}
        collapsedIds={new Set()}
        onSelect={vi.fn()}
        onToggleCollapse={onToggleCollapse}
        onProposeTransfer={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /collapse manager ann/i }))

    expect(onToggleCollapse).toHaveBeenCalledWith('MGR_A')
  })

  it('calls onSelect with the node id when a card is clicked', () => {
    const onSelect = vi.fn()
    render(
      <OrgTreeCanvas
        department={department}
        selectedId={null}
        previewImpact={null}
        collapsedIds={new Set()}
        onSelect={onSelect}
        onToggleCollapse={vi.fn()}
        onProposeTransfer={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Manager Ann'))

    expect(onSelect).toHaveBeenCalledWith('MGR_A')
  })
})
