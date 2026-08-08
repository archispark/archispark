import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import { db, organizations } from "@workspace/db"
import {
  createRevision,
  deleteDashboard,
  getLatestRevision,
  getRevision,
  isProvisioned,
  listForAdministration,
  listLatestRevisions,
} from "./repository"
import type { DashboardDefinition } from "./contracts"

let orgId: number
let otherOrgId: number
const AUTHOR = "test-user"

beforeAll(async () => {
  const [org] = await db
    .insert(organizations)
    .values({ slug: `dashboards-test-${randomUUID()}`, name: "Dashboards Test Org" })
    .returning()
  orgId = org!.id

  const [other] = await db
    .insert(organizations)
    .values({ slug: `dashboards-test-other-${randomUUID()}`, name: "Other Org" })
    .returning()
  otherOrgId = other!.id
})

function definition(id: string, overrides: Partial<DashboardDefinition> = {}): DashboardDefinition {
  const now = new Date().toISOString()
  return {
    id,
    title: `Dashboard ${id}`,
    description: "",
    category: "Tests",
    schemaVersion: 2,
    parameters: [],
    panels: [
      {
        id: "principal",
        panel: {
          title: "Panneau",
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
        layout: { x: 0, y: 0, width: 12, height: 4 },
        parameterBindings: {},
      },
    ],
    createdAt: now,
    updatedAt: now,
    createdBy: AUTHOR,
    updatedBy: AUTHOR,
    ...overrides,
  }
}

describe("createRevision / getLatestRevision", () => {
  it("creates revision 1 for a new dashboard", async () => {
    const revision = await createRevision(orgId, "premier-dashboard", definition("premier-dashboard"), AUTHOR)
    expect(revision.revision).toBe(1)

    const latest = await getLatestRevision(orgId, "premier-dashboard")
    expect(latest?.revision).toBe(1)
    expect(latest?.definition.title).toBe("Dashboard premier-dashboard")
  })

  it("increments the revision on a second edit and keeps history", async () => {
    await createRevision(orgId, "edite", definition("edite"), AUTHOR)
    await createRevision(orgId, "edite", definition("edite", { title: "Titre modifié" }), AUTHOR)

    const latest = await getLatestRevision(orgId, "edite")
    expect(latest?.revision).toBe(2)
    expect(latest?.definition.title).toBe("Titre modifié")

    const first = await getRevision(orgId, "edite", 1)
    expect(first?.definition.title).toBe("Dashboard edite")
  })

  it("rejects a mismatch between dashboardId and definition.id", async () => {
    await expect(createRevision(orgId, "un-id", definition("un-autre-id"), AUTHOR)).rejects.toThrow()
  })
})

describe("organization scoping", () => {
  it("does not leak a dashboard across organizations", async () => {
    await createRevision(orgId, "prive", definition("prive"), AUTHOR)

    expect(await getLatestRevision(otherOrgId, "prive")).toBeUndefined()
    expect((await listLatestRevisions(otherOrgId)).some((d) => d.dashboardId === "prive")).toBe(false)
    expect((await listLatestRevisions(orgId)).some((d) => d.dashboardId === "prive")).toBe(true)
  })
})

describe("deleteDashboard", () => {
  it("soft-deletes a dashboard: hidden from catalogue, absent from getLatestRevision", async () => {
    await createRevision(orgId, "a-supprimer", definition("a-supprimer"), AUTHOR)
    await deleteDashboard(orgId, "a-supprimer")

    expect(await getLatestRevision(orgId, "a-supprimer")).toBeUndefined()
    expect((await listLatestRevisions(orgId)).some((d) => d.dashboardId === "a-supprimer")).toBe(false)

    const admin = await listForAdministration(orgId)
    const entry = admin.find((e) => e.revision.dashboardId === "a-supprimer")
    expect(entry?.deletedAt).not.toBeNull()
  })

  it("throws when deleting an unknown dashboard", async () => {
    await expect(deleteDashboard(orgId, "inconnu")).rejects.toThrow()
  })

  it("resurrects a deleted dashboard on a new revision", async () => {
    await createRevision(orgId, "ressuscite", definition("ressuscite"), AUTHOR)
    await deleteDashboard(orgId, "ressuscite")
    expect(await getLatestRevision(orgId, "ressuscite")).toBeUndefined()

    await createRevision(orgId, "ressuscite", definition("ressuscite", { title: "De retour" }), AUTHOR)
    const latest = await getLatestRevision(orgId, "ressuscite")
    expect(latest?.definition.title).toBe("De retour")
    expect(latest?.revision).toBe(2)
  })
})

describe("isProvisioned", () => {
  it("defaults to false for a dashboard created from the admin UI", async () => {
    await createRevision(orgId, "non-provisionne", definition("non-provisionne"), AUTHOR)
    expect(await isProvisioned(orgId, "non-provisionne")).toBe(false)
  })

  it("returns false for an unknown dashboard", async () => {
    expect(await isProvisioned(orgId, "jamais-cree")).toBe(false)
  })
})
