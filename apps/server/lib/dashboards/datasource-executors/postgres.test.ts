import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import { db, organizations, fournisseurs, workspaces, elements } from "@workspace/db"
import {
  assertOrganizationScoped,
  assertPanelQuerySafe,
  assertReadOnly,
  boundedSelect,
  executePostgresQuery,
} from "./postgres"
import type { PanelContent } from "../contracts"

describe("boundedSelect", () => {
  it("wraps the query in a subquery and enforces a server-side row cap", () => {
    expect(boundedSelect("SELECT * FROM fournisseurs")).toContain("LIMIT 500")
  })
})

describe("assertReadOnly", () => {
  it("accepts a single SELECT statement", () => {
    expect(() => assertReadOnly("SELECT count(*) FROM fournisseurs")).not.toThrow()
  })

  it("rejects multiple statements", () => {
    expect(() => assertReadOnly("SELECT 1; SELECT 2")).toThrow(/SELECT unique/)
  })

  it("rejects a write statement", () => {
    expect(() => assertReadOnly("DELETE FROM fournisseurs")).toThrow(/SELECT unique/)
    expect(() => assertReadOnly("SELECT 1; DROP TABLE fournisseurs")).toThrow()
  })

  it("rejects a write keyword smuggled inside an otherwise SELECT-shaped statement", () => {
    expect(() => assertReadOnly("SELECT * FROM fournisseurs; UPDATE fournisseurs SET actif = false")).toThrow()
  })
})

describe("assertOrganizationScoped", () => {
  it("accepts a query referencing $organizationId", () => {
    expect(() =>
      assertOrganizationScoped("SELECT count(*) FROM fournisseurs WHERE organization_id = $organizationId")
    ).not.toThrow()
  })

  it("rejects a query that doesn't reference $organizationId — the multi-tenant scoping contract", () => {
    expect(() => assertOrganizationScoped("SELECT count(*) FROM fournisseurs")).toThrow(/organizationId/)
  })
})

describe("assertPanelQuerySafe", () => {
  it("combines both checks", () => {
    expect(() =>
      assertPanelQuerySafe("SELECT count(*) FROM fournisseurs WHERE organization_id = $organizationId")
    ).not.toThrow()
    expect(() => assertPanelQuerySafe("SELECT count(*) FROM fournisseurs")).toThrow(/organizationId/)
    expect(() => assertPanelQuerySafe("DELETE FROM fournisseurs")).toThrow(/SELECT unique/)
  })
})

describe("executePostgresQuery", () => {
  let organizationId: number
  let otherOrganizationId: number

  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({ slug: `postgres-executor-test-${randomUUID()}`, name: "Postgres Executor Test Org" })
      .returning()
    organizationId = org!.id
    const [other] = await db
      .insert(organizations)
      .values({ slug: `postgres-executor-test-other-${randomUUID()}`, name: "Other Org" })
      .returning()
    otherOrganizationId = other!.id

    await db.insert(fournisseurs).values([
      { organizationId, nom: "Actif un", actif: true },
      { organizationId, nom: "Actif deux", actif: true },
      { organizationId, nom: "Inactif", actif: false },
      { organizationId: otherOrganizationId, nom: "Autre organisation", actif: true },
    ])

    const [workspace] = await db
      .insert(workspaces)
      .values({ uuid: randomUUID(), name: "Postgres Executor Test Workspace", organizationId, createdById: "test" })
      .returning()
    await db.insert(elements).values([
      { workspaceId: workspace!.id, uuid: randomUUID(), type: "ApplicationComponent", name: "Un" },
      { workspaceId: workspace!.id, uuid: randomUUID(), type: "BusinessActor", name: "Deux" },
    ])
  })

  function query(text: string): PanelContent["query"] {
    return { datasourceId: "postgres-app-db", language: "sql", text }
  }

  it("counts only the caller's organization's active rows", async () => {
    const execution = await executePostgresQuery(
      query("SELECT count(*)::integer AS count FROM fournisseurs WHERE organization_id = $organizationId AND actif = $actif"),
      "metrics",
      { actif: true },
      organizationId
    )
    expect(execution.rows).toEqual([{ count: 2 }])
  })

  it("counts ArchiMate elements across the organization's workspaces via a join, like the demonstration-datasources dashboard's Éléments panel", async () => {
    const execution = await executePostgresQuery(
      query(
        "SELECT count(*)::integer AS count FROM elements e JOIN workspaces w ON w.id = e.workspace_id WHERE w.organization_id = $organizationId"
      ),
      "metrics",
      {},
      organizationId
    )
    expect(execution.rows).toEqual([{ count: 2 }])
  })

  it("never leaks another organization's rows even if the panel text omitted the filter incorrectly at write time", async () => {
    // assertPanelQuerySafe would reject this at save time; verify the executor
    // also refuses to run it — defense in depth, same contract as Neo4j.
    await expect(
      executePostgresQuery(query("SELECT count(*)::integer AS count FROM fournisseurs"), "metrics", {}, organizationId)
    ).rejects.toThrow(/organizationId/)
  })

  it("rejects a non-SELECT statement even if somehow reached", async () => {
    await expect(
      executePostgresQuery(query("DELETE FROM fournisseurs WHERE organization_id = $organizationId"), "metrics", {}, organizationId)
    ).rejects.toThrow(/SELECT unique/)
  })

  it("throws when the query references an undefined parameter", async () => {
    await expect(
      executePostgresQuery(
        query("SELECT count(*)::integer AS count FROM fournisseurs WHERE organization_id = $organizationId AND actif = $actif"),
        "metrics",
        {},
        organizationId
      )
    ).rejects.toThrow(/actif/)
  })
})
