import { initRedis } from "./redis.js";

const PORT = process.env["PORT"] ? parseInt(process.env["PORT"]) : 3002;
const HOST = process.env["HOST"] ?? "0.0.0.0";

initRedis()
  .then(async () => {
    // Dynamic import so app.ts (and its rateLimit/RedisStore) is loaded only
    // after initRedis() has connected, avoiding the "Non initialisé" error.
    const { app } = await import("./app.js");
    app.listen(PORT, HOST, () => {
      console.log(`ArchiMate tenant API running on http://${HOST}:${PORT}`);
    });
  }).catch((err) => {
    console.error("Startup failed:", err);
    process.exit(1);
  });
