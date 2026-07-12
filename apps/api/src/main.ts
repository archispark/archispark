import { runTenantFallbackMigrations } from "@workspace/db";
import { app } from "./app.js";

const PORT = process.env["PORT"] ? parseInt(process.env["PORT"]) : 3002;
const HOST = process.env["HOST"] ?? "0.0.0.0";

runTenantFallbackMigrations()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`ArchiMate tenant API running on http://${HOST}:${PORT}`);
    });
  }).catch((err) => {
    console.error("Startup failed:", err);
    process.exit(1);
  });
