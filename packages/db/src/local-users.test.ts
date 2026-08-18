import { describe, it, expect, beforeAll } from "vitest"
import { eq } from "drizzle-orm"
import { verifyPassword } from "@workspace/auth"
import { runMigrations } from "./migrate.js"
import { db } from "./connection.js"
import { users } from "./schema.js"
import { seedLocalUsers, findLocalUserIdByUsername } from "./local-users.js"

beforeAll(async () => {
  await runMigrations()
})

describe("seedLocalUsers", () => {
  it("creates a new account, then updates it idempotently on re-seed", async () => {
    const [created] = await seedLocalUsers([
      {
        username: "Contrib",
        email: "Contrib@Archispark.internal",
        password: "contrib",
        displayName: "Contrib",
      },
    ])
    expect(created!.username).toBe("contrib")
    expect(created!.id.startsWith("local:")).toBe(true)
    expect(created!.created).toBe(true)

    const [updated] = await seedLocalUsers([
      {
        username: "contrib",
        email: "contrib@archispark.internal",
        password: "new-password",
        displayName: "Contrib Updated",
        role: "platform_admin",
      },
    ])
    expect(updated!.id).toBe(created!.id)
    expect(updated!.created).toBe(false)

    const [row] = await db.select().from(users).where(eq(users.id, created!.id))
    expect(row!.email).toBe("contrib@archispark.internal")
    expect(row!.displayName).toBe("Contrib Updated")
    expect(row!.role).toBe("platform_admin")
    await expect(verifyPassword(row!.passwordHash, "new-password")).resolves.toBe(true)
  })

  it("findLocalUserIdByUsername resolves an existing username and null for a missing one", async () => {
    const [seeded] = await seedLocalUsers([
      { username: "archi", email: "archi@archispark.internal", password: "archi" },
    ])
    await expect(findLocalUserIdByUsername("archi")).resolves.toBe(seeded!.id)
    await expect(findLocalUserIdByUsername("ARCHI")).resolves.toBe(seeded!.id)
    await expect(findLocalUserIdByUsername("nobody")).resolves.toBeNull()
  })
})
