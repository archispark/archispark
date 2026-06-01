import { app } from "./src/app.js";
import { reloadAuth } from "./src/better-auth.js";
import { initRedis } from "./src/redis.js";

// registry.ts runs runMigrations() + initUsers() via top-level await at import time.
// initRedis() is synchronous; reloadAuth() merges DB-stored OAuth providers async.
initRedis();
reloadAuth().catch((err) => console.error("[startup] reloadAuth failed:", err));

export default app;
