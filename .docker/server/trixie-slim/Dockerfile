# ── Stage 1 : build ───────────────────────────────────────────────────────────
FROM node:22-trixie-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY . /repo
WORKDIR /repo

RUN --mount=type=cache,id=pnpm-debian,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Build workspace packages Next.js's zero-config detection doesn't build on
# its own — same list as apps/server/vercel.json's buildCommand. @workspace/env
# first: next.config.ts imports it by its package specifier (resolves to
# dist/), and the others depend on it too — same class of bug already fixed
# for migrate-prod.yml (see that workflow's comment).
RUN pnpm --filter @workspace/env build
RUN pnpm --filter @workspace/db build
RUN pnpm --filter @workspace/db-neo4j build
RUN pnpm --filter @workspace/auth build
RUN pnpm --filter @workspace/image-library build

# next build evaluates every route module (including lib/archimate/store.ts),
# which imports @workspace/db — its top-level `await createDb()` needs a
# driver right away. DB_CLIENT=pglite gives it a throwaway in-memory instance
# for this step only; it must NOT leak into the runner stage below, or the
# running container would silently use an in-memory DB instead of Postgres.
ENV DB_CLIENT=pglite
RUN pnpm --filter server build

# `next build`'s standalone output only bundles what its own routes/instrumentation
# import — server.js no longer calls any migration function (see
# instrumentation.ts), so @workspace/db/-neo4j aren't real resolvable packages
# there, only inlined code. `pnpm deploy` instead produces a fully self-contained
# copy of @workspace/db-neo4j (which depends on @workspace/db) — a real
# node_modules, no monorepo symlinks — for docker-migrate.mjs below to run
# standalone via plain `node`, independent from the Next.js build entirely.
# --legacy: this workspace doesn't set inject-workspace-packages=true.
RUN pnpm --filter @workspace/db-neo4j deploy --prod --legacy /migrate

# ── Stage 2 : runtime (Next.js standalone, auto-suffisant) ────────────────────
FROM node:22-trixie-slim AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /repo/apps/server/.next/standalone ./
COPY --from=build /repo/apps/server/.next/static     apps/server/.next/static
COPY --from=build /repo/apps/server/public           apps/server/public

# Standalone migration entry point — never invoked by the `server` service
# itself (see instrumentation.ts), only by `docker compose run --rm migrate`
# (see docker-compose.prod.yml). /migrate already contains its own SQL/Cypher
# migration files (packaged inside @workspace/db's/@workspace/db-neo4j's dist/
# by their own build step) — no separate COPY needed for those.
COPY --from=build /migrate                          migrate
COPY apps/server/scripts/docker-migrate.mjs          migrate/docker-migrate.mjs

EXPOSE 8000
ENV PORT=8000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/server/server.js"]
