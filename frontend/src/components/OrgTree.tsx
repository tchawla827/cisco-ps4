import type { KeyboardEvent } from 'react'

import { formatCurrency } from '../format'
import type { DepartmentView, TransferImpactView } from '../types/department'
import { layoutTree, NODE_H, NODE_W } from './orgTreeLayout'

interface OrgTreeProps {
  department: DepartmentView
  selectedId?: string | null
  previewImpact?: TransferImpactView | null
  onSelect?: (employeeId: string) => void
  readOnly?: boolean
  ariaLabel?: string
}

function selectOnActivation(event: KeyboardEvent<SVGGElement>, employeeId: string, onSelect: (id: string) => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onSelect(employeeId)
  }
}

export function OrgTree({
  department,
  selectedId = null,
  previewImpact = null,
  onSelect,
  readOnly = false,
  ariaLabel = 'Department reporting tree',
}: OrgTreeProps) {
  const layout = layoutTree(department)
  const employeesById = new Map(department.employees.map((employee) => [employee.employee_id, employee]))
  const impact = previewImpact ?? department.last_successful_transfer
  const movedIds = new Set(impact?.moved_subtree_ids ?? [])
  const changedIds = new Set(impact?.changed_rollup_ids ?? [])
  const isPreview = previewImpact !== null
  const isInteractive = !readOnly && onSelect !== undefined

  return (
    <div className="org-tree-scroll">
      <svg
        className="org-tree"
        role={isInteractive ? 'tree' : 'img'}
        aria-label={ariaLabel}
        viewBox={`-24 -24 ${layout.width + 48} ${layout.height + 48}`}
        preserveAspectRatio="xMidYMin meet"
      >
        <g className="org-tree__edges" aria-hidden="true">
          {layout.edges.map((edge) => <path key={`${edge.parentId}-${edge.childId}`} d={edge.path} />)}
        </g>
        {layout.nodes.map((node) => {
          const employee = employeesById.get(node.id)
          if (!employee) return null
          const markers = [
            employee.employee_id === department.root_id ? { symbol: '★', name: 'root' } : null,
            employee.employee_id === selectedId ? { symbol: '●', name: 'selected' } : null,
            movedIds.has(employee.employee_id) ? { symbol: '↪', name: 'moved' } : null,
            changedIds.has(employee.employee_id) ? { symbol: 'Δ', name: 'changed' } : null,
          ].filter((marker): marker is { symbol: string; name: string } => marker !== null)
          const nodeClassName = [
            'org-tree__node',
            employee.employee_id === selectedId ? 'org-tree__node--selected' : '',
            isPreview && (movedIds.has(employee.employee_id) || changedIds.has(employee.employee_id)) ? 'org-tree__node--preview' : '',
          ].filter(Boolean).join(' ')
          const statusDescription = markers.length > 0 ? `, ${markers.map((marker) => marker.name).join(', ')}` : ''
          const managerDescription = employee.manager_id === null ? ', root employee' : `, reports to ${employee.manager_id}`

          return (
            <g
              key={employee.employee_id}
              className={nodeClassName}
              role={isInteractive ? 'treeitem' : undefined}
              tabIndex={isInteractive ? 0 : undefined}
              aria-selected={isInteractive ? employee.employee_id === selectedId : undefined}
              aria-label={`${employee.employee_id}, ${employee.name}, ${employee.team_headcount} headcount, ${formatCurrency(employee.team_payroll)} payroll${managerDescription}${statusDescription}`}
              transform={`translate(${node.x} ${node.y})`}
              onClick={isInteractive ? () => onSelect(employee.employee_id) : undefined}
              onKeyDown={isInteractive ? (event) => selectOnActivation(event, employee.employee_id, onSelect) : undefined}
            >
              <rect width={NODE_W} height={NODE_H} rx="4" />
              <text className="org-tree__id" x="12" y="20">{employee.employee_id}</text>
              <text className="org-tree__name" x="12" y="43" textLength="156" lengthAdjust="spacingAndGlyphs">{employee.name}</text>
              <text className="org-tree__metrics" x="12" y="68" textLength="156" lengthAdjust="spacingAndGlyphs">
                {`HC ${employee.team_headcount} · ${formatCurrency(employee.team_payroll)}`}
              </text>
              {markers.length > 0 ? (
                <text className="org-tree__markers" x="168" y="20" textAnchor="end" aria-hidden="true">
                  {markers.map((marker) => <tspan key={marker.name} className={`org-tree__marker--${marker.name}`}>{marker.symbol} </tspan>)}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
