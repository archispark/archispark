# Journal des décisions

Format :

```
## AAAA-MM-JJ — Titre

**Contexte** : ...

**Décision** : ...

**Conséquences** : ...
```

Ajouté par Claude sur validation humaine, ou à la main. Ce journal n'est
pas chargé à chaque session — consulté à la demande (voir la référence
dans [CLAUDE.md](../CLAUDE.md)).

## 2026-07-12 — Organisation → Workspace multi-tenant (Postgres natif)

**Contexte** : la branche `refactor/remove-multi-tenant` avait supprimé
le jour même un modèle multi-tenant antérieur (migration
`0017_remove_multi_tenancy.sql`), au profit d'une isolation par instance
dédiée + un realm Keycloak par client. L'utilisateur est revenu sur cette
décision en session : il veut une offre SaaS partagée (Organisation →
Workspaces) **en plus** de l'offre instance dédiée, sans reprendre
l'ancienne implémentation (ni séparation physique control-DB/tenant-DB, ni
stockage des organisations dans le plugin Keycloak Phase Two).

**Décision** : les organisations vivent entièrement dans Postgres
(tables `organizations`/`organization_members`/`user_active_organization`),
Keycloak reste « classic » sans réintroduire Phase Two. Quatre rôles :
`platform_admin` (rôle realm Keycloak, administre les organisations sans
aucun accès à leur contenu — isolation **structurelle**, appliquée une
seule fois dans `apps/api/src/access.ts` plutôt que route par route),
`owner`/`admin`/`member` (lignes `organization_members`). Passerelle
d'autorisation unique (`access.ts`) partagée en process par `apps/api` et
`apps/mcp-server`. Migration en quatre étapes
(expand→backfill→verify→contract) : `0018_organizations_expand.sql` ajoute
les nouvelles tables et colonnes nullables, un backfill idempotent
(`packages/db/src/backfill-organizations.ts`, exécuté automatiquement au
démarrage) crée une organisation personnelle par utilisateur existant et
y rattache ses workspaces/tokens, la migration de contraction
(`0019_organizations_contract.sql`, `NOT NULL`) n'est générée qu'après
vérification en environnement cible — délibérément absente de cette
release. Jetons API personnels scopés par organisation
(`api_tokens.organization_id`, requis à la création) ; le rôle
`owner`/`admin`/`member` n'est jamais figé sur le jeton, toujours résolu
en direct.

**Conséquences** : `access.ts` devient le point de passage obligé pour
toute vérification d'accès organisation/workspace — ne jamais requêter
`organization_members` ailleurs pour une décision d'autorisation. Un
utilisateur solo n'a aucune friction supplémentaire (organisation
personnelle auto-créée à la première création de workspace). Compatible
avec l'offre instance dédiée existante (un realm Keycloak par client
continue de fonctionner ; les organisations sont orthogonales à cette
isolation). `.claude/rules/api.md` documente désormais la convention
d'erreur à deux niveaux (`NotFoundError`/`ForbiddenError`) exclusivement
depuis `access.ts`.

## 2026-07-13 — Nettoyage auto-cicatrisant des organisations démo retirées

**Contexte** : le seed démo est passé de 2 organisations à workspace
unique (`archisurance`/`archimetal`) à 2 organisations regroupant
plusieurs workspaces (`archi` → ArchiSurance + ArchiMetal, `open` → Open
Day, voir `packages/db/seeds/demo-orgs.json`). Le workflow GitHub Actions
`seed-demo.yml` supprime les workspaces démo **par nom** (`WHERE name IN
(...)`), sans connaître leur organisation — après le renommage de slug,
ça a vidé les anciennes organisations `archisurance`/`archimetal` sans les
supprimer. Le pointeur `user_active_organization` du compte démo `archi`
restait figé sur l'une de ces organisations désormais vide, masquant les
workspaces réellement présents dans la nouvelle organisation `archi`
(corrigé manuellement en production via `POST /organizations/:id/activate`
puis `DELETE /organizations/:id`).

**Décision** : `packages/db/seeds/demo-orgs.json` gagne une clé
`legacySlugs` listant les anciens slugs retirés. `seed-demo.ts` supprime,
à chaque exécution, toute organisation dont le slug figure dans
`legacySlugs` **et qui ne contient plus aucun workspace** (garde-fou
`NOT EXISTS (SELECT 1 FROM workspaces …)` — ne touche jamais une
organisation qui contiendrait encore du contenu réel). `organizations` a
déjà `ON DELETE CASCADE` sur `organization_members`/
`user_active_organization` : supprimer l'organisation vide efface aussi
le pointeur d'org active périmé, qui se re-résout automatiquement vers une
organisation valide au prochain chargement (`resolveActiveOrganizationId`
choisit alors l'organisation restante la plus petite) — sans action
manuelle.

**Conséquences** : toute future refonte des organisations/workspaces démo
doit ajouter l'ancien slug à `legacySlugs` dans le même changement — le
seed devient alors auto-cicatrisant au lieu de nécessiter une correction
manuelle en production comme ici. Le garde-fou "zéro workspace" est
volontairement strict : jamais de suppression aveugle par simple absence
dans la liste courante, seulement par slug explicitement retiré.

## 2026-07-14 — Invitations d'organisation par e-mail (offre SaaS mutualisée)

**Contexte** : `addMember` (`apps/api/src/organizations-store.ts`) exigeait
un username Keycloak déjà existant — limitation documentée du v1. Ça
cassait l'onboarding self-service de l'offre SaaS mutualisée : un `owner`
ne pouvait ajouter que quelqu'un qui avait déjà un compte, et le realm
`archispark` avait `registrationAllowed: false`, donc personne ne pouvait
créer de compte tout seul.

**Décision** : auto-inscription Keycloak activée sur le realm mutualisé
uniquement + invitation par **token** (pas par username). Points clés,
chacun avec un "pourquoi" qu'une prochaine session ne doit pas défaire par
inadvertance :

- **Username → email + token** plutôt que de simplement assouplir
  `addMember` : l'invité n'a par définition pas encore de compte, il faut
  donc un identifiant qui ne dépend pas d'un compte existant (l'e-mail) et
  une preuve d'intention côté organisation (le token), pas juste un
  contrôle a posteriori.
- **Le token est hashé (SHA-256) en base, jamais stocké en clair** —
  contrairement à `apiTokens.token` (relu/affiché à l'utilisateur), un
  token d'invitation n'est jamais relu, seulement comparé au hash reçu.
  Coût nul, réduit l'impact d'une fuite de base/logs/sauvegarde.
- **Pas de création de compte Keycloak déclenchée par l'API par défaut** —
  l'invité s'inscrit via le flux Keycloak normal (auto-inscription +
  e-mail/mot de passe ; SSO plus tard, voir point ouvert ci-dessous).
  `packages/auth/src/admin-users.ts` a déjà `createKeycloakUser`, mais ce
  chemin n'est délibérément pas utilisé ici : la vérification native
  Keycloak de l'e-mail à l'inscription est plus solide qu'un provisioning
  API suivi d'un envoi de mot de passe.
- **`access.ts`/`assertOrgAccess` n'est pas utilisé pour la preview
  (`GET /invitations/:token`) ni l'acceptation
  (`POST /invitations/:token/accept`)** — exception délibérée au principe
  "toute autorisation passe par access.ts" : l'invité n'est par définition
  pas encore membre, donc rien à vérifier côté `organization_members`. La
  garde est le triplet authentification (toujours `requireAuth`, mounté
  globalement — un appelant non authentifié reçoit 401 avant même que le
  token soit examiné) + token valide/non expiré + e-mail Keycloak
  **vérifié** et identique à l'e-mail invité. `access.ts` reste seul point
  de passage pour ce qui _est_ déjà une vérification d'appartenance
  (création/liste/révocation/renvoi, qui passent par
  `assertOrgAccess(..., "manage_members")`).
- **`KEYCLOAK_SELF_REGISTRATION`/`KEYCLOAK_VERIFY_EMAIL` sont des flags de
  provisioning (env vars lues par `setup-realm.ts`), pas des valeurs
  statiques de `realm-export.json`** — ce fichier provisionne
  indifféremment le realm mutualisé et chaque realm dédié client ; un flag
  statique `registrationAllowed: true` dedans aurait activé
  l'auto-inscription publique sur _tous_ les realms dédiés provisionnés
  avec ce script, ce qui contredit le modèle d'isolation "instance
  dédiée". `duplicateEmailsAllowed: false` suit `KEYCLOAK_SELF_REGISTRATION`
  plutôt que d'être un réglage indépendant, car c'est précisément
  l'auto-inscription qui crée le risque de doublon d'email.

**Conséquences** : une seule invitation active par (organisation, email),
garantie par un index unique partiel Postgres
(`org_invitations_org_email_active_uniq`), pas seulement une révocation
applicative — ferme la course entre deux créations concurrentes. Points
ouverts, explicitement hors scope de cette implémentation :

- Quand Google/Microsoft seront activés (chantier séparé), la stratégie de
  _First Broker Login_/liaison de compte devra être définie et testée
  avant d'exposer ces IdP — `duplicateEmailsAllowed: false` empêche la
  création d'un doublon mais ne résout pas, à lui seul, le cas d'un compte
  local existant qui se connecte ensuite via un IdP avec le même email.
- `registrationAllowed` sur le realm mutualisé expose un formulaire
  d'inscription public, donc un vecteur de spam/robots. Pas bloquant pour
  ce lancement (pas de trafic public significatif à ce stade), mais à
  traiter avant une exposition large : au minimum un rate limiting
  applicatif ou au niveau du reverse proxy sur
  `/realms/archispark/protocol/openid-connect/registrations`, et si
  nécessaire un CAPTCHA/anti-bot Keycloak.
