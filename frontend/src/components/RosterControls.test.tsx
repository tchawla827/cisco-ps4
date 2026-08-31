import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'

import { RosterControls } from './RosterControls'
import type { DepartmentView } from '../types/department'

const department: DepartmentView = {
  scenario: 'main-12',
  root_id: 'HOD',
  employees: [
    { employee_id: 'HOD', name: 'Head', role: 'HOD', monthly_salary: 1, manager_id: null, children_ids: ['LEAD_A'], direct_report_count: 1, team_headcount: 2, team_payroll: 2 },
    { employee_id: 'LEAD_A', name: 'Lead Alice', role: 'Lead', monthly_salary: 1, manager_id: 'HOD', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 1 },
  ],
  totals: { employee_count: 2, total_payroll: 2 },
  last_successful_transfer: null,
}

describe('RosterControls', () => {
  afterEach(() => cleanup())

  it('disables Add until every required field is filled', () => {
    render(<RosterControls department={department} loading={false} onAdd={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByRole('button', { name: /add employee/i })).toBeDisabled()
  })

  it('calls onAdd with the entered fields once all are filled', () => {
    const onAdd = vi.fn()
    render(<RosterControls department={department} loading={false} onAdd={onAdd} onDelete={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/^employee id$/i), { target: { value: 'E7' } })
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'New Hire' } })
    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'IC' } })
    fireEvent.change(screen.getByLabelText(/monthly salary/i), { target: { value: '40000' } })
    fireEvent.change(screen.getByLabelText(/manager/i), { target: { value: 'LEAD_A' } })
    fireEvent.click(screen.getByRole('button', { name: /add employee/i }))

    expect(onAdd).toHaveBeenCalledWith({
      employee_id: 'E7',
      name: 'New Hire',
      role: 'IC',
      monthly_salary: 40_000,
      manager_id: 'LEAD_A',
    })
  })

  it('calls onDelete with the typed id and disables Delete until an id is entered', () => {
    const onDelete = vi.fn()
    render(<RosterControls department={department} loading={false} onAdd={vi.fn()} onDelete={onDelete} />)

    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/delete employee id/i), { target: { value: 'LEAD_A' } })
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(onDelete).toHaveBeenCalledWith('LEAD_A')
  })
})
