import { describe, it, expect, vi, beforeAll } from "vitest"
import { runMigrations, db, organizations, workspaces } from "@workspace/db"
import { importAllWorkspacesToNeo4j } from "./import-all-workspaces.js"

vi.mock("./connection.js", () => ({ getDriver: vi.fn(), closeDriver: vi.fn() }))
vi.mock("./schema/migrate.js", () => ({
  ensureNeo4jSchema: vi.fn().mockResolvedValue(undefined),
}))

beforeAll(async () => {
  await runMigrations()
})

describe("importAllWorkspacesToNeo4j", () => {
  it("imports every workspace that has an organization, and reports those without one as failed", async () => {
    const [org] = await db
      .insert(organizations)
      .values({ slug: "acme", name: "Acme" })
      .returning({ id: organizations.id })
    await db.insert(workspaces).values({
      uuid: "id-1",
      name: "With org",
      organizationId: org!.id,
      createdById: "local:archi",
    })
    // Orphan workspace (organizationId null is allowed at the DB level
    // during the expand→backfill→contract migration window, see schema.ts).
    await db.insert(workspaces).values({
      uuid: "id-2",
      name: "No org",
      organizationId: null,
      createdById: "local:archi",
    })

    const run = vi.fn().mockResolvedValue({ records: [] })
    const close = vi.fn().mockResolvedValue(undefined)
    const { getDriver } = await import("./connection.js")
    vi.mocked(getDriver).mockReturnValue({
      session: () => ({ run, close }),
    } as never)

    const result = await importAllWorkspacesToNeo4j()

    expect(result.imported).toEqual(["With org"])
    expect(result.failed).toEqual([
      { name: "No org", error: "no organization associated with this workspace" },
    ])
  })
})
