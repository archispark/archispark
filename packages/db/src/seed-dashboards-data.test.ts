import { readFileSync } from "fs"
import { describe, it, expect } from "vitest"
import { seedsPath } from "./seeds-path.js"
import { parseSourceRevisions } from "./seed-dashboards-data.js"

describe("parseSourceRevisions", () => {
  it("throws when no dashboard tuple is found in the source text", () => {
    expect(() => parseSourceRevisions("select 1;")).toThrow()
  })

  it("parses and normalizes every dashboard revision from the source seed", () => {
    const revisions = parseSourceRevisions(
      readFileSync(seedsPath("dashboards.sql"), "utf-8")
    )
    expect(revisions.length).toBeGreaterThan(0)
    expect(new Set(revisions.map((r) => r.dashboardId)).size).toBeGreaterThan(0)
    for (const revision of revisions) {
      expect(revision.definition["id"]).toBe(revision.dashboardId)
    }
  })

  it("retargets an imported SQL panel at the native Postgres datasource, organization-scoped", () => {
    const revisions = parseSourceRevisions(
      readFileSync(seedsPath("dashboards.sql"), "utf-8")
    )
    const demonstration = revisions.find((r) => r.dashboardId === "demonstration-datasources")
    const panels = (demonstration!.definition["panels"] as Record<string, unknown>[])
    const postgresPanel = panels
      .map((p) => (p["panel"] as Record<string, unknown>)["query"] as Record<string, unknown>)
      .find((query) => query["language"] === "sql")
    expect(postgresPanel).toEqual({
      datasourceId: "postgres-app-db",
      language: "sql",
      text: "SELECT count(*)::integer AS count FROM fournisseurs WHERE organization_id = $organizationId AND actif = $actif",
    })
  })
})
