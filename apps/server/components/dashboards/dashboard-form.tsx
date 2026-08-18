"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { dashboardDefinitionSchema, type DashboardDefinition } from "@/lib/dashboards/contracts"
import { useCreateDashboard, useUpdateDashboard } from "@/lib/queries/dashboards"
import { useT } from "@/lib/i18n"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"

const CONTENT_PLACEHOLDER = JSON.stringify(
  {
    parameters: [],
    panels: [
      {
        id: "metrique-elements",
        panel: {
          title: "Nombre d'éléments",
          description: "",
          resultType: "metrics",
          query: {
            datasourceId: "architecture-neo4j",
            language: "cypher",
            text: "MATCH (e:Element {organizationId: $organizationId}) RETURN count(e) AS count",
          },
          parameters: [],
          visualization: { type: "metric" },
        },
        layout: { x: 0, y: 0, width: 6, height: 4 },
        parameterBindings: {},
      },
    ],
  },
  null,
  2
)

type FormMode = "create" | "edit"

const now = () => new Date().toISOString()

/**
 * Formulaire de dashboard : champs structurés pour les métadonnées, et un
 * éditeur JSON validé (miroir de `dashboardDefinitionSchema`) pour
 * `parameters`, `panels` et `tabGroups` — un constructeur visuel complet (un
 * bloc par panneau, par paramètre, par liaison) est un chantier ultérieur.
 * `createdAt`/`updatedAt`/`createdBy`/`updatedBy` sont réécrits par le
 * serveur (voir app/api/dashboards/**) : pas de champ auteur ici.
 */
export function DashboardForm({
  mode,
  dashboardId,
  initialDefinition,
  isSystem = false,
}: {
  mode: FormMode
  dashboardId?: string
  initialDefinition?: DashboardDefinition
  isSystem?: boolean
}) {
  const { t } = useT()
  const router = useRouter()
  const createDashboard = useCreateDashboard()
  const updateDashboard = useUpdateDashboard(dashboardId ?? "")
  const [id, setId] = useState(initialDefinition?.id ?? "")
  const [title, setTitle] = useState(initialDefinition?.title ?? "")
  const [description, setDescription] = useState(initialDefinition?.description ?? "")
  const [category, setCategory] = useState(initialDefinition?.category ?? "")
  const [contentJson, setContentJson] = useState(() =>
    initialDefinition
      ? JSON.stringify(
          { parameters: initialDefinition.parameters, panels: initialDefinition.panels, tabGroups: initialDefinition.tabGroups },
          null,
          2
        )
      : CONTENT_PLACEHOLDER
  )
  const [errors, setErrors] = useState<string[]>([])
  const submitting = mode === "create" ? createDashboard.isPending : updateDashboard.isPending
  const submitError = (mode === "create" ? createDashboard.error : updateDashboard.error) as Error | null

  function buildCandidate(): unknown {
    const content = JSON.parse(contentJson) as Record<string, unknown>
    return {
      id,
      title,
      description,
      category,
      schemaVersion: 2,
      ...content,
      createdAt: initialDefinition?.createdAt ?? now(),
      updatedAt: now(),
      createdBy: initialDefinition?.createdBy ?? "—",
      updatedBy: "—",
    }
  }

  async function handleSubmit() {
    setErrors([])

    let candidate: unknown
    try {
      candidate = buildCandidate()
    } catch (error) {
      setErrors([t("dashboards.invalid_json", { message: error instanceof Error ? error.message : t("dashboards.unknown_error") })])
      return
    }

    const parsed = dashboardDefinitionSchema.safeParse(candidate)
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => `${issue.path.join(".")} : ${issue.message}`))
      return
    }

    try {
      if (mode === "create") await createDashboard.mutateAsync(parsed.data)
      else await updateDashboard.mutateAsync(parsed.data)
      router.push(`/dashboards/${dashboardId ?? id}`)
    } catch {
      // l'erreur est affichée via submitError ci-dessous
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">{t("dashboards.form_id")}</span>
          <Input value={id} onChange={(event) => setId(event.target.value)} disabled={mode === "edit" || isSystem} placeholder="vue-mon-dashboard" required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">{t("dashboards.form_category")}</span>
          <Input value={category} onChange={(event) => setCategory(event.target.value)} disabled={isSystem} required />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-foreground">{t("common.name")}</span>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} disabled={isSystem} required />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-foreground">{t("dashboards.form_description")}</span>
          <Textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} disabled={isSystem} />
        </label>
      </div>

      <div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">{t("dashboards.form_content")}</span>
          <span className="text-xs text-muted-foreground">{t("dashboards.form_content_hint")}</span>
          <Textarea rows={20} className="font-mono text-xs" value={contentJson} onChange={(event) => setContentJson(event.target.value)} spellCheck={false} disabled={isSystem} />
        </label>
      </div>

      {errors.length > 0 && (
        <ul className="list-inside list-disc rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {submitError && <p className="text-sm text-destructive">{submitError.message}</p>}

      <div className="flex items-center gap-2">
        {!isSystem && (
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("common.saving") : mode === "create" ? t("dashboards.form_create") : t("dashboards.form_save_revision")}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => router.push(dashboardId ? `/dashboards/${dashboardId}` : "/dashboards")}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  )
}
