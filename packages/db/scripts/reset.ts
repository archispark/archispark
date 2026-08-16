/**
 * Remove all ArchiSpark application data while preserving PostgreSQL schema
 * and Drizzle migration history. Keycloak uses a separate database and is
 * not touched. Reusable core in `../src/reset-application-data.ts` (also
 * used by the demo reset cron).
 *
 * Usage:
 *   DATABASE_URL=<url> pnpm --filter @workspace/db reset
 */

import "@workspace/env/register"
import { truncateApplicationTables } from "../src/reset-application-data.js"

const { tables } = await truncateApplicationTables()
console.log(
  tables === 0
    ? "No application tables to reset."
    : `Reset ${tables} application table(s).`
)
process.exit(0)
