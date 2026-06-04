# ── Stage 1 : build ───────────────────────────────────────────────────────────
FROM node:22-trixie-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY . /repo
WORKDIR /repo

RUN --mount=type=cache,id=pnpm-debian,target=/pnpm/store \
    pnpm install --frozen-lockfile

RUN pnpm --filter @workspace/db build
RUN pnpm --filter api build
RUN pnpm --filter mcp-server build

# ── Stage 2 : runtime ─────────────────────────────────────────────────────────
FROM node:22-trixie-slim AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /repo

COPY --from=build /repo/pnpm-workspace.yaml                          ./
COPY --from=build /repo/pnpm-lock.yaml                               ./
COPY --from=build /repo/package.json                                  ./
COPY --from=build /repo/apps/mcp-server/package.json                  apps/mcp-server/
COPY --from=build /repo/apps/api/package.json                         apps/api/
COPY --from=build /repo/packages/db/package.json                      packages/db/
COPY --from=build /repo/packages/types/package.json                   packages/types/
COPY --from=build /repo/packages/typescript-config/package.json       packages/typescript-config/
COPY --from=build /repo/packages/eslint-config/package.json           packages/eslint-config/

RUN --mount=type=cache,id=pnpm-debian,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

COPY --from=build /repo/apps/mcp-server/dist apps/mcp-server/dist
COPY --from=build /repo/apps/api/dist        apps/api/dist
COPY --from=build /repo/packages/db/dist     packages/db/dist

ENV NODE_ENV=production
ENV MCP_PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001
WORKDIR /repo/apps/mcp-server
CMD ["node", "dist/main.js"]
