import { NextResponse, type NextRequest } from "next/server"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import { resolveActiveContext } from "@/lib/archimate/access"
import { AppError, NotFoundError, ValidationError } from "@/lib/archimate/errors"
import { getLatestRevision } from "@/lib/dashboards/repository"
import {
  coerceParameterValues,
  PanelExecutionError,
  PanelNotFoundError,
  runPanel,
} from "@/lib/dashboards/panel-execution"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ dashboardId: string; panelInstanceId: string }> }

function toHttpError(error: unknown): AppError {
  if (error instanceof PanelNotFoundError) return new NotFoundError(error.message)
  if (error instanceof PanelExecutionError) {
    switch (error.code) {
      case "compilation":
        return new ValidationError(error.message)
      case "configuration":
      case "invalid-result":
        return new AppError(error.message, 500)
      case "timeout":
      case "unavailable":
      case "query":
        return new AppError(error.message, 502)
    }
  }
  return new AppError(error instanceof Error ? error.message : "Erreur inconnue.", 500)
}

/** Executes one panel instance of a dashboard's latest revision. Query-string values are declared-type-coerced against the panel's parameters before execution. */
export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, auth, { params }: Ctx) => {
    const { organizationId, workspaceId } = await resolveActiveContext(auth.user, "read", auth.tokenContext)
    const { dashboardId, panelInstanceId } = await params
    const dashboard = await getLatestRevision(workspaceId, dashboardId)
    if (!dashboard) throw new NotFoundError(`Dashboard introuvable : ${dashboardId}`)
    const instance = dashboard.definition.panels.find((candidate) => candidate.id === panelInstanceId)
    if (!instance) throw new NotFoundError(`Panneau introuvable : ${panelInstanceId}`)

    const rawValues = Object.fromEntries(req.nextUrl.searchParams)
    try {
      const parameterValues = coerceParameterValues(rawValues, instance.panel.parameters)
      const result = await runPanel(workspaceId, organizationId, dashboardId, panelInstanceId, parameterValues)
      return NextResponse.json(result.result)
    } catch (error) {
      throw toHttpError(error)
    }
  })
)
