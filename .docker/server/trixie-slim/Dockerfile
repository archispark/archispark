# ── Stage 1 : build ───────────────────────────────────────────────────────────
FROM node:22-trixie-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY . /repo
WORKDIR /repo

RUN --mount=type=cache,id=pnpm-debian,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Build workspace packages whose dist is referenced by Next.js's file tracer
# (@workspace/db) or transpiled at build time (@workspace/auth).
RUN pnpm --filter @workspace/db build
RUN pnpm --filter @workspace/auth build

# next build evaluates every route module (including lib/archimate/store.ts),
# which imports @workspace/db — its top-level `await createDb()` needs a
# driver right away. DB_CLIENT=pglite gives it a throwaway in-memory instance
# for this step only; it must NOT leak into the runner stage below, or the
# running container would silently use an in-memory DB instead of Postgres.
ENV DB_CLIENT=pglite
RUN pnpm --filter server build

# ── Stage 2 : runtime (Next.js standalone, auto-suffisant) ────────────────────
FROM node:22-trixie-slim AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /repo/apps/server/.next/standalone ./
COPY --from=build /repo/apps/server/.next/static     apps/server/.next/static
COPY --from=build /repo/apps/server/public           apps/server/public

# @workspace/db's runMigrations() reads drizzle-pg/*.sql via a runtime
# fs.readFile relative to its own compiled module, which Next's output-file-
# tracing can't follow (it only traces `import`s, not dynamic fs reads) — the
# standalone copy above never includes it. Without this, the container starts
# but instrumentation.ts's register() hook crashes on every request with
# "Can't find meta/_journal.json file".
COPY --from=build /repo/packages/db/dist/drizzle-pg  packages/db/dist/drizzle-pg

EXPOSE 8000
ENV PORT=8000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/server/server.js"]
