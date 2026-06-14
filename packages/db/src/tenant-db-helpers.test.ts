import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { runMigrations } from "./migrate.js";
import { controlDb } from "./connection.js";
import * as schema from "./schema.js";
import { sanitizeIdentifier, markTenantDatabaseError } from "./tenant-db-helpers.js";

beforeAll(async () => {
  await runMigrations();
});

async function makeOrgWithTenantDatabaseRow(): Promise<string> {
  const id = `org-helpers-test-${randomUUID()}`;
  await controlDb.insert(schema.tenantDatabases).values({
    organizationId: id,
    neonDatabaseName: `tenant_${id}`,
    neonRoleName: "tenant",
    connectionStringEncrypted: "irrelevant",
    status: "provisioning",
  });
  return id;
}

async function getTenantDatabaseRow(organizationId: string) {
  const [row] = await controlDb.select().from(schema.tenantDatabases)
    .where(eq(schema.tenantDatabases.organizationId, organizationId));
  return row;
}

describe("sanitizeIdentifier", () => {
  it("lowercases and replaces non alphanumeric/underscore characters with underscores", () => {
    expect(sanitizeIdentifier("Org-ID.123")).toBe("org_id_123");
  });

  it("leaves already-sanitized identifiers unchanged", () => {
    expect(sanitizeIdentifier("already_sanitized_123")).toBe("already_sanitized_123");
  });
});

describe("markTenantDatabaseError", () => {
  it("stores the message of an Error instance", async () => {
    const orgId = await makeOrgWithTenantDatabaseRow();

    await markTenantDatabaseError(orgId, new Error("boom"));

    const row = await getTenantDatabaseRow(orgId);
    expect(row?.status).toBe("error");
    expect(row?.lastError).toBe("boom");
  });

  it("stringifies a non-Error thrown value", async () => {
    const orgId = await makeOrgWithTenantDatabaseRow();

    await markTenantDatabaseError(orgId, "raw-string-failure");

    const row = await getTenantDatabaseRow(orgId);
    expect(row?.status).toBe("error");
    expect(row?.lastError).toBe("raw-string-failure");
  });

  it("stores a null lastError when no error value is provided", async () => {
    const orgId = await makeOrgWithTenantDatabaseRow();

    await markTenantDatabaseError(orgId);

    const row = await getTenantDatabaseRow(orgId);
    expect(row?.status).toBe("error");
    expect(row?.lastError).toBeNull();
  });
});
