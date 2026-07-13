/**
 * Demo seed script — loads the ArchiSurance, ArchiMetal and Open Day
 * workspaces into the DB, grouped into demo organizations
 * (packages/db/seeds/demo-orgs.json): "Archi" (ArchiSurance + ArchiMetal)
 * and "Open" (Open Day). Owned by the "archi" demo user with
 * "user"/"contrib" as admin/member (swapped between the two organizations,
 * to demonstrate that roles are per-organization).
 * "admin" (the platform_admin demo account) is deliberately never a member
 * of either organization — demonstrates platform/organization isolation
 * from the demo itself.
 *
 * Usage:
 *   pnpm --filter @workspace/db seed:demo
 *
 * Requires:
 *   DATABASE_URL — the shared database (organizations, workspaces, elements, …)
 *   KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_ADMIN_CLIENT_ID,
 *   KEYCLOAK_ADMIN_CLIENT_SECRET — used to look up the demo users' Keycloak
 *                                  subs (run seed:demo-users first)
 *
 * Destructive reset: deletes existing ArchiSurance/ArchiMetal/Open Day
 * workspaces (CASCADE) then reimports from the generated SQL. Safe to run
 * multiple times.
 */

import { readFileSync } from "fs"
import { resolve } from "path"
import pg from "pg"
import { findUserByUsername } from "@workspace/auth"

interface DemoOrg {
  slug: string
  name: string
  workspaces: string[]
  members: Record<string, string>
}

function organizationIdPlaceholder(workspace: string): string {
  return `__${workspace.toUpperCase().replace(/[^A-Z0-9]/g, "")}_ORGANIZATION_ID__`
}

const SQL_PATH = resolve(import.meta.dirname, "../seeds/demo.sql")
const sqlTemplate = readFileSync(SQL_PATH, "utf-8")

const ORGS_PATH = resolve(import.meta.dirname, "../seeds/demo-orgs.json")
const demoOrgs: DemoOrg[] = JSON.parse(
  readFileSync(ORGS_PATH, "utf-8")
).organizations

const dbUrl = process.env["DATABASE_URL"]
if (!dbUrl) {
  console.error("Error: DATABASE_URL is required.")
  process.exit(1)
}

const isLocal = (url: string) =>
  /@(localhost|127\.0\.0\.1|\[::1\]|postgres)[:/]/.test(url)

function stripSslmode(cs: string): string {
  try {
    const u = new URL(cs)
    u.searchParams.delete("sslmode")
    return u.toString()
  } catch {
    return cs
  }
}

function makeClient(url: string): pg.Client {
  const local = isLocal(url)
  return new pg.Client({
    connectionString: local ? url : stripSslmode(url),
    ssl: local ? undefined : { rejectUnauthorized: false },
  })
}

async function getOrCreateOrganization(
  client: pg.Client,
  slug: string,
  name: string
): Promise<number> {
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO organizations (slug, name, is_personal, enabled)
     VALUES ($1, $2, false, true)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [slug, name]
  )
  return rows[0]!.id
}

async function upsertMember(
  client: pg.Client,
  organizationId: number,
  userId: string,
  role: string
): Promise<void> {
  await client.query(
    `INSERT INTO organization_members (organization_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [organizationId, userId, role]
  )
}

// ── 1. Resolve demo users' Keycloak subs ────────────────────────────────────

const usernames = new Set(demoOrgs.flatMap((org) => Object.keys(org.members)))
const userIds = new Map<string, string>()
for (const username of usernames) {
  const user = await findUserByUsername(username)
  if (!user?.id) {
    console.error(
      `Error: demo user "${username}" not found in Keycloak. Run \`pnpm --filter @workspace/db seed:demo-users\` first.`
    )
    process.exit(1)
  }
  userIds.set(username, user.id)
  console.log(`Resolved user: ${user.id} (${username})`)
}
const archiId = userIds.get("archi")!

// ── 2. Create organizations + memberships ───────────────────────────────────

const client = makeClient(dbUrl)
await client.connect()

const orgIdByWorkspace = new Map<string, number>()
for (const org of demoOrgs) {
  const orgId = await getOrCreateOrganization(client, org.slug, org.name)
  for (const workspace of org.workspaces) {
    orgIdByWorkspace.set(workspace, orgId)
  }
  for (const [username, role] of Object.entries(org.members)) {
    await upsertMember(client, orgId, userIds.get(username)!, role)
  }
  console.log(
    `Organization "${org.name}" (id=${orgId}): ${org.workspaces.length} workspace(s), ${Object.keys(org.members).length} member(s).`
  )
}

// ── 3. Seed the workspaces (elements, views) into their organization ───────

let sql = sqlTemplate.replaceAll("'__CREATED_BY_ID__'", `'${archiId}'`)
for (const [workspace, orgId] of orgIdByWorkspace) {
  sql = sql.replaceAll(organizationIdPlaceholder(workspace), String(orgId))
}

console.log("Seeding workspaces (elements, views)…")
await client.query(sql)
await client.end()

console.log("Done.")
