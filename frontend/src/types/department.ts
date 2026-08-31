export interface EmployeeView {
  employee_id: string
  name: string
  role: string
  monthly_salary: number
  manager_id: string | null
  children_ids: string[]
  direct_report_count: number
  team_headcount: number
  team_payroll: number
}

export interface DepartmentTotalsView {
  employee_count: number
  total_payroll: number
}

export interface RollupView {
  team_headcount: number
  team_payroll: number
}

export interface RollupChangeView {
  employee_id: string
  name: string
  role: string
  before: RollupView
  after: RollupView
}

export interface TransferImpactView {
  employee_id: string
  employee_name: string
  old_manager_id: string
  new_manager_id: string
  moved_subtree_ids: string[]
  moved_headcount: number
  moved_payroll: number
  changed_rollup_ids: string[]
  changes: RollupChangeView[]
  root_unchanged: boolean
}

export interface DepartmentView {
  scenario: string
  root_id: string
  employees: EmployeeView[]
  totals: DepartmentTotalsView
  last_successful_transfer: TransferImpactView | null
}

export interface ScenarioView {
  key: string
  label: string
  kind: string
  description: string
}

export interface TransferResponse {
  department: DepartmentView
  impact: TransferImpactView
}

export interface PreviewTransferResponse {
  impact: TransferImpactView
  department: DepartmentView
}

export interface AddEmployeeRequest {
  employee_id: string
  name: string
  role: string
  monthly_salary: number
  manager_id: string
}

export class ApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}
