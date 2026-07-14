import type { Node } from "@xyflow/react"
import type { NodeOut } from "@/lib/api"

export interface NodeRect {
  x: number
  y: number
  w: number
  h: number
}

export function pickHandles(
  src: NodeRect,
  tgt: NodeRect
): { sourceHandle: string; targetHandle: string } {
  const sx = src.x + src.w / 2
  const sy = src.y + src.h / 2
  const tx = tgt.x + tgt.w / 2
  const ty = tgt.y + tgt.h / 2
  const dx = tx - sx
  const dy = ty - sy

  let srcSide: string
  let tgtSide: string

  if (Math.abs(dx) >= Math.abs(dy)) {
    srcSide = dx >= 0 ? "right" : "left"
    tgtSide = dx >= 0 ? "left" : "right"
  } else {
    srcSide = dy >= 0 ? "bottom" : "top"
    tgtSide = dy >= 0 ? "top" : "bottom"
  }

  return { sourceHandle: `s-${srcSide}`, targetHandle: `t-${tgtSide}` }
}

export const HIDDEN_ELEMENT_TYPES = new Set(["AndJunction"])

export function flattenNodes(
  nodes: NodeOut[] | null | undefined,
  elementNames: Map<string, string>,
  elementTypes: Map<string, string>,
  parentId?: string,
  parentAbsX = 0,
  parentAbsY = 0
): Node[] {
  if (!nodes) return []
  return nodes.flatMap((n) => {
    const resolvedName =
      n.name ||
      (n.element_ref ? elementNames.get(n.element_ref) : undefined) ||
      ""
    const elementType = n.element_ref
      ? elementTypes.get(n.element_ref)
      : undefined
    if (elementType && HIDDEN_ELEMENT_TYPES.has(elementType)) return []
    const hasChildren = Boolean(n.children && n.children.length > 0)
    // Model coordinates are absolute (from the diagram top-left), but React Flow
    // treats a child node's `position` as relative to its parent. Subtract the
    // parent's absolute origin so nested nodes land in the right spot.
    const absX = n.x ?? 0
    const absY = n.y ?? 0
    const node: Node = {
      id: n.identifier,
      type: "archi",
      position: { x: absX - parentAbsX, y: absY - parentAbsY },
      data: {
        label: resolvedName,
        elementType,
        elementRef: n.element_ref ?? null,
        hasChildren,
      },
      style: { width: n.w ?? undefined, height: n.h ?? undefined },
      ...(parentId
        ? { parentId, extent: "parent" as const, expandParent: true }
        : {}),
    }
    return [
      node,
      ...flattenNodes(
        n.children,
        elementNames,
        elementTypes,
        n.identifier,
        absX,
        absY
      ),
    ]
  })
}
