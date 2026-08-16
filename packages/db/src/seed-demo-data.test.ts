import { describe, it, expect, beforeAll } from "vitest"
import { eq } from "drizzle-orm"
import { runMigrations } from "./migrate.js"
import { db } from "./connection.js"
import { workspaces, elements, relationships, views } from "./schema.js"
import { seedDemoWorkspaces } from "./seed-demo-data.js"

beforeAll(async () => {
  await runMigrations()
})

const resolveUserId = async (username: string): Promise<string> =>
  `local:${username}`

async function countsFor(workspaceName: string) {
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.name, workspaceName))
  const workspaceId = workspace!.id
  const [elementRows, relationshipRows, viewRows] = await Promise.all([
    db.select().from(elements).where(eq(elements.workspaceId, workspaceId)),
    db.select().from(relationships).where(eq(relationships.workspaceId, workspaceId)),
    db.select().from(views).where(eq(views.workspaceId, workspaceId)),
  ])
  return {
    elements: elementRows.length,
    relationships: relationshipRows.length,
    views: viewRows.length,
  }
}

describe("seedDemoWorkspaces", () => {
  // The single regression test that empirically proves `demo.sql` (an
  // 11.8k-line, single `DO $$ ... END $$;` block) executes correctly via
  // `database.execute(sql.raw(...))` under PGlite — see
  // packages/db/seeds/demo.sql and demo-data.md's element/relationship/view
  // counts table.
  it("seeds the 3 demo workspaces with the documented element/relationship/view counts", async () => {
    const { orgIdByWorkspace } = await seedDemoWorkspaces(resolveUserId)

    expect([...orgIdByWorkspace.keys()].sort()).toEqual(
      ["ArchiMetal", "ArchiSurance", "Open Day"].sort()
    )

    await expect(countsFor("ArchiMetal")).resolves.toEqual({
      elements: 294,
      relationships: 476,
      views: 33,
    })
    await expect(countsFor("ArchiSurance")).resolves.toEqual({
      elements: 257,
      relationships: 402,
      views: 40,
    })
    await expect(countsFor("Open Day")).resolves.toEqual({
      elements: 27,
      relationships: 37,
      views: 4,
    })
  })
})
