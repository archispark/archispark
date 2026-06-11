import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { runTenantMigrations } from "./migrate-tenant.js";
import * as schema from "./schema.js";

describe("runTenantMigrations", () => {
  it("creates the tenant tables (no control-plane tables) on a fresh database", async () => {
    const tenantDb = drizzle(new PGlite(), { schema }) as unknown as NodePgDatabase<typeof schema>;

    await runTenantMigrations(tenantDb);

    const [ws] = await tenantDb.insert(schema.workspaces).values({
      uuid: "id-test", name: "Test workspace", organizationId: "org-1",
    }).returning({ id: schema.workspaces.id });
    expect(ws?.id).toBeDefined();

    const tables = await tenantDb.execute<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const tableNames = tables.rows.map((r) => r.table_name);
    expect(tableNames).toContain("elements");
    expect(tableNames).toContain("views");
    // Control-plane tables must not exist in a tenant database.
    expect(tableNames).not.toContain("organization");
    expect(tableNames).not.toContain("user");
  });
});
