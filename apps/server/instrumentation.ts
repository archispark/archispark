/**
 * Runs once per server instance (Next.js `register()` hook) — both on
 * `next start` (self-hosted) and on cold start of a Vercel serverless
 * function. Replaces the two separate migration triggers that used to live
 * in `apps/api/src/main.ts` and `apps/api/api/index.ts`.
 *
 * Guarded to the Node.js runtime: this app also has an Edge middleware
 * (`proxy.ts`), and `register()` runs once per runtime present in the app.
 * `@workspace/db` opens a real `pg.Pool` at import time (see
 * `packages/db/src/connection.ts`) — importing it from the Edge worker would
 * crash, since `pg` needs Node's `net`/`tls`.
 */
export async function register(): Promise<void> {
  console.info("instrumentation register() invoked", {
    NEXT_RUNTIME: process.env.NEXT_RUNTIME,
  })
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // ./env validates process.env as an import side effect (see next.config.ts)
    // and throws on a malformed value — re-imported here (Node module cache
    // dedups it) so a serverless cold start that skips next.config.ts's
    // module-level code still fails fast instead of surfacing later.
    await import("./env")

    const { runMigrations, runOrganizationBackfill } =
      await import("@workspace/db")
    await runMigrations()
    await runOrganizationBackfill()

    // Unlike Postgres above, a failure here must not block startup: Neo4j is
    // a secondary integration (POST /api/export/neo4j), not the primary
    // store, and getNeo4jConfig() always falls back to a default URI rather
    // than signaling "unconfigured" — so a deployment without Neo4j reachable
    // must still serve requests normally. Set NEO4J_ENABLED=false to skip the
    // attempt entirely instead of relying on the catch below.
    const { isNeo4jEnabled, runNeo4jMigrations } =
      await import("@workspace/db-neo4j")
    if (isNeo4jEnabled()) {
      try {
        await runNeo4jMigrations()
      } catch (err) {
        console.error("Neo4j schema migration failed at startup:", err)
      }
    } else {
      console.info(
        "Neo4j désactivé (NEO4J_ENABLED=false) : migration ignorée au démarrage."
      )
    }
  }
}
