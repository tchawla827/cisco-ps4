import type { DepartmentView } from '../types/department'

export const NODE_W = 180
export const NODE_H = 88
export const H_GAP = 36
export const V_GAP = 52

export interface TreeNodePosition {
  id: string
  x: number
  y: number
}

export interface TreeEdge {
  parentId: string
  childId: string
  path: string
}

export interface TreeLayout {
  nodes: TreeNodePosition[]
  edges: TreeEdge[]
  width: number
  height: number
}

export function layoutTree(department: DepartmentView): TreeLayout {
  const employeesById = new Map(department.employees.map((employee) => [employee.employee_id, employee]))
  const positions = new Map<string, TreeNodePosition>()
  const orderedIds: string[] = []
  const edges: TreeEdge[] = []
  let slot = 0
  let maxDepth = 0

  const placeNode = (id: string, depth: number): TreeNodePosition | null => {
    const employee = employeesById.get(id)
    if (!employee) return null

    const childPositions = employee.children_ids
      .map((childId) => placeNode(childId, depth + 1))
      .filter((position): position is TreeNodePosition => position !== null)
    const x = childPositions.length === 0
      ? slot++ * (NODE_W + H_GAP)
      : (childPositions[0].x + childPositions[childPositions.length - 1].x) / 2
    const position = { id, x, y: depth * (NODE_H + V_GAP) }

    positions.set(id, position)
    orderedIds.push(id)
    maxDepth = Math.max(maxDepth, depth)
    return position
  }

  placeNode(department.root_id, 0)

  const nodes = orderedIds
    .map((id) => positions.get(id))
    .filter((position): position is TreeNodePosition => position !== undefined)

  for (const parentId of orderedIds) {
    const parent = employeesById.get(parentId)
    const parentPosition = positions.get(parentId)
    if (!parent || !parentPosition) continue

    for (const childId of parent.children_ids) {
      const childPosition = positions.get(childId)
      if (!childPosition) continue
      const parentCenter = parentPosition.x + NODE_W / 2
      const childCenter = childPosition.x + NODE_W / 2
      const parentBottom = parentPosition.y + NODE_H
      const middle = parentBottom + V_GAP / 2

      edges.push({
        parentId,
        childId,
        path: `M ${parentCenter},${parentBottom} V ${middle} H ${childCenter} V ${childPosition.y}`,
      })
    }
  }

  return {
    nodes,
    edges,
    width: Math.max(NODE_W, slot * NODE_W + Math.max(0, slot - 1) * H_GAP),
    height: Math.max(NODE_H, (maxDepth + 1) * NODE_H + maxDepth * V_GAP),
  }
}
