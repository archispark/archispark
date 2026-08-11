"use client"

import type { ReactNode } from "react"
import { Panel } from "@xyflow/react"

/** Top-right stack of canvas action buttons (filters, appearance, fullscreen, ...). */
export function CanvasToolbarPanel({
  className = "flex flex-col items-end gap-1",
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <Panel position="top-right">
      <div className={className}>{children}</div>
    </Panel>
  )
}
