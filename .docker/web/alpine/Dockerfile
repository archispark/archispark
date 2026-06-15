# ── Stage 1 : build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY . /repo
WORKDIR /repo

RUN --mount=type=cache,id=pnpm-alpine,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Build workspace packages whose dist is referenced by Next.js file tracer
RUN pnpm --filter @workspace/db build
RUN pnpm --filter @workspace/auth build

# ARCHIMATE_API_URL vide → rewrites désactivés (le proxy gère /api/* et /auth/*)
ARG ARCHIMATE_API_URL=
ENV ARCHIMATE_API_URL=${ARCHIMATE_API_URL}

# URL publique du serveur MCP — inlinée dans le bundle Next.js au build
ARG NEXT_PUBLIC_MCP_SERVER_URL=https://archispark-mcp-server.vercel.app/mcp/
ENV NEXT_PUBLIC_MCP_SERVER_URL=${NEXT_PUBLIC_MCP_SERVER_URL}

RUN pnpm --filter web build

# ── Stage 2 : runtime (Next.js standalone, auto-suffisant) ────────────────────
FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static     apps/web/.next/static
COPY --from=build /repo/apps/web/public           apps/web/public

EXPOSE 8000
ENV PORT=8000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
