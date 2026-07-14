# Demo seed

Three sample ArchiMate models are available for demo or local testing: **ArchiMetal** (294 elements, 476 relationships, 33 views), **ArchiSurance** (257 elements, 402 relationships, 40 views), and **Open Day** (27 elements, 37 relationships, 4 views).

The workspaces are grouped into two demo organizations (`packages/db/seeds/demo-orgs.json`): **Archi** (ArchiSurance + ArchiMetal) and **Open** (Open Day). The two organizations are deliberately isolated from each other — no shared members: within Archi, `archi` is `owner`, `contrib` is `admin`, `user` is `member`; within Open, `open` is the sole `owner`. The `admin` demo account (`platform_admin`) is deliberately a member of neither, demonstrating platform/organization isolation from the demo itself.

Membership is authoritative on every reseed: narrowing an organization's `members` in `demo-orgs.json` removes any now-unlisted `organization_members` row on the next `pnpm seed:demo` run rather than leaving it behind (see `removeStaleMembers` in `seed-demo.ts`) — this is how `archi`/`user`/`contrib` lost access to Open when it was split off into its own, single-owner organization.

The seed is **idempotent** — re-running it replaces the matching workspace's content.

```bash
# First-time setup: create the demo Keycloak accounts, then load the demo data.
pnpm seed:demo-users   # equivalent to `make seed-demo-users`
pnpm seed:demo         # equivalent to `make seed-demo`
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

## Restore demo data on Vercel (GitHub Actions)

The workflow **Actions → Restore demo data** can be triggered manually from GitHub to reset the Vercel Postgres database to the demo state.

**Required GitHub secrets** — add `DATABASE_URL_UNPOOLED` (Neon direct URL), and `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET` (Keycloak Admin API access) to the repository secrets (Settings → Secrets and variables → Actions). Copy the values from the Vercel project environment variables.

The workflow offers a **reset** checkbox (on by default): when checked it deletes the existing ArchiMetal, ArchiSurance and Open Day workspaces (all child data is removed via CASCADE) before re-seeding. Uncheck it to seed only if those workspaces do not yet exist.

The workflow runs `seed:demo-users` (creates/updates the 5 Keycloak demo accounts on the target realm) before `seed:demo` — so adding a new demo account (like `open`) to `.docker/keycloak/demo-users.json` needs no manual Keycloak step on the Vercel/remote side; the next workflow run provisions it automatically.

### Retiring/renaming a demo organization slug

`packages/db/seeds/demo-orgs.json` upserts organizations by `slug`. Because the reset step above deletes workspaces **by name only** (not scoped to an organization), renaming a demo org's slug (as happened for `archisurance`/`archimetal` → `archi`/`open`) can leave the old, now-empty organization behind — and if a demo user's `user_active_organization` still points at it, they'll see "no workspace" even though their data moved to the new organization (see [decisions.md](decisions.md#2026-07-13--nettoyage-auto-cicatrisant-des-organisations-démo-retirées)).

`seed-demo.ts` self-heals this: `demo-orgs.json`'s `legacySlugs` array lists retired slugs, and every run deletes any organization matching one of those slugs **provided it now holds zero workspaces** — this also cascades away any stale `user_active_organization` row, so the affected user's active org automatically resolves to a valid one on their next request. **When retiring or renaming an org's slug, add the old slug to `legacySlugs` in the same change.**
