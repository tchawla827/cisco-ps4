import { ChevronDown, ChevronUp, Maximize2, Minus, Plus } from 'lucide-react'
import { type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent, useEffect, useRef, useState } from 'react'
import { DndContext, type DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

import { formatCurrency } from '../format'
import type { DepartmentView, TransferImpactView } from '../types/department'
import { layoutTree } from './orgTreeLayout'

interface OrgTreeCanvasProps {
  department: DepartmentView
  selectedId: string | null
  previewImpact: TransferImpactView | null
  collapsedIds: ReadonlySet<string>
  onSelect: (employeeId: string) => void
  onToggleCollapse: (employeeId: string) => void
  onProposeTransfer: (employeeId: string, newManagerId: string) => void
  ariaLabel?: string
}

const MIN_SCALE = 0.4
const MAX_SCALE = 2

export function resolveDrop(
  activeId: string | number,
  overId: string | number | null | undefined,
): { employeeId: string; managerId: string } | null {
  if (overId === null || overId === undefined) return null
  const employeeId = String(activeId)
  const managerId = String(overId)
  if (employeeId === managerId) return null
  return { employeeId, managerId }
}

// aria-label wording below is based on the old SVG OrgTree.tsx's format
// (`${id}, ${name}, ${headcount} headcount, ${payroll} payroll${manager}${status}`),
// with `role` inserted after `name` so the visible card (which drops role from
// its metrics line to make room for the full payroll figure) still exposes it
// accessibly. App.test.tsx's role="treeitem"/role="tree" assertions match with
// substring/regex patterns, so this stays unchanged against this HTML-card canvas.
function OrgNodeCard({
  employeeId,
  name,
  role,
  managerId,
  headcount,
  payroll,
  x,
  y,
  isRoot,
  isSelected,
  isMoved,
  isChanged,
  hasChildren,
  isCollapsed,
  scale,
  onSelect,
  onToggleCollapse,
}: {
  employeeId: string
  name: string
  role: string
  managerId: string | null
  headcount: number
  payroll: number
  x: number
  y: number
  isRoot: boolean
  isSelected: boolean
  isMoved: boolean
  isChanged: boolean
  hasChildren: boolean
  isCollapsed: boolean
  scale: number
  onSelect: (employeeId: string) => void
  onToggleCollapse: (employeeId: string) => void
}) {
  const draggable = useDraggable({ id: employeeId, disabled: isRoot })
  const droppable = useDroppable({ id: employeeId })
  // draggable.transform is a screen-pixel delta from dnd-kit's pointer sensor,
  // but this card lives inside .tree-stage__world which has scale(view.scale)
  // applied. Dividing by scale converts the screen-pixel delta back into the
  // world's own (pre-scale) coordinate space so the card tracks the cursor
  // instead of drifting at non-1x zoom.
  const dragStyle = draggable.transform
    ? {
        transform: CSS.Translate.toString({
          x: draggable.transform.x / scale,
          y: draggable.transform.y / scale,
          scaleX: 1,
          scaleY: 1,
        }),
      }
    : undefined

  const setRefs = (node: HTMLDivElement | null) => {
    draggable.setNodeRef(node)
    droppable.setNodeRef(node)
  }

  const className = [
    'org-node-card',
    isSelected ? 'org-node-card--selected' : '',
    droppable.isOver ? 'org-node-card--over' : '',
    draggable.isDragging ? 'org-node-card--dragging' : '',
  ].filter(Boolean).join(' ')

  const markers = [
    isRoot ? 'root' : null,
    isSelected ? 'selected' : null,
    isMoved ? 'moved' : null,
    isChanged ? 'changed' : null,
  ].filter((marker): marker is string => marker !== null)
  const statusDescription = markers.length > 0 ? `, ${markers.join(', ')}` : ''
  const managerDescription = managerId === null ? ', root employee' : `, reports to ${managerId}`
  const cardLabel = `${employeeId}, ${name}, ${role}, ${headcount} headcount, ${formatCurrency(payroll)} payroll${managerDescription}${statusDescription}`

  return (
    <div className="org-node-slot" style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}>
      {/*
        IMPORTANT: spread dnd-kit's listeners/attributes FIRST, then the
        explicit role/tabIndex/aria-selected/aria-label/onClick/onKeyDown
        props AFTER — dnd-kit's `attributes` object includes its own
        `role="button"` and `tabIndex`, and in JSX a later prop always wins
        over an earlier one with the same name. If this element ever ends up
        with role="button" instead of role="treeitem", the ordering below
        was reversed by mistake.
      */}
      <div
        ref={setRefs}
        className={className}
        style={dragStyle}
        {...draggable.listeners}
        {...draggable.attributes}
        role="treeitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-label={cardLabel}
        onClick={() => onSelect(employeeId)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect(employeeId)
          }
        }}
      >
        <span className="org-node-card__id" aria-hidden="true">
          <span>{employeeId}</span>
          {isRoot ? ' ★' : ''}
          {isMoved ? ' ↪' : ''}
          {isChanged ? ' Δ' : ''}
        </span>
        <span className="org-node-card__name" aria-hidden="true">{name}</span>
        <span className="org-node-card__metrics" aria-hidden="true">HC {headcount} · {formatCurrency(payroll)}</span>
      </div>
      {hasChildren ? (
        <button
          type="button"
          className="org-node-collapse"
          onClick={(event: ReactMouseEvent) => {
            event.stopPropagation()
            onToggleCollapse(employeeId)
          }}
        >
          {isCollapsed ? <ChevronDown aria-hidden="true" size={13} /> : <ChevronUp aria-hidden="true" size={13} />}
          <span className="visually-hidden">{`${isCollapsed ? 'Expand' : 'Collapse'} ${name}`}</span>
        </button>
      ) : null}
    </div>
  )
}

export function OrgTreeCanvas({
  department,
  selectedId,
  previewImpact,
  collapsedIds,
  onSelect,
  onToggleCollapse,
  onProposeTransfer,
  ariaLabel = 'Department reporting tree',
}: OrgTreeCanvasProps) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const panState = useRef<{ panning: boolean; startX: number; startY: number; originX: number; originY: number }>({
    panning: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const viewportRef = useRef<HTMLDivElement>(null)

  const layout = layoutTree(department, collapsedIds)
  const employeesById = new Map(department.employees.map((employee) => [employee.employee_id, employee]))
  const impact = previewImpact ?? department.last_successful_transfer
  const movedIds = new Set(impact?.moved_subtree_ids ?? [])
  const changedIds = new Set(impact?.changed_rollup_ids ?? [])

  const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))

  const handleFitToScreen = () => {
    const viewport = viewportRef.current
    if (!viewport || viewport.clientWidth === 0 || viewport.clientHeight === 0) return
    if (layout.width === 0 || layout.height === 0) return
    const scale = clampScale(Math.min(
      viewport.clientWidth / layout.width,
      viewport.clientHeight / layout.height,
    ))
    const x = (viewport.clientWidth - layout.width * scale) / 2
    const y = (viewport.clientHeight - layout.height * scale) / 2
    setView({ scale, x, y })
  }

  // Fit the whole tree into view by default (rather than the raw {scale:1,x:0,y:0}
  // origin, which for wide trees frames only the leftmost branch and leaves the
  // root off-screen). Re-fits whenever the loaded department changes; guarded
  // against firing before the viewport has a real rendered size.
  useEffect(() => {
    handleFitToScreen()
    // handleFitToScreen intentionally omitted from deps: it closes over `layout`,
    // which is recomputed every render, and depending on it would re-fit (and
    // stomp any manual zoom/pan) on every collapse/select/preview change, not
    // just on a genuinely new department.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department.scenario, department.root_id])

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    setView((current) => ({ ...current, scale: clampScale(current.scale - event.deltaY * 0.001) }))
  }

  const handleViewportMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    // Pan starts on the empty viewport background or on the world layer's own
    // empty space (the world div spans the tree's full bounding box, so most
    // of the visible canvas is "inside" it without being on a card/button).
    // Cards and buttons are excluded because dnd-kit's listeners on the card
    // itself intercept those pointer events before they'd reach this handler.
    const isBackground = target === event.currentTarget || target.classList.contains('tree-stage__world')
    if (!isBackground) return
    panState.current = {
      panning: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    }
  }

  const handleViewportMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!panState.current.panning) return
    const dx = event.clientX - panState.current.startX
    const dy = event.clientY - panState.current.startY
    setView((current) => ({ ...current, x: panState.current.originX + dx, y: panState.current.originY + dy }))
  }

  const stopPanning = () => {
    panState.current.panning = false
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const drop = resolveDrop(event.active.id, event.over?.id ?? null)
    if (drop) onProposeTransfer(drop.employeeId, drop.managerId)
  }

  return (
    <div className="tree-stage">
      <div className="tree-stage__toolbar" aria-label="Tree zoom controls">
        <button type="button" className="icon-command" onClick={() => setView((current) => ({ ...current, scale: clampScale(current.scale - 0.2) }))} title="Zoom out">
          <Minus aria-hidden="true" size={16} />
        </button>
        <button type="button" className="icon-command" onClick={() => setView((current) => ({ ...current, scale: clampScale(current.scale + 0.2) }))} title="Zoom in">
          <Plus aria-hidden="true" size={16} />
        </button>
        <button type="button" className="icon-command" onClick={handleFitToScreen} title="Fit to screen">
          <Maximize2 aria-hidden="true" size={16} />
        </button>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          className="tree-stage__viewport"
          ref={viewportRef}
          onWheel={handleWheel}
          onMouseDown={handleViewportMouseDown}
          onMouseMove={handleViewportMouseMove}
          onMouseUp={stopPanning}
          onMouseLeave={stopPanning}
        >
          <div
            className="tree-stage__world"
            role="tree"
            aria-label={ariaLabel}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, width: layout.width, height: layout.height }}
          >
            <svg className="tree-stage__edges" width={layout.width} height={layout.height} aria-hidden="true">
              {layout.edges.map((edge) => <path key={`${edge.parentId}-${edge.childId}`} d={edge.path} />)}
            </svg>
            {layout.nodes.map((node) => {
              const employee = employeesById.get(node.id)
              if (!employee) return null
              return (
                <OrgNodeCard
                  key={employee.employee_id}
                  employeeId={employee.employee_id}
                  name={employee.name}
                  role={employee.role}
                  managerId={employee.manager_id}
                  headcount={employee.team_headcount}
                  payroll={employee.team_payroll}
                  x={node.x}
                  y={node.y}
                  isRoot={employee.employee_id === department.root_id}
                  isSelected={employee.employee_id === selectedId}
                  isMoved={movedIds.has(employee.employee_id)}
                  isChanged={changedIds.has(employee.employee_id)}
                  hasChildren={employee.children_ids.length > 0}
                  isCollapsed={collapsedIds.has(employee.employee_id)}
                  scale={view.scale}
                  onSelect={onSelect}
                  onToggleCollapse={onToggleCollapse}
                />
              )
            })}
          </div>
        </div>
      </DndContext>
    </div>
  )
}
