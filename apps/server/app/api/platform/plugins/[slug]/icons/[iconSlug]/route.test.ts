import { describe, it, expect, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/archimate/auth", () => ({
  requireSuperAdmin: vi.fn(async () => ({
    user: { id: "admin-1", role: "platform_admin" },
    tokenContext: null,
  })),
}))

const { db, plugins } = await import("@workspace/db")
const { GET } = await import("./route")

async function setPluginEnabled(slug: string, enabled: boolean) {
  await db
    .insert(plugins)
    .values({ slug, enabled })
    .onConflictDoUpdate({ target: plugins.slug, set: { enabled } })
}

function makeCtx(slug: string, iconSlug: string) {
  return { params: Promise.resolve({ slug, iconSlug }) }
}

function makeReq(): NextRequest {
  return new NextRequest(
    "http://localhost:8000/api/platform/plugins/aws/icons/activate"
  )
}

describe("GET /api/platform/plugins/[slug]/icons/[iconSlug]", () => {
  it("serves the SVG for a disabled plugin (admin preview)", async () => {
    await setPluginEnabled("aws", false)
    const res = await GET(makeReq(), makeCtx("aws", "activate"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("image/svg+xml")
    const body = await res.text()
    expect(body).toContain("<svg")
  })

  it("returns 404 for an unknown icon slug", async () => {
    const res = await GET(makeReq(), makeCtx("aws", "no-such-icon"))
    expect(res.status).toBe(404)
  })

  it("returns 404 when the slug doesn't own the icon", async () => {
    const res = await GET(makeReq(), makeCtx("azure", "activate"))
    expect(res.status).toBe(404)
  })
})
