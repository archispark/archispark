---
paths:
  - "apps/api/src/**"
---

# API conventions (`apps/api`)

- **Error envelope**: every error response is `{ detail: "<message>" }`
  — not `{ error }` or `{ message }`. Error strings are written **in
  French** (e.g. `"Aucun workspace disponible."`) — match that, don't
  default to English.
- **Error classes**: `AppError`/`NotFoundError` (404)/`ValidationError`
  (422)/`ForbiddenError` (403) in `errors.ts`, thrown from
  handlers/`store.ts`/`registry.ts`, caught by a single global
  error-handling middleware at the bottom of `app.ts` that maps
  `AppError.statusCode` to the JSON response. Non-`AppError` throws fall
  through to a generic 500.
- **No `asyncHandler` wrapper.** The project is on Express 5, which
  auto-forwards rejected promises from async route handlers to
  `next(err)`. Don't add one defensively — it's unnecessary and
  inconsistent with the rest of the codebase.
- **Validation**: zod schemas live in `validation.ts`, run through the
  shared `parseBody(schema, body, res)` helper. On failure it does
  `safeParse`, writes `res.status(422).json({ detail: ... })` itself,
  and returns `null` — callers must `if (!body) return;` immediately
  after. This applies to both request bodies and query strings (e.g.
  `parseBody(ElementQuerySchema, req.query, res)`).
- **Auth**: `requireAuth` (Keycloak JWT via JWKS, or Bearer `apiTokens`
  row, or cookie) is mounted globally via `app.use(requireAuth)` before
  all routes except `/health`, `/openapi.json`, `/docs`, and
  `GET /settings/messages`.
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
  le workspace actif via `activeWorkspaceId(req, intent)` (ou
  `resolveActiveContext`/`assertWorkspaceAccess` directement) —
  `getActiveWorkspaceId(userId)` / `WHERE ownerId = userId` n'existent
  plus depuis l'introduction du modèle Organisation → Workspace.
- OpenAPI docs (`/openapi.json`, `/docs`) are generated from the same
  zod schemas via `@asteasolutions/zod-to-openapi` (`.openapi(...)`
  calls in `openapi.ts`) — extend the zod schema, not a separate spec.
