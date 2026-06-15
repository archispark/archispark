/**
 * Tests for the org-scoped routes added in Phase 4 (apps/control-api/src/app.ts):
 *   GET/PUT/DELETE  /organizations/members[/:userId]
 *   GET/POST/DELETE /organizations/invitations[/:invitationId]
 *   GET/POST/PUT/DELETE /organizations/teams[/:teamId]
 *   GET/POST/DELETE /organizations/teams/:teamId/members[/:userId]
 * plus /admin/organizations/:id/verify-db and
 * /admin/organizations/:id/reprovision, and the X-Org-Id / `organizations`
 * JWT claim fast path in resolveWorkspaceContext / getMembershipContext.
 */

import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import _request from "supertest";
import { provisionTenantDatabase } from "@workspace/db";
import { verifyAccessToken, addOrgMember, setOrgMemberRoles, createOrganization, ensureDefaultOrgRoles } from "@workspace/auth";
import { app } from "../src/app.js";
import { createUser } from "../src/auth.js";
import { getAdminCookie, getUserCookie, getContribCookie, getAdminWorkspaceContext } from "../src/test-helper.js";
import { DEMO_KEYCLOAK_SUBS } from "./test/keycloak-token-fake.js";

vi.mock("@workspace/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/auth")>();
  const { fakeOrgsApi } = await import("./test/keycloak-orgs-fake.js");
  const { fakeUsersApi, seedDemoKeycloakUsers } = await import("./test/keycloak-users-fake.js");
  const { fakeVerifyAccessToken } = await import("./test/keycloak-token-fake.js");
  seedDemoKeycloakUsers();
  return { ...actual, ...fakeOrgsApi, ...fakeUsersApi, verifyAccessToken: vi.fn().mockImplementation(fakeVerifyAccessToken) };
});

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    provisionTenantDatabase: vi.fn(actual.provisionTenantDatabase),
  };
});

let adminCookie: string;
let userCookie: string;
let contribCookie: string;
let defaultOrgId: string;

beforeAll(async () => {
  adminCookie = await getAdminCookie();
  userCookie = await getUserCookie();
  contribCookie = await getContribCookie();
  const { ctx } = await getAdminWorkspaceContext();
  defaultOrgId = ctx.organizationId;
});

afterEach(() => {
  vi.clearAllMocks();
});

function request(appArg: Parameters<typeof _request>[0], cookie = adminCookie) {
  return _request.agent(appArg).set("Cookie", cookie);
}

// ---------------------------------------------------------------------------
// GET /organizations/members
// ---------------------------------------------------------------------------

describe("GET /organizations/members", () => {
  it("returns members with their resolved org role", async () => {
    const res = await request(app).get("/organizations/members");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const archi = (res.body as Array<{ username: string; role: string | null }>).find((m) => m.username === "archi");
    expect(archi).toBeDefined();
    expect(archi?.role).toBe("owner");
  });

  it("excludes users holding the platform_admin realm role", async () => {
    const res = await request(app).get("/organizations/members");
    expect(res.status).toBe(200);
    const admin = (res.body as Array<{ username: string }>).find((m) => m.username === "admin");
    expect(admin).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GET /organizations/members — cross-tenant isolation
// ---------------------------------------------------------------------------

describe("GET /organizations/members — cross-tenant isolation", () => {
  it("never returns members of an organization the requester does not belong to", async () => {
    // Create a second, unrelated organization with its own owner.
    const otherOrgId = await createOrganization({ name: "Other Org", attributes: { slug: ["other-org"] } });
    await ensureDefaultOrgRoles(otherOrgId);
    const otherOwnerId = randomUUID();
    await addOrgMember(otherOrgId, otherOwnerId);
    await setOrgMemberRoles(otherOrgId, otherOwnerId, "owner");

    // "admin"'s JWT `organizations` claim only carries the default org —
    // resolveWorkspaceContext ignores an X-Org-Id that isn't one of its keys
    // and falls back to the requester's own org instead.
    const res = await request(app).get("/organizations/members").set("X-Org-Id", otherOrgId);

    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ user_id: string }>).map((m) => m.user_id);
    expect(ids).not.toContain(otherOwnerId);
    expect(ids).toContain(DEMO_KEYCLOAK_SUBS.archi);
  });
});

// ---------------------------------------------------------------------------
// requireOrgOwner — /organizations/* is owner-only (admin and member blocked)
// ---------------------------------------------------------------------------

describe("requireOrgOwner — /organizations/* is owner-only", () => {
  it("returns 403 for GET /organizations/members for a read-only member", async () => {
    const res = await request(app, userCookie).get("/organizations/members");
    expect(res.status).toBe(403);
  });

  it("returns 403 for GET /organizations/invitations for a read-only member", async () => {
    const res = await request(app, userCookie).get("/organizations/invitations");
    expect(res.status).toBe(403);
  });

  it("returns 403 for GET /organizations/teams for a read-only member", async () => {
    const res = await request(app, userCookie).get("/organizations/teams");
    expect(res.status).toBe(403);
  });

  it("returns 403 for GET /organizations/members for an org admin", async () => {
    const res = await request(app, contribCookie).get("/organizations/members");
    expect(res.status).toBe(403);
  });

  it("returns 403 for GET /organizations/invitations for an org admin", async () => {
    const res = await request(app, contribCookie).get("/organizations/invitations");
    expect(res.status).toBe(403);
  });

  it("returns 403 for GET /organizations/teams for an org admin", async () => {
    const res = await request(app, contribCookie).get("/organizations/teams");
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PUT /organizations/members/:userId
// ---------------------------------------------------------------------------

describe("PUT /organizations/members/:userId", () => {
  it("returns 422 for an invalid role", async () => {
    const res = await request(app).put("/organizations/members/some-user").send({ role: "superuser" });
    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/role/);
  });

  it("returns 403 for a read-only member", async () => {
    const res = await request(app, userCookie).put("/organizations/members/some-user").send({ role: "admin" });
    expect(res.status).toBe(403);
  });

  it("returns 403 for an org admin (/organizations/* is owner-only)", async () => {
    const res = await request(app, contribCookie).put("/organizations/members/some-user").send({ role: "admin" });
    expect(res.status).toBe(403);
  });

  it("updates a member's role to admin", async () => {
    const memberSub = randomUUID();
    await addOrgMember(defaultOrgId, memberSub);
    await setOrgMemberRoles(defaultOrgId, memberSub, "member");

    const res = await request(app).put(`/organizations/members/${memberSub}`).send({ role: "admin" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const list = await request(app).get("/organizations/members");
    const updated = (list.body as Array<{ user_id: string; role: string | null }>).find((m) => m.user_id === memberSub);
    expect(updated?.role).toBe("admin");
  });
});

// ---------------------------------------------------------------------------
// DELETE /organizations/members/:userId
// ---------------------------------------------------------------------------

describe("DELETE /organizations/members/:userId", () => {
  it("returns 403 for a read-only member", async () => {
    const res = await request(app, userCookie).delete("/organizations/members/some-user");
    expect(res.status).toBe(403);
  });

  it("removes a member", async () => {
    const memberSub = randomUUID();
    await addOrgMember(defaultOrgId, memberSub);
    await setOrgMemberRoles(defaultOrgId, memberSub, "member");

    const res = await request(app).delete(`/organizations/members/${memberSub}`);
    expect(res.status).toBe(204);

    const list = await request(app).get("/organizations/members");
    const found = (list.body as Array<{ user_id: string }>).find((m) => m.user_id === memberSub);
    expect(found).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GET/POST/DELETE /organizations/invitations
// ---------------------------------------------------------------------------

describe("GET /organizations/invitations", () => {
  it("returns an empty array initially", async () => {
    const res = await request(app).get("/organizations/invitations");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /organizations/invitations", () => {
  it("returns 422 when email is missing", async () => {
    const res = await request(app).post("/organizations/invitations").send({ role: "member" });
    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/email/);
  });

  it("returns 422 when email is blank", async () => {
    const res = await request(app).post("/organizations/invitations").send({ email: "   ", role: "member" });
    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/email/);
  });

  it("returns 422 for an invalid role", async () => {
    const res = await request(app).post("/organizations/invitations").send({ email: "invitee@example.com", role: "superuser" });
    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/role/);
  });

  it("returns 403 for a read-only member", async () => {
    const res = await request(app, userCookie).post("/organizations/invitations").send({ email: "invitee@example.com", role: "member" });
    expect(res.status).toBe(403);
  });

  it("returns 403 for an org admin (/organizations/* is owner-only)", async () => {
    const res = await request(app, contribCookie).post("/organizations/invitations").send({ email: "invitee@example.com", role: "member" });
    expect(res.status).toBe(403);
  });

  it("creates an invitation and trims the email", async () => {
    const res = await request(app).post("/organizations/invitations").send({ email: "  invitee@example.com  ", role: "member" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: "invitee@example.com", roles: ["member"] });
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("created_at");
  });

  it("lists the created invitation", async () => {
    const res = await request(app).get("/organizations/invitations");
    expect(res.status).toBe(200);
    const found = (res.body as Array<{ email: string }>).find((i) => i.email === "invitee@example.com");
    expect(found).toBeDefined();
  });
});

describe("DELETE /organizations/invitations/:invitationId", () => {
  it("returns 403 for a read-only member", async () => {
    const res = await request(app, userCookie).delete("/organizations/invitations/whatever");
    expect(res.status).toBe(403);
  });

  it("returns 403 for an org admin (/organizations/* is owner-only)", async () => {
    const res = await request(app, contribCookie).delete("/organizations/invitations/whatever");
    expect(res.status).toBe(403);
  });

  it("cancels an invitation", async () => {
    const create = await request(app).post("/organizations/invitations").send({ email: "cancel-me@example.com", role: "member" });
    const invitationId = (create.body as { id: string }).id;

    const res = await request(app).delete(`/organizations/invitations/${invitationId}`);
    expect(res.status).toBe(204);

    const list = await request(app).get("/organizations/invitations");
    const found = (list.body as Array<{ id: string }>).find((i) => i.id === invitationId);
    expect(found).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GET/POST/PUT/DELETE /organizations/teams
// ---------------------------------------------------------------------------

describe("POST /organizations/teams", () => {
  it("returns 422 when name is missing", async () => {
    const res = await request(app).post("/organizations/teams").send({});
    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/name/);
  });

  it("returns 422 when name is blank", async () => {
    const res = await request(app).post("/organizations/teams").send({ name: "   " });
    expect(res.status).toBe(422);
  });

  it("returns 403 for a read-only member", async () => {
    const res = await request(app, userCookie).post("/organizations/teams").send({ name: "Engineering" });
    expect(res.status).toBe(403);
  });

  it("creates a team, trimming the name", async () => {
    const res = await request(app).post("/organizations/teams").send({ name: "  Engineering  " });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Engineering", organization_id: defaultOrgId });
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("created_at");
  });
});

describe("GET /organizations/teams", () => {
  it("lists teams for the current organization", async () => {
    const res = await request(app).get("/organizations/teams");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = (res.body as Array<{ name: string }>).find((t) => t.name === "Engineering");
    expect(found).toBeDefined();
  });
});

describe("PUT /organizations/teams/:teamId", () => {
  let teamId: string;

  beforeAll(async () => {
    const res = await request(app).post("/organizations/teams").send({ name: "To Rename" });
    teamId = (res.body as { id: string }).id;
  });

  it("returns 422 when name is missing", async () => {
    const res = await request(app).put(`/organizations/teams/${teamId}`).send({});
    expect(res.status).toBe(422);
  });

  it("returns 404 for an unknown team", async () => {
    const res = await request(app).put("/organizations/teams/does-not-exist").send({ name: "X" });
    expect(res.status).toBe(404);
  });

  it("returns 403 for a read-only member", async () => {
    const res = await request(app, userCookie).put(`/organizations/teams/${teamId}`).send({ name: "Renamed" });
    expect(res.status).toBe(403);
  });

  it("renames the team", async () => {
    const res = await request(app).put(`/organizations/teams/${teamId}`).send({ name: "  Renamed  " });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: teamId, name: "Renamed" });
  });
});

describe("DELETE /organizations/teams/:teamId", () => {
  let teamId: string;

  beforeAll(async () => {
    const res = await request(app).post("/organizations/teams").send({ name: "To Delete" });
    teamId = (res.body as { id: string }).id;
  });

  it("returns 404 for an unknown team", async () => {
    const res = await request(app).delete("/organizations/teams/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("returns 403 for a read-only member", async () => {
    const res = await request(app, userCookie).delete(`/organizations/teams/${teamId}`);
    expect(res.status).toBe(403);
  });

  it("deletes the team", async () => {
    const res = await request(app).delete(`/organizations/teams/${teamId}`);
    expect(res.status).toBe(204);

    const list = await request(app).get("/organizations/teams");
    const found = (list.body as Array<{ id: string }>).find((t) => t.id === teamId);
    expect(found).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GET/POST/DELETE /organizations/teams/:teamId/members
// ---------------------------------------------------------------------------

describe("/organizations/teams/:teamId/members", () => {
  let teamId: string;
  let memberSub: string;
  let memberUserId: string;

  beforeAll(async () => {
    const teamRes = await request(app).post("/organizations/teams").send({ name: "Members Team" });
    teamId = (teamRes.body as { id: string }).id;

    // Create a Keycloak-native user and add it as an org member so
    // listOrgMembers (used by listTeamMembersOut) resolves a username/email.
    const created = await createUser("team_member_ci", "password123", "user");
    memberUserId = created.id;
    memberSub = created.id;
    await addOrgMember(defaultOrgId, memberSub);
    await setOrgMemberRoles(defaultOrgId, memberSub, "member");
  });

  it("GET returns 404 for an unknown team", async () => {
    const res = await request(app).get("/organizations/teams/does-not-exist/members");
    expect(res.status).toBe(404);
  });

  it("GET returns an empty array initially", async () => {
    const res = await request(app).get(`/organizations/teams/${teamId}/members`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST returns 422 when user_id is missing", async () => {
    const res = await request(app).post(`/organizations/teams/${teamId}/members`).send({});
    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/user_id/);
  });

  it("POST returns 404 for an unknown team", async () => {
    const res = await request(app).post("/organizations/teams/does-not-exist/members").send({ user_id: memberSub });
    expect(res.status).toBe(404);
  });

  it("POST returns 403 for a read-only member", async () => {
    const res = await request(app, userCookie).post(`/organizations/teams/${teamId}/members`).send({ user_id: memberSub });
    expect(res.status).toBe(403);
  });

  it("POST adds a member to the team", async () => {
    const res = await request(app).post(`/organizations/teams/${teamId}/members`).send({ user_id: memberSub });
    expect(res.status).toBe(204);
  });

  it("POST is idempotent when the member is already on the team", async () => {
    const res = await request(app).post(`/organizations/teams/${teamId}/members`).send({ user_id: memberSub });
    expect(res.status).toBe(204);
  });

  it("GET lists the team's members with resolved username/email", async () => {
    const res = await request(app).get(`/organizations/teams/${teamId}/members`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ user_id: memberSub, username: "team_member_ci", email: "team_member_ci@archispark.internal" }]);
  });

  it("DELETE returns 404 for an unknown team", async () => {
    const res = await request(app).delete(`/organizations/teams/does-not-exist/members/${memberSub}`);
    expect(res.status).toBe(404);
  });

  it("DELETE returns 403 for a read-only member", async () => {
    const res = await request(app, userCookie).delete(`/organizations/teams/${teamId}/members/${memberSub}`);
    expect(res.status).toBe(403);
  });

  it("DELETE removes the member from the team", async () => {
    const res = await request(app).delete(`/organizations/teams/${teamId}/members/${memberSub}`);
    expect(res.status).toBe(204);

    const list = await request(app).get(`/organizations/teams/${teamId}/members`);
    expect(list.body).toEqual([]);
  });

  it("falls back to the raw userId when the team member is no longer an org member", async () => {
    // Re-add the row directly without an org membership — listTeamMembersOut
    // falls back to userId as the username and null email.
    const orphanUserId = randomUUID();
    await request(app).post(`/organizations/teams/${teamId}/members`).send({ user_id: orphanUserId });
    const res = await request(app).get(`/organizations/teams/${teamId}/members`);
    expect(res.body).toEqual([{ user_id: orphanUserId, username: orphanUserId, email: null }]);
  });

  it("cleans up the test user", async () => {
    await request(app).delete(`/users/${memberUserId}`);
  });
});

// ---------------------------------------------------------------------------
// X-Org-Id header / `organizations` JWT claim fast path
// ---------------------------------------------------------------------------

describe("resolveWorkspaceContext — X-Org-Id header and orgClaims fast path", () => {
  it("uses the role from the JWT's organizations claim without a Phasetwo round trip when X-Org-Id matches", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: DEMO_KEYCLOAK_SUBS.admin,
      preferred_username: "admin",
      realm_access: { roles: ["platform_admin"] },
      organizations: { [defaultOrgId]: { name: "Default", roles: ["owner"] } },
    });
    const res = await _request(app)
      .get("/organizations/members")
      .set("Authorization", "Bearer kc-fake-jwt-token")
      .set("X-Org-Id", defaultOrgId);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("ignores X-Org-Id when it is not one of the JWT's organization claim keys", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: DEMO_KEYCLOAK_SUBS.admin,
      preferred_username: "admin",
      realm_access: { roles: ["platform_admin"] },
      organizations: { [defaultOrgId]: { name: "Default", roles: ["owner"] } },
    });
    const res = await _request(app)
      .get("/organizations/members")
      .set("Authorization", "Bearer kc-fake-jwt-token")
      .set("X-Org-Id", "some-other-org-id");
    // Falls back to the first key of the organizations claim (defaultOrgId) — still resolves.
    expect(res.status).toBe(200);
  });

  it("returns 403 when the user's organizations claim doesn't include any role known to ArchiSpark", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: DEMO_KEYCLOAK_SUBS.admin,
      preferred_username: "admin",
      realm_access: { roles: ["platform_admin"] },
      organizations: { [defaultOrgId]: { name: "Default", roles: ["not-an-archispark-role"] } },
    });
    const res = await _request(app)
      .get("/me")
      .set("Authorization", "Bearer kc-fake-jwt-token")
      .set("X-Org-Id", defaultOrgId);
    expect(res.status).toBe(403);
    expect(res.body.detail).toBe("Accès à cette organisation refusé.");
  });
});

// ---------------------------------------------------------------------------
// POST /admin/organizations/:id/verify-db
// ---------------------------------------------------------------------------

describe("POST /admin/organizations/:id/verify-db", () => {
  it("returns 403 for non-admin", async () => {
    const res = await request(app, userCookie).post(`/admin/organizations/${defaultOrgId}/verify-db`);
    expect(res.status).toBe(403);
  });

  it("returns connected: false when the organization has no active tenant database", async () => {
    const res = await request(app).post(`/admin/organizations/${defaultOrgId}/verify-db`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: false, latency_ms: 0 });
  });
});

// ---------------------------------------------------------------------------
// POST /admin/organizations/:id/reprovision
// ---------------------------------------------------------------------------

describe("POST /admin/organizations/:id/reprovision", () => {
  it("returns 403 for non-admin", async () => {
    const res = await request(app, userCookie).post(`/admin/organizations/${defaultOrgId}/reprovision`);
    expect(res.status).toBe(403);
  });

  it("returns 503 when provisioning fails", async () => {
    vi.mocked(provisionTenantDatabase).mockRejectedValueOnce(new Error("boom"));
    const res = await request(app).post(`/admin/organizations/${defaultOrgId}/reprovision`);
    expect(res.status).toBe(503);
    expect(res.body.detail).toMatch(/reprovisionnement/);
  });

  it("returns the updated organization on success", async () => {
    vi.mocked(provisionTenantDatabase).mockResolvedValueOnce(undefined);
    const res = await request(app).post(`/admin/organizations/${defaultOrgId}/reprovision`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", defaultOrgId);
  });

  it("returns 404 when provisioning succeeds for an unknown organization id", async () => {
    vi.mocked(provisionTenantDatabase).mockResolvedValueOnce(undefined);
    const res = await request(app).post("/admin/organizations/does-not-exist/reprovision");
    expect(res.status).toBe(404);
    expect(res.body.detail).toMatch(/introuvable/);
  });
});
