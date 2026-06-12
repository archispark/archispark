import { describe, it, expect, afterEach } from "vitest";
import { signTenantToken, verifyTenantToken, type TenantTokenPayload } from "./tenant-jwt.js";

const ORIGINAL_SECRET = process.env["TENANT_JWT_SECRET"];

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env["TENANT_JWT_SECRET"];
  else process.env["TENANT_JWT_SECRET"] = ORIGINAL_SECRET;
});

const PAYLOAD: TenantTokenPayload = {
  sub: "user-1",
  username: "alice",
  platform_role: "user",
  organization_id: "org-1",
  org_role: "owner",
  team_ids: ["team-1", "team-2"],
  tenant_db: "encrypted-connection-string",
};

describe("signTenantToken / verifyTenantToken", () => {
  it("round-trips a payload", () => {
    process.env["TENANT_JWT_SECRET"] = "test-tenant-jwt-secret";
    const token = signTenantToken(PAYLOAD);
    expect(verifyTenantToken(token)).toMatchObject(PAYLOAD);
  });

  it("supports a null tenant_db claim (transitoire orgs)", () => {
    process.env["TENANT_JWT_SECRET"] = "test-tenant-jwt-secret";
    const token = signTenantToken({ ...PAYLOAD, tenant_db: null });
    expect(verifyTenantToken(token).tenant_db).toBeNull();
  });

  it("throws when TENANT_JWT_SECRET is not set", () => {
    delete process.env["TENANT_JWT_SECRET"];
    expect(() => signTenantToken(PAYLOAD)).toThrow(/TENANT_JWT_SECRET/);
    expect(() => verifyTenantToken("irrelevant")).toThrow(/TENANT_JWT_SECRET/);
  });

  it("rejects a token signed with a different secret", () => {
    process.env["TENANT_JWT_SECRET"] = "secret-one";
    const token = signTenantToken(PAYLOAD);
    process.env["TENANT_JWT_SECRET"] = "secret-two";
    expect(() => verifyTenantToken(token)).toThrow();
  });

  it("rejects an expired token", () => {
    process.env["TENANT_JWT_SECRET"] = "test-tenant-jwt-secret";
    const token = signTenantToken(PAYLOAD, -1);
    expect(() => verifyTenantToken(token)).toThrow(/expired/);
  });
});
