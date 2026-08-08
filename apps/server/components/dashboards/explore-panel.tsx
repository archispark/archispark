"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Download, Play, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { GraphView } from "@/components/dashboards/graph-view"
import { PanelTable } from "@/components/dashboards/panel-table"
import { useRunExploreQuery } from "@/lib/queries/dashboards"
import type { ExploreQueryResult } from "@/lib/api/dashboards"
import { useT } from "@/lib/i18n"

const HISTORY_KEY = "archispark-explore-history-v1"
const HISTORY_LIMIT = 20

interface ExploreHistoryEntry {
  id: string
  query: string
  parameters: string
  executedAt: string
  durationMs?: number
  status: "success" | "error"
}

function queryPresets(t: ReturnType<typeof useT>["t"]) {
  return [
    {
      label: t("explore.preset_elements"),
      description: t("explore.preset_elements_desc"),
      query: "MATCH (element:Element {organizationId: $organizationId})\nRETURN element\nLIMIT 50",
    },
    {
      label: t("explore.preset_relationships"),
      description: t("explore.preset_relationships_desc"),
      query:
        "MATCH (source:Element {organizationId: $organizationId})-[relation]->(target:Element {organizationId: $organizationId})\nRETURN source, relation, target\nLIMIT 50",
    },
    {
      label: t("explore.preset_elements_by_type"),
      description: t("explore.preset_elements_by_type_desc"),
      query:
        "MATCH (element:Element {organizationId: $organizationId})\nRETURN element.type AS Type, count(element) AS Count\nORDER BY Count DESC\nLIMIT 50",
    },
  ] as const
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ""
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }
  return [columns.join(","), ...rows.map((row) => columns.map((c) => escape(row[c])).join(","))].join("\n")
}

export function ExplorePanel() {
  const { t, locale } = useT()
  const QUERY_PRESETS = queryPresets(t)
  const [query, setQuery] = useState<string>(QUERY_PRESETS[0].query)
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [parameters, setParameters] = useState("{}")
  const [paramError, setParamError] = useState<string>()
  const [history, setHistory] = useState<ExploreHistoryEntry[]>([])
  const runExplore = useRunExploreQuery()
  const result = runExplore.data
  const error = paramError ?? (runExplore.error ? (runExplore.error as Error).message : undefined)
  const loading = runExplore.isPending

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as unknown
      if (Array.isArray(stored)) setHistory(stored.slice(0, HISTORY_LIMIT) as ExploreHistoryEntry[])
    } catch {
      localStorage.removeItem(HISTORY_KEY)
    }
  }, [])

  const addHistory = (entry: ExploreHistoryEntry) =>
    setHistory((current) => {
      const next = [entry, ...current].slice(0, HISTORY_LIMIT)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        // L'exécution reste valide si le stockage privé ou le quota du navigateur refuse l'écriture.
      }
      return next
    })

  const execute = async (event: FormEvent) => {
    event.preventDefault()
    setParamError(undefined)
    let parsedParameters: unknown
    try {
      parsedParameters = JSON.parse(parameters)
    } catch {
      setParamError(t("explore.invalid_params_json"))
      return
    }
    if (!parsedParameters || typeof parsedParameters !== "object" || Array.isArray(parsedParameters)) {
      setParamError(t("explore.params_must_be_object"))
      return
    }

    try {
      const body: ExploreQueryResult = await runExplore.mutateAsync({
        query,
        parameters: parsedParameters as Record<string, unknown>,
      })
      addHistory({ id: crypto.randomUUID(), query, parameters, executedAt: new Date().toISOString(), durationMs: body.durationMs, status: "success" })
    } catch {
      addHistory({ id: crypto.randomUUID(), query, parameters, executedAt: new Date().toISOString(), status: "error" })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("sidebar.explore")}</h1>
        <p className="mt-1 text-muted-foreground">{t("explore.subtitle")}</p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3">
          <h2 className="font-semibold text-card-foreground">{t("explore.query_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("explore.query_hint")}</p>
        </div>
        <form onSubmit={execute} className="flex flex-col gap-3">
          <label className="flex max-w-sm flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">{t("explore.preset_label")}</span>
            <select
              onChange={(event) => {
                const index = Number(event.target.value)
                setSelectedPreset(index)
                setQuery(QUERY_PRESETS[index]!.query)
              }}
              className="rounded-md border border-border bg-background px-3 py-1.5"
              value={selectedPreset}
            >
              {QUERY_PRESETS.map((preset, index) => (
                <option key={preset.label} value={index}>
                  {preset.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">{QUERY_PRESETS[selectedPreset]!.description}</span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Cypher</span>
            <Textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={8} spellCheck={false} className="font-mono text-xs" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">{t("explore.parameters_json")}</span>
            <Textarea value={parameters} onChange={(event) => setParameters(event.target.value)} rows={3} spellCheck={false} className="font-mono text-xs" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={loading || !query.trim()}>
              <Play size={16} />
              {loading ? t("explore.executing") : t("explore.execute")}
            </Button>
            {result && (
              <span className="text-xs text-muted-foreground">
                {t("explore.result_summary", {
                  n: result.rows.length,
                  s: result.rows.length !== 1 ? "s" : "",
                  ms: result.durationMs,
                })}
                {result.truncated ? ` · ${t("explore.result_truncated")}` : ""}
              </span>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{t("explore.execution_error", { error })}</p>}
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-card-foreground">{t("explore.history_title")}</h2>
            <p className="text-sm text-muted-foreground">{t("explore.history_hint", { n: HISTORY_LIMIT })}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={history.length === 0}
            onClick={() => {
              localStorage.removeItem(HISTORY_KEY)
              setHistory([])
            }}
          >
            <Trash2 size={15} />
            {t("explore.history_clear")}
          </Button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("explore.history_empty")}</p>
        ) : (
          <div className="flex max-h-64 flex-col gap-1 overflow-auto">
            {history.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setQuery(entry.query)
                  setParameters(entry.parameters)
                }}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
              >
                <span className="min-w-0 truncate font-mono text-foreground">{entry.query.replaceAll("\n", " ")}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.status === "success" ? `${entry.durationMs} ms` : t("explore.history_error")} ·{" "}
                  {new Date(entry.executedAt).toLocaleString(locale)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3">
          <h2 className="font-semibold text-card-foreground">{t("explore.graph_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("explore.graph_hint")}</p>
        </div>
        {result?.nodes.length ? (
          <GraphView
            nodes={result.nodes.map((n) => ({ id: n.id, label: n.name, type: n.type }))}
            edges={result.edges}
            height={560}
            nodeHref={(id) => `/elements/${encodeURIComponent(id)}`}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("explore.graph_empty")}</p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-card-foreground">{t("explore.table_title")}</h2>
            <p className="text-sm text-muted-foreground">{t("explore.table_hint")}</p>
          </div>
          {result && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => downloadText("explore.json", JSON.stringify(result.rows, null, 2), "application/json")}>
                <Download size={15} />
                JSON
              </Button>
              <Button type="button" variant="outline" onClick={() => downloadText("explore.csv", rowsToCsv(result.rows), "text/csv;charset=utf-8")}>
                <Download size={15} />
                CSV
              </Button>
            </div>
          )}
        </div>
        {result ? <PanelTable rows={result.rows} /> : <p className="text-sm text-muted-foreground">{t("explore.table_empty")}</p>}
      </section>
    </div>
  )
}
