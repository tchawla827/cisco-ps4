import { useEffect, useState } from 'react'

import {
  ApiError,
  listScenarios,
  loadDepartment,
  previewTransfer,
  resetDepartment,
  transfer,
} from './api/department'
import { AppHeader } from './components/AppHeader'
import { CompareDrawer } from './components/CompareDrawer'
import { EmployeeDetails } from './components/EmployeeDetails'
import { EmployeeTable } from './components/EmployeeTable'
import { ImpactPanel } from './components/ImpactPanel'
import { MessageBanner, type BannerMessage } from './components/MessageBanner'
import { OrgTree } from './components/OrgTree'
import { TransferControls } from './components/TransferControls'
import type { DepartmentView, ScenarioView, TransferImpactView } from './types/department'

function messageFromError(error: unknown, fallback: string): BannerMessage {
  if (error instanceof ApiError) {
    return { kind: 'error', code: error.code, message: error.message }
  }

  return { kind: 'error', code: 'REQUEST_FAILED', message: fallback }
}

function App() {
  const [scenarios, setScenarios] = useState<ScenarioView[]>([])
  const [scenario, setScenario] = useState('main-12')
  const [department, setDepartment] = useState<DepartmentView | null>(null)
  const [originalDepartment, setOriginalDepartment] = useState<DepartmentView | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [transferEmployeeId, setTransferEmployeeId] = useState('')
  const [newManagerId, setNewManagerId] = useState('')
  const [previewImpact, setPreviewImpact] = useState<TransferImpactView | null>(null)
  const [banner, setBanner] = useState<BannerMessage | null>(null)
  const [loading, setLoading] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)

  useEffect(() => {
    void listScenarios()
      .then(setScenarios)
      .catch((error: unknown) => setBanner(messageFromError(error, 'Unable to load scenarios.')))
  }, [])

  const clearInvalidLoad = (error: unknown) => {
    setDepartment(null)
    setOriginalDepartment(null)
    setPreviewImpact(null)
    setSelectedId(null)
    setTransferEmployeeId('')
    setNewManagerId('')
    setCompareOpen(false)
    setBanner(messageFromError(error, 'Unable to load the selected department.'))
  }

  const handleLoad = async () => {
    setLoading(true)
    try {
      const loadedDepartment = await loadDepartment(scenario)
      setDepartment(loadedDepartment)
      setOriginalDepartment(loadedDepartment)
      setSelectedId(loadedDepartment.root_id)
      setTransferEmployeeId('')
      setNewManagerId('')
      setPreviewImpact(null)
      setCompareOpen(false)
      setBanner({ kind: 'success', message: `Loaded ${loadedDepartment.employees.length} employee records.` })
    } catch (error) {
      clearInvalidLoad(error)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setLoading(true)
    try {
      const reset = await resetDepartment()
      setDepartment(reset)
      setOriginalDepartment(reset)
      setSelectedId(reset.root_id)
      setTransferEmployeeId('')
      setNewManagerId('')
      setPreviewImpact(null)
      setCompareOpen(false)
      setBanner({ kind: 'success', message: 'Department reset to its loaded state.' })
    } catch (error) {
      setBanner(messageFromError(error, 'Unable to reset the department.'))
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async () => {
    if (!department || !transferEmployeeId || !newManagerId) return

    setLoading(true)
    try {
      const response = await previewTransfer(transferEmployeeId, newManagerId)
      setPreviewImpact(response.impact)
      setBanner({ kind: 'success', message: 'Transfer preview is ready for review.' })
    } catch (error) {
      setPreviewImpact(null)
      setBanner(messageFromError(error, 'Unable to preview this transfer.'))
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async () => {
    if (!department || !transferEmployeeId || !newManagerId) return

    setLoading(true)
    try {
      const response = await transfer(transferEmployeeId, newManagerId)
      setDepartment(response.department)
      setPreviewImpact(null)
      setSelectedId(response.impact.employee_id)
      setBanner({ kind: 'success', message: 'Transfer applied to the current department.' })
    } catch (error) {
      setPreviewImpact(null)
      setBanner(messageFromError(error, 'Transfer was not applied.'))
    } finally {
      setLoading(false)
    }
  }

  const handleTransferEmployeeIdChange = (employeeId: string) => {
    setTransferEmployeeId(employeeId)
    setPreviewImpact(null)
  }

  const handleNewManagerIdChange = (managerId: string) => {
    setNewManagerId(managerId)
    setPreviewImpact(null)
  }

  const loadTransferPreset = (employeeId: string, managerId: string) => {
    setTransferEmployeeId(employeeId)
    setNewManagerId(managerId)
    setPreviewImpact(null)
    setBanner({ kind: 'success', message: `Staged ${employeeId} → ${managerId}.` })
  }

  const handleRootMoveAttempt = async () => {
    if (!department) return

    const root = department.employees.find((employee) => employee.employee_id === department.root_id)
    const demonstrationManagerId = root?.children_ids[0] ?? department.employees.find((employee) => employee.employee_id !== department.root_id)?.employee_id
    if (!demonstrationManagerId) {
      setBanner({
        kind: 'error',
        code: 'NO_DEMONSTRATION_TARGET',
        message: 'No other employee exists to demonstrate a root move on this scenario.',
      })
      return
    }

    setLoading(true)
    try {
      await transfer(department.root_id, demonstrationManagerId)
    } catch (error) {
      setPreviewImpact(null)
      setBanner(messageFromError(error, 'Root transfer was not applied.'))
    } finally {
      setLoading(false)
    }
  }

  const impact = previewImpact ?? department?.last_successful_transfer ?? null
  const selectedEmployee = department?.employees.find((employee) => employee.employee_id === selectedId) ?? null

  return (
    <main className="app-shell">
      <AppHeader
        scenarios={scenarios}
        scenario={scenario}
        loading={loading}
        hasDepartment={department !== null && originalDepartment !== null}
        compareOpen={compareOpen}
        onScenarioChange={setScenario}
        onLoad={() => void handleLoad()}
        onReset={() => void handleReset()}
        onCompareToggle={() => setCompareOpen((open) => !open)}
      />
      <section className="cockpit" aria-label="Department payroll workspace">
        <section className="workspace-zone workspace-zone--table" aria-labelledby="employee-table-heading">
          <div className="workspace-zone__header">
            <span className="workspace-zone__eyebrow">SOURCE RECORDS</span>
            <span className="workspace-zone__title" id="employee-table-heading">Employees</span>
          </div>
          <div className="workspace-zone__body">
            <MessageBanner banner={banner} />
            {department ? (
              <EmployeeTable department={department} selectedId={selectedId} impact={impact} onSelect={setSelectedId} />
            ) : (
              <div className="empty-state">No valid department loaded.</div>
            )}
          </div>
        </section>

        <section className="workspace-zone workspace-zone--chart" aria-labelledby="org-chart-heading">
          <div className="workspace-zone__header">
            <span className="workspace-zone__eyebrow">REPORTING LINES</span>
            <span className="workspace-zone__title" id="org-chart-heading">Organisation chart</span>
          </div>
          <div className="workspace-zone__body">
            {department ? (
              <OrgTree
                department={department}
                selectedId={selectedId}
                previewImpact={previewImpact}
                onSelect={setSelectedId}
              />
            ) : <div className="chart-stage">No organisation chart to display.</div>}
          </div>
        </section>

        <aside className="workspace-zone workspace-zone--right" aria-label="Department review panels">
          <div className="workspace-zone__header">
            <span className="workspace-zone__eyebrow">REVIEW</span>
            <span className="workspace-zone__title">Work queue</span>
          </div>
          <div className="workspace-zone__body">
            <section className="workspace-section">
              <h2 className="workspace-section__heading">Details</h2>
              <EmployeeDetails employee={selectedEmployee} />
            </section>
            <section className="workspace-section">
              <h2 className="workspace-section__heading">Transfer</h2>
              <TransferControls
                department={department}
                employeeId={transferEmployeeId}
                newManagerId={newManagerId}
                loading={loading}
                onEmployeeIdChange={handleTransferEmployeeIdChange}
                onNewManagerIdChange={handleNewManagerIdChange}
                onPreview={() => void handlePreview()}
                onApply={() => void handleTransfer()}
                onLoadValidPreset={() => loadTransferPreset('LEAD_A', 'MGR_C')}
                onLoadCyclePreset={() => loadTransferPreset('MGR_A', 'E3')}
                onAttemptRootMove={() => void handleRootMoveAttempt()}
              />
            </section>
            <section className="workspace-section">
              <h2 className="workspace-section__heading">Impact</h2>
              <ImpactPanel department={department} impact={impact} preview={previewImpact !== null} />
            </section>
          </div>
        </aside>
      </section>
      {department && originalDepartment ? (
        <CompareDrawer
          currentDepartment={department}
          originalDepartment={originalDepartment}
          isOpen={compareOpen}
          onClose={() => setCompareOpen(false)}
        />
      ) : null}
    </main>
  )
}

export default App
