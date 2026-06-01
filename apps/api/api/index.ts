import type { IncomingMessage, ServerResponse } from "node:http";
import { app } from "../src/app.js";
import { reloadAuth } from "../src/better-auth.js";
import { initRedis } from "../src/redis.js";

// registry.ts executes runMigrations() + initUsers() via top-level await at
// module load time, so those are guaranteed to complete before the first
// request reaches this handler.

let _ready: Promise<void> | undefined;

function ensurePostInit(): Promise<void> {
  if (!_ready) {
    initRedis();
    _ready = reloadAuth().catch((err) => {
      _ready = undefined;
      throw err;
    });
  }
  return _ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ensurePostInit();
  app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
