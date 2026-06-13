import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { runMigrations } from "./migrate.js";
import { controlDb } from "./connection.js";
import * as schema from "./schema.js";
import { canProvisionLocally, buildLocalTenantConnectionString, provisionLocalTenantInfrastructure } from "./local-provisioning.js";
import { sanitizeIdentifier } from "./tenant-db-helpers.js";

const ORIGINAL_ENV = { ...process.env };

beforeAll(async () => {
  await runMigrations();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function makeOrg(): Promise<string> {
  const id = `org-local-prov-${randomUUID()}`;
  await controlDb.insert(schema.organizations).values({ id, name: id, slug: id, createdAt: new Date() });
  return id;
}

function makePgliteTenantDb(): NodePgDatabase<typeof schema> {
  return drizzle(new PGlite(), { schema }) as unknown as NodePgDatabase<typeof schema>;
}

describe("canProvisionLocally", () => {
  it("is false under the test runner (PGlite), regardless of DATABASE_URL", () => {
    process.env["DATABASE_URL"] = "postgresql://archispark:archispark@localhost:5432/archispark";
    expect(canProvisionLocally()).toBe(false);
  });
});

describe("buildLocalTenantConnectionString", () => {
  it("swaps the database name in DATABASE_URL", () => {
    process.env["DATABASE_URL"] = "postgresql://archispark:archispark@localhost:5432/archispark";
    expect(buildLocalTenantConnectionString("tenant_foo")).toBe("postgresql://archispark:archispark@localhost:5432/tenant_foo");
  });

  it("throws when DATABASE_URL is not set", () => {
    delete process.env["DATABASE_URL"];
    expect(() => buildLocalTenantConnectionString("tenant_foo")).toThrow(/DATABASE_URL/);
  });
});

describe("provisionLocalTenantInfrastructure", () => {
  beforeAll(() => {
    process.env["DATABASE_URL"] = "postgresql://archispark:archispark@localhost:5432/archispark";
  });

  it("creates the tenant_databases row, runs migrations and returns the new infra", async () => {
    const orgId = await makeOrg();
    const slug = sanitizeIdentifier(orgId);
    let createdTenantDb: NodePgDatabase<typeof schema> | undefined;

    const infra = await provisionLocalTenantInfrastructure(orgId, {
      createDatabase: async () => {},
      tenantDbFactory: () => {
        createdTenantDb = makePgliteTenantDb();
        return createdTenantDb;
      },
    });

    expect(infra).toBeDefined();
    expect(infra!.connectionString).toBe(`postgresql://archispark:archispark@localhost:5432/tenant_${slug}`);
    expect(infra!.tenantDb).toBe(createdTenantDb);

    const [row] = await controlDb.select().from(schema.tenantDatabases)
      .where(eq(schema.tenantDatabases.organizationId, orgId));
    expect(row?.status).toBe("provisioning");
    expect(row?.neonProjectId).toBeNull();
    expect(row?.neonDatabaseName).toBe(`tenant_${slug}`);
    expect(row?.neonRoleName).toBe("archispark");

    // Tenant migrations ran against the PGlite db handed back via tenantDbFactory.
    const workspaces = await createdTenantDb!.select().from(schema.workspaces);
    expect(workspaces).toEqual([]);
  });

  it("is idempotent: skips an organization whose database is already active", async () => {
    const orgId = await makeOrg();
    await controlDb.insert(schema.tenantDatabases).values({
      organizationId: orgId, neonDatabaseName: "tenant_x", neonRoleName: "archispark",
      connectionStringEncrypted: "irrelevant", status: "active",
    });

    const infra = await provisionLocalTenantInfrastructure(orgId, {
      createDatabase: async () => { throw new Error("should not be called"); },
    });

    expect(infra).toBeUndefined();
  });

  it("marks the tenant database row as 'error' and rethrows when CREATE DATABASE fails", async () => {
    const orgId = await makeOrg();

    await expect(provisionLocalTenantInfrastructure(orgId, {
      createDatabase: async () => { throw new Error("boom"); },
    })).rejects.toThrow("boom");

    const [row] = await controlDb.select().from(schema.tenantDatabases)
      .where(eq(schema.tenantDatabases.organizationId, orgId));
    expect(row?.status).toBe("error");
    expect(row?.lastError).toBe("boom");
  });
});
