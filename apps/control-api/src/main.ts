import { runMigrations, ensureTenantRole } from "@workspace/db";
import { initOrganizations } from "./auth.js";
import { initRedis } from "./redis.js";

const PORT = process.env["PORT"] ? parseInt(process.env["PORT"]) : 3000;
const HOST = process.env["HOST"] ?? "0.0.0.0";

initRedis()
  .then(() => runMigrations())
  .then(() => ensureTenantRole(process.env["TENANT_DB_PASSWORD"] ?? ""))
  .then(() => initOrganizations())
  .then(async () => {
    // Dynamic import so app.ts (and its rateLimit/RedisStore) is loaded only
    // after initRedis() has connected, avoiding the "Non initialisé" error.
    const { app } = await import("./app.js");
    app.listen(PORT, HOST, () => {
      console.log(`ArchiMate API running on http://${HOST}:${PORT}`);
    });
  }).catch((err) => {
    console.error("Startup failed:", err);
    process.exit(1);
  });
