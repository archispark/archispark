---
paths:
  - "apps/server/app/api/**"
  - "apps/server/lib/archimate/**"
  - "apps/server/lib/http/**"
  - "apps/server/pages/api/**"
---

# API conventions (`apps/server`)

- **Error envelope**: every error response is `{ detail: "<message>" }`
  — not `{ error }` or `{ message }`. Error strings are written **in
  French** (e.g. `"Aucun workspace disponible."`) — match that, don't
  default to English.
- **Error classes**: `AppError`/`NotFoundError` (404)/`ValidationError`
  (422)/`ForbiddenError` (403)/`UnauthorizedError` (401) in
  `lib/archimate/errors.ts`, thrown from handlers/`store.ts`/`registry.ts`/
  `auth.ts`, caught by `lib/http/with-error-handling.ts`'s `withErrorHandling`
  wrapper (composed as `withErrorHandling(withAuth(handler))` on every Route
  Handler), which maps `AppError.statusCode` to the JSON response.
  Non-`AppError` throws fall through to a generic 500.
- **Auth is a wrapper, not global middleware.** `lib/http/with-auth.ts`'s
  `withAuth` resolves the caller (Keycloak JWT via JWKS, Bearer `apiTokens`
  row, or `access_token` cookie — priority: Bearer over cookie) and passes an
  `AuthContext` to the handler; `requireAuth`/`requireSuperAdmin` in
  `lib/archimate/auth.ts` throw `UnauthorizedError`/`ForbiddenError` rather
  than writing a response. Public routes (`/api/health`, `/api/openapi.json`,
  `/api/docs`, `GET /api/settings/messages`) simply omit `withAuth`.
- **Validation**: zod schemas live in `lib/archimate/validation.ts`, run
  through `parseBody<T>(schema, body): T`, which throws `ValidationError`
  (422) on failure instead of writing a response — callers don't need an
  `if (!body) return` guard. Applies to both request bodies
  (`parseBody(ElementCreateSchema, await req.json())`) and query strings
  (`parseBody(ElementQuerySchema, Object.fromEntries(req.nextUrl.searchParams))`).
- **Erreurs d'accès à deux niveaux, décidées une seule fois dans
  `access.ts`.** `NotFoundError` (404) si l'appelant n'a aucune
  appartenance à l'organisation ciblée (ou si l'id n'existe pas) — masque
  volontairement « pas membre » en « non trouvé » pour ne pas divulguer
  l'existence d'une ressource. `ForbiddenError` (403) si l'appelant **est**
  membre reconnu mais que son rôle est insuffisant pour l'action demandée
  (écriture pour un `member`, gestion des membres pour un non-`owner`,
  organisation suspendue) — l'existence et la relation de l'appelant à la
  ressource sont déjà connues, 404 serait trompeur. Les deux ne sont levées
  que depuis `access.ts` (`assertOrgAccess`/`assertWorkspaceAccess`/
  `resolveActiveContext`), jamais route par route. Les handlers résolvent
  le workspace actif via `activeWorkspaceId(auth, intent)` (ou
  `resolveActiveContext`/`assertWorkspaceAccess` directement).
- OpenAPI docs (`/api/openapi.json`, `/api/docs`) are generated from the
  same zod schemas via `@asteasolutions/zod-to-openapi` (`.openapi(...)`
  calls in `lib/archimate/openapi.ts`) — extend the zod schema, not a
  separate spec. The documented `servers[].url` includes the `/api`
  prefix; the `/mcp/` operation overrides it with an operation-level
  `servers` back to the app root, since that route lives outside `/api`
  (see `next.config.ts`'s rewrite).
- **CORS**: same-origin since the apps/web + apps/api + apps/mcp-server
  fusion — REST routes under `/api/**` set no CORS headers at all (the
  browser's same-origin policy is sufficient; no `cors()`-style middleware
  exists or should be added here). `pages/api/mcp.ts` is the one exception,
  since MCP clients (Claude Desktop, mcp-inspector, …) call it
  cross-origin: it sets `Access-Control-Allow-Origin: *` **without**
  `Access-Control-Allow-Credentials`, which is safe only because that route
  authenticates exclusively via Bearer token, never a cookie. Never combine
  a wildcard/reflected origin with credentials on a cookie-authenticated
  route — that was a real bug in the pre-fusion `apps/api` (`origin: true`
  + `credentials: true` together, which is no protection at all).
- **JSON body size**: Next.js Route Handlers impose no size limit by
  default (unlike the old Express `app.ts`, which had a 100kb ceiling via
  bare `express.json()`). This was a conscious decision, not an oversight:
  every REST route requires authentication and organization membership, and
  legitimate bodies (element/relationship/view JSON) are small — the one
  route with real payload size (XML model import, `/api/import`) already
  has its own explicit handling. The practical ceiling on Vercel is the
  platform's own request-body limit; the self-hosted Docker/Traefik
  topology enforces one explicitly (see `.docker/docker-compose.yml`'s
  `buffering` middleware). Don't add a bespoke per-route size check unless
  a real incident calls for it.
