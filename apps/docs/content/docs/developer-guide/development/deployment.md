---
title: Deployment
description: Deploy ArchiSpark with Docker Compose or Vercel.
---

## Organizations migration (releases including `0018_organizations_expand.sql`)

- This release introduces the Organization → Workspace hierarchy via an
  expand→backfill→verify→contract migration (see
  [Architecture](architecture.md#database-schema)).
- Plan a short maintenance window rather than a rolling update for this
  release.
- After deploying, run `pnpm --filter @workspace/db backfill:prod` once
  against the target database (a no-op if already run).
- Verify with the three queries in `plan.md`'s Phase 2 before ever
  generating `0019_organizations_contract.sql` (the `NOT NULL` contract
  migration, intentionally not shipped in this release — see that file for
  the full rationale).

## Neo4j schema migrations (production)

- `packages/db-neo4j` (see [Neo4j export](architecture.md#neo4j-export))
  ships its own versioned Cypher migrations, separate from `packages/db`'s
  Postgres migrations — Neo4j has no `drizzle-kit` equivalent.
- Migrations are never applied automatically by `apps/server` itself, in any
  environment (dev, self-hosted, or Vercel) — see how each environment
  triggers them below and under [Vercel](#vercel) and
  [Self-hosted Docker Compose](#self-hosted-docker-compose).
- Unlike Postgres, a failure here only logs an error and never blocks
  startup: Neo4j is a secondary integration (`POST /api/export/neo4j`), and
  `getNeo4jConfig()` always falls back to a default URI rather than
  signaling "unconfigured", so a deployment without Neo4j reachable must
  still serve requests normally.
- **Idempotent**: already-applied migrations (tracked via
  `:SchemaMigration` nodes) are skipped, so re-running the migration command
  after a deployment that adds a new
  `packages/db-neo4j/src/schema/migrations/*.cypher` file is always safe.

For a manual run against any directly reachable database (local dev, a
dedicated customer database, or Neon's unpooled connection) — same reasoning
as `backfill:prod` below:

```bash
NEO4J_URI=<uri> NEO4J_USER=<user> NEO4J_PASSWORD=<password> \
  pnpm --filter @workspace/db-neo4j migrate:prod
# or, with an env file:
pnpm --filter @workspace/db-neo4j migrate:prod /tmp/neo4j-prod.env
```

`pnpm migrate` (root script) runs this together with the Postgres migration
and backfill in one command. On the `archispark` Vercel project, the
canonical trigger is the `migrate-prod.yml` GitHub Actions workflow (see
[Vercel](#vercel) below), which runs automatically on every push to `main`
that adds a migration file.

## Vercel

A single Vercel project (`archispark`, root directory `apps/server`)
serves the UI, the REST API and the MCP transport — there is no longer a
separate API or MCP-server project. `apps/server/vercel.json` overrides
`buildCommand` to build `@workspace/env`, `@workspace/db`, `@workspace/db-neo4j`,
`@workspace/auth`, and `@workspace/image-library` first (Vercel's zero-config
Next.js detection doesn't build workspace dependencies on its own).

1. **Create the `archispark` project** — import the repo as a Vercel
   project with root directory `apps/server`.

2. **Add Neon** — In Vercel → Storage, add a Neon Postgres database
   (`archispark`), attached to `archispark`. Neon auto-injects
   `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).

3. **Apply database migrations, then the organization backfill** using the
   GitHub Actions workflow **Run production migrations**
   (`migrate-prod.yml`). It reads the `DATABASE_URL_UNPOOLED` repository
   secret, so no Vercel environment export is needed on a developer machine.
   It runs automatically on every push to `main` that touches
   `packages/db/drizzle-pg/**` or `packages/db-neo4j/src/schema/migrations/**`
   (i.e. any merge adding a new migration file), and can also be triggered
   manually (`workflow_dispatch`) for a migration that shipped without
   changing those paths in the same push, or to re-run after a failure.

   For exceptional local recovery only:

```bash
DATABASE_URL="<neon-unpooled>" pnpm --filter @workspace/db migrate:prod
DATABASE_URL="<neon-unpooled>" pnpm --filter @workspace/db backfill:prod
```

`backfill:prod` populates `workspaces.organization_id`/`api_tokens.organization_id`
(left `NULL` by the DDL alone) — required once after any `migrate:prod` run
that includes `0018_organizations_expand.sql` or later; a no-op on a fresh
database, and safe to re-run. `apps/server` never runs it automatically —
`migrate-prod.yml`'s backfill step is what guarantees it always ran before
the first request hits an unbackfilled row. The workflow's Neo4j step (see
[Neo4j schema migrations](#neo4j-schema-migrations-production) above) exists
for the same reason: nothing in `apps/server` applies Neo4j migrations either.

4. **Set environment variables** on `archispark` — `DATABASE_URL`
   (from Neon, above), `KEYCLOAK_URL`, `KEYCLOAK_REALM`,
   `KEYCLOAK_CLIENT_ID_WEB`, `KEYCLOAK_ADMIN_CLIENT_ID`,
   `KEYCLOAK_ADMIN_CLIENT_SECRET`, `ARCHISPARK_URL`, and (only on the pooled
   realm's deployment) `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM`.
   Authentication itself (Keycloak realm, client ids/secrets) is configured
   via the project's Vercel dashboard — see
   [Keycloak login](../reference/authentication.md#keycloak-login). SMTP config is also
   detailed in [E-mail invitations](#e-mail-invitations-smtp).

5. **Redeploy** `archispark`.

6. **(Demo project only) Configure the demo reset cron** — `apps/server/vercel.json`
   declares a Vercel Cron Job at `GET /api/cron/reset-demo`, scheduled
   `0 3 * * *` (once daily — the Hobby plan's cron frequency ceiling). It's
   inert on every deployment by default; only set these two environment
   variables on the actual public demo project (never on a customer
   deployment, since `vercel.json`'s `crons` entry is committed and
   therefore inherited by any fork of this codebase):
   - `CRON_SECRET` — a random secret; Vercel automatically attaches
     `Authorization: Bearer $CRON_SECRET` to its own cron invocations once
     this is set.
   - `DEMO_RESET_ENABLED=true` — a second, independent gate; the route
     returns 404 even with a valid `CRON_SECRET` when this isn't set.

   The reset route requests a **300-second** function duration. Keep Fluid
   Compute enabled (or use a Vercel plan/configuration that permits this
   duration); the default 60-second cap is not enough for the Neo4j rebuild.
   Vercel logs one duration per reset step, so a timeout identifies the last
   completed step.

   The cron does a full fresh-reinstall-style wipe of every application
   table and the whole Neo4j graph (schema/migration history preserved),
   then reseeds the demo accounts (**local accounts, not Keycloak** — no
   `KEYCLOAK_*` variables are needed for this path), organizations,
   workspaces, and dashboards — see
   [Restore demo data on Vercel (Cron Job)](../getting-started/demo-data.md#restore-demo-data-on-vercel-cron-job)
   for the full behavior, including why it's a full wipe rather than a
   scoped delete. It replaces the previous manual **Actions → Restore demo
   data** GitHub workflow (`seed-demo.yml`, removed once the cron has been
   observed to run successfully in production).

## Self-hosted Docker Compose

`.docker/docker-compose.prod.yml` is a self-hosted alternative to Vercel: it
runs the published `archispark/archispark` image (built by
`docker-publish.yml` from `.docker/server/{alpine,trixie-slim}/Dockerfile`)
behind Traefik, alongside Postgres, Neo4j, and Keycloak — the single-service
architecture described in [Vercel](#vercel) above, self-hosted instead of on
Vercel/Neon.

1. **Prepare the environment file** — `cp .env.example .env.prod`, then set
   at minimum `DB_PASSWORD`, `NEO4J_PASSWORD`, `KEYCLOAK_ADMIN`,
   `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_ADMIN_CLIENT_ID`,
   `KEYCLOAK_ADMIN_CLIENT_SECRET`, `ARCHISPARK_DOMAIN`, and
   `KEYCLOAK_DOMAIN` (the two domains only used by Traefik's Docker labels
   — `ARCHISPARK_URL`/`KEYCLOAK_URL` remain the full URLs used by the
   application itself). `ARCHISPARK_OS` (`alpine` or `trixie-slim`) and
   `ARCHISPARK_VERSION` select which published image tag to run.

2. **Start the stack** — `pnpm run prod:up` (stop with `pnpm run
   prod:down`). Postgres and Neo4j publish no host port; only Traefik's `80`
   and `443` are exposed, so a plain host-side `pnpm migrate` cannot reach
   them. `apps/server` never applies migrations on its own — after
   `prod:up`, and again whenever a release adds a migration, run:

   ```bash
   pnpm run prod:migrate   # docker compose run --rm migrate
   ```

   This runs a one-off container from the same published image, on the same
   Docker network as `postgres`/`neo4j`, applying the Postgres migrations,
   the organization backfill, and the Neo4j migrations
   (`apps/server/scripts/docker-migrate.mjs`). It's excluded from
   `docker compose up`/`prod:up` (Compose `profiles: ["tools"]`) — naming
   the `migrate` service explicitly via `run` is what starts it.

3. **Enable TLS** — uncomment the `certificatesResolvers` block in
   `.docker/traefik.yml`, set `ACME_EMAIL` in `.env.prod`, and add
   `entrypoints=websecure` / `tls.certresolver=letsencrypt` to each router's
   labels (already set by default on the `server` and `keycloak` routers in
   `docker-compose.prod.yml`).

4. **Review the imported Keycloak realm** — `keycloak.realm-export.json` is
   the same realm used for local development
   (`registrationAllowed: false`, `redirectUris` pointing at `localhost`).
   Adjust it for the real domain before the first deployment, or provision a
   dedicated realm instead with
   [`setup:realm`](#onboard-a-new-customer-with-a-dedicated-keycloak-realm)
   below.

## Contact form (SMTP)

The landing page's contact form (`apps/docs/app/(home)/page.tsx`, section
`#contact`) posts to `apps/docs/app/api/contact/route.ts`, which sends the
message with nodemailer through the same `SMTP_*` variables as `apps/server`'s
invitation mail (see [E-mail invitations](#e-mail-invitations-smtp)) — one
SMTP account (e.g. an OVH mailbox) for the whole monorepo, plus
`CONTACT_TO_EMAIL` for the inbox that receives submissions.

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and
`CONTACT_TO_EMAIL` on the `apps/docs` Vercel project (root directory
`apps/docs`). Without `SMTP_HOST` or `CONTACT_TO_EMAIL`, `/api/contact`
returns `502` and the rest of the landing page keeps working. A hidden
honeypot field in the form silently discards bot submissions before they
reach the SMTP server.

## Onboard a new customer with a dedicated Keycloak realm

ArchiSpark can run as a **dedicated platform per customer**: a separate
`apps/server` deployment and PostgreSQL database use a **shared self-hosted
Keycloak**. Customer isolation comes from Keycloak realms: each customer has a separate
`archispark-<tenant>` identity namespace for users, roles, identity providers,
JWKS, and issuer. See [One Keycloak realm per
client](../reference/authentication.md#one-keycloak-realm-per-client).
Onboarding requires configuration only; no application code changes.

1. **Create the customer realm** with the existing
   [`packages/db/scripts/setup-realm.ts`](https://github.com/archispark/archispark/blob/main/packages/db/scripts/setup-realm.ts)
   script. It does not assume a fixed realm name:

   ```bash
   KEYCLOAK_URL=<shared self-hosted Keycloak URL> \
   KEYCLOAK_REALM=archispark-<tenant> \
   KEYCLOAK_SETUP_AUTH_REALM=master \
   KEYCLOAK_SETUP_USERNAME=<master administrator> \
   KEYCLOAK_SETUP_PASSWORD=<password> \
   pnpm --filter @workspace/db setup:realm
   ```

   Alternatively, use `KEYCLOAK_SETUP_AUTH_REALM=archispark-<tenant>` and an
   administrator of that realm when the account cannot access `master`.

   **Do not set** `KEYCLOAK_SELF_REGISTRATION` or `KEYCLOAK_VERIFY_EMAIL` for a
   dedicated realm. Omitting them leaves the realm configuration unchanged,
   with `registrationAllowed: false` by default. They are intended only for
   the pooled realm described under [E-mail invitations](#e-mail-invitations-smtp).

2. **Retrieve the secret** for the generated `archispark-api` service account
   from Admin Console → Clients → `archispark-api` → Credentials.

3. **Provision the dedicated PostgreSQL database**, apply migrations with
   `pnpm --filter @workspace/db migrate:prod`, then run
   `pnpm --filter @workspace/db backfill:prod`. The backfill is a no-op on a
   new database; see
   [Organizations migration](#organizations-migration-releases-including-0018_organizations_expandsql)).

4. **Deploy** the customer's `archispark` with Vercel and point it at
   the shared Keycloak. Configure `DATABASE_URL` for the customer
   database, `KEYCLOAK_URL` for shared Keycloak,
   `KEYCLOAK_REALM=archispark-<tenant>`, `KEYCLOAK_CLIENT_ID_WEB=archispark-web`,
   `KEYCLOAK_ADMIN_CLIENT_ID`/`KEYCLOAK_ADMIN_CLIENT_SECRET`.

5. **Optionally seed initial accounts**:
   `KEYCLOAK_REALM=archispark-<tenant> pnpm --filter @workspace/db seed:demo-users`,
   or create real users through the Keycloak Admin Console or API.

6. **Optionally configure customer SSO** under Admin Console → Identity
   providers. Google, Microsoft Entra ID, and other OIDC or SAML providers are
   scoped to this realm and invisible to other customers.

7. **Test** sign-in end to end and verify isolation. A token issued by one
   customer realm must receive `401` from another customer's deployment;
   `verifyAccessToken` rejects the mismatched issuer. See
   [One Keycloak realm per client](../reference/authentication.md#one-keycloak-realm-per-client)).

## E-mail invitations (SMTP)

The pooled SaaS realm, unlike a dedicated customer realm, enables Keycloak
self-registration and e-mail invitations. See
[Organization invitations by e-mail](../reference/authentication.md#organization-invitations-by-e-mail).
Two sets of variables share one SMTP service:

- `KEYCLOAK_SELF_REGISTRATION=true`, `KEYCLOAK_VERIFY_EMAIL=true`, and
  `KEYCLOAK_RESET_PASSWORD=true` are passed to `pnpm setup:realm` only for the
  pooled realm. When absent, configuration remains unchanged, as required for
  dedicated realms.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_STARTTLS`, `SMTP_USER`, `SMTP_PASSWORD`, and
  `SMTP_FROM` are
  used by `apps/server` for invitation mail, by Keycloak for address
  verification and password reset, and by `apps/docs` for its
  [contact form](#contact-form-smtp). When Keycloak reaches the SMTP server from
  a different network, set `KEYCLOAK_SMTP_HOST` to its network-visible host;
  it overrides `SMTP_HOST` only in the realm configuration. Local development
  uses `localhost:1025` for `apps/server`, `mailpit:1025` for Keycloak, and
  exposes the captured messages at `http://localhost:8025`.
- Invitation delivery is selected for each create or resend operation in the
  member-management interface: email and copyable link, email only, or link
  only. API clients pass the equivalent `delivery_mode` value (`both`,
  `email`, or `manual`); it defaults to `both`. The clear link is never stored
  and cannot be retrieved later.
- The Keycloak service account needs `manage-users`, `view-users`, and
  `query-users`: ArchiSpark searches identities by exact e-mail, provisions a
  missing account without credentials, and invokes `execute-actions-email`
  with `UPDATE_PROFILE`, `UPDATE_PASSWORD`, and `VERIFY_EMAIL`. The action
  e-mail redirects back to the original ArchiSpark invitation.
- An air-gapped setup also needs the pnpm dependencies and Docker images to
  have been downloaded beforehand. Provision Keycloak users through its local
  admin console or `pnpm run seed:demo-users`.
- `ARCHISPARK_URL` is the public deployment URL used to build
  `${ARCHISPARK_URL}/invitations/<token>`. It is never inferred from the
  request's `Host` header.

Configure these variables on the `archispark` Vercel project.
