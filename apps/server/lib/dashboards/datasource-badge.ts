import { NATIVE_DATASOURCES, type DashboardDefinition } from "./contracts"

const typeById = new Map(NATIVE_DATASOURCES.map((datasource) => [datasource.id, datasource.type]))

/** Unique datasource types used by a dashboard's panels, for the admin list badge. */
export function datasourceTypesUsed(definition: DashboardDefinition): string[] {
  const ids = new Set(definition.panels.map((p) => p.panel.query.datasourceId))
  return [...ids].map((id) => typeById.get(id) ?? id).sort()
}
