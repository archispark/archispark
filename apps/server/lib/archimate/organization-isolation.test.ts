/** Verifies that an organization member cannot discover or mutate another organization's data. */

import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import {
  db,
  organizations,
  organizationMembers,
  userActiveOrganization,
  workspaces,
} from "@workspace/db"
import { GET, POST } from "../../app/api/workspaces/route"
import { DELETE } from "../../app/api/workspaces/[id]/route"
import { POST as activateOrganization } from "../../app/api/organizations/[id]/activate/route"
import { makeFakeAccessToken } from "./test/keycloak-token-fake"

function request(
  path: string,
  userId: string,
  method: "DELETE" | "GET" | "POST",
  body?: unknown
): NextRequest {
  const token = makeFakeAccessToken({
    sub: userId,
    preferred_username: userId,
    realm_access: { roles: [] },
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

describe("organization data isolation", () => {
  it("filters lists and rejects cross-organization workspace and activation requests", async () => {
    const userId = `isolation-user-${randomUUID()}`
    const [organizationA, organizationB] = await db
      .insert(organizations)
      .values([
        { slug: `isolation-a-${randomUUID()}`, name: "Organization A" },
        { slug: `isolation-b-${randomUUID()}`, name: "Organization B" },
      ])
      .returning()
    await db.insert(organizationMembers).values({
      organizationId: organizationA!.id,
      userId,
      role: "owner",
    })
    await db.insert(userActiveOrganization).values({
      userId,
      organizationId: organizationA!.id,
    })
    const [, workspaceB] = await db
      .insert(workspaces)
      .values([
        {
          uuid: `id-${randomUUID()}`,
          name: "Workspace A",
          organizationId: organizationA!.id,
          createdById: userId,
        },
        {
          uuid: `id-${randomUUID()}`,
          name: "Workspace B",
          organizationId: organizationB!.id,
          createdById: `owner-b-${randomUUID()}`,
        },
      ])
      .returning()

    const listResponse = await GET(request("/api/workspaces", userId, "GET"))
    expect(listResponse.status).toBe(200)
    await expect(listResponse.json()).resolves.toEqual([
      expect.objectContaining({
        name: "Workspace A",
        organization_id: String(organizationA!.id),
      }),
    ])

    const createResponse = await POST(
      request("/api/workspaces", userId, "POST", {
        name: "Forbidden workspace",
        organization_id: String(organizationB!.id),
      })
    )
    expect(createResponse.status).toBe(404)

    const deleteResponse = await DELETE(
      request(`/api/workspaces/${workspaceB!.id}`, userId, "DELETE"),
      { params: Promise.resolve({ id: String(workspaceB!.id) }) }
    )
    expect(deleteResponse.status).toBe(404)

    const activateResponse = await activateOrganization(
      request(
        `/api/organizations/${organizationB!.id}/activate`,
        userId,
        "POST"
      ),
      { params: Promise.resolve({ id: String(organizationB!.id) }) }
    )
    expect(activateResponse.status).toBe(404)
  })
})
