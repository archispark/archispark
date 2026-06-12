# Plan d'évolution — SaaS multi-tenant / multi-database

Objectif : transformer ArchiSpark en plateforme SaaS où chaque client (organisation)
a ses données ArchiMate dans **sa propre base Postgres (Neon)**, avec une interface
et des droits distincts pour les administrateurs de la plateforme (qui ne doivent
**jamais** pouvoir consulter le contenu des clients) et pour les utilisateurs des
organisations clientes.

Décisions actées :
- Isolation : **database-per-tenant** (Neon : 1 DB + 1 rôle Postgres par tenant, même projet).
- API : **1 seul service `apps/api`** pour l'instant, séparation logique interne
  (control-plane DB vs tenant DB résolue dynamiquement). Split en 2 services
  (`control-api` / `tenant-api`) reporté en Phase 5 (optionnelle).
- Auth : **Better Auth conservé**, mais limité à la base control-plane.
- Connexions tenant : driver Neon serverless (`@neondatabase/serverless`), pas de
  pool TCP persistant par tenant.

Ce fichier est la source de vérité pour reprendre le travail après une coupure.
Cocher au fur et à mesure, ajouter des notes sous chaque tâche si utile.

---

## Phase 0 — Finaliser le travail en cours (orgs/teams/workspaces row-level)

État : gros diff déjà présent dans le working tree (non commité), à vérifier/finir/committer.

- [x] Vérifier que `pnpm run -w test` passe (couverture ≥ 80%)
- [x] Vérifier que `pnpm turbo run lint` passe (zéro erreur)
- [x] Relire les nouveaux fichiers non trackés :
  - [x] `apps/web/app/organization/`
  - [x] `apps/web/components/org-switcher.tsx`
  - [x] `apps/web/components/organization-settings.tsx`
  - [x] `apps/web/components/organization-sidebar.tsx`
  - [x] `apps/web/components/workspace-settings.tsx`
  - [x] `apps/web/hooks/use-organization.ts` + `.test.tsx`
  - [x] `packages/db/drizzle-pg/0007_org_teams_workspaces.sql`
- [x] Mettre à jour `README.md` (API/MCP/comportement) si besoin — déjà fait dans le diff
      en cours (sections Organisations & teams, Authentification, Workspace management)
- [x] Commit Phase 0

---

## Phase 1 — Split de schéma (control-plane / tenant)

But : préparer la séparation des données sans encore changer la base physique
(1 seule DB pour l'instant — tout reste dans la même base et la même migration
folder ; `connection.ts`, `drizzle.config.ts`, `migrate.ts`, `index.ts` ne
changent pas).

- [x] Créer `packages/db/src/schema.control.ts` :
  - [x] `users`, `sessions`, `accounts`, `verifications`
  - [x] `organizations`, `members`, `teams`, `teamMembers`, `invitations`
  - [x] `oauthProviders`, `siteSettings`, `apiTokens`
  - [x] nouvelle table `tenant_databases` (org_id, neon_db_name, neon_role,
        connection_string chiffrée, status, region, created_at)
- [x] Créer `packages/db/src/schema.tenant.ts` :
  - [x] `workspaces`, `workspaceTeams`, `userActiveWorkspace`
  - [x] `elements`, `relationships`
  - [x] `propertyDefinitions`, `elementProperties`, `relationshipProperties`
  - [x] `views`, `nodes`, `connections`, `bendpoints`
- [x] `apiTokens.workspaceId` : retirer la FK vers `workspaces.id` (devient un
      entier non contraint — `workspaces` part côté tenant, FK cross-DB impossible)
- [x] `packages/db/src/schema.ts` devient un ré-export agrégé (`export *` des
      deux fichiers) — aucun import existant n'a besoin de changer
- [x] Migration `drizzle-pg/0008_tenant_databases.sql` (hand-written, suit la
      convention 0003-0007) : `CREATE TABLE tenant_databases` + index sur
      `status` + `ALTER TABLE api_tokens DROP CONSTRAINT
      api_tokens_workspace_id_workspaces_id_fk` ; entrée `idx: 8` ajoutée à
      `meta/_journal.json`
- [x] `packages/db/vitest.config.ts` : exclure `schema.control.ts` /
      `schema.tenant.ts` de la couverture (comme l'était déjà `schema.ts`) —
      sans ça le seuil global de 80% (lignes/fonctions) tombe à cause des
      callbacks `(t) => [...]` et `references()` non exécutés en test
- [x] Tests + lint : `pnpm run -w test` (4/4 packages OK) et
      `pnpm turbo run lint` (0 erreur) passent avec le schéma splitté
- [ ] ~~Adapter `test-helper.ts` pour 2 "bases"~~ — pas nécessaire en Phase 1
      (1 seule DB physique, 1 seul client Drizzle)
- [x] Commit Phase 1

---

## Phase 2 — Connexion dynamique par tenant

- [x] `packages/db/src/connection.ts` :
  - [x] `controlDb` (connexion unique, comme aujourd'hui — c'est l'ancien export
        `db`, renommé)
  - [x] `getTenantDb(organizationId)` : lit `tenant_databases`, ouvre une
        connexion via `@neondatabase/serverless` (`drizzle-orm/neon-http`),
        cache par org (`Map<organizationId, NodePgDatabase>`) — retourne
        `controlDb` tant qu'il n'y a pas de ligne `status: "active"` (mode
        transitoire, voir Phase 3)
  - [x] `runWithTenantDb(tenantDb, fn)` + nouvel export `db` (Proxy basé sur
        `AsyncLocalStorage`) : `store.ts` / `registry.ts` / `model-io.ts`
        continuent d'importer `db` sans aucun changement — il se résout vers la
        connexion tenant de la requête courante, ou `controlDb` hors requête
        (migrations, scripts, ou tant qu'aucun tenant n'est `active`)
  - [x] `packages/db/src/tenant-crypto.ts` : chiffrement AES-256-GCM des
        connection strings (`encryptConnectionString` / `decryptConnectionString`),
        clé dérivée (scrypt) de la nouvelle variable d'env
        `TENANT_DB_ENCRYPTION_KEY` — requise dès qu'une ligne `tenant_databases`
        passe à `active`, réutilisable par le script de provisioning Phase 3
- [x] `apps/api` :
  - [x] `auth.ts` + `better-auth.ts` : toutes les requêtes control-plane
        (`users`, `accounts`, `organizations`, `members`, `teams`,
        `teamMembers`, `apiTokens`, `oauthProviders`, sessions Better Auth)
        → `controlDb`
  - [x] `app.ts` : `oauthProviders` / `apiTokens` / `siteSettings` /
        `select version()` → `controlDb` ; nouveau middleware juste après
        `resolveWorkspaceContext` qui appelle
        `getTenantDb(req.workspace.organizationId)` puis
        `runWithTenantDb(tenantDb, next)` — les routes data (`/workspaces`,
        `/elements`, `/relationships`, `/views`, `/property-definitions`,
        `/export*`, `/import`) n'ont pas changé : elles passent par
        `store.ts`/`registry.ts`/`model-io.ts`, qui résolvent `db` via ce
        contexte
- [x] `tenant_databases` : tant qu'aucune ligne n'existe pour une organisation
      (ou que `status !== "active"`), elle reste sur la même DB physique que
      `controlDb` — comportement actuel inchangé (mode "transitoire")
- [x] Tests : `packages/db/src/connection.test.ts` (fallback `controlDb` sans
      ligne / ligne non-active, cache + branche `active` avec une connection
      string chiffrée factice, proxy `db` + `runWithTenantDb` y compris à
      travers un `await`) et `packages/db/src/tenant-crypto.test.ts`
      (round-trip, erreur si `TENANT_DB_ENCRYPTION_KEY` absente, échec si la
      clé change)
- [x] `pnpm run -w test` (4/4 packages, couverture ≥ 80%) et
      `pnpm turbo run lint` (0 erreur) passent
- [x] Commit Phase 2

**Notes pour la Phase 3** :
- ~~`drizzle-orm/neon-http` ... `.transaction()` batché/non-interactif~~ —
  résolu : `createTenantDb` (`connection.ts`) utilise désormais
  `drizzle-orm/neon-serverless` (websocket `Pool`), qui supporte les vraies
  transactions interactives requises par `modelToDb`/`seedWorkspace`.
  `controlDb` reste sur `node-postgres`/PGlite (pas de transaction
  interactive nécessaire côté control-plane).
- `TENANT_DB_ENCRYPTION_KEY` est documentée dans `README.md` — s'assurer
  qu'elle est définie en prod avant de provisionner le premier tenant.

---

## Phase 3 — Provisioning Neon + migration des tenants existants

- [x] Intégration API Neon (clé API stockée en variable d'env `NEON_API_KEY` côté
      apps/api, jamais exposée au front) — `packages/db/src/neon-api.ts`
      (`NEON_API_KEY` + `NEON_PROJECT_ID` requis, `NEON_BRANCH_ID` optionnel)
- [x] Fonction `provisionTenantDatabase(organizationId)` (`tenant-provisioning.ts`) :
  - [x] `CREATE DATABASE tenant_<org_id>` + `CREATE ROLE` via API Neon
  - [x] GRANT limité à cette DB pour le rôle (DB owned by the role)
  - [x] Écrit la connection string chiffrée dans `tenant_databases`
  - [x] Joue les migrations `drizzle-pg/tenant/*` sur la nouvelle DB
  - [x] Seed du workspace par défaut
- [x] Brancher `provisionTenantDatabase` sur la création d'organisation
      (Better Auth `organizationHooks.afterCreateOrganization`,
      `apps/api/src/better-auth.ts`)
- [x] Script de migration des tenants existants
      (`apps/api/scripts/migrate-existing-tenant.ts`,
      `pnpm --filter api migrate-tenant`) :
  - [x] Pour chaque org existante (ou `--all`) : `migrateExistingTenant`
        provisionne sa DB et copie les workspaces + tout leur contenu
        (via `modelFromDb`/`seedWorkspace`), `workspace_teams` et
        `user_active_workspace`, filtrés par `organization_id`
  - [x] Bascule `tenant_databases.status = "active"` + vérification (compare
        le nombre de workspaces source/tenant) + nettoyage de l'ancienne DB
        partagée (`cleanupMigratedSharedData`, `--cleanup --yes`)
- [ ] Commit Phase 3

---

## Phase 4 — Split des interfaces (apps/admin-web)

- [x] Nouveau rôle `platform_admin` (remplace le bypass `user.role==="admin"` dans
      `requireWorkspaceWrite`) — migration `0010_platform_admin_role.sql`,
      `requireSuperAdmin`, Better Auth `adminRole`, `allowUserToCreateOrganization`,
      MCP `isAdmin`, `useIsAdmin()` (reste dans apps/web, utilisé pour le
      bypass lecture-seule sur les pages tenant-data).

### Phase 4a — Scaffold `apps/admin-web` (build complet, in-repo, testable)

- [x] Config workspace : `package.json`, `next.config.ts`, `tsconfig.json`,
      `eslint.config.js`, `postcss.config.mjs`, `components.json`,
      `next-env.d.ts`, `vitest.config.ts`, `vitest.setup.ts`
- [x] `proxy.ts` (+ test) — même garde de session Better Auth que `apps/web`
- [x] `lib/auth-client.ts`, `lib/i18n.tsx` + `messages/{fr,en,es,de,it}.json`
      (sous-ensemble de clés extrait de `apps/web/messages/*`)
- [x] `lib/api.ts` + `lib/queries.ts` (sous-ensemble : users, OAuth providers,
      redis/postgres status, site messages — aucun endpoint "data" tenant)
- [x] `hooks/use-current-user.ts` (`useIsAdmin` = garde d'accès `platform_admin`),
      `hooks/use-organization.ts` (sous-ensemble : `useOrganizations`,
      `useCreateOrganization`, `useUpdateOrganization`)
- [x] Composants partagés copiés/adaptés : `theme-provider`, `theme-toggle`,
      `locale-switcher` + `flags`, `query-provider`, `data-table`, `user-menu`,
      `client-layout`, `nav`, `admin-sidebar`, `hooks/use-form-modal`
- [x] Pages : `/login`, `/organizations` (liste/CRUD), `/users` (CRUD + rôle),
      `/authentication` (OAuth/OIDC CRUD), `/redis`, `/postgres`, `/messages`
      (login/banner), `/` → redirect `/organizations`
- [x] Garde d'accès `platform_admin` (redirection si non-admin)
- [x] Tests (`pnpm --filter admin-web test:coverage` ≥ 60%)
- [x] Retirer `/admin` de `apps/web` (page, `admin-sidebar`, lien `UserMenu`,
      `client-layout`, `nav`, breadcrumb `isAdminView`) — `MembersTab` /
      `app/users/page.tsx` désormais uniquement dans `admin-web`
- [x] `pnpm run -w test`, `pnpm turbo run lint`, `pnpm turbo run typecheck`,
      `pnpm turbo run build`
- [x] Mettre à jour `README.md`
- [x] Commit Phase 4a

### Phase 4b — Gestion organisations/tenants (suivi, hors build initial)

- [x] Endpoint admin `GET /admin/organizations` : liste organisations +
      `tenant_databases.status` (pending/provisioning/active/error) — affichage
      lecture seule dans `admin-web` (`/organizations`)
- [x] Suspension d'organisation : colonne `organizations.enabled` (migration),
      endpoint admin pour bascule, vérification dans le middleware
      d'auth/résolution tenant (bloquer les membres non-`platform_admin` d'une
      org désactivée)
- [x] Tests db/api/admin-web associés
- [x] Commit Phase 4b

### Phase 4c — Infra (sous-domaines / Vercel) — action utilisateur

- [x] Cookie Better Auth partagé sur domaine racine : `COOKIE_DOMAIN` (env)
      → `computeAdvancedOptions()` (`apps/api/src/better-auth.ts`) active
      `advanced.crossSubDomainCookies` ; `TRUSTED_ORIGINS` liste déjà chaque
      sous-domaine (comma-separated) — doc dans `README.md`
      ("Cross-subdomain sessions")
- [x] `apps/api/scripts/setup-vercel-env.sh` : variables optionnelles
      `ADMIN_URL` / `COOKIE_DOMAIN` → configure `archispark-admin-web`
      (`ARCHIMATE_API_URL`), étend `TRUSTED_ORIGINS`, pose `COOKIE_DOMAIN`
      sur l'api — doc README ("Subdomain topology")
- [x] **Reste action utilisateur** : créer le projet Vercel
      `archispark-admin-web` (root directory `apps/admin-web`), acheter/poser
      les sous-domaines `app.<domain>` / `admin.<domain>` (DNS), les attacher
      aux 2 projets web dans le dashboard Vercel, puis lancer le script avec
      `ADMIN_URL` + `COOKIE_DOMAIN` renseignés et redéployer les 3 projets

---

## Phase 5 — Split API (optionnel, si exigence contractuelle forte)

- [ ] Extraire `apps/control-api` et `apps/tenant-api` à partir de `apps/api`
- [ ] Auth inter-services : JWT signé par control-api (org_id, user_id, rôle),
      vérifié par tenant-api
- [ ] Suppression complète des credentials control-plane du process tenant-api (et inversement)

---

## Phase 6 — Durcissement / conformité

- [ ] Audit log des actions admin plateforme
- [ ] Rotation des secrets / connection strings tenant
- [ ] Tests automatisés : aucune route control-plane n'importe `getTenantDb` et
      aucune route tenant n'importe `controlDb` directement (sauf whitelist explicite)
