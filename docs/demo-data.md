# Demo seed

Two sample ArchiMate models are available for demo or local testing: **ArchiMetal** (294 elements, 476 relationships, 33 views) and **ArchiSurance** (257 elements, 402 relationships, 40 views).

Each model is seeded into its own demo organization (`ArchiMetal` / `ArchiSurance`). Every existing user is added as a member of both (`owner` if their platform role is `admin`, `member` otherwise) with that organization's workspace set as their active workspace.

The seed is **idempotent** — re-running it upserts the demo organizations/memberships and replaces the matching workspace's content.

```bash
# Runs seed:demo-users then seed:demo (equivalent to `make dev-seed-demo`).
pnpm seed:demo
```

`pnpm seed:demo` first runs **`pnpm seed:demo-users`**, which creates/updates
the 4 Keycloak demo accounts (`admin`/`user`/`contrib`/`archi`, passwords
match usernames, see `.docker/keycloak/demo-users.json`) via the Keycloak
Admin API — requires `KEYCLOAK_URL`, `KEYCLOAK_REALM`,
`KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET`. It then runs
**`pnpm --filter @workspace/db seed:demo`**, which seeds the ArchiMate demo
data — requires `TENANT_DATABASE_URL` (tenant DB) and looks up the `Default`
organization via the Phasetwo Orgs API (same Keycloak env vars).

```bash
# Equivalent alternatives:
pnpm --filter @workspace/db seed:demo-users   # Keycloak demo accounts only
pnpm --filter @workspace/db seed:demo         # ArchiMate demo data only
psql $DATABASE_URL -f packages/db/seeds/demo.sql
```

## Restore demo data on Vercel (GitHub Actions)

The workflow **Actions → Restore demo data** can be triggered manually from GitHub to reset the Vercel Postgres database to the demo state.

**Required GitHub secrets** — add `TENANT_DATABASE_URL_UNPOOLED` (Neon tenant fallback DB direct URL), and `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET` (Keycloak Phasetwo Orgs API access) to the repository secrets (Settings → Secrets and variables → Actions). Copy the values from the Vercel project environment variables.

The workflow offers a **reset** checkbox (on by default): when checked it deletes the existing ArchiMetal and ArchiSurance workspaces (all child data is removed via CASCADE) before re-seeding. Uncheck it to seed only if those workspaces do not yet exist.
