#!/usr/bin/env bash
# webServer.command for playwright.config.ts.
#
# Not a Playwright globalSetup script: in the installed Playwright version,
# the webServer plugin's own setup task runs *before* the user's
# globalSetup task (see playwright/lib/runner/index.js's
# createGlobalSetupTasks — plugin setup tasks are unshifted ahead of
# globalSetups), so a globalSetup that starts Postgres never gets a chance
# to run before webServer's health-check starts polling — the whole run
# just times out. Doing the Postgres startup *inside* the webServer command
# itself sidesteps that ordering entirely.
#
# Not `pnpm start`: it sources ../../.env when present (see package.json),
# which would silently override DATABASE_URL below with a developer's own
# dev Postgres — this suite must never read or write that database.
#
# Not `pnpm infra:up:db` / DB_CLIENT=pglite either — see comments in
# playwright.config.ts for why (shared dev Postgres volume vs. Next.js
# production builds instantiating a separate in-memory PGlite per route
# bundle).
set -euo pipefail
# Job control: `next start` spawns its own child "next-server" process, so
# the background job's PID ($!) only ever refers to the `next` CLI
# supervisor — killing just that PID leaves next-server running. With job
# control on, the backgrounded job gets its own process group (id == its
# PID), so `kill -- -$NEXT_PID` below reaches next-server too.
set -m

CONTAINER="archispark-e2e-postgres"
PORT=5433

cleanup() {
  [[ -n "${NEXT_PID:-}" ]] && kill -- "-$NEXT_PID" 2>/dev/null || true
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --rm --name "$CONTAINER" -p "$PORT:5432" \
  -e POSTGRES_USER=archispark \
  -e POSTGRES_PASSWORD=archispark \
  -e POSTGRES_DB=archispark \
  postgres:17-alpine >/dev/null

until docker exec "$CONTAINER" pg_isready -U archispark >/dev/null 2>&1; do
  sleep 0.5
done

export DATABASE_URL="postgres://archispark:archispark@localhost:${PORT}/archispark"
export LOCAL_AUTH_JWT_SECRET="e2e-only-secret-not-for-production-use-32chars"
export KEYCLOAK_SSO_ENABLED=false
export ARCHISPARK_URL="http://localhost:8000"

# Migrates and seeds the extra "regular user" account (see e2e/seed.ts)
# before Next.js's own instrumentation.ts re-runs (idempotent) migrations
# at boot — done here rather than left to instrumentation.ts alone so the
# account exists before the health check (and first test) can pass.
./node_modules/.bin/tsx e2e/seed.ts

./node_modules/.bin/next start --hostname 0.0.0.0 --port 8000 &
NEXT_PID=$!
wait "$NEXT_PID"
