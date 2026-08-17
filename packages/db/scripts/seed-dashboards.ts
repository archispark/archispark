/**
 * Seeds (or resyncs) the fixed set of system dashboards, shared by every
 * workspace (`dashboards.workspaceId IS NULL`). Reusable core in
 * `../src/seed-dashboards-data.ts` (also used by `seed-demo.ts` and the
 * demo reset cron).
 *
 * System dashboards are seeded once, at deploy time, by migration
 * `0032_dashboard_system_seed.sql`. This script is a manual repair tool:
 * rerun it if `seeds/dashboards.sql` changes without a dedicated backfill
 * migration, to resync the already-deployed system dashboards.
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:dashboards
 *
 * Requires DATABASE_URL.
 */

import "@workspace/env/register"
import { seedSystemDashboards } from "../src/seed-dashboards-data.js"

const { seededDashboards, seededRevisions } = await seedSystemDashboards()
console.log(
  `Seeded ${seededRevisions} revision(s) across ${seededDashboards} system dashboard(s).`
)
process.exit(0)
