import { describe, it, expect, beforeAll } from "vitest"
import { eq } from "drizzle-orm"
import { runMigrations } from "./migrate.js"
import { db } from "./connection.js"
import { siteSettings } from "./schema.js"
import { seedDemoLoginMessage } from "./seed-site-settings.js"

beforeAll(async () => {
  await runMigrations()
})

describe("seedDemoLoginMessage", () => {
  it("sets and enables the login message, listing every demo account", async () => {
    await seedDemoLoginMessage()

    const [row] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
    expect(row?.loginMessageEnabled).toBe(true)
    expect(row?.loginMessage).toContain("admin / admin")
    expect(row?.loginMessage).toContain("archi / archi")
    expect(row?.loginMessage).toContain("contrib / contrib")
    expect(row?.loginMessage).toContain("user / user")
  })

  it("is idempotent and preserves an existing banner message", async () => {
    await db
      .insert(siteSettings)
      .values({
        id: 1,
        bannerMessage: "Maintenance ce soir",
        bannerMessageEnabled: true,
      })
      .onConflictDoUpdate({
        target: siteSettings.id,
        set: {
          bannerMessage: "Maintenance ce soir",
          bannerMessageEnabled: true,
        },
      })

    await seedDemoLoginMessage()
    await seedDemoLoginMessage()

    const [row] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
    expect(row?.loginMessageEnabled).toBe(true)
    expect(row?.bannerMessage).toBe("Maintenance ce soir")
    expect(row?.bannerMessageEnabled).toBe(true)
  })
})
