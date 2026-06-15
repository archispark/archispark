/**
 * Tests for the ArchiMate control-api (src/app.ts).
 *
 * Data-plane routes (workspaces, elements, relationships, views,
 * property-definitions, export/import, openapi/docs, ...) now live in
 * apps/tenant-api and are reverse-proxied here — see the "Reverse proxy to
 * tenant-api" suite below, which mocks global.fetch. Control-plane routes
 * (/me, /users*, /admin/organizations*, /settings/api-tokens*)
 * are covered in auth.test.ts.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import _request from "supertest";
import { eq } from "drizzle-orm";
import { controlDb, siteSettings, verifyTenantToken } from "@workspace/db";
import { app } from "../src/app.js";
import { getAdminCookie, getContribCookie, getAdminWorkspaceContext } from "../src/test-helper.js";

let adminCookie: string;
let contribCookie: string;

beforeAll(async () => {
  adminCookie = await getAdminCookie();
  contribCookie = await getContribCookie();
});

function request(appArg: Parameters<typeof _request>[0], cookie = adminCookie) {
  return _request.agent(appArg).set("Cookie", cookie);
}

// ===========================================================================
// /settings/postgres
// ===========================================================================

describe("GET /settings/postgres", () => {
  it("returns the connection status", async () => {
    const res = await request(app).get("/settings/postgres");
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(res.body.version).toContain("PostgreSQL");
    expect(res.body).toHaveProperty("host");
    expect(res.body).toHaveProperty("port");
    expect(res.body).toHaveProperty("database");
  });

  it("requires admin", async () => {
    const res = await _request(app).get("/settings/postgres");
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// /settings/messages
// ===========================================================================

describe("GET /settings/messages", () => {
  it("returns 200 without authentication (public endpoint)", async () => {
    const res = await _request(app).get("/settings/messages");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      login_message_enabled: expect.any(Boolean),
      banner_message_enabled: expect.any(Boolean),
    });
  });

  it("returns default disabled state on fresh DB", async () => {
    const res = await _request(app).get("/settings/messages");
    expect(res.status).toBe(200);
    expect(res.body.login_message_enabled).toBe(false);
    expect(res.body.banner_message_enabled).toBe(false);
  });

  it("returns defaults when no row exists in site_settings", async () => {
    await controlDb.delete(siteSettings).where(eq(siteSettings.id, 1));
    const res = await _request(app).get("/settings/messages");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      login_message: null,
      login_message_enabled: false,
      banner_message: null,
      banner_message_enabled: false,
    });
  });
});

describe("PUT /settings/messages", () => {
  it("requires admin (401 without auth)", async () => {
    const res = await _request(app).put("/settings/messages").send({
      login_message: "hello",
      login_message_enabled: true,
      banner_message: null,
      banner_message_enabled: false,
    });
    expect(res.status).toBe(401);
  });

  it("saves messages and GET reflects the update", async () => {
    const put = await request(app).put("/settings/messages").send({
      login_message: "Demo: admin / admin",
      login_message_enabled: true,
      banner_message: "Maintenance le 15 juin.",
      banner_message_enabled: false,
    });
    expect(put.status).toBe(200);
    expect(put.body.ok).toBe(true);

    const get = await _request(app).get("/settings/messages");
    expect(get.body.login_message).toBe("Demo: admin / admin");
    expect(get.body.login_message_enabled).toBe(true);
    expect(get.body.banner_message).toBe("Maintenance le 15 juin.");
    expect(get.body.banner_message_enabled).toBe(false);
  });

  it("empty string message is stored as null", async () => {
    await request(app).put("/settings/messages").send({
      login_message: "",
      login_message_enabled: false,
      banner_message: "",
      banner_message_enabled: false,
    });
    const get = await _request(app).get("/settings/messages");
    expect(get.body.login_message).toBeNull();
    expect(get.body.banner_message).toBeNull();
  });

  it("enables the banner and GET returns it enabled", async () => {
    await request(app).put("/settings/messages").send({
      login_message: null,
      login_message_enabled: false,
      banner_message: "Bienvenue !",
      banner_message_enabled: true,
    });
    const get = await _request(app).get("/settings/messages");
    expect(get.body.banner_message).toBe("Bienvenue !");
    expect(get.body.banner_message_enabled).toBe(true);
  });
});

// ===========================================================================
// Reverse proxy to tenant-api
// ===========================================================================

describe("Reverse proxy to tenant-api", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns 500 when TENANT_API_URL is not configured", async () => {
    const res = await request(app).get("/workspaces");
    expect(res.status).toBe(500);
    expect(res.body.detail).toContain("TENANT_API_URL");
  });

  it("forwards an authenticated request with a signed inter-service JWT", async () => {
    vi.stubEnv("TENANT_API_URL", "http://tenant-api.test");
    let captured: { url: string; init: RequestInit } | undefined;
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init: RequestInit) => {
      captured = { url: url.toString(), init };
      return new Response(JSON.stringify({ proxied: true }), { status: 200, headers: { "content-type": "application/json" } });
    }));

    const res = await request(app).get("/workspaces");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ proxied: true });
    expect(captured?.url).toBe("http://tenant-api.test/workspaces");

    const authHeader = (captured!.init.headers as Headers).get("authorization");
    expect(authHeader).toMatch(/^Bearer /);
    const payload = verifyTenantToken(authHeader!.slice(7));
    const { ctx } = await getAdminWorkspaceContext();
    expect(payload.username).toBe("admin");
    expect(payload.platform_role).toBe("platform_admin");
    expect(payload.organization_id).toBe(ctx.organizationId);
    expect(payload.org_role).toBe("owner");
    expect(payload.team_ids).toEqual([]);
    expect(payload.tenant_db).toBeNull();
  });

  it("forwards an unauthenticated request to a public path without an authorization header", async () => {
    vi.stubEnv("TENANT_API_URL", "http://tenant-api.test");
    let captured: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL, init: RequestInit) => {
      captured = init;
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }));

    const res = await _request(app).get("/openapi.json");
    expect(res.status).toBe(200);
    expect((captured!.headers as Headers).has("authorization")).toBe(false);
  });

  it("re-serializes a JSON request body for the upstream request", async () => {
    vi.stubEnv("TENANT_API_URL", "http://tenant-api.test");
    let captured: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL, init: RequestInit) => {
      captured = init;
      return new Response("{}", { status: 201, headers: { "content-type": "application/json" } });
    }));

    await request(app).post("/workspaces").send({ name: "Proxied WS" });
    expect(JSON.parse(captured!.body as string)).toEqual({ name: "Proxied WS" });
    expect((captured!.headers as Headers).get("content-type")).toBe("application/json");
  });

  it("passes through the upstream status and headers, dropping hop-by-hop headers", async () => {
    vi.stubEnv("TENANT_API_URL", "http://tenant-api.test");
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ id: "ws-1" }), {
        status: 201,
        headers: { "content-type": "application/json", "x-test-header": "abc", "content-encoding": "gzip" },
      })
    ));

    const res = await request(app).post("/workspaces").send({ name: "Headers WS" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "ws-1" });
    expect(res.headers["x-test-header"]).toBe("abc");
    expect(res.headers["content-encoding"]).toBeUndefined();
  });

  it("returns 403 for an org admin on DELETE /workspaces/:id (manage-organization is owner-only) without reaching tenant-api", async () => {
    vi.stubEnv("TENANT_API_URL", "http://tenant-api.test");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app, contribCookie).delete("/workspaces/some-id");
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies DELETE /workspaces/:id to tenant-api for an org owner", async () => {
    vi.stubEnv("TENANT_API_URL", "http://tenant-api.test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));

    const res = await request(app).delete("/workspaces/some-id");
    expect(res.status).toBe(204);
  });
});
