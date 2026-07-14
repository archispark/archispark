"use client"

import { useContext, useState } from "react"
import type React from "react"
import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react"
import { deleteViewConnection, updateViewConnection } from "@/lib/api"
import { ViewIdContext } from "@/components/view-canvas-context"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { useT } from "@/lib/i18n"

export interface ArchiEdgeStyle {
  strokeDasharray?: string
  markerStart?: string
  markerEnd?: string
}

export function archimateEdgeStyle(type?: string): ArchiEdgeStyle {
  switch (type) {
    case "Composition":
      return { markerStart: "url(#archi-diamond-filled)" }
    case "Aggregation":
      return { markerStart: "url(#archi-diamond-open)" }
    case "Assignment":
      return {
        markerStart: "url(#archi-dot-filled)",
        markerEnd: "url(#archi-arrow-open)",
      }
    case "Realization":
      return { markerEnd: "url(#archi-triangle-open)", strokeDasharray: "6 3" }
    case "Serving":
    case "UsedBy":
      return { markerEnd: "url(#archi-arrow-open)" }
    case "Triggering":
      return { markerEnd: "url(#archi-arrow-filled)" }
    case "Flow":
      return { markerEnd: "url(#archi-arrow-filled)", strokeDasharray: "6 3" }
    case "Access":
      return { markerEnd: "url(#archi-arrow-open)", strokeDasharray: "4 3" }
    case "Influence":
      return { markerEnd: "url(#archi-arrow-open)", strokeDasharray: "6 3" }
    case "Specialization":
      return { markerEnd: "url(#archi-triangle-open)" }
    case "Association":
    default:
      return {}
  }
}

export function ArchiEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  selected,
}: EdgeProps) {
  const viewId = useContext(ViewIdContext)
  const { t } = useT()
  const { setEdges } = useReactFlow()
  const [confirmDeleteEdge, setConfirmDeleteEdge] = useState(false)
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const relType = (data?.relationshipType as string | undefined) ?? undefined
  const archi = archimateEdgeStyle(relType)
  const strokeStyle: React.CSSProperties = {
    stroke: selected ? "#1A87FF" : "#222",
    strokeWidth: selected ? 1.8 : 1.2,
    fill: "none",
    ...(archi.strokeDasharray
      ? { strokeDasharray: archi.strokeDasharray }
      : {}),
  }

  const removeEdge = () => {
    if (viewId) {
      deleteViewConnection(viewId, id).catch((err) =>
        console.error("deleteViewConnection failed", err)
      )
    }
    setEdges((eds) => eds.filter((e) => e.id !== id))
  }

  const renameEdge = () => {
    if (!viewId) return
    const next = window.prompt(
      t("canvas.edge_label_prompt"),
      typeof label === "string" ? label : ""
    )
    if (next === null) return
    updateViewConnection(viewId, id, { name: next || null })
      .then(() => {
        setEdges((eds) =>
          eds.map((e) => (e.id === id ? { ...e, label: next || undefined } : e))
        )
      })
      .catch((err) => console.error("updateViewConnection failed", err))
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={strokeStyle}
        markerStart={archi.markerStart}
        markerEnd={archi.markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
          className="nodrag nopan"
        >
          {label ? (
            <span
              style={{
                background: "#fff",
                padding: "1px 4px",
                fontSize: 10,
                border: `1px solid ${selected ? "#1A87FF" : "#ddd"}`,
                borderRadius: 3,
              }}
            >
              {label}
            </span>
          ) : null}
          {selected ? (
            <>
              <button
                type="button"
                onClick={renameEdge}
                title={t("canvas.rename")}
                style={{
                  background: "#fff",
                  border: "1px solid #1A87FF",
                  borderRadius: 3,
                  fontSize: 9,
                  padding: "1px 4px",
                  cursor: "pointer",
                  color: "#1A87FF",
                }}
              >
                {relType ?? "Association"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteEdge(true)}
                title={t("canvas.remove_from_view")}
                aria-label={t("canvas.remove_from_view")}
                style={{
                  background: "#FF1D5D",
                  border: "1px solid #FF1D5D",
                  color: "#fff",
                  borderRadius: 3,
                  width: 16,
                  height: 16,
                  fontSize: 11,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ×
              </button>
            </>
          ) : null}
        </div>
      </EdgeLabelRenderer>
      <Dialog
        open={confirmDeleteEdge}
        onOpenChange={(o) => !o && setConfirmDeleteEdge(false)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("canvas.remove_from_view")}</DialogTitle>
            <DialogDescription>{t("common.irreversible")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDeleteEdge(false)
                removeEdge()
              }}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
