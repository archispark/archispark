import { randomUUID } from "crypto"
import { describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db, users } from "@workspace/db"
import { signLocalAccessToken, verifyLocalAccessToken } from "@workspace/auth"
import { issueRefreshToken, rotateRefreshToken } from "./local-auth-tokens"
import { POST } from "../../app/api/auth/local/skip-password-change/route"

const SECRET = "test-secret-at-least-32-characters"

describe("POST /api/auth/local/skip-password-change", () => {
  it("clears the first-login gate and replaces the local session", async () => {
    vi.stubEnv("LOCAL_AUTH_JWT_SECRET", SECRET)
    const id = `local:${randomUUID()}`
    const username = `skip-${randomUUID()}`
    await db.insert(users).values({
      id,
      username,
      email: `${username}@example.com`,
      passwordHash: "unused",
      mustChangePassword: true,
    })
    const accessToken = await signLocalAccessToken({
      id,
      username,
      role: "user",
      mustChangePassword: true,
    })
    const oldRefresh = await issueRefreshToken(id, {
      userAgent: "vitest",
      ipAddress: "127.0.0.1",
    })
    const req = new NextRequest(
      "http://localhost:8000/api/auth/local/skip-password-change",
      {
        method: "POST",
        headers: {
          cookie: `access_token=${accessToken}`,
          "user-agent": "vitest",
        },
      }
    )

    const res = (await POST(req)) as NextResponse

    expect(res.status).toBe(200)
    const [user] = await db.select().from(users).where(eq(users.id, id))
    expect(user?.mustChangePassword).toBe(false)
    expect(
      await rotateRefreshToken(oldRefresh.token, {
        userAgent: "vitest",
        ipAddress: "127.0.0.1",
      })
    ).toBeNull()
    const claims = await verifyLocalAccessToken(
      res.cookies.get("access_token")!.value
    )
    expect(claims?.must_change_password).toBe(false)
    expect(res.cookies.get("refresh_token")?.value).toMatch(/^lrt_/)
  })
})
