# ── Stage 1 : build ───────────────────────────────────────────────────────────
FROM node:22-trixie-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY . /repo
WORKDIR /repo

RUN --mount=type=cache,id=pnpm-debian,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Build workspace packages whose dist is referenced by Next.js file tracer
RUN pnpm --filter @workspace/db build

ARG ARCHIMATE_API_URL=
ENV ARCHIMATE_API_URL=${ARCHIMATE_API_URL}

RUN pnpm --filter web build

# ── Stage 2 : runtime (Next.js standalone, auto-suffisant) ────────────────────
FROM node:22-trixie-slim AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static     apps/web/.next/static
COPY --from=build /repo/apps/web/public           apps/web/public

EXPOSE 8000
ENV PORT=8000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
