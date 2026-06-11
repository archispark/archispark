import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { runMigrations } from "./migrate.js";
import { controlDb } from "./connection.js";
import * as schema from "./schema.js";
import { provisionTenantDatabase } from "./tenant-provisioning.js";
import { decryptConnectionString } from "./tenant-crypto.js";

const ORIGINAL_ENV = { ...process.env };

beforeAll(async () => {
  await runMigrations();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV, TENANT_DB_ENCRYPTION_KEY: "test-tenant-provisioning-key" };
  vi.unstubAllGlobals();
});

async function makeOrg(): Promise<string> {
  const id = `org-prov-test-${randomUUID()}`;
  await controlDb.insert(schema.organizations).values({ id, name: id, slug: id, createdAt: new Date() });
  return id;
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) };
}

function mockNeonFetch(failOn?: "roles" | "databases") {
  const fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/branches")) return jsonResponse({ branches: [{ id: "br-1", default: true }] });
    if (path.endsWith("/roles")) {
      if (failOn === "roles") return jsonResponse({ message: "boom" }, false, 500);
      return jsonResponse({ role: { name: "tenant_role" } });
    }
    if (path.endsWith("/databases")) {
      if (failOn === "databases") return jsonResponse({ message: "boom" }, false, 500);
      return jsonResponse({ database: { name: "tenant_db" } });
    }
    if (path.endsWith("/connection_uri")) {
      return jsonResponse({ uri: "postgresql://tenant_role:pw@ep-fake.neon.tech/tenant_db" });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function makePgliteTenantDb(): NodePgDatabase<typeof schema> {
  return drizzle(new PGlite(), { schema }) as unknown as NodePgDatabase<typeof schema>;
}

describe("provisionTenantDatabase", () => {
  it("is a no-op when Neon API credentials are not configured", async () => {
    delete process.env["NEON_API_KEY"];
    delete process.env["NEON_PROJECT_ID"];
    const orgId = await makeOrg();

    await provisionTenantDatabase(orgId);

    const [row] = await controlDb.select().from(schema.tenantDatabases)
      .where(eq(schema.tenantDatabases.organizationId, orgId));
    expect(row).toBeUndefined();
  });

  it("provisions a new tenant database: creates role/db, runs migrations, seeds the default workspace, marks active", async () => {
    process.env["NEON_API_KEY"] = "key";
    process.env["NEON_PROJECT_ID"] = "proj-1";
    mockNeonFetch();
    const orgId = await makeOrg();

    let createdTenantDb: NodePgDatabase<typeof schema> | undefined;
    await provisionTenantDatabase(orgId, {
      tenantDbFactory: () => {
        createdTenantDb = makePgliteTenantDb();
        return createdTenantDb;
      },
    });

    const [row] = await controlDb.select().from(schema.tenantDatabases)
      .where(eq(schema.tenantDatabases.organizationId, orgId));
    expect(row?.status).toBe("active");
    expect(row?.neonDatabaseName).toMatch(/^tenant_/);
    expect(row?.neonRoleName).toMatch(/^tenant_/);
    expect(decryptConnectionString(row!.connectionStringEncrypted)).toBe("postgresql://tenant_role:pw@ep-fake.neon.tech/tenant_db");

    const tenantWorkspaces = await createdTenantDb!.select().from(schema.workspaces);
    expect(tenantWorkspaces).toHaveLength(1);
    expect(tenantWorkspaces[0]?.name).toBe("Default");
    expect(tenantWorkspaces[0]?.organizationId).toBe(orgId);
  });

  it("is idempotent: skips an organization whose database is already active", async () => {
    process.env["NEON_API_KEY"] = "key";
    process.env["NEON_PROJECT_ID"] = "proj-1";
    const fetchMock = mockNeonFetch();
    const orgId = await makeOrg();
    await controlDb.insert(schema.tenantDatabases).values({
      organizationId: orgId, neonDatabaseName: "tenant_x", neonRoleName: "tenant_x",
      connectionStringEncrypted: "irrelevant", status: "active",
    });

    await provisionTenantDatabase(orgId);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks the tenant database row as 'error' and rethrows when the Neon API fails", async () => {
    process.env["NEON_API_KEY"] = "key";
    process.env["NEON_PROJECT_ID"] = "proj-1";
    mockNeonFetch("roles");
    const orgId = await makeOrg();

    await expect(provisionTenantDatabase(orgId, { tenantDbFactory: makePgliteTenantDb }))
      .rejects.toThrow(/500/);

    const [row] = await controlDb.select().from(schema.tenantDatabases)
      .where(eq(schema.tenantDatabases.organizationId, orgId));
    expect(row?.status).toBe("error");
  });

  it("retries provisioning for an organization whose previous attempt errored", async () => {
    process.env["NEON_API_KEY"] = "key";
    process.env["NEON_PROJECT_ID"] = "proj-1";
    const orgId = await makeOrg();
    await controlDb.insert(schema.tenantDatabases).values({
      organizationId: orgId, neonDatabaseName: "tenant_x", neonRoleName: "tenant_x",
      connectionStringEncrypted: "", status: "error",
    });

    const fetchMock = mockNeonFetch();
    await provisionTenantDatabase(orgId, { tenantDbFactory: makePgliteTenantDb });

    expect(fetchMock).toHaveBeenCalled();
    const [row] = await controlDb.select().from(schema.tenantDatabases)
      .where(eq(schema.tenantDatabases.organizationId, orgId));
    expect(row?.status).toBe("active");
  });
});
