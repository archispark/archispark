import type { PanelVisualizationMetadata } from "./contracts"

/**
 * Catalogue des visualisations natives — porté de `native-panel-visualizations.ts`
 * (ofr-archimate-reports/apps/portal). Le système de plugins tiers du portail
 * (`plugins/`) n'est pas repris : ce catalogue est fixe, pas extensible.
 */
export const NATIVE_PANEL_VISUALIZATIONS: readonly PanelVisualizationMetadata[] = [
  {
    id: "core/graph",
    name: "Graphe ArchiMate",
    description: "Explore les éléments et relations ArchiMate dans un graphe interactif.",
    version: "1.0.0",
    acceptedResultTypes: ["graph"],
    status: "active",
    options: [{ name: "colorByProperty", label: "Coloration par propriété", type: "string" }],
  },
  {
    id: "core/table",
    name: "Tableau",
    description: "Affiche des lignes triables et paginées avec configuration des colonnes.",
    version: "1.0.0",
    acceptedResultTypes: ["table"],
    status: "active",
    options: [
      { name: "columnOrder", label: "Ordre des colonnes", type: "columns" },
      { name: "freezeFirstColumn", label: "Figer la première colonne", type: "boolean" },
      { name: "pageSize", label: "Taille de page", type: "number" },
    ],
  },
  {
    id: "core/metric",
    name: "Métrique",
    description: "Met en évidence une valeur numérique unique.",
    version: "1.0.0",
    acceptedResultTypes: ["metrics"],
    status: "active",
    options: [],
  },
] as const
