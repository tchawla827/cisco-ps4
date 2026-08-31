import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TransferDropConfirm } from './TransferDropConfirm'
import type { TransferImpactView } from '../types/department'

afterEach(() => cleanup())

const impact: TransferImpactView = {
  employee_id: 'LEAD_A',
  employee_name: 'Lead Alice',
  old_manager_id: 'MGR_A',
  new_manager_id: 'MGR_C',
  moved_subtree_ids: ['LEAD_A', 'E1'],
  moved_headcount: 2,
  moved_payroll: 80_000,
  changed_rollup_ids: ['MGR_A', 'MGR_C'],
  changes: [],
  root_unchanged: true,
}

describe('TransferDropConfirm', () => {
  it('shows the proposed move and impact numbers', () => {
    render(
      <TransferDropConfirm
        employeeId="LEAD_A"
        newManagerId="MGR_C"
        impact={impact}
        loading={false}
        error={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText(/LEAD_A/)).toBeInTheDocument()
    expect(screen.getAllByText(/MGR_C/).length).toBeGreaterThan(0)
    expect(screen.getByText(/2/)).toBeInTheDocument()
  })

  it('shows the backend error message when the proposed move is invalid', () => {
    render(
      <TransferDropConfirm
        employeeId="MGR_A"
        newManagerId="E3"
        impact={null}
        loading={false}
        error={{ kind: 'error', code: 'MANAGEMENT_CYCLE', message: 'Transfer would create a management cycle' }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText('Transfer would create a management cycle')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('calls onConfirm and onCancel from their respective buttons', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <TransferDropConfirm
        employeeId="LEAD_A"
        newManagerId="MGR_C"
        impact={impact}
        loading={false}
        error={null}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
