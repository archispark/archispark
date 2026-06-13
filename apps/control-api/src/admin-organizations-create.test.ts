/**
 * Tests for POST /admin/organizations — initial-owner assignment.
 *
 * Platform admins have no access to tenant data, so the admin creating an
 * organization must never become one of its members. Either a fresh
 * "admin-<slug>" account is generated and returned once as `initial_owner`,
 * or an existing platform user (`initial_owner_user_id`) becomes owner.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import _request from "supertest";
import { eq, and } from "drizzle-orm";
import { controlDb, organizations as organizationsTable, members as membersTable, users as usersTable, provisionTenantDatabase, getDefaultBranchId } from "@workspace/db";
import { app } from "../src/app.js";
import { createUser } from "../src/auth.js";
import { getAdminCookie, getAdminWorkspaceContext } from "../src/test-helper.js";

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    provisionTenantDatabase: vi.fn(actual.provisionTenantDatabase),
    getDefaultBranchId: vi.fn(actual.getDefaultBranchId),
  };
});

const ORIGINAL_ENV = { ...process.env };

let adminCookie: string;

beforeAll(async () => {
  adminCookie = await getAdminCookie();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

function request(appArg: Parameters<typeof _request>[0]) {
  return _request.agent(appArg).set("Cookie", adminCookie);
}

describe("POST /admin/organizations — validation", () => {
  it("returns 422 when 'name' is missing", async () => {
    const res = await request(app).post("/admin/organizations").send({ slug: "no-name-test" });
    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/name/);
  });

  it("returns 422 when 'name' is an empty/whitespace string", async () => {
    const res = await request(app).post("/admin/organizations").send({ name: "   ", slug: "blank-name-test" });
    expect(res.status).toBe(422);
  });

  it("returns 503 and creates nothing when Neon is configured but unreachable", async () => {
    process.env["NEON_API_KEY"] = "key";
    process.env["NEON_PROJECT_ID"] = "proj-1";
    vi.mocked(getDefaultBranchId).mockRejectedValueOnce(new Error("Neon API error: 500"));

    const res = await request(app).post("/admin/organizations").send({ name: "Zeta Org", slug: "zeta-org-test" });
    expect(res.status).toBe(503);

    const [org] = await controlDb.select().from(organizationsTable).where(eq(organizationsTable.slug, "zeta-org-test"));
    expect(org).toBeUndefined();

    const [generatedUser] = await controlDb.select().from(usersTable).where(eq(usersTable.username, "admin-zeta-org-test"));
    expect(generatedUser).toBeUndefined();
  });
});

describe("POST /admin/organizations — initial owner assignment", () => {
  it("generates an admin-<slug> account as owner, returned once, and never adds the calling admin", async () => {
    const res = await request(app).post("/admin/organizations").send({ name: "Acme Corp", slug: "acme-corp-test" });
    expect(res.status).toBe(201);

    expect(res.body.initial_owner).toEqual({ username: "admin-acme-corp-test", password: expect.any(String) });
    expect((res.body.initial_owner.password as string).length).toBeGreaterThan(0);

    const [member] = await controlDb.select().from(membersTable)
      .where(and(eq(membersTable.organizationId, res.body.id), eq(membersTable.role, "owner")));
    expect(member).toBeDefined();

    const [ownerUser] = await controlDb.select().from(usersTable).where(eq(usersTable.id, member!.userId));
    expect(ownerUser?.username).toBe("admin-acme-corp-test");

    const { userId: adminUserId } = await getAdminWorkspaceContext();
    const [adminMember] = await controlDb.select().from(membersTable)
      .where(and(eq(membersTable.organizationId, res.body.id), eq(membersTable.userId, adminUserId)));
    expect(adminMember).toBeUndefined();
  });

  it("uses an existing user as owner when initial_owner_user_id is given, with no generated credentials", async () => {
    const existing = await createUser("existing-owner-ci", "password123", "user");

    const res = await request(app).post("/admin/organizations").send({
      name: "Beta Inc", slug: "beta-inc-test", initial_owner_user_id: existing.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.initial_owner).toBeUndefined();

    const [member] = await controlDb.select().from(membersTable)
      .where(and(eq(membersTable.organizationId, res.body.id), eq(membersTable.userId, existing.id)));
    expect(member?.role).toBe("owner");

    const [generated] = await controlDb.select().from(usersTable).where(eq(usersTable.username, "admin-beta-inc-test"));
    expect(generated).toBeUndefined();
  });

  it("returns 422 for an unknown initial_owner_user_id and creates nothing", async () => {
    const res = await request(app).post("/admin/organizations").send({
      name: "Gamma LLC", slug: "gamma-llc-test", initial_owner_user_id: "does-not-exist",
    });
    expect(res.status).toBe(422);

    const [org] = await controlDb.select().from(organizationsTable).where(eq(organizationsTable.slug, "gamma-llc-test"));
    expect(org).toBeUndefined();
  });

  it("returns 422 when the slug is already used by another organization", async () => {
    const first = await request(app).post("/admin/organizations").send({ name: "Epsilon Org", slug: "epsilon-org-test" });
    expect(first.status).toBe(201);

    const res = await request(app).post("/admin/organizations").send({ name: "Epsilon Duplicate", slug: "epsilon-org-test" });
    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/déjà utilisé/);

    // No second generated owner account should have been created for the duplicate.
    const owners = await controlDb.select().from(usersTable).where(eq(usersTable.username, "admin-epsilon-org-test"));
    expect(owners.length).toBe(1);
  });

  it("cleans up the generated owner account and organization when provisioning fails", async () => {
    vi.mocked(provisionTenantDatabase).mockRejectedValueOnce(new Error("boom"));

    const res = await request(app).post("/admin/organizations").send({ name: "Delta Co", slug: "delta-co-test" });
    expect(res.status).toBe(503);

    const [org] = await controlDb.select().from(organizationsTable).where(eq(organizationsTable.slug, "delta-co-test"));
    expect(org).toBeUndefined();

    const [generatedUser] = await controlDb.select().from(usersTable).where(eq(usersTable.username, "admin-delta-co-test"));
    expect(generatedUser).toBeUndefined();
  });

  it("does not delete an existing initial_owner_user_id account when provisioning fails", async () => {
    const existing = await createUser("existing-owner-cleanup-ci", "password123", "user");
    vi.mocked(provisionTenantDatabase).mockRejectedValueOnce(new Error("boom"));

    const res = await request(app).post("/admin/organizations").send({
      name: "Theta Co", slug: "theta-co-test", initial_owner_user_id: existing.id,
    });
    expect(res.status).toBe(503);

    const [org] = await controlDb.select().from(organizationsTable).where(eq(organizationsTable.slug, "theta-co-test"));
    expect(org).toBeUndefined();

    const [stillExists] = await controlDb.select().from(usersTable).where(eq(usersTable.id, existing.id));
    expect(stillExists).toBeDefined();
  });
});
