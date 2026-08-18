/**
 * Schémas Zod des dashboards configurables. `ELEMENT_LAYER`/`ALL_ELEMENT_TYPES`
 * viennent de `lib/archimate-helpers.ts` (source de vérité ArchiMate
 * d'ArchiSpark) plutôt que d'un package `@archimate/domain` séparé — voir
 * docs/architecture.md#dashboards.
 */
import { z } from "zod"
import { ALL_ELEMENT_TYPES } from "@/lib/archimate-helpers"

// ---------------------------------------------------------------------------
// Identifiants
// ---------------------------------------------------------------------------

export const panelIdSchema = z
  .string()
  .min(1, "L'identifiant est obligatoire.")
  .max(100, "L'identifiant ne doit pas dépasser 100 caractères.")
  .regex(
    /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
    "L'identifiant doit être en kebab-case (minuscules, chiffres et tirets)."
  )

export const dashboardIdSchema = panelIdSchema

// ---------------------------------------------------------------------------
// Datasource — deux datasources natives (Neo4j et Postgres d'ArchiSpark),
// voir lib/dashboards/datasource-executors/.
// ---------------------------------------------------------------------------

export const DATASOURCE_TYPES = ["neo4j", "postgres"] as const
export type DatasourceType = (typeof DATASOURCE_TYPES)[number]

export const datasourceDefinitionSchema = z
  .object({
    id: panelIdSchema,
    name: z.string().min(1).max(200),
    type: z.enum(DATASOURCE_TYPES),
    enabled: z.boolean().default(true),
  })
  .strict()
export type DatasourceDefinition = z.infer<typeof datasourceDefinitionSchema>

/** Le graphe Neo4j exporté depuis le modèle ArchiMate de l'organisation active. */
export const ARCHITECTURE_DATASOURCE: DatasourceDefinition = {
  id: "architecture-neo4j",
  name: "Modèle ArchiMate",
  type: "neo4j",
  enabled: true,
}

/** La base Postgres applicative d'ArchiSpark elle-même (packages/db), en lecture seule et scopée par organisation. */
export const POSTGRES_DATASOURCE: DatasourceDefinition = {
  id: "postgres-app-db",
  name: "Base applicative PostgreSQL",
  type: "postgres",
  enabled: true,
}

export const NATIVE_DATASOURCES: readonly DatasourceDefinition[] = [
  ARCHITECTURE_DATASOURCE,
  POSTGRES_DATASOURCE,
]

// ---------------------------------------------------------------------------
// Contenu d'un panneau
// ---------------------------------------------------------------------------

export const PANEL_RESULT_TYPES = ["graph", "table", "metrics"] as const
export const PANEL_PARAMETER_TYPES = [
  "string",
  "number",
  "boolean",
  "enum",
] as const
export type PanelParameterType = (typeof PANEL_PARAMETER_TYPES)[number]

const reportableElementTypes = ALL_ELEMENT_TYPES as [string, ...string[]]
const panelResultTypeSchema = z.enum(PANEL_RESULT_TYPES)
const panelVisualizationTypeSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(
    /^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)?$/,
    "Le type de visualisation doit être en kebab-case, éventuellement namespacé."
  )
const panelParameterTypeSchema = z.enum(PANEL_PARAMETER_TYPES)

export const QUERY_LANGUAGES = ["cypher", "sql"] as const
export type QueryLanguage = (typeof QUERY_LANGUAGES)[number]

const panelQuerySchema = z
  .object({
    datasourceId: panelIdSchema,
    language: z.enum(QUERY_LANGUAGES),
    text: z.string().trim().min(1).max(50_000),
  })
  .strict()
export type PanelQuery = z.infer<typeof panelQuerySchema>

const parameterValueSchema = z.union([z.string(), z.number(), z.boolean()])

const parameterSelectorSchema = z
  .object({
    source: z.literal("model-elements"),
    elementTypes: z
      .array(z.enum(reportableElementTypes))
      .min(1)
      .max(reportableElementTypes.length),
  })
  .strict()

export const panelParameterSchema = z
  .object({
    name: z
      .string()
      .regex(
        /^[a-zA-Z][a-zA-Z0-9_]*$/,
        "Le nom du paramètre doit commencer par une lettre et ne contenir que des lettres, chiffres ou underscores."
      ),
    label: z.string().min(1).max(200),
    type: panelParameterTypeSchema,
    required: z.boolean(),
    defaultValue: parameterValueSchema.optional(),
    allowedValues: z.array(z.string()).min(1).max(50).optional(),
    selector: parameterSelectorSchema.optional(),
  })
  .strict()
  .superRefine((parameter, ctx) => {
    if (parameter.type === "enum" && !parameter.allowedValues) {
      ctx.addIssue({
        code: "custom",
        path: ["allowedValues"],
        message:
          "Un paramètre de type « enum » doit lister ses valeurs autorisées.",
      })
    }
    if (parameter.type !== "enum" && parameter.allowedValues) {
      ctx.addIssue({
        code: "custom",
        path: ["allowedValues"],
        message: "« allowedValues » est réservé aux paramètres de type « enum ».",
      })
    }
    if (parameter.selector && parameter.type !== "string") {
      ctx.addIssue({
        code: "custom",
        path: ["selector"],
        message:
          "Un sélecteur d'éléments du modèle requiert un paramètre de type « string ».",
      })
    }
    if (parameter.defaultValue === undefined) return
    const expectedType = parameter.type === "enum" ? "string" : parameter.type
    if (typeof parameter.defaultValue !== expectedType) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultValue"],
        message: `La valeur par défaut doit être de type « ${expectedType} ».`,
      })
    }
    if (
      parameter.type === "enum" &&
      typeof parameter.defaultValue === "string" &&
      parameter.allowedValues &&
      !parameter.allowedValues.includes(parameter.defaultValue)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultValue"],
        message: "La valeur par défaut doit figurer dans « allowedValues ».",
      })
    }
  })

const parametersSchema = z
  .array(panelParameterSchema)
  .max(20)
  .superRefine((parameters, ctx) => {
    const names = new Set<string>()
    parameters.forEach((parameter, index) => {
      if (names.has(parameter.name)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "name"],
          message: `Le paramètre « ${parameter.name} » est déclaré plusieurs fois.`,
        })
      }
      names.add(parameter.name)
    })
  })

const visualizationSchema = z
  .object({
    type: panelVisualizationTypeSchema,
    colorByProperty: z.string().optional(),
    columnOrder: z
      .array(z.string().min(1).max(200))
      .min(1)
      .max(50)
      .refine((columns) => new Set(columns).size === columns.length, {
        message: "Chaque colonne ne peut apparaître qu'une fois dans « columnOrder ».",
      })
      .optional(),
    columns: z
      .record(
        z.string().min(1).max(200),
        z
          .object({
            width: z.number().int().min(40).max(1000).optional(),
            minWidth: z.number().int().min(40).max(1000).optional(),
            wrap: z.boolean().optional(),
            hidden: z.boolean().optional(),
            align: z.enum(["left", "center", "right"]).optional(),
          })
          .strict()
      )
      .optional(),
    freezeFirstColumn: z.boolean().optional(),
    pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]).optional(),
    max: z.number().positive().optional(),
  })
  .strict()

const panelTransformationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("extractFields"),
      field: z.string().min(1).max(200),
      fields: z
        .array(
          z
            .object({
              path: z.string().min(1).max(200),
              as: z.string().min(1).max(200).optional(),
            })
            .strict()
        )
        .min(1)
        .max(50),
      replaceSource: z.boolean().optional(),
    })
    .strict(),
])

/**
 * Contenu d'un panneau — titre, requête, paramètres et visualisation.
 * Toujours embarqué dans une instance (`dashboardPanelSchema`) d'une
 * révision de dashboard, jamais stocké indépendamment.
 *
 * Convention de sortie de la requête (Cypher ou SQL) : une seule ligne avec
 * `nodeIds` (graph), `rows` (table) ou `count` (metrics) ; un graphe peut
 * aussi retourner `emphasizedId`/`rankGroups`.
 */
export const panelContentSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000),
    resultType: panelResultTypeSchema,
    query: panelQuerySchema,
    parameters: parametersSchema,
    transformations: z.array(panelTransformationSchema).max(10).optional(),
    visualization: visualizationSchema,
  })
  .strict()
  .superRefine((content, ctx) => {
    if (
      (content.visualization.columnOrder ||
        content.visualization.columns ||
        content.visualization.freezeFirstColumn ||
        content.visualization.pageSize) &&
      content.resultType !== "table"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["visualization"],
        message:
          "Les options de colonnes et de pagination sont réservées aux panneaux de type tableau.",
      })
    }
    if (content.visualization.max !== undefined && content.resultType !== "metrics") {
      ctx.addIssue({
        code: "custom",
        path: ["visualization", "max"],
        message: "L'option « max » est réservée aux visualisations métriques.",
      })
    }
    if (
      content.transformations?.some((t) => t.type === "extractFields") &&
      content.resultType !== "table"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["transformations"],
        message:
          "La transformation « extractFields » est réservée aux panneaux de type tableau.",
      })
    }
    const expectedVisualizations: Record<string, string[]> = {
      graph: ["graph", "core/graph"],
      table: ["table", "core/table"],
      metrics: ["metric", "core/metric"],
    }
    if (
      !content.visualization.type.includes("/") &&
      !expectedVisualizations[content.resultType]!.includes(content.visualization.type)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["visualization", "type"],
        message: `La visualisation « ${content.visualization.type} » n'est pas compatible avec le résultat « ${content.resultType} ».`,
      })
    }
  })

export type PanelContent = z.infer<typeof panelContentSchema>
export type PanelTransformation = NonNullable<PanelContent["transformations"]>[number]

// ---------------------------------------------------------------------------
// Dashboard — instances de panneaux, paramètres partagés, onglets
// ---------------------------------------------------------------------------

const dashboardParameterValueSchema = z.union([z.string(), z.number(), z.boolean()])

const parameterBindingSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("dashboard"), parameter: z.string().min(1) }).strict(),
  z.object({ source: z.literal("constant"), value: dashboardParameterValueSchema }).strict(),
])

export const dashboardPanelSchema = z
  .object({
    id: panelIdSchema,
    panel: panelContentSchema,
    layout: z
      .object({
        x: z.number().int().min(0).max(11),
        y: z.number().int().min(0),
        width: z.number().int().min(1).max(12),
        height: z.number().int().min(1).max(20),
      })
      .strict()
      .refine(({ x, width }) => x + width <= 12, "Le panneau dépasse la grille de 12 colonnes."),
    parameterBindings: z.record(z.string(), parameterBindingSchema),
  })
  .strict()

const dashboardTabSchema = z
  .object({
    id: panelIdSchema,
    title: z.string().min(1).max(100),
    panelIds: z
      .array(panelIdSchema)
      .min(1)
      .max(50)
      .refine(
        (panelIds) => new Set(panelIds).size === panelIds.length,
        "Un panneau ne peut apparaître qu'une fois dans un onglet."
      ),
  })
  .strict()

const dashboardTabGroupSchema = z
  .object({
    id: panelIdSchema,
    tabs: z.array(dashboardTabSchema).min(1).max(20),
  })
  .strict()

export const dashboardDefinitionSchema = z
  .object({
    id: dashboardIdSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(2000),
    category: z.string().min(1).max(100),
    schemaVersion: z.literal(2),
    parameters: z.array(panelParameterSchema).max(20),
    panels: z.array(dashboardPanelSchema).min(1).max(50),
    tabGroups: z.array(dashboardTabGroupSchema).max(20).optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    createdBy: z.string().min(1),
    updatedBy: z.string().min(1),
  })
  .strict()
  .superRefine((dashboard, ctx) => {
    const ids = new Set<string>()
    const parameters = new Set<string>()
    dashboard.parameters.forEach((parameter, index) => {
      if (parameters.has(parameter.name))
        ctx.addIssue({
          code: "custom",
          path: ["parameters", index, "name"],
          message: `Paramètre de dashboard dupliqué : ${parameter.name}.`,
        })
      parameters.add(parameter.name)
    })
    dashboard.panels.forEach((panel, index) => {
      if (ids.has(panel.id))
        ctx.addIssue({
          code: "custom",
          path: ["panels", index, "id"],
          message: `Instance de panneau dupliquée : ${panel.id}.`,
        })
      ids.add(panel.id)
      const declaredPanelParameters = new Map(
        panel.panel.parameters.map((parameter) => [parameter.name, parameter])
      )
      Object.entries(panel.parameterBindings).forEach(([name, binding]) => {
        if (binding.source === "dashboard" && !parameters.has(binding.parameter))
          ctx.addIssue({
            code: "custom",
            path: ["panels", index, "parameterBindings"],
            message: `Paramètre de dashboard inconnu : ${binding.parameter}.`,
          })
        const target = declaredPanelParameters.get(name)
        if (!target) {
          ctx.addIssue({
            code: "custom",
            path: ["panels", index, "parameterBindings", name],
            message: `Paramètre de panneau inconnu : ${name}.`,
          })
          return
        }
        const expectedType = target.type === "enum" ? "string" : target.type
        if (binding.source === "constant") {
          if (typeof binding.value !== expectedType)
            ctx.addIssue({
              code: "custom",
              path: ["panels", index, "parameterBindings", name],
              message: `La constante liée à « ${name} » doit être de type « ${expectedType} ».`,
            })
          if (
            target.type === "enum" &&
            target.allowedValues &&
            !target.allowedValues.includes(binding.value as string)
          )
            ctx.addIssue({
              code: "custom",
              path: ["panels", index, "parameterBindings", name],
              message: `La constante liée à « ${name} » doit figurer dans « allowedValues ».`,
            })
        } else {
          const source = dashboard.parameters.find((parameter) => parameter.name === binding.parameter)
          if (source) {
            const sourceType = source.type === "enum" ? "string" : source.type
            if (sourceType !== expectedType)
              ctx.addIssue({
                code: "custom",
                path: ["panels", index, "parameterBindings", name],
                message: `Le paramètre de dashboard « ${binding.parameter} » et le paramètre de panneau « ${name} » ont des types incompatibles.`,
              })
          }
        }
      })
      panel.panel.parameters.forEach((parameter) => {
        if (
          parameter.required &&
          parameter.defaultValue === undefined &&
          !panel.parameterBindings[parameter.name]
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["panels", index, "parameterBindings"],
            message: `Le paramètre obligatoire « ${parameter.name} » du panneau « ${panel.id} » n'est pas renseigné.`,
          })
        }
      })
    })
    const groupIds = new Set<string>()
    const tabbedPanelIds = new Set<string>()
    dashboard.tabGroups?.forEach((group, groupIndex) => {
      if (groupIds.has(group.id))
        ctx.addIssue({
          code: "custom",
          path: ["tabGroups", groupIndex, "id"],
          message: `Groupe d'onglets dupliqué : ${group.id}.`,
        })
      groupIds.add(group.id)
      const tabIds = new Set<string>()
      group.tabs.forEach((tab, tabIndex) => {
        if (tabIds.has(tab.id))
          ctx.addIssue({
            code: "custom",
            path: ["tabGroups", groupIndex, "tabs", tabIndex, "id"],
            message: `Onglet dupliqué : ${tab.id}.`,
          })
        tabIds.add(tab.id)
        tab.panelIds.forEach((panelId) => {
          if (!ids.has(panelId))
            ctx.addIssue({
              code: "custom",
              path: ["tabGroups", groupIndex, "tabs", tabIndex, "panelIds"],
              message: `Instance de panneau inconnue : ${panelId}.`,
            })
          if (tabbedPanelIds.has(panelId))
            ctx.addIssue({
              code: "custom",
              path: ["tabGroups", groupIndex, "tabs", tabIndex, "panelIds"],
              message: `L'instance « ${panelId} » appartient déjà à un onglet.`,
            })
          tabbedPanelIds.add(panelId)
        })
      })
    })
  })

export type DashboardDefinition = z.infer<typeof dashboardDefinitionSchema>

export const dashboardRevisionSchema = z.object({
  dashboardId: dashboardIdSchema,
  revision: z.number().int().min(1),
  definition: dashboardDefinitionSchema,
  createdAt: z.iso.datetime(),
  createdBy: z.string().min(1),
})
export type DashboardRevision = z.infer<typeof dashboardRevisionSchema>

// ---------------------------------------------------------------------------
// Résultat d'exécution d'un panneau
// ---------------------------------------------------------------------------

export const panelResultSchema = z.discriminatedUnion("resultType", [
  z
    .object({
      resultType: z.literal("graph"),
      nodeIds: z.array(z.string()),
      // Métadonnées minimales (nom/type) des éléments désignés par `nodeIds`
      // — résolues côté serveur (datasource-executors.ts) plutôt que via un
      // modèle ArchiMate complet chargé en mémoire côté client (mécanisme du
      // portail d'origine, peu adapté à un modèle potentiellement volumineux
      // et multi-tenant).
      nodes: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() }).strict()),
      edges: z.array(
        z.object({ id: z.string(), source: z.string(), target: z.string(), type: z.string() })
      ),
      emphasizedId: z.string().optional(),
      rankGroups: z.record(z.string(), z.string()).optional(),
    })
    .strict(),
  z
    .object({
      resultType: z.literal("table"),
      rows: z.array(z.record(z.string(), z.unknown())),
    })
    .strict(),
  z
    .object({
      resultType: z.literal("metrics"),
      count: z.number(),
    })
    .strict(),
])
export type PanelResult = z.infer<typeof panelResultSchema>

// ---------------------------------------------------------------------------
// Catalogue des visualisations de panneau
// ---------------------------------------------------------------------------

export const CORE_PANEL_VISUALIZATION_IDS = ["core/graph", "core/table", "core/metric"] as const
export const PANEL_VISUALIZATION_STATUSES = ["active", "disabled", "incompatible", "error"] as const

export const panelVisualizationIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(
    /^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)?$/,
    "L'identifiant de visualisation doit être en kebab-case, éventuellement namespacé."
  )

export const panelVisualizationOptionSchema = z
  .object({
    name: z.string().min(1).max(100),
    label: z.string().min(1).max(200),
    type: z.enum(["string", "number", "boolean", "columns"]),
    required: z.boolean().optional(),
  })
  .strict()

export const panelVisualizationMetadataSchema = z
  .object({
    id: panelVisualizationIdSchema,
    name: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "La version doit respecter le format semver X.Y.Z."),
    acceptedResultTypes: z.array(z.enum(PANEL_RESULT_TYPES)).min(1).max(PANEL_RESULT_TYPES.length),
    status: z.enum(PANEL_VISUALIZATION_STATUSES),
    options: z.array(panelVisualizationOptionSchema).max(50),
  })
  .strict()
export type PanelVisualizationMetadata = z.infer<typeof panelVisualizationMetadataSchema>

/** `graph`/`table`/`metric` (ancien schéma v1, encore référencés par certains dashboards) → identifiant namespacé `core/*` courant. */
export function normalizePanelVisualizationId(id: string): string {
  const legacy: Record<string, (typeof CORE_PANEL_VISUALIZATION_IDS)[number]> = {
    graph: "core/graph",
    table: "core/table",
    metric: "core/metric",
  }
  return legacy[id] ?? id
}
