/**
 * Seeds the singleton `site_settings` row (login page message) for the
 * public demo — see `scripts/seed-demo.ts`. `site_settings` is an
 * application table like any other, so `truncateApplicationTables`
 * (the demo reset flow) wipes it on every run; this restores it the same
 * way `reseedSystemDashboards` restores system dashboards.
 */

import { sql } from "drizzle-orm"
import { db as defaultDb } from "./connection.js"
import { siteSettings } from "./schema.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

const DEMO_LOGIN_MESSAGE = `Platform : admin / admin
Owner : archi / archi
Editor : contrib / contrib
Viewer : user / user`

export async function seedDemoLoginMessage(
  database: Db = defaultDb
): Promise<void> {
  await database
    .insert(siteSettings)
    .values({
      id: 1,
      loginMessage: DEMO_LOGIN_MESSAGE,
      loginMessageEnabled: true,
      updatedAt: sql`extract(epoch from now())::int`,
    })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: {
        loginMessage: DEMO_LOGIN_MESSAGE,
        loginMessageEnabled: true,
        updatedAt: sql`extract(epoch from now())::int`,
      },
    })
}
