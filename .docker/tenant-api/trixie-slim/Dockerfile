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
RUN pnpm --filter tenant-api build

# ── Stage 2 : runtime ─────────────────────────────────────────────────────────
FROM node:22-trixie-slim AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /repo

COPY --from=build /repo/pnpm-workspace.yaml                          ./
COPY --from=build /repo/pnpm-lock.yaml                               ./
COPY --from=build /repo/package.json                                  ./
COPY --from=build /repo/apps/tenant-api/package.json                          apps/tenant-api/
COPY --from=build /repo/packages/db/package.json                      packages/db/
COPY --from=build /repo/packages/types/package.json                   packages/types/
COPY --from=build /repo/packages/typescript-config/package.json       packages/typescript-config/
COPY --from=build /repo/packages/eslint-config/package.json           packages/eslint-config/

RUN --mount=type=cache,id=pnpm-debian,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

COPY --from=build /repo/apps/tenant-api/dist          apps/tenant-api/dist
COPY --from=build /repo/packages/db/dist      packages/db/dist
COPY --from=build /repo/packages/db/drizzle-pg packages/db/drizzle-pg

ENV NODE_ENV=production
ENV PORT=3002
ENV HOST=0.0.0.0

EXPOSE 3002
WORKDIR /repo/apps/tenant-api
CMD ["node", "dist/main.js"]
