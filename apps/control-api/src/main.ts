import { runMigrations, ensureTenantRole } from "@workspace/db";
import { initOrganizations } from "./auth.js";
import { app } from "./app.js";

const PORT = process.env["PORT"] ? parseInt(process.env["PORT"]) : 3000;
const HOST = process.env["HOST"] ?? "0.0.0.0";

runMigrations()
  .then(() => ensureTenantRole(process.env["TENANT_DB_PASSWORD"] ?? ""))
  .then(() => initOrganizations())
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`ArchiMate API running on http://${HOST}:${PORT}`);
    });
  }).catch((err) => {
    console.error("Startup failed:", err);
    process.exit(1);
  });
