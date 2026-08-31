import type { EmployeeView } from '../types/department'

interface EmployeeDetailsProps {
  employee: EmployeeView | null
}

function formatCurrency(amount: number): string {
  return `INR ${amount.toLocaleString('en-US')}`
}

export function EmployeeDetails({ employee }: EmployeeDetailsProps) {
  if (employee === null) {
    return <p className="workspace-section__empty">No employee selected.</p>
  }

  return (
    <dl className="employee-details">
      <div className="employee-details__identity">
        <dt>Employee</dt>
        <dd>{employee.employee_id}</dd>
      </div>
      <div>
        <dt>Name</dt>
        <dd>{employee.name}</dd>
      </div>
      <div>
        <dt>Role</dt>
        <dd>{employee.role}</dd>
      </div>
      <div>
        <dt>Own monthly salary</dt>
        <dd>{formatCurrency(employee.monthly_salary)}</dd>
      </div>
      <div>
        <dt>Direct reports</dt>
        <dd>{employee.direct_report_count}</dd>
      </div>
      <div>
        <dt>Team headcount</dt>
        <dd>{employee.team_headcount}</dd>
      </div>
      <div>
        <dt>Team payroll</dt>
        <dd>{formatCurrency(employee.team_payroll)}</dd>
      </div>
    </dl>
  )
}
