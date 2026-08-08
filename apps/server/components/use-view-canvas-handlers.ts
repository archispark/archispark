import { useState } from "react"
import {
  reconnectEdge,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react"
import {
  createRelationship,
  createViewConnection,
  deleteViewConnection,
  deleteViewNode,
  updateViewConnection,
  updateViewNode,
} from "@/lib/api"
import { archimateEdgeStyle } from "@/components/view-canvas-edge"
import type { PendingConnection } from "@/components/view-canvas-pending-connection-dialog"
import { useViewCanvasDrop } from "@/components/use-view-canvas-drop"
import { useT } from "@/lib/i18n"

/** Imperative event handlers (drag/drop, connect, delete, rename) for ViewCanvasInner. */
export function useViewCanvasHandlers({
  viewId,
  elementTypes,
  elementNames,
  rfNodes,
  setRfNodes,
  setRfEdges,
  screenToFlowPosition,
}: {
  viewId?: string
  elementTypes: Map<string, string>
  elementNames: Map<string, string>
  rfNodes: Node[]
  setRfNodes: (updater: (nds: Node[]) => Node[]) => void
  setRfEdges: (updater: (eds: Edge[]) => Edge[]) => void
  screenToFlowPosition: (p: { x: number; y: number }) => {
    x: number
    y: number
  }
}) {
  const { t } = useT()

  const nodeElementRef = (node: Node): string | null => {
    const ref = node.data?.elementRef
    return typeof ref === "string" ? ref : null
  }

  const nodeElementRefById = (id: string): string | null => {
    const node = rfNodes.find((n) => n.id === id)
    return node ? nodeElementRef(node) : null
  }

  const { onDragOver, onDrop } = useViewCanvasDrop({
    viewId,
    elementTypes,
    elementNames,
    screenToFlowPosition,
    setRfNodes,
  })

  const onReconnect = (oldEdge: Edge, newConn: Connection) => {
    setRfEdges((eds) => reconnectEdge(oldEdge, newConn, eds))
    if (!viewId) return
    const body: {
      source?: string
      target?: string
      source_side?: "top" | "right" | "bottom" | "left" | null
      target_side?: "top" | "right" | "bottom" | "left" | null
    } = {}
    if (newConn.source && newConn.source !== oldEdge.source)
      body.source = newConn.source
    if (newConn.target && newConn.target !== oldEdge.target)
      body.target = newConn.target
    if (newConn.sourceHandle && newConn.sourceHandle.startsWith("s-")) {
      body.source_side = newConn.sourceHandle.slice(2) as
        | "top"
        | "right"
        | "bottom"
        | "left"
    }
    if (newConn.targetHandle && newConn.targetHandle.startsWith("t-")) {
      body.target_side = newConn.targetHandle.slice(2) as
        | "top"
        | "right"
        | "bottom"
        | "left"
    }
    updateViewConnection(viewId, oldEdge.id, body).catch((err) =>
      console.error("updateViewConnection reconnect failed", err)
    )
  }

  const onNodeDragStop = (_e: unknown, node: Node) => {
    if (!viewId) return
    // React Flow positions are relative to the parent, but the model stores
    // absolute coordinates. Walk the parent chain to recover the absolute spot.
    let absX = node.position.x
    let absY = node.position.y
    let parentId = node.parentId
    while (parentId) {
      const parent: Node | undefined = rfNodes.find((m) => m.id === parentId)
      if (!parent) break
      absX += parent.position.x
      absY += parent.position.y
      parentId = parent.parentId
    }
    updateViewNode(viewId, node.id, {
      x: Math.round(absX),
      y: Math.round(absY),
    }).catch((err) => console.error("updateViewNode drag failed", err))
  }

  const onNodesDelete = (deleted: Node[]) => {
    if (!viewId) return
    deleted.forEach((n) => {
      deleteViewNode(viewId, n.id).catch((err) =>
        console.error("deleteViewNode failed", err)
      )
    })
  }

  const onEdgesDelete = (deleted: Edge[]) => {
    if (!viewId) return
    deleted.forEach((e) => {
      deleteViewConnection(viewId, e.id).catch((err) =>
        console.error("deleteViewConnection failed", err)
      )
    })
  }

  const [pendingConnection, setPendingConnection] =
    useState<PendingConnection | null>(null)

  const onConnect = (params: {
    source: string | null
    target: string | null
  }) => {
    if (!params.source || !params.target) return
    const sourceElement = nodeElementRefById(params.source)
    const targetElement = nodeElementRefById(params.target)
    if (!sourceElement || !targetElement) return
    setPendingConnection({
      source: params.source,
      target: params.target,
      sourceElement,
      targetElement,
      sourceType: elementTypes.get(sourceElement),
      targetType: elementTypes.get(targetElement),
    })
  }

  const confirmRelationshipType = (type: string) => {
    if (!pendingConnection || !viewId) return
    const { source, target, sourceElement, targetElement } = pendingConnection
    setPendingConnection(null)
    createRelationship({ type, source: sourceElement, target: targetElement })
      .then((rel) =>
        createViewConnection(viewId, {
          relationship_id: rel.identifier,
          source,
          target,
        }).then((conn) => ({ rel, conn }))
      )
      .then(({ rel, conn }) => {
        const archi = archimateEdgeStyle(rel.type)
        setRfEdges((eds) => [
          ...eds,
          {
            id: conn.identifier,
            source,
            target,
            type: "archi",
            animated: Boolean(archi.strokeDasharray),
            data: {
              relationshipType: rel.type,
              relationshipRef: rel.identifier,
            },
          },
        ])
      })
      .catch((err) =>
        console.error("create relationship+connection failed", err)
      )
  }

  const onEdgeDoubleClick = (_e: unknown, edge: Edge) => {
    if (!viewId) return
    const next = window.prompt(
      t("canvas.edge_label_prompt"),
      typeof edge.label === "string" ? edge.label : ""
    )
    if (next === null) return
    updateViewConnection(viewId, edge.id, { name: next || null })
      .then(() => {
        setRfEdges((eds) =>
          eds.map((e) =>
            e.id === edge.id ? { ...e, label: next || undefined } : e
          )
        )
      })
      .catch((err) => console.error("updateViewConnection failed", err))
  }

  const onNodeDoubleClick = (_e: unknown, node: Node) => {
    if (!viewId) return
    const currentLabel =
      typeof node.data?.label === "string" ? (node.data.label as string) : ""
    const next = window.prompt(t("canvas.node_label_prompt"), currentLabel)
    if (next === null) return
    updateViewNode(viewId, node.id, { name: next || null })
      .then(() => {
        setRfNodes((nds) =>
          nds.map((n) =>
            n.id === node.id ? { ...n, data: { ...n.data, label: next } } : n
          )
        )
      })
      .catch((err) => console.error("updateViewNode failed", err))
  }

  return {
    onDragOver,
    onDrop,
    onReconnect,
    onNodeDragStop,
    onNodesDelete,
    onEdgesDelete,
    onConnect,
    confirmRelationshipType,
    onEdgeDoubleClick,
    onNodeDoubleClick,
    pendingConnection,
    setPendingConnection,
  }
}
