import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

interface CollapsiblePanelProps {
  title: string
  eyebrow?: string
  collapsed: boolean
  onToggleCollapsed: () => void
  side: 'left' | 'right'
  children: ReactNode
}

export function CollapsiblePanel({ title, eyebrow, collapsed, onToggleCollapsed, side, children }: CollapsiblePanelProps) {
  const expandIcon = side === 'left' ? <ChevronRight aria-hidden="true" size={16} strokeWidth={2} /> : <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
  const collapseIcon = side === 'left' ? <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} /> : <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />

  if (collapsed) {
    return (
      <section className="collapsible-panel collapsible-panel--collapsed" aria-label={title}>
        <button
          type="button"
          className="collapsible-panel__toggle"
          onClick={onToggleCollapsed}
          aria-expanded={false}
        >
          {expandIcon}
          <span className="visually-hidden">{`Expand ${title}`}</span>
        </button>
      </section>
    )
  }

  return (
    <section className="collapsible-panel" aria-label={title}>
      <div className="collapsible-panel__header">
        <div className="collapsible-panel__title-group">
          {eyebrow ? <span className="collapsible-panel__eyebrow">{eyebrow}</span> : null}
          <span className="collapsible-panel__title">{title}</span>
        </div>
        <button
          type="button"
          className="collapsible-panel__toggle"
          onClick={onToggleCollapsed}
          aria-expanded={true}
        >
          {collapseIcon}
          <span className="visually-hidden">{`Collapse ${title}`}</span>
        </button>
      </div>
      <div className="collapsible-panel__body">{children}</div>
    </section>
  )
}
