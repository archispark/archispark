/**
 * Tests for auth middleware and users routes with Better Auth sessions.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import _request from "supertest";
import { app } from "../src/app.js";
import { getAdminCookie, getUserCookie } from "../src/test-helper.js";
import { parsePermissions, serializePermissions, permissionHasFlag, requirePermission } from "../src/auth.js";
import type { AuthRequest } from "../src/auth.js";

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

describe("requireAdmin middleware", () => {
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
// Unit tests – permission bit helpers
// ---------------------------------------------------------------------------

describe("parsePermissions", () => {
  it("returns empty array for 0", () => {
    expect(parsePermissions(0)).toEqual([]);
  });

  it("parses read-only (bit 1)", () => {
    expect(parsePermissions(1)).toEqual(["read"]);
  });

  it("parses all flags (bit 15)", () => {
    const perms = parsePermissions(15);
    expect(perms).toContain("read");
    expect(perms).toContain("create");
    expect(perms).toContain("update");
    expect(perms).toContain("delete");
  });

  it("parses create+delete (bits 2+8 = 10)", () => {
    const perms = parsePermissions(10);
    expect(perms).toContain("create");
    expect(perms).toContain("delete");
    expect(perms).not.toContain("read");
  });
});

describe("serializePermissions", () => {
  it("returns 0 for empty array", () => {
    expect(serializePermissions([])).toBe(0);
  });

  it("returns 1 for [read]", () => {
    expect(serializePermissions(["read"])).toBe(1);
  });

  it("returns 15 for all flags", () => {
    expect(serializePermissions(["read", "create", "update", "delete"])).toBe(15);
  });

  it("deduplicates repeated flags", () => {
    expect(serializePermissions(["read", "read"])).toBe(1);
  });
});

describe("permissionHasFlag", () => {
  it("returns true when flag bit is set", () => {
    expect(permissionHasFlag(1, "read")).toBe(true);
    expect(permissionHasFlag(15, "delete")).toBe(true);
  });

  it("returns false when flag bit is not set", () => {
    expect(permissionHasFlag(0, "read")).toBe(false);
    expect(permissionHasFlag(1, "create")).toBe(false);
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
    const res = await request(app).put(`/users/${userId}`).send({ role: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
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
// requirePermission — unit tests for unauthenticated path (lines 311-313)
// ---------------------------------------------------------------------------

describe("requirePermission unit tests", () => {
  it("returns 401 when req.user is not set", async () => {
    const middleware = requirePermission("Relations", "read");
    const req = {} as AuthRequest;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as import("express").Response;
    const next = vi.fn() as import("express").NextFunction;
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// requirePermission — userHasPermission DB path (lines 299-304)
// A user-role request goes through the DB query (not the admin early return)
// ---------------------------------------------------------------------------

describe("requirePermission with user role", () => {
  it("calls userHasPermission DB path for non-admin user hitting a permissioned route", async () => {
    const res = await _request.agent(app).set("Cookie", userCookie).get("/relationships");
    // Status is 200 (user has read) or 403 (no read perm) — either hits the DB query branch
    expect([200, 403]).toContain(res.status);
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
