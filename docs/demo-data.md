# Demo seed

Three sample ArchiMate models are available for demo or local testing: **ArchiMetal** (294 elements, 476 relationships, 33 views), **ArchiSurance** (257 elements, 402 relationships, 40 views), and **Open Day** (27 elements, 37 relationships, 4 views).

The workspaces are grouped into two demo organizations (`packages/db/seeds/demo-orgs.json`): **Archi** (ArchiSurance + ArchiMetal) and **Open** (Open Day). Within each organization, `archi` is `owner`, `user`/`contrib` hold swapped `admin`/`member` roles between the two organizations — demonstrating that roles are per-organization. The `admin` demo account (`platform_admin`) is deliberately a member of neither, demonstrating platform/organization isolation from the demo itself.

The seed is **idempotent** — re-running it replaces the matching workspace's content.

```bash
# First-time setup: create the demo Keycloak accounts, then load the demo data.
pnpm seed:demo-users   # equivalent to `make seed-demo-users`
pnpm seed:demo         # equivalent to `make seed-demo`
```

**`pnpm seed:demo-users`** creates/updates the 4 Keycloak demo accounts
(`admin`/`user`/`contrib`/`archi`, passwords match usernames, see
`.docker/keycloak/demo-users.json`) via the Keycloak Admin API — requires
`KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ADMIN_CLIENT_ID`,
`KEYCLOAK_ADMIN_CLIENT_SECRET`.

**`pnpm seed:demo`** seeds the two demo organizations, their memberships,
and the ArchiMate demo data (ArchiMetal/ArchiSurance/Open Day) — requires
`DATABASE_URL` and looks up `archi`/`user`/`contrib`'s Keycloak `sub`s
(same Keycloak env vars as above; run `seed:demo-users` first).
`packages/db/seeds/demo.sql` itself is a template — its
`__ARCHISURANCE_ORGANIZATION_ID__`/`__ARCHIMETAL_ORGANIZATION_ID__`/`__OPENDAY_ORGANIZATION_ID__`/`__CREATED_BY_ID__`
placeholders are only substituted by `seed-demo.ts`, so run it via `pnpm
seed:demo` rather than `psql -f` directly.

## Restore demo data on Vercel (GitHub Actions)

The workflow **Actions → Restore demo data** can be triggered manually from GitHub to reset the Vercel Postgres database to the demo state.

**Required GitHub secrets** — add `DATABASE_URL_UNPOOLED` (Neon direct URL), and `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET` (Keycloak Admin API access) to the repository secrets (Settings → Secrets and variables → Actions). Copy the values from the Vercel project environment variables.

The workflow offers a **reset** checkbox (on by default): when checked it deletes the existing ArchiMetal, ArchiSurance and Open Day workspaces (all child data is removed via CASCADE) before re-seeding. Uncheck it to seed only if those workspaces do not yet exist.

> Note: `packages/db/seeds/demo-orgs.json` upserts organizations by `slug`. If an environment was seeded before the `archisurance`/`archimetal` → `archi`/`open` slug rename, that reset only removes the named *workspaces* — it leaves the old, now-empty `archisurance`/`archimetal` organizations behind. Clean those up manually (`DELETE FROM organizations WHERE slug IN ('archisurance', 'archimetal');`, cascades to memberships) after confirming they hold no other data.
