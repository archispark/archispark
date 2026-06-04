# ── Stage 1 : build ───────────────────────────────────────────────────────────
FROM node:22-trixie-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY . /repo
WORKDIR /repo

RUN --mount=type=cache,id=pnpm-debian,target=/pnpm/store \
    pnpm install --frozen-lockfile

RUN pnpm --filter docs build

# ── Stage 2 : runtime ─────────────────────────────────────────────────────────
FROM node:22-trixie-slim AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /repo

COPY --from=build /repo/pnpm-workspace.yaml                          ./
COPY --from=build /repo/pnpm-lock.yaml                               ./
COPY --from=build /repo/package.json                                  ./
COPY --from=build /repo/apps/docs/package.json                        apps/docs/
COPY --from=build /repo/packages/typescript-config/package.json       packages/typescript-config/
COPY --from=build /repo/packages/eslint-config/package.json           packages/eslint-config/

RUN --mount=type=cache,id=pnpm-debian,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

COPY --from=build /repo/apps/docs/dist  apps/docs/dist

ENV NODE_ENV=production
ENV PORT=9000
ENV HOST=0.0.0.0
ENV API_URL=http://api:3000

EXPOSE 9000
WORKDIR /repo/apps/docs
CMD ["node", "dist/main.js"]
