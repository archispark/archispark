# Migration Better Auth → Keycloak (Phasetwo)

## Contexte

ArchiSpark utilise actuellement **Better Auth v1.6.15** comme système de comptes complet : authentification (email/mot de passe + OAuth générique), sessions (cookies + Redis), rôle plateforme (`platform_admin`), et — via son plugin `organization` — la gestion multi-tenant (organisations, membres, équipes, invitations).

Objectif : remplacer Better Auth par **Keycloak (distribution Phasetwo)**.
- **Local** : Keycloak (image Phasetwo) en Docker, réalmé via import.
- **Production** : instance gratuite **phasetwo.io** (cloud).
- **Portée validée** :
  1. **Organisations Phasetwo** remplacent intégralement `organizations`/`members`/`invitations` (extension "Organizations" de Keycloak).
  2. **JWT pur en cookies** (access/refresh/id token), pas de session serveur côté Redis — control-api valide les tokens via JWKS Keycloak.
  3. **Provisioning des comptes via l'API Admin Keycloak** (création d'utilisateurs, mots de passe, rôles) — préserve le flux actuel "créer une organisation avec propriétaire généré" et le seed de comptes démo.

Les `teams`/`teamMembers` (sous-groupes d'accès aux workspaces) restent dans la DB ArchiSpark — Phasetwo n'a pas d'équivalent natif et ce n'est pas de la "gestion de comptes" — simplement re-clés sur l'id Keycloak (`sub`) et l'id d'organisation Phasetwo (string).

---

## Architecture cible

```
Browser ──(redirect)──> Keycloak (Phasetwo) — login, SSO, orgs
   │  access_token / refresh_token / id_token en cookies httpOnly
   ▼
apps/web, apps/admin-web (Next.js)
   - route handlers /api/auth/{login,callback,logout,refresh,me}
   - middleware (proxy.ts) vérifie access_token, refresh si besoin
   ▼ (cookies transmis via Traefik /api, credentials: include)
apps/control-api (Express, resource server)
   - requireAuth: vérifie le JWT via JWKS Keycloak (jose)
   - rôle plateforme = realm role "platform_admin"
   - organisation/rôle org = claim "organization" du token (Phasetwo)
   - teams/teamMembers/apiTokens/tenantDatabases : DB locale, re-clés
   ▼
apps/tenant-api — inchangé (JWT inter-service TENANT_JWT_SECRET)
apps/mcp-server — inchangé (Bearer apiTokens, jamais lié à Better Auth)
```

---

## Nouveau package partagé : `packages/auth`

Centralise tout ce qui touche Keycloak — utilisé par `control-api`, `web`, `admin-web`. Évite de dupliquer la logique OIDC/JWT/Admin API trois fois.

- `getKeycloakConfig()` — lit `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID_WEB`, `KEYCLOAK_CLIENT_ID_ADMIN_WEB`, `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET`.
- `verifyAccessToken(token)` — vérifie via `jose.createRemoteJWKSet` + `jwtVerify`, retourne les claims typés (`sub`, `preferred_username`, `email`, `name`, `realm_access.roles`, `organization`).
- OIDC (via `openid-client`, PKCE) : `buildAuthorizationUrl()`, `exchangeCodeForTokens()`, `refreshTokens()`, `buildLogoutUrl()`.
- Admin API Keycloak (service account) : `getAdminToken()` (cache + refresh), `createKeycloakUser`, `setUserPassword`, `assignRealmRole`, `findUserByUsername`, `listRealmUsers`.
- Orgs API Phasetwo : `listOrganizations`, `getOrganization`, `createOrganization`, `updateOrganization`, `deleteOrganization`, `listOrgMembers`, `addOrgMember`, `removeOrgMember`, `setOrgMemberRoles`, `ensureDefaultOrgRoles` (owner/admin/member), `createOrgInvitation`, `listOrgInvitations`, `cancelOrgInvitation`.

Dépendances ajoutées : `jose`, `openid-client`.

---

## Infrastructure locale (Docker)

- **Nouveau service `keycloak`** dans `.docker/docker-compose.dev.yml` (et `.docker/docker-compose.yml` pour le self-hosting complet, hors phasetwo.io) :
  - Image Phasetwo (ex. `quay.io/phasetwo/phasetwo-keycloak:latest` — **à vérifier** au moment de l'implémentation sur la doc/Docker Hub Phasetwo).
  - `KC_DB=postgres`, base `keycloak` sur le service `postgres` existant → ajouter `.docker/initdb/02-create-keycloak-db.sql` (même pattern que `01-create-tenant-db.sql`).
  - Port `8080` exposé.
  - `--import-realm` montant `.docker/keycloak/realm-export.json`.

- **Nouveau fichier `.docker/keycloak/realm-export.json`** : réalme `archispark` avec
  - Clients : `archispark-web` (public, PKCE, redirect `http://localhost:8000/api/auth/callback`), `archispark-admin-web` (idem, `:8001`), `archispark-control-api` (confidentiel, service account avec rôles `realm-management` : `manage-users`, `view-users`, + rôles de gestion des orgs Phasetwo).
  - Rôle realm `platform_admin`.
  - Utilisateurs/organisations de démo équivalents au seed actuel (`admin`/`user`/`contrib`/`archi` avec rôles owner/admin/member dans une org "Default").
  - **À vérifier** : si les Organisations Phasetwo sont import via le JSON de realm standard ou nécessitent un script post-démarrage appelant l'API Orgs (probable) — dans ce cas prévoir un petit script `entrypoint`/`init` dans le service Keycloak ou dans `initUsers()` côté control-api au premier démarrage.

---

## Backend — `apps/control-api`

- **Supprimer** `apps/control-api/src/better-auth.ts` (toute la config Better Auth, OAuth env/DB providers).
- **Réécrire** `apps/control-api/src/auth.ts` :
  - Supprimer `hashPassword`/scrypt, `initUsers` (signUpEmail) → remplacé par appel `packages/auth` (Keycloak Admin API) pour s'assurer que les comptes démo existent (ou délégué à `realm-export.json`, cf. ci-dessus).
  - `requireAuth` : si `Authorization: Bearer` correspond à un `apiTokens` (token perso/MCP) → chemin existant inchangé ; sinon lire le cookie `access_token` (ou Bearer JWT), `verifyAccessToken()` → `req.user = { id: sub, username: preferred_username, role: realm_access.roles.includes("platform_admin") ? "platform_admin" : "user" }`.
  - `resolveWorkspaceContext` : organisation active = `req.tokenContext?.organizationId` (token perso) ?? en-tête `X-Org-Id` (envoyé par le front) — validé contre `claims.organization` (memberships Phasetwo dans le token) ; rôle org = `claims.organization[orgId].roles`. Fusionne avec les memberships `teams`/`teamMembers` locales (inchangé dans l'esprit).
  - `requireWorkspaceWrite` : inchangé dans la logique, lit le rôle org depuis les claims.
  - `listAdminOrganizations`, `setOrganizationEnabled`, `createAdminOrganization`, `createOrganizationWithOwner`, `deleteOrganization` → réécrits pour appeler l'API Orgs Phasetwo (`packages/auth`). Le flag `enabled` (suspension par un platform_admin) n'existe pas nativement chez Phasetwo → nouvelle table locale `organizationSettings` (organizationId text PK = id Phasetwo, enabled boolean default true).
  - `listUsers`/`createUser`/`updateUserById`/`deleteUserById` → délèguent à l'API Admin Keycloak (`packages/auth`).
  - **Nouveau** : endpoints équivalents à `authClient.organization.*` (inviteMember, removeMember, updateMemberRole, listTeams, createTeam, addTeamMember, …) implémentés directement :
    - membres/invitations org → proxy API Orgs Phasetwo.
    - teams/teamMembers → CRUD direct sur les tables locales `teams`/`teamMembers`.

- **`apps/control-api/src/app.ts`** :
  - Supprimer le montage `app.all("/auth/*path", ...)`, `/auth/providers`, et tout le bloc `/settings/providers` (CRUD OAuth providers, ~lignes 296-407) — les IdP sont désormais configurés directement dans Keycloak/Phasetwo.
  - `/me` : retourne les infos issues des claims du JWT (forme inchangée pour le front).
  - Ajouter les nouvelles routes orgs/teams décrites ci-dessus.
  - Reste (rate-limit, proxy vers tenant-api, settings/messages, api-tokens) **inchangé**.

---

## Schéma DB — `packages/db/src/schema.control.ts`

**Supprimées** : `users`, `sessions`, `accounts`, `verifications`, `organizations`, `members`, `invitations`, `oauthProviders`.

**Conservées, re-clés (FK vers `users`/`organizations` retirées, colonnes `text` simples)** :
- `teams` (`organizationId`: text, plus de FK)
- `teamMembers` (`userId`: text = `sub` Keycloak, plus de FK)
- `apiTokens` (`userId`, `organizationId`: text, plus de FK)
- `tenantDatabases` (`organizationId`: text PK, plus de FK)
- `siteSettings` (inchangé)

**Nouvelle** : `organizationSettings` (`organizationId` text PK, `enabled` boolean default true) — pour la suspension d'organisation par un platform_admin (Phasetwo n'a pas ce flag).

Générer une migration Drizzle correspondante.

---

## Frontend — `apps/web` & `apps/admin-web`

Même pattern dans les deux apps (chemins représentatifs ci-dessous) :

- **Supprimer** `lib/auth-client.ts` (better-auth/react + plugins).
- **Nouveaux route handlers** :
  - `app/api/auth/login/route.ts` — redirige vers Keycloak (PKCE), pose des cookies courts `pkce_verifier`/`oidc_state`.
  - `app/api/auth/callback/route.ts` — échange le code, pose `access_token`/`refresh_token`/`id_token` (httpOnly), redirige vers `from` ou `/`.
  - `app/api/auth/logout/route.ts` — vide les cookies, redirige vers l'endpoint `end-session` Keycloak.
  - `app/api/auth/refresh/route.ts` — rotation via `refresh_token`.
  - `app/api/auth/me/route.ts` — décode `access_token` (via `packages/auth`), renvoie `{ user, organizations, role }` pour les hooks client.
- **`proxy.ts`** (middleware) : remplace la vérification du cookie `better-auth.session_*` par une vérification de `access_token` (présence/expiration) ; tente un refresh via `/api/auth/refresh` si expiré et `refresh_token` présent, sinon redirige vers `/api/auth/login?from=...`.
- **`app/login/page.tsx`** : simplifié — splash ArchiSpark + message de connexion (`/api/settings/messages`) + bouton "Se connecter" → `/api/auth/login`. Supprime le formulaire username/password et les boutons SSO (gérés par la page Keycloak elle-même).
- **`hooks/use-current-user.ts`** : `useCurrentUser()`/`useIsAdmin()` lisent `/api/auth/me` via `useQuery` (même forme de retour qu'avant).
- **`hooks/use-organization.ts`** : `useOrganizations()` depuis `/api/auth/me` (claim `organization`) ; "organisation active" = cookie non-httpOnly `active_org` lu/écrit côté client, envoyé en en-tête `X-Org-Id` vers control-api ; mutations membres/invitations/teams → nouveaux endpoints control-api (plus `authClient.organization.*`).
- **`components/org-switcher.tsx`** : écrit le cookie `active_org` + invalide les queries (au lieu de `organization.setActive`).
- **`components/user-menu.tsx`** : `signOut()` → `fetch('/api/auth/logout')` puis navigation vers l'URL de logout Keycloak retournée/redirigée.
- **`apps/admin-web/app/authentication/page.tsx`** + fonctions `lib/api.ts` associées → **supprimés** (IdP gérés dans Keycloak/Phasetwo).
- **`apps/admin-web/app/organizations/page.tsx`** + `lib/queries.ts`/`lib/api.ts` → adaptés aux nouveaux endpoints control-api (Phasetwo). Le sélecteur "propriétaire existant" se base sur `/users` (désormais Keycloak).

---

## Variables d'environnement

**Supprimées** : `BETTER_AUTH_SECRET`, `GENERIC_OIDC_*`, `GOOGLE_CLIENT_*`, `GITHUB_CLIENT_*`, `ENTRA_*`, `SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD`, `SEED_CONTRIB_PASSWORD`, `SEED_ARCHI_PASSWORD`, `TRUSTED_ORIGINS`, `COOKIE_DOMAIN` (SSO cross-app géré par la session Keycloak elle-même — à confirmer qu'aucun autre usage n'existe via grep).

**Ajoutées** : `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID_WEB`, `KEYCLOAK_CLIENT_ID_ADMIN_WEB`, `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET`.

**Conservées** : `WEB_URL`/`ARCHISPARK_URL` (base des `redirect_uri` Keycloak), `DATABASE_URL`, `TENANT_*`, `REDIS_URL` (Redis reste utilisé pour le rate-limiting, plus pour les sessions auth).

À répercuter dans `.env.example`, `.docker/docker-compose.yml`, `.docker/docker-compose.dev.yml`, et `turbo.json` (`tasks.dev.passThroughEnv`).

---

## Seed / démo

- `packages/db/scripts/seed-demo.ts` : `SELECT id FROM organization ...` (table supprimée) → remplacé par un appel à l'API Orgs Phasetwo via `packages/auth` (client_credentials + `listOrganizations`) pour récupérer le premier org id.
- `.github/workflows/seed-demo.yml` : ajouter les nouvelles variables `KEYCLOAK_*` nécessaires au script.

---

## Nettoyage (dépendances & fichiers)

- Retirer `better-auth` de `apps/control-api/package.json`, `apps/web/package.json`, `apps/admin-web/package.json`.
- Supprimer `apps/control-api/src/better-auth.ts`, `apps/web/lib/auth-client.ts`, `apps/admin-web/lib/auth-client.ts`, `apps/admin-web/app/authentication/**`.
- `apps/tenant-api/src/openapi.ts:732` — corriger la doc OpenAPI (nom de cookie `better-auth.session_token` → `access_token`).
- Mettre à jour `README.md` (section auth/setup) selon la consigne du projet.

---

## Points à vérifier pendant l'implémentation (spécificités Phasetwo)

1. Nom/tag exact de l'image Docker Phasetwo Keycloak pour la parité locale avec phasetwo.io.
2. Endpoints/payloads exacts de l'API Orgs Phasetwo (orgs, membres, invitations, rôles d'org, attributs) — doc p2-inc/keycloak-orgs ou phasetwo.io.
3. Forme exacte du claim `organization` injecté dans l'access token (mapper Phasetwo) — nécessaire pour résoudre org/rôle sans appel API à chaque requête (cookies JWT purs).
4. Limites du plan gratuit phasetwo.io (MAU, attributs custom, disponibilité de l'API Admin/service account).
5. Import des organisations/memberships de démo : via `realm-export.json` standard ou script post-démarrage appelant l'API Orgs.

---

## Ordre d'implémentation recommandé

1. `packages/auth` (squelette) + Keycloak local (Docker + realm-export : clients, rôle realm, utilisateurs démo) — login Keycloak fonctionnel, JWT émis.
2. control-api en resource server JWT (`requireAuth`/`requireSuperAdmin`/`/me`), suppression du montage `/auth/*` — organisations/teams encore sur l'ancien schéma pour ne pas tout casser en même temps.
3. `web`/`admin-web` : route handlers OIDC + middleware + login page + `use-current-user` — flux de connexion bout-en-bout opérationnel.
4. Migration Organisations → Phasetwo (endpoints control-api, suppression `organizations`/`members`/`invitations`, `teams` réimplémentées localement, pages admin-web orgs/org-switcher).
5. Provisioning utilisateurs via API Admin Keycloak (création propriétaire d'org, page `/users`).
6. Nettoyage final : dépendances, variables d'env, suppression `/authentication` (providers), `seed-demo.ts`, migration Drizzle (drop tables), README.
7. `vitest-coverage-enforcer` + `pnpm turbo run lint typecheck` (process de release du projet).

---

## Vérification end-to-end

- `make dev-infra` démarre postgres/redis/keycloak ; Keycloak importe le realm avec utilisateurs/orgs démo.
- `pnpm dev` → `localhost:8000/login` → "Se connecter" → page Keycloak → callback → cookies posés → `/` affiche l'utilisateur (rôle, org active).
- Org switcher liste les organisations Phasetwo du token ; bascule met à jour `active_org` et le contenu workspaces.
- admin-web `/organizations` : création d'org → appel Phasetwo + provisioning Neon/tenant DB inchangé.
- Utilisateur avec rôle org "member" : confirmer le 403 sur les écritures (`requireWorkspaceWrite`).
- Tokens API personnels (`apiTokens`) et MCP server : flux Bearer inchangé, vérifié avec un token existant.
