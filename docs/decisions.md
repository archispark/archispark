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
