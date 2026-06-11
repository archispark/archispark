import { Pool } from "pg";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import { AsyncLocalStorage } from "node:async_hooks";
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";
import { decryptConnectionString } from "./tenant-crypto.js";

/**
 * Single database driver: PostgreSQL.
 *
 * Production / dev use node-postgres against a real Postgres (Supabase, local,
 * etc.). The test suite uses PGlite — Postgres compiled to WASM, in-memory and
 * in-process — so tests keep full Postgres fidelity without Docker. Both share
 * the same `schema` and the same `drizzle-pg` migrations (identical SQL dialect).
 */
// v8 ignore next
export const USE_PGLITE = Boolean(process.env["VITEST"]) || process.env["DB_CLIENT"] === "pglite";

async function createDb(): Promise<NodePgDatabase<typeof schema>> {
  // v8 ignore start
  if (USE_PGLITE) {
    // Indirect specifiers: keep these test-only deps (PGlite ships WASM) out of
    // the production serverless bundle — a static import() lets Vercel's esbuild
    // trace and bundle them, which breaks the function. `import(variable)` stays
    // a runtime resolution that only executes under VITEST.
    const pglitePkg = "@electric-sql/pglite";
    const drizzlePglitePkg = "drizzle-orm/pglite";
    const { PGlite } = await import(pglitePkg);
    const { drizzle: pgliteDrizzle } = await import(drizzlePglitePkg);
    // Cast: PGlite and node-postgres share the same Drizzle query API + pg
    // dialect; the cast lets callers type against a single db shape.
    return pgliteDrizzle(new PGlite(), { schema }) as unknown as NodePgDatabase<typeof schema>;
  }
  // v8 ignore stop

  // Priority: explicit DATABASE_URL → Supabase pooled (IPv4 — works from
  // serverless/Vercel) → Supabase direct (IPv6 — only reachable locally/in a
  // container). Serverless functions must use the pooled connection: the direct
  // host is IPv6-only and unreachable from Lambdas.
  const rawConnectionString =
    process.env["DATABASE_URL"] ??
    process.env["POSTGRES_URL"] ??
    process.env["POSTGRES_URL_NON_POOLING"];

  if (!rawConnectionString) {
    throw new Error("DATABASE_URL (or POSTGRES_URL / POSTGRES_URL_NON_POOLING) is required");
  }

  // isLocal: standard local hostnames OR explicit sslmode=disable in the URL
  // (covers K8s/Docker internal hostnames like archispark-postgres that don't
  // match the localhost pattern but also have no SSL).
  const isLocal =
    /@(localhost|127\.0\.0\.1|\[::1\]|postgres)[:/]/.test(rawConnectionString) ||
    /[?&]sslmode=disable/i.test(rawConnectionString);

  // Managed Postgres (Supabase, etc.) serves TLS with a private-CA certificate.
  // node-postgres treats the URL's `sslmode=require` as verify-full and rejects
  // that cert, overriding the ssl option — so strip sslmode from the URL and
  // accept the cert via `ssl: { rejectUnauthorized: false }` instead. Local/dev
  // connections use no TLS.
  const connectionString = isLocal ? rawConnectionString : stripSslmode(rawConnectionString);
  const ssl = isLocal ? undefined : { rejectUnauthorized: false };
  return pgDrizzle(new Pool({ connectionString, ssl }), { schema });
}

function stripSslmode(cs: string): string {
  try {
    const u = new URL(cs);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return cs.replace(/([?&])sslmode=[^&]*/i, (_m, sep) => (sep === "?" ? "?" : "")).replace(/\?&/, "?").replace(/[?&]$/, "");
  }
}

/**
 * Control-plane connection: identity, organizations/teams, the tenant
 * registry and platform settings (schema.control.ts). Always the same
 * physical database — never resolved per-tenant.
 */
export const controlDb: NodePgDatabase<typeof schema> = await createDb();

// ---------------------------------------------------------------------------
// Per-tenant connections (schema.tenant.ts)
// ---------------------------------------------------------------------------

const tenantDbStorage = new AsyncLocalStorage<NodePgDatabase<typeof schema>>();
const tenantDbCache = new Map<string, NodePgDatabase<typeof schema>>();

/* v8 ignore start -- only reached once a tenant_databases row is "active" (Phase 3) */
export function createTenantDb(connectionString: string): NodePgDatabase<typeof schema> {
  // neon-serverless (websocket Pool) supports real interactive transactions —
  // unlike neon-http (a previous candidate driver, used over plain fetch),
  // which rejects `.transaction()` outright. modelToDb (via seedWorkspace)
  // needs a real transaction, so tenant databases use neon-serverless.
  // Cast: NeonDatabase and NodePgDatabase share the same Drizzle query API; the
  // cast lets callers type against a single db shape (see createDb above).
  return neonDrizzle(new NeonPool({ connectionString }), { schema }) as unknown as NodePgDatabase<typeof schema>;
}
/* v8 ignore stop */

/**
 * Resolves the Drizzle client for `organizationId`'s ArchiMate content.
 *
 * Until Phase 3 provisions a dedicated database (no `tenant_databases` row,
 * or `status !== "active"`), this returns `controlDb` — every organization's
 * data still lives in the single shared database.
 */
export async function getTenantDb(organizationId: string): Promise<NodePgDatabase<typeof schema>> {
  const cached = tenantDbCache.get(organizationId);
  if (cached) return cached;

  const [row] = await controlDb.select().from(schema.tenantDatabases)
    .where(eq(schema.tenantDatabases.organizationId, organizationId));
  if (row?.status !== "active") return controlDb;

  const tenantDb = createTenantDb(decryptConnectionString(row.connectionStringEncrypted));
  tenantDbCache.set(organizationId, tenantDb);
  return tenantDb;
}

/** Runs `fn` with `db` (below) resolving to `tenantDb` for its whole async extent. */
export function runWithTenantDb<T>(tenantDb: NodePgDatabase<typeof schema>, fn: () => T): T {
  return tenantDbStorage.run(tenantDb, fn);
}

/**
 * Tenant-scoped client for the current request, set per-request via
 * `runWithTenantDb` (see apps/api/src/app.ts). Falls back to `controlDb`
 * outside of a request — migrations, scripts — or while the active
 * organization has no dedicated database yet (Phase 3).
 */
export const db: NodePgDatabase<typeof schema> = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, _receiver) {
    const current = tenantDbStorage.getStore() ?? controlDb;
    const value = Reflect.get(current, prop, current);
    return typeof value === "function" ? value.bind(current) : value;
  },
});
