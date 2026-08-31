import { useEffect, useState } from 'react'

import {
  ApiError,
  addEmployee,
  deleteEmployee,
  listScenarios,
  loadDepartment,
  previewTransfer,
  resetDepartment,
  transfer,
} from './api/department'
import { AppHeader } from './components/AppHeader'
import { CollapsiblePanel } from './components/CollapsiblePanel'
import { CompareDrawer } from './components/CompareDrawer'
import { EmployeeDetails } from './components/EmployeeDetails'
import { EmployeeTable } from './components/EmployeeTable'
import { ImpactPanel } from './components/ImpactPanel'
import { MessageBanner, type BannerMessage } from './components/MessageBanner'
import { OrgTreeCanvas } from './components/OrgTreeCanvas'
import { RosterControls } from './components/RosterControls'
import { TransferControls } from './components/TransferControls'
import { TransferDropConfirm } from './components/TransferDropConfirm'
import type { AddEmployeeRequest, DepartmentView, ScenarioView, TransferImpactView } from './types/department'

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set())
  const [pendingDrop, setPendingDrop] = useState<{ employeeId: string; managerId: string } | null>(null)

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
    setCollapsedNodeIds(new Set())
    setPendingDrop(null)
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
      setCollapsedNodeIds(new Set())
      setPendingDrop(null)
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
      setCollapsedNodeIds(new Set())
      setPendingDrop(null)
      setBanner({ kind: 'success', message: 'Department reset to its loaded state.' })
    } catch (error) {
      setBanner(messageFromError(error, 'Unable to reset the department.'))
    } finally {
      setLoading(false)
    }
  }

  const stageAndPreview = async (employeeId: string, managerId: string) => {
    setLoading(true)
    try {
      const response = await previewTransfer(employeeId, managerId)
      setPreviewImpact(response.impact)
      setBanner({ kind: 'success', message: 'Transfer preview is ready for review.' })
    } catch (error) {
      setPreviewImpact(null)
      setBanner(messageFromError(error, 'Unable to preview this transfer.'))
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = () => {
    if (!department || !transferEmployeeId || !newManagerId) return
    void stageAndPreview(transferEmployeeId, newManagerId)
  }

  const commitTransfer = async (employeeId: string, managerId: string) => {
    setLoading(true)
    try {
      const response = await transfer(employeeId, managerId)
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

  const handleTransfer = () => {
    if (!department || !transferEmployeeId || !newManagerId) return
    void commitTransfer(transferEmployeeId, newManagerId)
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

    void commitTransfer(department.root_id, demonstrationManagerId)
  }

  const handleProposeTransfer = (employeeId: string, managerId: string) => {
    setTransferEmployeeId(employeeId)
    setNewManagerId(managerId)
    setPendingDrop({ employeeId, managerId })
    void stageAndPreview(employeeId, managerId)
  }

  const handleConfirmDrop = () => {
    if (!pendingDrop) return
    void commitTransfer(pendingDrop.employeeId, pendingDrop.managerId)
    setPendingDrop(null)
  }

  const handleCancelDrop = () => {
    setPendingDrop(null)
    setPreviewImpact(null)
  }

  const handleToggleCollapseNode = (employeeId: string) => {
    setCollapsedNodeIds((current) => {
      const next = new Set(current)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }

  const handleAddEmployee = async (request: AddEmployeeRequest) => {
    setLoading(true)
    try {
      const updated = await addEmployee(request)
      setDepartment(updated)
      setPreviewImpact(null)
      setBanner({ kind: 'success', message: `Added ${request.employee_id}.` })
    } catch (error) {
      setBanner(messageFromError(error, 'Unable to add employee.'))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEmployee = async (employeeId: string) => {
    if (employeeId === '') return
    setLoading(true)
    try {
      const updated = await deleteEmployee(employeeId)
      setDepartment(updated)
      setPreviewImpact(null)
      setSelectedId((current) => (current === employeeId ? updated.root_id : current))
      setBanner({ kind: 'success', message: `Deleted ${employeeId}.` })
    } catch (error) {
      setBanner(messageFromError(error, 'Unable to delete employee.'))
    } finally {
      setLoading(false)
    }
  }

  const impact = previewImpact ?? department?.last_successful_transfer ?? null
  const selectedEmployee = department?.employees.find((employee) => employee.employee_id === selectedId) ?? null
  const workspaceClassName = [
    'workspace',
    sidebarCollapsed ? 'workspace--sidebar-collapsed' : '',
    rightPanelCollapsed ? 'workspace--right-collapsed' : '',
  ].filter(Boolean).join(' ')

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
      <MessageBanner banner={banner} />
      <section className={workspaceClassName} aria-label="Department payroll workspace">
        <CollapsiblePanel
          title="Employees"
          eyebrow="ROSTER"
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          side="left"
        >
          {department ? (
            <>
              <div className="sidebar-employees">
                <EmployeeTable department={department} selectedId={selectedId} impact={impact} onSelect={setSelectedId} />
              </div>
              <RosterControls department={department} loading={loading} onAdd={(request) => void handleAddEmployee(request)} onDelete={(employeeId) => void handleDeleteEmployee(employeeId)} />
            </>
          ) : (
            <div className="empty-state">No valid department loaded.</div>
          )}
        </CollapsiblePanel>

        <section className="workspace-zone--chart" aria-label="Organisation chart">
          {department ? (
            <OrgTreeCanvas
              department={department}
              selectedId={selectedId}
              previewImpact={previewImpact}
              collapsedIds={collapsedNodeIds}
              onSelect={setSelectedId}
              onToggleCollapse={handleToggleCollapseNode}
              onProposeTransfer={handleProposeTransfer}
            />
          ) : <div className="chart-stage">No organisation chart to display.</div>}
        </section>

        <CollapsiblePanel
          title="Work queue"
          eyebrow="REVIEW"
          collapsed={rightPanelCollapsed}
          onToggleCollapsed={() => setRightPanelCollapsed((value) => !value)}
          side="right"
        >
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
              onPreview={handlePreview}
              onApply={handleTransfer}
              onLoadValidPreset={() => loadTransferPreset('LEAD_A', 'MGR_C')}
              onLoadCyclePreset={() => loadTransferPreset('MGR_A', 'E3')}
              onAttemptRootMove={() => void handleRootMoveAttempt()}
            />
          </section>
          <section className="workspace-section">
            <h2 className="workspace-section__heading">Impact</h2>
            <ImpactPanel department={department} impact={impact} preview={previewImpact !== null} />
          </section>
        </CollapsiblePanel>
      </section>
      {pendingDrop ? (
        <TransferDropConfirm
          employeeId={pendingDrop.employeeId}
          newManagerId={pendingDrop.managerId}
          impact={previewImpact}
          loading={loading}
          error={banner?.kind === 'error' ? banner : null}
          onConfirm={handleConfirmDrop}
          onCancel={handleCancelDrop}
        />
      ) : null}
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
