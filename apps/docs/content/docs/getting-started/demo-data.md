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

| Organization | Workspaces               | Account   | Role                                                                                                                                     |
| ------------ | ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Archi        | ArchiSurance, ArchiMetal | `archi`   | `owner`                                                                                                                                  |
| Archi        | ArchiSurance, ArchiMetal | `contrib` | `editor`                                                                                                                                 |
| Archi        | ArchiSurance, ArchiMetal | `user`    | `viewer`                                                                                                                                 |
| Open         | Open Day                 | `open`    | `owner`                                                                                                                                  |
| _(none)_     | —                        | `admin`   | Admin (Keycloak `platform_admin`) — deliberately a member of neither, but can reach either organization's content via admin mode instead |

- **Membership is authoritative on every reseed**: narrowing an
  organization's `members` in `demo-orgs.json` removes any now-unlisted
  `organization_members` row on the next `pnpm seed:demo` run rather than
  leaving it behind (see `removeStaleMembers` in `seed-demo.ts`) — this is
  how `archi`/`user`/`contrib` lost access to Open when it was split off
  into its own, single-owner organization.
- The seed is **idempotent** — re-running it replaces the matching
  workspace's content.

```bash
# First-time setup: create the demo Keycloak accounts, then load the demo data.
pnpm seed:demo-users   # sources .env.dev automatically
pnpm seed:demo         # sources .env.dev automatically
```

**`pnpm seed:demo-users`** creates/updates the 5 Keycloak demo accounts
(`admin`/`user`/`contrib`/`archi`/`open`, passwords match usernames, see
`.docker/keycloak/demo-users.json`) via the Keycloak Admin API — requires
`KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ADMIN_CLIENT_ID`,
`KEYCLOAK_ADMIN_CLIENT_SECRET`.

**`pnpm seed:demo`** seeds the two demo organizations, their memberships,
and the ArchiMate demo data (ArchiMetal/ArchiSurance/Open Day) — requires
`DATABASE_URL` and looks up `archi`/`user`/`contrib`/`open`'s Keycloak
`sub`s (same Keycloak env vars as above; run `seed:demo-users` first).
`packages/db/seeds/demo.sql` itself is a template — its
`__ARCHISURANCE_ORGANIZATION_ID__`/`__ARCHIMETAL_ORGANIZATION_ID__`/`__OPENDAY_ORGANIZATION_ID__`/`__CREATED_BY_ID__`
placeholders are only substituted by `seed-demo.ts`, so run it via `pnpm
seed:demo` rather than `psql -f` directly.

To reproduce **Actions → Restore demo data** locally, run:

```bash
pnpm reset-demo
```

`pnpm reset-demo`:

1. Applies pending PostgreSQL and Neo4j migrations.
2. Runs the organization backfill.
3. Creates or updates the demo Keycloak accounts.
4. Replaces the three demo workspaces.
5. Exports every workspace to Neo4j.

It deletes only ArchiMetal, ArchiSurance, and Open Day (with their child
rows through PostgreSQL cascades); it does not erase other organizations or
workspaces.

To remove all ArchiSpark PostgreSQL and Neo4j data without loading demo data,
run `pnpm reset`. It preserves database schemas and migration histories, as
well as the separate Keycloak database and its users.

## Restore demo data on Vercel (GitHub Actions)

The workflow **Actions → Restore demo data** can be triggered manually from GitHub to reset the Vercel Postgres database to the demo state.

**Required GitHub secrets** — add `DATABASE_URL_UNPOOLED` (Neon direct URL), and `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET` (Keycloak Admin API access) to the repository secrets (Settings → Secrets and variables → Actions). Copy the values from the Vercel project environment variables.

The workflow offers a **reset** checkbox (on by default): when checked it deletes the existing ArchiMetal, ArchiSurance and Open Day workspaces (all child data is removed via CASCADE) before re-seeding. Uncheck it to seed only if those workspaces do not yet exist.

The workflow runs `seed:demo-users` (creates/updates the 5 Keycloak demo accounts on the target realm) before `seed:demo` — so adding a new demo account (like `open`) to `.docker/keycloak/demo-users.json` needs no manual Keycloak step on the Vercel/remote side; the next workflow run provisions it automatically.

### Retiring/renaming a demo organization slug

`packages/db/seeds/demo-orgs.json` upserts organizations by `slug`. Because the reset step above deletes workspaces **by name only** (not scoped to an organization), renaming a demo org's slug (as happened for `archisurance`/`archimetal` → `archi`/`open`) can leave the old, now-empty organization behind — and if a demo user's `user_active_organization` still points at it, they'll see "no workspace" even though their data moved to the new organization.

`seed-demo.ts` self-heals this: `demo-orgs.json`'s `legacySlugs` array lists retired slugs, and every run deletes any organization matching one of those slugs **provided it now holds zero workspaces** — this also cascades away any stale `user_active_organization` row, so the affected user's active org automatically resolves to a valid one on their next request. **When retiring or renaming an org's slug, add the old slug to `legacySlugs` in the same change.**
