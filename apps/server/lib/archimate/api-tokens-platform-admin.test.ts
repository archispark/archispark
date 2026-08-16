/**
 * Guard test for app/api/settings/api-tokens POST — platform_admin must not
 * be able to mint a personal token pinned to an organization. See route.ts
 * for the rationale.
 */

import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { db, organizations, organizationMembers } from "@workspace/db"
import { POST as createApiToken } from "../../app/api/settings/api-tokens/route"
import { makeFakeAccessToken } from "./test/keycloak-token-fake"

function request(
  userId: string,
  platformAdmin: boolean,
  body: unknown
): NextRequest {
  const token = makeFakeAccessToken({
    sub: userId,
    preferred_username: userId,
    realm_access: { roles: platformAdmin ? ["platform_admin"] : [] },
  })
  return new NextRequest("http://localhost:8000/api/settings/api-tokens", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

describe("POST /api/settings/api-tokens — platform_admin guard", () => {
  it("rejects platform_admin with 403, regardless of the organization", async () => {
    const [org] = await db
      .insert(organizations)
      .values({ slug: `api-token-guard-${randomUUID()}`, name: "Guard Org" })
      .returning()

    const response = await createApiToken(
      request(`platform-${randomUUID()}`, true, {
        name: "My token",
        organization_id: String(org!.id),
      })
    )
    expect(response.status).toBe(403)
  })

  it("still allows a regular member to create a token for their organization", async () => {
    const [org] = await db
      .insert(organizations)
      .values({ slug: `api-token-guard-ok-${randomUUID()}`, name: "OK Org" })
      .returning()
    const userId = `user-${randomUUID()}`
    await db
      .insert(organizationMembers)
      .values({ organizationId: org!.id, userId, role: "owner" })

    const response = await createApiToken(
      request(userId, false, {
        name: "My token",
        organization_id: String(org!.id),
      })
    )
    expect(response.status).toBe(201)
  })
})
