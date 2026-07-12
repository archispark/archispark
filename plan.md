# Isolation multi-tenant : un realm Keycloak par client

## Contexte

L'objectif à terme est de vendre ArchiSpark comme des plateformes **dédiées
par client** (API + web + Postgres séparés par client) sur un Keycloak
mutualisé pour l'identité.

Une première itération de ce plan envisageait un Keycloak **SaaS** (Phase
Two Cloud ou Cloud-IAM) mutualisé, avec la question de savoir si un realm
par client y serait facturé/limité — une recherche de pricing avait montré
que ce n'était pas le cas chez ces deux fournisseurs. **Décision retenue :
on n'utilise pas de SaaS ni la distribution Phase Two de Keycloak** (le
fork `quay.io/phasetwo/phasetwo-keycloak` embarquait un plugin
"organizations" devenu inutile depuis la suppression du multi-tenant côté
app). Le Keycloak mutualisé est un **Keycloak "classic" self-hosté**
(image officielle `quay.io/keycloak/keycloak`, la même qu'en dev local —
voir `.docker/docker-compose.dev.yml`), déployé une fois et partagé par
tous les clients ; aucun fournisseur SaaS n'est requis pour ce plan.

**Ce plan bascule donc sur l'architecture la plus simple : un realm Keycloak
par client.** L'isolation devient native (chaque realm est un namespace
d'identité totalement séparé — utilisateurs, rôles, Identity Providers,
sessions, JWKS/issuer distincts), et **aucune modification de code
applicatif n'est nécessaire** : `packages/auth/src/verify.ts:31-42`
(`verifyAccessToken`) valide déjà l'`issuer` du token
(`${url}/realms/${realm}`), qui inclut le nom du realm — un token émis pour
le realm `archispark-acme` est donc automatiquement rejeté par une instance
`apps/api` configurée avec `KEYCLOAK_REALM=archispark-other`, sans rien à
coder.

La branche `refactor/remove-multi-tenant` retire toute notion
d'organisation/tenant de l'application elle-même (`apps/tenant-api`,
`apps/control-api`, `apps/admin-web`, `packages/auth/src/orgs.ts`
supprimés) — ce plan la respecte : zéro logique de tenant côté app, toute
la séparation vit dans la configuration Keycloak/déploiement. Le realm
`archispark` de référence (`.docker/keycloak/realm-export.json`) a été
nettoyé du mapper `oidc-organization-role-mapper` et de l'attribut
`_providerConfig.orgs.*`, spécifiques au plugin Phase Two et incompatibles
avec un Keycloak classic.

**Prérequis avant d'onboarder plusieurs clients en production** :
dimensionner/héberger soi-même l'instance Keycloak partagée (VM, cluster
K8s...) — contrairement à un SaaS, il n'y a pas de limite de realms
contractuelle à vérifier, mais la capacité (CPU/mémoire/DB) de l'instance
self-hosted doit être dimensionnée en fonction du nombre de realms/clients.

## Approche

1. **Un realm Keycloak par client** (`archispark-<tenant>`), créé avec l'outil
   déjà existant du repo — `packages/db/scripts/setup-realm.ts` est déjà
   paramétré par `KEYCLOAK_REALM` et ne fait aucune hypothèse sur un nom de
   realm fixe : il crée le realm cible depuis `.docker/keycloak/realm-export.json`
   (clients `archispark-web`/`archispark-api`, rôle `platform_admin`, service
   account) s'il n'existe pas, ou applique les mêmes ressources en idempotent
   via `partialImport` sinon. **Aucun nouveau script n'est nécessaire.**
2. Chaque déploiement `apps/api`/`apps/web` du tenant pointe simplement vers
   son propre realm via les env vars déjà existantes :
   `KEYCLOAK_URL` (le même Keycloak self-hosté classic mutualisé pour tous),
   `KEYCLOAK_REALM=archispark-<tenant>`, `KEYCLOAK_CLIENT_ID_WEB=archispark-web`,
   `KEYCLOAK_ADMIN_CLIENT_ID`/`KEYCLOAK_ADMIN_CLIENT_SECRET` (le service
   account créé dans ce realm à l'étape 1).
3. **SSO Google/Microsoft par client** : chaque realm a ses propres Identity
   Providers (menu *Identity providers* de la console admin, ou via l'API
   Admin) — isolation automatique, aucun risque qu'un IdP configuré pour un
   client soit visible/utilisable par un autre, contrairement au modèle à
   realm partagé qui aurait demandé de restreindre l'IdP par flow.
4. `packages/db/scripts/seed-demo-users.ts` fonctionne déjà par realm (mêmes
   env vars) — réutilisable tel quel pour peupler les comptes initiaux d'un
   tenant si besoin.

## Runbook d'onboarding d'un nouveau tenant

1. Créer le realm du tenant :
   ```bash
   KEYCLOAK_URL=<url du Keycloak self-hosté partagé> \
   KEYCLOAK_REALM=archispark-<tenant> \
   KEYCLOAK_SETUP_AUTH_REALM=master \
   KEYCLOAK_SETUP_USERNAME=<admin master> \
   KEYCLOAK_SETUP_PASSWORD=<mot de passe> \
   pnpm --filter @workspace/db setup:realm
   ```
   (ou `KEYCLOAK_SETUP_AUTH_REALM=archispark-<tenant>` + un admin de ce realm
   si le compte ne donne pas accès à `master`, cas déjà documenté dans
   les commentaires de `setup-realm.ts`).
2. Récupérer le secret du service account `archispark-api` généré dans ce
   realm (console admin → Clients → `archispark-api` → Credentials).
3. Provisionner la DB Postgres dédiée du tenant, appliquer les migrations.
4. Déployer les projets `archispark-api`/`archispark-web` du tenant avec :
   `DATABASE_URL` (DB du tenant), `KEYCLOAK_URL`, `KEYCLOAK_REALM=archispark-<tenant>`,
   `KEYCLOAK_CLIENT_ID_WEB=archispark-web`, `KEYCLOAK_ADMIN_CLIENT_ID`/`_SECRET`.
5. (Optionnel) Peupler des comptes initiaux :
   `KEYCLOAK_REALM=archispark-<tenant> pnpm --filter @workspace/db seed:demo-users`
   ou créer les vrais utilisateurs via la console admin/API.
6. (Optionnel) Configurer le SSO du tenant : console admin → Identity
   providers → ajouter Google / Microsoft (Entra ID) / autre OIDC-SAML,
   propre à ce realm.
7. Redéployer, tester la connexion de bout en bout.

## Vérification

- **Aucun changement de code** → aucun nouveau test unitaire requis ; les
  suites existantes (`pnpm run -w test`) ne sont pas affectées.
- **Isolation réelle à vérifier une fois (preuve du modèle)** : créer deux
  realms locaux (`archispark-test1`, `archispark-test2`) via `setup:realm`,
  configurer deux instances `apps/api` locales avec chacune son
  `KEYCLOAK_REALM`, obtenir un token valide sur `archispark-test1` et
  l'envoyer en Bearer à l'instance configurée sur `archispark-test2` — doit
  renvoyer 401 (`verify.ts` rejette sur l'`issuer` sans rien à coder).
- **Bout en bout console admin** : via
  `mcp__plugin_playwright_playwright__browser_navigate`, exécuter le runbook
  ci-dessus sur le Keycloak local (`http://localhost:8080`) pour un tenant de
  test, vérifier la création du realm, du client, du service account, et la
  configuration d'un Identity Provider Google/Microsoft de test.

## Fichiers concernés (implémenté)

- `packages/db/scripts/setup-realm.ts` (réutilisé tel quel, doc-comment mis à jour)
- `.docker/keycloak/realm-export.json` (gabarit du realm — mapper/attribut
  Phase Two "organizations" retirés, incompatibles avec Keycloak classic)
- `.docker/docker-compose.dev.yml` (image `quay.io/phasetwo/phasetwo-keycloak`
  → `quay.io/keycloak/keycloak`, distribution classic)
- `packages/db/scripts/seed-demo-users.ts` (réutilisé tel quel, doc-comment mis à jour)
- `docs/authentication.md` (section "One Keycloak realm per client" ajoutée)
- `docs/deployment.md` (section "Onboarding d'un nouveau client" ajoutée,
  runbook complet)
- `.env.example`, `packages/db/src/schema.ts`, `docs/installation.md`,
  `Makefile` (mentions "Phasetwo" retirées ; note que `KEYCLOAK_REALM`
  varie par déploiement)

Non modifié : aucun changement de code applicatif (`packages/auth`,
`apps/api`, `apps/web`) — conforme au plan, l'isolation vient uniquement de
la configuration Keycloak.
