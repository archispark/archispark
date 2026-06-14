# Suppression complète de Redis

## Contexte

Depuis la migration Keycloak, Redis n'est plus utilisé que pour le rate-limiting applicatif
(`rate-limit-redis` dans `control-api` et `tenant-api`) et une page de statut admin
(`/settings/redis`, `apps/admin-web/app/redis`). Le stockage de sessions a déjà été retiré.

**Décisions actées** :
- Suppression totale de Redis (service, dépendances, code, infra, doc).
- Suppression du rate-limiting applicatif (`apiRateLimit`/`importRateLimit`) — remplacé par
  **Cloudflare Rate Limiting** en amont (hors périmètre de ce repo).
- Le rate-limiting applicatif ne peut pas être délégué à Keycloak/Phasetwo : Keycloak ne voit
  que ses propres endpoints d'authentification (avec sa propre protection brute-force), jamais
  les routes métier de control-api/tenant-api qui reçoivent un JWT déjà validé localement.

---

## 1. Backend `control-api`

- Supprimer `src/redis.ts`, `src/redis.test.ts`.
- `src/app.ts` : retirer imports `RedisStore`/`getRedis`/`rateLimit`, la fonction `redisStore()`,
  `apiRateLimit` + `app.use(apiRateLimit)`, et l'endpoint `GET /settings/redis`.
- `src/main.ts` : retirer `initRedis`, passer à un import statique de `app.js` (plus besoin de
  l'import dynamique différé).
- `api/index.ts` : retirer l'appel `initRedis`.
- `src/test-setup.ts` : retirer le mock `./redis.js`.
- `src/organizations.test.ts` : retirer le bloc `describe("GET /settings/redis")`.
- Supprimer `scripts/reset-rate-limit.ts` (obsolète).
- `package.json` : retirer `ioredis`, `rate-limit-redis`, `express-rate-limit`.

## 2. Backend `tenant-api`

- Supprimer `src/redis.ts`, `src/redis.test.ts`.
- `src/app.ts` : retirer imports `RedisStore`/`getRedis`/`rateLimit`, `redisStore()`,
  `importRateLimit`, `apiRateLimit`, `app.use(apiRateLimit)`, et le middleware sur `POST /import`.
- `src/main.ts` : retirer `initRedis`, import statique.
- `api/index.ts` : retirer `initRedis`.
- `src/test-setup.ts` : retirer le mock.
- `package.json` : retirer `ioredis`, `rate-limit-redis`, `express-rate-limit`.

## 3. Frontend `apps/web`

- `lib/api.ts` : retirer `RedisStatus`/`fetchRedisStatus` (code mort, aucune page ne l'utilise).
- `lib/api.test.ts` : retirer les tests associés.
- i18n (en/fr/de/es/it) : retirer la clé `settings.tab_redis`, retirer "Redis" de `admin.desc`.

## 4. Frontend `apps/admin-web`

- Supprimer `app/redis/page.tsx` + `page.test.tsx`.
- `lib/api.ts` + `lib/api.test.ts` : idem apps/web.
- `components/admin-sidebar.tsx` : retirer l'entrée `/redis` + l'import `Database` (devenu
  inutile) ; `admin-sidebar.test.tsx` : retirer l'assertion correspondante.
- `components/nav.tsx` : retirer `redis: "settings.tab_redis"`.
- i18n (en/fr/de/es/it) : idem.

## 5. Docker Compose

- `.docker/docker-compose.yml` : retirer le service `redis`, le volume `redis_data`, les
  `depends_on: redis` (control-api, tenant-api) et les env `REDIS_URL`/`REDIS_PASSWORD`
  (control-api, tenant-api, mcp-server).
- `.docker/docker-compose.dev.yml` : retirer le service `redis` + volume `redis_dev_data`,
  mettre à jour les commentaires ("Postgres + Redis" → "Postgres").

## 6. Helm chart

- Supprimer `templates/redis.yaml`.
- `_helpers.tpl` : retirer `archispark.redisUrl`.
- `api.yaml`, `mcp-server.yaml` : retirer les env `REDIS_PASSWORD`/`REDIS_URL`.
- `secrets.yaml` : retirer la clé `REDIS_PASSWORD`.
- `values.yaml` : retirer la section `redis:` et `secrets.redisPassword`.
- `Chart.yaml` : mettre à jour la description (retirer "+ redis").

## 7. Config / env

- `turbo.json` : retirer `REDIS_URL` de `passThroughEnv`.
- `.env.example` : retirer tout le bloc Redis.

## 8. README.md

- Retirer la ligne "Cache | Redis" du tableau d'architecture.
- Retirer le paragraphe sur Redis requis / reset des compteurs rate-limit.
- Mettre à jour les descriptions docker-compose / Helm / `make dev-infra`.
- Retirer `REDIS_URL` du tableau des variables d'env et `/redis` du tableau des endpoints admin.

## 9. Validation

- `pnpm turbo run lint typecheck` + suites de tests affectées (control-api, tenant-api, web,
  admin-web).
- Pas de `vitest-coverage-enforcer` (réservé aux releases, cf. CLAUDE.md).
