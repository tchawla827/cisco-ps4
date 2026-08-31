import type { KeyboardEvent } from 'react'

import type { DepartmentView, TransferImpactView } from '../types/department'
import { layoutTree, NODE_H, NODE_W } from './orgTreeLayout'

interface OrgTreeProps {
  department: DepartmentView
  selectedId: string | null
  previewImpact: TransferImpactView | null
  onSelect: (employeeId: string) => void
}

function formatPayroll(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

function selectOnActivation(event: KeyboardEvent<SVGGElement>, employeeId: string, onSelect: (id: string) => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onSelect(employeeId)
  }
}

export function OrgTree({ department, selectedId, previewImpact, onSelect }: OrgTreeProps) {
  const layout = layoutTree(department)
  const employeesById = new Map(department.employees.map((employee) => [employee.employee_id, employee]))
  const impact = previewImpact ?? department.last_successful_transfer
  const movedIds = new Set(impact?.moved_subtree_ids ?? [])
  const changedIds = new Set(impact?.changed_rollup_ids ?? [])
  const isPreview = previewImpact !== null

  return (
    <div className="org-tree-scroll">
      <svg
        className="org-tree"
        role="tree"
        aria-label="Department reporting tree"
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

          return (
            <g
              key={employee.employee_id}
              className={nodeClassName}
              role="treeitem"
              tabIndex={0}
              aria-selected={employee.employee_id === selectedId}
              aria-label={`${employee.employee_id}, ${employee.name}, ${employee.team_headcount} headcount, ${formatPayroll(employee.team_payroll)} payroll${statusDescription}`}
              transform={`translate(${node.x} ${node.y})`}
              onClick={() => onSelect(employee.employee_id)}
              onKeyDown={(event) => selectOnActivation(event, employee.employee_id, onSelect)}
            >
              <rect width={NODE_W} height={NODE_H} rx="4" />
              <text className="org-tree__id" x="12" y="20">{employee.employee_id}</text>
              <text className="org-tree__name" x="12" y="43" textLength="156" lengthAdjust="spacingAndGlyphs">{employee.name}</text>
              <text className="org-tree__metrics" x="12" y="68" textLength="156" lengthAdjust="spacingAndGlyphs">
                {`HC ${employee.team_headcount} · ${formatPayroll(employee.team_payroll)}`}
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
