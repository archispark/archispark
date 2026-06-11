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
- `drizzle-orm/neon-http` (`createTenantDb` dans `connection.ts`, marqué
  `/* v8 ignore */` car non atteint tant qu'aucun tenant n'est `active`) a un
  `.transaction()` batché/non-interactif. `model-io.ts` (`modelToDb`) utilise
  `db.transaction(async (tx) => {...})` avec des opérations dépendantes les
  unes des autres — à vérifier/adapter dès que le premier tenant passe
  `active` (sinon basculer ce chemin sur `neon-serverless` + websockets pour
  les tenants provisionnés, ou restructurer `modelToDb` sans transaction
  interactive).
- `TENANT_DB_ENCRYPTION_KEY` est documentée dans `README.md` — s'assurer
  qu'elle est définie en prod avant de provisionner le premier tenant.

---

## Phase 3 — Provisioning Neon + migration des tenants existants

- [ ] Intégration API Neon (clé API stockée en variable d'env `NEON_API_KEY` côté
      apps/api, jamais exposée au front)
- [ ] Fonction `provisionTenantDatabase(organizationId)` :
  - [ ] `CREATE DATABASE tenant_<org_id>` + `CREATE ROLE` via API Neon
  - [ ] GRANT limité à cette DB pour le rôle
  - [ ] Écrit la connection string chiffrée dans `tenant_databases`
  - [ ] Joue les migrations `drizzle-pg/tenant/*` sur la nouvelle DB
  - [ ] Seed du workspace par défaut
- [ ] Brancher `provisionTenantDatabase` sur la création d'organisation (Better Auth
      `organization.create` hook ou route dédiée)
- [ ] Script de migration des tenants existants :
  - [ ] Pour chaque org existante : provisionner sa DB, copier les lignes
        (workspaces + tout leur contenu) filtrées par `organization_id`
  - [ ] Bascule `tenant_databases` + vérification + nettoyage de l'ancienne DB partagée
- [ ] Commit Phase 3

---

## Phase 4 — Split des interfaces (apps/admin-web)

- [ ] Nouvelle app Next.js `apps/admin-web` (extraite de `apps/web/app/admin`)
  - [ ] Gestion organisations/tenants (liste, statut provisioning, suspension)
  - [ ] Gestion users globaux, OAuth providers, site settings
  - [ ] Aucune route/dépendance vers les endpoints "data" tenant
- [ ] Nouveau rôle `platform_admin` (remplace le bypass `user.role==="admin"` dans
      `requireWorkspaceWrite`)
- [ ] Retirer `/admin` de `apps/web`
- [ ] Sous-domaines (`app.xxx` / `admin.xxx`) + cookie Better Auth sur domaine racine
- [ ] Config Vercel : 2 projets
- [ ] Mettre à jour `README.md`
- [ ] Commit Phase 4

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
