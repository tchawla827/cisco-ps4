import { CheckCircle2, Eye, FlaskConical, RotateCw, TriangleAlert } from 'lucide-react'

import type { DepartmentView } from '../types/department'

interface TransferControlsProps {
  department: DepartmentView | null
  employeeId: string
  newManagerId: string
  loading: boolean
  onEmployeeIdChange: (employeeId: string) => void
  onNewManagerIdChange: (managerId: string) => void
  onPreview: () => void
  onApply: () => void
  onLoadValidPreset: () => void
  onLoadCyclePreset: () => void
  onAttemptRootMove: () => void
}

function employeeLabel(employeeId: string, name: string): string {
  return `${employeeId} — ${name}`
}

export function TransferControls({
  department,
  employeeId,
  newManagerId,
  loading,
  onEmployeeIdChange,
  onNewManagerIdChange,
  onPreview,
  onApply,
  onLoadValidPreset,
  onLoadCyclePreset,
  onAttemptRootMove,
}: TransferControlsProps) {
  if (department === null) {
    return <p className="workspace-section__empty">Load a department to stage a transfer.</p>
  }

  const root = department.employees.find((employee) => employee.employee_id === department.root_id)
  const canSubmit = !loading && employeeId !== '' && newManagerId !== ''
  const presetsAvailable = department.scenario === 'main-12'

  return (
    <div className="transfer-controls">
      <label className="transfer-control">
        <span>Move</span>
        <select
          value={employeeId}
          onChange={(event) => onEmployeeIdChange(event.target.value)}
          disabled={loading}
          aria-label="Employee to move"
        >
          <option value="">Choose employee</option>
          {department.employees.map((employee) => (
            <option
              key={employee.employee_id}
              value={employee.employee_id}
              disabled={employee.employee_id === department.root_id}
            >
              {employee.employee_id === department.root_id
                ? `${employeeLabel(employee.employee_id, employee.name)} (root cannot be moved)`
                : employeeLabel(employee.employee_id, employee.name)}
            </option>
          ))}
        </select>
      </label>
      <p className="transfer-controls__hint">The root employee is protected. Use the demo action to show the guard.</p>

      <label className="transfer-control">
        <span>Under</span>
        <select
          value={newManagerId}
          onChange={(event) => onNewManagerIdChange(event.target.value)}
          disabled={loading}
          aria-label="New manager"
        >
          <option value="">Choose manager</option>
          {department.employees.map((employee) => (
            <option key={employee.employee_id} value={employee.employee_id}>
              {employeeLabel(employee.employee_id, employee.name)}
            </option>
          ))}
        </select>
      </label>

      <div className="transfer-controls__commands" aria-label="Transfer commands">
        <button className="command-button" type="button" onClick={onPreview} disabled={!canSubmit}>
          <Eye aria-hidden="true" size={16} strokeWidth={2} />
          <span>{loading ? 'Working' : 'Preview'}</span>
        </button>
        <button className="command-button command-button--primary" type="button" onClick={onApply} disabled={!canSubmit}>
          <CheckCircle2 aria-hidden="true" size={16} strokeWidth={2} />
          <span>{loading ? 'Working' : 'Apply'}</span>
        </button>
      </div>

      <div className="transfer-controls__presets" aria-label="Transfer examples">
        {presetsAvailable ? (
          <>
            <button className="preset-button" type="button" onClick={onLoadValidPreset} disabled={loading}>
              <FlaskConical aria-hidden="true" size={15} strokeWidth={2} />
              <span>Valid preset</span>
            </button>
            <button className="preset-button" type="button" onClick={onLoadCyclePreset} disabled={loading}>
              <RotateCw aria-hidden="true" size={15} strokeWidth={2} />
              <span>Cycle preset</span>
            </button>
          </>
        ) : (
          <p className="transfer-controls__hint">Presets are only wired for the main-12 scenario.</p>
        )}
        <button className="preset-button preset-button--danger" type="button" onClick={onAttemptRootMove} disabled={loading || root === undefined}>
          <TriangleAlert aria-hidden="true" size={15} strokeWidth={2} />
          <span>Attempt root move</span>
        </button>
      </div>
    </div>
  )
}
