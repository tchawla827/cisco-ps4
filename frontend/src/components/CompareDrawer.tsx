import { useEffect, useRef, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

import type { DepartmentView } from '../types/department'
import { OrgTree } from './OrgTree'

interface CompareDrawerProps {
  leftDepartment: DepartmentView
  rightDepartment: DepartmentView
  isOpen: boolean
  onClose: () => void
  leftLabel?: string
  rightLabel?: string
  title?: string
  eyebrow?: string
}

function trapDrawerFocus(event: KeyboardEvent<HTMLElement>, closeButton: HTMLButtonElement | null) {
  if (event.key !== 'Tab' || !closeButton) return

  event.preventDefault()
  closeButton.focus()
}

function ReportingRelationships({ department, label }: { department: DepartmentView; label: string }) {
  return (
    <div className="visually-hidden">
      <h4>{label} reporting relationships</h4>
      <ul>
        {department.employees.map((employee) => (
          <li key={employee.employee_id}>
            {employee.manager_id === null
              ? `${employee.employee_id} has no manager (root).`
              : `${employee.employee_id} reports to ${employee.manager_id}.`}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CompareDrawer({
  leftDepartment,
  rightDepartment,
  isOpen,
  onClose,
  leftLabel = 'Original',
  rightLabel = 'Current',
  title = 'Compare organisation charts',
  eyebrow = 'DEPARTMENT SNAPSHOT',
}: CompareDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()

    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      returnFocusRef.current?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="compare-drawer" role="presentation">
      <button
        className="compare-drawer__backdrop"
        type="button"
        aria-label="Close comparison"
        onClick={onClose}
      />
      <aside
        className="compare-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-drawer-title"
        onKeyDown={(event) => trapDrawerFocus(event, closeButtonRef.current)}
      >
        <header className="compare-drawer__header">
          <div>
            <span className="compare-drawer__eyebrow">{eyebrow}</span>
            <h2 id="compare-drawer-title">{title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="icon-command"
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            title="Close comparison"
          >
            <X aria-hidden="true" size={18} strokeWidth={2} />
          </button>
        </header>

        <div className="compare-drawer__legend" aria-label="Organisation chart legend">
          <span><strong className="compare-legend__root">★</strong> Root</span>
          <span><strong className="compare-legend__moved">↪</strong> Moved subtree</span>
          <span><strong className="compare-legend__changed">Δ</strong> Changed rollup</span>
        </div>

        <div className="compare-drawer__trees">
          <section className="compare-tree" aria-labelledby="compare-left-heading">
            <h3 id="compare-left-heading">{leftLabel}</h3>
            <ReportingRelationships department={leftDepartment} label={leftLabel} />
            <OrgTree department={leftDepartment} readOnly ariaLabel={`${leftLabel} department reporting tree`} />
          </section>
          <section className="compare-tree" aria-labelledby="compare-right-heading">
            <h3 id="compare-right-heading">{rightLabel}</h3>
            <ReportingRelationships department={rightDepartment} label={rightLabel} />
            <OrgTree department={rightDepartment} readOnly ariaLabel={`${rightLabel} department reporting tree`} />
          </section>
        </div>
      </aside>
    </div>
  )
}
