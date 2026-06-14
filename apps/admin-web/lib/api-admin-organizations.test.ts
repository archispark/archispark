import { describe, it, expect, afterEach, vi } from "vitest";
import {
  fetchAdminOrganizations, fetchNeonStatus,
  setOrganizationEnabledApi, createAdminOrganization, verifyOrganizationDb, reprovisionOrganization,
} from "./api";

// ---------------------------------------------------------------------------
// GET / mutation helpers
// ---------------------------------------------------------------------------

function mockFetchOk(data: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
}

function mockFetchError(status = 500) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ detail: `HTTP ${status}` }),
  }));
}

afterEach(() => vi.unstubAllGlobals());

// ---------------------------------------------------------------------------
// Admin: organizations
// ---------------------------------------------------------------------------

describe("Admin organizations", () => {
  const org = {
    id: "org-1", name: "Acme", slug: "acme", enabled: true,
    created_at: "2024-01-01", tenant_status: "active" as const, last_error: null,
  };

  it("setOrganizationEnabledApi puts and returns the updated organization", async () => {
    mockFetchOk({ ...org, enabled: false });
    const result = await setOrganizationEnabledApi("org-1", false);
    expect(result.enabled).toBe(false);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/admin/organizations/org-1"),
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("setOrganizationEnabledApi throws on error", async () => {
    mockFetchError(404);
    await expect(setOrganizationEnabledApi("missing", true)).rejects.toThrow("HTTP 404");
  });

  it("createAdminOrganization posts and returns the created organization with a generated owner", async () => {
    mockFetchOk({ ...org, initial_owner: { username: "admin-acme", password: "s3cret" } });
    const result = await createAdminOrganization({ name: "Acme", slug: "acme" });
    expect(result.slug).toBe("acme");
    expect(result.initial_owner).toEqual({ username: "admin-acme", password: "s3cret" });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/admin/organizations"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("createAdminOrganization returns no initial_owner when initial_owner_user_id is given", async () => {
    mockFetchOk(org);
    const result = await createAdminOrganization({ name: "Acme", slug: "acme", initial_owner_user_id: "user-1" });
    expect(result.initial_owner).toBeUndefined();
  });

  it("createAdminOrganization throws with detail message on error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: "Le slug 'acme' est déjà utilisé." }),
    }));
    await expect(createAdminOrganization({ name: "Acme", slug: "acme" })).rejects.toThrow("déjà utilisé");
  });

  it("verifyOrganizationDb posts and returns connectivity result", async () => {
    mockFetchOk({ connected: true, latency_ms: 12, version: "16.1" });
    const result = await verifyOrganizationDb("org-1");
    expect(result.connected).toBe(true);
    expect(result.latency_ms).toBe(12);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/admin/organizations/org-1/verify-db"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("verifyOrganizationDb throws on error", async () => {
    mockFetchError(503);
    await expect(verifyOrganizationDb("org-1")).rejects.toThrow("HTTP 503");
  });

  it("reprovisionOrganization posts and returns the updated organization", async () => {
    mockFetchOk({ ...org, tenant_status: "provisioning" as const });
    const result = await reprovisionOrganization("org-1");
    expect(result.tenant_status).toBe("provisioning");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/admin/organizations/org-1/reprovision"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("reprovisionOrganization throws on error", async () => {
    mockFetchError(503);
    await expect(reprovisionOrganization("org-1")).rejects.toThrow("HTTP 503");
  });

  it("fetchAdminOrganizations returns the organization list", async () => {
    mockFetchOk([org]);
    const result = await fetchAdminOrganizations();
    expect(result).toEqual([org]);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/admin/organizations"),
      expect.any(Object),
    );
  });

  it("fetchAdminOrganizations throws on non-ok response", async () => {
    mockFetchError(500);
    await expect(fetchAdminOrganizations()).rejects.toThrow("API error: 500");
  });

  it("fetchNeonStatus returns Neon configuration status", async () => {
    mockFetchOk({ configured: true, reachable: true, provider: "neon" });
    const result = await fetchNeonStatus();
    expect(result).toEqual({ configured: true, reachable: true, provider: "neon" });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/admin/neon/status"),
      expect.any(Object),
    );
  });

  it("fetchNeonStatus throws on non-ok response", async () => {
    mockFetchError(500);
    await expect(fetchNeonStatus()).rejects.toThrow("API error: 500");
  });
});
