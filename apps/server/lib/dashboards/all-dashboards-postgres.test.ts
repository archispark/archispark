/**
 * Every system dashboard (packages/db/drizzle-pg/0032_dashboard_system_seed.sql
 * and its backfills 0034-0040) now targets postgres-app-db. This guards
 * against a future backfill accidentally leaving a panel on architecture-neo4j,
 * and against a hand-written migration's definition failing schema
 * validation.
 */
import { describe, expect, it } from "vitest"
import { db, dashboards, dashboardRevisions } from "@workspace/db"
import { eq, and, isNull } from "drizzle-orm"
import { dashboardDefinitionSchema } from "./contracts"

const SYSTEM_DASHBOARD_IDS = [
  "demonstration-datasources",
  "motivation",
  "principles",
  "rapports-application",
  "rapports-architecture",
  "voisinage-elements",
  "vue-architecture-applicative",
]

describe("system dashboards on postgres-app-db", () => {
  for (const dashboardId of SYSTEM_DASHBOARD_IDS) {
    it(`${dashboardId}'s latest revision is schema-valid and uses postgres-app-db for every panel`, async () => {
      const [dashboard] = await db
        .select()
        .from(dashboards)
        .where(
          and(
            eq(dashboards.dashboardId, dashboardId),
            isNull(dashboards.workspaceId)
          )
        )
      expect(dashboard).toBeTruthy()
      const [revision] = await db
        .select()
        .from(dashboardRevisions)
        .where(
          and(
            eq(dashboardRevisions.dashboardId, dashboard!.id),
            eq(dashboardRevisions.revision, dashboard!.latestRevision)
          )
        )
      expect(revision).toBeTruthy()

      const result = dashboardDefinitionSchema.safeParse(revision!.definition)
      expect(result.success).toBe(true)
      if (!result.success) return

      for (const instance of result.data.panels) {
        expect(instance.panel.query.datasourceId).toBe("postgres-app-db")
        expect(instance.panel.query.language).toBe("sql")
      }
    })
  }
})
