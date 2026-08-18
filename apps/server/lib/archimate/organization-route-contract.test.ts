/**
 * Route-level authorization contract for organization lifecycle operations.
 * Route modules are imported directly so this stays fast while still testing
 * authentication, authorization, parsing, and error-to-HTTP translation.
 */

import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db, organizations, organizationMembers } from "@workspace/db"
import * as organizationsRoute from "../../app/api/organizations/route"
import * as organizationRoute from "../../app/api/organizations/[id]/route"
import { DELETE as deleteAsPlatformAdmin } from "../../app/api/platform/organizations/[id]/route"
import { makeFakeAccessToken } from "./test/keycloak-token-fake"

function request(
  path: string,
  userId: string,
  method: "DELETE" | "PUT",
  platformAdmin = false,
  body?: unknown
): NextRequest {
  const token = makeFakeAccessToken({
    sub: userId,
    preferred_username: userId,
    realm_access: { roles: platformAdmin ? ["platform_admin"] : [] },
  })
  return new NextRequest(`http://localhost:8000${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function organizationWithMembers() {
  const ownerId = `owner-${randomUUID()}`
  const editorId = `editor-${randomUUID()}`
  const viewerId = `viewer-${randomUUID()}`
  const [org] = await db
    .insert(organizations)
    .values({ slug: `contract-${randomUUID()}`, name: "Route Contract" })
    .returning()
  await db.insert(organizationMembers).values([
    { organizationId: org!.id, userId: ownerId, role: "owner" },
    { organizationId: org!.id, userId: editorId, role: "editor" },
    { organizationId: org!.id, userId: viewerId, role: "viewer" },
  ])
  return { org: org!, ownerId, editorId, viewerId }
}

describe("organization lifecycle route contract", () => {
  it("does not expose regular create or delete handlers", () => {
    expect(organizationsRoute).not.toHaveProperty("POST")
    expect(organizationRoute).not.toHaveProperty("DELETE")
  })

  it.each([
    ["owner", "ownerId", 200],
    ["organization editor", "editorId", 403],
    ["viewer", "viewerId", 403],
  ] as const)(
    "allows %s to rename according to policy",
    async (_role, key, status) => {
      const fixture = await organizationWithMembers()
      const response = await organizationRoute.PUT(
        request(
          `/api/organizations/${fixture.org.id}`,
          fixture[key],
          "PUT",
          false,
          {
            name: "Renamed",
          }
        ),
        { params: Promise.resolve({ id: String(fixture.org.id) }) }
      )

      expect(response.status).toBe(status)
    }
  )

  it("reserves deletion for platform_admin", async () => {
    const fixture = await organizationWithMembers()
    const params = { params: Promise.resolve({ id: String(fixture.org.id) }) }

    const userResponse = await deleteAsPlatformAdmin(
      request(
        `/api/platform/organizations/${fixture.org.id}`,
        fixture.ownerId,
        "DELETE"
      ),
      params
    )
    expect(userResponse.status).toBe(403)

    const adminResponse = await deleteAsPlatformAdmin(
      request(
        `/api/platform/organizations/${fixture.org.id}`,
        `platform-${randomUUID()}`,
        "DELETE",
        true
      ),
      params
    )
    expect(adminResponse.status).toBe(204)

    const [deleted] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, fixture.org.id))
    expect(deleted).toBeUndefined()
  })
})
