---
title: Deployment
description: Deploy ArchiSpark with Docker Compose or Vercel.
---

## Organizations migration (releases including `0018_organizations_expand.sql`)

This release introduces the Organization → Workspace hierarchy via an
expand→backfill→verify→contract migration (see
[Architecture](architecture.md#database-schema)). Plan a short maintenance
window rather than a rolling update for this release. After deploying, run
`pnpm --filter @workspace/db backfill:prod` once against the target database
(a no-op if already run), then verify with the three queries in `plan.md`'s
Phase 2 before ever generating
`0019_organizations_contract.sql` (the `NOT NULL` contract migration,
intentionally not shipped in this release — see that file for the full
rationale).

## Neo4j schema migrations (production)

`packages/db-neo4j` (see [Neo4j export](architecture.md#neo4j-export)) ships
its own versioned Cypher migrations, separate from `packages/db`'s Postgres
migrations — Neo4j has no `drizzle-kit` equivalent, so these are applied with
a dedicated script rather than automatically on cold start:

```bash
NEO4J_URI=<uri> NEO4J_USER=<user> NEO4J_PASSWORD=<password> \
  pnpm --filter @workspace/db-neo4j migrate:prod
# or, with an env file:
pnpm --filter @workspace/db-neo4j migrate:prod /tmp/neo4j-prod.env
```

Idempotent — already-applied migrations (tracked via `:SchemaMigration`
nodes) are skipped, so it's safe to re-run after every deployment that adds a
new `packages/db-neo4j/src/schema/migrations/*.cypher` file. Self-hosted
Docker Compose deployments run it against the `neo4j` service added to
`.docker/docker-compose.yml` (`NEO4J_URI=bolt://neo4j:7687`, credentials from
`NEO4J_PASSWORD` in `.env.prod`).

## Vercel

A single Vercel project (`archispark`, root directory `apps/server`)
serves the UI, the REST API and the MCP transport — there is no longer a
separate API or MCP-server project. `apps/server/vercel.json` overrides
`buildCommand` to build `@workspace/db` and `@workspace/auth` first (Vercel's
zero-config Next.js detection doesn't build workspace dependencies on its
own).

1. **Create the `archispark` project** — import the repo as a Vercel
   project with root directory `apps/server`.

2. **Add Neon** — In Vercel → Storage, add a Neon Postgres database
   (`archispark`), attached to `archispark`. Neon auto-injects
   `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).

3. **Apply database migrations, then the organization backfill** using the
   manual GitHub Actions workflow **Run production migrations**
   (`migrate-prod.yml`). It reads the `DATABASE_URL_UNPOOLED` repository
   secret, so no Vercel environment export is needed on a developer machine.

   For exceptional local recovery only:

```bash
DATABASE_URL="<neon-unpooled>" pnpm --filter @workspace/db migrate:prod
DATABASE_URL="<neon-unpooled>" pnpm --filter @workspace/db backfill:prod
```

`backfill:prod` populates `workspaces.organization_id`/`api_tokens.organization_id`
(left `NULL` by the DDL alone) — required once after any `migrate:prod` run
that includes `0018_organizations_expand.sql` or later; a no-op on a fresh
database, and safe to re-run. `apps/server/instrumentation.ts` (Next.js's
`register()` hook) also runs it automatically on every cold start, but
running it explicitly here avoids the very first request after a migration
hitting an unbackfilled row.

4. **Set environment variables** on `archispark` — `DATABASE_URL`
   (from Neon, above), `KEYCLOAK_URL`, `KEYCLOAK_REALM`,
   `KEYCLOAK_CLIENT_ID_WEB`, `KEYCLOAK_ADMIN_CLIENT_ID`,
   `KEYCLOAK_ADMIN_CLIENT_SECRET`, `ARCHISPARK_URL`, and (only on the pooled
   realm's deployment) `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM`.
   Authentication itself (Keycloak realm, client ids/secrets) is configured
   via the project's Vercel dashboard — see
   [Keycloak login](../reference/authentication.md#keycloak-login). SMTP config is also
   detailed in [E-mail invitations](#e-mail-invitations-smtp). Custom image
   pack uploads need `BLOB_READ_WRITE_TOKEN` — see
   [Image library storage](#image-library-storage-vercel-blob).

5. **Redeploy** `archispark`.

## Image library storage (Vercel Blob)

Organization-scoped custom image packs (see
[Image Library](../reference/image-library.md)) store their uploaded files in
[Vercel Blob](https://vercel.com/docs/storage/vercel-blob). In Vercel →
Storage, create a Blob store and attach it to the `archispark` project —
this auto-injects `BLOB_READ_WRITE_TOKEN`. Without it, uploading to a custom
pack fails with a clear error; the system pack (bundled ArchiMate icons)
stays fully usable regardless.

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
  used both by `apps/server` for invitation mail and by Keycloak for address
  verification and password reset. When Keycloak reaches the SMTP server from
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
