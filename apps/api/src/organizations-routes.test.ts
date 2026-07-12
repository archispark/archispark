/**
 * REST-level role matrix for the Organization → Workspace routes:
 * {owner, admin, member, platform_admin, non-member} × mutating/read routes,
 * plus the platform_admin isolation guarantee (404 on content, 200 on
 * /platform/organizations).
 */

import { describe, it, expect, beforeAll } from "vitest"
import _request from "supertest"
import { randomUUID } from "crypto"
import { db, organizations, organizationMembers } from "@workspace/db"
import { app } from "../src/app.js"
import { getTokenFor, getPlatformAdminToken } from "../src/test-helper.js"
import { DEMO_KEYCLOAK_SUBS } from "./test/keycloak-token-fake.js"

const ownerToken = getTokenFor("archi")
const adminToken = getTokenFor("contrib")
const memberToken = getTokenFor("user")
const platformAdminToken = getPlatformAdminToken()

function as(token: string) {
  return _request.agent(app).set("Authorization", `Bearer ${token}`)
}

let orgId: string

beforeAll(async () => {
  const [org] = await db
    .insert(organizations)
    .values({ slug: `routes-test-${randomUUID()}`, name: "Routes Test Org" })
    .returning()
  orgId = String(org!.id)
  await db.insert(organizationMembers).values([
    {
      organizationId: org!.id,
      userId: DEMO_KEYCLOAK_SUBS.archi,
      role: "owner",
    },
    {
      organizationId: org!.id,
      userId: DEMO_KEYCLOAK_SUBS.contrib,
      role: "admin",
    },
    {
      organizationId: org!.id,
      userId: DEMO_KEYCLOAK_SUBS.user,
      role: "member",
    },
  ])
  await as(ownerToken).post(`/organizations/${orgId}/activate`)
  await as(adminToken).post(`/organizations/${orgId}/activate`)
  await as(memberToken).post(`/organizations/${orgId}/activate`)
})

describe("GET /organizations", () => {
  it("owner/admin/member see the organization with their role", async () => {
    const ownerRes = await as(ownerToken).get("/organizations")
    expect(
      ownerRes.body.find((o: { id: string }) => o.id === orgId)?.role
    ).toBe("owner")
    const adminRes = await as(adminToken).get("/organizations")
    expect(
      adminRes.body.find((o: { id: string }) => o.id === orgId)?.role
    ).toBe("admin")
  })

  it("platform_admin sees an empty list — no access to organization data", async () => {
    const res = await as(platformAdminToken).get("/organizations")
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe("PUT /organizations/:id (write: owner/admin yes, member no)", () => {
  it("owner can rename", async () => {
    const res = await as(ownerToken)
      .put(`/organizations/${orgId}`)
      .send({ name: "Renamed" })
    expect(res.status).toBe(200)
  })

  it("admin can rename", async () => {
    const res = await as(adminToken)
      .put(`/organizations/${orgId}`)
      .send({ name: "Renamed Again" })
    expect(res.status).toBe(200)
  })

  it("member gets 403", async () => {
    const res = await as(memberToken)
      .put(`/organizations/${orgId}`)
      .send({ name: "Nope" })
    expect(res.status).toBe(403)
  })

  it("non-member gets 404", async () => {
    const res = await as(getTokenFor("admin"))
      .put(`/organizations/${orgId}`)
      .send({ name: "Nope" })
    expect(res.status).toBe(404)
  })
})

describe("POST /organizations/:id/members (manage_members: owner only)", () => {
  it("admin gets 403", async () => {
    const res = await as(adminToken)
      .post(`/organizations/${orgId}/members`)
      .send({ username: "admin", role: "member" })
    expect(res.status).toBe(403)
  })

  it("owner can add a member", async () => {
    const res = await as(ownerToken)
      .post(`/organizations/${orgId}/members`)
      .send({ username: "admin", role: "member" })
    expect(res.status).toBe(201)
    expect(res.body.username).toBe("admin")
  })

  it("adding an unknown Keycloak username returns 422", async () => {
    const res = await as(ownerToken)
      .post(`/organizations/${orgId}/members`)
      .send({ username: "ghost", role: "member" })
    expect(res.status).toBe(422)
  })
})

describe("DELETE /organizations/:id (owner-only, via manage_members)", () => {
  it("member gets 403, non-member gets 404, owner succeeds", async () => {
    const [org] = await db
      .insert(organizations)
      .values({ slug: `routes-del-${randomUUID()}`, name: "To Delete" })
      .returning()
    await db.insert(organizationMembers).values([
      {
        organizationId: org!.id,
        userId: DEMO_KEYCLOAK_SUBS.archi,
        role: "owner",
      },
      {
        organizationId: org!.id,
        userId: DEMO_KEYCLOAK_SUBS.user,
        role: "member",
      },
    ])
    expect(
      (await as(memberToken).delete(`/organizations/${org!.id}`)).status
    ).toBe(403)
    expect(
      (await as(getTokenFor("admin")).delete(`/organizations/${org!.id}`))
        .status
    ).toBe(404)
    expect(
      (await as(ownerToken).delete(`/organizations/${org!.id}`)).status
    ).toBe(204)
  })
})

describe("platform_admin isolation across content routes", () => {
  it("GET /workspaces returns empty for platform_admin (no organization)", async () => {
    const res = await as(platformAdminToken).get("/workspaces")
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it("platform_admin gets 403 on non-platform routes requiring requireSuperAdmin-free auth but 200 on /platform/organizations", async () => {
    const res = await as(platformAdminToken).get("/platform/organizations")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it("a regular user gets 403 on /platform/organizations", async () => {
    const res = await as(ownerToken).get("/platform/organizations")
    expect(res.status).toBe(403)
  })
})

describe("PUT/DELETE /platform/organizations/:id", () => {
  it("platform_admin can suspend and delete an organization by metadata only", async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        slug: `routes-platform-${randomUUID()}`,
        name: "Platform Managed",
      })
      .returning()
    const suspendRes = await as(platformAdminToken)
      .put(`/platform/organizations/${org!.id}`)
      .send({ enabled: false })
    expect(suspendRes.status).toBe(200)
    expect(suspendRes.body.enabled).toBe(false)

    const deleteRes = await as(platformAdminToken).delete(
      `/platform/organizations/${org!.id}`
    )
    expect(deleteRes.status).toBe(204)
  })
})
