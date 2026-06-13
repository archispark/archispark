import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { runMigrations } from "./migrate.js";
import { controlDb, db, getTenantDb, getTenantConnectionStringEncrypted, runWithTenantDb } from "./connection.js";
import { organizations, tenantDatabases } from "./schema.js";
import { eq } from "drizzle-orm";
import { encryptConnectionString } from "./tenant-crypto.js";

beforeAll(async () => {
  await runMigrations();
});

async function makeOrg(): Promise<string> {
  const id = `org-conn-test-${randomUUID()}`;
  await controlDb.insert(organizations).values({ id, name: id, slug: id, createdAt: new Date() });
  return id;
}

describe("getTenantDb", () => {
  it("returns controlDb when the organization has no tenant_databases row", async () => {
    const orgId = await makeOrg();
    expect(await getTenantDb(orgId)).toBe(controlDb);
  });

  it("returns controlDb when the tenant database is not active", async () => {
    const orgId = await makeOrg();
    await controlDb.insert(tenantDatabases).values({
      organizationId: orgId,
      neonDatabaseName: "tenant_db",
      neonRoleName: "tenant",
      connectionStringEncrypted: "irrelevant-while-pending",
      status: "pending",
    });
    expect(await getTenantDb(orgId)).toBe(controlDb);
  });

  it("returns and caches a dedicated client once the tenant database is active", async () => {
    process.env["TENANT_DB_ENCRYPTION_KEY"] = "test-tenant-db-encryption-key";
    const orgId = await makeOrg();
    const connectionString = "postgresql://tenant:secret@ep-fake-tenant.us-east-2.aws.neon.tech/tenant_db";
    await controlDb.insert(tenantDatabases).values({
      organizationId: orgId,
      neonDatabaseName: "tenant_db",
      neonRoleName: "tenant",
      connectionStringEncrypted: encryptConnectionString(connectionString),
      status: "active",
    });
    const tenantDb = await getTenantDb(orgId);
    expect(tenantDb).not.toBe(controlDb);
    // Cached: a second call returns the exact same instance.
    expect(await getTenantDb(orgId)).toBe(tenantDb);
  });

  it("returns a node-postgres-backed client for a local (docker-compose dev) active tenant database", async () => {
    process.env["TENANT_DB_ENCRYPTION_KEY"] = "test-tenant-db-encryption-key";
    const orgId = await makeOrg();
    const connectionString = "postgresql://archispark:archispark@localhost:5432/tenant_local_test";
    await controlDb.insert(tenantDatabases).values({
      organizationId: orgId,
      neonDatabaseName: "tenant_local_test",
      neonRoleName: "archispark",
      connectionStringEncrypted: encryptConnectionString(connectionString),
      status: "active",
    });
    const tenantDb = await getTenantDb(orgId);
    expect(tenantDb).not.toBe(controlDb);
    expect(await getTenantDb(orgId)).toBe(tenantDb);
  });
});

describe("getTenantConnectionStringEncrypted", () => {
  it("returns null when the organization has no tenant_databases row", async () => {
    const orgId = await makeOrg();
    expect(await getTenantConnectionStringEncrypted(orgId)).toBeNull();
  });

  it("returns null when the tenant database is not active", async () => {
    const orgId = await makeOrg();
    await controlDb.insert(tenantDatabases).values({
      organizationId: orgId,
      neonDatabaseName: "tenant_db",
      neonRoleName: "tenant",
      connectionStringEncrypted: "irrelevant-while-pending",
      status: "pending",
    });
    expect(await getTenantConnectionStringEncrypted(orgId)).toBeNull();
  });

  it("returns the ciphertext as-is once the tenant database is active", async () => {
    const orgId = await makeOrg();
    const ciphertext = encryptConnectionString("postgresql://tenant:secret@ep-fake-tenant.us-east-2.aws.neon.tech/tenant_db");
    await controlDb.insert(tenantDatabases).values({
      organizationId: orgId,
      neonDatabaseName: "tenant_db",
      neonRoleName: "tenant",
      connectionStringEncrypted: ciphertext,
      status: "active",
    });
    expect(await getTenantConnectionStringEncrypted(orgId)).toBe(ciphertext);
  });
});

describe("db proxy + runWithTenantDb", () => {
  it("resolves to controlDb outside of any tenant context", async () => {
    const rows = await db.select().from(organizations).where(eq(organizations.id, "__no-such-org__"));
    expect(rows).toEqual([]);
  });

  it("resolves to the bound tenant db within runWithTenantDb", () => {
    const fakeTenantDb = { getMarker: () => "tenant" } as unknown as Parameters<typeof runWithTenantDb>[0];
    const result = runWithTenantDb(fakeTenantDb, () => (db as unknown as { getMarker(): string }).getMarker());
    expect(result).toBe("tenant");
  });

  it("persists the tenant context across async boundaries", async () => {
    const fakeTenantDb = { getMarker: () => "tenant-async" } as unknown as Parameters<typeof runWithTenantDb>[0];
    const result = await runWithTenantDb(fakeTenantDb, async () => {
      await Promise.resolve();
      return (db as unknown as { getMarker(): string }).getMarker();
    });
    expect(result).toBe("tenant-async");
  });
});
