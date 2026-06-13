/**
 * Tests for GET /admin/neon/status (apps/control-api/src/app.ts).
 *
 * The endpoint reports which tenant-database provisioning provider is
 * available: "neon" when NEON_API_KEY/NEON_PROJECT_ID are configured (with
 * `reachable` reflecting whether the Neon API call succeeds), "local" when
 * Neon isn't configured but local-Postgres provisioning is possible, or
 * "none" when neither is available.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import _request from "supertest";
import { getDefaultBranchId, canProvisionLocally } from "@workspace/db";
import { app } from "../src/app.js";
import { getAdminCookie, getUserCookie } from "../src/test-helper.js";

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    getDefaultBranchId: vi.fn(actual.getDefaultBranchId),
    canProvisionLocally: vi.fn(actual.canProvisionLocally),
  };
});

const ORIGINAL_ENV = { ...process.env };

let adminCookie: string;
let userCookie: string;

beforeAll(async () => {
  adminCookie = await getAdminCookie();
  userCookie = await getUserCookie();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

function request(appArg: Parameters<typeof _request>[0], cookie = adminCookie) {
  return _request.agent(appArg).set("Cookie", cookie);
}

describe("GET /admin/neon/status", () => {
  it("returns 403 for non-admin", async () => {
    const res = await request(app, userCookie).get("/admin/neon/status");
    expect(res.status).toBe(403);
  });

  it("returns provider 'none' when Neon is not configured and local provisioning is unavailable", async () => {
    delete process.env["NEON_API_KEY"];
    delete process.env["NEON_PROJECT_ID"];
    vi.mocked(canProvisionLocally).mockReturnValue(false);

    const res = await request(app).get("/admin/neon/status");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: false, reachable: false, provider: "none" });
  });

  it("returns provider 'local' when Neon is not configured but local provisioning is possible", async () => {
    delete process.env["NEON_API_KEY"];
    delete process.env["NEON_PROJECT_ID"];
    vi.mocked(canProvisionLocally).mockReturnValue(true);

    const res = await request(app).get("/admin/neon/status");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: true, reachable: true, provider: "local" });
  });

  it("returns provider 'neon' reachable when the Neon API call succeeds", async () => {
    process.env["NEON_API_KEY"] = "key";
    process.env["NEON_PROJECT_ID"] = "proj-1";
    vi.mocked(getDefaultBranchId).mockResolvedValueOnce("br-1");

    const res = await request(app).get("/admin/neon/status");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: true, reachable: true, provider: "neon" });
    expect(canProvisionLocally).not.toHaveBeenCalled();
  });

  it("returns provider 'neon' unreachable when the Neon API call fails", async () => {
    process.env["NEON_API_KEY"] = "key";
    process.env["NEON_PROJECT_ID"] = "proj-1";
    vi.mocked(getDefaultBranchId).mockRejectedValueOnce(new Error("Neon API error: 500"));

    const res = await request(app).get("/admin/neon/status");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: true, reachable: false, provider: "neon" });
  });
});
