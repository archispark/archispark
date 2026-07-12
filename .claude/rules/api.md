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
- **Ownership is enforced by query scoping, not a separate check.**
  Every query is scoped to `getActiveWorkspaceId(req.user!.id)` /
  `WHERE ownerId = userId`. When a row doesn't belong to the requesting
  user, throw `NotFoundError` (404) — **never** `ForbiddenError` (403).
  Unauthorized access is deliberately disguised as "not found" to avoid
  leaking existence.
- OpenAPI docs (`/openapi.json`, `/docs`) are generated from the same
  zod schemas via `@asteasolutions/zod-to-openapi` (`.openapi(...)`
  calls in `openapi.ts`) — extend the zod schema, not a separate spec.
