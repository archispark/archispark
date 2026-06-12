import { describe, it, expect } from "vitest";
import { getTableName, is, Table } from "drizzle-orm";
import { TENANT_DB_ROLE, TENANT_TABLES, ensureTenantRole } from "./tenant-role.js";
import * as tenantSchema from "./schema.tenant.js";

describe("TENANT_DB_ROLE", () => {
  it("is archispark_tenant", () => {
    expect(TENANT_DB_ROLE).toBe("archispark_tenant");
  });
});

describe("TENANT_TABLES", () => {
  it("matches every table in schema.tenant.ts", () => {
    // Cast to unknown[] first so the type predicate can narrow from a base type
    // without conflicting with the specific concrete table union inferred from
    // the schema namespace import.
    const schemaTables = (Object.values(tenantSchema) as unknown[])
      .filter((v): v is Table => is(v, Table))
      .map((v) => getTableName(v))
      .sort();

    expect([...TENANT_TABLES].sort()).toEqual(schemaTables);
  });

  it("has exactly 12 entries", () => {
    expect(TENANT_TABLES).toHaveLength(12);
  });
});

describe("ensureTenantRole", () => {
  it("is no-op under PGlite (VITEST=1)", async () => {
    // USE_PGLITE=true in test environment — must resolve without touching DB
    await expect(ensureTenantRole("any-password")).resolves.toBeUndefined();
  });

  it("is no-op when password is empty", async () => {
    await expect(ensureTenantRole("")).resolves.toBeUndefined();
  });
});
