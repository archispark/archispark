import { describe, it, expect, vi, beforeAll } from "vitest"
import { runMigrations, db, organizations, workspaces } from "@workspace/db"
import { importAllWorkspacesToNeo4j } from "./import-all-workspaces.js"

vi.mock("./import-model.js", () => ({ importModelToNeo4j: vi.fn() }))
vi.mock("./connection.js", () => ({ getDriver: vi.fn(), closeDriver: vi.fn() }))
vi.mock("./retry.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./retry.js")>()
  // Real retriable/non-retriable classification, but no real delay between
  // retries — keeps this test fast without weakening what it exercises.
  return { ...actual, wait: vi.fn().mockResolvedValue(undefined) }
})

beforeAll(async () => {
  await runMigrations()
})

async function seedWorkspace(uuid: string, name: string) {
  const [org] = await db
    .insert(organizations)
    .values({ slug: uuid, name })
    .returning({ id: organizations.id })
  await db.insert(workspaces).values({
    uuid,
    name,
    organizationId: org!.id,
    createdById: "local:archi",
  })
}

describe("importAllWorkspacesToNeo4j — retry and failure branches", () => {
  it("retries a retriable Neo4j failure and succeeds on a later attempt", async () => {
    await seedWorkspace("id-retry", "Retries then succeeds")
    const { importModelToNeo4j } = await import("./import-model.js")
    const { closeDriver } = await import("./connection.js")
    vi.mocked(importModelToNeo4j)
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce({
        modelId: "id-retry",
        elements: 0,
        relationships: 0,
        views: 0,
        properties: 0,
        importedAt: new Date().toISOString(),
      })

    const result = await importAllWorkspacesToNeo4j()

    expect(result.imported).toContain("Retries then succeeds")
    expect(result.failed).toEqual([])
    expect(closeDriver).toHaveBeenCalledTimes(1)
  })

  it("gives up on a non-retriable failure and reports it in `failed`", async () => {
    await seedWorkspace("id-fail", "Always fails")
    const { importModelToNeo4j } = await import("./import-model.js")
    vi.mocked(importModelToNeo4j).mockRejectedValue(new Error("constraint violation"))

    const result = await importAllWorkspacesToNeo4j()

    expect(result.imported).not.toContain("Always fails")
    expect(result.failed).toContainEqual({
      name: "Always fails",
      error: "constraint violation",
    })
  })
})
