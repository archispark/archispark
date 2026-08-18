/**
 * Runs once per server instance (Next.js `register()` hook) — on `next dev`,
 * `next start` (self-hosted), and Vercel cold starts alike.
 *
 * Migrations are never applied automatically here. Run them explicitly:
 * `pnpm migrate` (local dev, or anywhere `DATABASE_URL`/`NEO4J_URI` are
 * directly reachable) or `docker compose run --rm migrate` (self-hosted, see
 * deployment.md). On the `archispark` Vercel project, the canonical trigger
 * is `.github/workflows/migrate-prod.yml`, which applies pending migrations
 * from a plain CI job on every push to `main` touching a migration path.
 *
 * Guarded to the Node.js runtime: this app also has an Edge middleware
 * (`proxy.ts`), and `register()` runs once per runtime present in the app.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // ./env validates process.env as an import side effect (see next.config.ts)
    // and throws on a malformed value — re-imported here (Node module cache
    // dedups it) so a serverless cold start that skips next.config.ts's
    // module-level code still fails fast instead of surfacing later.
    await import("./env")
  }
}
