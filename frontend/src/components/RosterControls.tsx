import { Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'

import type { AddEmployeeRequest, DepartmentView } from '../types/department'

interface RosterControlsProps {
  department: DepartmentView | null
  loading: boolean
  onAdd: (request: AddEmployeeRequest) => void
  onDelete: (employeeId: string) => void
}

export function RosterControls({ department, loading, onAdd, onDelete }: RosterControlsProps) {
  const [employeeId, setEmployeeId] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [salary, setSalary] = useState('')
  const [managerId, setManagerId] = useState('')
  const [deleteId, setDeleteId] = useState('')

  if (department === null) {
    return <p className="workspace-section__empty">Load a department to manage employees.</p>
  }

  const salaryValue = Number(salary)
  const canAdd = !loading && employeeId.trim() !== '' && name.trim() !== '' && role.trim() !== '' && managerId !== '' && Number.isInteger(salaryValue) && salaryValue > 0
  const canDelete = !loading && deleteId !== ''

  const submitAdd = () => {
    onAdd({
      employee_id: employeeId.trim().toUpperCase(),
      name: name.trim(),
      role: role.trim(),
      monthly_salary: salaryValue,
      manager_id: managerId,
    })
    setEmployeeId('')
    setName('')
    setRole('')
    setSalary('')
  }

  return (
    <div className="roster-controls">
      <div className="roster-controls__section">
        <h3>Add employee</h3>
        <div className="roster-form">
          <div className="roster-form__row">
            <label htmlFor="roster-add-id">Employee ID</label>
            <input id="roster-add-id" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} disabled={loading} placeholder="E7" />
          </div>
          <div className="roster-form__row">
            <label htmlFor="roster-add-name">Name</label>
            <input id="roster-add-name" value={name} onChange={(event) => setName(event.target.value)} disabled={loading} placeholder="New Hire" />
          </div>
          <div className="roster-form__row">
            <label htmlFor="roster-add-role">Role</label>
            <input id="roster-add-role" value={role} onChange={(event) => setRole(event.target.value)} disabled={loading} placeholder="IC" />
          </div>
          <div className="roster-form__row">
            <label htmlFor="roster-add-salary">Monthly salary</label>
            <input id="roster-add-salary" type="number" min={1} value={salary} onChange={(event) => setSalary(event.target.value)} disabled={loading} placeholder="40000" />
          </div>
          <div className="roster-form__row">
            <label htmlFor="roster-add-manager">Manager</label>
            <select id="roster-add-manager" value={managerId} onChange={(event) => setManagerId(event.target.value)} disabled={loading}>
              <option value="">Choose manager</option>
              {department.employees.map((employee) => (
                <option key={employee.employee_id} value={employee.employee_id}>
                  {employee.employee_id} — {employee.name}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="command-button command-button--primary" onClick={submitAdd} disabled={!canAdd}>
            <UserPlus aria-hidden="true" size={16} strokeWidth={2} />
            <span>Add employee</span>
          </button>
        </div>
      </div>

      <div className="roster-controls__section">
        <h3>Delete employee</h3>
        <div className="roster-delete">
          <label htmlFor="roster-delete-id" className="visually-hidden">Delete employee id</label>
          <input id="roster-delete-id" value={deleteId} onChange={(event) => setDeleteId(event.target.value)} disabled={loading} placeholder="Employee ID" />
          <button
            type="button"
            className="command-button"
            onClick={() => {
              onDelete(deleteId.trim().toUpperCase())
              setDeleteId('')
            }}
            disabled={!canDelete}
          >
            <Trash2 aria-hidden="true" size={16} strokeWidth={2} />
            <span>Delete</span>
          </button>
        </div>
        <p className="transfer-controls__hint">An employee with direct reports must be reassigned before they can be deleted.</p>
      </div>
    </div>
  )
}
