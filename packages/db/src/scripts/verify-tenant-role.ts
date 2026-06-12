/**
 * Integration smoke-test for ensureTenantRole (Phase 7).
 *
 * Requires a running Postgres with two databases (archispark + archispark_tenant).
 * Run (from repo root):
 *   DATABASE_URL=postgresql://archispark:archispark@localhost:5432/archispark \
 *   TENANT_DATABASE_URL=postgresql://archispark:archispark@localhost:5432/archispark_tenant \
 *   TENANT_DB_PASSWORD=test-tenant-password-phase7 \
 *   pnpm -C packages/db exec tsx src/scripts/verify-tenant-role.ts
 */

import { Pool } from "pg";
import { runMigrations } from "../migrate.js";
import { runTenantFallbackMigrations } from "../migrate-tenant.js";
import { ensureTenantRole, TENANT_DB_ROLE, TENANT_TABLES } from "../tenant-role.js";

const DB_URL = process.env["DATABASE_URL"];
const TENANT_PASSWORD = process.env["TENANT_DB_PASSWORD"] ?? "test-tenant-password-phase7";

if (!DB_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

// Build restricted URL by replacing user:password in the admin URL
function buildTenantUrl(adminUrl: string, role: string, password: string): string {
  const u = new URL(adminUrl);
  u.username = role;
  u.password = password;
  return u.toString();
}

let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label: string, err: unknown) {
  console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : String(err)}`);
  failed++;
}

async function run() {
  console.log("\n=== Phase 7 — verify-tenant-role ===\n");

  // 1. Migrations: control DB first, then tenant fallback DB
  process.stdout.write("1. Running control migrations... ");
  await runMigrations();
  console.log("done");

  process.stdout.write("2. Running tenant fallback migrations... ");
  await runTenantFallbackMigrations();
  console.log("done");

  // 3. Create/update archispark_tenant role
  process.stdout.write("3. ensureTenantRole... ");
  await ensureTenantRole(TENANT_PASSWORD);
  console.log("done");

  // 4. Verify role exists in pg_roles
  const adminPool = new Pool({ connectionString: DB_URL, ssl: false });
  try {
    const { rows } = await adminPool.query(
      "SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = $1",
      [TENANT_DB_ROLE],
    );
    if (rows.length === 1 && rows[0].rolcanlogin) {
      ok(`role ${TENANT_DB_ROLE} exists with LOGIN`);
    } else {
      fail(`role ${TENANT_DB_ROLE} exists with LOGIN`, `got: ${JSON.stringify(rows)}`);
    }
  } finally {
    await adminPool.end();
  }

  // 5. Connect as archispark_tenant against archispark_TENANT DB and verify access
  const tenantDbUrl = process.env["TENANT_DATABASE_URL"] ?? DB_URL!;
  const tenantUrl = buildTenantUrl(tenantDbUrl, TENANT_DB_ROLE, TENANT_PASSWORD);
  const tenantPool = new Pool({ connectionString: tenantUrl, ssl: false });

  console.log("\n5. Tenant-role grants on archispark_tenant DB:");

  // SELECT on each tenant table should succeed
  for (const table of TENANT_TABLES) {
    try {
      await tenantPool.query(`SELECT 1 FROM "${table}" LIMIT 0`);
      ok(`SELECT on "${table}"`);
    } catch (err) {
      fail(`SELECT on "${table}"`, err);
    }
  }

  // INSERT on workspaces should succeed (needs sequence too)
  console.log("\n6. DML on workspaces (in archispark_tenant DB):");
  let insertedId: number | undefined;
  try {
    const res = await tenantPool.query<{ id: number }>(
      `INSERT INTO workspaces (uuid, name, organization_id) VALUES ('verify-test-uuid', 'verify-test', 'verify-org') RETURNING id`,
    );
    insertedId = res.rows[0]?.id;
    ok(`INSERT into workspaces (id=${insertedId})`);
  } catch (err) {
    fail("INSERT into workspaces", err);
  }

  if (insertedId !== undefined) {
    try {
      await tenantPool.query(`UPDATE workspaces SET name = 'verify-test-updated' WHERE id = $1`, [insertedId]);
      ok(`UPDATE workspaces`);
    } catch (err) {
      fail("UPDATE workspaces", err);
    }
    try {
      await tenantPool.query(`DELETE FROM workspaces WHERE id = $1`, [insertedId]);
      ok(`DELETE from workspaces`);
    } catch (err) {
      fail("DELETE from workspaces", err);
    }
  }

  // SELECT on control-plane table should be DENIED (user/org tables don't even
  // exist in archispark_tenant DB — "does not exist" is also an acceptable error)
  console.log("\n6. Control-plane access on tenant DB (must be denied):");
  try {
    await tenantPool.query(`SELECT 1 FROM "user" LIMIT 0`);
    fail('SELECT on "user" should be denied', "got no error");
  } catch {
    ok(`SELECT on "user" is denied (as expected)`);
  }

  try {
    await tenantPool.query(`SELECT 1 FROM "organization" LIMIT 0`);
    fail('SELECT on "organization" should be denied', "got no error");
  } catch {
    ok(`SELECT on "organization" is denied (as expected)`);
  }

  await tenantPool.end();

  // 7. Verify control DB does NOT contain tenant tables (physical isolation)
  console.log("\n7. Physical isolation — tenant tables absent from control DB:");
  const ctrlPool = new Pool({ connectionString: DB_URL!, ssl: false });
  try {
    const { rows } = await ctrlPool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)`,
      [["workspaces", "elements", "views"]],
    );
    if (rows.length === 0) {
      ok("tenant tables (workspaces, elements, views) absent from archispark (control DB)");
    } else {
      fail("tenant tables absent from control DB", `found: ${rows.map(r => r.tablename).join(", ")}`);
    }
  } finally {
    await ctrlPool.end();
  }

  console.log(`\n${"─".repeat(40)}`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
