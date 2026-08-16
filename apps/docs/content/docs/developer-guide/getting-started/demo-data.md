---
title: Demo Seed
description: Create demo Keycloak accounts and sample ArchiMate workspaces.
---

## Minimal seed

For a fresh install with just a working login — no sample organizations,
workspaces, or ArchiMate data:

| Method                 | Auth method                                                                              | Account                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Automatic (no command) | [Local account](../reference/authentication.mdx#local-accounts) — no Keycloak required   | `admin` / `admin`, created by migration `0025_seed_local_admin.sql` the first time it runs on an empty `users` table — forced password change at first login |
| `pnpm seed:minimal`    | [Keycloak](../reference/authentication.mdx#keycloak-login) (`KEYCLOAK_SSO_ENABLED=true`) | `admin` / `admin` (`.docker/keycloak/minimal-users.json`, Keycloak `platform_admin` role) — provisions the realm first (`pnpm seed:keycloak`)                |

`pnpm seed:local-admin` re-runs the same local account creation on demand
(`.docker/local-auth/admin-user.json`) — use it to recover a locked-out
`admin` account, or after `pnpm db:reset` (which wipes the `users` table, so
the migration-driven seed above won't fire again — it only runs once, the
first time migration `0025` itself applies).

Either way, no organization or workspace is created: signing in and creating
the first workspace automatically creates a personal organization for that
user (see
[Organizations and roles](../reference/authentication.mdx#organizations-and-roles)).

## Demo seed

Three sample ArchiMate models are available for demo or local testing:

| Model        | Elements | Relationships | Views |
| ------------ | -------- | ------------- | ----- |
| ArchiMetal   | 294      | 476           | 33    |
| ArchiSurance | 257      | 402           | 40    |
| Open Day     | 27       | 37            | 4     |

The workspaces are grouped into two demo organizations
(`packages/db/seeds/demo-orgs.json`), deliberately isolated from each other
(no shared members):

| Organization | Workspaces               | Account   | Role                                                                                                                                                                                  |
| ------------ | ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archi        | ArchiSurance, ArchiMetal | `archi`   | `owner`                                                                                                                                                                               |
| Archi        | ArchiSurance, ArchiMetal | `contrib` | `editor`                                                                                                                                                                              |
| Archi        | ArchiSurance, ArchiMetal | `user`    | `viewer`                                                                                                                                                                              |
| Open         | Open Day                 | `open`    | `owner`                                                                                                                                                                               |
| _(none)_     | —                        | `admin`   | Admin (Keycloak `platform_admin`) — deliberately a member of neither; admin mode defaults to the smallest existing organization, and can switch to any organization's content instead |

- **Membership is authoritative on every reseed**: narrowing an
  organization's `members` in `demo-orgs.json` removes any now-unlisted
  `organization_members` row on the next `pnpm seed:demo` run rather than
  leaving it behind (see `removeStaleMembers` in `seed-demo.ts`) — this is
  how `archi`/`user`/`contrib` lost access to Open when it was split off
  into its own, single-owner organization.
- The seed is **idempotent** — re-running it replaces the matching
  workspace's content.

```bash
# First-time setup: create the demo accounts, then load the demo data.
pnpm seed:local-demo-users   # sources .env.dev automatically — local accounts (default)
pnpm seed:demo               # sources .env.dev automatically
```

**`pnpm seed:local-demo-users`** creates/updates the 5 local demo accounts
(`admin`/`user`/`contrib`/`archi`/`open`, passwords match usernames, see
`packages/db/seeds/local-demo-users.json`) directly in the `users` table —
requires `DATABASE_URL`. This is the default path
(`KEYCLOAK_SSO_ENABLED` unset/`false`, see
[Local accounts](../reference/authentication.mdx#local-accounts)). With
Keycloak SSO enabled instead, use **`pnpm seed:demo-users`**, which
creates/updates the same 5 accounts (`.docker/keycloak/demo-users.json`)
via the Keycloak Admin API — requires `KEYCLOAK_URL`, `KEYCLOAK_REALM`,
`KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET`.

**`pnpm seed:demo`** seeds the two demo organizations, their memberships,
and the ArchiMate demo data (ArchiMetal/ArchiSurance/Open Day) — requires
`DATABASE_URL` and resolves `archi`/`user`/`contrib`/`open`'s user id from
either the local `users` table or Keycloak, depending on
`KEYCLOAK_SSO_ENABLED` (run the matching `seed:local-demo-users` or
`seed:demo-users` first). `packages/db/seeds/demo.sql` itself is a
template — its
`__ARCHISURANCE_ORGANIZATION_ID__`/`__ARCHIMETAL_ORGANIZATION_ID__`/`__OPENDAY_ORGANIZATION_ID__`/`__CREATED_BY_ID__`
placeholders are only substituted by `seed-demo.ts`, so run it via `pnpm
seed:demo` rather than `psql -f` directly.

To fully reset and reload the demo data locally (the same behavior as the
Vercel cron job below), run:

```bash
pnpm db:reset-demo
```

`pnpm db:reset-demo`:

1. Removes all ArchiSpark PostgreSQL and Neo4j data — schema and migration
   history preserved (same as `pnpm reset`).
2. Creates or updates the demo accounts (local or Keycloak, depending on
   `KEYCLOAK_SSO_ENABLED`).
3. Re-seeds the demo organizations, workspaces, and dashboards.
4. Exports every workspace to Neo4j.

This is a full wipe, not scoped to the 3 demo workspaces: any other
organization or workspace in the same database is removed too.

## Restore demo data on Vercel (Cron Job)

A Vercel Cron Job (`GET /api/cron/reset-demo`, configured in
`apps/server/vercel.json`) resets the demo Vercel/Neon project once a day
(`0 3 * * *`) — the same full fresh-reinstall-style wipe and reseed as
`pnpm db:reset-demo` above, using **local accounts, not Keycloak**
(demo.archispark.cloud runs with `KEYCLOAK_SSO_ENABLED` unset). Every
application table and the whole Neo4j graph are wiped (schema/migration
history preserved) before reseeding — **not** a scoped delete of just the 3
demo workspaces: any account, organization, or workspace a visitor created
since the last reset is removed too. That's expected on a public demo where
visitors can perform uncontrolled operations. It replaces the previous
manual **Actions → Restore demo data** GitHub workflow.

**Required Vercel environment variables** (demo project only — never set on
any other deployment of this codebase, since `apps/server/vercel.json`'s
`crons` entry is committed and therefore inherited by any fork):

- `CRON_SECRET` — Vercel automatically attaches `Authorization: Bearer
  $CRON_SECRET` to its own cron invocations once this is set on the
  project.
- `DEMO_RESET_ENABLED=true` — a second, independent gate; the route returns
  404 even with a valid `CRON_SECRET` when this isn't set.

Trigger a run manually with `vercel crons run /api/cron/reset-demo`
(Vercel CLI) or by sending the route a request with the correct
`Authorization` header.

### Retiring/renaming a demo organization slug

`packages/db/seeds/demo-orgs.json` upserts organizations by `slug`. Because the reset step above deletes workspaces **by name only** (not scoped to an organization), renaming a demo org's slug (as happened for `archisurance`/`archimetal` → `archi`/`open`) can leave the old, now-empty organization behind — and if a demo user's `user_active_organization` still points at it, they'll see "no workspace" even though their data moved to the new organization.

`seed-demo.ts` self-heals this: `demo-orgs.json`'s `legacySlugs` array lists retired slugs, and every run deletes any organization matching one of those slugs **provided it now holds zero workspaces** — this also cascades away any stale `user_active_organization` row, so the affected user's active org automatically resolves to a valid one on their next request. **When retiring or renaming an org's slug, add the old slug to `legacySlugs` in the same change.**
