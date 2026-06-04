import { runMigrations } from "@workspace/db";
import { app } from "./app.js";
import { initUsers } from "./auth.js";
import { reloadAuth } from "./better-auth.js";
import { initRedis } from "./redis.js";

const PORT = process.env["PORT"] ? parseInt(process.env["PORT"]) : 3000;
const HOST = process.env["HOST"] ?? "0.0.0.0";

initRedis()
  .then(() => runMigrations())
  .then(() => initUsers())
  .then(() => reloadAuth())
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`ArchiMate API running on http://${HOST}:${PORT}`);
    });
  }).catch((err) => {
    console.error("Startup failed:", err);
    process.exit(1);
  });
