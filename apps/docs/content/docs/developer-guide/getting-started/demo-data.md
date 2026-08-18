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
`admin` account, or after `pnpm --filter @workspace/db reset` (which wipes
the `users` table, so the migration-driven seed above won't fire again — it
only runs once, the first time migration `0025` itself applies).

Either way, no organization or workspace is created: signing in lands on the
starter home page with no organization until an owner, editor, or an Admin
adding itself from `/platform/organizations/:id` grants that account
membership (see
[Organizations and roles](../reference/authentication.mdx#organizations-and-roles)).

## Demo seed

Two sample ArchiMate models are available for demo or local testing:

| Model        | Elements | Relationships | Views |
| ------------ | -------- | ------------- | ----- |
| ArchiMetal   | 294      | 476           | 33    |
| ArchiSurance | 257      | 402           | 40    |

The workspaces are grouped into a single demo organization
(`packages/db/seeds/demo-orgs.json`):

| Organization | Workspaces               | Account   | Role                                                                                                                                                                     |
| ------------ | ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archi        | ArchiSurance, ArchiMetal | `archi`   | `owner`                                                                                                                                                                  |
| Archi        | ArchiSurance, ArchiMetal | `contrib` | `editor`                                                                                                                                                                 |
| Archi        | ArchiSurance, ArchiMetal | `user`    | `viewer`                                                                                                                                                                 |
| _(none)_     | —                        | `admin`   | Admin (Keycloak `platform_admin`) — deliberately not a member; can add itself from `/platform/organizations/:id`'s member management, like any other user               |

- **Membership is authoritative on every reseed**: narrowing an
  organization's `members` in `demo-orgs.json` removes any now-unlisted
  `organization_members` row on the next `pnpm seed:demo` run rather than
  leaving it behind (see `removeStaleMembers` in `seed-demo.ts`).
- The seed is **idempotent** — re-running it replaces the matching
  workspace's content.

```bash
# First-time setup: create the demo accounts, then load the demo data.
pnpm seed:local-demo-users   # sources .env.dev automatically — local accounts (default)
pnpm seed:demo               # sources .env.dev automatically
```

**`pnpm seed:local-demo-users`** creates/updates the 4 local demo accounts
(`admin`/`user`/`contrib`/`archi`, passwords match usernames, see
`packages/db/seeds/local-demo-users.json`) directly in the `users` table —
requires `DATABASE_URL`. This is the default path
(`KEYCLOAK_SSO_ENABLED` unset/`false`, see
[Local accounts](../reference/authentication.mdx#local-accounts)). With
Keycloak SSO enabled instead, use **`pnpm seed:demo-users`**, which
creates/updates the same 4 accounts (`.docker/keycloak/demo-users.json`)
via the Keycloak Admin API — requires `KEYCLOAK_URL`, `KEYCLOAK_REALM`,
`KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET`.

**`pnpm seed:demo`** seeds the demo organization, its memberships, and the
ArchiMate demo data (ArchiMetal/ArchiSurance) — requires `DATABASE_URL` and
resolves `archi`/`user`/`contrib`'s user id from either the local `users`
table or Keycloak, depending on `KEYCLOAK_SSO_ENABLED` (run the matching
`seed:local-demo-users` or `seed:demo-users` first).
`packages/db/seeds/demo.sql` itself is a template — its
`__ARCHISURANCE_ORGANIZATION_ID__`/`__ARCHIMETAL_ORGANIZATION_ID__`/`__CREATED_BY_ID__`
placeholders are only substituted by `seed-demo.ts`, so run it via `pnpm
seed:demo` rather than `psql -f` directly.

To fully reset and reload the demo data locally (the same behavior as the
`seed-demo.yml` GitHub Actions workflow below), run each step manually —
there is no single composite command, on purpose:

```bash
pnpm --filter @workspace/db reset       # wipe PostgreSQL app data (schema/migration history preserved)
pnpm --filter @workspace/db-neo4j reset # wipe the Neo4j graph
pnpm run db:migrate                     # reapply/backfill migrations
pnpm run seed                           # recreate the demo accounts, organizations and workspaces
pnpm run import:workspaces              # export every workspace to Neo4j
```

This is a full wipe, not scoped to the 2 demo workspaces: any other
organization or workspace in the same database is removed too.

System dashboards are global rows (`dashboards.workspaceId IS NULL`),
seeded only once by migration `0032_dashboard_system_seed.sql` — there is
no seed script or reseed path. `pnpm --filter @workspace/db reset` preserves
Drizzle's migration history, so this wipe removes them and they are **not**
restored by the `pnpm run db:migrate` step above.

## Restore demo data (GitHub Actions)

`.github/workflows/seed-demo.yml` ("Restore demo data") resets
`demo.archispark.cloud`'s Neon database once a day (`0 3 * * *`) and can
also be triggered manually from **Actions → Restore demo data → Run
workflow**, or with `gh workflow run seed-demo.yml`. It runs the same full
fresh-reinstall-style wipe and reseed as the manual sequence above (same
caveat on system dashboards not being restored), using **local accounts,
not Keycloak** (demo.archispark.cloud runs with `KEYCLOAK_SSO_ENABLED`
unset — the workflow's runner has it unset too, so `pnpm run seed` resolves
to the same local-accounts path automatically). Every application table is
wiped (schema/migration history preserved) before reseeding — **not** a
scoped delete of just the 2 demo workspaces: any account, organization, or
workspace a visitor created since the last reset is removed too. That's
expected on a public demo where visitors can perform uncontrolled
operations.

It does not touch Neo4j — the Neo4j export feature isn't enabled on the
demo Vercel project, so the workflow only resets and reseeds PostgreSQL. It
reuses the same `DATABASE_URL_UNPOOLED` repository secret as
`migrate-prod.yml`; no additional secret or Vercel environment variable is
needed.

### Retiring/renaming a demo organization slug

`packages/db/seeds/demo-orgs.json` upserts organizations by `slug`. Because the reset step above deletes workspaces **by name only** (not scoped to an organization), renaming a demo org's slug (as happened for `archisurance`/`archimetal` → `archi`/`open`) can leave the old, now-empty organization behind — and if a demo user's `user_active_organization` still points at it, they'll see "no workspace" even though their data moved to the new organization.

`seed-demo.ts` self-heals this: `demo-orgs.json`'s `legacySlugs` array lists retired slugs, and every run deletes any organization matching one of those slugs **provided it now holds zero workspaces** — this also cascades away any stale `user_active_organization` row, so the affected user's active org automatically resolves to a valid one on their next request. **When retiring or renaming an org's slug, add the old slug to `legacySlugs` in the same change.**
