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
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations, runOrganizationBackfill } =
      await import("@workspace/db")
    await runMigrations()
    await runOrganizationBackfill()
  }
}
