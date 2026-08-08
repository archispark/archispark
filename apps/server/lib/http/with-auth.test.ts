import { describe, it, expect, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/archimate/auth", () => ({
  requireAuth: vi.fn(async () => ({
    user: { id: "u1", role: "user" },
    tokenContext: null,
  })),
  requireSuperAdmin: vi.fn(async () => ({
    user: { id: "u1", role: "platform_admin" },
    tokenContext: null,
  })),
}))

const { withAuth, withSuperAdmin } = await import("./with-auth")

const req = () => new NextRequest("http://localhost/api/x")

describe("withAuth", () => {
  it("resolves auth and passes it to the handler", async () => {
    const handler = vi.fn(async (_req, auth) =>
      Response.json({ id: auth.user.id })
    )
    const res = await withAuth(handler)(req())
    expect(await res.json()).toEqual({ id: "u1" })
  })

  it("forwards extra route-handler args (e.g. Next's { params })", async () => {
    const handler = vi.fn(
      async (_req, _auth, ctx: { params: { id: string } }) =>
        Response.json({ id: ctx.params.id })
    )
    const res = await withAuth(handler)(req(), { params: { id: "42" } })
    expect(await res.json()).toEqual({ id: "42" })
  })
})

describe("withSuperAdmin", () => {
  it("resolves via requireSuperAdmin", async () => {
    const handler = vi.fn(async (_req, auth) =>
      Response.json({ role: auth.user.role })
    )
    const res = await withSuperAdmin(handler)(req())
    expect(await res.json()).toEqual({ role: "platform_admin" })
  })
})
