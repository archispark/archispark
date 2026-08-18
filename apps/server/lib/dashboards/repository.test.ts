import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import { db, organizations, workspaces } from "@workspace/db"
import {
  createRevision,
  deleteDashboard,
  getLatestRevision,
  getRevision,
  isSystemDashboard,
  listForAdministration,
  listLatestRevisions,
} from "./repository"
import type { DashboardDefinition } from "./contracts"

let workspaceId: number
let otherWorkspaceId: number
const AUTHOR = "test-user"

beforeAll(async () => {
  const [org] = await db
    .insert(organizations)
    .values({ slug: `dashboards-test-${randomUUID()}`, name: "Dashboards Test Org" })
    .returning()
  const [workspace] = await db
    .insert(workspaces)
    .values({ uuid: randomUUID(), name: `Dashboards Test Workspace ${randomUUID()}`, createdById: AUTHOR, organizationId: org!.id })
    .returning()
  workspaceId = workspace!.id

  const [other] = await db
    .insert(organizations)
    .values({ slug: `dashboards-test-other-${randomUUID()}`, name: "Other Org" })
    .returning()
  const [otherWorkspace] = await db
    .insert(workspaces)
    .values({ uuid: randomUUID(), name: `Other Dashboards Test Workspace ${randomUUID()}`, createdById: AUTHOR, organizationId: other!.id })
    .returning()
  otherWorkspaceId = otherWorkspace!.id
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
    const revision = await createRevision(workspaceId, "premier-dashboard", definition("premier-dashboard"), AUTHOR)
    expect(revision.revision).toBe(1)

    const latest = await getLatestRevision(workspaceId, "premier-dashboard")
    expect(latest?.revision).toBe(1)
    expect(latest?.definition.title).toBe("Dashboard premier-dashboard")
  })

  it("increments the revision on a second edit and keeps history", async () => {
    await createRevision(workspaceId, "edite", definition("edite"), AUTHOR)
    await createRevision(workspaceId, "edite", definition("edite", { title: "Titre modifié" }), AUTHOR)

    const latest = await getLatestRevision(workspaceId, "edite")
    expect(latest?.revision).toBe(2)
    expect(latest?.definition.title).toBe("Titre modifié")

    const first = await getRevision(workspaceId, "edite", 1)
    expect(first?.definition.title).toBe("Dashboard edite")
  })

  it("rejects a mismatch between dashboardId and definition.id", async () => {
    await expect(createRevision(workspaceId, "un-id", definition("un-autre-id"), AUTHOR)).rejects.toThrow()
  })

  it("rejects creating a workspace dashboard whose id collides with a system dashboard", async () => {
    await expect(
      createRevision(workspaceId, "motivation", definition("motivation"), AUTHOR)
    ).rejects.toThrow()
  })
})

describe("workspace scoping", () => {
  it("does not leak a dashboard across workspaces", async () => {
    await createRevision(workspaceId, "prive", definition("prive"), AUTHOR)

    expect(await getLatestRevision(otherWorkspaceId, "prive")).toBeUndefined()
    expect((await listLatestRevisions(otherWorkspaceId)).some((d) => d.dashboardId === "prive")).toBe(false)
    expect((await listLatestRevisions(workspaceId)).some((d) => d.dashboardId === "prive")).toBe(true)
  })

  it("includes the global system dashboards even for a workspace that never had one seeded into it", async () => {
    expect(await getLatestRevision(workspaceId, "motivation")).toBeDefined()
    expect((await listLatestRevisions(workspaceId)).some((d) => d.dashboardId === "motivation")).toBe(true)
    expect((await listLatestRevisions(otherWorkspaceId)).some((d) => d.dashboardId === "motivation")).toBe(true)
  })
})

describe("deleteDashboard", () => {
  it("soft-deletes a dashboard: hidden from catalogue, absent from getLatestRevision", async () => {
    await createRevision(workspaceId, "a-supprimer", definition("a-supprimer"), AUTHOR)
    await deleteDashboard(workspaceId, "a-supprimer")

    expect(await getLatestRevision(workspaceId, "a-supprimer")).toBeUndefined()
    expect((await listLatestRevisions(workspaceId)).some((d) => d.dashboardId === "a-supprimer")).toBe(false)

    const admin = await listForAdministration(workspaceId)
    const entry = admin.find((e) => e.revision.dashboardId === "a-supprimer")
    expect(entry?.deletedAt).not.toBeNull()
  })

  it("throws when deleting an unknown dashboard", async () => {
    await expect(deleteDashboard(workspaceId, "inconnu")).rejects.toThrow()
  })

  it("refuses to delete a system dashboard", async () => {
    await expect(deleteDashboard(workspaceId, "motivation")).rejects.toThrow()
    expect(await getLatestRevision(workspaceId, "motivation")).toBeDefined()
  })

  it("resurrects a deleted dashboard on a new revision", async () => {
    await createRevision(workspaceId, "ressuscite", definition("ressuscite"), AUTHOR)
    await deleteDashboard(workspaceId, "ressuscite")
    expect(await getLatestRevision(workspaceId, "ressuscite")).toBeUndefined()

    await createRevision(workspaceId, "ressuscite", definition("ressuscite", { title: "De retour" }), AUTHOR)
    const latest = await getLatestRevision(workspaceId, "ressuscite")
    expect(latest?.definition.title).toBe("De retour")
    expect(latest?.revision).toBe(2)
  })
})

describe("isSystemDashboard", () => {
  it("defaults to false for a dashboard created from the admin UI", async () => {
    await createRevision(workspaceId, "non-provisionne", definition("non-provisionne"), AUTHOR)
    expect(await isSystemDashboard(workspaceId, "non-provisionne")).toBe(false)
  })

  it("returns true for a global system dashboard", async () => {
    expect(await isSystemDashboard(workspaceId, "motivation")).toBe(true)
  })

  it("returns false for an unknown dashboard", async () => {
    expect(await isSystemDashboard(workspaceId, "jamais-cree")).toBe(false)
  })
})
