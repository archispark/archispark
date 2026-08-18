import { describe, it, expect, beforeAll } from "vitest"
import { eq } from "drizzle-orm"
import { runMigrations } from "./migrate.js"
import { db } from "./connection.js"
import { organizations, organizationMembers, workspaces } from "./schema.js"
import {
  seedDemoOrganizations,
  type DemoOrgsFile,
} from "./seed-demo-organizations.js"

beforeAll(async () => {
  await runMigrations()
})

const resolveUserId = async (username: string): Promise<string> =>
  `local:${username}`

describe("seedDemoOrganizations", () => {
  it("creates organizations, upserts memberships, and removes stale members on re-seed", async () => {
    const config: DemoOrgsFile = {
      organizations: [
        {
          slug: "demo-test-archi",
          name: "Archi Test",
          workspaces: ["WsA", "WsB"],
          members: { archi: "owner", contrib: "editor" },
        },
      ],
    }

    const orgIdByWorkspace = await seedDemoOrganizations(config, resolveUserId)
    const orgId = orgIdByWorkspace.get("WsA")!
    expect(orgIdByWorkspace.get("WsB")).toBe(orgId)

    let members = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId))
    expect(members.map((m) => m.userId).sort()).toEqual([
      "local:archi",
      "local:contrib",
    ])

    const narrowed: DemoOrgsFile = {
      organizations: [{ ...config.organizations[0]!, members: { archi: "owner" } }],
    }
    await seedDemoOrganizations(narrowed, resolveUserId)
    members = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId))
    expect(members.map((m) => m.userId)).toEqual(["local:archi"])
  })

  it("cleans up legacy-slug organizations only when they hold zero workspaces", async () => {
    const [emptyLegacy] = await db
      .insert(organizations)
      .values({ slug: "legacy-empty", name: "Legacy Empty" })
      .returning({ id: organizations.id })
    const [nonEmptyLegacy] = await db
      .insert(organizations)
      .values({ slug: "legacy-full", name: "Legacy Full" })
      .returning({ id: organizations.id })
    await db.insert(workspaces).values({
      uuid: "id-legacy",
      name: "Legacy Workspace",
      organizationId: nonEmptyLegacy!.id,
      createdById: "local:archi",
    })

    await seedDemoOrganizations(
      { organizations: [], legacySlugs: ["legacy-empty", "legacy-full"] },
      resolveUserId
    )

    await expect(
      db.select().from(organizations).where(eq(organizations.id, emptyLegacy!.id))
    ).resolves.toHaveLength(0)
    await expect(
      db
        .select()
        .from(organizations)
        .where(eq(organizations.id, nonEmptyLegacy!.id))
    ).resolves.toHaveLength(1)
  })
})
