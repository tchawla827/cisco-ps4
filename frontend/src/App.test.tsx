import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import {
  ApiError,
  listScenarios,
  loadDepartment,
  previewTransfer,
  resetDepartment,
  transfer,
} from './api/department'
import type { DepartmentView, TransferImpactView } from './types/department'

vi.mock('./api/department', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/department')>()

  return {
    ...actual,
    listScenarios: vi.fn(),
    loadDepartment: vi.fn(),
    previewTransfer: vi.fn(),
    resetDepartment: vi.fn(),
    transfer: vi.fn(),
  }
})

const scenarios = [
  { key: 'main-12', label: 'Main department', kind: 'main', description: 'Payroll department' },
  { key: 'invalid', label: 'Invalid department', kind: 'invalid', description: 'Rejected by validation' },
]

const transferImpact: TransferImpactView = {
  employee_id: 'LEAD_A',
  employee_name: 'Lead Alice',
  old_manager_id: 'MGR_A',
  new_manager_id: 'MGR_C',
  moved_subtree_ids: ['LEAD_A'],
  moved_headcount: 1,
  moved_payroll: 100,
  changed_rollup_ids: ['MGR_A', 'MGR_C'],
  changes: [
    {
      employee_id: 'MGR_A',
      name: 'Manager Ann',
      role: 'Manager',
      before: { team_headcount: 2, team_payroll: 200 },
      after: { team_headcount: 1, team_payroll: 100 },
    },
    {
      employee_id: 'MGR_C',
      name: 'Manager Chris',
      role: 'Manager',
      before: { team_headcount: 1, team_payroll: 100 },
      after: { team_headcount: 2, team_payroll: 200 },
    },
  ],
  root_unchanged: true,
}

const loadedDepartment: DepartmentView = {
  scenario: 'main-12',
  root_id: 'HOD',
  employees: [
    { employee_id: 'HOD', name: 'Head Dana', role: 'Head of Department', monthly_salary: 100, manager_id: null, children_ids: ['MGR_A', 'MGR_C'], direct_report_count: 2, team_headcount: 4, team_payroll: 400 },
    { employee_id: 'MGR_A', name: 'Manager Ann', role: 'Manager', monthly_salary: 100, manager_id: 'HOD', children_ids: ['LEAD_A'], direct_report_count: 1, team_headcount: 2, team_payroll: 200 },
    { employee_id: 'MGR_C', name: 'Manager Chris', role: 'Manager', monthly_salary: 100, manager_id: 'HOD', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 100 },
    { employee_id: 'LEAD_A', name: 'Lead Alice', role: 'Lead', monthly_salary: 100, manager_id: 'MGR_A', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 100 },
  ],
  totals: { employee_count: 4, total_payroll: 400 },
  last_successful_transfer: null,
}

const transferredDepartment: DepartmentView = {
  ...loadedDepartment,
  employees: [
    loadedDepartment.employees[0],
    { ...loadedDepartment.employees[1], children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 100 },
    { ...loadedDepartment.employees[2], children_ids: ['LEAD_A'], direct_report_count: 1, team_headcount: 2, team_payroll: 200 },
    { ...loadedDepartment.employees[3], manager_id: 'MGR_C' },
  ],
  last_successful_transfer: transferImpact,
}

const mockedListScenarios = vi.mocked(listScenarios)
const mockedLoadDepartment = vi.mocked(loadDepartment)
const mockedPreviewTransfer = vi.mocked(previewTransfer)
const mockedResetDepartment = vi.mocked(resetDepartment)
const mockedTransfer = vi.mocked(transfer)

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

function renderLoadedApp(department: DepartmentView = loadedDepartment) {
  mockedListScenarios.mockResolvedValue(scenarios)
  mockedLoadDepartment.mockResolvedValue(department)

  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Load' }))

  return screen.findByRole('tree', { name: 'Department reporting tree' })
}

function detailsPanel(): HTMLElement {
  return screen.getByRole('heading', { name: 'Details' }).parentElement as HTMLElement
}

describe('App', () => {
  it('updates employee details when an employee row is selected', async () => {
    await renderLoadedApp()

    fireEvent.click(screen.getByRole('row', { name: /LEAD_A.*Lead Alice/ }))

    const details = detailsPanel()
    expect(within(details).getByText('LEAD_A')).toBeInTheDocument()
    expect(within(details).getByText('Lead Alice')).toBeInTheDocument()
    expect(within(details).queryByText('Manager')).not.toBeInTheDocument()
    expect(screen.getByRole('treeitem', { name: /LEAD_A.*selected/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps committed impact cards and tree state after a later transfer is rejected', async () => {
    mockedTransfer
      .mockResolvedValueOnce({ department: transferredDepartment, impact: transferImpact })
      .mockRejectedValueOnce(new ApiError('INVALID_TRANSFER', 'Cannot move employee under a descendant.'))
    await renderLoadedApp()

    fireEvent.click(screen.getByRole('button', { name: 'Valid preset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await screen.findByText('Transfer applied to the current department.')
    expect(screen.getByText('↪ MOVED')).toBeInTheDocument()
    expect(screen.getAllByText('Δ CHANGED')).toHaveLength(2)
    expect(screen.getByRole('treeitem', { name: /LEAD_A.*reports to MGR_C.*moved/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Valid preset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('INVALID_TRANSFER'))
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot move employee under a descendant.')
    expect(screen.getByText('↪ MOVED')).toBeInTheDocument()
    expect(screen.getAllByText('Δ CHANGED')).toHaveLength(2)
    expect(screen.getByRole('treeitem', { name: /LEAD_A.*reports to MGR_C.*moved/ })).toBeInTheDocument()
    expect(mockedTransfer).toHaveBeenLastCalledWith('LEAD_A', 'MGR_C')
  })

  it('removes the table, organisation tree, and prior impact when loading a rejected scenario', async () => {
    mockedListScenarios.mockResolvedValue(scenarios)
    mockedLoadDepartment
      .mockResolvedValueOnce(transferredDepartment)
      .mockRejectedValueOnce(new ApiError('INVALID_SCENARIO', 'Scenario records are invalid.'))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))

    await screen.findByText('↪ MOVED')
    fireEvent.change(screen.getByRole('combobox', { name: 'Scenario' }), { target: { value: 'invalid' } })
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('INVALID_SCENARIO'))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('tree', { name: 'Department reporting tree' })).not.toBeInTheDocument()
    expect(screen.queryByText('↪ MOVED')).not.toBeInTheDocument()
    expect(screen.getByText('No transfer impact available.')).toBeInTheDocument()
  })

  it('reset clears transfer and preview state while returning selection to the root', async () => {
    mockedPreviewTransfer.mockResolvedValue({ impact: transferImpact })
    mockedResetDepartment.mockResolvedValue(loadedDepartment)
    await renderLoadedApp(transferredDepartment)

    expect(screen.getByLabelText('MOVED')).toBeInTheDocument()
    expect(screen.getAllByLabelText('CHANGED')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Valid preset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    await screen.findByText('Preview only')
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    await screen.findByText('Department reset to its loaded state.')
    expect(screen.queryByLabelText('MOVED')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('CHANGED')).not.toBeInTheDocument()
    expect(screen.queryByText('Preview only')).not.toBeInTheDocument()
    expect(screen.queryByText('↪ MOVED')).not.toBeInTheDocument()
    expect(screen.getByText('No transfer impact available.')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /HOD.*Head Dana/ })).toHaveAttribute('aria-selected', 'true')
    const treeItems = screen.getAllByRole('treeitem')
    const treeItemLabels = treeItems.map((item) => item.getAttribute('aria-label') ?? '')

    expect(treeItemLabels).not.toContainEqual(expect.stringMatching(/\b(?:moved|changed|preview)\b/i))
    expect(screen.getByRole('treeitem', { name: /HOD.*root employee.*root.*selected/ })).toHaveAttribute('aria-selected', 'true')
  })
})
