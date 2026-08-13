/**
 * Route-level contract for platform_admin "admin mode" — entering an
 * organization, reading/exiting the active pointer, and the resulting
 * end-to-end effect on a regular content route (GET /api/workspaces).
 */

import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { db, organizations, workspaces } from "@workspace/db"
import { POST as enterRoute } from "../../app/api/platform/organizations/[id]/enter/route"
import {
  GET as activeGet,
  DELETE as activeDelete,
} from "../../app/api/platform/organizations/active/route"
import { GET as workspacesGet } from "../../app/api/workspaces/route"
import { makeFakeAccessToken } from "./test/keycloak-token-fake"

function request(
  path: string,
  userId: string,
  method: "GET" | "POST" | "DELETE",
  platformAdmin = false
): NextRequest {
  const token = makeFakeAccessToken({
    sub: userId,
    preferred_username: userId,
    realm_access: { roles: platformAdmin ? ["platform_admin"] : [] },
  })
  return new NextRequest(`http://localhost:8000${path}`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  })
}

async function orgWithWorkspace() {
  const [org] = await db
    .insert(organizations)
    .values({ slug: `admin-mode-${randomUUID()}`, name: "Admin Mode Org" })
    .returning()
  await db.insert(workspaces).values({
    uuid: `id-${randomUUID()}`,
    name: "Admin Mode WS",
    organizationId: org!.id,
    createdById: `creator-${randomUUID()}`,
  })
  return org!
}

describe("platform admin mode route contract", () => {
  it("rejects a regular user from entering an organization", async () => {
    const org = await orgWithWorkspace()
    const response = await enterRoute(
      request(
        `/api/platform/organizations/${org.id}/enter`,
        `user-${randomUUID()}`,
        "POST",
        false
      ),
      { params: Promise.resolve({ id: String(org.id) }) }
    )
    expect(response.status).toBe(403)
  })

  it("returns 404 entering an organization that doesn't exist", async () => {
    const response = await enterRoute(
      request(
        "/api/platform/organizations/999999/enter",
        `platform-${randomUUID()}`,
        "POST",
        true
      ),
      { params: Promise.resolve({ id: "999999" }) }
    )
    expect(response.status).toBe(404)
  })

  it("returns null before enter, the organization after, then null again after exit", async () => {
    const org = await orgWithWorkspace()
    const adminId = `platform-${randomUUID()}`

    const before = await activeGet(
      request("/api/platform/organizations/active", adminId, "GET", true)
    )
    expect(before.status).toBe(200)
    expect((await before.json()).organization).toBeNull()

    const enterResponse = await enterRoute(
      request(
        `/api/platform/organizations/${org.id}/enter`,
        adminId,
        "POST",
        true
      ),
      { params: Promise.resolve({ id: String(org.id) }) }
    )
    expect(enterResponse.status).toBe(200)
    expect((await enterResponse.json()).id).toBe(String(org.id))

    const after = await activeGet(
      request("/api/platform/organizations/active", adminId, "GET", true)
    )
    expect((await after.json()).organization).toMatchObject({
      id: String(org.id),
    })

    const exitResponse = await activeDelete(
      request("/api/platform/organizations/active", adminId, "DELETE", true)
    )
    expect(exitResponse.status).toBe(204)

    const afterExit = await activeGet(
      request("/api/platform/organizations/active", adminId, "GET", true)
    )
    expect((await afterExit.json()).organization).toBeNull()
  })

  it("a content route sees the entered organization's data end-to-end", async () => {
    const org = await orgWithWorkspace()
    const adminId = `platform-${randomUUID()}`

    await enterRoute(
      request(
        `/api/platform/organizations/${org.id}/enter`,
        adminId,
        "POST",
        true
      ),
      { params: Promise.resolve({ id: String(org.id) }) }
    )

    const response = await workspacesGet(
      request("/api/workspaces", adminId, "GET", true)
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe("Admin Mode WS")
  })
})
