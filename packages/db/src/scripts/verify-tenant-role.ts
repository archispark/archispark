/**
 * Integration smoke-test for ensureTenantRole (Phase 7).
 *
 * Requires a running Postgres reachable at DATABASE_URL.
 * Run (from repo root):
 *   DATABASE_URL=postgresql://archispark:archispark@localhost:5432/archispark \
 *   TENANT_DB_PASSWORD=test-tenant-password-phase7 \
 *   pnpm --filter @workspace/db tsx src/scripts/verify-tenant-role.ts
 */

import { Pool } from "pg";
import { runMigrations } from "../migrate.js";
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

  // 1. Migrations
  process.stdout.write("1. Running migrations... ");
  await runMigrations();
  console.log("done");

  // 2. Create/update archispark_tenant role
  process.stdout.write("2. ensureTenantRole... ");
  await ensureTenantRole(TENANT_PASSWORD);
  console.log("done");

  // 3. Verify role exists in pg_roles
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

  // 4. Connect as archispark_tenant and verify access
  // DB_URL is guaranteed non-empty: the module-level guard exits before run() is called.
  const tenantUrl = buildTenantUrl(DB_URL!, TENANT_DB_ROLE, TENANT_PASSWORD);
  const tenantPool = new Pool({ connectionString: tenantUrl, ssl: false });

  console.log("\n3. Tenant-role grants:");

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
  console.log("\n4. DML on workspaces:");
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

  // SELECT on control-plane table should be DENIED
  console.log("\n5. Control-plane access (must be denied):");
  try {
    await tenantPool.query(`SELECT 1 FROM "user" LIMIT 0`);
    fail('SELECT on "user" should be denied', "got no error");
  } catch {
    ok(`SELECT on "user" is denied (permission denied as expected)`);
  }

  try {
    await tenantPool.query(`SELECT 1 FROM "organization" LIMIT 0`);
    fail('SELECT on "organization" should be denied', "got no error");
  } catch {
    ok(`SELECT on "organization" is denied (permission denied as expected)`);
  }

  await tenantPool.end();

  console.log(`\n${"─".repeat(40)}`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
