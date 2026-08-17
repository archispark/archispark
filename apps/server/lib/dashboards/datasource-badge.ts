import { ARCHITECTURE_DATASOURCE, type DashboardDefinition } from "./contracts"

/** Unique datasource types used by a dashboard's panels, for the admin list badge. */
export function datasourceTypesUsed(definition: DashboardDefinition): string[] {
  const ids = new Set(definition.panels.map((p) => p.panel.query.datasourceId))
  return [...ids]
    .map((id) => (id === ARCHITECTURE_DATASOURCE.id ? ARCHITECTURE_DATASOURCE.type : id))
    .sort()
}
