"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { useT } from "@/lib/i18n"

class PanelVisualizationBoundaryInner extends Component<
  { children: ReactNode; t: ReturnType<typeof useT>["t"] },
  { error?: string }
> {
  state: { error?: string } = {}

  static getDerivedStateFromError(error: unknown): { error: string } {
    return { error: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[dashboards] panel visualization error", error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return <p className="text-sm text-destructive">{this.props.t("panels.visualization_error", { error: this.state.error })}</p>
    }
    return this.props.children
  }
}

export function PanelVisualizationBoundary({ children }: { children: ReactNode }) {
  const { t } = useT()
  return <PanelVisualizationBoundaryInner t={t}>{children}</PanelVisualizationBoundaryInner>
}
