/**
 * REST-level coverage for the invitation routes: owner-only management
 * (create/list/revoke/resend) and the token-gated invitee-facing routes
 * (preview/accept) — see .claude/rules/api.md for the error-code
 * conventions this asserts against.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import _request from "supertest"
import { randomUUID } from "crypto"
import { db, organizations, organizationMembers } from "@workspace/db"
import { app } from "./app.js"
import { getTokenFor } from "./test-helper.js"
import {
  DEMO_KEYCLOAK_SUBS,
  makeFakeAccessToken,
} from "./test/keycloak-token-fake.js"

vi.mock("./mail.js", async () => import("./test/mail-fake.js"))
import { resetMailFake, getSentInvitationEmails } from "./test/mail-fake.js"

const ownerToken = getTokenFor("archi")
const adminToken = getTokenFor("contrib")
const memberToken = getTokenFor("user")

function as(token: string) {
  return _request.agent(app).set("Authorization", `Bearer ${token}`)
}

function tokenFromAcceptUrl(acceptUrl: string): string {
  return acceptUrl.split("/").pop()!
}

async function lastInvitationToken(): Promise<string> {
  const emails = getSentInvitationEmails()
  return tokenFromAcceptUrl(emails[emails.length - 1]!.acceptUrl)
}

let orgId: string

beforeAll(async () => {
  const [org] = await db
    .insert(organizations)
    .values({
      slug: `inv-routes-${randomUUID()}`,
      name: "Invitation Routes Org",
    })
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
})

beforeEach(() => {
  resetMailFake()
})

describe("POST /organizations/:id/invitations (manage_members: owner only)", () => {
  it("admin gets 403", async () => {
    const res = await as(adminToken)
      .post(`/organizations/${orgId}/invitations`)
      .send({ email: `x-${randomUUID()}@example.com`, role: "member" })
    expect(res.status).toBe(403)
  })

  it("owner creates an invitation", async () => {
    const email = `route-invite-${randomUUID()}@example.com`
    const res = await as(ownerToken)
      .post(`/organizations/${orgId}/invitations`)
      .send({ email, role: "member" })
    expect(res.status).toBe(201)
    expect(res.body.email).toBe(email)
    expect(res.body.sent_at).not.toBeNull()
    expect(res.body.token).toBeUndefined()
  })

  it("rejects an invalid e-mail with 422", async () => {
    const res = await as(ownerToken)
      .post(`/organizations/${orgId}/invitations`)
      .send({ email: "not-an-email", role: "member" })
    expect(res.status).toBe(422)
  })

  it("rejects a non-member organization id with 404", async () => {
    const res = await as(getTokenFor("admin"))
      .post(`/organizations/${orgId}/invitations`)
      .send({ email: `x-${randomUUID()}@example.com`, role: "member" })
    expect(res.status).toBe(404)
  })
})

describe("GET /organizations/:id/invitations (read: any member)", () => {
  it("member can list pending invitations", async () => {
    const email = `route-list-${randomUUID()}@example.com`
    await as(ownerToken)
      .post(`/organizations/${orgId}/invitations`)
      .send({ email, role: "member" })

    const res = await as(memberToken).get(`/organizations/${orgId}/invitations`)
    expect(res.status).toBe(200)
    expect(res.body.some((i: { email: string }) => i.email === email)).toBe(
      true
    )
  })
})

describe("DELETE /organizations/:id/invitations/:invitationId (owner only)", () => {
  it("admin gets 403, owner succeeds", async () => {
    const email = `route-revoke-${randomUUID()}@example.com`
    const created = await as(ownerToken)
      .post(`/organizations/${orgId}/invitations`)
      .send({ email, role: "member" })

    expect(
      (
        await as(adminToken).delete(
          `/organizations/${orgId}/invitations/${created.body.id}`
        )
      ).status
    ).toBe(403)

    expect(
      (
        await as(ownerToken).delete(
          `/organizations/${orgId}/invitations/${created.body.id}`
        )
      ).status
    ).toBe(204)
  })
})

describe("POST /organizations/:id/invitations/:invitationId/resend (owner only)", () => {
  it("resends and returns a new invitation", async () => {
    const email = `route-resend-${randomUUID()}@example.com`
    const created = await as(ownerToken)
      .post(`/organizations/${orgId}/invitations`)
      .send({ email, role: "member" })

    const res = await as(ownerToken).post(
      `/organizations/${orgId}/invitations/${created.body.id}/resend`
    )
    expect(res.status).toBe(201)
    expect(res.body.email).toBe(email)
  })

  it("404s for an unknown invitation id", async () => {
    const res = await as(ownerToken).post(
      `/organizations/${orgId}/invitations/999999999/resend`
    )
    expect(res.status).toBe(404)
  })
})

describe("GET /invitations/:token (preview)", () => {
  it("401s without authentication — the token is never examined", async () => {
    const res = await _request(app).get("/invitations/whatever")
    expect(res.status).toBe(401)
  })

  it("404s for an unknown token, once authenticated", async () => {
    const res = await as(memberToken).get("/invitations/does-not-exist")
    expect(res.status).toBe(404)
  })

  it("returns organization/role/email for a valid token", async () => {
    const email = `route-preview-${randomUUID()}@example.com`
    await as(ownerToken)
      .post(`/organizations/${orgId}/invitations`)
      .send({ email, role: "admin" })
    const token = await lastInvitationToken()

    const res = await as(memberToken).get(`/invitations/${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ role: "admin", email })
  })
})

describe("POST /invitations/:token/accept", () => {
  it("401s without authentication", async () => {
    const res = await _request(app).post("/invitations/whatever/accept")
    expect(res.status).toBe(401)
  })

  it("422s when the caller's e-mail isn't verified", async () => {
    const email = `route-accept-unverified-${randomUUID()}@example.com`
    await as(ownerToken)
      .post(`/organizations/${orgId}/invitations`)
      .send({ email, role: "member" })
    const token = await lastInvitationToken()

    const unverifiedToken = makeFakeAccessToken({
      sub: `invitee-${randomUUID()}`,
      email,
      email_verified: false,
    })
    const res = await as(unverifiedToken).post(`/invitations/${token}/accept`)
    expect(res.status).toBe(422)
  })

  it("422s when the caller's e-mail doesn't match", async () => {
    const email = `route-accept-mismatch-${randomUUID()}@example.com`
    await as(ownerToken)
      .post(`/organizations/${orgId}/invitations`)
      .send({ email, role: "member" })
    const token = await lastInvitationToken()

    const mismatchedToken = makeFakeAccessToken({
      sub: `invitee-${randomUUID()}`,
      email: `someone-else-${randomUUID()}@example.com`,
      email_verified: true,
    })
    const res = await as(mismatchedToken).post(`/invitations/${token}/accept`)
    expect(res.status).toBe(422)
  })

  it("accepts a valid invitation and adds the member", async () => {
    const email = `route-accept-ok-${randomUUID()}@example.com`
    await as(ownerToken)
      .post(`/organizations/${orgId}/invitations`)
      .send({ email, role: "admin" })
    const token = await lastInvitationToken()

    const inviteeSub = `invitee-${randomUUID()}`
    const inviteeToken = makeFakeAccessToken({
      sub: inviteeSub,
      email,
      email_verified: true,
    })
    const res = await as(inviteeToken).post(`/invitations/${token}/accept`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ organization_id: orgId, role: "admin" })

    const membersRes = await as(ownerToken).get(
      `/organizations/${orgId}/members`
    )
    expect(
      membersRes.body.some(
        (m: { user_id: string; role: string }) =>
          m.user_id === inviteeSub && m.role === "admin"
      )
    ).toBe(true)
  })
})
