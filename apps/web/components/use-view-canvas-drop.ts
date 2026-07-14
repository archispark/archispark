import type { Node } from "@xyflow/react"
import { createViewNode } from "@/lib/api"

/** Drag-a-palette-element-onto-the-canvas handlers for ViewCanvasInner. */
export function useViewCanvasDrop({
  viewId,
  elementTypes,
  elementNames,
  screenToFlowPosition,
  setRfNodes,
}: {
  viewId?: string
  elementTypes: Map<string, string>
  elementNames: Map<string, string>
  screenToFlowPosition: (p: { x: number; y: number }) => {
    x: number
    y: number
  }
  setRfNodes: (updater: (nds: Node[]) => Node[]) => void
}) {
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (
      Array.from(e.dataTransfer.types).includes("application/x-archi-element")
    ) {
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
    }
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!viewId) return
    const elementId = e.dataTransfer.getData("application/x-archi-element")
    if (!elementId) return
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const W = 120
    const H = 60
    const x = Math.round(position.x - W / 2)
    const y = Math.round(position.y - H / 2)
    createViewNode(viewId, { element_id: elementId, x, y, w: W, h: H })
      .then((created) => {
        const elementType = created.element_ref
          ? elementTypes.get(created.element_ref)
          : undefined
        const label =
          created.name ||
          (created.element_ref
            ? elementNames.get(created.element_ref)
            : undefined) ||
          ""
        setRfNodes((nds) => [
          ...nds,
          {
            id: created.identifier,
            type: "archi",
            position: { x: created.x ?? x, y: created.y ?? y },
            data: {
              label,
              elementType,
              elementRef: created.element_ref ?? null,
              hasChildren: false,
            },
            style: { width: created.w ?? W, height: created.h ?? H },
          },
        ])
      })
      .catch((err) => console.error("createViewNode failed", err))
  }

  return { onDragOver, onDrop }
}
