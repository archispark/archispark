/**
 * ArchiSpark — pm2 process manager
 *
 * Gère les 3 services dans un seul conteneur :
 *   api  → Express REST API    :3000
 *   mcp  → MCP Server          :3001
 *   web  → Next.js             :8000 (proxie /api/* vers api)
 *
 * PostgreSQL et Redis fournis par docker-compose.demo.yml
 * (éphémères, sans volumes → réinitialisés à chaque recréation).
 */

const DB           = process.env.DATABASE_URL  ?? "postgresql://archispark:archispark@postgres:5432/archispark";
const REDIS        = process.env.REDIS_URL     ?? "redis://redis:6379";
const AUTH_SECRET  = process.env.BETTER_AUTH_SECRET ?? process.env.JWT_SECRET ?? "archispark-demo-2026";

module.exports = {
  apps: [
    // ── API REST ────────────────────────────────────────────────────
    {
      name: "api",
      script: "/app/apps/api/dist/main.js",
      wait_ready: true,
      listen_timeout: 15000,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        DATABASE_URL: DB,
        REDIS_URL: REDIS,
        JWT_SECRET: AUTH_SECRET,
        BETTER_AUTH_URL: "http://localhost:8000",
        SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD ?? "demo",
        SEED_USER_PASSWORD: process.env.SEED_USER_PASSWORD ?? "demo",
      },
    },

    // ── MCP Server ──────────────────────────────────────────────────
    {
      name: "mcp",
      script: "/app/apps/mcp-server/dist/main.js",
      env: {
        NODE_ENV: "production",
        MCP_PORT: "3001",
        HOST: "0.0.0.0",
        DATABASE_URL: DB,
        MCP_AUTH_TOKEN: process.env.MCP_AUTH_TOKEN ?? "",
      },
    },

    // ── Web Next.js (standalone) ────────────────────────────────────
    // /api/* et /auth/* sont proxy-és vers l'API Express (next.config.ts)
    {
      name: "web",
      script: "/app/apps/web/.next/standalone/apps/web/server.js",
      env: {
        NODE_ENV: "production",
        PORT: "8000",
        HOSTNAME: "0.0.0.0",
        ARCHIMATE_API_URL: "http://localhost:3000",
      },
    },
  ],
};
