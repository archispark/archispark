import { describe, it, expect } from "vitest"
import { NextRequest } from "next/server"
import { db, plugins } from "@workspace/db"
import { GET } from "./route"

async function setPluginEnabled(slug: string, enabled: boolean) {
  await db
    .insert(plugins)
    .values({ slug, enabled })
    .onConflictDoUpdate({ target: plugins.slug, set: { enabled } })
}

function makeCtx(pluginSlug: string, iconSlug: string) {
  return { params: Promise.resolve({ pluginSlug, iconSlug }) }
}

function makeReq(): NextRequest {
  return new NextRequest("http://localhost:8000/api/plugins/aws/icons/activate")
}

describe("GET /api/plugins/[pluginSlug]/icons/[iconSlug]", () => {
  it("serves the SVG when the plugin is enabled", async () => {
    await setPluginEnabled("aws", true)
    const res = await GET(makeReq(), makeCtx("aws", "activate"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("image/svg+xml")
    const body = await res.text()
    expect(body).toContain("<svg")
  })

  it("returns 404 when the plugin is disabled", async () => {
    await setPluginEnabled("aws", false)
    const res = await GET(makeReq(), makeCtx("aws", "activate"))
    expect(res.status).toBe(404)
  })

  it("returns 404 for an unknown icon slug", async () => {
    await setPluginEnabled("aws", true)
    const res = await GET(makeReq(), makeCtx("aws", "no-such-icon"))
    expect(res.status).toBe(404)
  })

  it("returns 404 when pluginSlug doesn't own the icon slug", async () => {
    await setPluginEnabled("aws", true)
    await setPluginEnabled("azure", true)
    // "activate" belongs to aws, not azure — mixing slugs must not resolve.
    const res = await GET(makeReq(), makeCtx("azure", "activate"))
    expect(res.status).toBe(404)
  })
})
