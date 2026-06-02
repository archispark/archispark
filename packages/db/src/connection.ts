import { Pool } from "pg";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

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
  // container) → default dev connection. Serverless functions must use the
  // pooled connection: the direct host is IPv6-only and unreachable from Lambdas.
  const connectionString =
    process.env["DATABASE_URL"] ??
    process.env["POSTGRES_URL"] ??
    process.env["POSTGRES_URL_NON_POOLING"] ??
    "postgresql://archispark:archispark@localhost:5432/archispark";
  // Supabase poolers require TLS; allow the self-signed pooler cert.
  const ssl = /supabase\.(co|com|net)/.test(connectionString) ? { rejectUnauthorized: false } : undefined;
  return pgDrizzle(new Pool({ connectionString, ssl }), { schema });
}

export const db: NodePgDatabase<typeof schema> = await createDb();
