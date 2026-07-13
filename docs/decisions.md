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
