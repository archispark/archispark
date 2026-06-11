import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getNeonApiConfig,
  getDefaultBranchId,
  createRole,
  createDatabase,
  getConnectionUri,
} from "./neon-api.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("getNeonApiConfig", () => {
  it("returns undefined when NEON_API_KEY or NEON_PROJECT_ID is missing", () => {
    delete process.env["NEON_API_KEY"];
    delete process.env["NEON_PROJECT_ID"];
    expect(getNeonApiConfig()).toBeUndefined();

    process.env["NEON_API_KEY"] = "key";
    delete process.env["NEON_PROJECT_ID"];
    expect(getNeonApiConfig()).toBeUndefined();
  });

  it("returns the config when both are set", () => {
    process.env["NEON_API_KEY"] = "key";
    process.env["NEON_PROJECT_ID"] = "proj-1";
    expect(getNeonApiConfig()).toEqual({ apiKey: "key", projectId: "proj-1" });
  });
});

const config = { apiKey: "key", projectId: "proj-1" };

describe("getDefaultBranchId", () => {
  it("returns NEON_BRANCH_ID when set, without calling the API", async () => {
    process.env["NEON_BRANCH_ID"] = "br-override";
    const fetchMock = mockFetchOnce({ branches: [] });
    expect(await getDefaultBranchId(config)).toBe("br-override");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the default branch from the API", async () => {
    delete process.env["NEON_BRANCH_ID"];
    mockFetchOnce({ branches: [{ id: "br-1" }, { id: "br-2", default: true }] });
    expect(await getDefaultBranchId(config)).toBe("br-2");
  });

  it("falls back to the first branch if none is marked default", async () => {
    delete process.env["NEON_BRANCH_ID"];
    mockFetchOnce({ branches: [{ id: "br-1" }, { id: "br-2" }] });
    expect(await getDefaultBranchId(config)).toBe("br-1");
  });

  it("throws if the project has no branches", async () => {
    delete process.env["NEON_BRANCH_ID"];
    mockFetchOnce({ branches: [] });
    await expect(getDefaultBranchId(config)).rejects.toThrow(/no branches/);
  });
});

describe("createRole / createDatabase / getConnectionUri", () => {
  it("createRole posts to the roles endpoint", async () => {
    const fetchMock = mockFetchOnce({ role: { name: "tenant_role" } });
    await createRole(config, "br-1", "tenant_role");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://console.neon.tech/api/v2/projects/proj-1/branches/br-1/roles");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ role: { name: "tenant_role" } });
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer key");
  });

  it("createDatabase posts to the databases endpoint", async () => {
    const fetchMock = mockFetchOnce({ database: { name: "tenant_db" } });
    await createDatabase(config, "br-1", "tenant_db", "tenant_role");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://console.neon.tech/api/v2/projects/proj-1/branches/br-1/databases");
    expect(JSON.parse(init.body as string)).toEqual({ database: { name: "tenant_db", owner_name: "tenant_role" } });
  });

  it("getConnectionUri returns the uri from the response", async () => {
    mockFetchOnce({ uri: "postgresql://tenant_role:pw@host/tenant_db" });
    const uri = await getConnectionUri(config, "br-1", "tenant_db", "tenant_role");
    expect(uri).toBe("postgresql://tenant_role:pw@host/tenant_db");
  });

  it("throws a descriptive error when the API responds with an error status", async () => {
    mockFetchOnce({ message: "forbidden" }, false, 403);
    await expect(createRole(config, "br-1", "tenant_role")).rejects.toThrow(/403/);
  });
});
