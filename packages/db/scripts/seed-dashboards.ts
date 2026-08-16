/**
 * Seeds the default dashboards for every workspace. Dashboards are
 * intentionally workspace-scoped: two workspaces in the same organization
 * receive independent copies and revision histories. Reusable core in
 * `../src/seed-dashboards-data.ts` (also used by `seed-demo.ts` and the
 * demo reset cron).
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:dashboards
 *
 * Requires DATABASE_URL.
 */

import "@workspace/env/register"
import { seedDashboardsForAllWorkspaces } from "../src/seed-dashboards-data.js"

const { seededRevisions, workspaces } = await seedDashboardsForAllWorkspaces()
console.log(
  `Seeded ${seededRevisions} dashboard revision(s) into ${workspaces} workspace(s).`
)
process.exit(0)
