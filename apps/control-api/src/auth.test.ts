/**
 * Tests for auth middleware and users routes with Better Auth sessions.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import _request from "supertest";
import type { Response, NextFunction } from "express";
import { app } from "../src/app.js";
import { createUser, requireAuth, type AuthRequest } from "../src/auth.js";
import { getAdminCookie, getUserCookie, getAdminWorkspaceContext } from "../src/test-helper.js";
import { verifyAccessToken, addOrgMember, setOrgMemberRoles } from "@workspace/auth";

vi.mock("@workspace/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/auth")>();
  const { fakeOrgsApi } = await import("./test/keycloak-orgs-fake.js");
  const { fakeUsersApi, seedDemoKeycloakUsers } = await import("./test/keycloak-users-fake.js");
  seedDemoKeycloakUsers();
  return { ...actual, ...fakeOrgsApi, ...fakeUsersApi, verifyAccessToken: vi.fn() };
});

let adminCookie: string;
let userCookie: string;

beforeAll(async () => {
  adminCookie = await getAdminCookie();
  userCookie = await getUserCookie();
});

function request(appArg: Parameters<typeof _request>[0], cookie = adminCookie) {
  return _request.agent(appArg).set("Cookie", cookie);
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

describe("requireAuth middleware", () => {
  it("returns 401 when no session cookie", async () => {
    const res = await _request(app).get("/me");
    expect(res.status).toBe(401);
  });

  it("passes with valid session cookie", async () => {
    const res = await request(app).get("/me");
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("admin");
  });
});

describe("requireAuth — Keycloak bearer token", () => {
  it("authenticates a valid Keycloak token (then fails workspace resolution — Stage 4)", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: "kc-user-1",
      preferred_username: "kcuser",
      realm_access: { roles: ["platform_admin"] },
    });
    const res = await _request(app).get("/me").set("Authorization", "Bearer kc-fake-jwt-token");
    // requireAuth succeeded (no longer 401) — blocked at resolveWorkspaceContext
    // because the Keycloak sub isn't re-keyed to an organization yet.
    expect(res.status).toBe(403);
    expect(res.body.detail).toBe("Aucune organisation associée à cet utilisateur.");
  });

  it("returns 401 when the token is neither a valid API token nor a Keycloak token", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce(null);
    const res = await _request(app).get("/me").set("Authorization", "Bearer not-a-token");
    expect(res.status).toBe(401);
  });

  it("returns 401 when Keycloak verification throws", async () => {
    vi.mocked(verifyAccessToken).mockRejectedValueOnce(new Error("jwks unreachable"));
    const res = await _request(app).get("/me").set("Authorization", "Bearer not-a-token");
    expect(res.status).toBe(401);
  });

  it("falls back to the subject as username when preferred_username is absent, and role 'user' when realm_access has no platform_admin role", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: "kc-user-2",
      realm_access: { roles: ["member"] },
    });
    const req = { headers: { authorization: "Bearer kc-fake-jwt-token" } } as unknown as AuthRequest;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(req.user).toEqual({ id: "kc-user-2", username: "kc-user-2", role: "user" });
    expect(req.sessionActiveOrgId).toBeNull();
  });

  it("falls back to role 'user' when realm_access is absent entirely", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: "kc-user-3",
      preferred_username: "kcuser3",
    });
    const req = { headers: { authorization: "Bearer kc-fake-jwt-token" } } as unknown as AuthRequest;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(req.user).toEqual({ id: "kc-user-3", username: "kcuser3", role: "user" });
  });

  it("bridges the demo admin's pinned Keycloak sub to the existing control-db user — same identity as the Better Auth session", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: "c8a1f6c0-0000-4000-8000-000000000001",
      preferred_username: "admin",
      realm_access: { roles: ["platform_admin"] },
    });
    const sessionRes = await request(app).get("/me");
    const kcRes = await _request(app).get("/me").set("Authorization", "Bearer kc-fake-jwt-token");

    expect(kcRes.status).toBe(200);
    expect(kcRes.body).toEqual(sessionRes.body);
  });

  it("bridges the demo member's pinned Keycloak sub: /me resolves the org role and write routes stay read-only", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: "c8a1f6c0-0000-4000-8000-000000000002",
      preferred_username: "user",
    });
    const sessionRes = await request(app, userCookie).get("/me");
    const kcRes = await _request(app).get("/me").set("Authorization", "Bearer kc-fake-jwt-token");

    expect(kcRes.status).toBe(200);
    expect(kcRes.body).toEqual(sessionRes.body);

    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: "c8a1f6c0-0000-4000-8000-000000000002",
      preferred_username: "user",
    });
    const writeRes = await _request(app)
      .post("/workspaces")
      .set("Authorization", "Bearer kc-fake-jwt-token")
      .send({ name: "Demo" });
    expect(writeRes.status).toBe(403);
  });
});

describe("requireAuth — access_token cookie (Stage 3)", () => {
  it("authenticates via access_token cookie, mapped to the demo admin user — same identity as the Better Auth session", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: "c8a1f6c0-0000-4000-8000-000000000001",
      preferred_username: "admin",
      realm_access: { roles: ["platform_admin"] },
    });
    const sessionRes = await request(app).get("/me");
    const cookieRes = await _request(app).get("/me").set("Cookie", "access_token=fake-jwt");

    expect(cookieRes.status).toBe(200);
    expect(cookieRes.body).toEqual(sessionRes.body);
  });

  it("authenticates via access_token cookie, mapped to the demo member user, and blocks write routes", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: "c8a1f6c0-0000-4000-8000-000000000002",
      preferred_username: "user",
    });
    const sessionRes = await request(app, userCookie).get("/me");
    const cookieRes = await _request(app).get("/me").set("Cookie", "access_token=fake-jwt");

    expect(cookieRes.status).toBe(200);
    expect(cookieRes.body).toEqual(sessionRes.body);

    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: "c8a1f6c0-0000-4000-8000-000000000002",
      preferred_username: "user",
    });
    const writeRes = await _request(app)
      .post("/workspaces")
      .set("Cookie", "access_token=fake-jwt")
      .send({ name: "Demo" });
    expect(writeRes.status).toBe(403);
  });

  it("returns 401 when the access_token cookie is invalid and there is no session", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce(null);
    const res = await _request(app).get("/me").set("Cookie", "access_token=garbage");
    expect(res.status).toBe(401);
  });

  it("returns 401 when there is no access_token cookie and no session", async () => {
    const res = await _request(app).get("/me").set("Cookie", "other_cookie=1");
    expect(res.status).toBe(401);
  });

  it("prefers a valid Better Auth session over an access_token cookie", async () => {
    const res = await _request(app).get("/me").set("Cookie", `${adminCookie}; access_token=should-not-be-used`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("admin");
  });
});

describe("requireSuperAdmin middleware", () => {
  it("returns 403 when user role is not admin", async () => {
    const res = await request(app, userCookie).get("/users");
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Users routes
// ---------------------------------------------------------------------------

describe("GET /users", () => {
  it("returns list of users", async () => {
    const res = await request(app).get("/users");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty("username");
    expect(res.body[0]).toHaveProperty("role");
  });
});

// ---------------------------------------------------------------------------
// Integration tests – /users CRUD
// ---------------------------------------------------------------------------

describe("POST/GET/PUT/DELETE /users lifecycle", () => {
  let userId: string;

  it("creates a user (POST /users)", async () => {
    const res = await request(app).post("/users").send({ username: "testuser_ci", password: "password123", role: "user" });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe("testuser_ci");
    userId = res.body.id as string;
  });

  it("reads users list (GET /users) includes the new user", async () => {
    const res = await request(app).get("/users");
    expect(res.status).toBe(200);
    const found = (res.body as Array<{ id: string }>).find((u) => u.id === userId);
    expect(found).toBeDefined();
  });

  it("updates user role (PUT /users/:id)", async () => {
    const res = await request(app).put(`/users/${userId}`).send({ role: "platform_admin" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("platform_admin");
  });

  it("deletes the user (DELETE /users/:id)", async () => {
    const res = await request(app).delete(`/users/${userId}`);
    expect(res.status).toBe(204);
  });
});

describe("POST /users validation", () => {
  it("returns 422 when username or password is missing", async () => {
    const res = await request(app).post("/users").send({ username: "x" });
    expect(res.status).toBe(422);
  });

  it("defaults role to 'user' when role is omitted", async () => {
    const res = await request(app).post("/users").send({ username: "testuser_norole", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("user");
    await request(app).delete(`/users/${(res.body as { id: string }).id}`);
  });

  it("returns 422 when the username is already taken (covers createUser duplicate-username branch)", async () => {
    const first = await request(app).post("/users").send({ username: "testuser_dup", password: "password123" });
    expect(first.status).toBe(201);

    const second = await request(app).post("/users").send({ username: "testuser_dup", password: "password456" });
    expect(second.status).toBe(422);
    expect(second.body.detail).toContain("testuser_dup");

    await request(app).delete(`/users/${(first.body as { id: string }).id}`);
  });
});

// ---------------------------------------------------------------------------
// updateUserById — password branch (lines 250-251)
// ---------------------------------------------------------------------------

describe("PUT /users/:id password update", () => {
  let userId: string;

  beforeAll(async () => {
    const res = await request(app).post("/users").send({ username: "testpwd_user", password: "initial123", role: "user" });
    userId = (res.body as { id: string }).id;
  });

  it("updates password when provided (covers password branch in updateUserById)", async () => {
    const res = await request(app).put(`/users/${userId}`).send({ password: "new_password_456" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", userId);
  });

  it("cleans up test user", async () => {
    const res = await request(app).delete(`/users/${userId}`);
    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// updateUserById / deleteUserById — not-found and role-toggle branches
// ---------------------------------------------------------------------------

describe("PUT /users/:id and DELETE /users/:id — not found", () => {
  it("returns 404 when updating a non-existent user", async () => {
    const res = await request(app).put("/users/does-not-exist").send({ role: "user" });
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting a non-existent user", async () => {
    const res = await request(app).delete("/users/does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("PUT /users/:id — role toggle (covers both branches of updateUserById)", () => {
  let userId: string;

  beforeAll(async () => {
    const res = await request(app).post("/users").send({ username: "testrole_user", password: "initial123", role: "user" });
    userId = (res.body as { id: string }).id;
  });

  it("promotes a regular user to platform_admin", async () => {
    const res = await request(app).put(`/users/${userId}`).send({ role: "platform_admin" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("platform_admin");
  });

  it("demotes a platform_admin back to user (covers the unassign-role branch)", async () => {
    const res = await request(app).put(`/users/${userId}`).send({ role: "user" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("user");
  });

  it("cleans up test user", async () => {
    const res = await request(app).delete(`/users/${userId}`);
    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// lookupApiToken — Keycloak-native user fallback (no bridged usersTable row)
// ---------------------------------------------------------------------------

describe("lookupApiToken — Keycloak-native user", () => {
  it("resolves a personal token whose owner has no bridged control-db row, using getKeycloakUser/getUserRealmRoles", async () => {
    const { lookupApiToken } = await import("../src/auth.js");
    const { controlDb, apiTokens } = await import("@workspace/db");

    // A Keycloak-native user (created via the Admin API — its id IS the Keycloak sub,
    // with no corresponding usersTable row).
    const created = await createUser("kc_native_user", "password123", "platform_admin");

    const token = "test-kc-native-token";
    await controlDb.insert(apiTokens).values({
      token,
      name: "kc-native",
      userId: created.id,
      organizationId: "default",
      workspaceId: null,
    });

    const result = await lookupApiToken(token);
    expect(result).toEqual({
      id: created.id,
      username: "kc_native_user",
      role: "platform_admin",
      organizationId: "default",
      workspaceId: null,
    });

    // Cleanup
    const { eq } = await import("drizzle-orm");
    await controlDb.delete(apiTokens).where(eq(apiTokens.token, token));
    await request(app).delete(`/users/${created.id}`);
  });

  it("returns null when the token's owner no longer exists in Keycloak", async () => {
    const { lookupApiToken } = await import("../src/auth.js");
    const { controlDb, apiTokens } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");

    const token = "test-kc-missing-token";
    await controlDb.insert(apiTokens).values({
      token,
      name: "kc-missing",
      userId: "kc-sub-does-not-exist",
      organizationId: "default",
      workspaceId: null,
    });

    const result = await lookupApiToken(token);
    expect(result).toBeNull();

    await controlDb.delete(apiTokens).where(eq(apiTokens.token, token));
  });
});

// ---------------------------------------------------------------------------
// requireAuth — catch path (line 283): getSession throws
// ---------------------------------------------------------------------------

describe("requireAuth catch path", () => {
  it("returns 401 with 'Session invalide' when getSession throws", async () => {
    const { getAuth } = await import("../src/better-auth.js");
    vi.spyOn(getAuth().api, "getSession").mockRejectedValueOnce(new Error("db error"));
    const res = await _request(app)
      .get("/me")
      .set("Cookie", "better-auth.session_token=bad-token");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// API tokens — CRUD routes and Bearer token authentication
// ---------------------------------------------------------------------------

describe("GET /settings/api-tokens", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await _request(app).get("/settings/api-tokens");
    expect(res.status).toBe(401);
  });

  it("returns array for admin user", async () => {
    const res = await request(app).get("/settings/api-tokens");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /settings/api-tokens", () => {
  it("returns 422 when name is missing", async () => {
    const res = await request(app).post("/settings/api-tokens").send({});
    expect(res.status).toBe(422);
  });

  it("returns 422 when name is empty string", async () => {
    const res = await request(app).post("/settings/api-tokens").send({ name: "   " });
    expect(res.status).toBe(422);
  });

  it("creates a token and returns it with token value", async () => {
    const res = await request(app).post("/settings/api-tokens").send({ name: "CI token" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("token");
    expect(res.body.name).toBe("CI token");
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(20);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await _request(app).post("/settings/api-tokens").send({ name: "x" });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /settings/api-tokens/:id", () => {
  let tokenId: number;

  beforeAll(async () => {
    const res = await request(app).post("/settings/api-tokens").send({ name: "to delete" });
    tokenId = (res.body as { id: number }).id;
  });

  it("returns 422 for non-numeric id", async () => {
    const res = await request(app).delete("/settings/api-tokens/notanumber");
    expect(res.status).toBe(422);
  });

  it("returns 404 for unknown id", async () => {
    const res = await request(app).delete("/settings/api-tokens/999999");
    expect(res.status).toBe(404);
  });

  it("deletes own token and returns 204", async () => {
    const res = await request(app).delete(`/settings/api-tokens/${tokenId}`);
    expect(res.status).toBe(204);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await _request(app).delete("/settings/api-tokens/1");
    expect(res.status).toBe(401);
  });
});

describe("Bearer token authentication", () => {
  let token: string;
  let tokenId: number;

  beforeAll(async () => {
    const res = await request(app).post("/settings/api-tokens").send({ name: "bearer test" });
    token = (res.body as { token: string }).token;
    tokenId = (res.body as { id: number }).id;
  });

  it("returns 401 for an invalid Bearer token", async () => {
    const res = await _request(app).get("/me").set("Authorization", "Bearer invalidtoken");
    expect(res.status).toBe(401);
  });

  it("authenticates successfully with a valid Bearer token", async () => {
    const res = await _request(app).get("/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("admin");
  });

  it("can access protected routes via Bearer token", async () => {
    const res = await _request(app).get("/settings/api-tokens").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("cleans up bearer test token", async () => {
    const res = await request(app).delete(`/settings/api-tokens/${tokenId}`);
    expect(res.status).toBe(204);
  });
});

describe("API token isolation between users", () => {
  let userTokenId: number;

  beforeAll(async () => {
    // Create a token as the regular user
    const res = await _request.agent(app).set("Cookie", userCookie)
      .post("/settings/api-tokens").send({ name: "user token" });
    userTokenId = (res.body as { id: number }).id;
  });

  it("regular user only sees their own tokens", async () => {
    const res = await _request.agent(app).set("Cookie", userCookie).get("/settings/api-tokens");
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: number }>).map((t) => t.id);
    expect(ids).toContain(userTokenId);
  });

  it("admin sees all tokens including other users'", async () => {
    const res = await request(app).get("/settings/api-tokens");
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: number }>).map((t) => t.id);
    expect(ids).toContain(userTokenId);
  });

  it("regular user cannot delete another user's token", async () => {
    // Create an admin token, then try to delete it as regular user
    const createRes = await request(app).post("/settings/api-tokens").send({ name: "admin-only" });
    const adminTokenId = (createRes.body as { id: number }).id;
    const deleteRes = await _request.agent(app).set("Cookie", userCookie).delete(`/settings/api-tokens/${adminTokenId}`);
    expect(deleteRes.status).toBe(403);
    // Cleanup
    await request(app).delete(`/settings/api-tokens/${adminTokenId}`);
  });

  it("cleans up user token", async () => {
    const res = await request(app).delete(`/settings/api-tokens/${userTokenId}`);
    expect(res.status).toBe(204);
  });
});

describe("API token expiry", () => {
  it("creates a token with expires_at and returns it", async () => {
    const future = Math.floor(Date.now() / 1000) + 86400 * 30;
    const res = await request(app).post("/settings/api-tokens").send({ name: "expiring", expires_at: future });
    expect(res.status).toBe(201);
    expect(res.body.expires_at).toBe(future);
    await request(app).delete(`/settings/api-tokens/${(res.body as { id: number }).id}`);
  });

  it("expires_at appears in token list", async () => {
    const future = Math.floor(Date.now() / 1000) + 86400 * 7;
    const create = await request(app).post("/settings/api-tokens").send({ name: "listed expiry", expires_at: future });
    const id = (create.body as { id: number }).id;
    const list = await request(app).get("/settings/api-tokens");
    const found = (list.body as Array<{ id: number; expires_at: number | null }>).find((t) => t.id === id);
    expect(found?.expires_at).toBe(future);
    await request(app).delete(`/settings/api-tokens/${id}`);
  });

  it("rejects authentication with an expired token", async () => {
    const past = Math.floor(Date.now() / 1000) - 1;
    const create = await request(app).post("/settings/api-tokens").send({ name: "expired", expires_at: past });
    const { token, id } = create.body as { token: string; id: number };
    const res = await _request(app).get("/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    await request(app).delete(`/settings/api-tokens/${id}`);
  });
});

// ---------------------------------------------------------------------------
// Admin organizations — GET/PUT /admin/organizations
// ---------------------------------------------------------------------------

describe("GET /admin/organizations", () => {
  it("returns 403 for non-admin", async () => {
    const res = await request(app, userCookie).get("/admin/organizations");
    expect(res.status).toBe(403);
  });

  it("returns organizations with enabled flag and tenant status", async () => {
    const res = await request(app).get("/admin/organizations");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const org = res.body[0] as Record<string, unknown>;
    expect(org).toHaveProperty("id");
    expect(org).toHaveProperty("name");
    expect(org).toHaveProperty("slug");
    expect(org).toHaveProperty("enabled");
    expect(org).toHaveProperty("created_at");
    expect(org).toHaveProperty("tenant_status");
  });
});

describe("PUT /admin/organizations/:id", () => {
  it("returns 403 for non-admin", async () => {
    const res = await request(app, userCookie).put("/admin/organizations/whatever").send({ enabled: false });
    expect(res.status).toBe(403);
  });

  it("returns 422 when 'enabled' is missing or not boolean", async () => {
    const res = await request(app).put("/admin/organizations/whatever").send({ enabled: "nope" });
    expect(res.status).toBe(422);
  });

  it("returns 404 for an unknown organization", async () => {
    const res = await request(app).put("/admin/organizations/does-not-exist").send({ enabled: false });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// resolveWorkspaceContext — blocks members of a disabled organization
// ---------------------------------------------------------------------------

describe("Disabled organization blocks non-admin members", () => {
  let defaultOrgId: string;
  let memberUserId: string;

  beforeAll(async () => {
    const { ctx } = await getAdminWorkspaceContext();
    defaultOrgId = ctx.organizationId;

    const created = await createUser("member_disabled_org", "password123", "user");
    memberUserId = created.id;
    await addOrgMember(defaultOrgId, memberUserId);
    await setOrgMemberRoles(defaultOrgId, memberUserId, "member");
  });

  /** Keycloak-native member: Bearer JWT carrying the org membership claim. */
  function memberMe() {
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({
      sub: memberUserId,
      preferred_username: "member_disabled_org",
      organizations: { [defaultOrgId]: { name: "Default", roles: ["member"] } },
    });
    return _request(app).get("/me").set("Authorization", "Bearer fake-jwt");
  }

  it("member can access /me while the organization is enabled", async () => {
    const res = await memberMe();
    expect(res.status).toBe(200);
  });

  it("admin disables the organization", async () => {
    const res = await request(app).put(`/admin/organizations/${defaultOrgId}`).send({ enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it("member is blocked once the organization is disabled", async () => {
    const res = await memberMe();
    expect(res.status).toBe(403);
    expect(res.body.detail).toMatch(/désactivée/);
  });

  it("platform admin bypasses the disabled-organization check on their own org", async () => {
    const res = await request(app).get("/admin/organizations");
    expect(res.status).toBe(200);
  });

  it("admin re-enables the organization", async () => {
    const res = await request(app).put(`/admin/organizations/${defaultOrgId}`).send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });

  it("member regains access once re-enabled", async () => {
    const res = await memberMe();
    expect(res.status).toBe(200);
  });

  it("cleans up test user", async () => {
    const res = await request(app).delete(`/users/${memberUserId}`);
    expect(res.status).toBe(204);
  });
});
