# AGENTS.md

Consignes pour les agents qui modifient ArchiSpark.

## Avant de modifier le dépôt

1. Localiser le domaine concerné à l'aide de la carte ci-dessous.
2. Lire la documentation d'architecture liée aux changements transverses.
3. Identifier les tests et la documentation produit à mettre à jour.
4. Après modification, exécuter les vérifications les plus ciblées, puis les
   vérifications globales adaptées à la portée du changement.

## Carte du dépôt

ArchiSpark est un monorepo pnpm/Turborepo (Node >= 22.13 ; `.nvmrc` utilise
Node 24).

```text
.
├── apps/
│   ├── server/       Application Next.js : interface, API REST et serveur MCP
│   └── docs/         Documentation et page d'accueil publique
├── packages/
│   ├── auth/         Helpers Keycloak partagés
│   ├── db/           Schéma Drizzle, migrations et données initiales
│   ├── db-neo4j/     Export des modèles ArchiMate vers Neo4j
│   ├── eslint-config/ Configuration ESLint partagée
│   ├── types/        Types TypeScript partagés
│   ├── typescript-config/ Configurations TypeScript partagées
│   └── ui/           Composants React partagés
├── models/           Modèles ArchiMate, XSD et ressources de référence
├── .docker/          Environnement Docker de développement
├── .github/          Workflows et modèles GitHub
├── docs/             Documentation technique historique du dépôt
├── package.json      Scripts et dépendances racine
├── pnpm-workspace.yaml
└── turbo.json
```

### Application principale : `apps/server`

Cette application Next.js regroupe :

- l'interface des espaces de travail ;
- l'API REST sous `app/api/**`, avec les Route Handlers de l'App Router ;
- le serveur MCP dans `pages/api/mcp.ts`. Conserver cette route dans le Pages
  Router : `StreamableHTTPServerTransport` requiert les objets Node bruts
  `http.IncomingMessage` et `ServerResponse` ;
- la logique métier dans `lib/archimate/`, `lib/mcp/` et `lib/dashboards/`.

Ces modules sont importés directement par l'API REST et le serveur MCP : ils ne
forment pas des packages indépendants.

Les espaces de travail appartiennent à une organisation. Les rôles
d'organisation sont `owner`, `editor` et `viewer`. Le rôle de royaume
`platform_admin` donne un accès total et indépendant aux pages
`/platform/**` (organisations, utilisateurs, plugins, bibliothèque
d'images), protégées par `withSuperAdmin` seul. Pour le contenu applicatif
d'une organisation (espaces de travail, vues, éléments, tableaux de bord),
`platform_admin` est un utilisateur comme un autre : il doit être membre
réel (`owner`, `editor` ou `viewer` dans `organization_members`) — ce qu'il
peut obtenir en s'ajoutant lui-même depuis la gestion des membres sur
`/platform/organizations/[id]` — et suit alors les mêmes règles que
n'importe quel membre, y compris le refus d'accès sur une organisation
suspendue. `apps/server/lib/archimate/access.ts` est l'unique point
d'entrée pour les contrôles d'autorisation : ne pas dupliquer cette logique
ailleurs.

### Données et services partagés

- `packages/db` contient le schéma Drizzle de la base partagée, les migrations
  et les scripts de données.
- `packages/db-neo4j` (`@workspace/db-neo4j`) contient le pilote, les migrations
  Cypher versionnées et le mappage `ArchiModel -> Cypher` utilisé par
  `POST /api/export/neo4j`.
- `packages/auth` (`@workspace/auth`) contient les helpers Keycloak partagés.
- `packages/ui` et `packages/types` contiennent respectivement les composants
  React et les types partagés.

Avant toute modification transverse de l'authentification ou de la base de
données, lire
[architecture.md](apps/docs/content/docs/developer-guide/development/architecture.md) et
[authentication.md](apps/docs/content/docs/developer-guide/reference/authentication.md).
Consulter aussi les sections sur les
[tableaux de bord](apps/docs/content/docs/developer-guide/development/architecture.md#dashboards)
et
[l'export Neo4j](apps/docs/content/docs/developer-guide/development/architecture.md#neo4j-export)
selon le domaine modifié.

## Commandes

### Installation et développement

```bash
pnpm install
pnpm env
pnpm infra:up   # infrastructure Docker (étape séparée, jamais lancée par dev/start)
pnpm dev        # Turbo en hot reload, serveur uniquement : :8000
pnpm dev:docs   # documentation Fumadocs en hot reload : :3000
pnpm stop       # arrête l'infrastructure de développement

pnpm build       # compile tous les workspaces avant le démarrage de production local
pnpm start       # application principale compilée sur :8000 ; ne démarre pas Docker
pnpm start:docs  # documentation Fumadocs compilée sur :3000
```

Après `pnpm env`, renseigner au minimum `DB_PASSWORD` et
`KEYCLOAK_ADMIN_CLIENT_SECRET` dans `.env.dev`.

Pour Docker et Vercel, consulter
[installation.md](apps/docs/content/docs/developer-guide/getting-started/index.md) et
[deployment.md](apps/docs/content/docs/developer-guide/development/deployment.md).

### Vérifications

```bash
pnpm build      # compilation de tous les workspaces
pnpm lint       # ESLint via Turborepo
pnpm typecheck  # TypeScript sans émission
pnpm format     # Prettier via Turborepo
```

### Tests

```bash
pnpm run -w test                   # suite complète avec couverture
pnpm --filter server test          # tests de l'application principale
pnpm --filter server test:watch    # mode surveillance
pnpm --filter server test:coverage # couverture de l'application
```

Depuis `apps/server`, cibler un fichier, un test ou un projet Vitest :

```bash
pnpm vitest run lib/archimate/store.test.ts
pnpm vitest run -t "creates a workspace with empty model"
pnpm vitest run --project server
pnpm vitest run --project web
```

`vitest.config.ts` définit deux projets :

- `web` utilise jsdom pour les composants et pages React ;
- `server` utilise Node pour la logique métier et les Route Handlers.

Les tests utilisent PGlite, donc Docker n'est pas requis. Ne jamais placer de
fichier `*.test.ts` dans `apps/server/pages/api/` : Next.js le traiterait comme
une route active.

Une suite Playwright distincte (`apps/server/e2e/`) fait tourner un build réel
dans un navigateur, en comptes locaux uniquement (pas de Keycloak). Elle
nécessite Docker (son `webServer` démarre un conteneur Postgres jetable) et un
build préalable :

```bash
pnpm --filter server exec playwright install chromium  # une fois
pnpm --filter server build
pnpm --filter server test:e2e
```

## Règles de modification

### Code

- Respecter Prettier : pas de point-virgule, guillemets doubles, indentation de
  2 espaces et largeur de 80 colonnes.
- Conserver le mode TypeScript `strict` et `noUncheckedIndexedAccess`.
- Limiter les fichiers à 250 lignes de code, hors lignes vides et commentaires.
  La règle ESLint `max-lines` n'est qu'un avertissement à cause de
  `eslint-plugin-only-warn` : vérifier la taille explicitement et scinder les
  modules plutôt que désactiver la règle.
- Valider les types d'éléments et de relations contre les ensembles
  ArchiMate 3.1 définis dans `models/xsd`.

### Ressources graphiques de référence

- `models/img/archimate/` contient les composants PNG de référence. Ne jamais y
  écrire d'images générées, ni ajouter d'images générées ailleurs dans le dépôt.
- `models/img/views/` contient les SVG exportés par Archi et constitue la
  référence visuelle. Pour modifier
  `apps/server/lib/archimate/renderer.ts`, comparer le rendu au SVG
  correspondant et minimiser les écarts de formes, couleurs, disposition,
  connecteurs, libellés et polices.

### Captures d'écran produit

- `apps/docs/public/screenshots/` contient les captures utilisées par
  `README.md`, la landing page (`apps/docs/app/(home)/page.tsx`) et les pages
  Fumadocs sous `apps/docs/content/docs/`.
- Toute capture ajoutée ou remplacée doit avoir une ligne à jour dans
  `apps/docs/public/screenshots/SOURCES.md` (route, compte/rôle, source,
  viewport, date) — c'est ce qui permet de la reproduire à l'identique.
- Capturer depuis `https://demo.archispark.cloud/` par défaut ; si la
  fonctionnalité n'y est pas accessible (compte manquant, données absentes),
  utiliser un environnement local seedé (`pnpm seed:demo-users` puis
  `pnpm seed:demo`, `KEYCLOAK_SSO_ENABLED=true`) et le noter dans la colonne
  « Source » de `SOURCES.md`.
- Viewport 1400×900, thème clair, badge Next.js dev tools masqué avant la
  capture (`[data-nextjs-dev-tools-button], nextjs-portal` en
  `display:none`) — il n'existe qu'en `pnpm dev`, jamais dans le build livré.
- Ne jamais laisser de token, e-mail ou autre donnée personnelle réelle
  visible dans une capture.
- Mettre à jour la capture existante (même nom de fichier) plutôt que d'en
  ajouter une nouvelle quand seule l'UI change.

## Documentation versionnée avec le code

La documentation fait partie du produit. Dans le même changement que le code :

- rester concis et éviter la prose : privilégier des tableaux, des listes et,
  pour illustrer une architecture ou un flux, un schéma ReactFlow plutôt que
  des paragraphes descriptifs ;
- rédiger en anglais tout le contenu de `apps/docs/content/docs/` ainsi que la
  landing page `apps/docs/app/(home)/page.tsx`, y compris les titres,
  descriptions, libellés, exemples et textes alternatifs ;
- mettre à jour les guides, références API/MCP, exemples et schémas affectés ;
- modifier `README.md` si le démarrage rapide, les prérequis ou la navigation
  changent ;
- documenter uniquement le comportement livré, y compris ses limites et effets
  de bord ;
- vérifier que les commandes, chemins, liens et exemples restent exacts ;
- relire ensemble le code et la documentation avant de terminer.

Utiliser cette table pour trouver la documentation concernée :

| Changement                                                                | Emplacement à vérifier                                                                          |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Positionnement produit, fonctionnalités, captures, liens ou connexion MCP | `apps/docs/app/(home)/page.tsx`                                                                 |
| Structure et parcours de la documentation                                 | `apps/docs/content/docs/meta.json`, `apps/docs/next.config.mjs` (redirection `/docs`)           |
| Prérequis, installation, configuration ou usage                           | `apps/docs/content/docs/developer-guide/getting-started/`, `apps/docs/content/docs/user-guide/` |
| API, MCP, authentification ou ArchiMate                                   | `apps/docs/content/docs/developer-guide/reference/`                                             |
| Architecture, déploiement ou contribution                                 | `apps/docs/content/docs/developer-guide/development/`                                           |
| Administration, configuration ou permissions                              | `apps/docs/content/docs/admin-guide/`                                                           |
| Ajout, déplacement ou suppression d'une page                              | `meta.json` du dossier concerné                                                                 |
