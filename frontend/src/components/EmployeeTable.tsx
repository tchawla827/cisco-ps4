import { formatCurrency } from '../format'
import type { DepartmentView, TransferImpactView } from '../types/department'
import { StatusBadge, type StatusKind } from './StatusBadge'

interface EmployeeTableProps {
  department: DepartmentView
  selectedId: string | null
  impact: TransferImpactView | null
  onSelect: (employeeId: string) => void
}

export function EmployeeTable({ department, selectedId, impact, onSelect }: EmployeeTableProps) {
  const movedIds = new Set(impact?.moved_subtree_ids ?? [])
  const changedIds = new Set(impact?.changed_rollup_ids ?? [])

  return (
    <div className="employee-table-scroll">
      <table className="employee-table">
        <colgroup>
          <col className="employee-table__id" />
          <col className="employee-table__name" />
          <col className="employee-table__role" />
          <col className="employee-table__manager" />
          <col className="employee-table__salary" />
          <col className="employee-table__headcount" />
          <col className="employee-table__payroll" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Name</th>
            <th scope="col">Role</th>
            <th scope="col">Manager</th>
            <th scope="col">Salary</th>
            <th scope="col">Team HC</th>
            <th scope="col">Team ₹</th>
          </tr>
        </thead>
        <tbody>
          {department.employees.map((employee) => {
            const statuses: StatusKind[] = []
            if (employee.employee_id === department.root_id) statuses.push('root')
            if (employee.employee_id === selectedId) statuses.push('selected')
            if (movedIds.has(employee.employee_id)) statuses.push('moved')
            if (changedIds.has(employee.employee_id)) statuses.push('changed')

            return (
              <tr
                key={employee.employee_id}
                className={employee.employee_id === selectedId ? 'employee-row employee-row--selected' : 'employee-row'}
                tabIndex={0}
                aria-selected={employee.employee_id === selectedId}
                onClick={() => onSelect(employee.employee_id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(employee.employee_id)
                  }
                }}
              >
                <td className="employee-table__id-cell">{employee.employee_id}</td>
                <td>
                  <div className="employee-table__name-cell">
                    <span>{employee.name}</span>
                    {statuses.length > 0 ? (
                      <span className="employee-table__badges">
                        {statuses.map((status) => (
                          <StatusBadge key={status} status={status} />
                        ))}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>{employee.role}</td>
                <td className="employee-table__manager-cell">{employee.manager_id ?? 'None'}</td>
                <td className="table-number">{formatCurrency(employee.monthly_salary)}</td>
                <td className="table-number">{employee.team_headcount}</td>
                <td className="table-number">{formatCurrency(employee.team_payroll)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
