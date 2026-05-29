/**
 * Tests for auth middleware and users routes with Better Auth sessions.
 */

import { describe, it, expect, beforeAll } from "vitest";
import _request from "supertest";
import { app } from "../src/app.js";
import { getAdminCookie, getUserCookie } from "../src/test-helper.js";

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
