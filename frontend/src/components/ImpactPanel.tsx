import { ArrowRight } from 'lucide-react'

import type { DepartmentView, TransferImpactView } from '../types/department'
import { ChangeCard } from './ChangeCard'

interface ImpactPanelProps {
  department: DepartmentView | null
  impact: TransferImpactView | null
  preview: boolean
}

function formatCurrency(amount: number): string {
  return `INR ${amount.toLocaleString('en-US')}`
}

export function ImpactPanel({ department, impact, preview }: ImpactPanelProps) {
  if (department === null || impact === null) {
    return <p className="workspace-section__empty">No transfer impact available.</p>
  }

  const movedEmployee = department.employees.find((employee) => employee.employee_id === impact.employee_id)
  const root = department.employees.find((employee) => employee.employee_id === department.root_id)
  const changesById = new Map(impact.changes.map((change) => [change.employee_id, change]))
  const orderedChanges = impact.changed_rollup_ids
    .map((employeeId) => changesById.get(employeeId))
    .filter((change): change is NonNullable<typeof change> => change !== undefined)

  return (
    <div className={`impact-panel${preview ? ' impact-panel--preview' : ''}`}>
      {preview ? <span className="impact-panel__preview-label">Preview only</span> : null}
      <div className="impact-panel__cards">
        <article className={`impact-card moved-card${preview ? ' impact-card--preview' : ''}`}>
          <span className="impact-card__label">↪ MOVED</span>
          <div className="impact-card__identity">
            <strong>{impact.employee_id}</strong>
            <span>{movedEmployee?.role ?? impact.employee_name}</span>
          </div>
          <p className="moved-card__route">
            <span>{impact.old_manager_id}</span>
            <ArrowRight aria-hidden="true" size={15} strokeWidth={2} />
            <span>{impact.new_manager_id}</span>
          </p>
          <p className="moved-card__subtree">
            Subtree {impact.moved_headcount} · {formatCurrency(impact.moved_payroll)}
          </p>
        </article>
        {orderedChanges.map((change) => <ChangeCard key={change.employee_id} change={change} preview={preview} />)}
      </div>
      {root ? (
        <p className="impact-panel__root-status">
          <strong>★ {root.employee_id}</strong> {root.team_headcount} · {formatCurrency(root.team_payroll)}{' '}
          {impact.root_unchanged ? 'unchanged — not financially affected' : 'changed — financially affected'}
        </p>
      ) : null}
    </div>
  )
}
