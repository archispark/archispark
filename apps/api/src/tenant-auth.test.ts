import { describe, it, expect, vi, afterEach } from "vitest";
import type { Response, NextFunction } from "express";
import { signTenantToken } from "@workspace/db";
import { requireTenantToken, type AuthRequest } from "./tenant-auth.js";

const ORIGINAL_SECRET = process.env["TENANT_JWT_SECRET"];

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env["TENANT_JWT_SECRET"];
  else process.env["TENANT_JWT_SECRET"] = ORIGINAL_SECRET;
});

function makeReq(authorization?: string): AuthRequest {
  return { headers: authorization ? { authorization } : {} } as AuthRequest;
}

const res = {} as Response;

describe("requireTenantToken", () => {
  it("rejects requests without an authorization header", () => {
    const next = vi.fn() as unknown as NextFunction;
    requireTenantToken(makeReq(), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("rejects malformed bearer tokens", () => {
    process.env["TENANT_JWT_SECRET"] = "test-tenant-jwt-secret";
    const next = vi.fn() as unknown as NextFunction;
    requireTenantToken(makeReq("Bearer not-a-jwt"), res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("populates req.user/req.workspace/req.tenantDbEncrypted from a valid token", () => {
    process.env["TENANT_JWT_SECRET"] = "test-tenant-jwt-secret";
    const token = signTenantToken({
      sub: "user-1", username: "alice", platform_role: "user",
      organization_id: "org-1", org_role: "owner", team_ids: ["team-1"],
      tenant_db: "ciphertext",
    });
    const req = makeReq(`Bearer ${token}`);
    const next = vi.fn() as unknown as NextFunction;
    requireTenantToken(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: "user-1", username: "alice", role: "user" });
    expect(req.workspace).toEqual({ organizationId: "org-1", orgRole: "owner", teamIds: ["team-1"] });
    expect(req.tenantDbEncrypted).toBe("ciphertext");
  });

  it("supports a null tenant_db claim (transitoire orgs)", () => {
    process.env["TENANT_JWT_SECRET"] = "test-tenant-jwt-secret";
    const token = signTenantToken({
      sub: "user-1", username: "alice", platform_role: "user",
      organization_id: "org-1", org_role: "owner", team_ids: [],
      tenant_db: null,
    });
    const req = makeReq(`Bearer ${token}`);
    const next = vi.fn() as unknown as NextFunction;
    requireTenantToken(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.tenantDbEncrypted).toBeNull();
  });

  it("rejects an expired token", () => {
    process.env["TENANT_JWT_SECRET"] = "test-tenant-jwt-secret";
    const token = signTenantToken({
      sub: "user-1", username: "alice", platform_role: "user",
      organization_id: "org-1", org_role: "owner", team_ids: [],
      tenant_db: null,
    }, -1);
    const req = makeReq(`Bearer ${token}`);
    const next = vi.fn() as unknown as NextFunction;
    requireTenantToken(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});
