import {
  ApiError,
  type AddEmployeeRequest,
  type DepartmentView,
  type PreviewTransferResponse,
  type ScenarioView,
  type TransferResponse,
} from '../types/department'

export { ApiError } from '../types/department'

interface ErrorResponse {
  error?: {
    code?: unknown
    message?: unknown
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ErrorResponse
    const code = typeof payload.error?.code === 'string' ? payload.error.code : `HTTP_${response.status}`
    const message =
      typeof payload.error?.message === 'string'
        ? payload.error.message
        : `Request failed with status ${response.status}`

    throw new ApiError(code, message)
  }

  return (await response.json()) as T
}

function transferRequest(employeeId: string, newManagerId: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employee_id: employeeId, new_manager_id: newManagerId }),
  }
}

export function listScenarios(): Promise<ScenarioView[]> {
  return request('/api/scenarios')
}

export function loadDepartment(scenario: string): Promise<DepartmentView> {
  return request('/api/department/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario }),
  })
}

export function getDepartment(): Promise<DepartmentView> {
  return request('/api/department')
}

export function transfer(employeeId: string, newManagerId: string): Promise<TransferResponse> {
  return request('/api/department/transfer', transferRequest(employeeId, newManagerId))
}

export function previewTransfer(
  employeeId: string,
  newManagerId: string,
): Promise<PreviewTransferResponse> {
  return request('/api/department/transfer/preview', transferRequest(employeeId, newManagerId))
}

export function resetDepartment(): Promise<DepartmentView> {
  return request('/api/department/reset', { method: 'POST' })
}

export function addEmployee(body: AddEmployeeRequest): Promise<DepartmentView> {
  return request<DepartmentView>('/api/department/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteEmployee(employeeId: string): Promise<DepartmentView> {
  return request<DepartmentView>(`/api/department/employees/${employeeId}`, { method: 'DELETE' })
}
