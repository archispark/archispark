/**
 * Tests for local-auth-tokens.ts — refresh token issuance, rotation, and
 * the reuse-detection guard (presenting an already-rotated token revokes
 * the whole session family).
 */

import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID, createHash } from "crypto"
import { eq } from "drizzle-orm"
import { db, users, localRefreshTokens } from "@workspace/db"
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} from "./local-auth-tokens"

const META = { userAgent: "vitest", ipAddress: "127.0.0.1" }

let userId: string

beforeAll(async () => {
  userId = `local:${randomUUID()}`
  await db.insert(users).values({
    id: userId,
    username: `rtt-${randomUUID()}`,
    email: `rtt-${randomUUID()}@example.com`,
    passwordHash:
      "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  })
})

describe("issueRefreshToken / rotateRefreshToken", () => {
  it("issues a token that rotates into a new one", async () => {
    const issued = await issueRefreshToken(userId, META)
    const rotated = await rotateRefreshToken(issued.token, META)
    expect(rotated?.userId).toBe(userId)
    expect(rotated?.token).not.toBe(issued.token)
  })

  it("rejects an unknown token", async () => {
    expect(await rotateRefreshToken("lrt_does-not-exist", META)).toBeNull()
  })

  it("rejects re-presenting an already-rotated token, and revokes the session family (reuse detection)", async () => {
    const issued = await issueRefreshToken(userId, META)
    const first = await rotateRefreshToken(issued.token, META)
    expect(first).not.toBeNull()

    // Reusing the original (now-revoked) token is rejected...
    expect(await rotateRefreshToken(issued.token, META)).toBeNull()
    // ...and the token issued by the first rotation is revoked too, as a
    // side effect of reuse detection — even though it was never reused itself.
    expect(await rotateRefreshToken(first!.token, META)).toBeNull()
  })
})

describe("revokeRefreshToken / revokeAllRefreshTokens", () => {
  it("revokes a single token by its clear value", async () => {
    const issued = await issueRefreshToken(userId, META)
    await revokeRefreshToken(issued.token)
    expect(await rotateRefreshToken(issued.token, META)).toBeNull()
  })

  it("revokes every active token for a user", async () => {
    const a = await issueRefreshToken(userId, META)
    const b = await issueRefreshToken(userId, META)
    await revokeAllRefreshTokens(userId)
    const [rowA] = await db
      .select()
      .from(localRefreshTokens)
      .where(eq(localRefreshTokens.tokenHash, hashFor(a.token)))
    const [rowB] = await db
      .select()
      .from(localRefreshTokens)
      .where(eq(localRefreshTokens.tokenHash, hashFor(b.token)))
    expect(rowA?.revokedAt).not.toBeNull()
    expect(rowB?.revokedAt).not.toBeNull()
  })
})

// Local re-implementation of the module's private hashToken, to assert
// against stored rows without exporting an internal.
function hashFor(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
