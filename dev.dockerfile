FROM node:22-alpine

# git is required by some postinstall scripts (e.g. husky, native add-ons)
RUN apk add --no-cache git python3 make g++

# Pin exact pnpm version from package.json#packageManager
RUN corepack enable && corepack prepare pnpm@11.4.0 --activate

WORKDIR /app

EXPOSE 3000 3001 8000

# Install deps on first start (or when lock file changes), then launch all apps.
# node_modules is an anonymous volume so native modules are compiled for
# the container's libc rather than the host's.
CMD ["sh", "-c", "pnpm install && exec pnpm dev"]
