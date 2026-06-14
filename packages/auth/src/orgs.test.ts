import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  listOrgMembers,
  addOrgMember,
  removeOrgMember,
  listOrgRoles,
  createOrgRole,
  ensureDefaultOrgRoles,
  listOrgRoleUsers,
  grantOrgRole,
  revokeOrgRole,
  userHasOrgRole,
  setOrgMemberRoles,
  getOrgMemberRole,
  createOrgInvitation,
  listOrgInvitations,
  cancelOrgInvitation,
} from "./orgs.js";
import { clearAdminTokenCache } from "./admin-token.js";

const KC_URL = "http://localhost:8080";
const KC_REALM = "archispark";
const TOKEN_ENDPOINT = `${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/token`;
const ORGS_BASE = `${KC_URL}/realms/${KC_REALM}/orgs`;

function tokenResponse(): Response {
  return new Response(JSON.stringify({ access_token: "admin-token", expires_in: 300 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

interface Route {
  method: string;
  path: string;
  response: () => Response;
  check?: (init?: RequestInit) => void;
}

function mockOrgsFetch(routes: Route[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url === TOKEN_ENDPOINT) return tokenResponse();
    expect((init?.headers as Record<string, string> | undefined)?.["authorization"]).toBe("Bearer admin-token");
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(ORGS_BASE, "");
    const route = routes.find((r) => r.method === method && r.path === path);
    if (!route) throw new Error(`Unexpected request: ${method} ${path}`);
    route.check?.(init);
    return route.response();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function empty(status: number): Response {
  return new Response(null, { status });
}

beforeEach(() => {
  vi.stubEnv("KEYCLOAK_URL", KC_URL);
  vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
  vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_ID", "archispark-control-api");
  vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_SECRET", "archispark-control-api-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearAdminTokenCache();
});

describe("organization CRUD", () => {
  it("listOrganizations GETs the orgs collection", async () => {
    mockOrgsFetch([{ method: "GET", path: "", response: () => json([{ id: "org1", name: "default" }]) }]);
    expect(await listOrganizations()).toEqual([{ id: "org1", name: "default" }]);
  });

  it("listOrganizations throws on non-2xx", async () => {
    mockOrgsFetch([{ method: "GET", path: "", response: () => empty(500) }]);
    await expect(listOrganizations()).rejects.toThrow("GET  -> 500");
  });

  it("getOrganization GETs a single org", async () => {
    mockOrgsFetch([{ method: "GET", path: "/org1", response: () => json({ id: "org1", name: "default" }) }]);
    expect(await getOrganization("org1")).toEqual({ id: "org1", name: "default" });
  });

  it("createOrganization POSTs and returns the id from the Location header", async () => {
    mockOrgsFetch([
      {
        method: "POST",
        path: "",
        check: (init) => {
          expect(JSON.parse(init?.body as string)).toEqual({ name: "Default", attributes: { slug: ["default"] } });
        },
        response: () =>
          new Response(null, { status: 201, headers: { location: `${ORGS_BASE}/new-org-id` } }),
      },
    ]);
    const id = await createOrganization({ name: "Default", attributes: { slug: ["default"] } });
    expect(id).toBe("new-org-id");
  });

  it("createOrganization throws when the Location header is missing", async () => {
    mockOrgsFetch([{ method: "POST", path: "", response: () => empty(201) }]);
    await expect(createOrganization({ name: "Default" })).rejects.toThrow("missing Location header");
  });

  it("updateOrganization PUTs the org representation", async () => {
    const fetchMock = mockOrgsFetch([{ method: "PUT", path: "/org1", response: () => empty(204) }]);
    await updateOrganization("org1", { name: "Renamed" });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("updateOrganization throws on non-2xx", async () => {
    mockOrgsFetch([{ method: "PUT", path: "/org1", response: () => empty(403) }]);
    await expect(updateOrganization("org1", { name: "Renamed" })).rejects.toThrow("PUT /org1 -> 403");
  });

  it("deleteOrganization DELETEs the org", async () => {
    mockOrgsFetch([{ method: "DELETE", path: "/org1", response: () => empty(204) }]);
    await expect(deleteOrganization("org1")).resolves.toBeUndefined();
  });

  it("deleteOrganization throws on non-2xx", async () => {
    mockOrgsFetch([{ method: "DELETE", path: "/org1", response: () => empty(404) }]);
    await expect(deleteOrganization("org1")).rejects.toThrow("DELETE /org1 -> 404");
  });
});

describe("members", () => {
  it("listOrgMembers GETs org members", async () => {
    mockOrgsFetch([
      { method: "GET", path: "/org1/members", response: () => json([{ id: "u1", username: "admin" }]) },
    ]);
    expect(await listOrgMembers("org1")).toEqual([{ id: "u1", username: "admin" }]);
  });

  it("addOrgMember PUTs the member", async () => {
    const fetchMock = mockOrgsFetch([
      { method: "PUT", path: "/org1/members/u1", response: () => empty(201) },
    ]);
    await addOrgMember("org1", "u1");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("removeOrgMember DELETEs the member", async () => {
    mockOrgsFetch([{ method: "DELETE", path: "/org1/members/u1", response: () => empty(204) }]);
    await expect(removeOrgMember("org1", "u1")).resolves.toBeUndefined();
  });
});

describe("roles", () => {
  it("listOrgRoles GETs org roles", async () => {
    mockOrgsFetch([
      { method: "GET", path: "/org1/roles", response: () => json([{ name: "owner" }, { name: "admin" }]) },
    ]);
    expect(await listOrgRoles("org1")).toEqual([{ name: "owner" }, { name: "admin" }]);
  });

  it("createOrgRole POSTs a new role", async () => {
    const fetchMock = mockOrgsFetch([
      {
        method: "POST",
        path: "/org1/roles",
        check: (init) => expect(JSON.parse(init?.body as string)).toEqual({ name: "owner", description: undefined }),
        response: () => empty(201),
      },
    ]);
    await createOrgRole("org1", "owner");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("createOrgRole tolerates 409 (already exists)", async () => {
    mockOrgsFetch([{ method: "POST", path: "/org1/roles", response: () => empty(409) }]);
    await expect(createOrgRole("org1", "owner")).resolves.toBeUndefined();
  });

  it("createOrgRole throws on other non-2xx", async () => {
    mockOrgsFetch([{ method: "POST", path: "/org1/roles", response: () => empty(403) }]);
    await expect(createOrgRole("org1", "owner")).rejects.toThrow("POST /org1/roles -> 403");
  });

  it("ensureDefaultOrgRoles only creates roles that are missing", async () => {
    const created: string[] = [];
    mockOrgsFetch([
      { method: "GET", path: "/org1/roles", response: () => json([{ name: "owner" }]) },
      {
        method: "POST",
        path: "/org1/roles",
        check: (init) => created.push((JSON.parse(init?.body as string) as { name: string }).name),
        response: () => empty(201),
      },
    ]);
    await ensureDefaultOrgRoles("org1");
    expect(created).toEqual(["admin", "member"]);
  });

  it("listOrgRoleUsers GETs the users with a role", async () => {
    mockOrgsFetch([
      { method: "GET", path: "/org1/roles/owner/users", response: () => json([{ id: "u1", username: "admin" }]) },
    ]);
    expect(await listOrgRoleUsers("org1", "owner")).toEqual([{ id: "u1", username: "admin" }]);
  });

  it("grantOrgRole PUTs the role mapping", async () => {
    const fetchMock = mockOrgsFetch([
      { method: "PUT", path: "/org1/roles/owner/users/u1", response: () => empty(201) },
    ]);
    await grantOrgRole("org1", "owner", "u1");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("revokeOrgRole DELETEs the role mapping", async () => {
    mockOrgsFetch([{ method: "DELETE", path: "/org1/roles/owner/users/u1", response: () => empty(204) }]);
    await expect(revokeOrgRole("org1", "owner", "u1")).resolves.toBeUndefined();
  });

  it("revokeOrgRole tolerates 404 (no such mapping)", async () => {
    mockOrgsFetch([{ method: "DELETE", path: "/org1/roles/owner/users/u1", response: () => empty(404) }]);
    await expect(revokeOrgRole("org1", "owner", "u1")).resolves.toBeUndefined();
  });

  it("revokeOrgRole throws on other non-2xx", async () => {
    mockOrgsFetch([{ method: "DELETE", path: "/org1/roles/owner/users/u1", response: () => empty(403) }]);
    await expect(revokeOrgRole("org1", "owner", "u1")).rejects.toThrow("DELETE /org1/roles/owner/users/u1 -> 403");
  });

  it("userHasOrgRole returns true for 204 and false for 404", async () => {
    mockOrgsFetch([
      { method: "GET", path: "/org1/roles/owner/users/u1", response: () => empty(204) },
      { method: "GET", path: "/org1/roles/admin/users/u1", response: () => empty(404) },
    ]);
    expect(await userHasOrgRole("org1", "owner", "u1")).toBe(true);
    expect(await userHasOrgRole("org1", "admin", "u1")).toBe(false);
  });

  it("setOrgMemberRoles grants the target role and revokes the other two", async () => {
    const calls: string[] = [];
    mockOrgsFetch([
      {
        method: "PUT",
        path: "/org1/roles/admin/users/u1",
        check: () => calls.push("grant:admin"),
        response: () => empty(201),
      },
      {
        method: "DELETE",
        path: "/org1/roles/owner/users/u1",
        check: () => calls.push("revoke:owner"),
        response: () => empty(204),
      },
      {
        method: "DELETE",
        path: "/org1/roles/member/users/u1",
        check: () => calls.push("revoke:member"),
        response: () => empty(404),
      },
    ]);
    await setOrgMemberRoles("org1", "u1", "admin");
    expect(calls).toEqual(["grant:admin", "revoke:owner", "revoke:member"]);
  });

  it("getOrgMemberRole returns the first matching role and short-circuits", async () => {
    mockOrgsFetch([
      { method: "GET", path: "/org1/roles/owner/users/u1", response: () => empty(404) },
      { method: "GET", path: "/org1/roles/admin/users/u1", response: () => empty(204) },
      // no route for "member" — would throw "Unexpected request" if called, proving short-circuit.
    ]);
    expect(await getOrgMemberRole("org1", "u1")).toBe("admin");
  });

  it("getOrgMemberRole returns null when no role matches", async () => {
    mockOrgsFetch([
      { method: "GET", path: "/org1/roles/owner/users/u1", response: () => empty(404) },
      { method: "GET", path: "/org1/roles/admin/users/u1", response: () => empty(404) },
      { method: "GET", path: "/org1/roles/member/users/u1", response: () => empty(404) },
    ]);
    expect(await getOrgMemberRole("org1", "u1")).toBeNull();
  });
});

describe("invitations", () => {
  it("createOrgInvitation POSTs and returns the id from the Location header", async () => {
    mockOrgsFetch([
      {
        method: "POST",
        path: "/org1/invitations",
        check: (init) =>
          expect(JSON.parse(init?.body as string)).toEqual({
            email: "new@example.com",
            roles: ["member"],
            send: false,
            redirectUri: "",
          }),
        response: () =>
          new Response(null, { status: 201, headers: { location: `${ORGS_BASE}/org1/invitations/inv1` } }),
      },
    ]);
    const id = await createOrgInvitation("org1", { email: "new@example.com", roles: ["member"] });
    expect(id).toBe("inv1");
  });

  it("listOrgInvitations GETs org invitations", async () => {
    mockOrgsFetch([
      {
        method: "GET",
        path: "/org1/invitations",
        response: () => json([{ id: "inv1", email: "new@example.com", roles: ["member"] }]),
      },
    ]);
    expect(await listOrgInvitations("org1")).toEqual([{ id: "inv1", email: "new@example.com", roles: ["member"] }]);
  });

  it("cancelOrgInvitation DELETEs the invitation", async () => {
    mockOrgsFetch([{ method: "DELETE", path: "/org1/invitations/inv1", response: () => empty(204) }]);
    await expect(cancelOrgInvitation("org1", "inv1")).resolves.toBeUndefined();
  });

  it("createOrgInvitation throws on non-2xx response", async () => {
    mockOrgsFetch([{ method: "POST", path: "/org1/invitations", response: () => empty(500) }]);
    await expect(createOrgInvitation("org1", { email: "new@example.com", roles: ["member"] })).rejects.toThrow(
      "POST /org1/invitations -> 500",
    );
  });
});
