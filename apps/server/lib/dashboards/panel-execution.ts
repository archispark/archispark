/**
 * Résolution des paramètres et exécution d'un panneau — porté de
 * `panel-execution.ts` (ofr-archimate-reports/apps/portal), scopé par
 * workspace.
 */
import { getLatestRevision } from "./repository"
import { executeDatasourceQuery, classifyDatasourceFailure } from "./datasource-executors"
import type { PanelContent, PanelResult } from "./contracts"

export class PanelNotFoundError extends Error {
  constructor(dashboardId: string, panelInstanceId: string) {
    super(`Panneau introuvable : ${dashboardId}/${panelInstanceId}`)
    this.name = "PanelNotFoundError"
  }
}

/** Normalized error surfaced by `runPanel` — the caller (API route) only needs to distinguish this from `PanelNotFoundError`, keyed on a stable `code` for the HTTP status. */
export class PanelExecutionError extends Error {
  constructor(
    public readonly code: "compilation" | "configuration" | "query" | "timeout" | "unavailable" | "invalid-result",
    message: string
  ) {
    super(message)
    this.name = "PanelExecutionError"
  }
}

type ParameterValue = string | number | boolean

/** Resolves defaults, requiredness, type and enum values before the datasource call. */
export function resolveParameterValues(
  parameters: PanelContent["parameters"],
  provided: Readonly<Record<string, ParameterValue>>
): Record<string, ParameterValue> {
  const resolved: Record<string, ParameterValue> = {}
  for (const parameter of parameters) {
    const providedValue = provided[parameter.name]
    // An empty query-string field (for example `?driverId=`) means the
    // selector has not been filled in. Treat it as absent rather than as a
    // valid string so required panels never execute with an empty identifier.
    const value = providedValue === "" ? parameter.defaultValue : providedValue ?? parameter.defaultValue
    if (value === undefined) {
      if (parameter.required) {
        throw new PanelExecutionError("compilation", `Le paramètre « ${parameter.name} » est obligatoire.`)
      }
      continue
    }
    const expectedType = parameter.type === "enum" ? "string" : parameter.type
    if (typeof value !== expectedType) {
      throw new PanelExecutionError(
        "compilation",
        `Le paramètre « ${parameter.name} » doit être de type « ${expectedType} ».`
      )
    }
    if (parameter.type === "enum" && parameter.allowedValues && !parameter.allowedValues.includes(value as string)) {
      throw new PanelExecutionError(
        "compilation",
        `La valeur du paramètre « ${parameter.name} » doit figurer dans la liste des valeurs autorisées.`
      )
    }
    resolved[parameter.name] = value
  }
  return resolved
}

/** Converts raw string values (as they arrive from an HTTP query string) to the types declared by `parameters`. Pure and testable without a datasource. */
export function coerceParameterValues(
  rawValues: Readonly<Record<string, string>>,
  parameters: PanelContent["parameters"]
): Record<string, string | number | boolean> {
  const coerced: Record<string, string | number | boolean> = {}
  for (const parameter of parameters) {
    const raw = rawValues[parameter.name]
    if (raw === undefined) continue

    if (parameter.type === "number") {
      const value = Number(raw)
      if (Number.isNaN(value)) {
        throw new PanelExecutionError(
          "compilation",
          `Le paramètre « ${parameter.name} » doit être un nombre, pas « ${raw} ».`
        )
      }
      coerced[parameter.name] = value
    } else if (parameter.type === "boolean") {
      if (raw !== "true" && raw !== "false") {
        throw new PanelExecutionError(
          "compilation",
          `Le paramètre « ${parameter.name} » doit être « true » ou « false », pas « ${raw} ».`
        )
      }
      coerced[parameter.name] = raw === "true"
    } else {
      coerced[parameter.name] = raw
    }
  }
  return coerced
}

export interface RunPanelResult {
  dashboardId: string
  panelInstanceId: string
  dashboardRevision: number
  panel: PanelContent
  result: PanelResult
}

/** Resolves the panel instance embedded in the given dashboard, its query, then runs it and normalizes the result. */
export async function runPanel(
  workspaceId: number,
  organizationId: number,
  dashboardId: string,
  panelInstanceId: string,
  parameterValues: Readonly<Record<string, string | number | boolean>> = {}
): Promise<RunPanelResult> {
  const dashboard = await getLatestRevision(workspaceId, dashboardId)
  if (!dashboard) throw new PanelNotFoundError(dashboardId, panelInstanceId)
  const instance = dashboard.definition.panels.find((candidate) => candidate.id === panelInstanceId)
  if (!instance) throw new PanelNotFoundError(dashboardId, panelInstanceId)
  const panel = instance.panel
  const label = `${dashboardId}/${panelInstanceId}`
  const resolvedParameters = resolveParameterValues(panel.parameters, parameterValues)
  const startedAt = performance.now()
  try {
    const execution = await executeDatasourceQuery(panel.query, panel.resultType, resolvedParameters, organizationId)
    const record = execution.rows[0]

    switch (panel.resultType) {
      case "graph": {
        if (!record || !("nodeIds" in record)) {
          throw new PanelExecutionError("invalid-result", `Le panneau « ${label} » doit retourner la colonne « nodeIds ».`)
        }
        const rawNodeIds = record.nodeIds
        if (!Array.isArray(rawNodeIds) || rawNodeIds.some((id) => typeof id !== "string")) {
          throw new PanelExecutionError("invalid-result", `Le panneau « ${label} » doit retourner une liste de chaînes « nodeIds ».`)
        }
        const nodeIds = [...new Set(rawNodeIds as string[])]
        const rawEmphasizedId = record.emphasizedId
        if (rawEmphasizedId !== undefined && rawEmphasizedId !== null && typeof rawEmphasizedId !== "string") {
          throw new PanelExecutionError("invalid-result", `Le panneau « ${label} » doit retourner une chaîne « emphasizedId ».`)
        }
        const rawRankGroups = record.rankGroups
        let rankGroups: Record<string, string> | undefined
        if (rawRankGroups !== undefined && rawRankGroups !== null) {
          if (
            !Array.isArray(rawRankGroups) ||
            rawRankGroups.some(
              (entry) => !entry || typeof entry.id !== "string" || typeof entry.rankGroup !== "string"
            )
          ) {
            throw new PanelExecutionError(
              "invalid-result",
              `Le panneau « ${label} » doit retourner une liste « rankGroups » de paires id/rankGroup.`
            )
          }
          rankGroups = Object.fromEntries(
            rawRankGroups.map((entry: { id: string; rankGroup: string }) => [entry.id, entry.rankGroup])
          )
        }
        return {
          dashboardId,
          panelInstanceId,
          dashboardRevision: dashboard.revision,
          panel,
          result: {
            resultType: "graph",
            nodeIds,
            nodes: execution.nodes ?? [],
            edges: execution.edges ?? [],
            ...(typeof rawEmphasizedId === "string" ? { emphasizedId: rawEmphasizedId } : {}),
            ...(rankGroups && Object.keys(rankGroups).length > 0 ? { rankGroups } : {}),
          },
        }
      }
      case "table": {
        if (!record || !("rows" in record)) {
          throw new PanelExecutionError("invalid-result", `Le panneau « ${label} » doit retourner la colonne « rows ».`)
        }
        const rawRows = record.rows
        if (!Array.isArray(rawRows)) {
          throw new PanelExecutionError("invalid-result", `Le panneau « ${label} » doit retourner une liste « rows ».`)
        }
        return {
          dashboardId,
          panelInstanceId,
          dashboardRevision: dashboard.revision,
          panel,
          result: { resultType: "table", rows: rawRows as Record<string, unknown>[] },
        }
      }
      case "metrics": {
        if (!record || !("count" in record)) {
          throw new PanelExecutionError("invalid-result", `Le panneau « ${label} » doit retourner un nombre « count ».`)
        }
        const rawCount = record.count
        if (typeof rawCount !== "number") {
          throw new PanelExecutionError("invalid-result", `Le panneau « ${label} » doit retourner un nombre « count ».`)
        }
        return {
          dashboardId,
          panelInstanceId,
          dashboardRevision: dashboard.revision,
          panel,
          result: { resultType: "metrics", count: rawCount },
        }
      }
    }
  } catch (error) {
    if (error instanceof PanelExecutionError) throw error
    const message = error instanceof Error ? error.message : "Erreur de datasource inconnue."
    const code = classifyDatasourceFailure(message)
    console.error(
      JSON.stringify({
        event: "panel_query_failed",
        dashboardId,
        panelInstanceId,
        organizationId,
        code,
        durationMs: Math.round(performance.now() - startedAt),
        error: message,
      })
    )
    throw new PanelExecutionError(code, `Échec d'exécution du panneau « ${label} ».`)
  }
}
