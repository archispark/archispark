---
title: Development Guide
description: Code conventions, tests, migrations, adding routes and MCP tools, production deployment.
---

## Monorepo Structure

```
archispark/
├── apps/
│   ├── control-api/           → Express 5 — public entry point :3000
│   │   └── src/
│   │       ├── app.ts         → Routes it owns + proxy of everything else to tenant-api
│   │       ├── auth.ts        → requireAuth, resolveWorkspaceContext, requireWorkspaceWrite, demo user seeding
│   │       ├── better-auth.ts → Better Auth config (username, admin, organization+teams, OAuth)
│   │       ├── errors.ts      → AppError, NotFoundError, ValidationError, ForbiddenError
│   │       ├── redis.ts        → Redis session cache + rate-limit store
│   │       └── main.ts         → Entrypoint
│   ├── tenant-api/            → Express 5 — internal-only :3002
│   │   └── src/
│   │       ├── app.ts          → Workspaces/elements/relationships/views/property-definitions/import-export, /openapi.json, /docs
│   │       ├── tenant-auth.ts   → Verifies the inter-service JWT signed by control-api
│   │       ├── errors.ts        → AppError, NotFoundError, ValidationError, ForbiddenError, UnauthorizedError
│   │       ├── openapi.ts       → OpenAPI spec (Zod + zod-to-openapi)
│   │       ├── oxf-parser.ts / oxf-serializer.ts → Open Exchange XML ↔ ArchiModel
│   │       ├── registry.ts      → Workspace management
│   │       ├── renderer.ts      → SVG/PNG view rendering
│   │       ├── archimate-icons.ts → Element-type icon lookup for SVG/PNG rendering
│   │       ├── schemas.ts       → TypeScript types + ArchiMate constants
│   │       └── validation.ts    → Zod schemas (body + query strings)
│   ├── mcp-server/            → MCP server (38 tools, 2 prompts, 2 resources), stateless Streamable HTTP, :3001
│   ├── web/                    → Next.js 16 — customer UI, :8000
│   │   ├── app/                 → Pages (App Router): elements, relationships, views, properties, workspaces, organization, settings, profile, login
│   │   │   └── elements/[id]/page.tsx → Element detail (Properties · Relations · Graph tabs)
│   │   ├── components/          → React components
│   │   │   ├── view-canvas.tsx        → ReactFlow diagram editor
│   │   │   ├── element-graph-tab.tsx  → Force-directed relationship graph
│   │   │   ├── sidebar.tsx            → Main navigation
│   │   │   └── organization-sidebar.tsx → /organization section navigation
│   │   ├── hooks/                → use-current-user, use-organization (org role + auto-activate), use-form-modal, use-keyboard-shortcut
│   │   └── lib/
│   │       ├── api.ts            → Fetch functions to control-api/tenant-api
│   │       ├── queries.ts        → TanStack Query hooks (useQuery + useMutation)
│   │       ├── archimate-helpers.ts → getLayer(), LAYER_HEX_COLORS, …
│   │       ├── archimate-rules.ts   → ArchiMate compatibility rules
│   │       └── auth-client.ts    → Better Auth client (username/admin/organization plugins)
│   └── admin-web/               → Next.js 16 — platform admin console, :8001, `platform_admin` only (deployed independently, not in `.docker/`)
├── packages/
│   ├── db/                      → Drizzle ORM
│   │   ├── src/
│   │   │   ├── schema.control.ts → Control-plane schema (orgs, members, teams, users, sessions, api_tokens, tenant_databases, …)
│   │   │   ├── schema.tenant.ts  → Tenant-plane schema (workspaces, elements, relationships, views, …)
│   │   │   ├── connection.ts     → Control-plane + per-tenant DB connections
│   │   │   ├── model.ts / model-io.ts → ArchiModel types + read/write from DB
│   │   │   ├── tenant-provisioning.ts / tenant-migration.ts → Neon tenant DB provisioning + migration
│   │   │   ├── tenant-jwt.ts / tenant-crypto.ts → Inter-service JWT + tenant DB URL encryption
│   │   │   └── neon-api.ts       → Neon API client
│   │   └── drizzle-pg/           → Control-plane migrations (+ `drizzle-pg/tenant/` for tenant-plane)
│   ├── types/                    → Shared types across API ↔ Web
│   ├── ui/                       → shadcn/ui component library (@workspace/ui)
│   ├── eslint-config/, typescript-config/ → Shared tooling configs
├── .docker/                      → Dockerfiles by service and OS variant
│   ├── control-api/{alpine,trixie-slim}/Dockerfile
│   ├── tenant-api/{alpine,trixie-slim}/Dockerfile
│   ├── mcp-server/{alpine,trixie-slim}/Dockerfile
│   └── web/{alpine,trixie-slim}/Dockerfile
├── docker-compose.yml            → Production (Hub images)
├── docker-compose.dev.yml        → Development infra (postgres + redis)
└── Makefile                      → Shortcuts for compose + image build/push
```

## Commands

```bash
pnpm dev                   # Start every app (control-api, tenant-api, mcp-server, web, admin-web) via Turborepo
pnpm run -w test           # All tests (669 tests across all packages)
pnpm run -w test:coverage  # Coverage ≥80%
pnpm turbo run lint        # ESLint (zero errors)
pnpm turbo run typecheck   # Strict TypeScript
pnpm build                 # Production build (tsc for control-api/tenant-api/mcp-server, next build for web/admin-web)
```

## Docker & build

See the full reference in [Getting Started](/getting-started). Key shortcuts:

```bash
make dev-infra        # start postgres + redis, then run pnpm dev on host
make build            # build all images (OS=alpine by default)
make build-all        # build both alpine and trixie-slim
make release VERSION=x.y.z   # build-all + push-all
```

Image naming: `archispark/archispark-{service}:{OS}-{VERSION}`  
(e.g. `archispark/archispark-control-api:alpine-0.5.2`). `admin-web` has no Docker image — it's deployed independently (e.g. its own Vercel project).

## Tests

Tests use [Vitest](https://vitest.dev) + [Supertest](https://github.com/ladjs/supertest).

```
apps/control-api/src/
├── app.test.ts          → Routes owned by control-api + proxy to tenant-api
├── auth.test.ts          → requireAuth, resolveWorkspaceContext, requireWorkspaceWrite, demo seeding
├── better-auth.test.ts   → Better Auth plugin configuration
└── redis.test.ts         → Redis session cache + rate-limit store

apps/tenant-api/src/
├── app.test.ts           → Workspaces/elements/relationships/views/property-definitions routes
├── tenant-auth.test.ts   → Inter-service JWT verification
├── oxf-parser.test.ts / oxf-serializer.test.ts → XML round-trip
├── registry.test.ts      → Workspace management
├── renderer.test.ts      → SVG/PNG rendering
├── schemas.test.ts        → Type validation
├── serializers.test.ts
├── store.test.ts
├── redis.test.ts
└── xml-escape.test.ts

packages/db/src/
├── connection.test.ts
├── migrate-tenant.test.ts
├── model-io.test.ts
├── neon-api.test.ts
├── tenant-crypto.test.ts
├── tenant-jwt.test.ts
└── tenant-provisioning.test.ts

apps/web/
├── components/*.test.tsx   → data-table, view-canvas, …
├── hooks/use-current-user.test.ts
└── lib/{api,archimate-rules}.test.ts

apps/admin-web/   → component, hook, lib and per-page tests (users, organizations, redis, postgres, messages, authentication, login)

apps/mcp-server/src/   → tool registration/auth test
```

Run tests for a specific package:

```bash
cd apps/tenant-api && pnpm test
cd apps/tenant-api && pnpm test -- --reporter=verbose renderer
```

## Schema Migrations

After modifying `packages/db/src/schema.control.ts` or `schema.tenant.ts`:

```bash
cd packages/db
DB_DRIVER=postgres npx drizzle-kit generate                                    # control-plane → drizzle-pg/
DB_DRIVER=postgres npx drizzle-kit generate --config drizzle.config.tenant.ts  # tenant-plane → drizzle-pg/tenant/
```

Migrations are applied automatically on control-api/tenant-api startup.

## Validation (Zod v4)

Workspace-content routes (elements, relationships, views, property definitions, import/export) live in `apps/tenant-api`; all body and query string validation goes through `apps/tenant-api/src/validation.ts`. The `parseBody(schema, input, res)` function returns `null` and responds with 422 on failure.

> **Important:** Zod v4 uses `result.error.issues` (not `.errors`).

## Error Handling (Express 5)

Express 5 automatically propagates synchronous errors. The global handler at the end of `app.ts` (in both `apps/control-api` and `apps/tenant-api`) handles:

| Class                                 | HTTP Status       |
| ------------------------------------- | ----------------- |
| `NotFoundError`                       | 404               |
| `ValidationError`                     | 422               |
| `ForbiddenError`                      | 403               |
| `UnauthorizedError` (tenant-api only) | 401               |
| `AppError` (other status)             | custom statusCode |
| Any other `Error`                     | 500               |

```typescript
// Throw a typed error in a route:
throw new NotFoundError(`Element '${id}' not found.`)
// → Express 5 propagates to global handler → 404 + { detail: "..." }
```

## Adding an MCP Tool

In `apps/mcp-server/src/server.ts`:

```typescript
mcpServer.registerTool(
  "my_tool",
  {
    description: "Description for the LLM",
    inputSchema: {
      param1: z.string().describe("Parameter description"),
    },
  },
  async ({ param1 }) => {
    const result = myFunction(param1)
    return toContent(result)
  }
)
```

## Adding an API Route

For **workspace-content** routes (elements, relationships, views, property definitions, import/export) — in `apps/tenant-api/src/`:

1. Create the business logic (pure function) in `app.ts` or a dedicated file.
2. Add the corresponding Zod schema in `validation.ts`.
3. Register the route in `app.ts` via `parseBody()`.
4. The global error handler handles `NotFoundError` / `ValidationError` / `UnauthorizedError`.
5. Document in `openapi.ts` (use `toOpenApiSchema()` for input schemas).
6. Write tests in `app.test.ts`.

For **control-plane** routes (organizations, teams, users, API tokens, platform admin) — same pattern in `apps/control-api/src/app.ts` + `auth.ts` + `app.test.ts`.

## Adding a React Query Hook

In `apps/web/lib/queries.ts`:

```typescript
// 1. Add the key in queryKeys
export const queryKeys = {
  myResource: () => ["myResource"] as const,
}

// 2. Read hook
export function useMyResource() {
  return useQuery({
    queryKey: queryKeys.myResource(),
    queryFn: fetchMyResource,
  })
}

// 3. Mutation hook
export function useCreateMyResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: MyResourceCreateIn) => createMyResource(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myResource() }),
  })
}
```

## Code Conventions

- **No comments** except for a non-obvious invariant or a specific workaround.
- **Typed errors**: throw `NotFoundError` / `ValidationError` rather than `new Error`.
- **No try/catch in routes**: Express 5 propagates, the global handler handles it.
- **ESM strict**: `.js` extensions in TypeScript imports in control-api/tenant-api/mcp-server.
- **Shared types**: use `@workspace/types` for API ↔ Web types.
- **ArchiMate constants**: use `lib/archimate-helpers.ts` on the web side.

## Production Deployment

```bash
# Build (tsc for control-api/tenant-api/mcp-server, next build for web/admin-web)
pnpm build

# Start each service
cd apps/control-api && node dist/main.js   # :3000 — public entry point
cd apps/tenant-api  && node dist/main.js   # :3002 — internal only, never expose publicly
cd apps/mcp-server  && node dist/main.js   # :3001
cd apps/web         && pnpm start          # :8000
cd apps/admin-web   && pnpm start          # :8001 — deployed separately, platform_admin only

# Required variables in production:
BETTER_AUTH_SECRET=<32+ random chars>
TENANT_JWT_SECRET=<32+ random chars>
TENANT_DB_ENCRYPTION_KEY=<32+ random chars>
SEED_ADMIN_PASSWORD=<strong-password>
SEED_USER_PASSWORD=<strong-password>
SEED_CONTRIB_PASSWORD=<strong-password>
SEED_ARCHI_PASSWORD=<strong-password>
DATABASE_URL=postgresql://user:pass@host:5432/archispark
REDIS_URL=redis://...
```

For PostgreSQL, generate migrations before the first startup:

```bash
cd packages/db
DATABASE_URL=postgresql://... npx drizzle-kit migrate
```
