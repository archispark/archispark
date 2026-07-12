# Plan — Organisation → Workspace (multi-tenant SaaS, une seule API, une seule base)

## Contexte

ArchiSpark passe d'un modèle « un workspace appartient à exactement un
utilisateur » (`workspaces.ownerId`, voir `packages/db/src/schema.ts:1-17`)
à un modèle SaaS multi-tenant applicatif : une **Organisation** regroupe des
**Workspaces** et des utilisateurs, avec quatre rôles — `platform_admin`
(administre les organisations, aucun accès à leurs données), `owner` (tous
les droits dans son organisation, gère les membres), `admin` (créer/écrire/
lire sur les workspaces, ne gère pas les membres), `member` (lecture seule).

**Pourquoi maintenant** : la branche `refactor/remove-multi-tenant` a
supprimé aujourd'hui même (migration `0017_remove_multi_tenancy.sql`) un
modèle multi-tenant antérieur, au profit d'une isolation par **instance
dédiée + un realm Keycloak par client** (voir l'historique de `plan.md` à la
racine). L'utilisateur a explicitement annulé cette décision en session :
il veut une offre SaaS partagée (Organisation → Workspaces) **en plus** de
l'offre instance dédiée, mais **sans revenir** à l'ancienne implémentation :
ni la séparation physique control-DB/tenant-DB (`0008_tenant_databases.sql`),
ni le stockage des organisations dans le plugin Keycloak Phase Two
(`0015_phasetwo_organizations.sql`, `packages/auth/src/orgs.ts`, supprimé).
Une revue externe (Codex) et trois agents d'exploration ont confirmé des
lacunes dans une première ébauche de plan (risque de migration, surface
d'autorisation sous-estimée notamment côté `apps/mcp-server`, jetons API
scoping mort) — ce plan les adresse explicitement.

**Décisions déjà validées avec l'utilisateur** (ne pas rouvrir) :
- Keycloak reste « classic », pas de réintroduction de Phase Two — les
  organisations vivent uniquement dans Postgres.
- `owner_id` est conservé en tant que `created_by_id`, colonne non
  autoritative (traçabilité « créé par », jamais utilisée pour
  l'autorisation).
- Le déploiement de cette release accepte une courte fenêtre de
  maintenance (stratégie `Recreate`, pas de rolling update) plutôt qu'un
  design de compatibilité double-écriture.
- Ajout de membre = utilisateur Keycloak déjà existant (`findUserByUsername`,
  `@workspace/auth`) ; pas d'invitation par e-mail en v1.
- Gestion d'organisation/membres = web/REST uniquement ; aucun outil MCP
  d'administration d'organisation en v1.

## Périmètre

- Inclus : schéma `organizations`/`organization_members`, migration +
  backfill idempotent, passerelle d'autorisation unique partagée par
  `apps/api` et `apps/mcp-server`, routes CRUD organisation/membres, scoping
  des jetons API personnels par organisation, invariants de cycle de vie,
  UI `apps/web`, seed de démo multi-organisation, documentation.
- Exclu (v1) : invitation par e-mail, outils MCP de gestion d'organisation,
  séparation physique control-DB/tenant-DB, suspension/monitoring avancé
  au-delà d'un simple flag `enabled`, migration zéro-downtime.

## Fondations vérifiées (à réutiliser, ne pas redévelopper)

- `apps/api/src/errors.ts:1-21` — `AppError`/`NotFoundError`(404)/
  `ValidationError`(422)/`ForbiddenError`(403) existent déjà ; `ForbiddenError`
  n'est simplement pas encore utilisé (la règle `.claude/rules/api.md`
  l'interdisant est obsolète, à corriger — voir Phase 6).
- `apps/api/src/auth.ts:108-116` — `requireSuperAdmin` (rôle realm Keycloak
  `platform_admin`) existe déjà et est réutilisé tel quel pour les nouvelles
  routes `/platform/organizations*`.
- `@workspace/auth` — `findUserByUsername`/`getKeycloakUser` existants,
  réutilisés par `addMember` pour valider un utilisateur avant ajout.
- `packages/db/scripts/migrate-prod.ts` — patron à dupliquer pour le script
  de backfill manuel (`backfill-prod.ts`), même gestion de
  `DATABASE_URL`/env.
- `docker-compose.yml:104-106` — `mcp-server` a déjà
  `depends_on: api: condition: service_healthy` : l'ordre
  migration → backfill → API saine → MCP est déjà garanti par l'infra
  existante, rien à changer là-dessus.
- `apps/web` — patrons existants à suivre (`.claude/rules/frontend.md`) :
  `lib/api.ts`/`lib/queries.ts` (wrappers typés + hooks React Query),
  `useFormModal<T>()` pour les dialogues, `apps/web/app/workspaces/page.tsx`
  et `apps/web/components/workspace-settings.tsx` comme modèles pour les
  nouvelles pages organisation/membres, `apps/web/components/
  platform-admin-block.tsx` à étendre plutôt que remplacer.

## Phase 1 — Schéma (`packages/db/src/schema.ts`)

Nouvelles tables :
- `organizations` : `id` serial PK, `slug` unique, `name`, `isPersonal`
  boolean, `personalOwnerId` text nullable **unique** (clé d'idempotence du
  backfill — Keycloak `sub` du propriétaire pour une org personnelle
  auto-créée, `NULL` pour une org créée manuellement), `enabled` boolean
  default `true` (flag de suspension côté `platform_admin`), `createdAt`/
  `updatedAt`.
- `organizationMembers` : `id` serial PK, `organizationId` FK →
  `organizations.id` (`onDelete: "cascade"`), `userId` text (Keycloak `sub`,
  pas de FK — convention existante), `role` text (`"owner"|"admin"|
  "member"`, texte plat comme `elements.type`), `createdAt` ; unique
  `(organizationId, userId)`.
- `userActiveOrganization` : PK composite `(userId, organizationId)` —
  reprend la forme déjà éprouvée par l'ancienne migration
  `0007_org_teams_workspaces.sql` (`user_active_workspace_user_id_
  organization_id_pk`), sans le reste de son schéma (pas de tables
  `session`/`user`/`team`/`invitation` de type Better Auth).

Tables modifiées :
- `workspaces` (`schema.ts:61-74`) : `ownerId` renommé `createdById` (non
  autoritatif, conservé) ; nouvelle colonne `organizationId` integer FK →
  `organizations.id` (`onDelete: "cascade"`) ; `workspaces_owner_name_uniq`
  → `workspaces_org_name_uniq` sur `(organizationId, name)` ;
  `workspaces_owner_idx` → `workspaces_org_idx` sur `organizationId`.
- `userActiveWorkspace` (`schema.ts:80-83`) : PK composite
  `(userId, organizationId)` au lieu de `userId` seul (un utilisateur peut
  avoir un workspace actif différent par organisation).
- `apiTokens` (`schema.ts:29-42`) : nouvelle colonne `organizationId`
  integer FK → `organizations.id` (`onDelete: "cascade"`) ; `workspaceId`
  conservé (nullable, pin optionnel à un workspace précis de cette org).

Mettre à jour le commentaire d'en-tête (`schema.ts:1-17`) pour décrire la
hiérarchie `organizations → workspaces → elements/relationships/views/...`.

## Phase 2 — Migration et backfill (expand → backfill → verify → contract)

1. **`0018_organizations_expand.sql`** (généré via
   `cd packages/db && npx drizzle-kit generate`, DDL pur, zéro risque) :
   crée les 3 nouvelles tables, ajoute `workspaces.organization_id` et
   `api_tokens.organization_id` en **nullable**, renomme `owner_id` →
   `created_by_id`, recrée `user_active_workspace` avec la nouvelle PK
   composite (perte acceptable des pointeurs existants — resolus à la
   prochaine requête).
2. **Backfill idempotent** — nouveau fichier
   `packages/db/src/backfill-organizations.ts`, exporté
   `runOrganizationBackfill()`, appelé automatiquement juste après
   `runMigrations()` dans les deux points d'entrée qui l'appellent déjà
   (`apps/api/src/main.ts`, `apps/api/api/index.ts` pour Vercel) — toujours
   bloquant avant `app.listen`, `process.exit(1)` en cas d'échec, comme
   aujourd'hui pour les migrations. Logique, en transaction, entièrement
   guidée par `WHERE organization_id IS NULL` :
   - pour chaque `created_by_id` distinct sans organisation : créer une
     org personnelle (`INSERT ... ON CONFLICT (personal_owner_id) DO
     NOTHING RETURNING id`, sinon `SELECT`), insérer le membership
     `role: 'owner'`, `UPDATE workspaces SET organization_id = ...`.
   - même schéma pour `api_tokens.organization_id` (org personnelle du
     `user_id` du token).
   - log de synthèse (nombre de workspaces/tokens/organisations backfillés)
     pour rendre la vérification observable dans les logs de déploiement.
3. **Vérification** (avant de générer/appliquer la migration de contraction,
   dans chaque environnement) :
   ```sql
   SELECT count(*) FROM workspaces WHERE organization_id IS NULL; -- doit être 0
   SELECT count(*) FROM api_tokens WHERE organization_id IS NULL; -- doit être 0
   SELECT count(*) FROM organizations o WHERE NOT EXISTS (
     SELECT 1 FROM organization_members m
     WHERE m.organization_id = o.id AND m.role = 'owner'); -- doit être 0
   ```
4. **`0019_organizations_contract.sql`** (migration séparée, générée
   seulement après que l'étape 3 passe dans l'environnement cible) :
   `organization_id` `NOT NULL` sur `workspaces` et `api_tokens`,
   remplace l'unique `(owner_id, name)` par `(organization_id, name)`.
5. **Déploiement** : cette release (0018 + code applicatif Phase 3-5) est
   déployée en `Recreate` (coupure courte, pas de rolling update) —
   décision déjà validée. Documenter cette exigence dans
   `docs/deployment.md` (section Kubernetes/Helm). Un rollback de 0018 est
   sans perte (tables/colonnes vides) ; un rollback de 0019 n'est **pas**
   recommandé une fois appliqué (perte de `created_by_id`/contrainte) — en
   cas de problème, corriger par une migration suivante, pas un revert.
6. **Chemin instance dédiée / onboarding manuel**
   (`docs/deployment.md:106-159`) : `migrate:prod` n'exécute que le DDL —
   ajouter un script jumeau `packages/db/scripts/backfill-prod.ts` (même
   patron que `migrate-prod.ts`, appelle `runOrganizationBackfill()`),
   exposé `pnpm --filter @workspace/db backfill:prod`, documenté comme
   étape obligatoire juste après `migrate:prod` (no-op sur une base neuve).

## Phase 3 — Passerelle d'autorisation unique : `apps/api/src/access.ts` (nouveau)

Point de passage **obligatoire** pour `apps/api/src/app.ts` **et**
`apps/mcp-server/src/server.ts` (qui importe déjà le code de `apps/api` en
process, via `apps/api/src/index.ts` — pas d'appel HTTP, voir
`apps/mcp-server/src/token-auth.ts`). Remplace mécaniquement les ~37 appels
`getActiveWorkspaceId` dans `app.ts` et ~30 dans `server.ts` (même forme
d'appel, un paramètre `intent` en plus, retourne `{ workspaceId,
organizationId, orgRole }` au lieu d'un simple nombre).

```ts
export type OrgRoleName = "owner" | "admin" | "member"
export type Intent = "read" | "write" | "manage_members"

export async function resolveActiveContext(userId: string, intent: Intent):
  Promise<{ organizationId: number; workspaceId: number; orgRole: OrgRoleName }>

export async function assertOrgAccess(userId: string, organizationId: number, intent: Intent): Promise<OrgRoleName>
export async function assertWorkspaceAccess(userId: string, workspaceId: number, intent: Intent):
  Promise<{ organizationId: number; workspaceId: number; orgRole: OrgRoleName }>
```

Règles :
- Pas de ligne `organization_members` pour `(organizationId, userId)` →
  `NotFoundError` (masque l'absence d'accès en « non trouvé », convention
  existante).
- `organizations.enabled = false` → `ForbiddenError` pour tout rôle, y
  compris `owner`.
- Rôle insuffisant pour l'`intent` (`write`/`manage_members` exigent
  `owner`/`admin` ; `manage_members` exige `owner` seul) → `ForbiddenError`.
- **`platform_admin` est structurellement rejeté** par `resolveActiveContext`/
  `assertOrgAccess` (toujours `NotFoundError`), quelle que soit une
  éventuelle ligne de membership — l'isolation devient structurelle, pas
  une vérification qu'on pourrait oublier d'ajouter quelque part.
- `resolveActiveContext` lit `user_active_organization`, retombe sur la plus
  petite `organizationId` dont l'utilisateur est membre si absente/périmée
  (membership révoqué entre-temps), puis résout de même l'espace de
  travail actif via `user_active_workspace(userId, organizationId)` — même
  logique d'auto-guérison que l'actuel `registry.ts:81-94`.
- Authentifié par jeton API Bearer : `resolveActiveContext` privilégie
  `req.tokenContext` (organisation/workspace épinglés sur le jeton, Phase 5)
  sur la sélection interactive de l'utilisateur.

`apps/api/src/registry.ts` est réécrit pour s'appuyer sur `assertOrgAccess`
(ex. `createWorkspace(userId, organizationId, name, ...)` exige `write` ;
`activateWorkspace` exige seulement `read`, upsert
`user_active_organization` + `user_active_workspace`).

Deux nouveaux modules dédiés (contrainte `max-lines` ESLint — ne pas grossir
`store.ts`/`app.ts`, déjà volumineux) :
- `apps/api/src/organizations-store.ts` : CRUD organisation + membres
  (`listOrganizationsForUser`, `createOrganization`, `renameOrganization`,
  `deleteOrganization`, `listMembers`, `addMember`, `updateMemberRole`,
  `removeMember`, `activateOrganization`).
- `apps/api/src/platform-store.ts` : `listAllOrganizations` (métadonnées
  seules — **aucune** jointure vers `workspaces`/contenu),
  `setOrganizationEnabled`, `deleteOrganizationAsPlatformAdmin`. Monté
  derrière `requireSuperAdmin`.

## Phase 4 — Invariants de cycle de vie (choisis, pas laissés ouverts)

1. **Au moins un `owner` en permanence** : `updateMemberRole`/`removeMember`
   (y compris l'auto-retrait) refusent (422 `ValidationError`) toute
   opération qui laisserait zéro membre `owner`.
2. Plusieurs `owner` simultanés autorisés (le « transfert » de propriété se
   fait en ajoutant un second owner puis, si souhaité, en se rétrogradant —
   bloqué par la règle 1 si on est le dernier).
3. Seul un `owner` peut ajouter/modifier/retirer un membre, y compris pour
   nommer un autre `owner` (l'`admin` ne gère jamais les membres).
4. Suppression d'organisation : `owner` uniquement, cascade FK vers
   workspaces/contenu/membres/jetons (Phase 1).
5. Suppression de workspace : `owner` ou `admin`.
6. Unicité du nom de workspace : `(organization_id, name)`.
7. **Organisation personnelle automatique** : à la première création de
   workspace, si l'utilisateur n'a encore aucune organisation, une org
   personnelle (`is_personal = true`) est créée à la volée (même mécanisme
   que le backfill) — préserve l'usage solo actuel sans friction ; créer une
   organisation « équipe » reste une action explicite distincte
   (`POST /organizations`, libre pour tout utilisateur authentifié).

## Phase 5 — Jetons API personnels (`apiTokens`) — scoping réel

- `POST /settings/api-tokens` exige désormais `organization_id` (l'appelant
  doit en être membre au moment de la création, vérifié) et accepte un
  `workspace_id` optionnel (doit appartenir à cette organisation si fourni).
- **Le rôle n'est jamais figé sur le jeton.** `lookupApiToken`
  (`apps/api/src/auth.ts:26-45`) continue de renvoyer le rôle **plateforme**
  (`platform_admin`/`user`, réalm Keycloak, inchangé) plus
  `organizationId`/`workspaceId` du jeton ; le rôle `owner`/`admin`/`member`
  est résolu **en direct** depuis `organization_members` à chaque requête
  via `access.ts` — évite qu'un jeton garde des droits après une
  rétrogradation/un retrait.
- `req.tokenContext` (`auth.ts:16`, actuellement du code mort — jamais lu
  nulle part, confirmé par exploration) devient
  `{ organizationId, workspaceId | null }` et est enfin consommé par
  `resolveActiveContext`.
- `GET /settings/api-tokens` côté `platform_admin` : retirer
  `organizationId`/`workspaceId` des colonnes renvoyées (ne pas laisser
  fuir la structure des organisations à un rôle censé n'y avoir aucun
  accès).
- Suppression d'une organisation cascade vers `api_tokens` (Phase 1) — pas
  de nettoyage séparé à écrire.

## Phase 6 — Convention d'erreur et documentation des règles

Remplacer dans `.claude/rules/api.md` la règle actuelle (« jamais
`ForbiddenError` ») par :

> **Erreurs d'accès à deux niveaux.** `NotFoundError` (404) si l'appelant
> n'a aucune appartenance à l'organisation ciblée (ou si l'id n'existe pas)
> — masque volontairement « pas membre » en « non trouvé ». `ForbiddenError`
> (403) si l'appelant **est** membre reconnu mais que son rôle est
> insuffisant pour l'action demandée (écriture pour un `member`, gestion des
> membres pour un non-`owner`, organisation suspendue) — l'existence et la
> relation de l'appelant à la ressource sont déjà connues, 404 serait
> trompeur. Les deux ne sont levées que depuis `access.ts`, jamais route par
> route.

`ForbiddenError` existe déjà (`apps/api/src/errors.ts:19-21`) — pas de
nouvelle classe, juste un branchement réel et une règle écrite corrigée.
Mettre aussi à jour la ligne « Ownership is enforced by query scoping »
pour référencer `access.ts` au lieu de `getActiveWorkspaceId(userId)`.

## Phase 7 — MCP (`apps/mcp-server/src/server.ts`)

- Remplacer les ~30 appels `getActiveWorkspaceId(user.id)` par
  `resolveActiveContext`/`assertWorkspaceAccess`, `intent: "write"` pour les
  19 outils mutants (dont `import_model`, destructif), `"read"` pour les 18
  outils de lecture.
- `req.mcpUser`/`TokenUser` gagne `organizationId`/`workspaceId` (du jeton),
  pour que la résolution de contexte s'appuie sur le jeton plutôt que sur
  une sélection interactive absente côté MCP.
- **Pas d'outil MCP de gestion d'organisation/membres en v1** (décision
  validée) — la gestion reste web/REST uniquement ; seuls les outils déjà
  existants (lecture/écriture de contenu de workspace) sont mis à jour.

## Phase 8 — Routes REST (`apps/api/src/app.ts`)

Nouvelles routes (après `app.use(requireAuth)`) :
```
GET/POST   /organizations
PUT/DELETE /organizations/:id
POST       /organizations/:id/activate
GET/POST   /organizations/:id/members
PUT/DELETE /organizations/:id/members/:userId

GET/PUT/DELETE /platform/organizations[/:id]   (requireSuperAdmin)
```
Routes existantes modifiées : `GET/POST /workspaces` (exigent
`organization_id`), `/settings/api-tokens` (Phase 5), `POST /import`
(passe par `resolveActiveContext(..., "write")` avant `modelToDb`).
Schémas zod correspondants dans `validation.ts` + `.openapi(...)` dans
`openapi.ts`, suivant la convention existante.

## Phase 9 — Frontend `apps/web`

- `lib/api.ts`/`lib/queries.ts` : types + wrappers + hooks React Query pour
  organisations/membres, `fetchWorkspaces`/`WorkspaceCreateIn` étendus avec
  `organization_id`.
- Nouvelles pages : sélecteur d'organisation, `app/organizations/page.tsx`
  (lister/créer/renommer/supprimer/activer, calqué sur
  `app/workspaces/page.tsx`), `components/organization-members.tsx`
  (gestion des membres, `owner` uniquement, via `useFormModal<T>()`).
- `workspace-settings.tsx`/`app/workspaces/page.tsx` : masquer les actions
  d'écriture selon le rôle retourné par `GET /organizations` (par
  organisation, pas de round-trip supplémentaire).
- Étendre `components/platform-admin-block.tsx` en une page
  `app/platform/organizations/page.tsx` (lister/suspendre/supprimer,
  métadonnées seules).
- `app/settings/page.tsx` : sélecteur d'organisation (obligatoire) et de
  workspace (optionnel) à la création d'un jeton API.

## Phase 10 — Données de démo

- `.docker/keycloak/demo-users.json` : inchangé (identité Keycloak
  uniquement, pas de notion d'organisation).
- Nouveau `packages/db/seeds/demo-orgs.json` : 2 organisations de démo
  (`archi`=owner partout, `user`/`contrib` répartis en `member`/`admin`),
  `admin` (platform_admin) volontairement sans aucune appartenance —
  démontre l'isolation dès la démo.
- `packages/db/scripts/seed-demo.ts` : résoudre aussi `user`/`contrib` (pas
  seulement `archi`, comme aujourd'hui), ajouter `getOrCreateOrganization`/
  `upsertMember` (même style `pg` brut que le fichier actuel), remplacer le
  placeholder unique `__OWNER_ID__` par `__ORGANIZATION_ID__` par
  organisation.
- `packages/db/seeds/demo.sql` : seuls les en-têtes `DELETE`/`INSERT` des
  deux blocs workspace changent (`owner_id` → `organization_id`) ; les
  ~5400 lignes de données d'éléments/vues ne bougent pas.

## Phase 11 — Documentation

- `docs/architecture.md`, `docs/authentication.md`, `docs/api-reference.md` :
  décrire la hiérarchie Organisation → Workspace et les 4 rôles, retirer
  « there is no organization or team concept ».
- `docs/deployment.md` : étape `backfill:prod` après `migrate:prod`
  (Vercel + onboarding client dédié), note sur le déploiement `Recreate`
  pour cette release.
- `.claude/rules/db.md` : documenter le motif « backfill idempotent
  exécuté à chaque démarrage » comme approche privilégiée pour ce type de
  migration de données.
- `docs/decisions.md` — nouvelle entrée `2026-07-12 — Organisation →
  Workspace multi-tenant (Postgres natif)` : contexte (retour en arrière sur
  `refactor/remove-multi-tenant`/l'ancien `plan.md`), décision (Postgres,
  pas Keycloak Phase Two ; `platform_admin` structurellement isolé ;
  compatible avec l'offre instance dédiée), conséquences (`access.ts` point
  de passage obligé, jetons scopés par organisation, backfill idempotent).
- `CLAUDE.md` (section Architecture) : mettre à jour la description
  d'`apps/api`.

## Vérification

- `pnpm --filter @workspace/db test` (PGlite) : nouveau
  `backfill-organizations.test.ts` — pré-semer des lignes façon
  pré-migration (plusieurs `owner_id` distincts, y compris deux
  propriétaires ayant chacun un workspace de même nom, pour prouver que
  `(org, name)` ne collisionne pas comme le faisait `(owner, name)`),
  exécuter le backfill **deux fois** pour vérifier l'idempotence (aucun
  changement au 2ᵉ passage), vérifier qu'aucun workspace/jeton ne reste
  sans organisation et que chaque organisation a exactement un membre
  `owner`.
- `pnpm --filter api test` : nouveaux `access.test.ts`
  (matrice complète `{owner, admin, member, platform_admin, non-membre}` ×
  `{read, write, manage_members}` × `{org active/suspendue}` ×
  `{organisation/workspace actif périmé → auto-guérison}`) et
  `organizations-store.test.ts` (invariant dernier-owner, `addMember`
  rejetant un utilisateur Keycloak inconnu) ; extension de `app.test.ts`
  (chaque route mutante × rôle : owner/admin 2xx, member 403, non-membre
  404, platform_admin 404 sur le contenu mais 200 sur `/platform/
  organizations`).
- `pnpm --filter mcp-server test` : extension de `server.test.ts` sur des
  outils représentatifs (`create_element`, `import_model`) pour la même
  matrice de rôles, plus un test de jeton épinglé à un workspace précis.
- `pnpm run -w test && pnpm typecheck && pnpm lint` doivent passer.
- Test manuel en navigateur (`make up`) avec les 4 comptes de démo :
  `owner`/`admin` créent, `member` ne voit que de la lecture,
  `platform_admin` ne voit aucun contenu d'organisation mais accède à
  `/platform/organizations`.
- Exécuter le backfill contre une copie de la base de dev avant toute
  application en production, et valider les 3 requêtes de vérification de
  la Phase 2 avant de générer la migration de contraction (`0019`).
