import { describe, it, expect, afterEach, vi } from "vitest";
import { clearAdminTokenCache } from "./admin-token.js";
import {
  listRealmUsers,
  findUserByUsername,
  getKeycloakUser,
  createKeycloakUser,
  updateKeycloakUser,
  deleteKeycloakUser,
  setUserPassword,
  getUserRealmRoles,
  assignRealmRole,
  unassignRealmRole,
  listRealmRoleUsers,
} from "./admin-users.js";

const KC_URL = "http://localhost:8080";
const KC_REALM = "archispark";
const TOKEN_ENDPOINT = `${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/token`;
const ADMIN_BASE = `${KC_URL}/admin/realms/${KC_REALM}`;

function stubEnv(): void {
  vi.stubEnv("KEYCLOAK_URL", KC_URL);
  vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
  vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_ID", "archispark-api");
  vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_SECRET", "archispark-api-secret");
}

function tokenResponse(): Response {
  return new Response(JSON.stringify({ access_token: "admin-token", expires_in: 300 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearAdminTokenCache();
});

describe("listRealmUsers", () => {
  it("GETs /users with the admin bearer token", async () => {
    stubEnv();
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      expect(input.toString()).toBe(`${ADMIN_BASE}/users?max=1000`);
      expect((init?.headers as Record<string, string>)["authorization"]).toBe("Bearer admin-token");
      return jsonResponse([{ id: "u1", username: "alice" }]);
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await listRealmUsers()).toEqual([{ id: "u1", username: "alice" }]);
  });

  it("throws on a non-2xx response", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      return new Response("error", { status: 500 });
    }));
    await expect(listRealmUsers()).rejects.toThrow("Keycloak admin request failed: GET /users?max=1000 -> 500");
  });
});

describe("findUserByUsername", () => {
  it("returns the user with an exact username match", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url === TOKEN_ENDPOINT) return tokenResponse();
      expect(url).toBe(`${ADMIN_BASE}/users?username=alice&exact=true`);
      return jsonResponse([{ id: "u1", username: "alice" }]);
    }));

    expect(await findUserByUsername("alice")).toEqual({ id: "u1", username: "alice" });
  });

  it("returns null when no user matches", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      return jsonResponse([]);
    }));

    expect(await findUserByUsername("nobody")).toBeNull();
  });

  it("returns null when the results don't contain an exact username match", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      return jsonResponse([{ id: "u1", username: "alice-other" }]);
    }));

    expect(await findUserByUsername("alice")).toBeNull();
  });
});

describe("getKeycloakUser", () => {
  it("returns the user representation when found", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url === TOKEN_ENDPOINT) return tokenResponse();
      expect(url).toBe(`${ADMIN_BASE}/users/u1`);
      return jsonResponse({ id: "u1", username: "alice" });
    }));

    expect(await getKeycloakUser("u1")).toEqual({ id: "u1", username: "alice" });
  });

  it("returns null on 404", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      return new Response("not found", { status: 404 });
    }));

    expect(await getKeycloakUser("missing")).toBeNull();
  });

  it("throws on other non-2xx responses", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      return new Response("error", { status: 500 });
    }));

    await expect(getKeycloakUser("u1")).rejects.toThrow("Keycloak admin request failed: GET /users/u1 -> 500");
  });
});

describe("createKeycloakUser", () => {
  it("POSTs the user representation and returns the id from the Location header", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url === TOKEN_ENDPOINT) return tokenResponse();
      expect(url).toBe(`${ADMIN_BASE}/users`);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual({ username: "alice" });
      return new Response(null, { status: 201, headers: { location: `${ADMIN_BASE}/users/new-id-123` } });
    }));

    expect(await createKeycloakUser({ username: "alice" })).toBe("new-id-123");
  });

  it("throws when the response is missing a Location header", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      return new Response(null, { status: 201 });
    }));

    await expect(createKeycloakUser({ username: "alice" })).rejects.toThrow(
      "Keycloak admin response missing Location header for POST /users",
    );
  });

  it("throws on a non-2xx response", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      return new Response("conflict", { status: 409 });
    }));

    await expect(createKeycloakUser({ username: "alice" })).rejects.toThrow(
      "Keycloak admin request failed: POST /users -> 409",
    );
  });
});

describe("updateKeycloakUser", () => {
  it("PUTs the partial user representation", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url === TOKEN_ENDPOINT) return tokenResponse();
      expect(url).toBe(`${ADMIN_BASE}/users/u1`);
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(init?.body as string)).toEqual({ email: "new@example.com" });
      return new Response(null, { status: 204 });
    }));

    await expect(updateKeycloakUser("u1", { email: "new@example.com" })).resolves.toBeUndefined();
  });

  it("throws on a non-2xx response", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      return new Response("error", { status: 500 });
    }));

    await expect(updateKeycloakUser("u1", { email: "new@example.com" })).rejects.toThrow(
      "Keycloak admin request failed: PUT /users/u1 -> 500",
    );
  });
});

describe("deleteKeycloakUser", () => {
  it("returns true on success", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url === TOKEN_ENDPOINT) return tokenResponse();
      expect(url).toBe(`${ADMIN_BASE}/users/u1`);
      expect(init?.method).toBe("DELETE");
      return new Response(null, { status: 204 });
    }));

    expect(await deleteKeycloakUser("u1")).toBe(true);
  });

  it("returns false on 404", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      return new Response("not found", { status: 404 });
    }));

    expect(await deleteKeycloakUser("missing")).toBe(false);
  });

  it("throws on other non-2xx responses", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      return new Response("error", { status: 500 });
    }));

    await expect(deleteKeycloakUser("u1")).rejects.toThrow("Keycloak admin request failed: DELETE /users/u1 -> 500");
  });
});

describe("setUserPassword", () => {
  it("PUTs a non-temporary password reset by default", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url === TOKEN_ENDPOINT) return tokenResponse();
      expect(url).toBe(`${ADMIN_BASE}/users/u1/reset-password`);
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(init?.body as string)).toEqual({ type: "password", value: "secret123", temporary: false });
      return new Response(null, { status: 204 });
    }));

    await expect(setUserPassword("u1", "secret123")).resolves.toBeUndefined();
  });

  it("PUTs a temporary password reset when requested", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url === TOKEN_ENDPOINT) return tokenResponse();
      expect(JSON.parse(init?.body as string)).toEqual({ type: "password", value: "secret123", temporary: true });
      return new Response(null, { status: 204 });
    }));

    await expect(setUserPassword("u1", "secret123", true)).resolves.toBeUndefined();
  });

  it("throws on a non-2xx response", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      return new Response("error", { status: 500 });
    }));

    await expect(setUserPassword("u1", "secret123")).rejects.toThrow(
      "Keycloak admin request failed: PUT /users/u1/reset-password -> 500",
    );
  });
});

describe("getUserRealmRoles", () => {
  it("GETs the user's realm role mappings", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url === TOKEN_ENDPOINT) return tokenResponse();
      expect(url).toBe(`${ADMIN_BASE}/users/u1/role-mappings/realm`);
      return jsonResponse([{ id: "role-1", name: "platform_admin" }]);
    }));

    expect(await getUserRealmRoles("u1")).toEqual([{ id: "role-1", name: "platform_admin" }]);
  });

  it("throws on a non-2xx response", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      return new Response("error", { status: 500 });
    }));

    await expect(getUserRealmRoles("u1")).rejects.toThrow(
      "Keycloak admin request failed: GET /users/u1/role-mappings/realm -> 500",
    );
  });
});

describe("assignRealmRole", () => {
  it("looks up the realm role then POSTs it to the user's realm role mappings", async () => {
    stubEnv();
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = input.toString();
      calls.push(url);
      if (url === TOKEN_ENDPOINT) return tokenResponse();
      if (url === `${ADMIN_BASE}/roles/platform_admin`) {
        return jsonResponse({ id: "role-1", name: "platform_admin" });
      }
      expect(url).toBe(`${ADMIN_BASE}/users/u1/role-mappings/realm`);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual([{ id: "role-1", name: "platform_admin" }]);
      return new Response(null, { status: 204 });
    }));

    await assignRealmRole("u1", "platform_admin");
    expect(calls).toContain(`${ADMIN_BASE}/roles/platform_admin`);
    expect(calls).toContain(`${ADMIN_BASE}/users/u1/role-mappings/realm`);
  });

  it("throws when the role-mappings request fails", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url === TOKEN_ENDPOINT) return tokenResponse();
      if (url === `${ADMIN_BASE}/roles/platform_admin`) {
        return jsonResponse({ id: "role-1", name: "platform_admin" });
      }
      return new Response("error", { status: 500 });
    }));

    await expect(assignRealmRole("u1", "platform_admin")).rejects.toThrow(
      "Keycloak admin request failed: POST /users/u1/role-mappings/realm -> 500",
    );
  });
});

describe("unassignRealmRole", () => {
  it("looks up the realm role then DELETEs it from the user's realm role mappings", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url === TOKEN_ENDPOINT) return tokenResponse();
      if (url === `${ADMIN_BASE}/roles/platform_admin`) {
        return jsonResponse({ id: "role-1", name: "platform_admin" });
      }
      expect(url).toBe(`${ADMIN_BASE}/users/u1/role-mappings/realm`);
      expect(init?.method).toBe("DELETE");
      expect(JSON.parse(init?.body as string)).toEqual([{ id: "role-1", name: "platform_admin" }]);
      return new Response(null, { status: 204 });
    }));

    await expect(unassignRealmRole("u1", "platform_admin")).resolves.toBeUndefined();
  });

  it("throws when the role-mappings request fails", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url === TOKEN_ENDPOINT) return tokenResponse();
      if (url === `${ADMIN_BASE}/roles/platform_admin`) {
        return jsonResponse({ id: "role-1", name: "platform_admin" });
      }
      return new Response("error", { status: 500 });
    }));

    await expect(unassignRealmRole("u1", "platform_admin")).rejects.toThrow(
      "Keycloak admin request failed: DELETE /users/u1/role-mappings/realm -> 500",
    );
  });
});

describe("listRealmRoleUsers", () => {
  it("GETs the users assigned a realm role", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url === TOKEN_ENDPOINT) return tokenResponse();
      expect(url).toBe(`${ADMIN_BASE}/roles/platform_admin/users`);
      return jsonResponse([{ id: "u1", username: "admin" }]);
    }));

    expect(await listRealmRoleUsers("platform_admin")).toEqual([{ id: "u1", username: "admin" }]);
  });

  it("throws on a non-2xx response", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_ENDPOINT) return tokenResponse();
      return new Response("error", { status: 500 });
    }));

    await expect(listRealmRoleUsers("platform_admin")).rejects.toThrow(
      "Keycloak admin request failed: GET /roles/platform_admin/users -> 500",
    );
  });
});
